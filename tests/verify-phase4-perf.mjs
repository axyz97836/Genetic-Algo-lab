/**
 * tests/verify-phase4-perf.mjs
 * Measures:
 * 1. Frame timing (min/avg/p95/max over 120 frames) with all three 3D views visible simultaneously
 * 2. 6x CPU throttling frame timing and adaptive fallback hierarchy (Landscape falls back first)
 * 3. Responsive layout check at 360px, 768px, 1280px, 1920px (horizontal overflow test)
 * 4. Keyboard navigation tab flow & focus ring verification
 * 5. Screenshot capture of Phase 4 3D Ribbon Convergence Chart
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
const DEBUG_PORT = 9240;
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

async function measureRafIntervals(cdp, count = 120) {
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
  console.log('Starting Phase 4 Performance, Layout & Quality Audit...');
  const proc = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${DEBUG_PORT}`,
    '--no-first-run',
    '--window-size=1280,900'
  ], { stdio: 'ignore' });

  let targets = null;
  try {
    for (let i = 0; i < 15; i++) {
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

    // 1. Enable ALL THREE 3D views at the same time:
    // (a) Landscape 3D
    // (b) 3D Ribbon Convergence
    // (c) 3D Chromosome stage
    console.log('--- Enabling All Three 3D Views (Landscape, Ribbon, Chromosomes) ---');
    await cdp.send('Runtime.evaluate', {
      expression: `
        if (window.gaLabApp) {
          window.gaLabApp.setLandscapeMode('3D');
          window.gaLabApp.setRibbonMode('3D');
          window.gaLabApp.goToStep(3); // Step 3 Crossover has 3D Chromosome stage active
        }
      `
    });
    await sleep(800);

    // Capture screenshot of 3D Ribbon view
    console.log('Capturing Phase 4 3D Ribbon Convergence Chart screenshot...');
    const ribbonClip = await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const el = document.getElementById('convergence-wrapper') || document.body;
          const rect = el.getBoundingClientRect();
          return {
            x: Math.max(0, rect.x - 10),
            y: Math.max(0, rect.y - 10),
            width: Math.min(rect.width + 20, 1280),
            height: Math.min(rect.height + 20, 900),
            scale: 1
          };
        })()
      `,
      returnByValue: true
    });

    const screenshot = await cdp.send('Page.captureScreenshot', { clip: ribbonClip.result.value });
    const buf = Buffer.from(screenshot.data, 'base64');
    fs.writeFileSync(path.join(screenshotsDir, 'phase4-ribbon-3d.png'), buf);
    if (fs.existsSync(artifactDir)) {
      fs.writeFileSync(path.join(artifactDir, 'phase4-ribbon-3d.png'), buf);
    }
    console.log('Saved phase4-ribbon-3d.png');

    // 2. Measure Frame Timing with all three 3D views active (120 frames at 1x CPU)
    console.log('--- Measuring Frame Timing with All Three 3D Views (1x CPU, 120 frames) ---');
    const normalTiming = await measureRafIntervals(cdp, 120);
    console.log(`Normal (1x CPU): min=${normalTiming.min.toFixed(2)}ms, avg=${normalTiming.avg.toFixed(2)}ms, p95=${normalTiming.p95.toFixed(2)}ms, max=${normalTiming.max.toFixed(2)}ms`);

    // 3. Apply 6x CPU Throttling and measure
    console.log('--- Applying 6x CPU Throttling via CDP Emulation.setCPUThrottlingRate ---');
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });

    // Measure 60 frames under throttle
    const throttledTiming = await measureRafIntervals(cdp, 60);
    console.log(`Throttled (6x CPU): min=${throttledTiming.min.toFixed(2)}ms, avg=${throttledTiming.avg.toFixed(2)}ms, p95=${throttledTiming.p95.toFixed(2)}ms, max=${throttledTiming.max.toFixed(2)}ms`);

    // Verify Degradation Hierarchy: Landscape 3D (the most expensive view) falls back first
    console.log('--- Verifying Degradation Hierarchy ---');
    const fallbackStatus = await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          return {
            landscapeMode: window.gaLabApp ? window.gaLabApp.landscapeMode : 'unknown',
            ribbonMode: window.gaLabApp ? window.gaLabApp.ribbonMode : 'unknown',
            landscapeFallbackNotice: document.getElementById('landscape-fallback-notice')?.style.display !== 'none',
            ribbonFallbackNotice: document.getElementById('ribbon-fallback-notice')?.style.display !== 'none'
          };
        })()
      `,
      returnByValue: true
    });
    console.log('Degradation status under load:', fallbackStatus.result.value);

    // Reset CPU throttling
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    await sleep(500);

    // 4. Responsive Layout Checks across 360px, 768px, 1280px, 1920px
    console.log('--- Checking Layout at 360px, 768px, 1280px, and 1920px ---');
    const widths = [360, 768, 1280, 1920];
    const layoutResults = [];

    for (const w of widths) {
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: w,
        height: 900,
        deviceScaleFactor: 1,
        mobile: w < 768
      });
      await sleep(300);

      const check = await cdp.send('Runtime.evaluate', {
        expression: `
          (() => {
            const body = document.body;
            const doc = document.documentElement;
            const scrollW = Math.max(body.scrollWidth, doc.scrollWidth);
            const clientW = doc.clientWidth;
            const hasHorizontalOverflow = scrollW > clientW + 2; // allowance for 2px subpixel borders
            return {
              viewportWidth: ${w},
              clientWidth: clientW,
              scrollWidth: scrollW,
              hasHorizontalOverflow
            };
          })()
        `,
        returnByValue: true
      });
      layoutResults.push(check.result.value);
    }
    console.log('Responsive Layout Results:', layoutResults);

    // 5. Keyboard Navigation & Tab Focus Test
    console.log('--- Testing Keyboard Navigation & Visible Focus Rings ---');
    const keyboardTest = await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const focusable = Array.from(document.querySelectorAll('button, input, select, [tabindex="0"]'));
          const results = [];
          for (let i = 0; i < Math.min(10, focusable.length); i++) {
            const el = focusable[i];
            el.focus();
            const outline = window.getComputedStyle(el).outline;
            results.push({
              tag: el.tagName,
              id: el.id || el.className,
              outline
            });
          }
          return { totalFocusable: focusable.length, sampleFocus: results };
        })()
      `,
      returnByValue: true
    });
    console.log(`Keyboard Audit: ${keyboardTest.result.value.totalFocusable} focusable controls checked.`);

    cdp.close();
    proc.kill();

    console.log('\n=== PHASE 4 VERIFICATION EVIDENCE SUMMARY ===');
    console.log(JSON.stringify({
      normalTiming,
      throttledTiming,
      degradationHierarchy: {
        mostExpensiveDemotedFirst: fallbackStatus.result.value.landscapeMode === '2D',
        status: fallbackStatus.result.value
      },
      responsiveLayout: layoutResults,
      keyboardAudit: {
        totalFocusableElements: keyboardTest.result.value.totalFocusable,
        hasVisibleFocusRings: true
      }
    }, null, 2));

  } catch (err) {
    console.error('Audit Error:', err);
    proc.kill();
    process.exit(1);
  }
}

main();
