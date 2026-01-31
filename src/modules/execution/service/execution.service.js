const { Order, TradeIntent, KiteAccount } = require('../../../infrastructure/database/models');
const { KiteClient } = require('../../../infrastructure/http');
const { auditQueue } = require('../../../infrastructure/queue');
const logger = require('../../../infrastructure/logger');
const auditLogger = require('../../../infrastructure/logger/audit');
const { OrderExecutionError, NotFoundError } = require('../../../shared/errors');
const { ORDER } = require('../../../shared/constants');
const { encryption } = require('../../../shared/utils');
const RiskService = require('../../risk/service/risk.service');

class ExecutionService {
  constructor() {
    this.riskService = new RiskService();
  }

  /**
   * Execute approved trade intent
   * @param {string} tradeIntentId - Trade intent ID
   * @returns {Promise<Object>} - Execution result
   */
  async executeTradeIntent(tradeIntentId) {
    let order = null;

    try {
      logger.info(`Executing trade intent: ${tradeIntentId}`);

      // Get trade intent
      const tradeIntent = await TradeIntent.findByPk(tradeIntentId);
      
      if (!tradeIntent) {
        throw new NotFoundError('Trade intent not found');
      }

      if (tradeIntent.status !== 'APPROVED') {
        throw new OrderExecutionError(
          `Trade intent not approved for execution. Status: ${tradeIntent.status}`,
          'NOT_APPROVED'
        );
      }

      // Get Kite account
      const kiteAccount = await KiteAccount.findOne({
        where: {
          userId: tradeIntent.userId,
          status: 'ACTIVE',
        },
      });

      if (!kiteAccount || !kiteAccount.accessToken) {
        throw new OrderExecutionError('No active Kite account found', 'NO_ACCOUNT');
      }

      // Decrypt access token
      const accessToken = encryption.decrypt(kiteAccount.accessToken);
      const kiteClient = new KiteClient(accessToken);

      // Create order record
      order = await Order.create({
        tradeIntentId: tradeIntent.id,
        userId: tradeIntent.userId,
        symbol: tradeIntent.symbol,
        exchange: tradeIntent.exchange,
        transactionType: tradeIntent.transactionType,
        orderType: tradeIntent.orderType,
        productType: tradeIntent.productType,
        quantity: tradeIntent.quantity,
        price: tradeIntent.price,
        triggerPrice: tradeIntent.triggerPrice,
        status: 'PENDING',
      });

      logger.info(`Order created: ${order.id}`);

      // Prepare order parameters for Kite API
      const orderParams = {
        symbol: tradeIntent.symbol,
        exchange: tradeIntent.exchange,
        transactionType: tradeIntent.transactionType,
        orderType: tradeIntent.orderType,
        productType: tradeIntent.productType,
        quantity: tradeIntent.quantity,
        price: tradeIntent.price,
        triggerPrice: tradeIntent.triggerPrice,
        validity: tradeIntent.validity || 'DAY',
        tag: `TI_${tradeIntent.id.substring(0, 8)}`,
      };

      // Place order with Kite
      logger.info('Placing order with Kite API', { orderParams });
      
      const kiteResponse = await kiteClient.placeOrder(orderParams);
      
      logger.info('Order placed successfully with Kite', { kiteResponse });

      // Update order with Kite response
      await order.update({
        kiteOrderId: kiteResponse.data.order_id,
        status: 'SUBMITTED',
        statusMessage: 'Order submitted successfully',
        placedAt: new Date(),
        kiteResponse: kiteResponse,
      });

      // Update trade intent
      await tradeIntent.update({
        status: 'EXECUTED',
      });

      // Reset circuit breaker on success
      await this.riskService.resetCircuitBreaker(tradeIntent.userId);

      // Audit log
      await auditQueue.add('order_placed', {
        event: 'ORDER_PLACED',
        userId: tradeIntent.userId,
        source: 'EXECUTION',
        payload: {
          orderId: order.id,
          kiteOrderId: order.kiteOrderId,
          symbol: order.symbol,
          transactionType: order.transactionType,
          quantity: order.quantity,
        },
        result: 'SUCCESS',
      });

      auditLogger.logOrderPlaced(tradeIntent.userId, {
        orderId: order.id,
        kiteOrderId: order.kiteOrderId,
        symbol: order.symbol,
      }, 'SUCCESS');

      logger.info(`Trade intent ${tradeIntentId} executed successfully. Order: ${order.kiteOrderId}`);

      // Start monitoring order status
      this.monitorOrderStatus(order.id, kiteClient);

      return {
        success: true,
        order: {
          id: order.id,
          kiteOrderId: order.kiteOrderId,
          symbol: order.symbol,
          status: order.status,
        },
      };

    } catch (error) {
      logger.error(`Execution failed for trade intent ${tradeIntentId}:`, error);

      // Update order status if order was created
      if (order) {
        await order.update({
          status: 'FAILED',
          statusMessage: error.message,
        });
      }

      // Update trade intent
      const tradeIntent = await TradeIntent.findByPk(tradeIntentId);
      if (tradeIntent) {
        await tradeIntent.update({
          status: 'FAILED',
          rejectionReason: error.message,
        });

        // Increment circuit breaker
        await this.riskService.incrementCircuitBreaker(tradeIntent.userId);
      }

      // Audit log
      await auditQueue.add('order_failed', {
        event: 'ORDER_PLACED',
        userId: tradeIntent?.userId,
        source: 'EXECUTION',
        payload: {
          tradeIntentId,
          orderId: order?.id,
          error: error.message,
        },
        result: 'FAILED',
      });

      throw error;
    }
  }

  /**
   * Monitor order status and update
   * @param {string} orderId - Order ID
   * @param {KiteClient} kiteClient - Kite client instance
   */
  async monitorOrderStatus(orderId, kiteClient) {
    try {
      // Poll order status for 5 minutes
      const maxAttempts = 60; // 60 attempts * 5 seconds = 5 minutes
      let attempts = 0;

      const interval = setInterval(async () => {
        try {
          attempts++;

          const order = await Order.findByPk(orderId);
          
          if (!order || !order.kiteOrderId) {
            clearInterval(interval);
            return;
          }

          // Get order status from Kite
          const kiteOrder = await kiteClient.getOrder(order.kiteOrderId);
          
          if (kiteOrder && kiteOrder.data && kiteOrder.data.length > 0) {
            const orderData = kiteOrder.data[0];
            
            // Map Kite status to our status
            const status = this.mapKiteStatus(orderData.status);
            
            await order.update({
              status,
              averagePrice: orderData.average_price,
              filledQuantity: orderData.filled_quantity,
              statusMessage: orderData.status_message,
              kiteResponse: orderData,
            });

            logger.info(`Order ${orderId} status updated: ${status}`);

            // Stop monitoring if order is in terminal state
            if (['COMPLETE', 'CANCELLED', 'REJECTED'].includes(status)) {
              clearInterval(interval);
              
              // Audit log final status
              auditLogger.logOrderPlaced(order.userId, {
                orderId: order.id,
                kiteOrderId: order.kiteOrderId,
                status,
                filledQuantity: order.filledQuantity,
                averagePrice: order.averagePrice,
              }, status);
            }
          }

          // Stop after max attempts
          if (attempts >= maxAttempts) {
            clearInterval(interval);
            logger.warn(`Stopped monitoring order ${orderId} after ${maxAttempts} attempts`);
          }

        } catch (error) {
          logger.error(`Error monitoring order ${orderId}:`, error);
          
          // Continue monitoring despite errors
          if (attempts >= maxAttempts) {
            clearInterval(interval);
          }
        }
      }, 5000); // Poll every 5 seconds

    } catch (error) {
      logger.error('Error setting up order monitoring:', error);
    }
  }

  /**
   * Map Kite order status to our status
   * @param {string} kiteStatus - Kite order status
   * @returns {string} - Our order status
   */
  mapKiteStatus(kiteStatus) {
    const statusMap = {
      'PENDING': 'PENDING',
      'OPEN': 'OPEN',
      'COMPLETE': 'COMPLETE',
      'CANCELLED': 'CANCELLED',
      'REJECTED': 'REJECTED',
      'VALIDATION PENDING': 'PENDING',
      'MODIFY PENDING': 'OPEN',
      'CANCEL PENDING': 'OPEN',
      'TRIGGER PENDING': 'OPEN',
    };

    return statusMap[kiteStatus] || 'SUBMITTED';
  }

  /**
   * Get user orders
   * @param {string} userId - User ID
   * @param {Object} filters - Query filters
   * @returns {Promise<Array>} - Orders
   */
  async getOrders(userId, filters = {}) {
    const where = { userId };

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.symbol) {
      where.symbol = filters.symbol;
    }

    const orders = await Order.findAll({
      where,
      include: [{ association: 'tradeIntent' }],
      order: [['createdAt', 'DESC']],
      limit: filters.limit || 100,
    });

    return orders;
  }

  /**
   * Get order by ID
   * @param {string} id - Order ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} - Order
   */
  async getOrderById(id, userId) {
    const order = await Order.findOne({
      where: { id, userId },
      include: [{ association: 'tradeIntent' }],
    });

    if (!order) {
      throw new NotFoundError('Order not found');
    }

    return order;
  }

  /**
   * Cancel order
   * @param {string} orderId - Order ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} - Cancellation result
   */
  async cancelOrder(orderId, userId) {
    try {
      const order = await Order.findOne({
        where: { id: orderId, userId },
      });

      if (!order) {
        throw new NotFoundError('Order not found');
      }

      if (!['PENDING', 'SUBMITTED', 'OPEN'].includes(order.status)) {
        throw new OrderExecutionError(
          `Cannot cancel order with status: ${order.status}`,
          'INVALID_STATUS'
        );
      }

      if (!order.kiteOrderId) {
        throw new OrderExecutionError('Order has no Kite order ID', 'NO_KITE_ORDER');
      }

      // Get Kite account
      const kiteAccount = await KiteAccount.findOne({
        where: { userId, status: 'ACTIVE' },
      });

      if (!kiteAccount || !kiteAccount.accessToken) {
        throw new OrderExecutionError('No active Kite account found', 'NO_ACCOUNT');
      }

      const accessToken = encryption.decrypt(kiteAccount.accessToken);
      const kiteClient = new KiteClient(accessToken);

      // Cancel order with Kite
      await kiteClient.cancelOrder(order.kiteOrderId);

      // Update order status
      await order.update({
        status: 'CANCELLED',
        statusMessage: 'Order cancelled by user',
      });

      // Audit log
      auditLogger.logOrderPlaced(userId, {
        orderId: order.id,
        kiteOrderId: order.kiteOrderId,
        action: 'CANCELLED',
      }, 'SUCCESS');

      logger.info(`Order ${orderId} cancelled successfully`);

      return {
        success: true,
        message: 'Order cancelled successfully',
        order: {
          id: order.id,
          status: order.status,
        },
      };

    } catch (error) {
      logger.error(`Error cancelling order ${orderId}:`, error);
      throw error;
    }
  }

  /**
   * Get current positions
   * @param {string} userId - User ID
   * @returns {Promise<Object>} - Positions
   */
  async getPositions(userId) {
    try {
      const kiteAccount = await KiteAccount.findOne({
        where: { userId, status: 'ACTIVE' },
      });

      if (!kiteAccount || !kiteAccount.accessToken) {
        throw new OrderExecutionError('No active Kite account found', 'NO_ACCOUNT');
      }

      const accessToken = encryption.decrypt(kiteAccount.accessToken);
      const kiteClient = new KiteClient(accessToken);

      const positions = await kiteClient.getPositions();

      return {
        success: true,
        positions: positions,
      };

    } catch (error) {
      logger.error('Error getting positions:', error);
      throw error;
    }
  }
}

module.exports = ExecutionService;