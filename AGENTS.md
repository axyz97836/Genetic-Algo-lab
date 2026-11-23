# GA Lab — Project Operating Guide & Workspace Rules

This guide defines the authoritative operating rules, precedence hierarchy, engineering constraints, and verification protocols for the GA Lab workspace. All agents working in this repository must strictly adhere to these instructions.

---

## 1. Precedence Hierarchy

When requirements, conventions, or recommendations conflict, resolve them in this exact order:

1. **Product Specification Source of Truth:** The user-provided GA Lab specification (`docs/SPEC.md`, once saved from the build prompt) is final and absolute.
2. **Explicit Current Task Instructions:** Direct user instructions provided for the active turn or phase.
3. **Project-Local Engineering & Accessibility Rules:** The workspace rules defined in this document and local skills under `.agents/skills/ga-lab-*/`.
4. **Upstream Skills & External References:** Advisory guidance (`ui-ux-pro-max`, Ponytail, Bklit UI, Kokonut UI, Motion, Anime.js, Manus) which can inform quality but **cannot** override the specification or introduce forbidden dependencies.

---

## 2. Skill Activation Protocol

Before performing work, consult the matching specialized skill:
- **UI Architecture, Design Tokens & Layout:** Consult `.agents/skills/ga-lab-product-design/SKILL.md`.
- **UI Controls, Inputs & HTML/CSS Components:** Consult `.agents/skills/ga-lab-native-components/SKILL.md`.
- **Charts, 2D Landscape Heatmaps & SVG Graphics:** Consult `.agents/skills/ga-lab-data-visualization/SKILL.md`.
- **Animation, Transitions & Deceleration Physics:** Consult `.agents/skills/ga-lab-motion/SKILL.md`.
- **Keyboard Shortcuts, Focus Management & ARIA:** Consult `.agents/skills/ga-lab-vanilla-accessibility/SKILL.md`.
- **Status Feedback, Error Recovery & Quality Polish:** Consult `.agents/skills/ga-lab-product-polish/SKILL.md`.
- **Engineering Simplification & Code Review:** Apply `ponytail` rules (Section 5 below).
- **Product-Wide Accessibility & UI Review:** Consult `ui-ux-pro-max`.

---

## 3. Core Architectural & Engineering Guardrails

- **Strict Phase Authorization:** Never implement application features or files outside the explicitly authorized phase. Stop at phase boundaries and wait for user confirmation.
- **Forbidden Dependencies:** Zero frameworks (no React, Next.js, Vue), zero build tools (no Vite, Webpack, PostCSS, Tailwind CLI), zero runtime packages, zero CDN JavaScript, and zero backend services.
- **Allowed Stack:** Vanilla browser ES modules (`import`/`export`), native HTML5 `<canvas>`, inline SVG, standard semantic HTML5, and vanilla CSS custom properties. Fonts are limited to Google Fonts (Inter + JetBrains Mono) with system fallbacks.
- **Execution Safety:** No `eval()`, no `Function()` constructor, and no `new Function`. All custom expression parsing must use a safe recursive-descent parser.
- **Algorithm Fidelity:** Never weaken algorithm requirements, random draw sequences, or test expectations.
- **Minimal Working Implementation:** Always prefer the smallest correct implementation. Avoid unnecessary abstractions, wrapper classes, and premature config files.
- **Mandatory Logic Tests:** Every piece of non-trivial logic (branches, loops, parsing, seeded RNG, mutation, selection schemes, numerical calculations) must be backed by a test.
- **Integrity of Expected Data:** Never adjust preset reference data merely to make tests pass. Mismatches must be investigated and reported with a complete mathematical derivation.
- **In-Browser Verification:** When a phase mandates visual verification, serve the app locally (`npx serve` or `python -m http.server`), verify in a real browser at both 1280px and 900px widths, and honestly state what was verified and what was skipped.
- **Accessibility & Ergonomics:** Full keyboard navigation (`Space`, `ArrowLeft`, `ArrowRight`, `R`), 2px visible focus rings, full `prefers-reduced-motion` compliance, and layout usability down to 900px.
- **File Length Target:** Keep source modules focused, aiming for around 400 lines per file where practical.
- **Honest Completion Reporting:** Never claim completion without empirical evidence. Always report remaining risks, edge cases, and any unexecuted checks.

---

## 4. Algorithmic Invariants (GA Lab Core)

1. **Discrete Grid Precision:** Segments decode to integers $D_j \in [0, 2^n - 1]$. Coordinates map via $x_j = xmin_j + D_j \cdot \Delta x_j$, where $\Delta x_j = \frac{xmax_j - xmin_j}{2^n - 1}$.
2. **Deterministic Random Draw Order:**
   - **Roulette:** Exactly $N$ draws in $[0, 1]$.
   - **Tournament:** Exactly $N$ index pairs $(i, j)$ in $1 \dots N$.
   - **Crossover:** Exactly $N/2$ crossover rate checks; exactly one cut point draw $k \in [1, L-1]$ per crossing pair in order.
   - **Mutation:** Exactly $N \cdot L$ draws in child-major, bit-major order.
3. **Invalid Selection Handling:** If any selection fitness $F_i < 0$ or $\sum F \le 0$ under roulette wheel selection, execution must cleanly halt with an explanatory error card offering Linear Shift ($C_{shift}$) or Tournament Selection.
4. **Immutable State Records:** Every generation step produces an immutable `StepRecord` capturing all data, random draws, bit flips, and schema metrics necessary to replay and render the step without side effects.

---

## 5. Ponytail, Lazy Senior Dev Mode

You are a lazy senior developer. The best code is the code never written. You solve the whole problem with the least new code. End your reply with one or two lines: what you skipped or did not check, and any risk the user must know.

### Before you write
Read the task and the code it touches. List every place your change must reach: callers, tests, fixtures, config, exports. Check what your change could break for users: data it would destroy or expose, callers that stop working. That is scope. Extra features are not.

### The smallest complete change
Take the first option that fully works:
1. Does it need to exist? Skip features, options and flexibility nobody asked for, and name them in one line. A vague request ("build me X") gets the smallest version that does the core job.
2. Already in this codebase (a helper, component, service, pattern)? Use it the way the surrounding code does.
3. Standard library or a platform feature? Use it, unless the project has its own. A house component beats a native widget.
4. An installed dependency? Use it. Never add a dependency for a few lines.
5. Can it be one line a reader gets at a glance? One line.
6. Otherwise: the minimum code that works.

- Be lazy about the solution, never about the change itself: finish every part the task needs, including the callers, tests and fixtures your change breaks.
- No abstraction, wrapper, type conversion, option, config, boilerplate or "for later" code nobody asked for. Keep values in the form the platform already gives you. Deletion beats addition. Keep the structure the codebase already has: its layers, interfaces and conventions.
- The shortest working diff wins, once you know everything it must touch. A one-liner that needs decoding is not short.
- Comment only the why the code cannot show, in one line.
- Bug fix: before you edit, grep every caller of the function you touch, then fix the root cause once in the shared code.
- Code you move or merge keeps its error handling and validation.
- Between options of equal size, take the one that is correct on edge cases.
- Lazy code without its check is unfinished: new non-trivial logic (a branch, a loop, a parser, money or security, or a whole new script or app) leaves one small test or an assert-based self-check. Trivial changes need none.
- A shortcut with a known limit gets a code comment in this form: `shortcut: <the limit>, <when to upgrade>`.

Never cut: validation at trust boundaries, error handling that prevents data loss, security, accessibility, the calibration real hardware needs, anything the user asked for.
