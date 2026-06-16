import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongo';
import { normalizeEnrichmentKey } from '@/lib/enrichment/catalogLookup';

function authError() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

/**
 * POST /api/sync/enrichment
 * Bulk upsert enrichment catalog (from shop PC enrichment pipeline).
 * Does NOT touch stock/price.
 */
export async function POST(req) {
  try {
    const expectedKey = process.env.SYNC_API_KEY;
    if (!expectedKey) {
      return NextResponse.json({ error: 'Sync not configured. Set SYNC_API_KEY.' }, { status: 503 });
    }
    if (req.headers.get('x-api-key') !== expectedKey) return authError();

    const body = await req.json().catch(() => ({}));
    const records = Array.isArray(body.records) ? body.records : [];

    if (!records.length) {
      return NextResponse.json({ error: 'No records. Send { records: [...] }' }, { status: 400 });
    }

    const db = await getDb();
    const now = new Date().toISOString();
    let upserted = 0;
    const errors = [];

    for (const raw of records) {
      try {
        const productCode = raw.productCode != null
          ? String(raw.productCode).trim()
          : (raw.rms_id || raw.externalId ? String(raw.rms_id || raw.externalId).trim() : null);

        const name = String(raw.name || raw.product_name || '').trim();
        const brand = String(raw.brand || raw.manufacturer || '').trim();
        if (!productCode && !name) {
          errors.push({ raw, error: 'productCode or name required' });
          continue;
        }

        const doc = {
          productCode: productCode || null,
          name,
          brand,
          nameKey: normalizeEnrichmentKey(name, brand),
          description: raw.description || null,
          composition: raw.composition || null,
          prescriptionRequired: raw.prescriptionRequired ?? raw.prescription_required ?? null,
          category: raw.category || null,
          imageUrl: raw.imageUrl || raw.image_url || null,
          cloudinaryUrl: raw.cloudinaryUrl || raw.cloudinary_url || null,
          additionalImages: Array.isArray(raw.additionalImages) ? raw.additionalImages : [],
          confidence: Number(raw.confidence ?? raw.confidence_score) || null,
          matchMethod: raw.matchMethod || raw.match_method || null,
          updatedAt: now,
        };

        const filter = productCode
          ? { productCode }
          : { nameKey: doc.nameKey };

        await db.collection('enrichment_catalog').updateOne(
          filter,
          { $set: doc, $setOnInsert: { createdAt: now } },
          { upsert: true }
        );
        upserted++;
      } catch (err) {
        errors.push({ name: raw.name, error: err.message });
      }
    }

    await db.collection('enrichment_catalog').createIndex({ productCode: 1 }, { unique: true, sparse: true });
    await db.collection('enrichment_catalog').createIndex({ nameKey: 1 });

    return NextResponse.json({
      ok: true,
      upserted,
      errors: errors.slice(0, 20),
      syncedAt: now,
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
