# Tooltip Batch 4: Generalized Test Coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the two defect classes batches 1-3 could only catch by manual
reviewer effort self-enforcing in the test suite: a duplicate i18n key
silently shadowing a real hint, and a `TooltipManager.SELECTOR` entry
dropped or mistyped inside a dialog body (which every existing per-dialog
spec is blind to, since they only check that a title splits correctly, not
that the SELECTOR match fired at all).

**Architecture:** Two independent, small fixes. No new mechanism —
`tests/i18n-parity.test.js` gains a raw-source (pre-`eval`) duplicate-key
scan alongside its existing evaluated-object checks; `tests/browser/
tooltip.spec.js`'s sweep logic is strengthened to detect a class dropped
from `TooltipManager.SELECTOR` (which a naive `querySelectorAll(SELECTOR)`
sweep cannot, by construction — see the design note at the start of
Task 2), applied both to its existing main-workspace test and to one new
test that opens each of the seven dialogs batch 3 covered in turn and
sweeps each dialog's body the same way.

**Tech Stack:** Node (no dependencies) for the i18n-parity fix; Playwright
for the widened dialog sweep.

**Spec:** `docs/superpowers/specs/2026-08-20-tooltip-coverage-design.md`
(this plan implements §7 batch 4; the two targets below are both drawn
verbatim from batch 3's final-review carry-forward, recorded in that spec's
§9).

## Global Constraints

- No new tooltip mechanism, no new hint content. This batch is test
  infrastructure only.
- `node tests/run-all.js` (lint + i18n parity) and the full Playwright
  suite are the gates, run after each task.
- The i18n-parity fix must scan the raw file TEXT, not the evaluated
  `window.i18n_<code>` object — `eval`-based loading silently collapses a
  duplicate literal key to its last definition, which is exactly the defect
  class this task exists to catch. A check performed on the evaluated
  object cannot see it, by construction.
- Every dialog the widened sweep opens must also be closed (Escape) before
  the next one opens — the app boots once for this whole test, so a dialog
  left open would contaminate the next dialog's sweep.

---

### Task 1: `i18n-parity.test.js` gains a raw-source duplicate-key scan, and the live duplicate it finds gets fixed

**Files:**
- Modify: `tests/i18n-parity.test.js`
- Modify: `js/i18n/en.js:424`, `js/i18n/cs.js:457`, `js/i18n/de.js:457`,
  `js/i18n/es.js:457`, `js/i18n/fr.js:457`, `js/i18n/hu.js:457`,
  `js/i18n/it.js:457`, `js/i18n/pl.js:457`, `js/i18n/pt.js:457`,
  `js/i18n/ro.js:457`, `js/i18n/ru.js:457`, `js/i18n/sk.js:457`,
  `js/i18n/tr.js:457` (delete one duplicate line each — see Step 5)

**Interfaces:**
- Consumes: nothing new.
- Produces: a `duplicateKeys(text)` helper function inside
  `tests/i18n-parity.test.js` (test-local, not exported) that later tasks in
  this batch do not depend on.

- [ ] **Step 1: Confirm the live defect exists, as a manual check**

Run: `node -e "const fs=require('fs'); const t=fs.readFileSync('js/i18n/en.js','utf8'); console.log((t.match(/'layer\.mergeSelected\.hint'/g)||[]).length)"`
Expected: `2` — confirming `en.js` currently defines `'layer.mergeSelected.hint'` twice (lines 423 and 424; the second, added later, silently wins at eval time and reads "Merge selected layers" — a restatement of the button's own name, "Merge" — shadowing the real, correctly-authored hint on the line above it, "Merges every selected layer down into the one below it"). This is present in all 13 locale files identically (verified during planning: `grep -n "layer.mergeSelected.hint" js/i18n/*.js` shows the same two-line pattern, informative-then-restating, in every file).

- [ ] **Step 2: Write the failing test (the scan, before the fix)**

In `tests/i18n-parity.test.js`, add a raw-source duplicate-key scan.
Immediately after the existing `loadTable` function (currently lines 24-30),
add:

```js
/**
 * Duplicate literal keys in a JS object-literal source file are invisible
 * to loadTable() above: `eval`-based loading collapses `'k': 'a', 'k': 'b'`
 * to the object `{k: 'b'}`, so a second, accidental definition of an
 * existing key silently wins and every check downstream only ever sees the
 * winner. This scans the raw TEXT instead, matching each top-level
 * `'key.name':` line the same way every locale file writes one (single
 * quotes, one key per line, per the established convention), and reports
 * any key that appears more than once.
 */
function duplicateKeys(text) {
  const counts = new Map();
  const re = /^\s*'([^']+)'\s*:/gm;
  let m;
  while ((m = re.exec(text))) {
    counts.set(m[1], (counts.get(m[1]) || 0) + 1);
  }
  return [...counts.entries()].filter(([, n]) => n > 1).map(([k]) => k);
}
```

Then, in the per-locale loop (currently lines 50-65), add a duplicate check
using the raw file text rather than the evaluated table. The loop currently
reads:

```js
for (const { code, table } of locales) {
  const missing = enKeys.filter((k) => !(k in table));
  const extra = Object.keys(table).filter((k) => !(k in en.table));
  if (missing.length) fail(`${code}: missing ${missing.length} key(s): ${missing.join(', ')}`);
  if (extra.length)   fail(`${code}: extra ${extra.length} key(s): ${extra.join(', ')}`);
```

`loadTable` only returns `{ code, table }` (the evaluated object), not the
raw text, so change `locales` to carry the raw text too. `loadTable`
(currently lines 24-30) becomes:

```js
function loadTable(file) {
  const text = fs.readFileSync(file, 'utf8');
  const win = {};
  new Function('window', text)(win);
  const key = Object.keys(win).find((k) => k.startsWith('i18n_'));
  if (!key) throw new Error(`${path.basename(file)} did not set window.i18n_<code>`);
  return { code: key.slice(5), table: win[key], text };
}
```

And the per-locale loop gains one more check, right after the existing
`extra` check. `loadTable` now returns `text` alongside `code`/`table` (per
the change above), so destructure it in the loop too. Change the loop's
opening line from `for (const { code, table } of locales) {` to
`for (const { code, table, text } of locales) {`, then add, directly after
the existing `extra` line:

```js
  const dupes = duplicateKeys(text);
  if (dupes.length) fail(`${code}: duplicate key(s) defined more than once: ${dupes.join(', ')}`);
```

- [ ] **Step 3: Run the test to verify it fails (RED)**

Run: `node tests/i18n-parity.test.js`
Expected: FAIL, reporting `duplicate key(s) defined more than once:
layer.mergeSelected.hint` for all 13 locale codes (en, cs, de, es, fr, hu,
it, pl, pt, ro, ru, sk, tr).

- [ ] **Step 4: Confirm the summary line still reports correctly**

Read the file's closing block (currently lines 68-71) — no change needed
there; `failures` already counts every `fail()` call including the new one,
so the existing summary/exit-code logic covers this for free.

- [ ] **Step 5: Fix the live duplicate in all 13 locale files**

In each of `js/i18n/en.js`, `cs.js`, `de.js`, `es.js`, `fr.js`, `hu.js`,
`it.js`, `pl.js`, `pt.js`, `ro.js`, `ru.js`, `sk.js`, `tr.js`: find the two
adjacent `'layer.mergeSelected.hint'` lines (the informative one, then the
name-restating one immediately below it) and delete the SECOND line only
(the one that currently wins by being last), leaving the first, correctly
authored hint in place. For `en.js` specifically, this means deleting line
424 (`'layer.mergeSelected.hint': 'Merge selected layers',`) and keeping
line 423 (`'layer.mergeSelected.hint': 'Merges every selected layer down
into the one below it',`). Every other locale file has the exact same
two-line shape at the equivalent point (confirmed at line 456-457 in each
non-English file during planning) — delete the second (restating) line in
each, keep the first (informative) one.

- [ ] **Step 6: Run the test to verify it passes (GREEN)**

Run: `node tests/i18n-parity.test.js`
Expected: `i18n-parity: 13 locales × <N> keys consistent` followed by
`ALL CHECKS PASSED`, with `<N>` one less than before (one key's duplicate
definition removed from every file, so the total literal-key COUNT per
file drops by 13 lines total across all locales, but the KEY COUNT reported
— which is `Object.keys(en.table).length`, already deduplicated by `eval`
even before this fix — is unchanged, since the duplicate never added a
second distinct key to the object in the first place; only the raw-source
scan is new information here).

- [ ] **Step 7: Run the full gate**

Run: `node tests/run-all.js`
Expected: `ALL TEST FILES PASSED`.

- [ ] **Step 8: Commit**

```bash
git add tests/i18n-parity.test.js js/i18n/en.js js/i18n/cs.js js/i18n/de.js js/i18n/es.js js/i18n/fr.js js/i18n/hu.js js/i18n/it.js js/i18n/pl.js js/i18n/pt.js js/i18n/ro.js js/i18n/ru.js js/i18n/sk.js js/i18n/tr.js
git commit -m "test: catch duplicate i18n keys at the source, fix the one that was hiding a real hint"
```

---

### Task 2: `tooltip.spec.js`'s sweep is widened to open each batch-3 dialog and check its body — and taught to catch a dropped SELECTOR entry, which the DOM-only sweep design cannot

**A design point resolved during planning, worth recording:** the obvious
sweep design — walk `body.querySelectorAll(window.Tooltip.SELECTOR)` and
check each match's title — cannot detect the exact regression this task is
FOR. If a class is accidentally dropped from `SELECTOR`, that query simply
stops finding the element at all; the sweep reports nothing wrong, because
there is nothing left to check. This is the same blindness the spec's §9
carry-forward described in the OLD per-dialog specs, and a naive widened
sweep built the same way would inherit it rather than fix it.

The fix: sweep by `[data-i18n-title-name]` instead of by `SELECTOR` — that
attribute is the generic, already-established marker every two-stage
control sets (confirmed during planning: used identically across all 20
files that build two-stage tooltips, from `tool-rail.js` through every
batch-3 dialog) — and assert, for each element found that way, BOTH that it
is *also* matched by the live `SELECTOR` (`el.matches(window.Tooltip.
SELECTOR)`) and that its title is a genuine two-stage split. An element
that sets `data-i18n-title-name` but that `SELECTOR` no longer matches is
exactly a dropped/mistyped SELECTOR entry, caught directly and without any
per-dialog hardcoded class list to maintain.

This same blind spot exists in the ALREADY-SHIPPED main-workspace sweep
test in this file (the "every two-stage control in the main workspace
chrome has a real description" test, currently lines 94-131) — it has the
identical `querySelectorAll(window.Tooltip.SELECTOR)` shape. Since this
task is already touching this file to add the stronger check, it also
strengthens that existing test the same way, rather than leaving a
known instance of the same gap sitting right next to the fix.

**Files:**
- Modify: `tests/browser/tooltip.spec.js`

**Interfaces:**
- Consumes: `Helpers.splitTitle` (`js/utils/helpers.js:697`),
  `window.Tooltip.SELECTOR` (`js/ui/tooltip-manager.js:36`),
  `data-i18n-title-name` (the existing, already-universal marker attribute
  every two-stage control sets alongside `data-i18n-title`).
- Produces: nothing other tasks depend on — this is the batch's last task.

- [ ] **Step 1: Strengthen the existing main-workspace sweep test**

In `tests/browser/tooltip.spec.js`, the existing test (currently lines
94-131) sweeps like this:

```js
                for (const el of area.querySelectorAll(window.Tooltip.SELECTOR)) {
                    if (el.closest('#tool-options-panel-content')) continue;
```

Change the query to sweep by the marker attribute instead of by
`SELECTOR`, and add a SELECTOR-membership assertion right alongside the
existing two-stage check. Replace the loop body (from
`for (const el of area.querySelectorAll(window.Tooltip.SELECTOR)) {`
through the closing `}` before the next `}` that ends the `for (const area
...)` loop) with:

```js
                for (const el of area.querySelectorAll('[data-i18n-title-name]')) {
                    if (el.closest('#tool-options-panel-content')) continue;
                    // KNOWN GAP, deliberately out of scope (see the batch 2
                    // plan's Global Constraints): the shift dir-pad zones
                    // (Helpers.buildDirPad()) are shared verbatim by the
                    // Transform panel (shift the layer/selection) and the
                    // Reference panel (shift the reference image) — one
                    // hint text would be correct for one context and wrong
                    // for the other, and the builder has no parameter to
                    // vary it. They carry aria-label only, no title, by
                    // design. Remove this exclusion once buildDirPad() (or
                    // its two call sites) can express context-specific
                    // hints.
                    if (el.classList.contains('dir-pad-zone')) continue;
                    if (seen.has(el)) continue;
                    seen.add(el);
                    if (!el.matches(window.Tooltip.SELECTOR)) {
                        out.push(`${el.className || el.tagName} carries data-i18n-title-name but TooltipManager.SELECTOR does not match it`);
                        continue;
                    }
                    const { name, desc } = Helpers.splitTitle(el.getAttribute('title') || '');
                    if (!desc || desc === name) {
                        out.push(el.getAttribute('aria-label') || name || el.className);
                    }
                }
```

(the dir-pad-zone exclusion stays: those elements set neither
`data-i18n-title-name` nor `data-i18n-title` by design, so the new
attribute-based query never finds them in the first place — the explicit
`continue` is now redundant for that one case but kept for clarity and in
case a future control in that class briefly regains a stray attribute.)

- [ ] **Step 2: Run the existing test to verify it still passes**

Run: `npx playwright test tooltip.spec.js -g "main workspace chrome"`
Expected: PASS — every control that already had a real two-stage title
also already matches `SELECTOR` (that's how it got its title composed in
the first place), so this is a stronger check with the same true result on
today's code.

- [ ] **Step 3: Write the new dialog-sweep test**

Add a new test to `tests/browser/tooltip.spec.js`, after the test from
Step 1 (which ends around line 138 once the Step 1 edit lands) and before
the `touch` describe block. Unlike a typical RED/GREEN cycle, this test is
expected to pass immediately (Step 4) — batch 3 already wired every
control in these seven dialogs correctly; Step 5 is where this task
proves the test can actually fail, by deliberately reproducing the
regression it exists to catch:

```js
/*
 * The main-workspace sweep above never opens a dialog, so nothing in
 * Font/Map/Sprite/Palette Editor, Tape Block, Import or the Workspace
 * Presets manager was ever checked by it — those dialogs' own SELECTOR-
 * matched controls (all wired in batch 3 of
 * docs/superpowers/specs/2026-08-20-tooltip-coverage-design.md) had no
 * mechanical check that the match actually fires; only a human reviewer
 * catching a dropped or mistyped class kept it honest. This test opens
 * each of those seven dialogs in turn and runs the exact same sweep
 * against its body, closing it before the next one opens (the app boots
 * once for the whole test).
 */
test('every two-stage control in every batch-3 dialog has a real description', async ({ page }) => {
    await boot(page);

    const sweepDialog = async () => page.evaluate(() => {
        const out = [];
        const body = document.querySelector('.app-dialog-body');
        if (!body) return ['NO DIALOG BODY FOUND'];
        // Sweep by the marker attribute, not by SELECTOR itself — a class
        // silently dropped from SELECTOR must show up as a failure here,
        // which querying FOR SELECTOR could never do (see the design note
        // above Task 2).
        for (const el of body.querySelectorAll('[data-i18n-title-name]')) {
            if (!el.matches(window.Tooltip.SELECTOR)) {
                out.push(`${el.className || el.tagName} carries data-i18n-title-name but TooltipManager.SELECTOR does not match it`);
                continue;
            }
            const { name, desc } = Helpers.splitTitle(el.getAttribute('title') || '');
            if (!desc || desc === name) {
                out.push(el.getAttribute('aria-label') || name || el.className);
            }
        }
        return out;
    });

    const closeDialog = async () => {
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => !document.querySelector('.app-dialog-body'));
    };

    // Font Editor
    await page.click('.menu-item[data-menu="file"] .menu-label');
    await page.click('.menu-action[data-action="file:fontEditor"]');
    expect(await sweepDialog(), 'Font Editor').toEqual([]);
    await closeDialog();

    // Map Editor
    await page.click('.menu-item[data-menu="file"] .menu-label');
    await page.click('.menu-action[data-action="file:mapEditor"]');
    expect(await sweepDialog(), 'Map Editor').toEqual([]);
    await closeDialog();

    // Sprite Editor
    await page.click('.menu-item[data-menu="file"] .menu-label');
    await page.click('.menu-action[data-action="file:spriteEditor"]');
    expect(await sweepDialog(), 'Sprite Editor').toEqual([]);
    await closeDialog();

    // Palette Editor — needs an editable-palette mode; rgb333 (Next) also
    // renders the kind select, so it exercises more of the dialog than
    // ULAplus alone would.
    page.on('dialog', (d) => d.accept());
    await selectMode(page, 'layer2_256');
    await page.waitForFunction(() => ACTIVE_SCREEN_MODE.id === 'layer2_256');
    await page.click('.menu-item[data-menu="image"] .menu-label');
    await page.click('.menu-action[data-action="image:editPalette"]');
    expect(await sweepDialog(), 'Palette Editor').toEqual([]);
    await closeDialog();

    // Tape Block dialog — built directly from a real in-memory TAP file,
    // same as tests/browser/tape-block-tooltip.spec.js.
    await page.evaluate(() => {
        const buf = TAPFormat.export({ border: 0, name: 'test' });
        TapeBlockDialog.open(buf.buffer, 'test.tap');
    });
    expect(await sweepDialog(), 'Tape Block').toEqual([]);
    await closeDialog();

    // Import dialog — a synthesized PNG through the real open flow, same
    // as tests/browser/import-method-tooltip.spec.js.
    await page.evaluate(async () => {
        const c = document.createElement('canvas');
        c.width = 64; c.height = 48;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#ff0000'; ctx.fillRect(0, 0, 64, 48);
        const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
        const file = new File([blob], 'test.png', { type: 'image/png' });
        FileManager.loadFile(file);
    });
    await page.waitForSelector('.app-dialog-body', { timeout: 10000 });
    expect(await sweepDialog(), 'Import').toEqual([]);
    await closeDialog();

    // Workspace Presets manager — seed one filled slot first so both the
    // filled-row and empty-row action buttons render.
    await page.evaluate(() => PresetService.save(0, 'Batch 4 check', ['color']));
    await page.click('.menu-item[data-menu="settings"] .menu-label');
    await page.click('.menu-action[data-action="settings:presets"]');
    expect(await sweepDialog(), 'Workspace Presets manager').toEqual([]);
    await closeDialog();
});
```

Add `selectMode` to this file's existing `require('./helpers')` destructure
at the top of the file (currently `const { boot } = require('./helpers');`
— change to `const { boot, selectMode } = require('./helpers');`).

- [ ] **Step 4: Run the new test to verify it currently passes (all seven dialogs are already correctly wired by batch 3)**

Run: `npx playwright test tooltip.spec.js -g "every batch-3 dialog"`
Expected: PASS. Batch 3 already wired every two-stage control in these
seven dialogs so that it both carries `data-i18n-title-name` and is
matched by `SELECTOR`; this step confirms that. Step 5 below proves the
test would actually catch a regression rather than passing vacuously.

- [ ] **Step 5: Prove the test has teeth — temporarily drop a SELECTOR entry, confirm the test catches it, then restore**

Temporarily remove the `.import-method` entry from `TooltipManager.
SELECTOR` in `js/ui/tooltip-manager.js:36` (a one-line edit — delete just
that one class from the comma-separated string, leaving every other entry
intact — this simulates exactly the regression this task exists to catch:
a class silently dropped from `SELECTOR`). Run:

Run: `npx playwright test tooltip.spec.js -g "every batch-3 dialog"`
Expected: FAIL, reporting something like `import-method carries
data-i18n-title-name but TooltipManager.SELECTOR does not match it` for
each of the three Import dialog panes — because the sweep now finds them
by `[data-i18n-title-name]` (which is untouched by the SELECTOR edit) and
then discovers `el.matches(window.Tooltip.SELECTOR)` is false. This is the
exact failure mode a `querySelectorAll(SELECTOR)`-only sweep could never
produce (removing a class from the query you're using to FIND elements
just makes them invisible to the query, not flagged) — confirming the
`[data-i18n-title-name]` + `.matches(SELECTOR)` design in Step 1/3 actually
closes the gap, not just moves it.

Restore the `SELECTOR` string in `js/ui/tooltip-manager.js` to its real,
committed value before continuing. Do not commit the temporary breakage.

- [ ] **Step 6: Run the test again to verify it passes on the restored code (GREEN)**

Run: `npx playwright test tooltip.spec.js -g "every batch-3 dialog"`
Expected: PASS.

- [ ] **Step 7: Run the full gate**

Run: `node tests/run-all.js`
Expected: `ALL TEST FILES PASSED`.

Run: `npx playwright test`
Expected: all specs passing (305 + 1 new = 306).

- [ ] **Step 8: Commit**

```bash
git add tests/browser/tooltip.spec.js
git commit -m "test: widen the tooltip sweep to open and check every batch-3 dialog"
```

---

## After both tasks

- [ ] Update `docs/superpowers/specs/2026-08-20-tooltip-coverage-design.md`:
  mark batch 4 DONE in §7 with the commit range, and update the top-level
  Status line — this closes out the whole spec, so the Status line should
  say all four batches shipped rather than naming batches individually
  (follow the style of how batches 1-3 were folded into that line as each
  landed).
- [ ] This is the last batch in the spec's own execution plan (§7 lists
  only batches 1-4) — no further kickoff prompt is needed after this one.
