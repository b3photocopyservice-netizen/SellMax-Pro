import React, { useState, useEffect, useCallback } from 'react';
import formatCurrency from './utils/formatCurrency';
import { useAuth } from './contexts/AuthContext';
import {
  Plus, Search, RefreshCw, Check, X, Eye, Printer,
  AlertTriangle, ChevronDown, ChevronUp, BarChart2,
  FileText, Users, Calendar, ArrowUpCircle, ArrowDownCircle,
  ClipboardList, CheckCircle, XCircle, Clock
} from 'lucide-react';

const REASONS = ['Physical Count', 'Damage', 'Loss', 'Expiry', 'Stock Correction', 'Other'];

const STATUS_COLORS = {
  Draft: { bg: 'rgba(234, 179, 8, 0.15)', color: '#fbbf24' },
  Approved: { bg: 'rgba(34, 197, 94, 0.15)', color: '#4ade80' },
  Cancelled: { bg: 'rgba(239, 68, 68, 0.15)', color: '#f87171' },
};

const today = () => new Date().toISOString().split('T')[0];

export default function InventoryAdjustments({ setToast, products = [] }) {
  const { token, API_URL, hasPermission, user } = useAuth();
  const canManage = hasPermission('MANAGE_INVENTORY');
  const canApprove = ['Super Admin', 'Company Admin', 'Manager'].includes(user?.roleName) || canManage;

  // ── View State ──────────────────────────────────────────────────────────
  const [view, setView] = useState('list'); // 'list' | 'new' | 'detail' | 'reports'
  const [reportTab, setReportTab] = useState('summary'); // 'summary' | 'product' | 'users'

  // ── List State ──────────────────────────────────────────────────────────
  const [adjustments, setAdjustments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: 'all', startDate: '', endDate: '', search: '' });

  // ── Form State ──────────────────────────────────────────────────────────
  const [formDate, setFormDate] = useState(today());
  const [formRemarks, setFormRemarks] = useState('');
  const [formItems, setFormItems] = useState([]);
  const [productSearch, setProductSearch] = useState('');
  const [saving, setSaving] = useState(false);

  // ── Detail State ─────────────────────────────────────────────────────────
  const [selectedAdj, setSelectedAdj] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [approving, setApproving] = useState(false);

  // ── Report State ─────────────────────────────────────────────────────────
  const [reportData, setReportData] = useState([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportFilters, setReportFilters] = useState({ productId: '', startDate: '', endDate: '' });

  // ── Fetch Adjustments List ───────────────────────────────────────────────
  const fetchAdjustments = useCallback(async () => {
    if (!canManage) return;
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.status !== 'all') params.set('status', filters.status);
      if (filters.startDate) params.set('startDate', filters.startDate);
      if (filters.endDate) params.set('endDate', filters.endDate);
      if (filters.search) params.set('search', filters.search);

      const res = await fetch(`${API_URL}/api/inventory/adjustments?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setAdjustments(await res.json());
    } catch (err) {
      console.error('Failed to fetch adjustments:', err);
    } finally { setLoading(false); }
  }, [API_URL, token, canManage, filters]);

  useEffect(() => { if (view === 'list') fetchAdjustments(); }, [view, fetchAdjustments]);

  // ── Fetch Detail ─────────────────────────────────────────────────────────
  const fetchDetail = async (id) => {
    try {
      setDetailLoading(true);
      const res = await fetch(`${API_URL}/api/inventory/adjustments/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setSelectedAdj(await res.json());
        setView('detail');
      }
    } catch (err) {
      setToast({ type: 'error', message: 'Failed to load adjustment details.' });
    } finally { setDetailLoading(false); }
  };

  // ── Fetch Reports ─────────────────────────────────────────────────────────
  const fetchReport = async (type) => {
    try {
      setReportLoading(true);
      const params = new URLSearchParams();
      if (reportFilters.startDate) params.set('startDate', reportFilters.startDate);
      if (reportFilters.endDate) params.set('endDate', reportFilters.endDate);
      if (type === 'product' && reportFilters.productId) params.set('productId', reportFilters.productId);

      const res = await fetch(`${API_URL}/api/inventory/adjustments/report/${type}?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setReportData(await res.json());
    } catch (err) {
      setToast({ type: 'error', message: 'Failed to load report.' });
    } finally { setReportLoading(false); }
  };

  useEffect(() => {
    if (view === 'reports') fetchReport(reportTab);
  }, [view, reportTab, reportFilters]);

  // ── Add Item to Form ─────────────────────────────────────────────────────
  const addItem = (product) => {
    if (formItems.find(i => i.productId === product.ProductID)) {
      setToast({ type: 'error', message: `${product.Name} is already in the list.` });
      return;
    }
    setFormItems(prev => [...prev, {
      productId: product.ProductID,
      productName: product.Name,
      sku: product.SKU,
      uom: product.UOM,
      currentStock: parseFloat(product.Stock),
      adjustedQty: '',
      costPrice: parseFloat(product.Cost),
      reason: 'Physical Count'
    }]);
    setProductSearch('');
  };

  const removeItem = (productId) => {
    setFormItems(prev => prev.filter(i => i.productId !== productId));
  };

  const updateItem = (productId, field, value) => {
    setFormItems(prev => prev.map(i => i.productId === productId ? { ...i, [field]: value } : i));
  };

  // ── Save Draft ────────────────────────────────────────────────────────────
  const handleSaveDraft = async () => {
    if (!canManage) return;
    if (formItems.length === 0) {
      setToast({ type: 'error', message: 'Add at least one product to adjust.' });
      return;
    }
    for (const item of formItems) {
      if (item.adjustedQty === '' || item.adjustedQty === null || parseFloat(item.adjustedQty) === 0) {
        setToast({ type: 'error', message: `Enter a non-zero adjustment quantity for ${item.productName}.` });
        return;
      }
    }

    try {
      setSaving(true);
      const res = await fetch(`${API_URL}/api/inventory/adjustments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          adjustmentDate: formDate,
          remarks: formRemarks,
          items: formItems.map(i => ({
            productId: i.productId,
            adjustedQty: parseFloat(i.adjustedQty),
            reason: i.reason,
            currentStock: i.currentStock,
            costPrice: i.costPrice
          }))
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save adjustment.');
      setToast({ type: 'success', message: `Adjustment ${data.ReferenceNo} saved as Draft.` });
      setView('list');
      resetForm();
    } catch (err) {
      setToast({ type: 'error', message: err.message });
    } finally { setSaving(false); }
  };

  const resetForm = () => {
    setFormDate(today());
    setFormRemarks('');
    setFormItems([]);
    setProductSearch('');
  };

  // ── Approve ───────────────────────────────────────────────────────────────
  const handleApprove = async (id) => {
    if (!canApprove) return;
    if (!window.confirm('Approve this adjustment? Stock quantities and journal entries will be updated.')) return;
    try {
      setApproving(true);
      const res = await fetch(`${API_URL}/api/inventory/adjustments/${id}/approve`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Approval failed.');
      setToast({ type: 'success', message: `Adjustment ${data.ReferenceNo} approved! Stock updated.` });
      setSelectedAdj(data);
      fetchAdjustments();
    } catch (err) {
      setToast({ type: 'error', message: err.message });
    } finally { setApproving(false); }
  };

  // ── Cancel ────────────────────────────────────────────────────────────────
  const handleCancel = async (id) => {
    if (!canManage) return;
    if (!window.confirm('Cancel this adjustment? This action cannot be undone.')) return;
    try {
      const res = await fetch(`${API_URL}/api/inventory/adjustments/${id}/cancel`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Cancel failed.');
      setToast({ type: 'success', message: `Adjustment ${data.ReferenceNo} cancelled.` });
      if (view === 'detail') setSelectedAdj(data);
      fetchAdjustments();
    } catch (err) {
      setToast({ type: 'error', message: err.message });
    }
  };

  // ── Print ─────────────────────────────────────────────────────────────────
  const handlePrint = (adj) => {
    if (!adj) return;
    const win = window.open('', '_blank');
    const items = adj.Items || [];
    const totalValue = items.reduce((s, i) => s + i.AdjustedQty * i.CostPrice, 0);
    win.document.write(`
      <html><head><title>Inventory Adjustment - ${adj.ReferenceNo}</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 12px; color: #111; margin: 24px; }
        h2 { margin: 0 0 4px; font-size: 18px; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        th, td { border: 1px solid #ccc; padding: 6px 10px; text-align: left; }
        th { background: #f0f0f0; font-weight: bold; }
        .header-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 12px 0; }
        .label { color: #666; font-size: 11px; }
        .value { font-weight: bold; }
        .positive { color: #16a34a; }
        .negative { color: #dc2626; }
        .footer { margin-top: 24px; border-top: 1px solid #ccc; padding-top: 12px; font-size: 11px; color: #666; }
        @media print { body { margin: 0; } }
      </style></head><body>
      <h2>Inventory Adjustment Report</h2>
      <div class="header-grid">
        <div><div class="label">Reference No.</div><div class="value">${adj.ReferenceNo}</div></div>
        <div><div class="label">Date</div><div class="value">${new Date(adj.AdjustmentDate).toLocaleDateString()}</div></div>
        <div><div class="label">Status</div><div class="value">${adj.Status}</div></div>
        <div><div class="label">Created By</div><div class="value">${adj.CreatedByName}</div></div>
        ${adj.ApprovedByName ? `<div><div class="label">Approved By</div><div class="value">${adj.ApprovedByName}</div></div>` : ''}
        ${adj.Remarks ? `<div><div class="label">Remarks</div><div class="value">${adj.Remarks}</div></div>` : ''}
      </div>
      <table>
        <thead><tr>
          <th>Product</th><th>SKU</th><th>UOM</th>
          <th>Current Stock</th><th>Adjustment</th><th>New Stock</th>
          <th>Cost Price</th><th>Value</th><th>Reason</th>
        </tr></thead>
        <tbody>
          ${items.map(i => `<tr>
            <td>${i.ProductName}</td>
            <td>${i.SKU}</td>
            <td>${i.UOM}</td>
            <td>${Number(i.CurrentStock)}</td>
            <td class="${i.AdjustedQty > 0 ? 'positive' : 'negative'}">${i.AdjustedQty > 0 ? '+' : ''}${Number(i.AdjustedQty)}</td>
            <td><strong>${(Number(i.CurrentStock) + Number(i.AdjustedQty)).toFixed(3)}</strong></td>
            <td>${parseFloat(i.CostPrice).toFixed(2)}</td>
            <td class="${(i.AdjustedQty * i.CostPrice) >= 0 ? 'positive' : 'negative'}">${(i.AdjustedQty * i.CostPrice).toFixed(2)}</td>
            <td>${i.Reason}</td>
          </tr>`).join('')}
        </tbody>
        <tfoot>
          <tr><td colspan="7" style="text-align:right;font-weight:bold;">Net Adjustment Value:</td>
          <td colspan="2" class="${totalValue >= 0 ? 'positive' : 'negative'}"><strong>${totalValue.toFixed(2)}</strong></td></tr>
        </tfoot>
      </table>
      <div class="footer">Printed on ${new Date().toLocaleString()} | SellMax Pro Inventory Management</div>
      </body></html>
    `);
    win.document.close();
    win.print();
  };

  // ── Filtered products for search ─────────────────────────────────────────
  const filteredProducts = products.filter(p =>
    p.IsActive &&
    (p.Name.toLowerCase().includes(productSearch.toLowerCase()) ||
     p.SKU.toLowerCase().includes(productSearch.toLowerCase()))
  ).slice(0, 8);

  // ────────────────────────────────────────────────────────────────────────────
  // RENDER: LIST
  // ────────────────────────────────────────────────────────────────────────────
  if (view === 'list') {
    return (
      <div>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: '700', margin: 0 }}>Inventory Adjustments</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Correct stock quantities and post accounting entries for variances
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-secondary" onClick={() => { setView('reports'); setReportTab('summary'); }}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
              <BarChart2 size={14} /> Reports
            </button>
            {canManage && (
              <button className="btn btn-primary" onClick={() => { resetForm(); setView('new'); }}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                <Plus size={14} /> New Adjustment
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1', minWidth: '200px' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input type="text" className="form-input" style={{ paddingLeft: '32px', fontSize: '13px', height: '36px' }}
              placeholder="Search by ref. no. or user..." value={filters.search}
              onChange={e => setFilters(f => ({ ...f, search: e.target.value }))} />
          </div>
          <select className="form-select" style={{ height: '36px', fontSize: '13px', width: '140px', padding: '0 12px' }}
            value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}>
            <option value="all">All Status</option>
            <option value="Draft">Draft</option>
            <option value="Approved">Approved</option>
            <option value="Cancelled">Cancelled</option>
          </select>
          <input type="date" className="form-input" style={{ height: '36px', fontSize: '13px', width: '140px', padding: '0 12px' }}
            value={filters.startDate} onChange={e => setFilters(f => ({ ...f, startDate: e.target.value }))} />
          <input type="date" className="form-input" style={{ height: '36px', fontSize: '13px', width: '140px', padding: '0 12px' }}
            value={filters.endDate} onChange={e => setFilters(f => ({ ...f, endDate: e.target.value }))} />
          <button className="btn btn-secondary" onClick={fetchAdjustments} style={{ height: '36px', width: '36px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <RefreshCw size={14} />
          </button>
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
            <RefreshCw size={24} style={{ color: 'var(--primary)', animation: 'spin 1.5s linear infinite' }} />
          </div>
        ) : (
          <div className="glass-panel" style={{ padding: 0 }}>
            <div className="table-container">
              <table className="table-glass">
                <thead>
                  <tr>
                    <th>Reference No.</th>
                    <th>Date</th>
                    <th>Items</th>
                    <th>Total Value</th>
                    <th>Status</th>
                    <th>Created By</th>
                    <th>Approved By</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {adjustments.length === 0 ? (
                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                      No adjustments found. {canManage && <span>Click <strong>New Adjustment</strong> to get started.</span>}
                    </td></tr>
                  ) : adjustments.map(adj => {
                    const sc = STATUS_COLORS[adj.Status] || STATUS_COLORS.Draft;
                    return (
                      <tr key={adj.AdjustmentID}>
                        <td>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: '700', color: 'var(--primary)' }}>
                            {adj.ReferenceNo}
                          </span>
                        </td>
                        <td style={{ fontSize: '13px' }}>{new Date(adj.AdjustmentDate).toLocaleDateString()}</td>
                        <td style={{ fontWeight: '600' }}>{adj.ItemCount}</td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: '13px' }}>
                          {formatCurrency(parseFloat(adj.TotalValue || 0))}
                        </td>
                        <td>
                          <span style={{ padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '700', background: sc.bg, color: sc.color }}>
                            {adj.Status}
                          </span>
                        </td>
                        <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{adj.CreatedByName}</td>
                        <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{adj.ApprovedByName || '—'}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '12px' }}
                              onClick={() => fetchDetail(adj.AdjustmentID)}>
                              <Eye size={12} />
                            </button>
                            {adj.Status === 'Draft' && canApprove && (
                              <button className="btn btn-primary" style={{ padding: '4px 10px', fontSize: '12px' }}
                                onClick={() => handleApprove(adj.AdjustmentID)}>
                                <Check size={12} />
                              </button>
                            )}
                            {adj.Status === 'Draft' && canManage && (
                              <button className="btn btn-danger" style={{ padding: '4px 10px', fontSize: '12px' }}
                                onClick={() => handleCancel(adj.AdjustmentID)}>
                                <X size={12} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // RENDER: NEW ADJUSTMENT FORM
  // ────────────────────────────────────────────────────────────────────────────
  if (view === 'new') {
    const totals = formItems.reduce((acc, i) => {
      const val = (parseFloat(i.adjustedQty) || 0) * i.costPrice;
      if (val > 0) acc.positive += val;
      else acc.negative += Math.abs(val);
      acc.net += val;
      return acc;
    }, { positive: 0, negative: 0, net: 0 });

    return (
      <div>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: '700', margin: 0 }}>New Inventory Adjustment</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Reference will be auto-generated on save
            </p>
          </div>
          <button className="btn btn-secondary" onClick={() => { setView('list'); resetForm(); }}>
            <X size={14} /> Cancel
          </button>
        </div>

        {/* Form Header Fields */}
        <div className="glass-panel" style={{ marginBottom: '16px', padding: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: '16px' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Adjustment Date *</label>
              <input type="date" className="form-input" value={formDate}
                onChange={e => setFormDate(e.target.value)} required />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Reference No.</label>
              <input type="text" className="form-input" value="Auto-Generated" disabled style={{ opacity: 0.5 }} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Remarks / Notes</label>
              <input type="text" className="form-input" placeholder="Optional notes about this adjustment..."
                value={formRemarks} onChange={e => setFormRemarks(e.target.value)} />
            </div>
          </div>
        </div>

        {/* Product Search & Add */}
        <div className="glass-panel" style={{ marginBottom: '16px', padding: '16px' }}>
          <label className="form-label" style={{ marginBottom: '8px', display: 'block', fontWeight: '700' }}>
            Add Products to Adjust
          </label>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', zIndex: 1 }} />
            <input type="text" className="form-input" style={{ paddingLeft: '32px' }}
              placeholder="Search product by name or SKU to add..."
              value={productSearch} onChange={e => setProductSearch(e.target.value)} />
            {productSearch && filteredProducts.length > 0 && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                background: 'var(--surface-raised)', border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)',
                maxHeight: '240px', overflowY: 'auto', marginTop: '4px'
              }}>
                {filteredProducts.map(p => (
                  <div key={p.ProductID}
                    onClick={() => addItem(p)}
                    style={{ padding: '10px 14px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--hover-bg)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <div>
                      <div style={{ fontWeight: '600', fontSize: '13px' }}>{p.Name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{p.SKU} • Stock: {Number(p.Stock)} {p.UOM}</div>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Cost: {formatCurrency(p.Cost)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Items Table */}
        {formItems.length > 0 && (
          <div className="glass-panel" style={{ marginBottom: '16px', padding: 0 }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="table-glass" style={{ minWidth: '900px' }}>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Current Stock</th>
                    <th style={{ width: '130px' }}>Adjustment Qty</th>
                    <th>New Stock</th>
                    <th>Cost Price</th>
                    <th>Adj. Value</th>
                    <th style={{ width: '160px' }}>Reason</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {formItems.map(item => {
                    const adjQty = parseFloat(item.adjustedQty) || 0;
                    const newStock = item.currentStock + adjQty;
                    const adjValue = adjQty * item.costPrice;
                    return (
                      <tr key={item.productId}>
                        <td>
                          <div style={{ fontWeight: '600', fontSize: '13px' }}>{item.productName}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{item.sku}</div>
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontWeight: '600' }}>
                          {item.currentStock} <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{item.uom}</span>
                        </td>
                        <td>
                          <input
                            type="number"
                            className="form-input"
                            style={{ textAlign: 'center', fontSize: '13px', padding: '6px 8px', fontWeight: '700',
                              color: adjQty > 0 ? '#4ade80' : adjQty < 0 ? '#f87171' : 'inherit' }}
                            placeholder="e.g. -5 or +3"
                            value={item.adjustedQty}
                            onChange={e => updateItem(item.productId, 'adjustedQty', e.target.value)}
                          />
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontWeight: '700',
                          color: newStock < 0 ? '#f87171' : newStock === 0 ? '#fbbf24' : '#4ade80' }}>
                          {newStock.toFixed(3)}
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: '13px' }}>
                          {formatCurrency(item.costPrice)}
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: '700',
                          color: adjValue > 0 ? '#4ade80' : adjValue < 0 ? '#f87171' : 'inherit' }}>
                          {adjValue !== 0 ? (adjValue > 0 ? '+' : '') + formatCurrency(adjValue) : '—'}
                        </td>
                        <td>
                          <select className="form-input" style={{ fontSize: '12px', padding: '6px 8px' }}
                            value={item.reason}
                            onChange={e => updateItem(item.productId, 'reason', e.target.value)}>
                            {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                          </select>
                        </td>
                        <td>
                          <button className="btn btn-danger btn-icon" style={{ width: '28px', height: '28px' }}
                            onClick={() => removeItem(item.productId)}>
                            <X size={12} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Totals + Save */}
        {formItems.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            {/* Summary Cards */}
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              {[
                { label: 'Positive Adj. Value', value: totals.positive, color: '#4ade80', icon: <ArrowUpCircle size={14} /> },
                { label: 'Negative Adj. Value', value: totals.negative, color: '#f87171', icon: <ArrowDownCircle size={14} /> },
                { label: 'Net Adj. Value', value: Math.abs(totals.net), color: totals.net >= 0 ? '#4ade80' : '#f87171', icon: <BarChart2 size={14} /> }
              ].map(card => (
                <div key={card.label} style={{
                  background: 'var(--surface-raised)', border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)', padding: '12px 18px', minWidth: '160px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: card.color, fontSize: '11px', fontWeight: '600', marginBottom: '4px' }}>
                    {card.icon} {card.label}
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontWeight: '700', fontSize: '16px', color: card.color }}>
                    {formatCurrency(card.value)}
                  </div>
                </div>
              ))}
            </div>
            {/* Actions */}
            <button className="btn btn-primary" onClick={handleSaveDraft} disabled={saving}
              style={{ fontSize: '14px', padding: '10px 24px' }}>
              {saving ? <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Saving...</> : <><FileText size={14} /> Save as Draft</>}
            </button>
          </div>
        )}

        {formItems.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)', border: '2px dashed var(--border-color)', borderRadius: 'var(--radius-lg)' }}>
            <ClipboardList size={36} style={{ marginBottom: '12px', opacity: 0.4 }} />
            <p style={{ fontSize: '14px' }}>Search for products above to add them to this adjustment.</p>
          </div>
        )}
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // RENDER: DETAIL VIEW
  // ────────────────────────────────────────────────────────────────────────────
  if (view === 'detail') {
    const adj = selectedAdj;
    if (detailLoading || !adj) {
      return (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '80px' }}>
          <RefreshCw size={28} style={{ color: 'var(--primary)', animation: 'spin 1.5s linear infinite' }} />
        </div>
      );
    }

    const sc = STATUS_COLORS[adj.Status] || STATUS_COLORS.Draft;
    const items = adj.Items || [];
    const totalValue = items.reduce((s, i) => s + i.AdjustedQty * i.CostPrice, 0);
    const posValue = items.filter(i => i.AdjustedQty > 0).reduce((s, i) => s + i.AdjustedQty * i.CostPrice, 0);
    const negValue = Math.abs(items.filter(i => i.AdjustedQty < 0).reduce((s, i) => s + i.AdjustedQty * i.CostPrice, 0));

    return (
      <div>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '700', margin: 0, fontFamily: 'var(--font-mono)' }}>{adj.ReferenceNo}</h3>
              <span style={{ padding: '3px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: '700', background: sc.bg, color: sc.color }}>{adj.Status}</span>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              {new Date(adj.AdjustmentDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button className="btn btn-secondary" onClick={() => handlePrint(adj)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
              <Printer size={14} /> Print
            </button>
            {adj.Status === 'Draft' && canApprove && (
              <button className="btn btn-primary" onClick={() => handleApprove(adj.AdjustmentID)} disabled={approving}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                {approving ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={14} />}
                {approving ? 'Approving...' : 'Approve & Apply'}
              </button>
            )}
            {adj.Status === 'Draft' && canManage && (
              <button className="btn btn-danger" onClick={() => handleCancel(adj.AdjustmentID)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                <X size={14} /> Cancel
              </button>
            )}
            <button className="btn btn-secondary" onClick={() => setView('list')}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
              ← Back to List
            </button>
          </div>
        </div>

        {/* Audit Trail */}
        <div className="glass-panel" style={{ marginBottom: '16px', padding: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
            {[
              { label: 'Created By', value: adj.CreatedByName, icon: <Users size={13} /> },
              { label: 'Created At', value: new Date(adj.CreatedAt).toLocaleString(), icon: <Clock size={13} /> },
              { label: 'Approved By', value: adj.ApprovedByName || '—', icon: <CheckCircle size={13} /> },
              { label: 'Approved At', value: adj.ApprovedAt ? new Date(adj.ApprovedAt).toLocaleString() : '—', icon: <Calendar size={13} /> },
            ].map(info => (
              <div key={info.label}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '3px' }}>
                  {info.icon} {info.label}
                </div>
                <div style={{ fontWeight: '600', fontSize: '13px' }}>{info.value}</div>
              </div>
            ))}
            {adj.Remarks && (
              <div style={{ gridColumn: '1/-1' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '3px' }}>Remarks</div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>"{adj.Remarks}"</div>
              </div>
            )}
          </div>
        </div>

        {/* Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '16px' }}>
          {[
            { label: 'Positive Adjustment Value', value: posValue, color: '#4ade80', icon: <ArrowUpCircle size={16} /> },
            { label: 'Negative Adjustment Value', value: negValue, color: '#f87171', icon: <ArrowDownCircle size={16} /> },
            { label: 'Net Value Impact', value: Math.abs(totalValue), color: totalValue >= 0 ? '#4ade80' : '#f87171', icon: <BarChart2 size={16} />, prefix: totalValue >= 0 ? '+' : '-' }
          ].map(card => (
            <div key={card.label} className="glass-panel" style={{ padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: card.color, fontSize: '12px', marginBottom: '6px' }}>
                {card.icon} {card.label}
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontWeight: '700', fontSize: '20px', color: card.color }}>
                {(card.prefix || '')}{formatCurrency(card.value)}
              </div>
            </div>
          ))}
        </div>

        {/* Items Table */}
        <div className="glass-panel" style={{ padding: 0 }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="table-glass" style={{ minWidth: '820px' }}>
              <thead>
                <tr>
                  <th>Product</th><th>SKU</th><th>UOM</th>
                  <th>Before Stock</th><th>Adjustment</th><th>After Stock</th>
                  <th>Cost Price</th><th>Adj. Value</th><th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => {
                  const newStock = Number(item.CurrentStock) + Number(item.AdjustedQty);
                  const adjValue = Number(item.AdjustedQty) * Number(item.CostPrice);
                  const isPos = Number(item.AdjustedQty) > 0;
                  return (
                    <tr key={item.ItemID}>
                      <td><div style={{ fontWeight: '600' }}>{item.ProductName}</div></td>
                      <td><span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{item.SKU}</span></td>
                      <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{item.UOM}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: '600' }}>{Number(item.CurrentStock)}</td>
                      <td>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '700', fontSize: '14px', color: isPos ? '#4ade80' : '#f87171' }}>
                          {isPos ? '+' : ''}{Number(item.AdjustedQty)}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: '700', color: newStock < 0 ? '#f87171' : newStock === 0 ? '#fbbf24' : '#4ade80' }}>
                        {newStock.toFixed(3)}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '13px' }}>{formatCurrency(item.CostPrice)}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: '700', color: adjValue >= 0 ? '#4ade80' : '#f87171' }}>
                        {adjValue > 0 ? '+' : ''}{formatCurrency(adjValue)}
                      </td>
                      <td>
                        <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '11px', background: 'var(--hover-bg)', color: 'var(--text-secondary)' }}>
                          {item.Reason}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Journal Entries Notice */}
        {adj.Status === 'Approved' && (
          <div style={{ marginTop: '16px', padding: '12px 16px', background: 'rgba(34, 197, 94, 0.08)', border: '1px solid rgba(34, 197, 94, 0.2)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <CheckCircle size={16} style={{ color: '#4ade80', flexShrink: 0 }} />
            <div style={{ fontSize: '13px', color: '#4ade80' }}>
              <strong>Accounting Posted:</strong> Journal entries for Cost of Sales and Inventory Asset have been automatically recorded for this adjustment.
            </div>
          </div>
        )}
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // RENDER: REPORTS
  // ────────────────────────────────────────────────────────────────────────────
  if (view === 'reports') {
    const REPORT_TABS = [
      { id: 'summary', label: 'Summary by Date', icon: <Calendar size={13} /> },
      { id: 'product', label: 'By Product', icon: <ClipboardList size={13} /> },
      { id: 'users', label: 'By User', icon: <Users size={13} /> }
    ];

    return (
      <div>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: '700', margin: 0 }}>Inventory Adjustment Reports</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>View adjustment history, impact by product, and user activity</p>
          </div>
          <button className="btn btn-secondary" onClick={() => setView('list')} style={{ fontSize: '13px' }}>
            ← Back to Adjustments
          </button>
        </div>

        {/* Report Sub-Tabs */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', borderBottom: '1px solid var(--border-color)' }}>
          {REPORT_TABS.map(tab => (
            <button key={tab.id}
              onClick={() => setReportTab(tab.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '8px 16px', fontSize: '13px', fontWeight: '600',
                background: reportTab === tab.id ? 'var(--primary)' : 'transparent',
                color: reportTab === tab.id ? 'white' : 'var(--text-secondary)',
                border: 'none', borderRadius: 'var(--radius-md) var(--radius-md) 0 0',
                cursor: 'pointer', transition: 'all 0.2s',
                borderBottom: reportTab === tab.id ? '2px solid var(--primary)' : '2px solid transparent'
              }}>
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Report Filters */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          <input type="date" className="form-input" style={{ height: '36px', fontSize: '13px', width: '150px', padding: '0 12px' }}
            value={reportFilters.startDate} onChange={e => setReportFilters(f => ({ ...f, startDate: e.target.value }))}
            placeholder="Start Date" />
          <input type="date" className="form-input" style={{ height: '36px', fontSize: '13px', width: '150px', padding: '0 12px' }}
            value={reportFilters.endDate} onChange={e => setReportFilters(f => ({ ...f, endDate: e.target.value }))}
            placeholder="End Date" />
          {reportTab === 'product' && (
            <select className="form-select" style={{ height: '36px', fontSize: '13px', minWidth: '200px', padding: '0 12px' }}
              value={reportFilters.productId} onChange={e => setReportFilters(f => ({ ...f, productId: e.target.value }))}>
              <option value="">All Products</option>
              {products.map(p => <option key={p.ProductID} value={p.ProductID}>{p.Name}</option>)}
            </select>
          )}
          <button className="btn btn-secondary" onClick={() => fetchReport(reportTab)}
            style={{ height: '36px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        {/* Report Content */}
        {reportLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
            <RefreshCw size={24} style={{ color: 'var(--primary)', animation: 'spin 1.5s linear infinite' }} />
          </div>
        ) : (
          <div className="glass-panel" style={{ padding: 0 }}>
            <div className="table-container">
              {reportTab === 'summary' && (
                <table className="table-glass">
                  <thead>
                    <tr>
                      <th>Date</th><th>Adjustments</th>
                      <th>Positive Value</th><th>Negative Value</th><th>Net Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.length === 0 ? (
                      <tr><td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No approved adjustments in this date range.</td></tr>
                    ) : reportData.map((row, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: '600' }}>{new Date(row.AdjustmentDate).toLocaleDateString()}</td>
                        <td style={{ textAlign: 'center' }}>{row.AdjustmentCount}</td>
                        <td style={{ fontFamily: 'var(--font-mono)', color: '#4ade80' }}>+{formatCurrency(row.PositiveValue || 0)}</td>
                        <td style={{ fontFamily: 'var(--font-mono)', color: '#f87171' }}>-{formatCurrency(row.NegativeValue || 0)}</td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontWeight: '700', color: (row.NetValue || 0) >= 0 ? '#4ade80' : '#f87171' }}>
                          {(row.NetValue || 0) >= 0 ? '+' : ''}{formatCurrency(row.NetValue || 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {reportTab === 'product' && (
                <table className="table-glass">
                  <thead>
                    <tr>
                      <th>Product</th><th>SKU</th><th>Date</th><th>Ref No.</th>
                      <th>Adj. Qty</th><th>Cost</th><th>Value</th><th>Reason</th><th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.length === 0 ? (
                      <tr><td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No approved adjustments found.</td></tr>
                    ) : reportData.map((row, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: '600' }}>{row.ProductName}</td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{row.SKU}</td>
                        <td style={{ fontSize: '13px' }}>{new Date(row.AdjustmentDate).toLocaleDateString()}</td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--primary)' }}>{row.ReferenceNo}</td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontWeight: '700', color: row.AdjustedQty > 0 ? '#4ade80' : '#f87171' }}>
                          {row.AdjustedQty > 0 ? '+' : ''}{Number(row.AdjustedQty)} {row.UOM}
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: '13px' }}>{formatCurrency(row.CostPrice)}</td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: row.AdjustmentValue >= 0 ? '#4ade80' : '#f87171' }}>
                          {row.AdjustmentValue >= 0 ? '+' : ''}{formatCurrency(row.AdjustmentValue)}
                        </td>
                        <td style={{ fontSize: '12px' }}>{row.Reason}</td>
                        <td>
                          <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '700', background: STATUS_COLORS[row.Status]?.bg, color: STATUS_COLORS[row.Status]?.color }}>
                            {row.Status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {reportTab === 'users' && (
                <table className="table-glass">
                  <thead>
                    <tr><th>User</th><th>Adjustments Made</th><th>Total Value Adjusted</th></tr>
                  </thead>
                  <tbody>
                    {reportData.length === 0 ? (
                      <tr><td colSpan={3} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No approved adjustments found.</td></tr>
                    ) : reportData.map((row, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: '600' }}>{row.UserName}</td>
                        <td style={{ textAlign: 'center', fontWeight: '600' }}>{row.AdjustmentCount}</td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontWeight: '700', color: 'var(--primary)' }}>
                          {formatCurrency(row.TotalValue || 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}
