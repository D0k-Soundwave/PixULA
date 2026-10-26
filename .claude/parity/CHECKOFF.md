# Group check-off (Opus)

Runs once per group, after the group's last part (table in `RUNBOOK.md`
section 0). Opus only: do the model check in RUNBOOK section 0 first.

| Group | Batches  | Branch   | Next group starts with |
|-------|----------|----------|------------------------|
| A     | 2, 3, 4  | parity-a | Batch 5 part 5A on parity-b |
| B     | 5, 6, 7  | parity-b | Batch 8 part 8A on parity-c |
| C     | 8, 9, 10 | parity-c | Batch 11 part 11A on parity-d |
| D     | 11, 12   | parity-d | nothing - the parity work is finished |

## 1. Start

1. `git status` clean; `git checkout <branch>`.
2. Read `CLAUDE.md`, `RUNBOOK.md`, every batch file in the group, and the
   group's LOG entries. List every part's "Done when" items: that list is
   what you are checking.

## 2. Review

1. `git log --oneline main..<branch>` and `git diff main...<branch> --stat`,
   then read the diff itself.
2. For every "Done when" item: built, reachable in the UI, tested by a Node
   test that would fail on broken code, handled in every screen mode the
   part lists, in the manual, translated in all 13 locales, and its row in
   `docs/ZX_PAINTBRUSH_COMPARISON.md` updated.
3. Look hard for:
   - writes that bypass `PixelDrawRoutine`, or a user action that needs more
     than one Ctrl+Z to undo;
   - missing mode gates (Timex hi-res, GigaScreen's second screen, ULAplus
     CLUT bits, ULANext, Layer 2, LoRes);
   - a second mechanism built where an existing one should have been reused;
   - tests that only check that nothing crashes;
   - figures without a provenance tag, or a decision resting on an [A] figure;
   - text that is not 7-bit ASCII (outside translations) or mentions AI.
4. Hands-on: run the app in a real browser (a Playwright script in the
   scratchpad, or Chrome) and use each new feature once in Standard,
   GigaScreen, ULAplus and Layer 2, plus any mode the part singles out.
   Check by looking: screenshots, not only state.
5. Fix what you find: smallest change first, with a test that fails first.
   Commit each fix.
6. `node tests/run-all.js`, `npm run test:browser`, `npm run check:manual`:
   all pass.
7. Correct the next group's batch files against the code as it now is:
   renamed functions, mechanisms this group added that they should reuse,
   scope this group pulled forward or left behind. This is how the plan keeps
   itself right. Commit.

## 3. Owner sign-off

1. Tell the owner, short and in plain words: what the group added, then a
   "try this" list. For each feature, say where it is and what should happen.
   Name anything left Partial, and why. Ask them to try it and say whether it
   works. Wait for the answer.
2. Problems reported: fix (test first), rerun the section 2 step 6 checks,
   and ask again.
3. When the owner says it works, ask one question: release it now as
   `<next version>` (read `APP_VERSION` in `js/core/constants.js`, add one to
   the alpha number), or merge without a release.
4. Write the check-off LOG entry (signed off, date, release yes/no) and commit
   it on the branch.
5. Release chosen: on the branch, change only the `APP_VERSION` line, run
   `node tools/build-manual.js` and `npm run check:manual`, run
   `node tests/run-all.js`, and commit `chore: release <version>`.
6. Merge and push - both, always:
   `git checkout main`, `git merge --no-ff <branch> -m "Merge branch '<branch>'"`,
   `git push origin main`. Then `git status -sb` must show main level with
   origin.
7. Release chosen: the push to main is the trigger. Confirm with `gh`:
   `gh run list --workflow release.yml --limit 3` shows a run on the merge
   commit ending `success`; `gh release view v<version> --json name,tagName,isPrerelease,assets`
   shows the zip; download it and compare with `git archive v<version>` (never
   with the working tree - some working-tree files are CRLF); the Pages copy
   https://d0k-soundwave.github.io/PixULA/js/core/constants.js serves the new
   version. Report the release link and zip link to the owner.
8. Not the last group: `git checkout -b <next branch> main`. Push nothing else.
9. If the Artifact tool is available, bring the owner's comparison page up to
   date: read https://claude.ai/artifact/Y2poDTCxxTGJNuBF61uNR7, change its
   verdicts to match the doc, and publish it back to that url. If the tool is
   not available, say so in LOG.
10. Final reply:
    - groups A to C: the part prompt for the next group's first part
      (RUNBOOK section 10, Model: Haiku, the new branch), and nothing else;
    - group D: no prompt. A short plain summary of the whole parity work, and
      every row still Partial or Missing with the reason.
