/**
 * Export a website-ready CSV (no SYNC_API_KEY needed).
 * Merge ProductList.csv + matched_products.xlsx → import via Admin → Products → Import.
 *
 * Usage:
 *   npm run export:website-import
 *   npm run export:website-import -- --matched-only
 */
import 'dotenv/config';
import ExcelJS from 'exceljs';
import { createWriteStream, existsSync } from 'fs';
import { resolve } from 'path';
import { streamProductList } from '../reader/rawReader.js';
import { RMS_COLUMN_MAP } from '../reader/columnMaps.js';
import { output, files } from '../config/index.js';
import logger from '../logger/index.js';

const MATCHED_FILE = resolve(`${output.dir}/matched_products.xlsx`);
const OUT_FILE = resolve(`${output.dir}/website_import_ready.csv`);
const RMS_FILE = resolve(files.rms || '../data/ProductList.csv');
const MATCHED_ONLY = process.argv.includes('--matched-only');

function cellStr(v) {
  if (v == null) return '';
  if (typeof v === 'object' && v.text) return String(v.text).trim();
  return String(v).trim();
}

function csvEscape(val) {
  const s = val == null ? '' : String(val);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function firstImageUrl(raw) {
  const s = cellStr(raw);
  if (!s) return '';
  const first = s.split(/\s*\|\s*/)[0];
  return first.startsWith('http') ? first : '';
}

async function loadMatchedByRmsId() {
  if (!existsSync(MATCHED_FILE)) {
    throw new Error(`Matched file not found: ${MATCHED_FILE}`);
  }
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(MATCHED_FILE);
  const ws = wb.worksheets[0];
  const cols = {};
  ws.getRow(1).eachCell((c, i) => { cols[String(c.value).trim()] = i; });

  const map = new Map();
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const rmsId = cellStr(row.getCell(cols['RMS ID']).value);
    const key = rmsId || cellStr(row.getCell(cols['RMS Product Name']).value).toLowerCase();
    map.set(key, {
      rms_id: rmsId,
      name: cellStr(row.getCell(cols['RMS Product Name']).value),
      brand: cellStr(row.getCell(cols['RMS Manufacturer']).value),
      packSize: cellStr(row.getCell(cols['RMS Pack Size']).value),
      mrp: Number(row.getCell(cols['RMS MRP']).value) || 0,
      description: cellStr(row.getCell(cols.Description).value),
      composition: cellStr(row.getCell(cols.Composition).value),
      prescription: /required|yes|true/i.test(cellStr(row.getCell(cols['Prescription Required']).value)),
      imageUrl: firstImageUrl(row.getCell(cols['Image URLs']).value),
      drProductId: cellStr(row.getCell(cols['DR Product ID']).value),
      confidence: row.getCell(cols['Confidence %']).value,
    });
  }
  return map;
}

async function loadRmsCatalog() {
  const products = [];
  await streamProductList(RMS_FILE, RMS_COLUMN_MAP, async ({ mapped, rowNum }) => {
    if (!mapped.name) return;
    products.push({
      id: rowNum,
      rms_id: mapped.rms_id || String(mapped.rms_id || ''),
      name: mapped.name,
      manufacturer: mapped.manufacturer || '',
      pack_size: mapped.pack_size || '',
      mrp: parseFloat(mapped.mrp) || 0,
      stock: parseInt(mapped.stock, 10) || 0,
      category: mapped.category || '',
    });
  });
  return products;
}

const CAT_MAP = {
  allopathy: 'allopathic-medicines',
  ayurvedic: 'ayurvedic-medicines',
  surgicals: 'surgical-products',
  homeopathy: 'homeopathic-medicines',
  babycare: 'baby-care-products',
  nutrition: 'nutrition-supplements',
  fmcg: 'fmcg-products',
  generic: 'generic',
};

function mapCategory(raw) {
  const k = String(raw || '').toLowerCase().trim();
  return CAT_MAP[k] || 'allopathic-medicines';
}

async function run() {
  logger.info('Loading matched products…', { file: MATCHED_FILE });
  const matchedMap = await loadMatchedByRmsId();

  logger.info('Loading RMS catalog…', { file: RMS_FILE });
  const rmsProducts = await loadRmsCatalog();

  const headers = [
    'name', 'brand', 'category', 'subcategory', 'price', 'mrp', 'stock',
    'packSize', 'description', 'prescription', 'imageUrl', 'externalId',
  ];

  const out = createWriteStream(OUT_FILE, { encoding: 'utf8' });
  out.write(`${headers.join(',')}\n`);

  let exported = 0;
  let withImages = 0;

  for (const rms of rmsProducts) {
    const key = rms.rms_id ? String(rms.rms_id).trim() : '';
    const match = (key && matchedMap.get(key))
      || matchedMap.get(rms.name.toLowerCase())
      || null;

    if (MATCHED_ONLY && !match) continue;

    const mrp = rms.mrp || match?.mrp || 0;
    const price = mrp || 0;
    const imageUrl = match?.imageUrl || '';
    if (imageUrl) withImages++;

    const row = {
      name: rms.name,
      brand: match?.brand || rms.manufacturer || 'Generic',
      category: mapCategory(rms.category),
      subcategory: '',
      price,
      mrp,
      stock: rms.stock,
      packSize: match?.packSize || rms.pack_size,
      description: match?.description || '',
      prescription: match?.prescription ? 'true' : 'false',
      imageUrl,
      externalId: key || rms.rms_id || '',
    };

    out.write(`${headers.map(h => csvEscape(row[h])).join(',')}\n`);
    exported++;
  }

  await new Promise((res, rej) => { out.end(); out.on('finish', res); out.on('error', rej); });

  console.log('\n=== WEBSITE IMPORT CSV (no API key needed) ===');
  console.log(`Exported:        ${exported} products`);
  console.log(`With image URL:  ${withImages}`);
  console.log(`Output file:     ${OUT_FILE}`);
  console.log('\nNext steps:');
  console.log('  1. Open your website → Admin → Products → Import');
  console.log('  2. Upload website_import_ready.csv');
  console.log('  3. Images load from the imageUrl column automatically');
  console.log('\nOptional: use --matched-only to export only matched rows (~20k)');
}

run().catch(err => {
  logger.error('Export failed', { err: err.message });
  process.exit(1);
});
