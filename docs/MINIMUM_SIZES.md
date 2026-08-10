# Minimum viable size, per tool

Measured 2026-08-05 against the shipped code, and re-measured the same day
after the four generator defects the first pass turned up were fixed.
**Re-verified 2026-08-08** — both measurement tools were re-run against the
current tree and the figures are unchanged (spot-checked: spiral 16x14 / 25x23,
hourglass 3x3, arc-15 23x23 outline and never filled, circle noise floor
0.12 px at r=4). Nothing in the 2026-08-07/08 post-rebuild work touches shape
or brush geometry, which is why they are unchanged; the run was done anyway,
because "unchanged" is a measurement too. The env override for the "big" ceiling is now `PIXULA_BIG`
(was `ZXPS_BIG`).

Every figure is tagged with its provenance (see the register at the end); the figures
that MOVED between the two passes are listed there too, with what they were
before. Nothing here is an estimate dressed up as a measurement.

Reproduce with:

    node tools/measure-min-sizes.js [--detail]     # shapes
    node tools/measure-min-brushes.js              # brushes and the rest

Both drive the real `ShapeGenerator` / `BrushShapes` / `BrushEngine` through
`PixelDrawRoutine`. Neither re-implements any geometry: a measurement taken
against a copy of the maths would only prove the copy.

---

## 1. What "minimum viable size" means here

A tool works "as intended" when its defining feature is still in the pixels.
That gives two different thresholds, and the gap between them is the useful
part of this document:

| | meaning |
|---|---|
| **PRESENT** | The feature exists in the raster, with the right count. Below this the code is provably drawing something else: a heptagon with five corners, a gear with no bore, an arrow whose head overruns its own tail. |
| **READABLE** | The feature is at least 2 px deep, in every drag direction. This is the size to actually use. |

**Why 2 px and not 1.** Every vertex is rounded to the nearest pixel before it
is drawn. Each endpoint can move by up to half a pixel, so any edge between two
of them can shift by up to a whole pixel. A feature 1 px deep can therefore be
swallowed entirely by rounding in some orientations and not others - which is
exactly what the per-direction sweep shows. A 2 px feature cannot be. **[C]**

**Sizes are given as the bounding box in pixels**, with the drag that produces
it in brackets. The box is what you see on screen and is comparable between
shapes; the drag is not, because different shapes read the same gesture
differently (a circle takes it as a box corner, a pentagon as a centre and a
vertex, a star as a centre and half a diagonal).

**The comparison floor is measured, not assumed.** A filled midpoint circle is
the roundest thing this grid can draw, so its own radial wobble is the noise
floor everything else is judged against: 0.12 to 0.94 px across radii 2 to 96
**[M]**. "Distinguishable from a circle" means "deeper than that".

---

## 2. Shapes

Bounding box in px. Bracketed figure is the drag distance.

### Reads inside one 8x8 attribute cell

These are the only shapes that survive at the size of a single colour cell:

| shape | PRESENT | READABLE |
|---|---|---|
| line | 2x2 (1) | 3x3 (3) |
| hourglass | 3x3 (1) | 3x3 (1) |
| bowtie | 3x3 (3) | 3x3 (3) |
| circle | 3x3 (1) | 5x5 (2) |
| cross (x) | 3x3 (1) | 5x5 (2) |
| plus | 3x3 (1) | 5x5 (2) |
| house | 3x3 (2) | 5x5 (4) |
| rectangle / square | 3x3 (3) | 4x4 (4) |
| sector (90 deg) | 4x5 (3) | 4x5 (3) |
| arc (180 / 360 deg) | 3x3 (1) | 6x6 / 7x7 (3) |
| arc (90 deg) | 4x4 (3) | 7x7 (6) |
| parallelogram | 3x3 (3) | 7x7 (7) |
| kite | 8x8 (5) | 8x8 (5) |

### Needs more than one cell

| shape | PRESENT | READABLE | note |
|---|---|---|---|
| ring (50% inner) | 5x5 (2) | 9x9 (4) | |
| moon (30% phase) | 7x7 (3) | 9x9 (4) | any phase from 5% to 95% |
| ellipse | 5x3 (1) | 9x5 (2) | 2:1 box; must differ from a circle |
| triangle | 6x6 (4) | 9x9 (7) | |
| trapezoid | 4x4 (4) | 9x9 (9) | slant is 20% of width, so it needs 8 px of width to reach 2 px |
| arrow | 8x9 (7) | 9x9 (8) | below 7, the head is longer than the arrow |
| arrow-up/down/left/right | 7x9 (4) | 7x9 (4) | |
| star (5 points) | 17x15 (4) | 21x19 (5) | |
| flower (6 petals) | 29x27 (7) | 41x37 (10) | |
| heart | 15x13 (7) | 19x18 (9) | |
| rounded rectangle | 3x3 (3) | 11x11 (11) | corner is a quarter of the smaller side |
| spiral (3 turns) | 16x14 (8) | 25x23 (13) | windings 1 px / 2 px apart |
| gear (8 teeth) | 29x29 (7) | 33x33 (8) | teeth and bore, filled or outlined |
| arc (45 deg) | 11x11 (18) | 11x11 (20) | bow, not box - a shallow arc is a small mark struck from a long radius |
| arc (15 deg) | 23x23 (120) | never | needs radius 234 to bow 2 px: off screen |

### Regular polygons

The corner is the feature, and its depth is `R * (1 - cos(pi/N))` - the sagitta
of one side against the circumscribed circle. That closed form gives the ideal;
the measurement gives what the raster actually resolves once every corner has
been rounded to the grid, in every drag direction.

| polygon | PRESENT | READABLE | ideal bbox for a 2 px corner **[C]** |
|---|---|---|---|
| triangle (3) | 6x6 (4) | 9x9 (7) | 8 |
| diamond (4) | 9x9 (4) | 21x21 (10) | 14 |
| pentagon (5) | 22x22 (11) | 30x30 (15) | 21 |
| hexagon (6) | 29x29 (14) | 45x45 (22) | 30 |
| heptagon (7) | 40x40 (20) | 59x59 (30) | 40 |
| octagon (8) | 47x47 (23) | 67x67 (33) | 53 |
| nonagon (9) | 60x60 (29) | 87x87 (44) | 66 |
| decagon (10) | 71x71 (35) | not resolved | 82 |
| dodecagon (12) | 105x105 (52) | 153x153 (76) | 117 |

Measured minimums run about 1.3x to 2x the ideal, consistently across the
family **[C, from the two measured columns]** - that factor is what rounding
costs you.

Two consequences worth stating plainly:

- **A dodecagon is not a usable shape on this screen.** It needs a 153 px box
  to show twelve corners, which is most of a 256x192 canvas, and even the
  measurement's own count is unstable there. Below that it is a circle with a
  lumpy edge. The same is nearly true of the decagon.
- This is why `ICON_BADGE` prints the side count on the polygon buttons: the
  icon cannot show the difference because at 25 px **no** polygon above five
  sides can. The measurements agree with the decision already in the code.

---

## 3. Brushes

| brush | minimum | what happens below it |
|---|---|---|
| round | **3** for roundness **[M]** | at sizes 1 and 2 the disc and the square are the same pixels (1 px, then a 2x2), so the round/square choice does nothing |
| square | 1 | - |
| eraser | 1 | same disc as the round brush, so the same size-3 note applies |
| crosshatch (spacing 4) | **2** to always mark; **3** for both diagonals **[M]** | at size 2 it marks at some positions on the grid and not others |
| hatch | **spacing-dependent, see below [M]** | the stroke drops out entirely at some positions |
| spray (uniform) | **4** for more than one particle **[M]** | sizes 2-3 deposit 1-2 particles: a pencil with a wobble |
| spray (Poisson) | **2 x minDistance [M]** | a single dot wherever the sampler seeded |
| fade | **fade length >= 4 x stamp spacing [M]** | the stroke jumps from solid to nothing without showing its dither bands |
| pattern | **tile size (8, 16 or 32)** for a whole tile in one dab | a dab shows a fragment; a dragged stroke still tiles correctly at any size |

### These floors are wired into the tool rail

A brush should hand you the brush its button names, not a pencil behaving like
one at whatever size the last brush was left on. Picking the spray, the hatch
or the pattern brush therefore RAISES the size to its floor
(`ToolManager._brushVariants`, pinned by `tests/brush-variants.test.js`):

| rail button | arrives at | because below it |
|---|---|---|
| Spray | **4** | a stamp lays one or two particles: a pencil with a wobble |
| Hatch | **4** | stamps miss the lattice at some positions and the stroke drops out |
| Pattern | **8** | a dab under one tile shows a fragment of the design |

It raises, never lowers - an artist working at 24 px keeps 24 - and nothing is
removed from the slider: every size from 1 up is still there for whoever wants
it.

**Two brushes deliberately have no floor.** The fade keeps size 1, because at
one pixel a fade is still a fade: the dither threshold simply decides that one
pixel. And the base Brush (round and square) keeps size 1, because **size 1 is
the pencil** - the single most-used setting in pixel art, and a documented
invariant of this app. The measurement's "a round brush is only round from
size 3" answers a different question (when the round/square choice starts to
matter), not "is it usable".

### Everything else was already at or above its floor

Audited against the measurements, these defaults needed no change:

| default | value | floor |
|---|---|---|
| eraser size | 1 | 1 - erasing one pixel is the job |
| shape / bezier thickness | 1 | 1 |
| hatch spacing / thickness | 4 / 1 | matches the size-4 floor above |
| spray min spacing | 2 | its own floor is a size (2 x minDistance), now met |
| fade length | 64 | 4 x stamp spacing at the largest brush: exactly right |
| gradient steps / grain | 1 / 8 px | 1 band is a smooth ramp |
| text size | 16 | 8 (the glyph cell) - already 2x it |
| star points / flower petals / gear teeth | 5 / 6 / 8 | all resolve at the sizes in section 2 |
| spiral turns, ring inner, moon phase, arc span | 3, 50%, 30%, 180/90 deg | all viable |

A floor is a floor, not a target: a default already above it is left alone.
Lowering the text default to its 8 px minimum, for instance, would make every
label start out tiny for no gain.

Shapes have no default size at all - the drag defines it - so section 2's
figures are guidance for drawing, not values to set.

### Hatch brush: the size at which it stops dropping out

The lattice is anchored to canvas coordinates, so whether a dab marks anything
depends on where it lands. These are worst-case over every phase **[M]**:

| spacing | round nib: always marks / shows 2 lines | square nib: always marks / shows 2 lines |
|---|---|---|
| 2 | 2 / 4 | 2 / 3 |
| 3 | 2 / 5 | 2 / 4 |
| 4 (default) | **4** / 7 | 3 / 5 |
| 6 | 5 / 9 | 4 / 7 |
| 8 | 7 / 12 | 5 / 9 |
| 12 | 9 / 18 | 7 / 13 |
| 16 | **12** / 24 | 9 / 17 |

So the default hatch (spacing 4, round nib) needs **size 4**, and at the widest
spacing it needs **size 12**. A stroke accumulates, so it only needs the first
column; the second is what makes a single dab read as hatching.

### Spray, Poisson distribution

Smallest brush size that reliably yields more than one point **[M]**:

| minDistance | 1 | 2 | 3 | 4 | 6 | 8 |
|---|---|---|---|---|---|---|
| min size | 3 | 4 | 6 | 8 | 12 | 16 |

That is `2 x minDistance` from 2 upward. Worst of 200 samples from a seeded
generator, so the figure repeats exactly rather than wandering by a size
between runs.

### Fade brush

Stamps land every `max(1, floor(size/2))` px along a stroke, and the shortest
default zone is the stipple tail at 25% of the fade. So the fade length must be
at least four stamp intervals for every band to be sampled whatever the phase.
Measured **[M]**, and it agrees exactly with that reasoning:

| brush size | 1 | 2 | 4 | 8 | 16 | 24 | 32 |
|---|---|---|---|---|---|---|---|
| stamp spacing | 1 | 1 | 2 | 4 | 8 | 12 | 16 |
| min fade length | 8 | 8 | 8 | 16 | 32 | 48 | **64** |

The slider allows 8 to 256, so every case is reachable - but a size-32 brush
with the fade length at its minimum of 8 shows no fade at all. The shipped
default of 64 is exactly right for the largest brush and generous for the rest.

---

## 4. The other tools

| tool | minimum | basis |
|---|---|---|
| shape outline thickness | a hollow square needs side >= `2*floor(t/2)+3` px: t=1 -> 3, t=2 -> 5, t=4 -> 7, t=8 -> 11 **[M]** | thickness dilates inwards too, so the stroke closes over its own interior |
| bezier curve | handle offset **2 px** to bow at all; **t+2 px** to bow clear of its own stroke (t=1 -> 4, t=8 -> 10) **[M]** | the curve passes half way to the handle, so the bow is offset/2 |
| gradient | drag >= `steps` px for 1 px bands; >= `steps x grain` for each band to carry its dither (grain 2/4/8) **[C]** | a 16-step gradient at fine grain needs a 128 px drag |
| gradient region | >= the dither tile (8x8 at fine grain) **[C]** | a smaller region lands on whichever few thresholds it covers and comes out solid or empty |
| text (bitmap fonts) | **8 px** - the glyph cell is 8x8 **[M]** | offered sizes 8/16/24/32/48/64 are integer multiples, so only these stay crisp; 4 and 6 px wide library fonts are still 8 px tall |
| fill, eyedropper | 1 px | no size of their own |
| zoom, pan, move | none | no mark |

### The floor under all of it: the attribute cell

Everything above is about **shape** - whether the raster still says what it is.
**Colour has its own minimum and it is coarser.** In the standard mode the
attribute cell is 8x8 px with two colours **[M, from `ACTIVE_SCREEN_MODE`]**, so
a mark smaller than 8x8 cannot hold a colour of its own: it shares with whatever
else is in that cell. In the multicolour modes the cell height drops to 4, 2 or
1 px, which lowers this floor - and changes none of the shape figures, which are
pure geometry.

---

## 5. What the measurement turned up, and what was done about it

Five things came out of the first pass. Four were real defects in the shape
generator and are now fixed and pinned by `tests/shape-fills.test.js`; the
fifth was my own measuring instrument, and is recorded here because a false
positive that goes unrecorded gets rediscovered.

**1. A rounded rectangle's corner was a 1 px chamfer until an 18 px box.**
FIXED. The radius was `30% of HALF the smaller side, floored at 2`, which
pinned it at exactly 2 for every box below 20 px - and a 2 px circular corner
removes exactly one pixel, so a 17 px "rounded" rectangle was a rectangle with
its corner pixels nicked off. The same expression could also floor ABOVE its own
cap on boxes under 4 px, rounding a corner wider than the box's half. It is now
a quarter of the smaller side, clamped between 1 px and half the side. The
corner arcs are also cut from `_midpointCircle` now, the same rasteriser the
circle tool uses, rather than sampled at a few angles and joined with straight
segments - which is what let a sample round back onto the row above and put ink
outside the corner it was cutting. A rounded corner and a circle of the same
radius are now the same pixels, by construction.
*Readable at 11x11 instead of 18x18.*

**2. A filled gear was a different shape from an outlined one, and had no bore.**
FIXED. The outline built `teeth x 4` vertices (outer, outer, inner, inner - a
cog with square teeth) while the fill path built `teeth x 2` alternating ones
(outer, inner - an eight-pointed star), so ticking Filled changed the shape.
The fill was also a plain scanline of the tooth ring, which has no way to leave
a hole, so a filled gear had no centre bore at any size. Both now read one
`_gearGeometry`, and the fill punches the bore.
*Readable at 33x33 instead of 37x37, and it is a cog either way.*

**3. A filled crescent moon came apart into two or three pieces.**
FIXED. The fill computed per-row spans as `ceil(cx - dx) .. floor(cx + dx)`,
which does two harmful things where the crescent is thinner than a pixel: a row
whose span is under a pixel wide comes out EMPTY, cutting the crescent in half,
and the narrow cutout slot near a horn leaves a speck stranded on the far side
of it. Measured breaks at drag 8, 17 and 41. The fill is now a pixel-centre
test - inside the disc, outside the cutout - and returns its largest connected
group, since a disc minus a disc is one region by definition and anything the
sampling strands is an artefact of the sampling.
*Readable at 9x9 instead of 85x85: the single largest correction in this
document.*

**4. A filled bowtie was a solid rectangle.**
FIXED. The generic fill runs each row from its leftmost to its rightmost ink,
and a bowtie has both of its vertical end edges present on every row, so the
waist filled in. It now has its own vertex ring and goes through the polygon
scanline fill, which sees the two triangles. (The hourglass, whose end edges are
horizontal, was always filling correctly.)

**5. "The flower's petal count never stabilises" was WRONG - my instrument, not
the app.** The flower's raster is correct and always was: sampling it by ray
shows six clean notches about 22% of the radius deep, at exactly the six
expected angles. What was unstable was my peak counter. A petal tip is a
plateau with a pixel of rasterisation ripple on it, and counting raw local
maxima split each tip in two, so a six-petal flower reported eight lobes at some
radii and six at others. The counter now merges maxima by notch depth
(persistence) before counting: a notch shallower than a pixel is not a notch, it
is the grid. Validated against eleven shapes whose counts are known by
construction. *The flower is readable at 41x37; it was previously reported as
never resolving at all.*

One smaller note, also fixed: four fill paths clipped to literal `255`/`191`,
which is the standard screen rather than the active mode, so in a 512x192 Timex
or a 320x256 Layer 2 document every filled shape was clipped to the wrong
rectangle. They now read `ZX_SPECTRUM.WIDTH`/`HEIGHT`, which are live views on
the mode. The scanline fill buffers are sized from the mode at construction, so
they now grow on demand rather than silently dropping pixels when a document is
in a mode larger than the one the app booted in.

Two things deliberately NOT changed:

- The polygon scanline fill runs about 3% fat (26 px on a 794 px gear) against a
  reference even-odd fill, because it records each edge's x one row behind. It
  is within a pixel everywhere, it affects every filled shape equally, and
  correcting it would move every filled raster in the app for no visible gain.
- The arrow's proportions have fixed floors (`headLength = max(6, 0.35L)`), so
  below L=7 the head is longer than the whole arrow and the polygon turns inside
  out. That is a real cliff, but it is confined to arrows shorter than 7 px,
  where an arrow cannot read anyway; the measured minimum of 8x9 already sits
  above it.

---

## 6. Figures register

| figure | value | tag | provenance |
|---|---|---|---|
| Readability threshold | 2 px | **C** | Vertices round to the nearest pixel: +/-0.5 px per endpoint, up to 1 px of edge movement, so a 1 px feature is not survivable and a 2 px one is |
| Presence threshold | 1 px | **C** | One pixel is the grid's own resolution; below it the feature does not exist |
| Circle raster noise floor | 0.12-0.94 px, radii 2-96 | **M** | `tools/measure-min-sizes.js`, radial variation of a filled midpoint circle, 2026-08-05 |
| All shape minimums (section 2) | as tabulated | **M** | `tools/measure-min-sizes.js`, sizes 1-132, 8 drag directions, re-measured 2026-08-05 after the fixes in section 5 |
| Polygon corner depth | `R(1 - cos(pi/N))` | **C** | Sagitta of one side against the circumscribed circle |
| Ideal bbox for a 2 px corner | 8-117 px by N | **C** | `bbox = 2R`, `R = 2 / (1 - cos(pi/N))` |
| Measured/ideal ratio | ~1.3x to 2x | **C** | Ratio of the two measured columns to the closed form, across the polygon family |
| Round brush becomes round | size 3 | **M** | `tools/measure-min-brushes.js`, `BrushShapes.disc` vs `.square`, 2026-08-05 |
| Hatch always-marks sizes | 2-12 by spacing | **M** | Same script; worst case over every lattice phase |
| Crosshatch always-marks | size 2 (3 for both diagonals) | **M** | Same script, driven through `BrushEngine.applyBrush` |
| Spray particles per stamp | `max(1, round(0.25 * size^2 * flow))` | **M** | Read from `SCATTER_DENSITY` in brush-engine.js and confirmed by 200-trial sampling |
| Spray multi-particle size | 4 | **M** | Same script, mean distinct cells over 200 seeded trials |
| Poisson min sizes | 3/4/6/8/12/16 (= 2 x minDistance) | **M** | Same script, worst of 200 seeded samples per size |
| Fade minimum length | 4 x stamp spacing (8..64) | **M** | Same script, worst phase; agrees with the 25% zone reasoning |
| Hollow-shape thickness rule | `side >= 2*floor(t/2)+3` | **M** | Same script, real `generateShape` with thickness |
| Bezier bow offsets | 2 px; t+2 px | **M** | Same script, quadratic against the straight line |
| Gradient band minimums | `steps`, `steps x grain` | **C** | A band cannot be under 1 px; a dither tile is 2, 4 or 8 px, from the tool's own matrices |
| ZX ROM glyph cell | 8x8 px, 96 glyphs | **M** | `js/data/zx-rom-font.js`, 768 bytes |
| Attribute cell | 8x8 px, standard mode | **M** | `ACTIVE_SCREEN_MODE` at measurement time |
| Rounded-rect corner radius | quarter of the smaller side | **C** | Chosen so the bite grows with the box; the previous 15%-floored-at-2 rule produced a 1 px bite on every box below 20 px (see section 5) |
| Measurement window | bbox <= 96 px | **A** | Chosen: half the screen height. Affects only the decagon and dodecagon rows, both of which are also reported from a wider sweep, so no conclusion rests on it |
| Lobe merge threshold | notch >= 1 px (2 px for readable) | **C** | The same rounding argument as the readability threshold: a notch shallower than a pixel cannot be told from the grid |

### Figures that moved, and what they were

The first pass measured a generator with four defects in it. These figures
changed when those were fixed, or when the lobe counter was corrected. The old
values are kept because the point of a register is that corrections stay visible.

| figure | was | now | why it moved |
|---|---|---|---|
| moon, readable | 85x85 (drag 42) | 9x9 (drag 4) | fill no longer breaks the crescent into pieces (finding 3) |
| moon, present | 85x85 (drag 42) | 7x7 (drag 3) | same |
| rounded rectangle, readable | 18x18 | 11x11 | corner radius is now proportional (finding 1) |
| rounded rectangle, present | 4x4 | 3x3 | same |
| gear, readable | 37x37 (drag 9) | 33x33 (drag 8) | filled gear is now the same cog as the outline, with a bore (finding 2) |
| flower, present / readable | never resolved | 29x27 / 41x37 | the shape was always right; the counter was not (finding 5) |
| star, present | 13x12 (drag 3) | 17x15 (drag 4) | corrected lobe counter - the old one credited a ripple-split tip as two points |
| diamond, readable | 17x17 (drag 8) | 21x21 (drag 10) | same |
| Poisson spray minimums | 2/4/6/8/11/15 | 3/4/6/8/12/16 | seeded and taken over 200 samples instead of 40, so the worst case is the real worst case rather than the luckiest of a few |

**The figures that carry weight and are still assumptions:** only the one tagged
**A**, and it is a property of the measuring instrument rather than of the app.
The 96 px window changes nothing that is not separately reported from a wider
sweep.
