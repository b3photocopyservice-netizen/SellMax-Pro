import React, { useState, useEffect } from 'react';
import { useAuth } from './contexts/AuthContext';
import { Lock, User, AlertCircle } from 'lucide-react';
import logo from './assets/logo.jpg';

export default function Login() {
  const { login, pinLogin, error, API_URL } = useAuth();
  const [loginMethod, setLoginMethod] = useState('password'); // 'password' or 'pin'
  
  // Credentials Login State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  // PIN Login State
  const [activeUsers, setActiveUsers] = useState([]);
  const [selectedUsername, setSelectedUsername] = useState('');
  const [pin, setPin] = useState('');

  const [localError, setLocalError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch active users for PIN selector
  useEffect(() => {
    if (loginMethod === 'pin') {
      fetchActiveUsers();
    }
  }, [loginMethod]);

  const fetchActiveUsers = async () => {
    try {
      const res = await fetch(`${API_URL}/api/auth/active-users`);
      if (res.ok) {
        const data = await res.json();
        setActiveUsers(data);
      }
    } catch (err) {
      console.error('Failed to load active users:', err);
    }
  };

  // Keyboard listener for PIN entry
  useEffect(() => {
    if (loginMethod !== 'pin' || isSubmitting) return;

    const handleKeyDown = (e) => {
      if (e.key >= '0' && e.key <= '9') {
        handlePinKeyPress(e.key);
      } else if (e.key === 'Backspace') {
        handleBackspace();
      } else if (e.key === 'Escape' || e.key === 'Delete') {
        handleClear();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [loginMethod, pin, selectedUsername, isSubmitting]);

  const handlePinKeyPress = (digit) => {
    if (!selectedUsername) {
      setLocalError('Please select a staff profile first.');
      return;
    }
    if (pin.length < 4) {
      const newPin = pin + digit;
      setPin(newPin);
      if (newPin.length === 4) {
        handlePinSubmit(selectedUsername, newPin);
      }
    }
  };

  const handleBackspace = () => {
    setPin(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    setPin('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setLocalError('Please fill in all fields.');
      return;
    }
    setLocalError('');
    setIsSubmitting(true);

    try {
      await login(username, password);
    } catch (err) {
      setLocalError(err.message || 'Login failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePinSubmit = async (userToLogin, enteredPin) => {
    if (!userToLogin || enteredPin.length !== 4) return;
    setLocalError('');
    setIsSubmitting(true);

    try {
      await pinLogin(userToLogin, enteredPin);
    } catch (err) {
      setLocalError(err.message || 'PIN login failed.');
      setPin(''); // clear PIN on error
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-overlay">
      <div className="login-card" style={{ maxWidth: '400px' }}>
        <div className="login-header">
          <div className="login-logo" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'transparent', width: 'auto', height: 'auto', marginBottom: '16px' }}>
            <img src={logo} alt="SellMax Pro Logo" style={{ width: '72px', height: '72px', borderRadius: '16px', boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }} />
          </div>
          <h2>SellMax Pro</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' }}>
            Smart Retail & Hospitality POS System
          </p>
        </div>

        {/* Segmented Tab Switcher */}
        <div style={{ 
          display: 'flex', 
          borderBottom: '1px solid var(--border-color)', 
          marginBottom: '20px',
          background: 'rgba(255, 255, 255, 0.01)',
          borderRadius: 'var(--radius-md) var(--radius-md) 0 0'
        }}>
          <button
            type="button"
            onClick={() => { setLoginMethod('password'); setLocalError(''); }}
            style={{
              flex: 1,
              padding: '12px 0',
              background: 'transparent',
              border: 'none',
              borderBottom: loginMethod === 'password' ? '2px solid var(--primary)' : 'none',
              color: loginMethod === 'password' ? 'var(--primary)' : 'var(--text-secondary)',
              fontWeight: loginMethod === 'password' ? '600' : '500',
              cursor: 'pointer',
              fontSize: '13px',
              transition: 'all 0.2s ease'
            }}
          >
            Password Login
          </button>
          <button
            type="button"
            onClick={() => { setLoginMethod('pin'); setLocalError(''); }}
            style={{
              flex: 1,
              padding: '12px 0',
              background: 'transparent',
              border: 'none',
              borderBottom: loginMethod === 'pin' ? '2px solid var(--primary)' : 'none',
              color: loginMethod === 'pin' ? 'var(--primary)' : 'var(--text-secondary)',
              fontWeight: loginMethod === 'pin' ? '600' : '500',
              cursor: 'pointer',
              fontSize: '13px',
              transition: 'all 0.2s ease'
            }}
          >
            Quick PIN Login
          </button>
        </div>

        {/* Global Error Banner */}
        {(localError || error) && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'var(--danger-bg)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            padding: '12px',
            borderRadius: 'var(--radius-md)',
            marginBottom: '20px',
            color: '#fca5a5',
            fontSize: '13px'
          }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{localError || error}</span>
          </div>
        )}

        {loginMethod === 'password' ? (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Username</label>
              <div style={{ position: 'relative' }}>
                <User size={16} style={{
                  position: 'absolute',
                  left: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-secondary)'
                }} />
                <input
                  type="text"
                  className="form-input"
                  style={{ paddingLeft: '42px' }}
                  placeholder="Enter username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={isSubmitting}
                  autoFocus
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{
                  position: 'absolute',
                  left: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-secondary)'
                }} />
                <input
                  type="password"
                  className="form-input"
                  style={{ paddingLeft: '42px' }}
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', padding: '12px', marginTop: '10px' }}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Verifying Credentials...' : 'Sign In'}
            </button>
          </form>
        ) : (
          <div>
            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label className="form-label">Select Staff Profile</label>
              <select
                className="form-input"
                style={{ 
                  background: 'var(--card-bg)', 
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  width: '100%',
                  cursor: 'pointer'
                }}
                value={selectedUsername}
                onChange={(e) => { setSelectedUsername(e.target.value); setPin(''); setLocalError(''); }}
                disabled={isSubmitting}
              >
                <option value="">-- Select Staff Profile --</option>
                {activeUsers.map((u) => (
                  <option key={u.UserID} value={u.Username}>
                    {u.Username} ({u.RoleName})
                  </option>
                ))}
              </select>
            </div>

            {/* Visual Dot Indicators */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginBottom: '24px' }}>
              {[0, 1, 2, 3].map((index) => (
                <div
                  key={index}
                  style={{
                    width: '14px',
                    height: '14px',
                    borderRadius: '50%',
                    border: '2px solid var(--border-color)',
                    background: pin.length > index ? 'var(--primary)' : 'transparent',
                    boxShadow: pin.length > index ? '0 0 10px var(--primary)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                />
              ))}
            </div>

            {/* Numeric Keypad Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '12px',
              maxWidth: '280px',
              margin: '0 auto'
            }}>
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handlePinKeyPress(num)}
                  disabled={isSubmitting}
                  style={{
                    padding: '16px 0',
                    fontSize: '18px',
                    fontWeight: '600',
                    borderRadius: 'var(--radius-md)',
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseOver={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.08)'}
                  onMouseOut={(e) => e.target.style.background = 'rgba(255, 255, 255, 0.02)'}
                >
                  {num}
                </button>
              ))}
              <button
                type="button"
                onClick={handleClear}
                disabled={isSubmitting}
                style={{
                  padding: '16px 0',
                  fontSize: '13px',
                  fontWeight: '600',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(239, 68, 68, 0.05)',
                  border: '1px solid rgba(239, 68, 68, 0.15)',
                  color: 'var(--danger)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => handlePinKeyPress('0')}
                disabled={isSubmitting}
                style={{
                  padding: '16px 0',
                  fontSize: '18px',
                  fontWeight: '600',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                0
              </button>
              <button
                type="button"
                onClick={handleBackspace}
                disabled={isSubmitting}
                style={{
                  padding: '16px 0',
                  fontSize: '13px',
                  fontWeight: '600',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                Del
              </button>
            </div>
            {isSubmitting && (
              <p style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)', marginTop: '16px' }}>
                Verifying quick access PIN...
              </p>
            )}
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '11px', color: 'var(--text-muted)' }}>
          <p>SellMax Pro POS v1.0.0</p>
          <p style={{ marginTop: '2px' }}>Powered by LabaqaBCMS 2026</p>
        </div>
      </div>
    </div>
  );
}
