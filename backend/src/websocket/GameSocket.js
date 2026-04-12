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
    this.gameEnded = false;  // Add this flag
    
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
      
      socket.on('get-game-state', async () => {
        await this.sendGameState(socket);
      });
      
      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
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
        markedNumbers: [],  // Memory storage for marked numbers
        socketId: socket.id
      });
      
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
        const winnerAmount = (this.currentGame.prize_pool * 0.81);
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
      const winnerAmount = (this.currentGame.prize_pool * 0.81);
      socket.emit('game-state', {
        status: this.currentGame.status,
        prizePool: this.currentGame.prize_pool,
        winnerAmount: winnerAmount,
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
        socket.emit('error', { message: 'Game already started. Cannot join now.' });
        return;
      }
      
      if (player.cartelaIds.length >= 2) {
        socket.emit('error', { message: 'Maximum 2 cartelas allowed per game!' });
        return;
      }
      
      const existingPlayer = Array.from(this.players.values()).some(p => 
        p.cartelaIds.includes(luckyNumber)
      );
      
      if (existingPlayer) {
        socket.emit('error', { message: 'Lucky number already taken by another player!' });
        return;
      }
      
      const user = await User.findByPk(userId);
      if (!user) {
        socket.emit('error', { message: 'User not found' });
        return;
      }
      
      const newTotalCartelas = player.cartelaIds.length + 1;
      const totalCost = newTotalCartelas * 10;
      
      if (user.wallet_balance < totalCost) {
        socket.emit('error', { 
          message: `Insufficient balance! Need ${totalCost} Birr for ${newTotalCartelas} cartela(s). Your balance: ${user.wallet_balance} Birr` 
        });
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
      
      const winnerAmount = (this.currentGame.prize_pool * 0.81);
      
      this.io.emit('game-update', {
        totalPlayers: this.getUniquePlayerCount(),
        totalCartelas: this.currentGame.total_cartelas,
        prizePool: this.currentGame.prize_pool,
        winnerAmount: winnerAmount
      });
      
      this.io.emit('cartela-selected', {
        luckyNumber,
        userId,
        cartelaData: cartela.card_data
      });
      
      socket.emit('cartela-selected-success', {
        luckyNumber,
        cartelaData: cartela.card_data,
        message: `Cartela ${luckyNumber} selected! (${player.cartelaIds.length}/2 cartelas)`
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
            
            this.currentGame.prize_pool -= 10;
            this.currentGame.total_cartelas -= 1;
            this.currentGame.total_players = this.getUniquePlayerCount();
            await this.currentGame.save();
            
            const winnerAmount = (this.currentGame.prize_pool * 0.81);
            
            this.io.emit('game-update', {
              totalPlayers: this.getUniquePlayerCount(),
              totalCartelas: this.currentGame.total_cartelas,
              prizePool: this.currentGame.prize_pool,
              winnerAmount: winnerAmount
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

  // ============ MEMORY-BASED AUTO-MARK ============
  async handleAutoMark(socket, { userId, number }) {
    // Store in memory only - NO DATABASE
    for (const [socketId, player] of this.players) {
      if (player.userId === userId) {
        if (!player.markedNumbers.includes(number)) {
          player.markedNumbers.push(number);
          console.log(`✅ Player ${userId} marked ${number} (${player.markedNumbers.length} total)`);
        }
        break;
      }
    }
  }

  // ============ MEMORY-BASED WINNER DETECTION ============
  async checkForWinners(calledNumber, callCount) {
    // If game already ended, don't check
    if (this.gameEnded) return;
    
    console.log(`\n🔍 Checking winner after call #${callCount}: ${calledNumber}`);
    
    // Check each player's memory
    for (const [socketId, player] of this.players) {
      const marked = player.markedNumbers || [];
      if (marked.length === 0) continue;
      
      console.log(`Player ${player.userId} has ${marked.length} marked numbers`);
      
      // Check each cartela this player owns
      for (const luckyNumber of player.cartelaIds) {
        const cartela = await Cartela.findOne({ where: { lucky_number: luckyNumber } });
        if (!cartela) continue;
        
        // Get all numbers in this cartela (excluding FREE)
        const allNumbers = [
          ...cartela.card_data.B,
          ...cartela.card_data.I,
          ...cartela.card_data.N,
          ...cartela.card_data.G,
          ...cartela.card_data.O
        ].filter(n => n !== 'FREE');
        
        // Check if ALL numbers are marked
        const missingNumbers = allNumbers.filter(num => !marked.includes(num));
        
        if (missingNumbers.length === 0) {
          console.log(`🏆🏆🏆 WINNER FOUND! Player ${player.userId} with cartela ${luckyNumber}`);
          console.log(`🏆 All ${allNumbers.length} numbers marked!`);
          this.gameEnded = true;
          await this.processWin(player.userId);
          return;
        }
      }
    }
    
    console.log(`❌ No winner yet after call ${callCount}`);
  }

  async handlePressBingo(socket, { userId, gameId }) {
    console.log(`\n🔴 MANUAL BINGO PRESS by user ${userId}`);
    
    try {
      if (!this.currentGame || this.currentGame.status !== 'active') {
        socket.emit('error', { message: 'No active game' });
        return;
      }
      
      // Find player in memory
      let player = null;
      for (const [sId, p] of this.players) {
        if (p.userId === userId) {
          player = p;
          break;
        }
      }
      
      if (!player) {
        socket.emit('error', { message: 'You are not in this game' });
        return;
      }
      
      const markedNumbers = player.markedNumbers || [];
      console.log(`Player ${userId} marked numbers:`, markedNumbers);
      
      let hasWon = false;
      let winningCartela = null;
      
      for (const luckyNumber of player.cartela_ids) {
        const cartela = await Cartela.findOne({ where: { lucky_number: luckyNumber } });
        if (cartela) {
          const allNumbers = [
            ...cartela.card_data.B,
            ...cartela.card_data.I,
            ...cartela.card_data.N,
            ...cartela.card_data.G,
            ...cartela.card_data.O
          ].filter(n => n !== 'FREE');
          
          const missingNumbers = allNumbers.filter(num => !markedNumbers.includes(num));
          
          if (missingNumbers.length === 0) {
            hasWon = true;
            winningCartela = luckyNumber;
            break;
          }
        }
      }
      
      if (hasWon) {
        console.log(`✅ VALID BINGO! User ${userId} with cartela ${winningCartela}`);
        this.gameEnded = true;
        await this.processWin(userId);
      } else {
        console.log(`❌ INVALID BINGO! No winning pattern found`);
        socket.emit('invalid-bingo', { message: 'No valid BINGO pattern found! Keep playing!' });
      }
    } catch (error) {
      console.error('Bingo error:', error);
      socket.emit('error', { message: 'Failed to verify BINGO' });
    }
  }

  async startNewGame() {
    console.log('Starting new game...');
    
    // Reset game ended flag
    this.gameEnded = false;
    
    // Clear ALL player memory
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
    
    console.log(`Game #${gameNumber} created`);
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
        console.log(`Not enough players (${playerCount}/2). Resetting...`);
        waitingTime = 35;
        this.io.emit('game-waiting', {
          prepareTime: waitingTime,
          message: `Not enough players (${playerCount}/2). Waiting...`
        });
      }
    }, 1000);
    
    this.waitingIntervals = { countdownInterval, playerCheckInterval };
  }

  async startGame() {
    this.currentGame = await Game.findByPk(this.currentGame.id);
    
    const currentPrizePool = parseFloat(this.currentGame.prize_pool) || 0;
    console.log(`Starting game with prize pool: ${currentPrizePool}`);
    
    const playerCount = this.getUniquePlayerCount();
    if (playerCount < 2) {
      this.startWaitingPeriod();
      return;
    }
    
    // Reset game ended flag
    this.gameEnded = false;
    
    // Deduct fees from all players
    for (const [socketId, player] of this.players) {
      if (player.cartelaIds.length > 0) {
        const user = await User.findByPk(player.userId);
        if (user && user.wallet_balance >= player.cartelaIds.length * 10) {
          const totalAmount = player.cartelaIds.length * 10;
          const oldBalance = parseFloat(user.wallet_balance) || 0;
          const newBalance = oldBalance - totalAmount;
          
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
      // Stop if game ended
      if (this.gameEnded || this.currentGame.status !== 'active') {
        if (this.gameEnded) console.log('Game already ended, stopping number calls');
        clearInterval(this.gameInterval);
        return;
      }
      
      const availableNumbers = allNumbers.filter(n => !calledNumbers.includes(n));
      
      if (availableNumbers.length === 0 || callCount >= 75) {
        console.log('All numbers called, no winner!');
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
      
      // Check for winner after each call
      await this.checkForWinners(calledNumber, callCount);
      
    }, 4000);
  }

  async processWin(winnerId) {
    console.log(`\n🏆🏆🏆 PROCESSING WINNER: ${winnerId} 🏆🏆🏆`);
    
    // Stop the game interval
    if (this.gameInterval) {
      clearInterval(this.gameInterval);
      this.gameInterval = null;
    }
    
    const prizePoolNum = parseFloat(this.currentGame.prize_pool) || 0;
    const totalPrize = (prizePoolNum * 81) / 100;
    const roundedPrize = Math.round(totalPrize * 100) / 100;
    
    console.log(`💰 Prize pool: ${prizePoolNum}, Winner gets: ${roundedPrize}`);
    
    // Credit winner
    const user = await User.findByPk(winnerId);
    const winnerName = user?.username || user?.phone_number || `Player ${winnerId}`;
    
    if (user) {
      const oldBalance = parseFloat(user.wallet_balance) || 0;
      const newBalance = oldBalance + roundedPrize;
      
      user.wallet_balance = newBalance;
      user.total_won = (user.total_won || 0) + 1;
      await user.save();
      
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
      winners: [{ userId: winnerId, username: winnerName, amount: roundedPrize }],
      prizeAmount: roundedPrize,
      message: `🎉 BINGO! ${winnerName} wins ${roundedPrize.toFixed(2)} Birr! 🎉`
    });
    
    // Clear all players for next game
    this.players.clear();
    
    // Start next game
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