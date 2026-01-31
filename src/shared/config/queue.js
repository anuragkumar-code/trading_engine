const config = require('./app');

module.exports = {
  defaultJobOptions: {
    attempts: config.queue.maxAttempts,
    backoff: {
      type: 'exponential',
      delay: config.queue.backoffDelay,
    },
    removeOnComplete: {
      count: 1000,
      age: 24 * 3600, // 24 hours
    },
    removeOnFail: {
      count: 5000,
      age: 7 * 24 * 3600, // 7 days
    },
  },
  
  queues: {
    SIGNAL: 'signal_queue',
    EXECUTION: 'execution_queue',
    RISK: 'risk_queue',
    AUDIT: 'audit_queue',
  },
  
  concurrency: config.queue.concurrency,
};