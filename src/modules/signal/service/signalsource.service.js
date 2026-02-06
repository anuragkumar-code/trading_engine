const { SignalSource, User, TradeIntent } = require('../../../infrastructure/database/models');
const { auditQueue } = require('../../../infrastructure/queue');
const logger = require('../../../infrastructure/logger');
const { encryption, hash } = require('../../../shared/utils');
const crypto = require('crypto');
const {
  NotFoundError,
  ConflictError,
  BadRequestError,
} = require('../../../shared/errors');
const { SYSTEM, ORDER } = require('../../../shared/constants');
const { Op } = require('sequelize');

class SignalSourceService {
  /**
   * Create signal source
   * @param {string} userId - User ID
   * @param {Object} data - Signal source data
   * @param {string} ip - IP address
   * @returns {Promise<Object>} - Created signal source
   */
  async createSignalSource(userId, data, ip = null) {
    try {
      logger.info(`Creating signal source for user: ${userId}`, { 
        name: data.name,
        type: data.type 
      });

      // Check if source with same name already exists
      const existingSource = await SignalSource.findOne({
        where: {
          userId,
          name: data.name,
        },
      });

      if (existingSource) {
        throw new ConflictError('Signal source with this name already exists');
      }

      // Generate webhook secret if not provided
      let webhookSecret = data.webhookSecret;
      if (!webhookSecret) {
        webhookSecret = crypto.randomBytes(32).toString('hex');
      }

      // Hash webhook secret for storage
      const webhookSecretHash = hash.hashApiKey(webhookSecret);

      // Encrypt sensitive config data if present
      let encryptedConfig = data.config || {};
      if (data.config?.botToken) {
        encryptedConfig.botToken = encryption.encrypt(data.config.botToken);
      }
      if (data.config?.apiKey) {
        encryptedConfig.apiKey = encryption.encrypt(data.config.apiKey);
      }

      // Create signal source
      const signalSource = await SignalSource.create({
        userId,
        name: data.name,
        type: data.type,
        config: encryptedConfig,
        webhookSecretHash,
        status: data.status || 'ACTIVE',
      });

      logger.info(`Signal source created: ${signalSource.id}`, { 
        userId, 
        name: signalSource.name,
        type: signalSource.type 
      });

      // Audit log
      await auditQueue.add('signal_source_created', {
        event: SYSTEM.AUDIT_EVENT.CONFIG_CHANGED,
        userId,
        source: 'SIGNAL',
        ip,
        payload: {
          signalSourceId: signalSource.id,
          action: 'SIGNAL_SOURCE_CREATED',
          name: signalSource.name,
          type: signalSource.type,
        },
        result: 'SUCCESS',
      });

      // Return with plain webhook secret (only shown once)
      return {
        success: true,
        message: 'Signal source created successfully',
        signalSource: {
          ...signalSource.toJSON(),
          webhookSecret, // Plain secret - save this!
        },
        warning: 'Save the webhook secret securely. It will not be shown again.',
      };

    } catch (error) {
      logger.error('Error creating signal source:', error);
      throw error;
    }
  }

  /**
   * Get user's signal sources
   * @param {string} userId - User ID
   * @param {Object} filters - Query filters
   * @param {Object} options - Pagination options
   * @returns {Promise<Object>} - Signal sources with pagination
   */
  async getSignalSources(userId, filters = {}, options = {}) {
    try {
      const where = { userId };

      // Type filter
      if (filters.type) {
        where.type = filters.type;
      }

      // Status filter
      if (filters.status) {
        where.status = filters.status;
      }

      // Pagination
      const limit = options.limit || 20;
      const offset = options.offset || 0;

      // Query signal sources
      const { count, rows } = await SignalSource.findAndCountAll({
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

      // Decrypt sensitive config for display (mask partially)
      const sanitizedRows = rows.map(source => {
        const sourceData = source.toJSON();
        
        // Remove webhook secret hash
        delete sourceData.webhookSecretHash;
        
        // Mask sensitive config
        if (sourceData.config?.botToken) {
          sourceData.config.botToken = '••••••••';
        }
        if (sourceData.config?.apiKey) {
          sourceData.config.apiKey = '••••••••';
        }
        
        return sourceData;
      });

      // Calculate pagination metadata
      const totalPages = Math.ceil(count / limit);
      const currentPage = Math.floor(offset / limit) + 1;

      return {
        success: true,
        signalSources: sanitizedRows,
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
      logger.error('Error getting signal sources:', error);
      throw error;
    }
  }

  /**
   * Get signal source by ID
   * @param {string} sourceId - Signal source ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} - Signal source
   */
  async getSignalSourceById(sourceId, userId) {
    try {
      const signalSource = await SignalSource.findOne({
        where: {
          id: sourceId,
          userId,
        },
        include: [
          {
            association: 'user',
            attributes: ['id', 'email', 'firstName', 'lastName'],
          },
        ],
      });

      if (!signalSource) {
        throw new NotFoundError('Signal source not found');
      }

      // Sanitize response
      const sourceData = signalSource.toJSON();
      delete sourceData.webhookSecretHash;
      
      if (sourceData.config?.botToken) {
        sourceData.config.botToken = '••••••••';
      }
      if (sourceData.config?.apiKey) {
        sourceData.config.apiKey = '••••••••';
      }

      return {
        success: true,
        signalSource: sourceData,
      };

    } catch (error) {
      logger.error('Error getting signal source by ID:', error);
      throw error;
    }
  }

  /**
   * Update signal source
   * @param {string} sourceId - Signal source ID
   * @param {string} userId - User ID
   * @param {Object} data - Update data
   * @param {string} ip - IP address
   * @returns {Promise<Object>} - Updated signal source
   */
  async updateSignalSource(sourceId, userId, data, ip = null) {
    try {
      const signalSource = await SignalSource.findOne({
        where: {
          id: sourceId,
          userId,
        },
      });

      if (!signalSource) {
        throw new NotFoundError('Signal source not found');
      }

      // Check if name is being changed and if it already exists
      if (data.name && data.name !== signalSource.name) {
        const existingSource = await SignalSource.findOne({
          where: {
            userId,
            name: data.name,
            id: { [Op.ne]: sourceId },
          },
        });

        if (existingSource) {
          throw new ConflictError('Signal source with this name already exists');
        }
      }

      // Prepare update data
      const updateData = {};
      
      if (data.name !== undefined) updateData.name = data.name;
      if (data.status !== undefined) updateData.status = data.status;
      
      // Update config
      if (data.config !== undefined) {
        const currentConfig = signalSource.config || {};
        const newConfig = { ...currentConfig, ...data.config };
        
        // Encrypt sensitive fields
        if (data.config.botToken) {
          newConfig.botToken = encryption.encrypt(data.config.botToken);
        }
        if (data.config.apiKey) {
          newConfig.apiKey = encryption.encrypt(data.config.apiKey);
        }
        
        updateData.config = newConfig;
      }
      
      // Update webhook secret
      if (data.webhookSecret !== undefined) {
        updateData.webhookSecretHash = hash.hashApiKey(data.webhookSecret);
      }

      await signalSource.update(updateData);

      logger.info(`Signal source updated: ${sourceId}`, { 
        userId, 
        updatedFields: Object.keys(updateData) 
      });

      // Audit log
      await auditQueue.add('signal_source_updated', {
        event: SYSTEM.AUDIT_EVENT.CONFIG_CHANGED,
        userId,
        source: 'SIGNAL',
        ip,
        payload: {
          signalSourceId: sourceId,
          action: 'SIGNAL_SOURCE_UPDATED',
          fields: Object.keys(updateData),
        },
        result: 'SUCCESS',
      });

      // Sanitize response
      const sourceData = signalSource.toJSON();
      delete sourceData.webhookSecretHash;
      
      if (sourceData.config?.botToken) {
        sourceData.config.botToken = '••••••••';
      }
      if (sourceData.config?.apiKey) {
        sourceData.config.apiKey = '••••••••';
      }

      return {
        success: true,
        message: 'Signal source updated successfully',
        signalSource: sourceData,
      };

    } catch (error) {
      logger.error('Error updating signal source:', error);
      throw error;
    }
  }

  /**
   * Delete signal source
   * @param {string} sourceId - Signal source ID
   * @param {string} userId - User ID
   * @param {string} ip - IP address
   * @returns {Promise<Object>}
   */
  async deleteSignalSource(sourceId, userId, ip = null) {
    try {
      const signalSource = await SignalSource.findOne({
        where: {
          id: sourceId,
          userId,
        },
      });

      if (!signalSource) {
        throw new NotFoundError('Signal source not found');
      }

      // Check if source has pending trade intents
      const pendingIntents = await TradeIntent.count({
        where: {
          signalSourceId: sourceId,
          status: { [Op.in]: ['PENDING', 'APPROVED'] },
        },
      });

      if (pendingIntents > 0) {
        throw new BadRequestError('Cannot delete signal source with pending trade intents');
      }

      const sourceName = signalSource.name;
      const sourceType = signalSource.type;

      await signalSource.destroy();

      logger.info(`Signal source deleted: ${sourceId}`, { userId, name: sourceName });

      // Audit log
      await auditQueue.add('signal_source_deleted', {
        event: SYSTEM.AUDIT_EVENT.CONFIG_CHANGED,
        userId,
        source: 'SIGNAL',
        ip,
        payload: {
          signalSourceId: sourceId,
          action: 'SIGNAL_SOURCE_DELETED',
          name: sourceName,
          type: sourceType,
        },
        result: 'SUCCESS',
      });

      return {
        success: true,
        message: 'Signal source deleted successfully',
      };

    } catch (error) {
      logger.error('Error deleting signal source:', error);
      throw error;
    }
  }

  /**
   * Generate webhook URL for signal source
   * @param {string} sourceId - Signal source ID
   * @param {string} type - Signal source type
   * @returns {string} - Webhook URL
   */
  generateWebhookUrl(sourceId, type) {
    const baseUrl = process.env.APP_URL || 'http://localhost:3000';
    
    switch (type) {
      case ORDER.SIGNAL_SOURCE.TELEGRAM:
        return `${baseUrl}/api/v1/signals/webhooks/telegram/${sourceId}`;
      case ORDER.SIGNAL_SOURCE.GOOGLE_SHEETS:
        return `${baseUrl}/api/v1/signals/webhooks/sheets/${sourceId}`;
      case ORDER.SIGNAL_SOURCE.API:
        return `${baseUrl}/api/v1/signals/webhooks/api/${sourceId}`;
      default:
        return null;
    }
  }
}

module.exports = SignalSourceService;