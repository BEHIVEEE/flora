'use client';
import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';

const CartCtx = createContext(null);
export const useCart = () => useContext(CartCtx);

const CartProvider = ({ children }) => {
  const [items, setItems] = useState([]);
  const [userId, setUserId] = useState('guest');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('cs_cart');
      if (raw) setItems(JSON.parse(raw));
      let uid = localStorage.getItem('cs_uid');
      if (!uid) { uid = 'u-' + uuidv4().slice(0, 10); localStorage.setItem('cs_uid', uid); }
      setUserId(uid);
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem('cs_cart', JSON.stringify(items));
  }, [items, hydrated]);

  const addItem = useCallback((product, qty = 1) => {
    setItems(prev => {
      const exists = prev.find(i => i.id === product.id);
      if (exists) return prev.map(i => i.id === product.id ? { ...i, qty: i.qty + qty } : i);
      return [...prev, { id: product.id, name: product.name, price: product.price, mrp: product.mrp, image: product.image, packSize: product.packSize, brand: product.brand, qty }];
    });
  }, []);

  const removeItem = useCallback((id) => setItems(prev => prev.filter(i => i.id !== id)), []);
  const updateQty = useCallback((id, qty) => setItems(prev => qty <= 0 ? prev.filter(i => i.id !== id) : prev.map(i => i.id === id ? { ...i, qty } : i)), []);
  const clear = useCallback(() => setItems([]), []);

  const { subtotal, savings, totalQty } = useMemo(() => {
    let subtotal = 0, savings = 0, totalQty = 0;
    for (const i of items) { subtotal += i.price * i.qty; savings += (i.mrp - i.price) * i.qty; totalQty += i.qty; }
    return { subtotal, savings, totalQty };
  }, [items]);

  const value = { items, addItem, removeItem, updateQty, clear, subtotal, savings, totalQty, userId, hydrated };
  return <CartCtx.Provider value={value}>{children}</CartCtx.Provider>;
};

export default CartProvider;
