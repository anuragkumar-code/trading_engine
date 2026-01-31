const jwt = require('jsonwebtoken');
const config = require('../config');

class JWT {
  /**
   * Generate access token
   * @param {Object} payload - Payload to encode
   * @returns {string} - JWT token
   */
  generateAccessToken(payload) {
    return jwt.sign(payload, config.app.jwt.secret, {
      expiresIn: config.app.jwt.expiresIn,
    });
  }

  /**
   * Generate refresh token
   * @param {Object} payload - Payload to encode
   * @returns {string} - Refresh token
   */
  generateRefreshToken(payload) {
    return jwt.sign(payload, config.app.jwt.refreshSecret, {
      expiresIn: config.app.jwt.refreshExpiresIn,
    });
  }

  /**
   * Verify access token
   * @param {string} token - JWT token
   * @returns {Object} - Decoded payload
   */
  verifyAccessToken(token) {
    try {
      return jwt.verify(token, config.app.jwt.secret);
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  /**
   * Verify refresh token
   * @param {string} token - Refresh token
   * @returns {Object} - Decoded payload
   */
  verifyRefreshToken(token) {
    try {
      return jwt.verify(token, config.app.jwt.refreshSecret);
    } catch (error) {
      throw new Error('Invalid or expired refresh token');
    }
  }

  /**
   * Decode token without verification
   * @param {string} token - JWT token
   * @returns {Object} - Decoded payload
   */
  decode(token) {
    return jwt.decode(token);
  }

  /**
   * Generate token pair (access + refresh)
   * @param {Object} payload - Payload to encode
   * @returns {Object} - { accessToken, refreshToken }
   */
  generateTokenPair(payload) {
    return {
      accessToken: this.generateAccessToken(payload),
      refreshToken: this.generateRefreshToken(payload),
    };
  }
}

module.exports = new JWT();