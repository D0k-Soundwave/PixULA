# Batch 2 - Attribute and dot commands on a selection or the whole screen

Group A, branch `parity-a`. Parts: 2A, 2B, 2C (one session each).
Read `RUNBOOK.md` first. Figures from the ZX Paintbrush help are
[P, ZX Paintbrush 2.6.4 help, read 2026-10-08].

Comparison doc rows: Invert attributes of selection; Erase attributes of
selection; Flip attributes horizontally; Flip attributes vertically; Change
attributes dialog; Flip pixels horizontally / vertically; Roll or scroll
pixels only; Roll or scroll colours only; Roll or scroll both. Also the
"Pixels and attributes inverter" row: 2B adds the selection command and sets
that row to Partial; Batch 4 adds the click-a-cell tool that completes it.

Help pages: `edit_attributes_bar`, `invert_attributes_of_selection`,
`erase_attributes_of_selection`, `flip_attributes_of_selection_horizontally`,
`flip_attributes_of_selection_vertically`, `change_attributes_dialog`,
`edit_pixels_bar`, `flip_pixels_of_selection_horizontally`,
`flip_pixels_of_selection_vertically`, `rolling_bar`,
`rollingscrolling_tool_bar`, `pixels_and_attribute_inverter_`.

## What ZX Paintbrush does

Each command acts on the selection, or on the whole screen when there is no
selection, or only on the overlay (our floating stamp) when one exists. Each
is one undo step.

- Invert attributes: swap INK and PAPER of every cell.
- Erase attributes: set every cell to the current colours.
- Flip attributes H / V: mirror the colour grid; the dots stay put.
- Flip pixels H / V: mirror the dots; the colours stay put.
- Roll (wrap round) or scroll (the edge is lost), in 8 directions, repeating
  while the button is held. Pixels only: 1 dot per step. Colours only: one
  cell per step. Both: dots and colours together, one cell per step.
- Pixels and attributes inverter: invert the dots AND swap ink/paper, so the
  picture looks the same. It tidies imported pictures, where solid areas
  arrive as inverted cells.
- Change attributes dialog: find and replace. Source INK, PAPER, BRIGHT,
  FLASH, each a value or "any"; target, each a value or "keep". OK applies.

## What PixULA has today

- `js/services/transform-service.js`: `_getWorkArea()` (selection or whole
  screen), `flipHorizontal`, `flipVertical` (dots and colours together),
  `invert()` (dots only), `shift(direction, amount, wrap)` (4 directions,
  dots and colours together), `_copyToBufferWithAttrs`,
  `_applyBufferWithAttrs`, `_copyToBuffer`, `_copySlots` (GigaScreen).
- `js/ui/components/transform-panel.js`: Flip H/V, Invert, Outline buttons;
  the Shift pad (1 pixel or 1 cell, wrap on or off, held = repeats, one undo
  action per hold). With a floating stamp it calls
  `SelectionService.transformStamp(type, ...)` instead.
- `js/ui/menu-system.js`: Image menu (Flip, Rotate, Invert Colors...) and its
  `image:*` actions.
- Draw modes for the write gate (`DRAW_MODE` in `js/core/constants.js`):
  `PIXEL_ONLY` sets a dot and leaves the colours; `ERASE` clears a dot and
  leaves the colours; `ATTRIBUTES_ONLY` writes a cell's colours and leaves
  the dots. Call `PixelDrawRoutine.draw(x, y, sel, mode, { layer, mirror: false })`.
- `LayerManager.attrsAsSeen(layer, cellX, cellY, plane)`: what a cell shows
  (use it, not the raw cell, so empty upper-layer cells read correctly).
  `InputHandler._applyAttrPaintAtPoint` (the Swap cell op) shows how.
- Fill attributes only (`js/tools/fill-tool.js`) replaces one connected area.

## Rules for every part

- Attribute commands act on whole cells: every cell the selection touches
  (round the area outwards to cell edges, as Recolour does).
- Dot commands act on the exact selected area.
- Floating stamp present: act on the stamp, the way the Transform panel's
  Flip does (`SelectionService.transformStamp`). If the stamp kind cannot
  carry the command (a pixels-only stamp has no colours to flip), disable it
  with a hint. If this needs real work inside `transformStamp`, consult Opus.
- Every command is one undo step (`PixelDrawRoutine.beginBatch/endBatch`).

Mode rules:
| Mode | Attribute commands | Dot commands |
|---|---|---|
| standard_ula, multicolor_* | yes; cells are CELL_WIDTH x CELL_HEIGHT (8x8, 8x4, 8x2, 8x1) | yes |
| gigascreen, multigiga_* | yes, on both screens' colours | yes, on both screens' dots |
| ula_plus, ula_plus_8x1 | yes; ink and paper swap inside the cell's CLUT (bright and flash bits = CLUT, untouched by Invert) | yes |
| ulanext | Invert only where the cell's ink and paper both fit the other field; consult Opus | yes |
| timex_hires, timex_hires_giga | no: disabled, hint says the mode has no cell colours | yes |
| layer2_*, lores* | no: disabled, same hint | Flip and Shift move whole pixels (the same as today's Flip and Shift) |

## Decisions

Defaults (change only if the owner or Opus says otherwise):
- Where: a new **Image > Attributes** submenu (Invert, Erase, Flip
  horizontally, Flip vertically, Change...) and **Image > Dots** submenu
  (Flip horizontally, Flip vertically, Invert dots and colours). The
  Transform panel's Shift section gains a "Move: Dots and colours / Dots only
  / Colours only" choice and diagonal directions.
- Invert and Erase of attributes keep the dots. Erase uses the rail's current
  colours and honours the four "use existing" boxes (a kept part is left as
  each cell has it).

Decided during the 2A plan review (2026-10-08, Opus), no owner question needed:
- ULAnext Invert: swap ink and paper (0-7) and keep bright and flash, which
  pick the paper bank. Same code as standard and ULAplus; running it twice
  gives the picture back. Rejected: skipping cells with bright or flash set.
- Floating stamp (2A): the four attribute commands are greyed out with the
  reason "Finish or cancel the stamp first." instead of acting on the stamp.
  Acting on the stamp needs new transformStamp code plus undo work (its own
  part). Owner cost: one extra step while a stamp is out. Revisit in 2B or
  later if the owner wants it sooner.
- Selections: attribute commands use the bounding rectangle, as Flip does
  today, not the lasso or wand mask. Owner cost: a lasso over part of a cell
  still changes every cell it touches (the same as Flip today).

OWNER: none known.

## Part 2A - attribute commands

Build:
1. `TransformService.invertAttributes()`: swap ink and paper of each cell
   in the work area, using what the cell shows. GigaScreen: both screens.
2. `TransformService.eraseAttributes()`: write the rail colours
   (`ColorManager.getCurrentSelection()`) to each cell with
   `DRAW_MODE.ATTRIBUTES_ONLY`, so the use-existing boxes are honoured by
   the existing gate.
3. `TransformService.flipAttributesHorizontal()` / `...Vertical()`: read the
   work area's cell colours into a grid, mirror the grid, write it back with
   `ATTRIBUTES_ONLY`.
4. Image > Attributes submenu with Invert, Erase, Flip horizontally, Flip
   vertically (Change... arrives in 2C). Disabled where the mode has no cell
   attributes, with a hint.
5. i18n keys in all 13 locales; manual (chapter `70-menus.md` is generated
   from the menus; add a short paragraph to `40-colour.md` and its 12
   translations about the new commands).

Tests (Node, fail first): each command on a selection and on the whole
screen; the dots unchanged; standard, 8x1 multicolor (cell height 1),
GigaScreen (both screens), ULAplus (CLUT untouched by Invert); an empty
upper-layer cell inverts what it shows; Erase with Bright on "use existing"
keeps each cell's bright; one undo restores everything; Timex hi-res and
Layer 2 report the commands unavailable.

Done when: the four commands work from the menu in every mode with cell
attributes, are unavailable with a reason elsewhere, and each undoes in one
step.

## Part 2B - dot commands and the Shift pad

Build:
1. `TransformService.flipDotsHorizontal()` / `...Vertical()`: mirror the
   dots only; colours stay with their cells. Write set dots with
   `DRAW_MODE.PIXEL_ONLY` and cleared dots with `DRAW_MODE.ERASE`.
   GigaScreen: both screens' dots (`_copySlots`). Indexed modes: same as
   today's Flip.
2. `TransformService.invertDotsAndColours()`: invert the dots and swap
   ink/paper of each whole cell touched, so the picture looks unchanged.
   Acts on whole cells only (round the area out). Not in indexed modes or
   Timex hi-res.
3. Shift content choice: `shift(direction, amount, wrap, content)` with
   `content` = `'both'` (today), `'dots'` (1 dot per step, colours stay) or
   `'colours'` (1 cell per step, dots stay). Keep the existing signature
   working (content defaults to `'both'`).
4. Diagonal directions: `'upLeft'`, `'upRight'`, `'downLeft'`, `'downRight'`.
5. Transform panel: a "Move" select (Dots and colours / Dots only / Colours
   only) beside the step select. A 3x3 direction pad with the four diagonals
   (centre empty). Held buttons repeat as the existing pad does, one undo
   action per hold. "Colours only" forces the step to one cell and disables
   the step select while chosen. Hide "Dots only" and "Colours only" where
   the mode has no cell attributes.
6. Image > Dots submenu: Flip horizontally, Flip vertically, Invert dots and
   colours.
7. i18n in 13 locales; manual paragraph in `70-menus.md`'s prose part if it
   has one, else `40-colour.md`, and translations; Playwright spec for the
   pad.

Tests: flips keep every cell's colours; invertDotsAndColours leaves the
rendered picture identical (compare composed RGB before and after) and
inverting twice restores the cells; `content` modes on wrap and no-wrap;
diagonals equal one horizontal step plus one vertical step; GigaScreen both
screens; the held pad makes one undo entry.

Done when: dots-only flips, the inverter and the three shift contents work in
8 directions, from the panel and menu, in every mode the table allows.

## Part 2C - Change Attributes dialog

Build:
1. Pure function first (testable without DOM), e.g.
   `TransformService.changeAttributes(find, replace)`:
   `find` = `{ ink, paper, bright, flash }`, each a value or `null` for any;
   `replace` = the same shape, each a value or `null` for keep. Every cell in
   the work area whose shown colours match `find` gets `replace` written,
   kept parts untouched. One undo step. Returns the number of cells changed.
2. Dialog in `js/ui/components/` (copy the structure of an existing small
   dialog such as `tape-block-dialog.js`, built on `dialog.js`): a "Find"
   row and a "Replace with" row, each with Ink and Paper swatch pickers
   (plus "any" / "keep"), Bright and Flash each on / off / any (keep).
   Shows "N cells will change" live; OK applies, Cancel closes. Scope line
   says "Selection", "Whole picture" or "Stamp".
3. Mode handling: GigaScreen offers Screen A and Screen B rows (or one row
   that applies to both - consult Opus during plan review); ULAplus shows
   CLUT (any, 0-3) instead of Bright/Flash; ULANext limits ink and paper to
   its ranges; no dialog where the mode has no cell attributes.
4. Image > Attributes > Change... opens it.
5. i18n in 13 locales; manual paragraph and translations; Playwright spec.

Tests: any/keep combinations; count returned matches cells changed; nothing
changes on Cancel; one undo restores; ULAplus CLUT matching.

Done when: the dialog finds and replaces any combination over the selection,
the whole picture or the stamp, in every mode with cell attributes.

## After 2C

Batch 2 is done. Update the comparison doc rows listed at the top, then hand
off to Batch 3 part 3A (same branch).
