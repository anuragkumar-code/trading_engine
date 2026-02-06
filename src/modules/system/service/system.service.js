const { SystemFlag, User, Order, TradeIntent, AuditLog } = require('../../../infrastructure/database/models');
const { sequelize } = require('../../../infrastructure/database/models');
const { auditQueue } = require('../../../infrastructure/queue');
const logger = require('../../../infrastructure/logger');
const { cache } = require('../../../infrastructure/redis');
const {
  NotFoundError,
  ConflictError,
  BadRequestError,
} = require('../../../shared/errors');
const { SYSTEM } = require('../../../shared/constants');
const { Op } = require('sequelize');
const os = require('os');

class SystemService {
  constructor() {
    this.maintenanceCacheKey = 'system:maintenance_mode';
    this.healthCacheKey = 'system:health';
  }

  /**
   * Get system health status
   * @param {boolean} detailed - Whether to include detailed metrics
   * @returns {Promise<Object>} - Health status
   */
  async getHealthStatus(detailed = false) {
    try {
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
      };

      if (detailed) {
        // Database health
        try {
          await sequelize.authenticate();
          health.database = {
            status: 'connected',
            type: sequelize.options.dialect,
          };
        } catch (error) {
          health.database = {
            status: 'disconnected',
            error: error.message,
          };
          health.status = 'unhealthy';
        }

        // Redis health
        try {
          const redisClient = require('../../../infrastructure/redis/client');
          const pong = await redisClient.ping();
          health.redis = {
            status: pong === 'PONG' ? 'connected' : 'disconnected',
          };
        } catch (error) {
          health.redis = {
            status: 'disconnected',
            error: error.message,
          };
          health.status = 'degraded';
        }

        // System resources
        health.system = {
          platform: os.platform(),
          memory: {
            total: Math.round(os.totalmem() / 1024 / 1024), // MB
            free: Math.round(os.freemem() / 1024 / 1024), // MB
            used: Math.round((os.totalmem() - os.freemem()) / 1024 / 1024), // MB
            usagePercent: Math.round(((os.totalmem() - os.freemem()) / os.totalmem()) * 100),
          },
          cpu: {
            cores: os.cpus().length,
            model: os.cpus()[0]?.model,
          },
          loadAverage: os.loadavg(),
        };

        // Process info
        health.process = {
          pid: process.pid,
          nodeVersion: process.version,
          memoryUsage: {
            rss: Math.round(process.memoryUsage().rss / 1024 / 1024), // MB
            heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024), // MB
            heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024), // MB
            external: Math.round(process.memoryUsage().external / 1024 / 1024), // MB
          },
        };
      }

      return {
        success: true,
        health,
      };

    } catch (error) {
      logger.error('Error getting health status:', error);
      return {
        success: false,
        health: {
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          error: error.message,
        },
      };
    }
  }

  /**
   * Create system flag
   * @param {Object} data - Flag data
   * @param {string} userId - User ID
   * @param {string} ip - IP address
   * @returns {Promise<Object>} - Created flag
   */
  async createSystemFlag(data, userId, ip = null) {
    try {
      logger.info('Creating system flag', { flagType: data.flagType });

      // Check if flag of same type already exists
      const existingFlag = await SystemFlag.findOne({
        where: { flagType: data.flagType },
      });

      if (existingFlag) {
        throw new ConflictError(`System flag of type ${data.flagType} already exists`);
      }

      const systemFlag = await SystemFlag.create({
        flagType: data.flagType,
        enabled: data.enabled || false,
        reason: data.reason || null,
        triggeredBy: data.enabled ? userId : null,
        triggeredAt: data.enabled ? new Date() : null,
        metadata: data.metadata || {},
      });

      logger.info(`System flag created: ${systemFlag.id}`, { flagType: systemFlag.flagType });

      // Audit log
      await auditQueue.add('system_flag_created', {
        event: SYSTEM.AUDIT_EVENT.CONFIG_CHANGED,
        userId,
        source: 'SYSTEM',
        ip,
        payload: {
          systemFlagId: systemFlag.id,
          action: 'SYSTEM_FLAG_CREATED',
          flagType: systemFlag.flagType,
        },
        result: 'SUCCESS',
      });

      return {
        success: true,
        message: 'System flag created successfully',
        systemFlag,
      };

    } catch (error) {
      logger.error('Error creating system flag:', error);
      throw error;
    }
  }

  /**
   * Get all system flags
   * @param {Object} filters - Query filters
   * @returns {Promise<Object>} - System flags
   */
  async getSystemFlags(filters = {}) {
    try {
      const where = {};

      // Flag type filter
      if (filters.flagType) {
        where.flagType = filters.flagType;
      }

      // Enabled filter
      if (filters.enabled !== undefined) {
        where.enabled = filters.enabled;
      }

      const systemFlags = await SystemFlag.findAll({
        where,
        include: [
          {
            association: 'triggeredByUser',
            attributes: ['id', 'email', 'firstName', 'lastName'],
            required: false,
          },
        ],
        order: [['createdAt', 'DESC']],
      });

      return {
        success: true,
        systemFlags,
      };

    } catch (error) {
      logger.error('Error getting system flags:', error);
      throw error;
    }
  }

  /**
   * Get system flag by ID
   * @param {string} flagId - System flag ID
   * @returns {Promise<Object>} - System flag
   */
  async getSystemFlagById(flagId) {
    try {
      const systemFlag = await SystemFlag.findByPk(flagId, {
        include: [
          {
            association: 'triggeredByUser',
            attributes: ['id', 'email', 'firstName', 'lastName'],
            required: false,
          },
        ],
      });

      if (!systemFlag) {
        throw new NotFoundError('System flag not found');
      }

      return {
        success: true,
        systemFlag,
      };

    } catch (error) {
      logger.error('Error getting system flag by ID:', error);
      throw error;
    }
  }

  /**
   * Update system flag
   * @param {string} flagId - System flag ID
   * @param {Object} data - Update data
   * @param {string} userId - User ID
   * @param {string} ip - IP address
   * @returns {Promise<Object>} - Updated system flag
   */
  async updateSystemFlag(flagId, data, userId, ip = null) {
    try {
      const systemFlag = await SystemFlag.findByPk(flagId);

      if (!systemFlag) {
        throw new NotFoundError('System flag not found');
      }

      const updateData = {
        enabled: data.enabled,
        reason: data.reason || null,
        triggeredBy: data.enabled ? userId : null,
        triggeredAt: data.enabled ? new Date() : null,
        metadata: data.metadata || systemFlag.metadata || {},
      };

      await systemFlag.update(updateData);

      logger.info(`System flag updated: ${flagId}`, { 
        flagType: systemFlag.flagType,
        enabled: data.enabled 
      });

      // Audit log
      await auditQueue.add('system_flag_updated', {
        event: SYSTEM.AUDIT_EVENT.CONFIG_CHANGED,
        userId,
        source: 'SYSTEM',
        ip,
        payload: {
          systemFlagId: flagId,
          action: 'SYSTEM_FLAG_UPDATED',
          flagType: systemFlag.flagType,
          enabled: data.enabled,
          reason: data.reason,
        },
        result: 'SUCCESS',
      });

      return {
        success: true,
        message: `System flag ${data.enabled ? 'enabled' : 'disabled'} successfully`,
        systemFlag,
      };

    } catch (error) {
      logger.error('Error updating system flag:', error);
      throw error;
    }
  }

  /**
   * Delete system flag
   * @param {string} flagId - System flag ID
   * @param {string} userId - User ID
   * @param {string} ip - IP address
   * @returns {Promise<Object>}
   */
  async deleteSystemFlag(flagId, userId, ip = null) {
    try {
      const systemFlag = await SystemFlag.findByPk(flagId);

      if (!systemFlag) {
        throw new NotFoundError('System flag not found');
      }

      const flagType = systemFlag.flagType;

      await systemFlag.destroy();

      logger.info(`System flag deleted: ${flagId}`, { flagType });

      // Audit log
      await auditQueue.add('system_flag_deleted', {
        event: SYSTEM.AUDIT_EVENT.CONFIG_CHANGED,
        userId,
        source: 'SYSTEM',
        ip,
        payload: {
          systemFlagId: flagId,
          action: 'SYSTEM_FLAG_DELETED',
          flagType,
        },
        result: 'SUCCESS',
      });

      return {
        success: true,
        message: 'System flag deleted successfully',
      };

    } catch (error) {
      logger.error('Error deleting system flag:', error);
      throw error;
    }
  }

  /**
   * Toggle maintenance mode
   * @param {boolean} enabled - Enable/disable maintenance
   * @param {string} reason - Reason for maintenance
   * @param {number} estimatedDuration - Duration in minutes
   * @param {string} userId - User ID
   * @param {string} ip - IP address
   * @returns {Promise<Object>}
   */
  async toggleMaintenanceMode(enabled, reason, estimatedDuration, userId, ip = null) {
    try {
      logger.info(`Toggling maintenance mode: ${enabled ? 'ON' : 'OFF'}`, { userId, reason });

      // Find or create maintenance flag
      const [maintenanceFlag] = await SystemFlag.findOrCreate({
        where: { flagType: SYSTEM.FLAG_TYPE.MAINTENANCE },
        defaults: {
          enabled: false,
          reason: null,
          triggeredBy: null,
          triggeredAt: null,
          metadata: {},
        },
      });

      const metadata = enabled ? {
        estimatedDuration: estimatedDuration || null,
        scheduledEnd: estimatedDuration 
          ? new Date(Date.now() + estimatedDuration * 60 * 1000)
          : null,
      } : {};

      await maintenanceFlag.update({
        enabled,
        reason: enabled ? reason : null,
        triggeredBy: enabled ? userId : null,
        triggeredAt: enabled ? new Date() : null,
        metadata,
      });

      // Update cache
      await cache.set(
        this.maintenanceCacheKey,
        { enabled, reason, metadata },
        3600 // 1 hour TTL
      );

      // Audit log
      await auditQueue.add('maintenance_mode_toggled', {
        event: SYSTEM.AUDIT_EVENT.CONFIG_CHANGED,
        userId,
        source: 'SYSTEM',
        ip,
        payload: {
          action: enabled ? 'MAINTENANCE_MODE_ENABLED' : 'MAINTENANCE_MODE_DISABLED',
          reason,
          estimatedDuration,
        },
        result: 'SUCCESS',
      });

      return {
        success: true,
        message: `Maintenance mode ${enabled ? 'enabled' : 'disabled'}`,
        maintenanceMode: {
          enabled,
          reason: enabled ? reason : null,
          estimatedDuration: enabled ? estimatedDuration : null,
          scheduledEnd: enabled ? metadata.scheduledEnd : null,
        },
      };

    } catch (error) {
      logger.error('Error toggling maintenance mode:', error);
      throw error;
    }
  }

  /**
   * Check if maintenance mode is enabled
   * @returns {Promise<boolean>}
   */
  async isMaintenanceModeEnabled() {
    try {
      // Check cache first
      const cached = await cache.get(this.maintenanceCacheKey);
      if (cached !== null) {
        return cached.enabled;
      }

      // Check database
      const maintenanceFlag = await SystemFlag.findOne({
        where: { flagType: SYSTEM.FLAG_TYPE.MAINTENANCE },
      });

      const isEnabled = maintenanceFlag ? maintenanceFlag.enabled : false;

      // Cache result
      await cache.set(this.maintenanceCacheKey, { enabled: isEnabled }, 3600);

      return isEnabled;

    } catch (error) {
      logger.error('Error checking maintenance mode:', error);
      return false;
    }
  }

  /**
   * Get system metrics
   * @param {string} period - Time period (1h, 6h, 12h, 24h, 7d, 30d)
   * @returns {Promise<Object>} - System metrics
   */
  async getSystemMetrics(period = '24h') {
    try {
      const periodMap = {
        '1h': 1,
        '6h': 6,
        '12h': 12,
        '24h': 24,
        '7d': 24 * 7,
        '30d': 24 * 30,
      };

      const hours = periodMap[period] || 24;
      const startDate = new Date(Date.now() - hours * 60 * 60 * 1000);

      const where = {
        createdAt: {
          [Op.gte]: startDate,
        },
      };

      // User metrics
      const totalUsers = await User.count();
      const newUsers = await User.count({ where });
      const activeUsers = await User.count({
        where: {
          status: SYSTEM.ACCOUNT_STATUS.ACTIVE,
        },
      });

      // Order metrics
      const totalOrders = await Order.count({ where });
      const ordersByStatus = await Order.findAll({
        where,
        attributes: [
          'status',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        ],
        group: 'status',
        raw: true,
      });

      // Trade intent metrics
      const totalIntents = await TradeIntent.count({ where });
      const intentsByStatus = await TradeIntent.findAll({
        where,
        attributes: [
          'status',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        ],
        group: 'status',
        raw: true,
      });

      // Violation metrics
      const violations = await AuditLog.count({
        where: {
          ...where,
          event: SYSTEM.AUDIT_EVENT.RISK_VIOLATION,
        },
      });

      return {
        success: true,
        period,
        metrics: {
          users: {
            total: totalUsers,
            active: activeUsers,
            new: newUsers,
          },
          orders: {
            total: totalOrders,
            byStatus: ordersByStatus,
          },
          tradeIntents: {
            total: totalIntents,
            byStatus: intentsByStatus,
          },
          violations,
        },
      };

    } catch (error) {
      logger.error('Error getting system metrics:', error);
      throw error;
    }
  }

  /**
   * Get system information
   * @returns {Promise<Object>} - System info
   */
  async getSystemInfo() {
    try {
      const packageJson = require('../../../../package.json');

      return {
        success: true,
        info: {
          name: packageJson.name || 'Trading Engine',
          version: packageJson.version || '1.0.0',
          description: packageJson.description || 'Automated Trading Execution Engine',
          nodeVersion: process.version,
          platform: os.platform(),
          architecture: os.arch(),
          hostname: os.hostname(),
          uptime: Math.floor(process.uptime()),
          startTime: new Date(Date.now() - process.uptime() * 1000).toISOString(),
        },
      };

    } catch (error) {
      logger.error('Error getting system info:', error);
      throw error;
    }
  }

  /**
   * Get system configuration (non-sensitive)
   * @returns {Promise<Object>} - System config
   */
  async getSystemConfig() {
    try {
      const config = require('../../../shared/config');

      return {
        success: true,
        configuration: {
          environment: config.app.env,
          appName: config.app.appName,
          features: {
            rateLimit: {
              enabled: true,
              windowMs: config.app.rateLimit.windowMs,
              maxRequests: config.app.rateLimit.maxRequests,
            },
            risk: {
              maxDailyLossPercentage: config.app.risk.maxDailyLossPercentage,
              maxPositionSizePercentage: config.app.risk.maxPositionSizePercentage,
              maxOpenPositions: config.app.risk.maxOpenPositions,
              circuitBreakerThreshold: config.app.risk.circuitBreakerThreshold,
            },
            queue: {
              concurrency: config.app.queue.concurrency,
              maxAttempts: config.app.queue.maxAttempts,
            },
          },
        },
      };

    } catch (error) {
      logger.error('Error getting system config:', error);
      throw error;
    }
  }
}

module.exports = SystemService;