const routes = require('./routes/risk.routes');
const RiskController = require('./controller/risk.controller');
const RiskService = require('./service/risk.service');
const RiskLimitService = require('./service/risklimit.service');
const KillSwitchService = require('./service/killswitch.service');

module.exports = {
  routes,
  RiskController,
  RiskService,
  RiskLimitService,
  KillSwitchService,
};