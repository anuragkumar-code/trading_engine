const logger = require('./winston');
const audit = require('./audit');

module.exports = {
  ...logger,
  audit,
};

// Export default logger methods
module.exports.info = logger.info.bind(logger);
module.exports.error = logger.error.bind(logger);
module.exports.warn = logger.warn.bind(logger);
module.exports.debug = logger.debug.bind(logger);