const express = require('express');
const router = express.Router();
const { Game, GamePlayer, Cartela, User } = require('../models');
const { authenticate } = require('../middlewares/auth');

// Get current game state
router.get('/current', authenticate, async (req, res) => {
  try {
    const currentGame = await Game.findOne({
      where: { status: ['waiting', 'active'] },
      order: [['created_at', 'DESC']]
    });
    
    if (!currentGame) {
      return res.json({ gameExists: false });
    }
    
    res.json({
      gameExists: true,
      game: {
        id: currentGame.id,
        game_number: currentGame.game_number,
        status: currentGame.status,
        prize_pool: currentGame.prize_pool,
        called_numbers: currentGame.called_numbers,
        total_players: currentGame.total_players
      }
    });
  } catch (error) {
    console.error('Error fetching current game:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get user's cartelas for current game
router.get('/user-cartelas/:userId', authenticate, async (req, res) => {
  try {
    const { userId } = req.params;
    
    const currentGame = await Game.findOne({
      where: { status: 'active' },
      order: [['created_at', 'DESC']]
    });
    
    if (!currentGame) {
      return res.json({ cartelas: [] });
    }
    
    const gamePlayer = await GamePlayer.findOne({
      where: {
        game_id: currentGame.id,
        user_id: userId
      }
    });
    
    if (!gamePlayer || !gamePlayer.cartela_ids || gamePlayer.cartela_ids.length === 0) {
      return res.json({ cartelas: [] });
    }
    
    // Fetch cartela data for each lucky number
    const cartelas = [];
    for (const luckyNumber of gamePlayer.cartela_ids) {
      const cartela = await Cartela.findOne({
        where: { lucky_number: luckyNumber }
      });
      if (cartela) {
        cartelas.push({
          lucky_number: luckyNumber,
          card_data: cartela.card_data,
          marked_numbers: gamePlayer.marked_numbers || []
        });
      }
    }
    
    res.json({ cartelas });
  } catch (error) {
    console.error('Error fetching user cartelas:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get available lucky numbers (not taken)
router.get('/available-numbers', authenticate, async (req, res) => {
  try {
    const currentGame = await Game.findOne({
      where: { status: ['waiting', 'active'] },
      order: [['created_at', 'DESC']]
    });
    
    if (!currentGame) {
      // Return all numbers 1-100 if no active game
      const allNumbers = Array.from({ length: 100 }, (_, i) => i + 1);
      return res.json({ availableNumbers: allNumbers });
    }
    
    // Get all taken lucky numbers from game players
    const gamePlayers = await GamePlayer.findAll({
      where: { game_id: currentGame.id },
      attributes: ['cartela_ids']
    });
    
    const takenNumbers = new Set();
    gamePlayers.forEach(player => {
      if (player.cartela_ids && Array.isArray(player.cartela_ids)) {
        player.cartela_ids.forEach(num => takenNumbers.add(num));
      }
    });
    
    const availableNumbers = [];
    for (let i = 1; i <= 100; i++) {
      if (!takenNumbers.has(i)) {
        availableNumbers.push(i);
      }
    }
    
    res.json({ availableNumbers });
  } catch (error) {
    console.error('Error fetching available numbers:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get game history for a specific game
router.get('/history/:gameId', authenticate, async (req, res) => {
  try {
    const { gameId } = req.params;
    
    const game = await Game.findByPk(gameId, {
      include: [{
        model: GamePlayer,
        include: [{
          model: User,
          attributes: ['id', 'username', 'phone_number']
        }]
      }]
    });
    
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    res.json(game);
  } catch (error) {
    console.error('Error fetching game history:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get leaderboard (top winners)
router.get('/leaderboard', authenticate, async (req, res) => {
  try {
    const topWinners = await User.findAll({
      attributes: ['id', 'username', 'phone_number', 'total_won', 'wallet_balance'],
      where: { total_won: { [require('sequelize').Op.gt]: 0 } },
      order: [['total_won', 'DESC']],
      limit: 10
    });
    
    res.json(topWinners);
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;