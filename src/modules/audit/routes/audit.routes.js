const express = require('express');
const AuditController = require('../controller/audit.controller');
const { validate, validateMultiple } = require('../../../shared/middleware/validation');
const { authenticate, authorize } = require('../../../shared/middleware/auth');
const { asyncHandler } = require('../../../shared/middleware/errorHandler');
const {
  getAuditLogsSchema,
  getAuditLogByIdSchema,
  exportAuditLogsSchema,
  getAuditStatsSchema,
} = require('../validator/audit.validator');
const { SYSTEM } = require('../../../shared/constants');

const router = express.Router();
const auditController = new AuditController();

/**
 * @route   GET /api/v1/audit/logs
 * @desc    Get audit logs with filters and pagination
 * @access  Private
 */
router.get(
  '/logs',
  authenticate,
  validate(getAuditLogsSchema, 'query'),
  asyncHandler(auditController.getAuditLogs)
);

/**
 * @route   GET /api/v1/audit/logs/:id
 * @desc    Get audit log by ID
 * @access  Private
 */
router.get(
  '/logs/:id',
  authenticate,
  asyncHandler(auditController.getAuditLogById)
);

/**
 * @route   GET /api/v1/audit/stats
 * @desc    Get audit statistics
 * @access  Private
 */
router.get(
  '/stats',
  authenticate,
  validate(getAuditStatsSchema, 'query'),
  asyncHandler(auditController.getAuditStats)
);

/**
 * @route   POST /api/v1/audit/export
 * @desc    Export audit logs (JSON or CSV)
 * @access  Private
 */
router.post(
  '/export',
  authenticate,
  validate(exportAuditLogsSchema),
  asyncHandler(auditController.exportAuditLogs)
);

/**
 * @route   GET /api/v1/audit/activity/:userId
 * @desc    Get user activity summary (Admin only or own activity)
 * @access  Private
 */
router.get(
  '/activity/:userId',
  authenticate,
  asyncHandler(auditController.getUserActivity)
);

/**
 * @route   GET /api/v1/audit/my-activity
 * @desc    Get current user's activity summary
 * @access  Private
 */
router.get(
  '/my-activity',
  authenticate,
  asyncHandler(auditController.getMyActivity)
);

module.exports = router;