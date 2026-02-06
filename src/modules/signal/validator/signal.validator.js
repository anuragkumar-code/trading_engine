const Joi = require('joi');
const { ORDER, SYSTEM } = require('../../../shared/constants');

/**
 * Create signal source validation schema
 */
const createSignalSourceSchema = Joi.object({
  name: Joi.string()
    .required()
    .trim()
    .min(3)
    .max(100)
    .messages({
      'string.min': 'Signal source name must be at least 3 characters',
      'string.max': 'Signal source name must not exceed 100 characters',
      'any.required': 'Signal source name is required',
    }),
  
  type: Joi.string()
    .required()
    .valid(...Object.values(ORDER.SIGNAL_SOURCE))
    .messages({
      'any.only': 'Invalid signal source type. Must be TELEGRAM, GOOGLE_SHEETS, or API',
      'any.required': 'Signal source type is required',
    }),
  
  config: Joi.object({
    // Telegram config
    botToken: Joi.string().optional(),
    chatId: Joi.string().optional(),
    
    // Google Sheets config
    spreadsheetId: Joi.string().optional(),
    sheetName: Joi.string().optional(),
    webhookUrl: Joi.string().uri().optional(),
    
    // API config
    apiKey: Joi.string().optional(),
    webhookUrl: Joi.string().uri().optional(),
    
    // Additional custom config
    customConfig: Joi.object().optional(),
  }).optional().default({}),
  
  webhookSecret: Joi.string()
    .optional()
    .min(32)
    .max(256)
    .messages({
      'string.min': 'Webhook secret must be at least 32 characters',
      'string.max': 'Webhook secret must not exceed 256 characters',
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
 * Update signal source validation schema
 */
const updateSignalSourceSchema = Joi.object({
  name: Joi.string()
    .optional()
    .trim()
    .min(3)
    .max(100)
    .messages({
      'string.min': 'Signal source name must be at least 3 characters',
      'string.max': 'Signal source name must not exceed 100 characters',
    }),
  
  config: Joi.object().optional(),
  
  webhookSecret: Joi.string()
    .optional()
    .min(32)
    .max(256)
    .messages({
      'string.min': 'Webhook secret must be at least 32 characters',
      'string.max': 'Webhook secret must not exceed 256 characters',
    }),
  
  status: Joi.string()
    .valid('ACTIVE', 'INACTIVE')
    .optional()
    .messages({
      'any.only': 'Status must be ACTIVE or INACTIVE',
    }),
});

/**
 * Get signal sources validation schema (query parameters)
 */
const getSignalSourcesSchema = Joi.object({
  type: Joi.string()
    .valid(...Object.values(ORDER.SIGNAL_SOURCE))
    .optional()
    .messages({
      'any.only': 'Invalid signal source type',
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
 * Get signal source by ID validation schema (params)
 */
const getSignalSourceByIdSchema = Joi.object({
  id: Joi.string()
    .uuid()
    .required()
    .messages({
      'string.guid': 'Invalid signal source ID format',
      'any.required': 'Signal source ID is required',
    }),
});

/**
 * Delete signal source validation schema (params)
 */
const deleteSignalSourceSchema = Joi.object({
  id: Joi.string()
    .uuid()
    .required()
    .messages({
      'string.guid': 'Invalid signal source ID format',
      'any.required': 'Signal source ID is required',
    }),
});

/**
 * Process signal via API validation schema
 */
const processSignalApiSchema = Joi.object({
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
      'number.min': 'Quantity must be at least 1',
      'any.required': 'Quantity is required',
    }),
  
  orderType: Joi.string()
    .valid(...Object.values(ORDER.ORDER_TYPE))
    .default('MARKET')
    .optional()
    .messages({
      'any.only': 'Invalid order type',
    }),
  
  productType: Joi.string()
    .valid(...Object.values(ORDER.PRODUCT_TYPE))
    .default('MIS')
    .optional()
    .messages({
      'any.only': 'Invalid product type',
    }),
  
  price: Joi.number()
    .optional()
    .min(0)
    .messages({
      'number.min': 'Price must be greater than or equal to 0',
    }),
  
  triggerPrice: Joi.number()
    .optional()
    .min(0)
    .messages({
      'number.min': 'Trigger price must be greater than or equal to 0',
    }),
  
  validity: Joi.string()
    .valid(...Object.values(ORDER.VALIDITY))
    .default('DAY')
    .optional()
    .messages({
      'any.only': 'Invalid validity',
    }),
  
  strategyId: Joi.string()
    .uuid()
    .optional()
    .messages({
      'string.guid': 'Invalid strategy ID format',
    }),
});

/**
 * Telegram webhook validation schema
 */
const telegramWebhookSchema = Joi.object({
  message: Joi.object({
    text: Joi.string().required(),
    chat: Joi.object({
      id: Joi.alternatives().try(Joi.string(), Joi.number()).required(),
    }).required(),
  }).required(),
}).unknown(true);

/**
 * Google Sheets webhook validation schema
 */
const googleSheetsWebhookSchema = Joi.object({
  symbol: Joi.string().required(),
  exchange: Joi.string().required(),
  transactionType: Joi.string().required(),
  quantity: Joi.number().required(),
  orderType: Joi.string().optional(),
  productType: Joi.string().optional(),
  price: Joi.number().optional(),
  triggerPrice: Joi.number().optional(),
}).unknown(true);

/**
 * Get trade intents validation schema
 */
const getTradeIntentsSchema = Joi.object({
  status: Joi.string()
    .valid('PENDING', 'APPROVED', 'REJECTED', 'EXECUTED', 'CANCELLED', 'FAILED')
    .optional()
    .messages({
      'any.only': 'Invalid status',
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
 * Get trade intent by ID validation schema
 */
const getTradeIntentByIdSchema = Joi.object({
  id: Joi.string()
    .uuid()
    .required()
    .messages({
      'string.guid': 'Invalid trade intent ID format',
      'any.required': 'Trade intent ID is required',
    }),
});

module.exports = {
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
};