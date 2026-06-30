import React, { useState, useEffect } from 'react';
import formatCurrency from './utils/formatCurrency';
import { useAuth } from './contexts/AuthContext';
import { Search, Calendar, RefreshCw, Printer, Download, AlertTriangle, TrendingUp, ArrowLeftRight, CreditCard, ShieldAlert, Eye, FileDown, FileSpreadsheet } from 'lucide-react';
import PrintPreviewModal from './PrintPreviewModal';

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
  const [salesReportType, setSalesReportType] = useState('sales-reports');
  const [salesReportData, setSalesReportData] = useState([]);
  const [branchFilter, setBranchFilter] = useState('');

  // Metadata filter options lists
  const [productList, setProductList] = useState([]);
  const [categoryList, setCategoryList] = useState([]);
  const [brandList, setBrandList] = useState([]);
  const [customerList, setCustomerList] = useState([]);
  const [salespersonList, setSalespersonList] = useState([]);

  // Selected filter values
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');

  // Print Preview Modal Configuration
  const [previewConfig, setPreviewConfig] = useState({
    show: false,
    title: '',
    headers: [],
    rows: [],
    columnConfig: [],
    totalsRow: null,
    layoutPreset: 'portrait'
  });

  // KPI dashboard data
  const [kpiMetrics, setKpiMetrics] = useState({
    TotalSales: 0,
    DiscountAmount: 0,
    NetSales: 0,
    CostOfSales: 0,
    GrossProfit: 0,
    GrossProfitPercent: 0,
    TotalQuantitySold: 0,
    NumberOfInvoices: 0,
    AverageInvoiceValue: 0,
    AverageProfitPerInvoice: 0
  });
  const [kpiTrends, setKpiTrends] = useState([]);
  const [kpiTopCustomers, setKpiTopCustomers] = useState([]);
  const [kpiTopProducts, setKpiTopProducts] = useState([]);
  const [kpiTopCategories, setKpiTopCategories] = useState([]);
  const [kpiTopSalespersons, setKpiTopSalespersons] = useState([]);
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
  }, [
    activeTab, startDate, endDate, salesReportType, branchFilter,
    selectedProductId, selectedCategoryId, selectedBrand, selectedCustomerId, selectedUserId
  ]);

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
      else if (activeTab === 'sales-analysis') {
        let salesParams = `${queryParams}&reportType=${salesReportType}`;
        if (branchFilter) salesParams += `&branchName=${encodeURIComponent(branchFilter)}`;
        const res = await fetch(`${API_URL}/api/reports/sales-analysis${salesParams}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) setSalesReportData(await res.json());
      }
      else if (activeTab === 'profit-reports') {
        let profitParams = `${queryParams}&reportType=${salesReportType}`;
        if (selectedProductId) profitParams += `&productId=${selectedProductId}`;
        if (selectedCategoryId) profitParams += `&categoryId=${selectedCategoryId}`;
        if (selectedBrand) profitParams += `&brand=${encodeURIComponent(selectedBrand)}`;
        if (selectedCustomerId) profitParams += `&customerId=${selectedCustomerId}`;
        if (selectedUserId) profitParams += `&userId=${selectedUserId}`;
        if (branchFilter) profitParams += `&branchName=${encodeURIComponent(branchFilter)}`;

        const res = await fetch(`${API_URL}/api/reports/profit-analysis${profitParams}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) setSalesReportData(await res.json());
      }
      else if (activeTab === 'kpi-dashboard') {
        let kpiParams = queryParams;
        if (selectedProductId) kpiParams += `&productId=${selectedProductId}`;
        if (selectedCategoryId) kpiParams += `&categoryId=${selectedCategoryId}`;
        if (selectedBrand) kpiParams += `&brand=${encodeURIComponent(selectedBrand)}`;
        if (selectedCustomerId) kpiParams += `&customerId=${selectedCustomerId}`;
        if (selectedUserId) kpiParams += `&userId=${selectedUserId}`;
        if (branchFilter) kpiParams += `&branchName=${encodeURIComponent(branchFilter)}`;

        const res = await fetch(`${API_URL}/api/reports/kpi-dashboard${kpiParams}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const kpiData = await res.json();
          setKpiMetrics(kpiData.metrics);
          setKpiTrends(kpiData.trends);
          setKpiTopCustomers(kpiData.topCustomers);
          setKpiTopProducts(kpiData.topProducts);
          setKpiTopCategories(kpiData.topCategories);
          setKpiTopSalespersons(kpiData.topSalespersons);
        }
      }
    } catch (err) {
      console.error('Failed to load report data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanyInfo();
    fetchFilterMetadata();
  }, []);

  const fetchFilterMetadata = async () => {
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      const [pRes, cRes, bRes, custRes, uRes] = await Promise.all([
        fetch(`${API_URL}/api/inventory/products`, { headers }),
        fetch(`${API_URL}/api/inventory/categories`, { headers }),
        fetch(`${API_URL}/api/inventory/brands`, { headers }),
        fetch(`${API_URL}/api/customers`, { headers }),
        fetch(`${API_URL}/api/auth/users`, { headers })
      ]);
      if (pRes.ok) setProductList(await pRes.json());
      if (cRes.ok) setCategoryList(await cRes.json());
      if (bRes.ok) setBrandList(await bRes.json());
      if (custRes.ok) setCustomerList(await custRes.json());
      if (uRes.ok) setSalespersonList(await uRes.json());
    } catch (err) {
      console.error('Failed to load filter metadata:', err);
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

    if (activeTab === 'journal') {
      title = 'Sales Ledger Journal';
      headers = ['Invoice ID', 'Date / Time', 'Customer', 'Cashier', 'Subtotal', 'Discount', 'VAT', 'Total Received', 'Status'];
      colConfig = [
        { align: 'left' },
        { align: 'left' },
        { align: 'left' },
        { align: 'left' },
        { align: 'right', isCurrency: true },
        { align: 'right', isCurrency: true },
        { align: 'right', isCurrency: true },
        { align: 'right', isCurrency: true },
        { align: 'center' }
      ];
      rows = salesJournal.map(s => [
        `#SM-${s.OrderID}`,
        new Date(s.OrderDate).toLocaleString('en-LK'),
        s.CustomerName || 'Walk-in Customer',
        s.Username || s.CashierName || '--',
        Number(s.Subtotal || 0),
        Number(s.DiscountAmount || 0),
        Number(s.TaxAmount || 0),
        Number(s.TotalAmount || 0),
        s.Status || 'Paid'
      ]);
      const subtotalSum = salesJournal.reduce((acc, curr) => acc + Number(curr.Subtotal || 0), 0);
      const discountSum = salesJournal.reduce((acc, curr) => acc + Number(curr.DiscountAmount || 0), 0);
      const vatSum = salesJournal.reduce((acc, curr) => acc + Number(curr.TaxAmount || 0), 0);
      const totalSum = salesJournal.reduce((acc, curr) => acc + Number(curr.TotalAmount || 0), 0);
      totalsRow = ['TOTAL', '', '', '', subtotalSum, discountSum, vatSum, totalSum, ''];
    }
    else if (activeTab === 'products') {
      title = 'Best Sellers (Product Performance)';
      headers = ['Product Name', 'SKU', 'Category', 'Units Sold', 'Gross Revenue', 'Est. Profit', 'Stock'];
      colConfig = [
        { align: 'left' }, { align: 'left' }, { align: 'left' },
        { align: 'center' },
        { align: 'right', isCurrency: true }, { align: 'right', isCurrency: true }, { align: 'center' }
      ];
      rows = productPerformance.map(p => [
        p.ProductName,
        p.SKU,
        p.CategoryName || 'N/A',
        Number(p.UnitsSold || 0),
        Number(p.GrossRevenue || 0),
        Number(p.EstimatedProfit || 0),
        Number(p.CurrentStock || 0)
      ]);
      const qtySum = productPerformance.reduce((acc, curr) => acc + Number(curr.UnitsSold || 0), 0);
      const revSum = productPerformance.reduce((acc, curr) => acc + Number(curr.GrossRevenue || 0), 0);
      const profitSum = productPerformance.reduce((acc, curr) => acc + Number(curr.EstimatedProfit || 0), 0);
      totalsRow = ['TOTAL', '', '', qtySum, revSum, profitSum, ''];
    }
    else if (activeTab === 'customers') {
      title = 'Customer Debts & Loyalty Audits';
      headers = ['Customer Name', 'Phone', 'Loyalty Pts', 'Credit Limit', 'Owed Balance', 'Remaining Credit', 'Invoices', 'Total Spent'];
      colConfig = [
        { align: 'left' }, { align: 'left' },
        { align: 'center' },
        { align: 'right', isCurrency: true }, { align: 'right', isCurrency: true }, { align: 'right', isCurrency: true },
        { align: 'center' }, { align: 'right', isCurrency: true }
      ];
      rows = customerStatement.map(c => [
        c.CustomerName || 'Walk-in Customer',
        c.Phone || '--',
        Number(c.LoyaltyPoints || 0),
        Number(c.CreditLimit || 0),
        Number(c.CurrentBalance || 0),
        Number(c.RemainingCredit || 0),
        Number(c.TotalOrdersCount || 0),
        Number(c.TotalPurchasesValue || 0)
      ]);
      const pointsSum = customerStatement.reduce((acc, curr) => acc + Number(curr.LoyaltyPoints || 0), 0);
      const balSum = customerStatement.reduce((acc, curr) => acc + Number(curr.CurrentBalance || 0), 0);
      const countSum = customerStatement.reduce((acc, curr) => acc + Number(curr.TotalOrdersCount || 0), 0);
      const spentSum = customerStatement.reduce((acc, curr) => acc + Number(curr.TotalPurchasesValue || 0), 0);
      totalsRow = ['TOTAL', '', pointsSum, '', balSum, '', countSum, spentSum];
    }
    else if (activeTab === 'dayend') {
      title = 'Day-End Closing History';
      headers = ['Session ID', 'Date / Time', 'Expected Drawer Cash', 'Physical Drawer Cash', 'Difference', 'Cashier', 'Status'];
      colConfig = [
        { align: 'left' },
        { align: 'left' },
        { align: 'right', isCurrency: true },
        { align: 'right', isCurrency: true },
        { align: 'right', isCurrency: true },
        { align: 'left' },
        { align: 'center' }
      ];
      rows = drawerHistory.map(d => [
        `#SESS-${d.SessionID}`,
        new Date(d.ClosingTime || d.OpeningTime).toLocaleString('en-LK'),
        Number(d.ExpectedCash || 0),
        Number(d.ActualCash || 0),
        Number(d.DifferenceAmount || 0),
        d.CashierName,
        d.Status || 'Closed'
      ]);
      const expSum = drawerHistory.reduce((acc, curr) => acc + Number(curr.ExpectedCash || 0), 0);
      const actSum = drawerHistory.reduce((acc, curr) => acc + Number(curr.ActualCash || 0), 0);
      const diffSum = drawerHistory.reduce((acc, curr) => acc + Number(curr.DifferenceAmount || 0), 0);
      totalsRow = ['TOTAL', '', expSum, actSum, diffSum, '', ''];
    }
    else if (activeTab === 'sales-analysis') {
      const typeTitles = {
        'sales-reports': 'Sales Invoices Log',
        'daily-sales-summary': 'Daily Sales Summary',
        'monthly-sales-summary': 'Monthly Sales Summary',
        'sales-by-item': 'Sales by Item Report',
        'sales-by-category': 'Sales by Category Report',
        'sales-by-brand': 'Sales by Brand Report',
        'sales-by-customer': 'Sales by Customer Contribution',
        'sales-by-salesperson': 'Sales by Salesperson Performance',
        'sales-by-payment-method': 'Sales by Payment Mode Summary',
        'sales-by-branch-warehouse': 'Sales by Branch/Warehouse Summary',
        'sales-by-hour': 'Hourly Sales Distribution',
        'top-selling': 'Top Selling Products list',
        'slow-moving': 'Slow Moving Products list',
        'sales-return': 'Sales Return Audit Log',
        'discount-report': 'Manual Discounts Awarded Log',
        'tax-vat-report': 'VAT/Tax Collections Log',
        'credit-sales-report': 'Outstanding Credit Sales Ledger'
      };
      title = typeTitles[salesReportType] || 'Sales Analysis Report';

      if (salesReportType === 'sales-reports') {
        headers = ['Invoice ID', 'Date / Time', 'Customer', 'Cashier', 'Subtotal', 'Discount', 'VAT', 'Total Received', 'Status'];
        colConfig = [
          { align: 'left' }, { align: 'left' }, { align: 'left' }, { align: 'left' },
          { align: 'right', isCurrency: true }, { align: 'right', isCurrency: true },
          { align: 'right', isCurrency: true }, { align: 'right', isCurrency: true }, { align: 'center' }
        ];
        rows = salesReportData.map(s => [
          `#SM-${s.OrderID}`, new Date(s.OrderDate).toLocaleString('en-LK'),
          s.CustomerName || 'Walk-in Customer', s.CashierName,
          Number(s.Subtotal || 0), Number(s.DiscountAmount || 0), Number(s.TaxAmount || 0), Number(s.TotalAmount || 0), s.Status || 'Paid'
        ]);
        totalsRow = [
          'TOTAL', '', '', '',
          salesReportData.reduce((acc, c) => acc + Number(c.Subtotal || 0), 0),
          salesReportData.reduce((acc, c) => acc + Number(c.DiscountAmount || 0), 0),
          salesReportData.reduce((acc, c) => acc + Number(c.TaxAmount || 0), 0),
          salesReportData.reduce((acc, c) => acc + Number(c.TotalAmount || 0), 0),
          ''
        ];
      }
      else if (salesReportType === 'daily-sales-summary' || salesReportType === 'monthly-sales-summary') {
        headers = [salesReportType === 'daily-sales-summary' ? 'Date' : 'Month', 'Invoices', 'Subtotal', 'Discount', 'VAT', 'Total Revenue'];
        colConfig = [
          { align: 'left' }, { align: 'center' },
          { align: 'right', isCurrency: true }, { align: 'right', isCurrency: true },
          { align: 'right', isCurrency: true }, { align: 'right', isCurrency: true }
        ];
        rows = salesReportData.map(s => [
          s.DateStr || s.MonthStr, Number(s.InvoiceCount || 0),
          Number(s.Subtotal || 0), Number(s.DiscountAmount || 0), Number(s.TaxAmount || 0), Number(s.TotalAmount || 0)
        ]);
        totalsRow = [
          'TOTAL',
          salesReportData.reduce((acc, c) => acc + Number(c.InvoiceCount || 0), 0),
          salesReportData.reduce((acc, c) => acc + Number(c.Subtotal || 0), 0),
          salesReportData.reduce((acc, c) => acc + Number(c.DiscountAmount || 0), 0),
          salesReportData.reduce((acc, c) => acc + Number(c.TaxAmount || 0), 0),
          salesReportData.reduce((acc, c) => acc + Number(c.TotalAmount || 0), 0)
        ];
      }
      else if (salesReportType === 'sales-by-item' || salesReportType === 'top-selling' || salesReportType === 'slow-moving') {
        headers = ['Product Name', 'SKU', 'Units Sold', 'Total Sales'];
        colConfig = [
          { align: 'left' }, { align: 'left' },
          { align: 'center' }, { align: 'right', isCurrency: true }
        ];
        rows = salesReportData.map(s => [
          s.ProductName, s.SKU,
          Number(s.QuantitySold || 0), Number(s.TotalAmount || 0)
        ]);
        totalsRow = [
          'TOTAL', '',
          salesReportData.reduce((acc, c) => acc + Number(c.QuantitySold || 0), 0),
          salesReportData.reduce((acc, c) => acc + Number(c.TotalAmount || 0), 0)
        ];
      }
      else if (salesReportType === 'sales-by-category' || salesReportType === 'sales-by-brand') {
        headers = [salesReportType === 'sales-by-category' ? 'Category Name' : 'Brand Name', 'Units Sold', 'Total Sales'];
        colConfig = [
          { align: 'left' }, { align: 'center' }, { align: 'right', isCurrency: true }
        ];
        rows = salesReportData.map(s => [
          s.CategoryName || s.Brand || 'No Brand', Number(s.QuantitySold || 0), Number(s.TotalRevenue || 0)
        ]);
        totalsRow = [
          'TOTAL',
          salesReportData.reduce((acc, c) => acc + Number(c.QuantitySold || 0), 0),
          salesReportData.reduce((acc, c) => acc + Number(c.TotalRevenue || 0), 0)
        ];
      }
      else if (salesReportType === 'sales-by-customer') {
        headers = ['Customer Name', 'Phone', 'Invoice Count', 'Subtotal', 'Discount', 'VAT', 'Total Contribution'];
        colConfig = [
          { align: 'left' }, { align: 'left' }, { align: 'center' },
          { align: 'right', isCurrency: true }, { align: 'right', isCurrency: true },
          { align: 'right', isCurrency: true }, { align: 'right', isCurrency: true }
        ];
        rows = salesReportData.map(s => [
          s.CustomerName || 'Walk-in Customer', s.Phone || '--', Number(s.InvoiceCount || 0),
          Number(s.Subtotal || 0), Number(s.DiscountAmount || 0), Number(s.TaxVAT || 0), Number(s.TotalAmount || 0)
        ]);
        totalsRow = [
          'TOTAL', '',
          salesReportData.reduce((acc, c) => acc + Number(c.InvoiceCount || 0), 0),
          salesReportData.reduce((acc, c) => acc + Number(c.Subtotal || 0), 0),
          salesReportData.reduce((acc, c) => acc + Number(c.DiscountAmount || 0), 0),
          salesReportData.reduce((acc, c) => acc + Number(c.TaxVAT || 0), 0),
          salesReportData.reduce((acc, c) => acc + Number(c.TotalAmount || 0), 0)
        ];
      }
      else if (salesReportType === 'sales-by-salesperson') {
        headers = ['Salesperson Name', 'Invoice Count', 'Subtotal', 'Discount', 'VAT', 'Total Handled'];
        colConfig = [
          { align: 'left' }, { align: 'center' },
          { align: 'right', isCurrency: true }, { align: 'right', isCurrency: true },
          { align: 'right', isCurrency: true }, { align: 'right', isCurrency: true }
        ];
        rows = salesReportData.map(s => [
          s.SalespersonName, Number(s.InvoiceCount || 0),
          Number(s.Subtotal || 0), Number(s.DiscountAmount || 0), Number(s.TaxVAT || 0), Number(s.TotalAmount || 0)
        ]);
        totalsRow = [
          'TOTAL',
          salesReportData.reduce((acc, c) => acc + Number(c.InvoiceCount || 0), 0),
          salesReportData.reduce((acc, c) => acc + Number(c.Subtotal || 0), 0),
          salesReportData.reduce((acc, c) => acc + Number(c.DiscountAmount || 0), 0),
          salesReportData.reduce((acc, c) => acc + Number(c.TaxVAT || 0), 0),
          salesReportData.reduce((acc, c) => acc + Number(c.TotalAmount || 0), 0)
        ];
      }
      else if (salesReportType === 'sales-by-payment-method') {
        headers = ['Payment Mode', 'Invoices Settled', 'Collected Amount'];
        colConfig = [
          { align: 'left' }, { align: 'center' }, { align: 'right', isCurrency: true }
        ];
        rows = salesReportData.map(s => [
          s.PaymentMethod || 'Cash', Number(s.InvoiceCount || 0), Number(s.TotalAmount || 0)
        ]);
        totalsRow = [
          'TOTAL',
          salesReportData.reduce((acc, c) => acc + Number(c.InvoiceCount || 0), 0),
          salesReportData.reduce((acc, c) => acc + Number(c.TotalAmount || 0), 0)
        ];
      }
      else if (salesReportType === 'sales-by-branch-warehouse') {
        headers = ['Branch / Warehouse Location', 'Qty Dispatched', 'Dispatched Value'];
        colConfig = [
          { align: 'left' }, { align: 'center' }, { align: 'right', isCurrency: true }
        ];
        rows = salesReportData.map(s => [
          s.BranchName || 'Main Store', Number(s.QuantitySold || 0), Number(s.TotalRevenue || 0)
        ]);
        totalsRow = [
          'TOTAL',
          salesReportData.reduce((acc, c) => acc + Number(c.QuantitySold || 0), 0),
          salesReportData.reduce((acc, c) => acc + Number(c.TotalRevenue || 0), 0)
        ];
      }
      else if (salesReportType === 'sales-by-hour') {
        headers = ['Hour of Day (24h)', 'Transaction Volume', 'Hourly Revenue'];
        colConfig = [
          { align: 'center' }, { align: 'center' }, { align: 'right', isCurrency: true }
        ];
        rows = salesReportData.map(s => [
          `${String(s.Hour || 0).padStart(2,'0')}:00`, Number(s.InvoiceCount || 0), Number(s.TotalAmount || 0)
        ]);
        totalsRow = [
          'TOTAL',
          salesReportData.reduce((acc, c) => acc + Number(c.InvoiceCount || 0), 0),
          salesReportData.reduce((acc, c) => acc + Number(c.TotalAmount || 0), 0)
        ];
      }
      else if (salesReportType === 'sales-return') {
        headers = ['Return Order ID', 'Date / Time', 'Original Invoice ID', 'Customer', 'Cashier', 'Subtotal', 'Discount', 'VAT', 'Total Returned', 'Return Type'];
        colConfig = [
          { align: 'left' }, { align: 'left' }, { align: 'left' }, { align: 'left' }, { align: 'left' },
          { align: 'right', isCurrency: true }, { align: 'right', isCurrency: true }, { align: 'right', isCurrency: true }, { align: 'right', isCurrency: true }, { align: 'center' }
        ];
        rows = salesReportData.map(s => [
          `#RET-${s.ReturnOrderID}`, new Date(s.ReturnDate).toLocaleString('en-LK'), `#SM-${s.OriginalOrderID || '--'}`,
          s.CustomerName || 'Walk-in Customer', s.CashierName || '--',
          Number(s.Subtotal || 0), Number(s.DiscountAmount || 0), Number(s.TaxAmount || 0), Number(s.TotalAmount || 0), s.ReturnType || '--'
        ]);
        totalsRow = [
          'TOTAL', '', '', '', '',
          salesReportData.reduce((acc, c) => acc + Number(c.Subtotal || 0), 0),
          salesReportData.reduce((acc, c) => acc + Number(c.DiscountAmount || 0), 0),
          salesReportData.reduce((acc, c) => acc + Number(c.TaxAmount || 0), 0),
          salesReportData.reduce((acc, c) => acc + Number(c.TotalAmount || 0), 0),
          ''
        ];
      }
      else if (salesReportType === 'discount-report') {
        headers = ['Invoice ID', 'Date / Time', 'Customer', 'Gross Subtotal', 'Discount Given', 'Net Total', 'Discount %'];
        colConfig = [
          { align: 'left' }, { align: 'left' }, { align: 'left' },
          { align: 'right', isCurrency: true }, { align: 'right', isCurrency: true }, { align: 'right', isCurrency: true }, { align: 'center' }
        ];
        rows = salesReportData.map(s => [
          `#SM-${s.OrderID}`, new Date(s.OrderDate).toLocaleString('en-LK'), s.CustomerName || 'Walk-in Customer',
          Number(s.OriginalSubtotal || 0), Number(s.DiscountGiven || 0), Number(s.NetTotal || 0),
          `${Number(s.DiscountPercentage || 0).toFixed(1)}%`
        ]);
        totalsRow = [
          'TOTAL', '', '',
          salesReportData.reduce((acc, c) => acc + Number(c.OriginalSubtotal || 0), 0),
          salesReportData.reduce((acc, c) => acc + Number(c.DiscountGiven || 0), 0),
          salesReportData.reduce((acc, c) => acc + Number(c.NetTotal || 0), 0),
          ''
        ];
      }
      else if (salesReportType === 'tax-vat-report') {
        headers = ['Invoice ID', 'Date / Time', 'Net Sales', 'VAT Collected', 'Gross Sales'];
        colConfig = [
          { align: 'left' }, { align: 'left' },
          { align: 'right', isCurrency: true }, { align: 'right', isCurrency: true }, { align: 'right', isCurrency: true }
        ];
        rows = salesReportData.map(s => [
          `#SM-${s.OrderID}`, new Date(s.OrderDate).toLocaleString('en-LK'),
          Number(s.NetSales || 0), Number(s.TaxVAT || 0), Number(s.GrossSales || 0)
        ]);
        totalsRow = [
          'TOTAL', '',
          salesReportData.reduce((acc, c) => acc + Number(c.NetSales || 0), 0),
          salesReportData.reduce((acc, c) => acc + Number(c.TaxVAT || 0), 0),
          salesReportData.reduce((acc, c) => acc + Number(c.GrossSales || 0), 0)
        ];
      }
      else if (salesReportType === 'credit-sales-report') {
        headers = ['Invoice ID', 'Date / Time', 'Customer Name', 'Phone', 'Credit Approved', 'Paid', 'Outstanding Balance'];
        colConfig = [
          { align: 'left' }, { align: 'left' }, { align: 'left' }, { align: 'left' },
          { align: 'right', isCurrency: true }, { align: 'right', isCurrency: true }, { align: 'right', isCurrency: true }
        ];
        rows = salesReportData.map(s => [
          `#SM-${s.OrderID}`, new Date(s.OrderDate).toLocaleString('en-LK'), s.CustomerName || 'Walk-in Customer', s.Phone || '--',
          Number(s.OriginalCreditAmount || 0), Number(s.PaidAmount || 0), Number(s.BalanceAmount || 0)
        ]);
        totalsRow = [
          'TOTAL', '', '', '',
          salesReportData.reduce((acc, c) => acc + Number(c.OriginalCreditAmount || 0), 0),
          salesReportData.reduce((acc, c) => acc + Number(c.PaidAmount || 0), 0),
          salesReportData.reduce((acc, c) => acc + Number(c.BalanceAmount || 0), 0)
        ];
      }
    }
    else if (activeTab === 'profit-reports') {
      const typeTitles = {
        'gross-profit-summary': 'Gross Profit Summary',
        'profit-by-item': 'Gross Profit by Item',
        'profit-by-category': 'Gross Profit by Category',
        'profit-by-brand': 'Gross Profit by Brand',
        'profit-by-customer': 'Gross Profit by Customer',
        'profit-by-salesperson': 'Gross Profit by Salesperson',
        'profit-by-invoice': 'Gross Profit by Invoice Ledger',
        'top-profitable-items': 'Top 20 Most Profitable Items',
        'lowest-profitable-items': 'Lowest Profit Items Log',
        'negative-profit-report': 'Negative Profit (Loss-Making Sales) Audit'
      };
      title = typeTitles[salesReportType] || 'Profit Analysis Report';

      if (salesReportType === 'gross-profit-summary') {
        headers = ['Period / Date', 'Total Sales', 'Discount Given', 'Net Sales', 'Cost of Sales', 'Gross Profit', 'GP %'];
        colConfig = [
          { align: 'left' }, { align: 'right', isCurrency: true }, { align: 'right', isCurrency: true },
          { align: 'right', isCurrency: true }, { align: 'right', isCurrency: true }, { align: 'right', isCurrency: true }, { align: 'center' }
        ];
        rows = salesReportData.map(s => [
          s.DateStr, Number(s.TotalSales || 0), Number(s.DiscountAmount || 0),
          Number(s.NetSales || 0), Number(s.CostOfSales || 0), Number(s.GrossProfit || 0),
          `${Number(s.GrossProfitPercent || 0).toFixed(2)}%`
        ]);
        const nSales = salesReportData.reduce((acc, c) => acc + Number(c.NetSales || 0), 0);
        const gProfit = salesReportData.reduce((acc, c) => acc + Number(c.GrossProfit || 0), 0);
        totalsRow = [
          'TOTAL',
          salesReportData.reduce((acc, c) => acc + Number(c.TotalSales || 0), 0),
          salesReportData.reduce((acc, c) => acc + Number(c.DiscountAmount || 0), 0),
          nSales,
          salesReportData.reduce((acc, c) => acc + Number(c.CostOfSales || 0), 0),
          gProfit,
          `${(nSales > 0 ? (gProfit / nSales) * 100 : 0).toFixed(2)}%`
        ];
      }
      else if (salesReportType === 'profit-by-item' || salesReportType === 'top-profitable-items' || salesReportType === 'lowest-profitable-items') {
        headers = ['Product Name', 'SKU', 'Category', 'Brand', 'Units Sold', 'Total Revenue', 'Cost of Sales', 'Gross Profit', 'GP %'];
        colConfig = [
          { align: 'left' }, { align: 'left' }, { align: 'left' }, { align: 'left' }, { align: 'center' },
          { align: 'right', isCurrency: true }, { align: 'right', isCurrency: true }, { align: 'right', isCurrency: true }, { align: 'center' }
        ];
        rows = salesReportData.map(s => [
          s.ProductName, s.SKU, s.CategoryName || 'N/A', s.Brand || 'No Brand', Number(s.QuantitySold || 0),
          Number(s.TotalRevenue || 0), Number(s.CostOfSales || 0), Number(s.GrossProfit || 0),
          `${Number(s.GrossProfitPercent || 0).toFixed(2)}%`
        ]);
        const totalRev = salesReportData.reduce((acc, c) => acc + Number(c.TotalRevenue || 0), 0);
        const totalProfit = salesReportData.reduce((acc, c) => acc + Number(c.GrossProfit || 0), 0);
        totalsRow = [
          'TOTAL', '', '', '',
          salesReportData.reduce((acc, c) => acc + Number(c.QuantitySold || 0), 0),
          totalRev,
          salesReportData.reduce((acc, c) => acc + Number(c.CostOfSales || 0), 0),
          totalProfit,
          `${(totalRev > 0 ? (totalProfit / totalRev) * 100 : 0).toFixed(2)}%`
        ];
      }
      else if (salesReportType === 'profit-by-category' || salesReportType === 'profit-by-brand') {
        headers = [salesReportType === 'profit-by-category' ? 'Category Name' : 'Brand Name', 'Units Sold', 'Total Revenue', 'Cost of Sales', 'Gross Profit', 'GP %'];
        colConfig = [
          { align: 'left' }, { align: 'center' },
          { align: 'right', isCurrency: true }, { align: 'right', isCurrency: true }, { align: 'right', isCurrency: true }, { align: 'center' }
        ];
        rows = salesReportData.map(s => [
          s.CategoryName || s.Brand || 'No Brand', Number(s.QuantitySold || 0),
          Number(s.TotalRevenue || 0), Number(s.CostOfSales || 0), Number(s.GrossProfit || 0),
          `${Number(s.GrossProfitPercent || 0).toFixed(2)}%`
        ]);
        const totalRev = salesReportData.reduce((acc, c) => acc + Number(c.TotalRevenue || 0), 0);
        const totalProfit = salesReportData.reduce((acc, c) => acc + Number(c.GrossProfit || 0), 0);
        totalsRow = [
          'TOTAL',
          salesReportData.reduce((acc, c) => acc + Number(c.QuantitySold || 0), 0),
          totalRev,
          salesReportData.reduce((acc, c) => acc + Number(c.CostOfSales || 0), 0),
          totalProfit,
          `${(totalRev > 0 ? (totalProfit / totalRev) * 100 : 0).toFixed(2)}%`
        ];
      }
      else if (salesReportType === 'profit-by-customer') {
        headers = ['Customer Name', 'Phone', 'Invoice Count', 'Net Sales', 'Cost of Sales', 'Gross Profit', 'GP %'];
        colConfig = [
          { align: 'left' }, { align: 'left' }, { align: 'center' },
          { align: 'right', isCurrency: true }, { align: 'right', isCurrency: true }, { align: 'right', isCurrency: true }, { align: 'center' }
        ];
        rows = salesReportData.map(s => [
          s.CustomerName || 'Walk-in Customer', s.Phone || '--', Number(s.InvoiceCount || 0),
          Number(s.NetSales || 0), Number(s.CostOfSales || 0), Number(s.GrossProfit || 0),
          `${Number(s.GrossProfitPercent || 0).toFixed(2)}%`
        ]);
        const totalSales = salesReportData.reduce((acc, c) => acc + Number(c.NetSales || 0), 0);
        const totalProfit = salesReportData.reduce((acc, c) => acc + Number(c.GrossProfit || 0), 0);
        totalsRow = [
          'TOTAL', '',
          salesReportData.reduce((acc, c) => acc + Number(c.InvoiceCount || 0), 0),
          totalSales,
          salesReportData.reduce((acc, c) => acc + Number(c.CostOfSales || 0), 0),
          totalProfit,
          `${(totalSales > 0 ? (totalProfit / totalSales) * 100 : 0).toFixed(2)}%`
        ];
      }
      else if (salesReportType === 'profit-by-salesperson') {
        headers = ['Salesperson Name', 'Invoice Count', 'Net Sales', 'Cost of Sales', 'Gross Profit', 'GP %'];
        colConfig = [
          { align: 'left' }, { align: 'center' },
          { align: 'right', isCurrency: true }, { align: 'right', isCurrency: true }, { align: 'right', isCurrency: true }, { align: 'center' }
        ];
        rows = salesReportData.map(s => [
          s.SalespersonName, Number(s.InvoiceCount || 0),
          Number(s.NetSales || 0), Number(s.CostOfSales || 0), Number(s.GrossProfit || 0),
          `${Number(s.GrossProfitPercent || 0).toFixed(2)}%`
        ]);
        const totalSales = salesReportData.reduce((acc, c) => acc + Number(c.NetSales || 0), 0);
        const totalProfit = salesReportData.reduce((acc, c) => acc + Number(c.GrossProfit || 0), 0);
        totalsRow = [
          'TOTAL',
          salesReportData.reduce((acc, c) => acc + Number(c.InvoiceCount || 0), 0),
          totalSales,
          salesReportData.reduce((acc, c) => acc + Number(c.CostOfSales || 0), 0),
          totalProfit,
          `${(totalSales > 0 ? (totalProfit / totalSales) * 100 : 0).toFixed(2)}%`
        ];
      }
      else if (salesReportType === 'profit-by-invoice') {
        headers = ['Invoice ID', 'Date / Time', 'Customer Name', 'Total Sales', 'Discount', 'Net Sales', 'Cost of Sales', 'Gross Profit', 'GP %'];
        colConfig = [
          { align: 'left' }, { align: 'left' }, { align: 'left' },
          { align: 'right', isCurrency: true }, { align: 'right', isCurrency: true }, { align: 'right', isCurrency: true },
          { align: 'right', isCurrency: true }, { align: 'right', isCurrency: true }, { align: 'center' }
        ];
        rows = salesReportData.map(s => [
          `#SM-${s.OrderID}`, new Date(s.OrderDate).toLocaleString('en-LK'), s.CustomerName || 'Walk-in Customer',
          Number(s.TotalSales || 0), Number(s.DiscountAmount || 0), Number(s.NetSales || 0),
          Number(s.CostOfSales || 0), Number(s.GrossProfit || 0), `${Number(s.GrossProfitPercent || 0).toFixed(2)}%`
        ]);
        const totalSales = salesReportData.reduce((acc, c) => acc + Number(c.NetSales || 0), 0);
        const totalProfit = salesReportData.reduce((acc, c) => acc + Number(c.GrossProfit || 0), 0);
        totalsRow = [
          'TOTAL', '', '',
          salesReportData.reduce((acc, c) => acc + Number(c.TotalSales || 0), 0),
          salesReportData.reduce((acc, c) => acc + Number(c.DiscountAmount || 0), 0),
          totalSales,
          salesReportData.reduce((acc, c) => acc + Number(c.CostOfSales || 0), 0),
          totalProfit,
          `${(totalSales > 0 ? (totalProfit / totalSales) * 100 : 0).toFixed(2)}%`
        ];
      }
      else if (salesReportType === 'negative-profit-report') {
        headers = ['Invoice ID', 'Date / Time', 'Product Name', 'Quantity', 'Price', 'Cost', 'Net Revenue', 'Total Cost', 'Loss Amount', 'Cashier'];
        colConfig = [
          { align: 'left' }, { align: 'left' }, { align: 'left' }, { align: 'center' },
          { align: 'right', isCurrency: true }, { align: 'right', isCurrency: true },
          { align: 'right', isCurrency: true }, { align: 'right', isCurrency: true }, { align: 'right', isCurrency: true }, { align: 'left' }
        ];
        rows = salesReportData.map(s => [
          `#SM-${s.OrderID}`, new Date(s.OrderDate).toLocaleString('en-LK'), s.ProductName, Number(s.Quantity || 0),
          Number(s.Price || 0), Number(s.Cost || 0), Number(s.NetRevenue || 0), Number(s.TotalCost || 0), Number(s.GrossProfit || 0), s.CashierName
        ]);
        totalsRow = [
          'TOTAL', '', '',
          salesReportData.reduce((acc, c) => acc + Number(c.Quantity || 0), 0),
          '', '',
          salesReportData.reduce((acc, c) => acc + Number(c.NetRevenue || 0), 0),
          salesReportData.reduce((acc, c) => acc + Number(c.TotalCost || 0), 0),
          salesReportData.reduce((acc, c) => acc + Number(c.GrossProfit || 0), 0),
          ''
        ];
      }
    }

    if (actionType === 'excel') {
      const csvRows = [];
      csvRows.push(`"${title.replace(/"/g, '""')}"`);
      csvRows.push(`"Print Date: ${new Date().toLocaleString()}"`);
      csvRows.push('');
      csvRows.push(headers.map(h => `"${h.replace(/"/g, '""')}"`).join(','));
      rows.forEach(r => csvRows.push(r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')));
      if (totalsRow && totalsRow.length > 0) {
        csvRows.push(totalsRow.map(t => `"${String(t ?? '').replace(/"/g, '""')}"`).join(','));
      }
      
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

    const showHeader = companyInfo?.PrintHeader !== undefined ? !!companyInfo.PrintHeader : true;
    const showLogo = companyInfo?.PrintLogo !== undefined ? !!companyInfo.PrintLogo : true;
    const customHeaderMsg = companyInfo?.HeaderMessage || '';
    const showDateTime = companyInfo?.PrintDateTime !== undefined ? !!companyInfo.PrintDateTime : true;
    const showCashier = companyInfo?.PrintCashier !== undefined ? !!companyInfo.PrintCashier : true;
    const showBranch = companyInfo?.PrintBranch !== undefined ? !!companyInfo.PrintBranch : true;
    const showFooter = companyInfo?.PrintFooter !== undefined ? !!companyInfo.PrintFooter : true;
    const customFooterMsg = companyInfo?.FooterMessage || '';
    const paperWidth = companyInfo?.PaperSize === '58mm' ? '58mm' : '80mm';
    const bodyFontSize = companyInfo?.PaperSize === '58mm' ? '10.5px' : '12px';
    const copiesCount = companyInfo?.ReceiptCopies !== undefined ? parseInt(companyInfo.ReceiptCopies, 10) : 1;

    let headerHtml = '';
    if (showHeader) {
      const logoTag = (showLogo && logoUrl) ? `<div><img class="logo" src="${logoUrl}" alt="Logo"></div>` : '';
      const nameTag = `<div class="company-name">${companyInfo?.Name || 'SELLMAX PRO'}</div>`;
      const addrContactTag = addressParts || contactParts ? `<div class="company-sub">${[addressParts, contactParts].filter(Boolean).join('<br>')}</div>` : '';
      const headerMsgTag = customHeaderMsg ? `<div style="font-size: 11px; margin-top: 8px; border-top: 1px dotted #ccc; padding-top: 4px; font-style: italic; white-space: pre-line;">${customHeaderMsg}</div>` : '';
      
      headerHtml = `
        <div class="header">
          ${logoTag}
          ${nameTag}
          ${addrContactTag}
          ${headerMsgTag}
        </div>
      `;
    }

    let metaHtml = `<div>INVOICE: #SM-${order.OrderID}</div>`;
    if (showDateTime) {
      metaHtml += `<div>DATE: ${new Date(order.OrderDate).toLocaleString()}</div>`;
    }
    if (showCashier) {
      metaHtml += `<div>CASHIER: ${order.Username}</div>`;
    }
    if (showBranch) {
      metaHtml += `<div>BRANCH: ${order.BranchName || companyInfo?.City || 'Main Branch'}</div>`;
    }
    metaHtml += `<div>CUSTOMER: ${order.CustomerName || 'Walk-in Customer'}</div>`;

    let footerHtml = '';
    if (showFooter) {
      const customFooterMsgTag = customFooterMsg 
        ? `<div style="margin-bottom: 8px; font-weight: bold; white-space: pre-line;">${customFooterMsg}</div>` 
        : '<p>Thank you for shopping with us!</p>';
        
      footerHtml = `
        <div class="footer">
          ${customFooterMsgTag}
          <p style="margin-top: 8px; font-size: 8px; opacity: 0.8;">Powered by SellMax Pro POS</p>
        </div>
      `;
    }

    const singleReceipt = `
      <div class="receipt-container">
        ${headerHtml}
        
        <div class="meta">
          ${metaHtml}
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

        ${footerHtml}
      </div>
    `;

    let printBodyContent = '';
    for (let i = 0; i < copiesCount; i++) {
      const isLast = (i === copiesCount - 1);
      printBodyContent += `
        ${singleReceipt}
        ${!isLast ? '<div class="page-break"></div>' : ''}
      `;
    }

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Receipt #SM-${order.OrderID}</title>
<style>
  @page {
    size: ${paperWidth} auto;
    margin: 4mm 4mm;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: ${bodyFontSize};
    color: #000;
    width: 100%;
    background: white;
  }
  .receipt-container {
    width: 100%;
    margin-bottom: 20px;
  }
  .page-break {
    page-break-after: always;
    border-bottom: 2px dashed #000;
    margin: 15px 0;
    padding-bottom: 15px;
  }
  .header { text-align: center; border-bottom: 1px dashed #000; padding-bottom: 6px; margin-bottom: 6px; }
  .logo { max-height: 50px; max-width: 90%; object-fit: contain; margin-bottom: 4px; }
  .company-name { font-size: 14px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; }
  .company-sub { font-size: 10px; color: #111; line-height: 1.5; margin-top: 3px; }
  .meta { font-size: 11px; line-height: 1.7; border-bottom: 1px dashed #000; padding-bottom: 5px; margin-bottom: 5px; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  thead th { font-size: 10px; font-weight: bold; border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 4px 2px; overflow: hidden; }
  tbody td { font-size: 10px; padding: 3px 2px; vertical-align: top; word-break: break-word; overflow: hidden; }
  .col-item { width: 52%; }
  .col-qty  { width: 18%; text-align: center; }
  .col-price{ width: 30%; text-align: right; }
  .summary { border-top: 1px dashed #000; padding-top: 5px; margin-top: 5px; }
  .sum-row { display: flex; justify-content: space-between; font-size: 11px; padding: 2px 0; }
  .sum-total { display: flex; justify-content: space-between; font-size: 13px; font-weight: bold; border-top: 1px solid #000; border-bottom: 1px solid #000; margin-top: 4px; padding: 4px 0; }
  .payments { border-top: 1px dashed #000; margin-top: 5px; padding-top: 5px; font-size: 11px; }
  .pay-label { font-weight: bold; margin-bottom: 3px; font-size: 11px; }
  .pay-row { display: flex; justify-content: space-between; font-size: 11px; padding: 2px 0; }
  .pay-sub { display: flex; justify-content: space-between; font-size: 10px; padding-left: 10px; color: #333; }
  .status-row { font-size: 10px; text-align: center; margin-top: 4px; color: #333; }
  .footer { text-align: center; border-top: 1px dashed #000; margin-top: 8px; padding-top: 6px; font-size: 10px; line-height: 1.6; color: #333; }
</style>
</head>
<body>
  ${printBodyContent}
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
    setTimeout(() => {
      popup.print();
      popup.onafterprint = () => {
        popup.close();
        setTimeout(() => setShowInvoiceModal(false), 500);
      };
      setTimeout(() => {
        if (!popup.closed) popup.close();
        setTimeout(() => setShowInvoiceModal(false), 500);
      }, 30000);
    }, 250);
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
    else if (activeTab === 'sales-analysis') {
      let headers = [];
      let rows = [];
      const filenameStr = `${salesReportType.replace(/-/g, '_')}_${dateStr}`;

      if (salesReportType === 'sales-reports') {
        headers = ['Invoice ID', 'Date / Time', 'Customer Name', 'Cashier', 'Subtotal', 'Discount', 'VAT', 'Total Received', 'Status'];
        rows = salesReportData.map(s => [
          `#SM-${s.OrderID}`,
          new Date(s.OrderDate).toLocaleString(),
          s.CustomerName || 'Walk-in Customer',
          s.CashierName || 'Cashier',
          s.Subtotal,
          s.DiscountAmount,
          s.TaxAmount,
          s.TotalAmount,
          s.Status
        ]);
      }
      else if (salesReportType === 'daily-sales-summary' || salesReportType === 'monthly-sales-summary') {
        headers = [salesReportType === 'daily-sales-summary' ? 'Date' : 'Month', 'Invoices Count', 'Subtotal', 'Discounts', 'Tax/VAT', 'Total Amount'];
        rows = salesReportData.map(s => [
          s.DateStr || s.MonthStr,
          s.InvoiceCount,
          s.Subtotal,
          s.DiscountAmount,
          s.TaxAmount,
          s.TotalAmount
        ]);
      }
      else if (salesReportType === 'sales-by-item' || salesReportType === 'top-selling' || salesReportType === 'slow-moving') {
        headers = ['Product Name', 'SKU', 'Units Sold', 'Total Sales'];
        rows = salesReportData.map(s => [
          s.ProductName,
          s.SKU,
          s.QuantitySold,
          s.TotalAmount
        ]);
      }
      else if (salesReportType === 'sales-by-category') {
        headers = ['Category Name', 'Units Sold', 'Total Sales'];
        rows = salesReportData.map(s => [
          s.CategoryName,
          s.QuantitySold,
          s.TotalAmount
        ]);
      }
      else if (salesReportType === 'sales-by-brand') {
        headers = ['Brand Name', 'Units Sold', 'Total Sales'];
        rows = salesReportData.map(s => [
          s.Brand,
          s.QuantitySold,
          s.TotalAmount
        ]);
      }
      else if (salesReportType === 'sales-by-customer') {
        headers = ['Customer Name', 'Phone', 'Invoice Count', 'Subtotal', 'Discount', 'VAT', 'Total Contributed'];
        rows = salesReportData.map(s => [
          s.CustomerName,
          s.Phone || '--',
          s.InvoiceCount,
          s.Subtotal,
          s.DiscountAmount,
          s.TaxAmount,
          s.TotalAmount
        ]);
      }
      else if (salesReportType === 'sales-by-salesperson') {
        headers = ['Salesperson Name', 'Invoice Count', 'Subtotal', 'Discount', 'VAT', 'Total Handled'];
        rows = salesReportData.map(s => [
          s.SalespersonName,
          s.InvoiceCount,
          s.Subtotal,
          s.DiscountAmount,
          s.TaxAmount,
          s.TotalAmount
        ]);
      }
      else if (salesReportType === 'sales-by-payment-method') {
        headers = ['Payment Mode', 'Invoices Settled', 'Collected Amount'];
        rows = salesReportData.map(s => [
          s.PaymentMethod,
          s.InvoiceCount,
          s.TotalAmount
        ]);
      }
      else if (salesReportType === 'sales-by-branch-warehouse') {
        headers = ['Branch / Warehouse Location', 'Qty Dispatched', 'Dispatched Value'];
        rows = salesReportData.map(s => [
          s.BranchWarehouse,
          s.QuantitySold,
          s.TotalAmount
        ]);
      }
      else if (salesReportType === 'sales-by-hour') {
        headers = ['Hour of Day (24h)', 'Transaction Volume', 'Hourly Revenue'];
        rows = salesReportData.map(s => [
          `${String(s.Hour).padStart(2, '0')}:00`,
          s.InvoiceCount,
          s.TotalAmount
        ]);
      }
      else if (salesReportType === 'sales-return') {
        headers = ['Return Order ID', 'Return Date', 'Original Invoice ID', 'Customer Name', 'Cashier', 'Subtotal', 'Discount', 'VAT', 'Total Returned', 'Type'];
        rows = salesReportData.map(s => [
          `#SM-${s.ReturnOrderID}`,
          new Date(s.ReturnDate).toLocaleString(),
          `#SM-${s.OriginalOrderID || '--'}`,
          s.CustomerName || 'Walk-in Customer',
          s.CashierName || 'Cashier',
          s.Subtotal,
          s.DiscountAmount,
          s.TaxAmount,
          s.TotalAmount,
          s.ReturnType
        ]);
      }
      else if (salesReportType === 'discount-report') {
        headers = ['Invoice ID', 'Date / Time', 'Customer Name', 'Gross Subtotal', 'Discount Given', 'Net Total', 'Discount %'];
        rows = salesReportData.map(s => [
          `#SM-${s.OrderID}`,
          new Date(s.OrderDate).toLocaleString(),
          s.CustomerName || 'Walk-in Customer',
          s.OriginalSubtotal,
          s.DiscountGiven,
          s.NetTotal,
          s.DiscountPercentage
        ]);
      }
      else if (salesReportType === 'tax-vat-report') {
        headers = ['Invoice ID', 'Date / Time', 'Net Sales', 'Tax / VAT Collected', 'Gross Sales'];
        rows = salesReportData.map(s => [
          `#SM-${s.OrderID}`,
          new Date(s.OrderDate).toLocaleString(),
          s.NetSales,
          s.TaxVAT,
          s.GrossSales
        ]);
      }
      else if (salesReportType === 'credit-sales-report') {
        headers = ['Invoice ID', 'Date / Time', 'Customer Name', 'Phone', 'Credit Amount', 'Paid So Far', 'Outstanding Balance'];
        rows = salesReportData.map(s => [
          `#SM-${s.OrderID}`,
          new Date(s.OrderDate).toLocaleString(),
          s.CustomerName || 'Walk-in Customer',
          s.Phone || '--',
          s.OriginalCreditAmount,
          s.PaidAmount,
          s.BalanceAmount
        ]);
      }

      downloadCSV(headers, rows, `${filenameStr}.csv`);
    }
    else if (activeTab === 'profit-reports') {
      let headers = [];
      let rows = [];
      const filenameStr = `${salesReportType.replace(/-/g, '_')}_${dateStr}`;

      if (salesReportType === 'gross-profit-summary') {
        headers = ['Period / Date', 'Total Sales', 'Discount Given', 'Net Sales', 'Cost of Sales', 'Gross Profit', 'GP %'];
        rows = salesReportData.map(s => [
          s.DateStr,
          s.TotalSales,
          s.DiscountAmount,
          s.NetSales,
          s.CostOfSales,
          s.GrossProfit,
          Number(s.GrossProfitPercent).toFixed(2)
        ]);
      }
      else if (salesReportType === 'profit-by-item' || salesReportType === 'top-profitable-items' || salesReportType === 'lowest-profitable-items') {
        headers = ['Product Name', 'SKU', 'Category', 'Brand', 'Units Sold', 'Total Revenue', 'Cost of Sales', 'Gross Profit', 'GP %'];
        rows = salesReportData.map(s => [
          s.ProductName,
          s.SKU,
          s.CategoryName || 'N/A',
          s.Brand || 'No Brand',
          s.QuantitySold,
          s.TotalRevenue,
          s.CostOfSales,
          s.GrossProfit,
          Number(s.GrossProfitPercent).toFixed(2)
        ]);
      }
      else if (salesReportType === 'profit-by-category') {
        headers = ['Category Name', 'Units Sold', 'Total Revenue', 'Cost of Sales', 'Gross Profit', 'GP %'];
        rows = salesReportData.map(s => [
          s.CategoryName,
          s.QuantitySold,
          s.TotalRevenue,
          s.CostOfSales,
          s.GrossProfit,
          Number(s.GrossProfitPercent).toFixed(2)
        ]);
      }
      else if (salesReportType === 'profit-by-brand') {
        headers = ['Brand Name', 'Units Sold', 'Total Revenue', 'Cost of Sales', 'Gross Profit', 'GP %'];
        rows = salesReportData.map(s => [
          s.Brand,
          s.QuantitySold,
          s.TotalRevenue,
          s.CostOfSales,
          s.GrossProfit,
          Number(s.GrossProfitPercent).toFixed(2)
        ]);
      }
      else if (salesReportType === 'profit-by-customer') {
        headers = ['Customer Name', 'Phone', 'Invoice Count', 'Net Sales', 'Cost of Sales', 'Gross Profit', 'GP %'];
        rows = salesReportData.map(s => [
          s.CustomerName,
          s.Phone || '--',
          s.InvoiceCount,
          s.NetSales,
          s.CostOfSales,
          s.GrossProfit,
          Number(s.GrossProfitPercent).toFixed(2)
        ]);
      }
      else if (salesReportType === 'profit-by-salesperson') {
        headers = ['Salesperson Name', 'Invoice Count', 'Net Sales', 'Cost of Sales', 'Gross Profit', 'GP %'];
        rows = salesReportData.map(s => [
          s.SalespersonName,
          s.InvoiceCount,
          s.NetSales,
          s.CostOfSales,
          s.GrossProfit,
          Number(s.GrossProfitPercent).toFixed(2)
        ]);
      }
      else if (salesReportType === 'profit-by-invoice') {
        headers = ['Invoice ID', 'Date / Time', 'Customer Name', 'Total Sales', 'Discount', 'Net Sales', 'Cost of Sales', 'Gross Profit', 'GP %'];
        rows = salesReportData.map(s => [
          `#SM-${s.OrderID}`,
          new Date(s.OrderDate).toLocaleString(),
          s.CustomerName || 'Walk-in Customer',
          s.TotalSales,
          s.DiscountAmount,
          s.NetSales,
          s.CostOfSales,
          s.GrossProfit,
          Number(s.GrossProfitPercent).toFixed(2)
        ]);
      }
      else if (salesReportType === 'negative-profit-report') {
        headers = ['Invoice ID', 'Date / Time', 'Product Name', 'Quantity', 'Price', 'Cost', 'Net Revenue', 'Total Cost', 'Loss Amount', 'Cashier'];
        rows = salesReportData.map(s => [
          `#SM-${s.OrderID}`,
          new Date(s.OrderDate).toLocaleString(),
          s.ProductName,
          s.Quantity,
          s.Price,
          s.Cost,
          s.NetRevenue,
          s.TotalCost,
          s.GrossProfit,
          s.CashierName
        ]);
      }

      downloadCSV(headers, rows, `${filenameStr}.csv`);
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
    else if (activeTab === 'sales-analysis') {
      const typeTitles = {
        'sales-reports': 'Sales Invoices Log',
        'daily-sales-summary': 'Daily Sales Summary',
        'monthly-sales-summary': 'Monthly Sales Summary',
        'sales-by-item': 'Sales by Item Performance',
        'sales-by-category': 'Sales by Category Performance',
        'sales-by-brand': 'Sales by Brand Performance',
        'sales-by-customer': 'Sales by Customer Contribution',
        'sales-by-salesperson': 'Sales by Salesperson Summary',
        'sales-by-payment-method': 'Sales by Payment Method Summary',
        'sales-by-branch-warehouse': 'Sales by Branch / Warehouse',
        'sales-by-hour': 'Hourly Sales Distribution',
        'top-selling': 'Top Selling Items (By Volume)',
        'slow-moving': 'Slow Moving Products (By Volume)',
        'sales-return': 'Sales Return & Refunds Audit',
        'discount-report': 'Promotional & Manual Discounts Log',
        'tax-vat-report': 'Tax & VAT Collection Report',
        'credit-sales-report': 'Credit Sales & Outstandings Ledger'
      };
      
      reportTitle = typeTitles[salesReportType] || 'Sales Analysis Report';

      let tableHeaders = '';
      let rowsHtml = '';

      if (salesReportType === 'sales-reports') {
        tableHeaders = `
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
          </tr>`;
        rowsHtml = salesReportData.map(s => `
          <tr>
            <td>#SM-${s.OrderID}</td>
            <td>${new Date(s.OrderDate).toLocaleString()}</td>
            <td>${s.CustomerName || 'Walk-in Customer'}</td>
            <td>${s.CashierName || 'Cashier'}</td>
            <td style="text-align: right;">Rs. ${Number(s.Subtotal).toFixed(2)}</td>
            <td style="text-align: right; color: #d97706;">Rs. ${Number(s.DiscountAmount).toFixed(2)}</td>
            <td style="text-align: right;">Rs. ${Number(s.TaxAmount).toFixed(2)}</td>
            <td style="text-align: right; font-weight: bold; color: #0284c7;">Rs. ${Number(s.TotalAmount).toFixed(2)}</td>
            <td>${s.Status}</td>
          </tr>`).join('');
      }
      else if (salesReportType === 'daily-sales-summary' || salesReportType === 'monthly-sales-summary') {
        tableHeaders = `
          <tr>
            <th style="text-align: left;">${salesReportType === 'daily-sales-summary' ? 'Date' : 'Month'}</th>
            <th style="text-align: center;">Invoices Count</th>
            <th style="text-align: right;">Subtotal</th>
            <th style="text-align: right;">Discounts</th>
            <th style="text-align: right;">Tax/VAT</th>
            <th style="text-align: right;">Total Amount</th>
          </tr>`;
        rowsHtml = salesReportData.map(s => `
          <tr>
            <td>${s.DateStr || s.MonthStr}</td>
            <td style="text-align: center;">${s.InvoiceCount}</td>
            <td style="text-align: right;">Rs. ${Number(s.Subtotal).toFixed(2)}</td>
            <td style="text-align: right; color: #d97706;">Rs. ${Number(s.DiscountAmount).toFixed(2)}</td>
            <td style="text-align: right;">Rs. ${Number(s.TaxAmount).toFixed(2)}</td>
            <td style="text-align: right; font-weight: bold; color: #16a34a;">Rs. ${Number(s.TotalAmount).toFixed(2)}</td>
          </tr>`).join('');
      }
      else if (salesReportType === 'sales-by-item' || salesReportType === 'top-selling' || salesReportType === 'slow-moving') {
        tableHeaders = `
          <tr>
            <th style="text-align: left;">Product Name</th>
            <th style="text-align: left;">SKU</th>
            <th style="text-align: center;">Units Sold</th>
            <th style="text-align: right;">Total Sales (Subtotal)</th>
          </tr>`;
        rowsHtml = salesReportData.map(s => `
          <tr>
            <td style="font-weight: 600;">${s.ProductName}</td>
            <td>${s.SKU}</td>
            <td style="text-align: center;">${Number(s.QuantitySold).toFixed(2)}</td>
            <td style="text-align: right; font-weight: bold;">Rs. ${Number(s.TotalAmount).toFixed(2)}</td>
          </tr>`).join('');
      }
      else if (salesReportType === 'sales-by-category') {
        tableHeaders = `
          <tr>
            <th style="text-align: left;">Category Name</th>
            <th style="text-align: center;">Units Sold</th>
            <th style="text-align: right;">Total Sales (Subtotal)</th>
          </tr>`;
        rowsHtml = salesReportData.map(s => `
          <tr>
            <td style="font-weight: 600;">${s.CategoryName}</td>
            <td style="text-align: center;">${Number(s.QuantitySold).toFixed(2)}</td>
            <td style="text-align: right; font-weight: bold;">Rs. ${Number(s.TotalAmount).toFixed(2)}</td>
          </tr>`).join('');
      }
      else if (salesReportType === 'sales-by-brand') {
        tableHeaders = `
          <tr>
            <th style="text-align: left;">Brand Name</th>
            <th style="text-align: center;">Units Sold</th>
            <th style="text-align: right;">Total Sales (Subtotal)</th>
          </tr>`;
        rowsHtml = salesReportData.map(s => `
          <tr>
            <td style="font-weight: 600;">${s.Brand}</td>
            <td style="text-align: center;">${Number(s.QuantitySold).toFixed(2)}</td>
            <td style="text-align: right; font-weight: bold;">Rs. ${Number(s.TotalAmount).toFixed(2)}</td>
          </tr>`).join('');
      }
      else if (salesReportType === 'sales-by-customer') {
        tableHeaders = `
          <tr>
            <th style="text-align: left;">Customer Name</th>
            <th style="text-align: left;">Phone</th>
            <th style="text-align: center;">Invoice Count</th>
            <th style="text-align: right;">Subtotal</th>
            <th style="text-align: right;">Discount</th>
            <th style="text-align: right;">VAT</th>
            <th style="text-align: right;">Total Contributed</th>
          </tr>`;
        rowsHtml = salesReportData.map(s => `
          <tr>
            <td style="font-weight: 600;">${s.CustomerName}</td>
            <td>${s.Phone || '--'}</td>
            <td style="text-align: center;">${s.InvoiceCount}</td>
            <td style="text-align: right;">Rs. ${Number(s.Subtotal).toFixed(2)}</td>
            <td style="text-align: right; color: #d97706;">Rs. ${Number(s.DiscountAmount).toFixed(2)}</td>
            <td style="text-align: right;">Rs. ${Number(s.TaxAmount).toFixed(2)}</td>
            <td style="text-align: right; font-weight: bold; color: #0284c7;">Rs. ${Number(s.TotalAmount).toFixed(2)}</td>
          </tr>`).join('');
      }
      else if (salesReportType === 'sales-by-salesperson') {
        tableHeaders = `
          <tr>
            <th style="text-align: left;">Salesperson / Cashier</th>
            <th style="text-align: center;">Invoice Count</th>
            <th style="text-align: right;">Subtotal</th>
            <th style="text-align: right;">Discount</th>
            <th style="text-align: right;">VAT</th>
            <th style="text-align: right;">Total Handled</th>
          </tr>`;
        rowsHtml = salesReportData.map(s => `
          <tr>
            <td style="font-weight: 600;">${s.SalespersonName}</td>
            <td style="text-align: center;">${s.InvoiceCount}</td>
            <td style="text-align: right;">Rs. ${Number(s.Subtotal).toFixed(2)}</td>
            <td style="text-align: right; color: #d97706;">Rs. ${Number(s.DiscountAmount).toFixed(2)}</td>
            <td style="text-align: right;">Rs. ${Number(s.TaxAmount).toFixed(2)}</td>
            <td style="text-align: right; font-weight: bold; color: #0284c7;">Rs. ${Number(s.TotalAmount).toFixed(2)}</td>
          </tr>`).join('');
      }
      else if (salesReportType === 'sales-by-payment-method') {
        tableHeaders = `
          <tr>
            <th style="text-align: left;">Payment Mode</th>
            <th style="text-align: center;">Invoices Settled</th>
            <th style="text-align: right;">Collected Amount</th>
          </tr>`;
        rowsHtml = salesReportData.map(s => `
          <tr>
            <td style="font-weight: 600;">${s.PaymentMethod}</td>
            <td style="text-align: center;">${s.InvoiceCount}</td>
            <td style="text-align: right; font-weight: bold; color: #16a34a;">Rs. ${Number(s.TotalAmount).toFixed(2)}</td>
          </tr>`).join('');
      }
      else if (salesReportType === 'sales-by-branch-warehouse') {
        tableHeaders = `
          <tr>
            <th style="text-align: left;">Branch / Warehouse Location</th>
            <th style="text-align: center;">Qty Dispatched</th>
            <th style="text-align: right;">Dispatched Value</th>
          </tr>`;
        rowsHtml = salesReportData.map(s => `
          <tr>
            <td style="font-weight: 600;">${s.BranchWarehouse}</td>
            <td style="text-align: center;">${Number(s.QuantitySold).toFixed(2)}</td>
            <td style="text-align: right; font-weight: bold; color: #0284c7;">Rs. ${Number(s.TotalAmount).toFixed(2)}</td>
          </tr>`).join('');
      }
      else if (salesReportType === 'sales-by-hour') {
        tableHeaders = `
          <tr>
            <th style="text-align: left;">Hour of Day (24h)</th>
            <th style="text-align: center;">Transaction Volume</th>
            <th style="text-align: right;">Hourly Revenue</th>
          </tr>`;
        rowsHtml = salesReportData.map(s => `
          <tr>
            <td style="font-weight: 600;">${String(s.Hour).padStart(2, '0')}:00 - ${String(s.Hour).padStart(2, '0')}:59</td>
            <td style="text-align: center;">${s.InvoiceCount} sales</td>
            <td style="text-align: right; font-weight: bold; color: #16a34a;">Rs. ${Number(s.TotalAmount).toFixed(2)}</td>
          </tr>`).join('');
      }
      else if (salesReportType === 'sales-return') {
        tableHeaders = `
          <tr>
            <th style="text-align: left;">Return Order ID</th>
            <th style="text-align: left;">Date / Time</th>
            <th style="text-align: left;">Original Invoice ID</th>
            <th style="text-align: left;">Customer Name</th>
            <th style="text-align: left;">Cashier</th>
            <th style="text-align: right;">Subtotal</th>
            <th style="text-align: right;">Discount</th>
            <th style="text-align: right;">VAT</th>
            <th style="text-align: right;">Total Returned</th>
            <th style="text-align: left;">Type</th>
          </tr>`;
        rowsHtml = salesReportData.map(s => `
          <tr>
            <td>#SM-${s.ReturnOrderID}</td>
            <td>${new Date(s.ReturnDate).toLocaleString()}</td>
            <td>#SM-${s.OriginalOrderID || '--'}</td>
            <td>${s.CustomerName || 'Walk-in Customer'}</td>
            <td>${s.CashierName || 'Cashier'}</td>
            <td style="text-align: right;">Rs. ${Number(s.Subtotal).toFixed(2)}</td>
            <td style="text-align: right; color: #d97706;">Rs. ${Number(s.DiscountAmount).toFixed(2)}</td>
            <td style="text-align: right;">Rs. ${Number(s.TaxAmount).toFixed(2)}</td>
            <td style="text-align: right; font-weight: bold; color: #ef4444;">Rs. ${Number(s.TotalAmount).toFixed(2)}</td>
            <td><span style="font-weight:700; color:${s.ReturnType === 'Exchange' ? '#f59e0b' : '#ef4444'}">${s.ReturnType}</span></td>
          </tr>`).join('');
      }
      else if (salesReportType === 'discount-report') {
        tableHeaders = `
          <tr>
            <th style="text-align: left;">Invoice ID</th>
            <th style="text-align: left;">Date / Time</th>
            <th style="text-align: left;">Customer Name</th>
            <th style="text-align: right;">Gross Subtotal</th>
            <th style="text-align: right;">Discount Given</th>
            <th style="text-align: right;">Net Total</th>
            <th style="text-align: center;">Discount %</th>
          </tr>`;
        rowsHtml = salesReportData.map(s => `
          <tr>
            <td>#SM-${s.OrderID}</td>
            <td>${new Date(s.OrderDate).toLocaleString()}</td>
            <td>${s.CustomerName || 'Walk-in Customer'}</td>
            <td style="text-align: right;">Rs. ${Number(s.OriginalSubtotal).toFixed(2)}</td>
            <td style="text-align: right; color: #ef4444; font-weight: 700;">-Rs. ${Number(s.DiscountGiven).toFixed(2)}</td>
            <td style="text-align: right;">Rs. ${Number(s.NetTotal).toFixed(2)}</td>
            <td style="text-align: center;">${Number(s.DiscountPercentage).toFixed(1)}%</td>
          </tr>`).join('');
      }
      else if (salesReportType === 'tax-vat-report') {
        tableHeaders = `
          <tr>
            <th style="text-align: left;">Invoice ID</th>
            <th style="text-align: left;">Date / Time</th>
            <th style="text-align: right;">Net Sales (Excl. Tax)</th>
            <th style="text-align: right;">Tax / VAT Collected</th>
            <th style="text-align: right;">Gross Sales (Incl. Tax)</th>
          </tr>`;
        rowsHtml = salesReportData.map(s => `
          <tr>
            <td>#SM-${s.OrderID}</td>
            <td>${new Date(s.OrderDate).toLocaleString()}</td>
            <td style="text-align: right;">Rs. ${Number(s.NetSales).toFixed(2)}</td>
            <td style="text-align: right; color: #0284c7; font-weight: 700;">Rs. ${Number(s.TaxVAT).toFixed(2)}</td>
            <td style="text-align: right; font-weight: bold;">Rs. ${Number(s.GrossSales).toFixed(2)}</td>
          </tr>`).join('');
      }
      else if (salesReportType === 'credit-sales-report') {
        tableHeaders = `
          <tr>
            <th style="text-align: left;">Invoice ID</th>
            <th style="text-align: left;">Date / Time</th>
            <th style="text-align: left;">Customer Name</th>
            <th style="text-align: left;">Phone</th>
            <th style="text-align: right;">Credit Limit Approved</th>
            <th style="text-align: right;">Paid So Far</th>
            <th style="text-align: right;">Outstanding Balance</th>
          </tr>`;
        rowsHtml = salesReportData.map(s => `
          <tr>
            <td>#SM-${s.OrderID}</td>
            <td>${new Date(s.OrderDate).toLocaleString()}</td>
            <td style="font-weight: 600;">${s.CustomerName || 'Walk-in Customer'}</td>
            <td>${s.Phone || '--'}</td>
            <td style="text-align: right;">Rs. ${Number(s.OriginalCreditAmount).toFixed(2)}</td>
            <td style="text-align: right; color: #16a34a;">Rs. ${Number(s.PaidAmount).toFixed(2)}</td>
            <td style="text-align: right; font-weight: 700; color: #ef4444;">Rs. ${Number(s.BalanceAmount).toFixed(2)}</td>
          </tr>`).join('');
      }

      bodyHtml = `
        <table>
          <thead>
            ${tableHeaders}
          </thead>
          <tbody>
            ${rowsHtml.length > 0 ? rowsHtml : '<tr><td colspan="15" style="text-align:center;">No analysis records found for selection.</td></tr>'}
          </tbody>
        </table>
      `;
    }
    else if (activeTab === 'profit-reports') {
      const typeTitles = {
        'gross-profit-summary': 'Gross Profit Summary',
        'profit-by-item': 'Gross Profit by Item',
        'profit-by-category': 'Gross Profit by Category',
        'profit-by-brand': 'Gross Profit by Brand',
        'profit-by-customer': 'Gross Profit by Customer',
        'profit-by-salesperson': 'Gross Profit by Salesperson',
        'profit-by-invoice': 'Gross Profit by Invoice Ledger',
        'top-profitable-items': 'Top 20 Most Profitable Items',
        'lowest-profitable-items': 'Lowest Profit Items Log',
        'negative-profit-report': 'Negative Profit (Loss-Making Sales) Audit'
      };
      
      reportTitle = typeTitles[salesReportType] || 'Profit Report';

      let tableHeaders = '';
      let rowsHtml = '';

      if (salesReportType === 'gross-profit-summary') {
        tableHeaders = `
          <tr>
            <th style="text-align: left;">Period / Date</th>
            <th style="text-align: right;">Total Sales</th>
            <th style="text-align: right;">Discount Given</th>
            <th style="text-align: right;">Net Sales</th>
            <th style="text-align: right;">Cost of Sales</th>
            <th style="text-align: right;">Gross Profit</th>
            <th style="text-align: center;">GP %</th>
          </tr>`;
        rowsHtml = salesReportData.map(s => `
          <tr>
            <td style="font-weight: 600;">${s.DateStr}</td>
            <td style="text-align: right;">Rs. ${Number(s.TotalSales).toFixed(2)}</td>
            <td style="text-align: right; color: #ef4444;">-Rs. ${Number(s.DiscountAmount).toFixed(2)}</td>
            <td style="text-align: right;">Rs. ${Number(s.NetSales).toFixed(2)}</td>
            <td style="text-align: right;">Rs. ${Number(s.CostOfSales).toFixed(2)}</td>
            <td style="text-align: right; font-weight: bold; color: #16a34a;">Rs. ${Number(s.GrossProfit).toFixed(2)}</td>
            <td style="text-align: center;">${Number(s.GrossProfitPercent).toFixed(2)}%</td>
          </tr>`).join('');
      }
      else if (salesReportType === 'profit-by-item' || salesReportType === 'top-profitable-items' || salesReportType === 'lowest-profitable-items') {
        tableHeaders = `
          <tr>
            <th style="text-align: left;">Product Name</th>
            <th style="text-align: left;">SKU</th>
            <th style="text-align: left;">Category</th>
            <th style="text-align: left;">Brand</th>
            <th style="text-align: center;">Units Sold</th>
            <th style="text-align: right;">Total Revenue</th>
            <th style="text-align: right;">Cost of Sales</th>
            <th style="text-align: right;">Gross Profit</th>
            <th style="text-align: center;">GP %</th>
          </tr>`;
        rowsHtml = salesReportData.map(s => `
          <tr>
            <td style="font-weight: 600;">${s.ProductName}</td>
            <td>${s.SKU}</td>
            <td>${s.CategoryName || 'N/A'}</td>
            <td>${s.Brand || 'No Brand'}</td>
            <td style="text-align: center;">${Number(s.QuantitySold).toFixed(2)}</td>
            <td style="text-align: right;">Rs. ${Number(s.TotalRevenue).toFixed(2)}</td>
            <td style="text-align: right;">Rs. ${Number(s.CostOfSales).toFixed(2)}</td>
            <td style="text-align: right; font-weight: bold; color: ${s.GrossProfit >= 0 ? '#16a34a' : '#ef4444'};">Rs. ${Number(s.GrossProfit).toFixed(2)}</td>
            <td style="text-align: center;">${Number(s.GrossProfitPercent).toFixed(2)}%</td>
          </tr>`).join('');
      }
      else if (salesReportType === 'profit-by-category') {
        tableHeaders = `
          <tr>
            <th style="text-align: left;">Category Name</th>
            <th style="text-align: center;">Units Sold</th>
            <th style="text-align: right;">Total Revenue</th>
            <th style="text-align: right;">Cost of Sales</th>
            <th style="text-align: right;">Gross Profit</th>
            <th style="text-align: center;">GP %</th>
          </tr>`;
        rowsHtml = salesReportData.map(s => `
          <tr>
            <td style="font-weight: 600;">${s.CategoryName}</td>
            <td style="text-align: center;">${Number(s.QuantitySold).toFixed(2)}</td>
            <td style="text-align: right;">Rs. ${Number(s.TotalRevenue).toFixed(2)}</td>
            <td style="text-align: right;">Rs. ${Number(s.CostOfSales).toFixed(2)}</td>
            <td style="text-align: right; font-weight: bold; color: #16a34a;">Rs. ${Number(s.GrossProfit).toFixed(2)}</td>
            <td style="text-align: center;">${Number(s.GrossProfitPercent).toFixed(2)}%</td>
          </tr>`).join('');
      }
      else if (salesReportType === 'profit-by-brand') {
        tableHeaders = `
          <tr>
            <th style="text-align: left;">Brand Name</th>
            <th style="text-align: center;">Units Sold</th>
            <th style="text-align: right;">Total Revenue</th>
            <th style="text-align: right;">Cost of Sales</th>
            <th style="text-align: right;">Gross Profit</th>
            <th style="text-align: center;">GP %</th>
          </tr>`;
        rowsHtml = salesReportData.map(s => `
          <tr>
            <td style="font-weight: 600;">${s.Brand}</td>
            <td style="text-align: center;">${Number(s.QuantitySold).toFixed(2)}</td>
            <td style="text-align: right;">Rs. ${Number(s.TotalRevenue).toFixed(2)}</td>
            <td style="text-align: right;">Rs. ${Number(s.CostOfSales).toFixed(2)}</td>
            <td style="text-align: right; font-weight: bold; color: #16a34a;">Rs. ${Number(s.GrossProfit).toFixed(2)}</td>
            <td style="text-align: center;">${Number(s.GrossProfitPercent).toFixed(2)}%</td>
          </tr>`).join('');
      }
      else if (salesReportType === 'profit-by-customer') {
        tableHeaders = `
          <tr>
            <th style="text-align: left;">Customer Name</th>
            <th style="text-align: left;">Phone</th>
            <th style="text-align: center;">Invoice Count</th>
            <th style="text-align: right;">Net Sales</th>
            <th style="text-align: right;">Cost of Sales</th>
            <th style="text-align: right;">Gross Profit</th>
            <th style="text-align: center;">GP %</th>
          </tr>`;
        rowsHtml = salesReportData.map(s => `
          <tr>
            <td style="font-weight: 600;">${s.CustomerName}</td>
            <td>${s.Phone || '--'}</td>
            <td style="text-align: center;">${s.InvoiceCount}</td>
            <td style="text-align: right;">Rs. ${Number(s.NetSales).toFixed(2)}</td>
            <td style="text-align: right;">Rs. ${Number(s.CostOfSales).toFixed(2)}</td>
            <td style="text-align: right; font-weight: bold; color: #16a34a;">Rs. ${Number(s.GrossProfit).toFixed(2)}</td>
            <td style="text-align: center;">${Number(s.GrossProfitPercent).toFixed(2)}%</td>
          </tr>`).join('');
      }
      else if (salesReportType === 'profit-by-salesperson') {
        tableHeaders = `
          <tr>
            <th style="text-align: left;">Salesperson Name</th>
            <th style="text-align: center;">Invoice Count</th>
            <th style="text-align: right;">Net Sales</th>
            <th style="text-align: right;">Cost of Sales</th>
            <th style="text-align: right;">Gross Profit</th>
            <th style="text-align: center;">GP %</th>
          </tr>`;
        rowsHtml = salesReportData.map(s => `
          <tr>
            <td style="font-weight: 600;">${s.SalespersonName}</td>
            <td style="text-align: center;">${s.InvoiceCount}</td>
            <td style="text-align: right;">Rs. ${Number(s.NetSales).toFixed(2)}</td>
            <td style="text-align: right;">Rs. ${Number(s.CostOfSales).toFixed(2)}</td>
            <td style="text-align: right; font-weight: bold; color: #16a34a;">Rs. ${Number(s.GrossProfit).toFixed(2)}</td>
            <td style="text-align: center;">${Number(s.GrossProfitPercent).toFixed(2)}%</td>
          </tr>`).join('');
      }
      else if (salesReportType === 'profit-by-invoice') {
        tableHeaders = `
          <tr>
            <th style="text-align: left;">Invoice ID</th>
            <th style="text-align: left;">Date / Time</th>
            <th style="text-align: left;">Customer Name</th>
            <th style="text-align: right;">Total Sales</th>
            <th style="text-align: right;">Discount</th>
            <th style="text-align: right;">Net Sales</th>
            <th style="text-align: right;">Cost of Sales</th>
            <th style="text-align: right;">Gross Profit</th>
            <th style="text-align: center;">GP %</th>
          </tr>`;
        rowsHtml = salesReportData.map(s => `
          <tr>
            <td>#SM-${s.OrderID}</td>
            <td>${new Date(s.OrderDate).toLocaleString()}</td>
            <td style="font-weight: 600;">${s.CustomerName || 'Walk-in Customer'}</td>
            <td style="text-align: right;">Rs. ${Number(s.TotalSales).toFixed(2)}</td>
            <td style="text-align: right; color: #ef4444;">-Rs. ${Number(s.DiscountAmount).toFixed(2)}</td>
            <td style="text-align: right;">Rs. ${Number(s.NetSales).toFixed(2)}</td>
            <td style="text-align: right;">Rs. ${Number(s.CostOfSales).toFixed(2)}</td>
            <td style="text-align: right; font-weight: bold; color: #16a34a;">Rs. ${Number(s.GrossProfit).toFixed(2)}</td>
            <td style="text-align: center;">${Number(s.GrossProfitPercent).toFixed(2)}%</td>
          </tr>`).join('');
      }
      else if (salesReportType === 'negative-profit-report') {
        tableHeaders = `
          <tr>
            <th style="text-align: left;">Invoice ID</th>
            <th style="text-align: left;">Date / Time</th>
            <th style="text-align: left;">Product Name</th>
            <th style="text-align: center;">Quantity</th>
            <th style="text-align: right;">Price</th>
            <th style="text-align: right;">Cost</th>
            <th style="text-align: right;">Net Revenue</th>
            <th style="text-align: right;">Total Cost</th>
            <th style="text-align: right;">Loss Amount</th>
            <th style="text-align: left;">Cashier</th>
          </tr>`;
        rowsHtml = salesReportData.map(s => `
          <tr>
            <td>#SM-${s.OrderID}</td>
            <td>${new Date(s.OrderDate).toLocaleString()}</td>
            <td style="font-weight: 600;">${s.ProductName}</td>
            <td style="text-align: center;">${s.Quantity}</td>
            <td style="text-align: right;">Rs. ${Number(s.Price).toFixed(2)}</td>
            <td style="text-align: right;">Rs. ${Number(s.Cost).toFixed(2)}</td>
            <td style="text-align: right;">Rs. ${Number(s.NetRevenue).toFixed(2)}</td>
            <td style="text-align: right;">Rs. ${Number(s.TotalCost).toFixed(2)}</td>
            <td style="text-align: right; font-weight: bold; color: #ef4444;">Rs. ${Number(s.GrossProfit).toFixed(2)}</td>
            <td>${s.CashierName}</td>
          </tr>`).join('');
      }

      bodyHtml = `
        <table>
          <thead>
            ${tableHeaders}
          </thead>
          <tbody>
            ${rowsHtml.length > 0 ? rowsHtml : '<tr><td colspan="15" style="text-align:center;">No profit analysis records found.</td></tr>'}
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
    setTimeout(() => {
      popup.print();
      popup.close();
    }, 250);
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
        <button 
          className={`category-tab ${activeTab === 'sales-analysis' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('sales-analysis');
            setSalesReportData([]);
          }}
        >
          Sales Analysis Reports
        </button>
        <button 
          className={`category-tab ${activeTab === 'profit-reports' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('profit-reports');
            setSalesReportType('gross-profit-summary');
            setSalesReportData([]);
          }}
        >
          Profit Analysis
        </button>
        <button 
          className={`category-tab ${activeTab === 'kpi-dashboard' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('kpi-dashboard');
          }}
        >
          Operations Dashboard
        </button>
      </div>

      {/* Filters Area */}
      <div className="glass-panel" style={{ padding: '16px', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '24px' }}>
        
        {activeTab !== 'customers' && activeTab !== 'dayend' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {activeTab === 'sales-analysis' && (
                <select
                  className="form-select"
                  style={{ width: '220px', padding: '6px 12px', fontSize: '13px', marginRight: '8px' }}
                  value={salesReportType}
                  onChange={(e) => setSalesReportType(e.target.value)}
                >
                  <option value="sales-reports">Sales Invoices Log</option>
                  <option value="daily-sales-summary">Daily Sales Summary</option>
                  <option value="monthly-sales-summary">Monthly Sales Summary</option>
                  <option value="sales-by-item">Sales by Item</option>
                  <option value="sales-by-category">Sales by Category</option>
                  <option value="sales-by-brand">Sales by Brand</option>
                  <option value="sales-by-customer">Sales by Customer</option>
                  <option value="sales-by-salesperson">Sales by Salesperson</option>
                  <option value="sales-by-payment-method">Sales by Payment Mode</option>
                  <option value="sales-by-branch-warehouse">Sales by Branch/Warehouse</option>
                  <option value="sales-by-hour">Sales by Hour</option>
                  <option value="top-selling">Top Selling Items</option>
                  <option value="slow-moving">Slow Moving Items</option>
                  <option value="sales-return">Sales Return Report</option>
                  <option value="discount-report">Discount Report</option>
                  <option value="tax-vat-report">Tax/VAT Report</option>
                  <option value="credit-sales-report">Credit Sales Report</option>
                </select>
              )}
              {activeTab === 'sales-analysis' && (
                <input
                  type="text"
                  className="form-input"
                  style={{ width: '180px', padding: '6px 12px', fontSize: '13px', marginRight: '16px' }}
                  placeholder="Branch / Warehouse..."
                  value={branchFilter}
                  onChange={(e) => setBranchFilter(e.target.value)}
                />
              )}

              {activeTab === 'profit-reports' && (
                <select
                  className="form-select"
                  style={{ width: '220px', padding: '6px 12px', fontSize: '13px', marginRight: '8px' }}
                  value={salesReportType}
                  onChange={(e) => {
                    setSalesReportType(e.target.value);
                    // Clear product/category drill-down when changing manually
                    setSelectedProductId('');
                    setSelectedCategoryId('');
                  }}
                >
                  <option value="gross-profit-summary">Gross Profit Summary</option>
                  <option value="profit-by-item">Gross Profit by Item</option>
                  <option value="profit-by-category">Gross Profit by Category</option>
                  <option value="profit-by-brand">Gross Profit by Brand</option>
                  <option value="profit-by-customer">Gross Profit by Customer</option>
                  <option value="profit-by-salesperson">Gross Profit by Salesperson</option>
                  <option value="profit-by-invoice">Gross Profit by Invoice</option>
                  <option value="top-profitable-items">Top 20 Most Profitable Items</option>
                  <option value="lowest-profitable-items">Lowest Profit Items</option>
                  <option value="negative-profit-report">Negative Profit (Losses)</option>
                </select>
              )}

              {(activeTab === 'profit-reports' || activeTab === 'kpi-dashboard') && (
                <>
                  <select
                    className="form-select"
                    style={{ width: '150px', padding: '6px 12px', fontSize: '13px', marginRight: '8px' }}
                    value={selectedProductId}
                    onChange={(e) => setSelectedProductId(e.target.value)}
                  >
                    <option value="">Filter Product...</option>
                    {productList.map(p => (
                      <option key={p.ProductID} value={p.ProductID}>{p.Name}</option>
                    ))}
                  </select>

                  <select
                    className="form-select"
                    style={{ width: '150px', padding: '6px 12px', fontSize: '13px', marginRight: '8px' }}
                    value={selectedCategoryId}
                    onChange={(e) => setSelectedCategoryId(e.target.value)}
                  >
                    <option value="">Filter Category...</option>
                    {categoryList.map(c => (
                      <option key={c.CategoryID} value={c.CategoryID}>{c.Name}</option>
                    ))}
                  </select>

                  <select
                    className="form-select"
                    style={{ width: '130px', padding: '6px 12px', fontSize: '13px', marginRight: '8px' }}
                    value={selectedBrand}
                    onChange={(e) => setSelectedBrand(e.target.value)}
                  >
                    <option value="">Filter Brand...</option>
                    {brandList.filter(b => b.Brand).map((b, idx) => (
                      <option key={idx} value={b.Brand}>{b.Brand}</option>
                    ))}
                  </select>

                  <select
                    className="form-select"
                    style={{ width: '150px', padding: '6px 12px', fontSize: '13px', marginRight: '8px' }}
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                  >
                    <option value="">Filter Customer...</option>
                    {customerList.map(c => (
                      <option key={c.CustomerID} value={c.CustomerID}>{c.Name || 'Walk-in Customer'}</option>
                    ))}
                  </select>

                  <select
                    className="form-select"
                    style={{ width: '150px', padding: '6px 12px', fontSize: '13px', marginRight: '8px' }}
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                  >
                    <option value="">Filter Salesperson...</option>
                    {salespersonList.map(u => (
                      <option key={u.UserID} value={u.UserID}>{u.Username}</option>
                    ))}
                  </select>

                  <input
                    type="text"
                    className="form-input"
                    style={{ width: '150px', padding: '6px 12px', fontSize: '13px', marginRight: '8px' }}
                    placeholder="Branch / Wh..."
                    value={branchFilter}
                    onChange={(e) => setBranchFilter(e.target.value)}
                  />

                  {(selectedProductId || selectedCategoryId || selectedBrand || selectedCustomerId || selectedUserId || branchFilter) && (
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '6px 12px', fontSize: '12.5px', marginRight: '8px' }}
                      onClick={() => {
                        setSelectedProductId('');
                        setSelectedCategoryId('');
                        setSelectedBrand('');
                        setSelectedCustomerId('');
                        setSelectedUserId('');
                        setBranchFilter('');
                      }}
                    >
                      Clear Filters
                    </button>
                  )}
                </>
              )}

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
          {activeTab !== 'kpi-dashboard' && (
            <>
              <button className="btn btn-secondary" onClick={() => triggerReportAction('preview')} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', fontSize: '13px', height: '36px' }}>
                <Eye size={14} />
                <span>Preview</span>
              </button>
              <button className="btn btn-secondary" onClick={() => triggerReportAction('print')} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', fontSize: '13px', height: '36px' }}>
                <Printer size={14} />
                <span>Print</span>
              </button>
              <button className="btn btn-secondary" onClick={() => triggerReportAction('pdf')} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', fontSize: '13px', height: '36px' }}>
                <FileDown size={14} />
                <span>PDF</span>
              </button>
              <button className="btn btn-secondary" onClick={() => triggerReportAction('excel')} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', fontSize: '13px', height: '36px' }}>
                <FileSpreadsheet size={14} />
                <span>Excel</span>
              </button>
            </>
          )}
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
                {salesJournal.length > 0 && (
                  <tfoot>
                    <tr style={{ fontWeight: 'bold', background: 'rgba(255, 255, 255, 0.05)' }}>
                      <td colSpan={4}>TOTAL</td>
                      <td className="mono">Rs. {formatCurrency(salesJournal.reduce((acc, sale) => acc + Number(sale.Subtotal || 0), 0))}</td>
                      <td className="mono" style={{ color: salesJournal.reduce((acc, sale) => acc + Number(sale.DiscountAmount || 0), 0) > 0 ? 'var(--warning)' : 'inherit' }}>
                        Rs. {formatCurrency(salesJournal.reduce((acc, sale) => acc + Number(sale.DiscountAmount || 0), 0))}
                      </td>
                      <td className="mono">Rs. {formatCurrency(salesJournal.reduce((acc, sale) => acc + Number(sale.TaxAmount || 0), 0))}</td>
                      <td className="mono" style={{ color: 'var(--accent)', fontWeight: '600' }}>
                        Rs. {formatCurrency(salesJournal.reduce((acc, sale) => acc + Number(sale.TotalAmount || 0), 0))}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                )}
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
                {productPerformance.length > 0 && (
                  <tfoot>
                    <tr style={{ fontWeight: 'bold', background: 'rgba(255, 255, 255, 0.05)' }}>
                      <td colSpan={3}>TOTAL</td>
                      <td className="mono" style={{ fontWeight: '700' }}>
                        {productPerformance.reduce((acc, item) => acc + Number(item.UnitsSold || 0), 0)} units
                      </td>
                      <td className="mono" style={{ color: 'var(--accent)' }}>
                        Rs. {formatCurrency(productPerformance.reduce((acc, item) => acc + Number(item.GrossRevenue || 0), 0))}
                      </td>
                      <td className="mono" style={{ color: 'var(--success)' }}>
                        Rs. {formatCurrency(productPerformance.reduce((acc, item) => acc + Number(item.EstimatedProfit || 0), 0))}
                      </td>
                      <td className="mono">
                        {productPerformance.reduce((acc, item) => acc + Number(item.CurrentStock || 0), 0)} left
                      </td>
                    </tr>
                  </tfoot>
                )}
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
                {customerStatement.length > 0 && (
                  <tfoot>
                    <tr style={{ fontWeight: 'bold', background: 'rgba(255, 255, 255, 0.05)' }}>
                      <td colSpan={2}>TOTAL</td>
                      <td className="mono" style={{ color: 'var(--primary)', fontWeight: '700' }}>
                        {customerStatement.reduce((acc, c) => acc + Number(c.LoyaltyPoints || 0), 0)} pts
                      </td>
                      <td className="mono">
                        Rs. {formatCurrency(customerStatement.reduce((acc, c) => acc + Number(c.CreditLimit || 0), 0))}
                      </td>
                      <td className="mono" style={{ color: customerStatement.reduce((acc, c) => acc + Number(c.CurrentBalance || 0), 0) > 0 ? 'var(--danger)' : 'inherit' }}>
                        Rs. {formatCurrency(customerStatement.reduce((acc, c) => acc + Number(c.CurrentBalance || 0), 0))}
                      </td>
                      <td className="mono" style={{ color: 'var(--success)' }}>
                        Rs. {formatCurrency(customerStatement.reduce((acc, c) => acc + Number(c.RemainingCredit || 0), 0))}
                      </td>
                      <td>
                        {customerStatement.reduce((acc, c) => acc + Number(c.TotalOrdersCount || 0), 0)} sales
                      </td>
                      <td className="mono" style={{ color: 'var(--accent)', fontWeight: '600' }}>
                        Rs. {formatCurrency(customerStatement.reduce((acc, c) => acc + Number(c.TotalPurchasesValue || 0), 0))}
                      </td>
                    </tr>
                  </tfoot>
                )}
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
                {drawerHistory.length > 0 && (
                  <tfoot>
                    <tr style={{ fontWeight: 'bold', background: 'rgba(255, 255, 255, 0.05)' }}>
                      <td colSpan={5}>TOTAL</td>
                      <td className="mono">Rs. {formatCurrency(drawerHistory.reduce((acc, sess) => acc + Number(sess.ExpectedCash || 0), 0))}</td>
                      <td className="mono">Rs. {formatCurrency(drawerHistory.reduce((acc, sess) => acc + Number(sess.ActualCash || 0), 0))}</td>
                      <td className="mono" style={{ 
                        textAlign: 'right', 
                        fontWeight: '700', 
                        color: drawerHistory.reduce((acc, sess) => acc + Number(sess.DifferenceAmount || 0), 0) === 0 
                          ? 'var(--success)' 
                          : drawerHistory.reduce((acc, sess) => acc + Number(sess.DifferenceAmount || 0), 0) > 0 
                            ? 'var(--accent)' 
                            : 'var(--danger)' 
                      }}>
                        {drawerHistory.reduce((acc, sess) => acc + Number(sess.DifferenceAmount || 0), 0) >= 0 ? '+' : ''}
                        Rs. {formatCurrency(drawerHistory.reduce((acc, sess) => acc + Number(sess.DifferenceAmount || 0), 0))}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}

          {/* TAB 5: Sales Analysis Reports */}
          {activeTab === 'sales-analysis' && (
            <div className="table-container">
              <table className="table-glass">
                <thead>
                  {(() => {
                    if (salesReportType === 'sales-reports') {
                      return (
                        <tr>
                          <th>Invoice ID</th>
                          <th>Date / Time</th>
                          <th>Customer Name</th>
                          <th>Cashier</th>
                          <th style={{ textAlign: 'right' }}>Subtotal</th>
                          <th style={{ textAlign: 'right' }}>Discount</th>
                          <th style={{ textAlign: 'right' }}>VAT</th>
                          <th style={{ textAlign: 'right' }}>Total Received</th>
                          <th>Status</th>
                        </tr>
                      );
                    }
                    else if (salesReportType === 'daily-sales-summary' || salesReportType === 'monthly-sales-summary') {
                      return (
                        <tr>
                          <th>{salesReportType === 'daily-sales-summary' ? 'Date' : 'Month'}</th>
                          <th style={{ textAlign: 'center' }}>Invoices Count</th>
                          <th style={{ textAlign: 'right' }}>Subtotal</th>
                          <th style={{ textAlign: 'right' }}>Discounts</th>
                          <th style={{ textAlign: 'right' }}>Tax/VAT</th>
                          <th style={{ textAlign: 'right' }}>Total Amount</th>
                        </tr>
                      );
                    }
                    else if (salesReportType === 'sales-by-item' || salesReportType === 'top-selling' || salesReportType === 'slow-moving') {
                      return (
                        <tr>
                          <th>Product Name</th>
                          <th>SKU</th>
                          <th style={{ textAlign: 'center' }}>Units Sold</th>
                          <th style={{ textAlign: 'right' }}>Total Sales (Subtotal)</th>
                        </tr>
                      );
                    }
                    else if (salesReportType === 'sales-by-category') {
                      return (
                        <tr>
                          <th>Category Name</th>
                          <th style={{ textAlign: 'center' }}>Units Sold</th>
                          <th style={{ textAlign: 'right' }}>Total Sales (Subtotal)</th>
                        </tr>
                      );
                    }
                    else if (salesReportType === 'sales-by-brand') {
                      return (
                        <tr>
                          <th>Brand Name</th>
                          <th style={{ textAlign: 'center' }}>Units Sold</th>
                          <th style={{ textAlign: 'right' }}>Total Sales (Subtotal)</th>
                        </tr>
                      );
                    }
                    else if (salesReportType === 'sales-by-customer') {
                      return (
                        <tr>
                          <th>Customer Name</th>
                          <th>Phone</th>
                          <th style={{ textAlign: 'center' }}>Invoice Count</th>
                          <th style={{ textAlign: 'right' }}>Subtotal</th>
                          <th style={{ textAlign: 'right' }}>Discount</th>
                          <th style={{ textAlign: 'right' }}>VAT</th>
                          <th style={{ textAlign: 'right' }}>Total Contributed</th>
                        </tr>
                      );
                    }
                    else if (salesReportType === 'sales-by-salesperson') {
                      return (
                        <tr>
                          <th>Salesperson / Cashier</th>
                          <th style={{ textAlign: 'center' }}>Invoice Count</th>
                          <th style={{ textAlign: 'right' }}>Subtotal</th>
                          <th style={{ textAlign: 'right' }}>Discount</th>
                          <th style={{ textAlign: 'right' }}>VAT</th>
                          <th style={{ textAlign: 'right' }}>Total Handled</th>
                        </tr>
                      );
                    }
                    else if (salesReportType === 'sales-by-payment-method') {
                      return (
                        <tr>
                          <th>Payment Mode</th>
                          <th style={{ textAlign: 'center' }}>Invoices Settled</th>
                          <th style={{ textAlign: 'right' }}>Collected Amount</th>
                        </tr>
                      );
                    }
                    else if (salesReportType === 'sales-by-branch-warehouse') {
                      return (
                        <tr>
                          <th>Branch / Warehouse Location</th>
                          <th style={{ textAlign: 'center' }}>Qty Dispatched</th>
                          <th style={{ textAlign: 'right' }}>Dispatched Value</th>
                        </tr>
                      );
                    }
                    else if (salesReportType === 'sales-by-hour') {
                      return (
                        <tr>
                          <th>Hour of Day (24h)</th>
                          <th style={{ textAlign: 'center' }}>Transaction Volume</th>
                          <th style={{ textAlign: 'right' }}>Hourly Revenue</th>
                        </tr>
                      );
                    }
                    else if (salesReportType === 'sales-return') {
                      return (
                        <tr>
                          <th>Return Order ID</th>
                          <th>Date / Time</th>
                          <th>Original Invoice ID</th>
                          <th>Customer Name</th>
                          <th>Cashier</th>
                          <th style={{ textAlign: 'right' }}>Subtotal</th>
                          <th style={{ textAlign: 'right' }}>Discount</th>
                          <th style={{ textAlign: 'right' }}>VAT</th>
                          <th style={{ textAlign: 'right' }}>Total Returned</th>
                          <th>Type</th>
                        </tr>
                      );
                    }
                    else if (salesReportType === 'discount-report') {
                      return (
                        <tr>
                          <th>Invoice ID</th>
                          <th>Date / Time</th>
                          <th>Customer Name</th>
                          <th style={{ textAlign: 'right' }}>Gross Subtotal</th>
                          <th style={{ textAlign: 'right' }}>Discount Given</th>
                          <th style={{ textAlign: 'right' }}>Net Total</th>
                          <th style={{ textAlign: 'center' }}>Discount %</th>
                        </tr>
                      );
                    }
                    else if (salesReportType === 'tax-vat-report') {
                      return (
                        <tr>
                          <th>Invoice ID</th>
                          <th>Date / Time</th>
                          <th style={{ textAlign: 'right' }}>Net Sales (Excl. Tax)</th>
                          <th style={{ textAlign: 'right' }}>Tax / VAT Collected</th>
                          <th style={{ textAlign: 'right' }}>Gross Sales (Incl. Tax)</th>
                        </tr>
                      );
                    }
                    else if (salesReportType === 'credit-sales-report') {
                      return (
                        <tr>
                          <th>Invoice ID</th>
                          <th>Date / Time</th>
                          <th>Customer Name</th>
                          <th>Phone</th>
                          <th style={{ textAlign: 'right' }}>Credit Limit Approved</th>
                          <th style={{ textAlign: 'right' }}>Paid So Far</th>
                          <th style={{ textAlign: 'right' }}>Outstanding Balance</th>
                        </tr>
                      );
                    }
                    return null;
                  })()}
                </thead>
                <tbody>
                  {salesReportData.length === 0 ? (
                    <tr>
                      <td colSpan={15} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                        No records found for the selected dates and report type.
                      </td>
                    </tr>
                  ) : (
                    salesReportData.map((row, idx) => {
                      if (salesReportType === 'sales-reports') {
                        return (
                          <tr key={idx}>
                            <td style={{ fontWeight: '600', fontFamily: 'var(--font-mono)' }}>#SM-{row.OrderID}</td>
                            <td>{new Date(row.OrderDate).toLocaleString('en-LK')}</td>
                            <td>{row.CustomerName || 'Walk-in Customer'}</td>
                            <td>{row.CashierName || 'Cashier'}</td>
                            <td className="mono" style={{ textAlign: 'right' }}>Rs. {formatCurrency(row.Subtotal)}</td>
                            <td className="mono" style={{ textAlign: 'right', color: 'var(--warning)' }}>Rs. {formatCurrency(row.DiscountAmount)}</td>
                            <td className="mono" style={{ textAlign: 'right' }}>Rs. {formatCurrency(row.TaxAmount)}</td>
                            <td className="mono" style={{ textAlign: 'right', fontWeight: '700', color: 'var(--accent)' }}>Rs. {formatCurrency(row.TotalAmount)}</td>
                            <td>{row.Status}</td>
                          </tr>
                        );
                      }
                      else if (salesReportType === 'daily-sales-summary' || salesReportType === 'monthly-sales-summary') {
                        return (
                          <tr key={idx}>
                            <td style={{ fontWeight: '600' }}>{row.DateStr || row.MonthStr}</td>
                            <td style={{ textAlign: 'center' }} className="mono">{row.InvoiceCount}</td>
                            <td className="mono" style={{ textAlign: 'right' }}>Rs. {formatCurrency(row.Subtotal)}</td>
                            <td className="mono" style={{ textAlign: 'right', color: 'var(--warning)' }}>Rs. {formatCurrency(row.DiscountAmount)}</td>
                            <td className="mono" style={{ textAlign: 'right' }}>Rs. {formatCurrency(row.TaxAmount)}</td>
                            <td className="mono" style={{ textAlign: 'right', fontWeight: '700', color: 'var(--success)' }}>Rs. {formatCurrency(row.TotalAmount)}</td>
                          </tr>
                        );
                      }
                      else if (salesReportType === 'sales-by-item' || salesReportType === 'top-selling' || salesReportType === 'slow-moving') {
                        return (
                          <tr key={idx}>
                            <td style={{ fontWeight: '600' }}>{row.ProductName}</td>
                            <td className="mono">{row.SKU}</td>
                            <td style={{ textAlign: 'center' }} className="mono">{Number(row.QuantitySold).toFixed(2)}</td>
                            <td className="mono" style={{ textAlign: 'right', fontWeight: '700' }}>Rs. {formatCurrency(row.TotalAmount)}</td>
                          </tr>
                        );
                      }
                      else if (salesReportType === 'sales-by-category') {
                        return (
                          <tr key={idx}>
                            <td style={{ fontWeight: '600' }}>{row.CategoryName}</td>
                            <td style={{ textAlign: 'center' }} className="mono">{Number(row.QuantitySold).toFixed(2)}</td>
                            <td className="mono" style={{ textAlign: 'right', fontWeight: '700' }}>Rs. {formatCurrency(row.TotalAmount)}</td>
                          </tr>
                        );
                      }
                      else if (salesReportType === 'sales-by-brand') {
                        return (
                          <tr key={idx}>
                            <td style={{ fontWeight: '600' }}>{row.Brand}</td>
                            <td style={{ textAlign: 'center' }} className="mono">{Number(row.QuantitySold).toFixed(2)}</td>
                            <td className="mono" style={{ textAlign: 'right', fontWeight: '700' }}>Rs. {formatCurrency(row.TotalAmount)}</td>
                          </tr>
                        );
                      }
                      else if (salesReportType === 'sales-by-customer') {
                        return (
                          <tr key={idx}>
                            <td style={{ fontWeight: '600' }}>{row.CustomerName}</td>
                            <td>{row.Phone || '--'}</td>
                            <td style={{ textAlign: 'center' }} className="mono">{row.InvoiceCount}</td>
                            <td className="mono" style={{ textAlign: 'right' }}>Rs. {formatCurrency(row.Subtotal)}</td>
                            <td className="mono" style={{ textAlign: 'right', color: 'var(--warning)' }}>Rs. {formatCurrency(row.DiscountAmount)}</td>
                            <td className="mono" style={{ textAlign: 'right' }}>Rs. {formatCurrency(row.TaxAmount)}</td>
                            <td className="mono" style={{ textAlign: 'right', fontWeight: '700', color: 'var(--accent)' }}>Rs. {formatCurrency(row.TotalAmount)}</td>
                          </tr>
                        );
                      }
                      else if (salesReportType === 'sales-by-salesperson') {
                        return (
                          <tr key={idx}>
                            <td style={{ fontWeight: '600' }}>{row.SalespersonName}</td>
                            <td style={{ textAlign: 'center' }} className="mono">{row.InvoiceCount}</td>
                            <td className="mono" style={{ textAlign: 'right' }}>Rs. {formatCurrency(row.Subtotal)}</td>
                            <td className="mono" style={{ textAlign: 'right', color: 'var(--warning)' }}>Rs. {formatCurrency(row.DiscountAmount)}</td>
                            <td className="mono" style={{ textAlign: 'right' }}>Rs. {formatCurrency(row.TaxAmount)}</td>
                            <td className="mono" style={{ textAlign: 'right', fontWeight: '700', color: 'var(--accent)' }}>Rs. {formatCurrency(row.TotalAmount)}</td>
                          </tr>
                        );
                      }
                      else if (salesReportType === 'sales-by-payment-method') {
                        return (
                          <tr key={idx}>
                            <td style={{ fontWeight: '600' }}>{row.PaymentMethod}</td>
                            <td style={{ textAlign: 'center' }} className="mono">{row.InvoiceCount}</td>
                            <td className="mono" style={{ textAlign: 'right', fontWeight: '700', color: 'var(--success)' }}>Rs. {formatCurrency(row.TotalAmount)}</td>
                          </tr>
                        );
                      }
                      else if (salesReportType === 'sales-by-branch-warehouse') {
                        return (
                          <tr key={idx}>
                            <td style={{ fontWeight: '600' }}>{row.BranchWarehouse}</td>
                            <td style={{ textAlign: 'center' }} className="mono">{Number(row.QuantitySold).toFixed(2)}</td>
                            <td className="mono" style={{ textAlign: 'right', fontWeight: '700', color: 'var(--accent)' }}>Rs. {formatCurrency(row.TotalAmount)}</td>
                          </tr>
                        );
                      }
                      else if (salesReportType === 'sales-by-hour') {
                        return (
                          <tr key={idx}>
                            <td style={{ fontWeight: '600' }} className="mono">{String(row.Hour).padStart(2, '0')}:00 - {String(row.Hour).padStart(2, '0')}:59</td>
                            <td style={{ textAlign: 'center' }} className="mono">{row.InvoiceCount} sales</td>
                            <td className="mono" style={{ textAlign: 'right', fontWeight: '700', color: 'var(--success)' }}>Rs. {formatCurrency(row.TotalAmount)}</td>
                          </tr>
                        );
                      }
                      else if (salesReportType === 'sales-return') {
                        return (
                          <tr key={idx}>
                            <td style={{ fontWeight: '600', fontFamily: 'var(--font-mono)' }}>#SM-{row.ReturnOrderID}</td>
                            <td>{new Date(row.ReturnDate).toLocaleString('en-LK')}</td>
                            <td className="mono">#SM-{row.OriginalOrderID || '--'}</td>
                            <td>{row.CustomerName || 'Walk-in Customer'}</td>
                            <td>{row.CashierName || 'Cashier'}</td>
                            <td className="mono" style={{ textAlign: 'right' }}>Rs. {formatCurrency(row.Subtotal)}</td>
                            <td className="mono" style={{ textAlign: 'right', color: 'var(--warning)' }}>Rs. {formatCurrency(row.DiscountAmount)}</td>
                            <td className="mono" style={{ textAlign: 'right' }}>Rs. {formatCurrency(row.TaxAmount)}</td>
                            <td className="mono" style={{ textAlign: 'right', fontWeight: '700', color: 'var(--danger)' }}>Rs. {formatCurrency(row.TotalAmount)}</td>
                            <td><span style={{ fontWeight: '700', color: row.ReturnType === 'Exchange' ? 'var(--warning)' : 'var(--danger)' }}>{row.ReturnType}</span></td>
                          </tr>
                        );
                      }
                      else if (salesReportType === 'discount-report') {
                        return (
                          <tr key={idx}>
                            <td style={{ fontWeight: '600', fontFamily: 'var(--font-mono)' }}>#SM-{row.OrderID}</td>
                            <td>{new Date(row.OrderDate).toLocaleString('en-LK')}</td>
                            <td>{row.CustomerName || 'Walk-in Customer'}</td>
                            <td className="mono" style={{ textAlign: 'right' }}>Rs. {formatCurrency(row.OriginalSubtotal)}</td>
                            <td className="mono" style={{ textAlign: 'right', color: 'var(--danger)', fontWeight: '700' }}>-Rs. {formatCurrency(row.DiscountGiven)}</td>
                            <td className="mono" style={{ textAlign: 'right' }}>Rs. {formatCurrency(row.NetTotal)}</td>
                            <td style={{ textAlign: 'center' }} className="mono">{Number(row.DiscountPercentage).toFixed(1)}%</td>
                          </tr>
                        );
                      }
                      else if (salesReportType === 'tax-vat-report') {
                        return (
                          <tr key={idx}>
                            <td style={{ fontWeight: '600', fontFamily: 'var(--font-mono)' }}>#SM-{row.OrderID}</td>
                            <td>{new Date(row.OrderDate).toLocaleString('en-LK')}</td>
                            <td className="mono" style={{ textAlign: 'right' }}>Rs. {formatCurrency(row.NetSales)}</td>
                            <td className="mono" style={{ textAlign: 'right', color: 'var(--accent)', fontWeight: '700' }}>Rs. {formatCurrency(row.TaxVAT)}</td>
                            <td className="mono" style={{ textAlign: 'right', fontWeight: '700' }}>Rs. {formatCurrency(row.GrossSales)}</td>
                          </tr>
                        );
                      }
                      else if (salesReportType === 'credit-sales-report') {
                        return (
                          <tr key={idx}>
                            <td style={{ fontWeight: '600', fontFamily: 'var(--font-mono)' }}>#SM-{row.OrderID}</td>
                            <td>{new Date(row.OrderDate).toLocaleString('en-LK')}</td>
                            <td style={{ fontWeight: '600' }}>{row.CustomerName || 'Walk-in Customer'}</td>
                            <td>{row.Phone || '--'}</td>
                            <td className="mono" style={{ textAlign: 'right' }}>Rs. {formatCurrency(row.OriginalCreditAmount)}</td>
                            <td className="mono" style={{ textAlign: 'right', color: 'var(--success)' }}>Rs. {formatCurrency(row.PaidAmount)}</td>
                            <td className="mono" style={{ textAlign: 'right', fontWeight: '700', color: 'var(--danger)' }}>Rs. {formatCurrency(row.BalanceAmount)}</td>
                          </tr>
                        );
                      }
                      return null;
                    })
                  )}
                </tbody>
                {salesReportData.length > 0 && (
                  <tfoot>
                    {(() => {
                      if (salesReportType === 'sales-reports') {
                        return (
                          <tr style={{ fontWeight: 'bold', background: 'rgba(255, 255, 255, 0.05)' }}>
                            <td colSpan={4}>TOTAL</td>
                            <td className="mono" style={{ textAlign: 'right' }}>Rs. {formatCurrency(salesReportData.reduce((acc, r) => acc + Number(r.Subtotal || 0), 0))}</td>
                            <td className="mono" style={{ textAlign: 'right', color: 'var(--warning)' }}>Rs. {formatCurrency(salesReportData.reduce((acc, r) => acc + Number(r.DiscountAmount || 0), 0))}</td>
                            <td className="mono" style={{ textAlign: 'right' }}>Rs. {formatCurrency(salesReportData.reduce((acc, r) => acc + Number(r.TaxAmount || 0), 0))}</td>
                            <td className="mono" style={{ textAlign: 'right', fontWeight: '700', color: 'var(--accent)' }}>Rs. {formatCurrency(salesReportData.reduce((acc, r) => acc + Number(r.TotalAmount || 0), 0))}</td>
                            <td></td>
                          </tr>
                        );
                      }
                      else if (salesReportType === 'daily-sales-summary' || salesReportType === 'monthly-sales-summary') {
                        return (
                          <tr style={{ fontWeight: 'bold', background: 'rgba(255, 255, 255, 0.05)' }}>
                            <td>TOTAL</td>
                            <td style={{ textAlign: 'center' }} className="mono">{salesReportData.reduce((acc, r) => acc + Number(r.InvoiceCount || 0), 0)}</td>
                            <td className="mono" style={{ textAlign: 'right' }}>Rs. {formatCurrency(salesReportData.reduce((acc, r) => acc + Number(r.Subtotal || 0), 0))}</td>
                            <td className="mono" style={{ textAlign: 'right' }}>Rs. {formatCurrency(salesReportData.reduce((acc, r) => acc + Number(r.DiscountAmount || 0), 0))}</td>
                            <td className="mono" style={{ textAlign: 'right' }}>Rs. {formatCurrency(salesReportData.reduce((acc, r) => acc + Number(r.TaxAmount || 0), 0))}</td>
                            <td className="mono" style={{ textAlign: 'right', fontWeight: '700' }}>Rs. {formatCurrency(salesReportData.reduce((acc, r) => acc + Number(r.TotalAmount || 0), 0))}</td>
                          </tr>
                        );
                      }
                      else if (salesReportType === 'sales-by-item' || salesReportType === 'top-selling' || salesReportType === 'slow-moving') {
                        return (
                          <tr style={{ fontWeight: 'bold', background: 'rgba(255, 255, 255, 0.05)' }}>
                            <td colSpan={2}>TOTAL</td>
                            <td style={{ textAlign: 'center' }} className="mono">{salesReportData.reduce((acc, r) => acc + Number(r.UnitsSold || 0), 0)}</td>
                            <td className="mono" style={{ textAlign: 'right', fontWeight: '700' }}>Rs. {formatCurrency(salesReportData.reduce((acc, r) => acc + Number(r.Subtotal || 0), 0))}</td>
                          </tr>
                        );
                      }
                      else if (salesReportType === 'sales-by-category' || salesReportType === 'sales-by-brand') {
                        return (
                          <tr style={{ fontWeight: 'bold', background: 'rgba(255, 255, 255, 0.05)' }}>
                            <td>TOTAL</td>
                            <td style={{ textAlign: 'center' }} className="mono">{salesReportData.reduce((acc, r) => acc + Number(r.UnitsSold || 0), 0)}</td>
                            <td className="mono" style={{ textAlign: 'right', fontWeight: '700' }}>Rs. {formatCurrency(salesReportData.reduce((acc, r) => acc + Number(r.Subtotal || 0), 0))}</td>
                          </tr>
                        );
                      }
                      else if (salesReportType === 'sales-by-customer') {
                        return (
                          <tr style={{ fontWeight: 'bold', background: 'rgba(255, 255, 255, 0.05)' }}>
                            <td colSpan={2}>TOTAL</td>
                            <td style={{ textAlign: 'center' }} className="mono">{salesReportData.reduce((acc, r) => acc + Number(r.InvoiceCount || 0), 0)}</td>
                            <td className="mono" style={{ textAlign: 'right' }}>Rs. {formatCurrency(salesReportData.reduce((acc, r) => acc + Number(r.Subtotal || 0), 0))}</td>
                            <td className="mono" style={{ textAlign: 'right' }}>Rs. {formatCurrency(salesReportData.reduce((acc, r) => acc + Number(r.DiscountAmount || 0), 0))}</td>
                            <td className="mono" style={{ textAlign: 'right' }}>Rs. {formatCurrency(salesReportData.reduce((acc, r) => acc + Number(r.TaxAmount || 0), 0))}</td>
                            <td className="mono" style={{ textAlign: 'right', fontWeight: '700', color: 'var(--accent)' }}>Rs. {formatCurrency(salesReportData.reduce((acc, r) => acc + Number(r.TotalAmount || 0), 0))}</td>
                          </tr>
                        );
                      }
                      else if (salesReportType === 'sales-by-salesperson') {
                        return (
                          <tr style={{ fontWeight: 'bold', background: 'rgba(255, 255, 255, 0.05)' }}>
                            <td>TOTAL</td>
                            <td style={{ textAlign: 'center' }} className="mono">{salesReportData.reduce((acc, r) => acc + Number(r.InvoiceCount || 0), 0)}</td>
                            <td className="mono" style={{ textAlign: 'right' }}>Rs. {formatCurrency(salesReportData.reduce((acc, r) => acc + Number(r.Subtotal || 0), 0))}</td>
                            <td className="mono" style={{ textAlign: 'right' }}>Rs. {formatCurrency(salesReportData.reduce((acc, r) => acc + Number(r.DiscountAmount || 0), 0))}</td>
                            <td className="mono" style={{ textAlign: 'right' }}>Rs. {formatCurrency(salesReportData.reduce((acc, r) => acc + Number(r.TaxAmount || 0), 0))}</td>
                            <td className="mono" style={{ textAlign: 'right', fontWeight: '700', color: 'var(--accent)' }}>Rs. {formatCurrency(salesReportData.reduce((acc, r) => acc + Number(r.TotalAmount || 0), 0))}</td>
                          </tr>
                        );
                      }
                      else if (salesReportType === 'sales-by-payment-method') {
                        return (
                          <tr style={{ fontWeight: 'bold', background: 'rgba(255, 255, 255, 0.05)' }}>
                            <td>TOTAL</td>
                            <td style={{ textAlign: 'center' }} className="mono">{salesReportData.reduce((acc, r) => acc + Number(r.InvoiceCount || 0), 0)}</td>
                            <td className="mono" style={{ textAlign: 'right', fontWeight: '700', color: 'var(--success)' }}>Rs. {formatCurrency(salesReportData.reduce((acc, r) => acc + Number(r.TotalAmount || 0), 0))}</td>
                          </tr>
                        );
                      }
                      else if (salesReportType === 'sales-by-branch-warehouse') {
                        return (
                          <tr style={{ fontWeight: 'bold', background: 'rgba(255, 255, 255, 0.05)' }}>
                            <td>TOTAL</td>
                            <td style={{ textAlign: 'center' }} className="mono">{salesReportData.reduce((acc, r) => acc + Number(r.QuantitySold || 0), 0)}</td>
                            <td className="mono" style={{ textAlign: 'right', fontWeight: '700', color: 'var(--success)' }}>Rs. {formatCurrency(salesReportData.reduce((acc, r) => acc + Number(r.TotalRevenue || 0), 0))}</td>
                          </tr>
                        );
                      }
                      else if (salesReportType === 'sales-by-hour') {
                        return (
                          <tr style={{ fontWeight: 'bold', background: 'rgba(255, 255, 255, 0.05)' }}>
                            <td>TOTAL</td>
                            <td style={{ textAlign: 'center' }} className="mono">{salesReportData.reduce((acc, r) => acc + Number(r.InvoiceCount || 0), 0)}</td>
                            <td className="mono" style={{ textAlign: 'right', fontWeight: '700', color: 'var(--success)' }}>Rs. {formatCurrency(salesReportData.reduce((acc, r) => acc + Number(r.TotalAmount || 0), 0))}</td>
                          </tr>
                        );
                      }
                      else if (salesReportType === 'sales-return') {
                        return (
                          <tr style={{ fontWeight: 'bold', background: 'rgba(255, 255, 255, 0.05)' }}>
                            <td colSpan={5}>TOTAL</td>
                            <td className="mono" style={{ textAlign: 'right' }}>Rs. {formatCurrency(salesReportData.reduce((acc, r) => acc + Number(r.Subtotal || 0), 0))}</td>
                            <td className="mono" style={{ textAlign: 'right', color: 'var(--warning)' }}>Rs. {formatCurrency(salesReportData.reduce((acc, r) => acc + Number(r.DiscountAmount || 0), 0))}</td>
                            <td className="mono" style={{ textAlign: 'right' }}>Rs. {formatCurrency(salesReportData.reduce((acc, r) => acc + Number(r.TaxAmount || 0), 0))}</td>
                            <td className="mono" style={{ textAlign: 'right', fontWeight: '700', color: 'var(--danger)' }}>Rs. {formatCurrency(salesReportData.reduce((acc, r) => acc + Number(r.TotalAmount || 0), 0))}</td>
                            <td></td>
                          </tr>
                        );
                      }
                      else if (salesReportType === 'discount-report') {
                        return (
                          <tr style={{ fontWeight: 'bold', background: 'rgba(255, 255, 255, 0.05)' }}>
                            <td colSpan={3}>TOTAL</td>
                            <td className="mono" style={{ textAlign: 'right' }}>Rs. {formatCurrency(salesReportData.reduce((acc, r) => acc + Number(r.OriginalSubtotal || 0), 0))}</td>
                            <td className="mono" style={{ textAlign: 'right', color: 'var(--danger)', fontWeight: '700' }}>-Rs. {formatCurrency(salesReportData.reduce((acc, r) => acc + Number(r.DiscountGiven || 0), 0))}</td>
                            <td className="mono" style={{ textAlign: 'right' }}>Rs. {formatCurrency(salesReportData.reduce((acc, r) => acc + Number(r.NetTotal || 0), 0))}</td>
                            <td></td>
                          </tr>
                        );
                      }
                      else if (salesReportType === 'tax-vat-report') {
                        return (
                          <tr style={{ fontWeight: 'bold', background: 'rgba(255, 255, 255, 0.05)' }}>
                            <td colSpan={2}>TOTAL</td>
                            <td className="mono" style={{ textAlign: 'right' }}>Rs. {formatCurrency(salesReportData.reduce((acc, r) => acc + Number(r.NetSales || 0), 0))}</td>
                            <td className="mono" style={{ textAlign: 'right', color: 'var(--accent)', fontWeight: '700' }}>Rs. {formatCurrency(salesReportData.reduce((acc, r) => acc + Number(r.TaxVAT || 0), 0))}</td>
                            <td className="mono" style={{ textAlign: 'right', fontWeight: '700' }}>Rs. {formatCurrency(salesReportData.reduce((acc, r) => acc + Number(r.GrossSales || 0), 0))}</td>
                          </tr>
                        );
                      }
                      else if (salesReportType === 'credit-sales-report') {
                        return (
                          <tr style={{ fontWeight: 'bold', background: 'rgba(255, 255, 255, 0.05)' }}>
                            <td colSpan={4}>TOTAL</td>
                            <td className="mono" style={{ textAlign: 'right' }}>Rs. {formatCurrency(salesReportData.reduce((acc, r) => acc + Number(r.OriginalCreditAmount || 0), 0))}</td>
                            <td className="mono" style={{ textAlign: 'right', color: 'var(--success)' }}>Rs. {formatCurrency(salesReportData.reduce((acc, r) => acc + Number(r.PaidAmount || 0), 0))}</td>
                            <td className="mono" style={{ textAlign: 'right', fontWeight: '700', color: 'var(--danger)' }}>Rs. {formatCurrency(salesReportData.reduce((acc, r) => acc + Number(r.BalanceAmount || 0), 0))}</td>
                          </tr>
                        );
                      }
                      return null;
                    })()}
                  </tfoot>
                )}
              </table>
            </div>
          )}

          {/* TAB 6: Profit Analysis Reports */}
          {activeTab === 'profit-reports' && (
            <div className="table-container">
              <table className="table-glass">
                <thead>
                  {(() => {
                    if (salesReportType === 'gross-profit-summary') {
                      return (
                        <tr>
                          <th>Period / Date</th>
                          <th style={{ textAlign: 'right' }}>Total Sales</th>
                          <th style={{ textAlign: 'right' }}>Discount Given</th>
                          <th style={{ textAlign: 'right' }}>Net Sales</th>
                          <th style={{ textAlign: 'right' }}>Cost of Sales</th>
                          <th style={{ textAlign: 'right' }}>Gross Profit</th>
                          <th style={{ textAlign: 'center' }}>GP %</th>
                        </tr>
                      );
                    }
                    else if (salesReportType === 'profit-by-item' || salesReportType === 'top-profitable-items' || salesReportType === 'lowest-profitable-items') {
                      return (
                        <tr>
                          <th>Product Name</th>
                          <th>SKU</th>
                          <th>Category</th>
                          <th>Brand</th>
                          <th style={{ textAlign: 'center' }}>Units Sold</th>
                          <th style={{ textAlign: 'right' }}>Total Revenue</th>
                          <th style={{ textAlign: 'right' }}>Cost of Sales</th>
                          <th style={{ textAlign: 'right' }}>Gross Profit</th>
                          <th style={{ textAlign: 'center' }}>GP %</th>
                        </tr>
                      );
                    }
                    else if (salesReportType === 'profit-by-category') {
                      return (
                        <tr>
                          <th>Category Name</th>
                          <th style={{ textAlign: 'center' }}>Units Sold</th>
                          <th style={{ textAlign: 'right' }}>Total Revenue</th>
                          <th style={{ textAlign: 'right' }}>Cost of Sales</th>
                          <th style={{ textAlign: 'right' }}>Gross Profit</th>
                          <th style={{ textAlign: 'center' }}>GP %</th>
                        </tr>
                      );
                    }
                    else if (salesReportType === 'profit-by-brand') {
                      return (
                        <tr>
                          <th>Brand Name</th>
                          <th style={{ textAlign: 'center' }}>Units Sold</th>
                          <th style={{ textAlign: 'right' }}>Total Revenue</th>
                          <th style={{ textAlign: 'right' }}>Cost of Sales</th>
                          <th style={{ textAlign: 'right' }}>Gross Profit</th>
                          <th style={{ textAlign: 'center' }}>GP %</th>
                        </tr>
                      );
                    }
                    else if (salesReportType === 'profit-by-customer') {
                      return (
                        <tr>
                          <th>Customer Name</th>
                          <th>Phone</th>
                          <th style={{ textAlign: 'center' }}>Invoice Count</th>
                          <th style={{ textAlign: 'right' }}>Net Sales</th>
                          <th style={{ textAlign: 'right' }}>Cost of Sales</th>
                          <th style={{ textAlign: 'right' }}>Gross Profit</th>
                          <th style={{ textAlign: 'center' }}>GP %</th>
                        </tr>
                      );
                    }
                    else if (salesReportType === 'profit-by-salesperson') {
                      return (
                        <tr>
                          <th>Salesperson Name</th>
                          <th style={{ textAlign: 'center' }}>Invoice Count</th>
                          <th style={{ textAlign: 'right' }}>Net Sales</th>
                          <th style={{ textAlign: 'right' }}>Cost of Sales</th>
                          <th style={{ textAlign: 'right' }}>Gross Profit</th>
                          <th style={{ textAlign: 'center' }}>GP %</th>
                        </tr>
                      );
                    }
                    else if (salesReportType === 'profit-by-invoice') {
                      return (
                        <tr>
                          <th>Invoice ID</th>
                          <th>Date / Time</th>
                          <th>Customer Name</th>
                          <th style={{ textAlign: 'right' }}>Total Sales</th>
                          <th style={{ textAlign: 'right' }}>Discount</th>
                          <th style={{ textAlign: 'right' }}>Net Sales</th>
                          <th style={{ textAlign: 'right' }}>Cost of Sales</th>
                          <th style={{ textAlign: 'right' }}>Gross Profit</th>
                          <th style={{ textAlign: 'center' }}>GP %</th>
                        </tr>
                      );
                    }
                    else if (salesReportType === 'negative-profit-report') {
                      return (
                        <tr>
                          <th>Invoice ID</th>
                          <th>Date / Time</th>
                          <th>Product Name</th>
                          <th style={{ textAlign: 'center' }}>Quantity</th>
                          <th style={{ textAlign: 'right' }}>Price</th>
                          <th style={{ textAlign: 'right' }}>Cost</th>
                          <th style={{ textAlign: 'right' }}>Net Revenue</th>
                          <th style={{ textAlign: 'right' }}>Total Cost</th>
                          <th style={{ textAlign: 'right' }}>Loss Amount</th>
                          <th>Cashier</th>
                        </tr>
                      );
                    }
                    return null;
                  })()}
                </thead>
                <tbody>
                  {salesReportData.length === 0 ? (
                    <tr>
                      <td colSpan={15} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                        No profit analysis records found for this criteria.
                      </td>
                    </tr>
                  ) : (
                    salesReportData.map((row, idx) => {
                      if (salesReportType === 'gross-profit-summary') {
                        return (
                          <tr key={idx}>
                            <td style={{ fontWeight: '600' }}>{row.DateStr}</td>
                            <td className="mono" style={{ textAlign: 'right' }}>Rs. {formatCurrency(row.TotalSales)}</td>
                            <td className="mono" style={{ textAlign: 'right', color: 'var(--danger)' }}>-Rs. {formatCurrency(row.DiscountAmount)}</td>
                            <td className="mono" style={{ textAlign: 'right' }}>Rs. {formatCurrency(row.NetSales)}</td>
                            <td className="mono" style={{ textAlign: 'right' }}>Rs. {formatCurrency(row.CostOfSales)}</td>
                            <td className="mono" style={{ textAlign: 'right', fontWeight: 'bold', color: 'var(--success)' }}>Rs. {formatCurrency(row.GrossProfit)}</td>
                            <td style={{ textAlign: 'center', fontWeight: '600' }}>{Number(row.GrossProfitPercent).toFixed(2)}%</td>
                          </tr>
                        );
                      }
                      else if (salesReportType === 'profit-by-item' || salesReportType === 'top-profitable-items' || salesReportType === 'lowest-profitable-items') {
                        return (
                          <tr key={idx}>
                            <td>
                              <a 
                                href="#" 
                                className="link-accent"
                                onClick={(e) => {
                                  e.preventDefault();
                                  setSelectedProductId(row.ProductID);
                                  setSalesReportType('profit-by-invoice');
                                }}
                              >
                                {row.ProductName}
                              </a>
                            </td>
                            <td className="mono">{row.SKU}</td>
                            <td>{row.CategoryName || 'N/A'}</td>
                            <td>{row.Brand || 'No Brand'}</td>
                            <td style={{ textAlign: 'center' }}>{Number(row.QuantitySold).toFixed(2)}</td>
                            <td className="mono" style={{ textAlign: 'right' }}>Rs. {formatCurrency(row.TotalRevenue)}</td>
                            <td className="mono" style={{ textAlign: 'right' }}>Rs. {formatCurrency(row.CostOfSales)}</td>
                            <td className="mono" style={{ textAlign: 'right', fontWeight: 'bold', color: row.GrossProfit >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                              Rs. {formatCurrency(row.GrossProfit)}
                            </td>
                            <td style={{ textAlign: 'center', fontWeight: '600' }}>{Number(row.GrossProfitPercent).toFixed(2)}%</td>
                          </tr>
                        );
                      }
                      else if (salesReportType === 'profit-by-category') {
                        return (
                          <tr key={idx}>
                            <td>
                              <a 
                                href="#" 
                                className="link-accent"
                                onClick={(e) => {
                                  e.preventDefault();
                                  setSelectedCategoryId(row.CategoryID);
                                  setSalesReportType('profit-by-item');
                                }}
                              >
                                {row.CategoryName}
                              </a>
                            </td>
                            <td style={{ textAlign: 'center' }}>{Number(row.QuantitySold).toFixed(2)}</td>
                            <td className="mono" style={{ textAlign: 'right' }}>Rs. {formatCurrency(row.TotalRevenue)}</td>
                            <td className="mono" style={{ textAlign: 'right' }}>Rs. {formatCurrency(row.CostOfSales)}</td>
                            <td className="mono" style={{ textAlign: 'right', fontWeight: 'bold', color: 'var(--success)' }}>Rs. {formatCurrency(row.GrossProfit)}</td>
                            <td style={{ textAlign: 'center', fontWeight: '600' }}>{Number(row.GrossProfitPercent).toFixed(2)}%</td>
                          </tr>
                        );
                      }
                      else if (salesReportType === 'profit-by-brand') {
                        return (
                          <tr key={idx}>
                            <td style={{ fontWeight: '600' }}>{row.Brand || 'No Brand'}</td>
                            <td style={{ textAlign: 'center' }}>{Number(row.QuantitySold).toFixed(2)}</td>
                            <td className="mono" style={{ textAlign: 'right' }}>Rs. {formatCurrency(row.TotalRevenue)}</td>
                            <td className="mono" style={{ textAlign: 'right' }}>Rs. {formatCurrency(row.CostOfSales)}</td>
                            <td className="mono" style={{ textAlign: 'right', fontWeight: 'bold', color: 'var(--success)' }}>Rs. {formatCurrency(row.GrossProfit)}</td>
                            <td style={{ textAlign: 'center', fontWeight: '600' }}>{Number(row.GrossProfitPercent).toFixed(2)}%</td>
                          </tr>
                        );
                      }
                      else if (salesReportType === 'profit-by-customer') {
                        return (
                          <tr key={idx}>
                            <td style={{ fontWeight: '600' }}>{row.CustomerName || 'Walk-in Customer'}</td>
                            <td>{row.Phone || '--'}</td>
                            <td style={{ textAlign: 'center' }}>{row.InvoiceCount}</td>
                            <td className="mono" style={{ textAlign: 'right' }}>Rs. {formatCurrency(row.NetSales)}</td>
                            <td className="mono" style={{ textAlign: 'right' }}>Rs. {formatCurrency(row.CostOfSales)}</td>
                            <td className="mono" style={{ textAlign: 'right', fontWeight: 'bold', color: 'var(--success)' }}>Rs. {formatCurrency(row.GrossProfit)}</td>
                            <td style={{ textAlign: 'center', fontWeight: '600' }}>{Number(row.GrossProfitPercent).toFixed(2)}%</td>
                          </tr>
                        );
                      }
                      else if (salesReportType === 'profit-by-salesperson') {
                        return (
                          <tr key={idx}>
                            <td style={{ fontWeight: '600' }}>{row.SalespersonName}</td>
                            <td style={{ textAlign: 'center' }}>{row.InvoiceCount}</td>
                            <td className="mono" style={{ textAlign: 'right' }}>Rs. {formatCurrency(row.NetSales)}</td>
                            <td className="mono" style={{ textAlign: 'right' }}>Rs. {formatCurrency(row.CostOfSales)}</td>
                            <td className="mono" style={{ textAlign: 'right', fontWeight: 'bold', color: 'var(--success)' }}>Rs. {formatCurrency(row.GrossProfit)}</td>
                            <td style={{ textAlign: 'center', fontWeight: '600' }}>{Number(row.GrossProfitPercent).toFixed(2)}%</td>
                          </tr>
                        );
                      }
                      else if (salesReportType === 'profit-by-invoice') {
                        return (
                          <tr key={idx}>
                            <td>
                              <a 
                                href="#" 
                                className="link-accent"
                                onClick={(e) => {
                                  e.preventDefault();
                                  handleInvoiceClick(row.OrderID);
                                }}
                              >
                                #SM-{row.OrderID}
                              </a>
                            </td>
                            <td>{new Date(row.OrderDate).toLocaleString('en-LK')}</td>
                            <td style={{ fontWeight: '600' }}>{row.CustomerName || 'Walk-in Customer'}</td>
                            <td className="mono" style={{ textAlign: 'right' }}>Rs. {formatCurrency(row.TotalSales)}</td>
                            <td className="mono" style={{ textAlign: 'right', color: 'var(--danger)' }}>-Rs. {formatCurrency(row.DiscountAmount)}</td>
                            <td className="mono" style={{ textAlign: 'right' }}>Rs. {formatCurrency(row.NetSales)}</td>
                            <td className="mono" style={{ textAlign: 'right' }}>Rs. {formatCurrency(row.CostOfSales)}</td>
                            <td className="mono" style={{ textAlign: 'right', fontWeight: 'bold', color: 'var(--success)' }}>Rs. {formatCurrency(row.GrossProfit)}</td>
                            <td style={{ textAlign: 'center', fontWeight: '600' }}>{Number(row.GrossProfitPercent).toFixed(2)}%</td>
                          </tr>
                        );
                      }
                      else if (salesReportType === 'negative-profit-report') {
                        return (
                          <tr key={idx}>
                            <td>
                              <a 
                                href="#" 
                                className="link-accent"
                                onClick={(e) => {
                                  e.preventDefault();
                                  handleInvoiceClick(row.OrderID);
                                }}
                              >
                                #SM-{row.OrderID}
                              </a>
                            </td>
                            <td>{new Date(row.OrderDate).toLocaleString('en-LK')}</td>
                            <td style={{ fontWeight: '600' }}>{row.ProductName}</td>
                            <td style={{ textAlign: 'center' }}>{Number(row.Quantity).toFixed(2)}</td>
                            <td className="mono" style={{ textAlign: 'right' }}>Rs. {formatCurrency(row.Price)}</td>
                            <td className="mono" style={{ textAlign: 'right' }}>Rs. {formatCurrency(row.Cost)}</td>
                            <td className="mono" style={{ textAlign: 'right' }}>Rs. {formatCurrency(row.NetRevenue)}</td>
                            <td className="mono" style={{ textAlign: 'right' }}>Rs. {formatCurrency(row.TotalCost)}</td>
                            <td className="mono" style={{ textAlign: 'right', fontWeight: 'bold', color: 'var(--danger)' }}>
                              -Rs. {formatCurrency(Math.abs(row.GrossProfit))}
                            </td>
                            <td>{row.CashierName}</td>
                          </tr>
                        );
                      }
                      return null;
                    })
                  )}
                </tbody>
                {salesReportData.length > 0 && (
                  <tfoot>
                    {(() => {
                      if (salesReportType === 'gross-profit-summary') {
                        const totalSales = salesReportData.reduce((acc, c) => acc + Number(c.TotalSales || 0), 0);
                        const discount = salesReportData.reduce((acc, c) => acc + Number(c.DiscountAmount || 0), 0);
                        const netSales = salesReportData.reduce((acc, c) => acc + Number(c.NetSales || 0), 0);
                        const cost = salesReportData.reduce((acc, c) => acc + Number(c.CostOfSales || 0), 0);
                        const profit = salesReportData.reduce((acc, c) => acc + Number(c.GrossProfit || 0), 0);
                        const gpPct = netSales > 0 ? (profit / netSales) * 100 : 0;
                        return (
                          <tr style={{ fontWeight: 'bold', background: 'rgba(255, 255, 255, 0.05)' }}>
                            <td>TOTAL</td>
                            <td className="mono" style={{ textAlign: 'right' }}>Rs. {formatCurrency(totalSales)}</td>
                            <td className="mono" style={{ textAlign: 'right', color: 'var(--danger)' }}>-Rs. {formatCurrency(discount)}</td>
                            <td className="mono" style={{ textAlign: 'right' }}>Rs. {formatCurrency(netSales)}</td>
                            <td className="mono" style={{ textAlign: 'right' }}>Rs. {formatCurrency(cost)}</td>
                            <td className="mono" style={{ textAlign: 'right', color: 'var(--success)' }}>Rs. {formatCurrency(profit)}</td>
                            <td style={{ textAlign: 'center' }}>{gpPct.toFixed(2)}%</td>
                          </tr>
                        );
                      }
                      else if (salesReportType === 'profit-by-item' || salesReportType === 'top-profitable-items' || salesReportType === 'lowest-profitable-items') {
                        const qty = salesReportData.reduce((acc, c) => acc + Number(c.QuantitySold || 0), 0);
                        const totalSales = salesReportData.reduce((acc, c) => acc + Number(c.TotalRevenue || 0), 0);
                        const cost = salesReportData.reduce((acc, c) => acc + Number(c.CostOfSales || 0), 0);
                        const profit = salesReportData.reduce((acc, c) => acc + Number(c.GrossProfit || 0), 0);
                        const gpPct = totalSales > 0 ? (profit / totalSales) * 100 : 0;
                        return (
                          <tr style={{ fontWeight: 'bold', background: 'rgba(255, 255, 255, 0.05)' }}>
                            <td colSpan={4}>TOTAL</td>
                            <td style={{ textAlign: 'center' }}>{qty.toFixed(2)}</td>
                            <td className="mono" style={{ textAlign: 'right' }}>Rs. {formatCurrency(totalSales)}</td>
                            <td className="mono" style={{ textAlign: 'right' }}>Rs. {formatCurrency(cost)}</td>
                            <td className="mono" style={{ textAlign: 'right', color: 'var(--success)' }}>Rs. {formatCurrency(profit)}</td>
                            <td style={{ textAlign: 'center' }}>{gpPct.toFixed(2)}%</td>
                          </tr>
                        );
                      }
                      else if (salesReportType === 'profit-by-category' || salesReportType === 'profit-by-brand') {
                        const qty = salesReportData.reduce((acc, c) => acc + Number(c.QuantitySold || 0), 0);
                        const totalSales = salesReportData.reduce((acc, c) => acc + Number(c.TotalRevenue || 0), 0);
                        const cost = salesReportData.reduce((acc, c) => acc + Number(c.CostOfSales || 0), 0);
                        const profit = salesReportData.reduce((acc, c) => acc + Number(c.GrossProfit || 0), 0);
                        const gpPct = totalSales > 0 ? (profit / totalSales) * 100 : 0;
                        return (
                          <tr style={{ fontWeight: 'bold', background: 'rgba(255, 255, 255, 0.05)' }}>
                            <td>TOTAL</td>
                            <td style={{ textAlign: 'center' }}>{qty.toFixed(2)}</td>
                            <td className="mono" style={{ textAlign: 'right' }}>Rs. {formatCurrency(totalSales)}</td>
                            <td className="mono" style={{ textAlign: 'right' }}>Rs. {formatCurrency(cost)}</td>
                            <td className="mono" style={{ textAlign: 'right', color: 'var(--success)' }}>Rs. {formatCurrency(profit)}</td>
                            <td style={{ textAlign: 'center' }}>{gpPct.toFixed(2)}%</td>
                          </tr>
                        );
                      }
                      else if (salesReportType === 'profit-by-customer') {
                        const count = salesReportData.reduce((acc, c) => acc + Number(c.InvoiceCount || 0), 0);
                        const netSales = salesReportData.reduce((acc, c) => acc + Number(c.NetSales || 0), 0);
                        const cost = salesReportData.reduce((acc, c) => acc + Number(c.CostOfSales || 0), 0);
                        const profit = salesReportData.reduce((acc, c) => acc + Number(c.GrossProfit || 0), 0);
                        const gpPct = netSales > 0 ? (profit / netSales) * 100 : 0;
                        return (
                          <tr style={{ fontWeight: 'bold', background: 'rgba(255, 255, 255, 0.05)' }}>
                            <td colSpan={2}>TOTAL</td>
                            <td style={{ textAlign: 'center' }}>{count}</td>
                            <td className="mono" style={{ textAlign: 'right' }}>Rs. {formatCurrency(netSales)}</td>
                            <td className="mono" style={{ textAlign: 'right' }}>Rs. {formatCurrency(cost)}</td>
                            <td className="mono" style={{ textAlign: 'right', color: 'var(--success)' }}>Rs. {formatCurrency(profit)}</td>
                            <td style={{ textAlign: 'center' }}>{gpPct.toFixed(2)}%</td>
                          </tr>
                        );
                      }
                      else if (salesReportType === 'profit-by-salesperson') {
                        const count = salesReportData.reduce((acc, c) => acc + Number(c.InvoiceCount || 0), 0);
                        const netSales = salesReportData.reduce((acc, c) => acc + Number(c.NetSales || 0), 0);
                        const cost = salesReportData.reduce((acc, c) => acc + Number(c.CostOfSales || 0), 0);
                        const profit = salesReportData.reduce((acc, c) => acc + Number(c.GrossProfit || 0), 0);
                        const gpPct = netSales > 0 ? (profit / netSales) * 100 : 0;
                        return (
                          <tr style={{ fontWeight: 'bold', background: 'rgba(255, 255, 255, 0.05)' }}>
                            <td>TOTAL</td>
                            <td style={{ textAlign: 'center' }}>{count}</td>
                            <td className="mono" style={{ textAlign: 'right' }}>Rs. {formatCurrency(netSales)}</td>
                            <td className="mono" style={{ textAlign: 'right' }}>Rs. {formatCurrency(cost)}</td>
                            <td className="mono" style={{ textAlign: 'right', color: 'var(--success)' }}>Rs. {formatCurrency(profit)}</td>
                            <td style={{ textAlign: 'center' }}>{gpPct.toFixed(2)}%</td>
                          </tr>
                        );
                      }
                      else if (salesReportType === 'profit-by-invoice') {
                        const grossSales = salesReportData.reduce((acc, c) => acc + Number(c.TotalSales || 0), 0);
                        const discount = salesReportData.reduce((acc, c) => acc + Number(c.DiscountAmount || 0), 0);
                        const netSales = salesReportData.reduce((acc, c) => acc + Number(c.NetSales || 0), 0);
                        const cost = salesReportData.reduce((acc, c) => acc + Number(c.CostOfSales || 0), 0);
                        const profit = salesReportData.reduce((acc, c) => acc + Number(c.GrossProfit || 0), 0);
                        const gpPct = netSales > 0 ? (profit / netSales) * 100 : 0;
                        return (
                          <tr style={{ fontWeight: 'bold', background: 'rgba(255, 255, 255, 0.05)' }}>
                            <td colSpan={3}>TOTAL</td>
                            <td className="mono" style={{ textAlign: 'right' }}>Rs. {formatCurrency(grossSales)}</td>
                            <td className="mono" style={{ textAlign: 'right', color: 'var(--danger)' }}>-Rs. {formatCurrency(discount)}</td>
                            <td className="mono" style={{ textAlign: 'right' }}>Rs. {formatCurrency(netSales)}</td>
                            <td className="mono" style={{ textAlign: 'right' }}>Rs. {formatCurrency(cost)}</td>
                            <td className="mono" style={{ textAlign: 'right', color: 'var(--success)' }}>Rs. {formatCurrency(profit)}</td>
                            <td style={{ textAlign: 'center' }}>{gpPct.toFixed(2)}%</td>
                          </tr>
                        );
                      }
                      else if (salesReportType === 'negative-profit-report') {
                        const qty = salesReportData.reduce((acc, c) => acc + Number(c.Quantity || 0), 0);
                        const netSales = salesReportData.reduce((acc, c) => acc + Number(c.NetRevenue || 0), 0);
                        const cost = salesReportData.reduce((acc, c) => acc + Number(c.TotalCost || 0), 0);
                        const profit = salesReportData.reduce((acc, c) => acc + Number(c.GrossProfit || 0), 0);
                        return (
                          <tr style={{ fontWeight: 'bold', background: 'rgba(255, 255, 255, 0.05)' }}>
                            <td colSpan={3}>TOTAL</td>
                            <td style={{ textAlign: 'center' }}>{qty.toFixed(2)}</td>
                            <td colSpan={2}></td>
                            <td className="mono" style={{ textAlign: 'right' }}>Rs. {formatCurrency(netSales)}</td>
                            <td className="mono" style={{ textAlign: 'right' }}>Rs. {formatCurrency(cost)}</td>
                            <td className="mono" style={{ textAlign: 'right', color: 'var(--danger)' }}>Rs. {formatCurrency(profit)}</td>
                            <td></td>
                          </tr>
                        );
                      }
                      return null;
                    })()}
                  </tfoot>
                )}
              </table>
            </div>
          )}

          {/* TAB 7: Operational KPI Dashboard */}
          {activeTab === 'kpi-dashboard' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* KPI Cards Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                <div className="glass-panel" style={{ padding: '20px', position: 'relative' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Sales (Gross)</div>
                  <div className="mono" style={{ fontSize: '24px', fontWeight: 'bold', marginTop: '8px', color: 'var(--text-primary)' }}>
                    Rs. {formatCurrency(kpiMetrics.TotalSales)}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Before manual discounts</div>
                </div>

                <div className="glass-panel" style={{ padding: '20px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Discounts Awarded</div>
                  <div className="mono" style={{ fontSize: '24px', fontWeight: 'bold', marginTop: '8px', color: 'var(--danger)' }}>
                    -Rs. {formatCurrency(kpiMetrics.DiscountAmount)}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Total promo / item / order deductions</div>
                </div>

                <div className="glass-panel" style={{ padding: '20px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Net Sales</div>
                  <div className="mono" style={{ fontSize: '24px', fontWeight: 'bold', marginTop: '8px', color: 'var(--primary)' }}>
                    Rs. {formatCurrency(kpiMetrics.NetSales)}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Realized operating revenue</div>
                </div>

                <div className="glass-panel" style={{ padding: '20px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cost of Sales (COGS)</div>
                  <div className="mono" style={{ fontSize: '24px', fontWeight: 'bold', marginTop: '8px', color: 'var(--text-secondary)' }}>
                    Rs. {formatCurrency(kpiMetrics.CostOfSales)}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>FIFO/system inventory cost</div>
                </div>

                <div className="glass-panel" style={{ padding: '20px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Gross Profit</div>
                  <div className="mono" style={{ fontSize: '24px', fontWeight: 'bold', marginTop: '8px', color: 'var(--success)' }}>
                    Rs. {formatCurrency(kpiMetrics.GrossProfit)}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Net Revenue minus Cost</div>
                </div>

                <div className="glass-panel" style={{ padding: '20px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Gross Profit %</div>
                  <div className="mono" style={{ fontSize: '24px', fontWeight: 'bold', marginTop: '8px', color: 'var(--accent)' }}>
                    {Number(kpiMetrics.GrossProfitPercent).toFixed(2)}%
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Profit margin ratio</div>
                </div>
              </div>

              {/* Volume Metrics row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                <div className="glass-panel" style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Units Sold</div>
                    <div className="mono" style={{ fontSize: '20px', fontWeight: 'bold', marginTop: '4px' }}>{Number(kpiMetrics.TotalQuantitySold).toFixed(2)}</div>
                  </div>
                </div>
                <div className="glass-panel" style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Invoice Count</div>
                    <div className="mono" style={{ fontSize: '20px', fontWeight: 'bold', marginTop: '4px' }}>{kpiMetrics.NumberOfInvoices}</div>
                  </div>
                </div>
                <div className="glass-panel" style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Average Ticket Value</div>
                    <div className="mono" style={{ fontSize: '20px', fontWeight: 'bold', marginTop: '4px' }}>Rs. {formatCurrency(kpiMetrics.AverageInvoiceValue)}</div>
                  </div>
                </div>
                <div className="glass-panel" style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Average Profit / Invoice</div>
                    <div className="mono" style={{ fontSize: '20px', fontWeight: 'bold', marginTop: '4px', color: 'var(--success)' }}>Rs. {formatCurrency(kpiMetrics.AverageProfitPerInvoice)}</div>
                  </div>
                </div>
              </div>

              {/* Trend Chart and Best Performing Categories */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                
                {/* SVG Trend Line Chart */}
                <div className="glass-panel" style={{ padding: '20px' }}>
                  <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: 600 }}>Net Sales & Profit Trend (Daily/Monthly)</h4>
                  {kpiTrends.length === 0 ? (
                    <div style={{ height: '240px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                      No trend data available for this range
                    </div>
                  ) : (() => {
                    const maxVal = Math.max(...kpiTrends.map(t => Math.max(t.NetSales, t.GrossProfit, 100)));
                    const pointsSales = kpiTrends.map((t, idx) => {
                      const x = (idx / Math.max(kpiTrends.length - 1, 1)) * 370 + 70;
                      const y = 200 - (t.NetSales / maxVal) * 160;
                      return `${x},${y}`;
                    }).join(' ');

                    const pointsProfit = kpiTrends.map((t, idx) => {
                      const x = (idx / Math.max(kpiTrends.length - 1, 1)) * 370 + 70;
                      const y = 200 - (t.GrossProfit / maxVal) * 160;
                      return `${x},${y}`;
                    }).join(' ');

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <svg viewBox="0 0 480 240" style={{ width: '100%', height: '220px' }}>
                          {/* Grid Lines */}
                          <line x1="70" y1="40" x2="440" y2="40" stroke="var(--border-color)" strokeWidth="0.5" strokeDasharray="4 4" />
                          <line x1="70" y1="120" x2="440" y2="120" stroke="var(--border-color)" strokeWidth="0.5" strokeDasharray="4 4" />
                          <line x1="70" y1="200" x2="440" y2="200" stroke="var(--border-color)" strokeWidth="1" />
                          
                          {/* Line Paths */}
                          <polyline fill="none" stroke="var(--primary)" strokeWidth="3" points={pointsSales} />
                          <polyline fill="none" stroke="var(--success)" strokeWidth="3" points={pointsProfit} />

                          {/* Data points */}
                          {kpiTrends.map((t, idx) => {
                            const x = (idx / Math.max(kpiTrends.length - 1, 1)) * 370 + 70;
                            const ySales = 200 - (t.NetSales / maxVal) * 160;
                            const yProfit = 200 - (t.GrossProfit / maxVal) * 160;
                            return (
                              <g key={idx}>
                                <circle cx={x} cy={ySales} r="4" fill="var(--primary)" />
                                <circle cx={x} cy={yProfit} r="4" fill="var(--success)" />
                              </g>
                            );
                          })}

                          {/* Labels */}
                          <text x="65" y="45" fontSize="9" textAnchor="end" fill="var(--text-secondary)">Rs. {formatCurrency(maxVal)}</text>
                          <text x="65" y="125" fontSize="9" textAnchor="end" fill="var(--text-secondary)">Rs. {formatCurrency(maxVal / 2)}</text>
                          <text x="65" y="205" fontSize="9" textAnchor="end" fill="var(--text-secondary)">0</text>

                          {/* X labels (Dates) */}
                          {kpiTrends.map((t, idx) => {
                            if (kpiTrends.length > 8 && idx % Math.ceil(kpiTrends.length / 5) !== 0) return null;
                            const x = (idx / Math.max(kpiTrends.length - 1, 1)) * 370 + 70;
                            return (
                              <text key={idx} x={x} y="220" fontSize="9" textAnchor="middle" fill="var(--text-secondary)">
                                {t.DateStr.substring(5)}
                              </text>
                            );
                          })}
                        </svg>
                        <div style={{ display: 'flex', gap: '16px', fontSize: '11px', marginTop: '8px' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ display: 'inline-block', width: '12px', height: '3px', background: 'var(--primary)' }}></span>
                            Net Sales
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ display: 'inline-block', width: '12px', height: '3px', background: 'var(--success)' }}></span>
                            Gross Profit
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Best Selling Categories Horizontal Bar List */}
                <div className="glass-panel" style={{ padding: '20px' }}>
                  <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: 600 }}>Best Selling Categories</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {kpiTopCategories.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                        No category data found
                      </div>
                    ) : (() => {
                      const maxQty = Math.max(...kpiTopCategories.map(c => c.QuantitySold, 1));
                      return kpiTopCategories.map((c, idx) => {
                        const pct = (c.QuantitySold / maxQty) * 100;
                        return (
                          <div key={idx}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                              <span>{c.CategoryName}</span>
                              <strong>{Number(c.QuantitySold).toFixed(2)} units <span style={{ color: 'var(--text-muted)', fontWeight: 'normal' }}>(Rs. {formatCurrency(c.TotalRevenue)})</span></strong>
                            </div>
                            <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                              <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, var(--primary), var(--accent))', borderRadius: '4px' }}></div>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              </div>

              {/* Top 10 Products Horizontal styled bar gauges */}
              <div className="glass-panel" style={{ padding: '20px' }}>
                <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: 600 }}>Top Selling Products & Net Profit contribution</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {kpiTopProducts.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                      No product sales logs found
                    </div>
                  ) : (() => {
                    const maxRev = Math.max(...kpiTopProducts.map(p => p.TotalRevenue, 1));
                    return kpiTopProducts.map((p, idx) => {
                      const pct = (p.TotalRevenue / maxRev) * 100;
                      return (
                        <div key={idx} style={{ display: 'grid', gridTemplateColumns: '220px 1fr 160px', alignItems: 'center', gap: '16px' }}>
                          <div style={{ fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.ProductName}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ flex: 1, height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                              <div style={{ width: `${pct}%`, height: '100%', background: 'var(--accent)', borderRadius: '4px' }}></div>
                            </div>
                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }} className="mono">{Number(p.QuantitySold).toFixed(2)} units</span>
                          </div>
                          <div style={{ textAlign: 'right', fontSize: '12px' }}>
                            <span style={{ marginRight: '8px' }} className="mono">Rs. {formatCurrency(p.TotalRevenue)}</span>
                            <strong style={{ color: 'var(--success)' }} className="mono">Rs. {formatCurrency(p.GrossProfit)}</strong>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* Top Customer Loyalty and Performer tables */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                
                {/* Top Customers list */}
                <div className="glass-panel" style={{ padding: '20px' }}>
                  <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: 600 }}>Top Customers (Net Revenue & Profit Contribution)</h4>
                  <div className="table-container">
                    <table className="table-glass" style={{ fontSize: '12px' }}>
                      <thead>
                        <tr>
                          <th>Customer</th>
                          <th style={{ textAlign: 'center' }}>Invoices</th>
                          <th style={{ textAlign: 'right' }}>Revenue</th>
                          <th style={{ textAlign: 'right' }}>Profit Contribution</th>
                        </tr>
                      </thead>
                      <tbody>
                        {kpiTopCustomers.length === 0 ? (
                          <tr>
                            <td colSpan="4" style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)' }}>No customer data found</td>
                          </tr>
                        ) : (
                          kpiTopCustomers.map((c, idx) => (
                            <tr key={idx}>
                              <td><strong>{c.CustomerName}</strong></td>
                              <td style={{ textAlign: 'center' }} className="mono">{c.InvoiceCount}</td>
                              <td style={{ textAlign: 'right' }} className="mono">Rs. {formatCurrency(c.NetSales)}</td>
                              <td style={{ textAlign: 'right', color: 'var(--success)', fontWeight: 'bold' }} className="mono">Rs. {formatCurrency(c.GrossProfit)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Best Performing Salespersons */}
                <div className="glass-panel" style={{ padding: '20px' }}>
                  <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: 600 }}>Best Performing Salespersons / Cashiers</h4>
                  <div className="table-container">
                    <table className="table-glass" style={{ fontSize: '12px' }}>
                      <thead>
                        <tr>
                          <th>Salesperson</th>
                          <th style={{ textAlign: 'center' }}>Invoices</th>
                          <th style={{ textAlign: 'right' }}>Revenue</th>
                          <th style={{ textAlign: 'right' }}>Profit Realized</th>
                        </tr>
                      </thead>
                      <tbody>
                        {kpiTopSalespersons.length === 0 ? (
                          <tr>
                            <td colSpan="4" style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)' }}>No user performance logged</td>
                          </tr>
                        ) : (
                          kpiTopSalespersons.map((u, idx) => (
                            <tr key={idx}>
                              <td><strong>{u.SalespersonName}</strong></td>
                              <td style={{ textAlign: 'center' }} className="mono">{u.InvoiceCount}</td>
                              <td style={{ textAlign: 'right' }} className="mono">Rs. {formatCurrency(u.NetSales)}</td>
                              <td style={{ textAlign: 'right', color: 'var(--success)', fontWeight: 'bold' }} className="mono">Rs. {formatCurrency(u.GrossProfit)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>

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
      <PrintPreviewModal 
        show={previewConfig.show}
        onClose={() => setPreviewConfig(prev => ({ ...prev, show: false }))}
        title={previewConfig.title}
        companyInfo={companyInfo}
        filters={{
          'Date Range': datePreset !== 'custom' ? datePreset : `${startDate} to ${endDate}`,
          'Branch/Warehouse': branchFilter || null,
          'Selected Product': selectedProductId ? productList.find(p => p.ProductID == selectedProductId)?.Name : null,
          'Selected Category': selectedCategoryId ? categoryList.find(c => c.CategoryID == selectedCategoryId)?.Name : null,
          'Selected Brand': selectedBrand || null,
          'Selected Customer': selectedCustomerId ? customerList.find(c => c.CustomerID == selectedCustomerId)?.Name : null,
          'Selected Salesperson': selectedUserId ? salespersonList.find(u => u.UserID == selectedUserId)?.Username : null
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
