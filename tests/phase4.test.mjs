/**
 * tests/phase4.test.mjs - Unit tests for Phase 4 Selection, Crossover & Mutation visual mechanisms.
 * Run with: node --test tests/phase4.test.mjs
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { computeSelectionFitness, calculateLinearShift } from '../js/engine/fitness.js';
import { runRouletteSelection, runTournamentSelection } from '../js/engine/selection.js';
import { runCrossover } from '../js/engine/crossover.js';
import { runMutation } from '../js/engine/mutation.js';
import { Mulberry32 } from '../js/engine/rng.js';

test('Roulette Wheel Mathematics: Slice proportions and interval landing', () => {
  const fitness = [0.028571, 0.011628, 0.012346, 0.026316];
  const sumF = fitness.reduce((a, b) => a + b, 0);

  const rng = new Mulberry32(42);
  const result = runRouletteSelection(fitness, rng, 4);

  // Proportions sum to 1
  const sumP = result.probabilities.reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sumP - 1.0) < 1e-9, `Probabilities must sum to 1, got ${sumP}`);

  // Last cumulative interval must be exactly 1.0
  assert.equal(result.cumulativeProbabilities[result.cumulativeProbabilities.length - 1], 1.0);

  // Test spin landing: r = 0.20 picks index 0 (c1), r = 0.60 picks index 2 (c3), r = 0.95 picks index 3 (c4)
  // [0.36230, 0.50975, 0.66630, 1.00000]
  const q = result.cumulativeProbabilities;
  const pick = (r) => {
    for (let i = 0; i < q.length; i++) {
      if (r <= q[i]) return i;
    }
    return q.length - 1;
  };

  assert.equal(pick(0.20), 0); // r=0.20 <= 0.36230
  assert.equal(pick(0.40), 1); // 0.36230 < r=0.40 <= 0.50975
  assert.equal(pick(0.60), 2); // 0.50975 < r=0.60 <= 0.66630
  assert.equal(pick(0.95), 3); // 0.66630 < r=0.95 <= 1.00000
});

test('Negative Fitness Failure State and Linear Shift Recovery', () => {
  // Negative fitness array from Section 9: [-16, -14]
  const rawFitness = [-16, -14];
  const rng = new Mulberry32(101);
  const result = runRouletteSelection(rawFitness, rng, 2);

  assert.equal(result.isInvalidNegativeFitness, true);
  assert.ok(result.minFitness < 0);
  assert.ok(result.sumF < 0);

  // Linear Shift recovery
  const shift = calculateLinearShift(rawFitness);
  assert.equal(shift.range, 2);
  assert.equal(shift.epsilon, 0.2);
  assert.equal(shift.C_shift, 16.2);

  // Shifted fitness values
  const shiftedF = rawFitness.map(f => f + shift.C_shift);
  assert.equal(Math.round(shiftedF[0] * 10) / 10, 0.2);
  assert.equal(Math.round(shiftedF[1] * 10) / 10, 2.2);

  const recoveredResult = runRouletteSelection(shiftedF, rng, 2);
  assert.equal(recoveredResult.isInvalidNegativeFitness, false);
  assert.ok(recoveredResult.poolIndices.length === 2);
});

test('Tournament Selection Bracket Mechanics: Direction, Ties, Negative Values', () => {
  // Test population with negative values
  const indList = [
    { id: 1, f: -16 },
    { id: 2, f: -14 },
    { id: 3, f: -10 },
    { id: 4, f: -20 }
  ];

  // Mock RNG that returns fixed pairs
  const mockRng = {
    pairs: [[1, 2], [3, 4], [1, 1], [2, 3]], // 1-based indices
    ptr: 0,
    tourn() {
      return this.pairs[this.ptr++];
    }
  };

  // Minimization: lower f wins (-20 is best, -16 < -14, tie returns first)
  const resultMin = runTournamentSelection(indList, 'min', mockRng, 4);
  assert.equal(resultMin.poolIndices[0], 0); // #1 (f=-16) vs #2 (f=-14): -16 < -14 -> winner is #1 (idx 0)
  assert.equal(resultMin.poolIndices[1], 3); // #3 (f=-10) vs #4 (f=-20): -20 < -10 -> winner is #4 (idx 3)
  assert.equal(resultMin.poolIndices[2], 0); // #1 vs #1: winner #1 (idx 0)
  assert.equal(resultMin.poolIndices[3], 1); // #2 (f=-14) vs #3 (f=-10): -14 < -10 -> winner #2 (idx 1)

  // Maximization: higher f wins (-10 is best, -14 > -16)
  mockRng.ptr = 0;
  const resultMax = runTournamentSelection(indList, 'max', mockRng, 4);
  assert.equal(resultMax.poolIndices[0], 1); // #1 vs #2: -14 > -16 -> winner #2 (idx 1)
  assert.equal(resultMax.poolIndices[1], 2); // #3 vs #4: -10 > -20 -> winner #3 (idx 2)
  assert.equal(resultMax.poolIndices[2], 0); // #1 vs #1: winner #1
  assert.equal(resultMax.poolIndices[3], 2); // #2 vs #3: -10 > -14 -> winner #3 (idx 2)
});

test('Crossover & Mutation Animation Properties and Flags', () => {
  // Recombination with cut at k=4 (whole variable swap when n=4, L=8)
  const mockRngCross = {
    cross() { return 0.5; }, // <= 0.8
    cutPoint() { return 4; }  // k=4 == n
  };

  const pool = ['11110000', '00001111'];
  const resCross = runCrossover(pool, 0.8, '<=', mockRngCross, 4);
  assert.equal(resCross.pairs[0].crossed, true);
  assert.equal(resCross.pairs[0].isWholeVariableSwap, true);
  assert.match(resCross.pairs[0].flag, /whole-variable swap/);

  // Cut at k=3 (mixed bits in variable 1)
  mockRngCross.cutPoint = () => 3;
  const resCrossMixed = runCrossover(pool, 0.8, '<=', mockRngCross, 4);
  assert.equal(resCrossMixed.pairs[0].isWholeVariableSwap, false);
  assert.equal(resCrossMixed.pairs[0].mixedVariable, 1);
  assert.match(resCrossMixed.pairs[0].flag, /variable 1 is rebuilt/);
});
