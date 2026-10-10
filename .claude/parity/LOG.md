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
