import React from 'react';
import { useNavigate } from 'react-router-dom';

const Dashboard = () => {
  const user = JSON.parse(localStorage.getItem('user')) || {};
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    // Replace history entry to prevent back navigation
    navigate('/login', { replace: true });
  };

  return (
    <div style={{ padding: '20px' }}>
      <h1>Welcome, {user.fullName || 'User'}!</h1>
      <p>Your role: {user.role || 'Not assigned'}</p>
      <button onClick={handleLogout}>Logout</button>
    </div>
  );
};

export default Dashboard;