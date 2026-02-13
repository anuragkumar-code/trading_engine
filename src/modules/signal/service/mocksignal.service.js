const { TradeIntent, Strategy, SignalSource } = require('../../../infrastructure/database/models');
const { riskQueue, auditQueue } = require('../../../infrastructure/queue');
const logger = require('../../../infrastructure/logger');
const KillSwitchService = require('../../risk/service/killswitch.service');
const { BadRequestError, NotFoundError } = require('../../../shared/errors');
const { SYSTEM, ORDER } = require('../../../shared/constants');

class MockSignalService {
  constructor() {
    this.killSwitchService = new KillSwitchService();
  }

  /**
   * Create mock signal for testing
   * This simulates receiving a signal from external source
   * 
   * @param {string} userId - User ID
   * @param {Object} signalData - Signal data
   * @param {string} ip - IP address
   * @returns {Promise<Object>} - Created trade intent
   */
  async createMockSignal(userId, signalData, ip = null) {
    try {
      logger.info('Creating mock signal for testing', { userId, signalData });

      // 1. Check kill switch
      await this.killSwitchService.enforce();

      // 2. Normalize signal data
      const normalizedSignal = this.normalizeSignal(signalData);

      // 3. Validate signal
      this.validateSignal(normalizedSignal);

      // 4. Get or create mock signal source
      const signalSource = await this.getOrCreateMockSignalSource(userId);

      // 5. Resolve strategy (if provided)
      let strategy = null;
      if (normalizedSignal.strategyId) {
        strategy = await Strategy.findOne({
          where: {
            id: normalizedSignal.strategyId,
            userId,
          },
        });

        if (!strategy) {
          throw new NotFoundError('Strategy not found');
        }
      }

      // 6. Create trade intent
      const tradeIntent = await TradeIntent.create({
        userId,
        signalSourceId: signalSource.id,
        strategyId: strategy?.id,
        symbol: normalizedSignal.symbol,
        exchange: normalizedSignal.exchange,
        transactionType: normalizedSignal.transactionType,
        orderType: normalizedSignal.orderType,
        productType: normalizedSignal.productType,
        quantity: normalizedSignal.quantity,
        price: normalizedSignal.price || null,
        triggerPrice: normalizedSignal.triggerPrice || null,
        validity: normalizedSignal.validity || 'DAY',
        status: 'PENDING',
        metadata: {
          source: 'MOCK',
          isMockSignal: true,
          ...normalizedSignal.metadata,
        },
      });

      logger.info(`Trade intent created from mock signal: ${tradeIntent.id}`);

      // 7. Queue for risk check
      await riskQueue.add('risk_check', {
        tradeIntentId: tradeIntent.id,
        userId,
      });

      // 8. Audit log
      await auditQueue.add('mock_signal_created', {
        event: SYSTEM.AUDIT_EVENT.SIGNAL_RECEIVED,
        userId,
        source: 'SIGNAL',
        ip,
        payload: {
          tradeIntentId: tradeIntent.id,
          action: 'MOCK_SIGNAL_CREATED',
          signal: normalizedSignal,
        },
        result: 'SUCCESS',
      });

      return {
        success: true,
        message: 'Mock signal created and queued for processing',
        tradeIntent: {
          id: tradeIntent.id,
          status: tradeIntent.status,
          symbol: tradeIntent.symbol,
          transactionType: tradeIntent.transactionType,
          quantity: tradeIntent.quantity,
        },
      };

    } catch (error) {
      logger.error('Error creating mock signal:', error);
      throw error;
    }
  }

  /**
   * Normalize signal from any source to standard format
   * @param {Object} signal - Raw signal data
   * @returns {Object} - Normalized signal
   */
  normalizeSignal(signal) {
    return {
      symbol: String(signal.symbol).toUpperCase().trim(),
      exchange: String(signal.exchange).toUpperCase(),
      transactionType: String(signal.transactionType).toUpperCase(),
      quantity: parseInt(signal.quantity),
      orderType: signal.orderType || 'MARKET',
      productType: signal.productType || 'MIS',
      price: signal.price ? parseFloat(signal.price) : null,
      triggerPrice: signal.triggerPrice ? parseFloat(signal.triggerPrice) : null,
      validity: signal.validity || 'DAY',
      strategyId: signal.strategyId || null,
      metadata: signal.metadata || {},
    };
  }

  /**
   * Validate normalized signal
   * @param {Object} signal - Normalized signal
   */
  validateSignal(signal) {
    // Required fields
    if (!signal.symbol) {
      throw new BadRequestError('Symbol is required');
    }

    if (!signal.exchange) {
      throw new BadRequestError('Exchange is required');
    }

    if (!Object.values(ORDER.EXCHANGE).includes(signal.exchange)) {
      throw new BadRequestError(`Invalid exchange. Must be one of: ${Object.values(ORDER.EXCHANGE).join(', ')}`);
    }

    if (!signal.transactionType) {
      throw new BadRequestError('Transaction type is required');
    }

    if (!Object.values(ORDER.TRANSACTION_TYPE).includes(signal.transactionType)) {
      throw new BadRequestError('Transaction type must be BUY or SELL');
    }

    if (!signal.quantity || signal.quantity <= 0) {
      throw new BadRequestError('Quantity must be greater than 0');
    }

    if (!Object.values(ORDER.ORDER_TYPE).includes(signal.orderType)) {
      throw new BadRequestError(`Invalid order type. Must be one of: ${Object.values(ORDER.ORDER_TYPE).join(', ')}`);
    }

    if (!Object.values(ORDER.PRODUCT_TYPE).includes(signal.productType)) {
      throw new BadRequestError(`Invalid product type. Must be one of: ${Object.values(ORDER.PRODUCT_TYPE).join(', ')}`);
    }

    // Validate price for LIMIT orders
    if (signal.orderType === 'LIMIT' && !signal.price) {
      throw new BadRequestError('Price is required for LIMIT orders');
    }

    // Validate trigger price for SL/SL-M orders
    if (['SL', 'SL-M'].includes(signal.orderType) && !signal.triggerPrice) {
      throw new BadRequestError('Trigger price is required for SL/SL-M orders');
    }
  }

  /**
   * Get or create mock signal source
   * @param {string} userId - User ID
   * @returns {Promise<Object>} - Signal source
   */
  async getOrCreateMockSignalSource(userId) {
    const [signalSource] = await SignalSource.findOrCreate({
      where: {
        userId,
        type: ORDER.SIGNAL_SOURCE.API,
        name: 'Mock/Manual Signals',
      },
      defaults: {
        userId,
        type: ORDER.SIGNAL_SOURCE.API,
        name: 'Mock/Manual Signals',
        config: {
          description: 'Auto-created source for manual testing signals',
        },
        status: 'ACTIVE',
      },
    });

    return signalSource;
  }

  /**
   * Get quick signal templates for common scenarios
   * @returns {Object} - Signal templates
   */
  getSignalTemplates() {
    return {
      marketBuy: {
        symbol: 'RELIANCE',
        exchange: 'NSE',
        transactionType: 'BUY',
        quantity: 1,
        orderType: 'MARKET',
        productType: 'MIS',
      },
      marketSell: {
        symbol: 'RELIANCE',
        exchange: 'NSE',
        transactionType: 'SELL',
        quantity: 1,
        orderType: 'MARKET',
        productType: 'MIS',
      },
      limitBuy: {
        symbol: 'RELIANCE',
        exchange: 'NSE',
        transactionType: 'BUY',
        quantity: 1,
        orderType: 'LIMIT',
        productType: 'MIS',
        price: 2450.50,
      },
      stopLossSell: {
        symbol: 'RELIANCE',
        exchange: 'NSE',
        transactionType: 'SELL',
        quantity: 1,
        orderType: 'SL',
        productType: 'MIS',
        price: 2400.00,
        triggerPrice: 2410.00,
      },
    };
  }
}

module.exports = MockSignalService;