import { query } from '../db/pool.js';
import { ALL_QUEUES } from '../queues/index.js';

export async function getStats() {
  const [
    productStats,
    matchStats,
    imageStats,
    queueStats,
  ] = await Promise.all([
    getProductStats(),
    getMatchStats(),
    getImageStats(),
    getQueueStats(),
  ]);

  return {
    timestamp: new Date().toISOString(),
    products: productStats,
    matching: matchStats,
    images: imageStats,
    queues: queueStats,
  };
}

async function getProductStats() {
  const [row] = await query(`
    SELECT
      COUNT(*) AS total,
      SUM(enriched = 1) AS enriched,
      SUM(enriched = 0) AS pending
    FROM products
  `);
  return {
    total:    Number(row.total) || 0,
    enriched: Number(row.enriched) || 0,
    pending:  Number(row.pending) || 0,
    enrichedPct: row.total > 0 ? ((row.enriched / row.total) * 100).toFixed(1) : '0',
  };
}

async function getMatchStats() {
  const rows = await query(`
    SELECT status, match_method, COUNT(*) AS cnt
    FROM match_audit
    GROUP BY status, match_method
  `);

  const result = {
    auto_matched: 0,
    review_required: 0,
    rejected: 0,
    accepted: 0,
    declined: 0,
    by_method: {},
  };

  for (const r of rows) {
    const cnt = Number(r.cnt);
    if (r.status in result) result[r.status] += cnt;
    if (!result.by_method[r.match_method]) result.by_method[r.match_method] = 0;
    result.by_method[r.match_method] += cnt;
  }

  const total = result.auto_matched + result.review_required + result.rejected;
  result.total = total;
  result.matchRate = total > 0 ? ((result.auto_matched / total) * 100).toFixed(1) : '0';
  return result;
}

async function getImageStats() {
  const [row] = await query(`
    SELECT
      COUNT(*) AS total,
      SUM(status = 'pending')    AS pending,
      SUM(status = 'downloaded') AS downloaded,
      SUM(status = 'uploaded')   AS uploaded,
      SUM(status = 'failed')     AS failed
    FROM product_images
  `);
  return {
    total:      Number(row.total) || 0,
    pending:    Number(row.pending) || 0,
    downloaded: Number(row.downloaded) || 0,
    uploaded:   Number(row.uploaded) || 0,
    failed:     Number(row.failed) || 0,
    uploadedPct: row.total > 0 ? ((row.uploaded / row.total) * 100).toFixed(1) : '0',
  };
}

async function getQueueStats() {
  const stats = {};
  for (const q of ALL_QUEUES) {
    const counts = await q.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed');
    stats[q.name] = counts;
  }
  return stats;
}
