const Joi = require('joi');
const { SYSTEM } = require('../../../shared/constants');

/**
 * Get users validation schema (query parameters)
 */
const getUsersSchema = Joi.object({
  search: Joi.string()
    .optional()
    .trim()
    .min(1)
    .max(100)
    .messages({
      'string.min': 'Search term must be at least 1 character',
      'string.max': 'Search term must not exceed 100 characters',
    }),
  
  role: Joi.string()
    .valid(...Object.values(SYSTEM.USER_ROLE))
    .optional()
    .messages({
      'any.only': 'Invalid role',
    }),
  
  status: Joi.string()
    .valid(...Object.values(SYSTEM.ACCOUNT_STATUS))
    .optional()
    .messages({
      'any.only': 'Invalid status',
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
  
  sortBy: Joi.string()
    .valid('createdAt', 'email', 'firstName', 'lastName', 'lastLoginAt')
    .default('createdAt')
    .optional(),
  
  sortOrder: Joi.string()
    .valid('ASC', 'DESC')
    .default('DESC')
    .optional(),
});

/**
 * Get user by ID validation schema (params)
 */
const getUserByIdSchema = Joi.object({
  id: Joi.string()
    .uuid()
    .required()
    .messages({
      'string.guid': 'Invalid user ID format',
      'any.required': 'User ID is required',
    }),
});

/**
 * Update user validation schema
 */
const updateUserSchema = Joi.object({
  firstName: Joi.string()
    .min(2)
    .max(50)
    .optional()
    .trim()
    .messages({
      'string.min': 'First name must be at least 2 characters',
      'string.max': 'First name must not exceed 50 characters',
    }),
  
  lastName: Joi.string()
    .min(2)
    .max(50)
    .optional()
    .trim()
    .messages({
      'string.min': 'Last name must be at least 2 characters',
      'string.max': 'Last name must not exceed 50 characters',
    }),
  
  email: Joi.string()
    .email()
    .optional()
    .lowercase()
    .trim()
    .messages({
      'string.email': 'Please provide a valid email address',
    }),
});

/**
 * Update user role validation schema (Admin only)
 */
const updateUserRoleSchema = Joi.object({
  role: Joi.string()
    .valid(...Object.values(SYSTEM.USER_ROLE))
    .required()
    .messages({
      'any.only': 'Invalid role. Must be ADMIN, TRADER, or VIEWER',
      'any.required': 'Role is required',
    }),
});

/**
 * Update user status validation schema (Admin only)
 */
const updateUserStatusSchema = Joi.object({
  status: Joi.string()
    .valid(...Object.values(SYSTEM.ACCOUNT_STATUS))
    .required()
    .messages({
      'any.only': 'Invalid status. Must be ACTIVE, INACTIVE, or SUSPENDED',
      'any.required': 'Status is required',
    }),
  
  reason: Joi.string()
    .optional()
    .max(500)
    .messages({
      'string.max': 'Reason must not exceed 500 characters',
    }),
});

/**
 * Delete user validation schema (params)
 */
const deleteUserSchema = Joi.object({
  id: Joi.string()
    .uuid()
    .required()
    .messages({
      'string.guid': 'Invalid user ID format',
      'any.required': 'User ID is required',
    }),
});

/**
 * User statistics validation schema
 */
const getUserStatsSchema = Joi.object({
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

module.exports = {
  getUsersSchema,
  getUserByIdSchema,
  updateUserSchema,
  updateUserRoleSchema,
  updateUserStatusSchema,
  deleteUserSchema,
  getUserStatsSchema,
};