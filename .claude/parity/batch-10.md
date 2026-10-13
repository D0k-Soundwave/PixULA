# Batch 10 - Text and fonts

Group C, branch `parity-c`. Parts: 10A, 10B, 10C, 10C2, 10C3 (one session each; 10C was split by the Opus
plan review on 2026-10-13). After 10C3 comes the group C check-off (Opus).
Read `RUNBOOK.md` first. Figures from the ZX Paintbrush help are
[P, ZX Paintbrush 2.6.4 help, read 2026-10-08].

Comparison doc rows: Windows text tool; Sinclair text tool; CHX big fonts.

Help pages: `windows_text_tool`, `edit_windows_text`, `font_tools_bar`,
`sinclair_text_tool`, `sinclair_font_tool_bar`, `sinclair_font_tools_bar`,
`creating_editing_a_big_font_set`, `creating_editing_a_character_set`,
`shader_tool`, `character_selector`, `character_grid`.

## What ZX Paintbrush does

- Windows text tool: any font and size; left/centre/right; a vertical
  anchor (top, centre, bottom) for where the click places the text block;
  four directions; shading in four corner directions; contour. Drawn with
  set or reset dots, with or without background space.
- Sinclair text tool: click to get a flashing L cursor and type straight
  onto the picture (preview until Enter; Shift+Enter is a new line; cursor
  keys move; always insert mode). Three fonts for 4x8, 6x8 and 8x8, but the
  size stretches to any width and height; character and line spacing.
- CHX big fonts: characters from 8x8 up to 32x32 in 8-pixel steps; edit
  all characters as one map or one at a time; fill the map from a Windows
  font (size percentage, alignment); proportional widths with the shader
  tool (mark empty 8-pixel-wide columns on the left or right of a
  character; a character that is all shaded is left out).

## What PixULA has today

- Text tool `js/tools/text-tool.js`: system fonts, size, bold, italic,
  alignment, eight directions, mirror, shadow (`textShadow`, one
  direction, a mask offset-OR), outline; placed as a stamp
  (`SelectionService.startFloatingPasteFromMask` with font info); mask
  post-processing near the "Direction + shadow/contour" comment.
- ZX ROM font and library fonts at 4, 6 or 8 pixel advance
  (`js/data/zx-rom-font.js`, `js/services/font-service.js`,
  `js/utils/font-rasterizer.js`, `js/utils/font-probe.js`).
- Font Editor `js/ui/components/font-editor-dialog.js` with CHX read and
  write (`js/io/font-format.js`, `js/utils/font-codec.js`).
- Tests: `tests/text-layout.test.js`, `tests/text-mask-ops.test.js`,
  `tests/font-*.test.js`, browser `text-*.spec.js`.

## Decisions

Defaults:
- 10A extends the existing Text tool's options (no new tool).
- Sinclair typing (10B) is a Text tool option "Type on canvas": click
  places a flashing cursor; typing previews; Enter commits as one undo
  step (through the same stamp path, so draw modes and colours apply);
  Escape cancels. While typing, keys go to the text, not to shortcuts.
- The CHX work (10C) goes in the Font Editor.

OWNER: none known.

## Part 10A - Text tool: shadow directions, vertical anchor, set/reset dots

Build:
1. Shadow direction: down-right (today), down-left, up-right, up-left;
   shadow distance stays as it is.
2. Vertical anchor: the click point is the text block's top, centre or
   bottom (with the existing horizontal alignment, nine anchor points).
3. "Background" option: text drawn with its box's clear dots set to paper
   (the cell's background is cleared under the text) or left alone (today).
   Inverse (Batch 4) already gives reset-dot text: check it does, and add a
   test.
4. i18n, manual and translations, Playwright spec.

Tests: the four shadow directions' masks; anchors place the box where
expected; background option clears exactly the box; defaults byte-identical.

Done when: shadows go in four directions, the anchor is choosable, and text
can carry a cleared background.

## Part 10B - Type on canvas (Sinclair text)

Build:
1. Option "Type on canvas" on the Text tool. Click: a flashing cursor at
   the point (preview overlay, not the document). Typing inserts at the
   cursor; Backspace, Delete, Left/Right/Home/End move and edit;
   Shift+Enter adds a line; Enter commits; Escape cancels.
2. Font size as "character width" and "character height" in pixels
   (stretch the 4, 6 or 8 pixel font to any size, nearest-neighbour so dots
   stay square-edged), plus character spacing and line spacing.
3. Keyboard focus: while typing, tool and colour shortcuts are suspended
   (follow how dialogs stop shortcuts; consult Opus on the plan).
4. i18n, manual and translations, Playwright spec (type, edit, commit,
   cancel).

Tests: the layout function (pure) for stretched sizes and spacing; editing
operations on the text buffer; commit equals placing the same text with the
stamp path.

Done when: text can be typed straight onto the picture, stretched to any
size, with spacing, and committed or cancelled.

## Part 10C - CHX: fill from a font, proportional widths

Build:
1. Font Editor > New big font: character size in 8-pixel blocks (1 to 4
   each way) and "Fill from font": pick a system font, size percentage and
   alignment (left, centre, right); every character is rendered with the
   existing rasteriser (`js/utils/font-rasterizer.js`).
2. Shader: in the Font Editor's all-characters (map) view, mark 8-pixel-wide
   columns on the left or right of a character as empty; saving writes the
   narrower character; an all-shaded character is not written.
3. i18n, manual (`85-editors.md`) and translations, Playwright spec.

Tests: CHX written after fill has the right character count and sizes; a
shaded column reduces the stored width by 8; reading it back gives the same
characters.

Done when: a CHX font can be filled from a system font and given
proportional widths.

## After 10C

Batch 10 and group C are done. Update the comparison doc rows. Hand off to
the group C check-off (Opus): CHECKOFF.md, branch `parity-c`.

## Split of 10C (Opus plan review, 2026-10-13; owner answers in LOG.md)

- 10C (DONE): big-font data model, FontCodec v2, CHX read/write of whole characters with shading, guards, New Big Font, Fill from font.
- 10C2: the all-characters MAP view in which you can DRAW across every character (owner: yes), the SHADER tool (shade 8-pixel columns on the
  left / right of a character; saved narrower; a fully shaded character is not written; Space keeps a column), shading shown in the map and
  the single-character editor, buttons for keyboard / touch, a save summary ("N narrowed, M left out").
- 10C3: big and proportional fonts in the Text tool and Type on canvas (owner: yes): per-letter advance in BitmapText.layout / stretchLine and
  TextTool._buildLineMask; multi-byte rows; library labels such as "Name (16x16, proportional)".
