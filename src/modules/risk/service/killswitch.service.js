const { SystemFlag, Order } = require('../../../infrastructure/database/models');
const { KiteClient } = require('../../../infrastructure/http');
const { cache } = require('../../../infrastructure/redis');
const logger = require('../../../infrastructure/logger');
const auditLogger = require('../../../infrastructure/logger/audit');
const { KillSwitchError } = require('../../../shared/errors');
const { SYSTEM } = require('../../../shared/constants');

class KillSwitchService {
  constructor() {
    this.CACHE_KEY = 'system:kill_switch';
    this.CACHE_TTL = 60; // 1 minute cache
  }

  /**
   * Check if kill switch is enabled
   * @returns {Promise<boolean>}
   */
  async isEnabled() {
    try {
      // Check cache first
      const cached = await cache.get(this.CACHE_KEY);
      if (cached !== null) {
        return cached.enabled;
      }

      // Check database
      const killSwitch = await SystemFlag.findOne({
        where: { flagType: SYSTEM.FLAG_TYPE.KILL_SWITCH },
      });

      const isEnabled = killSwitch ? killSwitch.enabled : false;

      // Cache result
      await cache.set(this.CACHE_KEY, { enabled: isEnabled }, this.CACHE_TTL);

      return isEnabled;
    } catch (error) {
      logger.error('Error checking kill switch status:', error);
      // Fail safe - assume enabled if error
      return true;
    }
  }

  /**
   * Enable kill switch
   * @param {string} userId - User triggering kill switch
   * @param {string} reason - Reason for enabling
   * @param {string} ip - IP address
   * @returns {Promise<Object>}
   */
  async enable(userId, reason, ip = null) {
    try {
      logger.warn(`Kill switch being enabled by user ${userId}`, { reason });

      // Update or create kill switch flag
      const [killSwitch] = await SystemFlag.findOrCreate({
        where: { flagType: SYSTEM.FLAG_TYPE.KILL_SWITCH },
        defaults: {
          enabled: true,
          reason,
          triggeredBy: userId,
          triggeredAt: new Date(),
          metadata: { autoTriggered: false },
        },
      });

      if (killSwitch.enabled) {
        logger.warn('Kill switch already enabled');
        return { success: true, message: 'Kill switch already enabled', killSwitch };
      }

      await killSwitch.update({
        enabled: true,
        reason,
        triggeredBy: userId,
        triggeredAt: new Date(),
        metadata: { autoTriggered: false },
      });

      // Clear cache
      await cache.del(this.CACHE_KEY);

      // Audit log
      auditLogger.logKillSwitch(userId, 'ENABLE', reason, ip);

      logger.warn('Kill switch enabled successfully');

      // Square off all open positions
      await this.squareOffAllPositions(userId);

      // Cancel all pending orders
      await this.cancelAllPendingOrders(userId);

      return {
        success: true,
        message: 'Kill switch enabled and all positions squared off',
        killSwitch,
      };
    } catch (error) {
      logger.error('Error enabling kill switch:', error);
      throw error;
    }
  }

  /**
   * Disable kill switch
   * @param {string} userId - User disabling kill switch
   * @param {string} ip - IP address
   * @returns {Promise<Object>}
   */
  async disable(userId, ip = null) {
    try {
      logger.info(`Kill switch being disabled by user ${userId}`);

      const killSwitch = await SystemFlag.findOne({
        where: { flagType: SYSTEM.FLAG_TYPE.KILL_SWITCH },
      });

      if (!killSwitch || !killSwitch.enabled) {
        return { success: true, message: 'Kill switch already disabled' };
      }

      await killSwitch.update({
        enabled: false,
        reason: null,
        triggeredBy: null,
        triggeredAt: null,
      });

      // Clear cache
      await cache.del(this.CACHE_KEY);

      // Audit log
      auditLogger.logKillSwitch(userId, 'DISABLE', 'Manual disable', ip);

      logger.info('Kill switch disabled successfully');

      return {
        success: true,
        message: 'Kill switch disabled',
        killSwitch,
      };
    } catch (error) {
      logger.error('Error disabling kill switch:', error);
      throw error;
    }
  }

  /**
   * Auto-trigger kill switch on risk violation
   * @param {string} userId - User ID
   * @param {string} reason - Violation reason
   * @returns {Promise<void>}
   */
  async autoTrigger(userId, reason) {
    try {
      logger.error(`Auto-triggering kill switch for user ${userId}`, { reason });

      const [killSwitch] = await SystemFlag.findOrCreate({
        where: { flagType: SYSTEM.FLAG_TYPE.KILL_SWITCH },
        defaults: {
          enabled: true,
          reason: `AUTO: ${reason}`,
          triggeredBy: userId,
          triggeredAt: new Date(),
          metadata: { autoTriggered: true },
        },
      });

      if (!killSwitch.enabled) {
        await killSwitch.update({
          enabled: true,
          reason: `AUTO: ${reason}`,
          triggeredBy: userId,
          triggeredAt: new Date(),
          metadata: { autoTriggered: true },
        });
      }

      // Clear cache
      await cache.del(this.CACHE_KEY);

      // Audit log
      auditLogger.logKillSwitch(userId, 'ENABLE', `AUTO: ${reason}`, null);

      // Square off positions
      await this.squareOffAllPositions(userId);

      // Cancel pending orders
      await this.cancelAllPendingOrders(userId);

      // TODO: Send alerts (email, SMS, push notification)

    } catch (error) {
      logger.error('Error auto-triggering kill switch:', error);
    }
  }

  /**
   * Square off all open positions
   * @param {string} userId - User ID
   * @returns {Promise<void>}
   */
  async squareOffAllPositions(userId) {
    try {
      logger.info(`Squaring off all positions for user ${userId}`);

      // Get user's Kite account
      const KiteAccount = require('../../../infrastructure/database/models').KiteAccount;
      const kiteAccount = await KiteAccount.findOne({
        where: { userId, status: 'ACTIVE' },
      });

      if (!kiteAccount || !kiteAccount.accessToken) {
        logger.warn(`No active Kite account found for user ${userId}`);
        return;
      }

      const { encryption } = require('../../../shared/utils');
      const accessToken = encryption.decrypt(kiteAccount.accessToken);
      const kiteClient = new KiteClient(accessToken);

      // Get all positions
      const positions = await kiteClient.getPositions();

      if (!positions || !positions.net || positions.net.length === 0) {
        logger.info('No open positions to square off');
        return;
      }

      // Square off each position
      const squareOffPromises = positions.net
        .filter(pos => pos.quantity !== 0)
        .map(async (position) => {
          try {
            await kiteClient.exitPosition(position);
            logger.info(`Squared off position: ${position.tradingsymbol}`);
            
            // Log to audit
            auditLogger.logSystemAction('POSITIONS_SQUARED_OFF', {
              userId,
              symbol: position.tradingsymbol,
              quantity: position.quantity,
            });
          } catch (error) {
            logger.error(`Failed to square off ${position.tradingsymbol}:`, error);
          }
        });

      await Promise.all(squareOffPromises);

      logger.info('All positions squared off successfully');
    } catch (error) {
      logger.error('Error squaring off positions:', error);
    }
  }

  /**
   * Cancel all pending orders
   * @param {string} userId - User ID
   * @returns {Promise<void>}
   */
  async cancelAllPendingOrders(userId) {
    try {
      logger.info(`Cancelling all pending orders for user ${userId}`);

      // Get pending orders from database
      const pendingOrders = await Order.findAll({
        where: {
          userId,
          status: ['PENDING', 'SUBMITTED', 'OPEN'],
        },
      });

      if (pendingOrders.length === 0) {
        logger.info('No pending orders to cancel');
        return;
      }

      // Get Kite account
      const KiteAccount = require('../../../infrastructure/database/models').KiteAccount;
      const kiteAccount = await KiteAccount.findOne({
        where: { userId, status: 'ACTIVE' },
      });

      if (!kiteAccount || !kiteAccount.accessToken) {
        logger.warn(`No active Kite account found for user ${userId}`);
        return;
      }

      const { encryption } = require('../../../shared/utils');
      const accessToken = encryption.decrypt(kiteAccount.accessToken);
      const kiteClient = new KiteClient(accessToken);

      // Cancel each order
      const cancelPromises = pendingOrders.map(async (order) => {
        try {
          if (order.kiteOrderId) {
            await kiteClient.cancelOrder(order.kiteOrderId);
            await order.update({ status: 'CANCELLED' });
            logger.info(`Cancelled order: ${order.kiteOrderId}`);
            
            // Log to audit
            auditLogger.logOrderPlaced(userId, {
              orderId: order.id,
              kiteOrderId: order.kiteOrderId,
              action: 'CANCELLED',
            }, 'KILL_SWITCH');
          }
        } catch (error) {
          logger.error(`Failed to cancel order ${order.kiteOrderId}:`, error);
        }
      });

      await Promise.all(cancelPromises);

      logger.info('All pending orders cancelled successfully');
    } catch (error) {
      logger.error('Error cancelling orders:', error);
    }
  }

  /**
   * Enforce kill switch check
   * @throws {KillSwitchError} if kill switch is enabled
   */
  async enforce() {
    const isEnabled = await this.isEnabled();
    
    if (isEnabled) {
      throw new KillSwitchError('Kill switch is enabled. All trading operations are blocked.');
    }
  }
}

module.exports = KillSwitchService;