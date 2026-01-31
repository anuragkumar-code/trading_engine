const { jwt } = require('../utils');
const { UnauthorizedError } = require('../errors');
const { User } = require('../../infrastructure/database/models');

/**
 * Authenticate JWT token
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('No token provided');
    }
    
    const token = authHeader.substring(7);
    const decoded = jwt.verifyAccessToken(token);
    
    const user = await User.findByPk(decoded.userId, {
      attributes: { exclude: ['password'] },
    });
    
    if (!user) {
      throw new UnauthorizedError('User not found');
    }
    
    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedError('Account is not active');
    }
    
    req.user = user;
    req.userId = user.id;
    
    next();
  } catch (error) {
    if (error.message === 'Invalid or expired token') {
      next(new UnauthorizedError('Invalid or expired token'));
    } else {
      next(error);
    }
  }
};

/**
 * Check user role
 * @param {Array<string>} roles - Allowed roles
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError('Not authenticated'));
    }
    
    if (!roles.includes(req.user.role)) {
      return next(new UnauthorizedError('Insufficient permissions'));
    }
    
    next();
  };
};

/**
 * Optional authentication (doesn't fail if no token)
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }
    
    const token = authHeader.substring(7);
    const decoded = jwt.verifyAccessToken(token);
    
    const user = await User.findByPk(decoded.userId, {
      attributes: { exclude: ['password'] },
    });
    
    if (user && user.status === 'ACTIVE') {
      req.user = user;
      req.userId = user.id;
    }
    
    next();
  } catch (error) {
    next();
  }
};

module.exports = {
  authenticate,
  authorize,
  optionalAuth,
};