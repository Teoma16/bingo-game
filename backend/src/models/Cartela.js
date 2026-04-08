const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Cartela = sequelize.define('Cartela', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  lucky_number: {
    type: DataTypes.INTEGER,
    unique: true,
    allowNull: false
  },
  card_data: {
    type: DataTypes.JSONB,
    allowNull: false
  }
}, {
  tableName: 'cartelas',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false
});

module.exports = Cartela;