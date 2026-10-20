# Feature: gradient polygon styles, Rotation and Zoom (owner decision 2026-10-19)

ZX Paintbrush's gradient styles are linear, radial, circular, triangular, rectangular,
pentagonal, hexagonal and octagonal, with rotation, repeats and (for the edge-based ones)
zoom. PixULA's Gradient tool had linear, radial, reflected, diamond, square, conical and
spiral, with repeats, curve, bias, steps and shape fills, but no triangle, pentagon, hexagon
or octagon, no rotation and no zoom. Owner decision 2026-10-19: build the four shapes AND
Rotation and Zoom.

## What ZX Paintbrush's help says (.reference/zx-paintbrush-help/custom_gradient.txt)

"Adjust rotation either with the spin edit box or with the track bar. Adjust the repeatings
with the spin edit box. Figures that are edge-based (triangle, square etc.) can also have a
zoom level which can either be adjusted with the spin edit box or the track bar."

That is all it says: rotation for the styles, a zoom level only for the edge-based ones, and
nothing on what zoom does or its range. So Zoom here scales the band spacing about the start
point, and is offered for the edge-based styles only, as the help says; the comparison row
says so.

## Data shape (js/tools/gradient-tool.js)

- gradientType gains 'triangle', 'pentagon', 'hexagon', 'octagon' (labels reuse the existing
  keys common.triangle, shape.pentagon, shape.hexagon, shape.octagon), listed after Square.
- EDGE_STYLES = square, diamond, triangle, pentagon, hexagon, octagon: the styles whose bands
  have edges. Rotation and Zoom rows show only for these (showIf gradientType in EDGE_STYLES).
- Polygon bands: a regular n-gon around the start point. At Rotation 0 one side lies flat at
  the bottom (triangle and pentagon point up, hexagon and octagon have flat tops too, as a
  stop sign). Position = max over the n side normals of (offset . normal) / (r cos(pi/n)),
  where r is the drag length: the drag reaches the band's corners, so the gradient is
  complete at the drag distance in every direction, like Radial and Diamond (and like the
  Shape tool, whose polygons put a corner on the drag point). Square keeps its own formula
  (drag = half its side) and Diamond its own (drag = corner), so both draw exactly as before
  at Rotation 0, Zoom 100.
- gradientRotation: degrees, -180..180, step 1, 0 = as before; positive turns clockwise on
  screen, as the Shape tool's Rotation (same range, same key opt.rotation). The pixel offset
  is turned back by the angle before the band formula, with exact sines and cosines at quarter
  turns so a square at 90 degrees is the square at 0, pixel for pixel. A typed or stored value
  outside the range wraps (270 -> -90) as ShapeGenerator.rotationDeg does.
- Rotation and the drag-led styles: Linear, Reflected, Conical and Spiral already take their
  direction from the drag, and Shift snaps it to 15 degrees, so their drag IS their rotation;
  adding a second angle would turn the bands away from the line just dragged. Decision:
  Rotation does not apply to them and is hidden there. Radial is round and needs none.
- gradientZoom: percent, 25..400, step 5, default 100. The band reach becomes
  r x zoom / 100, so 200 doubles the band spacing about the start point and 50 halves it.
  With Repeats, Zoom changes how wide each repeat is. A value outside the range is held to
  it (Helpers clamp); a non-number is 100.
- Both are plain schema options, so presets save and restore them. A preset saved before
  they existed has no value for them, and PresetService.applyToolOptions skips a missing key,
  so it leaves Rotation and Zoom where they are - the same as for every option added after a
  preset was saved (Curve, Bias and the rest).

Figures (docs/FIGURES.md rows):
- Rotation -180..180 [C: one full turn, 360 degrees, centred on 0; the Shape tool's range].
- Zoom max 400 % [C: the Coarse grain is a 2 x 2 matrix, 4 levels; past 4x zoom the whole
  dragged size falls inside the ramp's first quarter, one level of the Coarse grain, so a
  larger zoom shows nothing new with it]. Zoom min 25 % [C: 1 / 4, the reciprocal, so the
  slider zooms out as far as in]. The same 0.25..4 span as the Curve slider. Owner may move
  either; nothing else rests on them.

## Screen modes

The styles, Rotation and Zoom change only the position math that decides which pixels get
ink; the drawing still goes through PixelDrawRoutine.draw with resolveUserMode, exactly as
the seven existing styles do. So they behave as the existing styles in every mode:
Standard ULA, GigaScreen (the active screen), ULAplus, ULANext, Timex hi-res and its pair,
multicolour 8x1 / 8x2 / 8x4, Layer 2 256 / 320 / 640 and LoRes / Radastan. Nothing to hide
or refuse. Bands are regular in picture pixels, like Radial and Square today.

## Tests (written first, seen failing)

- tests/gradient-shapes.test.js (Node): the four types accepted, listed after Square; the
  Rotation / Zoom rows exist with their ranges and show for exactly EDGE_STYLES; setters
  clamp / wrap / reject non-numbers; each polygon's band is n-fold symmetric (a 360/n turn
  of any offset gives the same position) and not symmetric under a half-step turn; a corner
  at the drag distance reads 1, the centre 0; triangle points up (top reaches 1 at r, bottom
  at r/2); Rotation theta equals the unrotated value at the offset turned back; square at 90
  is pixel-identical to 0; Rotation and Zoom change nothing for linear, reflected, radial,
  conical, spiral; Zoom 200 at 2p equals Zoom 100 at p; square and diamond at defaults equal
  the old formulas; a committed hexagon draws ink with uniform cell attributes; repeats and
  mirror add bands; steps quantise to the step count; bias adds ink; a Dither method and
  Dithered off both draw; shape fill (flood) and fillShape circle keep the ink inside.
- tests/browser/gradient-shapes.spec.js: the Type list shows the four new names; Rotation
  and Zoom are hidden for Linear and Radial, shown for Hexagon and Square; a mouse-drawn
  hexagon with Dithered off is point-symmetric about its start; turning a hexagon by 30
  changes the picture, turning a triangle by 120 does not; Zoom 200 widens the bands; a
  preset round-trips Rotation and Zoom; an octagon at Rotation 20, Zoom 150 draws in every
  screen mode; the Polish labels show (Powiekszenie, the only new text).

## Docs

- i18n: opt.gradientZoom in en + 12 locales (the only new text; the style names and
  Rotation reuse existing keys).
- tools/build-manual.js regenerates the tool tables. The tables cannot say what Zoom does or
  how the polygons sit, so 50-tools.md gets one paragraph, "Gradient styles, Rotation and
  Zoom", in English and the 12 translations (no tables or pictures added).
- docs/FIGURES.md rows; docs/TOOL_OPTIONS_TREES.txt gradient block.
- docs/ZX_PAINTBRUSH_COMPARISON.md: Gradient fills and custom gradient -> Same; totals with
  count-verdicts.js; Part 3 item 13 strikes the gradients.
- .claude/parity/LOG.md entry.
