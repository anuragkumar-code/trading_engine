const Joi = require('joi');
const { ORDER } = require('../../../shared/constants');

/**
 * Create mock signal validation schema
 */
const createMockSignalSchema = Joi.object({
  symbol: Joi.string()
    .required()
    .uppercase()
    .trim()
    .min(1)
    .max(50)
    .messages({
      'string.empty': 'Symbol is required',
      'any.required': 'Symbol is required',
    }),
  
  exchange: Joi.string()
    .required()
    .valid(...Object.values(ORDER.EXCHANGE))
    .messages({
      'any.only': `Exchange must be one of: ${Object.values(ORDER.EXCHANGE).join(', ')}`,
      'any.required': 'Exchange is required',
    }),
  
  transactionType: Joi.string()
    .required()
    .valid(...Object.values(ORDER.TRANSACTION_TYPE))
    .messages({
      'any.only': 'Transaction type must be BUY or SELL',
      'any.required': 'Transaction type is required',
    }),
  
  quantity: Joi.number()
    .integer()
    .required()
    .min(1)
    .messages({
      'number.base': 'Quantity must be a number',
      'number.min': 'Quantity must be at least 1',
      'any.required': 'Quantity is required',
    }),
  
  orderType: Joi.string()
    .valid(...Object.values(ORDER.ORDER_TYPE))
    .default('MARKET')
    .optional()
    .messages({
      'any.only': `Order type must be one of: ${Object.values(ORDER.ORDER_TYPE).join(', ')}`,
    }),
  
  productType: Joi.string()
    .valid(...Object.values(ORDER.PRODUCT_TYPE))
    .default('MIS')
    .optional()
    .messages({
      'any.only': `Product type must be one of: ${Object.values(ORDER.PRODUCT_TYPE).join(', ')}`,
    }),
  
  price: Joi.number()
    .optional()
    .min(0)
    .when('orderType', {
      is: 'LIMIT',
      then: Joi.required(),
    })
    .messages({
      'number.min': 'Price must be greater than or equal to 0',
      'any.required': 'Price is required for LIMIT orders',
    }),
  
  triggerPrice: Joi.number()
    .optional()
    .min(0)
    .when('orderType', {
      is: Joi.valid('SL', 'SL-M'),
      then: Joi.required(),
    })
    .messages({
      'number.min': 'Trigger price must be greater than or equal to 0',
      'any.required': 'Trigger price is required for SL/SL-M orders',
    }),
  
  validity: Joi.string()
    .valid(...Object.values(ORDER.VALIDITY))
    .default('DAY')
    .optional()
    .messages({
      'any.only': `Validity must be one of: ${Object.values(ORDER.VALIDITY).join(', ')}`,
    }),
  
  strategyId: Joi.string()
    .uuid()
    .optional()
    .messages({
      'string.guid': 'Invalid strategy ID format',
    }),
  
  metadata: Joi.object()
    .optional(),
});

module.exports = {
  createMockSignalSchema,
};