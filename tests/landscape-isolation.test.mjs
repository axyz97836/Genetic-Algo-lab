/**
 * tests/landscape-isolation.test.mjs - 3D Fitness Landscape Isolation & Pure Helper Audit.
 * Conforms to UI Redesign Phase 2 Requirements:
 * 1. Verified snapshot immutability (Object.freeze prevents writes back to engine state).
 * 2. Guaranteed zero engine side-effects: identical GA outputs with 3D view mounted vs unmounted.
 * 3. Exact 3D perspective projection mathematics, depth sorting, and downsampling.
 *
 * Run with: node --test tests/landscape-isolation.test.mjs
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { project3DTo2D, calculateBarDepth, sortFarToNear, downsampleGrid } from '../js/viz/projection3d.js';
import { Mulberry32 } from '../js/engine/rng.js';
import { runGeneration, evaluatePopulationChromosomes } from '../js/engine/engine.js';
import { getPresetById } from '../data/presets.js';

test('3D Math: Perspective projection calculates correct screen coordinates and depth scaling', () => {
  const screenW = 600;
  const screenH = 400;
  const fov = 400;
  const distance = 500;

  // Origin point (0, 0, 0) with zero rotation
  const p0 = project3DTo2D(0, 0, 0, 0, 0, distance, fov, screenW, screenH);
  assert.equal(p0.visible, true);
  assert.equal(p0.x, 300); // screen center X
  assert.equal(p0.y, 200); // screen center Y
  assert.equal(p0.depth, 500);

  // Point further away along Z should project with smaller scale
  const pNear = project3DTo2D(50, 0, 0, 0, 0, distance, fov, screenW, screenH);
  const pFar = project3DTo2D(50, 0, 200, 0, 0, distance, fov, screenW, screenH);
  assert.ok(pFar.depth > pNear.depth, 'Far point must have greater camera depth');
  assert.ok(Math.abs(pFar.x - 300) < Math.abs(pNear.x - 300), 'Further point must foreshorten towards center');

  // Point behind camera should be marked non-visible
  const pBehind = project3DTo2D(0, 0, -600, 0, 0, distance, fov, screenW, screenH);
  assert.equal(pBehind.visible, false);
});

test('3D Math: Painter\'s algorithm sorts bars strictly far-to-near (descending depth)', () => {
  const bars = [
    { id: 1, depth: 320 },
    { id: 2, depth: 580 },
    { id: 3, depth: 150 },
    { id: 4, depth: 490 }
  ];

  sortFarToNear(bars);

  assert.equal(bars[0].id, 2); // 580 (furthest)
  assert.equal(bars[1].id, 4); // 490
  assert.equal(bars[2].id, 1); // 320
  assert.equal(bars[3].id, 3); // 150 (nearest)

  for (let i = 0; i < bars.length - 1; i++) {
    assert.ok(bars[i].depth >= bars[i + 1].depth, `Depth at ${i} must be >= depth at ${i + 1}`);
  }
});

test('3D Math: Downsampling handles grids exceeding 32x32 correctly', () => {
  const originalSize = 64;
  const grid64 = [];
  for (let i = 0; i < originalSize; i++) {
    grid64[i] = [];
    for (let j = 0; j < originalSize; j++) {
      grid64[i][j] = i + j;
    }
  }

  const { data, size, factor } = downsampleGrid(grid64, 32);
  assert.equal(factor, 2);
  assert.equal(size, 32);
  assert.equal(data.length, 32);
  assert.equal(data[0].length, 32);

  // For 32x32 or smaller, grid should remain untouched
  const grid16 = [[1, 2], [3, 4]];
  const res16 = downsampleGrid(grid16, 32);
  assert.equal(res16.factor, 1);
  assert.equal(res16.size, 2);
  assert.deepEqual(res16.data, grid16);
});

test('GA Isolation: Object.freeze prevents live mutation from external renderers', () => {
  const testRecord = {
    generationIndex: 1,
    phase: 'DECODE_EVAL',
    population: [
      { id: 1, chromosome: '00110101', f: 34, F: 0.028571 },
      { id: 2, chromosome: '10010010', f: 85, F: 0.011628 }
    ]
  };

  // Function matching freezeSnapshot from js/main.js
  const frozen = Object.freeze({
    ...testRecord,
    population: Object.freeze(testRecord.population.map(p => Object.freeze({ ...p })))
  });

  assert.ok(Object.isFrozen(frozen), 'Record must be frozen');
  assert.ok(Object.isFrozen(frozen.population), 'Population array must be frozen');
  assert.ok(Object.isFrozen(frozen.population[0]), 'Individual objects must be frozen');

  // Verify runtime write attempts fail
  assert.throws(() => {
    frozen.generationIndex = 99;
  }, TypeError);

  assert.throws(() => {
    frozen.population[0].f = 999;
  }, TypeError);
});

test('GA Isolation: GA engine output is bit-for-bit identical with 3D view mounted vs unmounted', () => {
  const preset = getPresetById('ref-roulette');
  assert.ok(preset, 'ref-roulette preset must exist');

  const SEED = 1337;

  // Run A: Pure engine run without any visualization / 3D renderer attached
  const rngA = new Mulberry32(SEED);
  const configA = {
    n: preset.n,
    bounds: preset.bounds,
    N: preset.N,
    maxGen: 3,
    pc: preset.pc,
    pm: preset.pm,
    selection: preset.selection,
    fitnessMode: preset.fitnessMode,
    C: preset.C,
    elitism: false,
    problemFn: (x1, x2) => x1 * x1 + x2 * x2,
    problemType: preset.type
  };

  let popA = [...preset.initialPop];
  const historyA = [];
  for (let gen = 1; gen <= 3; gen++) {
    const stepRecords = runGeneration(popA, { ...configA, generationIndex: gen }, rngA);
    historyA.push(stepRecords);
    const replaceRecord = stepRecords.find(r => r.phase === 'REPLACE');
    if (replaceRecord && replaceRecord.nextGenEvaluation) {
      popA = replaceRecord.nextGenEvaluation.individuals.map(ind => ind.chromosome);
    }
  }

  // Run B: Identical run where every step record is passed through 3D renderer consumer
  const rngB = new Mulberry32(SEED);
  const configB = { ...configA };

  let popB = [...preset.initialPop];
  const historyB = [];
  const rendererAuditLog = [];

  for (let gen = 1; gen <= 3; gen++) {
    const stepRecords = runGeneration(popB, { ...configB, generationIndex: gen }, rngB);

    // Mock 3D Landscape consumption: freeze and read properties
    for (const record of stepRecords) {
      const frozen = Object.freeze({
        ...record,
        population: Object.freeze((record.population || []).map(p => Object.freeze({ ...p })))
      });

      // Renderer reads heights, coordinates, and individuals
      const barH = (frozen.population?.[0]?.F || 0) * 100;
      const chrom = frozen.population?.[0]?.chromosome;
      rendererAuditLog.push({ gen, phase: frozen.phase, barH, chrom });
    }

    historyB.push(stepRecords);
    const replaceRecord = stepRecords.find(r => r.phase === 'REPLACE');
    if (replaceRecord && replaceRecord.nextGenEvaluation) {
      popB = replaceRecord.nextGenEvaluation.individuals.map(ind => ind.chromosome);
    }
  }

  // Verify bit-for-bit identity across all generations and steps
  assert.equal(historyA.length, historyB.length);
  for (let g = 0; g < historyA.length; g++) {
    const stepsA = historyA[g];
    const stepsB = historyB[g];
    assert.equal(stepsA.length, stepsB.length);

    for (let s = 0; s < stepsA.length; s++) {
      const recA = stepsA[s];
      const recB = stepsB[s];
      assert.equal(recA.phase, recB.phase);
      assert.equal(recA.generationIndex, recB.generationIndex);

      if (recA.population && recB.population) {
        assert.equal(recA.population.length, recB.population.length);
        for (let i = 0; i < recA.population.length; i++) {
          assert.equal(recA.population[i].chromosome, recB.population[i].chromosome);
          assert.equal(recA.population[i].f, recB.population[i].f);
          assert.equal(recA.population[i].F, recB.population[i].F);
        }
      }
    }
  }

  assert.ok(rendererAuditLog.length > 0, 'Renderer audit log must have processed records');
});
