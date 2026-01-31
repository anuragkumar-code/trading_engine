const { DataTypes } = require('sequelize');
const sequelize = require('../config');


const TradeIntent = sequelize.define('TradeIntent', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id',
    },
  },
  signalSourceId: {
    type: DataTypes.UUID,
    references: {
      model: 'signal_sources',
      key: 'id',
    },
  },
  strategyId: {
    type: DataTypes.UUID,
    references: {
      model: 'strategies',
      key: 'id',
    },
  },
  symbol: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  exchange: {
    type: DataTypes.ENUM('NSE', 'BSE', 'NFO', 'BFO', 'CDS', 'MCX'),
    allowNull: false,
  },
  transactionType: {
    type: DataTypes.ENUM('BUY', 'SELL'),
    allowNull: false,
  },
  orderType: {
    type: DataTypes.ENUM('MARKET', 'LIMIT', 'SL', 'SL-M'),
    allowNull: false,
  },
  productType: {
    type: DataTypes.ENUM('CNC', 'MIS', 'NRML'),
    allowNull: false,
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
  },
  triggerPrice: {
    type: DataTypes.DECIMAL(10, 2),
  },
  validity: {
    type: DataTypes.ENUM('DAY', 'IOC'),
    defaultValue: 'DAY',
  },
  status: {
    type: DataTypes.ENUM('PENDING', 'APPROVED', 'REJECTED', 'EXECUTED', 'FAILED'),
    defaultValue: 'PENDING',
  },
  rawSignal: {
    type: DataTypes.JSONB,
  },
  riskCheckResult: {
    type: DataTypes.JSONB,
  },
  rejectionReason: {
    type: DataTypes.TEXT,
  },
}, {
  tableName: 'trade_intents',
  underscored: true,
});

module.exports = TradeIntent;