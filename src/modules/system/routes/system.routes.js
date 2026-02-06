const express = require('express');
const SystemController = require('../controller/system.controller');
const { validate } = require('../../../shared/middleware/validation');
const { authenticate, authorize } = require('../../../shared/middleware/auth');
const { asyncHandler } = require('../../../shared/middleware/errorHandler');
const {
  getSystemFlagsSchema,
  getSystemFlagByIdSchema,
  updateSystemFlagSchema,
  createSystemFlagSchema,
  toggleMaintenanceSchema,
  getSystemMetricsSchema,
} = require('../validator/system.validator');
const { SYSTEM } = require('../../../shared/constants');

const router = express.Router();
const systemController = new SystemController();

// ==================== Public Routes ====================

/**
 * @route   GET /api/v1/system/health
 * @desc    Get system health status
 * @access  Public
 */
router.get(
  '/health',
  asyncHandler(systemController.getHealthStatus)
);

/**
 * @route   GET /api/v1/system/info
 * @desc    Get system information
 * @access  Public
 */
router.get(
  '/info',
  asyncHandler(systemController.getSystemInfo)
);

// ==================== Protected Routes ====================

/**
 * @route   GET /api/v1/system/config
 * @desc    Get system configuration
 * @access  Private (Admin only)
 */
router.get(
  '/config',
  authenticate,
  authorize(SYSTEM.USER_ROLE.ADMIN),
  asyncHandler(systemController.getSystemConfig)
);

/**
 * @route   GET /api/v1/system/metrics
 * @desc    Get system metrics
 * @access  Private (Admin only)
 */
router.get(
  '/metrics',
  authenticate,
  authorize(SYSTEM.USER_ROLE.ADMIN),
  validate(getSystemMetricsSchema, 'query'),
  asyncHandler(systemController.getSystemMetrics)
);

// ==================== System Flags Routes ====================

/**
 * @route   POST /api/v1/system/flags
 * @desc    Create system flag
 * @access  Private (Admin only)
 */
router.post(
  '/flags',
  authenticate,
  authorize(SYSTEM.USER_ROLE.ADMIN),
  validate(createSystemFlagSchema),
  asyncHandler(systemController.createSystemFlag)
);

/**
 * @route   GET /api/v1/system/flags
 * @desc    Get all system flags
 * @access  Private (Admin only)
 */
router.get(
  '/flags',
  authenticate,
  authorize(SYSTEM.USER_ROLE.ADMIN),
  validate(getSystemFlagsSchema, 'query'),
  asyncHandler(systemController.getSystemFlags)
);

/**
 * @route   GET /api/v1/system/flags/:id
 * @desc    Get system flag by ID
 * @access  Private (Admin only)
 */
router.get(
  '/flags/:id',
  authenticate,
  authorize(SYSTEM.USER_ROLE.ADMIN),
  asyncHandler(systemController.getSystemFlagById)
);

/**
 * @route   PUT /api/v1/system/flags/:id
 * @desc    Update system flag
 * @access  Private (Admin only)
 */
router.put(
  '/flags/:id',
  authenticate,
  authorize(SYSTEM.USER_ROLE.ADMIN),
  validate(updateSystemFlagSchema),
  asyncHandler(systemController.updateSystemFlag)
);

/**
 * @route   DELETE /api/v1/system/flags/:id
 * @desc    Delete system flag
 * @access  Private (Admin only)
 */
router.delete(
  '/flags/:id',
  authenticate,
  authorize(SYSTEM.USER_ROLE.ADMIN),
  asyncHandler(systemController.deleteSystemFlag)
);

// ==================== Maintenance Mode Routes ====================

/**
 * @route   GET /api/v1/system/maintenance
 * @desc    Get maintenance mode status
 * @access  Public
 */
router.get(
  '/maintenance',
  asyncHandler(systemController.getMaintenanceStatus)
);

/**
 * @route   POST /api/v1/system/maintenance
 * @desc    Toggle maintenance mode
 * @access  Private (Admin only)
 */
router.post(
  '/maintenance',
  authenticate,
  authorize(SYSTEM.USER_ROLE.ADMIN),
  validate(toggleMaintenanceSchema),
  asyncHandler(systemController.toggleMaintenanceMode)
);

module.exports = router;