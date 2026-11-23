---
name: ga-lab-product-design
description: "Product design system, visual standards, and UI engineering guidelines for GA Lab. Teaches Antigravity how to design a credible, instrument-grade scientific educational desktop web application using dark navy surfaces, precise typography, accessible data tables, and disciplined visual hierarchy without generic AI SaaS clichés or external frameworks."
---

# GA Lab Product Design & Design System Skill

This skill governs all product design, UI architecture, styling, and visual review decisions for **GA Lab** (Binary Genetic Algorithm Educational Workbench). It enforces an instrument-grade, scientific educational aesthetic prioritizing algorithmic clarity, mathematical transparency, and high data density.

---

## 1. Product & Audience Analysis

### Target Audience & Pedagogical Context
- **Primary Users:** Computer science students, soft computing researchers, AI/ML instructors, and self-directed engineering learners.
- **Mental Mode:** Analytical, rigorous, focused on understanding underlying mechanics (mechanisms of selection, crossover point effects, mutation scales, schema disruption).
- **Core User Goal:** Bridge the gap between abstract mathematical formulas ($f$, $F$, $p_i$, $q_i$, $o(H)$, $d(H)$) and dynamic stochastic execution, verifying theoretical bounds with step-by-step determinism.

### Pedagogical Design Philosophy: Instrument vs. SaaS Dashboard
| Dimension | Generic AI SaaS Dashboard (AVOID) | GA Lab Scientific Instrument (REQUIRE) |
| :--- | :--- | :--- |
| **Visual Tone** | Playful, glossy, marketing-driven, vague | Precise, authoritative, lab-grade, transparent |
| **Data Presentation** | Vanity metrics, decorative cards, hidden math | Exact formulas, reproducible tables, step traces |
| **Color Usage** | Gratuitous gradients, random vibrant palettes | Strict semantic roles (cyan $x_1$, magenta $x_2$) |
| **Information Density**| Excessive whitespace, large empty cards | Dense-but-readable, tabular alignment, compact rhythm |
| **Motion** | Parallax, looping decorative spins, bounce | Pure pedagogical feedback, state transition tracking |
| **Surface Finish** | Heavy frosted blur, bright glow blooms | Deep opaque layers, crisp 1px borders, restrained tint |

---

## 2. Design System Tokens (Pure Vanilla CSS)

The design system is implemented strictly via CSS Custom Properties (`:root`), requiring zero CSS frameworks, preprocessors, or runtime styling libraries.

### 2.1 Color Tokens & Semantic Roles
The palette is fixed and authoritative. It must not be replaced by generic theme generators.

```css
:root {
  /* Surface Layers (Deep Navy Spectrum) */
  --color-bg-base: #0B1020;         /* Primary canvas / app background */
  --color-surface-base: #10172A;    /* Primary structural panels (rails, stage container) */
  --color-surface-raised: #162038;  /* Elevated cards, headers, table rows, button base */
  --color-surface-overlay: #1C2A4A; /* Tooltips, modals, active flyouts */
  --color-surface-inset: #080C18;   /* Input backgrounds, recessed data wells, bit strips */

  /* Translucent Borders (1px Structural Precision) */
  --color-border-subtle: rgba(255, 255, 255, 0.08); /* Default panel separation */
  --color-border-medium: rgba(255, 255, 255, 0.16); /* Interactive element boundaries */
  --color-border-strong: rgba(255, 255, 255, 0.28); /* Active states, focused outlines */

  /* Text & Content Roles (Meeting WCAG AAA / AA against --color-bg-base) */
  --color-text-primary: #F8FAFC;    /* High contrast headings, values (15.2:1 contrast) */
  --color-text-secondary: #94A3B8;  /* Labels, standard UI descriptions (6.8:1 contrast) */
  --color-text-muted: #64748B;      /* Inactive legends, helper text, units (4.6:1 contrast) */

  /* Domain & Algorithmic Semantics */
  --color-chrom-x1: #22D3EE;        /* Cyan: Variable x1 bits, MSB segment, x1 metrics */
  --color-chrom-x2: #E879F9;        /* Magenta: Variable x2 bits, LSB segment, x2 metrics */
  --color-accent-violet: #8B5CF6;   /* Violet: Schema X-Ray, active cut points, highlights */
  
  /* System State Semantics */
  --color-success: #34D399;         /* Emerald: Optimal fitness, verified match, valid check */
  --color-warning: #FBBF24;         /* Amber: Sub-optimal drift, C_shift active, cautionary notices */
  --color-danger: #F87171;          /* Rose/Red: Test fail, negative fitness, syntax error */
  
  /* Semantic Glows (Restrained & Purposeful - Max 12px Spread) */
  --glow-x1: 0 0 10px rgba(34, 211, 238, 0.25);
  --glow-x2: 0 0 10px rgba(232, 121, 249, 0.25);
  --glow-accent: 0 0 10px rgba(139, 92, 246, 0.25);
  --glow-success: 0 0 10px rgba(52, 211, 153, 0.25);
  --glow-danger: 0 0 10px rgba(248, 113, 113, 0.30);
}
```

### 2.2 Typography Scale
- **Proportional UI:** `Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
- **Monospace & Numerical:** `JetBrains Mono, "Fira Code", Menlo, Monaco, Consolas, monospace`
- **Mandatory Numeric Rule:** All numerical readouts, chromosomes, bit indices, and coordinates must use `font-variant-numeric: tabular-nums` or JetBrains Mono to avoid layout jitter during step changes.

```css
:root {
  --font-sans: 'Inter', system-ui, -apple-system, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;

  /* Type Scale */
  --font-size-2xs: 0.6875rem; /* 11px - Micro labels, bit weights (2^w), axis ticks */
  --font-size-xs: 0.75rem;    /* 12px - Table cells, secondary badges, hints */
  --font-size-sm: 0.8125rem;  /* 13px - Standard UI labels, input fields, control text */
  --font-size-base: 0.875rem; /* 14px - Narration body text, explanation paragraphs */
  --font-size-md: 1.0rem;     /* 16px - Section headers, card titles */
  --font-size-lg: 1.125rem;   /* 18px - Panel headers, step titles */
  --font-size-xl: 1.375rem;   /* 22px - Prominent statistics, optimum banner */

  /* Line Heights */
  --line-height-tight: 1.2;
  --line-height-normal: 1.45;
  --line-height-relaxed: 1.6;

  /* Font Weights */
  --font-weight-regular: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;
}
```

### 2.3 Spacing, Radii, Elevation & Motion Tokens

```css
:root {
  /* 4px Base Spacing Rhythm */
  --space-1: 0.25rem;  /* 4px  - Inset micro-spacing, tight icon margins */
  --space-2: 0.5rem;   /* 8px  - Compact control gap, table cell padding vertical */
  --space-3: 0.75rem;  /* 12px - Form input padding, card header gap */
  --space-4: 1.0rem;   /* 16px - Panel padding, container gutter */
  --space-5: 1.25rem;  /* 20px - Section separation */
  --space-6: 1.5rem;   /* 24px - Major layout module gutters */
  --space-8: 2.0rem;   /* 32px - Window edges, outer boundary padding */

  /* Structural Radii */
  --radius-xs: 2px;  /* Micro elements, chromosome bit blocks */
  --radius-sm: 4px;  /* Inputs, small badges, inline code tags */
  --radius-md: 6px;  /* Buttons, table rows, cards */
  --radius-lg: 8px;  /* Outer panels, Canvas containers, modals */

  /* Elevation & Shadows */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.4);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.5), 0 0 0 1px var(--color-border-subtle);
  --shadow-lg: 0 12px 32px rgba(0, 0, 0, 0.7), 0 0 0 1px var(--color-border-medium);

  /* Motion Tokens */
  --duration-fast: 100ms;   /* Button press, hover state tint */
  --duration-normal: 200ms; /* Tab switch, panel collapse, focus shift */
  --duration-step: 350ms;   /* Sub-step transition, wheel easing, dot repositioning */
  --ease-out-snappy: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
}
```

---

## 3. Information Architecture & Spatial Layout

The application utilizes an instrument-grade, 5-zone fixed grid optimized for desktop viewports ($\ge 1280\text{px}$) that reflows predictably down to $900\text{px}$.

```
+---------------------------------------------------------------------------------------------------+
| ZONE 1: TOP NAVIGATION BAR (Header: Problem Selector, Preset Load, Verify Toggle, Status Banner)  |
+--------------------------+------------------------------------+-----------------------------------+
| ZONE 2: CONTROL RAIL     | ZONE 3: CENTER VISUAL STAGE        | ZONE 4: NARRATION & SCHEMA X-RAY  |
|                          |                                    |                                   |
| - Problem Parameters     | - Phase Stepper Header             | - Step Title & Algorithmic Story  |
| - Population Settings    | - 2D Fitness Heatmap (Canvas)      | - "Why?" Theory Deep Dive         |
| - Genetic Operators      | - Dynamic Active Sub-Visual:       | - Live Schema Metrics (o, d, m, f)|
|   (Selection, Cross, Mut)|   * Selection: Roulette Wheel/Tourn| - Crossover / Mutation Risk Probe |
| - Seed & Verification    |   * Crossover: Cut Strip Animation | - E[m(t+1)] Bound Comparison Curve|
|   Controls               |   * Mutation: Bit Weight Flip Table|                                   |
+--------------------------+------------------------------------+-----------------------------------+
| ZONE 5: BOTTOM TIMELINE & CONVERGENCE CONSOLE                                                     |
| [Play/Pause/Step Back/Forward] [Scrubber Slider with Sub-step Ticks] [Convergence/Diversity Plot]|
+---------------------------------------------------------------------------------------------------+
```

### Visual Priority Hierarchy
1. **Primary Focus:** Center Visual Stage (Active Phase State & 2D Landscape).
2. **Secondary Focus:** Narration Panel & Schema X-Ray (Immediate mathematical explanation of what just transitioned).
3. **Tertiary Focus:** Timeline Console (Generation counter, scrubber index, convergence velocity).
4. **Anchor:** Control Rail (Configuration parameters, locked during Verify Mode).

---

## 4. Dense Data Display & Pedagogical Components

### 4.1 Population Data Table
- **Row Density:** Compact 28–32px row heights for high scanability.
- **Bitstring Encoding:** Chromosome rendered as grouped bit badges:
  - $x_1$ segment: Text `#22D3EE` with `rgba(34, 211, 238, 0.12)` background.
  - $x_2$ segment: Text `#E879F9` with `rgba(232, 121, 249, 0.12)` background.
- **Monospace Alignment:** Integer $D_j$, floating $x_j$, fitness $f(x)$, selection fitness $F$, cumulative $q_i$ are right-aligned with fixed decimal formatting.
- **Progressive Column Disclosure:** Columns relevant to future steps remain subtly dimmed or revealed dynamically as the generation progresses through `DECODE_EVAL` $\rightarrow$ `SELECT` $\rightarrow$ `CROSSOVER` $\rightarrow$ `MUTATE`.

### 4.2 Chromosome Bit Strips
- Individual bit cells with 1-based index headers ($1 \dots L$) and exponent weights ($2^w$, where $w=0$ is LSB).
- Crossover view renders a vertical glowing cut line at position $k$, visually distinguishing:
  - $k = n$: "Whole-variable swap: $x_1$ and $x_2$ exchanged intact."
  - $k \neq n$: "Variable $j$ rebuilt from mixed bits."
- Mutation view contrasts MSB mutations (large jump indicator $\Delta x_j \cdot 2^w$) with LSB mutations (fine-tuning adjustment).

### 4.3 Native Canvas Heatmap Instrument
- Perceptually uniform colormap (e.g., Viridis or Turbo spectrum) representing the discrete grid points ($2^n \times 2^n$).
- The global optimum grid point is indicated with a clean, high-contrast SVG star icon.
- Individuals are rendered as crisp vector-like dots on Canvas with coordinates $(x_1, x_2)$, subtle parent halos, and fading trajectory lines for historical generation movement.
- High DPI awareness via `window.devicePixelRatio` scaling to guarantee crisp retinal rendering.

### 4.4 Educational Narration Cards
- Structure:
  1. **Action Headline:** Direct summary (e.g., *"Crossover cut placed at position 3 for Pair 1"*).
  2. **Worked Derivation:** Concrete numeric substitutions showing exact arithmetic.
  3. **Collapsible "Why?" Theory Panel:** 1–2 sentences explaining evolutionary biology and mathematical implications (e.g., how high $p_m$ induces random search versus schema preservation).

---

## 5. Interaction States & Control Specifications

Every interactive control must support explicit, non-jarring state transitions without layout shift.

| State | Visual Manifestation | Token Specification |
| :--- | :--- | :--- |
| **Default** | Surface background with subtle border | `bg: --color-surface-raised; border: 1px solid --color-border-subtle; text: --color-text-primary` |
| **Hover** | Surface brightens, border strengthens | `bg: --color-surface-overlay; border: 1px solid --color-border-medium; cursor: pointer` |
| **Focus-Visible** | High-visibility dual ring, no layout shift | `outline: 2px solid var(--color-chrom-x1); outline-offset: 2px;` |
| **Pressed / Active** | Surface insets slightly, color tint shifts | `bg: var(--color-surface-base); transform: translateY(1px);` |
| **Disabled** | Muted opacity, non-interactive cursor | `opacity: 0.45; cursor: not-allowed; pointer-events: none;` |
| **Loading / Computing** | Subtle border pulse or linear progress well | `animation: pulse 1.5s infinite; border-color: var(--color-accent-violet);` |
| **Empty State** | Structured dashed container with clear hint | `border: 1px dashed var(--color-border-subtle); color: var(--color-text-muted);` |
| **Success / Valid** | Emerald accent border & muted badge background | `border-color: var(--color-success); color: var(--color-success); bg: rgba(52, 211, 153, 0.1);` |
| **Warning / Notice** | Amber accent border & notice badge | `border-color: var(--color-warning); color: var(--color-warning); bg: rgba(251, 191, 36, 0.1);` |
| **Error / Broken** | Rose accent border & explanatory recovery card | `border-color: var(--color-danger); color: var(--color-danger); bg: rgba(248, 113, 113, 0.1);` |

---

## 6. Accessibility, Ergonomics & Motion Compliance

### 6.1 Keyboard Navigation & Shortcuts
- Full focusability of all control rails, step buttons, timeline scrubbers, and modal dialogs.
- Standardized laboratory keyboard shortcuts:
  - `Space`: Toggle Play / Pause.
  - `ArrowRight`: Step forward one sub-step.
  - `ArrowLeft`: Step backward one sub-step.
  - `R`: Reset to generation 0.
- All shortcuts must be documented directly in the UI via an accessible help popover.

### 6.2 Contrast Compliance
- All normal text ($\le 18\text{px}$) must achieve at least $4.5:1$ contrast against the underlying surface (target $> 6.5:1$).
- High-contrast text tokens achieve $> 14:1$.
- Non-text UI controls, active borders, and Canvas data markers must achieve $\ge 3:1$ against the canvas background.

### 6.3 Reduced-Motion Specification (`prefers-reduced-motion`)
```css
@media (prefers-reduced-motion: reduce) {
  *, ::before, ::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```
- In Canvas and SVG components, when reduced-motion is detected, transitions and wheel rotations must bypass easing interpolation and immediately render the terminal state.

---

## 7. Anti-Pattern Guardrails (What NOT to Design)

1. **NO Generic AI SaaS Tropes:** Never use floating purple clouds, nebulous gradient blobs, or decorative cosmic backdrops. The background is `#0B1020`, an engineering dark room.
2. **NO Synthetic / Fake Metrics:** Never generate placeholder percentages, decorative sparklines without axes, or simulated counters. Every pixel in charts and tables must resolve directly to an engine `StepRecord`.
3. **NO Emojis as Structural UI Icons:** Emojis (e.g., 🚀, 🧬, ⚡) render inconsistently across operating systems and break visual gravity. Use precise, monoline SVG vector icons exclusively.
4. **NO Distracting Perpetual Motion:** Never use pulsating glowing buttons, spinning decorative wheels when idle, or marquee banners. Motion occurs strictly in response to step execution or user input.
5. **NO Unanchored Glassmorphism:** Glassmorphism (`backdrop-filter: blur()`) is restricted to floating panels and tooltips with high opacity ($>90\%$). Transparent, low-contrast text surfaces that bleed background details are strictly forbidden.
6. **NO Third-Party Frontend Frameworks:** No React, Vue, Tailwind, shadcn, or chart libraries. All UI components are authored in semantic HTML5, vanilla CSS modules, and native Canvas/SVG.

---

## 8. Real-Browser Visual QA Checklist

Verify the application across viewports using real-browser inspection:

### Viewport Targets
- **1440px+ (Large Desktop):** Full 5-zone panoramic layout with all panels expanded.
- **1280px (Standard Desktop Target):** Clean layout balance, no overlapping badges, no table horizontal overflow.
- **1024px / 900px (Compact Desktop / Small Laptop):**
  - Control Rail collapses into an expandable drawer or compact mode.
  - Narration & Schema panels stack or tuck into tabbed views.
  - Center Canvas maintains aspect ratio without truncation.
  - Minimum viewport target: $900\text{px}$ width must remain 100% operable without breaking.

### Visual Audit Points
- [ ] Retinal Canvas DPI Scaling: Canvas text and grid cells are razor-sharp on high-density displays (`devicePixelRatio >= 2`).
- [ ] Tabular Alignment: Columns $D_1, D_2, x_1, x_2, f, F, p_i, q_i$ align vertically without decimal jitter during playback.
- [ ] Focus Ring Integrity: Tabbing through the entire application displays an un-obscured 2px cyan/violet focus ring with 2px offset.
- [ ] Verify Mode Lockout: Entering Verify Mode visually locks editable parameter inputs with clear "Clone to Free Play" indicator.
- [ ] Color Distinction: Cyan ($x_1$) and Magenta ($x_2$) remain visually distinct for all color vision modes, supported by spatial labeling ($x_1$ always precedes $x_2$).
- [ ] Error States: Invalid fitness state ($F_i < 0$ or $\sum F \le 0$) renders the broken wheel illustration with clear recovery action buttons.
