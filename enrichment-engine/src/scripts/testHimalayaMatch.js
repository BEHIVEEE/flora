/**
 * Himalaya OTC matching: Gasex, Cystone, Liv 52, ZZZZ prefix.
 * Run: node src/scripts/testHimalayaMatch.js
 */
import { buildIndex, matchProduct } from '../matcher/engine.js';
import { parseProduct } from '../parser/productParser.js';
import { brandAliases } from '../config/index.js';

const drProducts = [
  { id: 1, name: 'Himalaya Gasex Tablet', manufacturer: 'Himalaya Wellness Company', pack_size: 'strip of 100 tablets' },
  { id: 2, name: 'Himalaya Cystone Forte Tablet', manufacturer: 'Himalaya Wellness Company', pack_size: 'strip of 60 tablets' },
  { id: 3, name: 'Himalaya Liv.52 Tablet', manufacturer: 'Himalaya Wellness Company', pack_size: 'strip of 100 tablets' },
];

const rmsCases = [
  { name: 'GASEX TAB', manufacturer: 'HIMALAYA DRUG COMPANY', pack_size: '100 s', expectDr: 'Himalaya Gasex Tablet' },
  { name: 'CYSTONE TAB', manufacturer: 'HIMALAYA DRUG COMPANY', pack_size: '60 s', expectDr: 'Himalaya Cystone Forte Tablet' },
  { name: 'ZZZZLIV 52 TAB [B]', manufacturer: 'HIMALAYA DRUG COMPANY', pack_size: '100 s', expectDr: 'Himalaya Liv.52 Tablet' },
  { name: 'LIV 52 TAB', manufacturer: 'HIMALAYA DRUG COMPANY', pack_size: '100', expectDr: 'Himalaya Liv.52 Tablet' },
];

const index = buildIndex(drProducts, brandAliases);
let failed = 0;

for (const rms of rmsCases) {
  const parsed = parseProduct(rms, brandAliases);
  const result = matchProduct(rms, index, brandAliases);
  const pass2 = matchProduct(rms, index, brandAliases, null, { secondPass: true });
  const pass3 = matchProduct(rms, index, brandAliases, null, { thirdPass: true });

  const best = result.status === 'auto_matched' ? result : (pass2.status !== 'rejected' ? pass2 : pass3);
  const ok = best.dr?.name === rms.expectDr && best.confidence >= 85;

  console.log(`\n${rms.name}`);
  console.log('  parsed brand:', parsed.brand, '| core:', parsed.coreTokens.join(' '));
  console.log('  pass1:', result.confidence, result.status, result.dr?.name || '-');
  console.log('  pass2:', pass2.confidence, pass2.status, pass2.dr?.name || '-');
  console.log('  pass3:', pass3.confidence, pass3.status, pass3.dr?.name || '-');

  if (!ok) {
    console.error(`  FAIL: expected ${rms.expectDr} at >=85%`);
    failed++;
  } else {
    console.log(`  PASS: matched ${best.dr.name} at ${best.confidence}%`);
  }
}

if (failed) {
  console.error(`\n${failed} case(s) failed`);
  process.exit(1);
}
console.log('\nAll Himalaya cases passed');
process.exit(0);
