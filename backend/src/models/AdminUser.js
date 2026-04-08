const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const bcrypt = require('bcryptjs');

const AdminUser = sequelize.define('AdminUser', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  username: {
    type: DataTypes.STRING(50),
    unique: true,
    allowNull: false
  },
  email: {
    type: DataTypes.STRING(100),
    unique: true
  },
  phone_number: {
    type: DataTypes.STRING(20),
    unique: true,
    allowNull: false
  },
  password_hash: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  full_name: {
    type: DataTypes.STRING(100)
  },
  role: {
    type: DataTypes.STRING(20),
    defaultValue: 'admin'
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  last_login: {
    type: DataTypes.DATE
  }
}, {
  tableName: 'admin_users',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

// Instance method to check password
AdminUser.prototype.validatePassword = async function(password) {
  return bcrypt.compare(password, this.password_hash);
};

// Static method to find by credentials
AdminUser.findByCredentials = async function(identifier, password) {
  const admin = await this.findOne({
    where: {
      [require('sequelize').Op.or]: [
        { username: identifier },
        { phone_number: identifier },
        { email: identifier }
      ],
      is_active: true
    }
  });
  
  if (!admin) return null;
  
  const isValid = await admin.validatePassword(password);
  if (!isValid) return null;
  
  // Update last login
  admin.last_login = new Date();
  await admin.save();
  
  return admin;
};

module.exports = AdminUser;