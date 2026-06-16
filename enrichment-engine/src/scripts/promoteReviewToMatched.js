/**
 * Promote all review_required rows into matched_products.
 * Uses enriched_products.xlsx (has DR match data) + ProductList.csv (RMS identity).
 * Row order in enriched_products matches ProductList stream order.
 */
import 'dotenv/config';
import ExcelJS from 'exceljs';
import { resolve } from 'path';
import { streamProductList } from '../reader/rawReader.js';
import { RMS_COLUMN_MAP } from '../reader/columnMaps.js';
import {
  writeMatchedReport,
  writeReviewReport,
} from '../reporter/excelWriter.js';
import { output, files } from '../config/index.js';
import logger from '../logger/index.js';

const OUT = output.dir;
const ENRICHED = resolve(`${OUT}/enriched_products.xlsx`);
const MATCHED = resolve(`${OUT}/matched_products.xlsx`);
const REVIEW = resolve(`${OUT}/review_required.xlsx`);
const RMS_FILE = resolve(files.rms || '../data/ProductList.csv');

function cellStr(v) {
  if (v == null) return '';
  if (typeof v === 'object' && v.text) return String(v.text);
  return String(v).trim();
}

function parseUrls(primary, additional) {
  const urls = [];
  const p = cellStr(primary);
  if (p.startsWith('http')) urls.push(p);
  const extra = cellStr(additional);
  if (extra) {
    for (const u of extra.split(/\s*\|\s*/)) {
      if (u.startsWith('http')) urls.push(u);
    }
  }
  return urls;
}

async function loadEnrichedRows() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(ENRICHED);
  const ws = wb.worksheets[0];
  const cols = {};
  ws.getRow(1).eachCell((c, i) => { cols[c.value] = i; });

  const rows = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    rows.push({
      status: cellStr(row.getCell(cols['Match Status']).value),
      drName: cellStr(row.getCell(cols['Matched Database Product']).value),
      drProductId: cellStr(row.getCell(cols['DR Product ID']).value),
      confidence: Number(row.getCell(cols['Match Confidence %']).value) || 0,
      method: cellStr(row.getCell(cols['Match Method']).value),
      composition: cellStr(row.getCell(cols.Composition).value),
      prescription_required: cellStr(row.getCell(cols['Prescription Required']).value),
      description: cellStr(row.getCell(cols.Description).value),
      category: cellStr(row.getCell(cols['Enriched Category']).value),
      image_status: cellStr(row.getCell(cols['Image Status']).value),
      image_urls: parseUrls(
        row.getCell(cols['Primary Image URL']).value,
        row.getCell(cols['Additional Image URLs']).value
      ),
    });
  }
  return rows;
}

async function loadRmsCatalog() {
  const products = [];
  await streamProductList(RMS_FILE, RMS_COLUMN_MAP, async ({ mapped, rowNum }) => {
    if (!mapped.name) return;
    products.push({
      id: rowNum,
      rms_id: mapped.rms_id || null,
      name: mapped.name,
      manufacturer: mapped.manufacturer || '',
      pack_size: mapped.pack_size || '',
      mrp: parseFloat(mapped.mrp) || null,
      barcode: mapped.barcode || null,
      stock: parseInt(mapped.stock, 10) || 0,
      category: mapped.category || null,
    });
  });
  return products;
}

function toMatchResult(rms, enrich, promoted = false) {
  const dr = {
    name: enrich.drName,
    manufacturer: '',
    pack_size: '',
    barcode: enrich.drProductId,
    composition: enrich.composition,
    prescription_required: enrich.prescription_required,
    description: enrich.description,
    category: enrich.category,
  };
  return {
    rms,
    dr,
    confidence: enrich.confidence,
    method: promoted ? `${enrich.method || 'review'}_promoted` : enrich.method,
    status: 'auto_matched',
    dr_product_id: enrich.drProductId,
    image_status: enrich.image_status,
    image_urls: enrich.image_urls,
    lowConfidence: promoted,
    lowConfidenceFlags: promoted ? ['promoted_from_review'] : [],
  };
}

async function run() {
  logger.info('Loading enriched products…', { file: ENRICHED });
  const enriched = await loadEnrichedRows();

  logger.info('Loading RMS catalog…', { file: RMS_FILE });
  const rmsProducts = await loadRmsCatalog();

  if (enriched.length !== rmsProducts.length) {
    throw new Error(
      `Row count mismatch: enriched=${enriched.length} RMS=${rmsProducts.length}. Cannot align by row order.`
    );
  }

  const matched = [];
  const review = [];
  let promoted = 0;

  for (let i = 0; i < enriched.length; i++) {
    const e = enriched[i];
    const rms = rmsProducts[i];

    if (e.status === 'Review Required' && e.drProductId) {
      const result = toMatchResult(rms, e, true);
      matched.push(result);
      promoted++;
    } else if (e.status === 'Matched' && e.drProductId) {
      matched.push(toMatchResult(rms, e, false));
    } else if (e.status === 'Review Required') {
      review.push({ rms, dr: null, confidence: e.confidence, method: e.method, status: 'review_required', suggestions: [] });
    }
  }

  logger.info('Writing reports…', { matched: matched.length, promoted, reviewRemaining: review.length });

  await writeMatchedReport(matched, MATCHED);
  await writeReviewReport(review, REVIEW);

  // Update enriched_products in place — flip Review Required → Matched
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(ENRICHED);
  const ws = wb.worksheets[0];
  const statusCol = 1;
  let flipped = 0;
  for (let r = 2; r <= ws.rowCount; r++) {
    const cell = ws.getRow(r).getCell(statusCol);
    if (cell.value === 'Review Required') {
      const drId = cellStr(ws.getRow(r).getCell(3).value);
      if (drId) {
        cell.value = 'Matched';
        flipped++;
      }
    }
  }
  await wb.xlsx.writeFile(ENRICHED);
  logger.info(`Updated enriched status column: ${flipped} rows → Matched`);

  console.log('\n=== REVIEW → MATCHED PROMOTION ===');
  console.log(`Promoted from review:  ${promoted}`);
  console.log(`Total matched now:     ${matched.length} (${((matched.length / rmsProducts.length) * 100).toFixed(1)}%)`);
  console.log(`Review remaining:      ${review.length}`);
  console.log(`\nUpdated:`);
  console.log(`  ${MATCHED}`);
  console.log(`  ${REVIEW}`);
  console.log(`  ${ENRICHED}`);
}

run().catch(err => {
  logger.error('Promotion failed', { err: err.message, stack: err.stack });
  process.exit(1);
});
