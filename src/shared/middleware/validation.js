const { ValidationError } = require('../errors');

/**
 * Validate request using Joi schema
 * @param {Object} schema - Joi validation schema
 * @param {string} property - Property to validate (body, query, params)
 */
const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true,
    });
    
    if (error) {
      const details = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));
      
      return next(new ValidationError('Validation failed', 'VALIDATION_ERROR', details));
    }
    
    // Replace request property with validated value
    req[property] = value;
    next();
  };
};

/**
 * Validate multiple request properties
 * @param {Object} schemas - Object with schemas for body, query, params
 */
const validateMultiple = (schemas) => {
  return (req, res, next) => {
    const errors = [];
    
    Object.keys(schemas).forEach(property => {
      const { error, value } = schemas[property].validate(req[property], {
        abortEarly: false,
        stripUnknown: true,
      });
      
      if (error) {
        errors.push(...error.details.map(detail => ({
          property,
          field: detail.path.join('.'),
          message: detail.message,
        })));
      } else {
        req[property] = value;
      }
    });
    
    if (errors.length > 0) {
      return next(new ValidationError('Validation failed', 'VALIDATION_ERROR', errors));
    }
    
    next();
  };
};

module.exports = {
  validate,
  validateMultiple,
};