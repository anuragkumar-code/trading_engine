const { DataTypes } = require('sequelize');
const sequelize = require('../config');

const Order = sequelize.define('Order', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  tradeIntentId: {
    type: DataTypes.UUID,
    references: {
      model: 'trade_intents',
      key: 'id',
    },
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id',
    },
  },
  kiteOrderId: {
    type: DataTypes.STRING,
    unique: true,
  },
  symbol: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  exchange: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  transactionType: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  orderType: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  productType: {
    type: DataTypes.STRING,
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
  averagePrice: {
    type: DataTypes.DECIMAL(10, 2),
  },
  filledQuantity: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  status: {
    type: DataTypes.ENUM('PENDING', 'SUBMITTED', 'OPEN', 'COMPLETE', 'CANCELLED', 'REJECTED', 'FAILED'),
    defaultValue: 'PENDING',
  },
  statusMessage: {
    type: DataTypes.TEXT,
  },
  placedAt: {
    type: DataTypes.DATE,
  },
  updatedAt: {
    type: DataTypes.DATE,
  },
  kiteResponse: {
    type: DataTypes.JSONB,
  },
}, {
  tableName: 'orders',
  underscored: true,
});

module.exports = Order;
