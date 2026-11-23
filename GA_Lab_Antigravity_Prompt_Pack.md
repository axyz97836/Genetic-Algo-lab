# GA Lab — Antigravity Skill-Training & Build Prompt Pack

Use these prompts **in order, one at a time, in the same Antigravity workspace**. Let Antigravity finish each prompt and inspect its report before sending the next one. Do not send the final build prompt until the skill setup and calibration prompts are complete.

## Important project constraint

GA Lab's source specification requires a **static vanilla JavaScript ES-module application** using native Canvas and SVG. It explicitly prohibits frameworks, build steps, runtime dependencies, and CDN JavaScript. Therefore, some of the named projects below are **reference material, not libraries to install into GA Lab**. This is intentional: learn from their design quality without violating the actual product specification.

- **Install as actual agent skills:** UI UX Pro Max; Ponytail.
- **Study as UI/component references only:** Kokonut UI; Bklit UI; ThreeUI; Motion; Anime.js; Manus.
- **Create GA Lab-specific local skills:** product/design system, native data visualization, native motion, vanilla interaction/accessibility, and engineering/test discipline.

Antigravity's workspace skill directory is `.agents/skills/<skill-name>/SKILL.md`. Its global skill directory is separate; these prompts use project-local skills and must not silently change global settings. Antigravity discovers skills from `.agents/skills` and supports invoking them by `/<skill-name>`. See the official documentation: https://antigravity.google/docs/skills

---

# Prompt 1 — Set up the two foundational agent skills

Paste this into Antigravity first:

```text
Act as a careful AI tooling/agent-platform engineer. I want to prepare this workspace for a serious software project. Do NOT implement the application yet.

GOAL
Set up and verify two foundational skills for this Antigravity workspace:
1. UI UX Pro Max by nextlevelbuilder.
2. Ponytail by DietrichGebert.

SAFETY AND SCOPE
- Work only inside this workspace unless I explicitly authorize a global installation.
- Do not install anything globally.
- Do not change Antigravity user settings, MCP servers, editor preferences, shell profiles, or unrelated projects.
- Do not add runtime dependencies to the future application.
- Before copying or executing any downloaded skill/script, inspect its source, license, install instructions, and scripts.
- Do not blindly overwrite existing files. Inspect first; preserve and merge existing configuration.
- Keep a clear installation log with repository URL, version/tag or commit SHA, install location, files added/changed, and verification result.

UI UX PRO MAX
Repository: https://github.com/nextlevelbuilder/ui-ux-pro-max-skill
Official skill name: ui-ux-pro-max
Use the supported Skills CLI installation for Antigravity, preferably:
`npx skills add nextlevelbuilder/ui-ux-pro-max-skill --skill ui-ux-pro-max -a antigravity`
Before running it, inspect the CLI help/version and the repository's installation instructions. Ensure the resulting skill folder is under this workspace's `.agents/skills/` directory and contains its required SKILL.md plus any scripts/data it needs. If the CLI writes to a legacy `.agent/skills/` path, move it to `.agents/skills/` only after verifying the complete folder structure and references. Do not leave duplicate or broken copies.

PONYTAIL
Repository: https://github.com/DietrichGebert/ponytail
Read its current README, INSTALL.md, AGENTS.md, and `skills/ponytail/SKILL.md` before changing anything. Follow the current documented Antigravity installation route. Prefer a workspace-local skill at `.agents/skills/ponytail/` containing the complete upstream skill and any required companion files. Also use the repository's compact AGENTS.md fallback only as documented, merging it carefully into a root AGENTS.md if needed. If a root AGENTS.md already exists, preserve it and merge only non-conflicting Ponytail guidance; never replace project rules silently.

VERIFY
1. List the exact skill folders and SKILL.md files installed.
2. Confirm Antigravity's expected `.agents/skills/` path is used.
3. Check that scripts/references bundled with UI UX Pro Max still resolve from their installed location.
4. Check for duplicated legacy `.agent/skills` copies and broken paths.
5. Confirm that no application package.json, lockfile, runtime source, or global configuration was changed.
6. Explain how I can inspect/invoke each skill in Antigravity (including the slash-command name where supported).

DELIVERABLE
Create or update `docs/agent-skills/INSTALL-LOG.md` with an auditable record. Do not create application code, do not scaffold the app, and do not begin Phase 1. Stop after reporting the results and any blocker.
```

---

# Prompt 2 — Teach Antigravity the design-system skill and the visual quality bar

Send this after Prompt 1 succeeds:

```text
Act as a principal product designer and design-systems engineer. This is a skill-training task, not an application implementation task.

First, read the installed UI UX Pro Max SKILL.md completely, including its relevant design-system, dashboard, chart, typography, color, accessibility, responsive-layout, and visual-review guidance. Use its actual bundled search scripts/data when relevant; do not pretend to have used a search tool if you did not run it.

Create one focused workspace skill:
`.agents/skills/ga-lab-product-design/SKILL.md`

The skill must teach you how to design a premium, credible educational/scientific desktop web application rather than a generic AI SaaS dashboard. It must contain:
- Product/audience analysis before choosing a visual style.
- A coherent token system: color roles, typography scale, spacing, radii, borders, shadows, elevation, and motion tokens.
- Clear information hierarchy for complex technical information.
- Dense-but-readable data tables, labels, controls, tooltips, legends, and educational narration.
- Accessible keyboard behavior, visible focus, contrast, reduced-motion support, and responsive layout.
- Interaction states: default, hover, focus, pressed, disabled, loading, empty, success, warning, and error.
- A real-browser visual QA checklist at multiple viewport widths.
- Rules against generic AI-generated UI, over-decoration, fake metrics, meaningless animations, inconsistent components, and decorative elements that reduce comprehension.

PROJECT DESIGN DIRECTION TO PRESERVE
The eventual product is GA Lab, a browser-based Binary Genetic Algorithm teaching tool. Its product specification is authoritative. The visual direction is dark deep navy `#0B1020`, layered surfaces, subtle gradient/noise texture, restrained glassmorphism only on panels, translucent 1px borders, and soft purposeful glows. Use cyan `#22D3EE` for x1, magenta `#E879F9` for x2, success `#34D399`, warning `#FBBF24`, danger `#F87171`, and violet `#8B5CF6` as an accent. Use Inter and JetBrains Mono with system fallbacks. The interface should prioritize algorithm comprehension over decoration.

IMPORTANT
- The product specification takes precedence over generic recommendations from UI UX Pro Max.
- Do not change the specified palette to another palette just because a skill recommends it.
- Do not introduce React, Next.js, Tailwind, shadcn, icon packages, chart packages, or any framework.
- Do not add app code or mockups yet.

At the end, show the complete skill file and a short explanation of how Antigravity should trigger it. Stop.
```

---

# Prompt 3 — Learn the other UI, chart, 3D, and motion references without importing incompatible stacks

Send this after Prompt 2:

```text
Act as a staff-level interaction designer, data-visualization engineer, and frontend performance specialist. This is a research-and-skill-authoring task. Do not implement GA Lab yet.

Study these exact references. Read their current README/docs and inspect representative source/examples where publicly available. Record the source URL and what you actually inspected. Do not claim to have examined code you did not open.

A. Kokonut UI
https://github.com/kokonut-labs/kokonutui
Learn from its functional component patterns, meaningful states, controls, command menus, compact cards, feedback, and interaction details. It is a React/Tailwind/shadcn/Motion component ecosystem, so do NOT install its components or dependencies into GA Lab.

B. Bklit UI
https://github.com/bklit/bklit-ui
https://bklit.com/docs/skills
Learn from its chart vocabulary, heatmaps, axes, legends, tooltips, data density, chart composition, visual encoding, and theming approach. Its published skills and component installation flow are designed around the Bklit registry/shadcn workflow. Do NOT install the Bklit chart components, shadcn, or the Bklit runtime into GA Lab. Translate useful principles into native Canvas/SVG patterns.

C. ThreeUI
https://github.com/MengTo/threeui
Study its visual craft, depth, lighting, composition, and restraint. Its community package is a React/Three.js component catalog. GA Lab is not a 3D landing page: do NOT install ThreeUI, React, Three.js, WebGL, or its package. Use 3D only as a visual reference; prefer clarity and performance over spectacle.

D. Motion
https://github.com/motiondivision/motion
Learn timing, easing, choreography, state transitions, reduced-motion behavior, and animation restraint. Do NOT install the Motion runtime.

E. Anime.js
https://github.com/juliangarnier/anime
Learn timeline sequencing, easing, stagger, and SVG/DOM animation principles. Do NOT install animejs.

F. Manus
https://manus.im/
Study product-level clarity, workflow guidance, polished status feedback, and useful progressive disclosure. Treat it as product inspiration, not a template to copy.

CREATE THESE WORKSPACE SKILLS
1. `.agents/skills/ga-lab-native-components/SKILL.md`
   - General component principles inspired by Kokonut UI.
   - Translate every proposed component to semantic HTML, CSS, and vanilla ES modules.
   - Avoid copying source code; do not add React/shadcn/Tailwind dependencies.

2. `.agents/skills/ga-lab-data-visualization/SKILL.md`
   - Chart and heatmap design principles informed by Bklit UI.
   - Implementation must use native Canvas and SVG only, as appropriate to GA Lab's specification.
   - Include readable axes, legends, scales, tooltips, perceptually meaningful color encoding, empty/error states, and data-driven rendering.
   - Never invent or distort data; all visuals must be driven by engine StepRecords or the defined objective grid.

3. `.agents/skills/ga-lab-motion/SKILL.md`
   - Motion principles informed by Motion and Anime.js.
   - Implement with CSS transitions/animations, Web Animations API, and requestAnimationFrame only.
   - Respect `prefers-reduced-motion`; never block controls or make data harder to read.
   - Do not create scroll-jacking, cursor-following decoration, gratuitous parallax, or perpetual motion.

4. `.agents/skills/ga-lab-vanilla-accessibility/SKILL.md`
   - Semantic HTML, keyboard navigation, visible focus, accessible names, contrast, reduced motion, responsive layouts, and robust native-control behavior.

5. `.agents/skills/ga-lab-product-polish/SKILL.md`
   - Useful progress feedback, explanatory empty/error states, progressive disclosure, clear recovery actions, no fake stats, and no placeholder UI.

Every skill must have valid YAML frontmatter with a unique lowercase `name` and a useful third-person `description`. Keep the skills focused and avoid duplicating the upstream UI UX Pro Max/Ponytail instructions.

CONFLICT RULE
The GA Lab product specification is the source of truth. These references are learning sources only. Do not add runtime dependencies, frameworks, a build step, external JS/CDN scripts, or incompatible components. Do not copy substantial code from the reference repositories.

DELIVERABLE
Create `docs/agent-skills/REFERENCE-MATRIX.md` with columns: reference, what was inspected, useful principles, what is forbidden/incompatible for GA Lab, and the local skill that captures the lessons. Include limitations and unknowns honestly. Update `docs/agent-skills/INSTALL-LOG.md` with the new local skill files. Do not implement application code. Stop.
```

---

# Prompt 4 — Consolidate the rules and calibrate Antigravity before implementation

Send this after Prompt 3:

```text
Act as the technical lead for this workspace. Do not implement the product yet.

Read every installed/local skill under `.agents/skills/`, the root `AGENTS.md` if present, and the agent-skills installation/reference logs. Resolve overlaps and write a concise, enforceable project operating guide in the root `AGENTS.md` (preserve existing valid content; do not silently overwrite it).

The operating guide must establish this precedence:
1. The user-provided GA Lab specification (`docs/SPEC.md` once created by the final build prompt) is the product source of truth.
2. Explicit user instructions for the current task.
3. Project-local engineering and accessibility rules.
4. Upstream skills and external design references, which are advisory and cannot override the specification.

The guide must state:
- Read the relevant skill before work; invoke the design skill for UI work, visualization skill for charts/heatmaps, motion skill for animation, accessibility skill for controls, Ponytail for engineering simplification/review, and UI UX Pro Max for product-wide design review.
- No application changes outside the explicitly authorized phase.
- No frameworks, build tools, runtime packages, CDN JS, or backend.
- Vanilla ES modules, Canvas, SVG, HTML, CSS only; Google Fonts are specified for fonts with system fallbacks.
- No `eval()` or `Function` constructor; no weakening of algorithm details or test expectations.
- Prefer the smallest correct implementation; avoid abstractions and dependencies that do not solve a real requirement.
- Add tests for logic with branches, loops, parsing, RNG, mutation, selection, or numerical calculations.
- Never change expected preset values merely to make tests pass; report mismatches with derivations.
- Verify the actual app in a browser when the phase requires it; report what was and was not verified.
- Respect `prefers-reduced-motion`, keyboard access, visible focus, and the 900px layout target.
- Keep each source file around 400 lines where practical.
- Do not claim completion without evidence; mention skipped checks and residual risks.

CALIBRATION EXERCISE — ANALYSIS ONLY
Using the skills and operating guide, produce a no-code design/engineering calibration report for GA Lab:
1. Explain how the layout supports the learning sequence Decode → Select → Crossover → Mutate.
2. Explain what belongs in the control rail, center visual stage, narration/Schema X-Ray area, and timeline/convergence area.
3. Explain how you will keep the heatmap, population table, chromosome strips, roulette/tournament visuals, and convergence chart synchronized from immutable StepRecords.
4. Explain how you will preserve deterministic replay and exact random draw order.
5. List the top 10 risks that could cause incorrect algorithm behavior or misleading teaching visuals, and the tests/verification that will catch each risk.
6. Identify which reference-derived ideas you will deliberately NOT use because they conflict with the specification.

Do not create UI mockups, source files, app dependencies, or implementation code. Do not begin Phase 1. Report any missing skills or conflicts, then stop.
```

---

# Prompt 5 — Final build prompt for GA Lab

**Send this last.** It contains the product specification. This is the only prompt in the sequence that authorizes application implementation. It explicitly authorizes Phase 1 only; Antigravity must stop after Phase 1 and wait for your `continue` message before starting Phase 2.

```text
YOU ARE: a senior engineer and award-winning product designer. Build "GA Lab", a complete, deployable, browser-based Binary Genetic Algorithm teaching tool with a Schema X-Ray feature. No stubs, no leftover TODOs, no placeholder UI.

BEFORE ANY CODE:
1. Read the root AGENTS.md and all relevant installed workspace skills.
2. Save everything between "=== SPEC START ===" and "=== SPEC END ===" below VERBATIM to `docs/SPEC.md`. Do not paraphrase, reformat, correct, or omit anything inside those markers.
3. Create `docs/PROGRESS.md` with the six phases, their checks, and an unchecked/checked status. Do not mark work complete before it is verified.
4. Inspect the repository state and existing files. Do not overwrite unrelated work.
5. Then perform Phase 1 only.

PHASE BOUNDARIES:
After each phase: run that phase's checks, update PROGRESS.md, give a summary of at most 10 lines, and STOP until I reply exactly `continue`. Do not start a later phase in the same turn. If context is tight, re-read docs/SPEC.md instead of asking me. Never rewrite earlier-phase files except to fix a bug; state why when doing so.

SKILL USAGE:
- Use UI UX Pro Max and ga-lab-product-design for design decisions and reviews.
- Use ga-lab-native-components and ga-lab-vanilla-accessibility for controls and interface components.
- Use ga-lab-data-visualization for Canvas/SVG data visualization.
- Use ga-lab-motion for motion design.
- Use ga-lab-product-polish for feedback, errors, empty states, and progressive disclosure.
- Use Ponytail for engineering discipline, minimalism, and code review.
- These skills are subordinate to docs/SPEC.md. Never use the skills as justification to add forbidden frameworks or dependencies.

=== SPEC START ===

# 0. INPUTS FROM ME
If lecture PDFs are attached, read them. They contain 4 two-variable problems (min/max, bounds such as [0,15] and [-8,7]) and seeded 3-generation runs (initial chromosomes plus every random number used, plus expected tables). Encode them in data/presets.js (schema in §10). Any value you cannot read stays `null`; the Verify panel then shows "no reference data" for that cell. NEVER invent or "fix" expected values. If a mismatch appears, report it with a worked derivation; do not silently change code or expectations to force a pass.
Independent of the PDFs, §9 gives a hand-calculated reference run. It must be encoded as presets `ref-roulette`, `ref-tournament`, `ref-negative` and must pass.

# 1. TECH
Static site: vanilla ES modules, Canvas (heatmap, wheel), SVG (charts, bracket). No build step, no runtime dependencies, no frameworks, no CDN JS. Fonts: Inter + JetBrains Mono (Google Fonts) with system fallbacks.
Folders: index.html, tests.html, css/(tokens, layout, components), js/(engine/, ui/, viz/, main.js), data/(problems.js, presets.js), tests/, docs/, README.md. Keep files under about 400 lines each.
ES modules do not load from file://. README must say to use `npx serve` or `python -m http.server` locally, and give 3 deploy paths (GitHub Pages, Netlify, Vercel).
Primary target 1280px+, usable at 900px. Keyboard accessible, visible focus rings, prefers-reduced-motion respected, no console errors or warnings, no eval().

# 2. ALGORITHM (exact)
Conventions: UI and narration use 1-based bit positions; internal arrays are 0-based. Position 1 is the leftmost bit, the MSB of x1.
Chromosome: n-bit segment for x1 followed by an n-bit segment for x2, n in {4,5}, L = 2n.
Decode: D_j = integer value of segment j. Δx_j = (xmax_j − xmin_j)/(2^n − 1). x_j = xmin_j + D_j·Δx_j.
Objective f(x1,x2) from the problem, type "min" or "max".

Fitness F (used by roulette and the schema bound), `fitnessMode`:
- "max": F = f.
- "min-inverse": F = 1/(1+f). If any f ≤ −1, show an error card that explains why and offers "min-cminus".
- "min-cminus": F = C − f, with C user-editable, default = the maximum of f over the whole grid (so F ≥ 0). Display C.
Default: "max" for max problems, "min-inverse" for min problems (or the preset's mode).

Selection builds a mating pool of N:
- Roulette: p_i = F_i/ΣF, q_i = cumulative sum, with q_N forced to exactly 1. For each spin draw r in [0,1] and pick the first i with p_i > 0 and r ≤ q_i (this makes r = 0 pick the first positive-weight individual, r = q_i pick i, and never select an empty slice). F_i = 0 is allowed (empty slice).
  INVALID if any F_i < 0 or ΣF ≤ 0. Do NOT silently fix. Halt with an explanation card showing the broken wheel (negative slices red-striped) and two actions: "Apply shift C_shift" or "Switch to Tournament".
  Shift: F' = F + C_shift, C_shift = −min(F) + ε, ε = 0.1·(max(F) − min(F)), or 1 if that range is 0. Show C_shift and ε. Use F' for p, q and the schema bound afterwards.
- Binary tournament: N rounds. Each round draws two indices (the same index twice is allowed). The winner is the one with the better f by problem direction (min: lower f; max: higher f); a tie picks the first drawn. Works with negative values, no shift.

Crossover: pair the mating pool consecutively (1-2, 3-4, …). N must be even (enforce in the UI). Per pair draw one rand; the pair crosses iff rand OP_c p_c. Then draw cut k uniformly in 1..L−1: the first k bits stay, the tails after k swap. If not crossing, copy unchanged and consume no cut draw. Flag k == n ("whole-variable swap: x1 and x2 are exchanged intact") and k ≠ n ("variable j is rebuilt from mixed bits", where j = 1 if k < n else 2).
Mutation: for each child (1..N), for each bit (1..L), in that order, draw one rand; flip iff rand OP_m p_m. Record bit position, variable j, within-segment weight w (w = 0 is the LSB) and Δvalue = ±2^w·Δx_j (+ for 0→1, − for 1→0).
Comparison operators OP_c and OP_m are preset fields `crossCmp`, `mutCmp`, each "<=" or "<". Default is "<=" for both; the presets set whichever the notes use.
Replacement is generational: children become the next population. Optional elitism (default OFF): the best individual of the old population (by selection direction) replaces the worst child.
Stats per generation: best, average and worst f (best = min for min problems), best chromosome, distinct chromosome count.

RNG: engine code only uses an injected rng with named draws rng.roulette(), rng.tourn() (returns an index pair), rng.cross(), rng.cutPoint(L), rng.mut().
Draw counts and order per generation: roulette N draws (roulette only); tournament N pairs (tournament only); cross N/2 draws; cut one draw per crossing pair, in pair order; mut N·L draws in child-major order.
Two implementations: Mulberry32 seeded (free play) and ScriptedRNG replaying queues from a preset. Presets may include an optional `stopAfter` phase (`"DECODE_EVAL" | "SELECT" | "MUTATE"`) on a generation entry for partial reference runs (`ref-tournament`, `ref-negative`, and final-generation evaluation checks). ScriptedRNG THROWS a descriptive error (queue name, generation, index) if a queue runs dry during an executed phase or a value is out of range, and the UI shows it as an error card.
In Verify Mode, lock problem and parameter controls (with a one-click "Clone to Free Play" button to edit freely with Mulberry32) so scripted queues never desync accidentally.

# 3. ENGINE ARCHITECTURE (pure, no DOM)
runGeneration(pop, params, rng) → immutable ordered StepRecord[]: DECODE_EVAL, SELECT, CROSSOVER, MUTATE, REPLACE (plus INIT for generation 0), stopping early if `stopAfter` is specified. Each record holds everything needed to render and narrate it (tables, indices, r values, cut points, flips with weights, shifts, flags).
Timeline caches records per generation, so play, pause, step forward, step BACK and scrub all work by index. Any parameter or problem change resets and recomputes from the seed.
Narration is template-generated from record data (never hardcoded numbers), with an expandable "Why?" line giving the theory reason.
data/problems.js includes a safe recursive-descent expression parser (numbers, x1, x2, + − * / ^, parentheses, sin cos tan exp log sqrt abs) with inline errors. No eval, no Function constructor. If any point on the current discrete grid evaluates to NaN or ±Infinity, reject the custom expression with a clear inline error.

# 4. FEATURES
1. Controls: problem picker (4 note presets, §9 reference presets, plus custom expression which has no Verify), bounds editor, precision (4-bit/5-bit), N, p_c, p_m, selection scheme, fitness mode, elitism, seed, max generations. Validate every input inline.
2. Playback: Play, Pause, Step (sub-step), Next Generation, Step Back, Reset, speed slider, scrubber with sub-step ticks, shortcuts (Space, ←/→, R), granularity toggle (sub-step or whole generation).
3. Visualizations, all driven by StepRecords with eased transitions:
 a. Heatmap: draw one cell per discrete grid point (2^n × 2^n), colored by f with a perceptually uniform map and legend. Mark the true grid optimum with a star. Show Δx. Individuals are glowing dots exactly at (x1,x2) with fading trails. Parents get rings; children appear as ghost dots then settle; a mutation draws a jump line old→new. Hover shows (D1,D2,x1,x2,f).
 b. Population table: id, bitstring (x1 segment cyan, x2 magenta), D1, D2, x1, x2, f, F, p_i, q_i, with columns revealed progressively per phase.
 c. Chromosome strips: per-bit cells with position and weight 2^w labels. Crossover animates parents, the cut line and the tail swap. Mutation shows the flip with the badge "±2^w·Δx = ±value" and a caption contrasting MSB (huge jump) with LSB (fine tuning).
 d. Selection: a real animated roulette wheel (slice ∝ p_i, pointer eases to r, landing slice highlighted, r and the q-interval shown), tournament bracket cards (two contenders, f values, winner badge), and the negative-fitness failure state from §2.
 e. Convergence chart: best/avg/worst f plus diversity per generation.
 f. Narration panel: step title and plain-language text, with "Why?".
4. VERIFY MODE: loads a preset with ScriptedRNG. Compare every computed cell (D1, D2, x1, x2, f, F, p, q, mating pool, k, children, mutated strings) with expected values: numbers with tolerance 0.5·10^(−decimals used in the notes) + 1e-9 (default 6 decimals), strings exactly. Show ✓ green or ✗ red, hover shows expected vs actual. Show per-generation and global counters computed dynamically (matched/total). A null expected cell shows "no reference" and is excluded from the total.
5. SCHEMA X-RAY (collapsible, the unique feature):
- Definitions, 1-based: o(H) = number of fixed (0/1) positions. first/last = first/last fixed positions. d(H) = last − first. A cut after position k lies INSIDE the defining span iff first ≤ k < last.
- Template editor: click a position to cycle 0 → 1 → *; presets list; "Auto-track": enumerate schemas of order 2–4, keep those with m ≥ 2 and f(H) > f̄, pick max f(H)/f̄, tie → smaller d, then lexicographic; if none, say "no qualifying schema".
- Live metrics: o, d, m(H,t), f(H,t) = mean selection-fitness F of matching members (the shifted F' if a shift is active), f̄(t) = mean F.
- Highlight matches in table rows, heatmap dots and bit strips (matched bits outlined).
- CROSSOVER: if k is inside the span, show chip "cut inside d(H)", then check each child for real and label it "survived" or "disrupted" (a cut inside the span is only a risk; if both parents match H, nothing breaks, and the narration says so). Cuts outside the span: "cut outside d(H): cannot disrupt".
- MUTATE: list flips that hit a fixed position of H (these break a matching child) versus flips on * positions.
- Chart: observed m(H,t+1) versus the lower bound computed from generation t:
   - Textbook form (solid line): E[m(H,t+1)] ≥ m(H,t) · (f(H,t)/f̄(t)) · (1 − p_c·d(H)/(L−1) − o(H)·p_m), clamped at ≥ 0.
   - Exact-mutation form (dashed line): E[m(H,t+1)] ≥ m(H,t) · (f(H,t)/f̄(t)) · (1 − p_c·d(H)/(L−1)) · (1 − p_m)^o(H), clamped at ≥ 0.
   - If m(H,t) = 0, both bounds are 0. Align both on the t+1 axis. A run below the bound is shown neutrally ("bound is an expectation; single runs can fall below it"), not as an error.
   - Under tournament selection, label the curve "proportionate-selection bound (reference only)" with a note that the theorem as stated assumes fitness-proportionate selection.

# 5. VISUAL DESIGN (premium)
Dark deep-navy base #0B1020 with layered surfaces, subtle gradient mesh/noise, 1px translucent borders, soft glows, restrained glassmorphism on panels only. CSS tokens: x1 cyan #22D3EE, x2 magenta #E879F9, success #34D399, warn #FBBF24, danger #F87171, accent violet #8B5CF6, plus spacing, radii, shadows, motion durations and easings.
Layout: top bar (logo, problem picker, Verify toggle) / left control rail / center stage (heatmap + step visualization) / right narration + Schema X-Ray / bottom timeline + convergence chart.
Animated phase stepper (Decode → Select → Crossover → Mutate), button press states, number count-ups, tooltips. Inter for UI, JetBrains Mono with tabular-nums for bitstrings and numbers. No layout shift, 60fps requestAnimationFrame, devicePixelRatio-aware canvases.

# 6. PHASES
P1 Engine + tests, no UI: engine/*, problems.js with the parser, presets.js, tests/engine.test.mjs. Run `node --test` until green. Print the Gen-1 table of each preset and compare with expected values; report mismatches, do not adjust expectations.
P2 Design system + shell + controls + playback + narration + population table + chromosome strips. No canvas yet. Verify every control resets or updates the Timeline.
P3 Heatmap + convergence chart. Test 4-bit, 5-bit and negative bounds; confirm every dot sits exactly on a grid point.
P4 Roulette wheel, negative-fitness failure state with its two actions, tournament bracket, crossover and mutation animations.
P5 Verify mode + tests.html (same checks as the node tests, pass/fail in-browser). Walk Gen 1–3 of every preset and report match counts.
P6 Schema X-Ray, polish (motion, spacing, empty states, focus rings, 900px layout), README, full test run, then a self-audit against §7 listing any unmet item.

Verification rule for P2–P6: before summarizing and stopping each phase, start a local static server (`npx serve` or `python -m http.server`), open `index.html` (and `tests.html` in P5–P6) in the browser tool, confirm zero console errors/warnings, and visually verify layout and interactions at both 1280px and 900px widths.

# 7. DEFINITION OF DONE
tests/engine.test.mjs (node --test) covers: Δx values; decode of known strings; roulette p/q and interval edge cases (r = 0, r = 0 with F_1 = 0 empty slice, r exactly = q_i, r = 1); negative-fitness detection and C_shift math; tournament direction for min and max, ties, and the same index twice; crossover tail swap at k = 1, k = n, k = L−1 and the no-cross copy; mutation weight and Δvalue math; custom expression parser including NaN/Infinity grid rejection; schema o/d/m, span rule (first ≤ k < last), bound formulas (textbook and exact); ScriptedRNG error on exhaustion (in executed phases) and out-of-range; `stopAfter` partial runs; elitism; full replay of every preset; and every number in §9.
No console errors; no eval; inline validation; README with features, screenshots section, how to verify, deploy steps (GitHub Pages, Netlify, Vercel), definitions.

# 8. NON-GOALS
No backend, no frameworks, no CDN JS libraries.

# 9. HAND-CALCULATED REFERENCE RUN (must be reproduced exactly)
Problem: f = x1² + x2², type min, bounds [0,15] for both, n = 4 (Δx = 1, L = 8), N = 4, p_c = 0.8, p_m = 0.05, fitnessMode "min-inverse", crossCmp "<=", mutCmp "<=", no elitism.
Initial population and Gen-1 evaluation (ΣF = 0.078861; round p and q to 5 decimals, F to 6):
 c1 00110101 D=(3,5) f=34 F=0.028571 p=0.36230 q=0.36230
 c2 10010010 D=(9,2) f=85 F=0.011628 p=0.14745 q=0.50975
 c3 01001000 D=(4,8) f=80 F=0.012346 p=0.15655 q=0.66630
 c4 00010110 D=(1,6) f=37 F=0.026316 p=0.33370 q=1.00000
Gen-1 stats: best 34, avg 59, worst 85.
`ref-roulette` scripted:
 Gen 1: roulette r = [0.20, 0.60, 0.95, 0.40] → picks c1, c3, c4, c2 (pool 00110101, 01001000, 00010110, 10010010).
 cross rands = [0.50, 0.90] → pair 1 crosses (0.50 ≤ 0.8), pair 2 does not. cut = [3] (used once).
 Children before mutation: 00101000, 01010101, 00010110, 10010010. Note k = 3 ≠ n, so x1 is rebuilt from mixed bits while x2 swaps intact.
 mut rands: 32 values, all 0.50 except draw 8 = 0.03 (child 1, position 8) and draw 25 = 0.01 (child 4, position 1).
 Flips: child 1 pos 8 → x2, w = 0, Δ = +1 (x2: 8→9). Child 4 pos 1 → x1, w = 3, Δ = −8 (x1: 9→1).
 Gen 2 (`stopAfter: "DECODE_EVAL"`): population 00101001, 01010101, 00010110, 00010010 with f = 85, 50, 37, 5. Stats: best 5, avg 44.25, worst 85.
`ref-tournament` (`stopAfter: "SELECT"`): same Gen-1 population, tourn pairs (1-based) = [(1,2),(3,4),(2,4),(1,3)] → winners c1, c4, c4, c1 (min, lower f wins: 34<85, 37<80, 37<85, 34<80).
`ref-negative` (`stopAfter: "SELECT"`): f = x1 + x2, type max, bounds [−8,7], n = 4 (Δx = 1), N = 2, population 00000000 (x = −8,−8, f = −16) and 00010001 (x = −7,−7, f = −14). Roulette is INVALID (F<0, ΣF = −30). Shift: range = 2, ε = 0.2, C_shift = 16.2, F' = [0.2, 2.2], ΣF' = 2.4, p = [0.08333, 0.91667].
Schema check on the ref-roulette Gen-1 population, H = 00****** (L = 8): o = 2, d = 1, matches c1 and c4 → m = 2; f(H) = mean(0.028571, 0.026316) = 0.027444; f̄ = 0.019715; ratio = 1.3920; survival factor = 1 − 0.8·1/7 − 2·0.05 = 0.785714; textbook bound E[m(2)] ≥ 2.187; exact-mutation form (factor 0.885714·0.9025 = 0.799357) ≈ 2.225; observed m(2) = 3 (00101001, 00010110, 00010010 match; 01010101 does not).
Cut k = 3 is outside H's span (first = 1, last = 2); k = 1 is inside; k = 2 is outside.
Other checks: Δx for n = 5, [−8,7] = 15/31 ≈ 0.483871; for n = 4, [−8,7] = 1.

# 10. presets.js SCHEMA
export const PRESETS = [{ id, title, problemId, type: "min"|"max", n: 4|5, bounds: [[xmin1,xmax1],[xmin2,xmax2]], N, pc, pm, crossCmp, mutCmp, selection: "roulette"|"tournament", fitnessMode, C: null|number, decimals: {x1,x2,f,F,p,q}, initialPop: ["…"], generations: [{ stopAfter?: "DECODE_EVAL"|"SELECT"|"MUTATE", roulette: [r…], tourn: [[i,j]…], cross: [rand…], cut: [k…], mut: [rand…], expected: { D1:[], D2:[], x1:[], x2:[], f:[], F:[], p:[], q:[], pool:[], children:[], mutated:[] } }] }];
Tournament indices are 1-based in presets and notes.

=== SPEC END ===

NOW DO THE FIRST ACTION, THEN PHASE 1 ONLY.

PHASE 1 SCOPE REMINDER:
Implement only the pure algorithm engine, safe expression parser, required preset data, and Node tests described in §6 P1. Do not build the UI, CSS design system, playback, charts, roulette wheel, Schema X-Ray interface, README polish, or any later-phase feature in Phase 1.

PHASE 1 VERIFICATION:
- Run `node --test` until all Phase 1 tests pass.
- Print the Gen-1 evaluation table for every available preset and compare it to the expected values.
- Do not invent missing lecture-PDF values; keep unread/missing expected cells as null as required.
- Do not change hand-calculated reference values to force a pass.
- Report any unresolved mismatch with a worked derivation.
- Confirm there is no `eval()`, no `Function` constructor, no runtime dependency, and no framework/build tooling added.
- Update docs/PROGRESS.md accurately.
- Give a summary of at most 10 lines and STOP. Wait for my explicit `continue` before Phase 2.
```


---

## Verified reference classification (important)

| Name | Classification for this project | What Antigravity may do |
|---|---|---|
| UI UX Pro Max | Actual agent skill | Install project-locally and invoke for design work |
| Ponytail | Actual engineering agent skill/ruleset | Install project-locally and use for simplification/review |
| Kokonut UI | React/Tailwind/shadcn/Motion component library | Study interaction/component patterns only; do not add its dependencies |
| Bklit UI | Chart/component registry plus agent skills for that ecosystem | Study chart design/vocabulary only; implement with native Canvas/SVG |
| ThreeUI | React/Three.js/WebGL component catalog | Study visual craft only; do not install React/Three.js or 3D runtime |
| Motion | JavaScript/React/Vue animation library | Study timing/easing only; use native CSS/WAAPI/rAF |
| Anime.js | JavaScript animation library | Study timelines/easing only; do not add package |
| Manus | Product reference, not a GitHub skill repository | Study workflow clarity and feedback, do not clone its UI |

## Source links

- Antigravity Agent Skills documentation: https://antigravity.google/docs/skills
- UI UX Pro Max: https://github.com/nextlevelbuilder/ui-ux-pro-max-skill
- Ponytail: https://github.com/DietrichGebert/ponytail
- Kokonut UI: https://github.com/kokonut-labs/kokonutui
- Bklit UI: https://github.com/bklit/bklit-ui
- Bklit Skills documentation: https://bklit.com/docs/skills
- ThreeUI: https://github.com/MengTo/threeui
- Motion: https://github.com/motiondivision/motion
- Anime.js: https://github.com/juliangarnier/anime
- Manus: https://manus.im/

