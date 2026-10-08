# Batch 7 - Drawing tools

Group B, branch `parity-b`. Parts: 7A, 7B, 7C (one session each). After 7C
comes the group B check-off (Opus).
Read `RUNBOOK.md` first. Figures from the ZX Paintbrush help are
[P, ZX Paintbrush 2.6.4 help, read 2026-10-08].

Comparison doc rows: Freehand and line; Rays; Orthogonal and parallel line
tools; Triangle tools (free three-point); Polygon, centred polygon, N-edge
polygon (free points); Arc and sector (rotatable); Ellipse and centred
circle (rotatable); Rectangle, square, rounded rectangle, parallelogram
(rotatable, adjustable rounding); Line styles; Point mode; Clone last drawn
figure; X and Y keys; Spray pattern tool; Re-colour the last figure (point
mode); Cursor keys move the last figure.

Help pages: `draw_tools_bar`, `freehand_and_line_tool`, `rays_tool`,
`orthogonale_tool`, `parallele_tool`, `triangle_tool`, `polygon_tool`,
`centered_polygon_tool`, `n_edge_polygon_tool`, `arc_tool`, `sector_tool`,
`ellipse_tool`, `rectangle_tool`, `rounded_rectangle_tool`,
`parallelogram_tool`, `line_style_tool_bar`, `point_mode`,
`point_editing_bar`, `moving_objects`, `rotate_points`, `clear_points`,
`changing_drawn_objects`, `clone_last_drawn_figure`,
`special_draw_tools_bar`, `spray_pattern_tool`, `spray_style_tool_bar`,
`hotkeys_and_shortcuts`.

## What ZX Paintbrush does

- Point-based figures: click points (or hold and drag for freehand runs);
  Enter or double-click finishes; Backspace deletes the last point.
  - Freehand and line: straight segments and freehand runs in one figure.
  - Rays: one start point, then many end points, all from the start.
  - Orthogonal line: draw a line, then a control point; a second line runs
    from the first at a right angle through it.
  - Parallel line: a line, then a control point; a parallel line with that
    point at its middle.
  - Free triangle: three points, filled.
  - Polygon: any number of points, filled.
- Box shapes (rectangle, rounded rectangle, ellipse, arc, sector, triangle,
  parallelogram) can be rotated; rounding is adjustable.
- Line styles: solid, dashed, dotted, clear; dashed and dotted only at
  thickness 1.
- Point mode, on the last drawn figure: show its control points; drag one to
  reshape (undo + redraw); move the whole figure; rotate it round its centre;
  clicking a control point re-draws it with the current colours, line and
  fill style.
- Clone last figure: draws it again on top, then the cursor keys move it.
- X key / Y key: drawing only along X or Y.
- Spray pattern tool: sprays little circles, squares or lines along a trace,
  each drawn with the line style and filled with the fill style.

## What PixULA has today

- Shape tool `js/tools/shape-tool.js`: 30+ shapes from a box
  (`shapeType` icons option; groups of lines, boxes, round, polygons,
  symbols, objects), fills, thickness. Rasterisers in
  `js/tools/shape-generator.js` (Node-tested: `tests/shape-rasters.test.js`,
  `tests/shape-fills.test.js`).
- Bezier tool `js/tools/bezier-tool.js`: the model to copy. After the drag
  the curve stays pending with handles; dragging a handle reshapes it; Enter
  (via `EVENTS.INPUT_KEY_DOWN`) or a click away commits it through
  `PixelDrawRoutine`. It appears in the Shape picker as an entry with
  `tool: TOOLS.BEZIER`, and in `TOOL_GROUPS` (`js/core/constants.js`) as
  `variantOf: 'shape'`.
- Tools register in `js/app.js` (`ToolManager.register`).
- Lock axis exists as a gradient option only (`opt.lockAxis`).
- Single-letter tool keys are in `TOOL_GROUPS` (B A F P H E G D S C I M T K
  Z V). Check what bare X does in `js/core/input-handler.js` before using it.
- Spray brush: `js/tools/brush-engine.js` (weighting, Poisson spacing).

## Decisions

Defaults:
- One new tool, **Figure** (`TOOLS.FIGURE`, `variantOf: 'shape'`), for
  every point-based figure, chosen from the Shape picker like Bezier:
  Polyline (freehand and line), Polygon, Triangle (3 points), Rays,
  Orthogonal line, Parallel line. No new rail button.
- A figure stays pending (editable) after it is finished, like a Bezier
  curve, until the next figure starts, another tool is picked, or Enter is
  pressed a second time. "Point mode" is editing the pending figure, which
  avoids ZX Paintbrush's undo-and-redraw. Box shapes become pending figures
  too in 7C, so rotation and point mode work for them. Mandatory Opus
  design consult in 7A on this model.
- Line style option (Solid, Dashed, Dotted, Clear) on Shape, Figure and
  Bezier; dashed and dotted only at thickness 1 (disabled above, with a
  hint). "Clear" draws no outline (fill only).
- Axis lock: hold X or Y while dragging (a tap keeps its current meaning);
  if that cannot be made reliable, Shift-drag locks to the main axis
  instead. Consult Opus in 7C.

OWNER: none known. Ask if Opus advises a new rail button instead of the
Shape picker entries.

## Part 7A - the Figure tool and point-based figures

Build:
1. Figure model (pure, Node-testable): `{ type, points[], closed, options }`
   with `addPoint`, `addFreehandRun`, `removeLastPoint`, `finish`, and a
   rasteriser per type that returns the outline and fill masks (reuse
   `shape-generator.js` line and polygon fill code; do not write a second
   line rasteriser).
2. Types: polyline (open), polygon (closed, filled per the fill option),
   triangle (3 points, closed), rays (start + ends), orthogonal (3 points),
   parallel (3 points).
3. Tool `js/tools/figure-tool.js`: click adds a point; press and drag adds a
   freehand run; double-click or Enter finishes; Backspace removes the last
   point; Escape cancels. Preview through the same path Bezier uses (so
   previews obey the draw mode and clash rules). Commit is one undo step.
4. Shape picker entries, TOOL_GROUPS, registration, icons (follow the
   existing SVG symbol sprite), options (thickness, fill, line style
   arrives in 7B).
5. i18n in 13 locales; manual (`50-tools.md`) and translations; Playwright
   spec (draw each type by mouse; Backspace; Enter).

Tests: each type's mask for known points (hand-computed in the test);
Backspace; freehand runs join straight segments; commit goes through the
gate (draw mode and use-existing honoured); one undo step.

Done when: all six figure types draw, preview and commit correctly, in every
screen mode (indexed modes draw with indices, as shapes do).

## Part 7B - Line styles, rotatable box shapes, rounding

Build:
1. Line style option (Solid, Dashed, Dotted, Clear) in the shared outline
   rasteriser so Shape, Figure and Bezier all get it. Dash and dot lengths:
   take them from ZX Paintbrush's look (help page images) or choose and tag
   [A] with a sentence on why; consult Opus if unsure.
2. Rotation option (degrees, -180 to 180) for box shapes: rectangle,
   square, rounded rectangle, ellipse, circle (no effect), arc, sector,
   triangle, parallelogram, diamond, regular polygons. Rotate the outline
   points before rasterising; filled shapes fill the rotated outline.
3. Rounding option (radius) for the rounded rectangle.
4. i18n, manual and translations, Playwright spec.

Tests: dashed/dotted patterns at thickness 1 and disabled above; rotation
by 0 is byte-identical to today; 90 degrees of a rectangle equals the
rectangle of swapped size; rounding 0 equals a rectangle.

Done when: lines can be dashed, dotted or clear, box shapes rotate, and the
rounding is adjustable.

## Part 7C - Point mode, clone, cursor keys, axis lock, spray pattern

Build:
1. Point mode on the pending figure (Figure tool, and box shapes made
   pending - consult Opus on extending Shape's commit flow): drag a control
   point to reshape; drag inside to move; a rotate handle turns it round its
   centre; "Apply current colours" re-draws it with the rail colours, line
   style and fill. Backspace removes the last point (point figures).
2. Clone last figure: Edit > Clone last figure (and a key, if a free one
   exists) makes a pending copy on top of the last committed figure.
3. Cursor keys move the pending figure by one pixel (Shift: one cell), when
   no selection or stamp is floating (those keep their current key use).
4. Axis lock as decided above, for Brush, Eraser, Figure freehand runs and
   Shape drags.
5. Spray pattern: a new spray style in the Spray brush (circles, squares or
   short lines), each small figure drawn with the line style and filled
   with the fill style; size and density from the spray settings.
6. i18n, manual and translations, Playwright spec.

Tests: reshaping and moving give the same mask as drawing it there fresh;
rotate by 360 is identical; clone + move by (dx, dy) equals drawing at the
offset; axis lock keeps every point on the axis; spray pattern draws only
whole figures inside the spray area.

Done when: the last figure can be edited, moved, rotated, re-coloured and
cloned; the axis can be locked; spray patterns exist; the rows listed at the
top read Same or Partial with the reason.

## After 7C

Batch 7 and group B are done. Update the comparison doc rows. Hand off to
the group B check-off (Opus): CHECKOFF.md, branch `parity-b`.
