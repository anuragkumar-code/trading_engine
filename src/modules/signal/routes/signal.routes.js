const express = require('express');
const SignalController = require('../controller/signal.controller');
const MockSignalController = require('../controller/mocksignal.controller');
const { createMockSignalSchema } = require('../validator/mocksignal.validator');
const { validate } = require('../../../shared/middleware/validation');
const { authenticate } = require('../../../shared/middleware/auth');
const { asyncHandler } = require('../../../shared/middleware/errorHandler');
const {
  createSignalSourceSchema,
  updateSignalSourceSchema,
  getSignalSourcesSchema,
  getSignalSourceByIdSchema,
  deleteSignalSourceSchema,
  processSignalApiSchema,
  telegramWebhookSchema,
  googleSheetsWebhookSchema,
  getTradeIntentsSchema,
  getTradeIntentByIdSchema,
} = require('../validator/signal.validator');

const router = express.Router();
const signalController = new SignalController();
const mockSignalController = new MockSignalController();

// ==================== Signal Sources Routes ====================

/**
 * @route   POST /api/v1/signals/sources
 * @desc    Create signal source
 * @access  Private
 */
router.post(
  '/sources',
  authenticate,
  validate(createSignalSourceSchema),
  asyncHandler(signalController.createSignalSource)
);

/**
 * @route   GET /api/v1/signals/sources
 * @desc    Get user's signal sources
 * @access  Private
 */
router.get(
  '/sources',
  authenticate,
  validate(getSignalSourcesSchema, 'query'),
  asyncHandler(signalController.getSignalSources)
);

/**
 * @route   GET /api/v1/signals/sources/:id
 * @desc    Get signal source by ID
 * @access  Private
 */
router.get(
  '/sources/:id',
  authenticate,
  asyncHandler(signalController.getSignalSourceById)
);

/**
 * @route   PUT /api/v1/signals/sources/:id
 * @desc    Update signal source
 * @access  Private
 */
router.put(
  '/sources/:id',
  authenticate,
  validate(updateSignalSourceSchema),
  asyncHandler(signalController.updateSignalSource)
);

/**
 * @route   DELETE /api/v1/signals/sources/:id
 * @desc    Delete signal source
 * @access  Private
 */
router.delete(
  '/sources/:id',
  authenticate,
  asyncHandler(signalController.deleteSignalSource)
);

// ==================== Signal Processing Routes ====================

/**
 * @route   POST /api/v1/signals/process
 * @desc    Process signal via API (authenticated)
 * @access  Private
 */
router.post(
  '/process',
  authenticate,
  validate(processSignalApiSchema),
  asyncHandler(signalController.processSignalApi)
);

// ==================== Webhook Routes (Public with Secret Verification) ====================

/**
 * @route   POST /api/v1/signals/webhooks/telegram/:sourceId
 * @desc    Telegram webhook endpoint
 * @access  Public (with webhook secret)
 */
router.post(
  '/webhooks/telegram/:sourceId',
  validate(telegramWebhookSchema),
  asyncHandler(signalController.telegramWebhook)
);

/**
 * @route   POST /api/v1/signals/webhooks/sheets/:sourceId
 * @desc    Google Sheets webhook endpoint
 * @access  Public (with webhook secret)
 */
router.post(
  '/webhooks/sheets/:sourceId',
  validate(googleSheetsWebhookSchema),
  asyncHandler(signalController.googleSheetsWebhook)
);

/**
 * @route   POST /api/v1/signals/webhooks/api/:sourceId
 * @desc    Generic API webhook endpoint
 * @access  Public (with webhook secret)
 */
router.post(
  '/webhooks/api/:sourceId',
  asyncHandler(signalController.apiWebhook)
);

// ==================== Trade Intents Routes ====================

/**
 * @route   GET /api/v1/signals/intents
 * @desc    Get user's trade intents
 * @access  Private
 */
router.get(
  '/intents',
  authenticate,
  validate(getTradeIntentsSchema, 'query'),
  asyncHandler(signalController.getTradeIntents)
);

/**
 * @route   GET /api/v1/signals/intents/:id
 * @desc    Get trade intent by ID
 * @access  Private
 */
router.get(
  '/intents/:id',
  authenticate,
  asyncHandler(signalController.getTradeIntentById)
);

// ==================== Mock Signal Routes (Testing) ====================

/**
 * @route   GET /api/v1/signals/mock/templates
 * @desc    Get pre-defined signal templates for quick testing
 * @access  Private
 */
router.get(
  '/mock/templates',
  authenticate,
  asyncHandler(mockSignalController.getSignalTemplates)
);

/**
 * @route   POST /api/v1/signals/mock
 * @desc    Create mock signal for testing (bypasses external sources)
 * @access  Private
 */
router.post(
  '/mock',
  authenticate,
  validate(createMockSignalSchema),
  asyncHandler(mockSignalController.createMockSignal)
);
module.exports = router;