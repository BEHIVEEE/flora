/**
 * importFiles.js
 * Imports RMS + DataRequisite files into MySQL staging tables.
 *
 * SAFE RMS HANDLING:
 *   - Never truncates RMS catalog
 *   - Upserts stock/MRP/name/barcode only
 *   - Enrichment lives in product_enrichment (separate table)
 *
 * Run: node src/scripts/importFiles.js
 */
import 'dotenv/config';
import { streamDataFile } from '../reader/csvReader.js';
import { streamProductList } from '../reader/rawReader.js';
import { RMS_COLUMN_MAP, DRUGS_COLUMN_MAP, IMAGES_COLUMN_MAP } from '../reader/columnMaps.js';
import { batchInsert, query, closePool } from '../db/pool.js';
import { normalizeName, normalizeBrandSync, normalizePackSize } from '../normalizer/index.js';
import { files, processing, brandAliases } from '../config/index.js';
import logger from '../logger/index.js';

const BATCH = processing.batchSize;
const FULL_DR_IMPORT = process.argv.includes('--full-dr');

async function importRMS() {
  logger.info('Importing RMS products (upsert — preserves enrichment links)…', { file: files.rms });
  let buffer = [];
  let total = 0;

  await streamProductList(files.rms, RMS_COLUMN_MAP, async ({ mapped }) => {
    if (!mapped.name) return;
    const rmsId = mapped.rms_id || mapped.barcode || `RMS-${normalizeName(mapped.name).slice(0, 40)}`;
    const brand = normalizeBrandSync(mapped.manufacturer, brandAliases);
    buffer.push([
      rmsId,
      mapped.name,
      normalizeName(mapped.name),
      brand,
      brand,
      parseFloat(mapped.mrp) || 0,
      parseInt(mapped.stock, 10) || 0,
      mapped.pack_size || null,
      normalizePackSize(mapped.pack_size),
      mapped.barcode || null,
    ]);

    if (buffer.length >= BATCH) await flush();
  }, {
    onProgress: n => { if (n % 5000 === 0) logger.info(`RMS: read ${n} rows…`); },
  });

  await flush();
  logger.info(`RMS import complete: ${total} products upserted`);

  async function flush() {
    if (!buffer.length) return;
    await batchInsert(
      'products',
      ['rms_id', 'name', 'normalized_name', 'manufacturer', 'normalized_brand', 'mrp', 'stock', 'pack_size', 'normalized_pack_size', 'barcode'],
      buffer,
      {
        onDuplicateUpdate: ['name', 'normalized_name', 'manufacturer', 'normalized_brand', 'mrp', 'stock', 'pack_size', 'normalized_pack_size', 'barcode'],
      }
    );
    total += buffer.length;
    buffer = [];
  }
}

async function importDrugsFromFile(filePath, truncateFirst = false) {
  if (truncateFirst) {
    await query('TRUNCATE TABLE dr_products');
  }
  let buffer = [];
  let total = 0;

  await streamDataFile(filePath, DRUGS_COLUMN_MAP, async (row) => {
    if (!row.name) return;
    const brand = normalizeBrandSync(row.manufacturer, brandAliases);
    buffer.push([
      row.name,
      normalizeName(row.name),
      brand,
      row.composition || null,
      row.description || null,
      row.category || null,
      normalizePackSize(row.pack_size),
      row.barcode || null,
      row.prescription_required || null,
    ]);
    if (buffer.length >= BATCH) await flush();
  }, {
    onProgress: n => { if (n % 50000 === 0) logger.info(`DR: read ${n} rows from ${filePath}…`); },
  });

  await flush();
  return total;

  async function flush() {
    if (!buffer.length) return;
    await batchInsert(
      'dr_products',
      ['name', 'normalized_name', 'manufacturer', 'composition', 'description', 'category', 'pack_size', 'barcode', 'prescription_required'],
      buffer,
      FULL_DR_IMPORT && !truncateFirst ? { ignore: true } : undefined
    );
    total += buffer.length;
    buffer = [];
  }
}

async function importDrugs() {
  logger.info('Importing DataRequisite products…', { file: files.drugs });
  let total = await importDrugsFromFile(files.drugs, true);

  const extras = [files.drugs2, files.drugs3, process.env.DRUGS_FILE_2, process.env.DRUGS_FILE_3]
    .filter(Boolean);
  for (const extra of extras) {
    try {
      const n = await importDrugsFromFile(extra, false);
      total += n;
      logger.info(`DR extra file imported`, { file: extra, rows: n });
    } catch (err) {
      logger.warn(`Skipped DR file`, { file: extra, err: err.message });
    }
  }
  logger.info(`DR import complete: ${total} products`);
}

async function importImages() {
  logger.info('Importing DataRequisite images…', { file: files.images });
  await query('TRUNCATE TABLE dr_images');
  let buffer = [];
  let total = 0;

  const imageFiles = [files.images, files.images2, process.env.IMAGES_FILE_2].filter(Boolean);

  for (const filePath of imageFiles) {
    await streamDataFile(filePath, IMAGES_COLUMN_MAP, async (row) => {
      if (!row.image_url) return;
      const brand = normalizeBrandSync(row.manufacturer, brandAliases);
      const normName = normalizeName(row.product_name || row.name);
      const urls = String(row.image_url).split(/\s*\|\s*/).map(u => u.trim()).filter(u => u.startsWith('http'));
      for (let i = 0; i < urls.length; i++) {
        buffer.push([
          row.product_name || row.name || null,
          normName,
          brand,
          urls[i],
          parseInt(row.sort_order, 10) || (i + 1),
        ]);
        if (buffer.length >= BATCH) await flush();
      }
    }, {
      onProgress: n => { if (n % 50000 === 0) logger.info(`Images: read ${n} rows…`); },
    });
  }

  await flush();
  logger.info(`Images import complete: ${total} URLs`);

  async function flush() {
    if (!buffer.length) return;
    await batchInsert(
      'dr_images',
      ['product_name', 'normalized_name', 'manufacturer', 'image_url', 'sort_order'],
      buffer
    );
    total += buffer.length;
    buffer = [];
  }
}

async function run() {
  try {
    await importRMS();
    await importDrugs();
    await importImages();
    logger.info('All files imported successfully');
  } catch (err) {
    logger.error('Import failed', { err: err.message, stack: err.stack });
    process.exit(1);
  } finally {
    await closePool();
  }
}

run();
