const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const config = require('../../shared/config');

const logDir = path.resolve(process.cwd(), config.app.logging.dir);

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
  })
);

// Create transports
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

// Create logger
const logger = winston.createLogger({
  level: config.app.logging.level,
  format: logFormat,
  transports,
  exitOnError: false,
});

// Stream for Morgan
logger.stream = {
  write: (message) => {
    logger.info(message.trim());
  },
};

module.exports = logger;