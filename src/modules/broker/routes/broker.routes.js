const express = require('express');
const BrokerController = require('../controller/broker.controller');

const { authenticate } = require('../../../shared/middleware/auth');
const { validate } = require('../../../shared/middleware/validation');
const { asyncHandler } = require('../../../shared/middleware/errorHandler');

const {
  connectKiteSchema,
  generateSessionSchema,
  refreshKiteTokenSchema,
  updateAccountStatusSchema,
} = require('../validator/broker.validator');

const router = express.Router();
const brokerController = new BrokerController();

/**
 * Connect Kite account (Step 1)
 */
router.post(
  '/kite/connect',
  authenticate,
  validate(connectKiteSchema),
  asyncHandler(brokerController.connectKiteAccount)
);

/**
 * Generate session (Step 2)
 */
router.post(
  '/kite/session',
  authenticate,
  validate(generateSessionSchema),
  asyncHandler(brokerController.generateSession)
);

/**
 * Refresh Kite token
 */
router.post(
  '/kite/refresh',
  authenticate,
  validate(refreshKiteTokenSchema),
  asyncHandler(brokerController.refreshKiteToken)
);

/**
 * Check token status
 */
router.get(
  '/kite/token-status',
  authenticate,
  asyncHandler(brokerController.checkTokenStatus)
);

/**
 * Get Kite accounts
 */
router.get(
  '/kite/accounts',
  authenticate,
  asyncHandler(brokerController.getKiteAccounts)
);

/**
 * Update account status
 */
router.patch(
  '/kite/:kiteAccountId/status',
  authenticate,
  validate(updateAccountStatusSchema),
  asyncHandler(brokerController.updateAccountStatus)
);

/**
 * Disconnect account
 */
router.delete(
  '/kite/:kiteAccountId',
  authenticate,
  asyncHandler(brokerController.disconnectKiteAccount)
);

module.exports = router;
