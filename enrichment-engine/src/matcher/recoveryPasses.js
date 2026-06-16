/**
 * Shared recovery passes: image catalog cross-ref + web image verify.
 * Used after text matching in pass 1 and pass 2/3/4.
 */
import { parseProduct } from '../parser/productParser.js';
import { recoverUnmatchedViaImageCrossRef } from './imageCrossRef.js';
import { recoverViaWebImageVerify } from './webImageVerify.js';
import { processing, matchingPass4 } from '../config/index.js';
import { matchLogger } from '../logger/index.js';

/** Last resort: promote top DR suggestion when score is plausible but below pass thresholds. */
export function salvageViaTopSuggestions(unmatched, minConfidence = 50) {
  const recovered = [];
  const stillUnmatched = [];

  for (const r of unmatched) {
    const top = (r.suggestions || []).find(s => s.dr && s.confidence >= minConfidence);
    if (top) {
      recovered.push({
        rms: r.rms,
        dr: top.dr,
        confidence: top.confidence,
        method: 'suggestion_salvage',
        status: 'review_required',
        parsed: r.parsed,
        suggestions: (r.suggestions || []).slice(0, 3),
        lowConfidence: true,
        lowConfidenceFlags: ['salvaged_top_suggestion'],
      });
    } else {
      stillUnmatched.push(r);
    }
  }

  matchLogger.info('Suggestion salvage pass', { minConfidence, recovered: recovered.length, remaining: stillUnmatched.length });
  return { recovered, stillUnmatched };
}

export async function runRecoveryPasses(unmatched, drIndex, imageIndex, brandAliases = {}, options = {}) {
  if (!unmatched.length) {
    return { recovered: [], stillUnmatched: [], imageCrossRef: 0, webImageVerified: 0 };
  }

  const aggressive = options.aggressive !== false;
  const crossRefOpts = aggressive
    ? {
        autoThreshold: matchingPass4.autoThreshold,
        reviewThreshold: matchingPass4.reviewThreshold,
        minCombined: 58,
        minRawConfidence: 62,
      }
    : {};

  let recovered = [];
  let remaining = unmatched;

  matchLogger.info(`Image cross-ref on ${remaining.length} unmatched…`);
  const { recovered: imgRecovered, stillUnmatched: afterImg } = recoverUnmatchedViaImageCrossRef(
    remaining, drIndex, imageIndex, brandAliases, crossRefOpts
  );
  recovered.push(...imgRecovered);
  remaining = afterImg;
  matchLogger.info(`Image cross-ref recovered: ${imgRecovered.length}`);

  if (remaining.length && processing.webImageVerify !== false) {
    const minScore = options.webMinScore ?? processing.webImageMinScore ?? 42;
    matchLogger.info(`Web image verify on ${remaining.length} (min score ${minScore}%)…`);
    const { recovered: webRecovered, stillUnmatched } = await recoverViaWebImageVerify(
      remaining, imageIndex, brandAliases, { minScore, maxCandidates: 4 }
    );
    recovered.push(...webRecovered);
    remaining = stillUnmatched;
    matchLogger.info(`Web image verified: ${webRecovered.length}`);
  }

  return {
    recovered,
    stillUnmatched: remaining,
    imageCrossRef: imgRecovered.length,
    webImageVerified: recovered.length - imgRecovered.length,
  };
}

export function mergeRecoveryIntoBuckets(recovered, allMatched, allReview, methodStats = {}) {
  for (const r of recovered) {
    methodStats[r.method] = (methodStats[r.method] || 0) + 1;
    if (r.status === 'auto_matched') allMatched.push(r);
    else allReview.push(r);
  }
  return methodStats;
}
