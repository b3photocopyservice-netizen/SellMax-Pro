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
  Settings, ShieldAlert, LogOut, ShoppingBag, Clock, Wifi 
} from 'lucide-react';

export default function App() {
  const { user, token, logout, hasPermission } = useAuth();
  const [activeView, setActiveView] = useState('dashboard');
  const [clockTime, setClockTime] = useState(new Date());
  
  // Toast notifications state
  const [toast, setToast] = useState(null);

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
      setActiveView('dashboard');
    }
  }, [token, user]);

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
      {token && user && (
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
            <button className="logout-btn" onClick={logout}>
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
            <div className="page-title-area">
              <h1 className="page-title">{pageMeta.title}</h1>
              <p className="page-subtitle">{pageMeta.sub}</p>
            </div>

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
    </div>
  );
}
