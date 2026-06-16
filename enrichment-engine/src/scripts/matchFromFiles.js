/**
 * matchFromFiles.js
 *
 * Production-scale matching from CSV/XLSX — no MySQL required.
 * Pipeline: match drug/OTC data → enrich descriptions → lookup images by DR Product ID → reports
 *
 * Usage:
 *   node src/scripts/matchFromFiles.js
 *   node src/scripts/matchFromFiles.js --limit 5000
 *   node src/scripts/matchFromFiles.js --profile
 *   node src/scripts/matchFromFiles.js --no-cache
 *   node src/scripts/matchFromFiles.js --workers 4
 */
import 'dotenv/config';
import { mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { performance } from 'perf_hooks';
import { streamDataFile } from '../reader/csvReader.js';
import { streamProductList } from '../reader/rawReader.js';
import { RMS_COLUMN_MAP, DRUGS_COLUMN_MAP, DRUGS_MATCH_COLUMN_MAP } from '../reader/columnMaps.js';
import {
  createIndexBuilder,
  addProductToIndex,
  finalizeIndex,
  validateDoloExample,
} from '../matcher/engine.js';
import { matchBatchParallel, defaultWorkerCount } from '../matcher/parallelMatcher.js';
import {
  saveIndexCache,
  loadIndexCache,
  indexCacheIsFresh,
  DEFAULT_CACHE as INDEX_CACHE_PATH,
} from '../matcher/indexCache.js';
import {
  loadFileMatchCache,
  saveFileMatchCache,
  updateCacheFromResults,
  DEFAULT_FILE as MATCH_CACHE_PATH,
} from '../matcher/matchCache.js';
import {
  writeMatchedReport,
  writeReviewReport,
  writeUnmatchedReport,
  writeDebugReport,
  writeEnrichedProductsReport,
  writeNoImagesReport,
} from '../reporter/excelWriter.js';
import { validateProductCounts } from '../utils/validate.js';
import { createPerformanceTracker, formatPerformanceReport } from '../utils/performanceReport.js';
import { normalizeName } from '../normalizer/index.js';
import {
  buildImageIndex,
  attachImagesToResults,
  partitionMatchedByImages,
  imageLookupStats,
} from '../matcher/imageIndex.js';
import { recoverUnmatchedViaImageCrossRef } from '../matcher/imageCrossRef.js';
import { recoverViaWebImageVerify } from '../matcher/webImageVerify.js';
import { mergeRecoveryIntoBuckets } from '../matcher/recoveryPasses.js';
import { files, output, brandAliases, processing } from '../config/index.js';
import logger, { matchLogger } from '../logger/index.js';

const BATCH = processing.batchSize;
const limitArg = process.argv.find(a => a.startsWith('--limit'));
const ROW_LIMIT = limitArg
  ? Number(limitArg.split('=')[1] ?? process.argv[process.argv.indexOf('--limit') + 1])
  : 0;
const PROFILE = process.argv.includes('--profile');
const NO_INDEX_CACHE = process.argv.includes('--no-index-cache') || process.argv.includes('--no-cache');
const NO_MATCH_CACHE = process.argv.includes('--no-match-cache') || process.argv.includes('--no-cache')
  || process.env.USE_MATCH_CACHE === 'false';
const workersArg = process.argv.find(a => a.startsWith('--workers'));
const WORKERS = workersArg
  ? Number(workersArg.split('=')[1] ?? process.argv[process.argv.indexOf('--workers') + 1])
  : (processing.matchWorkers || defaultWorkerCount());

const laps = {};
let lapStart = performance.now();
function lap(label) {
  const now = performance.now();
  laps[label] = ((now - lapStart) / 1000).toFixed(1);
  lapStart = now;
}

function resolveDrugFiles() {
  const paths = [files.drugs];
  if (files.drugs2) paths.push(files.drugs2);
  else {
    const defaultPart2 = resolve('../data/June 2026 DRUGS DATA PART 2 of 2.xlsx');
    if (existsSync(defaultPart2)) paths.push(defaultPart2);
  }
  if (files.drugs3) paths.push(files.drugs3);
  else {
    const otcData = resolve('../June 2026 OTC DATA PART 1 of 1.xlsx');
    if (existsSync(otcData)) paths.push(otcData);
  }
  return paths.filter(p => p && existsSync(resolve(p))).map(p => resolve(p));
}

function collectDrBarcodes(results) {
  const barcodes = new Set();
  for (const r of results) {
    const dr = r.dr;
    if (dr?.barcode) barcodes.add(String(dr.barcode).trim());
  }
  return barcodes;
}

async function enrichDescriptions(results, drugFiles) {
  const needed = collectDrBarcodes(results);
  if (!needed.size) return;

  const details = new Map();
  const sortedFiles = [...drugFiles].sort((a, b) => {
    const aCsv = a.toLowerCase().endsWith('.csv') ? 0 : 1;
    const bCsv = b.toLowerCase().endsWith('.csv') ? 0 : 1;
    return aCsv - bCsv;
  });

  for (const f of sortedFiles) {
    await streamDataFile(f, DRUGS_COLUMN_MAP, async (row) => {
      if (!row.name) return;
      const bc = row.barcode ? String(row.barcode).trim() : '';
      if (!bc || !needed.has(bc) || details.has(bc)) return;

      details.set(bc, {
        description: row.description || null,
        composition: row.composition || null,
        prescription_required: row.prescription_required || null,
      });
      if (details.size >= needed.size) return false;
    });
    if (details.size >= needed.size) break;
  }

  for (const r of results) {
    const dr = r.dr;
    if (!dr?.barcode) continue;
    const detail = details.get(String(dr.barcode).trim());
    if (!detail) continue;
    if (detail.description) dr.description = detail.description;
    if (detail.composition && !dr.composition) dr.composition = detail.composition;
    if (detail.prescription_required && !dr.prescription_required) {
      dr.prescription_required = detail.prescription_required;
    }
  }
  matchLogger.info('DR descriptions enriched', { found: details.size, needed: needed.size });
}

async function loadDrIndex(drugFiles) {
  const resolved = drugFiles.map(p => resolve(p));
  const useCache = processing.useIndexCache && !NO_INDEX_CACHE;

  if (useCache && indexCacheIsFresh(INDEX_CACHE_PATH, resolved)) {
    const cached = await loadIndexCache(INDEX_CACHE_PATH, brandAliases);
    if (cached) {
      matchLogger.info('DR index loaded from cache — skipping Excel/CSV reload');
      return { index: cached, drugFiles: resolved, fromCache: true };
    }
  }

  const builder = createIndexBuilder(brandAliases);
  let nextId = 1;
  for (const f of resolved) {
    matchLogger.info('Loading DataRequisite products…', { file: f });
    await streamDataFile(f, DRUGS_MATCH_COLUMN_MAP, async (row) => {
      if (!row.name) return;
      addProductToIndex(builder, {
        id: nextId++,
        name: row.name,
        normalized_name: normalizeName(row.name),
        manufacturer: row.manufacturer || null,
        composition: row.composition || null,
        category: row.category || null,
        pack_size: row.pack_size || null,
        barcode: row.barcode || null,
        prescription_required: row.prescription_required || null,
      });
    }, {
      onProgress: n => { if (n % 50000 === 0) matchLogger.info(`DR: loaded ${n} from ${f}…`); },
    });
  }

  matchLogger.info(`DR products loaded: ${builder.productCount} from ${resolved.length} file(s)`);

  if (useCache) {
    matchLogger.info('Saving DR index cache (NDJSON)…');
    await saveIndexCache(builder, INDEX_CACHE_PATH);
    matchLogger.info('Cache saved. Rebuilding search indexes (10–20 min, please wait)…');
  }

  const index = finalizeIndex(builder);
  matchLogger.info(`Search indexes ready: ${index.normalized.length} products`);
  return { index, drugFiles: resolved, fromCache: false };
}

async function matchRmsProducts(index) {
  matchLogger.info('Matching RMS products…', {
    file: files.rms,
    batchSize: BATCH,
    workers: WORKERS,
    matchCache: processing.useMatchCache && !NO_MATCH_CACHE,
  });

  const matchCache = (processing.useMatchCache && !NO_MATCH_CACHE)
    ? loadFileMatchCache(MATCH_CACHE_PATH)
    : new Map();

  const allMatched = [], allReview = [], allUnmatched = [];
  const allEntries = [];
  let catalogHeaders = [];
  let buffer = [], total = 0;
  let methodStats = {};
  let cacheHits = 0;
  let workersUsed = 0;
  let batchNum = 0;

  const streamResult = await streamProductList(files.rms, RMS_COLUMN_MAP, async ({ raw, mapped, rowNum }) => {
    if (!mapped.name) return;
    const rmsProduct = {
      id: rowNum,
      rms_id: mapped.rms_id || null,
      name: mapped.name,
      manufacturer: mapped.manufacturer,
      mrp: parseFloat(mapped.mrp) || null,
      stock: parseInt(mapped.stock, 10) || 0,
      pack_size: mapped.pack_size,
      barcode: mapped.barcode || null,
      category: mapped.category || null,
    };

    buffer.push({ rmsProduct, raw });

    if (buffer.length >= BATCH) await flush();
  }, {
    maxRows: ROW_LIMIT || undefined,
    onProgress: n => { if (n % 10000 === 0) matchLogger.info(`RMS: processed ${n}…`); },
  });

  catalogHeaders = streamResult.headers;
  await flush();

  async function flush() {
    if (!buffer.length) return;
    const rmsBatch = buffer.map(b => b.rmsProduct);
    const { matched, review, unmatched, stats, cacheHits: hits, workersUsed: wu } = await matchBatchParallel(
      rmsBatch,
      index,
      brandAliases,
      {
        workers: WORKERS,
        cacheMap: matchCache,
        quiet: true,
      }
    );

    updateCacheFromResults(matchCache, [...matched, ...review, ...unmatched]);

    allMatched.push(...matched);
    allReview.push(...review);
    allUnmatched.push(...unmatched);
    cacheHits += hits || 0;
    workersUsed = Math.max(workersUsed, wu || 1);

    const resultById = new Map();
    for (const r of [...matched, ...review, ...unmatched]) {
      resultById.set(r.rms.id, r);
    }
    for (const b of buffer) {
      allEntries.push({
        raw: b.raw,
        headers: catalogHeaders,
        result: resultById.get(b.rmsProduct.id),
      });
    }

    for (const [k, v] of Object.entries(stats.methods || {})) {
      methodStats[k] = (methodStats[k] || 0) + v;
    }
    total += buffer.length;
    batchNum++;
    if (batchNum % 5 === 0 || buffer.length < BATCH) {
      matchLogger.info(`RMS progress: ${total} matched=${allMatched.length} review=${allReview.length}`);
    }
    buffer = [];
  }

  if (processing.useMatchCache && !NO_MATCH_CACHE) {
    saveFileMatchCache(matchCache, MATCH_CACHE_PATH);
  }

  return {
    allMatched,
    allReview,
    allUnmatched,
    allEntries,
    headers: catalogHeaders,
    total,
    methodStats,
    cacheHits,
    workersUsed,
  };
}

async function runMatchFromFiles(options = {}) {
  mkdirSync(output.dir, { recursive: true });
  const perf = createPerformanceTracker();
  if (ROW_LIMIT) matchLogger.info(`RMS row limit active: ${ROW_LIMIT}`);
  lapStart = performance.now();

  const drugFiles = resolveDrugFiles();
  const { index, drugFiles: loadedFiles, fromCache } = await loadDrIndex(drugFiles);
  if (!index.normalized.length) throw new Error('No DR products loaded');
  lap('dr_load_index');
  matchLogger.info(fromCache ? 'DR index loaded from cache' : 'DR index built in memory');

  const doloCheck = validateDoloExample(index, brandAliases);
  matchLogger.info('DOLO 250 SYRUP validation', doloCheck);
  if (!doloCheck.pass) {
    matchLogger.warn('DOLO example did not pass >95% threshold — continuing anyway');
  }

  let {
    allMatched, allReview, allUnmatched, allEntries, total, methodStats,
    cacheHits, workersUsed,
  } = await matchRmsProducts(index);
  lap('rms_match');

  const validation = validateProductCounts({
    matched: allMatched.length,
    review: allReview.length,
    unmatched: allUnmatched.length,
    total,
  });
  matchLogger.info(validation.message);
  if (!validation.ok) {
    throw new Error(validation.message);
  }

  await enrichDescriptions([...allMatched, ...allReview], loadedFiles);
  lap('enrich');

  // Phase 2: build image catalog index (names + URLs by product ID)
  matchLogger.info('Phase 2: image catalog index for cross-reference…');
  const imageIndex = await buildImageIndex(brandAliases);

  // Phase 2b: recover unmatched via image catalog name search → DR Product ID
  if (allUnmatched.length) {
    matchLogger.info(`Image cross-ref pass on ${allUnmatched.length} unmatched…`);
    const { recovered, stillUnmatched } = recoverUnmatchedViaImageCrossRef(
      allUnmatched, index, imageIndex, brandAliases, {
        autoThreshold: 82,
        reviewThreshold: 72,
        minCombined: 58,
        minRawConfidence: 62,
      }
    );
    mergeRecoveryIntoBuckets(recovered, allMatched, allReview, methodStats);
    allUnmatched = stillUnmatched;
    matchLogger.info(`Image cross-ref recovered: ${recovered.length} (auto=${recovered.filter(r => r.status === 'auto_matched').length})`);
    if (recovered.length) {
      await enrichDescriptions(recovered.filter(r => r.dr), loadedFiles);
    }
  }

  // Phase 2c: score > 50% — verify RMS vs top DR via same public/web product image
  if (allUnmatched.length && processing.webImageVerify) {
    matchLogger.info(`Web image verify pass (min score ${processing.webImageMinScore}%)…`);
    const { recovered: webRecovered, stillUnmatched: afterWeb } = await recoverViaWebImageVerify(
      allUnmatched, imageIndex, brandAliases
    );
    for (const r of webRecovered) {
      methodStats[r.method] = (methodStats[r.method] || 0) + 1;
      if (r.status === 'auto_matched') allMatched.push(r);
      else allReview.push(r);
    }
    allUnmatched = afterWeb;
    matchLogger.info(`Web image verified: ${webRecovered.length}`);
    if (webRecovered.length) {
      await enrichDescriptions(webRecovered.filter(r => r.dr), loadedFiles);
    }
  }

  // Phase 3: attach image URLs strictly by matched DR Product ID
  matchLogger.info('Phase 3: attaching image URLs by DR Product ID…');
  const matchedForImages = [...allMatched, ...allReview];
  attachImagesToResults(matchedForImages, imageIndex);
  const imgStats = imageLookupStats(matchedForImages);
  const { noImages: matchedNoImages } = partitionMatchedByImages(matchedForImages);
  matchLogger.info('Image lookup complete', imgStats);
  const resultMap = new Map();
  for (const r of [...allMatched, ...allReview, ...allUnmatched]) {
    resultMap.set(r.rms.id, r);
  }
  for (const entry of allEntries) {
    const id = entry.result?.rms?.id;
    if (id && resultMap.has(id)) entry.result = resultMap.get(id);
  }
  lap('images');

  const perfSnap = perf.snapshot('complete', total);
  const stats = {
    rms_total: total,
    matched: allMatched.length,
    review: allReview.length,
    unmatched: allUnmatched.length,
    match_rate: total ? `${((allMatched.length / total) * 100).toFixed(1)}%` : '0%',
    total,
    methods: methodStats,
    doloValidation: doloCheck,
    cacheHits,
    workersUsed,
    imageCrossRef: methodStats.image_name_crossref || 0,
    webImageVerified: methodStats.web_image_verified || 0,
    images: imgStats,
    matchedNoImages: matchedNoImages.length,
    performance: perfSnap,
  };
  matchLogger.info('Matching complete', stats);

  matchLogger.info('Writing Excel reports…');
  await Promise.all([
    writeEnrichedProductsReport(allEntries, `${output.dir}/enriched_products.xlsx`),
    writeMatchedReport(allMatched, `${output.dir}/matched_products.xlsx`),
    writeReviewReport(allReview, `${output.dir}/review_required.xlsx`),
    writeUnmatchedReport(allUnmatched, `${output.dir}/unmatched_products.xlsx`),
    writeNoImagesReport(matchedNoImages, `${output.dir}/no_images_products.xlsx`),
    writeDebugReport(
      { stats, unmatched: allUnmatched, matched: allMatched, review: allReview },
      `${output.dir}/matching_debug_report.xlsx`
    ),
  ]);
  lap('excel_write');

  const report = {
    total,
    matched: allMatched.length,
    review: allReview.length,
    unmatched: allUnmatched.length,
    matchRate: stats.match_rate,
    validationOk: validation.ok,
    elapsedSec: perfSnap.elapsedSec,
    productsPerSec: perfSnap.productsPerSec,
    cacheHits,
    workers: workersUsed,
    images: imgStats,
    matchedNoImages: matchedNoImages.length,
    memoryMb: perfSnap.memoryMb,
    cpu: perfSnap.cpu,
    cpus: perfSnap.cpus,
    timing: PROFILE ? laps : undefined,
  };

  console.log(formatPerformanceReport(report));
  console.log('\nOutput files:');
  console.log(`  ${output.dir}/enriched_products.xlsx   ← ALL ${total} products`);
  console.log(`  ${output.dir}/matched_products.xlsx`);
  console.log(`  ${output.dir}/review_required.xlsx`);
  console.log(`  ${output.dir}/unmatched_products.xlsx`);
  console.log(`  ${output.dir}/no_images_products.xlsx   ← ${matchedNoImages.length} matched, no image URL for DR ID`);
  console.log(`\nImages (by DR Product ID): ${imgStats.hasImages} with URLs, ${imgStats.noImages} no images, ${imgStats.noProductId} missing ID`);
  if (methodStats.web_image_verified) {
    console.log(`Web image confirmed:  ${methodStats.web_image_verified} (score>50 + same product image)`);
  }
  console.log(`\nDOLO test: ${doloCheck.pass ? 'PASS' : 'FAIL'} (${doloCheck.confidence}% → ${doloCheck.matchedTo || 'none'})`);
  console.log(`DR index: ${index.normalized.length} products (${fromCache ? 'cached' : 'fresh build'})`);

  return {
    total,
    allMatched,
    allReview,
    allUnmatched,
    allEntries,
    index,
    loadedFiles,
    imageIndex,
    methodStats,
    stats,
    report,
    validation,
  };
}

export { runMatchFromFiles };

const __filename = fileURLToPath(import.meta.url);
const isMain = process.argv[1] && resolve(process.argv[1]) === __filename;

if (isMain) {
  runMatchFromFiles().catch(err => {
    logger.error('File matching failed', { err: err.message, stack: err.stack });
    process.exit(1);
  });
}
