import api from './api';

export const login = async (email, password) => {
  const response = await api.post('/auth/login', { email, password });
  return response.data;
};

export const register = async (userData) => {
  const response = await api.post('/auth/register', userData);
  return response.data;
};

export const completeGoogleLogin = async (token, fullName, role) => {
  const response = await api.post('/auth/google', { token, fullName, role });
  return response.data;
};