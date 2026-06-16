/**
 * Candidate gathering + scoring helpers (shared by main thread and score workers).
 * Uses the same gather/fuse/score logic as matchProduct in engine.js.
 */
import { matching } from '../config/index.js';
import { recordFuzzyMatch } from './aliasLearner.js';
import {
  gatherCandidates,
  gatherCandidatesPass3,
  gatherCandidatesPass4,
  fuseFallback,
  fuseFallbackPass3,
  fuseFallbackPass4,
  scoreCandidates,
} from './engine.js';

export function gatherCandidatesForProduct(rmsParsed, index, options = {}) {
  if (options.fourthPass) return gatherCandidatesPass4(rmsParsed, index);
  if (options.thirdPass) return gatherCandidatesPass3(rmsParsed, index);
  return gatherCandidates(rmsParsed, index, options);
}

function passLabel(matchOptions) {
  if (matchOptions.fourthPass) return 'pass4';
  if (matchOptions.thirdPass) return 'pass3';
  if (matchOptions.secondPass) return 'pass2';
  return '';
}

function resultFromBest(rms, rmsParsed, best, matchOptions) {
  const autoThreshold = matchOptions.autoThreshold ?? matching.autoThreshold;
  const reviewThreshold = matchOptions.reviewThreshold ?? matching.reviewThreshold;
  const pl = passLabel(matchOptions);

  let status = 'rejected';
  if (best.confidence >= autoThreshold) status = 'auto_matched';
  else if (best.confidence >= reviewThreshold) status = 'review_required';

  if (best.confidence >= reviewThreshold && best.dr) {
    recordFuzzyMatch(rms.manufacturer, best.dr.manufacturer, best.confidence, rms.name, best.dr.name);
  }

  let method = pl ? `composite_${pl}` : 'composite';
  if (status === 'rejected') {
    method = pl ? `unmatched_${pl}` : 'unmatched';
    if (best.fuseScore !== undefined) {
      method = pl ? `fuzzy_${pl}` : (matchOptions.secondPass ? 'fuzzy_pass2' : 'fuzzy');
    }
  } else if (best.fuseScore !== undefined) {
    method = pl ? `fuzzy_${pl}` : (matchOptions.secondPass ? 'fuzzy_pass2' : 'fuzzy');
  }

  const top5 = best.top5 || [best];

  return {
    rms,
    dr: status !== 'rejected' ? best.dr : null,
    confidence: best.confidence,
    method,
    status,
    suggestions: top5.map(s => ({
      dr: s.dr,
      confidence: s.confidence,
      breakdown: s.breakdown,
      fuseScore: s.fuseScore,
      lowConfidence: s.lowConfidence,
      lowConfidenceFlags: s.lowConfidenceFlags,
    })),
    parsed: rmsParsed,
    lowConfidence: status !== 'rejected' && (best.lowConfidence || best.confidence < autoThreshold),
    lowConfidenceFlags: best.lowConfidenceFlags || [],
    reason: status === 'rejected'
      ? `Best confidence ${best.confidence}% below threshold ${reviewThreshold}%`
      : undefined,
  };
}

export function scoreProductCandidates(rms, rmsParsed, candidates, matchOptions = {}) {
  const suggestions = scoreCandidates(rmsParsed, candidates, matchOptions);

  if (!suggestions.length) {
    const pl = passLabel(matchOptions);
    return {
      rms,
      dr: null,
      confidence: 0,
      method: pl ? `unmatched_${pl}` : 'unmatched',
      status: 'rejected',
      suggestions: [],
      reason: 'No candidates found',
      parsed: rmsParsed,
    };
  }

  const top5 = suggestions.slice(0, 5);
  const best = { ...top5[0], top5 };
  return resultFromBest(rms, rmsParsed, best, matchOptions);
}

/** Score fuse fallback hits on the main thread (when gather returns no candidates). */
export function scoreFuseFallback(rms, rmsParsed, index, matchOptions = {}) {
  const fused = matchOptions.fourthPass
    ? fuseFallbackPass4(rmsParsed, index)
    : matchOptions.thirdPass
      ? fuseFallbackPass3(rmsParsed, index)
      : fuseFallback(rmsParsed, index, matchOptions);

  if (!fused.length) {
    const pl = passLabel(matchOptions);
    return {
      rms,
      dr: null,
      confidence: 0,
      method: pl ? `unmatched_${pl}` : 'unmatched',
      status: 'rejected',
      suggestions: [],
      reason: 'No candidates found',
      parsed: rmsParsed,
    };
  }

  const top5 = fused.slice(0, 5).map(h => ({
    dr: h.dr,
    confidence: h.confidence,
    breakdown: h.breakdown,
    fuseScore: h.fuseScore,
    lowConfidence: h.lowConfidence,
    lowConfidenceFlags: h.lowConfidenceFlags,
  }));
  return resultFromBest(rms, rmsParsed, { ...top5[0], top5 }, matchOptions);
}
