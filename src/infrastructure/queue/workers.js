const { Worker } = require('bullmq');
const config = require('../../shared/config');
const logger = require('../logger');

const connection = {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  db: config.redis.db,
};

let signalWorker, executionWorker, riskWorker, auditWorker;

/**
 * Initialize all workers
 * @param {Object} processors - Worker processor functions
 */
const initializeWorkers = (processors) => {
  // Signal Processing Worker
  if (processors.signalProcessor) {
    signalWorker = new Worker(
      config.queue.queues.SIGNAL,
      processors.signalProcessor,
      {
        connection,
        concurrency: config.queue.concurrency,
      }
    );

    signalWorker.on('completed', (job) => {
      logger.info(`Signal job ${job.id} completed`);
    });

    signalWorker.on('failed', (job, err) => {
      logger.error(`Signal job ${job.id} failed:`, err);
    });
  }

  // Execution Worker
  if (processors.executionProcessor) {
    executionWorker = new Worker(
      config.queue.queues.EXECUTION,
      processors.executionProcessor,
      {
        connection,
        concurrency: config.queue.concurrency,
      }
    );

    executionWorker.on('completed', (job) => {
      logger.info(`Execution job ${job.id} completed`);
    });

    executionWorker.on('failed', (job, err) => {
      logger.error(`Execution job ${job.id} failed:`, err);
    });
  }

  // Risk Check Worker
  if (processors.riskProcessor) {
    riskWorker = new Worker(
      config.queue.queues.RISK,
      processors.riskProcessor,
      {
        connection,
        concurrency: config.queue.concurrency,
      }
    );

    riskWorker.on('completed', (job) => {
      logger.info(`Risk job ${job.id} completed`);
    });

    riskWorker.on('failed', (job, err) => {
      logger.error(`Risk job ${job.id} failed:`, err);
    });
  }

  // Audit Worker
  if (processors.auditProcessor) {
    auditWorker = new Worker(
      config.queue.queues.AUDIT,
      processors.auditProcessor,
      {
        connection,
        concurrency: config.queue.concurrency * 2, // Higher concurrency for audit
      }
    );

    auditWorker.on('completed', (job) => {
      logger.debug(`Audit job ${job.id} completed`);
    });

    auditWorker.on('failed', (job, err) => {
      logger.error(`Audit job ${job.id} failed:`, err);
    });
  }

  logger.info('All queue workers initialized');
};

/**
 * Close all workers gracefully
 */
const closeWorkers = async () => {
  const workers = [signalWorker, executionWorker, riskWorker, auditWorker].filter(Boolean);
  
  await Promise.all(workers.map(worker => worker.close()));
  logger.info('All workers closed');
};

module.exports = {
  initializeWorkers,
  closeWorkers,
};