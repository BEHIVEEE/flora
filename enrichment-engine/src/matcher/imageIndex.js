import { existsSync } from 'fs';
import { resolve } from 'path';
import { streamDataFile } from '../reader/csvReader.js';
import { IMAGES_COLUMN_MAP } from '../reader/columnMaps.js';
import { files } from '../config/index.js';
import { matchLogger } from '../logger/index.js';
import { stripNameNoise, extractCoreTokens } from '../parser/productParser.js';
import { buildSearchEntry } from './imageCrossRef.js';

function parseUrls(raw) {
  return String(raw).split(/\s*\|\s*/).map(u => u.trim()).filter(u => u.startsWith('http'));
}

function dedupe(urls) {
  return [...new Set(urls)];
}

function createEmptyImageIndex() {
  return { byProductId: new Map(), byPrimaryUrl: new Map(), searchEntries: [], tokenIndex: new Map(), rowCount: 0 };
}

function indexSearchTokens(index, entry) {
  for (const t of entry.coreTokens || []) {
    if (t.length < 3) continue;
    if (!index.tokenIndex.has(t)) index.tokenIndex.set(t, []);
    index.tokenIndex.get(t).push(entry);
  }
}

function addRowToImageIndex(index, row) {
  if (!row.image_url || !row.product_id) return false;
  const urls = parseUrls(row.image_url);
  if (!urls.length) return false;

  const pid = String(row.product_id).trim();
  if (!pid) return false;

  index.rowCount++;
  if (!index.byProductId.has(pid)) index.byProductId.set(pid, []);
  index.byProductId.get(pid).push(...urls);

  const primary = urls[0];
  if (primary) {
    if (!index.byPrimaryUrl.has(primary)) index.byPrimaryUrl.set(primary, new Set());
    index.byPrimaryUrl.get(primary).add(pid);
  }

  // Build search entry core tokens — include manufacturer from image product name
  const cleanName = stripNameNoise(row.product_name || '');
  const coreTokens = extractCoreTokens(cleanName, '', {});
  const entry = buildSearchEntry(row, coreTokens);
  index.searchEntries.push(entry);
  indexSearchTokens(index, entry);

  return true;
}

async function loadImageFile(filePath, index, options = {}) {
  await streamDataFile(filePath, IMAGES_COLUMN_MAP, async (row) => {
    addRowToImageIndex(index, row);
  }, {
    maxRows: options.maxRows,
    onProgress: n => { if (n % 50000 === 0) matchLogger.info(`Images: loaded ${n} from ${filePath}…`); },
  });
}

/**
 * Build an in-memory image index keyed by DR Product ID (e.g. DRS000008).
 * Matching uses drug/OTC data only; images are resolved in a separate pass.
 */
export async function buildImageIndex(_aliases = {}, options = {}) {
  const paths = options.filePaths || (options.filePath ? [options.filePath] : resolveImagePaths());
  const index = createEmptyImageIndex();

  for (const filePath of paths) {
    matchLogger.info('Loading image URLs (product ID index only)…', { file: filePath });
    await loadImageFile(filePath, index, options);
  }

  matchLogger.info(`Image index built: ${index.rowCount} rows, ${index.byProductId.size} product IDs, ${index.searchEntries.length} searchable names`);
  return index;
}

function resolveImagePaths() {
  const paths = [files.images];
  if (files.images2) paths.push(files.images2);
  else {
    const otc = resolve('../June 2026 OTC IMAGE URLS.xlsx');
    if (existsSync(otc)) paths.push(otc);
  }
  return paths.filter(p => p && existsSync(resolve(p)));
}

/** DR Product ID from a matched catalog row (barcode field = DRS… id). */
export function getDrProductId(drProduct) {
  if (!drProduct) return '';
  const id = drProduct.barcode || drProduct.product_id;
  return id ? String(id).trim() : '';
}

/** Look up image URLs strictly by DR Product ID — no name/brand fallback. */
export function lookupImagesByProductId(imageIndex, productId) {
  if (!imageIndex || !productId) return [];
  const key = String(productId).trim();
  if (!key || !imageIndex.byProductId.has(key)) return [];
  return dedupe(imageIndex.byProductId.get(key));
}

/** @deprecated Use lookupImagesByProductId — kept for callers passing dr object */
export function lookupImages(imageIndex, drProduct) {
  return lookupImagesByProductId(imageIndex, getDrProductId(drProduct));
}

export const IMAGE_STATUS = {
  HAS_IMAGES: 'Has Images',
  NO_IMAGES: 'No Images',
  NO_PRODUCT_ID: 'No Product ID',
  NOT_MATCHED: 'N/A',
};

/**
 * After data matching: attach image URLs by DR Product ID only.
 * Sets dr_product_id and image_status on each result.
 */
export function attachImagesToResults(results, imageIndex) {
  for (const r of results) {
    applyImageLookup(r, imageIndex);
    for (const s of r.suggestions || []) {
      if (s.dr) applyImageLookupToSuggestion(s, imageIndex);
    }
  }
}

function applyImageLookup(result, imageIndex) {
  if (!result.dr) {
    result.dr_product_id = '';
    result.image_status = IMAGE_STATUS.NOT_MATCHED;
    result.image_urls = [];
    return;
  }

  const productId = getDrProductId(result.dr);
  result.dr_product_id = productId;

  if (!productId) {
    result.image_urls = [];
    result.image_status = IMAGE_STATUS.NO_PRODUCT_ID;
    return;
  }

  const urls = lookupImagesByProductId(imageIndex, productId);
  result.image_urls = urls;
  result.image_status = urls.length ? IMAGE_STATUS.HAS_IMAGES : IMAGE_STATUS.NO_IMAGES;
}

function applyImageLookupToSuggestion(suggestion, imageIndex) {
  const productId = getDrProductId(suggestion.dr);
  suggestion.dr_product_id = productId;
  suggestion.image_urls = productId ? lookupImagesByProductId(imageIndex, productId) : [];
}

export function partitionMatchedByImages(results) {
  const withImages = [];
  const noImages = [];
  for (const r of results) {
    if (r.image_status === IMAGE_STATUS.HAS_IMAGES) withImages.push(r);
    else if (r.dr && r.image_status !== IMAGE_STATUS.NOT_MATCHED) noImages.push(r);
  }
  return { withImages, noImages };
}

export function imageLookupStats(results) {
  let hasImages = 0;
  let noImages = 0;
  let noProductId = 0;
  for (const r of results) {
    if (r.image_status === IMAGE_STATUS.HAS_IMAGES) hasImages++;
    else if (r.image_status === IMAGE_STATUS.NO_IMAGES) noImages++;
    else if (r.image_status === IMAGE_STATUS.NO_PRODUCT_ID) noProductId++;
  }
  return { hasImages, noImages, noProductId };
}

export function formatImageUrls(urls) {
  return (urls || []).join(' | ');
}
