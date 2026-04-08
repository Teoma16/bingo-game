const jwt = require('jsonwebtoken');
const { User } = require('../models');

// Admin phone numbers (you can add multiple admins)
const ADMIN_PHONES = [
  process.env.ADMIN_PHONE || '251911111111', // Main admin
  // Add more admin phone numbers here
];

const adminAuth = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    const token = authHeader.split(' ')[1];
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Find user
    const user = await User.findByPk(decoded.userId);
    
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    // Check if user is admin
    if (!ADMIN_PHONES.includes(user.phone_number)) {
      return res.status(403).json({ error: 'Access denied. Admin only.' });
    }
    
    // Attach user to request
    req.user = user;
    req.userId = user.id;
    req.isAdmin = true;
    
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    
    console.error('Admin auth middleware error:', error);
    res.status(500).json({ error: 'Authentication error' });
  }
};

// Simple admin check without token (for development)
const simpleAdminCheck = (req, res, next) => {
  const adminKey = req.headers['x-admin-key'];
  
  if (adminKey === process.env.ADMIN_KEY || adminKey === 'admin123') {
    next();
  } else {
    res.status(403).json({ error: 'Invalid admin key' });
  }
};

module.exports = { adminAuth, simpleAdminCheck };