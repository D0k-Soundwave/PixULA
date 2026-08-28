# Attributed stamps: Save Tile / Save Room / Save as Stamp — design

Status: approved in chat 2026-08-28. Not yet implemented.

## 1. Motivation

Two editors place their own content onto the main drawing canvas, and both do
it with a direct, immediate write — no preview, no repositioning, no way to
place more than one copy without repeating the whole operation:

- **Map Editor** (`js/services/map-service.js`, `MapService.renderMapToCanvas`)
  always writes whatever screen-sized window the map viewport happens to be
  scrolled to, always at destination cell (0,0) — there is no positioning
  step at all (`js/ui/components/map-editor-dialog.js`, the `.me-render`
  click handler passes fixed `0, 0`).
- **Sprite Editor** (`js/services/sprite-service.js`, `SpriteService.
  stampToCanvas`) at least takes typed X/Y fields, but still writes
  immediately with no preview and no repeat-placement.

The app already has a real answer to "place content repeatedly, with a
preview, draggable before it commits": the stamp-layer mechanism in
`SelectionService` (`startFloatingPasteFromMask`, `layer.isStamp` /
`layer.stamp`, `stampAt()`), already used by paste and by placed brush
content. It supports a boolean pixel mask plus either one global colour
selection or, for indexed Next modes, per-pixel palette indices
(`floatingPaste.indices`). It does **not** support per-cell ZX attributes
(ink/paper/bright/flash varying across the stamp) — the one thing a Map tile
or a room built from several tiles actually needs, since every tile carries
its own attribute byte (`MapService.attrByte`/`attrFields`,
`js/services/map-service.js:73-86`).

This design adds that missing capability and wires both editors to it.

## 2. Goals / non-goals

**Goals:**
- `SelectionService`'s stamp data model gains an `attrs` field: one ZX
  attribute byte per 8x8 cell of the stamp's mask.
- Map Editor gains two new actions, replacing `Render to Canvas` entirely:
  - **Save Tile to Stamp** — stamps the single tile currently selected in
    the tile palette (`MapEditorDialogClass._selected`,
    `js/ui/components/map-editor-dialog.js:29`).
  - **Save Room to Stamp** — stamps an artist-picked rectangle of the map
    (a new **Select** tool in the map viewport, alongside the existing
    Paint/Erase/Fill/Pick tools).
- Sprite Editor's `Stamp to canvas` becomes **Save as Stamp**, using the
  existing indexed-stamp path (`indices`, not `attrs` — sprites carry no
  ZX attribute at all).
- Every one of these produces a real stamp layer: it follows the cursor,
  places a copy on click (repeatable), can be toggled into floating mode for
  precise drag positioning, and persists in the layer panel until deleted —
  exactly like every other stamp in the app.

**Non-goals:**
- No scale/rotate/warp for `attrs`-carrying stamps (§6) — v1 only.
- No change to Sprite Editor's `Capture 16x16` (canvas -> sprite direction);
  this design only touches the place direction.
- No change to `MapService.captureCanvasRegion`/`captureCanvasRegionToMap`
  (canvas -> map direction) — untouched.
- `Render to Canvas` is removed outright, not kept alongside the new
  actions (per the "replace, not coexist" decision made in chat) — nothing
  in the Map Editor keeps the old zero-positioning direct-write behaviour.

## 3. Data model: the `attrs` field

Extends the shape already carried by `SelectionService.floatingPaste` and
the persisted `layer.stamp` (`js/services/selection-service.js:616-632`,
`:1038-1046`):

```
{
  pixels, width, height, x, y,     // existing: mask + position
  colorSelection,                  // existing: classic-mode global ink
  indices,                         // existing: indexed-mode per-pixel palette index
  attrs,                           // NEW: per-cell ZX attribute byte, classic modes only
  ...
}
```

`attrs` is a flat array of `ceil(height / cellH) * ceil(width / cellW)`
bytes (cell geometry from the tile kind — always `SCREEN_MODES.STANDARD_ULA`
8x8 for `'ula-cell'` tiles per `MapService.getTileSize()`,
`js/services/map-service.js:53-58`), row-major over cells, packed
`(FLASH<<7)|(BRIGHT<<6)|(PAPER<<3)|INK` — the same byte `MapService.
attrByte` already produces. `attrs` and `indices` are mutually exclusive on
one stamp (classic per-cell attribute vs. indexed per-pixel palette — a
stamp is one model or the other, matching how tile kinds and sprite depths
already never mix); `attrs` and `colorSelection`-driven ink are also
mutually exclusive (an attributed stamp brings its own colour per cell, it
does not borrow one shared ink the way a normal brush stamp does).

**Cell-grid alignment is load-bearing, not cosmetic.** An indexed stamp's
`indices` are per-PIXEL, so dragging it to any pixel offset is always
well-defined. `attrs` is per-CELL: if a dragged stamp's `x`/`y` is not a
multiple of 8, a single destination cell would straddle two different
source cells, each carrying a different attribute byte — genuinely
ambiguous, not just clashing within the normal two-colours-per-cell limit.
So `attrs`-carrying stamps snap `x`/`y` to the 8px cell grid on every move
(`moveFloatingPaste`, `js/services/selection-service.js:1008`) — every
destination cell then maps to exactly one source cell, and the preview/
commit loops (§4) can iterate cell-by-cell directly instead of doing
per-pixel cell math. This also matches what "placing a tile/room" should
look like visually: sub-cell placement would cut a tile's attribute cell in
half against the canvas's own grid regardless of how the clash were
resolved. Indexed (Sprite) stamps are unaffected and keep free-pixel drag.

A single-tile stamp (`Save Tile to Stamp`) is the 1x1-cell case of this —
`attrs` is a one-entry array. No separate code path for it.

`_createFloatingPaste` (`js/services/selection-service.js:591`) gains an
optional `attrs` parameter, stored alongside `pixels`/`width`/`height` on
`this.floatingPaste`. `endFloatingPaste`'s persisted-stamp object
(`:1038-1046`) gains the same field, so a repositioned/reopened stamp keeps
its per-cell colours. Undo capture/restore
(`captureFloatingState`/`restoreFloatingState`, `:74-157`) serialise
`attrs` the same way they already do `indices`.

## 4. Rendering: two new branches, siblings of the existing indexed ones

**Preview** (drag, no commit yet) — new `_drawFloatingLayerAttributed()`,
called from `_drawFloatingLayer()` (`js/services/selection-service.js:1657`)
before the indexed-mode check, gated on `this.floatingPaste.attrs` being
present. Like `_drawFloatingLayerIndexed()`, it writes straight into the
floating layer's own cells (the documented "stamp drag preview" bulk
exception to the drawing gate — CLAUDE.md's drawing-gate section already
lists this as sanctioned, not a new exception type). Because `x`/`y` are
always cell-aligned (§3), it iterates destination cells directly — one
stamp source cell per destination cell, no per-pixel cell-boundary math —
writing that cell's mask bits into `floatingLayer.getCell(cx,cy).pixels`
and its ink/paper/bright/flash straight from `attrs[cellIndex]`, no
inheriting paper from the target layer the way the plain classic-mode
branch does, since an attributed stamp's whole point is that it brings its
own paper.

**Commit** (bake into the real target layer) — new branch in `stampAt()`
(`:1296`) and `commitStamp()` (`:1467`), siblings of `_paintIndexedStamp()`
(`:1338` on). Goes back through `PixelDrawRoutine.draw()` per pixel within
each cell (gate-respecting, inside the existing
`PixelDrawRoutine.suspendMirror(...)` wrapper both callers already use),
using that cell's `attrs` entry instead of `inkOnlyColor()`'s "stamp ink,
inherited paper." This is the exact
per-pixel NORMAL/PAPER loop `MapService.renderMapToCanvas` already runs
today (`js/services/map-service.js:404-425`) — the new code reuses that
shape rather than inventing a second one.

## 5. Map Editor wiring

- **Save Tile to Stamp**: new button next to New Tile / From Pattern /
  Delete Tile (`js/ui/components/map-editor-dialog.js`, the
  `.me-tile-toolbar` area). Reads `MapService.getTile(this._selected)`,
  builds a 1x1 mask + one-entry `attrs` from its `bitmap`/`attr`, calls
  `SelectionService.startFloatingPasteFromMask(mask, 8, 8, x, y, 'Save
  Tile to Stamp')` with the new `attrs` argument. Disabled when
  `this._selected < 0` (no tile exists), same guard the Delete Tile button
  already uses.
- **Save Room to Stamp**: new `select` tool value alongside the existing
  `paint`/`erase`/`fill`/`pick` (`this._tool`, `js/ui/components/
  map-editor-dialog.js:30`). Drag on the map viewport sets a rectangle (map
  cell coordinates, clamped to the map's own bounds — same clamping
  `MapService.resizeMap` already applies). A new **Save Room to Stamp**
  button, enabled once a rectangle exists, walks the selected tiles via
  `MapService.getMapCell`/`getTile`, builds a `width x height` (in pixels,
  cells * 8) mask + `attrs` grid, same `startFloatingPasteFromMask` call.
  Empty map cells (`-1`, no tile) contribute a fully-transparent mask
  region (mirrors how `renderMapToCanvas` already skips them, `js/
  services/map-service.js:409`); their `attrs` slot is never read, since
  every attrs-consuming loop (§4) only visits a cell where the mask has at
  least one set pixel, the same "if (!tile) continue" shape
  `renderMapToCanvas` already uses.
- `Render to Canvas` (the `.me-render` button and its click handler,
  `js/ui/components/map-editor-dialog.js:268-272`) and `MapService.
  renderMapToCanvas` (`js/services/map-service.js:393-426`) are deleted —
  fully superseded by Save Room to Stamp, which covers the same "put map
  content on the canvas" job with a preview and repeat-placement neither
  old action had.

## 6. Sprite Editor wiring

`SpriteService.stampToCanvas` (`js/services/sprite-service.js:196-`) is
replaced by a `SpriteService.saveAsStamp(n)` (or the dialog calls
`SelectionService` directly — implementation plan decides) that builds a
16x16 mask + `indices` from `SpriteService.sprites[n]` (mapping the sheet's
transparency index to mask=0) and calls `startFloatingPasteFromMask`,
mirroring exactly what `SelectionService.startFloatingPaste` already does
for an indexed clipboard paste (`js/services/selection-service.js:561-571`).
No `attrs` involved — sprites carry no ZX attribute, only per-pixel palette
indices, which the stamp mechanism already fully supports. The `.se-stamp`
button becomes `.se-save-stamp` / **Save as Stamp**; the `bx`/`by` fields
become the stamp's initial drop position instead of its final, immediate
write position.

## 7. Transform support

Scale/rotate/warp stay disabled (existing transform handles hidden/no-op)
whenever `floatingPaste.attrs` is present — rotating or resampling an
8x8-cell attribute grid at an arbitrary angle or scale has no defined
mapping onto valid ZX cells. Flip H/V (reverse cell order, no resampling)
is included if it falls out of the implementation cheaply; it is not
load-bearing for this design and can be dropped without changing anything
else here.

Sprite stamps (`indices`, no `attrs`) keep the full existing transform set
unchanged — plain indexed-pixel resampling, already supported, and a nice
match for real Next hardware's own sprite mirror/rotate attribute flags.

## 8. Testing impact

- Node (`tests/*.test.js`, stubbed layers per `tests/erase-modes.test.js`'s
  pattern): the new attrs-carrying preview/commit paint loops, pure byte
  math — build a small stamp with two different per-cell attrs, assert the
  committed target layer's cells end up with the right ink/paper/bright/
  flash each, assert `indices` and `attrs` are never both present on one
  stamp.
- Playwright: extend the existing stamp-interaction specs (drag, click to
  place repeatedly, toggle floating mode, delete via layer panel) to cover
  a `Save Tile to Stamp` stamp and a `Save Room to Stamp` stamp, rather
  than writing a new interaction paradigm from scratch. New spec coverage
  for the map viewport's Select tool (drag a rectangle, clamped to map
  bounds, button enable state). Sprite Editor's existing bridge-gate spec
  (`isCanvasCompatible`) extends to cover `Save as Stamp` the same way it
  already covers `Capture 16x16`.
- Delete/update whatever currently covers `Render to Canvas` and the old
  `Stamp to canvas` (immediate-write assertions) — those behaviours no
  longer exist.

## 9. Figures register

| Figure | Value | Tag | Source |
|---|---|---|---|
| Map tile geometry | 8x8 px per cell | M | `SCREEN_MODES.STANDARD_ULA.attrCellW/H`, `constants.js`; `MapService.getTileSize()` |
| Sprite geometry | 16x16 px | M | `SPRITE_SIZE` / `SPRITE_PIXELS` (256), `js/services/sprite-service.js` |
| ZX attribute byte layout | `FLASH<<7 \| BRIGHT<<6 \| PAPER<<3 \| INK` | M | `MapService.attrByte`, `js/services/map-service.js:73-76` |

No sizing/threshold figures in this design carry any real constraint — the
data added (`attrs`) is bounded by the same tile-count/map-size caps
(`MapCodec.MAX_TILES`, `MapCodec.MAX_DIM`) that already govern the source
data it's built from.
