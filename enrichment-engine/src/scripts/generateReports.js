/**
 * generateReports.js
 * Export Excel reports from MySQL (RMS + product_enrichment).
 * Validates: matched + review + unmatched = total RMS products.
 */
import 'dotenv/config';
import { mkdirSync } from 'fs';
import { query, closePool } from '../db/pool.js';
import {
  writeEnrichedProductsReport,
  writeMatchedReport,
  writeReviewReport,
  writeUnmatchedReport,
  writeDebugReport,
} from '../reporter/excelWriter.js';
import { validateProductCounts } from '../utils/validate.js';
import { countProducts } from '../db/enrichmentStore.js';
import { output } from '../config/index.js';
import logger from '../logger/index.js';

function toMatchResult(row) {
  const status = row.review_status === 'auto_matched'
    ? 'auto_matched'
    : row.review_status === 'review_required'
      ? 'review_required'
      : 'rejected';

  return {
    rms: {
      id: row.product_id,
      rms_id: row.rms_id,
      name: row.product_name,
      manufacturer: row.manufacturer,
      pack_size: row.pack_size,
      barcode: row.barcode,
      mrp: row.mrp,
      stock: row.stock,
    },
    dr: row.matched_database_id ? {
      id: row.matched_database_id,
      name: row.matched_product_name,
      composition: row.composition,
      description: row.description,
      category: row.category,
      prescription_required: row.prescription_required,
    } : null,
    confidence: Number(row.confidence_score) || 0,
    method: row.match_method,
    status,
    reason: status === 'rejected' ? 'No match above threshold' : undefined,
    image_urls: [row.cloudinary_url || row.image_url].filter(Boolean),
    cloudinary_url: row.cloudinary_url,
  };
}

async function run() {
  mkdirSync(output.dir, { recursive: true });

  const rows = await query(`
    SELECT
      p.id AS product_id,
      p.rms_id,
      p.name AS product_name,
      p.manufacturer,
      p.pack_size,
      p.barcode,
      p.mrp,
      p.stock,
      pe.composition,
      pe.prescription_required,
      pe.description,
      pe.category,
      pe.image_url,
      pe.cloudinary_url,
      pe.confidence_score,
      pe.matched_product_name,
      pe.matched_database_id,
      pe.match_method,
      pe.review_status
    FROM products p
    LEFT JOIN product_enrichment pe ON pe.product_id = p.id
    ORDER BY p.id
  `);

  const total = await countProducts();
  const matched = [], review = [], unmatched = [];
  const headers = ['Product Code', 'Product Name', 'Manufacturer', 'Pack Size', 'MRP', 'Stock', 'Barcode'];
  const entries = [];

  for (const row of rows) {
    const result = toMatchResult({
      ...row,
      review_status: row.review_status || 'rejected',
      confidence_score: row.confidence_score ?? 0,
    });

    if (result.status === 'auto_matched') matched.push(result);
    else if (result.status === 'review_required') review.push(result);
    else unmatched.push(result);

    entries.push({
      raw: {
        'Product Code': row.rms_id,
        'Product Name': row.product_name,
        Manufacturer: row.manufacturer,
        'Pack Size': row.pack_size,
        MRP: row.mrp,
        Stock: row.stock,
        Barcode: row.barcode,
      },
      headers,
      result: {
        ...result,
        cloudinary_url: row.cloudinary_url,
      },
    });
  }

  const validation = validateProductCounts({
    matched: matched.length,
    review: review.length,
    unmatched: unmatched.length,
    total,
  });

  logger.info(validation.message);
  if (!validation.ok) {
    throw new Error(validation.message);
  }

  const stats = {
    total,
    matched: matched.length,
    review: review.length,
    unmatched: unmatched.length,
    match_rate: `${((matched.length / total) * 100).toFixed(1)}%`,
  };

  await Promise.all([
    writeEnrichedProductsReport(entries, `${output.dir}/enriched_products.xlsx`),
    writeMatchedReport(matched, `${output.dir}/matched_products.xlsx`),
    writeReviewReport(review, `${output.dir}/review_required.xlsx`),
    writeUnmatchedReport(unmatched, `${output.dir}/unmatched_products.xlsx`),
    writeDebugReport({ stats, matched, review, unmatched }, `${output.dir}/matching_debug_report.xlsx`),
  ]);

  console.log('\n=== REPORTS GENERATED ===');
  console.log(`Total:     ${total}`);
  console.log(`Matched:   ${matched.length}`);
  console.log(`Review:    ${review.length}`);
  console.log(`Unmatched: ${unmatched.length}`);
  console.log(`Validation: ${validation.ok ? 'PASSED ✓' : 'FAILED ✗'}`);
  console.log(`Output:    ${output.dir}/`);
}

run()
  .catch(err => {
    logger.error('Report generation failed', { err: err.message });
    process.exit(1);
  })
  .finally(() => closePool());
