const cron = require('node-cron');
const logger = require('../infrastructure/logger');
const BrokerService = require('../modules/broker/service/broker.service');

class CronJobs {
  constructor() {
    this.brokerService = new BrokerService();
    this.jobs = [];
  }

  /**
   * Initialize all cron jobs
   */
  initialize() {
    logger.info('Initializing cron jobs...');

    // Check expired Kite tokens every hour
    this.scheduleKiteTokenCheck();

    logger.info(`${this.jobs.length} cron jobs initialized`);
  }

  /**
   * Schedule Kite token expiry check
   * Runs every hour to mark expired tokens
   */
  scheduleKiteTokenCheck() {
    const job = cron.schedule('0 * * * *', async () => {
      try {
        logger.info('Running Kite token expiry check...');
        
        const result = await this.brokerService.checkAndUpdateExpiredTokens();
        
        logger.info('Kite token expiry check completed', result);
      } catch (error) {
        logger.error('Error in Kite token expiry check:', error);
      }
    }, {
      scheduled: true,
      timezone: 'Asia/Kolkata', // IST timezone
    });

    this.jobs.push({
      name: 'Kite Token Expiry Check',
      schedule: '0 * * * *',
      job,
    });

    logger.info('Scheduled: Kite token expiry check (every hour)');
  }

  /**
   * Stop all cron jobs
   */
  stopAll() {
    logger.info('Stopping all cron jobs...');
    
    this.jobs.forEach(({ name, job }) => {
      job.stop();
      logger.info(`Stopped: ${name}`);
    });

    logger.info('All cron jobs stopped');
  }

  /**
   * Get all scheduled jobs
   */
  getJobs() {
    return this.jobs.map(({ name, schedule }) => ({
      name,
      schedule,
    }));
  }
}

module.exports = new CronJobs();