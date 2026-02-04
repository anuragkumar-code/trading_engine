const routes = require('./routes/audit.routes');
const AuditController = require('./controller/audit.controller');
const AuditService = require('./service/audit.service');

module.exports = {
  routes,
  AuditController,
  AuditService,
};