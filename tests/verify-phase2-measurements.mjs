/**
 * tests/verify-phase2-measurements.mjs
 * Measures real rAF frame intervals (min/avg/p95 over 120 frames) at pop 4 and pop 200,
 * and tests 6x CPU throttling adaptive fallback to 2D and recovery via toggle.
 */
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const DEBUG_PORT = 9226;
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

async function main() {
  console.log('Launching headless Chrome for Phase 2 raw evidence verification...');
  const chromeProcess = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${DEBUG_PORT}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    '--window-size=1280,900'
  ], { stdio: 'ignore' });

  await sleep(1500);

  try {
    const versionInfo = await fetchJson(`http://127.0.0.1:${DEBUG_PORT}/json/version`);
    const targets = await fetchJson(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
    const pageTarget = targets.find(t => t.type === 'page') || targets[0];
    if (!pageTarget) throw new Error('No page target found');

    const cdp = new CDPClient(pageTarget.webSocketDebuggerUrl);
    await cdp.connect();

    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Page.navigate', { url: TARGET_URL });
    await sleep(2000);

    // Ensure app is in 3D mode
    await cdp.send('Runtime.evaluate', {
      expression: `
        if (window.gaLabApp) {
          window.gaLabApp.setLandscapeMode('3D');
        }
      `
    });
    await sleep(600);

    // Helper to measure 120 consecutive rAF frame intervals
    async function measureRafIntervals(label) {
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
              if (intervals.length < 120) {
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

    // 1. Measure Pop 4
    console.log('--- Measuring Pop 4 Frame Timing (120 frames) ---');
    const pop4Timing = await measureRafIntervals('Pop 4');
    console.log(`Pop 4: min=${pop4Timing.min.toFixed(2)}ms, avg=${pop4Timing.avg.toFixed(2)}ms, p95=${pop4Timing.p95.toFixed(2)}ms, max=${pop4Timing.max.toFixed(2)}ms (count: ${pop4Timing.count})`);

    // 2. Measure Pop 200
    console.log('--- Setting Population to 200 and Measuring Frame Timing (120 frames) ---');
    await cdp.send('Runtime.evaluate', {
      expression: `
        const popInput = document.getElementById('pop-size-input');
        if (popInput) {
          popInput.value = '200';
          popInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
        if (window.gaLabApp) {
          window.gaLabApp.rebuildTimeline();
          window.gaLabApp.setLandscapeMode('3D');
        }
      `
    });
    await sleep(1000);

    const pop200Timing = await measureRafIntervals('Pop 200');
    console.log(`Pop 200: min=${pop200Timing.min.toFixed(2)}ms, avg=${pop200Timing.avg.toFixed(2)}ms, p95=${pop200Timing.p95.toFixed(2)}ms, max=${pop200Timing.max.toFixed(2)}ms (count: ${pop200Timing.count})`);

    // 3. Force Adaptive Fallback with 6x CPU Throttling
    console.log('--- Applying 6x CPU Throttling via CDP Emulation.setCPUThrottlingRate ---');
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });

    // Wait and poll until adaptive fallback triggers
    let fallbackTriggered = false;
    let noticeText = '';
    let currentMode = '';

    for (let attempt = 0; attempt < 30; attempt++) {
      await sleep(300);
      const state = await cdp.send('Runtime.evaluate', {
        expression: `
          (() => {
            const notice = document.getElementById('landscape-fallback-notice');
            const noticeVisible = notice && notice.style.display !== 'none';
            const noticeText = notice ? notice.textContent.trim() : '';
            const mode = window.gaLabApp ? window.gaLabApp.landscapeMode : 'unknown';
            return { noticeVisible, noticeText, mode };
          })()
        `,
        returnByValue: true
      });
      const val = state.result.value;
      if (val.mode === '2D' && val.noticeVisible && val.noticeText.includes('Reduced 3D')) {
        fallbackTriggered = true;
        noticeText = val.noticeText;
        currentMode = val.mode;
        break;
      }
    }

    console.log(`Adaptive Fallback Result: fallbackTriggered=${fallbackTriggered}, mode=${currentMode}, notice="${noticeText}"`);

    // 4. Remove CPU Throttling
    console.log('--- Removing CPU Throttling (rate: 1) ---');
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    await sleep(500);

    // 5. Test Return to 3D via Toggle Button
    console.log('--- Clicking Landscape Toggle Button to Return to 3D ---');
    const returnState = await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const btn = document.getElementById('landscape-view-mode-btn');
          if (btn) btn.click();
          const notice = document.getElementById('landscape-fallback-notice');
          const noticeVisible = notice && notice.style.display !== 'none';
          const mode = window.gaLabApp ? window.gaLabApp.landscapeMode : 'unknown';
          return { mode, noticeVisible };
        })()
      `,
      returnByValue: true
    });
    console.log(`Return to 3D Result: mode=${returnState.result.value.mode}, noticeVisible=${returnState.result.value.noticeVisible}`);

    cdp.close();
    chromeProcess.kill();

    console.log('\n=== RAW VERIFICATION SUMMARY ===');
    console.log(JSON.stringify({
      pop4: pop4Timing,
      pop200: pop200Timing,
      adaptiveFallback: {
        forcedWithThrottlingRate: 6,
        switchedTo2D: currentMode === '2D',
        noticeText: noticeText,
        recoveryTo3DSuccessful: returnState.result.value.mode === '3D'
      }
    }, null, 2));

  } catch (err) {
    console.error('Verification error:', err);
    chromeProcess.kill();
    process.exit(1);
  }
}

main();
