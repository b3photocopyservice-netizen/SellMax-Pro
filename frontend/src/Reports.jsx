import React, { useState, useEffect } from 'react';
import formatCurrency from './utils/formatCurrency';
import { useAuth } from './contexts/AuthContext';
import { Search, Calendar, RefreshCw, Printer, AlertTriangle, TrendingUp, ArrowLeftRight, CreditCard, ShieldAlert } from 'lucide-react';

export default function Reports({ setToast }) {
  const { token, API_URL, hasPermission } = useAuth();
  
  // Tab control
  const [activeTab, setActiveTab] = useState('journal'); // 'journal', 'products', 'customers', 'price-overrides'

  // Reports filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [datePreset, setDatePreset] = useState('all');
  const [searchInvoiceId, setSearchInvoiceId] = useState('');

  const handlePresetChange = (preset) => {
    setDatePreset(preset);
    
    if (preset === 'custom') {
      return;
    }
    
    if (preset === 'all') {
      setStartDate('');
      setEndDate('');
      return;
    }
    
    const now = new Date();
    let start = '';
    let end = '';
    
    const formatDate = (d) => {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    };

    switch (preset) {
      case 'today': {
        const d = new Date(now);
        start = formatDate(d);
        end = formatDate(d);
        break;
      }
      case 'yesterday': {
        const d = new Date(now);
        d.setDate(d.getDate() - 1);
        start = formatDate(d);
        end = formatDate(d);
        break;
      }
      case 'this-week': {
        const d = new Date(now);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const startOfWeek = new Date(d.setDate(diff));
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        start = formatDate(startOfWeek);
        end = formatDate(endOfWeek);
        break;
      }
      case 'last-week': {
        const d = new Date(now);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1) - 7;
        const startOfLastWeek = new Date(d.setDate(diff));
        const endOfLastWeek = new Date(startOfLastWeek);
        endOfLastWeek.setDate(startOfLastWeek.getDate() + 6);
        start = formatDate(startOfLastWeek);
        end = formatDate(endOfLastWeek);
        break;
      }
      case 'this-month': {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        start = formatDate(startOfMonth);
        end = formatDate(endOfMonth);
        break;
      }
      case 'last-month': {
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
        start = formatDate(startOfLastMonth);
        end = formatDate(endOfLastMonth);
        break;
      }
      case 'this-quarter': {
        const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
        const startOfQuarter = new Date(now.getFullYear(), quarterStartMonth, 1);
        const endOfQuarter = new Date(now.getFullYear(), quarterStartMonth + 3, 0);
        start = formatDate(startOfQuarter);
        end = formatDate(endOfQuarter);
        break;
      }
      case 'last-quarter': {
        let quarterStartMonth = Math.floor(now.getMonth() / 3) * 3 - 3;
        let year = now.getFullYear();
        if (quarterStartMonth < 0) {
          quarterStartMonth += 12;
          year -= 1;
        }
        const startOfLastQuarter = new Date(year, quarterStartMonth, 1);
        const endOfLastQuarter = new Date(year, quarterStartMonth + 3, 0);
        start = formatDate(startOfLastQuarter);
        end = formatDate(endOfLastQuarter);
        break;
      }
      case 'this-fy': {
        const year = now.getFullYear();
        const startOfFY = new Date(year, 0, 1);
        const endOfFY = new Date(year, 11, 31);
        start = formatDate(startOfFY);
        end = formatDate(endOfFY);
        break;
      }
      case 'last-fy': {
        const year = now.getFullYear() - 1;
        const startOfLastFY = new Date(year, 0, 1);
        const endOfLastFY = new Date(year, 11, 31);
        start = formatDate(startOfLastFY);
        end = formatDate(endOfLastFY);
        break;
      }
      default:
        break;
    }
    
    setStartDate(start);
    setEndDate(end);
  };

  
  // Data sets
  const [salesJournal, setSalesJournal] = useState([]);
  const [productPerformance, setProductPerformance] = useState([]);
  const [customerStatement, setCustomerStatement] = useState([]);
  const [priceOverridesLog, setPriceOverridesLog] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal / Invoice Detail View
  const [activeOrder, setActiveOrder] = useState(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [companyInfo, setCompanyInfo] = useState(null);

  const getCompanyLogoUrl = (url) => {
    if (!url) return null;
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
      return url;
    }
    return `${API_URL}${url}`;
  };
  
  // Returns Flow
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnItems, setReturnItems] = useState([]); // [{productId, name, originalQty, returnQty, price, cost}]
  const [refundMethod, setRefundMethod] = useState('Cash');

  useEffect(() => {
    fetchReportData();
  }, [activeTab, startDate, endDate]);

  // Escape key handler to close reports modals
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (showInvoiceModal) setShowInvoiceModal(false);
        if (showReturnModal) setShowReturnModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showInvoiceModal, showReturnModal]);


  const fetchReportData = async () => {
    try {
      setLoading(true);
      let queryParams = `?t=${Date.now()}`;
      if (startDate) queryParams += `&startDate=${startDate}`;
      if (endDate) queryParams += `&endDate=${endDate}`;

      if (activeTab === 'journal') {
        const res = await fetch(`${API_URL}/api/sales/history${queryParams}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) setSalesJournal(await res.json());
      } 
      else if (activeTab === 'products') {
        const res = await fetch(`${API_URL}/api/reports/product-performance${queryParams}&limit=15`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) setProductPerformance(await res.json());
      } 
      else if (activeTab === 'customers') {
        const res = await fetch(`${API_URL}/api/reports/customer-statement`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) setCustomerStatement(await res.json());
      }
      else if (activeTab === 'price-overrides') {
        const res = await fetch(`${API_URL}/api/reports/price-overrides${queryParams}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) setPriceOverridesLog(await res.json());
      }
    } catch (err) {
      console.error('Failed to load report data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
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

  const handleInvoiceClick = async (orderId) => {
    try {
      const res = await fetch(`${API_URL}/api/sales/history/${orderId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setActiveOrder(data);
        setShowInvoiceModal(true);
      }
    } catch (err) {
      setToast({ type: 'error', message: 'Failed to retrieve invoice details.' });
    }
  };

  const handlePrint = () => {
    const order = activeOrder?.order;
    const items = activeOrder?.items || [];
    const payments = activeOrder?.payments || [];
    if (!order) return;

    const logoUrl = companyInfo?.LogoURL ? getCompanyLogoUrl(companyInfo.LogoURL) : null;

    const paymentsHtml = payments.map(p => {
      const isCash = p.Method === 'Cash';
      let recv = null, change = null;
      if (isCash && p.ReferenceNumber && p.ReferenceNumber.startsWith('Recv:')) {
        p.ReferenceNumber.split(',').forEach(part => {
          if (part.startsWith('Recv:')) recv = parseFloat(part.replace('Recv:', ''));
          if (part.startsWith('Change:')) change = parseFloat(part.replace('Change:', ''));
        });
      }
      return `
        <div class="pay-row">
          <span>- ${p.Method}${!isCash && p.ReferenceNumber ? ` (${p.ReferenceNumber})` : ''}</span>
          <span>Rs. ${Number(p.Amount).toFixed(2)}</span>
        </div>
        ${recv !== null ? `<div class="pay-sub"><span>Received:</span><span>Rs. ${recv.toFixed(2)}</span></div>` : ''}
        ${change !== null ? `<div class="pay-sub"><span>Change:</span><span>Rs. ${change.toFixed(2)}</span></div>` : ''}
      `;
    }).join('');

    const itemsHtml = items.map(item => {
      const hasOverride = item.OriginalPrice && Number(item.OriginalPrice) !== Number(item.Price);
      const origHtml = hasOverride 
        ? `<div style="font-size: 9px; color: #d97706;">Orig: <span style="text-decoration: line-through;">Rs. ${Number(item.OriginalPrice).toFixed(2)}</span></div>` 
        : '';
      return `
        <tr>
          <td>
            <div>${item.ProductName}</div>
            ${origHtml}
          </td>
          <td style="text-align:center">${Number(item.Quantity)} ${item.UOM || 'pcs'}</td>
          <td style="text-align:right">Rs. ${Number(item.Subtotal).toFixed(2)}</td>
        </tr>
      `;
    }).join('');

    const discountHtml = Number(order.DiscountAmount) > 0
      ? `<div class="sum-row"><span>Discount:</span><span>-Rs. ${Number(order.DiscountAmount).toFixed(2)}</span></div>`
      : '';

    const addressParts = [
      companyInfo?.AddressLine1,
      companyInfo?.AddressLine2,
      companyInfo?.City && companyInfo?.PostalCode
        ? `${companyInfo.City}, ${companyInfo.PostalCode}`
        : (companyInfo?.City || companyInfo?.PostalCode || ''),
    ].filter(Boolean).join('<br>');

    const contactParts = [
      (companyInfo?.TelephoneNumber || companyInfo?.MobileNumber)
        ? `Tel: ${companyInfo.TelephoneNumber || companyInfo.MobileNumber}`
        : null,
      companyInfo?.Email ? `Email: ${companyInfo.Email}` : null,
      companyInfo?.Website || null,
    ].filter(Boolean).join('<br>');

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Receipt #SM-${order.OrderID}</title>
<style>
  @page {
    size: 80mm auto;
    margin: 4mm 4mm;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 12px;
    color: #000;
    width: 100%;
    background: white;
  }
  .header { text-align: center; border-bottom: 1px dashed #000; padding-bottom: 6px; margin-bottom: 6px; }
  .logo { max-height: 50px; max-width: 90%; object-fit: contain; margin-bottom: 4px; }
  .company-name { font-size: 15px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; }
  .company-sub { font-size: 11px; color: #111; line-height: 1.5; margin-top: 3px; }
  .meta { font-size: 12px; line-height: 1.7; border-bottom: 1px dashed #000; padding-bottom: 5px; margin-bottom: 5px; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  thead th { font-size: 11px; font-weight: bold; border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 4px 2px; overflow: hidden; }
  tbody td { font-size: 11px; padding: 3px 2px; vertical-align: top; word-break: break-word; overflow: hidden; }
  .col-item { width: 52%; }
  .col-qty  { width: 18%; text-align: center; }
  .col-price{ width: 30%; text-align: right; }
  .summary { border-top: 1px dashed #000; padding-top: 5px; margin-top: 5px; }
  .sum-row { display: flex; justify-content: space-between; font-size: 12px; padding: 2px 0; }
  .sum-total { display: flex; justify-content: space-between; font-size: 14px; font-weight: bold; border-top: 1px solid #000; border-bottom: 1px solid #000; margin-top: 4px; padding: 4px 0; }
  .payments { border-top: 1px dashed #000; margin-top: 5px; padding-top: 5px; font-size: 12px; }
  .pay-label { font-weight: bold; margin-bottom: 3px; font-size: 12px; }
  .pay-row { display: flex; justify-content: space-between; font-size: 12px; padding: 2px 0; }
  .pay-sub { display: flex; justify-content: space-between; font-size: 11px; padding-left: 10px; color: #333; }
  .status-row { font-size: 11px; text-align: center; margin-top: 4px; color: #333; }
  .footer { text-align: center; border-top: 1px dashed #000; margin-top: 8px; padding-top: 6px; font-size: 11px; line-height: 1.6; color: #333; }
</style>
</head>
<body>
  <div class="header">
    ${logoUrl ? `<div><img class="logo" src="${logoUrl}" alt="Logo"></div>` : ''}
    <div class="company-name">${companyInfo?.Name || 'SELLMAX PRO'}</div>
    ${addressParts || contactParts ? `<div class="company-sub">${[addressParts, contactParts].filter(Boolean).join('<br>')}</div>` : ''}
  </div>

  <div class="meta">
    <div>INVOICE: #SM-${order.OrderID}</div>
    <div>DATE: ${new Date(order.OrderDate).toLocaleString()}</div>
    <div>CASHIER: ${order.Username}</div>
    <div>CUSTOMER: ${order.CustomerName || 'Walk-in Customer'}</div>
  </div>

  <table>
    <thead>
      <tr>
        <th class="col-item" style="text-align:left">ITEM</th>
        <th class="col-qty">QTY</th>
        <th class="col-price">PRICE</th>
      </tr>
    </thead>
    <tbody>${itemsHtml}</tbody>
  </table>

  <div class="summary">
    <div class="sum-row"><span>Subtotal:</span><span>Rs. ${Number(order.Subtotal).toFixed(2)}</span></div>
    ${discountHtml}
    <div class="sum-row"><span>Tax:</span><span>Rs. ${Number(order.TaxAmount).toFixed(2)}</span></div>
    <div class="sum-total"><span>TOTAL:</span><span>Rs. ${Number(order.TotalAmount).toFixed(2)}</span></div>
  </div>

  <div class="payments">
    <div class="pay-label">Payments:</div>
    ${paymentsHtml}
    <div class="status-row">Status: ${order.Status}</div>
  </div>

  <div class="footer">
    <p>Thank you for shopping with us!</p>
    <div style="margin-top: 8px;">
      <strong>Exchange Policy</strong>
      <p style="margin-top: 2px; font-size: 10px; line-height: 1.3;">A one-time exchange is allowed within two days of purchase, provided the original bill is available.</p>
      <p style="margin-top: 2px; font-size: 10px; line-height: 1.3;">No cash refunds will be issued under any circumstances.</p>
    </div>
    <p style="margin-top: 8px; font-size: 9px; opacity: 0.8;">Powered by SellMax Pro POS</p>
  </div>
</body>
</html>`;

    const popup = window.open('', '_blank', 'width=320,height=600,toolbar=0,menubar=0,location=0,status=0');
    if (!popup) {
      setToast({ type: 'error', message: 'Pop-up blocked! Allow pop-ups for this site to print receipts.' });
      return;
    }
    popup.document.write(html);
    popup.document.close();
    popup.focus();
    popup.onload = () => {
      popup.print();
      popup.onafterprint = () => {
        popup.close();
        setTimeout(() => setShowInvoiceModal(false), 500);
      };
      setTimeout(() => {
        if (!popup.closed) popup.close();
        setTimeout(() => setShowInvoiceModal(false), 500);
      }, 30000);
    };
  };

  // Set up return items dialog
  const handleInitiateReturn = () => {
    if (!activeOrder) return;
    const items = activeOrder.items.map(item => ({
      productId: item.ProductID,
      name: item.ProductName,
      price: item.Price,
      cost: item.Cost,
      originalQty: item.Quantity,
      returnQty: 0
    }));
    setReturnItems(items);
    setRefundMethod('Cash');
    setShowReturnModal(true);
  };

  const updateReturnQty = (idx, qty) => {
    setReturnItems(returnItems.map((item, i) => {
      if (i === idx) {
        const sanitized = Math.min(item.originalQty, Math.max(0, parseFloat(qty) || 0));
        return { ...item, returnQty: sanitized };
      }
      return item;
    }));
  };

  const handleReturnSubmit = async (e) => {
    e.preventDefault();
    const itemsToReturn = returnItems.filter(item => item.returnQty > 0);
    if (itemsToReturn.length === 0) {
      setToast({ type: 'error', message: 'Select at least 1 item to return.' });
      return;
    }

    // Calculations
    const subtotal = itemsToReturn.reduce((sum, item) => sum + (item.price * item.returnQty), 0);
    const originalSubtotal = activeOrder.order.Subtotal;
    const discountRatio = activeOrder.order.DiscountAmount / (originalSubtotal || 1);
    const discountAmount = Number((subtotal * discountRatio).toFixed(2));
    const taxAmount = Number(((subtotal - discountAmount) * 0.10).toFixed(2));
    const totalAmount = Number((subtotal - discountAmount + taxAmount).toFixed(2));

    const payload = {
      originalOrderId: activeOrder.order.OrderID,
      customerId: activeOrder.order.CustomerID,
      subtotal,
      discountAmount,
      taxAmount,
      totalAmount,
      items: itemsToReturn.map(item => ({
        productId: item.productId,
        name: item.name,
        quantity: item.returnQty,
        price: item.price,
        cost: item.cost,
        subtotal: item.price * item.returnQty
      })),
      payments: [
        { method: refundMethod, amount: totalAmount, referenceNumber: `Refund SM-${activeOrder.order.OrderID}` }
      ]
    };

    try {
      const res = await fetch(`${API_URL}/api/sales/return`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Refund failed.');

      setToast({ type: 'success', message: 'Refund processed successfully.' });
      setShowReturnModal(false);
      setShowInvoiceModal(false);
      fetchReportData();
    } catch (err) {
      setToast({ type: 'error', message: err.message });
    }
  };

  return (
    <div>
      {/* Tab Selectors */}
      <div className="category-tabs" style={{ marginBottom: '24px' }}>
        <button 
          className={`category-tab ${activeTab === 'journal' ? 'active' : ''}`}
          onClick={() => setActiveTab('journal')}
        >
          Sales Ledger Journal
        </button>
        <button 
          className={`category-tab ${activeTab === 'products' ? 'active' : ''}`}
          onClick={() => setActiveTab('products')}
        >
          Best Sellers (Product Performance)
        </button>
        <button 
          className={`category-tab ${activeTab === 'customers' ? 'active' : ''}`}
          onClick={() => setActiveTab('customers')}
        >
          Customer Debts & Loyalty audits
        </button>
        <button 
          className={`category-tab ${activeTab === 'price-overrides' ? 'active' : ''}`}
          onClick={() => setActiveTab('price-overrides')}
        >
          <ShieldAlert size={14} style={{ display: 'inline', marginRight: '6px' }} />
          Price Overrides Log
        </button>
      </div>

      {/* Filters Area */}
      <div className="glass-panel" style={{ padding: '16px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '24px' }}>
        
        {activeTab !== 'customers' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <select
                className="form-select"
                style={{ width: '180px', padding: '6px 12px', fontSize: '13px' }}
                value={datePreset}
                onChange={(e) => handlePresetChange(e.target.value)}
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="this-week">This Week</option>
                <option value="last-week">Last Week</option>
                <option value="this-month">This Month</option>
                <option value="last-month">Last Month</option>
                <option value="this-quarter">This Quarter</option>
                <option value="last-quarter">Last Quarter</option>
                <option value="this-fy">This Fiscal Year</option>
                <option value="last-fy">Last Fiscal Year</option>
                <option value="custom">Custom Date Range</option>
              </select>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calendar size={16} style={{ color: 'var(--text-secondary)', marginLeft: '8px' }} />
                <input
                  type="date"
                  className="form-input"
                  style={{ width: '150px', padding: '6px 12px', fontSize: '13px' }}
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setDatePreset('custom');
                  }}
                />
                <span style={{ color: 'var(--text-secondary)' }}>to</span>
                <input
                  type="date"
                  className="form-input"
                  style={{ width: '150px', padding: '6px 12px', fontSize: '13px' }}
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setDatePreset('custom');
                  }}
                />
              </div>
            </div>
            {(startDate || endDate) && (
              <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12.5px' }} onClick={() => { setStartDate(''); setEndDate(''); setDatePreset('all'); }}>
                Clear Dates
              </button>
            )}
          </>
        )}

        <button className="btn btn-secondary btn-icon" onClick={fetchReportData} title="Refresh Ledger" style={{ marginLeft: 'auto' }}>
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Loader */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px' }}>
          <RefreshCw size={24} className="animate-spin" style={{ color: 'var(--primary)', animation: 'spin 1.5s linear infinite' }} />
        </div>
      ) : (
        <div className="glass-panel" style={{ padding: 0 }}>
          {/* TAB 1: Sales Journal */}
          {activeTab === 'journal' && (
            <div className="table-container">
              <table className="table-glass">
                <thead>
                  <tr>
                    <th>Invoice ID</th>
                    <th>Date / Time</th>
                    <th>Customer Name</th>
                    <th>Cashier</th>
                    <th>Subtotal</th>
                    <th>Discount</th>
                    <th>VAT (Rs.)</th>
                    <th>Total Received</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {salesJournal.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                        No transactions found in this period.
                      </td>
                    </tr>
                  ) : (
                    salesJournal.map((sale) => (
                      <tr key={sale.OrderID} onClick={() => handleInvoiceClick(sale.OrderID)} style={{ cursor: 'pointer' }}>
                        <td className="mono" style={{ fontWeight: '600' }}>#SM-{sale.OrderID}</td>
                        <td>{new Date(sale.OrderDate).toLocaleString()}</td>
                        <td>{sale.CustomerName || 'Walk-in Customer'}</td>
                        <td>{sale.Username}</td>
                        <td className="mono">Rs. {formatCurrency(sale.Subtotal)}</td>
                        <td className="mono" style={{ color: sale.DiscountAmount > 0 ? 'var(--warning)' : 'inherit' }}>
                          Rs. {formatCurrency(sale.DiscountAmount)}
                        </td>
                        <td className="mono">Rs. {formatCurrency(sale.TaxAmount)}</td>
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
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 2: Best Sellers (Stored Procedure) */}
          {activeTab === 'products' && (
            <div className="table-container">
              <table className="table-glass">
                <thead>
                  <tr>
                    <th>Product Name</th>
                    <th>SKU</th>
                    <th>Category</th>
                    <th>Units Sold</th>
                    <th>Gross Revenue</th>
                    <th>Est. Profit Margin</th>
                    <th>Current Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {productPerformance.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                        No product rankings available for this date range.
                      </td>
                    </tr>
                  ) : (
                    productPerformance.map((item, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: '600' }}>{item.ProductName}</td>
                        <td className="mono">{item.SKU}</td>
                        <td>{item.CategoryName}</td>
                        <td className="mono" style={{ fontWeight: '700' }}>{item.UnitsSold} units</td>
                        <td className="mono" style={{ color: 'var(--accent)' }}>Rs. {formatCurrency(item.GrossRevenue)}</td>
                        <td className="mono" style={{ color: 'var(--success)' }}>Rs. {formatCurrency(item.EstimatedProfit)}</td>
                        <td className="mono">{item.CurrentStock} left</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 3: Customer Debts & Loyalty Audits (Stored Procedure) */}
          {activeTab === 'customers' && (
            <div className="table-container">
              <table className="table-glass">
                <thead>
                  <tr>
                    <th>Customer Name</th>
                    <th>Contact Phone</th>
                    <th>Loyalty Balance</th>
                    <th>Store Credit Limit</th>
                    <th>Owed Balance</th>
                    <th>Remaining Credit</th>
                    <th>Historic Invoices</th>
                    <th>Total Value Contributed</th>
                  </tr>
                </thead>
                <tbody>
                  {customerStatement.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                        No customer logs found.
                      </td>
                    </tr>
                  ) : (
                    customerStatement.map((cust) => (
                      <tr key={cust.CustomerID}>
                        <td style={{ fontWeight: '600' }}>{cust.CustomerName}</td>
                        <td>{cust.Phone || '--'}</td>
                        <td className="mono" style={{ color: 'var(--primary)', fontWeight: '700' }}>{cust.LoyaltyPoints} pts</td>
                        <td className="mono">Rs. {formatCurrency(cust.CreditLimit)}</td>
                        <td className="mono" style={{ color: cust.CurrentBalance > 0 ? 'var(--danger)' : 'inherit' }}>
                          Rs. {formatCurrency(cust.CurrentBalance)}
                        </td>
                        <td className="mono" style={{ color: 'var(--success)' }}>Rs. {formatCurrency(cust.RemainingCredit)}</td>
                        <td>{cust.TotalOrdersCount} sales</td>
                        <td className="mono" style={{ color: 'var(--accent)', fontWeight: '600' }}>
                          Rs. {formatCurrency(cust.TotalPurchasesValue)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 4: Price Overrides Log */}
          {activeTab === 'price-overrides' && (
            <div className="table-container">
              <table className="table-glass">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Invoice ID</th>
                    <th>Product</th>
                    <th>SKU</th>
                    <th>Original Price</th>
                    <th>Overridden Price</th>
                    <th>Variance</th>
                    <th>Cashier</th>
                    <th>Approved By</th>
                  </tr>
                </thead>
                <tbody>
                  {priceOverridesLog.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                        No price overrides recorded in this period.
                      </td>
                    </tr>
                  ) : (
                    priceOverridesLog.map((log, i) => {
                      const diff = Number(log.OriginalPrice) - Number(log.OverriddenPrice);
                      const pct = log.OriginalPrice > 0 ? (diff / log.OriginalPrice) * 100 : 0;
                      return (
                        <tr key={i} onClick={() => log.OrderID && handleInvoiceClick(log.OrderID)} style={{ cursor: log.OrderID ? 'pointer' : 'default' }}>
                          <td>{new Date(log.CreatedAt).toLocaleString()}</td>
                          <td className="mono" style={{ fontWeight: '600' }}>#SM-{log.OrderID}</td>
                          <td style={{ fontWeight: '600' }}>{log.ProductName}</td>
                          <td className="mono">{log.SKU}</td>
                          <td className="mono">Rs. {formatCurrency(log.OriginalPrice)}</td>
                          <td className="mono" style={{ color: '#f59e0b', fontWeight: '600' }}>
                            Rs. {formatCurrency(log.OverriddenPrice)}
                          </td>
                          <td className="mono" style={{ color: diff > 0 ? 'var(--danger)' : 'var(--success)' }}>
                            {diff > 0 ? '-' : '+'}Rs. {formatCurrency(Math.abs(diff))} ({Math.abs(pct).toFixed(1)}%)
                          </td>
                          <td>{log.CashierName || '—'}</td>
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
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ============================================================================
         MODAL: SALES INVOICE VIEW
         ============================================================================ */}
      {showInvoiceModal && activeOrder && (
        <div className="modal-overlay invoice-detail-modal-overlay">
          <div className="modal-content" style={{ width: '450px', background: '#f8fafc', color: '#0f172a' }}>
            
            <div className="receipt-wrapper printable-receipt-modal">
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

              <div className="receipt-details">
                <div>INVOICE: #SM-{activeOrder.order.OrderID}</div>
                <div>DATE: {new Date(activeOrder.order.OrderDate).toLocaleString()}</div>
                <div>CASHIER: {activeOrder.order.Username}</div>
                <div>CUSTOMER: {activeOrder.order.CustomerName || 'Walk-in Customer'}</div>
              </div>

              <table className="receipt-items-table">
                <thead>
                  <tr>
                    <th style={{ width: '55%' }}>ITEM</th>
                    <th style={{ width: '15%' }}>QTY</th>
                    <th style={{ width: '30%', textAlign: 'right' }}>PRICE</th>
                  </tr>
                </thead>
                <tbody>
                  {activeOrder.items.map((item, i) => (
                    <tr key={i}>
                      <td>
                        <div>{item.ProductName}</div>
                        {item.OriginalPrice && Number(item.OriginalPrice) !== Number(item.Price) && (
                          <div style={{ fontSize: '10px', color: '#64748b' }}>
                            Orig: <span style={{ textDecoration: 'line-through', color: '#d97706' }}>Rs. {formatCurrency(item.OriginalPrice)}</span>
                          </div>
                        )}
                      </td>
                      <td>{Number(item.Quantity)} {item.UOM || 'pcs'}</td>
                      <td style={{ textAlign: 'right' }}>Rs. {formatCurrency(item.Subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="receipt-summary-area">
                <div className="receipt-summary-row">
                  <span>Subtotal:</span>
                  <span>Rs. {formatCurrency(activeOrder.order.Subtotal)}</span>
                </div>
                {Number(activeOrder.order.DiscountAmount) > 0 && (
                  <div className="receipt-summary-row">
                    <span>Discount:</span>
                    <span>-Rs. {formatCurrency(activeOrder.order.DiscountAmount)}</span>
                  </div>
                )}
                <div className="receipt-summary-row">
                  <span>Tax:</span>
                  <span>Rs. {formatCurrency(activeOrder.order.TaxAmount)}</span>
                </div>
                <div className="receipt-summary-row total">
                  <span>TOTAL:</span>
                  <span>Rs. {formatCurrency(activeOrder.order.TotalAmount)}</span>
                </div>
              </div>

              <div style={{ fontSize: '11px', borderTop: '1px dashed #000', paddingTop: '6px' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Payments:</div>
                {activeOrder.payments.map((p, i) => {
                  const isCash = p.Method === 'Cash';
                  let recv = null;
                  let change = null;
                  if (isCash && p.ReferenceNumber && p.ReferenceNumber.startsWith('Recv:')) {
                    const parts = p.ReferenceNumber.split(',');
                    parts.forEach(part => {
                      if (part.startsWith('Recv:')) recv = parseFloat(part.replace('Recv:', ''));
                      if (part.startsWith('Change:')) change = parseFloat(part.replace('Change:', ''));
                    });
                  }
                  
                  return (
                    <div key={i} style={{ marginBottom: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px' }}>
                        <span>- {p.Method} {(!isCash && p.ReferenceNumber) ? `(${p.ReferenceNumber})` : ''}</span>
                        <span>Rs. {formatCurrency(p.Amount)}</span>
                      </div>
                      {recv !== null && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '10px', color: '#475569', fontSize: '10px', marginTop: '2px' }}>
                          <span>Amount Received:</span>
                          <span>Rs. {formatCurrency(recv)}</span>
                        </div>
                      )}
                      {change !== null && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '10px', color: '#475569', fontSize: '10px', marginTop: '2px' }}>
                          <span>Change Balance:</span>
                          <span>Rs. {formatCurrency(change)}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="receipt-footer">
                <p>Thank you for shopping with us!</p>
                <div style={{ marginTop: '8px' }}>
                  <strong>Exchange Policy</strong>
                  <p style={{ marginTop: '2px', fontSize: '9.5px', lineHeight: '1.3' }}>A one-time exchange is allowed within two days of purchase, provided the original bill is available.</p>
                  <p style={{ marginTop: '2px', fontSize: '9.5px', lineHeight: '1.3' }}>No cash refunds will be issued under any circumstances.</p>
                </div>
                <p style={{ marginTop: '8px' }}>Status: {activeOrder.order.Status}</p>
                {activeOrder.order.ParentOrderID && <p>Orig Invoice: #SM-{activeOrder.order.ParentOrderID}</p>}
                <p style={{ marginTop: '4px', fontSize: '9px', opacity: 0.8 }}>System powered by SellMax Pro POS</p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '24px' }} className="no-print">
              <button className="btn btn-secondary" onClick={() => setShowInvoiceModal(false)}>Close</button>
              
              {hasPermission('RETURN_EXCHANGE_SALE') && activeOrder.order.Status === 'Completed' && (
                <button className="btn btn-danger" onClick={handleInitiateReturn}>
                  Refund Return
                </button>
              )}

              <button className="btn btn-primary" onClick={handlePrint}>
                <Printer size={16} />
                <span>Print Copy</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ============================================================================
         MODAL: PROCESS RETURN / REFUND
         ============================================================================ */}
      {showReturnModal && activeOrder && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: '520px' }}>
            <h3 style={{ marginBottom: '16px' }}>Return Invoice #SM-{activeOrder.order.OrderID}</h3>
            
            <form onSubmit={handleReturnSubmit}>
              <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)' }}>SELECT ITEMS TO RETURN</span>
                {returnItems.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.15)', padding: '10px 14px', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ flex: 1.5 }}>
                      <div style={{ fontSize: '13px', fontWeight: '600' }}>{item.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Purchased: {item.originalQty} unit(s)</div>
                    </div>
                    <div style={{ flex: 1, display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <label className="form-label" style={{ margin: 0, fontSize: '11px' }}>Qty:</label>
                      <input
                        type="number"
                        step="any"
                        className="form-input mono"
                        style={{ padding: '4px 8px', fontSize: '12.5px', textAlign: 'center' }}
                        value={item.returnQty}
                        onChange={(e) => updateReturnQty(idx, e.target.value)}
                        min="0"
                        max={item.originalQty}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Select refund payout method */}
              <div className="form-group">
                <label className="form-label">Refund Payment Channel</label>
                <select 
                  className="form-select"
                  value={refundMethod}
                  onChange={(e) => setRefundMethod(e.target.value)}
                >
                  <option value="Cash">Cash Return</option>
                  <option value="Card">Card Refund</option>
                  <option value="Bank Transfer">Bank Wire</option>
                  {activeOrder.order.CustomerID && <option value="Credit">Store Credit Adjustment</option>}
                </select>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowReturnModal(false)}>Back</button>
                <button type="submit" className="btn btn-primary" style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }}>
                  Confirm Refund
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
