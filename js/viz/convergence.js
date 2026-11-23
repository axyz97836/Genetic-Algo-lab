/**
 * js/viz/convergence.js - Native SVG Convergence & Diversity Chart.
 * Conforms to SPEC.md §4.3e, §6 P3, and UI Redesign (Strict 3-Color Palette):
 * - Best = Lime solid (#C6F135, 2.5px)
 * - Avg = Stone solid (#D8D4C8, 1.5px)
 * - Worst = Stone dashed (#D8D4C8, 1.0px, dash 4,4)
 * - Div = Stone dotted (Stone @ 62%, 1.5px, dash 2,3)
 * - Axis labels = Stone @ 62%, text >= 11px
 * - Zero fourth hues
 */

export class ConvergenceChart {
  constructor(svgContainerId = 'convergence-chart-svg') {
    this.svg = document.getElementById(svgContainerId);
    this.width = 540;
    this.height = 240;
    this.margin = { top: 26, right: 36, bottom: 40, left: 56 };
    this.validData = [];
    this.hoverIndex = null;

    this.bindEvents();
  }

  bindEvents() {
    if (!this.svg) return;
    this.svg.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    this.svg.addEventListener('mouseleave', () => this.handleMouseLeave());
  }

  render(history, currentGen = 1) {
    if (!this.svg) return;
    this.svg.innerHTML = '';

    if (!history || history.length === 0) {
      this.renderEmptyState();
      return;
    }

    const plotW = this.width - this.margin.left - this.margin.right;
    const plotH = this.height - this.margin.top - this.margin.bottom;
    this.plotW = plotW;
    this.plotH = plotH;

    const validData = history
      .filter(item => item && item.stats && typeof item.stats.bestF === 'number' && item.generationIndex <= currentGen)
      .map(item => ({
        gen: item.generationIndex,
        bestF: item.stats.bestF,
        avgF: item.stats.avgF,
        worstF: item.stats.worstF,
        diversity: item.stats.distinctCount || 0
      }));

    this.validData = validData;

    if (validData.length === 0) {
      this.renderEmptyState();
      return;
    }

    // Determine Y-scale range (f)
    let minVal = Infinity;
    let maxVal = -Infinity;
    let maxDiv = 4;

    for (const d of validData) {
      if (d.bestF < minVal) minVal = d.bestF;
      if (d.worstF < minVal) minVal = d.worstF;
      if (d.avgF < minVal) minVal = d.avgF;

      if (d.bestF > maxVal) maxVal = d.bestF;
      if (d.worstF > maxVal) maxVal = d.worstF;
      if (d.avgF > maxVal) maxVal = d.avgF;

      if (d.diversity > maxDiv) maxDiv = d.diversity;
    }

    // Add 10% padding to range
    if (minVal === maxVal) {
      minVal -= 1;
      maxVal += 1;
    } else {
      const pad = (maxVal - minVal) * 0.1;
      minVal -= pad;
      maxVal += pad;
    }

    this.minVal = minVal;
    this.maxVal = maxVal;
    this.maxDiv = maxDiv;

    const yRange = maxVal - minVal;
    const maxGenVal = Math.max(1, validData[validData.length - 1].gen);
    this.maxGenVal = maxGenVal;

    // Coordinate mapping functions
    const mapX = (gen) => {
      if (maxGenVal <= 1) return this.margin.left + plotW / 2;
      return this.margin.left + ((gen - 1) / (maxGenVal - 1)) * plotW;
    };
    const mapY = (f) => this.margin.top + plotH - ((f - minVal) / yRange) * plotH;
    const mapYDiv = (div) => this.margin.top + plotH - (div / maxDiv) * plotH;

    this.mapX = mapX;
    this.mapY = mapY;
    this.mapYDiv = mapYDiv;

    // 1. Grid lines and axes (All text >= 11px)
    this.renderAxes(plotW, plotH, minVal, maxVal, maxGenVal, maxDiv, validData);

    // 2. Range Band Polygon (Worst -> Best) in faint Stone tint
    if (validData.length > 1) {
      let bandD = `M ${mapX(validData[0].gen)} ${mapY(validData[0].worstF)}`;
      for (let i = 1; i < validData.length; i++) {
        bandD += ` L ${mapX(validData[i].gen)} ${mapY(validData[i].worstF)}`;
      }
      for (let i = validData.length - 1; i >= 0; i--) {
        bandD += ` L ${mapX(validData[i].gen)} ${mapY(validData[i].bestF)}`;
      }
      bandD += ' Z';

      const bandPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      bandPath.setAttribute('d', bandD);
      bandPath.setAttribute('fill', 'rgba(216, 212, 200, 0.06)');
      this.svg.appendChild(bandPath);
    }

    // 3. Lines: Worst (Stone dashed), Average (Stone solid), Best (Lime solid)
    this.renderLine(validData, d => mapX(d.gen), d => mapY(d.worstF), '#D8D4C8', 1.0, '4,4');
    this.renderLine(validData, d => mapX(d.gen), d => mapY(d.avgF), '#D8D4C8', 1.5, 'none');
    this.renderLine(validData, d => mapX(d.gen), d => mapY(d.bestF), '#C6F135', 2.5, 'none');

    // 4. Line: Diversity (Stone dotted at 62%)
    this.renderLine(validData, d => mapX(d.gen), d => mapYDiv(d.diversity), 'rgba(216, 212, 200, 0.62)', 1.5, '2,3');

    // 5. Data Points for Best in Lime
    for (const d of validData) {
      const bx = mapX(d.gen);
      const by = mapY(d.bestF);
      this.renderPoint(bx, by, '#C6F135', 3.5);
    }

    // 6. Draw Hover Crosshair and Card if active
    if (this.hoverIndex !== null && validData[this.hoverIndex]) {
      this.drawHoverCard(validData[this.hoverIndex], plotH);
    }
  }

  renderLine(data, getX, getY, strokeColor, strokeWidth, dashArray = 'none') {
    if (data.length === 0) return;

    let pathD = `M ${getX(data[0])} ${getY(data[0])}`;
    for (let i = 1; i < data.length; i++) {
      pathD += ` L ${getX(data[i])} ${getY(data[i])}`;
    }

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathD);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', strokeColor);
    path.setAttribute('stroke-width', strokeWidth);
    if (dashArray !== 'none') {
      path.setAttribute('stroke-dasharray', dashArray);
    }
    this.svg.appendChild(path);
  }

  renderPoint(cx, cy, color, r = 3) {
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', cx);
    circle.setAttribute('cy', cy);
    circle.setAttribute('r', r);
    circle.setAttribute('fill', color);
    circle.setAttribute('stroke', '#101417');
    circle.setAttribute('stroke-width', '1.5');
    this.svg.appendChild(circle);
  }

  renderAxes(plotW, plotH, minVal, maxVal, maxGenVal, maxDiv, validData) {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');

    const x0 = this.margin.left;
    const y0 = this.margin.top + plotH;
    const x1 = this.margin.left + plotW;
    const y1 = this.margin.top;

    // Horizontal grid ticks (min, mid, max)
    const ticks = [minVal, (minVal + maxVal) / 2, maxVal];
    for (const t of ticks) {
      const ty = y1 + plotH - ((t - minVal) / (maxVal - minVal)) * plotH;

      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', x0);
      line.setAttribute('y1', ty);
      line.setAttribute('x2', x1);
      line.setAttribute('y2', ty);
      line.setAttribute('stroke', 'rgba(216, 212, 200, 0.12)');
      line.setAttribute('stroke-dasharray', '2,2');
      g.appendChild(line);

      // Y-axis tick label in Stone at 62%, >= 11px
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', x0 - 8);
      text.setAttribute('y', ty + 4);
      text.setAttribute('text-anchor', 'end');
      text.setAttribute('font-family', 'var(--font-mono)');
      text.setAttribute('font-size', '11px');
      text.setAttribute('fill', 'rgba(216, 212, 200, 0.62)');
      text.textContent = t.toFixed(1);
      g.appendChild(text);
    }

    // X-axis border line
    const axisLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    axisLine.setAttribute('x1', x0);
    axisLine.setAttribute('y1', y0);
    axisLine.setAttribute('x2', x1);
    axisLine.setAttribute('y2', y0);
    axisLine.setAttribute('stroke', 'rgba(216, 212, 200, 0.25)');
    g.appendChild(axisLine);

    // Generation ticks on X axis in Stone at 62%, >= 11px
    for (const d of validData) {
      const tx = maxGenVal <= 1 ? (x0 + plotW / 2) : x0 + ((d.gen - 1) / (maxGenVal - 1)) * plotW;

      const tick = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      tick.setAttribute('x1', tx);
      tick.setAttribute('y1', y0);
      tick.setAttribute('x2', tx);
      tick.setAttribute('y2', y0 + 4);
      tick.setAttribute('stroke', 'rgba(216, 212, 200, 0.3)');
      g.appendChild(tick);

      const genLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      genLabel.setAttribute('x', tx);
      genLabel.setAttribute('y', y0 + 18);
      genLabel.setAttribute('text-anchor', 'middle');
      genLabel.setAttribute('font-family', 'var(--font-mono)');
      genLabel.setAttribute('font-size', '11px');
      genLabel.setAttribute('fill', 'rgba(216, 212, 200, 0.62)');
      genLabel.textContent = `G${d.gen}`;
      g.appendChild(genLabel);
    }

    // Title / Axis Legend in Stone, >= 11px
    const yAxisTitle = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    yAxisTitle.setAttribute('x', x0);
    yAxisTitle.setAttribute('y', y1 - 8);
    yAxisTitle.setAttribute('font-family', 'var(--font-mono)');
    yAxisTitle.setAttribute('font-size', '11px');
    yAxisTitle.setAttribute('font-weight', '600');
    yAxisTitle.setAttribute('fill', '#D8D4C8');
    yAxisTitle.textContent = 'Objective f(x1, x2)';
    g.appendChild(yAxisTitle);

    this.svg.appendChild(g);
  }

  drawHoverCard(d, plotH) {
    const x = this.mapX(d.gen);
    const y0 = this.margin.top;
    const y1 = this.margin.top + plotH;

    // Vertical guide line in Stone at 50%
    const vLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    vLine.setAttribute('x1', x);
    vLine.setAttribute('y1', y0);
    vLine.setAttribute('x2', x);
    vLine.setAttribute('y2', y1);
    vLine.setAttribute('stroke', 'rgba(216, 212, 200, 0.5)');
    vLine.setAttribute('stroke-dasharray', '2,2');
    this.svg.appendChild(vLine);

    // Tooltip Card
    const cardG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    const cardW = 130;
    const cardH = 76;
    const cardX = Math.min(x + 10, this.width - cardW - 10);
    const cardY = y0 + 10;

    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', cardX);
    rect.setAttribute('y', cardY);
    rect.setAttribute('width', cardW);
    rect.setAttribute('height', cardH);
    rect.setAttribute('rx', '6');
    rect.setAttribute('fill', '#101417');
    rect.setAttribute('stroke', 'rgba(216, 212, 200, 0.25)');
    rect.setAttribute('stroke-width', '1');
    cardG.appendChild(rect);

    const labels = [
      { text: `Gen ${d.gen}`, color: '#D8D4C8', weight: 'bold' },
      { text: `Best: ${d.bestF.toFixed(3)}`, color: '#C6F135' },
      { text: `Avg:  ${d.avgF.toFixed(3)}`, color: '#D8D4C8' },
      { text: `Div:  ${d.diversity}`, color: 'rgba(216, 212, 200, 0.62)' }
    ];

    labels.forEach((l, idx) => {
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', cardX + 10);
      text.setAttribute('y', cardY + 16 + idx * 15);
      text.setAttribute('font-family', 'var(--font-mono)');
      text.setAttribute('font-size', '11px');
      text.setAttribute('font-weight', l.weight || 'normal');
      text.setAttribute('fill', l.color);
      text.textContent = l.text;
      cardG.appendChild(text);
    });

    this.svg.appendChild(cardG);
  }

  handleMouseMove(e) {
    if (!this.validData || this.validData.length === 0) return;

    const rect = this.svg.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;

    let closestIdx = 0;
    let closestDist = Infinity;

    for (let i = 0; i < this.validData.length; i++) {
      const x = this.mapX(this.validData[i].gen);
      const dist = Math.abs(mouseX - x);
      if (dist < closestDist) {
        closestDist = dist;
        closestIdx = i;
      }
    }

    if (this.hoverIndex !== closestIdx) {
      this.hoverIndex = closestIdx;
      this.render(this.lastHistory, this.lastCurrentGen);
    }
  }

  handleMouseLeave() {
    if (this.hoverIndex !== null) {
      this.hoverIndex = null;
      this.render(this.lastHistory, this.lastCurrentGen);
    }
  }

  renderEmptyState() {
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', this.width / 2);
    text.setAttribute('y', this.height / 2);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('font-family', 'var(--font-sans)');
    text.setAttribute('font-size', '12px');
    text.setAttribute('fill', 'rgba(216, 212, 200, 0.62)');
    text.textContent = 'Advancing simulation will plot convergence curve...';
    this.svg.appendChild(text);
  }
}
