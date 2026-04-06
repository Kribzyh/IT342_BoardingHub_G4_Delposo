import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { completeGoogleLogin } from '../../services/auth';
import './Login.css';

const CompleteGoogleProfile = () => {
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('TENANT');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Get the stored data from Google authentication
    const storedEmail = localStorage.getItem('googleEmail');
    const suggestedName = localStorage.getItem('suggestedFullName');

    if (!storedEmail) {
      // If no stored data, redirect to login
      navigate('/login');
      return;
    }

    setEmail(storedEmail);
    setFullName('');
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setError('Full name is required');
      return;
    }
    if (!role) {
      setError('Please select a role');
      return;
    }

    setLoading(true);
    try {
      const googleToken = localStorage.getItem('googleToken');
      const data = await completeGoogleLogin(googleToken, fullName, role);
      
      // Clear temporary storage
      localStorage.removeItem('googleToken');
      localStorage.removeItem('googleEmail');
      localStorage.removeItem('suggestedFullName');

      // Save authentication data
      localStorage.setItem('token', data.accessToken);
      localStorage.setItem('user', JSON.stringify(data.user));
      
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to complete registration');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <h2>Complete Your Profile</h2>
      <p>Please enter your full name to complete your registration</p>
      {error && <p className="error">{error}</p>}
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Email</label>
          <input
            type="email"
            value={email}
            disabled
            className="disabled-input"
          />
        </div>
        <div className="form-group">
          <label>Full Name *</label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Jane A. Doe"
            required
            autoFocus
          />
        </div>
        <div className="form-group">
          <label>Role *</label>
          <select value={role} onChange={(e) => setRole(e.target.value)} required>
            <option value="TENANT">Tenant</option>
            <option value="LANDLORD">Landlord</option>
          </select>
        </div>
        <button type="submit" disabled={loading}>
          {loading ? 'Completing Registration...' : 'Complete Registration'}
        </button>
      </form>
    </div>
  );
};

export default CompleteGoogleProfile;
