# Unification Audit — System, Architecture & UI

> **This audits the OLD tree (`H:\smsh`), not PixULA.** Every bypass and
> duplicate counted below is what the rebuild was created to remove; the rules
> distilled from it are enforced mechanically here by
> `tests/lint-architecture.test.js`. Read it for
> *why* the architecture is shaped this way — never as a description of this
> tree. This tree: 124 JS files / 64,450 lines, 6 CSS files / 3,920 lines
> (measured 2026-08-08).

**Date:** 2026-07-03 · **Branch:** audit/zx-compliance · **Scope:** full JS (41k lines), CSS (11 files), index.html

Objective: map the path from the current ad-hoc growth to a strictly unified vanilla
architecture — single source of truth for every feature, no new dependencies.

Verdict up front: the codebase is **not** spaghetti — it already has the right skeleton
(`EventBus`, `Helpers`, `variables.css` tokens, `constants.js` palette, IIFE singletons).
The fragmentation is **discipline drift**: the shared infrastructure exists but is bypassed
in dozens of places, and `app.js` has absorbed ~900 lines of UI code that belongs in
components. The strategy below is therefore mostly *consolidation and enforcement*,
not re-architecture.

---

# PART 1 — CURRENT FRAGMENTATION BOTTLENECKS

## Pillar 1: Logic & Dependency Architecture

### 1.1 Function redundancy — `Helpers` exists but is bypassed

| Duplicated logic | Canonical home (exists today) | Bypass count | Evidence |
|---|---|---|---|
| clamp (`Math.max(a, Math.min(b, v))`) | `Helpers.clamp` / global `clamp()` | **~40 inline copies** | brush-engine.js ×13, universal-window.js ×6, reference-layer-manager.js, input-handler.js:298, png-format.js:354-356, color-manager.js:164, border-control.js:114, app.js:1362, … |
| Blob download (`createObjectURL` -> `<a>` -> click -> revoke) | `Helpers.downloadFile` | **11 copies** | every `js/io/*` handler (`scr-format.js:110-124`, png, jpg, bmp, tap, tzx, dev) + pattern-panel.js:146, pattern-creator-panel.js:526 |
| FileReader promise wrapper | `Helpers.readFileAsDataURL` | 1 copy | reference-layer-manager.js:171 |

The 11 `exportAndDownload` methods are near-identical 12-line blocks differing only in
extension and MIME type. This is the single highest-value consolidation in the codebase.

### 1.2 Misplaced layers (logic living in the UI folder)

- **`js/ui/reference-layer-manager.js` (679 lines)** is not UI — it is image
  loading/opacity/scale/position *state and compositing logic*. It belongs in
  `js/services/`. Its actual UI is already separate (`reference-layer-panel.js`, 722 lines).
- **`js/app.js` (1,648 lines)** — the "orchestrator" contains **45 DOM queries and
  43 `addEventListener` calls**. Lines ~241–1100 are five full UI components implemented
  inline: sidebar accordion, theme/language/font-scale settings, TTS announcer,
  toolbar + CLUT wiring, and a ~300-line layers/stamps panel (`renderLayerList`,
  rename-in-place, drag selection). `app.js` is the de-facto largest UI module in
  the project while claiming to be the init script.

### 1.3 Stale DOM coupling (dead selectors)

- `move-tool.js:126-128` and `zoom-tool.js:120-122` query
  `.canvas-container` / `#canvas-wrapper` / `.main-canvas-area` on the **outer**
  document. None of these exist there (`#canvas-container` lives *inside* the iframe;
  the outer element is `#canvas-viewport`). These fallback chains are relics of the
  pre-iframe DOM and silently return `null`.
- Dead status bar: `#status-message`, `#memory-usage`, `#frame-time` (index.html:500-503)
  are **never written by any JS**. Either wire them to `EVENTS.*` or delete them.

### 1.4 What is already correct (do not churn)

- Core/services/tools layers are clean of DOM access (only 2 legitimate iframe touches).
- ZX palette has one JS source of truth: `constants.js` `ZX_PALETTE` / `ZX_PALETTE_RGB`.
- `PixelDrawRoutine` as the single drawing gate is respected (documented exceptions apply).

## Pillar 2: State & Event Management

### 2.1 The bus exists and is *better* than `CustomEvent` — keep it

`js/core/event-bus.js` is a full pub/sub with batching, consolidation, debug history,
and named channels (`EVENTS.*`, 74 events). A migration to native `CustomEvent` would be
a **regression**: DOM-coupled dispatch, no batch/consolidate, no debug trace, string-typed
payloads, and listeners tied to element lifetime. **Recommendation: reject the CustomEvent
transition; finish the EventBus adoption instead.** The goal the user wants ("reorder a
list -> all dependent UI updates automatically") is already achieved where the bus is used
properly — e.g. the layer panel re-renders purely from `EVENTS.LAYER_*` (app.js:1092-1099).

### 2.2 The real gap: no command/event rule

Direct singleton calls are everywhere (SelectionService ×188, LayerManager ×183,
ColorManager ×98, …). That is *fine* for **commands** (UI -> logic), but the codebase has
no stated rule, so some modules mutate state and forget to emit, and others listen for
DOM events where a bus event exists. Formalize:

> **Commands go down** (direct singleton method calls: `LayerManager.addLayer()`).
> **Facts come up** (state changes announced *only* via `EventBus.emit(EVENTS.*)`;
> UI renders *only* from bus events, never from its own optimistic assumptions).

### 2.3 Hardcoded listener hotspots

- 9 `.onclick=`-style assignments remain in JS (should be `addEventListener` or delegated).
- app.js wires ~43 listeners for controls whose owning component should wire them (see 1.2).
- Good news: zero inline `onclick=""` attributes in index.html.

## Pillar 3: UI Component Unification (DOM)

### 3.1 Duplicated HTML structures in `index.html`

| Structure | Repetition | Single-source fix |
|---|---|---|
| Panel section (header + collapse button + content) | ×4 (`#layer-panel`, `#transform-panel`, `#tool-options-panel`, `#history-panel`) | one `<template id="tpl-panel">` or light-DOM `<zx-panel>` |
| Tool button (btn + svg use + sr-only span) | ×12 | generate from `TOOLS` registry at boot |
| Colour swatch with **inline hardcoded hex** | ×16 (index.html:113-133) | generate from `ZX_PALETTE` (kills a 2nd palette source of truth) |
| Zoom `<option>` 100–1600% | ×16 | generate from min/max/step already in zoom-controls.js |
| Layer-control buttons with inline SVGs | ×6 | icons belong in the existing `#icon-*` sprite (index.html:512) — two icon systems currently coexist |

### 3.2 Duplicated HTML in JS template literals

`tool-options.js:674` (`_getOptionsHTML`) hand-writes every tool's panel: **21 identical
`<input type="range">` slider rows and 34 `.opt-input` controls** re-typed per tool, with
per-control wiring re-implemented in `_attachOptionEvents`. This is the largest UI
duplication in the project and the reason the file is 1,349 lines.

Second instance: the layer/stamp list items are built imperatively in app.js
(`renderLayerList`, app.js:811+) with per-item button micro-markup.

### 3.3 Web Component strategy — with one hard constraint

**Shadow DOM is off the table** here: global stylesheets don't pierce shadow roots, CSS
theme variables would need re-plumbing, and — decisive — `I18n.apply()` scans the document
for `data-i18n`, which cannot see into shadow trees. Use **light-DOM custom elements**
(no `attachShadow`) or plain `<template>` + clone. Both are native, zero-dependency, and
fully compatible with the existing theming/i18n/`data-*` conventions.

## Pillar 4: Styling Consolidation

### 4.1 What's already right

`css/variables.css` is a genuine token file (colors, semantic aliases, spacing, type
scale, z-index scale, transitions, overlay colours readable from JS via
`getComputedStyle`). `themes.css` raw hex values (141) are *definitions*, not sprawl.
`enhanced-ui.css`/`panels.css` consume tokens heavily (240/473 `var()` uses).

### 4.2 Actual sprawl

- **`panels.css` repeated state blocks**: the identical
  `background: rgba(255,255,255,.15); color: rgba(255,255,255,.5)` /
  `.checked -> rgba(255,255,255,.25)` pair is copy-pasted for **five** button classes
  (`.layer-checkbox`, `.layer-visibility`, `.layer-lock`, `.layer-xor`, + stamp variants;
  panels.css:353-717). Also raw `#fff`/`#666`/`#444` (~50 hits) that should be tokens
  (`--overlay-*`-style: `--on-accent`, `--checker-dark`, …). These rgba literals also
  ignore theming — they assume a dark base.
- **Palette triplication**: ZX colours are defined in `constants.js` (JS SoT),
  `variables.css` (`--zx-*`), *and* inline `style=""` attributes in index.html swatches,
  plus `#d7d7d7` hardcoded again in the iframe srcdoc (`--canvas-bg` exists but isn't
  used there). Four places to edit one palette.
- **Load-order fragility**: 11 stylesheets whose correctness depends on `<link>` order
  (controls.css carries a comment admitting it must load last to win ties). Native
  `@layer` (CSS cascade layers — supported everywhere the app already requires) makes
  the intended precedence explicit and order-independent.
- Duplicate selector definitions across files: `#toolbar` ×25, `.layer-item` ×15,
  `.panel-button` ×6 spread over multiple files — each component's styles should live
  in exactly one file.

---

# PART 2 — TARGET ARCHITECTURE MAP & REFACTORING STRATEGY

## 2.1 Target module hierarchy

```
index.html                     <- skeleton only: regions + <template>s + sprite; no inline
                                  colours, no repeated structures, no boot-skeleton menus
css/
 ├─ variables.css   @layer tokens      <- ALL colour/space/type/z tokens (incl. new
 │                                        --on-accent, --state-dim, --checker-*)
 ├─ reset.css       @layer reset
 ├─ layout.css      @layer layout      <- app grid, regions
 ├─ components.css  @layer components  <- merge: toolbar/panels/windows/canvas/enhanced-ui,
 │                                        one section per component, tokens only
 ├─ themes.css      @layer themes      <- per-theme token overrides (unchanged role)
 └─ utilities.css   @layer utilities   <- incl. controls.css no-clip schema (wins by layer,
                                          not by load order)
js/
 ├─ utils/          helpers · logger · validators · storage      (unchanged; enforced)
 ├─ core/           constants · event-bus · state-manager · color-manager ·
 │                  attribute-system · layer-manager · canvas-system ·
 │                  pixel-draw-routine · input-handler             (unchanged)
 ├─ services/       undo-redo · selection · transform · pattern ·
 │                  reference-layer (<- moved from js/ui)           (logic, zero DOM)
 ├─ io/             format-registry (owns download/emit) + parse/encode-only handlers
 ├─ tools/          unchanged, plus static `optionsSchema` per tool (see 2.3)
 ├─ ui/
 │   ├─ components/ panel-section · option-controls (schema renderer) ·
 │   │              layer-panel (<- out of app.js) · clut-bar (<- out of app.js) ·
 │   │              app-settings (theme/lang/scale, <- out of app.js) ·
 │   │              a11y-announcer (<- out of app.js) · tool-rail (generated from TOOLS)
 │   └─ …existing panels/menus, each owning 100% of its DOM + listeners
 └─ app.js          <- back to ≤400 lines: pure phase orchestration, zero DOM wiring
```

## 2.2 Single-source-of-truth ledger (the "one place" for everything)

| Concern | Single source | Consumers |
|---|---|---|
| ZX palette | `constants.js ZX_PALETTE` | swatches *generated* at boot; `--zx-*` tokens written to `:root` by ColorManager at init (removes variables.css + inline-style copies) |
| UI colours/spacing/type/z | `variables.css @layer tokens` | every stylesheet; JS reads via `getComputedStyle` only |
| Events | `EVENTS.*` in constants.js | all emit/on; **no string literals, no CustomEvent** |
| Pixel writes | `PixelDrawRoutine.draw()` | unchanged (documented bulk exceptions stand) |
| Clamp/lerp/download/FileReader | `Helpers` | everyone; bypasses removed |
| File export download + `FILE_EXPORT` emit | `FormatRegistry.download(bytes, filename, mime)` | all `js/io/*` handlers become pure encoders |
| Tool metadata (id, icon, i18n key, shortcut, options schema) | `TOOLS` registry entries | tool rail generation, tool-options renderer, menus, shortcut map |
| Panel chrome (header/collapse/a11y) | `<template id="tpl-panel">` + PanelSection | all 4 sidebar panels |
| Form controls in panels | option-controls schema renderer | tool-options, transform panel, reference panel |

## 2.3 The two structural refactors

**A. Declarative tool options.** Each tool declares data, one renderer owns markup+wiring:

```js
// in brush-tool.js
static optionsSchema = [
  { type: 'select', key: 'drawMode',  i18n: 'opt.drawMode', options: DRAW_MODE_OPTS },
  { type: 'range',  key: 'size',      i18n: 'opt.size', min: 1, max: 32, value: 1 },
  { type: 'range',  key: 'flowRate',  i18n: 'opt.density', min: 1, max: 100, value: 100, unit: '%' },
  { type: 'check',  key: 'continuous', i18n: 'opt.buildUp' },
  …
];
```

`OptionControls.render(schema, container)` produces the row markup once (template clone),
applies i18n, decorates sliders, and emits `EVENTS.TOOL_OPTION_CHANGED` — deleting the
21 hand-written slider blocks, most of `_attachOptionEvents`, and ~600–800 lines of
tool-options.js. Transform/reference panels adopt the same renderer.

**B. app.js decomposition.** Extract the five inline components (accordion, settings,
announcer, clut-bar, layer-panel) into `js/ui/components/`, registered in Phase 5 like
every other UI module. Each owns its DOM subtree, wires its own listeners, renders only
from `EVENTS.*`. app.js keeps only phase orchestration.

## 2.4 Phased execution plan (each phase shippable, testable via `node tests/run-all.js` + manual smoke)

| Phase | Work | Risk | Payoff |
|---|---|---|---|
| **0. Guardrails** | Add `tests/lint-architecture.js` (plain Node, no deps): fails on inline clamp pattern, `URL.createObjectURL` outside helpers/registry, `getElementById` under core/services/tools (allowlist iframe), event-name string literals, `attachShadow`. Wire into run-all.js. | none | drift becomes CI-visible; every later phase stays enforced |
| **1. Utility consolidation** | Replace ~40 inline clamps -> `clamp()`; add `FormatRegistry.download()`; reduce 11 `exportAndDownload` bodies to `return FormatRegistry.download(this.export(opts), …)`; FileReader -> Helpers. Delete dead fallback selectors (move/zoom-tool) and dead status spans (or wire them). | low (mechanical) | −~250 lines, one download path, io/* becomes DOM-free |
| **2. app.js decomposition** | Extract accordion / app-settings / announcer / clut-bar / layer-panel components; move reference-layer-manager -> js/services. Update script order. | medium | app.js 1648->~400; UI logic addressable, layer panel becomes the reference implementation of bus-driven rendering |
| **3. Declarative options** | `OptionControls` renderer + per-tool `optionsSchema`; migrate transform panel to it. | medium | tool-options.js ~1349->~500; adding a tool option becomes one schema line |
| **4. DOM generation from registries** | Generate tool rail from `TOOLS`, swatches from `ZX_PALETTE` (drop inline styles), zoom options from config; `<template>` for panel sections and layer/stamp rows; migrate layer-ctrl inline SVGs into the sprite. Light-DOM custom elements only where lifecycle helps (`<zx-panel>`); templates elsewhere. | medium | index.html repetition eliminated; palette edits = 1 file |
| **5. CSS unification** | Introduce `@layer` order in one `@layer` statement; merge component sheets into components.css (one section per component); collapse the 5× repeated state blocks into a shared `.layer-btn` state contract; promote remaining raw colours to tokens (`--on-accent`, `--checker-*`, `--state-dim-bg/fg`, `--state-active-bg`); ColorManager writes `--zx-*` at init. | low-medium | order-independent cascade; theming reaches the last hardcoded corners; −~300 lines CSS |
| **6. i18n parity check** | Node test comparing key sets across the 13 locales (en=476 keys, others=460 — 16 keys currently missing per locale). | none | locks the localization effort's single source (en.js) |

**Sequencing rationale:** 0–1 are pure consolidation and make everything after safer;
2 must precede 3–4 (components must exist before they adopt templates/schemas);
5 is independent and can run parallel to 3–4; 6 is trivial and immediate.

## 2.5 Explicitly rejected proposals (and why)

- **`CustomEvent` migration** — strictly weaker than the existing EventBus (no batching/
  debug/history, DOM-coupled). Unification means *finishing* EventBus adoption.
- **Shadow-DOM Web Components** — breaks global theming tokens-in-stylesheets and the
  `data-i18n` document scan. Light-DOM custom elements / templates deliver the
  single-source goal without those regressions.
- **Merging singletons into one store** — the singleton-per-domain layout matches the
  no-build constraint and is healthy; the fix is the command/event rule, not a rewrite.
