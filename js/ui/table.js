/**
 * js/ui/table.js - Population Table with Progressive Column Disclosure.
 * Conforms to SPEC.md §4.3b, §5.
 */

import { STEP_PHASES } from '../engine/engine.js';

export class PopulationTable {
  constructor(containerEl, onSelectIndividual) {
    this.tbody = document.getElementById('population-table-body');
    this.table = document.getElementById('population-table');
    this.onSelectIndividual = onSelectIndividual;
    this.selectedRowIdx = 0;
  }

  formatNumber(val, decimals = 4) {
    if (val === null || val === undefined || Number.isNaN(val)) return '--';
    if (Number.isInteger(val) && decimals === 0) return val.toString();
    return Number(val).toFixed(decimals);
  }

  render(stepRecord, decimalsConfig = {}, n = 4, verifyResults = null, schemaMatches = null) {
    if (!stepRecord) return;
    this.tbody.innerHTML = '';

    const phase = stepRecord.phase;
    this.updateColumnHighlights(phase);

    let popList = [];
    if (phase === STEP_PHASES.DECODE_EVAL || phase === STEP_PHASES.INIT) {
      popList = stepRecord.population || [];
    } else if (phase === STEP_PHASES.SELECT) {
      popList = stepRecord.evaluation?.individuals || [];
    } else if (phase === STEP_PHASES.CROSSOVER) {
      popList = stepRecord.matingPool || [];
    } else if (phase === STEP_PHASES.MUTATE) {
      popList = stepRecord.preMutationChildren || [];
    } else if (phase === STEP_PHASES.REPLACE) {
      popList = stepRecord.nextGenEvaluation?.individuals || [];
    }

    const decX1 = decimalsConfig.x1 ?? 2;
    const decX2 = decimalsConfig.x2 ?? 2;
    const decF = decimalsConfig.f ?? 2;
    const decFit = decimalsConfig.F ?? 6;
    const decP = decimalsConfig.p ?? 5;
    const decQ = decimalsConfig.q ?? 5;

    const renderMark = (i, f) => {
      if (!verifyResults || !verifyResults[i] || !verifyResults[i][f]) return '';
      const cmp = verifyResults[i][f];
      if (cmp.isExcluded) return '';
      const title = `Expected: ${cmp.expected} | Actual: ${cmp.actual}${cmp.tol !== undefined ? ` (tol: ${cmp.tol.toFixed(6)})` : ''}`;
      return `<span class="verify-cell-mark ${cmp.status}" title="${title}">${cmp.label}</span>`;
    };

    for (let i = 0; i < popList.length; i++) {
      const ind = popList[i];
      const tr = document.createElement('tr');
      tr.dataset.idx = i;
      if (i === this.selectedRowIdx) {
        tr.classList.add('selected');
      }

      // Check if matches active schema (Phase 6 Schema X-Ray)
      if (schemaMatches && schemaMatches.includes(i)) {
        tr.classList.add('schema-match-row');
      }

      // Check if best in stats
      const isBest = (stepRecord.stats && stepRecord.stats.bestIdx === i) ||
                     (stepRecord.evaluation?.stats && stepRecord.evaluation.stats.bestIdx === i);
      if (isBest) {
        tr.classList.add('best-row');
      }

      // Split chromosome
      const chrom = ind.chromosome || ind;
      const seg1 = typeof chrom === 'string' ? chrom.slice(0, n) : '--';
      const seg2 = typeof chrom === 'string' ? chrom.slice(n) : '--';

      // Selection probabilities
      const pi = stepRecord.probabilities ? stepRecord.probabilities[i] : (ind.pi ?? null);
      const qi = stepRecord.cumulativeProbabilities ? stepRecord.cumulativeProbabilities[i] : (ind.qi ?? null);

      tr.innerHTML = `
        <td style="color: var(--color-text-muted); font-weight: 600;">${ind.id || (i + 1)}</td>
        <td class="cell-chrom">
          <span class="chrom-seg-x1" title="x1 segment (bits 1..${n})">${seg1}</span>
          <span class="chrom-seg-x2" title="x2 segment (bits ${n+1}..${2*n})">${seg2}</span>
        </td>
        <td class="col-disclose col-d">${ind.D1 !== undefined ? ind.D1 : '--'}${renderMark(i, 'D1')}</td>
        <td class="col-disclose col-d">${ind.D2 !== undefined ? ind.D2 : '--'}${renderMark(i, 'D2')}</td>
        <td class="col-disclose col-x">${this.formatNumber(ind.x1, decX1)}${renderMark(i, 'x1')}</td>
        <td class="col-disclose col-x">${this.formatNumber(ind.x2, decX2)}${renderMark(i, 'x2')}</td>
        <td class="col-disclose col-f" style="font-weight: 600; color: ${isBest ? 'var(--color-success)' : 'inherit'};">
          ${this.formatNumber(ind.f, decF)}${renderMark(i, 'f')}
        </td>
        <td class="col-disclose col-fit">${this.formatNumber(ind.F, decFit)}${renderMark(i, 'F')}</td>
        <td class="col-disclose col-prob">${this.formatNumber(pi, decP)}${renderMark(i, 'p')}</td>
        <td class="col-disclose col-prob">${this.formatNumber(qi, decQ)}${renderMark(i, 'q')}</td>
      `;

      tr.addEventListener('click', () => {
        this.selectedRowIdx = i;
        const allRows = this.tbody.querySelectorAll('tr');
        allRows.forEach(r => r.classList.remove('selected'));
        tr.classList.add('selected');
        if (this.onSelectIndividual) {
          this.onSelectIndividual(ind, i, stepRecord);
        }
      });

      this.tbody.appendChild(tr);
    }

    // Trigger selection for the currently selected row
    if (popList.length > 0 && this.onSelectIndividual) {
      const activeIdx = Math.min(this.selectedRowIdx, popList.length - 1);
      this.onSelectIndividual(popList[activeIdx], activeIdx, stepRecord);
    }
  }

  updateColumnHighlights(phase) {
    const allHeaders = this.table.querySelectorAll('th.col-disclose');
    allHeaders.forEach(th => th.classList.remove('newly-active'));

    const highlightClasses = [];
    if (phase === STEP_PHASES.DECODE_EVAL || phase === STEP_PHASES.INIT) {
      highlightClasses.push('.col-d', '.col-x', '.col-f', '.col-fit');
    } else if (phase === STEP_PHASES.SELECT) {
      highlightClasses.push('.col-fit', '.col-prob');
    }

    for (const cls of highlightClasses) {
      const targets = this.table.querySelectorAll(`th${cls}`);
      targets.forEach(th => th.classList.add('newly-active'));
    }
  }
}
