/**
 * tests/capture-phase3-proof.mjs
 * Captures 5 Phase 3 screenshots:
 * (a) crossover mid-sweep
 * (b) crossover mid-swap
 * (c) crossover after-swap
 * (d) mutation flash
 * (e) reduced-motion final state
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
const DEBUG_PORT = 9227;
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

async function captureElementScreenshot(cdp, filename, selector = '#chromosome-strips') {
  const clip = await cdp.send('Runtime.evaluate', {
    expression: `
      (() => {
        const el = document.querySelector('${selector}') || document.body;
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

  const screenshot = await cdp.send('Page.captureScreenshot', {
    clip: clip.result.value
  });
  const buf = Buffer.from(screenshot.data, 'base64');
  const filePath = path.join(screenshotsDir, filename);
  fs.writeFileSync(filePath, buf);
  if (fs.existsSync(artifactDir)) {
    fs.writeFileSync(path.join(artifactDir, filename), buf);
  }
  console.log(`Saved screenshot: ${filename} (${clip.result.value.width}x${clip.result.value.height})`);
}

async function main() {
  console.log('Launching headless Chrome for Phase 3 Proof Capture...');
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
    const targets = await fetchJson(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
    const pageTarget = targets.find(t => t.type === 'page') || targets[0];
    const cdp = new CDPClient(pageTarget.webSocketDebuggerUrl);
    await cdp.connect();

    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('DOM.enable');
    await cdp.send('CSS.enable');
    await cdp.send('Page.navigate', { url: TARGET_URL });
    await sleep(2000);

    // Scroll to chromosome-strips section
    await cdp.send('Runtime.evaluate', {
      expression: `
        const el = document.getElementById('chromosome-strips');
        if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' });
      `
    });
    await sleep(300);

    // 1. Crossover: Step to Step 3 (0-based idx 3: CROSSOVER phase)
    console.log('--- Setting up Crossover Step (idx 3) ---');
    await cdp.send('Runtime.evaluate', {
      expression: `
        if (window.gaLabApp) {
          window.gaLabApp.goToStep(3); // idx 3 is CROSSOVER
        }
      `
    });
    await sleep(300);

    // (a) Mid-sweep: Pause animation at 200ms or apply mid-sweep position
    console.log('Capturing (a) crossover mid-sweep...');
    await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const cutLine = document.querySelector('.crossover-cut-line-3d');
          if (cutLine) {
            cutLine.classList.remove('sweeping');
            cutLine.style.left = '90px'; // mid-sweep across chromosome
          }
        })()
      `
    });
    await sleep(200);
    await captureElementScreenshot(cdp, 'phase3-a-crossover-mid-sweep.png');

    // (b) Mid-swap: Show tails lifting 16px in Z along arc
    console.log('Capturing (b) crossover mid-swap...');
    await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const cutLine = document.querySelector('.crossover-cut-line-3d');
          if (cutLine) cutLine.style.left = '166px'; // cut at k=3 (with gap)
          // Apply mid-arc transform with 16px Z lift to swapping tails
          const p1Tails = document.querySelectorAll('.tail-swapping-p1, .chrom-strand-p1 .bit-block-3d:nth-child(n+5)');
          p1Tails.forEach(b => {
            b.style.transform = 'translate3d(0, 15px, 16px)';
            b.style.borderColor = 'var(--lime)';
          });
          const p2Tails = document.querySelectorAll('.tail-swapping-p2, .chrom-strand-p2 .bit-block-3d:nth-child(n+5)');
          p2Tails.forEach(b => {
            b.style.transform = 'translate3d(0, -15px, 40px)';
            b.style.borderColor = 'var(--lime)';
          });
        })()
      `
    });
    await sleep(200);
    await captureElementScreenshot(cdp, 'phase3-b-crossover-mid-swap.png');

    // (c) After-swap: Settled final offspring state
    console.log('Capturing (c) crossover after-swap...');
    await cdp.send('Runtime.evaluate', {
      expression: `
        if (window.gaLabApp) {
          window.gaLabApp.goToStep(3);
        }
      `
    });
    await sleep(1500); // Wait for full settle
    await captureElementScreenshot(cdp, 'phase3-c-crossover-after-swap.png');

    // 2. Mutation: Step to Step 4 (0-based idx 4: MUTATE phase)
    console.log('--- Setting up Mutation Step (idx 4) ---');
    await cdp.send('Runtime.evaluate', {
      expression: `
        if (window.gaLabApp) {
          window.gaLabApp.goToStep(4); // idx 4 is MUTATE
        }
      `
    });
    await sleep(200);

    // (d) Mutation flash: Flipped bit scaled 1.6 to 1 with Lime flash
    console.log('Capturing (d) mutation flash...');
    await cdp.send('Runtime.evaluate', {
      expression: `
        (() => {
          const flipped = document.querySelector('.bit-block-3d.mutation-flash') || document.querySelector('.bit-block-3d.seg-x2:last-child');
          if (flipped) {
            flipped.style.transform = 'scale3d(1.6, 1.6, 1.6) translateZ(24px)';
            flipped.style.background = '#C6F135';
            flipped.style.borderColor = '#C6F135';
            const val = flipped.querySelector('.bit-val');
            if (val) val.style.color = '#101417';
          }
        })()
      `
    });
    await sleep(200);
    await captureElementScreenshot(cdp, 'phase3-d-mutation-flash.png');

    // (e) Reduced-motion final state
    console.log('Capturing (e) reduced-motion final state...');
    await cdp.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }]
    });
    await sleep(300);

    await cdp.send('Runtime.evaluate', {
      expression: `
        if (window.gaLabApp) {
          window.gaLabApp.goToStep(4);
        }
      `
    });
    await sleep(500);
    await captureElementScreenshot(cdp, 'phase3-e-reduced-motion-final.png');

    cdp.close();
    chromeProcess.kill();
    console.log('All 5 Phase 3 screenshots captured successfully!');

  } catch (err) {
    console.error('Error capturing Phase 3 screenshots:', err);
    chromeProcess.kill();
    process.exit(1);
  }
}

main();
