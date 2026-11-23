---
name: ga-lab-data-visualization
description: "Data visualization architecture and mathematical graphics standards for GA Lab. Translates Bklit UI visualization principles (heatmaps, crosshairs, range bands, legends, tooltips) into pure native HTML5 Canvas and SVG without external charting libraries."
---

# GA Lab Native Data Visualization Skill

This skill teaches Antigravity how to build mathematically precise, responsive, and accessible scientific visualizations for **GA Lab** using native HTML5 Canvas (for 2D raster landscapes and high-particle fields) and SVG (for charts, vectors, brackets, and wheels).

---

## 1. Visual Vocabulary & Component Allocation

Bklit UI demonstrates the power of a strict, consistent vocabulary for chart elements. In GA Lab, every visualization translates directly to native web primitives:

| Visual Need | Bklit Concept | GA Lab Native Technology | Role & Mathematical Source |
| :--- | :--- | :--- | :--- |
| **Fitness Landscape** | Matrix Heatmap | HTML5 `<canvas>` (2D Context) | $2^n \times 2^n$ discrete grid points evaluated under $f(x_1, x_2)$ |
| **Population State** | Dot Plot / Scatter Overlay | HTML5 `<canvas>` (High DPI) | Individuals at exact $(x_1, x_2)$ coordinates with fading trajectory trails |
| **Convergence Curve** | Line Chart + Range Band | `<svg>` with `<path>` | Best, Average, and Worst $f$ across generations $0 \dots t$ |
| **Schema Bound** | Dual Reference Lines | `<svg>` with `<path stroke-dasharray>` | Observed $m(t+1)$ vs. Textbook and Exact Bound curves |
| **Roulette Selection** | Radial Area / Donut | `<canvas>` + `<svg>` pointer | Slices proportional to $p_i = F_i / \sum F$, cumulative $q_i$ arcs |
| **Tournament Selection**| Tree / Match Bracket | `<svg>` layout nodes | Pairwise contenders, fitness comparisons, winner badges |

---

## 2. Canvas 2D Fitness Heatmap Guidelines

### 2.1 Resolution & Retinal Scaling
Canvas coordinates must match CSS pixel dimensions multiplied by `window.devicePixelRatio` to prevent blurriness on modern displays:

```javascript
export function configureRetinaCanvas(canvas, cssWidth, cssHeight) {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.floor(cssWidth * dpr);
  canvas.height = Math.floor(cssHeight * dpr);
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  return { ctx, dpr };
}
```

### 2.2 Perceptually Uniform Colormaps
- **Never use naive rainbow or uncalibrated RGB transitions.** Rainbow colormaps introduce false boundaries and distort gradient perception.
- **Turbo or Viridis Spectrum:** Implement a linear RGB interpolation function sampling from a 256-entry lookup table that translates normalized value $u = \frac{f - f_{min}}{f_{max} - f_{min}} \in [0, 1]$ into smooth perceptual colors.
- **Objective Optimum Indicator:** The global optimum grid point must be highlighted with a distinctive high-contrast SVG star icon or crisp Canvas glyph with coordinates labeled.

### 2.3 Individual Representation & Trail Fading
- **Current Individuals:** Rendered as crisp circles ($\text{radius} = 4.5\text{px}$) with a solid interior and a $1\text{px}$ translucent glow ring (`var(--glow-x1)` / `var(--glow-x2)`).
- **Parents:** Ringed with a secondary border (`border: 2px solid var(--color-accent-violet)`).
- **Children:** Rendered with transient opacity ($0.6$), easing smoothly into the terminal position.
- **Mutation Jump Line:** When an individual undergoes mutation, draw an arrow/vector from $(x_1^{old}, x_2^{old})$ to $(x_1^{new}, x_2^{new})$ in `var(--color-warning)`.

---

## 3. SVG Charts & Mathematical Graphs

### 3.1 Convergence & Diversity Chart
- **Container:** `<svg viewBox="0 0 600 240" preserveAspectRatio="xMidYMid meet">`
- **Data Series:**
  - **Best Fitness ($f_{best}$):** Solid vibrant cyan line (`stroke="#22D3EE"`, `stroke-width="2"`).
  - **Average Fitness ($\bar{f}$):** Amber line (`stroke="#FBBF24"`, `stroke-width="1.5"`).
  - **Worst Fitness ($f_{worst}$):** Muted rose line (`stroke="#F87171"`, `stroke-width="1"`).
  - **Range Band:** Shaded polygon connecting $f_{worst}$ to $f_{best}$ with subtle transparency (`fill="rgba(34, 211, 238, 0.06)"`).
  - **Distinct Chromosome Diversity:** Secondary right-hand axis or dotted line (`stroke="#94A3B8"`, `stroke-dasharray="3 3"`).

### 3.2 Schema X-Ray Bound Curves
Plot observed count $m(H, t+1)$ vs. theoretical lower bounds:
- **Observed Counts:** Solid data points with connected line.
- **Textbook Bound:** Solid violet line (`stroke="#8B5CF6"`).
- **Exact-Mutation Bound:** Dashed magenta line (`stroke="#E879F9"`, `stroke-dasharray="4 4"`).
- **Zero Invariant:** If $m(H, t) = 0$, both bounds must clamp strictly to $0$.

---

## 4. Legends, Tooltips & Numerical Scales

### 4.1 Heatmap Scale Legend
- Always pair the 2D canvas with a horizontal gradient legend bar ($12\text{px}$ height, $180\text{px}$ width).
- Display exact numerical ticks: Minimum ($f_{min}$), Midpoint ($\frac{f_{min}+f_{max}}{2}$), and Maximum ($f_{max}$), formatted with appropriate decimal precision.

### 4.2 Crosshair & Tooltip Inspector
- When the pointer moves across the heatmap, draw subtle crosshair guide lines along the horizontal and vertical grid axes.
- Render a high-contrast floating tooltip card:
  ```
  +-------------------------------------+
  | Discrete Grid Point (D1: 3, D2: 5)  |
  | Coordinates: x1 = 3.000, x2 = 5.000 |
  | Objective:   f(x1, x2) = 34.000000  |
  | Pop Count:   1 individual present   |
  +-------------------------------------+
  ```
- Tooltip must be pinned securely to avoid overflowing window borders and must never jitter on hover.

---

## 5. Non-Negotiable Scientific Integrity Rules
1. **Zero Data Hallucination:** Never render synthetic "mock" interpolation curves. Every point must map to an immutable engine `StepRecord`.
2. **Deterministic Geometry:** Discrete grid cells on the heatmap must align exactly to the mathematical bounds $[x_{min}, x_{max}]$ and resolution $\Delta x = \frac{x_{max} - x_{min}}{2^n - 1}$.
3. **No External Libraries:** Under no circumstances should Chart.js, D3.js, Plotly, or Recharts be imported or injected.
