const queues = require('./queues');
const workers = require('./workers');

module.exports = {
  ...queues,
  ...workers,
};