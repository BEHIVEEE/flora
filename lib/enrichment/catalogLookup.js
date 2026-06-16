/**
 * Lookup pre-synced enrichment data (from shop PC pipeline).
 * Keyed by Product Code and name|brand — no extra CSV columns required.
 */

export function normalizeEnrichmentKey(name, brand = '') {
  const n = String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const b = String(brand || 'Generic')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return `${n}|${b}`;
}

/**
 * Load enrichment rows for a batch of import items.
 */
export async function loadEnrichmentCatalogBatch(db, items = []) {
  const codes = [...new Set(
    items
      .map(r => r.externalId || r.productCode || r['Product Code'])
      .filter(Boolean)
      .map(c => String(c).trim())
  )];
  const nameKeys = [...new Set(
    items
      .filter(r => r.name)
      .map(r => normalizeEnrichmentKey(r.name, r.brand))
  )];

  const or = [];
  if (codes.length) or.push({ productCode: { $in: codes } });
  if (nameKeys.length) or.push({ nameKey: { $in: nameKeys } });
  if (!or.length) return { byCode: new Map(), byNameKey: new Map() };

  const rows = await db.collection('enrichment_catalog')
    .find({ $or: or })
    .toArray();

  const byCode = new Map();
  const byNameKey = new Map();
  for (const row of rows) {
    if (row.productCode) byCode.set(String(row.productCode), row);
    if (row.nameKey) byNameKey.set(row.nameKey, row);
  }
  return { byCode, byNameKey };
}

export function lookupEnrichment(catalog, raw) {
  const code = raw.externalId || raw.productCode || raw['Product Code'];
  if (code && catalog.byCode.has(String(code).trim())) {
    return catalog.byCode.get(String(code).trim());
  }
  if (raw.name) {
    const key = normalizeEnrichmentKey(raw.name, raw.brand);
    if (catalog.byNameKey.has(key)) return catalog.byNameKey.get(key);
  }
  return null;
}

/** Merge enrichment into product fields. RMS/CSV values win if already present. */
export function mergeEnrichmentFields(raw, existing = {}, enrich) {
  if (!enrich) return { merged: false, fields: {} };

  const has = (v) => v != null && String(v).trim() !== '';
  const out = {};

  if (!has(raw.description) && !has(existing.description) && enrich.description) {
    out.description = enrich.description;
  }
  if (!has(raw.imageUrl) && !has(raw.image) && !has(existing.image)) {
    const img = enrich.cloudinaryUrl || enrich.imageUrl;
    if (img) {
      out.image = img;
      out.images = enrich.additionalImages?.length
        ? [img, ...enrich.additionalImages]
        : [img];
    }
  }
  if (enrich.composition) out.composition = enrich.composition;
  if (enrich.prescriptionRequired != null && !has(raw.prescription)) {
    out.prescription = /yes|required|true|1/i.test(String(enrich.prescriptionRequired));
  }
  if (enrich.category && !has(raw.category)) {
    out.enrichedCategory = enrich.category;
  }

  return { merged: Object.keys(out).length > 0, fields: out };
}
