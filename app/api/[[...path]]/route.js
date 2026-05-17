import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongo';
import { PRODUCTS, CATEGORIES } from '@/lib/seed-data';
import { v4 as uuidv4 } from 'uuid';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function json(data, status = 200) {
  return NextResponse.json(data, { status, headers: CORS });
}

async function ensureSeed(db) {
  const count = await db.collection('products').countDocuments();
  if (count === 0) {
    await db.collection('products').insertMany(PRODUCTS.map(p => ({ ...p })));
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(req, { params }) {
  const path = (params?.path || []).join('/');
  const { searchParams } = new URL(req.url);
  try {
    const db = await getDb();
    await ensureSeed(db);

    if (path === '' || path === 'health') {
      return json({ ok: true, service: 'chemistshop-api', time: new Date().toISOString() });
    }

    if (path === 'categories') {
      return json({ categories: CATEGORIES });
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

    return json({ error: 'Not found' }, 404);
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
        status: 'Confirmed',
        createdAt: now,
        estimatedDelivery: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
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
      const safe = { ...doc };
      delete safe.fileDataUrl;
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
      await db.collection('products').insertMany(PRODUCTS.map(p => ({ ...p })));
      return json({ seeded: PRODUCTS.length });
    }

    return json({ error: 'Not found' }, 404);
  } catch (e) {
    console.error('POST error', e);
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
    return json({ error: 'Not found' }, 404);
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}
