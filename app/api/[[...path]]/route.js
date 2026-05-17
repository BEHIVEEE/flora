import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongo';
import { PRODUCTS, CATEGORIES } from '@/lib/seed-data';
import { v4 as uuidv4 } from 'uuid';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};
const json = (data, status = 200) => NextResponse.json(data, { status, headers: CORS });

const DEFAULT_SETTINGS = {
  id: 'main',
  shopName: 'ChemistShop',
  tagline: 'Apka Apna Chemist',
  contactPhone: '1800-XXX-XXXX',
  contactEmail: 'care@chemistshop.top',
  address: 'Thane, Maharashtra, India',
  deliveryCharge: 49,
  freeDeliveryAbove: 499,
  minOrderValue: 99,
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

async function ensureSeed(db) {
  if (await db.collection('products').countDocuments() === 0) {
    await db.collection('products').insertMany(PRODUCTS.map(p => ({ ...p, images: [p.image] })));
  }
  if (await db.collection('settings').countDocuments() === 0) {
    await db.collection('settings').insertOne({ ...DEFAULT_SETTINGS });
  }
  if (await db.collection('slots').countDocuments() === 0) {
    await db.collection('slots').insertMany(DEFAULT_SLOTS.map(s => ({ ...s })));
  }
  if (await db.collection('orders').countDocuments() === 0) {
    // Seed sample orders for dashboard demo
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
    for (let i = 0; i < 24; i++) {
      const daysAgo = Math.floor(Math.random() * 14);
      const created = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000 - Math.floor(Math.random() * 86400000));
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
        subtotal,
        discount: 0,
        deliveryFee,
        total: subtotal + deliveryFee,
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

export async function OPTIONS() { return new NextResponse(null, { status: 204, headers: CORS }); }

export async function GET(req, { params }) {
  const path = (params?.path || []).join('/');
  const { searchParams } = new URL(req.url);
  try {
    const db = await getDb();
    await ensureSeed(db);

    if (path === '' || path === 'health') return json({ ok: true, service: 'chemistshop-api', time: new Date().toISOString() });
    if (path === 'categories') return json({ categories: CATEGORIES });

    // Settings (public read)
    if (path === 'settings') {
      const s = await db.collection('settings').findOne({ id: 'main' }, { projection: { _id: 0 } });
      return json({ settings: s || DEFAULT_SETTINGS });
    }

    // Slots
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

    // Products
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

    // Orders
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

    // Admin: all orders with filters
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

    // Admin: dashboard stats
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
      const recent = allOrders.slice(0, 8);
      // Daily sales last 7 days
      const series = [];
      for (let i = 6; i >= 0; i--) {
        const day = new Date(); day.setHours(0, 0, 0, 0); day.setDate(day.getDate() - i);
        const next = new Date(day.getTime() + 86400000);
        const dayOrders = allOrders.filter(o => { const d = new Date(o.createdAt); return d >= day && d < next; });
        series.push({
          date: day.toISOString().slice(5, 10),
          label: day.toLocaleDateString('en-IN', { weekday: 'short' }),
          revenue: dayOrders.reduce((s, o) => s + (o.total || 0), 0),
          orders: dayOrders.length,
        });
      }
      // Top selling products (by qty)
      const tally = {};
      allOrders.forEach(o => o.items?.forEach(i => { tally[i.id] = (tally[i.id] || { ...i, qty: 0 }); tally[i.id].qty += i.qty; }));
      const topProducts = Object.values(tally).sort((a, b) => b.qty - a.qty).slice(0, 5);
      return json({
        todayRevenue, todayOrders: todayOrders.length,
        weekRevenue, weekOrders: weekOrders.length,
        monthRevenue, monthOrders: monthOrders.length,
        productsCount, lowStockCount: lowStock.length, lowStock,
        pendingCount, totalOrders: allOrders.length,
        recent, series, topProducts,
      });
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
        series.push({
          date: day.toISOString().slice(5, 10),
          label: day.toLocaleDateString('en-IN', { weekday: 'short' }),
          revenue: dayOrders.reduce((s, o) => s + (o.total || 0), 0),
          orders: dayOrders.length,
        });
      }
      const total = series.reduce((s, d) => s + d.revenue, 0);
      return json({ range, series, total });
    }

    // Prescriptions
    if (path === 'prescriptions') {
      const userId = searchParams.get('userId');
      const prescriptions = await db.collection('prescriptions').find(userId ? { userId } : {}, { projection: { _id: 0 } }).sort({ createdAt: -1 }).toArray();
      return json({ prescriptions });
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

    if (path === 'orders') {
      const id = 'ORD-' + Date.now().toString(36).toUpperCase() + '-' + uuidv4().slice(0, 4).toUpperCase();
      const now = new Date().toISOString();
      const order = {
        id,
        userId: body.userId || 'guest',
        items: body.items || [],
        address: body.address || {},
        payment: body.payment || 'COD',
        subtotal: body.subtotal || 0,
        discount: body.discount || 0,
        deliveryFee: body.deliveryFee || 0,
        total: body.total || 0,
        slotId: body.slotId || null,
        slotDate: body.slotDate || null,
        status: 'Pending',
        createdAt: now,
        estimatedDelivery: new Date(Date.now() + 3 * 86400000).toISOString(),
        trackingSteps: [
          { label: 'Order Confirmed', done: true, time: now },
          { label: 'Packed', done: false },
          { label: 'Out for Delivery', done: false },
          { label: 'Delivered', done: false },
        ],
      };
      await db.collection('orders').insertOne({ ...order });
      return json({ order });
    }

    if (path === 'products') {
      const id = body.id || ('p-' + uuidv4().slice(0, 8));
      const product = {
        id,
        name: body.name || 'Untitled Product',
        slug: (body.name || 'product').toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        category: body.category || 'medicines',
        brand: body.brand || 'Generic',
        manufacturer: body.manufacturer || '',
        price: Number(body.price) || 0,
        mrp: Number(body.mrp) || Number(body.price) || 0,
        packSize: body.packSize || '',
        image: (body.images && body.images[0]) || body.image || '',
        images: body.images || (body.image ? [body.image] : []),
        stock: Number(body.stock) || 0,
        prescription: !!body.prescription,
        rating: Number(body.rating) || 4.5,
        ratingCount: Number(body.ratingCount) || 0,
        tags: body.tags || [],
        description: body.description || '',
        createdAt: new Date().toISOString(),
      };
      await db.collection('products').insertOne({ ...product });
      return json({ product });
    }

    if (path === 'slots') {
      const id = 'slot-' + uuidv4().slice(0, 6);
      const slot = {
        id,
        label: body.label || `${body.startTime} - ${body.endTime}`,
        startTime: body.startTime || '09:00',
        endTime: body.endTime || '11:00',
        capacity: Number(body.capacity) || 10,
        active: body.active !== false,
        createdAt: new Date().toISOString(),
      };
      await db.collection('slots').insertOne({ ...slot });
      return json({ slot });
    }

    if (path === 'prescriptions') {
      const id = 'RX-' + Date.now().toString(36).toUpperCase();
      const doc = {
        id,
        userId: body.userId || 'guest',
        patientName: body.patientName || '',
        phone: body.phone || '',
        notes: body.notes || '',
        fileName: body.fileName || '',
        fileDataUrl: body.fileDataUrl || '',
        status: 'Under Review',
        createdAt: new Date().toISOString(),
      };
      await db.collection('prescriptions').insertOne({ ...doc });
      const safe = { ...doc }; delete safe.fileDataUrl;
      return json({ prescription: safe });
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
      const update = { ...body };
      delete update._id; delete update.id;
      if (body.images && body.images[0]) update.image = body.images[0];
      if (body.name) update.slug = body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      update.price = Number(update.price) || 0;
      update.mrp = Number(update.mrp) || update.price;
      update.stock = Number(update.stock) || 0;
      update.updatedAt = new Date().toISOString();
      await db.collection('products').updateOne({ id }, { $set: update });
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

    return json({ error: 'Not found' }, 404);
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

export async function DELETE(req, { params }) {
  const path = (params?.path || []).join('/');
  try {
    const db = await getDb();
    if (path.startsWith('addresses/')) {
      const id = path.replace('addresses/', '');
      await db.collection('addresses').deleteOne({ id });
      return json({ ok: true });
    }
    if (path.startsWith('products/')) {
      const id = path.replace('products/', '');
      await db.collection('products').deleteOne({ id });
      return json({ ok: true });
    }
    if (path.startsWith('slots/')) {
      const id = path.replace('slots/', '');
      await db.collection('slots').deleteOne({ id });
      return json({ ok: true });
    }
    return json({ error: 'Not found' }, 404);
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}
