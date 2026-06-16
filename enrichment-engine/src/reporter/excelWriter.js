import ExcelJS from 'exceljs';
import { mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import logger from '../logger/index.js';
import { formatImageUrls } from '../matcher/imageIndex.js';

function ensureDir(filePath) {
  mkdirSync(dirname(resolve(filePath)), { recursive: true });
}

/** Style helpers */
function headerStyle(ws, row) {
  row.eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E7D32' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = { bottom: { style: 'thin' } };
  });
  row.height = 22;
}

function confidenceColor(score) {
  if (score >= 99) return 'FF1B5E20';
  if (score >= 95) return 'FF2E7D32';
  if (score >= 85) return 'FFF9A825';
  return 'FFB71C1C';
}

/** Write enriched_products.xlsx — ALL catalog rows with enrichment columns appended */
export async function writeEnrichedProductsReport(entries, filePath) {
  ensureDir(filePath);
  if (!entries.length) {
    logger.warn('No entries for enriched products report');
    return;
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Enrichment Engine';
  const ws = wb.addWorksheet('Enriched Products');

  const originalHeaders = entries[0].headers || Object.keys(entries[0].raw || {});
  const enrichHeaders = [
    'Match Status',
    'Matched Database Product',
    'DR Product ID',
    'Match Confidence %',
    'Match Method',
    'Composition',
    'Prescription Required',
    'Description',
    'Enriched Category',
    'Image Status',
    'Primary Image URL',
    'Cloudinary URL',
    'Additional Image URLs',
    'Rejection Reason',
  ];

  ws.columns = [
    ...originalHeaders.map(h => ({ header: h, key: `raw_${h}`, width: Math.min(Math.max(h.length + 2, 12), 40) })),
    ...enrichHeaders.map(h => ({ header: h, key: h.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase(), width: h === 'Description' ? 50 : 24 })),
  ];

  // Fix column keys for enrich headers
  const enrichKeys = {
    'Match Status': 'match_status',
    'Matched Database Product': 'matched_db_product',
    'DR Product ID': 'dr_product_id',
    'Match Confidence %': 'match_confidence',
    'Match Method': 'match_method',
    'Composition': 'composition',
    'Prescription Required': 'prescription_required',
    'Description': 'description',
    'Enriched Category': 'enriched_category',
    'Image Status': 'image_status',
    'Primary Image URL': 'primary_image_url',
    'Cloudinary URL': 'cloudinary_url',
    'Additional Image URLs': 'additional_image_urls',
    'Rejection Reason': 'rejection_reason',
  };

  ws.columns = [
    ...originalHeaders.map(h => ({ header: h, key: `raw_${sanitizeKey(h)}`, width: Math.min(Math.max(h.length + 2, 12), 40) })),
    ...enrichHeaders.map(h => ({ header: h, key: enrichKeys[h], width: h === 'Description' ? 50 : 24 })),
  ];

  headerStyle(ws, ws.getRow(1));

  for (const entry of entries) {
    const r = entry.result;
    const dr = r?.dr;
    const urls = r?.image_urls || [];
    const rowData = {};

    for (const h of originalHeaders) {
      rowData[`raw_${sanitizeKey(h)}`] = entry.raw?.[h] ?? '';
    }

    const status = r?.status === 'auto_matched' ? 'Matched'
      : r?.status === 'review_required' ? 'Review Required'
      : 'Unmatched';

    rowData.match_status = status;
    rowData.matched_db_product = dr?.name ?? '';
    rowData.dr_product_id = r?.dr_product_id ?? (dr?.barcode ?? '');
    rowData.match_confidence = r?.confidence ?? '';
    rowData.match_method = r?.method ?? '';
    rowData.composition = dr?.composition ?? '';
    rowData.prescription_required = dr?.prescription_required ?? '';
    rowData.description = dr?.description ?? '';
    rowData.enriched_category = dr?.category ?? '';
    rowData.image_status = r?.image_status ?? (status === 'Unmatched' ? 'N/A' : '');
    rowData.primary_image_url = urls[0] ?? '';
    rowData.cloudinary_url = r?.cloudinary_url ?? urls[0] ?? '';
    rowData.additional_image_urls = urls.length > 1 ? urls.slice(1).join(' | ') : '';
    rowData.rejection_reason = status === 'Unmatched' ? (r?.reason ?? 'No match found') : '';

    const row = ws.addRow(rowData);
    const confCell = row.getCell('match_confidence');
    if (r?.confidence) {
      confCell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      confCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: confidenceColor(r.confidence) } };
      confCell.alignment = { horizontal: 'center' };
    }
    const imgCell = row.getCell('primary_image_url');
    if (urls[0]) {
      imgCell.value = { text: urls[0], hyperlink: urls[0] };
      imgCell.font = { color: { argb: 'FF1565C0' }, underline: true };
    }
  }

  ws.autoFilter = { from: 'A1', to: ws.columns.at(-1).letter + '1' };
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  await wb.xlsx.writeFile(filePath);
  logger.info(`Written: ${filePath} (${entries.length} rows — all products)`);
}

function sanitizeKey(h) {
  return String(h).replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').slice(0, 40);
}

/** Write matched_products.xlsx */
export async function writeMatchedReport(results, filePath, options = {}) {
  ensureDir(filePath);
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Enrichment Engine';
  const ws = wb.addWorksheet('Matched Products');

  const pass3Cols = options.pass3 ? [
    { header: 'Low Confidence', key: 'low_confidence', width: 14 },
    { header: 'Audit Flags', key: 'audit_flags', width: 28 },
  ] : [];

  ws.columns = [
    { header: 'RMS ID',           key: 'rms_id',        width: 18 },
    { header: 'RMS Product Name', key: 'rms_name',       width: 40 },
    { header: 'RMS Manufacturer', key: 'rms_brand',      width: 22 },
    { header: 'RMS Pack Size',    key: 'rms_pack',       width: 14 },
    { header: 'RMS MRP',         key: 'rms_mrp',        width: 10 },
    { header: 'DR Product Name',  key: 'dr_name',        width: 40 },
    { header: 'DR Product ID',    key: 'dr_product_id',  width: 16 },
    { header: 'DR Manufacturer',  key: 'dr_brand',       width: 22 },
    { header: 'DR Pack Size',     key: 'dr_pack',        width: 14 },
    { header: 'Confidence %',     key: 'confidence',     width: 14 },
    { header: 'Match Method',     key: 'method',         width: 18 },
    ...pass3Cols,
    { header: 'Description',      key: 'description',    width: 50 },
    { header: 'Composition',      key: 'composition',    width: 50 },
    { header: 'Prescription Required', key: 'prescription_required', width: 18 },
    { header: 'Image Status',     key: 'image_status',   width: 14 },
    { header: 'Image URLs',       key: 'image_urls',     width: 60 },
  ];

  headerStyle(ws, ws.getRow(1));

  for (const r of results) {
    const row = ws.addRow({
      rms_id:      r.rms.rms_id,
      rms_name:    r.rms.name,
      rms_brand:   r.rms.manufacturer,
      rms_pack:    r.rms.pack_size,
      rms_mrp:     r.rms.mrp,
      dr_name:     r.dr?.name ?? '',
      dr_product_id: r.dr_product_id ?? r.dr?.barcode ?? '',
      dr_brand:    r.dr?.manufacturer ?? '',
      dr_pack:     r.dr?.pack_size ?? '',
      confidence:  r.confidence,
      method:      r.method,
      low_confidence: options.pass3 ? (r.lowConfidence ? 'YES' : 'NO') : undefined,
      audit_flags: options.pass3 ? (r.lowConfidenceFlags || []).join(', ') : undefined,
      description: r.dr?.description ?? '',
      composition: r.dr?.composition ?? '',
      prescription_required: r.dr?.prescription_required ?? '',
      image_status: r.image_status ?? '',
      image_urls:  formatImageUrls(r.image_urls),
    });
    // Color confidence cell
    const confCell = row.getCell('confidence');
    confCell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    confCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: confidenceColor(r.confidence) } };
    confCell.alignment = { horizontal: 'center' };

    const imgCell = row.getCell('image_urls');
    if (r.image_urls?.length) {
      imgCell.value = { text: formatImageUrls(r.image_urls), hyperlink: r.image_urls[0] };
      imgCell.font = { color: { argb: 'FF1565C0' }, underline: true };
    }
  }

  ws.autoFilter = { from: 'A1', to: ws.columns.at(-1).letter + '1' };
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  await wb.xlsx.writeFile(filePath);
  logger.info(`Written: ${filePath} (${results.length} rows)`);
}

/** Write review_required.xlsx */
export async function writeReviewReport(results, filePath, options = {}) {
  ensureDir(filePath);
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Enrichment Engine';
  const ws = wb.addWorksheet('Review Required');

  const suggCols = [1, 2, 3, 4, 5].flatMap(i => [
    { header: `Suggestion ${i} Name`,       key: `s${i}_name`,   width: 36 },
    { header: `Suggestion ${i} Brand`,      key: `s${i}_brand`,  width: 20 },
    { header: `Suggestion ${i} Pack`,       key: `s${i}_pack`,   width: 12 },
    { header: `Suggestion ${i} Confidence`, key: `s${i}_conf`,   width: 14 },
    { header: `Suggestion ${i} Image URLs`, key: `s${i}_images`, width: 50 },
  ]);

  ws.columns = [
    { header: 'RMS ID',           key: 'rms_id',   width: 18 },
    { header: 'RMS Product Name', key: 'rms_name', width: 40 },
    { header: 'RMS Manufacturer', key: 'rms_brand',width: 22 },
    { header: 'RMS Pack Size',    key: 'rms_pack', width: 14 },
    { header: 'RMS MRP',         key: 'rms_mrp',  width: 10 },
    ...(options.pass3 ? [
      { header: 'Best Match Name', key: 'best_name', width: 36 },
      { header: 'Best Confidence', key: 'best_conf', width: 14 },
      { header: 'Audit Flags', key: 'audit_flags', width: 28 },
    ] : []),
    ...suggCols,
  ];

  headerStyle(ws, ws.getRow(1));

  for (const r of results) {
    const rowData = {
      rms_id:   r.rms.rms_id,
      rms_name: r.rms.name,
      rms_brand: r.rms.manufacturer,
      rms_pack:  r.rms.pack_size,
      rms_mrp:   r.rms.mrp,
      best_name: options.pass3 ? (r.dr?.name ?? r.suggestions?.[0]?.dr?.name ?? '') : undefined,
      best_conf: options.pass3 ? (r.confidence ?? r.suggestions?.[0]?.confidence ?? '') : undefined,
      audit_flags: options.pass3 ? (r.lowConfidenceFlags || []).join(', ') : undefined,
    };
    (r.suggestions || []).slice(0, 5).forEach((s, i) => {
      const n = i + 1;
      rowData[`s${n}_name`]   = s.dr?.name ?? '';
      rowData[`s${n}_brand`]  = s.dr?.manufacturer ?? '';
      rowData[`s${n}_pack`]   = s.dr?.pack_size ?? '';
      rowData[`s${n}_conf`]   = s.confidence;
      rowData[`s${n}_images`] = formatImageUrls(s.image_urls);
    });
    const row = ws.addRow(rowData);
    for (let i = 1; i <= 5; i++) {
      const confCell = row.getCell(`s${i}_conf`);
      const conf = rowData[`s${i}_conf`];
      if (conf) {
        confCell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        confCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: confidenceColor(conf) } };
        confCell.alignment = { horizontal: 'center' };
      }
      const imgCell = row.getCell(`s${i}_images`);
      const urls = (r.suggestions?.[i - 1]?.image_urls) || [];
      if (urls.length) {
        imgCell.value = { text: formatImageUrls(urls), hyperlink: urls[0] };
        imgCell.font = { color: { argb: 'FF1565C0' }, underline: true };
      }
    }
  }

  ws.autoFilter = { from: 'A1', to: ws.columns.at(-1).letter + '1' };
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  await wb.xlsx.writeFile(filePath);
  logger.info(`Written: ${filePath} (${results.length} rows)`);
}

/** Read unmatched_products.xlsx from a prior run */
export async function readUnmatchedReport(filePath) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const ws = wb.getWorksheet('Unmatched') || wb.worksheets[0];
  const products = [];

  ws.eachRow((row, rowNum) => {
    if (rowNum === 1) return;
    const rmsId = row.getCell(1).value;
    const name = row.getCell(2).value;
    if (!name) return;

    products.push({
      rms_id: rmsId != null ? String(rmsId).trim() : null,
      name: String(name).trim(),
      manufacturer: row.getCell(3).value != null ? String(row.getCell(3).value).trim() : '',
      pack_size: row.getCell(4).value != null ? String(row.getCell(4).value).trim() : '',
      mrp: parseFloat(row.getCell(5).value) || null,
      barcode: row.getCell(6).value != null ? String(row.getCell(6).value).trim() : null,
      stock: 0,
      category: null,
    });
  });

  logger.info(`Read unmatched report: ${filePath} (${products.length} rows)`);
  return products;
}

/** Append second-pass matches as a new sheet on matched_products.xlsx */
export async function appendSecondPassSheet(matchedFilePath, pass2Results, sheetName = 'Second Pass Matches') {
  if (!pass2Results.length) return;

  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.readFile(matchedFilePath);
  } catch {
    logger.warn(`Could not read ${matchedFilePath} for merge — skipping append`);
    return;
  }

  const existing = wb.getWorksheet(sheetName);
  if (existing) wb.removeWorksheet(existing.id);

  const ws = wb.addWorksheet(sheetName);
  ws.columns = [
    { header: 'RMS ID',           key: 'rms_id',        width: 18 },
    { header: 'RMS Product Name', key: 'rms_name',       width: 40 },
    { header: 'RMS Manufacturer', key: 'rms_brand',      width: 22 },
    { header: 'RMS Pack Size',    key: 'rms_pack',       width: 14 },
    { header: 'DR Product Name',  key: 'dr_name',        width: 40 },
    { header: 'DR Manufacturer',  key: 'dr_brand',       width: 22 },
    { header: 'Confidence %',     key: 'confidence',     width: 14 },
    { header: 'Match Method',     key: 'method',         width: 16 },
    { header: 'Image URLs',       key: 'image_urls',     width: 60 },
  ];
  headerStyle(ws, ws.getRow(1));

  for (const r of pass2Results) {
    const row = ws.addRow({
      rms_id:     r.rms.rms_id,
      rms_name:   r.rms.name,
      rms_brand:  r.rms.manufacturer,
      rms_pack:   r.rms.pack_size,
      dr_name:    r.dr?.name ?? '',
      dr_brand:   r.dr?.manufacturer ?? '',
      confidence: r.confidence,
      method:     r.method,
      image_urls: formatImageUrls(r.image_urls),
    });
    const confCell = row.getCell('confidence');
    confCell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    confCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: confidenceColor(r.confidence) } };
    confCell.alignment = { horizontal: 'center' };
  }

  await wb.xlsx.writeFile(matchedFilePath);
  logger.info(`Appended "${sheetName}" to ${matchedFilePath} (${pass2Results.length} rows)`);
}

/** Append third-pass matches as a new sheet on matched_products.xlsx */
export async function appendThirdPassSheet(matchedFilePath, pass3Results, sheetName = 'Third Pass Matches') {
  if (!pass3Results.length) return;

  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.readFile(matchedFilePath);
  } catch {
    logger.warn(`Could not read ${matchedFilePath} for merge — skipping append`);
    return;
  }

  const existing = wb.getWorksheet(sheetName);
  if (existing) wb.removeWorksheet(existing.id);

  const ws = wb.addWorksheet(sheetName);
  ws.columns = [
    { header: 'RMS ID',           key: 'rms_id',        width: 18 },
    { header: 'RMS Product Name', key: 'rms_name',       width: 40 },
    { header: 'RMS Manufacturer', key: 'rms_brand',      width: 22 },
    { header: 'RMS Pack Size',    key: 'rms_pack',       width: 14 },
    { header: 'DR Product Name',  key: 'dr_name',        width: 40 },
    { header: 'DR Manufacturer',  key: 'dr_brand',       width: 22 },
    { header: 'Confidence %',     key: 'confidence',     width: 14 },
    { header: 'Match Method',     key: 'method',         width: 18 },
    { header: 'Low Confidence',   key: 'low_confidence', width: 14 },
    { header: 'Audit Flags',      key: 'audit_flags',    width: 28 },
    { header: 'Image URLs',       key: 'image_urls',     width: 60 },
  ];
  headerStyle(ws, ws.getRow(1));

  for (const r of pass3Results) {
    const row = ws.addRow({
      rms_id:     r.rms.rms_id,
      rms_name:   r.rms.name,
      rms_brand:  r.rms.manufacturer,
      rms_pack:   r.rms.pack_size,
      dr_name:    r.dr?.name ?? '',
      dr_brand:   r.dr?.manufacturer ?? '',
      confidence: r.confidence,
      method:     r.method,
      low_confidence: r.lowConfidence ? 'YES' : 'NO',
      audit_flags: (r.lowConfidenceFlags || []).join(', '),
      image_urls: formatImageUrls(r.image_urls),
    });
    const confCell = row.getCell('confidence');
    confCell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    confCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: confidenceColor(r.confidence) } };
    confCell.alignment = { horizontal: 'center' };
  }

  await wb.xlsx.writeFile(matchedFilePath);
  logger.info(`Appended "${sheetName}" to ${matchedFilePath} (${pass3Results.length} rows)`);
}

/** Write unmatched_products.xlsx */
export async function writeUnmatchedReport(results, filePath) {
  ensureDir(filePath);
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Enrichment Engine';
  const ws = wb.addWorksheet('Unmatched');

  ws.columns = [
    { header: 'RMS ID',           key: 'rms_id',   width: 18 },
    { header: 'RMS Product Name', key: 'rms_name', width: 40 },
    { header: 'RMS Manufacturer', key: 'rms_brand',width: 22 },
    { header: 'RMS Pack Size',    key: 'rms_pack', width: 14 },
    { header: 'RMS MRP',         key: 'rms_mrp',  width: 10 },
    { header: 'RMS Barcode',     key: 'barcode',  width: 16 },
    { header: 'Closest Match Name', key: 'closest_name', width: 40 },
    { header: 'Closest Match Confidence %', key: 'closest_conf', width: 18 },
    { header: 'Reason',          key: 'reason',   width: 40 },
  ];

  headerStyle(ws, ws.getRow(1));

  for (const r of results) {
    const closest = r.suggestions?.[0];
    const row = ws.addRow({
      rms_id:   r.rms.rms_id,
      rms_name: r.rms.name,
      rms_brand: r.rms.manufacturer,
      rms_pack:  r.rms.pack_size,
      rms_mrp:   r.rms.mrp,
      barcode:   r.rms.barcode,
      closest_name: closest?.dr?.name ?? '',
      closest_conf: closest?.confidence ?? '',
      reason:    r.reason ?? 'No match found',
    });
    const confCell = row.getCell('closest_conf');
    if (closest?.confidence) {
      confCell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      confCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: confidenceColor(closest.confidence) } };
      confCell.alignment = { horizontal: 'center' };
    }
  }

  ws.autoFilter = { from: 'A1', to: 'J1' };
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  await wb.xlsx.writeFile(filePath);
  logger.info(`Written: ${filePath} (${results.length} rows)`);
}

/** Write matching_debug_report.xlsx — summary + unmatched with top-5 suggestions */
export async function writeDebugReport({ stats, unmatched }, filePath) {
  ensureDir(filePath);
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Enrichment Engine';

  const summary = wb.addWorksheet('Summary');
  summary.columns = [
    { header: 'Metric', key: 'metric', width: 36 },
    { header: 'Count', key: 'count', width: 14 },
    { header: 'Rate', key: 'rate', width: 14 },
  ];
  headerStyle(summary, summary.getRow(1));

  const total = stats.total || 0;
  const pct = (n) => (total ? `${((n / total) * 100).toFixed(1)}%` : '0%');
  const methods = stats.methods || {};

  for (const [metric, count, rate] of [
    ['Total RMS Products', total, '100%'],
    ['Auto Matched', stats.matched || 0, pct(stats.matched || 0)],
    ['Review Required', stats.review || 0, pct(stats.review || 0)],
    ['Unmatched', stats.unmatched || 0, pct(stats.unmatched || 0)],
    ['—', '', ''],
    ['Barcode Matches', methods.barcode || 0, pct(methods.barcode || 0)],
    ['Exact Matches', methods.exact || 0, pct(methods.exact || 0)],
    ['Structural Matches', methods.structural || 0, pct(methods.structural || 0)],
    ['Alias Matches', methods.alias || 0, pct(methods.alias || 0)],
    ['Composite Matches', methods.composite || 0, pct(methods.composite || 0)],
    ['Fuzzy Fallback', methods.fuzzy || 0, pct(methods.fuzzy || 0)],
  ]) {
    summary.addRow({ metric, count, rate });
  }

  const ws = wb.addWorksheet('Unmatched Details');
  const suggCols = [1, 2, 3, 4, 5].flatMap(i => [
    { header: `Top ${i} DR Name`, key: `s${i}_name`, width: 36 },
    { header: `Top ${i} Confidence`, key: `s${i}_conf`, width: 14 },
  ]);

  ws.columns = [
    { header: 'RMS Product Name', key: 'rms_name', width: 40 },
    { header: 'RMS Manufacturer', key: 'rms_brand', width: 24 },
    { header: 'RMS Pack', key: 'rms_pack', width: 14 },
    { header: 'Parsed Brand', key: 'p_brand', width: 14 },
    { header: 'Parsed Strength', key: 'p_strength', width: 14 },
    { header: 'Parsed Form', key: 'p_form', width: 18 },
    { header: 'Rejection Reason', key: 'reason', width: 40 },
    ...suggCols,
  ];
  headerStyle(ws, ws.getRow(1));

  for (const r of unmatched) {
    const rowData = {
      rms_name: r.rms.name,
      rms_brand: r.rms.manufacturer,
      rms_pack: r.rms.pack_size,
      p_brand: r.parsed?.brand ?? '',
      p_strength: r.parsed?.strength ?? '',
      p_form: r.parsed?.form ?? '',
      reason: r.reason ?? 'No match found',
    };
    (r.suggestions || []).slice(0, 5).forEach((s, i) => {
      const n = i + 1;
      rowData[`s${n}_name`] = s.dr?.name ?? '';
      rowData[`s${n}_conf`] = s.confidence ?? '';
    });
    ws.addRow(rowData);
  }

  ws.autoFilter = { from: 'A1', to: ws.columns.at(-1).letter + '1' };
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  await wb.xlsx.writeFile(filePath);
  logger.info(`Written: ${filePath} (summary + ${unmatched.length} unmatched)`);
}

/** Matched products with no image URLs for their DR Product ID */
export async function writeNoImagesReport(results, filePath) {
  ensureDir(filePath);
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Enrichment Engine';
  const ws = wb.addWorksheet('No Images');

  ws.columns = [
    { header: 'RMS Product Code', key: 'rms_id', width: 18 },
    { header: 'RMS Product Name', key: 'rms_name', width: 40 },
    { header: 'RMS Manufacturer', key: 'rms_brand', width: 22 },
    { header: 'RMS Pack Size', key: 'rms_pack', width: 14 },
    { header: 'DR Product Name', key: 'dr_name', width: 40 },
    { header: 'DR Product ID', key: 'dr_product_id', width: 16 },
    { header: 'DR Manufacturer', key: 'dr_brand', width: 22 },
    { header: 'Match Confidence %', key: 'confidence', width: 16 },
    { header: 'Match Method', key: 'method', width: 18 },
    { header: 'Image Status', key: 'image_status', width: 16 },
    { header: 'Composition', key: 'composition', width: 50 },
    { header: 'Description', key: 'description', width: 50 },
  ];

  headerStyle(ws, ws.getRow(1));

  for (const r of results) {
    const row = ws.addRow({
      rms_id: r.rms.rms_id,
      rms_name: r.rms.name,
      rms_brand: r.rms.manufacturer,
      rms_pack: r.rms.pack_size,
      dr_name: r.dr?.name ?? '',
      dr_product_id: r.dr_product_id ?? r.dr?.barcode ?? '',
      dr_brand: r.dr?.manufacturer ?? '',
      confidence: r.confidence,
      method: r.method,
      image_status: r.image_status ?? 'No Images',
      composition: r.dr?.composition ?? '',
      description: r.dr?.description ?? '',
    });
    const statusCell = row.getCell('image_status');
    statusCell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB71C1C' } };
    statusCell.alignment = { horizontal: 'center' };
  }

  ws.autoFilter = { from: 'A1', to: ws.columns.at(-1).letter + '1' };
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  await wb.xlsx.writeFile(filePath);
  logger.info(`Written: ${filePath} (${results.length} matched products without images)`);
}
