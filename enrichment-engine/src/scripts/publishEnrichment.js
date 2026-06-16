/**
 * publishEnrichment.js
 * Push enrichment fields to the live website (MongoDB via sync API).
 * Updates description, image, category ONLY — never stock/price.
 */
import 'dotenv/config';
import fetch from 'node-fetch';
import { query, closePool } from '../db/pool.js';
import logger from '../logger/index.js';

const WEBSITE_URL = process.env.WEBSITE_URL || process.env.NEXT_PUBLIC_SITE_URL || '';
const SYNC_API_KEY = process.env.SYNC_API_KEY || '';
const BATCH = Number(process.env.PUBLISH_BATCH_SIZE) || 100;
const DRY = process.argv.includes('--dry');

async function publishBatch(products) {
  if (!WEBSITE_URL || !SYNC_API_KEY) {
    throw new Error('Set WEBSITE_URL and SYNC_API_KEY in .env');
  }

  const url = `${WEBSITE_URL.replace(/\/$/, '')}/api/sync/products`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': SYNC_API_KEY,
    },
    body: JSON.stringify({ products }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return body;
}

async function run() {
  if (DRY) logger.info('DRY RUN — no API calls');

  const rows = await query(`
    SELECT
      p.rms_id,
      p.name,
      p.manufacturer,
      p.mrp,
      p.stock,
      p.pack_size,
      pe.description,
      pe.category,
      pe.composition,
      pe.prescription_required,
      pe.cloudinary_url,
      pe.image_url
    FROM products p
    JOIN product_enrichment pe ON pe.product_id = p.id
    WHERE pe.review_status IN ('auto_matched', 'approved')
      AND (pe.description IS NOT NULL OR pe.cloudinary_url IS NOT NULL)
    ORDER BY p.id
  `);

  logger.info(`Publishing ${rows.length} enriched products to website`);
  let published = 0;
  let batch = [];

  for (const row of rows) {
    batch.push({
      id: row.rms_id,
      externalId: row.rms_id,
      name: row.name,
      brand: row.manufacturer,
      mrp: Number(row.mrp),
      stock: Number(row.stock),
      packSize: row.pack_size,
      description: row.description || '',
      category: row.category || 'Uncategorized',
      image: row.cloudinary_url || row.image_url || '',
      imageUrl: row.cloudinary_url || row.image_url || '',
      prescription: /yes|required|true|1/i.test(String(row.prescription_required || '')),
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

  logger.info(`Publish complete: ${published} products`);
  console.log(`\nPublished ${published} enriched products to ${WEBSITE_URL || '(dry run)'}`);
}

run()
  .catch(err => {
    logger.error('Publish failed', { err: err.message });
    process.exit(1);
  })
  .finally(() => closePool());
