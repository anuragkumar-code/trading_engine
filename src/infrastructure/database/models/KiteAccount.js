const { DataTypes } = require('sequelize');
const sequelize = require('../config');

const KiteAccount = sequelize.define('KiteAccount', {
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
    onDelete: 'CASCADE',
  },
  accessToken: {
    type: DataTypes.TEXT,
  },
  refreshToken: {
    type: DataTypes.TEXT,
  },
  tokenExpiresAt: {
    type: DataTypes.DATE,
  },
  status: {
    type: DataTypes.ENUM('ACTIVE', 'INACTIVE', 'EXPIRED'),
    defaultValue: 'ACTIVE',
  },
  lastLoginAt: {
    type: DataTypes.DATE,
    field: 'last_login_at',
  }

}, {
  tableName: 'kite_accounts',
  underscored: true,
});


module.exports = KiteAccount;
