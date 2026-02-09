const BrokerService = require('../service/broker.service');
const logger = require('../../../infrastructure/logger');

class BrokerController {
  constructor() {
    this.brokerService = new BrokerService();
  }

  /**
   * Initiate Kite login (Step 1)
   * POST /api/v1/brokers/kite/login
   */
  initiateKiteLogin = async (req, res, next) => {
    try {
      const ip = req.ip || req.connection.remoteAddress;

      const result = await this.brokerService.initiateKiteLogin(
        req.userId,
        ip
      );

      res.status(200).json(result);
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
      const { requestToken } = req.body;
      const ip = req.ip || req.connection.remoteAddress;

      const result = await this.brokerService.generateSession(
        req.userId,
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
      const ip = req.ip || req.connection.remoteAddress;

      const result = await this.brokerService.refreshKiteToken(
        req.userId,
        ip
      );

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get token status
   * GET /api/v1/brokers/kite/status
   */
  getTokenStatus = async (req, res, next) => {
    try {
      const result = await this.brokerService.checkTokenStatus(req.userId);

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get Kite account details
   * GET /api/v1/brokers/kite/account
   */
  getKiteAccount = async (req, res, next) => {
    try {
      const result = await this.brokerService.getKiteAccount(req.userId);

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Disconnect Kite account
   * DELETE /api/v1/brokers/kite/disconnect
   */
  disconnectKiteAccount = async (req, res, next) => {
    try {
      const ip = req.ip || req.connection.remoteAddress;

      const result = await this.brokerService.disconnectKiteAccount(
        req.userId,
        ip
      );

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };
}

module.exports = BrokerController;