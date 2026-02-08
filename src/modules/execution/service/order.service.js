const { Order, TradeIntent, KiteAccount } = require('../../../infrastructure/database/models');
const { KiteClient } = require('../../../infrastructure/http');
const { auditQueue } = require('../../../infrastructure/queue');
const logger = require('../../../infrastructure/logger');
const { encryption } = require('../../../shared/utils');
const {
  NotFoundError,
  BadRequestError,
  OrderExecutionError,
  ForbiddenError,
} = require('../../../shared/errors');
const { SYSTEM, ORDER } = require('../../../shared/constants');
const { Op } = require('sequelize');

class OrderService {
  /**
   * Get user's orders with filters and pagination
   * @param {string} userId - User ID
   * @param {Object} filters - Query filters
   * @param {Object} options - Pagination options
   * @returns {Promise<Object>} - Orders with pagination
   */
  async getOrders(userId, filters = {}, options = {}) {
    try {
      const where = { userId };

      // Status filter
      if (filters.status) {
        where.status = filters.status;
      }

      // Symbol filter
      if (filters.symbol) {
        where.symbol = { [Op.iLike]: `%${filters.symbol}%` };
      }

      // Date range filter
      if (filters.startDate || filters.endDate) {
        where.createdAt = {};
        
        if (filters.startDate) {
          where.createdAt[Op.gte] = new Date(filters.startDate);
        }
        
        if (filters.endDate) {
          where.createdAt[Op.lte] = new Date(filters.endDate);
        }
      }

      // Pagination
      const limit = options.limit || 50;
      const offset = options.offset || 0;

      // Sorting
      const sortBy = options.sortBy || 'createdAt';
      const sortOrder = options.sortOrder || 'DESC';

      // Query orders
      const { count, rows } = await Order.findAndCountAll({
        where,
        include: [
          {
            association: 'tradeIntent',
            attributes: ['id', 'strategyId', 'signalSourceId'],
            include: [
              {
                association: 'strategy',
                attributes: ['id', 'name'],
                required: false,
              },
              {
                association: 'signalSource',
                attributes: ['id', 'name', 'type'],
                required: false,
              },
            ],
            required: false,
          },
        ],
        limit,
        offset,
        order: [[sortBy, sortOrder]],
      });

      // Calculate pagination metadata
      const totalPages = Math.ceil(count / limit);
      const currentPage = Math.floor(offset / limit) + 1;

      return {
        success: true,
        orders: rows,
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
      logger.error('Error getting orders:', error);
      throw error;
    }
  }

  /**
   * Get order by ID
   * @param {string} orderId - Order ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} - Order details
   */
  async getOrderById(orderId, userId) {
    try {
      const order = await Order.findOne({
        where: {
          id: orderId,
          userId,
        },
        include: [
          {
            association: 'tradeIntent',
            include: [
              {
                association: 'strategy',
                attributes: ['id', 'name', 'config'],
                required: false,
              },
              {
                association: 'signalSource',
                attributes: ['id', 'name', 'type'],
                required: false,
              },
            ],
            required: false,
          },
        ],
      });

      if (!order) {
        throw new NotFoundError('Order not found');
      }

      // Get live status from Kite if order is active
      if (order.kiteOrderId && ['PENDING', 'SUBMITTED', 'OPEN', 'TRIGGER_PENDING'].includes(order.status)) {
        try {
          const kiteAccount = await KiteAccount.findOne({
            where: { userId, status: 'ACTIVE' },
          });

          if (kiteAccount?.accessToken) {
            const accessToken = encryption.decrypt(kiteAccount.accessToken);
            const kiteClient = new KiteClient(accessToken);
            
            const kiteOrder = await kiteClient.getOrder(order.kiteOrderId);
            
            // Update order status if changed
            if (kiteOrder.data.status !== order.status) {
              await order.update({
                status: kiteOrder.data.status,
                statusMessage: kiteOrder.data.status_message,
                filledQuantity: kiteOrder.data.filled_quantity,
                averagePrice: kiteOrder.data.average_price,
              });
            }
          }
        } catch (error) {
          logger.warn('Failed to fetch live order status from Kite:', error);
        }
      }

      return {
        success: true,
        order,
      };

    } catch (error) {
      logger.error('Error getting order by ID:', error);
      throw error;
    }
  }

  /**
   * Cancel order
   * @param {string} orderId - Order ID
   * @param {string} userId - User ID
   * @param {string} ip - IP address
   * @returns {Promise<Object>}
   */
  async cancelOrder(orderId, userId, ip = null) {
    try {
      logger.info(`Cancelling order: ${orderId}`, { userId });

      const order = await Order.findOne({
        where: {
          id: orderId,
          userId,
        },
      });

      if (!order) {
        throw new NotFoundError('Order not found');
      }

      // Check if order can be cancelled
      const cancellableStatuses = ['PENDING', 'SUBMITTED', 'OPEN', 'TRIGGER_PENDING'];
      if (!cancellableStatuses.includes(order.status)) {
        throw new BadRequestError(`Order cannot be cancelled. Current status: ${order.status}`);
      }

      if (!order.kiteOrderId) {
        throw new BadRequestError('Order does not have a Kite order ID');
      }

      // Get Kite account
      const kiteAccount = await KiteAccount.findOne({
        where: { userId, status: 'ACTIVE' },
      });

      if (!kiteAccount || !kiteAccount.accessToken) {
        throw new OrderExecutionError('No active Kite account found', 'NO_ACCOUNT');
      }

      // Cancel order via Kite
      const accessToken = encryption.decrypt(kiteAccount.accessToken);
      const kiteClient = new KiteClient(accessToken);

      await kiteClient.cancelOrder(order.kiteOrderId);

      // Update order status
      await order.update({
        status: 'CANCELLED',
        statusMessage: 'Order cancelled by user',
        cancelledAt: new Date(),
      });

      logger.info(`Order cancelled successfully: ${orderId}`);

      // Audit log
      await auditQueue.add('order_cancelled', {
        event: SYSTEM.AUDIT_EVENT.ORDER_CANCELLED,
        userId,
        source: 'EXECUTION',
        ip,
        payload: {
          orderId,
          kiteOrderId: order.kiteOrderId,
          symbol: order.symbol,
          action: 'ORDER_CANCELLED',
        },
        result: 'SUCCESS',
      });

      return {
        success: true,
        message: 'Order cancelled successfully',
        order,
      };

    } catch (error) {
      logger.error('Error cancelling order:', error);
      throw error;
    }
  }

  /**
   * Get order statistics
   * @param {string} userId - User ID
   * @param {Object} filters - Date filters
   * @returns {Promise<Object>} - Order statistics
   */
  async getOrderStatistics(userId, filters = {}) {
    try {
      const where = { userId };

      // Date range filter
      if (filters.startDate || filters.endDate) {
        where.createdAt = {};
        
        if (filters.startDate) {
          where.createdAt[Op.gte] = new Date(filters.startDate);
        }
        
        if (filters.endDate) {
          where.createdAt[Op.lte] = new Date(filters.endDate);
        }
      }

      // Total orders
      const totalOrders = await Order.count({ where });

      // Orders by status
      const ordersByStatus = await Order.findAll({
        where,
        attributes: [
          'status',
          [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count'],
        ],
        group: 'status',
        raw: true,
      });

      // Calculate success rate
      const completedOrders = await Order.count({
        where: {
          ...where,
          status: 'COMPLETE',
        },
      });

      const failedOrders = await Order.count({
        where: {
          ...where,
          status: { [Op.in]: ['REJECTED', 'CANCELLED', 'FAILED'] },
        },
      });

      const successRate = totalOrders > 0 
        ? ((completedOrders / totalOrders) * 100).toFixed(2) 
        : 0;

      return {
        success: true,
        statistics: {
          total: totalOrders,
          completed: completedOrders,
          failed: failedOrders,
          successRate: parseFloat(successRate),
          byStatus: ordersByStatus,
        },
      };

    } catch (error) {
      logger.error('Error getting order statistics:', error);
      throw error;
    }
  }

  /**
   * Get positions from Kite
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
        positions: positions.data,
      };

    } catch (error) {
      logger.error('Error getting positions:', error);
      throw error;
    }
  }

  /**
   * Get holdings from Kite
   * @param {string} userId - User ID
   * @returns {Promise<Object>} - Holdings
   */
  async getHoldings(userId) {
    try {
      const kiteAccount = await KiteAccount.findOne({
        where: { userId, status: 'ACTIVE' },
      });

      if (!kiteAccount || !kiteAccount.accessToken) {
        throw new OrderExecutionError('No active Kite account found', 'NO_ACCOUNT');
      }

      const accessToken = encryption.decrypt(kiteAccount.accessToken);
      const kiteClient = new KiteClient(accessToken);

      const holdings = await kiteClient.getHoldings();

      return {
        success: true,
        holdings: holdings,
      };

    } catch (error) {
      logger.error('Error getting holdings:', error);
      throw error;
    }
  }

  /**
   * Get margins from Kite
   * @param {string} userId - User ID
   * @returns {Promise<Object>} - Margins
   */
  async getMargins(userId) {
    try {
      const kiteAccount = await KiteAccount.findOne({
        where: { userId, status: 'ACTIVE' },
      });

      if (!kiteAccount || !kiteAccount.accessToken) {
        throw new OrderExecutionError('No active Kite account found', 'NO_ACCOUNT');
      }

      const accessToken = encryption.decrypt(kiteAccount.accessToken);
      const kiteClient = new KiteClient(accessToken);

      const margins = await kiteClient.getMargins();

      return {
        success: true,
        margins: margins,
      };

    } catch (error) {
      logger.error('Error getting margins:', error);
      throw error;
    }
  }
}

module.exports = OrderService;