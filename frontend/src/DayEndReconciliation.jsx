import React, { useState, useEffect } from 'react';
import { useAuth } from './contexts/AuthContext';
import formatCurrency from './utils/formatCurrency';
import {
  Printer, RefreshCw, X, ChevronDown, ChevronUp,
  DollarSign, ClipboardList, AlertTriangle, CheckCircle,
  TrendingDown, ShieldAlert, ArrowDownRight, ArrowUpRight, Scale
} from 'lucide-react';

const DENOMINATIONS_LIST = [5000, 2000, 1000, 500, 100, 50, 20, 10, 5];

export default function DayEndReconciliation({ onClose, setToast, onSessionClosed }) {
  const { token, API_URL, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [summaryData, setSummaryData] = useState(null);

  // Accordion open/close state
  const [openSections, setOpenSections] = useState({
    sales: true,
    cash: true,
    payments: true,
    credit: true,
    inventory: false,
    exceptions: false
  });

  // Denominations count
  const [denominations, setDenominations] = useState(
    DENOMINATIONS_LIST.reduce((acc, d) => ({ ...acc, [d]: '' }), {})
  );

  // Manual Adjustments
  const [manualCollections, setManualCollections] = useState({
    creditCollections: '',
    advanceReceipts: '',
    otherIncome: '',
    previousInvoices: ''
  });

  const [manualPayouts, setManualPayouts] = useState({
    pettyCash: '',
    supplierPayments: '',
    expensePayments: '',
    withdrawals: ''
  });

  useEffect(() => {
    fetchSummary();
  }, []);

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/sales/cash-drawer/reconciliation-summary`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        throw new Error((await res.json()).error || 'Failed to load shift summary');
      }
      const data = await res.json();
      setSummaryData(data);
    } catch (err) {
      setToast({ type: 'error', message: err.message });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleDenomChange = (denom, val) => {
    const num = val === '' ? '' : Math.max(0, parseInt(val, 10) || 0);
    setDenominations(prev => ({ ...prev, [denom]: num }));
  };

  const handleCollectionChange = (field, val) => {
    const num = val === '' ? '' : Math.max(0, parseFloat(val) || 0);
    setManualCollections(prev => ({ ...prev, [field]: num }));
  };

  const handlePayoutChange = (field, val) => {
    const num = val === '' ? '' : Math.max(0, parseFloat(val) || 0);
    setManualPayouts(prev => ({ ...prev, [field]: num }));
  };

  const toggleSection = (sec) => {
    setOpenSections(prev => ({ ...prev, [sec]: !prev[sec] }));
  };

  // Calculations
  const physicalCash = DENOMINATIONS_LIST.reduce((sum, d) => {
    return sum + d * (Number(denominations[d]) || 0);
  }, 0);

  const totalCollections = Object.values(manualCollections).reduce((sum, v) => sum + Number(v || 0), 0);
  const totalPayouts = Object.values(manualPayouts).reduce((sum, v) => sum + Number(v || 0), 0);

  const cashSales = summaryData?.salesSummary.cashSales || 0;
  const cashRefunds = summaryData?.refundSummary.cashRefunds || 0;
  const supplierCashPaidOut = summaryData?.cashCollectionBase.supplierCashPaidOut || 0;
  const openingFloat = summaryData?.cashCollectionBase.openingBalance || 0;

  // Expected Cash = Opening Float + Cash Sales + Manual Collections - Cash Refunds - Supplier Cash Payout - Manual Payouts
  const expectedCash = openingFloat + cashSales + totalCollections - cashRefunds - supplierCashPaidOut - totalPayouts;
  const variance = physicalCash - expectedCash;

  // A. Sales Summary values
  const cardSales = summaryData?.salesSummary.cardSales || 0;
  const creditSales = summaryData?.salesSummary.creditSales || 0;
  const qrPayments = summaryData?.salesSummary.qrPayments || 0;
  const onlinePayments = summaryData?.salesSummary.onlinePayments || 0;
  const bankTransferPayments = summaryData?.salesSummary.bankTransferPayments || 0;
  const otherSales = summaryData?.salesSummary.otherSales || 0;
  const grossSales = summaryData?.salesSummary.grossSales || 0;
  const totalRefunds = summaryData?.salesSummary.totalRefunds || 0;
  const netSales = summaryData?.salesSummary.netSales || 0;

  // C. Payment Methods values
  const cardRefunds = summaryData?.refundSummary.cardRefunds || 0;
  const qrRefunds = summaryData?.refundSummary.qrRefunds || 0;
  const onlineRefunds = summaryData?.refundSummary.onlineRefunds || 0;
  const bankTransferRefunds = summaryData?.refundSummary.bankTransferRefunds || 0;

  const cashCollection = cashSales - cashRefunds;
  const cardCollection = cardSales - cardRefunds;
  const qrCollection = qrPayments - qrRefunds;
  const onlineCollection = onlinePayments - onlineRefunds;
  const bankTransferCollection = bankTransferPayments - bankTransferRefunds;
  const totalCollection = cashCollection + cardCollection + qrCollection + onlineCollection + bankTransferCollection;

  // G. Inventory Summary values
  const totalSalesQty = summaryData?.inventorySummary.totalSalesQty || 0;
  const totalReturnQty = summaryData?.inventorySummary.totalReturnQty || 0;
  const adjustmentsCount = summaryData?.inventorySummary.adjustmentsCount || 0;
  const totalAdjustedQty = summaryData?.inventorySummary.totalAdjustedQty || 0;

  // H. Exceptions
  const exceptions = summaryData?.exceptions || {
    overrideCount: 0,
    overrideReduction: 0,
    discountCount: 0,
    totalDiscounts: 0,
    negativeStockSalesCount: 0,
    backdatedCount: 0,
    cancelledCount: 0,
    cancelledTotal: 0,
    refundCount: 0,
    refundTotal: 0
  };

  const handlePrintSlip = (sessionDetails) => {
    const denomsHtml = DENOMINATIONS_LIST.map(d => {
      const cnt = Number(denominations[d]) || 0;
      if (cnt === 0) return '';
      return `
        <div style="display:flex;justify-content:space-between;font-size:10px;">
          <span>Rs. ${d} x ${cnt}</span>
          <span>Rs. ${formatCurrency(d * cnt)}</span>
        </div>`;
    }).join('');

    const printHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Day-End Close Slip #${sessionDetails.SessionID || 'Shift'}</title>
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
  <div class="text-center bold" style="font-size:13px;text-transform:uppercase;">DAY-END CLOSING REPORT</div>
  <div class="text-center" style="font-size:9.5px;color:#333;margin-top:2px;">POWERED BY SELLMAX PRO</div>
  <hr/>
  <div style="font-size:10px;line-height:1.3;">
    <div>SESSION ID: #${sessionDetails.SessionID}</div>
    <div>TERMINAL: ${sessionDetails.TerminalID}</div>
    <div>CASHIER: ${sessionDetails.Username || user?.username}</div>
    <div>OPENED: ${new Date(sessionDetails.OpeningTime).toLocaleString()}</div>
    <div>CLOSED: ${new Date().toLocaleString()}</div>
  </div>
  <hr/>

  <div class="section-title">A. Sales Summary</div>
  <div class="row indent"><span>Cash Sales:</span><span>Rs. ${formatCurrency(cashSales)}</span></div>
  <div class="row indent"><span>Credit Sales:</span><span>Rs. ${formatCurrency(creditSales)}</span></div>
  <div class="row indent"><span>Card Sales:</span><span>Rs. ${formatCurrency(cardSales)}</span></div>
  <div class="row indent"><span>QR Payments:</span><span>Rs. ${formatCurrency(qrPayments)}</span></div>
  <div class="row indent"><span>Online Payments:</span><span>Rs. ${formatCurrency(onlinePayments + bankTransferPayments)}</span></div>
  <div class="row indent bold"><span>Gross Sales:</span><span>Rs. ${formatCurrency(grossSales)}</span></div>
  <div class="row indent"><span>Less Returns:</span><span>-Rs. ${formatCurrency(totalRefunds)}</span></div>
  <div class="row indent bold"><span>Net Sales:</span><span>Rs. ${formatCurrency(netSales)}</span></div>
  <hr/>

  <div class="section-title">B. Cash Collection Summary</div>
  <div class="row indent"><span>Opening Float:</span><span>Rs. ${formatCurrency(openingFloat)}</span></div>
  <div class="row indent"><span>Cash Sales:</span><span>Rs. ${formatCurrency(cashSales)}</span></div>
  <div class="row indent"><span>Credit Collections:</span><span>Rs. ${formatCurrency(manualCollections.creditCollections)}</span></div>
  <div class="row indent"><span>Advance Receipts:</span><span>Rs. ${formatCurrency(manualCollections.advanceReceipts)}</span></div>
  <div class="row indent"><span>Other Cash Income:</span><span>Rs. ${formatCurrency(manualCollections.otherIncome)}</span></div>
  <div class="row indent"><span>Previous Inv Collect:</span><span>Rs. ${formatCurrency(manualCollections.previousInvoices)}</span></div>
  <div class="row indent"><span>Less Cash Refunds:</span><span>-Rs. ${formatCurrency(cashRefunds)}</span></div>
  <div class="row indent"><span>Less Supplier Payments:</span><span>-Rs. ${formatCurrency(supplierCashPaidOut + Number(manualPayouts.supplierPayments))}</span></div>
  <div class="row indent"><span>Less Petty Cash:</span><span>-Rs. ${formatCurrency(manualPayouts.pettyCash)}</span></div>
  <div class="row indent"><span>Less Expenses:</span><span>-Rs. ${formatCurrency(manualPayouts.expensePayments)}</span></div>
  <div class="row indent"><span>Less Cash Withdrawals:</span><span>-Rs. ${formatCurrency(manualPayouts.withdrawals)}</span></div>
  <div class="row indent bold"><span>Expected Drawer Cash:</span><span>Rs. ${formatCurrency(expectedCash)}</span></div>
  <hr/>

  <div class="section-title">C. Payment Reconciliation</div>
  <div class="row indent"><span>Cash Collection:</span><span>Rs. ${formatCurrency(cashCollection)}</span></div>
  <div class="row indent"><span>Card Collection:</span><span>Rs. ${formatCurrency(cardCollection)}</span></div>
  <div class="row indent"><span>QR Collection:</span><span>Rs. ${formatCurrency(qrCollection)}</span></div>
  <div class="row indent"><span>Online Collection:</span><span>Rs. ${formatCurrency(onlineCollection)}</span></div>
  <div class="row indent"><span>Bank Transfer Coll:</span><span>Rs. ${formatCurrency(bankTransferCollection)}</span></div>
  <div class="row indent bold"><span>Total Collection:</span><span>Rs. ${formatCurrency(totalCollection)}</span></div>
  <hr/>

  <div class="section-title">D. Cash Drawer Reconciliation</div>
  <div class="row indent"><span>Expected Cash:</span><span>Rs. ${formatCurrency(expectedCash)}</span></div>
  <div class="row indent"><span>Physical Cash:</span><span>Rs. ${formatCurrency(physicalCash)}</span></div>
  <div class="row indent bold"><span>Difference:</span><span>${variance >= 0 ? '+' : ''}Rs. ${formatCurrency(variance)} (${variance === 0 ? 'Balanced' : variance > 0 ? 'Over' : 'Short'})</span></div>
  <hr/>

  <div class="section-title">E. Denominations Breakdown</div>
  ${denomsHtml || '<div style="font-size:10px;text-align:center;">No cash denominations counted</div>'}
  <hr/>

  <div class="section-title">G. Inventory Summary</div>
  <div class="row indent"><span>Sold Qty:</span><span>${Number(totalSalesQty).toFixed(2)}</span></div>
  <div class="row indent"><span>Returned Qty:</span><span>${Number(totalReturnQty).toFixed(2)}</span></div>
  <div class="row indent"><span>Adjustments Count:</span><span>${adjustmentsCount} (${Number(totalAdjustedQty).toFixed(2)} units)</span></div>
  <hr/>

  <div class="section-title">H. Exception Report</div>
  <div class="row indent"><span>Price Overrides:</span><span>${exceptions.overrideCount} (-Rs. ${formatCurrency(exceptions.overrideReduction)})</span></div>
  <div class="row indent"><span>Manual Discounts:</span><span>${exceptions.discountCount} (Rs. ${formatCurrency(exceptions.totalDiscounts)})</span></div>
  <div class="row indent"><span>Negative Stock Sales:</span><span>${exceptions.negativeStockSalesCount}</span></div>
  <div class="row indent"><span>Backdated Entries:</span><span>${exceptions.backdatedCount}</span></div>
  <div class="row indent"><span>Voided Invoices:</span><span>${exceptions.cancelledCount} (Rs. ${formatCurrency(exceptions.cancelledTotal)})</span></div>
  <div class="row indent"><span>Refunded Invoices:</span><span>${exceptions.refundCount} (Rs. ${formatCurrency(exceptions.refundTotal)})</span></div>
  <hr/>
  <div class="text-center" style="margin-top:16px;font-size:10px;">Shift Ended & Reconciled</div>
  <div class="text-center" style="font-size:8px;color:#555;margin-top:2px;">Terminal closed: ${new Date().toLocaleString()}</div>
</body>
</html>`;

    const w = window.open('', '_blank', 'width=450,height=600');
    if (w) {
      w.document.write(printHtml);
      w.document.close();
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const reconciliationReport = {
        salesSummary: {
          cashSales,
          creditSales,
          cardSales,
          qrPayments,
          onlinePayments: onlinePayments + bankTransferPayments,
          grossSales,
          totalRefunds,
          netSales
        },
        cashCollection: {
          openingBalance: openingFloat,
          cashSales,
          creditCollections: Number(manualCollections.creditCollections) || 0,
          advanceReceipts: Number(manualCollections.advanceReceipts) || 0,
          otherIncome: Number(manualCollections.otherIncome) || 0,
          previousInvoices: Number(manualCollections.previousInvoices) || 0,
          cashRefunds,
          supplierPayments: supplierCashPaidOut + (Number(manualPayouts.supplierPayments) || 0),
          pettyCash: Number(manualPayouts.pettyCash) || 0,
          expensePayments: Number(manualPayouts.expensePayments) || 0,
          withdrawals: Number(manualPayouts.withdrawals) || 0,
          expectedCash
        },
        paymentMethods: {
          cashCollection,
          cardCollection,
          qrCollection,
          onlineCollection,
          bankTransferCollection,
          totalCollection
        },
        inventorySummary: {
          totalSalesQty,
          totalReturnQty,
          adjustmentsCount,
          totalAdjustedQty
        },
        exceptions
      };

      const payload = {
        actualCash: physicalCash,
        denominations,
        expectedCash,
        differenceAmount: variance,
        reconciliationData: reconciliationReport
      };

      const res = await fetch(`${API_URL}/api/sales/cash-drawer/close`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        throw new Error((await res.json()).error || 'Failed to close cash drawer session.');
      }

      const closedSession = (await res.json()).session;
      setToast({ type: 'success', message: 'Shift closed and drawer reconciled successfully!' });
      
      // Print closing slip
      handlePrintSlip(closedSession);

      // Notify parent to refresh drawer status
      if (onSessionClosed) {
        onSessionClosed();
      }
    } catch (err) {
      setToast({ type: 'error', message: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
        <RefreshCw size={36} color="var(--primary)" style={{ animation: 'spin 1s linear infinite', marginBottom: '16px' }} />
        <span style={{ fontSize: '15px', color: 'var(--text-secondary)' }}>Compiling reconciliation reports…</span>
      </div>
    );
  }

  const hasVariance = variance !== 0;
  const isShort = variance < 0;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'var(--bg-base)',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      overflowY: 'auto',
      fontFamily: 'var(--font-sans)',
      color: 'var(--text-primary)'
    }}>
      {/* Top Header */}
      <div style={{
        padding: '16px 32px',
        borderBottom: '1px solid var(--border-color)',
        background: 'var(--bg-surface)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--primary-gradient)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--shadow-glow)'
          }}>
            <Scale size={20} color="white" />
          </div>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>Day-End Closing Reconciliation</h2>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', gap: '16px', marginTop: '2px' }}>
              <span>Terminal: <strong>{summaryData?.session.terminalId}</strong></span>
              <span>•</span>
              <span>Cashier: <strong>{summaryData?.session.username || user?.username}</strong></span>
              <span>•</span>
              <span>Opened: <strong>{new Date(summaryData?.session.openingTime).toLocaleString('en-LK')}</strong></span>
            </div>
          </div>
        </div>

        <button style={{
          background: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid var(--border-color)',
          borderRadius: '50%',
          width: '36px',
          height: '36px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-primary)',
          cursor: 'pointer',
          transition: 'all 0.15s'
        }} onClick={onClose}>
          <X size={18} />
        </button>
      </div>

      {/* Main Grid */}
      <div style={{
        flex: 1,
        padding: '32px',
        display: 'grid',
        gridTemplateColumns: '1.2fr 1.8fr',
        gap: '32px',
        maxWidth: '1600px',
        margin: '0 auto',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        
        {/* Left Column: Count Inputs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Denomination Counter */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <DollarSign size={18} style={{ color: 'var(--success)' }} />
              E. Cash Denomination Count
            </h3>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '12px 16px'
            }}>
              {DENOMINATIONS_LIST.map(d => (
                <div key={d} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '65px', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>Rs. {d}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>×</span>
                  <input
                    type="number"
                    placeholder="0"
                    className="form-input"
                    value={denominations[d]}
                    onChange={e => handleDenomChange(d, e.target.value)}
                    style={{
                      padding: '8px 10px',
                      fontSize: '13px',
                      textAlign: 'center',
                      width: '60px',
                      fontFamily: 'var(--font-mono)'
                    }}
                  />
                  <span style={{ flex: 1, textAlign: 'right', fontSize: '12.5px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    Rs. {(d * (Number(denominations[d]) || 0)).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>

            <div style={{
              marginTop: '20px',
              paddingTop: '16px',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span style={{ fontWeight: 600, fontSize: '14px' }}>Physical Count Total:</span>
              <strong style={{ fontSize: '18px', color: 'var(--success)', fontFamily: 'var(--font-mono)' }}>
                Rs. {physicalCash.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
              </strong>
            </div>
          </div>

          {/* Manual Adjustments Collections */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ArrowUpRight size={18} style={{ color: 'var(--success)' }} />
              Cash Collections (Additions)
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Credit Customer Collections:</span>
                <input
                  type="number"
                  placeholder="0.00"
                  className="form-input"
                  value={manualCollections.creditCollections}
                  onChange={e => handleCollectionChange('creditCollections', e.target.value)}
                  style={{ width: '120px', textAlign: 'right', fontFamily: 'var(--font-mono)', padding: '6px 10px', fontSize: '13px' }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Customer Advance Receipts:</span>
                <input
                  type="number"
                  placeholder="0.00"
                  className="form-input"
                  value={manualCollections.advanceReceipts}
                  onChange={e => handleCollectionChange('advanceReceipts', e.target.value)}
                  style={{ width: '120px', textAlign: 'right', fontFamily: 'var(--font-mono)', padding: '6px 10px', fontSize: '13px' }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Other Cash Income:</span>
                <input
                  type="number"
                  placeholder="0.00"
                  className="form-input"
                  value={manualCollections.otherIncome}
                  onChange={e => handleCollectionChange('otherIncome', e.target.value)}
                  style={{ width: '120px', textAlign: 'right', fontFamily: 'var(--font-mono)', padding: '6px 10px', fontSize: '13px' }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Received for Previous Invoices:</span>
                <input
                  type="number"
                  placeholder="0.00"
                  className="form-input"
                  value={manualCollections.previousInvoices}
                  onChange={e => handleCollectionChange('previousInvoices', e.target.value)}
                  style={{ width: '120px', textAlign: 'right', fontFamily: 'var(--font-mono)', padding: '6px 10px', fontSize: '13px' }}
                />
              </div>
            </div>
          </div>

          {/* Manual Adjustments Payouts */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ArrowDownRight size={18} style={{ color: 'var(--danger)' }} />
              Cash Payouts (Deductions)
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Petty Cash Payments:</span>
                <input
                  type="number"
                  placeholder="0.00"
                  className="form-input"
                  value={manualPayouts.pettyCash}
                  onChange={e => handlePayoutChange('pettyCash', e.target.value)}
                  style={{ width: '120px', textAlign: 'right', fontFamily: 'var(--font-mono)', padding: '6px 10px', fontSize: '13px' }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Supplier Payments:</span>
                <input
                  type="number"
                  placeholder="0.00"
                  className="form-input"
                  value={manualPayouts.supplierPayments}
                  onChange={e => handlePayoutChange('supplierPayments', e.target.value)}
                  style={{ width: '120px', textAlign: 'right', fontFamily: 'var(--font-mono)', padding: '6px 10px', fontSize: '13px' }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Expense Payments:</span>
                <input
                  type="number"
                  placeholder="0.00"
                  className="form-input"
                  value={manualPayouts.expensePayments}
                  onChange={e => handlePayoutChange('expensePayments', e.target.value)}
                  style={{ width: '120px', textAlign: 'right', fontFamily: 'var(--font-mono)', padding: '6px 10px', fontSize: '13px' }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Cash Withdrawals:</span>
                <input
                  type="number"
                  placeholder="0.00"
                  className="form-input"
                  value={manualPayouts.withdrawals}
                  onChange={e => handlePayoutChange('withdrawals', e.target.value)}
                  style={{ width: '120px', textAlign: 'right', fontFamily: 'var(--font-mono)', padding: '6px 10px', fontSize: '13px' }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Live Summaries (A-D, F-H) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Section D: Live Reconciliation Summary Banner */}
          <div style={{
            background: hasVariance 
              ? (isShort ? 'var(--danger-bg)' : 'rgba(6, 182, 212, 0.15)') 
              : 'var(--success-bg)',
            border: `1px solid ${hasVariance ? (isShort ? 'var(--danger)' : 'var(--accent)') : 'var(--success)'}`,
            borderRadius: 'var(--radius-md)',
            padding: '20px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                background: hasVariance ? (isShort ? 'var(--danger)' : 'var(--accent)') : 'var(--success)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {hasVariance 
                  ? (isShort ? <AlertTriangle size={20} color="white" /> : <ArrowUpRight size={20} color="white" />)
                  : <CheckCircle size={20} color="white" />
                }
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>D. Cash Drawer Reconciliation</div>
                <div style={{ fontSize: '18px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>Variance:</span>
                  <span style={{ color: hasVariance ? (isShort ? 'var(--danger)' : 'var(--accent)') : 'var(--success)', fontFamily: 'var(--font-mono)' }}>
                    {variance >= 0 ? '+' : ''}Rs. {variance.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                  </span>
                  <span style={{
                    fontSize: '11px',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    background: hasVariance ? (isShort ? 'rgba(239, 68, 68, 0.2)' : 'rgba(6, 182, 212, 0.2)') : 'rgba(16, 185, 129, 0.2)',
                    color: hasVariance ? (isShort ? 'var(--danger)' : 'var(--accent)') : 'var(--success)'
                  }}>
                    {variance === 0 ? 'Balanced' : variance > 0 ? 'Cash Over' : 'Cash Short'}
                  </span>
                </div>
              </div>
            </div>

            <div style={{ textAlign: 'right', display: 'flex', gap: '24px' }}>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Expected Drawer Cash</div>
                <div style={{ fontSize: '15px', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                  Rs. {expectedCash.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Actual Drawer Cash</div>
                <div style={{ fontSize: '15px', fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                  Rs. {physicalCash.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>
          </div>

          {/* Collapsible Accordions (A, B, C, F, G, H) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            
            {/* A. SALES SUMMARY */}
            <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
              <div 
                onClick={() => toggleSection('sales')}
                style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', background: 'rgba(255,255,255,0.01)' }}>
                <span style={{ fontWeight: 700, fontSize: '13.5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ClipboardList size={16} style={{ color: 'var(--primary)' }} />
                  A. Sales Summary
                </span>
                {openSections.sales ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
              {openSections.sales && (
                <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Cash Sales (+):</span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>Rs. {formatCurrency(cashSales)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Credit Sales (+):</span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>Rs. {formatCurrency(creditSales)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Card Sales (Visa + Master + Amex) (+):</span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>Rs. {formatCurrency(cardSales)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>QR Payments (+):</span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>Rs. {formatCurrency(qrPayments)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Online Payments & Transfers (+):</span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>Rs. {formatCurrency(onlinePayments + bankTransferPayments)}</span>
                  </div>
                  {otherSales > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Other Payments (+):</span>
                      <span style={{ fontFamily: 'var(--font-mono)' }}>Rs. {formatCurrency(otherSales)}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '8px', fontWeight: 'bold' }}>
                    <span>Gross Sales:</span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>Rs. {formatCurrency(grossSales)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--danger)' }}>
                    <span>Less Returns & Credit Notes (-):</span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>-Rs. {formatCurrency(totalRefunds)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '8px', fontWeight: 'bold', color: 'var(--success)' }}>
                    <span>Net Sales:</span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>Rs. {formatCurrency(netSales)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* B. CASH COLLECTION SUMMARY */}
            <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
              <div 
                onClick={() => toggleSection('cash')}
                style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', background: 'rgba(255,255,255,0.01)' }}>
                <span style={{ fontWeight: 700, fontSize: '13.5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <DollarSign size={16} style={{ color: 'var(--success)' }} />
                  B. Cash Collection Summary
                </span>
                {openSections.cash ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
              {openSections.cash && (
                <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Opening Float:</span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>Rs. {formatCurrency(openingFloat)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Cash Sales:</span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>Rs. {formatCurrency(cashSales)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Credit Collections (Manual):</span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>Rs. {formatCurrency(manualCollections.creditCollections)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Customer Advance Receipts (Manual):</span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>Rs. {formatCurrency(manualCollections.advanceReceipts)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Cash Received from Other Income (Manual):</span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>Rs. {formatCurrency(manualCollections.otherIncome)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Cash Received for Previous Invoices (Manual):</span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>Rs. {formatCurrency(manualCollections.previousInvoices)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', borderTop: '1px solid var(--border-color)', paddingTop: '8px' }}>
                    <span>Total Cash Received:</span>
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--success)' }}>
                      Rs. {formatCurrency(cashSales + totalCollections)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--danger)' }}>
                    <span>Less Cash Refunds:</span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>-Rs. {formatCurrency(cashRefunds)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--danger)' }}>
                    <span>Less Supplier Payments (System + Manual):</span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>-Rs. {formatCurrency(supplierCashPaidOut + Number(manualPayouts.supplierPayments))}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--danger)' }}>
                    <span>Less Petty Cash Payments (Manual):</span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>-Rs. {formatCurrency(manualPayouts.pettyCash)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--danger)' }}>
                    <span>Less Expense Payments (Manual):</span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>-Rs. {formatCurrency(manualPayouts.expensePayments)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--danger)' }}>
                    <span>Less Cash Withdrawals (Manual):</span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>-Rs. {formatCurrency(manualPayouts.withdrawals)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', borderTop: '1px solid var(--border-color)', paddingTop: '8px' }}>
                    <span>Total Cash Paid Out:</span>
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--danger)' }}>
                      Rs. {formatCurrency(cashRefunds + supplierCashPaidOut + totalPayouts)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '8px', fontWeight: 'bold', color: 'var(--success)' }}>
                    <span>Expected Cash in Drawer:</span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>Rs. {formatCurrency(expectedCash)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* C. PAYMENT METHOD RECONCILIATION */}
            <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
              <div 
                onClick={() => toggleSection('payments')}
                style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', background: 'rgba(255,255,255,0.01)' }}>
                <span style={{ fontWeight: 700, fontSize: '13.5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <TrendingDown size={16} style={{ color: 'var(--accent)' }} />
                  C. Payment Method Reconciliation (Net)
                </span>
                {openSections.payments ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
              {openSections.payments && (
                <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Cash Collection:</span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>Rs. {formatCurrency(cashCollection)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Card Collection (Visa + Master + Amex):</span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>Rs. {formatCurrency(cardCollection)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>QR Collection:</span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>Rs. {formatCurrency(qrCollection)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Online Payments:</span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>Rs. {formatCurrency(onlineCollection)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Bank Transfer Collection:</span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>Rs. {formatCurrency(bankTransferCollection)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '8px', fontWeight: 'bold' }}>
                    <span>Total Net Collection:</span>
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--primary)' }}>Rs. {formatCurrency(totalCollection)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* F. CREDIT SALES SUMMARY */}
            <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
              <div 
                onClick={() => toggleSection('credit')}
                style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', background: 'rgba(255,255,255,0.01)' }}>
                <span style={{ fontWeight: 700, fontSize: '13.5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ArrowUpRight size={16} style={{ color: 'var(--warning)' }} />
                  F. Credit Sales Summary
                </span>
                {openSections.credit ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
              {openSections.credit && (
                <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Today's Credit Sales:</span>
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--warning)' }}>Rs. {formatCurrency(creditSales)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Outstanding Credit Collections:</span>
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--success)' }}>Rs. {formatCurrency(manualCollections.creditCollections)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Customer Advance Receipts:</span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>Rs. {formatCurrency(manualCollections.advanceReceipts)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* G. INVENTORY SUMMARY */}
            <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
              <div 
                onClick={() => toggleSection('inventory')}
                style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', background: 'rgba(255,255,255,0.01)' }}>
                <span style={{ fontWeight: 700, fontSize: '13.5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Scale size={16} style={{ color: 'var(--text-muted)' }} />
                  G. Inventory Summary
                </span>
                {openSections.inventory ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
              {openSections.inventory && (
                <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Total Quantities Sold:</span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>{Number(totalSalesQty).toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Total Quantities Returned:</span>
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--danger)' }}>{Number(totalReturnQty).toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Inventory Adjustments count:</span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>{adjustmentsCount}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Total Adjusted Quantities:</span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>{Number(totalAdjustedQty).toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* H. EXCEPTION REPORT */}
            <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
              <div 
                onClick={() => toggleSection('exceptions')}
                style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', background: 'rgba(255,255,255,0.01)' }}>
                <span style={{ fontWeight: 700, fontSize: '13.5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldAlert size={16} style={{ color: 'var(--danger)' }} />
                  H. Exception Report
                </span>
                {openSections.exceptions ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
              {openSections.exceptions && (
                <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Price Overrides approved count:</span>
                    <span style={{ fontFamily: 'var(--font-mono)', color: exceptions.overrideCount > 0 ? 'var(--warning)' : 'inherit' }}>
                      {exceptions.overrideCount}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Total Price Overrides Reduction value:</span>
                    <span style={{ fontFamily: 'var(--font-mono)', color: exceptions.overrideReduction > 0 ? 'var(--danger)' : 'inherit' }}>
                      Rs. {formatCurrency(exceptions.overrideReduction)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Manual discounts count:</span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>{exceptions.discountCount}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Total discounts value:</span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>Rs. {formatCurrency(exceptions.totalDiscounts)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Negative Stock sales events:</span>
                    <span style={{ fontFamily: 'var(--font-mono)', color: exceptions.negativeStockSalesCount > 0 ? 'var(--danger)' : 'inherit' }}>
                      {exceptions.negativeStockSalesCount}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Backdated entries count:</span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>{exceptions.backdatedCount}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Voided / Cancelled invoices count:</span>
                    <span style={{ fontFamily: 'var(--font-mono)', color: exceptions.cancelledCount > 0 ? 'var(--danger)' : 'inherit' }}>
                      {exceptions.cancelledCount}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Total Cancelled invoice value:</span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>Rs. {formatCurrency(exceptions.cancelledTotal)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Refunded invoices count:</span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>{exceptions.refundCount}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Total Refunded invoice value:</span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>Rs. {formatCurrency(exceptions.refundTotal)}</span>
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* Action Row */}
          <div style={{
            display: 'flex',
            gap: '16px',
            marginTop: '12px',
            justifyContent: 'flex-end'
          }}>
            <button className="btn btn-secondary" style={{ padding: '12px 24px' }} onClick={onClose}>
              Cancel & Back
            </button>
            <button className="btn btn-primary"
              style={{
                padding: '12px 32px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontWeight: 'bold',
                boxShadow: 'var(--shadow-glow)',
                background: submitting ? 'var(--text-muted)' : 'var(--success)',
                borderColor: submitting ? 'var(--text-muted)' : 'var(--success)'
              }}
              onClick={handleSubmit}
              disabled={submitting}>
              {submitting ? (
                <>
                  <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />
                  Reconciling...
                </>
              ) : (
                <>
                  <Printer size={16} />
                  Reconcile & Close Shift
                </>
              )}
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}
