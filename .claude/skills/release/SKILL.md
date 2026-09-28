---
name: release
description: Publish a new PixULA release end to end from a Claude Code on the web session - bump APP_VERSION, regenerate the manual, run the tests, merge to main, and confirm the GitHub Release and its zip are live. Use whenever the owner asks to release, publish, ship, cut a version, or "update the release".
---

# Releasing PixULA

The owner works only through Claude Code on the web and expects a release to
happen entirely on request, with no manual steps on their side. Do every step
below yourself, then report the release link.

## How releases work (read once)

- A release is a new `APP_VERSION` (`js/core/constants.js`) reaching `main`.
- `.github/workflows/release.yml` runs automatically when a push to `main`
  changes `js/core/constants.js`. If `v<APP_VERSION>` has no tag yet, it tests,
  builds the portable zip, creates the tag and publishes the GitHub Release.
  If the tag exists (the edit was not a version bump) it stops successfully
  and publishes nothing.
- Only the newest release is public (the owner's choice, 2026-09-28): the
  workflow's last step turns every older release into a draft. Drafts are
  hidden from visitors and their download links stop working, but nothing is
  deleted - the tags and zips stay, and "Publish release" on a draft's Edit
  page brings it back. Signed in, the owner still sees them marked Draft.
- Web sessions cannot push tags (the push is refused), so never try; the
  merge to `main` is the trigger. `Actions > Release > Run workflow` on `main`
  is the manual fallback (GitHub MCP `actions_run_trigger`, method
  `run_workflow`, `workflow_id: release.yml`, `ref: main`).
- The GitHub Pages copy of the app (https://d0k-soundwave.github.io/PixULA/)
  is published from `main` by GitHub's own "pages build and deployment" run,
  so it updates on the merge too. The empty `.nojekyll` file at the repo root
  must stay: without it GitHub runs Jekyll over the whole repo, and any `{{`
  in a Markdown note (the plans under docs/ have them) crashes the build and
  freezes the live site - it sat at 0.1.0-alpha.5 from 2026-09-23 to
  2026-09-27 for exactly that reason.

## Steps

1. **Start from the latest `main`** on the session's designated branch:
   `git fetch origin main && git checkout -B <branch> origin/main`. Anything
   the release should contain must already be merged, or be merged first.

2. **Pick the version.** Read `APP_VERSION` in `js/core/constants.js`. Unless
   the owner names one, increment the pre-release number
   (`0.1.0-alpha.10` -> `0.1.0-alpha.11`). Check the tag is free:
   `git ls-remote --tags origin v<version>` must print nothing.

3. **Bump and regenerate.** Change only the `const APP_VERSION = '...'` line,
   then run `node tools/build-manual.js` (the manual embeds the version, the
   menus' shortcuts and fresh screenshots) and `node tools/build-manual.js --check`.
   The SessionStart hook (`.claude/hooks/session-start.sh`) installs
   Playwright and points its Chrome channel at the container's Chromium; if
   the manual build cannot find Chrome, run that hook by hand.

4. **Test.**
   - `node tests/run-all.js` must print `ALL TEST FILES PASSED`. No exceptions.
   - `npm run test:browser` must pass too. The font, speed and timing specs
     judge against the machine they run on (installed fonts via fontconfig,
     the exact path's own cost, frames counted during the drag), so they
     pass in the cloud container as well as on a desktop. A failure is real:
     re-run that one spec alone once to rule out a stalled runner, and if it
     fails again, fix it before releasing.

5. **Commit** `js/core/constants.js` and `js/data/manual-content.js` as
   `chore: release <version>` (plus the session's attribution trailers), and
   push the branch.

6. **Merge.** Open a pull request to `main` with the GitHub MCP tools and merge
   it (`merge_method: merge`, as the history does). The owner asking for a
   release is the approval for this merge.

7. **Confirm it published.** `actions_list` / `list_workflow_runs` for
   `release.yml` should show a `push` run on the merge commit; wait for it
   (poll `get_workflow_run`, about 30 seconds) and require
   `conclusion: success`. Then `get_release_by_tag v<version>` must show a
   published pre-release with `PixULA-<version>.zip` in its assets, and
   `list_releases` must show every other release with `draft: true`. If no run
   appeared within two minutes, use the Run workflow fallback above. If the
   run failed, read its logs (`get_job_logs`), fix, and release again with
   the same version (its tag was never created).
   Also confirm the website: `list_workflow_runs` (no workflow filter) shows a
   `pages build and deployment` run for the same merge commit; it must end
   `success`. A failure there means the live site did not update - read its
   `build` job log and fix the cause.

8. **Report** to the owner in plain words: the version, the release page
   `https://github.com/D0k-Soundwave/PixULA/releases/tag/v<version>`, the
   zip's download link from the release assets, that the online copy has
   updated, that older releases are hidden, and what changed since the
   previous release (the release notes list the merged pull requests).
