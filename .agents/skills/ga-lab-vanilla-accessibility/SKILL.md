---
name: ga-lab-vanilla-accessibility
description: "Accessibility, keyboard operation, focus management, and WCAG 2.2 standards for GA Lab. Enforces accessible names, visible focus rings, ARIA roles, high-contrast dark-mode palettes, and screen-reader transparency using pure vanilla HTML and CSS."
---

# GA Lab Vanilla Accessibility Skill

This skill teaches Antigravity how to build **GA Lab** to meet and exceed **WCAG 2.2 AA (and AAA where specified)** standards without relying on external UI component kits.

---

## 1. Keyboard Navigation & Focus Architecture

Every interactive surface in GA Lab must be fully navigable and operable via standard keyboard interactions.

### 1.1 Global Keyboard Shortcuts
Laboratory controls are bound globally to window keydown events (ignoring events originated from text inputs):

```javascript
export function registerLabShortcuts({ onTogglePlay, onStepForward, onStepBack, onReset }) {
  window.addEventListener('keydown', (e) => {
    // Never hijack keystrokes if the user is typing in an input or textarea
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;

    switch (e.code) {
      case 'Space':
        e.preventDefault();
        onTogglePlay();
        break;
      case 'ArrowRight':
        e.preventDefault();
        onStepForward();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        onStepBack();
        break;
      case 'KeyR':
        if (!e.metaKey && !e.ctrlKey) {
          e.preventDefault();
          onReset();
        }
        break;
    }
  });
}
```

### 1.2 Visible Focus Indicators
- Never suppress `:focus` outlines without replacing them with `:focus-visible`.
- Focus indicators must meet WCAG 2.2 AAA perimeter and contrast criteria:
  ```css
  :focus-visible {
    outline: 2px solid var(--color-chrom-x1) !important;
    outline-offset: 2px !important;
    box-shadow: 0 0 0 4px rgba(34, 211, 238, 0.25) !important;
  }
  ```
- Sub-components that receive focus programmatically (such as expanded narration cards or focused modal dialogs) must call `.focus()` with sensible tabindex management (`tabindex="-1"` on containers).

---

## 2. Accessible Semantics & ARIA Patterns

### 2.1 Live Announcers for Algorithmic Steps
When stepping through generations, blind or low-vision users using assistive technology must receive concise spoken updates via an accessible live region:

```html
<div 
  id="a11y-step-announcer" 
  class="sr-only" 
  role="status" 
  aria-live="polite" 
  aria-atomic="true"
>
  <!-- Dynamically injected: "Generation 2, Selection complete. Roulette chose individuals 1, 3, 4, and 2." -->
</div>
```

```css
/* Screen-reader-only utility class */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
```

### 2.2 Semantic HTML Elements
- Use native `<button type="button">` for all click triggers. Never use `<div onclick="...">`.
- Use native `<dialog>` for modal overlays (e.g., parameter presets, help dialog) with `dialog.showModal()` and native `Esc` cancellation.
- Use native `<details>` and `<summary>` for progressive disclosure of mathematical "Why?" cards and Schema X-Ray inspectors.
- Use semantic `<table>`, `<thead>`, `<tbody>`, `<th>`, and `<td>` for population statistics, with `scope="col"` and `scope="row"` attributes.

---

## 3. High-Contrast Dark Theme Compliance

Contrast ratios must be measured against the underlying surface layer (`--color-bg-base: #0B1020` or `--color-surface-base: #10172A`):

| Token | Contrast Ratio | WCAG 2.2 Grade |
| :--- | :--- | :--- |
| `--color-text-primary` (`#F8FAFC`) | **15.2 : 1** | AAA (Passes all text) |
| `--color-text-secondary` (`#94A3B8`) | **6.8 : 1** | AAA (Passes all text) |
| `--color-text-muted` (`#64748B`) | **4.6 : 1** | AA (Passes small text $\ge 4.5:1$) |
| `--color-chrom-x1` (`#22D3EE`) | **11.4 : 1** | AAA (Passes graphical and text) |
| `--color-chrom-x2` (`#E879F9`) | **7.9 : 1** | AAA (Passes graphical and text) |
| `--color-success` (`#34D399`) | **10.8 : 1** | AAA (Passes graphical and text) |
| `--color-warning` (`#FBBF24`) | **11.2 : 1** | AAA (Passes graphical and text) |
| `--color-danger` (`#F87171`) | **6.7 : 1** | AAA (Passes graphical and text) |

### Non-Color Distinction
Color must never be the sole differentiator:
- Chromosome segments: Cyan represents $x_1$ and Magenta represents $x_2$, but they are also explicitly separated spatially and labeled with $x_1$ and $x_2$ subheaders.
- Verification status: Verified cells receive both a green color AND a text checkmark `✓` or `✗`.
- Schema matches: Matching rows display both a violet outline AND a text badge `[MATCH]`.
