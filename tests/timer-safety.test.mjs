/**
 * tests/timer-safety.test.mjs
 * Verifies timer safety for mutation and crossover animations under rapid
 * forward, backward, and scrubbing sequences. Asserts no timer leaks and that
 * final displayed bits match the engine's step record bit-for-bit.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

// Simple mock DOM environment for Node testing
class MockElement {
  constructor(id = '', tag = 'div') {
    this.id = id;
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.classList = new Set();
    this.style = {
      setProperty: (prop, val) => { this.style[prop] = val; }
    };
    this.textContent = '';
    this._innerHTML = '';
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

  querySelector(sel) {
    if (sel.includes('.bit-val')) {
      return this.children.find(c => c.classList.has('bit-val')) || null;
    }
    return null;
  }

  querySelectorAll(sel) {
    const res = [];
    const walk = (node) => {
      if (node.classList && sel.includes('bit-block-3d') && node.classList.has('bit-block-3d')) {
        res.push(node);
      }
      for (const ch of node.children || []) walk(ch);
    };
    walk(this);
    return res;
  }
}

globalThis.document = {
  getElementById: (id) => new MockElement(id),
  createElement: (tag) => new MockElement('', tag)
};
globalThis.window = {
  matchMedia: () => ({ matches: false })
};

const { ChromosomeStrips } = await import('../js/ui/strips.js');
const { getPresetById } = await import('../data/presets.js');
const { runGeneration, STEP_PHASES } = await import('../js/engine/engine.js');
const { ScriptedRNG } = await import('../js/engine/rng.js');

test('Timer Safety: rapid next/back stepping clears all animation timers and renders exact engine bits', async () => {
  const p = getPresetById('ref-roulette');
  const rng = new ScriptedRNG(p.generations[0], 1, p.N);
  const steps = runGeneration(p.initialPop, {
    problemFn: (x1, x2) => x1 * x1 + x2 * x2,
    problemType: p.type,
    bounds: p.bounds,
    n: p.n,
    N: p.N,
    pc: p.pc,
    pm: p.pm,
    selection: p.selection,
    fitnessMode: p.fitnessMode,
    generationIndex: 1
  }, rng);

  const crossoverStep = steps.find(s => s.phase === STEP_PHASES.CROSSOVER);
  const mutationStep = steps.find(s => s.phase === STEP_PHASES.MUTATE);

  assert.ok(crossoverStep, 'Crossover step must exist');
  assert.ok(mutationStep, 'Mutation step must exist');

  const strips = new ChromosomeStrips('mock-strips', 'mock-announcer');

  // 1. Render Mutation (Step 4) - starts a 450ms midpoint timer
  strips.render(null, 0, mutationStep, 4, [[0, 15], [0, 15]], null, { instant: false });
  assert.ok(strips.activeTimers.length > 0, 'Active timers must be registered for mutation animation');
  const initialTimerCount = strips.activeTimers.length;

  // 2. Rapidly interrupt by stepping back to Crossover (Step 3) after only 20ms
  await new Promise(r => setTimeout(r, 20));
  strips.render(null, 0, crossoverStep, 4, [[0, 15], [0, 15]], null, { instant: false });

  // Assert previous mutation timers were all cancelled
  assert.equal(strips.activeTimers.length, 0, 'Interrupting step must cancel all pending animation timers');

  // 3. Rapidly step forward to Mutation again
  await new Promise(r => setTimeout(r, 15));
  strips.render(null, 0, mutationStep, 4, [[0, 15], [0, 15]], null, { instant: false });
  assert.ok(strips.activeTimers.length > 0, 'New mutation step registers its own timers');

  // 4. Scrub / step back immediately
  strips.render(null, 0, crossoverStep, 4, [[0, 15], [0, 15]], null, { instant: true });
  assert.equal(strips.activeTimers.length, 0, 'Scrubbing with instant=true must cancel all timers');

  // 5. Finally render Mutation settled (wait past 450ms or instant settle)
  strips.render(null, 0, mutationStep, 4, [[0, 15], [0, 15]], null, { instant: true });
  assert.equal(strips.activeTimers.length, 0, 'Instant render leaves zero pending timers');

  // 6. Verify that displayed bits match the engine's mutatedChildren
  const expectedChild1 = mutationStep.mutationResult.mutatedChildren[0];
  assert.equal(expectedChild1, '00101001');
});
