/**
 * aliasLearner.js — Brand Alias Learning System (req #17)
 *
 * When fuzzy matches consistently pair a short alias (e.g. "him") with a full
 * brand (e.g. "himalaya") above a confidence threshold, the pattern is recorded
 * in brand_alias_suggestions for admin review.
 *
 * After approval via the dashboard, the alias moves into brand_aliases and
 * future matching uses it automatically.
 */
import { query, batchInsert } from '../db/pool.js';
import { matchLogger } from '../logger/index.js';

// In-memory accumulator: "alias|brand" → { count, totalConfidence, exampleRms, exampleDr }
const suggestionAccumulator = new Map();
const FLUSH_THRESHOLD = 100; // flush every N accumulated patterns
const MIN_DETECTIONS = 3;    // minimum times a pattern must appear before suggesting
const MIN_CONFIDENCE = 80;   // minimum avg confidence to be worth suggesting

/**
 * Record a fuzzy match that could represent an alias pattern.
 * Called per-match during the matching loop.
 */
export function recordFuzzyMatch(rmsManufacturer, drManufacturer, confidence, rmsName, drName) {
  if (!rmsManufacturer || !drManufacturer) return;

  const rmsAlias = rmsManufacturer.toLowerCase().trim();
  const drBrand  = drManufacturer.toLowerCase().trim();

  // Only learn when the two sides differ and RMS side looks like a short alias
  if (rmsAlias === drBrand) return;
  if (rmsAlias.length > 20) return; // too long to be an alias

  const key = `${rmsAlias}|||${drBrand}`;
  const existing = suggestionAccumulator.get(key) || {
    alias: rmsAlias,
    brand: drBrand,
    count: 0,
    totalConfidence: 0,
    exampleRms: rmsName,
    exampleDr: drName,
  };

  existing.count++;
  existing.totalConfidence += confidence;
  suggestionAccumulator.set(key, existing);
}

/**
 * Flush accumulated patterns to brand_alias_suggestions.
 * Call periodically during matching (e.g. every batch).
 */
export async function flushAliasSuggestions() {
  if (!suggestionAccumulator.size) return;

  const rows = [];
  for (const [, s] of suggestionAccumulator) {
    const avgConfidence = s.totalConfidence / s.count;
    if (s.count < MIN_DETECTIONS || avgConfidence < MIN_CONFIDENCE) continue;
    rows.push([
      s.alias,
      s.brand,
      s.count,
      Math.round(avgConfidence * 100) / 100,
      (s.exampleRms || '').slice(0, 500),
      (s.exampleDr  || '').slice(0, 500),
    ]);
  }

  if (!rows.length) return;

  // Upsert — increment detection count if pattern already exists
  const pool = await import('../db/pool.js');
  const conn = await (await import('../db/pool.js')).getPool().getConnection();
  try {
    for (const row of rows) {
      await conn.execute(
        `INSERT INTO brand_alias_suggestions 
           (alias, suggested_brand, detection_count, avg_confidence, example_rms, example_dr)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           detection_count = detection_count + VALUES(detection_count),
           avg_confidence  = (avg_confidence + VALUES(avg_confidence)) / 2,
           updated_at      = NOW()`,
        row
      );
    }
    matchLogger.info(`Flushed ${rows.length} alias suggestions`);
  } finally {
    conn.release();
    suggestionAccumulator.clear();
  }
}

/**
 * Promote approved suggestions into brand_aliases.
 * Called by the dashboard API when admin approves.
 */
export async function approveSuggestion(suggestionId, reviewer) {
  const rows = await query(
    `SELECT alias, suggested_brand FROM brand_alias_suggestions WHERE id = ? AND status = 'pending'`,
    [suggestionId]
  );
  if (!rows.length) throw new Error('Suggestion not found or already reviewed');

  const { alias, suggested_brand } = rows[0];

  await batchInsert(
    'brand_aliases',
    ['alias', 'brand', 'source'],
    [[alias, suggested_brand, 'learned']],
    { onDuplicateUpdate: ['brand', 'source'] }
  );

  await query(
    `UPDATE brand_alias_suggestions 
     SET status='approved', reviewed_by=?, reviewed_at=NOW() 
     WHERE id=?`,
    [reviewer, suggestionId]
  );

  // Invalidate cache so new alias takes effect immediately
  const { invalidateAliasCache } = await import('../normalizer/index.js');
  invalidateAliasCache();

  matchLogger.info(`Alias approved: ${alias} → ${suggested_brand}`, { reviewer });
  return { alias, brand: suggested_brand };
}

/**
 * Reject a suggestion.
 */
export async function rejectSuggestion(suggestionId, reviewer) {
  await query(
    `UPDATE brand_alias_suggestions 
     SET status='rejected', reviewed_by=?, reviewed_at=NOW() 
     WHERE id=?`,
    [reviewer, suggestionId]
  );
}
