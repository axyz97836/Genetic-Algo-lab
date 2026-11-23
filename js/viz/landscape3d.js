/**
 * js/viz/landscape3d.js - Interactive 3D Fitness Landscape Visualizer.
 * Conforms to SPEC.md §4.3a and UI Redesign Phase 2 Requirements:
 * - Pure Canvas 2D software perspective projection (Zero Three.js / WebGL / external libraries)
 * - Painter's Algorithm: bars sorted far-to-near; box faces far-to-near; top face rendered last
 * - 8% height tweening with 900ms rise-in transition
 * - Yaw auto-rotation (0.004 rad/frame), pointer-drag rotation, keyboard arrows, R reset
 * - Pre-allocated render buffers (zero object allocation inside rAF loop)
 * - Strict 3-color flat shading (--graphite #101417, --stone #D8D4C8, --lime #C6F135)
 * - IntersectionObserver and document.hidden pause
 * - Adaptive quality monitoring with 2D fallback notice
 * - Accessible canvas with role="img" and dynamic aria-label
 */

import { project3DTo2D, calculateBarDepth, sortFarToNear, downsampleGrid } from './projection3d.js';
import { getSequentialMonochromeColor } from './colormap.js';
import { calculateDeltaX, decodeChromosome } from '../engine/decode.js';
import { STEP_PHASES } from '../engine/engine.js';

export class Landscape3DVisualizer {
  /**
   * @param {string} canvasId
   * @param {string} tooltipId
   * @param {Object} options
   */
  constructor(canvasId = 'landscape-3d-canvas', tooltipId = 'heatmap-tooltip', options = {}) {
    this.canvas = document.getElementById(canvasId);
    this.tooltip = document.getElementById(tooltipId);
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    this.onFallback = options.onFallback || (() => {});

    // Camera & Transform state
    this.defaultYaw = 0.785;  // ~45 degrees
    this.defaultPitch = 0.58; // ~33 degrees
    this.yaw = this.defaultYaw;
    this.pitch = this.defaultPitch;
    this.distance = 550;
    this.fov = 420;

    // Interaction flags
    this.isDragging = false;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.startYaw = this.yaw;
    this.startPitch = this.pitch;
    this.autoRotate = true;
    this.yawSpeed = 0.004;

    // Metric display: 'F' (fitness) vs 'f' (objective)
    this.metricMode = 'F';

    // Animation & Tweening state
    this.targetHeights = [];
    this.currentHeights = [];
    this.firstRenderTime = 0;
    this.riseDuration = 900; // ms
    this.rafId = null;
    this.isVisible = true;

    // Adaptive quality monitoring
    this.frameTimes = [];
    this.maxFrameSamples = 20;
    this.qualityReduced = false;
    this.adaptiveFallbackTriggered = false;
    this.downsampleFactor = 1;
    this.avgFrameTime = 0;

    // Data buffers
    this.gridData = [];
    this.numGrid = 16;
    this.minF = 0;
    this.maxF = 1;
    this.minFitness = 0;
    this.maxFitness = 1;
    this.currentPopulation = [];
    this.hoverCell = null;
    this.lastRecord = null;
    this.config = null;
    this.schemaMatches = [];

    // Pre-allocated arrays for zero-GC render loop
    this.preallocatedBars = [];
    this.preallocatedVertices = [];
    this.initPreallocatedBuffers(32);

    this.initAccessibility();
    this.bindEvents();
    this.observeVisibility();
  }

  initAccessibility() {
    if (!this.canvas) return;
    this.canvas.setAttribute('role', 'img');
    this.canvas.setAttribute('aria-label', '3D Fitness Landscape: Initializing...');
  }

  initPreallocatedBuffers(maxGrid = 32) {
    const totalBars = maxGrid * maxGrid;
    this.preallocatedBars = new Array(totalBars);
    for (let i = 0; i < totalBars; i++) {
      this.preallocatedBars[i] = {
        d1: 0,
        d2: 0,
        x1: 0,
        x2: 0,
        val: 0,
        normVal: 0,
        targetH: 0,
        currentH: 0,
        depth: 0,
        px: 0,
        py: 0
      };
    }

    // 8 vertices per box
    this.preallocatedVertices = new Array(8);
    for (let i = 0; i < 8; i++) {
      this.preallocatedVertices[i] = { x: 0, y: 0, depth: 0, visible: true };
    }
  }

  bindEvents() {
    if (!this.canvas) return;

    // Pointer Drag Rotation
    this.canvas.addEventListener('pointerdown', (e) => {
      this.isDragging = true;
      this.dragStartX = e.clientX;
      this.dragStartY = e.clientY;
      this.startYaw = this.yaw;
      this.startPitch = this.pitch;
      this.canvas.setPointerCapture(e.pointerId);
    });

    window.addEventListener('pointermove', (e) => {
      if (this.isDragging) {
        const dx = e.clientX - this.dragStartX;
        const dy = e.clientY - this.dragStartY;
        this.yaw = this.startYaw + dx * 0.008;
        this.pitch = Math.max(0.15, Math.min(1.4, this.startPitch + dy * 0.008));
      } else {
        this.handlePointerHover(e);
      }
    });

    window.addEventListener('pointerup', (e) => {
      if (this.isDragging) {
        this.isDragging = false;
        try { this.canvas.releasePointerCapture(e.pointerId); } catch (_) {}
      }
    });

    this.canvas.addEventListener('mouseleave', () => {
      this.hoverCell = null;
      if (this.tooltip) this.tooltip.style.display = 'none';
    });

    // Keyboard Arrow Keys & R Reset
    window.addEventListener('keydown', (e) => {
      if (!this.isVisible || this.canvas.style.display === 'none') return;
      if (e.key === 'ArrowLeft') {
        this.yaw -= 0.08;
      } else if (e.key === 'ArrowRight') {
        this.yaw += 0.08;
      } else if (e.key === 'ArrowUp') {
        this.pitch = Math.min(1.4, this.pitch + 0.06);
      } else if (e.key === 'ArrowDown') {
        this.pitch = Math.max(0.15, this.pitch - 0.06);
      } else if (e.key === 'r' || e.key === 'R') {
        if (e.target.tagName !== 'INPUT') {
          this.resetCamera();
        }
      }
    });
  }

  observeVisibility() {
    if (!this.canvas) return;

    if ('IntersectionObserver' in window) {
      this.observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          this.isVisible = entry.isIntersecting;
          if (this.isVisible) this.startLoop();
          else this.stopLoop();
        }
      }, { threshold: 0.05 });
      this.observer.observe(this.canvas);
    }

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

  setMetricMode(mode) {
    if (mode === 'F' || mode === 'f') {
      this.metricMode = mode;
      this.updateTargetHeights();
    }
  }

  /**
   * Updates landscape data from immutable snapshot.
   * Guarantees read-only consumption with no writeback.
   */
  updateSnapshot(frozenRecord, config, schemaMatches = []) {
    if (!frozenRecord || !config || !config.problemFn) return;
    this.config = config;
    this.lastRecord = frozenRecord;
    this.schemaMatches = schemaMatches || [];

    const numGrid = 1 << config.n;
    this.numGrid = numGrid;
    const [dx1, dx2] = calculateDeltaX(config.bounds, config.n);
    const [[xmin1, xmax1], [xmin2, xmax2]] = config.bounds;

    let minF = Infinity;
    let maxF = -Infinity;
    let minFit = Infinity;
    let maxFit = -Infinity;

    this.gridData = [];
    for (let d1 = 0; d1 < numGrid; d1++) {
      this.gridData[d1] = [];
      const x1 = xmin1 + d1 * dx1;
      for (let d2 = 0; d2 < numGrid; d2++) {
        const x2 = xmin2 + d2 * dx2;
        const f = config.problemFn(x1, x2);
        if (f < minF) minF = f;
        if (f > maxF) maxF = f;

        // Fitness F calculation:
        // For min problem: F = 1 / (1 + f - minF) or 1/(1+f)
        const fit = config.problemType === 'min'
          ? (f >= 0 ? 1 / (1 + f) : 1 / (1 + Math.abs(f)))
          : Math.max(0, f);

        if (fit < minFit) minFit = fit;
        if (fit > maxFit) maxFit = fit;

        this.gridData[d1][d2] = { d1, d2, x1, x2, f, fit };
      }
    }

    this.minF = minF;
    this.maxF = maxF;
    this.minFitness = minFit;
    this.maxFitness = maxFit;

    this.extractPopulation(frozenRecord, config);
    this.updateTargetHeights();
    this.updateAriaLabel(frozenRecord);

    if (!this.firstRenderTime) {
      this.firstRenderTime = performance.now();
    }

    this.startLoop();
  }

  extractPopulation(frozenRecord, config) {
    const phase = frozenRecord.phase;
    const n = config.n || 4;
    const bounds = config.bounds;

    let pop = [];
    if (phase === STEP_PHASES.DECODE_EVAL || phase === STEP_PHASES.INIT) {
      pop = frozenRecord.population || [];
    } else if (phase === STEP_PHASES.SELECT) {
      pop = frozenRecord.population || frozenRecord.evaluation?.individuals || [];
    } else if (phase === STEP_PHASES.CROSSOVER) {
      const rawChildren = frozenRecord.childrenBeforeMutation || [];
      pop = rawChildren.map((chrom, idx) => {
        const decoded = decodeChromosome(chrom, bounds, n);
        return { id: idx + 1, chromosome: chrom, ...decoded };
      });
    } else if (phase === STEP_PHASES.MUTATE) {
      const rawMutated = frozenRecord.mutatedChildren || [];
      pop = rawMutated.map((chrom, idx) => {
        const decoded = decodeChromosome(chrom, bounds, n);
        return { id: idx + 1, chromosome: chrom, ...decoded };
      });
    } else if (phase === STEP_PHASES.REPLACE) {
      pop = frozenRecord.nextGenEvaluation?.individuals || [];
    }

    this.currentPopulation = pop;
  }

  updateTargetHeights() {
    const isFitness = this.metricMode === 'F';
    const rangeF = this.maxF - this.minF || 1;
    const rangeFit = this.maxFitness - this.minFitness || 1;
    const maxBarH = 110;

    let idx = 0;
    for (let d1 = 0; d1 < this.numGrid; d1++) {
      for (let d2 = 0; d2 < this.numGrid; d2++) {
        const cell = this.gridData[d1] ? this.gridData[d1][d2] : null;
        if (!cell) continue;

        let normVal = 0;
        if (isFitness) {
          normVal = (cell.fit - this.minFitness) / rangeFit;
        } else {
          // Objective mode: for min problem, lower f is better (taller & brighter)
          normVal = this.config?.problemType === 'min'
            ? (this.maxF - cell.f) / rangeF
            : (cell.f - this.minF) / rangeF;
        }
        normVal = Math.max(0.04, Math.min(1.0, normVal));

        const bar = this.preallocatedBars[idx];
        if (bar) {
          bar.d1 = d1;
          bar.d2 = d2;
          bar.x1 = cell.x1;
          bar.x2 = cell.x2;
          bar.val = isFitness ? cell.fit : cell.f;
          bar.normVal = normVal;
          bar.targetH = normVal * maxBarH;
          if (bar.currentH === 0) bar.currentH = 0.1;
        }
        idx++;
      }
    }
  }

  updateAriaLabel(record) {
    if (!this.canvas) return;
    const gen = record ? record.generationIndex : 1;
    const bestInd = this.currentPopulation[0];
    const metricStr = this.metricMode === 'F' ? 'Fitness F' : 'Objective f';
    const bestVal = bestInd ? (this.metricMode === 'F' ? bestInd.F?.toFixed(4) : bestInd.f?.toFixed(2)) : 'N/A';
    this.canvas.setAttribute('aria-label', `3D fitness landscape for generation ${gen}: plotting ${metricStr}, optimum peak = ${bestVal}`);
  }

  startLoop() {
    if (this.rafId) return;
    let lastTimestamp = performance.now();
    const renderFrame = (timestamp) => {
      const interval = timestamp - lastTimestamp;
      lastTimestamp = timestamp;
      this.render(timestamp, interval);
      this.rafId = requestAnimationFrame(renderFrame);
    };
    this.rafId = requestAnimationFrame(renderFrame);
  }

  stopLoop() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  render(timestamp = performance.now(), frameInterval = null) {
    if (!this.canvas || !this.ctx || !this.isVisible) return;

    // Quality Profiling
    const frameStart = performance.now();

    // Check reduced motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Auto-rotate unless dragging or reduced motion
    if (!this.isDragging && !prefersReducedMotion && this.autoRotate) {
      this.yaw += this.yawSpeed;
    }

    // Rise-in progress (900ms ease-out)
    const elapsed = timestamp - (this.firstRenderTime || timestamp);
    const riseProgress = prefersReducedMotion ? 1.0 : Math.min(1.0, elapsed / this.riseDuration);
    const riseEase = 1 - Math.pow(1 - riseProgress, 3); // cubic ease-out

    // Setup Canvas DPR and Dimensions
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.canvas.getBoundingClientRect();
    const cssW = rect.width > 50 ? rect.width : 440;
    const cssH = rect.height > 50 ? rect.height : 300;

    if (this.canvas.width !== Math.floor(cssW * dpr) || this.canvas.height !== Math.floor(cssH * dpr)) {
      this.canvas.width = Math.floor(cssW * dpr);
      this.canvas.height = Math.floor(cssH * dpr);
    }

    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    // Clear background to solid Graphite
    ctx.fillStyle = '#101417';
    ctx.fillRect(0, 0, cssW, cssH);

    // Grid sizing in 3D world space
    const totalGrid = this.numGrid;
    const barSpacing = Math.min(16, 260 / totalGrid);
    const barW = barSpacing * 0.78;
    const originOffset = (totalGrid * barSpacing) * 0.5;

    // 1. Tween Heights & Calculate Depth
    const barCount = totalGrid * totalGrid;
    const activeBars = [];

    for (let i = 0; i < barCount; i++) {
      const bar = this.preallocatedBars[i];
      if (!bar) continue;

      // Tween 8% per frame
      if (!prefersReducedMotion) {
        bar.currentH += (bar.targetH - bar.currentH) * 0.08;
      } else {
        bar.currentH = bar.targetH;
      }

      // World coordinates (centered at 0, 0)
      const wx = (bar.d1 * barSpacing) - originOffset + barSpacing * 0.5;
      const wz = (bar.d2 * barSpacing) - originOffset + barSpacing * 0.5;
      const wy = (bar.currentH * riseEase) * 0.5;

      bar.depth = calculateBarDepth(wx, wy, wz, this.yaw, this.pitch, this.distance);
      bar.worldX = wx;
      bar.worldY = wy;
      bar.worldZ = wz;
      bar.actualH = bar.currentH * riseEase;

      activeBars.push(bar);
    }

    // 2. Painter's Algorithm: Sort bars far to near (descending depth)
    sortFarToNear(activeBars);

    // 3. Render 3D Bars & Faces
    for (let i = 0; i < activeBars.length; i++) {
      this.drawBar(ctx, activeBars[i], barW, cssW, cssH);
    }

    // 4. Render Individuals Floating on Bar Tops
    this.renderIndividuals(ctx, barSpacing, originOffset, riseEase, cssW, cssH);

    // 5. Render Height Axis & Mode Label
    this.drawLabels(ctx, cssW, cssH);

    // Performance timing & adaptive quality (track real rAF frame interval if provided, else draw duration)
    const measuredTime = frameInterval !== null && frameInterval > 0 ? frameInterval : (performance.now() - frameStart);
    this.recordFrameTime(measuredTime);
  }

  /**
   * Draws a single 3D bar with flat shading in strict 3-color palette.
   */
  drawBar(ctx, bar, barW, screenW, screenH) {
    const halfW = barW * 0.5;
    const h = Math.max(1, bar.actualH);
    const wx = bar.worldX;
    const wz = bar.worldZ;

    // 8 Box Vertices: bottom 0-3, top 4-7
    const rawVerts = [
      // Bottom face (Y = 0)
      [wx - halfW, 0, wz - halfW],
      [wx + halfW, 0, wz - halfW],
      [wx + halfW, 0, wz + halfW],
      [wx - halfW, 0, wz + halfW],
      // Top face (Y = h)
      [wx - halfW, h, wz - halfW],
      [wx + halfW, h, wz - halfW],
      [wx + halfW, h, wz + halfW],
      [wx - halfW, h, wz + halfW]
    ];

    const verts = this.preallocatedVertices;
    for (let v = 0; v < 8; v++) {
      const p = project3DTo2D(
        rawVerts[v][0], rawVerts[v][1], rawVerts[v][2],
        this.yaw, this.pitch, this.distance, this.fov, screenW, screenH
      );
      verts[v].x = p.x;
      verts[v].y = p.y;
      verts[v].depth = p.depth;
    }

    // Base color from sequential monochrome ramp (taller = brighter stone)
    const baseColor = getSequentialMonochromeColor(bar.normVal);

    // Sides with flat directional shading
    // Side 1: Front face (verts 3, 2, 6, 7)
    // Side 2: Right face (verts 2, 1, 5, 6)
    // Side 3: Back face (verts 1, 0, 4, 5)
    // Side 4: Left face (verts 0, 3, 7, 4)
    // Top face: (verts 4, 5, 6, 7) - always drawn last!

    ctx.strokeStyle = 'rgba(216, 212, 200, 0.15)';
    ctx.lineWidth = 0.5;

    // Draw visible side faces
    this.drawQuad(ctx, verts[3], verts[2], verts[6], verts[7], baseColor, 0.65); // Front
    this.drawQuad(ctx, verts[2], verts[1], verts[5], verts[6], baseColor, 0.55); // Right
    this.drawQuad(ctx, verts[0], verts[3], verts[7], verts[4], baseColor, 0.75); // Left
    this.drawQuad(ctx, verts[1], verts[0], verts[4], verts[5], baseColor, 0.50); // Back

    // Draw Top Face last (brightest, unoccluded)
    ctx.fillStyle = baseColor;
    ctx.beginPath();
    ctx.moveTo(verts[4].x, verts[4].y);
    ctx.lineTo(verts[5].x, verts[5].y);
    ctx.lineTo(verts[6].x, verts[6].y);
    ctx.lineTo(verts[7].x, verts[7].y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Store projected top center for hit testing
    bar.projTopX = (verts[4].x + verts[6].x) * 0.5;
    bar.projTopY = (verts[4].y + verts[6].y) * 0.5;
  }

  drawQuad(ctx, v1, v2, v3, v4, baseRgb, shadeFactor) {
    // Cross product test for backface culling
    const cross = (v2.x - v1.x) * (v3.y - v1.y) - (v2.y - v1.y) * (v3.x - v1.x);
    if (cross <= 0) return; // culled

    // Modulate RGB components for flat lighting
    const match = baseRgb.match(/\d+/g);
    if (match) {
      const r = Math.round(match[0] * shadeFactor);
      const g = Math.round(match[1] * shadeFactor);
      const b = Math.round(match[2] * shadeFactor);
      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
    } else {
      ctx.fillStyle = baseRgb;
    }

    ctx.beginPath();
    ctx.moveTo(v1.x, v1.y);
    ctx.lineTo(v2.x, v2.y);
    ctx.lineTo(v3.x, v3.y);
    ctx.lineTo(v4.x, v4.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  renderIndividuals(ctx, barSpacing, originOffset, riseEase, screenW, screenH) {
    const pop = this.currentPopulation || [];
    if (pop.length === 0) return;

    const phase = this.lastRecord?.phase;
    const selectedIndices = this.lastRecord?.selectedIndices || this.lastRecord?.matingPoolIndices0Based || [];

    // Find best individual index
    let bestIdx = 0;
    let bestFit = -Infinity;
    for (let i = 0; i < pop.length; i++) {
      const f = pop[i].f;
      const fit = this.config?.problemType === 'min' ? -f : f;
      if (fit > bestFit) {
        bestFit = fit;
        bestIdx = i;
      }
    }

    // 1. Draw Crossover Lines (Lime) if in CROSSOVER phase
    if (phase === STEP_PHASES.CROSSOVER && this.lastRecord?.crossoverPairs) {
      const pairs = this.lastRecord.crossoverPairs;
      ctx.strokeStyle = '#C6F135';
      ctx.lineWidth = 2.0;

      for (const pair of pairs) {
        const p1 = pop[pair.parent1Index];
        const p2 = pop[pair.parent2Index];
        if (p1 && p2 && p1.D1 !== undefined && p2.D1 !== undefined) {
          const pt1 = this.getScreenCoords(p1.D1, p1.D2, barSpacing, originOffset, riseEase, screenW, screenH);
          const pt2 = this.getScreenCoords(p2.D1, p2.D2, barSpacing, originOffset, riseEase, screenW, screenH);
          ctx.beginPath();
          ctx.moveTo(pt1.x, pt1.y);
          ctx.lineTo(pt2.x, pt2.y);
          ctx.stroke();
        }
      }
    }

    // 2. Draw Individual Rings & Markers
    for (let i = 0; i < pop.length; i++) {
      const ind = pop[i];
      if (ind.D1 === undefined || ind.D2 === undefined) continue;

      const pt = this.getScreenCoords(ind.D1, ind.D2, barSpacing, originOffset, riseEase, screenW, screenH);
      const isBest = i === bestIdx;
      const isSelected = selectedIndices.includes(i);
      const isSchemaMatch = this.schemaMatches.includes(i);

      // Selected parent or schema match: Lime outline
      if (isSelected || isSchemaMatch) {
        ctx.strokeStyle = '#C6F135';
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y - 4, 10, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Best = Lime ring; Other = Stone ring
      ctx.strokeStyle = isBest ? '#C6F135' : '#D8D4C8';
      ctx.lineWidth = isBest ? 2.5 : 1.5;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y - 4, 6, 0, Math.PI * 2);
      ctx.stroke();

      // Core dot
      ctx.fillStyle = isBest ? '#C6F135' : '#D8D4C8';
      ctx.beginPath();
      ctx.arc(pt.x, pt.y - 4, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  getScreenCoords(d1, d2, barSpacing, originOffset, riseEase, screenW, screenH) {
    const wx = (d1 * barSpacing) - originOffset + barSpacing * 0.5;
    const wz = (d2 * barSpacing) - originOffset + barSpacing * 0.5;

    // Look up bar height
    const barIdx = d1 * this.numGrid + d2;
    const bar = this.preallocatedBars[barIdx];
    const h = (bar ? bar.actualH : 10) + 6; // float 6px above bar

    return project3DTo2D(wx, h, wz, this.yaw, this.pitch, this.distance, this.fov, screenW, screenH);
  }

  drawLabels(ctx, screenW, screenH) {
    ctx.save();
    ctx.fillStyle = '#D8D4C8';
    ctx.font = '11px "JetBrains Mono", monospace';

    // Height Axis Label
    const metricLabel = this.metricMode === 'F'
      ? '▲ Height: Fitness F (Peak = Optimum)'
      : '▲ Height: Objective f (Peak = Optimum)';
    ctx.fillText(metricLabel, 12, screenH - 14);

    // Camera indicator
    const yawDeg = Math.round(((this.yaw % (Math.PI * 2)) * 180) / Math.PI);
    ctx.fillStyle = 'rgba(216, 212, 200, 0.62)';
    ctx.fillText(`Yaw: ${yawDeg}°`, screenW - 68, screenH - 14);

    ctx.restore();
  }

  handlePointerHover(e) {
    if (!this.canvas || !this.tooltip) return;
    const rect = this.canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    let closest = null;
    let minDist = 18;

    const barCount = this.numGrid * this.numGrid;
    for (let i = 0; i < barCount; i++) {
      const b = this.preallocatedBars[i];
      if (!b || b.projTopX === undefined) continue;
      const dist = Math.hypot(mx - b.projTopX, my - b.projTopY);
      if (dist < minDist) {
        minDist = dist;
        closest = b;
      }
    }

    if (closest) {
      this.hoverCell = closest;
      const count = (this.currentPopulation || []).filter(ind => ind.D1 === closest.d1 && ind.D2 === closest.d2).length;

      this.tooltip.style.display = 'block';
      this.tooltip.style.left = `${Math.min(mx + 14, rect.width - 160)}px`;
      this.tooltip.style.top = `${Math.max(my - 70, 10)}px`;
      this.tooltip.innerHTML = `
        <div style="font-weight: 600; font-size: 11px; color: var(--stone);">Cell (${closest.d1}, ${closest.d2})</div>
        <div style="font-size: 11px; color: var(--color-text-secondary);">Coords: (${closest.x1.toFixed(3)}, ${closest.x2.toFixed(3)})</div>
        <div style="font-size: 11px; color: var(--stone);">${this.metricMode === 'F' ? 'Fitness F' : 'Objective f'}: <strong>${closest.val.toFixed(4)}</strong></div>
        <div style="font-size: 11px; color: ${count > 0 ? 'var(--lime)' : 'var(--text-muted)'};">
          ${count > 0 ? `★ ${count} individual(s) here` : 'Empty cell'}
        </div>
      `;
    } else {
      this.hoverCell = null;
      this.tooltip.style.display = 'none';
    }
  }

  recordFrameTime(durationMs) {
    this.frameTimes.push(durationMs);
    if (this.frameTimes.length > this.maxFrameSamples) {
      this.frameTimes.shift();
    }

    if (this.frameTimes.length === this.maxFrameSamples) {
      const sum = this.frameTimes.reduce((a, b) => a + b, 0);
      this.avgFrameTime = sum / this.maxFrameSamples;

      // Adaptive Quality Check: > 24ms (under ~40 fps)
      if (this.avgFrameTime > 24.0) {
        if (!this.qualityReduced) {
          // Stage 1: Stop auto-rotate & reduce grid resolution
          this.qualityReduced = true;
          this.autoRotate = false;
          this.downsampleFactor = 2;
          this.frameTimes = [];
        } else if (!this.adaptiveFallbackTriggered) {
          // Stage 2: Fall back to 2D heatmap with "Reduced 3D" notice
          this.adaptiveFallbackTriggered = true;
          this.stopLoop();
          this.onFallback('Reduced 3D');
        }
      }
    }
  }
}
