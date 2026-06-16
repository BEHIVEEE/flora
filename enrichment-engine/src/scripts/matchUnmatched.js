/**
 * matchUnmatched.js — second/third/fourth-pass matching + recovery passes.
 *
 * Usage:
 *   node src/scripts/matchUnmatched.js
 *   node src/scripts/matchUnmatched.js --pass3
 *   node src/scripts/matchUnmatched.js --pass4
 *   node src/scripts/matchUnmatched.js --pass4 --merge
 */
import 'dotenv/config';
import { mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { performance } from 'perf_hooks';
import { streamDataFile } from '../reader/csvReader.js';
import { DRUGS_COLUMN_MAP, DRUGS_MATCH_COLUMN_MAP, IMAGES_COLUMN_MAP } from '../reader/columnMaps.js';
import {
  createIndexBuilder,
  addProductToIndex,
  finalizeIndex,
  matchBatch,
} from '../matcher/engine.js';
import {
  loadIndexCache,
  indexCacheIsFresh,
  DEFAULT_CACHE as INDEX_CACHE_PATH,
} from '../matcher/indexCache.js';
import {
  writeMatchedReport,
  writeReviewReport,
  writeUnmatchedReport,
  readUnmatchedReport,
  appendSecondPassSheet,
  appendThirdPassSheet,
  writeNoImagesReport,
} from '../reporter/excelWriter.js';
import { normalizeName } from '../normalizer/index.js';
import { buildImageIndex, attachImagesToResults, partitionMatchedByImages } from '../matcher/imageIndex.js';
import { runRecoveryPasses, mergeRecoveryIntoBuckets } from '../matcher/recoveryPasses.js';
import { files, output, brandAliases, processing, matchingPass2, matchingPass3, matchingPass4 } from '../config/index.js';
import logger, { matchLogger } from '../logger/index.js';

const BATCH = processing.batchSize;

function resolvePassFromArgv(argv = process.argv) {
  if (argv.includes('--pass4')) return 4;
  if (argv.includes('--pass3')) return 3;
  return 2;
}

function buildMatchOptions(passNum) {
  if (passNum === 4) {
    return {
      fourthPass: true,
      thirdPass: true,
      autoThreshold: matchingPass4.autoThreshold,
      reviewThreshold: matchingPass4.reviewThreshold,
      quiet: true,
    };
  }
  if (passNum === 3) {
    return {
      thirdPass: true,
      autoThreshold: matchingPass3.autoThreshold,
      reviewThreshold: matchingPass3.reviewThreshold,
      quiet: true,
    };
  }
  return {
    secondPass: true,
    autoThreshold: matchingPass2.autoThreshold,
    reviewThreshold: matchingPass2.reviewThreshold,
    quiet: true,
  };
}

function defaultInputForPass(passNum) {
  if (passNum === 4) return resolve(`${output.dir}/still_unmatched_pass3.xlsx`);
  if (passNum === 3) return resolve(`${output.dir}/still_unmatched.xlsx`);
  return resolve(`${output.dir}/unmatched_products.xlsx`);
}

function outputPaths(passNum, outDir = output.dir) {
  if (passNum === 4) {
    return {
      newlyMatched: `${outDir}/pass4_matched.xlsx`,
      newlyReview: `${outDir}/pass4_review.xlsx`,
      stillUnmatched: `${outDir}/still_unmatched_pass4.xlsx`,
      noImages: `${outDir}/pass4_no_images_products.xlsx`,
    };
  }
  if (passNum === 3) {
    return {
      newlyMatched: `${outDir}/pass3_matched.xlsx`,
      newlyReview: `${outDir}/pass3_review.xlsx`,
      stillUnmatched: `${outDir}/still_unmatched_pass3.xlsx`,
      noImages: `${outDir}/pass3_no_images_products.xlsx`,
    };
  }
  return {
    newlyMatched: `${outDir}/newly_matched_products.xlsx`,
    newlyReview: `${outDir}/newly_review_required.xlsx`,
    stillUnmatched: `${outDir}/still_unmatched.xlsx`,
    noImages: `${outDir}/no_images_products.xlsx`,
  };
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
  return paths.filter(p => p && existsSync(resolve(p)));
}

function collectDrBarcodes(results) {
  const barcodes = new Set();
  for (const r of results) {
    if (r.dr?.barcode) barcodes.add(String(r.dr.barcode).trim());
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
  }
}

async function buildImageBarcodeMap(index) {
  const map = new Map();
  const imagePaths = [files.images];
  if (files.images2) imagePaths.push(files.images2);
  else {
    const otc = resolve('../June 2026 OTC IMAGE URLS.xlsx');
    if (existsSync(otc)) imagePaths.push(otc);
  }

  for (const f of imagePaths.filter(p => p && existsSync(resolve(p)))) {
    await streamDataFile(f, IMAGES_COLUMN_MAP, async (row) => {
      const pid = row.product_id ? String(row.product_id).trim() : '';
      if (!pid || map.has(pid)) return;
      const dr = index.barcodeMap.get(pid);
      if (dr) map.set(pid, dr);
    });
  }

  matchLogger.info(`Image barcode fallback map: ${map.size} product IDs linked to DR catalog`);
  return map;
}

async function loadDrIndex() {
  const drugFiles = resolveDrugFiles();
  if (!drugFiles.length) throw new Error(`No DR product files found (DRUGS_FILE=${files.drugs})`);

  const resolved = drugFiles.map(p => resolve(p));
  if (processing.useIndexCache && indexCacheIsFresh(INDEX_CACHE_PATH, resolved)) {
    const cached = await loadIndexCache(INDEX_CACHE_PATH, brandAliases);
    if (cached) {
      matchLogger.info('DR index loaded from cache (pass 2/3/4)');
      return { index: cached, drugFiles: resolved, productCount: cached.normalized.length };
    }
  }

  const builder = createIndexBuilder(brandAliases);
  let nextId = 1;
  for (const f of drugFiles) {
    matchLogger.info('Loading DR catalog…', { file: f });
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
      });
    }, {
      onProgress: n => { if (n % 50000 === 0) matchLogger.info(`DR: loaded ${n} from ${f}…`); },
    });
  }

  matchLogger.info(`DR products loaded: ${builder.productCount} from ${drugFiles.length} file(s)`);
  return { index: finalizeIndex(builder), drugFiles: resolved, productCount: builder.productCount };
}

async function matchUnmatchedBatch(unmatchedProducts, index, matchOptions) {
  const allMatched = [], allReview = [], allStillUnmatched = [];
  let buffer = [], total = 0;
  let batchStats = { methods: {} };
  let batchNum = 0;
  const passLabel = matchOptions.fourthPass ? 'Pass-4' : (matchOptions.thirdPass ? 'Pass-3' : 'Pass-2');

  async function flush() {
    if (!buffer.length) return;
    const { matched, review, unmatched, stats } = matchBatch(buffer, index, brandAliases, matchOptions);
    allMatched.push(...matched);
    allReview.push(...review);
    allStillUnmatched.push(...unmatched);
    for (const [k, v] of Object.entries(stats.methods || {})) {
      batchStats.methods[k] = (batchStats.methods[k] || 0) + v;
    }
    total += buffer.length;
    batchNum++;
    if (batchNum % 5 === 0 || buffer.length < BATCH) {
      matchLogger.info(`${passLabel} progress: ${total} matched=${allMatched.length} review=${allReview.length} still_unmatched=${allStillUnmatched.length}`);
    }
    buffer = [];
  }

  for (const product of unmatchedProducts) {
    buffer.push(product);
    if (buffer.length >= BATCH) await flush();
  }
  await flush();

  return { allMatched, allReview, allStillUnmatched, total, methodStats: batchStats.methods };
}

/**
 * Run a recovery pass (2, 3, or 4) on an unmatched workbook.
 * @returns {{ matched, review, stillUnmatched, allMatched, allReview, methodStats, paths }}
 */
export async function runMatchPass(options = {}) {
  const passNum = options.pass ?? 2;
  const inputFile = options.input ?? defaultInputForPass(passNum);
  const rowLimit = options.rowLimit ?? 0;
  const merge = options.merge ?? false;
  const skipRecovery = options.skipRecovery === true;

  if (!existsSync(inputFile)) {
    throw new Error(`Unmatched file not found: ${inputFile}`);
  }

  mkdirSync(output.dir, { recursive: true });
  const t0 = performance.now();
  const passNames = { 2: 'Second', 3: 'Third', 4: 'Fourth' };
  const passLabel = `${passNames[passNum] || 'Second'}-pass`;
  const MATCH_OPTIONS = buildMatchOptions(passNum);

  matchLogger.info(`${passLabel} matching`, {
    input: inputFile,
    autoThreshold: MATCH_OPTIONS.autoThreshold,
    reviewThreshold: MATCH_OPTIONS.reviewThreshold,
    rowLimit: rowLimit || 'none',
  });

  let unmatchedProducts = await readUnmatchedReport(inputFile);
  const inputCount = unmatchedProducts.length;
  if (rowLimit) unmatchedProducts = unmatchedProducts.slice(0, rowLimit);
  matchLogger.info(`Loaded ${unmatchedProducts.length} unmatched RMS products`);

  const { index, drugFiles, productCount } = await loadDrIndex();

  if (passNum >= 3) {
    MATCH_OPTIONS.imageBarcodeMap = await buildImageBarcodeMap(index);
  }

  let { allMatched, allReview, allStillUnmatched, total, methodStats } =
    await matchUnmatchedBatch(unmatchedProducts, index, MATCH_OPTIONS);

  const imageIndex = await buildImageIndex(brandAliases);

  if (!skipRecovery && allStillUnmatched.length) {
    const { recovered, stillUnmatched, imageCrossRef, webImageVerified } = await runRecoveryPasses(
      allStillUnmatched, index, imageIndex, brandAliases, { aggressive: true }
    );
    mergeRecoveryIntoBuckets(recovered, allMatched, allReview, methodStats);
    allStillUnmatched = stillUnmatched;
    matchLogger.info('Recovery passes complete', { imageCrossRef, webImageVerified, totalRecovered: recovered.length });
  }

  await enrichDescriptions([...allMatched, ...allReview], drugFiles);

  const matchedForImages = [...allMatched, ...allReview];
  attachImagesToResults(matchedForImages, imageIndex);
  const { noImages: matchedNoImages } = partitionMatchedByImages(matchedForImages);

  const paths = outputPaths(passNum);
  const usePass3Cols = passNum >= 3;

  matchLogger.info(`Writing ${passLabel.toLowerCase()} reports…`);
  await Promise.all([
    writeMatchedReport(allMatched, paths.newlyMatched, { pass3: usePass3Cols }),
    writeReviewReport(allReview, paths.newlyReview, { pass3: usePass3Cols }),
    writeUnmatchedReport(allStillUnmatched, paths.stillUnmatched),
    writeNoImagesReport(matchedNoImages, paths.noImages),
  ]);

  if (merge && allMatched.length) {
    if (passNum >= 3) {
      await appendThirdPassSheet(`${output.dir}/matched_products.xlsx`, allMatched, `Pass ${passNum} Matches`);
    } else {
      await appendSecondPassSheet(`${output.dir}/matched_products.xlsx`, allMatched);
    }
  }

  const elapsed = ((performance.now() - t0) / 1000).toFixed(1);
  const recoveryRate = total ? ((allMatched.length / total) * 100).toFixed(1) : '0';
  const reviewRate = total ? ((allReview.length / total) * 100).toFixed(1) : '0';
  const combinedRate = total ? (((allMatched.length + allReview.length) / total) * 100).toFixed(1) : '0';
  const lowConfCount = allMatched.filter(r => r.lowConfidence).length;

  console.log(`\n=== ${passLabel.toUpperCase()} MATCH SUMMARY ===`);
  console.log(`DR catalog size:     ${productCount.toLocaleString()}`);
  console.log(`Input unmatched:     ${total} (from ${inputCount.toLocaleString()} total still-unmatched)`);
  console.log(`Newly auto-matched:  ${allMatched.length} (${recoveryRate}%)`);
  console.log(`Newly review:        ${allReview.length} (${reviewRate}%)`);
  console.log(`Combined recovery:   ${allMatched.length + allReview.length} (${combinedRate}%)`);
  console.log(`Still unmatched:     ${allStillUnmatched.length}`);
  if (passNum >= 3) console.log(`Low-confidence auto: ${lowConfCount} (flagged in output)`);
  console.log(`Thresholds:          auto≥${MATCH_OPTIONS.autoThreshold}%  review≥${MATCH_OPTIONS.reviewThreshold}%`);
  console.log(`Methods:             ${JSON.stringify(methodStats)}`);
  console.log(`Elapsed:             ${elapsed}s`);
  console.log('\nOutput files:');
  console.log(`  ${paths.newlyMatched}`);
  console.log(`  ${paths.newlyReview}`);
  console.log(`  ${paths.stillUnmatched}`);

  return {
    pass: passNum,
    inputCount,
    total,
    matched: allMatched.length,
    review: allReview.length,
    combined: allMatched.length + allReview.length,
    stillUnmatched: allStillUnmatched.length,
    allMatched,
    allReview,
    allStillUnmatched,
    productCount,
    methodStats,
    paths,
    elapsedSec: Number(elapsed),
  };
}

const __filename = fileURLToPath(import.meta.url);
const isMain = process.argv[1] && resolve(process.argv[1]) === __filename;

if (isMain) {
  const passNum = resolvePassFromArgv();
  const inputArg = process.argv.find(a => a.startsWith('--input'));
  const inputFile = inputArg
    ? resolve(inputArg.split('=')[1] ?? process.argv[process.argv.indexOf('--input') + 1])
    : defaultInputForPass(passNum);
  const limitArg = process.argv.find(a => a.startsWith('--limit'));
  const rowLimit = limitArg
    ? Number(limitArg.split('=')[1] ?? process.argv[process.argv.indexOf('--limit') + 1])
    : 0;

  runMatchPass({
    pass: passNum,
    input: inputFile,
    rowLimit,
    merge: process.argv.includes('--merge'),
  }).catch(err => {
    logger.error(`Pass-${passNum} matching failed`, { err: err.message, stack: err.stack });
    process.exit(1);
  });
}
