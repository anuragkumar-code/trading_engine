-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

--------------------------------------------------
-- ENUM TYPES
--------------------------------------------------

CREATE TYPE user_role_enum AS ENUM ('ADMIN', 'TRADER', 'VIEWER');
CREATE TYPE user_status_enum AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

CREATE TYPE exchange_enum AS ENUM ('NSE', 'BSE', 'NFO', 'BFO', 'CDS', 'MCX');
CREATE TYPE transaction_type_enum AS ENUM ('BUY', 'SELL');
CREATE TYPE order_type_enum AS ENUM ('MARKET', 'LIMIT', 'SL', 'SL-M');
CREATE TYPE product_type_enum AS ENUM ('CNC', 'MIS', 'NRML');

CREATE TYPE intent_status_enum AS ENUM (
  'PENDING', 'APPROVED', 'REJECTED', 'EXECUTED', 'FAILED'
);

CREATE TYPE validity_enum AS ENUM ('DAY', 'IOC');

CREATE TYPE strategy_status_enum AS ENUM ('ACTIVE', 'INACTIVE', 'PAUSED');

CREATE TYPE signal_type_enum AS ENUM (
  'TELEGRAM', 'GOOGLE_SHEETS', 'API', 'MANUAL'
);

CREATE TYPE risk_limit_type_enum AS ENUM (
  'DAILY_LOSS', 'POSITION_SIZE', 'MAX_POSITIONS', 'MAX_DRAWDOWN'
);

CREATE TYPE risk_unit_enum AS ENUM ('PERCENTAGE', 'ABSOLUTE', 'COUNT');

CREATE TYPE generic_status_enum AS ENUM ('ACTIVE', 'INACTIVE');

CREATE TYPE system_flag_enum AS ENUM (
  'KILL_SWITCH', 'MAINTENANCE', 'CIRCUIT_BREAKER'
);

CREATE TYPE order_status_enum AS ENUM (
  'PENDING', 'SUBMITTED', 'OPEN', 'COMPLETE',
  'CANCELLED', 'REJECTED', 'FAILED'
);

CREATE TYPE kite_status_enum AS ENUM (
  'ACTIVE', 'INACTIVE', 'EXPIRED'
);

--------------------------------------------------
-- USERS
--------------------------------------------------

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,

  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,

  role user_role_enum NOT NULL DEFAULT 'TRADER',
  status user_status_enum NOT NULL DEFAULT 'ACTIVE',

  last_login_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

--------------------------------------------------
-- KITE ACCOUNTS
--------------------------------------------------

CREATE TABLE kite_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  user_id UUID NOT NULL REFERENCES users(id),

  api_key TEXT NOT NULL,
  api_secret_hash TEXT NOT NULL,

  access_token TEXT,
  refresh_token TEXT,

  token_expires_at TIMESTAMP,

  status kite_status_enum DEFAULT 'ACTIVE',

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

--------------------------------------------------
-- STRATEGIES
--------------------------------------------------

CREATE TABLE strategies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  user_id UUID NOT NULL REFERENCES users(id),

  name TEXT NOT NULL,
  description TEXT,

  config JSONB DEFAULT '{}'::jsonb,

  status strategy_status_enum DEFAULT 'ACTIVE',

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

--------------------------------------------------
-- SIGNAL SOURCES
--------------------------------------------------

CREATE TABLE signal_sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  user_id UUID NOT NULL REFERENCES users(id),

  type signal_type_enum NOT NULL,

  name TEXT NOT NULL,

  config JSONB DEFAULT '{}'::jsonb,

  api_key_hash TEXT,
  webhook_secret TEXT,

  status generic_status_enum DEFAULT 'ACTIVE',

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

--------------------------------------------------
-- TRADE INTENTS
--------------------------------------------------

CREATE TABLE trade_intents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  user_id UUID NOT NULL REFERENCES users(id),

  signal_source_id UUID REFERENCES signal_sources(id),
  strategy_id UUID REFERENCES strategies(id),

  symbol TEXT NOT NULL,

  exchange exchange_enum NOT NULL,

  transaction_type transaction_type_enum NOT NULL,
  order_type order_type_enum NOT NULL,
  product_type product_type_enum NOT NULL,

  quantity INTEGER NOT NULL,

  price NUMERIC(10,2),
  trigger_price NUMERIC(10,2),

  validity validity_enum DEFAULT 'DAY',

  status intent_status_enum DEFAULT 'PENDING',

  raw_signal JSONB,
  risk_check_result JSONB,

  rejection_reason TEXT,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

--------------------------------------------------
-- ORDERS
--------------------------------------------------

CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  trade_intent_id UUID REFERENCES trade_intents(id),

  user_id UUID NOT NULL REFERENCES users(id),

  kite_order_id TEXT UNIQUE,

  symbol TEXT NOT NULL,
  exchange TEXT NOT NULL,

  transaction_type TEXT NOT NULL,
  order_type TEXT NOT NULL,
  product_type TEXT NOT NULL,

  quantity INTEGER NOT NULL,

  price NUMERIC(10,2),
  trigger_price NUMERIC(10,2),
  average_price NUMERIC(10,2),

  filled_quantity INTEGER DEFAULT 0,

  status order_status_enum DEFAULT 'PENDING',

  status_message TEXT,

  placed_at TIMESTAMP,

  kite_response JSONB,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

--------------------------------------------------
-- RISK LIMITS
--------------------------------------------------

CREATE TABLE risk_limits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  user_id UUID NOT NULL REFERENCES users(id),

  limit_type risk_limit_type_enum NOT NULL,

  value NUMERIC(15,2) NOT NULL,

  unit risk_unit_enum NOT NULL,

  status generic_status_enum DEFAULT 'ACTIVE',

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

--------------------------------------------------
-- AUDIT LOGS
--------------------------------------------------

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  event TEXT NOT NULL,

  user_id UUID REFERENCES users(id),

  source TEXT NOT NULL,

  ip INET,

  payload JSONB,

  payload_hash TEXT,

  result TEXT NOT NULL,

  metadata JSONB,

  created_at TIMESTAMP DEFAULT NOW()
);

--------------------------------------------------
-- SYSTEM FLAGS
--------------------------------------------------

CREATE TABLE system_flags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  flag_type system_flag_enum UNIQUE NOT NULL,

  enabled BOOLEAN DEFAULT FALSE,

  reason TEXT,

  triggered_by UUID REFERENCES users(id),

  triggered_at TIMESTAMP,

  metadata JSONB,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

--------------------------------------------------
-- INDEXES (PERFORMANCE)
--------------------------------------------------

CREATE INDEX idx_users_email ON users(email);

CREATE INDEX idx_trade_intents_user ON trade_intents(user_id);
CREATE INDEX idx_trade_intents_status ON trade_intents(status);

CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_intent ON orders(trade_intent_id);

CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_event ON audit_logs(event);

CREATE INDEX idx_risk_limits_user ON risk_limits(user_id);

--------------------------------------------------
-- AUTO UPDATE updated_at
--------------------------------------------------

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

--------------------------------------------------

CREATE TRIGGER trg_users_updated
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_orders_updated
BEFORE UPDATE ON orders
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_strategies_updated
BEFORE UPDATE ON strategies
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_trade_intents_updated
BEFORE UPDATE ON trade_intents
FOR EACH ROW EXECUTE FUNCTION update_updated_at();
