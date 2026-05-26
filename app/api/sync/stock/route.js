import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongo';

// POST /api/sync/stock
// Fast bulk stock-only update (no product details needed)
// Body: { stock: [ { id, stock } ] }  OR  { stock: [ { name, brand, stock } ] }
// Header: x-api-key: <SYNC_API_KEY>
export async function POST(req) {
  try {
    const expectedKey = process.env.SYNC_API_KEY;
    if (!expectedKey) {
      return NextResponse.json({ error: 'Sync not configured. Set SYNC_API_KEY in environment.' }, { status: 503 });
    }
    const apiKey = req.headers.get('x-api-key');
    if (apiKey !== expectedKey) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const items = Array.isArray(body.stock) ? body.stock : [];

    if (!items.length) {
      return NextResponse.json({ error: 'No stock items provided. Send { stock: [{ id, stock }] }' }, { status: 400 });
    }

    const db = await getDb();
    const now = new Date().toISOString();
    let updated = 0;
    let notFound = 0;

    for (const item of items) {
      const qty = Number(item.stock ?? item.qty ?? 0);
      let filter = null;

      if (item.id || item.externalId || item.sku) {
        const lookupId = item.id || item.externalId || item.sku;
        filter = { $or: [{ id: lookupId }, { externalId: lookupId }] };
      } else if (item.name) {
        filter = { name: item.name };
        if (item.brand) filter = { name: item.name, brand: item.brand };
      }

      if (!filter) continue;

      const result = await db.collection('products').updateOne(
        filter,
        { $set: { stock: qty, updatedAt: now, syncedAt: now } }
      );

      if (result.matchedCount > 0) updated++;
      else notFound++;
    }

    return NextResponse.json({ ok: true, updated, notFound, syncedAt: now });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
