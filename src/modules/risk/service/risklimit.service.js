const { RiskLimit, User, AuditLog } = require('../../../infrastructure/database/models');
const { auditQueue } = require('../../../infrastructure/queue');
const logger = require('../../../infrastructure/logger');
const {
  NotFoundError,
  ConflictError,
  BadRequestError,
  ForbiddenError,
} = require('../../../shared/errors');
const { SYSTEM, RISK } = require('../../../shared/constants');
const { Op } = require('sequelize');

class RiskLimitService {
  /**
   * Create risk limit
   * @param {string} userId - User ID
   * @param {Object} data - Risk limit data
   * @param {string} ip - IP address
   * @returns {Promise<Object>} - Created risk limit
   */
  async createRiskLimit(userId, data, ip = null) {
    try {
      logger.info(`Creating risk limit for user: ${userId}`, { 
        limitType: data.limitType 
      });

      // Check if limit of same type already exists and is active
      const existingLimit = await RiskLimit.findOne({
        where: {
          userId,
          limitType: data.limitType,
          status: 'ACTIVE',
        },
      });

      if (existingLimit) {
        throw new ConflictError(
          `Active ${data.limitType} limit already exists. Please update the existing limit or deactivate it first.`
        );
      }

      // Validate limit values based on type
      this.validateLimitValue(data.limitType, data.value, data.unit);

      // Create risk limit
      const riskLimit = await RiskLimit.create({
        userId,
        limitType: data.limitType,
        value: data.value,
        unit: data.unit,
        status: data.status || 'ACTIVE',
      });

      logger.info(`Risk limit created: ${riskLimit.id}`, { 
        userId, 
        limitType: riskLimit.limitType 
      });

      // Audit log
      await auditQueue.add('risk_limit_created', {
        event: SYSTEM.AUDIT_EVENT.CONFIG_CHANGED,
        userId,
        source: 'RISK',
        ip,
        payload: {
          riskLimitId: riskLimit.id,
          action: 'RISK_LIMIT_CREATED',
          limitType: riskLimit.limitType,
          value: riskLimit.value,
          unit: riskLimit.unit,
        },
        result: 'SUCCESS',
      });

      return {
        success: true,
        message: 'Risk limit created successfully',
        riskLimit,
      };

    } catch (error) {
      logger.error('Error creating risk limit:', error);
      throw error;
    }
  }

  /**
   * Get user's risk limits with filters
   * @param {string} userId - User ID
   * @param {Object} filters - Query filters
   * @param {Object} options - Pagination options
   * @returns {Promise<Object>} - Risk limits with pagination
   */
  async getRiskLimits(userId, filters = {}, options = {}) {
    try {
      const where = { userId };

      // Limit type filter
      if (filters.limitType) {
        where.limitType = filters.limitType;
      }

      // Status filter
      if (filters.status) {
        where.status = filters.status;
      }

      // Pagination
      const limit = options.limit || 20;
      const offset = options.offset || 0;

      // Query risk limits
      const { count, rows } = await RiskLimit.findAndCountAll({
        where,
        include: [
          {
            association: 'user',
            attributes: ['id', 'email', 'firstName', 'lastName'],
          },
        ],
        limit,
        offset,
        order: [['createdAt', 'DESC']],
      });

      // Calculate pagination metadata
      const totalPages = Math.ceil(count / limit);
      const currentPage = Math.floor(offset / limit) + 1;

      return {
        success: true,
        riskLimits: rows,
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
      logger.error('Error getting risk limits:', error);
      throw error;
    }
  }

  /**
   * Get risk limit by ID
   * @param {string} limitId - Risk limit ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} - Risk limit details
   */
  async getRiskLimitById(limitId, userId) {
    try {
      const riskLimit = await RiskLimit.findOne({
        where: {
          id: limitId,
          userId,
        },
        include: [
          {
            association: 'user',
            attributes: ['id', 'email', 'firstName', 'lastName'],
          },
        ],
      });

      if (!riskLimit) {
        throw new NotFoundError('Risk limit not found');
      }

      return {
        success: true,
        riskLimit,
      };

    } catch (error) {
      logger.error('Error getting risk limit by ID:', error);
      throw error;
    }
  }

  /**
   * Update risk limit
   * @param {string} limitId - Risk limit ID
   * @param {string} userId - User ID
   * @param {Object} data - Update data
   * @param {string} ip - IP address
   * @returns {Promise<Object>} - Updated risk limit
   */
  async updateRiskLimit(limitId, userId, data, ip = null) {
    try {
      const riskLimit = await RiskLimit.findOne({
        where: {
          id: limitId,
          userId,
        },
      });

      if (!riskLimit) {
        throw new NotFoundError('Risk limit not found');
      }

      // Validate new values if provided
      if (data.value !== undefined || data.unit !== undefined) {
        const newValue = data.value !== undefined ? data.value : riskLimit.value;
        const newUnit = data.unit !== undefined ? data.unit : riskLimit.unit;
        
        this.validateLimitValue(riskLimit.limitType, newValue, newUnit);
      }

      // Update risk limit
      const updateData = {};
      
      if (data.value !== undefined) updateData.value = data.value;
      if (data.unit !== undefined) updateData.unit = data.unit;
      if (data.status !== undefined) updateData.status = data.status;

      await riskLimit.update(updateData);

      logger.info(`Risk limit updated: ${limitId}`, { 
        userId, 
        updatedFields: Object.keys(updateData) 
      });

      // Audit log
      await auditQueue.add('risk_limit_updated', {
        event: SYSTEM.AUDIT_EVENT.CONFIG_CHANGED,
        userId,
        source: 'RISK',
        ip,
        payload: {
          riskLimitId: riskLimit.id,
          action: 'RISK_LIMIT_UPDATED',
          limitType: riskLimit.limitType,
          fields: Object.keys(updateData),
          newValue: riskLimit.value,
          newUnit: riskLimit.unit,
        },
        result: 'SUCCESS',
      });

      return {
        success: true,
        message: 'Risk limit updated successfully',
        riskLimit,
      };

    } catch (error) {
      logger.error('Error updating risk limit:', error);
      throw error;
    }
  }

  /**
   * Delete risk limit
   * @param {string} limitId - Risk limit ID
   * @param {string} userId - User ID
   * @param {string} ip - IP address
   * @returns {Promise<Object>}
   */
  async deleteRiskLimit(limitId, userId, ip = null) {
    try {
      const riskLimit = await RiskLimit.findOne({
        where: {
          id: limitId,
          userId,
        },
      });

      if (!riskLimit) {
        throw new NotFoundError('Risk limit not found');
      }

      const limitType = riskLimit.limitType;

      // Delete risk limit
      await riskLimit.destroy();

      logger.info(`Risk limit deleted: ${limitId}`, { userId, limitType });

      // Audit log
      await auditQueue.add('risk_limit_deleted', {
        event: SYSTEM.AUDIT_EVENT.CONFIG_CHANGED,
        userId,
        source: 'RISK',
        ip,
        payload: {
          riskLimitId: limitId,
          action: 'RISK_LIMIT_DELETED',
          limitType,
        },
        result: 'SUCCESS',
      });

      return {
        success: true,
        message: 'Risk limit deleted successfully',
      };

    } catch (error) {
      logger.error('Error deleting risk limit:', error);
      throw error;
    }
  }

  /**
   * Get risk violations history
   * @param {string} userId - User ID
   * @param {Object} filters - Query filters
   * @param {Object} options - Pagination options
   * @returns {Promise<Object>} - Risk violations
   */
  async getRiskViolations(userId, filters = {}, options = {}) {
    try {
      const where = {
        userId,
        event: SYSTEM.AUDIT_EVENT.RISK_VIOLATION,
      };

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
      const limit = options.limit || 20;
      const offset = options.offset || 0;

      // Query audit logs for violations
      const { count, rows } = await AuditLog.findAndCountAll({
        where,
        limit,
        offset,
        order: [['createdAt', 'DESC']],
      });

      // Filter by violation type if specified
      let filteredRows = rows;
      if (filters.violationType) {
        filteredRows = rows.filter(log => 
          log.payload?.check === filters.violationType ||
          log.payload?.violationType === filters.violationType
        );
      }

      // Calculate pagination metadata
      const totalPages = Math.ceil(count / limit);
      const currentPage = Math.floor(offset / limit) + 1;

      return {
        success: true,
        violations: filteredRows,
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
      logger.error('Error getting risk violations:', error);
      throw error;
    }
  }

  /**
   * Get risk summary for user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} - Risk summary
   */
  async getRiskSummary(userId) {
    try {
      // Get all active risk limits
      const riskLimits = await RiskLimit.findAll({
        where: {
          userId,
          status: 'ACTIVE',
        },
      });

      // Get recent violations (last 30 days)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      
      const recentViolations = await AuditLog.count({
        where: {
          userId,
          event: SYSTEM.AUDIT_EVENT.RISK_VIOLATION,
          createdAt: {
            [Op.gte]: thirtyDaysAgo,
          },
        },
      });

      // Organize limits by type
      const limitsByType = {};
      riskLimits.forEach(limit => {
        limitsByType[limit.limitType] = {
          value: limit.value,
          unit: limit.unit,
          status: limit.status,
        };
      });

      return {
        success: true,
        summary: {
          activeLimits: riskLimits.length,
          limitsByType,
          recentViolations,
        },
      };

    } catch (error) {
      logger.error('Error getting risk summary:', error);
      throw error;
    }
  }

  /**
   * Validate limit value based on type and unit
   * @param {string} limitType - Limit type
   * @param {number} value - Limit value
   * @param {string} unit - Unit type
   * @throws {BadRequestError} if validation fails
   */
  validateLimitValue(limitType, value, unit) {
    switch (limitType) {
      case RISK.LIMIT_TYPE.DAILY_LOSS:
        if (unit === 'PERCENTAGE' && (value <= 0 || value > 100)) {
          throw new BadRequestError('Daily loss percentage must be between 0 and 100');
        }
        if (unit === 'ABSOLUTE' && value <= 0) {
          throw new BadRequestError('Daily loss absolute value must be greater than 0');
        }
        break;

      case RISK.LIMIT_TYPE.POSITION_SIZE:
        if (unit === 'PERCENTAGE' && (value <= 0 || value > 100)) {
          throw new BadRequestError('Position size percentage must be between 0 and 100');
        }
        if (unit === 'ABSOLUTE' && value <= 0) {
          throw new BadRequestError('Position size absolute value must be greater than 0');
        }
        break;

      case RISK.LIMIT_TYPE.MAX_POSITIONS:
        if (unit !== 'COUNT') {
          throw new BadRequestError('Max positions must use COUNT unit');
        }
        if (value <= 0 || !Number.isInteger(value)) {
          throw new BadRequestError('Max positions must be a positive integer');
        }
        break;

      case RISK.LIMIT_TYPE.MAX_DRAWDOWN:
        if (unit === 'PERCENTAGE' && (value <= 0 || value > 100)) {
          throw new BadRequestError('Max drawdown percentage must be between 0 and 100');
        }
        if (unit === 'ABSOLUTE' && value <= 0) {
          throw new BadRequestError('Max drawdown absolute value must be greater than 0');
        }
        break;

      default:
        throw new BadRequestError('Invalid limit type');
    }
  }
}

module.exports = RiskLimitService;