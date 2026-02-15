const axios = require('axios');
const qs = require('qs');
const crypto = require('crypto');
const config = require('../../shared/config');
const logger = require('../logger');
const { OrderExecutionError } = require('../../shared/errors');

class KiteClient {
  constructor(accessToken) {
    this.baseUrl = config.app.kite.baseUrl;
    this.apiKey = config.app.kite.apiKey;
    this.accessToken = accessToken;
    
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'X-Kite-Version': '3',
        'Authorization': `token ${this.apiKey}:${this.accessToken}`,
      },
      timeout: 30000,
    });

    // Add response interceptor
    this.client.interceptors.response.use(
      response => response,
      error => {
        logger.error('Kite API Error:', {
          status: error.response?.status,
          data: error.response?.data,
          message: error.message,
        });
        throw error;
      }
    );
  }

  /**
   * Place order
   * @param {Object} orderParams - Order parameters
   * @returns {Promise<Object>} - Order response
   */
  // async placeOrder(orderParams) {
  //   try {
  //     const response = await this.client.post('/orders/regular', {
  //       exchange: orderParams.exchange,
  //       tradingsymbol: orderParams.symbol,
  //       transaction_type: orderParams.transactionType,
  //       order_type: orderParams.orderType,
  //       product: orderParams.productType,
  //       quantity: orderParams.quantity,
  //       price: orderParams.price,
  //       trigger_price: orderParams.triggerPrice,
  //       validity: orderParams.validity || 'DAY',
  //       disclosed_quantity: 0,
  //       tag: orderParams.tag || 'TradingEngine',
  //     });

  //     return response.data;
  //   } catch (error) {
  //     throw new OrderExecutionError(
  //       `Failed to place order: ${error.message}`,
  //       'ORDER_PLACEMENT_FAILED',
  //       error.response?.data
  //     );
  //   }
  // }
  async placeOrder(orderParams) {
    try {
      const payload = {
        exchange: orderParams.exchange,
        tradingsymbol: orderParams.symbol,
        transaction_type: orderParams.transactionType,
        order_type: orderParams.orderType,
        product: orderParams.productType,
        quantity: orderParams.quantity,
        price: orderParams.price,
        trigger_price: orderParams.triggerPrice,
        validity: orderParams.validity || 'DAY',
        disclosed_quantity: 0,
        tag: orderParams.tag || 'TradingEngine',
      };

      if (orderParams.orderType === 'LIMIT' && orderParams.price != null) {
        payload.price = orderParams.price;
      }

      // Include trigger_price only if required
      if (
        (orderParams.orderType === 'SL' ||
        orderParams.orderType === 'SL-M') &&
        orderParams.triggerPrice != null
      ) {
        payload.trigger_price = orderParams.triggerPrice;
      }

      const response = await this.client.post(
        '/orders/regular',
        qs.stringify(payload),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      return response.data;
    } catch (error) {
      throw new OrderExecutionError(
        `Failed to place order: ${error.message}`,
        'ORDER_PLACEMENT_FAILED',
        error.response?.data
      );
    }
  }

  /**
   * Modify order
   * @param {string} orderId - Kite order ID
   * @param {Object} modifications - Order modifications
   * @returns {Promise<Object>} - Modified order response
   */
  async modifyOrder(orderId, modifications) {
    try {
      const response = await this.client.put(`/orders/regular/${orderId}`, modifications);
      return response.data;
    } catch (error) {
      throw new OrderExecutionError(
        `Failed to modify order: ${error.message}`,
        'ORDER_MODIFICATION_FAILED',
        error.response?.data
      );
    }
  }

  /**
   * Cancel order
   * @param {string} orderId - Kite order ID
   * @param {string} variety - Order variety
   * @returns {Promise<Object>} - Cancellation response
   */
  async cancelOrder(orderId, variety = 'regular') {
    try {
      const response = await this.client.delete(`/orders/${variety}/${orderId}`);
      return response.data;
    } catch (error) {
      throw new OrderExecutionError(
        `Failed to cancel order: ${error.message}`,
        'ORDER_CANCELLATION_FAILED',
        error.response?.data
      );
    }
  }

  /**
   * Get order details
   * @param {string} orderId - Kite order ID
   * @returns {Promise<Object>} - Order details
   */
  async getOrder(orderId) {
    try {
      const response = await this.client.get(`/orders/${orderId}`);
      return response.data;
    } catch (error) {
      logger.error(`Failed to get order ${orderId}:`, error);
      throw error;
    }
  }

  /**
   * Get all orders
   * @returns {Promise<Array>} - List of orders
   */
  async getOrders() {
    try {
      const response = await this.client.get('/orders');
      return response.data.data;
    } catch (error) {
      logger.error('Failed to get orders:', error);
      throw error;
    }
  }

  /**
   * Get positions
   * @returns {Promise<Object>} - Positions data
   */
  async getPositions() {
    try {
      const response = await this.client.get('/portfolio/positions');
      return response.data.data;
    } catch (error) {
      logger.error('Failed to get positions:', error);
      throw error;
    }
  }

  /**
   * Get holdings
   * @returns {Promise<Array>} - Holdings data
   */
  async getHoldings() {
    try {
      const response = await this.client.get('/portfolio/holdings');
      return response.data.data;
    } catch (error) {
      logger.error('Failed to get holdings:', error);
      throw error;
    }
  }

  /**
   * Get margins
   * @returns {Promise<Object>} - Margins data
   */
  async getMargins() {
    try {
      const response = await this.client.get('/user/margins');
      return response.data.data;
    } catch (error) {
      logger.error('Failed to get margins:', error);
      throw error;
    }
  }

  /**
   * Get quote
   * @param {string} exchange - Exchange
   * @param {string} symbol - Trading symbol
   * @returns {Promise<Object>} - Quote data
   */
  async getQuote(exchange, symbol) {
    try {
      const instrument = `${exchange}:${symbol}`;
      const response = await this.client.get(`/quote`, {
        params: { i: instrument },
      });
      return response.data.data[instrument];
    } catch (error) {
      logger.error(`Failed to get quote for ${exchange}:${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Exit position (square off)
   * @param {Object} position - Position to square off
   * @returns {Promise<Object>} - Order response
   */
  async exitPosition(position) {
    const orderParams = {
      exchange: position.exchange,
      symbol: position.tradingsymbol,
      transactionType: position.quantity > 0 ? 'SELL' : 'BUY',
      orderType: 'MARKET',
      productType: position.product,
      quantity: Math.abs(position.quantity),
      tag: 'SquareOff',
    };

    return this.placeOrder(orderParams);
  }


  async generateSession(requestToken) {
    const apiKey = config.kite.apiKey;
    const apiSecret = config.kite.apiSecret;

    const checksum = crypto
      .createHash('sha256')
      .update(apiKey + requestToken + apiSecret)
      .digest('hex');

    const response = await axios.post(
      `${config.kite.baseUrl}/session/token`,
      qs.stringify({
        api_key: apiKey,
        request_token: requestToken,
        checksum,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    return response.data.data;
  };

}

module.exports = KiteClient;