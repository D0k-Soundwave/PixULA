# Feature: coloured CHX characters (owner decision 2026-10-19: keep, edit AND type in colour)

A CHX big font set marks each character transparent (1) or coloured (0). A coloured character
stores one ZX attribute byte after the 8 bitmap bytes of each of its 8x8 blocks (layout in the
header of js/io/font-format.js: RECOIL's DecodeChx and the ZX-Blockeditor "Colour character
map" of 9 * width * height bytes). PixULA drops those bytes today and saves every character
transparent. After this feature a coloured character is kept, shown, edited, saved and typed.

The coloured layout comes from the published format description only. It is NOT checked
against a file saved by ZX Paintbrush (the owner declined to make sample files on 2026-10-13);
the comparison row, the format header and the manual say so.

## Data shape

- Per glyph `colours[i]`: `null` (uncoloured - "none": the Text tool uses the attribute bar)
  or a `Uint8Array(cols * rows)` of ZX attribute bytes, one per 8x8 block of the FULL
  character cell, in CHX block order (left to right, then down). cols = width / 8,
  rows = height / 8. Bit layout = the Spectrum's: ink 0-2, paper 3-5, Bright 6, Flash 7.
- A CHX character is coloured as a whole (one flag per character), so a character cannot mix
  coloured and uncoloured blocks. The first block given attributes colours the whole
  character with them; later clicks change one block; Remove attributes makes the character
  uncoloured again.
- Only fonts whose width is a whole number of 8-pixel columns take attributes (as shading).
- FontService: `colours[]` parallel to `glyphs[]` and `shade[]`; getColours, hasColours,
  setBlockAttr(code, bx, by, attr), setAllBlocks(code, attr), clearColours(code); carried by
  setCoverage, copy / paste glyph (resized at the top-left), flip H (block columns mirror),
  toDocument / loadDocument / snapshot / restore / library; reset by resetToROM, newBigFont.
- FontCodec: colours ride in field `c` (base64, per glyph one flag byte then cols*rows
  attribute bytes). Present only when some glyph is coloured, and then the payload is
  version 2. An uncoloured font encodes exactly as before (v1 for a classic font).
- FontHistory snapshots carry the colours (their `bytes` count them).
- Project files hold no font (fonts live in the FONTS store: the working font and the
  library, both through FontCodec), so "project and autosave font data" = FontCodec.

## File I/O (js/io/font-format.js)

- Import: a coloured record's attribute bytes are kept per block. A character smaller than the
  font is padded: its missing blocks get attribute 56 (0x38, the Spectrum's default: black Ink
  on white Paper, no Bright, no Flash), which looks the same as an uncoloured block.
- Export: a coloured character is written transparent = 0 with 9 bytes per block (8 bitmap +
  attribute), only its stored (unshaded) columns. An uncoloured character is written exactly
  as today, so an uncoloured font saves byte-identical (pinned by a test written first).
- CH4 / CH6 / CH8 / CHR and the ASM / C / BIN dumps cannot hold attributes: the export status
  line says how many coloured characters lost their attributes.

## Font Editor

- Each block is drawn in its own Ink and Paper (Bright picks the bright colour) in the glyph
  grid, the one-character editor and the All characters map. A flashing block gets a small
  corner mark in the one-character editor.
- New mini tool Attributes (both surfaces): a click on a block gives it the attribute bar's
  Ink, Paper, Bright and Flash (the first click on an uncoloured character colours all its
  blocks). Button Remove attributes: the character back to uncoloured. Both are one Undo step
  each (FONT_CHANGED -> the dialog's FontHistory). A state line says whether the character has
  its own attributes.
- Refused with a reason where the attribute bar has no Ink/Paper/Bright/Flash (Timex hi-res,
  Layer 2, LoRes) and for a font that is not a whole number of 8-pixel columns wide.

## Text tool

- New option Attributes: "Attribute bar" (default, today's behaviour) | "Own attributes".
  Shown only for a saved font that has coloured characters, in a mode with 8x8 attribute cells
  (Standard, ULAplus, ULANext, GigaScreen). Hidden in multicolour 8x1/8x2/8x4, ULAplus 8x1,
  Timex hi-res and its pair, Layer 2 and LoRes.
- With Own attributes, each coloured letter's blocks are placed with their own attributes and
  uncoloured letters (and every cell no coloured block covers) are drawn as today, with the
  attribute bar and the draw mode. Both the stamp and Type on canvas.
- It needs every coloured block to land exactly on 8x8 cells. Refused with a reason (hint row,
  the choice greyed, the text drawn with the attribute bar) when:
  - effects: Direction other than 0, a mirror, Shadow, Contour or italic (they move pixels
    off the blocks);
  - geometry: a block edge is not on a multiple of 8 in the text block (character size not a
    whole multiple of the font's, spacing, centred / right alignment, vertical layouts with
    letters of different widths) or two coloured blocks would share a cell.
- The text block is put on the cell grid (as an own-attributes stamp is) so blocks line up
  with the picture's cells.
- Implementation: the text tool builds `attrs` + `attrGrid` (8x8, origin 0) for the stamp /
  typing data and sets stamp option `uncoloured: 'rail'`; SelectionService._forEachStampWrite
  draws a null cell of such a stamp as a Pixels stamp would (today a null cell is a hole,
  which stays the rule for every other stamp). A coloured text stamp is an own-attributes
  stamp, so the Transform panel refuses scale / rotate / warp for it with its existing reason.
- Pure helpers in BitmapText (Node-tested): blockRects (where each glyph block lands in the
  output mask) and attrCells (rects -> per-cell attributes or a refusal).

## Figures

- [C] Codec cap check: heaviest font 256 glyphs x 32x32 = 32,768 bytes of glyphs (43,692
  base64) + 512 shading bytes (684 base64) + 256 x (1 + 16) = 4,352 colour bytes (5,804
  base64) = about 50.2 KB of JSON, under FontCodec.MAX_JSON_BYTES (64 KB, existing).
  Measured after building [M, 2026-10-20, Node]: 50,255 characters (44,444 uncoloured).
- [M, 2026-10-20, Playwright, this machine's Chrome] All characters map repaint of a 512 x 512
  map: 1.6 ms before, 3.0 ms with the colour hook and nothing coloured, 9.6-10.0 ms with every
  glyph coloured; once per stroke or attribute change, inside a 16.7 ms frame.
- [C] Undo: the heaviest snapshot grows from 33,280 (256 x (128 + 2)) to 37,376 bytes (+ 256 x 16 attribute bytes); FontHistory's 2 MB cap
  (existing) then holds about 56 steps of it (2,097,152 / 37,376) instead of 63.
- Attribute 56 (0x38) for padding blocks: the Spectrum's power-on attribute [P, ZX Spectrum
  ROM: ATTR-P set to 56 at start-up, Logan and O'Hara, "The Complete Spectrum ROM Disassembly", 1983]. A
  choice, not a limit.
- No new limits.

## Tests (written first, seen failing)

- tests/chx-colour.test.js (Node): pin that an uncoloured big and classic font export
  byte-identical to before (bytes captured from the current code first); coloured import keeps
  attributes; padding blocks 56; export writes transparent 0 + 9-byte blocks, only stored
  columns; export -> import -> export identical; FontCodec round trip with colours, classic
  uncoloured payload unchanged (v1, no `c`); FontService ops (setBlockAttr first-click rule,
  clearColours, coverage, paste, flipH, snapshot/restore, refusals); BitmapText.blockRects /
  attrCells; the stamp write plan with `uncoloured: 'rail'` (null cell -> rail writes,
  coloured cell -> own attributes) and without it (null cell writes nothing, unchanged).
- tests/browser/chx-colour.spec.js (Playwright): open a coloured CHX in the Font Editor and
  see block colours; Attributes tool colours a block, Undo takes it back; Remove attributes;
  save to library; Text tool shows the choice only for that font and only in 8x8 attribute
  modes; stamp and Type on canvas place a coloured letter's attributes and an uncoloured
  letter in the bar's; refusal with Direction / centred misalignment; export CHX keeps bytes.
