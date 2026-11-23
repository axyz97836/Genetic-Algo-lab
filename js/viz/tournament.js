/**
 * js/viz/tournament.js - Interactive Binary Tournament Bracket Cards.
 * Conforms to SPEC.md §2, §4.3d, and ga-lab-data-visualization guidelines.
 */

export class TournamentVisualizer {
  constructor(containerId = 'tournament-bracket') {
    this.container = document.getElementById(containerId);
  }

  render(stepRecord, config) {
    if (!this.container) return;
    this.container.innerHTML = '';

    const tourns = stepRecord?.tournaments || stepRecord?.selectionResult?.tournaments || stepRecord?.selectionResult?.rounds || [];
    const pop = stepRecord?.population || [];
    const isMin = config?.problemType === 'min';

    if (tourns.length === 0) {
      this.container.innerHTML = `
        <div style="font-size: 11px; color: var(--color-text-muted); text-align: center; padding: 16px;">
          No tournament matches recorded for this step.
        </div>
      `;
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'tournament-grid';

    for (let r = 0; r < tourns.length; r++) {
      const match = tourns[r];
      const i = match.i ?? match.pair0Based?.[0] ?? 0;
      const j = match.j ?? match.pair0Based?.[1] ?? 0;
      const fi = match.fi ?? match.fValues?.[0] ?? (pop[i]?.f);
      const fj = match.fj ?? match.fValues?.[1] ?? (pop[j]?.f);
      const winnerIndex = match.winnerIndex ?? match.winnerIdx0Based ?? (match.winnerIdx1Based ? match.winnerIdx1Based - 1 : 0);
      const chrom1 = match.chrom1 || pop[i]?.chromosome || '';
      const chrom2 = match.chrom2 || pop[j]?.chromosome || '';

      const isC1Winner = winnerIndex === i;
      const isC2Winner = winnerIndex === j;

      const card = document.createElement('div');
      card.className = 'tourn-card';

      card.innerHTML = `
        <div class="tourn-card-header">
          <span>Match ${r + 1}</span>
          <span style="font-size: 9px; color: var(--color-text-muted);">
            Direction: ${isMin ? 'Min (Lower f)' : 'Max (Higher f)'}
          </span>
        </div>

        <div class="tourn-contenders">
          <!-- Contender 1 -->
          <div class="tourn-contender ${isC1Winner ? 'winner' : 'loser'}">
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <strong>#${i + 1}</strong>
              ${isC1Winner ? '<span class="tourn-badge-win">WINNER</span>' : ''}
            </div>
            <div class="tourn-chrom">${match.chrom1 || ''}</div>
            <div class="tourn-score">f = ${typeof fi === 'number' ? fi.toFixed(3) : '--'}</div>
          </div>

          <div class="tourn-vs">VS</div>

          <!-- Contender 2 -->
          <div class="tourn-contender ${isC2Winner && !isC1Winner ? 'winner' : (isC1Winner ? 'loser' : 'winner')}">
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <strong>#${j + 1}</strong>
              ${!isC1Winner && isC2Winner ? '<span class="tourn-badge-win">WINNER</span>' : ''}
            </div>
            <div class="tourn-chrom">${match.chrom2 || ''}</div>
            <div class="tourn-score">f = ${typeof fj === 'number' ? fj.toFixed(3) : '--'}</div>
          </div>
        </div>

        <div class="tourn-footer">
          <span>Advances to Mating Pool: <strong>#${winnerIndex + 1}</strong></span>
        </div>
      `;

      grid.appendChild(card);
    }

    this.container.appendChild(grid);
  }
}
