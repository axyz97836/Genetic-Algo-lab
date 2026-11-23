/**
 * tests/capture-proof.mjs - Capture specific Phase 1 proof screenshots via Chrome DevTools Protocol.
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
const DEBUG_PORT = 9224;
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
  console.log('Launching headless Chrome for Proof Capture...');
  const chromeProcess = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${DEBUG_PORT}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--user-data-dir=/tmp/ga-lab-proof-chrome-profile',
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
  await sleep(1200);

  // Helper for evaluation
  async function evalInPage(expression) {
    const res = await cdp.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    return res.result?.value;
  }

  // --- Proof (a): 2x Close-up of one panel corner showing corner brackets ---
  console.log('Capturing Proof (a): 2x Corner Close-up...');
  const cornerRect = await evalInPage(`
    (() => {
      const panel = document.querySelector('#center-stage .stage-panel');
      const rect = panel.getBoundingClientRect();
      return { x: rect.left, y: rect.top, width: 80, height: 80 };
    })()
  `);

  const cornerShot = await cdp.send('Page.captureScreenshot', {
    format: 'png',
    clip: {
      x: cornerRect.x,
      y: cornerRect.y,
      width: cornerRect.width,
      height: cornerRect.height,
      scale: 2 // 2x close-up
    }
  });
  fs.writeFileSync(path.resolve(screenshotsDir, 'proof-a-corner-2x.png'), Buffer.from(cornerShot.data, 'base64'));

  // --- Proof (b): Three screenshots showing tilt at far-left, center, far-right ---
  console.log('Capturing Proof (b.1): Tilt Far-Left...');
  await evalInPage(`
    (() => {
      window.gaLabApp.tilt.targetRotX = 0;
      window.gaLabApp.tilt.targetRotY = -6.0;
      window.gaLabApp.tilt.rotX = 0;
      window.gaLabApp.tilt.rotY = -6.0;
      document.getElementById('app-root').style.setProperty('--tilt-rx', '0.000deg');
      document.getElementById('app-root').style.setProperty('--tilt-ry', '-6.000deg');
    })()
  `);
  await sleep(200);
  const tiltLeft = await cdp.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.resolve(screenshotsDir, 'proof-b-tilt-far-left.png'), Buffer.from(tiltLeft.data, 'base64'));

  console.log('Capturing Proof (b.2): Tilt Center...');
  await evalInPage(`
    (() => {
      window.gaLabApp.tilt.targetRotX = 0;
      window.gaLabApp.tilt.targetRotY = 0;
      window.gaLabApp.tilt.rotX = 0;
      window.gaLabApp.tilt.rotY = 0;
      document.getElementById('app-root').style.setProperty('--tilt-rx', '0.000deg');
      document.getElementById('app-root').style.setProperty('--tilt-ry', '0.000deg');
    })()
  `);
  await sleep(200);
  const tiltCenter = await cdp.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.resolve(screenshotsDir, 'proof-b-tilt-center.png'), Buffer.from(tiltCenter.data, 'base64'));

  console.log('Capturing Proof (b.3): Tilt Far-Right...');
  await evalInPage(`
    (() => {
      window.gaLabApp.tilt.targetRotX = 0;
      window.gaLabApp.tilt.targetRotY = 6.0;
      window.gaLabApp.tilt.rotX = 0;
      window.gaLabApp.tilt.rotY = 6.0;
      document.getElementById('app-root').style.setProperty('--tilt-rx', '0.000deg');
      document.getElementById('app-root').style.setProperty('--tilt-ry', '6.000deg');
    })()
  `);
  await sleep(200);
  const tiltRight = await cdp.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.resolve(screenshotsDir, 'proof-b-tilt-far-right.png'), Buffer.from(tiltRight.data, 'base64'));

  // --- Proof (c): Prefers-Reduced-Motion On ---
  console.log('Capturing Proof (c): Prefers-Reduced-Motion ON...');
  await cdp.send('Emulation.setEmulatedMedia', {
    media: 'screen',
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }]
  });
  await evalInPage(`
    (() => {
      window.gaLabApp.tilt.reset();
    })()
  `);
  await sleep(300);
  const reducedMotionShot = await cdp.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.resolve(screenshotsDir, 'proof-c-reduced-motion.png'), Buffer.from(reducedMotionShot.data, 'base64'));

  cdp.close();
  chromeProcess.kill();
  console.log('✔ All 5 proof screenshots captured successfully!');
}

main().catch(err => {
  console.error('Proof capture error:', err);
  process.exit(1);
});
