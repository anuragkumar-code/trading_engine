const express = require('express');
const ExecutionController = require('../controller/execution.controller');
const { validate } = require('../../../shared/middleware/validation');
const { authenticate } = require('../../../shared/middleware/auth');
const { asyncHandler } = require('../../../shared/middleware/errorHandler');
const {
  getOrdersSchema,
  getOrderByIdSchema,
  cancelOrderSchema,
  getOrderStatsSchema,
  exitPositionSchema,
} = require('../validator/execution.validator');

const router = express.Router();
const executionController = new ExecutionController();

// ==================== Order Management Routes ====================

/**
 * @route   GET /api/v1/execution/orders/stats
 * @desc    Get order statistics
 * @access  Private
 */
router.get(
  '/orders/stats',
  authenticate,
  validate(getOrderStatsSchema, 'query'),
  asyncHandler(executionController.getOrderStatistics)
);

/**
 * @route   GET /api/v1/execution/orders
 * @desc    Get user's orders with filters
 * @access  Private
 */
router.get(
  '/orders',
  authenticate,
  validate(getOrdersSchema, 'query'),
  asyncHandler(executionController.getOrders)
);

/**
 * @route   GET /api/v1/execution/orders/:id
 * @desc    Get order by ID
 * @access  Private
 */
router.get(
  '/orders/:id',
  authenticate,
  asyncHandler(executionController.getOrderById)
);

/**
 * @route   POST /api/v1/execution/orders/:id/cancel
 * @desc    Cancel order
 * @access  Private
 */
router.post(
  '/orders/:id/cancel',
  authenticate,
  asyncHandler(executionController.cancelOrder)
);

// ==================== Position & Portfolio Routes ====================

/**
 * @route   GET /api/v1/execution/positions
 * @desc    Get current positions from Kite
 * @access  Private
 */
router.get(
  '/positions',
  authenticate,
  asyncHandler(executionController.getPositions)
);

/**
 * @route   POST /api/v1/execution/positions/exit
 * @desc    Exit a position
 * @access  Private
 */
router.post(
  '/positions/exit',
  authenticate,
  validate(exitPositionSchema),
  asyncHandler(executionController.exitPosition)
);

/**
 * @route   GET /api/v1/execution/holdings
 * @desc    Get holdings from Kite
 * @access  Private
 */
router.get(
  '/holdings',
  authenticate,
  asyncHandler(executionController.getHoldings)
);

/**
 * @route   GET /api/v1/execution/margins
 * @desc    Get margins from Kite
 * @access  Private
 */
router.get(
  '/margins',
  authenticate,
  asyncHandler(executionController.getMargins)
);

module.exports = router;