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
      if (raw) {
        const parsed = JSON.parse(raw);
        // Migrate old cart items that don't have cartKey
        setItems(parsed.map(item => ({ ...item, cartKey: item.cartKey || `${item.id}::` })));
      }
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

  const addItem = useCallback(async (product, qty = 1, variant = null) => {
    // Gate: stock validation (variant-aware)
    const cartKey = `${product.id}::${variant?.id || ''}`;
    const available = Number(variant?.stock ?? product?.stock ?? 0);
    if (!available) {
      return { ok: false, error: 'out_of_stock', message: 'This item is currently out of stock' };
    }
    const existingInCart = items.find(i => (i.cartKey || `${i.id}::${i.variantId || ''}`) === cartKey);
    const existingQty = existingInCart?.qty || 0;
    if (existingQty + qty > available) {
      return { ok: false, error: 'insufficient_stock', message: `Only ${available} available in stock` };
    }
    // Gate: prescription-required products need an approved Rx
    if (product?.prescription) {
      // Always do a live check so stale state doesn't block an already-approved Rx
      const live = await refreshRxStatus();
      if (!live) {
        return { ok: false, error: 'rx_required', message: 'This item requires a valid prescription approved by our pharmacist.' };
      }
    }
    setItems(prev => {
      const exists = prev.find(i => i.cartKey === cartKey);
      if (exists) return prev.map(i => i.cartKey === cartKey ? { ...i, qty: i.qty + qty } : i);
      return [...prev, {
        cartKey,
        id: product.id,
        variantId: variant?.id || null,
        variantStock: variant?.stock ?? null,
        stock: product.stock ?? null,
        name: product.name,
        price: variant?.price ?? product.price,
        mrp: variant?.mrp ?? product.mrp,
        image: product.image,
        packSize: variant?.packSize || product.packSize,
        brand: product.brand,
        prescription: !!product.prescription,
        qty,
      }];
    });
    return { ok: true };
  }, [items, refreshRxStatus]);

  const removeItem = useCallback((cartKey) => setItems(prev => prev.filter(i => (i.cartKey || i.id) !== cartKey)), []);
  const updateQty = useCallback((cartKey, qty) => setItems(prev => qty <= 0 ? prev.filter(i => (i.cartKey || i.id) !== cartKey) : prev.map(i => (i.cartKey || i.id) === cartKey ? { ...i, qty } : i)), []);
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
