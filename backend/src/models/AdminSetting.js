const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AdminSetting = sequelize.define('AdminSetting', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  setting_key: {
    type: DataTypes.STRING(50),
    unique: true,
    allowNull: false
  },
  setting_value: {
    type: DataTypes.TEXT
  },
  description: {
    type: DataTypes.TEXT
  }
}, {
  tableName: 'admin_settings',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = AdminSetting;