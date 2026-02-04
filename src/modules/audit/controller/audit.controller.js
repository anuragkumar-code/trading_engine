const AuditService = require('../service/audit.service');
const logger = require('../../../infrastructure/logger');

class AuditController {
  constructor() {
    this.auditService = new AuditService();
  }

  /**
   * Get audit logs with filters and pagination
   * GET /api/v1/audit/logs
   */
  getAuditLogs = async (req, res, next) => {
    try {
      const filters = {
        event: req.query.event,
        userId: req.query.userId,
        source: req.query.source,
        result: req.query.result,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
      };

      const options = {
        limit: parseInt(req.query.limit) || 100,
        offset: parseInt(req.query.offset) || 0,
        sortBy: req.query.sortBy || 'createdAt',
        sortOrder: req.query.sortOrder || 'DESC',
      };

      const result = await this.auditService.getAuditLogs(
        filters,
        options,
        req.userId,
        req.user.role
      );

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get audit log by ID
   * GET /api/v1/audit/logs/:id
   */
  getAuditLogById = async (req, res, next) => {
    try {
      const { id } = req.params;

      const result = await this.auditService.getAuditLogById(
        id,
        req.userId,
        req.user.role
      );

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get audit statistics
   * GET /api/v1/audit/stats
   */
  getAuditStats = async (req, res, next) => {
    try {
      const filters = {
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        groupBy: req.query.groupBy || 'event',
      };

      const result = await this.auditService.getAuditStats(
        filters,
        req.userId,
        req.user.role
      );

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Export audit logs
   * POST /api/v1/audit/export
   */
  exportAuditLogs = async (req, res, next) => {
    try {
      const filters = {
        event: req.body.event,
        userId: req.body.userId,
        source: req.body.source,
        result: req.body.result,
        startDate: req.body.startDate,
        endDate: req.body.endDate,
      };

      const format = req.body.format || 'json';

      const result = await this.auditService.exportAuditLogs(
        filters,
        format,
        req.userId,
        req.user.role
      );

      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=audit-logs-${Date.now()}.csv`);
        res.status(200).send(result.data);
      } else {
        res.status(200).json(result);
      }
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get user activity summary
   * GET /api/v1/audit/activity/:userId
   */
  getUserActivity = async (req, res, next) => {
    try {
      const { userId } = req.params;
      const days = parseInt(req.query.days) || 30;

      // Non-admin users can only view their own activity
      if (req.user.role !== 'ADMIN' && userId !== req.userId) {
        return res.status(403).json({
          success: false,
          error: {
            message: 'You can only view your own activity',
            code: 'FORBIDDEN',
            statusCode: 403,
          },
        });
      }

      const result = await this.auditService.getUserActivitySummary(userId, days);

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get current user's activity summary
   * GET /api/v1/audit/my-activity
   */
  getMyActivity = async (req, res, next) => {
    try {
      const days = parseInt(req.query.days) || 30;

      const result = await this.auditService.getUserActivitySummary(req.userId, days);

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };
}

module.exports = AuditController;