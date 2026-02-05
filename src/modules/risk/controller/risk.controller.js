const RiskService = require('../service/risk.service');
const RiskLimitService = require('../service/risklimit.service');
const KillSwitchService = require('../service/killswitch.service');
const logger = require('../../../infrastructure/logger');

class RiskController {
  constructor() {
    this.riskService = new RiskService();
    this.riskLimitService = new RiskLimitService();
    this.killSwitchService = new KillSwitchService();
  }

  // ==================== Risk Limits Management ====================

  /**
   * Create risk limit
   * POST /api/v1/risk/limits
   */
  createRiskLimit = async (req, res, next) => {
    try {
      const ip = req.ip || req.connection.remoteAddress;

      const result = await this.riskLimitService.createRiskLimit(
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
   * Get risk limits
   * GET /api/v1/risk/limits
   */
  getRiskLimits = async (req, res, next) => {
    try {
      const filters = {
        limitType: req.query.limitType,
        status: req.query.status,
      };

      const options = {
        limit: parseInt(req.query.limit) || 20,
        offset: parseInt(req.query.offset) || 0,
      };

      const result = await this.riskLimitService.getRiskLimits(
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
   * Get risk limit by ID
   * GET /api/v1/risk/limits/:id
   */
  getRiskLimitById = async (req, res, next) => {
    try {
      const { id } = req.params;

      const result = await this.riskLimitService.getRiskLimitById(
        id,
        req.userId
      );

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Update risk limit
   * PUT /api/v1/risk/limits/:id
   */
  updateRiskLimit = async (req, res, next) => {
    try {
      const { id } = req.params;
      const ip = req.ip || req.connection.remoteAddress;

      const result = await this.riskLimitService.updateRiskLimit(
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
   * Delete risk limit
   * DELETE /api/v1/risk/limits/:id
   */
  deleteRiskLimit = async (req, res, next) => {
    try {
      const { id } = req.params;
      const ip = req.ip || req.connection.remoteAddress;

      const result = await this.riskLimitService.deleteRiskLimit(
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
   * Get risk summary
   * GET /api/v1/risk/summary
   */
  getRiskSummary = async (req, res, next) => {
    try {
      const result = await this.riskLimitService.getRiskSummary(req.userId);

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get risk violations
   * GET /api/v1/risk/violations
   */
  getRiskViolations = async (req, res, next) => {
    try {
      const filters = {
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        violationType: req.query.violationType,
      };

      const options = {
        limit: parseInt(req.query.limit) || 20,
        offset: parseInt(req.query.offset) || 0,
      };

      const result = await this.riskLimitService.getRiskViolations(
        req.userId,
        filters,
        options
      );

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  // ==================== Kill Switch Management ====================

  /**
   * Get kill switch status
   * GET /api/v1/risk/killswitch/status
   */
  getKillSwitchStatus = async (req, res, next) => {
    try {
      const isEnabled = await this.killSwitchService.isEnabled();

      res.status(200).json({
        success: true,
        killSwitch: {
          enabled: isEnabled,
          message: isEnabled 
            ? 'Kill switch is enabled. All trading operations are blocked.' 
            : 'Kill switch is disabled. Trading is active.',
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Enable kill switch
   * POST /api/v1/risk/killswitch/enable
   */
  enableKillSwitch = async (req, res, next) => {
    try {
      const { reason } = req.body;
      const ip = req.ip || req.connection.remoteAddress;

      const result = await this.killSwitchService.enable(
        req.userId,
        reason,
        ip
      );

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Disable kill switch
   * POST /api/v1/risk/killswitch/disable
   */
  disableKillSwitch = async (req, res, next) => {
    try {
      const ip = req.ip || req.connection.remoteAddress;

      const result = await this.killSwitchService.disable(
        req.userId,
        ip
      );

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  // ==================== Risk Check Operations ====================

  /**
   * Check trade intent (manual risk check)
   * POST /api/v1/risk/check
   */
  checkTradeIntent = async (req, res, next) => {
    try {
      const { tradeIntentId } = req.body;

      const result = await this.riskService.checkTradeIntent(
        tradeIntentId,
        req.userId
      );

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };
}

module.exports = RiskController;