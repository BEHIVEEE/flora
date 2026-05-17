import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongo';
import { PRODUCTS, CATEGORIES } from '@/lib/seed-data';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};
const json = (data, status = 200) => NextResponse.json(data, { status, headers: CORS });

const SECRET = process.env.AUTH_SECRET || 'chemistshop-dev-secret-2026-rotate-in-prod';
const hashPassword = (pwd, salt) => crypto.pbkdf2Sync(pwd, salt, 100000, 64, 'sha512').toString('hex');
const signToken = (payload) => {
  const body = Buffer.from(JSON.stringify({ ...payload, iat: Date.now() })).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
};
const verifyToken = (token) => {
  if (!token) return null;
  const [body, sig] = (token || '').split('.');
  if (!body || !sig) return null;
  const exp = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  if (exp !== sig) return null;
  try {
    const d = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (Date.now() - d.iat > 7 * 86400000) return null;
    return d;
  } catch { return null; }
};
const getBearer = (req) => (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');

const DEFAULT_SETTINGS = {
  id: 'main',
  shopName: 'ChemistShop', tagline: 'Apka Apna Chemist',
  contactPhone: '1800-XXX-XXXX', contactEmail: 'care@chemistshop.top',
  address: 'Thane, Maharashtra, India',
  deliveryCharge: 49, freeDeliveryAbove: 499, minOrderValue: 99,
  businessHours: { open: '09:00', close: '21:00' },
  slotsEnabled: true,
  updatedAt: new Date().toISOString(),
};
const DEFAULT_SLOTS = [
  { id: 'slot-1', label: 'Morning', startTime: '09:00', endTime: '11:00', capacity: 10, active: true },
  { id: 'slot-2', label: 'Late Morning', startTime: '11:00', endTime: '13:00', capacity: 10, active: true },
  { id: 'slot-3', label: 'Afternoon', startTime: '14:00', endTime: '16:00', capacity: 10, active: true },
  { id: 'slot-4', label: 'Evening', startTime: '16:00', endTime: '18:00', capacity: 10, active: true },
  { id: 'slot-5', label: 'Late Evening', startTime: '18:00', endTime: '20:00', capacity: 10, active: true },
];

async function ensureAdminUser(db) {
  const u = await db.collection('admin_users').findOne({ email: 'admin@chemistshop.top' });
  if (!u) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = hashPassword('admin123', salt);
    await db.collection('admin_users').insertOne({ id: 'admin-1', email: 'admin@chemistshop.top', name: 'Admin', role: 'owner', salt, hash, createdAt: new Date().toISOString() });
  }
}

async function ensureSeed(db) {
  if (await db.collection('products').countDocuments() === 0) {
    await db.collection('products').insertMany(PRODUCTS.map(p => ({ ...p, images: [p.image] })));
  }
  if (await db.collection('settings').countDocuments() === 0) await db.collection('settings').insertOne({ ...DEFAULT_SETTINGS });
  if (await db.collection('slots').countDocuments() === 0) await db.collection('slots').insertMany(DEFAULT_SLOTS.map(s => ({ ...s })));
  await ensureAdminUser(db);

  if (await db.collection('orders').countDocuments() === 0) {
    const products = await db.collection('products').find({}, { projection: { _id: 0 } }).limit(15).toArray();
    const customers = [
      { name: 'Aaruhi Patel', phone: '9820000001', city: 'Mumbai' },
      { name: 'Ishika Sharma', phone: '9820000002', city: 'Thane' },
      { name: 'Ruhani Gupta', phone: '9820000003', city: 'Pune' },
      { name: 'Rohit Mehta', phone: '9820000004', city: 'Mumbai' },
      { name: 'Anjali Verma', phone: '9820000005', city: 'Nashik' },
      { name: 'Vikram Singh', phone: '9820000006', city: 'Mumbai' },
      { name: 'Priya Joshi', phone: '9820000007', city: 'Thane' },
      { name: 'Karan Shah', phone: '9820000008', city: 'Mumbai' },
    ];
    const statuses = ['Pending', 'Confirmed', 'Out for Delivery', 'Delivered', 'Delivered', 'Delivered'];
    const sample = [];
    for (let i = 0; i < 32; i++) {
      const daysAgo = Math.floor(Math.random() * 30);
      const created = new Date(Date.now() - daysAgo * 86400000 - Math.floor(Math.random() * 86400000));
      const cust = customers[i % customers.length];
      const itemCount = 1 + Math.floor(Math.random() * 3);
      const items = [];
      for (let j = 0; j < itemCount; j++) {
        const p = products[Math.floor(Math.random() * products.length)];
        const qty = 1 + Math.floor(Math.random() * 2);
        items.push({ id: p.id, name: p.name, price: p.price, mrp: p.mrp, image: p.image, brand: p.brand, packSize: p.packSize, qty });
      }
      const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
      const deliveryFee = subtotal >= 499 ? 0 : 49;
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      sample.push({
        id: 'ORD-' + created.getTime().toString(36).toUpperCase() + '-' + uuidv4().slice(0, 4).toUpperCase(),
        userId: 'u-sample-' + (i % customers.length),
        items,
        address: { name: cust.name, phone: cust.phone, line1: '123 Demo Street', city: cust.city, state: 'Maharashtra', pincode: '400001', type: 'Home' },
        payment: ['COD', 'UPI', 'CARD'][i % 3],
        subtotal, discount: 0, deliveryFee, total: subtotal + deliveryFee,
        status,
        slotId: i % 3 === 0 ? null : DEFAULT_SLOTS[i % DEFAULT_SLOTS.length].id,
        slotDate: new Date(created.getTime() + 86400000).toISOString().slice(0, 10),
        createdAt: created.toISOString(),
        estimatedDelivery: new Date(created.getTime() + 3 * 86400000).toISOString(),
        trackingSteps: [
          { label: 'Order Confirmed', done: true },
          { label: 'Packed', done: status !== 'Pending' },
          { label: 'Out for Delivery', done: ['Out for Delivery', 'Delivered'].includes(status) },
          { label: 'Delivered', done: status === 'Delivered' },
        ],
      });
    }
    await db.collection('orders').insertMany(sample);
  }
}

function parseCSVRow(line) {
  const out = []; let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { if (inQ && line[i + 1] === '"') { cur += '"'; i++; } else inQ = !inQ; continue; }
    if (c === ',' && !inQ) { out.push(cur); cur = ''; continue; }
    cur += c;
  }
  out.push(cur);
  return out;
}

export async function OPTIONS() { return new NextResponse(null, { status: 204, headers: CORS }); }

export async function GET(req, { params }) {
  const path = (params?.path || []).join('/');
  const { searchParams } = new URL(req.url);
  try {
    const db = await getDb();
    await ensureSeed(db);

    if (path === '' || path === 'health') return json({ ok: true, service: 'chemistshop-api', time: new Date().toISOString() });
    if (path === 'categories') return json({ categories: CATEGORIES });

    // Admin: me (validates token)
    if (path === 'admin/me') {
      const token = getBearer(req);
      const data = verifyToken(token);
      if (!data) return json({ ok: false, error: 'Invalid or expired token' }, 401);
      const user = await db.collection('admin_users').findOne({ id: data.uid }, { projection: { _id: 0, hash: 0, salt: 0 } });
      if (!user) return json({ ok: false }, 401);
      return json({ ok: true, user });
    }

    if (path === 'settings') {
      const s = await db.collection('settings').findOne({ id: 'main' }, { projection: { _id: 0 } });
      return json({ settings: s || DEFAULT_SETTINGS });
    }

    if (path === 'slots') {
      const slots = await db.collection('slots').find({}, { projection: { _id: 0 } }).toArray();
      return json({ slots: slots.sort((a, b) => a.startTime.localeCompare(b.startTime)) });
    }
    if (path === 'slots/available') {
      const date = searchParams.get('date') || new Date().toISOString().slice(0, 10);
      const slots = await db.collection('slots').find({ active: true }, { projection: { _id: 0 } }).toArray();
      const orders = await db.collection('orders').find({ slotDate: date }).toArray();
      const slotsWithAvail = slots.map(s => {
        const booked = orders.filter(o => o.slotId === s.id).length;
        return { ...s, booked, available: Math.max(0, s.capacity - booked) };
      }).sort((a, b) => a.startTime.localeCompare(b.startTime));
      return json({ date, slots: slotsWithAvail });
    }

    if (path === 'products') {
      const category = searchParams.get('category');
      const search = searchParams.get('search');
      const limit = parseInt(searchParams.get('limit') || '60', 10);
      const sort = searchParams.get('sort') || 'popular';
      const filter = {};
      if (category && category !== 'all') filter.category = category;
      if (search) filter.name = { $regex: search, $options: 'i' };
      let sortObj = { ratingCount: -1 };
      if (sort === 'price_asc') sortObj = { price: 1 };
      if (sort === 'price_desc') sortObj = { price: -1 };
      if (sort === 'rating') sortObj = { rating: -1 };
      if (sort === 'discount') sortObj = { mrp: -1 };
      if (sort === 'newest') sortObj = { createdAt: -1 };
      const products = await db.collection('products').find(filter, { projection: { _id: 0 } }).sort(sortObj).limit(limit).toArray();
      return json({ products, total: products.length });
    }
    if (path.startsWith('products/')) {
      const id = path.replace('products/', '');
      const product = await db.collection('products').findOne({ id }, { projection: { _id: 0 } });
      if (!product) return json({ error: 'Product not found' }, 404);
      const related = await db.collection('products').find({ category: product.category, id: { $ne: id } }, { projection: { _id: 0 } }).limit(8).toArray();
      return json({ product, related });
    }

    if (path === 'orders') {
      const userId = searchParams.get('userId');
      if (!userId) return json({ orders: [] });
      const orders = await db.collection('orders').find({ userId }, { projection: { _id: 0 } }).sort({ createdAt: -1 }).toArray();
      return json({ orders });
    }
    if (path.startsWith('orders/')) {
      const id = path.replace('orders/', '');
      const order = await db.collection('orders').findOne({ id }, { projection: { _id: 0 } });
      if (!order) return json({ error: 'Order not found' }, 404);
      return json({ order });
    }

    if (path === 'admin/orders') {
      const status = searchParams.get('status');
      const search = searchParams.get('search');
      const filter = {};
      if (status && status !== 'all') filter.status = status;
      if (search) filter.$or = [
        { id: { $regex: search, $options: 'i' } },
        { 'address.name': { $regex: search, $options: 'i' } },
        { 'address.phone': { $regex: search, $options: 'i' } },
      ];
      const orders = await db.collection('orders').find(filter, { projection: { _id: 0 } }).sort({ createdAt: -1 }).limit(200).toArray();
      return json({ orders });
    }

    if (path === 'admin/stats') {
      const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
      const allOrders = await db.collection('orders').find({}, { projection: { _id: 0 } }).toArray();
      const todayOrders = allOrders.filter(o => new Date(o.createdAt) >= startOfToday);
      const todayRevenue = todayOrders.reduce((s, o) => s + (o.total || 0), 0);
      const weekAgo = new Date(Date.now() - 7 * 86400000);
      const monthAgo = new Date(Date.now() - 30 * 86400000);
      const weekOrders = allOrders.filter(o => new Date(o.createdAt) >= weekAgo);
      const monthOrders = allOrders.filter(o => new Date(o.createdAt) >= monthAgo);
      const weekRevenue = weekOrders.reduce((s, o) => s + (o.total || 0), 0);
      const monthRevenue = monthOrders.reduce((s, o) => s + (o.total || 0), 0);
      const productsCount = await db.collection('products').countDocuments();
      const lowStock = await db.collection('products').find({ stock: { $lt: 50 } }, { projection: { _id: 0 } }).limit(8).toArray();
      const pendingCount = await db.collection('orders').countDocuments({ status: 'Pending' });
      const pendingRx = await db.collection('prescriptions').countDocuments({ status: 'Under Review' });
      const recent = allOrders.slice(0, 8);
      const series = [];
      for (let i = 6; i >= 0; i--) {
        const day = new Date(); day.setHours(0, 0, 0, 0); day.setDate(day.getDate() - i);
        const next = new Date(day.getTime() + 86400000);
        const dayOrders = allOrders.filter(o => { const d = new Date(o.createdAt); return d >= day && d < next; });
        series.push({ date: day.toISOString().slice(5, 10), label: day.toLocaleDateString('en-IN', { weekday: 'short' }), revenue: dayOrders.reduce((s, o) => s + (o.total || 0), 0), orders: dayOrders.length });
      }
      const tally = {};
      allOrders.forEach(o => o.items?.forEach(i => { tally[i.id] = (tally[i.id] || { ...i, qty: 0 }); tally[i.id].qty += i.qty; }));
      const topProducts = Object.values(tally).sort((a, b) => b.qty - a.qty).slice(0, 5);
      return json({ todayRevenue, todayOrders: todayOrders.length, weekRevenue, weekOrders: weekOrders.length, monthRevenue, monthOrders: monthOrders.length, productsCount, lowStockCount: lowStock.length, lowStock, pendingCount, pendingRx, totalOrders: allOrders.length, recent, series, topProducts });
    }

    if (path === 'admin/revenue') {
      const range = searchParams.get('range') || 'week';
      const days = range === 'today' ? 1 : range === 'week' ? 7 : range === 'month' ? 30 : 7;
      const start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - (days - 1));
      const allOrders = await db.collection('orders').find({ createdAt: { $gte: start.toISOString() } }, { projection: { _id: 0 } }).toArray();
      const series = [];
      for (let i = 0; i < days; i++) {
        const day = new Date(start); day.setDate(day.getDate() + i);
        const next = new Date(day.getTime() + 86400000);
        const dayOrders = allOrders.filter(o => { const d = new Date(o.createdAt); return d >= day && d < next; });
        series.push({ date: day.toISOString().slice(5, 10), label: day.toLocaleDateString('en-IN', { weekday: 'short' }), revenue: dayOrders.reduce((s, o) => s + (o.total || 0), 0), orders: dayOrders.length });
      }
      const total = series.reduce((s, d) => s + d.revenue, 0);
      return json({ range, series, total });
    }

    // Customer analytics
    if (path === 'admin/customers') {
      const orders = await db.collection('orders').find({}, { projection: { _id: 0 } }).sort({ createdAt: -1 }).toArray();
      const byPhone = {};
      orders.forEach(o => {
        const phone = o.address?.phone || o.userId;
        if (!byPhone[phone]) byPhone[phone] = { phone, userId: o.userId, name: o.address?.name || 'Guest', city: o.address?.city || '', orders: [], totalSpent: 0, orderCount: 0 };
        byPhone[phone].orders.push({ id: o.id, total: o.total, status: o.status, createdAt: o.createdAt });
        byPhone[phone].totalSpent += o.total || 0;
        byPhone[phone].orderCount += 1;
      });
      const customers = Object.values(byPhone).map(c => {
        const dates = c.orders.map(o => new Date(o.createdAt)).sort((a, b) => a - b);
        const first = dates[0]; const last = dates[dates.length - 1];
        const daysSinceLast = Math.floor((Date.now() - last.getTime()) / 86400000);
        const avgOrderValue = Math.round(c.totalSpent / c.orderCount);
        let segment = 'New';
        if (c.orderCount >= 5 && c.totalSpent >= 5000) segment = 'VIP';
        else if (c.orderCount >= 3) segment = 'Loyal';
        else if (c.orderCount >= 2) segment = 'Returning';
        return { ...c, firstOrderDate: first.toISOString(), lastOrderDate: last.toISOString(), daysSinceLast, avgOrderValue, segment };
      }).sort((a, b) => b.totalSpent - a.totalSpent);
      const segments = { New: 0, Returning: 0, Loyal: 0, VIP: 0 };
      customers.forEach(c => segments[c.segment]++);
      const totalLTV = customers.reduce((s, c) => s + c.totalSpent, 0);
      const avgLTV = customers.length ? Math.round(totalLTV / customers.length) : 0;
      const retentionRate = customers.length ? Math.round(((customers.filter(c => c.orderCount > 1).length) / customers.length) * 100) : 0;
      return json({ customers, summary: { total: customers.length, segments, totalLTV, avgLTV, retentionRate, avgOrderCount: customers.length ? +(customers.reduce((s, c) => s + c.orderCount, 0) / customers.length).toFixed(1) : 0 } });
    }

    // Inventory logs
    if (path === 'inventory/logs') {
      const productId = searchParams.get('productId');
      const filter = productId ? { productId } : {};
      const logs = await db.collection('inventory_logs').find(filter, { projection: { _id: 0 } }).sort({ createdAt: -1 }).limit(200).toArray();
      return json({ logs });
    }

    // Prescriptions
    if (path === 'prescriptions') {
      const userId = searchParams.get('userId');
      const prescriptions = await db.collection('prescriptions').find(userId ? { userId } : {}, { projection: { _id: 0 } }).sort({ createdAt: -1 }).toArray();
      return json({ prescriptions });
    }
    if (path === 'admin/prescriptions') {
      const status = searchParams.get('status');
      const search = searchParams.get('search');
      const filter = {};
      if (status && status !== 'all') filter.status = status;
      if (search) filter.$or = [
        { id: { $regex: search, $options: 'i' } },
        { patientName: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ];
      const prescriptions = await db.collection('prescriptions').find(filter, { projection: { _id: 0 } }).sort({ createdAt: -1 }).limit(200).toArray();
      return json({ prescriptions });
    }
    if (path.startsWith('prescriptions/') && path.endsWith('/messages')) {
      const id = path.split('/')[1];
      const messages = await db.collection('rx_messages').find({ prescriptionId: id }, { projection: { _id: 0 } }).sort({ createdAt: 1 }).toArray();
      return json({ messages });
    }
    if (path.startsWith('prescriptions/')) {
      const id = path.replace('prescriptions/', '');
      const prescription = await db.collection('prescriptions').findOne({ id }, { projection: { _id: 0 } });
      if (!prescription) return json({ error: 'Not found' }, 404);
      return json({ prescription });
    }

    if (path === 'addresses') {
      const userId = searchParams.get('userId');
      if (!userId) return json({ addresses: [] });
      const addresses = await db.collection('addresses').find({ userId }, { projection: { _id: 0 } }).toArray();
      return json({ addresses });
    }

    return json({ error: 'Not found', path }, 404);
  } catch (e) {
    console.error('GET error', e);
    return json({ error: e.message }, 500);
  }
}

export async function POST(req, { params }) {
  const path = (params?.path || []).join('/');
  try {
    const db = await getDb();
    const body = await req.json().catch(() => ({}));

    // Admin: login
    if (path === 'admin/login') {
      await ensureAdminUser(db);
      const { email, password } = body;
      const user = await db.collection('admin_users').findOne({ email: (email || '').toLowerCase().trim() });
      if (!user) return json({ ok: false, error: 'Invalid email or password' }, 401);
      const hash = hashPassword(password || '', user.salt);
      if (hash !== user.hash) return json({ ok: false, error: 'Invalid email or password' }, 401);
      const token = signToken({ uid: user.id, email: user.email });
      return json({ ok: true, token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
    }

    if (path === 'orders') {
      const id = 'ORD-' + Date.now().toString(36).toUpperCase() + '-' + uuidv4().slice(0, 4).toUpperCase();
      const now = new Date().toISOString();
      const order = {
        id, userId: body.userId || 'guest', items: body.items || [], address: body.address || {},
        payment: body.payment || 'COD',
        subtotal: body.subtotal || 0, discount: body.discount || 0, deliveryFee: body.deliveryFee || 0, total: body.total || 0,
        slotId: body.slotId || null, slotDate: body.slotDate || null,
        status: 'Pending', createdAt: now,
        estimatedDelivery: new Date(Date.now() + 3 * 86400000).toISOString(),
        trackingSteps: [
          { label: 'Order Confirmed', done: true, time: now },
          { label: 'Packed', done: false }, { label: 'Out for Delivery', done: false }, { label: 'Delivered', done: false },
        ],
      };
      await db.collection('orders').insertOne({ ...order });
      // Reduce stock for each item
      for (const it of (body.items || [])) {
        const p = await db.collection('products').findOne({ id: it.id });
        if (p) {
          const before = p.stock;
          const after = Math.max(0, before - it.qty);
          await db.collection('products').updateOne({ id: it.id }, { $set: { stock: after } });
          await db.collection('inventory_logs').insertOne({ id: 'inv-' + uuidv4().slice(0, 8), productId: it.id, productName: p.name, type: 'sale', qtyChange: -it.qty, before, after, reason: `Order ${id}`, createdAt: now });
        }
      }
      return json({ order });
    }

    if (path === 'products') {
      const id = body.id || ('p-' + uuidv4().slice(0, 8));
      const product = {
        id, name: body.name || 'Untitled Product',
        slug: (body.name || 'product').toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        category: body.category || 'medicines',
        brand: body.brand || 'Generic', manufacturer: body.manufacturer || '',
        price: Number(body.price) || 0, mrp: Number(body.mrp) || Number(body.price) || 0,
        packSize: body.packSize || '',
        image: (body.images && body.images[0]) || body.image || '',
        images: body.images || (body.image ? [body.image] : []),
        stock: Number(body.stock) || 0, prescription: !!body.prescription,
        rating: Number(body.rating) || 4.5, ratingCount: Number(body.ratingCount) || 0,
        tags: body.tags || [], description: body.description || '',
        createdAt: new Date().toISOString(),
      };
      await db.collection('products').insertOne({ ...product });
      if (product.stock > 0) {
        await db.collection('inventory_logs').insertOne({ id: 'inv-' + uuidv4().slice(0, 8), productId: id, productName: product.name, type: 'initial', qtyChange: product.stock, before: 0, after: product.stock, reason: 'Product created', createdAt: new Date().toISOString() });
      }
      return json({ product });
    }

    // Bulk product import
    if (path === 'products/bulk') {
      const items = body.products || [];
      const results = { created: 0, failed: 0, errors: [] };
      for (const raw of items) {
        try {
          if (!raw.name) { results.failed++; results.errors.push('Missing name'); continue; }
          const id = 'p-' + uuidv4().slice(0, 8);
          const images = raw.images || (raw.imageUrl ? [raw.imageUrl] : (raw.image ? [raw.image] : []));
          const product = {
            id, name: raw.name,
            slug: raw.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
            category: raw.category || 'medicines',
            brand: raw.brand || 'Generic', manufacturer: raw.manufacturer || '',
            price: Number(raw.price) || 0, mrp: Number(raw.mrp) || Number(raw.price) || 0,
            packSize: raw.packSize || raw.pack_size || '',
            image: images[0] || '', images,
            stock: Number(raw.stock) || 0,
            prescription: String(raw.prescription || '').toLowerCase() === 'true' || raw.prescription === true,
            rating: 4.5, ratingCount: 0, tags: [],
            description: raw.description || '',
            createdAt: new Date().toISOString(),
          };
          await db.collection('products').insertOne({ ...product });
          if (product.stock > 0) {
            await db.collection('inventory_logs').insertOne({ id: 'inv-' + uuidv4().slice(0, 8), productId: id, productName: product.name, type: 'import', qtyChange: product.stock, before: 0, after: product.stock, reason: 'Bulk CSV import', createdAt: new Date().toISOString() });
          }
          results.created++;
        } catch (e) { results.failed++; results.errors.push(e.message); }
      }
      return json(results);
    }

    if (path === 'slots') {
      const id = 'slot-' + uuidv4().slice(0, 6);
      const slot = { id, label: body.label || `${body.startTime} - ${body.endTime}`, startTime: body.startTime || '09:00', endTime: body.endTime || '11:00', capacity: Number(body.capacity) || 10, active: body.active !== false, createdAt: new Date().toISOString() };
      await db.collection('slots').insertOne({ ...slot });
      return json({ slot });
    }

    // Inventory restock
    if (path === 'inventory/restock') {
      const { productId, qty, reason } = body;
      if (!productId || !qty) return json({ error: 'productId and qty required' }, 400);
      const p = await db.collection('products').findOne({ id: productId });
      if (!p) return json({ error: 'Product not found' }, 404);
      const before = p.stock || 0;
      const change = Number(qty);
      const after = Math.max(0, before + change);
      await db.collection('products').updateOne({ id: productId }, { $set: { stock: after } });
      const log = { id: 'inv-' + uuidv4().slice(0, 8), productId, productName: p.name, type: change > 0 ? 'restock' : 'adjustment', qtyChange: change, before, after, reason: reason || (change > 0 ? 'Manual restock' : 'Manual adjustment'), createdAt: new Date().toISOString() };
      await db.collection('inventory_logs').insertOne({ ...log });
      return json({ ok: true, log, stock: after });
    }

    if (path === 'prescriptions') {
      const id = 'RX-' + Date.now().toString(36).toUpperCase();
      const doc = {
        id, userId: body.userId || 'guest', patientName: body.patientName || '', phone: body.phone || '',
        notes: body.notes || '', fileName: body.fileName || '', fileDataUrl: body.fileDataUrl || '',
        status: 'Under Review', createdAt: new Date().toISOString(),
      };
      await db.collection('prescriptions').insertOne({ ...doc });
      const safe = { ...doc }; delete safe.fileDataUrl;
      return json({ prescription: safe });
    }
    if (path.startsWith('prescriptions/') && path.endsWith('/messages')) {
      const id = path.split('/')[1];
      const msg = { id: 'msg-' + uuidv4().slice(0, 8), prescriptionId: id, sender: body.sender || 'admin', authorName: body.authorName || 'Pharmacist', text: body.text || '', createdAt: new Date().toISOString() };
      await db.collection('rx_messages').insertOne({ ...msg });
      return json({ message: msg });
    }

    if (path === 'addresses') {
      const id = 'ADDR-' + uuidv4().slice(0, 8).toUpperCase();
      const addr = { id, ...body, createdAt: new Date().toISOString() };
      await db.collection('addresses').insertOne({ ...addr });
      return json({ address: addr });
    }

    if (path === 'seed/reset') {
      await db.collection('products').deleteMany({});
      await db.collection('orders').deleteMany({});
      await db.collection('slots').deleteMany({});
      await db.collection('settings').deleteMany({});
      await db.collection('inventory_logs').deleteMany({});
      await db.collection('rx_messages').deleteMany({});
      await ensureSeed(db);
      return json({ ok: true });
    }

    return json({ error: 'Not found' }, 404);
  } catch (e) {
    console.error('POST error', e);
    return json({ error: e.message }, 500);
  }
}

export async function PUT(req, { params }) {
  const path = (params?.path || []).join('/');
  try {
    const db = await getDb();
    const body = await req.json().catch(() => ({}));

    if (path.startsWith('products/')) {
      const id = path.replace('products/', '');
      const current = await db.collection('products').findOne({ id });
      if (!current) return json({ error: 'Product not found' }, 404);
      const update = { ...body }; delete update._id; delete update.id;
      if (body.images && body.images[0]) update.image = body.images[0];
      if (body.name) update.slug = body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      update.price = Number(update.price ?? current.price) || 0;
      update.mrp = Number(update.mrp ?? current.mrp) || update.price;
      const newStock = Number(update.stock ?? current.stock) || 0;
      update.stock = newStock;
      update.updatedAt = new Date().toISOString();
      await db.collection('products').updateOne({ id }, { $set: update });
      if (newStock !== current.stock) {
        const diff = newStock - current.stock;
        await db.collection('inventory_logs').insertOne({ id: 'inv-' + uuidv4().slice(0, 8), productId: id, productName: update.name || current.name, type: diff > 0 ? 'restock' : 'adjustment', qtyChange: diff, before: current.stock, after: newStock, reason: 'Product edit', createdAt: new Date().toISOString() });
      }
      const product = await db.collection('products').findOne({ id }, { projection: { _id: 0 } });
      return json({ product });
    }

    if (path.startsWith('slots/')) {
      const id = path.replace('slots/', '');
      const update = { ...body }; delete update._id; delete update.id;
      if (update.capacity !== undefined) update.capacity = Number(update.capacity);
      await db.collection('slots').updateOne({ id }, { $set: update });
      const slot = await db.collection('slots').findOne({ id }, { projection: { _id: 0 } });
      return json({ slot });
    }

    if (path === 'settings') {
      const update = { ...body }; delete update._id;
      update.updatedAt = new Date().toISOString();
      await db.collection('settings').updateOne({ id: 'main' }, { $set: update }, { upsert: true });
      const settings = await db.collection('settings').findOne({ id: 'main' }, { projection: { _id: 0 } });
      return json({ settings });
    }

    if (path === 'admin/password') {
      const token = getBearer(req);
      const auth = verifyToken(token);
      if (!auth) return json({ ok: false, error: 'Unauthorized' }, 401);
      const user = await db.collection('admin_users').findOne({ id: auth.uid });
      if (!user) return json({ ok: false }, 401);
      const { current, next } = body;
      const cur = hashPassword(current || '', user.salt);
      if (cur !== user.hash) return json({ ok: false, error: 'Current password is incorrect' }, 400);
      if (!next || next.length < 6) return json({ ok: false, error: 'New password must be at least 6 characters' }, 400);
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = hashPassword(next, salt);
      await db.collection('admin_users').updateOne({ id: auth.uid }, { $set: { salt, hash, updatedAt: new Date().toISOString() } });
      return json({ ok: true });
    }

    return json({ error: 'Not found' }, 404);
  } catch (e) {
    console.error('PUT error', e);
    return json({ error: e.message }, 500);
  }
}

export async function PATCH(req, { params }) {
  const path = (params?.path || []).join('/');
  try {
    const db = await getDb();
    const body = await req.json().catch(() => ({}));

    if (path.startsWith('orders/')) {
      const id = path.replace('orders/', '');
      const update = {};
      if (body.status) {
        update.status = body.status;
        update.trackingSteps = [
          { label: 'Order Confirmed', done: ['Confirmed', 'Out for Delivery', 'Delivered'].includes(body.status) || body.status === 'Pending' },
          { label: 'Packed', done: ['Confirmed', 'Out for Delivery', 'Delivered'].includes(body.status) },
          { label: 'Out for Delivery', done: ['Out for Delivery', 'Delivered'].includes(body.status) },
          { label: 'Delivered', done: body.status === 'Delivered' },
        ];
      }
      if (body.slotId !== undefined) update.slotId = body.slotId;
      if (body.slotDate !== undefined) update.slotDate = body.slotDate;
      update.updatedAt = new Date().toISOString();
      await db.collection('orders').updateOne({ id }, { $set: update });
      const order = await db.collection('orders').findOne({ id }, { projection: { _id: 0 } });
      return json({ order });
    }

    if (path.startsWith('prescriptions/')) {
      const id = path.replace('prescriptions/', '');
      const update = { ...body }; delete update._id; delete update.id;
      update.updatedAt = new Date().toISOString();
      await db.collection('prescriptions').updateOne({ id }, { $set: update });
      const prescription = await db.collection('prescriptions').findOne({ id }, { projection: { _id: 0, fileDataUrl: 0 } });
      return json({ prescription });
    }

    return json({ error: 'Not found' }, 404);
  } catch (e) { return json({ error: e.message }, 500); }
}

export async function DELETE(req, { params }) {
  const path = (params?.path || []).join('/');
  try {
    const db = await getDb();
    if (path.startsWith('addresses/')) { await db.collection('addresses').deleteOne({ id: path.replace('addresses/', '') }); return json({ ok: true }); }
    if (path.startsWith('products/')) { await db.collection('products').deleteOne({ id: path.replace('products/', '') }); return json({ ok: true }); }
    if (path.startsWith('slots/')) { await db.collection('slots').deleteOne({ id: path.replace('slots/', '') }); return json({ ok: true }); }
    return json({ error: 'Not found' }, 404);
  } catch (e) { return json({ error: e.message }, 500); }
}
