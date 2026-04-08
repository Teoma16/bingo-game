const sequelize = require('../config/database');
const User = require('./User');
const Cartela = require('./Cartela');
const Game = require('./Game');
const GamePlayer = require('./GamePlayer');
const Transaction = require('./Transaction');
const WithdrawRequest = require('./WithdrawRequest');
const DepositRequest = require('./DepositRequest');
const AdminUser = require('./AdminUser');
const AdminSetting = require('./AdminSetting');
const Advertisement = require('./Advertisement');

// Define all associations
User.hasMany(GamePlayer, { foreignKey: 'user_id', as: 'GamePlayers' });
GamePlayer.belongsTo(User, { foreignKey: 'user_id', as: 'User' });

Game.hasMany(GamePlayer, { foreignKey: 'game_id', as: 'GamePlayers' });
GamePlayer.belongsTo(Game, { foreignKey: 'game_id', as: 'Game' });

User.hasMany(Transaction, { foreignKey: 'user_id', as: 'Transactions' });
Transaction.belongsTo(User, { foreignKey: 'user_id', as: 'User' });

User.hasMany(WithdrawRequest, { foreignKey: 'user_id', as: 'WithdrawRequests' });
WithdrawRequest.belongsTo(User, { foreignKey: 'user_id', as: 'User' });

User.hasMany(DepositRequest, { foreignKey: 'user_id', as: 'DepositRequests' });
DepositRequest.belongsTo(User, { foreignKey: 'user_id', as: 'User' });

User.hasMany(AdminUser, { foreignKey: 'user_id', as: 'AdminUsers' });
AdminUser.belongsTo(User, { foreignKey: 'user_id', as: 'User' });

module.exports = {
  sequelize,
  User,
  Cartela,
  Game,
  GamePlayer,
  Transaction,
  WithdrawRequest,
  DepositRequest,
  AdminUser,
  AdminSetting,
  Advertisement
};