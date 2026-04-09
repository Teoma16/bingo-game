const express = require('express');
const router = express.Router();
const { User, Transaction } = require('../models');
const jwt = require('jsonwebtoken');

// Login with phone number (temporary for testing)
router.post('/login', async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    
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
        total_won: user.total_won
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get user by ID
router.get('/user/:id', async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// Telegram auto-login endpoint
router.post('/telegram-login', async (req, res) => {
  try {
    const { telegramId, username, phoneNumber } = req.body;
    
    console.log('Telegram auto-login attempt:', { telegramId, username });
    
    // Find or create user by telegram ID
    let user = await User.findOne({ where: { telegram_id: telegramId } });
    
    if (!user) {
      // Create new user with telegram ID (phone will be added later if needed)
      user = await User.create({
        telegram_id: telegramId,
        username: username,
        phone_number: phoneNumber || `TG${telegramId}`,
        wallet_balance: 10.00,
        total_played: 0,
        total_won: 0,
        total_bonus: 10.00,
        is_active: true
      });
      
      // Record welcome bonus
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
module.exports = router;