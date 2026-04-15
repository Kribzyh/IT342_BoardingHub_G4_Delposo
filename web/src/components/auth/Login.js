import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google';
import { login } from '../../services/auth';
import './Login.css';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = await login(email, password);
      localStorage.setItem('token', data.accessToken);
      localStorage.setItem('user', JSON.stringify(data.user));
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data || 'Login failed');
    }
  };

  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        const res = await fetch('http://localhost:8080/auth/google', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: tokenResponse.access_token }),
        });
        const data = await res.json();
        if (res.ok) {
          localStorage.setItem('token', data.accessToken);
          localStorage.setItem('user', JSON.stringify(data.user));
          navigate('/dashboard');
        } else if (res.status === 428 && data.code === 'FULL_NAME_REQUIRED') {
          // First-time Google login - redirect to profile completion
          localStorage.setItem('googleToken', tokenResponse.access_token);
          localStorage.setItem('googleEmail', data.email);
          localStorage.setItem('suggestedFullName', data.suggestedFullName);
          navigate('/complete-profile');
        } else {
          setError(data.message || 'Google login failed');
        }
      } catch (err) {
        setError('Google login failed');
      }
    },
    onError: () => setError('Google login failed'),
  });

  return (
    <div className="login-container">
      <h2>Login to BoardingHub</h2>
      {error && <p className="error">{error}</p>}
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button type="submit">Login</button>
      </form>
      <div className="divider">OR</div>
      <button onClick={() => googleLogin()} className="google-btn">
        Sign in with Google
      </button>
      <p>
        Don't have an account? <a href="/register">Register</a>
      </p>
    </div>
  );
};

export default Login;