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
