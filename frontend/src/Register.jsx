import React, { useState, useEffect, useRef } from 'react';
import { useCart } from './contexts/CartContext';
import formatCurrency from './utils/formatCurrency';
import { useAuth } from './contexts/AuthContext';
import { Search, Plus, Minus, Trash2, FolderMinus, UserPlus, CreditCard, RefreshCw, ShoppingCart, Lock, DollarSign, Printer, CheckCircle, AlertTriangle, Clock, Eye, EyeOff } from 'lucide-react';
import usePermanentFocus from './hooks/usePermanentFocus';
import DayEndReconciliation from './DayEndReconciliation';

// Card Brand Logos for POS Checkout
const VisaLogo = () => (
  <img 
    src="https://cdn.jsdelivr.net/gh/aaronfagan/svg-credit-card-payment-icons/flat-rounded/visa.svg" 
    alt="Visa" 
    style={{ width: '64px', height: '40px', objectFit: 'contain', borderRadius: '4px', boxShadow: '0 2px 4px rgba(0,0,0,0.15)' }} 
  />
);

const MastercardLogo = () => (
  <img 
    src="https://cdn.jsdelivr.net/gh/aaronfagan/svg-credit-card-payment-icons/flat-rounded/mastercard.svg" 
    alt="Mastercard" 
    style={{ width: '64px', height: '40px', objectFit: 'contain', borderRadius: '4px', boxShadow: '0 2px 4px rgba(0,0,0,0.15)' }} 
  />
);

const AmexLogo = () => (
  <img 
    src="https://cdn.jsdelivr.net/gh/aaronfagan/svg-credit-card-payment-icons/flat-rounded/amex.svg" 
    alt="Amex" 
    style={{ width: '64px', height: '40px', objectFit: 'contain', borderRadius: '4px', boxShadow: '0 2px 4px rgba(0,0,0,0.15)' }} 
  />
);

// Helper component for managing text/numeric input for quantity adjustments in cart
const CartQtyInput = ({ item, dbProduct, updateQuantity, removeFromCart, setToast, allowNegativeStock }) => {
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
    if (!isNaN(parsed) && parsed > 0 && (allowNegativeStock || parsed <= dbProduct.Stock)) {
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
  const { token, user, API_URL } = useAuth();
  const {
    cartItems, attachedCustomer, discountAmount, subtotal, taxAmount, totalAmount,
    addToCart, removeFromCart, updateQuantity, overrideItemPrice, setCustomer, applyDiscount, clearCart,
    checkout, holdSale, resumeSale, allowNegativeStock
  } = useCart();

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [heldSales, setHeldSales] = useState([]);
  const [productBatches, setProductBatches] = useState({}); // { productId: [batches] }
  
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // UI Drawers / Modals State
  const [showHeldDrawer, setShowHeldDrawer] = useState(false);
  const [activeHeldBillNumber, setActiveHeldBillNumber] = useState(null);
  const [heldSearchQuery, setHeldSearchQuery] = useState('');
  
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [completedOrderDetails, setCompletedOrderDetails] = useState(null);
  const [companyInfo, setCompanyInfo] = useState(null);

  // Price Override State
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideItem, setOverrideItem] = useState(null);
  const [overridePriceVal, setOverridePriceVal] = useState('');
  const [overridePin, setOverridePin] = useState('');
  const [overrideError, setOverrideError] = useState('');
  const [verifiedManagerPin, setVerifiedManagerPin] = useState(null);

  // Profit Margin Visibility State
  const [showProfit, setShowProfit] = useState(false);

  // Checkout Write-off/Round-off State
  const [writeOffAmount, setWriteOffAmount] = useState(0);

  // Cash Drawer Day Start State
  const [drawerSession, setDrawerSession] = useState(null);
  const [showDayStartModal, setShowDayStartModal] = useState(false);
  const [showDrawerDetailsModal, setShowDrawerDetailsModal] = useState(false);
  const [showDayEndWizard, setShowDayEndWizard] = useState(false);
  const [terminalId, setTerminalId] = useState('Terminal-01');
  const [dayStartMode, setDayStartMode] = useState('denominations'); // 'denominations' or 'direct'
  const [dayStartDirectAmt, setDayStartDirectAmt] = useState('');
  const [dayStartDenoms, setDayStartDenoms] = useState({
    5000: 0,
    2000: 0,
    1000: 0,
    500: 0,
    100: 0,
    50: 0,
    20: 0,
    10: 0,
    5: 0
  });
  const [dayStartSubmitting, setDayStartSubmitting] = useState(false);
  const [dayStartError, setDayStartError] = useState('');

  // Price Variants State
  const [variantsByProduct, setVariantsByProduct] = useState({}); // { productId: [variant,...] }
  const [showVariantPicker, setShowVariantPicker] = useState(false);
  const [variantPickerProduct, setVariantPickerProduct] = useState(null);

  const getCompanyLogoUrl = (url) => {
    if (!url) return null;
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
      return url;
    }
    return `${API_URL}${url}`;
  };

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
            return `Discount on '${item.name}' (Rs. ${formatCurrency(unitDiscount)}/unit) is below the minimum allowed discount of Rs. ${formatCurrency(minDiscountAmt)}/unit.`;
          }
          if (minDiscountPct > 0 && discountPct < minDiscountPct) {
            return `Discount on '${item.name}' (${discountPct.toFixed(1)}%) is below the minimum allowed discount of ${minDiscountPct.toFixed(1)}%.`;
          }
        }

        // Max discount check
        if (maxDiscountAmt > 0 && unitDiscount > maxDiscountAmt) {
          return `Discount on '${item.name}' (Rs. ${formatCurrency(unitDiscount)}/unit) exceeds the maximum allowed discount of Rs. ${formatCurrency(maxDiscountAmt)}/unit.`;
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

  // Permanent focus: keep cursor on barcode input at all times
  // Suspended while any modal/overlay is open so they remain interactive
  const anyModalOpen = showDayStartModal || showCheckoutModal || showReceiptModal
    || showHeldDrawer || showOverrideModal || showDrawerDetailsModal || showVariantPicker;
  usePermanentFocus(barcodeInputRef, !anyModalOpen);

  const checkDrawerStatus = async () => {
    try {
      const res = await fetch(`${API_URL}/api/sales/cash-drawer/status`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setDrawerSession(data.session);
        if (!data.hasSession) {
          setShowDayStartModal(true);
        }
      }
    } catch (err) {
      console.error('Failed to check cash drawer status:', err);
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchCategories();
    fetchCustomers();
    fetchHeldSalesCount();
    fetchCompanyInfo();
    checkDrawerStatus();
    // usePermanentFocus handles initial focus — no manual call needed here

    // Listen for receipt printed message to auto-close receipt modal
    const handleMessage = (event) => {
      if (event.data === 'receipt-printed-done') {
        setShowReceiptModal(false);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  // Escape key handler to close POS register modals/suspension drawer
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (showOverrideModal) setShowOverrideModal(false);
        if (showCheckoutModal) setShowCheckoutModal(false);
        if (showReceiptModal) setShowReceiptModal(false);
        if (showHeldDrawer) setShowHeldDrawer(false);
        if (showDrawerDetailsModal) setShowDrawerDetailsModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showOverrideModal, showCheckoutModal, showReceiptModal, showHeldDrawer, showDrawerDetailsModal]);

  // Listen to cash drawer details requests from parent app shell
  useEffect(() => {
    const handleOpenDetails = () => {
      if (drawerSession) {
        setShowDrawerDetailsModal(true);
      } else {
        setShowDayStartModal(true);
      }
    };
    window.addEventListener('open-cash-drawer-details', handleOpenDetails);
    return () => window.removeEventListener('open-cash-drawer-details', handleOpenDetails);
  }, [drawerSession]);


  const fetchProducts = async () => {
    try {
      const [prodRes, varRes] = await Promise.all([
        fetch(`${API_URL}/api/inventory/products`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_URL}/api/inventory/variants`, { headers: { 'Authorization': `Bearer ${token}` } })
      ]);
      if (prodRes.ok) {
        const data = await prodRes.json();
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
      if (varRes.ok) {
        const allVariants = await varRes.json();
        // Build map: { productId: [variant, ...] }
        const vMap = {};
        for (const v of allVariants) {
          if (!vMap[v.ProductID]) vMap[v.ProductID] = [];
          vMap[v.ProductID].push(v);
        }
        setVariantsByProduct(vMap);
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

  // Day Start / Drawer Open Submit
  const handleDayStartSubmit = async () => {
    setDayStartError('');
    setDayStartSubmitting(true);

    let openingBalance = 0;
    if (dayStartMode === 'denominations') {
      openingBalance = Object.entries(dayStartDenoms).reduce((sum, [denom, count]) => {
        return sum + (Number(denom) * (Number(count) || 0));
      }, 0);
    } else {
      openingBalance = parseFloat(dayStartDirectAmt);
      if (isNaN(openingBalance) || openingBalance < 0) {
        setDayStartError('Please enter a valid opening balance amount.');
        setDayStartSubmitting(false);
        return;
      }
    }

    try {
      const res = await fetch(`${API_URL}/api/sales/cash-drawer/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          openingBalance,
          openingDenominations: dayStartMode === 'denominations' ? dayStartDenoms : null,
          terminalId
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to start cash drawer session.');
      }

      setDrawerSession(data.session);
      setShowDayStartModal(false);
      setToast({ type: 'success', message: `Cash drawer opened with Rs. ${openingBalance.toLocaleString('en-LK', { minimumFractionDigits: 2 })}` });
    } catch (err) {
      setDayStartError(err.message || 'An error occurred. Please try again.');
    } finally {
      setDayStartSubmitting(false);
    }
  };

  // Price Override Helpers
  const openOverrideModal = (item) => {
    const dbProduct = products.find(p => p.ProductID === item.productId);
    setOverrideItem({ ...item, dbProduct });
    setOverridePriceVal(item.price.toString());
    setOverridePin('');
    setOverrideError('');
    setShowOverrideModal(true);
  };

  const checkOverrideNeedsPin = (newPrice, dbProduct) => {
    if (!dbProduct) return false;
    const origPrice = dbProduct.Price;
    if (Number(newPrice) >= origPrice) return false;
    const discountAmt = origPrice - Number(newPrice);
    const discountPct = (discountAmt / origPrice) * 100;
    const maxPct = Number(dbProduct.MaxDiscountPct) || 15;
    if (discountPct > maxPct) return true;
    if (Number(newPrice) < Number(dbProduct.Cost)) return true;
    const margin = Number(newPrice) > 0 ? ((Number(newPrice) - Number(dbProduct.Cost)) / Number(newPrice)) * 100 : -100;
    const minMargin = Number(dbProduct.MinProfitMargin) || 0;
    if (margin < minMargin) return true;
    return false;
  };

  const handleOverrideSubmit = async () => {
    setOverrideError('');
    const newPrice = parseFloat(overridePriceVal);
    if (isNaN(newPrice) || newPrice <= 0) {
      setOverrideError('Please enter a valid price greater than 0.');
      return;
    }
    const needsPin = checkOverrideNeedsPin(newPrice, overrideItem?.dbProduct);
    if (needsPin) {
      if (!overridePin || overridePin.trim() === '') {
        setOverrideError('Manager PIN is required for this price change (exceeds allowed limits).');
        return;
      }
      // Verify pin with backend
      try {
        const pinRes = await fetch(`${API_URL}/api/auth/verify-pin`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ pin: overridePin })
        });
        const pinData = await pinRes.json();
        if (!pinRes.ok || !pinData.success) {
          setOverrideError('Invalid manager PIN. Please try again.');
          return;
        }
        setVerifiedManagerPin(overridePin);
      } catch (err) {
        setOverrideError('Failed to verify PIN. Check connection.');
        return;
      }
    }
    overrideItemPrice(overrideItem.productId, newPrice);
    setShowOverrideModal(false);
    setToast({ type: 'success', message: `Price updated to Rs. ${newPrice.toFixed(2)} for '${overrideItem.name}'.` });
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (!drawerSession) {
      setShowDayStartModal(true);
      setToast({ type: 'warning', message: 'Opening cash balance must be set before selling products.' });
      return;
    }
    const query = searchQuery.trim();
    if (!query) return;

    // 1. Check if barcode matches a specific variant's barcode
    for (const [productId, vars] of Object.entries(variantsByProduct)) {
      const matchedVariant = vars.find(v => v.Barcode === query && v.IsActive);
      if (matchedVariant) {
        const product = products.find(p => p.ProductID === matchedVariant.ProductID);
        if (product && product.IsActive !== false && product.IsActive !== 0) {
          const { blocked, warning } = checkExpiryForProduct(product);
          if (blocked) { setToast({ type: 'error', message: warning }); setSearchQuery(''); return; }
          // Show picker for this product (cashier must always confirm variant)
          setVariantPickerProduct(product);
          setShowVariantPicker(true);
          setSearchQuery('');
          return;
        }
      }
    }

    // 2. Check if barcode/SKU matches a product
    const matched = products.find(p => p.Barcode === query || p.SKU.toLowerCase() === query.toLowerCase());
    if (matched) {
      if (matched.IsActive === false || matched.IsActive === 0) {
        setToast({ type: 'error', message: `Product '${matched.Name}' is inactive and cannot be sold.` });
        setSearchQuery('');
        return;
      }
      const { blocked, warning } = checkExpiryForProduct(matched);
      if (blocked) {
        setToast({ type: 'error', message: warning });
        setSearchQuery('');
        return;
      }
      // Show picker if product has variants, else add directly
      const productVariants = variantsByProduct[matched.ProductID]?.filter(v => v.IsActive) || [];
      if (productVariants.length > 0) {
        setVariantPickerProduct(matched);
        setShowVariantPicker(true);
        setSearchQuery('');
        return;
      }
      try {
        addToCart(matched);
        if (matched.Stock <= 0) {
          setToast({ type: 'warning', message: `Warning: '${matched.Name}' is out of stock. Negative inventory is enabled.` });
        } else if (warning) {
          setToast({ type: 'warning', message: `Added '${matched.Name}' — ⚠ ${warning}` });
        } else {
          setToast({ type: 'success', message: `Added '${matched.Name}' to cart.` });
        }
      } catch (err) {
        setToast({ type: 'error', message: err.message });
      }
      setSearchQuery('');
    } else {
      // If it looks like a barcode/SKU (e.g. alphanumeric without spaces, length >= 3), show error and clear input
      const looksLikeCode = /^[A-Za-z0-9_-]+$/.test(query) && query.length >= 3;
      if (looksLikeCode) {
        setToast({ type: 'error', message: `No product found for code: ${query}` });
        setSearchQuery('');
      }
    }
  };

  // Click handler for catalog product cards
  const handleProductClick = (product) => {
    if (!drawerSession) {
      setShowDayStartModal(true);
      setToast({ type: 'warning', message: 'Opening cash balance must be set before selling products.' });
      return;
    }
    if (product.IsActive === false || product.IsActive === 0) {
      setToast({ type: 'error', message: `Product '${product.Name}' is inactive and cannot be sold.` });
      return;
    }
    if (product.Stock <= 0) {
      if (!allowNegativeStock) {
        setToast({ type: 'error', message: `'${product.Name}' is out of stock.` });
        return;
      } else {
        setToast({ type: 'warning', message: `Warning: '${product.Name}' is out of stock. Negative inventory is enabled.` });
      }
    }
    const { blocked, warning } = checkExpiryForProduct(product);
    if (blocked) {
      setToast({ type: 'error', message: warning });
      return;
    }
    // Always show variant picker when the product has variants
    const productVariants = variantsByProduct[product.ProductID]?.filter(v => v.IsActive) || [];
    if (productVariants.length > 0) {
      setVariantPickerProduct(product);
      setShowVariantPicker(true);
      return;
    }
    // No variants — add directly using the product base price
    try {
      addToCart(product);
      if (warning) setToast({ type: 'warning', message: `⚠ ${warning}` });
    } catch (err) {
      setToast({ type: 'error', message: err.message });
    }
  };

  /** Add a product to cart using a specific price variant */
  const addVariantToCart = (product, variant) => {
    const { warning } = checkExpiryForProduct(product);
    try {
      addToCart({
        ...product,
        Price: variant.Price,
        variantId: variant.VariantID,
        variantName: variant.VariantName,
      });
      setShowVariantPicker(false);
      setVariantPickerProduct(null);
      if (product.Stock <= 0) {
        setToast({ type: 'warning', message: `Warning: '${product.Name}' (${variant.VariantName}) is out of stock. Negative inventory is enabled.` });
      } else if (warning) {
        setToast({ type: 'warning', message: `⚠ ${warning}` });
      } else {
        setToast({ type: 'success', message: `Added '${product.Name}' (${variant.VariantName}) — Rs. ${Number(variant.Price).toFixed(2)}` });
      }
    } catch (err) {
      setToast({ type: 'error', message: err.message });
    }
  };

  // Hold Sale directly without modal
  const handleHoldSaleDirectly = async () => {
    if (!drawerSession) {
      setShowDayStartModal(true);
      setToast({ type: 'warning', message: 'Opening cash balance must be set before suspended billing.' });
      return;
    }
    if (cartItems.length === 0) return;
    try {
      const res = await holdSale(activeHeldBillNumber);
      setToast({ 
        type: 'success', 
        message: `Bill suspended successfully. Bill Number: ${res.heldBillNumber}` 
      });
      setActiveHeldBillNumber(null);
      fetchHeldSalesCount();
    } catch (err) {
      setToast({ type: 'error', message: err.message });
    }
  };

  // Resume Sale trigger
  const handleResumeSaleClick = async (heldOrder) => {
    if (!drawerSession) {
      setShowDayStartModal(true);
      setToast({ type: 'warning', message: 'Opening cash balance must be set before resuming suspended bills.' });
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/sales/resume/${heldOrder.OrderID}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to resume.');

      resumeSale(data); // loads items to context cart
      setActiveHeldBillNumber(heldOrder.HeldBillNumber);
      setToast({ type: 'success', message: `Resumed Bill ${heldOrder.HeldBillNumber}` });
      setShowHeldDrawer(false);
      fetchHeldSalesCount();
    } catch (err) {
      setToast({ type: 'error', message: err.message });
    }
  };

  // Cancel/Delete Held Sale trigger
  const handleCancelHeldSaleClick = async (heldOrder) => {
    if (!drawerSession) {
      setShowDayStartModal(true);
      setToast({ type: 'warning', message: 'Opening cash balance must be set before actions.' });
      return;
    }
    if (!window.confirm(`Are you sure you want to cancel and permanently delete Bill ${heldOrder.HeldBillNumber}?`)) return;
    try {
      const res = await fetch(`${API_URL}/api/sales/held/${heldOrder.OrderID}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to cancel.');
      setToast({ type: 'success', message: `Bill ${heldOrder.HeldBillNumber} cancelled.` });
      fetchHeldSalesCount();
    } catch (err) {
      setToast({ type: 'error', message: err.message });
    }
  };

  // Clear cart wrapper to reset active resumed bill number
  const handleClearCart = () => {
    clearCart();
    setActiveHeldBillNumber(null);
  };

  // Open Checkout and preset first split amount
  const handleCheckoutOpen = () => {
    if (!drawerSession) {
      setShowDayStartModal(true);
      setToast({ type: 'warning', message: 'Opening cash balance must be set before processing checkout.' });
      return;
    }
    if (cartItems.length === 0) return;
    setWriteOffAmount(0);
    setPaymentSplits([{ method: 'Cash', amount: totalAmount, referenceNumber: '', amountReceived: '' }]);
    setCheckoutError('');
    setShowCheckoutModal(true);
  };

  // Handle write-off (round-off adjustment) input changes
  const handleWriteOffChange = (e) => {
    const val = e.target.value;
    const num = parseFloat(val) || 0;
    setWriteOffAmount(val);
    
    // Automatically adjust the first split amount if there's only 1 split
    if (paymentSplits.length === 1) {
      setPaymentSplits([{
        ...paymentSplits[0],
        amount: Number(Math.max(0, totalAmount - num).toFixed(2))
      }]);
    }
  };

  // Add a split payment row
  const addPaymentSplit = () => {
    const remaining = Number((totalAmount - paymentSplits.reduce((sum, p) => sum + p.amount, 0)).toFixed(2));
    setPaymentSplits([...paymentSplits, { method: 'Cash', amount: Math.max(0, remaining), referenceNumber: '', amountReceived: '' }]);
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
        if (field === 'amount') val = value === '' ? 0 : (Number(value) || 0);
        if (field === 'amountReceived') val = value === '' ? '' : (Number(value) || 0);
        
        const updated = { ...p, [field]: val };
        
        if (field === 'method') {
          updated.cardBrand = '';
          updated.referenceNumber = '';
          updated.amountReceived = '';
        }
        return updated;
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
    const writeOffNum = parseFloat(writeOffAmount || 0);
    if (Math.abs(splitsSum + writeOffNum - totalAmount) > 0.01) {
      setCheckoutError(`Split totals + write-off (Rs. ${formatCurrency(splitsSum + writeOffNum)}) do not match total due (Rs. ${formatCurrency(totalAmount)}).`);
      return;
    }

    try {
      const splitsWithWriteOff = [...paymentSplits];
      if (writeOffNum > 0) {
        splitsWithWriteOff.push({
          method: 'Write-off',
          amount: writeOffNum,
          referenceNumber: 'Balance Round-off Adjustment'
        });
      }

      const formattedSplits = splitsWithWriteOff.map(p => {
        if (p.method === 'Card' && p.cardBrand) {
          return {
            ...p,
            referenceNumber: p.referenceNumber ? `${p.cardBrand} - ${p.referenceNumber}` : p.cardBrand
          };
        }
        if (p.method === 'Cash') {
          const amtRecv = p.amountReceived !== '' && p.amountReceived !== undefined && p.amountReceived !== null ? parseFloat(p.amountReceived) : p.amount;
          const change = amtRecv - p.amount;
          return {
            ...p,
            referenceNumber: `Recv:${formatCurrency(amtRecv)},Change:${formatCurrency(change)}`
          };
        }
        return p;
      });
      const res = await checkout(formattedSplits, verifiedManagerPin);
      setVerifiedManagerPin(null); // reset after checkout
      setWriteOffAmount(0); // reset write-off after checkout
      setActiveHeldBillNumber(null); // reset resumed bill number
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

  // Print function — opens a dedicated popup window with 80mm thermal CSS
  const handlePrintReceipt = () => {
    const order = completedOrderDetails?.order;
    const items = completedOrderDetails?.items || [];
    const payments = completedOrderDetails?.payments || [];
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
    <div class="sum-row"><span>VAT:</span><span>Rs. ${Number(order.TaxAmount).toFixed(2)}</span></div>
    <div class="sum-total"><span>TOTAL PAID:</span><span>Rs. ${Number(order.TotalAmount).toFixed(2)}</span></div>
  </div>

  <div class="payments">
    <div class="pay-label">Payments:</div>
    ${paymentsHtml}
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
  <script>
    function closeWindow() {
      try {
        if (window.opener) {
          window.opener.postMessage("receipt-printed-done", "*");
        }
      } catch(e) {}
      window.close();
    }
    window.onload = function() {
      window.focus();
      setTimeout(function() {
        if ('onafterprint' in window) {
          window.onafterprint = closeWindow;
          window.print();
        } else {
          window.print();
          setTimeout(closeWindow, 500);
        }
      }, 300);
    };
  </script>
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
  };

  // Calculate cash change or balance due
  const cashSplits = paymentSplits.filter(p => p.method === 'Cash');
  const hasCashPayment = cashSplits.length > 0;
  const totalCashAmount = cashSplits.reduce((sum, p) => sum + p.amount, 0);
  const totalCashReceived = cashSplits.reduce((sum, p) => sum + (parseFloat(p.amountReceived) || 0), 0);
  const cashReceivedEntered = cashSplits.some(p => p.amountReceived !== '' && p.amountReceived !== undefined && p.amountReceived !== null);

  // Filter products locally for instantaneous responsiveness
  const filteredProducts = products.filter(p => {
    if (p.IsActive === false || p.IsActive === 0) return false;
    // Global search: ignore category filter when a search query is active
    const matchesCategory = (selectedCategory && !searchQuery) ? p.CategoryID === selectedCategory : true;
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
          {/* Unified Global Search & Barcode Scanner */}
          <form onSubmit={handleSearchSubmit} style={{ flex: 1 }}>
            <div className="search-box-container" style={{ position: 'relative', width: '100%' }}>
              <Search className="search-icon" size={18} />
              <input
                ref={barcodeInputRef}
                type="text"
                className="form-input pos-search"
                style={{ width: '100%' }}
                placeholder={showDayStartModal ? "Please enter opening cash balance..." : "Search name, SKU, or scan barcode..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                disabled={showDayStartModal}
              />
            </div>
          </form>

          {/* Top Middle Nice Colored Button */}
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <button 
              className="btn" 
              style={{ 
                background: drawerSession 
                  ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' 
                  : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', 
                color: 'white', 
                fontWeight: '600',
                fontSize: '13px',
                padding: '8px 16px',
                borderRadius: '30px',
                boxShadow: drawerSession 
                  ? '0 4px 12px rgba(16, 185, 129, 0.2)' 
                  : '0 4px 12px rgba(245, 158, 11, 0.2)',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
              onClick={() => drawerSession ? setShowDrawerDetailsModal(true) : setShowDayStartModal(true)}
            >
              <DollarSign size={15} />
              <span>{drawerSession ? `Drawer Open: Rs. ${drawerSession.OpeningBalance.toLocaleString('en-LK', { minimumFractionDigits: 2 })}` : 'Opening Balance Pending'}</span>
            </button>
          </div>

          {/* Suspended orders button */}
          <button 
            className="btn btn-secondary" 
            style={{ position: 'relative', display: 'flex', gap: '8px' }}
            onClick={() => setShowHeldDrawer(true)}
            disabled={showDayStartModal}
          >
            <FolderMinus size={18} />
            <span>Held ({heldSales.length})</span>
          </button>

          {/* Top Right Shift Status Button */}
          <button
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
            onClick={() => drawerSession ? setShowDrawerDetailsModal(true) : setShowDayStartModal(true)}
          >
            <Clock size={15} />
            <span>Drawer Status</span>
          </button>
        </div>

        {/* Category Tabs */}
        <div className="category-tabs">
          <button 
            className={`category-tab ${selectedCategory === null && !searchQuery ? 'active' : ''}`}
            onClick={() => {
              setSelectedCategory(null);
              setSearchQuery('');
            }}
          >
            All Products
          </button>
          {categories.map((c) => (
            <button
              key={c.CategoryID}
              className={`category-tab ${selectedCategory === c.CategoryID && !searchQuery ? 'active' : ''}`}
              onClick={() => {
                setSelectedCategory(c.CategoryID);
                setSearchQuery('');
              }}
            >
              {c.Name}
            </button>
          ))}
        </div>

        {searchQuery && (
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px', padding: '0 4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Showing results for "<strong>{searchQuery}</strong>" across all categories (Global Search)</span>
            <button 
              onClick={() => setSearchQuery('')}
              style={{ fontSize: '11px', background: 'none', border: 'none', color: 'var(--text-primary)', textDecoration: 'underline', cursor: 'pointer', padding: 0 }}
            >
              Clear
            </button>
          </div>
        )}

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
              const isDisabled = (remainingStock <= 0 && !allowNegativeStock) || expiryBlocked;
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
                      <div className="product-price">Rs. {formatCurrency(p.Price)} / {p.UOM || 'pcs'}</div>
                      <div className={`product-stock ${remainingStock <= 0 || expiryBlocked ? 'out-of-stock' : remainingStock <= p.LowStockThreshold ? 'low-stock' : ''}`}>
                        {expiryBlocked ? 'Expired' : remainingStock <= 0 ? `Out of Stock (${Number(remainingStock)})` : `${Number(remainingStock)} ${p.UOM || 'pcs'} left`}
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
        <div className="cart-header" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <div className="cart-title">
              <ShoppingCart size={20} />
              <span>Active Billing</span>
              {cartItems.length > 0 && <span className="cart-badge">{cartItems.reduce((s,i)=>s+i.quantity,0)} items</span>}
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                className="btn btn-secondary"
                style={{
                  fontSize: '11px',
                  padding: '4px 8px',
                  height: 'auto',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: 'var(--text-secondary)'
                }}
                onClick={() => setShowProfit(!showProfit)}
                title={showProfit ? "Hide Profit Margins" : "View Profit Margins"}
              >
                {showProfit ? <EyeOff size={13} /> : <Eye size={13} />}
                <span>{showProfit ? "Hide Profit" : "View Profit"}</span>
              </button>
              <button 
                className="btn btn-secondary btn-icon" 
                style={{ color: 'var(--text-muted)', border: 'none', background: 'transparent' }}
                onClick={handleClearCart}
                title="Clear Cart"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
          {activeHeldBillNumber && (
            <div style={{
              background: 'rgba(245, 158, 11, 0.15)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              color: '#fbbf24',
              fontSize: '11px',
              padding: '4px 8px',
              borderRadius: '4px',
              fontWeight: '600',
              alignSelf: 'flex-start'
            }}>
              Resumed Bill: {activeHeldBillNumber}
            </div>
          )}
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
                    <div className="cart-item-name">
                      {item.name}
                      {item.variantName && (
                        <span style={{
                          marginLeft: '6px', fontSize: '10px', fontWeight: '700',
                          background: 'rgba(139,92,246,0.18)', color: 'var(--primary)',
                          border: '1px solid rgba(139,92,246,0.3)',
                          padding: '1px 7px', borderRadius: '10px', verticalAlign: 'middle'
                        }}>{item.variantName}</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      {item.originalPrice && Number(item.originalPrice) !== Number(item.price) ? (
                        <>
                          <span style={{ textDecoration: 'line-through', color: 'var(--text-muted)', fontSize: '11px' }}>
                            Rs. {formatCurrency(item.originalPrice)}
                          </span>
                          <span className="cart-item-price" style={{ color: '#f59e0b' }}>
                            Rs. {formatCurrency(item.price)} / {dbProduct.UOM || 'pcs'}
                          </span>
                        </>
                      ) : (
                        <span className="cart-item-price">Rs. {formatCurrency(item.price)} / {dbProduct.UOM || 'pcs'}</span>
                      )}
                      <button
                        title="Edit Price"
                        onClick={() => openOverrideModal(item)}
                        style={{
                          background: 'rgba(139, 92, 246, 0.15)',
                          border: '1px solid rgba(139, 92, 246, 0.3)',
                          color: 'var(--primary)',
                          borderRadius: '5px',
                          padding: '2px 7px',
                          fontSize: '10px',
                          cursor: 'pointer',
                          fontWeight: '600',
                          lineHeight: 1.4,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <DollarSign size={10} /> Edit
                      </button>
                    </div>
                    {showProfit && (
                      <div style={{
                        display: 'flex',
                        gap: '12px',
                        fontSize: '11px',
                        color: 'var(--text-secondary)',
                        background: 'rgba(255, 255, 255, 0.03)',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        marginTop: '6px',
                        border: '1px dashed rgba(255, 255, 255, 0.05)',
                        width: 'fit-content'
                      }}>
                        <span>Cost: Rs. {formatCurrency(item.cost)}</span>
                        <span>Profit: <span style={{ color: (item.price - item.cost) >= 0 ? '#10b981' : '#ef4444', fontWeight: '500' }}>
                          Rs. {formatCurrency(item.price - item.cost)}
                        </span></span>
                        <span>Margin: <span style={{ color: (item.price - item.cost) >= 0 ? '#10b981' : '#ef4444', fontWeight: '600' }}>
                          {item.price > 0 ? (((item.price - item.cost) / item.price) * 100).toFixed(2) : '0.00'}%
                        </span></span>
                      </div>
                    )}
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
                      allowNegativeStock={allowNegativeStock}
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
                    VIP Points: {attachedCustomer.LoyaltyPoints} | Credit Limit: Rs. {formatCurrency(attachedCustomer.CreditLimit)}
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
                <option value="">Walk-in Customer (Default)</option>
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
            <span className="mono">Rs. {formatCurrency(subtotal)}</span>
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
            <span>VAT</span>
            <span className="mono">Rs. {formatCurrency(taxAmount)}</span>
          </div>

          <div className="summary-row total">
            <span>Total Due</span>
            <span className="total-amount">Rs. {formatCurrency(totalAmount)}</span>
          </div>

          {showProfit && cartItems.length > 0 && (() => {
            const totalCost = cartItems.reduce((sum, item) => sum + (item.cost * item.quantity), 0);
            const netRevenue = Math.max(0, subtotal - discountAmount);
            const totalProfit = netRevenue - totalCost;
            const overallMargin = netRevenue > 0 ? (totalProfit / netRevenue) * 100 : 0;
            return (
              <div style={{
                background: 'rgba(139, 92, 246, 0.08)',
                border: '1px solid rgba(139, 92, 246, 0.15)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px 12px',
                marginTop: '12px',
                marginBottom: '4px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                fontSize: '12px',
                textAlign: 'left'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Total Cost Price</span>
                  <span className="mono" style={{ fontWeight: '600' }}>Rs. {formatCurrency(totalCost)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Total Profit Amount</span>
                  <span className="mono" style={{ fontWeight: '600', color: totalProfit >= 0 ? '#10b981' : '#ef4444' }}>
                    Rs. {formatCurrency(totalProfit)}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed rgba(255,255,255,0.1)', paddingTop: '6px', marginTop: '2px' }}>
                  <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>Overall Profit Margin</span>
                  <span className="mono" style={{ fontWeight: '700', color: totalProfit >= 0 ? '#10b981' : '#ef4444' }}>
                    {overallMargin.toFixed(2)}%
                  </span>
                </div>
              </div>
            );
          })()}

          <div className="cart-actions">
            <button 
              className="btn btn-secondary" 
              onClick={handleHoldSaleDirectly}
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
         DRAWER: HELD ORDERS
         ============================================================================ */}
      {showHeldDrawer && (
        <div className="modal-overlay" onClick={() => setShowHeldDrawer(false)}>
          <div 
            className="modal-content" 
            style={{ width: '480px', height: '100vh', margin: 0, position: 'fixed', right: 0, top: 0, bottom: 0, borderRadius: 0, display: 'flex', flexDirection: 'column' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Held Bills</span>
              <button style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '20px' }} onClick={() => setShowHeldDrawer(false)}>✕</button>
            </h3>

            {/* Held Bills Search */}
            <div style={{ marginBottom: '16px' }}>
              <input
                type="text"
                className="form-input"
                placeholder="Search by Bill Number..."
                value={heldSearchQuery}
                onChange={(e) => setHeldSearchQuery(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>

            {(() => {
              const filteredHeldSales = heldSales.filter(h => 
                h.HeldBillNumber && h.HeldBillNumber.toLowerCase().includes(heldSearchQuery.toLowerCase())
              );

              if (filteredHeldSales.length === 0) {
                return <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '40px' }}>No matching hold bills found.</p>;
              }

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', flex: 1, paddingRight: '4px' }}>
                  {filteredHeldSales.map((held) => (
                    <div key={held.OrderID} style={{
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid var(--border-color)',
                      padding: '16px',
                      borderRadius: 'var(--radius-md)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{held.HeldBillNumber}</span>
                        <span className="mono" style={{ color: 'var(--accent)', fontWeight: '600' }}>Rs. {formatCurrency(held.TotalAmount)}</span>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <div>Time: {new Date(held.OrderDate).toLocaleTimeString()} ({new Date(held.OrderDate).toLocaleDateString()})</div>
                        <div>Cashier: <strong style={{ color: 'var(--text-primary)' }}>{held.CashierName || 'System'}</strong></div>
                      </div>
                      <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                        <button 
                          className="btn btn-primary" 
                          style={{ flex: 1, padding: '6px 12px', fontSize: '12px' }}
                          onClick={() => handleResumeSaleClick(held)}
                        >
                          Resume
                        </button>
                        <button 
                          className="btn btn-secondary" 
                          style={{ flex: 1, padding: '6px 12px', fontSize: '12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', color: '#fca5a5' }}
                          onClick={() => handleCancelHeldSaleClick(held)}
                        >
                          Cancel Bill
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
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
              <span className="mono" style={{ color: 'var(--accent)' }}>Total: Rs. {formatCurrency(totalAmount)}</span>
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
                <div key={idx} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', background: 'rgba(0,0,0,0.15)', padding: '12px', borderRadius: 'var(--radius-md)' }}>
                  
                  {/* Select Payment Method */}
                  <div style={{ flex: 1.2, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>METHOD</label>
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
                    {p.method === 'Card' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
                        <span style={{ fontSize: '9px', color: 'var(--text-secondary)', fontWeight: '700', letterSpacing: '0.5px' }}>CARD BRAND</span>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <button
                            type="button"
                            onClick={() => updateSplitField(idx, 'cardBrand', 'Visa')}
                            style={{
                              background: 'none',
                              border: p.cardBrand === 'Visa' ? '2.5px solid var(--primary)' : '2.5px solid transparent',
                              borderRadius: '5px',
                              padding: '2px',
                              cursor: 'pointer',
                              transition: 'all 0.18s ease',
                              transform: p.cardBrand === 'Visa' ? 'scale(1.08)' : 'scale(1)',
                              boxShadow: p.cardBrand === 'Visa' ? '0 0 10px var(--primary)' : 'none',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                            title="Visa"
                          >
                            <VisaLogo />
                          </button>
                          
                          <button
                            type="button"
                            onClick={() => updateSplitField(idx, 'cardBrand', 'Mastercard')}
                            style={{
                              background: 'none',
                              border: p.cardBrand === 'Mastercard' ? '2.5px solid var(--primary)' : '2.5px solid transparent',
                              borderRadius: '5px',
                              padding: '2px',
                              cursor: 'pointer',
                              transition: 'all 0.18s ease',
                              transform: p.cardBrand === 'Mastercard' ? 'scale(1.08)' : 'scale(1)',
                              boxShadow: p.cardBrand === 'Mastercard' ? '0 0 10px var(--primary)' : 'none',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                            title="Mastercard"
                          >
                            <MastercardLogo />
                          </button>

                          <button
                            type="button"
                            onClick={() => updateSplitField(idx, 'cardBrand', 'Amex')}
                            style={{
                              background: 'none',
                              border: p.cardBrand === 'Amex' ? '2.5px solid var(--primary)' : '2.5px solid transparent',
                              borderRadius: '5px',
                              padding: '2px',
                              cursor: 'pointer',
                              transition: 'all 0.18s ease',
                              transform: p.cardBrand === 'Amex' ? 'scale(1.08)' : 'scale(1)',
                              boxShadow: p.cardBrand === 'Amex' ? '0 0 10px var(--primary)' : 'none',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                            title="Amex"
                          >
                            <AmexLogo />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Input Amount */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>AMOUNT (Rs.)</label>
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

                  {/* Reference Number / Amount Received */}
                  <div style={{ flex: 1.5, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {p.method === 'Cash' ? (
                      <>
                        <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>AMOUNT RECEIVED (Rs.)</label>
                        <input
                          type="number"
                          className="form-input mono"
                          style={{ padding: '8px 12px', fontSize: '13px' }}
                          placeholder="0.00"
                          value={p.amountReceived !== undefined ? p.amountReceived : ''}
                          onChange={(e) => updateSplitField(idx, 'amountReceived', e.target.value)}
                          step="0.01"
                          min="0"
                        />
                      </>
                    ) : (
                      <>
                        <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>REF / SLIP NO</label>
                        <input
                          type="text"
                          className="form-input"
                          style={{ padding: '8px 12px', fontSize: '13px' }}
                          placeholder="Txn ID, Terminal Ref"
                          value={p.referenceNumber}
                          onChange={(e) => updateSplitField(idx, 'referenceNumber', e.target.value)}
                        />
                      </>
                    )}
                  </div>

                  {/* Delete button if split count > 1 */}
                  {paymentSplits.length > 1 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px', visibility: 'hidden', userSelect: 'none' }}>DEL</label>
                      <button 
                        className="btn btn-danger btn-icon"
                        style={{ width: '38px', height: '38px', borderRadius: 'var(--radius-md)' }}
                        onClick={() => removePaymentSplit(idx)}
                      >
                        ✕
                      </button>
                    </div>
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

            {/* Round-off Adjustment (Write-off) */}
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px dashed rgba(255,255,255,0.08)', marginTop: '8px', marginBottom: '12px' }}>
              <div style={{ flex: 1, textAlign: 'left' }}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)' }}>ROUND-OFF ADJUSTMENT (WRITE-OFF)</span>
                <p style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '2px' }}>Write off small decimal balances (e.g. 0.05, 1.00) from the client due amount.</p>
              </div>
              <div style={{ width: '120px' }}>
                <input
                  type="number"
                  className="form-input mono"
                  style={{ padding: '8px 12px', fontSize: '13.5px', textAlign: 'right', fontWeight: '600', color: '#f59e0b' }}
                  placeholder="0.00"
                  value={writeOffAmount || ''}
                  onChange={handleWriteOffChange}
                  step="0.01"
                  min="0"
                />
              </div>
            </div>

            {/* Calculations info */}
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13.5px', color: 'var(--text-secondary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Paid (Splits Total):</span>
                <span className="mono">Rs. {formatCurrency(paymentSplits.reduce((s,p)=>s+p.amount,0))}</span>
              </div>
              {parseFloat(writeOffAmount || 0) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#f59e0b' }}>
                  <span>Round-off Write-off:</span>
                  <span className="mono">-Rs. {formatCurrency(parseFloat(writeOffAmount))}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed rgba(255,255,255,0.08)', paddingTop: '6px', marginTop: '2px' }}>
                <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>Total Payments Aggregated:</span>
                <span className="mono" style={{
                  fontWeight: '700',
                  color: Math.abs(paymentSplits.reduce((s,p)=>s+p.amount,0) + parseFloat(writeOffAmount || 0) - totalAmount) < 0.01 ? 'var(--success)' : 'var(--danger)'
                }}>
                  Rs. {formatCurrency(paymentSplits.reduce((s,p)=>s+p.amount,0) + parseFloat(writeOffAmount || 0))} / Rs. {formatCurrency(totalAmount)}
                </span>
              </div>
            </div>

            {/* Real-time Cash Change / Balance Due Display */}
            {hasCashPayment && cashReceivedEntered && (
              <div style={{
                marginTop: '16px',
                padding: '12px 16px',
                borderRadius: 'var(--radius-md)',
                background: totalCashReceived >= totalCashAmount ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                border: totalCashReceived >= totalCashAmount ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                    CASH RECEIVED TOTAL:
                  </span>
                  <span className="mono" style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)' }}>
                    Rs. {formatCurrency(totalCashReceived)}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px dashed rgba(255,255,255,0.1)', paddingTop: '8px' }}>
                  {totalCashReceived >= totalCashAmount ? (
                    <>
                      <span style={{ fontSize: '13px', fontWeight: '700', color: '#10b981' }}>
                        CHANGE BALANCE:
                      </span>
                      <span className="mono" style={{ fontSize: '18px', fontWeight: '800', color: '#10b981' }}>
                        Rs. {formatCurrency(totalCashReceived - totalCashAmount)}
                      </span>
                    </>
                  ) : (
                    <>
                      <span style={{ fontSize: '13px', fontWeight: '700', color: '#ef4444' }}>
                        BALANCE DUE:
                      </span>
                      <span className="mono" style={{ fontSize: '18px', fontWeight: '800', color: '#ef4444' }}>
                        Rs. {formatCurrency(totalCashAmount - totalCashReceived)}
                      </span>
                    </>
                  )}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
              <button className="btn btn-secondary" onClick={() => setShowCheckoutModal(false)}>Close</button>
              <button 
                className="btn btn-primary"
                onClick={handleCheckoutSubmit}
                disabled={Math.abs(paymentSplits.reduce((s,p)=>s+p.amount,0) + parseFloat(writeOffAmount || 0) - totalAmount) > 0.01 || !!discountError}
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
                  <span>Rs. {formatCurrency(completedOrderDetails.order.Subtotal)}</span>
                </div>
                {Number(completedOrderDetails.order.DiscountAmount) > 0 && (
                  <div className="receipt-summary-row">
                    <span>Discount:</span>
                    <span>-Rs. {formatCurrency(completedOrderDetails.order.DiscountAmount)}</span>
                  </div>
                )}
                <div className="receipt-summary-row">
                  <span>VAT:</span>
                  <span>Rs. {formatCurrency(completedOrderDetails.order.TaxAmount)}</span>
                </div>
                <div className="receipt-summary-row total">
                  <span>TOTAL PAID:</span>
                  <span>Rs. {formatCurrency(completedOrderDetails.order.TotalAmount)}</span>
                </div>
              </div>

              <div style={{ fontSize: '11px', borderTop: '1px dashed #000', paddingTop: '6px' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Payments:</div>
                {completedOrderDetails.payments.map((p, i) => {
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
                <p style={{ marginTop: '8px', fontSize: '9px', opacity: 0.8 }}>System powered by SellMax Pro POS</p>
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

      {/* ============================================================================
         MODAL: PRICE OVERRIDE
         ============================================================================ */}
      {showOverrideModal && overrideItem && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: '420px' }}>
            <h3 style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <DollarSign size={20} style={{ color: 'var(--primary)' }} />
              Edit Item Price
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
              Modify the selling price for <strong>{overrideItem.name}</strong> on this transaction.
            </p>

            <div className="form-group">
              <label className="form-label">Original Price</label>
              <div style={{ fontSize: '14px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', padding: '8px 0' }}>
                Rs. {formatCurrency(overrideItem.dbProduct?.Price ?? overrideItem.price)}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">New Price (Rs.)</label>
              <input
                type="number"
                className="form-input mono"
                placeholder="Enter new price"
                value={overridePriceVal}
                onChange={(e) => {
                  setOverridePriceVal(e.target.value);
                  setOverrideError('');
                }}
                step="0.01"
                min="0.01"
                autoFocus
              />
            </div>

            {/* Show PIN field if the new price would require manager approval */}
            {(() => {
              const np = parseFloat(overridePriceVal);
              const needsPin = !isNaN(np) && checkOverrideNeedsPin(np, overrideItem?.dbProduct);
              return needsPin ? (
                <div className="form-group" style={{ marginTop: '4px' }}>
                  <label className="form-label" style={{ color: 'var(--warning)' }}>
                    ⚠ Manager PIN Required
                  </label>
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px', lineHeight: 1.4 }}>
                    This price exceeds the allowed discount limit. A manager PIN is needed to authorize.
                  </p>
                  <input
                    type="password"
                    className="form-input"
                    placeholder="Enter manager PIN"
                    value={overridePin}
                    onChange={(e) => { setOverridePin(e.target.value); setOverrideError(''); }}
                    maxLength={8}
                  />
                </div>
              ) : null;
            })()}

            {overrideError && (
              <div style={{
                background: 'var(--danger-bg)', border: '1px solid rgba(239, 68, 68, 0.2)',
                padding: '10px 12px', borderRadius: 'var(--radius-sm)',
                color: '#fca5a5', fontSize: '12px', marginTop: '8px'
              }}>
                {overrideError}
              </div>
            )}

            {/* Savings preview */}
            {(() => {
              const np = parseFloat(overridePriceVal);
              const origP = overrideItem.dbProduct?.Price ?? overrideItem.price;
              if (!isNaN(np) && np !== origP) {
                const diff = origP - np;
                const pct = (Math.abs(diff) / origP * 100).toFixed(1);
                return (
                  <div style={{
                    marginTop: '12px', padding: '10px 12px', borderRadius: 'var(--radius-sm)',
                    background: diff > 0 ? 'rgba(245, 158, 11, 0.08)' : 'rgba(16, 185, 129, 0.08)',
                    border: diff > 0 ? '1px solid rgba(245,158,11,0.2)' : '1px solid rgba(16,185,129,0.2)',
                    fontSize: '12px', display: 'flex', justifyContent: 'space-between'
                  }}>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      {diff > 0 ? '📉 Price Reduction' : '📈 Price Increase'}
                    </span>
                    <strong style={{ color: diff > 0 ? '#f59e0b' : '#10b981' }}>
                      {diff > 0 ? '-' : '+'}Rs. {formatCurrency(Math.abs(diff))} ({pct}%)
                    </strong>
                  </div>
                );
              }
              return null;
            })()}

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
              <button className="btn btn-secondary" onClick={() => setShowOverrideModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleOverrideSubmit}>
                <DollarSign size={15} /> Apply Price
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================================
         MODAL: DAY START / CASH DRAWER OPENING BALANCE
         ============================================================================ */}
      {showDayStartModal && (
        <div className="modal-overlay" style={{ zIndex: 99999 }}>
          <div className="modal-content" style={{ width: '500px', padding: '32px' }}>
            <h3 style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'center', fontSize: '20px', fontWeight: '800' }}>
              <DollarSign size={24} style={{ color: 'var(--success)' }} />
              Day Start / Cash Drawer Opening
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '24px', textAlign: 'center' }}>
              Initialize the cash drawer with the starting cash balance.
            </p>

            {/* Display Meta Information */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '16px',
              marginBottom: '20px',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '12px',
              fontSize: '13px'
            }}>
              <div>
                <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Cashier Name</span>
                <strong style={{ color: 'var(--text-primary)' }}>{user?.username || 'Cashier'}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>POS Terminal</span>
                <input 
                  type="text" 
                  className="form-input" 
                  style={{ padding: '4px 8px', fontSize: '12.5px', marginTop: '4px', background: 'rgba(0,0,0,0.3)' }}
                  value={terminalId}
                  onChange={(e) => setTerminalId(e.target.value)}
                />
              </div>
              <div>
                <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Date & Time</span>
                <strong style={{ color: 'var(--text-primary)' }}>{new Date().toLocaleString('en-LK')}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status</span>
                <span style={{ color: 'var(--warning)', fontWeight: 'bold' }}>Pending Opening</span>
              </div>
            </div>

            {/* Tab/Mode Switcher */}
            <div style={{
              display: 'flex',
              background: 'rgba(255, 255, 255, 0.02)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
              marginBottom: '20px',
              padding: '4px'
            }}>
              <button
                type="button"
                className="btn"
                style={{
                  flex: 1,
                  padding: '8px 0',
                  background: dayStartMode === 'denominations' ? 'var(--primary)' : 'transparent',
                  color: 'white',
                  border: 'none',
                  fontSize: '13px',
                  borderRadius: 'var(--radius-sm)'
                }}
                onClick={() => setDayStartMode('denominations')}
              >
                Denominations Counter
              </button>
              <button
                type="button"
                className="btn"
                style={{
                  flex: 1,
                  padding: '8px 0',
                  background: dayStartMode === 'direct' ? 'var(--primary)' : 'transparent',
                  color: 'white',
                  border: 'none',
                  fontSize: '13px',
                  borderRadius: 'var(--radius-sm)'
                }}
                onClick={() => setDayStartMode('direct')}
              >
                Direct Total Entry
              </button>
            </div>

            {dayStartMode === 'denominations' ? (
              <div>
                <div style={{ 
                  maxHeight: '220px', 
                  overflowY: 'auto', 
                  background: 'rgba(0,0,0,0.2)', 
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)', 
                  padding: '12px',
                  marginBottom: '16px' 
                }}>
                  {[5000, 2000, 1000, 500, 100, 50, 20, 10, 5].map((denom) => (
                    <div key={denom} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '13.5px', fontFamily: 'var(--font-mono)', minWidth: '80px' }}>Rs. {denom.toLocaleString()}</span>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>x</span>
                      <input
                        type="number"
                        className="form-input"
                        style={{ width: '80px', padding: '6px 10px', fontSize: '13px', textAlign: 'center', margin: '0 12px' }}
                        min="0"
                        placeholder="0"
                        value={dayStartDenoms[denom] || ''}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10) || 0;
                          setDayStartDenoms(prev => ({ ...prev, [denom]: val }));
                        }}
                      />
                      <span style={{ fontSize: '13.5px', fontFamily: 'var(--font-mono)', minWidth: '100px', textAlign: 'right', color: 'var(--accent)' }}>
                        Rs. {((dayStartDenoms[denom] || 0) * denom).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 16px',
                  background: 'rgba(16, 185, 129, 0.05)',
                  border: '1px dashed rgba(16, 185, 129, 0.2)',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: '20px'
                }}>
                  <span style={{ fontSize: '14px', fontWeight: '600' }}>Calculated Total:</span>
                  <strong style={{ fontSize: '18px', color: 'var(--success)', fontFamily: 'var(--font-mono)' }}>
                    Rs. {Object.entries(dayStartDenoms).reduce((sum, [denom, count]) => sum + (Number(denom) * (Number(count) || 0)), 0).toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                  </strong>
                </div>
              </div>
            ) : (
              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label">Opening Cash Amount (Rs.)</label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="Enter starting cash balance directly"
                  style={{ fontSize: '16px', fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}
                  value={dayStartDirectAmt}
                  onChange={(e) => setDayStartDirectAmt(e.target.value)}
                  min="0"
                  step="0.01"
                />
              </div>
            )}

            {dayStartError && (
              <div style={{
                background: 'var(--danger-bg)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                padding: '10px 12px',
                borderRadius: 'var(--radius-sm)',
                color: '#fca5a5',
                fontSize: '12.5px',
                marginBottom: '16px',
                textAlign: 'center'
              }}>
                {dayStartError}
              </div>
            )}

            <button
              type="button"
              className="btn btn-primary"
              style={{ width: '100%', padding: '12px', fontSize: '14px' }}
              onClick={handleDayStartSubmit}
              disabled={dayStartSubmitting}
            >
              {dayStartSubmitting ? 'Opening Cash Drawer...' : 'Start Day & Open Drawer'}
            </button>
          </div>
        </div>
      )}

      {/* ============================================================================
         MODAL: ACTIVE DRAWER SESSION DETAILS
         ============================================================================ */}
      {showDrawerDetailsModal && drawerSession && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ width: '450px', padding: '32px' }}>
            <h3 style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'center', fontSize: '18px', fontWeight: 'bold' }}>
              <DollarSign size={22} style={{ color: 'var(--success)' }} />
              Active Cash Drawer Session
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '20px', textAlign: 'center' }}>
              Starting details of the current cash drawer shift.
            </p>

            <div style={{
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '16px',
              fontSize: '13.5px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Cashier Name:</span>
                <strong style={{ color: 'var(--text-primary)' }}>{user?.username || 'Cashier'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>POS Terminal:</span>
                <strong style={{ color: 'var(--text-primary)' }}>{drawerSession.TerminalID}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Opened Time:</span>
                <strong style={{ color: 'var(--text-primary)' }}>{new Date(drawerSession.OpeningTime).toLocaleString('en-LK')}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Opening Balance:</span>
                <strong style={{ color: 'var(--success)', fontFamily: 'var(--font-mono)' }}>
                  Rs. {drawerSession.OpeningBalance.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                </strong>
              </div>
              {drawerSession.OpeningDenominations && (
                <div style={{ marginTop: '8px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                  <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '8px', fontSize: '12.5px', fontWeight: 'bold' }}>Denominations Breakdown:</span>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '12px', background: 'rgba(0,0,0,0.15)', padding: '8px 12px', borderRadius: 'var(--radius-sm)' }}>
                    {Object.entries(JSON.parse(drawerSession.OpeningDenominations)).map(([denom, count]) => {
                      if (Number(count) === 0) return null;
                      return (
                        <div key={denom} style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontFamily: 'var(--font-mono)' }}>Rs. {denom} x {count}</span>
                          <span style={{ color: 'var(--accent)' }}>Rs. {(Number(denom)*Number(count)).toLocaleString()}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', justifyContent: 'center', marginTop: '24px' }}>
              <button className="btn btn-danger" style={{ width: '100%', background: 'var(--danger)', color: 'white', border: 'none' }} onClick={() => { setShowDrawerDetailsModal(false); setShowDayEndWizard(true); }}>
                Perform Day-End Closing & Close Session
              </button>
              <button className="btn btn-secondary" style={{ width: '100%' }} onClick={() => setShowDrawerDetailsModal(false)}>Close View</button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
         MODAL: PRICE VARIANT PICKER
         ============================================================ */}
      {showVariantPicker && variantPickerProduct && (() => {
        const activeVariants = (variantsByProduct[variantPickerProduct.ProductID] || []).filter(v => v.IsActive);
        return (
          <div className="modal-overlay" onClick={() => { setShowVariantPicker(false); setVariantPickerProduct(null); }}>
            <div className="modal-content" style={{ width: '480px', maxWidth: '95vw' }} onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: '700', margin: 0 }}>Select Price Variant</h3>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '4px 0 0' }}>
                      {variantPickerProduct.Name}
                    </p>
                  </div>
                  <button
                    onClick={() => { setShowVariantPicker(false); setVariantPickerProduct(null); }}
                    style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '18px', lineHeight: 1, padding: '4px' }}
                  >✕</button>
                </div>
                <div style={{ height: '2px', background: 'linear-gradient(90deg, var(--primary), transparent)', borderRadius: '2px', marginTop: '12px' }} />
              </div>

              {/* Variant list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '60vh', overflowY: 'auto', paddingRight: '4px' }}>
                {activeVariants.map(v => (
                  <button
                    key={v.VariantID}
                    data-no-refocus
                    onClick={() => addVariantToCart(variantPickerProduct, v)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '14px 18px', borderRadius: 'var(--radius-md)',
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid var(--border-color)',
                      cursor: 'pointer', transition: 'all 0.18s ease',
                      textAlign: 'left', width: '100%'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(139,92,246,0.12)'; e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <span style={{ fontWeight: '700', fontSize: '15px', color: 'white' }}>{v.VariantName}</span>
                      {v.Barcode && (
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                          Barcode: {v.Barcode}
                        </span>
                      )}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--accent)', fontFamily: 'monospace' }}>
                        Rs. {Number(v.Price).toFixed(2)}
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {/* Cancel */}
              <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'center' }}>
                <button
                  className="btn btn-secondary"
                  style={{ width: '100%', padding: '10px', fontSize: '13px' }}
                  onClick={() => { setShowVariantPicker(false); setVariantPickerProduct(null); }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {showDayEndWizard && (
        <DayEndReconciliation 
          onClose={() => setShowDayEndWizard(false)} 
          setToast={setToast} 
          onSessionClosed={() => {
            setShowDayEndWizard(false);
            setDrawerSession(null);
            checkDrawerStatus();
          }} 
        />
      )}

    </div>
  );
}
