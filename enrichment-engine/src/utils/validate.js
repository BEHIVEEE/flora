/**
 * Validate that matched + review + unmatched equals total RMS products.
 */
export function validateProductCounts({ matched, review, unmatched, total, label = 'RMS catalog' }) {
  const sum = matched + review + unmatched;
  const ok = sum === total;
  return {
    ok,
    total,
    matched,
    review,
    unmatched,
    sum,
    message: ok
      ? `✓ Validation passed: ${matched} + ${review} + ${unmatched} = ${total} (${label})`
      : `✗ Validation FAILED: ${matched} + ${review} + ${unmatched} = ${sum} ≠ ${total} (${label})`,
  };
}
