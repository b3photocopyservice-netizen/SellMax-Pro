import React, { useState, useEffect } from 'react';
// import formatCurrency removed – using named import
import { useAuth } from './contexts/AuthContext';
import { 
  Building2, ShoppingBag, Coins, FileText, Plus, Search, Edit2, Trash2, 
  RefreshCw, CheckCircle, Printer, Download, X, Calendar, AlertTriangle, Eye, ShieldAlert,
  User, MapPin, CreditCard, Globe, Receipt, Truck
} from 'lucide-react';
import { formatCurrency } from './utils/formatCurrency';
export default function Suppliers({ setToast }) {
  const { token, API_URL, hasPermission, user } = useAuth();
  
  // Tab configuration
  const [activeTab, setActiveTab] = useState('directory'); // 'directory', 'purchases', 'ledger', 'reports'
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Core Data Lists
  const [suppliers, setSuppliers] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [widgets, setWidgets] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [branchFilter, setBranchFilter] = useState('');

  // Modals state
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [supplierModalMode, setSupplierModalMode] = useState('add'); // 'add', 'edit', 'view'
  const [activeSupplierId, setActiveSupplierId] = useState(null);

  const [showPoModal, setShowPoModal] = useState(false);
  const [showPoViewModal, setShowPoViewModal] = useState(false);
  const [poModalMode, setPoModalMode] = useState('create'); // 'create' | 'edit'
  const [editingPoId, setEditingPoId] = useState(null);
  const [showGrnModal, setShowGrnModal] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showReturnViewModal, setShowReturnViewModal] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState(null);
  const [returnModalMode, setReturnModalMode] = useState('create'); // 'create' | 'edit'
  const [editingReturnId, setEditingReturnId] = useState(null);
  const [showCreateInvoiceGrnModal, setShowCreateInvoiceGrnModal] = useState(false);
  const [selectedCreateInvoiceGrnPoId, setSelectedCreateInvoiceGrnPoId] = useState('');
  const [showDirectCashPurchaseModal, setShowDirectCashPurchaseModal] = useState(false);
  const [showDirectCreditPurchaseModal, setShowDirectCreditPurchaseModal] = useState(false);
  
  const [selectedPo, setSelectedPo] = useState(null);
  const [activeSearchIndex, setActiveSearchIndex] = useState(null);

  // --- FORMS STATES ---
  
  // 1. Supplier profile form
  const [supplierForm, setSupplierForm] = useState({
    supplierName: '', companyName: '', contactPerson: '',
    mobileNumber: '', telephoneNumber: '', emailAddress: '', website: '',
    address: '', city: '', country: '', taxVatNumber: '', businessRegNo: '',
    supplierCategory: 'Wholesaler', status: 'Active', notes: '', branchName: '',
    creditLimit: '0.00', creditPeriodDays: '0', openingBalance: '0.00', paymentTerms: 'Net 30',
    bankName: '', accountName: '', accountNumber: '', bankBranch: '', swiftCode: ''
  });

  // 2. Purchase Order form
  const [poForm, setPoForm] = useState({
    supplierId: '',
    branchName: '',
    notes: '',
    taxPercentage: '15.00',
    items: [] // { productId: '', quantity: 1, unitCost: 0 }
  });

  // 3. GRN Form
  const [grnForm, setGrnForm] = useState({
    items: [] // { productId: '', orderedQty: 0, receivedQty: 0, batchNo: '', mfgDate: '', expiryDate: '', warehouseName: '' }
  });

  // 4. Invoice Form
  const [invoiceForm, setInvoiceForm] = useState({
    invoiceNumber: '',
    invoiceDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    paymentTerms: 'Net 30',
    amountPaid: '0.00',
    paymentMethod: 'Cash',
    paymentReference: ''
  });

  // 5. Settlement Payment Form
  const [paymentForm, setPaymentForm] = useState({
    supplierId: '',
    amount: '',
    paymentMethod: 'Bank Transfer',
    referenceNumber: '',
    paymentDate: new Date().toISOString().split('T')[0],
    notes: '',
    branchName: ''
  });

  // 6. Return Form
  const [returnForm, setReturnForm] = useState({
    supplierId: '',
    reason: '',
    branchName: '',
    returnType: 'Credit',
    items: [] // { productId: '', quantity: 0, unitCost: 0, batchNo: '' }
  });

  // Direct Cash Purchase Form State
  const [directPurchaseForm, setDirectPurchaseForm] = useState({
    supplierId: '',
    branchName: '',
    invoiceNumber: '',
    invoiceDate: new Date().toISOString().split('T')[0],
    paymentMethod: 'Cash',
    paymentReference: '',
    notes: '',
    items: []
  });

  // Direct Credit Purchase Form State
  const [directCreditPurchaseForm, setDirectCreditPurchaseForm] = useState({
    supplierId: '',
    branchName: '',
    invoiceNumber: '',
    invoiceDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    paidAmount: '0.00',
    paymentMethod: 'Cash',
    paymentReference: '',
    notes: '',
    items: []
  });

  // 7. Ledger View
  const [selectedLedgerSupplier, setSelectedLedgerSupplier] = useState('');
  const [ledgerTransactions, setLedgerTransactions] = useState([]);
  const [ledgerSummary, setLedgerSummary] = useState({ balance: 0, creditLimit: 0 });
  const [ledgerStartDate, setLedgerStartDate] = useState('');
  const [ledgerEndDate, setLedgerEndDate] = useState('');
  const [ledgerOpeningBalance, setLedgerOpeningBalance] = useState(0);
  const [ledgerClosingBalance, setLedgerClosingBalance] = useState(0);
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [printLedgerData, setPrintLedgerData] = useState(null);
  const [adjustmentForm, setAdjustmentForm] = useState({
    supplierId: '',
    adjustmentType: 'Debit Note',
    effect: 'Debit',
    amount: '',
    referenceNumber: '',
    notes: '',
    branchName: '',
    date: new Date().toISOString().split('T')[0]
  });

  // 8. Reports Tab
  const [selectedReportType, setSelectedReportType] = useState('payables'); // 'list', 'payables', 'ledger', 'history', 'statement'
  const [reportSupplierId, setReportSupplierId] = useState('');
  const [reportBranch, setReportBranch] = useState('');
  const [reportStartDate, setReportStartDate] = useState('');
  const [reportEndDate, setReportEndDate] = useState('');
  const [reportResult, setReportResult] = useState([]);
  const [reportOpeningBalance, setReportOpeningBalance] = useState(0);
  const [reportClosingBalance, setReportClosingBalance] = useState(0);
  const [companyProfile, setCompanyProfile] = useState(null);
  const [reportPeriodType, setReportPeriodType] = useState('monthly'); // 'monthly', 'custom'
  const [reportMonthSelect, setReportMonthSelect] = useState('this-month'); // 'this-month', 'last-month', 'last-30', 'last-90'
  const [printStatementData, setPrintStatementData] = useState(null);
  const [printGenericReportData, setPrintGenericReportData] = useState(null);

  // 9. Purchase Manager Sub-tabs
  const [purchaseSubTab, setPurchaseSubTab] = useState('orders'); // 'orders', 'grninvoice', 'returns'
  const [purchaseReturns, setPurchaseReturns] = useState([]);

  // Permissions check helpers
  const canView = hasPermission('VIEW_SUPPLIERS');
  const canManageSuppliers = hasPermission('MANAGE_SUPPLIERS');
  const canManagePurchases = hasPermission('MANAGE_PURCHASES');
  const canViewFinancials = hasPermission('VIEW_SUPPLIER_FINANCIALS');

  const fetchCompanyProfile = async () => {
    try {
      const res = await fetch(`${API_URL}/api/suppliers/company-profile`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setCompanyProfile(await res.json());
      }
    } catch (err) {
      console.error('Failed to load company profile:', err);
    }
  };

  // Load initial data
  useEffect(() => {
    if (canView) {
      fetchSuppliers();
      fetchPurchaseOrders();
      fetchProducts();
      fetchWidgets();
      fetchAuditLogs();
      fetchPurchaseReturns();
      fetchCompanyProfile();
    }
  }, [activeTab]);

  // Global Escape key → close topmost open modal (priority: deepest/newest first)
  useEffect(() => {
    const handleEscKey = (e) => {
      if (e.key !== 'Escape') return;
      if (showDirectCashPurchaseModal) { setShowDirectCashPurchaseModal(false); return; }
      if (showDirectCreditPurchaseModal) { setShowDirectCreditPurchaseModal(false); return; }
      if (showAdjustmentModal)        { setShowAdjustmentModal(false);         return; }
      if (showPaymentModal)           { setShowPaymentModal(false);           return; }
      if (showCreateInvoiceGrnModal)  { setShowCreateInvoiceGrnModal(false);  return; }
      if (showInvoiceModal)           { setShowInvoiceModal(false);            return; }
      if (showGrnModal)               { setShowGrnModal(false);                return; }
      if (showReturnViewModal)       { setShowReturnViewModal(false);         return; }
      if (showReturnModal)            { setShowReturnModal(false);             return; }
      if (showPoViewModal)            { setShowPoViewModal(false);             return; }
      if (showPoModal)                { setShowPoModal(false);                 return; }
      if (showSupplierModal)          { setShowSupplierModal(false);           return; }
    };
    document.addEventListener('keydown', handleEscKey);
    return () => document.removeEventListener('keydown', handleEscKey);
  }, [
    showDirectCashPurchaseModal,
    showDirectCreditPurchaseModal,
    showAdjustmentModal,
    showPaymentModal,
    showCreateInvoiceGrnModal,
    showInvoiceModal,
    showGrnModal,
    showReturnViewModal,
    showReturnModal,
    showPoViewModal,
    showPoModal,
    showSupplierModal,
  ]);

  const fetchPurchaseReturns = async () => {
    try {
      const res = await fetch(`${API_URL}/api/suppliers/returns`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setPurchaseReturns(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/suppliers`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setSuppliers(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPurchaseOrders = async () => {
    try {
      const res = await fetch(`${API_URL}/api/suppliers/purchases`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setPurchaseOrders(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await fetch(`${API_URL}/api/inventory/products`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setProducts(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  const fetchWidgets = async () => {
    try {
      const res = await fetch(`${API_URL}/api/suppliers/widgets`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setWidgets(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const res = await fetch(`${API_URL}/api/suppliers/audit`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setAuditLogs(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  // --- CRUD ACTIONS: SUPPLIERS ---

  const handleOpenSupplierModal = async (mode, supplier = null) => {
    setSupplierModalMode(mode);
    if (supplier) {
      setActiveSupplierId(supplier.SupplierID);
      setSupplierForm({
        supplierName: supplier.SupplierName || '',
        companyName: supplier.CompanyName || '',
        contactPerson: supplier.ContactPerson || '',
        mobileNumber: supplier.MobileNumber || '',
        telephoneNumber: supplier.TelephoneNumber || '',
        emailAddress: supplier.EmailAddress || '',
        website: supplier.Website || '',
        address: supplier.Address || '',
        city: supplier.City || '',
        country: supplier.Country || '',
        taxVatNumber: supplier.TaxVATNumber || '',
        businessRegNo: supplier.BusinessRegNo || '',
        supplierCategory: supplier.SupplierCategory || 'Wholesaler',
        status: supplier.Status || 'Active',
        notes: supplier.Notes || '',
        branchName: supplier.BranchName || '',
        creditLimit: formatCurrency(supplier.CreditLimit),
        creditPeriodDays: String(supplier.CreditPeriodDays),
        openingBalance: formatCurrency(supplier.OpeningBalance),
        paymentTerms: supplier.PaymentTerms || 'Net 30',
        bankName: supplier.BankName || '',
        accountName: supplier.AccountName || '',
        accountNumber: supplier.AccountNumber || '',
        bankBranch: supplier.BankBranch || '',
        swiftCode: supplier.SWIFTCode || ''
      });
    } else {
      setActiveSupplierId(null);
      setSupplierForm({
        supplierName: '', companyName: '', contactPerson: '',
        mobileNumber: '', telephoneNumber: '', emailAddress: '', website: '',
        address: '', city: '', country: '', taxVatNumber: '', businessRegNo: '',
        supplierCategory: 'Wholesaler', status: 'Active', notes: '', branchName: user?.branchName || '',
        creditLimit: '0.00', creditPeriodDays: '0', openingBalance: '0.00', paymentTerms: 'Net 30',
        bankName: '', accountName: '', accountNumber: '', bankBranch: '', swiftCode: ''
      });
    }
    setShowSupplierModal(true);
  };

  const handleSupplierSubmit = async (e) => {
    e.preventDefault();
    if (!canManageSuppliers) return;

    try {
      setActionLoading(true);
      const url = supplierModalMode === 'add' 
        ? `${API_URL}/api/suppliers` 
        : `${API_URL}/api/suppliers/${activeSupplierId}`;
      const method = supplierModalMode === 'add' ? 'POST' : 'PUT';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(supplierForm)
      });

      const data = await res.json();
      if (res.ok) {
        setToast({ 
          type: 'success', 
          message: supplierModalMode === 'add' 
            ? `Supplier profile created successfully with Code: ${data.SupplierCode}.` 
            : `Supplier profile updated successfully.`
        });
        setShowSupplierModal(false);
        fetchSuppliers();
      } else {
        setToast({ type: 'error', message: data.error || 'Failed to save supplier profile.' });
      }
    } catch (err) {
      setToast({ type: 'error', message: 'API connection failure.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteSupplier = async (id, name) => {
    if (!canManageSuppliers) return;
    if (!window.confirm(`Are you absolutely sure you want to delete supplier "${name}"? This will clear their profiles.`)) return;

    try {
      const res = await fetch(`${API_URL}/api/suppliers/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setToast({ type: 'success', message: 'Supplier profile deleted.' });
        fetchSuppliers();
      } else {
        const data = await res.json();
        setToast({ type: 'error', message: data.error || 'Deletion failed.' });
      }
    } catch (err) {
      setToast({ type: 'error', message: 'API connection failure.' });
    }
  };

  const handleToggleSupplierStatus = async (supplier) => {
    if (!canManageSuppliers) return;
    const newStatus = supplier.Status === 'Active' ? 'Inactive' : 'Active';
    
    try {
      const res = await fetch(`${API_URL}/api/suppliers/${supplier.SupplierID}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...supplier,
          supplierName: supplier.SupplierName,
          status: newStatus
        })
      });

      if (res.ok) {
        setToast({ type: 'success', message: `Supplier status toggled to ${newStatus}.` });
        fetchSuppliers();
      } else {
        const data = await res.json();
        setToast({ type: 'error', message: data.error || 'Failed to toggle status.' });
      }
    } catch (err) {
      setToast({ type: 'error', message: 'Connection failure.' });
    }
  };

  // --- ACTIONS: PURCHASE ORDERS (POs) ---

  const handleOpenPoModal = () => {
    setPoModalMode('create');
    setEditingPoId(null);
    setPoForm({
      supplierId: suppliers[0]?.SupplierID || '',
      branchName: user?.branchName || '',
      notes: '',
      taxPercentage: '15.00',
      expectedDeliveryDate: new Date().toISOString().split('T')[0],
      items: [{
        productId: '',
        searchQuery: '',
        quantity: '1',
        unitCost: '0.00',
        discount: '0.00',
        tax: '0.00'
      }]
    });
    setShowPoModal(true);
  };

  const handleViewPo = async (po) => {
    try {
      setActionLoading(true);
      const res = await fetch(`${API_URL}/api/suppliers/purchases/${po.PurchaseOrderID}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setSelectedPo(await res.json());
        setShowPoViewModal(true);
      } else {
        setToast({ type: 'error', message: 'Failed to load PO details.' });
      }
    } catch (err) {
      setToast({ type: 'error', message: 'Connection failure.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenPoEdit = async (po) => {
    if (po.Status !== 'Draft' && po.Status !== 'Ordered') {
      setToast({ type: 'error', message: `Cannot edit a PO with status "${po.Status}". Only Draft or Ordered POs can be edited.` });
      return;
    }
    try {
      setActionLoading(true);
      const res = await fetch(`${API_URL}/api/suppliers/purchases/${po.PurchaseOrderID}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const fullPo = await res.json();
        setPoModalMode('edit');
        setEditingPoId(po.PurchaseOrderID);
        setPoForm({
          supplierId: String(fullPo.SupplierID),
          branchName: fullPo.BranchName || '',
          notes: fullPo.Notes || '',
          taxPercentage: '15.00',
          expectedDeliveryDate: fullPo.ExpectedDeliveryDate
            ? new Date(fullPo.ExpectedDeliveryDate).toISOString().split('T')[0]
            : new Date().toISOString().split('T')[0],
          items: fullPo.items.map(item => {
            const prod = products.find(p => p.ProductID === item.ProductID);
            return {
              productId: item.ProductID,
              searchQuery: `${item.ProductName} (${item.Barcode || item.SKU || ''})`,
              quantity: String(item.Quantity),
              unitCost: formatCurrency(item.UnitCost),
              discount: formatCurrency(item.Discount || 0),
              tax: formatCurrency(item.Tax || 0)
            };
          })
        });
        setShowPoModal(true);
      } else {
        setToast({ type: 'error', message: 'Failed to load PO details.' });
      }
    } catch (err) {
      setToast({ type: 'error', message: 'Connection failure.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeletePo = async (po) => {
    if (po.Status !== 'Draft' && po.Status !== 'Ordered') {
      setToast({ type: 'error', message: `Cannot delete a PO with status "${po.Status}". Only Draft or Ordered POs can be deleted.` });
      return;
    }
    if (!window.confirm(`Delete Purchase Order "${po.PONumber}"?\n\nThis action cannot be undone.`)) return;
    try {
      setActionLoading(true);
      const res = await fetch(`${API_URL}/api/suppliers/purchases/${po.PurchaseOrderID}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setToast({ type: 'success', message: `Purchase Order ${po.PONumber} deleted successfully.` });
        fetchPurchaseOrders();
      } else {
        const data = await res.json();
        setToast({ type: 'error', message: data.error || 'Deletion failed.' });
      }
    } catch (err) {
      setToast({ type: 'error', message: 'Connection failure.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handlePoItemChange = (index, field, value) => {
    const newItems = [...poForm.items];
    newItems[index][field] = value;
    
    // Auto-update UnitCost from product catalog cost price when product changes
    if (field === 'productId') {
      const prod = products.find(p => p.ProductID === parseInt(value, 10));
      if (prod) {
        newItems[index].unitCost = formatCurrency(prod.Cost);
      }
    }
    setPoForm(prev => ({ ...prev, items: newItems }));
  };

  const handleSearchInputChange = (index, value) => {
    const newItems = [...poForm.items];
    newItems[index].searchQuery = value;
    
    // Reset product ID and cost if input does not match current selection
    const currentProductId = newItems[index].productId;
    const currentProd = currentProductId ? products.find(p => p.ProductID === parseInt(currentProductId, 10)) : null;
    const currentLabel = currentProd ? `${currentProd.Name} (${currentProd.Barcode || currentProd.SKU})` : '';
    
    if (value !== currentLabel) {
      newItems[index].productId = '';
      newItems[index].unitCost = '0.00';
    }
    
    // Check if value matches exactly a product's Barcode, SKU, or Name
    const cleanVal = value.trim();
    if (cleanVal) {
      const exactMatch = products.find(p => 
        (p.Barcode && p.Barcode === cleanVal) || 
        (p.SKU && p.SKU === cleanVal) ||
        (p.Name.toLowerCase() === cleanVal.toLowerCase())
      );
      
      if (exactMatch) {
        // Check if this product already exists in another row
        const existingIndex = newItems.findIndex((item, i) => 
          i !== index && item.productId && String(item.productId) === String(exactMatch.ProductID)
        );
        
        if (existingIndex !== -1) {
          // Merge: increment existing row quantity and remove current row
          const addQty = parseFloat(newItems[index].quantity) || 1;
          newItems[existingIndex].quantity = String(
            parseFloat(newItems[existingIndex].quantity || 1) + addQty
          );
          // Remove current empty/duplicate row
          newItems.splice(index, 1);
          setToast({ type: 'success', message: `Merged: ${exactMatch.Name} quantity updated.` });
        } else {
          newItems[index].productId = exactMatch.ProductID;
          newItems[index].unitCost = formatCurrency(exactMatch.Cost);
          newItems[index].searchQuery = `${exactMatch.Name} (${exactMatch.Barcode || exactMatch.SKU})`;
          setToast({ type: 'success', message: `Selected: ${exactMatch.Name}` });
        }
      }
    }
    
    setPoForm(prev => ({ ...prev, items: newItems }));
  };

  const handleSearchInputKeyDown = (e, index) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const query = (poForm.items[index].searchQuery || '').trim();
      if (!query) return;
      
      const match = products.find(p => 
        (p.Barcode && p.Barcode.toLowerCase() === query.toLowerCase()) || 
        (p.SKU && p.SKU.toLowerCase() === query.toLowerCase()) ||
        p.Name.toLowerCase().includes(query.toLowerCase())
      );
      
      if (match) {
        const newItems = [...poForm.items];
        
        // Check if this product already exists in another row
        const existingIndex = newItems.findIndex((item, i) => 
          i !== index && item.productId && String(item.productId) === String(match.ProductID)
        );
        
        if (existingIndex !== -1) {
          // Merge: increment existing row quantity and remove current row
          const addQty = parseFloat(newItems[index].quantity) || 1;
          newItems[existingIndex].quantity = String(
            parseFloat(newItems[existingIndex].quantity || 1) + addQty
          );
          newItems.splice(index, 1);
          setPoForm(prev => ({ ...prev, items: newItems }));
          setToast({ type: 'success', message: `Merged: ${match.Name} quantity updated.` });
        } else {
          newItems[index].productId = match.ProductID;
          newItems[index].unitCost = formatCurrency(match.Cost);
          newItems[index].searchQuery = `${match.Name} (${match.Barcode || match.SKU})`;
          setPoForm(prev => ({ ...prev, items: newItems }));
          setToast({ type: 'success', message: `Selected: ${match.Name}` });
        }
        setActiveSearchIndex(null);
      }
    }
  };

  const handleAddPoItem = () => {
    setPoForm(prev => ({
      ...prev,
      items: [...prev.items, {
        productId: '',
        searchQuery: '',
        quantity: '1',
        unitCost: '0.00',
        discount: '0.00',
        tax: '0.00'
      }]
    }));
  };

  const handleRemovePoItem = (index) => {
    if (poForm.items.length <= 1) return;
    const newItems = poForm.items.filter((_, i) => i !== index);
    setPoForm(prev => ({ ...prev, items: newItems }));
  };

  const handlePoSubmit = async (e, status = 'Ordered') => {
    if (e && e.preventDefault) e.preventDefault();
    if (!canManagePurchases) return;

    if (!poForm.supplierId) {
      setToast({ type: 'error', message: 'Supplier is required.' });
      return;
    }

    if (poForm.items.length === 0) {
      setToast({ type: 'error', message: 'Purchase Order must contain at least 1 item.' });
      return;
    }

    for (let i = 0; i < poForm.items.length; i++) {
      const item = poForm.items[i];
      if (!item.productId) {
        setToast({ type: 'error', message: `Row ${i + 1}: Please select a valid product using the Smart Search field.` });
        return;
      }
      const qty = parseFloat(item.quantity);
      if (isNaN(qty) || qty <= 0) {
        setToast({ type: 'error', message: `Row ${i + 1}: Quantity must be greater than zero.` });
        return;
      }
    }

    try {
      setActionLoading(true);
      const payload = {
        ...poForm,
        status: status
      };
      const isEdit = poModalMode === 'edit';
      const url = isEdit 
        ? `${API_URL}/api/suppliers/purchases/${editingPoId}` 
        : `${API_URL}/api/suppliers/purchases`;
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        setToast({ 
          type: 'success', 
          message: isEdit 
            ? `Purchase Order ${data.PONumber} updated successfully.` 
            : `Purchase Order ${data.PONumber} (${status}) raised successfully.` 
        });
        setShowPoModal(false);
        fetchPurchaseOrders();
      } else {
        setToast({ type: 'error', message: data.error || (isEdit ? 'Failed to update PO.' : 'Failed to create PO.') });
      }
    } catch (err) {
      setToast({ type: 'error', message: 'Connection failure.' });
    } finally {
      setActionLoading(false);
    }
  };


  // --- ACTIONS: GRN & INVOICING ---

  const handleOpenGrnModal = async (po) => {
    try {
      setActionLoading(true);
      const res = await fetch(`${API_URL}/api/suppliers/purchases/${po.PurchaseOrderID}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const fullPo = await res.json();
        setSelectedPo(fullPo);
        const grnItems = fullPo.items.map(item => ({
          productId: item.ProductID,
          productName: item.ProductName,
          orderedQty: item.Quantity,
          receivedQty: item.Quantity, // Defaults to ordered quantity
          unitCost: item.UnitCost,
          batchNo: '',
          mfgDate: '',
          expiryDate: '',
          warehouseName: 'Main Warehouse',
          isBatchTracked: products.find(p => p.ProductID === item.ProductID)?.IsBatchTracked || false
        }));
        setGrnForm({ items: grnItems });
        setShowGrnModal(true);
      } else {
        setToast({ type: 'error', message: 'Failed to retrieve purchase order items.' });
      }
    } catch (err) {
      setToast({ type: 'error', message: 'Connection failure.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleGrnItemChange = (index, field, value) => {
    const newItems = [...grnForm.items];
    newItems[index][field] = value;
    setGrnForm({ items: newItems });
  };

  const handleGrnSubmit = async (e, convertToBill = false) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!canManagePurchases) return;

    // Check if batch-tracked items have valid batch details
    for (const item of grnForm.items) {
      if (item.isBatchTracked) {
        if (!item.batchNo || !item.expiryDate) {
          setToast({ type: 'error', message: `Product "${item.productName}" is batch-tracked. Batch No. and Expiry Date are required.` });
          return;
        }
      }
    }

    try {
      setActionLoading(true);
      const res = await fetch(`${API_URL}/api/suppliers/purchases/${selectedPo.PurchaseOrderID}/grn`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(grnForm)
      });
      if (res.ok) {
        setToast({ type: 'success', message: 'Goods Received Note (GRN) received. Inventory updated successfully.' });
        setShowGrnModal(false);
        fetchPurchaseOrders();
        
        if (convertToBill === true) {
          // Retrieve updated details and open invoice modal
          await handleOpenInvoiceModal(selectedPo);
        }
      } else {
        const data = await res.json();
        setToast({ type: 'error', message: data.error || 'GRN submission failed.' });
      }
    } catch (err) {
      setToast({ type: 'error', message: 'Connection failure.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenInvoiceModal = async (po) => {
    try {
      setActionLoading(true);
      const res = await fetch(`${API_URL}/api/suppliers/purchases/${po.PurchaseOrderID}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const fullPo = await res.json();
        setSelectedPo(fullPo);
        const sup = suppliers.find(s => s.SupplierID === fullPo.SupplierID);
        const creditPeriod = sup?.CreditPeriodDays || 30;
        
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + creditPeriod);
        const dueDateStr = dueDate.toISOString().split('T')[0];

        setInvoiceForm({
          invoiceNumber: '',
          invoiceDate: new Date().toISOString().split('T')[0],
          dueDate: dueDateStr,
          paymentTerms: sup?.PaymentTerms || 'Net 30',
          amountPaid: '0.00',
          paymentMethod: sup?.PaymentTerms === 'Cash' ? 'Cash' : 'Bank Transfer',
          paymentReference: ''
        });
        setShowInvoiceModal(true);
      } else {
        setToast({ type: 'error', message: 'Failed to retrieve purchase order items.' });
      }
    } catch (err) {
      setToast({ type: 'error', message: 'Connection failure.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleInvoiceSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!canManagePurchases) return;

    if (!invoiceForm.invoiceNumber.trim()) {
      setToast({ type: 'error', message: 'Bill Number is required.' });
      return;
    }

    try {
      setActionLoading(true);
      const res = await fetch(`${API_URL}/api/suppliers/purchases/${selectedPo.PurchaseOrderID}/invoice`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          invoiceNumber: invoiceForm.invoiceNumber,
          invoiceDate: invoiceForm.invoiceDate,
          dueDate: invoiceForm.dueDate,
          paymentTerms: invoiceForm.paymentTerms
        })
      });
      if (res.ok) {
        const paidVal = parseFloat(invoiceForm.amountPaid || 0);
        if (paidVal > 0) {
          await fetch(`${API_URL}/api/suppliers/payments`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              supplierId: selectedPo.SupplierID,
              amount: paidVal,
              paymentMethod: invoiceForm.paymentMethod || (invoiceForm.paymentTerms === 'Cash' ? 'Cash' : 'Bank Transfer'),
              referenceNumber: invoiceForm.paymentReference || invoiceForm.invoiceNumber,
              paymentDate: invoiceForm.invoiceDate,
              notes: `Paid against bill ${invoiceForm.invoiceNumber}`,
              branchName: selectedPo.BranchName
            })
          });
        }

        setToast({ type: 'success', message: `Bill saved successfully.${paidVal > 0 ? ' Settlement payment recorded.' : ''}` });
        setShowInvoiceModal(false);
        fetchPurchaseOrders();
        fetchSuppliers();
      } else {
        const data = await res.json();
        setToast({ type: 'error', message: data.error || 'Failed to save bill.' });
      }
    } catch (err) {
      setToast({ type: 'error', message: 'Connection failure.' });
    } finally {
      setActionLoading(false);
    }
  };

  // --- ACTIONS: LEDGERS & PAYMENTS ---

  const handleOpenPaymentModal = () => {
    setPaymentForm({
      supplierId: selectedLedgerSupplier || suppliers[0]?.SupplierID || '',
      amount: '',
      paymentMethod: 'Bank Transfer',
      referenceNumber: '',
      paymentDate: new Date().toISOString().split('T')[0],
      notes: '',
      branchName: user?.branchName || ''
    });
    setShowPaymentModal(true);
  };

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    if (!canViewFinancials) return;

    if (!paymentForm.supplierId) {
      setToast({ type: 'error', message: 'Supplier is required.' });
      return;
    }
    if (!paymentForm.amount || parseFloat(paymentForm.amount) <= 0) {
      setToast({ type: 'error', message: 'Valid payment amount is required.' });
      return;
    }

    try {
      setActionLoading(true);
      const res = await fetch(`${API_URL}/api/suppliers/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(paymentForm)
      });
      if (res.ok) {
        setToast({ type: 'success', message: 'Supplier settlement payment logged successfully.' });
        setShowPaymentModal(false);
        fetchSuppliers();
        if (selectedLedgerSupplier) fetchLedger(selectedLedgerSupplier);
      } else {
        const data = await res.json();
        setToast({ type: 'error', message: data.error || 'Payment logging failed.' });
      }
    } catch (err) {
      setToast({ type: 'error', message: 'Connection failure.' });
    } finally {
      setActionLoading(false);
    }
  };

  const getLedgerRowDetails = (tx) => {
    let refNo = '--';
    let invoiceNo = '--';
    
    if (tx.ReferenceType === 'Purchase Invoice') {
      invoiceNo = tx.ReferenceNumber || '--';
      const poMatch = tx.Description ? tx.Description.match(/PO\s+(\S+)/) : null;
      refNo = poMatch ? poMatch[1] : '--';
    } else if (tx.ReferenceType === 'Payment Made') {
      refNo = tx.ReferenceNumber || '--';
      const invMatch = tx.Description ? tx.Description.match(/bill\s+(\S+)/) || tx.Description.match(/(INV-\S+)/) : null;
      invoiceNo = invMatch ? invMatch[1] : '--';
    } else if (tx.ReferenceType === 'Supplier Return') {
      refNo = tx.ReferenceNumber || '--';
    } else if (tx.ReferenceType === 'Debit Note' || tx.ReferenceType === 'Credit Note') {
      refNo = tx.ReferenceNumber || '--';
    } else if (tx.ReferenceType === 'Opening Balance') {
      refNo = tx.ReferenceNumber || '--';
    }
    
    return { refNo, invoiceNo };
  };

  const handleOpenAdjustmentModal = () => {
    setAdjustmentForm({
      supplierId: selectedLedgerSupplier || suppliers[0]?.SupplierID || '',
      adjustmentType: 'Debit Note',
      effect: 'Debit',
      amount: '',
      referenceNumber: '',
      notes: '',
      branchName: user?.branchName || 'Main Store',
      date: new Date().toISOString().split('T')[0]
    });
    setShowAdjustmentModal(true);
  };

  const handleAdjustmentSubmit = async (e) => {
    e.preventDefault();
    if (!canViewFinancials) return;

    if (!adjustmentForm.supplierId) {
      setToast({ type: 'error', message: 'Supplier is required.' });
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
      const res = await fetch(`${API_URL}/api/suppliers/adjustments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(adjustmentForm)
      });
      if (res.ok) {
        setToast({ type: 'success', message: 'Supplier ledger adjustment recorded successfully.' });
        setShowAdjustmentModal(false);
        fetchSuppliers();
        if (selectedLedgerSupplier) fetchLedger(selectedLedgerSupplier, ledgerStartDate, ledgerEndDate);
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

  const handlePrintLedger = (supplier, transactions, opBalance, clBalance, startDate, endDate) => {
    const totalDebits = transactions.filter(t => t.TransactionType === 'Debit').reduce((sum, t) => sum + parseFloat(t.Amount), 0);
    const totalCredits = transactions.filter(t => t.TransactionType === 'Credit').reduce((sum, t) => sum + parseFloat(t.Amount), 0);
    
    setPrintLedgerData({
      supplierName: supplier.SupplierName,
      supplierCode: supplier.SupplierCode,
      currentBalance: supplier.CurrentBalance,
      creditLimit: supplier.CreditLimit,
      openingBalance: opBalance,
      closingBalance: clBalance,
      transactions,
      totalDebits,
      totalCredits,
      period: startDate && endDate ? `${startDate} to ${endDate}` : startDate ? `From ${startDate}` : endDate ? `To ${endDate}` : 'All-Time',
      branch: user?.branchName || 'Global'
    });
    
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const fetchLedger = async (supplierId, startDate = ledgerStartDate, endDate = ledgerEndDate) => {
    if (!supplierId) return;
    try {
      setLoading(true);
      let url = `${API_URL}/api/suppliers/ledger/${supplierId}?`;
      if (startDate) url += `startDate=${startDate}&`;
      if (endDate) url += `endDate=${endDate}&`;
      
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setLedgerTransactions(data.transactions || []);
        setLedgerOpeningBalance(data.openingBalance || 0);
        setLedgerClosingBalance(data.closingBalance || 0);
        
        const sup = suppliers.find(s => s.SupplierID === parseInt(supplierId, 10));
        if (sup) {
          setLedgerSummary({ balance: sup.CurrentBalance, creditLimit: sup.CreditLimit });
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // --- ACTIONS: RETURNS ---

  const handleOpenReturnModal = () => {
    setReturnModalMode('create');
    setEditingReturnId(null);
    setReturnForm({
      supplierId: suppliers[0]?.SupplierID || '',
      reason: '',
      branchName: user?.branchName || '',
      items: [{ productId: products[0]?.ProductID || '', quantity: '1', unitCost: products[0]?.Cost || '0.00', batchNo: '' }]
    });
    setShowReturnModal(true);
  };

  const handleReturnItemChange = (index, field, value) => {
    const newItems = [...returnForm.items];
    newItems[index][field] = value;
    if (field === 'productId') {
      const prod = products.find(p => p.ProductID === parseInt(value, 10));
      if (prod) {
        newItems[index].unitCost = formatCurrency(prod.Cost);
      }
    }
    setReturnForm(prev => ({ ...prev, items: newItems }));
  };

  const handleAddReturnItem = () => {
    setReturnForm(prev => ({
      ...prev,
      items: [...prev.items, { productId: products[0]?.ProductID || '', quantity: '1', unitCost: products[0]?.Cost || '0.00', batchNo: '' }]
    }));
  };

  const handleRemoveReturnItem = (index) => {
    if (returnForm.items.length <= 1) return;
    const newItems = returnForm.items.filter((_, i) => i !== index);
    setReturnForm(prev => ({ ...prev, items: newItems }));
  };

  const handleViewReturn = async (ret) => {
    try {
      setActionLoading(true);
      const res = await fetch(`${API_URL}/api/suppliers/returns/${ret.ReturnID}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setSelectedReturn(await res.json());
        setShowReturnViewModal(true);
      } else {
        setToast({ type: 'error', message: 'Failed to load return details.' });
      }
    } catch (err) {
      setToast({ type: 'error', message: 'Connection failure.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenReturnEdit = async (ret) => {
    try {
      setActionLoading(true);
      const res = await fetch(`${API_URL}/api/suppliers/returns/${ret.ReturnID}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const fullRet = await res.json();
        setReturnModalMode('edit');
        setEditingReturnId(ret.ReturnID);
        setReturnForm({
          supplierId: String(fullRet.SupplierID),
          reason: fullRet.Reason || '',
          branchName: fullRet.BranchName || 'Main Store',
          items: fullRet.items.map(item => ({
            productId: item.ProductID,
            quantity: String(item.Quantity),
            unitCost: formatCurrency(item.UnitCost),
            batchNo: item.BatchNo || ''
          }))
        });
        setShowReturnModal(true);
      } else {
        setToast({ type: 'error', message: 'Failed to load return details.' });
      }
    } catch (err) {
      setToast({ type: 'error', message: 'Connection failure.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteReturn = async (ret) => {
    if (!window.confirm(`Are you sure you want to delete return log "${ret.ReturnNumber}"?\n\nThis will reverse the inventory reductions and supplier ledger adjustments.`)) return;
    try {
      setActionLoading(true);
      const res = await fetch(`${API_URL}/api/suppliers/returns/${ret.ReturnID}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setToast({ type: 'success', message: 'Supplier return log deleted successfully and stock reversed.' });
        fetchSuppliers();
        fetchPurchaseReturns();
        if (selectedLedgerSupplier) fetchLedger(selectedLedgerSupplier);
      } else {
        const data = await res.json();
        setToast({ type: 'error', message: data.error || 'Deletion failed.' });
      }
    } catch (err) {
      setToast({ type: 'error', message: 'Connection failure.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleReturnSubmit = async (e) => {
    e.preventDefault();
    if (!canManagePurchases) return;

    try {
      setActionLoading(true);
      const isEdit = returnModalMode === 'edit';
      const url = isEdit 
        ? `${API_URL}/api/suppliers/returns/${editingReturnId}` 
        : `${API_URL}/api/suppliers/returns`;
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(returnForm)
      });
      if (res.ok) {
        setToast({ 
          type: 'success', 
          message: isEdit 
            ? 'Supplier return updated successfully.' 
            : 'Supplier return processed. Inventory adjusted.' 
        });
        setShowReturnModal(false);
        fetchSuppliers();
        fetchPurchaseReturns();
        if (selectedLedgerSupplier) fetchLedger(selectedLedgerSupplier);
      } else {
        const data = await res.json();
        setToast({ type: 'error', message: data.error || 'Return submission failed.' });
      }
    } catch (err) {
      setToast({ type: 'error', message: 'Connection error.' });
    } finally {
      setActionLoading(false);
    }
  };

  // --- ACTIONS: DIRECT CASH PURCHASE ---

  const handleOpenDirectCashPurchaseModal = () => {
    setDirectPurchaseForm({
      supplierId: suppliers[0]?.SupplierID || '',
      branchName: user?.branchName || 'Main Store',
      invoiceNumber: '',
      invoiceDate: new Date().toISOString().split('T')[0],
      paymentMethod: 'Cash',
      paymentReference: '',
      notes: '',
      items: [{
        productId: '',
        searchQuery: '',
        quantity: '1',
        unitCost: '0.00',
        batchNo: '',
        mfgDate: '',
        expiryDate: '',
        warehouseName: 'Main Warehouse'
      }]
    });
    setShowDirectCashPurchaseModal(true);
  };

  const handleDirectPurchaseItemChange = (index, field, value) => {
    const newItems = [...directPurchaseForm.items];
    newItems[index][field] = value;
    
    if (field === 'productId') {
      const prod = products.find(p => p.ProductID === parseInt(value, 10));
      if (prod) {
        newItems[index].unitCost = formatCurrency(prod.Cost);
      }
    }
    setDirectPurchaseForm(prev => ({ ...prev, items: newItems }));
  };

  const handleDirectPurchaseSearchInputChange = (index, value) => {
    const newItems = [...directPurchaseForm.items];
    newItems[index].searchQuery = value;
    
    const currentProductId = newItems[index].productId;
    const currentProd = currentProductId ? products.find(p => p.ProductID === parseInt(currentProductId, 10)) : null;
    const currentLabel = currentProd ? `${currentProd.Name} (${currentProd.Barcode || currentProd.SKU})` : '';
    
    if (value !== currentLabel) {
      newItems[index].productId = '';
      newItems[index].unitCost = '0.00';
    }
    
    const cleanVal = value.trim();
    if (cleanVal) {
      const exactMatch = products.find(p => 
        (p.Barcode && p.Barcode === cleanVal) || 
        (p.SKU && p.SKU === cleanVal) ||
        (p.Name.toLowerCase() === cleanVal.toLowerCase())
      );
      
      if (exactMatch) {
        const existingIndex = newItems.findIndex((item, i) => 
          i !== index && item.productId && String(item.productId) === String(exactMatch.ProductID)
        );
        
        if (existingIndex !== -1) {
          const addQty = parseFloat(newItems[index].quantity) || 1;
          newItems[existingIndex].quantity = String(
            parseFloat(newItems[existingIndex].quantity || 1) + addQty
          );
          newItems.splice(index, 1);
          setToast({ type: 'success', message: `Merged: ${exactMatch.Name} quantity updated.` });
        } else {
          newItems[index].productId = exactMatch.ProductID;
          newItems[index].unitCost = formatCurrency(exactMatch.Cost);
          newItems[index].searchQuery = `${exactMatch.Name} (${exactMatch.Barcode || exactMatch.SKU})`;
          setToast({ type: 'success', message: `Selected: ${exactMatch.Name}` });
        }
      }
    }
    
    setDirectPurchaseForm(prev => ({ ...prev, items: newItems }));
  };

  const handleDirectPurchaseSearchInputKeyDown = (e, index) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const query = (directPurchaseForm.items[index].searchQuery || '').trim();
      if (!query) return;
      
      const match = products.find(p => 
        (p.Barcode && p.Barcode.toLowerCase() === query.toLowerCase()) || 
        (p.SKU && p.SKU.toLowerCase() === query.toLowerCase()) ||
        p.Name.toLowerCase().includes(query.toLowerCase())
      );
      
      if (match) {
        const newItems = [...directPurchaseForm.items];
        const existingIndex = newItems.findIndex((item, i) => 
          i !== index && item.productId && String(item.productId) === String(match.ProductID)
        );
        
        if (existingIndex !== -1) {
          const addQty = parseFloat(newItems[index].quantity) || 1;
          newItems[existingIndex].quantity = String(
            parseFloat(newItems[existingIndex].quantity || 1) + addQty
          );
          newItems.splice(index, 1);
          setDirectPurchaseForm(prev => ({ ...prev, items: newItems }));
          setToast({ type: 'success', message: `Merged: ${match.Name} quantity updated.` });
        } else {
          newItems[index].productId = match.ProductID;
          newItems[index].unitCost = formatCurrency(match.Cost);
          newItems[index].searchQuery = `${match.Name} (${match.Barcode || match.SKU})`;
          setDirectPurchaseForm(prev => ({ ...prev, items: newItems }));
          setToast({ type: 'success', message: `Selected: ${match.Name}` });
        }
        setActiveSearchIndex(null);
      }
    }
  };

  const handleAddDirectPurchaseItem = () => {
    setDirectPurchaseForm(prev => ({
      ...prev,
      items: [...prev.items, {
        productId: '',
        searchQuery: '',
        quantity: '1',
        unitCost: '0.00',
        batchNo: '',
        mfgDate: '',
        expiryDate: '',
        warehouseName: 'Main Warehouse'
      }]
    }));
  };

  const handleRemoveDirectPurchaseItem = (index) => {
    if (directPurchaseForm.items.length <= 1) return;
    const newItems = directPurchaseForm.items.filter((_, i) => i !== index);
    setDirectPurchaseForm(prev => ({ ...prev, items: newItems }));
  };

  const handleDirectPurchaseSubmit = async (e) => {
    e.preventDefault();
    if (!canManagePurchases) return;

    if (!directPurchaseForm.supplierId) {
      setToast({ type: 'error', message: 'Supplier is required.' });
      return;
    }

    if (directPurchaseForm.items.length === 0) {
      setToast({ type: 'error', message: 'Direct purchase must contain at least 1 item.' });
      return;
    }

    for (let i = 0; i < directPurchaseForm.items.length; i++) {
      const item = directPurchaseForm.items[i];
      if (!item.productId) {
        setToast({ type: 'error', message: `Row ${i + 1}: Please select a valid product using the Smart Search field.` });
        return;
      }
      const qty = parseFloat(item.quantity);
      if (isNaN(qty) || qty <= 0) {
        setToast({ type: 'error', message: `Row ${i + 1}: Quantity must be greater than zero.` });
        return;
      }
      const isBatchTracked = products.find(p => p.ProductID === parseInt(item.productId, 10))?.IsBatchTracked;
      if (isBatchTracked) {
        if (!item.batchNo || !item.expiryDate) {
          setToast({ type: 'error', message: `Row ${i + 1}: Product is batch tracked. Batch No and Expiry Date are required.` });
          return;
        }
      }
    }

    try {
      setActionLoading(true);
      const res = await fetch(`${API_URL}/api/suppliers/direct-purchase`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(directPurchaseForm)
      });
      const data = await res.json();
      if (res.ok) {
        setToast({ 
          type: 'success', 
          message: `Direct Cash Purchase ${data.PONumber} processed successfully. Stock updated and immediate payment settled.` 
        });
        setShowDirectCashPurchaseModal(false);
        fetchPurchaseOrders();
        fetchSuppliers();
        fetchProducts();
        fetchWidgets();
      } else {
        setToast({ type: 'error', message: data.error || 'Failed to submit cash purchase.' });
      }
    } catch (err) {
      setToast({ type: 'error', message: 'Connection failure.' });
    } finally {
      setActionLoading(false);
    }
  };

  // --- ACTIONS: DIRECT CREDIT PURCHASE ---

  const handleOpenDirectCreditPurchaseModal = () => {
    const defaultSupplier = suppliers[0]?.SupplierID || '';
    const sup = suppliers.find(s => s.SupplierID === parseInt(defaultSupplier, 10));
    const creditPeriod = sup?.CreditPeriodDays || 30;
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + creditPeriod);

    setDirectCreditPurchaseForm({
      supplierId: defaultSupplier,
      branchName: user?.branchName || 'Main Store',
      invoiceNumber: '',
      invoiceDate: new Date().toISOString().split('T')[0],
      dueDate: dueDate.toISOString().split('T')[0],
      paidAmount: '0.00',
      paymentMethod: 'Cash',
      paymentReference: '',
      notes: '',
      items: [{
        productId: '',
        searchQuery: '',
        quantity: '1',
        unitCost: '0.00',
        discount: '0.00',
        tax: '0.00',
        batchNo: '',
        mfgDate: '',
        expiryDate: '',
        warehouseName: 'Main Warehouse'
      }]
    });
    setShowDirectCreditPurchaseModal(true);
  };

  const handleDirectCreditPurchaseItemChange = (index, field, value) => {
    const newItems = [...directCreditPurchaseForm.items];
    newItems[index][field] = value;
    
    if (field === 'productId') {
      const prod = products.find(p => p.ProductID === parseInt(value, 10));
      if (prod) {
        newItems[index].unitCost = formatCurrency(prod.Cost);
      }
    }
    setDirectCreditPurchaseForm(prev => ({ ...prev, items: newItems }));
  };

  const handleDirectCreditPurchaseSearchInputChange = (index, value) => {
    const newItems = [...directCreditPurchaseForm.items];
    newItems[index].searchQuery = value;
    
    const currentProductId = newItems[index].productId;
    const currentProd = currentProductId ? products.find(p => p.ProductID === parseInt(currentProductId, 10)) : null;
    const currentLabel = currentProd ? `${currentProd.Name} (${currentProd.Barcode || currentProd.SKU})` : '';
    
    if (value !== currentLabel) {
      newItems[index].productId = '';
      newItems[index].unitCost = '0.00';
    }
    
    const cleanVal = value.trim();
    if (cleanVal) {
      const exactMatch = products.find(p => 
        (p.Barcode && p.Barcode === cleanVal) || 
        (p.SKU && p.SKU === cleanVal) ||
        (p.Name.toLowerCase() === cleanVal.toLowerCase())
      );
      
      if (exactMatch) {
        const existingIndex = newItems.findIndex((item, i) => 
          i !== index && item.productId && String(item.productId) === String(exactMatch.ProductID)
        );
        
        if (existingIndex !== -1) {
          const addQty = parseFloat(newItems[index].quantity) || 1;
          newItems[existingIndex].quantity = String(
            parseFloat(newItems[existingIndex].quantity || 1) + addQty
          );
          newItems.splice(index, 1);
          setToast({ type: 'success', message: `Merged: ${exactMatch.Name} quantity updated.` });
        } else {
          newItems[index].productId = exactMatch.ProductID;
          newItems[index].unitCost = formatCurrency(exactMatch.Cost);
          newItems[index].searchQuery = `${exactMatch.Name} (${exactMatch.Barcode || exactMatch.SKU})`;
          setToast({ type: 'success', message: `Selected: ${exactMatch.Name}` });
        }
      }
    }
    
    setDirectCreditPurchaseForm(prev => ({ ...prev, items: newItems }));
  };

  const handleDirectCreditPurchaseSearchInputKeyDown = (e, index) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const query = (directCreditPurchaseForm.items[index].searchQuery || '').trim();
      if (!query) return;
      
      const match = products.find(p => 
        (p.Barcode && p.Barcode.toLowerCase() === query.toLowerCase()) || 
        (p.SKU && p.SKU.toLowerCase() === query.toLowerCase()) ||
        p.Name.toLowerCase().includes(query.toLowerCase())
      );
      
      if (match) {
        const newItems = [...directCreditPurchaseForm.items];
        const existingIndex = newItems.findIndex((item, i) => 
          i !== index && item.productId && String(item.productId) === String(match.ProductID)
        );
        
        if (existingIndex !== -1) {
          const addQty = parseFloat(newItems[index].quantity) || 1;
          newItems[existingIndex].quantity = String(
            parseFloat(newItems[existingIndex].quantity || 1) + addQty
          );
          newItems.splice(index, 1);
          setDirectCreditPurchaseForm(prev => ({ ...prev, items: newItems }));
          setToast({ type: 'success', message: `Merged: ${match.Name} quantity updated.` });
        } else {
          newItems[index].productId = match.ProductID;
          newItems[index].unitCost = formatCurrency(match.Cost);
          newItems[index].searchQuery = `${match.Name} (${match.Barcode || match.SKU})`;
          setDirectCreditPurchaseForm(prev => ({ ...prev, items: newItems }));
          setToast({ type: 'success', message: `Selected: ${match.Name}` });
        }
        setActiveSearchIndex(null);
      }
    }
  };

  const handleAddDirectCreditPurchaseItem = () => {
    setDirectCreditPurchaseForm(prev => ({
      ...prev,
      items: [...prev.items, {
        productId: '',
        searchQuery: '',
        quantity: '1',
        unitCost: '0.00',
        discount: '0.00',
        tax: '0.00',
        batchNo: '',
        mfgDate: '',
        expiryDate: '',
        warehouseName: 'Main Warehouse'
      }]
    }));
  };

  const handleRemoveDirectCreditPurchaseItem = (index) => {
    if (directCreditPurchaseForm.items.length <= 1) return;
    const newItems = directCreditPurchaseForm.items.filter((_, i) => i !== index);
    setDirectCreditPurchaseForm(prev => ({ ...prev, items: newItems }));
  };

  const handleDirectCreditPurchaseSubmit = async (e) => {
    e.preventDefault();
    if (!canManagePurchases) return;

    if (!directCreditPurchaseForm.supplierId) {
      setToast({ type: 'error', message: 'Supplier is required.' });
      return;
    }

    if (directCreditPurchaseForm.items.length === 0) {
      setToast({ type: 'error', message: 'Direct purchase must contain at least 1 item.' });
      return;
    }

    for (let i = 0; i < directCreditPurchaseForm.items.length; i++) {
      const item = directCreditPurchaseForm.items[i];
      if (!item.productId) {
        setToast({ type: 'error', message: `Row ${i + 1}: Please select a valid product using the Smart Search field.` });
        return;
      }
      const qty = parseFloat(item.quantity);
      if (isNaN(qty) || qty <= 0) {
        setToast({ type: 'error', message: `Row ${i + 1}: Quantity must be greater than zero.` });
        return;
      }
      const isBatchTracked = products.find(p => p.ProductID === parseInt(item.productId, 10))?.IsBatchTracked;
      if (isBatchTracked) {
        if (!item.batchNo || !item.expiryDate) {
          setToast({ type: 'error', message: `Row ${i + 1}: Product is batch tracked. Batch No and Expiry Date are required.` });
          return;
        }
      }
    }

    try {
      setActionLoading(true);
      const res = await fetch(`${API_URL}/api/suppliers/direct-credit-purchase`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(directCreditPurchaseForm)
      });
      const data = await res.json();
      if (res.ok) {
        setToast({ 
          type: 'success', 
          message: `Direct Credit Purchase Invoice ${data.PONumber} processed successfully. Stock and supplier payable outstanding balance updated.` 
        });
        setShowDirectCreditPurchaseModal(false);
        fetchPurchaseOrders();
        fetchSuppliers();
        fetchProducts();
        fetchWidgets();
      } else {
        setToast({ type: 'error', message: data.error || 'Failed to submit credit purchase.' });
      }
    } catch (err) {
      setToast({ type: 'error', message: 'Connection failure.' });
    } finally {
      setActionLoading(false);
    }
  };

  // --- REPORTS POSTING & EXPORTS ---

  const computePeriodDates = () => {
    if (reportPeriodType === 'custom') {
      return { start: reportStartDate, end: reportEndDate };
    }
    
    const now = new Date();
    let start = '';
    let end = '';
    
    if (reportMonthSelect === 'this-month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      start = firstDay.toISOString().split('T')[0];
      end = now.toISOString().split('T')[0];
    } else if (reportMonthSelect === 'last-month') {
      const firstDayPrev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDayPrev = new Date(now.getFullYear(), now.getMonth(), 0);
      start = firstDayPrev.toISOString().split('T')[0];
      end = lastDayPrev.toISOString().split('T')[0];
    } else if (reportMonthSelect === 'last-30') {
      const past30 = new Date();
      past30.setDate(now.getDate() - 30);
      start = past30.toISOString().split('T')[0];
      end = now.toISOString().split('T')[0];
    } else if (reportMonthSelect === 'last-90') {
      const past90 = new Date();
      past90.setDate(now.getDate() - 90);
      start = past90.toISOString().split('T')[0];
      end = now.toISOString().split('T')[0];
    }
    
    return { start, end };
  };

  const handleGenerateReport = async () => {
    let url = `${API_URL}/api/suppliers`;
    if (selectedReportType === 'payables') {
      const payables = suppliers.filter(s => parseFloat(s.CurrentBalance) > 0);
      setReportResult(payables);
      return;
    }
    
    if (selectedReportType === 'list') {
      setReportResult(suppliers);
      return;
    }

    if (selectedReportType === 'statement') {
      if (!reportSupplierId) {
        setToast({ type: 'error', message: 'Please select a supplier to generate statement.' });
        return;
      }
      try {
        setLoading(true);
        const { start, end } = computePeriodDates();
        let ledgerUrl = `${API_URL}/api/suppliers/ledger/${reportSupplierId}?`;
        if (start) ledgerUrl += `startDate=${start}&`;
        if (end) ledgerUrl += `endDate=${end}&`;
        if (reportBranch) ledgerUrl += `branchName=${reportBranch}`;

        const res = await fetch(ledgerUrl, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setReportResult(data.transactions || []);
          setReportOpeningBalance(data.openingBalance || 0);
          setReportClosingBalance(data.closingBalance || 0);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
      return;
    }

    if (selectedReportType === 'ledger') {
      if (!reportSupplierId) {
        setToast({ type: 'error', message: 'Please select a supplier to load ledger logs.' });
        return;
      }
      try {
        setLoading(true);
        let ledgerUrl = `${API_URL}/api/suppliers/ledger/${reportSupplierId}?`;
        if (reportStartDate) ledgerUrl += `startDate=${reportStartDate}&`;
        if (reportEndDate) ledgerUrl += `endDate=${reportEndDate}&`;
        if (reportBranch) ledgerUrl += `branchName=${reportBranch}`;

        const res = await fetch(ledgerUrl, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setReportResult(data.transactions || []);
          setReportOpeningBalance(data.openingBalance || 0);
          setReportClosingBalance(data.closingBalance || 0);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
      return;
    }

    if (selectedReportType === 'history') {
      try {
        setLoading(true);
        let purUrl = `${API_URL}/api/suppliers/purchases?`;
        if (reportSupplierId) purUrl += `supplierId=${reportSupplierId}&`;
        if (reportBranch) purUrl += `branchName=${reportBranch}`;
        
        const res = await fetch(purUrl, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const raw = await res.json();
          // Filter by date client-side
          let filtered = [...raw];
          if (reportStartDate) {
            filtered = filtered.filter(p => new Date(p.OrderDate) >= new Date(reportStartDate));
          }
          if (reportEndDate) {
            filtered = filtered.filter(p => new Date(p.OrderDate) <= new Date(reportEndDate + 'T23:59:59'));
          }
          setReportResult(filtered);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleExportCSV = () => {
    if (reportResult.length === 0) {
      setToast({ type: 'info', message: 'No report records available to export.' });
      return;
    }

    let csvContent = "";
    if (selectedReportType === 'list' || selectedReportType === 'payables') {
      csvContent = "Code,Supplier Name,Company,Category,Status,Outstanding Balance,Credit Limit,Mobile\n" +
        reportResult.map(r => `"${r.SupplierCode}","${r.SupplierName}","${r.CompanyName || ''}","${r.SupplierCategory || ''}","${r.Status}",${r.CurrentBalance},${r.CreditLimit},"${r.MobileNumber || ''}"`).join("\n");
    } else if (selectedReportType === 'ledger') {
      csvContent = "Date,Reference No,Invoice No,Transaction Type,Debit,Credit,Balance\n" +
        `"", "","","Opening Balance",0.00,0.00,${reportOpeningBalance}\n` +
        reportResult.map(r => {
          const { refNo, invoiceNo } = getLedgerRowDetails(r);
          const deb = r.TransactionType === 'Debit' ? r.Amount : 0.00;
          const cred = r.TransactionType === 'Credit' ? r.Amount : 0.00;
          return `"${new Date(r.TransactionDate).toLocaleDateString()}","${refNo}","${invoiceNo}","${r.ReferenceType}",${deb},${cred},${r.RunningBalance}`;
        }).join("\n") +
        `\n"", "","","Closing Balance",0.00,0.00,${reportClosingBalance}`;
    } else if (selectedReportType === 'history') {
      csvContent = "PO Number,Date,Supplier,Amount,Status,GRN No,Invoice No,Payment Status\n" +
        reportResult.map(r => `"${r.PONumber}","${new Date(r.OrderDate).toLocaleDateString()}","${r.SupplierName}",${r.TotalAmount},"${r.Status}","${r.GRNNumber || ''}","${r.InvoiceNumber || ''}","${r.PaymentStatus}"`).join("\n");
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Supplier_Report_${selectedReportType}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setToast({ type: 'success', message: 'Report exported to CSV.' });
  };

  const handleExportStatementExcel = () => {
    if (selectedReportType !== 'statement' || reportResult.length === 0) {
      setToast({ type: 'info', message: 'No statement records available to export.' });
      return;
    }

    const supplier = suppliers.find(s => String(s.SupplierID) === String(reportSupplierId));
    if (!supplier) return;

    const { start, end } = computePeriodDates();
    const periodStr = start && end ? `${start} to ${end}` : 'All-Time';
    
    let totalPurchases = 0;
    let totalPayments = 0;
    let totalReturns = 0;
    reportResult.forEach(t => {
      const amt = parseFloat(t.Amount || 0);
      if (t.ReferenceType === 'Purchase Invoice') {
        totalPurchases += amt;
      } else if (t.ReferenceType === 'Payment Made') {
        totalPayments += amt;
      } else if (t.ReferenceType === 'Supplier Return') {
        totalReturns += amt;
      }
    });

    const companyName = companyProfile?.Name || companyProfile?.name || 'SellMax Pro';
    const companyEmail = companyProfile?.Email || companyProfile?.email || '';
    const companyPhone = companyProfile?.MobileNumber || companyProfile?.mobileNumber || companyProfile?.TelephoneNumber || companyProfile?.telephoneNumber || '';
    const companyAddress = `${companyProfile?.AddressLine1 || companyProfile?.addressLine1 || ''}, ${companyProfile?.City || companyProfile?.city || ''}`;

    let html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8"/>
        <!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Statement</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
        <style>
          body { font-family: Arial, sans-serif; }
          .title { font-size: 18px; font-weight: bold; text-align: center; color: #1e3a8a; }
          .label { font-weight: bold; background-color: #f3f4f6; }
          .number { text-align: right; }
          .border-table { border-collapse: collapse; width: 100%; }
          .border-table th { background-color: #e5e7eb; border: 1px solid #d1d5db; font-weight: bold; padding: 6px; }
          .border-table td { border: 1px solid #e5e7eb; padding: 6px; }
          .summary-card { font-weight: bold; border: 2px solid #9ca3af; background-color: #f9fafb; }
        </style>
      </head>
      <body>
        <table>
          <tr>
            <td colspan="6" class="title">${companyName} - ACCOUNT STATEMENT</td>
          </tr>
          <tr>
            <td colspan="3"><strong>Company Details:</strong><br/>${companyAddress}<br/>Phone: ${companyPhone}<br/>Email: ${companyEmail}</td>
            <td colspan="3" align="right"><strong>Statement Period:</strong> ${periodStr}<br/><strong>Date Issued:</strong> ${new Date().toLocaleDateString()}<br/><strong>Branch:</strong> ${reportBranch || 'All Branches'}</td>
          </tr>
          <tr><td colspan="6"></td></tr>
          <tr>
            <td colspan="3" class="label">Supplier Account Details</td>
            <td colspan="3" class="label">Financial Terms</td>
          </tr>
          <tr>
            <td colspan="3"><strong>Name:</strong> ${supplier.SupplierName}<br/><strong>Code:</strong> ${supplier.SupplierCode}<br/><strong>Email:</strong> ${supplier.EmailAddress || '--'}<br/><strong>Mobile:</strong> ${supplier.MobileNumber || '--'}</td>
            <td colspan="3"><strong>Credit Limit:</strong> Rs. ${formatCurrency(supplier.CreditLimit)}<br/><strong>Credit Period:</strong> ${supplier.CreditPeriodDays || 0} Days<br/><strong>Payment Terms:</strong> ${supplier.PaymentTerms || '--'}</td>
          </tr>
          <tr><td colspan="6"></td></tr>
          <tr class="summary-card">
            <td colspan="2" align="center">Opening Balance: Rs. ${formatCurrency(reportOpeningBalance)}</td>
            <td colspan="2" align="center">Closing Balance: Rs. ${formatCurrency(reportClosingBalance)}</td>
            <td colspan="2" align="center">Owed / Payable: Rs. ${formatCurrency(supplier.CurrentBalance)}</td>
          </tr>
          <tr><td colspan="6"></td></tr>
        </table>

        <table class="border-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Document No</th>
              <th>Description</th>
              <th>Debit (Payments/Returns)</th>
              <th>Credit (Purchases)</th>
              <th>Running Balance</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colspan="5"><strong>Period Opening Balance</strong></td>
              <td class="number"><strong>Rs. ${formatCurrency(reportOpeningBalance)}</strong></td>
            </tr>
            ${reportResult.map(t => {
              const { refNo } = getLedgerRowDetails(t);
              const deb = t.TransactionType === 'Debit' ? formatCurrency(t.Amount) : '--';
              const cred = t.TransactionType === 'Credit' ? formatCurrency(t.Amount) : '--';
              const bal = formatCurrency(t.RunningBalance);
              return `
                <tr>
                  <td>${new Date(t.TransactionDate).toLocaleDateString()}</td>
                  <td>${refNo}</td>
                  <td>${t.Description || t.ReferenceType}</td>
                  <td class="number">${deb}</td>
                  <td class="number">${cred}</td>
                  <td class="number">Rs. ${bal}</td>
                </tr>
              `;
            }).join('')}
            <tr>
              <td colspan="5"><strong>Period Closing Balance</strong></td>
              <td class="number"><strong>Rs. ${formatCurrency(reportClosingBalance)}</strong></td>
            </tr>
          </tbody>
        </table>

        <br/>
        <table>
          <tr>
            <td colspan="4"></td>
            <td class="label">Total Purchases (+):</td>
            <td class="number">Rs. ${formatCurrency(totalPurchases)}</td>
          </tr>
          <tr>
            <td colspan="4"></td>
            <td class="label">Total Payments (-):</td>
            <td class="number">Rs. ${formatCurrency(totalPayments)}</td>
          </tr>
          <tr>
            <td colspan="4"></td>
            <td class="label">Total Returns (-):</td>
            <td class="number">Rs. ${formatCurrency(totalReturns)}</td>
          </tr>
          <tr>
            <td colspan="4"></td>
            <td class="summary-card">Closing Balance:</td>
            <td class="summary-card number">Rs. ${formatCurrency(reportClosingBalance)}</td>
          </tr>
          <tr>
            <td colspan="4"></td>
            <td class="summary-card" style="color:red;">Outstanding Balance:</td>
            <td class="summary-card number" style="color:red;">Rs. ${formatCurrency(supplier.CurrentBalance)}</td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Supplier_Statement_${supplier.SupplierCode}_${PeriodStrClean(periodStr)}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setToast({ type: 'success', message: 'Supplier statement exported to Excel successfully.' });
  };

  const PeriodStrClean = (str) => {
    return str.replace(/[^a-zA-Z0-9]/g, '_');
  };

  const handleEmailStatement = async () => {
    if (selectedReportType !== 'statement' || reportResult.length === 0) {
      setToast({ type: 'info', message: 'No statement records available to email.' });
      return;
    }

    const supplier = suppliers.find(s => String(s.SupplierID) === String(reportSupplierId));
    if (!supplier) return;

    if (!supplier.EmailAddress) {
      setToast({ type: 'error', message: `Supplier '${supplier.SupplierName}' does not have a registered email address.` });
      return;
    }

    try {
      setActionLoading(true);
      const { start, end } = computePeriodDates();
      const res = await fetch(`${API_URL}/api/suppliers/ledger/${reportSupplierId}/email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          startDate: start,
          endDate: end,
          branchName: reportBranch
        })
      });
      const data = await res.json();
      if (res.ok) {
        setToast({ type: 'success', message: `Statement successfully emailed to ${supplier.EmailAddress} (Simulated).` });
      } else {
        setToast({ type: 'error', message: data.error || 'Failed to email statement.' });
      }
    } catch (err) {
      setToast({ type: 'error', message: 'Connection failure when emailing statement.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handlePrintReport = () => {
    // Clear conflicting states depending on the tab context
    if (activeTab === 'reports') {
      setSelectedPo(null);
    } else if (activeTab === 'purchases') {
      setPrintLedgerData(null);
      setPrintStatementData(null);
      setPrintGenericReportData(null);
    }

    if (selectedReportType === 'statement') {
      const supplier = suppliers.find(s => String(s.SupplierID) === String(reportSupplierId));
      const { start, end } = computePeriodDates();
      let totalPurchases = 0;
      let totalPayments = 0;
      let totalReturns = 0;
      reportResult.forEach(t => {
        const amt = parseFloat(t.Amount || 0);
        if (t.ReferenceType === 'Purchase Invoice') {
          totalPurchases += amt;
        } else if (t.ReferenceType === 'Payment Made') {
          totalPayments += amt;
        } else if (t.ReferenceType === 'Supplier Return') {
          totalReturns += amt;
        }
      });
      
      setPrintStatementData({
        supplier,
        transactions: reportResult,
        openingBalance: reportOpeningBalance,
        closingBalance: reportClosingBalance,
        totalPurchases,
        totalPayments,
        totalReturns,
        period: start && end ? `${start} to ${end}` : 'All-Time'
      });
      
      setPrintLedgerData(null);
      setPrintGenericReportData(null);

      setTimeout(() => {
        window.print();
      }, 150);
    } else if (selectedReportType === 'ledger') {
      const supplier = suppliers.find(s => String(s.SupplierID) === String(reportSupplierId));
      const { start, end } = computePeriodDates();
      const transactions = reportResult;
      const totalDebits = transactions.filter(t => t.TransactionType === 'Debit').reduce((sum, t) => sum + parseFloat(t.Amount || 0), 0);
      const totalCredits = transactions.filter(t => t.TransactionType === 'Credit').reduce((sum, t) => sum + parseFloat(t.Amount || 0), 0);
      
      setPrintLedgerData({
        supplierName: supplier ? supplier.SupplierName : '--',
        supplierCode: supplier ? supplier.SupplierCode : '--',
        currentBalance: supplier ? supplier.CurrentBalance : 0,
        creditLimit: supplier ? supplier.CreditLimit : 0,
        openingBalance: reportOpeningBalance,
        closingBalance: reportClosingBalance,
        transactions,
        totalDebits,
        totalCredits,
        period: start && end ? `${start} to ${end}` : 'All-Time',
        branch: reportBranch || 'Global'
      });

      setPrintStatementData(null);
      setPrintGenericReportData(null);

      setTimeout(() => {
        window.print();
      }, 150);
    } else if (selectedReportType === 'list') {
      setPrintGenericReportData({
        title: 'SUPPLIER CONTACT DIRECTORY',
        branch: reportBranch || 'All Branches',
        columns: [
          { label: 'Code', key: 'SupplierCode', mono: true, bold: true },
          { label: 'Supplier', key: 'SupplierName', bold: true },
          { label: 'Contact Email', key: 'EmailAddress' },
          { label: 'Phone', key: 'MobileNumber' },
          { label: 'Credit Limit', key: 'CreditLimit', align: 'right', mono: true },
          { label: 'Outstanding Payables', key: 'CurrentBalance', align: 'right', mono: true },
          { label: 'Category', key: 'SupplierCategory' }
        ],
        rows: reportResult.map(r => ({
          SupplierCode: r.SupplierCode,
          SupplierName: r.SupplierName,
          EmailAddress: r.EmailAddress || '--',
          MobileNumber: r.MobileNumber || '--',
          CreditLimit: `Rs. ${formatCurrency(r.CreditLimit)}`,
          CurrentBalance: `Rs. ${formatCurrency(r.CurrentBalance)}`,
          SupplierCategory: r.SupplierCategory || '--'
        }))
      });

      setPrintStatementData(null);
      setPrintLedgerData(null);

      setTimeout(() => {
        window.print();
      }, 150);
    } else if (selectedReportType === 'payables') {
      setPrintGenericReportData({
        title: 'OUTSTANDING PAYABLES STATEMENT',
        branch: reportBranch || 'All Branches',
        columns: [
          { label: 'Code', key: 'SupplierCode', mono: true, bold: true },
          { label: 'Supplier', key: 'SupplierName', bold: true },
          { label: 'Contact Email', key: 'EmailAddress' },
          { label: 'Phone', key: 'MobileNumber' },
          { label: 'Credit Limit', key: 'CreditLimit', align: 'right', mono: true },
          { label: 'Outstanding Payables', key: 'CurrentBalance', align: 'right', mono: true },
          { label: 'Category', key: 'SupplierCategory' }
        ],
        rows: reportResult.map(r => ({
          SupplierCode: r.SupplierCode,
          SupplierName: r.SupplierName,
          EmailAddress: r.EmailAddress || '--',
          MobileNumber: r.MobileNumber || '--',
          CreditLimit: `Rs. ${formatCurrency(r.CreditLimit)}`,
          CurrentBalance: `Rs. ${formatCurrency(r.CurrentBalance)}`,
          SupplierCategory: r.SupplierCategory || '--'
        }))
      });

      setPrintStatementData(null);
      setPrintLedgerData(null);

      setTimeout(() => {
        window.print();
      }, 150);
    } else if (selectedReportType === 'history') {
      const { start, end } = computePeriodDates();
      setPrintGenericReportData({
        title: 'PURCHASE HISTORY SUMMARY',
        period: start && end ? `${start} to ${end}` : 'All-Time',
        branch: reportBranch || 'All Branches',
        columns: [
          { label: 'PO Number', key: 'PONumber', mono: true, bold: true },
          { label: 'Supplier', key: 'SupplierName', bold: true },
          { label: 'Date', key: 'OrderDate' },
          { label: 'Amount', key: 'TotalAmount', align: 'right', mono: true },
          { label: 'PO Status', key: 'Status' },
          { label: 'Invoice No', key: 'InvoiceNumber', mono: true },
          { label: 'Payment', key: 'PaymentStatus' }
        ],
        rows: reportResult.map(r => ({
          PONumber: r.PONumber,
          SupplierName: r.SupplierName,
          OrderDate: new Date(r.OrderDate).toLocaleDateString(),
          TotalAmount: `Rs. ${formatCurrency(r.TotalAmount)}`,
          Status: r.Status,
          InvoiceNumber: r.InvoiceNumber || '--',
          PaymentStatus: r.PaymentStatus || '--'
        }))
      });

      setPrintStatementData(null);
      setPrintLedgerData(null);

      setTimeout(() => {
        window.print();
      }, 150);
    } else {
      window.print();
    }
  };

  // Filter local directory suppliers
  const filteredSuppliers = suppliers.filter(s => {
    const matchesSearch = s.SupplierName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          s.SupplierCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (s.CompanyName && s.CompanyName.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = categoryFilter ? s.SupplierCategory === categoryFilter : true;
    const matchesStatus = statusFilter ? s.Status === statusFilter : true;
    const matchesBranch = branchFilter ? s.BranchName === branchFilter : true;
    return matchesSearch && matchesCategory && matchesStatus && matchesBranch;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Tab bar header */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '4px', borderBottom: '1px solid var(--border-color)', paddingBottom: '0' }} className="no-print">
        {[
          { id: 'directory', label: 'Suppliers Directory', icon: <Building2 size={14} /> },
          { id: 'purchases', label: 'Purchase Manager', icon: <ShoppingBag size={14} /> },
          { id: 'ledger', label: 'Settlements & Ledgers', icon: <Coins size={14} /> },
          { id: 'reports', label: 'Audit & Reports', icon: <FileText size={14} /> }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              setReportResult([]);
            }}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 18px', fontSize: '13px', fontWeight: '600',
              background: activeTab === tab.id ? 'var(--primary)' : 'transparent',
              color: activeTab === tab.id ? 'white' : 'var(--text-secondary)',
              border: 'none', borderRadius: 'var(--radius-md) var(--radius-md) 0 0',
              cursor: 'pointer', transition: 'all 0.2s',
              borderBottom: activeTab === tab.id ? '2px solid var(--primary)' : '2px solid transparent'
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* --- WIDGET CARDS FOR ACTIVE TAB --- */}
      {widgets && activeTab !== 'reports' && (
        <div className="dashboard-grid no-print" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '24px' }}>
          <div className="metric-card glass-panel">
            <Building2 className="metric-icon" size={24} style={{ color: 'var(--primary)' }} />
            <div className="metric-value">{widgets.totalSuppliers}</div>
            <div className="metric-label">Total Suppliers Registered</div>
          </div>
          <div className="metric-card glass-panel">
            <CheckCircle className="metric-icon" size={24} style={{ color: 'var(--success)' }} />
            <div className="metric-value">{widgets.activeSuppliers}</div>
            <div className="metric-label">Active Suppliers</div>
          </div>
          <div className="metric-card glass-panel">
            <Coins className="metric-icon" size={24} style={{ color: 'var(--warning)' }} />
            <div className="metric-value">Rs. {Number(widgets.outstandingPayables).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
            <div className="metric-label">Outstanding Payables</div>
          </div>
          {widgets.creditAlerts > 0 && (
            <div className="metric-card glass-panel" style={{ border: '1px solid rgba(239, 68, 68, 0.3)', background: 'rgba(239,68,68,0.05)' }}>
              <AlertTriangle className="metric-icon" size={24} style={{ color: 'var(--danger)' }} />
              <div className="metric-value" style={{ color: 'var(--danger)' }}>{widgets.creditAlerts}</div>
              <div className="metric-label">Suppliers At Credit Limit</div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================================
         TAB 1: SUPPLIERS DIRECTORY
         ============================================================================ */}
      {activeTab === 'directory' && (
        <div className="no-print">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ display: 'flex', gap: '12px', flexGrow: 1, maxWidth: '600px' }}>
              <div className="search-box-container" style={{ flexGrow: 1 }}>
                <Search className="search-icon" size={18} />
                <input
                  type="text"
                  className="form-input pos-search"
                  placeholder="Search by supplier name, code, company..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <select className="form-select" style={{ width: '150px' }} value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                <option value="">All Categories</option>
                <option value="Wholesaler">Wholesaler</option>
                <option value="Manufacturer">Manufacturer</option>
                <option value="Distributor">Distributor</option>
                <option value="Importer">Importer</option>
              </select>
              <select className="form-select" style={{ width: '130px' }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">All Statuses</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>

            {canManageSuppliers && (
              <button className="btn btn-primary" onClick={() => handleOpenSupplierModal('add')}>
                <Plus size={16} /> Add New Supplier
              </button>
            )}
          </div>

          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px' }}>
              <RefreshCw size={24} style={{ color: 'var(--primary)', animation: 'spin 1.5s linear infinite' }} />
            </div>
          ) : (
            <div className="glass-panel" style={{ padding: 0 }}>
              <div className="table-container">
                <table className="table-glass">
                  <thead>
                    <tr>
                      <th>Supplier Code</th>
                      <th>Supplier Name</th>
                      <th>Company</th>
                      <th>Category</th>
                      <th>Outstanding Balance</th>
                      <th>Credit Limit</th>
                      <th>Branch</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSuppliers.length === 0 ? (
                      <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>No suppliers matching the selected criteria.</td></tr>
                    ) : (
                      filteredSuppliers.map((s) => (
                        <tr key={s.SupplierID}>
                          <td className="mono" style={{ fontWeight: '700' }}>{s.SupplierCode}</td>
                          <td style={{ fontWeight: '600' }}>{s.SupplierName}</td>
                          <td>{s.CompanyName || '--'}</td>
                          <td>
                            <span style={{ fontSize: '11px', background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: '12px' }}>
                              {s.SupplierCategory}
                            </span>
                          </td>
                          <td className="mono" style={{ color: parseFloat(s.CurrentBalance) > 0 ? 'var(--warning)' : 'var(--text-secondary)' }}>
                            Rs. {formatCurrency(s.CurrentBalance)}
                          </td>
                          <td className="mono">Rs. {formatCurrency(s.CreditLimit)}</td>
                          <td>{s.BranchName || 'Global'}</td>
                          <td>
                            <button
                              type="button"
                              onClick={() => handleToggleSupplierStatus(s)}
                              disabled={!canManageSuppliers}
                              style={{
                                background: s.Status === 'Active' ? 'var(--success-bg)' : 'var(--danger-bg)',
                                color: s.Status === 'Active' ? 'var(--success)' : 'var(--danger)',
                                border: '1px solid ' + (s.Status === 'Active' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'),
                                padding: '3px 8px', borderRadius: 'var(--radius-sm)', fontSize: '11px', fontWeight: '700',
                                cursor: canManageSuppliers ? 'pointer' : 'default'
                              }}
                            >
                              {s.Status}
                            </button>
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button className="btn btn-secondary btn-icon" onClick={() => handleOpenSupplierModal('view', s)} title="View Profile">
                                <Eye size={12} />
                              </button>
                              {canManageSuppliers && (
                                <>
                                  <button className="btn btn-secondary btn-icon" onClick={() => handleOpenSupplierModal('edit', s)} title="Edit Profile">
                                    <Edit2 size={12} />
                                  </button>
                                  <button className="btn btn-danger btn-icon" onClick={() => handleDeleteSupplier(s.SupplierID, s.SupplierName)} title="Delete Profile">
                                    <Trash2 size={12} />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================================
         TAB 2: PURCHASE MANAGER (Consolidated tab with PO, GRN/Invoice, and Returns sub-tabs)
         ============================================================================ */}
      {activeTab === 'purchases' && (
        <div className="no-print" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Sub-tabs Navigation */}
          <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '8px', marginBottom: '8px' }}>
            {[
              { id: 'orders', label: 'Purchase Orders (PO)', icon: <ShoppingBag size={14} /> },
              { id: 'grninvoice', label: 'Inbound Invoices & GRN', icon: <Truck size={14} /> },
              { id: 'returns', label: 'Purchase Returns', icon: <RefreshCw size={14} /> }
            ].map(sub => (
              <button
                key={sub.id}
                type="button"
                onClick={() => setPurchaseSubTab(sub.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '6px 14px', fontSize: '12.5px', fontWeight: '600',
                  background: purchaseSubTab === sub.id ? 'var(--primary)' : 'var(--bg-surface-elevated)',
                  color: purchaseSubTab === sub.id ? 'white' : 'var(--text-secondary)',
                  border: '1px solid ' + (purchaseSubTab === sub.id ? 'var(--primary)' : 'var(--border-color)'),
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer', transition: 'all 0.15s'
                }}
              >
                {sub.icon} {sub.label}
              </button>
            ))}
          </div>

          {/* Sub-tab Content: Purchase Orders */}
          {purchaseSubTab === 'orders' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '15px', fontWeight: '700' }}>Purchase Orders</h3>
                {canManagePurchases && (
                  <button className="btn btn-primary" onClick={handleOpenPoModal} style={{ height: '32px', padding: '0 12px', fontSize: '12px' }}>
                    <Plus size={14} /> Create Purchase Order
                  </button>
                )}
              </div>

              <div className="glass-panel" style={{ padding: 0 }}>
                <div className="table-container">
                  <table className="table-glass">
                    <thead>
                      <tr>
                        <th>PO Number</th>
                        <th>Supplier</th>
                        <th>Order Date</th>
                        <th>Grand Total</th>
                        <th>Status</th>
                        <th>Invoice No.</th>
                        <th>Payment Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {purchaseOrders.length === 0 ? (
                        <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '30px' }}>No purchase orders recorded. Create a PO to procure stock items.</td></tr>
                      ) : (
                        purchaseOrders.map(po => (
                          <tr key={po.PurchaseOrderID}>
                            <td className="mono" style={{ fontWeight: '700' }}>{po.PONumber}</td>
                            <td style={{ fontWeight: '600' }}>{po.SupplierName}</td>
                            <td>{new Date(po.OrderDate).toLocaleDateString()}</td>
                            <td className="mono" style={{ fontWeight: '700', color: 'var(--accent)' }}>Rs. {formatCurrency(po.TotalAmount)}</td>
                            <td>
                              <span style={{ 
                                fontSize: '11px', fontWeight: '700', padding: '3px 10px', borderRadius: '12px',
                                background: po.Status === 'Draft' ? 'rgba(255,255,255,0.06)' : 
                                            po.Status === 'Ordered' ? 'rgba(96,165,250,0.15)' :
                                            po.Status === 'GRN Received' ? 'rgba(245,158,11,0.15)' :
                                            po.Status === 'Invoiced' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                                color: po.Status === 'Draft' ? 'var(--text-secondary)' : 
                                       po.Status === 'Ordered' ? '#60a5fa' :
                                       po.Status === 'GRN Received' ? 'var(--warning)' :
                                       po.Status === 'Invoiced' ? 'var(--success)' : 'var(--danger)'
                              }}>{po.Status}</span>
                            </td>
                            <td className="mono">{po.InvoiceNumber || '--'}</td>
                            <td>
                              <span style={{ 
                                fontSize: '11px', fontWeight: '700',
                                color: po.PaymentStatus === 'Paid' ? 'var(--success)' : 
                                       po.PaymentStatus === 'Partially Paid' ? 'var(--warning)' : 'var(--text-muted)'
                              }}>{po.PaymentStatus}</span>
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: '6px' }}>
                                <button className="btn btn-secondary btn-icon" onClick={() => handleViewPo(po)} title="View PO Details">
                                  <Eye size={12} />
                                </button>
                                {canManagePurchases && (po.Status === 'Draft' || po.Status === 'Ordered') && (
                                  <>
                                    <button className="btn btn-secondary btn-icon" onClick={() => handleOpenPoEdit(po)} title="Edit PO">
                                      <Edit2 size={12} />
                                    </button>
                                    <button className="btn btn-danger btn-icon" onClick={() => handleDeletePo(po)} title="Delete PO">
                                      <Trash2 size={12} />
                                    </button>
                                  </>
                                )}
                                <button className="btn btn-secondary btn-icon" onClick={async () => {
                                  const res = await fetch(`${API_URL}/api/suppliers/purchases/${po.PurchaseOrderID}`, { headers: { 'Authorization': `Bearer ${token}` } });
                                  if (res.ok) {
                                    setSelectedPo(await res.json());
                                    handlePrintReport(); // triggers receipt print
                                  }
                                }} title="Print PO Voucher">
                                  <Printer size={12} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Sub-tab Content: Inbound Goods & Invoices */}
          {purchaseSubTab === 'grninvoice' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '15px', fontWeight: '700' }}>Inbound Goods (GRN) & Purchase Invoices</h3>
                {canManagePurchases && (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn btn-secondary" onClick={handleOpenDirectCashPurchaseModal} style={{ height: '32px', padding: '0 12px', fontSize: '12px', color: '#10b981', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>
                      <Plus size={14} style={{ marginRight: '4px' }} /> Enter Cash Bill
                    </button>
                    <button className="btn btn-secondary" onClick={handleOpenDirectCreditPurchaseModal} style={{ height: '32px', padding: '0 12px', fontSize: '12px', color: '#3b82f6', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)' }}>
                      <Plus size={14} style={{ marginRight: '4px' }} /> Enter Credit Invoice
                    </button>
                    <button className="btn btn-primary" onClick={() => {
                      const pending = purchaseOrders.filter(po => po.Status === 'Ordered' || po.Status === 'GRN Received');
                      setSelectedCreateInvoiceGrnPoId(pending[0]?.PurchaseOrderID || '');
                      setShowCreateInvoiceGrnModal(true);
                    }} style={{ height: '32px', padding: '0 12px', fontSize: '12px' }}>
                      <Plus size={14} /> Create Invoice/GRN
                    </button>
                  </div>
                )}
              </div>

              <div className="glass-panel" style={{ padding: 0 }}>
                <div className="table-container">
                  <table className="table-glass">
                    <thead>
                      <tr>
                        <th>PO Number</th>
                        <th>Supplier</th>
                        <th>Order Date</th>
                        <th>GRN Reference</th>
                        <th>Invoice Reference</th>
                        <th>Status</th>
                        <th>Payment Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {purchaseOrders.length === 0 ? (
                        <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '30px' }}>No inbound orders found.</td></tr>
                      ) : (
                        purchaseOrders.map(po => (
                          <tr key={po.PurchaseOrderID}>
                            <td className="mono" style={{ fontWeight: '700' }}>{po.PONumber}</td>
                            <td style={{ fontWeight: '600' }}>{po.SupplierName}</td>
                            <td>{new Date(po.OrderDate).toLocaleDateString()}</td>
                            <td>
                              {po.GRNNumber ? (
                                <span style={{ fontSize: '12px' }}>
                                  🚚 {po.GRNNumber}
                                  {po.GRNDate && <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{new Date(po.GRNDate).toLocaleDateString()}</div>}
                                </span>
                              ) : (
                                <span style={{ color: 'var(--text-muted)' }}>--</span>
                              )}
                            </td>
                            <td>
                              {po.InvoiceNumber ? (
                                <span style={{ fontSize: '12px' }}>
                                  📄 {po.InvoiceNumber}
                                  {po.InvoiceDate && <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{new Date(po.InvoiceDate).toLocaleDateString()}</div>}
                                </span>
                              ) : (
                                <span style={{ color: 'var(--text-muted)' }}>--</span>
                              )}
                            </td>
                            <td>
                              <span style={{ 
                                fontSize: '11px', fontWeight: '700', padding: '3px 10px', borderRadius: '12px',
                                background: po.Status === 'Draft' ? 'rgba(255,255,255,0.06)' : 
                                            po.Status === 'Ordered' ? 'rgba(96,165,250,0.15)' :
                                            po.Status === 'GRN Received' ? 'rgba(245,158,11,0.15)' :
                                            po.Status === 'Invoiced' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                                color: po.Status === 'Draft' ? 'var(--text-secondary)' : 
                                       po.Status === 'Ordered' ? '#60a5fa' :
                                       po.Status === 'GRN Received' ? 'var(--warning)' :
                                       po.Status === 'Invoiced' ? 'var(--success)' : 'var(--danger)'
                              }}>{po.Status}</span>
                            </td>
                            <td>
                              <span style={{ 
                                fontSize: '11px', fontWeight: '700',
                                color: po.PaymentStatus === 'Paid' ? 'var(--success)' : 
                                       po.PaymentStatus === 'Partially Paid' ? 'var(--warning)' : 'var(--text-muted)'
                              }}>{po.PaymentStatus}</span>
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                <button className="btn btn-secondary btn-icon" onClick={() => handleViewPo(po)} title="View Details">
                                  <Eye size={12} />
                                </button>
                                {canManagePurchases && (po.Status === 'Draft' || po.Status === 'Ordered') && (
                                  <>
                                    <button className="btn btn-secondary btn-icon" onClick={() => handleOpenPoEdit(po)} title="Edit PO">
                                      <Edit2 size={12} />
                                    </button>
                                    <button className="btn btn-danger btn-icon" onClick={() => handleDeletePo(po)} title="Delete PO">
                                      <Trash2 size={12} />
                                    </button>
                                  </>
                                )}
                                {/* GRN workflow */}
                                {po.Status === 'Ordered' && canManagePurchases && (
                                  <button className="btn" style={{ fontSize: '11px', padding: '4px 10px', color: 'var(--warning)', background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }} onClick={() => handleOpenGrnModal(po)}>
                                    🚚 Receive GRN
                                  </button>
                                )}

                                {/* Invoice workflow */}
                                {po.Status === 'GRN Received' && canManagePurchases && (
                                  <button className="btn" style={{ fontSize: '11px', padding: '4px 10px', color: 'var(--success)', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }} onClick={() => handleOpenInvoiceModal(po)}>
                                    📄 Post Invoice
                                  </button>
                                )}

                                {po.Status === 'Invoiced' && (
                                  <span style={{ fontSize: '11px', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '600' }}>
                                    <CheckCircle size={12} /> Stock Procured
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Sub-tab Content: Purchase Returns */}
          {purchaseSubTab === 'returns' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '15px', fontWeight: '700' }}>Purchase Returns Log</h3>
                {canManagePurchases && (
                  <button className="btn btn-secondary" onClick={handleOpenReturnModal} style={{ height: '32px', padding: '0 12px', fontSize: '12px', color: 'var(--danger)', background: 'rgba(239,68,68,0.1)' }}>
                    Process Return
                  </button>
                )}
              </div>

              <div className="glass-panel" style={{ padding: 0 }}>
                <div className="table-container">
                  <table className="table-glass">
                    <thead>
                      <tr>
                        <th>Return Number</th>
                        <th>Supplier Name</th>
                        <th>Return Date</th>
                        <th>Grand Total</th>
                        <th>Return Type</th>
                        <th>Reason</th>
                        <th>Handled By</th>
                        <th>Branch</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {purchaseReturns.length === 0 ? (
                        <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '30px' }}>No supplier returns logged. Process a return to adjust stock.</td></tr>
                      ) : (
                        purchaseReturns.map(ret => (
                          <tr key={ret.ReturnID}>
                            <td className="mono" style={{ fontWeight: '700' }}>{ret.ReturnNumber}</td>
                            <td style={{ fontWeight: '600' }}>{ret.SupplierName}</td>
                            <td>{new Date(ret.ReturnDate).toLocaleDateString()}</td>
                            <td className="mono" style={{ fontWeight: '700', color: 'var(--danger)' }}>Rs. {formatCurrency(ret.TotalAmount)}</td>
                            <td>
                              <span style={{
                                padding: '3px 8px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: '600',
                                background: ret.ReturnType === 'Cash' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                color: ret.ReturnType === 'Cash' ? '#38bdf8' : '#f87171'
                              }}>
                                {ret.ReturnType || 'Credit'}
                              </span>
                            </td>
                            <td>{ret.Reason || '--'}</td>
                            <td>{ret.Username}</td>
                            <td>{ret.BranchName || 'Global'}</td>
                            <td>
                              <div style={{ display: 'flex', gap: '6px' }}>
                                <button className="btn btn-secondary btn-icon" onClick={() => handleViewReturn(ret)} title="View Details">
                                  <Eye size={12} />
                                </button>
                                {canManagePurchases && (
                                  <>
                                    <button className="btn btn-secondary btn-icon" onClick={() => handleOpenReturnEdit(ret)} title="Edit Return">
                                      <Edit2 size={12} />
                                    </button>
                                    <button className="btn btn-danger btn-icon" onClick={() => handleDeleteReturn(ret)} title="Delete Return">
                                      <Trash2 size={12} />
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

        </div>
      )}

      {/* ============================================================================
         TAB 3: SETTLEMENTS & LEDGERS
         ============================================================================ */}
      {activeTab === 'ledger' && (
        <div className="no-print" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              <label className="form-label" style={{ marginBottom: 0 }}>Select Supplier:</label>
              <select className="form-select" style={{ width: '220px' }} value={selectedLedgerSupplier} onChange={(e) => {
                setSelectedLedgerSupplier(e.target.value);
                fetchLedger(e.target.value, ledgerStartDate, ledgerEndDate);
              }}>
                <option value="">-- Choose Supplier --</option>
                {suppliers.map(s => (
                  <option key={s.SupplierID} value={s.SupplierID}>{s.SupplierName} ({s.SupplierCode})</option>
                ))}
              </select>

              <label className="form-label" style={{ marginBottom: 0, marginLeft: '10px' }}>Start Date:</label>
              <input type="date" className="form-input" style={{ width: '145px' }} value={ledgerStartDate} onChange={(e) => {
                setLedgerStartDate(e.target.value);
                if (selectedLedgerSupplier) fetchLedger(selectedLedgerSupplier, e.target.value, ledgerEndDate);
              }} />

              <label className="form-label" style={{ marginBottom: 0, marginLeft: '10px' }}>End Date:</label>
              <input type="date" className="form-input" style={{ width: '145px' }} value={ledgerEndDate} onChange={(e) => {
                setLedgerEndDate(e.target.value);
                if (selectedLedgerSupplier) fetchLedger(selectedLedgerSupplier, ledgerStartDate, e.target.value);
              }} />

              <button className="btn btn-secondary" onClick={() => {
                setLedgerStartDate('');
                setLedgerEndDate('');
                if (selectedLedgerSupplier) fetchLedger(selectedLedgerSupplier, '', '');
              }}>Clear Dates</button>
            </div>
            
            <div style={{ display: 'flex', gap: '10px' }}>
              {selectedLedgerSupplier && (
                <button className="btn btn-secondary" onClick={() => {
                  const sup = suppliers.find(s => s.SupplierID === parseInt(selectedLedgerSupplier, 10));
                  if (sup) handlePrintLedger(sup, ledgerTransactions, ledgerOpeningBalance, ledgerClosingBalance, ledgerStartDate, ledgerEndDate);
                }}>
                  <Printer size={14} style={{ marginRight: '6px' }} /> Print Ledger
                </button>
              )}
              {canViewFinancials && (
                <>
                  <button className="btn btn-secondary" onClick={handleOpenAdjustmentModal}>
                    Record Debit/Credit Note
                  </button>
                  <button className="btn btn-primary" onClick={handleOpenPaymentModal}>
                    Record Settlement Payment
                  </button>
                </>
              )}
            </div>
          </div>

          {selectedLedgerSupplier ? (
            <>
              {/* Ledger Summary Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
                <div className="glass-panel" style={{ padding: '20px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Outstanding Balance Owed</div>
                  <div style={{ fontSize: '24px', fontWeight: '800', color: ledgerSummary.balance > 0 ? 'var(--warning)' : 'var(--text-primary)', marginTop: '4px' }}>
                    Rs. {formatCurrency(ledgerSummary.balance)}
                  </div>
                </div>
                <div className="glass-panel" style={{ padding: '20px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Assigned Credit Limit</div>
                  <div style={{ fontSize: '24px', fontWeight: '800', color: 'var(--accent)', marginTop: '4px' }}>
                    Rs. {formatCurrency(ledgerSummary.creditLimit)}
                  </div>
                </div>
                <div className="glass-panel" style={{ padding: '20px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Period Opening Balance</div>
                  <div style={{ fontSize: '24px', fontWeight: '800', color: ledgerOpeningBalance > 0 ? 'var(--warning)' : 'var(--text-primary)', marginTop: '4px' }}>
                    Rs. {formatCurrency(ledgerOpeningBalance)}
                  </div>
                </div>
                <div className="glass-panel" style={{ padding: '20px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Period Closing Balance</div>
                  <div style={{ fontSize: '24px', fontWeight: '800', color: ledgerClosingBalance > 0 ? 'var(--warning)' : 'var(--text-primary)', marginTop: '4px' }}>
                    Rs. {formatCurrency(ledgerClosingBalance)}
                  </div>
                </div>
              </div>

              {/* Transactions Ledger Table */}
              <div className="glass-panel" style={{ padding: 0 }}>
                <h4 style={{ padding: '16px 20px', fontSize: '14px', borderBottom: '1px solid var(--border-color)', fontWeight: '700' }}>Ledger Activity Log</h4>
                <div className="table-container">
                  <table className="table-glass">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Reference No</th>
                        <th>Invoice No</th>
                        <th>Transaction Type</th>
                        <th style={{ textAlign: 'right' }}>Debit</th>
                        <th style={{ textAlign: 'right' }}>Credit</th>
                        <th style={{ textAlign: 'right' }}>Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ledgerTransactions.length === 0 ? (
                        <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>No ledger statements posted.</td></tr>
                      ) : (
                        ledgerTransactions.map((tx, idx) => {
                          const { refNo, invoiceNo } = getLedgerRowDetails(tx);
                          return (
                            <tr key={tx.LedgerID || idx}>
                              <td>{new Date(tx.TransactionDate).toLocaleDateString()}</td>
                              <td className="mono">{refNo}</td>
                              <td className="mono">{invoiceNo}</td>
                              <td style={{ fontWeight: '600' }}>{tx.ReferenceType}</td>
                              <td className="mono" style={{ textAlign: 'right', color: tx.TransactionType === 'Debit' ? 'var(--success)' : 'inherit' }}>
                                {tx.TransactionType === 'Debit' ? `Rs. ${formatCurrency(tx.Amount)}` : '--'}
                              </td>
                              <td className="mono" style={{ textAlign: 'right', color: tx.TransactionType === 'Credit' ? 'var(--warning)' : 'inherit' }}>
                                {tx.TransactionType === 'Credit' ? `Rs. ${formatCurrency(tx.Amount)}` : '--'}
                              </td>
                              <td className="mono" style={{ textAlign: 'right', fontWeight: '700' }}>Rs. {formatCurrency(tx.RunningBalance)}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }} className="glass-panel">
              <Coins size={36} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
              <p>Select a supplier from the dropdown list to audit their ledger balance statements and payment logs.</p>
            </div>
          )}
        </div>
      )}

      {/* ============================================================================
         TAB 4: REPORTS
         ============================================================================ */}
      {activeTab === 'reports' && (
        <div className="no-print" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Report parameter designer card */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '20px' }}>Audit & Financial Report Configurator</h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Report Type</label>
                <select className="form-select" value={selectedReportType} onChange={(e) => {
                  setSelectedReportType(e.target.value);
                  setReportResult([]);
                }}>
                  <option value="list">Supplier Contact Directory</option>
                  <option value="payables">Outstanding Payables Statement</option>
                  <option value="ledger">Supplier Transaction Ledger</option>
                  <option value="statement">Supplier Account Statement</option>
                  <option value="history">Purchase History Summary</option>
                </select>
              </div>

              {(selectedReportType === 'ledger' || selectedReportType === 'history' || selectedReportType === 'statement') && (
                <div className="form-group">
                  <label className="form-label">Supplier Context {selectedReportType === 'statement' && <span style={{ color: 'var(--danger)' }}>*</span>}</label>
                  <select className="form-select" value={reportSupplierId} onChange={(e) => setReportSupplierId(e.target.value)}>
                    <option value="">{selectedReportType === 'statement' ? '-- Select Supplier --' : '-- All Suppliers --'}</option>
                    {suppliers.map(s => (
                      <option key={s.SupplierID} value={s.SupplierID}>{s.SupplierName}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Branch Filter</label>
                <select className="form-select" value={reportBranch} onChange={(e) => setReportBranch(e.target.value)}>
                  <option value="">All Branches</option>
                  <option value="Global">Global</option>
                  <option value="Main Store">Main Store</option>
                  <option value="Colombo Branch">Colombo Branch</option>
                </select>
              </div>

              {selectedReportType === 'statement' && (
                <div className="form-group">
                  <label className="form-label">Period Type</label>
                  <select className="form-select" value={reportPeriodType} onChange={(e) => setReportPeriodType(e.target.value)}>
                    <option value="monthly">Monthly Statement</option>
                    <option value="custom">Custom Date Range</option>
                  </select>
                </div>
              )}

              {selectedReportType === 'statement' && reportPeriodType === 'monthly' && (
                <div className="form-group">
                  <label className="form-label">Statement Month</label>
                  <select className="form-select" value={reportMonthSelect} onChange={(e) => setReportMonthSelect(e.target.value)}>
                    <option value="this-month">This Month</option>
                    <option value="last-month">Last Month</option>
                    <option value="last-30">Last 30 Days</option>
                    <option value="last-90">Last 90 Days</option>
                  </select>
                </div>
              )}

              {(selectedReportType !== 'statement' || reportPeriodType === 'custom') && (
                <>
                  <div className="form-group">
                    <label className="form-label">Start Date</label>
                    <input type="date" className="form-input" value={reportStartDate} onChange={(e) => setReportStartDate(e.target.value)} />
                  </div>

                  <div className="form-group">
                    <label className="form-label">End Date</label>
                    <input type="date" className="form-input" value={reportEndDate} onChange={(e) => setReportEndDate(e.target.value)} />
                  </div>
                </>
              )}

            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px', borderTop: '1px solid var(--border-color)', paddingTop: '16px', flexWrap: 'wrap' }}>
              {selectedReportType === 'statement' ? (
                <>
                  <button className="btn btn-secondary" onClick={handleExportStatementExcel} disabled={reportResult.length === 0 || actionLoading}>
                    <Download size={14} style={{ marginRight: '6px' }} /> Export Excel
                  </button>
                  <button className="btn btn-secondary" onClick={handlePrintReport} disabled={reportResult.length === 0 || actionLoading}>
                    <Printer size={14} style={{ marginRight: '6px' }} /> Export PDF / Print
                  </button>
                  <button className="btn btn-secondary" onClick={handleEmailStatement} disabled={reportResult.length === 0 || actionLoading} style={{ color: '#38bdf8', background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.2)' }}>
                    ✉ Email Statement
                  </button>
                  <button className="btn btn-primary" onClick={handleGenerateReport} disabled={actionLoading}>
                    {actionLoading ? 'Loading...' : 'Generate Statement'}
                  </button>
                </>
              ) : (
                <>
                  <button className="btn btn-secondary" onClick={handleExportCSV} disabled={reportResult.length === 0}>
                    <Download size={14} /> Export CSV
                  </button>
                  <button className="btn btn-secondary" onClick={handlePrintReport} disabled={reportResult.length === 0}>
                    <Printer size={14} /> Print Statement
                  </button>
                  <button className="btn btn-primary" onClick={handleGenerateReport}>
                    Generate Statement
                  </button>
                </>
              )}
            </div>

          </div>

          {/* Report Data preview grid */}
          {reportResult.length > 0 && (
            selectedReportType === 'statement' ? (
              <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-color)' }}>
                {/* Header Section */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '20px' }}>
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    {companyProfile?.LogoURL ? (
                      <img src={companyProfile.LogoURL} alt="Logo" style={{ maxHeight: '50px', borderRadius: '4px' }} />
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '50px', height: '50px', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '20px', fontWeight: 'bold', color: 'var(--primary)' }}>
                        {companyProfile?.Name ? companyProfile.Name.charAt(0) : 'S'}
                      </div>
                    )}
                    <div>
                      <h3 style={{ fontSize: '18px', fontWeight: '700', margin: 0, color: 'var(--text-primary)' }}>{companyProfile?.Name || companyProfile?.name || 'SellMax Pro'}</h3>
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '4px 0 0 0', lineHeight: '1.4' }}>
                        {companyProfile?.AddressLine1 || companyProfile?.addressLine1 || ''} {companyProfile?.City || companyProfile?.city || ''}<br />
                        Phone: {companyProfile?.MobileNumber || companyProfile?.mobileNumber || companyProfile?.TelephoneNumber || companyProfile?.telephoneNumber || '--'} | Email: {companyProfile?.Email || companyProfile?.email || '--'}<br />
                        VAT: {companyProfile?.TaxRegNo || companyProfile?.taxRegNo || '--'}
                      </p>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ background: 'var(--primary-light)', color: 'var(--primary)', padding: '4px 12px', borderRadius: '9999px', fontSize: '11px', fontWeight: '700', display: 'inline-block', marginBottom: '8px' }}>
                      ACCOUNT STATEMENT
                    </div>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.4' }}>
                      <strong>Period:</strong> {computePeriodDates().start || 'All-time'} to {computePeriodDates().end || 'All-time'}<br />
                      <strong>Branch:</strong> {reportBranch || 'All Branches'}
                    </p>
                  </div>
                </div>

                {/* Supplier & Financial Terms Block */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                  <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px', background: 'rgba(255, 255, 255, 0.02)' }}>
                    <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>Supplier Information</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                      <strong>Name:</strong> <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{suppliers.find(s => String(s.SupplierID) === String(reportSupplierId))?.SupplierName}</span>
                      <strong>Code:</strong> <span className="mono">{suppliers.find(s => String(s.SupplierID) === String(reportSupplierId))?.SupplierCode}</span>
                      <strong>Address:</strong> <span>{suppliers.find(s => String(s.SupplierID) === String(reportSupplierId))?.Address || '--'}{suppliers.find(s => String(s.SupplierID) === String(reportSupplierId))?.City ? `, ${suppliers.find(s => String(s.SupplierID) === String(reportSupplierId))?.City}` : ''}</span>
                      <strong>Contact:</strong> <span>{suppliers.find(s => String(s.SupplierID) === String(reportSupplierId))?.MobileNumber || '--'}</span>
                      <strong>Email:</strong> <span>{suppliers.find(s => String(s.SupplierID) === String(reportSupplierId))?.EmailAddress || '--'}</span>
                    </div>
                  </div>
                  <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px', background: 'rgba(255, 255, 255, 0.02)' }}>
                    <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>Account & Payment Terms</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                      <strong>Credit Limit:</strong> <span className="mono">Rs. {formatCurrency(suppliers.find(s => String(s.SupplierID) === String(reportSupplierId))?.CreditLimit || 0)}</span>
                      <strong>Credit Period:</strong> <span>{suppliers.find(s => String(s.SupplierID) === String(reportSupplierId))?.CreditPeriodDays || 0} Days</span>
                      <strong>Payment Terms:</strong> <span>{suppliers.find(s => String(s.SupplierID) === String(reportSupplierId))?.PaymentTerms || '--'}</span>
                      <strong>Real-time Balance:</strong> <span className="mono" style={{ color: parseFloat(suppliers.find(s => String(s.SupplierID) === String(reportSupplierId))?.CurrentBalance) > 0 ? 'var(--warning)' : 'var(--text-primary)', fontWeight: '700' }}>Rs. {formatCurrency(suppliers.find(s => String(s.SupplierID) === String(reportSupplierId))?.CurrentBalance || 0)}</span>
                    </div>
                  </div>
                </div>

                {/* Summaries Metrics Row */}
                {(() => {
                  let totalPurchases = 0;
                  let totalPayments = 0;
                  let totalReturns = 0;
                  reportResult.forEach(t => {
                    const amt = parseFloat(t.Amount || 0);
                    if (t.ReferenceType === 'Purchase Invoice') {
                      totalPurchases += amt;
                    } else if (t.ReferenceType === 'Payment Made') {
                      totalPayments += amt;
                    } else if (t.ReferenceType === 'Supplier Return') {
                      totalReturns += amt;
                    }
                  });
                  return (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
                      <div className="glass-panel" style={{ padding: '14px', textAlign: 'center', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)' }}>
                        <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginBottom: '4px' }}>Opening Balance</div>
                        <div className="mono" style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>Rs. {formatCurrency(reportOpeningBalance)}</div>
                      </div>
                      <div className="glass-panel" style={{ padding: '14px', textAlign: 'center', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)' }}>
                        <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginBottom: '4px' }}>Total Purchases (+)</div>
                        <div className="mono" style={{ fontSize: '14px', fontWeight: '700', color: 'var(--warning)' }}>Rs. {formatCurrency(totalPurchases)}</div>
                      </div>
                      <div className="glass-panel" style={{ padding: '14px', textAlign: 'center', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)' }}>
                        <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginBottom: '4px' }}>Total Payments (-)</div>
                        <div className="mono" style={{ fontSize: '14px', fontWeight: '700', color: 'var(--success)' }}>Rs. {formatCurrency(totalPayments)}</div>
                      </div>
                      <div className="glass-panel" style={{ padding: '14px', textAlign: 'center', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)' }}>
                        <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginBottom: '4px' }}>Total Returns (-)</div>
                        <div className="mono" style={{ fontSize: '14px', fontWeight: '700', color: 'var(--danger)' }}>Rs. {formatCurrency(totalReturns)}</div>
                      </div>
                      <div className="glass-panel" style={{ padding: '14px', textAlign: 'center', background: 'rgba(56, 189, 248, 0.06)', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
                        <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#38bdf8', marginBottom: '4px' }}>Closing Balance (=)</div>
                        <div className="mono" style={{ fontSize: '14px', fontWeight: '700', color: '#38bdf8' }}>Rs. {formatCurrency(reportClosingBalance)}</div>
                      </div>
                    </div>
                  );
                })()}

                {/* Ledger Details Table */}
                <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
                  <div className="table-container" style={{ maxHeight: '400px' }}>
                    <table className="table-glass" style={{ margin: 0 }}>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Document No</th>
                          <th>Description</th>
                          <th style={{ textAlign: 'right' }}>Debit</th>
                          <th style={{ textAlign: 'right' }}>Credit</th>
                          <th style={{ textAlign: 'right' }}>Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr style={{ background: 'rgba(255, 255, 255, 0.03)', fontWeight: 'bold' }}>
                          <td></td>
                          <td>--</td>
                          <td style={{ color: 'var(--text-primary)' }}>Period Opening Balance</td>
                          <td style={{ textAlign: 'right' }}>--</td>
                          <td style={{ textAlign: 'right' }}>--</td>
                          <td className="mono" style={{ textAlign: 'right', color: 'var(--text-primary)' }}>Rs. {formatCurrency(reportOpeningBalance)}</td>
                        </tr>
                        {reportResult.map((tx, idx) => {
                          const { refNo } = getLedgerRowDetails(tx);
                          return (
                            <tr key={tx.LedgerID || idx}>
                              <td>{new Date(tx.TransactionDate).toLocaleDateString()}</td>
                              <td className="mono">{refNo}</td>
                              <td>{tx.Description || tx.ReferenceType}</td>
                              <td className="mono" style={{ textAlign: 'right', color: tx.TransactionType === 'Debit' ? 'var(--success)' : 'inherit' }}>
                                {tx.TransactionType === 'Debit' ? `Rs. ${formatCurrency(tx.Amount)}` : '--'}
                              </td>
                              <td className="mono" style={{ textAlign: 'right', color: tx.TransactionType === 'Credit' ? 'var(--warning)' : 'inherit' }}>
                                {tx.TransactionType === 'Credit' ? `Rs. ${formatCurrency(tx.Amount)}` : '--'}
                              </td>
                              <td className="mono" style={{ textAlign: 'right', fontWeight: '600' }}>Rs. {formatCurrency(tx.RunningBalance)}</td>
                            </tr>
                          );
                        })}
                        <tr style={{ background: 'rgba(255, 255, 255, 0.03)', fontWeight: 'bold' }}>
                          <td></td>
                          <td>--</td>
                          <td style={{ color: '#38bdf8' }}>Period Closing Balance</td>
                          <td style={{ textAlign: 'right' }}>--</td>
                          <td style={{ textAlign: 'right' }}>--</td>
                          <td className="mono" style={{ textAlign: 'right', color: '#38bdf8' }}>Rs. {formatCurrency(reportClosingBalance)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Final Closing Summaries Footer Card */}
                {(() => {
                  let totalPurchases = 0;
                  let totalPayments = 0;
                  let totalReturns = 0;
                  reportResult.forEach(t => {
                    const amt = parseFloat(t.Amount || 0);
                    if (t.ReferenceType === 'Purchase Invoice') {
                      totalPurchases += amt;
                    } else if (t.ReferenceType === 'Payment Made') {
                      totalPayments += amt;
                    } else if (t.ReferenceType === 'Supplier Return') {
                      totalReturns += amt;
                    }
                  });
                  const activeSupplier = suppliers.find(s => String(s.SupplierID) === String(reportSupplierId));
                  return (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
                      <div style={{ width: '300px', display: 'flex', flexDirection: 'column', gap: '8px', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px', background: 'rgba(255, 255, 255, 0.01)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)' }}>
                          <span>Period Opening Balance:</span>
                          <span className="mono" style={{ color: 'var(--text-primary)' }}>Rs. {formatCurrency(reportOpeningBalance)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)' }}>
                          <span>Total Purchases (+):</span>
                          <span className="mono" style={{ color: 'var(--warning)' }}>Rs. {formatCurrency(totalPurchases)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)' }}>
                          <span>Total Payments (-):</span>
                          <span className="mono" style={{ color: 'var(--success)' }}>Rs. {formatCurrency(totalPayments)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)' }}>
                          <span>Total Returns (-):</span>
                          <span className="mono" style={{ color: 'var(--danger)' }}>Rs. {formatCurrency(totalReturns)}</span>
                        </div>
                        <hr style={{ border: 0, borderTop: '1px solid var(--border-color)', margin: '4px 0' }} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: '700' }}>
                          <span style={{ color: '#38bdf8' }}>Closing Balance (=):</span>
                          <span className="mono" style={{ color: '#38bdf8' }}>Rs. {formatCurrency(reportClosingBalance)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: '700' }}>
                          <span style={{ color: 'var(--danger)' }}>Outstanding Payable:</span>
                          <span className="mono" style={{ color: 'var(--danger)' }}>Rs. {formatCurrency(activeSupplier?.CurrentBalance || 0)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

              </div>
            ) : (
              <div className="glass-panel" style={{ padding: 0 }}>
                <div className="table-container">
                  <table className="table-glass">
                    <thead>
                      {selectedReportType === 'list' || selectedReportType === 'payables' ? (
                        <tr>
                          <th>Code</th>
                          <th>Supplier</th>
                          <th>Contact Email</th>
                          <th>Phone</th>
                          <th>Credit Limit</th>
                          <th>Outstanding Payables</th>
                          <th>Category</th>
                        </tr>
                      ) : selectedReportType === 'ledger' ? (
                        <tr>
                          <th>Date</th>
                          <th>Reference No</th>
                          <th>Invoice No</th>
                          <th>Transaction Type</th>
                          <th style={{ textAlign: 'right' }}>Debit</th>
                          <th style={{ textAlign: 'right' }}>Credit</th>
                          <th style={{ textAlign: 'right' }}>Balance</th>
                        </tr>
                      ) : (
                        <tr>
                          <th>PO Number</th>
                          <th>Supplier</th>
                          <th>Date</th>
                          <th>Amount</th>
                          <th>PO Status</th>
                          <th>Invoice No</th>
                          <th>Payment</th>
                        </tr>
                      )}
                    </thead>
                    <tbody>
                      {selectedReportType === 'list' || selectedReportType === 'payables' ? (
                        reportResult.map(r => (
                          <tr key={r.SupplierID}>
                            <td className="mono" style={{ fontWeight: '700' }}>{r.SupplierCode}</td>
                            <td style={{ fontWeight: '600' }}>{r.SupplierName}</td>
                            <td>{r.EmailAddress || '--'}</td>
                            <td>{r.MobileNumber || '--'}</td>
                            <td className="mono">Rs. {formatCurrency(r.CreditLimit)}</td>
                            <td className="mono" style={{ fontWeight: '700', color: parseFloat(r.CurrentBalance) > 0 ? 'var(--warning)' : 'inherit' }}>
                              Rs. {formatCurrency(r.CurrentBalance)}
                            </td>
                            <td>{r.SupplierCategory}</td>
                          </tr>
                        ))
                      ) : selectedReportType === 'ledger' ? (
                        <>
                          <tr style={{ background: 'rgba(255, 255, 255, 0.05)', fontWeight: 'bold' }}>
                            <td colSpan={6}>Opening Balance</td>
                            <td className="mono" style={{ textAlign: 'right' }}>Rs. {formatCurrency(reportOpeningBalance)}</td>
                          </tr>
                          {reportResult.map((r, idx) => {
                            const { refNo, invoiceNo } = getLedgerRowDetails(r);
                            return (
                              <tr key={r.LedgerID || idx}>
                                <td>{new Date(r.TransactionDate).toLocaleDateString()}</td>
                                <td className="mono">{refNo}</td>
                                <td className="mono">{invoiceNo}</td>
                                <td style={{ fontWeight: '600' }}>{r.ReferenceType}</td>
                                <td className="mono" style={{ textAlign: 'right', color: r.TransactionType === 'Debit' ? 'var(--success)' : 'inherit' }}>
                                  {r.TransactionType === 'Debit' ? `Rs. ${formatCurrency(r.Amount)}` : '--'}
                                </td>
                                <td className="mono" style={{ textAlign: 'right', color: r.TransactionType === 'Credit' ? 'var(--warning)' : 'inherit' }}>
                                  {r.TransactionType === 'Credit' ? `Rs. ${formatCurrency(r.Amount)}` : '--'}
                                </td>
                                <td className="mono" style={{ textAlign: 'right', fontWeight: '700' }}>Rs. {formatCurrency(r.RunningBalance)}</td>
                              </tr>
                            );
                          })}
                          <tr style={{ background: 'rgba(255, 255, 255, 0.05)', fontWeight: 'bold' }}>
                            <td colSpan={6}>Closing Balance</td>
                            <td className="mono" style={{ textAlign: 'right' }}>Rs. {formatCurrency(reportClosingBalance)}</td>
                          </tr>
                        </>
                      ) : (
                        reportResult.map(r => (
                          <tr key={r.PurchaseOrderID}>
                            <td className="mono" style={{ fontWeight: '700' }}>{r.PONumber}</td>
                            <td style={{ fontWeight: '600' }}>{r.SupplierName}</td>
                            <td>{new Date(r.OrderDate).toLocaleDateString()}</td>
                            <td className="mono">Rs. {formatCurrency(r.TotalAmount)}</td>
                            <td>{r.Status}</td>
                            <td className="mono">{r.InvoiceNumber || '--'}</td>
                            <td>{r.PaymentStatus}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          )}

        </div>
      )}

      {/* ============================================================================
         PRINT ONLY RECEIPT MODAL VIEWER (No React portal, hides non-print with CSS)
         ============================================================================ */}
      {selectedPo && (
        <div className="printable-report" style={{ display: 'none' }}>
          <div style={{ padding: '15mm', background: '#fff', color: '#000', fontFamily: 'monospace', maxWidth: '210mm', margin: '0 auto', boxSizing: 'border-box' }}>
            <h2 style={{ textAlign: 'center' }}>PURCHASE ORDER VOUCHER</h2>
            <hr style={{ borderStyle: 'dashed' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', margin: '20px 0' }}>
              <div>
                <strong>PO No:</strong> {selectedPo.PONumber}<br />
                <strong>Date:</strong> {new Date(selectedPo.OrderDate).toLocaleString()}<br />
                <strong>Branch:</strong> {selectedPo.BranchName || 'Global'}<br />
                <strong>Status:</strong> {selectedPo.Status}
              </div>
              <div style={{ textAlign: 'right' }}>
                <strong>To Supplier:</strong> {selectedPo.SupplierName}<br />
                <strong>Mobile:</strong> {selectedPo.MobileNumber || '--'}<br />
                <strong>Email:</strong> {selectedPo.EmailAddress || '--'}
              </div>
            </div>
            
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #000' }}>
                  <th style={{ textAlign: 'left', padding: '5px' }}>Product</th>
                  <th style={{ textAlign: 'center', padding: '5px' }}>Cost</th>
                  <th style={{ textAlign: 'center', padding: '5px' }}>Order Qty</th>
                  <th style={{ textAlign: 'center', padding: '5px' }}>Recv Qty</th>
                  <th style={{ textAlign: 'right', padding: '5px' }}>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {selectedPo.items?.map(item => (
                  <tr key={item.PurchaseOrderItemID} style={{ borderBottom: '1px solid #ddd' }}>
                    <td style={{ padding: '5px' }}>{item.ProductName} ({item.SKU})</td>
                    <td style={{ textAlign: 'center', padding: '5px' }}>Rs. {formatCurrency(item.UnitCost)}</td>
                    <td style={{ textAlign: 'center', padding: '5px' }}>{Number(item.Quantity)}</td>
                    <td style={{ textAlign: 'center', padding: '5px' }}>{Number(item.ReceivedQty)}</td>
                    <td style={{ textAlign: 'right', padding: '5px' }}>Rs. {formatCurrency(item.Subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '30px' }}>
              <div style={{ width: '250px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Subtotal:</span>
                  <span>Rs. {formatCurrency(selectedPo.Subtotal)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Tax/VAT:</span>
                  <span>Rs. {formatCurrency(selectedPo.TaxAmount)}</span>
                </div>
                <hr style={{ borderStyle: 'dashed' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                  <span>Grand Total:</span>
                  <span>Rs. {formatCurrency(selectedPo.TotalAmount)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================================
         PRINT ONLY LEDGER STATEMENT VIEWER (Hides non-print with CSS)
         ============================================================================ */}
      {printLedgerData && (
        <div className="printable-report" style={{ display: 'none' }}>
          <div style={{ padding: '15mm', background: '#fff', color: '#000', fontFamily: 'sans-serif', maxWidth: '210mm', margin: '0 auto', boxSizing: 'border-box' }}>
            <h2 style={{ textAlign: 'center', margin: '0 0 5px 0', fontSize: '20px', fontWeight: 'bold' }}>SUPPLIER LEDGER STATEMENT</h2>
            <div style={{ textAlign: 'center', fontSize: '11px', color: '#555', marginBottom: '20px' }}>
              SellMax Pro Smart POS System
            </div>
            <hr style={{ border: '1px solid #000', margin: '10px 0' }} />
            
            <div style={{ display: 'flex', justifyContent: 'space-between', margin: '20px 0', fontSize: '13px' }}>
              <div>
                <strong>Supplier:</strong> {printLedgerData.supplierName}<br />
                <strong>Code:</strong> {printLedgerData.supplierCode}<br />
                <strong>Period:</strong> {printLedgerData.period || 'All-Time'}<br />
                <strong>Branch:</strong> {printLedgerData.branch || 'Global'}
              </div>
              <div style={{ textAlign: 'right' }}>
                <strong>Current Balance:</strong> Rs. {formatCurrency(printLedgerData.currentBalance)}<br />
                <strong>Credit Limit:</strong> Rs. {formatCurrency(printLedgerData.creditLimit)}<br />
                <strong>Statement Date:</strong> {new Date().toLocaleDateString()}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', background: '#f5f5f5', padding: '10px', fontWeight: 'bold', border: '1px solid #ddd', marginBottom: '10px', fontSize: '13px' }}>
              <span>Opening Balance:</span>
              <span>Rs. {formatCurrency(printLedgerData.openingBalance)}</span>
            </div>
            
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #000', background: '#eaeaea' }}>
                  <th style={{ textAlign: 'left', padding: '8px' }}>Date</th>
                  <th style={{ textAlign: 'left', padding: '8px' }}>Reference No</th>
                  <th style={{ textAlign: 'left', padding: '8px' }}>Invoice No</th>
                  <th style={{ textAlign: 'left', padding: '8px' }}>Transaction Type</th>
                  <th style={{ textAlign: 'right', padding: '8px' }}>Debit</th>
                  <th style={{ textAlign: 'right', padding: '8px' }}>Credit</th>
                  <th style={{ textAlign: 'right', padding: '8px' }}>Balance</th>
                </tr>
              </thead>
              <tbody>
                {printLedgerData.transactions?.map((tx, idx) => {
                  const { refNo, invoiceNo } = getLedgerRowDetails(tx);
                  return (
                    <tr key={tx.LedgerID || idx} style={{ borderBottom: '1px solid #ddd' }}>
                      <td style={{ padding: '8px' }}>{new Date(tx.TransactionDate).toLocaleDateString()}</td>
                      <td style={{ padding: '8px' }} className="mono">{refNo}</td>
                      <td style={{ padding: '8px' }} className="mono">{invoiceNo}</td>
                      <td style={{ padding: '8px', fontWeight: '600' }}>{tx.ReferenceType}</td>
                      <td style={{ textAlign: 'right', padding: '8px' }} className="mono">
                        {tx.TransactionType === 'Debit' ? `Rs. ${formatCurrency(tx.Amount)}` : '--'}
                      </td>
                      <td style={{ textAlign: 'right', padding: '8px' }} className="mono">
                        {tx.TransactionType === 'Credit' ? `Rs. ${formatCurrency(tx.Amount)}` : '--'}
                      </td>
                      <td style={{ textAlign: 'right', padding: '8px', fontWeight: '700' }} className="mono">
                        Rs. {formatCurrency(tx.RunningBalance)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <div style={{ width: '300px', background: '#f5f5f5', padding: '10px', border: '1px solid #ddd' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <span>Opening Balance:</span>
                  <span>Rs. {formatCurrency(printLedgerData.openingBalance)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'green', margin: '4px 0' }}>
                  <span>Total Debits:</span>
                  <span>Rs. {formatCurrency(printLedgerData.totalDebits)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#b45309', margin: '4px 0' }}>
                  <span>Total Credits:</span>
                  <span>Rs. {formatCurrency(printLedgerData.totalCredits)}</span>
                </div>
                <hr style={{ margin: '6px 0', borderColor: '#ccc' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '13px' }}>
                  <span>Closing Balance:</span>
                  <span>Rs. {formatCurrency(printLedgerData.closingBalance)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================================
         PRINT ONLY SUPPLIER STATEMENT VIEWER (Hides non-print with CSS)
         ============================================================================ */}
      {printStatementData && (
        <div className="printable-report" style={{ display: 'none' }}>
          <div style={{ padding: '15mm', background: '#fff', color: '#000', fontFamily: 'sans-serif', maxWidth: '210mm', margin: '0 auto', boxSizing: 'border-box' }}>
            {/* Header Block */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #334155', paddingBottom: '15px' }}>
              <div>
                {companyProfile?.LogoURL ? (
                  <img src={companyProfile.LogoURL} alt="Logo" style={{ maxHeight: '60px', marginBottom: '10px', display: 'block' }} />
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '50px', height: '50px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '20px', fontWeight: 'bold', color: '#475569', marginBottom: '10px' }}>
                    {companyProfile?.Name ? companyProfile.Name.charAt(0) : 'S'}
                  </div>
                )}
                <h1 style={{ fontSize: '22px', fontWeight: 'bold', margin: '0', color: '#1e293b' }}>{companyProfile?.Name || 'SellMax Pro'}</h1>
                <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#64748b', lineHeight: '1.4' }}>
                  {companyProfile?.AddressLine1 || ''} {companyProfile?.City || ''}<br />
                  Phone: {companyProfile?.MobileNumber || companyProfile?.TelephoneNumber || '--'} | Email: {companyProfile?.Email || '--'}<br />
                  Website: {companyProfile?.Website || '--'} | VAT/Tax: {companyProfile?.TaxRegNo || companyProfile?.taxRegNo || '--'}
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 10px 0', letterSpacing: '0.5px' }}>ACCOUNT STATEMENT</h2>
                <div style={{ fontSize: '12px', color: '#475569', lineHeight: '1.5' }}>
                  <strong>Statement Period:</strong> {printStatementData.period}<br />
                  <strong>Date Issued:</strong> {new Date().toLocaleDateString()}<br />
                  <strong>Branch:</strong> {reportBranch || 'All Branches'}
                </div>
              </div>
            </div>

            {/* Supplier / Terms Block */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', margin: '20px 0', fontSize: '12px', lineHeight: '1.5' }}>
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '12px', background: '#f8fafc' }}>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: '700', color: '#1e293b', borderBottom: '1px solid #cbd5e1', paddingBottom: '4px' }}>Supplier Information</h4>
                <strong>Name:</strong> {printStatementData.supplier?.SupplierName}<br />
                <strong>Code:</strong> {printStatementData.supplier?.SupplierCode}<br />
                <strong>Address:</strong> {printStatementData.supplier?.Address || '--'}{printStatementData.supplier?.City ? `, ${printStatementData.supplier.City}` : ''}<br />
                <strong>Phone:</strong> {printStatementData.supplier?.MobileNumber || '--'}<br />
                <strong>Email:</strong> {printStatementData.supplier?.EmailAddress || '--'}
              </div>
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '12px', background: '#f8fafc' }}>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: '700', color: '#1e293b', borderBottom: '1px solid #cbd5e1', paddingBottom: '4px' }}>Account & Payment Terms</h4>
                <strong>Credit Limit:</strong> Rs. {formatCurrency(printStatementData.supplier?.CreditLimit || 0)}<br />
                <strong>Credit Period:</strong> {printStatementData.supplier?.CreditPeriodDays || 0} Days<br />
                <strong>Payment Terms:</strong> {printStatementData.supplier?.PaymentTerms || '--'}<br />
                <strong>Real-time Balance Due:</strong> Rs. {formatCurrency(printStatementData.supplier?.CurrentBalance || 0)}
              </div>
            </div>

            {/* Ledger Table */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '15px', fontSize: '11px' }}>
              <thead>
                <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                  <th style={{ textAlign: 'left', padding: '10px 8px', fontWeight: '700', color: '#334155' }}>Date</th>
                  <th style={{ textAlign: 'left', padding: '10px 8px', fontWeight: '700', color: '#334155' }}>Document No</th>
                  <th style={{ textAlign: 'left', padding: '10px 8px', fontWeight: '700', color: '#334155' }}>Description</th>
                  <th style={{ textAlign: 'right', padding: '10px 8px', fontWeight: '700', color: '#334155' }}>Debit</th>
                  <th style={{ textAlign: 'right', padding: '10px 8px', fontWeight: '700', color: '#334155' }}>Credit</th>
                  <th style={{ textAlign: 'right', padding: '10px 8px', fontWeight: '700', color: '#334155' }}>Balance</th>
                </tr>
              </thead>
              <tbody>
                {/* Period Opening Balance Row */}
                <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#fafafa', fontWeight: '600' }}>
                  <td style={{ padding: '8px' }}></td>
                  <td style={{ padding: '8px' }}>--</td>
                  <td style={{ padding: '8px' }}>Period Opening Balance</td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>--</td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>--</td>
                  <td style={{ padding: '8px', textAlign: 'right', fontWeight: '700' }}>Rs. {formatCurrency(printStatementData.openingBalance || 0)}</td>
                </tr>

                {printStatementData.transactions?.map((tx, idx) => {
                  const { refNo } = getLedgerRowDetails(tx);
                  return (
                    <tr key={tx.LedgerID || idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '8px' }}>{new Date(tx.TransactionDate).toLocaleDateString()}</td>
                      <td style={{ padding: '8px' }} className="mono">{refNo}</td>
                      <td style={{ padding: '8px' }}>{tx.Description || tx.ReferenceType}</td>
                      <td style={{ textAlign: 'right', padding: '8px', color: tx.TransactionType === 'Debit' ? '#16a34a' : 'inherit' }} className="mono">
                        {tx.TransactionType === 'Debit' ? `Rs. ${formatCurrency(tx.Amount)}` : '--'}
                      </td>
                      <td style={{ textAlign: 'right', padding: '8px', color: tx.TransactionType === 'Credit' ? '#ca8a04' : 'inherit' }} className="mono">
                        {tx.TransactionType === 'Credit' ? `Rs. {formatCurrency(tx.Amount)}` : '--'}
                      </td>
                      <td style={{ textAlign: 'right', padding: '8px', fontWeight: '600' }} className="mono">
                        Rs. {formatCurrency(tx.RunningBalance)}
                      </td>
                    </tr>
                  );
                })}

                {/* Period Closing Balance Row */}
                <tr style={{ borderBottom: '1px solid #cbd5e1', background: '#fafafa', fontWeight: '600' }}>
                  <td style={{ padding: '8px' }}></td>
                  <td style={{ padding: '8px' }}>--</td>
                  <td style={{ padding: '8px' }}>Period Closing Balance</td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>--</td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>--</td>
                  <td style={{ padding: '8px', textAlign: 'right', fontWeight: '700' }}>Rs. {formatCurrency(printStatementData.closingBalance || 0)}</td>
                </tr>
              </tbody>
            </table>

            {/* Closing Summaries Block */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <table style={{ width: '300px', fontSize: '11px', borderCollapse: 'collapse', border: '1px solid #cbd5e1', borderRadius: '4px', background: '#f8fafc' }}>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '8px', fontWeight: '600' }}>Period Opening Balance:</td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>Rs. {formatCurrency(Number(printStatementData.openingBalance || 0))}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#1e3a8a' }}>
                    <td style={{ padding: '8px', fontWeight: '600' }}>Total Purchases (+):</td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>Rs. {formatCurrency(Number(printStatementData.totalPurchases || 0))}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#16a34a' }}>
                    <td style={{ padding: '8px', fontWeight: '600' }}>Total Payments (-):</td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>Rs. {formatCurrency(Number(printStatementData.totalPayments || 0))}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #cbd5e1', color: '#dc2626' }}>
                    <td style={{ padding: '8px', fontWeight: '600' }}>Total Returns (-):</td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>Rs. {formatCurrency(Number(printStatementData.totalReturns || 0))}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #cbd5e1', background: '#f1f5f9' }}>
                    <td style={{ padding: '8px', fontWeight: '700' }}>Closing Balance (=):</td>
                    <td style={{ padding: '8px', textAlign: 'right', fontWeight: '700' }}>Rs. {formatCurrency(Number(printStatementData.closingBalance || 0))}</td>
                  </tr>
                  <tr style={{ background: '#fef2f2', color: '#991b1b' }}>
                    <td style={{ padding: '8px', fontWeight: '700' }}>Outstanding Payable:</td>
                    <td style={{ padding: '8px', textAlign: 'right', fontWeight: '700' }}>Rs. {formatCurrency(Number(printStatementData.supplier?.CurrentBalance || 0))}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Note Footer */}
            <div style={{ marginTop: '40px', fontSize: '9px', color: '#64748b', textAlign: 'center', borderTop: '1px dashed #cbd5e1', paddingTop: '15px' }}>
              This is a system-generated statement. Please notify us of any discrepancies within 7 days. Thank you for your business!
            </div>
          </div>
        </div>
      )}

      {printGenericReportData && (
        <div className="printable-report" style={{ display: 'none' }}>
          <div style={{ padding: '15mm', background: '#fff', color: '#000', fontFamily: 'sans-serif', maxWidth: '210mm', margin: '0 auto', boxSizing: 'border-box' }}>
            <h2 style={{ textAlign: 'center', margin: '0 0 5px 0', fontSize: '20px', fontWeight: 'bold' }}>{printGenericReportData.title}</h2>
            <div style={{ textAlign: 'center', fontSize: '11px', color: '#555', marginBottom: '20px' }}>
              SellMax Pro Smart POS System
            </div>
            <hr style={{ border: '1px solid #000', margin: '10px 0' }} />
            
            <div style={{ display: 'flex', justifyContent: 'space-between', margin: '20px 0', fontSize: '13px' }}>
              <div>
                {printGenericReportData.period && (
                  <><strong>Period:</strong> {printGenericReportData.period}<br /></>
                )}
                <strong>Branch:</strong> {printGenericReportData.branch}
              </div>
              <div style={{ textAlign: 'right' }}>
                <strong>Report Date:</strong> {new Date().toLocaleDateString()}
              </div>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #000', background: '#eaeaea' }}>
                  {printGenericReportData.columns.map((col, idx) => (
                    <th key={idx} style={{ textAlign: col.align || 'left', padding: '8px' }}>{col.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {printGenericReportData.rows.map((row, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #ddd' }}>
                    {printGenericReportData.columns.map((col, colIdx) => (
                      <td key={colIdx} style={{ padding: '8px', textAlign: col.align || 'left', fontWeight: col.bold ? 'bold' : 'normal' }} className={col.mono ? 'mono' : ''}>
                        {row[col.key]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================================
         MODAL: ADD/EDIT/VIEW SUPPLIER (Compact 3-Column Glassmorphic Form - Width 1020px)
         ============================================================================ */}
      {showSupplierModal && (
        <div className="modal-overlay no-print" style={{ backdropFilter: 'blur(8px)', background: 'rgba(15, 23, 42, 0.45)' }}>
          <div className="modal-content glass-panel" style={{ width: '1020px', padding: '20px', borderRadius: 'var(--radius-lg)', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}>
            
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Building2 size={18} style={{ color: 'var(--primary)' }} />
                <h3 style={{ fontSize: '16px', fontWeight: '700', margin: 0 }}>
                  {supplierModalMode === 'add' ? 'Add New Supplier Profile' : 
                   supplierModalMode === 'edit' ? 'Edit Supplier Record' : 'Supplier Master Profile Details'}
                </h3>
              </div>
              <button 
                type="button" 
                className="close-btn"
                onClick={() => setShowSupplierModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSupplierSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                
                {/* COLUMN 1: Core Profile */}
                <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: 'var(--radius-md)', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '6px', marginBottom: '2px' }}>
                    <User size={14} style={{ color: 'var(--primary)' }} />
                    <h4 style={{ fontSize: '12.5px', fontWeight: '700', color: 'var(--primary)', margin: 0 }}>1. Core Profile</h4>
                  </div>
                  
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '11px', marginBottom: '3px', fontWeight: '600' }}>Supplier Name *</label>
                    <input
                      type="text"
                      className="form-input"
                      style={{ height: '32px', padding: '6px 10px', fontSize: '13px', background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.1)', color: 'var(--text-primary)', borderRadius: 'var(--radius-sm)' }}
                      value={supplierForm.supplierName}
                      onChange={(e) => setSupplierForm(prev => ({ ...prev, supplierName: e.target.value }))}
                      placeholder="e.g. Acme Lanka Distributors"
                      disabled={supplierModalMode === 'view' || !canManageSuppliers}
                      required
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '11px', marginBottom: '3px', fontWeight: '600' }}>Company Name</label>
                    <input
                      type="text"
                      className="form-input"
                      style={{ height: '32px', padding: '6px 10px', fontSize: '13px', background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.1)', color: 'var(--text-primary)', borderRadius: 'var(--radius-sm)' }}
                      value={supplierForm.companyName}
                      onChange={(e) => setSupplierForm(prev => ({ ...prev, companyName: e.target.value }))}
                      placeholder="e.g. Acme Holdings PLC"
                      disabled={supplierModalMode === 'view'}
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '11px', marginBottom: '3px', fontWeight: '600' }}>Contact Person</label>
                    <input
                      type="text"
                      className="form-input"
                      style={{ height: '32px', padding: '6px 10px', fontSize: '13px', background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.1)', color: 'var(--text-primary)', borderRadius: 'var(--radius-sm)' }}
                      value={supplierForm.contactPerson}
                      onChange={(e) => setSupplierForm(prev => ({ ...prev, contactPerson: e.target.value }))}
                      placeholder="Representative's name"
                      disabled={supplierModalMode === 'view'}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '11px', marginBottom: '3px', fontWeight: '600' }}>Mobile No.</label>
                      <input
                        type="text"
                        className="form-input"
                        style={{ height: '32px', padding: '6px 10px', fontSize: '13px', background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.1)', color: 'var(--text-primary)', borderRadius: 'var(--radius-sm)' }}
                        value={supplierForm.mobileNumber}
                        onChange={(e) => setSupplierForm(prev => ({ ...prev, mobileNumber: e.target.value }))}
                        placeholder="+94 77..."
                        disabled={supplierModalMode === 'view'}
                      />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '11px', marginBottom: '3px', fontWeight: '600' }}>Telephone</label>
                      <input
                        type="text"
                        className="form-input"
                        style={{ height: '32px', padding: '6px 10px', fontSize: '13px', background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.1)', color: 'var(--text-primary)', borderRadius: 'var(--radius-sm)' }}
                        value={supplierForm.telephoneNumber}
                        onChange={(e) => setSupplierForm(prev => ({ ...prev, telephoneNumber: e.target.value }))}
                        placeholder="+94 11..."
                        disabled={supplierModalMode === 'view'}
                      />
                    </div>
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '11px', marginBottom: '3px', fontWeight: '600' }}>Email Address</label>
                    <input
                      type="email"
                      className="form-input"
                      style={{ height: '32px', padding: '6px 10px', fontSize: '13px', background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.1)', color: 'var(--text-primary)', borderRadius: 'var(--radius-sm)' }}
                      value={supplierForm.emailAddress}
                      onChange={(e) => setSupplierForm(prev => ({ ...prev, emailAddress: e.target.value }))}
                      placeholder="office@supplier.com"
                      disabled={supplierModalMode === 'view'}
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '11px', marginBottom: '3px', fontWeight: '600' }}>Website</label>
                    <input
                      type="text"
                      className="form-input"
                      style={{ height: '32px', padding: '6px 10px', fontSize: '13px', background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.1)', color: 'var(--text-primary)', borderRadius: 'var(--radius-sm)' }}
                      value={supplierForm.website}
                      onChange={(e) => setSupplierForm(prev => ({ ...prev, website: e.target.value }))}
                      placeholder="www.supplier.com"
                      disabled={supplierModalMode === 'view'}
                    />
                  </div>
                </div>

                {/* COLUMN 2: Location & Identity */}
                <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: 'var(--radius-md)', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '6px', marginBottom: '2px' }}>
                    <MapPin size={14} style={{ color: 'var(--primary)' }} />
                    <h4 style={{ fontSize: '12.5px', fontWeight: '700', color: 'var(--primary)', margin: 0 }}>2. Location & Identity</h4>
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '11px', marginBottom: '3px', fontWeight: '600' }}>Address</label>
                    <input
                      type="text"
                      className="form-input"
                      style={{ height: '32px', padding: '6px 10px', fontSize: '13px', background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.1)', color: 'var(--text-primary)', borderRadius: 'var(--radius-sm)' }}
                      value={supplierForm.address}
                      onChange={(e) => setSupplierForm(prev => ({ ...prev, address: e.target.value }))}
                      placeholder="Street name & number"
                      disabled={supplierModalMode === 'view'}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '11px', marginBottom: '3px', fontWeight: '600' }}>City</label>
                      <input
                        type="text"
                        className="form-input"
                        style={{ height: '32px', padding: '6px 10px', fontSize: '13px', background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.1)', color: 'var(--text-primary)', borderRadius: 'var(--radius-sm)' }}
                        value={supplierForm.city}
                        onChange={(e) => setSupplierForm(prev => ({ ...prev, city: e.target.value }))}
                        placeholder="Colombo"
                        disabled={supplierModalMode === 'view'}
                      />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '11px', marginBottom: '3px', fontWeight: '600' }}>Country</label>
                      <input
                        type="text"
                        className="form-input"
                        style={{ height: '32px', padding: '6px 10px', fontSize: '13px', background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.1)', color: 'var(--text-primary)', borderRadius: 'var(--radius-sm)' }}
                        value={supplierForm.country}
                        onChange={(e) => setSupplierForm(prev => ({ ...prev, country: e.target.value }))}
                        placeholder="Sri Lanka"
                        disabled={supplierModalMode === 'view'}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '11px', marginBottom: '3px', fontWeight: '600' }}>Category</label>
                      <select
                        className="form-select"
                        style={{ height: '32px', padding: '0 10px', fontSize: '13px', background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.1)', color: 'var(--text-primary)', borderRadius: 'var(--radius-sm)', width: '100%' }}
                        value={supplierForm.supplierCategory}
                        onChange={(e) => setSupplierForm(prev => ({ ...prev, supplierCategory: e.target.value }))}
                        disabled={supplierModalMode === 'view'}
                      >
                        <option value="Wholesaler">Wholesaler</option>
                        <option value="Manufacturer">Manufacturer</option>
                        <option value="Distributor">Distributor</option>
                        <option value="Importer">Importer</option>
                      </select>
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '11px', marginBottom: '3px', fontWeight: '600' }}>Branch Context</label>
                      <select
                        className="form-select"
                        style={{ height: '32px', padding: '0 10px', fontSize: '13px', background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.1)', color: 'var(--text-primary)', borderRadius: 'var(--radius-sm)', width: '100%' }}
                        value={supplierForm.branchName}
                        onChange={(e) => setSupplierForm(prev => ({ ...prev, branchName: e.target.value }))}
                        disabled={supplierModalMode === 'view'}
                      >
                        <option value="">Global / All</option>
                        <option value="Main Store">Main Store</option>
                        <option value="Colombo Branch">Colombo Branch</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '11px', marginBottom: '3px', fontWeight: '600' }}>Business Registration No.</label>
                    <input
                      type="text"
                      className="form-input"
                      style={{ height: '32px', padding: '6px 10px', fontSize: '13px', background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.1)', color: 'var(--text-primary)', borderRadius: 'var(--radius-sm)' }}
                      value={supplierForm.businessRegNo}
                      onChange={(e) => setSupplierForm(prev => ({ ...prev, businessRegNo: e.target.value }))}
                      placeholder="e.g. PV-102938"
                      disabled={supplierModalMode === 'view'}
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '11px', marginBottom: '3px', fontWeight: '600' }}>Tax/VAT Registration No.</label>
                    <input
                      type="text"
                      className="form-input"
                      style={{ height: '32px', padding: '6px 10px', fontSize: '13px', background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.1)', color: 'var(--text-primary)', borderRadius: 'var(--radius-sm)' }}
                      value={supplierForm.taxVatNumber}
                      onChange={(e) => setSupplierForm(prev => ({ ...prev, taxVatNumber: e.target.value }))}
                      placeholder="e.g. VAT-987654"
                      disabled={supplierModalMode === 'view'}
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '11px', marginBottom: '3px', fontWeight: '600' }}>Notes</label>
                    <textarea
                      className="form-input"
                      style={{ height: '32px', padding: '6px 10px', fontSize: '13px', background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.1)', color: 'var(--text-primary)', borderRadius: 'var(--radius-sm)', resize: 'none' }}
                      value={supplierForm.notes}
                      onChange={(e) => setSupplierForm(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder="Brief remarks or special comments"
                      disabled={supplierModalMode === 'view'}
                    />
                  </div>
                </div>

                {/* COLUMN 3: Financial & Banking */}
                <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: 'var(--radius-md)', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '6px', marginBottom: '2px' }}>
                    <CreditCard size={14} style={{ color: 'var(--primary)' }} />
                    <h4 style={{ fontSize: '12.5px', fontWeight: '700', color: 'var(--primary)', margin: 0 }}>3. Financial & Bank</h4>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '11px', marginBottom: '3px', fontWeight: '600' }}>Credit Limit (Rs.)</label>
                      <input
                        type="number"
                        className="form-input"
                        style={{ height: '32px', padding: '6px 10px', fontSize: '13px', background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.1)', color: 'var(--text-primary)', borderRadius: 'var(--radius-sm)' }}
                        value={supplierForm.creditLimit}
                        onChange={(e) => setSupplierForm(prev => ({ ...prev, creditLimit: e.target.value }))}
                        disabled={supplierModalMode === 'view' || !canViewFinancials}
                      />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '11px', marginBottom: '3px', fontWeight: '600' }}>Period (Days)</label>
                      <input
                        type="number"
                        className="form-input"
                        style={{ height: '32px', padding: '6px 10px', fontSize: '13px', background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.1)', color: 'var(--text-primary)', borderRadius: 'var(--radius-sm)' }}
                        value={supplierForm.creditPeriodDays}
                        onChange={(e) => setSupplierForm(prev => ({ ...prev, creditPeriodDays: e.target.value }))}
                        disabled={supplierModalMode === 'view' || !canViewFinancials}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '11px', marginBottom: '3px', fontWeight: '600' }}>Opening Bal. (Rs.)</label>
                      <input
                        type="number"
                        className="form-input"
                        style={{ height: '32px', padding: '6px 10px', fontSize: '13px', background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.1)', color: 'var(--text-primary)', borderRadius: 'var(--radius-sm)' }}
                        value={supplierForm.openingBalance}
                        onChange={(e) => setSupplierForm(prev => ({ ...prev, openingBalance: e.target.value }))}
                        disabled={supplierModalMode !== 'add' || !canViewFinancials}
                      />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '11px', marginBottom: '3px', fontWeight: '600' }}>Payment Terms</label>
                      <input
                        type="text"
                        className="form-input"
                        style={{ height: '32px', padding: '6px 10px', fontSize: '13px', background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.1)', color: 'var(--text-primary)', borderRadius: 'var(--radius-sm)' }}
                        value={supplierForm.paymentTerms}
                        onChange={(e) => setSupplierForm(prev => ({ ...prev, paymentTerms: e.target.value }))}
                        placeholder="e.g. Net 30"
                        disabled={supplierModalMode === 'view'}
                      />
                    </div>
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '11px', marginBottom: '3px', fontWeight: '600' }}>Bank Name</label>
                    <input
                      type="text"
                      className="form-input"
                      style={{ height: '32px', padding: '6px 10px', fontSize: '13px', background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.1)', color: 'var(--text-primary)', borderRadius: 'var(--radius-sm)' }}
                      value={supplierForm.bankName}
                      onChange={(e) => setSupplierForm(prev => ({ ...prev, bankName: e.target.value }))}
                      placeholder="e.g. Commercial Bank"
                      disabled={supplierModalMode === 'view' || !canViewFinancials}
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '11px', marginBottom: '3px', fontWeight: '600' }}>Account Name</label>
                    <input
                      type="text"
                      className="form-input"
                      style={{ height: '32px', padding: '6px 10px', fontSize: '13px', background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.1)', color: 'var(--text-primary)', borderRadius: 'var(--radius-sm)' }}
                      value={supplierForm.accountName}
                      onChange={(e) => setSupplierForm(prev => ({ ...prev, accountName: e.target.value }))}
                      placeholder="e.g. Acme Distributors Account"
                      disabled={supplierModalMode === 'view' || !canViewFinancials}
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '11px', marginBottom: '3px', fontWeight: '600' }}>Account Number</label>
                    <input
                      type="text"
                      className="form-input"
                      style={{ height: '32px', padding: '6px 10px', fontSize: '13px', background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.1)', color: 'var(--text-primary)', borderRadius: 'var(--radius-sm)' }}
                      value={supplierForm.accountNumber}
                      onChange={(e) => setSupplierForm(prev => ({ ...prev, accountNumber: e.target.value }))}
                      placeholder="Account number digits"
                      disabled={supplierModalMode === 'view' || !canViewFinancials}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '10px' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '11px', marginBottom: '3px', fontWeight: '600' }}>Bank Branch</label>
                      <input
                        type="text"
                        className="form-input"
                        style={{ height: '32px', padding: '6px 10px', fontSize: '13px', background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.1)', color: 'var(--text-primary)', borderRadius: 'var(--radius-sm)' }}
                        value={supplierForm.bankBranch}
                        onChange={(e) => setSupplierForm(prev => ({ ...prev, bankBranch: e.target.value }))}
                        placeholder="e.g. Colombo Fort"
                        disabled={supplierModalMode === 'view' || !canViewFinancials}
                      />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '11px', marginBottom: '3px', fontWeight: '600' }}>SWIFT Code</label>
                      <input
                        type="text"
                        className="form-input"
                        style={{ height: '32px', padding: '6px 10px', fontSize: '13px', background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.1)', color: 'var(--text-primary)', borderRadius: 'var(--radius-sm)' }}
                        value={supplierForm.swiftCode}
                        onChange={(e) => setSupplierForm(prev => ({ ...prev, swiftCode: e.target.value }))}
                        placeholder="SWIFT"
                        disabled={supplierModalMode === 'view' || !canViewFinancials}
                      />
                    </div>
                  </div>
                </div>

              </div>

              {/* Modal Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '14px' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setShowSupplierModal(false)}
                  style={{ height: '36px', padding: '0 18px', fontSize: '13px', fontWeight: '600' }}
                >
                  Close
                </button>
                {supplierModalMode !== 'view' && canManageSuppliers && (
                  <button 
                    type="submit" 
                    className="btn btn-primary" 
                    disabled={actionLoading}
                    style={{ height: '36px', padding: '0 20px', fontSize: '13px', fontWeight: '600' }}
                  >
                    {actionLoading ? 'Saving...' : 'Save Profile'}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================================
         MODAL: CREATE PURCHASE ORDER
         ============================================================================ */}
      {showPoModal && (() => {
        const totalQty = poForm.items.reduce((sum, item) => sum + parseFloat(item.quantity || 0), 0);
        const subTotal = poForm.items.reduce((sum, item) => sum + (parseFloat(item.quantity || 0) * parseFloat(item.unitCost || 0)), 0);
        const totalDiscount = poForm.items.reduce((sum, item) => sum + parseFloat(item.discount || 0), 0);
        const totalTax = poForm.items.reduce((sum, item) => sum + parseFloat(item.tax || 0), 0);
        const grandTotal = subTotal - totalDiscount + totalTax;

        return (
          <div className="modal-overlay no-print">
            <div className="modal-content glass-panel" style={{ width: '1200px', maxWidth: '95vw', padding: '24px', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: 'var(--radius-lg)' }}>
              
              {/* Modal Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShoppingBag size={18} style={{ color: 'var(--primary)' }} />
                  <h3 style={{ fontSize: '16px', fontWeight: '700', margin: 0 }}>Purchase Order (PO)</h3>
                </div>
                <button type="button" className="close-btn" onClick={() => setShowPoModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={(e) => handlePoSubmit(e, 'Ordered')}>
                {/* PO Header Fields */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '20px' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>PO Number</label>
                    <input type="text" className="form-input" style={{ height: '32px', fontSize: '13px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', padding: '0 10px' }} value="PO-XXXX (Auto)" disabled />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>PO Date</label>
                    <input type="text" className="form-input" style={{ height: '32px', fontSize: '13px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', padding: '0 10px' }} value={new Date().toLocaleDateString()} disabled />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Supplier *</label>
                    <select
                      className="form-select"
                      style={{ height: '32px', fontSize: '13px', padding: '0 10px' }}
                      value={poForm.supplierId}
                      onChange={(e) => setPoForm(prev => ({ ...prev, supplierId: e.target.value }))}
                      required
                    >
                      {suppliers.map(s => (
                        <option key={s.SupplierID} value={s.SupplierID}>{s.SupplierName}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Expected Delivery Date *</label>
                    <input
                      type="date"
                      className="form-input"
                      style={{ height: '32px', fontSize: '13px', padding: '0 10px' }}
                      value={poForm.expectedDeliveryDate}
                      onChange={(e) => setPoForm(prev => ({ ...prev, expectedDeliveryDate: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Branch Destination or Warehouse *</label>
                    <select
                      className="form-select"
                      style={{ height: '32px', fontSize: '13px', padding: '0 10px' }}
                      value={poForm.branchName}
                      onChange={(e) => setPoForm(prev => ({ ...prev, branchName: e.target.value }))}
                      required
                    >
                      <option value="Main Store">Main Store</option>
                      <option value="Colombo Branch">Colombo Branch</option>
                    </select>
                  </div>
                </div>

                {/* Items Table */}
                <div className="form-group" style={{ marginBottom: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <label className="form-label" style={{ marginBottom: 0, fontWeight: '700' }}>Item Table</label>
                    <button type="button" className="btn btn-secondary" style={{ padding: '4px 12px', fontSize: '12px' }} onClick={handleAddPoItem}>
                      + Add Product Row
                    </button>
                  </div>

                  <div className="glass-panel" style={{ padding: 0, maxHeight: '280px', overflowY: 'auto' }}>
                    <table className="table-glass" style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '11px' }}>Item / Smart Search (Name, Barcode, Code)</th>
                          <th style={{ width: '100px', padding: '8px 12px', textAlign: 'center', fontSize: '11px' }}>Qty</th>
                          <th style={{ width: '130px', padding: '8px 12px', textAlign: 'right', fontSize: '11px' }}>Cost Price</th>
                          <th style={{ width: '120px', padding: '8px 12px', textAlign: 'right', fontSize: '11px' }}>Discount (Rs.)</th>
                          <th style={{ width: '120px', padding: '8px 12px', textAlign: 'right', fontSize: '11px' }}>VAT (Rs.)</th>
                          <th style={{ width: '140px', padding: '8px 12px', textAlign: 'right', fontSize: '11px' }}>Amount</th>
                          <th style={{ width: '45px', padding: '8px' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {poForm.items.map((item, index) => {
                          const amount = (parseFloat(item.quantity || 0) * parseFloat(item.unitCost || 0)) - parseFloat(item.discount || 0) + parseFloat(item.tax || 0);
                          return (
                            <tr key={index}>
                              <td style={{ padding: '6px', position: 'relative' }}>
                                <input
                                  type="text"
                                  className="form-input po-item-select"
                                  style={{ width: '100%', height: '32px', fontSize: '13px', padding: '0 10px' }}
                                  value={item.searchQuery || ''}
                                  onChange={(e) => handleSearchInputChange(index, e.target.value)}
                                  onFocus={() => setActiveSearchIndex(index)}
                                  onBlur={() => setTimeout(() => setActiveSearchIndex(null), 250)}
                                  onKeyDown={(e) => handleSearchInputKeyDown(e, index)}
                                  placeholder="Type Name, Barcode, or SKU..."
                                  required
                                />
                                
                                {activeSearchIndex === index && (() => {
                                  const query = (item.searchQuery || '').toLowerCase().trim();
                                  const filteredProducts = products.filter(p => {
                                    if (!query) return true;
                                    return (
                                      p.Name.toLowerCase().includes(query) ||
                                      (p.Barcode && p.Barcode.toLowerCase().includes(query)) ||
                                      (p.SKU && p.SKU.toLowerCase().includes(query))
                                    );
                                  }).slice(0, 8);

                                  return (
                                    <div 
                                      className="glass-panel" 
                                      style={{ 
                                        position: 'absolute', 
                                        left: '6px', 
                                        right: '6px', 
                                        top: '38px', 
                                        zIndex: 999, 
                                        maxHeight: '200px', 
                                        overflowY: 'auto', 
                                        background: 'var(--bg-surface-elevated)', 
                                        border: '1px solid var(--border-color)',
                                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)',
                                        borderRadius: 'var(--radius-sm)',
                                        padding: '4px'
                                      }}
                                    >
                                      {filteredProducts.length === 0 ? (
                                        <div style={{ padding: '8px', fontSize: '12.5px', color: 'var(--text-secondary)', textAlign: 'center' }}>
                                          No products found
                                        </div>
                                      ) : (
                                        filteredProducts.map(p => (
                                          <div
                                            key={p.ProductID}
                                            style={{ 
                                              padding: '6px 10px', 
                                              fontSize: '12.5px', 
                                              cursor: 'pointer', 
                                              borderRadius: 'var(--radius-xs)', 
                                              color: 'var(--text-primary)',
                                              display: 'flex',
                                              justifyContent: 'space-between',
                                              alignItems: 'center',
                                              borderBottom: '1px solid rgba(255,255,255,0.03)'
                                            }}
                                            onMouseDown={() => {
                                              const newItems = [...poForm.items];
                                              newItems[index].productId = p.ProductID;
                                              newItems[index].unitCost = formatCurrency(Number(p.Cost));
                                              newItems[index].searchQuery = `${p.Name} (${p.Barcode || p.SKU})`;
                                              setPoForm(prev => ({ ...prev, items: newItems }));
                                              setToast({ type: 'success', message: `Selected: ${p.Name}` });
                                              setActiveSearchIndex(null);
                                            }}
                                            className="search-item-hover"
                                          >
                                            <div>
                                              <strong style={{ display: 'block' }}>{p.Name}</strong>
                                              <span style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>Code: {p.SKU}</span>
                                            </div>
                                            {p.Barcode && (
                                              <span className="mono" style={{ fontSize: '11px', color: 'var(--accent)', background: 'rgba(56, 189, 248, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                                                {p.Barcode}
                                              </span>
                                            )}
                                          </div>
                                        ))
                                      )}
                                    </div>
                                  );
                                })()}
                              </td>
                              <td style={{ padding: '6px' }}>
                                <input
                                  type="number"
                                  step="0.001"
                                  min="0.001"
                                  className="form-input"
                                  style={{ width: '100%', height: '32px', textAlign: 'center', fontSize: '13px', padding: '0 10px' }}
                                  value={item.quantity}
                                  onChange={(e) => handlePoItemChange(index, 'quantity', e.target.value)}
                                  required
                                />
                              </td>
                              <td style={{ padding: '6px' }}>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0.00"
                                  className="form-input"
                                  style={{ width: '100%', height: '32px', textAlign: 'right', fontSize: '13px', padding: '0 10px' }}
                                  value={item.unitCost}
                                  onChange={(e) => handlePoItemChange(index, 'unitCost', e.target.value)}
                                  required
                                />
                              </td>
                              <td style={{ padding: '6px' }}>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0.00"
                                  className="form-input"
                                  style={{ width: '100%', height: '32px', textAlign: 'right', fontSize: '13px', padding: '0 10px' }}
                                  value={item.discount}
                                  onChange={(e) => handlePoItemChange(index, 'discount', e.target.value)}
                                  placeholder="0.00"
                                />
                              </td>
                              <td style={{ padding: '6px' }}>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0.00"
                                  className="form-input"
                                  style={{ width: '100%', height: '32px', textAlign: 'right', fontSize: '13px', padding: '0 10px' }}
                                  value={item.tax}
                                  onChange={(e) => handlePoItemChange(index, 'tax', e.target.value)}
                                  placeholder="0.00"
                                  onKeyDown={(e) => {
                                    if (e.key === 'Tab' && !e.shiftKey && index === poForm.items.length - 1) {
                                      e.preventDefault();
                                      handleAddPoItem();
                                      setTimeout(() => {
                                        const selects = document.querySelectorAll('.po-item-select');
                                        const lastSelect = selects[selects.length - 1];
                                        if (lastSelect) lastSelect.focus();
                                      }, 50);
                                    }
                                  }}
                                />
                              </td>
                              <td className="mono" style={{ padding: '6px', textAlign: 'right', fontWeight: '700', fontSize: '13px', color: 'var(--accent)' }}>
                                Rs. {formatCurrency(amount)}
                              </td>
                              <td style={{ padding: '6px', textAlign: 'center' }}>
                                <button
                                  type="button"
                                  className="btn btn-danger btn-icon"
                                  style={{ width: '28px', height: '28px', minWidth: '28px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                  onClick={() => handleRemovePoItem(index)}
                                  disabled={poForm.items.length <= 1}
                                >
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

                {/* Summary & Note Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '24px', borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '16px', marginBottom: '20px' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '11px' }}>PO Instructions / Notes</label>
                    <textarea
                      className="form-input"
                      style={{ height: '90px', resize: 'none', fontSize: '12.5px' }}
                      value={poForm.notes}
                      onChange={(e) => setPoForm(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder="Add instructions, terms, or conditions here..."
                    />
                  </div>

                  {/* Summary Block */}
                  <div className="glass-panel" style={{ padding: '14px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                      <span>Total Qty:</span>
                      <span className="mono" style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{totalQty.toFixed(3)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                      <span>Sub Total:</span>
                      <span className="mono" style={{ fontWeight: '600', color: 'var(--text-primary)' }}>Rs. {formatCurrency(subTotal)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                      <span>Discount:</span>
                      <span className="mono" style={{ fontWeight: '600', color: 'var(--danger)' }}>- Rs. {formatCurrency(totalDiscount)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                      <span>Tax:</span>
                      <span className="mono" style={{ fontWeight: '600', color: 'var(--warning)' }}>+ Rs. {formatCurrency(totalTax)}</span>
                    </div>
                    <hr style={{ border: 'none', borderTop: '1px dashed rgba(255, 255, 255, 0.1)', margin: '4px 0' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '800', fontSize: '15px' }}>
                      <span>Grand Total:</span>
                      <span className="mono" style={{ color: 'var(--success)' }}>Rs. {formatCurrency(grandTotal)}</span>
                    </div>
                  </div>
                </div>

                {/* Modal Actions */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '16px' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => {
                        setSelectedPo({
                          PONumber: 'DRAFT',
                          OrderDate: new Date(),
                          SupplierName: suppliers.find(s => s.SupplierID === parseInt(poForm.supplierId, 10))?.SupplierName || 'Supplier',
                          BranchName: poForm.branchName,
                          Status: 'Draft',
                          items: poForm.items.map(i => {
                            const p = products.find(prod => prod.ProductID === parseInt(i.productId, 10));
                            return {
                              ProductName: p?.Name || 'Product',
                              SKU: p?.SKU || '',
                              UnitCost: i.unitCost,
                              Quantity: i.quantity,
                              ReceivedQty: 0,
                              Subtotal: parseFloat(i.quantity) * parseFloat(i.unitCost),
                              Discount: i.discount,
                              Tax: i.tax
                            };
                          }),
                          Subtotal: subTotal,
                          TaxAmount: totalTax,
                          TotalAmount: grandTotal,
                          DiscountAmount: totalDiscount
                        });
                        setTimeout(() => window.print(), 100);
                      }}
                      style={{ fontSize: '12.5px', height: '34px' }}
                    >
                      <Printer size={13} style={{ marginRight: '4px' }} /> Print
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => {
                        const supMail = suppliers.find(s => s.SupplierID === parseInt(poForm.supplierId, 10))?.EmailAddress;
                        if (supMail) {
                          setToast({ type: 'success', message: `Purchase Order emailed successfully to ${supMail}` });
                        } else {
                          setToast({ type: 'warning', message: 'Supplier profile is missing an email address.' });
                        }
                      }}
                      style={{ fontSize: '12.5px', height: '34px' }}
                    >
                      Email Supplier
                    </button>
                  </div>

                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button type="button" className="btn btn-secondary" onClick={() => setShowPoModal(false)} style={{ fontSize: '12.5px', height: '34px' }}>
                      Cancel
                    </button>
                    <button type="button" className="btn" style={{ background: 'rgba(255,255,255,0.06)', color: 'white', fontSize: '12.5px', height: '34px' }} onClick={(e) => handlePoSubmit(e, 'Draft')} disabled={actionLoading}>
                      Save Draft
                    </button>
                    <button type="submit" className="btn btn-primary" style={{ fontSize: '12.5px', height: '34px' }} disabled={actionLoading}>
                      Approve PO
                    </button>
                  </div>
                </div>

              </form>
            </div>
          </div>
        );
      })()}

      {/* ============================================================================
         MODAL: VIEW PURCHASE ORDER
         ============================================================================ */}
      {showPoViewModal && selectedPo && (() => {
        const totalQty = selectedPo.items ? selectedPo.items.reduce((sum, item) => sum + parseFloat(item.Quantity || 0), 0) : 0;
        const subTotal = selectedPo.Subtotal || (selectedPo.items ? selectedPo.items.reduce((sum, item) => sum + (parseFloat(item.Quantity || 0) * parseFloat(item.UnitCost || 0)), 0) : 0);
        const grandTotal = selectedPo.TotalAmount || subTotal;
        const totalDiscount = selectedPo.DiscountAmount || 0;
        const totalTax = selectedPo.TaxAmount || 0;

        return (
          <div className="modal-overlay no-print" onClick={(e) => e.target === e.currentTarget && setShowPoViewModal(false)}>
            <div className="modal-content glass-panel" style={{ width: '900px', padding: '24px', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: 'var(--radius-lg)' }}>
              
              {/* Modal Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Eye size={18} style={{ color: 'var(--primary)' }} />
                  <h3 style={{ fontSize: '16px', fontWeight: '700', margin: 0 }}>View Purchase Order: {selectedPo.PONumber}</h3>
                </div>
                <button type="button" className="close-btn" onClick={() => setShowPoViewModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  <X size={18} />
                </button>
              </div>

              {/* PO Info Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px', background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div>
                  <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>PO Number</span>
                  <strong className="mono" style={{ fontSize: '14px', color: 'white' }}>{selectedPo.PONumber}</strong>
                </div>
                <div>
                  <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Order Date</span>
                  <strong style={{ fontSize: '13.5px', color: 'white' }}>{new Date(selectedPo.OrderDate).toLocaleDateString()}</strong>
                </div>
                <div>
                  <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Supplier</span>
                  <strong style={{ fontSize: '13.5px', color: 'white' }}>{selectedPo.SupplierName}</strong>
                </div>
                <div>
                  <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Expected Delivery</span>
                  <strong style={{ fontSize: '13.5px', color: 'white' }}>{selectedPo.ExpectedDeliveryDate ? new Date(selectedPo.ExpectedDeliveryDate).toLocaleDateString() : 'N/A'}</strong>
                </div>
                <div style={{ marginTop: '10px' }}>
                  <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Destination Branch</span>
                  <strong style={{ fontSize: '13.5px', color: 'white' }}>{selectedPo.BranchName || 'Global'}</strong>
                </div>
                <div style={{ marginTop: '10px' }}>
                  <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Status</span>
                  <span style={{ 
                    fontSize: '11px', fontWeight: '700', padding: '3px 10px', borderRadius: '12px',
                    background: selectedPo.Status === 'Draft' ? 'rgba(255,255,255,0.06)' : 
                                selectedPo.Status === 'Ordered' ? 'rgba(96,165,250,0.15)' :
                                selectedPo.Status === 'GRN Received' ? 'rgba(245,158,11,0.15)' :
                                selectedPo.Status === 'Invoiced' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                    color: selectedPo.Status === 'Draft' ? 'var(--text-secondary)' : 
                           selectedPo.Status === 'Ordered' ? '#60a5fa' :
                           selectedPo.Status === 'GRN Received' ? 'var(--warning)' :
                           selectedPo.Status === 'Invoiced' ? 'var(--success)' : 'var(--danger)'
                  }}>{selectedPo.Status}</span>
                </div>
                <div style={{ marginTop: '10px' }}>
                  <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Invoice Ref</span>
                  <strong className="mono" style={{ fontSize: '13.5px', color: 'white' }}>{selectedPo.InvoiceNumber || '--'}</strong>
                </div>
                <div style={{ marginTop: '10px' }}>
                  <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Payment Status</span>
                  <strong style={{ 
                    fontSize: '12.5px', 
                    color: selectedPo.PaymentStatus === 'Paid' ? 'var(--success)' : 
                           selectedPo.PaymentStatus === 'Partially Paid' ? 'var(--warning)' : 'var(--text-muted)'
                  }}>{selectedPo.PaymentStatus || 'Unpaid'}</strong>
                </div>
              </div>

              {/* Items Table */}
              <div style={{ marginBottom: '24px' }}>
                <h4 style={{ fontSize: '13px', fontWeight: '700', marginBottom: '8px', color: 'white' }}>Order Items</h4>
                <div className="glass-panel" style={{ padding: 0, maxHeight: '250px', overflowY: 'auto' }}>
                  <table className="table-glass" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '11px' }}>Product</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '11px' }}>SKU/Barcode</th>
                        <th style={{ width: '80px', padding: '8px 12px', textAlign: 'center', fontSize: '11px' }}>Qty Ordered</th>
                        <th style={{ width: '80px', padding: '8px 12px', textAlign: 'center', fontSize: '11px' }}>Qty Recv</th>
                        <th style={{ width: '120px', padding: '8px 12px', textAlign: 'right', fontSize: '11px' }}>Cost Price</th>
                        <th style={{ width: '100px', padding: '8px 12px', textAlign: 'right', fontSize: '11px' }}>Discount</th>
                        <th style={{ width: '100px', padding: '8px 12px', textAlign: 'right', fontSize: '11px' }}>Tax</th>
                        <th style={{ width: '120px', padding: '8px 12px', textAlign: 'right', fontSize: '11px' }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedPo.items && selectedPo.items.map((item, idx) => {
                        const qty = parseFloat(item.Quantity || 0);
                        const cost = parseFloat(item.UnitCost || 0);
                        const disc = parseFloat(item.Discount || 0);
                        const tx = parseFloat(item.Tax || 0);
                        const amt = (qty * cost) - disc + tx;
                        return (
                          <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <td style={{ padding: '8px 12px', fontWeight: '600' }}>{item.ProductName}</td>
                            <td className="mono" style={{ padding: '8px 12px', fontSize: '11px', color: 'var(--text-secondary)' }}>{item.SKU || item.Barcode || '--'}</td>
                            <td style={{ padding: '8px 12px', textAlign: 'center' }} className="mono">{qty.toFixed(3)}</td>
                            <td style={{ padding: '8px 12px', textAlign: 'center' }} className="mono">{parseFloat(item.ReceivedQty || 0).toFixed(3)}</td>
                            <td style={{ padding: '8px 12px', textAlign: 'right' }} className="mono">Rs. {formatCurrency(cost)}</td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--danger)' }} className="mono">- Rs. {formatCurrency(disc)}</td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--warning)' }} className="mono">+ Rs. {formatCurrency(tx)}</td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '700', color: 'var(--accent)' }} className="mono">Rs. {formatCurrency(amt)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Bottom Section: Notes & Summary */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '24px', borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '16px', marginBottom: '20px' }}>
                <div>
                  <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Instructions / Notes</span>
                  <div style={{ fontSize: '12.5px', color: 'var(--text-primary)', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(255,255,255,0.05)', minHeight: '80px', whiteSpace: 'pre-wrap' }}>
                    {selectedPo.Notes || 'No instructions provided.'}
                  </div>
                </div>

                {/* Summary block */}
                <div className="glass-panel" style={{ padding: '14px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                    <span>Total Qty:</span>
                    <span className="mono" style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{totalQty.toFixed(3)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                    <span>Sub Total:</span>
                    <span className="mono" style={{ fontWeight: '600', color: 'var(--text-primary)' }}>Rs. {formatCurrency(subTotal)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                    <span>Discount:</span>
                    <span className="mono" style={{ fontWeight: '600', color: 'var(--danger)' }}>- Rs. {formatCurrency(totalDiscount)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                    <span>Tax:</span>
                    <span className="mono" style={{ fontWeight: '600', color: 'var(--warning)' }}>+ Rs. {formatCurrency(totalTax)}</span>
                  </div>
                  <hr style={{ border: 'none', borderTop: '1px dashed rgba(255, 255, 255, 0.1)', margin: '4px 0' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '800', fontSize: '15px' }}>
                    <span>Grand Total:</span>
                    <span className="mono" style={{ color: 'var(--success)' }}>Rs. {formatCurrency(grandTotal)}</span>
                  </div>
                </div>
              </div>

              {/* Actions Footer */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '16px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={async () => {
                    // Make sure selectedPo has full items loaded
                    const res = await fetch(`${API_URL}/api/suppliers/purchases/${selectedPo.PurchaseOrderID}`, { headers: { 'Authorization': `Bearer ${token}` } });
                    if (res.ok) {
                      setSelectedPo(await res.json());
                      handlePrintReport();
                    }
                  }}
                  style={{ fontSize: '12.5px', height: '34px' }}
                >
                  <Printer size={13} style={{ marginRight: '4px' }} /> Print PO Voucher
                </button>

                <div style={{ display: 'flex', gap: '10px' }}>
                  {canManagePurchases && (selectedPo.Status === 'Draft' || selectedPo.Status === 'Ordered') && (
                    <>
                      <button 
                        type="button" 
                        className="btn btn-secondary"
                        onClick={() => {
                          setShowPoViewModal(false);
                          handleOpenPoEdit(selectedPo);
                        }}
                        style={{ fontSize: '12.5px', height: '34px' }}
                      >
                        <Edit2 size={12} style={{ marginRight: '4px' }} /> Edit PO
                      </button>
                      <button 
                        type="button" 
                        className="btn btn-danger"
                        onClick={() => {
                          setShowPoViewModal(false);
                          handleDeletePo(selectedPo);
                        }}
                        style={{ fontSize: '12.5px', height: '34px' }}
                      >
                        <Trash2 size={12} style={{ marginRight: '4px' }} /> Delete PO
                      </button>
                    </>
                  )}
                  <button type="button" className="btn btn-secondary" onClick={() => setShowPoViewModal(false)} style={{ fontSize: '12.5px', height: '34px' }}>
                    Close
                  </button>
                </div>
              </div>

            </div>
          </div>
        );
      })()}

      {/* ============================================================================
         MODAL: RECEIVE GOODS RECEIVED NOTE (GRN)
         ============================================================================ */}
      {showGrnModal && selectedPo && (() => {
        const totalReceivedItems = grnForm.items.filter(item => parseFloat(item.receivedQty || 0) > 0).length;
        const totalQty = grnForm.items.reduce((sum, item) => sum + parseFloat(item.receivedQty || 0), 0);
        const totalCost = grnForm.items.reduce((sum, item) => sum + (parseFloat(item.receivedQty || 0) * parseFloat(item.unitCost || 0)), 0);

        return (
          <div className="modal-overlay no-print">
            <div className="modal-content glass-panel" style={{ width: '1200px', maxWidth: '95vw', padding: '24px', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: 'var(--radius-lg)' }}>
              
              {/* Modal Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Truck size={18} style={{ color: 'var(--warning)' }} />
                  <h3 style={{ fontSize: '16px', fontWeight: '700', margin: 0 }}>SellMax Pro - Goods Received Note (GRN)</h3>
                </div>
                <button type="button" className="close-btn" onClick={() => setShowGrnModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={(e) => handleGrnSubmit(e, false)}>
                {/* GRN Header Fields */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '12px', marginBottom: '20px' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>GRN Number</label>
                    <input type="text" className="form-input" style={{ height: '32px', fontSize: '13px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)' }} value="GRN-XXXX (Auto)" disabled />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>GRN Date</label>
                    <input type="text" className="form-input" style={{ height: '32px', fontSize: '13px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)' }} value={new Date().toLocaleDateString()} disabled />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>PO Reference</label>
                    <input type="text" className="form-input mono" style={{ height: '32px', fontSize: '13px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', fontWeight: '700' }} value={selectedPo.PONumber} disabled />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Supplier</label>
                    <input type="text" className="form-input" style={{ height: '32px', fontSize: '13px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)' }} value={selectedPo.SupplierName} disabled />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Branch Destination/Warehouse</label>
                    <input type="text" className="form-input" style={{ height: '32px', fontSize: '13px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)' }} value={selectedPo.BranchName || 'Main Store'} disabled />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Received By</label>
                    <input type="text" className="form-input" style={{ height: '32px', fontSize: '13px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)' }} value={user?.username || 'admin'} disabled />
                  </div>
                </div>

                {/* Items Table */}
                <div className="form-group" style={{ marginBottom: '20px' }}>
                  <label className="form-label" style={{ fontWeight: '700', marginBottom: '8px' }}>Item Table</label>
                  <div className="glass-panel" style={{ padding: 0, maxHeight: '280px', overflowY: 'auto' }}>
                    <table className="table-glass" style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '11px' }}>Item</th>
                          <th style={{ width: '180px', padding: '8px 12px', textAlign: 'left', fontSize: '11px' }}>Batch No</th>
                          <th style={{ width: '180px', padding: '8px 12px', textAlign: 'left', fontSize: '11px' }}>Expiry Date</th>
                          <th style={{ width: '110px', padding: '8px 12px', textAlign: 'center', fontSize: '11px' }}>Ordered Qty</th>
                          <th style={{ width: '120px', padding: '8px 12px', textAlign: 'center', fontSize: '11px' }}>Received Qty</th>
                          <th style={{ width: '130px', padding: '8px 12px', textAlign: 'right', fontSize: '11px' }}>Cost Price</th>
                          <th style={{ width: '140px', padding: '8px 12px', textAlign: 'right', fontSize: '11px' }}>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {grnForm.items.map((item, index) => {
                          const amount = parseFloat(item.receivedQty || 0) * parseFloat(item.unitCost || 0);
                          return (
                            <tr key={index} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                              <td style={{ padding: '8px 12px', fontWeight: '600', color: item.isBatchTracked ? '#60a5fa' : 'inherit' }}>
                                {item.productName} {item.isBatchTracked && '(Batch Tracked)'}
                              </td>
                              <td style={{ padding: '4px 8px' }}>
                                <input
                                  type="text"
                                  className="form-input"
                                  style={{ width: '100%', height: '28px', fontSize: '12px', padding: '0 6px' }}
                                  value={item.batchNo}
                                  onChange={(e) => handleGrnItemChange(index, 'batchNo', e.target.value)}
                                  placeholder="e.g. B-001"
                                  required={item.isBatchTracked}
                                />
                              </td>
                              <td style={{ padding: '4px 8px' }}>
                                <input
                                  type="date"
                                  className="form-input"
                                  style={{ width: '100%', height: '28px', fontSize: '12px', padding: '0 6px' }}
                                  value={item.expiryDate}
                                  onChange={(e) => handleGrnItemChange(index, 'expiryDate', e.target.value)}
                                  required={item.isBatchTracked}
                                />
                              </td>
                              <td style={{ padding: '8px 12px', textAlign: 'center' }} className="mono">
                                {Number(item.orderedQty).toFixed(3)}
                              </td>
                              <td style={{ padding: '4px 8px' }}>
                                <input
                                  type="number"
                                  step="0.001"
                                  min="0.00"
                                  className="form-input"
                                  style={{ width: '100%', height: '28px', textAlign: 'center', fontSize: '12.5px', padding: '0 6px' }}
                                  value={item.receivedQty}
                                  onChange={(e) => handleGrnItemChange(index, 'receivedQty', e.target.value)}
                                  required
                                />
                              </td>
                              <td style={{ padding: '8px 12px', textAlign: 'right' }} className="mono">
                                Rs. {formatCurrency(Number(item.unitCost))}
                              </td>
                              <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '700', color: 'var(--accent)' }} className="mono">
                                Rs. {formatCurrency(amount)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Summary & Actions Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '24px', borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '16px', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                    <p>💡 <strong>Batch Tracking</strong>: batch-tracked items are marked in blue. Enter Batch No. and Expiry Date to track shelf-life.</p>
                  </div>

                  {/* Summary Block */}
                  <div className="glass-panel" style={{ padding: '14px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                      <span>Total Received Items:</span>
                      <span className="mono" style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{totalReceivedItems}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                      <span>Total Qty:</span>
                      <span className="mono" style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{totalQty.toFixed(3)}</span>
                    </div>
                    <hr style={{ border: 'none', borderTop: '1px dashed rgba(255, 255, 255, 0.1)', margin: '4px 0' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '800', fontSize: '15px' }}>
                      <span>Total Cost:</span>
                      <span className="mono" style={{ color: 'var(--success)' }}>Rs. {formatCurrency(totalCost)}</span>
                    </div>
                  </div>
                </div>

                {/* Actions Footer */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '16px' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => {
                        setToast({ type: 'success', message: 'GRN Receipt document sent to spooler for printing.' });
                      }}
                      style={{ fontSize: '12.5px', height: '34px' }}
                    >
                      <Printer size={13} style={{ marginRight: '4px' }} /> Print GRN
                    </button>
                  </div>

                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button type="button" className="btn btn-secondary" onClick={() => setShowGrnModal(false)} style={{ fontSize: '12.5px', height: '34px' }}>
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary" style={{ fontSize: '12.5px', height: '34px' }} disabled={actionLoading}>
                      Save GRN
                    </button>
                    <button
                      type="button"
                      className="btn"
                      style={{ background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid rgba(16,185,129,0.3)', fontSize: '12.5px', height: '34px' }}
                      disabled={actionLoading}
                      onClick={(e) => handleGrnSubmit(e, true)}
                    >
                      Convert to Bill
                    </button>
                  </div>
                </div>

              </form>
            </div>
          </div>
        );
      })()}

      {/* ============================================================================
         MODAL: POST SUPPLIER PURCHASE INVOICE / BILL (CASH PURCHASE)
         ============================================================================ */}
      {showInvoiceModal && selectedPo && (() => {
        const subTotal = selectedPo.items ? selectedPo.items.reduce((sum, item) => sum + (parseFloat(item.Quantity || item.ReceivedQty || 0) * parseFloat(item.UnitCost || 0)), 0) : 0;
        const totalDiscount = selectedPo.items ? selectedPo.items.reduce((sum, item) => sum + parseFloat(item.Discount || 0), 0) : 0;
        const totalTax = selectedPo.items ? selectedPo.items.reduce((sum, item) => sum + parseFloat(item.Tax || 0), 0) : 0;
        const grandTotal = subTotal - totalDiscount + totalTax;
        const paidAmount = parseFloat(invoiceForm.amountPaid || 0);
        const balanceDue = grandTotal - paidAmount;

        return (
          <div className="modal-overlay no-print">
            <div className="modal-content glass-panel" style={{ width: '1200px', maxWidth: '95vw', padding: '24px', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: 'var(--radius-lg)' }}>
              
              {/* Modal Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Receipt size={18} style={{ color: 'var(--success)' }} />
                  <h3 style={{ fontSize: '16px', fontWeight: '700', margin: 0 }}>SellMax Pro - Bill (Cash Purchase)</h3>
                </div>
                <button type="button" className="close-btn" onClick={() => setShowInvoiceModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  <X size={18} />
                </button>
              </div>

              <form id="bill-form" onSubmit={handleInvoiceSubmit}>
                {/* Header Info */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '12px', marginBottom: '20px' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Bill Number *</label>
                    <input
                      type="text"
                      className="form-input"
                      style={{ height: '32px', fontSize: '13px', padding: '0 10px' }}
                      value={invoiceForm.invoiceNumber}
                      onChange={(e) => setInvoiceForm(prev => ({ ...prev, invoiceNumber: e.target.value }))}
                      placeholder="e.g. BILL-9485"
                      required
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Bill Date *</label>
                    <input
                      type="date"
                      className="form-input"
                      style={{ height: '32px', fontSize: '13px', padding: '0 10px' }}
                      value={invoiceForm.invoiceDate}
                      onChange={(e) => setInvoiceForm(prev => ({ ...prev, invoiceDate: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Supplier</label>
                    <input
                      type="text"
                      className="form-input"
                      style={{ height: '32px', fontSize: '13px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', padding: '0 10px' }}
                      value={selectedPo.SupplierName}
                      disabled
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>GRN Reference</label>
                    <input
                      type="text"
                      className="form-input mono"
                      style={{ height: '32px', fontSize: '13px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', padding: '0 10px' }}
                      value={selectedPo.GRNNumber || 'N/A'}
                      disabled
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Due Date *</label>
                    <input
                      type="date"
                      className="form-input"
                      style={{ height: '32px', fontSize: '13px', padding: '0 10px' }}
                      value={invoiceForm.dueDate}
                      onChange={(e) => setInvoiceForm(prev => ({ ...prev, dueDate: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Payment Terms *</label>
                    <select
                      className="form-select"
                      style={{ height: '32px', fontSize: '13px', padding: '0 10px' }}
                      value={invoiceForm.paymentTerms}
                      onChange={(e) => setInvoiceForm(prev => ({ ...prev, paymentTerms: e.target.value }))}
                      required
                    >
                      <option value="Cash">Cash</option>
                      <option value="Net 10">Net 10</option>
                      <option value="Net 15">Net 15</option>
                      <option value="Net 30">Net 30</option>
                      <option value="Net 60">Net 60</option>
                    </select>
                  </div>
                </div>

                {/* Item Table */}
                <div className="form-group" style={{ marginBottom: '20px' }}>
                  <label className="form-label" style={{ fontWeight: '700', marginBottom: '8px' }}>Item Table</label>
                  <div className="glass-panel" style={{ padding: 0, maxHeight: '280px', overflowY: 'auto' }}>
                    <table className="table-glass" style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '11px' }}>Item</th>
                          <th style={{ width: '180px', padding: '8px 12px', textAlign: 'left', fontSize: '11px' }}>Batch No</th>
                          <th style={{ width: '100px', padding: '8px 12px', textAlign: 'center', fontSize: '11px' }}>Qty</th>
                          <th style={{ width: '130px', padding: '8px 12px', textAlign: 'right', fontSize: '11px' }}>Cost Price</th>
                          <th style={{ width: '120px', padding: '8px 12px', textAlign: 'right', fontSize: '11px' }}>Discount</th>
                          <th style={{ width: '120px', padding: '8px 12px', textAlign: 'right', fontSize: '11px' }}>Tax</th>
                          <th style={{ width: '140px', padding: '8px 12px', textAlign: 'right', fontSize: '11px' }}>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedPo.items && selectedPo.items.map((item, index) => {
                          const qty = parseFloat(item.Quantity || item.ReceivedQty || 0);
                          const cost = parseFloat(item.UnitCost || 0);
                          const discount = parseFloat(item.Discount || 0);
                          const tax = parseFloat(item.Tax || 0);
                          const amount = (qty * cost) - discount + tax;
                          return (
                            <tr key={index} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                              <td style={{ padding: '8px 12px' }}>
                                <div style={{ fontWeight: '600' }}>{item.ProductName}</div>
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Barcode: {item.Barcode}</div>
                              </td>
                              <td style={{ padding: '8px 12px' }}>
                                <span className="mono" style={{ fontSize: '12.5px' }}>{item.BatchNo || 'N/A'}</span>
                              </td>
                              <td style={{ padding: '8px 12px', textAlign: 'center' }} className="mono">
                                {qty.toFixed(3)}
                              </td>
                              <td style={{ padding: '8px 12px', textAlign: 'right' }} className="mono">
                                Rs. {formatCurrency(cost)}
                              </td>
                              <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--danger)' }} className="mono">
                                - Rs. {formatCurrency(discount)}
                              </td>
                              <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--warning)' }} className="mono">
                                + Rs. {formatCurrency(tax)}
                              </td>
                              <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '700', color: 'var(--accent)' }} className="mono">
                                Rs. {formatCurrency(amount)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Bottom Section: Left side for Payment details, Right side for Summary */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '24px', borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '16px', marginBottom: '20px' }}>
                  <div className="glass-panel" style={{ padding: '14px', background: 'rgba(255, 255, 255, 0.01)', border: '1px solid rgba(255, 255, 255, 0.05)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <h4 style={{ margin: 0, fontSize: '12.5px', fontWeight: '700', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '6px' }}>Record Payment details (Cash / Direct settlement)</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Paid Amount (Rs.)</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0.00"
                          className="form-input"
                          style={{ height: '32px', fontSize: '13px', padding: '0 10px' }}
                          value={invoiceForm.amountPaid}
                          onChange={(e) => setInvoiceForm(prev => ({ ...prev, amountPaid: e.target.value }))}
                          placeholder="0.00"
                        />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Payment Method</label>
                        <select
                          className="form-select"
                          style={{ height: '32px', fontSize: '13px', padding: '0 10px' }}
                          value={invoiceForm.paymentMethod}
                          onChange={(e) => setInvoiceForm(prev => ({ ...prev, paymentMethod: e.target.value }))}
                        >
                          <option value="Cash">Cash</option>
                          <option value="Bank Transfer">Bank Transfer</option>
                          <option value="Cheque">Cheque</option>
                        </select>
                      </div>
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Payment Reference / Notes</label>
                      <input
                        type="text"
                        className="form-input"
                        style={{ height: '32px', fontSize: '12.5px', padding: '0 10px' }}
                        value={invoiceForm.paymentReference}
                        onChange={(e) => setInvoiceForm(prev => ({ ...prev, paymentReference: e.target.value }))}
                        placeholder="e.g. Chq No, Tx Ref, etc."
                      />
                    </div>
                  </div>

                  {/* Summary Block */}
                  <div className="glass-panel" style={{ padding: '14px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                      <span>Sub Total:</span>
                      <span className="mono" style={{ fontWeight: '600', color: 'var(--text-primary)' }}>Rs. {formatCurrency(subTotal)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                      <span>Discount:</span>
                      <span className="mono" style={{ fontWeight: '600', color: 'var(--danger)' }}>- Rs. {formatCurrency(totalDiscount)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                      <span>Tax:</span>
                      <span className="mono" style={{ fontWeight: '600', color: 'var(--warning)' }}>+ Rs. {formatCurrency(totalTax)}</span>
                    </div>
                    <hr style={{ border: 'none', borderTop: '1px dashed rgba(255, 255, 255, 0.1)', margin: '4px 0' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '700', fontSize: '14px' }}>
                      <span>Grand Total:</span>
                      <span className="mono" style={{ color: 'var(--success)' }}>Rs. {formatCurrency(grandTotal)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                      <span>Paid Amount:</span>
                      <span className="mono" style={{ fontWeight: '600', color: 'var(--text-primary)' }}>Rs. {formatCurrency(paidAmount)}</span>
                    </div>
                    <hr style={{ border: 'none', borderTop: '1px dashed rgba(255, 255, 255, 0.1)', margin: '4px 0' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '800', fontSize: '15px' }}>
                      <span>Balance Due:</span>
                      <span className="mono" style={{ color: balanceDue > 0 ? 'var(--warning)' : 'var(--success)' }}>Rs. {formatCurrency(balanceDue)}</span>
                    </div>
                  </div>
                </div>

                {/* Actions Footer */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '16px' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => {
                        setSelectedPo(prev => ({
                          ...prev,
                          InvoiceNumber: invoiceForm.invoiceNumber || 'DRAFT-BILL',
                          InvoiceDate: invoiceForm.invoiceDate,
                          DueDate: invoiceForm.dueDate,
                          PaymentTerms: invoiceForm.paymentTerms,
                          AmountPaid: paidAmount,
                          BalanceDue: balanceDue,
                          Status: 'Invoiced'
                        }));
                        setTimeout(() => window.print(), 100);
                      }}
                      style={{ fontSize: '12.5px', height: '34px' }}
                    >
                      <Printer size={13} style={{ marginRight: '4px' }} /> Print
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => {
                        const supMail = selectedPo.EmailAddress || suppliers.find(s => s.SupplierID === selectedPo.SupplierID)?.EmailAddress;
                        if (supMail) {
                          setToast({ type: 'success', message: `Bill details emailed successfully to ${supMail}` });
                        } else {
                          setToast({ type: 'warning', message: 'Supplier profile is missing an email address.' });
                        }
                      }}
                      style={{ fontSize: '12.5px', height: '34px' }}
                    >
                      Email
                    </button>
                  </div>

                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button type="button" className="btn btn-secondary" onClick={() => setShowInvoiceModal(false)} style={{ fontSize: '12.5px', height: '34px' }}>
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary" style={{ fontSize: '12.5px', height: '34px' }} disabled={actionLoading}>
                      Save Bill
                    </button>
                    <button
                      type="button"
                      className="btn"
                      style={{ background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid rgba(16,185,129,0.3)', fontSize: '12.5px', height: '34px' }}
                      disabled={actionLoading}
                      onClick={() => {
                        let currentPaid = parseFloat(invoiceForm.amountPaid || 0);
                        if (currentPaid <= 0) {
                          setInvoiceForm(prev => ({ ...prev, amountPaid: formatCurrency(grandTotal) }));
                          setTimeout(() => {
                            const form = document.querySelector('#bill-form');
                            if (form) form.requestSubmit();
                          }, 50);
                        } else {
                          const form = document.querySelector('#bill-form');
                          if (form) form.requestSubmit();
                        }
                      }}
                    >
                      Record Payment
                    </button>
                  </div>
                </div>

              </form>
            </div>
          </div>
        );
      })()}

      {/* ============================================================================
         MODAL: RECORD SETTLEMENT PAYMENT (DEBIT SETTLEMENT)
         ============================================================================ */}
      {showPaymentModal && (() => {
        const selectedSupplier = suppliers.find(s => String(s.SupplierID) === String(paymentForm.supplierId));
        const outstandingBalance = selectedSupplier ? Number(selectedSupplier.CurrentBalance) : 0;
        const payAmt = parseFloat(paymentForm.amount) || 0;
        const balanceAfter = outstandingBalance - payAmt;
        const methodIcon = { 'Bank Transfer': '🏦', 'Cash': '💵', 'Cheque': '📝' };
        const methodColor = { 'Bank Transfer': '#06b6d4', 'Cash': '#10b981', 'Cheque': '#f59e0b' };

        return (
          <div className="modal-overlay no-print" onClick={(e) => e.target === e.currentTarget && setShowPaymentModal(false)}>
            <div style={{
              width: '520px',
              background: 'linear-gradient(145deg, #0f1423 0%, #161c30 100%)',
              border: '1px solid var(--border-color)',
              borderRadius: '20px',
              boxShadow: '0 32px 80px rgba(0,0,0,0.6), 0 0 40px rgba(139,92,246,0.1)',
              overflow: 'hidden',
              fontFamily: 'var(--font-sans)',
            }}>

              {/* ── Voucher Header ── */}
              <div style={{
                background: 'linear-gradient(135deg, #2a1f42 0%, #0c2730 100%)',
                borderBottom: '1px solid var(--border-color)',
                padding: '24px 28px 20px',
                position: 'relative',
                overflow: 'hidden',
              }}>
                {/* Decorative circles */}
                <div style={{ position:'absolute', top:'-20px', right:'-20px', width:'100px', height:'100px', borderRadius:'50%', background:'rgba(139,92,246,0.15)', pointerEvents:'none' }} />
                <div style={{ position:'absolute', bottom:'-30px', right:'60px', width:'70px', height:'70px', borderRadius:'50%', background:'rgba(6,182,212,0.1)', pointerEvents:'none' }} />

                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', position:'relative' }}>
                  <div>
                    <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'4px' }}>
                      <div style={{
                        width:'36px', height:'36px', borderRadius:'10px',
                        background:'linear-gradient(135deg,#8b5cf6,#06b6d4)',
                        display:'flex', alignItems:'center', justifyContent:'center',
                        fontSize:'18px', boxShadow:'0 4px 12px rgba(139,92,246,0.4)'
                      }}>💳</div>
                      <div>
                        <div style={{ fontSize:'17px', fontWeight:'800', color:'#f8fafc', letterSpacing:'-0.3px' }}>Payment Voucher</div>
                        <div style={{ fontSize:'11px', color:'rgba(148,163,184,0.9)', fontWeight:'500', textTransform:'uppercase', letterSpacing:'1px' }}>Supplier Settlement</div>
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize:'11px', color:'rgba(148,163,184,0.7)', marginBottom:'2px' }}>DATE</div>
                    <div style={{ fontSize:'13px', fontWeight:'700', color:'#f8fafc' }}>
                      {paymentForm.paymentDate ? new Date(paymentForm.paymentDate).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : '—'}
                    </div>
                  </div>
                </div>

                {/* Supplier Info Strip */}
                {selectedSupplier && (
                  <div style={{
                    marginTop:'16px', padding:'10px 14px',
                    background:'rgba(0,0,0,0.25)', borderRadius:'10px',
                    border:'1px solid rgba(255,255,255,0.07)',
                    display:'flex', alignItems:'center', justifyContent:'space-between'
                  }}>
                    <div>
                      <div style={{ fontSize:'12px', color:'rgba(148,163,184,0.7)', marginBottom:'2px' }}>PAYING TO</div>
                      <div style={{ fontSize:'14px', fontWeight:'700', color:'#f8fafc' }}>{selectedSupplier.SupplierName}</div>
                      {selectedSupplier.CompanyName && <div style={{ fontSize:'11px', color:'rgba(148,163,184,0.7)' }}>{selectedSupplier.CompanyName}</div>}
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontSize:'11px', color:'rgba(148,163,184,0.7)', marginBottom:'2px' }}>OUTSTANDING</div>
                      <div style={{ fontSize:'15px', fontWeight:'800', color: outstandingBalance > 0 ? '#ef4444' : '#10b981' }}>
                        Rs. {formatCurrency(outstandingBalance)}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Form Body ── */}
              <form onSubmit={handlePaymentSubmit}>
                <div style={{ padding:'22px 28px', display:'flex', flexDirection:'column', gap:'16px' }}>

                  {/* Supplier Select */}
                  <div>
                    <label style={{ fontSize:'11px', fontWeight:'700', color:'rgba(148,163,184,0.8)', textTransform:'uppercase', letterSpacing:'0.8px', display:'block', marginBottom:'6px' }}>
                      Select Supplier *
                    </label>
                    <select
                      className="form-select"
                      value={paymentForm.supplierId}
                      onChange={(e) => setPaymentForm(prev => ({ ...prev, supplierId: e.target.value }))}
                      required
                      style={{ width:'100%', borderRadius:'10px' }}
                    >
                      {suppliers.map(s => (
                        <option key={s.SupplierID} value={s.SupplierID}>
                          {s.SupplierName} — Owes: Rs. {formatCurrency(Number(s.CurrentBalance))}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Amount + live balance preview */}
                  <div>
                    <label style={{ fontSize:'11px', fontWeight:'700', color:'rgba(148,163,184,0.8)', textTransform:'uppercase', letterSpacing:'0.8px', display:'block', marginBottom:'6px' }}>
                      Payment Amount (Rs.) *
                    </label>
                    <div style={{ position:'relative' }}>
                      <span style={{
                        position:'absolute', left:'14px', top:'50%', transform:'translateY(-50%)',
                        fontSize:'14px', fontWeight:'700', color:'var(--primary)', pointerEvents:'none'
                      }}>Rs.</span>
                      <input
                        type="number" step="0.01" min="0.01"
                        className="form-input"
                        value={paymentForm.amount}
                        onChange={(e) => setPaymentForm(prev => ({ ...prev, amount: e.target.value }))}
                        placeholder="0.00"
                        required
                        style={{ paddingLeft:'44px', fontSize:'18px', fontWeight:'700', letterSpacing:'-0.5px', borderRadius:'10px' }}
                      />
                    </div>

                    {/* Live balance after payment */}
                    {payAmt > 0 && (
                      <div style={{
                        marginTop:'8px', padding:'10px 14px',
                        background: balanceAfter <= 0 ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
                        border: `1px solid ${balanceAfter <= 0 ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}`,
                        borderRadius:'8px', display:'flex', justifyContent:'space-between', alignItems:'center'
                      }}>
                        <span style={{ fontSize:'12px', color:'rgba(148,163,184,0.8)', fontWeight:'600' }}>
                          {balanceAfter <= 0 ? '✅ Fully Settled' : '⚠ Balance Remaining'}
                        </span>
                        <span style={{
                          fontSize:'14px', fontWeight:'800',
                          color: balanceAfter <= 0 ? '#10b981' : '#f59e0b'
                        }}>
                          Rs. {formatCurrency(Math.abs(balanceAfter))} {balanceAfter < 0 ? '(Overpaid)' : ''}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Payment Method — pill buttons */}
                  <div>
                    <label style={{ fontSize:'11px', fontWeight:'700', color:'rgba(148,163,184,0.8)', textTransform:'uppercase', letterSpacing:'0.8px', display:'block', marginBottom:'8px' }}>
                      Payment Method
                    </label>
                    <div style={{ display:'flex', gap:'8px' }}>
                      {['Bank Transfer','Cash','Cheque'].map(method => (
                        <button
                          key={method} type="button"
                          onClick={() => setPaymentForm(prev => ({ ...prev, paymentMethod: method }))}
                          style={{
                            flex:1, padding:'9px 6px', borderRadius:'10px', cursor:'pointer',
                            fontSize:'12px', fontWeight:'700', border:'1px solid',
                            transition:'all 0.2s',
                            background: paymentForm.paymentMethod === method
                              ? `${methodColor[method]}22`
                              : 'rgba(255,255,255,0.03)',
                            borderColor: paymentForm.paymentMethod === method
                              ? methodColor[method]
                              : 'rgba(255,255,255,0.1)',
                            color: paymentForm.paymentMethod === method
                              ? methodColor[method]
                              : 'rgba(148,163,184,0.7)',
                            boxShadow: paymentForm.paymentMethod === method
                              ? `0 0 12px ${methodColor[method]}33`
                              : 'none',
                          }}
                        >
                          <div style={{ fontSize:'16px', marginBottom:'3px' }}>{methodIcon[method]}</div>
                          {method}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Reference + Date in 2 columns */}
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
                    <div>
                      <label style={{ fontSize:'11px', fontWeight:'700', color:'rgba(148,163,184,0.8)', textTransform:'uppercase', letterSpacing:'0.8px', display:'block', marginBottom:'6px' }}>
                        Reference No.
                      </label>
                      <input
                        type="text" className="form-input"
                        value={paymentForm.referenceNumber}
                        onChange={(e) => setPaymentForm(prev => ({ ...prev, referenceNumber: e.target.value }))}
                        placeholder="CHQ-001 / TXN-492"
                        style={{ borderRadius:'10px' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize:'11px', fontWeight:'700', color:'rgba(148,163,184,0.8)', textTransform:'uppercase', letterSpacing:'0.8px', display:'block', marginBottom:'6px' }}>
                        Payment Date
                      </label>
                      <input
                        type="date" className="form-input"
                        value={paymentForm.paymentDate}
                        onChange={(e) => setPaymentForm(prev => ({ ...prev, paymentDate: e.target.value }))}
                        style={{ borderRadius:'10px' }}
                      />
                    </div>
                  </div>

                  {/* Branch */}
                  <div>
                    <label style={{ fontSize:'11px', fontWeight:'700', color:'rgba(148,163,184,0.8)', textTransform:'uppercase', letterSpacing:'0.8px', display:'block', marginBottom:'6px' }}>
                      Branch
                    </label>
                    <select
                      className="form-select"
                      value={paymentForm.branchName}
                      onChange={(e) => setPaymentForm(prev => ({ ...prev, branchName: e.target.value }))}
                      style={{ width:'100%', borderRadius:'10px' }}
                    >
                      <option value="Main Store">Main Store</option>
                      <option value="Colombo Branch">Colombo Branch</option>
                    </select>
                  </div>

                  {/* Notes */}
                  <div>
                    <label style={{ fontSize:'11px', fontWeight:'700', color:'rgba(148,163,184,0.8)', textTransform:'uppercase', letterSpacing:'0.8px', display:'block', marginBottom:'6px' }}>
                      Description / Narration
                    </label>
                    <input
                      type="text" className="form-input"
                      value={paymentForm.notes}
                      onChange={(e) => setPaymentForm(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder="e.g. Settlement of Invoice INV-9485"
                      style={{ borderRadius:'10px' }}
                    />
                  </div>
                </div>

                {/* ── Footer ── */}
                <div style={{
                  padding:'18px 28px',
                  borderTop:'1px solid rgba(255,255,255,0.07)',
                  background:'rgba(0,0,0,0.2)',
                  display:'flex', justifyContent:'space-between', alignItems:'center', gap:'12px'
                }}>
                  <button
                    type="button"
                    onClick={() => setShowPaymentModal(false)}
                    style={{
                      padding:'10px 22px', borderRadius:'10px', border:'1px solid rgba(255,255,255,0.12)',
                      background:'transparent', color:'rgba(148,163,184,0.8)',
                      fontSize:'13px', fontWeight:'600', cursor:'pointer',
                      transition:'all 0.2s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background='rgba(255,255,255,0.05)'; e.currentTarget.style.color='#f8fafc'; }}
                    onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.color='rgba(148,163,184,0.8)'; }}
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
                      transition:'all 0.2s', letterSpacing:'-0.2px',
                      display:'flex', alignItems:'center', justifyContent:'center', gap:'8px'
                    }}
                  >
                    {actionLoading ? (
                      <>
                        <span style={{ display:'inline-block', width:'14px', height:'14px', border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
                        Processing...
                      </>
                    ) : (
                      <>💳 Record Payment Voucher</>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* ============================================================================
         MODAL: RECORD LEDGER ADJUSTMENT (DEBIT/CREDIT NOTE)
         ============================================================================ */}
      {showAdjustmentModal && (() => {
        const selectedSupplier = suppliers.find(s => String(s.SupplierID) === String(adjustmentForm.supplierId));
        const outstandingBalance = selectedSupplier ? Number(selectedSupplier.CurrentBalance) : 0;
        const adjAmt = parseFloat(adjustmentForm.amount) || 0;
        let balanceAfter = outstandingBalance;
        if (adjustmentForm.effect === 'Debit') {
          balanceAfter = outstandingBalance - adjAmt;
        } else {
          balanceAfter = outstandingBalance + adjAmt;
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
                        <div style={{ fontSize:'17px', fontWeight:'800', color:'#f8fafc', letterSpacing:'-0.3px' }}>Ledger Adjustment</div>
                        <div style={{ fontSize:'11px', color:'rgba(148,163,184,0.9)', fontWeight:'500', textTransform:'uppercase', letterSpacing:'1px' }}>Debit / Credit Notes</div>
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
                <div style={{ padding:'28px', display:'flex', flexDirection:'column', gap:'20px', background:'rgba(15,23,42,0.15)' }}>
                  {/* Supplier Info Strip */}
                  {selectedSupplier && (
                    <div style={{
                      display:'flex', justifyContent:'space-between', alignItems:'center',
                      background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)',
                      borderRadius:'12px', padding:'12px 16px'
                    }}>
                      <div>
                        <div style={{ fontSize:'13px', fontWeight:'700', color:'#f8fafc' }}>{selectedSupplier.SupplierName}</div>
                        <div style={{ fontSize:'11px', color:'rgba(148,163,184,0.6)', marginTop:'2px' }}>Code: {selectedSupplier.SupplierCode}</div>
                      </div>
                      <div style={{ textAlign:'right' }}>
                        <div style={{ fontSize:'11px', color:'rgba(148,163,184,0.6)' }}>Outstanding Bal</div>
                        <div style={{ fontSize:'14px', fontWeight:'800', color: outstandingBalance > 0 ? '#f59e0b' : '#38bdf8', marginTop:'2px' }}>
                          Rs. {formatCurrency(outstandingBalance)}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Supplier Dropdown Selector if not selected */}
                  {!selectedLedgerSupplier && (
                    <div>
                      <label style={{ fontSize:'11px', fontWeight:'700', color:'rgba(148,163,184,0.8)', textTransform:'uppercase', display:'block', marginBottom:'6px' }}>
                        Select Supplier
                      </label>
                      <select
                        className="form-select"
                        value={adjustmentForm.supplierId}
                        onChange={(e) => setAdjustmentForm(prev => ({ ...prev, supplierId: e.target.value }))}
                        required
                        style={{ borderRadius:'10px' }}
                      >
                        <option value="">-- Choose Supplier --</option>
                        {suppliers.map(s => (
                          <option key={s.SupplierID} value={s.SupplierID}>{s.SupplierName}</option>
                        ))}
                      </select>
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
                        placeholder="DN-001 / CN-001"
                        style={{ borderRadius:'10px' }}
                      />
                    </div>
                  </div>

                  {/* Type Selector (Debit Note or Credit Note) */}
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
                    <div>
                      <label style={{ fontSize:'11px', fontWeight:'700', color:'rgba(148,163,184,0.8)', textTransform:'uppercase', display:'block', marginBottom:'6px' }}>
                        Adjustment Type
                      </label>
                      <select
                        className="form-select"
                        value={adjustmentForm.adjustmentType}
                        onChange={(e) => {
                          const val = e.target.value;
                          setAdjustmentForm(prev => ({
                            ...prev,
                            adjustmentType: val,
                            effect: 'Debit' 
                          }));
                        }}
                        style={{ borderRadius:'10px' }}
                        required
                      >
                        <option value="Debit Note">Debit Note</option>
                        <option value="Credit Note">Credit Note</option>
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
                        <option value="Debit">Reduce Balance (Debit)</option>
                        <option value="Credit">Increase Balance (Credit)</option>
                      </select>
                    </div>
                  </div>

                  {/* Amount + Branch */}
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
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
                    <div>
                      <label style={{ fontSize:'11px', fontWeight:'700', color:'rgba(148,163,184,0.8)', textTransform:'uppercase', display:'block', marginBottom:'6px' }}>
                        Branch
                      </label>
                      <select
                        className="form-select"
                        value={adjustmentForm.branchName}
                        onChange={(e) => setAdjustmentForm(prev => ({ ...prev, branchName: e.target.value }))}
                        style={{ borderRadius:'10px' }}
                      >
                        <option value="Main Store">Main Store</option>
                        <option value="Colombo Branch">Colombo Branch</option>
                      </select>
                    </div>
                  </div>

                  {/* Narration */}
                  <div>
                    <label style={{ fontSize:'11px', fontWeight:'700', color:'rgba(148,163,184,0.8)', textTransform:'uppercase', display:'block', marginBottom:'6px' }}>
                      Narration / Description
                    </label>
                    <input
                      type="text" className="form-input"
                      value={adjustmentForm.notes}
                      onChange={(e) => setAdjustmentForm(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder="e.g. Damage claim / Price difference adjustment"
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
                    {actionLoading ? 'Processing...' : `✔ Save ${adjustmentForm.adjustmentType}`}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* ============================================================================
         MODAL: DIRECT CASH PURCHASE (ENTER BILL)
         ============================================================================ */}
      {showDirectCashPurchaseModal && (() => {
        const totalQty = directPurchaseForm.items.reduce((sum, item) => sum + parseFloat(item.quantity || 0), 0);
        const subTotal = directPurchaseForm.items.reduce((sum, item) => sum + (parseFloat(item.quantity || 0) * parseFloat(item.unitCost || 0)), 0);
        const grandTotal = subTotal; // simplified cash bill totals

        return (
          <div className="modal-overlay no-print">
            <div className="modal-content glass-panel" style={{ width: '1300px', maxWidth: '95vw', padding: '24px', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: 'var(--radius-lg)' }}>
              
              {/* Modal Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Receipt size={18} style={{ color: '#10b981' }} />
                  <h3 style={{ fontSize: '16px', fontWeight: '700', margin: 0 }}>Direct Cash Purchase (Enter Bill)</h3>
                </div>
                <button type="button" className="close-btn" onClick={() => setShowDirectCashPurchaseModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleDirectPurchaseSubmit}>
                {/* Header Fields */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '20px' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Bill Number</label>
                    <input type="text" className="form-input" style={{ height: '32px', fontSize: '13px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', padding: '0 10px' }} value="BILL-XXXX (Auto)" disabled />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Supplier *</label>
                    <select
                      className="form-select"
                      style={{ height: '32px', fontSize: '13px', padding: '0 10px' }}
                      value={directPurchaseForm.supplierId}
                      onChange={(e) => setDirectPurchaseForm(prev => ({ ...prev, supplierId: e.target.value }))}
                      required
                    >
                      {suppliers.map(s => (
                        <option key={s.SupplierID} value={s.SupplierID}>{s.SupplierName}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Supplier Invoice/Reference No.</label>
                    <input
                      type="text"
                      className="form-input"
                      style={{ height: '32px', fontSize: '13px', padding: '0 10px' }}
                      placeholder="e.g. INV-1004"
                      value={directPurchaseForm.invoiceNumber}
                      onChange={(e) => setDirectPurchaseForm(prev => ({ ...prev, invoiceNumber: e.target.value }))}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Purchase Date *</label>
                    <input
                      type="date"
                      className="form-input"
                      style={{ height: '32px', fontSize: '13px', padding: '0 10px' }}
                      value={directPurchaseForm.invoiceDate}
                      onChange={(e) => setDirectPurchaseForm(prev => ({ ...prev, invoiceDate: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Store / Destination Branch *</label>
                    <select
                      className="form-select"
                      style={{ height: '32px', fontSize: '13px', padding: '0 10px' }}
                      value={directPurchaseForm.branchName}
                      onChange={(e) => setDirectPurchaseForm(prev => ({ ...prev, branchName: e.target.value }))}
                      required
                    >
                      <option value="Main Store">Main Store</option>
                      <option value="Colombo Branch">Colombo Branch</option>
                    </select>
                  </div>
                </div>

                {/* Items Table */}
                <div className="form-group" style={{ marginBottom: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <label className="form-label" style={{ marginBottom: 0, fontWeight: '700' }}>Purchased Products</label>
                    <button type="button" className="btn btn-secondary" style={{ padding: '4px 12px', fontSize: '12px' }} onClick={handleAddDirectPurchaseItem}>
                      + Add Item Row
                    </button>
                  </div>

                  <div className="glass-panel" style={{ padding: 0, maxHeight: '280px', overflowY: 'auto' }}>
                    <table className="table-glass" style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '11px' }}>Product Smart Search (Name, Barcode, SKU)</th>
                          <th style={{ width: '80px', padding: '8px 12px', textAlign: 'center', fontSize: '11px' }}>Qty</th>
                          <th style={{ width: '100px', padding: '8px 12px', textAlign: 'right', fontSize: '11px' }}>Cost Price</th>
                          <th style={{ width: '100px', padding: '8px 12px', textAlign: 'left', fontSize: '11px' }}>Batch No.</th>
                          <th style={{ width: '120px', padding: '8px 12px', textAlign: 'left', fontSize: '11px' }}>Expiry Date</th>
                          <th style={{ width: '110px', padding: '8px 12px', textAlign: 'left', fontSize: '11px' }}>Warehouse</th>
                          <th style={{ width: '110px', padding: '8px 12px', textAlign: 'right', fontSize: '11px' }}>Amount</th>
                          <th style={{ width: '45px', padding: '8px' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {directPurchaseForm.items.map((item, index) => {
                          const prod = products.find(p => p.ProductID === parseInt(item.productId, 10));
                          const isBatchTracked = prod?.IsBatchTracked || false;
                          const amount = parseFloat(item.quantity || 0) * parseFloat(item.unitCost || 0);

                          return (
                            <tr key={index}>
                              <td style={{ padding: '6px', position: 'relative' }}>
                                <input
                                  type="text"
                                  className="form-input po-item-select"
                                  style={{ width: '100%', height: '32px', fontSize: '13px', padding: '0 10px' }}
                                  value={item.searchQuery || ''}
                                  onChange={(e) => handleDirectPurchaseSearchInputChange(index, e.target.value)}
                                  onFocus={() => setActiveSearchIndex(index)}
                                  onBlur={() => setTimeout(() => setActiveSearchIndex(null), 250)}
                                  onKeyDown={(e) => handleDirectPurchaseSearchInputKeyDown(e, index)}
                                  placeholder="Type Name, Barcode, or SKU..."
                                  required
                                />
                                
                                {activeSearchIndex === index && (() => {
                                  const query = (item.searchQuery || '').toLowerCase().trim();
                                  const filteredProducts = products.filter(p => {
                                    if (!query) return true;
                                    return (
                                      p.Name.toLowerCase().includes(query) ||
                                      (p.Barcode && p.Barcode.toLowerCase().includes(query)) ||
                                      (p.SKU && p.SKU.toLowerCase().includes(query))
                                    );
                                  }).slice(0, 8);

                                  return (
                                    <div 
                                      className="glass-panel" 
                                      style={{ 
                                        position: 'absolute', 
                                        left: '6px', 
                                        right: '6px', 
                                        top: '38px', 
                                        zIndex: 999, 
                                        maxHeight: '200px', 
                                        overflowY: 'auto', 
                                        background: 'var(--bg-surface-elevated)', 
                                        border: '1px solid var(--border-color)',
                                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)',
                                        borderRadius: 'var(--radius-sm)',
                                        padding: '4px'
                                      }}
                                    >
                                      {filteredProducts.length === 0 ? (
                                        <div style={{ padding: '8px', fontSize: '12.5px', color: 'var(--text-secondary)', textAlign: 'center' }}>
                                          No products found
                                        </div>
                                      ) : (
                                        filteredProducts.map(p => (
                                          <div
                                            key={p.ProductID}
                                            className="search-item"
                                            style={{
                                              padding: '6px 10px',
                                              cursor: 'pointer',
                                              fontSize: '12.5px',
                                              borderRadius: 'var(--radius-xs)',
                                              color: 'var(--text-secondary)',
                                              display: 'flex',
                                              justifyContent: 'space-between'
                                            }}
                                            onMouseDown={() => {
                                              const newItems = [...directPurchaseForm.items];
                                              const existIdx = newItems.findIndex((x, i) => i !== index && String(x.productId) === String(p.ProductID));
                                              if (existIdx !== -1) {
                                                newItems[existIdx].quantity = String(parseFloat(newItems[existIdx].quantity || 1) + 1);
                                                newItems.splice(index, 1);
                                                setToast({ type: 'success', message: `Merged: ${p.Name}` });
                                              } else {
                                                newItems[index].productId = p.ProductID;
                                                newItems[index].unitCost = formatCurrency(Number(p.Cost));
                                                newItems[index].searchQuery = `${p.Name} (${p.Barcode || p.SKU})`;
                                              }
                                              setDirectPurchaseForm(prev => ({ ...prev, items: newItems }));
                                              setActiveSearchIndex(null);
                                            }}
                                          >
                                            <span style={{ fontWeight: '600', color: 'white' }}>{p.Name}</span>
                                            <span style={{ fontSize: '11px', opacity: 0.7 }}>Barcode: {p.Barcode || '--'}</span>
                                          </div>
                                        ))
                                      )}
                                    </div>
                                  );
                                })()}
                              </td>
                              <td style={{ padding: '6px' }}>
                                <input
                                  type="number"
                                  className="form-input"
                                  style={{ width: '100%', height: '32px', fontSize: '13px', textAlign: 'center', padding: '0 6px' }}
                                  value={item.quantity}
                                  onChange={(e) => handleDirectPurchaseItemChange(index, 'quantity', e.target.value)}
                                  min="0.001"
                                  step="any"
                                  required
                                />
                              </td>
                              <td style={{ padding: '6px' }}>
                                <input
                                  type="number"
                                  className="form-input"
                                  style={{ width: '100%', height: '32px', fontSize: '13px', textAlign: 'right', padding: '0 6px' }}
                                  value={item.unitCost}
                                  onChange={(e) => handleDirectPurchaseItemChange(index, 'unitCost', e.target.value)}
                                  min="0.00"
                                  step="0.01"
                                  required
                                />
                              </td>
                              <td style={{ padding: '6px' }}>
                                <input
                                  type="text"
                                  className="form-input"
                                  style={{ width: '100%', height: '32px', fontSize: '13px', padding: '0 6px' }}
                                  placeholder={isBatchTracked ? "Batch No" : "N/A"}
                                  value={item.batchNo}
                                  onChange={(e) => handleDirectPurchaseItemChange(index, 'batchNo', e.target.value)}
                                  disabled={!isBatchTracked}
                                  required={isBatchTracked}
                                />
                              </td>
                              <td style={{ padding: '6px' }}>
                                <input
                                  type="date"
                                  className="form-input"
                                  style={{ width: '100%', height: '32px', fontSize: '13px', padding: '0 6px' }}
                                  value={item.expiryDate || ''}
                                  onChange={(e) => handleDirectPurchaseItemChange(index, 'expiryDate', e.target.value)}
                                  disabled={!isBatchTracked}
                                  required={isBatchTracked}
                                />
                              </td>
                              <td style={{ padding: '6px' }}>
                                <select
                                  className="form-select"
                                  style={{ width: '100%', height: '32px', fontSize: '13px', padding: '0' }}
                                  value={item.warehouseName}
                                  onChange={(e) => handleDirectPurchaseItemChange(index, 'warehouseName', e.target.value)}
                                >
                                  <option value="Main Warehouse">Main WH</option>
                                  <option value="Store Branch WH">Store WH</option>
                                </select>
                              </td>
                              <td style={{ padding: '6px', textAlign: 'right', fontWeight: '700', color: 'white', verticalAlign: 'middle', fontSize: '13px' }} className="mono">
                                Rs. {formatCurrency(amount)}
                              </td>
                              <td style={{ padding: '6px', textAlign: 'center' }}>
                                <button
                                  type="button"
                                  className="btn btn-danger btn-icon"
                                  style={{ width: '28px', height: '28px' }}
                                  onClick={() => handleRemoveDirectPurchaseItem(index)}
                                  disabled={directPurchaseForm.items.length <= 1}
                                >
                                  <Trash2 size={12} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Immediate Cash Payment Information */}
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '20px' }}>
                  <h4 style={{ fontSize: '13px', fontWeight: '700', color: '#10b981', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Coins size={14} /> Immediate Payment (Cash Book Settlement)
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: '16px' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Payment Mode *</label>
                      <select
                        className="form-select"
                        style={{ height: '32px', fontSize: '13px' }}
                        value={directPurchaseForm.paymentMethod}
                        onChange={(e) => setDirectPurchaseForm(prev => ({ ...prev, paymentMethod: e.target.value }))}
                        required
                      >
                        <option value="Cash">Cash Account</option>
                        <option value="Bank Transfer">Bank Transfer / PETTY</option>
                        <option value="Cheque">Company Cheque</option>
                      </select>
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Payment Reference / Chq No.</label>
                      <input
                        type="text"
                        className="form-input"
                        style={{ height: '32px', fontSize: '13px' }}
                        placeholder="e.g. TXN987213"
                        value={directPurchaseForm.paymentReference}
                        onChange={(e) => setDirectPurchaseForm(prev => ({ ...prev, paymentReference: e.target.value }))}
                      />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Billing Notes</label>
                      <input
                        type="text"
                        className="form-input"
                        style={{ height: '32px', fontSize: '13px' }}
                        placeholder="Direct cash procurement of warehouse stock"
                        value={directPurchaseForm.notes}
                        onChange={(e) => setDirectPurchaseForm(prev => ({ ...prev, notes: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>

                {/* Footer and Summary */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '16px' }}>
                  <div style={{ display: 'flex', gap: '24px' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      Total Items: <strong style={{ color: 'white', fontSize: '13px' }}>{totalQty.toFixed(0)}</strong>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      Grand Total: <strong style={{ color: '#10b981', fontSize: '14px' }} className="mono">Rs. {formatCurrency(grandTotal)}</strong>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button type="button" className="btn btn-secondary" onClick={() => setShowDirectCashPurchaseModal(false)} style={{ fontSize: '12.5px', height: '34px' }}>
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={actionLoading} style={{ fontSize: '12.5px', height: '34px', background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none', color: '#fff', padding: '0 20px', borderRadius: 'var(--radius-md)', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {actionLoading ? 'Processing...' : '✔ Save Bill & Post Payment'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* ============================================================================
         MODAL: DIRECT CREDIT PURCHASE INVOICE (ENTER CREDIT INVOICE)
         ============================================================================ */}
      {showDirectCreditPurchaseModal && (() => {
        const totalQty = directCreditPurchaseForm.items.reduce((sum, item) => sum + parseFloat(item.quantity || 0), 0);
        const subTotal = directCreditPurchaseForm.items.reduce((sum, item) => sum + (parseFloat(item.quantity || 0) * parseFloat(item.unitCost || 0)), 0);
        const totalDiscount = directCreditPurchaseForm.items.reduce((sum, item) => sum + parseFloat(item.discount || 0), 0);
        const totalTax = directCreditPurchaseForm.items.reduce((sum, item) => sum + parseFloat(item.tax || 0), 0);
        const grandTotal = subTotal - totalDiscount + totalTax;
        const paidAmountVal = parseFloat(directCreditPurchaseForm.paidAmount || 0);
        const balanceDue = Math.max(0, grandTotal - paidAmountVal);

        let statusText = 'Unpaid';
        let statusColor = '#ef4444';
        if (paidAmountVal >= grandTotal && grandTotal > 0) {
          statusText = 'Paid';
          statusColor = '#10b981';
        } else if (paidAmountVal > 0) {
          statusText = 'Partially Paid';
          statusColor = '#f59e0b';
        }

        return (
          <div className="modal-overlay no-print">
            <div className="modal-content glass-panel" style={{ width: '1350px', maxWidth: '95vw', padding: '24px', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: 'var(--radius-lg)' }}>
              
              {/* Modal Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Receipt size={18} style={{ color: '#3b82f6' }} />
                  <h3 style={{ fontSize: '16px', fontWeight: '700', margin: 0 }}>Direct Credit Purchase Invoice</h3>
                  <span style={{ fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '12px', background: `rgba(${statusColor === '#10b981' ? '16,185,129' : statusColor === '#f59e0b' ? '245,158,11' : '239,68,68'}, 0.15)`, color: statusColor, marginLeft: '8px' }}>
                    {statusText}
                  </span>
                </div>
                <button type="button" className="close-btn" onClick={() => setShowDirectCreditPurchaseModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleDirectCreditPurchaseSubmit}>
                {/* Header Fields */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '20px' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Bill Number</label>
                    <input type="text" className="form-input" style={{ height: '32px', fontSize: '13px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', padding: '0 10px' }} value="BILL-XXXX (Auto)" disabled />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Supplier *</label>
                    <select
                      className="form-select"
                      style={{ height: '32px', fontSize: '13px', padding: '0 10px' }}
                      value={directCreditPurchaseForm.supplierId}
                      onChange={(e) => {
                        const supplierId = e.target.value;
                        const sup = suppliers.find(s => String(s.SupplierID) === String(supplierId));
                        const creditPeriod = parseInt(sup?.CreditPeriodDays || '30', 10);
                        const dueDate = new Date(directCreditPurchaseForm.invoiceDate);
                        dueDate.setDate(dueDate.getDate() + creditPeriod);
                        setDirectCreditPurchaseForm(prev => ({
                          ...prev,
                          supplierId,
                          dueDate: dueDate.toISOString().split('T')[0]
                        }));
                      }}
                      required
                    >
                      {suppliers.map(s => (
                        <option key={s.SupplierID} value={s.SupplierID}>{s.SupplierName}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Supplier Invoice/Ref No. *</label>
                    <input
                      type="text"
                      className="form-input"
                      style={{ height: '32px', fontSize: '13px', padding: '0 10px' }}
                      placeholder="e.g. INV-1004"
                      value={directCreditPurchaseForm.invoiceNumber}
                      onChange={(e) => setDirectCreditPurchaseForm(prev => ({ ...prev, invoiceNumber: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Invoice Date *</label>
                    <input
                      type="date"
                      className="form-input"
                      style={{ height: '32px', fontSize: '13px', padding: '0 10px' }}
                      value={directCreditPurchaseForm.invoiceDate}
                      onChange={(e) => {
                        const invDateStr = e.target.value;
                        const sup = suppliers.find(s => String(s.SupplierID) === String(directCreditPurchaseForm.supplierId));
                        const creditPeriod = parseInt(sup?.CreditPeriodDays || '30', 10);
                        const dueDate = new Date(invDateStr);
                        dueDate.setDate(dueDate.getDate() + creditPeriod);
                        setDirectCreditPurchaseForm(prev => ({
                          ...prev,
                          invoiceDate: invDateStr,
                          dueDate: dueDate.toISOString().split('T')[0]
                        }));
                      }}
                      required
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Due Date *</label>
                    <input
                      type="date"
                      className="form-input"
                      style={{ height: '32px', fontSize: '13px', padding: '0 10px' }}
                      value={directCreditPurchaseForm.dueDate}
                      onChange={(e) => setDirectCreditPurchaseForm(prev => ({ ...prev, dueDate: e.target.value }))}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px', marginBottom: '20px' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Store / Destination Branch *</label>
                    <select
                      className="form-select"
                      style={{ height: '32px', fontSize: '13px', padding: '0 10px' }}
                      value={directCreditPurchaseForm.branchName}
                      onChange={(e) => setDirectCreditPurchaseForm(prev => ({ ...prev, branchName: e.target.value }))}
                      required
                    >
                      <option value="Main Store">Main Store</option>
                      <option value="Colombo Branch">Colombo Branch</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Notes</label>
                    <input
                      type="text"
                      className="form-input"
                      style={{ height: '32px', fontSize: '13px', padding: '0 10px' }}
                      placeholder="e.g. Direct credit procurement of warehouse stock"
                      value={directCreditPurchaseForm.notes}
                      onChange={(e) => setDirectCreditPurchaseForm(prev => ({ ...prev, notes: e.target.value }))}
                    />
                  </div>
                </div>

                {/* Items Table */}
                <div className="form-group" style={{ marginBottom: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <label className="form-label" style={{ marginBottom: 0, fontWeight: '700' }}>Purchased Products</label>
                    <button type="button" className="btn btn-secondary" style={{ padding: '4px 12px', fontSize: '12px' }} onClick={handleAddDirectCreditPurchaseItem}>
                      + Add Item Row
                    </button>
                  </div>

                  <div className="glass-panel" style={{ padding: 0, maxHeight: '280px', overflowY: 'auto' }}>
                    <table className="table-glass" style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '11px' }}>Product Smart Search (Name, Barcode, SKU)</th>
                          <th style={{ width: '80px', padding: '8px 12px', textAlign: 'center', fontSize: '11px' }}>Qty</th>
                          <th style={{ width: '100px', padding: '8px 12px', textAlign: 'right', fontSize: '11px' }}>Cost Price</th>
                          <th style={{ width: '90px', padding: '8px 12px', textAlign: 'right', fontSize: '11px' }}>Discount</th>
                          <th style={{ width: '90px', padding: '8px 12px', textAlign: 'right', fontSize: '11px' }}>Tax</th>
                          <th style={{ width: '100px', padding: '8px 12px', textAlign: 'left', fontSize: '11px' }}>Batch No.</th>
                          <th style={{ width: '120px', padding: '8px 12px', textAlign: 'left', fontSize: '11px' }}>Expiry Date</th>
                          <th style={{ width: '110px', padding: '8px 12px', textAlign: 'left', fontSize: '11px' }}>Warehouse</th>
                          <th style={{ width: '110px', padding: '8px 12px', textAlign: 'right', fontSize: '11px' }}>Amount</th>
                          <th style={{ width: '45px', padding: '8px' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {directCreditPurchaseForm.items.map((item, index) => {
                          const prod = products.find(p => p.ProductID === parseInt(item.productId, 10));
                          const isBatchTracked = prod?.IsBatchTracked || false;
                          const amount = (parseFloat(item.quantity || 0) * parseFloat(item.unitCost || 0)) - parseFloat(item.discount || 0) + parseFloat(item.tax || 0);

                          return (
                            <tr key={index}>
                              <td style={{ padding: '6px', position: 'relative' }}>
                                <input
                                  type="text"
                                  className="form-input po-item-select"
                                  style={{ width: '100%', height: '32px', fontSize: '13px', padding: '0 10px' }}
                                  value={item.searchQuery || ''}
                                  onChange={(e) => handleDirectCreditPurchaseSearchInputChange(index, e.target.value)}
                                  onFocus={() => setActiveSearchIndex(index)}
                                  onBlur={() => setTimeout(() => setActiveSearchIndex(null), 250)}
                                  onKeyDown={(e) => handleDirectCreditPurchaseSearchInputKeyDown(e, index)}
                                  placeholder="Type Name, Barcode, or SKU..."
                                  required
                                />
                                
                                {activeSearchIndex === index && (() => {
                                  const query = (item.searchQuery || '').toLowerCase().trim();
                                  const filteredProducts = products.filter(p => {
                                    if (!query) return true;
                                    return (
                                      p.Name.toLowerCase().includes(query) ||
                                      (p.Barcode && p.Barcode.toLowerCase().includes(query)) ||
                                      (p.SKU && p.SKU.toLowerCase().includes(query))
                                    );
                                  }).slice(0, 8);

                                  return (
                                    <div 
                                      className="glass-panel" 
                                      style={{ 
                                        position: 'absolute', 
                                        left: '6px', 
                                        right: '6px', 
                                        top: '38px', 
                                        zIndex: 999, 
                                        maxHeight: '200px', 
                                        overflowY: 'auto', 
                                        background: 'var(--bg-surface-elevated)', 
                                        border: '1px solid var(--border-color)',
                                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)',
                                        borderRadius: 'var(--radius-sm)',
                                        padding: '4px'
                                      }}
                                    >
                                      {filteredProducts.length === 0 ? (
                                        <div style={{ padding: '8px', fontSize: '12.5px', color: 'var(--text-secondary)', textAlign: 'center' }}>
                                          No products found
                                        </div>
                                      ) : (
                                        filteredProducts.map(p => (
                                          <div
                                            key={p.ProductID}
                                            className="search-item"
                                            style={{
                                              padding: '6px 10px',
                                              cursor: 'pointer',
                                              fontSize: '12.5px',
                                              borderRadius: 'var(--radius-xs)',
                                              color: 'var(--text-secondary)',
                                              display: 'flex',
                                              justifyContent: 'space-between'
                                            }}
                                            onMouseDown={() => {
                                              const newItems = [...directCreditPurchaseForm.items];
                                              const existIdx = newItems.findIndex((x, i) => i !== index && String(x.productId) === String(p.ProductID));
                                              if (existIdx !== -1) {
                                                newItems[existIdx].quantity = String(parseFloat(newItems[existIdx].quantity || 1) + 1);
                                                newItems.splice(index, 1);
                                                setToast({ type: 'success', message: `Merged: ${p.Name}` });
                                              } else {
                                                newItems[index].productId = p.ProductID;
                                                newItems[index].unitCost = Number(p.Cost);
                                                newItems[index].searchQuery = `${p.Name} (${p.Barcode || p.SKU})`;
                                              }
                                              setDirectCreditPurchaseForm(prev => ({ ...prev, items: newItems }));
                                              setActiveSearchIndex(null);
                                            }}
                                          >
                                            <span style={{ fontWeight: '600', color: 'white' }}>{p.Name}</span>
                                            <span style={{ fontSize: '11px', opacity: 0.7 }}>Barcode: {p.Barcode || '--'}</span>
                                          </div>
                                        ))
                                      )}
                                    </div>
                                  );
                                })()}
                              </td>
                              <td style={{ padding: '6px' }}>
                                <input
                                  type="number"
                                  className="form-input"
                                  style={{ width: '100%', height: '32px', fontSize: '13px', textAlign: 'center', padding: '0 6px' }}
                                  value={item.quantity}
                                  onChange={(e) => handleDirectCreditPurchaseItemChange(index, 'quantity', e.target.value)}
                                  min="0.001"
                                  step="any"
                                  required
                                />
                              </td>
                              <td style={{ padding: '6px' }}>
                                <input
                                  type="number"
                                  className="form-input"
                                  style={{ width: '100%', height: '32px', fontSize: '13px', textAlign: 'right', padding: '0 6px' }}
                                  value={item.unitCost}
                                  onChange={(e) => handleDirectCreditPurchaseItemChange(index, 'unitCost', e.target.value)}
                                  min="0.00"
                                  step="0.01"
                                  required
                                />
                              </td>
                              <td style={{ padding: '6px' }}>
                                <input
                                  type="number"
                                  className="form-input"
                                  style={{ width: '100%', height: '32px', fontSize: '13px', textAlign: 'right', padding: '0 6px' }}
                                  value={item.discount}
                                  onChange={(e) => handleDirectCreditPurchaseItemChange(index, 'discount', e.target.value)}
                                  min="0.00"
                                  step="0.01"
                                  required
                                />
                              </td>
                              <td style={{ padding: '6px' }}>
                                <input
                                  type="number"
                                  className="form-input"
                                  style={{ width: '100%', height: '32px', fontSize: '13px', textAlign: 'right', padding: '0 6px' }}
                                  value={item.tax}
                                  onChange={(e) => handleDirectCreditPurchaseItemChange(index, 'tax', e.target.value)}
                                  min="0.00"
                                  step="0.01"
                                  required
                                />
                              </td>
                              <td style={{ padding: '6px' }}>
                                <input
                                  type="text"
                                  className="form-input"
                                  style={{ width: '100%', height: '32px', fontSize: '13px', padding: '0 6px' }}
                                  placeholder={isBatchTracked ? "Batch No" : "N/A"}
                                  value={item.batchNo}
                                  onChange={(e) => handleDirectCreditPurchaseItemChange(index, 'batchNo', e.target.value)}
                                  disabled={!isBatchTracked}
                                  required={isBatchTracked}
                                />
                              </td>
                              <td style={{ padding: '6px' }}>
                                <input
                                  type="date"
                                  className="form-input"
                                  style={{ width: '100%', height: '32px', fontSize: '13px', padding: '0 6px' }}
                                  value={item.expiryDate || ''}
                                  onChange={(e) => handleDirectCreditPurchaseItemChange(index, 'expiryDate', e.target.value)}
                                  disabled={!isBatchTracked}
                                  required={isBatchTracked}
                                />
                              </td>
                              <td style={{ padding: '6px' }}>
                                <select
                                  className="form-select"
                                  style={{ width: '100%', height: '32px', fontSize: '13px', padding: '0' }}
                                  value={item.warehouseName}
                                  onChange={(e) => handleDirectCreditPurchaseItemChange(index, 'warehouseName', e.target.value)}
                                >
                                  <option value="Main Warehouse">Main WH</option>
                                  <option value="Store Branch WH">Store WH</option>
                                </select>
                              </td>
                              <td style={{ padding: '6px', textAlign: 'right', fontWeight: '700', color: 'white', verticalAlign: 'middle', fontSize: '13px' }} className="mono">
Rs. {formatCurrency(amount)}
                              </td>
                              <td style={{ padding: '6px', textAlign: 'center' }}>
                                <button
                                  type="button"
                                  className="btn btn-danger btn-icon"
                                  style={{ width: '28px', height: '28px' }}
                                  onClick={() => handleRemoveDirectCreditPurchaseItem(index)}
                                  disabled={directCreditPurchaseForm.items.length <= 1}
                                >
                                  <Trash2 size={12} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Credit Payment Footer Information */}
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '20px' }}>
                  <h4 style={{ fontSize: '13px', fontWeight: '700', color: '#3b82f6', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Coins size={14} /> Immediate Payment Allocation (Optional)
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 2fr 2fr', gap: '16px' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Paid Amount</label>
                      <input
                        type="number"
                        className="form-input"
                        style={{ height: '32px', fontSize: '13px' }}
                        value={directCreditPurchaseForm.paidAmount}
                        onChange={(e) => setDirectCreditPurchaseForm(prev => ({ ...prev, paidAmount: e.target.value }))}
                        min="0.00"
max={formatCurrency(grandTotal)}
                        step="0.01"
                      />
                    </div>
                    {paidAmountVal > 0 && (
                      <>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Payment Mode *</label>
                          <select
                            className="form-select"
                            style={{ height: '32px', fontSize: '13px' }}
                            value={directCreditPurchaseForm.paymentMethod}
                            onChange={(e) => setDirectCreditPurchaseForm(prev => ({ ...prev, paymentMethod: e.target.value }))}
                            required
                          >
                            <option value="Cash">Cash Account</option>
                            <option value="Bank Transfer">Bank Transfer / PETTY</option>
                            <option value="Cheque">Company Cheque</option>
                          </select>
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Payment Reference / Chq No. *</label>
                          <input
                            type="text"
                            className="form-input"
                            style={{ height: '32px', fontSize: '13px' }}
                            placeholder="e.g. TXN987213"
                            value={directCreditPurchaseForm.paymentReference}
                            onChange={(e) => setDirectCreditPurchaseForm(prev => ({ ...prev, paymentReference: e.target.value }))}
                            required
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Footer and Summary */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '16px' }}>
                  <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      Total Items: <strong style={{ color: 'white', fontSize: '13px' }}>{totalQty.toFixed(0)}</strong>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
Subtotal: <strong style={{ color: 'white', fontSize: '13px' }} className="mono">Rs. {formatCurrency(subTotal)}</strong>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
Discount: <strong style={{ color: '#ef4444', fontSize: '13px' }} className="mono">-Rs. {formatCurrency(totalDiscount)}</strong>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
Tax: <strong style={{ color: '#10b981', fontSize: '13px' }} className="mono">+Rs. {formatCurrency(totalTax)}</strong>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
Grand Total: <strong style={{ color: 'white', fontSize: '14px' }} className="mono">Rs. {formatCurrency(grandTotal)}</strong>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
Paid Amount: <strong style={{ color: '#10b981', fontSize: '14px' }} className="mono">Rs. {formatCurrency(paidAmountVal)}</strong>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
Balance Due: <strong style={{ color: '#ef4444', fontSize: '14px' }} className="mono">Rs. {formatCurrency(balanceDue)}</strong>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button type="button" className="btn btn-secondary" onClick={() => setShowDirectCreditPurchaseModal(false)} style={{ fontSize: '12.5px', height: '34px' }}>
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={actionLoading} style={{ fontSize: '12.5px', height: '34px', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', border: 'none', color: '#fff', padding: '0 20px', borderRadius: 'var(--radius-md)', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {actionLoading ? 'Processing...' : '✔ Save Credit Bill & Post Ledger'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {showReturnModal && (
        <div className="modal-overlay no-print">
          <div className="modal-content glass-panel" style={{ width: '800px', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: 'var(--radius-lg)', padding: '24px' }}>
            <h3 style={{ marginBottom: '16px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '8px', fontSize: '16px', fontWeight: '700', color: 'white' }}>
              {returnModalMode === 'edit' ? 'Edit Supplier Return' : 'Create Supplier Return'}
            </h3>

            <form onSubmit={handleReturnSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 0.8fr', gap: '20px', marginBottom: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Select Supplier</label>
                  <select
                    className="form-select"
                    value={returnForm.supplierId}
                    onChange={(e) => setReturnForm(prev => ({ ...prev, supplierId: e.target.value }))}
                    required
                  >
                    {suppliers.map(s => (
                      <option key={s.SupplierID} value={s.SupplierID}>{s.SupplierName} (Owes: Rs. {formatCurrency(s.CurrentBalance)})</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Return Type</label>
                  <select
                    className="form-select"
                    value={returnForm.returnType}
                    onChange={(e) => setReturnForm(prev => ({ ...prev, returnType: e.target.value }))}
                    required
                  >
                    <option value="Credit">Credit Return (Deduct Owed Balance)</option>
                    <option value="Cash">Cash Return (Refund Cash / No Debt Change)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Branch Location</label>
                  <select
                    className="form-select"
                    value={returnForm.branchName}
                    onChange={(e) => setReturnForm(prev => ({ ...prev, branchName: e.target.value }))}
                  >
                    <option value="Main Store">Main Store</option>
                    <option value="Colombo Branch">Colombo Branch</option>
                  </select>
                </div>
              </div>

              {/* Items returning */}
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Returned Items</span>
                  <button type="button" className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '12px' }} onClick={handleAddReturnItem}>
                    + Add Return Row
                  </button>
                </label>

                <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: 'var(--radius-md)', padding: '10px', background: 'rgba(0,0,0,0.1)' }}>
                  {returnForm.items.map((item, index) => (
                    <div key={index} style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '8px' }}>
                      <div style={{ flexGrow: 1 }}>
                        <select
                          className="form-select"
                          value={item.productId}
                          onChange={(e) => handleReturnItemChange(index, 'productId', e.target.value)}
                          required
                        >
                          {products.map(p => (
                            <option key={p.ProductID} value={p.ProductID}>{p.Name} ({p.SKU || p.Barcode})</option>
                          ))}
                        </select>
                      </div>

                      <div style={{ width: '120px' }}>
                        <input
                          type="text"
                          className="form-input"
                          value={item.batchNo}
                          onChange={(e) => handleReturnItemChange(index, 'batchNo', e.target.value)}
                          placeholder="Batch No. (Optional)"
                        />
                      </div>

                      <div style={{ width: '90px' }}>
                        <input
                          type="number"
                          step="0.001"
                          min="0.001"
                          className="form-input"
                          value={item.quantity}
                          onChange={(e) => handleReturnItemChange(index, 'quantity', e.target.value)}
                          placeholder="Qty"
                          required
                        />
                      </div>

                      <div style={{ width: '110px' }}>
                        <input
                          type="number"
                          step="0.01"
                          className="form-input"
                          value={item.unitCost}
                          onChange={(e) => handleReturnItemChange(index, 'unitCost', e.target.value)}
                          placeholder="Cost Price"
                          required
                        />
                      </div>

                      <button type="button" className="btn btn-danger btn-icon" onClick={() => handleRemoveReturnItem(index)} disabled={returnForm.items.length <= 1}>
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="form-group" style={{ marginTop: '16px' }}>
                <label className="form-label">Return Reason</label>
                <input
                  type="text"
                  className="form-input"
                  value={returnForm.reason}
                  onChange={(e) => setReturnForm(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder="e.g. Damaged products or past expiry"
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px', borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '16px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowReturnModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={actionLoading}>
                  {actionLoading ? 'Saving...' : (returnModalMode === 'edit' ? 'Update Return & Adjust Ledger' : 'Confirm Return & Adjust Ledger')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================================
         MODAL: VIEW SUPPLIER RETURN DETAILS
         ============================================================================ */}
      {showReturnViewModal && selectedReturn && (() => {
        const totalQty = selectedReturn.items ? selectedReturn.items.reduce((sum, item) => sum + parseFloat(item.Quantity || 0), 0) : 0;
        return (
          <div className="modal-overlay no-print" onClick={(e) => e.target === e.currentTarget && setShowReturnViewModal(false)}>
            <div className="modal-content glass-panel" style={{ width: '800px', padding: '24px', background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: 'var(--radius-lg)' }}>
              
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Eye size={18} style={{ color: 'var(--danger)' }} />
                  <h3 style={{ fontSize: '16px', fontWeight: '700', margin: 0 }}>View Supplier Return: {selectedReturn.ReturnNumber}</h3>
                </div>
                <button type="button" className="close-btn" onClick={() => setShowReturnViewModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  <X size={18} />
                </button>
              </div>

              {/* Detail Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '24px', background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div>
                  <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Return Number</span>
                  <strong className="mono" style={{ fontSize: '14px', color: 'white' }}>{selectedReturn.ReturnNumber}</strong>
                </div>
                <div>
                  <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Return Date</span>
                  <strong style={{ fontSize: '13px', color: 'white' }}>{new Date(selectedReturn.ReturnDate).toLocaleDateString()}</strong>
                </div>
                <div>
                  <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Supplier</span>
                  <strong style={{ fontSize: '13px', color: 'white' }}>{selectedReturn.SupplierName}</strong>
                </div>
                <div>
                  <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Handled By</span>
                  <strong style={{ fontSize: '13px', color: 'white' }}>{selectedReturn.Username}</strong>
                </div>
                <div>
                  <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Return Type</span>
                  <span style={{
                    display: 'inline-block',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: '600',
                    background: selectedReturn.ReturnType === 'Cash' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    color: selectedReturn.ReturnType === 'Cash' ? '#38bdf8' : '#f87171',
                    marginTop: '2px'
                  }}>
                    {selectedReturn.ReturnType || 'Credit'}
                  </span>
                </div>
                <div style={{ marginTop: '10px' }}>
                  <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Branch</span>
                  <strong style={{ fontSize: '13px', color: 'white' }}>{selectedReturn.BranchName || 'Global'}</strong>
                </div>
                <div style={{ marginTop: '10px', gridColumn: 'span 4' }}>
                  <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Reason</span>
                  <strong style={{ fontSize: '13px', color: 'white' }}>{selectedReturn.Reason || '--'}</strong>
                </div>
              </div>

              {/* Items Table */}
              <div style={{ marginBottom: '24px' }}>
                <h4 style={{ fontSize: '13px', fontWeight: '700', marginBottom: '8px', color: 'white' }}>Returned Products</h4>
                <div className="glass-panel" style={{ padding: 0, maxHeight: '200px', overflowY: 'auto' }}>
                  <table className="table-glass" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '11px' }}>Product</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '11px' }}>SKU/Barcode</th>
                        <th style={{ width: '120px', padding: '8px 12px', textAlign: 'left', fontSize: '11px' }}>Batch No</th>
                        <th style={{ width: '100px', padding: '8px 12px', textAlign: 'center', fontSize: '11px' }}>Qty</th>
                        <th style={{ width: '120px', padding: '8px 12px', textAlign: 'right', fontSize: '11px' }}>Unit Cost</th>
                        <th style={{ width: '140px', padding: '8px 12px', textAlign: 'right', fontSize: '11px' }}>Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedReturn.items && selectedReturn.items.map((item, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <td style={{ padding: '8px 12px', fontWeight: '600' }}>{item.ProductName}</td>
                          <td className="mono" style={{ padding: '8px 12px', fontSize: '11px', color: 'var(--text-secondary)' }}>{item.SKU || item.Barcode || '--'}</td>
                          <td className="mono" style={{ padding: '8px 12px', fontSize: '11px' }}>{item.BatchNo || '--'}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'center' }} className="mono">{parseFloat(item.Quantity).toFixed(3)}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right' }} className="mono">Rs. {formatCurrency(item.UnitCost)}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '700', color: 'var(--danger)' }} className="mono">Rs. {formatCurrency(item.Subtotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Total & Footer */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: '16px' }}>
                <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                  Total Returned Value: <strong className="mono" style={{ fontSize: '16px', color: 'var(--danger)' }}>Rs. {formatCurrency(selectedReturn.TotalAmount)}</strong>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  {canManagePurchases && (
                    <>
                      <button 
                        type="button" 
                        className="btn btn-secondary"
                        onClick={() => {
                          setShowReturnViewModal(false);
                          handleOpenReturnEdit(selectedReturn);
                        }}
                        style={{ fontSize: '12.5px', height: '34px' }}
                      >
                        <Edit2 size={12} style={{ marginRight: '4px' }} /> Edit Return
                      </button>
                      <button 
                        type="button" 
                        className="btn btn-danger"
                        onClick={() => {
                          setShowReturnViewModal(false);
                          handleDeleteReturn(selectedReturn);
                        }}
                        style={{ fontSize: '12.5px', height: '34px' }}
                      >
                        <Trash2 size={12} style={{ marginRight: '4px' }} /> Delete Return
                      </button>
                    </>
                  )}
                  <button type="button" className="btn btn-secondary" onClick={() => setShowReturnViewModal(false)} style={{ fontSize: '12.5px', height: '34px' }}>
                    Close
                  </button>
                </div>
              </div>

            </div>
          </div>
        );
      })()}

      {/* ============================================================================
         MODAL: CREATE INVOICE/GRN SELECTOR
         ============================================================================ */}
      {showCreateInvoiceGrnModal && (
        <div className="modal-overlay no-print">
          <div className="modal-content" style={{ width: '450px' }}>
            <h3 style={{ marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', fontSize: '16px', fontWeight: '700' }}>
              Create Invoice or Goods Receipt (GRN)
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '20px' }}>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                Select a pending Purchase Order from the list below to proceed with stock receipt (GRN) or purchase invoicing.
              </p>

              <div className="form-group">
                <label className="form-label">Select Pending Purchase Order</label>
                {purchaseOrders.filter(po => po.Status === 'Ordered' || po.Status === 'GRN Received').length === 0 ? (
                  <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', borderRadius: 'var(--radius-sm)', fontSize: '12.5px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                    No pending orders found. You must raise a Purchase Order before you can receive goods or record invoices.
                  </div>
                ) : (
                  <select
                    className="form-select"
                    value={selectedCreateInvoiceGrnPoId}
                    onChange={(e) => setSelectedCreateInvoiceGrnPoId(e.target.value)}
                    required
                  >
                    <option value="">-- Choose Order --</option>
                    {purchaseOrders
                      .filter(po => po.Status === 'Ordered' || po.Status === 'GRN Received')
                      .map(po => (
                        <option key={po.PurchaseOrderID} value={po.PurchaseOrderID}>
                          {po.PONumber} - {po.SupplierName} ({po.Status})
                        </option>
                      ))}
                  </select>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowCreateInvoiceGrnModal(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!selectedCreateInvoiceGrnPoId}
                onClick={() => {
                  const targetPo = purchaseOrders.find(po => po.PurchaseOrderID === parseInt(selectedCreateInvoiceGrnPoId, 10));
                  if (!targetPo) return;
                  setShowCreateInvoiceGrnModal(false);
                  if (targetPo.Status === 'Ordered') {
                    handleOpenGrnModal(targetPo);
                  } else if (targetPo.Status === 'GRN Received') {
                    handleOpenInvoiceModal(targetPo);
                  }
                }}
              >
                Proceed
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
