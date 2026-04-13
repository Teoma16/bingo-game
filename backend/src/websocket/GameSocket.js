const { Server } = require('socket.io');
const GameService = require('../services/GameService');
const { User, Game, GamePlayer, Cartela, Transaction } = require('../models');

class GameSocket {
  constructor(server) {
  this.io = new Server(server, {
  cors: {
    origin: ['https://earnest-amazement-production.up.railway.app', 'http://localhost:3000'],
    methods: ["GET", "POST"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"]
  }
});
    this.gameService = new GameService();
    this.currentGame = null;
    this.gameInterval = null;
    this.players = new Map();
    this.waitingIntervals = null;
    
    this.initialize();
  }

  initialize() {
    this.io.on('connection', (socket) => {
      console.log('✅ Client connected:', socket.id);
      
      socket.on('register-player', async (data) => {
        await this.handleRegisterPlayer(socket, data);
      });
      
      socket.on('select-cartela', async (data) => {
        await this.handleSelectCartela(socket, data);
      });
      
      socket.on('deselect-cartela', async (data) => {
        await this.handleDeselectCartela(socket, data);
      });
      
      socket.on('press-bingo', async (data) => {
        await this.handlePressBingo(socket, data);
      });
      
      socket.on('auto-mark', async (data) => {
        await this.handleAutoMark(socket, data);
      });
      
      socket.on('get-game-state', async () => {
        await this.sendGameState(socket);
      });
      
      socket.on('force-win', async (data) => {
        console.log('🏆 FORCE WIN for user:', data.userId);
        await this.processWin(data.userId);
      });
      
      socket.on('disconnect', () => {
        console.log('❌ Client disconnected:', socket.id);
        this.handleDisconnect(socket);
      });
	  
	  
	  
	  socket.on('get-marked-numbers', async (data) => {
  for (const [sId, player] of this.players) {
    if (player.userId === data.userId) {
      console.log(`📊 Server marked numbers for user ${data.userId}:`, player.markedNumbers);
      socket.emit('debug-marked', { marked: player.markedNumbers });
      break;
    }
  }
});


    });
    
    this.startNewGame();
  }

  async handleRegisterPlayer(socket, { userId, phoneNumber }) {
  try {
    const user = await User.findOne({ 
      where: { 
        [require('sequelize').Op.or]: [
          { id: userId },
          { phone_number: phoneNumber }
        ]
      } 
    });
    
    if (!user) {
      socket.emit('error', { message: 'User not found' });
      return;
    }
    
    this.players.set(socket.id, {
      userId: user.id,
      cartelaIds: [],
      socketId: socket.id
    });
    
    // IMPORTANT: If game is active, mark all previously called numbers for this player
    if (this.currentGame && this.currentGame.status === 'active') {
      const gamePlayer = await GamePlayer.findOne({
        where: { game_id: this.currentGame.id, user_id: user.id }
      });
      
      if (gamePlayer) {
        let markedNumbers = gamePlayer.marked_numbers || [];
        const calledNumbers = this.currentGame.called_numbers || [];
        
        // Mark all numbers that have been called so far
        for (const calledNum of calledNumbers) {
          if (!markedNumbers.includes(calledNum)) {
            markedNumbers.push(calledNum);
          }
        }
        
        gamePlayer.marked_numbers = markedNumbers;
        await gamePlayer.save();
        console.log(`[SYNC] Player ${user.id} synced ${markedNumbers.length} marked numbers from ${calledNumbers.length} called numbers`);
      }
    }
    
    socket.emit('registered', {
      user: {
        id: user.id,
        username: user.username,
        wallet_balance: user.wallet_balance,
        total_played: user.total_played,
        total_won: user.total_won
      }
    });
    
    if (this.currentGame) {
      const winnerAmount = (this.currentGame.prize_pool * 0.81).toFixed(2);
      socket.emit('game-state', {
        status: this.currentGame.status,
        prizePool: this.currentGame.prize_pool,
        winnerAmount: winnerAmount,
        calledNumbers: this.currentGame.called_numbers || []
      });
    }
  } catch (error) {
    console.error('Register error:', error);
    socket.emit('error', { message: 'Registration failed' });
  }
}

  async sendGameState(socket) {
    if (this.currentGame) {
      socket.emit('game-state', {
        status: this.currentGame.status,
        prizePool: this.currentGame.prize_pool,
        winnerAmount: this.currentGame.prize_pool * 0.81,
        calledNumbers: this.currentGame.called_numbers || []
      });
    }
  }

  async handleSelectCartela(socket, { luckyNumber, userId }) {
    try {
      const player = this.players.get(socket.id);
      if (!player || player.userId !== userId) {
        socket.emit('error', { message: 'Invalid session' });
        return;
      }
      
      if (!this.currentGame || this.currentGame.status !== 'waiting') {
        socket.emit('error', { message: 'Game already started' });
        return;
      }
      
      if (player.cartelaIds.length >= 2) {
        socket.emit('error', { message: 'Maximum 2 cartelas allowed' });
        return;
      }
      
      const existingPlayer = Array.from(this.players.values()).some(p => 
        p.cartelaIds.includes(luckyNumber)
      );
      
      if (existingPlayer) {
        socket.emit('error', { message: 'Number already taken' });
        return;
      }
      
      const user = await User.findByPk(userId);
      if (!user || user.wallet_balance < (player.cartelaIds.length + 1) * 10) {
        socket.emit('error', { message: 'Insufficient balance' });
        return;
      }
      
      const cartela = await Cartela.findOne({ where: { lucky_number: luckyNumber } });
      if (!cartela) {
        socket.emit('error', { message: 'Invalid lucky number' });
        return;
      }
      
      player.cartelaIds.push(luckyNumber);
      
      this.currentGame.prize_pool += 10;
      this.currentGame.total_cartelas += 1;
      this.currentGame.total_players = this.getUniquePlayerCount();
      await this.currentGame.save();
      
      this.io.emit('game-update', {
        totalPlayers: this.getUniquePlayerCount(),
        totalCartelas: this.currentGame.total_cartelas,
        prizePool: this.currentGame.prize_pool,
        winnerAmount: this.currentGame.prize_pool * 0.81
      });
      
      this.io.emit('cartela-selected', {
        luckyNumber,
        userId,
        cartelaData: cartela.card_data
      });
      
      socket.emit('cartela-selected-success', {
        luckyNumber,
        cartelaData: cartela.card_data,
        message: `Cartela ${luckyNumber} selected!`
      });
      
    } catch (error) {
      console.error('Select error:', error);
      socket.emit('error', { message: error.message });
    }
  }

  async handleDeselectCartela(socket, { luckyNumber, userId }) {
    // Similar to select but subtract
    const player = this.players.get(socket.id);
    if (!player) return;
    
    const index = player.cartelaIds.indexOf(luckyNumber);
    if (index > -1) {
      player.cartelaIds.splice(index, 1);
      
      if (this.currentGame && this.currentGame.status === 'waiting') {
        this.currentGame.prize_pool -= 10;
        this.currentGame.total_cartelas -= 1;
        await this.currentGame.save();
        
        this.io.emit('game-update', {
          totalPlayers: this.getUniquePlayerCount(),
          totalCartelas: this.currentGame.total_cartelas,
          prizePool: this.currentGame.prize_pool,
          winnerAmount: this.currentGame.prize_pool * 0.81
        });
      }
      
      this.io.emit('cartela-deselected', { luckyNumber, userId });
      socket.emit('cartela-deselected-success', { luckyNumber });
    }
  }
async handleAutoMark(socket, { userId, gameId, number }) {
  console.log(`🤖 Auto-mark: User ${userId} marking number ${number}`);
  
  try {
    // Find the game player
    const gamePlayer = await GamePlayer.findOne({
      where: { 
        game_id: gameId, 
        user_id: userId 
      }
    });
    
    if (!gamePlayer) {
      console.log(`❌ GamePlayer not found for user ${userId}, game ${gameId}`);
      return;
    }
    
    // Get current marked numbers
    let markedNumbers = gamePlayer.marked_numbers || [];
    console.log(`[BEFORE] Marked numbers:`, markedNumbers);
    
    // Add new number if not already there
    if (!markedNumbers.includes(number)) {
      markedNumbers.push(number);
      
      // METHOD 1: Direct assignment and save
      gamePlayer.marked_numbers = markedNumbers;
      await gamePlayer.save();
      
      console.log(`[AFTER] Saved. Now has ${markedNumbers.length} numbers`);
      
      // METHOD 2: Also try using sequelize's update method as backup
      await GamePlayer.update(
        { marked_numbers: markedNumbers },
        { where: { id: gamePlayer.id } }
      );
      
      console.log(`[AFTER] Updated with sequelize.update`);
    }
    
    // Verify by fetching fresh from database
    const verifyPlayer = await GamePlayer.findOne({
      where: { id: gamePlayer.id },
      raw: true
    });
    console.log(`[VERIFY] Database now shows:`, verifyPlayer?.marked_numbers);
    
  } catch (error) {
    console.error('Auto-mark error:', error);
  }
}

async checkForWinners(calledNumber, callCount) {
  console.log(`\n🎯 CALL #${callCount}: ${calledNumber}`);
  
  try {
    const gamePlayers = await GamePlayer.findAll({
      where: { game_id: this.currentGame.id }
    });
    
    console.log(`Total players: ${gamePlayers.length}`);
    
    for (const gamePlayer of gamePlayers) {
      let markedNumbers = gamePlayer.marked_numbers || [];
      
      if (!markedNumbers.includes(calledNumber)) {
        markedNumbers.push(calledNumber);
        
        // Use both save methods
        gamePlayer.marked_numbers = markedNumbers;
        await gamePlayer.save();
        await GamePlayer.update(
          { marked_numbers: markedNumbers },
          { where: { id: gamePlayer.id } }
        );
        
        console.log(`✅ Player ${gamePlayer.user_id} - Added ${calledNumber}`);
        console.log(`   Now has ${markedNumbers.length} numbers: [${markedNumbers.join(', ')}]`);
      }
      
      // Check for win...
      for (const luckyNumber of gamePlayer.cartela_ids) {
        const cartela = await Cartela.findOne({ 
          where: { lucky_number: luckyNumber }
        });
        
        if (cartela) {
          const hasWon = this.gameService.checkWinPattern(cartela.card_data, markedNumbers);
          if (hasWon) {
            console.log(`🏆 WINNER! Player ${gamePlayer.user_id}`);
            await this.processWin(gamePlayer.user_id);
            return;
          }
        }
      }
    }
  } catch (error) {
    console.error('Error checking winners:', error);
  }
}

  async handlePressBingo(socket, { userId }) {
    console.log(`🔴 Manual BINGO from user ${userId}`);
    
    for (const [sId, player] of this.players) {
      if (player.userId === userId) {
        const marked = player.markedNumbers || [];
        
        for (const luckyNumber of player.cartelaIds) {
          const cartela = await Cartela.findOne({ where: { lucky_number: luckyNumber } });
          if (!cartela) continue;
          
          const allNumbers = [
            cartela.card_data.B[0], cartela.card_data.B[1], cartela.card_data.B[2], cartela.card_data.B[3], cartela.card_data.B[4],
            cartela.card_data.I[0], cartela.card_data.I[1], cartela.card_data.I[2], cartela.card_data.I[3], cartela.card_data.I[4],
            cartela.card_data.N[0], cartela.card_data.N[1], cartela.card_data.N[3], cartela.card_data.N[4],
            cartela.card_data.G[0], cartela.card_data.G[1], cartela.card_data.G[2], cartela.card_data.G[3], cartela.card_data.G[4],
            cartela.card_data.O[0], cartela.card_data.O[1], cartela.card_data.O[2], cartela.card_data.O[3], cartela.card_data.O[4]
          ].filter(n => n !== 'FREE');
          
          const allMarked = allNumbers.every(num => marked.includes(num));
          
          if (allMarked) {
            console.log(`✅ Valid BINGO!`);
            await this.processWin(player.userId);
            return;
          }
        }
        
        socket.emit('invalid-bingo', { message: 'No BINGO pattern found!' });
        return;
      }
    }
  }

  async startNewGame() {
    console.log('🔄 Starting new game...');
    
    this.players.forEach(player => {
      player.cartelaIds = [];
      player.markedNumbers = [];
    });
    
    const gameNumber = await this.getNextGameNumber();
    this.currentGame = await Game.create({
      game_number: gameNumber,
      status: 'waiting',
      total_players: 0,
      total_cartelas: 0,
      prize_pool: 0,
      commission: 0,
      called_numbers: []
    });
    
    console.log(`🎮 Game #${gameNumber} created`);
    this.startWaitingPeriod();
  }

  async startWaitingPeriod() {
    let waitingTime = 35;
    
    this.io.emit('game-waiting', {
      prepareTime: waitingTime,
      message: 'Game starting soon! Select your lucky numbers!'
    });
    
    const countdownInterval = setInterval(() => {
      if (waitingTime > 0) {
        waitingTime--;
        this.io.emit('countdown-update', { timeRemaining: waitingTime });
      }
    }, 1000);
    
    const playerCheckInterval = setInterval(async () => {
      const playerCount = this.getUniquePlayerCount();
      
      if (waitingTime <= 0 && playerCount >= 2) {
        clearInterval(countdownInterval);
        clearInterval(playerCheckInterval);
        await this.startGame();
      } else if (waitingTime <= 0 && playerCount < 2) {
        waitingTime = 35;
        this.io.emit('game-waiting', {
          prepareTime: waitingTime,
          message: `Not enough players (${playerCount}/2). Waiting...`
        });
      }
    }, 1000);
  }

async startGame() {
  // Refresh game data
  this.currentGame = await Game.findByPk(this.currentGame.id);
  
  const currentPrizePool = parseFloat(this.currentGame.prize_pool) || 0;
  console.log(`Starting game with prize pool: ${currentPrizePool}`);
  
  const playerCount = this.getUniquePlayerCount();
  if (playerCount < 2) {
    this.startWaitingPeriod();
    return;
  }
  
  // Deduct fees from all players
  for (const [socketId, player] of this.players) {
    if (player.cartelaIds.length > 0) {
      const user = await User.findByPk(player.userId);
      if (user && user.wallet_balance >= player.cartelaIds.length * 10) {
        const totalAmount = player.cartelaIds.length * 10;
        const oldBalance = parseFloat(user.wallet_balance) || 0;
        const newBalance = oldBalance - totalAmount;  // Subtraction, not string concatenation
        
        user.wallet_balance = newBalance;
        await user.save();
        
        await Transaction.create({
          user_id: player.userId,
          type: 'game_fee',
          amount: -totalAmount,
          balance_after: newBalance,
          status: 'completed',
          description: `Game entry fee for ${player.cartelaIds.length} cartela(s)`
        });
      }
    }
  }
  
  this.currentGame.status = 'active';
  this.currentGame.start_time = new Date();
  this.currentGame.total_players = this.getUniquePlayerCount();
  this.currentGame.commission = currentPrizePool * 0.19;
  await this.currentGame.save();
  
  const winnerAmount = Math.round((currentPrizePool * 0.81) * 1);
  
  console.log(`✅ Game started! Prize pool: ${currentPrizePool}, Winner gets: ${winnerAmount}`);
  
  this.io.emit('game-started', {
    gameId: this.currentGame.id,
    gameNumber: this.currentGame.game_number,
    prizePool: currentPrizePool,
    winnerAmount: winnerAmount,
    message: 'Game Started!'
  });
  
  this.callNumbers();
}

  callNumbers() {
    const allNumbers = [];
    for (let i = 1; i <= 75; i++) allNumbers.push(i);
    
    const calledNumbers = [];
    let callCount = 0;
    
    this.gameInterval = setInterval(async () => {
      if (!this.currentGame || this.currentGame.status !== 'active') {
        clearInterval(this.gameInterval);
        return;
      }
      
      const availableNumbers = allNumbers.filter(n => !calledNumbers.includes(n));
      
      if (availableNumbers.length === 0) {
        clearInterval(this.gameInterval);
        this.io.emit('game-ended', { message: 'Game ended - No winner!' });
        setTimeout(() => this.startNewGame(), 5000);
        return;
      }
      
      const randomIndex = Math.floor(Math.random() * availableNumbers.length);
      const calledNumber = availableNumbers[randomIndex];
      calledNumbers.push(calledNumber);
      callCount++;
      
      this.currentGame.called_numbers = calledNumbers;
      await this.currentGame.save();
      
      console.log(`📢 CALL #${callCount}: ${calledNumber}`);
      
      this.io.emit('number-called', {
        number: calledNumber,
        calledNumbers: calledNumbers,
        callCount: callCount
      });
      
      const hasWinner = await this.checkForWinners();
      if (hasWinner) {
        clearInterval(this.gameInterval);
      }
      
    }, 2000);
  }

  async processWin(winnerId) {
  console.log(`\n🏆🏆🏆 PROCESSING WINNER - User ${winnerId} 🏆🏆🏆`);
  
  if (this.gameInterval) {
    clearInterval(this.gameInterval);
    this.gameInterval = null;
  }
  
  // Get fresh game data
  const freshGame = await Game.findByPk(this.currentGame.id);
  const prizePoolNum = parseFloat(freshGame.prize_pool) || 0;
  
  // Calculate prize (81% of prize pool)
  const totalPrize = (prizePoolNum * 81) / 100;
  const roundedPrize = Math.round(totalPrize * 100) / 100;
  
  console.log(`💰 Prize pool: ${prizePoolNum}, Winner gets: ${roundedPrize}`);
  
  if (roundedPrize <= 0) {
    console.log(`⚠️ Prize amount is zero or negative`);
    this.io.emit('game-ended', {
      winners: [],
      prizeAmount: 0,
      message: `Game ended - No valid prize amount!`
    });
    setTimeout(() => this.startNewGame(), 5000);
    return;
  }
  
  // Credit the winner - FIX: Use proper number addition, not string concatenation
  const user = await User.findByPk(winnerId);
  if (user) {
    const oldBalance = parseFloat(user.wallet_balance) || 0;
    const newBalance = oldBalance + roundedPrize;  // This adds numbers, not strings!
    
    console.log(`💰 Old balance: ${oldBalance}, Adding: ${roundedPrize}, New balance: ${newBalance}`);
    
    user.wallet_balance = newBalance;
    user.total_won = (user.total_won || 0) + 1;
    await user.save();
    
    await Transaction.create({
      user_id: winnerId,
      type: 'prize',
      amount: roundedPrize,
      balance_after: newBalance,
      status: 'completed',
      description: `Won ${roundedPrize} Birr from game #${freshGame.game_number}`
    });
  }
  
  // Update game player record
  await GamePlayer.update(
    { is_winner: true, prize_amount: roundedPrize },
    { where: { game_id: freshGame.id, user_id: winnerId } }
  );
  
  // Update game record
  freshGame.status = 'completed';
  freshGame.winner_ids = [winnerId];
  freshGame.winner_amount = roundedPrize;
  freshGame.end_time = new Date();
  await freshGame.save();
  
  // Update current game reference
  this.currentGame = freshGame;
  
  // Announce winner
  this.io.emit('game-ended', {
    winners: [{ userId: winnerId, amount: roundedPrize, totalAmount: roundedPrize, bonus: 0 }],
    prizeAmount: roundedPrize,
    message: `🎉 BINGO! ${user?.username || 'Player'} wins ${roundedPrize.toFixed(2)} Birr! 🎉`
  });
  
  // Start next game after 5 seconds
  setTimeout(() => {
    console.log('Starting next game...');
    this.startNewGame();
  }, 5000);
}

  getUniquePlayerCount() {
    const uniqueUsers = new Set();
    this.players.forEach(player => {
      if (player.cartelaIds.length > 0) {
        uniqueUsers.add(player.userId);
      }
    });
    return uniqueUsers.size;
  }

  async getNextGameNumber() {
    const lastGame = await Game.findOne({ order: [['game_number', 'DESC']] });
    return lastGame ? lastGame.game_number + 1 : 1;
  }

  handleDisconnect(socket) {
    console.log('Client disconnected:', socket.id);
    this.players.delete(socket.id);
  }
}

module.exports = GameSocket;