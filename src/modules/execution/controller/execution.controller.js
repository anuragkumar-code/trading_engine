const ExecutionService = require('../service/execution.service');
const OrderService = require('../service/order.service');
const logger = require('../../../infrastructure/logger');

class ExecutionController {
  constructor() {
    this.executionService = new ExecutionService();
    this.orderService = new OrderService();
  }

  // ==================== Order Management ====================

  /**
   * Get orders
   * GET /api/v1/execution/orders
   */
  getOrders = async (req, res, next) => {
    try {
      const filters = {
        status: req.query.status,
        symbol: req.query.symbol,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
      };

      const options = {
        limit: parseInt(req.query.limit) || 50,
        offset: parseInt(req.query.offset) || 0,
        sortBy: req.query.sortBy || 'createdAt',
        sortOrder: req.query.sortOrder || 'DESC',
      };

      const result = await this.orderService.getOrders(
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
   * Get order by ID
   * GET /api/v1/execution/orders/:id
   */
  getOrderById = async (req, res, next) => {
    try {
      const { id } = req.params;

      const result = await this.orderService.getOrderById(id, req.userId);

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Cancel order
   * POST /api/v1/execution/orders/:id/cancel
   */
  cancelOrder = async (req, res, next) => {
    try {
      const { id } = req.params;
      const ip = req.ip || req.connection.remoteAddress;

      const result = await this.orderService.cancelOrder(id, req.userId, ip);

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get order statistics
   * GET /api/v1/execution/orders/stats
   */
  getOrderStatistics = async (req, res, next) => {
    try {
      const filters = {
        startDate: req.query.startDate,
        endDate: req.query.endDate,
      };

      const result = await this.orderService.getOrderStatistics(
        req.userId,
        filters
      );

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  // ==================== Position & Portfolio Management ====================

  /**
   * Get positions
   * GET /api/v1/execution/positions
   */
  getPositions = async (req, res, next) => {
    try {
      const result = await this.orderService.getPositions(req.userId);

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get holdings
   * GET /api/v1/execution/holdings
   */
  getHoldings = async (req, res, next) => {
    try {
      const result = await this.orderService.getHoldings(req.userId);

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get margins
   * GET /api/v1/execution/margins
   */
  getMargins = async (req, res, next) => {
    try {
      const result = await this.orderService.getMargins(req.userId);

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Exit position
   * POST /api/v1/execution/positions/exit
   */
  exitPosition = async (req, res, next) => {
    try {
      const { symbol, exchange, productType } = req.body;
      const ip = req.ip || req.connection.remoteAddress;

      const result = await this.executionService.exitPosition(
        req.userId,
        symbol,
        exchange,
        productType,
        ip
      );

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };
}

module.exports = ExecutionController;