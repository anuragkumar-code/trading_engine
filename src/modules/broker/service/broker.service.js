const { KiteAccount } = require('../../../infrastructure/database/models');
const { KiteClient } = require('../../../infrastructure/http');
const { encryption, hash } = require('../../../shared/utils');
const { cache } = require('../../../infrastructure/redis');
const { auditQueue } = require('../../../infrastructure/queue');
const logger = require('../../../infrastructure/logger');
const axios = require('axios');
const crypto = require('crypto');
const {
  BadRequestError,
  NotFoundError,
  ConflictError,
  InternalServerError,
} = require('../../../shared/errors');
const { SYSTEM } = require('../../../shared/constants');
const config = require('../../../shared/config');

class BrokerService {
  constructor() {
    this.kiteLoginUrl = 'https://kite.zerodha.com/connect/login';
    this.kiteSessionUrl = 'https://api.kite.trade/session/token';
    this.tokenExpiryCache = 'kite_token_expiry:';
  }

  /**
   * Connect Kite account (Step 1: Store API credentials and generate login URL)
   * @param {string} userId - User ID
   * @param {string} apiKey - Kite API Key
   * @param {string} apiSecret - Kite API Secret
   * @param {string} ip - IP address
   * @returns {Promise<Object>} - Login URL and account details
   */
  async connectKiteAccount(userId, apiKey, apiSecret, ip = null) {
    try {
      logger.info(`Connecting Kite account for user: ${userId}`);

      // Check if user already has an active Kite account
      const existingAccount = await KiteAccount.findOne({
        where: {
          userId,
          status: 'ACTIVE',
        },
      });

      if (existingAccount) {
        throw new ConflictError('You already have an active Kite account connected');
      }

      // Encrypt API credentials
      const encryptedApiKey = encryption.encrypt(apiKey);
      const apiSecretHash = hash.hashApiKey(apiSecret);

      // Store API credentials
      const kiteAccount = await KiteAccount.create({
        userId,
        apiKey: encryptedApiKey,
        apiSecretHash,
        status: 'INACTIVE', // Will become ACTIVE after successful session generation
      });

      logger.info(`Kite account credentials stored: ${kiteAccount.id}`);

      // Generate login URL
      const loginUrl = this.generateLoginUrl(apiKey);

      // Audit log
      await auditQueue.add('kite_account_connected', {
        event: SYSTEM.AUDIT_EVENT.CONFIG_CHANGED,
        userId,
        source: 'BROKER',
        ip,
        payload: {
          kiteAccountId: kiteAccount.id,
          action: 'KITE_CREDENTIALS_STORED',
        },
        result: 'SUCCESS',
      });

      return {
        success: true,
        message: 'Kite credentials stored. Please complete the login process.',
        kiteAccount: {
          id: kiteAccount.id,
          status: kiteAccount.status,
        },
        loginUrl,
        instructions: [
          '1. Click on the login URL',
          '2. Login to your Zerodha account',
          '3. After successful login, you will be redirected with a request_token',
          '4. Use the request_token to generate session',
        ],
      };

    } catch (error) {
      logger.error('Error connecting Kite account:', error);
      throw error;
    }
  }

  /**
   * Generate session (Step 2: Exchange request token for access token)
   * @param {string} userId - User ID
   * @param {string} kiteAccountId - Kite account ID
   * @param {string} requestToken - Request token from Kite redirect
   * @param {string} ip - IP address
   * @returns {Promise<Object>} - Session details
   */
  async generateSession(userId, kiteAccountId, requestToken, ip = null) {
    try {
      logger.info(`Generating Kite session for account: ${kiteAccountId}`);

      // Get Kite account
      const kiteAccount = await KiteAccount.findOne({
        where: {
          id: kiteAccountId,
          userId,
        },
      });

      if (!kiteAccount) {
        throw new NotFoundError('Kite account not found');
      }

      // Decrypt API credentials
      const apiKey = encryption.decrypt(kiteAccount.apiKey);
      
      // Get API secret from config (since we only store hash)
      // Note: In production, user should provide API secret again for security
      const apiSecret = config.app.kite.apiSecret;

      // Generate checksum: SHA-256(api_key + request_token + api_secret)
      const checksum = crypto
        .createHash('sha256')
        .update(apiKey + requestToken + apiSecret)
        .digest('hex');

      // Exchange request token for access token
      const response = await axios.post(
        this.kiteSessionUrl,
        {
          api_key: apiKey,
          request_token: requestToken,
          checksum: checksum,
        },
        {
          headers: {
            'X-Kite-Version': '3',
          },
        }
      );

      if (!response.data || !response.data.data) {
        throw new InternalServerError('Failed to generate session');
      }

      const sessionData = response.data.data;
      const accessToken = sessionData.access_token;
      const refreshToken = sessionData.refresh_token || null;

      // Encrypt tokens
      const encryptedAccessToken = encryption.encrypt(accessToken);
      const encryptedRefreshToken = refreshToken ? encryption.encrypt(refreshToken) : null;

      // Calculate token expiry (6 AM next day)
      const tokenExpiresAt = this.calculateTokenExpiry();

      // Update Kite account with tokens
      await kiteAccount.update({
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        tokenExpiresAt,
        status: 'ACTIVE',
      });

      logger.info(`Kite session generated successfully for account: ${kiteAccount.id}`);

      // Store expiry time in cache for quick checks
      await this.cacheTokenExpiry(kiteAccount.id, tokenExpiresAt);

      // Schedule token expiry notification
      await this.scheduleTokenExpiryNotification(userId, kiteAccount.id, tokenExpiresAt);

      // Audit log
      await auditQueue.add('kite_session_generated', {
        event: SYSTEM.AUDIT_EVENT.CONFIG_CHANGED,
        userId,
        source: 'BROKER',
        ip,
        payload: {
          kiteAccountId: kiteAccount.id,
          action: 'KITE_SESSION_GENERATED',
          expiresAt: tokenExpiresAt,
        },
        result: 'SUCCESS',
      });

      return {
        success: true,
        message: 'Kite session generated successfully',
        kiteAccount: {
          id: kiteAccount.id,
          status: kiteAccount.status,
          tokenExpiresAt,
        },
      };

    } catch (error) {
      logger.error('Error generating Kite session:', error);
      
      if (error.response?.data) {
        throw new BadRequestError(
          `Kite API Error: ${error.response.data.message || 'Failed to generate session'}`
        );
      }
      
      throw error;
    }
  }

  /**
   * Refresh Kite token (User action when token expires)
   * @param {string} userId - User ID
   * @param {string} kiteAccountId - Kite account ID
   * @param {string} ip - IP address
   * @returns {Promise<Object>} - New login URL
   */
  async refreshKiteToken(userId, kiteAccountId, ip = null) {
    try {
      logger.info(`Refreshing Kite token for account: ${kiteAccountId}`);

      const kiteAccount = await KiteAccount.findOne({
        where: {
          id: kiteAccountId,
          userId,
        },
      });

      if (!kiteAccount) {
        throw new NotFoundError('Kite account not found');
      }

      // Decrypt API key
      const apiKey = encryption.decrypt(kiteAccount.apiKey);

      // Generate new login URL
      const loginUrl = this.generateLoginUrl(apiKey);

      // Mark account as expired
      await kiteAccount.update({
        status: 'EXPIRED',
      });

      // Audit log
      await auditQueue.add('kite_token_refresh_initiated', {
        event: SYSTEM.AUDIT_EVENT.CONFIG_CHANGED,
        userId,
        source: 'BROKER',
        ip,
        payload: {
          kiteAccountId: kiteAccount.id,
          action: 'KITE_TOKEN_REFRESH_INITIATED',
        },
        result: 'SUCCESS',
      });

      return {
        success: true,
        message: 'Token refresh initiated. Please complete the login process.',
        kiteAccount: {
          id: kiteAccount.id,
          status: kiteAccount.status,
        },
        loginUrl,
        instructions: [
          '1. Click on the login URL',
          '2. Login to your Zerodha account',
          '3. After successful login, use the request_token to generate new session',
        ],
      };

    } catch (error) {
      logger.error('Error refreshing Kite token:', error);
      throw error;
    }
  }

  /**
   * Check if token is expired
   * @param {string} userId - User ID
   * @returns {Promise<Object>} - Token status
   */
  async checkTokenStatus(userId) {
    try {
      const kiteAccount = await KiteAccount.findOne({
        where: {
          userId,
          status: 'ACTIVE',
        },
      });

      if (!kiteAccount) {
        return {
          success: true,
          hasActiveAccount: false,
          message: 'No active Kite account found',
        };
      }

      const now = new Date();
      const isExpired = kiteAccount.tokenExpiresAt <= now;

      if (isExpired) {
        // Mark as expired
        await kiteAccount.update({
          status: 'EXPIRED',
        });

        return {
          success: true,
          hasActiveAccount: true,
          isExpired: true,
          message: 'Token has expired. Please refresh your token.',
          kiteAccountId: kiteAccount.id,
        };
      }

      // Calculate time remaining
      const timeRemaining = kiteAccount.tokenExpiresAt - now;
      const hoursRemaining = Math.floor(timeRemaining / (1000 * 60 * 60));

      return {
        success: true,
        hasActiveAccount: true,
        isExpired: false,
        expiresAt: kiteAccount.tokenExpiresAt,
        hoursRemaining,
        message: `Token is valid. Expires in ${hoursRemaining} hours.`,
      };

    } catch (error) {
      logger.error('Error checking token status:', error);
      throw error;
    }
  }

  /**
   * Get user's Kite accounts
   * @param {string} userId - User ID
   * @returns {Promise<Object>} - Kite accounts
   */
  async getKiteAccounts(userId) {
    try {
      const kiteAccounts = await KiteAccount.findAll({
        where: { userId },
        attributes: ['id', 'status', 'tokenExpiresAt', 'createdAt', 'updatedAt'],
        order: [['createdAt', 'DESC']],
      });

      return {
        success: true,
        kiteAccounts: kiteAccounts.map(account => ({
          id: account.id,
          status: account.status,
          tokenExpiresAt: account.tokenExpiresAt,
          isExpired: account.tokenExpiresAt ? account.tokenExpiresAt <= new Date() : false,
          createdAt: account.createdAt,
          updatedAt: account.updatedAt,
        })),
      };

    } catch (error) {
      logger.error('Error getting Kite accounts:', error);
      throw error;
    }
  }

  /**
   * Update Kite account status
   * @param {string} userId - User ID
   * @param {string} kiteAccountId - Kite account ID
   * @param {string} status - New status
   * @param {string} ip - IP address
   * @returns {Promise<Object>}
   */
  async updateAccountStatus(userId, kiteAccountId, status, ip = null) {
    try {
      logger.info(`Updating Kite account status: ${kiteAccountId} to ${status}`);

      const kiteAccount = await KiteAccount.findOne({
        where: {
          id: kiteAccountId,
          userId,
        },
      });

      if (!kiteAccount) {
        throw new NotFoundError('Kite account not found');
      }

      await kiteAccount.update({ status });

      // Audit log
      await auditQueue.add('kite_account_status_updated', {
        event: SYSTEM.AUDIT_EVENT.CONFIG_CHANGED,
        userId,
        source: 'BROKER',
        ip,
        payload: {
          kiteAccountId: kiteAccount.id,
          action: 'STATUS_UPDATED',
          oldStatus: kiteAccount.status,
          newStatus: status,
        },
        result: 'SUCCESS',
      });

      return {
        success: true,
        message: `Kite account ${status.toLowerCase()} successfully`,
        kiteAccount: {
          id: kiteAccount.id,
          status: kiteAccount.status,
        },
      };

    } catch (error) {
      logger.error('Error updating account status:', error);
      throw error;
    }
  }

  /**
   * Disconnect Kite account
   * @param {string} userId - User ID
   * @param {string} kiteAccountId - Kite account ID
   * @param {string} ip - IP address
   * @returns {Promise<Object>}
   */
  async disconnectKiteAccount(userId, kiteAccountId, ip = null) {
    try {
      logger.info(`Disconnecting Kite account: ${kiteAccountId}`);

      const kiteAccount = await KiteAccount.findOne({
        where: {
          id: kiteAccountId,
          userId,
        },
      });

      if (!kiteAccount) {
        throw new NotFoundError('Kite account not found');
      }

      // Delete the account
      await kiteAccount.destroy();

      // Remove from cache
      await cache.del(`${this.tokenExpiryCache}${kiteAccountId}`);

      // Audit log
      await auditQueue.add('kite_account_disconnected', {
        event: SYSTEM.AUDIT_EVENT.CONFIG_CHANGED,
        userId,
        source: 'BROKER',
        ip,
        payload: {
          kiteAccountId: kiteAccount.id,
          action: 'KITE_ACCOUNT_DISCONNECTED',
        },
        result: 'SUCCESS',
      });

      return {
        success: true,
        message: 'Kite account disconnected successfully',
      };

    } catch (error) {
      logger.error('Error disconnecting Kite account:', error);
      throw error;
    }
  }

  /**
   * Generate Kite login URL
   * @param {string} apiKey - API Key
   * @returns {string} - Login URL
   */
  generateLoginUrl(apiKey) {
    return `${this.kiteLoginUrl}?api_key=${apiKey}&v=3`;
  }

  /**
   * Calculate token expiry time (6 AM next day IST)
   * @returns {Date} - Expiry date
   */
  calculateTokenExpiry() {
    const now = new Date();
    
    // Convert to IST (UTC+5:30)
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istNow = new Date(now.getTime() + istOffset);
    
    // Set to next 6 AM IST
    const expiry = new Date(istNow);
    expiry.setHours(6, 0, 0, 0);
    
    // If current time is past 6 AM, set to next day 6 AM
    if (istNow.getHours() >= 6) {
      expiry.setDate(expiry.getDate() + 1);
    }
    
    // Convert back to UTC
    const expiryUTC = new Date(expiry.getTime() - istOffset);
    
    return expiryUTC;
  }

  /**
   * Cache token expiry for quick checks
   * @param {string} kiteAccountId - Kite account ID
   * @param {Date} expiresAt - Expiry date
   */
  async cacheTokenExpiry(kiteAccountId, expiresAt) {
    const key = `${this.tokenExpiryCache}${kiteAccountId}`;
    const ttl = Math.floor((expiresAt - new Date()) / 1000);
    
    if (ttl > 0) {
      await cache.set(key, { expiresAt }, ttl);
    }
  }

  /**
   * Schedule token expiry notification
   * @param {string} userId - User ID
   * @param {string} kiteAccountId - Kite account ID
   * @param {Date} expiresAt - Expiry date
   */
  async scheduleTokenExpiryNotification(userId, kiteAccountId, expiresAt) {
    // TODO: Implement notification scheduling
    // Options:
    // 1. Schedule email/SMS notification 1 hour before expiry
    // 2. Create a notification record in database
    // 3. Use a job scheduler (BullMQ delayed job)
    
    logger.info(`Token expiry notification scheduled for account ${kiteAccountId} at ${expiresAt}`);
  }

  /**
   * Auto-check and update expired tokens (to be run as cron job)
   * @returns {Promise<Object>} - Results
   */
  async checkAndUpdateExpiredTokens() {
    try {
      logger.info('Checking for expired Kite tokens...');

      const now = new Date();
      
      const expiredAccounts = await KiteAccount.findAll({
        where: {
          status: 'ACTIVE',
          tokenExpiresAt: {
            [require('sequelize').Op.lte]: now,
          },
        },
      });

      let updatedCount = 0;

      for (const account of expiredAccounts) {
        await account.update({ status: 'EXPIRED' });
        updatedCount++;
        
        logger.warn(`Kite account ${account.id} marked as expired`);
        
        // TODO: Send notification to user
      }

      logger.info(`Updated ${updatedCount} expired Kite accounts`);

      return {
        success: true,
        expiredCount: updatedCount,
      };

    } catch (error) {
      logger.error('Error checking expired tokens:', error);
      throw error;
    }
  }
}

module.exports = BrokerService;