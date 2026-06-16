/**
 * runEnrichment.js
 *
 * Phase 2: After matching, enrich via separate product_enrichment table.
 * - Copies metadata from matched DR product (via product_match_mapping)
 * - Locates images by matched DR identity (not fuzzy)
 * - Downloads + uploads to Cloudinary
 * - NEVER updates RMS product fields
 *
 * Usage:
 *   node src/scripts/runEnrichment.js           # queue workers (Redis)
 *   node src/scripts/runEnrichment.js --inline  # shop PC, no Redis
 */
import 'dotenv/config';
import { query, batchInsert, closePool } from '../db/pool.js';
import { enqueueImageDownloads } from '../queues/index.js';
import { upsertProductEnrichment, setEnrichmentImageUrl } from '../db/enrichmentStore.js';
import { processImagesInline } from '../enrichment/inlineImages.js';
import { processing } from '../config/index.js';
import logger from '../logger/index.js';

const BATCH = processing.batchSize;
const INLINE = process.argv.includes('--inline');

function extractPrescription(rawData, fallback) {
  if (fallback) return fallback;
  if (!rawData) return null;
  try {
    const data = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
    return data.prescription_required || data['Prescription Required'] || null;
  } catch {
    return null;
  }
}

async function syncEnrichmentMetadata() {
  logger.info('Syncing enrichment metadata from matched DR products…');
  let offset = 0;
  let total = 0;

  while (true) {
    const rows = await query(`
      SELECT
        pmm.product_id,
        pmm.datarequisite_product_id,
        pmm.confidence_score,
        pmm.match_method,
        dp.description,
        dp.composition,
        dp.category,
        dp.name AS matched_name,
        dp.prescription_required,
        dp.raw_data
      FROM product_match_mapping pmm
      JOIN dr_products dp ON dp.id = pmm.datarequisite_product_id
      LIMIT ${BATCH} OFFSET ${offset}
    `);
    if (!rows.length) break;

    const enrichRows = rows.map(r => [
      r.product_id,
      r.composition,
      extractPrescription(r.raw_data, r.prescription_required),
      r.description,
      r.category,
      null,
      null,
      r.confidence_score,
      r.matched_name,
      r.datarequisite_product_id,
      r.match_method,
      'auto_matched',
    ]);

    await upsertProductEnrichment(enrichRows);
    total += rows.length;
    offset += BATCH;
    logger.info(`Metadata synced: ${total}`);
  }

  logger.info(`Enrichment metadata synced for ${total} mapped products`);
}

async function queueImagesForMappedProducts() {
  logger.info('Looking up images via matched DR identity…');

  const mapped = await query(`
    SELECT
      pmm.product_id,
      dp.normalized_name AS dr_normalized_name,
      dp.manufacturer AS dr_manufacturer,
      dp.name AS dr_name
    FROM product_match_mapping pmm
    JOIN dr_products dp ON dp.id = pmm.datarequisite_product_id
    ORDER BY pmm.product_id
  `);

  logger.info(`Image lookup for ${mapped.length} mapped products`);
  let totalImages = 0;
  let imageBuffer = [];

  for (const prod of mapped) {
    const images = await query(`
      SELECT id, image_url, sort_order
      FROM dr_images
      WHERE normalized_name = ?
        AND (manufacturer = ? OR manufacturer IS NULL OR manufacturer = '' OR ? IS NULL)
      ORDER BY sort_order ASC
      LIMIT 10
    `, [prod.dr_normalized_name, prod.dr_manufacturer, prod.dr_manufacturer]);

    if (!images.length) continue;

    await setEnrichmentImageUrl(prod.product_id, images[0].image_url);

    const imgRows = images.map(img => [
      prod.product_id,
      img.image_url,
      null,
      null,
      null,
      'pending',
      img.sort_order,
    ]);

    await batchInsert(
      'product_images',
      ['product_id', 'source_url', 'local_path', 'cloudinary_url', 'public_id', 'status', 'sort_order'],
      imgRows,
      { ignore: true }
    );

    const pending = await query(
      `SELECT id, product_id, source_url, sort_order FROM product_images
       WHERE product_id = ? AND status = 'pending'
       ORDER BY sort_order ASC`,
      [prod.product_id]
    );

    if (INLINE) {
      await processImagesInline(pending.slice(0, 3));
      totalImages += pending.length;
    } else {
      imageBuffer.push(...pending.slice(0, 3));
      if (imageBuffer.length >= BATCH) {
        await enqueueImageDownloads(imageBuffer);
        totalImages += imageBuffer.length;
        imageBuffer = [];
      }
    }
  }

  if (!INLINE && imageBuffer.length) {
    await enqueueImageDownloads(imageBuffer);
    totalImages += imageBuffer.length;
  }

  logger.info(`Images ${INLINE ? 'processed inline' : 'queued'}: ${totalImages}`);
  return totalImages;
}

async function ensureAllProductsHaveEnrichmentRows() {
  const result = await query(`
    INSERT INTO product_enrichment (product_id, confidence_score, review_status, match_method)
    SELECT p.id, 0, 'rejected', 'unmatched'
    FROM products p
    LEFT JOIN product_enrichment pe ON pe.product_id = p.id
    WHERE pe.id IS NULL
  `);
  logger.info('Default enrichment rows created for unprocessed products', { inserted: result.affectedRows ?? 0 });
}

async function run() {
  try {
    await syncEnrichmentMetadata();
    await queueImagesForMappedProducts();
    await ensureAllProductsHaveEnrichmentRows();

    if (INLINE) {
      logger.info('Inline enrichment complete (images downloaded + uploaded)');
    } else {
      logger.info('Enrichment queued — run `npm run worker` to process image queues');
    }
  } catch (err) {
    logger.error('Enrichment failed', { err: err.message, stack: err.stack });
    process.exit(1);
  } finally {
    await closePool();
  }
}

run();
