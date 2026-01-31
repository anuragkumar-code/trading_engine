const { DataTypes } = require('sequelize');
const sequelize = require('../config');


const SystemFlag = sequelize.define('SystemFlag', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  flagType: {
    type: DataTypes.ENUM('KILL_SWITCH', 'MAINTENANCE', 'CIRCUIT_BREAKER'),
    allowNull: false,
    unique: true,
  },
  enabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  reason: {
    type: DataTypes.TEXT,
  },
  triggeredBy: {
    type: DataTypes.UUID,
    references: {
      model: 'users',
      key: 'id',
    },
  },
  triggeredAt: {
    type: DataTypes.DATE,
  },
  metadata: {
    type: DataTypes.JSONB,
  },
}, {
  tableName: 'system_flags',
  underscored: true,
});


module.exports = SystemFlag;