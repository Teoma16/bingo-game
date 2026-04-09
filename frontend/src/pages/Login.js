import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import './Login.css';

const Login = ({ setAuth, setUser }) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  
  const handleLogin = async (e) => {
    e.preventDefault();
    
    if (!phoneNumber || phoneNumber.length < 10) {
      toast.error('Please enter a valid phone number');
      return;
    }
    
    setLoading(true);
    try {
      const response = await axios.post('https://bingo-game-production-dd0b.up.railway.app/api/auth/login', {
        phoneNumber
      });
      
      if (response.data.success) {
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
        setAuth(true);
        setUser(response.data.user);
        toast.success('Login successful!');
        navigate('/');
      }
    } catch (error) {
      if (error.response?.status === 404) {
        toast.error('User not found. Please register via Telegram first!');
      } else {
        toast.error('Login failed. Please try again.');
      }
      console.error('Login error:', error);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="login-container">
      <div className="login-card">
        <h1>🎰 Bingo Game</h1>
        <p>Login with your registered phone number</p>
        
        <form onSubmit={handleLogin}>
          <input
            type="tel"
            placeholder="Phone Number (e.g., 2519xxxxxxxx)"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            disabled={loading}
          />
          <button type="submit" disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
        
        <div className="telegram-info">
          <p>📱 Don't have an account?</p>
          <p>Register via Telegram: <strong>@BingoGameBot</strong></p>
        </div>
      </div>
    </div>
  );
};

export default Login;