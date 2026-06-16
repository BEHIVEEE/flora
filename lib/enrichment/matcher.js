import Fuse from 'fuse.js';

// Stop words regex - matches whole words only
const STOP_WORDS_REGEX = /\b(tablets?|tabs?|capsules?|caps?|syrups?|syr|injections?|inj|suspensions?|susp|solutions?|soln|ointments?|oint|creams?|crm|gel|spray|drops?|powders?|pwd|lotion|liquid|suspension|mouthwash|soap|shampoo|softgel|sachet|strip|pack|bottle|tube|jar|box)\b/gi;

// Brand aliases dictionary (standardizes common abbreviations)
const BRAND_ALIASES = {
  'mml': 'minimalist',
  'me': 'mamaearth',
  'h': 'himalaya',
  'him': 'himalaya',
  'hm': 'himalaya',
  'pat': 'patanjali',
  'gl': 'glenmark',
  'cip': 'cipla',
  'ab': 'abbott',
  'org': 'organon',
};

/**
 * Normalizes product names: converts to lowercase, removes stop words, strips accents, removes extra spaces.
 * @param {string} text 
 * @returns {string}
 */
export function normalizeName(text) {
  if (!text || typeof text !== 'string') return '';
  
  // 1. Lowercase and remove accents/diacritics
  let normalized = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  // 2. Replace special characters with spaces (keep alphanumeric, space, %, +, /, .)
  normalized = normalized.replace(/[^\w\s%+/.\-]/gi, ' ');
  
  // 3. Remove stop words (tablets, tab, capsules, caps, etc.)
  normalized = normalized.replace(STOP_WORDS_REGEX, ' ');
  
  // 4. Collapse multiple spaces into one and trim
  return normalized.replace(/\s+/g, ' ').trim();
}

/**
 * Normalizes brand or manufacturer name and resolves aliases.
 * @param {string} brand 
 * @returns {string}
 */
export function normalizeBrand(brand) {
  if (!brand || typeof brand !== 'string') return 'generic';
  
  // Clean and lowercase
  let cleanBrand = brand.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
    
  // Check if brand matches an alias
  if (BRAND_ALIASES[cleanBrand]) {
    return BRAND_ALIASES[cleanBrand];
  }
  
  // Check multi-word match or prefixes (e.g. "him health" or "himalaya drug")
  const words = cleanBrand.split(' ');
  for (const word of words) {
    if (BRAND_ALIASES[word]) {
      return BRAND_ALIASES[word];
    }
  }
  
  // Remove common suffixes like pvt ltd, pharma, laboratories
  cleanBrand = cleanBrand
    .replace(/\b(pvt|ltd|limited|private|pharma|pharmaceuticals|labs|laboratories|healthcare|health|wellness)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
    
  return cleanBrand || 'generic';
}

/**
 * Extracts and normalizes pack size to clean numbers or units (e.g. "10 tabs" -> "10", "100ml" -> "100ml")
 * @param {string} packSize 
 * @returns {string}
 */
export function normalizePackSize(packSize) {
  if (!packSize) return '';
  const clean = String(packSize).toLowerCase().replace(/\s+/g, '').trim();
  
  // Try matching digits in pack (e.g., "pack of 10" or "10's" or "10 tabs")
  const digitMatch = clean.match(/(\d+)\s*(tabs|tablets|caps|capsules|strips?|sachets?|units?|pcs|pieces?)/);
  if (digitMatch) return digitMatch[1];
  
  const ofMatch = clean.match(/of(\d+)/);
  if (ofMatch) return ofMatch[1];
  
  const digitOnly = clean.match(/^\d+$/);
  if (digitOnly) return digitOnly[0];
  
  // Capture general sizes (e.g., "100ml", "50g")
  const volumeMatch = clean.match(/(\d+(?:\.\d+)?)\s*(ml|g|gm|kg|l|oz)/);
  if (volumeMatch) return `${volumeMatch[1]}${volumeMatch[2]}`;
  
  return clean;
}

/**
 * Extracts strength attributes from a product name.
 * @param {string} name 
 * @returns {string|null}
 */
export function extractStrength(name) {
  if (!name) return null;
  const match = name.match(/(\d+(?:\.\d+)?)\s*(mg|mcg|g|gm|kg|ml|l|iu|%)/i);
  if (match) {
    // Normalize units
    let unit = match[2].toLowerCase();
    if (unit === 'gm' || unit === 'gms') unit = 'g';
    return `${match[1]}${unit}`;
  }
  return null;
}

/**
 * Computes a confidence score and review status for a potential match.
 * @param {Object} source - Product from Prompt RMS (Dataset A)
 * @param {Object} target - Product from DataRequisite (Dataset B)
 * @param {boolean} isExact - Whether this was an exact match
 * @param {number} fuseScore - Fuse.js score (0.0 = perfect, 1.0 = mismatch)
 * @returns {Object} { confidence, reviewStatus, stage }
 */
export function computeMatchScore(source, target, isExact = false, fuseScore = 1.0) {
  let confidence = 0.0;
  let stage = 3; // Default fuzzy match stage

  if (isExact) {
    confidence = 100.0;
    stage = 2; // Exact structural match
    return {
      confidence,
      reviewStatus: 'auto_accept',
      stage,
    };
  }

  // Calculate fuzzy similarity from Fuse.js score (which ranges from 0.0 to 1.0)
  const nameFuzzyScore = (1 - fuseScore) * 100;
  confidence = nameFuzzyScore;

  // Resolve brands
  const srcBrand = normalizeBrand(source.manufacturer);
  const tgtBrand = normalizeBrand(target.manufacturer);
  
  // Apply brand logic
  if (srcBrand !== 'generic' && tgtBrand !== 'generic') {
    if (srcBrand === tgtBrand) {
      // Small boost for matching manufacturer
      confidence += 5;
    } else {
      // Heavily penalize brand mismatch
      confidence -= 20;
    }
  }

  // Apply pack size logic
  const srcPack = normalizePackSize(source.pack_size);
  const tgtPack = normalizePackSize(target.pack_size);
  if (srcPack && tgtPack) {
    if (srcPack === tgtPack) {
      confidence += 3;
    } else {
      confidence -= 10;
    }
  }

  // Pharmacy-specific rule: Penalize strength mismatch (e.g. 250mg vs 500mg)
  const srcStrength = extractStrength(source.product_name);
  const tgtStrength = extractStrength(target.product_name);
  if (srcStrength && tgtStrength && srcStrength !== tgtStrength) {
    confidence -= 15;
  }

  // Clamp confidence between 0 and 99 (cap non-exact matches at 99)
  confidence = Math.max(0, Math.min(99.0, Math.round(confidence * 100) / 100));

  // Determine review status based on user thresholds (90%+ auto-accept, 80-90% review, <80% reject)
  let reviewStatus = 'rejected';
  if (confidence >= 90.0) {
    reviewStatus = 'auto_accept';
  } else if (confidence >= 80.0) {
    reviewStatus = 'manual_review';
  }

  return {
    confidence,
    reviewStatus,
    stage,
  };
}

/**
 * Searches a list of candidates for the best fuzzy match for the source product.
 * @param {Object} source - The source product to match
 * @param {Array<Object>} candidates - The DataRequisite catalog candidates
 * @returns {Object|null} The best match details or null
 */
export function fuzzyMatchProduct(source, candidates) {
  if (!candidates || candidates.length === 0) return null;
  
  const srcNormName = normalizeName(source.product_name);
  if (!srcNormName) return null;
  
  // Index candidates with Fuse.js
  const fuse = new Fuse(candidates, {
    keys: ['normalized_name'],
    includeScore: true,
    threshold: 0.45, // 1 - 0.45 = 55% minimum similarity
  });
  
  const results = fuse.search(srcNormName);
  if (results.length === 0) return null;
  
  const bestResult = results[0];
  const matchedTarget = bestResult.item;
  const fuseScore = bestResult.score;
  
  const scoreResult = computeMatchScore(source, matchedTarget, false, fuseScore);
  
  return {
    ...scoreResult,
    catalog: matchedTarget,
  };
}
