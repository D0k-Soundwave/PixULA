# Four-colour photo import for the two-screen modes - Design

**Status:** design approved in conversation 2026-09-26; awaiting review of
this document. Nothing is built.

## 1. Goal

When a photo (PNG, JPG, GIF) is imported in a two-screen mode - GigaScreen,
MultiGigaScreen 8x4 / 8x2 / 8x1, or the Timex hi-res pair - the picture uses
each cell's four colours instead of putting the same two-colour picture on
both screens, as it does since `b81b072`.

**Aim, the artist's choice:** watchable on real hardware. The converter only
uses colour mixes whose two frames are close in brightness, so the picture
holds steady on a real Spectrum or an emulator. It gives up some accuracy
against the app's Average display to get that.

**Presentation, the artist's choice:** the Import dialog is unchanged. Sharp,
Smooth and Flat stay; in a two-screen mode each one produces a four-colour
picture. The plain two-colour result is no longer offered in those modes.
This matches the one comparable tool found, SpectraLab, which treats
GigaScreen as one more output format under the same dithering choices [P,
github.com/Bedazzle/SpectraLab README, fetched 2026-09-26: "per-cell
brute-force search over ~2628 unique attribute-pair quads for up to 4
perceived colors per cell"]. Its README says nothing about limiting flicker.

## 2. What a cell can show

A two-screen cell holds one attribute per screen: screen A's ink, paper and
bright, and screen B's. Its four colours are the four pairings, one per
GIGA_SLOTS slot (slot = bitA * 2 + bitB):

| Slot | Frame A | Frame B |
|---|---|---|
| 0 | A paper | B paper |
| 1 | A paper | B ink |
| 2 | A ink | B paper |
| 3 | A ink | B ink |

The four are forced by the two pairs, so "choose four colours" means "choose
a pair per screen". Some of the four may flicker even when others are steady
(black-on-white on both screens gives steady black, steady white, and two
hard-flickering mixes). A cell therefore has a set of USABLE slots - its
steady ones - and pixels may only take those.

## 3. The steady-mix rule

A mix of two colours is steady when:

- the two are the same base colour (either brightness), or
- their base colours are at most `MAX_STEP` apart in the Spectrum's colour
  numbering and they share the bright setting. Black is the same colour in
  both brightnesses, so its bright setting never counts.

**Measured and decided 2026-09-26:** `MAX_STEP` is 2 - colours up to two
places apart - [M, `tools/giga-bench.js` on the 13 images in
`docs/bench-images`, figures in `docs/FIGURES.md`], chosen by the artist over
1 for the warm colours step 1 turns grey. The paragraphs below are the
design as approved, when the threshold was still the one-step guess.

The numbering is the hardware's own: colour n = G*4 + R*2 + B, so 0-7 runs
black, blue, red, magenta, green, cyan, yellow, white in rising luminance
[P, the ULA's colour encoding; the order is what the attribute bits mean].

**The threshold ("neighbours", one step) is [A].** It is a guess until the
bench in section 7 measures it against one step looser. No decision rests on
it before then; the rule lives in one function so the measurement can change
it in one place.

## 4. Converting one cell (GigaScreen and MultiGigaScreen)

1. **Nearest steady mix, for counting.** Build the steady palette once: every
   steady mix of the fixed palette, as the colour the Average display shows
   (`LayerManager.gigaSlotColours`' blend, so the converter cannot disagree
   with the canvas). Map each of the cell's pixels to its nearest entry and
   count.
2. **Candidate pairs.** The most-used mixes name the colours each screen
   needs. Each screen's candidate pairs are built from those colours (at most
   a few dozen screen-A x screen-B combinations per cell, not the ~16,000 of
   a full search [C: 128 attribute values per screen, 8 ink x 8 paper x 2
   bright, squared = 16,384]).
3. **Score.** For each combination, every pixel takes its nearest USABLE slot;
   the combination with the least total error wins.
4. **Draw.** Each pixel takes the nearest usable slot of the winning pair.
   Smooth diffuses the error within the cell, as today; Sharp chooses the
   pair from the full-resolution source (`_sampleCellHiRes`), as today; Flat
   does neither.

The cell height comes from the mode, so one routine serves GigaScreen and
all three MultiGigaScreen modes.

## 5. The Timex hi-res pair

Each screen has ONE scheme for the whole picture (ink n on paper 7 - n,
bright), so there is no per-cell choice. The converter scores all 64 scheme
pairings [C: 8 x 8] against the scaled photo using only their steady mixes,
keeps the best, and gives each pixel its nearest steady mix (Smooth diffuses
the error). Known limit: with no per-cell colour choice, Sharp's advantage
disappears, and Sharp and Flat may look nearly the same in this mode.

## 6. Where it lives

- **`js/utils/giga-quant.js` (`GigaQuant`, new, pure, Node-tested):** the
  steady-mix rule, the steady palette, the cell pair picker, the per-pixel
  renderer and the hi-res scheme picker. No DOM, no layer access; it takes
  RGB samples and returns attributes, planes and preview RGB.
- **`PNGFormat`:** `_applyToLayer` (the import) and `_quantizePrepared` (the
  dialog preview) both call GigaQuant in two-screen modes, so the preview IS
  the result, as for every other mode. The preview shows the Average blend.
- **Undo:** the import stays one `UndoRedo` action. In the hi-res pair the
  two schemes are set inside that action, so one Ctrl+Z restores picture and
  schemes together (undo snapshots already carry both schemes).
- **Replaces:** the solid both-screens write added in `b81b072` for two-screen
  imports.

## 7. Testing and measurement

- **Node:** the steady rule (same colour, neighbours, bright mismatch, far
  pairs); the cell picker on synthetic cells with a known best answer; the
  hi-res scheme picker on a two-colour synthetic image; preview output equal
  to what the import writes (compared through the Average blend).
- **Browser:** import into each two-screen mode through the real dialog;
  the three previews differ; both screens are written; in the hi-res pair
  both schemes change and one Ctrl+Z restores them.
- **Bench:** `tools/palette-bench.js` gains a two-screen run over the same
  seven photos, reporting its existing columns (dSSIM first) plus the share
  of pixels on a flickering mix (zero by construction) for the rule at one
  step and at two. That run decides the threshold; the result goes into
  `docs/FIGURES.md` as an M figure with date and method, recording that it
  was [A] before.

## 8. Out of scope

- Any flicker-versus-accuracy control for the artist (the choice was made:
  steady only).
- ULAplus or Next palettes in two-screen modes (none of the two-screen modes
  uses them).
- Changing how the single-screen modes import.
