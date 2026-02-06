const SignalService = require('../service/signal.service');
const SignalSourceService = require('../service/signalsource.service');
const { TradeIntent } = require('../../../infrastructure/database/models');
const logger = require('../../../infrastructure/logger');
const { hash } = require('../../../shared/utils');
const { UnauthorizedError, BadRequestError } = require('../../../shared/errors');
const { ORDER } = require('../../../shared/constants');
const { Op } = require('sequelize');

class SignalController {
  constructor() {
    this.signalService = new SignalService();
    this.signalSourceService = new SignalSourceService();
  }

  // ==================== Signal Sources Management ====================

  /**
   * Create signal source
   * POST /api/v1/signals/sources
   */
  createSignalSource = async (req, res, next) => {
    try {
      const ip = req.ip || req.connection.remoteAddress;

      const result = await this.signalSourceService.createSignalSource(
        req.userId,
        req.body,
        ip
      );

      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get signal sources
   * GET /api/v1/signals/sources
   */
  getSignalSources = async (req, res, next) => {
    try {
      const filters = {
        type: req.query.type,
        status: req.query.status,
      };

      const options = {
        limit: parseInt(req.query.limit) || 20,
        offset: parseInt(req.query.offset) || 0,
      };

      const result = await this.signalSourceService.getSignalSources(
        req.userId,
        filters,
        options
      );

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get signal source by ID
   * GET /api/v1/signals/sources/:id
   */
  getSignalSourceById = async (req, res, next) => {
    try {
      const { id } = req.params;

      const result = await this.signalSourceService.getSignalSourceById(
        id,
        req.userId
      );

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Update signal source
   * PUT /api/v1/signals/sources/:id
   */
  updateSignalSource = async (req, res, next) => {
    try {
      const { id } = req.params;
      const ip = req.ip || req.connection.remoteAddress;

      const result = await this.signalSourceService.updateSignalSource(
        id,
        req.userId,
        req.body,
        ip
      );

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Delete signal source
   * DELETE /api/v1/signals/sources/:id
   */
  deleteSignalSource = async (req, res, next) => {
    try {
      const { id } = req.params;
      const ip = req.ip || req.connection.remoteAddress;

      const result = await this.signalSourceService.deleteSignalSource(
        id,
        req.userId,
        ip
      );

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  // ==================== Signal Processing (API) ====================

  /**
   * Process signal via API
   * POST /api/v1/signals/process
   */
  processSignalApi = async (req, res, next) => {
    try {
      const ip = req.ip || req.connection.remoteAddress;

      const result = await this.signalService.processSignal(
        req.body,
        req.userId,
        ORDER.SIGNAL_SOURCE.API,
        ip
      );

      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  };

  // ==================== Webhooks ====================

  /**
   * Telegram webhook
   * POST /api/v1/signals/webhooks/telegram/:sourceId
   */
  telegramWebhook = async (req, res, next) => {
    try {
      const { sourceId } = req.params;
      const webhookSecret = req.headers['x-telegram-bot-api-secret-token'];
      const ip = req.ip || req.connection.remoteAddress;

      // Verify webhook secret
      const signalSource = await this.verifyWebhookSecret(sourceId, webhookSecret);

      // Extract message text
      const messageText = req.body?.message?.text;
      if (!messageText) {
        throw new BadRequestError('No message text found in webhook');
      }

      // Process signal
      const result = await this.signalService.processSignal(
        { text: messageText },
        signalSource.userId,
        ORDER.SIGNAL_SOURCE.TELEGRAM,
        ip
      );

      res.status(200).json({ success: true });
    } catch (error) {
      logger.error('Telegram webhook error:', error);
      // Always return 200 to Telegram to avoid retries
      res.status(200).json({ success: false, error: error.message });
    }
  };

  /**
   * Google Sheets webhook
   * POST /api/v1/signals/webhooks/sheets/:sourceId
   */
  googleSheetsWebhook = async (req, res, next) => {
    try {
      const { sourceId } = req.params;
      const webhookSecret = req.headers['x-webhook-secret'];
      const ip = req.ip || req.connection.remoteAddress;

      // Verify webhook secret
      const signalSource = await this.verifyWebhookSecret(sourceId, webhookSecret);

      // Process signal
      const result = await this.signalService.processSignal(
        req.body,
        signalSource.userId,
        ORDER.SIGNAL_SOURCE.GOOGLE_SHEETS,
        ip
      );

      res.status(200).json({ success: true, tradeIntentId: result.tradeIntent.id });
    } catch (error) {
      logger.error('Google Sheets webhook error:', error);
      res.status(400).json({ success: false, error: error.message });
    }
  };

  /**
   * Generic API webhook
   * POST /api/v1/signals/webhooks/api/:sourceId
   */
  apiWebhook = async (req, res, next) => {
    try {
      const { sourceId } = req.params;
      const webhookSecret = req.headers['x-api-secret'];
      const ip = req.ip || req.connection.remoteAddress;

      // Verify webhook secret
      const signalSource = await this.verifyWebhookSecret(sourceId, webhookSecret);

      // Process signal
      const result = await this.signalService.processSignal(
        req.body,
        signalSource.userId,
        ORDER.SIGNAL_SOURCE.API,
        ip
      );

      res.status(200).json({ success: true, tradeIntentId: result.tradeIntent.id });
    } catch (error) {
      logger.error('API webhook error:', error);
      res.status(400).json({ success: false, error: error.message });
    }
  };

  // ==================== Trade Intents ====================

  /**
   * Get trade intents
   * GET /api/v1/signals/intents
   */
  getTradeIntents = async (req, res, next) => {
    try {
      const where = { userId: req.userId };

      // Status filter
      if (req.query.status) {
        where.status = req.query.status;
      }

      // Date range filter
      if (req.query.startDate || req.query.endDate) {
        where.createdAt = {};
        
        if (req.query.startDate) {
          where.createdAt[Op.gte] = new Date(req.query.startDate);
        }
        
        if (req.query.endDate) {
          where.createdAt[Op.lte] = new Date(req.query.endDate);
        }
      }

      // Pagination
      const limit = parseInt(req.query.limit) || 20;
      const offset = parseInt(req.query.offset) || 0;

      const { count, rows } = await TradeIntent.findAndCountAll({
        where,
        include: [
          {
            association: 'signalSource',
            attributes: ['id', 'name', 'type'],
          },
          {
            association: 'strategy',
            attributes: ['id', 'name'],
          },
        ],
        limit,
        offset,
        order: [['createdAt', 'DESC']],
      });

      // Calculate pagination metadata
      const totalPages = Math.ceil(count / limit);
      const currentPage = Math.floor(offset / limit) + 1;

      res.status(200).json({
        success: true,
        tradeIntents: rows,
        pagination: {
          total: count,
          limit,
          offset,
          currentPage,
          totalPages,
          hasNext: currentPage < totalPages,
          hasPrev: currentPage > 1,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get trade intent by ID
   * GET /api/v1/signals/intents/:id
   */
  getTradeIntentById = async (req, res, next) => {
    try {
      const { id } = req.params;

      const tradeIntent = await TradeIntent.findOne({
        where: {
          id,
          userId: req.userId,
        },
        include: [
          {
            association: 'signalSource',
            attributes: ['id', 'name', 'type'],
          },
          {
            association: 'strategy',
            attributes: ['id', 'name'],
          },
          {
            association: 'orders',
            attributes: ['id', 'status', 'orderType', 'quantity', 'price'],
          },
        ],
      });

      if (!tradeIntent) {
        throw new NotFoundError('Trade intent not found');
      }

      res.status(200).json({
        success: true,
        tradeIntent,
      });
    } catch (error) {
      next(error);
    }
  };

  // ==================== Helper Methods ====================

  /**
   * Verify webhook secret
   * @param {string} sourceId - Signal source ID
   * @param {string} webhookSecret - Provided webhook secret
   * @returns {Promise<Object>} - Signal source
   */
  async verifyWebhookSecret(sourceId, webhookSecret) {
    if (!webhookSecret) {
      throw new UnauthorizedError('Webhook secret is required');
    }

    const { SignalSource } = require('../../../infrastructure/database/models');
    
    const signalSource = await SignalSource.findByPk(sourceId);

    if (!signalSource) {
      throw new UnauthorizedError('Invalid signal source');
    }

    if (signalSource.status !== 'ACTIVE') {
      throw new UnauthorizedError('Signal source is not active');
    }

    // Verify webhook secret
    const isValid = hash.compareApiKey(webhookSecret, signalSource.webhookSecretHash);

    if (!isValid) {
      throw new UnauthorizedError('Invalid webhook secret');
    }

    return signalSource;
  }
}

module.exports = SignalController;