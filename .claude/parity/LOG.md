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

## 2026-10-09 - Batch 3 part 3B - Pointer readout, PLOT, custom grid, grid colours - done
Model: Sonnet (the owner's choice for the one-run series, see .claude/parity/RUN-ALL.md). Branch: parity-a.
Commits: d3d7a79 feat: pointer readout with attribute, memory addresses and PLOT Y; custom grid; grid colours; grids remembered
(the docs and log commit follows)
Done: js/utils/pointer-info.js (PointerInfo: plotY, attributeByte, attributeParts, addresses, hex; memory bases
and PLOT rows in constants.js SPECTRUM_MEMORY with [P] sources). Pointer readout: attribute line and address
line in the status bar (spans #attr-readout, #addr-readout), shown by the new preference, X/Y and Cell now
translated, refreshed at once on a preference, language or mode change. Preferences: Pointer readout shows
(position / plus attribute / plus addresses), Y counts from (top or BASIC PLOT bottom), Grid colours (four
pickers, a Theme colour box each, Reset), all stored in the preferences record. Custom grid: GridLines
(js/utils/grid-lines.js), a fourth grid canvas, View > Show Custom Grid and Custom Grid... (js/ui/components/
custom-grid-dialog.js), the preset view slice, and all four grids remembered across a reload (Storage key
gridState). I18n.t and I18n.plural now treat a "$" in a value as text. Validators.isHexColour / normaliseHexColour.
33 i18n keys in 13 locales. Manual: "Reading the pointer" section in 20-attribute-clash.md in 13 languages;
build-manual and check:manual pass.
Tests: tests/pointer-info.test.js and tests/custom-grid.test.js (Node, failed first); tests/browser/
pointer-readout.spec.js (12 specs). Full run: run-all ALL TEST FILES PASSED; npx playwright test 622 passed.
Left: none in 3B. Batch 3 is complete.
Plan corrections: batch-03.md Decisions list (address table corrected, PLOT scope, status bar not the strip, grid
memory, colour rule). Grid visibility had never been remembered (the batch file assumed it was).
Opus: plan review (Plan agent, opus) -> change. Formulas confirmed correct against the cited sources; mode table
fixed (ULANext has a byte and addresses; ula_plus_8x1 has Timex addresses; GigaScreen needs both attribute bytes;
Timex hi-res and indexed modes have no cell colours); no typed screen sizes (constants); the strip is full so the
lines went in the status bar with aria-live off; grid canvases are in index.html not canvas-system.js;
Preferences saves a whole record (the new keys had to join it); per-grid "theme" box so Reset follows the theme;
a "$" in a translated value is text (I18n fixed); custom steps stored unclamped and clamped at draw; GRID_VISIBILITY
carries custom; preset view slice. Seventeen corrections, all applied.
Owner: "Remember the grids across a reload?" -> "Remember all four grids (Recommended)".
Flaky tests: none seen.
Comparison doc: Custom info bar and User-defined grid are Same; Options stays Partial (grid colours and PLOT done).
count-verdicts: 59 below parity (21 missing, 38 partial), was 61.
Observed, not fixed: the X/Y readout in the zoom strip is inside a polite live region and is announced about 31
times a second by a screen reader (the new lines are aria-live off). js/i18n/hu.js 'view.attributes' still reads
'Attributumok mutatasa' (carried). A stray test log H:\pw_3b.txt (outside the repo) could not be deleted by the run.
Still open (carried): stamp support for the attribute commands (2A); Image > Flip, Rotate and Invert writing into a
floating stamp's cells (2B, logged, not fixed).
Next: Batch 4 part 4A (same branch). It stops to ask the owner two questions (RUN-ALL.md).

## 2026-10-09 - Batch 4 part 4A - Inverse switch and Colour core - done
Model: Sonnet (one-run series, RUN-ALL.md). Branch: parity-a.
Commits: 0b44436 feat: Inverse switch swaps the mouse buttons (strip button, Shift+I, status line)
a365767 feat: Colour core option for thick brush, shape and curve strokes
a21e0f1 feat: colour core previews, manual, comparison rows, figures for Inverse and Colour core
(+ a test commit for the preset slice, and the docs and log commit)
Done: Inverse. StateManager.getInverse/setInverse (a plain field: a keyed lookup cost +15% on a Layer 2 640x256
fill), EVENTS.INVERSE_CHANGED, PixelDrawRoutine.resolveUserMode flips the buttons, fill tool "already filled"
check now asks the resolved mode (it silently did nothing on one button with Inverse), indexed stamp preview
handles the swapped modes, strip button (own host #inverse-mode, not in the draw-mode radio group), status line
"Inverse is on" / "(it changes nothing in this draw mode)", Shift+I (MODE_SHORTCUTS, in the shortcut dialog and the
manual), remembered per browser, saved in presets and .pixula projects, cleared by Reset All.
Colour core. PixelDrawRoutine.withColourCore / classifyCore (one rule for draw(), the compositor preview and the
brush hover mark): outside the core NORMAL -> PIXEL_ONLY, NORMAL_ERASE -> ERASE, Ink/Paper recolour dropped, XOR keeps
its mode and writes no colours (keepColours). BrushEngine marks the stroke's whole PATH widened by the core (stamps are
size/2 apart); ShapeGenerator.corePredicate for shape outlines and Bezier (thickness-1 raster widened by the core);
option "Colour core: Whole line / 1 pixel / 4 pixels" on the round/square brush, shape outlines and Bezier, shown only
where cells have colours (new showIf { cells: true }, re-evaluated on a screen mode change); presets carry it.
10 i18n keys in 13 locales; manual paragraphs (Inverse, Colour core) in 40-colour.md in 13 languages.
Tests: tests/inverse-mode.test.js, tests/colour-core.test.js (Node, failed first; the fill test proved to fail on the
old fill code), tests/preset-slices.test.js extended, tests/browser/inverse-mode.spec.js (5), tests/browser/
colour-core.spec.js (4, incl. live preview equals commit), tests/browser/shell.spec.js updated (strip list and count).
Full run: run-all ALL TEST FILES PASSED; npx playwright test 630 passed.
Speed: [M] in docs/FIGURES.md. Layer 2 640x256 fill 20.9-21.8 ms before, 20.5-22.3 ms after; thick stroke unchanged.
Left: none in 4A.
Plan corrections: batch-04.md ("XOR writes no colours anyway" was wrong; the gradient only adds marks; shapes' even
thickness is one wider). The owner was asked the two strip questions with measured icon sizes at 800/1024/1200 px.
NEW COST NOT SHOWN TO THE OWNER (measured at the default interface size only): at a 1024 px window with the 200%
interface size the strip was already at ColorBarFit's floor (16 px icons) with 11 buttons and now wraps to two rows
with 12. Every other combination measured (1024/1280/1366/1600 px x 100-200%) stays one row. tests/browser/
shell.spec.js allows two rows in exactly that corner, with the reason in a comment. 4B adds three more buttons.
Opus: plan review (Plan agent, opus) -> change. Corrections applied: colour core from the whole path not the stamps
(W1); XOR does write colours so keepColours (W2); gradient claim (W3); previews must match (W4); Inverse in the drawing
preset slice and projects; own host for the button; Shift+I; fill-tool bug; indexed stamp preview; MODE_SHORTCUTS list;
status via an id suffix; shell.spec lists; timing. Owner decisions it raised: none needed.
Owner: "Where should the Inverse switch go?" -> "A button in the top strip (Recommended)"; "Where should the three new
whole-cell tools go?" -> "Three more buttons beside Swap and Recolour (Recommended)" (asked with measurements).
Flaky tests: tests/browser/undo-partial-capture.spec.js "undo and redo in a 32-layer LAYER2_640 document..." failed once in
the full run (a timing ratio, other work was running); passed alone 3 of 3.
Comparison doc: Inverse mode and Colour attribute line thickness are Same. count-verdicts: 57 below parity (20 missing,
37 partial), was 59.
Observed, not fixed: hu.js 'view.attributes' (carried).
Still open (carried): stamp support for the attribute commands (2A); Image > Flip, Rotate and Invert writing into a
floating stamp's cells (2B).
Next: Batch 4 part 4B.

## 2026-10-09 - Batch 4 part 4B - Cell tools and the wiping eraser - done
Model: Sonnet (one-run series). Branch: parity-a.
Commits: fae43e2 feat: Copy colours, Invert dots and Invert dots and colours cell tools; wiping eraser option
(+ eraser test, cell tools manual/specs/docs commit e8d39d3, and the docs and log commit)
Done: three whole-cell paint tools beside Swap and Recolour (owner's choice: three buttons). ColorManager.cellToolAvailable
(the one table: which tool exists in which mode); TransformService.cellToolBlocked / pickCellColours / paintCellColours /
invertCellDots / invertCellDotsAndColours (public, open no batch; the drag holds the only one); invertDotsAndColours
refactored to share the core (Batch 2 tests unchanged and green); InputHandler: five modes, a pick on the press for Copy, a
cell walk between pointer events, a once-per-drag set, undo labels by table, an armed tool dropped when a screen-mode switch
makes it unavailable; ClutBar per-button visibility; DrawModeBar status entries; A11yAnnouncer; three icons. Eraser option
Colours: Keep / Set to current (NORMAL_ERASE only where cells have colours; hover mark follows). 16 i18n keys (+ a11y.attrModeOff
reworded) in 13 locales; manual (eraser sentence, cell tools paragraph, Dots sentence) in 13 languages.
Tests: tests/cell-tools.test.js (Node, failed first), tests/eraser-wiping.test.js (fails on the old eraser), tests/browser/
cell-tools.spec.js (7), shell.spec.js and modes.spec.js updated (15 buttons; each button's mode availability).
Full run: run-all ALL TEST FILES PASSED; npx playwright test 638 passed.
Left: none in 4B.
Plan corrections: batch-04.md (nine decisions, see Decided and corrected during part 4B): Invert dots and colours gated to fixed-16
palettes (this also corrects Batch 2's menu item, which offered it in ULAplus and ULANext where it changed the look); Invert dots
is allowed in Timex hi-res; eraser rationale; per-drag rules.
Opus: plan review (Plan agent, opus) -> change. Fifteen corrections, all applied: batches do not nest (the shared core opens
none); invert dots must not use _applyBuffer (it stamps the rail's colours); Timex hi-res would have been refused by
attributeCommandsBlocked; one availability table; a see-through cell rule per tool; Copy picks what the page shows; one
drawing-guide rule; once per drag; fast drags; testability through public service methods; InputHandler/label/Escape details;
eraser gate at write time and markWrite; a11y announcer; manual edits; the specs that list strip buttons.
Owner: none asked (the re-measure showed no new wrapping beyond the 1024 px / 200% corner already recorded).
Flaky tests: none this time.
Comparison doc: Copy attribute tool, Wiping tool, Pixels inverter tool, Pixels and attributes inverter are Same. count-verdicts:
53 below parity (20 missing, 33 partial), was 57.
Observed, not fixed: Swap used to swap a cell back if the drag crossed it twice; it now acts once per drag (a behaviour change).
hu.js 'view.attributes' (carried).
Still open (carried): stamp support for the attribute commands (2A); Image > Flip, Rotate and Invert writing into a floating
stamp's cells (2B).
Next: the group A end-of-build Opus review (RUN-ALL.md step 3), then Batch 5 part 5A on branch parity-b.

## 2026-10-09 - Group A - end-of-build review, review fixes, and the owner's strip redesign - done
Model: Sonnet (one-run series). Branch: parity-a.
Opus: end-of-build review of group A (Plan agent, opus) -> change. Fixed: (1) the arrow keys moved a floating stamp and
the gradient endpoint by a whole cell (the Move choice's cell step leaked into them; Move is greyed out then, so no way
back): they nudge one pixel again, pinned in transform-shift-pad.spec.js and input-keyboard.spec.js; (2) Image > Flip /
Rotate / Invert Colors acted on a floating stamp's preview cells (Invert Colors filled it with a screen of dots, and added
an undo step): they now go through TransformPanel.applyTransform (SelectionService.transformStamp), the rows grey out with
a reason for a stamp that carries its own colours, and the service methods refuse a stamp layer; (3) Swap and Recolour
joined the other cell tools (TransformService.swapCellColours / recolourCell: one guard rule, no second implementation),
and a cell tool pressed over a stamp or a locked layer says why in the status bar (new EVENTS.STATUS_NOTICE); (4) Inverse
tests for shapes (outline and filled, both buttons) and a stamp; (5) stale comparison-doc text and an AI-tooling path
mention; (6) non-ASCII characters in what group A added; (7) hu.js and pl.js view.attributes; (8) batch-05.md now carries
the stamp carry-overs.
Owner changes during the review (instructions, not questions): Inverse moved OUT of the strip into Preferences (checkbox,
plus Shift+I and the status line); then the whole top strip became THREE SELECTOR BUTTONS (Draw mode, Cell tool, Mirror),
each showing the choice in force and opening a small two-column pop-up grid of the others, floating over the page,
closing at once on a pick / Escape / an outside click, using the app's own two-stage hover tags. Draw mode and Mirror are
independent and both in force; an armed cell tool takes over every stroke and is switched off by None, by picking it
again, by a right-click on the canvas, or by choosing a draw mode or a tool. New js/ui/components/strip-selector.js;
three new icons; 6 + 2 i18n keys in 13 locales; manual paragraphs rewritten in 13 languages. The 1024 px / 200% corner is
one row again (the earlier 12-15 button strip wrapped there). Specs rewritten to open the selector (helpers pickDrawMode,
pickMirror, pickCellTool in tests/browser/helpers.js); new tests/browser/strip-selector.spec.js (4).
Full run: run-all ALL TEST FILES PASSED; npx playwright test 646 passed (+1 inverse stamp spec afterwards).
Owner decisions still open for the final sign-off (nothing blocks the run): (a) the two commit messages that mention "Opus"
(273f92a subject, 3e46b59 body): reword before a merge, or accept; (b) "Wiping tool = Same" although ZX Paintbrush's wipe is
editable as a polygon afterwards; (c) Image > "Invert Colors" inverts dots only: rename in 13 languages?; (d) should Edit >
Fill Selection follow Inverse?; (e) the cell-tool hint texts still end "Click it again, ... to stop" (it works: pick the armed
tool again in the grid), reword in 13 locales?
Flaky tests: none this time.
Next: Batch 5 part 5A on a new branch parity-b (RUN-ALL.md step 4).

## 2026-10-10 - Batch 5 part 5A - the stamp model and placing rules - done
Model: Sonnet (one-run series). Branch: parity-b.
Opus: plan review (Plan agent, opus) -> change; the verdict's changes are all in. It found batch-05.md wrong on one point:
coloured stamps do NOT overlap today (their clear dots use Paper recolour, which touches no dot), so the default Clear dots
is Transparent for every stamp. batch-05.md corrected.
Built (build order from the review):
1. tests/stamp-golden.test.js - a PIN written first: what stamps write today in standard ULA, ULAplus, ULANext, GigaScreen,
   multicolour 8x4, Timex hi-res and Layer 2 (plain, attributed, indexed; commit and stampAt; the stamp XOR box), hand
   checked. Passed on the code as it stood and still passes unchanged: every default is byte for byte what it was.
2. Model, no behaviour change: stamps may carry attrGrid (the shape of their colour cells) and opts (colours / showThrough /
   clearDots). Threaded through creation, floating capture and restore (undo), parking, picking up again, duplicate, save and
   read (cleaned on read: only allowed values survive, a grid that disagrees with its attrs is dropped, old files and
   stamp-less documents save exactly as before). Also fixed: duplicating a floating or fresh stamp used the stale parked copy
   and copied preview cells. SelectionService.stampOptions / stampAttrGrid / stampColoured / stampColoursBlocked.
3. One write plan (_forEachStampWrite, and _forEachIndexedStampWrite) used by stampAt, commitStamp and the previews, so a
   preview cannot drift from a placement. The old separate attributed preview is gone: a tile cell with no dots now previews
   its paper recolour (it did not before), pinned by a 128-combination preview-equals-commit matrix in
   stamp-draw-mode.test.js.
4. Placing rules, tests/stamp-placing.test.js (hand derived): Pixels stamp with Overlap clears the dots under its whole box as
   the opposite of the draw mode (Erase for Normal and Pixels Only, set for the right button and Inverse, nothing for the XOR
   and recolour modes or the stamp's XOR box); a coloured stamp ignores the draw mode, the rail and the XOR box, writes each
   cell's own colours, a hole writes nothing, Inverse swaps set and clear, show-through takes the page's value per part;
   Layer 2 overlap likewise, preview included (new LayerManager.previewCellIndices).
   Deliberate changes outside the defaults: Inverse now affects coloured (Map) stamps; a coloured stamp in a mode without cell
   colours, or whose cells are not the mode's size, is placed as a Pixels stamp.
5. SelectionService.setStampOptions(patch) and convertStampToPixels(): one undo step each, floating or parked, undo/redo
   tested. Buttons arrive with 5B.
6. The three "what is a stamp" checks merged: SelectionService.engagedStamp(). Corner case changed on purpose: with a stamp
   floating, the attribute commands are now blocked even if the layer panel made a drawing layer current (they used to run
   on the picture under the stamp). A stamp that holds colours still cannot be flipped, scaled, rotated or warped - lifting
   that is part 5A2/5B.
7. Speed (docs/FIGURES.md, new section, M): full-picture stamp, standard ULA, preview 1.0 -> 1.6 ms; stampAt 2.0 -> 2.1 ms;
   Layer 2 640 unchanged to within drift. A tenth of the 7 ms live budget.
Not in 5A, still to do: clipboard colours (5A2, owner question below), the controls (5B), Image > Attributes on a stamp's own
colours (5B/5C).
Owner question for 5A2 (asked then): should a stamp copied from the picture start as "Pixels only" (recommended: pastes
exactly as today; one click on Own colours brings the copied colours back) or start with Own colours (snaps to whole cells,
ignores the rail and the draw mode, cannot be scaled, rotated or warped)?
Tests: run-all ALL TEST FILES PASSED; 41 stamp/cell-tool browser specs passed.
Next: part 5A2.

## 2026-10-10 - Batch 5 part 5A2 - clipboard colours - done
Model: Sonnet (one-run series). Branch: parity-b.
Opus: no separate plan review: the 5A Opus plan review specified 5A2 in full (capture, codec, snapping, transforms) and this
follows it, with the one simplification below.
Built: a copy keeps the colours of the cells it covered (SelectionService.copyToClipboard -> clipboard.attrs / attrGrid,
one byte per cell from LayerManager.attrsAsSeen, null for a cell the lasso never touched, the grid offset recorded for an
off-grid copy); not captured in GigaScreen, the indexed modes or modes without cell colours. ClipboardCodec saves them as
optional att / ag fields (a damaged block is dropped and the pixels still paste; old payloads paste as before). A paste
carries them and starts as Pixels only (opts.colours 'pixels'), so it lands exactly as it always did; setStampOptions
{colours:'coloured'} snaps it to whole cells and places the copied colours. Scale, free rotation, warp, flips, quarter turns
and outline on a Pixels stamp that carries colours DROP the colours (they would point at the wrong dots); on a stamp that
places its own colours they are refused (as Map stamps always were). engagedStamp().ownColours now means "places its own
colours".
Simplification from the Opus design: flips and half turns do not carry the colours along (the plan had them reverse the
grid); a stamp that carries colours loses them on any shape change. Nothing in the app lets a person ask for Own colours
yet (the controls are 5B), so this costs nothing today; carrying them through a flip is a possible later refinement.
OWNER decision taken by default (RUN-ALL says ask; the resume instruction said not to): clipboard stamps START as "Pixels
only" (the recommended option). To start them with Own colours instead, change the one line in startFloatingPaste.
RESOLVED 2026-10-10: the owner was asked afterwards (the stop should have happened before the build) and chose Pixels only. Nothing to change.
Tests: tests/clipboard-colours.test.js (Node), tests/browser/clipboard-colours.spec.js (reload keeps the colours; a plain
paste takes the rail colours; Own colours snaps and places the copied ones). run-all ALL TEST FILES PASSED; npx
playwright test 646 passed, 1 failed (dialog-listeners, a load flake: passes alone, run twice).
Next: part 5B.

## 2026-10-10 - Batch 5 part 5B - the stamp controls - done
Model: Sonnet (one-run series). Branch: parity-b.
Opus: plan review (Plan agent, opus) -> change. Its corrections, all applied: (1) a screen-mode switch DELETED a stamp that
had been picked up from the Stamps panel (cancelFloatingPaste removed the saved stamp, before the undo action opened): it is
now parked instead (ScreenModeService.switchMode; the review approved that one change to the service); (2) a parked stamp
switched to Own colours is snapped to the cell grid; (3) Scale, Rotate, Shape, Reset, Flip, Invert and Outline are disabled
(with a visible reason) while a stamp places its own colours, instead of silently doing nothing; (4) the panel edits the stamp
it shows (current stamp layer, else the floating one); (5) reasons are visible hint spans, never title text; (6) every new
control has a two-stage title and is registered with TooltipManager.SELECTOR.
Built: Transform panel block (Colours select, Show through boxes, Clear dots select, Convert to pixels only) drawn from one
pure function, SelectionService.stampControls(layer), tested in every screen mode (tests/stamp-controls.test.js); ULAplus
shows one CLUT box (on only when Bright and Flash both show through); Timex hi-res and the indexed modes show Clear dots only;
GigaScreen boxes cover both screens; a stamp whose cells are another size shows Colours greyed with a reason. A stamp with
its own colours disables the XOR box in the panel and the X button in the layer panel (dimmed, aria-disabled, status notice on
click; the stored XOR value is kept). "Clear background changes nothing here" hint where the draw mode has no opposite
(_overlapClearMode, now the one rule for both write plans and the hint). 30 i18n keys in 13 locales. Manual: new Stamps
section in 40-colour.md in 13 languages. Comparison rows: overlay switches, overlapping/transparent and convert now Same;
pixels-only/coloured stays Partial (ZX Paintbrush asks at creation).
Deferred to a new part 5C (recorded in batch-05.md and RUN-ALL.md): Image > Attributes on a stamp's own colours.
Tests: stamp-controls.test.js (Node), tests/browser/stamp-controls.spec.js (8), tooltip specs extended. run-all ALL TEST FILES
PASSED; playwright 654 passed, 2 failed under load (dialog-listeners fails 3 of 8 under 4 workers with or without these
changes; undo-partial-capture timing); both pass alone.
Next: part 5C.

## 2026-10-10 - Batch 5 part 5C - Image > Attributes on a stamp's own colours - done
Model: Sonnet (one-run series). Branch: parity-b.
Opus: plan review (Plan agent, opus) -> go; no second mandatory review needed (no PixelDrawRoutine, UndoRedo, compositor or
file-format change). Semantics as the review set: whole stamp, selection ignored; a hole (null cell) is never read, written,
counted or used as a flip partner (a cell opposite a hole keeps its own colours); Erase honours the use-existing boxes against
the stamp's own value and writes the rail's screen A colours in GigaScreen (a stamp holds one colour set); Flip mirrors the
colour grid, the dots, position, grid offset and mask stay; Invert keeps bright and flash (so the ULAplus CLUT survives).
Built: TransformService._attributeScope() chooses picture or stamp; _planCellWrites/_rewriteCells take the scope (one planner
for both, picture callers unchanged); SelectionService.setStampAttrs (one undo step, floating or parked),
packStampAttr/unpackStampAttr (the one place the byte layout is written); engagedStamp().ownColours for a parked stamp;
attributeCommandsBlocked is null for a stamp with its own colours and 'stamp' for any other. Image > Dots and the cell tools
stay blocked on stamps. Change dialog: "Applies to: Stamp", no Screen B group for a stamp (key attrChange.scopeStamp, 13
locales). Manual: the Attributes sentence corrected and a paragraph added in 13 languages. Comparison rows 95-99 now Same.
Tests: tests/stamp-attribute-commands.test.js (Node: every command, undo, holes, parked, blocked cases, GigaScreen, ULAplus),
tests/browser/stamp-attribute-commands.spec.js (5). run-all ALL TEST FILES PASSED; npx playwright test 661 passed.
OWNER question, asked next: should a stamp with its own colours be allowed to flip/quarter-turn with its colours carried
along (today impossible; the panel and menu rows grey out with a reason)?
ANSWERED 2026-10-10: keep it impossible. Batch 5 is done; next is Batch 6 part 6A (an owner stop).

## 2026-10-10 - Batch 6 part 6A - palette slots, palette inverter, CLUT keys - done
Model: Sonnet (one-run series). Branch: parity-b.
OWNER stop: asked, before building, which keys pick the ULAplus CLUTs. Tested Ctrl+Shift+1-4 and Alt+Shift+1-4 in Chrome with
a Playwright key press (all reached the page; Edge and Firefox were not installed, and injected keys cannot show Windows-level
interception). Owner chose Ctrl+Shift+1 to 4 (matched on e.code).
Opus: plan review (Plan agent, opus) -> go, with C1-C4 applied; it also counted as the mandatory UndoRedo consult for the two
hunks made (the snapshot carries the slot bookkeeping). Decisions taken from it: state in ColorManager (no new file); the
live register file IS the active slot, the others are stored aside and never changed in place; slots are written to a project
only once used (an untouched document saves exactly as before); a project saved with the default palette now restores that
default instead of inheriting the previous document's palette (C1); a non-project file opens on slot 1 with slots 2-4 copies
(C2); File > New keeps the palette and slots; the Next palette has no inverter (reason in the comparison row).
Built: ColorManager slot model and PALETTE_SLOT_CHANGED; TransformService.paletteCommandsBlocked / selectPaletteSlot /
invertPalette (one undo step each, recompose after); PaletteOps.invertUlaplusHalves; UndoRedo snapshot carries the slot state;
App project save/load and FileManager.loadFile; Image > Palette submenu (4 radio slots + Invert Palette, reasons as the row
tooltip); palette editor shows "Slot n of 4"; CLUT_SHORTCUTS (constants, input handler before every key-matched branch, the
Shortcuts dialog, the manual's key table); 11 i18n keys in 13 locales; manual paragraphs in 13 languages; comparison rows
(CLUT grid and Palette inverter Same; palette slots Partial: menu only, no keys, fixed modes have none).
Tests: tests/palette-slots.test.js (Node), tests/browser/palette-slots.spec.js (8). run-all ALL TEST FILES PASSED;
npx playwright test 669 passed.
Next: part 6B (Mandatory Opus consult on the TAP byte layout).

## 2026-10-10 - Batch 6 part 6B - standard colours and the ULAplus palette tape - done
Model: Sonnet (one-run series). Branch: parity-b.
Opus: plan review (Plan agent, opus) -> change; all corrections applied. It read the real ZX Paintbrush files: 13 palette
tapes (not 9), all 176 bytes with identical framing, only the 64 palette bytes and the data checksum differ; Brights.pal is
64 entries x R,G,B,0 in CLUT order. Corrections: there is no File > Export submenu (the tape is a File row beside Save
Palette); File > Open already reads a 256-byte .pal as a Next palette, so ZX Paintbrush's layout is read only from
Preferences; a palette tape opened through File > Open must not become the open document (FileManager asks the handler,
TAPFormat.importsDocumentFor; .pal/.npl got importsDocument false for the same reason).
Owner questions asked before building: bright black stays the same as black (15 colours); add Save .pal to Preferences (yes).
Built: TAPFormat.buildUlaplusPaletteTap (176 bytes: the BASIC line is RANDOMIZE USR (46 + PEEK 23635 + 256 * PEEK 23636):
LOAD "": REM, then a 35-byte Z80 routine (written from the ULAplus port spec, run on a small Z80 model in the test) padded to
40, then the 64 registers and 0x0D), findUlaplusPalette (first Program block whose line ends REM ... 64 bytes 0x0D; ignores
name, line number and the loader code), loadUlaplusPalette (one undo step, notice outside ULAplus modes), parse fallback;
File > Save Palette as TAP; the palette editor offers .pal and .tap in ULAplus and Load reads tapes. ColorManager standard
colours (_stdHex/_stdRGB, setStandardColours/getStandardColours/isStandardEdited, index 8 forced to follow black, applied by
re-deriving the palette so the rail, canvas, CSS tokens, Timex, border and GigaScreen blends follow); GIF export and the
import preview paint use them; image IMPORT still matches the hardware colours so a photo gives the same bytes everywhere
(Opus). NextPaletteFormat.decodeStandardColours / encodeStandardColours (layout recorded [M] in its header). Preferences
section (pickers on a working copy, OK applies, Cancel keeps nothing, Load .pal, Save .pal, Reset), stored in the
'preferences' record only when edited and read at boot. 13 i18n keys in 13 locales; manual paragraphs in 13 languages.
Tests: tests/palette-tap.test.js (reads the 13 real tapes from Program Files when present, otherwise prints SKIP; nothing
copied into the repo), tests/standard-colours.test.js, tests/browser/palette-tap.spec.js (5), tests/browser/standard-colours.spec.js
(5); palette-files.spec.js updated (ULAplus now offers two file kinds). run-all ALL TEST FILES PASSED; playwright 679.
Owner check-off added: open a PixULA palette tape in ZX Paintbrush 2.6.4 and on a real Spectrum / emulator (unverified).
Next: Batch 7 part 7A.

## 2026-10-10 - Batch 7 part 7A - the Figure tool - done
Model: Sonnet (one-run series). Branch: parity-b.
Opus: plan review (Plan agent, opus) -> go with corrections C1-C8, all applied; it also counted as the consult for the one
PixelDrawRoutine addition (a read-only method, parity-tested). The first attempt hit the session limit and was re-run.
Built: FigureModel (pure: six types, kinds 'v'/'r' so Backspace removes a whole run, rasterise through the existing Bresenham
line, disc thickening and scanline fill); ShapeGenerator.fillPolygon (buffers now grow: the old 128-edge / 64-active buffers
silently dropped writes for a freehand polygon, pinned by a 450-vertex test) and ShapeGenerator.thicken;
PixelDrawRoutine.strokeTargets (bounds, mirror and drawing-guide clip, locked layer; tests/stroke-targets.test.js checks it
against what draw() writes); ToolBase.handleKey / cancelPending, claimed by InputHandler before the selection's Backspace
and before the tool is switched on Escape; FigureTool (click, drag-run, double click, Enter, Backspace, Escape, tool switch
commits, three-point figures finish themselves, one batch = one undo step, preview = commit via the same plan, redraw on every
fact the commit depends on, drop on File New/Open and mode change); six Shape-picker entries with six sprites, TOOL_GROUPS
(L key), rail umbrella, grid snap for points; 17 i18n keys in 13 locales; manual paragraph in 13 languages; comparison rows
(polyline, rays, orthogonal/parallel Same; triangle and polygon stay Partial; point mode still Missing).
Defaults taken: switching tools COMMITS a pending figure (the Bezier tool discards; align it in 7C); Escape DROPS it (ZX
Paintbrush finishes the figure on Escape; one line to change); filled off by default.
Tests: tests/figure-model.test.js, tests/stroke-targets.test.js, tests/figure-tool.test.js (34 checks), tests/browser/
figure-tool.spec.js (8). run-all ALL TEST FILES PASSED; playwright 686 passed, 1 timing flake (undo-partial-capture, passes
alone). Speed recorded in docs/FIGURES.md (worst case over budget; noted there).
Carried to 7B: move the Shape and Bezier previews onto strokeTargets (they show no mirror or drawing guide) and give them the
same redraw-on-change.
Next: part 7B.

## 2026-10-10 - Batch 7 part 7B - line styles, rotation, rounding - done
Model: Sonnet (one-run series). Branch: parity-b.
Opus: plan review (Plan agent, opus) -> go with five departures from the brief, all applied: (1) SIX line styles (the help
names six: solid, dashed, dotted, dash-dot, dash-dot-dot, plus clear); dash lengths read from the help's toolbar picture
(dashed 18 on 6 off, dotted 3/3, dash-dot 9/6/3/6, dash-dot-dot 9/3/3/3/3/3) [M]; (2) Clear on an unfilled shape draws nothing
(stays selectable, with a hint) and the Bezier list leaves it out; (3) the rasteriser enforces "dashes only at thickness 1"
itself, not just the panel (a preset can carry dashed with thickness 3); (4) Rounding is a PERCENTAGE 0-100 (50 = the radius
the shape always had, so tests/shape-fills stay valid); (5) the circle gets no Rotation row.
Built: guard first (tests/shape-rotation.test.js pins a checksum of 204 default shape outputs, written from the pre-7B code
and still passing); ShapeGenerator line styles (LINE_PATTERNS, applyLineStyle, orderOutline - a walk over today's pixels,
start at a free end or the right end of the top row, least-turn steps - so every shape gets styles without rewriting its
generator; filled shapes lose the gap pixels); rotation (box shapes turn their vertices round the box centre with a
.5-safe snap, sampled curves have L-corners thinned; the shapes drawn from a centre and a drag point turn the drag point
round the start, which makes the 180 degree arc equal the arc dragged the other way); rounding; Bezier and Figure line
styles (a Figure's phase restarts per ray or line); OptionControls `disabledIf` on select options; ToolBase.lineStyleRow;
11 i18n keys in 13 locales; manual paragraph in 13 languages.
Carry-overs from 7A done: the Shape and Bezier previews now go through PixelDrawRoutine.strokeTargets (they showed neither
mirror nor drawing guide); the Bezier tool redraws on the same facts as Figure and drops its curve on File New/Open and mode
change; the Bezier tool now COMMITS a curve being edited when you switch tools and Escape drops it (it used to discard on a
switch). The bezier.usage hint text was not reworded in the 13 locales.
Known, not changed: a filled sector over 180 degrees fills its mouth (an existing behaviour, noted by the review); the
parallelogram lean stays a fixed quarter of its width; a rotated ellipse uses a different raster from the unrotated one, so
it shifts slightly between 0 and 1 degree.
Tests: tests/shape-rotation.test.js (guard + line styles + rotation + rounding + Bezier), figure-model and preset-slices
extended, tests/shape-bezier-preview.test.js, tests/browser/line-style-rotation.spec.js (6). run-all ALL TEST FILES PASSED;
playwright 693 passed. Speed in docs/FIGURES.md.
Next: part 7C.

## 2026-10-10 - Batch 7 part 7C (first half) - point mode, editable shapes, clone, cursor keys - done
Model: Sonnet (one-run series). Branch: parity-b.
Opus: plan review (Plan agent, opus) -> change; applied. OWNER question asked first (as the review said it was the owner's):
a dragged Shape draws on release as today; "Keep editable" is an opt-in tick box, off by default. The review split 7C: this
entry is the first half; axis lock and the spray pattern follow as 7C2.
Review corrections applied: no "Apply current colours" button (a pending figure already follows the rail live; for a drawn
one: Ctrl+Z then Clone); bare X is NOT free (it swaps ink and paper) - axis lock moves to 7C2 with X acting on a tap; Ctrl+Z
while a figure is pending must not undo the picture (ToolManager.undo -> tool.undoPending, all four Ctrl+Z paths); Save did
not commit a pending figure (FileManager now does, before save, save-as and export); a negative-coordinate decode bug in
FigureModel (a dashed figure partly off the left or top edge) fixed with a failing test first.
Built: FigureModel rotation (applied only when drawn: 360, 4 x 90 and 37 + 323 give back exactly the original), pivot,
movePoint, containsPoint; ShapeFigure (a Shape drawing kept editable; displayed handles follow the turn; dragging a corner of
a turned box keeps the opposite corner where it is drawn); FigureEditor (the preview/plan/commit that were in FigureTool, hit
testing in priority point > knob > body, drag/move/turn, nudge, edit stack of 64, take-back) shared by FigureTool and ShapeTool;
FigureHistory (the last drawn Figure, Shape or Bezier; not part of undo; cleared on File New/Open and mode change) and
Edit > Clone Last Figure (Shift+C); cursor keys move a pending figure/shape/curve before a selection (1 pixel, or a cell with
Shift or grid snap); GridOverlay round turn knob; Shape "Keep editable" row and hint; Bezier nudge/undo/commit/clone.
13 locales: 4 new keys, 2 reworded usage hints. Manual paragraph in 13 languages. Comparison rows: clone, cursor keys, re-colour
Same; point mode Partial (a Bezier curve cannot be dragged or turned as a whole; no "clear points").
Defaults taken: pressing a handle and releasing without moving draws the figure and starts the next (the Bezier/Figure
"click away"); dragging inside an unfilled closed figure moves it, so to start a new figure inside it press Enter first;
the knob sits above the figure (below when that would be off the top); the pivot is the middle of the figure's box (ZX
Paintbrush says "median point" [P]; box centre is [A]).
Tests: tests/figure-edit.test.js (new), figure-tool.test.js and shape-bezier-preview.test.js extended, tests/browser/point-mode.spec.js
(8). run-all ALL TEST FILES PASSED; playwright 701 passed.
Next: 7C2 (axis lock with X/Y, spray pattern), then the group B Opus review.

## Batch 7 part 7C2 (axis lock, spray pattern)
AxisLock (js/core/axis-lock.js, pure bookkeeping, Node-tested): bare X / Y held while dragging project every point onto
a horizontal / vertical line through the press point (or where the key went down); the key pressed last wins and
re-anchors; auto-repeat ignored; reset on window blur. InputHandler projects pointer down, every move sample and pointer
up for tools with `axisLockable` (Brush, Eraser, Shape, Figure). Bare X swaps ink and paper on key UP (a tap) so holding it
can lock; Ctrl+X is still Cut. Spray Distribution gained Pattern: BrushShapes.patternFigure / patternStamps lay whole
circles, squares or lines (outline or solid) wholly inside the spray disc; options Figure, Figure size, Filled; Flow is
the share of the disc covered. Not done: per-figure line style / fill pattern (comparison row is Partial). A spray too
small for one figure draws nothing (by the "whole figures only" rule).
13 locales: 2 new keys (opt.patternShape, opt.patternSize). Manual paragraphs (50-tools, 90-input) in 13 languages.
Comparison rows: X and Y keys Same; Spray pattern Partial.
Tests: tests/axis-lock.test.js, tests/spray-pattern.test.js, browser axis-lock.spec.js, spray-pattern.spec.js.
Next: group B Opus end-of-build review.

## Group B end-of-build Opus review (2026-10-10)
Opus (Plan agent) reviewed 5A..7C2. Run-all, check:manual and the 706-spec Playwright run passed beforehand; it found 4
real bugs and 9 smaller points. Fixed, each with a failing test first (verified failing before the fix):
1. A shape kept editable vanished when the pointer left the canvas (onPointerLeave cleared the preview): now re-renders.
2. A waiting shape ignored Filled, Thickness, the per-shape dials and Colour core: every setter now calls _syncPending.
3. Clone lost a shape's own dials (arc span, star points, rounding...) at the next option change: prepareClone restores them.
4. An ordinary one-REM tape read as a ULAplus palette: findUlaplusPalette now requires a one-line program with a USR
   before the REM (tests: no-USR loader, a longer program).
5. X / Y could stay locked when focus left from inside the canvas iframe: blur on every document's window, and
   visibilitychange, now reset AxisLock (needs a manual check in a real browser; not testable headless).
6. X / Y held while clicking figure points had no effect: AxisLock.projectAbout, ToolBase.axisAnchor (FigureTool returns
   its last point); applied to the click and the hover rubber band. Browser spec added.
7. Manual: the Bezier exception (handles + arrow keys only; Ctrl+Z drops the whole curve) added in 13 languages.
8. Comparison doc: Totals line updated (33 below parity: 7 missing, 26 partial, 69 same [M, count-verdicts.js]); rows for
   overlays (5A/5B text), ellipse wording, parallelogram -> Partial, re-colour -> Partial, spray pattern reason.
9. FIGURES.md: false "redraws on a click" claim corrected and the 35 ms worst case recorded; the single-rasterise
   refactor is left OPEN.
10. F1 shortcuts dialog lists X / Y and Shift+C (new key help.axisLock, 13 locales). 11. German show-through labels
   translated. 13. Spray Pattern Flow now counts by the dots one figure really lays.
Not done (low): untagged constants (6 tries, size 2-16, knob offset, grab radius 4); the turn knob is drawn but pressing it
adds a point while a figure is still being drawn; a 5B reload-persistence test.
OWNER decisions raised by Opus, to ask at the sign-off: Escape on a pending figure (drops it; ZX Paintbrush completes it);
palette tape row Same vs Partial until opened in ZX Paintbrush 2.6.4; whether pending-only cursor keys/re-colour are Same
or Partial; whether a knob turn should stick as the Shape tool's Rotation option; build the 3-point parallelogram; ASCII
rule vs box-drawing characters in comments; group A leftovers (a)-(e) and two commit messages mentioning "Opus".

## Batch 8 part 8A (dither module) - 2026-10-10, branch parity-c (from parity-b)
js/utils/dither.js: all 31 methods (3 thresholds, 14 error diffusion, 3 Bayer, 7 cluster dot, 4 supercell), API
Dither.METHODS / apply / matrix / kernel / get / luma, options serpentine and origin. Opus plan review changed the plan:
usage rules were measured against the help's output pictures (see batch-08.md "8A decisions"); the Bayer-equals-fade test
became a transpose test. 31 names x 13 locales (dither.* keys). Script tag, boot manifest. tools/dither-bench.js and the
FIGURES.md timings (all 31 summed 64 ms on 640x256; Stevenson-Arce 16.8 ms the slowest).
Tests: tests/dither.test.js (kernels vs independent grids, sums, lattice tiles vs printed first rows, level counts, thresholds
exact, uniform fields, ramp bands, hand-computed Floyd-Steinberg, determinism, options, errors). run-all passes.
Next: 8B (plan review first).

## Batch 8 part 8B / 8B2 (dither in gradient, import, fills) - 2026-10-10, branch parity-c
Opus plan review: split into 8B step 1 (gradient), step 2 (import), 8B2 (fill from picture); corrected batch facts (no .pat
files - user patterns are IndexedDB records and JSON; 80-files.md had no import section; the Patterns panel shows only for the
pattern brush).
Built:
- Gradient: the Dithered grain select keeps the key ditherScale (old presets, Alt slots, .pixula files load unchanged) and
  offers 31 entries: the gradient's own Bayer 2 / 4 / 8 first (numbers, the first value stays the number 2 for
  OptionControls._coerce), then 28 Dither methods by family. Methods run one Dither.apply over the gradient rectangle with the
  gradient position (steps, reverse, bias) as the grey, anchored at the screen. The three ZX Bayers are left out (transposes
  of the gradient's own; would repeat the names).
- Import: a Dither select (all 31, default the importer's own Floyd-Steinberg) drives the Smooth pane, redraws it, and is shut
  with a reason in the indexed modes (they keep Floyd-Steinberg; any other id is treated as Floyd-Steinberg there). New
  Dither.paletteIndices: each pixel sits between its two nearest colours (luma-weighted), one Dither.apply per attribute cell,
  ordered methods anchored at the cell's screen position, error diffusion inside the cell. Wired into
  PNGFormat._renderCellMask and GigaQuant.renderCell. (Difference from the Opus plan: multi-slot GigaScreen cells use the
  nearest-two-slots grey rather than a per-method slot loop - simpler, same family of results; noted for the sign-off.)
- FIX (found by the review, own test first): single-screen Timex hi-res import decided dots against a per-cell pair although
  the mode draws every bit with the screen-wide scheme, so cells whose majority colour sat on the scheme's ink side came out
  inverted (and the preview did not show it). Now decided against the scheme pair (_cellPair). Changes how imports look in
  that mode: owner to know at the sign-off.
- Fill from a picture: PNGFormat.patternFromImage (pure; box-average resample, alpha over paper, brightness / contrast, luma,
  Dither.apply; ink = dark), ImportDialog.showPattern (no panes; brightness, contrast, scaling, tile size 8 / 16 / 32,
  dither, tiled preview), PatternService.freeName (never overwrites a saved tile), Patterns panel "From picture..." button.
Keys: dither.family.* (5), import.dither (+ .hint, .ditherIndexed), pattern.fromPicture (+ .hint),
dialog.patternFromPicture, import.tileSize. Manual: 80-files (new Importing a picture section) and 60-patterns, 13 languages.
Tests: gradient-dither, import-dither, import-timex, pattern-from-picture (Node); import-dither, pattern-from-picture (Playwright).
Timing: tools/import-dither-bench.js and FIGURES.md. Comparison rows: Dithering styles, Custom fill style from a picture,
Picture converter stay Partial with reasons.
Owner decisions raised (not stops; sign-off): picture fills are square 8 / 16 / 32 only (ZX allows any width and height; cost
about half a session); Layer 2 / LoRes imports keep Floyd-Steinberg only (the 31 there need a new nearest-two-colours quantiser
and palette-bench measurement, half to one session); the Timex hi-res import fix changes those imports; the Dither select
drives only the Smooth pane (also Sharp: about an hour).
Next: Batch 9 part 9A (plan review first).

## Owner answers to the sign-off questions (2026-10-12, asked one at a time)
Group B: (1) Escape on a pending figure: KEEP dropping it. (2) Palette tape row: Same. (3) Cursor keys Same, re-colour Partial
(as now). (4) Knob turn also sets the Rotation option: KEEP. (5) 3-point parallelogram: BUILD (do it in group D, with its
own plan review). (6) ASCII rule vs box-drawing comments: leave the existing style. (7) Reword the two commit messages that
mention "Opus" before any merge (rebase on parity-a/b/c; keep a backup branch until confirmed).
Group A leftovers: (b) Wiping tool row -> Partial with the reason; (c) rename Image > Invert Colors to "Invert Dots" in
13 languages; (d) Fill Selection stays always ink; (e) reword the cell-tool "Click it again ... to stop" hint in 13 locales
(test Escape first and promise only what works).
Batch 8: (1) fill tiles stay square 8 / 16 / 32; (2) ADD the 31 dithers to the Layer 2 / LoRes imports (new nearest-two-colours
quantiser, palette-bench); (3) keep the Timex hi-res fix; (4) the Dither select drives Sharp as well as Smooth.
Batch 9: blocks start where you press (with Snap on the press drops to the snap cell first).
To do from these answers (queued, in this order, each with tests): group A leftovers (b)-(e); Sharp + Dither; Layer 2 / LoRes
dither; 3-point parallelogram (group D); commit rewording (end, before any merge).

## Batch 9 part 9A (snap step) - 2026-10-12, branch parity-c
Opus plan review split 9A into 9A (snap step) and 9A2 (selection Size); owner answered the block-placement question (blocks start
where you press). Built 9A: js/utils/snap-grid.js (SnapGrid: sizeOf for cell / block16 / screen / custom, screenFits, snap,
floor, blockRect (for 9A2), nudgeStep), StateManager get/setGridSnapStep + getGridSnapSize (GRID_SNAP_CHANGED now carries the
step), own Storage key gridSnapStep (restored in app.js, deleted on Preferences reset), the "drawing" preset/.pixula slice
carries snapStep (an older preset with Snap but no step gets Cell), a step list beside the Snap button (labels are the sizes;
Screen disabled unless a whole screen fits - layer2_320 and layer2_640 only; picking a step turns Snap on), custom across / down
fields in Preferences > Drawing, pointer snapping uses the step, a pasted/floating piece snaps by its top-left corner (it used
to centre on a snapped point, half a step off the grid), arrow keys step by the snap step (selection with colours: the step
rounded to cells), Selection tool can opt out via snapsPointer (used in 9A2). 5 new i18n keys + view.snap.hint reworded in 13
locales. Manual: 50-tools "Snap and its step" in 13 languages (the older figure-nudge sentence in the translations still says
"one cell with Shift or with grid snap": true for the default Cell step).
Tests: tests/snap-grid.test.js, preset-slices (step), tests/browser/snap-step.spec.js (6). Fixed on the way: tooltip SELECTOR now
includes .grid-step-select.
Not in 9A (go to 9A2): Selection Size option, drag-to-multiples, the Cell-select half-cell bug and the 17-pixel free-rectangle
bug under Snap.
Next: 9A2.

## Batch 9 part 9A2 (selection Size) - 2026-10-12, branch parity-c
Selection tool: Size list on the rectangle (Free, Cell, 16x16, Screen, Custom) with Custom block width / height rows; one
_dragRect() feeds preview and commit; blocks via SnapGrid.blockRect (Cell blocks on the cell grid, the others start at the press,
or at the snap cell the press fell in when Snap is on); Screen is greyed out unless a whole screen fits (new `screenFits` leaf in
OptionControls._evalShowIf) and a preset-borne Screen is clamped to the canvas. The tool no longer takes a pre-rounded pointer for
blocks and Cell (snapsPointer): fixes the half-cell bug (a click in the right half of a cell selected the next one under Snap);
a Free drag under Snap is now exact (0 -> 16 selects 16 pixels, not 17). Cell mode itself is unchanged and Rectangle + Size Cell
equals it on 200 random drags in 4 cell geometries. 8 keys in 13 locales; manual "Selection sizes" in 13 languages.
Tests: tests/selection-size.test.js, tests/browser/selection-size.spec.js (4). Comparison row Selectors -> Same; Raster jump -> Same.
Next: full suites, then Batch 9 part 9B (New picture from selection, Export selection, Preview panel).

## Batch 9B plan review and owner answers (2026-10-12)
Opus: split into step 1 (Fit Selection to Cells + New picture from selection), step 2 (Save Selection As, format rules in the
registry), step 3 / 9B2 (Preview panel), step 4 (words and manual). Corrections: no autosave-backup / no undoable New in the code;
writers read live globals so export crops at the composite via options.rect; menu label is "Save Image As"; ctile already reads the
selection.
Owner answers: (1) New picture from selection asks "are you sure?" first (Ctrl+Z also works); (2) keep all layers, cropped;
(3) BUILD any-size ASM / C / BIN / ATR (and font formats where sensible) for Save Selection As; (4) Preview panel hidden until
View > Preview; (5) Save Image As > .ctile saves the whole picture AND fix Ctrl+Z after File > New / Open (UndoRedo.clear in the new
and project-load paths; failing test first).

## Batch 9 part 9B step 1 (fit to cells, new picture from selection, Ctrl+Z after New) - 2026-10-12
SelectionService.snapToCells; LayerManager.cropToCells (every layer cropped and moved, background outside Paper White, stamps shifted);
FileManager.fitSelectionToCells / newFromSelection (asks first as the owner chose; selection fitted to cells first with a notice;
one undo action; file untitled and marked changed); Edit > Fit Selection to Cells and New Picture from Selection (enabled with a
selection and nothing floating). FIX: File > New and opening a project now clear the undo history (Ctrl+Z after New used to put a
partial old snapshot onto the reset layers); failing browser test first. 4 keys in 13 locales.
Tests: tests/new-from-selection.test.js (11 modes: cells, undo, stamp), browser new-from-selection (3) and undo-after-new (2).
Not measured yet: cropToCells time at layer2_640 with 32 layers (FIGURES.md) - do with step 2.
Next: step 2, Save Selection As (format rules in the registry; including the any-size ASM / C / BIN / ATR the owner asked for).

## Batch 9 part 9B step 2 (Save Selection As) - 2026-10-12
FormatRegistry.SELECTION_RULES / selectionRule / selectionFit: pixels (png, bmp, jpg: any rectangle), cells (zxp, sev, zed, asm, c,
bin, atr: fitted to whole cells), tiles16 (ctile: fitted to the 16 grid), screen (scr, mlt, ifl, hrg, img, mg*, nxi, sl2, slr, tap,
tzx: only the whole screen); palettes and maps are not offered. Writers take options.rect: Helpers.cropImageData for png / bmp / jpg,
exportZxp, SEV and ZED (encodeScreen with a cell block; the importers already place a smaller picture at the top left), ctile
(now from options.rect - Save Image As > .ctile saves the whole canvas, as the owner chose), and DevFormat.rectBytes: the OWNER asked
for any-size ASM / C / BIN / ATR, so a part is dumped linear (w/8 bytes a row, rows top to bottom; attributes one byte a cell, row by
row) in every 256x192 one-bit single-screen mode (classic, multicolor, ULAplus; not Timex hi-res, GigaScreen or the indexed modes,
which keep the full dump only). FileManager.exportSelectionAs (fits and says so; refuses with a reason), File > Save Selection As
submenu with each leaf enabled by its rule and a reason in the title. 6 keys in 13 locales.
Tests: tests/selection-export.test.js (rules, crop, BMP crop equals full BMP rows, SEV/ZED/ZXP/DEV/ctile blocks), browser
selection-export (3: leaves, PNG crop pixel for pixel, SEV fit + notice). Full suites pass (731 browser).
Next: step 3, the Preview panel (9B2), then the manual for steps 1-3.

## Batch 9 part 9B step 3 / 4 (Preview panel, manual) - 2026-10-12
CanvasSystem.getVisibleRect / centreOn and EVENTS.CANVAS_SCROLL; PanelSection.create gains `visible`; js/ui/components/preview-panel.js:
a sidebar map drawn from the live canvas (drawImage; agrees with the canvas in the spec), a frame for the visible part, click / drag /
arrow keys scroll the canvas (the arrow keys stop at the map so they do not nudge a selection), redraws throttled to 32 ms with a
trailing call, no work while hidden or collapsed, hidden until View > Preview (owner answer). 3 keys in 13 locales. Manual: 70-menus
paragraph, 80-files "Saving part of a picture" and "A new picture from a selection", 13 languages. Comparison rows: Preview window
Same; Export selection / new file from selection Partial (the character-set and CHX font exports of a selection are not covered).
Tests: tests/browser/preview-panel.spec.js (7). FIGURES.md: draw cost and crop cost recorded.
Still to do from the 9B owner answers: none (all five built). Batch 9 is complete; next Batch 10 part 10A (plan review first).

## Batch 10A plan review and owner answer (2026-10-12)
Opus: go with corrections: alignment does not place text today (the stamp is centred on the click), so a separate 9-way Anchor option
(default Centre = today); Background maps onto the existing stamp clearDots ('overlap') via a text option kept in step with the
Transform panel (new EVENTS.STAMP_OPTIONS_CHANGED); Inverse already gives reset-dot text (test it); shadow direction needs MaskOps AND
CoverageOps. Commits: (1) pin test, (2) shadow direction + anchor, (3) background, (4) manual + spec.
OWNER: add ZX Paintbrush-style opposite-dot shadow and contour NOW (a third stamp state: set / force-clear / leave alone). Do it as
10A2 after commit 3, with a focused Opus design consult first (it touches the stamp write plans).
For later: 10B and 10C owner questions (uncommitted typed text on click elsewhere; big CHX fonts usable in the Text tool / library)
to be asked when those parts start.

## Batch 10A / 10A2 (text: shadow direction, anchor, background, opposite dots) - 2026-10-13, branch parity-c
Commits: pin of the old text options (576 combinations, digest f6d5874e...); shadow direction (MaskOps.shadowVector, CoverageOps too);
nine-way Anchor (MaskOps.anchorOffset; SelectionService.anchorOffset used by creation, moveStampPreview, re-render, transformStamp
and the Snap placement); Background (the stamp's clearDots 'overlap' set from the Text tool, EVENTS.STAMP_OPTIONS_CHANGED keeps the Transform
panel in step, hint row via a clearDotsNoEffect leaf); FIX (found by the Opus 10A2 review): a new text stamp with shadow / outline grew
on its first re-render (its source size was the post-effect size) - the Text tool now passes the bare letters' size; opposite dots:
MaskOps/CoverageOps.processLayers, a stamp clearMask (+ _srcClearMask) carried through creation, parking, undo copy, re-engage, flips,
quarter turns, Outline, Invert (drops it), scale / rotate / warp (two coverage chains), the classic and indexed write plans (written as the
opposite of the draw mode: cleared in Normal / Pixels only, SET under Inverse, nothing in XOR / Ink only / Paper only) and the saved form
(key only when present). Owner chose a SEPARATE switch for shadow and for contour (textShadowDots, textOutlineDots); the other detail
decisions took the recommended ZX-like defaults (Opposite + Clear background merges; Invert drops; right-button stamping ignores).
Keys: opt.shadowDir(+4), opt.anchor(+9), opt.textBackground, opt.shadowDots, opt.outlineDots, opt.effectDots.same / opposite.
Manual: one 50-tools paragraph, 13 languages. Tests: text-defaults-pin, text-shadow-dir, text-anchor, text-background, text-stamp-rerender,
text-layers, stamp-clear-mask (Node); text-anchor-shadow-background, text-opposite-dots (Playwright; preview == committed picture).
Comparison row Windows text tool -> Same. Next: 10B (type on canvas): Opus plan review first; owner questions to ask then: what happens to
typed text on a click elsewhere / tool switch / mode change (recommended: commit).

## Batch 10B plan review and owner answers (2026-10-13)
Opus: go. Hidden textarea (canvas-text-entry.js) for keyboard capture (IME, accents, touch keyboards; shortcuts already suspend for textareas);
overlay preview (not a floating stamp) via a shared write plan (SelectionService.maskWritePlan + GridOverlay.drawWritesPreview); pure
js/utils/bitmap-text.js (stretch, spacing, caret, buffer helpers) and MaskOps.mapPoint; commit via SelectionService.bakeMask extracted
from commitStamp (one undo entry); Type on canvas is one more 'pending' tool on the Shape/Figure/Bezier contract. Steps: (1) pure
functions, (2) bakeMask + maskWritePlan + overlay, (3) tool session, (4) UI + options + i18n + Playwright, (5) manual/figures/log.
OWNER: uncommitted typed text is DRAWN on click elsewhere / tool switch / save (New / Open drop it; a screen-mode change keeps it waiting);
add the Draw / New line / Cancel buttons for touch devices (touch typing itself uses the device's on-screen keyboard via the hidden text
field; whether a tap opens it is unproven here - on the owner's try-this list). Defaults taken: click = first letter's top-left (Anchor
hidden while typing); direction / mirror / shadow / outline / dots / Background / bold / italic apply live.

## Batch 10B done (2026-10-13)
Type on canvas built in 5 steps: pure BitmapText / MaskOps.mapPoint, SelectionService.bakeMask + maskWritePlan + overlay preview,
TextTyping session, hidden-field keyboard (canvas-text-entry.js) with Draw / New line / Cancel buttons, 14 i18n keys x 13 locales.
Tests: bitmap-text, mask-bake, text-type-commit (Node); text-type-on-canvas (Playwright, 11 specs). Manual paragraph in 13 languages.
Comparison row Sinclair text tool -> Same. Preview cost measured in docs/FIGURES.md (median about 1 ms, worst about 4 ms at layer2_640).
Owner try-this list: does tapping the picture open the on-screen keyboard on a real touch device (unproven headless).
Next: 10C (CHX fill from font + shader): Opus plan review first; ask the owner whether big CHX fonts should also work in the Text tool.


## Batch 10C plan review and owner answers (2026-10-13)
Opus: CHANGE. Font model is 8 rows x 1 byte everywhere (FontService, FontCodec, FontFormat CHX = top-left 8x8 only, FontRasterizer, editor,
Text tool); CHX multi-cell block order / column-vs-row byte / shaded-column storage are NOT verified (only 1x1 files were ever checked;
RECOIL source not in repo). Split: 10C (model + codec v2 + CHX read/write + guards + New big font + Fill), 10C2 (map view, shader,
Proportional, autoShade), 10C3 (big fonts in Text tool / Type on canvas). Corrections: new js/utils/glyph-bits.js; per-glyph stored shade
(never inferred from pixels; Space must keep a column, loader rejects a file without Space); undefined codes import fully shaded; replaceGlyphs
for one-announcement fills; fix FontService.saveToLibrary ignoring a refused persist; freeze today's exports with checksum tests first; guards
so CH4/CH6/CH8/CHR/ASM/C/BIN export and the Text tool refuse big fonts until 10C3; rasterizeCells with alignment; fill tested in Playwright.
OWNER: (1) will NOT make ZX Paintbrush sample files -> build from help text and datablocks.chm; layout risk accepted (record it as unverified
in font-format.js and on the owner's try-this list: open a PixULA big CHX in ZX Paintbrush). (2) Big fonts in Text tool + Type on canvas: YES (10C3).
(3) Map view: draw across the whole map (Same, about half a session more). (4) Fill from font uses the Text tool's font list.

## Batch 10C done (2026-10-13)
Built in the order Opus set: (1) pin test of classic font bytes (tests/font-output-pin.test.js); (2) js/utils/glyph-bits.js (pure bit access,
CHX blocks, autoShade); (3) FontCodec v2 (big sizes + shading; classic stays v1) and FontService (height, shade, newBigFont, replaceGlyphs,
setShade, clipboard across sizes, saveToLibrary now reports a refused write); (5) CHX read/write of whole characters with shading (left out =
offset 0), Space rules, export-import-export identical; the old test 'chx import takes the top-left cell' was REWRITTEN on purpose (a
multi-block character is now kept whole), not weakened; (6) guards: raw formats and ASM/C/BIN refuse big fonts, the Text tool does not list
them; (7) FontRasterizer.rasterizeCells (family name or bytes; height percent; alignment; proportional); (8) Font Editor: New Big Font...,
Fill from font..., big editing surface, size label, CHX-only export, capture off. Owner answer used: fill uses the Text tool's font list.
Tests: glyph-bits, font-codec-big, font-service-big, chx-big (Node); font-editor-big-font (Playwright, 11). Manual paragraph in 13 languages.
Found and fixed on the way: fr and it strings written in batch 10B / 10C had a literal backslash before apostrophes (28 strings).
Layout risk (owner declined sample files): block order, columns-then-rows header and the attribute byte are from RECOIL and the datablocks
manual only; recorded in font-format.js; owner try-this list: open a PixULA big CHX in ZX Paintbrush.
Not done here (10C2): map view (draw across all characters, owner chose YES), shader tool, Proportional on an existing font from the map.
10C3: big fonts in the Text tool and Type on canvas (owner chose YES).

## Batch 10C2 plan review and owner answers (2026-10-13)
Opus: CHANGE. CellGridEditor cannot carry a 512x512 map (per-pixel redraw each move, no pointer capture, fast strokes leave gaps, unbounded fill,
no stroke hooks) -> new pure js/utils/font-map.js + new js/ui/components/font-map-view.js (virtual viewport like MapEditorDialog); one
FontService.replaceGlyphs per stroke; _editorCommit boolean -> _commitSource; shade rules in GlyphBits (shadeAfterClick, shadeStep; tie goes
right); _exportChx planning loop -> _chxPlan + chxSummary (bytes unchanged, pin tests prove it); summary via Helpers.localizedPlural;
Shade/Move tools only in the map view (never pass them to CellGridEditor.setTool); keyboard for picker and map; 'Shade all to fit' carried over
from 10C; Font Editor has NO undo today (InputHandler ignores keys in dialogs). Split at whole items: 10C2 = steps 1-5 (shader in the
one-character view, summary, undo), 10C2b = steps 6-8 (the map view, map shader, manual, comparison row).
OWNER: Font Editor Undo = YES. Map Fill stays inside the clicked letter. Defaults: shade tie goes right; shading offered only for fonts 8/16/24/32
wide; Shade all to fit leaves blank characters out except Space.

## Batch 10C2 done (2026-10-13)
Built: GlyphBits.shadeAfterClick / shadeStep (table-tested, tie goes right); FontFormat._chxPlan + chxSummary (export bytes unchanged, pin tests pass);
FontHistory (byte-capped, 2 MB) + FontService.snapshot / restore; Font Editor: four Shade buttons, Shade all to fit (one change), hatched shading in
the editing surface (CellGridEditor drawOverlay hook) and dimmed in the picker, Undo / Redo (buttons, Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z; one stroke =
one step via onStrokeStart hook; the typed name is kept), CHX export summary via Helpers.localizedPlural. 19 i18n keys x 13. Manual paragraph in 13.
Tests: font-history, glyph-bits, chx-big, font-service-big (Node); font-editor-shade-undo (Playwright, 9). Browser suite 778 passed.
NOT done (10C2b): the all-characters MAP view (draw across every character, fill inside the clicked letter), map shading, keyboard for the picker,
font-map.js / font-map-view.js, comparison row 203 -> Same. Row 202's 'press a key to find its character' claim is still unbuilt (Opus found it).

## Batch 10C2b done (2026-10-13)
Built: js/utils/font-map.js (pure: layout, cellAt, compose / decompose, bounded fill, line), js/ui/components/font-map-view.js (own surface:
dirty-rectangle painting, one redraw per animation frame, pointer capture, strokes joined by lines, Brush / Eraser / Line / Fill inside the clicked
letter / Shade / Move, whole-number zoom capped at 3 for the 512 map), Font Editor: All characters toggle, wider dialog in map mode, map tools, - Fit +,
one replaceGlyphs per stroke (= one undo step), keyboard on the picker and the map (arrows, Home / End, typed character), 7 i18n keys x 13, manual
paragraph x 13. Comparison rows 202 (the 'press a key' claim is now true) and 203 -> Same, with the unverified-layout sentence kept.
Tests: font-map (Node), font-editor-map (Playwright, 12). Measurements in docs/FIGURES.md.
Known limits: drawing pixels with the keyboard alone is not possible (also true before); the map's pixel grid shows only at zoom 8+, which the
512 map never reaches, so a classic 8 x 8 font (128 px map) is the one that shows it.
Next: 10C3 (big fonts in the Text tool and Type on canvas): Opus plan review first.

## Batch 10C3 plan review and owner answers (2026-10-13)
Opus (second try; the first hit the session limit): CHANGE then go; split 10C3 (engine, invisible) / 10C3b (exposure). Corrections: advance =
width - 8*(left+right), x0 = 8*left (NOT (cols-l-r)*8, which breaks 4/6-wide classic fonts); span helper in BitmapText not GlyphBits; glyphOf keeps its
contract and returns null for a fully shaded character; spanOf / fw options; one multi-byte pixel reader; _buildLineMask calls nativeLine;
layout gets per-line xs (slot starts) + slotFromX; stretch per letter Wi = max(1, round(wi*W/w0)); pin text rendering of saved 4/6/8 fonts FIRST
(only ZX ROM is pinned today); _updatePreviewIfActive divides by h0 not 8; Size list = k*h0; labels via Helpers.localizedMessage; rewrite
font-editor-big-font spec 'not offered by the Text tool'.
OWNER: switching font height keeps the zoom; left-out characters are refused like missing ones; FIX the existing size-jump bug (two-line / vertical
text at Size 16 lands at half size then jumps) and re-record the 10A pin on purpose. Defaults: dots under shading not drawn; Character width = a
full-width letter; per-letter rounding; caret bar one source pixel wide.

## Batch 10C3 done (2026-10-13)
Built in the order Opus set: (0) text-bitmap-pin (text rendering of saved 4/6/8 wide fonts, recorded BEFORE any change); (1) BitmapText.span / bit /
fontSource (span checked against FontFormat._chxPlan for every glyph: the Text tool draws exactly what the .chx holds); (2) per-letter advance in
nativeLine / stretchLine / layout (xs slot starts) / caretRect (bar width max(1, round(W / max(8, w0)))) / slotFromX (equals Math.round for classic);
(3) TextTool: _glyphSourceFor, glyph spans in _buildLineMask / _stackGlyphs, Size list in steps of the font height, keep-zoom on font change,
_fontCellHeight; library list shows 'Name (WxH)' / 'Name (WxH, proportional)' (2 i18n keys x 13) and refreshes on a language change.
SIZE-JUMP FIX (owner asked): the stamp scale is Size / the font's cell height, not Size / block height. tests/text-defaults-pin.test.js RE-RECORDED
on purpose (old digest f6d5874e..., new 01e53e50...; the Size 8 cases alone are identical before and after, only Size 16 moved); the 8*k*lines
workaround in tests/bitmap-text.test.js removed. font-editor-big-font spec 'not offered by the Text tool' REWRITTEN to 'offered with its size'.
13 test files that load the Text tool now also load bitmap-text.js. Left-out characters are refused like missing ones (8x8 sparse CHX too).
Tests: bitmap-text-big, text-big-font, text-bitmap-pin, text-type-commit extended (big proportional font, 7 modes x 5 variants, commit == stamp),
Playwright text-big-font (4). Manual: Font Editor paragraph and the Type on canvas paragraph in 13 languages. Preview timing in docs/FIGURES.md.
Defaults recorded: dots under shading are not drawn; Character width = a full-width letter; per-letter rounding; caret bar one source pixel wide.
Batch 10 is complete. Next: group C end-of-build Opus review, then group D.

## Group C review (Opus) and the fixes (2026-10-13)
Opus found 18 items (full text in the task transcript). Fixed with a failing test first: (2) typing lost the keyboard after any option was touched ->
CanvasTextEntry takes the keystroke back (Playwright); (3) system font round trip doubled the character size and (4) presets restored the size/Type
on canvas before the font -> applyFirst on the font row (preset-slices.test.js); (5) locked layer: the click says so at once, leaving the tool closes
the session; (6) New Big Font / Fill dialog CSS; (15) manual arrow-key sentence x13; (13) IME field position: checked, it was already right (a Playwright
test now pins it - the review's report did not reproduce here). Owner-approved queue that had been skipped, now done: Wiping tool row Partial; Image >
Invert Dots (13 languages); cell-tool hint reworded x13 (Escape does NOT stop a cell tool - the hint now lists right-click, None, a tool or a draw mode);
Dither drives Sharp (once a method is chosen, so default Sharp is unchanged - say this at the sign-off); Layer 2 / LoRes imports take all 31 dithers
(Dither.paletteIndices over the whole picture; timings in FIGURES.md; the old 'select shut in indexed modes' Playwright test REWRITTEN on purpose).
Still open from the review: (7) Font Editor at 390 px desktop width (pre-existing), (8) comparison totals, (9)(10) untagged / mismatched figure premises,
(11) gradient preview timing at Layer 2 640, (12) two weak tests, (14) Draw / New line / Cancel row covers the picture on short screens, (16) Fill from
font default font, (17) nits, (18) process: owner answers into batch files, CLUSTERED_8, commit rewording before any merge.

## Batch 11A done (2026-10-13), branch parity-d
Plan review (Opus) in batch-11.md; it also served as the mandatory codec consult. Built in the order set: (0) literal version-1 map payload pinned; (1)(2) js/utils/map-find.js
(pure: make / slice / tableFrom / ids / search / find / disjoint; modes exact, dots, visual; visual = each dot's colour pair over both flash phases, GigaScreen blended
per dot and phase with (a+b)>>1, independent of every display toggle); tests/map-find.test.js (the help's circle picture, 2 x 2 blocks, edges, FLASH trio, red-over-blue =
magenta-over-black) and tests/map-find-oracle.test.js (a screen painted by the real compositor in both flash phases in six modes; MapFind's partition equals the
compositor's; the display toggles do not change it; 5 refused modes; a mutation that drops the flash swap makes it fail); (3) MapService: findModes, captureScreen,
colourTable, sliceBlock, findElement, addElement (trial encode against the size cap), getElements, removeElement, elementFitsScreen, one _adopt for load and restore, persist()
no longer deletes the stored map when a document cannot be encoded; MapCodec VERSION 2 with elements (v1 still loads), MAX_ELEMENTS guard; EVENTS.MAP_ELEMENTS_CHANGED;
the .zxtm header documents the elements and a test carries them through a file; (4) tools/map-find-bench.js and docs/FIGURES.md.
The comparison row stays Partial until 11B (no UI yet). Note for 11B: ZXM export drops elements unless 11B writes them.
Next: 11B (Opus plan review first; owner questions: find key, where placeholders show, covered places, New/Open with elements, GigaScreen blended compare, 8x1 modes refused).

## Batch 11B owner answers (2026-10-14)
Find key: Ctrl+F. Covered look: numbered boxes (Shift+M switches to the element picture). A place already covered by an earlier element: left out. GigaScreen Visual compare:
the owner chose to compare BOTH SCREENS EXACTLY, not the blended colour (reversing the 11A default): MapFind visual now keys each screen on its own; red over blue no longer
matches magenta over black; the oracle test judges screens A and B separately. Modes without 8x8 colour cells stay refused (row: Same in 8x8-cell modes).
Still to ask: before 11B2 drawing on a covered place, New/Open with elements; before 11B3 the .zxm File-menu behaviour, and project/autosave carry.

## Batch 11B (find; stop A) done (2026-10-14), branch parity-d
Built: MapService.blockAt / coveredCells / placesFrom (covered places left out, overlaps resolved source-first) / clearElements, addElement reason codes ('invalid', 'tooBig');
js/ui/map-element-overlay.js (one picture-size canvas via CanvasSystem.createOverlayCanvas, z 120: hatched numbered boxes in the ZX ROM font, outlines for a find in progress; display
only); js/ui/components/map-elements-panel.js (non-modal sidebar panel: Match select, count line with aria-live, Previous / Next, Accept, Cancel, Escape); Edit > Find Map Element
(Ctrl+F, claimed with preventDefault) and View > Map Elements; every refusal says why (no selection, floating piece, mode without 8x8 colour cells). 23 i18n keys x 13. Manual: a
"Map elements" section in 85-editors.md x13 and the stale "render a map back onto the canvas" sentence removed x13. Tests: map-places (Node), map-elements-find (Playwright, 9: mouse and
keyboard flow, Ctrl+F claimed, covered places left out, Escape returns the tool keys, refusals with reasons, menu rows, modes, landscape phone 844x390). shell.spec panel order updated.
Not done (11B2): the element list (rows, delete, show places), picture display + Shift+M, New/Open guard for elements, comparison rows. (11B3): .zxm picture + elements, project/autosave carry.
Browser suite: 805 passed; one timing spec (undo-partial-capture) flaked under load as before.
OWNER (2026-10-14, before 11B2): drawing on a covered place is ALLOWED and stays hidden under the cover (no change to the write gate); New / Open / New Picture from Selection ASK before abandoning map elements.

## Batch 11B2 done (2026-10-14)
Element list in the Map Elements panel (Show walks the places and selects each; Delete asks first, picture unchanged); MapElementOverlay picture display (steady-phase colours from the same
colour table Visual compare reads; GigaScreen pair blended as the Average view shows it; test: the element picture at a place equals the canvas at the source cell, standard_ula and gigascreen),
Shift+M and View > Map Element Pictures (EVENTS.MAP_ELEMENT_DISPLAY_CHANGED keeps the tick); FileManager._confirmDropElements asks in New, Open (when the picture is replaced) and New Picture from Selection;
.zxtm and .zxm imports no longer count as replacing the picture (importsDocument = false) and a tile-only import no longer wipes the elements. 10 i18n keys x 13; manual paragraph x13.
Comparison rows: Find and create map elements -> Same in 8x8-cell modes; Map element list -> Partial (gaps listed). Playwright map-elements-list (6). Simplification vs the Opus plan: the picture display
uses the steady flash phase and does not follow Colours off / Colour grid; recorded here.
Next: 11B3 (owner questions first: .zxm from the File menu, project/autosave carry).
OWNER (2026-10-14, before 11B3): .zxm from the File menu = picture plus elements (Save Image As > ZXM, Standard ULA only; File > Open reads both; Map Editor .zxm stays tiles); .pixula project and the autosave KEEP map elements.

## Batch 11B3 done (2026-10-14) - Batch 11 complete
ZXMFormat: parse = File > Open reads the base picture (Standard ULA, through SCRFormat.importScreen) and the elements (exact match, places in cells; off-grid places dropped, misaligned ones moved to a cell, both
counted in a notice); parseTileMap / exportTileMap / exportTileMapAndDownload are the Map Editor's (renamed from parse / export / exportAndDownload; the dialog calls them); the registered 'zxm' export is the picture
writer (buildPictureText, Standard ULA only via canExportPicture, other-mode elements counted and left out with a notice); Save Image As lists ZX-Paintbrush Map (.zxm) (no Save Selection As rule on purpose: it
saves the whole picture with its elements). MapService.setElements validates a list from a project; App._getProjectData / _loadProjectData carry mapElements (autosave too); a project without them loads with none.
13 locales: 3 keys. Manual: an "In files" paragraph x13. Rows: ZXM files -> Same in Standard ULA (not checked against a file saved by ZX Paintbrush itself - owner try-this); Map element list Partial.
Tests: zxm-picture, map-elements (setElements), export-mode-matrix (zxm column) and selection-export updated on purpose; Playwright map-elements-files (5).

## Scope change and the 3-point parallelogram (2026-10-14)
OWNER: parity was asked for the ATTRIBUTE tools; the series had grown to the whole program. Instruction: continue only with what is directly tied to attribute parity. Batch 12 file items are left out
by choice (rows marked); answers on palette keys (leave menu only), stamp flip / shift gaps (leave as recorded differences) and ASM/BIN settings (leave out) are in batch-12.md / the rows. The owner chose to
BUILD the 3-point parallelogram. Opus plan review: go. Built: FigureModel type figure-parallelogram (D = A + C - B, never stored; pivot = centre of all four corners; fourth corner follows when the third point
moves), FIGURE_TYPES.PARALLELOGRAM, option lists in figure-tool.js now derived from the model (a new closed / three-point figure cannot be missed again; guard test), Shape list entry with its icon (guard test:
every Shape icon has a symbol), i18n x13 (label, hint, tool hint), manual sentence x13, Node and Playwright tests. Default taken: the third point is the corner after the second (reading (a)); the help picture was
not checked - owner try-this. Row 'Rectangle, square, rounded rectangle, parallelogram' -> Same.

## Group D review (Opus) and the fixes (2026-10-14)
Found 17 items. Fixed with a test first (tests/browser/map-elements-review.spec.js, map-elements, zxm-picture): (1) a cancelled or failed Open no longer loses elements (FileManager._askDropElements asks, elements are cleared only
after the file was read, except .zxm / .pixula which bring their own); (2) a .zxtm that brings elements asks when the picture has some (owner: ask first), a file with none leaves them alone; (3) elements belong to the
picture: the map store keeps tiles only and restorePersisted brings back no elements (owner decision); (4) Accept and Delete mark the picture modified; (5)(6) box numbers are the element's own stable number (never reused after
a delete, saved in the codec as an optional field, older files numbered in order), drawn with small 3 x 5 digits so two digits fit one cell; (7) outlines are one dark and one light pixel so a single cell stays visible;
(8)(9) Escape anywhere, hiding the panel, a new or opened picture put away an open find and the Show outlines (MapElementsPanel.dismiss); (10) a collapsed panel opens for a find; (11) Ctrl+F and Shift+M are in the F1
list; (12) Shift+M counts only elements that fit the mode; (13) the .zxm reader drops a negative place instead of refusing the file, counts an element with no places, and validates through setElements; (14) the left-out message
has no plural noun; (15) count-verdicts now reads a verdict with a note after it - the true totals are 114 functions: 76 same, 9 further, 21 partial, 6 missing, 2 n/a (27 below parity); ASM/BIN, converter and Options rows marked
left out by choice; (16) stale comments / batch-11 decisions / FIGURES updated (GigaScreen visual now 4.2 to 4.3 ms [M]); (17) ASCII in new comments.
Not changed: Ctrl+Z after opening a .zxm restores the old picture but keeps the file's elements; a find started from an already covered block keeps that block (the source is always kept); elements stay visible after converting
Standard to ULAplus/ULANext (same grid) - all three listed for the owner.

## Second review of the group D fixes (2026-10-18)
Two code reviews of commit 81a6728. Fixed with a test first (map-elements, zxm-picture, map-elements-review.spec.js: 7 new browser tests, each seen failing without the fix):
- a negative .zxm place no longer wraps into the tile map (it put a tile in the last column of the row above); a place both off the grid and off the picture counts once, as left out;
- opening a project ends an open find and takes the Show outlines away (FILE_OPEN, not FILE_IMPORT - a font import no longer cancels a find); a screen mode change takes the Show outlines away too;
- Shift+M can always turn pictures OFF, even in a mode no element fits;
- a .zxtm that replaces the elements marks the picture modified;
- unsaved work plus elements is ONE question (new key plural.confirmDiscardWithElements, 13 languages), not two in a row; New Picture from Selection clears elements only after the crop worked;
- element numbers: the highest is not handed out again after a delete; a number that is not a whole number, is used twice or is huge is replaced; pictures are keyed by list position;
- a number wider than its box (three digits on a one-cell element) is drawn in full on a dark strip instead of being cut short; the numbers go on after all boxes;
- element changes no longer rewrite the map store; Escape with nothing to put away does no redraw; which formats bring their own elements is a handler flag (importsElements);
- the .zxm left-out fallback text matches en.js; the unused ROM-glyph drawer is gone; ASCII comment fixes, and a stray control character that 81a6728 left in a tests/map-codec.test.js comment.
Still for the owner: .zxm does not store element numbers (ZX Paintbrush's format), so they are renumbered 1, 2, 3 ... when a .zxm is opened; Ctrl+Z after New Picture from Selection or opening a .zxm gives the old picture back but not its elements.
Suites (M, 2026-10-18): run-all ALL TEST FILES PASSED; test:browser 833 passed; check:manual up to date.

## Owner answers 2026-10-18 (open items after the second group D review)
1. .zxm element numbers: renumber on open; the file stays exactly ZX Paintbrush's format.
2. Undo: Ctrl+Z after New Picture from Selection or opening a .zxm must restore the elements too (and Ctrl+Y redo them). To build.
3. A find started on a block an earlier element already covers: refuse, with a notice naming that element. To build.
4. Elements stay after converting Standard ULA to ULAplus / ULANext (same grid). No change.
5. Fade brush CLUSTERED_8: correct the two swapped cells to match ZX Paintbrush's help (row 4 col 3 = 36, row 7 col 3 = 38). To build.

## Owner answers 2026-10-18 built
- 5: fade brush halftone (CLUSTERED_8) now matches ZX Paintbrush's table and Dither's cluster-8 (row 4 col 3 = 36, row 7 col 3 = 38); test in fade-dither.test.js.
- 3: a find cannot start on a block an earlier element covers (MapService.elementCovering; notice mapel.alreadyCovered, 13 languages; manual x13). Two older browser tests that re-found a covered block now start from a free one.
- 2: Ctrl+Z after opening ANY picture (not only .zxm) or after New Picture from Selection brings back the old picture with its elements; Ctrl+Y redoes both. UndoRedo.attachMapElements puts the old list on the step the open lands;
  only those steps carry elements, so Accept and Delete stay outside undo and an ordinary stroke never changes the elements (browser test). A project open still clears the history, as before. Manual x13.
- undo-partial-capture.spec.js:67 timing (M, 2026-10-18, 8 runs each, undo / redo time against packing every layer, limit 1.5): with this change 0.87-1.24 / 0.84-1.13, without it 0.84-1.18 / 0.73-1.09.
  Same spread, so the occasional failure is the known flake, not this change. The test's comment says 0.65x (2026-09-28); on this machine today it is about 1.1x, so the margin to 1.5x is smaller than it was.
Suites (M, 2026-10-18): run-all ALL TEST FILES PASSED; check:manual up to date; test:browser 837 passed, 1 failed (that timing test; passed 6 of 8 runs alone).

## Audit of parity-d against the comparison doc (2026-10-18, fixed 2026-10-19)
Seven review groups (spec-p1a, spec-p1b, spec-p2a, spec-p2b, code-io, code-tools, code-ui; workflow wf_728ea4c3-722) checked the
comparison rows and the changed code; each finding was confirmed by a second agent. 35 confirmed, 1 rejected (SVC-4: two questions
for New Picture from Selection is the recorded owner rule). Full detail and a Status line per finding: .claude/parity/AUDIT-2026-10-18.md.
All 35 are closed; each code fix has a test that was seen failing first.
- Code fixes (22): Transform > Invert / Image > Invert Dots kept the rail's colours instead of each cell's (05c2851, high); an
  own-colours stamp cell with no set dots left the background's ink (77380b2); Fill attributes wrapped across the picture edge and
  was offered where cells have no colours (9e919b8); Layer > Flatten baked in a hidden stamp (b35f273); Zoom to Fit put Timex hi-res
  under the colour rail (ddd60c9); opening a font or .spr wiped the map elements and renamed the document (high), a .zxm open
  overwrote the Map Editor tile map, Tape Blocks Load skipped the replace question, Add current screen threw in the other modes
  (e22e43f); 8x1-mode Save Selection As .asm/.c/.atr wrote the wrong attribute bytes (7c57ee6); six figure and shape editing
  defects (13f5f58); Type on canvas brought back the hidden Text box's text as a stamp (db43cf5); Shift+M pictures ignored palette
  changes, Copy colours pressed outside the picture still picked, deleting an element during a find lost its outlines, Accept after
  the block had gone gave a wrong message (e8a4912).
- Doc corrections (13, 4a0e7ca): seven rows judged too kindly are now Partial - Drawing (pixels) switch (ink and paper together
  with no dots need two passes or a whole-cell tool; a new draw mode is the owner's call), Ring, Gradient fills, CHX big fonts,
  BMP/GIF/JPG/PNG, Paste Windows graphic, Undo depth (no UI built). Wording fixed in Inverse (gradient), Invert dots and colours
  (stamp), Invert attributes (bounding rectangle), Invert pixels (menu name), Freehand (seven engines), Zoom (Ctrl+wheel). Rows the
  code fixes made out of date were brought up to date, and the new Partial rows are listed as Part 3 item 13 for the owner.
- Totals [M, count-verdicts.js, 2026-10-19]: 114 functions, 34 below parity (6 missing, 28 partial), 70 same, 8 further, 2 n/a.
  Before [M, same counter, 2026-10-14]: 27 below parity (6 missing, 21 partial), 76 same, 9 further. The per-part lines had been
  stale since 2026-10-08 / 2026-10-09 and now carry the counter's figures.
- For the owner: whether to build any of the new Partial items (Part 3 item 13); Transform > Invert acts on the bounding
  rectangle of a lasso or ellipse selection, as the dot flips do (Batch 2 recorded that rule for the attribute commands and Flip only).

## Attributes Only draw mode (owner decision 2026-10-19, built 2026-10-19)
Plan: .claude/parity/feature-attr-mode.md. A third attribute-only button after Ink Recolour and Paper Recolour on the
draw-mode bar (those two unchanged). Every drawing tool gives each cell it touches Ink, Paper, Bright and Flash and
draws no pixel; each "use existing" box keeps its attribute (Paper kept = Ink Recolour's result, Ink kept = Paper
Recolour's). Both buttons do the same; Inverse changes nothing and the status line says so; Mirror, colour core,
presets and the reload all follow it as they do Ink Recolour. Hidden in Timex hi-res (both), Layer 2 and LoRes, with
fallback to Normal.
- Why the old one was retired, and why that no longer holds: 'attributes_only' was dropped as a duplicate of the
  Recolour cell tool, but Recolour paints the whole cell under the pointer whatever the tool, while a draw mode follows
  the brush size, shape and fill area. New id 'attributes', so a preference or preset still holding the retired id
  still comes back Normal. resolveUserMode('attributes') -> the existing DRAW_MODE.ATTRIBUTES_ONLY primitive; no new
  write path.
- Label "Attributes Only" (pairs with Pixels Only; a name with "Recolour" in it is the confusion the retirement note
  warned of). dm.attributes / dm.attributes.hint in 13 languages; manual 40-colour.md x13 (new paragraph, Inverse list).
- Tests, seen failing first [M, 2026-10-19]: tests/attributes-draw-mode.test.js 28 failed checks before the code (every
  tool compared with Ink Recolour cell for cell: brush 1/5, square 9, right button, spray, pattern, rectangle outline and
  filled, ellipse, line, Bezier, pixel fill, gradient; the four boxes; Mirror; colour core; multicolour 8x1 and 8x4,
  ULAplus, ULANext, GigaScreen both screens, Layer 2 no-op); draw-mode-matrix 3, figure-tool 1, stamp-draw-mode 1;
  tests/browser/attributes-draw-mode.spec.js 5 of 6 failed on the first run, and the sixth (Mirror) passed only because
  its mirrored pixel was already ink - moved to a paper pixel, it failed too (button and tooltip, both mouse buttons on the canvas, status
  line with Inverse, Mirror, reload and preset, withdrawn in Layer 2 / Timex hi-res / LoRes). All pass after.
- Comparison: Drawing (pixels) switch -> Same. Totals [M, count-verdicts.js, 2026-10-19]: 114 functions, 33 below parity
  (6 missing, 27 partial), 71 same, 8 further, 2 n/a. Before [M, same counter, same day]: 34 (6, 28), 70 same.
- For the owner: the icon has no colour of its own in the theme palette (XOR / Every Pass has none either); the pop-up
  is two icons wide, so Attributes Only sits alone on a fourth row under Ink Recolour.
- Suites (M, 2026-10-19): run-all ALL TEST FILES PASSED; check:manual up to date; test:browser 865 passed, 2 failed -
  strip-selector.spec.js and draw-mode-tooltip.spec.js still counted six draw modes; updated to seven, both pass.

## Attributes Only draw mode - independent check (2026-10-19)
Probed in the running app (temporary Playwright specs, deleted after): brush 1 and 32, right button, rectangle,
ellipse, line, pixel fill, gradient (both phases), pattern brush, filled Figure polygon, spray and type on canvas, in
Standard ULA, multicolour 8x4/8x2/8x1, ULAplus and ULAplus 8x1, GigaScreen and MultiGiga 8x4/8x2/8x1 and ULANext. In
each, Attributes Only gave every cell exactly Ink Recolour's ink, bright and flash plus Paper Recolour's paper (both
screens in the two-screen modes), changed no pixel on either screen, and one undo restored the seed and one redo the
stroke. Inverse with both buttons and each of the four "use existing" boxes, the status line in three languages, the
rubber-band preview, and withdrawal with fallback to Normal in Timex hi-res (both), Layer 2 (256/320/640), LoRes and
Radastan all behaved as specified.
- Defect: Preferences > Inverse still said it changes nothing in "the Ink Recolour, Paper Recolour and XOR draw
  modes", leaving Attributes Only out, in all 13 languages and the English fallback; the comparison doc's Inverse mode
  row had the same omission. Fixed; tests/attributes-inverse-hint.test.js (13 failed checks before the fix) keeps every
  locale's hint naming the mode by its own label. Manual rebuilt (the Preferences picture shows the hint).
- Not changed (owner's call): the draw-mode pop-up is two icons wide, so Attributes Only sits on its own row under Ink
  Recolour rather than beside both recolour buttons.

## Undo steps setting (owner decision 2026-10-19, built 2026-10-19)
Plan: .claude/parity/feature-undo-depth.md. Preferences > General > Undo steps: how many steps Undo keeps, 1 to 2000,
500 to start with (owner decision 2026-10-19). Kept across reloads under the existing 'pref.undoLimit' key, written by
UndoRedo.setMaxStates only when the value changes (an untouched dialog stores nothing); Reset All Preferences deletes it.
Lowering the depth drops the oldest steps at once. The 256 MB memory cap (MAX_HISTORY_BYTES) stays on top, and the hint
says that on a big picture it can keep fewer steps than set; the hint takes its numbers from the constants ({min} {max} {mb}).
- Range: ZX_SPECTRUM.MIN_UNDO_LIMIT / MAX_UNDO_LIMIT = 1 / 2000 (P, owner decision; FIGURES.md row). isValidUndoLimit was
  1-500; its only callers are UndoRedo.initialize and setMaxStates, and no test relied on 500 as a maximum.
- setMaxStates now returns a promise (true once stored, false if refused or the write failed), so Preferences OK waits for
  the write and says so if it failed, as it does for the rest of the record. initialize() prunes after the stored depth
  arrives. A typed value is held to 1..2000 (Helpers clamp); an emptied field keeps the depth it had.
- Screen modes: the history is the same in every mode, so nothing is hidden or refused; only the number of steps the cap
  allows differs. [C] 2000 one-layer steps: ~16.9 MB at Standard ULA (2000 x 8,448 B), ~425 MB at LAYER2_640
  (2000 x 212,480 B), where the cap keeps ~1,263.
- i18n: pref.undoLimit, pref.undoLimitHint in 13 languages. Manual 70-menus.md x13: one paragraph.
- Tests, seen failing first [M, 2026-10-19]: tests/undo-depth.test.js 22 failed checks before the code (range constants,
  getMaxStates, isValidUndoLimit 501-2000, setMaxStates accept / refuse / store / failed write, the cap floor at depth 2000,
  the stored depth at boot and its pruning, the en text); tests/browser/undo-depth.spec.js 7 of 7 failed (field and hint,
  reload, lowering drops oldest at once, typed 5000 -> 2000 and 0 -> 1, empty and Cancel, untouched dialog and Reset All,
  depth 3 in every one of the 18 screen modes, the German hint filled in). All pass after.
- Comparison: Undo and redo -> Same. Totals [M, count-verdicts.js, 2026-10-19]: 114 functions, 32 below parity
  (6 missing, 26 partial), 72 same, 8 further, 2 n/a. Before [M, same counter, same day]: 33 (6, 27), 71 same.
- Suites (M, 2026-10-19): run-all ALL TEST FILES PASSED; check:manual up to date; the 15 specs covering the changed files
  171 passed, 1 failed - shell.spec.js:453 (draw-mode status after a reload expects "Paper Recolour", gets empty); it fails
  the same way with these changes stashed, so it is not caused by this feature.

## Undo steps setting - independent check (2026-10-19)
Probed in the running app (temporary Playwright specs, deleted): mouse strokes with the left and right button and with
Inverse on, at depth 2, in all 18 screen modes (Standard ULA, multicolour 8x1/8x2/8x4, ULAplus and its 8x1, Timex hi-res
and its GigaScreen pair, GigaScreen and multicolour GigaScreen, ULANext, Layer 2 256/320/640, LoRes and Radastan): two
steps kept each time, Undo restores each, a third Undo does nothing, Redo returns the picture. Depth 2000 at LAYER2_640:
1,400 one-layer steps kept 1,263 at 268,362,240 B [M, 2026-10-19], as the hint says. Stored garbage under pref.undoLimit
('1500' as text, 0, -3, 2.5, 2001, null, an object) boots at 500. A reload keeps the depth together with Inverse set in
the same OK. The French hint retranslates with its numbers while the dialog is open. -5 typed becomes 1. 13 translations
and the manual paragraph checked; check:manual up to date.
Two defects found and fixed:
- Redo after lowering the depth: 10 steps, undo all 10, set 3, redo all 10 left Undo able to go back 10. redo() never
  pruned; with a fixed depth the two stacks could not outgrow it, but a lowered one can. redo() now prunes like a new
  step does (every undone step is still redone). tests/undo-depth.test.js: 2 checks failed before the fix.
- The field read with parseInt: 1e3, a number the field accepts, was taken as 1 and threw away all but one step.
  It now reads valueAsNumber and rounds (7.6 -> 8). tests/browser/undo-depth.spec.js: failed (1 for 1000) before the fix.
- Not this feature: shell.spec.js:453 fails the same way on 6b01274, before the Undo steps commits.

## Gradient polygon styles, Rotation and Zoom (owner decision 2026-10-19, built 2026-10-20)
Plan: .claude/parity/feature-gradient-shapes.md. The Gradient tool's Type list gains Triangle, Pentagon, Hexagon and
Octagon (after Square; labels reuse common.triangle and shape.pentagon / hexagon / octagon). Their bands are regular
polygons round the start point, one side flat at the bottom at Rotation 0, the drag reaching the band corners.
- Rotation (opt.rotation, -180 to 180 degrees, clockwise, as the Shape tool's) and Zoom (opt.gradientZoom, 25 to 400
  percent, step 5) show for the edge-based styles only: Diamond, Square and the four polygons. Linear, Reflected,
  Conical and Spiral take their direction from the drag (Shift snaps it to 15 degrees), so Rotation is not added to
  them; Radial is round. ZX Paintbrush's help gives a zoom level to "figures that are edge-based (triangle, square
  etc.)" and does not say what it does, so Zoom scales the band spacing about the start point.
- Square and Diamond at Rotation 0, Zoom 100 read exactly the old formulas (checked pixel for pixel); quarter turns
  use exact sines and cosines, and the polygon normals are rounded to 2^-40 so the mirror and half-turn symmetries
  hold exactly on the pixel grid.
- Screen modes: only the position math changed; drawing still goes through PixelDrawRoutine.draw as before, so every
  mode behaves as with the old styles. Nothing hidden or refused. Checked in all of them by the browser spec.
- Presets: both are schema options, saved and restored; a preset saved before them leaves them where they are, as
  for every later option.
- Figures: FIGURES.md rows for the Rotation range, Zoom 25 / 400 / step 5 (C, design rules the owner may move) and
  a timing section [M, 2026-10-20]: full-canvas preview at Layer 2 640, the new styles within the old styles'
  run-to-run spread except the triangle's worst run (47.0 ms against 42.7 ms for the worst old one).
- i18n: opt.gradientZoom in 13 languages. Manual: 50-tools.md x13, one paragraph (Gradient styles, Rotation and
  Zoom); tool tables regenerated.
- Tests, seen failing first [M, 2026-10-20, gradient-tool.js stashed]: tests/gradient-shapes.test.js failed 12 checks
  (types, schema rows, setters) and then stopped at the missing getGradientRotation; tests/browser/gradient-shapes.spec.js
  6 of 6 failed. After: 132 checks pass, 6 of 6 specs pass.
- Comparison: Gradient fills and custom gradient -> Same. Totals [M, count-verdicts.js, 2026-10-20]: 114 functions,
  31 below parity (6 missing, 25 partial), 73 same, 8 further, 2 n/a. Before [M, same counter, 2026-10-19]: 32 (6, 26),
  72 same. Part 3 item 13 strikes the gradients.
- Suites (M, 2026-10-20): run-all ALL TEST FILES PASSED; check:manual up to date; whole browser suite 880 passed.
- For the owner to check by eye: the help's pictures are not in the repository, so the polygons' starting orientation
  (flat side at the bottom) is not compared against ZX Paintbrush.

## Gradient polygon styles, Rotation and Zoom - independent check (2026-10-20)
Tried: the diff; temporary Playwright probes (deleted) in all 18 screen modes comparing, for the six edge-based styles
at Rotation 37, Zoom 130, Mirror x3, the committed pixels, the phase-2 preview and the band math pixel for pixel
(0 differences anywhere); undo / redo by Ctrl+Z / Ctrl+Y and UndoRedo; the right button (reverse, 0 differences);
Inverse; GigaScreen (only the active layer changes); typed values in the number fields ('' , -200, 45.6, 999, -0 for
Rotation; '', 10, 37, 1000, 0 for Zoom - all held to the slider); a preset saved, the page reloaded, the preset
applied (style, Rotation and Zoom and the panel all restored); Rotation and Zoom changed mid-gesture (the preview
follows); boxes of 2 x 1 and 2 x 2, a zero-length axis, an axis ending off the picture, the whole picture. Also
checked: Zoom 100 against the old Square / Diamond values for 70,000 drag lengths (r x 100 / 100 differs from r in
the last bit for 11,193 of them [M], but no pixel value changes [M]); every locale's paragraph uses that locale's
panel names; the comparison totals recount the same.
One defect found and fixed:
- The Tools chapter (13 languages) and the comparison row said Repeats and Curve work with every style; the panel
  hides them for Reflected. The chapter also counted Radial among the styles that take their direction from the
  drag. Reworded in all 13 languages and the row. tests/gradient-shapes.test.js: 3 checks failed before the fix.
Not changed, for the owner: ZX Paintbrush applies its gradients as the fill of every 2D figure; PixULA's Gradient
tool fills its own five outlines or (Shape fill) any drawn outline by flood, two steps for other figures. The Zoom
400 % ceiling's working rests on the Coarse grain only; with a finer grain or a box larger than the drag, a larger
zoom would still show more. Both are design rules the owner may move.

## Elliptic, rotatable Ring (decided 2026-10-19, built 2026-10-20)
Plan: .claude/parity/feature-elliptic-ring.md. The Shape tool's Ring was always circular (radius = drag distance) with
no Rotation; ZX Paintbrush's is elliptic and turns (ring_tool.txt: "you will get an elliptic ring. Rings can be
rotated!").
- Drag: as the Ellipse - press at the centre, across sets the width, down the height. The only modifier keys a Shape
  drag has are the X / Y axis lock (and Snap); PixULA's Ellipse has no circle key, so the Ring has none either.
- Rotation: the Shape tool's Rotation row now shows for the Ring (-180 to 180, clockwise, round the centre). The ring
  turns itself (SELF_ROTATING in ShapeGenerator): it has two outlines and a fill with a hole, which the box-shape path
  cannot make. A half turn is no turn and a quarter turn swaps the radii, so those are exact; a circle does not turn.
- Inner radius (10 to 90 percent) applies to both radii.
- Equal width and height: the circular ring pixel for pixel. Pinned BEFORE the change: 234 rings (13 radii, 5 inner
  ratios, outline / thick / filled, the dash styles and Clear, rings clipped at the edges) as pixel-set hashes;
  all 234 match after it, also at Rotation 37. The button picture is pinned unchanged.
- Filled: the circular ring keeps its old row-span fill; an elliptic one tests each pixel of its turned box and keeps
  its outline, so a band thinner than a pixel stays joined. A flat drag (no height) draws a line.
- Keep editable: ShapeFigure needed no change - the Ring is centre-anchored like the Ellipse, its drag handle turns
  round the centre, the knob turns it.
- Screen modes: still a pixel list drawn through PixelDrawRoutine.draw, so nothing is mode-specific; nothing hidden
  or refused. The browser spec checks the drawn pixels equal the generator's in all 18 modes.
- No new user-facing text (opt.rotation and opt.ringInner reused). Manual: 50-tools.md x13, the Rotation sentence
  names the ring and says how it is dragged; tool tables regenerated. docs/TOOL_OPTIONS_TREES.txt gains the shape
  Rotation row (it had none). docs/FIGURES.md: timings [M, 2026-10-20] - a picture-filling elliptic filled ring costs
  up to 12.05 ms (dashed, Layer 2 640) in the generator, against 3.01 ms for the circular fill.
- Tests, seen failing first [M, 2026-10-20]: tests/elliptic-ring.test.js 26 checks failed on the old code (the pins
  among them: 231 of 234 missed; the 3 that matched are unfilled Clear rings, which draw nothing); tests/browser/
  elliptic-ring.spec.js 7 of 7 failed with shape-generator.js and shape-tool.js stashed. After: all pass.
- Comparison: Ring -> Same. Totals [M, count-verdicts.js, 2026-10-20]: 114 functions, 30 below parity (6 missing,
  24 partial), 74 same, 8 further, 2 n/a. Before [M, same counter, 2026-10-20]: 31 (6, 25), 73 same. Part 3 item 13
  strikes the ring.
- For the owner: a circular ring used to be any drag; now it needs a drag exactly on the diagonal. A circle key, if
  wanted, belongs to the Ellipse and the Ring together.
