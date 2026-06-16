import Fuse from 'fuse.js';
import { normalizeName, normalizePackSize, normalizeManufacturer, manufacturersMatch, packSizesMatch } from '../normalizer/index.js';
import { matching, formSynonyms } from '../config/index.js';
import { matchLogger } from '../logger/index.js';
import { recordFuzzyMatch } from './aliasLearner.js';
import {
  parseProduct,
  buildStructuralKey,
  buildRelaxedKey,
  buildNameStrengthKey,
  nameTokenSimilarity,
  coreTokenSimilarity,
} from '../parser/productParser.js';

/** Production weights: brand 40%, strength 25%, pack 15%, mfg 10%, form 5%, name 5% */
const SCORE_WEIGHTS = {
  brand: 40,
  strength: 25,
  pack: 15,
  manufacturer: 10,
  form: 5,
  name: 5,
};

const MAX_CANDIDATES = 500;

const PASS3_WEIGHTS = {
  brand: 30,
  strength: 25,
  coreTokens: 35,
  form: 5,
  mfg: 5,
};

const FUSE_GLOBAL_OPTS = {
  keys: [
    { name: '_brand', weight: 0.35 },
    { name: '_coreKey', weight: 0.40 },
    { name: '_strength', weight: 0.25 },
  ],
  includeScore: true,
  threshold: 0.45,
  distance: 300,
  ignoreLocation: true,
  minMatchCharLength: 2,
};

const FUSE_OPTS = {
  keys: [
    { name: '_brand',     weight: 0.40 },
    { name: '_strength',  weight: 0.25 },
    { name: '_pack',      weight: 0.15 },
    { name: '_mfg',       weight: 0.10 },
    { name: '_form',      weight: 0.05 },
    { name: '_name',      weight: 0.05 },
  ],
  includeScore: true,
  threshold: 0.55,
  distance: 200,
  ignoreLocation: true,
  minMatchCharLength: 2,
};

function canonicalForm(form) {
  if (!form) return '';
  const lower = form.toLowerCase();
  return formSynonyms[lower] || lower;
}

function formsEquivalent(a, b) {
  if (!a && !b) return true;
  if (!a || !b) return false;
  if (a === b || canonicalForm(a) === canonicalForm(b)) return true;
  const ca = canonicalForm(a) || a;
  const cb = canonicalForm(b) || b;
  const dental = new Set(['paste', 'powder']);
  if (dental.has(ca) && dental.has(cb)) return true;
  return false;
}

function brandsSimilar(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  if (a.endsWith(` ${b}`) || b.endsWith(` ${a}`)) return true;
  const ta = a.split(/\s+/)[0];
  const tb = b.split(/\s+/)[0];
  if (ta.length >= 3 && tb.length >= 3 && (ta.startsWith(tb) || tb.startsWith(ta))) return true;
  const la = a.split(/\s+/).pop();
  const lb = b.split(/\s+/).pop();
  if (la && lb && la.length >= 3 && la === lb) return true;
  const setA = new Set(a.split(/\s+/).filter(t => t.length >= 3));
  const setB = new Set(b.split(/\s+/).filter(t => t.length >= 3));
  if (setA.size && setB.size) {
    let shared = 0;
    for (const t of setA) if (setB.has(t)) shared++;
    if (shared >= 1 && shared >= Math.min(setA.size, setB.size)) return true;
  }
  return false;
}

function makeFuseIndex(items) {
  return new Fuse(items, FUSE_OPTS);
}

/**
 * Explicit composite score (0–100) prioritising brand + strength + form.
 */
export function computeCompositeScore(rmsParsed, drParsed) {
  let score = 0;
  const breakdown = {};

  // Brand (40%) — product name brand only
  const brandNameMatch = rmsParsed.brand && drParsed.brand && rmsParsed.brand === drParsed.brand;
  if (brandNameMatch) {
    breakdown.brand = SCORE_WEIGHTS.brand;
  } else if (
    rmsParsed.brand && drParsed.brand &&
    (rmsParsed.brand.includes(drParsed.brand) || drParsed.brand.includes(rmsParsed.brand))
  ) {
    breakdown.brand = Math.round(SCORE_WEIGHTS.brand * 0.65);
  } else if (brandsSimilar(rmsParsed.brand, drParsed.brand)) {
    breakdown.brand = Math.round(SCORE_WEIGHTS.brand * 0.45);
  } else {
    breakdown.brand = 0;
  }
  score += breakdown.brand;

  // Manufacturer (10%)
  const mfgMatch = manufacturersMatch(rmsParsed.manufacturer, drParsed.manufacturer);
  if (mfgMatch) {
    breakdown.manufacturer = SCORE_WEIGHTS.manufacturer;
    score += SCORE_WEIGHTS.manufacturer;
  } else if (rmsParsed.manufacturer && drParsed.manufacturer) {
    breakdown.manufacturer = 0;
  } else {
    breakdown.manufacturer = Math.round(SCORE_WEIGHTS.manufacturer * 0.4);
    score += breakdown.manufacturer;
  }

  // Strength — mismatch is a hard penalty
  if (rmsParsed.strength && drParsed.strength) {
    if (rmsParsed.strength === drParsed.strength) {
      breakdown.strength = SCORE_WEIGHTS.strength;
      score += SCORE_WEIGHTS.strength;
    } else {
      const rN = rmsParsed.strength.match(/^(\d+)/);
      const dN = drParsed.strength.match(/^(\d+)/);
      if (rN && dN && rN[1] === dN[1]) {
        breakdown.strength = Math.round(SCORE_WEIGHTS.strength * 0.85);
        score += breakdown.strength;
      } else {
        breakdown.strength = 0;
        score = Math.max(0, score - 25);
      }
    }
  } else if (!rmsParsed.strength && !drParsed.strength) {
    breakdown.strength = Math.round(SCORE_WEIGHTS.strength * 0.4);
    score += breakdown.strength;
  }

  // Dosage form via synonyms
  if (rmsParsed.form && drParsed.form) {
    if (rmsParsed.form === drParsed.form) {
      breakdown.form = SCORE_WEIGHTS.form;
      score += SCORE_WEIGHTS.form;
    }
  } else if (!rmsParsed.form && !drParsed.form) {
    breakdown.form = Math.round(SCORE_WEIGHTS.form * 0.5);
    score += breakdown.form;
  }

  // Pack size
  if (packSizesMatch(rmsParsed.packSize, drParsed.packSize)) {
    breakdown.pack = SCORE_WEIGHTS.pack;
    score += SCORE_WEIGHTS.pack;
  } else if (!rmsParsed.packSize || !drParsed.packSize) {
    breakdown.pack = Math.round(SCORE_WEIGHTS.pack * 0.3);
    score += breakdown.pack;
  }

  // Name token similarity (low weight)
  const nameSim = nameTokenSimilarity(rmsParsed.normalizedName, drParsed.normalizedName);
  breakdown.name = Math.round(SCORE_WEIGHTS.name * nameSim);
  score += breakdown.name;

  return { confidence: Math.min(100, Math.round(score)), breakdown };
}

/**
 * Second-pass scoring: lenient on form synonyms, brand variations, missing fields.
 */
export function computeCompositeScoreLenient(rmsParsed, drParsed) {
  let score = 0;
  const breakdown = {};

  const brandNameMatch = rmsParsed.brand && drParsed.brand && rmsParsed.brand === drParsed.brand;
  const brandSimilar = brandsSimilar(rmsParsed.brand, drParsed.brand);

  if (brandNameMatch) {
    breakdown.brand = SCORE_WEIGHTS.brand;
  } else if (brandSimilar) {
    breakdown.brand = Math.round(SCORE_WEIGHTS.brand * 0.82);
  } else if (
    rmsParsed.brand && drParsed.brand &&
    (rmsParsed.brand.includes(drParsed.brand) || drParsed.brand.includes(rmsParsed.brand))
  ) {
    breakdown.brand = Math.round(SCORE_WEIGHTS.brand * 0.68);
  } else {
    breakdown.brand = 0;
  }
  score += breakdown.brand;

  const mfgMatch = manufacturersMatch(rmsParsed.manufacturer, drParsed.manufacturer);
  if (mfgMatch) {
    breakdown.manufacturer = SCORE_WEIGHTS.manufacturer;
    score += SCORE_WEIGHTS.manufacturer;
  } else if (!rmsParsed.manufacturer || !drParsed.manufacturer) {
    breakdown.manufacturer = Math.round(SCORE_WEIGHTS.manufacturer * 0.55);
    score += breakdown.manufacturer;
  } else {
    breakdown.manufacturer = Math.round(SCORE_WEIGHTS.manufacturer * 0.25);
    score += breakdown.manufacturer;
  }

  if (rmsParsed.strength && drParsed.strength) {
    if (rmsParsed.strength === drParsed.strength) {
      breakdown.strength = SCORE_WEIGHTS.strength;
      score += SCORE_WEIGHTS.strength;
    } else {
      const rN = rmsParsed.strength.match(/^(\d+(?:\.\d+)?)/);
      const dN = drParsed.strength.match(/^(\d+(?:\.\d+)?)/);
      if (rN && dN && rN[1] === dN[1]) {
        breakdown.strength = Math.round(SCORE_WEIGHTS.strength * 0.9);
        score += breakdown.strength;
      } else {
        breakdown.strength = 0;
        score = Math.max(0, score - 15);
      }
    }
  } else if (!rmsParsed.strength && !drParsed.strength) {
    breakdown.strength = Math.round(SCORE_WEIGHTS.strength * 0.5);
    score += breakdown.strength;
  } else {
    breakdown.strength = Math.round(SCORE_WEIGHTS.strength * 0.25);
    score += breakdown.strength;
  }

  if (formsEquivalent(rmsParsed.form, drParsed.form)) {
    breakdown.form = SCORE_WEIGHTS.form;
    score += SCORE_WEIGHTS.form;
  } else if (!rmsParsed.form || !drParsed.form) {
    breakdown.form = Math.round(SCORE_WEIGHTS.form * 0.7);
    score += breakdown.form;
  }

  if (packSizesMatch(rmsParsed.packSize, drParsed.packSize)) {
    breakdown.pack = SCORE_WEIGHTS.pack;
    score += SCORE_WEIGHTS.pack;
  } else if (!rmsParsed.packSize || !drParsed.packSize) {
    breakdown.pack = Math.round(SCORE_WEIGHTS.pack * 0.5);
    score += breakdown.pack;
  } else {
    const rN = rmsParsed.packSize.match(/^(\d+(?:\.\d+)?)/);
    const dN = drParsed.packSize.match(/^(\d+(?:\.\d+)?)/);
    if (rN && dN && rN[1] === dN[1]) {
      breakdown.pack = Math.round(SCORE_WEIGHTS.pack * 0.7);
      score += breakdown.pack;
    }
  }

  const nameSim = nameTokenSimilarity(rmsParsed.normalizedName, drParsed.normalizedName);
  breakdown.name = Math.round(SCORE_WEIGHTS.name * nameSim);
  score += breakdown.name;

  return { confidence: Math.min(100, Math.round(score)), breakdown };
}

/**
 * Pass-3 scoring: brand + strength + core token overlap; form/pack optional.
 */
export function computeCompositeScorePass3(rmsParsed, drParsed) {
  let score = 0;
  const breakdown = {};
  const lowConfidenceFlags = [];

  const brandMatch = rmsParsed.brand && drParsed.brand && rmsParsed.brand === drParsed.brand;
  const brandSimilar = brandsSimilar(rmsParsed.brand, drParsed.brand);
  const mfgMatch = manufacturersMatch(rmsParsed.manufacturer, drParsed.manufacturer);

  if (brandMatch) {
    breakdown.brand = PASS3_WEIGHTS.brand;
  } else if (brandSimilar) {
    breakdown.brand = Math.round(PASS3_WEIGHTS.brand * 0.85);
    lowConfidenceFlags.push('brand_fuzzy');
  } else {
    breakdown.brand = 0;
  }
  score += breakdown.brand;

  if (rmsParsed.strength && drParsed.strength) {
    if (rmsParsed.strength === drParsed.strength) {
      breakdown.strength = PASS3_WEIGHTS.strength;
    } else {
      const rN = rmsParsed.strength.match(/^(\d+(?:\.\d+)?)/);
      const dN = drParsed.strength.match(/^(\d+(?:\.\d+)?)/);
      if (rN && dN && rN[1] === dN[1]) {
        breakdown.strength = Math.round(PASS3_WEIGHTS.strength * 0.9);
      } else {
        breakdown.strength = Math.round(PASS3_WEIGHTS.strength * 0.2);
        lowConfidenceFlags.push('strength_mismatch');
      }
    }
  } else if (!rmsParsed.strength && !drParsed.strength) {
    breakdown.strength = Math.round(PASS3_WEIGHTS.strength * 0.6);
  } else {
    breakdown.strength = Math.round(PASS3_WEIGHTS.strength * 0.35);
  }
  score += breakdown.strength;

  const coreSim = coreTokenSimilarity(rmsParsed, drParsed);
  breakdown.coreTokens = Math.round(PASS3_WEIGHTS.coreTokens * coreSim);
  score += breakdown.coreTokens;
  if (coreSim < 0.5) lowConfidenceFlags.push('low_token_overlap');

  if (formsEquivalent(rmsParsed.form, drParsed.form)) {
    breakdown.form = PASS3_WEIGHTS.form;
    score += breakdown.form;
  } else if (!rmsParsed.form || !drParsed.form) {
    breakdown.form = Math.round(PASS3_WEIGHTS.form * 0.6);
    score += breakdown.form;
  }

  if (mfgMatch) {
    breakdown.mfg = PASS3_WEIGHTS.mfg;
    score += breakdown.mfg;
  } else if (rmsParsed.manufacturer && drParsed.manufacturer) {
    lowConfidenceFlags.push('mfg_mismatch');
  }

  return {
    confidence: Math.min(100, Math.round(score)),
    breakdown,
    lowConfidence: lowConfidenceFlags.length > 0,
    lowConfidenceFlags,
  };
}

const PASS4_WEIGHTS = {
  brand: 22,
  strength: 12,
  coreTokens: 48,
  form: 5,
  mfg: 13,
};

/**
 * Pass-4 scoring: maximum recall — core tokens + brand; strength/pack optional.
 */
export function computeCompositeScorePass4(rmsParsed, drParsed) {
  let score = 0;
  const breakdown = {};
  const lowConfidenceFlags = [];

  const brandMatch = rmsParsed.brand && drParsed.brand && rmsParsed.brand === drParsed.brand;
  const brandSimilar = brandsSimilar(rmsParsed.brand, drParsed.brand);
  const mfgMatch = manufacturersMatch(rmsParsed.manufacturer, drParsed.manufacturer);

  if (brandMatch) {
    breakdown.brand = PASS4_WEIGHTS.brand;
  } else if (brandSimilar) {
    breakdown.brand = Math.round(PASS4_WEIGHTS.brand * 0.88);
    lowConfidenceFlags.push('brand_fuzzy');
  } else if (rmsParsed.brand && drParsed.brand) {
    breakdown.brand = Math.round(PASS4_WEIGHTS.brand * 0.35);
  }
  score += breakdown.brand;

  if (rmsParsed.strength && drParsed.strength) {
    if (rmsParsed.strength === drParsed.strength) {
      breakdown.strength = PASS4_WEIGHTS.strength;
    } else {
      const rN = rmsParsed.strength.match(/^(\d+(?:\.\d+)?)/);
      const dN = drParsed.strength.match(/^(\d+(?:\.\d+)?)/);
      if (rN && dN && rN[1] === dN[1]) {
        breakdown.strength = Math.round(PASS4_WEIGHTS.strength * 0.85);
      } else {
        breakdown.strength = Math.round(PASS4_WEIGHTS.strength * 0.25);
        lowConfidenceFlags.push('strength_mismatch');
      }
    }
  } else {
    breakdown.strength = Math.round(PASS4_WEIGHTS.strength * 0.55);
  }
  score += breakdown.strength;

  const coreSim = coreTokenSimilarity(rmsParsed, drParsed);
  breakdown.coreTokens = Math.round(PASS4_WEIGHTS.coreTokens * coreSim);
  score += breakdown.coreTokens;
  if (coreSim < 0.45) lowConfidenceFlags.push('low_token_overlap');

  if (formsEquivalent(rmsParsed.form, drParsed.form)) {
    breakdown.form = PASS4_WEIGHTS.form;
    score += breakdown.form;
  } else if (!rmsParsed.form || !drParsed.form) {
    breakdown.form = Math.round(PASS4_WEIGHTS.form * 0.7);
    score += breakdown.form;
  }

  if (mfgMatch) {
    breakdown.mfg = PASS4_WEIGHTS.mfg;
    score += breakdown.mfg;
  } else if (!rmsParsed.manufacturer || !drParsed.manufacturer) {
    breakdown.mfg = Math.round(PASS4_WEIGHTS.mfg * 0.5);
    score += breakdown.mfg;
  } else if (brandSimilar && coreSim >= 0.5) {
    breakdown.mfg = Math.round(PASS4_WEIGHTS.mfg * 0.35);
    score += breakdown.mfg;
    lowConfidenceFlags.push('mfg_mismatch');
  } else {
    lowConfidenceFlags.push('mfg_mismatch');
  }

  if (coreSim >= 0.55 && (brandSimilar || brandMatch)) {
    score = Math.max(score, 66);
  }
  if (coreSim >= 0.68 && (brandSimilar || mfgMatch)) {
    score = Math.max(score, 72);
  }

  return {
    confidence: Math.min(100, Math.round(score)),
    breakdown,
    lowConfidence: lowConfidenceFlags.length > 0 || score < 75,
    lowConfidenceFlags,
  };
}

function getScoreFn(options = {}) {
  if (options.fourthPass) return computeCompositeScorePass4;
  if (options.thirdPass) return computeCompositeScorePass3;
  return options.secondPass ? computeCompositeScoreLenient : computeCompositeScore;
}

function enrichEntry(p, aliases) {
  const parsed = parseProduct(p, aliases);
  return {
    ...p,
    _parsed: parsed,
    _brand: parsed.brand,
    _strength: parsed.strength,
    _form: parsed.form,
    _pack: parsed.packSize,
    _name: parsed.normalizedName,
    _coreKey: parsed.coreTokenKey,
    _mfg: parsed.manufacturer,
    _composite: [parsed.brand, parsed.strength, parsed.form, parsed.packSize].filter(Boolean).join(' '),
  };
}

export function createIndexBuilder(aliases = {}) {
  return {
    aliases,
    barcodeMap: new Map(),
    exactMap: new Map(),
    structuralMap: new Map(),
    relaxedMap: new Map(),
    nameStrengthMap: new Map(),
    nameOnlyMap: new Map(),
    mfgNameMap: new Map(),
    namePackMap: new Map(),
    strengthMap: new Map(),
    packMap: new Map(),
    mfgBuckets: new Map(),
    brandBuckets: new Map(),
    brandByFirstToken: new Map(),
    normalized: [],
    productCount: 0,
  };
}

export function addProductToIndex(builder, p) {
  const aliases = builder.aliases;
  const entry = enrichEntry(p, aliases);

  if (p.barcode) {
    const bc = String(p.barcode).trim();
    if (bc) builder.barcodeMap.set(bc, p);
  }

  const key = `${entry._mfg}|${normalizeName(p.name)}|${normalizePackSize(p.pack_size)}`;
  if (!builder.exactMap.has(key)) builder.exactMap.set(key, p);

  const sKey = buildStructuralKey(entry._parsed);
  if (!builder.structuralMap.has(sKey)) builder.structuralMap.set(sKey, p);

  const rKey = buildRelaxedKey(entry._parsed);
  if (!builder.relaxedMap.has(rKey)) builder.relaxedMap.set(rKey, []);
  builder.relaxedMap.get(rKey).push(entry);

  const nsKey = buildNameStrengthKey(entry._parsed);
  if (nsKey !== '|' && !builder.nameStrengthMap.has(nsKey)) {
    builder.nameStrengthMap.set(nsKey, []);
  }
  if (nsKey !== '|') builder.nameStrengthMap.get(nsKey).push(entry);

  const npKey = `${entry._parsed.normalizedName}|${entry._parsed.packSize}`;
  if (!builder.namePackMap.has(npKey)) builder.namePackMap.set(npKey, p);

  const normName = entry._parsed.normalizedName;
  if (normName) {
    if (!builder.nameOnlyMap.has(normName)) builder.nameOnlyMap.set(normName, []);
    builder.nameOnlyMap.get(normName).push(entry);
    const mnKey = `${entry._mfg}|${normName}`;
    if (!builder.mfgNameMap.has(mnKey)) builder.mfgNameMap.set(mnKey, []);
    builder.mfgNameMap.get(mnKey).push(entry);
  }

  const mfgKey = entry._mfg || '_unknown';
  if (!builder.mfgBuckets.has(mfgKey)) builder.mfgBuckets.set(mfgKey, []);
  builder.mfgBuckets.get(mfgKey).push(entry);

  const brandKey = entry._parsed.brand || '_unknown';
  if (!builder.brandBuckets.has(brandKey)) builder.brandBuckets.set(brandKey, []);
  builder.brandBuckets.get(brandKey).push(entry);

  if (entry._parsed.strength) {
    if (!builder.strengthMap.has(entry._parsed.strength)) builder.strengthMap.set(entry._parsed.strength, []);
    builder.strengthMap.get(entry._parsed.strength).push(entry);
  }

  if (entry._parsed.packSize) {
    if (!builder.packMap.has(entry._parsed.packSize)) builder.packMap.set(entry._parsed.packSize, []);
    builder.packMap.get(entry._parsed.packSize).push(entry);
  }

  const brandFirst = brandKey.split(/\s+/)[0];
  if (brandFirst && brandFirst !== '_unknown' && brandFirst.length >= 3) {
    if (!builder.brandByFirstToken.has(brandFirst)) builder.brandByFirstToken.set(brandFirst, []);
    builder.brandByFirstToken.get(brandFirst).push(entry);
  }

  builder.normalized.push(entry);
  builder.productCount++;
}

export function finalizeIndex(builder) {
  const {
    barcodeMap, exactMap, structuralMap, relaxedMap, nameStrengthMap,
    nameOnlyMap, mfgNameMap, namePackMap, strengthMap, packMap,
    mfgBuckets, brandBuckets, brandByFirstToken, normalized,
  } = builder;

  const fuseByMfg = new Map();
  const singleMfgItems = new Map();
  for (const [mfg, items] of mfgBuckets) {
    if (items.length === 1) singleMfgItems.set(mfg, items[0]);
    else fuseByMfg.set(mfg, makeFuseIndex(items));
  }
  const fuseByBrand = new Map();
  const singleBrandItems = new Map();
  for (const [brand, items] of brandBuckets) {
    if (items.length === 1) singleBrandItems.set(brand, items[0]);
    else fuseByBrand.set(brand, makeFuseIndex(items));
  }

  const mfgByToken = new Map();
  for (const mfg of mfgBuckets.keys()) {
    const token = mfg.split(/\s+/)[0];
    if (!token || token.length < 3 || mfg === '_unknown') continue;
    if (!mfgByToken.has(token)) mfgByToken.set(token, []);
    mfgByToken.get(token).push(mfg);
  }

  matchLogger.info(`Index built: ${barcodeMap.size} barcodes, ${structuralMap.size} structural keys, ${strengthMap.size} strength keys, ${packMap.size} pack keys, ${nameStrengthMap.size} name+strength keys, ${mfgBuckets.size} mfg buckets (${fuseByMfg.size} fuse), ${brandBuckets.size} brand buckets (${fuseByBrand.size} fuse)`);
  return {
    barcodeMap, exactMap, structuralMap, relaxedMap, nameStrengthMap,
    nameOnlyMap, mfgNameMap, namePackMap,
    strengthMap, packMap,
    mfgBuckets, brandBuckets,
    fuseByMfg, fuseByBrand, singleMfgItems, singleBrandItems, mfgByToken,
    brandByFirstToken, normalized,
    productCount: builder.productCount,
  };
}

export function buildIndex(drProducts, aliases = {}) {
  const builder = createIndexBuilder(aliases);
  for (const p of drProducts) addProductToIndex(builder, p);
  return finalizeIndex(builder);
}

export function gatherCandidates(rmsParsed, index, options = {}) {
  const candidates = new Map();
  const fuseLimit = options.secondPass ? 15 : 10;
  const minCandidates = options.secondPass ? 5 : 3;

  const sKey = buildStructuralKey(rmsParsed);
  if (index.structuralMap.has(sKey)) {
    const hit = index.structuralMap.get(sKey);
    candidates.set(hit.id ?? hit.name, hit);
    return [...candidates.values()];
  }

  // Index union: brand OR manufacturer OR strength OR pack (never full scan)
  if (rmsParsed.brand) {
    for (const e of (index.brandBuckets?.get(rmsParsed.brand) || []).slice(0, 120)) {
      addCandidate(candidates, e);
    }
  }

  if (rmsParsed.manufacturer) {
    for (const e of (index.mfgBuckets?.get(rmsParsed.manufacturer) || []).slice(0, 100)) {
      addCandidate(candidates, e);
    }
  }

  if (rmsParsed.strength) {
    for (const e of (index.strengthMap?.get(rmsParsed.strength) || []).slice(0, 80)) {
      addCandidate(candidates, e);
    }
  }

  if (rmsParsed.packSize) {
    for (const e of (index.packMap?.get(rmsParsed.packSize) || []).slice(0, 60)) {
      addCandidate(candidates, e);
    }
  }

  const rKey = buildRelaxedKey(rmsParsed);
  for (const e of (index.relaxedMap.get(rKey) || []).slice(0, 40)) {
    addCandidate(candidates, e);
  }

  if (candidates.size >= minCandidates && candidates.size <= MAX_CANDIDATES) {
    return [...candidates.values()].slice(0, MAX_CANDIDATES);
  }

  const mfgFuse = index.fuseByMfg.get(rmsParsed.manufacturer);
  if (mfgFuse) {
    const q = [rmsParsed.brand, rmsParsed.strength, rmsParsed.form].filter(Boolean).join(' ');
    for (const hit of mfgFuse.search(q, { limit: fuseLimit })) {
      addCandidate(candidates, hit.item);
    }
  } else {
    const solo = index.singleMfgItems?.get(rmsParsed.manufacturer);
    if (solo) addCandidate(candidates, solo);
  }

  const brandFuse = index.fuseByBrand.get(rmsParsed.brand);
  if (brandFuse) {
    const q = [rmsParsed.strength, rmsParsed.form, rmsParsed.packSize].filter(Boolean).join(' ');
    for (const hit of brandFuse.search(q, { limit: fuseLimit })) {
      addCandidate(candidates, hit.item);
    }
  } else {
    const solo = index.singleBrandItems?.get(rmsParsed.brand);
    if (solo) addCandidate(candidates, solo);
  }

  if (candidates.size < minCandidates && rmsParsed.manufacturer) {
    const token = rmsParsed.manufacturer.split(/\s+/)[0];
    if (token && token.length >= 3) {
      const mfgSlice = options.secondPass ? 12 : 8;
      for (const mfg of (index.mfgByToken?.get(token) || []).slice(0, mfgSlice)) {
        if (mfg === rmsParsed.manufacturer) continue;
        const fuse = index.fuseByMfg.get(mfg);
        if (!fuse) continue;
        const q = [rmsParsed.brand, rmsParsed.strength, rmsParsed.form].filter(Boolean).join(' ');
        for (const hit of fuse.search(q, { limit: options.secondPass ? 8 : 5 })) {
          addCandidate(candidates, hit.item);
        }
        if (candidates.size >= minCandidates) break;
      }
    }
  }

  return [...candidates.values()].slice(0, MAX_CANDIDATES);
}

function addCandidate(candidates, item) {
  const id = item.id ?? item.name;
  if (!candidates.has(id)) candidates.set(id, item);
}

export function gatherCandidatesPass3(rmsParsed, index) {
  const candidates = new Map();
  const fuseLimit = 15;

  const nsKey = buildNameStrengthKey(rmsParsed);
  for (const e of (index.nameStrengthMap?.get(nsKey) || []).slice(0, 20)) {
    addCandidate(candidates, e);
  }

  const brandOnly = rmsParsed.brand;
  const q = [rmsParsed.brand, rmsParsed.strength, rmsParsed.coreTokenKey].filter(Boolean).join(' ');

  const brandFuse = index.fuseByBrand.get(rmsParsed.brand);
  if (brandFuse) {
    for (const hit of brandFuse.search(q, { limit: fuseLimit })) {
      addCandidate(candidates, hit.item);
    }
  } else {
    const solo = index.singleBrandItems?.get(rmsParsed.brand);
    if (solo) addCandidate(candidates, solo);
    else if (brandOnly) {
      const firstTok = brandOnly.split(/\s+/)[0];
      if (firstTok && firstTok.length >= 3) {
        for (const e of (index.brandByFirstToken?.get(firstTok) || []).slice(0, 25)) {
          addCandidate(candidates, e);
        }
      }
    }
  }

  const rKey = buildRelaxedKey(rmsParsed);
  for (const e of (index.relaxedMap.get(rKey) || []).slice(0, 15)) {
    addCandidate(candidates, e);
  }

  if (candidates.size < 5) {
    const mfgFuse = index.fuseByMfg.get(rmsParsed.manufacturer);
    if (mfgFuse) {
      for (const hit of mfgFuse.search(q, { limit: fuseLimit })) {
        addCandidate(candidates, hit.item);
      }
    } else {
      const solo = index.singleMfgItems?.get(rmsParsed.manufacturer);
      if (solo) addCandidate(candidates, solo);
    }
  }

  if (candidates.size < 5 && rmsParsed.manufacturer) {
    const token = rmsParsed.manufacturer.split(/\s+/)[0];
    for (const mfg of (index.mfgByToken?.get(token) || []).slice(0, 8)) {
      const fuse = index.fuseByMfg.get(mfg);
      if (!fuse) continue;
      for (const hit of fuse.search(q, { limit: 8 })) {
        addCandidate(candidates, hit.item);
      }
      if (candidates.size >= 10) break;
    }
  }

  return [...candidates.values()];
}

export function fuseFallbackPass3(rmsParsed, index) {
  const q = [rmsParsed.brand, rmsParsed.strength, rmsParsed.coreTokenKey, rmsParsed.normalizedName]
    .filter(Boolean).join(' ');
  let hits = [];

  const brandFuse = index.fuseByBrand.get(rmsParsed.brand);
  if (brandFuse) hits = brandFuse.search(q, { limit: 12 });

  if (!hits.length && rmsParsed.manufacturer) {
    const mfgFuse = index.fuseByMfg.get(rmsParsed.manufacturer);
    if (mfgFuse) hits = mfgFuse.search(q, { limit: 12 });
  }

  if (!hits.length && rmsParsed.brand) {
    const firstTok = rmsParsed.brand.split(/\s+/)[0];
    if (firstTok && firstTok.length >= 3) {
      for (const e of (index.brandByFirstToken?.get(firstTok) || []).slice(0, 15)) {
        hits.push({ item: e, score: 0.35 });
      }
    }
  }

  return hits.map(h => {
    const drParsed = h.item._parsed ?? parseProduct(h.item);
    const { confidence, breakdown, lowConfidence, lowConfidenceFlags } = computeCompositeScorePass3(rmsParsed, drParsed);
    const fuseBoost = Math.round((1 - h.score) * 12);
    return {
      dr: h.item,
      confidence: Math.min(100, confidence + fuseBoost),
      breakdown,
      lowConfidence: lowConfidence || fuseBoost < 8,
      lowConfidenceFlags: lowConfidenceFlags || [],
      fuseScore: h.score,
    };
  }).sort((a, b) => b.confidence - a.confidence);
}

export function gatherCandidatesPass4(rmsParsed, index) {
  const candidates = new Map();
  const fuseLimit = 30;

  for (const e of gatherCandidatesPass3(rmsParsed, index)) {
    addCandidate(candidates, e);
  }

  const normName = rmsParsed.normalizedName;
  for (const e of (index.nameOnlyMap?.get(normName) || []).slice(0, 20)) {
    addCandidate(candidates, e);
  }

  if (rmsParsed.brand) {
    const firstTok = rmsParsed.brand.split(/\s+/)[0];
    if (firstTok && firstTok.length >= 3) {
      for (const e of (index.brandByFirstToken?.get(firstTok) || []).slice(0, 35)) {
        addCandidate(candidates, e);
      }
    }
  }

  const q = [rmsParsed.brand, rmsParsed.coreTokenKey, rmsParsed.normalizedName].filter(Boolean).join(' ');
  if (candidates.size < 8 && rmsParsed.manufacturer) {
    const mfgFuse = index.fuseByMfg.get(rmsParsed.manufacturer);
    if (mfgFuse) {
      for (const hit of mfgFuse.search(q, { limit: fuseLimit })) {
        addCandidate(candidates, hit.item);
      }
    }
  }

  return [...candidates.values()];
}

export function fuseFallbackPass4(rmsParsed, index) {
  const q = [rmsParsed.brand, rmsParsed.strength, rmsParsed.coreTokenKey, rmsParsed.normalizedName]
    .filter(Boolean).join(' ');
  let hits = [];

  const brandFuse = index.fuseByBrand.get(rmsParsed.brand);
  if (brandFuse) hits = brandFuse.search(q, { limit: 20 });

  if (!hits.length && rmsParsed.manufacturer) {
    const mfgFuse = index.fuseByMfg.get(rmsParsed.manufacturer);
    if (mfgFuse) hits = mfgFuse.search(q, { limit: 20 });
  }

  if (!hits.length && rmsParsed.normalizedName) {
    const token = rmsParsed.normalizedName.split(/\s+/)[0];
    if (token && token.length >= 3) {
      for (const e of (index.brandByFirstToken?.get(token) || []).slice(0, 20)) {
        hits.push({ item: e, score: 0.4 });
      }
    }
  }

  return hits.map(h => {
    const drParsed = h.item._parsed ?? parseProduct(h.item);
    const { confidence, breakdown, lowConfidence, lowConfidenceFlags } = computeCompositeScorePass4(rmsParsed, drParsed);
    const fuseBoost = Math.round((1 - h.score) * 15);
    return {
      dr: h.item,
      confidence: Math.min(100, confidence + fuseBoost),
      breakdown,
      lowConfidence: lowConfidence || fuseBoost < 10,
      lowConfidenceFlags: lowConfidenceFlags || [],
      fuseScore: h.score,
    };
  }).sort((a, b) => b.confidence - a.confidence);
}

export function fuseFallback(rmsParsed, index, options = {}) {
  const q = [rmsParsed.brand, rmsParsed.strength, rmsParsed.form, rmsParsed.packSize, rmsParsed.normalizedName]
    .filter(Boolean).join(' ');
  const scoreFn = getScoreFn(options);
  const fuseLimit = options.secondPass ? 8 : 5;
  const fuseBoostMax = options.secondPass ? 15 : 10;

  let hits = [];
  const brandFuse = index.fuseByBrand.get(rmsParsed.brand);
  if (brandFuse) hits = brandFuse.search(q, { limit: fuseLimit });
  else {
    const solo = index.singleBrandItems?.get(rmsParsed.brand);
    if (solo) hits = [{ item: solo, score: 0.1 }];
  }

  if (!hits.length) {
    const mfgFuse = index.fuseByMfg.get(rmsParsed.manufacturer);
    if (mfgFuse) hits = mfgFuse.search(q, { limit: fuseLimit });
    else {
      const solo = index.singleMfgItems?.get(rmsParsed.manufacturer);
      if (solo) hits = [{ item: solo, score: 0.1 }];
    }
  }

  return hits.map(h => {
    const drParsed = h.item._parsed ?? parseProduct(h.item);
    const { confidence } = scoreFn(rmsParsed, drParsed);
    const fuseBoost = Math.round((1 - h.score) * fuseBoostMax);
    return {
      dr: h.item,
      confidence: Math.min(100, confidence + fuseBoost),
      fuseScore: h.score,
    };
  }).sort((a, b) => b.confidence - a.confidence);
}

export function scoreCandidates(rmsParsed, candidates, options = {}) {
  const scoreFn = getScoreFn(options);
  return candidates.map(dr => {
    const drParsed = dr._parsed ?? parseProduct(dr);
    const scored = scoreFn(rmsParsed, drParsed);
    return {
      dr,
      confidence: scored.confidence,
      breakdown: scored.breakdown,
      lowConfidence: scored.lowConfidence,
      lowConfidenceFlags: scored.lowConfidenceFlags,
    };
  }).sort((a, b) => b.confidence - a.confidence);
}

export function matchProduct(rmsProduct, index, aliases = {}, rmsParsedIn = null, matchOptions = {}) {
  const { barcodeMap, exactMap, structuralMap, namePackMap, nameStrengthMap } = index;
  const rmsParsed = rmsParsedIn ?? parseProduct(rmsProduct, aliases);
  const autoThreshold = matchOptions.autoThreshold ?? matching.autoThreshold;
  const reviewThreshold = matchOptions.reviewThreshold ?? matching.reviewThreshold;
  const pass2 = matchOptions.secondPass === true;
  const pass4 = matchOptions.fourthPass === true;
  const pass3 = matchOptions.thirdPass === true || pass4;

  // Priority 1: Barcode
  if (rmsProduct.barcode) {
    const bc = String(rmsProduct.barcode).trim();
    if (bc && barcodeMap.has(bc)) {
      return mkResult(rmsProduct, barcodeMap.get(bc), 100, pass3 ? 'barcode_pass3' : 'barcode', 'auto_matched');
    }
    if (pass3 && matchOptions.imageBarcodeMap?.has(bc)) {
      const dr = matchOptions.imageBarcodeMap.get(bc);
      return mkResult(rmsProduct, dr, 98, pass4 ? 'image_id_pass4' : 'image_id_pass3', 'auto_matched', { lowConfidence: false });
    }
  }

  if (pass3) {
    const nsKey = buildNameStrengthKey(rmsParsed);
    const nsHits = nameStrengthMap?.get(nsKey) || [];
    if (nsHits.length === 1) {
      return mkResult(rmsProduct, nsHits[0], 96, 'name_strength_pass3', 'auto_matched');
    }
    if (nsHits.length > 1) {
      const scored = scoreCandidates(rmsParsed, nsHits, matchOptions);
      if (scored[0]?.confidence >= autoThreshold) {
        return mkPass3Result(rmsProduct, scored[0], 'name_strength_pass3', 'auto_matched', autoThreshold, reviewThreshold);
      }
    }
  }

  // Priority 2: Exact manufacturer + name + pack (skip pack requirement in pass3 for name-only)
  if (!pass3) {
    const exactKey = `${rmsParsed.manufacturer}|${normalizeName(rmsProduct.name)}|${rmsParsed.packSize}`;
    if (exactMap.has(exactKey)) {
      return mkResult(rmsProduct, exactMap.get(exactKey), 99, 'exact', 'auto_matched');
    }
  } else {
    const normName = normalizeName(rmsProduct.name);
    const mfgHits = index.mfgNameMap?.get(`${rmsParsed.manufacturer}|${normName}`) || [];
    if (mfgHits.length === 1) {
      return mkResult(rmsProduct, mfgHits[0], 94, 'exact_name_pass3', 'auto_matched', { lowConfidence: true, lowConfidenceFlags: ['pack_ignored'] });
    }
    if (mfgHits.length > 1) {
      const scored = scoreCandidates(rmsParsed, mfgHits, matchOptions);
      if (scored[0]?.confidence >= reviewThreshold) {
        return mkPass3Result(rmsProduct, scored[0], 'exact_name_pass3', null, autoThreshold, reviewThreshold, scored.slice(0, 5), rmsParsed, true, false, scored);
      }
    }
  }

  // Priority 3: Structural (brand + strength + form + pack)
  if (!pass3) {
    const sKey = buildStructuralKey(rmsParsed);
    if (structuralMap.has(sKey)) {
      return mkResult(rmsProduct, structuralMap.get(sKey), 99, 'structural', 'auto_matched');
    }
  }

  // Priority 4: Name + pack alias (manufacturer mismatch)
  if (!pass3) {
    const npKey = `${rmsParsed.normalizedName}|${rmsParsed.packSize}`;
    if (namePackMap.has(npKey)) {
      return mkResult(rmsProduct, namePackMap.get(npKey), 97, 'alias', 'auto_matched');
    }
  } else {
    const nameHits = index.nameOnlyMap?.get(rmsParsed.normalizedName) || [];
    if (nameHits.length === 1) {
      return mkResult(rmsProduct, nameHits[0], 92, 'alias_name_pass3', 'auto_matched', { lowConfidence: true, lowConfidenceFlags: ['pack_ignored', 'mfg_mismatch'] });
    }
    if (nameHits.length > 1) {
      const scored = scoreCandidates(rmsParsed, nameHits, matchOptions);
      if (scored[0]?.confidence >= reviewThreshold) {
        return mkPass3Result(rmsProduct, scored[0], 'alias_name_pass3', null, autoThreshold, reviewThreshold, scored.slice(0, 5), rmsParsed, true, false, scored);
      }
    }
  }

  // Priority 5: Composite scoring over candidates
  const candidates = pass4
    ? gatherCandidatesPass4(rmsParsed, index)
    : pass3
      ? gatherCandidatesPass3(rmsParsed, index)
      : gatherCandidates(rmsParsed, index, matchOptions);
  let suggestions = scoreCandidates(rmsParsed, candidates, matchOptions);

  if (!suggestions.length) {
    suggestions = pass4
      ? fuseFallbackPass4(rmsParsed, index)
      : pass3
        ? fuseFallbackPass3(rmsParsed, index)
        : fuseFallback(rmsParsed, index, matchOptions);
  }

  if (!suggestions.length) {
    return {
      rms: rmsProduct,
      dr: null,
      confidence: 0,
      method: pass4 ? 'unmatched_pass4' : (pass3 ? 'unmatched_pass3' : 'unmatched'),
      status: 'rejected',
      suggestions: [],
      reason: 'No candidates found',
      parsed: rmsParsed,
    };
  }

  const top5 = suggestions.slice(0, 5).map(s => ({
    dr: s.dr,
    confidence: s.confidence,
    breakdown: s.breakdown,
    fuseScore: s.fuseScore,
    lowConfidence: s.lowConfidence,
    lowConfidenceFlags: s.lowConfidenceFlags,
  }));

  const best = top5[0];

  if (best.confidence >= reviewThreshold) {
    recordFuzzyMatch(
      rmsProduct.manufacturer,
      best.dr.manufacturer,
      best.confidence,
      rmsProduct.name,
      best.dr.name
    );
  }

  const methodSuffix = pass4 ? '_pass4' : (pass3 ? '_pass3' : (pass2 ? '_pass2' : ''));

  return mkPass3Result(
    rmsProduct,
    best,
    pass3
      ? (best.fuseScore !== undefined ? `fuzzy${methodSuffix}` : `composite${methodSuffix}`)
      : (pass2 ? 'composite_pass2' : 'composite'),
    null,
    autoThreshold,
    reviewThreshold,
    top5,
    rmsParsed,
    pass3,
    pass2,
    suggestions
  );
}

function mkPass3Result(rms, best, methodHint, statusOverride, autoThreshold, reviewThreshold, top5 = [], rmsParsed = null, pass3 = true, pass2 = false, suggestions = []) {
  let status = statusOverride;
  let method = methodHint;
  if (!status) {
    if (best.confidence >= autoThreshold) status = 'auto_matched';
    else if (best.confidence >= reviewThreshold) status = 'review_required';
    else status = 'rejected';
    if (status === 'rejected' && suggestions.some(s => s.fuseScore !== undefined)) {
      method = pass3 ? 'fuzzy_pass3' : (pass2 ? 'fuzzy_pass2' : 'fuzzy');
    } else if (!pass3) {
      method = pass2 ? 'composite_pass2' : 'composite';
    }
  }

  const flags = best.lowConfidenceFlags || [];
  const lowConf = best.lowConfidence || best.confidence < autoThreshold;

  return {
    rms,
    dr: status !== 'rejected' ? best.dr : null,
    confidence: best.confidence,
    method,
    status,
    suggestions: top5.length ? top5 : [],
    parsed: rmsParsed,
    lowConfidence: status !== 'rejected' && (lowConf || flags.length > 0),
    lowConfidenceFlags: flags,
    reason: status === 'rejected'
      ? `Best confidence ${best.confidence}% below threshold ${reviewThreshold}%`
      : undefined,
  };
}

function mkResult(rms, dr, confidence, method, status, extra = {}) {
  return { rms, dr, confidence, method, status, suggestions: [], ...extra };
}

export function matchBatch(rmsProducts, index, aliases = {}, options = {}) {
  const { quiet = false, ...matchOptions } = options;
  const matched = [], review = [], unmatched = [];
  const methodCounts = {
    barcode: 0, exact: 0, structural: 0, alias: 0, composite: 0, fuzzy: 0,
    composite_pass2: 0, fuzzy_pass2: 0,
    barcode_pass3: 0, image_id_pass3: 0, name_strength_pass3: 0, exact_name_pass3: 0,
    alias_name_pass3: 0, composite_pass3: 0, fuzzy_pass3: 0, unmatched_pass3: 0,
    unmatched: 0,
  };

  const parsed = new Array(rmsProducts.length);
  for (let i = 0; i < rmsProducts.length; i++) {
    parsed[i] = parseProduct(rmsProducts[i], aliases);
  }

  for (let i = 0; i < rmsProducts.length; i++) {
    const result = matchProduct(rmsProducts[i], index, aliases, parsed[i], matchOptions);
    if (result.status === 'auto_matched') matched.push(result);
    else if (result.status === 'review_required') review.push(result);
    else unmatched.push(result);

    const m = result.method || 'unmatched';
    methodCounts[m] = (methodCounts[m] || 0) + 1;
  }

  const stats = {
    total: rmsProducts.length,
    matched: matched.length,
    review: review.length,
    unmatched: unmatched.length,
    matchRate: ((matched.length / rmsProducts.length) * 100).toFixed(1),
    methods: methodCounts,
  };

  if (!quiet) matchLogger.debug('Batch match complete', stats);
  return { matched, review, unmatched, stats };
}

/** Merge parallel worker batch results into one outcome set */
export function mergeMatchBatchResults(batchResults) {
  const matched = [], review = [], unmatched = [];
  const methodCounts = {};

  for (const batch of batchResults) {
    matched.push(...batch.matched);
    review.push(...batch.review);
    unmatched.push(...batch.unmatched);
    for (const [k, v] of Object.entries(batch.stats?.methods || {})) {
      methodCounts[k] = (methodCounts[k] || 0) + v;
    }
  }

  const total = matched.length + review.length + unmatched.length;
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

/** Stable cache key for RMS products */
export function buildProductCacheKey(product) {
  if (product.barcode) return `bc:${String(product.barcode).trim()}`;
  if (product.rms_id) return `rms:${String(product.rms_id).trim()}`;
  if (product.id != null) return `id:${product.id}`;
  const name = normalizeName(product.name);
  const mfg = normalizeManufacturer(product.manufacturer);
  const pack = normalizePackSize(product.pack_size);
  return `hash:${name}|${mfg}|${pack}`;
}

export function resultFromCacheEntry(rmsProduct, entry) {
  if (!entry) return null;
  const dr = entry.dr_snapshot || entry.dr;
  if (!dr && entry.status === 'rejected') {
    return {
      rms: rmsProduct,
      dr: null,
      confidence: entry.confidence ?? 0,
      method: entry.match_method || 'cache',
      status: 'rejected',
      suggestions: [],
      fromCache: true,
      reason: entry.reason || 'Cached unmatched',
    };
  }
  if (!dr) return null;
  return {
    rms: rmsProduct,
    dr,
    confidence: entry.confidence,
    method: entry.match_method || 'cache',
    status: entry.status,
    suggestions: [],
    fromCache: true,
  };
}

/** Split products by cache hits vs needs matching */
export function partitionByCache(rmsProducts, cacheMap) {
  const cached = { matched: [], review: [], unmatched: [] };
  const toMatch = [];

  for (const p of rmsProducts) {
    const key = buildProductCacheKey(p);
    const entry = cacheMap.get(key);
    const result = entry ? resultFromCacheEntry(p, entry) : null;
    if (result) {
      if (result.status === 'auto_matched') cached.matched.push(result);
      else if (result.status === 'review_required') cached.review.push(result);
      else cached.unmatched.push(result);
    } else {
      toMatch.push(p);
    }
  }

  return { cached, toMatch };
}

/** Validate the canonical DOLO 250 SYRUP example — must score >95% */
export function validateDoloExample(index, aliases = {}) {
  const rms = {
    name: 'DOLO 250 SYRUP',
    manufacturer: 'Micro Labs Limited',
    pack_size: '60ML',
  };
  const result = matchProduct(rms, index, aliases);
  return {
    pass: result.confidence >= 95 && result.dr?.name?.toLowerCase().includes('dolo 250'),
    confidence: result.confidence,
    matchedTo: result.dr?.name,
    method: result.method,
    status: result.status,
  };
}
