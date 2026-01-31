const { Queue } = require('bullmq');
const config = require('../../shared/config');
const logger = require('../logger');

const connection = {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  db: config.redis.db,
};

const defaultJobOptions = config.queue.defaultJobOptions;

// Create queues
const signalQueue = new Queue(config.queue.queues.SIGNAL, {
  connection,
  defaultJobOptions,
});

const executionQueue = new Queue(config.queue.queues.EXECUTION, {
  connection,
  defaultJobOptions,
});

const riskQueue = new Queue(config.queue.queues.RISK, {
  connection,
  defaultJobOptions,
});

const auditQueue = new Queue(config.queue.queues.AUDIT, {
  connection,
  defaultJobOptions,
});

// Queue event handlers
const setupQueueEvents = (queue, name) => {
  queue.on('error', (error) => {
    logger.error(`Queue ${name} error:`, error);
  });

  queue.on('waiting', (jobId) => {
    logger.debug(`Job ${jobId} waiting in ${name}`);
  });

  queue.on('active', (job) => {
    logger.debug(`Job ${job.id} active in ${name}`);
  });

  queue.on('completed', (job) => {
    logger.info(`Job ${job.id} completed in ${name}`);
  });

  queue.on('failed', (job, error) => {
    logger.error(`Job ${job.id} failed in ${name}:`, error);
  });
};

setupQueueEvents(signalQueue, 'SIGNAL');
setupQueueEvents(executionQueue, 'EXECUTION');
setupQueueEvents(riskQueue, 'RISK');
setupQueueEvents(auditQueue, 'AUDIT');

module.exports = {
  signalQueue,
  executionQueue,
  riskQueue,
  auditQueue,
};