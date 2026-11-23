/**
 * tests/capture-phase2-proof.mjs - Phase 2 3D Landscape Profiling & Proof Capture via CDP.
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
const DEBUG_PORT = 9225;
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
  console.log('Launching headless Chrome for Phase 2 Verification & Profiling...');
  const chromeProcess = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${DEBUG_PORT}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--user-data-dir=/tmp/ga-lab-phase2-chrome-profile',
    '--window-size=1280,800'
  ], { stdio: 'ignore' });

  let versionData = null;
  for (let i = 0; i < 20; i++) {
    try {
      versionData = await fetchJson(`http://127.0.0.1:${DEBUG_PORT}/json/version`);
      if (versionData) break;
    } catch {
      await sleep(200);
    }
  }

  if (!versionData) {
    chromeProcess.kill();
    throw new Error('Failed to connect to Chrome');
  }

  const targets = await fetchJson(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
  const pageTarget = targets.find(t => t.type === 'page') || targets[0];
  const cdp = new CDPClient(pageTarget.webSocketDebuggerUrl);
  await cdp.connect();

  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('DOM.enable');

  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 800,
    deviceScaleFactor: 1,
    mobile: false
  });

  console.log('Navigating to GA Lab...');
  await cdp.send('Page.navigate', { url: TARGET_URL });
  await sleep(1500);

  async function evalInPage(expression) {
    const res = await cdp.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    return res.result?.value;
  }

  // Switch to 3D View
  console.log('Switching to 3D View...');
  await evalInPage(`
    (() => {
      window.gaLabApp.setLandscapeMode('3D');
    })()
  `);
  await sleep(500);

  // --- Measurement 1: Profiling at pop 4 (60 frames) ---
  console.log('Measuring performance at Population N=4...');
  const perfPop4 = await evalInPage(`
    (async () => {
      const times = [];
      for (let i = 0; i < 60; i++) {
        const t0 = performance.now();
        window.gaLabApp.landscape3d.render(t0);
        times.push(performance.now() - t0);
        await new Promise(r => requestAnimationFrame(r));
      }
      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      return {
        avgMs: parseFloat(avg.toFixed(3)),
        gridSize: window.gaLabApp.landscape3d.numGrid,
        fallbackTriggered: window.gaLabApp.landscape3d.adaptiveFallbackTriggered
      };
    })()
  `);
  console.log('Perf at Pop 4:', perfPop4);

  // --- Screenshot (a): Default angle at Generation 1 ---
  console.log('Capturing Screenshot (a): Default angle Gen 1...');
  await evalInPage(`
    (() => {
      window.gaLabApp.goToStep(0);
      window.gaLabApp.landscape3d.resetCamera();
      window.gaLabApp.landscape3d.render(performance.now());
    })()
  `);
  await sleep(300);
  const shotA = await cdp.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.resolve(screenshotsDir, 'phase2-a-default-gen1.png'), Buffer.from(shotA.data, 'base64'));

  // --- Screenshot (b): After stepping to Generation 5 or later ---
  console.log('Capturing Screenshot (b): Generation 5+...');
  await evalInPage(`
    (() => {
      // Set maxGen to 5 in free play or step to latest
      window.gaLabApp.controls.el.maxGen.value = 5;
      window.gaLabApp.controls.emitChange();
      // Jump to step at gen 5
      window.gaLabApp.goToStep(window.gaLabApp.allSteps.length - 1);
      window.gaLabApp.landscape3d.render(performance.now());
    })()
  `);
  await sleep(400);
  const shotB = await cdp.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.resolve(screenshotsDir, 'phase2-b-step-gen5.png'), Buffer.from(shotB.data, 'base64'));

  // --- Screenshot (c): Rotated ~90 degrees from default ---
  console.log('Capturing Screenshot (c): Rotated ~90 degrees...');
  await evalInPage(`
    (() => {
      window.gaLabApp.landscape3d.yaw += 1.57; // ~90 degrees in radians
      window.gaLabApp.landscape3d.render(performance.now());
    })()
  `);
  await sleep(300);
  const shotC = await cdp.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.resolve(screenshotsDir, 'phase2-c-rotated-90deg.png'), Buffer.from(shotC.data, 'base64'));

  // --- Screenshot (d): Parent pair selected during selection ---
  console.log('Capturing Screenshot (d): Parent pair selected in SELECT phase...');
  await evalInPage(`
    (() => {
      // Find step in SELECT phase
      const selectIdx = window.gaLabApp.allSteps.findIndex(s => s.phase === 'SELECT');
      if (selectIdx >= 0) window.gaLabApp.goToStep(selectIdx);
      window.gaLabApp.landscape3d.resetCamera();
      window.gaLabApp.landscape3d.render(performance.now());
    })()
  `);
  await sleep(300);
  const shotD = await cdp.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.resolve(screenshotsDir, 'phase2-d-selection-parents.png'), Buffer.from(shotD.data, 'base64'));

  // --- Measurement 2: Profiling at pop 200 (60 frames) ---
  console.log('Measuring performance at Population N=200...');
  const perfPop200 = await evalInPage(`
    (async () => {
      window.gaLabApp.controls.el.popSize.value = 200;
      window.gaLabApp.controls.emitChange();
      await new Promise(r => setTimeout(r, 200));

      const times = [];
      for (let i = 0; i < 60; i++) {
        const t0 = performance.now();
        window.gaLabApp.landscape3d.render(t0);
        times.push(performance.now() - t0);
        await new Promise(r => requestAnimationFrame(r));
      }
      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      return {
        avgMs: parseFloat(avg.toFixed(3)),
        gridSize: window.gaLabApp.landscape3d.numGrid,
        fallbackTriggered: window.gaLabApp.landscape3d.adaptiveFallbackTriggered
      };
    })()
  `);
  console.log('Perf at Pop 200:', perfPop200);

  // --- Screenshot (e): Reduced-motion static pose ---
  console.log('Capturing Screenshot (e): Reduced Motion static pose...');
  await cdp.send('Emulation.setEmulatedMedia', {
    media: 'screen',
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }]
  });
  await evalInPage(`
    (() => {
      window.gaLabApp.landscape3d.resetCamera();
      window.gaLabApp.landscape3d.render(performance.now());
    })()
  `);
  await sleep(300);
  const shotE = await cdp.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.resolve(screenshotsDir, 'phase2-e-reduced-motion.png'), Buffer.from(shotE.data, 'base64'));

  // --- Screenshot (f): 2D fallback with "Reduced 3D" notice ---
  console.log('Capturing Screenshot (f): 2D fallback with notice...');
  await cdp.send('Emulation.setEmulatedMedia', { media: 'screen', features: [] });
  await evalInPage(`
    (() => {
      window.gaLabApp.fallbackTo2D('Reduced 3D');
    })()
  `);
  await sleep(300);
  const shotF = await cdp.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.resolve(screenshotsDir, 'phase2-f-fallback-notice.png'), Buffer.from(shotF.data, 'base64'));

  // Save Profiling Results
  const reportData = {
    pop4: perfPop4,
    pop200: perfPop200
  };
  fs.writeFileSync(path.resolve(screenshotsDir, 'phase2-perf.json'), JSON.stringify(reportData, null, 2));

  cdp.close();
  chromeProcess.kill();
  console.log('✔ All Phase 2 proofs and performance benchmarks completed successfully!');
}

main().catch(err => {
  console.error('Phase 2 proof error:', err);
  process.exit(1);
});
