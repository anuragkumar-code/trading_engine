const { DataTypes } = require('sequelize');
const sequelize = require('../config');

const RiskLimit = sequelize.define('RiskLimit', {
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
  limitType: {
    type: DataTypes.ENUM('DAILY_LOSS', 'POSITION_SIZE', 'MAX_POSITIONS', 'MAX_DRAWDOWN'),
    allowNull: false,
  },
  value: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
  },
  unit: {
    type: DataTypes.ENUM('PERCENTAGE', 'ABSOLUTE', 'COUNT'),
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('ACTIVE', 'INACTIVE'),
    defaultValue: 'ACTIVE',
  },
}, {
  tableName: 'risk_limits',
  underscored: true,
});


module.exports = RiskLimit;
