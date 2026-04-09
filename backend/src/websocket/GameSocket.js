const { Server } = require('socket.io');
const GameService = require('../services/GameService');
const { User, Game, GamePlayer, Cartela, Transaction } = require('../models');

class GameSocket {
  constructor(server) {
    this.io = new Server(server, {
      cors: {
        origin: "*",
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
      console.log('New client connected:', socket.id);
      
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
      
      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });
	  socket.on('get-game-state', async () => {
  if (this.currentGame) {
    const winnerAmount = (this.currentGame.prize_pool * 0.81).toFixed(2);
    socket.emit('game-state', {
      status: this.currentGame.status,
      prizePool: this.currentGame.prize_pool,
      winnerAmount: parseFloat(winnerAmount),
      calledNumbers: this.currentGame.called_numbers || []
    });
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

  async handleSelectCartela(socket, { luckyNumber, userId }) {
  try {
    const player = this.players.get(socket.id);
    if (!player || player.userId !== userId) {
      socket.emit('error', { message: 'Invalid session' });
      return;
    }
    
    if (!this.currentGame || this.currentGame.status !== 'waiting') {
      socket.emit('error', { message: 'Game already started. Cannot join now.' });
      return;
    }
    
    // Check max cartelas per player
    if (player.cartelaIds.length >= 2) {
      socket.emit('error', { message: 'Maximum 2 cartelas allowed per game!' });
      return;
    }
    
    // Check if lucky number is already taken
    const existingPlayer = Array.from(this.players.values()).some(p => 
      p.cartelaIds.includes(luckyNumber)
    );
    
    if (existingPlayer) {
      socket.emit('error', { message: 'Lucky number already taken' });
      return;
    }
    
    // Get user to check balance
    const user = await User.findByPk(userId);
    if (!user) {
      socket.emit('error', { message: 'User not found' });
      return;
    }
    
    // Calculate total cost for ALL selected cartelas (including this one)
    const newTotalCartelas = player.cartelaIds.length + 1;
    const totalCost = newTotalCartelas * 10;
    
    // Check if user has sufficient balance for ALL cartelas
    if (user.wallet_balance < totalCost) {
      socket.emit('error', { 
        message: `Insufficient balance! You need ${totalCost} Birr for ${newTotalCartelas} cartela(s). Your balance: ${user.wallet_balance} Birr` 
      });
      return;
    }
    
    const cartela = await Cartela.findOne({ where: { lucky_number: luckyNumber } });
    if (!cartela) {
      socket.emit('error', { message: 'Invalid lucky number' });
      return;
    }
    
    // Add cartela to player
    player.cartelaIds.push(luckyNumber);
    
    // Update game stats - ONLY update prize pool, don't deduct yet
    this.currentGame.prize_pool += 10;
    this.currentGame.total_cartelas += 1;
    this.currentGame.total_players = this.getUniquePlayerCount();
    await this.currentGame.save();
    
    // Create or update game player record
    let gamePlayer = await GamePlayer.findOne({
      where: { game_id: this.currentGame.id, user_id: userId }
    });
    
    if (gamePlayer) {
      const updatedCartelas = [...gamePlayer.cartela_ids, luckyNumber];
      gamePlayer.cartela_ids = updatedCartelas;
      await gamePlayer.save();
    } else {
      await GamePlayer.create({
        game_id: this.currentGame.id,
        user_id: userId,
        cartela_ids: [luckyNumber],
        marked_numbers: []
      });
    }
    
    // Calculate winner amount (81% of prize pool)
    const winnerAmount = (this.currentGame.prize_pool * 0.81).toFixed(2);
    
    // Broadcast updated game state to ALL players
    this.io.emit('game-update', {
      totalPlayers: this.getUniquePlayerCount(),
      totalCartelas: this.currentGame.total_cartelas,
      prizePool: this.currentGame.prize_pool,
      winnerAmount: parseFloat(winnerAmount)
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
    console.error('Select cartela error:', error);
    socket.emit('error', { message: error.message || 'Failed to select cartela' });
  }
}

  async handleDeselectCartela(socket, { luckyNumber, userId }) {
  try {
    const player = this.players.get(socket.id);
    if (!player || player.userId !== userId) {
      socket.emit('error', { message: 'Invalid session' });
      return;
    }
    
    const index = player.cartelaIds.indexOf(luckyNumber);
    if (index > -1) {
      player.cartelaIds.splice(index, 1);
      
      if (this.currentGame && this.currentGame.id) {
        const gamePlayer = await GamePlayer.findOne({
          where: { game_id: this.currentGame.id, user_id: userId }
        });
        
        if (gamePlayer) {
          const updatedCartelas = gamePlayer.cartela_ids.filter(id => id !== luckyNumber);
          gamePlayer.cartela_ids = updatedCartelas;
          await gamePlayer.save();
          
          // Subtract from prize pool
          this.currentGame.prize_pool -= 10;
          this.currentGame.total_cartelas -= 1;
          this.currentGame.total_players = this.getUniquePlayerCount();
          await this.currentGame.save();
          
          // Calculate winner amount (81% of prize pool)
          const winnerAmount = (this.currentGame.prize_pool * 0.81).toFixed(2);
          
          // Broadcast updated game state
          this.io.emit('game-update', {
            totalPlayers: this.getUniquePlayerCount(),
            totalCartelas: this.currentGame.total_cartelas,
            prizePool: this.currentGame.prize_pool,
            winnerAmount: parseFloat(winnerAmount)
          });
        }
      }
      
      this.io.emit('cartela-deselected', { luckyNumber, userId });
      socket.emit('cartela-deselected-success', { luckyNumber });
    }
  } catch (error) {
    console.error('Deselect error:', error);
    socket.emit('error', { message: 'Failed to deselect cartela' });
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

async handlePressBingo(socket, { userId, gameId }) {
  console.log(`\n========== MANUAL BINGO PRESS ==========`);
  console.log(`User ${userId} pressed BINGO button`);
  
  try {
    // Check if game is active
    if (!this.currentGame || this.currentGame.status !== 'active') {
      socket.emit('error', { message: 'No active game' });
      return;
    }
    
    // Get player's game record
    const gamePlayer = await GamePlayer.findOne({
      where: { game_id: this.currentGame.id, user_id: userId }
    });
    
    if (!gamePlayer) {
      socket.emit('error', { message: 'You are not in this game' });
      return;
    }
    
    const markedNumbers = gamePlayer.marked_numbers || [];
    console.log(`Marked numbers for user ${userId}:`, markedNumbers);
    console.log(`Cartelas for user ${userId}:`, gamePlayer.cartela_ids);
    
    let hasWon = false;
    let winningCartela = null;
    
    // Check each cartela for winning pattern
    for (const luckyNumber of gamePlayer.cartela_ids) {
      const cartela = await Cartela.findOne({ 
        where: { lucky_number: luckyNumber }
      });
      
      if (cartela) {
        console.log(`Checking cartela ${luckyNumber}...`);
        console.log(`Cartela data:`, JSON.stringify(cartela.card_data, null, 2));
        
        const hasWon = this.gameService.checkWinPattern(
          cartela.card_data,
          markedNumbers
        );
        
        console.log(`Cartela ${luckyNumber} has winning pattern: ${hasWon}`);
        
        if (hasWon) {
          hasWon = true;
          winningCartela = luckyNumber;
          break;
        }
      }
    }
    
    if (hasWon) {
      console.log(`✅✅✅ WINNER VALIDATED! User ${userId} with cartela ${winningCartela}`);
      await this.processWin(userId);
    } else {
      console.log(`❌ INVALID BINGO! No winning pattern found`);
      socket.emit('invalid-bingo', { 
        message: 'No valid BINGO pattern found! Keep playing!' 
      });
    }
  } catch (error) {
    console.error('Bingo error:', error);
    socket.emit('error', { message: 'Failed to verify BINGO' });
  }
}

async startNewGame() {
  console.log('Starting new game...');
  
  this.players.forEach(player => {
    player.cartelaIds = [];
    player.pendingDeductions = [];
  });
  
  const gameNumber = await this.getNextGameNumber();
  this.currentGame = await Game.create({
    game_number: gameNumber,
    status: 'waiting',
    total_players: 0,
    total_cartelas: 0,
    prize_pool: 0,  // Start at 0
    commission: 0,
    called_numbers: []
  });
  
  console.log(`Game #${gameNumber} created with prize pool: 0`);
  this.startWaitingPeriod();
}

  async startWaitingPeriod() {
    let waitingTime = 35;
    let countdownInterval = null;
    let playerCheckInterval = null;
    let isGameStarting = false;
    
    this.io.emit('game-waiting', {
      prepareTime: waitingTime,
      message: 'Game starting soon! Select your lucky numbers!'
    });
    
    countdownInterval = setInterval(() => {
      if (waitingTime > 0) {
        waitingTime--;
        this.io.emit('countdown-update', { timeRemaining: waitingTime });
      }
    }, 1000);
    
    playerCheckInterval = setInterval(async () => {
      const playerCount = this.getUniquePlayerCount();
      
      if (isGameStarting) return;
      
      if (waitingTime <= 0 && playerCount >= 2 && !isGameStarting) {
        console.log('Starting game!');
        isGameStarting = true;
        clearInterval(countdownInterval);
        clearInterval(playerCheckInterval);
        await this.startGame();
      } 
      else if (waitingTime <= 0 && playerCount < 2 && !isGameStarting) {
        console.log(`Not enough players. Resetting...`);
        waitingTime = 35;
        this.io.emit('game-waiting', {
          prepareTime: waitingTime,
          message: `Not enough players. Waiting...`
        });
      }
    }, 1000);
    
    this.waitingIntervals = { countdownInterval, playerCheckInterval };
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
  
  const winnerAmount = Math.round((currentPrizePool * 0.81) * 100) / 100;
  
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
      if (this.currentGame.status !== 'active') {
        clearInterval(this.gameInterval);
        return;
      }
      
      const availableNumbers = allNumbers.filter(n => !calledNumbers.includes(n));
      
      if (availableNumbers.length === 0 || callCount >= 75) {
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
      
      console.log(`Call #${callCount}: ${calledNumber}`);
      
      this.io.emit('number-called', {
        number: calledNumber,
        calledNumbers: calledNumbers,
        callCount: callCount
      });
      
      await this.checkForWinners(calledNumber, callCount);
      
    }, 4000);
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

  async processWin(winnerId) {
  console.log(`\n========== PROCESSING WINNER ==========`);
  console.log(`Winner ID: ${winnerId}`);
  
  // Stop the game interval
  if (this.gameInterval) {
    clearInterval(this.gameInterval);
    this.gameInterval = null;
  }
  
  // Calculate prize (81% of prize pool)
  const prizePoolNum = parseFloat(this.currentGame.prize_pool) || 0;
  const totalPrize = (prizePoolNum * 81) / 100;
  const roundedPrize = Math.round(totalPrize * 100) / 100;
  
  console.log(`Prize pool: ${prizePoolNum}, Winner gets: ${roundedPrize}`);
  
  // Credit the winner
  const user = await User.findByPk(winnerId);
  if (user) {
    const oldBalance = parseFloat(user.wallet_balance) || 0;
    const newBalance = oldBalance + roundedPrize;
    
    user.wallet_balance = newBalance;
    user.total_won = (user.total_won || 0) + 1;
    await user.save();
    
    console.log(`Winner balance updated: ${oldBalance} -> ${newBalance}`);
    
    await Transaction.create({
      user_id: winnerId,
      type: 'prize',
      amount: roundedPrize,
      balance_after: newBalance,
      status: 'completed',
      description: `Won ${roundedPrize} Birr from game #${this.currentGame.game_number}`
    });
  }
  
  // Update game record
  await GamePlayer.update(
    { is_winner: true, prize_amount: roundedPrize },
    { where: { game_id: this.currentGame.id, user_id: winnerId } }
  );
  
  this.currentGame.status = 'completed';
  this.currentGame.winner_ids = [winnerId];
  this.currentGame.winner_amount = roundedPrize;
  this.currentGame.end_time = new Date();
  await this.currentGame.save();
  
  // Announce winner to ALL players
  this.io.emit('game-ended', {
    winners: [{ userId: winnerId, amount: roundedPrize }],
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