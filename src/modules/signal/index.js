const routes = require('./routes/signal.routes');
const SignalController = require('./controller/signal.controller');
const SignalService = require('./service/signal.service');
const SignalSourceService = require('./service/signalsource.service');

module.exports = {
  routes,
  SignalController,
  SignalService,
  SignalSourceService,
};