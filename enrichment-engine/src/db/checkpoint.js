/**
 * checkpoint.js — Resume support (req #24)
 * Saves and restores processing position so interrupted jobs
 * resume from the last successful point rather than restarting.
 */
import { query } from './pool.js';
import logger from '../logger/index.js';

/**
 * Load a checkpoint. Returns { lastOffset, lastId, processedCount } or null.
 */
export async function loadCheckpoint(jobId) {
  try {
    const rows = await query(
      `SELECT last_offset, last_id, processed_count FROM job_checkpoints WHERE job_id = ?`,
      [jobId]
    );
    if (!rows.length) return null;
    const r = rows[0];
    logger.info(`Resuming job ${jobId} from offset ${r.last_offset} (${r.processed_count} already done)`);
    return {
      lastOffset:     r.last_offset,
      lastId:         r.last_id,
      processedCount: r.processed_count,
    };
  } catch {
    return null;
  }
}

/**
 * Save a checkpoint after each batch.
 */
export async function saveCheckpoint(jobId, jobType, lastOffset, lastId, processedCount) {
  try {
    await query(
      `INSERT INTO job_checkpoints (job_id, job_type, last_offset, last_id, processed_count)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         last_offset = VALUES(last_offset),
         last_id = VALUES(last_id),
         processed_count = VALUES(processed_count),
         updated_at = NOW()`,
      [jobId, jobType, lastOffset, lastId, processedCount]
    );
  } catch (err) {
    logger.warn('Checkpoint save failed (non-fatal)', { jobId, err: err.message });
  }
}

/**
 * Clear a checkpoint after successful completion.
 */
export async function clearCheckpoint(jobId) {
  await query(`DELETE FROM job_checkpoints WHERE job_id = ?`, [jobId]).catch(() => {});
}
