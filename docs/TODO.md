# PixULA - work to do

Follow-ups from the 2026-08-24 native Save/Export rework. Nothing here is
broken or blocking - the branch merged with a green suite - but these were
found and deliberately deferred along the way, either because they were out
of scope for the work that found them, or because fixing them needed a human
decision this session couldn't make alone. Grouped by how much it matters,
not by when it was found.

---

## Should do soon

**Manual verification that every native-picker export format produces a
correct file, not just non-empty bytes.** The automated coverage
(`tests/browser/native-save.spec.js`) stubs `showSaveFilePicker()` and
proves the WIRING - the right handler runs for a given extension and writes
something - but never proves the bytes that land on disk are actually
correct for that format (matching what the porting protocol elsewhere in
this project calls "byte-identical" verification). Needs a checklist pass:
save through the real native dialog once per format in `js/io/
file-manager.js`'s `EXPORT_PICKER_TYPES` list (~24 extensions) and confirm each file
actually opens in whatever real program/emulator that format targets
(FUSE/ZEsarUX for .scr/.tap/.tzx, a real image viewer for .png/.bmp/.jpg/
.gif, ZXMAK2/SpecNext tooling for .nxi/.sl2/.slr, etc.) - this is new
surface the 2026-08-24 Save/Export rework added, not covered by the
existing byte-identical Node tests, which exercise the format handlers'
OWN encode/decode logic directly and never touch the native-picker path at
all.

## Nice to have

- **`tests/browser/font-rasterizer.spec.js` and
  `system-font-import.spec.js`'s real-font block self-skip** if none of the
  shared `findInstalledFont()` candidates (`tests/browser/helpers.js`) exist
  on a machine - now naming every path checked in the skip reason, but a
  Playwright "skipped" line is still just one line among hundreds in
  `--reporter=line` output, not a loud signal. Worth a summary step that
  fails (or at least warns distinctly) if the real-font specs skipped.

## Performance - the deeper tier

Left over from the 2026-09-26 speed pass (`docs/superpowers/plans/2026-09-26-speed-pass.md`,
figures in `docs/FIGURES.md` section 8). That pass took only the fixes that
were low-risk and provably output-identical; these are the bigger rewrites it
found and deliberately did not do. Each touches heavily mode-tested code, so
each wants its own before/after measurement with `tools/speed-bench.js` (or
`tools/perf-bench.js`) and a byte-identity check across the screen modes.

- **The eraser still walks its whole disc at every step of a drag.** After
  the pass a full-width size-128 drag is ~260 ms, of which ~120 ms is visiting
  all 12,796 offsets of the disc at each interpolated point although the
  previous step already cleared all but the leading edge, and ~57 ms is the
  per-move hover footprint (M, CPU profile, 2026-09-26). Stamping only the
  leading edge per step direction would take most of the first.
- **Flood fill is a pixel queue with a Set.** `js/tools/fill-tool.js` pushes
  four neighbours per pixel and calls `getPixelState` (two allocations) for
  each; a whole-canvas fill at LAYER2_640 is 164k pixels. A scanline fill
  with a `Uint8Array` visited map, still writing every pixel through `draw()`
  so symmetry, clip and dither apply, is the standard fix. Not yet measured.
- **The compositor preview round-trips every pixel through strings.**
  `GridOverlay.drawCompositorPreview` / `_renderCompositorPreview` turn each
  pending pixel into an `"x,y"` key, parse it back to find its cell, then
  build 64 more keys per cell - roughly 130k string builds a frame on a
  near-full-canvas shape, most of the 8 ms such a drag still costs per move
  (M, 2026-09-26). Numeric per-cell buckets with a reused byte mask would
  remove them; duplicates must still collapse (XOR) and ink must still beat
  paper for the same pixel.
- **GigaScreen's default Average view composes through `setPixel`.** The
  per-pixel path section 8 found to be 68% of compose time is still how
  `layer-manager.js` draws the four blended colours, with several typed-array
  allocations per cell; the Flicker view also recomposes the whole picture at
  50 Hz where two buffers swapped per phase would do.
- **The cell grid at 1600% on a 2x screen is still ~200 MB.** Only visible
  grids own a canvas now, but a visible one is the whole picture at zoom x
  DPR. Sizing grid canvases to the visible viewport (redrawn on scroll), or
  drawing them as CSS repeating gradients, would make it a few MB.
- **The brush cursor can re-encode a PNG on a pointer move.** In modes where
  the mark shows the colour under it, a move over new colours misses the
  cursor-image cache and `toDataURL('image/png')` runs synchronously. Encoding
  off the main thread (`OffscreenCanvas.convertToBlob`) keeps the look; a
  colour-stable mark while drawing would be a behaviour change and is the
  artist's call.

## Future format support

**SAM Coupe screen modes and formats.** The SAM Coupe is another Z80-based
British home computer of the same era as the Spectrum (its case and BASIC were
explicitly Spectrum-compatible, and it can run a lot of Spectrum software),
which puts it in the same neighbourhood as the ZX Next work this project
already does - a natural future addition to `docs/FORMAT_ROADMAP.md`'s
future-formats list. Not started; no code, no design doc. Screen mode facts
below are [P] (published), sourced 2026-08-23 - none of them are measured
against this project's own code, since none exists yet:

- Mode 1: 256x192, 1bpp, non-linear (ULA-style) framebuffer, PAPER/PEN
  attributes per 8x8 block, 6.75 KB - the Spectrum-compatible mode (same
  layout family as `STANDARD_ULA` in `SCREEN_MODES`). [P: petecodes.co.uk,
  "Graphics in Assembler for the SAM Coupe"; worldofsam.org, "Sam Coupe
  Specifications"; accessed 2026-08-23]
- Mode 2: 256x192, 1bpp, linear framebuffer, PAPER/PEN attributes per 8x1
  block (finer-grained than Mode 1 - closer to this project's existing
  `MULTICOLOR_8x1` shape), 12 KB. [P: same sources, accessed 2026-08-23]
- Mode 3: 512x192, 2bpp (4 simultaneous colours), linear framebuffer, 24 KB -
  a high-resolution text-oriented mode with no existing analogue in
  `SCREEN_MODES` (nearest is `TIMEX_HIRES`, which is 1bpp monochrome, not
  2bpp colour). [P: same sources, accessed 2026-08-23]
- Mode 4: 256x192, 4bpp (16 of a 128-colour palette), linear framebuffer,
  24 KB - the mode most SAM Coupe games actually use. Supports two
  simultaneous palettes (A/B) that the hardware can alternate at roughly
  3 times a second for a flash-style effect, which is a different mechanism
  from this project's per-cell FLASH bit and would need its own design
  thought, not a reuse of the existing FLASH handling. [P: same sources,
  accessed 2026-08-23]

RECOIL (this project's reference decoder for every other format-parity
decision, per `docs/FORMAT_ROADMAP.md`) has some SAM Coupe support - a
`recoil.sourceforge.net` formats listing names LCE (256x384, 2 frames), SS1/
SS2/SS3 (one per screen mode 1/2/3), SS4 and SCS4 (both Mode 4) and SSX
(variable resolution up to 512x192) [P: recoil.sourceforge.net/formats.html,
accessed 2026-08-23] - but an attempted fetch of the archiveteam.org file-
formats wiki for corroborating byte-layout detail failed (connection
refused), and none of this has been checked against the actual
`recoil.c`/`recoil.ci` decoder source the way every entry in
`docs/FORMAT_ROADMAP.md` is. Before any implementation: read the real RECOIL
source for exact decoder function names and byte layouts (matching this
project's established citation style), and confirm file-size-to-mode
disambiguation the way `docs/CURRENT_STATE.md` already does for the Next
formats (e.g. the 81920-byte `.sl2` ambiguity rule) - Mode 1/2/4 all list as
128-colour in the table above despite different bit depths, which needs
resolving before a palette model can be designed. This is new-machine work
(new `SCREEN_MODES` descriptors, a new palette model most likely, four new
import/export formats), not a small addition - size it properly against the
Next mode-seam work in `docs/CURRENT_STATE.md`'s Phase 13 summary before
committing to it.

---

*Compiled 2026-08-24 from the native Save/Export rework's own follow-ups
and the SAM Coupe research the same session did. Delete or check off items
here as they land; this file is a punch list, not a design document.*
