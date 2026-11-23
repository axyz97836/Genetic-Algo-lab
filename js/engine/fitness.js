/**
 * js/engine/fitness.js - Objective evaluation, selection fitness F, and linear shift math.
 * Conforms to SPEC.md §2.
 */

export function computeSelectionFitness(f, fitnessMode = 'max', C = null) {
  switch (fitnessMode) {
    case 'max':
      return f;

    case 'min-inverse':
      if (f <= -1) {
        throw new Error(`Invalid fitness: f <= -1 (${f}) under "min-inverse" mode causes singularity or negative fitness. Use "min-cminus".`);
      }
      return 1 / (1 + f);

    case 'min-cminus':
      if (typeof C !== 'number') {
        throw new Error('"min-cminus" requires numeric parameter C');
      }
      return C - f;

    default:
      throw new Error(`Unknown fitnessMode: "${fitnessMode}"`);
  }
}

/**
 * Calculates linear shift C_shift when F < 0 or sum(F) <= 0.
 * SPEC §2: C_shift = -min(F) + eps, eps = 0.1 * (max(F) - min(F)), or 1 if that range is 0.
 */
export function calculateLinearShift(fitnessArray) {
  if (!Array.isArray(fitnessArray) || fitnessArray.length === 0) {
    return { needsShift: false, C_shift: 0, epsilon: 0, shifted: [] };
  }

  let minF = Infinity;
  let maxF = -Infinity;
  let sumF = 0;
  let hasNegative = false;

  for (const F of fitnessArray) {
    if (F < minF) minF = F;
    if (F > maxF) maxF = F;
    sumF += F;
    if (F < 0) hasNegative = true;
  }

  const isInvalid = hasNegative || sumF <= 0;
  if (!isInvalid) {
    return {
      needsShift: false,
      C_shift: 0,
      epsilon: 0,
      shifted: [...fitnessArray],
      sumShifted: sumF
    };
  }

  const range = maxF - minF;
  const epsilon = range === 0 ? 1 : 0.1 * range;
  const C_shift = -minF + epsilon;

  const shifted = fitnessArray.map(F => F + C_shift);
  const sumShifted = shifted.reduce((a, b) => a + b, 0);

  return {
    needsShift: true,
    C_shift,
    epsilon,
    shifted,
    sumShifted,
    minF,
    maxF,
    sumF,
    range
  };
}
