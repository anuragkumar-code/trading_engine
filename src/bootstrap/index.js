const { initializeDatabase, closeDatabase } = require('./database');
const { initializeRedis, closeRedis } = require('./redis');
const { initializeQueue } = require('./queue');
const logger = require('../infrastructure/logger');

/**
 * Bootstrap application
 */
const bootstrap = async () => {
  try {
    logger.info('Starting application bootstrap...');
    
    // Initialize database
    await initializeDatabase();
    
    // Initialize Redis
    await initializeRedis();
    
    // Initialize queue workers
    initializeQueue();
    
    logger.info('Application bootstrap completed successfully');
  } catch (error) {
    logger.error('Application bootstrap failed:', error);
    throw error;
  }
};

/**
 * Graceful shutdown
 */
const shutdown = async () => {
  try {
    logger.info('Starting graceful shutdown...');
    
    const { closeWorkers } = require('../infrastructure/queue');
    await closeWorkers();
    
    await closeRedis();
    await closeDatabase();
    
    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
};

// Handle shutdown signals
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

module.exports = {
  bootstrap,
  shutdown,
};