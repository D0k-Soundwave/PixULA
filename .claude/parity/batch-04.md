# Batch 4 - Painting options

Group A, branch `parity-a`. Parts: 4A, 4B (one session each). After 4B comes
the group A check-off (Opus).
Read `RUNBOOK.md` first. Figures from the ZX Paintbrush help are
[P, ZX Paintbrush 2.6.4 help, read 2026-10-08].

Comparison doc rows: Inverse mode; Colour attribute line thickness (option);
Copy attribute tool; Wiping tool; Pixels inverter tool; Pixels and attributes
inverter (completes what Batch 2 started).

Help pages: `inverse_mode`, `options_dialog` ("Drawing lines options"),
`copy_attribute_tool`, `wiping_tool`, `pixels_inverter_tool`,
`attributes_inverter_tool`, `pixels_and_attribute_inverter_`,
`inverter_tools_bar`, `drawing_mode_bar`.

## What ZX Paintbrush does

- Inverse mode: like BASIC's INVERSE 1. Tools reset dots instead of setting
  them; text is drawn reversed; solid fills are reversed.
- Colour attribute line thickness: "equal to the line" (normal), "always 1
  pixel" or "always 4 pixels". With 1 or 4, a thick line sets all its dots
  but only the cells under its 1- or 4-pixel-wide core take the colours, so
  thick lines clash less.
- Copy attribute tool: the first point picks up a cell's attribute; dragging
  then paints it onto other cells. The colour controls are restored after.
- Wiping tool: wipes dots away and sets the cells to the current colours;
  parts on "transparent" (our "use existing") are kept.
- Pixels inverter tool: inverts the dots of each 8x8 square clicked.
- Pixels and attributes inverter tool: inverts the dots and swaps ink and
  paper of each cell clicked, so it looks the same (for tidying imports).
- (Attributes inverter tool = PixULA's Swap cell op, already there.)

## What PixULA has today

- Button-to-mode mapping: `PixelDrawRoutine.resolveUserMode(isInk)` in
  `js/core/pixel-draw-routine.js` (left = `NORMAL`, right = `NORMAL_ERASE`
  in Normal; see `DRAW_MODE` in `js/core/constants.js`).
- Strokes: `BrushEngine.applyBrush` in `js/tools/brush-engine.js` stamps the
  brush footprint per step; shapes draw outlines in `js/tools/shape-tool.js`
  and `js/tools/shape-generator.js`; Bezier in `js/tools/bezier-tool.js`.
- Cell operations: Swap and Recolour are attribute paint modes owned by
  `InputHandler` (`enterAttrPaintMode(mode)`, `exitAttrPaintMode()`,
  `_applyAttrPaintAtPoint(point)` in `js/core/input-handler.js`). Their
  buttons are built in `js/ui/components/clut-bar.js` (`mkToolBtn`,
  `toggleAttrMode`) and the strip status in
  `js/ui/components/draw-mode-bar.js` (`ATTR_OPS`).
- Eraser: `js/tools/eraser-tool.js` uses `ERASE_ALL` (clears dots, keeps
  colours; a later pass over an empty cell resets it).
- Eyedropper: `js/tools/eyedropper-tool.js` (sets the rail colours).
- Batch 2 added `TransformService.invertDotsAndColours()` (selection).

## Decisions

Defaults:
- Inverse flips the two buttons for every tool that goes through
  `resolveUserMode` (left clears dots, right sets them). Text and stamps
  place their letters/dots as cleared dots (on set dots where the box
  already has ink - consult Opus on how the text tool's mask reaches the
  gate). Filled shapes and the Fill tool clear instead of set.
- Colour core is a tool option ("Colour core: whole line / 1 pixel /
  4 pixels") on the tools with a size or thickness: Brush (all brush
  types that draw a solid footprint), Shape outlines, Bezier. Stored in tool
  presets like other options. Default "whole line" (today's behaviour).
- Copy colours, Invert dots and Invert dots and colours become three more
  attribute paint modes (`'copy'`, `'invertDots'`, `'invertBoth'`), like
  Swap and Recolour.
- Wiping tool = an Eraser option "Colours: keep / set to current". "Set"
  uses `DRAW_MODE.NORMAL_ERASE` (clear the dot, stamp the rail colours, the
  use-existing boxes honoured by the gate).

OWNER - ask in 4A, before building the controls (one question each, in
this order):
1. Where the Inverse switch goes. Option 1 (recommended): a toggle button in
   the top strip's drawing-modes group. Option 2: a View/Image menu item
   with a shortcut only. Before asking, measure the strip's icon size at
   800, 1024 and 1200 px window widths with and without the extra button
   (the ColorBarFit tests show how) and tell the owner the shrink in pixels.
2. Where the three new cell ops go. Option 1 (recommended): three more
   buttons beside Swap and Recolour (measure as above, all four buttons
   together). Option 2: one "More cell tools" button that opens a small
   menu of the three. Record both answers below.

OWNER answers (asked in the one-run series, 2026-10-09, measurements [M, 2026-10-09, Playwright at
800 / 1024 / 1200 px window width, default interface size, icon width in px]):
1. Inverse switch: a button in the top strip's drawing-modes group (option 1). Strip icons today
   30.8 / 48.3 / 54 px; with the button 28.3 / 44.5 / 54.
2. Cell tools: three more buttons beside Swap and Recolour (option 1). With Inverse already added the
   icons go 28.3 / 44.5 / 54 -> 22.7 / 36.0 / 46.2 px (5.6 / 8.5 / 7.8 px smaller). The owner chose this
   knowing the cost; the alternative was one "More cell tools" menu button.

## Part 4A - Inverse switch and Colour core

Build:
1. Inverse state (`StateManager`, remembered per browser like the draw mode;
   saved in workspace presets if the draw mode is). Shortcut: find a free
   key (ZX Paintbrush has none listed; check `COLOUR_SHORTCUTS` and the
   tool keys).
2. `resolveUserMode`: with Inverse on, swap the left and right meanings.
   Then check every tool that sets dots without going through
   `resolveUserMode` (grep `DRAW_MODE.NORMAL` in `js/tools` and
   `js/services`) and route it, or give it the same flip.
3. Status: the strip status line says "Inverse is on" while on (follow
   `ATTR_OPS` / `describeModes`), so a stroke that clears is never a
   surprise.
4. Colour core option: in `BrushEngine.applyBrush`, for each stamp step,
   draw the full footprint as dots only (`PIXEL_ONLY`, or `ERASE` when the
   stroke clears) and the core footprint (1 px, or a 4 px disc) with the
   stroke's normal mode, so only the core's cells take colours. The same
   for shape outlines and Bezier strokes at thickness > 1. Mirror, XOR and
   Every Pass must still behave (XOR writes no colours anyway). Mandatory
   Opus consult: this changes the drawing path.
5. Controls per the OWNER answers; i18n in 13 locales; manual (draw modes
   and tool options) and translations; Playwright spec.

Mode handling: Inverse works in every mode (indexed modes: left draws the
paper index, right the ink index - follow how the right button already
behaves there). Colour core only where the mode has cell attributes; hidden
elsewhere.

Tests: Inverse flips each button for brush, line, shape outline, filled
shape, fill, text and stamp; a thick line with 1-pixel core colours exactly
the cells under its centre line and still sets every dot; 4-pixel core;
"whole line" byte-identical to before (regression); mirror with a core.

Done when: Inverse reverses every tool in every mode, and thick lines can
colour only their core, with nothing changed when the options are off.

## Part 4B - Cell tools and the wiping eraser

Build:
1. `'copy'` mode: press on a cell picks what it shows
   (`LayerManager.attrsAsSeen`); dragging writes those colours to each cell
   passed over (`ATTRIBUTES_ONLY`), without changing the rail. Each drag is
   one undo step. GigaScreen: picks and writes both screens' colours.
2. `'invertDots'` mode: inverts the dots of each whole cell passed over
   (GigaScreen: slot s becomes 3 - s, as `TransformService.invert` does).
   Modes without cells (Timex hi-res): use 8x8 blocks. Indexed modes:
   disabled with a hint.
3. `'invertBoth'` mode: per cell, invert dots and swap ink/paper (reuse the
   Batch 2 per-cell logic; do not copy it). Not in Timex hi-res or indexed
   modes.
4. Buttons or menu per the OWNER answer, with hints and the strip status
   ("Copy colours is on", ...).
5. Eraser option "Colours: keep / set to current" (`NORMAL_ERASE` when set).
   Indexed modes: hidden (the eraser already writes the paper index).
6. i18n in 13 locales; manual (cell tools and eraser) and translations;
   Playwright spec.

Tests: copy picks once and paints many cells, rail unchanged; invertDots
twice restores; invertBoth leaves the composed picture identical; eraser
"set" clears dots and stamps colours, honours Bright on "use existing";
each drag is one undo step; GigaScreen both screens.

Done when: all three cell tools and the wiping eraser work in every mode the
rules allow, and the comparison rows for the inverter tools, copy attribute
and wiping tool read Same.

## After 4B

Batch 4 and group A are done. Update the comparison doc rows listed at the
top. Hand off to the group A check-off (Opus): CHECKOFF.md, branch
`parity-a`.
