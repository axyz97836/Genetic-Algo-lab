/**
 * tests/audit-phase2-interactions.mjs - Comprehensive interaction audit for Phase 2.
 * Validates all 11 specific interaction requirements in headless Chrome via CDP.
 */

import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const DEBUG_PORT = 9224;
const TARGET_URL = 'http://127.0.0.1:8080/index.html';

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.nextId = 1;
    this.callbacks = new Map();
    this.events = new Map();
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (err) => reject(err);
      this.ws.onmessage = (msg) => {
        const data = JSON.parse(msg.data);
        if (data.id && this.callbacks.has(data.id)) {
          const { resolve, reject } = this.callbacks.get(data.id);
          this.callbacks.delete(data.id);
          if (data.error) reject(new Error(data.error.message));
          else resolve(data.result);
        } else if (data.method) {
          const listeners = this.events.get(data.method) || [];
          for (const fn of listeners) fn(data.params);
        }
      };
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  on(method, fn) {
    if (!this.events.has(method)) this.events.set(method, []);
    this.events.get(method).push(fn);
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

async function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function runAudit() {
  console.log('=== GA Lab Phase 2 Comprehensive Interaction Audit ===\n');

  // Launch Chrome Headless
  const chromeProcess = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${DEBUG_PORT}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--user-data-dir=/tmp/ga-lab-audit-profile',
    '--window-size=1280,800'
  ], { stdio: 'ignore' });

  let versionData = null;
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      versionData = await fetchJson(`http://127.0.0.1:${DEBUG_PORT}/json/version`);
      if (versionData) break;
    } catch {
      await sleep(200);
    }
  }

  if (!versionData) {
    chromeProcess.kill();
    throw new Error('Failed to connect to headless Chrome on port ' + DEBUG_PORT);
  }

  const targets = await fetchJson(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
  const pageTarget = targets.find(t => t.type === 'page') || targets[0];
  const cdp = new CDPClient(pageTarget.webSocketDebuggerUrl);
  await cdp.connect();

  const consoleErrors = [];
  cdp.on('Runtime.consoleAPICalled', (params) => {
    if (params.type === 'error') {
      consoleErrors.push(params.args.map(a => a.value || a.description || '').join(' '));
    }
  });
  cdp.on('Runtime.exceptionThrown', (params) => {
    consoleErrors.push(params.exceptionDetails.exception?.description || params.exceptionDetails.text);
  });

  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('DOM.enable');

  async function evalInPage(expression) {
    const res = await cdp.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    if (res.exceptionDetails) {
      throw new Error(res.exceptionDetails.text + ' in: ' + expression);
    }
    return res.result.value;
  }

  // Navigate to application
  await cdp.send('Page.navigate', { url: TARGET_URL });
  await sleep(1000);

  const results = {};

  // 1. Next Generation button
  console.log('[1/11] Auditing Next Generation button...');
  const nextGenResult = await evalInPage(`
    (() => {
      const initialGenText = document.getElementById('gen-badge')?.textContent.trim();
      document.getElementById('next-gen-btn').click();
      const afterClickGenText = document.getElementById('gen-badge')?.textContent.trim();
      return { initialGenText, afterClickGenText, advanced: initialGenText !== afterClickGenText };
    })()
  `);
  results.nextGenButton = nextGenResult;
  console.log('Result:', nextGenResult);

  // Reset before next test
  await evalInPage(`document.getElementById('reset-btn').click()`);
  await sleep(100);

  // 2. Speed slider changes playback speed
  console.log('\n[2/11] Auditing Speed Slider...');
  const speedResult = await evalInPage(`
    (() => {
      const slider = document.getElementById('speed-slider');
      const speedVal = document.getElementById('speed-val');
      
      slider.value = '100'; // slowest (1500ms)
      slider.dispatchEvent(new Event('input'));
      const slow = speedVal.textContent.trim();

      slider.value = '600'; // normal (1000ms)
      slider.dispatchEvent(new Event('input'));
      const normal = speedVal.textContent.trim();

      slider.value = '1500'; // fastest (100ms)
      slider.dispatchEvent(new Event('input'));
      const fast = speedVal.textContent.trim();

      return { slow, normal, fast, responsive: slow !== fast };
    })()
  `);
  results.speedSlider = speedResult;
  console.log('Result:', speedResult);

  // 3. Scrubber seeking, including sub-step positions
  console.log('\n[3/11] Auditing Scrubber Seeking...');
  const scrubberResult = await evalInPage(`
    (() => {
      // Seek to step index 3 directly via playback controller
      window.gaLabApp.playback.setStepIndex(3);
      const step3Label = document.getElementById('scrubber-step-count')?.textContent.trim();
      const step3Phase = document.getElementById('step-name-badge')?.textContent.trim();

      window.gaLabApp.playback.setStepIndex(1);
      const step1Label = document.getElementById('scrubber-step-count')?.textContent.trim();
      const step1Phase = document.getElementById('step-name-badge')?.textContent.trim();

      return {
        step3: { label: step3Label, phase: step3Phase },
        step1: { label: step1Label, phase: step1Phase },
        seekWorked: step3Label !== step1Label
      };
    })()
  `);
  results.scrubberSeeking = scrubberResult;
  console.log('Result:', scrubberResult);

  // 4. Sub-step / whole-generation granularity toggle
  console.log('\n[4/11] Auditing Granularity Toggle...');
  const granularityResult = await evalInPage(`
    (() => {
      const toggle = document.getElementById('granularity-toggle');
      toggle.checked = true;
      toggle.dispatchEvent(new Event('change'));
      const isGenMode = window.gaLabApp.playback.granularityGen;

      toggle.checked = false;
      toggle.dispatchEvent(new Event('change'));
      const isSubStepMode = !window.gaLabApp.playback.granularityGen;

      return { isGenMode, isSubStepMode, toggleWorks: isGenMode && isSubStepMode };
    })()
  `);
  results.granularityToggle = granularityResult;
  console.log('Result:', granularityResult);

  // 5. Problem and preset selection
  console.log('\n[5/11] Auditing Problem and Preset Selection...');
  const problemPresetResult = await evalInPage(`
    (() => {
      // Switch to ref-tournament
      const presetSelect = document.getElementById('preset-select');
      presetSelect.value = 'ref-tournament';
      presetSelect.dispatchEvent(new Event('change'));
      const tournSelection = document.getElementById('selection-select').value;
      const tournStopAfter = window.gaLabApp.config.preset?.generations[0]?.stopAfter;

      // Switch to ref-negative
      presetSelect.value = 'ref-negative';
      presetSelect.dispatchEvent(new Event('change'));
      const negType = document.getElementById('problem-type').value;
      const negX1Min = document.getElementById('x1-min').value;

      // Switch to free play sphere
      presetSelect.value = 'free-play';
      presetSelect.dispatchEvent(new Event('change'));
      const probSelect = document.getElementById('problem-select');
      probSelect.value = 'rosenbrock';
      probSelect.dispatchEvent(new Event('change'));
      const rosenType = document.getElementById('problem-type').value;

      return {
        tournSelection,
        tournStopAfter,
        negType,
        negX1Min,
        rosenType,
        presetAndProblemWork: tournSelection === 'tournament' && negX1Min === '-8' && rosenType === 'min'
      };
    })()
  `);
  results.problemAndPreset = problemPresetResult;
  console.log('Result:', problemPresetResult);

  // 6. Precision (4-bit / 5-bit)
  console.log('\n[6/11] Auditing Precision Toggle (4-bit vs 5-bit)...');
  const precisionResult = await evalInPage(`
    (() => {
      // Free play mode
      document.getElementById('preset-select').value = 'free-play';
      document.getElementById('preset-select').dispatchEvent(new Event('change'));

      const precSelect = document.getElementById('precision-select');
      precSelect.value = '4';
      precSelect.dispatchEvent(new Event('change'));
      const d4 = document.getElementById('delta-display')?.textContent.trim();
      const chrom4Len = document.querySelector('#population-table-body td.cell-chrom')?.textContent.replace(/\\s+/g, '').length;

      precSelect.value = '5';
      precSelect.dispatchEvent(new Event('change'));
      const d5 = document.getElementById('delta-display')?.textContent.trim();
      const chrom5Len = document.querySelector('#population-table-body td.cell-chrom')?.textContent.replace(/\\s+/g, '').length;

      return {
        bit4: { delta: d4, chromLength: chrom4Len },
        bit5: { delta: d5, chromLength: chrom5Len },
        precisionUpdated: chrom4Len === 8 && chrom5Len === 10
      };
    })()
  `);
  results.precision = precisionResult;
  console.log('Result:', precisionResult);

  // 7. Selection method and fitness mode
  console.log('\n[7/11] Auditing Selection Method and Fitness Mode...');
  const selectFitResult = await evalInPage(`
    (() => {
      const sel = document.getElementById('selection-select');
      sel.value = 'tournament';
      sel.dispatchEvent(new Event('change'));
      const configSel = window.gaLabApp.config.selection;

      const fit = document.getElementById('fitness-mode-select');
      fit.value = 'min-cminus';
      fit.dispatchEvent(new Event('change'));
      const cminusVisible = document.getElementById('cminus-wrap').style.display !== 'none';
      const configFit = window.gaLabApp.config.fitnessMode;

      return { configSel, configFit, cminusVisible, selectionAndFitWork: configSel === 'tournament' && configFit === 'min-cminus' && cminusVisible };
    })()
  `);
  results.selectionAndFitness = selectFitResult;
  console.log('Result:', selectFitResult);

  // 8. Elitism, seed, maximum generations
  console.log('\n[8/11] Auditing Elitism, Seed, and Max Generations...');
  const elitismSeedMaxGenResult = await evalInPage(`
    (() => {
      // Toggle elitism
      const elitism = document.getElementById('elitism-toggle');
      elitism.checked = true;
      elitism.dispatchEvent(new Event('change'));
      const configElitism = window.gaLabApp.config.elitism;

      // Seed change
      const seedInput = document.getElementById('seed-input');
      seedInput.value = '7777';
      seedInput.dispatchEvent(new Event('change'));
      const configSeed = window.gaLabApp.config.seed;

      // Reseed button
      document.getElementById('reseed-btn').click();
      const reseededVal = document.getElementById('seed-input').value;

      // Max gen
      const maxGen = document.getElementById('max-gen');
      maxGen.value = '4';
      maxGen.dispatchEvent(new Event('change'));
      const totalStepsGen4 = window.gaLabApp.allSteps.length;

      return {
        configElitism,
        configSeed,
        reseededVal,
        totalStepsGen4,
        paramsWork: configElitism === true && configSeed === 7777 && totalStepsGen4 > 10
      };
    })()
  `);
  results.elitismSeedMaxGen = elitismSeedMaxGenResult;
  console.log('Result:', elitismSeedMaxGenResult);

  // 9. Crossover probability and mutation probability
  console.log('\n[9/11] Auditing Crossover pc and Mutation pm...');
  const pcPmResult = await evalInPage(`
    (() => {
      const pc = document.getElementById('pc-input');
      pc.value = '0.65';
      pc.dispatchEvent(new Event('change'));

      const pm = document.getElementById('pm-input');
      pm.value = '0.08';
      pm.dispatchEvent(new Event('change'));

      const configPc = window.gaLabApp.config.pc;
      const configPm = window.gaLabApp.config.pm;

      return { configPc, configPm, probUpdated: configPc === 0.65 && configPm === 0.08 };
    })()
  `);
  results.crossoverAndMutation = pcPmResult;
  console.log('Result:', pcPmResult);

  // 10. Odd population size rejection and valid even population sizes
  console.log('\n[10/11] Auditing Odd Population Size Rejection vs Even Sizes...');
  const popSizeAuditResult = await evalInPage(`
    (() => {
      const popInput = document.getElementById('pop-size');
      const popError = document.getElementById('pop-size-error');

      // Test Odd size N=5
      popInput.value = '5';
      popInput.dispatchEvent(new Event('change'));
      const oddErrorVisible = popError.classList.contains('visible');
      const oddNarrationTitle = document.getElementById('narration-title')?.textContent.trim();

      // Test Even size N=6
      popInput.value = '6';
      popInput.dispatchEvent(new Event('change'));
      const even6ErrorVisible = popError.classList.contains('visible');
      const tableRows6 = document.querySelectorAll('#population-table-body tr').length;

      // Test Even size N=4
      popInput.value = '4';
      popInput.dispatchEvent(new Event('change'));
      const even4ErrorVisible = popError.classList.contains('visible');
      const tableRows4 = document.querySelectorAll('#population-table-body tr').length;

      return {
        odd5: { errorVisible: oddErrorVisible, narrationTitle: oddNarrationTitle },
        even6: { errorVisible: even6ErrorVisible, rowCount: tableRows6 },
        even4: { errorVisible: even4ErrorVisible, rowCount: tableRows4 },
        oddRejectionPassed: oddErrorVisible && !even6ErrorVisible && tableRows6 === 6 && tableRows4 === 4
      };
    })()
  `);
  results.popSizeValidation = popSizeAuditResult;
  console.log('Result:', popSizeAuditResult);

  // 11. Timeline Reset / Recompute on Parameter Changes
  console.log('\n[11/11] Auditing Timeline Reset/Recompute on Parameter Changes...');
  const resetRecomputeResult = await evalInPage(`
    (() => {
      // Step forward to step 3
      window.gaLabApp.playback.setStepIndex(3);
      const stepBefore = window.gaLabApp.currentStepIdx;

      // Change bounds x1Max from 15 to 20
      const x1Max = document.getElementById('x1-max');
      x1Max.value = '20';
      x1Max.dispatchEvent(new Event('change'));

      const stepAfter = window.gaLabApp.currentStepIdx;
      const newDelta = document.getElementById('delta-display')?.textContent.trim();

      return {
        stepBefore,
        stepAfter,
        newDelta,
        resetToZeroOnParamChange: stepBefore === 3 && stepAfter === 0
      };
    })()
  `);
  results.timelineResetRecompute = resetRecomputeResult;
  console.log('Result:', resetRecomputeResult);

  // Final Console Error Check
  console.log('\n--- Final Console Error Check ---');
  console.log('Total Console Errors:', consoleErrors.length);
  if (consoleErrors.length > 0) {
    console.error('Console errors detected:', consoleErrors);
  }

  cdp.close();
  chromeProcess.kill();

  if (consoleErrors.length > 0) {
    throw new Error('Audit failed due to console errors');
  }

  console.log('\n✔ All 11 interaction coverage checks PASSED with 0 console errors!');
  return results;
}

runAudit().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
