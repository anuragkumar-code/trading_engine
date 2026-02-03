// const Redis = require('redis');
// const config = require('../../shared/config');
// const logger = require('../logger');

// const redisConfig = config.redis;

// const redisClient = Redis.createClient({
//   socket: {
//     host: redisConfig.host,
//     port: redisConfig.port,
//   },
//   password: redisConfig.password,
//   database: redisConfig.db,
// });

// redisClient.on('error', (err) => {
//   logger.error('Redis Client Error:', err);
// });

// redisClient.on('connect', () => {
//   logger.info('Redis Client Connected');
// });

// redisClient.on('ready', () => {
//   logger.info('Redis Client Ready');
// });

// // Connect to Redis
// (async () => {
//   try {
//     await redisClient.connect();
//   } catch (error) {
//     logger.error('Redis Connection Error:', error);
//   }
// })();

// module.exports = redisClient;

const { createClient } = require('redis');
const config = require('../../shared/config');
const logger = require('../logger');

const redisConfig = config.redis;

// Force IPv4
const redisClient = createClient({
  url: `redis://${redisConfig.password ? `:${redisConfig.password}@` : ''}127.0.0.1:${redisConfig.port}/${redisConfig.db}`,
});

redisClient.on('error', (err) => {
  logger.error('Redis Client Error:', err);
});

redisClient.on('connect', () => {
  logger.info('Redis Client Connected');
});

redisClient.on('ready', () => {
  logger.info('Redis Client Ready');
});

module.exports = redisClient;
