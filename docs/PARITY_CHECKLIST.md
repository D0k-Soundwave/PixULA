# Parity Checklist — rebuild vs `H:\smsh` (ZX_PAINTBRUSH_COMPARISON.md §1)

> **This is a dated sign-off, not a live status.** It records the state at
> Phase 7 (2026-07-04), when the tree had 16 Node suites and 13 × 504 i18n keys
> and six more phases were still to come. Every figure below is correct for that
> date and deliberately not updated. Current counts: `docs/CURRENT_STATE.md`.
> The Note rows it defers still stand — they are the manual pass in
> `tests/TESTLOG.md` / `tests/manual-checklist.html`.

**Date:** 2026-07-04 (Phase 7 sign-off)
**Method:** static verification against the live rebuild code + green
`node tests/run-all.js` (16 suites), old app at `H:\smsh` (branch
`audit/zx-compliance`) as the behavioural reference. Per project policy,
no browser automation and no per-phase manual pass — every row that needs
eyes-on-screen is marked Note and recorded in `tests/TESTLOG.md` for the
end-of-rebuild consolidated manual pass.

**Verdicts:**
Yes reproduced (statically verified and/or test-covered) ·
Note implemented, needs eventual manual browser confirmation ·
x gap (with owner phase)

Every row of the comparison doc's §1 inventory appears below. Summary:
**no x rows** — the full §1 inventory is reproduced; 22 rows carry a Note
manual-confirmation flag for behaviour that cannot be proven headlessly
(live previews, pointer/pressure behaviour, async font enumeration,
clipboard permission flows).

---

## 1. Drawing tools (12 registered classes + rail variants)

The brush TYPES (crosshatch, spray, fade, pattern, advanced crosshatch, poisson
stipple) are tool-rail buttons that ride on the one BrushTool via
`ToolManager._brushVariants` — the same shape-variant pattern — so they are rail
entries, not classes. Round and square stay under the base Brush button.
`tests/tools-draw.test.js` registers all 12 tool classes through the real stack and
asserts pixel/attribute effects — that test is the baseline for every row here.

| §1 row | Verdict | Evidence |
|---|---|---|
| **Brush** — size 1–32 (1 = pencil), 8 engine types, flow, pressure, Bresenham interpolation | Yes + Note pressure/flow feel | 8 engines registered in `BrushEngineClass._initializeDefaultBrushes` (round, square, crosshatch, spray, fade, pattern, crosshatch-advanced, stipple-poisson — `stipple` was a duplicate of `spray` and merged into it, its radial distribution now the `weighting` slider; the id still aliases); size 1 = pencil for EVERY type (`tests/brush-size-one.test.js`); shapes come from `BrushShapes` (round/square only — the `cross`/`diamond` names in the old `_computeBrushPattern` silently fell through to round and are gone); Bresenham via `ToolBase.getLinePoints`; pressure mapping `BrushEngine.mapPressure` wired in `input-handler.js`. Manual: pressure curve on pen hardware (TESTLOG Phase 5 rows already cover this) |
| **Eraser** — size 1–32, circular, stroke interpolation | Yes | `eraser-tool.js` optionsSchema size 1–32; drives DRAW_MODE.ERASE through the shared stroke path; tools-draw asserts erase effect |
| **Fill** — flood, 4/8-connectivity, contiguous + non-contiguous, draw-mode selector incl. attributes-only | Yes | `fill-tool.js:13-19`: `diagonal` (8-connectivity) check, `contiguous` check, drawMode select filtered to normal/attributes_only, `usePattern`; tools-draw exercises fill |
| **Shape** — 30+ shapes, line thickness 1–8, outline/filled, live drag preview | Yes + Note preview | `shape-generator.js` registers 38 outline + 33 filled generators; `shape-tool.js` schema: thickness 1–8 (line only), filled toggle, border 1–8; Phase 7 adds rounded-rectangle + parallelogram to the select (`tests/shape-rasters.test.js`). Manual: drag preview rendering (GridOverlay) |
| **Gradient** — 7 types, Bayer dithering, shape-constrained fills, live preview, reverse on right-click | Yes + Note preview | `gradient-tool.js:119` validates exactly the 7 types (linear, radial, reflected, diamond, conical, square, spiral); Bayer matrix + shape-fill options in schema; reverse = `e.button === 2` at lines 178/216. Manual: two-phase live preview |
| **Spray** — polar scatter, continuous while held | Yes | Spray is now a brush TYPE on its own rail button (`TOOLS.SPRAY` -> `ToolManager._brushVariants` -> BrushTool with `brushType: 'spray'`); the standalone airbrush class was retired, its scatter maths already in `BrushShapes` and its hold-to-emit reproduced by the brush's Build-up (continuous) option. Size/flow/weighting replace the old radius/density; `tests/tools-draw.test.js` exercises it |
| **Eyedropper** — ink left / paper right / Alt+click full attrs, current-layer or composite sampling | Yes | `eyedropper-tool.js:73-79`: composite sampling + `e.altKey` full-cell pick; right-button paper pick in the same handler |
| **Selection** — rect marquee, additive (Shift), copy/cut/paste/delete, select all, fill, invert | Yes | `selection-tool.js:73-87` Shift-additive; `selection-service.js`: `copyToClipboard`/`cutToClipboard`/`pasteFromClipboard`/`deleteSelection`/`selectAll:1511`/`fillSelection:384`/`invertSelection:409` |
| **Text** — ZX ROM 8×8 + system fonts (`queryLocalFonts()` + fallback), live cursor stamp preview, floating stamp with flip/rotate | Yes + Note font enumeration & preview | `text-tool.js`: ZX ROM first in font select (line 26), `_enumerateFonts` uses `queryLocalFonts` feature-detected with curated fallback; places via `startFloatingPasteFromMask`. Manual: async font list population, cursor-following preview |
| **Pattern** — library patterns 8/16/32 + IndexedDB user patterns | Yes | `pattern-service.js` + `js/data/pattern-bitmaps.js` (library now ships as embedded 1-bit bitmaps rather than PNG files — same patterns, no fetch needed on file://); IndexedDB via `Storage` PATTERNS store |
| **Pattern Creator** — in-app editor, 1-bit packed ZX UDG, raw `.pat` import/export, clipboard capture | Yes | `pattern-creator-tool.js` + `pattern-creator-panel.js` (Dialog-based); capture mode restored in Phase 5 input handler (`enterPatternCaptureMode`) |
| **Move** — canvas panning | Yes | `move-tool.js` pans via `CanvasSystem.get/setScrollPosition` (DOM-free seam added in Phase 3) |
| **Zoom** — 100–1600%, fit-to-window, reset | Yes | `ZOOM_CONFIG` MIN 100 / MAX 1600; `CanvasControls.fitZoom()/applyFit()`; +/−/0 keys and wheel/pinch zoom in input handler |

## 2. ZX Spectrum fidelity

| §1 claim | Verdict | Evidence |
|---|---|---|
| 256×192, 32×24 attr grid, one attribute byte per cell | Yes | `SCREEN_MODES.STANDARD_ULA` descriptor; `tests/core-draw.test.js` |
| All drawing through `PixelDrawRoutine`, live clash enforcement | Yes | Lint-enforced architecture; `core-draw` + `tools-draw` assert attribute behaviour |
| Draw modes NORMAL / TRANSPARENT / ERASE / ATTRIBUTES_ONLY exposed for brush/fill/shape | Yes | `DRAW_MODE` in constants (rebuild adds PIXEL_ONLY/PAPER/XOR beyond the old app); `ToolBase.DRAW_MODE_OPTS` feeds the three schemas |
| Cell-wide BRIGHT constraint + bright-black special case | Yes | `attribute-system.js` ported verified-good; core-draw covers bright handling |
| Document border colour (tape loaders + preview) | Yes | `ColorManager.get/setBorder`, `border-control.js`; `tests/border-color.test.js` proves the TAP/TZX loader embeds it |
| 16-colour palette (8+8) | Yes | `ZX_PALETTE` single source; ColorManager writes `--zx-*` tokens; swatches generated |
| Attribute ops in the left rail | Yes + Note | `clut-bar.js` (Swap/Apply modes via input handler special modes). Manual: paint-mode drags |

## 3. Layers & compositing

| §1 claim | Verdict | Evidence |
|---|---|---|
| Full stack: create/delete/duplicate/reorder/rename/lock/visibility, multi-select, merge down/selected, flatten | Yes | `layer-manager.js`: `renameLayer:970`, `setLayerLocked:949`, `flattenVisible:1262`, `mergeDown:1319`, `mergeSelected:1395`, `selectedLayers` multi-select set; LayerPanel wires all of it |
| Compositor: ink ORs across layers; attributes from topmost altered layer | Yes | `composeCellToCanvas` ported verified-good (Phase 1); SCR byte-identity test passes through `flattenVisible` |
| Floating stamp layer: WYSIWYG paste/text preview, drag, transform, commit/cancel | Yes + Note drag feel | `selection-service.js` stamp system ported whole (Phase 2); Enter/Escape/commit paths in input handler; transform panel stamp section |
| Reference layer: load image; opacity, above/below, offset, scale, rotate, flip, fit modes | Yes | `reference-layer-service.js` (moved to services/ at port) + `reference-layer-panel.js`; 25 `EVENTS.REFERENCE_*` facts |

## 4. Transforms (`TransformService`)

| §1 claim | Verdict | Evidence |
|---|---|---|
| Flip H/V, rotate 90° CW/CCW, scale by factor, shift/roll with wrap (attribute-preserving), selection-scoped | Yes | `transform-service.js` ported; Phase 7 adds the no-wrap scroll variant on top (`tests/transform-shift.test.js` covers both modes + attribute preservation); selection scoping via `_getWorkArea()` |

## 5. File I/O

| §1 row | Verdict | Evidence |
|---|---|---|
| SCR import/export (6912 + 6144 bitmap-only) | Yes | `scr-format.js:40-49` accepts both sizes; `tests/scr-format.test.js` + **byte-identity vs old app** (`tests/scr-byte-identity.test.js`) |
| TAP/TZX import + export (self-loading tapes, BASIC loader; import rips first SCREEN$ block) | Yes | `tests/tap-format.test.js` / `tests/tzx-format.test.js` (checksums, block structure, loader tokens, skip-non-screen-blocks) |
| SNA import (loading screens) | Yes | `tests/sna-format.test.js` |
| PNG/JPG import with bank-aware per-cell quantization + Floyd–Steinberg; PNG/JPG export with scaling; BMP export | Yes | `png-format.js` engine (`tests/png-quantize.test.js`); `jpg-format.js` registers jpg/jpeg import+export; `bmp-format.js` export. Phase 7 reuses the same quantizer for clipboard paste (`tests/clipboard-paste.test.js`) |
| Developer exports ASM/C/BIN/ATR | Yes | `dev-format.js` registers all four; `tests/dev-format.test.js` |
| Format registry plug-in point | Yes | `format-registry.js` also owns the single download path (lint-enforced) |

## 6. Application chrome

| §1 claim | Verdict | Evidence |
|---|---|---|
| Undo/redo, snapshot-based, batch-aware | Yes (doc correction) | `undo-redo.js` `maxStates = ZX_SPECTRUM.DEFAULT_UNDO_LIMIT` = **50** — identical in `H:\smsh` (`constants.js:16`). The comparison doc's "100 steps" overstated **both** apps; parity holds at 50=50 |
| Autosave with restore-on-startup (IndexedDB) | Yes + Note prompt flow | Ported this phase (`app.js` `_checkAutosave`/`_setupAutosave`/`_getProjectData`; minute interval honouring the pref.autosave preference; 24h expiry; border colour added to the snapshot). Manual: restore prompt round-trip |
| 6 themes; 13-language i18n in native scripts; accessibility font scaling | Yes + Note visual | Phase 6 (`tests/i18n-parity.test.js` 13×504 keys; `themes.css` 6 token blocks); font-scale selector in `app-settings.js:96`. Manual rows already in TESTLOG Phase 6 |
| Menu system, per-tool options panel, pattern panel, grids (1×1/8×8/16×16), coordinate/attribute status bar, shortcuts + help dialog | Yes + Note walk-through | `menu-system.js`, `OptionControls` schema renderer, `pattern-panel.js`, `grid-overlay.js` toggle trio (`:377-397`), `canvas-controls.js` cursor/cell readout, `showShortcuts()`/about dialogs |
| Single HTML file, `file://`, no install, cross-platform | Yes | Architecture constraint held since Phase 0 (no build, no deps; boot manifest asserts script order) |

## Phase 7 quick wins (comparison §3 items closed this phase)

| Item | Verdict | Evidence |
|---|---|---|
| System clipboard paste | Yes + Note clipboard permission flows | paste event + `navigator.clipboard.read()`, quantizer -> floating stamp (`tests/clipboard-paste.test.js`); Edit>Paste enable-state includes the system path |
| Non-wrap scroll | Yes | `shift(dir, amount, wrap)` + Transform panel checkbox (`tests/transform-shift.test.js`) |
| Rounded rectangle + parallelogram | Yes | UI-reachable shape variants (`tests/shape-rasters.test.js`) |
| Configurable nudge + grid snap | Yes + Note key/pointer feel | Arrow nudge (nudgeStep pref), Snap toggle (persisted, placement-scoped), `EVENTS.GRID_SNAP_CHANGED` wired |

## Sign-off

Every §1 row: **Yes reproduced** (0 x gaps). The Note flags above are recorded as
checkbox rows in `tests/TESTLOG.md` (Phase 7 section) for the consolidated
end-of-rebuild manual pass, per the deferred-manual-testing policy. Phase 8
(drawing parity: bezier, symmetry, text directions/effects, import dialog)
is unblocked.
