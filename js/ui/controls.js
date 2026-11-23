/**
 * js/ui/controls.js - Parameter Controls and UI Binding.
 * Conforms to SPEC.md §2, §4.1.
 */

import { PROBLEMS, getProblemById, parse, validateOnGrid } from '../../data/problems.js';
import { PRESETS, getPresetById } from '../../data/presets.js';
import { calculateDeltaX } from '../engine/decode.js';

export class ControlsManager {
  constructor(onConfigChange) {
    this.onConfigChange = onConfigChange;
    this.isVerifyMode = false;
    this.currentPresetId = 'ref-roulette';
    this.currentConfig = null;

    this.cacheElements();
    this.populateDropdowns();
    this.bindEvents();
  }

  cacheElements() {
    this.el = {
      presetSelect: document.getElementById('preset-select'),
      verifyModeBtn: document.getElementById('verify-mode-btn'),
      verifyStatusDot: document.getElementById('verify-status-dot'),
      cloneFreeBtn: document.getElementById('clone-free-btn'),

      problemSelect: document.getElementById('problem-select'),
      customExprWrap: document.getElementById('custom-expr-wrap'),
      customExprInput: document.getElementById('custom-expr-input'),
      customExprError: document.getElementById('custom-expr-error'),

      problemType: document.getElementById('problem-type'),
      precisionSelect: document.getElementById('precision-select'),
      x1Min: document.getElementById('x1-min'),
      x1Max: document.getElementById('x1-max'),
      x2Min: document.getElementById('x2-min'),
      x2Max: document.getElementById('x2-max'),
      deltaDisplay: document.getElementById('delta-display'),

      popSize: document.getElementById('pop-size'),
      popSizeError: document.getElementById('pop-size-error'),
      maxGen: document.getElementById('max-gen'),
      pcInput: document.getElementById('pc-input'),
      pmInput: document.getElementById('pm-input'),
      selectionSelect: document.getElementById('selection-select'),
      fitnessModeSelect: document.getElementById('fitness-mode-select'),
      cminusWrap: document.getElementById('cminus-wrap'),
      cminusInput: document.getElementById('cminus-input'),
      elitismToggle: document.getElementById('elitism-toggle'),
      seedInput: document.getElementById('seed-input'),
      reseedBtn: document.getElementById('reseed-btn')
    };
  }

  populateDropdowns() {
    // Populate Presets
    this.el.presetSelect.innerHTML = '';
    const freeOpt = document.createElement('option');
    freeOpt.value = 'free-play';
    freeOpt.textContent = '⚡ Free Play (Custom Setup)';
    freeOpt.title = freeOpt.textContent;
    this.el.presetSelect.appendChild(freeOpt);

    const groupRef = document.createElement('optgroup');
    groupRef.label = '§9 Hand-Calculated Reference';
    const groupLect = document.createElement('optgroup');
    groupLect.label = 'Lecture Problem Presets';

    for (const p of PRESETS) {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = `${p.id}: ${p.title}`;
      opt.title = opt.textContent;
      if (p.id.startsWith('ref-')) {
        groupRef.appendChild(opt);
      } else {
        groupLect.appendChild(opt);
      }
    }
    this.el.presetSelect.appendChild(groupRef);
    this.el.presetSelect.appendChild(groupLect);

    // Populate Problems
    this.el.problemSelect.innerHTML = '';
    for (const prob of PROBLEMS) {
      const opt = document.createElement('option');
      opt.value = prob.id;
      opt.textContent = `${prob.title} [${prob.expression}]`;
      opt.title = opt.textContent;
      this.el.problemSelect.appendChild(opt);
    }
    const customOpt = document.createElement('option');
    customOpt.value = 'custom';
    customOpt.textContent = '✎ Custom Expression...';
    customOpt.title = customOpt.textContent;
    this.el.problemSelect.appendChild(customOpt);

    // Attach tooltips to all select elements
    this.updateSelectTitles();

    // Set initial selection
    this.el.presetSelect.value = this.currentPresetId;
    this.applyPreset(this.currentPresetId);
  }

  updateSelectTitles() {
    const selects = [
      this.el.presetSelect,
      this.el.problemSelect,
      this.el.problemType,
      this.el.precisionSelect,
      this.el.selectionSelect,
      this.el.fitnessModeSelect
    ];
    for (const sel of selects) {
      if (!sel) continue;
      const selected = sel.options[sel.selectedIndex];
      if (selected) sel.title = selected.textContent;
      for (const opt of sel.options) {
        if (!opt.title) opt.title = opt.textContent;
      }
    }
  }

  bindEvents() {
    this.el.presetSelect.addEventListener('change', (e) => {
      const val = e.target.value;
      if (val === 'free-play') {
        this.setVerifyMode(false);
        this.unlockControls();
        this.emitChange();
      } else {
        this.applyPreset(val);
      }
    });

    this.el.verifyModeBtn.addEventListener('click', () => {
      this.setVerifyMode(!this.isVerifyMode);
      this.emitChange();
    });

    this.el.cloneFreeBtn.addEventListener('click', () => {
      this.setVerifyMode(false);
      this.el.presetSelect.value = 'free-play';
      this.unlockControls();
      this.emitChange();
    });

    this.el.problemSelect.addEventListener('change', (e) => {
      const isCustom = e.target.value === 'custom';
      this.el.customExprWrap.style.display = isCustom ? 'flex' : 'none';
      if (!isCustom) {
        const prob = getProblemById(e.target.value);
        if (prob) {
          this.el.problemType.value = prob.type;
          this.el.x1Min.value = prob.bounds[0][0];
          this.el.x1Max.value = prob.bounds[0][1];
          this.el.x2Min.value = prob.bounds[1][0];
          this.el.x2Max.value = prob.bounds[1][1];
          this.el.precisionSelect.value = prob.defaultN || 4;
        }
      }
      this.updateSelectTitles();
      this.updateDeltas();
    this.updateSelectTitles();
      this.emitChange();
    });

    const inputsToWatch = [
      this.el.problemType,
      this.el.precisionSelect,
      this.el.x1Min,
      this.el.x1Max,
      this.el.x2Min,
      this.el.x2Max,
      this.el.popSize,
      this.el.maxGen,
      this.el.pcInput,
      this.el.pmInput,
      this.el.selectionSelect,
      this.el.fitnessModeSelect,
      this.el.cminusInput,
      this.el.elitismToggle,
      this.el.seedInput
    ];

    for (const input of inputsToWatch) {
      input.addEventListener('change', () => {
        this.updateDeltas();
    this.updateSelectTitles();
        this.emitChange();
      });
      input.addEventListener('input', () => {
        this.updateDeltas();
    this.updateSelectTitles();
      });
    }

    this.el.fitnessModeSelect.addEventListener('change', (e) => {
      this.el.cminusWrap.style.display = e.target.value === 'min-cminus' ? 'flex' : 'none';
    });

    this.el.customExprInput.addEventListener('input', () => {
      this.validateCustomExpr();
      this.emitChange();
    });

    this.el.reseedBtn.addEventListener('click', () => {
      this.el.seedInput.value = Math.floor(Math.random() * 100000);
      this.emitChange();
    });
  }

  updateDeltas() {
    const n = parseInt(this.el.precisionSelect.value, 10);
    const bounds = this.getBounds();
    const [dx1, dx2] = calculateDeltaX(bounds, n);
    this.el.deltaDisplay.textContent = `Δx1 = ${dx1.toFixed(6)}, Δx2 = ${dx2.toFixed(6)}`;
  }

  getBounds() {
    return [
      [parseFloat(this.el.x1Min.value) || 0, parseFloat(this.el.x1Max.value) || 15],
      [parseFloat(this.el.x2Min.value) || 0, parseFloat(this.el.x2Max.value) || 15]
    ];
  }

  validateCustomExpr() {
    const exprStr = this.el.customExprInput.value.trim();
    const n = parseInt(this.el.precisionSelect.value, 10);
    const bounds = this.getBounds();

    try {
      const parsed = parse(exprStr);
      const gridCheck = validateOnGrid(parsed, bounds, n);
      if (!gridCheck.valid) {
        this.el.customExprError.textContent = gridCheck.error;
        this.el.customExprError.classList.add('visible');
        return null;
      }
      this.el.customExprError.classList.remove('visible');
      return (x1, x2) => parsed.evaluate(x1, x2);
    } catch (err) {
      this.el.customExprError.textContent = err.message;
      this.el.customExprError.classList.add('visible');
      return null;
    }
  }

  applyPreset(presetId) {
    const preset = getPresetById(presetId);
    if (!preset) return;

    this.currentPresetId = presetId;
    this.el.presetSelect.value = presetId;

    // Apply fields
    this.el.problemSelect.value = preset.problemId;
    this.el.customExprWrap.style.display = 'none';
    this.el.problemType.value = preset.type;
    this.el.precisionSelect.value = preset.n;
    this.el.x1Min.value = preset.bounds[0][0];
    this.el.x1Max.value = preset.bounds[0][1];
    this.el.x2Min.value = preset.bounds[1][0];
    this.el.x2Max.value = preset.bounds[1][1];

    this.el.popSize.value = preset.N;
    this.el.maxGen.value = preset.generations ? preset.generations.length : 3;
    this.el.pcInput.value = preset.pc;
    this.el.pmInput.value = preset.pm;
    this.el.selectionSelect.value = preset.selection;
    this.el.fitnessModeSelect.value = preset.fitnessMode;
    this.el.cminusWrap.style.display = preset.fitnessMode === 'min-cminus' ? 'flex' : 'none';
    if (preset.C !== null && preset.C !== undefined) {
      this.el.cminusInput.value = preset.C;
    }
    this.el.elitismToggle.checked = false;

    this.updateDeltas();
    this.updateSelectTitles();

    // In verify mode or preset mode
    if (this.isVerifyMode) {
      this.lockControls();
    }

    this.emitChange();
  }

  setVerifyMode(enabled) {
    this.isVerifyMode = enabled;
    this.el.verifyModeBtn.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    this.el.verifyModeBtn.classList.toggle('btn-accent', enabled);
    this.el.verifyModeBtn.classList.toggle('btn-primary', !enabled);
    this.el.verifyModeBtn.innerHTML = `
      <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:${enabled ? 'var(--color-success)' : 'var(--color-text-muted)'};"></span>
      Verify Mode: ${enabled ? 'ON' : 'OFF'}
    `;

    this.el.cloneFreeBtn.style.display = enabled ? 'inline-flex' : 'none';

    if (enabled) {
      // If currently on free-play, switch to ref-roulette
      if (this.el.presetSelect.value === 'free-play') {
        this.applyPreset('ref-roulette');
      } else {
        this.lockControls();
      }
    } else {
      this.unlockControls();
    }
  }

  lockControls() {
    const inputs = [
      this.el.problemSelect,
      this.el.problemType,
      this.el.precisionSelect,
      this.el.x1Min,
      this.el.x1Max,
      this.el.x2Min,
      this.el.x2Max,
      this.el.popSize,
      this.el.maxGen,
      this.el.pcInput,
      this.el.pmInput,
      this.el.selectionSelect,
      this.el.fitnessModeSelect,
      this.el.cminusInput,
      this.el.elitismToggle,
      this.el.seedInput,
      this.el.reseedBtn
    ];
    for (const inp of inputs) {
      inp.disabled = true;
    }
  }

  unlockControls() {
    const inputs = [
      this.el.problemSelect,
      this.el.problemType,
      this.el.precisionSelect,
      this.el.x1Min,
      this.el.x1Max,
      this.el.x2Min,
      this.el.x2Max,
      this.el.popSize,
      this.el.maxGen,
      this.el.pcInput,
      this.el.pmInput,
      this.el.selectionSelect,
      this.el.fitnessModeSelect,
      this.el.cminusInput,
      this.el.elitismToggle,
      this.el.seedInput,
      this.el.reseedBtn
    ];
    for (const inp of inputs) {
      inp.disabled = false;
    }
  }

  getConfig() {
    const isCustom = this.el.problemSelect.value === 'custom';
    let problemFn = null;
    let problemTitle = '';
    let problemExpr = '';

    if (isCustom) {
      problemFn = this.validateCustomExpr();
      problemTitle = 'Custom Expression';
      problemExpr = this.el.customExprInput.value;
    } else {
      const prob = getProblemById(this.el.problemSelect.value);
      if (prob) {
        problemFn = prob.fn;
        problemTitle = prob.title;
        problemExpr = prob.expression;
      }
    }

    const N = parseInt(this.el.popSize.value, 10);
    // Validate even N
    if (N % 2 !== 0) {
      this.el.popSizeError.classList.add('visible');
    } else {
      this.el.popSizeError.classList.remove('visible');
    }

    const preset = getPresetById(this.el.presetSelect.value);

    return {
      presetId: this.el.presetSelect.value,
      preset: preset || null,
      isVerifyMode: this.isVerifyMode,
      problemId: this.el.problemSelect.value,
      problemTitle,
      problemExpr,
      problemFn,
      problemType: this.el.problemType.value,
      n: parseInt(this.el.precisionSelect.value, 10),
      bounds: this.getBounds(),
      N,
      maxGen: parseInt(this.el.maxGen.value, 10) || 3,
      pc: parseFloat(this.el.pcInput.value) || 0.8,
      pm: parseFloat(this.el.pmInput.value) || 0.05,
      selection: this.el.selectionSelect.value,
      fitnessMode: this.el.fitnessModeSelect.value,
      C: this.el.fitnessModeSelect.value === 'min-cminus' ? parseFloat(this.el.cminusInput.value) : null,
      elitism: this.el.elitismToggle.checked,
      seed: parseInt(this.el.seedInput.value, 10) || 42,
      crossCmp: preset ? preset.crossCmp : '<=',
      mutCmp: preset ? preset.mutCmp : '<=',
      decimals: preset ? preset.decimals : { x1: 2, x2: 2, f: 2, F: 6, p: 5, q: 5 }
    };
  }

  emitChange() {
    this.currentConfig = this.getConfig();
    if (this.onConfigChange) {
      this.onConfigChange(this.currentConfig);
    }
  }
}
