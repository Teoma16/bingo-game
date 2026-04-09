import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import axios from 'axios';
import Home from './pages/Home';
import GameRoom from './pages/GameRoom';
import './App.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Auto-login using Telegram data
    const autoLogin = async () => {
      try {
        // Get Telegram Web App data
        const tg = window.Telegram?.WebApp;
        
        if (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) {
          const telegramUser = tg.initDataUnsafe.user;
          
          // Auto-login with telegram ID
          const response = await axios.post('https://bingo-game-production-dd0b.up.railway.app/api/auth/telegram-login', {
            telegramId: telegramUser.id,
            username: telegramUser.username || telegramUser.first_name,
            phoneNumber: null // Will be requested if needed
          });
          
          if (response.data.success) {
            localStorage.setItem('token', response.data.token);
            localStorage.setItem('user', JSON.stringify(response.data.user));
            setUser(response.data.user);
            setIsAuthenticated(true);
          }
        } else {
          // Fallback for development - check localStorage
          const token = localStorage.getItem('token');
          const savedUser = localStorage.getItem('user');
          if (token && savedUser) {
            setIsAuthenticated(true);
            setUser(JSON.parse(savedUser));
          }
        }
      } catch (error) {
        console.error('Auto-login error:', error);
      } finally {
        setLoading(false);
      }
    };
    
    autoLogin();
  }, []);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading game...</p>
      </div>
    );
  }

  return (
    <Router>
      <Toaster position="top-center" />
      <div className="app">
        <Routes>
          <Route path="/" element={
            isAuthenticated ? 
              <Home user={user} setUser={setUser} /> : 
              <Navigate to="/login" />
          } />
          <Route path="/game/:gameId" element={
            isAuthenticated ? 
              <GameRoom user={user} /> : 
              <Navigate to="/login" />
          } />
          <Route path="/login" element={<Navigate to="/" />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;