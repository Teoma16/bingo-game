const express = require('express');
const router = express.Router();
const { User, Transaction, DepositRequest, WithdrawRequest, Game, GamePlayer, AdminSetting, Advertisement } = require('../models');
const { Op } = require('sequelize');
const { verifyAdminToken } = require('./adminAuthRoutes');

// ============ HELPER FUNCTIONS ============
const getSettings = async () => {
  try {
    const settings = await AdminSetting.findAll();
    const settingsObj = {};
    settings.forEach(s => {
      settingsObj[s.setting_key] = s.setting_value;
    });
    return settingsObj;
  } catch (error) {
    console.log('Settings table not ready yet');
    return {};
  }
};

const getAdvertisement = async () => {
  try {
    const ad = await Advertisement.findOne({ 
      where: { is_active: true }, 
      order: [['created_at', 'DESC']] 
    });
    return ad || {};
  } catch (error) {
    console.log('Advertisement table not ready yet');
    return {};
  }
};

// ============ DASHBOARD STATS ============
router.get('/stats', verifyAdminToken, async (req, res) => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    
    const stats = {
      totalUsers: await User.count() || 0,
      newUsersToday: await User.count({ where: { created_at: { [Op.gte]: startOfDay } } }) || 0,
      totalCommission: await Transaction.sum('amount', { where: { type: 'game_fee', status: 'completed' } }) || 0,
      totalPrizePaid: await Transaction.sum('amount', { where: { type: 'prize', status: 'completed' } }) || 0,
      pendingDeposits: await DepositRequest.count({ where: { status: 'pending' } }) || 0,
      pendingWithdrawals: await WithdrawRequest.count({ where: { status: 'pending' } }) || 0,
      activePlayers: await GamePlayer.count({ where: { joined_at: { [Op.gte]: new Date(Date.now() - 30 * 60000) } } }) || 0,
      totalGames: await Game.count() || 0,
      totalRevenue: await Transaction.sum('amount', { where: { type: 'game_fee', status: 'completed' } }) || 0
    };
    
    res.json(stats);
  } catch (error) {
    console.error('Stats error:', error);
    res.json({
      totalUsers: 0,
      newUsersToday: 0,
      totalCommission: 0,
      totalPrizePaid: 0,
      pendingDeposits: 0,
      pendingWithdrawals: 0,
      activePlayers: 0,
      totalGames: 0,
      totalRevenue: 0
    });
  }
});

// ============ RECENT ACTIVITIES ============
router.get('/recent-activities', verifyAdminToken, async (req, res) => {
  try {
    const recentDeposits = await DepositRequest.findAll({
      limit: 5,
      order: [['created_at', 'DESC']],
      include: [{ model: User, as: 'User', attributes: ['username', 'phone_number'] }]
    });
    
    const recentWithdrawals = await WithdrawRequest.findAll({
      limit: 5,
      order: [['created_at', 'DESC']],
      include: [{ model: User, as: 'User', attributes: ['username', 'phone_number'] }]
    });
    
    const recentGames = await Game.findAll({
      limit: 5,
      order: [['created_at', 'DESC']],
      where: { status: 'completed' }
    });
    
    const activities = [];
    
    recentDeposits.forEach(d => {
      activities.push({ type: 'deposit', message: `Deposit of ${d.amount} Birr from ${d.User?.username || d.User?.phone_number}`, created_at: d.created_at });
    });
    
    recentWithdrawals.forEach(w => {
      activities.push({ type: 'withdraw', message: `Withdraw request of ${w.amount} Birr from ${w.User?.username || w.User?.phone_number}`, created_at: w.created_at });
    });
    
    recentGames.forEach(g => {
      activities.push({ type: 'game', message: `Game #${g.game_number} completed with ${g.total_players} players`, created_at: g.created_at });
    });
    
    activities.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    res.json(activities.slice(0, 10));
  } catch (error) {
    console.error('Activities error:', error);
    res.json([]);
  }
});

// ============ DAILY STATS FOR CHARTS ============
router.get('/daily-stats', verifyAdminToken, async (req, res) => {
  try {
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);
      
      const dailyGames = await Game.count({ where: { created_at: { [Op.gte]: date, [Op.lt]: nextDate } } }) || 0;
      const dailyUsers = await User.count({ where: { created_at: { [Op.gte]: date, [Op.lt]: nextDate } } }) || 0;
      
      const dailyRevenue = await Transaction.sum('amount', {
        where: { type: 'game_fee', status: 'completed', created_at: { [Op.gte]: date, [Op.lt]: nextDate } }
      }) || 0;
      
      const dailyCommission = await Transaction.sum('amount', {
        where: { type: 'commission', status: 'completed', created_at: { [Op.gte]: date, [Op.lt]: nextDate } }
      }) || 0;
      
      const dailyPrize = await Transaction.sum('amount', {
        where: { type: 'prize', status: 'completed', created_at: { [Op.gte]: date, [Op.lt]: nextDate } }
      }) || 0;
      
      last7Days.push({
        date: `${date.getMonth() + 1}/${date.getDate()}`,
        gamesPlayed: dailyGames,
        newUsers: dailyUsers,
        revenue: dailyRevenue,
        commission: dailyCommission,
        prize: dailyPrize
      });
    }
    
    res.json(last7Days);
  } catch (error) {
    console.error('Daily stats error:', error);
    res.json([]);
  }
});

// ============ PLAYER MANAGEMENT ============
router.get('/players', verifyAdminToken, async (req, res) => {
  try {
    const players = await User.findAll({
      attributes: ['id', 'username', 'phone_number', 'wallet_balance', 'total_played', 'total_won', 'total_bonus', 'is_active', 'created_at'],
      order: [['created_at', 'DESC']]
    });
    res.json(players);
  } catch (error) {
    console.error('Players error:', error);
    res.json([]);
  }
});

router.post('/adjust-balance', verifyAdminToken, async (req, res) => {
  try {
    const { userId, amount, reason } = req.body;
    
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    user.wallet_balance += parseFloat(amount);
    await user.save();
    
    await Transaction.create({
      user_id: userId,
      type: amount >= 0 ? 'admin_deposit' : 'admin_deduction',
      amount: amount,
      balance_after: user.wallet_balance,
      status: 'completed',
      description: reason || `Admin adjusted balance by ${amount} Birr`
    });
    
    res.json({ success: true, newBalance: user.wallet_balance });
  } catch (error) {
    console.error('Adjust balance error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/toggle-status', verifyAdminToken, async (req, res) => {
  try {
    const { userId, isActive } = req.body;
    
    await User.update(
      { is_active: isActive },
      { where: { id: userId } }
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Toggle status error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ DEPOSIT MANAGEMENT ============
router.get('/deposits', verifyAdminToken, async (req, res) => {
  try {
    const { status } = req.query;
    const where = {};
    if (status && status !== 'all') where.status = status;
    
    const deposits = await DepositRequest.findAll({
      where,
      include: [{ model: User, attributes: ['id', 'username', 'phone_number', 'wallet_balance'] }],
      order: [['created_at', 'DESC']]
    });
    
    res.json(deposits);
  } catch (error) {
    console.error('Deposits error:', error);
    res.json([]);
  }
});

router.post('/approve-deposit', verifyAdminToken, async (req, res) => {
  try {
    const { depositId } = req.body;
    
    const deposit = await DepositRequest.findByPk(depositId);
    if (!deposit) {
      return res.status(404).json({ error: 'Deposit not found' });
    }
    
    deposit.status = 'approved';
    deposit.approved_by = req.admin.adminId;
    deposit.approved_at = new Date();
    await deposit.save();
    
    const user = await User.findByPk(deposit.user_id);
    if (user) {
      user.wallet_balance += parseFloat(deposit.amount);
      await user.save();
      
      await Transaction.create({
        user_id: deposit.user_id,
        type: 'deposit',
        amount: deposit.amount,
        balance_after: user.wallet_balance,
        status: 'completed',
        description: `Deposit approved by admin`
      });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Approve deposit error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/reject-deposit', verifyAdminToken, async (req, res) => {
  try {
    const { depositId } = req.body;
    
    const deposit = await DepositRequest.findByPk(depositId);
    if (!deposit) {
      return res.status(404).json({ error: 'Deposit not found' });
    }
    
    deposit.status = 'rejected';
    deposit.approved_by = req.admin.adminId;
    deposit.approved_at = new Date();
    await deposit.save();
    
    res.json({ success: true });
  } catch (error) {
    console.error('Reject deposit error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ WITHDRAWAL MANAGEMENT ============
router.get('/withdrawals', verifyAdminToken, async (req, res) => {
  try {
    const { status } = req.query;
    const where = {};
    if (status && status !== 'all') where.status = status;
    
    const withdrawals = await WithdrawRequest.findAll({
      where,
      include: [{ model: User, attributes: ['id', 'username', 'phone_number', 'wallet_balance'] }],
      order: [['created_at', 'DESC']]
    });
    
    res.json(withdrawals);
  } catch (error) {
    console.error('Withdrawals error:', error);
    res.json([]);
  }
});

router.post('/approve-withdrawal', verifyAdminToken, async (req, res) => {
  try {
    const { withdrawalId } = req.body;
    
    const withdrawal = await WithdrawRequest.findByPk(withdrawalId);
    if (!withdrawal) {
      return res.status(404).json({ error: 'Withdrawal not found' });
    }
    
    withdrawal.status = 'approved';
    withdrawal.approved_by = req.admin.adminId;
    withdrawal.approved_at = new Date();
    await withdrawal.save();
    
    res.json({ success: true });
  } catch (error) {
    console.error('Approve withdrawal error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/complete-withdrawal', verifyAdminToken, async (req, res) => {
  try {
    const { withdrawalId } = req.body;
    
    const withdrawal = await WithdrawRequest.findByPk(withdrawalId);
    if (!withdrawal) {
      return res.status(404).json({ error: 'Withdrawal not found' });
    }
    
    withdrawal.status = 'completed';
    withdrawal.completed_at = new Date();
    await withdrawal.save();
    
    res.json({ success: true });
  } catch (error) {
    console.error('Complete withdrawal error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ SETTINGS MANAGEMENT ============
router.get('/settings', verifyAdminToken, async (req, res) => {
  try {
    const settings = await getSettings();
    res.json(settings);
  } catch (error) {
    console.error('Settings error:', error);
    res.json({});
  }
});

router.post('/settings', verifyAdminToken, async (req, res) => {
  try {
    const settings = req.body;
    
    for (const [key, value] of Object.entries(settings)) {
      await AdminSetting.upsert({
        setting_key: key,
        setting_value: value
      });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Save settings error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ ADVERTISEMENT MANAGEMENT ============
// Public endpoint - no auth required for players to view
router.get('/advertisement', async (req, res) => {
  try {
    const ad = await getAdvertisement();
    res.json(ad);
  } catch (error) {
    console.error('Advertisement error:', error);
    res.json({});
  }
});

// Admin only - for managing ads
router.post('/advertisement', verifyAdminToken, async (req, res) => {
  try {
    const { image_url, message, is_active } = req.body;
    
    const ad = await Advertisement.create({
      image_url,
      message,
      is_active
    });
    
    res.json({ success: true, ad });
  } catch (error) {
    console.error('Save advertisement error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ REPORTS ============
router.get('/reports', verifyAdminToken, async (req, res) => {
  try {
    const { start, end } = req.query;
    const startDate = new Date(start);
    const endDate = new Date(end);
    endDate.setHours(23, 59, 59);
    
    const dailyStats = [];
    let currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      const nextDate = new Date(currentDate);
      nextDate.setDate(nextDate.getDate() + 1);
      
      const games = await Game.count({ where: { created_at: { [Op.gte]: currentDate, [Op.lt]: nextDate } } }) || 0;
      const players = await User.count({ where: { created_at: { [Op.gte]: currentDate, [Op.lt]: nextDate } } }) || 0;
      
      const revenue = await Transaction.sum('amount', {
        where: { type: 'game_fee', status: 'completed', created_at: { [Op.gte]: currentDate, [Op.lt]: nextDate } }
      }) || 0;
      
      const commission = await Transaction.sum('amount', {
        where: { type: 'commission', status: 'completed', created_at: { [Op.gte]: currentDate, [Op.lt]: nextDate } }
      }) || 0;
      
      const prize = await Transaction.sum('amount', {
        where: { type: 'prize', status: 'completed', created_at: { [Op.gte]: currentDate, [Op.lt]: nextDate } }
      }) || 0;
      
      dailyStats.push({
        date: currentDate.toISOString().split('T')[0],
        games,
        players,
        revenue,
        commission,
        prize,
        newUsers: players
      });
      
      currentDate = nextDate;
    }
    
    const totals = {
      totalGames: dailyStats.reduce((sum, d) => sum + d.games, 0),
      totalPlayers: dailyStats.reduce((sum, d) => sum + d.players, 0),
      totalRevenue: dailyStats.reduce((sum, d) => sum + d.revenue, 0),
      totalCommission: dailyStats.reduce((sum, d) => sum + d.commission, 0),
      totalPrize: dailyStats.reduce((sum, d) => sum + d.prize, 0),
      netProfit: dailyStats.reduce((sum, d) => sum + (d.revenue - d.prize), 0)
    };
    
    res.json({ daily: dailyStats, totals });
  } catch (error) {
    console.error('Reports error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;