import React, { createContext, useState, useContext, useMemo } from 'react';
import { useAuth } from './AuthContext';

const CartContext = createContext(null);

export const CartProvider = ({ children }) => {
  const { token, API_URL } = useAuth();
  const [cartItems, setCartItems] = useState([]);
  const [attachedCustomer, setAttachedCustomer] = useState(null);
  const [discountAmount, setDiscountAmount] = useState(0);
  const taxRate = 0.10; // Fixed 10% standard tax

  const addToCart = (product) => {
    setCartItems((prevItems) => {
      const existing = prevItems.find((item) => item.productId === product.ProductID);
      if (existing) {
        if (existing.quantity >= product.Stock) {
          throw new Error(`Cannot add more. Only ${product.Stock} ${product.UOM || 'pcs'} of '${product.Name}' are in stock.`);
        }
        return prevItems.map((item) =>
          item.productId === product.ProductID
            ? { ...item, quantity: item.quantity + 1, subtotal: Number(((item.quantity + 1) * item.price).toFixed(2)) }
            : item
        );
      } else {
        if (product.Stock <= 0) {
          throw new Error(`'${product.Name}' is out of stock.`);
        }
        return [
          ...prevItems,
          {
            productId: product.ProductID,
            name: product.Name,
            sku: product.SKU,
            barcode: product.Barcode,
            price: product.Price,
            cost: product.Cost,
            quantity: 1,
            subtotal: product.Price
          }
        ];
      }
    });
  };

  const removeFromCart = (productId) => {
    setCartItems((prevItems) => prevItems.filter((item) => item.productId !== productId));
  };

  const updateQuantity = (productId, quantity, maxStock) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    if (quantity > maxStock) {
      throw new Error(`Cannot adjust quantity to ${quantity}. Only ${maxStock} are in stock.`);
    }

    setCartItems((prevItems) =>
      prevItems.map((item) =>
        item.productId === productId
          ? { ...item, quantity, subtotal: Number((quantity * item.price).toFixed(2)) }
          : item
      )
    );
  };

  const setCustomer = (customer) => {
    setAttachedCustomer(customer);
  };

  const applyDiscount = (amount) => {
    setDiscountAmount(Math.max(0, Number(amount)));
  };

  const clearCart = () => {
    setCartItems([]);
    setAttachedCustomer(null);
    setDiscountAmount(0);
  };

  // Calculations
  const subtotal = useMemo(() => {
    return Number(cartItems.reduce((sum, item) => sum + item.subtotal, 0).toFixed(2));
  }, [cartItems]);

  const taxAmount = useMemo(() => {
    const discounted = Math.max(0, subtotal - discountAmount);
    return Number((discounted * taxRate).toFixed(2));
  }, [subtotal, discountAmount]);

  const totalAmount = useMemo(() => {
    const discounted = Math.max(0, subtotal - discountAmount);
    return Number((discounted + taxAmount).toFixed(2));
  }, [subtotal, discountAmount, taxAmount]);

  // Checkout API connector
  const checkout = async (payments) => {
    const payload = {
      customerId: attachedCustomer ? attachedCustomer.CustomerID : null,
      subtotal,
      discountAmount,
      taxAmount,
      totalAmount,
      items: cartItems,
      payments
    };

    const res = await fetch(`${API_URL}/api/sales/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Checkout failed.');
    }

    clearCart();
    return data;
  };

  // Suspend/Hold API connector
  const holdSale = async (heldNote) => {
    const payload = {
      customerId: attachedCustomer ? attachedCustomer.CustomerID : null,
      subtotal,
      discountAmount,
      taxAmount,
      totalAmount,
      items: cartItems,
      heldNote
    };

    const res = await fetch(`${API_URL}/api/sales/hold`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Suspend sale failed.');
    }

    clearCart();
    return data;
  };

  // Load a held cart back in
  const resumeSale = (heldOrder) => {
    const items = heldOrder.items.map(item => ({
      productId: item.ProductID,
      name: item.ProductName,
      sku: item.SKU,
      barcode: item.Barcode,
      price: item.Price,
      cost: item.Cost,
      quantity: item.Quantity,
      subtotal: item.Subtotal
    }));

    setCartItems(items);
    setDiscountAmount(heldOrder.order.DiscountAmount);
    if (heldOrder.order.CustomerID) {
      setAttachedCustomer({
        CustomerID: heldOrder.order.CustomerID,
        Name: heldOrder.order.CustomerName
      });
    } else {
      setAttachedCustomer(null);
    }
  };

  return (
    <CartContext.Provider value={{
      cartItems,
      attachedCustomer,
      discountAmount,
      subtotal,
      taxAmount,
      totalAmount,
      addToCart,
      removeFromCart,
      updateQuantity,
      setCustomer,
      applyDiscount,
      clearCart,
      checkout,
      holdSale,
      resumeSale
    }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => useContext(CartContext);
export default CartContext;
