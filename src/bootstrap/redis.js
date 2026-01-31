const { redisClient } = require('../infrastructure/redis');
const logger = require('../infrastructure/logger');

/**
 * Initialize Redis connection
 */
const initializeRedis = async () => {
  try {
    if (!redisClient.isReady) {
      await redisClient.connect();
    }
    logger.info('Redis initialized successfully');
    return redisClient;
  } catch (error) {
    logger.error('Failed to initialize Redis:', error);
    throw error;
  }
};

/**
 * Close Redis connection
 */
const closeRedis = async () => {
  try {
    await redisClient.quit();
    logger.info('Redis connection closed');
  } catch (error) {
    logger.error('Error closing Redis:', error);
  }
};

module.exports = {
  initializeRedis,
  closeRedis,
};