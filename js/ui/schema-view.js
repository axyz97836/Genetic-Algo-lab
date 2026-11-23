/**
 * js/ui/schema-view.js - Interactive Schema X-Ray Panel Controller.
 * Conforms to SPEC.md §2, §4.5, §5, §9.
 */

import {
  analyzeSchema,
  matchesSchema,
  isCutInsideSpan,
  evaluateSchemaInPopulation,
  calculateSchemaBounds,
  autoTrackSchema
} from '../engine/schema.js';

import { STEP_PHASES } from '../engine/engine.js';
import { SchemaBoundsChart } from '../viz/schema-chart.js';

export class SchemaView {
  constructor(panelId = 'schema-xray-panel', onSchemaChanged = null) {
    this.panel = document.getElementById(panelId);
    this.onSchemaChanged = onSchemaChanged;
    this.currentPattern = '00******';
    this.currentRecord = null;
    this.currentConfig = null;
    this.allSteps = [];
    this.isCollapsed = false;

    this.initDOM();
    this.chart = new SchemaBoundsChart('schema-bounds-svg');
  }

  initDOM() {
    if (!this.panel) return;

    this.panel.innerHTML = `
      <div class="stage-panel-header" style="cursor: pointer;" id="schema-header">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span class="stage-panel-title" style="color: var(--stone); display: flex; align-items: center; gap: 6px;">
            <span>🔬</span> Schema X-Ray
          </span>
          <span class="brand-tag" id="schema-order-badge" style="background: rgba(216, 212, 200, 0.12); color: var(--stone); border-color: rgba(216, 212, 200, 0.3);">
            o(H)=2
          </span>
          <span class="brand-tag" id="schema-len-badge" style="background: rgba(216, 212, 200, 0.12); color: var(--stone); border-color: rgba(216, 212, 200, 0.3);">
            d(H)=1
          </span>
        </div>
        <button id="schema-collapse-btn" class="btn btn-secondary btn-icon" style="padding: 2px 6px; font-size: 11px;" title="Toggle Collapse" aria-label="Toggle Schema X-Ray Panel">
          ▼
        </button>
      </div>

      <div id="schema-content" class="schema-content">
        <!-- Preset & Auto-Track Controls -->
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px; flex-wrap: wrap;">
          <label for="schema-preset-select" style="font-size: 10px; color: var(--color-text-muted); font-family: var(--font-mono);">
            Presets:
          </label>
          <select id="schema-preset-select" class="input-select" style="flex: 1; min-width: 110px; font-size: 11px; padding: 3px 6px;">
            <!-- Populated dynamically based on L -->
          </select>
          <button id="schema-autotrack-btn" class="btn btn-secondary" style="font-size: 11px; padding: 4px 8px; border-color: var(--lime); color: var(--lime);" title="Enumerate schemas of order 2-4 and track best fitness ratio">
            ⚡ Auto-track
          </button>
          <button id="schema-clear-btn" class="btn btn-secondary" style="font-size: 11px; padding: 4px 6px;" title="Reset all to wildcard (*)">
            ✕
          </button>
        </div>

        <div id="schema-toast" style="display: none; font-size: 11px; font-family: var(--font-mono); padding: 4px 8px; border-radius: var(--radius-xs); margin-bottom: 8px;"></div>

        <!-- Interactive Template Bit Editor -->
        <div style="margin-bottom: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <span style="font-size: 10px; font-family: var(--font-mono); color: var(--color-text-muted);">
              Template Editor (click bit to cycle 0 → 1 → *):
            </span>
            <span id="schema-pattern-display" style="font-family: var(--font-mono); font-size: 11px; font-weight: bold; color: var(--lime); letter-spacing: 2px;">
              00******
            </span>
          </div>
          <div id="schema-bit-buttons" class="schema-bit-grid" role="group" aria-label="Schema Template Bits">
            <!-- Buttons injected here -->
          </div>
        </div>

        <!-- Live Schema Metrics Grid -->
        <div class="schema-metrics-grid" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-bottom: 12px;">
          <div class="schema-metric-box">
            <span class="schema-metric-label">Order o(H)</span>
            <span class="schema-metric-val" id="metric-order">2</span>
          </div>
          <div class="schema-metric-box">
            <span class="schema-metric-label">Length d(H)</span>
            <span class="schema-metric-val" id="metric-length">1</span>
          </div>
          <div class="schema-metric-box">
            <span class="schema-metric-label">Matching m(H,t)</span>
            <span class="schema-metric-val" id="metric-matching" style="color: var(--color-chrom-x1);">2 / 4</span>
          </div>
          <div class="schema-metric-box">
            <span class="schema-metric-label">Mean f(H,t)</span>
            <span class="schema-metric-val" id="metric-fh">0.02744</span>
          </div>
          <div class="schema-metric-box">
            <span class="schema-metric-label">Pop Mean f̄(t)</span>
            <span class="schema-metric-val" id="metric-fbar">0.01972</span>
          </div>
          <div class="schema-metric-box">
            <span class="schema-metric-label">Ratio f(H)/f̄</span>
            <span class="schema-metric-val" id="metric-ratio" style="color: var(--color-success);">1.39x</span>
          </div>
        </div>

        <!-- Operator Risk & Disruption Status -->
        <div id="schema-operator-status" style="margin-bottom: 12px; padding: 8px; background: var(--color-surface-raised); border-radius: var(--radius-sm); border: 1px solid var(--color-border-subtle); display: none;">
          <div style="font-size: 10px; font-weight: bold; color: var(--color-text-secondary); margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px;">
            Operator Risk & Disruption
          </div>
          <div id="schema-operator-body" style="font-size: 11px; line-height: 1.5; font-family: var(--font-mono);"></div>
        </div>

        <!-- Holland's Schema Bound Comparison Chart -->
        <div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <span style="font-size: 10px; font-weight: bold; color: var(--color-text-secondary); text-transform: uppercase; letter-spacing: 0.5px;">
              Holland's Theorem Bound E[m(t+1)]
            </span>
            <div style="display: flex; align-items: center; gap: 8px; font-size: 9px; font-family: var(--font-mono);">
              <span style="color: var(--lime); font-weight: 600;">● Observed</span>
              <span style="color: var(--stone);">― Textbook</span>
              <span style="color: rgba(216, 212, 200, 0.62);">┄ Exact</span>
            </div>
          </div>
          <div style="width: 100%; border-radius: var(--radius-sm); background: var(--color-surface-raised); padding: 4px; border: 1px solid var(--color-border-subtle);">
            <svg id="schema-bounds-svg" viewBox="0 0 460 200" style="width: 100%; height: 160px;"></svg>
          </div>
          <div id="schema-chart-note" style="display: none; margin-top: 6px; font-size: 10px; font-family: var(--font-mono); color: var(--color-text-muted); line-height: 1.4;"></div>
        </div>
      </div>
    `;

    // Bind collapse toggle
    const collapseBtn = document.getElementById('schema-collapse-btn');
    const header = document.getElementById('schema-header');
    const content = document.getElementById('schema-content');

    const toggleCollapse = () => {
      this.isCollapsed = !this.isCollapsed;
      if (content) content.style.display = this.isCollapsed ? 'none' : 'block';
      if (collapseBtn) collapseBtn.textContent = this.isCollapsed ? '▶' : '▼';
    };

    header.addEventListener('click', (e) => {
      if (e.target.id !== 'schema-collapse-btn' && e.target.closest('button')) return;
      toggleCollapse();
    });

    // Auto-track button
    document.getElementById('schema-autotrack-btn').addEventListener('click', () => {
      this.handleAutoTrack();
    });

    // Clear button
    document.getElementById('schema-clear-btn').addEventListener('click', () => {
      const L = (this.currentConfig?.n || 4) * 2;
      this.setPattern('*'.repeat(L));
    });

    // Preset select dropdown
    const presetSelect = document.getElementById('schema-preset-select');
    presetSelect.addEventListener('change', (e) => {
      if (e.target.value) {
        this.setPattern(e.target.value);
      }
    });
  }

  updatePresetsDropdown(L) {
    const select = document.getElementById('schema-preset-select');
    if (!select) return;

    const presets = L === 8
      ? [
          { label: '00****** (Ref §9)', pattern: '00******' },
          { label: '***1**** (Single LSB)', pattern: '***1****' },
          { label: '01****** (Prefix)', pattern: '01******' },
          { label: '******10 (Suffix)', pattern: '******10' },
          { label: '11****** (High x1)', pattern: '11******' },
          { label: '****00** (Low x2)', pattern: '****00**' },
          { label: '*0*1*0*1 (Distributed)', pattern: '*0*1*0*1' }
        ]
      : [
          { label: '0000****** (10-bit Ref)', pattern: '0000******' },
          { label: '*****1**** (Center)', pattern: '*****1****' },
          { label: '01******** (Prefix)', pattern: '01********' },
          { label: '********10 (Suffix)', pattern: '********10' },
          { label: '1111****** (High x1)', pattern: '1111******' },
          { label: '*****000** (Low x2)', pattern: '*****000**' }
        ];

    select.innerHTML = '<option value="">-- Choose Schema Preset --</option>' +
      presets.map(p => `<option value="${p.pattern}">${p.label}</option>`).join('');
  }

  renderBitButtons(L, n) {
    const grid = document.getElementById('schema-bit-buttons');
    if (!grid) return;
    grid.innerHTML = '';

    for (let i = 0; i < L; i++) {
      const btn = document.createElement('button');
      btn.className = 'schema-bit-btn';
      btn.dataset.idx = i;
      btn.setAttribute('aria-label', `Bit position ${i + 1}`);

      const isX1 = i < n;
      btn.classList.add(isX1 ? 'seg-x1' : 'seg-x2');

      const val = this.currentPattern[i] || '*';
      btn.innerHTML = `
        <span class="bit-btn-pos">${i + 1}</span>
        <span class="bit-btn-val">${val}</span>
      `;

      btn.addEventListener('click', () => {
        let cur = this.currentPattern[i];
        let next = '*';
        if (cur === '0') next = '1';
        else if (cur === '1') next = '*';
        else if (cur === '*') next = '0';

        const arr = this.currentPattern.split('');
        arr[i] = next;
        this.setPattern(arr.join(''));
      });

      grid.appendChild(btn);
    }
  }

  setPattern(newPattern) {
    this.currentPattern = newPattern;
    const display = document.getElementById('schema-pattern-display');
    if (display) display.textContent = this.currentPattern;

    const info = analyzeSchema(this.currentPattern);
    const orderBadge = document.getElementById('schema-order-badge');
    const lenBadge = document.getElementById('schema-len-badge');
    if (orderBadge) orderBadge.textContent = `o(H)=${info.order}`;
    if (lenBadge) lenBadge.textContent = `d(H)=${info.definingLength}`;

    // Update bit button values
    const grid = document.getElementById('schema-bit-buttons');
    if (grid) {
      const btns = grid.querySelectorAll('.schema-bit-btn');
      btns.forEach((btn, idx) => {
        const valEl = btn.querySelector('.bit-btn-val');
        if (valEl) valEl.textContent = this.currentPattern[idx] || '*';
      });
    }

    if (this.currentRecord && this.currentConfig) {
      this.update(this.currentRecord, this.currentConfig, this.allSteps);
    }
  }

  handleAutoTrack() {
    if (!this.currentRecord || !this.currentConfig) return;
    const pop = this.extractCurrentPopulation(this.currentRecord);
    const chroms = pop.map(ind => ind.chromosome || ind);
    const fitnessArray = pop.map(ind => ind.F !== undefined ? ind.F : (ind.f || 1));
    const L = (this.currentConfig.n || 4) * 2;

    const result = autoTrackSchema(chroms, fitnessArray, L);
    const toast = document.getElementById('schema-toast');

    if (!result) {
      if (toast) {
        toast.style.display = 'block';
        toast.style.background = 'rgba(216, 212, 200, 0.15)';
        toast.style.color = 'var(--stone)';
        toast.style.border = '1px solid rgba(216, 212, 200, 0.3)';
        toast.textContent = 'No qualifying schema found (requires order 2-4, m ≥ 2, f(H) > f̄).';
        setTimeout(() => { if (toast) toast.style.display = 'none'; }, 3500);
      }
      return;
    }

    if (toast) {
      toast.style.display = 'block';
      toast.style.background = 'rgba(198, 241, 53, 0.15)';
      toast.style.color = 'var(--lime)';
      toast.style.border = '1px solid rgba(198, 241, 53, 0.4)';
      toast.textContent = `⚡ Auto-tracked: ${result.pattern} (m=${result.m}, ratio=${result.ratio.toFixed(2)}x, d=${result.d})`;
      setTimeout(() => { if (toast) toast.style.display = 'none'; }, 3500);
    }

    this.setPattern(result.pattern);
  }

  extractCurrentPopulation(record) {
    if (!record) return [];
    const phase = record.phase;
    if (phase === STEP_PHASES.DECODE_EVAL || phase === STEP_PHASES.INIT) {
      return record.population || [];
    } else if (phase === STEP_PHASES.SELECT) {
      return record.population || record.evaluation?.individuals || [];
    } else if (phase === STEP_PHASES.CROSSOVER) {
      return record.matingPool || [];
    } else if (phase === STEP_PHASES.MUTATE) {
      return record.preMutationChildren || record.childrenBeforeMutation || [];
    } else if (phase === STEP_PHASES.REPLACE) {
      return record.nextGenEvaluation?.individuals || record.population || [];
    }
    return record.population || [];
  }

  update(stepRecord, config, allSteps = []) {
    this.currentRecord = stepRecord;
    this.currentConfig = config;
    this.allSteps = allSteps;

    if (!stepRecord || !config) return;

    const n = config.n || 4;
    const L = 2 * n;

    // Verify pattern length matches L
    if (this.currentPattern.length !== L) {
      this.currentPattern = L === 8 ? '00******' : '0000******';
      this.updatePresetsDropdown(L);
      this.renderBitButtons(L, n);
      this.setPattern(this.currentPattern);
      return;
    }

    // Population extraction for current step
    const pop = this.extractCurrentPopulation(stepRecord);
    const chroms = pop.map(ind => typeof ind === 'string' ? ind : (ind.chromosome || ''));

    // Selection fitness array (shifted if active)
    const fitnessArray = pop.map((ind, i) => {
      if (stepRecord.shiftedFitness && stepRecord.shiftedFitness[i] !== undefined) {
        return stepRecord.shiftedFitness[i];
      }
      if (stepRecord.selectionFitness && stepRecord.selectionFitness[i] !== undefined) {
        return stepRecord.selectionFitness[i];
      }
      return ind.F !== undefined ? ind.F : (ind.f !== undefined ? ind.f : 1);
    });

    const evalRes = evaluateSchemaInPopulation(this.currentPattern, chroms, fitnessArray);

    // Update live metrics
    const metricOrder = document.getElementById('metric-order');
    const metricLen = document.getElementById('metric-length');
    const metricMatching = document.getElementById('metric-matching');
    const metricFh = document.getElementById('metric-fh');
    const metricFbar = document.getElementById('metric-fbar');
    const metricRatio = document.getElementById('metric-ratio');

    if (metricOrder) metricOrder.textContent = evalRes.order;
    if (metricLen) metricLen.textContent = evalRes.definingLength;
    if (metricMatching) metricMatching.textContent = `${evalRes.m} / ${chroms.length}`;
    if (metricFh) metricFh.textContent = evalRes.f_H.toFixed(5);
    if (metricFbar) metricFbar.textContent = evalRes.f_bar.toFixed(5);
    if (metricRatio) {
      const ratio = evalRes.f_bar > 0 ? (evalRes.f_H / evalRes.f_bar) : 0;
      metricRatio.textContent = `${ratio.toFixed(2)}x`;
      metricRatio.style.color = ratio >= 1 ? 'var(--color-success)' : 'var(--color-danger)';
    }

    // Operator disruption analysis
    this.updateOperatorRisk(stepRecord, evalRes, config);

    // Multi-generation schema bounds for chart
    this.updateBoundsChart(config, allSteps, stepRecord.generationIndex);

    // Callback to notify parent (table, heatmap, strips highlights)
    if (this.onSchemaChanged) {
      this.onSchemaChanged(this.currentPattern, evalRes.matchingIndices, evalRes);
    }
  }

  updateOperatorRisk(stepRecord, schemaEval, config) {
    const container = document.getElementById('schema-operator-status');
    const body = document.getElementById('schema-operator-body');
    if (!container || !body) return;

    const phase = stepRecord.phase;
    const L = (config.n || 4) * 2;

    if (phase === STEP_PHASES.CROSSOVER && stepRecord.crossoverResults) {
      container.style.display = 'block';
      const items = [];

      for (const res of stepRecord.crossoverResults) {
        const { pairIndex, parent1Idx, parent2Idx, crossed, cutPoint, child1Chrom, child2Chrom, parent1Chrom, parent2Chrom } = res;
        if (!crossed) {
          items.push(`Pair ${pairIndex} (P#${parent1Idx + 1} × P#${parent2Idx + 1}): Unchanged (no crossover)`);
          continue;
        }

        const isInside = isCutInsideSpan(cutPoint, schemaEval);
        const p1Matches = matchesSchema(parent1Chrom, this.currentPattern);
        const p2Matches = matchesSchema(parent2Chrom, this.currentPattern);
        const c1Matches = matchesSchema(child1Chrom, this.currentPattern);
        const c2Matches = matchesSchema(child2Chrom, this.currentPattern);

        let chip = '';
        if (isInside) {
          chip = `<span style="background: rgba(216, 212, 200, 0.15); color: var(--stone); padding: 1px 4px; border-radius: 2px;">cut inside d(H)</span>`;
        } else {
          chip = `<span style="background: rgba(216, 212, 200, 0.08); color: rgba(216, 212, 200, 0.62); padding: 1px 4px; border-radius: 2px;">cut outside d(H): cannot disrupt</span>`;
        }

        let outcome = '';
        if (p1Matches && p2Matches) {
          outcome = 'Both parents match H: schema preserved intact.';
        } else if (p1Matches || p2Matches) {
          const disrupted = (p1Matches && !c1Matches && !c2Matches) || (p2Matches && !c1Matches && !c2Matches);
          outcome = disrupted
            ? `<span style="color: rgba(216, 212, 200, 0.62);">Schema disrupted in offspring</span>`
            : `<span style="color: var(--lime);">Schema survived in offspring</span>`;
        } else {
          outcome = 'Neither parent carried H.';
        }

        items.push(`Pair ${pairIndex} (Cut k=${cutPoint}): ${chip} — ${outcome}`);
      }

      body.innerHTML = items.join('<br>');
    } else if (phase === STEP_PHASES.MUTATE && stepRecord.mutationResult) {
      container.style.display = 'block';
      const fixedPositions = new Set();
      for (let i = 0; i < this.currentPattern.length; i++) {
        if (this.currentPattern[i] !== '*') fixedPositions.add(i + 1);
      }

      const flips = stepRecord.mutationResult.flips || [];
      if (flips.length === 0) {
        body.innerHTML = 'No bit flips occurred in this generation.';
      } else {
        const lines = flips.map(f => {
          const isFixed = fixedPositions.has(f.bitPosition1Based);
          if (isFixed) {
            return `<span style="color: var(--color-danger);">⚠ Flip on fixed position ${f.bitPosition1Based} (child #${f.childIndex + 1}): Disrupts schema H</span>`;
          } else {
            return `<span style="color: var(--color-text-muted);">✓ Flip on wildcard (*) position ${f.bitPosition1Based} (child #${f.childIndex + 1}): Neutral to schema H</span>`;
          }
        });
        body.innerHTML = lines.join('<br>');
      }
    } else {
      container.style.display = 'none';
    }
  }

  updateBoundsChart(config, allSteps, currentGen) {
    if (!this.chart || !allSteps || allSteps.length === 0) return;

    const pc = config.pc ?? 0.8;
    const pm = config.pm ?? 0.05;
    const L = (config.n || 4) * 2;
    const N = config.N || 4;
    const isTournament = (config.selection === 'tournament');

    // Collect generations DECODE_EVAL data
    const genRecords = new Map();
    for (const step of allSteps) {
      const g = step.generationIndex;
      if (step.phase === STEP_PHASES.DECODE_EVAL && !genRecords.has(g)) {
        genRecords.set(g, step);
      }
    }
    // Fallback for gen 1 if only INIT
    if (!genRecords.has(1) && allSteps[0] && allSteps[0].population) {
      genRecords.set(1, allSteps[0]);
    }

    const maxGen = Math.max(...Array.from(genRecords.keys()), 1);
    const observedM = [];
    const textbookBounds = [null]; // Bound for Gen 1 is null; bound computed from Gen t aligns at t+1
    const exactBounds = [null];

    for (let g = 1; g <= maxGen; g++) {
      const rec = genRecords.get(g);
      if (!rec) {
        observedM.push(null);
        textbookBounds.push(null);
        exactBounds.push(null);
        continue;
      }

      const pop = rec.population || [];
      const chroms = pop.map(ind => typeof ind === 'string' ? ind : (ind.chromosome || ''));
      const fitnessArray = pop.map(ind => ind.F !== undefined ? ind.F : (ind.f || 1));

      const evalRes = evaluateSchemaInPopulation(this.currentPattern, chroms, fitnessArray);
      observedM.push(evalRes.m);

      // Compute theoretical lower bound for generation g + 1
      const bounds = calculateSchemaBounds(evalRes, pc, pm, L);
      textbookBounds.push(bounds.textbookBound);
      exactBounds.push(bounds.exactBound);
    }

    this.chart.render({
      observedM,
      textbookBounds,
      exactBounds,
      N,
      currentGen,
      isTournament
    });
  }
}
