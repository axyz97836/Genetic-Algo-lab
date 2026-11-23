---
name: ga-lab-product-polish
description: "Product refinement and quality engineering standards for GA Lab. Enforces honest status feedback, progressive disclosure, robust empty and error recovery states, zero placeholder UI, and scientific determinism inspired by workflow clarity patterns from Manus."
---

# GA Lab Product Polish & Quality Engineering Skill

This skill teaches Antigravity how to elevate **GA Lab** from a basic code prototype into a deeply refined, trustworthy scientific workbench. It draws upon product-level workflow clarity (inspired by Manus) while adhering strictly to vanilla web standards.

---

## 1. Status Feedback & Workflow Clarity

In complex algorithmic systems, users must never wonder *"Is it running?"*, *"Did it freeze?"*, or *"Why did this fail?"*.

### 1.1 Multi-Tier Status Messaging
The top status bar and stepper provide continuous, transparent operational feedback:
- **Idle / Ready:** `Ready. Seed: 12345 (Mulberry32). Generation 0 loaded.`
- **Stepping / Playing:** `Executing Generation 2: Crossover (Pair 1 of 2)... [Pause (Space)]`
- **Completed:** `Reached Generation 100. Optimum found: f(3, 5) = 34.0000.`
- **Deterministic Replay (Verify Mode):** `Verify Mode Active: Replaying ref-roulette. 44 / 44 cells matched (100%).`

### 1.2 Progressive Disclosure Pattern
Avoid cognitive overload by structuring technical data in expandable layers:
1. **Layer 1: Essential Metrics:** Visible by default (Best $f$, average $f$, generation counter, active individuals).
2. **Layer 2: Step-by-Step Derivations:** Exposed during relevant phase (exact random draws, cut points, bit flips).
3. **Layer 3: Algorithmic "Why?" Panels:** Collapsible `<details>` containers explaining why specific evolutionary phenomena occurred (e.g., genetic drift, premature convergence, schema survival).

---

## 2. Robust Empty States & Actionable Error Recovery

### 2.1 Meaningful Empty States
Never render blank cards or raw `null`/`undefined`. Every unpopulated area must provide guidance:
- **Empty Convergence Chart:** Before running, display faint coordinate axes with a dashed baseline and message: *"Run generations or step forward to track fitness convergence and chromosome diversity over time."*
- **Empty Schema X-Ray:** When no schema is specified, show: *"Select bit positions above or click 'Auto-track' to monitor schema survival bounds."*
- **No Reference Data in Verify Mode:** If a cell in the lecture notes is missing/unread, explicitly render a neutral pill: `[No Reference Data]` (do NOT count as fail).

### 2.2 Actionable Error Cards (No Silent Fixes)
When an algorithm constraint is violated, never fail silently or mutate values behind the user's back:
- **Negative Fitness in Roulette Wheel:**
  1. Halt execution cleanly.
  2. Display an error callout with the broken roulette wheel (negative slices highlighted with diagonal warning stripes).
  3. Offer two explicit recovery buttons:
     - `[Apply Linear Shift (C_shift)]`: Recalculates $F' = F + C_{shift}$ with formula shown.
     - `[Switch to Tournament Selection]`: Automatically switches selection mode without needing a shift.
- **Custom Expression Evaluation Error:**
  - If a user expression produces division by zero, $\text{NaN}$, or $\pm\infty$ on any grid point, display an inline error badge directly beneath the expression input with the specific problematic $(x_1, x_2)$ coordinate.
- **Scripted RNG Queue Dry:**
  - If a preset runs out of scripted random numbers, display: *"ScriptedRNG exhausted in queue 'roulette' at Generation 2, Draw 3. Replay stopped."*

---

## 3. Strict Quality Guardrails

1. **Zero Placeholder UI:** No "Lorem Ipsum", no `TODO: add chart here`, no dummy `div` placeholders. If a feature is in the active phase, it must be fully wired to the engine.
2. **Zero Fake Metrics:** Never display decorative stats like "Efficiency 94%" or random trend arrows. Every metric is computed strictly from population chromosomes.
3. **Deterministic Reset:** Changing any parameter or preset must cleanly reset the timeline back to Generation 0 and recompute initial populations deterministically from the specified seed.
4. **No Console Warnings:** The finished application must produce zero warnings, zero uncaught errors, and zero unhandled rejections in the browser developer tools console.
