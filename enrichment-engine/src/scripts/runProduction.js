/**
 * runProduction.js
 *
 * ONE-COMMAND production pipeline for shop PC:
 *
 *   1. Auto-detect input files
 *   2. Import RMS (upsert) + DR + images
 *   3. Match (incremental via product_match_mapping)
 *   4. Enrich → product_enrichment (inline images if no Redis)
 *   5. Generate Excel reports
 *   6. Optionally publish to website
 *
 * Usage:
 *   npm run enrich:production
 *   npm run enrich:production -- --full          # rematch all products
 *   npm run enrich:production -- --publish         # push to website after enrich
 *   npm run enrich:production -- --files-only      # Excel reports without MySQL
 */
import 'dotenv/config';
import { mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { fork } from 'child_process';
import { detectInputFiles } from '../utils/fileDetect.js';
import { createPerformanceTracker, formatPerformanceReport } from '../utils/performanceReport.js';
import logger from '../logger/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENGINE_ROOT = resolve(__dirname, '../..');

const ARGS = process.argv.slice(2);
const FULL = ARGS.includes('--full');
const PUBLISH = ARGS.includes('--publish');
const FILES_ONLY = ARGS.includes('--files-only');
const INLINE = !process.env.REDIS_HOST || ARGS.includes('--inline');

async function runStep(name, script, extraArgs = []) {
  logger.info(`▶ ${name}`);
  const start = Date.now();
  await new Promise((resolvePromise, reject) => {
    const child = fork(script, extraArgs, {
      stdio: 'inherit',
      env: { ...process.env, NODE_OPTIONS: process.env.NODE_OPTIONS || '--max-old-space-size=8192' },
    });
    child.on('exit', code => (code === 0 ? resolvePromise() : reject(new Error(`${name} failed (exit ${code})`))));
    child.on('error', reject);
  });
  return ((Date.now() - start) / 1000).toFixed(1);
}

function configurePaths(detected) {
  process.env.RMS_FILE = detected.rms;
  process.env.DRUGS_FILE = detected.drugs[0];
  process.env.DRUGS_FILE_2 = detected.drugs[1] || '';
  process.env.DRUGS_FILE_3 = detected.drugs[2] || '';
  process.env.IMAGES_FILE = detected.images[0] || '';
  process.env.IMAGES_FILE_2 = detected.images[1] || '';
  process.env.OUTPUT_DIR = process.env.OUTPUT_DIR || resolve(ENGINE_ROOT, 'data/output');
  process.env.INPUT_DIR = process.env.INPUT_DIR || resolve(ENGINE_ROOT, 'data/input');
}

async function main() {
  const perf = createPerformanceTracker();
  const inputDir = process.env.INPUT_DIR || resolve(ENGINE_ROOT, 'data/input');
  mkdirSync(inputDir, { recursive: true });
  mkdirSync(resolve(ENGINE_ROOT, 'data/output'), { recursive: true });

  const detected = detectInputFiles(inputDir);

  if (!detected.rms) {
    const fallbacks = [process.env.RMS_FILE, resolve(ENGINE_ROOT, '../data/ProductList.csv')].filter(p => p && existsSync(resolve(p)));
    detected.rms = fallbacks.map(p => resolve(p)).find(p => existsSync(p));
  }
  if (!detected.drugs.length) {
    detected.drugs = [
      process.env.DRUGS_FILE,
      resolve(ENGINE_ROOT, '../data/June_2026_DRUGS_DATA_PART_1.csv'),
      resolve(ENGINE_ROOT, '../data/June 2026 DRUGS DATA PART 2 of 2.xlsx'),
      resolve(ENGINE_ROOT, '../June 2026 OTC DATA PART 1 of 1.xlsx'),
    ].filter(p => p && existsSync(resolve(p))).map(p => resolve(p));
  }
  if (!detected.images.length) {
    detected.images = [
      process.env.IMAGES_FILE,
      resolve(ENGINE_ROOT, '../data/June_2026_DRUGS_IMAGE_URLS.csv'),
    ].filter(p => p && existsSync(resolve(p))).map(p => resolve(p));
  }

  if (!detected.rms) {
    console.error('\n✗ Product List not found. Place RMS export in:', inputDir);
    process.exit(1);
  }
  if (!detected.drugs.length) {
    console.error('\n✗ Medicine database not found.');
    process.exit(1);
  }

  configurePaths(detected);

  console.log('\n=== PHARMACY ENRICHMENT — PRODUCTION PIPELINE ===\n');
  console.log('Product List: ', detected.rms);
  console.log('Medicine DB:  ', detected.drugs.join('\n               '));
  console.log('Image URLs:   ', detected.images.join('\n               ') || '(none)');
  console.log('Mode:         ', FILES_ONLY ? 'Excel only' : INLINE ? 'MySQL + inline images' : 'MySQL + Redis workers');
  console.log('');

  const timing = {};

  if (FILES_ONLY) {
    timing.match = await runStep('Match from files', resolve(__dirname, 'matchFromFiles.js'));
  } else {
    timing.import = await runStep('Import files', resolve(__dirname, 'importFiles.js'));
    timing.match = await runStep('Match products', resolve(__dirname, 'runMatching.js'), FULL ? ['--full'] : []);
    timing.enrich = await runStep('Enrich products', resolve(__dirname, 'runEnrichment.js'), INLINE ? ['--inline'] : []);
    timing.reports = await runStep('Generate reports', resolve(__dirname, 'generateReports.js'));
    if (PUBLISH) {
      timing.publish = await runStep('Publish enrichment catalog', resolve(__dirname, 'publishEnrichmentCatalog.js'));
    }
  }

  const snap = perf.snapshot('complete');
  console.log(formatPerformanceReport({
    total: 'see reports',
    matched: '-',
    review: '-',
    unmatched: '-',
    matchRate: '-',
    validationOk: true,
    elapsedSec: snap.elapsedSec,
    productsPerSec: snap.productsPerSec,
    workers: INLINE ? 1 : 'Redis',
    memoryMb: snap.memoryMb,
    cpu: snap.cpu,
    cpus: snap.cpus,
    timing,
  }));

  console.log('\n✓ Pipeline complete');
  console.log(`  Reports: ${process.env.OUTPUT_DIR}`);
  if (!FILES_ONLY) console.log('  MySQL:   product_enrichment + product_match_mapping updated');
  if (PUBLISH) console.log('  Website: enrichment published via sync API');
}

main().catch(err => {
  logger.error('Production pipeline failed', { err: err.message, stack: err.stack });
  process.exit(1);
});
