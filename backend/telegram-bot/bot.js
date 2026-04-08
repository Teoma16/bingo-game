const { Telegraf, Markup } = require('telegraf');
const { User, Transaction, GamePlayer, Game } = require('../src/models');
const sequelize = require('../src/config/database');

// Initialize bot
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Start command - Registration
bot.start(async (ctx) => {
  const telegramId = ctx.from.id;
  const username = ctx.from.username || ctx.from.first_name;
  
  // Check if user already exists
  const existingUser = await User.findOne({ where: { telegram_id: telegramId } });
  
  if (existingUser) {
    return ctx.reply(
      `Welcome back ${username}! 🎉\n\nYour wallet balance: ${existingUser.wallet_balance} Birr\n\nUse the buttons below:`,
      Markup.inlineKeyboard([
        [Markup.button.callback('💰 Balance', 'balance')],
        [Markup.button.callback('🎮 Play Bingo', 'play')],
        [Markup.button.callback('📜 History', 'history')],
        [Markup.button.callback('💸 Withdraw', 'withdraw')]
      ])
    );
  }
  
  // Request phone number for registration
  await ctx.reply(
    `Welcome to Bingo Game! 🎰\n\nPlease share your phone number to register:`,
    Markup.keyboard([
      [Markup.button.contactRequest('📱 Share Phone Number')]
    ]).resize().oneTime()
  );
});

// Handle contact sharing (registration)
bot.on('contact', async (ctx) => {
  const telegramId = ctx.from.id;
  const username = ctx.from.username || ctx.from.first_name;
  const phoneNumber = ctx.message.contact.phone_number;
  
  try {
    // Check if phone number already registered
    const existingUser = await User.findOne({ where: { phone_number: phoneNumber } });
    
    if (existingUser) {
      return ctx.reply('This phone number is already registered! Please login to the web app.');
    }
    
    // Create new user with 10 Birr welcome bonus (non-withdrawable)
    const newUser = await User.create({
      telegram_id: telegramId,
      username: username,
      phone_number: phoneNumber,
      wallet_balance: 10.00, // Welcome bonus for playing
      total_played: 0,
      total_won: 0,
      total_bonus: 10.00,
      is_active: true
    });
    
    // Record welcome bonus transaction
    await Transaction.create({
      user_id: newUser.id,
      type: 'bonus',
      amount: 10.00,
      balance_after: 10.00,
      status: 'completed',
      description: 'Welcome bonus'
    });
    
    await ctx.reply(
      `✅ Registration successful!\n\nWelcome to Bingo Game, ${username}!\n\n🎁 Welcome Bonus: 10 Birr (for playing only)\n\nUse the buttons below to get started:`,
      Markup.inlineKeyboard([
        [Markup.button.callback('💰 Balance', 'balance')],
        [Markup.button.callback('🎮 Play Bingo', 'play')],
        [Markup.button.callback('📜 History', 'history')],
        [Markup.button.callback('💸 Withdraw', 'withdraw')]
      ])
    );
    
    // Remove keyboard
    await ctx.reply('You can now close this keyboard:', Markup.removeKeyboard());
    
  } catch (error) {
    console.error('Registration error:', error);
    ctx.reply('Registration failed. Please try again later.');
  }
});

// Balance callback
bot.action('balance', async (ctx) => {
  const user = await User.findOne({ where: { telegram_id: ctx.from.id } });
  if (user) {
    await ctx.reply(
      `💰 Your Wallet Balance\n\n` +
      `Available Balance: ${user.wallet_balance} Birr\n` +
      `Total Games Played: ${user.total_played}\n` +
      `Total Games Won: ${user.total_won}\n` +
      `Total Bonus Received: ${user.total_bonus} Birr`
    );
  } else {
    ctx.reply('Please register first using /start');
  }
  await ctx.answerCbQuery();
});

// Play callback
bot.action('play', async (ctx) => {
  const user = await User.findOne({ where: { telegram_id: ctx.from.id } });
  if (!user) {
    return ctx.reply('Please register first using /start');
  }
  
  await ctx.reply(
    `🎮 Open Bingo Game\n\nClick the link below to start playing:\n\n` +
    `http://localhost:3000/login\n\n` +
    `Use phone number: ${user.phone_number}`
  );
  await ctx.answerCbQuery();
});

// Game history callback
bot.action('history', async (ctx) => {
  const user = await User.findOne({ where: { telegram_id: ctx.from.id } });
  if (!user) {
    return ctx.reply('Please register first using /start');
  }
  
  const games = await GamePlayer.findAll({
    where: { user_id: user.id },
    include: [{ model: Game }],
    order: [['joined_at', 'DESC']],
    limit: 10
  });
  
  if (games.length === 0) {
    await ctx.reply('No game history found. Play some games first!');
  } else {
    let message = '📜 Your Last 10 Games:\n\n';
    games.forEach((game, index) => {
      const status = game.is_winner ? `✅ WON ${game.prize_amount} Birr` : '❌ Lost';
      const date = new Date(game.joined_at).toLocaleDateString();
      message += `${index + 1}. Game #${game.Game?.game_number || 'N/A'} - ${status} (${date})\n`;
    });
    await ctx.reply(message);
  }
  await ctx.answerCbQuery();
});

// Withdraw callback
bot.action('withdraw', async (ctx) => {
  const user = await User.findOne({ where: { telegram_id: ctx.from.id } });
  if (!user) {
    return ctx.reply('Please register first using /start');
  }
  
  await ctx.reply(
    `💸 Withdrawal Request\n\n` +
    `Minimum withdrawal: 100 Birr\n` +
    `Your balance: ${user.wallet_balance} Birr\n\n` +
    `To request withdrawal:\n` +
    `1. Send /withdraw [amount] [phone_number]\n` +
    `Example: /withdraw 200 251911111111\n\n` +
    `⚠️ Withdrawals are processed within 24 hours.`
  );
  await ctx.answerCbQuery();
});

// Handle withdrawal command
bot.command('withdraw', async (ctx) => {
  const user = await User.findOne({ where: { telegram_id: ctx.from.id } });
  if (!user) {
    return ctx.reply('Please register first using /start');
  }
  
  const args = ctx.message.text.split(' ');
  if (args.length < 3) {
    return ctx.reply('Usage: /withdraw [amount] [phone_number]\nExample: /withdraw 200 251911111111');
  }
  
  const amount = parseFloat(args[1]);
  const phoneNumber = args[2];
  
  if (isNaN(amount) || amount < 100) {
    return ctx.reply('Minimum withdrawal amount is 100 Birr');
  }
  
  if (amount > user.wallet_balance) {
    return ctx.reply(`Insufficient balance. Your balance: ${user.wallet_balance} Birr`);
  }
  
  // Create withdrawal request
  const { WithdrawRequest } = require('../src/models');
  await WithdrawRequest.create({
    user_id: user.id,
    amount: amount,
    phone_number: phoneNumber,
    status: 'pending'
  });
  
  await ctx.reply(
    `✅ Withdrawal request submitted!\n\n` +
    `Amount: ${amount} Birr\n` +
    `Phone: ${phoneNumber}\n\n` +
    `Request ID: ${Date.now()}\n` +
    `Status: Pending approval\n\n` +
    `We will process your request within 24 hours.`
  );
});

// Send winner notification
async function sendWinnerNotification(telegramId, amount, gameNumber, cartelaNumber) {
  try {
    await bot.telegram.sendMessage(
      telegramId,
      `🎉🎉🎉 CONGRATULATIONS! 🎉🎉🎉\n\n` +
      `🏆 You won ${amount} Birr in Game #${gameNumber}!\n` +
      `🎯 Winning Cartela: ${cartelaNumber}\n\n` +
      `💰 Amount credited to your wallet.\n\n` +
      `Keep playing and winning! 🍀`
    );
  } catch (error) {
    console.error('Failed to send winner notification:', error);
  }
}

// Send game start notification
async function sendGameStartNotification(telegramId, gameNumber) {
  try {
    await bot.telegram.sendMessage(
      telegramId,
      `🎮 Game #${gameNumber} has started!\n\n` +
      `Open the game to play: http://localhost:3000\n\n` +
      `Good luck! 🍀`
    );
  } catch (error) {
    console.error('Failed to send game start notification:', error);
  }
}

// Start bot
bot.launch()
  .then(() => console.log('✅ Telegram bot started successfully!'))
  .catch(err => console.error('Telegram bot error:', err));

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

module.exports = { bot, sendWinnerNotification, sendGameStartNotification };