const bcrypt = require('bcryptjs');
const { sequelize, AdminUser } = require('../src/models');

async function createAdmin() {
  try {
    await sequelize.authenticate();
    console.log('Database connected...');
    
    // Sync the model
    await AdminUser.sync({ alter: true });
    
    // Check if admin exists
    const existing = await AdminUser.findOne({ where: { username: 'superadmin' } });
    
    if (existing) {
      console.log('Admin already exists!');
      process.exit(0);
    }
    
    // Hash password
    const password = 'Admin@123';
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);
    
    // Create admin
    const admin = await AdminUser.create({
      username: 'admin',
      email: 'admin@bingo.com',
      phone_number: '251912345678',
      password_hash: password_hash,
      full_name: 'Super Administrator',
      role: 'super_admin',
      is_active: true
    });
    
    console.log('✅ Admin created successfully!');
    console.log('Username: admin');
    console.log('Password: Admin@123');
    console.log('Phone: 251912345678');
    process.exit(0);
    
  } catch (error) {
    console.error('Error creating admin:', error);
    process.exit(1);
  }
}

createAdmin();