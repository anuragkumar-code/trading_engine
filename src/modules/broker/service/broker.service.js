const { KiteAccount } = require('../../../infrastructure/database/models');
const { KiteClient } = require('../../../infrastructure/http');
const { encryption } = require('../../../shared/utils');
const { cache } = require('../../../infrastructure/redis');
const { auditQueue } = require('../../../infrastructure/queue');
const logger = require('../../../infrastructure/logger');
const axios = require('axios');
const crypto = require('crypto');
const qs = require('qs');

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
    
    // Platform-wide Kite API credentials (from env/config)
    this.apiKey = config.app.kite.apiKey;
    this.apiSecret = config.app.kite.apiSecret;

    // Validate credentials on initialization
    if (!this.apiKey || !this.apiSecret) {
      logger.error('Kite API credentials not configured in environment');
      throw new Error('KITE_API_KEY and KITE_API_SECRET must be set in environment variables');
    }

    logger.info('BrokerService initialized with platform Kite credentials');
  }

  /**
   * Initiate Kite login (Step 1: Generate login URL)
   * @param {string} userId - User ID
   * @param {string} ip - IP address
   * @returns {Promise<Object>} - Login URL and instructions
   */
  async initiateKiteLogin(userId, ip = null) {
    try {
      logger.info(`Initiating Kite login for user: ${userId}`);

      // Check if user already has an active Kite account
      const existingAccount = await KiteAccount.findOne({
        where: { userId },
      });

      if (existingAccount && existingAccount.status === 'ACTIVE') {
        // Check if token is still valid
        const now = new Date();
        if (existingAccount.tokenExpiresAt && existingAccount.tokenExpiresAt > now) {
          throw new ConflictError('You already have an active Kite session. Please wait for it to expire or disconnect first.');
        }
      }

      // Create or get inactive Kite account record
      let kiteAccount;
      if (existingAccount) {
        kiteAccount = existingAccount;
        await kiteAccount.update({ status: 'INACTIVE' });
      } else {
        kiteAccount = await KiteAccount.create({
          userId,
          status: 'INACTIVE',
        });
      }

      logger.info(`Kite account record prepared: ${kiteAccount.id}`);

      // Generate login URL using platform API key
      const loginUrl = this.generateLoginUrl();

      // Audit log
      await auditQueue.add('kite_login_initiated', {
        event: SYSTEM.AUDIT_EVENT.CONFIG_CHANGED,
        userId,
        source: 'BROKER',
        ip,
        payload: {
          kiteAccountId: kiteAccount.id,
          action: 'KITE_LOGIN_INITIATED',
        },
        result: 'SUCCESS',
      });

      return {
        success: true,
        message: 'Kite login initiated. Please complete the login process.',
        kiteAccount: {
          id: kiteAccount.id,
          status: kiteAccount.status,
        },
        loginUrl,
        instructions: [
          '1. Click on the login URL below',
          '2. Login to your Zerodha account',
          '3. After successful login, you will be redirected with a request_token',
          '4. Copy the request_token from the URL and use it to generate your session',
        ],
      };

    } catch (error) {
      logger.error('Error initiating Kite login:', error);
      throw error;
    }
  }

  /**
   * Generate session (Step 2: Exchange request token for access token)
   * @param {string} userId - User ID
   * @param {string} requestToken - Request token from Kite redirect
   * @param {string} ip - IP address
   * @returns {Promise<Object>} - Session details
   */
  async generateSession(userId, requestToken, ip = null) {
    try {
      logger.info(`Generating Kite session for user: ${userId}`);

      // Get or create Kite account
      let kiteAccount = await KiteAccount.findOne({
        where: { userId },
      });

      if (!kiteAccount) {
        // Create if doesn't exist (edge case)
        kiteAccount = await KiteAccount.create({
          userId,
          status: 'INACTIVE',
        });
      }

      // Generate checksum: SHA-256(api_key + request_token + api_secret)
      const checksum = crypto
        .createHash('sha256')
        .update(this.apiKey + requestToken + this.apiSecret)
        .digest('hex');

      logger.info('Checksum generated for Kite session');

      // Exchange request token for access token
      const payload = qs.stringify({
        api_key: this.apiKey,
        request_token: requestToken,
        checksum: checksum,
      });

      const response = await axios.post(
        this.kiteSessionUrl,
        payload,
        {
          headers: {
            'X-Kite-Version': '3',
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      if (!response.data || !response.data.data) {
        throw new InternalServerError('Failed to generate session with Kite');
      }

      const sessionData = response.data.data;
      const accessToken = sessionData.access_token;
      const refreshToken = sessionData.refresh_token || null;

      logger.info('Kite session tokens received successfully');

      // Encrypt tokens before storing
      const encryptedAccessToken = encryption.encrypt(accessToken);
      const encryptedRefreshToken = refreshToken ? encryption.encrypt(refreshToken) : null;

      // Calculate token expiry (6 AM next day IST)
      const tokenExpiresAt = this.calculateTokenExpiry();

      // Update Kite account with tokens
      await kiteAccount.update({
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        tokenExpiresAt,
        status: 'ACTIVE',
        lastLoginAt: new Date(),
      });

      logger.info(`Kite session generated successfully for user: ${userId}`);

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
        message: 'Kite session generated successfully. You can now start trading!',
        kiteAccount: {
          id: kiteAccount.id,
          status: kiteAccount.status,
          tokenExpiresAt,
          expiresIn: this.getTimeRemaining(tokenExpiresAt),
        },
      };

    } catch (error) {
      logger.error('Error generating Kite session:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
      });
      
      if (error.response?.data) {
        throw new BadRequestError(
          `Kite API Error: ${error.response.data.message || 'Failed to generate session. Please check your request token.'}`
        );
      }
      
      throw error;
    }
  }

  /**
   * Refresh Kite token (User action when token expires)
   * @param {string} userId - User ID
   * @param {string} ip - IP address
   * @returns {Promise<Object>} - New login URL
   */
  async refreshKiteToken(userId, ip = null) {
    try {
      logger.info(`Refreshing Kite token for user: ${userId}`);

      const kiteAccount = await KiteAccount.findOne({
        where: { userId },
      });

      if (!kiteAccount) {
        throw new NotFoundError('Kite account not found. Please initiate login first.');
      }

      // Generate new login URL
      const loginUrl = this.generateLoginUrl();

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
          '1. Click on the login URL below',
          '2. Login to your Zerodha account',
          '3. After successful login, copy the request_token from URL',
          '4. Use the request_token to generate new session',
        ],
      };

    } catch (error) {
      logger.error('Error refreshing Kite token:', error);
      throw error;
    }
  }

  /**
   * Check token status for user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} - Token status
   */
  async checkTokenStatus(userId) {
    try {
      const kiteAccount = await KiteAccount.findOne({
        where: { userId },
      });

      if (!kiteAccount) {
        return {
          success: true,
          hasAccount: false,
          message: 'No Kite account found. Please initiate login.',
        };
      }

      const now = new Date();
      const isExpired = kiteAccount.tokenExpiresAt 
        ? kiteAccount.tokenExpiresAt <= now 
        : true;

      if (isExpired && kiteAccount.status === 'ACTIVE') {
        // Auto-mark as expired
        await kiteAccount.update({ status: 'EXPIRED' });

        return {
          success: true,
          hasAccount: true,
          isExpired: true,
          status: 'EXPIRED',
          message: 'Token has expired. Please refresh your token.',
          kiteAccountId: kiteAccount.id,
        };
      }

      // Calculate time remaining
      const timeRemaining = kiteAccount.tokenExpiresAt 
        ? this.getTimeRemaining(kiteAccount.tokenExpiresAt)
        : null;

      return {
        success: true,
        hasAccount: true,
        isExpired: false,
        status: kiteAccount.status,
        expiresAt: kiteAccount.tokenExpiresAt,
        timeRemaining,
        lastLoginAt: kiteAccount.lastLoginAt,
        message: kiteAccount.status === 'ACTIVE' 
          ? `Token is valid. ${timeRemaining}` 
          : 'Please generate a new session.',
      };

    } catch (error) {
      logger.error('Error checking token status:', error);
      throw error;
    }
  }

  /**
   * Get user's Kite account
   * @param {string} userId - User ID
   * @returns {Promise<Object>} - Kite account details
   */
  async getKiteAccount(userId) {
    try {
      const kiteAccount = await KiteAccount.findOne({
        where: { userId },
        attributes: ['id', 'status', 'tokenExpiresAt', 'lastLoginAt', 'createdAt', 'updatedAt'],
      });

      if (!kiteAccount) {
        return {
          success: true,
          hasAccount: false,
          message: 'No Kite account found',
        };
      }

      const now = new Date();
      const isExpired = kiteAccount.tokenExpiresAt 
        ? kiteAccount.tokenExpiresAt <= now 
        : true;

      return {
        success: true,
        hasAccount: true,
        kiteAccount: {
          id: kiteAccount.id,
          status: kiteAccount.status,
          tokenExpiresAt: kiteAccount.tokenExpiresAt,
          isExpired,
          timeRemaining: kiteAccount.tokenExpiresAt 
            ? this.getTimeRemaining(kiteAccount.tokenExpiresAt)
            : null,
          lastLoginAt: kiteAccount.lastLoginAt,
          createdAt: kiteAccount.createdAt,
          updatedAt: kiteAccount.updatedAt,
        },
      };

    } catch (error) {
      logger.error('Error getting Kite account:', error);
      throw error;
    }
  }

  /**
   * Disconnect Kite account
   * @param {string} userId - User ID
   * @param {string} ip - IP address
   * @returns {Promise<Object>}
   */
  async disconnectKiteAccount(userId, ip = null) {
    try {
      logger.info(`Disconnecting Kite account for user: ${userId}`);

      const kiteAccount = await KiteAccount.findOne({
        where: { userId },
      });

      if (!kiteAccount) {
        throw new NotFoundError('Kite account not found');
      }

      // Delete the account
      await kiteAccount.destroy();

      // Remove from cache
      await cache.del(`${this.tokenExpiryCache}${kiteAccount.id}`);

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
   * Generate Kite login URL using platform API key
   * @returns {string} - Login URL with redirect
   */
  generateLoginUrl() {
    const redirectUrl = config.app.kite.redirectUrl;
    
    // Important: URL encode the redirect URL
    const encodedRedirectUrl = encodeURIComponent(redirectUrl);
    
    return `${this.kiteLoginUrl}?api_key=${this.apiKey}&v=3&redirect_params=${encodedRedirectUrl}`;
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
   * Get time remaining until expiry in human-readable format
   * @param {Date} expiresAt - Expiry date
   * @returns {string} - Time remaining
   */
  getTimeRemaining(expiresAt) {
    const now = new Date();
    const diff = expiresAt - now;

    if (diff <= 0) {
      return 'Expired';
    }

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `Expires in ${hours} hour${hours > 1 ? 's' : ''} ${minutes} minute${minutes !== 1 ? 's' : ''}`;
    } else {
      return `Expires in ${minutes} minute${minutes !== 1 ? 's' : ''}`;
    }
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
      await cache.set(key, { expiresAt: expiresAt.toISOString() }, ttl);
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
    // 3. Use BullMQ delayed job
    
    logger.info(`Token expiry notification scheduled for user ${userId} at ${expiresAt}`);
  }

  /**
   * Auto-check and update expired tokens (Cron job)
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
        
        logger.warn(`Kite account ${account.id} (userId: ${account.userId}) marked as expired`);
        
        // TODO: Send notification to user
        // await notificationService.send(account.userId, 'KITE_TOKEN_EXPIRED', {...});
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