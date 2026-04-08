const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const GamePlayer = sequelize.define('GamePlayer', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  game_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  cartela_ids: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: []
  },
  is_winner: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  prize_amount: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.00
  },
  marked_numbers: {
    type: DataTypes.JSONB,
    defaultValue: []
  }
}, {
  tableName: 'game_players',
  timestamps: true,
  createdAt: 'joined_at',
  updatedAt: false
});

GamePlayer.associate = function(models) {
  GamePlayer.belongsTo(models.Game, { foreignKey: 'game_id', as: 'Game' });
  GamePlayer.belongsTo(models.User, { foreignKey: 'user_id', as: 'User' });
};

module.exports = GamePlayer;