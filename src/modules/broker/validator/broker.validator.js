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
 * Initiate Kite login validation schema
 * No input needed - just trigger login URL generation
 */
const initiateKiteLoginSchema = Joi.object({
  // No body parameters needed
});

/**
 * Generate session validation schema
 * @body {string} requestToken - Request token from Kite redirect URL
 */
const generateSessionSchema = Joi.object({
  requestToken: Joi.string()
    .required()
    .trim()
    .min(10)
    .messages({
      'string.empty': 'Request token is required',
      'string.min': 'Invalid request token format',
      'any.required': 'Request token is required',
    }),
});

/**
 * Refresh Kite token validation schema
 * No input needed - just trigger new login URL
 */
const refreshKiteTokenSchema = Joi.object({
  // No body parameters needed
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
  initiateKiteLoginSchema,
  generateSessionSchema,
  refreshKiteTokenSchema,
  updateAccountStatusSchema,
};