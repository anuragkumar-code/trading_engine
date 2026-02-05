const StrategyService = require('../service/strategy.service');
const logger = require('../../../infrastructure/logger');

class StrategyController {
  constructor() {
    this.strategyService = new StrategyService();
  }

  /**
   * Create new strategy
   * POST /api/v1/strategies
   */
  createStrategy = async (req, res, next) => {
    try {
      const ip = req.ip || req.connection.remoteAddress;
      
      const result = await this.strategyService.createStrategy(
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
   * Get user's strategies
   * GET /api/v1/strategies
   */
  getStrategies = async (req, res, next) => {
    try {
      const filters = {
        status: req.query.status,
        search: req.query.search,
      };

      const options = {
        limit: parseInt(req.query.limit) || 20,
        offset: parseInt(req.query.offset) || 0,
        sortBy: req.query.sortBy || 'createdAt',
        sortOrder: req.query.sortOrder || 'DESC',
      };

      const result = await this.strategyService.getStrategies(
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
   * Get strategy by ID
   * GET /api/v1/strategies/:id
   */
  getStrategyById = async (req, res, next) => {
    try {
      const { id } = req.params;

      const result = await this.strategyService.getStrategyById(
        id,
        req.userId
      );

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Update strategy
   * PUT /api/v1/strategies/:id
   */
  updateStrategy = async (req, res, next) => {
    try {
      const { id } = req.params;
      const ip = req.ip || req.connection.remoteAddress;

      const result = await this.strategyService.updateStrategy(
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
   * Delete strategy
   * DELETE /api/v1/strategies/:id
   */
  deleteStrategy = async (req, res, next) => {
    try {
      const { id } = req.params;
      const ip = req.ip || req.connection.remoteAddress;

      const result = await this.strategyService.deleteStrategy(
        id,
        req.userId,
        ip
      );

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Clone strategy
   * POST /api/v1/strategies/:id/clone
   */
  cloneStrategy = async (req, res, next) => {
    try {
      const { id } = req.params;
      const { name } = req.body;
      const ip = req.ip || req.connection.remoteAddress;

      const result = await this.strategyService.cloneStrategy(
        id,
        req.userId,
        name,
        ip
      );

      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get strategy statistics
   * GET /api/v1/strategies/stats
   */
  getStrategyStatistics = async (req, res, next) => {
    try {
      const result = await this.strategyService.getStrategyStatistics(req.userId);

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };
}

module.exports = StrategyController;