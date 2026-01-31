const { User } = require('../../../infrastructure/database/models');
const { hash, jwt } = require('../../../shared/utils');
const { cache } = require('../../../infrastructure/redis');
const { auditQueue } = require('../../../infrastructure/queue');
const logger = require('../../../infrastructure/logger');
const { 
  UnauthorizedError, 
  ConflictError, 
  BadRequestError,
  NotFoundError 
} = require('../../../shared/errors');
const { SYSTEM } = require('../../../shared/constants');
const crypto = require('crypto');

class AuthService {
  constructor() {
    this.refreshTokenCache = 'refresh_token:';
    this.resetTokenCache = 'reset_token:';
  }

  /**
   * Register new user
   * @param {Object} data - User registration data
   * @param {string} ip - IP address
   * @returns {Promise<Object>} - Created user and tokens
   */
  async register(data, ip = null) {
    try {
      logger.info('User registration attempt', { email: data.email });

      // Check if user already exists
      const existingUser = await User.findOne({
        where: { email: data.email },
      });

      if (existingUser) {
        throw new ConflictError('User with this email already exists');
      }

      // Hash password
      const hashedPassword = await hash.hashPassword(data.password);

      // Create user
      const user = await User.create({
        email: data.email,
        password: hashedPassword,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role || SYSTEM.USER_ROLE.TRADER,
        status: SYSTEM.ACCOUNT_STATUS.ACTIVE,
      });

      logger.info(`User registered successfully: ${user.id}`, { email: user.email });

      // Generate tokens
      const tokens = this.generateTokens(user);

      // Store refresh token in cache
      await this.storeRefreshToken(user.id, tokens.refreshToken);

      // Audit log
      await auditQueue.add('user_registered', {
        event: SYSTEM.AUDIT_EVENT.USER_LOGIN,
        userId: user.id,
        source: 'AUTH',
        ip,
        payload: {
          email: user.email,
          role: user.role,
          action: 'REGISTER',
        },
        result: 'SUCCESS',
      });

      // Return user without password
      const userResponse = this.sanitizeUser(user);

      return {
        success: true,
        message: 'User registered successfully',
        user: userResponse,
        tokens,
      };

    } catch (error) {
      logger.error('Registration error:', error);
      throw error;
    }
  }

  /**
   * Login user
   * @param {string} email - User email
   * @param {string} password - User password
   * @param {string} ip - IP address
   * @returns {Promise<Object>} - User and tokens
   */
  async login(email, password, ip = null) {
    try {
      logger.info('Login attempt', { email });

      // Find user by email
      const user = await User.findOne({
        where: { email: email.toLowerCase() },
      });

      if (!user) {
        throw new UnauthorizedError('Invalid email or password');
      }

      // Check if account is active
      if (user.status !== SYSTEM.ACCOUNT_STATUS.ACTIVE) {
        throw new UnauthorizedError(`Account is ${user.status.toLowerCase()}`);
      }

      // Verify password
      const isPasswordValid = await hash.comparePassword(password, user.password);

      if (!isPasswordValid) {
        throw new UnauthorizedError('Invalid email or password');
      }

      // Update last login
      await user.update({
        lastLoginAt: new Date(),
      });

      logger.info(`User logged in successfully: ${user.id}`, { email: user.email });

      // Generate tokens
      const tokens = this.generateTokens(user);

      // Store refresh token in cache
      await this.storeRefreshToken(user.id, tokens.refreshToken);

      // Audit log
      await auditQueue.add('user_login', {
        event: SYSTEM.AUDIT_EVENT.USER_LOGIN,
        userId: user.id,
        source: 'AUTH',
        ip,
        payload: {
          email: user.email,
          action: 'LOGIN',
        },
        result: 'SUCCESS',
      });

      // Return user without password
      const userResponse = this.sanitizeUser(user);

      return {
        success: true,
        message: 'Login successful',
        user: userResponse,
        tokens,
      };

    } catch (error) {
      logger.error('Login error:', error);
      throw error;
    }
  }

  /**
   * Refresh access token
   * @param {string} refreshToken - Refresh token
   * @returns {Promise<Object>} - New tokens
   */
  async refreshToken(refreshToken) {
    try {
      // Verify refresh token
      const decoded = jwt.verifyRefreshToken(refreshToken);

      // Check if refresh token exists in cache
      const cachedToken = await cache.get(`${this.refreshTokenCache}${decoded.userId}`);

      if (!cachedToken || cachedToken.token !== refreshToken) {
        throw new UnauthorizedError('Invalid or expired refresh token');
      }

      // Get user
      const user = await User.findByPk(decoded.userId);

      if (!user) {
        throw new UnauthorizedError('User not found');
      }

      if (user.status !== SYSTEM.ACCOUNT_STATUS.ACTIVE) {
        throw new UnauthorizedError('Account is not active');
      }

      logger.info(`Token refreshed for user: ${user.id}`);

      // Generate new tokens
      const tokens = this.generateTokens(user);

      // Update refresh token in cache
      await this.storeRefreshToken(user.id, tokens.refreshToken);

      return {
        success: true,
        message: 'Token refreshed successfully',
        tokens,
      };

    } catch (error) {
      logger.error('Token refresh error:', error);
      throw error;
    }
  }

  /**
   * Logout user
   * @param {string} userId - User ID
   * @param {string} ip - IP address
   * @returns {Promise<Object>}
   */
  async logout(userId, ip = null) {
    try {
      logger.info(`User logout: ${userId}`);

      // Remove refresh token from cache
      await cache.del(`${this.refreshTokenCache}${userId}`);

      // Audit log
      await auditQueue.add('user_logout', {
        event: SYSTEM.AUDIT_EVENT.USER_LOGOUT,
        userId,
        source: 'AUTH',
        ip,
        payload: {
          action: 'LOGOUT',
        },
        result: 'SUCCESS',
      });

      return {
        success: true,
        message: 'Logged out successfully',
      };

    } catch (error) {
      logger.error('Logout error:', error);
      throw error;
    }
  }

  /**
   * Change password
   * @param {string} userId - User ID
   * @param {string} currentPassword - Current password
   * @param {string} newPassword - New password
   * @param {string} ip - IP address
   * @returns {Promise<Object>}
   */
  async changePassword(userId, currentPassword, newPassword, ip = null) {
    try {
      logger.info(`Password change attempt for user: ${userId}`);

      const user = await User.findByPk(userId);

      if (!user) {
        throw new NotFoundError('User not found');
      }

      // Verify current password
      const isPasswordValid = await hash.comparePassword(currentPassword, user.password);

      if (!isPasswordValid) {
        throw new UnauthorizedError('Current password is incorrect');
      }

      // Check if new password is same as current
      const isSamePassword = await hash.comparePassword(newPassword, user.password);

      if (isSamePassword) {
        throw new BadRequestError('New password must be different from current password');
      }

      // Hash new password
      const hashedPassword = await hash.hashPassword(newPassword);

      // Update password
      await user.update({
        password: hashedPassword,
      });

      logger.info(`Password changed successfully for user: ${userId}`);

      // Invalidate all refresh tokens
      await cache.del(`${this.refreshTokenCache}${userId}`);

      // Audit log
      await auditQueue.add('password_changed', {
        event: SYSTEM.AUDIT_EVENT.CONFIG_CHANGED,
        userId,
        source: 'AUTH',
        ip,
        payload: {
          action: 'PASSWORD_CHANGED',
        },
        result: 'SUCCESS',
      });

      return {
        success: true,
        message: 'Password changed successfully. Please login again.',
      };

    } catch (error) {
      logger.error('Change password error:', error);
      throw error;
    }
  }

  /**
   * Request password reset
   * @param {string} email - User email
   * @param {string} ip - IP address
   * @returns {Promise<Object>}
   */
  async forgotPassword(email, ip = null) {
    try {
      logger.info('Password reset request', { email });

      const user = await User.findOne({
        where: { email: email.toLowerCase() },
      });

      // Don't reveal if user exists or not for security
      if (!user) {
        return {
          success: true,
          message: 'If an account exists with this email, a password reset link has been sent',
        };
      }

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const hashedToken = hash.hash(resetToken);

      // Store hashed token in cache (valid for 1 hour)
      await cache.set(
        `${this.resetTokenCache}${hashedToken}`,
        {
          userId: user.id,
          email: user.email,
          createdAt: new Date(),
        },
        3600 // 1 hour
      );

      logger.info(`Password reset token generated for user: ${user.id}`);

      // TODO: Send email with reset link
      // const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
      // await sendEmail(user.email, 'Password Reset', resetLink);

      // Audit log
      await auditQueue.add('password_reset_requested', {
        event: SYSTEM.AUDIT_EVENT.CONFIG_CHANGED,
        userId: user.id,
        source: 'AUTH',
        ip,
        payload: {
          email: user.email,
          action: 'PASSWORD_RESET_REQUESTED',
        },
        result: 'SUCCESS',
      });

      return {
        success: true,
        message: 'If an account exists with this email, a password reset link has been sent',
        // In development, return token for testing
        ...(process.env.NODE_ENV === 'development' && { resetToken }),
      };

    } catch (error) {
      logger.error('Forgot password error:', error);
      throw error;
    }
  }

  /**
   * Reset password with token
   * @param {string} token - Reset token
   * @param {string} newPassword - New password
   * @param {string} ip - IP address
   * @returns {Promise<Object>}
   */
  async resetPassword(token, newPassword, ip = null) {
    try {
      logger.info('Password reset attempt');

      const hashedToken = hash.hash(token);

      // Get token data from cache
      const tokenData = await cache.get(`${this.resetTokenCache}${hashedToken}`);

      if (!tokenData) {
        throw new BadRequestError('Invalid or expired reset token');
      }

      // Get user
      const user = await User.findByPk(tokenData.userId);

      if (!user) {
        throw new NotFoundError('User not found');
      }

      // Hash new password
      const hashedPassword = await hash.hashPassword(newPassword);

      // Update password
      await user.update({
        password: hashedPassword,
      });

      logger.info(`Password reset successfully for user: ${user.id}`);

      // Delete reset token
      await cache.del(`${this.resetTokenCache}${hashedToken}`);

      // Invalidate all refresh tokens
      await cache.del(`${this.refreshTokenCache}${user.id}`);

      // Audit log
      await auditQueue.add('password_reset', {
        event: SYSTEM.AUDIT_EVENT.CONFIG_CHANGED,
        userId: user.id,
        source: 'AUTH',
        ip,
        payload: {
          email: user.email,
          action: 'PASSWORD_RESET',
        },
        result: 'SUCCESS',
      });

      return {
        success: true,
        message: 'Password reset successfully. Please login with your new password.',
      };

    } catch (error) {
      logger.error('Reset password error:', error);
      throw error;
    }
  }

  /**
   * Get user profile
   * @param {string} userId - User ID
   * @returns {Promise<Object>}
   */
  async getProfile(userId) {
    try {
      const user = await User.findByPk(userId, {
        attributes: { exclude: ['password'] },
        include: [
          {
            association: 'kiteAccounts',
            attributes: ['id', 'status', 'tokenExpiresAt'],
          },
        ],
      });

      if (!user) {
        throw new NotFoundError('User not found');
      }

      return {
        success: true,
        user: this.sanitizeUser(user),
      };

    } catch (error) {
      logger.error('Get profile error:', error);
      throw error;
    }
  }

  /**
   * Update user profile
   * @param {string} userId - User ID
   * @param {Object} data - Update data
   * @param {string} ip - IP address
   * @returns {Promise<Object>}
   */
  async updateProfile(userId, data, ip = null) {
    try {
      logger.info(`Profile update attempt for user: ${userId}`);

      const user = await User.findByPk(userId);

      if (!user) {
        throw new NotFoundError('User not found');
      }

      // Update allowed fields only
      const allowedFields = ['firstName', 'lastName'];
      const updateData = {};

      allowedFields.forEach(field => {
        if (data[field] !== undefined) {
          updateData[field] = data[field];
        }
      });

      await user.update(updateData);

      logger.info(`Profile updated successfully for user: ${userId}`);

      // Audit log
      await auditQueue.add('profile_updated', {
        event: SYSTEM.AUDIT_EVENT.CONFIG_CHANGED,
        userId,
        source: 'AUTH',
        ip,
        payload: {
          action: 'PROFILE_UPDATED',
          fields: Object.keys(updateData),
        },
        result: 'SUCCESS',
      });

      return {
        success: true,
        message: 'Profile updated successfully',
        user: this.sanitizeUser(user),
      };

    } catch (error) {
      logger.error('Update profile error:', error);
      throw error;
    }
  }

  /**
   * Generate access and refresh tokens
   * @param {Object} user - User object
   * @returns {Object} - Tokens
   */
  generateTokens(user) {
    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = jwt.generateAccessToken(payload);
    const refreshToken = jwt.generateRefreshToken(payload);

    return {
      accessToken,
      refreshToken,
      expiresIn: '24h',
    };
  }

  /**
   * Store refresh token in cache
   * @param {string} userId - User ID
   * @param {string} refreshToken - Refresh token
   */
  async storeRefreshToken(userId, refreshToken) {
    const key = `${this.refreshTokenCache}${userId}`;
    
    await cache.set(
      key,
      {
        token: refreshToken,
        createdAt: new Date(),
      },
      7 * 24 * 60 * 60 // 7 days
    );
  }

  /**
   * Sanitize user object (remove sensitive data)
   * @param {Object} user - User object
   * @returns {Object} - Sanitized user
   */
  sanitizeUser(user) {
    const userObj = user.toJSON ? user.toJSON() : user;
    
    delete userObj.password;
    
    return userObj;
  }
}

module.exports = AuthService;