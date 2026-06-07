import React, { useState, useEffect } from 'react';
import { useAuth } from './contexts/AuthContext';
import { Search, Calendar, RefreshCw, Printer, AlertTriangle, TrendingUp, ArrowLeftRight, CreditCard } from 'lucide-react';

export default function Reports({ setToast }) {
  const { token, API_URL, hasPermission } = useAuth();
  
  // Tab control
  const [activeTab, setActiveTab] = useState('journal'); // 'journal', 'products', 'customers'

  // Reports filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchInvoiceId, setSearchInvoiceId] = useState('');
  
  // Data sets
  const [salesJournal, setSalesJournal] = useState([]);
  const [productPerformance, setProductPerformance] = useState([]);
  const [customerStatement, setCustomerStatement] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal / Invoice Detail View
  const [activeOrder, setActiveOrder] = useState(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  
  // Returns Flow
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnItems, setReturnItems] = useState([]); // [{productId, name, originalQty, returnQty, price, cost}]
  const [refundMethod, setRefundMethod] = useState('Cash');

  useEffect(() => {
    fetchReportData();
  }, [activeTab, startDate, endDate]);

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
    } catch (err) {
      console.error('Failed to load report data:', err);
    } finally {
      setLoading(false);
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
    window.print();
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
      </div>

      {/* Filters Area */}
      <div className="glass-panel" style={{ padding: '16px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '24px' }}>
        
        {activeTab !== 'customers' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={16} style={{ color: 'var(--text-secondary)' }} />
              <input
                type="date"
                className="form-input"
                style={{ width: '150px', padding: '6px 12px', fontSize: '13px' }}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              <span style={{ color: 'var(--text-secondary)' }}>to</span>
              <input
                type="date"
                className="form-input"
                style={{ width: '150px', padding: '6px 12px', fontSize: '13px' }}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            {(startDate || endDate) && (
              <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12.5px' }} onClick={() => { setStartDate(''); setEndDate(''); }}>
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
                    <th>Tax (10%)</th>
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
                        <td className="mono">Rs. {Number(sale.Subtotal).toFixed(2)}</td>
                        <td className="mono" style={{ color: sale.DiscountAmount > 0 ? 'var(--warning)' : 'inherit' }}>
                          Rs. {Number(sale.DiscountAmount).toFixed(2)}
                        </td>
                        <td className="mono">Rs. {Number(sale.TaxAmount).toFixed(2)}</td>
                        <td className="mono" style={{ color: 'var(--accent)', fontWeight: '600' }}>Rs. {Number(sale.TotalAmount).toFixed(2)}</td>
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
                        <td className="mono" style={{ color: 'var(--accent)' }}>Rs. {Number(item.GrossRevenue).toFixed(2)}</td>
                        <td className="mono" style={{ color: 'var(--success)' }}>Rs. {Number(item.EstimatedProfit).toFixed(2)}</td>
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
                        <td className="mono">Rs. {Number(cust.CreditLimit).toFixed(2)}</td>
                        <td className="mono" style={{ color: cust.CurrentBalance > 0 ? 'var(--danger)' : 'inherit' }}>
                          Rs. {Number(cust.CurrentBalance).toFixed(2)}
                        </td>
                        <td className="mono" style={{ color: 'var(--success)' }}>Rs. {Number(cust.RemainingCredit).toFixed(2)}</td>
                        <td>{cust.TotalOrdersCount} sales</td>
                        <td className="mono" style={{ color: 'var(--accent)', fontWeight: '600' }}>
                          Rs. {Number(cust.TotalPurchasesValue).toFixed(2)}
                        </td>
                      </tr>
                    ))
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
              <div className="receipt-header">
                <div className="receipt-title">SELLMAX PRO</div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>Store ID: #001 | Invoice Details</div>
                <div style={{ fontSize: '10px', marginTop: '4px' }}>{activeOrder.order.CompanyName || 'SellMax Retail Ltd'}</div>
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
                      <td>{item.ProductName}</td>
                      <td>{Number(item.Quantity)} {item.UOM || 'pcs'}</td>
                      <td style={{ textAlign: 'right' }}>Rs. {Number(item.Subtotal).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="receipt-summary-area">
                <div className="receipt-summary-row">
                  <span>Subtotal:</span>
                  <span>Rs. {Number(activeOrder.order.Subtotal).toFixed(2)}</span>
                </div>
                {Number(activeOrder.order.DiscountAmount) > 0 && (
                  <div className="receipt-summary-row">
                    <span>Discount:</span>
                    <span>-Rs. {Number(activeOrder.order.DiscountAmount).toFixed(2)}</span>
                  </div>
                )}
                <div className="receipt-summary-row">
                  <span>Tax:</span>
                  <span>Rs. {Number(activeOrder.order.TaxAmount).toFixed(2)}</span>
                </div>
                <div className="receipt-summary-row total">
                  <span>TOTAL:</span>
                  <span>Rs. {Number(activeOrder.order.TotalAmount).toFixed(2)}</span>
                </div>
              </div>

              <div style={{ fontSize: '11px', borderTop: '1px dashed #000', paddingTop: '6px' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Payments:</div>
                {activeOrder.payments.map((p, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px' }}>
                    <span>- {p.Method} {p.ReferenceNumber ? `(${p.ReferenceNumber})` : ''}</span>
                    <span>Rs. {Number(p.Amount).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div className="receipt-footer">
                <p>Status: {activeOrder.order.Status}</p>
                {activeOrder.order.ParentOrderID && <p>Orig Invoice: #SM-{activeOrder.order.ParentOrderID}</p>}
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
