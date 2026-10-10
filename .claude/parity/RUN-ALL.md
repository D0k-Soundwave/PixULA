# One-run plan for the rest of the series (set 2026-10-09)

Replaces the "one prompt per part" hand-off for the remaining parts. The
owner asked for Sonnet to carry the remaining stages in one continuous run.
RUNBOOK.md still governs how each part is built; this file only changes the
order, the review points and the stops.

## Changes to the RUNBOOK for this run

- Model: Sonnet builds every part (the owner's choice). ALL the Opus review
  stages stay, in two places:
  1. The Opus plan review before each part's code (RUNBOOK sections 3 and 5),
     exactly as written: mandatory, once per part, and before changing
     PixelDrawRoutine, the LayerManager compositor, UndoRedo,
     ScreenModeService or a file format's byte layout.
  2. An Opus review of the finished code at the end of each part group (below).
  Opus is also consulted whenever RUNBOOK section 5 says "when needed" (a test
  failing after two fixes, an undecided design). Every consult is recorded in
  the part's LOG entry.
- No hand-off prompt after each part: go straight to the next one. Still do
  every other step of RUNBOOK section 9 for each part (tests, manual,
  comparison doc, LOG entry, commit).
- Never push, merge, tag or release. Everything stays committed locally on the
  group branches. The owner decides that at the sign-offs.
- Context gets summarised in a run this long. After any summary, re-read this
  file, RUNBOOK.md, the current batch file and the last LOG entry.

## Order

| Step | Work | Branch |
|------|------|--------|
| 1 | 3B | parity-a |
| 2 | 4A (STOP: ask the owner, see below), 4B | parity-a |
| 3 | Group A end-of-build Opus review (below) | parity-a |
| 4 | 5A, 5A2, 5B, 5C | parity-b (from parity-a, see below) |
| 5 | 6A (STOP: ask the owner), 6B | parity-b |
| 6 | 7A, 7B, 7C | parity-b |
| 7 | Group B end-of-build Opus review | parity-b |
| 8 | 8A, 8B, 9A, 9B, 10A, 10B, 10C | parity-c |
| 9 | Group C end-of-build Opus review | parity-c |
| 10 | 11A, 11B | parity-d |
| 11 | 12A (STOP: ask the owner, one item at a time), then 12B onwards | parity-d |
| 12 | Group D end-of-build Opus review | parity-d |

Branches: the RUNBOOK says a new group starts from main. main does not yet
hold group A (nothing is merged), so each new group branch starts from the
previous group's branch instead: `git checkout parity-a`, then
`git checkout -b parity-b`. This keeps the series one straight line of commits
and makes the eventual merge a single fast-forward chain. LOG this in the
first entry of each new group.

## Stops (owner questions, RUNBOOK section 6)

The owner chose to be asked at each of these, then the run continues:
- 4A: where the Inverse switch goes; where the three new cell tools go
  (measure the strip first, as the batch file says).
- 6A: the CLUT keys (test the key combinations first, as the batch file says).
- 12A: every Batch 12 item, one question at a time, each with its cost.
Anything else marked OWNER, or any decision Opus says only the owner can make:
ask then, one question at a time.

## End-of-build Opus review (each group)

After the group's last part, before moving on: the Agent tool, subagent_type
"Plan", model "opus". Give it the git range for the group, the batch files'
"Done when" lists, and the CHECKOFF.md section 2 list; ask it to find what is
wrong or missing and to run the tests. Apply every correction with a failing
test first, rerun run-all, test:browser and check:manual, commit, and write
the consult into the LOG. This is the review the 3A build used (it found a
committed-CRLF file and a flicker bug the tests had not).

## What is left for the owner after the run

CHECKOFF.md section 3 (the "try this" list, merge, release) for each group,
asked of the owner at the end: nothing is merged or released by the run.
