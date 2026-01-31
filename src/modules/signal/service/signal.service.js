const { TradeIntent, SignalSource, Strategy } = require('../../../infrastructure/database/models');
const { executionQueue, riskQueue, auditQueue } = require('../../../infrastructure/queue');
const logger = require('../../../infrastructure/logger');
const auditLogger = require('../../../infrastructure/logger/audit');
const { BadRequestError, NotFoundError } = require('../../../shared/errors');
const { ORDER } = require('../../../shared/constants');
const KillSwitchService = require('../../risk/service/killswitch.service');

class SignalService {
  constructor() {
    this.killSwitchService = new KillSwitchService();
  }

  /**
   * Process incoming signal
   * @param {Object} signal - Raw signal data
   * @param {string} userId - User ID
   * @param {string} source - Signal source type
   * @param {string} ip - IP address
   * @returns {Promise<Object>} - Created trade intent
   */
  async processSignal(signal, userId, source, ip = null) {
    try {
      logger.info(`Processing signal from ${source}`, { userId, signal });

      // Check kill switch first
      await this.killSwitchService.enforce();

      // Validate signal source
      const signalSource = await this.validateSignalSource(userId, source);

      // Parse signal into trade intent
      const tradeIntentData = await this.parseSignal(signal, source);

      // Resolve strategy
      const strategy = await this.resolveStrategy(userId, tradeIntentData);

      // Create trade intent
      const tradeIntent = await TradeIntent.create({
        userId,
        signalSourceId: signalSource.id,
        strategyId: strategy?.id,
        symbol: tradeIntentData.symbol,
        exchange: tradeIntentData.exchange,
        transactionType: tradeIntentData.transactionType,
        orderType: tradeIntentData.orderType,
        productType: tradeIntentData.productType,
        quantity: tradeIntentData.quantity,
        price: tradeIntentData.price,
        triggerPrice: tradeIntentData.triggerPrice,
        validity: tradeIntentData.validity || 'DAY',
        status: 'PENDING',
        rawSignal: signal,
      });

      logger.info(`Trade intent created: ${tradeIntent.id}`);

      // Audit log
      await auditQueue.add('signal_received', {
        event: 'SIGNAL_RECEIVED',
        userId,
        source,
        ip,
        payload: signal,
        result: 'SUCCESS',
      });

      await auditQueue.add('trade_intent_created', {
        event: 'TRADE_INTENT_CREATED',
        userId,
        source,
        ip,
        payload: {
          tradeIntentId: tradeIntent.id,
          symbol: tradeIntent.symbol,
          transactionType: tradeIntent.transactionType,
          quantity: tradeIntent.quantity,
        },
        result: 'SUCCESS',
      });

      // Queue for risk check
      await riskQueue.add('risk_check', {
        tradeIntentId: tradeIntent.id,
        userId,
      }, {
        priority: 1, // High priority for risk checks
      });

      // Return trade intent
      return {
        success: true,
        tradeIntent: {
          id: tradeIntent.id,
          symbol: tradeIntent.symbol,
          transactionType: tradeIntent.transactionType,
          quantity: tradeIntent.quantity,
          status: tradeIntent.status,
        },
      };

    } catch (error) {
      logger.error('Error processing signal:', error);

      // Log failed signal
      await auditQueue.add('signal_failed', {
        event: 'SIGNAL_RECEIVED',
        userId,
        source,
        ip,
        payload: signal,
        result: 'FAILED',
        metadata: { error: error.message },
      });

      throw error;
    }
  }

  /**
   * Validate signal source
   * @param {string} userId - User ID
   * @param {string} sourceType - Source type
   * @returns {Promise<Object>} - Signal source
   */
  async validateSignalSource(userId, sourceType) {
    const signalSource = await SignalSource.findOne({
      where: {
        userId,
        type: sourceType,
        status: 'ACTIVE',
      },
    });

    if (!signalSource) {
      throw new NotFoundError(`No active signal source found for type: ${sourceType}`);
    }

    return signalSource;
  }

  /**
   * Parse signal based on source type
   * @param {Object} signal - Raw signal
   * @param {string} source - Source type
   * @returns {Promise<Object>} - Parsed trade intent data
   */
  async parseSignal(signal, source) {
    switch (source) {
      case ORDER.SIGNAL_SOURCE.TELEGRAM:
        return this.parseTelegramSignal(signal);
      
      case ORDER.SIGNAL_SOURCE.GOOGLE_SHEETS:
        return this.parseSheetsSignal(signal);
      
      case ORDER.SIGNAL_SOURCE.API:
        return this.parseApiSignal(signal);
      
      default:
        throw new BadRequestError(`Unsupported signal source: ${source}`);
    }
  }

  /**
   * Parse Telegram signal
   * Format: "BUY RELIANCE NSE\nQty: 10\nPrice: 2450.50\nType: LIMIT\nProduct: MIS"
   * @param {Object} signal - Telegram message
   * @returns {Object} - Parsed data
   */
  parseTelegramSignal(signal) {
    try {
      const text = signal.message?.text || signal.text;
      
      if (!text) {
        throw new BadRequestError('Empty signal message');
      }

      const lines = text.split('\n').map(line => line.trim());
      
      // Parse first line: "BUY RELIANCE NSE"
      const [transactionType, symbol, exchange] = lines[0].split(/\s+/);

      if (!transactionType || !symbol || !exchange) {
        throw new BadRequestError('Invalid signal format. Expected: "BUY/SELL SYMBOL EXCHANGE"');
      }

      // Parse other fields
      const data = {
        transactionType: transactionType.toUpperCase(),
        symbol: symbol.toUpperCase(),
        exchange: exchange.toUpperCase(),
        orderType: 'MARKET',
        productType: 'MIS',
        quantity: null,
        price: null,
        triggerPrice: null,
      };

      lines.slice(1).forEach(line => {
        const [key, value] = line.split(':').map(s => s.trim());
        
        if (key && value) {
          switch (key.toLowerCase()) {
            case 'qty':
            case 'quantity':
              data.quantity = parseInt(value, 10);
              break;
            case 'price':
              data.price = parseFloat(value);
              break;
            case 'trigger':
            case 'trigger_price':
              data.triggerPrice = parseFloat(value);
              break;
            case 'type':
            case 'order_type':
              data.orderType = value.toUpperCase();
              break;
            case 'product':
            case 'product_type':
              data.productType = value.toUpperCase();
              break;
          }
        }
      });

      // Validate required fields
      if (!data.quantity || data.quantity <= 0) {
        throw new BadRequestError('Quantity is required and must be positive');
      }

      // Validate transaction type
      if (!['BUY', 'SELL'].includes(data.transactionType)) {
        throw new BadRequestError('Transaction type must be BUY or SELL');
      }

      // Validate exchange
      if (!Object.values(ORDER.EXCHANGE).includes(data.exchange)) {
        throw new BadRequestError(`Invalid exchange: ${data.exchange}`);
      }

      // Validate order type
      if (!Object.values(ORDER.ORDER_TYPE).includes(data.orderType)) {
        throw new BadRequestError(`Invalid order type: ${data.orderType}`);
      }

      // Validate product type
      if (!Object.values(ORDER.PRODUCT_TYPE).includes(data.productType)) {
        throw new BadRequestError(`Invalid product type: ${data.productType}`);
      }

      // Price validation for LIMIT orders
      if (data.orderType === 'LIMIT' && (!data.price || data.price <= 0)) {
        throw new BadRequestError('Price is required for LIMIT orders');
      }

      // Trigger price validation for SL orders
      if (['SL', 'SL-M'].includes(data.orderType) && (!data.triggerPrice || data.triggerPrice <= 0)) {
        throw new BadRequestError('Trigger price is required for SL orders');
      }

      return data;

    } catch (error) {
      if (error instanceof BadRequestError) {
        throw error;
      }
      throw new BadRequestError(`Failed to parse Telegram signal: ${error.message}`);
    }
  }

  /**
   * Parse Google Sheets signal
   * @param {Object} signal - Sheets webhook data
   * @returns {Object} - Parsed data
   */
  parseSheetsSignal(signal) {
    try {
      const data = {
        transactionType: signal.transactionType?.toUpperCase(),
        symbol: signal.symbol?.toUpperCase(),
        exchange: signal.exchange?.toUpperCase(),
        orderType: signal.orderType?.toUpperCase() || 'MARKET',
        productType: signal.productType?.toUpperCase() || 'MIS',
        quantity: parseInt(signal.quantity, 10),
        price: signal.price ? parseFloat(signal.price) : null,
        triggerPrice: signal.triggerPrice ? parseFloat(signal.triggerPrice) : null,
        validity: signal.validity?.toUpperCase() || 'DAY',
      };

      // Validate required fields
      if (!data.symbol || !data.exchange || !data.transactionType || !data.quantity) {
        throw new BadRequestError('Missing required fields: symbol, exchange, transactionType, quantity');
      }

      if (data.quantity <= 0) {
        throw new BadRequestError('Quantity must be positive');
      }

      // Validate transaction type
      if (!['BUY', 'SELL'].includes(data.transactionType)) {
        throw new BadRequestError('Transaction type must be BUY or SELL');
      }

      return data;

    } catch (error) {
      if (error instanceof BadRequestError) {
        throw error;
      }
      throw new BadRequestError(`Failed to parse Sheets signal: ${error.message}`);
    }
  }

  /**
   * Parse API signal
   * @param {Object} signal - API payload
   * @returns {Object} - Parsed data
   */
  parseApiSignal(signal) {
    try {
      // API signals should already be in correct format
      const data = {
        transactionType: signal.transactionType?.toUpperCase(),
        symbol: signal.symbol?.toUpperCase(),
        exchange: signal.exchange?.toUpperCase(),
        orderType: signal.orderType?.toUpperCase(),
        productType: signal.productType?.toUpperCase(),
        quantity: parseInt(signal.quantity, 10),
        price: signal.price ? parseFloat(signal.price) : null,
        triggerPrice: signal.triggerPrice ? parseFloat(signal.triggerPrice) : null,
        validity: signal.validity?.toUpperCase() || 'DAY',
      };

      // Basic validation
      if (!data.symbol || !data.exchange || !data.transactionType || 
          !data.orderType || !data.productType || !data.quantity) {
        throw new BadRequestError('Missing required fields in API signal');
      }

      return data;

    } catch (error) {
      if (error instanceof BadRequestError) {
        throw error;
      }
      throw new BadRequestError(`Failed to parse API signal: ${error.message}`);
    }
  }

  /**
   * Resolve strategy for trade intent
   * @param {string} userId - User ID
   * @param {Object} tradeData - Trade intent data
   * @returns {Promise<Object|null>} - Strategy or null
   */
  async resolveStrategy(userId, tradeData) {
    try {
      // Find strategy based on symbol or default strategy
      const strategy = await Strategy.findOne({
        where: {
          userId,
          status: 'ACTIVE',
        },
        // In production, you might want to match based on:
        // - Symbol patterns
        // - Strategy configuration
        // - Time windows
        order: [['createdAt', 'DESC']],
      });

      return strategy;
    } catch (error) {
      logger.warn('Error resolving strategy:', error);
      return null;
    }
  }

  /**
   * Get trade intents
   * @param {string} userId - User ID
   * @param {Object} filters - Query filters
   * @returns {Promise<Array>} - Trade intents
   */
  async getTradeIntents(userId, filters = {}) {
    const where = { userId };

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.symbol) {
      where.symbol = filters.symbol;
    }

    const tradeIntents = await TradeIntent.findAll({
      where,
      include: [
        { association: 'signalSource' },
        { association: 'strategy' },
        { association: 'orders' },
      ],
      order: [['createdAt', 'DESC']],
      limit: filters.limit || 100,
    });

    return tradeIntents;
  }

  /**
   * Get trade intent by ID
   * @param {string} id - Trade intent ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} - Trade intent
   */
  async getTradeIntentById(id, userId) {
    const tradeIntent = await TradeIntent.findOne({
      where: { id, userId },
      include: [
        { association: 'signalSource' },
        { association: 'strategy' },
        { association: 'orders' },
      ],
    });

    if (!tradeIntent) {
      throw new NotFoundError('Trade intent not found');
    }

    return tradeIntent;
  }
}

module.exports = SignalService;