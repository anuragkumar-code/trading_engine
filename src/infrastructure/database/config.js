const { Sequelize } = require('sequelize');
const config = require('../../shared/config');
const logger = require('../logger');

const env = config.app.env;
const dbConfig = require('../../shared/config/database')[env];

const sequelize = new Sequelize(
  dbConfig.database,
  dbConfig.username,
  dbConfig.password,
  {
    host: dbConfig.host,
    port: dbConfig.port,
    dialect: dbConfig.dialect,
    timezone: dbConfig.timezone || '+05:30',
    logging: dbConfig.logging ? (msg) => logger.debug(msg) : false,
    pool: dbConfig.pool,
    define: dbConfig.define,
    dialectOptions: dbConfig.dialectOptions || {},
  }
);

sequelize.addHook('afterConnect', async (connection) => {
  const tzName = dbConfig.timezoneName || 'Asia/Kolkata';
  try {
    await connection.query(`SET TIME ZONE '${tzName}'`);
  } catch (error) {
    logger.warn(`Failed to set DB session timezone to ${tzName}: ${error.message}`);
  }
});

module.exports = sequelize;
