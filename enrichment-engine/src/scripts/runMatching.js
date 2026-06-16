/**
 * runMatching.js
 *
 * Phase 1: RMS products ↔ DR products matching
 *   - Resume from checkpoint if interrupted (req #24)
 *   - Incremental mode: skip already-matched products (req #20)
 *   - Writes product_match_mapping table (req #16)
 *   - Learns brand alias patterns (req #17)
 *   - Dry-run mode: reports only, no DB writes (req #23)
 *
 * Usage:
 *   node src/scripts/runMatching.js          # normal run
 *   node src/scripts/runMatching.js --dry    # dry run
 *   node src/scripts/runMatching.js --full   # force reprocess all
 */
import 'dotenv/config';
import { query, batchInsert, getPool, closePool } from '../db/pool.js';
import { buildIndex } from '../matcher/engine.js';
import { matchBatchParallel, defaultWorkerCount } from '../matcher/parallelMatcher.js';
import { saveIndexCache, DEFAULT_CACHE as INDEX_CACHE_PATH } from '../matcher/indexCache.js';
import {
  loadDbMatchCache,
  flushDbMatchCache,
  entryFromResult,
  updateCacheFromResults,
} from '../matcher/matchCache.js';
import { flushAliasSuggestions } from '../matcher/aliasLearner.js';
import { brandAliases } from '../config/index.js';
import { writeMatchedReport, writeReviewReport, writeUnmatchedReport } from '../reporter/excelWriter.js';
import { loadCheckpoint, saveCheckpoint, clearCheckpoint } from '../db/checkpoint.js';
import { validateProductCounts } from '../utils/validate.js';
import {
  upsertMatchMappings,
  upsertProductEnrichment,
  enrichmentRowFromMatchResult,
  countProducts,
} from '../db/enrichmentStore.js';
import { createPerformanceTracker, formatPerformanceReport } from '../utils/performanceReport.js';
import logger, { matchLogger } from '../logger/index.js';
import { processing, output } from '../config/index.js';
import { mkdirSync } from 'fs';

const BATCH     = processing.batchSize;
const IS_DRY    = process.argv.includes('--dry');
const IS_FULL   = process.argv.includes('--full');
const NO_CACHE  = process.argv.includes('--no-cache');
const WORKERS   = processing.matchWorkers || defaultWorkerCount();
const JOB_ID    = `matching_${IS_FULL ? 'full' : 'incremental'}`;

async function run() {
  mkdirSync(output.dir, { recursive: true });
  const perf = createPerformanceTracker();

  if (IS_DRY) {
    matchLogger.info('=== DRY RUN MODE — no DB writes, no image downloads ===');
  }

  matchLogger.info('Loading DR products from DB…');
  const drProducts = await query(
    `SELECT id, name, normalized_name, manufacturer, description, composition, category, pack_size, barcode
     FROM dr_products`
  );
  matchLogger.info(`DR products loaded: ${drProducts.length}`);

  const index = buildIndex(drProducts, brandAliases);
  index.productCount = drProducts.length;
  if (!IS_DRY && processing.useIndexCache) {
    await saveIndexCache(index, INDEX_CACHE_PATH);
  }

  const matchCache = (!IS_DRY && processing.useMatchCache && !NO_CACHE)
    ? await loadDbMatchCache()
    : new Map();

  // Resume support (req #24) — load checkpoint unless --full flag
  let startOffset = 0;
  let totalProcessed = 0;
  if (!IS_FULL && !IS_DRY) {
    const cp = await loadCheckpoint(JOB_ID);
    if (cp) {
      startOffset    = cp.lastOffset;
      totalProcessed = cp.processedCount;
    }
  }

  // Incremental: skip products with permanent mapping unless --full
  const whereClause = IS_FULL
    ? ''
    : `WHERE id NOT IN (SELECT product_id FROM product_match_mapping)`;

  const [{ c: totalCount }] = await query(
    `SELECT COUNT(*) AS c FROM products ${whereClause}`
  );
  const [{ c: catalogTotal }] = await query('SELECT COUNT(*) AS c FROM products');
  matchLogger.info(`Products to process: ${totalCount} of ${catalogTotal} (starting at offset ${startOffset})`);

  let offset = startOffset;
  const allMatched = [], allReview = [], allUnmatched = [];
  const auditBuffer = [], mappingBuffer = [], enrichmentBuffer = [];

  while (offset < totalCount) {
    const rmsProducts = await query(
      `SELECT id, rms_id, name, normalized_name, manufacturer, mrp, stock, pack_size, barcode, category
       FROM products ${whereClause}
       ORDER BY id
       LIMIT ${BATCH} OFFSET ${offset}`
    );
    if (!rmsProducts.length) break;

    const { matched, review, unmatched } = await matchBatchParallel(
      rmsProducts,
      index,
      brandAliases,
      {
        workers: WORKERS,
        cacheMap: matchCache,
        quiet: true,
      }
    );

    updateCacheFromResults(matchCache, [...matched, ...review, ...unmatched]);

    allMatched.push(...matched);
    allReview.push(...review);
    allUnmatched.push(...unmatched);

    // Build audit + mapping records
    for (const r of [...matched, ...review, ...unmatched]) {
      auditBuffer.push([
        r.rms.id, r.rms.rms_id, r.dr?.id ?? null, r.method,
        r.confidence, r.status,
        r.rms.name, r.dr?.name ?? null,
        r.rms.manufacturer, r.dr?.manufacturer ?? null,
        r.rms.pack_size, r.dr?.pack_size ?? null,
      ]);

      enrichmentBuffer.push(enrichmentRowFromMatchResult(r));

      if (r.dr && r.status === 'auto_matched') {
        mappingBuffer.push([r.rms.id, r.dr.id, r.confidence, r.method]);
      }
    }

    if (!IS_DRY) {
      if (auditBuffer.length >= BATCH) await flushAudit();
      if (mappingBuffer.length >= BATCH) await flushMapping();
      if (enrichmentBuffer.length >= BATCH) await flushEnrichment();

      const cacheBatch = [...matched, ...review, ...unmatched].map(entryFromResult);
      if (cacheBatch.length) await flushDbMatchCache(cacheBatch);

      await flushAliasSuggestions();

      // Save checkpoint (req #24)
      totalProcessed += rmsProducts.length;
      await saveCheckpoint(JOB_ID, 'matching', offset + BATCH, rmsProducts.at(-1)?.id ?? 0, totalProcessed);
    }

    offset += BATCH;
    matchLogger.info(`Progress: ${Math.min(offset, totalCount)}/${totalCount}`);
  }

  if (!IS_DRY) {
    await flushAudit();
    await flushMapping();
    await flushEnrichment();
    await flushAliasSuggestions();
    await clearCheckpoint(JOB_ID);

    await query(`UPDATE products SET last_processed_at = NOW() WHERE last_processed_at IS NULL OR ? = TRUE`, [IS_FULL]);
  }

  const stats = {
    total:     catalogTotal,
    processed: allMatched.length + allReview.length + allUnmatched.length,
    matched:   allMatched.length,
    review:    allReview.length,
    unmatched: allUnmatched.length,
  };

  const validation = validateProductCounts({
    matched: stats.matched,
    review: stats.review,
    unmatched: stats.unmatched,
    total: stats.processed,
    label: 'processed batch',
  });
  matchLogger.info(validation.message);

  const perfSnap = perf.snapshot('complete', stats.total);
  console.log(formatPerformanceReport({
    total: stats.total,
    matched: stats.matched,
    review: stats.review,
    unmatched: stats.unmatched,
    matchRate: stats.total ? `${((stats.matched / stats.total) * 100).toFixed(1)}%` : '0%',
    validationOk: validation.ok,
    elapsedSec: perfSnap.elapsedSec,
    productsPerSec: perfSnap.productsPerSec,
    workers: WORKERS,
    memoryMb: perfSnap.memoryMb,
    cpu: perfSnap.cpu,
    cpus: perfSnap.cpus,
  }));

  matchLogger.info(`Matching ${IS_DRY ? '[DRY RUN] ' : ''}complete`, stats);

  if (!IS_DRY) {
    const [dbStats] = await query(`
      SELECT
        SUM(review_status = 'auto_matched') AS matched,
        SUM(review_status = 'review_required') AS review,
        SUM(review_status = 'rejected') AS unmatched
      FROM product_enrichment
    `);
    const catalogTotal = await countProducts();
    const fullValidation = validateProductCounts({
      matched: Number(dbStats.matched) || 0,
      review: Number(dbStats.review) || 0,
      unmatched: Number(dbStats.unmatched) || 0,
      total: catalogTotal,
      label: 'full catalog',
    });
    matchLogger.info(fullValidation.message);
  }

  // Write Excel reports (always, even in dry run)
  matchLogger.info('Writing Excel reports…');
  await Promise.all([
    writeMatchedReport(allMatched,    `${output.dir}/matched_products.xlsx`),
    writeReviewReport(allReview,      `${output.dir}/review_required.xlsx`),
    writeUnmatchedReport(allUnmatched, `${output.dir}/unmatched_products.xlsx`),
  ]);
  matchLogger.info('Reports written to', { dir: output.dir });

  async function flushAudit() {
    if (!auditBuffer.length) return;
    await batchInsert(
      'match_audit',
      ['product_id','rms_id','dr_product_id','match_method','confidence','status',
       'rms_name','dr_name','rms_manufacturer','dr_manufacturer','rms_pack_size','dr_pack_size'],
      [...auditBuffer],
      { ignore: true }
    );
    auditBuffer.length = 0;
  }

  async function flushMapping() {
    if (!mappingBuffer.length) return;
    await upsertMatchMappings([...mappingBuffer]);
    mappingBuffer.length = 0;
  }

  async function flushEnrichment() {
    if (!enrichmentBuffer.length) return;
    await upsertProductEnrichment([...enrichmentBuffer]);
    enrichmentBuffer.length = 0;
  }
}

run()
  .catch(err => {
    logger.error('Matching failed', { err: err.message, stack: err.stack });
    process.exit(1);
  })
  .finally(() => closePool());
