# Carry the stamp transform chain in a coverage domain - design

Status: the VECTOR half is implemented - section 4.2 in full, and the
`fromMask`/`toMask` boundary of 4.1 - by
`docs/superpowers/plans/2026-08-29-coverage-rasterisation-vector.md`.

NOT implemented: 4.1's `transform`/`warp`/`flipH`/`flipV`/`shadow`/`outline`/
`toneCorrect`, the 1-bit branch of 4.3, the local-tone rule of 4.4, and the
live budget of section 5. Those are the second plan; pasted artwork, ZX ROM and
library-font stamps still take the nearest-neighbour path described in
section 1.

Two figures in this document were WRONG and are corrected in place, both found
while implementing it: the single 0.50 threshold of section 6 (calibrated
against a reference that already assumed it) and the vector table of section 3
(measured across two different typefaces). Section 7.1 was a blocking objection
and is resolved by the local-tone rule in 4.4. Sections 10.1 and 10.2 are
resolved, and no A-tagged figure remains.

Measured by `tools/text-transform-bench.js` (written for this question, 2026-08-29).
Every figure below carries its provenance tag; the register is section 9.

## 1. Motivation

A text stamp is thresholded to 1 bit and then that BINARY result is resampled
up to five times: `fillText` alpha `> 127`, nearest scale to the target box,
the Direction rotate, the warp, and the rotate slider. Nearest-neighbour on an
already-binary image can only drop or duplicate pixels.

That was the theory the bench set out to test. **The measurement rejected it.**

The loss is at RASTERISATION, not at transformation. With no transform at all -
scale 1, 0 degrees, the shipped rasteriser's output untouched - system-font
text scores **IoU 0.35** against a correct render, at **ink 0.72** (strokes
~28% too thin), and `ZX SPECTRUM` at 16px comes apart into **8 extra connected
components** [M]. Rotation adds comparatively little on top of that.

The decisive number: `coverage-16/50`, the finest resample the bench can
perform on the shipped raster, scores **0.311**. The crudest, the shipped chain
itself, scores **0.309** [M]. Sixteen-times supersampling of a binary source
buys 0.002. **Information destroyed at threshold time cannot be recovered
downstream, and no better resampler will ever matter.**

The cause is one line. `TextToolClass._rasterizeRaw` decides each pixel from a
single alpha sample:

```js
data[(ry * w + rx) * 4 + 3] > 127
```

This repo has already diagnosed that exact defect and fixed it elsewhere.
`js/utils/font-rasterizer.js` (2026-08-19) says plainly: "fitted into 8 rows a
typical sans stem is ~0.7 output pixels wide, so a whole-pixel test drops
strokes that are unambiguously there", and answers it with `SUPERSAMPLE = 4`
plus a coverage threshold. **It has exactly one caller** -
`font-editor-dialog.js:582`, the Font Editor's "From System Font" import. The
stamp path never got it.

## 2. Goals / non-goals

**Goals**

- Decide every stamp pixel from area COVERAGE, thresholded ONCE, at the end.
- Rasterise vector glyphs THROUGH the transform, so the font engine draws an
  already-rotated outline rather than a resampler turning a picture of one.
- Do not regress 1-bit sources - pasted pixel artwork, ZX ROM and library
  fonts - which have no finer form to draw coverage from.
- **Preserve TONE as well as shape.** A dither field carries its meaning in how
  much ink it has, not in where the ink is; a letterform is the reverse. One
  pipeline has to serve both (4.4).
- Keep the interactive controls interactive. A slider that drops four frames
  per tick is not an improvement.

**Non-goals**

- Anti-aliasing. The output is 1-bit under attribute constraints; the win is
  in WHICH pixels are inked, never in softening them.
- Changing the ORDER of operations. Warp continues to apply in glyph space,
  rotation continues to come last; only the domain they operate in changes.
- Bitmap-font placement, `MaskOps.process`'s public shape, or any i18n.

## 3. What the bench measured

`tools/text-transform-bench.js`, **341 cases** across five source families, all
figures below from ONE run on 2026-08-29:

| suite | cases | source |
|---|---|---|
| zx | 60 | ZX ROM glyphs - 1-bit, no finer form, exact integer scale |
| art | 165 | the shipped pattern library tiled, ShapeGenerator rasters, a noise field, and photos through `PNGFormat.imageToInkMask`; includes the 0.6x downscale |
| warp | 36 | all nine warp effects, no rotation |
| sys | 80 | Arial, at 1x and 1.25x - a vector source, which HAS a finer form |
| (photo) | 54 | the photo rows of `art` and `warp`, reported separately below |

Angles 0/15/30/45/60. Text strings are chosen for failure modes: `E` parts into
bars, `aeo8` fills its counters, `IIII` merges stems, `ZX SPECTRUM` is what
someone actually types. Ground truth is the finest available form of the
source, area-resampled at 16x16 subsamples and thresholded once at 0.50.
**The 0-degree control reads 1.000 for every bitmap pipeline**, which is what
licenses reading the rest - when it did not, the harness was wrong.

`tone` is candidate ink over the ground truth's CONTINUOUS area; `gone` counts
non-empty sources that produced a blank stamp. Both metrics replaced an earlier
`ink` ratio that divided by the thresholded truth - which is empty for sparse
sources, and produced ratios of 576 that hid a real finding.

### Vector fonts (Arial), 80 cases [M, CORRECTED 2026-08-29]

**The first version of this table was invalid and its figures are struck
through below.** The bench's `SYS_FONT` was `'Arial, sans-serif'`. The app
builds `${size}px "${family}"`, so it quoted that into a single family nobody
has and fell back to a default serif - while the bench's own ground-truth
renderer left it unquoted and got real Arial. Every `current` row was therefore
a comparison of two TYPEFACES, not of two pipelines, which is what put its IoU
at 0.309. Found while implementing, and the bench now pins a single family.

Re-measured with the same face on both sides:

| pipeline | IoU | dComp | dHole | tone |
|---|---|---|---|---|
| current, BEFORE this work | 0.683 | 2.96 | 0.74 | 0.80 |
| current, AFTER the coverage rasteriser | 0.743 | **0.45** | 0.56 | **1.00** |
| raster-fix | 0.814 | 0.21 | 0.42 | 1.09 |
| render-through ss=4 | 0.935 | 0.01 | 0.10 | 1.05 |
| **render-through ss=8** | **0.964** | **0.01** | **0.04** | **0.98** |

~~0.309 -> 0.959~~ was the headline before the correction. The real gain from
the rasteriser alone is **dComp 2.96 -> 0.45** - an 85% drop in the number of
extra pieces a string comes apart into, which is the readability number - with
tone going 0.80 -> 1.00, and IoU 0.683 -> 0.743. Rasterising through the
transform then takes IoU to 0.935.

Corroborated independently of the bench, same font on both sides, by counting
connected pieces in `ZX SPECTRUM` at 16px [M]:

| face | before | after |
|---|---|---|
| Arial | 17 | 9 |
| Times New Roman | 19 | 10 |
| Georgia | 17 | 9 |

and for the rotation, `Californian FB` at 16px turned 45 degrees: **20 pieces
resampled, 11 rasterised already-turned**, against 11 upright.

### ZX ROM glyphs, 60 cases [M]

| pipeline | IoU | dComp | dHole | tone | 0deg |
|---|---|---|---|---|---|
| current (ships today) | 0.976 | 0.23 | 0.15 | 1.00 | 1.00 |
| coverage ss=4 / 0.50 | 0.973 | 0.65 | 0.25 | 1.02 | 1.00 |
| rotsprite | 0.923 | 2.48 | 1.03 | 1.04 | **0.95** |
| Bayer | 0.787 | 1.02 | 1.22 | 0.99 | 1.00 |
| error diffusion | 0.910 | 0.83 | 0.40 | 0.99 | 1.00 |
| **coverage ss=8 / 0.50** | **0.994** | 0.23 | **0.05** | 1.00 | 1.00 |
| **local tone, 0.10** | **0.994** | 0.23 | **0.05** | 1.00 | 1.00 |

**ss = 4 is not enough for a 1-bit source** (0.973, below the 0.976 that ships);
ss = 8 clears it (0.994). An earlier draft read the ss=4 row as "coverage is
wrong for pixel artwork" and was wrong - the subsampling was too coarse to
resolve the 0.5 tie-break, not the approach.

**Local tone correction is a measured no-op here**, matching plain coverage to
three decimals. That is the property that makes it safe as a universal rule.

RotSprite is rejected on evidence, not taste: it scores **0.95 at ZERO
degrees**, because Scale3x bevels the corners of artwork nobody asked to
rotate. Rotating by 0 must be identity. The contact sheet shows the chamfer on
an unrotated `E`.

### Pasted artwork - patterns, shapes, noise, photos, 165 cases [M]

Replaces the ZX-glyph PROXY an earlier draft relied on. Includes the 0.6x
downscale, which nothing had exercised.

| pipeline | IoU | dComp | dHole | tone | gone |
|---|---|---|---|---|---|
| current (ships today) | 0.720 | 7.39 | 8.19 | 1.00 | 0 |
| rotsprite | 0.854 | 12.58 | 4.88 | 1.01 | 0 |
| Bayer | 0.684 | 9.91 | 60.33 | 1.00 | 0 |
| error diffusion | 0.782 | 11.44 | 24.05 | 0.99 | 0 |
| coverage ss=8 / 0.50 | **0.963** | **2.50** | 3.29 | 0.96 | **1** |
| **local tone, 0.10** | 0.949 | 3.04 | 3.94 | **0.98** | **0** |

The `gone` column is why the last row wins despite the lower IoU: plain
coverage produced a completely blank stamp from artwork that was not blank.
See 7.1, and read the sheets rather than the IoU.

### Photo-derived pastes, 54 cases [M]

Whether the local-tone rule holds against a quantised PHOTO, whose dither is
irregular where a library tile's is regular. Sources go through the app's own
`PNGFormat.imageToInkMask` - per-cell two colours, Floyd-Steinberg - the path a
clipboard image actually takes.

| pipeline | IoU | dComp | tone | gone |
|---|---|---|---|---|
| current (ships today) | 0.794 | 6.28 | 1.01 | 0 |
| Bayer | 0.781 | 9.09 | 1.00 | 0 |
| error diffusion | 0.848 | 7.35 | 1.00 | 0 |
| **coverage ss=8 / 0.50** | **0.976** | **2.37** | 1.00 | 0 |
| local tone, 0.10 | 0.971 | 2.41 | 0.99 | 0 |

**No photo-specific failure.** A quantised photo's cells sit near 50% coverage,
so the threshold preserves their tone and the rule correctly does not fire -
0.971 against 0.976, a difference of 0.005. Plain coverage is meanwhile a large
win over what ships (0.794 -> 0.976).

This also prices the tolerance: 0.20 is an exact no-op on photos where 0.10
costs 0.005, while 0.10 is the setting the sparse-tile sheets favour. 0.005 is
the measured cost of choosing 0.10, and it is worth paying.

### Warp - all nine effects, 36 cases [M]

| pipeline | IoU | dComp | dHole | tone | gone |
|---|---|---|---|---|---|
| current (ships today) | 0.615 | 21.49 | 22.69 | 1.01 | 0 |
| Bayer | 0.607 | 15.31 | 84.60 | 0.99 | 0 |
| error diffusion | 0.709 | 24.26 | 37.74 | 1.00 | 0 |
| coverage ss=8 / 0.50 | **0.959** | **1.20** | 5.66 | 0.93 | **1** |
| **local tone, 0.10** | 0.881 | 12.06 | **2.80** | **1.01** | **0** |

**Warp is the worst-performing operation in the app** - `dComp` 21.49 means a
warped stamp comes apart into roughly twenty-two more pieces than it should.
Error diffusion is the one candidate measurably WORSE than shipping (24.26).

As with artwork, the local-tone row's lower IoU is trap 1, not a regression:
the arch sheet shows plain coverage deleting the right-hand half of a warped
pattern, and truth deletes it too.

### Cost [M]

Chrome, this machine, 2026-08-29. The coverage pass is linear in output pixels
at **0.22 microseconds per pixel at ss=8** (0.216-0.284 measured across a 124x
range of output areas):

| stamp | output box | coverage ss=8 | + local tone | nearest (ships today) |
|---|---|---|---|---|
| 120x24 (typical text) | 111x92 | 2.3 ms | 2.7 ms | - |
| 400x64 | 358x292 | 22.6 ms | 26.3 ms | - |
| 640x256 (largest LAYER2_640 stamp) | 666x590 | 90.8 ms | 106 ms | 2.6 ms |

The rest of a slider tick today - re-raster, floating redraw, compose, render -
costs **0.04 ms on a 16x8 stamp and 0.89 ms on a 352x32 one** [M], so the
coverage pass dominates entirely and is the only thing section 5 must budget.

Canvas render-through is a different cost class because the browser rasterises:
3.04 ms for a long string at 64px, ss=4 - within noise of the shipped
raster-then-rotate at the same size (2.51 ms) [M].

**A full-size stamp at ~106 ms is six dropped frames per slider tick.** This is
the constraint the design has to answer, and section 5 is that answer.

## 4. Architecture

Two source kinds, two mechanisms, one domain.

```
                    ┌─ vector glyph ──> canvas render-through (rotation in the
                    │                   matrix; the font engine rasterises an
   stamp source ────┤                   already-turned outline)
                    │
                    └─ 1-bit artwork ─> JS coverage map (exact area of the
                                        source pixels as unit squares)
                                              │
                                              v
                       coverage buffer (Float32Array, 0..1)
                       scale -> effects -> warp -> rotate, all in coverage
                                              │
                                              v
                              ONE threshold, at the very end
```

The asymmetry is not incidental. A vector glyph has a finer form to draw
coverage FROM, so re-rasterising it beats resampling it - and is faster,
because that work goes to the browser. A pasted 1-bit stamp has no finer form,
so exact area over its pixels-as-unit-squares IS the best answer available, and
`coverage ss=8 / 0.50` computes it.

### 4.1 New module: `js/utils/coverage-ops.js`

Pure, Node-testable, dependency-free - the same contract `MaskOps` holds, and
sited beside it. Operates on `{ data: Float32Array, w, h }`.

- `fromMask(mask)` / `toMask(cov, threshold)` - the domain boundary.
- `transform(cov, {scaleX, scaleY, degrees}, box, ss)` - the single composed
  inverse map. Replaces two sequential resamples with one.
- `warp(cov, effect, intensity)` - the existing inverse mappings, sampling
  coverage instead of booleans.
- `flipH` / `flipV` / `shadow` / `outline` - coverage counterparts of the
  `MaskOps` operations, so `process()` can run without leaving the domain.
- `toneCorrect(cov, threshold, window, tolerance)` - the rule in 4.4. It is the
  ONLY caller-visible way out of the coverage domain that is not a plain
  threshold, and `toMask` should route through it rather than offering both.

`MaskOps` keeps its boolean API unchanged. It is used by tools, tests and the
hover footprint, and none of that wants a coverage buffer.

### 4.2 `TextTool`

- `_rasterizeRaw` gains supersampling and returns COVERAGE, not booleans.
- A new `_renderThrough(text, family, px, degrees, box)` puts the rotation in
  the canvas matrix. Placement is measured before it is drawn: `textBaseline`
  centres on the em box, the rest of the pipeline centres on ink, and the gap
  between those is several pixels of pure misalignment.
- `_rasterizeWithFont` keeps its current signature and thresholds internally,
  so existing callers are unaffected.

### 4.3 `SelectionService._recomputeStampTransform`

Becomes: obtain a coverage source (render-through where the fontInfo names a
vector family, `fromMask` otherwise), run the existing Step 1b / 2 / 3 chain
against `CoverageOps`, then `toMask` once. Step order is unchanged.

### 4.4 Local tone correction - the rule that serves both

Threshold plainly at 0.50, then, over each 8x8 window, compare the window's
CONTINUOUS coverage against how much ink the threshold actually produced.
Where the two agree, do nothing. Where the threshold has lost tone, put back
the missing pixels **in order of coverage**, highest first.

Why the trigger separates the cases, by construction:

- A **letterform**'s interior is coverage 1 and stays inked; its background is
  0 and stays empty; its edge band roughly balances. The deficit is near zero,
  so the rule does not fire. Measured: on the ZX suite `tone-8/.10` scores
  0.994 / dComp 0.23 / tone 1.00 - **identical to plain coverage to three
  decimal places** [M]. It is provably a no-op there.
- A **dither field** downscaled is 0.25 in every pixel and thresholds to
  nothing. The deficit is the entire tone, and the rule restores it.

Why pixels are ranked by COVERAGE and not in Bayer order: the restored texture
then follows the artwork's own geometry. Bayer replaced a checkerboard with its
own weave and a diagonal tile with generic noise (see the density-50 and
diagonal-left sheets); ranking by coverage keeps a diagonal a diagonal, and at
0 degrees produces cleaner diagonal lines than the shipped nearest path does.
Ties - a uniform field, where every pixel has identical coverage - break on
Bayer order, which is what scatters the selection instead of clumping it into
one corner of the window.

Rejected alternatives, all measured (7.1): Bayer everywhere destroys shape
(0.787 on glyphs, dHole 60 on artwork); error diffusion costs shape and is
measurably WORSE than the shipped chain on warp (dComp 24.26 against 21.49);
the whole-blank guard is discontinuous in the rotation angle; FontRasterizer's
per-line rescue misfires on artwork, where a blank row is usually background.

**The window is 8 and the tolerance is 0.10** (see section 6). A 16px window
leaves visible blocky seams in the restored region - it is on the sheet.

## 5. Keeping it interactive

Preview cheap, commit exact - the split the Transform panel's image-rotation
slider already uses (it commits on a debounce, `transform-panel.js`).

- While a gesture is in flight (`input` on a slider, a drag), transform the
  BOOLEAN mask by the current nearest path. Same cost as today.
- On release, run the coverage pass once and replace the stamp pixels.

**The budget is not a hardcoded pixel count - the code times itself.** A pixel
threshold would be a constant measured on one machine and wrong on every other,
which is the weakest kind of threshold this project allows. Instead: run the
coverage pass live, and if the FIRST pass of a gesture exceeds `LIVE_BUDGET_MS`,
drop to the cheap path for the rest of that gesture and do the exact pass on
release. A slow machine degrades to preview-cheap on a stamp where a fast one
stays exact, which is the correct behaviour on both.

`LIVE_BUDGET_MS = 7`, and it ties to the frame rather than to taste. A drag is
direct manipulation, so it wants 60fps: 16.7 ms. The rest of a slider tick -
re-raster, floating redraw, compose, render - measures **0.04 ms on a 16x8
stamp and 0.89 ms on a 352x32 one** [M], so the pass may have most of the frame
before anything drops. 7 ms is under half of it, leaving room for paint and a
GC pause: running right at 16 ms means any hiccup drops a frame.

For orientation, the pass costs **0.22 microseconds per output pixel at ss=8**
[M: 0.216-0.284 measured across a 124x range of output areas, linear], so 7 ms
is roughly 32,000 output pixels - about a 200x48 text stamp. Most text stamps
are smaller than that and stay exact throughout; that figure is a sanity check
on the timer, never the test itself.

This also bounds the memory: a 640x256 stamp at ss=8 addresses 10.5 M
subsamples [C: 640 x 256 x 64], which is fine as a one-shot and not fine
sixty times a second.

## 6. Constants, and why they are not font-rasterizer's

| constant | value | basis |
|---|---|---|
| `SS_VECTOR` | 8 | 0.959 vs 0.937 at ss=4 [M]; browser-side cost |
| `SS_MASK` | 8 | ss=4 measures BELOW the shipped chain (0.973 vs 0.976) [M] |
| `INK_COVERAGE` | 0.50 | the UNBIASED area cut, for 1-bit sources whose coverage is exact geometry: 0.994 against ground truth where 0.40 scores 0.944 [M] |
| `GLYPH_COVERAGE` | 0.30 | the ink-BIASED cut, for rasterising vector glyphs. Recalibrated 2026-08-29 during implementation - see below [M] |
| `TONE_WINDOW` | 8 | one ZX cell; 16 leaves blocky seams in the restored region (sheet) [M] |
| `TONE_TOLERANCE` | 0.10 | of the window. 0.10 and 0.20 are within noise numerically (artwork 0.949 vs 0.954, photos 0.971 vs 0.976 - both favour 0.20 by ~0.005); the SHEETS favour 0.10 on the sparse tiles, and 0.005 is the measured price of taking them at their word [M] |

**Correction, 2026-08-29, found while implementing.** This section originally
gave ONE threshold of 0.50 for both jobs, justified by the bench scoring 0.50
above 0.40. That justification was circular: the bench's ground truth is itself
thresholded at 0.50, so the comparison could only ever favour 0.50. **A
threshold cannot be calibrated against a reference that already assumes it.**

There are two jobs and they want different answers. For a **1-bit source**,
coverage is exact geometric area - every source pixel is a unit square, in or
out - so half is the unbiased and correct cut, and the bench's 0.994 for it
stands. For a **vector glyph**, legibility rides on strokes THINNER than a
pixel: a stem straddling two columns puts half its width in each, so an
unbiased test drops marks that are unambiguously there.

`GLYPH_COVERAGE` was therefore calibrated the way `font-rasterizer.js`
calibrated its own - render real faces and read the bitmaps. Six faces (Arial,
Segoe UI, Verdana, Consolas, Times New Roman, Georgia) at 12/16/24px, scoring
`ZX SPECTRUM` against one piece per glyph and `aeo8` against its five counters.
Total absolute error: **25 at 0.25, 20 at 0.30, 24 at 0.35, 41 at 0.40, 89 at
0.50** - a real minimum, with letters MERGING below it (Verdana at 12px falls
to 8 pieces) and fragmenting above it (Times at 16px reaches 26 pieces and
loses all five counters). Sans faces are insensitive across the whole range;
serifs at small sizes are what the value is for.

The effect on the shipped path, measured the same day: `ZX SPECTRUM` at 16px
went from 17 pieces to 9 in Arial, 19 to 10 in Times New Roman, and 17 to 9 in
Georgia.

`font-rasterizer.js`'s **0.40** remains its own: it fits glyphs into EIGHT
ROWS, smaller again than a stamp. Three sites, three measured values, and none
may adopt another's without re-measuring at its own sizes.

## 7. Risks

### 7.1 RESOLVED - coverage thresholding destroyed sparse textures

**A flat 0.50 cut deletes any pattern too sparse to reach half coverage
anywhere.** A 25%-dense diagonal tile downscaled to 0.6 never reaches a half in
any output pixel, so the whole texture disappears. The contact sheets
(`art-pattern_diagonal_left-down.png`, `warp-pattern_diagonal_left-arch-up.png`)
show it plainly: the shipped nearest path carries the pattern across the whole
arch and the whole downscale, and every coverage pipeline drops most of it.

This matters here more than it would in most applications, because **dither
patterns ARE this app's shading system** - on a two-colour cell the only way to
fake a grey is to dither, and the pattern library's whole spine is a density
ramp.

**The metrics cannot see it, because the ground truth makes the same mistake.**
Truth is area coverage cut at 0.50; where truth says "nothing" and the
candidate says "nothing", IoU reads 0.96. This is the failure mode CLAUDE.md
already records from the palette work - three metrics agreeing and the eye
disagreeing - reproduced exactly.

Three remedies were measured and none is adoptable as-is:

| remedy | what it fixes | why it is not the answer |
|---|---|---|
| Bayer dither the coverage | keeps texture at every angle, tone 1.00 | wrecks shape: ZX IoU 0.787 vs 0.994, artwork dHole 60.3 vs 3.3 |
| per-line dropout rescue (FontRasterizer's) | vanishing, tone | misfires on artwork, where a blank row is usually background: IoU 0.963 -> 0.905 |
| dither only when the whole stamp is blank | metric-perfect, `gone` 0 | **discontinuous in the angle** - blank at 0/15/30/60 and a dense field at 45. On a slider, a pattern flickering in and out. Rejected on the sheet |
| Floyd-Steinberg error diffusion on the coverage | texture at EVERY angle, `gone` 0, tone 0.99-1.00, no discontinuity - the best of the tone-preserving family on the sheets | costs shape: ZX 0.910 vs 0.994, artwork 0.782 vs 0.963, and warp `dComp` 24.26 is WORSE than the 21.49 that ships. Vertical striping on a 50%-density tile |

Error diffusion was tried on the specific hypothesis that it would be
SELF-SELECTING - a solid interior is coverage 1 and background is 0, so there
is no error to carry and it should degenerate to a plain threshold, acting only
where coverage is genuinely fractional. **The hypothesis was wrong, and the
reason is the scale this app works at**: at 8-48px almost every pixel of a
glyph IS an edge pixel, so the fractional region is not a thin band around a
solid mass, it is most of the letter. Error diffusion therefore acts nearly
everywhere rather than only in texture fields. Recorded because it is the kind
of idea that looks obviously right and would otherwise be tried again.

**The failure is specific to DOWNSCALING and to locally-compressing warps**,
not to the coverage domain in general: at scale >= 1 with rotation only, the
artwork suite holds 0.94-0.99 across every angle. What breaks
is decimation - where several source pixels fall into one output pixel and a
sparse pattern's coverage lands below the cut everywhere at once.

**The resolution is section 4.4.** The trigger that works is not "is the
transform compressing" - a downscaled glyph compresses too, and dithering one
is precisely what must not happen - but "did the threshold lose tone HERE",
which separates the two cases directly and measurably.

### 7.2 Other risks

**Text gets visibly heavier.** tone 0.72 -> 0.98 [M] is a ~36% increase in
inked pixels for system-font text. That is the defect being fixed, but anyone who has
tuned a size to compensate will see their text change. Existing artwork is
unaffected - stamps are committed to the canvas at placement.

**`_qualityScan` may be measuring the wrong thing afterwards.** It scores how
BINARY a font's alpha is to pick "clean sizes", which is a proxy for "will the
single-sample threshold mangle this". With coverage rendering that proxy is
weaker. Not a blocker; worth revisiting, out of scope here.

**The vector half carries none of this risk.** 7.1 is entirely about 1-bit
sources. Render-through for system fonts is clean at every angle (0.959, dComp
0.03) and is separable from the rest of the design.

## 8. Testing

- `tests/coverage-ops.test.js` (new, Node) - domain round-trip, the composed
  transform against the analytic answer, quarter turns still exact, empty-input
  safety.
- `tests/text-mask-ops.test.js` - unchanged; `MaskOps` keeps its boolean API.
- `tests/browser/text-render-quality.spec.js` (new) - pins the findings that
  would silently rot: `ZX SPECTRUM` at 16px stays ONE component per word, ink
  ratio stays within tolerance of a reference render, and a quarter turn stays
  lossless.
- `tools/text-transform-bench.js` is the gate. No change to this pipeline lands
  without a before/after from it, exactly as `palette-bench.js` gates the other.
- Full `node tests/run-all.js` and `npx playwright test` green.

## 8a. Conformance with the enforced rules

`tests/lint-architecture.test.js` fails the build on these, and two of them the
design as prototyped would have tripped. Checked against the live rule set
2026-08-29.

**`_renderThrough` must use `Helpers.createCanvas()`, never
`document.createElement('canvas')`.** The `dom-in-logic-layer` rule covers
`js/core/`, `js/services/` and `js/tools/`, and `text-tool.js` is NOT on its
allowlist (only canvas-system, color-manager, input-handler and
reference-layer-service are). The existing `_rasterizeRaw` already goes through
`Helpers`, so this is following it rather than a new constraint. The bench
prototype uses `document.createElement` legitimately - the lint walks `js/`
only, so `tools/` is outside it - which is exactly why the difference is easy
to miss when porting the prototype in.

**The same rule forbids `.style.*` on those scratch canvases.** Setting
`canvas.width`/`canvas.height` is fine (not `.style`); setting a CSS size is
not, and is never needed for an offscreen buffer.

**Clamping coverage into 0..1 must go through `Helpers.clamp`.** The
`inline-clamp` rule matches `Math.max(... Math.min` on one line, which is the
natural way to write a coverage clamp.

**`js/utils/coverage-ops.js` needs its `<script defer>` tag in `index.html`**,
in the utils block after `helpers.js` (it depends on `Helpers.clamp`) and
alongside `mask-ops.js` at line 469 - the two are siblings, and neither should
come to depend on the other.

**ASCII only.** The emoji/pictograph pass reads raw lines including comments.

The new Node suite needs no registration: `tests/run-all.js` globs
`tests/*.test.js`.

## 9. Figures register

| # | Figure | Value | Tag | Method |
|---|---|---|---|---|
| 1 | shipped vector IoU, no transform | 0.78 | M | bench, 2026-08-29, 80 cases, RE-MEASURED after the SYS_FONT fix. Was 0.35, which compared two typefaces |
| 2 | shipped vector tone ratio, before | 0.80 | M | as above; 1.00 after the coverage rasteriser |
| 3 | `ZX SPECTRUM` 16px pieces, before -> after | 17 -> 9 Arial, 19 -> 10 Times, 17 -> 9 Georgia | M | counted directly, same face both sides, 2026-08-29 - independent of the bench |
| 4 | finest resample of shipped raster | 0.311 | M | `coverage-16/50` row |
| 5 | render-through ss=8 | 0.964 | M | bench, vector table, after the SYS_FONT fix |
| 6 | 1-bit coverage ss=8/0.50 | 0.994 | M | bench, bitmap table |
| 7 | 1-bit coverage ss=4/0.50 | 0.973 | M | below the 0.976 that ships |
| 8 | rotsprite identity failure at 0 deg | 0.95 | M | bench, bitmap table |
| 9 | JS coverage 640x256 ss=8 | 62.1 ms | M | Chrome, this machine, 2026-08-29 |
| 10 | JS coverage 640x256 ss=4 | 23.0 ms | M | as above |
| 11 | nearest rotate 640x256 | 2.6 ms | M | Node, 2026-08-29 |
| 12 | canvas render-through, 64px long string | 3.04 ms | M | Chrome, ss=4 |
| 13 | subsamples, 640x256 at ss=8 | 10.5 M | C | 640 x 256 x 8 x 8 |
| 14 | `LIVE_BUDGET_MS` | 7 ms | C | 16.7 ms frame (60fps direct manipulation) less the measured 0.04-0.89 ms rest-of-tick, halved for paint and GC headroom. Was A and a pixel count; it is now a TIME the code measures itself against, so no machine-specific constant survives |
| 14a | rest of a slider tick, today | 0.04 ms (16x8) / 0.89 ms (352x32) | M | `SelectionService.setStampRotation` round trip, Chrome, 2026-08-29 |
| 14b | coverage pass cost rate | 0.22 us per output pixel at ss=8 | M | 0.216-0.284 across output areas 3.2k-393k px, linear. Chrome, 2026-08-29 |
| 15 | warp, shipped chain | 0.615 IoU / 21.49 dComp | M | bench warp suite, 36 cases, 2026-08-29. Was A; now measured |
| 16 | warp, coverage ss=8/0.50 | 0.959 IoU / 1.20 dComp | M | as above - the largest single win in the bench |
| 17 | pasted artwork, shipped chain | 0.720 IoU / 7.39 dComp | M | bench art suite, 165 cases: pattern library + shape rasters + noise + photos |
| 18 | pasted artwork, coverage ss=8/0.50 | 0.963 IoU / 2.50 dComp | M | as above; `gone` 1, which is why 4.4 exists |
| 19 | Bayer on a 1-bit shape source | 0.787 IoU (vs 0.994) | M | ZX suite - why dithering cannot be the blanket policy |
| 20 | whole-blank guard, angles at which it fires on one downscale case | 1 of 5 | M | contact sheet; the discontinuity that rejected it |
| 21a | error diffusion, ZX / artwork / warp | 0.910 / 0.782 / 0.709 IoU | M | measured 2026-08-29 to test the self-selection hypothesis; rejected - its warp `dComp` 24.26 is worse than the 21.49 that ships |
| 21b | local tone correction, ZX suite | 0.994 / 0.23 dComp | M | identical to plain coverage - the rule is a measured no-op on letterforms |
| 21c | local tone correction, artwork / warp | 0.949 / 0.881 IoU, `gone` 0 both | M | BELOW plain coverage on IoU, better on the sheets and the only one with `gone` 0 - see trap 1 in the bench header. IoU is a regression guard here, not a target |
| 21d | local tone correction cost | +0.4 / +3.7 / +15.3 ms | M | on top of the coverage pass at 120x24 / 400x64 / 640x256; worst-case fractional input, Chrome, 2026-08-29 |
| 21 | sparse-texture policy | local tone correction, 8px window, 0.10 tolerance | M | RESOLVED 2026-08-29, section 4.4. Was A |
| 22 | photo paste, shipped chain vs coverage | 0.794 -> 0.976 IoU | M | 54 cases through `PNGFormat.imageToInkMask`, 2026-08-29 |
| 23 | tolerance 0.10 cost on photos | 0.005 IoU | M | 0.971 vs 0.976; the measured price of the setting the sparse-tile sheets prefer |
| 24 | `GLYPH_COVERAGE` | 0.30 | M | six faces at 12/16/24px, total absolute error 25/20/24/41/89 at 0.25/0.30/0.35/0.40/0.50. Replaces the spec's original 0.50, which was calibrated against a ground truth that already used 0.50 |
| 25 | thresholded ink varies with rotation angle | 10-16% | M | Arial 24px through render-through: 548 ink at 0 deg, 458 at 45, 487 at 90 - while the CONTINUOUS area is invariant at 410. The 1-bit cut interacting with orientation, not a loss |

**No A-tagged figures remain.** Rows 14, 15 and 21 were all A in earlier
drafts: row 15's measurement SUPPORTED the design, row 21's initially REFUTED
it and forced section 4.4, and row 14 stopped being a figure at all once the
budget became something the code measures about itself rather than a constant
someone had to pick. That none of the three survived as an assumption is the
point of the register.

## 10. Questions raised during design, and how they were settled

Both were open when this document was first written and blocked planning. They
are recorded rather than deleted, because the answers are the reasons behind
sections 4.4 and 5 and a later reader will want them.

### 10.1 RESOLVED - the tone rule holds on photo-derived pastes

Answered 2026-08-29 by adding photo sources through `PNGFormat.imageToInkMask`
(see section 3). The rule is a no-op there, and plain coverage is a large win.
No open question remains on the 1-bit half.

### 10.2 RESOLVED - preview cheap, commit exact

Confirmed in chat 2026-08-29. Section 5 carries it, now with a self-timing
budget rather than a hardcoded one, so a small stamp stays exact throughout the
drag and only a large one shows the improvement on release.

**No open questions remain. This spec is ready for review and then for
`writing-plans`.**
