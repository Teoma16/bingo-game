const { Server } = require('socket.io');
const GameService = require('../services/GameService');
const { User, Game, GamePlayer, Cartela, Transaction } = require('../models');

class GameSocket {
  constructor(server) {
    this.io = new Server(server, {
  cors: {
    origin: '*',
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
        markedNumbers: [],
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
        socket.emit('game-state', {
          status: this.currentGame.status,
          prizePool: this.currentGame.prize_pool,
          winnerAmount: this.currentGame.prize_pool * 0.81,
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
async handleAutoMark(socket, { userId, number }) {
  console.log(`🤖 AUTO-MARK received: User ${userId}, Number ${number}`);
  
  let found = false;
  for (const [socketId, player] of this.players) {
    if (player.userId === userId) {
      if (!player.markedNumbers) {
        player.markedNumbers = [];
      }
      if (!player.markedNumbers.includes(number)) {
        player.markedNumbers.push(number);
        console.log(`✅ Stored in memory: User ${userId} now has ${player.markedNumbers.length} marked numbers`);
      } else {
        console.log(`⚠️ Number ${number} already marked for user ${userId}`);
      }
      found = true;
      break;
    }
  }
  
  if (!found) {
    console.log(`❌ User ${userId} not found in players map`);
  }
}

  async checkForWinners() {
    for (const [socketId, player] of this.players) {
      const marked = player.markedNumbers || [];
      if (marked.length === 0) continue;
      
      for (const luckyNumber of player.cartelaIds) {
        const cartela = await Cartela.findOne({ where: { lucky_number: luckyNumber } });
        if (!cartela) continue;
        
        // Get all numbers (excluding FREE)
        const allNumbers = [
          cartela.card_data.B[0], cartela.card_data.B[1], cartela.card_data.B[2], cartela.card_data.B[3], cartela.card_data.B[4],
          cartela.card_data.I[0], cartela.card_data.I[1], cartela.card_data.I[2], cartela.card_data.I[3], cartela.card_data.I[4],
          cartela.card_data.N[0], cartela.card_data.N[1], cartela.card_data.N[3], cartela.card_data.N[4],
          cartela.card_data.G[0], cartela.card_data.G[1], cartela.card_data.G[2], cartela.card_data.G[3], cartela.card_data.G[4],
          cartela.card_data.O[0], cartela.card_data.O[1], cartela.card_data.O[2], cartela.card_data.O[3], cartela.card_data.O[4]
        ].filter(n => n !== 'FREE');
        
        const allMarked = allNumbers.every(num => marked.includes(num));
        
        if (allMarked) {
          console.log(`🏆 WINNER! Player ${player.userId} with cartela ${luckyNumber}`);
          await this.processWin(player.userId);
          return true;
        }
      }
    }
    return false;
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
    console.log(`🎯 GAME STARTED! Prize pool: ${this.currentGame.prize_pool}`);
    
    this.currentGame.status = 'active';
    this.currentGame.start_time = new Date();
    this.currentGame.total_players = this.getUniquePlayerCount();
    await this.currentGame.save();
    
    this.io.emit('game-started', {
      gameId: this.currentGame.id,
      gameNumber: this.currentGame.game_number,
      prizePool: this.currentGame.prize_pool,
      winnerAmount: this.currentGame.prize_pool * 0.81,
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
      
    }, 4000);
  }

  async processWin(winnerId) {
    console.log(`🏆🏆🏆 WINNER! User ${winnerId} 🏆🏆🏆`);
    
    if (this.gameInterval) {
      clearInterval(this.gameInterval);
      this.gameInterval = null;
    }
    
    const prizePoolNum = parseFloat(this.currentGame.prize_pool) || 0;
    const totalPrize = (prizePoolNum * 81) / 100;
    const roundedPrize = Math.round(totalPrize * 100) / 100;
    
    const user = await User.findByPk(winnerId);
    const winnerName = user?.username || user?.phone_number || `Player ${winnerId}`;
    
    if (user) {
      user.wallet_balance = parseFloat(user.wallet_balance) + roundedPrize;
      user.total_won += 1;
      await user.save();
    }
    
    this.currentGame.status = 'completed';
    this.currentGame.winner_ids = [winnerId];
    this.currentGame.winner_amount = roundedPrize;
    this.currentGame.end_time = new Date();
    await this.currentGame.save();
    
    this.io.emit('game-ended', {
      winners: [{ userId: winnerId, username: winnerName, amount: roundedPrize }],
      prizeAmount: roundedPrize,
      message: `🎉 BINGO! ${winnerName} wins ${roundedPrize.toFixed(2)} Birr! 🎉`
    });
    
    setTimeout(() => {
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