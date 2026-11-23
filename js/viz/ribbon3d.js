/**
 * js/viz/ribbon3d.js - 3D Ribbon Convergence Visualizer.
 * Extrudes Best (Lime) and Avg (Stone) as physical 3D ribbons side by side along depth axis.
 * Worst and Diversity series stay on floor plane. Mutation events appear as Lime pins.
 *
 * Conforms to SPEC.md and UI Redesign:
 * - Strict 3-color palette: Graphite (#101417), Stone (#D8D4C8), Lime (#C6F135)
 * - Pure Canvas 2D perspective software projection (zero 3D runtime dependencies)
 * - Safe read-only observer: frozen snapshots in, own rAF loop, nothing written back to GA
 */

import { project3DTo2D } from './projection3d.js';

export class Ribbon3DVisualizer {
  constructor(canvasId = 'convergence-ribbon-canvas', options = {}) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    this.onFallback = options.onFallback || (() => {});

    // Camera state
    this.defaultYaw = 0.55;   // ~31 degrees
    this.defaultPitch = 0.48; // ~27 degrees
    this.yaw = this.defaultYaw;
    this.pitch = this.defaultPitch;
    this.distance = 520;
    this.fov = 420;

    // Interaction flags
    this.isDragging = false;
    this.lastPointerX = 0;
    this.lastPointerY = 0;
    this.rafId = null;
    this.isVisible = true;

    // Performance profiling & adaptive fallback
    this.frameTimes = [];
    this.maxFrameSamples = 20;
    this.avgFrameTime = 0;
    this.adaptiveFallbackTriggered = false;

    // Data buffers
    this.history = [];
    this.currentGen = 1;
    this.mutationEvents = [];

    this.initDOM();
    this.bindEvents();
    this.setupVisibilityObservers();
  }

  initDOM() {
    if (!this.canvas) return;
    this.canvas.setAttribute('tabindex', '0');
    this.canvas.setAttribute('role', 'img');
    this.canvas.setAttribute('aria-label', '3D ribbon convergence chart');
  }

  bindEvents() {
    if (!this.canvas) return;

    this.canvas.addEventListener('pointerdown', (e) => {
      this.isDragging = true;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
      this.canvas.setPointerCapture(e.pointerId);
      this.canvas.style.cursor = 'grabbing';
    });

    this.canvas.addEventListener('pointermove', (e) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.lastPointerX;
      const dy = e.clientY - this.lastPointerY;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;

      this.yaw += dx * 0.007;
      this.pitch = Math.max(0.12, Math.min(1.4, this.pitch + dy * 0.007));
    });

    const stopDrag = (e) => {
      if (this.isDragging) {
        this.isDragging = false;
        try { this.canvas.releasePointerCapture(e.pointerId); } catch (_) {}
        this.canvas.style.cursor = 'grab';
      }
    };
    this.canvas.addEventListener('pointerup', stopDrag);
    this.canvas.addEventListener('pointercancel', stopDrag);

    // Keyboard rotation & Reset
    this.canvas.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') {
        this.yaw -= 0.05;
        e.preventDefault();
      } else if (e.key === 'ArrowRight') {
        this.yaw += 0.05;
        e.preventDefault();
      } else if (e.key === 'ArrowUp') {
        this.pitch = Math.min(1.4, this.pitch + 0.05);
        e.preventDefault();
      } else if (e.key === 'ArrowDown') {
        this.pitch = Math.max(0.12, this.pitch - 0.05);
        e.preventDefault();
      } else if (e.key === 'r' || e.key === 'R') {
        this.resetCamera();
        e.preventDefault();
      }
    });
  }

  setupVisibilityObservers() {
    if (!this.canvas || typeof IntersectionObserver === 'undefined') return;

    this.observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        this.isVisible = entry.isIntersecting;
        if (this.isVisible) {
          this.startLoop();
        } else {
          this.stopLoop();
        }
      }
    }, { threshold: 0.1 });

    this.observer.observe(this.canvas);

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.stopLoop();
      } else if (this.isVisible) {
        this.startLoop();
      }
    });
  }

  resetCamera() {
    this.yaw = this.defaultYaw;
    this.pitch = this.defaultPitch;
  }

  updateSnapshot(history, currentGen = 1, mutationEvents = []) {
    this.history = history ? [...history] : [];
    this.currentGen = currentGen;
    this.mutationEvents = mutationEvents ? [...mutationEvents] : [];
    this.updateAriaLabel();
  }

  updateAriaLabel() {
    if (!this.canvas) return;
    const best = this.history[this.history.length - 1]?.stats?.bestF;
    const avg = this.history[this.history.length - 1]?.stats?.avgF;
    const bestStr = best !== undefined ? best.toFixed(4) : 'N/A';
    const avgStr = avg !== undefined ? avg.toFixed(4) : 'N/A';
    this.canvas.setAttribute('aria-label',
      `3D ribbon convergence chart: generation 1 to ${this.currentGen}, Best fitness ${bestStr}, Average fitness ${avgStr}`
    );
  }

  startLoop() {
    if (this.rafId) return;
    let lastTs = performance.now();
    const frame = (ts) => {
      const interval = ts - lastTs;
      lastTs = ts;
      this.render(ts, interval);
      this.rafId = requestAnimationFrame(frame);
    };
    this.rafId = requestAnimationFrame(frame);
  }

  stopLoop() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  render(timestamp = performance.now(), frameInterval = null) {
    if (!this.canvas || !this.ctx || !this.isVisible) return;
    const frameStart = performance.now();

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.canvas.getBoundingClientRect();
    const cssW = rect.width > 50 ? rect.width : 540;
    const cssH = rect.height > 50 ? rect.height : 320;

    if (this.canvas.width !== Math.floor(cssW * dpr) || this.canvas.height !== Math.floor(cssH * dpr)) {
      this.canvas.width = Math.floor(cssW * dpr);
      this.canvas.height = Math.floor(cssH * dpr);
    }

    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    // Clear background to solid Graphite (#101417)
    ctx.fillStyle = '#101417';
    ctx.fillRect(0, 0, cssW, cssH);

    // Filter valid history items up to current generation
    const validData = this.history
      .filter(h => h && h.stats && typeof h.stats.bestF === 'number' && h.generationIndex <= this.currentGen)
      .map(h => ({
        gen: h.generationIndex,
        bestF: h.stats.bestF,
        avgF: h.stats.avgF,
        worstF: h.stats.worstF,
        diversity: h.stats.distinctCount || 0
      }));

    if (validData.length === 0) {
      this.renderEmptyState(ctx, cssW, cssH);
      return;
    }

    // Determine scale limits
    let minF = Infinity;
    let maxF = -Infinity;
    let maxDiv = 4;
    for (const d of validData) {
      if (d.bestF < minF) minF = d.bestF;
      if (d.worstF < minF) minF = d.worstF;
      if (d.avgF < minF) minF = d.avgF;
      if (d.bestF > maxF) maxF = d.bestF;
      if (d.worstF > maxF) maxF = d.worstF;
      if (d.avgF > maxF) maxF = d.avgF;
      if (d.diversity > maxDiv) maxDiv = d.diversity;
    }

    if (minF === maxF) { minF -= 1; maxF += 1; }
    else {
      const pad = (maxF - minF) * 0.12;
      minF -= pad;
      maxF += pad;
    }

    const fRange = maxF - minF;
    const totalGens = Math.max(1, validData[validData.length - 1].gen);

    // Intentional Spacing for Short Runs (G <= 3): ensure minimum width so nothing looks like a sliver
    const minSpacing = totalGens <= 3 ? 120 : 60;
    const worldW = Math.max(280, (totalGens - 1) * minSpacing);
    const originX = -worldW * 0.5;
    const worldH = 130;

    const mapWorldX = (gen) => {
      if (totalGens <= 1) return 0;
      return originX + ((gen - 1) / (totalGens - 1)) * worldW;
    };
    const mapWorldY = (f) => ((f - minF) / fRange) * worldH;
    const mapWorldYDiv = (div) => (div / maxDiv) * (worldH * 0.6);

    // Ribbon Depths
    const zBest = -22;
    const zAvg = 22;
    const ribbonHalfThick = 9;

    // 1. Draw Floor Grid & Axes in Stone (0 Y-plane)
    this.drawFloorGrid(ctx, originX, worldW, cssW, cssH, totalGens);

    // 2. Worst and Diversity Floor Lines
    this.drawFloorLines(ctx, validData, mapWorldX, mapWorldY, mapWorldYDiv, cssW, cssH);

    // 3. Extruded 3D Ribbons: Avg Ribbon (Stone) and Best Ribbon (Lime)
    // Draw far ribbon first based on camera yaw
    const drawAvgFirst = Math.cos(this.yaw) >= 0;
    if (drawAvgFirst) {
      this.drawRibbon(ctx, validData, mapWorldX, mapWorldY, zAvg, ribbonHalfThick, '#D8D4C8', 'rgba(216, 212, 200, 0.45)', cssW, cssH);
      this.drawRibbon(ctx, validData, mapWorldX, mapWorldY, zBest, ribbonHalfThick, '#C6F135', 'rgba(198, 241, 53, 0.55)', cssW, cssH);
    } else {
      this.drawRibbon(ctx, validData, mapWorldX, mapWorldY, zBest, ribbonHalfThick, '#C6F135', 'rgba(198, 241, 53, 0.55)', cssW, cssH);
      this.drawRibbon(ctx, validData, mapWorldX, mapWorldY, zAvg, ribbonHalfThick, '#D8D4C8', 'rgba(216, 212, 200, 0.45)', cssW, cssH);
    }

    // 4. Mutation Pins (Lime pins on Best Ribbon)
    this.drawMutationPins(ctx, validData, mapWorldX, mapWorldY, zBest, cssW, cssH);

    // 5. Draw HUD & Legend in Stone
    this.drawHud(ctx, cssW, cssH, minF, maxF, totalGens);

    // Adaptive frame monitoring
    const duration = frameInterval !== null && frameInterval > 0 ? frameInterval : (performance.now() - frameStart);
    this.recordFrameTime(duration);
  }

  drawFloorGrid(ctx, originX, worldW, screenW, screenH, totalGens) {
    ctx.save();
    ctx.strokeStyle = 'rgba(216, 212, 200, 0.15)';
    ctx.lineWidth = 1;

    // Floor boundary rectangle
    const zMin = -50;
    const zMax = 50;

    const p0 = project3DTo2D(originX, 0, zMin, this.yaw, this.pitch, this.distance, this.fov, screenW, screenH);
    const p1 = project3DTo2D(originX + worldW, 0, zMin, this.yaw, this.pitch, this.distance, this.fov, screenW, screenH);
    const p2 = project3DTo2D(originX + worldW, 0, zMax, this.yaw, this.pitch, this.distance, this.fov, screenW, screenH);
    const p3 = project3DTo2D(originX, 0, zMax, this.yaw, this.pitch, this.distance, this.fov, screenW, screenH);

    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.lineTo(p3.x, p3.y);
    ctx.closePath();
    ctx.stroke();

    // Generation grid lines along floor
    ctx.fillStyle = 'rgba(216, 212, 200, 0.62)';
    ctx.font = '11px "JetBrains Mono", monospace';

    for (let g = 1; g <= totalGens; g++) {
      const gx = totalGens <= 1 ? 0 : originX + ((g - 1) / (totalGens - 1)) * worldW;
      const g0 = project3DTo2D(gx, 0, zMin, this.yaw, this.pitch, this.distance, this.fov, screenW, screenH);
      const g1 = project3DTo2D(gx, 0, zMax, this.yaw, this.pitch, this.distance, this.fov, screenW, screenH);

      ctx.beginPath();
      ctx.moveTo(g0.x, g0.y);
      ctx.lineTo(g1.x, g1.y);
      ctx.stroke();

      // Generation label
      ctx.fillText(`G${g}`, g1.x - 6, g1.y + 16);
    }

    ctx.restore();
  }

  drawFloorLines(ctx, validData, mapX, mapY, mapDiv, screenW, screenH) {
    if (validData.length < 2) return;
    ctx.save();

    // Worst floor line: dashed Stone
    ctx.strokeStyle = 'rgba(216, 212, 200, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    for (let i = 0; i < validData.length; i++) {
      const d = validData[i];
      const pt = project3DTo2D(mapX(d.gen), 0, 40, this.yaw, this.pitch, this.distance, this.fov, screenW, screenH);
      if (i === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    }
    ctx.stroke();

    // Diversity floor line: dotted Stone
    ctx.strokeStyle = 'rgba(216, 212, 200, 0.62)';
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    for (let i = 0; i < validData.length; i++) {
      const d = validData[i];
      const pt = project3DTo2D(mapX(d.gen), mapDiv(d.diversity), 40, this.yaw, this.pitch, this.distance, this.fov, screenW, screenH);
      if (i === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    }
    ctx.stroke();

    ctx.restore();
  }

  drawRibbon(ctx, validData, mapX, mapY, zCenter, halfThick, topColor, sideColor, screenW, screenH) {
    if (validData.length === 0) return;

    const zBack = zCenter - halfThick;
    const zFront = zCenter + halfThick;

    // Single point (Gen 1 only): render 3D pillar box so it doesn't look like a sliver
    if (validData.length === 1) {
      const d = validData[0];
      const wx = mapX(d.gen);
      const wy = mapY(zCenter < 0 ? d.bestF : d.avgF);
      const halfW = 20;

      const pTopFrontL = project3DTo2D(wx - halfW, wy, zFront, this.yaw, this.pitch, this.distance, this.fov, screenW, screenH);
      const pTopFrontR = project3DTo2D(wx + halfW, wy, zFront, this.yaw, this.pitch, this.distance, this.fov, screenW, screenH);
      const pTopBackR  = project3DTo2D(wx + halfW, wy, zBack, this.yaw, this.pitch, this.distance, this.fov, screenW, screenH);
      const pTopBackL  = project3DTo2D(wx - halfW, wy, zBack, this.yaw, this.pitch, this.distance, this.fov, screenW, screenH);
      const pBotFrontL = project3DTo2D(wx - halfW, 0, zFront, this.yaw, this.pitch, this.distance, this.fov, screenW, screenH);
      const pBotFrontR = project3DTo2D(wx + halfW, 0, zFront, this.yaw, this.pitch, this.distance, this.fov, screenW, screenH);

      ctx.save();
      // Front Face
      ctx.fillStyle = sideColor;
      ctx.beginPath();
      ctx.moveTo(pTopFrontL.x, pTopFrontL.y);
      ctx.lineTo(pTopFrontR.x, pTopFrontR.y);
      ctx.lineTo(pBotFrontR.x, pBotFrontR.y);
      ctx.lineTo(pBotFrontL.x, pBotFrontL.y);
      ctx.closePath();
      ctx.fill();

      // Top Face
      ctx.fillStyle = topColor;
      ctx.beginPath();
      ctx.moveTo(pTopFrontL.x, pTopFrontL.y);
      ctx.lineTo(pTopFrontR.x, pTopFrontR.y);
      ctx.lineTo(pTopBackR.x, pTopBackR.y);
      ctx.lineTo(pTopBackL.x, pTopBackL.y);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#101417';
      ctx.stroke();
      ctx.restore();
      return;
    }

    // Multi-generation segments
    for (let i = 0; i < validData.length - 1; i++) {
      const d0 = validData[i];
      const d1 = validData[i + 1];

      const f0 = zCenter < 0 ? d0.bestF : d0.avgF;
      const f1 = zCenter < 0 ? d1.bestF : d1.avgF;

      const x0 = mapX(d0.gen);
      const x1 = mapX(d1.gen);
      const y0 = mapY(f0);
      const y1 = mapY(f1);

      // Points for segment
      const tFL0 = project3DTo2D(x0, y0, zFront, this.yaw, this.pitch, this.distance, this.fov, screenW, screenH);
      const tFL1 = project3DTo2D(x1, y1, zFront, this.yaw, this.pitch, this.distance, this.fov, screenW, screenH);
      const tBL1 = project3DTo2D(x1, y1, zBack, this.yaw, this.pitch, this.distance, this.fov, screenW, screenH);
      const tBL0 = project3DTo2D(x0, y0, zBack, this.yaw, this.pitch, this.distance, this.fov, screenW, screenH);

      const bFL0 = project3DTo2D(x0, 0, zFront, this.yaw, this.pitch, this.distance, this.fov, screenW, screenH);
      const bFL1 = project3DTo2D(x1, 0, zFront, this.yaw, this.pitch, this.distance, this.fov, screenW, screenH);

      ctx.save();

      // 1. Front Vertical Extrusion Face (Shaded)
      ctx.fillStyle = sideColor;
      ctx.beginPath();
      ctx.moveTo(tFL0.x, tFL0.y);
      ctx.lineTo(tFL1.x, tFL1.y);
      ctx.lineTo(bFL1.x, bFL1.y);
      ctx.lineTo(bFL0.x, bFL0.y);
      ctx.closePath();
      ctx.fill();

      // 2. Top Ribbon Surface (Full Signal Color)
      ctx.fillStyle = topColor;
      ctx.beginPath();
      ctx.moveTo(tFL0.x, tFL0.y);
      ctx.lineTo(tFL1.x, tFL1.y);
      ctx.lineTo(tBL1.x, tBL1.y);
      ctx.lineTo(tBL0.x, tBL0.y);
      ctx.closePath();
      ctx.fill();

      // Outline border
      ctx.strokeStyle = '#101417';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.restore();
    }
  }

  drawMutationPins(ctx, validData, mapX, mapY, zBest, screenW, screenH) {
    if (this.mutationEvents.length === 0 && validData.length > 0) return;

    ctx.save();
    for (const d of validData) {
      const wx = mapX(d.gen);
      const wy = mapY(d.bestF);
      const ptFloor = project3DTo2D(wx, 0, zBest, this.yaw, this.pitch, this.distance, this.fov, screenW, screenH);
      const ptTop   = project3DTo2D(wx, wy, zBest, this.yaw, this.pitch, this.distance, this.fov, screenW, screenH);

      // Pin Needle (Lime line)
      ctx.strokeStyle = '#C6F135';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(ptFloor.x, ptFloor.y);
      ctx.lineTo(ptTop.x, ptTop.y);
      ctx.stroke();

      // Pin Head (small Lime diamond/sphere)
      ctx.fillStyle = '#C6F135';
      ctx.strokeStyle = '#101417';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(ptTop.x, ptTop.y - 4, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  drawHud(ctx, screenW, screenH, minF, maxF, totalGens) {
    ctx.save();
    ctx.fillStyle = '#D8D4C8';
    ctx.font = '11px "JetBrains Mono", monospace';

    // HUD Text
    ctx.fillText('▲ 3D Ribbon Convergence: Best (Lime) │ Avg (Stone)', 12, screenH - 14);

    const yawDeg = Math.round(((this.yaw % (Math.PI * 2)) * 180) / Math.PI);
    ctx.fillStyle = 'rgba(216, 212, 200, 0.62)';
    ctx.fillText(`Yaw: ${yawDeg}°`, screenW - 68, screenH - 14);

    ctx.restore();
  }

  renderEmptyState(ctx, screenW, screenH) {
    ctx.save();
    ctx.fillStyle = 'rgba(216, 212, 200, 0.62)';
    ctx.font = '12px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('No generation statistics available yet', screenW / 2, screenH / 2);
    ctx.restore();
  }

  recordFrameTime(durationMs) {
    this.frameTimes.push(durationMs);
    if (this.frameTimes.length > this.maxFrameSamples) {
      this.frameTimes.shift();
    }

    if (this.frameTimes.length === this.maxFrameSamples) {
      const sum = this.frameTimes.reduce((a, b) => a + b, 0);
      this.avgFrameTime = sum / this.maxFrameSamples;

      // Adaptive Quality Check: > 24ms
      if (this.avgFrameTime > 24.0 && !this.adaptiveFallbackTriggered) {
        this.adaptiveFallbackTriggered = true;
        this.stopLoop();
        this.onFallback('Reduced 3D');
      }
    }
  }
}
