import React, { useState, useEffect } from 'react';
import formatCurrency from './utils/formatCurrency';
import { useAuth } from './contexts/AuthContext';
import { DollarSign, ShoppingBag, AlertTriangle, Users, TrendingUp, RefreshCw, Bell, Clock } from 'lucide-react';

export default function Dashboard() {
  const { token, API_URL } = useAuth();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    TotalRevenue: 0,
    TransactionCount: 0,
    AverageTicketSize: 0,
    TotalTax: 0
  });
  const [paymentBreakdown, setPaymentBreakdown] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [recentSales, setRecentSales] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const [supplierWidgets, setSupplierWidgets] = useState(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      // Fetch Daily Sales Summary
      const summaryRes = await fetch(`${API_URL}/api/reports/daily-summary`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (summaryRes.ok) {
        const summaryData = await summaryRes.json();
        setMetrics(summaryData.metrics);
        setPaymentBreakdown(summaryData.paymentMethods);
      }

      // Fetch Low Stock Warnings
      const stockRes = await fetch(`${API_URL}/api/reports/low-stock`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (stockRes.ok) {
        const stockData = await stockRes.json();
        setLowStock(stockData);
      }

      // Fetch Recent Sales
      const salesRes = await fetch(`${API_URL}/api/sales/history?limit=5`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (salesRes.ok) {
        const salesData = await salesRes.json();
        setRecentSales(salesData.slice(0, 5));
      }

      // Fetch System Notifications (generates alerts too)
      fetchNotifications();

      // Fetch Supplier Widgets
      try {
        const supRes = await fetch(`${API_URL}/api/suppliers/widgets`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (supRes.ok) {
          setSupplierWidgets(await supRes.json());
        }
      } catch (e) {
        console.error('Failed to load supplier widgets:', e);
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchNotifications = async () => {
    try {
      setNotifLoading(true);
      const res = await fetch(`${API_URL}/api/inventory/notifications`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setNotifications(await res.json());
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setNotifLoading(false);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await fetch(`${API_URL}/api/inventory/notifications/read`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setNotifications(prev => prev.map(n => ({ ...n, IsRead: 1 })));
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: '16px' }}>
        <RefreshCw size={36} className="animate-spin" style={{ color: 'var(--primary)', animation: 'spin 1.5s linear infinite' }} />
        <p style={{ color: 'var(--text-secondary)' }}>Loading business operations...</p>
      </div>
    );
  }

  // Sample data points for SVG Chart (e.g. Sales by Hour)
  const chartPoints = [320, 480, 420, 680, 850, 710, 940, 1100, 950, 1250, 1420, 1380];
  const chartLabels = ['9AM', '10AM', '11AM', '12PM', '1PM', '2PM', '3PM', '4PM', '5PM', '6PM', '7PM', '8PM'];
  const maxVal = Math.max(...chartPoints);
  const minVal = 0;
  const range = maxVal - minVal;

  // Map data to SVG viewBox coordinates (width = 600, height = 200, padding = 30)
  const chartWidth = 600;
  const chartHeight = 180;
  const paddingLeft = 70;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 20;

  const innerWidth = chartWidth - paddingLeft - paddingRight;
  const innerHeight = chartHeight - paddingTop - paddingBottom;

  const pointsString = chartPoints.map((val, idx) => {
    const x = paddingLeft + (idx / (chartPoints.length - 1)) * innerWidth;
    const y = paddingTop + innerHeight - ((val - minVal) / range) * innerHeight;
    return `${x},${y}`;
  }).join(' ');

  // SVG Area path closing it back to the bottom baseline for a nice color fill gradient
  const areaPointsString = `${paddingLeft},${paddingTypeY(0)} ${pointsString} ${paddingLeft + innerWidth},${paddingTypeY(0)}`;
  
  function paddingTypeY(idx) {
    return paddingTop + innerHeight;
  }

  return (
    <div>
      {/* Metrics Row */}
      <div className="dashboard-grid">
        <div className="metric-card metric-card-glow">
          <div className="metric-icon-wrapper" style={{ background: 'var(--primary-gradient)' }}>
            <DollarSign size={24} />
          </div>
          <div className="metric-info">
            <span className="metric-label">Today's Revenue</span>
            <span className="metric-value mono">Rs. {formatCurrency(metrics.TotalRevenue)}</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-wrapper" style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' }}>
            <ShoppingBag size={24} />
          </div>
          <div className="metric-info">
            <span className="metric-label">Transactions</span>
            <span className="metric-value">{metrics.TransactionCount}</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-wrapper" style={{ background: 'linear-gradient(135deg, #10b981 0%, #047857 100%)' }}>
            <TrendingUp size={24} />
          </div>
          <div className="metric-info">
            <span className="metric-label">Average Invoice</span>
            <span className="metric-value mono">Rs. {formatCurrency(metrics.AverageTicketSize)}</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon-wrapper" style={{ 
            background: lowStock.length > 0 ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' : 'linear-gradient(135deg, #6b7280 0%, #374151 100%)' 
          }}>
            <AlertTriangle size={24} />
          </div>
          <div className="metric-info">
            <span className="metric-label">Low Stock Alerts</span>
            <span className="metric-value" style={{ color: lowStock.length > 0 ? 'var(--warning)' : 'inherit' }}>
              {lowStock.length}
            </span>
          </div>
        </div>

        <div className="metric-card" style={{ cursor: 'default' }}>
          <div className="metric-icon-wrapper" style={{
            background: notifications.filter(n => !n.IsRead).length > 0 ? 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)' : 'linear-gradient(135deg, #6b7280 0%, #374151 100%)'
          }}>
            <Bell size={24} />
          </div>
          <div className="metric-info">
            <span className="metric-label">System Alerts</span>
            <span className="metric-value" style={{ color: notifications.filter(n => !n.IsRead).length > 0 ? '#a78bfa' : 'inherit' }}>
              {notifications.filter(n => !n.IsRead).length} unread
            </span>
          </div>
        </div>
      </div>

      {/* Main Charts & Feed */}
      <div className="dashboard-details">
        {/* Left Side: Sales Analytics Chart */}
        <div className="glass-panel" style={{ flexGrow: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: '700' }}>Sales Revenue Trend</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Hourly gross sales analysis</p>
            </div>
            <button className="btn btn-secondary btn-icon" onClick={fetchDashboardData} title="Refresh Data">
              <RefreshCw size={16} />
            </button>
          </div>

          <div className="chart-container">
            <svg className="chart-svg" viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="none">
              <defs>
                <linearGradient id="chart-gradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
                const y = paddingTop + pct * innerHeight;
                return (
                  <g key={i}>
                    <line className="chart-grid-line" x1={paddingLeft} y1={y} x2={paddingLeft + innerWidth} y2={y} />
                    <text className="chart-axis-text" x={paddingLeft - 8} y={y + 4} textAnchor="end">
                      Rs. {Math.round(maxVal - pct * range)}
                    </text>
                  </g>
                );
              })}

              {/* Area Fill */}
              <polygon
                className="chart-area"
                points={`${paddingLeft},${paddingTop + innerHeight} ${chartPoints.map((val, idx) => {
                  const x = paddingLeft + (idx / (chartPoints.length - 1)) * innerWidth;
                  const y = paddingTop + innerHeight - ((val - minVal) / range) * innerHeight;
                  return `${x},${y}`;
                }).join(' ')} ${paddingLeft + innerWidth},${paddingTop + innerHeight}`}
              />

              {/* Line Path */}
              <polyline className="chart-path" points={pointsString} />

              {/* Data Dots & X Axis labels */}
              {chartPoints.map((val, idx) => {
                const x = paddingLeft + (idx / (chartPoints.length - 1)) * innerWidth;
                const y = paddingTop + innerHeight - ((val - minVal) / range) * innerHeight;
                return (
                  <g key={idx}>
                    <circle className="chart-dot" cx={x} cy={y} r="4">
                      <title>Rs. {val}</title>
                    </circle>
                    {idx % 2 === 0 && (
                      <text className="chart-axis-text" x={x} y={chartHeight - 4} textAnchor="middle">
                        {chartLabels[idx]}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* Right Side: Payment Breakdown, Stock Alerts & Notifications */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Payment Methods */}
          <div className="glass-panel" style={{ padding: '20px', margin: 0 }}>
            <h3 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '16px' }}>Payment Channels</h3>
            {paymentBreakdown.length === 0 ? (
              <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No payment transactions today.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {paymentBreakdown.map((pm, i) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span style={{ fontWeight: '500' }}>{pm.PaymentMethod}</span>
                      <span className="mono" style={{ color: 'var(--accent)', fontWeight: '600' }}>
                        Rs. {formatCurrency(pm.TotalCollected)}
                      </span>
                    </div>
                    {/* Visual Progress Bar */}
                    <div style={{ height: '4px', background: 'var(--border-color)', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ 
                        height: '100%', 
                        background: pm.PaymentMethod === 'Cash' ? '#10b981' : pm.PaymentMethod === 'Card' ? '#8b5cf6' : pm.PaymentMethod === 'Bank Transfer' ? '#06b6d4' : '#f59e0b',
                        width: `${Math.min(100, (pm.TotalCollected / (metrics.TotalRevenue || 1)) * 100)}%`
                      }}></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Low Stock Widget */}
          <div className="glass-panel" style={{ padding: '20px', margin: 0 }}>
            <h3 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              Stock Alerts
              {lowStock.length > 0 && (
                <span style={{ background: 'var(--danger-bg)', color: '#fca5a5', fontSize: '10px', padding: '1px 6px', borderRadius: '10px', fontWeight: '700' }}>
                  {lowStock.length} Low
                </span>
              )}
            </h3>

            {lowStock.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '80px', color: 'var(--text-muted)' }}>
                <span style={{ fontSize: '12px' }}>All inventory items fully stocked.</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '140px', overflowY: 'auto', paddingRight: '4px' }}>
                {lowStock.slice(0, 4).map((item, i) => (
                  <div key={i} style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    background: 'rgba(255, 255, 255, 0.01)', 
                    border: '1px solid var(--border-color)', 
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)'
                  }}>
                    <div>
                      <div style={{ fontSize: '12.5px', fontWeight: '600' }}>{item.ProductName}</div>
                      <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>SKU: {item.SKU}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--danger)' }}>{item.CurrentStock} left</div>
                      <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Threshold: {item.LowStockThreshold}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* System Notifications Feed */}
          <div className="glass-panel" style={{ padding: '20px', margin: 0, flexGrow: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Bell size={14} style={{ color: '#a78bfa' }} /> System Alerts
                {notifications.filter(n => !n.IsRead).length > 0 && (
                  <span style={{ background: 'rgba(167,139,250,0.2)', color: '#a78bfa', fontSize: '10px', padding: '1px 6px', borderRadius: '10px', fontWeight: '700' }}>
                    {notifications.filter(n => !n.IsRead).length} new
                  </span>
                )}
              </h3>
              {notifications.filter(n => !n.IsRead).length > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
                >
                  Mark all read
                </button>
              )}
            </div>

            {notifLoading ? (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '12px' }}>Loading alerts...</div>
            ) : notifications.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '12px' }}>No system alerts. All good!</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '220px', overflowY: 'auto', paddingRight: '4px' }}>
                {notifications.slice(0, 8).map((notif, i) => {
                  const isExpiry = notif.Type === 'Expiry';
                  const isExpired = notif.Message && notif.Message.startsWith('EXPIRED');
                  const color = isExpired ? '#ef4444' : isExpiry ? '#f97316' : '#f59e0b';
                  return (
                    <div key={i} style={{
                      padding: '8px 10px',
                      background: notif.IsRead ? 'transparent' : `${color}11`,
                      border: `1px solid ${notif.IsRead ? 'var(--border-color)' : color + '33'}`,
                      borderLeft: `3px solid ${color}`,
                      borderRadius: 'var(--radius-sm)',
                      transition: 'all 0.2s'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                        <Clock size={11} style={{ color, marginTop: '2px', flexShrink: 0 }} />
                        <div>
                          <div style={{ fontSize: '11px', color: notif.IsRead ? 'var(--text-secondary)' : 'var(--text-primary)', lineHeight: '1.4', fontWeight: notif.IsRead ? '400' : '500' }}>
                            {notif.Message}
                          </div>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {new Date(notif.CreatedAt).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Supplier Operations Grid */}
      {supplierWidgets && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', marginTop: '24px' }}>
          {/* Recent Purchases List */}
          <div className="glass-panel" style={{ margin: 0, padding: '20px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px' }}>Recent Procurements</h3>
            {supplierWidgets.recentPurchases.length === 0 ? (
              <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No procurements recorded yet.</p>
            ) : (
              <div className="table-container">
                <table className="table-glass">
                  <thead>
                    <tr>
                      <th>PO No.</th>
                      <th>Supplier</th>
                      <th>Date</th>
                      <th>Total</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {supplierWidgets.recentPurchases.slice(0, 4).map((p, i) => (
                      <tr key={i}>
                        <td className="mono" style={{ fontWeight: '600' }}>{p.PONumber}</td>
                        <td style={{ fontWeight: '600' }}>{p.SupplierName}</td>
                        <td>{new Date(p.OrderDate).toLocaleDateString()}</td>
                        <td className="mono">Rs. {formatCurrency(p.TotalAmount)}</td>
                        <td>
                          <span style={{
                            padding: '2px 8px', borderRadius: '10px', fontSize: '10.5px', fontWeight: '700',
                            background: p.Status === 'Invoiced' ? 'var(--success-bg)' : 'rgba(255,255,255,0.05)',
                            color: p.Status === 'Invoiced' ? 'var(--success)' : 'var(--text-secondary)'
                          }}>{p.Status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Supplier Accounting Summary */}
          <div className="glass-panel" style={{ margin: 0, padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '700' }}>Supplier Payables</h3>
            
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', padding: '16px', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Outstanding Payables</div>
              <div style={{ fontSize: '24px', fontWeight: '800', color: 'var(--warning)', marginTop: '4px' }}>
                Rs. {Number(supplierWidgets.outstandingPayables).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', padding: '12px', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Total Suppliers</div>
                <div style={{ fontSize: '18px', fontWeight: '700', marginTop: '4px' }}>{supplierWidgets.totalSuppliers}</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', padding: '12px', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Active</div>
                <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--success)', marginTop: '4px' }}>{supplierWidgets.activeSuppliers}</div>
              </div>
            </div>

            {supplierWidgets.creditAlerts > 0 && (
              <div style={{ 
                display: 'flex', alignItems: 'center', gap: '10px',
                background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)',
                padding: '12px', borderRadius: 'var(--radius-md)', color: '#fca5a5', fontSize: '12px'
              }}>
                <AlertTriangle size={16} style={{ color: 'var(--danger)', flexShrink: 0 }} />
                <span>{supplierWidgets.creditAlerts} supplier(s) near credit limit!</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Recent Orders Log Table */}
      <div className="glass-panel" style={{ marginTop: '24px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px' }}>Recent POS Activity</h3>
        {recentSales.length === 0 ? (
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>No transactions processed yet.</p>
        ) : (
          <div className="table-container">
            <table className="table-glass">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Cashier</th>
                  <th>Total Due</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentSales.map((sale, i) => (
                  <tr key={i}>
                    <td className="mono" style={{ fontWeight: '600' }}>#SM-{sale.OrderID}</td>
                    <td>{new Date(sale.OrderDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({new Date(sale.OrderDate).toLocaleDateString()})</td>
                    <td>{sale.CustomerName || 'Walk-in Customer'}</td>
                    <td>{sale.Username}</td>
                    <td className="mono" style={{ color: 'var(--accent)', fontWeight: '600' }}>Rs. {formatCurrency(sale.TotalAmount)}</td>
                    <td>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: '700',
                        background: sale.Status === 'Completed' ? 'var(--success-bg)' : sale.Status === 'Refunded' ? 'var(--danger-bg)' : 'var(--warning-bg)',
                        color: sale.Status === 'Completed' ? '#a7f3d0' : sale.Status === 'Refunded' ? '#fca5a5' : '#fef08a'
                      }}>
                        {sale.Status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
