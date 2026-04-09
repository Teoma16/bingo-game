const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const sequelize = require('./config/database');
const GameSocket = require('./websocket/GameSocket');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const adminRoutes = require('./routes/adminRoutes');
const gameRoutes = require('./routes/gameRoutes');
const cartelaRoutes = require('./routes/cartelaRoutes');

// Import admin auth routes
const adminAuthRoutes = require('./routes/adminAuthRoutes');

const app = express();
const server = http.createServer(app);

// CORS configuration - Allow all origins (for testing with Railway frontend)
app.use((req, res, next) => {
  // Allow any origin
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  // Handle preflight requests
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

// Admin auth routes - make sure this is correct
app.use('/api/admin/auth', adminAuthRoutes.router || adminAuthRoutes);

// Test endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Test admin login endpoint
app.post('/api/test-login', (req, res) => {
  res.json({ message: 'Test endpoint working' });
});

const PORT = process.env.PORT || 5000;

sequelize.authenticate()
  .then(() => {
    console.log('✅ Database connected');
    return sequelize.sync({ alter: false });
  })
  .then(() => {
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('Database error:', err);
  });