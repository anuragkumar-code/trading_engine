const { sequelize } = require('../infrastructure/database/models');
const logger = require('../infrastructure/logger');

/**
 * Initialize database connection
 */
const initializeDatabase = async () => {
  try {
    await sequelize.authenticate();
    logger.info('Database connection established successfully');
    
    if (process.env.NODE_ENV === 'development') {
      await sequelize.sync({ alter: false });
      logger.info('Database models synchronized');
    }
    
    return sequelize;
  } catch (error) {
    logger.error('Unable to connect to database:', error);
    throw error;
  }
};

/**
 * Close database connection
 */
const closeDatabase = async () => {
  try {
    await sequelize.close();
    logger.info('Database connection closed');
  } catch (error) {
    logger.error('Error closing database:', error);
  }
};

module.exports = {
  initializeDatabase,
  closeDatabase,
};