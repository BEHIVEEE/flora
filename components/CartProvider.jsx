'use client';
import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from './AuthProvider';

const CartCtx = createContext(null);
export const useCart = () => useContext(CartCtx);

const CartProvider = ({ children }) => {
  const [items, setItems] = useState([]);
  const [guestId, setGuestId] = useState('guest');
  const [hydrated, setHydrated] = useState(false);
  const [rxApproved, setRxApproved] = useState(false);
  const auth = useAuth();
  const userId = auth?.user?.id || guestId;

  useEffect(() => {
    try {
      const raw = localStorage.getItem('cs_cart');
      if (raw) setItems(JSON.parse(raw));
      let uid = localStorage.getItem('cs_uid');
      if (!uid) { uid = 'u-' + uuidv4().slice(0, 10); localStorage.setItem('cs_uid', uid); }
      setGuestId(uid);
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem('cs_cart', JSON.stringify(items));
  }, [items, hydrated]);

  // Check if current user has an approved prescription
  const refreshRxStatus = useCallback(async () => {
    if (!userId || userId === 'guest') { setRxApproved(false); return false; }
    try {
      const res = await fetch(`/api/prescriptions/approved?userId=${encodeURIComponent(userId)}`);
      const d = await res.json();
      setRxApproved(!!d.approved);
      return !!d.approved;
    } catch { setRxApproved(false); return false; }
  }, [userId]);

  useEffect(() => { if (hydrated) refreshRxStatus(); }, [hydrated, refreshRxStatus]);

  const addItem = useCallback((product, qty = 1) => {
    // Gate: prescription-required products need an approved Rx
    if (product?.prescription && !rxApproved) {
      return { ok: false, error: 'rx_required', message: 'This item requires a valid prescription approved by our pharmacist.' };
    }
    setItems(prev => {
      const exists = prev.find(i => i.id === product.id);
      if (exists) return prev.map(i => i.id === product.id ? { ...i, qty: i.qty + qty } : i);
      return [...prev, { id: product.id, name: product.name, price: product.price, mrp: product.mrp, image: product.image, packSize: product.packSize, brand: product.brand, prescription: !!product.prescription, qty }];
    });
    return { ok: true };
  }, [rxApproved]);

  const removeItem = useCallback((id) => setItems(prev => prev.filter(i => i.id !== id)), []);
  const updateQty = useCallback((id, qty) => setItems(prev => qty <= 0 ? prev.filter(i => i.id !== id) : prev.map(i => i.id === id ? { ...i, qty } : i)), []);
  const clear = useCallback(() => setItems([]), []);

  const { subtotal, savings, totalQty } = useMemo(() => {
    let subtotal = 0, savings = 0, totalQty = 0;
    for (const i of items) { subtotal += i.price * i.qty; savings += (i.mrp - i.price) * i.qty; totalQty += i.qty; }
    return { subtotal, savings, totalQty };
  }, [items]);

  const value = { items, addItem, removeItem, updateQty, clear, subtotal, savings, totalQty, userId, hydrated, rxApproved, refreshRxStatus };
  return <CartCtx.Provider value={value}>{children}</CartCtx.Provider>;
};

export default CartProvider;
