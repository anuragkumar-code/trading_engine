const routes = require('./routes/auth.routes');
const AuthController = require('./controller/auth.controller');
const AuthService = require('./service/auth.service');

module.exports = {
  routes,
  AuthController,
  AuthService,
};