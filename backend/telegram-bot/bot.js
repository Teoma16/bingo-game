const { Telegraf, Markup } = require('telegraf');
const { User, Transaction, GamePlayer, Game } = require('../src/models');

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Game URL - keep this in code, players never see it
const GAME_URL = 'https://earnest-amazement-production.up.railway.app';

// Start command - Registration
bot.start(async (ctx) => {
  const telegramId = ctx.from.id;
  const username = ctx.from.username || ctx.from.first_name;
  
  const existingUser = await User.findOne({ where: { telegram_id: telegramId } });
  
  if (existingUser) {
    return ctx.reply(
      `🎰 *WELCOME BACK!* 🎰\n\n` +
      `Player: ${username}\n` +
      `💰 Balance: ${existingUser.wallet_balance} Birr\n` +
      `🏆 Games Won: ${existingUser.total_won}\n\n` +
      `👇 *Tap PLAY to start playing!* 👇`,
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

// Handle contact sharing
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
    ctx.reply('Registration failed. Please try again.');
  }
});

// Balance callback
bot.action('balance', async (ctx) => {
  const user = await User.findOne({ where: { telegram_id: ctx.from.id } });
  if (user) {
    await ctx.reply(
      `💰 *YOUR WALLET* 💰\n\n` +
      `Available: *${user.wallet_balance} Birr*\n` +
      `Games Played: ${user.total_played}\n` +
      `Games Won: ${user.total_won}\n` +
      `Bonus Received: ${user.total_bonus} Birr`,
      { parse_mode: 'Markdown' }
    );
  }
  await ctx.answerCbQuery();
});

// History callback
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
    await ctx.reply('📜 No game history yet. Play some games!');
  } else {
    let message = `📜 *GAME HISTORY* 📜\n\n`;
    games.forEach((game, index) => {
      const status = game.is_winner ? `✅ WON ${game.prize_amount} Birr` : '❌ Lost';
      message += `${index + 1}. Game #${game.Game?.game_number || 'N/A'} - ${status}\n`;
    });
    await ctx.reply(message, { parse_mode: 'Markdown' });
  }
  await ctx.answerCbQuery();
});

// Withdraw callback
bot.action('withdraw', async (ctx) => {
  const user = await User.findOne({ where: { telegram_id: ctx.from.id } });
  await ctx.reply(
    `💸 *WITHDRAWAL* 💸\n\n` +
    `Your balance: *${user?.wallet_balance || 0} Birr*\n` +
    `Minimum: *100 Birr*\n\n` +
    `Send: /withdraw [amount] [phone]\n\n` +
    `Example: /withdraw 200 251911111111`,
    { parse_mode: 'Markdown' }
  );
  await ctx.answerCbQuery();
});

// Withdraw command
bot.command('withdraw', async (ctx) => {
  const user = await User.findOne({ where: { telegram_id: ctx.from.id } });
  if (!user) return ctx.reply('Please register first with /start');
  
  const args = ctx.message.text.split(' ');
  if (args.length < 3) {
    return ctx.reply(
      `Usage: /withdraw [amount] [phone_number]\n\n` +
      `Example: /withdraw 200 251911111111`
    );
  }
  
  const amount = parseFloat(args[1]);
  const phoneNumber = args[2];
  
  if (isNaN(amount) || amount < 100) return ctx.reply('Minimum withdrawal is 100 Birr');
  if (amount > user.wallet_balance) return ctx.reply(`Insufficient balance. Your balance: ${user.wallet_balance} Birr`);
  
  const { WithdrawRequest } = require('../src/models');
  await WithdrawRequest.create({
    user_id: user.id,
    amount: amount,
    phone_number: phoneNumber,
    status: 'pending'
  });
  
  await ctx.reply(`✅ Withdrawal request of ${amount} Birr submitted!\n\nAdmin will process within 24 hours.`);
});

// Help command
bot.command('help', async (ctx) => {
  await ctx.reply(
    `🎮 *BINGO GAME HELP* 🎮\n\n` +
    `/start - Open game menu\n` +
    `/balance - Check your balance\n` +
    `/history - View game history\n` +
    `/withdraw [amount] [phone] - Request withdrawal\n` +
    `/help - Show this menu\n\n` +
    `👇 *Tap PLAY to start playing!* 👇`,
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.webApp('🎮 PLAY BINGO', GAME_URL)]
      ])
    }
  );
});

// Send winner notification
async function sendWinnerNotification(telegramId, amount, gameNumber) {
  try {
    await bot.telegram.sendMessage(
      telegramId,
      `🎉🎉🎉 *BINGO! YOU WON!* 🎉🎉🎉\n\n` +
      `🏆 You won *${amount} Birr* in Game #${gameNumber}!\n` +
      `💰 Amount credited to your wallet.\n\n` +
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

module.exports = { bot, sendWinnerNotification };