const SystemService = require('../service/system.service');
const logger = require('../../../infrastructure/logger');

class SystemController {
  constructor() {
    this.systemService = new SystemService();
  }

  /**
   * Get system health status
   * GET /api/v1/system/health
   */
  getHealthStatus = async (req, res, next) => {
    try {
      const detailed = req.query.detailed === 'true';

      const result = await this.systemService.getHealthStatus(detailed);

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get system information
   * GET /api/v1/system/info
   */
  getSystemInfo = async (req, res, next) => {
    try {
      const result = await this.systemService.getSystemInfo();

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get system configuration
   * GET /api/v1/system/config
   */
  getSystemConfig = async (req, res, next) => {
    try {
      const result = await this.systemService.getSystemConfig();

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get system metrics
   * GET /api/v1/system/metrics
   */
  getSystemMetrics = async (req, res, next) => {
    try {
      const period = req.query.period || '24h';

      const result = await this.systemService.getSystemMetrics(period);

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  // ==================== System Flags ====================

  /**
   * Create system flag
   * POST /api/v1/system/flags
   */
  createSystemFlag = async (req, res, next) => {
    try {
      const ip = req.ip || req.connection.remoteAddress;

      const result = await this.systemService.createSystemFlag(
        req.body,
        req.userId,
        ip
      );

      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get all system flags
   * GET /api/v1/system/flags
   */
  getSystemFlags = async (req, res, next) => {
    try {
      const filters = {
        flagType: req.query.flagType,
        enabled: req.query.enabled === 'true' ? true : req.query.enabled === 'false' ? false : undefined,
      };

      const result = await this.systemService.getSystemFlags(filters);

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get system flag by ID
   * GET /api/v1/system/flags/:id
   */
  getSystemFlagById = async (req, res, next) => {
    try {
      const { id } = req.params;

      const result = await this.systemService.getSystemFlagById(id);

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Update system flag
   * PUT /api/v1/system/flags/:id
   */
  updateSystemFlag = async (req, res, next) => {
    try {
      const { id } = req.params;
      const ip = req.ip || req.connection.remoteAddress;

      const result = await this.systemService.updateSystemFlag(
        id,
        req.body,
        req.userId,
        ip
      );

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Delete system flag
   * DELETE /api/v1/system/flags/:id
   */
  deleteSystemFlag = async (req, res, next) => {
    try {
      const { id } = req.params;
      const ip = req.ip || req.connection.remoteAddress;

      const result = await this.systemService.deleteSystemFlag(
        id,
        req.userId,
        ip
      );

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  // ==================== Maintenance Mode ====================

  /**
   * Toggle maintenance mode
   * POST /api/v1/system/maintenance
   */
  toggleMaintenanceMode = async (req, res, next) => {
    try {
      const { enabled, reason, estimatedDuration } = req.body;
      const ip = req.ip || req.connection.remoteAddress;

      const result = await this.systemService.toggleMaintenanceMode(
        enabled,
        reason,
        estimatedDuration,
        req.userId,
        ip
      );

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get maintenance mode status
   * GET /api/v1/system/maintenance
   */
  getMaintenanceStatus = async (req, res, next) => {
    try {
      const isEnabled = await this.systemService.isMaintenanceModeEnabled();

      res.status(200).json({
        success: true,
        maintenanceMode: {
          enabled: isEnabled,
          message: isEnabled 
            ? 'System is under maintenance' 
            : 'System is operational',
        },
      });
    } catch (error) {
      next(error);
    }
  };
}

module.exports = SystemController;