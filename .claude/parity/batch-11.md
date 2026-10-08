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
