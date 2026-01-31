const { DataTypes } = require('sequelize');
const sequelize = require('../config');

const SignalSource = sequelize.define('SignalSource', {
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
  type: {
    type: DataTypes.ENUM('TELEGRAM', 'GOOGLE_SHEETS', 'API', 'MANUAL'),
    allowNull: false,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  config: {
    type: DataTypes.JSONB,
    defaultValue: {},
  },
  apiKeyHash: {
    type: DataTypes.STRING,
  },
  webhookSecret: {
    type: DataTypes.TEXT,
  },
  status: {
    type: DataTypes.ENUM('ACTIVE', 'INACTIVE'),
    defaultValue: 'ACTIVE',
  },
}, {
  tableName: 'signal_sources',
  underscored: true,
});


module.exports = SignalSource;
