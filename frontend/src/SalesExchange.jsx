import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from './contexts/AuthContext';
import formatCurrency from './utils/formatCurrency';
import { 
  Search, ArrowLeft, RefreshCw, Printer, Download, Plus, Minus, Trash2, 
  Calendar, FileText, User, ShoppingBag, DollarSign, CheckCircle2, 
  RotateCcw, AlertTriangle 
} from 'lucide-react';

export default function SalesExchange({ setToast }) {
  const { token, API_URL } = useAuth();
  
  // Navigation & Tabs
  const [activeTab, setActiveTab] = useState('workspace'); // 'workspace' or 'reports'
  const [reportsActiveTab, setReportsActiveTab] = useState('returns'); // 'returns', 'refunds', 'exchanges', 'settlements'

  // Workspace State: Invoice Search & Return items selection
  const [invoiceIdSearch, setInvoiceIdSearch] = useState('');
  const [originalOrder, setOriginalOrder] = useState(null);
  const [loadingInvoice, setLoadingInvoice] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [returnItems, setReturnItems] = useState([]); // Array of { productId, name, price, cost, quantity, purchasedQty, batchNo }

  // Workspace State: Replacement Cart / Catalog
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [catalogSearchQuery, setCatalogSearchQuery] = useState('');
  const [showCatalogDropdown, setShowCatalogDropdown] = useState(false);
  const [exchangeCart, setExchangeCart] = useState([]); // Array of { productId, name, price, cost, quantity, stock }

  // Workspace State: Payments & Refunds
  const [paymentModes, setPaymentModes] = useState({
    Cash: '',
    Visa: '',
    Master: '',
    Amex: '',
    QR: '',
    Online: '',
    BankTransfer: '',
    Cheque: ''
  });
  const [modeReferences, setModeReferences] = useState({
    Visa: '',
    Master: '',
    Amex: '',
    QR: '',
    Online: '',
    BankTransfer: '',
    Cheque: ''
  });

  // Receipt Slip Modal
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptDetails, setReceiptDetails] = useState(null);
  const [companyInfo, setCompanyInfo] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reports State
  const [reportsData, setReportsData] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [datePreset, setDatePreset] = useState('all');

  const catalogDropdownRef = useRef(null);

  // Fetch initial data
  useEffect(() => {
    fetchProducts();
    fetchCompanyInfo();
  }, []);

  // Handle outside clicks to close catalog search dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (catalogDropdownRef.current && !catalogDropdownRef.current.contains(event.target)) {
        setShowCatalogDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch reports data when report sub-tab or dates change
  useEffect(() => {
    if (activeTab === 'reports') {
      fetchReportData();
    }
  }, [activeTab, reportsActiveTab, startDate, endDate]);

  const fetchProducts = async () => {
    try {
      const res = await fetch(`${API_URL}/api/inventory/products`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setCatalogProducts(await res.json());
      }
    } catch (err) {
      console.error('Failed to fetch products:', err);
    }
  };

  const fetchCompanyInfo = async () => {
    try {
      const res = await fetch(`${API_URL}/api/company`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setCompanyInfo(await res.json());
      }
    } catch (err) {
      console.error('Failed to fetch company info:', err);
    }
  };

  const handleSearchInvoice = async (e) => {
    if (e) e.preventDefault();
    if (!invoiceIdSearch.trim()) return;
    setLoadingInvoice(true);
    setSearchError('');
    setOriginalOrder(null);
    setReturnItems([]);
    setExchangeCart([]);
    handleResetPayments();

    try {
      const orderId = invoiceIdSearch.replace(/^\D+/g, ''); // strip leading letters like SM-
      const res = await fetch(`${API_URL}/api/sales/history/${orderId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Invoice not found.');
      }
      if (data.order.Status === 'Cancelled') {
        throw new Error('This invoice has been VOIDED and cannot be returned or exchanged.');
      }
      setOriginalOrder(data);
      setReturnItems(data.items.map(item => ({
        productId: item.ProductID,
        name: item.ProductName,
        price: item.Price,
        cost: item.Cost,
        purchasedQty: item.Quantity,
        quantity: 0,
        batchNo: item.BatchNo || null
      })));
    } catch (err) {
      setSearchError(err.message);
      setToast({ type: 'error', message: err.message });
    } finally {
      setLoadingInvoice(false);
    }
  };

  // Calculations: Return Amounts
  const returnSubtotal = returnItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const originalSubtotal = originalOrder?.order?.Subtotal || 1;
  const originalDiscount = originalOrder?.order?.DiscountAmount || 0;
  const discountRatio = originalDiscount / originalSubtotal;
  const returnDiscount = Number((returnSubtotal * discountRatio).toFixed(2));
  const returnTax = Number(((returnSubtotal - returnDiscount) * 0.10).toFixed(2)); // Standard 10% VAT
  const returnTotal = Number((returnSubtotal - returnDiscount + returnTax).toFixed(2));

  // Calculations: New Purchase Amounts
  const newSubtotal = exchangeCart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const newDiscount = 0; // standard replacement cart is zero discount by default
  const newTax = Number(((newSubtotal - newDiscount) * 0.10).toFixed(2));
  const newTotal = Number((newSubtotal - newDiscount + newTax).toFixed(2));

  // Calculations: Net Balance
  // netBalance > 0: Customer pays balance due.
  // netBalance < 0: System refunds customer.
  const netBalance = newTotal - returnTotal;
  const isExchange = exchangeCart.length > 0;

  // Split Payment totals
  const totalPaid = Object.values(paymentModes).reduce((sum, val) => {
    const parsed = parseFloat(val);
    return sum + (isNaN(parsed) ? 0 : parsed);
  }, 0);

  const handleReturnQtyChange = (productId, qty) => {
    setReturnItems(returnItems.map(item => {
      if (item.productId === productId) {
        const val = parseFloat(qty);
        const sanitized = isNaN(val) ? 0 : Math.min(item.purchasedQty, Math.max(0, val));
        return { ...item, quantity: sanitized };
      }
      return item;
    }));
  };

  const handleAddToCart = (product) => {
    const existing = exchangeCart.find(item => item.productId === product.ProductID);
    if (existing) {
      setExchangeCart(exchangeCart.map(item => {
        if (item.productId === product.ProductID) {
          return { ...item, quantity: item.quantity + 1 };
        }
        return item;
      }));
    } else {
      setExchangeCart([...exchangeCart, {
        productId: product.ProductID,
        name: product.Name,
        price: product.Price,
        cost: product.Cost,
        quantity: 1,
        stock: product.Stock
      }]);
    }
    setCatalogSearchQuery('');
    setShowCatalogDropdown(false);
  };

  const handleUpdateExchangeCartQty = (productId, qty) => {
    const val = parseFloat(qty);
    if (isNaN(val) || val <= 0) {
      setExchangeCart(exchangeCart.filter(item => item.productId !== productId));
    } else {
      setExchangeCart(exchangeCart.map(item => {
        if (item.productId === productId) {
          return { ...item, quantity: val };
        }
        return item;
      }));
    }
  };

  const handleRemoveFromExchangeCart = (productId) => {
    setExchangeCart(exchangeCart.filter(item => item.productId !== productId));
  };

  const handleModeChange = (mode, value) => {
    if (value === '' || /^\d*\.?\d{0,2}$/.test(value)) {
      setPaymentModes({
        ...paymentModes,
        [mode]: value
      });
    }
  };

  const handleResetPayments = () => {
    setPaymentModes({
      Cash: '',
      Visa: '',
      Master: '',
      Amex: '',
      QR: '',
      Online: '',
      BankTransfer: '',
      Cheque: ''
    });
    setModeReferences({
      Visa: '',
      Master: '',
      Amex: '',
      QR: '',
      Online: '',
      BankTransfer: '',
      Cheque: ''
    });
  };

  const handleResetWorkspace = () => {
    setOriginalOrder(null);
    setReturnItems([]);
    setExchangeCart([]);
    setInvoiceIdSearch('');
    handleResetPayments();
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();

    const activeReturnItems = returnItems.filter(item => item.quantity > 0);
    if (activeReturnItems.length === 0) {
      setToast({ type: 'error', message: 'Please select at least one item to return.' });
      return;
    }

    const isExchange = exchangeCart.length > 0;
    
    // Payment Validation
    if (isExchange) {
      if (netBalance > 0) {
        if (Math.abs(totalPaid - netBalance) > 0.01) {
          setToast({ type: 'error', message: `Customer payment mismatch. Balance due: Rs. ${formatCurrency(netBalance)}, Paid: Rs. ${formatCurrency(totalPaid)}` });
          return;
        }
      } else if (netBalance < 0) {
        if (Math.abs(totalPaid - Math.abs(netBalance)) > 0.01) {
          setToast({ type: 'error', message: `Refund payment mismatch. Refund due: Rs. ${formatCurrency(Math.abs(netBalance))}, Processed: Rs. ${formatCurrency(totalPaid)}` });
          return;
        }
      } else {
        if (totalPaid > 0) {
          setToast({ type: 'error', message: 'No payments required for exact net-value exchange.' });
          return;
        }
      }
    } else {
      // Pure Refund
      if (Math.abs(totalPaid - returnTotal) > 0.01) {
        setToast({ type: 'error', message: `Refund payment mismatch. Refund due: Rs. ${formatCurrency(returnTotal)}, Processed: Rs. ${formatCurrency(totalPaid)}` });
        return;
      }
    }

    // Build extra/payout payment arrays
    const formattedPayments = Object.entries(paymentModes)
      .filter(([_, amount]) => parseFloat(amount) > 0)
      .map(([method, amount]) => {
        let cleanMethod = method;
        if (['Visa', 'Master', 'Amex'].includes(method)) cleanMethod = `${method} Card`;
        if (method === 'QR') cleanMethod = 'QR Payment';
        if (method === 'BankTransfer') cleanMethod = 'Bank Transfer';
        if (method === 'Online') cleanMethod = 'Online Payment';

        return {
          method: cleanMethod,
          amount: parseFloat(amount),
          referenceNumber: modeReferences[method] || null
        };
      });

    // Check Credit Limit if customer is purchasing extra on Credit
    const creditPayment = formattedPayments.find(p => p.method === 'Credit');
    if (creditPayment && originalOrder.order.CustomerID) {
      try {
        const custRes = await fetch(`${API_URL}/api/customers/${originalOrder.order.CustomerID}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (custRes.ok) {
          const customer = await custRes.json();
          if (customer.CurrentBalance + creditPayment.amount > customer.CreditLimit) {
            setToast({ type: 'error', message: `Credit limit exceeded. Limit: Rs. ${customer.CreditLimit}, Current Balance: Rs. ${customer.CurrentBalance}, Extra Credit: Rs. ${creditPayment.amount}` });
            return;
          }
        }
      } catch (err) {
        console.error(err);
      }
    }

    // Payload construction
    const payload = {
      originalOrderId: originalOrder.order.OrderID,
      customerId: originalOrder.order.CustomerID,
      returnItems: activeReturnItems.map(item => ({
        productId: item.productId,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        cost: item.cost,
        batchNo: item.batchNo
      })),
      returnPayments: isExchange
        ? (netBalance < 0 ? formattedPayments : [{ method: 'Exchange Set-off', amount: returnTotal }])
        : formattedPayments,
      newOrder: isExchange ? {
        items: exchangeCart.map(item => ({
          productId: item.productId,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          cost: item.cost
        })),
        discountAmount: 0,
        taxAmount: newTax,
        totalAmount: newTotal,
        payments: netBalance > 0
          ? [ { method: 'Exchange Set-off', amount: returnTotal }, ...formattedPayments ]
          : [ { method: 'Exchange Set-off', amount: newTotal } ]
      } : null
    };

    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/sales/exchange`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to process exchange.');

      setToast({ type: 'success', message: data.message });
      
      // Store details for showing receipt
      setReceiptDetails({
        originalOrderID: originalOrder.order.OrderID,
        customerName: originalOrder.order.CustomerName || 'Walk-in Customer',
        customerPhone: originalOrder.order.CustomerPhone,
        returnOrderId: data.returnOrderId,
        newOrderId: data.newOrderId,
        returnItems: activeReturnItems,
        exchangeItems: exchangeCart,
        returnTotal,
        newTotal,
        netBalance,
        payments: formattedPayments,
        date: new Date()
      });
      setShowReceiptModal(true);

      // Reset
      handleResetWorkspace();
    } catch (err) {
      setToast({ type: 'error', message: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrintExchangeSlip = () => {
    if (!receiptDetails) return;

    const logoUrl = companyInfo?.LogoURL ? (companyInfo.LogoURL.startsWith('http') ? companyInfo.LogoURL : `${API_URL}${companyInfo.LogoURL}`) : null;
    const addressParts = [companyInfo?.AddressLine1, companyInfo?.AddressLine2, companyInfo?.City].filter(Boolean).join(', ');
    const contactParts = [companyInfo?.Phone, companyInfo?.Email].filter(Boolean).join(' | ');

    const returnRowsHtml = receiptDetails.returnItems.map(item => `
      <div class="sum-row">
        <span>${item.name} x ${item.quantity}</span>
        <span>Rs. ${Number(item.price * item.quantity).toFixed(2)}</span>
      </div>
    `).join('');

    const exchangeRowsHtml = receiptDetails.exchangeItems.map(item => `
      <div class="sum-row">
        <span>${item.name} x ${item.quantity}</span>
        <span>Rs. ${Number(item.price * item.quantity).toFixed(2)}</span>
      </div>
    `).join('');

    const paymentsHtml = receiptDetails.payments.length > 0 
      ? receiptDetails.payments.map(p => `
        <div class="sum-row" style="font-size: 11px;">
          <span>- ${p.method}${p.referenceNumber ? ` (${p.referenceNumber})` : ''}</span>
          <span>Rs. ${Number(p.amount).toFixed(2)}</span>
        </div>
      `).join('')
      : '<div style="font-size: 11px; text-align: center; color: #555;">No extra cash exchange</div>';

    const netText = receiptDetails.netBalance > 0 
      ? `EXTRA RECEIVED: Rs. ${Number(receiptDetails.netBalance).toFixed(2)}`
      : receiptDetails.netBalance < 0 
        ? `REFUND PAID OUT: Rs. ${Number(Math.abs(receiptDetails.netBalance)).toFixed(2)}`
        : `EXACT EXCHANGE SET-OFF`;

    const html = `
    <html>
    <head>
    <title>Exchange Return Slip - ${receiptDetails.returnOrderId}</title>
    <style>
      body { font-family: 'Courier New', Courier, monospace; width: 280px; margin: 0; padding: 10px; color: #000; font-size: 12px; }
      .header { text-align: center; margin-bottom: 8px; }
      .logo { max-width: 80px; height: auto; margin-bottom: 4px; }
      .company-name { font-size: 14px; font-weight: bold; text-transform: uppercase; }
      .company-sub { font-size: 10px; color: #111; margin-top: 2px; line-height: 1.3; }
      .meta { font-size: 11px; line-height: 1.6; border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 4px 0; margin: 8px 0; }
      .sum-row { display: flex; justify-content: space-between; padding: 2px 0; }
      .sum-total { display: flex; justify-content: space-between; font-size: 12px; font-weight: bold; border-top: 1px solid #000; margin-top: 4px; padding-top: 4px; }
      .section-title { font-weight: bold; font-size: 11px; border-bottom: 1px dashed #000; padding-bottom: 2px; margin-top: 8px; margin-bottom: 4px; text-transform: uppercase; }
      .footer { text-align: center; border-top: 1px dashed #000; margin-top: 12px; padding-top: 6px; font-size: 10px; }
      .net-summary { font-size: 12px; font-weight: bold; text-align: center; border: 1px solid #000; padding: 6px; margin: 8px 0; text-transform: uppercase; }
    </style>
    </head>
    <body>
      <div class="header">
        ${logoUrl ? `<img class="logo" src="${logoUrl}">` : ''}
        <div class="company-name">${companyInfo?.Name || 'SELLMAX PRO'}</div>
        <div class="company-sub">${addressParts}<br>${contactParts}</div>
      </div>
      
      <div class="meta">
        <div><strong>RETURN SLIP:</strong> #SRN-${receiptDetails.returnOrderId}</div>
        ${receiptDetails.newOrderId ? `<div><strong>NEW INVOICE:</strong> #SM-${receiptDetails.newOrderId}</div>` : ''}
        <div><strong>DATE:</strong> ${new Date(receiptDetails.date).toLocaleString()}</div>
        <div><strong>ORIGINAL INV:</strong> #SM-${receiptDetails.originalOrderID}</div>
        <div><strong>CUSTOMER:</strong> ${receiptDetails.customerName}</div>
      </div>

      <div class="section-title">Items Returned</div>
      ${returnRowsHtml}
      <div class="sum-total" style="border-bottom: 1px dashed #000; padding-bottom: 4px; margin-bottom: 8px;">
        <span>RETURN VALUE:</span>
        <span>Rs. ${Number(receiptDetails.returnTotal).toFixed(2)}</span>
      </div>

      ${receiptDetails.exchangeItems.length > 0 ? `
        <div class="section-title">Items Selected in Exchange</div>
        ${exchangeRowsHtml}
        <div class="sum-total">
          <span>EXCHANGE TOTAL:</span>
          <span>Rs. ${Number(receiptDetails.newTotal).toFixed(2)}</span>
        </div>
      ` : ''}

      <div class="net-summary">${netText}</div>

      <div class="section-title">Exchange Settlement</div>
      ${paymentsHtml}

      <div class="footer">
        <p>Exchange process audit logged.</p>
        <p style="font-size: 9px; margin-top: 4px;">Powered by SellMax Pro</p>
      </div>
    </body>
    </html>`;

    const popup = window.open('', '_blank', 'width=320,height=600,toolbar=0,menubar=0,location=0,status=0');
    if (!popup) {
      setToast({ type: 'error', message: 'Pop-up blocked! Please allow pop-ups to print exchange receipts.' });
      return;
    }
    popup.document.write(html);
    popup.document.close();
    setTimeout(() => {
      popup.print();
      popup.close();
    }, 250);
  };

  // Reports Functions
  const fetchReportData = async () => {
    setReportsLoading(true);
    try {
      let endpoint = '';
      if (reportsActiveTab === 'returns') endpoint = 'returns';
      else if (reportsActiveTab === 'refunds') endpoint = 'refunds';
      else if (reportsActiveTab === 'exchanges') endpoint = 'exchanges';
      else if (reportsActiveTab === 'settlements') endpoint = 'settlements';

      let url = `${API_URL}/api/reports/exchange-reports/${endpoint}`;
      const queryParams = [];
      if (startDate) queryParams.push(`startDate=${startDate}`);
      if (endDate) queryParams.push(`endDate=${endDate}`);
      if (queryParams.length > 0) {
        url += `?${queryParams.join('&')}`;
      }

      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setReportsData(await res.json());
      } else {
        setReportsData([]);
      }
    } catch (err) {
      console.error('Failed to fetch reports:', err);
      setToast({ type: 'error', message: 'Failed to retrieve reports.' });
    } finally {
      setReportsLoading(false);
    }
  };

  const handlePresetChange = (preset) => {
    setDatePreset(preset);
    const today = new Date();
    let start = '';
    let end = '';

    const format = (d) => d.toISOString().split('T')[0];

    if (preset === 'today') {
      start = format(today);
      end = format(today);
    } else if (preset === 'yesterday') {
      const yest = new Date(today);
      yest.setDate(yest.getDate() - 1);
      start = format(yest);
      end = format(yest);
    } else if (preset === 'this-week') {
      const currentWeekDay = today.getDay();
      const diff = today.getDate() - currentWeekDay + (currentWeekDay === 0 ? -6 : 1); // Monday
      const mon = new Date(today.setDate(diff));
      start = format(mon);
      end = format(new Date());
    } else if (preset === 'this-month') {
      const mon = new Date(today.getFullYear(), today.getMonth(), 1);
      start = format(mon);
      end = format(new Date());
    } else {
      start = '';
      end = '';
    }

    setStartDate(start);
    setEndDate(end);
  };

  const handleExportCSV = () => {
    const sanitize = (val) => {
      if (val === null || val === undefined) return '';
      let str = String(val).replace(/"/g, '""');
      if (str.includes(',') || str.includes('\n') || str.includes('"')) {
        str = `"${str}"`;
      }
      return str;
    };

    const downloadCSV = (headers, rows, filename) => {
      const csvRows = [
        headers.map(sanitize).join(','),
        ...rows.map(row => row.map(sanitize).join(','))
      ];
      const csvContent = "\uFEFF" + csvRows.join('\r\n');
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

    const fileDateStr = new Date().toISOString().split('T')[0];

    if (reportsActiveTab === 'returns') {
      const headers = ['Return Order ID', 'Return Date', 'Original Order ID', 'Customer Name', 'Cashier Name', 'Subtotal', 'Discount', 'Tax', 'Total Amount', 'Return Type'];
      const rows = reportsData.map(r => [
        `#SRN-${r.ReturnOrderID}`,
        new Date(r.ReturnDate).toLocaleDateString(),
        `#SM-${r.OriginalOrderID}`,
        r.CustomerName || 'Walk-in Customer',
        r.CashierName,
        r.Subtotal,
        r.DiscountAmount,
        r.TaxAmount,
        r.TotalAmount,
        r.ReturnType
      ]);
      downloadCSV(headers, rows, `Sales_Returns_Report_${fileDateStr}.csv`);
    } else if (reportsActiveTab === 'refunds') {
      const headers = ['Return Order ID', 'Return Date', 'Original Order ID', 'Customer Name', 'Cashier Name', 'Refunded Amount', 'Refund Methods'];
      const rows = reportsData.map(r => [
        `#SRN-${r.ReturnOrderID}`,
        new Date(r.ReturnDate).toLocaleDateString(),
        `#SM-${r.OriginalOrderID}`,
        r.CustomerName || 'Walk-in Customer',
        r.CashierName,
        r.RefundedAmount,
        r.RefundMethods
      ]);
      downloadCSV(headers, rows, `Refunds_Report_${fileDateStr}.csv`);
    } else if (reportsActiveTab === 'exchanges') {
      const headers = ['Return Order ID', 'Return Date', 'Original Order ID', 'New Invoice ID', 'Customer Name', 'Cashier Name', 'Return Value'];
      const rows = reportsData.map(r => [
        `#SRN-${r.ReturnOrderID}`,
        new Date(r.ReturnDate).toLocaleDateString(),
        `#SM-${r.OriginalOrderID}`,
        r.NewOrderID ? `#SM-${r.NewOrderID}` : '—',
        r.CustomerName || 'Walk-in Customer',
        r.CashierName,
        r.ReturnValue
      ]);
      downloadCSV(headers, rows, `Exchanges_Report_${fileDateStr}.csv`);
    } else if (reportsActiveTab === 'settlements') {
      const headers = ['New Invoice ID', 'Sale Date', 'Return Order ID', 'Customer Name', 'Cashier Name', 'New Invoice Total', 'Exchange Offset', 'Net Settlement', 'Settlement Modes'];
      const rows = reportsData.map(r => [
        `#SM-${r.NewOrderID}`,
        new Date(r.SaleDate).toLocaleDateString(),
        `#SRN-${r.ReturnOrderID}`,
        r.CustomerName || 'Walk-in Customer',
        r.CashierName,
        r.NewInvoiceTotal,
        r.ExchangeOffset,
        r.NetSettlement,
        r.SettlementModes
      ]);
      downloadCSV(headers, rows, `Exchange_Settlements_Report_${fileDateStr}.csv`);
    }
  };

  const handlePrintReport = () => {
    let reportTitle = '';
    let tableHeadersHtml = '';
    let tableRowsHtml = '';

    if (reportsActiveTab === 'returns') {
      reportTitle = 'Sales Returns & Allowances Audit Report';
      tableHeadersHtml = `
        <tr>
          <th>Return ID</th>
          <th>Return Date</th>
          <th>Original Inv ID</th>
          <th>Customer Name</th>
          <th>Cashier</th>
          <th style="text-align: right;">Subtotal</th>
          <th style="text-align: right;">Discount</th>
          <th style="text-align: right;">VAT</th>
          <th style="text-align: right;">Total Return</th>
          <th>Type</th>
        </tr>
      `;
      tableRowsHtml = reportsData.map(r => `
        <tr>
          <td>#SRN-${r.ReturnOrderID}</td>
          <td>${new Date(r.ReturnDate).toLocaleDateString()}</td>
          <td>#SM-${r.OriginalOrderID}</td>
          <td>${r.CustomerName || 'Walk-in Customer'}</td>
          <td>${r.CashierName}</td>
          <td style="text-align: right;">Rs. ${Number(r.Subtotal).toFixed(2)}</td>
          <td style="text-align: right; color: #d97706;">Rs. ${Number(r.DiscountAmount).toFixed(2)}</td>
          <td style="text-align: right;">Rs. ${Number(r.TaxAmount).toFixed(2)}</td>
          <td style="text-align: right; font-weight: bold; color: #0284c7;">Rs. ${Number(r.TotalAmount).toFixed(2)}</td>
          <td>${r.ReturnType}</td>
        </tr>
      `).join('');
    } else if (reportsActiveTab === 'refunds') {
      reportTitle = 'Direct Refund Disbursements Report';
      tableHeadersHtml = `
        <tr>
          <th>Return ID</th>
          <th>Return Date</th>
          <th>Original Inv ID</th>
          <th>Customer Name</th>
          <th>Cashier</th>
          <th style="text-align: right;">Refunded Amount</th>
          <th>Payout Methods</th>
        </tr>
      `;
      tableRowsHtml = reportsData.map(r => `
        <tr>
          <td>#SRN-${r.ReturnOrderID}</td>
          <td>${new Date(r.ReturnDate).toLocaleDateString()}</td>
          <td>#SM-${r.OriginalOrderID}</td>
          <td>${r.CustomerName || 'Walk-in Customer'}</td>
          <td>${r.CashierName}</td>
          <td style="text-align: right; font-weight: bold; color: #ef4444;">Rs. ${Number(r.RefundedAmount).toFixed(2)}</td>
          <td>${r.RefundMethods}</td>
        </tr>
      `).join('');
    } else if (reportsActiveTab === 'exchanges') {
      reportTitle = 'Sales Exchanges Audit Report';
      tableHeadersHtml = `
        <tr>
          <th>Return ID</th>
          <th>Return Date</th>
          <th>Original Inv ID</th>
          <th>New Exchange Inv ID</th>
          <th>Customer Name</th>
          <th>Cashier</th>
          <th style="text-align: right;">Return Credit Value</th>
        </tr>
      `;
      tableRowsHtml = reportsData.map(r => `
        <tr>
          <td>#SRN-${r.ReturnOrderID}</td>
          <td>${new Date(r.ReturnDate).toLocaleDateString()}</td>
          <td>#SM-${r.OriginalOrderID}</td>
          <td>${r.NewOrderID ? `#SM-${r.NewOrderID}` : '—'}</td>
          <td>${r.CustomerName || 'Walk-in Customer'}</td>
          <td>${r.CashierName}</td>
          <td style="text-align: right; font-weight: bold; color: #16a34a;">Rs. ${Number(r.ReturnValue).toFixed(2)}</td>
        </tr>
      `).join('');
    } else if (reportsActiveTab === 'settlements') {
      reportTitle = 'Exchange Cash Settlements Report';
      tableHeadersHtml = `
        <tr>
          <th>New Inv ID</th>
          <th>Sale Date</th>
          <th>Return ID</th>
          <th>Customer Name</th>
          <th>Cashier</th>
          <th style="text-align: right;">Replacement Total</th>
          <th style="text-align: right;">Set-off Credit</th>
          <th style="text-align: right;">Net Balance</th>
          <th>Settlement Channels</th>
        </tr>
      `;
      tableRowsHtml = reportsData.map(r => `
        <tr>
          <td>#SM-${r.NewOrderID}</td>
          <td>${new Date(r.SaleDate).toLocaleDateString()}</td>
          <td>#SRN-${r.ReturnOrderID}</td>
          <td>${r.CustomerName || 'Walk-in Customer'}</td>
          <td>${r.CashierName}</td>
          <td style="text-align: right;">Rs. ${Number(r.NewInvoiceTotal).toFixed(2)}</td>
          <td style="text-align: right; color: #16a34a;">Rs. ${Number(r.ExchangeOffset).toFixed(2)}</td>
          <td style="text-align: right; font-weight: bold; color: ${r.NetSettlement >= 0 ? '#0284c7' : '#ef4444'};">
            ${r.NetSettlement >= 0 ? '+' : '-'}Rs. ${Number(Math.abs(r.NetSettlement)).toFixed(2)}
          </td>
          <td>${r.SettlementModes}</td>
        </tr>
      `).join('');
    }

    const html = `
    <html>
    <head>
      <title>${reportTitle}</title>
      <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 20px; color: #333; }
        .header { text-align: center; margin-bottom: 30px; }
        .title { font-size: 18px; font-weight: bold; text-transform: uppercase; margin-bottom: 6px; }
        .subtitle { font-size: 12px; color: #666; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        th { font-size: 11px; font-weight: bold; border-bottom: 2px solid #333; padding: 8px 4px; text-align: left; }
        td { font-size: 11px; border-bottom: 1px solid #ddd; padding: 8px 4px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="title">${reportTitle}</div>
        <div class="subtitle">Generated on ${new Date().toLocaleString()} ${startDate || endDate ? `(Filter: ${startDate || 'Start'} to ${endDate || 'End'})` : '(All Time)'}</div>
      </div>
      <table>
        <thead>${tableHeadersHtml}</thead>
        <tbody>
          ${tableRowsHtml.length > 0 ? tableRowsHtml : '<tr><td colspan="10" style="text-align:center;">No records found.</td></tr>'}
        </tbody>
      </table>
    </body>
    </html>`;

    const popup = window.open('', '_blank');
    if (!popup) {
      setToast({ type: 'error', message: 'Pop-up blocked! Allow pop-ups to print reports.' });
      return;
    }
    popup.document.write(html);
    popup.document.close();
    setTimeout(() => {
      popup.print();
      popup.close();
    }, 250);
  };

  const filteredProducts = catalogSearchQuery
    ? catalogProducts.filter(p => 
        p.Name.toLowerCase().includes(catalogSearchQuery.toLowerCase()) ||
        p.SKU.toLowerCase().includes(catalogSearchQuery.toLowerCase()) ||
        (p.Barcode && p.Barcode.includes(catalogSearchQuery))
      )
    : catalogProducts;

  return (
    <div>
      {/* Top Main Tabs */}
      <div className="category-tabs" style={{ marginBottom: '24px' }}>
        <button 
          className={`category-tab ${activeTab === 'workspace' ? 'active' : ''}`}
          onClick={() => setActiveTab('workspace')}
        >
          Exchange Workspace
        </button>
        <button 
          className={`category-tab ${activeTab === 'reports' ? 'active' : ''}`}
          onClick={() => setActiveTab('reports')}
        >
          Exchange Reports
        </button>
      </div>

      {activeTab === 'workspace' ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'start' }}>
          
          {/* LEFT SIDE: Original Invoice & Items Selection */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Invoice Search Card */}
            <div className="glass-panel" style={{ padding: '20px', zIndex: 10 }}>
              <h3 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Search size={18} style={{ color: 'var(--primary)' }} />
                Retrieve Original Invoice
              </h3>
              
              <form onSubmit={handleSearchInvoice} style={{ display: 'flex', gap: '10px' }}>
                <input
                  type="text"
                  className="form-input mono"
                  placeholder="Enter Invoice ID (e.g. SM-146)"
                  value={invoiceIdSearch}
                  onChange={(e) => setInvoiceIdSearch(e.target.value)}
                  style={{ textTransform: 'uppercase' }}
                />
                <button type="submit" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }} disabled={loadingInvoice}>
                  {loadingInvoice ? <RefreshCw size={14} className="animate-spin" /> : <Search size={14} />}
                  <span>Retrieve</span>
                </button>
              </form>

              {searchError && (
                <div style={{ color: 'var(--danger)', fontSize: '12.5px', marginTop: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertTriangle size={14} />
                  <span>{searchError}</span>
                </div>
              )}
            </div>

            {/* Original Invoice Info & Return Quantities selection */}
            {originalOrder && (
              <div className="glass-panel" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '14px' }}>
                  <div>
                    <h3 style={{ fontSize: '15px', fontWeight: '700', margin: '0 0 4px 0' }}>Invoice #SM-{originalOrder.order.OrderID}</h3>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      Date: {new Date(originalOrder.order.OrderDate).toLocaleDateString()} &bull; Cashier: {originalOrder.order.Username}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>Total Amount</div>
                    <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--accent)' }} className="mono">Rs. {formatCurrency(originalOrder.order.TotalAmount)}</div>
                  </div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '10px 12px', border: '1px solid var(--border-color)', borderRadius: '6px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>Attached Customer</div>
                    <div style={{ fontWeight: '700', fontSize: '13px' }}>{originalOrder.order.CustomerName || 'Walk-in Customer'}</div>
                  </div>
                  {originalOrder.order.CustomerPhone && (
                    <div style={{ fontSize: '12px' }}>Phone: <span style={{ fontWeight: '600' }}>{originalOrder.order.CustomerPhone}</span></div>
                  )}
                </div>

                <h4 style={{ fontSize: '13px', fontWeight: '700', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Select Items to Return</h4>
                <div className="table-container" style={{ maxHeight: '280px', overflowY: 'auto' }}>
                  <table className="table-glass" style={{ fontSize: '12px' }}>
                    <thead>
                      <tr>
                        <th>Product Item</th>
                        <th style={{ textAlign: 'right' }}>Price</th>
                        <th style={{ textAlign: 'center' }}>Purchased</th>
                        <th style={{ width: '100px', textAlign: 'center' }}>Return Qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {returnItems.map(item => (
                        <tr key={item.productId} style={{ background: item.quantity > 0 ? 'rgba(239, 68, 68, 0.05)' : 'transparent' }}>
                          <td>
                            <div style={{ fontWeight: '600' }}>{item.name}</div>
                            {item.batchNo && <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Batch: {item.batchNo}</div>}
                          </td>
                          <td className="mono" style={{ textAlign: 'right' }}>Rs. {formatCurrency(item.price)}</td>
                          <td style={{ textAlign: 'center' }}>{item.purchasedQty}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <input
                                type="number"
                                min="0"
                                max={item.purchasedQty}
                                step="any"
                                className="form-input mono"
                                style={{ width: '70px', padding: '3px 6px', textAlign: 'center', fontSize: '12px' }}
                                value={item.quantity === 0 ? '' : item.quantity}
                                placeholder="0"
                                onChange={(e) => handleReturnQtyChange(item.productId, e.target.value)}
                              />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderTop: '1px dashed var(--border-color)', marginTop: '14px', paddingTop: '10px', fontSize: '12.5px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Returned Items Value (Gross):</span>
                    <span className="mono">Rs. {formatCurrency(returnSubtotal)}</span>
                  </div>
                  {returnDiscount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--warning)' }}>
                      <span>Less proportionate original discount:</span>
                      <span className="mono">-Rs. {formatCurrency(returnDiscount)}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Proportionate VAT Refund (10%):</span>
                    <span className="mono">Rs. {formatCurrency(returnTax)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '800', fontSize: '14px', borderTop: '1px solid var(--border-color)', paddingTop: '6px', marginTop: '4px', color: 'var(--success)' }}>
                    <span>TOTAL RETURN CREDIT VALUE:</span>
                    <span className="mono">Rs. {formatCurrency(returnTotal)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT SIDE: Replacement Items & Payment Splits */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Catalog search card to add items to exchange cart */}
            {originalOrder && (
              <div className="glass-panel" style={{ padding: '20px', zIndex: 9 }}>
                <h3 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShoppingBag size={18} style={{ color: 'var(--primary)' }} />
                  Exchange Cart (Add New Items)
                </h3>

                <div className="form-group" style={{ position: 'relative' }} ref={catalogDropdownRef}>
                  <label className="form-label" style={{ fontSize: '11px' }}>Search and Add Replacement Product</label>
                  <div className="search-box-container" style={{ width: '100%' }}>
                    <Search className="search-icon" size={16} />
                    <input
                      type="text"
                      className="form-input"
                      style={{ fontSize: '13px' }}
                      placeholder="Type name, barcode or SKU..."
                      value={catalogSearchQuery}
                      onChange={(e) => {
                        setCatalogSearchQuery(e.target.value);
                        setShowCatalogDropdown(true);
                      }}
                      onFocus={() => setShowCatalogDropdown(true)}
                    />
                  </div>

                  {showCatalogDropdown && filteredProducts.length > 0 && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      background: 'var(--bg-surface-elevated, #1e293b)',
                      border: '1px solid var(--border-color, #334155)',
                      borderRadius: '8px',
                      boxShadow: '0 12px 30px rgba(0,0,0,0.65)',
                      zIndex: 1000,
                      maxHeight: '220px',
                      overflowY: 'auto',
                      marginTop: '4px'
                    }}>
                      {filteredProducts.map(p => (
                        <div
                          key={p.ProductID}
                          onClick={() => handleAddToCart(p)}
                          style={{
                            padding: '8px 12px',
                            cursor: 'pointer',
                            borderBottom: '1px solid var(--border-color)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                          className="dropdown-item-hover"
                        >
                          <div>
                            <div style={{ fontWeight: '600', fontSize: '13px' }}>{p.Name}</div>
                            <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>
                              SKU: {p.SKU} &bull; Stock: {p.Stock}
                            </div>
                          </div>
                          <div style={{ fontSize: '12px', fontWeight: 'bold' }} className="mono">
                            Rs. {formatCurrency(p.Price)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Replacement Cart Table */}
                {exchangeCart.length > 0 ? (
                  <div style={{ marginTop: '14px' }}>
                    <div className="table-container" style={{ maxHeight: '180px', overflowY: 'auto' }}>
                      <table className="table-glass" style={{ fontSize: '12px' }}>
                        <thead>
                          <tr>
                            <th>Item Name</th>
                            <th style={{ textAlign: 'right' }}>Price</th>
                            <th style={{ width: '80px', textAlign: 'center' }}>Qty</th>
                            <th style={{ textAlign: 'right' }}>Subtotal</th>
                            <th style={{ width: '32px' }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          {exchangeCart.map(item => (
                            <tr key={item.productId}>
                              <td style={{ fontWeight: '600' }}>{item.name}</td>
                              <td className="mono" style={{ textAlign: 'right' }}>Rs. {formatCurrency(item.price)}</td>
                              <td>
                                <input
                                  type="number"
                                  min="1"
                                  step="any"
                                  className="form-input mono"
                                  style={{ padding: '2px 4px', fontSize: '12px', textAlign: 'center' }}
                                  value={item.quantity}
                                  onChange={(e) => handleUpdateExchangeCartQty(item.productId, e.target.value)}
                                />
                              </td>
                              <td className="mono" style={{ textAlign: 'right' }}>Rs. {formatCurrency(item.price * item.quantity)}</td>
                              <td style={{ textAlign: 'center' }}>
                                <button type="button" className="btn btn-icon btn-secondary" style={{ padding: '4px', border: 'none' }} onClick={() => handleRemoveFromExchangeCart(item.productId)}>
                                  <Trash2 size={13} style={{ color: 'var(--danger)' }} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '10px', fontSize: '12px', borderTop: '1px dashed var(--border-color)', paddingTop: '8px' }}>
                      <div style={{ display: 'flex', justifyBetween: 'space-between' }}>
                        <span>New Items Subtotal:</span>
                        <span className="mono" style={{ marginLeft: 'auto' }}>Rs. {formatCurrency(newSubtotal)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyBetween: 'space-between' }}>
                        <span>VAT Output Tax (10%):</span>
                        <span className="mono" style={{ marginLeft: 'auto' }}>Rs. {formatCurrency(newTax)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyBetween: 'space-between', fontWeight: '700', color: 'var(--text-primary)' }}>
                        <span>NEW BILL TOTAL VALUE:</span>
                        <span className="mono" style={{ marginLeft: 'auto' }}>Rs. {formatCurrency(newTotal)}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '16px 0', fontSize: '12.5px', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.01)', border: '1px dashed var(--border-color)', borderRadius: '6px', marginTop: '10px' }}>
                    Cart is empty. Search products above to add items for exchange.
                  </div>
                )}
              </div>
            )}

            {/* Calculations Balance Settlement Panel & Split Payments */}
            {originalOrder && (
              <div className="glass-panel" style={{ padding: '20px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <DollarSign size={18} style={{ color: 'var(--primary)' }} />
                  Net Settlement
                </h3>

                {/* Mathematical Net Box */}
                <div style={{ 
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  padding: '16px',
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '12px',
                  marginBottom: '16px'
                }}>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Replacement Invoice Value</div>
                    <div style={{ fontSize: '14px', fontWeight: '700' }} className="mono">Rs. {formatCurrency(newTotal)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Returned Credit Offset</div>
                    <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--success)' }} className="mono">-Rs. {formatCurrency(returnTotal)}</div>
                  </div>
                  <div style={{ gridColumn: 'span 2', borderTop: '1px solid var(--border-color)', paddingTop: '10px', marginTop: '4px' }}>
                    {exchangeCart.length > 0 ? (
                      netBalance > 0 ? (
                        <div>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Net Cash Balance Customer Must Pay</div>
                          <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--warning)' }} className="mono">Rs. {formatCurrency(netBalance)}</div>
                        </div>
                      ) : netBalance < 0 ? (
                        <div>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Net Cash Balance We Must Refund Customer</div>
                          <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--danger)' }} className="mono">Rs. {formatCurrency(Math.abs(netBalance))}</div>
                        </div>
                      ) : (
                        <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--success)' }}>
                          Balanced Value. Set-off fits perfectly. No Cash Settlement Required.
                        </div>
                      )
                    ) : (
                      <div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Full Refund Due to Customer</div>
                        <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--danger)' }} className="mono">Rs. {formatCurrency(returnTotal)}</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Settlement Inputs (Only show when balance is not exactly 0) */}
                {(!isExchange || Math.abs(netBalance) > 0.01) && (
                  <div>
                    <h4 style={{ fontSize: '12px', fontWeight: '700', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      {exchangeCart.length === 0 || netBalance < 0 ? 'Select Refund Payout Methods' : 'Collect Customer Payment Splits'}
                    </h4>

                    {/* Split Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 14px', marginBottom: '16px' }}>
                      <div>
                        <label className="form-label" style={{ fontSize: '11px' }}>Cash Amount</label>
                        <input
                          type="text"
                          className="form-input mono"
                          style={{ padding: '6px 10px', fontSize: '13px' }}
                          placeholder="0.00"
                          value={paymentModes.Cash}
                          onChange={(e) => handleModeChange('Cash', e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="form-label" style={{ fontSize: '11px' }}>Cheque</label>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <input
                            type="text"
                            className="form-input mono"
                            style={{ padding: '6px 10px', fontSize: '13px' }}
                            placeholder="0.00"
                            value={paymentModes.Cheque}
                            onChange={(e) => handleModeChange('Cheque', e.target.value)}
                          />
                          <input
                            type="text"
                            className="form-input"
                            style={{ padding: '6px 8px', fontSize: '12px', width: '80px' }}
                            placeholder="Chq No."
                            value={modeReferences.Cheque}
                            onChange={(e) => setModeReferences({ ...modeReferences, Cheque: e.target.value })}
                          />
                        </div>
                      </div>

                      <div>
                        <label className="form-label" style={{ fontSize: '11px' }}>Visa Card</label>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <input
                            type="text"
                            className="form-input mono"
                            style={{ padding: '6px 10px', fontSize: '13px' }}
                            placeholder="0.00"
                            value={paymentModes.Visa}
                            onChange={(e) => handleModeChange('Visa', e.target.value)}
                          />
                          <input
                            type="text"
                            className="form-input"
                            style={{ padding: '6px 8px', fontSize: '12px', width: '80px' }}
                            placeholder="Txn ID"
                            value={modeReferences.Visa}
                            onChange={(e) => setModeReferences({ ...modeReferences, Visa: e.target.value })}
                          />
                        </div>
                      </div>

                      <div>
                        <label className="form-label" style={{ fontSize: '11px' }}>Master Card</label>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <input
                            type="text"
                            className="form-input mono"
                            style={{ padding: '6px 10px', fontSize: '13px' }}
                            placeholder="0.00"
                            value={paymentModes.Master}
                            onChange={(e) => handleModeChange('Master', e.target.value)}
                          />
                          <input
                            type="text"
                            className="form-input"
                            style={{ padding: '6px 8px', fontSize: '12px', width: '80px' }}
                            placeholder="Txn ID"
                            value={modeReferences.Master}
                            onChange={(e) => setModeReferences({ ...modeReferences, Master: e.target.value })}
                          />
                        </div>
                      </div>

                      <div>
                        <label className="form-label" style={{ fontSize: '11px' }}>QR Payment</label>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <input
                            type="text"
                            className="form-input mono"
                            style={{ padding: '6px 10px', fontSize: '13px' }}
                            placeholder="0.00"
                            value={paymentModes.QR}
                            onChange={(e) => handleModeChange('QR', e.target.value)}
                          />
                          <input
                            type="text"
                            className="form-input"
                            style={{ padding: '6px 8px', fontSize: '12px', width: '80px' }}
                            placeholder="Ref ID"
                            value={modeReferences.QR}
                            onChange={(e) => setModeReferences({ ...modeReferences, QR: e.target.value })}
                          />
                        </div>
                      </div>

                      <div>
                        <label className="form-label" style={{ fontSize: '11px' }}>Bank Transfer</label>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <input
                            type="text"
                            className="form-input mono"
                            style={{ padding: '6px 10px', fontSize: '13px' }}
                            placeholder="0.00"
                            value={paymentModes.BankTransfer}
                            onChange={(e) => handleModeChange('BankTransfer', e.target.value)}
                          />
                          <input
                            type="text"
                            className="form-input"
                            style={{ padding: '6px 8px', fontSize: '12px', width: '80px' }}
                            placeholder="Ref ID"
                            value={modeReferences.BankTransfer}
                            onChange={(e) => setModeReferences({ ...modeReferences, BankTransfer: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '10px', marginBottom: '14px', fontSize: '13px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Settled Allocation Amount:</span>
                      <span className="mono" style={{ fontWeight: '700', color: Math.abs(totalPaid - (exchangeCart.length === 0 ? returnTotal : Math.abs(netBalance))) < 0.01 ? 'var(--success)' : 'var(--danger)' }}>
                        Rs. {formatCurrency(totalPaid)} / Rs. {formatCurrency(exchangeCart.length === 0 ? returnTotal : Math.abs(netBalance))}
                      </span>
                    </div>
                  </div>
                )}

                {/* Submissions buttons */}
                <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                  <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={handleResetWorkspace}>
                    Reset Workspace
                  </button>
                  <button type="button" className="btn btn-primary" style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }} onClick={handleSubmit} disabled={isSubmitting}>
                    {isSubmitting ? <RefreshCw size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                    <span>{exchangeCart.length > 0 ? 'Submit Exchange Process' : 'Process Cash Refund'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      ) : (
        /* REPORTS LAYOUT */
        <div>
          {/* Sub tabs for reports */}
          <div className="category-tabs" style={{ marginBottom: '20px' }}>
            <button className={`category-tab ${reportsActiveTab === 'returns' ? 'active' : ''}`} onClick={() => setReportsActiveTab('returns')}>
              Sales Returns Note
            </button>
            <button className={`category-tab ${reportsActiveTab === 'refunds' ? 'active' : ''}`} onClick={() => setReportsActiveTab('refunds')}>
              Refund Details
            </button>
            <button className={`category-tab ${reportsActiveTab === 'exchanges' ? 'active' : ''}`} onClick={() => setReportsActiveTab('exchanges')}>
              Exchange Credits
            </button>
            <button className={`category-tab ${reportsActiveTab === 'settlements' ? 'active' : ''}`} onClick={() => setReportsActiveTab('settlements')}>
              Exchange Settlements
            </button>
          </div>

          {/* Filters card */}
          <div className="glass-panel" style={{ padding: '16px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '24px' }}>
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
                <option value="this-month">This Month</option>
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
                Clear Filters
              </button>
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
              <button className="btn btn-secondary btn-icon" onClick={fetchReportData} title="Refresh report" style={{ height: '36px', width: '36px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <RefreshCw size={14} />
              </button>
            </div>
          </div>

          {/* Report Data display */}
          {reportsLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px' }}>
              <RefreshCw size={24} className="animate-spin" style={{ color: 'var(--primary)', animation: 'spin 1.5s linear infinite' }} />
            </div>
          ) : (
            <div className="glass-panel" style={{ padding: 0 }}>
              
              {reportsActiveTab === 'returns' && (
                <div className="table-container">
                  <table className="table-glass">
                    <thead>
                      <tr>
                        <th>Return ID</th>
                        <th>Return Date</th>
                        <th>Original Order</th>
                        <th>Customer Name</th>
                        <th>Cashier</th>
                        <th>Subtotal</th>
                        <th>Discount</th>
                        <th>VAT</th>
                        <th>Total Return</th>
                        <th>Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportsData.length === 0 ? (
                        <tr>
                          <td colSpan={10} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '20px 0' }}>No records found.</td>
                        </tr>
                      ) : (
                        reportsData.map(r => (
                          <tr key={r.ReturnOrderID}>
                            <td className="mono" style={{ fontWeight: '600' }}>#SRN-{r.ReturnOrderID}</td>
                            <td>{new Date(r.ReturnDate).toLocaleDateString()}</td>
                            <td className="mono">#SM-{r.OriginalOrderID}</td>
                            <td>{r.CustomerName || 'Walk-in Customer'}</td>
                            <td>{r.CashierName}</td>
                            <td className="mono">Rs. {formatCurrency(r.Subtotal)}</td>
                            <td className="mono" style={{ color: r.DiscountAmount > 0 ? 'var(--warning)' : 'inherit' }}>Rs. {formatCurrency(r.DiscountAmount)}</td>
                            <td className="mono">Rs. {formatCurrency(r.TaxAmount)}</td>
                            <td className="mono" style={{ fontWeight: '700', color: 'var(--success)' }}>Rs. {formatCurrency(r.TotalAmount)}</td>
                            <td>
                              <span style={{
                                padding: '2px 8px', borderRadius: '10px', fontSize: '10.5px', fontWeight: '700',
                                background: r.ReturnType === 'Exchange' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                color: r.ReturnType === 'Exchange' ? '#93c5fd' : '#fca5a5'
                              }}>{r.ReturnType}</span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {reportsActiveTab === 'refunds' && (
                <div className="table-container">
                  <table className="table-glass">
                    <thead>
                      <tr>
                        <th>Return ID</th>
                        <th>Return Date</th>
                        <th>Original Order</th>
                        <th>Customer Name</th>
                        <th>Cashier</th>
                        <th>Refunded Amount</th>
                        <th>Payout Methods</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportsData.length === 0 ? (
                        <tr>
                          <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '20px 0' }}>No records found.</td>
                        </tr>
                      ) : (
                        reportsData.map(r => (
                          <tr key={r.ReturnOrderID}>
                            <td className="mono" style={{ fontWeight: '600' }}>#SRN-{r.ReturnOrderID}</td>
                            <td>{new Date(r.ReturnDate).toLocaleDateString()}</td>
                            <td className="mono">#SM-{r.OriginalOrderID}</td>
                            <td>{r.CustomerName || 'Walk-in Customer'}</td>
                            <td>{r.CashierName}</td>
                            <td className="mono" style={{ fontWeight: '700', color: 'var(--danger)' }}>Rs. {formatCurrency(r.RefundedAmount)}</td>
                            <td>{r.RefundMethods}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {reportsActiveTab === 'exchanges' && (
                <div className="table-container">
                  <table className="table-glass">
                    <thead>
                      <tr>
                        <th>Return ID</th>
                        <th>Return Date</th>
                        <th>Original Order</th>
                        <th>New Exchange Order</th>
                        <th>Customer Name</th>
                        <th>Cashier</th>
                        <th>Return Value Credit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportsData.length === 0 ? (
                        <tr>
                          <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '20px 0' }}>No records found.</td>
                        </tr>
                      ) : (
                        reportsData.map(r => (
                          <tr key={r.ReturnOrderID}>
                            <td className="mono" style={{ fontWeight: '600' }}>#SRN-{r.ReturnOrderID}</td>
                            <td>{new Date(r.ReturnDate).toLocaleDateString()}</td>
                            <td className="mono">#SM-{r.OriginalOrderID}</td>
                            <td className="mono">{r.NewOrderID ? `#SM-${r.NewOrderID}` : '—'}</td>
                            <td>{r.CustomerName || 'Walk-in Customer'}</td>
                            <td>{r.CashierName}</td>
                            <td className="mono" style={{ fontWeight: '700', color: 'var(--success)' }}>Rs. {formatCurrency(r.ReturnValue)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {reportsActiveTab === 'settlements' && (
                <div className="table-container">
                  <table className="table-glass">
                    <thead>
                      <tr>
                        <th>New Exchange ID</th>
                        <th>Sale Date</th>
                        <th>Return ID</th>
                        <th>Customer Name</th>
                        <th>Cashier</th>
                        <th>Replacement Total</th>
                        <th>Set-off Offset</th>
                        <th>Net Cash Settlement</th>
                        <th>Settlement Channels</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportsData.length === 0 ? (
                        <tr>
                          <td colSpan={9} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '20px 0' }}>No records found.</td>
                        </tr>
                      ) : (
                        reportsData.map(r => (
                          <tr key={r.NewOrderID}>
                            <td className="mono" style={{ fontWeight: '600' }}>#SM-{r.NewOrderID}</td>
                            <td>{new Date(r.SaleDate).toLocaleDateString()}</td>
                            <td className="mono">#SRN-{r.ReturnOrderID}</td>
                            <td>{r.CustomerName || 'Walk-in Customer'}</td>
                            <td>{r.CashierName}</td>
                            <td className="mono">Rs. {formatCurrency(r.NewInvoiceTotal)}</td>
                            <td className="mono" style={{ color: 'var(--success)' }}>Rs. {formatCurrency(r.ExchangeOffset)}</td>
                            <td className="mono" style={{ fontWeight: '700', color: r.NetSettlement >= 0 ? 'var(--warning)' : 'var(--danger)' }}>
                              {r.NetSettlement >= 0 ? '+' : '-'}Rs. {formatCurrency(Math.abs(r.NetSettlement))}
                            </td>
                            <td>{r.SettlementModes}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

            </div>
          )}
        </div>
      )}

      {/* PRINT RECEIPT DIALOG MODAL */}
      {showReceiptModal && receiptDetails && (
        <div className="modal-overlay" style={{ zIndex: 10000 }}>
          <div className="modal-content" style={{ width: '420px', padding: '24px', position: 'relative' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '12px', textAlign: 'center' }}>
              Exchange Process Completed
            </h3>
            
            <p style={{ color: 'var(--text-secondary)', fontSize: '13.5px', lineHeight: '1.6', marginBottom: '20px', textAlign: 'center' }}>
              The returns and exchanges have been recorded in the audit trail database. You can now generate the thermal receipt print slip.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
              <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', padding: '10px 0' }} onClick={handlePrintExchangeSlip}>
                <Printer size={16} />
                <span>Print Thermal Slip</span>
              </button>
              <button className="btn btn-secondary" style={{ width: '100%', padding: '10px 0' }} onClick={() => setShowReceiptModal(false)}>
                Close Window
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
