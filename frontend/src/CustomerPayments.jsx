import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from './contexts/AuthContext';
import { Search, User, CreditCard, Calendar, FileText, CheckCircle2, RotateCcw, Printer, ArrowLeft } from 'lucide-react';
import formatCurrency from './utils/formatCurrency';

export default function CustomerPayments({ selectedCustomerFromDir, onBackToDirectory, setToast }) {
  const { token, API_URL } = useAuth();
  
  // Customer Search & Selection
  const [customers, setCustomers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const dropdownRef = useRef(null);

  // Unpaid Invoices
  const [unpaidInvoices, setUnpaidInvoices] = useState([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);

  // Payment Allocation Strategy
  const [allocationOption, setAllocationOption] = useState('FIFO'); // 'FIFO' or 'Manual'
  const [manualAllocations, setManualAllocations] = useState({}); // { orderId: amount }

  // Header Details
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [referenceNo, setReferenceNo] = useState('');
  const [remarks, setRemarks] = useState('');

  // Split Payment Modes
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

  // Receipt Modal
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptDetails, setReceiptDetails] = useState(null);
  const [companyInfo, setCompanyInfo] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load all customers for auto-complete
  useEffect(() => {
    fetchCustomers();
    fetchCompanyInfo();
  }, []);

  // Handle outside click to close customer dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Pre-select customer if navigated from directory
  useEffect(() => {
    if (selectedCustomerFromDir) {
      handleSelectCustomer(selectedCustomerFromDir);
    }
  }, [selectedCustomerFromDir]);

  const fetchCustomers = async () => {
    try {
      const res = await fetch(`${API_URL}/api/customers`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setCustomers(await res.json());
      }
    } catch (err) {
      console.error('Failed to fetch customers:', err);
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

  const handleSelectCustomer = async (customer) => {
    setSelectedCustomer(customer);
    setSearchQuery(customer.Name);
    setShowDropdown(false);
    setManualAllocations({});

    // Fetch unpaid invoices
    try {
      setLoadingInvoices(true);
      const res = await fetch(`${API_URL}/api/customers/${customer.CustomerID}/unpaid-invoices`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const invoices = await res.json();
        setUnpaidInvoices(invoices);
      } else {
        setUnpaidInvoices([]);
      }
    } catch (err) {
      console.error('Failed to fetch unpaid invoices:', err);
      setToast({ type: 'error', message: 'Failed to retrieve unpaid invoices.' });
    } finally {
      setLoadingInvoices(false);
    }
  };

  const fetchPaymentReceipt = async (paymentId) => {
    try {
      const res = await fetch(`${API_URL}/api/customers/payments/${paymentId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setReceiptDetails(await res.json());
        setShowReceiptModal(true);
      }
    } catch (err) {
      console.error('Failed to retrieve payment details:', err);
    }
  };

  // Calculations
  const totalPaid = Object.values(paymentModes).reduce((sum, val) => {
    const parsed = parseFloat(val);
    return sum + (isNaN(parsed) ? 0 : parsed);
  }, 0);

  // FIFO Allocation mapping visualizer
  const getFIFOAllocations = () => {
    let remaining = totalPaid;
    const allocations = {};
    for (const inv of unpaidInvoices) {
      if (remaining <= 0) break;
      const balance = parseFloat(inv.BalanceAmount);
      const allocated = Math.min(remaining, balance);
      allocations[inv.OrderID] = allocated;
      remaining -= allocated;
    }
    return allocations;
  };

  const currentAllocations = allocationOption === 'FIFO' ? getFIFOAllocations() : manualAllocations;
  const totalAllocated = Object.values(currentAllocations).reduce((sum, val) => sum + (val || 0), 0);
  const remainingUnallocated = totalPaid - totalAllocated;

  const handleManualAllocationChange = (orderId, value, maxBalance) => {
    const val = parseFloat(value);
    if (isNaN(val) || val <= 0) {
      const newAllocs = { ...manualAllocations };
      delete newAllocs[orderId];
      setManualAllocations(newAllocs);
      return;
    }

    const sanitized = Math.min(val, maxBalance);
    setManualAllocations({
      ...manualAllocations,
      [orderId]: parseFloat(sanitized.toFixed(2))
    });
  };

  const handleModeChange = (mode, value) => {
    if (value === '' || /^\d*\.?\d{0,2}$/.test(value)) {
      setPaymentModes({
        ...paymentModes,
        [mode]: value
      });
    }
  };

  const handleReset = () => {
    setSelectedCustomer(null);
    setSearchQuery('');
    setUnpaidInvoices([]);
    setManualAllocations({});
    setReferenceNo('');
    setRemarks('');
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedCustomer) {
      setToast({ type: 'error', message: 'Please select a customer.' });
      return;
    }
    if (totalPaid <= 0) {
      setToast({ type: 'error', message: 'Total payment amount must be greater than zero.' });
      return;
    }

    // Build modes payload
    const modesPayload = Object.entries(paymentModes)
      .filter(([_, amount]) => parseFloat(amount) > 0)
      .map(([method, amount]) => {
        // Map card names/etc nicely
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

    // Build allocations payload
    const allocationsPayload = Object.entries(currentAllocations).map(([orderId, amt]) => ({
      orderId: parseInt(orderId, 10),
      allocatedAmount: parseFloat(amt)
    }));

    if (allocationOption === 'Manual') {
      if (totalAllocated > totalPaid + 0.005) {
        setToast({ type: 'error', message: 'Allocated invoice payments exceed total paid amount.' });
        return;
      }
    }

    const payload = {
      customerId: selectedCustomer.CustomerID,
      paymentDate,
      referenceNo,
      remarks,
      allocationOption,
      modes: modesPayload,
      allocations: allocationsPayload
    };

    try {
      setIsSubmitting(true);
      const res = await fetch(`${API_URL}/api/customers/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit payment.');

      setToast({ type: 'success', message: 'Payment recorded successfully!' });
      
      // Load payment details for receipt printing
      await fetchPaymentReceipt(data.PaymentID);

      // Reset Form
      handleReset();
    } catch (err) {
      setToast({ type: 'error', message: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrintReceipt = () => {
    if (!receiptDetails) return;
    const logoUrl = companyInfo?.LogoURL ? (companyInfo.LogoURL.startsWith('http') ? companyInfo.LogoURL : `${API_URL}${companyInfo.LogoURL}`) : null;

    const modesHtml = receiptDetails.Modes.map(m => `
      <div class="sum-row">
        <span>- ${m.Method}${m.ReferenceNumber ? ` (${m.ReferenceNumber})` : ''}</span>
        <span>Rs. ${Number(m.Amount).toFixed(2)}</span>
      </div>
    `).join('');

    const allocsHtml = receiptDetails.Allocations.length > 0 
      ? receiptDetails.Allocations.map(a => `
        <div class="sum-row" style="font-size: 11px; padding-left: 10px; color: #333;">
          <span>Allocated to Inv #${a.OrderID} (Date: ${new Date(a.OrderDate).toLocaleDateString()})</span>
          <span>Rs. ${Number(a.AllocatedAmount).toFixed(2)}</span>
        </div>
      `).join('')
      : '<div style="font-size: 11px; color:#555; text-align:center; padding: 4px;">Advance Deposit (No outstanding invoices settled)</div>';

    const addressParts = [companyInfo?.AddressLine1, companyInfo?.AddressLine2, companyInfo?.City].filter(Boolean).join(', ');
    const contactParts = [companyInfo?.Phone, companyInfo?.Email].filter(Boolean).join(' | ');

    const html = `
    <html>
    <head>
    <title>Customer Payment Receipt - ${receiptDetails.ReceiptNo}</title>
    <style>
      body { font-family: 'Courier New', Courier, monospace; width: 280px; margin: 0; padding: 10px; color: #000; font-size: 12px; }
      .header { text-align: center; margin-bottom: 8px; }
      .logo { max-width: 80px; height: auto; margin-bottom: 4px; }
      .company-name { font-size: 14px; font-weight: bold; text-transform: uppercase; }
      .company-sub { font-size: 10px; color: #111; margin-top: 2px; line-height: 1.3; }
      .meta { font-size: 11px; line-height: 1.6; border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 4px 0; margin: 8px 0; }
      .sum-row { display: flex; justify-content: space-between; padding: 2px 0; }
      .sum-total { display: flex; justify-content: space-between; font-size: 13px; font-weight: bold; border-top: 1px solid #000; border-bottom: 1px solid #000; margin-top: 4px; padding: 4px 0; }
      .section-title { font-weight: bold; font-size: 11px; border-bottom: 1px dashed #000; padding-bottom: 2px; margin-top: 8px; margin-bottom: 4px; text-transform: uppercase; }
      .footer { text-align: center; border-top: 1px dashed #000; margin-top: 12px; padding-top: 6px; font-size: 10px; }
    </style>
    </head>
    <body>
      <div class="header">
        ${logoUrl ? `<img class="logo" src="${logoUrl}">` : ''}
        <div class="company-name">${companyInfo?.Name || 'SELLMAX PRO'}</div>
        <div class="company-sub">${addressParts}<br>${contactParts}</div>
      </div>
      
      <div class="meta">
        <div><strong>RECEIPT NO:</strong> ${receiptDetails.ReceiptNo}</div>
        <div><strong>DATE:</strong> ${new Date(receiptDetails.PaymentDate).toLocaleDateString()}</div>
        <div><strong>CUSTOMER:</strong> ${receiptDetails.CustomerName} (${receiptDetails.CustomerCode || '--'})</div>
        <div><strong>COLLECTOR:</strong> ${receiptDetails.ReceivedBy}</div>
        ${receiptDetails.ReferenceNo ? `<div><strong>REF NO:</strong> ${receiptDetails.ReferenceNo}</div>` : ''}
      </div>

      <div class="section-title">Payments Received</div>
      ${modesHtml}
      
      <div class="sum-total">
        <span>TOTAL RECEIVED:</span>
        <span>Rs. ${Number(receiptDetails.TotalAmount).toFixed(2)}</span>
      </div>

      <div class="section-title">Invoices Settled</div>
      ${allocsHtml}

      <div class="footer">
        <p>Payment recorded successfully.</p>
        <p style="font-size: 9px; margin-top: 4px;">Powered by SellMax Pro</p>
      </div>
    </body>
    </html>`;

    const popup = window.open('', '_blank', 'width=320,height=600,toolbar=0,menubar=0,location=0,status=0');
    if (!popup) {
      setToast({ type: 'error', message: 'Pop-up blocked! Please allow pop-ups to print payment receipts.' });
      return;
    }
    popup.document.write(html);
    popup.document.close();
    setTimeout(() => {
      popup.print();
      popup.close();
    }, 250);
  };

  const filteredCustomers = searchQuery
    ? customers.filter(c => 
        c.Name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (c.CustomerCode && c.CustomerCode.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (c.Phone && c.Phone.includes(searchQuery))
      )
    : customers;

  return (
    <div>
      {onBackToDirectory && (
        <button className="btn btn-secondary" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }} onClick={onBackToDirectory}>
          <ArrowLeft size={16} />
          <span>Back to CRM Directory</span>
        </button>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'start' }}>
        
        {/* LEFT COLUMN: Customer Selection & Details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Card: Customer Selection */}
          <div className="glass-panel" style={{ padding: '20px', position: 'relative', zIndex: 10 }}>
            <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <User size={18} style={{ color: 'var(--primary)' }} />
              Customer Search & Balance
            </h3>

            <div className="form-group" style={{ position: 'relative' }} ref={dropdownRef}>
              <label className="form-label">Search CRM Customer</label>
              <div className="search-box-container" style={{ width: '100%' }}>
                <Search className="search-icon" size={18} />
                <input
                  type="text"
                  className="form-input pos-search"
                  placeholder="Type name, customer code or contact number..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowDropdown(true);
                  }}
                  onFocus={() => setShowDropdown(true)}
                />
              </div>

              {showDropdown && filteredCustomers.length > 0 && (
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
                  maxHeight: '250px',
                  overflowY: 'auto',
                  marginTop: '4px'
                }}>
                  {filteredCustomers.map(c => (
                    <div
                      key={c.CustomerID}
                      onClick={() => handleSelectCustomer(c)}
                      style={{
                        padding: '10px 12px',
                        cursor: 'pointer',
                        borderBottom: '1px solid var(--border-color)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                      className="dropdown-item-hover"
                    >
                      <div>
                        <div style={{ fontWeight: '600', fontSize: '14px' }}>{c.Name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                          {c.CustomerCode || `CUST-${c.CustomerID}`} • {c.Phone || 'No Phone'}
                        </div>
                      </div>
                      <div className="mono" style={{ fontSize: '13px', fontWeight: 'bold', color: c.CurrentBalance > 0 ? 'var(--danger)' : 'var(--text-secondary)' }}>
                        Owed: Rs. {formatCurrency(c.CurrentBalance)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {selectedCustomer && (
              <div style={{
                marginTop: '16px',
                padding: '12px',
                borderRadius: '8px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--border-color)',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '12px'
              }}>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Customer Code</div>
                  <div style={{ fontWeight: '600' }}>{selectedCustomer.CustomerCode || `CUST-${selectedCustomer.CustomerID}`}</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Phone Number</div>
                  <div style={{ fontWeight: '600' }}>{selectedCustomer.Phone || '--'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Credit Limit</div>
                  <div style={{ fontWeight: '600' }} className="mono">Rs. {formatCurrency(selectedCustomer.CreditLimit)}</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Outstanding Balance</div>
                  <div style={{ fontWeight: '700', color: selectedCustomer.CurrentBalance > 0 ? 'var(--danger)' : 'var(--success)' }} className="mono">
                    Rs. {formatCurrency(selectedCustomer.CurrentBalance)}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Card: Payment Header Details */}
          <div className="glass-panel" style={{ padding: '20px', position: 'relative', zIndex: 1 }}>
            <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={18} style={{ color: 'var(--primary)' }} />
              Receipt Headers
            </h3>

            <div className="form-group">
              <label className="form-label">Payment Date</label>
              <input
                type="date"
                className="form-input"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Receipt Number</label>
              <input
                type="text"
                className="form-input mono"
                value="Auto-Generated on Submission"
                disabled
              />
            </div>

            <div className="form-group">
              <label className="form-label">Reference Number (Optional)</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Bank slip transaction reference ID..."
                value={referenceNo}
                onChange={(e) => setReferenceNo(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Remarks / Description</label>
              <textarea
                className="form-input"
                placeholder="e.g. Settled oldest balance invoices..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={2}
                style={{ resize: 'none' }}
              />
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: Invoice Outstanding List & Split Payment Modes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Card: Outstanding Invoice Inboxes */}
          <div className="glass-panel" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                <FileText size={18} style={{ color: 'var(--primary)' }} />
                Outstanding Invoices
              </h3>

              {/* Allocation Mode Options */}
              <div style={{ display: 'flex', gap: '12px', fontSize: '12px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontWeight: '600' }}>
                  <input
                    type="radio"
                    name="allocation"
                    checked={allocationOption === 'FIFO'}
                    onChange={() => setAllocationOption('FIFO')}
                  />
                  <span>Auto FIFO</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontWeight: '600' }}>
                  <input
                    type="radio"
                    name="allocation"
                    checked={allocationOption === 'Manual'}
                    onChange={() => setAllocationOption('Manual')}
                  />
                  <span>Manual</span>
                </label>
              </div>
            </div>

            {loadingInvoices ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0' }}>Loading unpaid invoices...</div>
            ) : selectedCustomer ? (
              unpaidInvoices.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '20px 0' }}>
                  No outstanding credit invoices found for this customer.
                </div>
              ) : (
                <div className="table-container" style={{ maxHeight: '180px', overflowY: 'auto' }}>
                  <table className="table-glass" style={{ fontSize: '12px' }}>
                    <thead>
                      <tr>
                        <th>Inv No</th>
                        <th>Inv Date</th>
                        <th>Inv Total</th>
                        <th>Owed Bal</th>
                        <th style={{ width: '100px' }}>Paid allocation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {unpaidInvoices.map(inv => {
                        const isAllocated = (currentAllocations[inv.OrderID] || 0) > 0;
                        const allocatedVal = currentAllocations[inv.OrderID] || 0;
                        return (
                          <tr key={inv.OrderID} style={{ background: isAllocated ? 'rgba(99, 102, 241, 0.05)' : 'transparent' }}>
                            <td><span style={{ fontWeight: '600' }}>#SM-{inv.OrderID}</span></td>
                            <td>{new Date(inv.InvoiceDate).toLocaleDateString()}</td>
                            <td className="mono">Rs. {formatCurrency(inv.InvoiceTotal)}</td>
                            <td className="mono" style={{ color: 'var(--danger)', fontWeight: '600' }}>Rs. {formatCurrency(inv.BalanceAmount)}</td>
                            <td>
                              {allocationOption === 'FIFO' ? (
                                <input
                                  type="text"
                                  className="form-input mono"
                                  style={{ padding: '3px 8px', fontSize: '12px', textAlign: 'right' }}
                                  value={allocatedVal > 0 ? `Rs. ${allocatedVal.toFixed(2)}` : '--'}
                                  disabled
                                />
                              ) : (
                                <input
                                  type="number"
                                  step="0.01"
                                  className="form-input mono"
                                  style={{ padding: '3px 8px', fontSize: '12px', textAlign: 'right' }}
                                  placeholder="0.00"
                                  value={manualAllocations[inv.OrderID] || ''}
                                  onChange={(e) => handleManualAllocationChange(inv.OrderID, e.target.value, parseFloat(inv.BalanceAmount))}
                                />
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr style={{ fontWeight: 'bold', background: 'rgba(255, 255, 255, 0.05)' }}>
                        <td colSpan={2}>TOTAL</td>
                        <td className="mono">Rs. {formatCurrency(unpaidInvoices.reduce((sum, inv) => sum + parseFloat(inv.InvoiceTotal || 0), 0))}</td>
                        <td className="mono" style={{ color: 'var(--danger)' }}>Rs. {formatCurrency(unpaidInvoices.reduce((sum, inv) => sum + parseFloat(inv.BalanceAmount || 0), 0))}</td>
                        <td className="mono" style={{ color: 'var(--success)' }}>
                          Rs. {formatCurrency(unpaidInvoices.reduce((sum, inv) => sum + parseFloat(currentAllocations[inv.OrderID] || 0), 0))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '20px 0' }}>
                Please select a customer first.
              </div>
            )}
          </div>

          {/* Card: Split Payment Details */}
          <div className="glass-panel" style={{ padding: '20px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CreditCard size={18} style={{ color: 'var(--primary)' }} />
              Split Payment Breakdown
            </h3>

            {/* Split Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px', marginBottom: '16px' }}>
              
              <div>
                <label className="form-label" style={{ fontSize: '11px' }}>Cash Amount</label>
                <input
                  type="text"
                  className="form-input mono"
                  placeholder="0.00"
                  value={paymentModes.Cash}
                  onChange={(e) => handleModeChange('Cash', e.target.value)}
                />
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '11px' }}>Cheque Amount</label>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <input
                    type="text"
                    className="form-input mono"
                    placeholder="0.00"
                    value={paymentModes.Cheque}
                    onChange={(e) => handleModeChange('Cheque', e.target.value)}
                  />
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Cheque No."
                    style={{ width: '90px' }}
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
                    placeholder="0.00"
                    value={paymentModes.Visa}
                    onChange={(e) => handleModeChange('Visa', e.target.value)}
                  />
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Txn ID"
                    style={{ width: '90px' }}
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
                    placeholder="0.00"
                    value={paymentModes.Master}
                    onChange={(e) => handleModeChange('Master', e.target.value)}
                  />
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Txn ID"
                    style={{ width: '90px' }}
                    value={modeReferences.Master}
                    onChange={(e) => setModeReferences({ ...modeReferences, Master: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '11px' }}>Amex Card</label>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <input
                    type="text"
                    className="form-input mono"
                    placeholder="0.00"
                    value={paymentModes.Amex}
                    onChange={(e) => handleModeChange('Amex', e.target.value)}
                  />
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Txn ID"
                    style={{ width: '90px' }}
                    value={modeReferences.Amex}
                    onChange={(e) => setModeReferences({ ...modeReferences, Amex: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '11px' }}>QR Payment</label>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <input
                    type="text"
                    className="form-input mono"
                    placeholder="0.00"
                    value={paymentModes.QR}
                    onChange={(e) => handleModeChange('QR', e.target.value)}
                  />
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Ref ID"
                    style={{ width: '90px' }}
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
                    placeholder="0.00"
                    value={paymentModes.BankTransfer}
                    onChange={(e) => handleModeChange('BankTransfer', e.target.value)}
                  />
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Ref ID"
                    style={{ width: '90px' }}
                    value={modeReferences.BankTransfer}
                    onChange={(e) => setModeReferences({ ...modeReferences, BankTransfer: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '11px' }}>Online Payment</label>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <input
                    type="text"
                    className="form-input mono"
                    placeholder="0.00"
                    value={paymentModes.Online}
                    onChange={(e) => handleModeChange('Online', e.target.value)}
                  />
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Txn ID"
                    style={{ width: '90px' }}
                    value={modeReferences.Online}
                    onChange={(e) => setModeReferences({ ...modeReferences, Online: e.target.value })}
                  />
                </div>
              </div>

            </div>

            {/* Reconciliation Totals Audit Summary */}
            <div style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              padding: '12px',
              fontSize: '13px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              marginBottom: '20px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Total Customer Payment:</span>
                <strong className="mono" style={{ color: 'var(--primary)' }}>Rs. {formatCurrency(totalPaid)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Allocated to Invoices:</span>
                <span className="mono" style={{ color: 'var(--success)' }}>Rs. {formatCurrency(totalAllocated)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '6px' }}>
                <span>Advance Credit additions:</span>
                <span className="mono" style={{ color: remainingUnallocated > 0 ? 'var(--warning)' : 'var(--text-secondary)', fontWeight: remainingUnallocated > 0 ? 'bold' : 'normal' }}>
                  Rs. {formatCurrency(remainingUnallocated)}
                </span>
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                onClick={handleReset}
              >
                <RotateCcw size={16} />
                <span>Reset</span>
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                disabled={isSubmitting || !selectedCustomer || totalPaid <= 0}
              >
                <CheckCircle2 size={16} />
                <span>{isSubmitting ? 'Posting Payment...' : 'Record Payment Receipt'}</span>
              </button>
            </div>

          </div>

        </div>

      </form>

      {/* ============================================================================
         RECEIPT REPRINT MODAL
         ============================================================================ */}
      {showReceiptModal && receiptDetails && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: '400px', padding: '24px' }}>
            <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', justifyBetween: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
              <span>Payment Receipt posted!</span>
            </h3>

            <div style={{
              background: '#0f172a',
              padding: '16px',
              borderRadius: '8px',
              fontFamily: 'monospace',
              fontSize: '13px',
              lineHeight: '1.6',
              marginBottom: '20px',
              color: '#f8fafc',
              border: '1px solid #334155'
            }}>
              <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '15px', marginBottom: '8px' }}>
                {companyInfo?.Name || 'SELLMAX PRO'}
              </div>
              <div style={{ borderBottom: '1px dashed #475569', paddingBottom: '8px', marginBottom: '8px' }}>
                <div>Receipt No: {receiptDetails.ReceiptNo}</div>
                <div>Date: {new Date(receiptDetails.PaymentDate).toLocaleDateString()}</div>
                <div>Customer: {receiptDetails.CustomerName}</div>
                <div>Code: {receiptDetails.CustomerCode || '--'}</div>
                <div>Received By: {receiptDetails.ReceivedBy}</div>
              </div>

              <div style={{ fontWeight: 'bold', margin: '8px 0 4px 0' }}>Collection Split:</div>
              {receiptDetails.Modes.map((m, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>- {m.Method}{m.ReferenceNumber ? ` (${m.ReferenceNumber})` : ''}</span>
                  <span>Rs. {Number(m.Amount).toFixed(2)}</span>
                </div>
              ))}

              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', borderTop: '1px solid #475569', borderBottom: '1px solid #475569', margin: '8px 0', padding: '4px 0' }}>
                <span>TOTAL PAID:</span>
                <span>Rs. {Number(receiptDetails.TotalAmount).toFixed(2)}</span>
              </div>

              <div style={{ fontWeight: 'bold', margin: '8px 0 4px 0' }}>Allocations:</div>
              {receiptDetails.Allocations.length > 0 ? receiptDetails.Allocations.map((a, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#cbd5e1' }}>
                  <span>Invoice #SM-${a.OrderID}</span>
                  <span>Rs. {Number(a.AllocatedAmount).toFixed(2)}</span>
                </div>
              )) : (
                <div style={{ fontSize: '11px', color: '#cbd5e1', fontStyle: 'italic' }}>Advance Account Credit</div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowReceiptModal(false)}
              >
                Close
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                onClick={handlePrintReceipt}
              >
                <Printer size={16} />
                <span>Print Receipt</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
