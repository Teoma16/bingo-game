const express = require('express');
const http = require('http');
const cors = require('cors');
require('dotenv').config();

const sequelize = require('./config/database');
const GameSocket = require('./websocket/GameSocket');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const adminRoutes = require('./routes/adminRoutes');
const gameRoutes = require('./routes/gameRoutes');
const cartelaRoutes = require('./routes/cartelaRoutes');
const adminAuthRoutes = require('./routes/adminAuthRoutes');

// Import Telegram bot
const { bot } = require('../telegram-bot/bot');

const app = express();
const server = http.createServer(app);

// CORS configuration
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/game', gameRoutes);
app.use('/api/cartela', cartelaRoutes);
app.use('/api/admin/auth', adminAuthRoutes.router || adminAuthRoutes);

// Test endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Telegram webhook endpoint
app.post(`/telegram/webhook`, (req, res) => {
  bot.handleUpdate(req.body, res);
});

// Initialize WebSocket
const gameSocket = new GameSocket(server);

const PORT = process.env.PORT || 5000;

// Start everything
sequelize.authenticate()
  .then(() => {
    console.log('✅ Database connected');
    return sequelize.sync({ alter: false });
  })
  .then(() => {
    // Start the server
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📡 WebSocket server ready`);
      console.log(`🤖 Telegram bot initialized`);
    });
    
    // Launch Telegram bot
    bot.launch()
      .then(() => console.log('✅ Telegram bot launched successfully'))
      .catch(err => console.error('❌ Telegram bot error:', err));
  })
  .catch(err => {
    console.error('Database error:', err);
  });

// Enable graceful stop
process.once('SIGINT', () => {
  bot.stop('SIGINT');
  process.exit(0);
});
process.once('SIGTERM', () => {
  bot.stop('SIGTERM');
  process.exit(0);
});