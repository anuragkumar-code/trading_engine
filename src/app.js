const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const config = require('./shared/config');
const logger = require('./infrastructure/logger');
const { errorHandler, notFound } = require('./shared/middleware');

const app = express();

// Security middleware
app.use(helmet());

// CORS
app.use(cors({ 
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
if (config.app.env === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined', { stream: logger.stream }));
}

// Health check
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Trading Engine is running',
    timestamp: new Date().toISOString(),
    env: config.app.env,
  });
});

// API routes
app.use('/api/v1/auth', require('./modules/auth').routes);
app.use('/api/v1/users', require('./modules/user').routes);
app.use('/api/v1/brokers', require('./modules/broker').routes);
// app.use('/api/v1/signals', require('./modules/signal').routes);
app.use('/api/v1/strategies', require('./modules/strategy').routes);
// app.use('/api/v1/executions', require('./modules/execution').routes);
app.use('/api/v1/risk', require('./modules/risk').routes);
app.use('/api/v1/audit', require('./modules/audit').routes);
// app.use('/api/v1/system', require('./modules/system').routes);

// 404 handler
app.use(notFound);

// Global error handler
app.use(errorHandler.errorHandler);

module.exports = app;