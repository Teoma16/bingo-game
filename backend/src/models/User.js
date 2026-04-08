const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  telegram_id: {
    type: DataTypes.BIGINT,
    unique: true,
    allowNull: false
  },
  username: {
    type: DataTypes.STRING(100)
  },
  phone_number: {
    type: DataTypes.STRING(20),
    unique: true,
    allowNull: false
  },
  wallet_balance: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 200.00  // Welcome bonus for testing (will change to 10)
  },
  total_played: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  total_won: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  total_bonus: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.00
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'users',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = User;