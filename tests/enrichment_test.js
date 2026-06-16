import { normalizeName, normalizeBrand, normalizePackSize, computeMatchScore, fuzzyMatchProduct } from '../lib/enrichment/matcher.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
  console.log(`[PASS] ${message}`);
}

function runTests() {
  console.log("=== STARTING PRODUCT ENRICHMENT TESTS ===\n");

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 1: Name Normalization
  // ─────────────────────────────────────────────────────────────────────────
  console.log("--- Test 1: Name Normalization ---");
  
  assert(
    normalizeName("CEFTUM 250MG TAB") === "ceftum 250mg",
    "Should strip stop-word 'TAB' and convert to lowercase"
  );
  
  assert(
    normalizeName("ATORVASTATIN 10 MG TABLET") === "atorvastatin 10 mg",
    "Should strip stop-word 'TABLET'"
  );
  
  assert(
    normalizeName("DOLO 650MG CAPSULES") === "dolo 650mg",
    "Should strip stop-word 'CAPSULES'"
  );
  
  assert(
    normalizeName("BETADINE OINTMENT 15G") === "betadine 15g",
    "Should strip stop-word 'OINTMENT'"
  );

  assert(
    normalizeName("Ascoril LS Syrup 100ml") === "ascoril ls 100ml",
    "Should strip multiple stop-words 'syrup' and keep volume"
  );

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 2: Brand Alias Resolution
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n--- Test 2: Brand Alias Resolution ---");
  
  assert(
    normalizeBrand("MML") === "minimalist",
    "Should map 'mml' alias to 'minimalist'"
  );
  
  assert(
    normalizeBrand("ME") === "mamaearth",
    "Should map 'me' alias to 'mamaearth'"
  );
  
  assert(
    normalizeBrand("H") === "himalaya",
    "Should map 'h' alias to 'himalaya'"
  );
  
  assert(
    normalizeBrand("HIM") === "himalaya",
    "Should map 'him' alias to 'himalaya'"
  );

  assert(
    normalizeBrand("HM") === "himalaya",
    "Should map 'hm' alias to 'himalaya'"
  );

  assert(
    normalizeBrand("Cipla Ltd") === "cipla",
    "Should strip common suffix 'ltd'"
  );

  assert(
    normalizeBrand("Glenmark Pharmaceuticals") === "glenmark",
    "Should strip 'pharmaceuticals' suffix"
  );

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 3: Pack Size Parsing
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n--- Test 3: Pack Size Parsing ---");
  
  assert(
    normalizePackSize("10 Tabs") === "10",
    "Should extract digit '10' from '10 Tabs'"
  );

  assert(
    normalizePackSize("strip of 15 capsules") === "15",
    "Should extract digit '15' from 'strip of 15 capsules'"
  );

  assert(
    normalizePackSize("pack of 3") === "3",
    "Should extract digit '3' from 'pack of 3'"
  );

  assert(
    normalizePackSize("100ml") === "100ml",
    "Should preserve volume pack size '100ml'"
  );

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 4: Confidence Score Computation
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n--- Test 4: Match Confidence Score ---\n");

  const sourceExact = { product_name: "Ceftum 250mg", manufacturer: "Glaxo", pack_size: "10" };
  const targetExact = { product_name: "Ceftum 250mg", manufacturer: "Glaxo", pack_size: "10" };
  
  const scoreExact = computeMatchScore(sourceExact, targetExact, true);
  assert(
    scoreExact.confidence === 100.0 && scoreExact.reviewStatus === 'auto_accept',
    "Exact match should have 100% confidence and auto_accept status"
  );

  // Test fuzzy matching thresholds
  // 1. High similarity (should auto-accept >= 90%)
  const sourceHigh = { product_name: "Ceftum 250mg", manufacturer: "Glaxo", pack_size: "10" };
  const targetHigh = { product_name: "Ceftum 250mg Tablet", manufacturer: "Glaxo", pack_size: "10" };
  const scoreHigh = computeMatchScore(sourceHigh, targetHigh, false, 0.05); // 0.05 score = 95% similarity
  
  assert(
    scoreHigh.confidence >= 90.0 && scoreHigh.reviewStatus === 'auto_accept',
    `High similarity should trigger auto_accept (confidence: ${scoreHigh.confidence}%)`
  );

  // 2. Medium similarity (should require manual review 80% to 90%)
  const sourceMed = { product_name: "Ceftum 250mg", manufacturer: "Glaxo", pack_size: "10" };
  const targetMed = { product_name: "Ceftum 500mg Tablet", manufacturer: "Glaxo", pack_size: "10" };
  const scoreMed = computeMatchScore(sourceMed, targetMed, false, 0.15); // 0.15 score = 85% similarity
  
  assert(
    scoreMed.confidence >= 80.0 && scoreMed.confidence < 90.0 && scoreMed.reviewStatus === 'manual_review',
    `Medium similarity should trigger manual_review (confidence: ${scoreMed.confidence}%)`
  );

  // 3. Low similarity (should reject < 80%)
  const sourceLow = { product_name: "Ceftum 250mg", manufacturer: "Glaxo", pack_size: "10" };
  const targetLow = { product_name: "Calpol 500mg Tablet", manufacturer: "Glaxo", pack_size: "10" };
  const scoreLow = computeMatchScore(sourceLow, targetLow, false, 0.45); // 0.45 score = 55% similarity
  
  assert(
    scoreLow.confidence < 80.0 && scoreLow.reviewStatus === 'rejected',
    `Low similarity should trigger rejected status (confidence: ${scoreLow.confidence}%)`
  );

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 5: Fuzzy Matching Candidate Retrieval (Fuse.js)
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\n--- Test 5: Fuse.js Candidate Search ---");

  const candidates = [
    { product_id: "CAT01", product_name: "Calpol 500mg Tablet", normalized_name: "calpol 500mg", manufacturer: "Glaxo", pack_size: "15" },
    { product_id: "CAT02", product_name: "Ceftum 250mg Tablet", normalized_name: "ceftum 250mg", manufacturer: "Glaxo", pack_size: "10" },
    { product_id: "CAT03", product_name: "Dolo 650mg Tablet", normalized_name: "dolo 650mg", manufacturer: "Micro Labs", pack_size: "10" }
  ];

  const sourceQuery = { product_name: "Ceftam 250mg", manufacturer: "Glaxo", pack_size: "10" };
  const matchResult = fuzzyMatchProduct(sourceQuery, candidates);

  assert(
    matchResult !== null && matchResult.catalog.product_id === "CAT02",
    "Fuzzy matcher should identify 'Ceftum 250mg Tablet' (CAT02) as the best match for 'Ceftam 250mg'"
  );
  
  assert(
    matchResult.confidence >= 80.0,
    `Fuzzy match should have high confidence (computed: ${matchResult.confidence}%)`
  );

  console.log("\n=== ALL TESTS PASSED SUCCESSFULLY! ===");
}

try {
  runTests();
  process.exit(0);
} catch (err) {
  console.error("\n[TEST FATAL FAILURE]", err.message);
  process.exit(1);
}
