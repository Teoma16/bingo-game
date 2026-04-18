/*import React, { useState, useEffect } from 'react';
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
*/

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
  const [showLogin, setShowLogin] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const API_URL = 'https://bingo-game-production-dd0b.up.railway.app';

  useEffect(() => {
    const initAuth = async () => {
      // Check for Telegram Web App (mobile)
      const tg = window.Telegram?.WebApp;
      
      if (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) {
        try {
          const telegramUser = tg.initDataUnsafe.user;
          const response = await axios.post(`${API_URL}/api/auth/telegram-login`, {
            telegramId: telegramUser.id,
            username: telegramUser.username || telegramUser.first_name
          });
          
          if (response.data.success) {
            localStorage.setItem('token', response.data.token);
            localStorage.setItem('user', JSON.stringify(response.data.user));
            setUser(response.data.user);
            setIsAuthenticated(true);
            setLoading(false);
            return;
          }
        } catch (error) {
          console.log('Telegram login failed:', error);
        }
      }
      
      // Check for existing token (computer browser)
      const token = localStorage.getItem('token');
      const savedUser = localStorage.getItem('user');
      if (token && savedUser) {
        setIsAuthenticated(true);
        setUser(JSON.parse(savedUser));
        setLoading(false);
        return;
      }
      
      // No auth - show login
      setShowLogin(true);
      setLoading(false);
    };
    
    initAuth();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!phoneNumber || phoneNumber.length < 10) {
      alert('Please enter a valid phone number');
      return;
    }
    
    setLoginLoading(true);
    try {
      const response = await axios.post(`${API_URL}/api/auth/login`, { phoneNumber });
      
      if (response.data.success) {
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
        setUser(response.data.user);
        setIsAuthenticated(true);
        setShowLogin(false);
      }
    } catch (error) {
      if (error.response?.status === 404) {
        alert('User not found. Please register via Telegram first!');
      } else {
        alert('Login failed. Please try again.');
      }
    } finally {
      setLoginLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  if (showLogin) {
    return (

      <div className="login-screen">
        <div className="login-card">
          <h1>🎰 Bingo Game</h1>
          <p>Login with your registered phone number</p>
          
          <form onSubmit={handleLogin}>
            <input
              type="tel"
              placeholder="Phone Number (e.g., 2519xxxxxxxx)"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              disabled={loginLoading}
            />
            <button type="submit" disabled={loginLoading}>
              {loginLoading ? 'Logging in...' : 'Login'}
            </button>
          </form>
          
          <div className="telegram-info">
            <p>📱 Don't have an account?</p>
            <p>Register via Telegram Bot</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <Toaster position="top-center" />
      <div className="app">
        <Routes>
          <Route path="/" element={<Home user={user} setUser={setUser} />} />
          <Route path="/game/:gameId" element={<GameRoom user={user} />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;