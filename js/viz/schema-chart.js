/**
 * js/viz/schema-chart.js - SVG Chart for Holland's Schema Theorem Bounds vs Observed Matching Count.
 * Conforms to SPEC.md §1, §4.5, §5, §9.
 */

export class SchemaBoundsChart {
  constructor(svgId = 'schema-bounds-svg') {
    this.svgId = svgId;
    this.svg = document.getElementById(svgId);
    this.lastData = null;
  }

  /**
   * Renders the schema bound comparison chart.
   * @param {Object} data
   * @param {number[]} data.observedM - Observed matching count per generation [m(1), m(2), ...]
   * @param {number[]} data.textbookBounds - Textbook lower bound aligned at t+1 [null, E[m(2)], ...]
   * @param {number[]} data.exactBounds - Exact-mutation lower bound aligned at t+1 [null, E[m(2)], ...]
   * @param {number} data.N - Population size (Y max)
   * @param {number} data.currentGen - Current generation index (1-based)
   * @param {boolean} data.isTournament - Whether tournament selection is active
   */
  render(data) {
    if (!this.svg) {
      this.svg = document.getElementById(this.svgId);
    }
    if (!this.svg) return;
    this.lastData = data;
    this.svg.innerHTML = '';

    const { observedM = [], textbookBounds = [], exactBounds = [], N = 4, currentGen = 1, isTournament = false } = data;
    const totalGens = Math.max(observedM.length, 2);

    const W = 460;
    const H = 200;
    const margin = { top: 20, right: 30, bottom: 35, left: 35 };
    const plotW = W - margin.left - margin.right;
    const plotH = H - margin.top - margin.bottom;

    this.svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

    const ns = 'http://www.w3.org/2000/svg';

    // Background
    const bg = document.createElementNS(ns, 'rect');
    bg.setAttribute('width', W);
    bg.setAttribute('height', H);
    bg.setAttribute('fill', 'transparent');
    this.svg.appendChild(bg);

    // Coordinate mapping functions
    const getX = (genIdx) => {
      if (totalGens <= 1) return margin.left + plotW / 2;
      return margin.left + ((genIdx - 1) / (totalGens - 1)) * plotW;
    };

    const maxY = Math.max(N, ...observedM, ...textbookBounds.filter(b => b !== null), ...exactBounds.filter(b => b !== null), 1);
    const getY = (val) => {
      const clamped = Math.max(0, Math.min(val, maxY));
      return margin.top + plotH - (clamped / maxY) * plotH;
    };

    // Draw Grid Lines & Y-axis labels
    const yTicks = Math.min(maxY, 4);
    for (let i = 0; i <= yTicks; i++) {
      const val = Math.round((maxY / yTicks) * i);
      const y = getY(val);

      const line = document.createElementNS(ns, 'line');
      line.setAttribute('x1', margin.left);
      line.setAttribute('x2', margin.left + plotW);
      line.setAttribute('y1', y);
      line.setAttribute('y2', y);
      line.setAttribute('stroke', 'rgba(216, 212, 200, 0.12)');
      line.setAttribute('stroke-dasharray', '2,2');
      this.svg.appendChild(line);

      const label = document.createElementNS(ns, 'text');
      label.setAttribute('x', margin.left - 6);
      label.setAttribute('y', y + 3);
      label.setAttribute('text-anchor', 'end');
      label.setAttribute('fill', 'rgba(216, 212, 200, 0.62)');
      label.setAttribute('font-family', 'var(--font-mono)');
      label.setAttribute('font-size', '9px');
      label.textContent = val;
      this.svg.appendChild(label);
    }

    // Draw X-axis Labels (Generations 1..totalGens)
    for (let g = 1; g <= totalGens; g++) {
      const x = getX(g);

      const label = document.createElementNS(ns, 'text');
      label.setAttribute('x', x);
      label.setAttribute('y', margin.top + plotH + 16);
      label.setAttribute('text-anchor', 'center');
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('fill', g === currentGen ? '#C6F135' : 'rgba(216, 212, 200, 0.62)');
      label.setAttribute('font-family', 'var(--font-mono)');
      label.setAttribute('font-size', '9px');
      label.setAttribute('font-weight', g === currentGen ? 'bold' : 'normal');
      label.textContent = `G${g}`;
      this.svg.appendChild(label);
    }

    // Current Generation Marker Line
    if (currentGen >= 1 && currentGen <= totalGens) {
      const curX = getX(currentGen);
      const curLine = document.createElementNS(ns, 'line');
      curLine.setAttribute('x1', curX);
      curLine.setAttribute('x2', curX);
      curLine.setAttribute('y1', margin.top);
      curLine.setAttribute('y2', margin.top + plotH);
      curLine.setAttribute('stroke', 'rgba(198, 241, 53, 0.35)');
      curLine.setAttribute('stroke-width', '1.5');
      this.svg.appendChild(curLine);
    }

    // Helper to draw SVG path
    const drawPath = (points, color, isDashed = false, width = 2) => {
      if (points.length < 2) return null;
      let d = `M ${points[0].x} ${points[0].y}`;
      for (let i = 1; i < points.length; i++) {
        d += ` L ${points[i].x} ${points[i].y}`;
      }
      const path = document.createElementNS(ns, 'path');
      path.setAttribute('d', d);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', color);
      path.setAttribute('stroke-width', width);
      if (isDashed) {
        path.setAttribute('stroke-dasharray', '4,3');
      }
      this.svg.appendChild(path);
      return path;
    };

    // 1. Draw Exact-Mutation Lower Bound (Dashed Stone)
    const exactPts = [];
    for (let g = 2; g <= totalGens; g++) {
      const val = exactBounds[g - 1];
      if (val !== null && val !== undefined) {
        exactPts.push({ x: getX(g), y: getY(val), val, g });
      }
    }
    if (exactPts.length >= 2) {
      drawPath(exactPts, 'rgba(216, 212, 200, 0.62)', true, 1.5);
    }

    // 2. Draw Textbook Lower Bound (Solid Stone)
    const textbookPts = [];
    for (let g = 2; g <= totalGens; g++) {
      const val = textbookBounds[g - 1];
      if (val !== null && val !== undefined) {
        textbookPts.push({ x: getX(g), y: getY(val), val, g });
      }
    }
    if (textbookPts.length >= 2) {
      drawPath(textbookPts, '#D8D4C8', false, 2);
    }

    // 3. Draw Observed m(H, t) (Solid Lime)
    const observedPts = [];
    for (let g = 1; g <= totalGens; g++) {
      const val = observedM[g - 1];
      if (val !== null && val !== undefined) {
        observedPts.push({ x: getX(g), y: getY(val), val, g });
      }
    }
    if (observedPts.length >= 2) {
      drawPath(observedPts, '#C6F135', false, 2.5);
    }

    // Draw Data Dots & Tooltips
    // Exact Bound dots (diamonds or small circles)
    exactPts.forEach(pt => {
      const dot = document.createElementNS(ns, 'circle');
      dot.setAttribute('cx', pt.x);
      dot.setAttribute('cy', pt.y);
      dot.setAttribute('r', '3');
      dot.setAttribute('fill', 'rgba(216, 212, 200, 0.62)');
      dot.setAttribute('stroke', '#101417');
      dot.setAttribute('stroke-width', '1');
      const title = document.createElementNS(ns, 'title');
      title.textContent = `Gen ${pt.g} Exact Bound: ≥ ${pt.val.toFixed(3)}`;
      dot.appendChild(title);
      this.svg.appendChild(dot);
    });

    // Textbook Bound dots
    textbookPts.forEach(pt => {
      const dot = document.createElementNS(ns, 'circle');
      dot.setAttribute('cx', pt.x);
      dot.setAttribute('cy', pt.y);
      dot.setAttribute('r', '3.5');
      dot.setAttribute('fill', '#D8D4C8');
      dot.setAttribute('stroke', '#101417');
      dot.setAttribute('stroke-width', '1');
      const title = document.createElementNS(ns, 'title');
      title.textContent = `Gen ${pt.g} Textbook Bound: ≥ ${pt.val.toFixed(3)}`;
      dot.appendChild(title);
      this.svg.appendChild(dot);
    });

    // Observed m(H) dots
    observedPts.forEach(pt => {
      const dot = document.createElementNS(ns, 'circle');
      dot.setAttribute('cx', pt.x);
      dot.setAttribute('cy', pt.y);
      dot.setAttribute('r', pt.g === currentGen ? '5' : '4');
      dot.setAttribute('fill', '#C6F135');
      dot.setAttribute('stroke', pt.g === currentGen ? '#D8D4C8' : '#101417');
      dot.setAttribute('stroke-width', pt.g === currentGen ? '2' : '1');
      const title = document.createElementNS(ns, 'title');
      title.textContent = `Gen ${pt.g} Observed m(H): ${pt.val}`;
      dot.appendChild(title);
      this.svg.appendChild(dot);
    });

    // Check if any observed point falls below bound
    let anyBelowBound = false;
    for (let g = 2; g <= totalGens; g++) {
      const obs = observedM[g - 1];
      const tb = textbookBounds[g - 1];
      if (obs !== null && obs !== undefined && tb !== null && tb !== undefined) {
        if (obs < tb - 1e-4) {
          anyBelowBound = true;
          break;
        }
      }
    }

    // Legend & Disclaimers rendered via accompanying DOM/HTML below SVG
    const noteEl = document.getElementById('schema-chart-note');
    if (noteEl) {
      const notes = [];
      if (isTournament) {
        notes.push('<strong>Note:</strong> Proportionate-selection bound (reference only) — Holland\'s Schema Theorem assumes fitness-proportionate selection.');
      }
      if (anyBelowBound) {
        notes.push('<strong>Single-run variance:</strong> Theoretical bounds are expectations; individual stochastic runs can fall below them.');
      }
      noteEl.innerHTML = notes.join('<br>');
      noteEl.style.display = notes.length > 0 ? 'block' : 'none';
    }
  }
}
