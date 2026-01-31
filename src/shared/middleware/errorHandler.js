const logger = require('../../infrastructure/logger');
const { AppError } = require('../errors');

/**
 * Global error handler
 */
const errorHandler = (err, req, res, next) => {
  let error = err;
  
  // Log error
  logger.error('Error occurred:', {
    error: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userId: req.userId,
  });
  
  // Handle specific error types
  if (err.name === 'SequelizeValidationError') {
    error = new AppError('Validation error', 422, 'VALIDATION_ERROR');
    error.details = err.errors.map(e => ({
      field: e.path,
      message: e.message,
    }));
  } else if (err.name === 'SequelizeUniqueConstraintError') {
    error = new AppError('Duplicate entry', 409, 'DUPLICATE_ENTRY');
  } else if (err.name === 'SequelizeForeignKeyConstraintError') {
    error = new AppError('Invalid reference', 400, 'INVALID_REFERENCE');
  } else if (err.name === 'SequelizeDatabaseError') {
    error = new AppError('Database error', 500, 'DATABASE_ERROR');
  }
  
  // Default to 500 if not operational error
  if (!(error instanceof AppError)) {
    error = new AppError(
      process.env.NODE_ENV === 'production' 
        ? 'Something went wrong' 
        : err.message,
      500,
      'INTERNAL_ERROR',
      false
    );
  }
  
  // Send response
  const response = {
    success: false,
    error: {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      timestamp: error.timestamp,
    },
  };
  
  // Add details if present
  if (error.details) {
    response.error.details = error.details;
  }
  
  // Add stack trace in development
  if (process.env.NODE_ENV === 'development' && error.stack) {
    response.error.stack = error.stack;
  }
  
  res.status(error.statusCode).json(response);
};

/**
 * Handle 404 errors
 */
const notFound = (req, res, next) => {
  const error = new AppError(
    `Route ${req.originalUrl} not found`,
    404,
    'NOT_FOUND'
  );
  next(error);
};

/**
 * Async handler wrapper
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = {
  errorHandler,
  notFound,
  asyncHandler,
};