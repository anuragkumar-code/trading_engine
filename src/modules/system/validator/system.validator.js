const Joi = require('joi');
const { SYSTEM } = require('../../../shared/constants');

/**
 * Get system flags validation schema (query parameters)
 */
const getSystemFlagsSchema = Joi.object({
  flagType: Joi.string()
    .valid(...Object.values(SYSTEM.FLAG_TYPE))
    .optional()
    .messages({
      'any.only': 'Invalid flag type',
    }),
  
  enabled: Joi.boolean()
    .optional(),
});

/**
 * Get system flag by ID validation schema (params)
 */
const getSystemFlagByIdSchema = Joi.object({
  id: Joi.string()
    .uuid()
    .required()
    .messages({
      'string.guid': 'Invalid system flag ID format',
      'any.required': 'System flag ID is required',
    }),
});

/**
 * Update system flag validation schema
 */
const updateSystemFlagSchema = Joi.object({
  enabled: Joi.boolean()
    .required()
    .messages({
      'any.required': 'Enabled status is required',
    }),
  
  reason: Joi.string()
    .optional()
    .max(500)
    .messages({
      'string.max': 'Reason must not exceed 500 characters',
    }),
  
  metadata: Joi.object()
    .optional(),
});

/**
 * Create system flag validation schema
 */
const createSystemFlagSchema = Joi.object({
  flagType: Joi.string()
    .valid(...Object.values(SYSTEM.FLAG_TYPE))
    .required()
    .messages({
      'any.only': 'Invalid flag type. Must be KILL_SWITCH, MAINTENANCE, or CIRCUIT_BREAKER',
      'any.required': 'Flag type is required',
    }),
  
  enabled: Joi.boolean()
    .default(false)
    .optional(),
  
  reason: Joi.string()
    .optional()
    .max(500)
    .messages({
      'string.max': 'Reason must not exceed 500 characters',
    }),
  
  metadata: Joi.object()
    .optional(),
});

/**
 * Toggle maintenance mode validation schema
 */
const toggleMaintenanceSchema = Joi.object({
  enabled: Joi.boolean()
    .required()
    .messages({
      'any.required': 'Enabled status is required',
    }),
  
  reason: Joi.string()
    .when('enabled', {
      is: true,
      then: Joi.required(),
      otherwise: Joi.optional(),
    })
    .min(5)
    .max(500)
    .messages({
      'string.min': 'Reason must be at least 5 characters',
      'string.max': 'Reason must not exceed 500 characters',
      'any.required': 'Reason is required when enabling maintenance mode',
    }),
  
  estimatedDuration: Joi.number()
    .integer()
    .min(1)
    .optional()
    .messages({
      'number.min': 'Estimated duration must be at least 1 minute',
    }),
});

/**
 * Get system metrics validation schema
 */
const getSystemMetricsSchema = Joi.object({
  period: Joi.string()
    .valid('1h', '6h', '12h', '24h', '7d', '30d')
    .default('24h')
    .optional()
    .messages({
      'any.only': 'Invalid period. Must be 1h, 6h, 12h, 24h, 7d, or 30d',
    }),
});

/**
 * Get system logs validation schema
 */
const getSystemLogsSchema = Joi.object({
  level: Joi.string()
    .valid('error', 'warn', 'info', 'debug')
    .optional()
    .messages({
      'any.only': 'Invalid log level',
    }),
  
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
  
  limit: Joi.number()
    .integer()
    .min(1)
    .max(1000)
    .default(100)
    .optional(),
  
  offset: Joi.number()
    .integer()
    .min(0)
    .default(0)
    .optional(),
});

module.exports = {
  getSystemFlagsSchema,
  getSystemFlagByIdSchema,
  updateSystemFlagSchema,
  createSystemFlagSchema,
  toggleMaintenanceSchema,
  getSystemMetricsSchema,
  getSystemLogsSchema,
};