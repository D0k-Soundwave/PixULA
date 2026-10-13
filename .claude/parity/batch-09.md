# Batch 9 - Selection and view

Group C, branch `parity-c`. Parts: 9A, 9B (one session each).
Read `RUNBOOK.md` first. Figures from the ZX Paintbrush help are
[P, ZX Paintbrush 2.6.4 help, read 2026-10-08].

Comparison doc rows: Selectors: 8x8, 16x16, whole screen, user-defined size;
Export selection; new file from selection; Preview window; Raster jump 8x8,
16x16, 256x192, user-defined.

Help pages: `selection_bar`, `selection_tool_bar`, `rectangular_selector`,
`selector_16x16`, `screen_selector`, `user_defined_selector`,
`adjust_selection_to_8x8_pixels`, `new_file_from_selection`,
`export_selection`, `toggle_preview_window`, `raster_bar`, `raster_jump`,
`raster_jump_8x8_pixels`, `raster_jump_16x16_pixels`,
`raster_jump_256x192_pixels`, `user_defined_raster`.

## What ZX Paintbrush does

- Fixed-size selectors: 16x16 (matches Bifrost and Nirvana tiles), 256x192
  (one SCREEN$ inside a bigger picture), and a user size from X/Y rulers.
  Drag to select multiples of the size, or click to select one block.
- New file from selection: opens the selection as a new picture.
- Export selection: saves just the selection, in the formats its size
  allows (picture formats any size; SCR only 256x192; SEV 8x8 to 256x192;
  character sets 128x128; CHX 8x8 to 32x32; ASM and others any). The
  selection must first be snapped to 8x8.
- Preview window: a miniature of the whole picture.
- Raster jump: the pointer moves in steps of 8x8, 16x16, 256x192 or a user
  X/Y step, so drawing lands on a grid.

## What PixULA has today

- Selection tool `js/tools/selection-tool.js`: `selectMode` rectangle,
  ellipse, cell (attribute cells), freeform; `SelectionService`
  (`js/services/selection-service.js`: `setSelection`, `getSelection`,
  `selectAll`, `moveSelection`, copy, paste).
- Snap: `StateManager.getGridSnap()` (Shift+S), used in
  `InputHandler` (search `_snapContextActive`) to snap the pointer to the
  attribute grid; arrow nudge with the `nudgeStep` preference.
- Files: `FileManager` (`js/io/file-manager.js`): `newFile`, `save`,
  `saveAs`, `exportAs(ext)` (File > Export As submenu,
  `file:exportAs:<ext>`), the format registry `js/io/format-registry.js`;
  `.ctile` export can slice a selection (`js/io/ctile-format.js`).
- Panels: `PanelSection` (`js/ui/components/panel-section.js`) builds the
  sidebar panels from `#tpl-panel`; View menu toggles them.

## Decisions

Defaults:
- Selector sizes become a "Size" option on the rectangle selection: Free
  (today), Cell (today's cell mode), 16x16, Screen (only when the canvas
  is bigger than 256x192, i.e. Layer 2 320 and 640), Custom (X and Y
  steps). Drag selects whole multiples; click selects one block.
- Raster jump reuses the snap: the Snap toggle gains a step choice - Cell
  (today), 16x16, Screen, Custom (X and Y) - in the same place the snap is
  set (status bar toggle and Preferences). The selector and the snap keep
  separate custom X/Y pairs: a drawing step and a tile size for selecting
  are different jobs, and one setting for both would force one to follow
  the other.
- New file from selection: Edit > New picture from selection - the
  selection becomes the whole new document (same screen mode), positioned
  at the top left, rest empty; the current document is kept as autosave
  backup first (follow `FileManager.newFile`'s own confirm flow).
- Export selection: File > Export selection as... - the same format list
  as Export As, each format enabled only if the selection size suits it
  (picture formats: any size; .scr and tape: exactly the mode's screen;
  others per their writer). The selection is snapped to cells first when
  the format needs whole cells, with a status message.
- Preview: a sidebar panel "Preview" (View menu toggle, collapsible like
  the others) showing the whole picture at a size that fits, with a frame
  showing the visible part; clicking it scrolls the canvas there.
  Remember: one layout for every screen size (memory: no device-specific
  layouts) - the panel scales like the rest.

OWNER: none known.

## Part 9A - Selector sizes and raster jump

Build:
1. Selection size option and its behaviour (drag = multiples, click = one
   block), in every mode (cell size from `ZX_SPECTRUM.CELL_WIDTH/HEIGHT`).
2. Snap step choice and the custom X/Y step; pointer snapping in
   `InputHandler` follows it for every tool that snaps today.
3. Arrow nudge with snap on moves by the snap step.
4. i18n, manual (selection and snap sections) and translations,
   Playwright spec.

Tests: selection rectangles for drag and click at each size; snap points at
each step; Screen size offered only on canvases bigger than one screen.

Done when: selections can be 16x16, screen-sized or custom-sized, and the
pointer can jump in any of those steps.

## Part 9B - New picture from selection, export selection, preview

Build:
1. `FileManager.newFromSelection()` and its menu item (undoable as a
   document change if `newFile` is; otherwise behind its confirm).
2. `FileManager.exportSelectionAs(ext)` reusing each format's writer on a
   cropped document; the size rules per format live with the format
   (registry metadata), not in the menu.
3. Preview panel, live: redraws on canvas change, throttled like the
   pointer readout; frame and click-to-scroll.
4. i18n, manual (`70-menus.md` prose, `80-files.md`) and translations,
   Playwright spec.

Tests: export of a selection equals a crop of the full export (PNG); .scr
offered only at full-screen size; new picture holds exactly the selection;
preview panel frame matches the scroll position.

Done when: a selection can become a new picture or be exported in every
format that suits its size, and the preview panel shows the whole picture.

## After 9B

Batch 9 is done. Update the comparison doc rows, then hand off to Batch 10
part 10A.

## Owner decisions (asked 2026-10-12 / 10-13, recorded here 2026-10-13)

Selection blocks start where you press (with Snap on the press drops to the snap cell first). 9B: ask "are you sure" first (New picture from selection;
the question now comes BEFORE a waiting figure is drawn); keep all layers, cropped; build any-size ASM / C / BIN / ATR export of the selection; the Preview
panel stays hidden until View > Preview; the whole-picture ctile and the Ctrl+Z fix are both built.
