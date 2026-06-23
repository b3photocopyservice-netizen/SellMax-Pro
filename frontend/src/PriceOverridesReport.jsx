import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './contexts/AuthContext';
import formatCurrency from './utils/formatCurrency';
import {
  Calendar, RefreshCw, Printer, Download,
  TrendingDown, ShieldAlert, Search, X, FileText
} from 'lucide-react';

const fmtDate = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const today = () => new Date().toISOString().split('T')[0];
const nDaysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
};

export default function PriceOverridesReport({ setToast }) {
  const { token, API_URL } = useAuth();

  /* ── filter state ──────────────────────────────────────────────────── */
  const [startDate, setStartDate] = useState(nDaysAgo(30));
  const [endDate, setEndDate] = useState(today());
  const [search, setSearch] = useState('');

  /* ── report data ───────────────────────────────────────────────────── */
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasRun, setHasRun] = useState(false);

  /* ── receipt modal state ────────────────────────────────────────────── */
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [activeOrder, setActiveOrder] = useState(null);
  const [companyInfo, setCompanyInfo] = useState(null);

  useEffect(() => {
    runReport();
    fetchCompanyInfo();
  }, []);

  const fetchCompanyInfo = async () => {
    try {
      const res = await fetch(`${API_URL}/api/company`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setCompanyInfo(await res.json());
    } catch (err) {
      console.error('Failed to load company info:', err);
    }
  };

  const runReport = useCallback(async () => {
    setLoading(true);
    setHasRun(true);
    try {
      let url = `${API_URL}/api/reports/price-overrides?t=${Date.now()}`;
      if (startDate) url += `&startDate=${startDate}`;
      if (endDate) url += `&endDate=${endDate}`;

      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to load report');
      setRows(await res.json());
    } catch (err) {
      setToast({ type: 'error', message: err.message });
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, token, API_URL]);

  const handleInvoiceClick = async (orderId) => {
    try {
      const res = await fetch(`${API_URL}/api/sales/history/${orderId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setActiveOrder(data);
        setShowInvoiceModal(true);
      } else {
        throw new Error('Invoice not found');
      }
    } catch (err) {
      setToast({ type: 'error', message: 'Failed to retrieve invoice details.' });
    }
  };

  const getCompanyLogoUrl = (logoPath) => {
    if (!logoPath) return '';
    if (logoPath.startsWith('http')) return logoPath;
    return `${API_URL}${logoPath}`;
  };

  const handlePrintReceipt = () => {
    const order = activeOrder?.order;
    const items = activeOrder?.items || [];
    const payments = activeOrder?.payments || [];
    if (!order) return;

    const logoHtml = companyInfo?.LogoURL 
      ? `<div style="text-align:center;margin-bottom:8px;"><img src="${getCompanyLogoUrl(companyInfo.LogoURL)}" style="max-height:50px;max-width:180px;object-fit:contain;"/></div>`
      : '';

    const itemsRows = items.map(item => `
      <tr>
        <td style="padding:4px 0;font-size:11px;">
          <div>${item.ProductName}</div>
          ${item.OriginalPrice && Number(item.OriginalPrice) !== Number(item.Price) ? `<div style="font-size:9px;color:#555;">Orig: <span style="text-decoration:line-through;">Rs. ${formatCurrency(item.OriginalPrice)}</span></div>` : ''}
        </td>
        <td style="padding:4px 0;text-align:center;font-size:11px;">${Number(item.Quantity)} ${item.UOM || 'pcs'}</td>
        <td style="padding:4px 0;text-align:right;font-size:11px;">Rs. ${formatCurrency(item.Subtotal)}</td>
      </tr>
    `).join('');

    const paymentsHtml = payments.map(p => `
      <div style="display:flex;justify-content:space-between;font-size:11px;margin-top:2px;">
        <span>Payment (${p.PaymentMethod}):</span>
        <span>Rs. ${formatCurrency(p.Amount)}</span>
      </div>
    `).join('');

    const printHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Receipt SM-${order.OrderID}</title>
  <style>
    body { font-family: 'Courier New', Courier, monospace; width: 76mm; margin: 0 auto; padding: 4mm; color: #000; font-size: 11px; }
    hr { border: none; border-top: 1px dashed #000; margin: 6px 0; }
    table { width: 100%; border-collapse: collapse; }
    th { border-bottom: 1px dashed #000; padding: 4px 0; font-size: 11px; text-align: left; }
    .text-center { text-align: center; } .text-right { text-align: right; }
    .receipt-details { margin: 8px 0; font-size: 10.5px; }
    .receipt-details div { margin-bottom: 2px; }
    .summary-row { display: flex; justify-content: space-between; font-weight: bold; font-size: 11.5px; margin-top: 4px; }
  </style>
</head>
<body onload="window.print();window.onafterprint=function(){window.close();}">
  ${logoHtml}
  <div class="text-center" style="font-weight:bold;font-size:13px;text-transform:uppercase;">${companyInfo?.Name || 'SELLMAX PRO'}</div>
  <div class="text-center" style="font-size:9.5px;color:#333;line-height:1.3;margin-top:2px;">
    ${companyInfo?.AddressLine1 ? `<div>${companyInfo.AddressLine1}</div>` : ''}
    ${companyInfo?.AddressLine2 ? `<div>${companyInfo.AddressLine2}</div>` : ''}
    ${companyInfo?.City ? `<div>${companyInfo.City}</div>` : ''}
    ${companyInfo?.TelephoneNumber ? `<div>Tel: ${companyInfo.TelephoneNumber}</div>` : ''}
  </div>
  <hr/>
  <div class="receipt-details">
    <div>INVOICE: #SM-${order.OrderID}</div>
    <div>DATE: ${new Date(order.OrderDate).toLocaleString()}</div>
    <div>CASHIER: ${order.Username}</div>
    <div>CUSTOMER: ${order.CustomerName || 'Walk-in Customer'}</div>
  </div>
  <hr/>
  <table>
    <thead>
      <tr>
        <th style="width:55%;">ITEM</th>
        <th style="width:15%;text-align:center;">QTY</th>
        <th style="width:30%;text-align:right;">PRICE</th>
      </tr>
    </thead>
    <tbody>
      ${itemsRows}
    </tbody>
  </table>
  <hr/>
  <div style="display:flex;justify-content:space-between;font-size:11px;">
    <span>Subtotal:</span>
    <span>Rs. ${formatCurrency(order.Subtotal)}</span>
  </div>
  ${Number(order.DiscountAmount) > 0 ? `
  <div style="display:flex;justify-content:space-between;font-size:11px;">
    <span>Discount:</span>
    <span>-Rs. ${formatCurrency(order.DiscountAmount)}</span>
  </div>` : ''}
  <div style="display:flex;justify-content:space-between;font-size:11px;">
    <span>Tax (10%):</span>
    <span>Rs. ${formatCurrency(order.TaxAmount)}</span>
  </div>
  <hr/>
  <div class="summary-row">
    <span>TOTAL:</span>
    <span>Rs. ${formatCurrency(order.TotalAmount)}</span>
  </div>
  <hr/>
  ${paymentsHtml}
  <hr/>
  <div class="text-center" style="margin-top:12px;font-size:9.5px;">Thank you for your business!</div>
  <div class="text-center" style="font-size:8px;color:#666;margin-top:2px;">Powered by SellMax Pro</div>
</body>
</html>`;

    const w = window.open('', '_blank', 'width=450,height=600');
    if (w) {
      w.document.write(printHtml);
      w.document.close();
    }
  };

  /* ── filtered rows (client-side text search) ───────────────────────── */
  const filtered = rows.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (r.ProductName || '').toLowerCase().includes(q) ||
      (r.SKU         || '').toLowerCase().includes(q) ||
      (String(r.OrderID) || '').includes(q) ||
      (r.CashierName || '').toLowerCase().includes(q) ||
      (r.ManagerName || '').toLowerCase().includes(q)
    );
  });

  /* ── summary totals ─────────────────────────────────────────────────── */
  const totals = filtered.reduce((acc, r) => {
    const diff = parseFloat(r.OriginalPrice || 0) - parseFloat(r.OverriddenPrice || 0);
    acc.reductionValue += diff;
    if (diff > 0) acc.overrideCount++;
    return acc;
  }, { reductionValue: 0, overrideCount: 0 });

  /* ── print log report ────────────────────────────────────────────────── */
  const handlePrintReport = () => {
    const rowsHtml = filtered.map((r, i) => {
      const diff = Number(r.OriginalPrice) - Number(r.OverriddenPrice);
      const pct = r.OriginalPrice > 0 ? (diff / r.OriginalPrice) * 100 : 0;
      return `
        <tr style="background:${i % 2 === 0 ? '#f8fafc' : '#fff'}">
          <td>${fmtDate(r.CreatedAt)}</td>
          <td style="font-weight:600">#SM-${r.OrderID}</td>
          <td>${r.ProductName}</td>
          <td>${r.SKU}</td>
          <td style="text-align:right">Rs. ${formatCurrency(r.OriginalPrice)}</td>
          <td style="text-align:right;color:#f59e0b;font-weight:600">Rs. ${formatCurrency(r.OverriddenPrice)}</td>
          <td style="text-align:right;color:#ef4444;font-weight:600">-Rs. ${formatCurrency(diff)} (${pct.toFixed(1)}%)</td>
          <td>${r.CashierName}</td>
          <td>${r.ManagerName || 'System Allowed'}</td>
        </tr>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Price Overrides Audit Log</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 11px; color: #111; }
  h2 { margin: 0 0 4px; font-size: 16px; } p { margin: 0 0 12px; color:#555; font-size:11px; }
  table { width:100%; border-collapse:collapse; }
  th { background:#1e293b; color:#fff; padding:8px 10px; text-align:left; font-size:11px; }
  td { padding:6px 10px; border-bottom:1px solid #e2e8f0; font-size:11px; }
  tfoot td { background:#f1f5f9; font-weight:700; border-top:2px solid #1e293b; }
</style></head><body>
  <h2>Price Overrides Audit Log</h2>
  <p>${startDate || '—'} to ${endDate || '—'}</p>
  <table>
    <thead><tr>
      <th>Timestamp</th><th>Invoice ID</th><th>Product</th><th>SKU</th>
      <th style="text-align:right">Original Price</th>
      <th style="text-align:right">Overridden Price</th>
      <th style="text-align:right">Variance</th>
      <th>Cashier</th><th>Approved By</th>
    </tr></thead>
    <tbody>${rowsHtml}</tbody>
    <tfoot><tr>
      <td colspan="6">TOTAL REDUCTION VALUE</td>
      <td style="text-align:right;color:#ef4444">-Rs. ${formatCurrency(totals.reductionValue)}</td>
      <td colspan="2">Overrides Count: ${totals.overrideCount}</td>
    </tr></tfoot>
  </table>
</body></html>`;

    const w = window.open('', '_blank', 'width=1100,height=700');
    if (!w) { setToast({ type: 'error', message: 'Pop-up blocked! Allow pop-ups to print.' }); return; }
    w.document.write(html);
    w.document.close();
    w.focus();
    w.onload = () => { w.print(); w.onafterprint = () => w.close(); };
  };

  /* ── export CSV ─────────────────────────────────────────────────────── */
  const handleExportCSV = () => {
    const cols = ['Timestamp','Invoice ID','Product','SKU','Original Price','Overridden Price','Variance','Variance %','Cashier','Approved By'];
    const lines = [cols.join(',')];
    filtered.forEach(r => {
      const diff = Number(r.OriginalPrice) - Number(r.OverriddenPrice);
      const pct = r.OriginalPrice > 0 ? (diff / r.OriginalPrice) * 100 : 0;
      lines.push([
        fmtDate(r.CreatedAt), `#SM-${r.OrderID}`, r.ProductName, r.SKU,
        parseFloat(r.OriginalPrice || 0).toFixed(2),
        parseFloat(r.OverriddenPrice || 0).toFixed(2),
        parseFloat(diff || 0).toFixed(2),
        `${pct.toFixed(1)}%`,
        r.CashierName,
        r.ManagerName || 'System Allowed'
      ].map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(','));
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `price-overrides-${startDate || 'all'}-to-${endDate || 'all'}.csv`;
    a.click();
  };

  const clearFilters = () => {
    setStartDate(nDaysAgo(30));
    setEndDate(today());
    setSearch('');
    setRows([]);
    setHasRun(false);
  };

  return (
    <div>
      {/* ── Filter Panel ─────────────────────────────────────────────── */}
      <div className="glass-panel" style={{ padding: '20px', marginBottom: '20px', position: 'relative', zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#f59e0b,#d97706)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 12px rgba(245,158,11,0.3)' }}>
              <ShieldAlert size={18} color="white" />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>Price Overrides Log</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Audit trail of cashier price modifications and approvals</div>
            </div>
          </div>
          <button onClick={clearFilters} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 13 }}>
            <X size={14} /> Clear Filters
          </button>
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>From Date</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Calendar size={14} style={{ position: 'absolute', left: 10, color: 'var(--text-muted)', pointerEvents: 'none' }} />
              <input type="date" className="form-input" value={startDate} onChange={e => setStartDate(e.target.value)}
                style={{ padding: '8px 12px 8px 32px', fontSize: 13, width: 170 }} />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>To Date</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Calendar size={14} style={{ position: 'absolute', left: 10, color: 'var(--text-muted)', pointerEvents: 'none' }} />
              <input type="date" className="form-input" value={endDate} onChange={e => setEndDate(e.target.value)}
                style={{ padding: '8px 12px 8px 32px', fontSize: 13, width: 170 }} />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
            {[['Today', 0], ['7D', 6], ['30D', 29], ['90D', 89], ['YTD', null]].map(([label, days]) => (
              <button key={label} onClick={() => {
                const t = today();
                if (label === 'YTD') {
                  setStartDate(new Date().getFullYear() + '-01-01');
                } else {
                  setStartDate(nDaysAgo(days));
                }
                setEndDate(t);
              }} style={{
                padding: '7px 12px', fontSize: 12, fontWeight: 600, borderRadius: 8, cursor: 'pointer',
                background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)',
                color: '#d97706', transition: 'all 0.15s'
              }}>{label}</button>
            ))}
          </div>

          <button className="btn btn-primary" onClick={runReport} disabled={loading}
            style={{ height: 40, padding: '0 24px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, alignSelf: 'flex-end', flexShrink: 0, background: 'var(--warning)', borderColor: 'var(--warning)' }}>
            {loading ? <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={16} />}
            {loading ? 'Running…' : 'Run Audit'}
          </button>
        </div>
      </div>

      {/* ── Summary Cards ─────────────────────────────────────────────── */}
      {hasRun && !loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 16, marginBottom: 20 }}>
          {[
            { label: 'Total Overridden Items', value: totals.overrideCount, color: '#f59e0b', icon: <ShieldAlert size={20} color="white" />, bg: 'linear-gradient(135deg,#f59e0b,#d97706)' },
            { label: 'Total Discount Variance', value: `Rs. ${formatCurrency(totals.reductionValue)}`, color: '#ef4444', icon: <TrendingDown size={20} color="white" />, bg: 'linear-gradient(135deg,#ef4444,#dc2626)' },
          ].map(card => (
            <div key={card.label} style={{
              background: 'var(--bg-surface)', border: '1px solid var(--border-color)',
              borderRadius: 14, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14
            }}>
              <div style={{ width: 42, height: 42, borderRadius: 10, background: card.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {card.icon}
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{card.label}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: card.color, fontFamily: 'var(--font-mono)', letterSpacing: '-0.5px' }}>{card.value}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Table Toolbar ─────────────────────────────────────────────── */}
      {hasRun && (
        <div className="glass-panel" style={{ padding: '14px 20px', marginBottom: 0, borderRadius: '14px 14px 0 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                <input className="form-input" placeholder="Search logs…" value={search} onChange={e => setSearch(e.target.value)}
                  style={{ padding: '7px 12px 7px 32px', fontSize: 13, width: 220 }} />
              </div>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                {filtered.length} <span style={{ color: 'var(--text-muted)' }}>overrides</span>
              </span>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary" onClick={handlePrintReport} disabled={!filtered.length}
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, padding: '7px 14px' }}>
                <Printer size={14} /> Print Report
              </button>
              <button className="btn btn-secondary" onClick={handleExportCSV} disabled={!filtered.length}
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, padding: '7px 14px' }}>
                <Download size={14} /> Export CSV
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Data Table ───────────────────────────────────────────────── */}
      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 60 }}>
          <RefreshCw size={28} color="var(--primary)" style={{ animation: 'spin 1s linear infinite' }} />
          <span style={{ marginLeft: 12, color: 'var(--text-secondary)' }}>Running audit report…</span>
        </div>
      )}

      {!loading && hasRun && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderTop: 'none', borderRadius: '0 0 14px 14px', overflow: 'hidden' }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
              <ShieldAlert size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
              <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 6 }}>No overrides recorded</div>
              <div style={{ fontSize: 13 }}>Adjust your filters and run the report again.</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="table-glass" style={{ minWidth: 900 }}>
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Invoice ID</th>
                    <th>Product</th>
                    <th>SKU</th>
                    <th>Original Price</th>
                    <th>Overridden Price</th>
                    <th style={{ textAlign: 'right', color: 'var(--danger)' }}>Variance</th>
                    <th>Cashier</th>
                    <th>Approved By</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((log, i) => {
                    const diff = Number(log.OriginalPrice) - Number(log.OverriddenPrice);
                    const pct = log.OriginalPrice > 0 ? (diff / log.OriginalPrice) * 100 : 0;
                    return (
                      <tr key={i} style={{ transition: 'background 0.12s' }}>
                        <td style={{ fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{fmtDate(log.CreatedAt)}</td>
                        <td>
                          <span 
                            onClick={() => log.OrderID && handleInvoiceClick(log.OrderID)}
                            style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 13, color: 'var(--primary)', cursor: 'pointer', textDecoration: 'underline' }}
                          >
                            #SM-{log.OrderID}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{log.ProductName}</div>
                        </td>
                        <td>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>{log.SKU}</span>
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)' }}>Rs. {formatCurrency(log.OriginalPrice)}</td>
                        <td style={{ fontFamily: 'var(--font-mono)', color: '#f59e0b', fontWeight: '600' }}>Rs. {formatCurrency(log.OverriddenPrice)}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: diff > 0 ? 'var(--danger)' : 'var(--success)', fontWeight: '700' }}>
                          {diff > 0 ? '-' : '+'}Rs. {formatCurrency(Math.abs(diff))} ({Math.abs(pct).toFixed(1)}%)
                        </td>
                        <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{log.CashierName || '—'}</td>
                        <td>
                          {log.ManagerName ? (
                            <span style={{
                              padding: '3px 8px',
                              borderRadius: '12px',
                              fontSize: '11px',
                              fontWeight: '700',
                              background: 'rgba(139, 92, 246, 0.15)',
                              color: '#a78bfa'
                            }}>
                              {log.ManagerName}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>System Allowed</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {!hasRun && !loading && (
        <div className="glass-panel" style={{ textAlign: 'center', padding: 64, color: 'var(--text-muted)' }}>
          <ShieldAlert size={48} style={{ opacity: 0.2, marginBottom: 16 }} />
          <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8, color: 'var(--text-secondary)' }}>Ready to Run</div>
          <div style={{ fontSize: 14 }}>Select your date range above and click <strong>Run Audit</strong> to view price override logs.</div>
        </div>
      )}

      {/* ── INVOICE DETAIL REPRINT MODAL ──────────────────────────────── */}
      {showInvoiceModal && activeOrder && (
        <div className="modal-overlay invoice-detail-modal-overlay">
          <div className="modal-content" style={{ width: '450px', background: '#f8fafc', color: '#0f172a' }}>
            <div className="receipt-wrapper printable-receipt-modal" style={{ padding: '10px 0' }}>
              <div className="receipt-header" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                {companyInfo?.LogoURL && (
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '4px' }}>
                    <img 
                      src={getCompanyLogoUrl(companyInfo.LogoURL)} 
                      alt="Company Logo" 
                      style={{ maxHeight: '50px', maxWidth: '180px', objectFit: 'contain' }} 
                    />
                  </div>
                )}
                <div className="receipt-title" style={{ textTransform: 'uppercase', fontSize: '14px', fontWeight: 'bold' }}>
                  {companyInfo?.Name || 'SELLMAX PRO'}
                </div>
                <div style={{ fontSize: '10.5px', color: '#475569', lineHeight: '1.4', textAlign: 'center' }}>
                  {companyInfo?.AddressLine1 && <div>{companyInfo.AddressLine1}</div>}
                  {companyInfo?.AddressLine2 && <div>{companyInfo.AddressLine2}</div>}
                  {(companyInfo?.City || companyInfo?.PostalCode) && (
                    <div>{companyInfo.City}{companyInfo.PostalCode ? `, ${companyInfo.PostalCode}` : ''}</div>
                  )}
                  {(companyInfo?.TelephoneNumber || companyInfo?.MobileNumber) && (
                    <div>Tel: {companyInfo.TelephoneNumber || companyInfo.MobileNumber}</div>
                  )}
                  {companyInfo?.Email && <div>Email: {companyInfo.Email}</div>}
                  {companyInfo?.Website && <div>{companyInfo.Website}</div>}
                </div>
              </div>

              <div className="receipt-details" style={{ margin: '14px 0', fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '2px', color: '#1e293b' }}>
                <div>INVOICE: #SM-{activeOrder.order.OrderID}</div>
                <div>DATE: {new Date(activeOrder.order.OrderDate).toLocaleString()}</div>
                <div>CASHIER: {activeOrder.order.Username}</div>
                <div>CUSTOMER: {activeOrder.order.CustomerName || 'Walk-in Customer'}</div>
              </div>

              <table className="receipt-items-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px', color: '#0f172a' }}>
                <thead>
                  <tr style={{ borderBottom: '1px dashed #475569' }}>
                    <th style={{ width: '55%', textAlign: 'left', padding: '4px 0' }}>ITEM</th>
                    <th style={{ width: '15%', textAlign: 'center', padding: '4px 0' }}>QTY</th>
                    <th style={{ width: '30%', textAlign: 'right', padding: '4px 0' }}>PRICE</th>
                  </tr>
                </thead>
                <tbody>
                  {activeOrder.items.map((item, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '6px 0' }}>
                        <div>{item.ProductName}</div>
                        {item.OriginalPrice && Number(item.OriginalPrice) !== Number(item.Price) && (
                          <div style={{ fontSize: '10px', color: '#64748b' }}>
                            Orig: <span style={{ textDecoration: 'line-through', color: '#d97706' }}>Rs. {formatCurrency(item.OriginalPrice)}</span>
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '6px 0', textAlign: 'center' }}>{Number(item.Quantity)} {item.UOM || 'pcs'}</td>
                      <td style={{ padding: '6px 0', textAlign: 'right' }}>Rs. {formatCurrency(item.Subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="receipt-summary-area" style={{ marginTop: '12px', fontSize: '11.5px', color: '#1e293b' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                  <span>Subtotal:</span>
                  <span>Rs. {formatCurrency(activeOrder.order.Subtotal)}</span>
                </div>
                {Number(activeOrder.order.DiscountAmount) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', color: 'var(--danger)' }}>
                    <span>Discount:</span>
                    <span>-Rs. {formatCurrency(activeOrder.order.DiscountAmount)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                  <span>Tax:</span>
                  <span>Rs. {formatCurrency(activeOrder.order.TaxAmount)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderTop: '1px dashed #475569', fontWeight: 'bold', fontSize: '13px', color: '#0f172a' }}>
                  <span>TOTAL:</span>
                  <span>Rs. {formatCurrency(activeOrder.order.TotalAmount)}</span>
                </div>
              </div>

              <div className="receipt-payments" style={{ marginTop: '12px', fontSize: '11px', color: '#475569', borderTop: '1px solid #e2e8f0', paddingTop: '8px' }}>
                {activeOrder.payments.map((p, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                    <span>Paid via {p.PaymentMethod}:</span>
                    <span>Rs. {formatCurrency(p.Amount)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px', borderTop: '1px solid #cbd5e1', paddingTop: '14px' }}>
              <button className="btn btn-secondary" style={{ padding: '8px 16px', color: '#475569', borderColor: '#cbd5e1' }} onClick={() => setShowInvoiceModal(false)}>Close</button>
              <button className="btn btn-primary" style={{ padding: '8px 16px', background: '#0f172a', borderColor: '#0f172a', color: '#fff' }} onClick={handlePrintReceipt}>Print Receipt</button>
            </div>
          </div>
        </div>
      )}

      {/* spin keyframe */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
