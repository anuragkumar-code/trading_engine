// Define associations
const User = require('./User');
const KiteAccount = require('./KiteAccount');
const Strategy = require('./Strategy');
const SignalSource = require('./SignalSource');
const TradeIntent = require('./TradeIntent');
const Order = require('./Order');
const RiskLimit = require('./RiskLimit');
const AuditLog = require('./AuditLog');
const SystemFlag = require('./SystemFlag');

const sequelize = require('../config');


User.hasMany(KiteAccount, { foreignKey: 'userId', as: 'kiteAccounts' });
User.hasMany(Strategy, { foreignKey: 'userId', as: 'strategies' });
User.hasMany(SignalSource, { foreignKey: 'userId', as: 'signalSources' });
User.hasMany(TradeIntent, { foreignKey: 'userId', as: 'tradeIntents' });
User.hasMany(Order, { foreignKey: 'userId', as: 'orders' });
User.hasMany(RiskLimit, { foreignKey: 'userId', as: 'riskLimits' });

KiteAccount.belongsTo(User, { foreignKey: 'userId', as: 'user' });
Strategy.belongsTo(User, { foreignKey: 'userId', as: 'user' });
SignalSource.belongsTo(User, { foreignKey: 'userId', as: 'user' });
RiskLimit.belongsTo(User, { foreignKey: 'userId', as: 'user' });

TradeIntent.belongsTo(User, { foreignKey: 'userId', as: 'user' });
TradeIntent.belongsTo(SignalSource, { foreignKey: 'signalSourceId', as: 'signalSource' });
TradeIntent.belongsTo(Strategy, { foreignKey: 'strategyId', as: 'strategy' });
TradeIntent.hasMany(Order, { foreignKey: 'tradeIntentId', as: 'orders' });

Strategy.hasMany(TradeIntent, { foreignKey: 'strategyId', as: 'tradeIntents' });

Order.belongsTo(User, { foreignKey: 'userId', as: 'user' });
Order.belongsTo(TradeIntent, { foreignKey: 'tradeIntentId', as: 'tradeIntent' });

AuditLog.belongsTo(User, { foreignKey: 'userId', as: 'user' });
SystemFlag.belongsTo(User, { foreignKey: 'triggeredBy', as: 'triggeredByUser' });

module.exports = {
  sequelize,
  User,
  KiteAccount,
  Strategy,
  SignalSource,
  TradeIntent,
  Order,
  RiskLimit,
  AuditLog,
  SystemFlag,
};