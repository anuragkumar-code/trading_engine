const { Strategy, User } = require('../../../infrastructure/database/models');
const { auditQueue } = require('../../../infrastructure/queue');
const logger = require('../../../infrastructure/logger');
const {
  NotFoundError,
  ConflictError,
  BadRequestError,
  ForbiddenError,
} = require('../../../shared/errors');
const { SYSTEM } = require('../../../shared/constants');
const { Op } = require('sequelize');

class StrategyService {
  /**
   * Create new strategy
   * @param {string} userId - User ID
   * @param {Object} data - Strategy data
   * @param {string} ip - IP address
   * @returns {Promise<Object>} - Created strategy
   */
  async createStrategy(userId, data, ip = null) {
    try {
      logger.info(`Creating strategy for user: ${userId}`, { name: data.name });

      // Check if strategy with same name already exists for this user
      const existingStrategy = await Strategy.findOne({
        where: {
          userId,
          name: data.name,
        },
      });

      if (existingStrategy) {
        throw new ConflictError('Strategy with this name already exists');
      }

      // Create strategy
      const strategy = await Strategy.create({
        userId,
        name: data.name,
        description: data.description || null,
        config: data.config || {},
        status: data.status || 'ACTIVE',
      });

      logger.info(`Strategy created: ${strategy.id}`, { userId, name: strategy.name });

      // Audit log
      await auditQueue.add('strategy_created', {
        event: SYSTEM.AUDIT_EVENT.CONFIG_CHANGED,
        userId,
        source: 'STRATEGY',
        ip,
        payload: {
          strategyId: strategy.id,
          action: 'STRATEGY_CREATED',
          name: strategy.name,
        },
        result: 'SUCCESS',
      });

      return {
        success: true,
        message: 'Strategy created successfully',
        strategy,
      };

    } catch (error) {
      logger.error('Error creating strategy:', error);
      throw error;
    }
  }

  /**
   * Get user's strategies with filters and pagination
   * @param {string} userId - User ID
   * @param {Object} filters - Query filters
   * @param {Object} options - Pagination and sorting options
   * @returns {Promise<Object>} - Strategies with pagination
   */
  async getStrategies(userId, filters = {}, options = {}) {
    try {
      const where = { userId };

      // Status filter
      if (filters.status) {
        where.status = filters.status;
      }

      // Search filter (by name or description)
      if (filters.search) {
        where[Op.or] = [
          { name: { [Op.iLike]: `%${filters.search}%` } },
          { description: { [Op.iLike]: `%${filters.search}%` } },
        ];
      }

      // Pagination
      const limit = options.limit || 20;
      const offset = options.offset || 0;

      // Sorting
      const sortBy = options.sortBy || 'createdAt';
      const sortOrder = options.sortOrder || 'DESC';

      // Query strategies
      const { count, rows } = await Strategy.findAndCountAll({
        where,
        include: [
          {
            association: 'user',
            attributes: ['id', 'email', 'firstName', 'lastName'],
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
        strategies: rows,
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
      logger.error('Error getting strategies:', error);
      throw error;
    }
  }

  /**
   * Get strategy by ID
   * @param {string} strategyId - Strategy ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} - Strategy details
   */
  async getStrategyById(strategyId, userId) {
    try {
      const strategy = await Strategy.findOne({
        where: {
          id: strategyId,
          userId,
        },
        include: [
          {
            association: 'user',
            attributes: ['id', 'email', 'firstName', 'lastName'],
          },
        ],
      });

      if (!strategy) {
        throw new NotFoundError('Strategy not found');
      }

      return {
        success: true,
        strategy,
      };

    } catch (error) {
      logger.error('Error getting strategy by ID:', error);
      throw error;
    }
  }

  /**
   * Update strategy
   * @param {string} strategyId - Strategy ID
   * @param {string} userId - User ID
   * @param {Object} data - Update data
   * @param {string} ip - IP address
   * @returns {Promise<Object>} - Updated strategy
   */
  async updateStrategy(strategyId, userId, data, ip = null) {
    try {
      const strategy = await Strategy.findOne({
        where: {
          id: strategyId,
          userId,
        },
      });

      if (!strategy) {
        throw new NotFoundError('Strategy not found');
      }

      // Check if name is being changed and if it already exists
      if (data.name && data.name !== strategy.name) {
        const existingStrategy = await Strategy.findOne({
          where: {
            userId,
            name: data.name,
            id: { [Op.ne]: strategyId },
          },
        });

        if (existingStrategy) {
          throw new ConflictError('Strategy with this name already exists');
        }
      }

      // Update strategy
      const updateData = {};
      
      if (data.name !== undefined) updateData.name = data.name;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.status !== undefined) updateData.status = data.status;
      
      // Merge config if provided
      if (data.config !== undefined) {
        updateData.config = {
          ...strategy.config,
          ...data.config,
        };
      }

      await strategy.update(updateData);

      logger.info(`Strategy updated: ${strategyId}`, { userId, updatedFields: Object.keys(updateData) });

      // Audit log
      await auditQueue.add('strategy_updated', {
        event: SYSTEM.AUDIT_EVENT.CONFIG_CHANGED,
        userId,
        source: 'STRATEGY',
        ip,
        payload: {
          strategyId: strategy.id,
          action: 'STRATEGY_UPDATED',
          name: strategy.name,
          fields: Object.keys(updateData),
        },
        result: 'SUCCESS',
      });

      return {
        success: true,
        message: 'Strategy updated successfully',
        strategy,
      };

    } catch (error) {
      logger.error('Error updating strategy:', error);
      throw error;
    }
  }

  /**
   * Delete strategy
   * @param {string} strategyId - Strategy ID
   * @param {string} userId - User ID
   * @param {string} ip - IP address
   * @returns {Promise<Object>}
   */
  async deleteStrategy(strategyId, userId, ip = null) {
    try {
      const strategy = await Strategy.findOne({
        where: {
          id: strategyId,
          userId,
        },
      });

      if (!strategy) {
        throw new NotFoundError('Strategy not found');
      }

      // Check if strategy is being used in any active trade intents
      const TradeIntent = require('../../../infrastructure/database/models').TradeIntent;
      const activeIntents = await TradeIntent.count({
        where: {
          strategyId,
          status: { [Op.in]: ['PENDING', 'APPROVED'] },
        },
      });

      if (activeIntents > 0) {
        throw new BadRequestError('Cannot delete strategy with active trade intents');
      }

      const strategyName = strategy.name;

      // Delete strategy
      await strategy.destroy();

      logger.info(`Strategy deleted: ${strategyId}`, { userId, name: strategyName });

      // Audit log
      await auditQueue.add('strategy_deleted', {
        event: SYSTEM.AUDIT_EVENT.CONFIG_CHANGED,
        userId,
        source: 'STRATEGY',
        ip,
        payload: {
          strategyId,
          action: 'STRATEGY_DELETED',
          name: strategyName,
        },
        result: 'SUCCESS',
      });

      return {
        success: true,
        message: 'Strategy deleted successfully',
      };

    } catch (error) {
      logger.error('Error deleting strategy:', error);
      throw error;
    }
  }

  /**
   * Clone/duplicate strategy
   * @param {string} strategyId - Strategy ID to clone
   * @param {string} userId - User ID
   * @param {string} newName - New strategy name
   * @param {string} ip - IP address
   * @returns {Promise<Object>} - Cloned strategy
   */
  async cloneStrategy(strategyId, userId, newName, ip = null) {
    try {
      const originalStrategy = await Strategy.findOne({
        where: {
          id: strategyId,
          userId,
        },
      });

      if (!originalStrategy) {
        throw new NotFoundError('Strategy not found');
      }

      // Check if new name already exists
      const existingStrategy = await Strategy.findOne({
        where: {
          userId,
          name: newName,
        },
      });

      if (existingStrategy) {
        throw new ConflictError('Strategy with this name already exists');
      }

      // Create cloned strategy
      const clonedStrategy = await Strategy.create({
        userId,
        name: newName,
        description: `Cloned from ${originalStrategy.name}`,
        config: originalStrategy.config,
        status: 'INACTIVE', // Start as inactive
      });

      logger.info(`Strategy cloned: ${clonedStrategy.id}`, { 
        userId, 
        originalId: strategyId,
        newName 
      });

      // Audit log
      await auditQueue.add('strategy_cloned', {
        event: SYSTEM.AUDIT_EVENT.CONFIG_CHANGED,
        userId,
        source: 'STRATEGY',
        ip,
        payload: {
          originalStrategyId: strategyId,
          newStrategyId: clonedStrategy.id,
          action: 'STRATEGY_CLONED',
          newName,
        },
        result: 'SUCCESS',
      });

      return {
        success: true,
        message: 'Strategy cloned successfully',
        strategy: clonedStrategy,
      };

    } catch (error) {
      logger.error('Error cloning strategy:', error);
      throw error;
    }
  }

  /**
   * Get strategy statistics for user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} - Strategy statistics
   */
  async getStrategyStatistics(userId) {
    try {
      // Total strategies
      const totalStrategies = await Strategy.count({
        where: { userId },
      });

      // Active strategies
      const activeStrategies = await Strategy.count({
        where: { userId, status: 'ACTIVE' },
      });

      // Get trade intents count per strategy
      const TradeIntent = require('../../../infrastructure/database/models').TradeIntent;
      
      const strategiesWithIntents = await Strategy.findAll({
        where: { userId },
        attributes: [
          'id',
          'name',
          'status',
        ],
        include: [
          {
            association: 'tradeIntents',
            attributes: [],
          },
        ],
        group: ['Strategy.id'],
        raw: true,
      });

      return {
        success: true,
        statistics: {
          total: totalStrategies,
          active: activeStrategies,
          inactive: totalStrategies - activeStrategies,
        },
      };

    } catch (error) {
      logger.error('Error getting strategy statistics:', error);
      throw error;
    }
  }
}

module.exports = StrategyService;