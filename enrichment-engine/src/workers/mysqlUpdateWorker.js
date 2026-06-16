import { Worker } from 'bullmq';
import { redis as redisConfig, processing } from '../config/index.js';
import { batchInsert, query } from '../db/pool.js';
import { dbLogger } from '../logger/index.js';

const connection = { ...redisConfig };
const updateBuffer = new Map();
let flushTimer = null;

async function flushBuffer() {
  if (!updateBuffer.size) return;
  const rows = [...updateBuffer.values()];
  updateBuffer.clear();

  try {
    await batchInsert(
      'product_enrichment',
      ['product_id', 'description', 'composition', 'prescription_required', 'category', 'confidence_score', 'matched_product_name', 'matched_database_id', 'match_method', 'review_status'],
      rows.map(r => [
        r.productId,
        r.description ?? null,
        r.composition ?? null,
        r.prescription_required ?? null,
        r.category ?? null,
        r.confidence_score ?? null,
        r.matched_product_name ?? null,
        r.matched_database_id ?? null,
        r.match_method ?? null,
        'auto_matched',
      ]),
      {
        onDuplicateUpdate: ['description', 'composition', 'prescription_required', 'category'],
      }
    );
    dbLogger.info(`Flushed ${rows.length} product_enrichment updates`);
  } catch (err) {
    dbLogger.error('Enrichment batch flush failed', { err: err.message });
  }
}

const worker = new Worker(
  'mysql_update_queue',
  async (job) => {
    const { productId, data } = job.data;
    updateBuffer.set(productId, { productId, ...data });

    if (flushTimer) clearTimeout(flushTimer);
    if (updateBuffer.size >= processing.batchSize) {
      await flushBuffer();
    } else {
      flushTimer = setTimeout(flushBuffer, 2000);
    }
    return { queued: true };
  },
  { connection, concurrency: 20 }
);

worker.on('drained', async () => {
  if (flushTimer) clearTimeout(flushTimer);
  await flushBuffer();
});

worker.on('error', err => dbLogger.error('MySQL update worker error', { err: err.message }));
dbLogger.info('MySQL enrichment worker started (writes product_enrichment only)');

export default worker;
