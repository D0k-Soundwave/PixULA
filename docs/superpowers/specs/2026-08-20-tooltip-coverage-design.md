# App-wide hover tooltip coverage — design

Status: approved in chat. Written 2026-08-20. All four batches shipped:
batch 1 (systemic fixes) 2026-08-20, batch 2 (main workspace sweep)
2026-08-20, batch 3 (dialog sweep) 2026-08-21 and batch 4 (generalized
test coverage) 2026-08-21 — see §7. This closes the spec's execution
plan; no batch 5 is planned.

## 1. Motivation

PixULA's tool rail has a documented, tested two-stage hover convention
(`js/ui/tooltip-manager.js`): a short hover shows a control's name, a longer
hover grows it into a sentence saying what the control is FOR. It exists
because the rail prints no labels at all — hover is the only way to find out
what an icon-only button does.

That same problem exists everywhere else icon-only or under-labelled
controls appear, and it was never swept the way the rail was. An audit of
every file that sets a `title` (two fork passes this session, full results
in chat history; figures below are all M-tagged — see the figures register,
§8) found roughly 55 controls already correct (tool rail, layer panel, the
panel-header/collapse work from earlier this session), and the rest split
three ways:

- **~10-12 "flat but descriptive"** — real sentence, but delivered as a
  plain native `title` rather than the two-stage mechanism (snap toggle,
  mirror toggles, touch-mode status, zoom-level readout, several
  preset/reference hints).
- **~35-70+ "name-only"** — a label with no explanation at all. One root
  cause accounts for a large share of this: `option-controls.js`'s
  `_buildIconButton` hardcodes an empty hint for every icon-style tool
  option across every tool's `optionsSchema` (brush type, shape variants,
  etc.) — one function fix, many buttons. A second concentrated cause: three
  dialogs (Pattern Creator, Font Editor, Map Editor) each copy-pasted the
  same mini brush/eraser/line/fill toolset markup with no hints at all.
- **~13 "missing entirely"** — no `title`, no `aria-label` overlap to lean
  on. Zoom in/out/fit, and every dialog's own close button (`x`) app-wide
  (`js/ui/components/dialog.js`).

This spec covers bringing all of it up to the same standard: main workspace
(tool rail, top color bar, status strip, every sidebar panel, layer panel)
**and** every dialog (Font Editor, Map Editor, Sprite Editor, Palette
Editor, Preset save/manage, Tape Block, Preferences, Import) — the broader
of the two scopes offered, per the user's explicit choice.

## 2. Goals / non-goals

**Goals:**
- Every control matched by (or added to) `TooltipManager`'s `SELECTOR`
  carries a real name + a real "what it does / how it works" sentence, not
  just a name and not an empty second stage.
- The three dialogs sharing the copy-pasted mini-toolset get one shared fix,
  not three near-identical patches.
- Every dialog's close button gets a tooltip, in one change.
- Every new or reworded hint key is natively translated into all 13 locales
  — the established convention (`js/i18n/*.js`, `tests/i18n-parity.test.js`
  enforces identical key sets).
- A build-time test extends beyond the tool rail to catch this class of gap
  everywhere the DOM is reachable, so it cannot silently regress.

**Non-goals:**
- No new tooltip *mechanism*. `Helpers.composeTitle`/`splitTitle` and
  `TooltipManager` already do exactly what's needed; this is coverage, not
  a redesign.
- Colour swatches stay tooltip-free — already a documented, deliberate
  exception ("a colour names itself", `css/components.css`) and out of
  scope here.
- Data-readout titles (e.g. the palette editor's register swatches showing
  `ink · 0x1F`) are not "how it works" hints and are not touched — they're
  a different, already-working category.
- Preset-dialog cosmetic redundancies unrelated to missing content (e.g. a
  `title` that just repeats the element's own visible text) get cleaned up
  opportunistically if touched, but are not a goal in themselves.
- Areas the audit flagged as unverified (Transform panel, grid toggle
  buttons, Sprite Editor dialog, Import/Save/Companion dialogs,
  `CellGridEditor`'s own chrome) are confirmed and fixed as part of
  implementation, not assumed to be either fine or broken going in.

## 3. Mechanism

No new code path. Two existing patterns cover every case:

- **A control that already has a name and just needs a hint added**: give
  it a `hintI18n`/hint key and compose it in, following the tool rail's own
  pattern (`tool-rail.js`: `Helpers.composeTitle(name, hint, shortcut)`,
  `data-i18n-title` + `data-i18n-title-name` so a locale switch
  re-composes it live).
- **A control that's flat (native title, no expansion) but the text is
  already good**: add its class to `TooltipManager`'s `SELECTOR` (or give
  it an existing matched class) and split its existing string into a
  name/hint pair via `composeTitle`, rather than rewriting the copy.

**The systemic fixes, each covering many controls at once:**

1. `option-controls.js`'s `_buildIconButton` currently calls
   `Helpers.composeTitle(name, '', '')` unconditionally (line ~333). It
   needs to read a hint from the option schema entry (`opt.hintI18n`/
   `opt.hint`, added to each tool's `optionsSchema` where one is
   authored) the same way the row-level schema options already carry
   `i18n`/label data, and fall back gracefully where a hint genuinely
   doesn't apply yet (never silently regressing to worse than today).
2. Pattern Creator, Font Editor and Map Editor's mini brush/eraser/line/
   fill toolset is hand-copied three times with no hints in any copy.
   Rather than patch three call sites identically, extract one small
   shared builder (the way `captionedIconBtn` in `layer-panel.js` is
   already the one source of truth for that panel's buttons) so the three
   dialogs can't drift again. Exact location TBD at implementation time —
   likely `js/utils/helpers.js` or a small new `js/ui/components/` helper,
   decided by which of the three dialogs' surrounding code it fits best
   against without forcing an unrelated refactor.
3. `js/ui/components/dialog.js`'s close button gets one hint
   (`dialog.close` or similar), fixing every dialog in the app in one
   change.
4. `canvas-controls.js`'s zoom in/out/fit buttons get real hints — they
   currently have an `aria-label` (so assistive tech is fine) but nothing
   for a sighted mouse user hovering them.

## 4. Content-authoring style

Match the house style already established by the tool rail's hints and
`layer-panel.js`'s per-row hints — both already pass the "not just the name
again" test:

- One sentence. States what the control does, and where useful, *why* or
  *how* (the fade tool's hint is the reference example: not "Fades the
  brush" but a sentence describing the actual behavior).
- Never restates the visible name or caption.
- Written in English first (`en.js` is the key-set source of truth per
  `CLAUDE.md`), then natively translated into the other 12 locales — no
  machine translation, matching every prior i18n pass in this project's
  history.
- Reuse existing `.hint`-suffixed keys where an audited control already has
  one sitting unused nearby (the fork noted 71 `*.hint`/`*Hint`-shaped keys
  in `en.js`; some may already say the right thing and just need wiring,
  not new copy — checked per-key at implementation time rather than assumed
  free or assumed used).

## 5. i18n scale

This is the largest share of raw effort in the spec. Rough sizing: **60-90+
new or reworded keys × 12 non-English locales ≈ 700+ individual translated
strings** (C: computed from the audit's per-bucket counts — see the
figures register below). Every key still goes through
`tests/i18n-parity.test.js` (identical key sets, non-empty values,
`{param}` placeholder consistency across all 13 files) as the build gate.

## 6. Testing

`tests/browser/tooltip.spec.js` already has "every rail control has a
description that is not its own name" scoped to `#tool-rail .tool-btn`.
This spec extends that pattern rather than leaving it as the rail's private
assertion:

- A new (or widened) spec walks every control matched by
  `TooltipManager`'s `SELECTOR` in the booted main-workspace DOM, asserting
  each has a non-empty, non-name-duplicate description — the same check
  the rail already gets, generalized.
- Each dialog gets an equivalent pass after being opened (Font Editor, Map
  Editor, Sprite Editor, Palette Editor, Preset dialogs, Tape Block,
  Preferences, Import), since their controls don't exist in the DOM until
  opened.
- `node tests/run-all.js` (lint + i18n parity) and the full Playwright
  suite both stay the primary gates, run after every batch.

## 7. Execution plan (batches)

Per-chat agreement, this lands in reviewable batches rather than one pass,
each independently tested before the next starts:

1. **Systemic fixes — DONE, merged to main 2026-08-20 (commits
   0dc068d..b2dec60, merge c1d9c59).** dialog close-button hint,
   `option-controls.js` hint plumbing (mechanism only — schema hints
   authored per-tool as each tool is touched, not all at once), the
   three-dialog mini-toolset dedup, zoom in/out/fit. Unlocks the largest
   control count for the least new copy. Landed via
   `docs/superpowers/plans/2026-08-20-tooltip-batch1-systemic.md`, five
   tasks, each independently task-reviewed and approved, full Playwright
   suite green (289/289) on the merged result. Two real, previously-latent
   bugs were found and fixed/documented along the way (not planned, but
   directly caused by this batch's own changes making them newly visible):
   `dialog.showModal()` autofocusing the close button and popping every
   dialog's tooltip open on load (fixed, `js/ui/components/dialog.js`);
   and `tooltip.spec.js`'s widened sweep (task 4 below) surfacing two
   more name-only controls unrelated to any of the five tasks —
   `.panel-collapse` sidebar headers and `#merge-selected`
   (`js/ui/components/layer-panel.js`, title never composed via
   `Helpers.composeTitle` at all) — excluded from the sweep with an
   inline comment rather than fixed, since both are out of every task's
   file scope. Both are carried into batch 2/3 below.
2. **Main workspace sweep — DONE, 2026-08-20 (commits f4526a2..fa0d2a8,
   worktree `tooltip-batch2`, not yet merged to main).** draw-mode bar,
   remaining flat-but-descriptive controls wired into two-stage (snap/
   mirror toggles, touch-mode status, zoom-level readout), pattern-panel
   thumbnails/list rows, preset list rows, Transform panel and grid-toggle
   buttons — all landed via
   `docs/superpowers/plans/2026-08-20-tooltip-batch2-main-workspace.md`,
   eight tasks executed inline (no subagents — this session's harness ran
   at an unusually slow pace for dispatched agents, so the human chose
   inline execution over subagent-driven), full Playwright suite green
   (297/297) on the branch. Also fixed, carried forward from batch 1's own
   discoveries: `.panel-collapse` and `#merge-selected` (see the prior
   paragraph) both now have real hints; the exclusion batch 1 added for
   them is removed. Most of this batch turned out to be systemic wiring
   (reusing already-correct hint sentences that just weren't composed with
   a name or matched by `SELECTOR`) rather than fresh content authoring —
   the plan's own architecture note called this in advance and it held;
   the true content-authoring work was almost entirely the Transform
   panel (14 new keys) plus the draw-mode bar (5), three new grid-size
   toggles (6) and one pattern-thumbnail hint (1).

   Two deviations from the plan's literal text, both resolved during
   implementation rather than needing a ruling: (1) the plan's Task 7
   assumed `TransformPanelClass` had its own `_t()` translation helper
   (matching every other file in this batch) and specified a manual
   title-stamping loop using it — that class has no such method and never
   needed one, since its whole body is a static `innerHTML` template that
   already relies entirely on the existing `I18n.apply(this._content)`
   call in `init()` to translate everything, `[data-i18n-title]` included.
   The manual loop was removed as both unnecessary and broken; adding the
   `data-i18n-title-name`/`data-i18n-title` attribute pairs to the
   template was sufficient on its own. (2) Task 8's widened sweep, once it
   started walking `#transform-panel`, caught the shared shift dir-pad
   zones (`Helpers.buildDirPad()`, `.dir-pad-zone`) as a new failure —
   they match `SELECTOR` via `[data-tp-transform]` but deliberately carry
   no hint (see the Global Constraints note on why one hint text can't
   serve both the Transform panel and Reference panel contexts it's
   shared between). Excluded with a comment in `tooltip.spec.js`, the same
   pattern as the `.panel-collapse`/`#merge-selected` exclusion batch 1
   used and this batch just removed — carried forward as a real, still-
   open gap for whoever eventually parameterizes `buildDirPad()`.
3. **Dialog sweep — DONE, shipped 2026-08-21 (commits 3c28a2e..068c021,
   worktree `tooltip-batch3`, branch `tooltip-batch3` forked from main at
   `ae0dc40`, not yet merged to main).** Font Editor's 10 glyph-op buttons;
   Map Editor's 4 tool buttons + 2 zoom buttons (the zoom hints reused
   batch 1's own `view.zoomOut.hint`/`view.zoomIn.hint` rather than
   duplicating them); Sprite Editor (its mini-tools row was deduped onto
   the shared `Helpers.miniToolButton` builder alongside Font/Map Editor,
   then its remaining 12 buttons — nav prev/next plus 10 ops/bridge/file
   buttons — got real hints); Palette Editor (4 tool buttons + 1 kind
   select — pure wiring, the hint content already existed in all 13
   locales from an earlier pass and just needed the two-stage mechanism);
   the Tape Block dialog's 4 row-action buttons; the Import dialog's 3
   conversion-method panes (hint content drawn from the authoritative
   source comment in `js/io/png-format.js`, which also gained a `hint`
   field on `IMPORT_METHODS` as the single source of truth); and the
   Workspace Presets manager's 5 row-action buttons (notably
   disambiguating Load vs Replace, which are easy to confuse).

   Explicitly OUT of scope, verified during planning with reasons:
   Preferences dialog (every row already has a permanently visible hint
   sentence, not hidden behind hover — a different, already-correct
   mechanism), generic dialog-footer buttons app-wide (Close/Cancel/OK/
   Save/etc, same reasoning batches 1-2 used to exclude `.panel-button`),
   Companion dialog, Tool Preset save/rename dialog, Save Project dialog
   (none have icon-only or genuinely unexplained controls), and
   `CellGridEditor`'s own chrome (it's a bare canvas with no DOM chrome of
   its own — every dialog that embeds it builds its own surrounding
   toolbar, which the batch does cover).

   8 tasks executed via subagent-driven-development (fresh implementer
   subagent per task, task review after each — two tasks needed one fix
   round each: Tape Block needed a French-preposition and Turkish-case-
   ending translation correction; Palette Editor's test needed widening to
   also cover the kind-select in an rgb333 mode, not just ULAplus), full
   Playwright suite green (305/305) on the branch, plus the final whole-
   branch review (also clean, no Critical findings).

   Two deviations found during implementation, worth recording: (i) the
   plan's Task 8 brief cited stale en.js line numbers for the anchor point
   of the `preset.*` keys — the implementer located the real anchor by
   grep instead, no duplicates resulted; (ii) the final whole-branch
   review found one PRE-EXISTING defect unrelated to this batch's own new
   work — `layer.mergeSelected.hint` is defined twice in all 13 locale
   files (from an earlier batch), with the later (name-restating)
   definition winning silently since `tests/i18n-parity.test.js` `eval`s
   each file into an object and can't see a duplicate literal key —
   deliberately NOT fixed on this branch (it predates batch 3), carried
   forward as a concrete batch-4 item instead (see §9).
4. **Generalized test coverage — DONE, shipped 2026-08-21 (commits
   92a47f4..ff92d01, worktree `tooltip-batch4`, branch `tooltip-batch4`
   forked from main at `befa7a4` — the batch 3 merge commit — not yet
   merged to main).** `tests/i18n-parity.test.js` gained a raw-source
   (pre-`eval`) duplicate-key scan, since the existing eval-based loading
   silently collapses a key defined twice in the same file to its last
   definition — invisible to any check on the resulting object. This
   immediately caught a real, pre-existing defect carried forward from
   batch 3's own review: `layer.mergeSelected.hint` was defined twice in
   all 13 locale files, with the name-restating second definition silently
   winning; fixed by deleting the duplicate in all 13 files. Separately,
   `tests/browser/tooltip.spec.js`'s sweep design was corrected: the
   existing sweep queried `document.querySelectorAll(TooltipManager.SELECTOR)`
   directly, which can never detect a class *dropped* from `SELECTOR`
   (removing a class from the query used to find elements just makes them
   invisible to it, not flagged) — this was also carried forward from
   batch 3's review. Fixed by sweeping via the `data-i18n-title-name`
   marker attribute instead (the universal marker every two-stage control
   already sets) and separately asserting each match found that way is
   also matched by `SELECTOR`, applied to both the existing main-workspace
   sweep test and one new test that opens each of batch 3's seven dialogs
   (Font Editor, Map Editor, Sprite Editor, Palette Editor, Tape Block,
   Import, Workspace Presets manager) in turn and sweeps each one's body.

   A significant organic finding: the strengthened design caught a REAL,
   previously-undetected production bug unrelated to anything this batch
   originally targeted — the Transform panel's Outline gap/thickness range
   inputs (`.tp-og`, `.tp-os`) were fully wired with two-stage title
   attributes since an earlier batch (commit `fb461be`) but were never
   added to `TooltipManager.SELECTOR`, so they never actually got the
   styled tooltip on hover despite passing their own dedicated test. Fixed
   with a one-line `SELECTOR` addition alongside the test that found it —
   the final whole-branch reviewer called this "the strongest possible
   evidence the design works."

   2 tasks executed via subagent-driven-development (fresh implementer
   subagent per task, task review after each). One task needed a mid-task
   recovery: the implementer hit an external API session-limit error
   partway through and had to be resumed; on resume the controller briefly
   misjudged the `.tp-og`/`.tp-os` fix as unrelated stray content and asked
   for it to be reverted, but the implementer correctly pushed back with
   evidence from its own tool history and kept the fix — independently
   reverified as legitimate by both the task reviewer and the final
   whole-branch reviewer (via `git show fb461be`). Full Playwright suite
   green (306/306) on the branch, plus the final whole-branch review (also
   clean, no Critical/Important findings, "Ready to merge: Yes").

   Deviations found during implementation, worth recording: (i) two small
   test-hygiene additions the plan didn't anticipate — a
   `page.mouse.move(2, 2)` guard before each dialog sweep (a resting
   cursor over a freshly-opened dialog can otherwise strip a title via
   `TooltipManager`'s own hover-clearing behavior) and switching back to
   `standard_ula` mode before building the Tape Block test's TAP file
   (since the preceding Palette Editor section leaves the document in an
   rgb333 mode, and `TAPFormat.export` requires the standard classic
   layout); (ii) the final whole-branch review found two small residual
   test gaps and asked for them to be closed in this same closing pass —
   see this same commit for what was added: a direct
   `TooltipManager.SELECTOR` membership assertion on `.pattern-item`
   (`tests/browser/pattern-thumbnail-tooltip.spec.js`, the one control
   whose name has no i18n key and so never sets `data-i18n-title-name`,
   making it invisible to the new marker-based sweep) and an
   at-least-one-match assertion on both sweeps (`tests/browser/tooltip.spec.js`),
   closing the mirror-image gap where a sweep finding zero controls at all
   would previously have passed just as silently as one finding only good
   ones.

Each batch: author English copy -> translate to 12 locales -> wire the
mechanism -> `node tests/run-all.js` -> relevant Playwright specs -> report
back before starting the next batch.

## 8. Figures register

| Figure | Value | Tag | Source |
|---|---|---|---|
| Controls already correct | ~55 | M | fork audit, this session, grep + read across 23+ files |
| Flat-but-descriptive controls | ~10-12 | M | same audit |
| Name-only controls | ~35-70+ | M (range reflects unknown per-tool schema hint-button count) | same audit |
| Missing-entirely controls | ~13 | M | same audit |
| Unused `*.hint`/`*Hint`-shaped keys in en.js | 71 | M | same audit, not individually cross-referenced |
| New/reworded key count | 60-90+ | A | extrapolated from name-only + missing-entirely bucket sizes; will be M once batch 1-3 copy is actually authored |
| Non-English locale count | 12 | M | `js/i18n/` directory listing (13 files total incl. en.js) |
| Estimated total translated strings | 700+ | C | 60-90 keys x 12 locales, lower bound |

## 9. Open items carried into implementation

- Exact location for the shared mini-toolset builder (Pattern
  Creator/Font Editor/Map Editor) — **resolved**: `Helpers.miniToolButton`
  in `js/utils/helpers.js`, immediately after the existing
  `captionedButton` (the same file/location the plan's own §3 mechanism
  note guessed at). All three dialogs now call it.
- Whether `option-controls.js` schema hints get authored tool-by-tool
  across batches 1-3, or held until a dedicated pass — **confirmed**: "as
  each tool is touched" is the approach that shipped. Batch 1 landed the
  `hintI18n` mechanism in `_buildIconButton` plus exactly one proof
  category (Shape Type's "basic": line/rectangle/square/rounded-rectangle,
  4 keys). Every other tool's icon-grid options — including Shape Type's
  own radial/polygons/symbols/complex categories — remain untouched and
  name-only, verified backward-compatible by that task's own reviewer
  (an option with no `hintI18n` renders byte-identically to before,
  confirmed by tracing `Helpers.composeTitle`'s degenerate-argument path).
  Batch 2/3 should keep authoring `hintI18n` per-tool as each is swept,
  not hold it for a dedicated mechanical pass.
- The unverified areas (Transform panel, grid toggles, Sprite Editor,
  Import/Save/Companion dialogs, `CellGridEditor` chrome) are confirmed
  fresh at the start of batch 2/3 rather than trusted from the audit
  summary, since that pass explicitly flagged them as time-boxed-out.
  **Batch 2 covered its share**: Transform panel and grid toggles are
  done (see §7 batch 2). **Batch 3 covered its share too**: Sprite Editor
  and Import are done (see §7 batch 3); Save/Companion dialogs were found
  to need no changes on inspection — no icon-only controls; `CellGridEditor`
  chrome turned out to be a bare canvas with no chrome of its own, so there
  was nothing there to fix.
- **New, discovered during batch 1's own implementation** (not part of
  the original audit): `.panel-collapse` sidebar headers and
  `#merge-selected` in `layer-panel.js` were real, out-of-scope gaps for
  batch 1 — see §7 batch 2 above for detail. Neither was visible to the
  original audit pass; both surfaced only once `tooltip.spec.js`'s sweep
  was widened to cover `#panels` in batch 1's own task 5. **Resolved in
  batch 2** (both now have real two-stage hints; the exclusion is
  removed).
- **New, discovered during batch 2's own implementation** (not part of
  the original audit, and not visible to batch 1's own sweep since it
  never walked `#transform-panel`): the shift dir-pad zones
  (`Helpers.buildDirPad()`, `.dir-pad-zone`, shared verbatim by the
  Transform panel and the Reference panel) match `TooltipManager`'s
  `SELECTOR` via `[data-tp-transform]` but carry no hint at all —
  deliberately, since one hint text would be right for one of their two
  contexts and wrong for the other, and the builder takes no parameter to
  vary it. Excluded from `tooltip.spec.js`'s sweep with a comment (the
  same pattern as the resolved gap above). Real fix needs either a
  parameter on `buildDirPad()` or two separate builders — a design
  decision, not a mechanical batch-3 task; flagging here so batch 3's
  planning doesn't rediscover it from scratch.
- Batch 1's dialog close-button task also fixed a genuine, previously
  latent interaction bug as a side effect (native dialog autofocus +
  `:focus-visible` immediately popping the tooltip on every dialog open)
  — worth checking for the same class of issue (a SELECTOR-matched
  control that happens to receive programmatic/autofocus on its
  container's own open) when batch 3 sweeps the remaining dialogs, since
  several of them (Sprite Editor, Palette Editor, Import) may have their
  own first-focusable-element in a similar position. **Checked during
  batch 3 and found already discharged**: the fix is systemic — `dialog.js`
  redirects focus to the dialog element itself after `showModal()` (see
  `js/ui/components/dialog.js` around lines 111-119), and Sprite Editor,
  Palette Editor and Import all open via the shared `Dialog.open()`, so
  none of them re-triggers the bug — confirmed by the final whole-branch
  reviewer, no code change needed.
- **New, discovered during the final whole-branch review of batch 3, for
  batch 4 to pick up** — two things, neither of them batch 3's own job:
  (a) the `layer.mergeSelected.hint` pre-existing duplicate-key defect
  described in §7 batch 3, plus the systemic point behind it —
  `tests/i18n-parity.test.js` `eval`s each locale file into an object, so a
  duplicate literal key anywhere in any file is structurally invisible to
  that test; a raw-source duplicate-key scan (a short regex over the file
  text, not the evaluated object) should be added to that test, and would
  have caught this on its own; (b) `tooltip.spec.js`'s own SELECTOR-sweep
  test (the "every two-stage control ... has a real description" test) is
  scoped to `#tool-rail, #panels, #zoom-controls, .app-dialog-header` and
  never walks an OPEN dialog's body — so a class silently dropped or
  mistyped in a future `TooltipManager.SELECTOR` edit inside any dialog
  would leave every per-dialog spec in this batch green (they only check
  that a title splits correctly, not that the SELECTOR match itself is
  intact) with no tooltip ever actually appearing; batch 4's "generalized
  test coverage" widening should extend that sweep to walk each dialog's
  body while it's open, not just the main workspace chrome.

  **Both resolved in batch 4**: (a) by the raw-source duplicate-key scan
  added to `tests/i18n-parity.test.js`, which also fixed the specific
  `layer.mergeSelected.hint` instance across all 13 locales; (b) by the
  marker-attribute (`data-i18n-title-name`) plus SELECTOR-membership sweep
  design in `tests/browser/tooltip.spec.js`, applied to all seven dialogs
  batch 3 wired.
- **New, discovered during the final whole-branch review of batch 4** (the
  effort's last batch — recorded here for the historical record, since
  there is no batch 5 to hand these off to): (a) the sweep design has one
  small, correctly-scoped exception — `.pattern-item` (pattern library
  thumbnails) composes a two-stage title but never sets
  `data-i18n-title-name` (its name half is a user-supplied pattern name
  with no i18n key, so there is nothing to attach that marker to), so it
  was covered by the old SELECTOR-based sweep but not by the new
  marker-based one — closed in this same batch by adding a direct
  SELECTOR-membership assertion to that control's own dedicated spec
  instead (`tests/browser/pattern-thumbnail-tooltip.spec.js`); (b) both
  sweeps could previously report success on a `[]` empty result even if
  nothing was found at all (a dialog failing to render its expected
  controls, for instance) — the mirror-image gap to what this whole batch
  closes — closed in this same batch by asserting each sweep actually
  finds at least one matching control; (c) one piece of housekeeping the
  final reviewer flagged as explicitly OUT of this batch's own scope,
  worth a bullet so it isn't lost: `CLAUDE.md` still states figures (i18n
  key count, browser spec file/test counts) that are now stale after four
  batches of this work (measured reality: 1050 i18n keys, 306 tests across
  52 files, vs. the file's stated 962/281/34) — `CLAUDE.md` itself names
  `docs/CURRENT_STATE.md` as the authority for those figures, but that
  file doesn't exist in this repo, so there is currently no doc carrying a
  correct tally; this is a repo-hygiene item outside the tooltip-coverage
  effort itself, not something this spec's own batches should absorb.
