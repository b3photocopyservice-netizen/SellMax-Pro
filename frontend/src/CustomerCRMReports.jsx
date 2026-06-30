import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from './contexts/AuthContext';
import { Search, Calendar, FileText, Download, Printer, User, TrendingUp, DollarSign, Percent, ShieldCheck, Eye, FileDown, FileSpreadsheet } from 'lucide-react';
import formatCurrency from './utils/formatCurrency';
import PrintPreviewModal from './PrintPreviewModal';

export default function CustomerCRMReports({ setToast }) {
  const { token, API_URL } = useAuth();
  
  // Tab control inside reports: 'receivables', 'ledger', 'modes'
  const [activeReportTab, setActiveReportTab] = useState('receivables');

  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [datePreset, setDatePreset] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Autocomplete customer lookup for Statement Ledger
  const [customers, setCustomers] = useState([]);
  const [selectedLedgerCustomer, setSelectedLedgerCustomer] = useState(null);
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [showLedgerDropdown, setShowLedgerDropdown] = useState(false);
  const ledgerDropdownRef = useRef(null);

  // Data sets
  const [receivables, setReceivables] = useState([]);
  const [ledgerEntries, setLedgerEntries] = useState([]);
  const [ledgerOpeningBalance, setLedgerOpeningBalance] = useState(0);
  const [modeSummary, setModeSummary] = useState([]);
  const [loading, setLoading] = useState(false);

  // Print Preview configuration state
  const [previewConfig, setPreviewConfig] = useState({
    show: false,
    title: '',
    headers: [],
    rows: [],
    columnConfig: [],
    totalsRow: null,
    layoutPreset: 'portrait'
  });
  const [companyInfo, setCompanyInfo] = useState(null);

  // Adjustment Modal states
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [adjustmentForm, setAdjustmentForm] = useState({
    customerId: '',
    adjustmentType: 'Credit Note',
    effect: 'Credit',
    amount: '',
    referenceNumber: '',
    description: '',
    date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchCustomers();
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
    let title = '';
    let headers = [];
    let rows = [];
    let colConfig = [];
    let totalsRow = [];
    let layout = 'portrait';

    if (activeReportTab === 'receivables') {
      title = 'Outstanding Credit Receivables';
      headers = ['Customer Code', 'Name', 'Phone', 'Credit Limit', 'Owed Balance', 'Available Credit'];
      colConfig = [
        { align: 'left' },
        { align: 'left' },
        { align: 'left' },
        { align: 'right', isCurrency: true },
        { align: 'right', isCurrency: true },
        { align: 'right', isCurrency: true }
      ];
      rows = filteredReceivables.map(c => [
        c.CustomerCode || `CUST-${c.CustomerID}`,
        c.Name,
        c.Phone || '--',
        Number(c.CreditLimit || 0),
        Number(c.CurrentBalance || 0),
        Number(c.CreditLimit || 0) - Number(c.CurrentBalance || 0)
      ]);
      const limitSum = filteredReceivables.reduce((acc, c) => acc + Number(c.CreditLimit || 0), 0);
      const balanceSum = filteredReceivables.reduce((acc, c) => acc + Number(c.CurrentBalance || 0), 0);
      const availSum = limitSum - balanceSum;
      totalsRow = ['TOTAL', '', '', limitSum, balanceSum, availSum];
    }
    else if (activeReportTab === 'ledger' && selectedLedgerCustomer) {
      title = `Customer Ledger statement — ${selectedLedgerCustomer.Name}`;
      headers = ['Date', 'Document No', 'Type', 'Description', 'Debit', 'Credit', 'Running Balance'];
      colConfig = [
        { align: 'left' },
        { align: 'left' },
        { align: 'left' },
        { align: 'left' },
        { align: 'right', isCurrency: true },
        { align: 'right', isCurrency: true },
        { align: 'right', isCurrency: true }
      ];

      let running = ledgerOpeningBalance;
      const ledgerRows = [];
      
      if (startDate) {
        ledgerRows.push([
          new Date(startDate).toLocaleDateString('en-LK'),
          '—',
          'Opening Balance',
          'Balance brought forward',
          ledgerOpeningBalance >= 0 ? ledgerOpeningBalance : 0,
          ledgerOpeningBalance < 0 ? Math.abs(ledgerOpeningBalance) : 0,
          running
        ]);
      }

      ledgerEntries.forEach(e => {
        running = running + parseFloat(e.Debit) - parseFloat(e.Credit);
        ledgerRows.push([
          new Date(e.Date).toLocaleDateString('en-LK'),
          e.Type === 'Invoice' ? `#SM-${e.RefNo}` : e.RefNo,
          e.Type,
          e.Description || '',
          Number(e.Debit || 0),
          Number(e.Credit || 0),
          running
        ]);
      });
      rows = ledgerRows;

      const debitSum = ledgerEntries.reduce((acc, e) => acc + Number(e.Debit || 0), 0) + (ledgerOpeningBalance >= 0 ? ledgerOpeningBalance : 0);
      const creditSum = ledgerEntries.reduce((acc, e) => acc + Number(e.Credit || 0), 0) + (ledgerOpeningBalance < 0 ? Math.abs(ledgerOpeningBalance) : 0);
      totalsRow = ['TOTAL', '', '', '', debitSum, creditSum, running];
    }
    else if (activeReportTab === 'modes') {
      title = 'Collections Payment Mode Summary';
      headers = ['Payment Method', 'Total Amount Collected'];
      colConfig = [
        { align: 'left' },
        { align: 'right', isCurrency: true }
      ];
      rows = modeSummary.map(m => [
        m.Method || 'Cash',
        Number(m.TotalAmount || 0)
      ]);
      const totalAmount = modeSummary.reduce((acc, m) => acc + Number(m.TotalAmount || 0), 0);
      totalsRow = ['TOTAL', totalAmount];
    }

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
        layoutPreset: layout
      });
      if (actionType === 'print' || actionType === 'pdf') {
        setTimeout(() => {
          window.print();
        }, 300);
      }
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeReportTab, startDate, endDate, selectedLedgerCustomer]);

  // Handle click outside to close ledger customer autocomplete dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (ledgerDropdownRef.current && !ledgerDropdownRef.current.contains(event.target)) {
        setShowLedgerDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchCustomers = async () => {
    try {
      const res = await fetch(`${API_URL}/api/customers`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const list = await res.json();
        setCustomers(list);
        return list;
      }
    } catch (err) {
      console.error('Failed to load customers for autocomplete:', err);
    }
  };

  const handleOpenAdjustmentModal = () => {
    if (!selectedLedgerCustomer) return;
    setAdjustmentForm({
      customerId: selectedLedgerCustomer.CustomerID,
      adjustmentType: 'Credit Note',
      effect: 'Credit',
      amount: '',
      referenceNumber: '',
      description: '',
      date: new Date().toISOString().split('T')[0]
    });
    setShowAdjustmentModal(true);
  };

  const handleTypeChange = (type) => {
    let effect = 'Credit';
    if (type === 'Debit Note' || type === 'Opening Balance' || type === 'Exchange Adjustment') {
      effect = 'Debit';
    }
    setAdjustmentForm(prev => ({
      ...prev,
      adjustmentType: type,
      effect: effect
    }));
  };

  const handleAdjustmentSubmit = async (e) => {
    e.preventDefault();
    if (!adjustmentForm.customerId) {
      setToast({ type: 'error', message: 'Customer is required.' });
      return;
    }
    if (!adjustmentForm.amount || parseFloat(adjustmentForm.amount) <= 0) {
      setToast({ type: 'error', message: 'Valid adjustment amount is required.' });
      return;
    }
    if (!adjustmentForm.adjustmentType) {
      setToast({ type: 'error', message: 'Adjustment Type is required.' });
      return;
    }
    if (!adjustmentForm.effect) {
      setToast({ type: 'error', message: 'Adjustment Effect (Debit or Credit) is required.' });
      return;
    }

    try {
      setActionLoading(true);
      const res = await fetch(`${API_URL}/api/customers/payments/adjustments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(adjustmentForm)
      });
      if (res.ok) {
        setToast({ type: 'success', message: 'Customer ledger adjustment recorded successfully.' });
        setShowAdjustmentModal(false);
        fetchData();
        fetchCustomers().then((updatedList) => {
          if (updatedList) {
            const updatedCust = updatedList.find(c => c.CustomerID === selectedLedgerCustomer.CustomerID);
            if (updatedCust) {
              setSelectedLedgerCustomer(updatedCust);
            }
          }
        });
      } else {
        const data = await res.json();
        setToast({ type: 'error', message: data.error || 'Adjustment logging failed.' });
      }
    } catch (err) {
      setToast({ type: 'error', message: 'Connection failure.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handlePresetChange = (preset) => {
    setDatePreset(preset);
    if (preset === 'custom') return;
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
      case 'today':
        start = formatDate(now);
        end = formatDate(now);
        break;
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
      default:
        break;
    }

    setStartDate(start);
    setEndDate(end);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      let queryParams = `?t=${Date.now()}`;
      if (startDate) queryParams += `&startDate=${startDate}`;
      if (endDate) queryParams += `&endDate=${endDate}`;

      if (activeReportTab === 'receivables') {
        const res = await fetch(`${API_URL}/api/customers/payments/receivables`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          setReceivables(await res.json());
        }
      } 
      else if (activeReportTab === 'ledger' && selectedLedgerCustomer) {
        const res = await fetch(`${API_URL}/api/customers/payments/statement/${selectedLedgerCustomer.CustomerID}${queryParams}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setLedgerEntries(data.transactions || []);
          setLedgerOpeningBalance(data.openingBalance || 0);
        }
      } 
      else if (activeReportTab === 'modes') {
        const res = await fetch(`${API_URL}/api/customers/payments/mode-summary${queryParams}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          setModeSummary(await res.json());
        }
      }
    } catch (err) {
      console.error('Failed to load report data:', err);
      setToast({ type: 'error', message: 'Failed to retrieve report data.' });
    } finally {
      setLoading(false);
    }
  };

  // Client-side CSV Exporter
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

    if (activeReportTab === 'receivables') {
      const headers = ['Customer ID', 'Customer Code', 'Name', 'Phone', 'Email', 'Credit Limit (Rs)', 'Owed Balance (Rs)', 'Available Credit (Rs)'];
      const rows = filteredReceivables.map(c => [
        c.CustomerID,
        c.CustomerCode || '',
        c.Name,
        c.Phone || '',
        c.Email || '',
        c.CreditLimit,
        c.CurrentBalance,
        parseFloat(c.CreditLimit) - parseFloat(c.CurrentBalance)
      ]);
      downloadCSV(headers, rows, `Outstanding_Receivables_${new Date().toISOString().split('T')[0]}.csv`);
    } 
    else if (activeReportTab === 'ledger' && selectedLedgerCustomer) {
      const headers = ['Date', 'Document No', 'Transaction Type', 'Description', 'Debit', 'Credit', 'Running Balance'];
      let running = ledgerOpeningBalance;
      const rows = [];

      // Add Opening Balance row if start date exists
      if (startDate) {
        rows.push([
          new Date(startDate).toLocaleDateString(),
          '—',
          'Opening Balance',
          'Balance brought forward',
          ledgerOpeningBalance >= 0 ? ledgerOpeningBalance.toFixed(2) : '',
          ledgerOpeningBalance < 0 ? Math.abs(ledgerOpeningBalance).toFixed(2) : '',
          running.toFixed(2)
        ]);
      }

      ledgerEntries.forEach(e => {
        running = running + parseFloat(e.Debit) - parseFloat(e.Credit);
        rows.push([
          new Date(e.Date).toLocaleDateString(),
          e.Type === 'Invoice' ? `#SM-${e.RefNo}` : e.RefNo,
          e.Type,
          e.Description,
          e.Debit > 0 ? e.Debit.toFixed(2) : '',
          e.Credit > 0 ? e.Credit.toFixed(2) : '',
          running.toFixed(2)
        ]);
      });
      downloadCSV(headers, rows, `Ledger_Statement_${selectedLedgerCustomer.Name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
    } 
    else if (activeReportTab === 'modes') {
      const headers = ['Payment Mode', 'Total Collections (Rs.)'];
      const rows = modeSummary.map(m => [m.Method, m.TotalAmount]);
      downloadCSV(headers, rows, `Collections_By_Mode_${new Date().toISOString().split('T')[0]}.csv`);
    }
  };

  // Client-side PDF Print view builder
  const handlePrintReport = () => {
    let bodyHtml = '';
    const title = activeReportTab === 'receivables' ? 'Outstanding Receivables Report' 
                : activeReportTab === 'ledger' ? `Customer Ledger Statement — ${selectedLedgerCustomer?.Name}`
                : 'Collections Payment Mode Summary';

    if (activeReportTab === 'receivables') {
      const rowsHtml = filteredReceivables.map(c => `
        <tr>
          <td>${c.CustomerCode || `CUST-${c.CustomerID}`}</td>
          <td>${c.Name}</td>
          <td>${c.Phone || '--'}</td>
          <td style="text-align: right;">Rs. ${Number(c.CreditLimit).toFixed(2)}</td>
          <td style="text-align: right; color: red;">Rs. ${Number(c.CurrentBalance).toFixed(2)}</td>
          <td style="text-align: right;">Rs. ${(Number(c.CreditLimit) - Number(c.CurrentBalance)).toFixed(2)}</td>
        </tr>
      `).join('');

      bodyHtml = `
        <table>
          <thead>
            <tr>
              <th style="text-align: left;">Code</th>
              <th style="text-align: left;">Customer Name</th>
              <th style="text-align: left;">Phone</th>
              <th style="text-align: right;">Credit Limit</th>
              <th style="text-align: right;">Owed Balance</th>
              <th style="text-align: right;">Available Credit</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
        <div style="margin-top: 20px; text-align: right; font-weight: bold; font-size: 14px;">
          Total Outstanding Receivables: Rs. ${totalOwedBalance.toFixed(2)}
        </div>
      `;
    } 
    else if (activeReportTab === 'ledger' && selectedLedgerCustomer) {
      let running = ledgerOpeningBalance;
      let rowsHtml = '';

      if (startDate) {
        rowsHtml += `
          <tr>
            <td>${new Date(startDate).toLocaleDateString()}</td>
            <td>—</td>
            <td>Opening Balance</td>
            <td>Balance brought forward</td>
            <td style="text-align: right;">${ledgerOpeningBalance >= 0 ? `Rs. ${ledgerOpeningBalance.toFixed(2)}` : '--'}</td>
            <td style="text-align: right;">${ledgerOpeningBalance < 0 ? `Rs. ${Math.abs(ledgerOpeningBalance).toFixed(2)}` : '--'}</td>
            <td style="text-align: right; font-weight: bold;">Rs. ${running.toFixed(2)}</td>
          </tr>
        `;
      }

      rowsHtml += ledgerEntries.map(e => {
        running = running + parseFloat(e.Debit) - parseFloat(e.Credit);
        return `
          <tr>
            <td>${new Date(e.Date).toLocaleDateString()}</td>
            <td>${e.Type === 'Invoice' ? `#SM-${e.RefNo}` : e.RefNo}</td>
            <td>${e.Type}</td>
            <td>${e.Description}</td>
            <td style="text-align: right; color: ${e.Debit > 0 ? 'red' : 'inherit'}">${e.Debit > 0 ? `Rs. ${Number(e.Debit).toFixed(2)}` : '--'}</td>
            <td style="text-align: right; color: ${e.Credit > 0 ? 'green' : 'inherit'}">${e.Credit > 0 ? `Rs. ${Number(e.Credit).toFixed(2)}` : '--'}</td>
            <td style="text-align: right; font-weight: bold;">Rs. ${running.toFixed(2)}</td>
          </tr>
        `;
      }).join('');

      bodyHtml = `
        <div style="margin-bottom: 12px;">
          <strong>Customer:</strong> ${selectedLedgerCustomer.Name} (${selectedLedgerCustomer.CustomerCode || `CUST-${selectedLedgerCustomer.CustomerID}`})<br>
          <strong>Credit Limit:</strong> Rs. ${Number(selectedLedgerCustomer.CreditLimit).toFixed(2)} | 
          <strong>Current Outstanding:</strong> Rs. ${Number(selectedLedgerCustomer.CurrentBalance).toFixed(2)}
        </div>
        <table>
          <thead>
            <tr>
              <th style="text-align: left;">Date</th>
              <th style="text-align: left;">Document No</th>
              <th style="text-align: left;">Transaction Type</th>
              <th style="text-align: left;">Description</th>
              <th style="text-align: right;">Debit</th>
              <th style="text-align: right;">Credit</th>
              <th style="text-align: right;">Running Balance</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      `;
    } 
    else if (activeReportTab === 'modes') {
      const rowsHtml = modeSummary.map(m => `
        <tr>
          <td>${m.Method}</td>
          <td style="text-align: right; font-weight: bold;">Rs. ${Number(m.TotalAmount).toFixed(2)}</td>
        </tr>
      `).join('');

      const totalColl = modeSummary.reduce((s, item) => s + parseFloat(item.TotalAmount), 0);

      bodyHtml = `
        <table style="width: 50%; margin: 0 auto;">
          <thead>
            <tr>
              <th style="text-align: left;">Payment Method</th>
              <th style="text-align: right;">Total Collected</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
            <tr style="border-top: 2px solid #000; font-weight: bold;">
              <td>TOTAL</td>
              <td style="text-align: right;">Rs. ${totalColl.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      `;
    }

    const html = `
    <html>
    <head>
      <title>${title}</title>
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
        <div class="title">${title}</div>
        <div class="subtitle">Generated on ${new Date().toLocaleString()} ${startDate || endDate ? `• Filter: ${startDate || 'Start'} to ${endDate || 'End'}` : ''}</div>
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
    setTimeout(() => {
      popup.print();
      popup.close();
    }, 250);
  };

  const handleSelectLedgerCustomer = (customer) => {
    setSelectedLedgerCustomer(customer);
    setLedgerSearch(customer.Name);
    setShowLedgerDropdown(false);
  };

  // Filter Receivables
  const filteredReceivables = receivables.filter(c => 
    c.Name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.CustomerCode && c.CustomerCode.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (c.Phone && c.Phone.includes(searchQuery))
  );

  const totalOwedBalance = filteredReceivables.reduce((sum, item) => sum + parseFloat(item.CurrentBalance), 0);
  const totalLimit = filteredReceivables.reduce((sum, item) => sum + parseFloat(item.CreditLimit), 0);
  const totalAvailableCredit = totalLimit - totalOwedBalance;

  // Autocomplete suggestions for Ledger Tab
  const filteredLedgerCustomers = ledgerSearch
    ? customers.filter(c => 
        c.Name.toLowerCase().includes(ledgerSearch.toLowerCase()) ||
        (c.CustomerCode && c.CustomerCode.toLowerCase().includes(ledgerSearch.toLowerCase())) ||
        (c.Phone && c.Phone.includes(ledgerSearch))
      )
    : customers;

  // Max collected for progress-bar mapping
  const maxCollectionAmount = modeSummary.length > 0 ? Math.max(...modeSummary.map(m => parseFloat(m.TotalAmount))) : 1;
  const totalModeCollection = modeSummary.reduce((sum, item) => sum + parseFloat(item.TotalAmount), 0);

  return (
    <div>
      {/* Tab selectors for CRM Reports */}
      <div className="category-tabs" style={{ marginBottom: '24px' }}>
        <button 
          className={`category-tab ${activeReportTab === 'receivables' ? 'active' : ''}`}
          onClick={() => setActiveReportTab('receivables')}
        >
          Outstanding Receivables
        </button>
        <button 
          className={`category-tab ${activeReportTab === 'ledger' ? 'active' : ''}`}
          onClick={() => setActiveReportTab('ledger')}
        >
          Customer Statement Ledger
        </button>
        <button 
          className={`category-tab ${activeReportTab === 'modes' ? 'active' : ''}`}
          onClick={() => setActiveReportTab('modes')}
        >
          Collection Mode Summary
        </button>
      </div>

      {/* FILTERS AREA */}
      <div className="glass-panel" style={{ padding: '16px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '24px', position: 'relative', zIndex: 10 }}>
        
        {/* Receivables Specific Search */}
        {activeReportTab === 'receivables' && (
          <div className="search-box-container" style={{ width: '280px' }}>
            <Search className="search-icon" size={18} />
            <input
              type="text"
              className="form-input pos-search"
              placeholder="Search outstanding list..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        )}

        {/* Ledger Customer Search Autocomplete */}
        {activeReportTab === 'ledger' && (
          <div className="form-group" style={{ position: 'relative', width: '320px', margin: 0 }} ref={ledgerDropdownRef}>
            <div className="search-box-container" style={{ width: '100%' }}>
              <User className="search-icon" size={18} style={{ color: 'var(--primary)' }} />
              <input
                type="text"
                className="form-input pos-search"
                placeholder="Select ledger customer..."
                value={ledgerSearch}
                onChange={(e) => {
                  setLedgerSearch(e.target.value);
                  setShowLedgerDropdown(true);
                  if (selectedLedgerCustomer) {
                    setSelectedLedgerCustomer(null);
                  }
                }}
                onFocus={() => setShowLedgerDropdown(true)}
              />
            </div>
            
            {showLedgerDropdown && filteredLedgerCustomers.length > 0 && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                background: 'var(--bg-surface-elevated, #1e293b)',
                border: '1px solid var(--border-color, #334155)',
                borderRadius: '8px',
                maxHeight: '220px',
                overflowY: 'auto',
                zIndex: 1000,
                marginTop: '4px',
                boxShadow: '0 12px 30px rgba(0,0,0,0.65)'
              }}>
                {filteredLedgerCustomers.map(c => (
                  <div
                    key={c.CustomerID}
                    onClick={() => handleSelectLedgerCustomer(c)}
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
                      <div style={{ fontWeight: '600', fontSize: '13px' }}>{c.Name}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                        {c.CustomerCode || `CUST-${c.CustomerID}`}
                      </div>
                    </div>
                    <div className="mono" style={{ fontSize: '11px', color: 'var(--danger)' }}>
                      Rs. {formatCurrency(c.CurrentBalance)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Date presets for statement ledger and collections summary */}
        {activeReportTab !== 'receivables' && (
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
              <option value="last-month">Last Month</option>
              <option value="custom">Custom Range</option>
            </select>

            {datePreset === 'custom' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calendar size={16} style={{ color: 'var(--text-secondary)' }} />
                <input
                  type="date"
                  className="form-input"
                  style={{ width: '140px', padding: '6px 12px', fontSize: '13px' }}
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
                <span style={{ color: 'var(--text-secondary)' }}>to</span>
                <input
                  type="date"
                  className="form-input"
                  style={{ width: '140px', padding: '6px 12px', fontSize: '13px' }}
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            )}
          </div>
        )}

        {/* Action triggers: CSV Export and Print */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
          {activeReportTab === 'ledger' && (
            <button
              className="btn btn-primary"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                fontSize: '13px',
                background: 'linear-gradient(135deg, var(--primary) 0%, #06b6d4) 100%',
                border: 'none',
                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.2)'
              }}
              onClick={handleOpenAdjustmentModal}
              disabled={!selectedLedgerCustomer}
            >
              <span>+ Record Adjustment</span>
            </button>
          )}
           <button
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', fontSize: '13px' }}
            onClick={() => triggerReportAction('preview')}
            disabled={activeReportTab === 'ledger' && !selectedLedgerCustomer}
          >
            <Eye size={14} />
            <span>Preview</span>
          </button>
          <button
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', fontSize: '13px' }}
            onClick={() => triggerReportAction('print')}
            disabled={activeReportTab === 'ledger' && !selectedLedgerCustomer}
          >
            <Printer size={14} />
            <span>Print</span>
          </button>
          <button
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', fontSize: '13px' }}
            onClick={() => triggerReportAction('pdf')}
            disabled={activeReportTab === 'ledger' && !selectedLedgerCustomer}
          >
            <FileDown size={14} />
            <span>PDF</span>
          </button>
          <button
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', fontSize: '13px' }}
            onClick={() => triggerReportAction('excel')}
            disabled={activeReportTab === 'ledger' && !selectedLedgerCustomer}
          >
            <FileSpreadsheet size={14} />
            <span>Excel</span>
          </button>
        </div>

      </div>

      {/* REPORT CONTENT VIEW */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '50px 0', color: 'var(--text-secondary)' }}>Loading report entries...</div>
      ) : (
        <>
          {/* TAB 1: OUTSTANDING RECEIVABLES aging card panels */}
          {activeReportTab === 'receivables' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Financial Dashboard summary cards */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
                
                <div className="glass-panel" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '12px', borderRadius: '8px', color: 'var(--danger)' }}>
                    <DollarSign size={24} />
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Total Outstanding Receivables</div>
                    <div style={{ fontSize: '20px', fontWeight: 'bold' }} className="mono">Rs. {formatCurrency(totalOwedBalance)}</div>
                  </div>
                </div>

                <div className="glass-panel" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ background: 'rgba(99, 102, 241, 0.1)', padding: '12px', borderRadius: '8px', color: 'var(--primary)' }}>
                    <TrendingUp size={24} />
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Total Credit Limits Allocation</div>
                    <div style={{ fontSize: '20px', fontWeight: 'bold' }} className="mono">Rs. {formatCurrency(totalLimit)}</div>
                  </div>
                </div>

                <div className="glass-panel" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ background: 'rgba(34, 197, 94, 0.1)', padding: '12px', borderRadius: '8px', color: 'var(--success)' }}>
                    <ShieldCheck size={24} />
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Available Store Credit Room</div>
                    <div style={{ fontSize: '20px', fontWeight: 'bold' }} className="mono">Rs. {formatCurrency(totalAvailableCredit)}</div>
                  </div>
                </div>

              </div>

              {/* Data Table */}
              <div className="glass-panel" style={{ padding: 0 }}>
                <div className="table-container">
                  <table className="table-glass">
                    <thead>
                      <tr>
                        <th>Customer Code</th>
                        <th>Customer Name</th>
                        <th>Phone Number</th>
                        <th>Email Address</th>
                        <th>Credit Limit</th>
                        <th>Owed Balance</th>
                        <th>Available Credit Limit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredReceivables.length === 0 ? (
                        <tr>
                          <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                            No customer accounts have outstanding debt.
                          </td>
                        </tr>
                      ) : (
                        filteredReceivables.map(c => {
                          const available = parseFloat(c.CreditLimit) - parseFloat(c.CurrentBalance);
                          return (
                            <tr key={c.CustomerID}>
                              <td className="mono" style={{ fontWeight: '600' }}>{c.CustomerCode || `CUST-${c.CustomerID}`}</td>
                              <td><span style={{ fontWeight: '600' }}>{c.Name}</span></td>
                              <td>{c.Phone || '--'}</td>
                              <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{c.Email || '--'}</td>
                              <td className="mono">Rs. {formatCurrency(c.CreditLimit)}</td>
                              <td className="mono" style={{ color: 'var(--danger)', fontWeight: 'bold' }}>Rs. {formatCurrency(c.CurrentBalance)}</td>
                              <td className="mono" style={{ color: 'var(--success)' }}>Rs. {formatCurrency(available)}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                    {filteredReceivables.length > 0 && (
                      <tfoot>
                        <tr style={{ fontWeight: 'bold', background: 'rgba(255, 255, 255, 0.05)' }}>
                          <td colSpan={4}>TOTAL</td>
                          <td className="mono">Rs. {formatCurrency(totalLimit)}</td>
                          <td className="mono" style={{ color: 'var(--danger)' }}>Rs. {formatCurrency(totalOwedBalance)}</td>
                          <td className="mono" style={{ color: 'var(--success)' }}>Rs. {formatCurrency(totalAvailableCredit)}</td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: STATEMENT LEDGER */}
          {activeReportTab === 'ledger' && (
            <div className="glass-panel" style={{ padding: '24px' }}>
              {selectedLedgerCustomer ? (
                <>
                  <div style={{
                    marginBottom: '20px',
                    padding: '16px',
                    borderRadius: '8px',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '16px'
                  }}>
                    <div>
                      <h4 style={{ margin: '0 0 4px 0', fontSize: '16px' }}>{selectedLedgerCustomer.Name}</h4>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        Customer Code: {selectedLedgerCustomer.CustomerCode || `CUST-${selectedLedgerCustomer.CustomerID}`} • Phone: {selectedLedgerCustomer.Phone || '--'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '24px' }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Assigned Limit</div>
                        <strong className="mono" style={{ fontSize: '15px' }}>Rs. {formatCurrency(selectedLedgerCustomer.CreditLimit)}</strong>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Current Balance Owed</div>
                        <strong className="mono" style={{ fontSize: '15px', color: selectedLedgerCustomer.CurrentBalance > 0 ? 'var(--danger)' : 'var(--success)' }}>
                          Rs. {formatCurrency(selectedLedgerCustomer.CurrentBalance)}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {ledgerEntries.length === 0 && !startDate ? (
                    <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
                      No ledger transactions found for this customer during the selected date range.
                    </div>
                  ) : (
                    <div className="table-container">
                      <table className="table-glass">
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Document No</th>
                            <th>Transaction Type</th>
                            <th>Description</th>
                            <th style={{ textAlign: 'right' }}>Debit</th>
                            <th style={{ textAlign: 'right' }}>Credit</th>
                            <th style={{ textAlign: 'right' }}>Running Balance</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            let running = ledgerOpeningBalance;
                            const rows = [];

                            if (startDate) {
                              rows.push(
                                <tr key="opening-balance" style={{ fontStyle: 'italic', background: 'rgba(255,255,255,0.01)' }}>
                                  <td>{new Date(startDate).toLocaleDateString()}</td>
                                  <td className="mono">—</td>
                                  <td>Opening Balance</td>
                                  <td>Balance brought forward</td>
                                  <td className="mono" style={{ textAlign: 'right' }}>
                                    {ledgerOpeningBalance >= 0 ? `Rs. ${formatCurrency(ledgerOpeningBalance)}` : '--'}
                                  </td>
                                  <td className="mono" style={{ textAlign: 'right' }}>
                                    {ledgerOpeningBalance < 0 ? `Rs. ${formatCurrency(Math.abs(ledgerOpeningBalance))}` : '--'}
                                  </td>
                                  <td className="mono" style={{ textAlign: 'right', fontWeight: 'bold' }}>
                                    Rs. {formatCurrency(running)}
                                  </td>
                                </tr>
                              );
                            }

                            ledgerEntries.forEach((e, index) => {
                              running = running + parseFloat(e.Debit) - parseFloat(e.Credit);
                              rows.push(
                                <tr key={index}>
                                  <td>{new Date(e.Date).toLocaleDateString()}</td>
                                  <td className="mono" style={{ fontWeight: '600' }}>
                                    {e.Type === 'Invoice' ? `#SM-${e.RefNo}` : e.RefNo}
                                  </td>
                                  <td>
                                    <span style={{
                                      padding: '2px 8px',
                                      borderRadius: '4px',
                                      fontSize: '11px',
                                      fontWeight: '700',
                                      background: e.Type === 'Invoice' || e.Type === 'Debit Note' ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
                                      color: e.Type === 'Invoice' || e.Type === 'Debit Note' ? 'var(--danger)' : 'var(--success)'
                                    }}>
                                      {e.Type}
                                    </span>
                                  </td>
                                  <td style={{ fontSize: '12px' }}>{e.Description}</td>
                                  <td className="mono" style={{ textAlign: 'right', color: e.Debit > 0 ? 'var(--danger)' : 'var(--text-secondary)' }}>
                                    {e.Debit > 0 ? `Rs. ${formatCurrency(e.Debit)}` : '--'}
                                  </td>
                                  <td className="mono" style={{ textAlign: 'right', color: e.Credit > 0 ? 'var(--success)' : 'var(--text-secondary)' }}>
                                    {e.Credit > 0 ? `Rs. ${formatCurrency(e.Credit)}` : '--'}
                                  </td>
                                  <td className="mono" style={{ textAlign: 'right', fontWeight: 'bold' }}>
                                    Rs. {formatCurrency(running)}
                                  </td>
                                </tr>
                              );
                            });
                            return rows;
                          })()}
                        </tbody>
                        <tfoot>
                          <tr style={{ fontWeight: 'bold', background: 'rgba(255, 255, 255, 0.05)' }}>
                            <td colSpan={4}>TOTAL</td>
                            <td className="mono" style={{ textAlign: 'right' }}>
                              Rs. {formatCurrency(ledgerEntries.reduce((acc, e) => acc + Number(e.Debit || 0), 0) + (ledgerOpeningBalance >= 0 ? ledgerOpeningBalance : 0))}
                            </td>
                            <td className="mono" style={{ textAlign: 'right' }}>
                              Rs. {formatCurrency(ledgerEntries.reduce((acc, e) => acc + Number(e.Credit || 0), 0) + (ledgerOpeningBalance < 0 ? Math.abs(ledgerOpeningBalance) : 0))}
                            </td>
                            <td className="mono" style={{ textAlign: 'right', fontWeight: 'bold' }}>
                              Rs. {formatCurrency(ledgerOpeningBalance + ledgerEntries.reduce((acc, e) => acc + Number(e.Debit || 0) - Number(e.Credit || 0), 0))}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-secondary)' }}>
                  Please search and select a customer above to view their Statement Ledger.
                </div>
              )}
            </div>
          )}

          {/* TAB 3: PAYMENT MODE SUMMARY */}
          {activeReportTab === 'modes' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'start' }}>
              
              {/* Graphical Visual Progression Cards */}
              <div className="glass-panel" style={{ padding: '24px' }}>
                <h4 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: '600' }}>Collection Split Breakdown</h4>
                
                {modeSummary.length === 0 ? (
                  <div style={{ color: 'var(--text-secondary)' }}>No collections logged in this period.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {modeSummary.map((m, i) => {
                      const amount = parseFloat(m.TotalAmount);
                      const percentage = ((amount / totalModeCollection) * 100).toFixed(1);
                      return (
                        <div key={i}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '13px' }}>
                            <span style={{ fontWeight: '600' }}>{m.Method}</span>
                            <span className="mono">Rs. {formatCurrency(amount)} ({percentage}%)</span>
                          </div>
                          <div style={{ height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{
                              width: `${percentage}%`,
                              height: '100%',
                              background: 'var(--primary)',
                              borderRadius: '4px'
                            }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Data Table List */}
              <div className="glass-panel" style={{ padding: 0 }}>
                <div className="table-container">
                  <table className="table-glass">
                    <thead>
                      <tr>
                        <th>Payment Method</th>
                        <th style={{ textAlign: 'right' }}>Total Collections</th>
                        <th style={{ textAlign: 'right' }}>Weightage</th>
                      </tr>
                    </thead>
                    <tbody>
                      {modeSummary.length === 0 ? (
                        <tr>
                          <td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                            No payment collection summaries available.
                          </td>
                        </tr>
                      ) : (
                        modeSummary.map((m, i) => {
                          const percent = ((parseFloat(m.TotalAmount) / totalModeCollection) * 100).toFixed(1);
                          return (
                            <tr key={i}>
                              <td><span style={{ fontWeight: '600' }}>{m.Method}</span></td>
                              <td className="mono" style={{ textAlign: 'right', fontWeight: 'bold' }}>Rs. {formatCurrency(m.TotalAmount)}</td>
                              <td className="mono" style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>{percent}%</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                    {modeSummary.length > 0 && (
                      <tfoot>
                        <tr style={{ fontWeight: 'bold', background: 'rgba(255, 255, 255, 0.05)' }}>
                          <td>TOTAL COLLECTION</td>
                          <td className="mono" style={{ textAlign: 'right', color: 'var(--primary)' }}>Rs. {formatCurrency(totalModeCollection)}</td>
                          <td className="mono" style={{ textAlign: 'right' }}>100%</td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>

            </div>
          )}
        </>
      )}

      {showAdjustmentModal && (() => {
        const outstandingBalance = selectedLedgerCustomer ? Number(selectedLedgerCustomer.CurrentBalance) : 0;
        const adjAmt = parseFloat(adjustmentForm.amount) || 0;
        let balanceAfter = outstandingBalance;
        if (adjustmentForm.effect === 'Debit') {
          balanceAfter = outstandingBalance + adjAmt;
        } else {
          balanceAfter = outstandingBalance - adjAmt;
        }

        return (
          <div className="modal-overlay no-print" onClick={(e) => e.target === e.currentTarget && setShowAdjustmentModal(false)}>
            <div style={{
              width: '520px',
              background: 'linear-gradient(145deg, #0f1423 0%, #161c30 100%)',
              border: '1px solid var(--border-color)',
              borderRadius: '20px',
              boxShadow: '0 32px 80px rgba(0,0,0,0.6), 0 0 40px rgba(139,92,246,0.1)',
              overflow: 'hidden',
              fontFamily: 'var(--font-sans)',
            }}>
              <form onSubmit={handleAdjustmentSubmit}>
                {/* Header */}
                <div style={{
                  background: 'linear-gradient(135deg, #2a1f42 0%, #0c2730 100%)',
                  borderBottom: '1px solid var(--border-color)',
                  padding: '24px 28px 20px',
                  position: 'relative',
                  overflow: 'hidden',
                }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', position:'relative' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                      <div style={{
                        width:'36px', height:'36px', borderRadius:'10px',
                        background:'linear-gradient(135deg,#8b5cf6,#06b6d4)',
                        display:'flex', alignItems:'center', justifyContent:'center',
                        fontSize:'18px', boxShadow:'0 4px 12px rgba(139,92,246,0.4)'
                      }}>📝</div>
                      <div>
                        <div style={{ fontSize:'17px', fontWeight:'800', color:'#f8fafc', letterSpacing:'-0.3px' }}>Customer Ledger Adjustment</div>
                        <div style={{ fontSize:'11px', color:'rgba(148,163,184,0.9)', fontWeight:'500', textTransform:'uppercase', letterSpacing:'1px' }}>Debit / Credit Adjustments</div>
                      </div>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontSize:'11px', color:'rgba(148,163,184,0.7)', marginBottom:'2px' }}>DATE</div>
                      <div style={{ fontSize:'13px', fontWeight:'700', color:'#f8fafc' }}>
                        {adjustmentForm.date ? new Date(adjustmentForm.date).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : '—'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Body */}
                <div style={{ padding:'28px', display:'flex', flexDirection:'column', gap:'20px', background:'#090b16' }}>
                  {/* Customer Info Strip */}
                  {selectedLedgerCustomer && (
                    <div style={{
                      display:'flex', justifyContent:'space-between', alignItems:'center',
                      background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)',
                      borderRadius:'12px', padding:'12px 16px'
                    }}>
                      <div>
                        <div style={{ fontSize:'13px', fontWeight:'700', color:'#f8fafc' }}>{selectedLedgerCustomer.Name}</div>
                        <div style={{ fontSize:'11px', color:'rgba(148,163,184,0.6)', marginTop:'2px' }}>Code: {selectedLedgerCustomer.CustomerCode || `CUST-${selectedLedgerCustomer.CustomerID}`}</div>
                      </div>
                      <div style={{ textAlign:'right' }}>
                        <div style={{ fontSize:'11px', color:'rgba(148,163,184,0.6)' }}>Outstanding Bal</div>
                        <div style={{ fontSize:'14px', fontWeight:'800', color: outstandingBalance > 0 ? '#f59e0b' : '#38bdf8', marginTop:'2px' }}>
                          Rs. {formatCurrency(outstandingBalance)}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Date + Ref No */}
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
                    <div>
                      <label style={{ fontSize:'11px', fontWeight:'700', color:'rgba(148,163,184,0.8)', textTransform:'uppercase', display:'block', marginBottom:'6px' }}>
                        Date
                      </label>
                      <input
                        type="date" className="form-input"
                        value={adjustmentForm.date}
                        onChange={(e) => setAdjustmentForm(prev => ({ ...prev, date: e.target.value }))}
                        style={{ borderRadius:'10px' }}
                        required
                      />
                    </div>
                    <div>
                      <label style={{ fontSize:'11px', fontWeight:'700', color:'rgba(148,163,184,0.8)', textTransform:'uppercase', display:'block', marginBottom:'6px' }}>
                        Ref / Document No.
                      </label>
                      <input
                        type="text" className="form-input"
                        value={adjustmentForm.referenceNumber}
                        onChange={(e) => setAdjustmentForm(prev => ({ ...prev, referenceNumber: e.target.value }))}
                        placeholder="Optional"
                        style={{ borderRadius:'10px' }}
                      />
                    </div>
                  </div>

                  {/* Type Selector & Effect */}
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
                    <div>
                      <label style={{ fontSize:'11px', fontWeight:'700', color:'rgba(148,163,184,0.8)', textTransform:'uppercase', display:'block', marginBottom:'6px' }}>
                        Adjustment Type
                      </label>
                      <select
                        className="form-select"
                        value={adjustmentForm.adjustmentType}
                        onChange={(e) => handleTypeChange(e.target.value)}
                        style={{ borderRadius:'10px' }}
                        required
                      >
                        <option value="Credit Note">Credit Note</option>
                        <option value="Debit Note">Debit Note</option>
                        <option value="Opening Balance">Opening Balance</option>
                        <option value="Customer Advance">Customer Advance</option>
                        <option value="Exchange Adjustment">Exchange Adjustment</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize:'11px', fontWeight:'700', color:'rgba(148,163,184,0.8)', textTransform:'uppercase', display:'block', marginBottom:'6px' }}>
                        Adjustment Effect
                      </label>
                      <select
                        className="form-select"
                        value={adjustmentForm.effect}
                        onChange={(e) => setAdjustmentForm(prev => ({ ...prev, effect: e.target.value }))}
                        style={{ borderRadius:'10px' }}
                        required
                      >
                        <option value="Credit">Reduce Balance (Credit)</option>
                        <option value="Debit">Increase Balance (Debit)</option>
                      </select>
                    </div>
                  </div>

                  {/* Amount */}
                  <div>
                    <label style={{ fontSize:'11px', fontWeight:'700', color:'rgba(148,163,184,0.8)', textTransform:'uppercase', display:'block', marginBottom:'6px' }}>
                      Amount (Rs.)
                    </label>
                    <input
                      type="number" step="0.01" className="form-input"
                      value={adjustmentForm.amount}
                      onChange={(e) => setAdjustmentForm(prev => ({ ...prev, amount: e.target.value }))}
                      placeholder="0.00"
                      style={{ borderRadius:'10px', fontWeight:'700', fontFamily:'var(--font-mono)', color:'#38bdf8' }}
                      required
                    />
                  </div>

                  {/* Narration */}
                  <div>
                    <label style={{ fontSize:'11px', fontWeight:'700', color:'rgba(148,163,184,0.8)', textTransform:'uppercase', display:'block', marginBottom:'6px' }}>
                      Narration / Description
                    </label>
                    <input
                      type="text" className="form-input"
                      value={adjustmentForm.description}
                      onChange={(e) => setAdjustmentForm(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="e.g. Rate difference credit / initial opening balance"
                      style={{ borderRadius:'10px' }}
                      required
                    />
                  </div>

                  {/* Future Preview */}
                  <div style={{
                    padding:'12px 16px', background:'rgba(0,0,0,0.2)', border:'1px solid rgba(255,255,255,0.05)',
                    borderRadius:'12px', fontSize:'12px', color:'rgba(148,163,184,0.9)'
                  }}>
                    <div style={{ display:'flex', justifyContent:'space-between' }}>
                      <span>New Projected Balance:</span>
                      <span style={{ fontWeight:'700', color: balanceAfter > 0 ? '#f59e0b' : '#38bdf8' }}>
                        Rs. {formatCurrency(balanceAfter)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div style={{
                  padding:'18px 28px',
                  borderTop:'1px solid rgba(255,255,255,0.07)',
                  background:'rgba(0,0,0,0.2)',
                  display:'flex', justifyContent:'space-between', alignItems:'center', gap:'12px'
                }}>
                  <button
                    type="button"
                    onClick={() => setShowAdjustmentModal(false)}
                    style={{
                      padding:'10px 22px', borderRadius:'10px', border:'1px solid rgba(255,255,255,0.12)',
                      background:'transparent', color:'rgba(148,163,184,0.8)',
                      fontSize:'13px', fontWeight:'600', cursor:'pointer',
                      transition:'all 0.2s',
                    }}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={actionLoading}
                    style={{
                      flex:1, padding:'12px 24px', borderRadius:'10px', border:'none',
                      background: actionLoading ? 'rgba(139,92,246,0.4)' : 'linear-gradient(135deg,#8b5cf6,#06b6d4)',
                      color:'#fff', fontSize:'14px', fontWeight:'700', cursor: actionLoading ? 'not-allowed' : 'pointer',
                      boxShadow: actionLoading ? 'none' : '0 4px 20px rgba(139,92,246,0.35)',
                      transition:'all 0.2s',
                      display:'flex', alignItems:'center', justifyContent:'center', gap:'8px'
                    }}
                  >
                    {actionLoading ? 'Saving...' : 'Save Adjustment'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}
      <PrintPreviewModal 
        show={previewConfig.show}
        onClose={() => setPreviewConfig(prev => ({ ...prev, show: false }))}
        title={previewConfig.title}
        companyInfo={companyInfo}
        filters={{
          'Report Mode': activeReportTab === 'receivables' ? 'Outstanding Receivables' : activeReportTab === 'ledger' ? 'Statement Ledger' : 'Collections Summary',
          'Date Range': datePreset !== 'custom' ? datePreset : `${startDate} to ${endDate}`,
          'Selected Customer': selectedLedgerCustomer ? selectedLedgerCustomer.Name : null
        }}
        headers={previewConfig.headers}
        rows={previewConfig.rows}
        columnConfig={previewConfig.columnConfig}
        totalsRow={previewConfig.totalsRow}
        layoutPreset={previewConfig.layoutPreset}
      />

    </div>
  );
}
