import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Login from './pages/Login';
import Home from './pages/Home';
import GameRoom from './pages/GameRoom';

function App() {
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);
  const [user, setUser] = React.useState(null);
 useEffect(() => {
    // Initialize Telegram Web App
    if (window.Telegram && window.Telegram.WebApp) {
      const tg = window.Telegram.WebApp;
      tg.ready();
      tg.expand(); // Expand to full screen
      tg.enableClosingConfirmation();
    }
  }, []);

  React.useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    if (token && savedUser) {
      setIsAuthenticated(true);
      setUser(JSON.parse(savedUser));
    }
  }, []);

  return (
    <Router>
      <Toaster position="top-center" />
      <Routes>
        <Route path="/login" element={<Login setAuth={setIsAuthenticated} setUser={setUser} />} />
        <Route path="/" element={isAuthenticated ? <Home user={user} setUser={setUser} /> : <Navigate to="/login" />} />
        <Route path="/game/:gameId" element={isAuthenticated ? <GameRoom user={user} /> : <Navigate to="/login" />} />
      </Routes>
    </Router>
  );
}

export default App;