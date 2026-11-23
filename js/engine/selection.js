/**
 * js/engine/selection.js - Roulette wheel and binary tournament selection schemes.
 * Conforms to SPEC.md §2.
 */

import { calculateLinearShift } from './fitness.js';

export function runRouletteSelection(fitnessArray, rng, N = null, allowAutoShift = false) {
  const popSize = fitnessArray.length;
  const numSpins = (N !== null && N !== undefined) ? N : popSize;

  let effectiveFitness = fitnessArray;
  let shiftInfo = calculateLinearShift(fitnessArray);

  if (shiftInfo.needsShift) {
    if (!allowAutoShift) {
      return {
        valid: false,
        isInvalidNegativeFitness: true,
        minFitness: shiftInfo.minF,
        sumF: shiftInfo.sumF,
        error: 'INVALID_FITNESS',
        message: 'Roulette selection invalid: negative fitness or non-positive sum.',
        shiftInfo
      };
    }
    effectiveFitness = shiftInfo.shifted;
  }

  const sumF = effectiveFitness.reduce((a, b) => a + b, 0);
  if (sumF <= 0) {
    return {
      valid: false,
      isInvalidNegativeFitness: true,
      minFitness: shiftInfo.minF,
      sumF,
      error: 'ZERO_FITNESS_SUM',
      message: 'Sum of selection fitness is <= 0.',
      shiftInfo
    };
  }

  // p_i = F_i / sumF across the whole population
  const p = effectiveFitness.map(F => F / sumF);

  // q_i = cumulative sum, with q_N forced to exactly 1.0
  const q = [];
  let runningSum = 0;
  for (let i = 0; i < popSize; i++) {
    runningSum += p[i];
    q.push(i === popSize - 1 ? 1.0 : runningSum);
  }

  // Draw numSpins spins
  const poolIndices = [];
  const rValues = [];

  for (let spin = 0; spin < numSpins; spin++) {
    const r = rng.roulette();
    rValues.push(r);

    // Pick first i with p_i > 0 and r <= q_i
    let chosenIdx = -1;
    for (let i = 0; i < popSize; i++) {
      if (p[i] > 0 && r <= q[i]) {
        chosenIdx = i;
        break;
      }
    }

    // Safety fallback: pick last positive slice if float rounding edge case
    if (chosenIdx === -1) {
      for (let i = popSize - 1; i >= 0; i--) {
        if (p[i] > 0) {
          chosenIdx = i;
          break;
        }
      }
    }

    poolIndices.push(chosenIdx);
  }

  return {
    valid: true,
    isInvalidNegativeFitness: false,
    effectiveFitness,
    shiftInfo: shiftInfo.needsShift ? shiftInfo : null,
    p,
    q,
    probabilities: p,
    cumulativeProbabilities: q,
    rValues,
    poolIndices
  };
}

export function runTournamentSelection(popEvaluation, problemType, rng, N = null) {
  const popSize = popEvaluation.length;
  const numRounds = (N !== null && N !== undefined) ? N : popSize;

  const poolIndices = [];
  const rounds = [];

  for (let round = 0; round < numRounds; round++) {
    // rng.tourn() returns 1-based index pair [i, j] in 1..popSize
    const pair = rng.tourn(popSize);
    const [rawI, rawJ] = pair;
    const idx1 = rawI - 1;
    const idx2 = rawJ - 1;

    const f1 = popEvaluation[idx1].f;
    const f2 = popEvaluation[idx2].f;

    let winnerIdx = -1;
    let tie = false;

    if (f1 === f2) {
      // A tie picks the first drawn
      winnerIdx = idx1;
      tie = true;
    } else if (problemType === 'min') {
      // Lower f wins
      winnerIdx = f1 < f2 ? idx1 : idx2;
    } else {
      // Max problem: higher f wins
      winnerIdx = f1 > f2 ? idx1 : idx2;
    }

    poolIndices.push(winnerIdx);
    rounds.push({
      roundNumber: round + 1,
      i: idx1,
      j: idx2,
      fi: f1,
      fj: f2,
      winnerIndex: winnerIdx,
      pair1Based: [rawI, rawJ],
      pair0Based: [idx1, idx2],
      fValues: [f1, f2],
      winnerIdx0Based: winnerIdx,
      winnerIdx1Based: winnerIdx + 1,
      tie
    });
  }

  return {
    valid: true,
    rounds,
    poolIndices
  };
}
