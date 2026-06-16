import { normalizeName, normalizePackSize, normalizeManufacturer } from '../normalizer/index.js';
import { formSynonyms } from '../config/index.js';

const STRENGTH_WITH_UNIT_RE = /\b(\d+(?:\.\d+)?)\s*(mg|mcg|g|gm|iu|%)\b/i;
const STRENGTH_STANDALONE_RE = /\b(\d{2,4})\b(?!\s*(?:ml|l)\b)/;
const COMPOUND_STRENGTH_RE = /\b(\d+(?:\.\d+)?)\s*mg\s*\/\s*(\d+(?:\.\d+)?)\s*ml\b/i;

const NOISE_WORDS = new Set([
  'strip', 'strips', 'bottle', 'pet', 'pcs', 'pc', 'piece', 'pieces', 'of', 'new',
  'pack', 'combo', 'duo', 'forte', 'plus', 'extra', 'super', 'original', 'classic',
  'premium', 'regular', 'refill', 'tube', 'jar', 'box', 'unit', 'units', 'each',
  'approx', 'approximate', 'approx.', 'approximate.', 'approximate', 'approximate',
  'skin', 'oral', 'topical', 'external', 'internal', 'use', 'only', 'for', 'the',
  'with', 'and', 'or', 'oa', 'v6', 'v', 'ee', 'e', 'n', 'm', 's', 'b', 'l', 'h',
  'gm', 'gms', 'ml', 'mg', 'mcg', 'iu', 'tab', 'tabs', 'cap', 'caps',
  'ayurvedic', 'medicine', 'healthy', 'gums', 'teeth', 'hair', 'care', 'pure',
  'virgin', 'natural', 'enriched', 'nourish', 'nourished', 'soft', 'regular',
  'saunf', 'dalchini', 'sugar', 'free',
]);

/** Strip zz/zzz prefix glued to a word (zzliv → liv, zzzliv → liv) */
function stripZzTokenPrefix(s) {
  return s.replace(/\b(z{2,})([a-z0-9][a-z0-9]*)/gi, '$2');
}

/** Remove leading manufacturer tokens echoed in DR/OTC titles (Himalaya Gasex → Gasex) */
export function stripManufacturerPrefix(cleanName, manufacturer, aliases = {}) {
  if (!cleanName || !manufacturer) return cleanName || '';
  const normMfg = normalizeManufacturer(manufacturer, aliases);
  if (!normMfg) return cleanName;

  let tokens = normalizeName(cleanName).split(/\s+/).filter(Boolean);
  const mfgTokens = new Set(normMfg.split(/\s+/).filter(t => t.length >= 2));

  while (tokens.length) {
    const t = tokens[0];
    if (mfgTokens.has(t) || t === normMfg.split(/\s+/)[0]) {
      tokens.shift();
      continue;
    }
    break;
  }

  return tokens.join(' ') || cleanName;
}

/** Strip bracket tags, zzz prefixes, and common noise from raw names */
export function stripNameNoise(raw) {
  if (!raw) return '';
  let s = String(raw);
  s = s.replace(/\[[^\]]*\]/g, ' ');
  s = s.replace(/\|/g, ' ');
  s = stripZzTokenPrefix(s);
  s = s.replace(/^z+/i, '');
  s = s.replace(/\b(strip|bottle|pet)\s+of\b/gi, ' ');
  return s.replace(/\s+/g, ' ').trim();
}

/** Pull pack/volume from product name when RMS packing column is empty (e.g. PASTE 50GM) */
export function extractPackFromName(rawName) {
  if (!rawName) return '';
  const s = normalizeName(stripNameNoise(rawName));
  const vol = s.match(/\b(\d+(?:\.\d+)?)\s*(ml|l|gm|g|kg)\b/);
  if (vol) return normalizePackSize(`${vol[1]} ${vol[2]}`);
  return '';
}

/** Remove noise tokens for core token matching */
export function extractCoreTokens(rawName, manufacturer = '', aliases = {}) {
  const stripped = stripNameNoise(rawName);
  const withoutMfg = stripManufacturerPrefix(stripped, manufacturer, aliases);
  const s = normalizeName(withoutMfg);
  return s.split(/\s+/).filter(t => {
    if (t.length < 2) return false;
    if (NOISE_WORDS.has(t)) return false;
    if (/^\d+$/.test(t) && t.length < 2) return false;
    return true;
  });
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

let sortedFormKeys = null;

function getSortedFormKeys() {
  if (!sortedFormKeys) {
    sortedFormKeys = Object.keys(formSynonyms).sort((a, b) => b.length - a.length);
  }
  return sortedFormKeys;
}

function isFormToken(token) {
  const lower = token.toLowerCase();
  return Object.prototype.hasOwnProperty.call(formSynonyms, lower);
}

/** Extract canonical dosage form from product name */
export function extractForm(rawName) {
  if (!rawName) return '';
  const s = normalizeName(rawName);
  for (const key of getSortedFormKeys()) {
    const re = new RegExp(`\\b${escapeRegex(key)}\\b`, 'i');
    if (re.test(s)) return formSynonyms[key];
  }
  return '';
}

/** Extract primary strength token e.g. 250, 500 mg, 250 mg 5 ml */
export function extractStrength(rawName) {
  if (!rawName) return '';
  const s = normalizeName(rawName);

  const compound = s.match(COMPOUND_STRENGTH_RE);
  if (compound) return `${compound[1]} mg ${compound[2]} ml`;

  const withUnit = s.match(STRENGTH_WITH_UNIT_RE);
  if (withUnit) {
    const unit = withUnit[2].toLowerCase() === 'gm' ? 'g' : withUnit[2].toLowerCase();
    return `${withUnit[1]} ${unit}`;
  }

  const standalone = s.match(STRENGTH_STANDALONE_RE);
  if (standalone) return standalone[1];

  return '';
}

/** Extract product brand token(s) — includes numeric suffixes like "liv 52" */
export function extractBrand(rawName, manufacturer = '', aliases = {}) {
  if (!rawName) return '';
  const stripped = stripNameNoise(rawName);
  const withoutMfg = stripManufacturerPrefix(stripped, manufacturer, aliases);
  const s = normalizeName(withoutMfg);
  const tokens = s.split(/\s+/).filter(Boolean);
  const brandParts = [];

  for (const tok of tokens) {
    if (isFormToken(tok)) break;
    if (NOISE_WORDS.has(tok)) continue;
    if (/^(mg|mcg|g|ml|iu|%)$/.test(tok)) break;
    if (/^\d+(?:\.\d+)?$/.test(tok)) {
      if (brandParts.length) {
        brandParts.push(tok);
        break;
      }
      continue;
    }
    brandParts.push(tok);
    if (brandParts.length >= 2) break;
  }

  if (brandParts.length) return brandParts.join(' ');
  for (const tok of tokens) {
    if (/^\d/.test(tok)) continue;
    if (isFormToken(tok)) continue;
    return tok;
  }
  return tokens[0] || '';
}

/**
 * Parse a product into structured fields for matching.
 * @returns {{ brand, strength, form, packSize, rawName, normalizedName, manufacturer }}
 */
export function parseProduct(product, aliases = {}) {
  const rawName = product.name || '';
  const manufacturer = normalizeManufacturer(product.manufacturer, aliases);
  const cleanName = stripNameNoise(rawName);
  const matchName = stripManufacturerPrefix(cleanName, product.manufacturer, aliases);
  const packSize = normalizePackSize(product.pack_size) || extractPackFromName(rawName);
  const normalizedName = normalizeName(matchName);
  const coreTokens = extractCoreTokens(rawName, product.manufacturer, aliases);

  return {
    brand: extractBrand(rawName, product.manufacturer, aliases),
    strength: extractStrength(matchName),
    form: extractForm(matchName),
    packSize,
    rawName,
    normalizedName,
    coreTokens,
    coreTokenKey: coreTokens.join(' '),
    manufacturer,
  };
}

/** Build structural match key: brand|strength|form|pack */
export function buildStructuralKey(parsed) {
  return [parsed.brand, parsed.strength, parsed.form, parsed.packSize].join('|');
}

/** Build relaxed structural key without pack (for liquid/count mismatches) */
export function buildRelaxedKey(parsed) {
  return [parsed.brand, parsed.strength, parsed.form].join('|');
}

/** Brand + strength only — pass 3 ignores form/pack */
export function buildNameStrengthKey(parsed) {
  return [parsed.brand, parsed.strength].join('|');
}

function tokenSet(tokens) {
  return new Set((tokens || []).filter(t => t && t.length > 1));
}

/** Token-set Jaccard similarity 0–1 */
export function nameTokenSimilarity(a, b) {
  const ta = tokenSet(typeof a === 'string' ? a.split(/\s+/) : a);
  const tb = tokenSet(typeof b === 'string' ? b.split(/\s+/) : b);
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  const union = new Set([...ta, ...tb]).size;
  return union ? inter / union : 0;
}

/** Core-token Jaccard — strips noise words before compare */
export function coreTokenSimilarity(parsedA, parsedB) {
  return nameTokenSimilarity(parsedA.coreTokens || [], parsedB.coreTokens || []);
}
