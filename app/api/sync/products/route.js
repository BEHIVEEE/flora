import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongo';
import { v4 as uuidv4 } from 'uuid';

function authError() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

// POST /api/sync/products
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
    const products = Array.isArray(body.products) ? body.products : body.product ? [body.product] : [];

    if (!products.length) {
      return NextResponse.json({ error: 'No products provided. Send { products: [...] }' }, { status: 400 });
    }

    const db = await getDb();
    const now = new Date().toISOString();
    const results = { created: 0, updated: 0, errors: [] };

    for (const raw of products) {
      try {
        if (!raw.name) { results.errors.push({ raw, error: 'name is required' }); continue; }

        // Normalise fields
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

        // Handle variants if provided
        if (Array.isArray(raw.variants) && raw.variants.length) {
          product.hasVariants = true;
          product.variants = raw.variants.map(v => ({
            id: v.id || uuidv4().slice(0, 8),
            packSize: String(v.packSize || v.pack_size || ''),
            price: Number(v.price) || product.price,
            mrp: Number(v.mrp) || product.mrp,
            stock: Number(v.stock ?? 0),
          }));
          // Derive base price/stock from variants
          product.price = Math.min(...product.variants.map(v => v.price));
          product.mrp = Math.min(...product.variants.map(v => v.mrp));
          product.stock = product.variants.reduce((s, v) => s + v.stock, 0);
        }

        // If external id provided, use it; otherwise look up by name+brand
        const lookupId = raw.id || raw.externalId || raw.sku;
        let existing = null;

        if (lookupId) {
          existing = await db.collection('products').findOne({ $or: [{ id: lookupId }, { externalId: lookupId }] });
        }
        if (!existing) {
          existing = await db.collection('products').findOne({ name: product.name, brand: product.brand });
        }

        if (existing) {
          await db.collection('products').updateOne(
            { id: existing.id },
            { $set: product }
          );
          results.updated++;
        } else {
          const newId = lookupId || ('P-' + uuidv4().slice(0, 8).toUpperCase());
          await db.collection('products').insertOne({
            ...product,
            id: newId,
            externalId: lookupId || null,
            createdAt: now,
          });
          results.created++;
        }
      } catch (err) {
        results.errors.push({ name: raw.name, error: err.message });
      }
    }

    return NextResponse.json({
      ok: true,
      created: results.created,
      updated: results.updated,
      errors: results.errors,
      syncedAt: now,
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
