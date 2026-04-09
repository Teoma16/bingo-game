const { Telegraf, Markup } = require('telegraf');
const { User, Transaction, GamePlayer, Game, WithdrawRequest } = require('../src/models');
const { Op } = require('sequelize');

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Game URL
const GAME_URL = 'https://earnest-amazement-production.up.railway.app';

// ============ START COMMAND ============
bot.start(async (ctx) => {
  const telegramId = ctx.from.id;
  const username = ctx.from.username || ctx.from.first_name;
  
  const existingUser = await User.findOne({ where: { telegram_id: telegramId } });
  
  if (existingUser) {
    return ctx.reply(
      `🎰 *WELCOME BACK!* 🎰\n\n` +
      `👤 *Player:* ${username}\n` +
      `💰 *Balance:* ${existingUser.wallet_balance} Birr\n` +
      `🏆 *Games Won:* ${existingUser.total_won}\n` +
      `🎮 *Games Played:* ${existingUser.total_played}\n\n` +
      `👇 *Choose an option below:* 👇`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.webApp('🎮 PLAY BINGO', GAME_URL)],
          [Markup.button.callback('💰 Balance', 'balance'), Markup.button.callback('📜 History', 'history')],
          [Markup.button.callback('💸 Withdraw', 'withdraw')]
        ])
      }
    );
  }
  
  // New user registration
  await ctx.reply(
    `🎰 *WELCOME TO BINGO GAME!* 🎰\n\n` +
    `🎁 *Get 10 Birr Welcome Bonus!*\n\n` +
    `Please share your phone number to register:`,
    {
      parse_mode: 'Markdown',
      ...Markup.keyboard([
        [Markup.button.contactRequest('📱 Share Phone Number')]
      ]).resize().oneTime()
    }
  );
});

// ============ REGISTRATION ============
bot.on('contact', async (ctx) => {
  const telegramId = ctx.from.id;
  const username = ctx.from.username || ctx.from.first_name;
  const phoneNumber = ctx.message.contact.phone_number;
  
  try {
    const existingUser = await User.findOne({ where: { phone_number: phoneNumber } });
    
    if (existingUser) {
      return ctx.reply(
        `✅ *You are already registered!*\n\nTap PLAY to start playing!`,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.webApp('🎮 PLAY BINGO', GAME_URL)]
          ])
        }
      );
    }
    
    const newUser = await User.create({
      telegram_id: telegramId,
      username: username,
      phone_number: phoneNumber,
      wallet_balance: 10.00,
      total_played: 0,
      total_won: 0,
      total_bonus: 10.00,
      is_active: true
    });
    
    await Transaction.create({
      user_id: newUser.id,
      type: 'bonus',
      amount: 10.00,
      balance_after: 10.00,
      status: 'completed',
      description: 'Welcome bonus'
    });
    
    await ctx.reply(
      `✅ *REGISTRATION SUCCESSFUL!* ✅\n\n` +
      `Welcome *${username}*!\n` +
      `🎁 Bonus: *10 Birr*\n` +
      `💰 Balance: *${newUser.wallet_balance} Birr*\n\n` +
      `👇 *Tap PLAY to start playing!* 👇`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.webApp('🎮 PLAY BINGO', GAME_URL)]
        ])
      }
    );
    
    await ctx.reply('You can now close this keyboard:', Markup.removeKeyboard());
    
  } catch (error) {
    console.error('Registration error:', error);
    ctx.reply('❌ Registration failed. Please try again later.');
  }
});

// ============ BALANCE COMMAND ============
bot.command('balance', async (ctx) => {
  const user = await User.findOne({ where: { telegram_id: ctx.from.id } });
  if (!user) {
    return ctx.reply('❌ Please register first using /start');
  }
  
  // Get recent transactions
  const recentTxs = await Transaction.findAll({
    where: { user_id: user.id },
    order: [['created_at', 'DESC']],
    limit: 5
  });
  
  let recentActivity = '';
  if (recentTxs.length > 0) {
    recentActivity = '\n\n*Recent Activity:*\n';
    recentTxs.forEach(tx => {
      const date = new Date(tx.created_at).toLocaleDateString();
      const amount = tx.amount >= 0 ? `+${tx.amount}` : `${tx.amount}`;
      recentActivity += `${date}: ${amount} Birr (${tx.type})\n`;
    });
  }
  
  await ctx.reply(
    `💰 *YOUR WALLET* 💰\n\n` +
    `Available Balance: *${user.wallet_balance} Birr*\n` +
    `🎮 Games Played: ${user.total_played}\n` +
    `🏆 Games Won: ${user.total_won}\n` +
    `🎁 Bonus Received: ${user.total_bonus} Birr${recentActivity}`,
    { parse_mode: 'Markdown' }
  );
});

// ============ HISTORY COMMAND ============
bot.command('history', async (ctx) => {
  const user = await User.findOne({ where: { telegram_id: ctx.from.id } });
  if (!user) {
    return ctx.reply('❌ Please register first using /start');
  }
  
  // Get game history
  const games = await GamePlayer.findAll({
    where: { user_id: user.id },
    include: [{ model: Game }],
    order: [['joined_at', 'DESC']],
    limit: 10
  });
  
  // Get transaction history
  const transactions = await Transaction.findAll({
    where: { user_id: user.id },
    order: [['created_at', 'DESC']],
    limit: 5
  });
  
  let message = `📜 *GAME HISTORY* 📜\n\n`;
  
  if (games.length === 0) {
    message += `No games played yet.\n\n`;
  } else {
    message += `*🎮 Recent Games:*\n`;
    games.forEach((game, index) => {
      const date = new Date(game.joined_at).toLocaleDateString();
      const status = game.is_winner ? `✅ WON ${game.prize_amount} Birr` : '❌ Lost';
      message += `${index + 1}. ${date} - Game #${game.Game?.game_number || 'N/A'} - ${status}\n`;
    });
  }
  
  if (transactions.length > 0) {
    message += `\n*💸 Recent Transactions:*\n`;
    transactions.forEach(tx => {
      const date = new Date(tx.created_at).toLocaleDateString();
      const amount = tx.amount >= 0 ? `+${tx.amount}` : `${tx.amount}`;
      message += `${date}: ${amount} Birr (${tx.type})\n`;
    });
  }
  
  await ctx.reply(message, { parse_mode: 'Markdown' });
});

// ============ WITHDRAW COMMAND ============
bot.command('withdraw', async (ctx) => {
  const user = await User.findOne({ where: { telegram_id: ctx.from.id } });
  if (!user) {
    return ctx.reply('❌ Please register first using /start');
  }
  
  const args = ctx.message.text.split(' ');
  
  if (args.length === 1) {
    // Show withdraw info
    return ctx.reply(
      `💸 *WITHDRAWAL INFORMATION* 💸\n\n` +
      `💰 Your balance: *${user.wallet_balance} Birr*\n` +
      `📉 Minimum withdrawal: *100 Birr*\n\n` +
      `*How to withdraw:*\n` +
      `/withdraw [amount] [phone_number]\n\n` +
      `*Example:*\n` +
      `/withdraw 200 251911111111\n\n` +
      `⚠️ Withdrawals are processed within 24 hours.`,
      { parse_mode: 'Markdown' }
    );
  }
  
  if (args.length < 3) {
    return ctx.reply(
      `❌ *Invalid format*\n\n` +
      `Usage: /withdraw [amount] [phone_number]\n` +
      `Example: /withdraw 200 251911111111`,
      { parse_mode: 'Markdown' }
    );
  }
  
  const amount = parseFloat(args[1]);
  const phoneNumber = args[2];
  
  // Validation
  if (isNaN(amount)) {
    return ctx.reply('❌ Please enter a valid amount');
  }
  
  if (amount < 100) {
    return ctx.reply('❌ Minimum withdrawal amount is 100 Birr');
  }
  
  if (amount > user.wallet_balance) {
    return ctx.reply(`❌ Insufficient balance.\nYour balance: ${user.wallet_balance} Birr`);
  }
  
  if (!phoneNumber.match(/^[0-9]{12}$/)) {
    return ctx.reply('❌ Please enter a valid phone number (12 digits, e.g., 251911111111)');
  }
  
  try {
    // Create withdrawal request
    const withdrawal = await WithdrawRequest.create({
      user_id: user.id,
      amount: amount,
      phone_number: phoneNumber,
      status: 'pending'
    });
    
    await ctx.reply(
      `✅ *WITHDRAWAL REQUEST SUBMITTED!* ✅\n\n` +
      `Amount: *${amount} Birr*\n` +
      `Phone: ${phoneNumber}\n` +
      `Request ID: #${withdrawal.id}\n\n` +
      `⏳ Status: *Pending Approval*\n\n` +
      `Admin will process your request within 24 hours.\n` +
      `The amount will be sent to your Telebirr account.`,
      { parse_mode: 'Markdown' }
    );
    
    // Optional: Notify admin
    // await notifyAdmin(`New withdrawal request: ${amount} Birr from ${user.username}`);
    
  } catch (error) {
    console.error('Withdraw error:', error);
    ctx.reply('❌ Failed to submit withdrawal request. Please try again later.');
  }
});

// ============ BALANCE BUTTON ============
bot.action('balance', async (ctx) => {
  const user = await User.findOne({ where: { telegram_id: ctx.from.id } });
  if (!user) {
    await ctx.reply('❌ Please register first using /start');
    return await ctx.answerCbQuery();
  }
  
  await ctx.reply(
    `💰 *YOUR WALLET* 💰\n\n` +
    `Available: *${user.wallet_balance} Birr*\n` +
    `Games Played: ${user.total_played}\n` +
    `Games Won: ${user.total_won}\n` +
    `Bonus Received: ${user.total_bonus} Birr`,
    { parse_mode: 'Markdown' }
  );
  await ctx.answerCbQuery();
});

// ============ HISTORY BUTTON ============
bot.action('history', async (ctx) => {
  const user = await User.findOne({ where: { telegram_id: ctx.from.id } });
  if (!user) {
    await ctx.reply('❌ Please register first using /start');
    return await ctx.answerCbQuery();
  }
  
  const games = await GamePlayer.findAll({
    where: { user_id: user.id },
    include: [{ model: Game }],
    order: [['joined_at', 'DESC']],
    limit: 10
  });
  
  if (games.length === 0) {
    await ctx.reply('📜 No game history yet. Play some games!');
  } else {
    let message = `📜 *GAME HISTORY* 📜\n\n`;
    games.forEach((game, index) => {
      const date = new Date(game.joined_at).toLocaleDateString();
      const status = game.is_winner ? `✅ WON ${game.prize_amount} Birr` : '❌ Lost';
      message += `${index + 1}. ${date} - Game #${game.Game?.game_number || 'N/A'} - ${status}\n`;
    });
    await ctx.reply(message, { parse_mode: 'Markdown' });
  }
  await ctx.answerCbQuery();
});

// ============ WITHDRAW BUTTON ============
bot.action('withdraw', async (ctx) => {
  const user = await User.findOne({ where: { telegram_id: ctx.from.id } });
  await ctx.reply(
    `💸 *WITHDRAWAL* 💸\n\n` +
    `💰 Your balance: *${user?.wallet_balance || 0} Birr*\n` +
    `📉 Minimum: *100 Birr*\n\n` +
    `*How to withdraw:*\n` +
    `/withdraw [amount] [phone_number]\n\n` +
    `*Example:*\n` +
    `/withdraw 200 251911111111`,
    { parse_mode: 'Markdown' }
  );
  await ctx.answerCbQuery();
});

// ============ WINNER NOTIFICATION ============
async function sendWinnerNotification(telegramId, amount, gameNumber, prizeAmount) {
  try {
    const user = await User.findOne({ where: { telegram_id: telegramId } });
    const username = user?.username || 'Player';
    
    await bot.telegram.sendMessage(
      telegramId,
      `🎉🎉🎉 *BINGO! YOU WON!* 🎉🎉🎉\n\n` +
      `🏆 Congratulations *${username}!*\n` +
      `💰 You won *${prizeAmount} Birr* in Game #${gameNumber}!\n` +
      `💵 Amount credited to your wallet.\n\n` +
      `📊 New Balance: *${user?.wallet_balance || 0} Birr*\n\n` +
      `👇 *Tap PLAY to play again!* 👇`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.webApp('🎮 PLAY AGAIN', GAME_URL)]
        ])
      }
    );
  } catch (error) {
    console.error('Failed to send winner notification:', error);
  }
}

// ============ HELP COMMAND ============
bot.command('help', async (ctx) => {
  await ctx.reply(
    `🎮 *BINGO GAME HELP* 🎮\n\n` +
    `*Commands:*\n` +
    `/start - Open game menu\n` +
    `/balance - Check your balance\n` +
    `/history - View game history\n` +
    `/withdraw [amount] [phone] - Request withdrawal\n` +
    `/help - Show this menu\n\n` +
    `*Quick Actions:*\n` +
    `💰 Check balance anytime\n` +
    `📜 View your game history\n` +
    `💸 Withdraw your winnings\n\n` +
    `👇 *Tap PLAY to start!* 👇`,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.webApp('🎮 PLAY BINGO', GAME_URL)]
      ])
    }
  );
});

// ============ DEFAULT FALLBACK ============
bot.on('text', async (ctx) => {
  const text = ctx.message.text;
  
  if (text === '/start') return;
  if (text === '/balance') return;
  if (text === '/history') return;
  if (text === '/help') return;
  if (text.startsWith('/withdraw')) return;
  
  await ctx.reply(
    `🎰 *BINGO GAME* 🎰\n\n` +
    `Send /start to begin or /help for commands`,
    { parse_mode: 'Markdown' }
  );
});

module.exports = { bot, sendWinnerNotification };