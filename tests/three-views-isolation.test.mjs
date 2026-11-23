/**
 * tests/three-views-isolation.test.mjs
 * UI Redesign Phase 4 Isolation Verification:
 * Asserts that with the same seed and preset, GA engine output (chromosomes, fitnesses,
 * coordinates, crossover cuts, mutations, and RNG draws) is bit-for-bit identical
 * whether all three 3D views (Landscape 3D, Chromosome 3D Strips, and Ribbon 3D)
 * are mounted or unmounted.
 *
 * Zero modification to existing tests or GA core engine.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { Mulberry32 } from '../js/engine/rng.js';
import { runGeneration } from '../js/engine/engine.js';
import { getPresetById } from '../data/presets.js';

// Mock DOM elements for 3D renderers
class MockElement {
  constructor(id = '', tag = 'div') {
    this.id = id;
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.classList = new Set();
    this.style = {
      display: 'block',
      setProperty: (prop, val) => { this.style[prop] = val; }
    };
    this.textContent = '';
    this._innerHTML = '';
    this.attributes = new Map();
  }

  setAttribute(k, v) {
    this.attributes.set(k, String(v));
  }

  getAttribute(k) {
    return this.attributes.get(k) || null;
  }

  set innerHTML(html) {
    this._innerHTML = html;
    this.children = [];
  }

  get innerHTML() {
    return this._innerHTML;
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  addEventListener() {}
  removeEventListener() {}
  getBoundingClientRect() {
    return { left: 0, top: 0, width: 600, height: 400 };
  }

  getContext(type) {
    const handler = {
      get(target, prop) {
        if (prop in target) return target[prop];
        if (prop === 'measureText') return (txt) => ({ width: (txt || '').length * 7 });
        return () => {};
      },
      set(target, prop, value) {
        target[prop] = value;
        return true;
      }
    };
    return new Proxy({
      canvas: this,
      fillStyle: '#000',
      strokeStyle: '#000',
      lineWidth: 1
    }, handler);
  }

  querySelector(sel) {
    return new MockElement('mock-sub');
  }

  querySelectorAll(sel) {
    return [];
  }
}

// Set up minimal headless browser globals for visualizers
globalThis.document = {
  getElementById: (id) => new MockElement(id),
  createElement: (tag) => new MockElement('', tag),
  addEventListener: () => {},
  removeEventListener: () => {}
};
globalThis.window = {
  matchMedia: () => ({ matches: false }),
  addEventListener: () => {},
  removeEventListener: () => {}
};
globalThis.requestAnimationFrame = (fn) => setTimeout(fn, 16);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);

// Import the visualizers
const { Landscape3DVisualizer } = await import('../js/viz/landscape3d.js');
const { ChromosomeStrips } = await import('../js/ui/strips.js');
const { Ribbon3DVisualizer } = await import('../js/viz/ribbon3d.js');

function freezeSnapshot(record) {
  if (!record) return null;
  return Object.freeze({
    ...record,
    population: Object.freeze((record.population || []).map(p => Object.freeze({ ...p }))),
    intermediatePopulation: record.intermediatePopulation
      ? Object.freeze(record.intermediatePopulation.map(p => Object.freeze({ ...p })))
      : undefined
  });
}

test('Three 3D Views Isolation: GA engine output is bit-for-bit identical with all three 3D views mounted vs none mounted', () => {
  const presetsToTest = ['ref-roulette', 'ref-tournament', 'lecture-sphere-5bit'];
  const SEED = 424242;

  for (const presetId of presetsToTest) {
    const preset = getPresetById(presetId);
    assert.ok(preset, `Preset ${presetId} must exist`);

    const runConfig = {
      n: preset.n,
      bounds: preset.bounds,
      N: preset.N,
      maxGen: preset.maxGen || 2,
      pc: preset.pc,
      pm: preset.pm,
      selection: preset.selection,
      fitnessMode: preset.fitnessMode,
      C: preset.C,
      elitism: preset.elitism || false,
      problemFn: (x1, x2) => x1 * x1 + x2 * x2,
      problemType: preset.type
    };

    // ==========================================
    // Run A: Zero 3D views mounted (Pure Engine)
    // ==========================================
    const rngA = new Mulberry32(SEED);
    let popA = [...preset.initialPop];
    const historyA = [];
    const rngDrawsA = [];

    // Monkey-patch next to trace all RNG draws without changing output
    const origNextA = rngA.next.bind(rngA);
    rngA.next = () => {
      const val = origNextA();
      rngDrawsA.push(val);
      return val;
    };

    for (let gen = 1; gen <= runConfig.maxGen; gen++) {
      const stepRecords = runGeneration(popA, { ...runConfig, generationIndex: gen }, rngA);
      historyA.push(stepRecords);
      const replaceRecord = stepRecords.find(r => r.phase === 'REPLACE');
      if (replaceRecord && replaceRecord.nextGenEvaluation) {
        popA = replaceRecord.nextGenEvaluation.individuals.map(ind => ind.chromosome);
      }
    }

    // ==========================================
    // Run B: All three 3D views actively mounted
    // ==========================================
    const landscape3D = new Landscape3DVisualizer('landscape-3d-canvas', 'tooltip');
    const strips = new ChromosomeStrips('strips-container');
    const ribbon3D = new Ribbon3DVisualizer('ribbon-3d-canvas');

    const rngB = new Mulberry32(SEED);
    let popB = [...preset.initialPop];
    const historyB = [];
    const rngDrawsB = [];

    const origNextB = rngB.next.bind(rngB);
    rngB.next = () => {
      const val = origNextB();
      rngDrawsB.push(val);
      return val;
    };

    const genStatsHistory = [];

    for (let gen = 1; gen <= runConfig.maxGen; gen++) {
      const stepRecords = runGeneration(popB, { ...runConfig, generationIndex: gen }, rngB);

      // Pass each step to all three 3D views exactly as main.js does
      for (const record of stepRecords) {
        const frozen = freezeSnapshot(record);

        // View 1: 3D Landscape
        landscape3D.updateSnapshot(frozen, runConfig, []);
        landscape3D.render();

        // View 2: 3D Chromosome Strips
        const ind = frozen.population?.[0] || null;
        strips.render(ind, 0, frozen, runConfig.n, runConfig.bounds, '****');

        // Collect stats for Ribbon
        if (record.phase === 'DECODE_EVAL') {
          const stats = {
            generationIndex: gen,
            bestF: Math.max(...record.population.map(p => p.F)),
            avgF: record.population.reduce((sum, p) => sum + p.F, 0) / record.population.length,
            worstF: Math.min(...record.population.map(p => p.F)),
            diversity: 0.5
          };
          genStatsHistory.push(stats);
        }

        // View 3: 3D Ribbon Convergence
        ribbon3D.updateSnapshot(genStatsHistory, gen);
        ribbon3D.render();
      }

      historyB.push(stepRecords);
      const replaceRecord = stepRecords.find(r => r.phase === 'REPLACE');
      if (replaceRecord && replaceRecord.nextGenEvaluation) {
        popB = replaceRecord.nextGenEvaluation.individuals.map(ind => ind.chromosome);
      }
    }

    // Cleanup loops
    landscape3D.stopLoop();
    ribbon3D.stopLoop();

    // ==========================================
    // Assert Bit-for-Bit Determinism & Identity
    // ==========================================
    assert.equal(historyA.length, historyB.length, 'Generation counts must match');
    assert.equal(rngDrawsA.length, rngDrawsB.length, 'Total RNG draws must be identical');

    for (let d = 0; d < rngDrawsA.length; d++) {
      assert.equal(rngDrawsA[d], rngDrawsB[d], `RNG draw #${d} must match`);
    }

    for (let g = 0; g < historyA.length; g++) {
      const stepsA = historyA[g];
      const stepsB = historyB[g];
      assert.equal(stepsA.length, stepsB.length, `Generation ${g + 1} step counts must match`);

      for (let s = 0; s < stepsA.length; s++) {
        const recA = stepsA[s];
        const recB = stepsB[s];

        assert.equal(recA.phase, recB.phase, `Step ${s} phase must match`);
        assert.equal(recA.generationIndex, recB.generationIndex, `Step ${s} gen index must match`);

        // Check population chromosomes and fitness values
        if (recA.population && recB.population) {
          assert.equal(recA.population.length, recB.population.length);
          for (let i = 0; i < recA.population.length; i++) {
            assert.equal(recA.population[i].chromosome, recB.population[i].chromosome);
            assert.equal(recA.population[i].f, recB.population[i].f);
            assert.equal(recA.population[i].F, recB.population[i].F);
            assert.equal(recA.population[i].x1, recB.population[i].x1);
            assert.equal(recA.population[i].x2, recB.population[i].x2);
          }
        }

        // Check Crossover metadata
        if (recA.crossoverPairs && recB.crossoverPairs) {
          assert.deepEqual(recA.crossoverPairs, recB.crossoverPairs);
        }

        // Check Mutation metadata
        if (recA.flips && recB.flips) {
          assert.deepEqual(recA.flips, recB.flips);
        }
      }
    }
  }
});
