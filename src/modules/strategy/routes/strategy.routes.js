const express = require('express');
const StrategyController = require('../controller/strategy.controller');
const { validate } = require('../../../shared/middleware/validation');
const { authenticate } = require('../../../shared/middleware/auth');
const { asyncHandler } = require('../../../shared/middleware/errorHandler');
const {
  createStrategySchema,
  updateStrategySchema,
  getStrategiesSchema,
  getStrategyByIdSchema,
  deleteStrategySchema,
} = require('../validator/strategy.validator');
const Joi = require('joi');

const router = express.Router();
const strategyController = new StrategyController();

/**
 * @route   GET /api/v1/strategies/stats
 * @desc    Get strategy statistics for current user
 * @access  Private
 */
router.get(
  '/stats',
  authenticate,
  asyncHandler(strategyController.getStrategyStatistics)
);

/**
 * @route   POST /api/v1/strategies
 * @desc    Create new strategy
 * @access  Private
 */
router.post(
  '/',
  authenticate,
  validate(createStrategySchema),
  asyncHandler(strategyController.createStrategy)
);

/**
 * @route   GET /api/v1/strategies
 * @desc    Get user's strategies with filters
 * @access  Private
 */
router.get(
  '/',
  authenticate,
  validate(getStrategiesSchema, 'query'),
  asyncHandler(strategyController.getStrategies)
);

/**
 * @route   GET /api/v1/strategies/:id
 * @desc    Get strategy by ID
 * @access  Private
 */
router.get(
  '/:id',
  authenticate,
  asyncHandler(strategyController.getStrategyById)
);

/**
 * @route   PUT /api/v1/strategies/:id
 * @desc    Update strategy
 * @access  Private
 */
router.put(
  '/:id',
  authenticate,
  validate(updateStrategySchema),
  asyncHandler(strategyController.updateStrategy)
);

/**
 * @route   DELETE /api/v1/strategies/:id
 * @desc    Delete strategy
 * @access  Private
 */
router.delete(
  '/:id',
  authenticate,
  asyncHandler(strategyController.deleteStrategy)
);

/**
 * @route   POST /api/v1/strategies/:id/clone
 * @desc    Clone/duplicate strategy
 * @access  Private
 */
router.post(
  '/:id/clone',
  authenticate,
  validate(Joi.object({
    name: Joi.string().required().min(3).max(100),
  })),
  asyncHandler(strategyController.cloneStrategy)
);

module.exports = router;