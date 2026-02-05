const { User, KiteAccount, Strategy, RiskLimit } = require('../../../infrastructure/database/models');
const { auditQueue } = require('../../../infrastructure/queue');
const logger = require('../../../infrastructure/logger');
const { hash } = require('../../../shared/utils');
const {
  NotFoundError,
  ConflictError,
  BadRequestError,
  ForbiddenError,
} = require('../../../shared/errors');
const { SYSTEM } = require('../../../shared/constants');
const { Op } = require('sequelize');
const { sequelize } = require('../../../infrastructure/database/models');

class UserService {
  /**
   * Get all users with filters and pagination (Admin only)
   * @param {Object} filters - Query filters
   * @param {Object} options - Pagination and sorting options
   * @returns {Promise<Object>} - Users with pagination
   */
  async getUsers(filters = {}, options = {}) {
    try {
      const where = {};

      // Search filter (email, first name, last name)
      if (filters.search) {
        where[Op.or] = [
          { email: { [Op.iLike]: `%${filters.search}%` } },
          { firstName: { [Op.iLike]: `%${filters.search}%` } },
          { lastName: { [Op.iLike]: `%${filters.search}%` } },
        ];
      }

      // Role filter
      if (filters.role) {
        where.role = filters.role;
      }

      // Status filter
      if (filters.status) {
        where.status = filters.status;
      }

      // Pagination
      const limit = options.limit || 20;
      const offset = options.offset || 0;

      // Sorting
      const sortBy = options.sortBy || 'createdAt';
      const sortOrder = options.sortOrder || 'DESC';

      // Query users
      const { count, rows } = await User.findAndCountAll({
        where,
        attributes: { exclude: ['password'] },
        include: [
          {
            association: 'kiteAccounts',
            attributes: ['id', 'status', 'tokenExpiresAt'],
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
        users: rows,
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
      logger.error('Error getting users:', error);
      throw error;
    }
  }

  /**
   * Get user by ID
   * @param {string} userId - User ID
   * @param {string} requestUserId - ID of user making request
   * @param {string} requestUserRole - Role of user making request
   * @returns {Promise<Object>} - User details
   */
  async getUserById(userId, requestUserId, requestUserRole) {
    try {
      // Non-admin users can only view their own profile
      if (requestUserRole !== SYSTEM.USER_ROLE.ADMIN && userId !== requestUserId) {
        throw new ForbiddenError('You can only view your own profile');
      }

      const user = await User.findByPk(userId, {
        attributes: { exclude: ['password'] },
        include: [
          {
            association: 'kiteAccounts',
            attributes: ['id', 'status', 'tokenExpiresAt', 'createdAt'],
          },
          {
            association: 'strategies',
            attributes: ['id', 'name', 'status', 'createdAt'],
          },
          {
            association: 'riskLimits',
            attributes: ['id', 'limitType', 'value', 'unit', 'status'],
          },
        ],
      });

      if (!user) {
        throw new NotFoundError('User not found');
      }

      return {
        success: true,
        user,
      };

    } catch (error) {
      logger.error('Error getting user by ID:', error);
      throw error;
    }
  }

  /**
   * Update user details
   * @param {string} userId - User ID
   * @param {Object} data - Update data
   * @param {string} requestUserId - ID of user making request
   * @param {string} requestUserRole - Role of user making request
   * @param {string} ip - IP address
   * @returns {Promise<Object>} - Updated user
   */
  async updateUser(userId, data, requestUserId, requestUserRole, ip = null) {
    try {
      // Non-admin users can only update their own profile
      if (requestUserRole !== SYSTEM.USER_ROLE.ADMIN && userId !== requestUserId) {
        throw new ForbiddenError('You can only update your own profile');
      }

      const user = await User.findByPk(userId);

      if (!user) {
        throw new NotFoundError('User not found');
      }

      // Check if email is being changed and if it already exists
      if (data.email && data.email !== user.email) {
        const existingUser = await User.findOne({
          where: { email: data.email },
        });

        if (existingUser) {
          throw new ConflictError('Email already in use');
        }
      }

      // Update allowed fields
      const allowedFields = ['firstName', 'lastName', 'email'];
      const updateData = {};

      allowedFields.forEach(field => {
        if (data[field] !== undefined) {
          updateData[field] = data[field];
        }
      });

      await user.update(updateData);

      logger.info(`User updated: ${userId}`, { updatedFields: Object.keys(updateData) });

      // Audit log
      await auditQueue.add('user_updated', {
        event: SYSTEM.AUDIT_EVENT.CONFIG_CHANGED,
        userId: requestUserId,
        source: 'USER',
        ip,
        payload: {
          targetUserId: userId,
          action: 'USER_UPDATED',
          fields: Object.keys(updateData),
        },
        result: 'SUCCESS',
      });

      // Return user without password
      const updatedUser = await User.findByPk(userId, {
        attributes: { exclude: ['password'] },
      });

      return {
        success: true,
        message: 'User updated successfully',
        user: updatedUser,
      };

    } catch (error) {
      logger.error('Error updating user:', error);
      throw error;
    }
  }

  /**
   * Update user role (Admin only)
   * @param {string} userId - User ID
   * @param {string} role - New role
   * @param {string} requestUserId - ID of user making request
   * @param {string} ip - IP address
   * @returns {Promise<Object>} - Updated user
   */
  async updateUserRole(userId, role, requestUserId, ip = null) {
    try {
      const user = await User.findByPk(userId);

      if (!user) {
        throw new NotFoundError('User not found');
      }

      // Prevent self-demotion
      if (userId === requestUserId && role !== SYSTEM.USER_ROLE.ADMIN) {
        throw new BadRequestError('You cannot change your own role');
      }

      const oldRole = user.role;

      await user.update({ role });

      logger.info(`User role updated: ${userId}`, { oldRole, newRole: role });

      // Audit log
      await auditQueue.add('user_role_updated', {
        event: SYSTEM.AUDIT_EVENT.CONFIG_CHANGED,
        userId: requestUserId,
        source: 'USER',
        ip,
        payload: {
          targetUserId: userId,
          action: 'ROLE_UPDATED',
          oldRole,
          newRole: role,
        },
        result: 'SUCCESS',
      });

      return {
        success: true,
        message: 'User role updated successfully',
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
      };

    } catch (error) {
      logger.error('Error updating user role:', error);
      throw error;
    }
  }

  /**
   * Update user status (Admin only)
   * @param {string} userId - User ID
   * @param {string} status - New status
   * @param {string} reason - Reason for status change
   * @param {string} requestUserId - ID of user making request
   * @param {string} ip - IP address
   * @returns {Promise<Object>} - Updated user
   */
  async updateUserStatus(userId, status, reason, requestUserId, ip = null) {
    try {
      const user = await User.findByPk(userId);

      if (!user) {
        throw new NotFoundError('User not found');
      }

      // Prevent self-suspension
      if (userId === requestUserId && status !== SYSTEM.ACCOUNT_STATUS.ACTIVE) {
        throw new BadRequestError('You cannot change your own account status');
      }

      const oldStatus = user.status;

      await user.update({ status });

      logger.info(`User status updated: ${userId}`, { oldStatus, newStatus: status });

      // Audit log
      await auditQueue.add('user_status_updated', {
        event: SYSTEM.AUDIT_EVENT.CONFIG_CHANGED,
        userId: requestUserId,
        source: 'USER',
        ip,
        payload: {
          targetUserId: userId,
          action: 'STATUS_UPDATED',
          oldStatus,
          newStatus: status,
          reason: reason || 'Not specified',
        },
        result: 'SUCCESS',
      });

      return {
        success: true,
        message: `User account ${status.toLowerCase()} successfully`,
        user: {
          id: user.id,
          email: user.email,
          status: user.status,
        },
      };

    } catch (error) {
      logger.error('Error updating user status:', error);
      throw error;
    }
  }

  /**
   * Delete user (Admin only)
   * @param {string} userId - User ID
   * @param {string} requestUserId - ID of user making request
   * @param {string} ip - IP address
   * @returns {Promise<Object>}
   */
  async deleteUser(userId, requestUserId, ip = null) {
    try {
      const user = await User.findByPk(userId);

      if (!user) {
        throw new NotFoundError('User not found');
      }

      // Prevent self-deletion
      if (userId === requestUserId) {
        throw new BadRequestError('You cannot delete your own account');
      }

      // Delete user (cascade delete will handle related records)
      await user.destroy();

      logger.info(`User deleted: ${userId}`);

      // Audit log
      await auditQueue.add('user_deleted', {
        event: SYSTEM.AUDIT_EVENT.CONFIG_CHANGED,
        userId: requestUserId,
        source: 'USER',
        ip,
        payload: {
          targetUserId: userId,
          action: 'USER_DELETED',
          email: user.email,
        },
        result: 'SUCCESS',
      });

      return {
        success: true,
        message: 'User deleted successfully',
      };

    } catch (error) {
      logger.error('Error deleting user:', error);
      throw error;
    }
  }

  /**
   * Get user statistics (Admin only)
   * @param {Object} filters - Date range filters
   * @returns {Promise<Object>} - User statistics
   */
  async getUserStatistics(filters = {}) {
    try {
      const where = {};

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

      // Total users
      const totalUsers = await User.count();

      // Users by role
      const usersByRole = await User.findAll({
        attributes: [
          'role',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        ],
        group: 'role',
        raw: true,
      });

      // Users by status
      const usersByStatus = await User.findAll({
        attributes: [
          'status',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
        ],
        group: 'status',
        raw: true,
      });

      // New users in time range
      const newUsers = await User.count({ where });

      // Active users (logged in within last 30 days)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const activeUsers = await User.count({
        where: {
          lastLoginAt: {
            [Op.gte]: thirtyDaysAgo,
          },
        },
      });

      // Users with Kite accounts
      const usersWithKite = await User.count({
        include: [
          {
            association: 'kiteAccounts',
            required: true,
          },
        ],
      });

      // Users with strategies
      const usersWithStrategies = await User.count({
        include: [
          {
            association: 'strategies',
            required: true,
          },
        ],
      });

      return {
        success: true,
        statistics: {
          total: totalUsers,
          new: newUsers,
          active: activeUsers,
          withKiteAccount: usersWithKite,
          withStrategies: usersWithStrategies,
          byRole: usersByRole,
          byStatus: usersByStatus,
        },
      };

    } catch (error) {
      logger.error('Error getting user statistics:', error);
      throw error;
    }
  }
}

module.exports = UserService;