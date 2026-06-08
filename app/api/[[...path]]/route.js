
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongo';
import { finalizeOrder } from '@/lib/orders';
import { PRODUCTS, CATEGORIES } from '@/lib/seed-data';
import { CATEGORY_SEED } from '@/lib/categories';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { z } from 'zod';
import { hashPassword, signToken, verifyToken, getBearer } from '@/lib/auth';
import {
  handleGoogleCallback,
  handleGoogleAuth,
  handleSendOTP,
  handleVerifyOTP,
  handleVerifyFirebaseOTP,
  handleLinkAccount,
} from '@/lib/auth-routes.js';
import fs from 'fs';
import {
  validateAndReadFile,
  savePrescriptionFile,
  resolveStoredPath,
  mimeTypeFor,
  MAX_FILE_SIZE,
} from '@/lib/prescription-storage.js';

const SAMPLE_PRODUCT_IDS = PRODUCTS.map(p => p.id);

// In-memory rate limiter (per IP)
const rateMap = new Map();
function rateLimit(ip, key, max = 10, windowMs = 60000) {
  const now = Date.now();
  const id = `${ip}:${key}`;
  const record = rateMap.get(id) || { count: 0, resetAt: 0 };
  if (now > record.resetAt) { record.count = 0; record.resetAt = now + windowMs; }
  record.count++;
  rateMap.set(id, record);
  if (record.count > max) return { limited: true, retryAfter: Math.ceil((record.resetAt - now) / 1000) };
  return { limited: false };
}
function getClientIp(req) {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}

const ALLOWED_ORIGIN = process.env.CORS_ORIGIN || '*';
const SECURITY = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
};
const CORS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  ...SECURITY,
};
// Tiered cache TTLs. Edge caches at Vercel; SWR keeps responses snappy while revalidating.
const CACHE_SHORT = { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120' };   // product lists (changing)
const CACHE_MED   = { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' };  // product detail
const CACHE_LONG  = { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200' };// categories, settings
const NO_CACHE    = { 'Cache-Control': 'private, no-store' };
const json = (data, status = 200, cache = false, extraHeaders = {}) => {
  let headers = CORS;
  if (cache === true || cache === 'short') headers = { ...CORS, ...CACHE_SHORT };
  else if (cache === 'med') headers = { ...CORS, ...CACHE_MED };
  else if (cache === 'long') headers = { ...CORS, ...CACHE_LONG };
  else if (cache === 'none') headers = { ...CORS, ...NO_CACHE };
  return NextResponse.json(data, { status, headers: { ...headers, ...extraHeaders } });
};

function sanitizeImages(images) {
  if (!Array.isArray(images)) return [];
  return images.filter(url => typeof url === 'string' && url.startsWith('http') && !url.startsWith('data:'));
}

const BULK_IMPORT_LIMIT = 200;

async function bulkImportProducts(db, rawItems = []) {
  const items = Array.isArray(rawItems) ? rawItems.slice(0, BULK_IMPORT_LIMIT) : [];
  const results = { created: 0, updated: 0, failed: 0, errors: [] };
  const startTime = Date.now();
  if (items.length === 0) return results;

  const allCats = await db.collection('categories').find({}, { projection: { _id: 0 } }).toArray();
  const findCatRaw = (val) => {
    if (!val) return null;
    const str = String(val).trim();
    const lower = str.toLowerCase();
    return allCats.find(c => c.id === val || c.slug === lower || c.name.toLowerCase() === lower);
  };
  const categorySynonyms = {
    'allopathy': 'allopathic-medicines',
    'allopathic': 'allopathic-medicines',
    'cat allopathy': 'allopathic-medicines',
    'cat allopathic': 'allopathic-medicines',
    'cat allopathic medicines': 'allopathic-medicines',
    'allopathic medicines': 'allopathic-medicines',
    'ayurvedic': 'ayurvedic-medicines',
    'ayurveda': 'ayurvedic-medicines',
    'cat ayurvedic': 'ayurvedic-medicines',
    'cat ayurvedic medicines': 'ayurvedic-medicines',
    'cat ayurveda': 'ayurvedic-medicines',
    'ayurvedic medicines': 'ayurvedic-medicines',
    'homeopathy': 'homeopathic-medicines',
    'homeopathic': 'homeopathic-medicines',
    'cat homeopathic': 'homeopathic-medicines',
    'cat homeopathy': 'homeopathic-medicines',
    'homeopathic medicines': 'homeopathic-medicines',
    'surgicals': 'surgical-products',
    'cat surgicals': 'surgical-products',
    'surgical': 'surgical-products',
    'surgical products': 'surgical-products',
    'generic': 'generic',
    'cat generic': 'generic',
    'generic medicines': 'generic',
    'cat generic medicines': 'generic',
  };
  const normalizeCategoryValue = (val) => {
    if (!val) return '';
    const trimmed = String(val).trim();
    const lower = trimmed.toLowerCase();
    if (categorySynonyms[lower]) return categorySynonyms[lower];
    const withoutPrefix = lower.startsWith('cat ')
      ? lower.replace(/^cat\s+/, '')
      : lower;
    if (categorySynonyms[withoutPrefix]) return categorySynonyms[withoutPrefix];
    return withoutPrefix;
  };
  const findCat = (val) => findCatRaw(normalizeCategoryValue(val) || val);
  const findBrandCat = (val) => findCatRaw(val);

  const namesAndBrands = items.map(raw => ({
    name: raw.name?.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    brand: (raw.brand || 'Generic').toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  })).filter(nb => nb.name);

  let existingProducts = [];
  if (namesAndBrands.length > 0) {
    const orClause = namesAndBrands.map(nb => ({
      name: { $regex: `^${nb.name}$`, $options: 'i' },
      brand: { $regex: `^${nb.brand}$`, $options: 'i' }
    }));
    existingProducts = await db.collection('products').find({ $or: orClause }).toArray();
  }

  const existingMap = new Map();
  for (const p of existingProducts) {
    const key = (p.name || '').toLowerCase() + '|' + (p.brand || '').toLowerCase();
    existingMap.set(key, p);
  }

  const toInsert = [];
  const toUpdate = [];

  for (const raw of items) {
    try {
      if (!raw.name) { results.failed++; results.errors.push('Missing name'); continue; }
      if (String(raw.name).length > 300) { results.failed++; results.errors.push('Name too long'); continue; }
      if (raw.description && String(raw.description).length > 5000) { results.failed++; results.errors.push('Description too long'); continue; }
      if (raw.images && !Array.isArray(raw.images) && typeof raw.images !== 'string') { results.failed++; results.errors.push('Invalid images field'); continue; }
      const rawImages = raw.images || (raw.imageUrl ? [raw.imageUrl] : (raw.image ? [raw.image] : []));
      const images = sanitizeImages(rawImages);

      const normalizedCategory = normalizeCategoryValue(raw.category);
      const mainCat = findCat(normalizedCategory || raw.category);
      const subCat = findCat(raw.subcategory);
      const brandCat = findBrandCat(raw.brand);
      const brandName = brandCat?.name || raw.brand || 'Generic';

      const key = (raw.name || '').toLowerCase() + '|' + brandName.toLowerCase();
      const existing = existingMap.get(key);

      const price = Number(raw.price) || 0;
      const mrp = Number(raw.mrp) || price;
      const newStock = Number(raw.stock) || 0;

      if (existing) {
        toUpdate.push({ raw, existing, images, newStock, price, mrp, brandName, mainCat, subCat, brandCat, normalizedCategory });
      } else {
        toInsert.push({ raw, images, newStock, price, mrp, brandName, mainCat, subCat, brandCat, normalizedCategory });
      }
    } catch (e) { results.failed++; results.errors.push(e.message); }
  }

  for (const { raw, existing, images, newStock, price, mrp, brandName, mainCat, subCat, brandCat, normalizedCategory } of toUpdate) {
    try {
      const oldStock = existing.stock || 0;
      const stockDiff = newStock - oldStock;
      const updateDoc = {
        price,
        mrp,
        packSize: raw.packSize || raw.pack_size || existing.packSize || '',
        image: images[0] || existing.image,
        images: images.length ? images : existing.images,
        stock: newStock,
        prescription: String(raw.prescription || '').toLowerCase() === 'true' || raw.prescription === true,
        description: raw.description || existing.description,
        updatedAt: new Date().toISOString(),
      };

      const normalizedBrand = raw.brand ? brandName : (existing.brand || brandName);
      if (normalizedBrand) updateDoc.brand = normalizedBrand;
      if (brandCat?.id) updateDoc.brandId = brandCat.id;

      const categorySlug = mainCat?.slug || normalizedCategory || (raw.category ? String(raw.category).trim().toLowerCase() : '');
      if (mainCat?.id) updateDoc.categoryId = mainCat.id;
      if (categorySlug) updateDoc.category = categorySlug;

      const subcategorySlug = subCat?.slug || (raw.subcategory ? String(raw.subcategory).trim() : '');
      if (subCat?.id) updateDoc.subcategoryId = subCat.id;
      if (subcategorySlug) updateDoc.subcategory = subcategorySlug;

      await db.collection('products').updateOne(
        { _id: existing._id },
        { $set: updateDoc }
      );
      if (stockDiff !== 0) {
        await db.collection('inventory_logs').insertOne({
          id: 'inv-' + uuidv4().slice(0, 8),
          productId: existing.id,
          productName: existing.name,
          type: 'bulk-update',
          qtyChange: stockDiff,
          before: oldStock,
          after: newStock,
          reason: 'Bulk CSV import (stock update)',
          createdAt: new Date().toISOString()
        });
      }
      results.updated++;
    } catch (e) { results.failed++; results.errors.push(e.message); }
    if (Date.now() - startTime > 18000) break;
  }

  if (toInsert.length > 0 && (Date.now() - startTime) <= 18000) {
    const newProducts = toInsert.map(({ raw, images, newStock, price, mrp, brandName, mainCat, subCat, brandCat, normalizedCategory }) => {
      const id = 'p-' + uuidv4().slice(0, 8);
      const categorySlug = mainCat?.slug || normalizedCategory || (raw.category ? String(raw.category).trim().toLowerCase() : '');
      const subcategorySlug = subCat?.slug || (raw.subcategory ? String(raw.subcategory).trim() : '');
      const resolvedBrand = brandName || 'Generic';
      return {
        id, name: raw.name,
        slug: raw.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        category: categorySlug || 'allopathic-medicines',
        categoryId: mainCat?.id || null,
        subcategory: subcategorySlug || '',
        subcategoryId: subCat?.id || null,
        brand: resolvedBrand,
        brandId: brandCat?.id || null,
        manufacturer: raw.manufacturer || '',
        price, mrp,
        packSize: raw.packSize || raw.pack_size || '',
        image: images[0] || '', images,
        stock: newStock,
        prescription: String(raw.prescription || '').toLowerCase() === 'true' || raw.prescription === true,
        rating: 4.5, ratingCount: 0, tags: [],
        description: raw.description || '',
        createdAt: new Date().toISOString(),
      };
    });

    try {
      const r = await db.collection('products').insertMany(newProducts, { ordered: false });
      results.created = (r?.insertedCount != null ? r.insertedCount : newProducts.length);

      const logsToInsert = newProducts.filter(p => p.stock > 0).map(p => ({
        id: 'inv-' + uuidv4().slice(0, 8),
        productId: p.id,
        productName: p.name,
        type: 'import',
        qtyChange: p.stock,
        before: 0,
        after: p.stock,
        reason: 'Bulk CSV import',
        createdAt: new Date().toISOString()
      }));
      if (logsToInsert.length > 0) {
        await db.collection('inventory_logs').insertMany(logsToInsert);
      }
    } catch (e) {
      const failed = toInsert.length - (e?.result?.nInserted || 0);
      results.failed += failed > 0 ? failed : toInsert.length;
      results.errors.push('Bulk insert partial failure: ' + (e?.errmsg || e?.message || 'unknown'));
    }
  }

  return results;
}

let importProcessorRunning = false;

async function runImportProcessor() {
  const db = await getDb();
  try {
    while (true) {
      const jobRes = await db.collection('import_jobs').findOneAndUpdate(
        { status: { $in: ['queued', 'processing'] } },
        { $set: { status: 'processing', updatedAt: new Date().toISOString() }, $setOnInsert: { startedAt: new Date().toISOString() } },
        { sort: { createdAt: 1 }, returnDocument: 'after' }
      );
      const job = jobRes.value;
      if (!job) break;

      const startedAt = job.startedAt || new Date().toISOString();
      await db.collection('import_jobs').updateOne({ id: job.id }, { $set: { startedAt, updatedAt: new Date().toISOString() } });

      try {
        while (true) {
          const chunkRes = await db.collection('import_job_chunks').findOneAndDelete(
            { jobId: job.id },
            { sort: { index: 1 } }
          );
          const chunk = chunkRes.value;
          if (!chunk) break;

          const chunkRows = Array.isArray(chunk.rows) ? chunk.rows : [];
          const chunkResults = await bulkImportProducts(db, chunkRows);

          const update = {
            $inc: {
              processed: chunkRows.length,
              created: chunkResults.created || 0,
              updated: chunkResults.updated || 0,
              failed: chunkResults.failed || 0,
              pendingChunks: -1,
            },
            $set: { updatedAt: new Date().toISOString() },
          };
          if (chunkResults.errors?.length) {
            update.$push = { errors: { $each: chunkResults.errors } };
          }
          await db.collection('import_jobs').updateOne({ id: job.id }, update);
        }

        await db.collection('import_jobs').updateOne(
          { id: job.id },
          { $set: { status: 'completed', completedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), pendingChunks: 0 } }
        );
      } catch (err) {
        console.error('[IMPORT] Job processing failed', err);
        await db.collection('import_jobs').updateOne(
          { id: job.id },
          {
            $set: {
              status: 'failed',
              errorMessage: err?.message || String(err),
              updatedAt: new Date().toISOString(),
              pendingChunks: 0,
            },
            $push: { errors: err?.message || String(err) },
          }
        );
      } finally {
        await db.collection('import_job_chunks').deleteMany({ jobId: job.id });
      }
    }
  } finally {
    importProcessorRunning = false;
    const pending = await db.collection('import_jobs').countDocuments({ status: 'queued' });
    if (pending > 0) {
      startImportProcessor();
    }
  }
}

function startImportProcessor() {
  if (importProcessorRunning) return;
  importProcessorRunning = true;
  runImportProcessor().catch((err) => {
    console.error('[IMPORT] Processor crashed', err);
  });
}

let seeded = false;
async function seedOnce() {
  if (seeded) return;
  try {
    const db = await getDb();
    await ensureSeed(db);
    seeded = true;
    startImportProcessor();
  } catch (e) { console.error('Seed error', e); }
}

async function requireAuth(req, db) {
  const token = getBearer(req);
  const data = verifyToken(token);
  if (!data) return { error: json({ ok: false, error: 'Authentication required' }, 401) };
  const user = await db.collection('users').findOne({ id: data.uid }, { projection: { _id: 0, hash: 0, salt: 0 } });
  if (!user) return { error: json({ ok: false, error: 'User not found' }, 401) };
  return { user };
}

async function rxAuditLog(db, { action, prescriptionId, userId, role, ip, meta }) {
  try {
    await db.collection('rx_audit').insertOne({
      id: 'rxa-' + uuidv4().slice(0, 12),
      action, prescriptionId: prescriptionId || null,
      userId: userId || null, role: role || null,
      ip: ip || null, meta: meta || null,
      createdAt: new Date().toISOString(),
    });
  } catch (e) { /* best-effort */ }
}

async function requireAdmin(req, db) {
  const token = getBearer(req);
  const data = verifyToken(token);
  if (!data) return { error: json({ ok: false, error: 'Invalid or expired token' }, 401) };
  const user = await db.collection('users').findOne({ id: data.uid }, { projection: { _id: 0, hash: 0, salt: 0 } });
  if (!user || user.role !== 'admin') return { error: json({ ok: false, error: 'Admin access required' }, 403) };
  return { user };
}

async function requireRider(req, db) {
  const token = getBearer(req);
  const data = verifyToken(token);
  if (!data) return { error: json({ ok: false, error: 'Invalid or expired token' }, 401) };
  const user = await db.collection('users').findOne({ id: data.uid }, { projection: { _id: 0, hash: 0, salt: 0 } });
  if (!user || user.role !== 'rider') return { error: json({ ok: false, error: 'Rider access required' }, 403) };
  return { user };
}

const DEFAULT_SETTINGS = {
  id: 'main',
  shopName: 'FloraChemist', tagline: 'Apka Apna Chemist',
  contactPhone: '1800-XXX-XXXX', contactEmail: 'care@chemistshop.top',
  address: 'Dombivli, Maharashtra, India',
  deliveryCharge: 49, freeDeliveryAbove: 499, minOrderValue: 99,
  pickupFee: 0,
  businessHours: { open: '09:00', close: '21:00' },
  slotsEnabled: true,
  shopLat: 19.2183, shopLng: 73.0197, deliveryRadiusKm: 10,
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
  // Unified users collection - admin is just a user with role='admin'
  const u = await db.collection('users').findOne({ email: 'admin@chemistshop.top' });
  if (!u) {
    const adminPass = process.env.ADMIN_PASSWORD || null;
    if (!adminPass) {
      console.warn('[SECURITY] ADMIN_PASSWORD not set; admin user not created. Set ADMIN_PASSWORD and redeploy.');
      return;
    }
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = hashPassword(adminPass, salt);
    await db.collection('users').insertOne({ id: 'admin-1', email: 'admin@chemistshop.top', name: 'Admin', role: 'admin', phone: '', salt, hash, createdAt: new Date().toISOString() });
  }
  // Migrate legacy admin_users collection (delete it once users exists)
  try { await db.collection('admin_users').drop(); } catch {}
}

async function ensureIndexes(db) {
  try {
    await db.collection('users').createIndex({ email: 1 }, { unique: true });
    await db.collection('users').createIndex({ id: 1 }, { unique: true });
    // Products: scaled for 100k+ catalog
    await db.collection('products').createIndex({ id: 1 }, { unique: true });
    await db.collection('products').createIndex({ category: 1, ratingCount: -1 });
    await db.collection('products').createIndex({ categoryId: 1, ratingCount: -1 });
    await db.collection('products').createIndex({ subcategoryId: 1 });
    await db.collection('products').createIndex({ brand: 1 });
    await db.collection('products').createIndex({ price: 1 });
    await db.collection('products').createIndex({ rating: -1 });
    await db.collection('products').createIndex({ createdAt: -1 });
    await db.collection('products').createIndex({ name: 'text', brand: 'text', description: 'text' }, { weights: { name: 10, brand: 5, description: 1 }, name: 'product_search_text' });
    await db.collection('orders').createIndex({ id: 1 }, { unique: true });
    await db.collection('orders').createIndex({ userId: 1 });
    await db.collection('orders').createIndex({ createdAt: -1 });
    await db.collection('orders').createIndex({ status: 1 });
    await db.collection('orders').createIndex({ slotDate: 1 });
    await db.collection('orders').createIndex({ 'address.phone': 1 });
    await db.collection('orders').createIndex({ riderId: 1, status: 1 });
    await db.collection('slots').createIndex({ id: 1 }, { unique: true });
    await db.collection('settings').createIndex({ id: 1 }, { unique: true });
    await db.collection('prescriptions').createIndex({ userId: 1 });
    await db.collection('prescriptions').createIndex({ createdAt: -1 });
    await db.collection('categories').createIndex({ id: 1 }, { unique: true });
    await db.collection('categories').createIndex({ slug: 1 }, { unique: true });
    await db.collection('categories').createIndex({ parentCategoryId: 1 });
    await db.collection('categories').createIndex({ type: 1 });
    await db.collection('chat_threads').createIndex({ userId: 1 });
    await db.collection('chat_threads').createIndex({ lastMessageAt: -1 });
    await db.collection('chat_messages').createIndex({ threadId: 1, createdAt: 1 });
    await db.collection('import_jobs').createIndex({ id: 1 }, { unique: true });
    await db.collection('import_jobs').createIndex({ status: 1, createdAt: 1 });
    await db.collection('import_job_chunks').createIndex({ jobId: 1, index: 1 }, { unique: true });
  } catch (e) { console.error('Index creation error', e); }
}

async function ensureCategorySeed(db) {
  const now = new Date().toISOString();
  for (const cat of CATEGORY_SEED) {
    const filter = { slug: cat.slug };
    const baseUpdate = {
      $set: {
        updatedAt: now,
        description: cat.description,
        sortOrder: cat.sortOrder,
        icon: cat.icon,
        type: cat.type,
      },
      $setOnInsert: {
        ...cat,
        createdAt: now,
      },
    };
    await db.collection('categories').updateOne(filter, baseUpdate, { upsert: true });
    if (Object.prototype.hasOwnProperty.call(cat, 'parentCategoryId')) {
      await db.collection('categories').updateOne(filter, { $set: { parentCategoryId: cat.parentCategoryId ?? null } });
    }
  }
}

async function ensureSeed(db) {
  await ensureIndexes(db);
  await ensureCategorySeed(db);

  const enableSampleProducts = process.env.ENABLE_SAMPLE_PRODUCTS === 'true';

  if (!enableSampleProducts && SAMPLE_PRODUCT_IDS.length) {
    await db.collection('products').deleteMany({ id: { $in: SAMPLE_PRODUCT_IDS } });
  }

  const hasProducts = await db.collection('products').countDocuments({}, { limit: 1 });

  if (enableSampleProducts && hasProducts === 0) {
    await db.collection('products').insertMany(PRODUCTS.map(p => ({ ...p, images: [p.image] })));
  }

  const hasSettings = await db.collection('settings').countDocuments({}, { limit: 1 });
  if (hasSettings === 0) {
    await db.collection('settings').insertOne({ ...DEFAULT_SETTINGS });
  }

  const hasSlots = await db.collection('slots').countDocuments({}, { limit: 1 });
  if (hasSlots === 0) {
    await db.collection('slots').insertMany(DEFAULT_SLOTS.map(s => ({ ...s })));
  }

  await ensureAdminUser(db);

  if (enableSampleProducts && hasProducts === 0) {
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
  } else if (!enableSampleProducts) {
    await db.collection('orders').deleteMany({ userId: /^u-sample-/ });
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
  const p = await params;
  const path = (p?.path || []).join('/');
  const { searchParams } = new URL(req.url);
  try {
    const db = await getDb();
    await seedOnce();

    if (path === '' || path === 'health') return json({ ok: true, service: 'chemistshop-api', time: new Date().toISOString() });

    if (path === 'categories') {
      const tree = searchParams.get('tree') === 'true';
      const flat = await db.collection('categories').find({}, { projection: { _id: 0 } }).sort({ sortOrder: 1 }).toArray();
      if (tree) {
        const build = (cats, parentId = null) =>
          cats.filter(c => c.parentCategoryId === parentId).map(c => ({
            ...c,
            children: build(cats, c.id),
          }));
        return json({ categories: build(flat) }, 200, true);
      }
      return json({ categories: flat }, 200, true);
    }

    if (path.startsWith('categories/')) {
      const slug = path.replace('categories/', '');
      const category = await db.collection('categories').findOne({ slug }, { projection: { _id: 0 } });
      if (!category) return json({ error: 'Category not found' }, 404);
      const children = await db.collection('categories').find({ parentCategoryId: category.id }, { projection: { _id: 0 } }).sort({ sortOrder: 1 }).toArray();
      return json({ category, children });
    }

    // Admin: me (validates token, requires admin role)
    if (path === 'admin/me') {
      const token = getBearer(req);
      const data = verifyToken(token);
      if (!data) return json({ ok: false, error: 'Invalid or expired token' }, 401);
      const user = await db.collection('users').findOne({ id: data.uid }, { projection: { _id: 0, hash: 0, salt: 0 } });
      if (!user || user.role !== 'admin') return json({ ok: false, error: 'Admin access required' }, 403);
      return json({ ok: true, user });
    }

    // Unified auth: who am I (any role)
    if (path === 'auth/me') {
      const token = getBearer(req);
      const data = verifyToken(token);
      if (!data) return json({ ok: false, error: 'Invalid or expired token' }, 401, 'none');
      const user = await db.collection('users').findOne({ id: data.uid }, { projection: { _id: 0, hash: 0, salt: 0 } });
      if (!user) return json({ ok: false }, 401, 'none');
      return json({ ok: true, user }, 200, 'none');
    }

    // ============================================
    // NEW: Google OAuth - Get Auth URL
    // ============================================
    if (path === 'auth/google') {
      return handleGoogleAuth(json);
    }

    // ============================================
    // NEW: Google OAuth Callback (GET)
    // ============================================
    if (path === 'auth/google/callback') {
      return await handleGoogleCallback(req, db, json);
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
      const bookedAgg = await db.collection('orders').aggregate([
        { $match: { slotDate: date } },
        { $group: { _id: '$slotId', count: { $sum: 1 } } },
      ]).toArray();
      const bookedMap = Object.fromEntries(bookedAgg.map(b => [b._id, b.count]));
      const slotsWithAvail = slots.map(s => {
        const booked = bookedMap[s.id] || 0;
        return { ...s, booked, available: Math.max(0, s.capacity - booked) };
      }).sort((a, b) => a.startTime.localeCompare(b.startTime));
      return json({ date, slots: slotsWithAvail });
    }

    if (path === 'products') {
      const categoryId = searchParams.get('categoryId');
      const subcategoryId = searchParams.get('subcategoryId');
      const brandId = searchParams.get('brandId');
      const brand = searchParams.get('brand');
      const search = searchParams.get('search');
      const limit = Math.min(parseInt(searchParams.get('limit') || '60', 10), 200);
      const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10), 0);
      const sort = searchParams.get('sort') || 'popular';
      const andConds = [];
      // Category: match by id or legacy string (slug/name)
      if (categoryId) {
        const cat = await db.collection('categories').findOne({ id: categoryId }, { projection: { _id: 0, slug: 1, name: 1, id: 1 } });
        const orCat = [
          { categoryId: categoryId },
          { category: categoryId },
        ];
        if (cat?.slug) orCat.push({ category: cat.slug });
        if (cat?.name) orCat.push({ category: cat.name }, { category: { $regex: '^' + String(cat.name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', $options: 'i' } });
        // Broad match: derive a root token (e.g., 'allopath') from slug/name to catch 'allopathy'/'allopathic'
        const deriveRoot = (s) => {
          if (!s) return '';
          const base = String(s).toLowerCase().replace(/[-_]+/g, ' ').replace(/\s*(medicines?|products?|items?)\s*$/i, '').trim();
          return base.replace(/(ic|ies|y)$/i, '').trim();
        };
        const rootFromSlug = deriveRoot(cat?.slug);
        const rootFromName = deriveRoot(cat?.name);
        const escape = (x) => String(x).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const roots = Array.from(new Set([rootFromSlug, rootFromName].filter(Boolean)));
        for (const r of roots) {
          // Match category strings that start with the root, ignoring leading spaces
          orCat.push({ category: { $regex: '^\\s*' + escape(r), $options: 'i' } });
        }
        andConds.push({ $or: orCat });
      }
      // Subcategory: match by id or legacy string (slug/name)
      if (subcategoryId) {
        const sub = await db.collection('categories').findOne({ id: subcategoryId }, { projection: { _id: 0, slug: 1, name: 1, id: 1 } });
        const orSub = [ { subcategoryId } ];
        if (sub?.slug) orSub.push({ subcategory: sub.slug });
        if (sub?.name) orSub.push({ subcategory: sub.name }, { subcategory: { $regex: '^' + String(sub.name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', $options: 'i' } });
        andConds.push({ $or: orSub });
      }
      // Brand: match by id or name
      if (brandId) {
        const b = await db.collection('categories').findOne({ id: brandId }, { projection: { _id: 0, name: 1, id: 1 } });
        const orBrand = [ { brandId } ];
        if (b?.name) orBrand.push({ brand: b.name }, { brand: { $regex: '^' + String(b.name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', $options: 'i' } });
        andConds.push({ $or: orBrand });
      }
      if (brand) andConds.push({ brand });

      // Search: use text index for >=3 chars (fast at 100k+); fall back to prefix regex for short queries
      let projection = { _id: 0 };
      let sortObj = { ratingCount: -1 };
      if (search) {
        const s = search.trim();
        if (s.length >= 3) {
          andConds.push({ $text: { $search: s } });
          projection = { _id: 0, _score: { $meta: 'textScore' } };
          sortObj = { _score: { $meta: 'textScore' } };
        } else {
          andConds.push({ name: { $regex: '^' + s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } });
        }
      }

      const filter = andConds.length ? { $and: andConds } : {};
      if (SAMPLE_PRODUCT_IDS.length) {
        if (filter.$and) filter.$and.push({ id: { $nin: SAMPLE_PRODUCT_IDS } });
        else filter.id = { $nin: SAMPLE_PRODUCT_IDS };
      }
      if (sort === 'price_asc') sortObj = { price: 1 };
      if (sort === 'price_desc') sortObj = { price: -1 };
      if (sort === 'rating') sortObj = { rating: -1 };
      if (sort === 'discount') sortObj = { mrp: -1 };
      if (sort === 'newest') sortObj = { createdAt: -1 };
      // Skip count on paginated requests after first page (saves a full scan at scale)
      const total = offset === 0
        ? await db.collection('products').countDocuments(filter, { limit: 10000 })
        : -1;
      const products = await db.collection('products').find(filter, { projection }).sort(sortObj).skip(offset).limit(limit).toArray();
      return json({ products, total }, 200, true);
    }
    if (path.startsWith('products/')) {
      const id = path.replace('products/', '');
      if (SAMPLE_PRODUCT_IDS.includes(id)) return json({ error: 'Product not found' }, 404);
      const product = await db.collection('products').findOne({ id }, { projection: { _id: 0 } });
      if (!product) return json({ error: 'Product not found' }, 404);
      const related = await db.collection('products').find({ category: product.category, id: { $ne: id } }, { projection: { _id: 0 } }).limit(8).toArray();
      return json({ product, related }, 200, 'med');
    }

    if (path === 'notify-restock') {
      const { productId, email, phone, name } = body;
      if (!productId) return json({ ok: false, error: 'productId required' }, 400);
      const product = await db.collection('products').findOne({ id: productId }, { projection: { _id: 0, id: 1, name: 1, category: 1, brand: 1 } });
      if (!product) return json({ ok: false, error: 'Product not found' }, 404);
      const entry = {
        id: 'notify-' + uuidv4().slice(0, 10),
        productId,
        productName: product.name,
        category: product.category || null,
        brand: product.brand || null,
        email: email ? String(email).trim().toLowerCase() : null,
        phone: phone ? String(phone).trim() : null,
        name: name ? String(name).trim() : null,
        createdAt: new Date().toISOString(),
        notifiedAt: null,
        status: 'pending',
      };
      await db.collection('product_notifications').insertOne(entry);
      return json({ ok: true });
    }

    if (path === 'orders') {
      const userId = searchParams.get('userId');
      const token = getBearer(req);
      const auth = verifyToken(token);
      if (!auth) return json({ ok: false, error: 'Unauthorized' }, 401, 'none');
      if (!userId) return json({ orders: [] }, 200, 'none');
      const isAdmin = (await db.collection('users').findOne({ id: auth.uid }))?.role === 'admin';
      if (!isAdmin && auth.uid !== userId) return json({ ok: false, error: 'Forbidden' }, 403, 'none');
      const orders = await db.collection('orders').find({ userId }, { projection: { _id: 0 } }).sort({ createdAt: -1 }).toArray();
      return json({ orders }, 200, 'none');
    }
    if (path.startsWith('orders/')) {
      const id = path.replace('orders/', '');
      const token = getBearer(req);
      const auth = verifyToken(token);
      if (!auth) return json({ ok: false, error: 'Unauthorized' }, 401, 'none');
      const order = await db.collection('orders').findOne({ id }, { projection: { _id: 0 } });
      if (!order) return json({ error: 'Order not found' }, 404, 'none');
      const isAdmin = (await db.collection('users').findOne({ id: auth.uid }))?.role === 'admin';
      if (!isAdmin && order.userId !== auth.uid) return json({ ok: false, error: 'Forbidden' }, 403, 'none');
      return json({ order }, 200, 'none');
    }

    if (path === 'admin/orders') {
      const admin = await requireAdmin(req, db);
      if (admin.error) return admin.error;
      const status = searchParams.get('status');
      const search = searchParams.get('search');
      const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1);
      const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
      const filter = {};
      if (status && status !== 'all') filter.status = status;
      if (search) filter.$or = [
        { id: { $regex: search, $options: 'i' } },
        { 'address.name': { $regex: search, $options: 'i' } },
        { 'address.phone': { $regex: search, $options: 'i' } },
      ];
      const total = await db.collection('orders').countDocuments(filter);
      const orders = await db.collection('orders').find(filter, { projection: { _id: 0 } }).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).toArray();
      return json({ orders, total, page, limit });
    }

    if (path === 'admin/import/status') {
      const admin = await requireAdmin(req, db);
      if (admin.error) return admin.error;
      const id = searchParams.get('id');
      if (!id) return json({ ok: false, error: 'id required' }, 400, 'none');
      const job = await db.collection('import_jobs').findOne({ id }, { projection: { _id: 0 } });
      if (!job) return json({ ok: false, error: 'Job not found' }, 404, 'none');
      const pendingChunks = await db.collection('import_job_chunks').countDocuments({ jobId: id });
      return json({ job: { ...job, pendingChunks } }, 200, 'none');
    }

    if (path === 'admin/import/active') {
      const admin = await requireAdmin(req, db);
      if (admin.error) return admin.error;
      const job = await db.collection('import_jobs').findOne(
        { status: { $in: ['uploading', 'queued', 'processing'] } },
        { sort: { createdAt: -1 }, projection: { _id: 0 } }
      );
      if (!job) return json({ job: null }, 200, 'none');
      const pendingChunks = await db.collection('import_job_chunks').countDocuments({ jobId: job.id });
      return json({ job: { ...job, pendingChunks } }, 200, 'none');
    }

    if (path === 'admin/stats') {
      const admin = await requireAdmin(req, db);
      if (admin.error) return admin.error;
      const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
      const weekAgo = new Date(Date.now() - 7 * 86400000);
      const monthAgo = new Date(Date.now() - 30 * 86400000);

      const [todayAgg, weekAgg, monthAgg, productsCount, lowStock, pendingCount, pendingRx, totalOrders, recent, notifyPending, notifyTop] = await Promise.all([
        db.collection('orders').aggregate([
          { $match: { createdAt: { $gte: startOfToday.toISOString() } } },
          { $group: { _id: null, revenue: { $sum: '$total' }, count: { $sum: 1 } } },
        ]).toArray(),
        db.collection('orders').aggregate([
          { $match: { createdAt: { $gte: weekAgo.toISOString() } } },
          { $group: { _id: null, revenue: { $sum: '$total' }, count: { $sum: 1 } } },
        ]).toArray(),
        db.collection('orders').aggregate([
          { $match: { createdAt: { $gte: monthAgo.toISOString() } } },
          { $group: { _id: null, revenue: { $sum: '$total' }, count: { $sum: 1 } } },
        ]).toArray(),
        db.collection('products').countDocuments(),
        db.collection('products').find({ stock: { $lt: 50 } }, { projection: { _id: 0 } }).limit(8).toArray(),
        db.collection('orders').countDocuments({ status: 'Pending' }),
        db.collection('prescriptions').countDocuments({ status: 'Under Review' }),
        db.collection('orders').countDocuments(),
        db.collection('orders').find({}, { projection: { _id: 0 } }).sort({ createdAt: -1 }).limit(8).toArray(),
        db.collection('product_notifications').countDocuments({ status: 'pending' }),
        db.collection('product_notifications').aggregate([
          { $group: { _id: '$productId', productName: { $first: '$productName' }, category: { $first: '$category' }, count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 },
        ]).toArray(),
      ]);

      const todayRevenue = todayAgg[0]?.revenue || 0;
      const todayOrders = todayAgg[0]?.count || 0;
      const weekRevenue = weekAgg[0]?.revenue || 0;
      const weekOrders = weekAgg[0]?.count || 0;
      const monthRevenue = monthAgg[0]?.revenue || 0;
      const monthOrders = monthAgg[0]?.count || 0;

      const series = [];
      for (let i = 6; i >= 0; i--) {
        const day = new Date(); day.setHours(0, 0, 0, 0); day.setDate(day.getDate() - i);
        const next = new Date(day.getTime() + 86400000);
        const dayAgg = await db.collection('orders').aggregate([
          { $match: { createdAt: { $gte: day.toISOString(), $lt: next.toISOString() } } },
          { $group: { _id: null, revenue: { $sum: '$total' }, count: { $sum: 1 } } },
        ]).toArray();
        series.push({ date: day.toISOString().slice(5, 10), label: day.toLocaleDateString('en-IN', { weekday: 'short' }), revenue: dayAgg[0]?.revenue || 0, orders: dayAgg[0]?.count || 0 });
      }

      const topProducts = await db.collection('orders').aggregate([
        { $unwind: '$items' },
        { $group: { _id: '$items.id', name: { $first: '$items.name' }, price: { $first: '$items.price' }, image: { $first: '$items.image' }, qty: { $sum: '$items.qty' } } },
        { $sort: { qty: -1 } },
        { $limit: 5 },
      ]).toArray();

      return json({
        todayRevenue,
        todayOrders,
        weekRevenue,
        weekOrders,
        monthRevenue,
        monthOrders,
        productsCount,
        lowStockCount: lowStock.length,
        lowStock,
        pendingCount,
        pendingRx,
        totalOrders,
        recent,
        series,
        topProducts: topProducts.map(p => ({ id: p._id, name: p.name, price: p.price, image: p.image, qty: p.qty })),
        notifyPending,
        notifyTop: notifyTop.map(n => ({ productId: n._id, productName: n.productName, category: n.category, count: n.count })),
      });
    }

    if (path === 'admin/revenue') {
      const admin = await requireAdmin(req, db);
      if (admin.error) return admin.error;
      const range = searchParams.get('range') || 'week';
      const days = range === 'today' ? 1 : range === 'week' ? 7 : range === 'month' ? 30 : 7;
      const start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - (days - 1));
      const series = [];
      for (let i = 0; i < days; i++) {
        const day = new Date(start); day.setDate(day.getDate() + i);
        const next = new Date(day.getTime() + 86400000);
        const dayAgg = await db.collection('orders').aggregate([
          { $match: { createdAt: { $gte: day.toISOString(), $lt: next.toISOString() } } },
          { $group: { _id: null, revenue: { $sum: '$total' }, count: { $sum: 1 } } },
        ]).toArray();
        series.push({ date: day.toISOString().slice(5, 10), label: day.toLocaleDateString('en-IN', { weekday: 'short' }), revenue: dayAgg[0]?.revenue || 0, orders: dayAgg[0]?.count || 0 });
      }
      const total = series.reduce((s, d) => s + d.revenue, 0);
      return json({ range, series, total });
    }

    // Customer analytics
    if (path === 'admin/customers') {
      const admin = await requireAdmin(req, db);
      if (admin.error) return admin.error;
      const customersAgg = await db.collection('orders').aggregate([
        { $group: {
          _id: { $ifNull: ['$address.phone', '$userId'] },
          phone: { $first: { $ifNull: ['$address.phone', '$userId'] } },
          userId: { $first: '$userId' },
          name: { $first: { $ifNull: ['$address.name', 'Guest'] } },
          city: { $first: { $ifNull: ['$address.city', ''] } },
          totalSpent: { $sum: '$total' },
          orderCount: { $sum: 1 },
          firstOrderDate: { $min: '$createdAt' },
          lastOrderDate: { $max: '$createdAt' },
          orders: { $push: { id: '$id', total: '$total', status: '$status', createdAt: '$createdAt' } },
        }},
        { $sort: { totalSpent: -1 } },
      ]).toArray();

      const customers = customersAgg.map(c => {
        const daysSinceLast = Math.floor((Date.now() - new Date(c.lastOrderDate).getTime()) / 86400000);
        const avgOrderValue = Math.round(c.totalSpent / c.orderCount);
        let segment = 'New';
        if (c.orderCount >= 5 && c.totalSpent >= 5000) segment = 'VIP';
        else if (c.orderCount >= 3) segment = 'Loyal';
        else if (c.orderCount >= 2) segment = 'Returning';
        return { ...c, daysSinceLast, avgOrderValue, segment };
      });
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
      const token = getBearer(req);
      const auth = verifyToken(token);
      if (!auth) return json({ ok: false, error: 'Unauthorized' }, 401, 'none');
      const isAdmin = (await db.collection('users').findOne({ id: auth.uid }))?.role === 'admin';
      const filter = isAdmin ? {} : { userId: auth.uid };
      const prescriptions = await db.collection('prescriptions').find(filter, { projection: { _id: 0 } }).sort({ createdAt: -1 }).toArray();
      return json({ prescriptions }, 200, 'none');
    }
    if (path === 'prescriptions/approved') {
      const token = getBearer(req);
      const auth = verifyToken(token);
      if (!auth) return json({ approved: false }, 200, 'none');
      const approved = await db.collection('prescriptions').findOne({ userId: auth.uid, status: 'Approved' }, { projection: { _id: 0 } });
      return json({ approved: !!approved, prescription: approved || null }, 200, 'none');
    }
    if (path === 'admin/prescriptions') {
      const admin = await requireAdmin(req, db);
      if (admin.error) return admin.error;
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

    // Chat (general pharmacist conversations)
    if (path === 'chat/thread') {
      const token = getBearer(req);
      const auth = verifyToken(token);
      if (!auth) return json({ thread: null }, 200, 'none');
      const thread = await db.collection('chat_threads').findOne({ userId: auth.uid, status: 'open' }, { projection: { _id: 0 } });
      return json({ thread }, 200, 'none');
    }
    if (path === 'chat/messages') {
      const threadId = searchParams.get('threadId');
      if (!threadId) return json({ messages: [] }, 200, 'none');
      const token = getBearer(req);
      const auth = verifyToken(token);
      if (!auth) return json({ messages: [] }, 200, 'none');
      const thread = await db.collection('chat_threads').findOne({ id: threadId }, { projection: { _id: 0, userId: 1 } });
      if (!thread) return json({ messages: [] }, 200, 'none');
      const isAdmin = (await db.collection('users').findOne({ id: auth.uid }))?.role === 'admin';
      if (!isAdmin && thread.userId !== auth.uid) return json({ messages: [] }, 200, 'none');
      const messages = await db.collection('chat_messages').find({ threadId }, { projection: { _id: 0 } }).sort({ createdAt: 1 }).toArray();
      return json({ messages }, 200, 'none');
    }
    if (path === 'admin/chats') {
      const admin = await requireAdmin(req, db);
      if (admin.error) return admin.error;
      const threads = await db.collection('chat_threads').find({}, { projection: { _id: 0 } }).sort({ lastMessageAt: -1 }).limit(200).toArray();
      return json({ threads });
    }
    if (path.startsWith('admin/chats/')) {
      const admin = await requireAdmin(req, db);
      if (admin.error) return admin.error;
      const id = path.replace('admin/chats/', '');
      const thread = await db.collection('chat_threads').findOne({ id }, { projection: { _id: 0 } });
      if (!thread) return json({ error: 'Thread not found' }, 404);
      const messages = await db.collection('chat_messages').find({ threadId: id }, { projection: { _id: 0 } }).sort({ createdAt: 1 }).toArray();
      return json({ thread, messages });
    }
    // Admin: list prescriptions (with optional status/search)
    if (path === 'admin/prescriptions') {
      const admin = await requireAdmin(req, db);
      if (admin.error) return admin.error;
      const status = searchParams.get('status');
      const search = searchParams.get('search');
      const filter = {};
      if (status && status !== 'all') filter.status = status;
      if (search) {
        const re = { $regex: search, $options: 'i' };
        filter.$or = [{ id: re }, { patientName: re }, { phone: re }];
      }
      const prescriptions = await db.collection('prescriptions')
        .find(filter, { projection: { _id: 0, fileDataUrl: 0, sha256: 0 } })
        .sort({ createdAt: -1 }).limit(500).toArray();
      return json({ prescriptions });
    }

    // Admin: prescription audit trail
    if (path.startsWith('admin/prescriptions/') && path.endsWith('/audit')) {
      const admin = await requireAdmin(req, db);
      if (admin.error) return admin.error;
      const id = path.split('/')[2];
      const logs = await db.collection('rx_audit').find({ prescriptionId: id }, { projection: { _id: 0 } }).sort({ createdAt: -1 }).limit(200).toArray();
      return json({ logs });
    }

    // Protected file download — owner or admin only
    if (path.startsWith('prescriptions/') && path.endsWith('/file')) {
      const id = path.split('/')[1];
      const auth = await requireAuth(req, db);
      if (auth.error) return auth.error;

      const rx = await db.collection('prescriptions').findOne({ id });
      if (!rx) return json({ error: 'Not found' }, 404);

      const isOwner = rx.userId === auth.user.id;
      const isAdmin = auth.user.role === 'admin';
      if (!isOwner && !isAdmin) {
        await rxAuditLog(db, { action: 'file.denied', prescriptionId: id, userId: auth.user.id, role: auth.user.role, ip: getClientIp(req) });
        return json({ error: 'Forbidden' }, 403);
      }

      // Legacy records may have only fileDataUrl (base64). Serve those directly.
      if (!rx.filePath && rx.fileDataUrl) {
        await rxAuditLog(db, { action: 'file.access.legacy', prescriptionId: id, userId: auth.user.id, role: auth.user.role, ip: getClientIp(req) });
        const m = /^data:([^;]+);base64,(.+)$/.exec(rx.fileDataUrl);
        if (!m) return json({ error: 'Corrupt legacy file' }, 500);
        const buf = Buffer.from(m[2], 'base64');
        return new NextResponse(buf, {
          status: 200,
          headers: { ...CORS, 'Content-Type': m[1], 'Cache-Control': 'private, no-store' },
        });
      }

      if (!rx.filePath) return json({ error: 'File missing' }, 404);

      let abs;
      try { abs = resolveStoredPath(rx.filePath); }
      catch { return json({ error: 'Invalid path' }, 400); }

      if (!fs.existsSync(abs)) {
        await rxAuditLog(db, { action: 'file.missing', prescriptionId: id, userId: auth.user.id, role: auth.user.role, ip: getClientIp(req) });
        return json({ error: 'File not found on disk' }, 404);
      }

      const stat = await fs.promises.stat(abs);
      const buf = await fs.promises.readFile(abs);
      const mime = rx.mimeType || mimeTypeFor(abs);
      const download = searchParams.get('download') === '1';

      await rxAuditLog(db, {
        action: download ? 'file.download' : 'file.view',
        prescriptionId: id, userId: auth.user.id, role: auth.user.role, ip: getClientIp(req),
        meta: { size: stat.size },
      });

      const headers = {
        ...CORS,
        'Content-Type': mime,
        'Content-Length': String(stat.size),
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      };
      if (download) {
        headers['Content-Disposition'] = `attachment; filename="${rx.fileName || (rx.id + '.' + (rx.mimeType?.split('/')[1] || 'bin'))}"`;
      }
      return new NextResponse(buf, { status: 200, headers });
    }

    if (path.startsWith('prescriptions/')) {
      const id = path.replace('prescriptions/', '');
      const prescription = await db.collection('prescriptions').findOne(
        { id },
        { projection: { _id: 0, fileDataUrl: 0, sha256: 0, filePath: 0 } }
      );
      if (!prescription) return json({ error: 'Not found' }, 404);
      return json({ prescription });
    }

    if (path === 'addresses') {
      const userId = searchParams.get('userId');
      if (!userId) return json({ addresses: [] });
      const addresses = await db.collection('addresses').find({ userId }, { projection: { _id: 0 } }).toArray();
      return json({ addresses });
    }

    // Rider endpoints
    if (path === 'riders') {
      const admin = await requireAdmin(req, db);
      if (admin.error) return admin.error;
      const search = searchParams.get('search');
      const filter = { role: 'rider' };
      if (search) filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ];
      const riders = await db.collection('users').find(filter, { projection: { _id: 0, hash: 0, salt: 0 } }).sort({ createdAt: -1 }).toArray();
      return json({ riders });
    }
    if (path.startsWith('riders/')) {
      const riderId = path.replace('riders/', '');
      const admin = await requireAdmin(req, db);
      if (admin.error) return admin.error;
      const rider = await db.collection('users').findOne({ id: riderId, role: 'rider' }, { projection: { _id: 0, hash: 0, salt: 0 } });
      if (!rider) return json({ error: 'Rider not found' }, 404);
      return json({ rider });
    }
    if (path === 'rider/orders') {
      const rider = await requireRider(req, db);
      if (rider.error) return rider.error;
      const status = searchParams.get('status');
      const filter = { riderId: rider.user.id };
      if (status && status !== 'all') filter.status = status;
      const orders = await db.collection('orders').find(filter, { projection: { _id: 0 } }).sort({ createdAt: -1 }).toArray();
      return json({ orders });
    }
    // Unassigned orders any rider can claim
    if (path === 'rider/available') {
      const rider = await requireRider(req, db);
      if (rider.error) return rider.error;
      const orders = await db.collection('orders').find(
        { $and: [
          { $or: [{ riderId: null }, { riderId: { $exists: false } }] },
          { status: { $nin: ['Delivered', 'Cancelled'] } },
        ] },
        { projection: { _id: 0 } }
      ).sort({ createdAt: -1 }).limit(50).toArray();
      return json({ orders });
    }

    return json({ error: 'Not found', path }, 404);
  } catch (e) {
    console.error('GET error', e);
    return json({ error: e.message }, 500);
  }
}

export async function POST(req, { params }) {
  const p = await params;
  const path = (p?.path || []).join('/');
  try {
    const db = await getDb();
    await seedOnce();

    // ============================================
    // Prescription upload (multipart/form-data) — handled BEFORE JSON parse
    // ============================================
    if (path === 'prescriptions/upload') {
      // Auth required
      const auth = await requireAuth(req, db);
      if (auth.error) return auth.error;

      // Rate limit per user
      const rl = rateLimit(getClientIp(req), `rx-upload:${auth.user.id}`, 10, 60000);
      if (rl.limited) return json({ ok: false, error: `Too many uploads. Try again in ${rl.retryAfter}s.` }, 429);

      const ctype = req.headers.get('content-type') || '';
      if (!ctype.includes('multipart/form-data')) {
        return json({ ok: false, error: 'Expected multipart/form-data' }, 400);
      }

      let form;
      try { form = await req.formData(); }
      catch { return json({ ok: false, error: 'Invalid form data' }, 400); }

      const file = form.get('file');
      const orderId = String(form.get('orderId') || '').trim();
      const patientName = String(form.get('patientName') || '').trim();
      const phone = String(form.get('phone') || '').replace(/\D/g, '').slice(-10);
      const notes = String(form.get('notes') || '').trim().slice(0, 1000);

      if (!file) return json({ ok: false, error: 'File is required' }, 400);
      if (!patientName || phone.length !== 10) return json({ ok: false, error: 'Patient name and 10-digit phone required' }, 400);

      // Validate + read bytes (real MIME check, size limit)
      let validated;
      try { validated = await validateAndReadFile(file); }
      catch (e) { return json({ ok: false, error: e.message }, 400); }

      // Dedup by SHA-256 per user
      const crypto2 = await import('crypto');
      const sha = crypto2.createHash('sha256').update(validated.buffer).digest('hex');
      const dup = await db.collection('prescriptions').findOne({ userId: auth.user.id, sha256: sha });
      if (dup) {
        await rxAuditLog(db, { action: 'upload.duplicate', prescriptionId: dup.id, userId: auth.user.id, role: auth.user.role, ip: getClientIp(req) });
        return json({ ok: false, error: 'You already uploaded this exact file.', prescriptionId: dup.id }, 409);
      }

      const rxId = 'RX-' + uuidv4().slice(0, 8).toUpperCase();
      const effectiveOrderId = orderId || rxId;

      // Store file as base64 in MongoDB (works on all deployments including serverless)
      const fileDataUrl = `data:${validated.mimeType};base64,${validated.buffer.toString('base64')}`;

      const rx = {
        id: rxId,
        userId: auth.user.id,
        orderId: effectiveOrderId,
        patientName,
        phone,
        notes,
        filePath: null,
        fileName: `prescription_${rxId}.${validated.extension}`,
        originalName: validated.originalName,
        mimeType: validated.mimeType,
        fileSize: validated.size,
        fileDataUrl,
        sha256: sha,
        status: 'Under Review',                  // pending
        verificationStatus: 'pending',           // pending/approved/rejected
        pharmacistId: null,
        verificationNotes: null,
        verifiedAt: null,
        archived: false,
        uploadDate: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };
      await db.collection('prescriptions').insertOne({ ...rx });

      await rxAuditLog(db, {
        action: 'upload',
        prescriptionId: rxId,
        userId: auth.user.id,
        role: auth.user.role,
        ip: getClientIp(req),
        meta: { size: validated.size, mimeType: validated.mimeType, originalName: validated.originalName },
      });

      // Strip filePath/sha256/fileDataUrl from response
      const { filePath, sha256, fileDataUrl: _fd, ...safe } = rx;
      return json({ ok: true, prescription: safe });
    }

    const body = await req.json().catch(() => ({}));

    const loginSchema = z.object({ email: z.string().email(), password: z.string().min(6) });
    const signupSchema = z.object({ name: z.string().optional(), email: z.string().email(), password: z.string().min(6), phone: z.string().optional() });

    // Admin: login (legacy alias - rejects non-admin)
    if (path === 'admin/login') {
      await ensureAdminUser(db);
      const rl = rateLimit(getClientIp(req), 'login', 5, 60000);
      if (rl.limited) return json({ ok: false, error: `Too many attempts. Try again in ${rl.retryAfter}s.` }, 429);
      const parsed = loginSchema.safeParse(body);
      if (!parsed.success) return json({ ok: false, error: 'Invalid input' }, 400);
      const { email, password } = parsed.data;
      const user = await db.collection('users').findOne({ email: email.toLowerCase().trim() });
      if (!user) return json({ ok: false, error: 'Invalid email or password' }, 401);
      const hash = hashPassword(password, user.salt);
      if (hash !== user.hash) return json({ ok: false, error: 'Invalid email or password' }, 401);
      if (user.role !== 'admin') return json({ ok: false, error: 'This account does not have admin access' }, 403);
      const token = signToken({ uid: user.id, email: user.email, role: user.role });
      return json(
        { ok: true, token, user: { id: user.id, email: user.email, name: user.name, role: user.role } },
        200,
        'none',
        { 'Set-Cookie': `cs_token=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${7 * 86400}` }
      );
    }

    // Unified auth: login (any role)
    if (path === 'auth/login') {
      await ensureAdminUser(db);
      const rl = rateLimit(getClientIp(req), 'login', 5, 60000);
      if (rl.limited) return json({ ok: false, error: `Too many attempts. Try again in ${rl.retryAfter}s.` }, 429);
      const parsed = loginSchema.safeParse(body);
      if (!parsed.success) return json({ ok: false, error: 'Invalid input' }, 400);
      const { email, password } = parsed.data;
      const user = await db.collection('users').findOne({ email: email.toLowerCase().trim() });
      if (!user) return json({ ok: false, error: 'Invalid email or password' }, 401);
      const hash = hashPassword(password, user.salt);
      if (hash !== user.hash) return json({ ok: false, error: 'Invalid email or password' }, 401);
      const token = signToken({ uid: user.id, email: user.email, role: user.role });
      return json(
        { ok: true, token, user: { id: user.id, email: user.email, name: user.name, role: user.role, phone: user.phone || '' } },
        200,
        'none',
        { 'Set-Cookie': `cs_token=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${7 * 86400}` }
      );
    }

    // Unified auth: signup (only role='user'; admin must be seeded)
    if (path === 'auth/signup') {
      const rl = rateLimit(getClientIp(req), 'signup', 5, 60000);
      if (rl.limited) return json({ ok: false, error: `Too many attempts. Try again in ${rl.retryAfter}s.` }, 429);
      const parsed = signupSchema.safeParse(body);
      if (!parsed.success) return json({ ok: false, error: 'Invalid input' }, 400);
      const { name, email, password, phone } = parsed.data;
      const emailLc = email.toLowerCase().trim();
      const existing = await db.collection('users').findOne({ email: emailLc });
      if (existing) return json({ ok: false, error: 'An account with this email already exists' }, 409);
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = hashPassword(password, salt);
      const id = 'u-' + uuidv4().slice(0, 12);
      const user = { id, name: (name || '').trim(), email: emailLc, phone: (phone || '').trim(), role: 'user', salt, hash, createdAt: new Date().toISOString() };
      await db.collection('users').insertOne({ ...user });
      const token = signToken({ uid: id, email: emailLc, role: 'user' });
      return json(
        { ok: true, token, user: { id, email: emailLc, name: user.name, phone: user.phone, role: 'user' } },
        200,
        'none',
        { 'Set-Cookie': `cs_token=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${7 * 86400}` }
      );
    }

    // ============================================
    // NEW: Google OAuth Callback
    // ============================================
    if (path === 'auth/google/callback') {
      return await handleGoogleCallback(req, db, json);
    }

    // ============================================
    // NEW: Send OTP to Phone
    // ============================================
    if (path === 'auth/send-otp') {
      return await handleSendOTP(req, db, json, rateLimit, getClientIp, body);
    }

    // ============================================
    // NEW: Verify OTP and Login
    // ============================================
    if (path === 'auth/verify-otp') {
      return await handleVerifyOTP(req, db, json, rateLimit, getClientIp, body);
    }

    // ============================================
    // NEW: Verify Firebase OTP (Frontend Firebase)
    // ============================================
    if (path === 'auth/verify-otp-firebase') {
      return await handleVerifyFirebaseOTP(req, db, json, rateLimit, getClientIp, body);
    }

    // ============================================
    // NEW: Firebase ID Token verification
    // ============================================
    if (path === 'auth/firebase-verify') {
      const { idToken, phone } = body || {};
      if (!idToken) {
        return json({ ok: false, error: 'Missing ID token' }, 400);
      }
      
      try {
        // Verify the Firebase ID token
        const firebaseKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
        const verifyRes = await fetch(
          `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken }),
          }
        );
        
        if (!verifyRes.ok) {
          return json({ ok: false, error: 'Invalid token' }, 401);
        }
        
        const verifyData = await verifyRes.json();
        const userInfo = verifyData.users?.[0];
        
        if (!userInfo) {
          return json({ ok: false, error: 'User not found' }, 404);
        }
        
        // Find or create user in our database
        const phoneClean = phone?.replace(/\D/g, '').slice(-10) || userInfo.phoneNumber?.replace(/\D/g, '').slice(-10);
        
        let user = await db.collection('users').findOne({ phone: phoneClean });
        
        if (!user) {
          // Create new user
          const newUser = {
            id: 'u-' + uuidv4().slice(0, 8),
            name: userInfo.displayName || '',
            email: userInfo.email || '',
            phone: phoneClean,
            role: 'customer',
            createdAt: new Date().toISOString(),
          };
          await db.collection('users').insertOne(newUser);
          user = newUser;
        }
        
        // Generate our JWT
        const token = signToken({ uid: user.id, email: user.email, role: user.role });
        
        return json({
          ok: true,
          token,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            role: user.role,
          },
        });
      } catch (error) {
        console.error('Firebase verify error:', error);
        return json({ ok: false, error: error.message }, 500);
      }
    }

    // ============================================
    // NEW: Link Account (requires auth)
    // ============================================
    if (path === 'auth/link-account') {
      return await handleLinkAccount(req, db, json, verifyToken);
    }

    // Rider: create (admin only) — uses 6-digit PIN, no email/password
    if (path === 'riders') {
      const admin = await requireAdmin(req, db);
      if (admin.error) return admin.error;
      const { name, phone, vehicleNumber } = body;
      if (!name || !phone) return json({ ok: false, error: 'Name and phone are required' }, 400);
      // Generate unique 6-digit login code
      let loginCode;
      for (let i = 0; i < 10; i++) {
        loginCode = Math.floor(100000 + Math.random() * 900000).toString();
        const dup = await db.collection('users').findOne({ loginCode });
        if (!dup) break;
      }
      const id = 'rider-' + uuidv4().slice(0, 8);
      const phoneClean = String(phone).replace(/\D/g, '').slice(-10);
      // Check duplicate phone
      const existing = await db.collection('users').findOne({ phone: phoneClean, role: 'rider' });
      if (existing) return json({ ok: false, error: 'A rider with this phone already exists' }, 409);
      const rider = {
        id, name: name.trim(), email: `${id}@rider.local`, phone: phoneClean,
        vehicleNumber: (vehicleNumber || '').trim(),
        role: 'rider', status: 'active', loginCode,
        createdAt: new Date().toISOString(),
      };
      await db.collection('users').insertOne({ ...rider });
      return json({ ok: true, rider: { id, name: rider.name, phone: rider.phone, vehicleNumber: rider.vehicleNumber, loginCode, role: 'rider', status: 'active' } });
    }

    // Rider: login by PIN code
    if (path === 'riders/login') {
      const rl = rateLimit(getClientIp(req), 'rider-login', 10, 60000);
      if (rl.limited) return json({ ok: false, error: `Too many attempts. Try again in ${rl.retryAfter}s.` }, 429);
      const code = String(body.code || '').trim();
      if (!/^\d{6}$/.test(code)) return json({ ok: false, error: 'Enter the 6-digit code' }, 400);
      const user = await db.collection('users').findOne({ loginCode: code, role: 'rider' });
      if (!user) return json({ ok: false, error: 'Invalid code' }, 401);
      if (user.status === 'inactive') return json({ ok: false, error: 'Account is inactive. Contact admin.' }, 403);
      const token = signToken({ uid: user.id, email: user.email, role: user.role });
      return json({ ok: true, token, user: { id: user.id, name: user.name, phone: user.phone, role: user.role, vehicleNumber: user.vehicleNumber || '' } });
    }

    // Rider: regenerate PIN (admin)
    if (path.startsWith('riders/') && path.endsWith('/regenerate-code')) {
      const admin = await requireAdmin(req, db);
      if (admin.error) return admin.error;
      const id = path.replace('riders/', '').replace('/regenerate-code', '');
      let loginCode;
      for (let i = 0; i < 10; i++) {
        loginCode = Math.floor(100000 + Math.random() * 900000).toString();
        const dup = await db.collection('users').findOne({ loginCode });
        if (!dup) break;
      }
      await db.collection('users').updateOne({ id, role: 'rider' }, { $set: { loginCode, updatedAt: new Date().toISOString() } });
      return json({ ok: true, loginCode });
    }

    if (path === 'orders') {
      const result = await finalizeOrder(db, body, {
        paymentMethod: body.payment === 'COD' ? 'COD' : 'Online',
        paymentStatus: body.payment === 'COD' ? 'Pending' : 'Paid',
        status: 'Pending',
      });
      if (result && result.error === 'insufficient_stock') {
        return json({ ok: false, error: 'insufficient_stock', shortages: result.shortages }, 409);
      }
      if (result && result.error) {
        return json({ ok: false, error: result.error }, 400);
      }
      return json({ order: result });
    }

    if (path === 'products') {
      const id = body.id || ('p-' + uuidv4().slice(0, 8));
      const cleanImages = sanitizeImages(body.images);
      const product = {
        id, name: body.name || 'Untitled Product',
        slug: (body.name || 'product').toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        category: body.category || 'medicines',
        brand: body.brand || 'Generic', manufacturer: body.manufacturer || '',
        price: Number(body.price) || 0, mrp: Number(body.mrp) || Number(body.price) || 0,
        packSize: body.packSize || '',
        image: cleanImages[0] || '',
        images: cleanImages,
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

    // Chunked import: init → chunk (repeat) → finalize (avoids 413 on large XLS/CSV)
    if (path === 'admin/import/init') {
      const admin = await requireAdmin(req, db);
      if (admin.error) return admin.error;
      const total = Number(body.total) || 0;
      if (!total) return json({ ok: false, error: 'total required' }, 400);
      if (total > 50000) return json({ ok: false, error: 'Too many rows in one import (max 50k)' }, 400);

      const now = new Date().toISOString();
      const jobId = 'imp-' + uuidv4().slice(0, 8);
      const expectedChunks = Math.ceil(total / BULK_IMPORT_LIMIT);

      await db.collection('import_jobs').insertOne({
        id: jobId,
        status: 'uploading',
        total,
        processed: 0,
        created: 0,
        updated: 0,
        failed: 0,
        errors: [],
        createdAt: now,
        updatedAt: now,
        startedAt: null,
        completedAt: null,
        chunkSize: BULK_IMPORT_LIMIT,
        pendingChunks: expectedChunks,
        expectedChunks,
        uploadedChunks: 0,
        initiatedBy: admin.user?.id || 'admin',
        initiatedEmail: admin.user?.email || '',
      });
      return json({ ok: true, jobId, total, expectedChunks });
    }

    if (path === 'admin/import/chunk') {
      const admin = await requireAdmin(req, db);
      if (admin.error) return admin.error;
      const jobId = body.jobId;
      const index = Number(body.index);
      const chunkRows = Array.isArray(body.rows) ? body.rows : [];
      if (!jobId || Number.isNaN(index)) return json({ ok: false, error: 'jobId and index required' }, 400);
      if (!chunkRows.length) return json({ ok: false, error: 'rows array required' }, 400);
      if (chunkRows.length > BULK_IMPORT_LIMIT) {
        return json({ ok: false, error: `Max ${BULK_IMPORT_LIMIT} rows per chunk` }, 400);
      }
      const chunkBytes = Buffer.byteLength(JSON.stringify(chunkRows), 'utf8');
      if (chunkBytes > 4 * 1024 * 1024) {
        return json({ ok: false, error: 'Chunk too large (>4MB). Try a file with shorter descriptions.' }, 413);
      }

      const job = await db.collection('import_jobs').findOne({ id: jobId });
      if (!job) return json({ ok: false, error: 'Job not found' }, 404);
      if (job.status !== 'uploading') return json({ ok: false, error: 'Job is not accepting uploads' }, 400);

      const now = new Date().toISOString();
      await db.collection('import_job_chunks').updateOne(
        { jobId, index },
        { $set: { jobId, index, rows: chunkRows, createdAt: now } },
        { upsert: true }
      );
      const uploadedChunks = await db.collection('import_job_chunks').countDocuments({ jobId });
      await db.collection('import_jobs').updateOne(
        { id: jobId },
        { $set: { uploadedChunks, updatedAt: now } }
      );
      return json({ ok: true, jobId, index, uploadedChunks, expectedChunks: job.expectedChunks || 0 });
    }

    if (path === 'admin/import/finalize') {
      const admin = await requireAdmin(req, db);
      if (admin.error) return admin.error;
      const jobId = body.jobId;
      if (!jobId) return json({ ok: false, error: 'jobId required' }, 400);

      const job = await db.collection('import_jobs').findOne({ id: jobId });
      if (!job) return json({ ok: false, error: 'Job not found' }, 404);
      if (job.status !== 'uploading') return json({ ok: false, error: 'Job already finalized' }, 400);

      const uploadedChunks = await db.collection('import_job_chunks').countDocuments({ jobId });
      const expected = job.expectedChunks || 0;
      if (uploadedChunks < expected) {
        return json({ ok: false, error: `Incomplete upload: ${uploadedChunks}/${expected} batches received` }, 400);
      }

      await db.collection('import_jobs').updateOne(
        { id: jobId },
        { $set: { status: 'queued', pendingChunks: uploadedChunks, updatedAt: new Date().toISOString() } }
      );
      startImportProcessor();
      return json({ ok: true, jobId, total: job.total });
    }

    // Legacy single-request import (small files only, ≤12MB)
    if (path === 'admin/import/start') {
      const admin = await requireAdmin(req, db);
      if (admin.error) return admin.error;
      const rows = Array.isArray(body.rows) ? body.rows : [];
      if (!rows.length) return json({ ok: false, error: 'rows array required' }, 400);
      if (rows.length > 50000) return json({ ok: false, error: 'Too many rows in one import (max 50k)' }, 400);
      const estimateBytes = Buffer.byteLength(JSON.stringify(rows), 'utf8');
      if (estimateBytes > 12 * 1024 * 1024) {
        return json({ ok: false, error: 'Import payload too large (>12MB). The app will auto-chunk large files — please refresh and try again.' }, 413);
      }

      const now = new Date().toISOString();
      const jobId = 'imp-' + uuidv4().slice(0, 8);
      const chunkSize = BULK_IMPORT_LIMIT;
      const chunks = [];
      for (let i = 0; i < rows.length; i += chunkSize) {
        const slice = rows.slice(i, i + chunkSize);
        chunks.push({ jobId, index: chunks.length, rows: slice, createdAt: now });
      }

      const jobDoc = {
        id: jobId,
        status: 'queued',
        total: rows.length,
        processed: 0,
        created: 0,
        updated: 0,
        failed: 0,
        errors: [],
        createdAt: now,
        updatedAt: now,
        startedAt: null,
        completedAt: null,
        chunkSize,
        pendingChunks: chunks.length,
        expectedChunks: chunks.length,
        uploadedChunks: chunks.length,
        initiatedBy: admin.user?.id || 'admin',
        initiatedEmail: admin.user?.email || '',
      };

      await db.collection('import_jobs').insertOne(jobDoc);
      if (chunks.length > 0) {
        await db.collection('import_job_chunks').insertMany(chunks, { ordered: true });
      }

      startImportProcessor();
      return json({ ok: true, jobId, total: rows.length });
    }

    // Bulk product import (with upsert - update existing or create new)
    if (path === 'products/bulk') {
      const results = await bulkImportProducts(db, body.products || []);
      return json(results);
    }

    if (path === 'slots') {
      const id = 'slot-' + uuidv4().slice(0, 6);
      const slot = { id, label: body.label || `${body.startTime} - ${body.endTime}`, startTime: body.startTime || '09:00', endTime: body.endTime || '11:00', capacity: Number(body.capacity) || 10, active: body.active !== false, createdAt: new Date().toISOString() };
      await db.collection('slots').insertOne({ ...slot });
      return json({ slot });
    }

    if (path === 'categories') {
      const admin = await requireAdmin(req, db);
      if (admin.error) return admin.error;
      const id = 'cat-' + uuidv4().slice(0, 8);
      const cat = {
        id,
        name: body.name || 'Untitled',
        slug: (body.name || 'untitled').toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        parentCategoryId: body.parentCategoryId || null,
        type: body.type || 'main',
        icon: body.icon || null,
        image: body.image || null,
        description: body.description || '',
        sortOrder: Number(body.sortOrder) || 0,
        createdAt: new Date().toISOString(),
      };
      await db.collection('categories').insertOne({ ...cat });
      return json({ category: cat });
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
      const auth = await requireAuth(req, db);
      if (auth.error) return auth.error;
      const id = 'RX-' + Date.now().toString(36).toUpperCase();
      const doc = {
        id, userId: auth.user.id, patientName: body.patientName || '', phone: body.phone || '',
        notes: body.notes || '', fileName: body.fileName || '', fileDataUrl: body.fileDataUrl || '',
        status: 'Under Review', createdAt: new Date().toISOString(),
      };
      await db.collection('prescriptions').insertOne({ ...doc });
      const safe = { ...doc }; delete safe.fileDataUrl;
      return json({ prescription: safe }, 200, 'none');
    }
    if (path.startsWith('prescriptions/') && path.endsWith('/messages')) {
      const auth = await requireAuth(req, db);
      if (auth.error) return auth.error;
      const id = path.split('/')[1];
      // Only admin or owner of the prescription can post
      const rx = await db.collection('prescriptions').findOne({ id }, { projection: { _id: 0, userId: 1 } });
      const isAdmin = auth.user.role === 'admin';
      if (!rx || (!isAdmin && rx.userId !== auth.user.id)) return json({ ok: false, error: 'Forbidden' }, 403, 'none');
      const msg = { id: 'msg-' + uuidv4().slice(0, 8), prescriptionId: id, sender: isAdmin ? 'admin' : 'user', authorName: body.authorName || (isAdmin ? 'Pharmacist' : 'Customer'), text: String(body.text || '').slice(0, 1000), createdAt: new Date().toISOString() };
      await db.collection('rx_messages').insertOne({ ...msg });
      return json({ message: msg }, 200, 'none');
    }

    // Chat: start or get user's open thread
    if (path === 'chat/thread') {
      const auth = await requireAuth(req, db);
      if (auth.error) return auth.error;
      const { userName, userEmail } = body;
      let thread = await db.collection('chat_threads').findOne({ userId: auth.user.id, status: 'open' }, { projection: { _id: 0 } });
      if (!thread) {
        thread = {
          id: 'ct-' + uuidv4().slice(0, 10),
          userId: auth.user.id,
          userName: userName || auth.user.name || 'Customer',
          userEmail: userEmail || auth.user.email || '',
          status: 'open',
          unreadAdmin: false,
          unreadUser: false,
          lastMessageAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        };
        await db.collection('chat_threads').insertOne({ ...thread });
      }
      return json({ thread }, 200, 'none');
    }

    // Chat: post a message (sender: 'user' | 'admin')
    if (path === 'chat/messages') {
      const auth = await requireAuth(req, db);
      if (auth.error) return auth.error;
      const { threadId, text } = body;
      if (!threadId || !text) return json({ ok: false, error: 'threadId and text required' }, 400);
      const thread = await db.collection('chat_threads').findOne({ id: threadId }, { projection: { _id: 0, userId: 1 } });
      if (!thread) return json({ ok: false, error: 'Thread not found' }, 404);
      const isAdmin = auth.user.role === 'admin';
      if (!isAdmin && thread.userId !== auth.user.id) return json({ ok: false, error: 'Forbidden' }, 403, 'none');
      const msg = {
        id: 'cm-' + uuidv4().slice(0, 10),
        threadId,
        sender: isAdmin ? 'admin' : 'user',
        authorName: isAdmin ? 'Pharmacist' : (auth.user.name || 'Customer'),
        text: String(text).slice(0, 2000),
        createdAt: new Date().toISOString(),
      };
      await db.collection('chat_messages').insertOne({ ...msg });
      const setUnread = msg.sender === 'user' ? { unreadAdmin: true, unreadUser: false } : { unreadAdmin: false, unreadUser: true };
      await db.collection('chat_threads').updateOne({ id: threadId }, { $set: { lastMessageAt: msg.createdAt, lastMessageText: msg.text, ...setUnread } });
      return json({ message: msg }, 200, 'none');
    }

    if (path === 'addresses') {
      const auth = await requireAuth(req, db);
      if (auth.error) return auth.error;
      const id = 'ADDR-' + uuidv4().slice(0, 8).toUpperCase();
      const addr = { id, userId: auth.user.id, ...body, createdAt: new Date().toISOString() };
      await db.collection('addresses').insertOne({ ...addr });
      return json({ address: addr }, 200, 'none');
    }

    if (path === 'seed/reset') {
      const admin = await requireAdmin(req, db);
      if (admin.error) return admin.error;
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
  const p = await params;
  const path = (p?.path || []).join('/');
  try {
    const db = await getDb();
    const body = await req.json().catch(() => ({}));

    if (path.startsWith('products/')) {
      const id = path.replace('products/', '');
      const current = await db.collection('products').findOne({ id });
      if (!current) return json({ error: 'Product not found' }, 404);
      const update = { ...body }; delete update._id; delete update.id;
      if (body.images) {
        const cleanImages = sanitizeImages(body.images);
        update.images = cleanImages;
        update.image = cleanImages[0] || '';
      }
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
      const admin = await requireAdmin(req, db);
      if (admin.error) return admin.error;
      const update = { ...body }; delete update._id;
      if (update.logo && typeof update.logo === 'string' && update.logo.startsWith('data:')) {
        return json({ ok: false, error: 'Logo must be a URL, not base64. Use /api/upload first.' }, 400);
      }
      update.updatedAt = new Date().toISOString();
      await db.collection('settings').updateOne({ id: 'main' }, { $set: update }, { upsert: true });
      const settings = await db.collection('settings').findOne({ id: 'main' }, { projection: { _id: 0 } });
      return json({ settings });
    }

    // Admin verify prescription (approve/reject) — adds pharmacistId + notes
    // PUT /api/admin/prescriptions/:id/verify  Body: { decision: 'approved'|'rejected', notes? }
    if (path.startsWith('admin/prescriptions/') && path.endsWith('/verify')) {
      const admin = await requireAdmin(req, db);
      if (admin.error) return admin.error;
      const id = path.split('/')[2];
      const decision = String(body.decision || '').toLowerCase();
      if (!['approved', 'rejected'].includes(decision)) {
        return json({ ok: false, error: "decision must be 'approved' or 'rejected'" }, 400);
      }
      const notes = String(body.notes || '').slice(0, 1000) || null;
      const now = new Date().toISOString();
      const update = {
        verificationStatus: decision,
        status: decision === 'approved' ? 'Approved' : 'Rejected',
        pharmacistId: admin.user.id,
        verificationNotes: notes,
        verifiedAt: now,
        updatedAt: now,
      };
      const r = await db.collection('prescriptions').updateOne({ id }, { $set: update });
      if (r.matchedCount === 0) return json({ ok: false, error: 'Not found' }, 404);
      const prescription = await db.collection('prescriptions').findOne(
        { id }, { projection: { _id: 0, fileDataUrl: 0, filePath: 0, sha256: 0 } }
      );
      await rxAuditLog(db, {
        action: `verify.${decision}`,
        prescriptionId: id,
        userId: admin.user.id, role: 'admin', ip: getClientIp(req),
        meta: { notes },
      });
      return json({ ok: true, prescription });
    }

    if (path.startsWith('categories/')) {
      const admin = await requireAdmin(req, db);
      if (admin.error) return admin.error;
      const id = path.replace('categories/', '');
      const update = { ...body }; delete update._id; delete update.id;
      if (update.name) update.slug = update.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      update.updatedAt = new Date().toISOString();
      await db.collection('categories').updateOne({ id }, { $set: update });
      const category = await db.collection('categories').findOne({ id }, { projection: { _id: 0 } });
      return json({ category });
    }

    if (path === 'admin/password' || path === 'auth/password') {
      const token = getBearer(req);
      const auth = verifyToken(token);
      if (!auth) return json({ ok: false, error: 'Unauthorized' }, 401);
      const user = await db.collection('users').findOne({ id: auth.uid });
      if (!user) return json({ ok: false }, 401);
      const { current, next } = body;
      const cur = hashPassword(current || '', user.salt);
      if (cur !== user.hash) return json({ ok: false, error: 'Current password is incorrect' }, 400);
      if (!next || next.length < 6) return json({ ok: false, error: 'New password must be at least 6 characters' }, 400);
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = hashPassword(next, salt);
      await db.collection('users').updateOne({ id: auth.uid }, { $set: { salt, hash, updatedAt: new Date().toISOString() } });
      return json({ ok: true });
    }

    // Rider: update (admin)
    if (path.startsWith('riders/')) {
      const riderId = path.replace('riders/', '');
      const admin = await requireAdmin(req, db);
      if (admin.error) return admin.error;
      const update = { ...body }; delete update._id; delete update.id; delete update.hash; delete update.salt;
      update.updatedAt = new Date().toISOString();
      await db.collection('users').updateOne({ id: riderId, role: 'rider' }, { $set: update });
      const rider = await db.collection('users').findOne({ id: riderId }, { projection: { _id: 0, hash: 0, salt: 0 } });
      return json({ ok: true, rider });
    }

    // Order: assign rider (admin)
    if (path.startsWith('orders/') && path.endsWith('/assign')) {
      const id = path.replace('orders/', '').replace('/assign', '');
      const admin = await requireAdmin(req, db);
      if (admin.error) return admin.error;
      const { riderId, status } = body;
      const update = { updatedAt: new Date().toISOString() };
      if (riderId !== undefined) {
        update.riderId = riderId || null;
        update.riderAssignedAt = riderId ? new Date().toISOString() : null;
        if (riderId) {
          update.status = status || 'Confirmed';
          update.trackingSteps = [
            { label: 'Order Confirmed', done: true },
            { label: 'Packed', done: true },
            { label: 'Out for Delivery', done: false },
            { label: 'Delivered', done: false },
          ];
        }
      }
      await db.collection('orders').updateOne({ id }, { $set: update });
      const order = await db.collection('orders').findOne({ id }, { projection: { _id: 0 } });
      return json({ ok: true, order });
    }

    // Order: rider claims an unassigned order (self-assign)
    if (path.startsWith('orders/') && path.endsWith('/claim')) {
      const id = path.replace('orders/', '').replace('/claim', '');
      const rider = await requireRider(req, db);
      if (rider.error) return rider.error;
      const order = await db.collection('orders').findOne({ id }, { projection: { _id: 0 } });
      if (!order) return json({ ok: false, error: 'Order not found' }, 404);
      if (order.riderId && order.riderId !== rider.user.id) return json({ ok: false, error: 'Order already claimed by another rider' }, 409);
      if (['Delivered', 'Cancelled'].includes(order.status)) return json({ ok: false, error: 'Order is closed' }, 400);
      const now = new Date().toISOString();
      const update = {
        riderId: rider.user.id,
        riderAssignedAt: now,
        status: order.status === 'Pending' ? 'Confirmed' : order.status,
        updatedAt: now,
        trackingSteps: [
          { label: 'Order Confirmed', done: true },
          { label: 'Packed', done: true },
          { label: 'Out for Delivery', done: false },
          { label: 'Delivered', done: false },
        ],
      };
      await db.collection('orders').updateOne({ id }, { $set: update });
      const updated = await db.collection('orders').findOne({ id }, { projection: { _id: 0 } });
      return json({ ok: true, order: updated });
    }

    // Order: rider updates status (rider only)
    if (path.startsWith('orders/') && path.endsWith('/rider-status')) {
      const id = path.replace('orders/', '').replace('/rider-status', '');
      const rider = await requireRider(req, db);
      if (rider.error) return rider.error;
      const { status, otp } = body;
      const order = await db.collection('orders').findOne({ id }, { projection: { _id: 0 } });
      if (!order) return json({ ok: false, error: 'Order not found' }, 404);
      if (order.riderId !== rider.user.id) return json({ ok: false, error: 'Order not assigned to you' }, 403);
      // Validate status transitions: Confirmed -> Out for Delivery -> Delivered (no backwards)
      const allowedTransitions = {
        'Confirmed': ['Out for Delivery'],
        'Pending': ['Out for Delivery'],
        'Out for Delivery': ['Delivered'],
        'Delivered': [],
        'Cancelled': [],
      };
      const currentAllowed = allowedTransitions[order.status] || [];
      if (!currentAllowed.includes(status)) {
        return json({ ok: false, error: `Cannot change status from ${order.status} to ${status}` }, 400);
      }
      const update = { status, updatedAt: new Date().toISOString() };
      if (status === 'Out for Delivery') {
        update.deliveryStartedAt = new Date().toISOString();
        update.trackingSteps = [
          { label: 'Order Confirmed', done: true },
          { label: 'Packed', done: true },
          { label: 'Out for Delivery', done: true, time: new Date().toISOString() },
          { label: 'Delivered', done: false },
        ];
      }
      if (status === 'Delivered') {
        update.deliveryCompletedAt = new Date().toISOString();
        update.trackingSteps = [
          { label: 'Order Confirmed', done: true },
          { label: 'Packed', done: true },
          { label: 'Out for Delivery', done: true },
          { label: 'Delivered', done: true, time: new Date().toISOString() },
        ];
      }
      await db.collection('orders').updateOne({ id }, { $set: update });
      const updated = await db.collection('orders').findOne({ id }, { projection: { _id: 0 } });
      return json({ ok: true, order: updated });
    }

    return json({ error: 'Not found' }, 404);
  } catch (e) {
    console.error('PUT error', e);
    return json({ error: e.message }, 500);
  }
}

export async function PATCH(req, { params }) {
  const p = await params;
  const path = (p?.path || []).join('/');
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
      // Admin-only, restricted fields only (status, notes, archive flag)
      const admin = await requireAdmin(req, db);
      if (admin.error) return admin.error;
      const id = path.replace('prescriptions/', '');
      const allowed = ['status', 'verificationNotes', 'archived'];
      const update = {};
      for (const k of allowed) if (k in body) update[k] = body[k];
      // Keep verificationStatus in sync with status
      if (body.status === 'Approved') update.verificationStatus = 'approved';
      else if (body.status === 'Rejected') update.verificationStatus = 'rejected';
      else if (body.status === 'Under Review') update.verificationStatus = 'pending';
      update.updatedAt = new Date().toISOString();
      await db.collection('prescriptions').updateOne({ id }, { $set: update });
      const prescription = await db.collection('prescriptions').findOne(
        { id },
        { projection: { _id: 0, fileDataUrl: 0, filePath: 0, sha256: 0 } }
      );
      await rxAuditLog(db, { action: 'patch', prescriptionId: id, userId: admin.user.id, role: 'admin', ip: getClientIp(req), meta: update });
      return json({ prescription });
    }

    return json({ error: 'Not found' }, 404);
  } catch (e) { return json({ error: e.message }, 500); }
}

export async function DELETE(req, { params }) {
  const p = await params;
  const path = (p?.path || []).join('/');
  try {
    const db = await getDb();
    // Compliance: prescriptions can never be deleted, only archived via PATCH
    if (path === 'admin/products/delete-all') {
      const admin = await requireAdmin(req, db);
      if (admin.error) return admin.error;
      const r = await db.collection('products').deleteMany({});
      await db.collection('inventory_logs').deleteMany({});
      return json({ ok: true, deleted: r.deletedCount || 0 });
    }

    if (path === 'admin/products/batch-delete') {
      const admin = await requireAdmin(req, db);
      if (admin.error) return admin.error;
      const { ids } = body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return json({ ok: false, error: 'ids array required' }, 400);
      }
      const r = await db.collection('products').deleteMany({ id: { $in: ids } });
      return json({ ok: true, deleted: r.deletedCount || 0 });
    }

    if (path.startsWith('prescriptions/')) {
      return json({ ok: false, error: 'Prescriptions cannot be deleted. Use archive instead.' }, 403);
    }
    if (path.startsWith('addresses/')) { await db.collection('addresses').deleteOne({ id: path.replace('addresses/', '') }); return json({ ok: true }); }
    if (path.startsWith('products/')) { 
      const id = path.replace('products/', '');
      console.log('[DELETE] Attempting to delete product with id:', id);
      const result = await db.collection('products').deleteOne({ id });
      console.log('[DELETE] Delete result:', result);
      return json({ ok: true, deleted: result.deletedCount });
    }
    if (path.startsWith('slots/')) { await db.collection('slots').deleteOne({ id: path.replace('slots/', '') }); return json({ ok: true }); }
    if (path.startsWith('categories/')) {
      const admin = await requireAdmin(req, db);
      if (admin.error) return admin.error;
      const id = path.replace('categories/', '');
      // Prevent deleting categories that have children
      const children = await db.collection('categories').countDocuments({ parentCategoryId: id });
      if (children > 0) return json({ ok: false, error: 'Delete subcategories first' }, 400);
      await db.collection('categories').deleteOne({ id });
      return json({ ok: true });
    }
    if (path.startsWith('riders/')) {
      const admin = await requireAdmin(req, db);
      if (admin.error) return admin.error;
      const id = path.replace('riders/', '');
      // Check if rider has active orders
      const activeOrders = await db.collection('orders').countDocuments({ riderId: id, status: { $nin: ['Delivered', 'Cancelled'] } });
      if (activeOrders > 0) return json({ ok: false, error: 'Rider has active orders. Reassign or complete them first.' }, 400);
      await db.collection('users').deleteOne({ id, role: 'rider' });
      return json({ ok: true });
    }
    return json({ error: 'Not found' }, 404);
  } catch (e) { return json({ error: e.message }, 500); }
}
