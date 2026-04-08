const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const DepositRequest = sequelize.define('DepositRequest', {
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
  sms_text: {
    type: DataTypes.TEXT
  },
  telebirr_reference: {
    type: DataTypes.STRING(100)
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
  }
}, {
  tableName: 'deposit_requests',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false
});

// Association will be defined in index.js
DepositRequest.associate = function(models) {
  DepositRequest.belongsTo(models.User, { foreignKey: 'user_id', as: 'User' });
};

module.exports = DepositRequest;