const { User, Transaction } = require('../models');
const sequelize = require('../config/database');

class GameService {
  constructor() {
    this.ENTRY_FEE = 10;
    this.WINNER_PERCENTAGE = 81;
    this.COMMISSION_PERCENTAGE = 19;
    this.PREPARE_TIME = 35000;
    this.CALL_INTERVAL = 4000;
  }

  // Convert cartela data to 5x5 grid
  convertCartelaToGrid(cartelaData) {
    const grid = [];
    for (let row = 0; row < 5; row++) {
      const rowData = [];
      rowData.push(cartelaData.B[row]);
      rowData.push(cartelaData.I[row]);
      rowData.push(cartelaData.N[row]);
      rowData.push(cartelaData.G[row]);
      rowData.push(cartelaData.O[row]);
      grid.push(rowData);
    }
    return grid;
  }

  // Check all winning patterns
  // In GameService.js - Add this debug version
checkWinPattern(cartelaData, markedNumbers) {
  console.log('========== CHECKING WIN PATTERN ==========');
  console.log('Cartela Data:', JSON.stringify(cartelaData, null, 2));
  console.log('Marked Numbers:', markedNumbers);
  
  const grid = this.convertCartelaToGrid(cartelaData);
  const markedSet = new Set(markedNumbers);
  
  console.log('Grid:', grid);
  console.log('Marked Set:', Array.from(markedSet));
  
  // Add FREE space to marked set (it's always marked)
  markedSet.add('FREE');
  
  // 1. Check Horizontal Lines
  for (let row = 0; row < 5; row++) {
    let rowNumbers = [];
    let allMarked = true;
    for (let col = 0; col < 5; col++) {
      const cell = grid[row][col];
      rowNumbers.push(cell);
      if (!markedSet.has(cell) && cell !== 'FREE') {
        allMarked = false;
        break;
      }
    }
    console.log(`Row ${row + 1}: ${rowNumbers} - All marked: ${allMarked}`);
    if (allMarked) {
      console.log(`✅ HORIZONTAL BINGO on row ${row + 1}`);
      return true;
    }
  }
  
  // 2. Check Vertical Lines
  const columns = ['B', 'I', 'N', 'G', 'O'];
  for (let col = 0; col < 5; col++) {
    let colNumbers = [];
    let allMarked = true;
    for (let row = 0; row < 5; row++) {
      const cell = grid[row][col];
      colNumbers.push(cell);
      if (!markedSet.has(cell) && cell !== 'FREE') {
        allMarked = false;
        break;
      }
    }
    console.log(`Column ${columns[col]}: ${colNumbers} - All marked: ${allMarked}`);
    if (allMarked) {
      console.log(`✅ VERTICAL BINGO on column ${columns[col]}`);
      return true;
    }
  }
  
  // 3. Check Diagonal (Top-Left to Bottom-Right)
  let diag1Numbers = [];
  let diag1Marked = true;
  for (let i = 0; i < 5; i++) {
    const cell = grid[i][i];
    diag1Numbers.push(cell);
    if (!markedSet.has(cell)) {
      diag1Marked = false;
      break;
    }
  }
  console.log(`Diagonal TL-BR: ${diag1Numbers} - All marked: ${diag1Marked}`);
  if (diag1Marked) {
    console.log('✅ DIAGONAL BINGO (Top-Left to Bottom-Right)');
    return true;
  }
  
  // 4. Check Diagonal (Top-Right to Bottom-Left)
  let diag2Numbers = [];
  let diag2Marked = true;
  for (let i = 0; i < 5; i++) {
    const cell = grid[i][4 - i];
    diag2Numbers.push(cell);
    if (!markedSet.has(cell) && cell !== 'FREE') {
      diag2Marked = false;
      break;
    }
  }
  console.log(`Diagonal TR-BL: ${diag2Numbers} - All marked: ${diag2Marked}`);
  if (diag2Marked) {
    console.log('✅ DIAGONAL BINGO (Top-Right to Bottom-Left)');
    return true;
  }
  
  // 5. Check Four Corners
  const corners = [
    grid[0][0], grid[0][4], grid[4][0], grid[4][4]
  ];
  let cornersMarked = true;
  for (const corner of corners) {
    if (!markedSet.has(corner) && corner !== 'FREE') {
      cornersMarked = false;
      break;
    }
  }
  console.log(`Four Corners: ${corners} - All marked: ${cornersMarked}`);
  if (cornersMarked) {
    console.log('✅ FOUR CORNERS BINGO');
    return true;
  }
  
  console.log('❌ NO WINNING PATTERN FOUND');
  return false;
}

  // Calculate prize split among winners
  calculatePrizeSplit(prizePool, winnerCount) {
      if (!prizePool || prizePool <= 0) return 0;
  if (winnerCount <= 0) return 0;
	const totalPrize = (prizePool * this.WINNER_PERCENTAGE) / 100;
    return totalPrize / winnerCount;
  }

  // Deduct entry fee from player (used when game starts)
  async deductEntryFee(userId, cartelaCount) {
    const transaction = await sequelize.transaction();
    try {
      const user = await User.findByPk(userId, { transaction });
      const totalAmount = this.ENTRY_FEE * cartelaCount;
      
      if (user.wallet_balance < totalAmount) {
        throw new Error('Insufficient balance');
      }
      
      user.wallet_balance -= totalAmount;
      await user.save({ transaction });
      
      await Transaction.create({
        user_id: userId,
        type: 'game_fee',
        amount: -totalAmount,
        balance_after: user.wallet_balance,
        status: 'completed',
        description: `Game entry fee for ${cartelaCount} cartela(s)`
      }, { transaction });
      
      await transaction.commit();
      return true;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  // Credit winnings to player
  async creditWinnings(userId, amount, gameId, bonusAmount = 0) {
    const transaction = await sequelize.transaction();
    try {
      const user = await User.findByPk(userId, { transaction });
      const totalAmount = amount + bonusAmount;
      
      user.wallet_balance += totalAmount;
      user.total_won += 1;
      await user.save({ transaction });
      
      await Transaction.create({
        user_id: userId,
        type: 'prize',
        amount: totalAmount,
        balance_after: user.wallet_balance,
        status: 'completed',
        description: `Won ${totalAmount.toFixed(2)} Birr from game #${gameId}`
      }, { transaction });
      
      if (bonusAmount > 0) {
        user.total_bonus += bonusAmount;
        await user.save({ transaction });
        
        await Transaction.create({
          user_id: userId,
          type: 'bonus',
          amount: bonusAmount,
          balance_after: user.wallet_balance,
          status: 'completed',
          description: `Fast win bonus of ${bonusAmount} Birr`
        }, { transaction });
      }
      
      await transaction.commit();
      return true;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  // Check daily play bonus
  async checkDailyPlayBonus(userId) {
    // Implementation for daily play bonus
    // This will be implemented later
    return 0;
  }

  // Check fast win bonus
  async checkFastWinBonus(callCount, entryFee) {
    const settings = await this.getAdminSettings();
    if (callCount <= settings.fast_win_call_limit) {
      const bonusPercentage = settings.fast_win_bonus_percentage;
      return (entryFee * bonusPercentage) / 100;
    }
    return 0;
  }

  async getAdminSettings() {
    // Get settings from database or return defaults
    return {
      max_cartelas_per_player: 2,
      prepare_time: 35,
      fast_win_call_limit: 5,
      fast_win_bonus_percentage: 1000
    };
  }

  // Get player's marked numbers for a game
  async getPlayerMarkedNumbers(gameId, userId) {
    const { GamePlayer } = require('../models');
    const gamePlayer = await GamePlayer.findOne({
      where: { game_id: gameId, user_id: userId }
    });
    return gamePlayer ? gamePlayer.marked_numbers || [] : [];
  }

  // Update marked numbers for a player
  async updateMarkedNumbers(gameId, userId, number) {
    const { GamePlayer } = require('../models');
    const gamePlayer = await GamePlayer.findOne({
      where: { game_id: gameId, user_id: userId }
    });
    
    if (gamePlayer) {
      const markedNumbers = gamePlayer.marked_numbers || [];
      if (!markedNumbers.includes(number)) {
        markedNumbers.push(number);
        gamePlayer.marked_numbers = markedNumbers;
        await gamePlayer.save();
      }
    }
  }
}

module.exports = GameService;