# Feature: elliptic, rotatable Ring (decided 2026-10-19, no owner question)

ZX Paintbrush's ring tool (.reference/zx-paintbrush-help/ring_tool.txt): "Draw 2 diagonal
points and you get a circle/ellipse. Draw one more point and you will get an elliptic ring.
Rings can be rotated!" PixULA's ring was always circular (radius = drag distance from the
start point) and had no Rotation. Decision: the ring gets a width and a height, dragged
exactly like PixULA's Ellipse, plus the Shape tool's Rotation; Inner radius (10 to 90
percent of the outer) stays and applies to both radii.

## How the Ellipse is dragged today (what the ring copies)

- Centre-anchored: the press is the centre, the drag point sets the half-width |dx| and the
  half-height |dy| (ShapeGenerator.isCenterAnchored / centerAnchoredBounds, used by both
  ShapeTool and the editable ShapeFigure).
- Modifier keys: the only ones a Shape drag has are the X / Y axis lock (hold X: the drag
  keeps its y, hold Y: its x) and Snap. PixULA's Ellipse has NO key that forces a circle;
  the ring gets exactly what the Ellipse has, so it has none either (see "For the owner").
- Rotation: -180..180 degrees, clockwise, round the centre (the press point). Keep editable
  shows the centre handle and the drag-point handle turned round the centre, and the turn knob.

## Data shape

- js/tools/shape-generator.js
  - isCenterAnchored gains 'ring'. The ring's bounds become the box round the centre, so the
    generator reads centerX / centerY / radiusX / radiusY like the ellipse.
  - New static SELF_ROTATING = {'ring'}: shapes whose own generator applies options.rotation
    (the ring has two outlines and an annulus fill, which the box-shape path - rotate one
    sampled outline and fill it - cannot make). rotationPivot returns the box centre for them,
    so the editor offers the turn knob and turns the handles as for the ellipse.
  - _ringGeometry(bounds, options): cx, cy, rx, ry, irx = rx x innerRatio, iry = ry x
    innerRatio, deg. When rx === ry the ring is a circle and the rotation is ignored (turning
    a circle changes nothing; this also keeps a turned circular ring pixel-identical).
  - _generateRing: the old parametric trace (steps = max(60, round(4 x larger radius)),
    Bresenham between rounded samples, outer then inner) with rx / ry in place of the one
    radius; samples turned by deg round the centre (exact quarter turns via _rotateXY,
    _snap rounding) when deg is not 0. With rx === ry every expression is the old one, so
    the output is the old output.
  - _fillRing: rx === ry keeps the old row-span fill unchanged. Otherwise every pixel of the
    turned ring's bounding box is tested in the ring's own frame (inside the outer ellipse,
    not strictly inside the inner one), and the 1-pixel outline is added, so a ring thinner
    than a pixel somewhere stays joined (the same reason _fillMoon keeps its body joined).
    A flat ring (rx or ry 0) is its outline.
  - ICON_POSE ring: a new 'disc' pose (box c-r..c+r round the icon centre) so the button
    picture stays exactly what it was.
- js/tools/shape-tool.js: ROTATABLE_SHAPES gains 'ring' (the Rotation row shows for it).
- js/tools/figure-model.js: no change needed - ShapeFigure already treats centre-anchored
  shapes (ellipse) by turning the drag point round the start, and asks rotationPivot.
- No new user-facing text: the Rotation row and Inner radius reuse opt.rotation and
  opt.ringInner. The manual's Rotation sentence (50-tools.md x13) adds the ring.

## Figures

- No new limit. steps = max(60, round(4 x r)) is the old sample count [C: existing code];
  the ring now uses the larger of its two radii, so the long side is sampled at least as
  densely as a circle of that radius was. Inner radius 10..90 % step 5 unchanged.

## Screen modes

The ring still returns a pixel list that ShapeTool draws through PixelDrawRoutine.draw with
resolveUserMode (and strokeTargets for Mirror and the guide), so nothing is mode-specific:
Standard ULA, GigaScreen (active screen), ULAplus, ULANext, Timex hi-res and its pair,
multicolour 8x1 / 8x2 / 8x4, Layer 2 and LoRes behave as for the Ellipse. The fill clips to
ZX_SPECTRUM.WIDTH / HEIGHT, which follow the active mode. Nothing to hide or refuse.
Rings are elliptic in picture pixels (as the Ellipse is), not corrected for a mode's pixel
aspect.

## Tests (written first, seen failing)

- tests/elliptic-ring.test.js (Node):
  - PIN, written from the code BEFORE the change: 234 circular rings (13 radii x 5 inner
    ratios x outline / thick outline / filled, the four dash styles and Clear, and rings
    clipped at the picture edges) as FNV hashes of the pixel set. After the change the same
    ring drawn with equal width and height (drag from (cx, cy) to (cx + r, cy + r)) must give
    the same hash, also at Rotation 37.
  - the icon raster of the ring is unchanged (pinned too).
  - isCenterAnchored('ring'); a 40 x 20 drag gives a ring 81 wide and 41 high; the inner hole
    is 0.5 of each radius; filled covers the band and leaves the hole; Rotation 90 swaps
    width and height; Rotation 30 differs from 0 and keeps the centre; rotationPivot is the
    centre; dashed / clear work on an elliptic ring; thickness thickens it; a flat drag (dy 0)
    gives a line and does not throw; ShapeTool._getShapePixels uses the centre-anchored box;
    ROTATABLE_SHAPES has the ring; ShapeFigure: rasterise equals the one-drag pixels, the
    drag handle is turned round the centre, moving it back reproduces the ring.
- tests/browser/elliptic-ring.spec.js: Rotation row visible for Ring; a mouse-drawn ring is
  wider than high; a turned one is higher than wide; Mirror makes a mirrored copy; XOR draws;
  Keep editable leaves it pending and Enter draws it; it draws in every screen mode.

## Docs

- tools/build-manual.js (the Rotation row now lists the ring in the tool tables).
- 50-tools.md x13: the Rotation sentence turns the ring with the ellipse (round the middle of
  its box) and says the ring is dragged like the ellipse.
- docs/TOOL_OPTIONS_TREES.txt, docs/ZX_PAINTBRUSH_COMPARISON.md (Ring -> Same, totals by
  count-verdicts.js), .claude/parity/LOG.md.

## For the owner

- There is no circle key for the Ellipse (and so none for the Ring). Before this change a
  circular ring was any drag; now it needs a drag exactly on the diagonal (dx = dy). If a
  circle key is wanted, it should be added for the Ellipse and Ring together (one question).
