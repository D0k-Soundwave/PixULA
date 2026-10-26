# Batch 6 - Palettes

Group B, branch `parity-b`. Parts: 6A, 6B (one session each).
Read `RUNBOOK.md` first. Figures from the ZX Paintbrush help are
[P, ZX Paintbrush 2.6.4 help, read 2026-10-08].

Comparison doc rows: Four palettes P0 to P3 and four ULAplus palettes U0 to
U3; Palette inverter; Edit, load and save palettes (the ULAplus TAP part);
Edit the standard Spectrum colours; ULAplus CLUT grid (the 0 to 3 keys).

Help pages: `palette_bar`, `activate_palette_0` to `activate_palette_3`,
`palette_inverter`, `edit_full_color_palette`,
`load_full_color_palette_file`, `save_full_color_palette_file`,
`load_ula_plus_palette_file`, `save_ula_plus_palette_file`,
`changing_the_default_zx_spectr`, `set_standard_zx_spectrum_palet`,
`options_dialog` ("Colour options"), `ula_plus_grid`, `ulaplus_bar`.

## What ZX Paintbrush does

- Four global palettes (P0-P3) and four ULAplus palettes (U0-U3), switched
  with one click or key. P0 is the working palette and is reset when a file
  is loaded (an option).
- Palette inverter: swaps the INK and PAPER halves of each CLUT. To invert a
  ULAplus picture: palette inverter, then the attribute inverter.
- ULAplus palette save/load as a TAP: the help says 151 bytes. The sample
  files installed with ZX Paintbrush are 176 bytes [M, `ls -la` of
  `C:\Program Files (x86)\ZX-Paintbrush\*.tap`, 2026-10-08]. A hex dump of
  `rgb.tap` shows why [M, `xxd`, 2026-10-08]: a 19-byte header (Program,
  name "64colour" after an INVERSE 1 control code, length 151), then a
  151-byte BASIC program: line 0, `RANDOMIZE USR` to a small machine-code
  routine in a REM, which writes 64 palette bytes to the ULAplus ports
  (0xBF3B, 0xFF3B); the 64 bytes sit just before the line's final 0x0D. So
  "151" is the program, and the file is 21 + 2 + 1 + 151 + 1 = 176 [C].
- Edit the standard Spectrum colours: change, load from a .pal file, or
  reset the 15 colours the standard modes use. Permanent until reset.
- ULAplus CLUT grid: keys 0 to 3 pick the CLUT.

## What PixULA has today

- `js/core/color-manager.js`: palette as data. ULAplus registers
  (`getUlaplusRegisters`, `setUlaplusRegisters`, `setUlaplusRegister`,
  `isUlaplusPaletteEdited`), Next palette (`isNextPaletteEdited`,
  `_deriveNextPalette`), `getPalette`, `getRGB`, `_writePaletteTokens`
  (the `--zx-*` CSS variables), `getClut`/`setClut`.
- `ZX_PALETTE` in `js/core/constants.js` is the fixed standard palette, the
  single source of the 16 colours.
- Palette editor: `js/ui/components/palette-editor-dialog.js` (ULAplus and
  Next modes), `js/utils/palette-ops.js`, `.pal` and `.npl` files
  (`js/io/next-palette-format.js`), ULAplus registers inside a 6976-byte
  .scr (`js/io/scr-format.js`).
- TAP writing with a BASIC loader: `js/io/tap-format.js` (reuse its block
  and checksum helpers).
- Projects keep both palette register files (`js/io/project-format.js`).
- Digit keys are taken (`js/core/input-handler.js`): 1-8 pick ink,
  Shift+1-8 paper, Alt+1-9 apply presets (`PresetService.applyByDigit`),
  0 and Alt+0 zoom to actual size. Ctrl+digit is the browser's tab switch.

## Decisions

Defaults:
- Palette slots belong to the document (saved in projects and autosave):
  four slots for the ULAplus palette and four for the Next palette. Slot 1
  is the one in use when a file without slots is loaded. Switching a slot
  changes the palette the picture is shown with, never the picture's
  attribute bytes. One undo step per switch.
- Fixed-palette modes (standard, multicolor, GigaScreen, Timex) have no
  slots: their colours are the standard colours (part 6B makes those
  editable).
- Palette inverter: ULAplus only (swap entries 0-7 and 8-15 of each of the
  four CLUTs). Next: consult Opus during plan review (its ink and paper
  ranges depend on the ULANext format); if there is no clean meaning, leave
  it out and say why in the doc row.
- Standard colours: a Preferences setting (per browser, like themes), with
  edit, load .pal, and reset. They change what is shown and image exports
  (PNG, GIF, BMP, JPG); they never change .scr/.tap bytes.

OWNER - ask in 6A, before building the keys:
1. CLUT keys. Every plain and Alt digit is taken (see above), so ZX
   Paintbrush's 0-3 cannot be copied as is. Before asking, test candidate
   combinations in Chrome, Edge and Firefox on Windows with a Playwright
   key press (Alt+Shift can switch the Windows keyboard language;
   Ctrl+digit switches tabs). Option 1 (recommended): the first candidate
   that every browser passes to the page, in this order: Ctrl+Shift+1 to 4,
   then Alt+Shift+1 to 4. Option 2: no CLUT keys; the rail's CLUT picker
   only. Palette slots get menu items only, no keys. Record the answer here.

ANSWERED 2026-10-10 (owner): option 1, Ctrl+Shift+1 to 4. Tested 2026-10-10 in Chrome only (Playwright key press,
channel chrome): all four combinations of both candidates reached the page with ctrl+shift+Digit codes. Edge was not installed
and Firefox was not installed; Playwright injects events so it cannot see Windows-level interception. Match on e.code
(Digit1-4), not e.key (Shift changes the key on some layouts).

## Part 6A - Palette slots, palette inverter, CLUT keys

Build:
1. Slot state in `ColorManager` (or a small `PaletteSlots` service if
   ColorManager grows too large - consult Opus): four register files per
   palette kind, the active index, get/set/switch, events. Slot 1 = the
   current palette, so nothing changes for existing documents.
2. Projects and autosave carry the slots; old projects load with slot 1 =
   their palette and slots 2-4 copies of it.
3. UI: Image > Palette submenu with Slot 1-4 (radio) and Invert palette;
   the palette editor shows which slot it edits.
4. Palette inverter as above, one undo step.
5. CLUT keys per the OWNER answer, listed in the Keyboard Shortcuts dialog.
6. i18n in 13 locales; manual (`40-colour.md` palette section) and
   translations; Playwright spec.

Tests: switching slots changes the shown RGB but not the attribute bytes;
slots round-trip through a project; inverting twice restores; the keys pick
the CLUT only in ULAplus modes.

Done when: four slots per palette switch with one click, the inverter works
in ULAplus, and the CLUT has keys (or the owner chose none).

## Part 6B - Standard colours and the ULAplus palette TAP

Build:
1. Standard colours: Preferences section with the 15 visible colours (16
   indices; black is shared) as colour pickers, "Load .pal" (reuse the .pal
   reader; a ZX Paintbrush .pal is 256 bytes [M, `Brights.pal`, 2026-10-08]
   - decode its layout from that sample and record it [M] in the reader's
   header comment), and "Reset to standard". Applied through ColorManager
   so the rail, canvas, CSS tokens and image exports all follow; `ZX_PALETTE`
   stays the default and the reset target.
2. ULAplus palette TAP: File > Export > ULAplus palette (.tap) writes a
   176-byte TAP as described above, with a loader routine written for
   PixULA (do not copy ZX Paintbrush's bytes; write the routine from the
   ULAplus port spec and comment it). Import reads any TAP whose program
   block carries 64 palette bytes in that place: ZX Paintbrush's sample
   files (`rgb.tap`, `c64.tap`, ...) and PixULA's own. Mandatory Opus
   consult on the byte layout.
3. i18n in 13 locales; manual (`80-files.md` and Preferences) and
   translations; Playwright spec.

Tests: every ZX Paintbrush sample TAP (copy two into `tests/fixtures/` only
if their licence allows - otherwise build a test TAP in the test from a
known palette) imports to the expected 64 bytes; PixULA's TAP re-imports
identically and is 176 bytes; standard colours change a PNG export and not
an SCR export; reset restores `ZX_PALETTE`.

Done when: the standard colours can be changed, loaded and reset, and
ULAplus palettes save and load as TAP files that ZX Paintbrush's samples
also open in.

## After 6B

Batch 6 is done. Update the comparison doc rows, then hand off to Batch 7
part 7A.

## 6B owner answers (2026-10-10)

- Bright black stays the same as black: 15 editable standard colours (recommended option).
- A Save .pal button is added to the Preferences standard-colours section (256-byte ZX Paintbrush layout).
- 6B Opus review corrections recorded in the LOG: there is no File > Export submenu (the TAP is a File leaf next to Save Palette); a 256-byte .pal opened via File > Open stays a Next palette, ZX Paintbrush's layout is read only from Preferences.
