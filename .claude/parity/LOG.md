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

