const express = require('express');
const router = express.Router();
const { User, Transaction } = require('../models');
const jwt = require('jsonwebtoken');

// ============================================
// PHONE NUMBER LOGIN (For Admin/Testing)
// ============================================
router.post('/login', async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    
    console.log('Phone login attempt:', phoneNumber);
    
    let user = await User.findOne({ where: { phone_number: phoneNumber } });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found. Please register via Telegram first.' });
    }
    
    const token = jwt.sign(
      { userId: user.id, phoneNumber: user.phone_number },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        phone_number: user.phone_number,
        wallet_balance: user.wallet_balance,
        total_played: user.total_played,
        total_won: user.total_won,
        total_bonus: user.total_bonus
      }
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ============================================
// TELEGRAM AUTO-LOGIN (For Players)
// ============================================
router.post('/telegram-login', async (req, res) => {
  try {
    const { telegramId, username, phoneNumber } = req.body;
    
    console.log('Telegram auto-login attempt:', { telegramId, username });
    
    // Find user by telegram ID
    let user = await User.findOne({ where: { telegram_id: telegramId } });
    
    if (!user) {
      // Check if phone number already exists (if provided)
      if (phoneNumber) {
        const existingUser = await User.findOne({ where: { phone_number: phoneNumber } });
        if (existingUser) {
          // Link existing user to this telegram ID
          existingUser.telegram_id = telegramId;
          existingUser.username = username;
          await existingUser.save();
          user = existingUser;
          console.log('Linked existing user to Telegram:', user.id);
        }
      }
      
      if (!user) {
        // Create new user
        const uniquePhone = phoneNumber || `TG${telegramId}${Date.now()}`;
        
        user = await User.create({
          telegram_id: telegramId,
          username: username,
          phone_number: uniquePhone,
          wallet_balance: 10.00,
          total_played: 0,
          total_won: 0,
          total_bonus: 10.00,
          is_active: true
        });
        
        // Record welcome bonus transaction
        await Transaction.create({
          user_id: user.id,
          type: 'bonus',
          amount: 10.00,
          balance_after: 10.00,
          status: 'completed',
          description: 'Welcome bonus via Telegram'
        });
        
        console.log('New user created via Telegram:', user.id);
      }
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, telegramId: user.telegram_id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        phone_number: user.phone_number,
        wallet_balance: user.wallet_balance,
        total_played: user.total_played,
        total_won: user.total_won,
        total_bonus: user.total_bonus
      }
    });
    
  } catch (error) {
    console.error('Telegram login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ============================================
// GET USER BY ID
// ============================================
router.get('/user/:id', async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: { exclude: ['password'] }
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// GET USER BY TELEGRAM ID
// ============================================
router.get('/telegram/:telegramId', async (req, res) => {
  try {
    const user = await User.findOne({ 
      where: { telegram_id: req.params.telegramId }
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(user);
  } catch (error) {
    console.error('Get user by Telegram error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// UPDATE USER PHONE NUMBER (After Registration)
// ============================================
router.post('/update-phone', async (req, res) => {
  try {
    const { userId, phoneNumber } = req.body;
    
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Check if phone number is already used
    const existingUser = await User.findOne({ 
      where: { phone_number: phoneNumber, id: { [require('sequelize').Op.ne]: userId } }
    });
    
    if (existingUser) {
      return res.status(400).json({ error: 'Phone number already registered' });
    }
    
    user.phone_number = phoneNumber;
    await user.save();
    
    res.json({ success: true, user });
  } catch (error) {
    console.error('Update phone error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;