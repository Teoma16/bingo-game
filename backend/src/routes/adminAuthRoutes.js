const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { AdminUser } = require('../models');

// Simple test endpoint
router.get('/test', (req, res) => {
  res.json({ message: 'Admin auth routes are working!' });
});

// Admin login
router.post('/login', async (req, res) => {
  console.log('Login attempt received:', req.body);
  
  try {
    const { identifier, password } = req.body;
    
    if (!identifier || !password) {
      console.log('Missing credentials');
      return res.status(400).json({ error: 'Username/phone and password required' });
    }
    
    // For testing - allow demo login
    if (identifier === 'admin' && password === 'admin123') {
      console.log('Demo login successful');
      const token = jwt.sign(
        { username: 'admin', role: 'admin' },
        process.env.JWT_SECRET || 'secretkey',
        { expiresIn: '8h' }
      );
      return res.json({
        success: true,
        token,
        admin: {
          id: 1,
          username: 'admin',
          full_name: 'Demo Admin',
          phone_number: '251911111111',
          role: 'admin'
        }
      });
    }
    
    // Try to find admin in database
    const admin = await AdminUser.findOne({
      where: {
        [require('sequelize').Op.or]: [
          { username: identifier },
          { phone_number: identifier },
          { email: identifier }
        ],
        is_active: true
      }
    });
    
    if (!admin) {
      console.log('Admin not found:', identifier);
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Validate password
    const isValid = await bcrypt.compare(password, admin.password_hash);
    if (!isValid) {
      console.log('Invalid password for:', identifier);
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Update last login
    admin.last_login = new Date();
    await admin.save();
    
    // Generate token
    const token = jwt.sign(
      { adminId: admin.id, username: admin.username, role: admin.role },
      process.env.JWT_SECRET || 'secretkey',
      { expiresIn: '8h' }
    );
    
    console.log('Login successful for:', admin.username);
    
    res.json({
      success: true,
      token,
      admin: {
        id: admin.id,
        username: admin.username,
        full_name: admin.full_name,
        phone_number: admin.phone_number,
        role: admin.role
      }
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Verify token middleware
const verifyAdminToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secretkey');
    req.admin = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Get current admin profile
router.get('/profile', verifyAdminToken, async (req, res) => {
  try {
    const admin = await AdminUser.findByPk(req.admin.adminId, {
      attributes: { exclude: ['password_hash'] }
    });
    res.json(admin);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = { router, verifyAdminToken };