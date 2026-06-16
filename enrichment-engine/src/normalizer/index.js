import { brandAliases as defaultAliases, formSynonyms } from '../config/index.js';
import { query } from '../db/pool.js';

let dbAliasCache = null;
let cacheTs = 0;
const CACHE_TTL = 60_000;

async function getAliases() {
  const now = Date.now();
  if (dbAliasCache && now - cacheTs < CACHE_TTL) return dbAliasCache;
  try {
    const rows = await query('SELECT alias, brand FROM brand_aliases');
    dbAliasCache = { ...defaultAliases };
    for (const r of rows) dbAliasCache[r.alias.toLowerCase()] = r.brand.toLowerCase();
    cacheTs = now;
    return dbAliasCache;
  } catch {
    return defaultAliases;
  }
}

const DOSAGE_RE = /(\d+(?:\.\d+)?)\s*(mg|mcg|g|gm|ml|l|iu|%|units?)(?:\s*\/\s*(\d+(?:\.\d+)?)\s*(mg|mcg|ml|l))?/gi;
const PACK_RE = /(\d+)\s*(?:'s|'s|s\b)/gi;
const STRIP_RE = /strip\s+of\s+(\d+)/gi;

function unitNorm(u) {
  const x = u.toLowerCase();
  if (x === 'gm' || x === 'gms') return 'g';
  return x;
}

/** Normalize dosage: 500mg→500 mg, 250mg/5ml→250 mg 5 ml, 10ml→10 ml */
function normalizeDosage(str) {
  return str.replace(DOSAGE_RE, (_, n1, u1, n2, u2) => {
    let out = `${n1} ${unitNorm(u1)}`;
    if (n2 && u2) out += ` ${n2} ${unitNorm(u2)}`;
    return out;
  });
}

/** Normalize pack size: counts, volumes, strip sizes */
export function normalizePackSize(str) {
  if (!str) return '';
  let s = String(str).toLowerCase().trim();
  s = s.replace(STRIP_RE, '$1');
  s = s.replace(PACK_RE, '$1');

  const vol = s.match(/(\d+(?:\.\d+)?)\s*(ml|l|gm|g|kg)\b/);
  if (vol) return `${vol[1]} ${unitNorm(vol[2])}`;

  const m = s.match(/(\d+)/);
  return m ? m[1] : s.replace(/\s+/g, ' ').trim();
}

/** Compare two pack sizes — exact or numeric match when one side is count-only */
export function packSizesMatch(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  const na = a.match(/^(\d+(?:\.\d+)?)/);
  const nb = b.match(/^(\d+(?:\.\d+)?)/);
  if (na && nb && na[1] === nb[1]) return true;
  return false;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function applyFormSynonyms(s) {
  const keys = Object.keys(formSynonyms).sort((a, b) => b.length - a.length);
  for (const pattern of keys) {
    const canonical = formSynonyms[pattern];
    if (pattern !== canonical) {
      const covered = keys.some(
        k => k.length > pattern.length && k.includes(pattern) &&
          new RegExp(`\\b${escapeRegex(k)}\\b`).test(s)
      );
      if (covered) continue;
    }
    const re = new RegExp(`\\b${escapeRegex(pattern)}\\b`, 'g');
    s = s.replace(re, canonical);
  }
  return s;
}

/** Full product name normalization pipeline */
export function normalizeName(raw) {
  if (!raw) return '';
  let s = String(raw).toLowerCase();
  s = s.replace(/[^a-z0-9\s\-\/\.%]/g, ' ');
  s = s.replace(/\b(\d+)\s*%\s*/g, ' ');
  s = s.replace(/([a-z]+)\.(\d+)/g, '$1 $2');
  s = normalizeDosage(s);
  s = applyFormSynonyms(s);
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

const TRAILING_SUFFIX_RE = /\s+(?:pvt\.?|ltd\.?|limited|private|pharmaceuticals|pharma|laboratories|laboratries|healthcare|india|care|consumer|enterprises|company|co\.?)\s*$/i;

function stripCompanySuffix(s) {
  let prev;
  do {
    prev = s;
    s = s.replace(TRAILING_SUFFIX_RE, '').trim();
  } while (s !== prev);
  return s.replace(/\s+/g, ' ').trim();
}

function resolveAlias(s, aliases) {
  if (aliases[s]) return aliases[s];
  const first = s.split(' ')[0];
  if (aliases[first]) return aliases[first];
  for (const word of s.split(' ')) {
    if (aliases[word]) return aliases[word];
  }
  return null;
}

/** Normalize a brand/manufacturer name with alias expansion */
export async function normalizeBrand(raw) {
  if (!raw) return '';
  const aliases = await getAliases();
  return normalizeManufacturer(raw, aliases);
}

/** Synchronous manufacturer normalize (in-memory aliases only) */
export function normalizeBrandSync(raw, aliases = defaultAliases) {
  return normalizeManufacturer(raw, aliases);
}

/** Canonical manufacturer string with alias expansion and suffix stripping */
export function normalizeManufacturer(raw, aliases = defaultAliases) {
  if (!raw) return '';
  let s = String(raw).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

  const aliased = resolveAlias(s, aliases);
  if (aliased) return aliased;

  s = stripCompanySuffix(s);
  const aliased2 = resolveAlias(s, aliases);
  if (aliased2) return aliased2;

  return s;
}

/** Whether two manufacturer strings refer to the same company */
export function manufacturersMatch(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  const ta = a.split(/\s+/).filter(w => w.length > 2);
  const tb = b.split(/\s+/).filter(w => w.length > 2);
  if (!ta.length || !tb.length) return false;
  return ta[0] === tb[0] || a.includes(tb[0]) || b.includes(ta[0]);
}

/** Build a composite key for exact matching: brand|name|packsize */
export function buildMatchKey(brand, name, packSize) {
  return `${brand}|${normalizeName(name)}|${normalizePackSize(packSize)}`;
}

export function invalidateAliasCache() {
  dbAliasCache = null;
  cacheTs = 0;
}
