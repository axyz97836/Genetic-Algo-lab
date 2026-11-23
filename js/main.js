/**
 * js/main.js - Central Application Coordinator for GA Lab.
 * Conforms to SPEC.md §2, §3, §4, §5.
 */

import { ControlsManager } from './ui/controls.js';
import { PopulationTable } from './ui/table.js';
import { ChromosomeStrips } from './ui/strips.js';
import { NarrationManager } from './ui/narration.js';
import { PlaybackController } from './ui/playback.js';
import { SchemaView } from './ui/schema-view.js';
import { TiltController } from './ui/tilt.js';

import { HeatmapVisualizer } from './viz/heatmap.js';
import { Landscape3DVisualizer } from './viz/landscape3d.js';
import { ConvergenceChart } from './viz/convergence.js';
import { Ribbon3DVisualizer } from './viz/ribbon3d.js';
import { RouletteVisualizer } from './viz/roulette.js';
import { TournamentVisualizer } from './viz/tournament.js';

import { Mulberry32, ScriptedRNG } from './engine/rng.js';
import { runGeneration, evaluatePopulationChromosomes, STEP_PHASES } from './engine/engine.js';
import { verifyGenerationStep, auditPreset } from './engine/verify.js';
import { getPresetById } from '../data/presets.js';

function freezeSnapshot(record) {
  if (!record || Object.isFrozen(record)) return record;
  const copy = { ...record };
  if (Array.isArray(record.population)) {
    copy.population = Object.freeze(record.population.map(p => Object.freeze({ ...p })));
  }
  if (Array.isArray(record.childrenBeforeMutation)) {
    copy.childrenBeforeMutation = Object.freeze([...record.childrenBeforeMutation]);
  }
  if (Array.isArray(record.mutatedChildren)) {
    copy.mutatedChildren = Object.freeze([...record.mutatedChildren]);
  }
  if (Array.isArray(record.flips)) {
    copy.flips = Object.freeze(record.flips.map(f => Object.freeze({ ...f })));
  }
  return Object.freeze(copy);
}

class GALabApp {
  constructor() {
    this.allSteps = [];
    this.generationHistory = [];
    this.currentStepIdx = 0;
    this.selectedIndividual = null;
    this.selectedIndividualIdx = 0;
    this.config = null;

    this.initUI();
  }

  initUI() {
    this.narration = new NarrationManager('narration-card', 'alert-container');
    this.strips = new ChromosomeStrips('chromosome-strips');
    this.heatmap = new HeatmapVisualizer('heatmap-canvas', 'heatmap-tooltip', 'heatmap-legend-bar');
    this.convergence = new ConvergenceChart('convergence-chart-svg');
    this.roulette = new RouletteVisualizer('roulette-canvas', 'roulette-readout');
    this.tournament = new TournamentVisualizer('tournament-bracket');
    this.selectionPanel = document.getElementById('selection-operator-panel');
    this.rouletteView = document.getElementById('roulette-view');
    this.tournamentView = document.getElementById('tournament-bracket');
    this.selectionTitle = document.getElementById('selection-panel-title');

    // Verify Mode DOM elements (Phase 5)
    this.verifySummaryBar = document.getElementById('verify-summary-bar');
    this.verifyGenNum = document.getElementById('verify-gen-num');
    this.verifyGenCounts = document.getElementById('verify-gen-counts');
    this.verifyGlobalCounts = document.getElementById('verify-global-counts');
    this.verifyGlobalPct = document.getElementById('verify-global-pct');

    this.activeSchemaPattern = '00******';
    this.activeSchemaMatches = [];
    this.lastVerifyResults = null;

    this.schema = new SchemaView('schema-xray-panel', (pattern, matchingIndices, evalRes) => {
      this.activeSchemaPattern = pattern;
      this.activeSchemaMatches = matchingIndices;
      const record = this.allSteps[this.currentStepIdx];
      if (record) {
        this.table.render(record, this.config.decimals, this.config.n, this.lastVerifyResults, this.activeSchemaMatches);
        if (this.heatmap) this.heatmap.render(record, this.config, this.activeSchemaMatches);
        if (this.strips) {
          const pop = record.population || [];
          const selectedInd = pop[this.selectedIndividualIdx] || pop[0] || null;
          this.strips.render(selectedInd, this.selectedIndividualIdx, record, this.config.n, this.config.bounds, this.activeSchemaPattern);
        }
      }
    });

    this.table = new PopulationTable('population-table', (ind, idx, record) => {
      this.selectedIndividual = ind;
      this.selectedIndividualIdx = idx;
      const n = this.config?.n || 4;
      const bounds = this.config?.bounds || [[0, 15], [0, 15]];
      this.strips.render(ind, idx, record, n, bounds, this.activeSchemaPattern);
    });

    this.playback = new PlaybackController({
      onStepChange: (idx) => this.goToStep(idx),
      onReset: () => this.resetSimulation(),
      onNextGen: () => this.jumpToNextGen()
    });

    this.controls = new ControlsManager((newConfig) => {
      this.config = newConfig;
      this.rebuildTimeline();
    });

    // Ensure config is set if not already triggered by controls constructor
    if (!this.config) {
      this.config = this.controls.getConfig();
      this.rebuildTimeline();
    }

    // 3D Depth & Pointer Tilt Controller
    this.tilt = new TiltController(document.getElementById('app-root'));

    // 3D Fitness Landscape Visualizer (Phase 2)
    this.landscapeMode = '2D';
    this.landscapeMetric = 'F';
    this.landscape3d = new Landscape3DVisualizer('landscape-3d-canvas', 'heatmap-tooltip', {
      onFallback: (reason) => this.fallbackTo2D(reason)
    });

    this.landscapeViewModeBtn = document.getElementById('landscape-view-mode-btn');
    this.landscapeMetricToggle = document.getElementById('landscape-metric-toggle');
    this.landscapeResetBtn = document.getElementById('landscape-reset-btn');
    this.heatmapCanvas = document.getElementById('heatmap-canvas');
    this.landscape3dCanvas = document.getElementById('landscape-3d-canvas');
    this.landscapeLegendContainer = document.getElementById('heatmap-legend-container');
    this.landscapeFallbackNotice = document.getElementById('landscape-fallback-notice');
    this.landscapeTitle = document.getElementById('landscape-panel-title');

    if (this.landscapeViewModeBtn) {
      this.landscapeViewModeBtn.addEventListener('click', () => {
        this.setLandscapeMode(this.landscapeMode === '2D' ? '3D' : '2D');
      });
    }

    if (this.landscapeMetricToggle) {
      this.landscapeMetricToggle.addEventListener('click', () => {
        this.setLandscapeMetric(this.landscapeMetric === 'F' ? 'f' : 'F');
      });
    }

    if (this.landscapeResetBtn) {
      this.landscapeResetBtn.addEventListener('click', () => {
        if (this.landscape3d) this.landscape3d.resetCamera();
      });
    }

    // 3D Ribbon Convergence Chart (Phase 4)
    this.ribbonMode = '2D';
    this.ribbon3d = new Ribbon3DVisualizer('convergence-ribbon-canvas', {
      onFallback: (reason) => this.fallbackRibbonTo2D(reason)
    });

    this.convergenceViewModeBtn = document.getElementById('convergence-view-mode-btn');
    this.convergenceResetBtn = document.getElementById('convergence-reset-btn');
    this.convergenceSvg = document.getElementById('convergence-chart-svg');
    this.convergenceCanvas = document.getElementById('convergence-ribbon-canvas');
    this.ribbonFallbackNotice = document.getElementById('ribbon-fallback-notice');

    if (this.convergenceViewModeBtn) {
      this.convergenceViewModeBtn.addEventListener('click', () => {
        this.setRibbonMode(this.ribbonMode === '2D' ? '3D' : '2D');
      });
    }

    if (this.convergenceResetBtn) {
      this.convergenceResetBtn.addEventListener('click', () => {
        if (this.ribbon3d) this.ribbon3d.resetCamera();
      });
    }
  }

  setLandscapeMode(mode) {
    this.landscapeMode = mode;
    const is3D = mode === '3D';

    if (this.heatmapCanvas) this.heatmapCanvas.style.display = is3D ? 'none' : 'block';
    if (this.landscape3dCanvas) this.landscape3dCanvas.style.display = is3D ? 'block' : 'none';
    if (this.landscapeLegendContainer) this.landscapeLegendContainer.style.display = is3D ? 'none' : 'flex';
    if (this.landscapeResetBtn) this.landscapeResetBtn.style.display = is3D ? 'inline-flex' : 'none';

    if (this.landscapeViewModeBtn) {
      this.landscapeViewModeBtn.textContent = is3D ? '2D View' : '3D View';
      this.landscapeViewModeBtn.setAttribute('aria-pressed', is3D ? 'true' : 'false');
    }

    if (this.landscapeTitle) {
      this.landscapeTitle.textContent = is3D ? '3D Fitness Landscape' : '2D Fitness Landscape & Optimum';
    }

    if (is3D) {
      if (this.landscapeFallbackNotice) this.landscapeFallbackNotice.style.display = 'none';
      if (this.landscape3d) {
        this.landscape3d.adaptiveFallbackTriggered = false;
        this.landscape3d.qualityReduced = false;
        this.landscape3d.frameTimes = [];
        const record = this.allSteps[this.currentStepIdx];
        if (record) {
          const frozen = freezeSnapshot(record);
          this.landscape3d.updateSnapshot(frozen, this.config, this.activeSchemaMatches);
        }
        this.landscape3d.startLoop();
      }
    } else {
      if (this.landscape3d) this.landscape3d.stopLoop();
      const record = this.allSteps[this.currentStepIdx];
      if (record && this.heatmap) {
        const frozen = freezeSnapshot(record);
        this.heatmap.render(frozen, this.config, this.activeSchemaMatches);
      }
    }
  }

  setLandscapeMetric(metric) {
    this.landscapeMetric = metric;
    if (this.landscapeMetricToggle) {
      this.landscapeMetricToggle.textContent = `Height: ${metric}`;
    }
    if (this.landscape3d) {
      this.landscape3d.setMetricMode(metric);
    }
    const record = this.allSteps[this.currentStepIdx];
    if (record) {
      const frozen = freezeSnapshot(record);
      if (this.landscapeMode === '3D' && this.landscape3d) {
        this.landscape3d.updateSnapshot(frozen, this.config, this.activeSchemaMatches);
      } else if (this.heatmap) {
        this.heatmap.render(frozen, this.config, this.activeSchemaMatches);
      }
    }
  }

  fallbackTo2D(reason = 'Reduced 3D') {
    this.setLandscapeMode('2D');
    if (this.landscapeFallbackNotice) {
      this.landscapeFallbackNotice.textContent = reason;
      this.landscapeFallbackNotice.style.display = 'inline-block';
    }
  }

  setRibbonMode(mode) {
    this.ribbonMode = mode;
    const is3D = mode === '3D';

    if (this.convergenceSvg) this.convergenceSvg.style.display = is3D ? 'none' : 'block';
    if (this.convergenceCanvas) this.convergenceCanvas.style.display = is3D ? 'block' : 'none';
    if (this.convergenceResetBtn) this.convergenceResetBtn.style.display = is3D ? 'inline-flex' : 'none';

    if (this.convergenceViewModeBtn) {
      this.convergenceViewModeBtn.textContent = is3D ? '2D Chart' : '3D Ribbon';
      this.convergenceViewModeBtn.setAttribute('aria-pressed', is3D ? 'true' : 'false');
    }

    if (is3D) {
      if (this.ribbonFallbackNotice) this.ribbonFallbackNotice.style.display = 'none';
      if (this.ribbon3d) {
        this.ribbon3d.adaptiveFallbackTriggered = false;
        this.ribbon3d.frameTimes = [];
        const record = this.allSteps[this.currentStepIdx];
        this.ribbon3d.updateSnapshot(this.generationHistory, record ? record.generationIndex : 1);
        this.ribbon3d.startLoop();
      }
    } else {
      if (this.ribbon3d) this.ribbon3d.stopLoop();
      const record = this.allSteps[this.currentStepIdx];
      if (record && this.convergence) {
        this.convergence.render(this.generationHistory, record.generationIndex);
      }
    }
  }

  fallbackRibbonTo2D(reason = 'Reduced 3D') {
    this.setRibbonMode('2D');
    if (this.ribbonFallbackNotice) {
      this.ribbonFallbackNotice.textContent = reason;
      this.ribbonFallbackNotice.style.display = 'inline-block';
    }
  }

  rebuildTimeline(options = {}) {
    if (!this.config) {
      if (this.controls) this.config = this.controls.getConfig();
      if (!this.config) return;
    }
    this.allSteps = [];
    this.currentStepIdx = 0;

    const {
      preset,
      isVerifyMode,
      n,
      bounds,
      N,
      maxGen,
      pc,
      pm,
      selection,
      fitnessMode,
      C,
      elitism,
      seed,
      problemFn,
      problemType,
      crossCmp,
      mutCmp
    } = this.config;

    if (!problemFn) return;

    if (this.schema) {
      const L = 2 * n;
      this.schema.updatePresetsDropdown(L);
      this.schema.renderBitButtons(L, n);
    }

    if (N % 2 !== 0) {
      if (this.narration) {
        this.narration.titleEl.innerHTML = `<span style="color: var(--color-danger);">Invalid Population Size</span>`;
        this.narration.bodyEl.innerHTML = `Population size <strong>N = ${N}</strong> is invalid. Consecutive pair crossover requires an <strong>even</strong> population size (e.g., 2, 4, 6, 8...).`;
        this.narration.mathEl.style.display = 'none';
      }
      return;
    }

    // 1. Initial Population
    let currentPop = [];
    if (preset && preset.initialPop && (isVerifyMode || this.config.presetId !== 'free-play')) {
      currentPop = [...preset.initialPop];
    } else {
      // Generate seeded random initial population
      const rngInit = new Mulberry32(seed);
      const L = 2 * n;
      for (let i = 0; i < N; i++) {
        let chrom = '';
        for (let b = 0; b < L; b++) {
          chrom += rngInit.next() < 0.5 ? '0' : '1';
        }
        currentPop.push(chrom);
      }
    }

    // Initial Decode/Eval record for Gen 0
    const evalInit = evaluatePopulationChromosomes(currentPop, {
      problemFn,
      problemType,
      bounds,
      n,
      fitnessMode,
      C
    });

    const initRecord = {
      phase: STEP_PHASES.INIT,
      generationIndex: 1,
      population: evalInit.individuals,
      stats: evalInit.stats,
      sumF: evalInit.sumF
    };
    this.allSteps.push(initRecord);

    // 2. Generate Multi-Generation Step Records
    const freeRng = new Mulberry32(seed + 100);

    const totalGenerations = preset && (isVerifyMode || this.config.presetId !== 'free-play')
      ? preset.generations.length
      : maxGen;

    for (let gen = 1; gen <= totalGenerations; gen++) {
      let rngForGen;
      let stopAfter = null;

      if (preset && (isVerifyMode || this.config.presetId !== 'free-play')) {
        const genPreset = preset.generations[gen - 1];
        if (!genPreset) break;
        rngForGen = new ScriptedRNG(genPreset, gen, N);
        stopAfter = genPreset.stopAfter || null;
      } else {
        rngForGen = freeRng;
      }

      const genParams = {
        problemFn,
        problemType,
        bounds,
        n,
        N,
        pc,
        pm,
        selection,
        fitnessMode,
        C,
        elitism,
        crossCmp,
        mutCmp,
        generationIndex: gen,
        stopAfter,
        allowAutoShift: options.allowAutoShift || false
      };

      try {
        const genSteps = runGeneration(currentPop, genParams, rngForGen);
        for (const step of genSteps) {
          this.allSteps.push(step);
        }

        // Prepare pop for next gen
        const lastStep = genSteps[genSteps.length - 1];
        if (lastStep.phase === STEP_PHASES.REPLACE) {
          currentPop = lastStep.finalNewPopulation;
        } else if (lastStep.mutatedChildren) {
          currentPop = lastStep.mutatedChildren;
        } else if (lastStep.matingPool) {
          currentPop = lastStep.matingPool;
        }

        if (stopAfter) break;
      } catch (err) {
        console.error('Error in generation run:', err);
        break;
      }
    }

    this.generationHistory = this.buildGenerationHistory();
    this.goToStep(0);
  }

  buildGenerationHistory() {
    const history = [];
    const seenGens = new Set();

    for (const step of this.allSteps) {
      const gen = step.generationIndex;
      // Capture stats from the primary DECODE_EVAL step of each generation
      if (step.phase === STEP_PHASES.DECODE_EVAL && step.stats && !seenGens.has(gen)) {
        seenGens.add(gen);
        history.push({
          generationIndex: gen,
          stats: step.stats
        });
      }
    }

    // Fallback: if no DECODE_EVAL step (e.g. init only), capture INIT stats
    if (history.length === 0 && this.allSteps.length > 0 && this.allSteps[0].stats) {
      history.push({
        generationIndex: 1,
        stats: this.allSteps[0].stats
      });
    }

    return history.sort((a, b) => a.generationIndex - b.generationIndex);
  }

  goToStep(stepIdx) {
    if (this.allSteps.length === 0) return;
    this.currentStepIdx = Math.max(0, Math.min(stepIdx, this.allSteps.length - 1));
    const record = this.allSteps[this.currentStepIdx];

    // Verify Mode evaluation (Phase 5)
    let verifyResults = null;
    const isVerifyActive = this.controls?.isVerifyMode && this.config?.presetId !== 'free-play';

    if (isVerifyActive) {
      const preset = getPresetById(this.config.presetId);
      if (preset && preset.generations) {
        const genExpected = preset.generations[record.generationIndex - 1]?.expected;
        if (genExpected) {
          const stepVerify = verifyGenerationStep(record, genExpected, preset.decimals, preset.N);
          verifyResults = stepVerify.cellResults;

          if (this.verifySummaryBar) {
            this.verifySummaryBar.style.display = 'flex';
            if (this.verifyGenNum) this.verifyGenNum.textContent = record.generationIndex;
            if (this.verifyGenCounts) this.verifyGenCounts.textContent = `${stepVerify.matchedCount} / ${stepVerify.totalCount}`;

            // Global preset progress
            try {
              const fullAudit = auditPreset(preset);
              if (this.verifyGlobalCounts) this.verifyGlobalCounts.textContent = `${fullAudit.globalMatched} / ${fullAudit.globalTotal}`;
              if (this.verifyGlobalPct) {
                const pct = fullAudit.globalTotal > 0 ? Math.round((fullAudit.globalMatched / fullAudit.globalTotal) * 100) : 100;
                this.verifyGlobalPct.textContent = `${pct}%`;
              }
            } catch (e) {
              // Ignore audit error during partial runs
            }
          }
        }
      }
    } else {
      if (this.verifySummaryBar) this.verifySummaryBar.style.display = 'none';
    }

    const frozenRecord = freezeSnapshot(record);

    this.lastVerifyResults = verifyResults;
    this.table.render(frozenRecord, this.config.decimals, this.config.n, verifyResults, this.activeSchemaMatches);
    this.narration.update(frozenRecord, this.config, (action, data) => this.handleNarrationAction(action, data));

    // Render Heatmap (2D)
    if (this.heatmap) {
      this.heatmap.lastStepRecord = frozenRecord;
      if (this.landscapeMode === '2D') {
        this.heatmap.render(frozenRecord, this.config, this.activeSchemaMatches);
      }
    }

    // Render 3D Fitness Landscape (Phase 2)
    if (this.landscape3d) {
      this.landscape3d.updateSnapshot(frozenRecord, this.config, this.activeSchemaMatches);
    }

    // Render Convergence Chart & 3D Ribbon (Phase 4)
    if (this.ribbon3d) {
      this.ribbon3d.updateSnapshot(this.generationHistory, record.generationIndex);
    }
    if (this.convergence) {
      this.convergence.lastHistory = this.generationHistory;
      this.convergence.lastCurrentGen = record.generationIndex;
      this.convergence.render(this.generationHistory, record.generationIndex);
    }

    // Render Chromosome Strips
    if (this.strips) {
      const pop = record.population || [];
      const selectedInd = pop[this.selectedIndividualIdx] || pop[0] || null;
      this.strips.render(selectedInd, this.selectedIndividualIdx, record, this.config.n, this.config.bounds, this.activeSchemaPattern);
    }

    // Render Schema X-Ray Panel (Phase 6)
    if (this.schema) {
      this.schema.update(record, this.config, this.allSteps);
    }

    // Render Selection Operator Panel (Phase 4: Roulette Wheel vs Tournament)
    if (this.selectionPanel) {
      if (record.phase === STEP_PHASES.SELECT) {
        this.selectionPanel.style.display = 'flex';
        const isRoulette = (record.selectionScheme || this.config.selection) === 'roulette';

        if (this.selectionTitle) {
          this.selectionTitle.textContent = isRoulette
            ? 'Roulette Wheel Selection (Fitness Proportionate Sampling)'
            : 'Binary Tournament Selection (Contender Matches)';
        }

        if (isRoulette) {
          if (this.rouletteView) this.rouletteView.style.display = 'flex';
          if (this.tournamentView) this.tournamentView.style.display = 'none';
          if (this.roulette) {
            this.roulette.render(record, this.config, (action, data) => this.handleNarrationAction(action, data));
          }
        } else {
          if (this.rouletteView) this.rouletteView.style.display = 'none';
          if (this.tournamentView) this.tournamentView.style.display = 'block';
          if (this.tournament) {
            this.tournament.render(record, this.config);
          }
        }
      } else {
        this.selectionPanel.style.display = 'none';
      }
    }

    this.playback.updateScrubberUI(
      this.currentStepIdx,
      this.allSteps.length,
      record.generationIndex,
      this.narration.formatPhaseName(record.phase)
    );
  }

  jumpToNextGen() {
    const currentRecord = this.allSteps[this.currentStepIdx];
    const currentGen = currentRecord ? currentRecord.generationIndex : 1;

    for (let i = this.currentStepIdx + 1; i < this.allSteps.length; i++) {
      if (this.allSteps[i].generationIndex > currentGen) {
        this.goToStep(i);
        return;
      }
    }
    // If already at latest generation, jump to the very end
    this.goToStep(this.allSteps.length - 1);
  }

  resetSimulation() {
    this.rebuildTimeline();
  }

  handleNarrationAction(action, data) {
    if (action === 'apply-shift') {
      this.rebuildTimeline({ allowAutoShift: true });
    } else if (action === 'switch-tournament') {
      const sel = document.getElementById('selection-select');
      if (sel) sel.value = 'tournament';
      this.config = this.controls.getConfig();
      this.rebuildTimeline();
    }
  }
}

// Bootstrap on DOMContentLoaded
window.addEventListener('DOMContentLoaded', () => {
  window.gaLabApp = new GALabApp();
});
