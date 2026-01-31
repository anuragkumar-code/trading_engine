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
    logging: dbConfig.logging ? (msg) => logger.debug(msg) : false,
    pool: dbConfig.pool,
    define: dbConfig.define,
  }
);

module.exports = sequelize;