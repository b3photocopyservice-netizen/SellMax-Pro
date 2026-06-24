import React, { useState, useEffect } from 'react';
import formatCurrency from './utils/formatCurrency';
import { useAuth } from './contexts/AuthContext';
import { Search, Calendar, RefreshCw, Printer, Download, AlertTriangle, TrendingUp, ArrowLeftRight, CreditCard, ShieldAlert } from 'lucide-react';

export default function Reports({ setToast }) {
  const { token, API_URL, hasPermission, user } = useAuth();
  
  // Tab control
  const [activeTab, setActiveTab] = useState('journal'); // 'journal', 'products', 'customers', 'dayend'

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
  const [drawerHistory, setDrawerHistory] = useState([]);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [activeAuditSession, setActiveAuditSession] = useState(null);
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
      else if (activeTab === 'dayend') {
        const res = await fetch(`${API_URL}/api/sales/cash-drawer/history`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) setDrawerHistory(await res.json());
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
      const variantHtml = item.VariantName
        ? `<div style="font-size: 9px; color: #6366f1; font-weight: 600;">${item.VariantName}</div>`
        : '';
      return `
        <tr>
          <td>
            <div>${item.ProductName}</div>
            ${variantHtml}
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

  const handleVoidInvoice = async () => {
    if (!window.confirm(`Are you sure you want to VOID and CANCEL Invoice #SM-${activeOrder.order.OrderID}? This action is irreversible, will restock items into inventory, and mark the invoice as Cancelled.`)) {
      return;
    }
    
    try {
      const res = await fetch(`${API_URL}/api/sales/orders/${activeOrder.order.OrderID}/void`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!res.ok) {
        throw new Error((await res.json()).error || 'Failed to void invoice.');
      }
      
      setToast({ type: 'success', message: `Invoice #SM-${activeOrder.order.OrderID} has been voided successfully. Stock restored.` });
      setShowInvoiceModal(false);
      fetchReportData();
    } catch (err) {
      setToast({ type: 'error', message: err.message });
    }
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

  const handleExportCSV = () => {
    const sanitizeCSVField = (val) => {
      if (val === null || val === undefined) return '';
      let str = String(val).replace(/"/g, '""');
      if (str.includes(',') || str.includes('\n') || str.includes('"')) {
        str = `"${str}"`;
      }
      return str;
    };

    const downloadCSV = (headers, rows, filename) => {
      const csvRows = [
        headers.map(sanitizeCSVField).join(','),
        ...rows.map(row => row.map(sanitizeCSVField).join(','))
      ];
      const csvContent = "\uFEFF" + csvRows.join('\r\n'); // UTF-8 BOM
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };

    const dateStr = new Date().toISOString().split('T')[0];

    if (activeTab === 'journal') {
      const headers = ['Invoice ID', 'Date / Time', 'Customer Name', 'Cashier', 'Subtotal', 'Discount', 'VAT (Rs.)', 'Total Received', 'Status'];
      const rows = salesJournal.map(s => [
        `#SM-${s.OrderID}`,
        new Date(s.OrderDate).toLocaleString(),
        s.CustomerName || 'Walk-in Customer',
        s.Username,
        s.Subtotal,
        s.DiscountAmount,
        s.TaxAmount,
        s.TotalAmount,
        s.Status
      ]);
      downloadCSV(headers, rows, `Sales_Ledger_Journal_${dateStr}.csv`);
    }
    else if (activeTab === 'products') {
      const headers = ['Product Name', 'SKU', 'CategoryName', 'Units Sold', 'Gross Revenue', 'Est. Profit Margin', 'Current Stock'];
      const rows = productPerformance.map(p => [
        p.ProductName,
        p.SKU,
        p.CategoryName,
        p.UnitsSold,
        p.GrossRevenue,
        p.EstimatedProfit,
        p.CurrentStock
      ]);
      downloadCSV(headers, rows, `Best_Sellers_Performance_${dateStr}.csv`);
    }
    else if (activeTab === 'customers') {
      const headers = ['Customer Name', 'Contact Phone', 'Loyalty Balance', 'Store Credit Limit', 'Owed Balance', 'Remaining Credit', 'Historic Invoices', 'Total Value Contributed'];
      const rows = customerStatement.map(c => [
        c.CustomerName,
        c.Phone || '--',
        c.LoyaltyPoints,
        c.CreditLimit,
        c.CurrentBalance,
        c.RemainingCredit,
        c.TotalOrdersCount,
        c.TotalPurchasesValue
      ]);
      downloadCSV(headers, rows, `Customer_Debts_Loyalty_Audits_${dateStr}.csv`);
    }
    else if (activeTab === 'dayend') {
      const headers = ['Session ID', 'Cashier', 'POS Terminal', 'Opened Time', 'Closed Time', 'Expected Cash', 'Actual Cash', 'Variance'];
      const rows = drawerHistory.map(d => [
        `#${d.SessionID}`,
        d.CashierName || 'Cashier',
        d.TerminalID,
        new Date(d.OpeningTime).toLocaleString(),
        d.ClosingTime ? new Date(d.ClosingTime).toLocaleString() : '—',
        d.ExpectedCash,
        d.ActualCash,
        d.DifferenceAmount
      ]);
      downloadCSV(headers, rows, `Day_End_Closing_History_${dateStr}.csv`);
    }
  };

  const handlePrintReport = () => {
    let bodyHtml = '';
    let reportTitle = '';
    const dateRangeStr = startDate || endDate 
      ? `• Filter: ${startDate || 'Start'} to ${endDate || 'End'}` 
      : '• Filter: All Time';

    if (activeTab === 'journal') {
      reportTitle = 'Sales Ledger Journal Report';
      const totalSubtotal = salesJournal.reduce((sum, item) => sum + parseFloat(item.Subtotal || 0), 0);
      const totalDiscount = salesJournal.reduce((sum, item) => sum + parseFloat(item.DiscountAmount || 0), 0);
      const totalTax = salesJournal.reduce((sum, item) => sum + parseFloat(item.TaxAmount || 0), 0);
      const totalAmount = salesJournal.reduce((sum, item) => sum + parseFloat(item.TotalAmount || 0), 0);

      const rowsHtml = salesJournal.map(s => `
        <tr>
          <td>#SM-${s.OrderID}</td>
          <td>${new Date(s.OrderDate).toLocaleString()}</td>
          <td>${s.CustomerName || 'Walk-in Customer'}</td>
          <td>${s.Username}</td>
          <td style="text-align: right;">Rs. ${Number(s.Subtotal).toFixed(2)}</td>
          <td style="text-align: right; color: #d97706;">Rs. ${Number(s.DiscountAmount).toFixed(2)}</td>
          <td style="text-align: right;">Rs. ${Number(s.TaxAmount).toFixed(2)}</td>
          <td style="text-align: right; font-weight: bold; color: #0284c7;">Rs. ${Number(s.TotalAmount).toFixed(2)}</td>
          <td>${s.Status}</td>
        </tr>
      `).join('');

      bodyHtml = `
        <table>
          <thead>
            <tr>
              <th style="text-align: left;">Invoice ID</th>
              <th style="text-align: left;">Date / Time</th>
              <th style="text-align: left;">Customer Name</th>
              <th style="text-align: left;">Cashier</th>
              <th style="text-align: right;">Subtotal</th>
              <th style="text-align: right;">Discount</th>
              <th style="text-align: right;">VAT</th>
              <th style="text-align: right;">Total Received</th>
              <th style="text-align: left;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml.length > 0 ? rowsHtml : '<tr><td colspan="9" style="text-align:center;">No records found.</td></tr>'}
            ${rowsHtml.length > 0 ? `
            <tr style="border-top: 2px solid #333; font-weight: bold;">
              <td colspan="4">TOTALS</td>
              <td style="text-align: right;">Rs. ${totalSubtotal.toFixed(2)}</td>
              <td style="text-align: right; color: #d97706;">Rs. ${totalDiscount.toFixed(2)}</td>
              <td style="text-align: right;">Rs. ${totalTax.toFixed(2)}</td>
              <td style="text-align: right; color: #0284c7;">Rs. ${totalAmount.toFixed(2)}</td>
              <td></td>
            </tr>` : ''}
          </tbody>
        </table>
      `;
    }
    else if (activeTab === 'products') {
      reportTitle = 'Best Sellers (Product Performance) Report';
      const totalUnits = productPerformance.reduce((sum, item) => sum + parseFloat(item.UnitsSold || 0), 0);
      const totalRevenue = productPerformance.reduce((sum, item) => sum + parseFloat(item.GrossRevenue || 0), 0);
      const totalProfit = productPerformance.reduce((sum, item) => sum + parseFloat(item.EstimatedProfit || 0), 0);

      const rowsHtml = productPerformance.map(p => `
        <tr>
          <td>${p.ProductName}</td>
          <td>${p.SKU}</td>
          <td>${p.CategoryName}</td>
          <td style="text-align: right;">${p.UnitsSold} units</td>
          <td style="text-align: right; color: #0284c7;">Rs. ${Number(p.GrossRevenue).toFixed(2)}</td>
          <td style="text-align: right; color: #16a34a;">Rs. ${Number(p.EstimatedProfit).toFixed(2)}</td>
          <td style="text-align: right;">${p.CurrentStock} left</td>
        </tr>
      `).join('');

      bodyHtml = `
        <table>
          <thead>
            <tr>
              <th style="text-align: left;">Product Name</th>
              <th style="text-align: left;">SKU</th>
              <th style="text-align: left;">Category</th>
              <th style="text-align: right;">Units Sold</th>
              <th style="text-align: right;">Gross Revenue</th>
              <th style="text-align: right;">Est. Profit Margin</th>
              <th style="text-align: right;">Current Stock</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml.length > 0 ? rowsHtml : '<tr><td colspan="7" style="text-align:center;">No records found.</td></tr>'}
            ${rowsHtml.length > 0 ? `
            <tr style="border-top: 2px solid #333; font-weight: bold;">
              <td colspan="3">TOTALS</td>
              <td style="text-align: right;">${totalUnits} units</td>
              <td style="text-align: right; color: #0284c7;">Rs. ${totalRevenue.toFixed(2)}</td>
              <td style="text-align: right; color: #16a34a;">Rs. ${totalProfit.toFixed(2)}</td>
              <td></td>
            </tr>` : ''}
          </tbody>
        </table>
      `;
    }
    else if (activeTab === 'customers') {
      reportTitle = 'Customer Debts & Loyalty Audits Report';
      const totalLimit = customerStatement.reduce((sum, item) => sum + parseFloat(item.CreditLimit || 0), 0);
      const totalBalance = customerStatement.reduce((sum, item) => sum + parseFloat(item.CurrentBalance || 0), 0);
      const totalRemaining = customerStatement.reduce((sum, item) => sum + parseFloat(item.RemainingCredit || 0), 0);
      const totalPurchases = customerStatement.reduce((sum, item) => sum + parseFloat(item.TotalPurchasesValue || 0), 0);

      const rowsHtml = customerStatement.map(c => `
        <tr>
          <td>${c.CustomerName}</td>
          <td>${c.Phone || '--'}</td>
          <td style="text-align: right; color: #8b5cf6;">${c.LoyaltyPoints} pts</td>
          <td style="text-align: right;">Rs. ${Number(c.CreditLimit).toFixed(2)}</td>
          <td style="text-align: right; color: #ef4444;">Rs. ${Number(c.CurrentBalance).toFixed(2)}</td>
          <td style="text-align: right; color: #16a34a;">Rs. ${Number(c.RemainingCredit).toFixed(2)}</td>
          <td style="text-align: right;">${c.TotalOrdersCount} sales</td>
          <td style="text-align: right; color: #0284c7;">Rs. ${Number(c.TotalPurchasesValue).toFixed(2)}</td>
        </tr>
      `).join('');

      bodyHtml = `
        <table>
          <thead>
            <tr>
              <th style="text-align: left;">Customer Name</th>
              <th style="text-align: left;">Contact Phone</th>
              <th style="text-align: right;">Loyalty Balance</th>
              <th style="text-align: right;">Credit Limit</th>
              <th style="text-align: right;">Owed Balance</th>
              <th style="text-align: right;">Available Credit</th>
              <th style="text-align: right;">Sales Count</th>
              <th style="text-align: right;">Total Contributed</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml.length > 0 ? rowsHtml : '<tr><td colspan="8" style="text-align:center;">No records found.</td></tr>'}
            ${rowsHtml.length > 0 ? `
            <tr style="border-top: 2px solid #333; font-weight: bold;">
              <td colspan="3">TOTALS</td>
              <td style="text-align: right;">Rs. ${totalLimit.toFixed(2)}</td>
              <td style="text-align: right; color: #ef4444;">Rs. ${totalBalance.toFixed(2)}</td>
              <td style="text-align: right; color: #16a34a;">Rs. ${totalRemaining.toFixed(2)}</td>
              <td></td>
              <td style="text-align: right; color: #0284c7;">Rs. ${totalPurchases.toFixed(2)}</td>
            </tr>` : ''}
          </tbody>
        </table>
      `;
    }
    else if (activeTab === 'dayend') {
      reportTitle = 'Day-End Closing History Report';
      const totalExpected = drawerHistory.reduce((sum, item) => sum + parseFloat(item.ExpectedCash || 0), 0);
      const totalActual = drawerHistory.reduce((sum, item) => sum + parseFloat(item.ActualCash || 0), 0);
      const totalVariance = drawerHistory.reduce((sum, item) => sum + parseFloat(item.DifferenceAmount || 0), 0);

      const rowsHtml = drawerHistory.map(d => `
        <tr>
          <td>#${d.SessionID}</td>
          <td>${d.CashierName || 'Cashier'}</td>
          <td>${d.TerminalID}</td>
          <td>${new Date(d.OpeningTime).toLocaleString()}</td>
          <td>${d.ClosingTime ? new Date(d.ClosingTime).toLocaleString() : '—'}</td>
          <td style="text-align: right;">Rs. ${Number(d.ExpectedCash).toFixed(2)}</td>
          <td style="text-align: right;">Rs. ${Number(d.ActualCash).toFixed(2)}</td>
          <td style="text-align: right; font-weight: bold; color: ${d.DifferenceAmount === 0 ? '#16a34a' : d.DifferenceAmount > 0 ? '#0284c7' : '#ef4444'};">
            ${d.DifferenceAmount >= 0 ? '+' : ''}Rs. ${Number(d.DifferenceAmount).toFixed(2)}
          </td>
        </tr>
      `).join('');

      bodyHtml = `
        <table>
          <thead>
            <tr>
              <th style="text-align: left;">Session ID</th>
              <th style="text-align: left;">Cashier</th>
              <th style="text-align: left;">POS Terminal</th>
              <th style="text-align: left;">Opened Time</th>
              <th style="text-align: left;">Closed Time</th>
              <th style="text-align: right;">Expected Cash</th>
              <th style="text-align: right;">Actual Cash</th>
              <th style="text-align: right;">Variance</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml.length > 0 ? rowsHtml : '<tr><td colspan="8" style="text-align:center;">No records found.</td></tr>'}
            ${rowsHtml.length > 0 ? `
            <tr style="border-top: 2px solid #333; font-weight: bold;">
              <td colspan="5">TOTALS</td>
              <td style="text-align: right;">Rs. ${totalExpected.toFixed(2)}</td>
              <td style="text-align: right;">Rs. ${totalActual.toFixed(2)}</td>
              <td style="text-align: right; color: ${totalVariance === 0 ? '#16a34a' : totalVariance > 0 ? '#0284c7' : '#ef4444'};">
                ${totalVariance >= 0 ? '+' : ''}Rs. ${totalVariance.toFixed(2)}
              </td>
            </tr>` : ''}
          </tbody>
        </table>
      `;
    }

    const html = `
    <html>
    <head>
      <title>${reportTitle}</title>
      <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 20px; color: #333; }
        .header { text-align: center; margin-bottom: 30px; }
        .title { font-size: 20px; font-weight: bold; text-transform: uppercase; margin-bottom: 6px; }
        .subtitle { font-size: 13px; color: #666; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        th { font-size: 12px; font-weight: bold; border-bottom: 2px solid #333; padding: 8px 4px; }
        td { font-size: 12px; border-bottom: 1px solid #ddd; padding: 8px 4px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="title">${reportTitle}</div>
        <div class="subtitle">Generated on ${new Date().toLocaleString()} ${dateRangeStr}</div>
      </div>
      ${bodyHtml}
    </body>
    </html>`;

    const popup = window.open('', '_blank');
    if (!popup) {
      setToast({ type: 'error', message: 'Pop-up blocked! Please allow pop-ups to print reports.' });
      return;
    }
    popup.document.write(html);
    popup.document.close();
    popup.focus();
    popup.onload = () => {
      popup.print();
      popup.close();
    };
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
          className={`category-tab ${activeTab === 'dayend' ? 'active' : ''}`}
          onClick={() => setActiveTab('dayend')}
        >
          Day-End History
        </button>
      </div>

      {/* Filters Area */}
      <div className="glass-panel" style={{ padding: '16px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '24px' }}>
        
        {activeTab !== 'customers' && activeTab !== 'dayend' && (
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

        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button className="btn btn-secondary" onClick={handleExportCSV} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', fontSize: '13px', height: '36px' }}>
            <Download size={14} />
            <span>Export CSV</span>
          </button>
          <button className="btn btn-primary" onClick={handlePrintReport} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', fontSize: '13px', height: '36px' }}>
            <Printer size={14} />
            <span>Print Report</span>
          </button>
          <button className="btn btn-secondary btn-icon" onClick={fetchReportData} title="Refresh Ledger" style={{ height: '36px', width: '36px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <RefreshCw size={14} />
          </button>
        </div>
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

          {/* TAB 4: Day-End History */}
          {activeTab === 'dayend' && (
            <div className="table-container">
              <table className="table-glass">
                <thead>
                  <tr>
                    <th>Session ID</th>
                    <th>Cashier</th>
                    <th>POS Terminal</th>
                    <th>Opened Time</th>
                    <th>Closed Time</th>
                    <th>Expected Cash</th>
                    <th>Actual Cash</th>
                    <th style={{ textAlign: 'right' }}>Variance</th>
                    <th style={{ textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {drawerHistory.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                        No past Day-End closing records found.
                      </td>
                    </tr>
                  ) : (
                    drawerHistory.map((sess) => {
                      const diff = sess.DifferenceAmount || 0;
                      return (
                        <tr key={sess.SessionID}>
                          <td style={{ fontWeight: '600', fontFamily: 'var(--font-mono)' }}>#{sess.SessionID}</td>
                          <td>{sess.CashierName || 'Cashier'}</td>
                          <td>{sess.TerminalID}</td>
                          <td>{new Date(sess.OpeningTime).toLocaleString('en-LK')}</td>
                          <td>{sess.ClosingTime ? new Date(sess.ClosingTime).toLocaleString('en-LK') : '—'}</td>
                          <td className="mono">Rs. {formatCurrency(sess.ExpectedCash)}</td>
                          <td className="mono">Rs. {formatCurrency(sess.ActualCash)}</td>
                          <td className="mono" style={{ textAlign: 'right', fontWeight: '700', color: diff === 0 ? 'var(--success)' : diff > 0 ? 'var(--accent)' : 'var(--danger)' }}>
                            {diff >= 0 ? '+' : ''}Rs. {formatCurrency(diff)}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button 
                              className="btn btn-secondary" 
                              style={{ padding: '4px 10px', fontSize: '12px' }}
                              onClick={() => {
                                setActiveAuditSession(sess);
                                setShowAuditModal(true);
                              }}
                            >
                              Audit Report
                            </button>
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

              {(hasPermission('MANAGE_SETTINGS') || user?.roleName === 'Super Admin' || user?.roleName === 'Admin' || user?.roleName === 'Manager') && 
                activeOrder.order.Status === 'Completed' && (
                <button 
                  className="btn btn-danger" 
                  style={{ background: 'var(--danger)', color: 'white', borderColor: 'var(--danger)' }} 
                  onClick={handleVoidInvoice}
                >
                  Void Invoice
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

      {/* ============================================================================
         MODAL: DAY-END AUDIT REPORT VIEW
         ============================================================================ */}
      {showAuditModal && activeAuditSession && (() => {
        let audit = null;
        try {
          audit = activeAuditSession.ReconciliationData 
            ? (typeof activeAuditSession.ReconciliationData === 'string' 
                ? JSON.parse(activeAuditSession.ReconciliationData) 
                : activeAuditSession.ReconciliationData)
            : null;
        } catch (e) {
          console.error("Failed to parse reconciliation audit data:", e);
        }

        const handleReprintCloseSlip = () => {
          if (!audit) return;
          const denominationsCounts = activeAuditSession.ClosingDenominations 
            ? (typeof activeAuditSession.ClosingDenominations === 'string'
                ? JSON.parse(activeAuditSession.ClosingDenominations)
                : activeAuditSession.ClosingDenominations)
            : {};
          
          const denomsHtml = Object.entries(denominationsCounts).map(([d, cnt]) => {
            const count = Number(cnt) || 0;
            if (count === 0) return '';
            return `
              <div style="display:flex;justify-content:space-between;font-size:10px;">
                <span>Rs. ${d} x ${count}</span>
                <span>Rs. ${formatCurrency(Number(d) * count)}</span>
              </div>`;
          }).join('');

          const printHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Day-End Close Slip Reprint #${activeAuditSession.SessionID}</title>
  <style>
    body { font-family: 'Courier New', Courier, monospace; width: 76mm; margin: 0 auto; padding: 4mm; color: #000; font-size: 11px; }
    hr { border: none; border-top: 1px dashed #000; margin: 6px 0; }
    .text-center { text-align: center; } .text-right { text-align: right; }
    .bold { font-weight: bold; }
    .section-title { font-weight: bold; margin: 8px 0 2px; text-transform: uppercase; font-size: 11.5px; }
    .row { display: flex; justify-content: space-between; margin-bottom: 2px; }
    .indent { padding-left: 8px; }
  </style>
</head>
<body onload="window.print();window.onafterprint=function(){window.close();}">
  <div class="text-center bold" style="font-size:13px;text-transform:uppercase;">DAY-END CLOSING REPORT<br/>[REPRINT]</div>
  <div class="text-center" style="font-size:9.5px;color:#333;margin-top:2px;">POWERED BY SELLMAX PRO</div>
  <hr/>
  <div style="font-size:10px;line-height:1.3;">
    <div>SESSION ID: #${activeAuditSession.SessionID}</div>
    <div>TERMINAL: ${activeAuditSession.TerminalID}</div>
    <div>CASHIER: ${activeAuditSession.CashierName}</div>
    <div>OPENED: ${new Date(activeAuditSession.OpeningTime).toLocaleString()}</div>
    <div>CLOSED: ${activeAuditSession.ClosingTime ? new Date(activeAuditSession.ClosingTime).toLocaleString() : '—'}</div>
  </div>
  <hr/>

  <div class="section-title">A. Sales Summary</div>
  <div class="row indent"><span>Cash Sales:</span><span>Rs. ${formatCurrency(audit.salesSummary?.cashSales || 0)}</span></div>
  <div class="row indent"><span>Credit Sales:</span><span>Rs. ${formatCurrency(audit.salesSummary?.creditSales || 0)}</span></div>
  <div class="row indent"><span>Card Sales:</span><span>Rs. ${formatCurrency(audit.salesSummary?.cardSales || 0)}</span></div>
  <div class="row indent"><span>QR Payments:</span><span>Rs. ${formatCurrency(audit.salesSummary?.qrPayments || 0)}</span></div>
  <div class="row indent"><span>Online Payments:</span><span>Rs. ${formatCurrency(audit.salesSummary?.onlinePayments || 0)}</span></div>
  <div class="row indent bold"><span>Gross Sales:</span><span>Rs. ${formatCurrency(audit.salesSummary?.grossSales || 0)}</span></div>
  <div class="row indent"><span>Less Returns:</span><span>-Rs. ${formatCurrency(audit.salesSummary?.totalRefunds || 0)}</span></div>
  <div class="row indent bold"><span>Net Sales:</span><span>Rs. ${formatCurrency(audit.salesSummary?.netSales || 0)}</span></div>
  <hr/>

  <div class="section-title">B. Cash Collection Summary</div>
  <div class="row indent"><span>Opening Float:</span><span>Rs. ${formatCurrency(audit.cashCollection?.openingBalance || 0)}</span></div>
  <div class="row indent"><span>Cash Sales:</span><span>Rs. ${formatCurrency(audit.cashCollection?.cashSales || 0)}</span></div>
  <div class="row indent"><span>Credit Collections:</span><span>Rs. ${formatCurrency(audit.cashCollection?.creditCollections || 0)}</span></div>
  <div class="row indent"><span>Advance Receipts:</span><span>Rs. ${formatCurrency(audit.cashCollection?.advanceReceipts || 0)}</span></div>
  <div class="row indent"><span>Other Cash Income:</span><span>Rs. ${formatCurrency(audit.cashCollection?.otherIncome || 0)}</span></div>
  <div class="row indent"><span>Previous Inv Collect:</span><span>Rs. ${formatCurrency(audit.cashCollection?.previousInvoices || 0)}</span></div>
  <div class="row indent"><span>Less Cash Refunds:</span><span>-Rs. ${formatCurrency(audit.cashCollection?.cashRefunds || 0)}</span></div>
  <div class="row indent"><span>Less Supplier Payments:</span><span>-Rs. ${formatCurrency(audit.cashCollection?.supplierPayments || 0)}</span></div>
  <div class="row indent"><span>Less Petty Cash:</span><span>-Rs. ${formatCurrency(audit.cashCollection?.pettyCash || 0)}</span></div>
  <div class="row indent"><span>Less Expenses:</span><span>-Rs. ${formatCurrency(audit.cashCollection?.expensePayments || 0)}</span></div>
  <div class="row indent"><span>Less Cash Withdrawals:</span><span>-Rs. ${formatCurrency(audit.cashCollection?.withdrawals || 0)}</span></div>
  <div class="row indent bold"><span>Expected Drawer Cash:</span><span>Rs. ${formatCurrency(audit.cashCollection?.expectedCash || 0)}</span></div>
  <hr/>

  <div class="section-title">C. Payment Reconciliation</div>
  <div class="row indent"><span>Cash Collection:</span><span>Rs. ${formatCurrency(audit.paymentMethods?.cashCollection || 0)}</span></div>
  <div class="row indent"><span>Card Collection:</span><span>Rs. ${formatCurrency(audit.paymentMethods?.cardCollection || 0)}</span></div>
  <div class="row indent"><span>QR Collection:</span><span>Rs. ${formatCurrency(audit.paymentMethods?.qrCollection || 0)}</span></div>
  <div class="row indent"><span>Online Collection:</span><span>Rs. ${formatCurrency(audit.paymentMethods?.onlineCollection || 0)}</span></div>
  <div class="row indent"><span>Bank Transfer Coll:</span><span>Rs. ${formatCurrency(audit.paymentMethods?.bankTransferCollection || 0)}</span></div>
  <div class="row indent bold"><span>Total Collection:</span><span>Rs. ${formatCurrency(audit.paymentMethods?.totalCollection || 0)}</span></div>
  <hr/>

  <div class="section-title">D. Cash Drawer Reconciliation</div>
  <div class="row indent"><span>Expected Cash:</span><span>Rs. ${formatCurrency(activeAuditSession.ExpectedCash)}</span></div>
  <div class="row indent"><span>Physical Cash:</span><span>Rs. ${formatCurrency(activeAuditSession.ActualCash)}</span></div>
  <div class="row indent bold"><span>Difference:</span><span>${activeAuditSession.DifferenceAmount >= 0 ? '+' : ''}Rs. ${formatCurrency(activeAuditSession.DifferenceAmount)}</span></div>
  <hr/>

  <div class="section-title">E. Denominations Breakdown</div>
  ${denomsHtml || '<div style="font-size:10px;text-align:center;">No cash denominations counted</div>'}
  <hr/>

  <div class="section-title">G. Inventory Summary</div>
  <div class="row indent"><span>Sold Qty:</span><span>${Number(audit.inventorySummary?.totalSalesQty || 0).toFixed(2)}</span></div>
  <div class="row indent"><span>Returned Qty:</span><span>${Number(audit.inventorySummary?.totalReturnQty || 0).toFixed(2)}</span></div>
  <div class="row indent"><span>Adjustments Count:</span><span>${audit.inventorySummary?.adjustmentsCount || 0} (${Number(audit.inventorySummary?.totalAdjustedQty || 0).toFixed(2)} units)</span></div>
  <hr/>

  <div class="section-title">H. Exception Report</div>
  <div class="row indent"><span>Price Overrides:</span><span>${audit.exceptions?.overrideCount || 0} (-Rs. ${formatCurrency(audit.exceptions?.overrideReduction || 0)})</span></div>
  <div class="row indent"><span>Manual Discounts:</span><span>${audit.exceptions?.discountCount || 0} (Rs. ${formatCurrency(audit.exceptions?.totalDiscounts || 0)})</span></div>
  <div class="row indent"><span>Negative Stock Sales:</span><span>${audit.exceptions?.negativeStockSalesCount || 0}</span></div>
  <div class="row indent"><span>Backdated Entries:</span><span>${audit.exceptions?.backdatedCount || 0}</span></div>
  <div class="row indent"><span>Voided Invoices:</span><span>${audit.exceptions?.cancelledCount || 0} (Rs. ${formatCurrency(audit.exceptions?.cancelledTotal || 0)})</span></div>
  <div class="row indent"><span>Refunded Invoices:</span><span>${audit.exceptions?.refundCount || 0} (Rs. ${formatCurrency(audit.exceptions?.refundTotal || 0)})</span></div>
  <hr/>
  <div class="text-center" style="margin-top:16px;font-size:10px;">Reprinted from Archive</div>
</body>
</html>`;

          const w = window.open('', '_blank', 'width=450,height=600');
          if (w) {
            w.document.write(printHtml);
            w.document.close();
          }
        };

        return (
          <div className="modal-overlay">
            <div className="modal-content" style={{ width: '800px', maxHeight: '90vh', overflowY: 'auto', padding: '32px', textAlign: 'left' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldAlert size={22} style={{ color: 'var(--primary)' }} />
                  Day-End Reconciliation Audit — Session #{activeAuditSession.SessionID}
                </h3>
                <button 
                  onClick={() => {
                    setShowAuditModal(false);
                    setActiveAuditSession(null);
                  }}
                  style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '20px' }}
                >
                  ✕
                </button>
              </div>

              {!audit ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  <AlertTriangle size={36} style={{ marginBottom: '12px' }} />
                  <p>No detailed audit snapshot data available for this session.</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div className="glass-panel" style={{ padding: '16px' }}>
                      <h4 style={{ margin: '0 0 12px 0', fontSize: '13.5px', fontWeight: 600, color: 'var(--primary)' }}>Shift Information</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12.5px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>Cashier:</span><strong>{activeAuditSession.CashierName}</strong></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>Terminal:</span><strong>{activeAuditSession.TerminalID}</strong></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>Opened:</span><strong>{new Date(activeAuditSession.OpeningTime).toLocaleString()}</strong></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>Closed:</span><strong>{activeAuditSession.ClosingTime ? new Date(activeAuditSession.ClosingTime).toLocaleString() : '—'}</strong></div>
                      </div>
                    </div>

                    <div className="glass-panel" style={{ padding: '16px' }}>
                      <h4 style={{ margin: '0 0 12px 0', fontSize: '13.5px', fontWeight: 600, color: 'var(--success)' }}>Drawer Reconciliation</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12.5px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>Expected Cash:</span><span className="mono">Rs. {formatCurrency(activeAuditSession.ExpectedCash)}</span></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>Physical Count:</span><span className="mono">Rs. {formatCurrency(activeAuditSession.ActualCash)}</span></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '8px', fontWeight: 'bold' }}>
                          <span>Variance:</span>
                          <span className="mono" style={{ color: activeAuditSession.DifferenceAmount === 0 ? 'var(--success)' : activeAuditSession.DifferenceAmount > 0 ? 'var(--accent)' : 'var(--danger)' }}>
                            {activeAuditSession.DifferenceAmount >= 0 ? '+' : ''}Rs. {formatCurrency(activeAuditSession.DifferenceAmount)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="glass-panel" style={{ padding: '16px' }}>
                      <h4 style={{ margin: '0 0 12px 0', fontSize: '13.5px', fontWeight: 600, color: 'var(--accent)' }}>Net Collections by Payment Method</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12.5px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>Cash Collection:</span><span className="mono">Rs. {formatCurrency(audit.paymentMethods?.cashCollection || 0)}</span></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>Card Collection:</span><span className="mono">Rs. {formatCurrency(audit.paymentMethods?.cardCollection || 0)}</span></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>QR Collection:</span><span className="mono">Rs. {formatCurrency(audit.paymentMethods?.qrCollection || 0)}</span></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>Online Payments:</span><span className="mono">Rs. {formatCurrency(audit.paymentMethods?.onlineCollection || 0)}</span></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>Bank Transfer:</span><span className="mono">Rs. {formatCurrency(audit.paymentMethods?.bankTransferCollection || 0)}</span></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '8px', fontWeight: 'bold' }}>
                          <span>Total Collections:</span>
                          <span className="mono">Rs. {formatCurrency(audit.paymentMethods?.totalCollection || 0)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div className="glass-panel" style={{ padding: '16px' }}>
                      <h4 style={{ margin: '0 0 12px 0', fontSize: '13.5px', fontWeight: 600, color: 'var(--text-primary)' }}>Sales & Cash Audits</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11.5px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>Gross Sales (A):</span><span className="mono">Rs. {formatCurrency(audit.salesSummary?.grossSales || 0)}</span></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>Less Returns / Notes (A):</span><span className="mono">-Rs. {formatCurrency(audit.salesSummary?.totalRefunds || 0)}</span></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', marginBottom: '6px' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Net Sales (A):</span>
                          <span className="mono">Rs. {formatCurrency(audit.salesSummary?.netSales || 0)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed var(--border-color)', paddingTop: '6px' }}><span style={{ color: 'var(--text-secondary)' }}>Cash Sales (B):</span><span className="mono">Rs. {formatCurrency(audit.cashCollection?.cashSales || 0)}</span></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>Manual Cash Received (B):</span><span className="mono">Rs. {formatCurrency(
                          (audit.cashCollection?.creditCollections || 0) + 
                          (audit.cashCollection?.advanceReceipts || 0) + 
                          (audit.cashCollection?.otherIncome || 0) + 
                          (audit.cashCollection?.previousInvoices || 0)
                        )}</span></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>Manual Cash Payouts (B):</span><span className="mono">-Rs. {formatCurrency(
                          (audit.cashCollection?.pettyCash || 0) + 
                          (audit.cashCollection?.expensePayments || 0) + 
                          (audit.cashCollection?.withdrawals || 0)
                        )}</span></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>Supplier Payments (B):</span><span className="mono">-Rs. {formatCurrency(audit.cashCollection?.supplierPayments || 0)}</span></div>
                      </div>
                    </div>

                    <div className="glass-panel" style={{ padding: '16px' }}>
                      <h4 style={{ margin: '0 0 12px 0', fontSize: '13.5px', fontWeight: 600, color: 'var(--danger)' }}>Exceptions Report (H)</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', fontSize: '11.5px' }}>
                        <div>
                          <span style={{ color: 'var(--text-secondary)', display: 'block' }}>Price Overrides:</span>
                          <strong>{audit.exceptions?.overrideCount || 0} (-Rs. {formatCurrency(audit.exceptions?.overrideReduction || 0)})</strong>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-secondary)', display: 'block' }}>Manual Discounts:</span>
                          <strong>{audit.exceptions?.discountCount || 0} (Rs. {formatCurrency(audit.exceptions?.totalDiscounts || 0)})</strong>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-secondary)', display: 'block' }}>Negative Stock Sales:</span>
                          <strong>{audit.exceptions?.negativeStockSalesCount || 0}</strong>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-secondary)', display: 'block' }}>Backdated Entries:</span>
                          <strong>{audit.exceptions?.backdatedCount || 0}</strong>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-secondary)', display: 'block' }}>Voided Invoices:</span>
                          <strong>{audit.exceptions?.cancelledCount || 0} (Rs. {formatCurrency(audit.exceptions?.cancelledTotal || 0)})</strong>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-secondary)', display: 'block' }}>Refunded Invoices:</span>
                          <strong>{audit.exceptions?.refundCount || 0} (Rs. {formatCurrency(audit.exceptions?.refundTotal || 0)})</strong>
                        </div>
                      </div>
                    </div>

                    <div className="glass-panel" style={{ padding: '16px' }}>
                      <h4 style={{ margin: '0 0 12px 0', fontSize: '13.5px', fontWeight: 600, color: 'var(--text-muted)' }}>Inventory Movement Summary (G)</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>Sold Qty:</span><strong>{Number(audit.inventorySummary?.totalSalesQty || 0).toFixed(2)} units</strong></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>Returned Qty:</span><strong>{Number(audit.inventorySummary?.totalReturnQty || 0).toFixed(2)} units</strong></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>Approved Adjustments:</span><strong>{audit.inventorySummary?.adjustmentsCount || 0} ({Number(audit.inventorySummary?.totalAdjustedQty || 0).toFixed(2)} units)</strong></div>
                      </div>
                    </div>
                  </div>

                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <button 
                  className="btn btn-secondary" 
                  onClick={() => {
                    setShowAuditModal(false);
                    setActiveAuditSession(null);
                  }}
                >
                  Close Audit
                </button>
                <button 
                  className="btn btn-primary" 
                  onClick={handleReprintCloseSlip}
                  disabled={!audit}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Printer size={16} />
                  Reprint closing Slip
                </button>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
}
