const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Game = sequelize.define('Game', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  game_number: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  status: {
    type: DataTypes.STRING(20),
    defaultValue: 'waiting'
  },
  total_players: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  total_cartelas: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  prize_pool: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.00
  },
  commission: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.00
  },
  winner_ids: {
    type: DataTypes.JSONB
  },
  winner_amount: {
    type: DataTypes.DECIMAL(10, 2)
  },
  called_numbers: {
    type: DataTypes.JSONB,
    defaultValue: []
  },
  start_time: {
    type: DataTypes.DATE
  },
  end_time: {
    type: DataTypes.DATE
  }
}, {
  tableName: 'games',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false
});

module.exports = Game;