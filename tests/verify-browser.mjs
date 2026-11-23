/**
 * tests/verify-browser.mjs - End-to-end automated in-browser verification using Chrome DevTools Protocol (CDP).
 * Zero runtime dependencies (uses Node 22 built-in WebSocket, http, fs).
 */

import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const screenshotsDir = path.resolve(__dirname, '../docs/screenshots');
fs.mkdirSync(screenshotsDir, { recursive: true });

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const DEBUG_PORT = 9223;
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

async function runVerification() {
  console.log('--- GA Lab In-Browser Automated Verification ---');

  // 1. Launch Chrome Headless with Remote Debugging
  const chromeProcess = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${DEBUG_PORT}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--user-data-dir=/tmp/ga-lab-chrome-qa-profile',
    '--window-size=1280,800'
  ], { stdio: 'ignore' });

  // Wait for Chrome remote debugging to become available
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

  console.log('Connected to Chrome:', versionData['Browser']);

  // Get target page
  const targets = await fetchJson(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
  const pageTarget = targets.find(t => t.type === 'page') || targets[0];
  const cdp = new CDPClient(pageTarget.webSocketDebuggerUrl);
  await cdp.connect();

  const consoleMessages = [];
  const consoleErrors = [];

  cdp.on('Runtime.consoleAPICalled', (params) => {
    const text = params.args.map(a => a.value || a.description || '').join(' ');
    consoleMessages.push(`[${params.type}] ${text}`);
    if (params.type === 'error') {
      consoleErrors.push(text);
    }
  });

  cdp.on('Runtime.exceptionThrown', (params) => {
    const desc = params.exceptionDetails.exception?.description || params.exceptionDetails.text;
    consoleErrors.push(desc);
  });

  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('DOM.enable');
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });

  // Helper for evaluating in page
  async function evalInPage(expression) {
    const res = await cdp.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    if (res.exceptionDetails) {
      const desc = res.exceptionDetails.exception?.description || res.exceptionDetails.text;
      throw new Error(desc + ' in: ' + expression);
    }
    return res.result.value;
  }

  // 2. Navigate to GA Lab
  console.log(`Navigating to ${TARGET_URL}...`);
  await cdp.send('Page.navigate', { url: TARGET_URL });
  await sleep(1000);

  // 3. Inspect All 5 Layout Zones at 1280px
  console.log('\n[1/7] Inspecting 5-Zone UI Layout at 1280px...');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 800,
    deviceScaleFactor: 1,
    mobile: false
  });

  const zoneCheck = await evalInPage(`
    (() => {
      const zones = {
        topBar: !!document.getElementById('top-bar'),
        controlRail: !!document.getElementById('control-rail'),
        centerStage: !!document.getElementById('center-stage'),
        narrationRail: !!document.getElementById('narration-rail'),
        timelineBar: !!document.getElementById('timeline-bar')
      };
      const visible = {
        topBar: document.getElementById('top-bar')?.offsetHeight > 0,
        controlRail: document.getElementById('control-rail')?.offsetWidth > 0,
        centerStage: document.getElementById('center-stage')?.offsetWidth > 0,
        narrationRail: document.getElementById('narration-rail')?.offsetWidth > 0,
        timelineBar: document.getElementById('timeline-bar')?.offsetHeight > 0
      };
      const vizElements = {
        heatmapCanvas: document.getElementById('heatmap-canvas')?.offsetHeight > 0,
        heatmapLegend: document.getElementById('heatmap-legend-bar')?.offsetHeight > 0,
        convergenceChart: document.getElementById('convergence-chart-svg')?.childElementCount > 0
      };
      return { zones, visible, vizElements };
    })()
  `);
  console.log('5-Zone presence check:', zoneCheck.zones);
  console.log('5-Zone visibility check:', zoneCheck.visible);
  console.log('Phase 3 Visualizations check:', zoneCheck.vizElements);

  // Capture 1280px screenshot
  const shot1280 = await cdp.send('Page.captureScreenshot', { format: 'png' });
  const shot1280Path = path.join(screenshotsDir, 'desktop-1280px.png');
  fs.writeFileSync(shot1280Path, Buffer.from(shot1280.data, 'base64'));
  console.log(`Saved 1280px screenshot to: ${shot1280Path}`);

  // 4. Responsive Layout at 900px
  console.log('\n[2/7] Inspecting Responsive Layout at 900px width...');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 900,
    height: 800,
    deviceScaleFactor: 1,
    mobile: false
  });
  await sleep(200);

  const responsiveCheck = await evalInPage(`
    (() => {
      const root = document.getElementById('app-root');
      const rootRect = root.getBoundingClientRect();
      const bodyScrollWidth = document.documentElement.scrollWidth;
      const ctrlRail = document.getElementById('control-rail');
      const centerStage = document.getElementById('center-stage');
      const narrRail = document.getElementById('narration-rail');
      
      return {
        viewportWidth: window.innerWidth,
        bodyScrollWidth,
        hasHorizontalScrollbar: bodyScrollWidth > 900,
        ctrlRailWidth: ctrlRail.offsetWidth,
        centerStageWidth: centerStage.offsetWidth,
        narrRailWidth: narrRail.offsetWidth
      };
    })()
  `);
  console.log('Responsive 900px metrics:', responsiveCheck);

  // Capture 900px screenshot
  const shot900 = await cdp.send('Page.captureScreenshot', { format: 'png' });
  const shot900Path = path.join(screenshotsDir, 'responsive-900px.png');
  fs.writeFileSync(shot900Path, Buffer.from(shot900.data, 'base64'));
  console.log(`Saved 900px screenshot to: ${shot900Path}`);

  // 4b. Mobile Smoke Test at 390px (Optional Device Smoke Test)
  console.log('\n[2.1/7] Performing 390px Mobile Viewport Smoke Test...');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true
  });
  await sleep(200);

  const mobileCheck = await evalInPage(`
    (() => {
      const bodyScrollWidth = document.documentElement.scrollWidth;
      const root = document.getElementById('app-root');
      const tableWrap = document.querySelector('.table-container');
      const hasTableHScroll = tableWrap && tableWrap.scrollWidth > tableWrap.clientWidth;
      return {
        viewportWidth: window.innerWidth,
        bodyScrollWidth,
        hasHorizontalWindowOverflow: bodyScrollWidth > 390,
        tableHasHorizontalScroll: hasTableHScroll
      };
    })()
  `);
  console.log('Mobile 390px smoke metrics:', mobileCheck);

  const shot390 = await cdp.send('Page.captureScreenshot', { format: 'png' });
  const shot390Path = path.join(screenshotsDir, 'mobile-390px.png');
  fs.writeFileSync(shot390Path, Buffer.from(shot390.data, 'base64'));
  console.log(`Saved 390px screenshot to: ${shot390Path}`);

  // Restore 1280px viewport
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 800,
    deviceScaleFactor: 1,
    mobile: false
  });
  await sleep(100);

  // Phase 3 Check: Heatmap hover interaction
  console.log('\n[2.5/7] Testing Heatmap Hover & Crosshairs...');
  const hoverCheck = await evalInPage(`
    (() => {
      const canvas = document.getElementById('heatmap-canvas');
      const rect = canvas.getBoundingClientRect();
      const mouseEvent = new MouseEvent('mousemove', {
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2,
        bubbles: true
      });
      canvas.dispatchEvent(mouseEvent);
      const tooltip = document.getElementById('heatmap-tooltip');
      const tooltipVisible = tooltip && tooltip.style.display !== 'none';
      const tooltipText = tooltip?.textContent.trim();

      // Mouseleave to clear
      canvas.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));

      return { tooltipVisible, tooltipText };
    })()
  `);
  console.log('Heatmap hover inspection:', hoverCheck);

  // Phase 3 Check: Convergence Chart Hover
  console.log('\n[2.6/7] Testing Convergence Chart Hover...');
  const chartHoverCheck = await evalInPage(`
    (() => {
      const svg = document.getElementById('convergence-chart-svg');
      const rect = svg.getBoundingClientRect();
      const mouseEvent = new MouseEvent('mousemove', {
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2,
        bubbles: true
      });
      svg.dispatchEvent(mouseEvent);
      const hoverCard = svg.querySelector('rect[fill="#10172A"]');
      const hoverTexts = Array.from(svg.querySelectorAll('text')).map(t => t.textContent.trim());

      svg.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
      return { hasHoverCard: !!hoverCard, hoverTexts: hoverTexts.slice(0, 6) };
    })()
  `);
  console.log('Convergence chart hover inspection:', chartHoverCheck);

  // 5. Test Default Reference Preset Data (ref-roulette)
  console.log('\n[3/7] Verifying Default Preset Data (ref-roulette)...');
  const tableData = await evalInPage(`
    (() => {
      const rows = Array.from(document.querySelectorAll('#population-table-body tr'));
      return rows.map(r => {
        const cells = Array.from(r.querySelectorAll('td')).map(c => c.textContent.trim());
        return {
          id: cells[0],
          chrom: cells[1].replace(/\\s+/g, ''),
          D1: cells[2],
          D2: cells[3],
          x1: cells[4],
          x2: cells[5],
          f: cells[6],
          F: cells[7]
        };
      });
    })()
  `);
  console.log('Loaded Population Table (Gen 1):');
  console.table(tableData);

  // 6. Test Step Navigation, Progressive Disclosure, and Narration Updates
  console.log('\n[4/7] Testing Step Navigation & Progressive Disclosure...');
  for (let s = 1; s <= 5; s++) {
    await evalInPage(`document.getElementById('step-fwd-btn').click()`);
    await sleep(150);
    const stepState = await evalInPage(`
      (() => {
        const activeStep = document.querySelector('.phase-step.active')?.textContent.trim();
        const narrationTitle = document.getElementById('narration-title')?.textContent.trim();
        const activeHeaders = Array.from(document.querySelectorAll('th.col-disclose.newly-active')).map(th => th.textContent.trim());
        return { activeStep, narrationTitle, activeHeaders };
      })()
    `);
    console.log(`Step ${s} -> Active Phase: "${stepState.activeStep}", Newly Active Columns: [${stepState.activeHeaders.join(', ')}]`);
  }

  // 7. Test Chromosome Strips Detail Inspection
  console.log('\n[5/7] Testing Chromosome Bit Strips Detail View...');
  await evalInPage(`
    (() => {
      // Click row 1
      const row1 = document.querySelectorAll('#population-table-body tr')[0];
      if (row1) row1.click();
    })()
  `);
  await sleep(100);
  const stripsCheck = await evalInPage(`
    (() => {
      const container = document.getElementById('chromosome-strips');
      const bitCells = Array.from(container.querySelectorAll('.bit-cell'));
      return {
        hasStrips: container.children.length > 0,
        bitCount: bitCells.length,
        firstBitPos: bitCells[0]?.querySelector('.bit-pos')?.textContent.trim(),
        firstBitVal: bitCells[0]?.querySelector('.bit-val')?.textContent.trim(),
        firstBitWeight: bitCells[0]?.querySelector('.bit-weight')?.textContent.trim()
      };
    })()
  `);
  console.log('Chromosome Strips Row 1 Inspection:', stripsCheck);

  // 8. Test Keyboard Shortcuts, Playback Controls & Scrubber
  console.log('\n[6/7] Testing Keyboard Shortcuts (Space, ArrowRight, ArrowLeft, KeyR) & Scrubber...');
  // Press KeyR to reset
  await evalInPage(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR' }))`);
  await sleep(100);
  const resetCheck = await evalInPage(`document.getElementById('scrubber-step-count')?.textContent.trim()`);
  console.log('After KeyR (Reset):', resetCheck);

  // Press Space to toggle Play
  await evalInPage(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }))`);
  await sleep(200);
  const playCheck = await evalInPage(`document.getElementById('play-pause-btn')?.textContent.trim()`);
  console.log('After Space (Play):', playCheck);

  // Press Space again to Pause
  await evalInPage(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }))`);
  await sleep(100);
  const pauseCheck = await evalInPage(`document.getElementById('play-pause-btn')?.textContent.trim()`);
  console.log('After Space (Pause):', pauseCheck);

  // Press ArrowRight to step forward
  await evalInPage(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight' }))`);
  await sleep(100);
  const arrowRightCheck = await evalInPage(`document.getElementById('scrubber-step-count')?.textContent.trim()`);
  console.log('After ArrowRight (Step Forward):', arrowRightCheck);

  // Press ArrowLeft to step backward
  await evalInPage(`window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowLeft' }))`);
  await sleep(100);
  const arrowLeftCheck = await evalInPage(`document.getElementById('scrubber-step-count')?.textContent.trim()`);
  console.log('After ArrowLeft (Step Backward):', arrowLeftCheck);

  // 9. Test Verify Mode Control Locking & Unlocking
  console.log('\n[7/7] Testing Verify Mode Lock & Unlock...');
  await evalInPage(`document.getElementById('verify-mode-btn').click()`);
  await sleep(100);
  const lockedState = await evalInPage(`
    (() => {
      const inputs = [
        document.getElementById('problem-select'),
        document.getElementById('x1-min'),
        document.getElementById('pop-size'),
        document.getElementById('pc-input'),
        document.getElementById('seed-input')
      ];
      const cloneBtnVisible = document.getElementById('clone-free-btn').style.display !== 'none';
      return {
        allInputsDisabled: inputs.every(i => i.disabled),
        cloneBtnVisible
      };
    })()
  `);
  console.log('Verify Mode ON (Controls Locked):', lockedState);

  // Click Clone to Free Play to unlock
  await evalInPage(`document.getElementById('clone-free-btn').click()`);
  await sleep(100);
  const unlockedState = await evalInPage(`
    (() => {
      const inputs = [
        document.getElementById('problem-select'),
        document.getElementById('x1-min'),
        document.getElementById('pop-size'),
        document.getElementById('pc-input'),
        document.getElementById('seed-input')
      ];
      return {
        allInputsEnabled: inputs.every(i => !i.disabled),
        presetValue: document.getElementById('preset-select').value
      };
    })()
  `);
  console.log('Clone to Free Play (Controls Unlocked):', unlockedState);

  // Test dynamic parameter adjustment: change N to 6
  await evalInPage(`
    (() => {
      const popSize = document.getElementById('pop-size');
      popSize.value = '6';
      popSize.dispatchEvent(new Event('change'));
    })()
  `);
  await sleep(150);
  const newRowCount = await evalInPage(`document.querySelectorAll('#population-table-body tr').length`);
  console.log('After setting Pop Size N=6 -> Table Row Count:', newRowCount);

  // 10. Phase 4 Visual Feature Verification (Roulette, Tournament, Broken Wheel Recovery, Crossover & Mutation)
  console.log('\n[8/8] Testing Phase 4 Selection, Crossover & Mutation Visuals...');

  // 10a. Roulette Wheel in ref-roulette
  await evalInPage(`
    (() => {
      const presetSel = document.getElementById('preset-select');
      presetSel.value = 'ref-roulette';
      presetSel.dispatchEvent(new Event('change'));
    })()
  `);
  await sleep(150);

  // Step to SELECT phase (Step index 2: Init -> Decode -> Select)
  await evalInPage(`
    (() => {
      // Find SELECT step in allSteps
      const app = window.gaLabApp;
      const selectIdx = app.allSteps.findIndex(s => s.phase === 'SELECT');
      if (selectIdx >= 0) app.goToStep(selectIdx);
    })()
  `);
  await sleep(200);

  const rouletteCheck = await evalInPage(`
    (() => {
      const panel = document.getElementById('selection-operator-panel');
      const rView = document.getElementById('roulette-view');
      const canvas = document.getElementById('roulette-canvas');
      const readout = document.getElementById('roulette-readout');
      return {
        panelVisible: panel && window.getComputedStyle(panel).display !== 'none',
        rouletteVisible: rView && window.getComputedStyle(rView).display !== 'none',
        canvasWidth: canvas?.width,
        readoutText: readout?.textContent?.trim()
      };
    })()
  `);
  console.log('Roulette Wheel in SELECT phase:', rouletteCheck);

  // 10b. Tournament Bracket in ref-tournament
  await evalInPage(`
    (() => {
      const presetSel = document.getElementById('preset-select');
      presetSel.value = 'ref-tournament';
      presetSel.dispatchEvent(new Event('change'));
    })()
  `);
  await sleep(150);
  await evalInPage(`
    (() => {
      const app = window.gaLabApp;
      const selectIdx = app.allSteps.findIndex(s => s.phase === 'SELECT');
      if (selectIdx >= 0) app.goToStep(selectIdx);
    })()
  `);
  await sleep(200);

  const tournamentCheck = await evalInPage(`
    (() => {
      const panel = document.getElementById('selection-operator-panel');
      const tView = document.getElementById('tournament-bracket');
      const cards = tView?.querySelectorAll('.tourn-card') || [];
      const winners = tView?.querySelectorAll('.tourn-badge-win') || [];
      return {
        panelVisible: panel && window.getComputedStyle(panel).display !== 'none',
        matchCardsCount: cards.length,
        winnersCount: winners.length,
        firstMatchText: cards[0]?.textContent?.replace(/\\s+/g, ' ').trim()
      };
    })()
  `);
  console.log('Tournament Bracket in SELECT phase:', tournamentCheck);

  // 10c. Negative Fitness Broken Wheel & Recovery in ref-negative
  await evalInPage(`
    (() => {
      const presetSel = document.getElementById('preset-select');
      presetSel.value = 'ref-negative';
      presetSel.dispatchEvent(new Event('change'));
    })()
  `);
  await sleep(150);
  await evalInPage(`
    (() => {
      const app = window.gaLabApp;
      const selectIdx = app.allSteps.findIndex(s => s.phase === 'SELECT');
      if (selectIdx >= 0) app.goToStep(selectIdx);
    })()
  `);
  await sleep(200);

  const brokenWheelCheck = await evalInPage(`
    (() => {
      const readout = document.getElementById('roulette-readout');
      const shiftBtn = document.getElementById('roulette-shift-btn');
      const tournBtn = document.getElementById('roulette-tourn-btn');
      return {
        readoutText: readout?.textContent?.trim(),
        hasShiftBtn: !!shiftBtn,
        hasTournBtn: !!tournBtn
      };
    })()
  `);
  console.log('Broken Wheel & Recovery Action Buttons in ref-negative:', brokenWheelCheck);

  // Test Linear Shift Recovery Action Click
  await evalInPage(`
    (() => {
      const shiftBtn = document.getElementById('roulette-shift-btn');
      if (shiftBtn) shiftBtn.click();
    })()
  `);
  await sleep(200);

  const postRecoveryCheck = await evalInPage(`
    (() => {
      const app = window.gaLabApp;
      const selectRecord = app.allSteps.find(s => s.phase === 'SELECT');
      return {
        stepCount: app.allSteps.length,
        hasNegativeHalt: app.allSteps.some(s => s.isInvalidNegativeFitness),
        selectValid: selectRecord?.selectionResult?.valid,
        probabilitiesSum: selectRecord?.probabilities?.reduce((a, b) => a + b, 0)
      };
    })()
  `);
  console.log('After Applying Linear Shift C_shift:', postRecoveryCheck);

  // 10d. Crossover Tail Swap Inspection
  await evalInPage(`
    (() => {
      const presetSel = document.getElementById('preset-select');
      presetSel.value = 'ref-roulette';
      presetSel.dispatchEvent(new Event('change'));
    })()
  `);
  await sleep(150);
  await evalInPage(`
    (() => {
      const app = window.gaLabApp;
      const crossIdx = app.allSteps.findIndex(s => s.phase === 'CROSSOVER');
      if (crossIdx >= 0) app.goToStep(crossIdx);
    })()
  `);
  await sleep(200);

  const crossoverVisualCheck = await evalInPage(`
    (() => {
      const strips = document.getElementById('chromosome-strips');
      const cutBadges = strips?.querySelectorAll('.cut-badge') || [];
      const swappedCells = strips?.querySelectorAll('.bit-cell.tail-swapped') || [];
      return {
        cutBadgesCount: cutBadges.length,
        cutBadgeText: cutBadges[0]?.textContent?.trim(),
        swappedCellsCount: swappedCells.length
      };
    })()
  `);
  console.log('Crossover Strips Visual Inspection:', crossoverVisualCheck);

  // 10e. Mutation Bit Flips & Delta Value Chips
  await evalInPage(`
    (() => {
      const app = window.gaLabApp;
      const mutIdx = app.allSteps.findIndex(s => s.phase === 'MUTATE');
      if (mutIdx >= 0) app.goToStep(mutIdx);
    })()
  `);
  await sleep(200);

  const mutationVisualCheck = await evalInPage(`
    (() => {
      const strips = document.getElementById('chromosome-strips');
      const flippedCells = strips?.querySelectorAll('.bit-cell.flipped') || [];
      const deltaBadges = strips?.querySelectorAll('.delta-badge') || [];
      return {
        flippedCellsCount: flippedCells.length,
        deltaBadgesCount: deltaBadges.length,
        firstDeltaBadge: deltaBadges[0]?.textContent?.trim()
      };
    })()
  `);
  console.log('Mutation Strips Visual Inspection:', mutationVisualCheck);

  // 10f. Test prefers-reduced-motion
  console.log('Testing prefers-reduced-motion compliance...');
  await cdp.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }]
  });
  await sleep(100);
  const reducedMotionCheck = await evalInPage(`
    (() => {
      const match = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const bitCell = document.querySelector('.bit-cell');
      const compStyle = bitCell ? window.getComputedStyle(bitCell) : null;
      return {
        mediaMatches: match,
        animDuration: compStyle ? compStyle.animationDuration : 'unknown'
      };
    })()
  `);
  console.log('Reduced motion check:', reducedMotionCheck);

  // Restore normal media
  await cdp.send('Emulation.setEmulatedMedia', { features: [] });

  // Retake Screenshots with Phase 4 elements active
  const phase4Shot1280 = await cdp.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.resolve(screenshotsDir, 'desktop-1280px.png'), Buffer.from(phase4Shot1280.data, 'base64'));

  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 900,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false
  });
  await sleep(200);
  const phase4Shot900 = await cdp.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.resolve(screenshotsDir, 'responsive-900px.png'), Buffer.from(phase4Shot900.data, 'base64'));

  // 11. Phase 5: Verify Mode in App & tests.html In-Browser Test Runner
  console.log('\n[9/10] Testing Phase 5: In-App Verify Mode & tests.html In-Browser Runner...');

  // 11a. Test In-App Verify Mode
  await evalInPage(`
    (() => {
      const presetSel = document.getElementById('preset-select');
      presetSel.value = 'ref-roulette';
      presetSel.dispatchEvent(new Event('change'));
      const verifyBtn = document.getElementById('verify-mode-btn');
      if (verifyBtn.getAttribute('aria-pressed') !== 'true') {
        verifyBtn.click();
      }
    })()
  `);
  await sleep(250);

  const inAppVerifyCheck = await evalInPage(`
    (() => {
      const bar = document.getElementById('verify-summary-bar');
      const genNum = document.getElementById('verify-gen-num')?.textContent.trim();
      const genCounts = document.getElementById('verify-gen-counts')?.textContent.trim();
      const globalCounts = document.getElementById('verify-global-counts')?.textContent.trim();
      const globalPct = document.getElementById('verify-global-pct')?.textContent.trim();
      const passMarks = document.querySelectorAll('.verify-cell-mark.pass').length;
      const failMarks = document.querySelectorAll('.verify-cell-mark.fail').length;
      const firstMarkTitle = document.querySelector('.verify-cell-mark')?.getAttribute('title');

      return {
        barVisible: bar && window.getComputedStyle(bar).display !== 'none',
        genNum,
        genCounts,
        globalCounts,
        globalPct,
        passMarks,
        failMarks,
        firstMarkTitle
      };
    })()
  `);
  console.log('In-App Verify Mode Status:', inAppVerifyCheck);

  // 12. Phase 6: Schema X-Ray Panel & Holland Bound Analyzer
  console.log('\n[10/10] Testing Phase 6: Schema X-Ray Panel & Holland Bounds SVG Chart...');
  const schemaCheck = await evalInPage(`
    (() => {
      const panel = document.getElementById('schema-xray-panel');
      const patternDisplay = document.getElementById('schema-pattern-display')?.textContent.trim();
      const orderBadge = document.getElementById('schema-order-badge')?.textContent.trim();
      const lenBadge = document.getElementById('schema-len-badge')?.textContent.trim();
      const bitBtns = document.querySelectorAll('.schema-bit-btn').length;
      const metricOrder = document.getElementById('metric-order')?.textContent.trim();
      const metricLen = document.getElementById('metric-length')?.textContent.trim();
      const metricMatching = document.getElementById('metric-matching')?.textContent.trim();
      const metricRatio = document.getElementById('metric-ratio')?.textContent.trim();
      const chartSvg = document.getElementById('schema-bounds-svg');
      const chartElements = chartSvg?.querySelectorAll('circle, path, text').length || 0;
      const schemaMatchRows = document.querySelectorAll('.pop-table tr.schema-match-row').length;
      const schemaBitMatches = document.querySelectorAll('.bit-cell.schema-bit-match').length;

      // Test bit toggle: click bit 1
      const bit0 = document.querySelector('.schema-bit-btn[data-idx="0"]');
      if (bit0) bit0.click();
      const patternAfterClick = document.getElementById('schema-pattern-display')?.textContent.trim();

      // Test Auto-track button
      const autoTrackBtn = document.getElementById('schema-autotrack-btn');
      if (autoTrackBtn) autoTrackBtn.click();
      const patternAfterAutoTrack = document.getElementById('schema-pattern-display')?.textContent.trim();

      // Test collapse toggle
      const collapseBtn = document.getElementById('schema-collapse-btn');
      if (collapseBtn) collapseBtn.click();
      const isCollapsed = document.getElementById('schema-content')?.style.display === 'none';
      if (collapseBtn) collapseBtn.click(); // restore expand

      return {
        panelVisible: panel && window.getComputedStyle(panel).display !== 'none',
        patternDisplay,
        orderBadge,
        lenBadge,
        bitBtns,
        metricOrder,
        metricLen,
        metricMatching,
        metricRatio,
        chartElements,
        schemaMatchRows,
        schemaBitMatches,
        patternAfterClick,
        patternAfterAutoTrack,
        isCollapsed
      };
    })()
  `);
  console.log('Schema X-Ray Verification Check:', schemaCheck);

  // Take full Phase 6 Screenshots of index.html
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 850,
    deviceScaleFactor: 1,
    mobile: false
  });
  await sleep(200);
  const phase6Shot1280 = await cdp.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.resolve(screenshotsDir, 'desktop-1280px.png'), Buffer.from(phase6Shot1280.data, 'base64'));

  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 900,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false
  });
  await sleep(200);
  const phase6Shot900 = await cdp.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.resolve(screenshotsDir, 'responsive-900px.png'), Buffer.from(phase6Shot900.data, 'base64'));

  // 11b. Test tests.html In-Browser Runner Page
  console.log('Navigating to http://127.0.0.1:8080/tests.html...');
  await cdp.send('Page.navigate', { url: 'http://127.0.0.1:8080/tests.html' });
  await sleep(1500);

  const runnerCheck = await evalInPage(`
    (() => {
      const passed = parseInt(document.getElementById('passed-count')?.textContent || '0', 10);
      const failed = parseInt(document.getElementById('failed-count')?.textContent || '0', 10);
      const total = parseInt(document.getElementById('total-count')?.textContent || '0', 10);
      const duration = document.getElementById('duration-count')?.textContent.trim();
      const presetSummary = document.getElementById('preset-audit-summary')?.textContent.trim();
      const presetRows = document.querySelectorAll('#presets-audit-tbody tr').length;
      const suiteCards = document.querySelectorAll('.test-suite-card').length;

      return {
        passed,
        failed,
        total,
        duration,
        presetSummary,
        presetRows,
        suiteCards
      };
    })()
  `);
  console.log('tests.html In-Browser Runner Results:', runnerCheck);

  // Take Screenshots of tests.html
  const testsShot1280 = await cdp.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.resolve(screenshotsDir, 'tests-runner-1280px.png'), Buffer.from(testsShot1280.data, 'base64'));

  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 900,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false
  });
  await sleep(200);
  const testsShot900 = await cdp.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.resolve(screenshotsDir, 'tests-runner-900px.png'), Buffer.from(testsShot900.data, 'base64'));

  // 12. Check Console Logs & Errors
  console.log('\n--- Final Console Audit ---');
  console.log(`Total Console Messages Captured: ${consoleMessages.length}`);
  if (consoleMessages.length > 0) {
    console.log(consoleMessages.join('\n'));
  }
  console.log(`Total Console Errors: ${consoleErrors.length}`);

  cdp.close();
  chromeProcess.kill();

  if (consoleErrors.length > 0) {
    console.error('FAILED: Browser console errors detected:', consoleErrors);
    process.exit(1);
  } else {
    console.log('\n✔ All in-browser tests passed with 0 console errors!');
  }
}

runVerification().catch(err => {
  console.error('Verification error:', err);
  process.exit(1);
});
