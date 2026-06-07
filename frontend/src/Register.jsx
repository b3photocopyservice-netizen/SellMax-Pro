import React, { useState, useEffect, useRef } from 'react';
import { useCart } from './contexts/CartContext';
import { useAuth } from './contexts/AuthContext';
import { Search, Plus, Minus, Trash2, FolderMinus, UserPlus, CreditCard, RefreshCw, ShoppingCart, Lock, DollarSign, Printer, CheckCircle, AlertTriangle, Clock } from 'lucide-react';

// Helper component for managing text/numeric input for quantity adjustments in cart
const CartQtyInput = ({ item, dbProduct, updateQuantity, removeFromCart, setToast }) => {
  const [localVal, setLocalVal] = React.useState(item.quantity.toString());

  React.useEffect(() => {
    setLocalVal(item.quantity.toString());
  }, [item.quantity]);

  const handleBlur = () => {
    const parsed = parseFloat(localVal);
    if (isNaN(parsed) || parsed <= 0) {
      removeFromCart(item.productId);
    } else {
      try {
        updateQuantity(item.productId, parsed, dbProduct.Stock);
      } catch (err) {
        setToast({ type: 'error', message: err.message });
        setLocalVal(item.quantity.toString());
      }
    }
  };

  const handleChange = (e) => {
    const val = e.target.value;
    setLocalVal(val);
    const parsed = parseFloat(val);
    if (!isNaN(parsed) && parsed > 0 && parsed <= dbProduct.Stock) {
      try {
        updateQuantity(item.productId, parsed, dbProduct.Stock);
      } catch (err) {
        // silent while typing
      }
    }
  };

  return (
    <input
      type="number"
      step="any"
      className="qty-input"
      value={localVal}
      onChange={handleChange}
      onBlur={handleBlur}
      readOnly={!dbProduct.AllowFraction}
      style={{ width: '56px', textAlign: 'center' }}
    />
  );
};

export default function Register({ setToast }) {
  const { token, API_URL } = useAuth();
  const {
    cartItems, attachedCustomer, discountAmount, subtotal, taxAmount, totalAmount,
    addToCart, removeFromCart, updateQuantity, setCustomer, applyDiscount, clearCart,
    checkout, holdSale, resumeSale
  } = useCart();

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [heldSales, setHeldSales] = useState([]);
  const [productBatches, setProductBatches] = useState({}); // { productId: [batches] }
  
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [barcodeQuery, setBarcodeQuery] = useState('');

  // UI Drawers / Modals State
  const [showHoldModal, setShowHoldModal] = useState(false);
  const [holdNote, setHoldNote] = useState('');
  const [showHeldDrawer, setShowHeldDrawer] = useState(false);
  
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [completedOrderDetails, setCompletedOrderDetails] = useState(null);

  // Split Payment State
  const [paymentSplits, setPaymentSplits] = useState([
    { method: 'Cash', amount: 0, referenceNumber: '' }
  ]);
  const [checkoutError, setCheckoutError] = useState('');

  // Compute discount and profit margin errors dynamically
  const discountError = React.useMemo(() => {
    if (cartItems.length === 0) return null;
    
    if (discountAmount > 0 && subtotal > 0) {
      for (const item of cartItems) {
        const dbProduct = products.find(p => p.ProductID === item.productId);
        if (!dbProduct) continue;

        const minDiscountAmt = Number(dbProduct.MinDiscountAmt) || 0;
        const minDiscountPct = Number(dbProduct.MinDiscountPct) || 0;
        const maxDiscountAmt = Number(dbProduct.MaxDiscountAmt) || 0;
        const maxDiscountPct = Number(dbProduct.MaxDiscountPct) || 0;
        const minProfitMargin = Number(dbProduct.MinProfitMargin) || 0;

        const itemDiscount = discountAmount * (item.subtotal / subtotal);
        const unitDiscount = itemDiscount / item.quantity;
        const discountPct = (unitDiscount / item.price) * 100;
        const effectivePrice = item.price - unitDiscount;

        // Min discount check
        if ((minDiscountAmt > 0 || minDiscountPct > 0) && unitDiscount <= 0) {
          return `Product '${item.name}' requires a mandatory minimum discount, but none was applied.`;
        }
        if (unitDiscount > 0) {
          if (minDiscountAmt > 0 && unitDiscount < minDiscountAmt) {
            return `Discount on '${item.name}' (Rs. ${unitDiscount.toFixed(2)}/unit) is below the minimum allowed discount of Rs. ${minDiscountAmt.toFixed(2)}/unit.`;
          }
          if (minDiscountPct > 0 && discountPct < minDiscountPct) {
            return `Discount on '${item.name}' (${discountPct.toFixed(1)}%) is below the minimum allowed discount of ${minDiscountPct.toFixed(1)}%.`;
          }
        }

        // Max discount check
        if (maxDiscountAmt > 0 && unitDiscount > maxDiscountAmt) {
          return `Discount on '${item.name}' (Rs. ${unitDiscount.toFixed(2)}/unit) exceeds the maximum allowed discount of Rs. ${maxDiscountAmt.toFixed(2)}/unit.`;
        }
        if (maxDiscountPct > 0 && discountPct > maxDiscountPct) {
          return `Discount on '${item.name}' (${discountPct.toFixed(1)}%) exceeds the maximum allowed discount of ${maxDiscountPct.toFixed(1)}%.`;
        }

        // Min profit margin check
        if (effectivePrice <= 0) {
          return `Discount on '${item.name}' is too high, resulting in a zero or negative selling price.`;
        }
        const grossMargin = ((effectivePrice - item.cost) / effectivePrice) * 100;
        if (grossMargin < minProfitMargin) {
          return `Discount on '${item.name}' reduces the gross profit margin (${grossMargin.toFixed(1)}%) below the minimum required profit margin of ${minProfitMargin.toFixed(1)}%.`;
        }
      }
    } else if (discountAmount === 0) {
      for (const item of cartItems) {
        const dbProduct = products.find(p => p.ProductID === item.productId);
        if (!dbProduct) continue;

        const minDiscountAmt = Number(dbProduct.MinDiscountAmt) || 0;
        const minDiscountPct = Number(dbProduct.MinDiscountPct) || 0;
        const minProfitMargin = Number(dbProduct.MinProfitMargin) || 0;

        if (minDiscountAmt > 0 || minDiscountPct > 0) {
          return `Product '${item.name}' requires a mandatory minimum discount, but none was applied.`;
        }
        const grossMargin = ((item.price - item.cost) / item.price) * 100;
        if (grossMargin < minProfitMargin) {
          return `Product '${item.name}' base price gross profit margin (${grossMargin.toFixed(1)}%) is below the minimum required profit margin of ${minProfitMargin.toFixed(1)}%.`;
        }
      }
    }
    return null;
  }, [cartItems, discountAmount, subtotal, products]);

  // References for barcode scanner auto-focus
  const barcodeInputRef = useRef(null);

  useEffect(() => {
    fetchProducts();
    fetchCategories();
    fetchCustomers();
    fetchHeldSalesCount();
    // Auto-focus barcode scanner input on load
    if (barcodeInputRef.current) barcodeInputRef.current.focus();
  }, []);

  const fetchProducts = async () => {
    try {
      const res = await fetch(`${API_URL}/api/inventory/products`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setProducts(data);
        // Pre-fetch batches for batch-tracked products
        const batchTracked = data.filter(p => p.IsBatchTracked);
        const batchMap = {};
        await Promise.all(batchTracked.map(async (p) => {
          try {
            const br = await fetch(`${API_URL}/api/inventory/batches/${p.ProductID}`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            if (br.ok) batchMap[p.ProductID] = await br.json();
          } catch (_) {}
        }));
        setProductBatches(batchMap);
      }
    } catch (err) {
      console.error('Failed to load products:', err);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch(`${API_URL}/api/inventory/categories`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCategories(data);
      }
    } catch (err) {
      console.error('Failed to load categories:', err);
    }
  };

  const fetchCustomers = async () => {
    try {
      const res = await fetch(`${API_URL}/api/customers`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCustomers(data);
      }
    } catch (err) {
      console.error('Failed to load customers:', err);
    }
  };

  const fetchHeldSalesCount = async () => {
    try {
      const res = await fetch(`${API_URL}/api/sales/held`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setHeldSales(data);
      }
    } catch (err) {
      console.error('Failed to load held sales:', err);
    }
  };

  // Expiry check helper - returns { blocked: bool, warning: string|null }
  const checkExpiryForProduct = (product, qtyRequested = 1) => {
    if (!product.IsBatchTracked) return { blocked: false, warning: null };
    const batches = productBatches[product.ProductID] || [];
    if (batches.length === 0) return { blocked: false, warning: null };

    const now = new Date();
    const activeBatches = batches.filter(b => Number(b.CurrentQty) > 0);
    const nonExpiredBatches = activeBatches.filter(b => new Date(b.ExpiryDate) >= now);
    const nonExpiredStock = nonExpiredBatches.reduce((s, b) => s + Number(b.CurrentQty), 0);

    // Soonest expiry among non-expired batches
    const soonestDays = nonExpiredBatches.length > 0
      ? Math.min(...nonExpiredBatches.map(b => Math.floor((new Date(b.ExpiryDate) - now) / 86400000)))
      : null;

    if (product.BlockExpiredSales && nonExpiredStock < qtyRequested) {
      return {
        blocked: true,
        warning: `'${product.Name}' has insufficient non-expired stock (${nonExpiredStock} available). Expired batches are blocked from sale.`
      };
    }

    if (soonestDays !== null && soonestDays <= 30) {
      return {
        blocked: false,
        warning: soonestDays <= 0 ? 'Has expired batch' : `Expiring in ${soonestDays} day${soonestDays !== 1 ? 's' : ''}`
      };
    }
    return { blocked: false, warning: null };
  };

  // Barcode Handler (adds item to cart instantly when scanned/entered)
  const handleBarcodeSubmit = (e) => {
    e.preventDefault();
    if (!barcodeQuery.trim()) return;

    const matched = products.find(p => p.Barcode === barcodeQuery.trim() || p.SKU.toLowerCase() === barcodeQuery.trim().toLowerCase());
    if (matched) {
      if (matched.IsActive === false || matched.IsActive === 0) {
        setToast({ type: 'error', message: `Product '${matched.Name}' is inactive and cannot be sold.` });
        setBarcodeQuery('');
        return;
      }
      const { blocked, warning } = checkExpiryForProduct(matched);
      if (blocked) {
        setToast({ type: 'error', message: warning });
        setBarcodeQuery('');
        return;
      }
      try {
        addToCart(matched);
        if (warning) setToast({ type: 'warning', message: `Added '${matched.Name}' — ⚠ ${warning}` });
        else setToast({ type: 'success', message: `Added '${matched.Name}' to cart.` });
      } catch (err) {
        setToast({ type: 'error', message: err.message });
      }
    } else {
      setToast({ type: 'error', message: `No product found for code: ${barcodeQuery}` });
    }
    setBarcodeQuery('');
  };

  // Click handler for catalog product cards
  const handleProductClick = (product) => {
    if (product.IsActive === false || product.IsActive === 0) {
      setToast({ type: 'error', message: `Product '${product.Name}' is inactive and cannot be sold.` });
      return;
    }
    if (product.Stock <= 0) {
      setToast({ type: 'error', message: `'${product.Name}' is out of stock.` });
      return;
    }
    const { blocked, warning } = checkExpiryForProduct(product);
    if (blocked) {
      setToast({ type: 'error', message: warning });
      return;
    }
    try {
      addToCart(product);
      if (warning) setToast({ type: 'warning', message: `⚠ ${warning}` });
    } catch (err) {
      setToast({ type: 'error', message: err.message });
    }
  };

  // Hold Sale trigger
  const handleHoldSaleSubmit = async (e) => {
    e.preventDefault();
    try {
      await holdSale(holdNote || 'Table/Queue Order');
      setToast({ type: 'success', message: 'Sale suspended successfully.' });
      setShowHoldModal(false);
      setHoldNote('');
      fetchHeldSalesCount();
    } catch (err) {
      setToast({ type: 'error', message: err.message });
    }
  };

  // Resume Sale trigger
  const handleResumeSaleClick = async (heldOrder) => {
    try {
      const res = await fetch(`${API_URL}/api/sales/resume/${heldOrder.OrderID}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to resume.');

      resumeSale(data); // loads items to context cart
      setToast({ type: 'success', message: `Resumed suspended sale #${heldOrder.OrderID}` });
      setShowHeldDrawer(false);
      fetchHeldSalesCount();
    } catch (err) {
      setToast({ type: 'error', message: err.message });
    }
  };

  // Open Checkout and preset first split amount
  const handleCheckoutOpen = () => {
    if (cartItems.length === 0) return;
    setPaymentSplits([{ method: 'Cash', amount: totalAmount, referenceNumber: '' }]);
    setCheckoutError('');
    setShowCheckoutModal(true);
  };

  // Add a split payment row
  const addPaymentSplit = () => {
    const remaining = Number((totalAmount - paymentSplits.reduce((sum, p) => sum + p.amount, 0)).toFixed(2));
    setPaymentSplits([...paymentSplits, { method: 'Cash', amount: Math.max(0, remaining), referenceNumber: '' }]);
  };

  // Remove a split payment row
  const removePaymentSplit = (idx) => {
    setPaymentSplits(paymentSplits.filter((_, i) => i !== idx));
  };

  // Update a specific split field
  const updateSplitField = (idx, field, value) => {
    setPaymentSplits(paymentSplits.map((p, i) => {
      if (i === idx) {
        let val = value;
        if (field === 'amount') val = Number(value) || 0;
        return { ...p, [field]: val };
      }
      return p;
    }));
  };

  // Execute checkout
  const handleCheckoutSubmit = async () => {
    setCheckoutError('');
    if (discountError) {
      setCheckoutError(discountError);
      return;
    }
    const splitsSum = paymentSplits.reduce((sum, p) => sum + p.amount, 0);
    if (Math.abs(splitsSum - totalAmount) > 0.01) {
      setCheckoutError(`Split totals (Rs. ${splitsSum.toFixed(2)}) do not match total due (Rs. ${totalAmount.toFixed(2)}).`);
      return;
    }

    try {
      const res = await checkout(paymentSplits);
      setToast({ type: 'success', message: 'Transaction completed!' });
      setShowCheckoutModal(false);
      fetchProducts(); // refresh stock counts
      
      // Fetch invoice details to show receipt
      const detailsRes = await fetch(`${API_URL}/api/sales/history/${res.orderId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (detailsRes.ok) {
        const details = await detailsRes.json();
        setCompletedOrderDetails(details);
        setShowReceiptModal(true);
      }
    } catch (err) {
      setCheckoutError(err.message);
    }
  };

  // Print function
  const handlePrintReceipt = () => {
    window.print();
  };

  // Filter products locally for instantaneous responsiveness
  const filteredProducts = products.filter(p => {
    if (p.IsActive === false || p.IsActive === 0) return false;
    const matchesCategory = selectedCategory ? p.CategoryID === selectedCategory : true;
    const matchesSearch = searchQuery ? (
      p.Name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.SKU.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.Barcode && p.Barcode.includes(searchQuery))
    ) : true;
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="pos-layout">
      {/* 1. Left Catalog Panel */}
      <div className="catalog-panel">
        <div className="pos-header">
          {/* Barcode scanner form (hidden from eye or sleekly designed) */}
          <form onSubmit={handleBarcodeSubmit} style={{ width: '220px', flexShrink: 0 }}>
            <div style={{ position: 'relative' }}>
              <input
                ref={barcodeInputRef}
                type="text"
                className="form-input"
                style={{ paddingLeft: '14px', fontFamily: 'var(--font-mono)' }}
                placeholder="Scan Barcode / SKU..."
                value={barcodeQuery}
                onChange={(e) => setBarcodeQuery(e.target.value)}
              />
            </div>
          </form>

          {/* Product search */}
          <div className="search-box-container">
            <Search className="search-icon" size={18} />
            <input
              type="text"
              className="form-input pos-search"
              placeholder="Search product catalog by name, SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Suspended orders button */}
          <button 
            className="btn btn-secondary" 
            style={{ position: 'relative', display: 'flex', gap: '8px' }}
            onClick={() => setShowHeldDrawer(true)}
          >
            <FolderMinus size={18} />
            <span>Held ({heldSales.length})</span>
          </button>
        </div>

        {/* Category Tabs */}
        <div className="category-tabs">
          <button 
            className={`category-tab ${selectedCategory === null ? 'active' : ''}`}
            onClick={() => setSelectedCategory(null)}
          >
            All Products
          </button>
          {categories.map((c) => (
            <button
              key={c.CategoryID}
              className={`category-tab ${selectedCategory === c.CategoryID ? 'active' : ''}`}
              onClick={() => setSelectedCategory(c.CategoryID)}
            >
              {c.Name}
            </button>
          ))}
        </div>

        {/* Product Grid */}
        {filteredProducts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
            <ShoppingCart size={48} style={{ strokeWidth: 1, marginBottom: '16px' }} />
            <p>No products match your search/filters.</p>
          </div>
        ) : (
          <div className="products-grid">
            {filteredProducts.map((p) => {
              const inCart = cartItems.find(item => item.productId === p.ProductID);
              const remainingStock = p.Stock - (inCart ? inCart.quantity : 0);
              const { blocked: expiryBlocked, warning: expiryWarning } = checkExpiryForProduct(p);
              const isDisabled = remainingStock <= 0 || expiryBlocked;
              return (
                <div
                  key={p.ProductID}
                  className={`product-card ${isDisabled ? 'disabled' : ''}`}
                  onClick={() => handleProductClick(p)}
                  style={{ position: 'relative' }}
                >
                  {/* Expiring soon badge */}
                  {expiryWarning && !expiryBlocked && (
                    <div style={{
                      position: 'absolute', top: '6px', right: '6px',
                      background: 'rgba(234, 179, 8, 0.9)', color: '#000',
                      fontSize: '9px', fontWeight: '700', padding: '2px 6px',
                      borderRadius: '8px', zIndex: 2, backdropFilter: 'blur(4px)'
                    }}>
                      ⚠ {expiryWarning}
                    </div>
                  )}
                  {expiryBlocked && (
                    <div style={{
                      position: 'absolute', top: '6px', right: '6px',
                      background: 'rgba(239, 68, 68, 0.9)', color: 'white',
                      fontSize: '9px', fontWeight: '700', padding: '2px 6px',
                      borderRadius: '8px', zIndex: 2
                    }}>
                      🔒 Expired
                    </div>
                  )}
                  {p.ImageURL && (
                    <img className="product-image" src={p.ImageURL} alt={p.Name} onError={(e)=>{e.target.style.display='none'}} />
                  )}
                  <div className="product-info">
                    <div className="product-name">{p.Name}</div>
                    <div className="product-meta-row">
                      <div className="product-price">Rs. {Number(p.Price).toFixed(2)} / {p.UOM || 'pcs'}</div>
                      <div className={`product-stock ${remainingStock <= 0 || expiryBlocked ? 'out-of-stock' : remainingStock <= p.LowStockThreshold ? 'low-stock' : ''}`}>
                        {expiryBlocked ? 'Expired' : remainingStock <= 0 ? 'Out of Stock' : `${Number(remainingStock)} ${p.UOM || 'pcs'} left`}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. Right Cart Sidebar */}
      <div className="cart-sidebar">
        <div className="cart-header">
          <div className="cart-title">
            <ShoppingCart size={20} />
            <span>Active Billing</span>
            {cartItems.length > 0 && <span className="cart-badge">{cartItems.reduce((s,i)=>s+i.quantity,0)} items</span>}
          </div>
          <button 
            className="btn btn-secondary btn-icon" 
            style={{ color: 'var(--text-muted)', border: 'none', background: 'transparent' }}
            onClick={clearCart}
            title="Clear Cart"
          >
            <Trash2 size={16} />
          </button>
        </div>

        {/* Cart items list */}
        <div className="cart-items-list">
          {cartItems.length === 0 ? (
            <div className="cart-empty-state">
              <ShoppingCart size={40} style={{ opacity: 0.15 }} />
              <p>Billing cart is empty.</p>
              <p style={{ fontSize: '11px', textAlign: 'center', width: '80%' }}>Scan a barcode or click products to populate items.</p>
            </div>
          ) : (
            cartItems.map((item) => {
              const dbProduct = products.find(p => p.ProductID === item.productId) || { Stock: 999, AllowFraction: false, UOM: 'pcs' };
              const batches = productBatches[item.productId] || [];
              const now = new Date();
              const soonestExpiry = batches.filter(b => Number(b.CurrentQty) > 0).reduce((min, b) => {
                const d = Math.floor((new Date(b.ExpiryDate) - now) / 86400000);
                return (min === null || d < min) ? d : min;
              }, null);
              const cartExpiryWarning = soonestExpiry !== null && soonestExpiry <= 30
                ? (soonestExpiry <= 0 ? '⚠ Expired batch in stock' : `⚠ Expires in ${soonestExpiry}d`)
                : null;
              return (
                <div key={item.productId} className="cart-item">
                  <div className="cart-item-details">
                    <div className="cart-item-name">{item.name}</div>
                    <div className="cart-item-price">Rs. {Number(item.price).toFixed(2)} / {dbProduct.UOM || 'pcs'}</div>
                    {cartExpiryWarning && (
                      <div style={{ fontSize: '10px', color: soonestExpiry <= 0 ? '#ef4444' : '#eab308', fontWeight: '600', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={10} /> {cartExpiryWarning}
                      </div>
                    )}
                  </div>

                  <div className="qty-controls">
                    <button 
                      className="qty-btn"
                      onClick={() => {
                        try {
                          updateQuantity(item.productId, item.quantity - 1, dbProduct.Stock);
                        } catch(err) {
                          setToast({ type: 'error', message: err.message });
                        }
                      }}
                    >
                      <Minus size={12} />
                    </button>
                    <CartQtyInput
                      item={item}
                      dbProduct={dbProduct}
                      updateQuantity={updateQuantity}
                      removeFromCart={removeFromCart}
                      setToast={setToast}
                    />
                    <button 
                      className="qty-btn"
                      onClick={() => {
                        try {
                          updateQuantity(item.productId, item.quantity + 1, dbProduct.Stock);
                        } catch(err) {
                          setToast({ type: 'error', message: err.message });
                        }
                      }}
                    >
                      <Plus size={12} />
                    </button>
                  </div>

                  <button 
                    className="cart-item-delete"
                    onClick={() => removeFromCart(item.productId)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Attach customer */}
        <div className="customer-selector-container">
          {attachedCustomer ? (
            <div className="customer-tag">
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontWeight: '600', fontSize: '12px' }}>{attachedCustomer.Name}</span>
                {attachedCustomer.LoyaltyPoints !== undefined && (
                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                    VIP Points: {attachedCustomer.LoyaltyPoints} | Credit Limit: Rs. {Number(attachedCustomer.CreditLimit).toFixed(2)}
                  </span>
                )}
              </div>
              <button className="customer-tag-remove" onClick={() => setCustomer(null)}>✕</button>
            </div>
          ) : (
            <div style={{ position: 'relative' }}>
              <select 
                className="form-select"
                style={{ fontSize: '13px', padding: '8px 12px' }}
                onChange={(e) => {
                  const cust = customers.find(c => c.CustomerID === parseInt(e.target.value));
                  setCustomer(cust || null);
                }}
                value=""
              >
                <option value="">-- Attach Customer --</option>
                {customers.map(c => (
                  <option key={c.CustomerID} value={c.CustomerID}>
                    {c.Name} {c.Phone ? `(${c.Phone})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Summary pricing calculations */}
        <div className="cart-summary">
          <div className="summary-row">
            <span>Subtotal</span>
            <span className="mono">Rs. {subtotal.toFixed(2)}</span>
          </div>

          <div className="summary-row" style={{ alignItems: 'center' }}>
            <span>Discounts (Rs.)</span>
            <input 
              type="number" 
              className="form-input mono" 
              style={{ width: '80px', padding: '4px 8px', fontSize: '12px', textAlign: 'right' }} 
              value={discountAmount}
              onChange={(e) => applyDiscount(e.target.value)}
              min="0"
              max={subtotal}
            />
          </div>

          {discountError && (
            <div style={{
              color: 'var(--danger)',
              background: 'var(--danger-bg)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: 'var(--radius-sm)',
              padding: '8px 10px',
              fontSize: '11px',
              lineHeight: '1.4',
              marginTop: '4px',
              textAlign: 'left'
            }}>
              {discountError}
            </div>
          )}

          <div className="summary-row">
            <span>Tax (10%)</span>
            <span className="mono">Rs. {taxAmount.toFixed(2)}</span>
          </div>

          <div className="summary-row total">
            <span>Total Due</span>
            <span className="total-amount">Rs. {totalAmount.toFixed(2)}</span>
          </div>

          <div className="cart-actions">
            <button 
              className="btn btn-secondary" 
              onClick={() => { if (cartItems.length > 0) setShowHoldModal(true); }}
              disabled={cartItems.length === 0}
            >
              Suspend
            </button>
            <button 
              className="btn btn-primary" 
              onClick={handleCheckoutOpen}
              disabled={cartItems.length === 0 || !!discountError}
            >
              Checkout
            </button>
          </div>
        </div>
      </div>

      {/* ============================================================================
         MODAL: SUSPEND ORDER NOTE
         ============================================================================ */}
      {showHoldModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: '400px' }}>
            <h3 style={{ marginBottom: '16px' }}>Suspend Active Order</h3>
            <form onSubmit={handleHoldSaleSubmit}>
              <div className="form-group">
                <label className="form-label">Order Note / Queue Ref</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Table 14, Order #2, Call Name"
                  value={holdNote}
                  onChange={(e) => setHoldNote(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowHoldModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Suspend Sale</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================================
         DRAWER: HELD ORDERS
         ============================================================================ */}
      {showHeldDrawer && (
        <div className="modal-overlay" onClick={() => setShowHeldDrawer(false)}>
          <div 
            className="modal-content" 
            style={{ width: '450px', height: '100vh', margin: 0, position: 'fixed', right: 0, top: 0, bottom: 0, borderRadius: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between' }}>
              <span>Held Transactions</span>
              <button style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }} onClick={() => setShowHeldDrawer(false)}>✕</button>
            </h3>

            {heldSales.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '40px' }}>No suspended sales found.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', maxHeight: 'calc(100vh - 120px)' }}>
                {heldSales.map((held) => (
                  <div key={held.OrderID} style={{
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border-color)',
                    padding: '16px',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: '700' }}>#{held.OrderID} - {held.HeldNote}</span>
                      <span className="mono" style={{ color: 'var(--accent)', fontWeight: '600' }}>Rs. {Number(held.TotalAmount).toFixed(2)}</span>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      Saved: {new Date(held.OrderDate).toLocaleTimeString()} ({new Date(held.OrderDate).toLocaleDateString()})
                    </div>
                    <button 
                      className="btn btn-primary" 
                      style={{ padding: '6px 12px', fontSize: '12.5px', marginTop: '6px' }}
                      onClick={() => handleResumeSaleClick(held)}
                    >
                      Resume Order
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================================
         MODAL: SPLIT CHECKOUT WIZARD
         ============================================================================ */}
      {showCheckoutModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: '580px' }}>
            <h3 style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <span>Order Checkout</span>
              <span className="mono" style={{ color: 'var(--accent)' }}>Total: Rs. {totalAmount.toFixed(2)}</span>
            </h3>

            {checkoutError && (
              <div style={{ background: 'var(--danger-bg)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '12px', borderRadius: 'var(--radius-md)', marginBottom: '16px', color: '#fca5a5', fontSize: '13px' }}>
                {checkoutError}
              </div>
            )}

            {discountError && (
              <div style={{ background: 'var(--danger-bg)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '12px', borderRadius: 'var(--radius-md)', marginBottom: '16px', color: '#fca5a5', fontSize: '13px' }}>
                <strong>Discount Validation Warning:</strong> {discountError}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '20px' }}>
              <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)' }}>PAYMENT SPLITS</span>
              
              {paymentSplits.map((p, idx) => (
                <div key={idx} style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', background: 'rgba(0,0,0,0.15)', padding: '12px', borderRadius: 'var(--radius-md)' }}>
                  
                  {/* Select Payment Method */}
                  <div style={{ flex: 1.2 }}>
                    <label className="form-label" style={{ fontSize: '11px' }}>METHOD</label>
                    <select
                      className="form-select"
                      style={{ padding: '8px 12px', fontSize: '13px' }}
                      value={p.method}
                      onChange={(e) => updateSplitField(idx, 'method', e.target.value)}
                    >
                      <option value="Cash">Cash</option>
                      <option value="Card">Card</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="Credit">Credit Sale (Debt)</option>
                    </select>
                  </div>

                  {/* Input Amount */}
                  <div style={{ flex: 1 }}>
                    <label className="form-label" style={{ fontSize: '11px' }}>AMOUNT (Rs.)</label>
                    <input
                      type="number"
                      className="form-input mono"
                      style={{ padding: '8px 12px', fontSize: '13px' }}
                      placeholder="0.00"
                      value={p.amount || ''}
                      onChange={(e) => updateSplitField(idx, 'amount', e.target.value)}
                      step="0.01"
                      min="0"
                    />
                  </div>

                  {/* Reference Number */}
                  <div style={{ flex: 1.5 }}>
                    <label className="form-label" style={{ fontSize: '11px' }}>REF / SLIP NO</label>
                    <input
                      type="text"
                      className="form-input"
                      style={{ padding: '8px 12px', fontSize: '13px' }}
                      placeholder="Txn ID, Terminal Ref"
                      value={p.referenceNumber}
                      onChange={(e) => updateSplitField(idx, 'referenceNumber', e.target.value)}
                    />
                  </div>

                  {/* Delete button if split count > 1 */}
                  {paymentSplits.length > 1 && (
                    <button 
                      className="btn btn-danger btn-icon"
                      style={{ width: '38px', height: '38px', borderRadius: 'var(--radius-md)' }}
                      onClick={() => removePaymentSplit(idx)}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}

              <button 
                className="btn btn-secondary"
                style={{ alignSelf: 'flex-start', padding: '6px 12px', fontSize: '12.5px' }}
                onClick={addPaymentSplit}
              >
                + Add Split Payment
              </button>
            </div>

            {/* Calculations info */}
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', fontSize: '13.5px', color: 'var(--text-secondary)' }}>
              <span>Total Payments Aggregated:</span>
              <span className="mono" style={{
                fontWeight: '700',
                color: Math.abs(paymentSplits.reduce((s,p)=>s+p.amount,0) - totalAmount) < 0.01 ? 'var(--success)' : 'var(--danger)'
              }}>
                Rs. {paymentSplits.reduce((s,p)=>s+p.amount,0).toFixed(2)} / Rs. {totalAmount.toFixed(2)}
              </span>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
              <button className="btn btn-secondary" onClick={() => setShowCheckoutModal(false)}>Close</button>
              <button 
                className="btn btn-primary"
                onClick={handleCheckoutSubmit}
                disabled={Math.abs(paymentSplits.reduce((s,p)=>s+p.amount,0) - totalAmount) > 0.01 || !!discountError}
              >
                Complete Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================================
         MODAL: RECEIPT PRINT LAYOUT
         ============================================================================ */}
      {showReceiptModal && completedOrderDetails && (
        <div className="modal-overlay printable-receipt-modal-container">
          <div className="modal-content" style={{ width: '400px', background: '#f8fafc', color: '#0f172a' }}>
            
            {/* The printable receipt container */}
            <div className="receipt-wrapper printable-receipt-modal">
              <div className="receipt-header">
                <div className="receipt-title">SELLMAX PRO</div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>Store ID: #001 | LabaqaBCMS 2026</div>
                <div style={{ fontSize: '10px', marginTop: '4px' }}>{completedOrderDetails.order.CompanyName || 'SellMax Retail Ltd'}</div>
              </div>

              <div className="receipt-details">
                <div>INVOICE: #SM-{completedOrderDetails.order.OrderID}</div>
                <div>DATE: {new Date(completedOrderDetails.order.OrderDate).toLocaleString()}</div>
                <div>CASHIER: {completedOrderDetails.order.Username}</div>
                <div>CUSTOMER: {completedOrderDetails.order.CustomerName || 'Walk-in Customer'}</div>
              </div>

              <table className="receipt-items-table">
                <thead>
                  <tr>
                    <th style={{ width: '55%' }}>ITEM</th>
                    <th style={{ width: '15%', textAnchor: 'middle' }}>QTY</th>
                    <th style={{ width: '30%', textAnchor: 'end', textAlign: 'right' }}>PRICE</th>
                  </tr>
                </thead>
                <tbody>
                  {completedOrderDetails.items.map((item, i) => (
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
                  <span>Rs. {Number(completedOrderDetails.order.Subtotal).toFixed(2)}</span>
                </div>
                {Number(completedOrderDetails.order.DiscountAmount) > 0 && (
                  <div className="receipt-summary-row">
                    <span>Discount:</span>
                    <span>-Rs. {Number(completedOrderDetails.order.DiscountAmount).toFixed(2)}</span>
                  </div>
                )}
                <div className="receipt-summary-row">
                  <span>Tax (10%):</span>
                  <span>Rs. {Number(completedOrderDetails.order.TaxAmount).toFixed(2)}</span>
                </div>
                <div className="receipt-summary-row total">
                  <span>TOTAL PAID:</span>
                  <span>Rs. {Number(completedOrderDetails.order.TotalAmount).toFixed(2)}</span>
                </div>
              </div>

              <div style={{ fontSize: '11px', borderTop: '1px dashed #000', paddingTop: '6px' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Payments:</div>
                {completedOrderDetails.payments.map((p, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px' }}>
                    <span>- {p.Method} {p.ReferenceNumber ? `(${p.ReferenceNumber})` : ''}</span>
                    <span>Rs. {Number(p.Amount).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div className="receipt-footer">
                <p>Thank you for shopping with us!</p>
                <p>System powered by SellMax Pro POS</p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '24px' }} className="no-print">
              <button className="btn btn-secondary" onClick={() => setShowReceiptModal(false)}>Close Window</button>
              <button className="btn btn-primary" onClick={handlePrintReceipt}>
                <Printer size={16} />
                <span>Print Invoice</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
