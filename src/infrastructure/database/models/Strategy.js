const { DataTypes } = require('sequelize');
const sequelize = require('../config');

const Strategy = sequelize.define('Strategy', {
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
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
  },
  config: {
    type: DataTypes.JSONB,
    defaultValue: {},
  },
  status: {
    type: DataTypes.ENUM('ACTIVE', 'INACTIVE', 'PAUSED'),
    defaultValue: 'ACTIVE',
  },
}, {
  tableName: 'strategies',
  underscored: true,
});


module.exports = Strategy;
