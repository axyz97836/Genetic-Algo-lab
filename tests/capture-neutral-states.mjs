/**
 * tests/capture-neutral-states.mjs
 * Captures screenshots of:
 * - "no crossover" state (Pair 2 in ref-roulette Crossover step)
 * - "no mutation" state (Child 2 in ref-roulette Mutation step)
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
const DEBUG_PORT = 9235;
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

async function captureCard(cdp, filename, selector) {
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

  const screenshot = await cdp.send('Page.captureScreenshot', { clip: clip.result.value });
  const buf = Buffer.from(screenshot.data, 'base64');
  const filePath = path.join(screenshotsDir, filename);
  fs.writeFileSync(filePath, buf);
  if (fs.existsSync(artifactDir)) {
    fs.writeFileSync(path.join(artifactDir, filename), buf);
  }
  console.log(`Saved screenshot: ${filename} (${clip.result.value.width}x${clip.result.value.height})`);
}

async function main() {
  console.log('Capturing neutral states (no crossover & no mutation)...');
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
      } catch (e) {
        await sleep(500);
      }
    }
    if (!targets) throw new Error('Could not connect to Chrome debugging port');
    const cdp = new CDPClient(targets[0].webSocketDebuggerUrl);
    await cdp.connect();

    await cdp.send('Page.navigate', { url: TARGET_URL });
    await sleep(2000);

    // 1. Crossover Step (idx 3) -> Pair 2 has no crossover
    await cdp.send('Runtime.evaluate', {
      expression: `
        if (window.gaLabApp) {
          window.gaLabApp.goToStep(3);
          const el = document.querySelectorAll('#chromosome-strips .strip-item')[1]; // Pair 2
          if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' });
        }
      `
    });
    await sleep(500);
    await captureCard(cdp, 'proof-no-crossover.png', '#chromosome-strips .strip-item:nth-child(2)');

    // 2. Mutation Step (idx 4) -> Child 2 has no mutation
    await cdp.send('Runtime.evaluate', {
      expression: `
        if (window.gaLabApp) {
          window.gaLabApp.goToStep(4);
          const el = document.querySelectorAll('#chromosome-strips .strip-item')[1]; // Child 2
          if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' });
        }
      `
    });
    await sleep(500);
    await captureCard(cdp, 'proof-no-mutation.png', '#chromosome-strips .strip-item:nth-child(2)');

    cdp.close();
    proc.kill();
    console.log('Successfully captured proof-no-crossover.png and proof-no-mutation.png');
  } catch (err) {
    console.error('Error:', err);
    proc.kill();
    process.exit(1);
  }
}

main();
