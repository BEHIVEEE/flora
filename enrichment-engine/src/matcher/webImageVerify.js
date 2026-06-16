/**
 * Web / public image verification — confirm RMS ↔ DR when both show the same product image.
 *
 * 1. Public catalog URLs (medicinedata.in etc.) from the image index
 * 2. Optional Google Custom Search image results (GOOGLE_CSE_API_KEY + GOOGLE_CSE_CX)
 * 3. Content fingerprint (SHA-256) when URLs differ but image is identical
 */
import { createHash } from 'crypto';
import fetch from 'node-fetch';
import { parseProduct } from '../parser/productParser.js';
import { lookupImagesByProductId, getDrProductId } from './imageIndex.js';
import { searchImageCatalogByName } from './imageCrossRef.js';
import { matchLogger } from '../logger/index.js';
import { processing } from '../config/index.js';

const fingerprintCache = new Map();
const searchCache = new Map();

export function normalizeImageUrl(url) {
  if (!url) return '';
  try {
    const u = new URL(String(url).trim());
    u.hash = '';
    u.search = '';
    return `${u.hostname.toLowerCase()}${u.pathname.toLowerCase()}`;
  } catch {
    return String(url).toLowerCase().split('?')[0];
  }
}

/** Product image key e.g. DR334910 from medicinedata.in/fmcg/DR334910_1.jpg */
export function extractCatalogImageKey(url) {
  if (!url) return '';
  const m = String(url).match(/\/(DR\d+)_\d+\./i);
  return m ? m[1].toUpperCase() : '';
}

export function urlsReferToSameImage(urlA, urlB) {
  if (!urlA || !urlB) return false;
  if (normalizeImageUrl(urlA) === normalizeImageUrl(urlB)) return true;
  const keyA = extractCatalogImageKey(urlA);
  const keyB = extractCatalogImageKey(urlB);
  if (keyA && keyB && keyA === keyB) return true;
  return false;
}

async function fetchImageFingerprint(url) {
  const norm = normalizeImageUrl(url);
  if (fingerprintCache.has(norm)) return fingerprintCache.get(norm);

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), processing.imageTimeoutMs || 15000);
    const res = await fetch(url, { signal: controller.signal, redirect: 'follow' });
    clearTimeout(timer);
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') || '';
    if (!ct.startsWith('image/')) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 5_000_000) return null;
    const fp = createHash('sha256').update(buf).digest('hex');
    fingerprintCache.set(norm, fp);
    return fp;
  } catch {
    return null;
  }
}

async function anyUrlsMatch(urlsA, urlsB, compareContent = true) {
  for (const a of urlsA) {
    for (const b of urlsB) {
      if (urlsReferToSameImage(a, b)) {
        return { matched: true, rmsUrl: a, drUrl: b, method: 'url' };
      }
    }
  }

  if (!compareContent || !urlsA.length || !urlsB.length) {
    return { matched: false };
  }

  for (const a of urlsA.slice(0, 2)) {
    await fetchImageFingerprint(a);
  }
  for (const b of urlsB.slice(0, 2)) {
    await fetchImageFingerprint(b);
  }

  for (const a of urlsA.slice(0, 2)) {
    const fpA = fingerprintCache.get(normalizeImageUrl(a));
    if (!fpA) continue;
    for (const b of urlsB.slice(0, 2)) {
      const fpB = fingerprintCache.get(normalizeImageUrl(b));
      if (fpB && fpA === fpB) {
        return { matched: true, rmsUrl: a, drUrl: b, method: 'fingerprint' };
      }
    }
  }

  return { matched: false };
}

async function googleImageSearch(query, limit = 3) {
  const key = processing.googleCseKey;
  const cx = processing.googleCseCx;
  if (!key || !cx || !query) return [];

  const cacheKey = query.toLowerCase().trim();
  if (searchCache.has(cacheKey)) return searchCache.get(cacheKey);

  try {
    const q = encodeURIComponent(query);
    const url = `https://www.googleapis.com/customsearch/v1?key=${key}&cx=${cx}&q=${q}&searchType=image&num=${limit}&safe=active`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return [];
    const data = await res.json();
    const urls = (data.items || [])
      .map(i => i.link)
      .filter(u => u && u.startsWith('http'));
    searchCache.set(cacheKey, urls);
    return urls;
  } catch (err) {
    matchLogger.debug('Google image search failed', { query, err: err.message });
    return [];
  }
}

function collectCatalogUrlsForRms(rms, rmsParsed, imageIndex) {
  const urls = new Set();
  const hits = searchImageCatalogByName(imageIndex, rmsParsed, 5);
  for (const hit of hits) {
    for (const u of hit.entry?.urls || []) urls.add(u);
    if (hit.primaryUrl) urls.add(hit.primaryUrl);
  }
  return [...urls];
}

function collectCatalogUrlsForDr(dr, imageIndex) {
  const pid = getDrProductId(dr);
  return pid ? lookupImagesByProductId(imageIndex, pid) : [];
}

/**
 * Verify RMS vs DR candidate by comparing images (catalog + optional web search).
 */
export async function verifyProductPairImages(rms, dr, rmsParsed, imageIndex, options = {}) {
  const useWebSearch = options.webSearch !== false && processing.googleCseKey && processing.googleCseCx;

  let rmsUrls = collectCatalogUrlsForRms(rms, rmsParsed, imageIndex);
  let drUrls = collectCatalogUrlsForDr(dr, imageIndex);

  if (useWebSearch) {
    const rmsQuery = [rms.manufacturer, rms.name].filter(Boolean).join(' ').trim();
    const drQuery = dr.name || '';
    const [webRms, webDr] = await Promise.all([
      googleImageSearch(rmsQuery, 3),
      googleImageSearch(drQuery, 3),
    ]);
    rmsUrls = [...new Set([...rmsUrls, ...webRms])];
    drUrls = [...new Set([...drUrls, ...webDr])];
  }

  if (!rmsUrls.length || !drUrls.length) {
    return { verified: false, reason: 'missing_images', rmsUrls: rmsUrls.length, drUrls: drUrls.length };
  }

  const match = await anyUrlsMatch(rmsUrls, drUrls, options.compareContent !== false);
  if (!match.matched) {
    return { verified: false, reason: 'no_shared_image', rmsUrls: rmsUrls.length, drUrls: drUrls.length };
  }

  return {
    verified: true,
    sharedImageUrl: match.rmsUrl,
    rmsImageUrl: match.rmsUrl,
    drImageUrl: match.drUrl,
    matchMethod: match.method,
    usedWebSearch: useWebSearch,
  };
}

/**
 * For rejected matches with best suggestion score >= minScore:
 * verify top DR candidates; accept when web/catalog images match.
 */
export async function recoverViaWebImageVerify(unmatched, imageIndex, aliases = {}, options = {}) {
  const minScore = options.minScore ?? processing.webImageMinScore ?? 50;
  const maxCandidates = options.maxCandidates ?? 3;

  const recovered = [];
  const stillUnmatched = [];
  let checked = 0;

  for (const r of unmatched) {
    const suggestions = (r.suggestions || []).filter(s => s.dr && s.confidence >= minScore);
    if (!suggestions.length) {
      stillUnmatched.push(r);
      continue;
    }

    checked++;
    const rmsParsed = r.parsed ?? parseProduct(r.rms, aliases);
    let verified = null;
    let bestSuggestion = null;

    for (const s of suggestions.slice(0, maxCandidates)) {
      const result = await verifyProductPairImages(r.rms, s.dr, rmsParsed, imageIndex, options);
      if (result.verified) {
        verified = result;
        bestSuggestion = s;
        break;
      }
    }

    if (verified && bestSuggestion) {
      const confidence = Math.max(bestSuggestion.confidence, 78);
      const status = confidence >= 85 ? 'auto_matched' : 'review_required';
      recovered.push({
        rms: r.rms,
        dr: bestSuggestion.dr,
        confidence,
        method: 'web_image_verified',
        status,
        parsed: rmsParsed,
        dr_product_id: getDrProductId(bestSuggestion.dr),
        web_image_verify: verified,
        suggestions: suggestions.slice(0, 3),
        lowConfidence: status === 'review_required',
        lowConfidenceFlags: ['web_image_confirmed'],
      });
    } else {
      stillUnmatched.push(r);
    }
  }

  matchLogger.info('Web image verification pass', {
    checked,
    recovered: recovered.length,
    minScore,
    googleCse: !!(processing.googleCseKey && processing.googleCseCx),
  });

  return { recovered, stillUnmatched };
}

export function clearWebVerifyCaches() {
  fingerprintCache.clear();
  searchCache.clear();
}
