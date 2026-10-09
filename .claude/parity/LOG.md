# Parity work log

Newest entry at the bottom. One entry per session. Format:

    ## <YYYY-MM-DD> - Batch <N> part <X> - <title> - <done | partial | blocked>
    Model: <model>. Branch: <branch>.
    Commits: <hash> <subject> (one per line)
    Done: <items finished>
    Left: <items not finished, and where they went - "none" if none>
    Plan corrections: <what you changed in the batch files, and why - or "none">
    Opus: <question -> answer, one line each - or "none">
    Owner: <questions asked -> answers - or "none">
    Flaky tests: <names - or "none">
    Next: <the part or check-off you handed off to>

---

## 2026-10-08 - setup - instructions written - done
Model: Opus. Branch: parity-a (from main at 05f5256).
Done: RUNBOOK.md, CHECKOFF.md, batch-02.md to batch-12.md, count-verdicts.js,
chm2txt.py; ZX Paintbrush help text copied to .reference/zx-paintbrush-help/
(gitignored). Batch 1 (Bright and Flash) already shipped in 0.1.0-alpha.17.
Plan corrections: PLOT coordinates and grid colours moved from Batch 12 to
Batch 3 (they belong with the pointer readout and the grids).
Next: Batch 2 part 2A.

## 2026-10-08 - Batch 2 part 2A - attribute commands - done
Model: Haiku. Branch: parity-a.
Commits: 9d74615 feat: invert, erase and flip cell attributes on a selection or the whole picture
83aa790 feat: Image > Attributes menu with invert, erase and flip, in 13 languages
(the docs and log commit is the third commit on this branch, after these two)
Done: TransformService invertAttributes, eraseAttributes, flipAttributesHorizontal,
flipAttributesVertical, attributeCommandsBlocked (service-side guard: no cell
colours, stamp layer, locked layer). Image > Attributes submenu with the four
commands, greyed out with the reason on the Attributes row. 8 i18n keys in 13
locales. Manual paragraph in 40-colour.md, all 13 languages, check:manual passes.
Tests: tests/attribute-commands.test.js (Node, failed first); tests/browser/attribute-commands.spec.js
(3 specs). Comparison doc: the four rows set to Partial (stamp not yet), totals
recounted 64 below parity (28 missing, 36 partial).
Left: none in 2A. Stamp support for the attribute commands is open (see Decisions in batch-02.md).
Plan corrections: Decisions list in batch-02.md (ULAnext rule, stamp greyed out,
bounding-rectangle selections). Nothing else changed.
Opus: plan review (Plan agent, opus) -> change. Corrections applied: clip and
mirror suspended via suspendMirror; service-side guard; stamp test on the
layer (isStamp), not only isFloating; no-op cells skipped; menu reason on the
parent row (disabled rows take no pointer events); single-colon action ids;
ULAnext rule = swap ink/paper, keep bright/flash; stamp = disable with hint.
Not applied: lasso/wand mask cell selection (bounding rectangle, as Flip does).
Owner: none asked.
Flaky tests: dialog-listeners.spec.js "opening and closing each dialog leaves no bus
listeners behind" failed once in the full browser run (file:spriteEditor listener
count grew by 2); passed alone twice. Not touched by 2A.
Observed, not fixed (from the Opus review, not verified in a test): when a
stamp layer is the current layer, Image > Flip may write into the stamp layer
itself. Worth a check before 2B touches the same functions.
Keyboard-only users do not hear the reason for a greyed-out Attributes item:
the reason is a mouse tooltip on the parent row. A keyboard-reachable note
row is not built.
Next: Batch 2 part 2B - dot commands and the Shift pad.

## 2026-10-08 - Batch 2 part 2B - dot commands and the Shift pad - partial (service half done; split as 2B2)
Model: Haiku. Branch: parity-a.
Commits: a3a794e feat: flip dots only, invert dots and colours, and shift with dots, colours or both
2299dbd docs: record 2B owner decisions and review corrections
Done: TransformService.flipDotsHorizontal/flipDotsVertical (dots only, colours stay in
cells; indexed and Timex delegate to today's flips); invertDotsAndColours (whole cells,
see-through upper-layer cells skipped, one batch, suspendClip); shift(direction, amount,
wrap, content) with eight directions, content 'both' / 'dots' / 'colours', diagonals as
two passes, returns whether anything changed. _rewriteCells split into _planCellWrites and
_applyCellWrites (PixelDrawRoutine.beginBatch does not nest). Tests: tests/dot-commands.test.js
(new, failed first, now passes); tests/transform-shift.test.js rewritten for the owner's
paper rule, its ColorManager stub gained hasCellAttributes(). node tests/run-all.js: ALL TEST
FILES PASSED.
Left: panel, pad, Image > Dots menu, i18n (13 locales), manual, Playwright spec, speed timing
of shift on Layer 2 640x256, comparison doc rows, FIGURES.md. All moved to Part 2B2 in
batch-02.md.
Plan corrections: batch-02.md 2B: owner decisions (whole-cell Dots and colours with paper,
one-pixel shift kept as Dots only); Opus corrections list recorded; Part 2B2 added.
Opus: plan review (Plan agent, opus) -> change. Accepted: _rewriteCells split (no nested
batch); dot flips via PIXEL_ONLY/ERASE, never _applyBufferWithAttrs (colours and
see-through cells); inverter skips unaltered upper-layer cells and suspends clip; shift
amount in pixels, colours move cells; diagonals as two passes; 3x3 pad keeps outline style.
Not accepted as stated: none. Stamp menu routing for Dots items deferred to 2B2 (Opus item 6
left open for the panel build).
Owner: "Dots and colours" on a cell step moves paper too (asked after a clarification
round; answered: yes, and the one-pixel shift stays as "Dots only"). Asked and open: the
keyboard arrow nudge's behaviour (in batch-02.md, OWNER).
Logged, not fixed: Image > Flip, Rotate and Invert write into the stamp's preview cells
while a stamp floats (Opus confirmed the code path: input the Transform panel avoids). Fix
with a test in its own part. Image > "Invert Colours" inverts dots only: misleading name.
Flaky tests: none seen in this part (the browser suite was not run: the pad and menu are not
built yet).
Next: Batch 2 part 2B2 - Shift pad, Image > Dots menu (same branch).

## 2026-10-08 - Batch 2 part 2B2 - Shift pad, Image > Dots menu - done
Model: Haiku. Branch: parity-a.
Commits: (see git log; the 2B2 commits follow 08f9570 on this branch)
Done: Transform panel Move select (Dots and colours / Dots only / Colours only), hidden
without cell colours, disabled with a visible hint while a stamp floats. Step locked to one
cell while Move is Dots and colours or Colours only; the user's own step choice is remembered.
3x3 shift pad with the four diagonals (Helpers.buildDirPad({nine: true}), eight new
icon-dirpad9-* symbols in index.html, css .dir-pad--nine clips each zone to its ninth). Diagonals
go through TransformService.shift; on a floating stamp they are two transformStamp calls.
Image > Dots submenu (Flip Horizontal, Flip Vertical, Invert Dots and Colours) with
TransformService.dotCommandsBlocked() and dotsFlip(): flips route to transformStamp on a
floating stamp, grey out on a stamp with its own colours; Invert greys out on a floating stamp,
in modes with no cell colours, and on locked layers, each reason on the Dots row.
Service bug fixed (correction 1 of the Opus review): whole-cell shift with content both moved
dots inside the exact selection but colours by cell; now both use the cells the selection touches.
i18n: 17 keys in 13 locales. Manual: "Dots" section in 40-colour.md in 13 languages; check:manual passes.
Tests: tests/shift-cell-rounding.test.js and tests/dots-menu-routing.test.js (Node, failed first);
tests/browser/transform-shift-pad.spec.js (5 specs); tests/browser/image-dots-menu.spec.js (3 specs);
tests/browser/dirpad-hold-repeat.spec.js: the one-pixel tap now selects Dots only first (the default
now moves a cell, so the test keeps its meaning).
Speed: [M] in docs/FIGURES.md. Layer 2 640x256 shift before 29.0-30.6 ms, after 29.6-31.0 ms per call
(no measurable change); multigiga_8x1 diagonal cell step 12.2-13.3 ms per call.
Comparison doc: rows Pixels and attributes inverter, Flip pixels, Roll or scroll pixels only, colours
only, both moved from Missing or Partial to Partial (see the rows, dated 2026-10-08). Totals:
64 below parity (24 missing, 40 partial). The Part 1 count line was stale (17 partial, 13 missing
in the file; script says 21 and 9) and was copied from the script output.
Arrow keys: built. They follow the Move choice (owner answered 2026-10-08: follow it). Tests:
tests/browser/transform-shift-pad.spec.js, "the arrow keys follow the Move choice"; the 52 existing
keyboard and nudge specs pass.
Left: stamp support for the attribute commands (2A); the Change Attributes dialog (2C); the stamp-flip
bug in Image > Flip, Rotate and Invert (logged in 2B, not fixed). The Image > Dots flip on a stamp
is routed correctly; the older Image > Flip is not.
Plan corrections: batch-02.md 2B2: decisions recorded with costs (default Move, whole-cell rounding,
stamp disables Move, Dots flips on a stamp). The Opus review's correction 10 (the existing one-pixel
tap test) was applied by selecting Dots only in that test.
Opus: plan review (Plan agent, opus) -> change. Accepted: the service bug (1), the step rule (2), stamp amounts per axis (3), _sync placement (4), visible hints (5),
Move tooltip attributes (6), nine-zone pad with its own symbols (7), Dots menu state with reasons (8),
Node tests first (9), spec updates (10), speed on the multigiga path (11), manual regeneration (12).
Owner: "Should the arrow keys follow the Move choice?" -> "Follow the Move choice (Recommended)".
Flaky tests: none seen in this part. The full browser suite failed once on tooltip.spec.js
"every two-stage control" (tp-shift-move missing from the tooltip selector); fixed, and the spec passes.
Next: Batch 2 part 2C - Change Attributes dialog (same branch).

## 2026-10-08 - Batch 2 part 2C - Change Attributes dialog - done
Model: Haiku. Branch: parity-a.
Done: TransformService.previewChangeAttributes / changeAttributes (one shared plan: the
count shown is the count written; cells matched on the non-Any fields; kept fields carried;
GigaScreen B fields kept; input cleaned: colours 0-7, booleans). Dialog
js/ui/components/change-attributes-dialog.js opened by Image > Attributes > Change...
(row attr-change, action image:attrChange). Layout per mode: GigaScreen Screen A / Screen B
groups and one Flash; ULAplus CLUT 0-3 in place of Bright and Flash; other cell modes Bright
and Flash. Live count, OK = one undo step, Cancel / Escape / close write nothing. Swatches
coloured via ColorManager.attrToIndices (ULANext paper bank follows the row's bright).
i18n: 14 keys in 13 locales (plural.changeAttrCells in the tagged form). Manual: Change...
paragraph in 40-colour.md and its 12 translations; build-manual and check:manual pass.
Tests: tests/change-attributes.test.js (Node, failed first, now passes);
tests/browser/change-attributes-dialog.spec.js (6 specs); tests/browser/attribute-commands.spec.js
extended to the fifth row. Full suite: run-all ALL TEST FILES PASSED; npx playwright test 600 passed.
Opus plan review (Plan agent, opus) -> change. Question: GigaScreen layout. Answer: two row
groups (Screen A, Screen B) plus one Flash that sets both screens; not "both must agree",
not "A writes both". All 13 corrections applied (shared plan, full-cell targets, input clean-up,
fixture fix with PIXEL_ONLY, undo and Giga tests, CLUT booleans, swatch banks, tooltip
SELECTOR not needed, Stamp scope label dropped).
Changed from the batch file: no "Stamp" scope label (the dialog does not open while a stamp floats;
recorded in batch-02.md).
Comparison doc: row "Change attributes dialog" stays Partial, text updated. count-verdicts: 64 below
parity (24 missing, 40 partial), unchanged.
Owner decisions: none needed.
Observed, not fixed: js/i18n/hu.js 'view.attributes' reads 'Attributumok mutatasa' (no accents,
not a correct Hungarian phrase; from an earlier part). PixULA_Distilled/PixULA.html is an untracked
release copy without the new script tag; it is generated, not edited.
Still open (carried): stamp support for the attribute commands (2A); Image > Flip, Rotate and Invert
writing into a floating stamp's cells (2B, logged, not fixed).
Next: Batch 3 part 3A (same branch).

## 2026-10-09 - Batch 3 part 3A - Colours off, Stop flashing, Colour grid - done
Model: Sonnet (the owner switched the model for this part; the plan and the build ran on it). Branch: parity-a.
Commits: 4009df4 feat: display-only Colours off, Colour grid and Stop flashing in the compositor
d7cfd38 feat: View menu Colours Off, Stop Flashing and Colour Grid switches in 13 languages
6ec6161 test: browser spec for the Colours Off, Stop Flashing and Colour Grid switches
2b37c59 docs: batch 3 part 3A comparison rows
0b47d61 fix: view switches follow the review - flicker greys, safe export render, boot order, greyed ticked rows
(the log and docs commit follows)
Done: three display-only switches. StateManager.getDisplayView / setColoursOff / setStopFlashing /
setColourGrid with one EVENTS.DISPLAY_VIEW_CHANGED carrying all three (Colours off and Colour grid
exclude each other in the setters). LayerManager.setDisplayView, _refreshDisplayFlags,
displayViewAvailability (the one place that decides which switch a mode can show), _cellInk and
_cellPaper (the one colour rule, replacing the five inline FLASH swaps), _syncFlashClock /
_stopFlashClock (the clock stops while Stop flashing, Colours off or Colour grid applies), the
GigaScreen grey levels, and stillImageData now renders the real picture with the normal flash phase
for exports (try/finally, flushes queued cells first). View menu rows with checked state, greyed out
with a tooltip reason per mode, tooltips follow a language change. Remembered per browser (Storage keys
viewColoursOff, viewStopFlashing, viewColourGrid, cleared by Reset all); applied in _initManagers before
anything is drawn. 6 i18n keys in 13 locales. Manual: "Seeing the dots" section in
20-attribute-clash.md in 13 languages; build-manual and check:manual pass.
Tests: tests/display-view.test.js (Node, failed first on setDisplayView); tests/browser/display-view.spec.js
(10 specs, including a real PNG and animated GIF compared byte for byte, keyboard, reload). Full run:
run-all ALL TEST FILES PASSED; npx playwright test 610 passed.
Speed: [M] in docs/FIGURES.md; compose cost unchanged within noise (standard_ula 0.34 -> 0.33 ms).
Left: none in 3A. Part 3B is next.
Plan corrections: batch-03.md Decisions list extended. Grid visibility is not persisted today (only grid
snap is), so the batch file's "like grid visibility" was wrong; the switches follow the grid-snap pattern.
Stop flashing is disabled in more modes than the batch file listed (only fixed-16 palettes flash). Also
removed the unused CanvasSystem.renderCell and fixed js/i18n/fr.js, which this part had committed with CRLF
line endings (the review caught it; it is LF again).
Opus: plan review SKIPPED by the owner's choice (the plan ran once on Sonnet); the owner asked for an Opus
review of the finished build instead (Plan agent, opus) -> change. Seven corrections, all applied: fr.js line
endings; greyed-out ticked rows looked active (css); Flicker under Colours off now shows the grey levels and
pauses its frame loop; stillImageData flushes queued cells, restores in finally, no clock churn; boot applies
the switches before anything is drawn; tests for timex_hires_giga, Giga odd cell, Flicker, a real PNG and GIF
export, and the reload pixel; tooltips follow a language change. Owner decisions it raised: reasons on
greyed rows for keyboard and touch users (left as the Image > Attributes rows do it, noted for an accessibility
pass), border and reference photo under Colours off (left as they are), Flicker under Colours off (shows greys).
Owner: none asked (the grey levels were chosen as [A] values and recorded).
Flaky tests: tests/browser/fill-speed.spec.js "a whole-canvas fill costs little more than drawing the same
pixels" failed once in the first full run (the Opus review was running at the same time), passed alone and
in the final full run.
Comparison doc: Colour grid, Colour display switch and Flashing mode switch rows are Same (2026-10-09).
count-verdicts: 61 below parity (22 missing, 39 partial), was 64.
Observed, not fixed: js/i18n/hu.js 'view.attributes' reads 'Attributumok mutatasa' (carried). The disabled
View rows' reasons are not reachable by keyboard or touch, as with the Image > Attributes and Dots rows.
Still open (carried): stamp support for the attribute commands (2A); Image > Flip, Rotate and Invert writing
into a floating stamp's cells (2B, logged, not fixed).
Next: Batch 3 part 3B (same branch).
