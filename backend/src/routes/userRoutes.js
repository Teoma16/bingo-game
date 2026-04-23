const express = require('express');
const router = express.Router();
const { User, Transaction, WithdrawRequest, DepositRequest } = require('../models');
const { authenticate } = require('../middlewares/auth');

// Get user wallet balance
router.get('/balance/:userId', authenticate, async (req, res) => {
  try {
    const user = await User.findByPk(req.params.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ 
      totalBalance: user.wallet_balance,
      withdrawableBalance: user.withdrawable_balance 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get transaction history
router.get('/transactions/:userId', authenticate, async (req, res) => {
  try {
    const transactions = await Transaction.findAll({
      where: { user_id: req.params.userId },
      order: [['created_at', 'DESC']],
      limit: 50
    });
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get game history
// Get game history
router.get('/game-history/:userId', authenticate, async (req, res) => {
  try {
    const gamePlayers = await GamePlayer.findAll({
      where: { user_id: req.params.userId },
      include: [{ model: Game, attributes: ['game_number', 'status', 'prize_pool'] }],
      order: [['joined_at', 'DESC']],
      limit: 50
    });
    console.log(`Found ${gamePlayers.length} games for user ${req.params.userId}`);
    res.json(gamePlayers);
  } catch (error) {
    console.error('Game history error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Request withdrawal
router.post('/withdraw', authenticate, async (req, res) => {
  try {
    const { userId, amount, phoneNumber } = req.body;
    
    console.log(`Withdraw request: User ${userId}, Amount: ${amount}, Phone: ${phoneNumber}`);
    
    // Check if models are available
    if (!WithdrawRequest) {
      console.error('WithdrawRequest model is not defined');
      return res.status(500).json({ error: 'Server configuration error' });
    }
    
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    if (amount < 100) {
      return res.status(400).json({ error: 'Minimum withdrawal amount is 100 Birr' });
    }
    
    // if (parseFloat(user.wallet_balance) < amount) {
    //   return res.status(400).json({ error: 'Insufficient balance' });
    // }
    // CHANGE THIS: Check withdrawable_balance instead of wallet_balance
    if (user.withdrawable_balance < amount) {
      return res.status(400).json({ 
        error: `Insufficient withdrawable balance. Available: ${user.withdrawable_balance} Birr. Only winnings can be withdrawn.` 
      });
    }
    const withdrawRequest = await WithdrawRequest.create({
      user_id: userId,
      amount: amount,
      phone_number: phoneNumber,
      status: 'pending'
    });
    
    console.log(`Withdraw request created: ${withdrawRequest.id}`);
    
    res.json({ 
      success: true, 
      requestId: withdrawRequest.id,
      message: 'Withdrawal request submitted successfully'
    });
  } catch (error) {
    console.error('Withdraw error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Request deposit
// Request deposit with Telebirr verification
router.post('/deposit-request', authenticate, async (req, res) => {
  try {
    const { userId, amount, smsText } = req.body;
    
    console.log(`Deposit request: User ${userId}, Amount: ${amount}`);
    console.log(`SMS Text: ${smsText}`);
    
    const telebirrService = require('../services/TelebirrService');
    
    // Verify the SMS with Telebirr
    const verification = telebirrService.validateSMS(smsText);
    
    if (!verification.valid) {
      console.log(`Deposit verification failed: ${verification.reason}`);
      return res.status(400).json({ 
        success: false, 
        error: verification.reason,
        message: `Verification failed: ${verification.reason}`
      });
    }
    
    // Check if amount matches
    if (verification.amount !== amount) {
      console.log(`Amount mismatch: SMS says ${verification.amount}, User requested ${amount}`);
      return res.status(400).json({ 
        success: false, 
        error: 'Amount mismatch',
        message: `The SMS shows ${verification.amount} Birr, but you selected ${amount} Birr. Please select the correct amount.`
      });
    }
    
    console.log(`Deposit verified successfully! Amount: ${verification.amount}, TX: ${verification.transactionId}`);
    
    // Create deposit request record
    const depositRequest = await DepositRequest.create({
      user_id: userId,
      amount: amount,
      sms_text: smsText,
      telebirr_reference: verification.transactionId,
      status: 'approved' // Auto-approve since SMS is verified
    });
    
    // Credit the user's wallet
    const user = await User.findByPk(userId);
    if (user) {
      const oldBalance = parseFloat(user.wallet_balance) || 0;
      const newBalance = oldBalance + amount;
      
      user.wallet_balance = newBalance;
      await user.save();
      
      // Record transaction
      await Transaction.create({
        user_id: userId,
        type: 'deposit',
        amount: amount,
        balance_after: newBalance,
        status: 'completed',
        description: `Deposit via Telebirr - Transaction ${verification.transactionId}`
      });
      
      console.log(`User ${userId} balance updated: ${oldBalance} -> ${newBalance}`);
    }
    
    res.json({ 
      success: true, 
      requestId: depositRequest.id,
      message: `Deposit of ${amount} Birr successful! Your wallet has been updated.`
    });
    
  } catch (error) {
    console.error('Deposit error:', error);
    res.status(500).json({ error: error.message, message: 'Deposit processing failed' });
  }
});

module.exports = router;