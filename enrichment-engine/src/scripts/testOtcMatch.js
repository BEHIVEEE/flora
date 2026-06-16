/**
 * Test Parachute + Vicco OTC matching and image cross-ref.
 * Run: node src/scripts/testOtcMatch.js
 */
import { buildIndex, matchProduct } from '../matcher/engine.js';
import { parseProduct } from '../parser/productParser.js';
import { brandAliases } from '../config/index.js';
import { buildImageIndex } from '../matcher/imageIndex.js';
import { matchByImageCrossRef } from '../matcher/imageCrossRef.js';

const drProducts = [
  { id: 1, name: 'Parachute 100 % Pure Coconut Oil', manufacturer: 'Marico Ltd', pack_size: '100 ml', barcode: 'DR334910' },
  { id: 2, name: 'Vicco Vajradanti Ayurvedic Medicine for Healthy Gums and Teeth | Regular', manufacturer: 'Vicco Laboratories', pack_size: '100 gm', barcode: 'DR280438' },
  { id: 3, name: 'Vicco Vajradanti Tooth Powder | For Healthy Teeth & Gums', manufacturer: 'Vicco Laboratories', pack_size: '50 gm', barcode: 'DR280444' },
];

const rmsCases = [
  { name: 'PARACHUTE COCONUT OIL 100ML', manufacturer: 'MARICO INDUSTRIES LTD', pack_size: '100ML', expectId: 'DR334910' },
  { name: 'VICCO VAJRADANTI PASTE 50GM', manufacturer: 'VICCO LABORATORIES', pack_size: '', expectId: 'DR280444' },
];

const index = buildIndex(drProducts, brandAliases);
console.log('Loading image index (may take ~15s)…');
const imageIndex = await buildImageIndex(brandAliases);

let failed = 0;
for (const rms of rmsCases) {
  const rmsParsed = parseProduct(rms, brandAliases);
  const m = matchProduct(rms, index, brandAliases);
  let result = m;
  if (m.status === 'rejected') {
    result = matchByImageCrossRef(rms, rmsParsed, index, imageIndex, brandAliases) || m;
  }
  const ok = result.dr?.barcode === rms.expectId && result.confidence >= 75;
  console.log(`\n${rms.name}`);
  console.log('  parsed:', { brand: rmsParsed.brand, pack: rmsParsed.packSize, core: rmsParsed.coreTokens });
  console.log('  data match:', m.status, m.confidence, m.dr?.barcode || '-');
  console.log('  final:', result.method, result.confidence, result.dr?.barcode, result.dr?.name?.slice(0, 50));
  if (!ok) { console.error('  FAIL'); failed++; }
  else console.log('  PASS');
}

if (failed) process.exit(1);
console.log('\nAll OTC cases passed');
process.exit(0);
