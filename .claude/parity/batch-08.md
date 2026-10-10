# Batch 8 - Fills and dithering

Group C, branch `parity-c`. Parts: 8A, 8B (one session each).
Read `RUNBOOK.md` first. Figures from the ZX Paintbrush help are
[P, ZX Paintbrush 2.6.4 help, read 2026-10-08].

Comparison doc rows: Dithering styles; Custom fill style from a picture;
Picture converter (the dither part only - the rest of that row is Batch 12).

Help pages: `dithering_style` (the method list, with the error-diffusion
weights), `custom_fill_style`, `custom_fill_style_dialog`,
`picture_converter`, `gradient_style_tool_bar`, `custom_gradient_dialog`,
`fill_style_tool_bar`, `filling`.

## What ZX Paintbrush does

31 dithering and halftoning methods, used by picture import, gradients and
custom fills:
- thresholds: 25 %, 50 %, 75 % (3);
- error diffusion (14): Floyd-Steinberg, Jarvis-Judice-Ninke, Zhigang Fan,
  Shiau-Fan (1), Shiau-Fan (2), Stucki, Burkes, Sierra 3-row, Sierra
  2-row, Sierra Lite, Atkinson, False Floyd-Steinberg, Park-Kang-Kim
  (2-way), Stevenson-Arce;
- Bayer ordered matrices: 2x2, 4x4, 8x8 (3);
- cluster dot (7): 4x4, 8x8, 5x3, cross 3x3, cross 4x3, diagonal cross
  5x4, diagonal cross 4x4;
- supercell (4): cross 3x3 x4, cross 4x3 x3, diagonal cross 5x4 x4,
  diagonal cross 4x4 x3.
[C: 3 + 14 + 3 + 7 + 4 = 31]

A custom fill style comes from a picture file run through the converter
(brightness, contrast, size, dither), and fills shapes with that pattern.

## What PixULA has today

- Picture import: `js/io/png-format.js` (methods in a table near line 37;
  `dithering: 'none' | 'floyd-steinberg'`; the per-cell quantiser and
  `_renderCellMask`), `js/utils/giga-quant.js` (GigaScreen), the dialog
  `js/ui/components/import-dialog.js` (Sharp / Smooth / Flat previews).
- Gradient: `js/tools/gradient-tool.js`, option `dithered` and
  `ditherScale` (Bayer 2, 4, 8).
- Fade brush: `js/tools/brush-engine.js` (`bayerMatrix`, ordered4,
  ordered8, halftone, noise).
- Patterns: `js/services/pattern-service.js` (generated tiles incl.
  'bayer'), the pattern library and `.pat` files; fill with a pattern in
  `js/tools/fill-tool.js`.

## Decisions

Defaults:
- One pure module, `js/utils/dither.js`: `Dither.METHODS` (id, i18n key,
  family, level count) and `Dither.apply(gray, w, h, methodId)` ->
  `Uint8Array` of 0/1, where `gray` is 0-255 luminance. Every user of
  dithering calls it; the existing Bayer code in the gradient and fade is
  replaced by calls to it only where the result stays byte-identical
  (prove it with a test), otherwise left alone and noted.
- Error-diffusion weights: from the help page where it gives them, else
  from the published papers (tag [P] with the source in the code comment).
  Cluster-dot and supercell matrices: if neither the help nor a published
  source gives the exact values, build matrices with the same size and
  level count, tag them [A] in a comment saying they are equivalents, and
  record that in the comparison doc row. Consult Opus on the plan.
- Serpentine scanning for error diffusion: off by default (as the classic
  methods), one option.

OWNER: none known.

## Part 8A - the dither module

Build:
1. `js/utils/dither.js` with all 31 methods, loaded like the other
   `js/utils` files (script tag in `index.html`; the portable build picks it
   up - check `tools/build-portable.js`).
2. i18n keys for the 31 names in 13 locales (method names are mostly proper
   names: translate the words "Threshold", "Bayer matrix", "cluster dot",
   "supercell", "cross", "diagonal" and keep the people's names).

Tests: each method on a 0-255 horizontal ramp gives the expected density
per column band (within the method's level count); thresholds exact;
Floyd-Steinberg matches a hand-computed 4x4 example; every method is
deterministic; Bayer 4x4 here equals the fade brush's ordered4 output.
Speed: the 31 methods on a 640x256 image, timed [M] in `docs/FIGURES.md`.

Done when: all 31 methods exist, are tested, and are timed.

## Part 8B - use it in import, gradients and fills

Build:
1. Import dialog: a "Dither" select with all 31 methods (default stays
   today's behaviour) beside the existing method previews; the live preview
   follows. Applies where the converter dithers dots (per-cell quantiser,
   GigaScreen, Timex hi-res); indexed modes keep their own colour dither
   path unless Opus advises it can use the module too.
2. Gradient tool: the "Dithered" option's grain select becomes a method
   select (the three Bayers first, so old presets map 2/4/8 to them).
   Tool presets with the old `ditherScale` load unchanged.
3. Custom fill from a picture: in the pattern panel, "From picture..." opens
   the import dialog in a "make a fill" mode (size up to the pattern size
   limit, dither select), and adds the result to the pattern library as a
   user pattern, so every fill and brush that uses patterns can use it.
4. i18n, manual (`80-files.md` import section, `60-patterns.md`) and
   translations, Playwright spec.

Tests: import with each family gives the expected dot density on a ramp
picture; old gradient presets give byte-identical output; a picture-made
pattern round-trips through the library.

Done when: import, gradients and the pattern library offer all 31 methods,
and a fill can be made from a picture.

## After 8B

Batch 8 is done. Update the comparison doc rows, then hand off to Batch 9
part 9A.

## 8A decisions (2026-10-10, Opus plan review)

- Measured against ZX Paintbrush's own 160x160 output pictures [M, 2026-10-10]: grey is Rec.601 luma; thresholds ink when
  100*g < 255*T; ordered methods use the printed table (row = y) with level 0 at the origin and ink when
  2*N*g < (2*m+1)*255; error diffusion is left-to-right on every row (serpentine is an option, off); Park-Kang-Kim uses
  kernel A except above grey 224 (an [A] cut, `PKK_SPLIT`).
- The 8 non-rectangular methods are lattice tilings (cluster cells repeated on two lattice vectors); `Dither` builds each
  tile at load and throws unless every pixel is covered by exactly one cell. The help's supercell diagonal cross 5x4 x4
  prints 16 twice and no 19 (used as printed); the 4x4 x3 table's "38" is a typo for 28.
- CORRECTION to the Tests line above: ZX Paintbrush's Bayer is the TRANSPOSE of the matrix the fade brush and the gradient
  use, so "Bayer 4x4 equals the fade's ordered4" cannot hold. The fade and gradient stay as they are; the test asserts
  the transpose relation to the textbook matrix.
- For 8B: the gradient's old `ditherScale` presets (2/4/8) must keep the gradient's own Bayer code to stay byte-identical;
  the new method select adds the Dither methods beside them.
- Side finding: `CLUSTERED_8` in brush-engine.js has two cells swapped against the help (row 4 col 3 reads 38, row 7 col 3 reads
  36; correct 36 and 38). Not part of 8A; not changed.
