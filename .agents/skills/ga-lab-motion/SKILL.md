---
name: ga-lab-motion
description: "Motion choreography, timing physics, and animation standards for GA Lab. Translates Motion and Anime.js principles into native CSS transitions, Web Animations API (WAAPI), and requestAnimationFrame without runtime animation libraries."
---

# GA Lab Native Motion & Choreography Skill

This skill teaches Antigravity how to implement purposeful, pedagogically clear motion for **GA Lab** using pure browser standards: CSS transitions, the Web Animations API (WAAPI), and `requestAnimationFrame` loops.

---

## 1. Pedagogical Motion Philosophy

Motion in a scientific instrument is not decoration—it is **cognitive tracking**.
- **Why Animate:** Animation helps the student track where bits came from during crossover, why a parent was selected on the roulette wheel, or how an MSB mutation produces a massive coordinate jump on the fitness landscape.
- **Why NOT Animate:** Never use motion to entertain, distract, or pad perceived wait time.
- **Rules of Restraint:**
  - No scroll-jacking or hijacked mouse physics.
  - No cursor-following glow trails or particle backgrounds.
  - No perpetual looping spinners when the engine is idle.
  - No animation that blocks immediate user control or step navigation.

---

## 2. Timing, Easing & Physics Specification

Borrowing principles from **Motion** (critically damped springs, explicit visual durations) and **Anime.js** (timeline sequencing and coordinate interpolation):

| Phase / Interaction | Technique | Duration | Easing Curve | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **Control Hover / Tint** | CSS Transition | 100ms | `cubic-bezier(0.16, 1, 0.3, 1)` | Crisp affordance feedback |
| **Step Button Click** | CSS Transform | 60ms | `linear` | Instant tactile depression (1px) |
| **Roulette Spin** | `requestAnimationFrame` | 800–1200ms | Custom cubic ease-out | Realistic deceleration to target $r$ |
| **Crossover Tail Swap** | WAAPI (`element.animate`) | 300ms | `cubic-bezier(0.2, 0, 0, 1)` | Show segments separating & swapping |
| **Mutation Bit Flip** | CSS Animation | 250ms | Keyframe scale pulse | Contrast MSB jump vs. LSB tune |
| **Heatmap Dot Movement** | Canvas rAF Loop | 250ms | Ease-out quad | Trace trajectory without teleporting |

### Native Easing Functions (Pure Vanilla Math)
```javascript
// Replicating Anime.js / Motion easings without libraries
export const Easing = {
  // Snappy ease out for UI controls
  easeOutCubic: (t) => 1 - Math.pow(1 - t, 3),
  // Smooth deceleration for roulette wheel physics
  easeOutQuart: (t) => 1 - Math.pow(1 - t, 4),
  // Critically damped spring simulation for dot settling
  springCriticallyDamped: (t) => {
    const decay = Math.exp(-6 * t);
    return 1 - decay * Math.cos(10 * t);
  }
};
```

---

## 3. Web Animations API (WAAPI) Recipes

### 3.1 Crossover Tail Swap Animation
When crossover occurs at cut point $k$, animate the tails separating, swapping vertical tracks, and docking into the child chromosomes.

```javascript
export function animateTailSwap(tailA, tailB, verticalOffset = 18) {
  const options = {
    duration: 280,
    easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
    fill: 'forwards'
  };

  const animA = tailA.animate([
    { transform: 'translateY(0)', opacity: 1 },
    { transform: `translateY(${verticalOffset}px)`, opacity: 0.8 },
    { transform: `translateY(${verticalOffset}px)`, opacity: 1 }
  ], options);

  const animB = tailB.animate([
    { transform: 'translateY(0)', opacity: 1 },
    { transform: `translateY(-${verticalOffset}px)`, opacity: 0.8 },
    { transform: `translateY(-${verticalOffset}px)`, opacity: 1 }
  ], options);

  return Promise.all([animA.finished, animB.finished]);
}
```

### 3.2 Animated Number Count-Up
For statistics and objective function values, animate numbers smoothly between step changes using `requestAnimationFrame`.

```javascript
export function animateValue(element, startVal, endVal, duration = 300, decimals = 4) {
  const startTime = performance.now();
  
  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
    
    const current = startVal + (endVal - startVal) * eased;
    element.textContent = current.toFixed(decimals);

    if (progress < 1) {
      requestAnimationFrame(update);
    }
  }
  
  requestAnimationFrame(update);
}
```

---

## 4. Accessibility & Reduced-Motion Enforcement

All motion must obey `prefers-reduced-motion: reduce`. When active:
1. All CSS transitions and animations collapse to zero duration.
2. WAAPI animations resolve immediately via `.finish()`.
3. Roulette wheel spins bypass easing loops and directly render the final pointer rotation angle and winning slice.
4. Canvas dots render instantly at their new coordinates with no interpolated trajectory.

```javascript
export function isReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// In animation routines:
export function runOrBypassAnimation(animateFn, immediateFn) {
  if (isReducedMotion()) {
    immediateFn();
    return Promise.resolve();
  }
  return animateFn();
}
```
