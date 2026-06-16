/**
 * runEnrich.js
 *
 * Single-command catalog enrichment pipeline.
 * Drop 3 files into data/input/ and run: npm run enrich:catalog
 *
 * 1. Product List (your ~26k catalog)
 * 2. Medicine Database (700k+ products, multiple files OK)
 * 3. Image URL Database
 */
import 'dotenv/config';
import { mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { detectInputFiles } from '../utils/fileDetect.js';
import logger from '../logger/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENGINE_ROOT = resolve(__dirname, '../..');

async function main() {
  const inputDir = process.env.INPUT_DIR || resolve(ENGINE_ROOT, 'data/input');
  mkdirSync(inputDir, { recursive: true });
  mkdirSync(resolve(ENGINE_ROOT, 'data/output'), { recursive: true });

  const detected = detectInputFiles(inputDir);

  // Fall back to .env / repo data paths if input folder empty
  if (!detected.rms) {
    const fallbacks = [
      process.env.RMS_FILE,
      resolve(ENGINE_ROOT, '../data/ProductList.csv'),
    ].filter(Boolean);
    for (const p of fallbacks) {
      if (existsSync(resolve(p))) { detected.rms = resolve(p); break; }
    }
  }

  if (!detected.drugs.length) {
    const drugPaths = [
      process.env.DRUGS_FILE,
      resolve(ENGINE_ROOT, '../data/June_2026_DRUGS_DATA_PART_1.csv'),
      resolve(ENGINE_ROOT, '../data/June 2026 DRUGS DATA PART 2 of 2.xlsx'),
    ].filter(p => p && existsSync(resolve(p)));
    detected.drugs = drugPaths.map(p => resolve(p));
    const otc = resolve(ENGINE_ROOT, '../June 2026 OTC DATA PART 1 of 1.xlsx');
    if (existsSync(otc)) detected.drugs.push(otc);
  }

  if (!detected.images.length) {
    const imgPaths = [
      process.env.IMAGES_FILE,
      resolve(ENGINE_ROOT, '../data/June_2026_DRUGS_IMAGE_URLS.csv'),
    ].filter(p => p && existsSync(resolve(p)));
    detected.images = imgPaths.map(p => resolve(p));
  }

  if (!detected.rms) {
    console.error('\n✗ Product List file not found.');
    console.error('  Place your product catalog in:', inputDir);
    console.error('  Expected name like: ProductList.xlsx or product_list.csv\n');
    process.exit(1);
  }

  if (!detected.drugs.length) {
    console.error('\n✗ Medicine database file(s) not found.');
    console.error('  Place DRUGS/medicine Excel/CSV files in:', inputDir, '\n');
    process.exit(1);
  }

  // Apply detected paths to env for matchFromFiles
  process.env.RMS_FILE = detected.rms;
  process.env.DRUGS_FILE = detected.drugs[0];
  process.env.DRUGS_FILE_2 = detected.drugs[1] || '';
  process.env.DRUGS_FILE_3 = detected.drugs[2] || '';
  process.env.IMAGES_FILE = detected.images[0] || process.env.IMAGES_FILE || '';
  process.env.IMAGES_FILE_2 = detected.images[1] || '';
  process.env.OUTPUT_DIR = process.env.OUTPUT_DIR || resolve(ENGINE_ROOT, 'data/output');

  console.log('\n=== PHARMACY CATALOG ENRICHMENT ===\n');
  console.log('Product List:  ', detected.rms);
  console.log('Medicine DB:   ', detected.drugs.join('\n                 '));
  console.log('Image URLs:    ', detected.images.join('\n                 ') || '(none — images skipped)');
  console.log('Output:        ', process.env.OUTPUT_DIR);
  console.log('');

  // Dynamic import so env vars are set first
  await import('./matchFromFiles.js');
}

main().catch(err => {
  logger.error('Enrichment pipeline failed', { err: err.message, stack: err.stack });
  process.exit(1);
});
