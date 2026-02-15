const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const config = require('../../shared/config');

const logDir = path.resolve(process.cwd(), config.app.logging.dir);

/**
 * Safe JSON stringify to prevent circular structure crashes
 */
function safeStringify(obj) {
  const seen = new WeakSet();

  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return '[Circular]';
      }
      seen.add(value);
    }
    return value;
  });
}

/**
 * Normalize meta object before logging
 * Prevents logging huge or circular axios objects
 */
function normalizeMeta(meta) {
  if (!meta || typeof meta !== 'object') return meta;

  // Axios error detection
  if (meta.isAxiosError) {
    return {
      message: meta.message,
      status: meta.response?.status,
      data: meta.response?.data,
      url: meta.config?.url,
      method: meta.config?.method,
    };
  }

  return meta;
}

// JSON format for file logs
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    const normalized = normalizeMeta(meta);

    return safeStringify({
      timestamp,
      level,
      message,
      stack,
      ...normalized,
    });
  })
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;

    if (stack) {
      msg += `\n${stack}`;
    }

    const normalized = normalizeMeta(meta);

    if (Object.keys(normalized || {}).length > 0) {
      msg += ` ${safeStringify(normalized)}`;
    }

    return msg;
  })
);

const transports = [];

// Console transport
transports.push(
  new winston.transports.Console({
    format: config.app.env === 'development' ? consoleFormat : logFormat,
  })
);

// File transport - All logs
transports.push(
  new DailyRotateFile({
    filename: path.join(logDir, 'app-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: config.app.logging.maxSize,
    maxFiles: config.app.logging.maxFiles,
    format: logFormat,
  })
);

// File transport - Error logs
transports.push(
  new DailyRotateFile({
    filename: path.join(logDir, 'error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: config.app.logging.maxSize,
    maxFiles: config.app.logging.maxFiles,
    level: 'error',
    format: logFormat,
  })
);

const logger = winston.createLogger({
  level: config.app.logging.level,
  transports,
  exitOnError: false,
});

logger.stream = {
  write: (message) => {
    logger.info(message.trim());
  },
};

module.exports = logger;
