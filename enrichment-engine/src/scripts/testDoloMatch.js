/**
 * Quick unit test for DOLO 250 SYRUP → Dolo 250 Oral Suspension matching.
 * Run: node src/scripts/testDoloMatch.js
 */
import { buildIndex, matchProduct, computeCompositeScore } from '../matcher/engine.js';
import { parseProduct } from '../parser/productParser.js';
import { brandAliases } from '../config/index.js';

const drProducts = [{
  id: 1,
  name: 'Dolo 250 Oral Suspension',
  manufacturer: 'Micro Labs Ltd',
  pack_size: 'bottle of 60 ml',
  barcode: null,
}];

const rmsProduct = {
  name: 'DOLO 250 SYRUP',
  manufacturer: 'Micro Labs Limited',
  pack_size: '60ML',
};

const index = buildIndex(drProducts, brandAliases);
const result = matchProduct(rmsProduct, index, brandAliases);
const rmsParsed = parseProduct(rmsProduct, brandAliases);
const drParsed = parseProduct(drProducts[0], brandAliases);
const score = computeCompositeScore(rmsParsed, drParsed);

console.log('RMS parsed:', rmsParsed);
console.log('DR parsed:', drParsed);
console.log('Composite score:', score);
console.log('Match result:', {
  confidence: result.confidence,
  method: result.method,
  status: result.status,
  matchedTo: result.dr?.name,
});

if (result.confidence < 95) {
  console.error(`\nFAIL: confidence ${result.confidence}% < 95%`);
  process.exit(1);
}
console.log('\nPASS: DOLO 250 SYRUP matches at >95%');
process.exit(0);
