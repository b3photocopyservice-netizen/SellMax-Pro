import React, { useState, useEffect } from 'react';
import { useAuth } from './contexts/AuthContext';
import { Search, Plus, Edit2, Trash2, Tag, RefreshCw, AlertTriangle, Ruler, Award, Calendar, Boxes, Clock } from 'lucide-react';

export default function Inventory({ setToast }) {
  const { token, API_URL, hasPermission } = useAuth();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Modals
  const [showProductModal, setShowProductModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showUomModal, setShowUomModal] = useState(false);
  const [showBrandModal, setShowBrandModal] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // 'add' or 'edit'

  const [uoms, setUoms] = useState([]);
  const [uomName, setUomName] = useState('');

  const [brands, setBrands] = useState([]);
  const [brandName, setBrandName] = useState('');

  // Expiry / Batch state
  const [activeTab, setActiveTab] = useState('products'); // 'products' | 'expiry'
  const [expiryReport, setExpiryReport] = useState([]);
  const [expiryLoading, setExpiryLoading] = useState(false);
  const [showBatchPanel, setShowBatchPanel] = useState(false);
  const [batchPanelProductId, setBatchPanelProductId] = useState(null);
  const [batchPanelProductName, setBatchPanelProductName] = useState('');
  const [batches, setBatches] = useState([]);
  const [batchForm, setBatchForm] = useState({ batchNo: '', mfgDate: '', expiryDate: '', quantity: '', warehouseName: '' });

  // Form states
  const [activeProductId, setActiveProductId] = useState(null);
  const [productForm, setProductForm] = useState({
    name: '', sku: '', barcode: '', price: '', cost: '', stock: '', lowStockThreshold: '', categoryId: '', imageUrl: '', uom: 'pcs', allowFraction: false, brand: '',
    minDiscountAmt: '0', minDiscountPct: '0', maxDiscountAmt: '0', maxDiscountPct: '0', minProfitMargin: '0', isActive: true,
    isBatchTracked: false, blockExpiredSales: true, stockIssuingMethod: 'FEFO'
  });
  const [categoryName, setCategoryName] = useState('');

  const canManage = hasPermission('MANAGE_INVENTORY');

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    try {
      setLoading(true);
      const prodRes = await fetch(`${API_URL}/api/inventory/products`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const catRes = await fetch(`${API_URL}/api/inventory/categories`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const uomRes = await fetch(`${API_URL}/api/inventory/uoms`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const brandRes = await fetch(`${API_URL}/api/inventory/brands`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (prodRes.ok && catRes.ok && uomRes.ok && brandRes.ok) {
        setProducts(await prodRes.json());
        setCategories(await catRes.json());
        setUoms(await uomRes.json());
        setBrands(await brandRes.json());
      }
    } catch (err) {
      console.error('Failed to load inventory:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchExpiryReport = async () => {
    try {
      setExpiryLoading(true);
      const res = await fetch(`${API_URL}/api/reports/expiry`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setExpiryReport(await res.json());
    } catch (err) {
      console.error('Failed to load expiry report:', err);
    } finally {
      setExpiryLoading(false);
    }
  };

  const fetchBatches = async (productId) => {
    try {
      const res = await fetch(`${API_URL}/api/inventory/batches/${productId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setBatches(await res.json());
    } catch (err) { console.error('Failed to fetch batches:', err); }
  };

  const handleOpenBatchPanel = (product) => {
    setBatchPanelProductId(product.ProductID);
    setBatchPanelProductName(product.Name);
    setBatchForm({ batchNo: '', mfgDate: '', expiryDate: '', quantity: '', warehouseName: '' });
    fetchBatches(product.ProductID);
    setShowBatchPanel(true);
  };

  const handleAddBatch = async (e) => {
    e.preventDefault();
    if (!canManage) return;
    try {
      const res = await fetch(`${API_URL}/api/inventory/batches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ ...batchForm, productId: batchPanelProductId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add batch.');
      setToast({ type: 'success', message: `Batch '${batchForm.batchNo}' added successfully.` });
      setBatchForm({ batchNo: '', mfgDate: '', expiryDate: '', quantity: '', warehouseName: '' });
      fetchBatches(batchPanelProductId);
      fetchInventory();
    } catch (err) {
      setToast({ type: 'error', message: err.message });
    }
  };

  const handleDeleteBatch = async (batchId) => {
    if (!canManage) return;
    if (!window.confirm('Delete this batch record? This cannot be undone.')) return;
    try {
      const res = await fetch(`${API_URL}/api/inventory/batches/${batchId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to delete batch.');
      setToast({ type: 'success', message: 'Batch deleted.' });
      fetchBatches(batchPanelProductId);
      fetchInventory();
    } catch (err) {
      setToast({ type: 'error', message: err.message });
    }
  };

  const getExpiryColor = (days) => {
    if (days === null || days === undefined) return 'var(--text-secondary)';
    if (days <= 0) return '#ef4444';   // red - expired
    if (days <= 15) return '#f97316'; // orange
    if (days <= 30) return '#eab308'; // yellow
    if (days <= 90) return '#84cc16'; // lime
    return '#10b981'; // green - safe
  };

  const handleProductSubmit = async (e) => {
    e.preventDefault();
    if (!canManage) return;

    const payload = {
      name: productForm.name,
      sku: productForm.sku,
      barcode: productForm.sku || null,
      price: parseFloat(productForm.price),
      cost: parseFloat(productForm.cost),
      stock: parseFloat(productForm.stock) || 0,
      lowStockThreshold: parseFloat(productForm.lowStockThreshold) || 0,
      categoryId: parseInt(productForm.categoryId, 10),
      imageUrl: productForm.imageUrl || null,
      uom: productForm.uom || 'pcs',
      allowFraction: productForm.allowFraction || false,
      brand: productForm.brand || '',
      minDiscountAmt: parseFloat(productForm.minDiscountAmt) || 0.00,
      minDiscountPct: parseFloat(productForm.minDiscountPct) || 0.00,
      maxDiscountAmt: parseFloat(productForm.maxDiscountAmt) || 0.00,
      maxDiscountPct: parseFloat(productForm.maxDiscountPct) || 0.00,
      minProfitMargin: parseFloat(productForm.minProfitMargin) || 0.00,
      isActive: productForm.isActive !== undefined ? productForm.isActive : true,
      isBatchTracked: productForm.isBatchTracked || false,
      blockExpiredSales: productForm.blockExpiredSales !== undefined ? productForm.blockExpiredSales : true,
      stockIssuingMethod: productForm.stockIssuingMethod || 'FEFO'
    };

    try {
      let url = `${API_URL}/api/inventory/products`;
      let method = 'POST';

      if (modalMode === 'edit') {
        url = `${API_URL}/api/inventory/products/${activeProductId}`;
        method = 'PUT';
      }

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Operation failed.');

      setToast({ type: 'success', message: `Product ${modalMode === 'add' ? 'created' : 'updated'} successfully.` });
      setShowProductModal(false);
      fetchInventory();
    } catch (err) {
      setToast({ type: 'error', message: err.message });
    }
  };

  const handleEditProductClick = (product) => {
    setModalMode('edit');
    setActiveProductId(product.ProductID);
    setProductForm({
      name: product.Name,
      sku: product.SKU,
      barcode: product.Barcode || '',
      price: product.Price,
      cost: product.Cost,
      stock: product.Stock,
      lowStockThreshold: product.LowStockThreshold,
      categoryId: product.CategoryID,
      imageUrl: product.ImageURL || '',
      uom: product.UOM || 'pcs',
      allowFraction: product.AllowFraction || false,
      brand: product.Brand || '',
      minDiscountAmt: product.MinDiscountAmt || '0',
      minDiscountPct: product.MinDiscountPct || '0',
      maxDiscountAmt: product.MaxDiscountAmt || '0',
      maxDiscountPct: product.MaxDiscountPct || '0',
      minProfitMargin: product.MinProfitMargin || '0',
      isActive: product.IsActive !== undefined ? !!product.IsActive : true,
      isBatchTracked: !!product.IsBatchTracked,
      blockExpiredSales: product.BlockExpiredSales !== undefined ? !!product.BlockExpiredSales : true,
      stockIssuingMethod: product.StockIssuingMethod || 'FEFO'
    });
    setShowProductModal(true);
  };

  const handleAddProductClick = () => {
    setModalMode('add');
    setProductForm({
      name: '', sku: '', barcode: '', price: '', cost: '', stock: '0', lowStockThreshold: '5', categoryId: categories[0]?.CategoryID || '', imageUrl: '', uom: uoms[0]?.Name || 'pcs', allowFraction: false, brand: '',
      minDiscountAmt: '0', minDiscountPct: '0', maxDiscountAmt: '0', maxDiscountPct: '0', minProfitMargin: '0',
      isActive: true, isBatchTracked: false, blockExpiredSales: true, stockIssuingMethod: 'FEFO'
    });
    setShowProductModal(true);
  };

  const handleDeleteProduct = async (id, name) => {
    if (!canManage) return;
    if (!window.confirm(`Are you sure you want to delete product '${name}'?`)) return;

    try {
      const res = await fetch(`${API_URL}/api/inventory/products/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete product.');

      setToast({ type: 'success', message: 'Product deleted.' });
      fetchInventory();
    } catch (err) {
      setToast({ type: 'error', message: err.message });
    }
  };

  const handleToggleActive = async (product) => {
    if (!canManage) return;
    try {
      const payload = {
        categoryId: product.CategoryID,
        name: product.Name,
        sku: product.SKU,
        barcode: product.Barcode,
        price: product.Price,
        cost: product.Cost,
        stock: product.Stock,
        lowStockThreshold: product.LowStockThreshold,
        imageUrl: product.ImageURL,
        uom: product.UOM,
        allowFraction: product.AllowFraction,
        minDiscountAmt: product.MinDiscountAmt,
        minDiscountPct: product.MinDiscountPct,
        maxDiscountAmt: product.MaxDiscountAmt,
        maxDiscountPct: product.MaxDiscountPct,
        minProfitMargin: product.MinProfitMargin,
        isActive: !product.IsActive
      };

      const res = await fetch(`${API_URL}/api/inventory/products/${product.ProductID}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to toggle status.');

      setToast({ type: 'success', message: `Product '${product.Name}' status updated to ${!product.IsActive ? 'Active' : 'Inactive'}.` });
      fetchInventory();
    } catch (err) {
      setToast({ type: 'error', message: err.message });
    }
  };

  const handleCategorySubmit = async (e) => {
    e.preventDefault();
    if (!canManage) return;

    try {
      const res = await fetch(`${API_URL}/api/inventory/categories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: categoryName })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create category.');

      setToast({ type: 'success', message: `Category '${categoryName}' created.` });
      setCategoryName('');
      setShowCategoryModal(false);
      fetchInventory();
    } catch (err) {
      setToast({ type: 'error', message: err.message });
    }
  };

  const handleDeleteCategory = async (id, name) => {
    if (!canManage) return;
    if (!window.confirm(`Are you sure you want to delete category '${name}'? All products in this category must be reassigned first.`)) return;

    try {
      const res = await fetch(`${API_URL}/api/inventory/categories/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete category.');

      setToast({ type: 'success', message: 'Category deleted successfully.' });
      fetchInventory();
    } catch (err) {
      setToast({ type: 'error', message: err.message });
    }
  };

  const handleUomSubmit = async (e) => {
    e.preventDefault();
    if (!canManage) return;

    try {
      const res = await fetch(`${API_URL}/api/inventory/uoms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: uomName })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create UOM.');

      setToast({ type: 'success', message: `Unit '${uomName}' created.` });
      setUomName('');
      setShowUomModal(false);
      fetchInventory();
    } catch (err) {
      setToast({ type: 'error', message: err.message });
    }
  };

  const handleDeleteUom = async (id, name) => {
    if (!canManage) return;
    if (!window.confirm(`Are you sure you want to delete unit '${name}'?`)) return;

    try {
      const res = await fetch(`${API_URL}/api/inventory/uoms/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete UOM.');

      setToast({ type: 'success', message: 'UOM deleted successfully.' });
      fetchInventory();
    } catch (err) {
      setToast({ type: 'error', message: err.message });
    }
  };

  const handleBrandSubmit = async (e) => {
    e.preventDefault();
    if (!canManage) return;

    try {
      const res = await fetch(`${API_URL}/api/inventory/brands`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: brandName })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create Brand.');

      setToast({ type: 'success', message: `Brand '${brandName}' created.` });
      setBrandName('');
      setShowBrandModal(false);
      fetchInventory();
    } catch (err) {
      setToast({ type: 'error', message: err.message });
    }
  };

  const handleDeleteBrand = async (id, name) => {
    if (!canManage) return;
    if (!window.confirm(`Are you sure you want to delete brand '${name}'?`)) return;

    try {
      const res = await fetch(`${API_URL}/api/inventory/brands/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete Brand.');

      setToast({ type: 'success', message: 'Brand deleted successfully.' });
      fetchInventory();
    } catch (err) {
      setToast({ type: 'error', message: err.message });
    }
  };

  const filteredProducts = products.filter(p => 
    p.Name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.SKU.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.Barcode && p.Barcode.includes(searchQuery))
  );

  const costVal = parseFloat(productForm.cost);
  const priceVal = parseFloat(productForm.price);
  let profitMargin = 0;
  if (!isNaN(costVal) && !isNaN(priceVal) && costVal > 0) {
    profitMargin = ((priceVal - costVal) / costVal) * 100;
  }
  const isProfitable = profitMargin > 0;
  const profitMarginStr = (!isNaN(costVal) && !isNaN(priceVal) && costVal > 0)
    ? `${profitMargin.toFixed(2)}%`
    : '--';

  return (
    <div>
      {/* ---- Tab Bar ---- */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '0' }}>
        {[{ id: 'products', label: 'Product Inventory', icon: <Boxes size={14} /> }, { id: 'expiry', label: 'Expiry Report', icon: <Clock size={14} /> }].map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); if (tab.id === 'expiry') fetchExpiryReport(); }}
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

      {activeTab === 'expiry' ? (
        // ---- EXPIRY REPORT TAB ----
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: '700' }}>Batch Expiry Report</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>Track all batch expiry dates and remaining stock across the warehouse</p>
            </div>
            <button className="btn btn-secondary" onClick={fetchExpiryReport}>
              <RefreshCw size={14} /> Refresh
            </button>
          </div>

          {/* Color-coded legend */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
            {[
              { color: '#ef4444', label: 'Expired' },
              { color: '#f97316', label: '1–15 days' },
              { color: '#eab308', label: '16–30 days' },
              { color: '#84cc16', label: '31–90 days' },
              { color: '#10b981', label: 'Safe (>90 days)' }
            ].map(l => (
              <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: l.color }} />
                {l.label}
              </div>
            ))}
          </div>

          {expiryLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px' }}>
              <RefreshCw size={24} style={{ color: 'var(--primary)', animation: 'spin 1.5s linear infinite' }} />
            </div>
          ) : (
            <div className="glass-panel" style={{ padding: 0 }}>
              <div className="table-container">
                <table className="table-glass">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Batch No.</th>
                      <th>Mfg Date</th>
                      <th>Expiry Date</th>
                      <th>Days Remaining</th>
                      <th>Current Stock</th>
                      <th>Warehouse</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expiryReport.length === 0 ? (
                      <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>
                        No batch records found. Enable batch tracking on a product and add batches to see expiry data.
                      </td></tr>
                    ) : (
                      expiryReport.map((row, i) => {
                        const days = row.DaysRemaining;
                        const expiryColor = getExpiryColor(days);
                        const isExpired = days !== null && days <= 0;
                        return (
                          <tr key={i} style={{ background: isExpired ? 'rgba(239, 68, 68, 0.05)' : 'transparent' }}>
                            <td style={{ fontWeight: '600' }}>{row.ProductName}</td>
                            <td className="mono">{row.BatchNo}</td>
                            <td>{row.MfgDate ? new Date(row.MfgDate).toLocaleDateString() : '--'}</td>
                            <td className="mono">{new Date(row.ExpiryDate).toLocaleDateString()}</td>
                            <td>
                              <span style={{
                                display: 'inline-block', padding: '3px 10px', borderRadius: '12px',
                                fontSize: '12px', fontWeight: '700', background: expiryColor + '22', color: expiryColor
                              }}>
                                {isExpired ? `EXPIRED (${Math.abs(days)}d ago)` : days === 0 ? 'Today!' : `${days} days`}
                              </span>
                            </td>
                            <td className="mono">{Number(row.CurrentQty)} {row.UOM || 'pcs'}</td>
                            <td>{row.WarehouseName || '--'}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
      // ---- PRODUCTS TAB ----
      <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        {/* Search */}
        <div className="search-box-container" style={{ width: '320px' }}>
          <Search className="search-icon" size={18} />
          <input
            type="text"
            className="form-input pos-search"
            placeholder="Search products by SKU, name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Buttons */}
        {canManage && (
          <div style={{ display: 'flex', gap: '12px' }}>
            <button className="btn btn-secondary" onClick={() => setShowCategoryModal(true)}>
              <Tag size={16} />
              <span>Categories</span>
            </button>
            <button className="btn btn-secondary" onClick={() => setShowUomModal(true)}>
              <Ruler size={16} />
              <span>UOM</span>
            </button>
            <button className="btn btn-secondary" onClick={() => setShowBrandModal(true)}>
              <Award size={16} />
              <span>Brand</span>
            </button>
            <button className="btn btn-primary" onClick={handleAddProductClick}>
              <Plus size={16} />
              <span>New Product</span>
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px' }}>
          <RefreshCw size={24} className="animate-spin" style={{ color: 'var(--primary)', animation: 'spin 1.5s linear infinite' }} />
        </div>
      ) : (
        <div className="glass-panel" style={{ padding: 0 }}>
          <div className="table-container">
            <table className="table-glass">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Barcode</th>
                  <th>Category</th>
                  <th>Cost</th>
                  <th>Retail Price</th>
                  <th>Stock Levels</th>
                  <th>Status</th>
                  {canManage && <th style={{ textAlign: 'right' }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={canManage ? 8 : 7} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                      No inventory records found.
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((p) => (
                    <tr key={p.ProductID}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          {p.ImageURL && (
                            <img src={p.ImageURL} alt={p.Name} style={{ width: '32px', height: '32px', borderRadius: '4px', objectFit: 'cover' }} />
                          )}
                          <div>
                            <span style={{ fontWeight: '600', display: 'block' }}>{p.Name}</span>
                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '2px' }}>
                            {p.Brand && (
                              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: '4px', display: 'inline-block' }}>
                                {p.Brand}
                              </span>
                            )}
                            {p.IsBatchTracked && (
                              <span style={{ fontSize: '10px', color: '#60a5fa', background: 'rgba(96,165,250,0.1)', padding: '2px 6px', borderRadius: '4px', display: 'inline-block', border: '1px solid rgba(96,165,250,0.2)' }}>
                                Batch Tracked
                              </span>
                            )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="mono">{p.Barcode || '--'}</td>
                      <td>{p.CategoryName}</td>
                      <td className="mono">Rs. {Number(p.Cost).toFixed(2)}</td>
                      <td className="mono" style={{ color: 'var(--accent)', fontWeight: '600' }}>Rs. {Number(p.Price).toFixed(2)}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span className="mono" style={{ 
                            fontWeight: '700',
                            color: p.Stock <= 0 ? 'var(--danger)' : p.Stock <= p.LowStockThreshold ? 'var(--warning)' : 'var(--success)'
                          }}>{Number(p.Stock)} {p.UOM || 'pcs'}</span>
                          {p.Stock <= p.LowStockThreshold && (
                            <AlertTriangle size={14} style={{ color: p.Stock <= 0 ? 'var(--danger)' : 'var(--warning)' }} />
                          )}
                        </div>
                      </td>
                      <td>
                        <button
                          type="button"
                          onClick={() => handleToggleActive(p)}
                          style={{
                            background: p.IsActive ? 'var(--success-bg)' : 'var(--danger-bg)',
                            color: p.IsActive ? 'var(--success)' : 'var(--danger)',
                            border: '1px solid ' + (p.IsActive ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'),
                            padding: '4px 8px',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '12px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                        >
                          {p.IsActive ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      {canManage && (
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            {p.IsBatchTracked && (
                              <button className="btn btn-secondary btn-icon" onClick={() => handleOpenBatchPanel(p)} title="Manage Batches" style={{ color: '#60a5fa' }}>
                                <Calendar size={14} />
                              </button>
                            )}
                            <button className="btn btn-secondary btn-icon" onClick={() => handleEditProductClick(p)} title="Edit">
                              <Edit2 size={14} />
                            </button>
                            <button className="btn btn-danger btn-icon" onClick={() => handleDeleteProduct(p.ProductID, p.Name)} title="Delete">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      )}
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
         MODAL: ADD/EDIT PRODUCT
         ============================================================================ */}
      {showProductModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: '850px' }}>
            <h3 style={{ marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', fontSize: '16px', fontWeight: '700' }}>
              {modalMode === 'add' ? 'Add New Product' : 'Edit Product Record'}
            </h3>

            <form onSubmit={handleProductSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                
                {/* Left Column: Product Details */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <h4 style={{ fontSize: '13px', fontWeight: '700', color: 'var(--accent)', marginBottom: '4px', borderBottom: '1px dashed var(--border-color)', paddingBottom: '4px' }}>Product Details</h4>
                  
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Product Name</label>
                    <input
                      type="text"
                      className="form-input"
                      value={productForm.name}
                      onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>SKU / Barcode</label>
                    <input
                      type="text"
                      className="form-input mono"
                      placeholder="Enter SKU or scan barcode..."
                      value={productForm.sku}
                      onChange={(e) => setProductForm({ ...productForm, sku: e.target.value, barcode: e.target.value })}
                      required
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Category</label>
                      <select
                        className="form-select"
                        value={productForm.categoryId}
                        onChange={(e) => setProductForm({ ...productForm, categoryId: e.target.value })}
                        required
                      >
                        <option value="">-- Choose Category --</option>
                        {categories.map(c => (
                          <option key={c.CategoryID} value={c.CategoryID}>{c.Name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Brand</label>
                      <select
                        className="form-select"
                        value={productForm.brand}
                        onChange={(e) => setProductForm({ ...productForm, brand: e.target.value })}
                      >
                        <option value="">-- None / Generic --</option>
                        {brands.map(b => (
                          <option key={b.BrandID} value={b.Name}>{b.Name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Unit (UOM)</label>
                      <select
                        className="form-select"
                        value={productForm.uom}
                        onChange={(e) => setProductForm({ ...productForm, uom: e.target.value })}
                        required
                      >
                        <option value="">-- Choose UOM --</option>
                        {uoms.map(u => (
                          <option key={u.UOMID} value={u.Name}>{u.Name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Low Stock Warning Limit</label>
                      <input
                        type="number"
                        step="any"
                        className="form-input mono"
                        value={productForm.lowStockThreshold}
                        onChange={(e) => setProductForm({ ...productForm, lowStockThreshold: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Starting Stock Qty</label>
                      <input
                        type="number"
                        step="any"
                        className="form-input mono"
                        value={productForm.stock}
                        onChange={(e) => setProductForm({ ...productForm, stock: e.target.value })}
                        required
                      />
                    </div>

                    <div className="form-group" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Allow fraction in Qty</label>
                      <div style={{ marginTop: '2px' }}>
                        <button
                          type="button"
                          onClick={() => setProductForm({ ...productForm, allowFraction: !productForm.allowFraction })}
                          style={{
                            width: '100%',
                            background: productForm.allowFraction ? 'var(--success)' : 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid ' + (productForm.allowFraction ? 'var(--success)' : 'var(--border-color)'),
                            color: productForm.allowFraction ? 'white' : 'var(--text-secondary)',
                            padding: '6px 12px',
                            fontSize: '13px',
                            borderRadius: 'var(--radius-md)',
                            cursor: 'pointer',
                            fontWeight: '600',
                            transition: 'all 0.2s ease',
                            boxShadow: productForm.allowFraction ? '0 0 10px rgba(16, 185, 129, 0.3)' : 'none'
                          }}
                        >
                          {productForm.allowFraction ? 'Active' : 'Inactive'}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div className="form-group" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Product Status</label>
                      <div style={{ marginTop: '2px' }}>
                        <button
                          type="button"
                          onClick={() => setProductForm({ ...productForm, isActive: !productForm.isActive })}
                          style={{
                            width: '100%',
                            background: productForm.isActive ? 'var(--success)' : 'var(--danger)',
                            border: '1px solid ' + (productForm.isActive ? 'var(--success)' : 'var(--danger)'),
                            color: 'white',
                            padding: '6px 12px',
                            fontSize: '13px',
                            borderRadius: 'var(--radius-md)',
                            cursor: 'pointer',
                            fontWeight: '600',
                            transition: 'all 0.2s ease',
                            boxShadow: productForm.isActive ? '0 0 10px rgba(16, 185, 129, 0.3)' : '0 0 10px rgba(239, 68, 68, 0.3)'
                          }}
                        >
                          {productForm.isActive ? 'Active' : 'Inactive'}
                        </button>
                      </div>
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Product Image File</label>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <input
                          type="file"
                          accept="image/*"
                          className="form-input"
                          style={{ padding: '4px 8px', fontSize: '12px', width: '100%' }}
                          onChange={async (e) => {
                            const file = e.target.files[0];
                            if (!file) return;
                            
                            const reader = new FileReader();
                            reader.onloadend = async () => {
                              const base64Data = reader.result;
                              try {
                                const res = await fetch(`${API_URL}/api/inventory/upload-image`, {
                                  method: 'POST',
                                  headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${token}`
                                  },
                                  body: JSON.stringify({ image: base64Data, name: file.name })
                                });
                                const data = await res.json();
                                if (res.ok) {
                                  setProductForm(prev => ({ ...prev, imageUrl: `${API_URL}${data.imageUrl}` }));
                                  setToast({ type: 'success', message: 'Image attached successfully.' });
                                } else {
                                  setToast({ type: 'error', message: data.error || 'Failed to upload image.' });
                                }
                              } catch (err) {
                                setToast({ type: 'error', message: 'Upload error: ' + err.message });
                              }
                            };
                            reader.readAsDataURL(file);
                          }}
                        />
                        {productForm.imageUrl && (
                          <div style={{ position: 'relative', flexShrink: 0 }}>
                            <img 
                              src={productForm.imageUrl} 
                              alt="Preview" 
                              style={{ width: '28px', height: '28px', borderRadius: 'var(--radius-sm)', objectFit: 'cover', border: '1px solid var(--border-color)' }} 
                            />
                            <button
                              type="button"
                              onClick={() => setProductForm(prev => ({ ...prev, imageUrl: '' }))}
                              style={{
                                position: 'absolute',
                                top: '-6px',
                                right: '-6px',
                                width: '14px',
                                height: '14px',
                                borderRadius: '50%',
                                background: 'var(--danger)',
                                color: 'white',
                                border: 'none',
                                fontSize: '8px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              ✕
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column: Pricing & Margin Constraints */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <h4 style={{ fontSize: '13px', fontWeight: '700', color: 'var(--accent)', marginBottom: '4px', borderBottom: '1px dashed var(--border-color)', paddingBottom: '4px' }}>Pricing & Margin Constraints</h4>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Cost Price (Rs.)</label>
                      <input
                        type="number"
                        step="0.01"
                        className="form-input mono"
                        value={productForm.cost}
                        onChange={(e) => setProductForm({ ...productForm, cost: e.target.value })}
                        required
                      />
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Selling Price (Rs.)</label>
                      <input
                        type="number"
                        step="0.01"
                        className="form-input mono"
                        value={productForm.price}
                        onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                        required
                      />
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Profit Margin</label>
                      <input
                        type="text"
                        className="form-input mono"
                        style={{
                          backgroundColor: 'rgba(255, 255, 255, 0.03)',
                          color: isProfitable ? 'var(--success)' : 'var(--text-secondary)',
                          fontWeight: isProfitable ? '700' : 'normal',
                          borderColor: isProfitable ? 'rgba(16, 185, 129, 0.3)' : 'var(--border-color)',
                          cursor: 'not-allowed'
                        }}
                        value={profitMarginStr}
                        readOnly
                      />
                    </div>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Min Profit Margin Protection (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      className="form-input mono"
                      placeholder="e.g. 10.0 for 10% minimum margin"
                      value={productForm.minProfitMargin}
                      onChange={(e) => setProductForm({ ...productForm, minProfitMargin: e.target.value })}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Min Discount Rs:</label>
                      <input
                        type="number"
                        step="0.01"
                        className="form-input mono"
                        value={productForm.minDiscountAmt}
                        onChange={(e) => setProductForm({ ...productForm, minDiscountAmt: e.target.value })}
                      />
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Max Discount Rs:</label>
                      <input
                        type="number"
                        step="0.01"
                        className="form-input mono"
                        value={productForm.maxDiscountAmt}
                        onChange={(e) => setProductForm({ ...productForm, maxDiscountAmt: e.target.value })}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Min Discount %:</label>
                      <input
                        type="number"
                        step="0.1"
                        className="form-input mono"
                        value={productForm.minDiscountPct}
                        onChange={(e) => setProductForm({ ...productForm, minDiscountPct: e.target.value })}
                      />
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Max Discount %:</label>
                      <input
                        type="number"
                        step="0.1"
                        className="form-input mono"
                        value={productForm.maxDiscountPct}
                        onChange={(e) => setProductForm({ ...productForm, maxDiscountPct: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

              </div>

              {/* ---- Expiry & Batch Tracking Section (full-width) ---- */}
              <div style={{ marginTop: '16px', padding: '14px 16px', background: 'rgba(96,165,250,0.05)', border: '1px solid rgba(96,165,250,0.15)', borderRadius: 'var(--radius-md)' }}>
                <h4 style={{ fontSize: '13px', fontWeight: '700', color: '#60a5fa', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Clock size={14} /> Expiry &amp; Batch Tracking
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', alignItems: 'start' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '11px', marginBottom: '6px' }}>Track by Batch &amp; Expiry</label>
                    <button
                      type="button"
                      onClick={() => setProductForm({ ...productForm, isBatchTracked: !productForm.isBatchTracked })}
                      style={{
                        width: '100%', padding: '6px 12px', fontSize: '13px', fontWeight: '600',
                        background: productForm.isBatchTracked ? 'rgba(96,165,250,0.2)' : 'rgba(255,255,255,0.04)',
                        border: '1px solid ' + (productForm.isBatchTracked ? '#60a5fa' : 'var(--border-color)'),
                        color: productForm.isBatchTracked ? '#60a5fa' : 'var(--text-secondary)',
                        borderRadius: 'var(--radius-md)', cursor: 'pointer', transition: 'all 0.2s'
                      }}
                    >
                      {productForm.isBatchTracked ? '✓ Enabled' : 'Disabled'}
                    </button>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0, opacity: productForm.isBatchTracked ? 1 : 0.4, pointerEvents: productForm.isBatchTracked ? 'all' : 'none' }}>
                    <label className="form-label" style={{ fontSize: '11px', marginBottom: '6px' }}>Block Expired Sales</label>
                    <button
                      type="button"
                      onClick={() => setProductForm({ ...productForm, blockExpiredSales: !productForm.blockExpiredSales })}
                      style={{
                        width: '100%', padding: '6px 12px', fontSize: '13px', fontWeight: '600',
                        background: productForm.blockExpiredSales ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.04)',
                        border: '1px solid ' + (productForm.blockExpiredSales ? '#ef4444' : 'var(--border-color)'),
                        color: productForm.blockExpiredSales ? '#ef4444' : 'var(--text-secondary)',
                        borderRadius: 'var(--radius-md)', cursor: 'pointer', transition: 'all 0.2s'
                      }}
                    >
                      {productForm.blockExpiredSales ? '🔒 Block Expired' : '⚠ Allow Expired'}
                    </button>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0, opacity: productForm.isBatchTracked ? 1 : 0.4, pointerEvents: productForm.isBatchTracked ? 'all' : 'none' }}>
                    <label className="form-label" style={{ fontSize: '11px', marginBottom: '6px' }}>Stock Issuing Method</label>
                    <select
                      className="form-select"
                      value={productForm.stockIssuingMethod}
                      onChange={(e) => setProductForm({ ...productForm, stockIssuingMethod: e.target.value })}
                    >
                      <option value="FEFO">FEFO – First Expired, First Out</option>
                      <option value="FIFO">FIFO – First In, First Out</option>
                    </select>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                <button type="button" className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '13px' }} onClick={() => setShowProductModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '13px' }}>{modalMode === 'add' ? 'Save Product' : 'Apply Updates'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================================
         MODAL: CATEGORIES MANAGEMENT
         ============================================================================ */}
      {showCategoryModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: '450px' }}>
            <h3 style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between' }}>
              <span>Categories Directory</span>
              <button style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }} onClick={() => setShowCategoryModal(false)}>✕</button>
            </h3>

            {/* Create Category form */}
            <form onSubmit={handleCategorySubmit} style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
              <input
                type="text"
                className="form-input"
                placeholder="New Category Name..."
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                required
              />
              <button type="submit" className="btn btn-primary">Create</button>
            </form>

            {/* Categories list */}
            <div style={{ maxHeight: '250px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {categories.map((c) => (
                <div key={c.CategoryID} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 14px',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)'
                }}>
                  <span style={{ fontWeight: '500' }}>{c.Name}</span>
                  <button 
                    className="btn btn-danger btn-icon" 
                    style={{ width: '28px', height: '28px' }} 
                    onClick={() => handleDeleteCategory(c.CategoryID, c.Name)}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showUomModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: '450px' }}>
            <h3 style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between' }}>
              <span>Unit Directory</span>
              <button style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }} onClick={() => setShowUomModal(false)}>✕</button>
            </h3>

            {/* Create UOM form */}
            <form onSubmit={handleUomSubmit} style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
              <input
                type="text"
                className="form-input"
                placeholder="New Unit (e.g. box, pack)..."
                value={uomName}
                onChange={(e) => setUomName(e.target.value)}
                required
              />
              <button type="submit" className="btn btn-primary">Create</button>
            </form>

            {/* UOMs list */}
            <div style={{ maxHeight: '250px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {uoms.map((u) => (
                <div key={u.UOMID} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 14px',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)'
                }}>
                  <span style={{ fontWeight: '500' }}>{u.Name}</span>
                  <button 
                    className="btn btn-danger btn-icon" 
                    style={{ width: '28px', height: '28px' }} 
                    onClick={() => handleDeleteUom(u.UOMID, u.Name)}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showBrandModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: '450px' }}>
            <h3 style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between' }}>
              <span>Brand Directory</span>
              <button style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }} onClick={() => setShowBrandModal(false)}>✕</button>
            </h3>

            {/* Create Brand form */}
            <form onSubmit={handleBrandSubmit} style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
              <input
                type="text"
                className="form-input"
                placeholder="New Brand (e.g. Samsung, Nike)..."
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                required
              />
              <button type="submit" className="btn btn-primary">Create</button>
            </form>

            {/* Brands list */}
            <div style={{ maxHeight: '250px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {brands.map((b) => (
                <div key={b.BrandID} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 14px',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)'
                }}>
                  <span style={{ fontWeight: '500' }}>{b.Name}</span>
                  <button 
                    className="btn btn-danger btn-icon" 
                    style={{ width: '28px', height: '28px' }} 
                    onClick={() => handleDeleteBrand(b.BrandID, b.Name)}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================================
         MODAL: BATCH MANAGEMENT PANEL
         ============================================================================ */}
      {showBatchPanel && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: '760px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Calendar size={16} style={{ color: '#60a5fa' }} /> Batch Management
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>{batchPanelProductName}</p>
              </div>
              <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '18px' }} onClick={() => setShowBatchPanel(false)}>✕</button>
            </div>

            {/* Add new batch form */}
            {canManage && (
              <div style={{ background: 'rgba(96,165,250,0.05)', border: '1px solid rgba(96,165,250,0.15)', borderRadius: 'var(--radius-md)', padding: '16px', marginBottom: '20px' }}>
                <h4 style={{ fontSize: '12px', fontWeight: '700', color: '#60a5fa', marginBottom: '12px' }}>Add New Batch</h4>
                <form onSubmit={handleAddBatch}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '11px' }}>Batch No. *</label>
                      <input type="text" className="form-input mono" placeholder="e.g. LOT-2024-001" value={batchForm.batchNo}
                        onChange={e => setBatchForm({ ...batchForm, batchNo: e.target.value })} required />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '11px' }}>Manufacturing Date</label>
                      <input type="date" className="form-input" value={batchForm.mfgDate}
                        onChange={e => setBatchForm({ ...batchForm, mfgDate: e.target.value })} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '11px' }}>Expiry Date *</label>
                      <input type="date" className="form-input" value={batchForm.expiryDate}
                        onChange={e => setBatchForm({ ...batchForm, expiryDate: e.target.value })} required />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '12px', alignItems: 'end' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '11px' }}>Quantity *</label>
                      <input type="number" step="any" className="form-input mono" placeholder="0" value={batchForm.quantity}
                        onChange={e => setBatchForm({ ...batchForm, quantity: e.target.value })} required />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" style={{ fontSize: '11px' }}>Warehouse / Location</label>
                      <input type="text" className="form-input" placeholder="e.g. Main Warehouse" value={batchForm.warehouseName}
                        onChange={e => setBatchForm({ ...batchForm, warehouseName: e.target.value })} />
                    </div>
                    <button type="submit" className="btn btn-primary" style={{ height: '38px', padding: '0 20px' }}>
                      <Plus size={14} /> Add Batch
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Existing batches list */}
            <h4 style={{ fontSize: '13px', fontWeight: '700', marginBottom: '12px', color: 'var(--text-secondary)' }}>Active Batches ({batches.length})</h4>
            {batches.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '30px', fontSize: '13px' }}>No batches found. Add the first batch above.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {batches.map((b) => {
                  const days = b.DaysRemaining !== undefined ? b.DaysRemaining : Math.floor((new Date(b.ExpiryDate) - new Date()) / 86400000);
                  const expiryColor = getExpiryColor(days);
                  return (
                    <div key={b.BatchID} style={{
                      display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr auto',
                      gap: '12px', alignItems: 'center',
                      padding: '12px 16px', background: 'rgba(255,255,255,0.02)',
                      border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)',
                      borderLeft: `3px solid ${expiryColor}`
                    }}>
                      <div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Batch No.</div>
                        <div style={{ fontWeight: '700', fontFamily: 'var(--font-mono)', fontSize: '13px' }}>{b.BatchNo}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Mfg Date</div>
                        <div style={{ fontSize: '13px' }}>{b.MfgDate ? new Date(b.MfgDate).toLocaleDateString() : '--'}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Expiry Date</div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px' }}>{new Date(b.ExpiryDate).toLocaleDateString()}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Current Qty</div>
                        <div style={{ fontWeight: '700', fontSize: '14px', color: Number(b.CurrentQty) <= 0 ? 'var(--danger)' : 'inherit' }}>{Number(b.CurrentQty)}</div>
                      </div>
                      <div>
                        <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '700', background: expiryColor + '22', color: expiryColor }}>
                          {days <= 0 ? `Expired ${Math.abs(days)}d ago` : `${days}d left`}
                        </span>
                        {b.WarehouseName && <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>{b.WarehouseName}</div>}
                      </div>
                      {canManage && (
                        <button className="btn btn-danger btn-icon" style={{ width: '28px', height: '28px' }} onClick={() => handleDeleteBatch(b.BatchID)} title="Delete Batch">
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
