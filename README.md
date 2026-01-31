# Trading Execution Engine

Production-grade automated trading execution engine built with Node.js, Express, PostgreSQL, Redis, and BullMQ.

## 🎯 Features

- **Multi-Source Signal Ingestion**: Telegram Bot + Google Sheets webhooks
- **Risk Management**: Daily loss limits, position sizing, circuit breakers
- **Kill Switch**: Global trading halt with automatic position square-off
- **Order Execution**: Zerodha Kite API integration
- **Audit Trail**: Complete immutable logging of all actions
- **Queue-Based Processing**: Async job processing with BullMQ
- **Security**: AES-256 encryption, JWT authentication, HMAC webhook validation

## 📋 Prerequisites

- Node.js >= 18.0.0
- PostgreSQL >= 12
- Redis >= 6.0
- Zerodha Kite API credentials

## 🚀 Quick Start

### 1. Clone and Install

```bash
git clone <repository-url>
cd trading-engine
npm install
```

### 2. Environment Configuration

```bash
cp .env.example .env
# Edit .env with your configuration
```

### 3. Database Setup

```bash
# Create database
createdb trading_engine

# Run migrations
npm run migrate
```

### 4. Start Application

```bash
# Development
npm run dev

# Production
npm start
```

## 🏗️ Architecture

### Directory Structure

```
src/
├── app.js                      # Express app
├── server.js                   # Server entry point
├── bootstrap/                  # Application initialization
│   ├── database.js
│   ├── redis.js
│   └── queue.js
├── infrastructure/             # Core infrastructure
│   ├── database/
│   │   ├── models/            # Sequelize models
│   │   └── migrations/
│   ├── redis/                 # Redis client & cache
│   ├── queue/                 # BullMQ queues & workers
│   ├── logger/                # Winston logging
│   └── http/                  # External API clients
├── shared/                    # Shared utilities
│   ├── config/               # Configuration
│   ├── utils/                # Encryption, JWT, HMAC
│   ├── errors/               # Custom errors
│   ├── constants/            # System constants
│   └── middleware/           # Express middleware
└── modules/                  # Domain modules (DDD)
    ├── auth/
    ├── user/
    ├── broker/
    ├── signal/
    ├── strategy/
    ├── execution/
    ├── risk/
    ├── audit/
    └── system/
```

### Module Structure (DDD Pattern)

Each module follows this structure:

```
module/
├── routes/          # Express routes
├── controller/      # Request handlers
├── service/         # Business logic
├── validator/       # Joi validation schemas
└── index.js         # Module exports
```

## 🔐 Security Features

### Encryption
- **AES-256-GCM**: Encrypts sensitive data (API keys, tokens)
- **bcrypt**: Password hashing with salt
- **SHA-256**: API key hashing

### Authentication
- **JWT**: Access & refresh tokens
- **Role-based**: ADMIN, TRADER, VIEWER roles

### Webhook Security
- **HMAC SHA-256**: Webhook signature validation
- **Rate Limiting**: Prevents abuse
- **IP Filtering**: Optional IP whitelisting

## 📊 Database Schema

### Core Tables

- **users**: User accounts
- **kite_accounts**: Broker API credentials
- **strategies**: Trading strategies
- **signal_sources**: Signal source configuration
- **trade_intents**: Parsed trading signals
- **orders**: Executed orders
- **risk_limits**: User risk limits
- **audit_logs**: Immutable audit trail
- **system_flags**: Kill switch and system flags

## 🔄 Signal Processing Flow

```
Signal Received (Telegram/Sheets)
          ↓
    Parse & Validate
          ↓
  Create TradeIntent
          ↓
    Risk Checks ←→ Kill Switch Check
          ↓
  Queue for Execution
          ↓
   Place Order (Kite API)
          ↓
     Update Status
          ↓
    Audit Log
```

## ⚡ Queue System

### Queues

1. **signal_queue**: Signal processing
2. **execution_queue**: Order execution
3. **risk_queue**: Risk checks
4. **audit_queue**: Audit logging

### Worker Configuration

- Concurrent processing
- Exponential backoff retry
- Job result retention
- Dead letter handling

## 🛡️ Risk Management

### Kill Switch

**Triggers:**
- Manual activation
- Daily loss limit breach
- Circuit breaker threshold
- Maximum position count exceeded

**Actions:**
- Block new orders
- Cancel pending orders
- Square-off all positions
- Send alerts

### Risk Limits

- **Daily Loss**: Percentage-based cap
- **Position Size**: Max position as % of capital
- **Open Positions**: Maximum concurrent positions
- **Circuit Breaker**: Consecutive failures threshold

## 📝 API Endpoints

### Authentication
```
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh
POST   /api/v1/auth/logout
```

### Signals
```
POST   /api/v1/signals/telegram/webhook
POST   /api/v1/signals/sheets/webhook
GET    /api/v1/signals/intents
GET    /api/v1/signals/intents/:id
```

### Execution
```
GET    /api/v1/executions/orders
GET    /api/v1/executions/orders/:id
POST   /api/v1/executions/orders/:id/cancel
GET    /api/v1/executions/positions
```

### Risk
```
GET    /api/v1/risk/limits
POST   /api/v1/risk/limits
PUT    /api/v1/risk/limits/:id
POST   /api/v1/risk/killswitch/enable
POST   /api/v1/risk/killswitch/disable
GET    /api/v1/risk/killswitch/status
```

### System
```
GET    /api/v1/system/health
GET    /api/v1/system/metrics
GET    /api/v1/system/flags
```

## 📮 Telegram Integration

### Setup

1. Create bot via @BotFather
2. Get bot token
3. Set webhook URL:
```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -d "url=https://your-domain.com/api/v1/signals/telegram/webhook"
```

### Signal Format

```
BUY RELIANCE NSE
Qty: 10
Price: 2450.50
Type: LIMIT
Product: MIS
```

## 📊 Google Sheets Integration

### Setup

1. Install Apps Script webhook
2. Configure API key & secret
3. Sheet format:
```
| Symbol | Exchange | Type | Qty | Price | Order Type | Product |
|--------|----------|------|-----|-------|-----------|---------|
| INFY   | NSE      | BUY  | 100 | 1450  | MARKET    | CNC     |
```

### Webhook Request

```javascript
POST /api/v1/signals/sheets/webhook
Headers:
  X-API-Key: <api_key>
  X-Signature: <hmac_signature>
Body: {
  symbol, exchange, transactionType, quantity, price, orderType, productType
}
```

## 📈 Monitoring & Logging

### Log Files

```
logs/
├── app-YYYY-MM-DD.log           # Application logs
├── error-YYYY-MM-DD.log         # Error logs
└── audit/
    └── audit-YYYY-MM-DD.log     # Audit trail (90-day retention)
```

### Log Levels

- **error**: Errors and exceptions
- **warn**: Warnings and risk violations
- **info**: General information
- **debug**: Detailed debugging (dev only)

## 🧪 Testing

```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage
```

## 🔧 Configuration

### Environment Variables

Key configurations in `.env`:

- **Database**: Connection settings
- **Redis**: Cache configuration
- **JWT**: Token secrets & expiry
- **Encryption**: AES-256 key
- **Kite API**: Broker credentials
- **Risk**: Limit thresholds
- **Logging**: Level & retention

## 🚨 Error Handling

### Error Types

- **BadRequestError** (400)
- **UnauthorizedError** (401)
- **ForbiddenError** (403)
- **NotFoundError** (404)
- **ValidationError** (422)
- **InternalServerError** (500)
- **RiskViolationError** (403)
- **KillSwitchError** (503)
- **OrderExecutionError** (500)

### Error Response Format

```json
{
  "success": false,
  "error": {
    "message": "Error message",
    "code": "ERROR_CODE",
    "statusCode": 400,
    "timestamp": "2025-01-30T10:00:00.000Z",
    "details": {}
  }
}
```

## 📦 Production Deployment

### Recommendations

1. **Process Manager**: Use PM2
```bash
pm2 start src/server.js --name trading-engine -i max
```

2. **Reverse Proxy**: Nginx for SSL termination

3. **Database**: Connection pooling enabled

4. **Redis**: Persistence enabled (AOF + RDB)

5. **Monitoring**: Set up health checks

6. **Backups**: Daily database backups

7. **Secrets**: Use environment-based secrets management

## 🔒 Security Checklist

- [ ] Change default encryption keys
- [ ] Set strong JWT secrets
- [ ] Enable HTTPS/SSL
- [ ] Configure firewall rules
- [ ] Set up rate limiting
- [ ] Enable audit logging
- [ ] Implement IP whitelisting
- [ ] Regular security updates
- [ ] Monitor audit logs
- [ ] Backup encryption keys securely

## 📞 Support

For issues and questions:
- GitHub Issues
- Email: support@example.com

## 📄 License

MIT License

## ⚠️ Disclaimer

This software is for educational purposes. Trading involves risk. Use at your own risk. The authors are not responsible for any financial losses.