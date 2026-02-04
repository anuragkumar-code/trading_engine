const Joi = require('joi');
const { SYSTEM } = require('../../../shared/constants');

/**
 * Get audit logs validation schema
 */
const getAuditLogsSchema = Joi.object({
  event: Joi.string()
    .valid(...Object.values(SYSTEM.AUDIT_EVENT))
    .optional(),
  
  userId: Joi.string()
    .uuid()
    .optional(),
  
  source: Joi.string()
    .optional(),
  
  result: Joi.string()
    .valid('SUCCESS', 'FAILED', 'PENDING', 'KILL_SWITCH', 'BLOCKED')
    .optional(),
  
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
  
  sortBy: Joi.string()
    .valid('createdAt', 'event', 'result')
    .default('createdAt')
    .optional(),
  
  sortOrder: Joi.string()
    .valid('ASC', 'DESC')
    .default('DESC')
    .optional(),
});

/**
 * Get audit log by ID validation schema
 */
const getAuditLogByIdSchema = Joi.object({
  id: Joi.string()
    .uuid()
    .required()
    .messages({
      'string.guid': 'Invalid audit log ID format',
      'any.required': 'Audit log ID is required',
    }),
});

/**
 * Export audit logs validation schema
 */
const exportAuditLogsSchema = Joi.object({
  event: Joi.string()
    .valid(...Object.values(SYSTEM.AUDIT_EVENT))
    .optional(),
  
  userId: Joi.string()
    .uuid()
    .optional(),
  
  source: Joi.string()
    .optional(),
  
  result: Joi.string()
    .valid('SUCCESS', 'FAILED', 'PENDING', 'KILL_SWITCH', 'BLOCKED')
    .optional(),
  
  startDate: Joi.date()
    .iso()
    .required()
    .messages({
      'any.required': 'Start date is required for export',
    }),
  
  endDate: Joi.date()
    .iso()
    .min(Joi.ref('startDate'))
    .required()
    .messages({
      'date.min': 'End date must be after start date',
      'any.required': 'End date is required for export',
    }),
  
  format: Joi.string()
    .valid('json', 'csv')
    .default('json')
    .optional(),
});

/**
 * Get audit stats validation schema
 */
const getAuditStatsSchema = Joi.object({
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
  
  groupBy: Joi.string()
    .valid('event', 'source', 'result', 'user', 'day')
    .default('event')
    .optional(),
});

module.exports = {
  getAuditLogsSchema,
  getAuditLogByIdSchema,
  exportAuditLogsSchema,
  getAuditStatsSchema,
};