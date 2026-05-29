import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongo';
import { v4 as uuidv4 } from 'uuid';

function authError() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

// POST /api/sync/batch
// Optimized for 100k+ products using MongoDB bulkWrite
// Body: { products: [ { id?, name, brand, category, price, mrp, stock, packSize, ... } ] }
// Header: x-api-key: <SYNC_API_KEY>
export async function POST(req) {
  try {
    const expectedKey = process.env.SYNC_API_KEY;
    if (!expectedKey) {
      return NextResponse.json({ error: 'Sync not configured. Set SYNC_API_KEY in environment.' }, { status: 503 });
    }
    const apiKey = req.headers.get('x-api-key');
    if (apiKey !== expectedKey) return authError();

    const body = await req.json().catch(() => ({}));
    const products = Array.isArray(body.products) ? body.products : [];

    if (!products.length) {
      return NextResponse.json({ error: 'No products provided. Send { products: [...] }' }, { status: 400 });
    }

    const db = await getDb();
    const now = new Date().toISOString();
    const results = { created: 0, updated: 0, errors: [], duration: 0 };
    const startTime = Date.now();

    // Build bulk operations
    const operations = [];
    const errors = [];

    for (const raw of products) {
      try {
        if (!raw.name) {
          errors.push({ raw, error: 'name is required' });
          continue;
        }

        const product = {
          name: String(raw.name).trim(),
          brand: String(raw.brand || '').trim(),
          category: String(raw.category || 'Uncategorized').trim(),
          subcategory: raw.subcategory ? String(raw.subcategory).trim() : '',
          price: Number(raw.price) || 0,
          mrp: Number(raw.mrp || raw.price) || 0,
          stock: Number(raw.stock ?? 0),
          packSize: String(raw.packSize || raw.pack_size || '').trim(),
          description: String(raw.description || '').trim(),
          prescription: Boolean(raw.prescription),
          image: raw.image || raw.imageUrl || '',
          tags: Array.isArray(raw.tags) ? raw.tags : [],
          updatedAt: now,
          syncedAt: now,
        };

        // Handle variants
        if (Array.isArray(raw.variants) && raw.variants.length) {
          product.hasVariants = true;
          product.variants = raw.variants.map(v => ({
            id: v.id || uuidv4().slice(0, 8),
            packSize: String(v.packSize || v.pack_size || ''),
            price: Number(v.price) || product.price,
            mrp: Number(v.mrp) || product.mrp,
            stock: Number(v.stock ?? 0),
          }));
          product.price = Math.min(...product.variants.map(v => v.price));
          product.mrp = Math.min(...product.variants.map(v => v.mrp));
          product.stock = product.variants.reduce((s, v) => s + v.stock, 0);
        }

        const lookupId = raw.id || raw.externalId || raw.sku;
        const newId = lookupId || ('P-' + uuidv4().slice(0, 8).toUpperCase());

        // Upsert operation: update if exists, insert if not
        operations.push({
          updateOne: {
            filter: lookupId ? { $or: [{ id: lookupId }, { externalId: lookupId }] } : { name: product.name, brand: product.brand },
            update: {
              $set: product,
              $setOnInsert: { id: newId, externalId: lookupId || null, createdAt: now },
            },
            upsert: true,
          },
        });
      } catch (err) {
        errors.push({ name: raw.name, error: err.message });
      }
    }

    // Execute bulk operations in chunks (MongoDB has a limit per request)
    const CHUNK_SIZE = 1000;
    let totalModified = 0;
    let totalUpserted = 0;

    for (let i = 0; i < operations.length; i += CHUNK_SIZE) {
      const chunk = operations.slice(i, i + CHUNK_SIZE);
      const bulkResult = await db.collection('products').bulkWrite(chunk);
      totalModified += bulkResult.modifiedCount || 0;
      totalUpserted += bulkResult.upsertedCount || 0;
    }

    results.created = totalUpserted;
    results.updated = totalModified;
    results.errors = errors;
    results.duration = Date.now() - startTime;

    return NextResponse.json({
      ok: true,
      created: results.created,
      updated: results.updated,
      errors: results.errors,
      duration: `${results.duration}ms`,
      syncedAt: now,
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
