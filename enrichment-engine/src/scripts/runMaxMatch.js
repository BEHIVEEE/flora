/**
 * runMaxMatch.js — full cascade to maximize match rate (~60% target).
 *
 * Pass 1: strict text match + image cross-ref + web verify
 * Pass 2–4: progressively lenient thresholds + recovery on each pass
 *
 * Usage: npm run match:max
 *        npm run match:max -- --no-match-cache
 */
import 'dotenv/config';
import { mkdirSync, existsSync, unlinkSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { detectInputFiles } from '../utils/fileDetect.js';
import { runMatchPass } from './matchUnmatched.js';
import {
  writeEnrichedProductsReport,
  writeMatchedReport,
  writeReviewReport,
  writeUnmatchedReport,
  writeNoImagesReport,
  writeDebugReport,
} from '../reporter/excelWriter.js';
import { attachImagesToResults, partitionMatchedByImages, imageLookupStats } from '../matcher/imageIndex.js';
import { output } from '../config/index.js';
import { DEFAULT_FILE as MATCH_CACHE_PATH } from '../matcher/matchCache.js';
import { salvageViaTopSuggestions } from '../matcher/recoveryPasses.js';
import logger, { matchLogger } from '../logger/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENGINE_ROOT = resolve(__dirname, '../..');

function setupDataPaths() {
  const inputDir = process.env.INPUT_DIR || resolve(ENGINE_ROOT, 'data/input');
  mkdirSync(inputDir, { recursive: true });
  mkdirSync(resolve(ENGINE_ROOT, 'data/output'), { recursive: true });

  const detected = detectInputFiles(inputDir);

  if (!detected.rms) {
    for (const p of [process.env.RMS_FILE, resolve(ENGINE_ROOT, '../data/ProductList.csv')]) {
      if (p && existsSync(resolve(p))) { detected.rms = resolve(p); break; }
    }
  }

  if (!detected.drugs.length) {
    const drugPaths = [
      process.env.DRUGS_FILE,
      resolve(ENGINE_ROOT, '../data/June_2026_DRUGS_DATA_PART_1.csv'),
      resolve(ENGINE_ROOT, '../data/June 2026 DRUGS DATA PART 2 of 2.xlsx'),
    ].filter(p => p && existsSync(resolve(p))).map(p => resolve(p));
    const otc = resolve(ENGINE_ROOT, '../June 2026 OTC DATA PART 1 of 1.xlsx');
    if (existsSync(otc)) drugPaths.push(otc);
    detected.drugs = [...new Set(drugPaths)];
  }

  if (!detected.images.length) {
    const imgPaths = [
      process.env.IMAGES_FILE,
      resolve(ENGINE_ROOT, '../data/June_2026_DRUGS_IMAGE_URLS.csv'),
    ].filter(p => p && existsSync(resolve(p))).map(p => resolve(p));
    const otcImg = resolve(ENGINE_ROOT, '../June 2026 OTC IMAGE URLS.xlsx');
    if (existsSync(otcImg)) imgPaths.push(otcImg);
    detected.images = [...new Set(imgPaths)];
  }

  if (!detected.rms) throw new Error('ProductList not found — set RMS_FILE or place in data/input/');

  process.env.RMS_FILE = detected.rms;
  process.env.DRUGS_FILE = detected.drugs[0] || '';
  process.env.DRUGS_FILE_2 = detected.drugs[1] || '';
  process.env.DRUGS_FILE_3 = detected.drugs[2] || '';
  process.env.IMAGES_FILE = detected.images[0] || '';
  process.env.IMAGES_FILE_2 = detected.images[1] || '';
  process.env.OUTPUT_DIR = process.env.OUTPUT_DIR || resolve(ENGINE_ROOT, 'data/output');
  process.env.WEB_IMAGE_VERIFY = process.env.WEB_IMAGE_VERIFY ?? 'true';
  process.env.WEB_IMAGE_MIN_SCORE = process.env.WEB_IMAGE_MIN_SCORE ?? '42';

  return detected;
}

function mergePassIntoState(state, passResult) {
  const byId = new Map();
  for (const r of [...state.allMatched, ...state.allReview, ...state.allUnmatched]) {
    byId.set(r.rms.id, r);
  }
  for (const r of [...passResult.allMatched, ...passResult.allReview]) {
    byId.set(r.rms.id, r);
  }

  state.allMatched.push(...passResult.allMatched);
  state.allReview.push(...passResult.allReview);
  state.allUnmatched = passResult.allStillUnmatched;

  for (const entry of state.allEntries) {
    const id = entry.result?.rms?.id;
    if (id && byId.has(id)) entry.result = byId.get(id);
  }

  for (const [k, v] of Object.entries(passResult.methodStats || {})) {
    state.methodStats[k] = (state.methodStats[k] || 0) + v;
  }
}

async function writeFinalReports(state) {
  const outDir = output.dir;
  const matchedForImages = [...state.allMatched, ...state.allReview];
  if (state.imageIndex) {
    attachImagesToResults(matchedForImages, state.imageIndex);
  }
  const imgStats = imageLookupStats(matchedForImages);
  const { noImages: matchedNoImages } = partitionMatchedByImages(matchedForImages);

  const combined = state.allMatched.length + state.allReview.length;
  const combinedRate = state.total ? ((combined / state.total) * 100).toFixed(1) : '0';
  const autoRate = state.total ? ((state.allMatched.length / state.total) * 100).toFixed(1) : '0';

  const stats = {
    rms_total: state.total,
    matched: state.allMatched.length,
    review: state.allReview.length,
    unmatched: state.allUnmatched.length,
    combined_matched: combined,
    combined_rate: `${combinedRate}%`,
    auto_rate: `${autoRate}%`,
    total: state.total,
    methods: state.methodStats,
    images: imgStats,
    matchedNoImages: matchedNoImages.length,
  };

  await Promise.all([
    writeEnrichedProductsReport(state.allEntries, `${outDir}/enriched_products.xlsx`),
    writeMatchedReport(state.allMatched, `${outDir}/matched_products.xlsx`),
    writeReviewReport(state.allReview, `${outDir}/review_required.xlsx`),
    writeUnmatchedReport(state.allUnmatched, `${outDir}/still_unmatched_final.xlsx`),
    writeNoImagesReport(matchedNoImages, `${outDir}/no_images_products.xlsx`),
    writeDebugReport(
      { stats, unmatched: state.allUnmatched, matched: state.allMatched, review: state.allReview },
      `${outDir}/matching_debug_report.xlsx`
    ),
  ]);

  return { stats, combinedRate, autoRate, matchedNoImages: matchedNoImages.length };
}

async function main() {
  const t0 = Date.now();
  const freshMatch = process.argv.includes('--no-match-cache');
  if (freshMatch) {
    process.env.USE_MATCH_CACHE = 'false';
    try { if (existsSync(MATCH_CACHE_PATH)) unlinkSync(MATCH_CACHE_PATH); } catch { /* ignore */ }
    console.log('Fresh match mode: recomputing all 26k matches (DR index cache reused)\n');
  }

  const detected = setupDataPaths();

  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║  MAX MATCH PIPELINE — target ~60% combined       ║');
  console.log('╚══════════════════════════════════════════════════╝\n');
  console.log('Product List: ', detected.rms);
  console.log('Medicine DB:  ', detected.drugs.join('\n              '));
  console.log('Image URLs:   ', detected.images.join('\n              ') || '(none)');
  console.log('Output:       ', process.env.OUTPUT_DIR);
  console.log('');

  console.log('── Pass 1: primary match + image cross-ref + web verify ──\n');
  const { runMatchFromFiles } = await import('./matchFromFiles.js');
  const pass1 = await runMatchFromFiles();

  const state = {
    total: pass1.total,
    allMatched: [...pass1.allMatched],
    allReview: [...pass1.allReview],
    allUnmatched: [...pass1.allUnmatched],
    allEntries: pass1.allEntries,
    imageIndex: pass1.imageIndex,
    methodStats: { ...pass1.methodStats },
  };

  const passInputs = {
    2: resolve(`${output.dir}/unmatched_products.xlsx`),
    3: resolve(`${output.dir}/still_unmatched.xlsx`),
    4: resolve(`${output.dir}/still_unmatched_pass3.xlsx`),
  };

  for (const passNum of [2, 3, 4]) {
    const combined = state.allMatched.length + state.allReview.length;
    const rate = state.total ? (combined / state.total) * 100 : 0;
    if (rate >= 60) {
      matchLogger.info(`Skipping pass ${passNum} — combined rate ${rate.toFixed(1)}% already ≥ 60%`);
      continue;
    }

    const input = passInputs[passNum];
    if (!existsSync(input)) {
      matchLogger.warn(`Pass ${passNum} skipped — input not found: ${input}`);
      continue;
    }

    console.log(`\n── Pass ${passNum}: lenient thresholds + recovery ──\n`);
    const passResult = await runMatchPass({ pass: passNum, input, merge: false });
    mergePassIntoState(state, passResult);

    const combined = state.allMatched.length + state.allReview.length;
    const rate = state.total ? ((combined / state.total) * 100).toFixed(1) : '0';
    console.log(`\nCumulative after pass ${passNum}: auto=${state.allMatched.length} review=${state.allReview.length} combined=${combined} (${rate}%)`);
  }

  // Salvage pass: unmatched with top suggestion ≥50% → review (pushes toward 60% target)
  if (state.allUnmatched.length) {
    console.log('\n── Salvage pass: promote strong suggestions to review ──\n');
    const { recovered, stillUnmatched } = salvageViaTopSuggestions(state.allUnmatched, 50);
    mergeRecoveryIntoBuckets(recovered, state.allMatched, state.allReview, state.methodStats);
    state.allUnmatched = stillUnmatched;
    const combined = state.allMatched.length + state.allReview.length;
    const rate = state.total ? ((combined / state.total) * 100).toFixed(1) : '0';
    console.log(`After salvage: combined=${combined} (${rate}%)`);
  }

  console.log('\n── Writing consolidated final reports ──\n');
  const { stats, combinedRate, autoRate } = await writeFinalReports(state);

  const elapsedMin = ((Date.now() - t0) / 60000).toFixed(1);

  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║           MAX MATCH PIPELINE COMPLETE            ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log(`Total products:      ${state.total.toLocaleString()}`);
  console.log(`Auto-matched:        ${state.allMatched.length.toLocaleString()} (${autoRate}%)`);
  console.log(`Review required:     ${state.allReview.length.toLocaleString()}`);
  console.log(`Combined matched:    ${(state.allMatched.length + state.allReview.length).toLocaleString()} (${combinedRate}%)`);
  console.log(`Still unmatched:     ${state.allUnmatched.length.toLocaleString()}`);
  console.log(`Elapsed:             ${elapsedMin} min`);
  console.log('\nFinal outputs:');
  console.log(`  ${output.dir}/enriched_products.xlsx`);
  console.log(`  ${output.dir}/matched_products.xlsx`);
  console.log(`  ${output.dir}/review_required.xlsx`);
  console.log(`  ${output.dir}/still_unmatched_final.xlsx`);

  const target = 60;
  const combinedNum = parseFloat(combinedRate);
  if (combinedNum >= target) {
    console.log(`\n✓ Target reached: ${combinedRate}% ≥ ${target}%`);
  } else {
    console.log(`\n→ Combined rate ${combinedRate}% — approve review_required.xlsx rows to reach ${target}%`);
    const needed = Math.ceil(state.total * target / 100) - state.allMatched.length - state.allReview.length;
    if (needed > 0) {
      console.log(`  Approving ~${needed} review rows would reach ${target}% combined.`);
    }
  }

  return stats;
}

main().catch(err => {
  logger.error('Max match pipeline failed', { err: err.message, stack: err.stack });
  process.exit(1);
});
