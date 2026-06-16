/**
 * Test web image verification for score > 50 unmatched with shared catalog image.
 * Run: node src/scripts/testWebImageVerify.js
 */
import { buildIndex, matchProduct } from '../matcher/engine.js';
import { parseProduct } from '../parser/productParser.js';
import { brandAliases } from '../config/index.js';
import { buildImageIndex } from '../matcher/imageIndex.js';
import { verifyProductPairImages, recoverViaWebImageVerify } from '../matcher/webImageVerify.js';

const dr = {
  id: 1,
  name: 'Parachute 100 % Pure Coconut Oil',
  manufacturer: 'Marico Ltd',
  pack_size: '100 ml',
  barcode: 'DR334910',
};

const rms = {
  name: 'PARACHUTE COCONUT OIL 100ML',
  manufacturer: 'MARICO INDUSTRIES LTD',
  pack_size: '100ML',
};

const index = buildIndex([dr], brandAliases);
const imageIndex = await buildImageIndex(brandAliases);

const m = matchProduct(rms, index, brandAliases);
console.log('Data match:', m.status, m.confidence);

if (m.status !== 'auto_matched') {
  const fakeUnmatched = [{
    rms,
    dr: null,
    confidence: m.confidence || 55,
    status: 'rejected',
    suggestions: [{ dr, confidence: 72 }],
    parsed: parseProduct(rms, brandAliases),
  }];

  const verify = await verifyProductPairImages(rms, dr, fakeUnmatched[0].parsed, imageIndex, { webSearch: false });
  console.log('Image verify:', verify);

  const { recovered } = await recoverViaWebImageVerify(fakeUnmatched, imageIndex, brandAliases);
  console.log('Recovered:', recovered.length, recovered[0]?.method, recovered[0]?.dr?.barcode);

  if (!recovered.length || !verify.verified) {
    console.error('FAIL');
    process.exit(1);
  }
}

console.log('PASS');
process.exit(0);
