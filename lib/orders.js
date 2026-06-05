import { v4 as uuidv4 } from 'uuid';

const DEFAULT_TRACKING = [
  { label: 'Order Confirmed', done: true },
  { label: 'Packed', done: false },
  { label: 'Out for Delivery', done: false },
  { label: 'Delivered', done: false },
];

function normalizeNumber(val, fallback = 0) {
  const num = Number(val);
  return Number.isFinite(num) ? num : fallback;
}

export async function finalizeOrder(db, payload = {}, options = {}) {
  const now = new Date().toISOString();
  const {
    id,
    estimatedDelivery: estimatedAt,
    status = 'Pending',
    paymentStatus,
    paymentMethod,
    paymentId,
    trackingSteps,
    extra,
    dedupeQuery,
    skipInventory = false,
  } = options || {};

  const orderId = id || `ORD-${Date.now().toString(36).toUpperCase()}-${uuidv4().slice(0, 4).toUpperCase()}`;
  const estimatedDelivery = estimatedAt || new Date(Date.now() + 3 * 86400000).toISOString();
  const rawPayment = payload.payment || 'ONLINE';
  const items = Array.isArray(payload.items) ? payload.items : [];

  // Validate stock availability before proceeding
  const shortages = [];
  for (const it of items) {
    if (!it || !it.id) continue;
    const product = await db.collection('products').findOne({ id: it.id }, { projection: { stock: 1, name: 1 } });
    if (!product) continue; // unknown items ignored
    const qty = normalizeNumber(it.qty, 1);
    if (qty > product.stock) {
      shortages.push({ id: it.id, name: product.name, requested: qty, available: product.stock });
    }
  }
  if (shortages.length) {
    return { error: 'insufficient_stock', shortages };
  }

  if (dedupeQuery) {
    let existing = await db.collection('orders').findOne(dedupeQuery, { projection: { _id: 0 } });
    if (existing) {
      const updates = {};
      if (paymentStatus && existing.paymentStatus !== paymentStatus) updates.paymentStatus = paymentStatus;
      if (paymentMethod && existing.paymentMethod !== paymentMethod) updates.paymentMethod = paymentMethod;
      if (paymentId && existing.paymentId !== paymentId) updates.paymentId = paymentId;
      if (status && existing.status !== status) updates.status = status;
      if (extra && typeof extra === 'object') {
        for (const [key, value] of Object.entries(extra)) {
          if (value !== undefined && existing[key] !== value) updates[key] = value;
        }
      }
      if (Object.keys(updates).length) {
        updates.updatedAt = now;
        const targetId = existing.id || orderId;
        await db.collection('orders').updateOne({ id: targetId }, { $set: updates });
        existing = { ...existing, ...updates, id: targetId };
      }
      return existing;
    }
  }

  const resolvedTrackingSource = Array.isArray(trackingSteps) && trackingSteps.length ? trackingSteps : DEFAULT_TRACKING;
  const resolvedTracking = resolvedTrackingSource.map((step, index) => ({
    ...step,
    done: step.done ?? index === 0,
    time: step.time || (index === 0 ? now : step.time),
  }));

  const safeExtra = extra && typeof extra === 'object' ? extra : {};

  const order = {
    id: orderId,
    userId: payload.userId || 'guest',
    items,
    address: payload.address || {},
    payment: rawPayment,
    subtotal: normalizeNumber(payload.subtotal),
    discount: normalizeNumber(payload.discount),
    deliveryFee: normalizeNumber(payload.deliveryFee),
    total: normalizeNumber(payload.total),
    slotId: payload.slotId || null,
    slotDate: payload.slotDate || null,
    deliveryMethod: payload.deliveryMethod || 'home',
    status,
    paymentStatus: paymentStatus ?? (rawPayment === 'COD' ? 'Pending' : 'Paid'),
    paymentMethod: paymentMethod ?? rawPayment,
    paymentId: paymentId || null,
    createdAt: now,
    updatedAt: now,
    estimatedDelivery,
    riderId: null,
    riderAssignedAt: null,
    trackingSteps: resolvedTracking,
    ...safeExtra,
  };

  await db.collection('orders').insertOne({ ...order });

  if (!skipInventory) {
    for (const item of items) {
      if (!item || !item.id) continue;
      const qty = normalizeNumber(item.qty, 1);
      if (qty <= 0) continue;
      const product = await db.collection('products').findOne({ id: item.id });
      if (!product) continue;
      const before = normalizeNumber(product.stock, 0);
      const after = Math.max(0, before - qty);
      await db.collection('products').updateOne({ id: item.id }, { $set: { stock: after } });
      await db.collection('inventory_logs').insertOne({
        id: `inv-${uuidv4().slice(0, 8)}`,
        productId: item.id,
        productName: product.name,
        type: 'sale',
        qtyChange: -qty,
        before,
        after,
        reason: `Order ${orderId}`,
        createdAt: now,
      });
    }
  }

  if (payload.slotId && payload.slotDate) {
    try {
      await db.collection('slots').updateOne(
        { id: payload.slotId, date: payload.slotDate },
        { $inc: { available: -1 } }
      );
    } catch (err) {
      console.error('[ORDERS] Failed updating slot availability', err);
    }
  }

  return order;
}
