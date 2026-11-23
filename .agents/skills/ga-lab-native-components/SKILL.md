---
name: ga-lab-native-components
description: "Component design and implementation guidelines for GA Lab. Translates modern interactive component patterns (inspired by Kokonut UI) into clean, accessible, semantic HTML5, vanilla CSS modules, and ES modules without React, shadcn, or Tailwind."
---

# GA Lab Native Components Skill

This skill teaches Antigravity how to architect, style, and engineer UI components for **GA Lab** using semantic HTML5, modular vanilla CSS, and vanilla JavaScript ES modules.

---

## 1. Architectural Philosophy

Modern design libraries like Kokonut UI demonstrate that high polish comes from **explicit state modeling, tight visual rhythm, and clear contextual feedback**. However, GA Lab's specification strictly prohibits React, Tailwind, and component-library runtimes.

We translate Kokonut UI's design excellence into pure native web standards:
- **No Virtual DOM:** Use native DOM APIs, semantic markup (`<button>`, `<dialog>`, `<details>`, `<table>`, `<input>`), and deterministic render functions.
- **No Class Utility Soup:** Author CSS with BEM-like semantic class naming scoped to component files (e.g., `.ctrl-field`, `.chrom-strip`, `.modal-dialog`).
- **No External Icons:** Handcraft lightweight, inline SVG icons with consistent 1.5px/2px stroke discipline and `aria-hidden="true"`.

---

## 2. Core Component Patterns & Vanilla Recipes

### 2.1 Parameter Field with Inline Validation
Inspired by Kokonut UI's `card-field` and `action-search-bar`, parameter controls feature compact borders, inset focus, and instant inline feedback.

```html
<!-- HTML Structure -->
<div class="ctrl-field" data-state="valid">
  <div class="ctrl-field__header">
    <label for="param-pc" class="ctrl-field__label">CROSSOVER PROBABILITY (p_c)</label>
    <span class="ctrl-field__value-readout" id="param-pc-display">0.80</span>
  </div>
  <div class="ctrl-field__control-row">
    <input 
      type="number" 
      id="param-pc" 
      class="ctrl-input ctrl-input--mono" 
      min="0" 
      max="1" 
      step="0.01" 
      value="0.80"
      aria-describedby="param-pc-hint"
    />
    <input 
      type="range" 
      id="param-pc-slider" 
      class="ctrl-slider" 
      min="0" 
      max="1" 
      step="0.01" 
      value="0.80"
      tabindex="-1"
      aria-hidden="true"
    />
  </div>
  <div class="ctrl-field__feedback" id="param-pc-hint" role="status">
    Uniform real in [0, 1]. Recommended: 0.60 – 0.90.
  </div>
</div>
```

```css
/* Scoped Component CSS */
.ctrl-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  margin-bottom: var(--space-3);
}

.ctrl-field__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.ctrl-field__label {
  font-family: var(--font-sans);
  font-size: var(--font-size-2xs);
  font-weight: var(--font-weight-semibold);
  letter-spacing: 0.05em;
  color: var(--color-text-secondary);
}

.ctrl-field__value-readout {
  font-family: var(--font-mono);
  font-size: var(--font-size-xs);
  color: var(--color-chrom-x1);
}

.ctrl-input {
  background: var(--color-surface-inset);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-sm);
  color: var(--color-text-primary);
  padding: var(--space-2) var(--space-3);
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  transition: border-color var(--duration-fast) ease, box-shadow var(--duration-fast) ease;
}

.ctrl-input:hover {
  border-color: var(--color-border-medium);
}

.ctrl-input:focus-visible {
  outline: 2px solid var(--color-chrom-x1);
  outline-offset: 2px;
  border-color: var(--color-chrom-x1);
}

.ctrl-field[data-state="error"] .ctrl-input {
  border-color: var(--color-danger);
  box-shadow: 0 0 8px rgba(248, 113, 113, 0.2);
}

.ctrl-field__feedback {
  font-size: var(--font-size-2xs);
  color: var(--color-text-muted);
}

.ctrl-field[data-state="error"] .ctrl-field__feedback {
  color: var(--color-danger);
  font-weight: var(--font-weight-medium);
}
```

### 2.2 Segmented Chromosome Bit Strips
Visual representation of chromosomes splitting into distinct $x_1$ and $x_2$ variables with bit-position markers and mutation diffs.

```html
<div class="chrom-strip" role="group" aria-label="Chromosome 1: 8 bits">
  <!-- x1 Segment (MSB Block) -->
  <div class="chrom-strip__segment chrom-strip__segment--x1" aria-label="Variable x1 bits">
    <div class="chrom-bit" data-bit-pos="1" data-val="0" title="Pos 1 (Weight 2^3 = 8)">
      <span class="chrom-bit__idx">1</span>
      <span class="chrom-bit__val">0</span>
    </div>
    <div class="chrom-bit" data-bit-pos="2" data-val="0" title="Pos 2 (Weight 2^2 = 4)">
      <span class="chrom-bit__idx">2</span>
      <span class="chrom-bit__val">0</span>
    </div>
    <div class="chrom-bit" data-bit-pos="3" data-val="1" title="Pos 3 (Weight 2^1 = 2)">
      <span class="chrom-bit__idx">3</span>
      <span class="chrom-bit__val">1</span>
    </div>
    <div class="chrom-bit" data-bit-pos="4" data-val="1" title="Pos 4 (Weight 2^0 = 1)">
      <span class="chrom-bit__idx">4</span>
      <span class="chrom-bit__val">1</span>
    </div>
  </div>
  
  <div class="chrom-strip__divider" aria-hidden="true"></div>

  <!-- x2 Segment (LSB Block) -->
  <div class="chrom-strip__segment chrom-strip__segment--x2" aria-label="Variable x2 bits">
    <div class="chrom-bit" data-bit-pos="5" data-val="0">
      <span class="chrom-bit__idx">5</span>
      <span class="chrom-bit__val">0</span>
    </div>
    <div class="chrom-bit" data-bit-pos="6" data-val="1">
      <span class="chrom-bit__idx">6</span>
      <span class="chrom-bit__val">1</span>
    </div>
    <div class="chrom-bit" data-bit-pos="7" data-val="0">
      <span class="chrom-bit__idx">7</span>
      <span class="chrom-bit__val">0</span>
    </div>
    <div class="chrom-bit" data-bit-pos="8" data-val="1">
      <span class="chrom-bit__idx">8</span>
      <span class="chrom-bit__val">1</span>
    </div>
  </div>
</div>
```

```css
.chrom-strip {
  display: inline-flex;
  align-items: center;
  background: var(--color-surface-inset);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-sm);
  padding: 2px 4px;
  gap: 2px;
}

.chrom-strip__segment {
  display: flex;
  gap: 2px;
}

.chrom-strip__divider {
  width: 1px;
  height: 20px;
  background: var(--color-border-medium);
  margin: 0 4px;
}

.chrom-bit {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 28px;
  border-radius: var(--radius-xs);
  font-family: var(--font-mono);
  font-size: var(--font-size-xs);
  cursor: default;
  transition: transform var(--duration-fast) ease, background var(--duration-fast) ease;
}

.chrom-strip__segment--x1 .chrom-bit[data-val="1"] {
  background: rgba(34, 211, 238, 0.2);
  color: var(--color-chrom-x1);
  border: 1px solid rgba(34, 211, 238, 0.4);
}

.chrom-strip__segment--x2 .chrom-bit[data-val="1"] {
  background: rgba(232, 121, 249, 0.2);
  color: var(--color-chrom-x2);
  border: 1px solid rgba(232, 121, 249, 0.4);
}

.chrom-bit__idx {
  font-size: 8px;
  color: var(--color-text-muted);
  line-height: 1;
}

.chrom-bit--mutated {
  animation: bit-flip-pulse 0.6s var(--ease-out-snappy);
  box-shadow: 0 0 8px var(--color-warning);
}
```

### 2.3 Status & Verification Callout Cards
Inspired by Kokonut UI's `ai-tool-approval` feedback patterns, these cards present deterministic verification feedback with explicit, recovery-oriented user actions.

```html
<!-- Broken Roulette Negative Fitness Card -->
<div class="status-card status-card--danger" role="alert">
  <div class="status-card__header">
    <svg class="status-card__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="8" x2="12" y2="12"/>
      <line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
    <h4 class="status-card__title">Invalid Selection State: Negative Fitness Encountered</h4>
  </div>
  <p class="status-card__desc">
    Roulette wheel selection requires non-negative weights ($\sum F > 0$). Current individual $F_1 = -16.0$ creates an invalid probability distribution.
  </p>
  <div class="status-card__actions">
    <button type="button" class="btn btn--warning" id="btn-apply-shift">
      Apply Linear Shift (C_shift = 16.20)
    </button>
    <button type="button" class="btn btn--subtle" id="btn-switch-tournament">
      Switch to Tournament Selection
    </button>
  </div>
</div>
```

---

## 3. Component Engineering Rules
1. **Zero External Stylesheet Dependencies:** No Tailwind runtime, pre-compiled CSS files only.
2. **Encapsulated Event Handling:** Components attach event listeners cleanly and remove them or use event delegation from top-level parent panels.
3. **Deterministic DOM Updates:** When updating tables or chromosome strips, update `textContent` and `data-*` attributes directly rather than re-creating `innerHTML` on every tick, guaranteeing 60fps responsiveness.
