/**
 * publishEnrichmentCatalog.js
 * Push enrichment lookup to website MongoDB (enrichment_catalog collection).
 * Does NOT modify ProductList.csv or RMS sync folder.
 *
 * Run on shop PC after: npm run enrich:production
 */
import 'dotenv/config';
import fetch from 'node-fetch';
import { query, closePool } from '../db/pool.js';
import logger from '../logger/index.js';

const WEBSITE_URL = process.env.WEBSITE_URL || process.env.NEXT_PUBLIC_SITE_URL || '';
const SYNC_API_KEY = process.env.SYNC_API_KEY || '';
const BATCH = Number(process.env.PUBLISH_BATCH_SIZE) || 200;
const DRY = process.argv.includes('--dry');

async function publishBatch(records) {
  const url = `${WEBSITE_URL.replace(/\/$/, '')}/api/sync/enrichment`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': SYNC_API_KEY,
    },
    body: JSON.stringify({ records }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return body;
}

async function run() {
  if (!WEBSITE_URL || !SYNC_API_KEY) {
    throw new Error('Set WEBSITE_URL and SYNC_API_KEY in .env');
  }

  const rows = await query(`
    SELECT
      p.rms_id AS productCode,
      p.name,
      p.manufacturer AS brand,
      pe.description,
      pe.composition,
      pe.prescription_required AS prescriptionRequired,
      pe.category,
      pe.image_url AS imageUrl,
      pe.cloudinary_url AS cloudinaryUrl,
      pe.confidence_score AS confidence,
      pe.match_method AS matchMethod
    FROM product_match_mapping pmm
    JOIN products p ON p.id = pmm.product_id
    JOIN product_enrichment pe ON pe.product_id = p.id
    WHERE pe.review_status IN ('auto_matched', 'approved')
    ORDER BY p.id
  `);

  logger.info(`Publishing ${rows.length} enrichment records to website catalog`);
  let published = 0;
  let batch = [];

  for (const row of rows) {
    batch.push({
      productCode: row.productCode,
      name: row.name,
      brand: row.brand,
      description: row.description,
      composition: row.composition,
      prescriptionRequired: row.prescriptionRequired,
      category: row.category,
      imageUrl: row.imageUrl,
      cloudinaryUrl: row.cloudinaryUrl,
      confidence: row.confidence,
      matchMethod: row.matchMethod,
    });

    if (batch.length >= BATCH) {
      if (!DRY) await publishBatch(batch);
      published += batch.length;
      logger.info(`Published ${published}/${rows.length}`);
      batch = [];
    }
  }

  if (batch.length && !DRY) {
    await publishBatch(batch);
    published += batch.length;
  }

  console.log(`\n✓ Enrichment catalog synced: ${published} records`);
  console.log('  Website imports will now auto-fill images + descriptions from ProductList.csv');
}

run()
  .catch(err => {
    logger.error('Catalog publish failed', { err: err.message });
    process.exit(1);
  })
  .finally(() => closePool());
