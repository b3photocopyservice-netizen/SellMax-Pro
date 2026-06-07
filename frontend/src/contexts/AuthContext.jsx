import React, { createContext, useState, useEffect, useContext } from 'react';

const AuthContext = createContext(null);
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (token) {
      // Fetch user profile or decode token
      fetchProfile();
    } else {
      setLoading(false);
    }
  }, [token]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/auth/profile`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setUser(data.user);
      } else {
        // Token expired or invalid
        logout();
      }
    } catch (err) {
      console.error('Failed to fetch user profile:', err);
      // Don't log out immediately if it's just a network failure
    } finally {
      setLoading(false);
    }
  };

  const login = async (username, password) => {
    try {
      setError(null);
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Login failed.');
      }
      localStorage.setItem('token', data.token);
      setToken(data.token);
      setUser(data.user);
      return data.user;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const pinLogin = async (username, pin) => {
    try {
      setError(null);
      const res = await fetch(`${API_URL}/api/auth/pin-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, pin })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'PIN login failed.');
      }
      localStorage.setItem('token', data.token);
      setToken(data.token);
      setUser(data.user);
      return data.user;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setError(null);
  };

  const hasPermission = (permission) => {
    if (!user) return false;
    if (user.roleName === 'Super Admin') return true;
    return user.permissions && user.permissions.includes(permission);
  };

  return (
    <AuthContext.Provider value={{ token, user, loading, error, login, pinLogin, logout, hasPermission, API_URL }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
