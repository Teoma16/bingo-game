import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import './App.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    const adminData = localStorage.getItem('adminData');
    if (token && adminData) {
      setIsAuthenticated(true);
      setAdmin(JSON.parse(adminData));
    }
    setLoading(false);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminData');
    setIsAuthenticated(false);
    setAdmin(null);
  };

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Loading...</div>;
  }

  // Wrap everything in Router
  return (
    <Router>
      <Toaster position="top-right" />
      {!isAuthenticated ? (
        <Login setAuth={setIsAuthenticated} />
      ) : (
        <div className="admin-app">
          <nav className="admin-nav">
            <div className="nav-brand">🎰 Bingo Admin</div>
            <div className="nav-user">
              <span>👤 {admin?.full_name || admin?.username}</span>
              <button onClick={handleLogout} className="logout-nav-btn">Logout</button>
            </div>
          </nav>
          <div className="admin-container">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/dashboard" element={<Dashboard />} />
            </Routes>
          </div>
        </div>
      )}
    </Router>
  );
}

export default App;