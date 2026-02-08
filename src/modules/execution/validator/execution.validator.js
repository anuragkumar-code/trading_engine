const Joi = require('joi');
const { ORDER } = require('../../../shared/constants');

/**
 * Get orders validation schema (query parameters)
 */
const getOrdersSchema = Joi.object({
  status: Joi.string()
    .valid(...Object.values(ORDER.ORDER_STATUS))
    .optional()
    .messages({
      'any.only': 'Invalid order status',
    }),
  
  symbol: Joi.string()
    .optional()
    .uppercase()
    .trim(),
  
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
    .max(100)
    .default(50)
    .optional(),
  
  offset: Joi.number()
    .integer()
    .min(0)
    .default(0)
    .optional(),
  
  sortBy: Joi.string()
    .valid('createdAt', 'placedAt', 'symbol', 'status')
    .default('createdAt')
    .optional(),
  
  sortOrder: Joi.string()
    .valid('ASC', 'DESC')
    .default('DESC')
    .optional(),
});

/**
 * Get order by ID validation schema (params)
 */
const getOrderByIdSchema = Joi.object({
  id: Joi.string()
    .uuid()
    .required()
    .messages({
      'string.guid': 'Invalid order ID format',
      'any.required': 'Order ID is required',
    }),
});

/**
 * Cancel order validation schema (params)
 */
const cancelOrderSchema = Joi.object({
  id: Joi.string()
    .uuid()
    .required()
    .messages({
      'string.guid': 'Invalid order ID format',
      'any.required': 'Order ID is required',
    }),
});

/**
 * Modify order validation schema
 */
const modifyOrderSchema = Joi.object({
  orderType: Joi.string()
    .valid(...Object.values(ORDER.ORDER_TYPE))
    .optional()
    .messages({
      'any.only': 'Invalid order type',
    }),
  
  quantity: Joi.number()
    .integer()
    .min(1)
    .optional()
    .messages({
      'number.min': 'Quantity must be at least 1',
    }),
  
  price: Joi.number()
    .min(0)
    .optional()
    .messages({
      'number.min': 'Price must be greater than or equal to 0',
    }),
  
  triggerPrice: Joi.number()
    .min(0)
    .optional()
    .messages({
      'number.min': 'Trigger price must be greater than or equal to 0',
    }),
});

/**
 * Get order statistics validation schema
 */
const getOrderStatsSchema = Joi.object({
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
});

/**
 * Exit position validation schema
 */
const exitPositionSchema = Joi.object({
  symbol: Joi.string()
    .required()
    .uppercase()
    .trim()
    .messages({
      'any.required': 'Symbol is required',
    }),
  
  exchange: Joi.string()
    .required()
    .valid(...Object.values(ORDER.EXCHANGE))
    .messages({
      'any.only': 'Invalid exchange',
      'any.required': 'Exchange is required',
    }),
  
  productType: Joi.string()
    .required()
    .valid(...Object.values(ORDER.PRODUCT_TYPE))
    .messages({
      'any.only': 'Invalid product type',
      'any.required': 'Product type is required',
    }),
});

module.exports = {
  getOrdersSchema,
  getOrderByIdSchema,
  cancelOrderSchema,
  modifyOrderSchema,
  getOrderStatsSchema,
  exitPositionSchema,
};