/**
 * tests/measure-three-fallback-states.mjs
 * Measures:
 * 1. p95 frame time under 6x CPU throttling across three distinct states:
 *    - State 1: All 3D (Landscape 3D + Ribbon 3D + Chromosome 3D)
 *    - State 2: Landscape demoted (Landscape 2D + Ribbon 3D + Chromosome 3D)
 *    - State 3: Landscape plus ribbon demoted (Landscape 2D + Ribbon 2D + Chromosome 3D)
 * 2. Captures screenshots:
 *    - 3D ribbon with a 2-generation preset (phase4-ribbon-2gen.png)
 *    - All three 3D views visible together at 1280px (phase4-all-three-3d-1280px.png)
 */

import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const screenshotsDir = path.resolve(__dirname, '../docs/screenshots');
const artifactDir = '/Users/dhruvkumarsingh2122/.gemini/antigravity/brain/a2530f3b-b8a7-42ef-848c-92567baad7a1';
fs.mkdirSync(screenshotsDir, { recursive: true });

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const DEBUG_PORT = 9250;
const TARGET_URL = 'http://127.0.0.1:8080/index.html';

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.nextId = 1;
    this.callbacks = new Map();
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

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function measureRafIntervals(cdp, count = 60) {
  const evalRes = await cdp.send('Runtime.evaluate', {
    expression: `
      new Promise((resolve) => {
        const intervals = [];
        let lastTs = null;
        function onFrame(ts) {
          if (lastTs !== null) {
            intervals.push(ts - lastTs);
          }
          lastTs = ts;
          if (intervals.length < ${count}) {
            requestAnimationFrame(onFrame);
          } else {
            intervals.sort((a, b) => a - b);
            const min = intervals[0];
            const max = intervals[intervals.length - 1];
            const sum = intervals.reduce((acc, v) => acc + v, 0);
            const avg = sum / intervals.length;
            const p95Idx = Math.floor(intervals.length * 0.95);
            const p95 = intervals[p95Idx];
            resolve({ count: intervals.length, min, avg, p95, max });
          }
        }
        requestAnimationFrame(onFrame);
      })
    `,
    awaitPromise: true,
    returnByValue: true
  });
  return evalRes.result.value;
}

async function main() {
  console.log('Starting Fallback States Timing & Screenshot Verification...');
  const proc = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${DEBUG_PORT}`,
    '--no-first-run',
    '--window-size=1280,960'
  ], { stdio: 'ignore' });

  let targets = null;
  try {
    for (let i = 0; i < 20; i++) {
      try {
        targets = await fetchJson(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
        if (targets && targets.length > 0) break;
      } catch (_) {
        await sleep(500);
      }
    }
    if (!targets) throw new Error('Could not connect to Chrome debugging port');

    const cdp = new CDPClient(targets[0].webSocketDebuggerUrl);
    await cdp.connect();

    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Page.navigate', { url: TARGET_URL });
    await sleep(2000);

    // Apply 6x CPU Throttling
    console.log('--- Applying 6x CPU Throttling ---');
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });
    await sleep(500);

    // ----------------------------------------------------
    // State 1: All 3D (Landscape 3D + Ribbon 3D + Chromosomes 3D)
    // ----------------------------------------------------
    console.log('--- State 1: All 3D ---');
    await cdp.send('Runtime.evaluate', {
      expression: `
        if (window.gaLabApp) {
          window.gaLabApp.setLandscapeMode('3D');
          window.gaLabApp.setRibbonMode('3D');
          window.gaLabApp.goToStep(3); // Crossover step has 3D Chromosome active
        }
      `
    });
    await sleep(800);
    const timingState1 = await measureRafIntervals(cdp, 60);
    console.log(`State 1 (All 3D) @ 6x CPU: min=${timingState1.min.toFixed(2)}ms, avg=${timingState1.avg.toFixed(2)}ms, p95=${timingState1.p95.toFixed(2)}ms, max=${timingState1.max.toFixed(2)}ms`);

    // ----------------------------------------------------
    // State 2: Landscape demoted (Landscape 2D + Ribbon 3D + Chromosomes 3D)
    // ----------------------------------------------------
    console.log('--- State 2: Landscape demoted ---');
    await cdp.send('Runtime.evaluate', {
      expression: `
        if (window.gaLabApp) {
          window.gaLabApp.setLandscapeMode('2D');
          window.gaLabApp.setRibbonMode('3D');
        }
      `
    });
    await sleep(800);
    const timingState2 = await measureRafIntervals(cdp, 60);
    console.log(`State 2 (Landscape Demoted) @ 6x CPU: min=${timingState2.min.toFixed(2)}ms, avg=${timingState2.avg.toFixed(2)}ms, p95=${timingState2.p95.toFixed(2)}ms, max=${timingState2.max.toFixed(2)}ms`);

    // ----------------------------------------------------
    // State 3: Landscape plus ribbon demoted (Landscape 2D + Ribbon 2D + Chromosomes 3D)
    // ----------------------------------------------------
    console.log('--- State 3: Landscape plus Ribbon demoted ---');
    await cdp.send('Runtime.evaluate', {
      expression: `
        if (window.gaLabApp) {
          window.gaLabApp.setLandscapeMode('2D');
          window.gaLabApp.setRibbonMode('2D');
        }
      `
    });
    await sleep(800);
    const timingState3 = await measureRafIntervals(cdp, 60);
    console.log(`State 3 (Landscape + Ribbon Demoted) @ 6x CPU: min=${timingState3.min.toFixed(2)}ms, avg=${timingState3.avg.toFixed(2)}ms, p95=${timingState3.p95.toFixed(2)}ms, max=${timingState3.max.toFixed(2)}ms`);

    // Reset CPU throttling for screenshot captures
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    await sleep(500);

    // ----------------------------------------------------
    // Capture Screenshot A: 3D Ribbon with 2-generation preset
    // ----------------------------------------------------
    console.log('--- Capturing 3D Ribbon with 2-generation preset (ref-roulette) ---');
    await cdp.send('Runtime.evaluate', {
      expression: `
        if (window.gaLabApp) {
          window.gaLabApp.loadPreset('ref-roulette');
          window.gaLabApp.setRibbonMode('3D');
          // Step to Gen 2 so there are 2 completed generations of statistics
          for (let i = 0; i < 7; i++) {
            window.gaLabApp.stepForward();
          }
        }
      `
    });
    await sleep(1000);

    const ribbonClip = await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const el = document.getElementById('convergence-wrapper') || document.body;
          const rect = el.getBoundingClientRect();
          return {
            x: Math.max(0, rect.x - 10),
            y: Math.max(0, rect.y - 10),
            width: Math.min(rect.width + 20, 1280),
            height: Math.min(rect.height + 20, 960),
            scale: 1
          };
        })()
      `,
      returnByValue: true
    });

    const shotA = await cdp.send('Page.captureScreenshot', { clip: ribbonClip.result.value });
    const bufA = Buffer.from(shotA.data, 'base64');
    fs.writeFileSync(path.join(screenshotsDir, 'phase4-ribbon-2gen.png'), bufA);
    if (fs.existsSync(artifactDir)) {
      fs.writeFileSync(path.join(artifactDir, 'phase4-ribbon-2gen.png'), bufA);
    }
    console.log('Saved phase4-ribbon-2gen.png');

    // ----------------------------------------------------
    // Capture Screenshot B: All three 3D views visible together at 1280px
    // ----------------------------------------------------
    console.log('--- Capturing All Three 3D Views Visible Together at 1280px ---');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 960,
      deviceScaleFactor: 1,
      mobile: false
    });
    await cdp.send('Runtime.evaluate', {
      expression: `
        if (window.gaLabApp) {
          window.gaLabApp.setLandscapeMode('3D');
          window.gaLabApp.setRibbonMode('3D');
          // Navigate to Step 3 (Crossover) where 3D Chromosome strand is visible
          window.gaLabApp.goToStep(3);
        }
      `
    });
    await sleep(1000);

    const shotB = await cdp.send('Page.captureScreenshot', {
      clip: { x: 0, y: 0, width: 1280, height: 960, scale: 1 }
    });
    const bufB = Buffer.from(shotB.data, 'base64');
    fs.writeFileSync(path.join(screenshotsDir, 'phase4-all-three-3d-1280px.png'), bufB);
    if (fs.existsSync(artifactDir)) {
      fs.writeFileSync(path.join(artifactDir, 'phase4-all-three-3d-1280px.png'), bufB);
    }
    console.log('Saved phase4-all-three-3d-1280px.png');

    cdp.close();
    proc.kill();

    console.log('\n=== FALLBACK STATES TIMING REPORT (6x CPU THROTTLING) ===');
    console.log(JSON.stringify({
      state1_all3D: timingState1,
      state2_landscapeDemoted: timingState2,
      state3_landscapeAndRibbonDemoted: timingState3
    }, null, 2));

  } catch (err) {
    console.error('Execution Error:', err);
    proc.kill();
    process.exit(1);
  }
}

main();
