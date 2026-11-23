/**
 * js/viz/roulette.js - Animated Canvas/SVG Roulette Wheel with Pointer Deceleration.
 * Conforms to SPEC.md §2, §4.3d, and ga-lab-data-visualization guidelines.
 */

export class RouletteVisualizer {
  constructor(canvasId = 'roulette-canvas', readoutId = 'roulette-readout') {
    this.canvas = document.getElementById(canvasId);
    this.readout = document.getElementById(readoutId);
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;

    this.width = 320;
    this.height = 320;
    this.currentRotation = 0; // In radians
    this.targetRotation = 0;
    this.animationId = null;
    this.isSpinning = false;
  }

  setupCanvas() {
    if (!this.canvas) return;
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(dpr, dpr);
  }

  render(stepRecord, config, onAction = null) {
    if (!this.canvas || !this.ctx) return;
    this.setupCanvas();

    const isNegativeInvalid = stepRecord?.isInvalidNegativeFitness;
    if (isNegativeInvalid) {
      this.renderBrokenWheel(stepRecord, onAction);
      return;
    }

    const pop = stepRecord?.population || stepRecord?.evaluation?.individuals || [];
    const probs = stepRecord?.probabilities || [];
    const cumulative = stepRecord?.cumulativeProbabilities || [];
    const spins = stepRecord?.rouletteSpins || [];
    const selectedIndices = stepRecord?.selectedIndices || stepRecord?.matingPoolIndices0Based || [];

    if (pop.length === 0 || probs.length === 0) {
      this.renderEmptyWheel();
      return;
    }

    // Determine current spin target angle
    const lastSpinR = spins.length > 0 ? spins[spins.length - 1] : 0.5;
    // Map r in [0, 1] to angle: r = 0 starts at top (-PI/2), moving clockwise
    const targetAngle = lastSpinR * Math.PI * 2;

    const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      this.currentRotation = targetAngle;
      this.drawWheel(pop, probs, cumulative, this.currentRotation, lastSpinR, selectedIndices);
    } else {
      this.animateSpinTo(targetAngle, pop, probs, cumulative, lastSpinR, selectedIndices);
    }

    this.updateReadout(lastSpinR, cumulative, probs, selectedIndices);
  }

  drawWheel(pop, probs, cumulative, pointerAngle, currentR, selectedIndices) {
    const ctx = this.ctx;
    const cx = this.width / 2;
    const cy = this.height / 2;
    const radius = this.width / 2 - 24;

    ctx.clearRect(0, 0, this.width, this.height);

    // Alternating Stone shades for slices, winning slice in Lime
    const sliceShades = [
      'rgba(216, 212, 200, 0.20)',
      'rgba(216, 212, 200, 0.40)',
      'rgba(216, 212, 200, 0.60)',
      'rgba(216, 212, 200, 0.80)'
    ];

    let startAngle = -Math.PI / 2; // Top position 12 o'clock

    // Draw Slices
    for (let i = 0; i < pop.length; i++) {
      const p = probs[i] || 0;
      const sliceAngle = p * Math.PI * 2;
      const endAngle = startAngle + sliceAngle;

      const isWinningSlice = selectedIndices.includes(i);

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, startAngle, endAngle);
      ctx.closePath();

      ctx.fillStyle = isWinningSlice ? '#C6F135' : sliceShades[i % sliceShades.length];
      ctx.globalAlpha = 1.0;
      ctx.fill();

      // Border between slices
      ctx.strokeStyle = '#101417';
      ctx.lineWidth = isWinningSlice ? 2.5 : 1;
      ctx.stroke();

      // Slice Text Label (#id and p_i)
      if (sliceAngle > 0.12) {
        const midAngle = startAngle + sliceAngle / 2;
        const textDist = radius * 0.68;
        const tx = cx + Math.cos(midAngle) * textDist;
        const ty = cy + Math.sin(midAngle) * textDist;

        ctx.fillStyle = '#101417';
        ctx.font = 'bold 11px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`#${pop[i].id || i + 1}`, tx, ty - 5);
        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.fillText(`${(p * 100).toFixed(1)}%`, tx, ty + 7);
      }

      ctx.restore();
      startAngle = endAngle;
    }

    // Outer wheel rim
    ctx.strokeStyle = 'rgba(216, 212, 200, 0.25)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();

    // Center hub
    ctx.fillStyle = '#101417';
    ctx.strokeStyle = '#C6F135';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#D8D4C8';
    ctx.font = 'bold 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('ΣF', cx, cy);

    // Pointer easing to target r
    this.drawPointer(cx, cy, radius, pointerAngle);
  }

  drawPointer(cx, cy, radius, pointerAngle) {
    const ctx = this.ctx;
    const angle = pointerAngle - Math.PI / 2;
    const px = cx + Math.cos(angle) * (radius + 2);
    const py = cy + Math.sin(angle) * (radius + 2);

    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(angle + Math.PI / 2);

    // Pointer needle (Lime with Graphite outline)
    ctx.fillStyle = '#C6F135';
    ctx.strokeStyle = '#101417';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-7, 16);
    ctx.lineTo(7, 16);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  animateSpinTo(targetAngle, pop, probs, cumulative, currentR, selectedIndices) {
    if (this.animationId) cancelAnimationFrame(this.animationId);

    // Add extra rotations for natural spinning feel (e.g. 2 full spins)
    const totalTarget = targetAngle + Math.PI * 4;
    const startAngle = this.currentRotation % (Math.PI * 2);
    const diff = totalTarget - startAngle;
    const startTime = performance.now();
    const duration = 750; // ms

    const step = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      // Smooth quartic deceleration ease
      const ease = 1 - Math.pow(1 - progress, 4);
      this.currentRotation = startAngle + diff * ease;

      this.drawWheel(pop, probs, cumulative, this.currentRotation, currentR, selectedIndices);

      if (progress < 1) {
        this.animationId = requestAnimationFrame(step);
      } else {
        this.currentRotation = targetAngle;
        this.drawWheel(pop, probs, cumulative, targetAngle, currentR, selectedIndices);
      }
    };

    this.animationId = requestAnimationFrame(step);
  }

  renderBrokenWheel(stepRecord, onAction) {
    const ctx = this.ctx;
    const cx = this.width / 2;
    const cy = this.height / 2;
    const radius = this.width / 2 - 24;

    ctx.clearRect(0, 0, this.width, this.height);

    // Draw broken striped wheel in Stone monochrome
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(216, 212, 200, 0.12)';
    ctx.fill();

    // Stone diagonal hazard stripes
    ctx.strokeStyle = 'rgba(216, 212, 200, 0.35)';
    ctx.lineWidth = 3;
    for (let x = -radius; x < radius * 2; x += 12) {
      ctx.beginPath();
      ctx.moveTo(cx + x - radius, cy - radius);
      ctx.lineTo(cx + x, cy + radius);
      ctx.stroke();
    }

    // Outer cracked ring in Stone dashed
    ctx.strokeStyle = '#D8D4C8';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([8, 4]);
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();

    // Center warning glyph in Graphite with Stone border & text
    ctx.setLineDash([]);
    ctx.fillStyle = '#101417';
    ctx.strokeStyle = '#D8D4C8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, 32, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#D8D4C8';
    ctx.font = 'bold 16px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⚠ F<0', cx, cy);
    ctx.restore();

    if (this.readout) {
      const shift = stepRecord.linearShift?.C_shift?.toFixed(2) || 'auto';
      this.readout.innerHTML = `
        <div style="color: var(--color-danger); font-weight: 600; margin-bottom: 4px;">
          ⚠ Roulette Halted: Negative Fitness Slice (F_min = ${stepRecord.minFitness?.toFixed(2)})
        </div>
        <div style="font-size: 11px; color: var(--color-text-secondary); margin-bottom: 8px;">
          Probabilities cannot be negative. Select a recovery action:
        </div>
        <div style="display: flex; gap: 8px; justify-content: center;">
          <button id="roulette-shift-btn" class="btn btn-primary" style="font-size: 11px;">
            Apply Linear Shift C_shift (${shift})
          </button>
          <button id="roulette-tourn-btn" class="btn btn-secondary" style="font-size: 11px;">
            Switch to Tournament
          </button>
        </div>
      `;

      const shiftBtn = this.readout.querySelector('#roulette-shift-btn');
      const tournBtn = this.readout.querySelector('#roulette-tourn-btn');
      if (shiftBtn && onAction) shiftBtn.addEventListener('click', () => onAction('apply-shift', stepRecord));
      if (tournBtn && onAction) tournBtn.addEventListener('click', () => onAction('switch-tournament', stepRecord));
    }
  }

  renderEmptyWheel() {
    const ctx = this.ctx;
    const cx = this.width / 2;
    const cy = this.height / 2;
    const radius = this.width / 2 - 24;

    ctx.clearRect(0, 0, this.width, this.height);
    ctx.strokeStyle = 'var(--color-border-subtle)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  updateReadout(lastSpinR, cumulative, probs = [], selectedIndices = []) {
    if (!this.readout) return;

    let winIdx = -1;
    if (Array.isArray(selectedIndices) && selectedIndices.length > 0) {
      winIdx = selectedIndices[selectedIndices.length - 1];
    } else {
      for (let i = 0; i < cumulative.length; i++) {
        if ((!probs.length || probs[i] > 0) && lastSpinR <= cumulative[i]) {
          winIdx = i;
          break;
        }
      }
      if (winIdx === -1) {
        for (let i = cumulative.length - 1; i >= 0; i--) {
          if (!probs.length || probs[i] > 0) {
            winIdx = i;
            break;
          }
        }
      }
      if (winIdx === -1) winIdx = 0;
    }

    const qPrev = winIdx === 0 ? '0.00000' : (cumulative[winIdx - 1]?.toFixed(5) || '0.00000');
    const qCurr = cumulative[winIdx]?.toFixed(5) || '1.00000';

    this.readout.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; font-size: 11px; font-family: var(--font-mono);">
        <span>Spin Draw: <strong>r = ${lastSpinR.toFixed(5)}</strong></span>
        <span>Interval: <strong>[${qPrev}, ${qCurr}]</strong></span>
        <span style="color: var(--color-success); font-weight: bold;">Selected: #${winIdx + 1}</span>
      </div>
    `;
  }
}
