/**
 * js/ui/narration.js - Educational Narration Engine with Theory Disclosures.
 * Conforms to SPEC.md §3, §4.3f, and ga-lab-product-polish.
 */

import { STEP_PHASES } from '../engine/engine.js';

export class NarrationManager {
  constructor(cardId = 'narration-card', alertContainerId = 'alert-container') {
    this.card = document.getElementById(cardId);
    this.titleEl = document.getElementById('narration-title');
    this.bodyEl = document.getElementById('narration-body');
    this.mathEl = document.getElementById('narration-math');
    this.whyDetails = document.getElementById('narration-why');
    this.whyTextEl = document.getElementById('narration-why-text');
    this.alertContainer = document.getElementById(alertContainerId);
    this.genBadge = document.getElementById('gen-badge');
    this.stepNameBadge = document.getElementById('step-name-badge');
    this.stepStats = document.getElementById('step-stats');
    this.stepper = document.getElementById('phase-stepper');
  }

  update(stepRecord, config = {}, onAction = null) {
    if (!stepRecord) return;
    this.alertContainer.innerHTML = '';

    const phase = stepRecord.phase;
    const genIdx = stepRecord.generationIndex ?? 1;

    // Update badges
    if (this.genBadge) this.genBadge.textContent = `Generation ${genIdx}`;
    if (this.stepNameBadge) this.stepNameBadge.textContent = this.formatPhaseName(phase);

    // Update Phase Stepper
    if (this.stepper) {
      const steps = this.stepper.querySelectorAll('.phase-step');
      steps.forEach(s => {
        const p = s.dataset.phase;
        s.classList.toggle('active', p === phase);
      });
    }

    // Update Stats Display
    const stats = stepRecord.stats || stepRecord.evaluation?.stats || stepRecord.nextGenEvaluation?.stats;
    if (stats && this.stepStats) {
      const b = typeof stats.bestF === 'number' ? stats.bestF.toFixed(4) : '--';
      const a = typeof stats.avgF === 'number' ? stats.avgF.toFixed(4) : '--';
      const w = typeof stats.worstF === 'number' ? stats.worstF.toFixed(4) : '--';
      this.stepStats.textContent = `Best f: ${b} | Avg f: ${a} | Worst f: ${w}`;
    }

    // Render phase specific narration
    switch (phase) {
      case STEP_PHASES.INIT:
      case STEP_PHASES.DECODE_EVAL:
        this.renderDecodeEvalNarration(stepRecord, config);
        break;
      case STEP_PHASES.SELECT:
        this.renderSelectNarration(stepRecord, config, onAction);
        break;
      case STEP_PHASES.CROSSOVER:
        this.renderCrossoverNarration(stepRecord, config);
        break;
      case STEP_PHASES.MUTATE:
        this.renderMutateNarration(stepRecord, config);
        break;
      case STEP_PHASES.REPLACE:
        this.renderReplaceNarration(stepRecord, config);
        break;
      default:
        this.titleEl.textContent = `Phase: ${phase}`;
        this.bodyEl.textContent = 'Executing algorithm cycle...';
        this.mathEl.style.display = 'none';
        this.whyTextEl.textContent = '';
    }
  }

  formatPhaseName(phase) {
    switch (phase) {
      case STEP_PHASES.INIT: return 'INITIALIZATION';
      case STEP_PHASES.DECODE_EVAL: return 'DECODE & EVALUATION';
      case STEP_PHASES.SELECT: return 'SELECTION (MATING POOL)';
      case STEP_PHASES.CROSSOVER: return 'CROSSOVER (RECOMBINATION)';
      case STEP_PHASES.MUTATE: return 'MUTATION (VARIATION)';
      case STEP_PHASES.REPLACE: return 'GENERATIONAL REPLACEMENT';
      default: return phase;
    }
  }

  renderDecodeEvalNarration(record, config) {
    const pop = record.population || [];
    const stats = record.stats;
    const n = config.n || 4;

    this.titleEl.innerHTML = `<span>1. Genotype Decoding & Phenotype Evaluation</span>`;
    this.bodyEl.innerHTML = `
      Each chromosome of length <strong>L = ${2 * n}</strong> is partitioned into two <strong>${n}-bit</strong> segments.
      Integer values <code>D1</code> and <code>D2</code> map to coordinates <code>(x1, x2)</code> via discrete step sizes
      <code>Δx1 = ${(config.bounds?.[0] ? (config.bounds[0][1] - config.bounds[0][0]) / ((1 << n) - 1) : 1).toFixed(4)}</code>,
      evaluating objective function <code>f(x1, x2)</code>.
    `;

    this.mathEl.style.display = 'block';
    this.mathEl.innerHTML = `
      x_j = xmin_j + D_j · Δx_j,  where Δx_j = (xmax_j − xmin_j) / (2^n − 1)<br>
      Evaluated ${pop.length} individuals: Best f = ${stats.bestF?.toFixed(4)}, Avg f = ${stats.avgF?.toFixed(4)}, Distinct = ${stats.distinctCount}
    `;

    this.whyTextEl.textContent = `
      Genetic algorithms operate on representations (genotypes: bitstrings), but the problem landscape exists in phenotype space (real continuous coordinates). Decoding establishes this bridge, and fitness transforms raw objective scores into non-negative reproductive weights.
    `;
  }

  renderSelectNarration(record, config, onAction) {
    const scheme = record.selectionScheme || config.selection;

    if (record.isInvalidNegativeFitness) {
      this.titleEl.innerHTML = `<span style="color: var(--color-danger);">⚠ Invalid Selection: Negative Fitness Detected</span>`;
      this.bodyEl.innerHTML = `
        Roulette wheel selection requires all fitness values <code>F_i ≥ 0</code> and sum <code>ΣF > 0</code>.
        At least one individual produced negative fitness, making probability division mathematically invalid.
      `;
      this.mathEl.style.display = 'block';
      this.mathEl.innerHTML = `F_min = ${record.minFitness?.toFixed(4)}, ΣF = ${record.sumF?.toFixed(4)} &lt; 0`;

      this.renderNegativeFitnessAlert(record, onAction);
      this.whyTextEl.textContent = `
        Roulette wheel selection represents roulette slice angles proportional to F_i / ΣF. Negative slices cannot be represented on a probability circle.
      `;
      return;
    }

    if (scheme === 'roulette') {
      const spins = record.rouletteSpins || [];
      const winners = record.selectedIndices?.map(i => `#${i + 1}`).join(', ') || '';
      this.titleEl.innerHTML = `<span>2. Roulette Wheel Selection (Fitness Proportionate)</span>`;
      this.bodyEl.innerHTML = `
        Spun roulette wheel <strong>${spins.length} times</strong> with random draws <code>[${spins.map(s => s.toFixed(2)).join(', ')}]</code>.
        Selected mating pool individuals: <strong>${winners}</strong>.
      `;
      this.mathEl.style.display = 'block';
      this.mathEl.innerHTML = `
        p_i = F_i / ΣF (ΣF = ${record.sumF?.toFixed(6)})<br>
        Cumulative distribution q_i partitioned [0, 1]. Random draw r lands in slice [q_{i-1}, q_i].
      `;
      this.whyTextEl.textContent = `
        Fitness-proportionate selection guarantees that individuals with higher fitness have an expected number of copies in the mating pool proportional to their relative superiority, driving search toward promising regions.
      `;
    } else {
      const tourns = record.tournaments || [];
      this.titleEl.innerHTML = `<span>2. Binary Tournament Selection</span>`;
      this.bodyEl.innerHTML = `
        Conducted <strong>${tourns.length} pairwise tournaments</strong>. Contenders drawn with replacement;
        individual with better objective value (${config.problemType === 'min' ? 'lower' : 'higher'}) advances to the mating pool.
      `;
      this.mathEl.style.display = 'block';
      this.mathEl.innerHTML = tourns.map((t, idx) => {
        const i = t.i ?? t.pair0Based?.[0] ?? 0;
        const j = t.j ?? t.pair0Based?.[1] ?? 0;
        const fi = t.fi ?? t.fValues?.[0];
        const fj = t.fj ?? t.fValues?.[1];
        const winner = t.winnerIndex ?? t.winnerIdx0Based ?? 0;
        const fiStr = typeof fi === 'number' ? fi.toFixed(2) : '--';
        const fjStr = typeof fj === 'number' ? fj.toFixed(2) : '--';
        return `Round ${idx + 1}: #${i + 1} (f=${fiStr}) vs #${j + 1} (f=${fjStr}) → Winner: #${winner + 1}`;
      }).join('<br>');
      this.whyTextEl.textContent = `
        Tournament selection requires only pairwise ordinal comparisons rather than global fitness normalization, making it naturally immune to negative fitness values and scaling issues.
      `;
    }
  }

  renderNegativeFitnessAlert(record, onAction) {
    const alert = document.createElement('div');
    alert.className = 'alert-card';
    alert.innerHTML = `
      <div class="alert-title">⚠ Selection Halted: F &lt; 0 Detected</div>
      <div class="alert-msg">
        Under standard roulette wheel selection, negative fitness produces inverted or negative slice probabilities.
        Choose an action below to resolve:
      </div>
      <div class="alert-actions">
        <button id="apply-shift-btn" class="btn btn-primary" style="font-size: 11px;">
          Apply Linear Shift C_shift (${record.linearShift?.C_shift?.toFixed(2) || 'auto'})
        </button>
        <button id="switch-tourn-btn" class="btn btn-secondary" style="font-size: 11px;">
          Switch to Tournament Selection
        </button>
      </div>
    `;

    this.alertContainer.appendChild(alert);

    const shiftBtn = alert.querySelector('#apply-shift-btn');
    const tournBtn = alert.querySelector('#switch-tourn-btn');

    if (shiftBtn && onAction) {
      shiftBtn.addEventListener('click', () => onAction('apply-shift', record));
    }
    if (tournBtn && onAction) {
      tournBtn.addEventListener('click', () => onAction('switch-tournament', record));
    }
  }

  renderCrossoverNarration(record, config) {
    const results = record.crossoverResults || [];
    const crossedCount = results.filter(r => r.crossed).length;

    this.titleEl.innerHTML = `<span>3. Single-Point Crossover (Recombination)</span>`;
    this.bodyEl.innerHTML = `
      Paired consecutive mating pool individuals into <strong>${results.length} pairs</strong>.
      With crossover rate <code>p_c = ${config.pc}</code>, <strong>${crossedCount} pairs crossed</strong> and 
      <strong>${results.length - crossedCount} pairs copied intact</strong>.
    `;

    this.mathEl.style.display = 'block';
    this.mathEl.innerHTML = results.map(r =>
      `Pair ${r.pairIndex}: rand = ${r.rand.toFixed(2)} ${r.crossed ? `≤ ${config.pc} → Cut k=${r.cutPoint}` : `> ${config.pc} (No cross)`}`
    ).join('<br>');

    this.whyTextEl.textContent = `
      Crossover is the principal exploratory operator in GAs. By swapping segments between fit parents, it combines promising sub-solutions (schemas) into new combinations, searching hyperplanes of the solution space.
    `;
  }

  renderMutateNarration(record, config) {
    const flips = record.flips || record.mutationResult?.flips || [];
    const totalDraws = record.allDraws?.length || record.mutationResult?.totalDraws || (config.N * (config.n || 4) * 2);

    this.titleEl.innerHTML = `<span>4. Bit-Flip Mutation (Genetic Diversity)</span>`;
    this.bodyEl.innerHTML = `
      Tested every bit of all children in child-major, bit-major order (<strong>${totalDraws} independent draws</strong>)
      against mutation rate <code>p_m = ${config.pm}</code>. Produced <strong>${flips.length} bit flip(s)</strong>.
    `;

    this.mathEl.style.display = 'block';
    if (flips.length > 0) {
      this.mathEl.innerHTML = flips.map(f =>
        `Child #${f.childIndex + 1}, Pos ${f.position}: flipped ${f.oldBit} → ${f.newBit} (Var x${f.variable}, weight 2^${f.weight}, Δvalue = ${f.deltaValue >= 0 ? '+' : ''}${f.deltaValue.toFixed(4)})`
      ).join('<br>');
    } else {
      this.mathEl.innerHTML = `No bits flipped (all random draws &gt; ${config.pm}). Population alleles preserved.`;
    }

    this.whyTextEl.textContent = `
      Mutation acts as background insurance against permanent loss of genetic alleles. A bit flip on the MSB (w = n-1) causes a large jump across the search domain, whereas an LSB flip (w = 0) fine-tunes the solution locally.
    `;
  }

  renderReplaceNarration(record, config) {
    const elitism = record.elitismApplied;

    this.titleEl.innerHTML = `<span>5. Generational Replacement</span>`;
    this.bodyEl.innerHTML = `
      Replaced old population with mutated offspring to form <strong>Generation ${record.nextGenerationIndex}</strong>.
      ${elitism ? `<strong>Elitism Applied:</strong> Best parent #${record.eliteParentChrom} replaced the worst offspring.` : 'Standard generational replacement: all offspring become the new population.'}
    `;

    const stats = record.nextGenEvaluation?.stats;
    this.mathEl.style.display = 'block';
    this.mathEl.innerHTML = `
      Next Gen Initial Stats: Best f = ${stats?.bestF?.toFixed(4)}, Avg f = ${stats?.avgF?.toFixed(4)}, Worst f = ${stats?.worstF?.toFixed(4)}
    `;

    this.whyTextEl.textContent = `
      Generational replacement advances evolutionary time. When elitism is enabled, the best fitness value is guaranteed to be monotonically non-worsening across generations, protecting top solutions from destructive crossover or mutation.
    `;
  }
}
