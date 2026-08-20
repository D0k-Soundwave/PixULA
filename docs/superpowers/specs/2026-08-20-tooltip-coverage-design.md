# App-wide hover tooltip coverage — design

Status: approved in chat. Written 2026-08-20. Batch 1 (systemic fixes)
shipped and merged to main 2026-08-20 — see §7. Batches 2-4 not yet
planned.

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
2. **Main workspace sweep**: draw-mode bar, remaining flat-but-descriptive
   controls wired into two-stage (snap/mirror toggles, touch-mode status,
   zoom-level readout), pattern-panel thumbnails/list rows, preset list
   rows, Transform panel and grid-toggle buttons (unverified areas,
   confirmed here). Now also carries forward, from batch 1's own
   discoveries: `.panel-collapse` (every sidebar panel's collapse/expand
   header — matched by `TooltipManager`'s `SELECTOR` since before batch 1
   existed, still name-only) and `#merge-selected` (Layers panel Merge
   button, `js/ui/components/layer-panel.js:113` — its `title` is the raw
   hint text with no `Helpers.composeTitle(name, hint)` call at all, not
   a two-stage title in any form). Both are currently excluded from
   `tests/browser/tooltip.spec.js`'s widened sweep with a comment marking
   them as this exact gap — remove that exclusion once this batch lands
   real hints for both.
3. **Dialog sweep**: Font Editor, Map Editor, Sprite Editor, Palette
   Editor, Preset save/manage, Tape Block, Preferences, Import — whatever
   the systemic fixes in batch 1 didn't already cover.
4. **Generalized test coverage**: widen `tooltip.spec.js` per §6, confirming
   nothing from batches 1-3 slipped through.

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
- **New, discovered during batch 1's own implementation** (not part of
  the original audit): `.panel-collapse` sidebar headers and
  `#merge-selected` in `layer-panel.js` are both real, out-of-scope gaps
  — see §7 batch 2 above for detail. Neither was visible to the original
  audit pass; both surfaced only once `tooltip.spec.js`'s sweep was
  widened to cover `#panels` in batch 1's own task 5.
- Batch 1's dialog close-button task also fixed a genuine, previously
  latent interaction bug as a side effect (native dialog autofocus +
  `:focus-visible` immediately popping the tooltip on every dialog open)
  — worth checking for the same class of issue (a SELECTOR-matched
  control that happens to receive programmatic/autofocus on its
  container's own open) when batch 3 sweeps the remaining dialogs, since
  several of them (Sprite Editor, Palette Editor, Import) may have their
  own first-focusable-element in a similar position.
