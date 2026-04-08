import React, { useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

const Login = ({ setAuth }) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    
    if (!identifier || !password) {
      toast.error('Please enter username/phone and password');
      return;
    }
    
    setLoading(true);
    
    try {
      console.log('Attempting login to:', 'http://localhost:5000/api/admin/auth/login');
      
      const response = await axios.post('http://localhost:5000/api/admin/auth/login', {
        identifier,
        password
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 10000
      });
      
      console.log('Response:', response.data);
      
      if (response.data.success) {
        localStorage.setItem('adminToken', response.data.token);
        localStorage.setItem('adminData', JSON.stringify(response.data.admin));
        setAuth(true);
        toast.success(`Welcome back, ${response.data.admin.full_name || response.data.admin.username}!`);
      }
    } catch (error) {
      console.error('Login error details:', error);
      console.error('Error response:', error.response);
      console.error('Error message:', error.message);
      
      if (error.code === 'ERR_NETWORK') {
        toast.error('Cannot connect to server. Make sure backend is running on port 5000');
      } else if (error.response?.status === 401) {
        toast.error('Invalid credentials');
      } else if (error.response?.data?.error) {
        toast.error(error.response.data.error);
      } else {
        toast.error('Login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Demo login for testing without backend
  const handleDemoLogin = () => {
    localStorage.setItem('adminToken', 'demo-token');
    localStorage.setItem('adminData', JSON.stringify({ username: 'admin', full_name: 'Demo Admin' }));
    setAuth(true);
    toast.success('Welcome Demo Admin!');
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      background: 'linear-gradient(135deg, #6a1b9a, #8e24aa, #ab47bc)',
      padding: '20px'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '20px',
        padding: '40px',
        width: '100%',
        maxWidth: '400px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <span style={{ fontSize: '48px' }}>🎰</span>
          <h1 style={{ color: '#6a1b9a', marginTop: '10px' }}>Bingo Admin</h1>
        </div>
        <p style={{ textAlign: 'center', color: '#666', marginBottom: '30px' }}>Enter your credentials to access dashboard</p>
        
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '20px' }}>
            <input
              type="text"
              placeholder="Username / Phone Number / Email"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
              autoFocus
              style={{
                width: '100%',
                padding: '12px 15px',
                border: '1px solid #ddd',
                borderRadius: '10px',
                fontSize: '16px'
              }}
            />
          </div>
          <div style={{ marginBottom: '20px' }}>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '12px 15px',
                border: '1px solid #ddd',
                borderRadius: '10px',
                fontSize: '16px'
              }}
            />
          </div>
          <button 
            type="submit" 
            disabled={loading} 
            style={{
              width: '100%',
              padding: '12px',
              background: 'linear-gradient(135deg, #6a1b9a, #8e24aa)',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: 'pointer',
              marginBottom: '10px'
            }}
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
        
        <button 
          onClick={handleDemoLogin}
          style={{
            width: '100%',
            padding: '12px',
            background: '#f0f0f0',
            color: '#666',
            border: 'none',
            borderRadius: '10px',
            fontSize: '14px',
            cursor: 'pointer'
          }}
        >
          Demo Login (Skip Backend)
        </button>
        
        <div style={{ textAlign: 'center', marginTop: '20px', color: '#999', fontSize: '12px' }}>
          <p>Demo: Click "Demo Login" for testing</p>
          <p>Or use admin account created in database</p>
        </div>
      </div>
    </div>
  );
};

export default Login;