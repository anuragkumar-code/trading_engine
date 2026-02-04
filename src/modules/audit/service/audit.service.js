const { AuditLog, User } = require('../../../infrastructure/database/models');
const { hash } = require('../../../shared/utils');
const logger = require('../../../infrastructure/logger');
const { NotFoundError, BadRequestError } = require('../../../shared/errors');
const { SYSTEM } = require('../../../shared/constants');
const { Op } = require('sequelize');
const { sequelize } = require('../../../infrastructure/database/models');

class AuditService {
  /**
   * Create audit log entry
   * @param {Object} data - Audit log data
   * @returns {Promise<Object>} - Created audit log
   */
  async createAuditLog(data) {
    try {
      const {
        event,
        userId,
        source,
        ip,
        payload,
        result,
        metadata,
      } = data;

      // Generate payload hash for integrity
      const payloadHash = payload ? hash.hash(payload) : null;

      // Create audit log
      const auditLog = await AuditLog.create({
        event,
        userId: userId || null,
        source,
        ip: ip || null,
        payload: payload || {},
        payloadHash,
        result: result || 'SUCCESS',
        metadata: metadata || {},
      });

      logger.debug(`Audit log created: ${auditLog.id}`, { event, userId, source });

      return auditLog;

    } catch (error) {
      logger.error('Error creating audit log:', error);
      // Don't throw - audit logging should never break the main flow
      return null;
    }
  }

  /**
   * Get audit logs with filters and pagination
   * @param {Object} filters - Query filters
   * @param {Object} options - Pagination and sorting options
   * @param {string} requestUserId - ID of user making the request
   * @param {string} requestUserRole - Role of user making the request
   * @returns {Promise<Object>} - Audit logs with pagination
   */
  async getAuditLogs(filters = {}, options = {}, requestUserId, requestUserRole) {
    try {
      // Build where clause
      const where = {};

      // Non-admin users can only see their own logs
      if (requestUserRole !== SYSTEM.USER_ROLE.ADMIN) {
        where.userId = requestUserId;
      } else if (filters.userId) {
        // Admin can filter by specific user
        where.userId = filters.userId;
      }

      // Event filter
      if (filters.event) {
        where.event = filters.event;
      }

      // Source filter
      if (filters.source) {
        where.source = filters.source;
      }

      // Result filter
      if (filters.result) {
        where.result = filters.result;
      }

      // Date range filter
      if (filters.startDate || filters.endDate) {
        where.createdAt = {};
        
        if (filters.startDate) {
          where.createdAt[Op.gte] = new Date(filters.startDate);
        }
        
        if (filters.endDate) {
          where.createdAt[Op.lte] = new Date(filters.endDate);
        }
      }

      // Pagination
      const limit = options.limit || 100;
      const offset = options.offset || 0;

      // Sorting
      const sortBy = options.sortBy || 'createdAt';
      const sortOrder = options.sortOrder || 'DESC';

      // Query audit logs
      const { count, rows } = await AuditLog.findAndCountAll({
        where,
        include: [
          {
            association: 'user',
            attributes: ['id', 'email', 'firstName', 'lastName'],
            required: false,
          },
        ],
        limit,
        offset,
        order: [[sortBy, sortOrder]],
      });

      // Calculate pagination metadata
      const totalPages = Math.ceil(count / limit);
      const currentPage = Math.floor(offset / limit) + 1;

      return {
        success: true,
        auditLogs: rows,
        pagination: {
          total: count,
          limit,
          offset,
          currentPage,
          totalPages,
          hasNext: currentPage < totalPages,
          hasPrev: currentPage > 1,
        },
      };

    } catch (error) {
      logger.error('Error getting audit logs:', error);
      throw error;
    }
  }

  /**
   * Get audit log by ID
   * @param {string} id - Audit log ID
   * @param {string} requestUserId - ID of user making the request
   * @param {string} requestUserRole - Role of user making the request
   * @returns {Promise<Object>} - Audit log
   */
  async getAuditLogById(id, requestUserId, requestUserRole) {
    try {
      const where = { id };

      // Non-admin users can only see their own logs
      if (requestUserRole !== SYSTEM.USER_ROLE.ADMIN) {
        where.userId = requestUserId;
      }

      const auditLog = await AuditLog.findOne({
        where,
        include: [
          {
            association: 'user',
            attributes: ['id', 'email', 'firstName', 'lastName'],
            required: false,
          },
        ],
      });

      if (!auditLog) {
        throw new NotFoundError('Audit log not found');
      }

      // Verify payload integrity
      const isIntegrityValid = this.verifyPayloadIntegrity(auditLog);

      return {
        success: true,
        auditLog: {
          ...auditLog.toJSON(),
          integrityCheck: {
            valid: isIntegrityValid,
            message: isIntegrityValid 
              ? 'Payload integrity verified' 
              : 'Payload integrity check failed - data may have been tampered',
          },
        },
      };

    } catch (error) {
      logger.error('Error getting audit log by ID:', error);
      throw error;
    }
  }

  /**
   * Get audit statistics
   * @param {Object} filters - Query filters
   * @param {string} requestUserId - ID of user making the request
   * @param {string} requestUserRole - Role of user making the request
   * @returns {Promise<Object>} - Audit statistics
   */
  async getAuditStats(filters = {}, requestUserId, requestUserRole) {
    try {
      const where = {};

      // Non-admin users can only see their own stats
      if (requestUserRole !== SYSTEM.USER_ROLE.ADMIN) {
        where.userId = requestUserId;
      }

      // Date range filter
      if (filters.startDate || filters.endDate) {
        where.createdAt = {};
        
        if (filters.startDate) {
          where.createdAt[Op.gte] = new Date(filters.startDate);
        }
        
        if (filters.endDate) {
          where.createdAt[Op.lte] = new Date(filters.endDate);
        }
      }

      const groupBy = filters.groupBy || 'event';

      let groupByField;
      let selectField;

      switch (groupBy) {
        case 'event':
          groupByField = 'event';
          selectField = 'event';
          break;
        case 'source':
          groupByField = 'source';
          selectField = 'source';
          break;
        case 'result':
          groupByField = 'result';
          selectField = 'result';
          break;
        case 'user':
          groupByField = 'userId';
          selectField = 'userId';
          break;
        case 'day':
          groupByField = sequelize.fn('DATE', sequelize.col('created_at'));
          selectField = [sequelize.fn('DATE', sequelize.col('created_at')), 'day'];
          break;
        default:
          groupByField = 'event';
          selectField = 'event';
      }

      // Get grouped statistics
      const stats = await AuditLog.findAll({
        where,
        attributes: [
          selectField,
          [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        ],
        group: groupByField,
        raw: true,
      });

      // Get total count
      const totalCount = await AuditLog.count({ where });

      // Get counts by result
      const resultStats = await AuditLog.findAll({
        where,
        attributes: [
          'result',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        ],
        group: 'result',
        raw: true,
      });

      // Get recent activity (last 24 hours)
      const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentCount = await AuditLog.count({
        where: {
          ...where,
          createdAt: {
            [Op.gte]: last24Hours,
          },
        },
      });

      return {
        success: true,
        statistics: {
          total: totalCount,
          recent24Hours: recentCount,
          groupedBy: groupBy,
          breakdown: stats,
          byResult: resultStats,
        },
      };

    } catch (error) {
      logger.error('Error getting audit stats:', error);
      throw error;
    }
  }

  /**
   * Export audit logs
   * @param {Object} filters - Query filters
   * @param {string} format - Export format (json or csv)
   * @param {string} requestUserId - ID of user making the request
   * @param {string} requestUserRole - Role of user making the request
   * @returns {Promise<Object>} - Export data
   */
  async exportAuditLogs(filters, format, requestUserId, requestUserRole) {
    try {
      const where = {};

      // Non-admin users can only export their own logs
      if (requestUserRole !== SYSTEM.USER_ROLE.ADMIN) {
        where.userId = requestUserId;
      } else if (filters.userId) {
        where.userId = filters.userId;
      }

      // Event filter
      if (filters.event) {
        where.event = filters.event;
      }

      // Source filter
      if (filters.source) {
        where.source = filters.source;
      }

      // Result filter
      if (filters.result) {
        where.result = filters.result;
      }

      // Date range is required for export
      if (!filters.startDate || !filters.endDate) {
        throw new BadRequestError('Start date and end date are required for export');
      }

      where.createdAt = {
        [Op.gte]: new Date(filters.startDate),
        [Op.lte]: new Date(filters.endDate),
      };

      // Limit export to prevent memory issues
      const MAX_EXPORT_RECORDS = 10000;

      const auditLogs = await AuditLog.findAll({
        where,
        include: [
          {
            association: 'user',
            attributes: ['id', 'email', 'firstName', 'lastName'],
            required: false,
          },
        ],
        limit: MAX_EXPORT_RECORDS,
        order: [['createdAt', 'DESC']],
      });

      if (auditLogs.length === 0) {
        throw new NotFoundError('No audit logs found for the specified criteria');
      }

      if (format === 'csv') {
        return this.exportToCsv(auditLogs);
      } else {
        return this.exportToJson(auditLogs);
      }

    } catch (error) {
      logger.error('Error exporting audit logs:', error);
      throw error;
    }
  }

  /**
   * Export audit logs to JSON
   * @param {Array} auditLogs - Audit logs
   * @returns {Object} - JSON export data
   */
  exportToJson(auditLogs) {
    const data = auditLogs.map(log => ({
      id: log.id,
      event: log.event,
      userId: log.userId,
      userEmail: log.user?.email,
      source: log.source,
      ip: log.ip,
      result: log.result,
      payload: log.payload,
      metadata: log.metadata,
      timestamp: log.createdAt,
    }));

    return {
      success: true,
      format: 'json',
      count: data.length,
      data,
      exportedAt: new Date().toISOString(),
    };
  }

  /**
   * Export audit logs to CSV
   * @param {Array} auditLogs - Audit logs
   * @returns {Object} - CSV export data
   */
  exportToCsv(auditLogs) {
    // CSV headers
    const headers = [
      'ID',
      'Timestamp',
      'Event',
      'User ID',
      'User Email',
      'Source',
      'IP Address',
      'Result',
      'Payload',
      'Metadata',
    ];

    // CSV rows
    const rows = auditLogs.map(log => [
      log.id,
      log.createdAt.toISOString(),
      log.event,
      log.userId || '',
      log.user?.email || '',
      log.source,
      log.ip || '',
      log.result,
      JSON.stringify(log.payload),
      JSON.stringify(log.metadata),
    ]);

    // Build CSV string
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    return {
      success: true,
      format: 'csv',
      count: rows.length,
      data: csvContent,
      exportedAt: new Date().toISOString(),
    };
  }

  /**
   * Verify payload integrity
   * @param {Object} auditLog - Audit log object
   * @returns {boolean} - True if integrity is valid
   */
  verifyPayloadIntegrity(auditLog) {
    try {
      if (!auditLog.payload || !auditLog.payloadHash) {
        return true; // No payload to verify
      }

      const currentHash = hash.hash(auditLog.payload);
      return currentHash === auditLog.payloadHash;

    } catch (error) {
      logger.error('Error verifying payload integrity:', error);
      return false;
    }
  }

  /**
   * Get user activity summary
   * @param {string} userId - User ID
   * @param {number} days - Number of days to look back
   * @returns {Promise<Object>} - User activity summary
   */
  async getUserActivitySummary(userId, days = 30) {
    try {
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const where = {
        userId,
        createdAt: {
          [Op.gte]: startDate,
        },
      };

      // Total activity count
      const totalCount = await AuditLog.count({ where });

      // Activity by event
      const eventStats = await AuditLog.findAll({
        where,
        attributes: [
          'event',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        ],
        group: 'event',
        raw: true,
      });

      // Activity by result
      const resultStats = await AuditLog.findAll({
        where,
        attributes: [
          'result',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        ],
        group: 'result',
        raw: true,
      });

      // Daily activity
      const dailyActivity = await AuditLog.findAll({
        where,
        attributes: [
          [sequelize.fn('DATE', sequelize.col('created_at')), 'day'],
          [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        ],
        group: [sequelize.fn('DATE', sequelize.col('created_at'))],
        order: [[sequelize.fn('DATE', sequelize.col('created_at')), 'ASC']],
        raw: true,
      });

      // Last activity
      const lastActivity = await AuditLog.findOne({
        where: { userId },
        order: [['createdAt', 'DESC']],
      });

      return {
        success: true,
        userId,
        period: `${days} days`,
        summary: {
          totalActivities: totalCount,
          byEvent: eventStats,
          byResult: resultStats,
          dailyActivity,
          lastActivity: lastActivity ? {
            event: lastActivity.event,
            timestamp: lastActivity.createdAt,
            result: lastActivity.result,
          } : null,
        },
      };

    } catch (error) {
      logger.error('Error getting user activity summary:', error);
      throw error;
    }
  }

  /**
   * Clean old audit logs (for maintenance)
   * @param {number} retentionDays - Number of days to retain
   * @returns {Promise<Object>} - Cleanup result
   */
  async cleanOldAuditLogs(retentionDays = 90) {
    try {
      const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

      const deletedCount = await AuditLog.destroy({
        where: {
          createdAt: {
            [Op.lt]: cutoffDate,
          },
        },
      });

      logger.info(`Cleaned ${deletedCount} audit logs older than ${retentionDays} days`);

      return {
        success: true,
        deletedCount,
        cutoffDate,
        message: `Deleted ${deletedCount} audit logs older than ${retentionDays} days`,
      };

    } catch (error) {
      logger.error('Error cleaning old audit logs:', error);
      throw error;
    }
  }
}

module.exports = AuditService;