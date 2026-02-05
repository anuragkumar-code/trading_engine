const Joi = require('joi');

/**
 * Create strategy validation schema
 */
const createStrategySchema = Joi.object({
  name: Joi.string()
    .required()
    .trim()
    .min(3)
    .max(100)
    .messages({
      'string.min': 'Strategy name must be at least 3 characters',
      'string.max': 'Strategy name must not exceed 100 characters',
      'any.required': 'Strategy name is required',
    }),
  
  description: Joi.string()
    .optional()
    .max(500)
    .messages({
      'string.max': 'Description must not exceed 500 characters',
    }),
  
  config: Joi.object({
    // Trading parameters
    maxPositionSize: Joi.number()
      .optional()
      .min(1)
      .messages({
        'number.min': 'Max position size must be at least 1',
      }),
    
    stopLossPercentage: Joi.number()
      .optional()
      .min(0.1)
      .max(100)
      .messages({
        'number.min': 'Stop loss must be at least 0.1%',
        'number.max': 'Stop loss cannot exceed 100%',
      }),
    
    targetPercentage: Joi.number()
      .optional()
      .min(0.1)
      .max(1000)
      .messages({
        'number.min': 'Target must be at least 0.1%',
        'number.max': 'Target cannot exceed 1000%',
      }),
    
    // Timeframe
    timeframe: Joi.string()
      .optional()
      .valid('1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '1d', '1w')
      .messages({
        'any.only': 'Invalid timeframe',
      }),
    
    // Product type
    productType: Joi.string()
      .optional()
      .valid('CNC', 'MIS', 'NRML')
      .default('MIS')
      .messages({
        'any.only': 'Product type must be CNC, MIS, or NRML',
      }),
    
    // Order type
    orderType: Joi.string()
      .optional()
      .valid('MARKET', 'LIMIT', 'SL', 'SL-M')
      .default('MARKET')
      .messages({
        'any.only': 'Invalid order type',
      }),
    
    // Exchanges
    exchanges: Joi.array()
      .items(Joi.string().valid('NSE', 'BSE', 'NFO', 'BFO', 'CDS', 'MCX'))
      .optional()
      .messages({
        'array.includes': 'Invalid exchange',
      }),
    
    // Symbols filter
    symbols: Joi.array()
      .items(Joi.string())
      .optional(),
    
    // Trading hours
    tradingHours: Joi.object({
      start: Joi.string()
        .pattern(/^([01]\d|2[0-3]):([0-5]\d)$/)
        .optional()
        .messages({
          'string.pattern.base': 'Start time must be in HH:mm format',
        }),
      
      end: Joi.string()
        .pattern(/^([01]\d|2[0-3]):([0-5]\d)$/)
        .optional()
        .messages({
          'string.pattern.base': 'End time must be in HH:mm format',
        }),
    }).optional(),
    
    // Risk parameters
    riskPerTrade: Joi.number()
      .optional()
      .min(0.1)
      .max(10)
      .messages({
        'number.min': 'Risk per trade must be at least 0.1%',
        'number.max': 'Risk per trade cannot exceed 10%',
      }),
    
    // Additional custom parameters
    customParams: Joi.object().optional(),
    
  }).optional().default({}),
  
  status: Joi.string()
    .valid('ACTIVE', 'INACTIVE', 'PAUSED')
    .default('ACTIVE')
    .optional()
    .messages({
      'any.only': 'Status must be ACTIVE, INACTIVE, or PAUSED',
    }),
});

/**
 * Update strategy validation schema
 */
const updateStrategySchema = Joi.object({
  name: Joi.string()
    .optional()
    .trim()
    .min(3)
    .max(100)
    .messages({
      'string.min': 'Strategy name must be at least 3 characters',
      'string.max': 'Strategy name must not exceed 100 characters',
    }),
  
  description: Joi.string()
    .optional()
    .max(500)
    .messages({
      'string.max': 'Description must not exceed 500 characters',
    }),
  
  config: Joi.object({
    maxPositionSize: Joi.number().optional().min(1),
    stopLossPercentage: Joi.number().optional().min(0.1).max(100),
    targetPercentage: Joi.number().optional().min(0.1).max(1000),
    timeframe: Joi.string().optional().valid('1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '1d', '1w'),
    productType: Joi.string().optional().valid('CNC', 'MIS', 'NRML'),
    orderType: Joi.string().optional().valid('MARKET', 'LIMIT', 'SL', 'SL-M'),
    exchanges: Joi.array().items(Joi.string().valid('NSE', 'BSE', 'NFO', 'BFO', 'CDS', 'MCX')).optional(),
    symbols: Joi.array().items(Joi.string()).optional(),
    tradingHours: Joi.object({
      start: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
      end: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
    }).optional(),
    riskPerTrade: Joi.number().optional().min(0.1).max(10),
    customParams: Joi.object().optional(),
  }).optional(),
  
  status: Joi.string()
    .valid('ACTIVE', 'INACTIVE', 'PAUSED')
    .optional()
    .messages({
      'any.only': 'Status must be ACTIVE, INACTIVE, or PAUSED',
    }),
});

/**
 * Get strategies validation schema (query parameters)
 */
const getStrategiesSchema = Joi.object({
  status: Joi.string()
    .valid('ACTIVE', 'INACTIVE', 'PAUSED')
    .optional()
    .messages({
      'any.only': 'Invalid status',
    }),
  
  search: Joi.string()
    .optional()
    .trim()
    .min(1)
    .max(100),
  
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
  
  sortBy: Joi.string()
    .valid('createdAt', 'name', 'status')
    .default('createdAt')
    .optional(),
  
  sortOrder: Joi.string()
    .valid('ASC', 'DESC')
    .default('DESC')
    .optional(),
});

/**
 * Get strategy by ID validation schema (params)
 */
const getStrategyByIdSchema = Joi.object({
  id: Joi.string()
    .uuid()
    .required()
    .messages({
      'string.guid': 'Invalid strategy ID format',
      'any.required': 'Strategy ID is required',
    }),
});

/**
 * Delete strategy validation schema (params)
 */
const deleteStrategySchema = Joi.object({
  id: Joi.string()
    .uuid()
    .required()
    .messages({
      'string.guid': 'Invalid strategy ID format',
      'any.required': 'Strategy ID is required',
    }),
});

module.exports = {
  createStrategySchema,
  updateStrategySchema,
  getStrategiesSchema,
  getStrategyByIdSchema,
  deleteStrategySchema,
};