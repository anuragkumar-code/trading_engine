const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const config = require('../../shared/config');
const { hash } = require('../../shared/utils');

const logDir = path.resolve(process.cwd(), config.app.logging.dir, 'audit');

// Audit log format - immutable, complete information
const auditFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.json()
);

// Create audit logger
const auditLogger = winston.createLogger({
  level: 'info',
  format: auditFormat,
  transports: [
    new DailyRotateFile({
      filename: path.join(logDir, 'audit-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: config.app.logging.maxSize,
      maxFiles: '90d', // Keep audit logs for 90 days
      format: auditFormat,
    }),
  ],
  exitOnError: false,
});

/**
 * Log audit event
 * @param {Object} data - Audit data
 * @param {string} data.event - Event type
 * @param {number} data.userId - User ID
 * @param {string} data.source - Source of action
 * @param {string} data.ip - IP address
 * @param {Object} data.payload - Action payload
 * @param {string} data.result - Result of action
 * @param {Object} data.metadata - Additional metadata
 */
const logAudit = (data) => {
  const auditEntry = {
    timestamp: new Date().toISOString(),
    event: data.event,
    userId: data.userId || null,
    source: data.source || 'SYSTEM',
    ip: data.ip || null,
    payload: data.payload || {},
    payloadHash: data.payload ? hash.hash(data.payload) : null,
    result: data.result || 'SUCCESS',
    metadata: data.metadata || {},
  };
  
  auditLogger.info(auditEntry);
  
  return auditEntry;
};

/**
 * Log user action
 */
const logUserAction = (userId, action, details, ip) => {
  return logAudit({
    event: action,
    userId,
    source: 'USER',
    ip,
    payload: details,
    result: 'SUCCESS',
  });
};

/**
 * Log system action
 */
const logSystemAction = (action, details, result = 'SUCCESS') => {
  return logAudit({
    event: action,
    source: 'SYSTEM',
    payload: details,
    result,
  });
};

/**
 * Log signal received
 */
const logSignalReceived = (userId, source, signal, ip) => {
  return logAudit({
    event: 'SIGNAL_RECEIVED',
    userId,
    source,
    ip,
    payload: signal,
    result: 'SUCCESS',
  });
};

/**
 * Log trade intent created
 */
const logTradeIntent = (userId, intent, source, ip) => {
  return logAudit({
    event: 'TRADE_INTENT_CREATED',
    userId,
    source,
    ip,
    payload: intent,
    result: 'SUCCESS',
  });
};

/**
 * Log order placed
 */
const logOrderPlaced = (userId, order, result = 'SUCCESS') => {
  return logAudit({
    event: 'ORDER_PLACED',
    userId,
    source: 'EXECUTION',
    payload: order,
    result,
  });
};

/**
 * Log risk violation
 */
const logRiskViolation = (userId, violation, action) => {
  return logAudit({
    event: 'RISK_VIOLATION',
    userId,
    source: 'RISK',
    payload: violation,
    result: action,
  });
};

/**
 * Log kill switch event
 */
const logKillSwitch = (userId, action, reason, ip) => {
  return logAudit({
    event: action === 'ENABLE' ? 'KILL_SWITCH_TRIGGERED' : 'KILL_SWITCH_DISABLED',
    userId,
    source: 'SYSTEM',
    ip,
    payload: { reason },
    result: 'SUCCESS',
  });
};

module.exports = {
  auditLogger,
  logAudit,
  logUserAction,
  logSystemAction,
  logSignalReceived,
  logTradeIntent,
  logOrderPlaced,
  logRiskViolation,
  logKillSwitch,
};