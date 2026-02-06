const routes = require('./routes/system.routes');
const SystemController = require('./controller/system.controller');
const SystemService = require('./service/system.service');

module.exports = {
  routes,
  SystemController,
  SystemService,
};