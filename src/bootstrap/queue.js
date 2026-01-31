const { initializeWorkers } = require('../infrastructure/queue');
const logger = require('../infrastructure/logger');

// Import service processors (will be implemented)
let signalService, executionService, riskService, auditService;

/**
 * Signal processor
 */
const signalProcessor = async (job) => {
  const { signal, userId, source } = job.data;
  
  logger.info(`Processing signal job ${job.id}`, { userId, source });
  
  if (!signalService) {
    const { SignalService } = require('../modules/signal/service/signal.service');
    signalService = new SignalService();
  }
  
  try {
    const result = await signalService.processSignal(signal, userId, source);
    return result;
  } catch (error) {
    logger.error(`Signal processing failed for job ${job.id}:`, error);
    throw error;
  }
};

/**
 * Execution processor
 */
const executionProcessor = async (job) => {
  const { tradeIntentId } = job.data;
  
  logger.info(`Processing execution job ${job.id}`, { tradeIntentId });
  
  if (!executionService) {
    const { ExecutionService } = require('../modules/execution/service/execution.service');
    executionService = new ExecutionService();
  }
  
  try {
    const result = await executionService.executeTradeIntent(tradeIntentId);
    return result;
  } catch (error) {
    logger.error(`Execution failed for job ${job.id}:`, error);
    throw error;
  }
};

/**
 * Risk check processor
 */
const riskProcessor = async (job) => {
  const { tradeIntentId, userId } = job.data;
  
  logger.info(`Processing risk check job ${job.id}`, { tradeIntentId, userId });
  
  if (!riskService) {
    const { RiskService } = require('../modules/risk/service/risk.service');
    riskService = new RiskService();
  }
  
  try {
    const result = await riskService.checkTradeIntent(tradeIntentId, userId);
    return result;
  } catch (error) {
    logger.error(`Risk check failed for job ${job.id}:`, error);
    throw error;
  }
};

/**
 * Audit processor
 */
const auditProcessor = async (job) => {
  const auditData = job.data;
  
  logger.debug(`Processing audit job ${job.id}`);
  
  if (!auditService) {
    const { AuditService } = require('../modules/audit/service/audit.service');
    auditService = new AuditService();
  }
  
  try {
    await auditService.createAuditLog(auditData);
    return { success: true };
  } catch (error) {
    logger.error(`Audit logging failed for job ${job.id}:`, error);
    throw error;
  }
};

/**
 * Initialize queue workers
 */
const initializeQueue = () => {
  try {
    initializeWorkers({
      signalProcessor,
      executionProcessor,
      riskProcessor,
      auditProcessor,
    });
    
    logger.info('Queue workers initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize queue workers:', error);
    throw error;
  }
};

module.exports = {
  initializeQueue,
};