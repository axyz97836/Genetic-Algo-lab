/**
 * js/ui/strips.js - Chromosome Bit Strips Detail View (Phase 3: 3D Chromosomes & Animated Operators).
 * Conforms to SPEC.md §2, §4.3c and Phase 3 Depth-Layered 3D Redesign.
 *
 * Strict Three-Color Palette:
 * --graphite: #101417
 * --stone:    #D8D4C8
 * --lime:     #C6F135
 */

import { STEP_PHASES } from '../engine/engine.js';
import { calculateDeltaX } from '../engine/decode.js';
import {
  splitChromosomeSegments,
  computeCrossoverCutOffset,
  getCrossoverTails,
  detectFlippedBits,
  formatChromosomeAriaAnnouncement
} from './chromosome-3d-helpers.js';

export class ChromosomeStrips {
  constructor(containerId = 'chromosome-strips', announcerId = 'chromosome-live-announcer') {
    this.container = document.getElementById(containerId);
    this.hint = document.getElementById('strip-hint');
    this.liveAnnouncer = document.getElementById(announcerId);
    this.activeTimers = [];
    this.activeRafs = [];
    this.lastStepIndex = null;
    this.lastGenerationIndex = null;
    this.lastPhase = null;
  }

  clearTimers() {
    for (const t of this.activeTimers) {
      clearTimeout(t);
    }
    this.activeTimers = [];
    for (const r of this.activeRafs) {
      cancelAnimationFrame(r);
    }
    this.activeRafs = [];
  }

  isSteppingBackwards(stepRecord) {
    if (!stepRecord || this.lastStepIndex === null) return false;
    const currentStepIdx = stepRecord.stepIndex ?? stepRecord.generationIndex ?? 0;
    const currentGen = stepRecord.generationIndex ?? 0;

    if (currentGen < (this.lastGenerationIndex ?? 0)) return true;
    if (currentGen === this.lastGenerationIndex && currentStepIdx < (this.lastStepIndex ?? 0)) return true;
    return false;
  }

  render(individual, index, stepRecord, n = 4, bounds = [[0, 15], [0, 15]], schemaPattern = null, options = {}) {
    if (!this.container) return;
    this.clearTimers();
    this.container.innerHTML = '';
    this.currentSchemaPattern = schemaPattern;

    if (!individual && !stepRecord) {
      if (this.hint) this.hint.textContent = 'Select an individual to inspect';
      return;
    }

    const phase = stepRecord?.phase;
    const L = 2 * n;
    const [dx1, dx2] = calculateDeltaX(bounds, n);

    // Detect scrubbing or stepping backwards
    const isBack = this.isSteppingBackwards(stepRecord);
    const prefersReducedMotion = typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const animate = !options.instant && !isBack && !prefersReducedMotion;

    // Record step index for next check
    this.lastStepIndex = stepRecord?.stepIndex ?? stepRecord?.generationIndex ?? 0;
    this.lastGenerationIndex = stepRecord?.generationIndex ?? 0;
    this.lastPhase = phase;

    // 1. CROSSOVER PHASE
    if (phase === STEP_PHASES.CROSSOVER && stepRecord.crossoverResults) {
      this.renderCrossoverPairs(stepRecord.crossoverResults, n, L, dx1, dx2, schemaPattern, animate, prefersReducedMotion);
      return;
    }

    // 2. MUTATION PHASE
    if (phase === STEP_PHASES.MUTATE && stepRecord.mutationResult) {
      this.renderMutationInspection(stepRecord.mutationResult, stepRecord.childrenBeforeMutation, n, L, dx1, dx2, index, schemaPattern, animate, prefersReducedMotion);
      return;
    }

    // 3. DEFAULT INSPECTION (Decode / Eval / Selection)
    const chrom = typeof individual === 'string' ? individual : (individual?.chromosome || '');
    if (!chrom || chrom.length < L) return;

    if (this.hint) {
      this.hint.textContent = `Inspecting Individual #${individual?.id || (index + 1)} — L=${L} bits (${n}-bit x1 | ${n}-bit x2)`;
    }

    // Announce accessibility
    if (this.liveAnnouncer) {
      this.liveAnnouncer.textContent = formatChromosomeAriaAnnouncement(phase || 'DECODE_EVAL', {
        id: individual?.id || (index + 1),
        chromosome: chrom
      });
    }

    const stripItem = this.createStripItem({
      title: `Individual #${individual?.id || (index + 1)} (${chrom})`,
      subtitle: `D1=${individual?.D1 ?? '--'}, D2=${individual?.D2 ?? '--'} │ x1=${Number(individual?.x1 ?? 0).toFixed(4)}, x2=${Number(individual?.x2 ?? 0).toFixed(4)}`,
      chromosome: chrom,
      n,
      L,
      dx1,
      dx2,
      schemaPattern,
      prefersReducedMotion
    });

    this.container.appendChild(stripItem);
  }

  renderCrossoverPairs(crossoverResults, n, L, dx1, dx2, schemaPattern, animate, prefersReducedMotion) {
    if (this.hint) {
      this.hint.textContent = `Crossover Operations — ${crossoverResults.length} Pairs Checked (Single-Point 3D Crossover)`;
    }

    // Announce first pair
    if (this.liveAnnouncer && crossoverResults.length > 0) {
      const first = crossoverResults[0];
      this.liveAnnouncer.textContent = formatChromosomeAriaAnnouncement(STEP_PHASES.CROSSOVER, {
        pairIndex: 1,
        p1Idx: first.parent1Idx + 1,
        p2Idx: first.parent2Idx + 1,
        crossed: first.crossed,
        cutPoint: first.cutPoint
      });
    }

    for (const res of crossoverResults) {
      const { pairIndex, parent1Idx, parent2Idx, parent1Chrom, parent2Chrom, crossed, rand, cutPoint, child1Chrom, child2Chrom, flag } = res;

      const card = document.createElement('div');
      card.className = 'strip-item';

      const statusTag = crossed
        ? `<span class="brand-tag" style="background: rgba(198, 241, 53, 0.15); color: var(--lime); border-color: rgba(198, 241, 53, 0.35);">
             Crossed (r=${rand.toFixed(2)}, Cut k=${cutPoint})
           </span>`
        : `<span class="brand-tag" style="background: rgba(216, 212, 200, 0.10); color: var(--stone); border-color: rgba(216, 212, 200, 0.3);">
             Unchanged: No Crossover (r=${rand.toFixed(2)} > pc)
           </span>`;

      card.innerHTML = `
        <div class="strip-header">
          <strong>Pair ${pairIndex}: Parent #${parent1Idx + 1} × Parent #${parent2Idx + 1}</strong>
          ${statusTag}
        </div>
      `;

      // 3D Stage container
      const stage = document.createElement('div');
      stage.className = 'chrom-stage-3d';

      // Parent 1 row (Z = 0px)
      const p1Wrap = this.build3DChromosomeStrand(parent1Chrom, n, L, {
        label: `P#${parent1Idx + 1}`,
        strandClass: 'chrom-strand-p1',
        cutPoint: crossed ? cutPoint : null,
        tailAnimClass: crossed && animate ? 'tail-swapping-p1' : '',
        reducedChangedTail: crossed && prefersReducedMotion,
        schemaPattern
      });
      stage.appendChild(p1Wrap);

      // Parent 2 row (Z = 24px)
      const p2Wrap = this.build3DChromosomeStrand(parent2Chrom, n, L, {
        label: `P#${parent2Idx + 1}`,
        strandClass: 'chrom-strand-p2',
        cutPoint: crossed ? cutPoint : null,
        tailAnimClass: crossed && animate ? 'tail-swapping-p2' : '',
        reducedChangedTail: crossed && prefersReducedMotion,
        schemaPattern
      });
      stage.appendChild(p2Wrap);

      // Lime Cut Line Indicator
      if (crossed && cutPoint) {
        const cutX = computeCrossoverCutOffset(cutPoint, 34, 14, n) + 52; // 52px label offset
        const cutLine = document.createElement('div');
        cutLine.className = 'crossover-cut-line-3d';
        cutLine.style.setProperty('--target-cut-x', `${cutX}px`);

        if (animate) {
          cutLine.classList.add('sweeping');
        } else {
          cutLine.style.left = `${cutX}px`;
        }

        const cutBadge = document.createElement('div');
        cutBadge.className = 'cut-badge';
        cutBadge.style.left = `${cutX}px`;
        cutBadge.textContent = `Cut k=${cutPoint}`;
        stage.appendChild(cutBadge);
        stage.appendChild(cutLine);
      }

      card.appendChild(stage);

      // Offspring result cards
      if (crossed) {
        const offspringWrap = document.createElement('div');
        offspringWrap.className = 'strip-item';
        offspringWrap.style.marginTop = '8px';
        offspringWrap.style.background = 'transparent';

        if (animate) {
          offspringWrap.classList.add('chrom-child-card');
        } else {
          offspringWrap.style.border = '1px solid var(--panel-border)';
        }

        const offspringHeader = document.createElement('div');
        offspringHeader.style.fontSize = '10px';
        offspringHeader.style.fontFamily = 'var(--font-mono)';
        offspringHeader.style.color = 'var(--stone)';
        offspringHeader.style.marginBottom = '6px';
        offspringHeader.textContent = `Offspring after tail swap (cut at k = ${cutPoint}):`;
        offspringWrap.appendChild(offspringHeader);

        const tailPositions = new Set();
        for (let p = cutPoint + 1; p <= L; p++) tailPositions.add(p);

        // Child 1
        offspringWrap.appendChild(this.build3DChromosomeStrand(child1Chrom, n, L, {
          label: 'Child 1',
          swappedPositions: tailPositions,
          schemaPattern
        }));

        // Child 2
        offspringWrap.appendChild(this.build3DChromosomeStrand(child2Chrom, n, L, {
          label: 'Child 2',
          swappedPositions: tailPositions,
          schemaPattern
        }));

        card.appendChild(offspringWrap);
      }

      if (crossed && flag) {
        const flagDiv = document.createElement('div');
        flagDiv.style.fontSize = '11px';
        flagDiv.style.fontFamily = 'var(--font-mono)';
        flagDiv.style.color = 'var(--stone)';
        flagDiv.style.marginTop = '4px';
        flagDiv.textContent = `ℹ ${flag}`;
        card.appendChild(flagDiv);
      }

      this.container.appendChild(card);
    }
  }

  renderMutationInspection(mutationResult, preChildren = [], n, L, dx1, dx2, highlightChildIdx = 0, schemaPattern = null, animate = true, prefersReducedMotion = false) {
    const mutatedChildren = mutationResult.mutatedChildren || [];
    const flips = mutationResult.flips || [];
    const flipsByChild = mutationResult.flipsByChild || Array.from({ length: mutatedChildren.length }, () => []);

    if (this.hint) {
      this.hint.textContent = `Mutation Operations — ${flips.length} Total Bit Flip(s) in CSS 3D`;
    }

    // Announce first flipped child
    if (this.liveAnnouncer) {
      const firstFlip = flips[0];
      this.liveAnnouncer.textContent = formatChromosomeAriaAnnouncement(STEP_PHASES.MUTATE, {
        flipCount: flips.length,
        childIdx: firstFlip ? (firstFlip.childIdx ?? firstFlip.childIndex ?? 1) : 1,
        pos: firstFlip ? (firstFlip.position ?? firstFlip.bitPosition) : null,
        fromVal: firstFlip ? (firstFlip.fromVal ?? '0') : '0',
        toVal: firstFlip ? (firstFlip.toVal ?? '1') : '1',
        delta: firstFlip ? firstFlip.deltaValue : null
      });
    }

    for (let cIdx = 0; cIdx < mutatedChildren.length; cIdx++) {
      const chrom = mutatedChildren[cIdx];
      const preChrom = preChildren[cIdx] || chrom;
      const childFlips = flipsByChild[cIdx] || flips.filter(f => (f.childIdx === cIdx || f.childIndex === cIdx + 1)) || [];

      const card = document.createElement('div');
      card.className = 'strip-item';
      if (cIdx === highlightChildIdx) {
        card.style.borderColor = 'var(--lime)';
      }

      const flipCount = childFlips.length;
      card.innerHTML = `
        <div class="strip-header">
          <strong>Child #${cIdx + 1} (${chrom})</strong>
          <span style="font-size: 11px; color: ${flipCount > 0 ? 'var(--lime)' : 'var(--stone)'}; font-family: var(--font-mono);">
            ${flipCount > 0 ? `★ ${flipCount} bit flip(s)` : '✓ No Mutation (All bits preserved)'}
          </span>
        </div>
      `;

      const flippedPositions = new Map();
      for (const f of childFlips) {
        const pos = f.position ?? f.bitPosition;
        flippedPositions.set(pos, f);
      }

      // Build 3D chromosome row
      const strand = this.build3DChromosomeStrand(chrom, n, L, {
        label: `Child #${cIdx + 1}`,
        preChromosome: preChrom,
        flippedPositions,
        animateMutation: animate && flipCount > 0,
        reducedChangedMutation: prefersReducedMotion && flipCount > 0,
        schemaPattern
      });
      card.appendChild(strand);

      if (childFlips.length > 0) {
        const deltasWrap = document.createElement('div');
        deltasWrap.style.display = 'flex';
        deltasWrap.style.flexDirection = 'column';
        deltasWrap.style.gap = '4px';
        deltasWrap.style.marginTop = '6px';

        for (const flip of childFlips) {
          const deltaSign = flip.deltaValue >= 0 ? '+' : '';
          const weight = flip.weight ?? flip.withinSegmentWeight;
          const pos = flip.position ?? flip.bitPosition;
          const isMSB = weight === n - 1;
          const isLSB = weight === 0;
          const roleText = isMSB ? 'MSB (large domain jump)' : isLSB ? 'LSB (fine-tune)' : `Weight 2^${weight}`;

          const chip = document.createElement('div');
          chip.innerHTML = `
            <span class="delta-badge" style="color: var(--lime); border-color: rgba(198, 241, 53, 0.4);">
              Pos ${pos} (var x${flip.variable}): ±2^${weight}·Δx${flip.variable} = ${deltaSign}${flip.deltaValue.toFixed(4)}
            </span>
            <span style="font-size: 10px; color: var(--color-text-muted); margin-left: 6px;">
              ${roleText}
            </span>
          `;
          deltasWrap.appendChild(chip);
        }
        card.appendChild(deltasWrap);
      }

      this.container.appendChild(card);
    }
  }

  createStripItem({ title, subtitle, chromosome, n, L, dx1, dx2, schemaPattern, prefersReducedMotion }) {
    const item = document.createElement('div');
    item.className = 'strip-item';

    item.innerHTML = `
      <div class="strip-header">
        <strong>${title}</strong>
        <span>${subtitle}</span>
      </div>
    `;

    item.appendChild(this.build3DChromosomeStrand(chromosome, n, L, {
      label: '',
      schemaPattern,
      reducedChangedTail: false
    }));
    return item;
  }

  build3DChromosomeStrand(chromosome, n, L, options = {}) {
    const {
      label = '',
      strandClass = '',
      cutPoint = null,
      tailAnimClass = '',
      reducedChangedTail = false,
      swappedPositions = new Set(),
      flippedPositions = new Map(),
      preChromosome = null,
      animateMutation = false,
      reducedChangedMutation = false,
      schemaPattern = null
    } = options;

    const pattern = schemaPattern || this.currentSchemaPattern;
    const strand = document.createElement('div');
    strand.className = `chrom-strand-3d ${strandClass}`;

    if (label) {
      const lbl = document.createElement('span');
      lbl.style.fontSize = '10px';
      lbl.style.fontFamily = 'var(--font-mono)';
      lbl.style.color = 'var(--stone)';
      lbl.style.width = '48px';
      lbl.textContent = label;
      strand.appendChild(lbl);
    }

    // 8-bit blocks split into two 4-bit segments (x1 | x2)
    for (let pos = 1; pos <= L; pos++) {
      // Insert visible gap between x1 and x2
      if (pos === n + 1) {
        const gap = document.createElement('div');
        gap.className = 'chrom-segment-gap';
        strand.appendChild(gap);
      }

      const bitVal = chromosome[pos - 1] ?? '0';
      const isX1 = pos <= n;
      const weight = isX1 ? (n - pos) : (L - pos);

      const isTail = cutPoint && pos > cutPoint;
      const isSwapped = swappedPositions.has(pos);
      const isFlipped = flippedPositions.has(pos);
      const flipInfo = isFlipped ? flippedPositions.get(pos) : null;
      const isSchemaBitMatch = pattern && pattern[pos - 1] !== '*' && pattern[pos - 1] === bitVal;

      const block = document.createElement('div');
      block.className = `bit-block-3d ${isX1 ? 'seg-x1' : 'seg-x2'}`;

      // Tail swap animation or reduced motion
      if (isTail && tailAnimClass) {
        block.classList.add(tailAnimClass);
      }
      if ((isTail && reducedChangedTail) || (isSwapped && reducedChangedTail) || (isFlipped && reducedChangedMutation)) {
        block.classList.add('reduced-changed');
      }

      // Schema match highlight
      if (isSchemaBitMatch) {
        block.style.borderColor = 'var(--lime)';
      }

      // Mutation Flash Animation & 450ms midpoint value flip
      let displayVal = bitVal;
      if (isFlipped && animateMutation) {
        block.classList.add('mutation-flash');
        const preVal = preChromosome ? (preChromosome[pos - 1] ?? '0') : (bitVal === '1' ? '0' : '1');
        displayVal = preVal; // start with pre-mutation bit

        // Flip bit at midpoint (450ms)
        const timerId = setTimeout(() => {
          const valEl = block.querySelector('.bit-val');
          if (valEl) valEl.textContent = bitVal;
        }, 450);
        this.activeTimers.push(timerId);
      }

      block.innerHTML = `
        <span class="bit-pos">${pos}</span>
        <span class="bit-val">${displayVal}</span>
        <span class="bit-weight">2^${weight}</span>
      `;

      strand.appendChild(block);
    }

    return strand;
  }
}
