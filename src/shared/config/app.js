module.exports = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,
  appName: process.env.APP_NAME || 'TradingEngine',
  timezone: process.env.APP_TIMEZONE || 'Asia/Kolkata',
  
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  
  encryption: {
    key: process.env.ENCRYPTION_KEY,
    algorithm: process.env.ENCRYPTION_ALGORITHM || 'aes-256-gcm',
  },

  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:8081',
  
  kite: {
    apiKey: process.env.KITE_API_KEY,
    apiSecret: process.env.KITE_API_SECRET,
    baseUrl: process.env.KITE_BASE_URL || 'https://api.kite.trade',
    redirectUrl: process.env.KITE_REDIRECT_URL || 'http://localhost:8081/broker/callback',
  },
  
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN,
    webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET,
  },
  
  sheets: {
    webhookSecret: process.env.SHEETS_WEBHOOK_SECRET,
    apiKey: process.env.SHEETS_API_KEY,
  },
  
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 900000,
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
  },
  
  risk: {
    maxDailyLossPercentage: parseFloat(process.env.MAX_DAILY_LOSS_PERCENTAGE) || 2.0,
    maxPositionSizePercentage: parseFloat(process.env.MAX_POSITION_SIZE_PERCENTAGE) || 5.0,
    maxOpenPositions: parseInt(process.env.MAX_OPEN_POSITIONS, 10) || 10,
    circuitBreakerThreshold: parseInt(process.env.CIRCUIT_BREAKER_THRESHOLD, 10) || 5,
    circuitBreakerWindowMs: parseInt(process.env.CIRCUIT_BREAKER_WINDOW_MS, 10) || 300000,
  },
  
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    dir: process.env.LOG_DIR || 'logs',
    maxSize: process.env.LOG_MAX_SIZE || '20m',
    maxFiles: process.env.LOG_MAX_FILES || '14d',
  },
  
  queue: {
    concurrency: parseInt(process.env.QUEUE_CONCURRENCY, 10) || 5,
    maxAttempts: parseInt(process.env.QUEUE_MAX_ATTEMPTS, 10) || 3,
    backoffDelay: parseInt(process.env.QUEUE_BACKOFF_DELAY, 10) || 5000,
  },
  
  system: {
    killSwitchEnabled: process.env.KILL_SWITCH_ENABLED === 'true',
    allowedIps: process.env.ALLOWED_IPS ? process.env.ALLOWED_IPS.split(',') : [],
  },
};
