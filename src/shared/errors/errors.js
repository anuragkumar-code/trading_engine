const AppError = require('./AppError');

class BadRequestError extends AppError {
  constructor(message = 'Bad Request', code = null) {
    super(message, 400, code);
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized', code = null) {
    super(message, 401, code);
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Forbidden', code = null) {
    super(message, 403, code);
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found', code = null) {
    super(message, 404, code);
  }
}

class ConflictError extends AppError {
  constructor(message = 'Conflict', code = null) {
    super(message, 409, code);
  }
}

class ValidationError extends AppError {
  constructor(message = 'Validation failed', code = null, details = null) {
    super(message, 422, code);
    this.details = details;
  }
}

class InternalServerError extends AppError {
  constructor(message = 'Internal Server Error', code = null) {
    super(message, 500, code);
  }
}

class ServiceUnavailableError extends AppError {
  constructor(message = 'Service Unavailable', code = null) {
    super(message, 503, code);
  }
}

class RiskViolationError extends AppError {
  constructor(message = 'Risk limit violated', code = 'RISK_VIOLATION', details = null) {
    super(message, 403, code);
    this.details = details;
  }
}

class KillSwitchError extends AppError {
  constructor(message = 'Kill switch is enabled', code = 'KILL_SWITCH_ACTIVE') {
    super(message, 503, code);
  }
}

class OrderExecutionError extends AppError {
  constructor(message = 'Order execution failed', code = 'EXECUTION_FAILED', details = null) {
    super(message, 500, code);
    this.details = details;
  }
}

module.exports = {
  AppError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ValidationError,
  InternalServerError,
  ServiceUnavailableError,
  RiskViolationError,
  KillSwitchError,
  OrderExecutionError,
};