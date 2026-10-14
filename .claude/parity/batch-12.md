# Batch 12 - Files

Group D, branch `parity-d`. Parts: 12A (decisions), then 12B onwards as 12A
sets them. After the last part comes the group D check-off (Opus), which is
the final one.
Read `RUNBOOK.md` first. Figures from the ZX Paintbrush help are
[P, ZX Paintbrush 2.6.4 help, read 2026-10-08].

Comparison doc rows: TAP/BLK, TZX, PZX with loaders; Disk images; Nirvana
tiles (.btile); Archives and Warajevo tapes; Picture converter (the extras:
black-and-white mode, GIF frame picker - dithering was Batch 8); Data block
composer, memory and pulse editors, header changer; ASM and BIN export
settings; Change picture size; Print with preview; Options (whatever Batch
3 did not cover).

Help pages: `supported_files`, `fullysupportedfilesreadwrite`,
`partially_supported_files_read`, `partially_supported_files_writ`,
`file_saving_options_dialog`, `datablock_composer`, `memory_editor`,
`pulse_editor`, `header_changer`, `file_blocks_list_display`,
`file_attribute_editor`, `asm_file_settings_dialog`,
`bin_file_settings_dialog`, `change_size_dialog`, `print`,
`print_preview_dialog`, `picture_converter`,
`importing_a_picture_using_the_`, `options_dialog`. ZX Paintbrush's
`datablocks.chm` (in its install folder) covers the tape block tools.

## What PixULA has today

- Formats: `js/io/*-format.js` registered in `js/io/format-registry.js`;
  TAP and TZX with a BASIC loader that shows the screen
  (`tap-format.js`, `tzx-format.js`); SNA import; `.asm`, `.c`, `.bin`,
  `.atr` export in `js/io/dev-format.js` (fixed layout); GIF
  (`gif-format.js`, browser decode = first frame only).
- Tape Blocks dialog `js/ui/components/tape-block-dialog.js`.
- Import dialog `js/ui/components/import-dialog.js`.
- Canvas size comes from the screen mode (`ZX_SPECTRUM.WIDTH/HEIGHT`).
- Zero dependencies: no libraries may be added (CLAUDE.md). Anything
  needing a decoder must be written here or use what browsers provide
  (`DecompressionStream`, `ImageDecoder`) - check each browser supports it
  before relying on it.

## Decisions

OWNER - 12A asks all of these, one at a time, each with its cost.

## Part 12A - cost each item, then let the owner choose

This part writes no feature code.

1. For each item below, find out what it would take: the published format
   spec (source and date, tagged [P]), the files to write, whether browsers
   can do it with no library (check MDN browser support for any API, tagged
   [P] with the date), and a size in the units this plan uses (number of
   parts, one session each - tag it [C] from the parts it breaks into, or
   [A] if it is a guess, and say so).
   - PZX read and write.
   - Turbo loaders for TZX and PZX (a choice of loaders, as ZX Paintbrush
     offers).
   - Disk images: TRD and SCL (TR-DOS), DSK (+3), MGT and IMG
     (+D/DISCiPLE) - read screens from them and write screens to them.
   - Nirvana .btile tiles.
   - Archives: zip (browsers can inflate with `DecompressionStream`), rar
     and the other 28 formats (no browser decoder: would need a decoder
     written for PixULA), Warajevo TAP.
   - Tape tools: header changer, memory editor (hex edit of a block),
     data block composer, pulse editor.
   - ASM and BIN export settings: number base, prefixes, bytes per line,
     line or block layout, attributes mixed in.
   - Change picture size (add or remove space): PixULA's canvas is the
     screen mode's size, so this only means something if documents can be
     bigger than a screen - say what that would change.
   - Print with preview: a print stylesheet and `window.print()`, or a
     generated PDF-like page.
   - Picture converter extras: black-and-white mode; GIF frame picker
     (needs frame decoding: `ImageDecoder` support per browser).
   - Options left after Batch 3 (compare the Options row with what exists).
2. Ask the owner, one item per question (RUNBOOK section 6): build it, build
   part of it (say which part), or leave it out. Say plainly what each
   gives them and what it costs. Recommended option first, judged by use:
   is it something a Spectrum artist needs from a drawing program?
3. Write the answers under "Decisions" above, and rewrite the rest of this
   file as parts 12B, 12C, ... (one session each, in the order the owner
   prefers, each with Build / Tests / Done when, in the style of the other
   batch files). Items the owner leaves out: mark their comparison rows
   with the reason (verdict stays Missing or Partial; write "left out by
   choice, <date>: <reason>").
4. Commit the batch file and LOG it. Hand off to 12B, or to the group D
   check-off if nothing was chosen.

Done when: every item has an owner decision and the chosen work is split
into parts.

## Parts 12B onwards

Written by 12A.

## After the last part

Batch 12 and group D are done. Update the comparison doc rows. Hand off to
the group D check-off (Opus): CHECKOFF.md, branch `parity-d`.

## Scope decision (owner, 2026-10-14)
The owner asked for parity with the ATTRIBUTE tools; the series had grown to the whole program. Instruction: continue only with what is directly tied to attribute parity.
Left out by choice: PZX, turbo loaders, disk images, Nirvana tiles, archives, tape block tools, change picture size, print, converter extras, remaining Options.
(Earlier answers choosing PZX, TRD/SCL/DSK, Nirvana and zip are superseded; costs stay in docs/BATCH12_COSTS.md.) ASM/BIN export settings: asked separately (attributes mixed in).
Answers given: PZX build / turbo loaders leave out / TRD+SCL+DSK / Nirvana build / zip only (all superseded by the scope decision above); palette keys: leave menu only; stamp flip and shift gaps: leave as recorded differences; ASM/BIN settings: leave out; 3-point parallelogram: build (done).
