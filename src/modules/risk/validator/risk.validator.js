const Joi = require('joi');
const { RISK } = require('../../../shared/constants');

/**
 * Create risk limit validation schema
 */
const createRiskLimitSchema = Joi.object({
  limitType: Joi.string()
    .valid(...Object.values(RISK.LIMIT_TYPE))
    .required()
    .messages({
      'any.only': 'Invalid limit type. Must be DAILY_LOSS, POSITION_SIZE, MAX_POSITIONS, or MAX_DRAWDOWN',
      'any.required': 'Limit type is required',
    }),
  
  value: Joi.number()
    .required()
    .min(0)
    .messages({
      'number.base': 'Value must be a number',
      'number.min': 'Value must be greater than or equal to 0',
      'any.required': 'Value is required',
    }),
  
  unit: Joi.string()
    .valid('PERCENTAGE', 'ABSOLUTE', 'COUNT')
    .required()
    .messages({
      'any.only': 'Unit must be PERCENTAGE, ABSOLUTE, or COUNT',
      'any.required': 'Unit is required',
    }),
  
  status: Joi.string()
    .valid('ACTIVE', 'INACTIVE')
    .default('ACTIVE')
    .optional()
    .messages({
      'any.only': 'Status must be ACTIVE or INACTIVE',
    }),
});

/**
 * Update risk limit validation schema
 */
const updateRiskLimitSchema = Joi.object({
  value: Joi.number()
    .optional()
    .min(0)
    .messages({
      'number.base': 'Value must be a number',
      'number.min': 'Value must be greater than or equal to 0',
    }),
  
  unit: Joi.string()
    .valid('PERCENTAGE', 'ABSOLUTE', 'COUNT')
    .optional()
    .messages({
      'any.only': 'Unit must be PERCENTAGE, ABSOLUTE, or COUNT',
    }),
  
  status: Joi.string()
    .valid('ACTIVE', 'INACTIVE')
    .optional()
    .messages({
      'any.only': 'Status must be ACTIVE or INACTIVE',
    }),
});

/**
 * Get risk limits validation schema (query parameters)
 */
const getRiskLimitsSchema = Joi.object({
  limitType: Joi.string()
    .valid(...Object.values(RISK.LIMIT_TYPE))
    .optional()
    .messages({
      'any.only': 'Invalid limit type',
    }),
  
  status: Joi.string()
    .valid('ACTIVE', 'INACTIVE')
    .optional()
    .messages({
      'any.only': 'Status must be ACTIVE or INACTIVE',
    }),
  
  limit: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .default(20)
    .optional(),
  
  offset: Joi.number()
    .integer()
    .min(0)
    .default(0)
    .optional(),
});

/**
 * Get risk limit by ID validation schema (params)
 */
const getRiskLimitByIdSchema = Joi.object({
  id: Joi.string()
    .uuid()
    .required()
    .messages({
      'string.guid': 'Invalid risk limit ID format',
      'any.required': 'Risk limit ID is required',
    }),
});

/**
 * Delete risk limit validation schema (params)
 */
const deleteRiskLimitSchema = Joi.object({
  id: Joi.string()
    .uuid()
    .required()
    .messages({
      'string.guid': 'Invalid risk limit ID format',
      'any.required': 'Risk limit ID is required',
    }),
});

/**
 * Kill switch enable validation schema
 */
const enableKillSwitchSchema = Joi.object({
  reason: Joi.string()
    .required()
    .min(5)
    .max(500)
    .messages({
      'string.min': 'Reason must be at least 5 characters',
      'string.max': 'Reason must not exceed 500 characters',
      'any.required': 'Reason is required',
    }),
});

/**
 * Check trade intent validation schema
 */
const checkTradeIntentSchema = Joi.object({
  tradeIntentId: Joi.string()
    .uuid()
    .required()
    .messages({
      'string.guid': 'Invalid trade intent ID format',
      'any.required': 'Trade intent ID is required',
    }),
});

/**
 * Get risk violations validation schema
 */
const getRiskViolationsSchema = Joi.object({
  startDate: Joi.date()
    .iso()
    .optional(),
  
  endDate: Joi.date()
    .iso()
    .min(Joi.ref('startDate'))
    .optional()
    .messages({
      'date.min': 'End date must be after start date',
    }),
  
  violationType: Joi.string()
    .valid(...Object.values(RISK.VIOLATION_TYPE))
    .optional()
    .messages({
      'any.only': 'Invalid violation type',
    }),
  
  limit: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .default(20)
    .optional(),
  
  offset: Joi.number()
    .integer()
    .min(0)
    .default(0)
    .optional(),
});

module.exports = {
  createRiskLimitSchema,
  updateRiskLimitSchema,
  getRiskLimitsSchema,
  getRiskLimitByIdSchema,
  deleteRiskLimitSchema,
  enableKillSwitchSchema,
  checkTradeIntentSchema,
  getRiskViolationsSchema,
};