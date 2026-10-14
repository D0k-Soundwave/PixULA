# Batch 11 - Maps: find repeated elements

Group D, branch `parity-d`. Parts: 11A, 11B (one session each).
Read `RUNBOOK.md` first. Figures from the ZX Paintbrush help are
[P, ZX Paintbrush 2.6.4 help, read 2026-10-08].

Comparison doc row: Find and create map elements.

Help pages: `find_and_create_new_map_elemen`, `find_new_map_elements`,
`map_editing_bar`, `map_editing_dialog`, `map_element_list`,
`map_element_list2`, `toggle_map_element_display`, `blockbasedediting`.

## What ZX Paintbrush does

Select an area and press Ctrl+F: the selection becomes a map element, and
every place on the screen where it appears is found and listed. Match
modes: "Pixels+Attrs" (dots and colours equal), "Pixels only" (colours
ignored), "Visual compare" (looks the same even if the bytes differ).
Accepting stores the element in the element list and covers the found
places; they are shown as numbered placeholders or as the picture (M key
toggles).

## What PixULA has today

- `js/services/map-service.js` (pure, no DOM): tiles are ONE attribute
  cell (`{ kind, bitmap, attr }`), a tileset, and a map of tile indices;
  `tilesEqual`, `findTile`, `addTile`, `captureCanvasRegion`,
  `captureCanvasRegionToMap` (stores identical cells once, exact match).
  Persistence through `js/utils/map-codec.js` (versioned) and
  `js/io/map-format.js`.
- Map Editor dialog `js/ui/components/map-editor-dialog.js`.
- Tests: `tests/map-service.test.js`, `tests/map-codec.test.js`,
  `tests/map-format.test.js`, browser `map-editor-*.spec.js`.

## Decisions

Defaults:
- An element is a block of whole cells (w x h cells, any size up to the
  screen). The search steps one cell at a time (map positions are cell
  positions). A pixel-step search is out of scope unless Opus shows a clear
  use.
- Visual compare: two cells match when they would display the same RGB in
  both flash phases. So a cell with no dots matches any cell whose paper
  shows the same colour; dots inverted with ink and paper swapped match the
  original; a set dot's ink colour matters, an unset dot's ink colour does
  not. GigaScreen compares the blended result.
- Elements live in the map document (a new element list beside the
  tileset), so the MapCodec version goes up by one and old maps still load.
  Mandatory Opus consult on the codec change.
- Only modes with cell attributes and 1-bit dots (the modes the Map Editor
  supports today - `MapService.isCanvasCompatible()`).

OWNER: none known. If Ctrl+F is taken (check the browser's own find and
PixULA's keys), ask which key to use, recommending a menu item plus
Ctrl+Shift+F.

## Part 11A - the find engine

Build:
1. `MapService.findElement(block, mode)` (pure): `block` = cell data of the
   selection; returns every cell position where it matches, by mode
   (`'exact'`, `'dots'`, `'visual'`), including the source position.
2. `MapService.addElement(block)` and the element list in the map model,
   with save/load through MapCodec (version + 1, old versions load).

Tests: the three modes on built test pictures (inverted cells, cells with
empty dots and different ink, a GigaScreen pair); positions sorted; source
position included; codec round-trip; old codec versions still load.
Speed: a 1x1 and a 4x4 block searched over a full 256x192 screen, timed
[M] in `docs/FIGURES.md`.

Done when: elements of any size are found by all three modes and saved with
the map.

## Part 11B - the Map Editor side

Build:
1. "Find in picture" (from the current selection; the key per the OWNER
   note): shows the found count and highlights every place on the canvas;
   the mode is a select in the dialog; Accept stores the element.
2. Element list in the Map Editor, with placeholder or picture display and
   the toggle key (check M is free - M is the Selection tool; consult the
   owner if no free key).
3. i18n, manual (`85-editors.md`) and translations, Playwright spec.

Done when: an element can be found, previewed, accepted and listed, and the
comparison row reads Same.

## After 11B

Batch 11 is done. Update the comparison doc row, then hand off to Batch 12
part 12A.

## Batch 11A plan review (Opus, 2026-10-13; this also served as the mandatory codec consult)

CHANGE then go. Corrections that replace the wording above:
- Visual compare = each dot's colour as the pair (colour in the normal flash phase, colour in the inverted phase), canonical per cell by first
  appearance; independent of Colours off, Colour grid, Stop flashing and the GigaScreen view; live palette (standard colours, ULAplus CLUT, ULANext
  palette, Timex scheme). "An unset dot's ink does not matter" is FALSE for FLASH cells. GigaScreen blends per dot and per phase with (c1+c2)>>1 (so
  red-over-blue matches magenta-over-black; pin it in a test).
- Modes: MapService.isCanvasCompatible() (standard_ula, ula_plus, ulanext, gigascreen, timex_hires, timex_hires_giga). 'exact' is refused when
  !ColorManager.hasCellAttributes() (Timex). Multicolor / 8x1, MultiGiga, Layer 2, LoRes are refused. MapService.findModes() feeds the 11B select.
- Pure core in a new js/utils/map-find.js (MapFind.cellIds / search / disjoint); MapService gets colourTable(), captureScreen(), sliceBlock(),
  findElement(block, mode, screen, table) -> {positions}|null. Source = LayerManager.flattenVisible(), not captureCanvasRegion (which adds tiles and drops
  GigaScreen screen B). addElement(block, positions, {match, name, gridW, gridH}) validates, sorts, de-duplicates, trial-encodes, emits
  EVENTS.MAP_ELEMENTS_CHANGED; also getElements, removeElement, elementFitsScreen.
- MapCodec VERSION 2 (decode 1 and 2; v1 -> elements []); element record {name,w,h,s,gw,gh,m,b,a,p}; restorePersisted/loadDocument through one _adopt;
  persist() must not delete the stored map when encode returns null (keep the old record, log a warning); MAX_ELEMENTS guard only, the real limit is the
  trial encode. Elements are not in undo.
- Overlapping places: findElement returns all; Accept uses MapFind.disjoint (source first, then reading order).
- ZXM: with doc.elements a .zxm export would silently drop them: 11B must write them or warn. The row reads "Same in 8x8-cell modes" unless the owner
  accepts Partial. Drop the help page `blockbasedediting` from the list.
OWNER questions for 11B (none block 11A): find key (Ctrl+F recommended, costs the browser find bar; or Ctrl+Shift+F); where placeholders show (main
picture -> M is the Selection tool so Shift+M plus a View item; or only inside the Map Editor); a place already covered by an earlier element (skip =
default); drawing over covered places (default: allowed; blocking needs a change to the one write gate); New / Open with elements present (ask?);
GigaScreen blended compare (confirm); multicolor / 8x1 modes refused (row "Same in 8x8-cell modes").
Build order: 0 pin the v1 payload; 1 capture + exact + dots; 2 visual (+ oracle test against the compositor); 3 elements + codec v2; 4 timings.

## Batch 11B plan review (Opus, 2026-10-14)

CHANGE then go. ZX Paintbrush: Accept stores the element and COVERS its places (display only, the picture is not written); numbered placeholders, M toggles to the
element picture; elements are not in undo; New/Open asks whether to abandon them; list can delete (optionally merge into the picture), import/export .zxp. Changes to
the plan: the find and the element list live in ONE non-modal sidebar panel (the Map Editor is modal and hides the picture), not in the Map Editor; addElement returns
reason codes; Map Editor tile imports must keep elements; the tile .zxm writer is renamed exportTileMap and a picture-plus-elements .zxm writer takes the 'zxm' export;
.zxtm load must not count as replacing the picture; fix the stale "render a map back onto the canvas" manual sentence; two comparison rows (Map element list, ZXM files)
are rated too high. Split: 11B (find: panel, overlay, Edit row, Ctrl+F, manual), 11B2 (element list, picture display Shift+M, New/Open guard, rows), 11B3 (ZXM picture+elements,
project/autosave carry). Overlay = two canvases (picture-resolution cover layer, screen-resolution numbers/outlines). 390x844 portrait is not a drawable layout today
(fixed toolbar+panel 408 px); real phone test is 844x390.
OWNER questions in order: 1 find key (Ctrl+F recommended); 2 covered look (numbered boxes); 3 place already covered (left out); 4 GigaScreen blended compare; 5 modes refused;
before 11B2: 6 drawing on covered place (allowed, hidden); 7 New/Open with elements (ask); before 11B3: 8 .zxm from File menu (picture+elements); 9 project/autosave keep elements (yes).
