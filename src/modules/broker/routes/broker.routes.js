const express = require('express');
const BrokerController = require('../controller/broker.controller');
const { validate } = require('../../../shared/middleware/validation');
const { authenticate } = require('../../../shared/middleware/auth');
const { asyncHandler } = require('../../../shared/middleware/errorHandler');
const {
  initiateKiteLoginSchema,
  generateSessionSchema,
  refreshKiteTokenSchema,
} = require('../validator/broker.validator');

const router = express.Router();
const brokerController = new BrokerController();

// ==================== Kite Integration Routes ====================

/**
 * @route   POST /api/v1/brokers/kite/login
 * @desc    Initiate Kite login (Step 1) - Get login URL
 * @access  Private
 */
router.post(
  '/kite/login',
  authenticate,
  validate(initiateKiteLoginSchema),
  asyncHandler(brokerController.initiateKiteLogin)
);

/**
 * @route   POST /api/v1/brokers/kite/session
 * @desc    Generate Kite session (Step 2) - Exchange request_token for access_token
 * @access  Private
 */
router.post(
  '/kite/session',
  authenticate,
  validate(generateSessionSchema),
  asyncHandler(brokerController.generateSession)
);

/**
 * @route   POST /api/v1/brokers/kite/refresh
 * @desc    Refresh expired Kite token - Get new login URL
 * @access  Private
 */
router.post(
  '/kite/refresh',
  authenticate,
  validate(refreshKiteTokenSchema),
  asyncHandler(brokerController.refreshKiteToken)
);

/**
 * @route   GET /api/v1/brokers/kite/status
 * @desc    Check Kite token status
 * @access  Private
 */
router.get(
  '/kite/status',
  authenticate,
  asyncHandler(brokerController.getTokenStatus)
);

/**
 * @route   GET /api/v1/brokers/kite/account
 * @desc    Get user's Kite account details
 * @access  Private
 */
router.get(
  '/kite/account',
  authenticate,
  asyncHandler(brokerController.getKiteAccount)
);

/**
 * @route   DELETE /api/v1/brokers/kite/disconnect
 * @desc    Disconnect Kite account
 * @access  Private
 */
router.delete(
  '/kite/disconnect',
  authenticate,
  asyncHandler(brokerController.disconnectKiteAccount)
);

module.exports = router;