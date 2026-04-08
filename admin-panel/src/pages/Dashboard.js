import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { 
  FaUsers, FaMoneyBillWave, FaTrophy, FaCoins, 
  FaGamepad, FaUserPlus, FaDownload, FaCog, 
  FaSpinner, FaCheckCircle, FaTimesCircle 
} from 'react-icons/fa';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import './Dashboard.css';

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalUsers: 0,
    newUsersToday: 0,
    totalCommission: 0,
    totalPrizePaid: 0,
    pendingDeposits: 0,
    pendingWithdrawals: 0,
    activePlayers: 0,
    totalGames: 0,
    totalRevenue: 0
  });
  const [recentActivities, setRecentActivities] = useState([]);
  const [dailyStats, setDailyStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const headers = { Authorization: `Bearer ${token}` };
      
      const [statsRes, activitiesRes, chartRes] = await Promise.all([
        axios.get('http://localhost:5000/api/admin/stats', { headers }),
        axios.get('http://localhost:5000/api/admin/recent-activities', { headers }),
        axios.get('http://localhost:5000/api/admin/daily-stats', { headers })
      ]);
      
      setStats(statsRes.data);
      setRecentActivities(activitiesRes.data);
      setDailyStats(chartRes.data);
      setError(null);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      setError('Failed to load dashboard data. Make sure backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    { title: 'Total Users', value: stats.totalUsers, icon: <FaUsers />, color: '#6a1b9a', change: `+${stats.newUsersToday} today` },
    { title: 'Active Players', value: stats.activePlayers, icon: <FaGamepad />, color: '#8e24aa', change: 'currently playing' },
    { title: 'Total Revenue', value: `${stats.totalRevenue.toLocaleString()} Birr`, icon: <FaMoneyBillWave />, color: '#ab47bc', change: 'lifetime' },
    { title: 'Commission Earned', value: `${stats.totalCommission.toLocaleString()} Birr`, icon: <FaCoins />, color: '#ce93d8', change: '19% of pool' },
    { title: 'Prize Paid', value: `${stats.totalPrizePaid.toLocaleString()} Birr`, icon: <FaTrophy />, color: '#ffd700', change: 'to winners' },
    { title: 'Pending Deposits', value: stats.pendingDeposits, icon: <FaDownload />, color: '#ff9800', change: 'awaiting approval' },
    { title: 'Pending Withdrawals', value: stats.pendingWithdrawals, icon: <FaMoneyBillWave />, color: '#f44336', change: 'awaiting approval' },
    { title: 'Total Games', value: stats.totalGames, icon: <FaGamepad />, color: '#4caf50', change: 'completed' }
  ];

  if (loading) {
    return (
      <div className="dashboard-loading">
        <FaSpinner className="spinner" />
        <p>Loading dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-error">
        <FaTimesCircle className="error-icon" />
        <h3>Error Loading Dashboard</h3>
        <p>{error}</p>
        <button onClick={fetchDashboardData}>Retry</button>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      <div className="dashboard-header">
        <h1>📊 Admin Dashboard</h1>
        <div className="header-actions">
          <button className="refresh-btn" onClick={fetchDashboardData}>
            🔄 Refresh
          </button>
        </div>
      </div>

      <div className="stats-grid">
        {statCards.map((card, index) => (
          <div key={index} className="stat-card" style={{ borderTopColor: card.color }}>
            <div className="stat-icon" style={{ color: card.color }}>{card.icon}</div>
            <div className="stat-info">
              <h3>{card.title}</h3>
              <p className="stat-value">{card.value}</p>
              <span className="stat-change">{card.change}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="charts-section">
        <div className="chart-card">
          <h3>📈 Daily Revenue & Commission</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dailyStats}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="revenue" stroke="#ffd700" name="Revenue (Birr)" strokeWidth={2} />
              <Line type="monotone" dataKey="commission" stroke="#ab47bc" name="Commission (Birr)" strokeWidth={2} />
              <Line type="monotone" dataKey="prize" stroke="#4caf50" name="Prize Paid (Birr)" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>👥 Daily Users & Games</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={dailyStats}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="newUsers" fill="#6a1b9a" name="New Users" />
              <Bar dataKey="gamesPlayed" fill="#ffd700" name="Games Played" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="recent-section">
        <div className="recent-card">
          <h3>🕐 Recent Activities</h3>
          <div className="activities-list">
            {recentActivities.length === 0 ? (
              <p className="no-data">No recent activities</p>
            ) : (
              recentActivities.map((activity, index) => (
                <div key={index} className="activity-item">
                  <span className="activity-time">
                    {new Date(activity.created_at).toLocaleTimeString()}
                  </span>
                  <span className={`activity-type ${activity.type}`}>
                    {activity.type === 'deposit' && '💰 Deposit'}
                    {activity.type === 'withdraw' && '💸 Withdraw'}
                    {activity.type === 'game' && '🎮 Game'}
                  </span>
                  <span className="activity-message">{activity.message}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="quick-actions">
          <h3>⚡ Quick Actions</h3>
          <div className="action-buttons">
            <Link to="/deposits" className="action-btn deposit">
              <FaDownload /> Approve Deposits
            </Link>
            <Link to="/withdrawals" className="action-btn withdraw">
              <FaMoneyBillWave /> Process Withdrawals
            </Link>
            <Link to="/players" className="action-btn players">
              <FaUsers /> Manage Players
            </Link>
            <Link to="/bonuses" className="action-btn bonuses">
              <FaTrophy /> Manage Bonuses
            </Link>
            <Link to="/settings" className="action-btn settings">
              <FaCog /> Game Settings
            </Link>
            <Link to="/reports" className="action-btn reports">
              📊 View Reports
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;