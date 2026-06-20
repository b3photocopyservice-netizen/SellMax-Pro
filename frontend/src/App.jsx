import React, { useState, useEffect } from 'react';
import { useAuth } from './contexts/AuthContext';
import Login from './Login';
import Dashboard from './Dashboard';
import logo from './assets/logo.jpg';
import Register from './Register';
import Inventory from './Inventory';
import Customers from './Customers';
import Reports from './Reports';
import UserManagement from './UserManagement';
import CompanyProfile from './CompanyProfile';
import Suppliers from './Suppliers';
import { 
  LayoutDashboard, ShoppingCart, Package, Users, FileBarChart2, 
  Settings, ShieldAlert, LogOut, ShoppingBag, Clock, Wifi, DollarSign
} from 'lucide-react';

export default function App() {
  const { user, token, logout, hasPermission, login, pinLogin, API_URL, setToken, setUser } = useAuth();
  const [activeView, setActiveView] = useState('dashboard');
  const [clockTime, setClockTime] = useState(new Date());
  
  // Toast notifications state
  const [toast, setToast] = useState(null);
  const [showCashDrawerModal, setShowCashDrawerModal] = useState(false);

  // Admin Switch Auth Modal State
  const [showAdminAuthModal, setShowAdminAuthModal] = useState(false);
  const [adminAuthMode, setAdminAuthMode] = useState('pin'); // 'pin' or 'password'
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminPin, setAdminPin] = useState('');
  const [adminError, setAdminError] = useState('');
  const [adminSubmitting, setAdminSubmitting] = useState(false);
  const [adminUsers, setAdminUsers] = useState([]);
  const [selectedAdminUser, setSelectedAdminUser] = useState('');

  // Auto-clear toast after 4 seconds
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Real-time Clock trigger
  useEffect(() => {
    const clockTimer = setInterval(() => setClockTime(new Date()), 1000);
    return () => clearInterval(clockTimer);
  }, []);

  // Watch login state: reset view
  useEffect(() => {
    if (!token || !user) {
      setActiveView('login');
    } else {
      if (user.roleName === 'Cashier') {
        setActiveView('register');
      } else {
        // Only switch to dashboard if we are coming from login page
        // otherwise let user stay on their currently active view
        if (activeView === 'login') {
          setActiveView('dashboard');
        }
      }
    }
  }, [token, user]);

  // Fetch admin/manager users for quick switch dropdown
  const fetchAdminUsers = async () => {
    try {
      const res = await fetch(`${API_URL}/api/auth/active-users`);
      if (res.ok) {
        const data = await res.json();
        // Filter roles that are authorized to access Admin panel (Super Admin, Admin, Manager, Supervisor)
        const allowedRoles = ['Super Admin', 'Admin', 'Manager', 'Supervisor'];
        const filtered = data.filter(u => allowedRoles.includes(u.RoleName));
        setAdminUsers(filtered);
        if (filtered.length > 0) {
          setSelectedAdminUser(filtered[0].Username);
        }
      }
    } catch (err) {
      console.error('Failed to load active users for admin switch:', err);
    }
  };

  useEffect(() => {
    if (showAdminAuthModal && token && user) {
      fetchAdminUsers();
    }
  }, [showAdminAuthModal]);

  // Keydown listener for PIN entry in Admin Switch Modal
  useEffect(() => {
    if (!showAdminAuthModal || adminAuthMode !== 'pin' || adminSubmitting) return;

    const handleKeyDown = (e) => {
      if (e.key >= '0' && e.key <= '9') {
        if (adminPin.length < 4) {
          const newPin = adminPin + e.key;
          setAdminPin(newPin);
          if (newPin.length === 4) {
            setTimeout(() => handlePinVerification(newPin), 200);
          }
        }
      } else if (e.key === 'Backspace') {
        setAdminPin(prev => prev.slice(0, -1));
      } else if (e.key === 'Escape') {
        setShowAdminAuthModal(false);
        setAdminPin('');
        setAdminPassword('');
        setAdminError('');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showAdminAuthModal, adminAuthMode, adminPin, selectedAdminUser, adminSubmitting]);

  // Global Escape key handler to close App-level modals
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (showAdminAuthModal) {
          setShowAdminAuthModal(false);
          setAdminPin('');
          setAdminPassword('');
          setAdminError('');
        }
        if (showCashDrawerModal) {
          setShowCashDrawerModal(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showAdminAuthModal, showCashDrawerModal]);


  const handlePinVerification = async (pinVal) => {
    setAdminError('');
    setAdminSubmitting(true);
    try {
      if (!selectedAdminUser) {
        throw new Error('Please select a profile first.');
      }
      const res = await fetch(`${API_URL}/api/auth/pin-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: selectedAdminUser, pin: pinVal })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'PIN login failed.');
      }

      const loggedUser = data.user;
      const allowedRoles = ['Super Admin', 'Admin', 'Manager', 'Supervisor'];
      if (!allowedRoles.includes(loggedUser.roleName)) {
        throw new Error('Access Denied: You do not have permissions to access the Admin Panel.');
      }

      // Save Cashier session
      sessionStorage.setItem('previousCashierToken', token);
      sessionStorage.setItem('previousCashierUser', JSON.stringify(user));

      // Set new manager token
      localStorage.setItem('token', data.token);
      setToken(data.token);
      setUser(data.user);

      setShowAdminAuthModal(false);
      setAdminPin('');
      setActiveView('dashboard');
      setToast({ type: 'success', message: `Welcome ${loggedUser.username}. Switched to Admin Panel.` });
    } catch (err) {
      setAdminError(err.message || 'Verification failed.');
      setAdminPin('');
    } finally {
      setAdminSubmitting(false);
    }
  };

  const handleAdminAuthSubmit = async (e) => {
    if (e) e.preventDefault();
    setAdminError('');
    setAdminSubmitting(true);
    try {
      if (!adminUsername || !adminPassword) {
        throw new Error('Please enter both username and password.');
      }
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: adminUsername, password: adminPassword })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Login failed.');
      }

      const loggedUser = data.user;
      const allowedRoles = ['Super Admin', 'Admin', 'Manager', 'Supervisor'];
      if (!allowedRoles.includes(loggedUser.roleName)) {
        throw new Error('Access Denied: You do not have permissions to access the Admin Panel.');
      }

      // Save Cashier session
      sessionStorage.setItem('previousCashierToken', token);
      sessionStorage.setItem('previousCashierUser', JSON.stringify(user));

      // Set new manager token
      localStorage.setItem('token', data.token);
      setToken(data.token);
      setUser(data.user);

      setShowAdminAuthModal(false);
      setAdminPassword('');
      setActiveView('dashboard');
      setToast({ type: 'success', message: `Welcome ${loggedUser.username}. Switched to Admin Panel.` });
    } catch (err) {
      setAdminError(err.message || 'Verification failed.');
    } finally {
      setAdminSubmitting(false);
    }
  };

  const handleReturnToPOS = () => {
    const prevToken = sessionStorage.getItem('previousCashierToken');
    const prevUser = sessionStorage.getItem('previousCashierUser');

    if (prevToken && prevUser) {
      localStorage.setItem('token', prevToken);
      setToken(prevToken);
      setUser(JSON.parse(prevUser));
      sessionStorage.removeItem('previousCashierToken');
      sessionStorage.removeItem('previousCashierUser');
      setToast({ type: 'success', message: 'Returned to POS Terminal.' });
    } else {
      setToast({ type: 'success', message: 'Switching to POS Terminal.' });
    }
    setActiveView('register');
  };

  const handleLogout = () => {
    sessionStorage.removeItem('previousCashierToken');
    sessionStorage.removeItem('previousCashierUser');
    logout();
  };

  const handleNavClick = (viewName) => {
    setActiveView(viewName);
  };

  const renderView = () => {
    if (!token || !user) return <Login />;
    
    switch (activeView) {
      case 'dashboard':
        return <Dashboard />;
      case 'register':
        return <Register setToast={setToast} />;
      case 'inventory':
        return <Inventory setToast={setToast} />;
      case 'customers':
        return <Customers setToast={setToast} />;
      case 'reports':
        return <Reports setToast={setToast} />;
      case 'admin':
        return <UserManagement setToast={setToast} />;
      case 'settings':
        return <CompanyProfile setToast={setToast} />;
      case 'suppliers':
        return <Suppliers setToast={setToast} />;
      default:
        return <Dashboard />;
    }
  };

  const getPageTitles = () => {
    switch (activeView) {
      case 'dashboard':
        return { title: 'Executive Summary', sub: 'Performance analysis and active notifications' };
      case 'register':
        return { title: 'Smart POS Checkout', sub: 'Scan barcodes or select items to complete checkout' };
      case 'inventory':
        return { title: 'Inventory Database', sub: 'Manage product catalog configurations, low thresholds and categories' };
      case 'customers':
        return { title: 'CRM Directory', sub: 'Customer profiles, store credit limits and loyalty points balance' };
      case 'reports':
        return { title: 'Sales & Ledger Audits', sub: 'Stored procedure analytics, sales history ledger, and invoice refund returns' };
      case 'admin':
        return { title: 'User Administration', sub: 'Manage staff profiles, login history audit logs, and permission matrices' };
      case 'settings':
        return { title: 'Company Settings', sub: 'Configure company information, logo, contacts, address and financial policies' };
      case 'suppliers':
        return { title: 'Suppliers Master Console', sub: 'Manage supplier profiles, purchase orders, goods receipts, return policies and settlements' };
      default:
        return { title: 'SellMax Pro Dashboard', sub: 'Retail control terminal' };
    }
  };

  const pageMeta = getPageTitles();

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      {token && user && user.roleName !== 'Cashier' && (
        <aside className="sidebar">
          <div className="logo-container" style={{ display: 'flex', alignItems: 'center' }}>
            <img src={logo} alt="SellMax Pro Logo" style={{ width: '28px', height: '28px', borderRadius: '6px', marginRight: '10px', objectFit: 'cover' }} />
            <div>
              <span className="logo-text">SellMax Pro</span>
              <span className="logo-sub">Smart POS</span>
            </div>
          </div>

          <nav className="nav-menu">
            <div 
              className={`nav-item ${activeView === 'dashboard' ? 'active' : ''}`}
              onClick={() => handleNavClick('dashboard')}
            >
              <LayoutDashboard />
              <span>Dashboard</span>
            </div>

            {hasPermission('ACCESS_POS') && (
              <div 
                className={`nav-item ${activeView === 'register' ? 'active' : ''}`}
                onClick={() => handleNavClick('register')}
              >
                <ShoppingCart />
                <span>POS Terminal</span>
              </div>
            )}

            {(hasPermission('MANAGE_INVENTORY') || hasPermission('ACCESS_POS')) && (
              <div 
                className={`nav-item ${activeView === 'inventory' ? 'active' : ''}`}
                onClick={() => handleNavClick('inventory')}
              >
                <Package />
                <span>Inventory</span>
              </div>
            )}

            {(hasPermission('MANAGE_CUSTOMERS') || hasPermission('ACCESS_POS')) && (
              <div 
                className={`nav-item ${activeView === 'customers' ? 'active' : ''}`}
                onClick={() => handleNavClick('customers')}
              >
                <Users />
                <span>Customers CRM</span>
              </div>
            )}

            {hasPermission('VIEW_REPORTS') && (
              <div 
                className={`nav-item ${activeView === 'reports' ? 'active' : ''}`}
                onClick={() => handleNavClick('reports')}
              >
                <FileBarChart2 />
                <span>Sales & Reports</span>
              </div>
            )}

            {hasPermission('VIEW_SUPPLIERS') && (
              <div 
                className={`nav-item ${activeView === 'suppliers' ? 'active' : ''}`}
                onClick={() => handleNavClick('suppliers')}
              >
                <ShoppingBag />
                <span>Suppliers CRM</span>
              </div>
            )}

            {(hasPermission('MANAGE_USERS') || hasPermission('EDIT_PERMISSIONS')) && (
              <div 
                className={`nav-item ${activeView === 'admin' ? 'active' : ''}`}
                onClick={() => handleNavClick('admin')}
              >
                <ShieldAlert />
                <span>Security & Users</span>
              </div>
            )}

            {hasPermission('MANAGE_SETTINGS') && (
              <div 
                className={`nav-item ${activeView === 'settings' ? 'active' : ''}`}
                onClick={() => handleNavClick('settings')}
              >
                <Settings />
                <span>Company Profile</span>
              </div>
            )}
          </nav>

          <div className="sidebar-footer">
            <div className="user-profile">
              <div className="avatar">
                {user.username[0].toUpperCase()}
              </div>
              <div className="user-details">
                <div className="user-name">{user.username}</div>
                <div className="user-role">{user.roleName}</div>
              </div>
            </div>
            <button className="logout-btn" onClick={handleLogout}>
              <LogOut size={14} />
              <span>Logout Terminal</span>
            </button>
          </div>
        </aside>
      )}

      {/* Main Workspace Frame */}
      <main className="main-layout">
        {token && user && (
          <header className="top-header no-print">
            {user.roleName === 'Cashier' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <div className="logo-container" style={{ display: 'flex', alignItems: 'center', margin: 0, padding: 0, gap: '10px' }}>
                  <img src={logo} alt="SellMax Pro Logo" style={{ width: '28px', height: '28px', borderRadius: '6px', objectFit: 'cover' }} />
                  <div>
                    <span className="logo-text" style={{ fontSize: '16px', lineHeight: 1 }}>SellMax Pro</span>
                    <span className="logo-sub" style={{ fontSize: '9px', letterSpacing: '1px' }}>Smart POS</span>
                  </div>
                </div>
                
                <div style={{ height: '24px', width: '1px', background: 'var(--border-color)' }}></div>
                
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    id="btn-switch-admin"
                    className="btn btn-secondary"
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', padding: '6px 12px', background: 'rgba(139, 92, 246, 0.05)', borderColor: 'rgba(139, 92, 246, 0.15)', color: '#c084fc' }}
                    onClick={() => {
                      setAdminError('');
                      setAdminPin('');
                      setAdminPassword('');
                      setShowAdminAuthModal(true);
                    }}
                  >
                    <ShieldAlert size={15} />
                    <span>Switch to Admin Panel</span>
                  </button>

                  <button 
                    className={`btn ${activeView === 'register' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', padding: '6px 12px' }}
                    onClick={() => handleNavClick('register')}
                  >
                    <ShoppingCart size={15} />
                    <span>New Sale</span>
                  </button>
                  
                  <button 
                    className="btn btn-secondary"
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', padding: '6px 12px' }}
                    onClick={() => {
                      window.dispatchEvent(new Event('open-cash-drawer-details'));
                    }}
                  >
                    <DollarSign size={15} />
                    <span>Cash Drawer</span>
                  </button>

                  <button 
                    className="btn btn-secondary"
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', padding: '6px 12px', background: 'rgba(239, 68, 68, 0.05)', borderColor: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5' }}
                    onClick={handleLogout}
                  >
                    <LogOut size={15} />
                    <span>Logout</span>
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <div className="page-title-area">
                  <h1 className="page-title">{pageMeta.title}</h1>
                  <p className="page-subtitle">{pageMeta.sub}</p>
                </div>
                {activeView !== 'register' && (
                  <button
                    id="btn-return-pos"
                    className="btn btn-secondary"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '13px',
                      padding: '6px 12px',
                      background: 'rgba(34, 197, 94, 0.05)',
                      borderColor: 'rgba(34, 197, 94, 0.15)',
                      color: '#a7f3d0'
                    }}
                    onClick={handleReturnToPOS}
                  >
                    <ShoppingCart size={15} />
                    <span>Return to POS</span>
                  </button>
                )}
              </div>
            )}

            <div className="header-widgets">
              <div className="widget">
                <Wifi size={14} style={{ color: 'var(--success)' }} />
                <span>Store ID: #001</span>
              </div>
              <div className="widget">
                <Clock size={14} />
                <span className="clock">
                  {clockTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
              <div className="widget">
                <span>{clockTime.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}</span>
              </div>
            </div>
          </header>
        )}

        <div className="content-body">
          {renderView()}
        </div>
      </main>

      {/* Global Toast System */}
      {toast && (
        <div className="toast-container no-print">
          <div className={`toast toast-${toast.type}`}>
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* Cash Drawer Modal */}
      {showCashDrawerModal && (
        <div className="modal-overlay" style={{ zIndex: 10000 }}>
          <div className="modal-content" style={{ width: '400px', textAlign: 'center', padding: '32px' }}>
            <div style={{ 
              width: '64px', height: '64px', borderRadius: '50%', 
              background: 'rgba(34, 197, 94, 0.1)', color: 'var(--success)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px auto'
            }}>
              <DollarSign size={32} />
            </div>
            <h3 style={{ marginBottom: '10px', fontSize: '18px', fontWeight: 'bold' }}>Cash Drawer Triggered</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13.5px', lineHeight: '1.6', marginBottom: '24px' }}>
              The electronic cash drawer has been opened. Please complete your cash transaction and ensure the drawer is closed securely.
            </p>
            <button 
              className="btn btn-primary" 
              style={{ width: '100%' }}
              onClick={() => {
                setShowCashDrawerModal(false);
                setToast({ type: 'success', message: 'Cash drawer closed and locked.' });
              }}
            >
              Close Drawer
            </button>
          </div>
        </div>
      )}

      {/* Switch to Admin Panel Auth Modal */}
      {showAdminAuthModal && (
        <div className="modal-overlay" style={{ zIndex: 10000 }}>
          <div className="modal-content" style={{ width: '400px', padding: '32px' }}>
            <h3 style={{ marginBottom: '8px', fontSize: '18px', fontWeight: 'bold', textAlign: 'center' }}>Admin Panel Access</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '20px', textAlign: 'center' }}>
              Authorize using PIN or credentials to switch to Admin views.
            </p>

            {/* Segmented Tab Switcher */}
            <div style={{ 
              display: 'flex', 
              borderBottom: '1px solid var(--border-color)', 
              marginBottom: '20px',
              background: 'rgba(255, 255, 255, 0.02)',
              borderRadius: 'var(--radius-md)'
            }}>
              <button
                type="button"
                className="btn"
                style={{
                  flex: 1,
                  padding: '10px 0',
                  background: adminAuthMode === 'pin' ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                  border: 'none',
                  color: adminAuthMode === 'pin' ? 'var(--primary)' : 'var(--text-secondary)',
                  fontWeight: adminAuthMode === 'pin' ? '600' : '500',
                  cursor: 'pointer',
                  fontSize: '13px',
                  borderRadius: 'var(--radius-md) 0 0 var(--radius-md)'
                }}
                onClick={() => { setAdminAuthMode('pin'); setAdminError(''); }}
              >
                PIN Verification
              </button>
              <button
                type="button"
                className="btn"
                style={{
                  flex: 1,
                  padding: '10px 0',
                  background: adminAuthMode === 'password' ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                  border: 'none',
                  color: adminAuthMode === 'password' ? 'var(--primary)' : 'var(--text-secondary)',
                  fontWeight: adminAuthMode === 'password' ? '600' : '500',
                  cursor: 'pointer',
                  fontSize: '13px',
                  borderRadius: '0 var(--radius-md) var(--radius-md) 0'
                }}
                onClick={() => { setAdminAuthMode('password'); setAdminError(''); }}
              >
                Password Verification
              </button>
            </div>

            {adminError && (
              <div style={{
                background: 'var(--danger-bg)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                padding: '10px 12px',
                borderRadius: 'var(--radius-sm)',
                color: '#fca5a5',
                fontSize: '12.5px',
                marginBottom: '16px',
                textAlign: 'center'
              }}>
                {adminError}
              </div>
            )}

            {adminAuthMode === 'pin' ? (
              <div>
                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label className="form-label">Select Staff Profile</label>
                  <select
                    className="form-select"
                    value={selectedAdminUser}
                    onChange={(e) => {
                      setSelectedAdminUser(e.target.value);
                      setAdminPin('');
                      setAdminError('');
                    }}
                    disabled={adminSubmitting}
                  >
                    {adminUsers.map(u => (
                      <option key={u.UserID} value={u.Username}>
                        {u.Username} ({u.RoleName})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: '20px' }}>
                  <label className="form-label" style={{ textAlign: 'center', display: 'block' }}>Enter 4-Digit Security PIN</label>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', margin: '12px 0 20px 0' }}>
                    {[0, 1, 2, 3].map((index) => (
                      <div
                        key={index}
                        style={{
                          width: '16px',
                          height: '16px',
                          borderRadius: '50%',
                          border: '2px solid var(--border-color)',
                          background: adminPin.length > index ? 'var(--primary)' : 'transparent',
                          transition: 'all 0.1s ease'
                        }}
                      />
                    ))}
                  </div>
                </div>

                {/* Numerical Keypad */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '10px',
                  maxWidth: '240px',
                  margin: '0 auto 20px auto'
                }}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                    <button
                      key={num}
                      type="button"
                      className="btn btn-secondary"
                      style={{ height: '48px', fontSize: '18px', fontWeight: 'bold' }}
                      onClick={() => {
                        if (adminPin.length < 4) {
                          const newPin = adminPin + num;
                          setAdminPin(newPin);
                          if (newPin.length === 4) {
                            setTimeout(() => handlePinVerification(newPin), 200);
                          }
                        }
                      }}
                      disabled={adminSubmitting}
                    >
                      {num}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ height: '48px', fontSize: '12px', color: 'var(--text-secondary)' }}
                    onClick={() => setAdminPin('')}
                    disabled={adminSubmitting}
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ height: '48px', fontSize: '18px', fontWeight: 'bold' }}
                    onClick={() => {
                      if (adminPin.length < 4) {
                        const newPin = adminPin + '0';
                        setAdminPin(newPin);
                        if (newPin.length === 4) {
                          setTimeout(() => handlePinVerification(newPin), 200);
                        }
                      }
                    }}
                    disabled={adminSubmitting}
                  >
                    0
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ height: '48px', fontSize: '12px', color: 'var(--text-secondary)' }}
                    onClick={() => setAdminPin(prev => prev.slice(0, -1))}
                    disabled={adminSubmitting}
                  >
                    Del
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleAdminAuthSubmit}>
                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label className="form-label">Username</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Enter Admin Username"
                    value={adminUsername}
                    onChange={(e) => setAdminUsername(e.target.value)}
                    disabled={adminSubmitting}
                    required
                  />
                </div>
                <div className="form-group" style={{ marginBottom: '20px' }}>
                  <label className="form-label">Password</label>
                  <input
                    type="password"
                    className="form-input"
                    placeholder="Enter Password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    disabled={adminSubmitting}
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '12px', marginBottom: '12px' }}
                  disabled={adminSubmitting}
                >
                  {adminSubmitting ? 'Authenticating...' : 'Verify & Switch'}
                </button>
              </form>
            )}

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
              <button 
                type="button" 
                className="btn btn-secondary" 
                style={{ width: '100%' }}
                onClick={() => {
                  setShowAdminAuthModal(false);
                  setAdminPin('');
                  setAdminPassword('');
                  setAdminError('');
                }}
                disabled={adminSubmitting}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
