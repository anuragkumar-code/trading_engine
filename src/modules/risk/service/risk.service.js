const { TradeIntent, RiskLimit, Order, User, KiteAccount } = require('../../../infrastructure/database/models');
const { cache } = require('../../../infrastructure/redis');
const { executionQueue, auditQueue } = require('../../../infrastructure/queue');
const { KiteClient } = require('../../../infrastructure/http');
const logger = require('../../../infrastructure/logger');
const auditLogger = require('../../../infrastructure/logger/audit');
const { RiskViolationError } = require('../../../shared/errors');
const { RISK } = require('../../../shared/constants');
const config = require('../../../shared/config');
const KillSwitchService = require('./killswitch.service');
const { encryption } = require('../../../shared/utils');
const { Op } = require('sequelize');

class RiskService {
  constructor() {
    this.killSwitchService = new KillSwitchService();
    this.circuitBreakerKey = 'risk:circuit_breaker:';
  }

  /**
   * Check trade intent against all risk limits
   * @param {string} tradeIntentId - Trade intent ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} - Risk check result
   */
  async checkTradeIntent(tradeIntentId, userId) {
    try {
      logger.info(`Running risk checks for trade intent ${tradeIntentId}`);

      const tradeIntent = await TradeIntent.findByPk(tradeIntentId);
      
      if (!tradeIntent) {
        throw new Error('Trade intent not found');
      }

      // Check kill switch
      const killSwitchEnabled = await this.killSwitchService.isEnabled();
      if (killSwitchEnabled) {
        await this.rejectTradeIntent(tradeIntent, 'Kill switch is enabled');
        return { passed: false, reason: 'KILL_SWITCH', autoTriggered: false };
      }

      // Run all risk checks
      const checks = [
        this.checkDailyLoss(userId, tradeIntent),
        this.checkPositionSize(userId, tradeIntent),
        this.checkMaxPositions(userId, tradeIntent),
        this.checkCircuitBreaker(userId),
      ];

      const results = await Promise.all(checks);

      // Check if any risk check failed
      const failedCheck = results.find(r => !r.passed);

      if (failedCheck) {
        logger.warn(`Risk check failed for ${tradeIntentId}:`, failedCheck);

        // Reject trade intent
        await this.rejectTradeIntent(tradeIntent, failedCheck.reason);

        // Log risk violation
        await this.logRiskViolation(userId, failedCheck);

        // Auto-trigger kill switch if critical
        if (failedCheck.critical) {
          await this.killSwitchService.autoTrigger(userId, failedCheck.reason);
          return { passed: false, ...failedCheck, autoTriggered: true };
        }

        return { passed: false, ...failedCheck, autoTriggered: false };
      }

      // All checks passed - approve and queue for execution
      await tradeIntent.update({
        status: 'APPROVED',
        riskCheckResult: {
          passed: true,
          checks: results,
          checkedAt: new Date(),
        },
      });

      // Queue for execution
      await executionQueue.add('execute_order', {
        tradeIntentId: tradeIntent.id,
        userId,
      }, {
        priority: 2,
      });

      logger.info(`Trade intent ${tradeIntentId} approved and queued for execution`);

      return {
        passed: true,
        tradeIntentId: tradeIntent.id,
        checks: results,
      };

    } catch (error) {
      logger.error('Error in risk check:', error);
      throw error;
    }
  }

  /**
   * Check daily loss limit
   * @param {string} userId - User ID
   * @param {Object} tradeIntent - Trade intent
   * @returns {Promise<Object>} - Check result
   */
  async checkDailyLoss(userId, tradeIntent) {
    try {
      // Get user's daily loss limit
      const limit = await RiskLimit.findOne({
        where: {
          userId,
          limitType: RISK.LIMIT_TYPE.DAILY_LOSS,
          status: 'ACTIVE',
        },
      });

      if (!limit) {
        // No limit set - pass
        return { passed: true, check: 'DAILY_LOSS' };
      }

      // Get today's realized P&L
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const todaysOrders = await Order.findAll({
        where: {
          userId,
          status: 'COMPLETE',
          updatedAt: {
            [Op.gte]: today,
          },
        },
      });

      // Calculate realized P&L (simplified)
      let realizedPnl = 0;
      todaysOrders.forEach(order => {
        if (order.averagePrice && order.filledQuantity) {
          const pnl = (order.averagePrice - (order.price || 0)) * order.filledQuantity;
          realizedPnl += order.transactionType === 'BUY' ? -pnl : pnl;
        }
      });

      // Get account value for percentage calculation
      const accountValue = await this.getAccountValue(userId);

      let lossPercentage = 0;
      if (accountValue > 0) {
        lossPercentage = (Math.abs(realizedPnl) / accountValue) * 100;
      }

      const maxLossPercentage = limit.unit === 'PERCENTAGE' 
        ? parseFloat(limit.value) 
        : (parseFloat(limit.value) / accountValue) * 100;

      if (realizedPnl < 0 && lossPercentage >= maxLossPercentage) {
        return {
          passed: false,
          check: 'DAILY_LOSS',
          reason: `Daily loss limit exceeded: ${lossPercentage.toFixed(2)}% (limit: ${maxLossPercentage.toFixed(2)}%)`,
          critical: true,
          data: {
            realizedPnl,
            lossPercentage,
            maxLossPercentage,
          },
        };
      }

      return {
        passed: true,
        check: 'DAILY_LOSS',
        data: {
          realizedPnl,
          lossPercentage,
          maxLossPercentage,
        },
      };

    } catch (error) {
      logger.error('Error checking daily loss:', error);
      // Fail safe - reject on error
      return {
        passed: false,
        check: 'DAILY_LOSS',
        reason: 'Error checking daily loss limit',
        critical: false,
      };
    }
  }

  /**
   * Check position size limit
   * @param {string} userId - User ID
   * @param {Object} tradeIntent - Trade intent
   * @returns {Promise<Object>} - Check result
   */
  async checkPositionSize(userId, tradeIntent) {
    try {
      const limit = await RiskLimit.findOne({
        where: {
          userId,
          limitType: RISK.LIMIT_TYPE.POSITION_SIZE,
          status: 'ACTIVE',
        },
      });

      if (!limit) {
        return { passed: true, check: 'POSITION_SIZE' };
      }

      const accountValue = await this.getAccountValue(userId);
      const positionValue = (tradeIntent.price || 0) * tradeIntent.quantity;
      const positionPercentage = (positionValue / accountValue) * 100;

      const maxPercentage = parseFloat(limit.value);

      if (positionPercentage > maxPercentage) {
        return {
          passed: false,
          check: 'POSITION_SIZE',
          reason: `Position size exceeds limit: ${positionPercentage.toFixed(2)}% (limit: ${maxPercentage}%)`,
          critical: false,
          data: {
            positionValue,
            positionPercentage,
            maxPercentage,
          },
        };
      }

      return {
        passed: true,
        check: 'POSITION_SIZE',
        data: {
          positionValue,
          positionPercentage,
          maxPercentage,
        },
      };

    } catch (error) {
      logger.error('Error checking position size:', error);
      return {
        passed: false,
        check: 'POSITION_SIZE',
        reason: 'Error checking position size limit',
        critical: false,
      };
    }
  }

  /**
   * Check maximum open positions
   * @param {string} userId - User ID
   * @param {Object} tradeIntent - Trade intent
   * @returns {Promise<Object>} - Check result
   */
  async checkMaxPositions(userId, tradeIntent) {
    try {
      const limit = await RiskLimit.findOne({
        where: {
          userId,
          limitType: RISK.LIMIT_TYPE.MAX_POSITIONS,
          status: 'ACTIVE',
        },
      });

      if (!limit) {
        return { passed: true, check: 'MAX_POSITIONS' };
      }

      // Get current open positions count
      const kiteAccount = await KiteAccount.findOne({
        where: { userId, status: 'ACTIVE' },
      });

      if (!kiteAccount || !kiteAccount.accessToken) {
        return { passed: true, check: 'MAX_POSITIONS' };
      }

      const accessToken = encryption.decrypt(kiteAccount.accessToken);
      const kiteClient = new KiteClient(accessToken);
      
      const positions = await kiteClient.getPositions();
      const openPositionsCount = positions.net?.filter(p => p.quantity !== 0).length || 0;

      const maxPositions = parseInt(limit.value, 10);

      if (openPositionsCount >= maxPositions) {
        return {
          passed: false,
          check: 'MAX_POSITIONS',
          reason: `Maximum open positions reached: ${openPositionsCount} (limit: ${maxPositions})`,
          critical: false,
          data: {
            openPositionsCount,
            maxPositions,
          },
        };
      }

      return {
        passed: true,
        check: 'MAX_POSITIONS',
        data: {
          openPositionsCount,
          maxPositions,
        },
      };

    } catch (error) {
      logger.error('Error checking max positions:', error);
      return {
        passed: true, // Don't block on API errors
        check: 'MAX_POSITIONS',
      };
    }
  }

  /**
   * Check circuit breaker (consecutive failures)
   * @param {string} userId - User ID
   * @returns {Promise<Object>} - Check result
   */
  async checkCircuitBreaker(userId) {
    try {
      const key = `${this.circuitBreakerKey}${userId}`;
      const failures = await cache.get(key);
      const failureCount = failures?.count || 0;

      const threshold = config.app.risk.circuitBreakerThreshold;

      if (failureCount >= threshold) {
        return {
          passed: false,
          check: 'CIRCUIT_BREAKER',
          reason: `Circuit breaker triggered: ${failureCount} consecutive failures`,
          critical: true,
          data: {
            failureCount,
            threshold,
          },
        };
      }

      return {
        passed: true,
        check: 'CIRCUIT_BREAKER',
        data: {
          failureCount,
          threshold,
        },
      };

    } catch (error) {
      logger.error('Error checking circuit breaker:', error);
      return { passed: true, check: 'CIRCUIT_BREAKER' };
    }
  }

  /**
   * Increment circuit breaker counter
   * @param {string} userId - User ID
   */
  async incrementCircuitBreaker(userId) {
    try {
      const key = `${this.circuitBreakerKey}${userId}`;
      const failures = await cache.get(key);
      const count = (failures?.count || 0) + 1;

      await cache.set(
        key,
        { count, lastFailure: new Date() },
        config.app.risk.circuitBreakerWindowMs / 1000
      );

      logger.warn(`Circuit breaker count: ${count} for user ${userId}`);

      // Auto-trigger kill switch if threshold reached
      if (count >= config.app.risk.circuitBreakerThreshold) {
        await this.killSwitchService.autoTrigger(userId, `Circuit breaker: ${count} consecutive failures`);
      }

    } catch (error) {
      logger.error('Error incrementing circuit breaker:', error);
    }
  }

  /**
   * Reset circuit breaker counter
   * @param {string} userId - User ID
   */
  async resetCircuitBreaker(userId) {
    try {
      const key = `${this.circuitBreakerKey}${userId}`;
      await cache.del(key);
    } catch (error) {
      logger.error('Error resetting circuit breaker:', error);
    }
  }

  /**
   * Get account value
   * @param {string} userId - User ID
   * @returns {Promise<number>} - Account value
   */
  async getAccountValue(userId) {
    try {
      const cacheKey = `account_value:${userId}`;
      const cached = await cache.get(cacheKey);
      
      if (cached) {
        return cached.value;
      }

      const kiteAccount = await KiteAccount.findOne({
        where: { userId, status: 'ACTIVE' },
      });

      if (!kiteAccount || !kiteAccount.accessToken) {
        return 100000; // Default fallback
      }

      const accessToken = encryption.decrypt(kiteAccount.accessToken);
      const kiteClient = new KiteClient(accessToken);
      
      const margins = await kiteClient.getMargins();
      const equity = margins.equity;
      const accountValue = equity?.net || 100000;

      // Cache for 5 minutes
      await cache.set(cacheKey, { value: accountValue }, 300);

      return accountValue;

    } catch (error) {
      logger.error('Error getting account value:', error);
      return 100000; // Default fallback
    }
  }

  /**
   * Reject trade intent
   * @param {Object} tradeIntent - Trade intent
   * @param {string} reason - Rejection reason
   */
  async rejectTradeIntent(tradeIntent, reason) {
    await tradeIntent.update({
      status: 'REJECTED',
      rejectionReason: reason,
      riskCheckResult: {
        passed: false,
        reason,
        checkedAt: new Date(),
      },
    });

    logger.info(`Trade intent ${tradeIntent.id} rejected: ${reason}`);
  }

  /**
   * Log risk violation
   * @param {string} userId - User ID
   * @param {Object} violation - Violation details
   */
  async logRiskViolation(userId, violation) {
    await auditQueue.add('risk_violation', {
      event: 'RISK_VIOLATION',
      userId,
      source: 'RISK',
      payload: violation,
      result: violation.critical ? 'KILL_SWITCH_TRIGGERED' : 'BLOCKED',
    });

    auditLogger.logRiskViolation(userId, violation, violation.critical ? 'KILL_SWITCH' : 'BLOCKED');
  }
}

module.exports = RiskService;