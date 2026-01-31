const { DataTypes } = require('sequelize');
const sequelize = require('../config');

const AuditLog = sequelize.define('AuditLog', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  event: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  userId: {
    type: DataTypes.UUID,
    references: {
      model: 'users',
      key: 'id',
    },
  },
  source: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  ip: {
    type: DataTypes.INET,
  },
  payload: {
    type: DataTypes.JSONB,
  },
  payloadHash: {
    type: DataTypes.STRING,
  },
  result: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  metadata: {
    type: DataTypes.JSONB,
  },
}, {
  tableName: 'audit_logs',
  underscored: true,
  updatedAt: false,
});

module.exports = AuditLog;