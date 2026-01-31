const AuthService = require('../service/auth.service');
const logger = require('../../../infrastructure/logger');

class AuthController {
  constructor() {
    this.authService = new AuthService();
  }

  /**
   * Register new user
   * POST /api/v1/auth/register
   */
  register = async (req, res, next) => {
    try {
      const ip = req.ip || req.connection.remoteAddress;
      const result = await this.authService.register(req.body, ip);

      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Login user
   * POST /api/v1/auth/login
   */
  login = async (req, res, next) => {
    try {
      const { email, password } = req.body;
      const ip = req.ip || req.connection.remoteAddress;
      
      const result = await this.authService.login(email, password, ip);

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Refresh access token
   * POST /api/v1/auth/refresh
   */
  refreshToken = async (req, res, next) => {
    try {
      const { refreshToken } = req.body;
      
      const result = await this.authService.refreshToken(refreshToken);

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Logout user
   * POST /api/v1/auth/logout
   */
  logout = async (req, res, next) => {
    try {
      const ip = req.ip || req.connection.remoteAddress;
      const result = await this.authService.logout(req.userId, ip);

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Change password
   * POST /api/v1/auth/change-password
   */
  changePassword = async (req, res, next) => {
    try {
      const { currentPassword, newPassword } = req.body;
      const ip = req.ip || req.connection.remoteAddress;
      
      const result = await this.authService.changePassword(
        req.userId,
        currentPassword,
        newPassword,
        ip
      );

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Request password reset
   * POST /api/v1/auth/forgot-password
   */
  forgotPassword = async (req, res, next) => {
    try {
      const { email } = req.body;
      const ip = req.ip || req.connection.remoteAddress;
      
      const result = await this.authService.forgotPassword(email, ip);

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Reset password with token
   * POST /api/v1/auth/reset-password
   */
  resetPassword = async (req, res, next) => {
    try {
      const { token, password } = req.body;
      const ip = req.ip || req.connection.remoteAddress;
      
      const result = await this.authService.resetPassword(token, password, ip);

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get user profile
   * GET /api/v1/auth/profile
   */
  getProfile = async (req, res, next) => {
    try {
      const result = await this.authService.getProfile(req.userId);

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Update user profile
   * PUT /api/v1/auth/profile
   */
  updateProfile = async (req, res, next) => {
    try {
      const ip = req.ip || req.connection.remoteAddress;
      const result = await this.authService.updateProfile(req.userId, req.body, ip);

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };
}

module.exports = AuthController;