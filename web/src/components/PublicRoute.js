import React from 'react';
import { Navigate } from 'react-router-dom';

const PublicRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  if (token) {
    // If authenticated, redirect to dashboard
    return <Navigate to="/dashboard" replace />;
  }
  return children;
};

export default PublicRoute;