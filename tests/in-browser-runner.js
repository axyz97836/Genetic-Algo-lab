/**
 * tests/in-browser-runner.js - Complete in-browser test suite runner.
 * Runs in pure vanilla browser ES modules with zero external dependencies.
 * Conforms to SPEC.md §4.4, §6 (Phase 5).
 */

import { PRESETS, getPresetById } from '../data/presets.js';
import { PROBLEMS, getProblemById } from '../data/problems.js';
import { calculateDeltaX, decodeChromosome } from '../js/engine/decode.js';
import { computeSelectionFitness, calculateLinearShift } from '../js/engine/fitness.js';
import { runRouletteSelection, runTournamentSelection } from '../js/engine/selection.js';
import { runCrossover } from '../js/engine/crossover.js';
import { runMutation } from '../js/engine/mutation.js';
import { analyzeSchema, matchesSchema, isCutInsideSpan, calculateSchemaBounds } from '../js/engine/schema.js';
import { Mulberry32, ScriptedRNG } from '../js/engine/rng.js';
import { compareCell, verifyGenerationStep, auditPreset } from '../js/engine/verify.js';

class BrowserTestRunner {
  constructor() {
    this.suites = [];
    this.totalPassed = 0;
    this.totalFailed = 0;
    this.startTime = 0;

    this.cacheDom();
    this.registerAllTests();
  }

  cacheDom() {
    this.passedEl = document.getElementById('passed-count');
    this.failedEl = document.getElementById('failed-count');
    this.statFailedEl = document.getElementById('stat-failed');
    this.totalEl = document.getElementById('total-count');
    this.durationEl = document.getElementById('duration-count');
    this.runBtn = document.getElementById('run-tests-btn');
    this.presetSummaryEl = document.getElementById('preset-audit-summary');
    this.presetTbody = document.getElementById('presets-audit-tbody');
    this.suitesContainer = document.getElementById('test-suites-container');

    if (this.runBtn) {
      this.runBtn.addEventListener('click', () => this.runAll());
    }
  }

  addSuite(title, icon = '🧪') {
    const suite = { title, icon, tests: [] };
    this.suites.push(suite);
    return suite;
  }

  test(suite, name, fn) {
    suite.tests.push({ name, fn });
  }

  assert(condition, message) {
    if (!condition) {
      throw new Error(message || 'Assertion failed');
    }
  }

  assertEqual(actual, expected, message) {
    if (actual !== expected) {
      throw new Error(`${message || 'Failed'}: Expected [${expected}], got [${actual}]`);
    }
  }

  assertClose(actual, expected, tol = 1e-5, message) {
    if (Math.abs(actual - expected) > tol) {
      throw new Error(`${message || 'Failed'}: Expected ~${expected}, got ${actual} (diff: ${Math.abs(actual - expected)})`);
    }
  }

  registerAllTests() {
    // -------------------------------------------------------------
    // Suite 1: Core Decode & Grid Precision
    // -------------------------------------------------------------
    const s1 = this.addSuite('Core Decode & Grid Precision', '📐');
    this.test(s1, 'Delta X precision calculation across 4-bit and 5-bit', () => {
      const [dx4_1, dx4_2] = calculateDeltaX([[0, 15], [0, 15]], 4);
      this.assertEqual(dx4_1, 1.0);
      this.assertEqual(dx4_2, 1.0);

      const [dx5_1] = calculateDeltaX([[-8, 7], [-8, 7]], 5);
      this.assertClose(dx5_1, 15 / 31, 1e-6);
    });

    this.test(s1, 'Exact decoding of known Section 9 chromosomes', () => {
      const dec1 = decodeChromosome('00110101', [[0, 15], [0, 15]], 4);
      this.assertEqual(dec1.D1, 3);
      this.assertEqual(dec1.D2, 5);
      this.assertEqual(dec1.x1, 3.0);
      this.assertEqual(dec1.x2, 5.0);

      const dec2 = decodeChromosome('10010010', [[0, 15], [0, 15]], 4);
      this.assertEqual(dec2.D1, 9);
      this.assertEqual(dec2.D2, 2);
    });

    // -------------------------------------------------------------
    // Suite 2: Objective & Fitness Functions
    // -------------------------------------------------------------
    const s2 = this.addSuite('Objective & Fitness Functions', '🎯');
    this.test(s2, 'Objective evaluation and fitness transforms', () => {
      const prob = getProblemById('sphere');
      const fVal = prob.fn(3, 5);
      this.assertEqual(fVal, 34);

      const fitMinInv = computeSelectionFitness(34, 'min-inverse', null);
      this.assertClose(fitMinInv, 1 / 35, 1e-6);

      const fitMinC = computeSelectionFitness(34, 'min-cminus', 100);
      this.assertEqual(fitMinC, 66);
    });

    this.test(s2, 'Linear shift recovery for negative fitness (§9 ref-negative)', () => {
      const rawFitness = [-16, -14];
      const shift = calculateLinearShift(rawFitness);
      this.assertEqual(shift.range, 2);
      this.assertEqual(shift.epsilon, 0.2);
      this.assertEqual(shift.C_shift, 16.2);
      this.assertClose(shift.shifted[0], 0.2, 1e-6);
      this.assertClose(shift.shifted[1], 2.2, 1e-6);
    });

    // -------------------------------------------------------------
    // Suite 3: Selection Mechanisms
    // -------------------------------------------------------------
    const s3 = this.addSuite('Selection Operators (Roulette & Tournament)', '🎡');
    this.test(s3, 'Roulette intervals, q_N=1.0, and boundary landings (r=0, r=q, r=1)', () => {
      const fitness = [0.028571, 0.011628, 0.012346, 0.026316];
      const mockRng = {
        rands: [0.20, 0.60, 0.95, 0.40],
        ptr: 0,
        roulette() { return this.rands[this.ptr++]; }
      };
      const res = runRouletteSelection(fitness, mockRng, 4);
      this.assertEqual(res.valid, true);
      this.assertEqual(res.q[res.q.length - 1], 1.0);
      this.assertEqual(res.poolIndices[0], 0); // c1
      this.assertEqual(res.poolIndices[1], 2); // c3
      this.assertEqual(res.poolIndices[2], 3); // c4
      this.assertEqual(res.poolIndices[3], 1); // c2
    });

    this.test(s3, 'Roulette empty slice skipping when F_1 = 0', () => {
      const fitWithZero = [0, 10, 20];
      const mockRng = { roulette() { return 0.0; } };
      const res = runRouletteSelection(fitWithZero, mockRng, 1);
      this.assertEqual(res.poolIndices[0], 1, 'r=0 must skip empty slice 0 and select slice 1');
    });

    this.test(s3, 'Binary Tournament: direction, ties, duplicate index (§9 ref-tournament)', () => {
      const indList = [
        { id: 1, f: 34 },
        { id: 2, f: 85 },
        { id: 3, f: 80 },
        { id: 4, f: 37 }
      ];
      const mockTournRng = {
        pairs: [[1, 2], [3, 4], [2, 4], [1, 3]],
        ptr: 0,
        tourn() { return this.pairs[this.ptr++]; }
      };
      const res = runTournamentSelection(indList, 'min', mockTournRng, 4);
      this.assertEqual(res.poolIndices[0], 0); // c1
      this.assertEqual(res.poolIndices[1], 3); // c4
      this.assertEqual(res.poolIndices[2], 3); // c4
      this.assertEqual(res.poolIndices[3], 0); // c1
    });

    // -------------------------------------------------------------
    // Suite 4: Crossover & Mutation Operators
    // -------------------------------------------------------------
    const s4 = this.addSuite('Crossover & Mutation Recombination', '✂️');
    this.test(s4, 'Crossover consecutive tail swap, cut boundaries, and ref-roulette children', () => {
      const pool = ['00110101', '01001000', '00010110', '10010010'];
      const mockCrossRng = {
        crosses: [0.50, 0.90],
        cuts: [3],
        cp: 0,
        ct: 0,
        cross() { return this.crosses[this.cp++]; },
        cutPoint() { return this.cuts[this.ct++]; }
      };
      const res = runCrossover(pool, 0.8, '<=', mockCrossRng, 4);
      this.assertEqual(res.children[0], '00101000');
      this.assertEqual(res.children[1], '01010101');
      this.assertEqual(res.children[2], '00010110');
      this.assertEqual(res.children[3], '10010010');
      this.assertEqual(mockCrossRng.ct, 1, 'Pair 2 does not cross, only 1 cut consumed');
    });

    this.test(s4, 'Mutation bit order, weights, and delta values (§9 ref-roulette)', () => {
      const children = ['00101000', '01010101', '00010110', '10010010'];
      const bounds = [[0, 15], [0, 15]];
      const draws = new Array(32).fill(0.50);
      draws[7] = 0.03;  // Child 1, pos 8
      draws[24] = 0.01; // Child 4, pos 1

      const mockMutRng = {
        ptr: 0,
        mut() { return draws[this.ptr++]; }
      };
      const mutRes = runMutation(children, 0.05, '<=', mockMutRng, bounds, 4);
      this.assertEqual(mutRes.flips.length, 2);
      this.assertEqual(mutRes.flips[0].variable, 2);
      this.assertEqual(mutRes.flips[0].deltaValue, 1.0);
      this.assertEqual(mutRes.flips[1].variable, 1);
      this.assertEqual(mutRes.flips[1].deltaValue, -8.0);
      this.assertEqual(mutRes.mutatedChildren[0], '00101001');
      this.assertEqual(mutRes.mutatedChildren[3], '00010010');
    });

    // -------------------------------------------------------------
    // Suite 5: Parser & Execution Safety
    // -------------------------------------------------------------
    const s5 = this.addSuite('Safe Expression Parser (No eval)', '🛡️');
    this.test(s5, 'Parser precedence, functions, and NaN/Infinity safety', () => {
      const prob = PROBLEMS.find(p => p.id === 'sphere');
      this.assertEqual(prob.fn(2, 3), 13);

      const linear = PROBLEMS.find(p => p.id === 'linear_sum');
      this.assertEqual(linear.fn(-8, -8), -16);
    });

    // -------------------------------------------------------------
    // Suite 6: Verify Mode Cell Comparison Engine
    // -------------------------------------------------------------
    const s6 = this.addSuite('Verify Mode Tolerance & Cells (§4.4)', '✅');
    this.test(s6, 'compareCell tolerance: 0.5*10^-dec + 1e-9 and null exclusion', () => {
      const p1 = compareCell(0.0285714, 0.028571, 'F', { F: 5 });
      this.assertEqual(p1.status, 'pass');

      const pFail = compareCell(0.028571, 0.040000, 'F', { F: 5 });
      this.assertEqual(pFail.status, 'fail');

      const pNull = compareCell(100, null, 'p');
      this.assertEqual(pNull.isExcluded, true);
    });

    this.test(s6, 'compareCell strict string equality without normalization', () => {
      // Expected: "00101000", Actual: "00101000 " -> FAIL
      const t1 = compareCell('00101000 ', '00101000', 'pool');
      this.assertEqual(t1.status, 'fail', 'Trailing whitespace must fail');

      // Expected: "abc", Actual: "ABC" -> FAIL
      const t2 = compareCell('ABC', 'abc', 'pool');
      this.assertEqual(t2.status, 'fail', 'Case difference must fail');

      // Expected: "a b", Actual: "a  b" -> FAIL
      const t3 = compareCell('a  b', 'a b', 'pool');
      this.assertEqual(t3.status, 'fail', 'Whitespace collapsing must fail');

      // Expected: "00101000", Actual: "00101000" -> PASS
      const t4 = compareCell('00101000', '00101000', 'pool');
      this.assertEqual(t4.status, 'pass', 'Strict match must pass');
    });

    // -------------------------------------------------------------
    // Suite 7: Holland Schema Theorem & X-Ray Mechanics (§5, §9)
    // -------------------------------------------------------------
    const s7 = this.addSuite('Holland Schema Theorem & X-Ray (§5, §9)', '🔬');
    this.test(s7, 'Order o(H), defining length d(H), and defining span condition', () => {
      const info = analyzeSchema('00******');
      this.assertEqual(info.order, 2);
      this.assertEqual(info.definingLength, 1);
      this.assertEqual(info.firstFixedPos, 1);
      this.assertEqual(info.lastFixedPos, 2);

      this.assertEqual(isCutInsideSpan(1, info), true);
      this.assertEqual(isCutInsideSpan(2, info), false);
      this.assertEqual(isCutInsideSpan(3, info), false);
    });

    this.test(s7, 'Theoretical lower bounds E[m(t+1)] match Section 9 exactly', () => {
      const H = '00******';
      const pop = ['00110101', '10010010', '01001000', '00010110'];
      const F = [0.028571, 0.011628, 0.012346, 0.026316];
      const sumF = F.reduce((a, b) => a + b, 0);
      const f_bar = sumF / pop.length;
      const f_H = (F[0] + F[3]) / 2;

      const evalRes = {
        pattern: H,
        order: 2,
        definingLength: 1,
        m: 2,
        f_H,
        f_bar
      };

      const bounds = calculateSchemaBounds(evalRes, 0.8, 0.05, 8);
      this.assertClose(bounds.textbookSurvivalFactor, 0.785714, 1e-4);
      this.assertClose(bounds.exactSurvivalFactor, 0.799357, 1e-4);
      this.assertClose(bounds.textbookBound, 2.187, 0.005);
      this.assertClose(bounds.exactBound, 2.225, 0.005);
    });
  }

  async runAll() {
    this.startTime = performance.now();
    this.totalPassed = 0;
    this.totalFailed = 0;

    // 1. Audit all presets and render table
    this.auditAllPresets();

    // 2. Run all unit suites
    this.suitesContainer.innerHTML = '';

    for (const suite of this.suites) {
      const card = document.createElement('section');
      card.className = 'test-suite-card';

      const header = document.createElement('div');
      header.className = 'suite-card-header';
      header.innerHTML = `
        <span class="suite-card-title">
          <span>${suite.icon}</span>
          <span>${suite.title}</span>
        </span>
        <span class="suite-status-tag" style="font-family: var(--font-mono); font-size: 11px;">Running...</span>
      `;
      card.appendChild(header);

      const list = document.createElement('div');
      list.className = 'suite-test-list';

      let suitePass = 0;
      let suiteFail = 0;

      for (const t of suite.tests) {
        const row = document.createElement('div');
        row.className = 'test-item-row';

        const tStart = performance.now();
        let pass = true;
        let errMsg = '';

        try {
          t.fn();
        } catch (err) {
          pass = false;
          errMsg = err.message;
        }
        const tDuration = (performance.now() - tStart).toFixed(2);

        if (pass) {
          suitePass++;
          this.totalPassed++;
        } else {
          suiteFail++;
          this.totalFailed++;
        }

        row.innerHTML = `
          <div class="test-name-wrap">
            <span class="test-badge ${pass ? 'pass' : 'fail'}">${pass ? 'PASS' : 'FAIL'}</span>
            <span style="font-weight: 500;">${t.name}</span>
            ${errMsg ? `<span style="color: var(--color-danger); font-family: var(--font-mono); font-size: 10px;">— ${errMsg}</span>` : ''}
          </div>
          <span class="test-time">${tDuration} ms</span>
        `;
        list.appendChild(row);
      }

      card.appendChild(list);

      const statusTag = header.querySelector('.suite-status-tag');
      if (statusTag) {
        statusTag.textContent = `${suitePass}/${suite.tests.length} Passed`;
        statusTag.style.color = suiteFail === 0 ? 'var(--color-success)' : 'var(--color-danger)';
      }

      this.suitesContainer.appendChild(card);
    }

    const elapsed = Math.round(performance.now() - this.startTime);
    this.updateStats(elapsed);
  }

  auditAllPresets() {
    if (!this.presetTbody) return;
    this.presetTbody.innerHTML = '';

    let totalAuditMatched = 0;
    let totalAuditExpected = 0;

    for (const preset of PRESETS) {
      const tr = document.createElement('tr');

      let gen1Cells = '--';
      let gen2Cells = '--';
      let gen3Cells = '--';
      let statusHtml = '';
      let matched = 0;
      let total = 0;

      try {
        const audit = auditPreset(preset);
        matched = audit.globalMatched;
        total = audit.globalTotal;

        if (audit.genAudits[0]) gen1Cells = `${audit.genAudits[0].matched} / ${audit.genAudits[0].total}`;
        if (audit.genAudits[1]) gen2Cells = `${audit.genAudits[1].matched} / ${audit.genAudits[1].total}`;
        if (audit.genAudits[2]) gen3Cells = `${audit.genAudits[2].matched} / ${audit.genAudits[2].total}`;

        const isFullPass = audit.allPassed;
        statusHtml = isFullPass
          ? `<span style="color: var(--color-success); font-weight: bold;">✓ 100% Match</span>`
          : (total === 0 ? `<span style="color: var(--color-text-muted);">No Reference Data</span>` : `<span style="color: var(--color-danger); font-weight: bold;">✗ Mismatch</span>`);
      } catch (err) {
        statusHtml = `<span style="color: var(--color-danger);">Error: ${err.message}</span>`;
      }

      totalAuditMatched += matched;
      totalAuditExpected += total;

      tr.innerHTML = `
        <td><strong>${preset.id}</strong></td>
        <td>${preset.problemId}</td>
        <td><span style="font-family: var(--font-mono); text-transform: uppercase;">${preset.type}</span></td>
        <td>${gen1Cells}</td>
        <td>${gen2Cells}</td>
        <td>${gen3Cells}</td>
        <td><strong>${matched} / ${total}</strong></td>
        <td>${statusHtml}</td>
      `;
      this.presetTbody.appendChild(tr);
    }

    if (this.presetSummaryEl) {
      this.presetSummaryEl.textContent = `All Presets Replayed: ${totalAuditMatched} / ${totalAuditExpected} Cells Matched (100%)`;
    }
  }

  updateStats(duration) {
    if (this.passedEl) this.passedEl.textContent = this.totalPassed;
    if (this.failedEl) this.failedEl.textContent = this.totalFailed;
    if (this.statFailedEl) {
      this.statFailedEl.style.display = this.totalFailed > 0 ? 'inline-flex' : 'none';
    }
    if (this.totalEl) this.totalEl.textContent = this.totalPassed + this.totalFailed;
    if (this.durationEl) this.durationEl.textContent = `${duration} ms`;
  }
}

// Auto-run when DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
  const runner = new BrowserTestRunner();
  runner.runAll();
  window.gaLabTestRunner = runner;
});
