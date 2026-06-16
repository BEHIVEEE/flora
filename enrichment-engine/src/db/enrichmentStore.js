/**
 * Safe enrichment persistence — never writes to RMS product fields.
 * All enrichment lives in product_enrichment + product_match_mapping.
 */
import { batchInsert, query } from './pool.js';
import { dbLogger } from '../logger/index.js';

const ENRICHMENT_COLUMNS = [
  'product_id',
  'composition',
  'prescription_required',
  'description',
  'category',
  'image_url',
  'cloudinary_url',
  'confidence_score',
  'matched_product_name',
  'matched_database_id',
  'match_method',
  'review_status',
];

/** Upsert permanent match mapping (auto-matched only) */
export async function upsertMatchMappings(rows) {
  if (!rows.length) return;
  await batchInsert(
    'product_match_mapping',
    ['product_id', 'datarequisite_product_id', 'confidence_score', 'match_method'],
    rows,
    { onDuplicateUpdate: ['datarequisite_product_id', 'confidence_score', 'match_method'] }
  );
}

/** Upsert enrichment rows (matched, review, or rejected) */
export async function upsertProductEnrichment(rows) {
  if (!rows.length) return;
  await batchInsert(
    'product_enrichment',
    ENRICHMENT_COLUMNS,
    rows,
    {
      onDuplicateUpdate: [
        'composition',
        'prescription_required',
        'description',
        'category',
        'image_url',
        'confidence_score',
        'matched_product_name',
        'matched_database_id',
        'match_method',
        'review_status',
      ],
    }
  );
}

export function enrichmentRowFromMatchResult(r) {
  const dr = r.dr;
  const status = r.status === 'auto_matched'
    ? 'auto_matched'
    : r.status === 'review_required'
      ? 'review_required'
      : 'rejected';

  return [
    r.rms.id,
    dr?.composition ?? null,
    dr?.prescription_required ?? null,
    dr?.description ?? null,
    dr?.category ?? null,
    null, // image_url — filled after image lookup
    null, // cloudinary_url — filled after upload
    r.confidence ?? 0,
    dr?.name ?? null,
    dr?.id ?? null,
    r.method ?? null,
    status,
  ];
}

/** Set primary image URL on enrichment record */
export async function setEnrichmentImageUrl(productId, sourceUrl) {
  await query(
    `UPDATE product_enrichment SET image_url = ?, updated_at = NOW() WHERE product_id = ?`,
    [sourceUrl, productId]
  );
}

/** Set Cloudinary URL after upload (primary image only) */
export async function setEnrichmentCloudinaryUrl(productId, cloudinaryUrl) {
  await query(
    `UPDATE product_enrichment SET cloudinary_url = ?, updated_at = NOW() WHERE product_id = ?`,
    [cloudinaryUrl, productId]
  );
}

/** Products with confirmed mapping but missing enrichment metadata */
export async function getPendingEnrichmentBatch(limit = 500, offset = 0) {
  return query(`
    SELECT
      pmm.product_id,
      pmm.datarequisite_product_id,
      pmm.confidence_score,
      pmm.match_method,
      dp.description,
      dp.composition,
      dp.category,
      dp.name AS matched_name,
      dp.normalized_name AS dr_normalized_name,
      dp.manufacturer AS dr_manufacturer,
      dp.raw_data
    FROM product_match_mapping pmm
    JOIN dr_products dp ON dp.id = pmm.datarequisite_product_id
    LEFT JOIN product_enrichment pe ON pe.product_id = pmm.product_id
    WHERE pe.description IS NULL OR pe.description = ''
    ORDER BY pmm.product_id
    LIMIT ? OFFSET ?
  `, [limit, offset]);
}

export async function countProducts() {
  const [{ c }] = await query('SELECT COUNT(*) AS c FROM products');
  return c;
}

export async function countEnrichmentStats() {
  const [rows] = await Promise.all([
    query(`
      SELECT
        SUM(review_status = 'auto_matched') AS matched,
        SUM(review_status = 'review_required') AS review,
        SUM(review_status = 'rejected') AS unmatched
      FROM product_enrichment
    `),
  ]);
  return rows[0] || { matched: 0, review: 0, unmatched: 0 };
}
