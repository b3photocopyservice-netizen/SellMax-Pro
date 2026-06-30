import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './contexts/AuthContext';
import formatCurrency from './utils/formatCurrency';
import {
  Search, Calendar, RefreshCw, Printer, Download,
  ArrowUpCircle, ArrowDownCircle, TrendingUp, TrendingDown,
  Filter, X, Package, ChevronDown, FileText, Eye, FileDown, FileSpreadsheet
} from 'lucide-react';
import PrintPreviewModal from './PrintPreviewModal';

/* ── colour mapping per transaction type ──────────────────────────────── */
const TX_META = {
  'Sale':            { color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   icon: '🛒', label: 'Sale'            },
  'Sales Return':    { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  icon: '↩️', label: 'Sales Return'    },
  'Purchase':        { color: '#10b981', bg: 'rgba(16,185,129,0.12)',  icon: '📦', label: 'Purchase'        },
  'Purchase Return': { color: '#6366f1', bg: 'rgba(99,102,241,0.12)', icon: '↪️', label: 'Purchase Return'  },
  'Stock Adjustment':{ color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)', icon: '⚙️', label: 'Stock Adjustment' },
};

const TX_TYPES = ['', 'Sale', 'Sales Return', 'Purchase', 'Purchase Return', 'Stock Adjustment'];

const fmtDate = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const fmtQty = (n) => {
  const v = parseFloat(n || 0);
  return v === 0 ? '—' : v % 1 === 0 ? v.toFixed(0) : v.toFixed(3);
};

const today = () => new Date().toISOString().split('T')[0];
const nDaysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
};

export default function StockMovementReport({ setToast }) {
  const { token, API_URL } = useAuth();

  /* ── filter state ──────────────────────────────────────────────────── */
  const [startDate, setStartDate] = useState(nDaysAgo(30));
  const [endDate,   setEndDate]   = useState(today());
  const [productId,  setProductId]  = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [txType,     setTxType]     = useState('');
  const [search,     setSearch]     = useState('');

  /* ── lookup lists ──────────────────────────────────────────────────── */
  const [products,   setProducts]   = useState([]);
  const [categories, setCategories] = useState([]);
  const [suppliers,  setSuppliers]  = useState([]);

  /* ── report data ───────────────────────────────────────────────────── */
  const [rows,    setRows]    = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasRun,  setHasRun]  = useState(false);

  // Print Preview configuration state
  const [previewConfig, setPreviewConfig] = useState({
    show: false,
    title: '',
    headers: [],
    rows: [],
    columnConfig: [],
    totalsRow: null,
    layoutPreset: 'landscape' // Stock movement has many columns, so landscape is optimal
  });
  const [companyInfo, setCompanyInfo] = useState(null);

  /* ── product search autocomplete ───────────────────────────────────── */
  const [prodSearch, setProdSearch] = useState('');
  const [showProdDD, setShowProdDD] = useState(false);
  const prodRef = useRef();

  useEffect(() => {
    fetchLookups();
    fetchCompanyInfo();
  }, []);

  const fetchCompanyInfo = async () => {
    try {
      const res = await fetch(`${API_URL}/api/company`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setCompanyInfo(await res.json());
      }
    } catch (err) {
      console.error('Failed to load company config:', err);
    }
  };

  const triggerReportAction = (actionType) => {
    const titleParts = [];
    if (selectedProd) titleParts.push(selectedProd.Name);
    if (startDate || endDate) titleParts.push(`${startDate || '—'} to ${endDate || '—'}`);
    const title = 'Stock Movement Report' + (titleParts.length ? ` (${titleParts.join(' | ')})` : '');

    const headers = ['Date', 'Reference No', 'Type', 'Description', 'Product Name', 'Party', 'Stock In', 'Stock Out', 'Running Balance'];
    const colConfig = [
      { align: 'left' },
      { align: 'left' },
      { align: 'left' },
      { align: 'left' },
      { align: 'left' },
      { align: 'left' },
      { align: 'right' },
      { align: 'right' },
      { align: 'right' }
    ];

    const rows = filtered.map(r => [
      new Date(r.TxDate).toLocaleDateString('en-LK'),
      r.RefNo || '—',
      r.TxType,
      r.Description || '—',
      r.ProductName,
      r.Party || '—',
      parseFloat(r.StockIn || 0),
      parseFloat(r.StockOut || 0),
      parseFloat(r.RunningBalance || 0)
    ]);

    const sumIn = filtered.reduce((sum, r) => sum + parseFloat(r.StockIn || 0), 0);
    const sumOut = filtered.reduce((sum, r) => sum + parseFloat(r.StockOut || 0), 0);
    const totalsRow = ['TOTAL', '', '', '', '', '', sumIn, sumOut, closingBalance];

    if (actionType === 'excel') {
      const csvRows = [];
      csvRows.push(`"${title.replace(/"/g, '""')}"`);
      csvRows.push(`"Print Date: ${new Date().toLocaleString()}"`);
      csvRows.push('');
      csvRows.push(headers.map(h => `"${h.replace(/"/g, '""')}"`).join(','));
      rows.forEach(r => csvRows.push(r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')));
      if (totalsRow.length > 0) csvRows.push(totalsRow.map(t => `"${String(t ?? '').replace(/"/g, '""')}"`).join(','));
      
      const blob = new Blob(["\uFEFF" + csvRows.join("\n")], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `${title.toLowerCase().replace(/[^a-z0-9]/g, '_')}_report.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
    else {
      setPreviewConfig({
        show: true,
        title,
        headers,
        rows,
        columnConfig: colConfig,
        totalsRow,
        layoutPreset: 'landscape'
      });
      if (actionType === 'print' || actionType === 'pdf') {
        setTimeout(() => {
          window.print();
        }, 300);
      }
    }
  };

  useEffect(() => {
    const handleClick = (e) => {
      if (prodRef.current && !prodRef.current.contains(e.target)) setShowProdDD(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const fetchLookups = async () => {
    try {
      const [catRes, supRes, prodRes] = await Promise.all([
        fetch(`${API_URL}/api/inventory/categories`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/api/suppliers`,            { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/api/inventory/products`,   { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (catRes.ok)  setCategories(await catRes.json());
      if (supRes.ok)  setSuppliers(await supRes.json());
      if (prodRes.ok) setProducts(await prodRes.json());
    } catch { /* silently ignore */ }
  };

  const runReport = useCallback(async () => {
    setLoading(true);
    setHasRun(true);
    try {
      let url = `${API_URL}/api/reports/stock-movement?t=${Date.now()}`;
      if (startDate)   url += `&startDate=${startDate}`;
      if (endDate)     url += `&endDate=${endDate}`;
      if (productId)   url += `&productId=${productId}`;
      if (categoryId)  url += `&categoryId=${categoryId}`;
      if (supplierId)  url += `&supplierId=${supplierId}`;
      if (txType)      url += `&transactionType=${encodeURIComponent(txType)}`;

      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to load report');
      setRows(await res.json());
    } catch (err) {
      setToast({ type: 'error', message: err.message });
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, productId, categoryId, supplierId, txType, token, API_URL]);

  /* ── filtered rows (client-side text search) ───────────────────────── */
  const filtered = rows.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (r.ProductName || '').toLowerCase().includes(q) ||
      (r.RefNo       || '').toLowerCase().includes(q) ||
      (r.Party       || '').toLowerCase().includes(q) ||
      (r.Description || '').toLowerCase().includes(q)
    );
  });

  /* ── summary totals ─────────────────────────────────────────────────── */
  const totals = filtered.reduce((acc, r) => {
    acc.stockIn  += parseFloat(r.StockIn  || 0);
    acc.stockOut += parseFloat(r.StockOut || 0);
    return acc;
  }, { stockIn: 0, stockOut: 0 });
  const closingBalance = filtered.length > 0 ? parseFloat(filtered[filtered.length - 1]?.RunningBalance || 0) : 0;
  const openingBalance = closingBalance - totals.stockIn + totals.stockOut;

  /* ── product search ──────────────────────────────────────────────────── */
  const filteredProds = products.filter(p =>
    !prodSearch || p.Name.toLowerCase().includes(prodSearch.toLowerCase()) || p.SKU.toLowerCase().includes(prodSearch.toLowerCase())
  ).slice(0, 30);
  const selectedProd = products.find(p => p.ProductID === parseInt(productId));

  /* ── print ───────────────────────────────────────────────────────────── */
  const handlePrint = () => {
    const titleParts = [];
    if (selectedProd) titleParts.push(selectedProd.Name);
    if (startDate || endDate) titleParts.push(`${startDate || '—'} to ${endDate || '—'}`);
    const title = titleParts.length ? titleParts.join(' | ') : 'All Products';

    const rowsHtml = filtered.map((r, i) => {
      const meta = TX_META[r.TxType] || TX_META['Sale'];
      return `
        <tr style="background:${i % 2 === 0 ? '#f8fafc' : '#fff'}">
          <td>${fmtDate(r.TxDate)}</td>
          <td style="font-weight:600">${r.RefNo || '—'}</td>
          <td><span style="background:${meta.bg};color:${meta.color};padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700">${r.TxType}</span></td>
          <td>${r.Description || '—'}</td>
          <td>${r.ProductName}</td>
          <td>${r.Party || '—'}</td>
          <td style="text-align:right;color:#10b981;font-weight:600">${fmtQty(r.StockIn)}</td>
          <td style="text-align:right;color:#ef4444;font-weight:600">${fmtQty(r.StockOut)}</td>
          <td style="text-align:right;font-weight:700">${parseFloat(r.RunningBalance || 0).toFixed(3)}</td>
        </tr>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Stock Movement Report</title>
<style>
  @page { size: A4 landscape; margin: 12mm; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #111; }
  h2 { margin: 0 0 4px; font-size: 16px; } p { margin: 0 0 12px; color:#555; font-size:11px; }
  table { width:100%; border-collapse:collapse; }
  th { background:#1e293b; color:#fff; padding:8px 10px; text-align:left; font-size:11px; }
  td { padding:6px 10px; border-bottom:1px solid #e2e8f0; font-size:11px; }
  tfoot td { background:#f1f5f9; font-weight:700; border-top:2px solid #1e293b; }
  .summary { display:flex; gap:24px; margin-bottom:12px; }
  .sum-box { padding:10px 16px; border-radius:6px; }
</style></head><body>
  <h2>Stock Movement Report</h2>
  <p>${title}</p>
  <div class="summary">
    <div class="sum-box" style="background:#f0fdf4;border:1px solid #bbf7d0">Opening Balance: <strong>${openingBalance.toFixed(3)}</strong></div>
    <div class="sum-box" style="background:#f0fdf4;border:1px solid #bbf7d0">Total Stock In: <strong>${totals.stockIn.toFixed(3)}</strong></div>
    <div class="sum-box" style="background:#fef2f2;border:1px solid #fecaca">Total Stock Out: <strong>${totals.stockOut.toFixed(3)}</strong></div>
    <div class="sum-box" style="background:#eff6ff;border:1px solid #bfdbfe">Closing Balance: <strong>${closingBalance.toFixed(3)}</strong></div>
  </div>
  <table>
    <thead><tr>
      <th>Date</th><th>Invoice/Receipt No</th><th>Type</th><th>Description</th>
      <th>Product</th><th>Supplier/Customer</th>
      <th style="text-align:right">Stock In</th>
      <th style="text-align:right">Stock Out</th>
      <th style="text-align:right">Balance</th>
    </tr></thead>
    <tbody>${rowsHtml}</tbody>
    <tfoot><tr>
      <td colspan="6">TOTALS</td>
      <td style="text-align:right;color:#10b981">${totals.stockIn.toFixed(3)}</td>
      <td style="text-align:right;color:#ef4444">${totals.stockOut.toFixed(3)}</td>
      <td style="text-align:right">${closingBalance.toFixed(3)}</td>
    </tr></tfoot>
  </table>
  <p style="margin-top:12px;color:#888">Generated: ${new Date().toLocaleString()} | SellMax Pro POS</p>
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
    const cols = ['Date','Invoice/Receipt No','Type','Description','Product','SKU','Category','Supplier/Customer','Warehouse','Stock In','Stock Out','Running Balance'];
    const lines = [cols.join(',')];
    filtered.forEach(r => {
      lines.push([
        fmtDate(r.TxDate), r.RefNo, r.TxType, r.Description, r.ProductName, r.SKU,
        r.CategoryName, r.Party, r.WarehouseName || '',
        parseFloat(r.StockIn || 0).toFixed(3),
        parseFloat(r.StockOut || 0).toFixed(3),
        parseFloat(r.RunningBalance || 0).toFixed(3)
      ].map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(','));
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `stock-movement-${startDate || 'all'}-to-${endDate || 'all'}.csv`;
    a.click();
  };

  const clearFilters = () => {
    setStartDate(nDaysAgo(30));
    setEndDate(today());
    setProductId('');
    setProdSearch('');
    setCategoryId('');
    setSupplierId('');
    setTxType('');
    setSearch('');
    setRows([]);
    setHasRun(false);
  };

  /* ── render ─────────────────────────────────────────────────────────── */
  return (
    <div>
      {/* ── Filter Panel ─────────────────────────────────────────────── */}
      <div className="glass-panel" style={{ padding: '20px', marginBottom: '20px', position: 'relative', zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#8b5cf6,#6d28d9)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 12px rgba(139,92,246,0.3)' }}>
              <TrendingUp size={18} color="white" />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>Stock Movement Report</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Complete transaction history with running balance</div>
            </div>
          </div>
          <button onClick={clearFilters} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 13 }}>
            <X size={14} /> Clear Filters
          </button>
        </div>

        {/* Row 1: Dates */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
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

          {/* Quick presets */}
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
                background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.15)',
                color: 'var(--primary)', transition: 'all 0.15s'
              }}>{label}</button>
            ))}
          </div>
        </div>

        {/* Row 2: Product / Category / Supplier / Type */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          {/* Product search dropdown */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 220px', maxWidth: 280 }} ref={prodRef}>
            <label style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Product</label>
            <div style={{ position: 'relative' }}>
              <Package size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none', zIndex: 1 }} />
              <input
                className="form-input"
                placeholder={selectedProd ? selectedProd.Name : 'Search product…'}
                value={prodSearch}
                onChange={e => { setProdSearch(e.target.value); setShowProdDD(true); if (!e.target.value) { setProductId(''); } }}
                onFocus={() => setShowProdDD(true)}
                style={{ padding: '8px 12px 8px 32px', fontSize: 13, width: '100%',
                  border: productId ? '1px solid var(--primary)' : undefined }}
              />
              {productId && (
                <button onClick={() => { setProductId(''); setProdSearch(''); }} style={{
                  position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)'
                }}><X size={14} /></button>
              )}
              {showProdDD && filteredProds.length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 999,
                  background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-color)',
                  borderRadius: 10, maxHeight: 220, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
                  marginTop: 4
                }}>
                  <div className="search-item-hover" onClick={() => { setProductId(''); setProdSearch(''); setShowProdDD(false); }}
                    style={{ padding: '9px 14px', fontSize: 13, cursor: 'pointer', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)' }}>
                    All Products
                  </div>
                  {filteredProds.map(p => (
                    <div key={p.ProductID} className="search-item-hover"
                      onClick={() => { setProductId(String(p.ProductID)); setProdSearch(p.Name); setShowProdDD(false); }}
                      style={{ padding: '9px 14px', fontSize: 13, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600 }}>{p.Name}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.SKU}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Category */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 160px', maxWidth: 200 }}>
            <label style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Category</label>
            <select className="form-select" value={categoryId} onChange={e => setCategoryId(e.target.value)}
              style={{ padding: '8px 12px', fontSize: 13 }}>
              <option value="">All Categories</option>
              {categories.map(c => <option key={c.CategoryID} value={c.CategoryID}>{c.Name}</option>)}
            </select>
          </div>

          {/* Supplier */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 180px', maxWidth: 220 }}>
            <label style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Supplier</label>
            <select className="form-select" value={supplierId} onChange={e => setSupplierId(e.target.value)}
              style={{ padding: '8px 12px', fontSize: 13 }}>
              <option value="">All Suppliers</option>
              {suppliers.map(s => <option key={s.SupplierID} value={s.SupplierID}>{s.SupplierName}</option>)}
            </select>
          </div>

          {/* Transaction Type */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 170px', maxWidth: 200 }}>
            <label style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Transaction Type</label>
            <select className="form-select" value={txType} onChange={e => setTxType(e.target.value)}
              style={{ padding: '8px 12px', fontSize: 13 }}>
              <option value="">All Types</option>
              {TX_TYPES.filter(Boolean).map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {/* Run button */}
          <button className="btn btn-primary" onClick={runReport} disabled={loading}
            style={{ height: 40, padding: '0 24px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, alignSelf: 'flex-end', flexShrink: 0 }}>
            {loading ? <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Filter size={16} />}
            {loading ? 'Running…' : 'Run Report'}
          </button>
        </div>
      </div>

      {/* ── Summary Cards ─────────────────────────────────────────────── */}
      {hasRun && !loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 16, marginBottom: 20 }}>
          {[
            { label: 'Opening Balance', value: openingBalance.toFixed(3), color: '#8b5cf6', icon: <Package size={20} color="white" />, bg: 'linear-gradient(135deg,#8b5cf6,#6d28d9)' },
            { label: 'Total Stock In',  value: totals.stockIn.toFixed(3),  color: '#10b981', icon: <ArrowUpCircle size={20} color="white" />, bg: 'linear-gradient(135deg,#10b981,#059669)' },
            { label: 'Total Stock Out', value: totals.stockOut.toFixed(3), color: '#ef4444', icon: <ArrowDownCircle size={20} color="white" />, bg: 'linear-gradient(135deg,#ef4444,#dc2626)' },
            { label: 'Closing Balance', value: closingBalance.toFixed(3),  color: '#06b6d4', icon: <TrendingUp size={20} color="white" />, bg: 'linear-gradient(135deg,#06b6d4,#0891b2)' },
            { label: 'Transactions',    value: filtered.length,            color: '#f59e0b', icon: <FileText size={20} color="white" />, bg: 'linear-gradient(135deg,#f59e0b,#d97706)' },
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
                <input className="form-input" placeholder="Search in results…" value={search} onChange={e => setSearch(e.target.value)}
                  style={{ padding: '7px 12px 7px 32px', fontSize: 13, width: 220 }} />
              </div>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                {filtered.length} <span style={{ color: 'var(--text-muted)' }}>transaction{filtered.length !== 1 ? 's' : ''}</span>
              </span>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary" onClick={() => triggerReportAction('preview')} disabled={!filtered.length}
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, padding: '7px 14px' }}>
                <Eye size={14} /> Preview
              </button>
              <button className="btn btn-secondary" onClick={() => triggerReportAction('print')} disabled={!filtered.length}
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, padding: '7px 14px' }}>
                <Printer size={14} /> Print
              </button>
              <button className="btn btn-secondary" onClick={() => triggerReportAction('pdf')} disabled={!filtered.length}
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, padding: '7px 14px' }}>
                <FileDown size={14} /> PDF
              </button>
              <button className="btn btn-secondary" onClick={() => triggerReportAction('excel')} disabled={!filtered.length}
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, padding: '7px 14px' }}>
                <FileSpreadsheet size={14} /> Excel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Data Table ───────────────────────────────────────────────── */}
      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 60 }}>
          <RefreshCw size={28} color="var(--primary)" style={{ animation: 'spin 1s linear infinite' }} />
          <span style={{ marginLeft: 12, color: 'var(--text-secondary)' }}>Running report…</span>
        </div>
      )}

      {!loading && hasRun && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderTop: 'none', borderRadius: '0 0 14px 14px', overflow: 'hidden' }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
              <Package size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
              <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 6 }}>No transactions found</div>
              <div style={{ fontSize: 13 }}>Adjust the filters above and run the report again.</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="table-glass" style={{ minWidth: 900 }}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Invoice / Receipt No</th>
                    <th>Type</th>
                    <th>Description</th>
                    <th>Product</th>
                    <th>Supplier / Customer</th>
                    <th style={{ textAlign: 'right', color: '#10b981' }}>Stock In</th>
                    <th style={{ textAlign: 'right', color: '#ef4444' }}>Stock Out</th>
                    <th style={{ textAlign: 'right' }}>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r, i) => {
                    const meta = TX_META[r.TxType] || TX_META['Sale'];
                    const stockIn  = parseFloat(r.StockIn  || 0);
                    const stockOut = parseFloat(r.StockOut || 0);
                    const balance  = parseFloat(r.RunningBalance || 0);
                    return (
                      <tr key={i} style={{ transition: 'background 0.12s' }}>
                        <td style={{ fontSize: 13, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{fmtDate(r.TxDate)}</td>
                        <td>
                          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>
                            {r.RefNo || '—'}
                          </span>
                        </td>
                        <td>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 5,
                            padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                            background: meta.bg, color: meta.color, whiteSpace: 'nowrap'
                          }}>
                            {meta.icon} {r.TxType}
                          </span>
                        </td>
                        <td style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {r.Description || '—'}
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{r.ProductName}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.SKU} {r.UOM ? `· ${r.UOM}` : ''}</div>
                        </td>
                        <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{r.Party || '—'}</td>
                        <td style={{ textAlign: 'right' }}>
                          {stockIn > 0 ? (
                            <span style={{ color: '#10b981', fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: 14 }}>
                              +{fmtQty(stockIn)}
                            </span>
                          ) : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {stockOut > 0 ? (
                            <span style={{ color: '#ef4444', fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: 14 }}>
                              -{fmtQty(stockOut)}
                            </span>
                          ) : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <span style={{
                            fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: 14,
                            color: balance < 0 ? '#ef4444' : balance === 0 ? 'var(--text-muted)' : 'var(--text-primary)'
                          }}>
                            {balance.toFixed(3)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background: 'rgba(139,92,246,0.06)', borderTop: '2px solid var(--border-color)' }}>
                    <td colSpan={6} style={{ padding: '14px 20px', fontWeight: 700, fontSize: 13, color: 'var(--text-secondary)' }}>
                      PERIOD TOTALS — {filtered.length} transactions
                    </td>
                    <td style={{ textAlign: 'right', padding: '14px 20px', color: '#10b981', fontWeight: 800, fontFamily: 'var(--font-mono)', fontSize: 15 }}>
                      +{totals.stockIn.toFixed(3)}
                    </td>
                    <td style={{ textAlign: 'right', padding: '14px 20px', color: '#ef4444', fontWeight: 800, fontFamily: 'var(--font-mono)', fontSize: 15 }}>
                      -{totals.stockOut.toFixed(3)}
                    </td>
                    <td style={{ textAlign: 'right', padding: '14px 20px', fontWeight: 800, fontFamily: 'var(--font-mono)', fontSize: 15, color: closingBalance < 0 ? '#ef4444' : 'var(--text-primary)' }}>
                      {closingBalance.toFixed(3)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {!hasRun && !loading && (
        <div className="glass-panel" style={{ textAlign: 'center', padding: 64, color: 'var(--text-muted)' }}>
          <TrendingUp size={48} style={{ opacity: 0.2, marginBottom: 16 }} />
          <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8, color: 'var(--text-secondary)' }}>Ready to Run</div>
          <div style={{ fontSize: 14 }}>Select your filters above and click <strong>Run Report</strong> to see the stock movement history.</div>
        </div>
      )}

      <PrintPreviewModal 
        show={previewConfig.show}
        onClose={() => setPreviewConfig(prev => ({ ...prev, show: false }))}
        title={previewConfig.title}
        companyInfo={companyInfo}
        filters={{
          'Product context': selectedProd ? selectedProd.Name : 'All Products',
          'Period': startDate && endDate ? `${startDate} to ${endDate}` : 'All-time',
          'Category filter': categories.find(c => String(c.CategoryID) === String(categoryId))?.Name || 'All Categories',
          'Supplier filter': suppliers.find(s => String(s.SupplierID) === String(supplierId))?.SupplierName || 'All Suppliers',
          'Transaction type': txType || 'All Types'
        }}
        headers={previewConfig.headers}
        rows={previewConfig.rows}
        columnConfig={previewConfig.columnConfig}
        totalsRow={previewConfig.totalsRow}
        layoutPreset={previewConfig.layoutPreset}
      />

      {/* spin keyframe */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
