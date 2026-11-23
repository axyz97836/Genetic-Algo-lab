/**
 * js/viz/heatmap.js - Retina-aware 2D Discrete Fitness Landscape Heatmap.
 * Conforms to SPEC.md §4.3a, §6 P3, and UI Redesign (Strict 3-Color Palette):
 * - Sequential ramp: Graphite (#101417) -> Stone (#D8D4C8)
 * - Lower objective f (minimisation) is brighter (closer to Stone)
 * - Faint iso-contour lines in stone
 * - Optimum star and best individual in lime (#C6F135)
 * - Individuals: stone rings; Best = lime ring; Selected parents = lime outline
 * - Zero fourth hues
 * - All axis and chart text at least 11px
 */

import { getSequentialMonochromeColor } from './colormap.js';
import { calculateDeltaX, decodeChromosome } from '../engine/decode.js';
import { STEP_PHASES } from '../engine/engine.js';

export class HeatmapVisualizer {
  constructor(canvasId = 'heatmap-canvas', tooltipId = 'heatmap-tooltip', legendCanvasId = 'heatmap-legend-bar') {
    this.canvas = document.getElementById(canvasId);
    this.tooltip = document.getElementById(tooltipId);
    this.legendCanvas = document.getElementById(legendCanvasId);

    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    this.legendCtx = this.legendCanvas ? this.legendCanvas.getContext('2d') : null;

    this.width = 440;
    this.height = 340;
    this.margin = { top: 18, right: 18, bottom: 38, left: 46 };

    this.gridData = [];
    this.minF = 0;
    this.maxF = 1;
    this.optimumPoint = null;
    this.currentPopulation = [];
    this.hoverCell = null;
    this.config = null;
    this.lastStepRecord = null;
    this.lastSchemaMatches = null;

    this.bindEvents();
  }

  bindEvents() {
    if (!this.canvas) return;
    this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    this.canvas.addEventListener('mouseleave', () => this.handleMouseLeave());
  }

  setupCanvasSize() {
    if (!this.canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.canvas.getBoundingClientRect();
    const cssWidth = rect.width > 50 ? rect.width : this.width;
    const cssHeight = rect.height > 50 ? rect.height : this.height;

    this.cssWidth = cssWidth;
    this.cssHeight = cssHeight;

    this.canvas.width = Math.floor(cssWidth * dpr);
    this.canvas.height = Math.floor(cssHeight * dpr);
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(dpr, dpr);
  }

  evaluateGrid(problemFn, problemType, bounds, n) {
    const numGrid = 1 << n; // 2^n
    const [dx1, dx2] = calculateDeltaX(bounds, n);
    const [[xmin1, xmax1], [xmin2, xmax2]] = bounds;

    this.gridData = [];
    let minF = Infinity;
    let maxF = -Infinity;
    let optPoint = null;

    for (let d1 = 0; d1 < numGrid; d1++) {
      const x1 = xmin1 + d1 * dx1;
      this.gridData[d1] = [];

      for (let d2 = 0; d2 < numGrid; d2++) {
        const x2 = xmin2 + d2 * dx2;
        const f = problemFn(x1, x2);

        this.gridData[d1][d2] = { d1, d2, x1, x2, f };

        if (f < minF) minF = f;
        if (f > maxF) maxF = f;

        const isBetter = problemType === 'min'
          ? (!optPoint || f < optPoint.f)
          : (!optPoint || f > optPoint.f);

        if (isBetter) {
          optPoint = { d1, d2, x1, x2, f };
        }
      }
    }

    this.minF = minF;
    this.maxF = maxF;
    this.optimumPoint = optPoint;
    this.numGrid = numGrid;
    this.dx1 = dx1;
    this.dx2 = dx2;
  }

  render(stepRecord, config, schemaMatches = null) {
    if (!this.canvas || !this.ctx || !config || !config.problemFn) return;
    this.config = config;
    if (stepRecord) this.lastStepRecord = stepRecord;
    if (schemaMatches !== null) this.lastSchemaMatches = schemaMatches;

    const recordToRender = this.lastStepRecord;
    const currentSchemaMatches = this.lastSchemaMatches || [];

    this.setupCanvasSize();
    this.evaluateGrid(config.problemFn, config.problemType, config.bounds, config.n);
    this.updateLegend(config.problemType);

    const plotW = this.cssWidth - this.margin.left - this.margin.right;
    const plotH = this.cssHeight - this.margin.top - this.margin.bottom;
    const numGrid = this.numGrid;
    const cellW = plotW / numGrid;
    const cellH = plotH / numGrid;

    this.plotW = plotW;
    this.plotH = plotH;
    this.cellW = cellW;
    this.cellH = cellH;

    // Clear background to pure graphite
    this.ctx.fillStyle = '#101417';
    this.ctx.fillRect(0, 0, this.cssWidth, this.cssHeight);

    // 1. Draw Discrete Sequential Monochrome Cells (Graphite -> Stone)
    const rangeF = this.maxF - this.minF;
    for (let d1 = 0; d1 < numGrid; d1++) {
      for (let d2 = 0; d2 < numGrid; d2++) {
        const cell = this.gridData[d1][d2];
        const normF = rangeF > 0 ? (cell.f - this.minF) / rangeF : 0.5;

        // Invert colormap for min problem so lower f (better) is brighter (closer to Stone)
        const brightness = config.problemType === 'min' ? (1 - normF) : normF;
        this.ctx.fillStyle = getSequentialMonochromeColor(brightness);

        const px = this.margin.left + d1 * cellW;
        // Invert Y so d2=0 is at bottom
        const py = this.margin.top + plotH - (d2 + 1) * cellH;

        this.ctx.fillRect(px, py, cellW, cellH);

        // Subtle cell grid border
        this.ctx.strokeStyle = 'rgba(216, 212, 200, 0.08)';
        this.ctx.lineWidth = 0.5;
        this.ctx.strokeRect(px, py, cellW, cellH);
      }
    }

    // 2. Draw Faint Iso-Contour Lines in Stone
    this.drawIsoContours(numGrid, cellW, cellH, rangeF);

    // 3. Draw Axes and Labels (All >= 11px)
    this.drawAxes(config);

    // 4. Draw True Discrete Grid Optimum Star (Lime)
    if (this.optimumPoint) {
      this.drawOptimumStar(this.optimumPoint);
    }

    // 5. Draw Population Individuals (Stone rings, Best = Lime, Selected = Lime outline)
    this.extractAndDrawIndividuals(recordToRender, config, currentSchemaMatches);

    // 6. Draw Crosshairs & Tooltip if hovering
    if (this.hoverCell) {
      this.drawCrosshairs(this.hoverCell);
    }
  }

  drawIsoContours(numGrid, cellW, cellH, rangeF) {
    if (rangeF <= 0 || !this.gridData || numGrid < 2) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = 'rgba(216, 212, 200, 0.22)';
    ctx.lineWidth = 0.75;

    // Draw 4 distinct elevation contour levels: 0.2, 0.4, 0.6, 0.8
    const levels = [0.2, 0.4, 0.6, 0.8];
    for (const level of levels) {
      const targetF = this.minF + level * rangeF;

      for (let d1 = 0; d1 < numGrid - 1; d1++) {
        for (let d2 = 0; d2 < numGrid - 1; d2++) {
          const f00 = this.gridData[d1][d2].f;
          const f10 = this.gridData[d1 + 1][d2].f;
          const f01 = this.gridData[d1][d2 + 1].f;

          // Horizontal crossing
          if ((f00 <= targetF && f10 > targetF) || (f00 >= targetF && f10 < targetF)) {
            const frac = (targetF - f00) / (f10 - f00 || 1);
            const x = this.margin.left + (d1 + frac + 0.5) * cellW;
            const y = this.margin.top + this.plotH - (d2 + 0.5) * cellH;
            ctx.beginPath();
            ctx.arc(x, y, 1, 0, Math.PI * 2);
            ctx.stroke();
          }

          // Vertical crossing
          if ((f00 <= targetF && f01 > targetF) || (f00 >= targetF && f01 < targetF)) {
            const frac = (targetF - f00) / (f01 - f00 || 1);
            const x = this.margin.left + (d1 + 0.5) * cellW;
            const y = this.margin.top + this.plotH - (d2 + frac + 0.5) * cellH;
            ctx.beginPath();
            ctx.arc(x, y, 1, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
      }
    }
    ctx.restore();
  }

  drawAxes(config) {
    const ctx = this.ctx;
    ctx.strokeStyle = 'rgba(216, 212, 200, 0.25)';
    ctx.lineWidth = 1;

    const x0 = this.margin.left;
    const y0 = this.margin.top + this.plotH;
    const x1 = this.margin.left + this.plotW;
    const y1 = this.margin.top;

    ctx.beginPath();
    ctx.moveTo(x0, y1);
    ctx.lineTo(x0, y0);
    ctx.lineTo(x1, y0);
    ctx.stroke();

    ctx.fillStyle = 'rgba(216, 212, 200, 0.75)';
    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';

    // X-axis ticks (x1)
    const [[xmin1, xmax1], [xmin2, xmax2]] = config.bounds;
    ctx.fillText(`${xmin1}`, x0, y0 + 16);
    ctx.fillText(`${xmax1}`, x1, y0 + 16);

    ctx.fillStyle = '#D8D4C8';
    ctx.font = 'bold 11px "JetBrains Mono", monospace';
    ctx.fillText('x1 →', (x0 + x1) / 2, y0 + 26);

    // Y-axis ticks (x2)
    ctx.fillStyle = 'rgba(216, 212, 200, 0.75)';
    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`${xmin2}`, x0 - 8, y0 + 3);
    ctx.fillText(`${xmax2}`, x0 - 8, y1 + 10);

    ctx.fillStyle = '#D8D4C8';
    ctx.font = 'bold 11px "JetBrains Mono", monospace';
    ctx.save();
    ctx.translate(x0 - 28, (y0 + y1) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText('x2 →', 0, 0);
    ctx.restore();
  }

  drawOptimumStar(point) {
    const ctx = this.ctx;
    const px = this.margin.left + (point.d1 + 0.5) * this.cellW;
    const py = this.margin.top + this.plotH - (point.d2 + 0.5) * this.cellH;

    ctx.save();
    ctx.translate(px, py);

    // 5-point Star in Lime with crisp Graphite outline
    ctx.fillStyle = '#C6F135';
    ctx.strokeStyle = '#101417';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    const spikes = 5;
    const outerRadius = 8;
    const innerRadius = 4;
    let rot = (Math.PI / 2) * 3;
    let step = Math.PI / spikes;

    ctx.moveTo(0, -outerRadius);
    for (let i = 0; i < spikes; i++) {
      let x = Math.cos(rot) * outerRadius;
      let y = Math.sin(rot) * outerRadius;
      ctx.lineTo(x, y);
      rot += step;

      x = Math.cos(rot) * innerRadius;
      y = Math.sin(rot) * innerRadius;
      ctx.lineTo(x, y);
      rot += step;
    }
    ctx.lineTo(0, -outerRadius);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  extractAndDrawIndividuals(stepRecord, config, schemaMatches = []) {
    if (!stepRecord) return;
    const phase = stepRecord.phase;
    const n = config.n || 4;
    const bounds = config.bounds;

    let pop = [];
    if (phase === STEP_PHASES.DECODE_EVAL || phase === STEP_PHASES.INIT) {
      pop = stepRecord.population || [];
    } else if (phase === STEP_PHASES.SELECT) {
      pop = stepRecord.population || stepRecord.evaluation?.individuals || [];
    } else if (phase === STEP_PHASES.CROSSOVER) {
      const rawChildren = stepRecord.childrenBeforeMutation || [];
      pop = rawChildren.map((chrom, idx) => {
        const decoded = decodeChromosome(chrom, bounds, n);
        return { id: idx + 1, chromosome: chrom, ...decoded };
      });
    } else if (phase === STEP_PHASES.MUTATE) {
      const rawMutated = stepRecord.mutatedChildren || [];
      pop = rawMutated.map((chrom, idx) => {
        const decoded = decodeChromosome(chrom, bounds, n);
        return { id: idx + 1, chromosome: chrom, ...decoded };
      });
    } else if (phase === STEP_PHASES.REPLACE) {
      pop = stepRecord.nextGenEvaluation?.individuals || [];
    }

    this.currentPopulation = pop;

    // Detect best individual index
    let bestIdx = -1;
    if (pop.length > 0 && pop[0].f !== undefined) {
      let bestF = config.problemType === 'min' ? Infinity : -Infinity;
      for (let i = 0; i < pop.length; i++) {
        const f = pop[i].f;
        if (config.problemType === 'min' ? f < bestF : f > bestF) {
          bestF = f;
          bestIdx = i;
        }
      }
    }

    // Draw mutation vectors if in MUTATE phase (in Stone)
    if (phase === STEP_PHASES.MUTATE && stepRecord.flips && stepRecord.mutatedChildren) {
      this.drawMutationVectors(stepRecord, config);
    }

    // Group by coordinates
    const coordMap = new Map();
    for (let i = 0; i < pop.length; i++) {
      const ind = pop[i];
      if (ind.D1 === undefined || ind.D2 === undefined) continue;
      const key = `${ind.D1},${ind.D2}`;
      if (!coordMap.has(key)) coordMap.set(key, []);
      coordMap.get(key).push({ ind, idx: i, isBest: i === bestIdx });
    }

    // Draw individual rings
    for (const [key, group] of coordMap.entries()) {
      const first = group[0].ind;
      const px = this.margin.left + (first.D1 + 0.5) * this.cellW;
      const py = this.margin.top + this.plotH - (first.D2 + 0.5) * this.cellH;

      const isSelectedParent = group.some(item =>
        phase === STEP_PHASES.SELECT && (
          stepRecord.matingPoolIndices0Based?.includes(item.idx) ||
          stepRecord.selectedIndices?.includes(item.idx)
        )
      );

      const hasBest = group.some(item => item.isBest);
      const isSchemaMatch = group.some(item => schemaMatches && schemaMatches.includes(item.idx));

      this.drawIndividualDot(px, py, first.id, isSelectedParent, phase === STEP_PHASES.CROSSOVER, group.length, hasBest, isSchemaMatch);
    }
  }

  drawIndividualDot(px, py, id, isParent = false, isChild = false, count = 1, isBest = false, isSchemaMatch = false) {
    const ctx = this.ctx;

    // Selected parent or schema match: Lime outline
    if (isParent || isSchemaMatch) {
      ctx.strokeStyle = '#C6F135';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(px, py, 9, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Best individual: Lime ring; Regular individual: Stone ring
    const ringColor = isBest ? '#C6F135' : '#D8D4C8';
    const coreFill = isBest ? '#C6F135' : 'rgba(216, 212, 200, 0.4)';

    ctx.strokeStyle = ringColor;
    ctx.lineWidth = isBest ? 2.5 : 1.5;
    ctx.beginPath();
    ctx.arc(px, py, 6, 0, Math.PI * 2);
    ctx.stroke();

    // Center core dot
    ctx.fillStyle = coreFill;
    ctx.beginPath();
    ctx.arc(px, py, 3, 0, Math.PI * 2);
    ctx.fill();

    // Ghost child ring (dashed stone)
    if (isChild) {
      ctx.strokeStyle = '#D8D4C8';
      ctx.setLineDash([2, 2]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(px, py, 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Multi-individual count badge with solid graphite pill background for >10:1 contrast over any ramp cell
    if (count > 1) {
      const text = `×${count}`;
      ctx.font = 'bold 11px "JetBrains Mono", monospace';
      const textWidth = ctx.measureText(text).width;
      const bx = px + 10;
      const by = py - 6;

      ctx.save();
      ctx.fillStyle = '#101417';
      ctx.strokeStyle = '#D8D4C8';
      ctx.lineWidth = 1;
      const padX = 4;
      const padY = 2;
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(bx - textWidth / 2 - padX, by - 10, textWidth + padX * 2, 14, 3);
      } else {
        ctx.rect(bx - textWidth / 2 - padX, by - 10, textWidth + padX * 2, 14);
      }
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#D8D4C8';
      ctx.textAlign = 'center';
      ctx.fillText(text, bx, by);
      ctx.restore();
    }
  }

  drawMutationVectors(stepRecord, config) {
    const ctx = this.ctx;
    const flips = stepRecord.flips || [];
    const prePop = stepRecord.childrenBeforeMutation || [];
    const postPop = stepRecord.mutatedChildren || [];
    const n = config.n || 4;

    for (let cIdx = 0; cIdx < postPop.length; cIdx++) {
      const childFlips = flips.filter(f => f.childIndex === cIdx);
      if (childFlips.length === 0) continue;

      const oldChrom = prePop[cIdx];
      const newChrom = postPop[cIdx];
      if (!oldChrom || !newChrom) continue;

      const oldD1 = parseInt(oldChrom.slice(0, n), 2);
      const oldD2 = parseInt(oldChrom.slice(n), 2);
      const newD1 = parseInt(newChrom.slice(0, n), 2);
      const newD2 = parseInt(newChrom.slice(n), 2);

      const xOld = this.margin.left + (oldD1 + 0.5) * this.cellW;
      const yOld = this.margin.top + this.plotH - (oldD2 + 0.5) * this.cellH;
      const xNew = this.margin.left + (newD1 + 0.5) * this.cellW;
      const yNew = this.margin.top + this.plotH - (newD2 + 0.5) * this.cellH;

      // Draw jump line in Stone
      ctx.strokeStyle = '#D8D4C8';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(xOld, yOld);
      ctx.lineTo(xNew, yNew);
      ctx.stroke();

      // Lime arrow head at mutated coordinate
      const angle = Math.atan2(yNew - yOld, xNew - xOld);
      ctx.fillStyle = '#C6F135';
      ctx.beginPath();
      ctx.moveTo(xNew, yNew);
      ctx.lineTo(xNew - 7 * Math.cos(angle - Math.PI / 6), yNew - 7 * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(xNew - 7 * Math.cos(angle + Math.PI / 6), yNew - 7 * Math.sin(angle + Math.PI / 6));
      ctx.closePath();
      ctx.fill();
    }
  }

  drawCrosshairs(cell) {
    const ctx = this.ctx;
    const px = this.margin.left + (cell.d1 + 0.5) * this.cellW;
    const py = this.margin.top + this.plotH - (cell.d2 + 0.5) * this.cellH;

    ctx.save();
    ctx.strokeStyle = 'rgba(216, 212, 200, 0.4)';
    ctx.setLineDash([2, 2]);
    ctx.lineWidth = 1;

    ctx.beginPath();
    ctx.moveTo(this.margin.left, py);
    ctx.lineTo(this.margin.left + this.plotW, py);
    ctx.moveTo(px, this.margin.top);
    ctx.lineTo(px, this.margin.top + this.plotH);
    ctx.stroke();

    // Highlight hovered cell with lime border
    const cellPx = this.margin.left + cell.d1 * this.cellW;
    const cellPy = this.margin.top + this.plotH - (cell.d2 + 1) * this.cellH;
    ctx.strokeStyle = '#C6F135';
    ctx.setLineDash([]);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(cellPx, cellPy, this.cellW, this.cellH);

    ctx.restore();
  }

  handleMouseMove(e) {
    if (!this.gridData || this.gridData.length === 0) return;

    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const plotX = mouseX - this.margin.left;
    const plotY = mouseY - this.margin.top;

    if (plotX < 0 || plotX > this.plotW || plotY < 0 || plotY > this.plotH) {
      this.handleMouseLeave();
      return;
    }

    const d1 = Math.floor(plotX / this.cellW);
    const d2 = this.numGrid - 1 - Math.floor(plotY / this.cellH);

    if (d1 >= 0 && d1 < this.numGrid && d2 >= 0 && d2 < this.numGrid) {
      const cell = this.gridData[d1][d2];
      this.hoverCell = cell;

      const count = this.currentPopulation.filter(ind => ind.D1 === d1 && ind.D2 === d2).length;

      if (this.tooltip) {
        this.tooltip.style.display = 'block';
        this.tooltip.style.left = `${Math.min(mouseX + 12, this.cssWidth - 170)}px`;
        this.tooltip.style.top = `${Math.max(mouseY - 70, 10)}px`;
        this.tooltip.innerHTML = `
          <div style="font-weight: 600; font-size: 11px; color: var(--stone);">Grid D = (${cell.d1}, ${cell.d2})</div>
          <div style="font-size: 11px; color: var(--color-text-secondary);">Coords: (${cell.x1.toFixed(3)}, ${cell.x2.toFixed(3)})</div>
          <div style="font-size: 11px; color: var(--stone);">f(x1,x2): <strong>${cell.f.toFixed(4)}</strong></div>
          <div style="font-size: 11px; color: ${count > 0 ? 'var(--lime)' : 'var(--text-muted)'};">
            ${count > 0 ? `★ ${count} individual(s) here` : 'Empty point'}
          </div>
        `;
      }

      if (this.config) {
        this.render(this.lastStepRecord, this.config);
      }
    }
  }

  handleMouseLeave() {
    this.hoverCell = null;
    if (this.tooltip) {
      this.tooltip.style.display = 'none';
    }
    if (this.config) {
      this.render(this.lastStepRecord, this.config);
    }
  }

  updateLegend(problemType) {
    const minSpan = document.getElementById('heatmap-legend-min');
    const midSpan = document.getElementById('heatmap-legend-mid');
    const maxSpan = document.getElementById('heatmap-legend-max');
    const deltaSpan = document.getElementById('heatmap-legend-delta');

    if (minSpan) {
      minSpan.textContent = `min ${this.minF.toFixed(1)}`;
      minSpan.style.fontSize = '11px';
    }
    if (midSpan) {
      midSpan.textContent = ((this.minF + this.maxF) / 2).toFixed(1);
      midSpan.style.fontSize = '11px';
    }
    if (maxSpan) {
      maxSpan.textContent = `max ${this.maxF.toFixed(1)}`;
      maxSpan.style.fontSize = '11px';
    }
    if (deltaSpan) {
      deltaSpan.textContent = `Δx = (${this.dx1?.toFixed(3)}, ${this.dx2?.toFixed(3)})`;
      deltaSpan.style.fontSize = '11px';
    }

    if (this.legendCanvas && this.legendCtx) {
      const w = this.legendCanvas.width;
      const h = this.legendCanvas.height;
      for (let x = 0; x < w; x++) {
        const u = x / Math.max(1, w - 1);
        // Sequential ramp matching the heatmap
        const brightness = problemType === 'min' ? (1 - u) : u;
        this.legendCtx.fillStyle = getSequentialMonochromeColor(brightness);
        this.legendCtx.fillRect(x, 0, 1, h);
      }
    }
  }
}
