# Batch 5 - Stamps (ZX Paintbrush "overlays")

Group B, branch `parity-b`. Parts: 5A, 5B (one session each).
Read `RUNBOOK.md` first. Figures from the ZX Paintbrush help are
[P, ZX Paintbrush 2.6.4 help, read 2026-10-08].

Comparison doc rows: Pixels-only or coloured overlay; Overlay INK / PAPER /
BRIGHT / FLASH switches; Overlapping or transparent overlay; Convert colour
overlay to pixels only.

Help pages: `overlay_bar`, `create_overlay`, `create_overlay_type_dialog`,
`overlay_ink_color`, `overlay_paper_color`, `overlay_bright_color`,
`overlay_flash_color`, `overlapping_overlay`, `transparent_overlay`,
`convert_color_overlay`, `colour_overlay_editor`,
`transparent_overlay_editor`, `merge_overlay`.

## What ZX Paintbrush does

- When an overlay is made, you choose: pixels only (its colours are
  "transparent") or full colour.
- Each of the overlay's INK, PAPER, BRIGHT and FLASH can be switched off, so
  that part of the background shows through (BASIC's INK 8 and so on).
- Overlapping: the overlay's clear dots also clear the background.
  Transparent: clear dots leave the background as it is.
- Convert: turns a colour overlay into a pixels-only one (drops its colours,
  keeps its dots).

## What PixULA has today

- Stamps are floating pastes and stamp layers, in
  `js/services/selection-service.js`: `getStampData(layer)` returns
  `{ mask, indices, attrs, x, y, w, h, colorSelection }`; `stampAt(layer)`
  places set dots only and never changes colours; `_paintAttributedStamp`
  places a coloured stamp cell by cell (set dots `NORMAL`, clear dots
  `PAPER` - so coloured stamps already overlap); `_paintIndexedStamp` for
  indexed modes; `commitStamp`, `commitActiveStamp`, `toggleStampMode`,
  `setStampEraseMode`, `transformStamp`.
- Design notes: `docs/superpowers/specs/2026-08-28-attributed-stamps-design.md`
  and `docs/superpowers/specs/2026-08-29-stamp-coverage-pipeline-design.md`.
- Stamp controls: `js/ui/components/transform-panel.js` (`tp-xor`, scale,
  rotate, shape) and `SelectionService.refreshStampColor(sel)`.
- Batch 1 made plain stamps follow the rail's four "use existing" boxes when
  placed; the setting is the rail's, not the stamp's.
- Persistence: stamp layers travel in projects (`js/io/project-format.js`)
  and autosave; `tests/browser/stamp-persistence.spec.js`.

## Decisions

Defaults:
- Every stamp gets three settings, stored with the stamp (so they survive
  moving, transforming, saving and reloading):
  - `colours`: `'pixels'` (no colours of its own; uses the rail, as plain
    stamps do today) or `'coloured'` (its own cell colours);
  - `showThrough`: `{ ink, paper, bright, flash }`, each true = that part of
    the background shows through when placed (coloured stamps only; pixels
    stamps keep following the rail's boxes);
  - `clearDots`: `'transparent'` (clear dots leave the background) or
    `'overlap'` (clear dots clear it).
- Today's behaviour is the default: plain stamps `pixels` + `transparent`;
  coloured stamps `coloured` + `overlap` + nothing showing through.
- No dialog at creation: a stamp made from a selection with colours starts
  `coloured`; the Transform panel can switch it. (ZX Paintbrush asks every
  time; asking on every paste would slow PixULA's existing flows.)

Carried from group A (the end-of-build review, 2026-10-09) - stamps must be fixed properly here:
- The attribute commands (Image > Attributes: Invert, Erase, Flip H/V, Change...) do nothing on a floating stamp. They are
  blocked with a reason today; they should work on the stamp's own cells.
- A stamp that carries its own colours (attrs) cannot be flipped, rotated or inverted at all (SelectionService.transformStamp
  returns early). The menu rows are greyed out with a reason; decide whether that stays.
- Three helpers define "stamp" three ways: TransformService.attributeCommandsBlocked, dotCommandsBlocked and cellToolBlocked.
  Merge them into one when this batch touches stamps.
- Edit > Fill Selection ignores Inverse and the draw mode; Map Editor stamps that carry their own colours ignore Inverse.

OWNER: none known.

## Part 5A - the model and placing rules

Build:
1. Add the three settings to the stamp data and to every place stamp data
   is created, copied, transformed, captured (`captureFloatingState` /
   `restoreFloatingState`) and saved. Old projects without them load with
   the defaults above.
2. Placing: `_paintAttributedStamp` honours `showThrough` (resolve kept
   parts from what the page shows - the same rule as the rail's boxes,
   `PixelDrawRoutine._resolveTransparent`; reuse it, do not copy it) and
   `clearDots` (`'transparent'`: skip clear dots). `stampAt` honours
   `clearDots: 'overlap'` (clear dots erase with `ERASE`, colours kept).
3. `SelectionService.convertStampToPixels()`: drop the stamp's own colours,
   keep its dots, set `colours: 'pixels'`. One undo step.
4. Mode handling: cell-attribute modes as above; GigaScreen: both screens'
   colours, and show-through per part covers both; ULAplus: Bright and
   Flash show-through together keep the CLUT (one switch); indexed modes:
   `showThrough` hidden, `clearDots` works, `colours` is always the
   stamp's own indices; Timex hi-res: no colours, `clearDots` only.
   Mandatory Opus consult on the plan (this touches placing rules).

Tests: each setting alone and combined; defaults reproduce today's results
byte for byte; settings survive transform, move, capture/restore and a
project round-trip; convert keeps the dots and drops the colours.

Done when: a stamp carries and obeys the three settings in every mode, and
old projects load unchanged.

## Part 5B - controls, persistence checks, words

Build:
1. Transform panel, shown while a stamp is engaged: "Colours: Pixels only /
   Own colours", four small show-through toggles (Ink, Paper, Bright, Flash -
   the same look as the rail's "use existing" boxes; ULAplus shows one CLUT
   toggle), "Clear dots: Leave background / Clear background", and a
   "Convert to pixels only" button. Hide what the stamp or mode cannot use.
2. Playwright: the controls appear for stamps only; each changes what a
   placed stamp writes; settings survive reload (extend
   `stamp-persistence.spec.js`).
3. i18n in 13 locales; manual (the stamps section of `50-tools.md` or
   wherever stamps are described - grep the manual) and translations.

Done when: the four comparison rows read Same, or Partial with the reason
written in the row.

## After 5B

Batch 5 is done. Update the comparison doc rows, then hand off to Batch 6
part 6A.
