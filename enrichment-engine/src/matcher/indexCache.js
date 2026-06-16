/**
 * Compact DR product cache (NDJSON) — fast reload without re-parsing Excel.
 * Full Map indexes are rebuilt in memory from cached product rows.
 */
import {
  createReadStream, createWriteStream, existsSync, mkdirSync, statSync,
} from 'fs';
import { createGunzip, createGzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { createInterface } from 'readline';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createIndexBuilder, addProductToIndex, finalizeIndex } from './engine.js';
import { matchLogger } from '../logger/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_PRODUCTS_CACHE = resolve(__dirname, '../../data/cache/dr_products.ndjson.gz');
export const DEFAULT_CACHE = DEFAULT_PRODUCTS_CACHE;
const CACHE_VERSION = 1;

export function productsCacheIsFresh(cachePath, sourceFiles = []) {
  if (!existsSync(cachePath)) return false;
  const cacheMtime = statSync(cachePath).mtimeMs;
  for (const f of sourceFiles) {
    if (f && existsSync(f) && statSync(f).mtimeMs > cacheMtime) return false;
  }
  return true;
}

/** Stream DR products to compressed NDJSON (one product per line) */
export async function saveProductsCache(builder, cachePath = DEFAULT_PRODUCTS_CACHE) {
  mkdirSync(dirname(cachePath), { recursive: true });
  let count = 0;

  await pipeline(
    async function* () {
      for (const entry of builder.normalized) {
        const p = entry.id != null ? entry : entry;
        const row = {
          id: p.id,
          name: p.name,
          manufacturer: p.manufacturer,
          composition: p.composition,
          category: p.category,
          pack_size: p.pack_size,
          barcode: p.barcode,
          prescription_required: p.prescription_required,
        };
        yield `${JSON.stringify(row)}\n`;
        count++;
      }
    },
    createGzip(),
    createWriteStream(cachePath)
  );

  matchLogger.info('DR products cached (NDJSON)', { path: cachePath, products: count });
  return count;
}

/** Rebuild in-memory index from NDJSON cache — much faster than Excel */
export async function loadIndexFromProductsCache(cachePath, aliases = {}) {
  if (!existsSync(cachePath)) return null;

  const builder = createIndexBuilder(aliases);
  let count = 0;

  const source = createReadStream(cachePath).pipe(createGunzip());
  const rl = createInterface({ input: source, crlfDelay: Infinity });

  for await (const line of rl) {
    if (!line.trim()) continue;
    const row = JSON.parse(line);
    addProductToIndex(builder, row);
    count++;
    if (count % 100000 === 0) {
      matchLogger.info(`Index rebuild: ${count} products…`);
    }
  }

  matchLogger.info('DR index rebuilt from NDJSON cache', { products: count });
  return finalizeIndex(builder);
}

/** @deprecated Use saveProductsCache — kept for API compat */
export async function saveIndexCache(source, cachePath = DEFAULT_PRODUCTS_CACHE) {
  if (source.normalized?.length) {
    return saveProductsCache(source, cachePath);
  }
  matchLogger.warn('saveIndexCache: no normalized products to cache');
}

/** Load index from NDJSON product cache */
export async function loadIndexCache(cachePath = DEFAULT_PRODUCTS_CACHE, aliases = {}) {
  return loadIndexFromProductsCache(cachePath, aliases);
}

export function indexCacheIsFresh(cachePath, sourceFiles = []) {
  return productsCacheIsFresh(cachePath, sourceFiles);
}

export { createIndexBuilder, addProductToIndex, finalizeIndex };
