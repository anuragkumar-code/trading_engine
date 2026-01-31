const app = require('./app');
const config = require('./shared/config');
const logger = require('./infrastructure/logger');
const { bootstrap } = require('./bootstrap');

const PORT = config.app.port;

/**
 * Start server
 */
const startServer = async () => {
  try {
    // Bootstrap application
    await bootstrap();
    
    // Start Express server
    const server = app.listen(PORT, () => {
      logger.info(`Trading Engine Server running on port ${PORT}`);
      logger.info(`Environment: ${config.app.env}`);
      logger.info(`Process ID: ${process.pid}`);
    });

    // Handle server errors
    server.on('error', (error) => {
      logger.error('Server error:', error);
      process.exit(1);
    });

    return server;
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
startServer();