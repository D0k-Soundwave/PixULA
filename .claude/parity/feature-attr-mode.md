# Feature: Attributes Only draw mode (owner decision 2026-10-19)

ZX Paintbrush with pixel drawing switched off: every drawing tool gives each cell it
touches your Ink, Paper, Bright and Flash and never changes a pixel. A third button
next to Ink Recolour and Paper Recolour on the draw-mode bar. Ink and Paper Recolour
do not change.

## Name

English label **Attributes Only**. It pairs with Pixels Only (pixels, no attributes),
and it names what the stroke writes in the owner's terms (TERMS.md: the cell's
attributes are Ink, Paper, Bright and Flash). "Attribute Recolour" was rejected: the
retirement note warned that a mode named like the Recolour cell tool gets mistaken for
it. Translations: each locale's own word for "attributes" (as in mapel.mode.exact)
plus the "only" its dm.pixelsOnly already uses.

## Why it was retired, and why that no longer holds

The old ATTRIBUTES_ONLY user mode was dropped because it "did the same job as the
Recolour attribute op" (draw-mode-bar.js comment, fill-tool.js comment). It did not:
Recolour paints the whole cell under the pointer whatever the tool, while a draw mode
follows the brush size, the shape and the fill area and Mirror applies. The 2026-10-18
audit found that the one combination no drawing tool could write without pixels was
Ink and Paper together; the owner decided on 2026-10-19 to bring the mode back as a
third button.

## Data shape

- StateManager draw mode id: `'attributes'` (new id). The retired id
  `'attributes_only'` stays rejected (becomes Normal), so a preference or preset saved
  in the retired mode years ago does not suddenly come back in a different mode.
- PixelDrawRoutine.resolveUserMode: `'attributes'` -> DRAW_MODE.ATTRIBUTES_ONLY on both
  buttons (Inverse has nothing to swap). The primitive already exists and already does
  exactly this: _stampAttributes writes Ink and Paper unless "use existing", and
  _resolveTransparent resolves all four boxes (Bright and Flash too) to the value the
  page shows. Colour core: classifyCore already drops ATTRIBUTES_ONLY outside the core,
  as it drops INK and PAPER. GigaScreen: _applyGiga runs it on both screens with each
  screen's own colours. Indexed modes: _applyIndexed already treats it as a no-op.
- DrawModeBar MODES: new entry after Paper Recolour, icon `icon-dm-attributes`
  (index.html: both halves of the square, paper half lighter), name dm.attributes,
  hint dm.attributes.hint, effects FX.untouched / FX.coloursAll / FX.rightSame,
  needsAttributes: true. INVERSE_NO_EFFECT gains 'attributes'.
- i18n: dm.attributes, dm.attributes.hint in en + 12 locales. No placeholders.

## Screen modes

- Standard ULA, multicolour 8x1/8x2/8x4, ULAplus (and 8x1), ULANext: works (cells have
  attributes). In ULAplus Bright+Flash are the CLUT, in ULANext the paper bank - kept or
  written exactly as in Ink Recolour.
- GigaScreen and MultiGiga: both screens' attributes, no pixel on either screen.
- Timex hi-res and Timex hi-res GigaScreen, Layer 2 (256/320/640), LoRes and Radastan:
  hidden from the pop-up (needsAttributes), and a mode standing in it falls back to
  Normal, as Ink and Paper Recolour do.

## Tests (written first, seen failing)

- tests/attributes-draw-mode.test.js (Node): StateManager accepts 'attributes' and
  still rejects 'attributes_only'; resolveUserMode gives ATTRIBUTES_ONLY on both
  buttons and under Inverse; for brush (sizes 1 and 5), spray, pattern brush, filled and
  outline rectangle, ellipse, line, Bezier, pixel fill and gradient: no pixel on the
  layer changes, every cell Ink Recolour would touch gets all four attributes and no
  other cell changes; each of the four use-existing boxes keeps that attribute; Paper
  box on gives exactly Ink Recolour's result, Ink box on gives Paper Recolour's;
  right button same as left; stamp commit; colour core; GigaScreen both screens;
  multicolour 8x1; ULAplus; ULANext; indexed no-op.
- tests/draw-mode-matrix.test.js, draw-preview-parity, stamp-draw-mode,
  brush-cursor-colour: 'attributes' added to the mode lists (preview == commit).
- tests/browser/attributes-draw-mode.spec.js: the pop-up offers it after Paper
  Recolour with the tooltip; picking it and clicking the canvas with either button
  recolours with all four and leaves the pixels; status bar "Draw Mode: Attributes
  Only" and the Inverse no-effect wording; Mirror recolours the mirrored cell; the
  choice survives a reload and a workspace preset; withdrawn in Layer 2, Timex hi-res
  and LoRes with fallback to Normal.
- Existing specs that list the six modes (draw-modes.spec.js, shell.spec.js) list seven.

## Docs

- Manual 40-colour.md (+12): the Ink Recolour paragraph names Attributes Only; the
  Inverse paragraph lists it among the modes Inverse does not change. Draw-mode table
  is generated (describeModes).
- docs/ZX_PAINTBRUSH_COMPARISON.md row "Drawing (pixels) switch" -> Same; totals line
  and Part 3 item 13 updated with count-verdicts.js.
- .claude/parity/LOG.md entry.
