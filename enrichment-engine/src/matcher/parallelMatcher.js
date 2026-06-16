/**
 * Parallel matching — main thread holds DR index; workers score candidate batches only.
 */
import os from 'os';
import { Worker } from 'worker_threads';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  matchBatch,
  mergeMatchBatchResults,
  partitionByCache,
} from './engine.js';
import { parseProduct, buildStructuralKey } from '../parser/productParser.js';
import { normalizeName } from '../normalizer/index.js';
import { gatherCandidatesForProduct, scoreProductCandidates, scoreFuseFallback } from './matchScoring.js';
import { matchLogger } from '../logger/index.js';
import { processing } from '../config/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCORE_WORKER = resolve(__dirname, 'scoreWorkerThread.js');

function defaultWorkerCount() {
  const env = Number(process.env.MATCH_WORKERS);
  if (env > 0) return env;
  return Math.max(1, Math.min(8, (os.cpus().length || 2) - 1));
}

function chunkArray(arr, chunks) {
  const size = Math.ceil(arr.length / chunks);
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out.filter(c => c.length);
}

function runScoreWorker(workerData) {
  return new Promise((resolvePromise, reject) => {
    const worker = new Worker(SCORE_WORKER, { workerData });
    worker.on('message', msg => {
      if (msg.error) reject(new Error(msg.error));
      else resolvePromise(msg.results);
    });
    worker.on('error', reject);
    worker.on('exit', code => {
      if (code !== 0) reject(new Error(`Score worker exited with code ${code}`));
    });
  });
}

/**
 * Match with optional cache + parallel fuzzy scoring.
 * Index always stays in the main process (no 744k duplication).
 */
export async function matchBatchParallel(rmsProducts, index, aliases = {}, options = {}) {
  const {
    workers = defaultWorkerCount(),
    cacheMap = null,
    quiet = false,
    ...matchOptions
  } = options;

  let cached = { matched: [], review: [], unmatched: [] };
  let toMatch = rmsProducts;

  if (cacheMap?.size) {
    const partitioned = partitionByCache(rmsProducts, cacheMap);
    cached = partitioned.cached;
    toMatch = partitioned.toMatch;
    if (!quiet && rmsProducts.length !== toMatch.length) {
      matchLogger.info('Match cache hits', {
        hits: rmsProducts.length - toMatch.length,
        remaining: toMatch.length,
      });
    }
  }

  if (!toMatch.length) {
    return {
      ...mergeMatchBatchResults([{
        matched: cached.matched,
        review: cached.review,
        unmatched: cached.unmatched,
        stats: { methods: { cache: rmsProducts.length } },
      }]),
      cacheHits: rmsProducts.length,
      workersUsed: 0,
    };
  }

  if (workers <= 1 || toMatch.length < 200) {
    const batch = matchBatch(toMatch, index, aliases, { quiet: true, ...matchOptions });
    const merged = mergeMatchBatchResults([{
      matched: [...cached.matched, ...batch.matched],
      review: [...cached.review, ...batch.review],
      unmatched: [...cached.unmatched, ...batch.unmatched],
      stats: batch.stats,
    }]);
    return { ...merged, cacheHits: rmsProducts.length - toMatch.length, workersUsed: 1 };
  }

  const parsed = toMatch.map(p => parseProduct(p, aliases));
  const fastResults = [];
  const scoringJobs = [];

  for (let i = 0; i < toMatch.length; i++) {
    const rms = toMatch[i];
    const rmsParsed = parsed[i];
    const fast = tryFastMatch(rms, rmsParsed, index, matchOptions);
    if (fast) {
      fastResults.push(fast);
    } else {
      const candidates = gatherCandidatesForProduct(rmsParsed, index, matchOptions);
      if (!candidates.length) {
        fastResults.push(scoreFuseFallback(rms, rmsParsed, index, matchOptions));
      } else {
        scoringJobs.push({ rms, rmsParsed, candidates });
      }
    }
  }

  const workerCount = Math.min(workers, scoringJobs.length || 1);
  const chunks = chunkArray(scoringJobs, workerCount);
  matchLogger.info('Parallel scoring', {
    workers: chunks.length,
    fastPath: fastResults.length,
    fuzzyPath: scoringJobs.length,
  });

  const scoredChunks = await Promise.all(
    chunks.map(chunk =>
      runScoreWorker({ jobs: chunk, aliases, matchOptions })
    )
  );

  const scored = scoredChunks.flat();
  const batch = partitionResults([...fastResults, ...scored]);

  const merged = mergeMatchBatchResults([{
    matched: [...cached.matched, ...batch.matched],
    review: [...cached.review, ...batch.review],
    unmatched: [...cached.unmatched, ...batch.unmatched],
    stats: batch.stats,
  }]);

  return {
    ...merged,
    cacheHits: rmsProducts.length - toMatch.length,
    workersUsed: chunks.length,
  };
}

function tryFastMatch(rms, rmsParsed, index, matchOptions) {
  const { barcodeMap, exactMap, structuralMap, namePackMap } = index;
  const pass3 = matchOptions.thirdPass === true;

  if (rms.barcode) {
    const bc = String(rms.barcode).trim();
    if (bc && barcodeMap.has(bc)) {
      return mk(rms, barcodeMap.get(bc), 100, pass3 ? 'barcode_pass3' : 'barcode', 'auto_matched');
    }
  }

  if (!pass3) {
    const exactKey = `${rmsParsed.manufacturer}|${normalizeName(rms.name)}|${rmsParsed.packSize}`;
    if (exactMap.has(exactKey)) {
      return mk(rms, exactMap.get(exactKey), 99, 'exact', 'auto_matched');
    }
    const sKey = buildStructuralKey(rmsParsed);
    if (structuralMap.has(sKey)) {
      return mk(rms, structuralMap.get(sKey), 99, 'structural', 'auto_matched');
    }
    const npKey = `${rmsParsed.normalizedName}|${rmsParsed.packSize}`;
    if (namePackMap.has(npKey)) {
      return mk(rms, namePackMap.get(npKey), 97, 'alias', 'auto_matched');
    }
  }

  return null;
}

function mk(rms, dr, confidence, method, status) {
  return { rms, dr, confidence, method, status, suggestions: [] };
}

function partitionResults(results) {
  const matched = [], review = [], unmatched = [];
  const methodCounts = {};

  for (const r of results) {
    if (r.status === 'auto_matched') matched.push(r);
    else if (r.status === 'review_required') review.push(r);
    else unmatched.push(r);
    const m = r.method || 'unmatched';
    methodCounts[m] = (methodCounts[m] || 0) + 1;
  }

  const total = results.length;
  return {
    matched,
    review,
    unmatched,
    stats: {
      total,
      matched: matched.length,
      review: review.length,
      unmatched: unmatched.length,
      matchRate: total ? ((matched.length / total) * 100).toFixed(1) : '0',
      methods: methodCounts,
    },
  };
}

export { defaultWorkerCount };
