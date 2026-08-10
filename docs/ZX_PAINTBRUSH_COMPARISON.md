# PixULA vs ZX-Paintbrush — Feature Comparison & Roadmap

**Date**: 2026-07-03 · **§1 inventory re-verified against this tree 2026-08-08**
**Compared against**: ZX-Paintbrush by Claus Jahn (ZX-Modules suite, latest known release 2.6.3)
**Our feature claims verified against**: the live `js/` code in this repo (not docs).
§1 below is the inventory as it stands; the counts it quotes are re-derived in
`docs/CURRENT_STATE.md` (14 screen modes, 12 registered tool classes behind 28
`TOOLS` ids, 105 patterns, 44 file formats, 13 × 955 i18n keys). §2's roadmap
verdicts are 100% Yes/Plus — the rebuild finished it, and the post-rebuild
additions of 2026-08-07/08 are listed at the end of §2 under "Features we have
that ZX-Paintbrush lacks".

ZX-Paintbrush is the closest existing comparison to this tool: a Windows drawing
package for authentic ZX Spectrum SCREEN$ art that enforces 256×192 resolution,
the 8×8 attribute grid, and real attribute-clash behaviour while drawing.

Sources: [ZX-Modules site (Claus Jahn)](https://zx-modules.jimdofree.com/zx-modules-start/zx-paintbrush/),
[official ZX-Modules page on WoS](https://worldofspectrum.net/zx-modules/55),
[v2.6.3 announcement](https://worldofspectrum.org/forums/discussion/comment/900617),
[v2.5 announcement](https://www.vintageisthenewold.com/zx-paintbrush-2-5-published),
[itch.io portable release](https://sourcesolutions.itch.io/zx-paintbrush).

---

## 1. PixULA — Current Feature Inventory

### Drawing tools (12 registered classes + brush/shape rail variants, `app.js` Phase 4)

| Tool | Capabilities |
|------|--------------|
| **Brush** | Freehand, size 1–32 (**every type is the pencil at size 1** — the invariant in `brush-engine.js`, pinned by `tests/brush-size-one.test.js`), 8 engine types, each a tool-rail button of its own (round + square share the base Brush button via a Round/Square selector; cross-hatch, spray, fade, pattern, advanced cross-hatch, poisson stipple ride on the same BrushTool through `ToolManager._brushVariants`), spray weighting −100 rim…0 even…+100 centre, flow 0–100%, pressure sensitivity, Bresenham stroke interpolation. Geometry (disc + scatter + hover envelopes) comes from `js/utils/brush-shapes.js`, shared with the eraser |
| **Eraser** | Size 1–32, circular (the same `BrushShapes.disc` the round brush paints), stroke interpolation |
| **Fill** | Flood fill, 4/8-connectivity, contiguous + non-contiguous modes, draw-mode selector (incl. attributes-only) |
| **Shape** | 30+ shapes via ShapeGenerator: line (1–8 px thickness), rectangle, square, circle, ellipse, ring, triangle, diamond, pentagon, hexagon, octagon, polygon, star, heart, gear, arrows (5 directions), cross, moon, flower, spiral, … — outline/filled toggle, live drag preview |
| **Gradient** | 7 types (linear, radial, reflected, diamond, conical, square, spiral), Bayer-matrix dithering, geometric shape-constrained fills (circle/square/rectangle/triangle), live preview, reverse on right-click |
| **Spray** | Polar-distribution scatter with weighting (rim…even…centre), a rail button for the brush `spray` type (the standalone airbrush was folded into it); continuous while held via the brush Build-up option |
| **Eyedropper** | Ink (left), paper (right), full cell attributes (Alt+click), current-layer or composite sampling |
| **Selection** | Rectangular marquee, additive (Shift), copy/cut/paste/delete, select all, fill, invert pixels |
| **Text** | ZX ROM 8×8 bitmap font **and** arbitrary system fonts (`queryLocalFonts()` + fallback list) rasterized via offscreen canvas; live cursor-following stamp preview; placed as floating stamp with flip/rotate transforms |
| **Pattern** | Draw with library patterns (curated 8×8 / 16×16 / 32×32 shading library, generated — see `tools/gen-patterns.js` — plus IndexedDB user patterns) |
| **Pattern Creator** | In-app editor for custom patterns (1-bit packed ZX UDG format, raw `.pat` import/export, clipboard capture from selection) |
| **Move** | Canvas panning |
| **Zoom** | 100–1600%, fit-to-window, reset |

### ZX Spectrum fidelity
- 256×192 canvas, 32×24 attribute grid, single attribute byte per cell (FLASH/BRIGHT/PAPER/INK) — the STANDARD_ULA mode, and since Phase 12a one of **14 screen modes** in the `SCREEN_MODES` registry (multicolor 8×4/8×2/8×1, ULAplus, ULAplus 8×1, Timex hi-res 512×192, GigaScreen, ULANext, Layer 2 256/320/640, LoRes, Radastan)
- **All** drawing funnels through `PixelDrawRoutine` — attribute clash enforced live while drawing
- Draw modes: Normal, Attributes only, Pixels only, Paper, XOR — one **global** top-bar selector (`StateManager`), not a per-tool option, and named in the status bar whenever it is not Normal
- Cell-wide BRIGHT constraint, bright-black special case handled
- Document **border colour** (used by tape loaders + canvas preview)
- 16-colour palette (8 base + 8 bright), attribute ops in the left rail

### Layers & compositing (beyond anything ZX-Paintbrush has)
- Full layer stack: create/delete/duplicate/reorder/rename/lock/visibility, multi-select, merge down / merge selected / flatten
- Compositor: ink ORs across layers; attributes from topmost altered layer per cell
- **Floating stamp layer**: every paste and text placement previews WYSIWYG (correct attribute mapping) before commit; drag to reposition, transform, commit/cancel
- **Reference layer**: load any image; opacity, position above/below, offset, scale, rotate, flip, fit modes

### Transforms (`TransformService`)
- Flip H/V, rotate 90° CW/CCW, scale by factor, shift/roll with wrap-around (attribute-preserving), scoped to selection or whole canvas

### File I/O
- **SCR** import/export (6912-byte, also accepts 6144-byte bitmap-only)
- **TAP / TZX** import + export — exports are *self-loading tape images* with tokenized BASIC loader; import rips the first SCREEN$-sized block
- **SNA** import (loading screens from snapshots)
- **PNG / JPG** import with bank-aware per-cell quantization + Floyd–Steinberg dithering; PNG/JPG export with scaling; **BMP** export
- **Developer exports**: ASM, C, raw binary, attribute-only (`asm`/`c`/`bin`/`atr`)
- Format registry — new formats plug in via `FormatRegistry`
- The five bullets above are the Phase-2 inventory. Phases 9–13 took it to 43 registered extensions, and `.pixula` (2026-08-07) made **44** (multicolor .mlt/.mc/.ifl, Timex .hrg, GigaScreen .img/.mg*, ColorTiles .ctile, ZED, SevenuP, fonts CH4/CH6/CH8/CHR/CHX, maps .zxm/.zxtm, Next .nxi/.sl2/.slr/.pal/.npl/.spr, GIF in and out, presets .zxpreset, and the native project file .pixula) — the list is in `docs/CURRENT_STATE.md` §4 and the gaps in `docs/FORMAT_ROADMAP.md`

### Application chrome
- Undo/redo (snapshot-based, **500** steps — `ZX_SPECTRUM.DEFAULT_UNDO_LIMIT`, raised from 50 on 2026-08-07 once dirty-layer tracking made an entry 229x cheaper; also bounded by `UndoRedo.MAX_HISTORY_BYTES` = 256 MB, because entries differ 32x in size. The "100 steps" this doc first claimed was wrong for both apps, see PARITY_CHECKLIST §6 — batch-aware)
- Autosave with restore-on-startup (IndexedDB), and since 2026-08-07 **versioned copies on disk**: each tick also writes `<name> V1.pixula`, `V2`, ... to a folder the artist chose
- 6 themes; 13-language i18n in native scripts; accessibility font scaling
- Menu system, per-tool dynamic options panel, pattern panel, grids (1×1 / 8×8 / 16×16), coordinate/attribute status bar, shortcuts + help dialog
- Runs as a single HTML file in any browser — no install, no build, cross-platform (ZX-Paintbrush is Windows-only, needs Wine elsewhere)

---

## 2. Comparison Map — every ZX-Paintbrush feature vs our tool

Legend: Yes have · Plus have, ours goes further · Note partial · No missing

### Drawing tools

| ZX-Paintbrush feature | Ours | Notes |
|---|---|---|
| Freehand/pencil, adjustable brush | Plus | 9 brush engines, 4 shapes, flow, pressure vs ZX-PB's simpler brush |
| Shapes: line, circle, ellipse, triangle, rectangle, polygon | Plus | We add star, heart, gear, ring, arrows, moon, flower, spiral… (30+) |
| Rounded rectangle, parallelogram | Yes | Phase 7 QW3 — rasters UI-reachable as shape variants |
| Bezier curves | Yes | Phase 8 — dedicated tool (C): quadratic/cubic, draggable handles, live preview; pure-math raster in ShapeGenerator |
| Spraycan with spray effects | Yes | Radius + density + continuous spray |
| Floodfill: standard fills | Yes | Plus 4/8-connectivity and non-contiguous mode |
| Floodfill: gradient fills | Plus | 7 gradient types + dithering vs ZX-PB's gradient fill |
| Floodfill: custom-graphics (pattern) fills | Yes | Pattern tool + pattern brush engine |
| Fill with colour attributes only | Yes | ATTRIBUTES_ONLY draw mode |
| Symmetry drawing tools | Plus | Phase 8 — H/V/quad mirror hooked once at the PixelDrawRoutine seam, so EVERY tool inherits it (brush, eraser, shapes, spray, fill, bezier…) |
| Undo/redo | Yes | 50 steps, batched (same depth as ZX-PB — corrected in the Phase 7 parity pass) |
| Multiple zoom levels | Yes | 100–1600% + fit |

### Colour & attribute handling

| ZX-Paintbrush feature | Ours | Notes |
|---|---|---|
| Direct/free attribute editing | Yes | ATTRIBUTES_ONLY mode + left-rail attribute ops |
| Attributes update live while drawing | Yes | Core `PixelDrawRoutine` guarantee |
| Transparent colour effects | Yes | TRANSPARENT draw mode (pass-through ink/paper) |
| Transparent/coloured overlay graphics | Yes | Floating stamp layer + reference layer |
| **Multicolor mode** (8×1 attributes etc.) | Plus | Phase 12a — runtime-switchable 8×4/8×2/8×1 modes (ZX-PB conversion rules: refine lossless, coarsen by most-used attribute); .mlt import+export, .mc import, .ifl import+export (RECOIL layouts); drawing/clash/undo/autosave per mode; Plus over ZX-PB: GIF export and PNG import work in multicolor modes |
| **ULAplus** (palette editing, Image2ULAplus) | Yes | Phase 12a — ULAplus mode (attr bits become CLUT = FLASH×2+BRIGHT, exactly ZX-PB's model), 64-register G3R3B2 palette editor (undoable, live via --zx-N tokens), CLUT selector replaces Flash/Bright in the rail, .scr 6976 variant (screen + registers) import+export, Image2ULAplus-style PNG import (generated palette + per-CLUT quantizer). Not replicated: ZX-PB's four switchable palette slots (P0–P3/U0–U3) and its 151-byte palette-TAP loader |
| **Timex SCREEN$** (hi-res / hi-colour) | Yes/Plus | Phase 12b. Hi-colour = ZX-PB parity: the 12288 Timex SCREEN$ (attrs in the bitmap's ULA interleave — the 8×1 cell model is 12a's MULTICOLOR_8x1, exactly how ZX-PB treats "Timex format") and the 12352 ULAplus variant (new ULA_PLUS_8x1 mode), import+export, plus the Spectrum<->Timex conversions via the mode switcher. Hi-res 512×192 is Plus — ZX-PB stores hi-res screen data blocks but has NO hi-res editor; we added a full TIMEX_HIRES mode (mono canvas, port-byte colour scheme selector, 256<->512 conversion rules, SCR 12289 + .hrg import/export per RECOIL) |
| **GigaScreen** (102-colour flicker) | Plus | Phase 12b. Corrected claim: ZX-Paintbrush 2.6.1 has NO GigaScreen support at all (verified against its CHM + exe strings) — this row was aspirational. Ours is a full Plus mode: layers carry A/B sub-screen tags (badge in the Layers panel), the compositor shows the RECOIL per-channel-average blend or either sub-screen (view toggle), .img 13824 import+export, .mg (MGH type 8) import, and GIF export emits the two sub-screens as a 2 cs flicker loop |
| **ZX Spectrum Next modes** (Layer 2 / LoRes / ULANext) | Plus | Phase 13 (2026-07-06). ZX-Paintbrush has NO Next support — the whole family is ours: **Layer 2** 256×192×8bpp, 320×256×8bpp and 640×256×4bpp, **LoRes** 128×96 (8bpp + Radastan 4bpp), **ULANext** enhanced attributes (classic cells, 256-entry palette; our documented ink/paper-half mapping). Indexed pixels are the mode seam's third branch: layer cells carry per-pixel palette indices (−1 transparent), the compositor stacks index-over-index, every drawing tool/fill/selection/transform/clipboard path works on indices, and classic-mode features gate with localized messages |
| **9-bit RGB333 programmable palettes** | Plus | Phase 13. `NEXTRGB333` codec (RECOIL DecodeNxi byte layout), 256-register document state (`ColorManager.nextRegisters`) shared by every rgb333 mode, carried by undo/autosave/F5; palette editor generalised (4×16 CLUT grid for ULAplus, scrollable 256-entry grid for rgb333); defaults hold the classic 16 in entries 0–15/128–143 so classic->Next conversion and ULANext both look right |
| **Next image/palette/sprite formats** (.nxi/.sl2/.npl/.pal/.spr) | Plus | Phase 13. `.nxi` per RECOIL (512-byte palette + bitmap; raw sizes accepted), `.sl2` raw dumps, size->mode table incl. the documented 81920 320/640 ambiguity rule; `.pal`/`.npl` 512-byte pairs + 256-byte 8-bit form (blue-OR rule); `.spr` 8/4bpp sprite sheets. PNG/JPG/GIF import quantizes per-pixel to the active palette (Floyd–Steinberg) in indexed modes |
| **Sprite editor** (16×16, 4/8bpp) | Plus | Phase 13. `SpriteService` (unpacked-index sheet, hardware transparency 0xE3/0x03, 64-sprite bank) + Sprite Editor dialog on the shared `CellGridEditor` (grown an indexed mode); canvas capture/stamp bridges in indexed modes; .spr round-trip is the sheet's persistence (documented scope: no IndexedDB store) |
| **Next tilemap export** | Plus | Phase 13. `DevFormat.generateNextTilemap`: ula-cell tiles convert to 4bpp Next tile definitions (32 bytes, classic palette slots) + u16 dims + $FF-empty cell grid, as ASM/C/BIN from the map editor. The `next-4bpp` KIND is registered in MapCodec as the export contract; in-editor authoring of indexed tiles is deliberately out of scope for now |
| Bifrost ColorTiles editing | Yes | Phase 12b — .ctile import+export (64-byte tiles: 32 bitmap + 32 attr bytes, per the z88dk BiFrost doc; 16-tiles-per-row sheets). Import switches to Multicolor 8×1 and lays the sheet top-left (ZX-PB instead refuses until you activate Timex mode and asks for dimensions); export slices the 16-px-aligned selection or the whole canvas. Editing = the normal 8×1 drawing toolset, same as ZX-PB's model |

### Transforms & manipulation

| ZX-Paintbrush feature | Ours | Notes |
|---|---|---|
| Mirror/flip screen or selection | Yes | Flip H/V, selection-scoped |
| Invert | Yes | Selection pixel invert |
| Rolling (wrap-around scroll) | Yes | `shift()` wraps, preserves attributes |
| Scrolling (non-wrap shift) | Yes | Phase 7 QW2 — `shift(dir, amount, wrap)`; Transform panel "Wrap around" checkbox |
| Overlay rotation in 4 directions | Yes | Stamp `transformStamp()` 90° steps |
| Raster moving at adjustable distances | Yes | Phase 7 QW4 — nudgeStep preference (1–32 px) + grid snap toggle |
| Import resize/rotate/flip | Yes | Reference layer has all; imports auto-fit |

### Text & fonts

| ZX-Paintbrush feature | Ours | Notes |
|---|---|---|
| Windows/system fonts on canvas | Yes | `queryLocalFonts()` + fallback, rasterized to 1-bit |
| Text in 4 directions | Yes | Phase 8 — direction option (0°/90°/180°/270°) in the text tool schema; mask rotated before the stamp is created |
| Shading and contour effects on text | Yes | Phase 8 — shadow (offset-OR) + contour (dilate-minus-glyph) as MaskOps post-processing; WYSIWYG in the stamp preview |
| Sinclair font editor (256 chars; 4×8, 6×8, 8×8) | Yes | Phase 10 — `FontService` + Font Editor dialog (shared `CellGridEditor`, width ≠ height); 96/256 coverage, glyph ops, ROM reset, canvas-cell capture, named-font library (FONTS store); edited fonts selectable in the text tool with 4/6/8-px advance |
| Font file formats CH4/CH6/CH8/CHR/CHX | Plus | Phase 10 — all five import+export (`io/font-format.js`; CHR 768/2048 variants, CHX header per RECOIL/ZX-PB strings), plus asm/c/bin glyph dumps via `DevFormat.generateFont` |
| Sinclair text editor (3 font widths) | No | Explicitly out of scope (see §4) — we are an art tool, not a text-file editor |

### File formats

| ZX-Paintbrush feature | Ours | Notes |
|---|---|---|
| SCR load/save | Plus | Also accepts 6144-byte bitmap-only SCR |
| TAP/TZX export | Plus | Ours are *self-loading* tapes with BASIC loader |
| TAP/TZX multi-block editing | Yes | Phase 9 — pure block APIs in TAPFormat/TZXFormat + Tape Blocks dialog (File menu): view metadata, load any SCREEN$ block, add current screen, remove/reorder, save; unmodified tapes re-serialize byte-identically |
| BMP/GIF/JPG import | Yes | Phase 9 — GIF routed through the PNG pipeline (quantization, dithering, conversion dialog); animated GIFs import frame 1 |
| Import conversion dialog (brightness/contrast/resize) | Yes | Phase 8 — Dialog with live quantized preview: brightness, contrast, fit/stretch/crop, dithering; Cancel aborts the import |
| PNG/BMP/GIF export | Plus | Phase 9 — dependency-free GIF89a encoder; optional two-frame FLASH-phase looping animation (~320 ms/phase), which ZX-PB doesn't do |
| ZXP internal clipboard format | Yes | Phase 9 — internal clipboard persists (versioned codec, own IndexedDB store), survives reload; Edit>Paste state correct at boot |
| ZED format | Yes | Phase 9 — .zed import/export per the ZX-Modules spec (graphics blocks; text passed over, assumptions in handler header) |
| SevenuP / ZXB interchange | Yes | Phase 9 — .sev import/export per the SevenuP 1.21 GPL source (v0.0/0.6/0.8 read, v0.8 write). `.zxb` deliberately excluded: it's ZX-Blockeditor's tape-block *meta container*, not a graphics format — our TAP/TZX block editor covers that ground |
| Map/tile editing + `.zxm` format | Plus | Phase 11 — Map Editor dialog over a pure `MapService` (kind-tagged 8×8 tiles + attribute, W×H tile-index maps): tile palette, tiles from patterns/canvas capture/in-place editing (shared cell-grid editor), paint/erase/flood-fill/pick, zoom + virtual-scrolled viewport for **multi-screen maps** (ZX-PB maps live on one screen), render-to-canvas and capture-canvas bridges, persistent working map (own IndexedDB store). `.zxm` read/write reconstructed from RECOIL's `.zxp` decoder + ZX-PB 2.6.1 loader strings — no public spec exists; assumptions documented in the handler header, chosen to round-trip our own output. Plus native `.zxtm` (JSON) and asm/c/bin developer map export |
| ZX-Blockeditor integration | No | N/A (external Windows app) |

### Clipboard & UI

| ZX-Paintbrush feature | Ours | Notes |
|---|---|---|
| Internal clipboard | Plus | Plus WYSIWYG floating-stamp paste preview before commit; persists across reloads since Phase 9 |
| **Windows/system clipboard paste** | Yes | Phase 7 QW1 — native `paste` event + `navigator.clipboard.read()` -> quantizer -> floating stamp |
| Scalable UI (3 display sizes) | Plus | Continuous accessibility font scaling |

### Features we have that ZX-Paintbrush lacks

ZX-Paintbrush never had a layer system (confirmed — third-party listings
claiming "layers" are boilerplate). Ours-only:

Layer system with ZX-correct compositor · reference layer · floating-stamp paste
preview · SNA import · self-loading TAP/TZX with BASIC loader · developer
exports (ASM/C/BIN/ATR) · 30+ shapes · 7 gradient types with dithered
rendering · pattern library + in-app pattern creator (`.pat`) · eyedropper with
full-attribute pick · 6 themes · 13 languages · autosave/restore · runs in any
browser with zero install.

Added post-rebuild, 2026-08-07 and 2026-08-08 — none of these has a
ZX-Paintbrush counterpart:

- **`.pixula`, a project format that keeps the document.** ZX-Paintbrush's
  `.zxp` stores one picture; every format either app reads is one flattened
  screen. This is the whole 32-layer document, gzipped, and Save As defaults
  to it.
- **Versioned autosave to disk.** Each tick writes a numbered copy to a chosen
  folder, so the trail of a session is browsable. Retention is a keep count,
  since the interval controls frequency and not total files.
- **Two preset libraries.** Per-tool named settings, and nine whole-workspace
  slots on Alt+1..Alt+9. Reference presets link the tracing photo rather than
  embedding it.
- **A Privacy block** stating, and testing, that the app makes no network
  request of any kind — with a live count of what is stored and a button that
  deletes it.
- **Three distinct erase behaviours.** Left button draws ink, right button
  removes ink while still colouring the cell, and the eraser tool removes
  everything including the attributes. ZX-Paintbrush's right button is a plain
  paper draw.

---

## 3. Next Work — gaps to close (prioritised)

(A former pointer to `docs/COMPLETION.md` Groups 4–5 was removed 2026-07-08 —
that file does not exist in this repo; everything actionable is tracked below
and in `tests/TESTLOG.md`.)

### Quick wins — ALL DONE (Phase 7, 2026-07-04)
1. ~~**System clipboard paste**~~ — done (Phase 7 QW1).
2. ~~**Non-wrap scroll**~~ — done (Phase 7 QW2).
3. ~~**Rounded rectangle + parallelogram**~~ — done (Phase 7 QW3).
4. ~~**Configurable nudge distance / grid snap**~~ — done (Phase 7 QW4).

### Medium — drawing-parity items DONE (Phase 8, 2026-07-04)
5. ~~**Symmetry drawing mode**~~ — done (Phase 8): H/V/quad hooked once in `PixelDrawRoutine.draw()`; every tool inherits, services opt out via `suspendMirror()`.
6. ~~**Import conversion dialog**~~ — done (Phase 8): `ImportDialog` + pure `PNGFormat.applyBrightnessContrast()`/`quantizeForPreview()`.
7. ~~**Text direction + effects**~~ — done (Phase 8): direction/shadow/outline in the text tool schema; pure `MaskOps` post-processing. (Bezier — the remaining No drawing-tool row — also done in Phase 8 as the 14th tool.)
8. ~~**GIF import** and **GIF export**~~ — done (Phase 9): import via the PNG pipeline; export via a pure GIF89a encoder incl. the two-frame FLASH animation option.
9. ~~**Marching ants, magic wand, freeform selection**~~ — done (verified 2026-07-08: `selection-tool.js` ships rectangle/cell/wand/freeform modes and `grid-overlay.js` draws marching ants incl. the masked variant; an ellipse mode joined them 2026-07-21, rasterised by the same offscreen-fill trick as the lasso); ZX-PB has none of these, so they extend our lead.

### Large / strategic (each is a mini-project)
10. ~~**Sinclair font editor**~~ — done (Phase 10): `FontService` + Font Editor dialog on the shared `CellGridEditor`; CH4/CH6/CH8/CHR/CHX read/write + dev dumps; library fonts feed the text tool. With this, §2 is at full parity outside the screen-mode family (rows 12–14).
11. ~~**Map/tile editor**~~ — done (Phase 11): MapService + Map Editor dialog, `.zxm` + native `.zxtm` + dev export; tile source seam kind-tagged for the Phase 13 Next tilemap banks.
12. ~~**ULAplus support**~~ — done (Phase 12a): runtime mode seam + editable 64-register palette (ColorManager palette-as-data), palette editor, SCR 6976 variant, Image2ULAplus PNG import.
13. ~~**Timex hi-colour / hi-res modes**~~ — done (Phase 12b): Timex SCREEN$ 12288/12352 containers on the 12a MULTICOLOR_8x1 cell model (+ new ULA_PLUS_8x1 mode), and the full TIMEX_HIRES 512×192 mode (mono scheme, width-conversion rules, SCR 12289 + .hrg) — the geometry stress test passed.
14. ~~**Multicolor modes**~~ — done (Phase 12a): 8×4/8×2/8×1 on the runtime seam, .mlt/.mc/.ifl formats. ~~**GigaScreen**~~ — done (Phase 12b) as a Plus (ZX-PB never had it): tagged-layer sub-screens, blend/A/B views, .img/.mg, flicker GIF. Bifrost .ctile also done (Phase 12b). **§2 is now 100% green — Phase 13 (Next modes) is the only remaining phase.**
15. ~~**ZX Spectrum Next modes**~~ — done (Phase 13, 2026-07-06): indexed-pixel core (the seam’s third branch), six mode descriptors, RGB333 palettes + generalised editor, .nxi/.sl2/.npl/.pal/.spr, sprite editor, Next tilemap export. **Every build phase of the rebuild is complete — the consolidated manual pass is all that remains.**
16. ~~**Interchange formats** (ZXP/ZED/SevenuP/ZXB)~~ — done (Phase 9): ZXP-equivalent persistent clipboard, ZED + SEV import/export; ZXB excluded by design (tape-block meta container, covered by the TAP/TZX block editor).

### Explicitly not planned
- **ZX-Blockeditor integration** — external Windows tool, N/A for a browser app.
- **Sinclair text editor** — out of scope; we are an art tool, not a text-file editor.
