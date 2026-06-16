/**
 * Match result cache — skip re-matching products that were processed before.
 * Supports file mode (JSON) and MySQL mode (match_cache table).
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { query, batchInsert } from '../db/pool.js';
import { buildProductCacheKey } from './engine.js';
import { matchLogger } from '../logger/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_FILE = resolve(__dirname, '../../data/cache/match_cache.json');

function drSnapshot(dr) {
  if (!dr) return null;
  return {
    id: dr.id,
    name: dr.name,
    manufacturer: dr.manufacturer,
    composition: dr.composition,
    description: dr.description,
    category: dr.category,
    pack_size: dr.pack_size,
    barcode: dr.barcode,
    prescription_required: dr.prescription_required,
  };
}

export function entryFromResult(result) {
  const key = buildProductCacheKey(result.rms);
  return {
    product_key: key,
    confidence: result.confidence,
    match_method: result.method,
    status: result.status,
    dr_snapshot: drSnapshot(result.dr),
    reason: result.reason || null,
    cached_at: new Date().toISOString(),
  };
}

/** Load file-based cache into Map */
export function loadFileMatchCache(filePath = DEFAULT_FILE) {
  const map = new Map();
  if (!existsSync(filePath)) return map;
  try {
    const data = JSON.parse(readFileSync(filePath, 'utf8'));
    for (const entry of data.entries || []) {
      map.set(entry.product_key, entry);
    }
    matchLogger.info('Match cache loaded', { entries: map.size, path: filePath });
  } catch (err) {
    matchLogger.warn('Could not load match cache', { err: err.message });
  }
  return map;
}

/** Persist file-based cache */
export function saveFileMatchCache(cacheMap, filePath = DEFAULT_FILE) {
  mkdirSync(dirname(filePath), { recursive: true });
  const entries = [...cacheMap.values()];
  writeFileSync(filePath, JSON.stringify({ version: 1, updated_at: new Date().toISOString(), entries }, null, 0));
  matchLogger.info('Match cache saved', { entries: entries.length, path: filePath });
}

/** Merge new results into cache map */
export function updateCacheFromResults(cacheMap, results) {
  for (const r of results) {
    cacheMap.set(buildProductCacheKey(r.rms), entryFromResult(r));
  }
  return cacheMap;
}

/** Load MySQL match_cache into Map */
export async function loadDbMatchCache() {
  const map = new Map();
  try {
    const rows = await query(
      `SELECT product_key, confidence, match_method, status, dr_snapshot, reason
       FROM match_cache`
    );
    for (const row of rows) {
      map.set(row.product_key, {
        product_key: row.product_key,
        confidence: Number(row.confidence),
        match_method: row.match_method,
        status: row.status,
        dr_snapshot: typeof row.dr_snapshot === 'string' ? JSON.parse(row.dr_snapshot) : row.dr_snapshot,
        reason: row.reason,
      });
    }
    matchLogger.info('Match cache loaded from DB', { entries: map.size });
  } catch (err) {
    matchLogger.warn('DB match cache unavailable', { err: err.message });
  }
  return map;
}

/** Flush cache entries to MySQL */
export async function flushDbMatchCache(entries) {
  if (!entries.length) return;
  const rows = entries.map(e => [
    e.product_key,
    e.confidence,
    e.match_method,
    e.status,
    JSON.stringify(e.dr_snapshot),
    e.reason,
  ]);
  await batchInsert(
    'match_cache',
    ['product_key', 'confidence', 'match_method', 'status', 'dr_snapshot', 'reason'],
    rows,
    {
      onDuplicateUpdate: ['confidence', 'match_method', 'status', 'dr_snapshot', 'reason'],
    }
  );
}

export { DEFAULT_FILE };
