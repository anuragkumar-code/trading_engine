const BrokerService = require('../service/broker.service');
const logger = require('../../../infrastructure/logger');

class BrokerController {
  constructor() {
    this.brokerService = new BrokerService();
  }

  /**
   * Connect Kite account (Step 1)
   * POST /api/v1/brokers/kite/connect
   */
  connectKiteAccount = async (req, res, next) => {
    try {
      const { apiKey, apiSecret } = req.body;
      const ip = req.ip || req.connection.remoteAddress;

      const result = await this.brokerService.connectKiteAccount(
        req.userId,
        apiKey,
        apiSecret,
        ip
      );

      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Generate session (Step 2)
   * POST /api/v1/brokers/kite/session
   */
  generateSession = async (req, res, next) => {
    try {
      const { requestToken, kiteAccountId } = req.body;
      const ip = req.ip || req.connection.remoteAddress;

      const result = await this.brokerService.generateSession(
        req.userId,
        kiteAccountId,
        requestToken,
        ip
      );

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Refresh Kite token
   * POST /api/v1/brokers/kite/refresh
   */
  refreshKiteToken = async (req, res, next) => {
    try {
      const { kiteAccountId } = req.body;
      const ip = req.ip || req.connection.remoteAddress;

      const result = await this.brokerService.refreshKiteToken(
        req.userId,
        kiteAccountId,
        ip
      );

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Check token status
   * GET /api/v1/brokers/kite/token-status
   */
  checkTokenStatus = async (req, res, next) => {
    try {
      const result = await this.brokerService.checkTokenStatus(req.userId);

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get Kite accounts
   * GET /api/v1/brokers/kite/accounts
   */
  getKiteAccounts = async (req, res, next) => {
    try {
      const result = await this.brokerService.getKiteAccounts(req.userId);

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Update account status
   * PATCH /api/v1/brokers/kite/:kiteAccountId/status
   */
  updateAccountStatus = async (req, res, next) => {
    try {
      const { kiteAccountId } = req.params;
      const { status } = req.body;
      const ip = req.ip || req.connection.remoteAddress;

      const result = await this.brokerService.updateAccountStatus(
        req.userId,
        kiteAccountId,
        status,
        ip
      );

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Disconnect Kite account
   * DELETE /api/v1/brokers/kite/:kiteAccountId
   */
  disconnectKiteAccount = async (req, res, next) => {
    try {
      const { kiteAccountId } = req.params;
      const ip = req.ip || req.connection.remoteAddress;

      const result = await this.brokerService.disconnectKiteAccount(
        req.userId,
        kiteAccountId,
        ip
      );

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };
}

module.exports = BrokerController;