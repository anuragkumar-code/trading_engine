require('dotenv').config();

module.exports = {
  app: require('./app'),
  database: require('./database'),
  redis: require('./redis'),
  queue: require('./queue'),
};