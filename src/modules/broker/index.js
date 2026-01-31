const routes = require('./routes/broker.routes');
const BrokerController = require('./controller/broker.controller');
const BrokerService = require('./service/broker.service');

module.exports = {
  routes,
  BrokerController,
  BrokerService,
};