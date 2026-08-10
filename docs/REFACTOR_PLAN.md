# PixULA — Clean Refactor Plan

> **Status 2026-08-08: EXECUTED.** All phases 0–13 shipped (Phase 13 on
> 2026-07-06), plus the RECOIL-parity pass (2026-07-11), user presets
> (2026-08-06), tool presets (2026-08-07) and seven post-rebuild changes on
> 2026-08-07/08 (reference-photo linking, the pattern cap, two measured cap
> raises, the `.pixula` project format, versioned backups, the Privacy block
> and the erase split). This document is the plan as
> written on 2026-07-03 and is kept as the record of intent — its counts
> describe what was expected, not what exists. For the tree as it stands
> (124 JS files, 14 screen modes, 28 tool ids, 44 formats, 59 Node suites +
> 217 browser specs, 13 × 955 i18n keys). Known deltas from §2's target tree: there are no
> `fonts/` or `patterns/` folders — both ship as generated JS in `js/data/`
> (`zx-rom-font.js`, `pattern-bitmaps.js`); `tests/` holds 59 `*.test.js` suites
> that `run-all.js` globs, not the three files listed; `js/services/` grew to 11
> (font, map, sprite, screen-mode, preset and backup joined the original five); the tool
> count in §2 ("14 tools") counts classes, and 12 exist behind 28 `TOOLS` ids
(`js/tools/` holds 16 files, four of which are not tool classes). The one item deferred
> out of the plan is the consolidated manual verification pass.

**Date:** 2026-07-03
**Source:** `H:\smsh` (branch `audit/zx-compliance`) — remains untouched and fully working throughout.
**Target:** `H:\PixULA` — a fresh tree implementing the unified architecture from day one.
**Founding inputs:** `docs/UNIFICATION_AUDIT.md` (architecture target) and `docs/ZX_PAINTBRUSH_COMPARISON.md` (feature target) from the source repo.
**Scope decision (2026-07-03):** the rebuild includes **full ZX-Paintbrush feature parity** — every No/Note row of the comparison doc is in scope (phases 7–12), not backlog. Rationale: the rebuild is the cheapest moment to add them — they shape the UI layout and the core screen-mode design, and they reuse code being ported anyway. Only the Sinclair *text editor* and ZX-Blockeditor *integration* stay excluded (not art-tool features; the latter is an external Windows app).

## Mission

A better-optimised, fully functional ZX Spectrum art tool that runs locally in a browser
(`file://`, no server, no build, no dependencies) and creates / edits / imports / exports
images for real ZX Spectrum hardware, the ZX Spectrum Next, and their emulators — driven equally well by
**keyboard + mouse, touch (tablets/phones), and pressure pens** (Wacom, Surface,
Apple Pencil, Samsung S-Pen).

---

## 1. Strategy: port-and-refactor, not rewrite

The 2026-07-03 audits verified that the core logic is *correct* — `PixelDrawRoutine`
attribute enforcement, the layer compositor, shape/brush/gradient math, all format
handlers, undo, autosave. A from-scratch rewrite would re-introduce bugs those audits
just cleared. The fragmentation is in the *packaging*: app.js bloat, hand-written
options markup, palette defined in four places, CSS load-order fragility.

Therefore: **every module is ported in dependency order, and made to conform to the
target architecture at port time** — no file lands in the new tree carrying an inline
clamp, its own blob-download code, hand-written option markup, or a string-literal
event name. A guardrail lint (Phase 0) enforces this mechanically from the first commit,
so the new tree can never drift the way the old one did.

### Ports largely unchanged (verified-good logic)
`utils/*` (helpers, logger, validators, storage) · `constants.js` · `event-bus.js` ·
`state-manager.js` · `pixel-draw-routine.js` · `layer-manager.js` (compositor) ·
`canvas-system.js` · `attribute-system.js` · `color-manager.js` · `shape-generator.js` ·
`brush-engine.js` · `undo-redo` · `selection-service.js` (incl. stamp/floating layer) ·
`transform-service.js` · `pattern-service.js` · all `io/*` parse/encode logic ·
all 13 `i18n/*` locales · `themes.css` theme definitions · the iframe canvas srcdoc.

### Rebuilt / restructured at port time
| Old | New |
|---|---|
| `app.js` (1,648 lines, 45 DOM queries) | `app.js` ≤400 lines, pure phase orchestration; five inline UI blocks extracted to `js/ui/components/` (accordion, app-settings, a11y-announcer, clut-bar, layer-panel) |
| `ui/tool-options.js` (1,349 lines of hand-written markup) | `OptionControls` schema renderer + static `optionsSchema` on each tool |
| `ui/reference-layer-manager.js` (logic in UI folder) | `js/services/reference-layer-service.js` |
| 11 × copy-pasted `exportAndDownload` in `io/*` | handlers become pure encoders; `FormatRegistry.download(bytes, filename, mime)` owns the one download path + `FILE_EXPORT` emit |
| `index.html` with 16 inline-styled swatches, 12 hand-written tool buttons, 16 zoom options, 4 copy-pasted panel shells, 2 icon systems | skeleton only: regions + `<template>`s + one SVG sprite; tool rail generated from `TOOLS`, swatches from `ZX_PALETTE`, zoom options from config |
| 11 load-order-dependent stylesheets | 6 sheets under explicit CSS `@layer tokens, reset, layout, components, themes, utilities` |
| `input-handler.js` (pointer-events based, desktop-tuned) | `input-handler.js` hardened for universal input (see §3) |
| ~40 inline clamps, 9 `.onclick=` assignments, dead selectors/status spans | `Helpers.clamp`, `addEventListener`/delegation, deleted |

### Preserved constraints (non-negotiable)
- No build system, no framework, no dependencies; open `index.html` via `file://`.
- IIFE module pattern, global singletons, `<script defer>` in dependency order.
- `EventBus` + `EVENTS.*` constants (CustomEvent migration explicitly rejected).
- Light-DOM components / `<template>` only — **no Shadow DOM** (breaks theming + `data-i18n`).
- **All pixel writes through `PixelDrawRoutine.draw()`**, with the documented bulk exceptions.
- The command/event rule, now written down and linted where possible:
  **commands go down** (direct singleton calls), **facts come up** (EventBus only; UI renders only from bus events).

### 1a. The screen-mode seam (why parity scope changes the core design)

Phases 12–13 (multicolor, ULAplus, Timex, GigaScreen, **ZX Spectrum Next**) all break
assumptions the old core hardcodes: one attribute byte per 8×8 cell, fixed 16-colour
palette, 256×192, 1-bit ink/paper pixel data. Retrofitting those onto a shipped core is
the expensive path — so the seam is declared **now**, in Phase 1, even though only
standard ULA ships at first:

- `constants.js` gains a `SCREEN_MODES` registry. Each mode is a descriptor:
  `{ id, width, height, attrCellW, attrCellH (or null = no attributes), pixelDepth
  (1 = ink/paper, 4/8 = indexed), paletteModel ('fixed16' | 'ulaplus64' | 'rgb333'),
  encodings: [...] }`. `STANDARD_ULA` is the first and, until Phase 12, only entry;
  the current `ZX_SPECTRUM` constant becomes a view of the active mode.
- **Rules from Phase 1 on:** no new code hardcodes 256/192/32/24/8/6912/6144/768 —
  geometry is always read from the active mode descriptor (lint-checked for the magic
  file sizes); `PixelDrawRoutine`, `AttributeSystem`, the compositor, and `SCRFormat`
  take their geometry from the descriptor even while only one mode exists.
- **Palette is data, not constants, at the consumer level**: `ColorManager` owns the
  active palette (initialised from `ZX_PALETTE` in fixed16 mode, editable in
  ULAplus/RGB333 modes) and writes it to CSS `--zx-*` tokens; swatch UI renders N
  swatches from ColorManager, never a hardcoded 16.
- **Pixel storage**: layer cell data stays 1-bit ink/paper for fixed16 modes; indexed
  modes (Layer 2, LoRes) store per-pixel palette indices — the layer model carries a
  `pixelDepth` so the compositor and formats branch on the descriptor, not on globals.
- UI reserves the slots now: mode selector in the File/Image menu + status bar,
  palette panel built to render from ColorManager state, canvas-system built to
  resize the iframe canvases from the descriptor.

This costs little in Phase 1 (standard ULA behaviour is unchanged and byte-identical)
and is what makes phases 12–13 additive instead of a second rewrite.

---

## 2. Target tree

```
H:\PixULA\
├─ index.html                  skeleton: regions + <template>s + sprite; zero inline colour,
│                              zero repeated structures
├─ css/
│   ├─ variables.css   @layer tokens      all colour/space/type/z/hit-target tokens
│   ├─ reset.css       @layer reset
│   ├─ layout.css      @layer layout      app grid, regions, pointer:coarse adaptations
│   ├─ components.css  @layer components  one section per component, tokens only
│   ├─ themes.css      @layer themes      per-theme token overrides (6 themes)
│   └─ utilities.css   @layer utilities   no-clip control schema (wins by layer, not order)
├─ js/
│   ├─ utils/          helpers · logger · validators · storage
│   ├─ core/           constants · event-bus · state-manager · color-manager ·
│   │                  attribute-system · layer-manager · canvas-system ·
│   │                  pixel-draw-routine · input-handler
│   ├─ services/       undo-redo · selection · transform · pattern · reference-layer
│   ├─ io/             format-registry (owns download) + pure encoder/parser handlers
│   ├─ tools/          tool-base · tool-manager · brush-engine · shape-generator ·
│   │                  14 tools (13 ported + bezier, Phase 8), each with static optionsSchema
│   ├─ ui/
│   │   ├─ components/ panel-section · option-controls · layer-panel · clut-bar ·
│   │   │              app-settings · a11y-announcer · tool-rail
│   │   └─ …           menus, panels, grid-overlay, border-control, dialogs
│   ├─ i18n/           13 locales, en.js is the key source of truth
│   └─ app.js           phase orchestration only
├─ fonts/  patterns/            copied as-is
├─ docs/                        this plan, new ARCHITECTURE.md, ported audits
└─ tests/
    ├─ run-all.js               ported format tests + new suites
    ├─ lint-architecture.js     guardrails (Phase 0)
    └─ i18n-parity.js           locale key-set comparison
```

Single-source-of-truth ledger (from the audit, adopted wholesale): ZX palette ->
`constants.js` only (swatches generated, `--zx-*` written to `:root` by ColorManager at
init); events -> `EVENTS.*` only; downloads -> `FormatRegistry.download` only;
clamp/lerp/FileReader -> `Helpers` only; tool metadata (id, icon, i18n key, shortcut,
options schema) -> `TOOLS` registry only; panel chrome -> `tpl-panel` template only;
option rows -> `OptionControls` only.

---

## 3. Universal input (keyboard / mouse / touch / pen) — new headline requirement

Current state in the source: already Pointer Events–based (`pointerdown/move/up/
cancel/leave`), `e.pressure` flows into `BrushEngine.mapPressure()`, pinch-zoom
partially handled in app.js. Missing: pointer capture, coalesced events, pointer-type
routing, palm rejection, touch ergonomics. The new `input-handler.js` adds:

**Stroke integrity**
- `setPointerCapture()` on pointerdown — strokes no longer drop when the pointer
  leaves the canvas or the iframe edge mid-drag.
- `getCoalescedEvents()` on pointermove — pens report at 120–240 Hz; without this,
  fast strokes get straight-line gaps between 60 Hz frames. Feed every coalesced
  point through the existing Bresenham interpolation.
- `pointercancel` treated as stroke-end-with-commit (OS gestures, palm arbitration).
- `touch-action: none` on the canvas surface (and `-webkit-user-select: none`,
  `user-select: none`) so the browser never steals a stroke for scrolling.

**Pointer-type routing** (`e.pointerType`)
- `pen`: draw with pressure (existing mapping) and, where reported, tilt -> brush
  option; barrel button (`e.button === 5`/`buttons & 32`) -> temporary eyedropper;
  eraser end (`e.button === 5` on Surface, `pointerType === 'pen'` + eraser flag) ->
  eraser tool while inverted.
- `pen` hover (`pointermove` with `buttons === 0`): live brush-outline preview via
  the existing grid-overlay preview path.
- `touch`, one finger: draw (default) — configurable to pan-only in settings for
  finger-rest workflows.
- `touch`, two fingers: pan + pinch zoom on the canvas viewport (consolidate the
  existing app.js pinch code into the input handler; zoom around gesture centroid).
- **Palm rejection**: while any `pen` pointer is active (or was active < 500 ms ago),
  ignore all `touch` pointerdowns.
- `mouse`: unchanged; right-click paper-colour behaviours preserved; `wheel` zoom kept.

**Keyboard**
- Shortcut map generated from the `TOOLS` registry (single source with rail + menus).
- Every control reachable by Tab; `:focus-visible` styling; existing a11y announcer
  ported as a component.

**Touch ergonomics (CSS, not JS)**
- `--hit-target: 44px` token; `@media (pointer: coarse)` bumps rail buttons, sliders,
  layer-row controls, menu rows to it.
- Viewport meta + `touch-action` bans double-tap zoom on chrome UI; long-press on
  canvas suppressed (`contextmenu` handled), long-press on layer rows = context menu.
- Slider thumbs get enlarged coarse-pointer variants; colour swatches min 40px on touch.

**Acceptance tests** (manual matrix, recorded in `tests/TESTLOG.md`): mouse-only ·
keyboard-only tool switching + drawing via shortcuts · Windows touch (Surface) ·
Surface Pen with pressure + eraser end · Wacom (Windows driver, pressure curve) ·
iPad Safari + Apple Pencil (hover on M2+) · Android Chrome + S-Pen.

---

## 4. Execution phases

Each phase ends with `node tests/run-all.js` green plus a manual smoke in the browser.
The old app at `H:\smsh` stays open side-by-side as the behavioural reference.

| Phase | Work | Exit criterion |
|---|---|---|
| **0. Scaffold + guardrails** | `git init`; folder tree; port test runner; write `tests/lint-architecture.js` (fails on: inline clamp pattern, `createObjectURL` outside registry/helpers, `getElementById` under core/services/tools (iframe allowlist), event-name string literals, `attachShadow`, `.onclick=` assignment); copy `fonts/`, `patterns/` | lint runs and passes on empty tree |
| **1. Foundation** | Port `utils/`, then `core/` in order (constants -> event-bus -> state-manager -> color-manager -> attribute-system -> canvas-system -> pixel-draw-routine -> layer-manager), consolidating clamps/FileReader to Helpers as they land; add `SCREEN_MODES` registry + `STANDARD_ULA` descriptor and route geometry through it (§1a). CSS: `variables.css` + `reset.css` + `layout.css` under `@layer`; ColorManager writes `--zx-*` tokens at init. Minimal index.html that boots the iframe canvas | canvas renders; a scripted `PixelDrawRoutine.draw()` shows correct attribute clash; format tests for core pass |
| **2. Services + IO** | Port services (reference-layer logic moves here); port `io/` with handlers reduced to pure encoders and `FormatRegistry.download()` added; port format tests | all ported format tests pass; SCR export is **byte-identical** to old app for the same document |
| **3. Tools** | Port tool-base/manager, brush-engine, shape-generator, then all 13 tools, adding `static optionsSchema` to each as it lands | every tool draws correctly via temporary rail |
| **4. UI shell** | Generated index.html (tool rail from `TOOLS`, swatches from `ZX_PALETTE`, zoom options from config, `tpl-panel` template); `OptionControls` renderer; port panels/menus/grid-overlay/border-control; extract the five app.js components; `components.css` + `utilities.css`; icons unified into one sprite | full UI parity walk-through against old app |
| **5. Universal input** | New input-handler per §3; pointer-type routing, capture, coalesced events, palm rejection, gestures; coarse-pointer CSS; keyboard map from registry | input acceptance matrix (§3) passes on available devices |
| **6. i18n + themes** | Port 13 locales + `I18n`; `tests/i18n-parity.js` (en=476 keys is SoT — also fixes the 16 keys currently missing per locale); port `themes.css` under `@layer themes`; theme/language/font-scale settings component | parity test green across 13 locales; 6 themes render |
| **7. Parity sign-off + quick wins** | Side-by-side feature checklist (every row of ZX_PAINTBRUSH_COMPARISON §1); then close the top comparison gaps: **system clipboard paste** (`paste` event + `navigator.clipboard.read()` -> PNG quantizer -> floating stamp), **non-wrap scroll**, **rounded rectangle + parallelogram**, **configurable nudge / grid snap** | old-app feature inventory fully reproduced + 4 quick wins shipped |
| **8. Drawing parity** | **Bezier curve tool** (quadratic/cubic, drag handles, rasterized through ShapeGenerator); **symmetry drawing mode** (H/V/quad mirror, hooked at the ToolBase->PixelDrawRoutine seam so every tool inherits it); **text in 4 directions** + **shading/contour effects** (drop-shadow + outline mask post-processing on the rasterized text mask); **import conversion dialog** (brightness/contrast/scale preview before quantization) | every ZX-PB drawing-tool row is Yes/Plus |
| **9. Format parity** | **GIF import** (decode -> existing quantizer) and **GIF export** (doubles as FLASH-state animation later); **TAP/TZX multi-block editing** (block list UI: view/add/remove/reorder blocks, not just first-SCREEN$ rip); **persistent internal clipboard** (ZXP-equivalent, stored in IndexedDB); **ZED + SevenuP/ZXB interchange** import/export | every ZX-PB format row is Yes/Plus |
| **10. Sinclair font editor** | 256-char sets at 4×8 / 6×8 / 8×8; read/write **CH4/CH6/CH8/CHR/CHX**; reuses Pattern Creator's cell-editing UI; edited fonts become selectable in the text tool | ZX-PB's second-biggest feature at parity, integrated with our text tool |
| **11. Map/tile editor** | Tile-based screen assembly from the pattern library; **.zxm** read/write + native format; designed so tile source can later be a Next tilemap bank | map editing at parity |
| **12a. Mode seam live + first modes** | Make `ACTIVE_SCREEN_MODE` runtime-switchable (§1a seam goes dynamic: `EVENTS.SCREEN_MODE_CHANGED`, canvas resize from descriptor, palette-as-data in ColorManager, mode-tagged persistence payloads, mode selector UI + document conversion rules); then the two modes that prove the seam's two halves — **multicolor 8×1/8×2/8×4 attributes** (attr geometry on fixed16) and **ULAplus** (64-colour editable palette + palette editor + Image2ULAplus-style import) | seam switches at runtime with STANDARD_ULA byte-identity preserved; multicolor + ULAplus rows Yes/Plus |
| **12b. Remaining classic modes** | On the live 12a seam: **Timex hi-colour (8×1)** and **hi-res 512×192** (the geometry stress: canvas/zoom/fit/input at double width), **GigaScreen** (flicker pair editing, blended preview via the GIF FLASH-phase infra), **Bifrost ColorTiles** last | ZX-PB colour-mode family fully covered — §2 100% green |
| **13. ZX Spectrum Next modes** | **Layer 2** 256×192×8bpp, 320×256×8bpp, 640×256×4bpp; **LoRes** 128×96 (incl. Radastan 4bpp); **ULANext** enhanced attributes; **9-bit RGB333 programmable palettes** with palette editor; formats: **.nxi / .sl2** image import/export, **.npl/.pal** palettes, **.spr** sprite sheets (16×16 sprite editor reusing font-editor UI), Next **tilemap** export from the Phase 11 map editor | create/edit/export art for Next hardware + emulators (CSpect/ZEsarUX) |

Sequencing rationale: 0–1 make everything after safe; 2 before 3 (tools call services);
3 before 4 (schemas must exist before the renderer consumes them); 5 needs the real UI
to route input into; 6 anytime after 4; 7 gates feature work on parity. 8–9 are
independent; 10 before 13 (sprite editor reuses font-editor UI); 11 before 13 (Next
tilemap rides on the map editor); 12a before 12b (12b's modes ride on the
runtime-switchable seam 12a lands); 12b before 13 (Next modes are the seam's stress
test, classic modes prove it first). Phase 12 was split into 12a/12b (2026-07-05) to
keep each session reviewable — 12a carries the risky core surgery, 12b is additive
modes on the proven seam.

Session hand-off keeps a ready-to-paste kickoff note for every remaining session.
Each phase's completion ritual marks its own note used, reconciles the next one
against what actually shipped, drafts the
following stub, and ends the session by handing the user the next prompt verbatim.

## 5. Risks & mitigations

- **Silent behaviour drift while porting** -> old app kept runnable at `H:\smsh`;
  SCR/TAP/TZX byte-diff tests; per-phase manual smoke against the live old app.
- **Script load order** (still 40+ files, no build) -> dependency-ordered `<script defer>`
  list maintained in one block of index.html; boot-time assert in app.js that every
  expected global exists before Phase 1 runs, naming the missing file.
- **Pen/touch device coverage** — not all hardware is on hand -> feature-detect
  everything (`getCoalescedEvents`, hover, barrel buttons are progressive
  enhancements); mouse path is the always-works baseline.
- **Scope creep from the comparison doc** -> hard gate at Phase 7: nothing from
  Phase 8 starts until the parity checklist is signed off.

## 6. Explicitly out of scope

Only two ZX-Paintbrush items stay excluded, per the comparison doc's rationale:
- **Sinclair text editor** — a text-file editor, not an art-tool feature.
- **ZX-Blockeditor integration** — external Windows application, N/A for a browser app.

Everything else from the comparison doc — including the full colour-mode family — plus
**ZX Spectrum Next** support (Layer 2, LoRes, ULANext, RGB333 palettes, .nxi/.sl2/.npl/.spr,
sprite editor, Next tilemap) is in scope, phases 7–13.
