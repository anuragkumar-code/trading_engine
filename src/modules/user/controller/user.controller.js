const UserService = require('../service/user.service');
const logger = require('../../../infrastructure/logger');

class UserController {
  constructor() {
    this.userService = new UserService();
  }

  /**
   * Get all users (Admin only)
   * GET /api/v1/users
   */
  getUsers = async (req, res, next) => {
    try {
      const filters = {
        search: req.query.search,
        role: req.query.role,
        status: req.query.status,
      };

      const options = {
        limit: parseInt(req.query.limit) || 20,
        offset: parseInt(req.query.offset) || 0,
        sortBy: req.query.sortBy || 'createdAt',
        sortOrder: req.query.sortOrder || 'DESC',
      };

      const result = await this.userService.getUsers(filters, options);

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get user by ID
   * GET /api/v1/users/:id
   */
  getUserById = async (req, res, next) => {
    try {
      const { id } = req.params;

      const result = await this.userService.getUserById(
        id,
        req.userId,
        req.user.role
      );

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Update user details
   * PUT /api/v1/users/:id
   */
  updateUser = async (req, res, next) => {
    try {
      const { id } = req.params;
      const ip = req.ip || req.connection.remoteAddress;

      const result = await this.userService.updateUser(
        id,
        req.body,
        req.userId,
        req.user.role,
        ip
      );

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Update user role (Admin only)
   * PATCH /api/v1/users/:id/role
   */
  updateUserRole = async (req, res, next) => {
    try {
      const { id } = req.params;
      const { role } = req.body;
      const ip = req.ip || req.connection.remoteAddress;

      const result = await this.userService.updateUserRole(
        id,
        role,
        req.userId,
        ip
      );

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Update user status (Admin only)
   * PATCH /api/v1/users/:id/status
   */
  updateUserStatus = async (req, res, next) => {
    try {
      const { id } = req.params;
      const { status, reason } = req.body;
      const ip = req.ip || req.connection.remoteAddress;

      const result = await this.userService.updateUserStatus(
        id,
        status,
        reason,
        req.userId,
        ip
      );

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Delete user (Admin only)
   * DELETE /api/v1/users/:id
   */
  deleteUser = async (req, res, next) => {
    try {
      const { id } = req.params;
      const ip = req.ip || req.connection.remoteAddress;

      const result = await this.userService.deleteUser(
        id,
        req.userId,
        ip
      );

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get user statistics (Admin only)
   * GET /api/v1/users/stats
   */
  getUserStatistics = async (req, res, next) => {
    try {
      const filters = {
        startDate: req.query.startDate,
        endDate: req.query.endDate,
      };

      const result = await this.userService.getUserStatistics(filters);

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };
}

module.exports = UserController;