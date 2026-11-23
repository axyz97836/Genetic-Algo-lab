# Agent Skills — Installation & Calibration Log

> Auditable record of every skill installed, calibrated, and authored in this workspace.  
> Last Updated: 2026-11-22T22:56 IST

---

## 1. Upstream Skills (Foundational Tooling)

### UI UX Pro Max
| Field | Value |
|---|---|
| **Repository** | <https://github.com/nextlevelbuilder/ui-ux-pro-max-skill> |
| **License** | MIT — Copyright (c) 2024 Next Level Builder |
| **Commit SHA** | `6ec2bb58334ca3014573c4cbd4834ee3a40afd9d` (HEAD of `main`) |
| **Installer** | `ui-ux-pro-max-cli` v2.15.0 via `npx` |
| **Install command** | `npx ui-ux-pro-max-cli init --ai antigravity` |
| **Install location** | `.agents/skills/ui-ux-pro-max/` (+ 6 sibling skill folders) |
| **Legacy paths** | None — `.agent/` verified absent |
| **Global changes** | None |

### Ponytail
| Field | Value |
|---|---|
| **Repository** | <https://github.com/DietrichGebert/ponytail> |
| **License** | MIT — Copyright (c) 2026 DietrichGebert |
| **Commit SHA** | `ebd8654c2c627f721eb8f9c0d1bd4090a29f9e10` (HEAD of `main`) |
| **Install method** | Manual copy per documented Antigravity route in INSTALL.md |
| **Install location** | `.agents/skills/ponytail/` (workspace-local) |
| **AGENTS.md fallback** | Copied to workspace root `./AGENTS.md` (always-on ruleset) |
| **Legacy paths** | None — `.agent/` verified absent |
| **Global changes** | None |

---

## 2. GA Lab Dedicated Workspace Skills (Local Tooling)

Authored specifically for the GA Lab Binary Genetic Algorithm educational workbench to enforce design, data visualization, native interaction, motion, and accessibility standards without external dependencies or frameworks.

| Skill Name | Path | Origin & Purpose |
| :--- | :--- | :--- |
| **ga-lab-product-design** | `.agents/skills/ga-lab-product-design/SKILL.md` | Master product design system, tokens, spatial layout, dark navy `#0B1020` visual guidelines, and anti-pattern guardrails. |
| **ga-lab-native-components** | `.agents/skills/ga-lab-native-components/SKILL.md` | Component architecture inspired by Kokonut UI; translated into semantic HTML5, CSS custom properties, and vanilla ES modules. |
| **ga-lab-data-visualization** | `.agents/skills/ga-lab-data-visualization/SKILL.md` | Data visualization standards inspired by Bklit UI; implemented strictly via native HTML5 Canvas (high-DPI) and inline SVG. |
| **ga-lab-motion** | `.agents/skills/ga-lab-motion/SKILL.md` | Purposeful motion choreography inspired by Motion and Anime.js; implemented via CSS transitions, WAAPI, and rAF with strict reduced-motion compliance. |
| **ga-lab-vanilla-accessibility** | `.agents/skills/ga-lab-vanilla-accessibility/SKILL.md` | WCAG 2.2 AAA/AA compliance, global keyboard shortcuts, 2px visible focus rings, ARIA live region announcers, and contrast verification. |
| **ga-lab-product-polish** | `.agents/skills/ga-lab-product-polish/SKILL.md` | Quality engineering, deterministic state handling, actionable error cards, and progressive disclosure inspired by Manus. |

---

## 3. Audited Reference Documents

| Document | Location | Purpose |
| :--- | :--- | :--- |
| **REFERENCE-MATRIX.md** | `docs/agent-skills/REFERENCE-MATRIX.md` | Complete inspection audit of Kokonut UI, Bklit UI, ThreeUI, Motion, Anime.js, and Manus, recording examined code, principles, and strict non-goals. |

---

## 4. Complete Workspace Skill Inventory

```
.agents/skills/
├── banner-design/SKILL.md          (UI UX Pro Max companion)
├── brand/SKILL.md                  (UI UX Pro Max companion)
├── design-system/SKILL.md          (UI UX Pro Max companion)
├── design/SKILL.md                 (UI UX Pro Max companion)
├── ga-lab-data-visualization/SKILL.md (GA Lab local)
├── ga-lab-motion/SKILL.md          (GA Lab local)
├── ga-lab-native-components/SKILL.md (GA Lab local)
├── ga-lab-product-design/SKILL.md  (GA Lab local)
├── ga-lab-product-polish/SKILL.md  (GA Lab local)
├── ga-lab-vanilla-accessibility/SKILL.md (GA Lab local)
├── ponytail/SKILL.md               (Ponytail core)
├── slides/SKILL.md                 (UI UX Pro Max companion)
├── ui-styling/SKILL.md             (UI UX Pro Max companion)
└── ui-ux-pro-max/SKILL.md          (UI UX Pro Max core)
```

---

## 5. Verification Checklist

| # | Check | Result |
|---|---|---|
| 1 | All skill folders reside under `.agents/skills/` | ✅ 14 skill folders verified |
| 2 | Correct Antigravity discovery path used | ✅ `.agents/skills/` |
| 3 | Upstream UI UX Pro Max scripts resolve | ✅ Verified via `search.py` |
| 4 | No legacy `.agent/skills` copies | ✅ Zero `.agent/` folders exist |
| 5 | No application code, lockfiles, or package.json created | ✅ Workspace remains pristine (Prompt 3 scope respected) |
| 6 | No global configuration modified | ✅ Workspace-local changes only |
