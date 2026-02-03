// const rateLimit = require('express-rate-limit');
// const RedisStore = require('rate-limit-redis');
// const redisClient = require('../../infrastructure/redis/client');
// const config = require('../config');

// /**
//  * Create rate limiter
//  * @param {Object} options - Rate limit options
//  */
// const createRateLimiter = (options = {}) => {
//   const defaultOptions = {
//     windowMs: config.app.rateLimit.windowMs,
//     max: config.app.rateLimit.maxRequests,
//     standardHeaders: true,
//     legacyHeaders: false,
//     handler: (req, res) => {
//       res.status(429).json({
//         success: false,
//         error: {
//           message: 'Too many requests, please try again later',
//           code: 'RATE_LIMIT_EXCEEDED',
//           statusCode: 429,
//         },
//       });
//     },
//     skip: (req) => {
//       // Skip rate limiting for health checks
//       return req.path === '/health' || req.path === '/api/health';
//     },
//   };
  
//   // Use Redis store if available
//   if (redisClient.isReady) {
//     defaultOptions.store = new RedisStore({
//       client: redisClient,
//       prefix: 'rl:',
//     });
//   }
  
//   return rateLimit({
//     ...defaultOptions,
//     ...options,
//   });
// };

// /**
//  * Strict rate limiter for sensitive endpoints
//  */
// const strictRateLimiter = createRateLimiter({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 5, // 5 requests per window
// });

// /**
//  * API rate limiter
//  */
// const apiRateLimiter = createRateLimiter({
//   windowMs: config.app.rateLimit.windowMs,
//   max: config.app.rateLimit.maxRequests,
// });

// /**
//  * Webhook rate limiter
//  */
// const webhookRateLimiter = createRateLimiter({
//   windowMs: 1 * 60 * 1000, // 1 minute
//   max: 60, // 60 requests per minute
// });

// module.exports = {
//   createRateLimiter,
//   strictRateLimiter,
//   apiRateLimiter,
//   webhookRateLimiter,
// };


const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const redisClient = require('../../infrastructure/redis/client');
const config = require('../config');

const createRateLimiter = (options = {}) => {
  const defaultOptions = {
    windowMs: config.app.rateLimit.windowMs,
    max: config.app.rateLimit.maxRequests,

    standardHeaders: true,
    legacyHeaders: false,

    handler: (req, res) => {
      res.status(429).json({
        success: false,
        error: {
          message: 'Too many requests, please try again later',
          code: 'RATE_LIMIT_EXCEEDED',
          statusCode: 429,
        },
      });
    },

    skip: (req) => {
      return req.path === '/health' || req.path === '/api/health';
    },
  };

  // Redis-backed limiter (if available)
  if (redisClient && redisClient.isReady) {
    defaultOptions.store = new RedisStore({
      sendCommand: (...args) => redisClient.sendCommand(args),
      prefix: 'rl:',
    });

    console.log('✅ Rate limiter using Redis');
  } else {
    console.warn('⚠️ Rate limiter using memory store');
  }

  return rateLimit({
    ...defaultOptions,
    ...options,
  });
};

const strictRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
});

const apiRateLimiter = createRateLimiter({
  windowMs: config.app.rateLimit.windowMs,
  max: config.app.rateLimit.maxRequests,
});

const webhookRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 60,
});

module.exports = {
  createRateLimiter,
  strictRateLimiter,
  apiRateLimiter,
  webhookRateLimiter,
};
