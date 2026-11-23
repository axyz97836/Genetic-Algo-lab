/**
 * tests/engine.test.mjs - Comprehensive unit test suite for GA Lab engine.
 * Run with: node --test tests/engine.test.mjs
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  tokenize,
  parse,
  evaluateAst,
  validateOnGrid,
  PROBLEMS,
  getProblemById
} from '../data/problems.js';

import {
  PRESETS,
  getPresetById
} from '../data/presets.js';

import {
  Mulberry32,
  ScriptedRNG
} from '../js/engine/rng.js';

import {
  calculateDeltaX,
  decodeChromosome,
  encodeSegmentsToChromosome
} from '../js/engine/decode.js';

import {
  computeSelectionFitness,
  calculateLinearShift
} from '../js/engine/fitness.js';

import {
  runRouletteSelection,
  runTournamentSelection
} from '../js/engine/selection.js';

import {
  runCrossover
} from '../js/engine/crossover.js';

import {
  runMutation
} from '../js/engine/mutation.js';

import {
  analyzeSchema,
  matchesSchema,
  isCutInsideSpan,
  evaluateSchemaInPopulation,
  calculateSchemaBounds,
  autoTrackSchema
} from '../js/engine/schema.js';

import {
  runGeneration,
  evaluatePopulationChromosomes,
  STEP_PHASES
} from '../js/engine/engine.js';

const EPSILON = 1e-5;

function isClose(a, b, tol = EPSILON) {
  return Math.abs(a - b) <= tol;
}

// ==========================================
// 1. DELTA X AND SEGMENT DECODING
// ==========================================
test('Delta X precision calculation across bit widths', () => {
  // SPEC §9: n = 4 on [0, 15] -> Delta x = 15 / 15 = 1
  const [dx1_s4, dx2_s4] = calculateDeltaX([[0, 15], [0, 15]], 4);
  assert.equal(dx1_s4, 1.0);
  assert.equal(dx2_s4, 1.0);

  // SPEC §9: n = 4 on [-8, 7] -> Delta x = 15 / 15 = 1
  const [dx1_lin4, dx2_lin4] = calculateDeltaX([[-8, 7], [-8, 7]], 4);
  assert.equal(dx1_lin4, 1.0);
  assert.equal(dx2_lin4, 1.0);

  // SPEC §9: n = 5 on [-8, 7] -> Delta x = 15 / 31 ≈ 0.483871
  const [dx1_lin5, dx2_lin5] = calculateDeltaX([[-8, 7], [-8, 7]], 5);
  assert.ok(isClose(dx1_lin5, 15 / 31));
  assert.ok(isClose(dx1_lin5, 0.483871, 1e-4));
});

test('Decode of known chromosomes from Section 9', () => {
  const bounds = [[0, 15], [0, 15]];
  const n = 4;

  // c1: 00110101 -> D1=3, D2=5, x1=3, x2=5
  const c1 = decodeChromosome('00110101', bounds, n);
  assert.equal(c1.D1, 3);
  assert.equal(c1.D2, 5);
  assert.equal(c1.x1, 3);
  assert.equal(c1.x2, 5);

  // c2: 10010010 -> D1=9, D2=2, x1=9, x2=2
  const c2 = decodeChromosome('10010010', bounds, n);
  assert.equal(c2.D1, 9);
  assert.equal(c2.D2, 2);
  assert.equal(c2.x1, 9);
  assert.equal(c2.x2, 2);

  // c3: 01001000 -> D1=4, D2=8, x1=4, x2=8
  const c3 = decodeChromosome('01001000', bounds, n);
  assert.equal(c3.D1, 4);
  assert.equal(c3.D2, 8);
  assert.equal(c3.x1, 4);
  assert.equal(c3.x2, 8);

  // c4: 00010110 -> D1=1, D2=6, x1=1, x2=6
  const c4 = decodeChromosome('00010110', bounds, n);
  assert.equal(c4.D1, 1);
  assert.equal(c4.D2, 6);
  assert.equal(c4.x1, 1);
  assert.equal(c4.x2, 6);
});

// ==========================================
// 2. SELECTION FITNESS & LINEAR SHIFT
// ==========================================
test('Fitness modes and negative fitness detection', () => {
  assert.equal(computeSelectionFitness(10, 'max'), 10);
  assert.ok(isClose(computeSelectionFitness(34, 'min-inverse'), 1 / 35));
  assert.equal(computeSelectionFitness(15, 'min-cminus', 100), 85);

  // Singularity in min-inverse
  assert.throws(() => {
    computeSelectionFitness(-1, 'min-inverse');
  }, /f <= -1/);
});

test('Section 9 Negative Fitness linear shift calculation', () => {
  // f = [-16, -14], F = [-16, -14], type max
  // range = 2, eps = 0.2, C_shift = 16.2
  // F' = [0.2, 2.2], sum F' = 2.4
  // p = [0.2/2.4, 2.2/2.4] = [0.08333, 0.91667]
  const F_raw = [-16, -14];
  const shift = calculateLinearShift(F_raw);

  assert.equal(shift.needsShift, true);
  assert.ok(isClose(shift.C_shift, 16.2));
  assert.ok(isClose(shift.epsilon, 0.2));
  assert.ok(isClose(shift.shifted[0], 0.2));
  assert.ok(isClose(shift.shifted[1], 2.2));
  assert.ok(isClose(shift.sumShifted, 2.4));

  const p0 = shift.shifted[0] / shift.sumShifted;
  const p1 = shift.shifted[1] / shift.sumShifted;
  assert.ok(isClose(p0, 0.08333, 1e-4));
  assert.ok(isClose(p1, 0.91667, 1e-4));
});

// ==========================================
// 3. ROULETTE WHEEL INTERVAL EDGE CASES
// ==========================================
test('Roulette wheel edge cases: r=0, r=q_i, empty slices (F_1=0), r=1', () => {
  // Setup mock RNG
  const mockRng = (rVal) => ({
    roulette: () => rVal
  });

  // Population with F = [0, 0.5, 0.5] -> p = [0, 0.5, 0.5], q = [0, 0.5, 1.0]
  const F_withZero = [0, 0.5, 0.5];

  // Case 1: r = 0 with F_1 = 0 (empty slice)
  // SPEC §2: r=0 picks the first positive-weight individual (index 1), never empty slice 0
  const res0 = runRouletteSelection(F_withZero, mockRng(0.0), 1);
  assert.equal(res0.poolIndices[0], 1);

  // Case 2: r exactly equals q_1 (0.5)
  // SPEC §2: r = q_i picks i
  const resExactQ = runRouletteSelection(F_withZero, mockRng(0.5), 1);
  assert.equal(resExactQ.poolIndices[0], 1);

  // Case 3: r slightly above q_1 (0.50001)
  const resAboveQ = runRouletteSelection(F_withZero, mockRng(0.50001), 1);
  assert.equal(resAboveQ.poolIndices[0], 2);

  // Case 4: r = 1.0
  const res1 = runRouletteSelection(F_withZero, mockRng(1.0), 1);
  assert.equal(res1.poolIndices[0], 2);
});

// ==========================================
// 4. TOURNAMENT SELECTION DIRECTION & TIES
// ==========================================
test('Tournament selection: direction (min vs max), ties, and identical indices', () => {
  const pop = [
    { f: 34 }, // idx 0
    { f: 85 }, // idx 1
    { f: 80 }, // idx 2
    { f: 37 }  // idx 3
  ];

  // Min problem: lower f wins
  const mockRngMin = {
    tourn: () => [1, 2] // contender 0 (f=34) vs contender 1 (f=85)
  };
  const tournMin = runTournamentSelection(pop, 'min', mockRngMin, 1);
  assert.equal(tournMin.poolIndices[0], 0);

  // Max problem: higher f wins
  const tournMax = runTournamentSelection(pop, 'max', mockRngMin, 1);
  assert.equal(tournMax.poolIndices[0], 1);

  // Tie test: contender 1 (f=85) vs contender with same f -> tie picks first drawn
  const popWithTie = [{ f: 50 }, { f: 50 }];
  const mockTieRng = { tourn: () => [2, 1] }; // second contender drawn first
  const tieRes = runTournamentSelection(popWithTie, 'min', mockTieRng, 1);
  assert.equal(tieRes.poolIndices[0], 1); // 1-based index 2 is 0-based index 1

  // Same index drawn twice [3, 3]
  const mockSameRng = { tourn: () => [3, 3] };
  const sameRes = runTournamentSelection(pop, 'min', mockSameRng, 1);
  assert.equal(sameRes.poolIndices[0], 2);
});

// ==========================================
// 5. CROSSOVER CUT TAIL SWAPS & FLAGS
// ==========================================
test('Crossover tail swap at k=1, k=n, k=L-1 and no-cross copying', () => {
  const parents = ['00000000', '11111111'];
  const n = 4;
  const L = 8;

  // Case A: No-cross (rand > pc) consumes NO cut draw
  let cutDrawn = false;
  const mockNoCrossRng = {
    cross: () => 0.95,
    cutPoint: () => { cutDrawn = true; return 4; }
  };
  const noCrossRes = runCrossover(parents, 0.8, '<=', mockNoCrossRng, n);
  assert.equal(cutDrawn, false);
  assert.equal(noCrossRes.children[0], '00000000');
  assert.equal(noCrossRes.children[1], '11111111');

  // Case B: Cross at k = 1
  const mockCrossK1 = {
    cross: () => 0.5,
    cutPoint: () => 1
  };
  const resK1 = runCrossover(parents, 0.8, '<=', mockCrossK1, n);
  assert.equal(resK1.children[0], '01111111');
  assert.equal(resK1.children[1], '10000000');
  assert.equal(resK1.pairs[0].isWholeVariableSwap, false);
  assert.equal(resK1.pairs[0].mixedVariable, 1);

  // Case C: Cross at k = n (k = 4, whole-variable swap)
  const mockCrossKn = {
    cross: () => 0.5,
    cutPoint: () => 4
  };
  const resKn = runCrossover(parents, 0.8, '<=', mockCrossKn, n);
  assert.equal(resKn.children[0], '00001111');
  assert.equal(resKn.children[1], '11110000');
  assert.equal(resKn.pairs[0].isWholeVariableSwap, true);

  // Case D: Cross at k = L-1 (k = 7)
  const mockCrossKLminus1 = {
    cross: () => 0.5,
    cutPoint: () => 7
  };
  const resKLminus1 = runCrossover(parents, 0.8, '<=', mockCrossKLminus1, n);
  assert.equal(resKLminus1.children[0], '00000001');
  assert.equal(resKLminus1.children[1], '11111110');
  assert.equal(resKLminus1.pairs[0].isWholeVariableSwap, false);
  assert.equal(resKLminus1.pairs[0].mixedVariable, 2);
});

// ==========================================
// 6. MUTATION WEIGHT AND DELTA VALUE MATH
// ==========================================
test('Mutation: child-major/bit-major order, variable detection, weights, and delta signs', () => {
  const children = ['00101000', '01010101', '00010110', '10010010'];
  const n = 4;
  const bounds = [[0, 15], [0, 15]]; // Delta x = 1

  // Reproducing Section 9 draws: 32 draws, all 0.50 except draw 8 = 0.03 and draw 25 = 0.01
  const draws = new Array(32).fill(0.50);
  draws[7] = 0.03;  // child 1 pos 8
  draws[24] = 0.01; // child 4 pos 1

  let drawPtr = 0;
  const mockRng = {
    mut: () => draws[drawPtr++]
  };

  const res = runMutation(children, 0.05, '<=', mockRng, bounds, n);

  // Resulting children in §9:
  // c1: 00101000 -> 00101001 (pos 8 flipped 0->1)
  // c4: 10010010 -> 00010010 (pos 1 flipped 1->0)
  assert.equal(res.mutatedChildren[0], '00101001');
  assert.equal(res.mutatedChildren[1], '01010101');
  assert.equal(res.mutatedChildren[2], '00010110');
  assert.equal(res.mutatedChildren[3], '00010010');

  assert.equal(res.flips.length, 2);

  // Check flip 1: child 1 pos 8
  const flip1 = res.flips[0];
  assert.equal(flip1.childIndex, 1);
  assert.equal(flip1.bitPosition, 8);
  assert.equal(flip1.variable, 2);
  assert.equal(flip1.withinSegmentWeight, 0); // LSB
  assert.equal(flip1.deltaValue, +1);

  // Check flip 2: child 4 pos 1
  const flip2 = res.flips[1];
  assert.equal(flip2.childIndex, 4);
  assert.equal(flip2.bitPosition, 1);
  assert.equal(flip2.variable, 1);
  assert.equal(flip2.withinSegmentWeight, 3); // MSB of 4-bit segment
  assert.equal(flip2.deltaValue, -8);
});

// ==========================================
// 7. SAFE EXPRESSION PARSER & GRID VALIDATION
// ==========================================
test('Safe expression parser: operators, functions, precedence, and grid validation', () => {
  const expr1 = parse('x1^2 + x2^2');
  assert.equal(expr1.evaluate(3, 4), 25);

  const expr2 = parse('sin(pi/2) + 2 * cos(0) - exp(0)');
  assert.ok(isClose(expr2.evaluate(0, 0), 2.0));

  // Operator precedence: 2 + 3 * 4 = 14, not 20
  const expr3 = parse('2 + 3 * 4');
  assert.equal(expr3.evaluate(0, 0), 14);

  // Power right-associativity: 2^3^2 = 2^9 = 512, not (2^3)^2 = 64
  const expr4 = parse('2 ^ 3 ^ 2');
  assert.equal(expr4.evaluate(0, 0), 512);

  // Grid validation: valid function
  const validCheck = validateOnGrid(expr1, [[0, 15], [0, 15]], 4);
  assert.equal(validCheck.valid, true);

  // Grid validation: singularity / division by zero
  const exprSingular = parse('1 / (x1 - 5)');
  // On grid [0, 15] with n=4, x1 hits 5 when D1=5
  const singCheck = validateOnGrid(exprSingular, [[0, 15], [0, 15]], 4);
  assert.equal(singCheck.valid, false);
  assert.match(singCheck.error, /evaluates to Infinity|NaN/);
});

// ==========================================
// 8. SCHEMA METRICS, SPAN RULE, AND BOUNDS
// ==========================================
test('Schema metrics, span condition, and theoretical bound calculations (§9)', () => {
  // H = 00****** (L = 8)
  const H = '00******';
  const info = analyzeSchema(H);
  assert.equal(info.order, 2);
  assert.equal(info.definingLength, 1);
  assert.equal(info.firstFixedPos, 1);
  assert.equal(info.lastFixedPos, 2);

  // Span condition: first <= k < last
  // Here first = 1, last = 2.
  // k = 1: inside (1 <= 1 < 2)
  // k = 2: outside (not < 2)
  // k = 3: outside
  assert.equal(isCutInsideSpan(1, info), true);
  assert.equal(isCutInsideSpan(2, info), false);
  assert.equal(isCutInsideSpan(3, info), false);

  // Evaluate in ref-roulette Gen 1 population:
  // c1: 00110101 (match, F=0.028571)
  // c2: 10010010 (no match)
  // c3: 01001000 (no match)
  // c4: 00010110 (match, F=0.026316)
  const pop = ['00110101', '10010010', '01001000', '00010110'];
  const F_array = [0.028571, 0.011628, 0.012346, 0.026316];

  const evalRes = evaluateSchemaInPopulation(H, pop, F_array);
  assert.equal(evalRes.m, 2);
  assert.ok(isClose(evalRes.f_H, 0.0274435, 1e-5));
  assert.ok(isClose(evalRes.f_bar, 0.019715, 1e-4));

  // Compute bounds: pc = 0.8, pm = 0.05, L = 8
  const bounds = calculateSchemaBounds(evalRes, 0.8, 0.05, 8);

  // SPEC §9 numbers:
  // survival factor = 1 - 0.8*1/7 - 2*0.05 = 0.785714
  // textbook bound E[m(2)] >= 2.187
  // exact-mutation factor = (1 - 0.8*1/7) * (1 - 0.05)^2 = 0.885714 * 0.9025 = 0.799357
  // exact bound >= 2.225
  assert.ok(isClose(bounds.textbookSurvivalFactor, 0.785714, 1e-4));
  assert.ok(isClose(bounds.exactSurvivalFactor, 0.799357, 1e-4));
  assert.ok(isClose(bounds.textbookBound, 2.187, 0.005));
  assert.ok(isClose(bounds.exactBound, 2.225, 0.005));

  // Clamping check: if m = 0, both bounds must be strictly 0
  const evalEmpty = evaluateSchemaInPopulation('11111111', pop, F_array);
  const boundsEmpty = calculateSchemaBounds(evalEmpty, 0.8, 0.05, 8);
  assert.equal(boundsEmpty.textbookBound, 0);
  assert.equal(boundsEmpty.exactBound, 0);
});

// ==========================================
// 9. SCRIPTED RNG QUEUE EXHAUSTION ERROR
// ==========================================
test('ScriptedRNG error on exhaustion during executed phase', () => {
  const scripted = new ScriptedRNG({
    roulette: [0.1, 0.2]
  }, 1);

  assert.equal(scripted.roulette(), 0.1);
  assert.equal(scripted.roulette(), 0.2);

  // Next draw must throw descriptive error
  assert.throws(() => {
    scripted.roulette();
  }, /ScriptedRNG queue "roulette" exhausted at generation 1, index 2/);
});

// ==========================================
// 10. ELITISM LOGIC
// ==========================================
test('Optional elitism preserves best old parent over worst child', () => {
  const initialPop = ['00110101', '10010010', '01001000', '00010110'];
  const problem = getProblemById('sphere');

  const paramsWithElitism = {
    problemFn: problem.fn,
    problemType: 'min',
    bounds: problem.bounds,
    n: 4,
    N: 4,
    pc: 0.8,
    pm: 0.05,
    selection: 'roulette',
    fitnessMode: 'min-inverse',
    elitism: true,
    generationIndex: 1,
    allowAutoShift: false
  };

  const preset = getPresetById('ref-roulette');
  const rng = new ScriptedRNG(preset.generations[0], 1);

  const records = runGeneration(initialPop, paramsWithElitism, rng);
  const replaceStep = records.find(r => r.phase === STEP_PHASES.REPLACE);

  assert.equal(replaceStep.elitismApplied, true);
  // In ref-roulette, best old parent was c1 ('00110101', f=34)
  assert.equal(replaceStep.eliteParentChrom, '00110101');
  assert.ok(replaceStep.finalNewPopulation.includes('00110101'));
});

// ==========================================
// 11. FULL REPLAY OF SECTION 9 HAND-CALCULATED RUNS
// ==========================================
test('Full replay and exact verification of ref-roulette (§9)', () => {
  const preset = getPresetById('ref-roulette');
  const problem = getProblemById('sphere');

  const rng = new ScriptedRNG(preset.generations[0], 1);
  const params = {
    problemFn: problem.fn,
    problemType: preset.type,
    bounds: preset.bounds,
    n: preset.n,
    N: preset.N,
    pc: preset.pc,
    pm: preset.pm,
    selection: preset.selection,
    fitnessMode: preset.fitnessMode,
    crossCmp: preset.crossCmp,
    mutCmp: preset.mutCmp,
    elitism: false,
    generationIndex: 1,
    allowAutoShift: false
  };

  // Generation 1 Run
  const gen1Steps = runGeneration(preset.initialPop, params, rng);
  const decode1 = gen1Steps.find(s => s.phase === STEP_PHASES.DECODE_EVAL);
  const exp1 = preset.generations[0].expected;

  for (let i = 0; i < 4; i++) {
    const ind = decode1.population[i];
    assert.equal(ind.D1, exp1.D1[i]);
    assert.equal(ind.D2, exp1.D2[i]);
    assert.equal(ind.x1, exp1.x1[i]);
    assert.equal(ind.x2, exp1.x2[i]);
    assert.equal(ind.f, exp1.f[i]);
    assert.ok(isClose(ind.F, exp1.F[i], 1e-5));
  }

  // Gen 1 Selection
  const select1 = gen1Steps.find(s => s.phase === STEP_PHASES.SELECT);
  for (let i = 0; i < 4; i++) {
    assert.ok(isClose(select1.selectionResult.p[i], exp1.p[i], 1e-4));
    assert.ok(isClose(select1.selectionResult.q[i], exp1.q[i], 1e-4));
  }
  assert.deepEqual(select1.matingPool, exp1.pool);

  // Gen 1 Crossover
  const cross1 = gen1Steps.find(s => s.phase === STEP_PHASES.CROSSOVER);
  assert.deepEqual(cross1.childrenBeforeMutation, exp1.children);

  // Gen 1 Mutation
  const mut1 = gen1Steps.find(s => s.phase === STEP_PHASES.MUTATE);
  assert.deepEqual(mut1.mutatedChildren, exp1.mutated);

  // Generation 2 Run (stopAfter: DECODE_EVAL)
  const rng2 = new ScriptedRNG(preset.generations[1], 2);
  const params2 = {
    ...params,
    generationIndex: 2,
    stopAfter: preset.generations[1].stopAfter
  };

  const gen2Steps = runGeneration(mut1.mutatedChildren, params2, rng2);
  assert.equal(gen2Steps.length, 1);
  const decode2 = gen2Steps[0];
  const exp2 = preset.generations[1].expected;

  for (let i = 0; i < 4; i++) {
    const ind = decode2.population[i];
    assert.equal(ind.D1, exp2.D1[i]);
    assert.equal(ind.D2, exp2.D2[i]);
    assert.equal(ind.x1, exp2.x1[i]);
    assert.equal(ind.x2, exp2.x2[i]);
    assert.equal(ind.f, exp2.f[i]);
  }
  assert.equal(decode2.stats.bestF, 5);
  assert.equal(decode2.stats.avgF, 44.25);
  assert.equal(decode2.stats.worstF, 85);
});

test('Full replay and exact verification of ref-tournament (§9)', () => {
  const preset = getPresetById('ref-tournament');
  const problem = getProblemById('sphere');

  const rng = new ScriptedRNG(preset.generations[0], 1);
  const params = {
    problemFn: problem.fn,
    problemType: preset.type,
    bounds: preset.bounds,
    n: preset.n,
    N: preset.N,
    pc: preset.pc,
    pm: preset.pm,
    selection: preset.selection,
    fitnessMode: preset.fitnessMode,
    generationIndex: 1,
    stopAfter: preset.generations[0].stopAfter
  };

  const gen1Steps = runGeneration(preset.initialPop, params, rng);
  const selectStep = gen1Steps.find(s => s.phase === STEP_PHASES.SELECT);
  const exp = preset.generations[0].expected;

  assert.deepEqual(selectStep.matingPool, exp.pool);
});

test('Full replay and exact verification of ref-negative (§9)', () => {
  const preset = getPresetById('ref-negative');
  const problem = getProblemById('linear_sum');

  const rng = new ScriptedRNG(preset.generations[0], 1);
  const params = {
    problemFn: problem.fn,
    problemType: preset.type,
    bounds: preset.bounds,
    n: preset.n,
    N: preset.N,
    pc: preset.pc,
    pm: preset.pm,
    selection: preset.selection,
    fitnessMode: preset.fitnessMode,
    generationIndex: 1,
    stopAfter: preset.generations[0].stopAfter,
    allowAutoShift: true // Verify shift calculations
  };

  const gen1Steps = runGeneration(preset.initialPop, params, rng);
  const decodeStep = gen1Steps.find(s => s.phase === STEP_PHASES.DECODE_EVAL);
  const selectStep = gen1Steps.find(s => s.phase === STEP_PHASES.SELECT);
  const exp = preset.generations[0].expected;

  assert.equal(decodeStep.population[0].f, exp.f[0]);
  assert.equal(decodeStep.population[1].f, exp.f[1]);

  assert.ok(isClose(selectStep.selectionResult.p[0], exp.p[0], 1e-4));
  assert.ok(isClose(selectStep.selectionResult.p[1], exp.p[1], 1e-4));
});
