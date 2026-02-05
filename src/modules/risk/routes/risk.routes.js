const express = require('express');
const RiskController = require('../controller/risk.controller');
const { validate } = require('../../../shared/middleware/validation');
const { authenticate, authorize } = require('../../../shared/middleware/auth');
const { asyncHandler } = require('../../../shared/middleware/errorHandler');
const {
  createRiskLimitSchema,
  updateRiskLimitSchema,
  getRiskLimitsSchema,
  getRiskLimitByIdSchema,
  deleteRiskLimitSchema,
  enableKillSwitchSchema,
  checkTradeIntentSchema,
  getRiskViolationsSchema,
} = require('../validator/risk.validator');
const { SYSTEM } = require('../../../shared/constants');

const router = express.Router();
const riskController = new RiskController();

// ==================== Risk Limits Routes ====================

/**
 * @route   GET /api/v1/risk/summary
 * @desc    Get risk summary for current user
 * @access  Private
 */
router.get(
  '/summary',
  authenticate,
  asyncHandler(riskController.getRiskSummary)
);

/**
 * @route   GET /api/v1/risk/violations
 * @desc    Get risk violations history
 * @access  Private
 */
router.get(
  '/violations',
  authenticate,
  validate(getRiskViolationsSchema, 'query'),
  asyncHandler(riskController.getRiskViolations)
);

/**
 * @route   POST /api/v1/risk/limits
 * @desc    Create risk limit
 * @access  Private
 */
router.post(
  '/limits',
  authenticate,
  validate(createRiskLimitSchema),
  asyncHandler(riskController.createRiskLimit)
);

/**
 * @route   GET /api/v1/risk/limits
 * @desc    Get user's risk limits
 * @access  Private
 */
router.get(
  '/limits',
  authenticate,
  validate(getRiskLimitsSchema, 'query'),
  asyncHandler(riskController.getRiskLimits)
);

/**
 * @route   GET /api/v1/risk/limits/:id
 * @desc    Get risk limit by ID
 * @access  Private
 */
router.get(
  '/limits/:id',
  authenticate,
  asyncHandler(riskController.getRiskLimitById)
);

/**
 * @route   PUT /api/v1/risk/limits/:id
 * @desc    Update risk limit
 * @access  Private
 */
router.put(
  '/limits/:id',
  authenticate,
  validate(updateRiskLimitSchema),
  asyncHandler(riskController.updateRiskLimit)
);

/**
 * @route   DELETE /api/v1/risk/limits/:id
 * @desc    Delete risk limit
 * @access  Private
 */
router.delete(
  '/limits/:id',
  authenticate,
  asyncHandler(riskController.deleteRiskLimit)
);

// ==================== Kill Switch Routes ====================

/**
 * @route   GET /api/v1/risk/killswitch/status
 * @desc    Get kill switch status
 * @access  Private
 */
router.get(
  '/killswitch/status',
  authenticate,
  asyncHandler(riskController.getKillSwitchStatus)
);

/**
 * @route   POST /api/v1/risk/killswitch/enable
 * @desc    Enable kill switch
 * @access  Private (Admin or Trader)
 */
router.post(
  '/killswitch/enable',
  authenticate,
  authorize(SYSTEM.USER_ROLE.ADMIN, SYSTEM.USER_ROLE.TRADER),
  validate(enableKillSwitchSchema),
  asyncHandler(riskController.enableKillSwitch)
);

/**
 * @route   POST /api/v1/risk/killswitch/disable
 * @desc    Disable kill switch
 * @access  Private (Admin or Trader)
 */
router.post(
  '/killswitch/disable',
  authenticate,
  authorize(SYSTEM.USER_ROLE.ADMIN, SYSTEM.USER_ROLE.TRADER),
  asyncHandler(riskController.disableKillSwitch)
);

// ==================== Risk Check Routes ====================

/**
 * @route   POST /api/v1/risk/check
 * @desc    Manually check trade intent against risk limits
 * @access  Private
 */
router.post(
  '/check',
  authenticate,
  validate(checkTradeIntentSchema),
  asyncHandler(riskController.checkTradeIntent)
);

module.exports = router;