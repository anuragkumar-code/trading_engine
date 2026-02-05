const routes = require('./routes/user.routes');
const UserController = require('./controller/user.controller');
const UserService = require('./service/user.service');

module.exports = {
  routes,
  UserController,
  UserService,
};