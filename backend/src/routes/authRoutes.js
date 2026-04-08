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

module.exports = router;