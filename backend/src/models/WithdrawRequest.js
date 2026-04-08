const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const WithdrawRequest = sequelize.define('WithdrawRequest', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  phone_number: {
    type: DataTypes.STRING(20),
    allowNull: false
  },
  status: {
    type: DataTypes.STRING(20),
    defaultValue: 'pending'
  },
  approved_by: {
    type: DataTypes.INTEGER
  },
  approved_at: {
    type: DataTypes.DATE
  },
  completed_at: {
    type: DataTypes.DATE
  }
}, {
  tableName: 'withdraw_requests',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false
});

WithdrawRequest.associate = function(models) {
  WithdrawRequest.belongsTo(models.User, { foreignKey: 'user_id', as: 'User' });
};

module.exports = WithdrawRequest;