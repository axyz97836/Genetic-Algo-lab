/**
 * tests/phase4-audit.test.mjs - Exhaustive Independent Mathematical Audit for Phase 4.
 * Covers Phase B (Roulette), Phase C (Negative Fitness), Phase D (Tournament),
 * Phase E (Crossover), and Phase F (Mutation) strictly against SPEC.md §2, §4, §6, §7, §9.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { computeSelectionFitness, calculateLinearShift } from '../js/engine/fitness.js';
import { runRouletteSelection, runTournamentSelection } from '../js/engine/selection.js';
import { runCrossover } from '../js/engine/crossover.js';
import { runMutation } from '../js/engine/mutation.js';
import { Mulberry32, ScriptedRNG } from '../js/engine/rng.js';
import { PRESETS } from '../data/presets.js';
import { PROBLEMS } from '../data/problems.js';

// ============================================================================
// PHASE B: ROULETTE WHEEL MATHEMATICAL AUDIT
// ============================================================================
test('Phase B.1: Proportions, Sum to 1, Cumulative Intervals, and q_N = 1.0', () => {
  const fitness = [0.028571, 0.011628, 0.012346, 0.026316];
  const sumF = fitness.reduce((a, b) => a + b, 0);

  const mockRng = { roulette() { return 0.5; } };
  const res = runRouletteSelection(fitness, mockRng, 4);

  // 1. Proportions match F_i / sumF
  for (let i = 0; i < fitness.length; i++) {
    const expectedP = fitness[i] / sumF;
    assert.ok(Math.abs(res.p[i] - expectedP) < 1e-12, `p[${i}] expected ${expectedP}, got ${res.p[i]}`);
  }

  // 2. Sum of p_i is 1.0
  const sumP = res.p.reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sumP - 1.0) < 1e-12, `Sum of p_i must be 1.0, got ${sumP}`);

  // 3. Cumulative intervals match running sum
  let running = 0;
  for (let i = 0; i < fitness.length - 1; i++) {
    running += res.p[i];
    assert.ok(Math.abs(res.q[i] - running) < 1e-12, `q[${i}] mismatch`);
  }

  // 4. Final cumulative probability is exactly 1.0
  assert.strictEqual(res.q[res.q.length - 1], 1.0);
});

test('Phase B.2: Roulette Boundary Cases (r = 0, r = q_i, r = 1, F_1 = 0, Empty Slices)', () => {
  // Test case A: F_1 = 0 (Empty first slice)
  // fitness = [0, 10, 20, 30] -> p = [0, 10/60, 20/60, 30/60] = [0, 1/6, 1/3, 1/2]
  // q = [0, 1/6, 1/2, 1.0]
  const fitnessWithZero = [0, 10, 20, 30];
  const mockRngSeq = (rList) => {
    let ptr = 0;
    return { roulette() { return rList[ptr++]; } };
  };

  // r = 0 must pick first positive slice (index 1, NOT index 0)
  const resR0 = runRouletteSelection(fitnessWithZero, mockRngSeq([0.0]), 1);
  assert.strictEqual(resR0.poolIndices[0], 1, 'r=0 must select first positive-weight individual (idx 1), never empty slice (idx 0)');

  // r = exact boundary q_1 (1/6) must pick index 1
  const resRq1 = runRouletteSelection(fitnessWithZero, mockRngSeq([1 / 6]), 1);
  assert.strictEqual(resRq1.poolIndices[0], 1, 'r=q_1 must select index 1');

  // r = slightly above q_1 must pick index 2
  const resRq1Plus = runRouletteSelection(fitnessWithZero, mockRngSeq([1 / 6 + 1e-6]), 1);
  assert.strictEqual(resRq1Plus.poolIndices[0], 2, 'r > q_1 must select index 2');

  // r = exact boundary q_2 (1/2) must pick index 2
  const resRq2 = runRouletteSelection(fitnessWithZero, mockRngSeq([0.5]), 1);
  assert.strictEqual(resRq2.poolIndices[0], 2, 'r=q_2 must select index 2');

  // r = 1.0 must pick last positive slice (index 3)
  const resR1 = runRouletteSelection(fitnessWithZero, mockRngSeq([1.0]), 1);
  assert.strictEqual(resR1.poolIndices[0], 3, 'r=1.0 must select index 3');

  // Test case B: Multiple zero-fitness individuals: [0, 0, 5, 0, 15]
  // p = [0, 0, 0.25, 0, 0.75], q = [0, 0, 0.25, 0.25, 1.0]
  const multiZero = [0, 0, 5, 0, 15];
  const resMulti = runRouletteSelection(multiZero, mockRngSeq([0.0, 0.1, 0.25, 0.250001, 1.0]), 5);
  assert.strictEqual(resMulti.poolIndices[0], 2, 'r=0 must skip indices 0,1 and pick index 2');
  assert.strictEqual(resMulti.poolIndices[1], 2, 'r=0.1 must pick index 2');
  assert.strictEqual(resMulti.poolIndices[2], 2, 'r=0.25 must pick index 2');
  assert.strictEqual(resMulti.poolIndices[3], 4, 'r=0.250001 must skip empty index 3 and pick index 4');
  assert.strictEqual(resMulti.poolIndices[4], 4, 'r=1.0 must pick index 4');

  // Test case C: Single positive-fitness individual: [0, 10, 0]
  const singlePos = [0, 10, 0];
  const resSingle = runRouletteSelection(singlePos, mockRngSeq([0.0, 0.5, 1.0]), 3);
  assert.strictEqual(resSingle.poolIndices[0], 1);
  assert.strictEqual(resSingle.poolIndices[1], 1);
  assert.strictEqual(resSingle.poolIndices[2], 1);
});

// ============================================================================
// PHASE C: NEGATIVE FITNESS RECOVERY
// ============================================================================
test('Phase C.1: Reference Preset ref-negative Verification and Analytical Shift', () => {
  const refNeg = PRESETS.find(p => p.id === 'ref-negative');
  assert.ok(refNeg, 'ref-negative preset must exist');

  // Initial population: ['00000000', '00010001']
  // Linear sum problem on [-8, 7]:
  // c1: x1 = -8, x2 = -8 -> f = -16
  // c2: x1 = -7, x2 = -7 -> f = -14
  const rawFitness = [-16, -14];
  const sumF = rawFitness.reduce((a, b) => a + b, 0);
  assert.strictEqual(sumF, -30);

  // 1. Initial condition: rejected under roulette
  const mockRng = new Mulberry32(101);
  const unshifted = runRouletteSelection(rawFitness, mockRng, 2, false);
  assert.strictEqual(unshifted.valid, false);
  assert.strictEqual(unshifted.isInvalidNegativeFitness, true);
  assert.strictEqual(unshifted.minFitness, -16);
  assert.strictEqual(unshifted.sumF, -30);

  // 2. Analytical Linear Shift Calculation (§2 & §9)
  // range = max(F) - min(F) = -14 - (-16) = 2
  // eps = 0.1 * 2 = 0.2
  // C_shift = -min(F) + eps = 16 + 0.2 = 16.2
  const shift = calculateLinearShift(rawFitness);
  assert.strictEqual(shift.range, 2);
  assert.strictEqual(shift.epsilon, 0.2);
  assert.strictEqual(shift.C_shift, 16.2);

  // 3. Shifted values: F' = [0.2, 2.2], sum = 2.4
  assert.ok(Math.abs(shift.shifted[0] - 0.2) < 1e-12);
  assert.ok(Math.abs(shift.shifted[1] - 2.2) < 1e-12);
  assert.ok(Math.abs(shift.sumShifted - 2.4) < 1e-12);

  // 4. Shifted probabilities: p1 = 0.2/2.4 = 1/12, p2 = 2.2/2.4 = 11/12
  const shiftedRes = runRouletteSelection(rawFitness, mockRng, 2, true);
  assert.strictEqual(shiftedRes.valid, true);
  assert.ok(Math.abs(shiftedRes.p[0] - (1 / 12)) < 1e-12);
  assert.ok(Math.abs(shiftedRes.p[1] - (11 / 12)) < 1e-12);
  assert.ok(Math.abs(shiftedRes.q[0] - (1 / 12)) < 1e-12);
  assert.strictEqual(shiftedRes.q[1], 1.0);
});

test('Phase C.2: Linear Shift Edge Cases (Zero Sum, All Pos, Mixed, Zero Range)', () => {
  // A. Zero total fitness: [-5, 5] -> min=-5, max=5, range=10, eps=1.0, C_shift=6.0 -> [1, 11]
  const zeroSum = [-5, 5];
  const shiftZeroSum = calculateLinearShift(zeroSum);
  assert.strictEqual(shiftZeroSum.range, 10);
  assert.strictEqual(shiftZeroSum.epsilon, 1.0);
  assert.strictEqual(shiftZeroSum.C_shift, 6.0);
  assert.deepStrictEqual(shiftZeroSum.shifted, [1.0, 11.0]);

  // B. All positive fitness: [2, 5] -> needsShift: false
  const allPos = [2, 5];
  const shiftAllPos = calculateLinearShift(allPos);
  assert.strictEqual(shiftAllPos.needsShift, false);
  assert.strictEqual(shiftAllPos.C_shift, 0);

  // C. Mixed positive and negative: [-4, 6] -> min=-4, max=6, range=10, eps=1.0, C_shift=5.0 -> [1.0, 11.0]
  const mixed = [-4, 6];
  const shiftMixed = calculateLinearShift(mixed);
  assert.strictEqual(shiftMixed.needsShift, true);
  assert.strictEqual(shiftMixed.C_shift, 5.0);
  assert.deepStrictEqual(shiftMixed.shifted, [1.0, 11.0]);

  // D. Equal negative fitness values and zero range: [-10, -10]
  // range = 0 -> eps = 1 -> C_shift = 11 -> [1, 1]
  const equalNeg = [-10, -10];
  const shiftEqual = calculateLinearShift(equalNeg);
  assert.strictEqual(shiftEqual.range, 0);
  assert.strictEqual(shiftEqual.epsilon, 1.0);
  assert.strictEqual(shiftEqual.C_shift, 11.0);
  assert.deepStrictEqual(shiftEqual.shifted, [1.0, 1.0]);
});

// ============================================================================
// PHASE D: TOURNAMENT SELECTION
// ============================================================================
test('Phase D: Binary Tournament Exact Verification of ref-tournament (§9)', () => {
  const refTourn = PRESETS.find(p => p.id === 'ref-tournament');
  assert.ok(refTourn, 'ref-tournament preset must exist');

  // c1: f=34, c2: f=85, c3: f=80, c4: f=37 (Min problem: lower f wins)
  const individuals = [
    { id: 1, chromosome: '00110101', f: 34 },
    { id: 2, chromosome: '10010010', f: 85 },
    { id: 3, chromosome: '01001000', f: 80 },
    { id: 4, chromosome: '00010110', f: 37 }
  ];

  // Exactly N=4 rounds from §9: [[1, 2], [3, 4], [2, 4], [1, 3]]
  const scriptedRng = {
    pairs: [[1, 2], [3, 4], [2, 4], [1, 3]],
    ptr: 0,
    tourn() { return this.pairs[this.ptr++]; }
  };

  const res = runTournamentSelection(individuals, 'min', scriptedRng, 4);

  // Exactly 4 matches
  assert.strictEqual(res.rounds.length, 4);

  // Match 1: 1 vs 2 (f=34 vs f=85) -> winner c1 (idx 0)
  assert.strictEqual(res.rounds[0].winnerIdx0Based, 0);
  assert.strictEqual(res.poolIndices[0], 0);

  // Match 2: 3 vs 4 (f=80 vs f=37) -> winner c4 (idx 3)
  assert.strictEqual(res.rounds[1].winnerIdx0Based, 3);
  assert.strictEqual(res.poolIndices[1], 3);

  // Match 3: 2 vs 4 (f=85 vs f=37) -> winner c4 (idx 3)
  assert.strictEqual(res.rounds[2].winnerIdx0Based, 3);
  assert.strictEqual(res.poolIndices[2], 3);

  // Match 4: 1 vs 3 (f=34 vs f=80) -> winner c1 (idx 0)
  assert.strictEqual(res.rounds[3].winnerIdx0Based, 0);
  assert.strictEqual(res.poolIndices[3], 0);

  // Expected winners in mating pool: c1, c4, c4, c1
  const winners = res.poolIndices.map(i => individuals[i].chromosome);
  assert.deepStrictEqual(winners, ['00110101', '00010110', '00010110', '00110101']);
});

// ============================================================================
// PHASE E: CROSSOVER VERIFICATION
// ============================================================================
test('Phase E: Crossover Tail Swap, Operators, and ref-roulette Children (§9)', () => {
  // 1. Operator comparisons: '<=' vs '<'
  const mockRngOp = {
    cross() { return 0.8; },
    cutPoint() { return 2; }
  };
  const pool = ['1111', '0000'];
  // Under '<=': 0.8 <= 0.8 crosses!
  const resLe = runCrossover(pool, 0.8, '<=', mockRngOp, 2);
  assert.strictEqual(resLe.pairs[0].crossed, true);

  // Under '<': 0.8 < 0.8 does NOT cross!
  const resLt = runCrossover(pool, 0.8, '<', mockRngOp, 2);
  assert.strictEqual(resLt.pairs[0].crossed, false);
  assert.strictEqual(resLt.pairs[0].cutPoint, null);
  assert.deepStrictEqual(resLt.children, ['1111', '0000']);

  // 2. Cut point boundary checks: k=1, k=n, k=L-1
  // n=4, L=8
  const p1 = '11110000';
  const p2 = '00001111';

  // k = 1: 1st bit stays, 7 swap
  const mockK1 = { cross() { return 0.1; }, cutPoint() { return 1; } };
  const resK1 = runCrossover([p1, p2], 0.8, '<=', mockK1, 4);
  assert.strictEqual(resK1.pairs[0].child1Chrom, '1' + '0001111');
  assert.strictEqual(resK1.pairs[0].child2Chrom, '0' + '1110000');
  assert.strictEqual(resK1.pairs[0].isWholeVariableSwap, false);
  assert.strictEqual(resK1.pairs[0].mixedVariable, 1);

  // k = n = 4: whole variable swap
  const mockKn = { cross() { return 0.1; }, cutPoint() { return 4; } };
  const resKn = runCrossover([p1, p2], 0.8, '<=', mockKn, 4);
  assert.strictEqual(resKn.pairs[0].child1Chrom, '1111' + '1111');
  assert.strictEqual(resKn.pairs[0].child2Chrom, '0000' + '0000');
  assert.strictEqual(resKn.pairs[0].isWholeVariableSwap, true);
  assert.match(resKn.pairs[0].flag, /whole-variable swap/);

  // k = L - 1 = 7: first 7 stay, 8th bit swaps
  const mockK7 = { cross() { return 0.1; }, cutPoint() { return 7; } };
  const resK7 = runCrossover([p1, p2], 0.8, '<=', mockK7, 4);
  assert.strictEqual(resK7.pairs[0].child1Chrom, '1111000' + '1');
  assert.strictEqual(resK7.pairs[0].child2Chrom, '0000111' + '0');
  assert.strictEqual(resK7.pairs[0].isWholeVariableSwap, false);
  assert.strictEqual(resK7.pairs[0].mixedVariable, 2);

  // 3. Exact ref-roulette Crossover Verification (§9)
  // Mating pool: c1 (00110101), c3 (01001000), c4 (00010110), c2 (10010010)
  // Pair 1: c1 x c3, cross=0.50 <= 0.8, cut k=3
  // Pair 2: c4 x c2, cross=0.90 <= 0.8 -> false (0.90 > 0.80) -> no cross, no cut draw consumed
  const refPreset = PRESETS.find(p => p.id === 'ref-roulette');
  assert.deepStrictEqual(refPreset.generations[0].cross, [0.50, 0.90], 'Preset ref-roulette must define cross=[0.50, 0.90]');
  assert.deepStrictEqual(refPreset.generations[0].cut, [3], 'Preset ref-roulette must define cut=[3]');

  const refPool = ['00110101', '01001000', '00010110', '10010010'];
  const mockRefCrossRng = {
    crosses: [...refPreset.generations[0].cross],
    cuts: [...refPreset.generations[0].cut],
    crossPtr: 0,
    cutPtr: 0,
    cross() { return this.crosses[this.crossPtr++]; },
    cutPoint() { return this.cuts[this.cutPtr++]; }
  };

  const refCrossRes = runCrossover(refPool, 0.8, '<=', mockRefCrossRng, 4);

  // Pair 1 crosses (0.50 <= 0.8) with cut k=3
  assert.strictEqual(refCrossRes.pairs[0].rand, 0.50);
  assert.strictEqual(refCrossRes.pairs[0].crossed, true);
  assert.strictEqual(refCrossRes.pairs[0].cutPoint, 3);

  // Pair 2 does NOT cross (0.90 > 0.8) and consumes zero cut draws
  assert.strictEqual(refCrossRes.pairs[1].rand, 0.90);
  assert.strictEqual(refCrossRes.pairs[1].crossed, false);
  assert.strictEqual(refCrossRes.pairs[1].cutPoint, null);
  assert.strictEqual(mockRefCrossRng.cutPtr, 1, 'Only one cut draw (k=3) should be consumed');

  assert.strictEqual(refCrossRes.children[0], '00101000'); // c1 prefix 001 + c3 tail 01000
  assert.strictEqual(refCrossRes.children[1], '01010101'); // c3 prefix 010 + c1 tail 10101
  assert.strictEqual(refCrossRes.children[2], '00010110'); // unchanged
  assert.strictEqual(refCrossRes.children[3], '10010010'); // unchanged
});

// ============================================================================
// PHASE F: MUTATION VERIFICATION
// ============================================================================
test('Phase F: Mutation Bit Order, Weights, Deltas, and ref-roulette Children (§9)', () => {
  // Reference population before mutation (§9):
  // Child 1: 00101000
  // Child 2: 01010101
  // Child 3: 00010110
  // Child 4: 10010010
  const children = ['00101000', '01010101', '00010110', '10010010'];
  const bounds = [[0, 15], [0, 15]];
  const n = 4;
  const pm = 0.05;

  // 32 draws: all 0.50 except draw 8 = 0.03 (child 1, pos 8) and draw 25 = 0.01 (child 4, pos 1)
  const refPreset = PRESETS.find(p => p.id === 'ref-roulette');
  const expectedMutDraws = refPreset.generations[0].mut;
  assert.strictEqual(expectedMutDraws.length, 32);
  assert.strictEqual(expectedMutDraws[7], 0.03);  // draw 8 (0-based index 7)
  assert.strictEqual(expectedMutDraws[24], 0.01); // draw 25 (0-based index 24)

  const mockMutRng = {
    drawIdx: 0,
    mut() {
      return expectedMutDraws[this.drawIdx++];
    }
  };

  const mutRes = runMutation(children, pm, '<=', mockMutRng, bounds, n);

  // Exactly 32 draws consumed
  assert.strictEqual(mockMutRng.drawIdx, 32);
  assert.strictEqual(mutRes.allDraws.length, 32);

  // Exactly 2 flips recorded
  assert.strictEqual(mutRes.flips.length, 2);

  // Flip 1: Child 1, pos 8 (variable x2, weight w=0, 0 -> 1, delta = +1.0)
  const f1 = mutRes.flips[0];
  assert.strictEqual(f1.childIndex, 1);
  assert.strictEqual(f1.bitPosition, 8);
  assert.strictEqual(f1.variable, 2);
  assert.strictEqual(f1.withinSegmentWeight, 0); // LSB
  assert.strictEqual(f1.originalBit, '0');
  assert.strictEqual(f1.flippedBit, '1');
  assert.strictEqual(f1.deltaValue, 1.0);

  // Flip 2: Child 4, pos 1 (variable x1, weight w=3, 1 -> 0, delta = -8.0)
  const f2 = mutRes.flips[1];
  assert.strictEqual(f2.childIndex, 4);
  assert.strictEqual(f2.bitPosition, 1);
  assert.strictEqual(f2.variable, 1);
  assert.strictEqual(f2.withinSegmentWeight, 3); // MSB
  assert.strictEqual(f2.originalBit, '1');
  assert.strictEqual(f2.flippedBit, '0');
  assert.strictEqual(f2.deltaValue, -8.0);

  // Final mutated bitstrings from §9:
  assert.strictEqual(mutRes.mutatedChildren[0], '00101001'); // 00101000 with bit 8 flipped
  assert.strictEqual(mutRes.mutatedChildren[1], '01010101'); // no flips
  assert.strictEqual(mutRes.mutatedChildren[2], '00010110'); // no flips
  assert.strictEqual(mutRes.mutatedChildren[3], '00010010'); // 10010010 with bit 1 flipped
});
