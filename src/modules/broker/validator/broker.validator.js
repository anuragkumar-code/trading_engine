const Joi = require('joi');

/**
 * Connect Kite account validation schema
 */
const connectKiteSchema = Joi.object({
  apiKey: Joi.string()
    .required()
    .trim()
    .messages({
      'any.required': 'API Key is required',
      'string.empty': 'API Key cannot be empty',
    }),
  
  apiSecret: Joi.string()
    .required()
    .trim()
    .messages({
      'any.required': 'API Secret is required',
      'string.empty': 'API Secret cannot be empty',
    }),
});

/**
 * Generate session validation schema
 */
const generateSessionSchema = Joi.object({
  requestToken: Joi.string()
    .required()
    .trim()
    .messages({
      'any.required': 'Request token is required',
      'string.empty': 'Request token cannot be empty',
    }),
  
  kiteAccountId: Joi.string()
    .uuid()
    .required()
    .messages({
      'any.required': 'Kite account ID is required',
      'string.guid': 'Invalid Kite account ID format',
    }),
});

/**
 * Refresh token validation schema
 */
const refreshKiteTokenSchema = Joi.object({
  kiteAccountId: Joi.string()
    .uuid()
    .required()
    .messages({
      'any.required': 'Kite account ID is required',
      'string.guid': 'Invalid Kite account ID format',
    }),
});

/**
 * Update account status validation schema
 */
const updateAccountStatusSchema = Joi.object({
  status: Joi.string()
    .valid('ACTIVE', 'INACTIVE')
    .required()
    .messages({
      'any.required': 'Status is required',
      'any.only': 'Status must be either ACTIVE or INACTIVE',
    }),
});

module.exports = {
  connectKiteSchema,
  generateSessionSchema,
  refreshKiteTokenSchema,
  updateAccountStatusSchema,
};