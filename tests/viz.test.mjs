/**
 * tests/viz.test.mjs - Comprehensive Mathematical and Visualization Logic Audit for Phase 3.
 * Run with: node --test tests/viz.test.mjs
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { calculateDeltaX, decodeChromosome } from '../js/engine/decode.js';
import { PROBLEMS, getProblemById } from '../data/problems.js';
import { PRESETS, getPresetById } from '../data/presets.js';
import { evaluatePopulationChromosomes, runGeneration, STEP_PHASES } from '../js/engine/engine.js';
import { ScriptedRNG } from '../js/engine/rng.js';

test('Grid Mathematical Audit: Resolution 2^n x 2^n and coordinate drift < 1e-12', () => {
  const testConfigurations = [
    { name: '4-bit symmetric positive [0, 15]', bounds: [[0, 15], [0, 15]], n: 4 },
    { name: '4-bit symmetric negative [-8, 7]', bounds: [[-8, 7], [-8, 7]], n: 4 },
    { name: '5-bit symmetric negative [-8, 7]', bounds: [[-8, 7], [-8, 7]], n: 5 },
    { name: '5-bit non-symmetric Rosenbrock [-2, 2], [-1, 3]', bounds: [[-2, 2], [-1, 3]], n: 5 },
    { name: '5-bit float bounds Rastrigin [-5.12, 5.12]', bounds: [[-5.12, 5.12], [-5.12, 5.12]], n: 5 }
  ];

  for (const config of testConfigurations) {
    const { bounds, n } = config;
    const numGrid = 1 << n; // exactly 2^n
    const expectedCells = numGrid * numGrid;
    const [dx1, dx2] = calculateDeltaX(bounds, n);
    const [[xmin1, xmax1], [xmin2, xmax2]] = bounds;

    assert.equal(dx1, (xmax1 - xmin1) / (numGrid - 1), `Delta x1 mismatch for ${config.name}`);
    assert.equal(dx2, (xmax2 - xmin2) / (numGrid - 1), `Delta x2 mismatch for ${config.name}`);

    let cellCount = 0;
    for (let d1 = 0; d1 < numGrid; d1++) {
      const x1 = xmin1 + d1 * dx1;
      const reconstructedD1 = (x1 - xmin1) / dx1;
      const drift1 = Math.abs(reconstructedD1 - d1);
      assert.ok(drift1 < 1e-12, `Coordinate drift x1 exceeded 1e-12: drift = ${drift1} for ${config.name} at d1=${d1}`);

      for (let d2 = 0; d2 < numGrid; d2++) {
        const x2 = xmin2 + d2 * dx2;
        const reconstructedD2 = (x2 - xmin2) / dx2;
        const drift2 = Math.abs(reconstructedD2 - d2);
        assert.ok(drift2 < 1e-12, `Coordinate drift x2 exceeded 1e-12: drift = ${drift2} for ${config.name} at d2=${d2}`);

        cellCount++;
      }
    }

    assert.equal(cellCount, expectedCells, `Grid cell count mismatch: expected ${expectedCells}, got ${cellCount}`);
  }
});

test('Objective Function Mathematical Accuracy across all grid points', () => {
  // Test Sphere f = x1^2 + x2^2 on [0, 15]^2, n=4 (16x16 grid, dx=1)
  const sphere = getProblemById('sphere');
  const [dx1, dx2] = calculateDeltaX(sphere.bounds, 4);
  assert.equal(dx1, 1);
  assert.equal(dx2, 1);

  for (let d1 = 0; d1 < 16; d1++) {
    for (let d2 = 0; d2 < 16; d2++) {
      const expected = d1 * d1 + d2 * d2;
      const actual = sphere.fn(d1, d2);
      assert.equal(actual, expected, `Objective function mismatch at (${d1}, ${d2})`);
    }
  }

  // Test Linear Sum f = x1 + x2 on [-8, 7]^2, n=4 (16x16 grid, dx=1)
  const linear = getProblemById('linear_sum');
  for (let d1 = 0; d1 < 16; d1++) {
    const x1 = -8 + d1;
    for (let d2 = 0; d2 < 16; d2++) {
      const x2 = -8 + d2;
      const expected = x1 + x2;
      const actual = linear.fn(x1, x2);
      assert.equal(actual, expected, `Linear sum mismatch at (${x1}, ${x2})`);
    }
  }
});

test('True Discrete Optimum Detection for Minimization and Maximization', () => {
  // 1. Minimization: Sphere [0, 15]^2, n=4
  const sphere = getProblemById('sphere');
  const numGrid = 16;
  const [dx1, dx2] = calculateDeltaX(sphere.bounds, 4);

  let minF = Infinity;
  let optD1 = -1;
  let optD2 = -1;

  for (let d1 = 0; d1 < numGrid; d1++) {
    const x1 = sphere.bounds[0][0] + d1 * dx1;
    for (let d2 = 0; d2 < numGrid; d2++) {
      const x2 = sphere.bounds[1][0] + d2 * dx2;
      const f = sphere.fn(x1, x2);
      if (f < minF) {
        minF = f;
        optD1 = d1;
        optD2 = d2;
      }
    }
  }

  assert.equal(optD1, 0, 'Sphere min optimum D1 must be 0');
  assert.equal(optD2, 0, 'Sphere min optimum D2 must be 0');
  assert.equal(minF, 0, 'Sphere min optimum value must be 0');

  // 2. Maximization: Linear Sum [-8, 7]^2, n=4
  const linear = getProblemById('linear_sum');
  const [ldx1, ldx2] = calculateDeltaX(linear.bounds, 4);
  let maxF = -Infinity;
  let lOptD1 = -1;
  let lOptD2 = -1;

  for (let d1 = 0; d1 < numGrid; d1++) {
    const x1 = linear.bounds[0][0] + d1 * ldx1;
    for (let d2 = 0; d2 < numGrid; d2++) {
      const x2 = linear.bounds[1][0] + d2 * ldx2;
      const f = linear.fn(x1, x2);
      if (f > maxF) {
        maxF = f;
        lOptD1 = d1;
        lOptD2 = d2;
      }
    }
  }

  assert.equal(lOptD1, 15, 'Linear sum max optimum D1 must be 15');
  assert.equal(lOptD2, 15, 'Linear sum max optimum D2 must be 15');
  assert.equal(maxF, 14, 'Linear sum max optimum value must be 14 (7 + 7)');
});

test('Population Overlay Audit: Decoded Chromosome Coordinates and Vector Math', () => {
  const preset = getPresetById('ref-roulette');
  const { initialPop, bounds, n } = preset;

  // Verify all 4 initial chromosomes
  const expectedCoordinates = [
    { chrom: '00110101', D1: 3, D2: 5, x1: 3, x2: 5, f: 34 },
    { chrom: '10010010', D1: 9, D2: 2, x1: 9, x2: 2, f: 85 },
    { chrom: '01001000', D1: 4, D2: 8, x1: 4, x2: 8, f: 80 },
    { chrom: '00010110', D1: 1, D2: 6, x1: 1, x2: 6, f: 37 }
  ];

  for (let i = 0; i < initialPop.length; i++) {
    const chrom = initialPop[i];
    const exp = expectedCoordinates[i];
    assert.equal(chrom, exp.chrom);

    const decoded = decodeChromosome(chrom, bounds, n);
    assert.equal(decoded.D1, exp.D1);
    assert.equal(decoded.D2, exp.D2);
    assert.equal(decoded.x1, exp.x1);
    assert.equal(decoded.x2, exp.x2);

    // Coordinate drift check
    const driftX1 = Math.abs(decoded.x1 - (bounds[0][0] + decoded.D1 * 1.0));
    const driftX2 = Math.abs(decoded.x2 - (bounds[1][0] + decoded.D2 * 1.0));
    assert.ok(driftX1 < 1e-12, 'Individual x1 coordinate drift exceeded 1e-12');
    assert.ok(driftX2 < 1e-12, 'Individual x2 coordinate drift exceeded 1e-12');
  }

  // Mutation vector audit: Child 1 (00101000 -> 00101001) and Child 4 (10010010 -> 00010010)
  const oldC1 = '00101000';
  const newC1 = '00101001';
  const decOldC1 = decodeChromosome(oldC1, bounds, n);
  const decNewC1 = decodeChromosome(newC1, bounds, n);

  assert.equal(decOldC1.D1, 2);
  assert.equal(decOldC1.D2, 8);
  assert.equal(decNewC1.D1, 2);
  assert.equal(decNewC1.D2, 9); // Bit 8 flipped 0->1 in x2, delta = +1

  const oldC4 = '10010010';
  const newC4 = '00010010';
  const decOldC4 = decodeChromosome(oldC4, bounds, n);
  const decNewC4 = decodeChromosome(newC4, bounds, n);

  assert.equal(decOldC4.D1, 9);
  assert.equal(decOldC4.D2, 2);
  assert.equal(decNewC4.D1, 1); // Bit 1 flipped 1->0 in x1, delta = -8
  assert.equal(decNewC4.D2, 2);
});

test('Convergence Chart Mathematical Audit: Engine Stats vs Chart History', () => {
  // Run ref-roulette full 2 generations
  const preset = getPresetById('ref-roulette');
  const rng1 = new ScriptedRNG(preset.generations[0], 1, preset.N);
  const gen1Steps = runGeneration(preset.initialPop, {
    problemFn: (x1, x2) => x1 * x1 + x2 * x2,
    problemType: 'min',
    bounds: preset.bounds,
    n: preset.n,
    N: preset.N,
    pc: preset.pc,
    pm: preset.pm,
    selection: preset.selection,
    fitnessMode: preset.fitnessMode,
    generationIndex: 1
  }, rng1);

  const eval1 = gen1Steps.find(s => s.phase === STEP_PHASES.DECODE_EVAL);
  assert.ok(eval1);
  assert.equal(eval1.stats.bestF, 34);
  assert.equal(eval1.stats.avgF, 59);
  assert.equal(eval1.stats.worstF, 85);
  assert.equal(eval1.stats.distinctCount, 4);

  // Gen 2 evaluation
  const replaceStep = gen1Steps.find(s => s.phase === STEP_PHASES.REPLACE);
  const pop2 = replaceStep.finalNewPopulation;

  const rng2 = new ScriptedRNG(preset.generations[1], 2, preset.N);
  const gen2Steps = runGeneration(pop2, {
    problemFn: (x1, x2) => x1 * x1 + x2 * x2,
    problemType: 'min',
    bounds: preset.bounds,
    n: preset.n,
    N: preset.N,
    pc: preset.pc,
    pm: preset.pm,
    selection: preset.selection,
    fitnessMode: preset.fitnessMode,
    generationIndex: 2,
    stopAfter: 'DECODE_EVAL'
  }, rng2);

  const eval2 = gen2Steps.find(s => s.phase === STEP_PHASES.DECODE_EVAL);
  assert.ok(eval2);
  assert.equal(eval2.stats.bestF, 5);
  assert.equal(eval2.stats.avgF, 44.25);
  assert.equal(eval2.stats.worstF, 85);
  assert.equal(eval2.stats.distinctCount, 4);
});
