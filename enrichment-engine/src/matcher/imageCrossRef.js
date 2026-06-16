/**
 * Image catalog cross-reference — find DR products via image file names/URLs.
 * Used after data-only matching fails: search image catalog by RMS name tokens,
 * resolve DR Product ID, confirm with composite score. Identical primary images
 * are treated as the same product variant (pick best pack match).
 */
import { normalizeName } from '../normalizer/index.js';
import { parseProduct, coreTokenSimilarity } from '../parser/productParser.js';
import { computeCompositeScoreLenient } from './engine.js';
import { matchingPass2 } from '../config/index.js';
import { matchLogger } from '../logger/index.js';

function tokenSet(tokens) {
  return new Set((tokens || []).filter(t => t && t.length > 1));
}

const GENERIC_TOKENS = new Set([
  'paste', 'powder', 'oil', 'cream', 'gel', 'lotion', 'soap', 'shampoo',
  '50', '100', '150', '200', '250', '500', 'ml', 'tablet', 'capsule',
  'each', 'strip', 'bottle', 'regular', 'teeth', 'gums',
]);

function distinctiveTokens(rmsParsed) {
  const brandTokens = (rmsParsed.brand || '').split(/\s+/).filter(t => t.length >= 3);
  const core = (rmsParsed.coreTokens || []).filter(t => t.length >= 3 && !GENERIC_TOKENS.has(t));
  const mfg = (rmsParsed.manufacturer || '').split(/\s+/).filter(t => t.length >= 3);
  return [...new Set([...brandTokens, ...core, ...mfg])];
}

function scoreNameOverlap(queryTokens, entryTokens, distinctive) {
  const qa = tokenSet(queryTokens);
  const qb = tokenSet(entryTokens);
  if (!qa.size || !qb.size) return 0;

  let inter = 0;
  for (const t of qa) if (qb.has(t)) inter++;
  const jaccard = inter / new Set([...qa, ...qb]).size;

  if (distinctive.length) {
    const hitDistinct = distinctive.filter(t => qb.has(t));
    if (!hitDistinct.length) return 0;
    if (hitDistinct.length >= Math.min(2, distinctive.length)) {
      return Math.max(jaccard, 0.45 + hitDistinct.length * 0.08);
    }
  }

  return jaccard;
}

function primaryUrl(urls) {
  return (urls && urls[0]) ? String(urls[0]).trim() : '';
}

/**
 * Search image catalog entries by RMS core tokens (inverted index — fast).
 * @returns {Array<{ productId, normName, primaryUrl, overlap, entry }>}
 */
export function searchImageCatalogByName(imageIndex, rmsParsed, limit = 8) {
  const queryTokens = rmsParsed.coreTokens?.length
    ? rmsParsed.coreTokens
    : rmsParsed.normalizedName.split(/\s+/);
  const distinctive = distinctiveTokens(rmsParsed);

  let candidateEntries = [];
  if (imageIndex.tokenIndex?.size && distinctive.length) {
    const entryHits = new Map();
    for (const t of distinctive) {
      for (const entry of imageIndex.tokenIndex.get(t) || []) {
        entryHits.set(entry, (entryHits.get(entry) || 0) + 1);
      }
    }
    candidateEntries = [...entryHits.entries()]
      .filter(([, hits]) => hits >= 1)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 400)
      .map(([entry]) => entry);
  }

  if (!candidateEntries.length) {
    const brandTok = (rmsParsed.brand || '').split(/\s+/)[0];
    if (brandTok && brandTok.length >= 3) {
      candidateEntries = (imageIndex.tokenIndex?.get(brandTok) || []).slice(0, 200);
    }
  }

  if (!candidateEntries.length) return [];

  const scored = [];
  for (const entry of candidateEntries) {
    const overlap = scoreNameOverlap(queryTokens, entry.coreTokens, distinctive);
    if (overlap < 0.2) continue;
    scored.push({ productId: entry.productId, normName: entry.normName, primaryUrl: entry.primaryUrl, overlap, entry });
  }

  scored.sort((a, b) => b.overlap - a.overlap);

  // Collapse entries sharing the same primary image (same product, different pack SKUs)
  const byUrl = new Map();
  for (const hit of scored) {
    const url = hit.primaryUrl;
    if (!url) {
      if (!byUrl.has(`_id:${hit.productId}`)) byUrl.set(`_id:${hit.productId}`, hit);
      continue;
    }
    const existing = byUrl.get(url);
    if (!existing || hit.overlap > existing.overlap) byUrl.set(url, hit);
  }

  return [...byUrl.values()].slice(0, limit);
}

/**
 * Try to match an RMS product via image catalog name search → DR barcode lookup.
 */
export function matchByImageCrossRef(rms, rmsParsed, drIndex, imageIndex, aliases = {}, options = {}) {
  const hits = searchImageCatalogByName(imageIndex, rmsParsed, 10);
  if (!hits.length) return null;

  const autoThreshold = options.autoThreshold ?? matchingPass2.autoThreshold;
  const reviewThreshold = options.reviewThreshold ?? matchingPass2.reviewThreshold;
  const minCombined = options.minCombined ?? 68;
  const minRawConfidence = options.minRawConfidence ?? 70;

  let best = null;

  for (const hit of hits) {
    const candidateIds = new Set([hit.productId]);
    if (hit.primaryUrl && imageIndex.byPrimaryUrl?.has(hit.primaryUrl)) {
      for (const pid of imageIndex.byPrimaryUrl.get(hit.primaryUrl)) candidateIds.add(pid);
    }

    for (const productId of candidateIds) {
      const dr = drIndex.barcodeMap?.get(productId);
      if (!dr) continue;

      const drParsed = dr._parsed ?? parseProduct(dr, aliases);
      const { confidence, breakdown } = computeCompositeScoreLenient(rmsParsed, drParsed);
      const coreSim = coreTokenSimilarity(rmsParsed, drParsed);
      const combined = Math.min(100, Math.round(confidence * 0.7 + hit.overlap * 100 * 0.2 + coreSim * 100 * 0.1));

      if (!best || combined > best.combined) {
        best = {
          dr,
          drParsed,
          confidence: combined,
          rawConfidence: confidence,
          breakdown,
          overlap: hit.overlap,
          coreSim,
          imageProductId: productId,
          imageCatalogName: hit.normName,
          primaryImageUrl: hit.primaryUrl,
          combined,
        };
      }
    }
  }

  if (!best) return null;

  const strongImageMatch = best.overlap >= 0.45;
  if (!strongImageMatch && best.combined < minCombined && best.rawConfidence < minRawConfidence) return null;

  let confidence = Math.max(best.combined, best.rawConfidence);
  if (strongImageMatch) confidence = Math.max(confidence, 72);
  if (confidence < minCombined) return null;

  const status = confidence >= autoThreshold ? 'auto_matched' : 'review_required';
  return {
    rms,
    dr: best.dr,
    confidence,
    method: 'image_name_crossref',
    status,
    parsed: rmsParsed,
    dr_product_id: best.imageProductId,
    image_crossref: {
      catalog_name: best.imageCatalogName,
      product_id: best.imageProductId,
      primary_url: best.primaryImageUrl,
      name_overlap: best.overlap,
      data_score: best.rawConfidence,
    },
    suggestions: [],
    lowConfidence: status === 'review_required' || best.overlap < 0.5,
    lowConfidenceFlags: best.overlap < 0.5 ? ['image_name_fuzzy'] : [],
  };
}

/** Run image cross-ref on unmatched results; returns newly matched + still unmatched. */
export function recoverUnmatchedViaImageCrossRef(unmatched, drIndex, imageIndex, aliases = {}, options = {}) {
  const recovered = [];
  const stillUnmatched = [];
  const total = unmatched.length;

  for (let i = 0; i < unmatched.length; i++) {
    const r = unmatched[i];
    const rmsParsed = r.parsed ?? parseProduct(r.rms, aliases);
    const hit = matchByImageCrossRef(r.rms, rmsParsed, drIndex, imageIndex, aliases, options);
    if (hit) {
      recovered.push(hit);
    } else {
      stillUnmatched.push(r);
    }
    if (total > 5000 && i > 0 && i % 2000 === 0) {
      matchLogger.info(`Image cross-ref progress: ${i}/${total} recovered=${recovered.length}`);
    }
  }

  return { recovered, stillUnmatched };
}

export function buildSearchEntry(row, coreTokens) {
  const normName = normalizeName(row.product_name || '');
  const urls = String(row.image_url || '').split(/\s*\|\s*/).map(u => u.trim()).filter(u => u.startsWith('http'));
  return {
    productId: String(row.product_id).trim(),
    normName,
    coreTokens: coreTokens || normName.split(/\s+/).filter(t => t.length > 1),
    primaryUrl: urls[0] || '',
    urls,
  };
}
