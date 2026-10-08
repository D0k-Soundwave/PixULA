# Batch 3 - Seeing attributes

Group A, branch `parity-a`. Parts: 3A, 3B (one session each).
Read `RUNBOOK.md` first. Figures from the ZX Paintbrush help are
[P, ZX Paintbrush 2.6.4 help, read 2026-10-08].

Comparison doc rows: Colour display switch; Flashing mode switch; Colour grid;
Custom info bar; User-defined grid; Options (PLOT coordinates and grid
colours only - the rest of that row stays with Batch 12).

Help pages: `colour_display`, `flashing_mode`, `colour_grid`,
`user_defined_grid`, `options_dialog` (the "Colour options" and "Info bars"
sections), `view_bar`, `toggle_bar`, `pixels_grid`, `character_grid`.

## What ZX Paintbrush does

- Colour display switch: hides all colours (display only) and shows the dots
  in black on white, so you see which dots are really set.
- Flashing mode switch: stops or starts flashing on screen.
- Colour grid: hides colours (display only) and shows a chessboard of the
  attribute cells, so the cell ranges are easy to see.
- Custom info bar: shows the attribute under the pointer, the pixel's screen
  address and the attribute's screen address. Options choose the formats,
  and whether Y counts up from the bottom (BASIC PLOT style).
- User-defined grid: a grid at any X step and Y step, set independently.
- Options: the character grid and pixel grid colours.

## What PixULA has today

- Grids: `js/ui/grid-overlay.js` - pixel grid (1x1), cell grid (attribute
  cell), block grid (16x16); colours come from CSS variables
  `--grid-pixel-color`, `--grid-cell-color`, `--grid-block-color` (themes).
  Toggles: View menu (`js/ui/menu-system.js`) and the zoom strip
  (`js/ui/components/canvas-controls.js`).
- Pointer readout: `js/ui/components/canvas-controls.js` (throttled cursor
  and cell position readout). It shows X/Y and the cell only.
- Flashing: `LayerManager` keeps a flash clock (`_flashClockId`,
  `_flashInverted`, `_flashingCells`, near line 646 of
  `js/core/layer-manager.js`) and the compositor swaps ink and paper of
  flashing cells while `_flashInverted` is set.
- Compositor: `LayerManager`'s per-cell render path (search
  `_flashInverted` - every place it is read is a place a display-only colour
  rule must also apply) feeding `CanvasSystem.blitCellBits` /
  `blitCellIndices`.

## Rules for every part

- **Display only.** None of these may change the document, undo, autosave,
  projects or any export. Check which outputs read the display canvas
  (`grep -rn "toDataURL\|getImageData" js`) and prove in a test that a PNG or
  GIF export is byte-identical with the view switches on and off.
- The switches are view settings: remembered per browser (like grid
  visibility), not stored in projects.
- Changing the compositor is a mandatory Opus consult (RUNBOOK section 5).

## Decisions

Defaults:
- View menu gets: **Colours off**, **Stop flashing**, **Colour grid** (three
  toggles, near Show Grid), and **Custom Grid...** (opens the step settings).
- Colours off: set dots black, clear dots white.
- Colour grid: set dots black; clear dots alternate white and light grey,
  cell by cell like a chessboard. Colours off and Colour grid exclude each
  other (turning one on turns the other off).
- Stop flashing shows each cell in its normal (unswapped) phase and pauses
  the clock; turning it off resumes.

OWNER: none known.

## Part 3A - Colours off, Stop flashing, Colour grid

Build:
1. View state: three booleans in `StateManager` (or wherever grid visibility
   is kept - follow that), with events so the compositor and menus update.
2. Compositor: one display-colour rule applied where colours are resolved,
   covering every render path that reads `_flashInverted`.
3. Mode handling:
   - cell-attribute modes (standard, multicolor, ULAplus, ULANext): as above;
   - GigaScreen and MultiGiga: Colours off shows four grey levels from the
     two screens (no dot = white, one screen's dot = light or mid grey,
     both = black); Colour grid uses a chessboard per cell with the same
     greys;
   - Timex hi-res: Colours off shows black on white (the mode's two colours
     replaced); Colour grid is off (no cells), with a hint;
   - indexed modes (Layer 2, LoRes): Colours off and Colour grid disabled
     with a hint (every pixel is its own colour, there are no dots to show);
   - Stop flashing: all modes that flash; disabled in modes where nothing
     flashes (ULAplus, ULANext, indexed), with a hint.
4. Menu items with checked state; i18n in 13 locales; manual paragraph in
   `20-attribute-clash.md` (it is the chapter about cells) and translations.
5. Playwright spec: each switch changes the screen (read pixels from the
   display canvas) and not the document.

Tests: compositor colour rule per mode (Node, through the existing render
stubs); exports byte-identical with switches on; the flash clock pauses and
resumes.

Done when: the three switches work and are display only, in every mode the
rules allow, and are disabled with a reason in the others.

## Part 3B - Pointer readout, PLOT coordinates, custom grid, grid colours

Build:
1. Readout (`canvas-controls.js`): beside X/Y and cell, show the attribute
   under the pointer as its byte value (decimal and hex) and its parts
   (ink, paper, bright, flash; ULAplus: CLUT, ink, paper), and the screen
   addresses of the pixel's byte and of the attribute byte.
   - Addresses exist only where the mode has a fixed Spectrum memory layout:
     standard ULA and ULAplus (bitmap from 16384, attributes from 22528),
     multicolor 8x1 (Timex hi-colour: attributes in the second screen area,
     same layout as the bitmap), GigaScreen (screen A and B), Timex hi-res
     (the two bitmaps). Elsewhere show no address. Take every formula from a
     published source and tag it [P] in the code comment; consult Opus on
     the plan.
2. Preferences: what the readout shows (position only / plus attribute /
   plus addresses), and the Y direction: screen (0 at top) or BASIC PLOT
   (0 at the bottom, 0 to 175, only over the top 176 rows of a 256x192
   screen; outside that, no PLOT value).
3. Custom grid: X step and Y step (1 to the screen size, set independently)
   and an on/off toggle, drawn by `GridOverlay` as a fourth grid. View menu
   item; settings in Preferences or a small dialog (follow how existing grid
   settings are reached).
4. Grid colours: Preferences colour pickers for the pixel, cell, block and
   custom grids, defaulting to the theme's colours, with a reset button.
5. i18n in 13 locales; manual (Preferences and View sections) and
   translations; Playwright spec for the readout and the custom grid.

Tests: address formulas for corner and middle pixels against values
computed by hand in the test (show the working); PLOT Y mapping and its
range; custom grid line positions; grid colour preference round-trip.

Done when: the readout shows attribute and addresses where they exist, Y can
read as PLOT coordinates, the custom grid draws at any step, and grid colours
can be changed and reset.

## After 3B

Batch 3 is done. Update the comparison doc rows listed at the top. In Part 3
of the doc, note that PLOT coordinates and grid colours were done here, not
in Batch 12. Hand off to Batch 4 part 4A.
