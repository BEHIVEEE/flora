/**
 * BullMQ worker for parallel matching batches (stage 8).
 * Requires Redis + pre-built DR NDJSON cache on disk.
 */
import { Worker } from 'bullmq';
import { redis as redisConfig, brandAliases } from '../config/index.js';
import { matchBatch } from '../matcher/engine.js';
import { loadIndexFromProductsCache, DEFAULT_CACHE } from '../matcher/indexCache.js';
import { flushDbMatchCache, entryFromResult } from '../matcher/matchCache.js';
import { queueLogger } from '../logger/index.js';

let indexPromise = null;

function getIndex(cachePath = DEFAULT_CACHE, aliases = brandAliases) {
  if (!indexPromise) indexPromise = loadIndexFromProductsCache(cachePath, aliases);
  return indexPromise;
}

const matchingWorker = new Worker(
  'matching_queue',
  async (job) => {
    const { rmsProducts, matchOptions = {}, indexCachePath = DEFAULT_CACHE } = job.data;
    const index = await getIndex(indexCachePath, brandAliases);
    if (!index) throw new Error('DR index cache not found — run match:files first to build NDJSON cache');

    const result = matchBatch(rmsProducts, index, brandAliases, { quiet: true, ...matchOptions });
    const cacheEntries = [...result.matched, ...result.review, ...result.unmatched].map(entryFromResult);
    await flushDbMatchCache(cacheEntries);

    return {
      matched: result.matched.length,
      review: result.review.length,
      unmatched: result.unmatched.length,
      stats: result.stats,
    };
  },
  {
    connection: { ...redisConfig },
    concurrency: Number(process.env.MATCH_QUEUE_CONCURRENCY) || 2,
  }
);

matchingWorker.on('completed', (job, result) => {
  queueLogger.info('Matching batch complete', { jobId: job.id, ...result });
});

matchingWorker.on('failed', (job, err) => {
  queueLogger.error('Matching batch failed', { jobId: job?.id, err: err.message });
});

export default matchingWorker;
