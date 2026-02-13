const MockSignalService = require('../service/mocksignal.service');
const logger = require('../../../infrastructure/logger');

class MockSignalController {
  constructor() {
    this.mockSignalService = new MockSignalService();
  }

  /**
   * Create mock signal for testing
   * POST /api/v1/signals/mock
   */
  createMockSignal = async (req, res, next) => {
    try {
      const ip = req.ip || req.connection.remoteAddress;

      const result = await this.mockSignalService.createMockSignal(
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
   * Get signal templates
   * GET /api/v1/signals/mock/templates
   */
  getSignalTemplates = async (req, res, next) => {
    try {
      const templates = this.mockSignalService.getSignalTemplates();

      res.status(200).json({
        success: true,
        templates,
      });
    } catch (error) {
      next(error);
    }
  };
}

module.exports = MockSignalController;