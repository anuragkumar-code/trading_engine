const AppError = require('./AppError');
const errors = require('./errors');

module.exports = {
  AppError,
  ...errors,
};