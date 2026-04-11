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
      
      socket.on('get-game-state', async () => {
        await this.sendGameState(socket);
      });
	  // Add this test endpoint
socket.on('test-mark', async (data) => {
  console.log('🧪 TEST MARK:', data);
  const { userId, number } = data;
  
  const gamePlayer = await GamePlayer.findOne({
    where: { game_id: this.currentGame.id, user_id: userId }
  });
  
  if (gamePlayer) {
    let marked = gamePlayer.marked_numbers || [];
    if (!marked.includes(number)) {
      marked.push(number);
      gamePlayer.marked_numbers = marked;
      await gamePlayer.save();
      console.log(`✅ TEST: Marked ${number} for user ${userId}`);
      socket.emit('test-result', { success: true, number });
    }
  } else {
    console.log(`❌ TEST: No game player for user ${userId}`);
  }
});
          socket.on('force-check-winner', async (data) => {
  console.log('🔴 FORCE WINNER CHECK requested by user:', data.userId);
  await this.checkForWinnersManual(data.userId);
      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });
    });

});
    this.startNewGame();
  }

  async sendGameState(socket) {
    if (this.currentGame) {
      const winnerAmount = (this.currentGame.prize_pool * 0.81);
      const takenNumbers = this.getAllTakenNumbers();
      
      socket.emit('game-state', {
        status: this.currentGame.status,
        prizePool: this.currentGame.prize_pool,
        winnerAmount: winnerAmount,
        calledNumbers: this.currentGame.called_numbers || [],
        takenNumbers: takenNumbers
      });
    }
  }

  getAllTakenNumbers() {
    const takenNumbers = [];
    this.players.forEach(player => {
      takenNumbers.push(...player.cartelaIds);
    });
    return takenNumbers;
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
      
	  
	  this.players.set(socket.id, {
  userId: user.id,
  cartelaIds: [],
  markedNumbers: [],  // Add this line
  socketId: socket.id
});
      // Send current game state with taken numbers
      const winnerAmount = (this.currentGame?.prize_pool || 0) * 0.81;
      const takenNumbers = this.getAllTakenNumbers();
      
      socket.emit('registered', {
        user: {
          id: user.id,
          username: user.username,
          wallet_balance: user.wallet_balance,
          total_played: user.total_played,
          total_won: user.total_won
        },
        takenNumbers: takenNumbers,
        prizePool: this.currentGame?.prize_pool || 0,
        winnerAmount: winnerAmount
      });
      
    } catch (error) {
      console.error('Register error:', error);
      socket.emit('error', { message: 'Registration failed' });
    }
  }
async checkForWinnersManual(userId) {
  console.log(`\n🔍 MANUAL WINNER CHECK for user ${userId}`);
  
  const gamePlayer = await GamePlayer.findOne({
    where: { game_id: this.currentGame.id, user_id: userId }
  });
  
  if (!gamePlayer) {
    console.log('❌ GamePlayer not found');
    return;
  }
  
  const markedNumbers = gamePlayer.marked_numbers || [];
  console.log(`📝 Marked numbers (${markedNumbers.length}):`, markedNumbers);
  
  for (const luckyNumber of gamePlayer.cartela_ids) {
    const cartela = await Cartela.findOne({ where: { lucky_number: luckyNumber } });
    if (cartela) {
      const hasWon = this.gameService.checkWinPattern(cartela.card_data, markedNumbers);
      console.log(`Cartela ${luckyNumber}: ${hasWon ? '✅ WINNER!' : '❌ Not winner'}`);
      
      // Also log missing numbers for debugging
      const allNumbers = [
        ...cartela.card_data.B,
        ...cartela.card_data.I,
        ...cartela.card_data.N,
        ...cartela.card_data.G,
        ...cartela.card_data.O
      ].filter(n => n !== 'FREE');
      const missing = allNumbers.filter(n => !markedNumbers.includes(n));
      console.log(`   Missing numbers (${missing.length}):`, missing);
      
      if (hasWon) {
        console.log('🏆 FORCE DECLARING WINNER!');
        await this.processWin(userId);
        return;
      }
    }
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
    
    // Check if already has 2 cartelas
    if (player.cartelaIds.length >= 2) {
      socket.emit('error', { message: 'Maximum 2 cartelas allowed per game! You already have 2 cartelas.' });
      return;
    }
    
    // Check if lucky number is already taken
    if (player.cartelaIds.includes(luckyNumber)) {
      socket.emit('error', { message: 'You already selected this number!' });
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
    
    // Convert balance to number
    const userBalance = parseFloat(user.wallet_balance) || 0;
    
    if (userBalance < totalCost) {
      socket.emit('error', { 
        message: `Insufficient balance! Need ${totalCost} Birr for ${newTotalCartelas} cartela(s). Your balance: ${userBalance} Birr` 
      });
      return;
    }
    
    const cartela = await Cartela.findOne({ where: { lucky_number: luckyNumber } });
    if (!cartela) {
      socket.emit('error', { message: 'Invalid lucky number' });
      return;
    }
    
    player.cartelaIds.push(luckyNumber);
    
    // Ensure prize_pool is treated as number
    const currentPrizePool = parseFloat(this.currentGame.prize_pool) || 0;
    this.currentGame.prize_pool = currentPrizePool + 10;
    this.currentGame.total_cartelas = (this.currentGame.total_cartelas || 0) + 1;
    this.currentGame.total_players = this.getUniquePlayerCount();
    await this.currentGame.save();
    
    console.log(`[DEBUG] Prize pool: ${currentPrizePool} + 10 = ${this.currentGame.prize_pool}`);
    
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
    
    // Calculate winner amount as number
    const winnerAmount = (parseFloat(this.currentGame.prize_pool) * 0.81);
    
    // Broadcast update to ALL players
    this.io.emit('game-update', {
      totalPlayers: this.getUniquePlayerCount(),
      totalCartelas: this.currentGame.total_cartelas,
      prizePool: parseFloat(this.currentGame.prize_pool),
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
      cartelaCount: player.cartelaIds.length,
      message: `Cartela ${luckyNumber} selected! (${player.cartelaIds.length}/2 cartelas)`
    });
console.log(`[PRIZE DEBUG] Prize pool before: ${this.currentGame.prize_pool - 10}, after: ${this.currentGame.prize_pool}`);
console.log(`[PRIZE DEBUG] Winner amount (81%): ${this.currentGame.prize_pool * 0.81}`);
 

 
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
          
          // Ensure prize_pool is treated as number
          const currentPrizePool = parseFloat(this.currentGame.prize_pool) || 0;
          this.currentGame.prize_pool = currentPrizePool - 10;
          this.currentGame.total_cartelas = Math.max(0, (this.currentGame.total_cartelas || 0) - 1);
          this.currentGame.total_players = this.getUniquePlayerCount();
          await this.currentGame.save();
          
          const winnerAmount = (parseFloat(this.currentGame.prize_pool) * 0.81);
          
          this.io.emit('game-update', {
            totalPlayers: this.getUniquePlayerCount(),
            totalCartelas: this.currentGame.total_cartelas,
            prizePool: parseFloat(this.currentGame.prize_pool),
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

  async handleAutoMark(socket, { userId, number }) {
  // Store in memory
  for (const [sId, player] of this.players) {
    if (player.userId === userId) {
      if (!player.markedNumbers) player.markedNumbers = [];
      if (!player.markedNumbers.includes(number)) {
        player.markedNumbers.push(number);
        console.log(`✅ Memory: User ${userId} marked ${number} (${player.markedNumbers.length} total)`);
      }
      break;
    }
  }
}

  async handlePressBingo(socket, { userId, gameId }) {
    console.log(`\n========== MANUAL BINGO PRESS ==========`);
    console.log(`User ${userId} pressed BINGO button`);
    
    try {
      if (!this.currentGame || this.currentGame.status !== 'active') {
        socket.emit('error', { message: 'No active game' });
        return;
      }
      
      const gamePlayer = await GamePlayer.findOne({
        where: { game_id: this.currentGame.id, user_id: userId }
      });
      
      if (!gamePlayer) {
        socket.emit('error', { message: 'You are not in this game' });
        return;
      }
      
      const markedNumbers = gamePlayer.marked_numbers || [];
      let hasWon = false;
      let winningCartela = null;
      
      for (const luckyNumber of gamePlayer.cartela_ids) {
        const cartela = await Cartela.findOne({ 
          where: { lucky_number: luckyNumber }
        });
        
        if (cartela) {
          const won = this.gameService.checkWinPattern(cartela.card_data, markedNumbers);
          if (won) {
            hasWon = true;
            winningCartela = luckyNumber;
            break;
          }
        }
      }
      
      if (hasWon) {
        console.log(`✅ WINNER VALIDATED! User ${userId} with cartela ${winningCartela}`);
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
  });
  
  const gameNumber = await this.getNextGameNumber();
  this.currentGame = await Game.create({
    game_number: gameNumber,
    status: 'waiting',
    total_players: 0,
    total_cartelas: 0,
    prize_pool: 0.00,  // Use number, not string
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
  for (const [sId, player] of this.players) {
    const marked = player.markedNumbers || [];
    if (marked.length === 0) continue;
    
    for (const luckyNum of player.cartelaIds) {
      const cartela = await Cartela.findOne({ where: { lucky_number: luckyNum } });
      if (!cartela) continue;
      
      const allNumbers = [
        ...cartela.card_data.B, ...cartela.card_data.I,
        ...cartela.card_data.N, ...cartela.card_data.G,
        ...cartela.card_data.O
      ].filter(n => n !== 'FREE');
      
      const hasWon = allNumbers.every(n => marked.includes(n));
      
      if (hasWon) {
        console.log(`🏆 WINNER! User ${player.userId}`);
        await this.processWin(player.userId);
        return;
      }
    }
  }
}

// Simple line win checker
checkLineWinSimple(cartelaData, markedNumbers) {
  const grid = [];
  for (let row = 0; row < 5; row++) {
    grid.push([
      cartelaData.B[row],
      cartelaData.I[row],
      cartelaData.N[row],
      cartelaData.G[row],
      cartelaData.O[row]
    ]);
  }
  
  const markedSet = new Set(markedNumbers);
  markedSet.add('FREE');
  
  // Check rows
  for (let row = 0; row < 5; row++) {
    let rowComplete = true;
    for (let col = 0; col < 5; col++) {
      if (!markedSet.has(grid[row][col])) {
        rowComplete = false;
        break;
      }
    }
    if (rowComplete) {
      console.log(`   ✅ Row ${row + 1} complete!`);
      return true;
    }
  }
  
  // Check columns
  for (let col = 0; col < 5; col++) {
    let colComplete = true;
    for (let row = 0; row < 5; row++) {
      if (!markedSet.has(grid[row][col])) {
        colComplete = false;
        break;
      }
    }
    if (colComplete) {
      console.log(`   ✅ Column ${String.fromCharCode(66 + col)} complete!`);
      return true;
    }
  }
  
  // Check diagonals
  let diag1Complete = true;
  for (let i = 0; i < 5; i++) {
    if (!markedSet.has(grid[i][i])) {
      diag1Complete = false;
      break;
    }
  }
  if (diag1Complete) {
    console.log(`   ✅ Diagonal TL-BR complete!`);
    return true;
  }
  
  let diag2Complete = true;
  for (let i = 0; i < 5; i++) {
    if (!markedSet.has(grid[i][4 - i])) {
      diag2Complete = false;
      break;
    }
  }
  if (diag2Complete) {
    console.log(`   ✅ Diagonal TR-BL complete!`);
    return true;
  }
  
  return false;
}
 
 
 

// Complete winner checker with ALL patterns including Four Corners
checkAllWinPatterns(cartelaData, markedNumbers) {
  const grid = [];
  for (let row = 0; row < 5; row++) {
    grid.push([
      cartelaData.B[row],
      cartelaData.I[row],
      cartelaData.N[row],
      cartelaData.G[row],
      cartelaData.O[row]
    ]);
  }
  
  const markedSet = new Set(markedNumbers);
  markedSet.add('FREE');
  
  // 1. Check Horizontal Lines
  for (let row = 0; row < 5; row++) {
    let allMarked = true;
    for (let col = 0; col < 5; col++) {
      if (!markedSet.has(grid[row][col])) {
        allMarked = false;
        break;
      }
    }
    if (allMarked) {
      console.log(`   ✅ Horizontal BINGO on row ${row + 1}`);
      return true;
    }
  }
  
  // 2. Check Vertical Lines
  for (let col = 0; col < 5; col++) {
    let allMarked = true;
    for (let row = 0; row < 5; row++) {
      if (!markedSet.has(grid[row][col])) {
        allMarked = false;
        break;
      }
    }
    if (allMarked) {
      const colLetter = ['B', 'I', 'N', 'G', 'O'][col];
      console.log(`   ✅ Vertical BINGO on column ${colLetter}`);
      return true;
    }
  }
  
  // 3. Check Diagonal (Top-Left to Bottom-Right)
  let diag1 = true;
  for (let i = 0; i < 5; i++) {
    if (!markedSet.has(grid[i][i])) {
      diag1 = false;
      break;
    }
  }
  if (diag1) {
    console.log(`   ✅ Diagonal BINGO (TL-BR)`);
    return true;
  }
  
  // 4. Check Diagonal (Top-Right to Bottom-Left)
  let diag2 = true;
  for (let i = 0; i < 5; i++) {
    if (!markedSet.has(grid[i][4 - i])) {
      diag2 = false;
      break;
    }
  }
  if (diag2) {
    console.log(`   ✅ Diagonal BINGO (TR-BL)`);
    return true;
  }
  
  // 5. Check Four Corners
  const corners = [
    grid[0][0],  // Top-Left
    grid[0][4],  // Top-Right
    grid[4][0],  // Bottom-Left
    grid[4][4]   // Bottom-Right
  ];
  
  let allCornersMarked = true;
  for (const corner of corners) {
    if (!markedSet.has(corner)) {
      allCornersMarked = false;
      break;
    }
  }
  if (allCornersMarked) {
    console.log(`   ✅ Four Corners BINGO!`);
    return true;
  }
  
  // 6. Check 2x2 Squares in Corners
  // Top-Left 2x2
  const topLeft2x2 = [grid[0][0], grid[0][1], grid[1][0], grid[1][1]];
  let topLeftMarked = true;
  for (const cell of topLeft2x2) {
    if (!markedSet.has(cell)) {
      topLeftMarked = false;
      break;
    }
  }
  if (topLeftMarked) {
    console.log(`   ✅ 2x2 Square BINGO (Top-Left)`);
    return true;
  }
  
  // Top-Right 2x2
  const topRight2x2 = [grid[0][3], grid[0][4], grid[1][3], grid[1][4]];
  let topRightMarked = true;
  for (const cell of topRight2x2) {
    if (!markedSet.has(cell)) {
      topRightMarked = false;
      break;
    }
  }
  if (topRightMarked) {
    console.log(`   ✅ 2x2 Square BINGO (Top-Right)`);
    return true;
  }
  
  // Bottom-Left 2x2
  const bottomLeft2x2 = [grid[3][0], grid[3][1], grid[4][0], grid[4][1]];
  let bottomLeftMarked = true;
  for (const cell of bottomLeft2x2) {
    if (!markedSet.has(cell)) {
      bottomLeftMarked = false;
      break;
    }
  }
  if (bottomLeftMarked) {
    console.log(`   ✅ 2x2 Square BINGO (Bottom-Left)`);
    return true;
  }
  
  // Bottom-Right 2x2
  const bottomRight2x2 = [grid[3][3], grid[3][4], grid[4][3], grid[4][4]];
  let bottomRightMarked = true;
  for (const cell of bottomRight2x2) {
    if (!markedSet.has(cell)) {
      bottomRightMarked = false;
      break;
    }
  }
  if (bottomRightMarked) {
    console.log(`   ✅ 2x2 Square BINGO (Bottom-Right)`);
    return true;
  }
  
  return false;
}

  async processWin(winnerId) {
    console.log(`\n========== PROCESSING WINNER ==========`);
    console.log(`Winner ID: ${winnerId}`);
    
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
    
    await GamePlayer.update(
      { is_winner: true, prize_amount: roundedPrize },
      { where: { game_id: this.currentGame.id, user_id: winnerId } }
    );
    
    this.currentGame.status = 'completed';
    this.currentGame.winner_ids = [winnerId];
    this.currentGame.winner_amount = roundedPrize;
    this.currentGame.end_time = new Date();
    await this.currentGame.save();
    
    this.io.emit('game-ended', {
      winners: [{ 
        userId: winnerId, 
        username: winnerName,
        amount: roundedPrize 
      }],
      prizeAmount: roundedPrize,
      message: `🎉 BINGO! ${winnerName} wins ${roundedPrize.toFixed(2)} Birr! 🎉`
    });
    
    // Clear all player cartelas for next game
    this.players.forEach(player => {
      player.cartelaIds = [];
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