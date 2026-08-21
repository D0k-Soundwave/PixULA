# Tooltip Batch 3: Dialog Sweep Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring every genuinely under-labelled or icon-only control in PixULA's
modal dialogs (Font Editor, Map Editor, Sprite Editor, Palette Editor, Tape
Block, Import, and the Workspace Presets manager) up to the same two-stage
hover-tooltip convention already shipped for the tool rail (batch 1) and the
main workspace chrome (batch 2).

**Architecture:** No new mechanism. Every task either (a) composes an
already-existing, already-translated hint string via `Helpers.composeTitle`
where the content already exists but is wired flat (Palette Editor), or (b)
authors a short new `*.hint` key next to an existing name key and wires it the
same way the tool rail and batches 1-2 already do
(`data-i18n-title-name` + `data-i18n-title` + `TooltipManager.SELECTOR`).
Three dialogs (Font Editor, Map Editor, Sprite Editor) already share
`Helpers.miniToolButton` for their brush/eraser/line/fill mini-toolset
(batch 1); Sprite Editor is the one holdout still using its own hand-rolled
button factory for that row, and gets folded into the shared builder here.

**Tech Stack:** Vanilla JS (no framework), Playwright for browser specs, the
existing `js/i18n/*.js` locale tables (13 locales), `node tests/run-all.js`
for lint + i18n parity.

**Spec:** `docs/superpowers/specs/2026-08-20-tooltip-coverage-design.md`
(this plan implements §7 batch 3; read §1-§6 for the mechanism, content
style and testing rules, and §9 for open items carried in from batches 1-2).

## Global Constraints

- One sentence per hint. States what the control does, and where useful why
  or how. Never restates the visible name/caption (spec §4).
- English first in `js/i18n/en.js` (key-set source of truth), then natively
  translated (no machine translation) into all 12 other locales at the same
  anchor point (immediately after the key's existing name key, matching every
  prior i18n pass): cs, de, es, fr, hu, it, pl, pt, ro, ru, sk, tr. Match the
  existing tone already used by neighboring `*.hint` keys in that same file
  (imperative/infinitive, neutral register — verified against
  `tool.fade.hint`/`view.snap.hint`/`view.mirror.hint` in de/fr/ru/tr during
  planning).
- `tests/i18n-parity.test.js` (run via `node tests/run-all.js`) fails the
  build on any key present in one locale and missing in another, any empty
  value, or `{param}` placeholder drift — run it after every task.
- Reuse an existing key/value instead of authoring a near-duplicate wherever
  one already says the right thing (spec §4) — this plan does so twice:
  Map Editor's zoom buttons reuse `view.zoomOut.hint`/`view.zoomIn.hint`
  (already shipped in batch 1 for the main canvas zoom controls, and
  semantically identical here), and Palette Editor's four tool buttons +
  kind select reuse `palette.loadHint`/`palette.saveHint`/
  `palette.fromImageHint`/`palette.rampHint`/`palette.kindHint`, all of which
  already exist in `en.js` (and, since they already pass i18n-parity, in
  every other locale) as unused/flat content — batch 3 wires them into the
  two-stage mechanism, it authors no new copy for that dialog.
- **Out of scope, verified during planning, not silently skipped:**
  - **Preferences dialog** (`js/ui/menu-system.js` `_showPreferences`):
    every row already carries a permanently-visible `.pref-block__hint`
    sentence or a self-explanatory checkbox/select label — this dialog's
    coverage mechanism is "print the sentence", not "hide it behind hover",
    and it already satisfies the same goal (a control's purpose is never
    hidden) through a different, already-correct mechanism. No control in
    it is icon-only. Confirmed by reading the full `_showPreferences` +
    `_initPenPreferences`/`_initPenCheck` bodies; nothing there is
    icon-only or unexplained.
  - **Dialog-footer action buttons app-wide** (`js/ui/components/dialog.js`
    `open()`'s `buttons` array — Close/Cancel/OK/Save/"Add current
    screen"/"Save tape"/"Reset to defaults", etc.): plain, fully-captioned
    text buttons, the same category batches 1-2 deliberately left off
    `SELECTOR` (`.panel-button` is used by 11+ files and was rejected for
    exactly this reason). Out of scope here for the same reason.
  - **Companion dialog** (`js/ui/components/companion-dialog.js`): two
    text-captioned buttons ("Check Again", "Connect") next to a status
    sentence that already explains the current state. Self-explanatory;
    no icon-only control.
  - **Tool Preset save/rename dialog** (`js/ui/components/
    tool-preset-dialog.js`) and **Save Project dialog**
    (`js/ui/components/save-dialog.js`): both are a single text field plus
    generic Cancel/OK-style footer buttons — no icon-only control, nothing
    to wire.
  - **`CellGridEditor`'s own chrome**: it is a bare `<canvas>`
    (`js/ui/components/cell-grid-editor.js`) with no DOM chrome of its own;
    every dialog that embeds it (Font/Map/Sprite/Pattern Creator) builds its
    own surrounding toolbar, which is what Tasks 1-4 below actually cover.
  - **Palette Editor's swatches**: data-readout titles
    (`index · 0xNN`), explicitly a non-goal per spec §2 — not touched.
  - **The shift dir-pad zones** (`Helpers.buildDirPad()`): a pre-existing
    open item from batch 2 (spec §9), needing a design decision
    (parameterizing the builder or splitting it in two) rather than a
    mechanical wiring task. Left open for whoever picks that up; not part
    of this batch.

---

### Task 1: Font Editor glyph-ops row gets real hints

**Files:**
- Modify: `js/ui/components/font-editor-dialog.js:98-111`
- Modify: `js/i18n/en.js` (10 new keys, after their existing name keys at
  lines 857-866)
- Modify: `js/i18n/cs.js`, `de.js`, `es.js`, `fr.js`, `hu.js`, `it.js`,
  `pl.js`, `pt.js`, `ro.js`, `ru.js`, `sk.js`, `tr.js` (same 10 keys)
- Test: `tests/browser/font-editor-ops-tooltip.spec.js` (create)

**Interfaces:**
- Consumes: `Helpers.composeTitle(name, hint, shortcut)` (`js/utils/
  helpers.js:677`), `Helpers.captionHTML` (already used on these lines),
  `window.Tooltip.SELECTOR` (`js/ui/tooltip-manager.js:36`, already matches
  `.tool-btn`, no SELECTOR edit needed here — every button on these lines
  already carries that class).
- Produces: `font.op.clear.hint`, `font.op.copy.hint`, `font.op.paste.hint`,
  `font.op.invert.hint`, `font.op.flipH.hint`, `font.op.flipV.hint`,
  `font.op.shiftLeft.hint`, `font.op.shiftRight.hint`,
  `font.op.shiftUp.hint`, `font.op.shiftDown.hint` — new i18n keys other
  tasks do not depend on.

- [ ] **Step 1: Write the failing test**

Create `tests/browser/font-editor-ops-tooltip.spec.js`:

```js
'use strict';
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

async function openFileDialog(page, action) {
    await page.click('.menu-item[data-menu="file"] .menu-label');
    await page.click(`.menu-action[data-action="${action}"]`);
}

test('every Font Editor glyph-op button has a real two-stage tooltip', async ({ page }) => {
    await boot(page);
    await openFileDialog(page, 'file:fontEditor');
    const dlg = page.locator('.dialog, dialog, [role="dialog"]').first();
    await expect(dlg).toBeVisible();

    const ops = ['clear', 'copy', 'paste', 'invert', 'flip-h', 'flip-v',
        'shift-left', 'shift-right', 'shift-up', 'shift-down'];
    for (const op of ops) {
        const btn = dlg.locator(`button[data-op="${op}"]`);
        await expect(btn).toBeAttached();
        const title = await btn.getAttribute('title');
        const { name, desc } = await page.evaluate(
            (t) => Helpers.splitTitle(t), title);
        expect(name, `${op} name`).toBeTruthy();
        expect(desc, `${op} description`).toBeTruthy();
        expect(desc, `${op} description differs from name`).not.toBe(name);
    }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test font-editor-ops-tooltip.spec.js`
Expected: FAIL — every button's title is currently just its name repeated
(e.g. `title="Clear glyph"`, `desc` empty after split), so the description
assertions fail.

- [ ] **Step 3: Author the English hint keys**

In `js/i18n/en.js`, immediately after each existing name key (lines
857-866), add:

```js
    'font.op.clear': 'Clear glyph',
    'font.op.clear.hint': 'Empties the current glyph back to blank',
    'font.op.copy': 'Copy glyph',
    'font.op.copy.hint': 'Copies the current glyph to the internal glyph clipboard',
    'font.op.paste': 'Paste glyph',
    'font.op.paste.hint': 'Overwrites the current glyph with the one last copied',
    'font.op.invert': 'Invert glyph',
    'font.op.invert.hint': 'Swaps every set pixel in the glyph for an unset one and back',
    'font.op.flipH': 'Flip horizontally',
    'font.op.flipH.hint': 'Mirrors the glyph left-to-right',
    'font.op.flipV': 'Flip vertically',
    'font.op.flipV.hint': 'Mirrors the glyph top-to-bottom',
    'font.op.shiftLeft': 'Shift left',
    'font.op.shiftLeft.hint': 'Shifts every row one pixel left, wrapping the edge column around',
    'font.op.shiftRight': 'Shift right',
    'font.op.shiftRight.hint': 'Shifts every row one pixel right, wrapping the edge column around',
    'font.op.shiftUp': 'Shift up',
    'font.op.shiftUp.hint': 'Shifts every column one pixel up, wrapping the top row around',
    'font.op.shiftDown': 'Shift down',
    'font.op.shiftDown.hint': 'Shifts every column one pixel down, wrapping the bottom row around',
```

(the plain name lines already exist — only the `.hint` line under each is
new; keep the file's existing name lines exactly where they are and insert
the hint line directly after each).

- [ ] **Step 4: Translate into the other 12 locales**

For each of `cs.js`, `de.js`, `es.js`, `fr.js`, `hu.js`, `it.js`, `pl.js`,
`pt.js`, `ro.js`, `ru.js`, `sk.js`, `tr.js`: `grep -n "'font.op.clear'"` to
find the exact anchor line, then insert the matching `.hint` key immediately
after it with a natively-translated value (not machine-translated),
matching that file's existing imperative/infinitive tone on neighboring
hint keys (e.g. `tool.fade.hint`, `view.snap.hint`). Repeat for all 10 keys
in all 12 files. Verify with `node tests/run-all.js` after each file (or
once at the end) that `tests/i18n-parity.test.js` still passes.

- [ ] **Step 5: Wire the ten buttons to compose two-stage titles**

In `js/ui/components/font-editor-dialog.js`, replace lines 98-111. Every
button currently does `title="${this._t(key, fallback)}"` with no hint —
change each to compose the name with its new hint key. For example, line 98
becomes:

```js
                        <span class="btn-captioned">${Helpers.captionHTML('cap.clear', 'Clear')}<button type="button" data-op="clear"  class="tool-btn" data-i18n-title-name="font.op.clear" data-i18n-title="font.op.clear.hint" data-i18n-aria-label="font.op.clear" aria-label="${this._t('font.op.clear', 'Clear glyph')}" title="${Helpers.composeTitle(this._t('font.op.clear', 'Clear glyph'), this._t('font.op.clear.hint', 'Empties the current glyph back to blank'))}"><span class="tool-icon">&#8709;</span></button></span>
```

Apply the same pattern to the other nine buttons on lines 99-111
(`copy`/`paste`/`invert`/`flip-h`/`flip-v`/`shift-left`/`shift-right`/
`shift-up`/`shift-down`): add `data-i18n-title="<key>.hint"` alongside the
existing `data-i18n-title-name="<key>"`, and change `title="${this._t(key,
fallback)}"` to `title="${Helpers.composeTitle(this._t(key, fallback),
this._t(key + '.hint', '<the English hint text from Step 3>'))}"` (write
the literal key and hint string per button — do not compute `key + '.hint'`
at runtime, since this is a template string built once; e.g. for `copy` it
is `this._t('font.op.copy.hint', 'Copies the current glyph to the internal
glyph clipboard')`).

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx playwright test font-editor-ops-tooltip.spec.js`
Expected: PASS

- [ ] **Step 7: Run the full gate**

Run: `node tests/run-all.js` (lint + i18n parity) — expect
`ALL TEST FILES PASSED`.

- [ ] **Step 8: Commit**

```bash
git add js/ui/components/font-editor-dialog.js js/i18n/*.js tests/browser/font-editor-ops-tooltip.spec.js
git commit -m "feat: give the Font Editor's glyph-op buttons real hover hints"
```

---

### Task 2: Map Editor tool buttons and zoom controls get real hints

**Files:**
- Modify: `js/ui/components/map-editor-dialog.js:103-111`
- Modify: `js/i18n/en.js` (4 new keys after lines 819-822; zoom buttons
  reuse existing `view.zoomOut.hint`/`view.zoomIn.hint`, no new keys there)
- Modify: same 12 other locale files (4 keys each)
- Test: `tests/browser/map-editor-ops-tooltip.spec.js` (create)

**Interfaces:**
- Consumes: `Helpers.composeTitle`, existing `view.zoomOut.hint` /
  `view.zoomIn.hint` keys (`js/i18n/en.js:635-636`, already shipped in
  batch 1 for `canvas-controls.js`'s own zoom buttons — same action,
  reused verbatim, not duplicated).
- Produces: `map.tool.paint.hint`, `map.tool.erase.hint`,
  `map.tool.fill.hint`, `map.tool.pick.hint`.

- [ ] **Step 1: Write the failing test**

Create `tests/browser/map-editor-ops-tooltip.spec.js`:

```js
'use strict';
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

async function openFileDialog(page, action) {
    await page.click('.menu-item[data-menu="file"] .menu-label');
    await page.click(`.menu-action[data-action="${action}"]`);
}

test('every Map Editor tool and zoom button has a real two-stage tooltip', async ({ page }) => {
    await boot(page);
    await openFileDialog(page, 'file:mapEditor');
    const dlg = page.locator('.dialog, dialog, [role="dialog"]').first();
    await expect(dlg).toBeVisible();

    const checkTwoStage = async (locator, label) => {
        await expect(locator).toBeAttached();
        const title = await locator.getAttribute('title');
        const { name, desc } = await page.evaluate((t) => Helpers.splitTitle(t), title);
        expect(name, `${label} name`).toBeTruthy();
        expect(desc, `${label} description`).toBeTruthy();
        expect(desc, `${label} description differs from name`).not.toBe(name);
    };

    for (const tool of ['paint', 'erase', 'fill', 'pick']) {
        await checkTwoStage(dlg.locator(`button[data-maptool="${tool}"]`), tool);
    }
    await checkTwoStage(dlg.locator('.me-zoom-out'), 'zoom out');
    await checkTwoStage(dlg.locator('.me-zoom-in'), 'zoom in');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test map-editor-ops-tooltip.spec.js`
Expected: FAIL (tool buttons' titles are name-only; zoom buttons' titles are
flat single-value, so `desc` is empty or equals `name` for all six).

- [ ] **Step 3: Author the four new English hint keys**

In `js/i18n/en.js`, immediately after lines 819-822:

```js
    'map.tool.paint': 'Paint',
    'map.tool.paint.hint': 'Draws the selected tile into the map at the cursor',
    'map.tool.erase': 'Erase',
    'map.tool.erase.hint': 'Clears map cells back to empty',
    'map.tool.fill': 'Fill',
    'map.tool.fill.hint': 'Floods same-tile cells out from the cursor with the selected tile',
    'map.tool.pick': 'Pick Tile',
    'map.tool.pick.hint': 'Picks up the tile under the cursor as the one to paint with',
```

- [ ] **Step 4: Translate into the other 12 locales**

Same process as Task 1 Step 4: `grep -n "'map.tool.paint'"` in each of the
12 other locale files to find the anchor, insert the four `.hint` keys
natively translated at that point, matching the file's existing tone.

- [ ] **Step 5: Wire the tool buttons and zoom buttons**

In `js/ui/components/map-editor-dialog.js`, replace lines 103-106 (the four
tool buttons) following the exact same pattern as Task 1 Step 5 — add
`data-i18n-title="<key>.hint"` and change the flat `title="${this._t(key,
fallback)}"` to `title="${Helpers.composeTitle(this._t(key, fallback),
this._t('<key>.hint', '<hint text>'))}"`. For example, line 103:

```js
                        <span class="btn-captioned">${Helpers.captionHTML('map.tool.paint', 'Paint')}<button type="button" data-maptool="paint" class="tool-btn active" data-i18n-title-name="map.tool.paint" data-i18n-title="map.tool.paint.hint" data-i18n-aria-label="map.tool.paint" aria-label="${this._t('map.tool.paint', 'Paint')}" title="${Helpers.composeTitle(this._t('map.tool.paint', 'Paint'), this._t('map.tool.paint.hint', 'Draws the selected tile into the map at the cursor'))}"><span class="tool-icon">P</span></button></span>
```

Apply the equivalent change to `erase`/`fill`/`pick` on lines 104-106
(`pick`'s name key is `map.tool.pick`, caption key is the separate
`cap.pick` — keep both as they are, only the `title`/`data-i18n-title` on
the button changes).

Then replace lines 109 and 111 (zoom out/in), reusing the existing
`view.zoomOut.hint`/`view.zoomIn.hint` keys rather than authoring new ones:

```js
                        <button type="button" class="pc-btn me-zoom-out" data-i18n-title-name="menu.view.zoomOut" data-i18n-title="view.zoomOut.hint" title="${Helpers.composeTitle(this._t('menu.view.zoomOut', 'Zoom Out'), this._t('view.zoomOut.hint', 'Steps down to the next zoom level'))}">&#8722;</button>
                        <span class="me-zoom-label">2&#215;</span>
                        <button type="button" class="pc-btn me-zoom-in" data-i18n-title-name="menu.view.zoomIn" data-i18n-title="view.zoomIn.hint" title="${Helpers.composeTitle(this._t('menu.view.zoomIn', 'Zoom In'), this._t('view.zoomIn.hint', 'Steps up to the next zoom level'))}">+</button>
```

- [ ] **Step 6: Add the zoom button classes to `TooltipManager.SELECTOR`**

In `js/ui/tooltip-manager.js:36`, add `.me-zoom-out, .me-zoom-in` to the
`SELECTOR` constant (the four `.tool-btn` map-tool buttons already match
without any SELECTOR change).

- [ ] **Step 7: Run the test to verify it passes**

Run: `npx playwright test map-editor-ops-tooltip.spec.js`
Expected: PASS

- [ ] **Step 8: Run the full gate**

Run: `node tests/run-all.js` — expect `ALL TEST FILES PASSED`.

- [ ] **Step 9: Commit**

```bash
git add js/ui/components/map-editor-dialog.js js/ui/tooltip-manager.js js/i18n/*.js tests/browser/map-editor-ops-tooltip.spec.js
git commit -m "feat: give the Map Editor's tool and zoom buttons real hover hints"
```

---

### Task 3: Sprite Editor's mini-toolset joins the shared `Helpers.miniToolButton` builder

**Files:**
- Modify: `js/ui/components/sprite-editor-dialog.js:56-124`
- Test: `tests/browser/sprite-editor-minitools-tooltip.spec.js` (create)

**Interfaces:**
- Consumes: `Helpers.miniToolButton(tool, letter, nameKey, nameFallback,
  hintKey, hintFallback, active = false)` (`js/utils/helpers.js:538`,
  returns an HTML string — already used identically by
  `font-editor-dialog.js:80-83` and `map-editor-dialog.js:83-86`). Existing
  keys `tool.brush`/`tool.brush.hint`... wait — the actual key used by the
  other two dialogs is `miniTool.brush.hint`/`tool.eraser.hint`/
  `miniTool.line.hint`/`tool.fill.hint` (see the exact calls below); these
  already exist and are not touched by this task.
- Produces: nothing new — this task is pure dedup, no new i18n keys, no
  behavior change to what the buttons DO (only how their DOM/titles are
  built).

**No new content, so this task is refactor-shaped: the test asserts the
resulting markup matches the pattern the other two dialogs already have,
proving the fix landed and behavior didn't regress.**

- [ ] **Step 1: Write the failing test**

Create `tests/browser/sprite-editor-minitools-tooltip.spec.js`:

```js
'use strict';
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

async function openFileDialog(page, action) {
    await page.click('.menu-item[data-menu="file"] .menu-label');
    await page.click(`.menu-action[data-action="${action}"]`);
}

test('Sprite Editor mini-tools have real two-stage tooltips and still switch tools', async ({ page }) => {
    await boot(page);
    await openFileDialog(page, 'file:spriteEditor');
    const dlg = page.locator('.dialog, dialog, [role="dialog"]').first();
    await expect(dlg).toBeVisible();

    for (const tool of ['brush', 'eraser', 'line', 'fill']) {
        const btn = dlg.locator(`button[data-tool="${tool}"]`);
        await expect(btn).toBeAttached();
        const title = await btn.getAttribute('title');
        const { name, desc } = await page.evaluate((t) => Helpers.splitTitle(t), title);
        expect(name, `${tool} name`).toBeTruthy();
        expect(desc, `${tool} description`).toBeTruthy();
        expect(desc, `${tool} description differs from name`).not.toBe(name);
    }

    // Behavior must survive the dedup: clicking still switches the editor's tool.
    await dlg.locator('button[data-tool="eraser"]').click();
    await expect(dlg.locator('button[data-tool="eraser"]')).toHaveClass(/active/);
    await expect(dlg.locator('button[data-tool="brush"]')).not.toHaveClass(/active/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test sprite-editor-minitools-tooltip.spec.js`
Expected: FAIL — the current buttons have no `title` at all (`mkBtn` never
sets one), so `splitTitle` gets an empty string and both `name`/`desc`
assertions fail. The click/active assertions would pass already (existing
behavior); only the tooltip assertions are new failures.

- [ ] **Step 3: Replace the hand-rolled mini-tools row with `Helpers.miniToolButton`**

In `js/ui/components/sprite-editor-dialog.js`, the current tools row
(lines 107-124):

```js
        // ── Mini-tools ──────────────────────────────────────────────────────
        const tools = row('sprite-editor-tools');
        for (const [tool, i18n, fb] of [
            ['brush', 'tool.brush', 'Brush'],
            ['eraser', 'tool.eraser', 'Eraser'],
            ['line', 'shape.line', 'Line'],
            ['fill', 'tool.fill', 'Fill']
        ]) {
            const b = mkBtn(`se-tool-${tool}`, i18n, fb);
            b.addEventListener('click', () => {
                this._editor.setTool(tool);
                tools.querySelectorAll('button').forEach((x) =>
                    x.classList.toggle('active', x === b));
            });
            if (tool === 'brush') b.classList.add('active');
            tools.appendChild(b);
        }
        c.appendChild(tools);
```

becomes:

```js
        // ── Mini-tools ──────────────────────────────────────────────────────
        // Shared with Font Editor / Map Editor (Helpers.miniToolButton) rather
        // than hand-rolled here a third time — see docs/superpowers/specs/
        // 2026-08-20-tooltip-coverage-design.md §3.
        const tools = row('sprite-editor-tools');
        tools.innerHTML = [
            Helpers.miniToolButton('brush', 'B', 'tool.brush', 'Brush', 'miniTool.brush.hint', 'Click or drag to set pixels', true),
            Helpers.miniToolButton('eraser', 'E', 'tool.eraser', 'Eraser', 'tool.eraser.hint', 'Clear pixels back to the paper colour'),
            Helpers.miniToolButton('line', 'S', 'shape.line', 'Line', 'miniTool.line.hint', 'Drag to draw a straight line between two points'),
            Helpers.miniToolButton('fill', 'F', 'tool.fill', 'Fill', 'tool.fill.hint', 'Flood the area under the cursor out to its edges')
        ].join('');
        tools.querySelectorAll('button[data-tool]').forEach((b) => {
            b.addEventListener('click', () => {
                this._editor.setTool(b.dataset.tool);
                tools.querySelectorAll('button[data-tool]').forEach((x) =>
                    x.classList.toggle('active', x === b));
            });
        });
        c.appendChild(tools);
```

(`Helpers.miniToolButton` already stamps `data-tool="<tool>"` on the button
it returns and sets the `brush` button's initial `active` class via its own
`active` parameter — matching what the old loop did by hand.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx playwright test sprite-editor-minitools-tooltip.spec.js`
Expected: PASS

- [ ] **Step 5: Run the full gate**

Run: `node tests/run-all.js` — expect `ALL TEST FILES PASSED` (no i18n
changes in this task, so parity is unaffected; this just confirms lint
still passes on the edited file).

- [ ] **Step 6: Commit**

```bash
git add js/ui/components/sprite-editor-dialog.js tests/browser/sprite-editor-minitools-tooltip.spec.js
git commit -m "refactor: fold the Sprite Editor's mini-tools into the shared miniToolButton builder"
```

---

### Task 4: Sprite Editor's remaining buttons get real hints

**Files:**
- Modify: `js/ui/components/sprite-editor-dialog.js:56-193` (the `mkBtn`
  factory and the nav-button factory)
- Modify: `js/i18n/en.js` (12 new keys, after lines 1009-1022)
- Modify: same 12 other locale files (12 keys each)
- Modify: `js/ui/tooltip-manager.js:36` (add one new marker class)
- Test: `tests/browser/sprite-editor-ops-tooltip.spec.js` (create)

**Interfaces:**
- Consumes: `Helpers.composeTitle` (already imported/available globally as
  `Helpers`).
- Produces: `sprite.prevSprite.hint`, `sprite.nextSprite.hint`,
  `sprite.add.hint`, `sprite.remove.hint`, `sprite.flipH.hint`,
  `sprite.flipV.hint`, `sprite.rotate.hint`, `sprite.clear.hint`,
  `sprite.capture.hint`, `sprite.stamp.hint`, `sprite.import.hint`,
  `sprite.export.hint` — new keys, no other task depends on them.

- [ ] **Step 1: Write the failing test**

Create `tests/browser/sprite-editor-ops-tooltip.spec.js`:

```js
'use strict';
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

async function openFileDialog(page, action) {
    await page.click('.menu-item[data-menu="file"] .menu-label');
    await page.click(`.menu-action[data-action="${action}"]`);
}

test('every Sprite Editor nav/ops/bridge/file button has a real two-stage tooltip', async ({ page }) => {
    await boot(page);
    await openFileDialog(page, 'file:spriteEditor');
    const dlg = page.locator('.dialog, dialog, [role="dialog"]').first();
    await expect(dlg).toBeVisible();

    const checkTwoStage = async (locator, label) => {
        await expect(locator).toBeAttached();
        const title = await locator.getAttribute('title');
        const { name, desc } = await page.evaluate((t) => Helpers.splitTitle(t), title);
        expect(name, `${label} name`).toBeTruthy();
        expect(desc, `${label} description`).toBeTruthy();
        expect(desc, `${label} description differs from name`).not.toBe(name);
    };

    await checkTwoStage(dlg.locator('.se-prev'), 'previous sprite');
    await checkTwoStage(dlg.locator('.se-next'), 'next sprite');
    for (const cls of ['se-add', 'se-remove', 'se-flip-h', 'se-flip-v',
        'se-rotate', 'se-clear', 'se-capture', 'se-stamp', 'se-import', 'se-export']) {
        await checkTwoStage(dlg.locator(`.${cls}`), cls);
    }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test sprite-editor-ops-tooltip.spec.js`
Expected: FAIL — none of these buttons carry a `title` today (`mkBtn`
never sets one; the nav buttons only set `aria-label`).

- [ ] **Step 3: Author the 12 new English hint keys**

In `js/i18n/en.js`, immediately after lines 1009-1022:

```js
    'sprite.prevSprite': 'Previous sprite',
    'sprite.prevSprite.hint': 'Moves to the previous sprite in the sheet',
    'sprite.nextSprite': 'Next sprite',
    'sprite.nextSprite.hint': 'Moves to the next sprite in the sheet',
    'sprite.add': 'Add',
    'sprite.add.hint': 'Adds a new blank sprite after the current one (64 per sheet)',
    'sprite.remove': 'Remove',
    'sprite.remove.hint': 'Deletes the current sprite from the sheet',
    'sprite.flipH': 'Flip H',
    'sprite.flipH.hint': 'Mirrors the current sprite left-to-right',
    'sprite.flipV': 'Flip V',
    'sprite.flipV.hint': 'Mirrors the current sprite top-to-bottom',
    'sprite.rotate': 'Rotate',
    'sprite.rotate.hint': 'Rotates the current sprite 90 degrees clockwise',
    'sprite.clear': 'Clear',
    'sprite.clear.hint': 'Empties the current sprite back to fully transparent',
    'sprite.capture': 'Capture 16×16',
    'sprite.capture.hint': 'Copies a 16×16 block from the canvas at X,Y into the current sprite',
    'sprite.stamp': 'Stamp to canvas',
    'sprite.stamp.hint': 'Draws the current sprite onto the canvas at X,Y',
    'sprite.import': 'Import .spr…',
    'sprite.import.hint': 'Replaces the whole sheet with one loaded from a .spr file',
    'sprite.export': 'Export .spr',
    'sprite.export.hint': 'Saves the whole sheet as a .spr file',
```

(`sprite.capture`/`sprite.stamp`/`sprite.import`/`sprite.export` already
exist as name keys at lines 1019-1022 in the current file — insert each
`.hint` line directly after its existing name line, same as every other
task.)

- [ ] **Step 4: Translate into the other 12 locales**

Same process as prior tasks: locate each anchor via `grep -n
"'sprite.prevSprite'"` (and the others) in each of the 12 locale files,
insert natively-translated `.hint` values immediately after.

- [ ] **Step 5: Wire the nav buttons**

In `js/ui/components/sprite-editor-dialog.js`, the `mkNav` factory
(currently lines 72-80):

```js
        const mkNav = (cls, glyph, ariaI18n, aria) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = `panel-button small ${cls}`;
            b.textContent = glyph; // directional glyph, not a translatable word
            b.dataset.i18nAriaLabel = ariaI18n;
            b.setAttribute('aria-label', this._t(ariaI18n, aria));
            return b;
        };
```

becomes:

```js
        const mkNav = (cls, glyph, ariaI18n, aria, hintI18n, hint) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = `panel-button small ${cls}`;
            b.textContent = glyph; // directional glyph, not a translatable word
            b.dataset.i18nAriaLabel = ariaI18n;
            b.setAttribute('aria-label', this._t(ariaI18n, aria));
            b.dataset.i18nTitleName = ariaI18n;
            b.dataset.i18nTitle = hintI18n;
            b.title = Helpers.composeTitle(this._t(ariaI18n, aria), this._t(hintI18n, hint));
            return b;
        };
```

and its two call sites (currently lines 81 and 84):

```js
        const prev = mkNav('se-prev', '◀', 'sprite.prevSprite', 'Previous sprite',
            'sprite.prevSprite.hint', 'Moves to the previous sprite in the sheet');
        const label = document.createElement('span');
        label.className = 'se-counter';
        const next = mkNav('se-next', '▶', 'sprite.nextSprite', 'Next sprite',
            'sprite.nextSprite.hint', 'Moves to the next sprite in the sheet');
```

- [ ] **Step 6: Wire the ops/bridge/file row buttons**

The `mkBtn` factory (currently lines 56-63):

```js
        const mkBtn = (cls, i18n, fallback) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = `panel-button small ${cls}`;
            b.dataset.i18n = i18n;
            b.textContent = this._t(i18n, fallback);
            return b;
        };
```

becomes:

```js
        const mkBtn = (cls, i18n, fallback, hintI18n, hint) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = `panel-button small ${cls}`;
            b.dataset.i18n = i18n;
            b.textContent = this._t(i18n, fallback);
            if (hintI18n) {
                b.dataset.i18nTitleName = i18n;
                b.dataset.i18nTitle = hintI18n;
                b.title = Helpers.composeTitle(this._t(i18n, fallback), this._t(hintI18n, hint));
            }
            return b;
        };
```

(the `hintI18n`/`hint` params are optional — this is why Task 3's mini-tools
loop, which still calls `mkBtn`, is unaffected: it's actually already been
replaced by Step 3 of Task 3 and no longer calls `mkBtn` at all; nothing
else in this file calls `mkBtn` without wanting a hint after this task).

Then update every remaining `mkBtn` call site to pass its hint. Currently:

```js
        const add = mkBtn('se-add', 'sprite.add', 'Add');
        const remove = mkBtn('se-remove', 'sprite.remove', 'Remove');
```

becomes:

```js
        const add = mkBtn('se-add', 'sprite.add', 'Add',
            'sprite.add.hint', 'Adds a new blank sprite after the current one (64 per sheet)');
        const remove = mkBtn('se-remove', 'sprite.remove', 'Remove',
            'sprite.remove.hint', 'Deletes the current sprite from the sheet');
```

```js
        const flipH = mkBtn('se-flip-h', 'sprite.flipH', 'Flip H');
        const flipV = mkBtn('se-flip-v', 'sprite.flipV', 'Flip V');
        const rot = mkBtn('se-rotate', 'sprite.rotate', 'Rotate');
        const clear = mkBtn('se-clear', 'sprite.clear', 'Clear');
```

becomes:

```js
        const flipH = mkBtn('se-flip-h', 'sprite.flipH', 'Flip H',
            'sprite.flipH.hint', 'Mirrors the current sprite left-to-right');
        const flipV = mkBtn('se-flip-v', 'sprite.flipV', 'Flip V',
            'sprite.flipV.hint', 'Mirrors the current sprite top-to-bottom');
        const rot = mkBtn('se-rotate', 'sprite.rotate', 'Rotate',
            'sprite.rotate.hint', 'Rotates the current sprite 90 degrees clockwise');
        const clear = mkBtn('se-clear', 'sprite.clear', 'Clear',
            'sprite.clear.hint', 'Empties the current sprite back to fully transparent');
```

```js
        const capture = mkBtn('se-capture', 'sprite.capture', 'Capture 16×16');
        const stamp = mkBtn('se-stamp', 'sprite.stamp', 'Stamp to canvas');
```

becomes:

```js
        const capture = mkBtn('se-capture', 'sprite.capture', 'Capture 16×16',
            'sprite.capture.hint', 'Copies a 16×16 block from the canvas at X,Y into the current sprite');
        const stamp = mkBtn('se-stamp', 'sprite.stamp', 'Stamp to canvas',
            'sprite.stamp.hint', 'Draws the current sprite onto the canvas at X,Y');
```

```js
        const importBtn = mkBtn('se-import', 'sprite.import', 'Import .spr…');
        const exportBtn = mkBtn('se-export', 'sprite.export', 'Export .spr');
```

becomes:

```js
        const importBtn = mkBtn('se-import', 'sprite.import', 'Import .spr…',
            'sprite.import.hint', 'Replaces the whole sheet with one loaded from a .spr file');
        const exportBtn = mkBtn('se-export', 'sprite.export', 'Export .spr',
            'sprite.export.hint', 'Saves the whole sheet as a .spr file');
```

- [ ] **Step 7: Add the new classes to `TooltipManager.SELECTOR`**

In `js/ui/tooltip-manager.js:36`, add `.se-prev, .se-next, .se-add,
.se-remove, .se-flip-h, .se-flip-v, .se-rotate, .se-clear, .se-capture,
.se-stamp, .se-import, .se-export` to `SELECTOR`.

- [ ] **Step 8: Run the test to verify it passes**

Run: `npx playwright test sprite-editor-ops-tooltip.spec.js`
Expected: PASS

- [ ] **Step 9: Run the full gate**

Run: `node tests/run-all.js` — expect `ALL TEST FILES PASSED`.

- [ ] **Step 10: Commit**

```bash
git add js/ui/components/sprite-editor-dialog.js js/ui/tooltip-manager.js js/i18n/*.js tests/browser/sprite-editor-ops-tooltip.spec.js
git commit -m "feat: give the Sprite Editor's remaining buttons real hover hints"
```

---

### Task 5: Palette Editor's already-good hints get wired into the two-stage mechanism

**Files:**
- Modify: `js/ui/components/palette-editor-dialog.js:358-441`
- Modify: `js/ui/tooltip-manager.js:36`
- Test: `tests/browser/palette-editor-tools-tooltip.spec.js` (create)

**Interfaces:**
- Consumes: `Helpers.composeTitle`. All five hint strings already exist in
  every locale (`palette.loadHint`, `palette.saveHint`, `palette.kindHint`,
  `palette.fromImageHint`, `palette.rampHint` — confirmed present in
  `js/i18n/en.js` at lines 924, 926, 927, 932, 938 during planning).
- Produces: nothing new — pure wiring task, no new i18n keys, no locale
  file edits.

- [ ] **Step 1: Write the failing test**

Create `tests/browser/palette-editor-tools-tooltip.spec.js`:

```js
'use strict';
const { test, expect } = require('@playwright/test');
const { boot, selectMode } = require('./helpers');

test('every Palette Editor tool button has a real two-stage tooltip', async ({ page }) => {
    await boot(page);
    await selectMode(page, 'ula_plus');
    await page.waitForFunction(() => ACTIVE_SCREEN_MODE.id === 'ula_plus');
    await page.click('.menu-item[data-menu="image"] .menu-label');
    await page.click('.menu-action[data-action="image:editPalette"]');
    const dlg = page.locator('.dialog, dialog, [role="dialog"]').first();
    await expect(dlg).toBeVisible();

    const checkTwoStage = async (locator, label) => {
        await expect(locator).toBeAttached();
        const title = await locator.getAttribute('title');
        const { name, desc } = await page.evaluate((t) => Helpers.splitTitle(t), title);
        expect(name, `${label} name`).toBeTruthy();
        expect(desc, `${label} description`).toBeTruthy();
        expect(desc, `${label} description differs from name`).not.toBe(name);
    };

    for (const cls of ['palette-editor-tool-button']) {
        const count = await dlg.locator(`.${cls}`).count();
        expect(count).toBeGreaterThanOrEqual(3); // Load, Save, From image, Blend (Load absent only if scratch)
        for (let i = 0; i < count; i++) {
            await checkTwoStage(dlg.locator(`.${cls}`).nth(i), `tool button ${i}`);
        }
    }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test palette-editor-tools-tooltip.spec.js`
Expected: FAIL — `_button()` currently sets a flat `title` with no
composed hint (`splitTitle` on a flat string returns the whole string as
`name` and an empty `desc`).

- [ ] **Step 3: Wire `_button()` to compose two-stage titles**

In `js/ui/components/palette-editor-dialog.js`, `_button()` (currently
lines 430-441):

```js
    /** @private */
    _button(i18n, fallback, titleI18n, titleFallback, onClick) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'panel-button palette-editor-tool-button';
        btn.dataset.i18n = i18n;
        btn.textContent = this._t(i18n, fallback);
        btn.dataset.i18nTitle = titleI18n;
        btn.title = this._t(titleI18n, titleFallback);
        btn.addEventListener('click', onClick);
        return btn;
    }
```

becomes:

```js
    /** @private */
    _button(i18n, fallback, titleI18n, titleFallback, onClick) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'panel-button palette-editor-tool-button';
        btn.dataset.i18n = i18n;
        btn.textContent = this._t(i18n, fallback);
        btn.dataset.i18nTitleName = i18n;
        btn.dataset.i18nTitle = titleI18n;
        btn.title = Helpers.composeTitle(this._t(i18n, fallback), this._t(titleI18n, titleFallback));
        btn.addEventListener('click', onClick);
        return btn;
    }
```

(every call site — Load, Save, From image, Blend — already passes both an
`i18n` name key and a `titleI18n` hint key with real fallback text, so no
call site needs to change.)

Also wire the kind select (currently lines 358-364):

```js
        let kindSelect = null;
        if (traits.fileKinds.length > 1) {
            kindSelect = document.createElement('select');
            kindSelect.className = 'palette-editor-kind';
            kindSelect.dataset.i18nTitle = 'palette.kindHint';
            kindSelect.title = this._t('palette.kindHint',
                'Which file form to write');
```

becomes:

```js
        let kindSelect = null;
        if (traits.fileKinds.length > 1) {
            kindSelect = document.createElement('select');
            kindSelect.className = 'palette-editor-kind';
            kindSelect.dataset.i18nTitleName = 'palette.files';
            kindSelect.dataset.i18nTitle = 'palette.kindHint';
            kindSelect.title = Helpers.composeTitle(
                this._t('palette.files', 'Palette file'), this._t('palette.kindHint',
                'Which file form to write'));
```

(`palette.files` is the existing row-label key already used two lines above
via `_toolRow(tools, 'palette.files', 'Palette file')` — reused here as the
select's name, since the select itself has no separate visible caption.)

- [ ] **Step 4: Add the two classes to `TooltipManager.SELECTOR`**

In `js/ui/tooltip-manager.js:36`, add `.palette-editor-tool-button,
.palette-editor-kind` to `SELECTOR`.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx playwright test palette-editor-tools-tooltip.spec.js`
Expected: PASS

- [ ] **Step 6: Run the full gate**

Run: `node tests/run-all.js` — expect `ALL TEST FILES PASSED` (no i18n
content changed, so this just confirms lint).

- [ ] **Step 7: Commit**

```bash
git add js/ui/components/palette-editor-dialog.js js/ui/tooltip-manager.js tests/browser/palette-editor-tools-tooltip.spec.js
git commit -m "fix: wire the Palette Editor's already-written hints into the two-stage tooltip"
```

---

### Task 6: Tape Block dialog's row-action buttons get real hints

**Files:**
- Modify: `js/ui/components/tape-block-dialog.js:150-209`
- Modify: `js/i18n/en.js` (4 new keys after lines 772-775)
- Modify: same 12 other locale files (4 keys each)
- Modify: `js/ui/tooltip-manager.js:36`
- Test: `tests/browser/tape-block-tooltip.spec.js` (create)

**Interfaces:**
- Consumes: `Helpers.composeTitle`.
- Produces: `tape.load.hint`, `tape.moveUp.hint`, `tape.moveDown.hint`,
  `tape.remove.hint`.

- [ ] **Step 1: Write the failing test**

Create `tests/browser/tape-block-tooltip.spec.js`:

```js
'use strict';
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

test('every Tape Block row action button has a real two-stage tooltip', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => {
        const buf = TAPFormat.export({ border: 0, name: 'test' });
        TapeBlockDialog.open(buf.buffer, 'test.tap');
    });
    const dlg = page.locator('.dialog, dialog, [role="dialog"]').first();
    await expect(dlg).toBeVisible();

    const checkTwoStage = async (locator, label) => {
        await expect(locator).toBeAttached();
        const title = await locator.getAttribute('title');
        const { name, desc } = await page.evaluate((t) => Helpers.splitTitle(t), title);
        expect(name, `${label} name`).toBeTruthy();
        expect(desc, `${label} description`).toBeTruthy();
        expect(desc, `${label} description differs from name`).not.toBe(name);
    };

    await checkTwoStage(dlg.locator('button[data-act="load"]').first(), 'load');
    await checkTwoStage(dlg.locator('button[data-act="up"]').first(), 'move up');
    await checkTwoStage(dlg.locator('button[data-act="down"]').first(), 'move down');
    await checkTwoStage(dlg.locator('button[data-act="remove"]').first(), 'remove');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test tape-block-tooltip.spec.js`
Expected: FAIL — `_actionButton()` currently sets a flat `title` equal to
the name (icon buttons) or no title at all (the text-only `load` button).

- [ ] **Step 3: Author the four new English hint keys**

In `js/i18n/en.js`, immediately after lines 772-775:

```js
    'tape.load': 'Load',
    'tape.load.hint': 'Loads this SCREEN$ block into the document',
    'tape.remove': 'Remove',
    'tape.remove.hint': 'Deletes this block from the tape',
    'tape.moveUp': 'Move up',
    'tape.moveUp.hint': 'Moves this block one place earlier on the tape',
    'tape.moveDown': 'Move down',
    'tape.moveDown.hint': 'Moves this block one place later on the tape',
```

- [ ] **Step 4: Translate into the other 12 locales**

Same process as prior tasks: `grep -n "'tape.load'"` (and the other three
keys) in each of the 12 locale files, insert the natively-translated
`.hint` value immediately after each anchor.

- [ ] **Step 5: Wire `_actionButton()` to compose two-stage titles**

In `js/ui/components/tape-block-dialog.js`, `_actionButton()` (currently
lines 187-209):

```js
    _actionButton(act, index, i18nKey, fallback, icon) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'panel-button tape-block-btn';
        btn.dataset.act = act;
        btn.dataset.index = String(index);
        if (icon) {
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('aria-hidden', 'true');
            const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
            use.setAttribute('href', `#${icon}`);
            svg.appendChild(use);
            btn.appendChild(svg);
            btn.dataset.i18nTitle = i18nKey;
            btn.dataset.i18nAriaLabel = i18nKey;
            btn.title = this._t(i18nKey, fallback);
            btn.setAttribute('aria-label', this._t(i18nKey, fallback));
        } else {
            btn.dataset.i18n = i18nKey;
            btn.textContent = this._t(i18nKey, fallback);
        }
        return btn;
    }
```

becomes (adding a `hintKey`/`hintFallback` pair, and composing a title for
both the icon and text variants — the text variant gets a title it never
had before, since "Load" alone doesn't say what it loads into):

```js
    _actionButton(act, index, i18nKey, fallback, icon, hintKey, hintFallback) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'panel-button tape-block-btn';
        btn.dataset.act = act;
        btn.dataset.index = String(index);
        const name = this._t(i18nKey, fallback);
        const title = Helpers.composeTitle(name, this._t(hintKey, hintFallback));
        if (icon) {
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('aria-hidden', 'true');
            const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
            use.setAttribute('href', `#${icon}`);
            svg.appendChild(use);
            btn.appendChild(svg);
            btn.dataset.i18nTitleName = i18nKey;
            btn.dataset.i18nTitle = hintKey;
            btn.dataset.i18nAriaLabel = i18nKey;
            btn.title = title;
            btn.setAttribute('aria-label', name);
        } else {
            btn.dataset.i18n = i18nKey;
            btn.dataset.i18nTitleName = i18nKey;
            btn.dataset.i18nTitle = hintKey;
            btn.textContent = name;
            btn.title = title;
        }
        return btn;
    }
```

Then update the three call sites (currently lines 150, 152-154):

```js
            if (block.isScreen) {
                actions.appendChild(this._actionButton('load', i, 'tape.load', 'Load', null));
            }
            actions.appendChild(this._actionButton('up', i, 'tape.moveUp', 'Move up', 'icon-arrow-up'));
            actions.appendChild(this._actionButton('down', i, 'tape.moveDown', 'Move down', 'icon-arrow-down'));
            actions.appendChild(this._actionButton('remove', i, 'tape.remove', 'Remove', 'icon-trash'));
```

becomes:

```js
            if (block.isScreen) {
                actions.appendChild(this._actionButton('load', i, 'tape.load', 'Load', null,
                    'tape.load.hint', 'Loads this SCREEN$ block into the document'));
            }
            actions.appendChild(this._actionButton('up', i, 'tape.moveUp', 'Move up', 'icon-arrow-up',
                'tape.moveUp.hint', 'Moves this block one place earlier on the tape'));
            actions.appendChild(this._actionButton('down', i, 'tape.moveDown', 'Move down', 'icon-arrow-down',
                'tape.moveDown.hint', 'Moves this block one place later on the tape'));
            actions.appendChild(this._actionButton('remove', i, 'tape.remove', 'Remove', 'icon-trash',
                'tape.remove.hint', 'Deletes this block from the tape'));
```

- [ ] **Step 6: Add the class to `TooltipManager.SELECTOR`**

In `js/ui/tooltip-manager.js:36`, add `.tape-block-btn` to `SELECTOR`.

- [ ] **Step 7: Run the test to verify it passes**

Run: `npx playwright test tape-block-tooltip.spec.js`
Expected: PASS

- [ ] **Step 8: Run the full gate**

Run: `node tests/run-all.js` — expect `ALL TEST FILES PASSED`.

- [ ] **Step 9: Commit**

```bash
git add js/ui/components/tape-block-dialog.js js/ui/tooltip-manager.js js/i18n/*.js tests/browser/tape-block-tooltip.spec.js
git commit -m "feat: give the Tape Block dialog's row actions real hover hints"
```

---

### Task 7: Import dialog's three conversion methods get real hints

**Files:**
- Modify: `js/ui/components/import-dialog.js:66-88`
- Modify: `js/i18n/en.js` (3 new keys, near `import.methodSharp` /
  `import.methodSmooth` / `import.methodFlat`)
- Modify: same 12 other locale files (3 keys each)
- Modify: `js/ui/tooltip-manager.js:36`
- Test: `tests/browser/import-method-tooltip.spec.js` (create)

**Interfaces:**
- Consumes: `Helpers.composeTitle`, `PNGFormat.IMPORT_METHODS`
  (`js/io/png-format.js:33-40`, each entry has `id`/`method`/`dithering`/
  `i18n`/`fallback` — unchanged by this task).
- Produces: `import.methodSharp.hint`, `import.methodSmooth.hint`,
  `import.methodFlat.hint`.

- [ ] **Step 1: Write the failing test**

Create `tests/browser/import-method-tooltip.spec.js`:

```js
'use strict';
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

test('every Import dialog conversion method has a real two-stage tooltip', async ({ page }) => {
    await boot(page);
    await page.evaluate(async () => {
        const c = document.createElement('canvas');
        c.width = 64; c.height = 48;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#ff0000'; ctx.fillRect(0, 0, 64, 48);
        const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
        const file = new File([blob], 'test.png', { type: 'image/png' });
        FileManager.loadFile(file);
    });
    const dlg = page.locator('.dialog, dialog, [role="dialog"]').first();
    await expect(dlg).toBeVisible({ timeout: 10000 });

    for (const method of ['sharp', 'smooth', 'flat']) {
        const pane = dlg.locator(`.import-method[data-method="${method}"]`);
        await expect(pane).toBeAttached();
        const title = await pane.getAttribute('title');
        const { name, desc } = await page.evaluate((t) => Helpers.splitTitle(t), title);
        expect(name, `${method} name`).toBeTruthy();
        expect(desc, `${method} description`).toBeTruthy();
        expect(desc, `${method} description differs from name`).not.toBe(name);
    }
    await page.keyboard.press('Escape');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test import-method-tooltip.spec.js`
Expected: FAIL — the method panes carry no `title` attribute at all today.

- [ ] **Step 3: Author the three new English hint keys**

In `js/i18n/en.js`, find `'import.methodSharp'`, `'import.methodSmooth'`,
`'import.methodFlat'` and add a `.hint` line immediately after each:

```js
    'import.methodSharp': 'Sharp',
    'import.methodSharp.hint': 'Samples every pixel of the original photo per cell instead of the 64 already-averaged screen pixels - keeps edges and small detail the other two lose',
    'import.methodSmooth': 'Smooth',
    'import.methodSmooth.hint': 'Dithers the result - the best average tone and colour from a normal viewing distance, at the cost of visible noise up close',
    'import.methodFlat': 'Flat',
    'import.methodFlat.hint': 'No dithering - the cleanest blocks, with a more poster-like look',
```

(content drawn directly from the authoritative source comment at
`js/io/png-format.js:22-27`, which documents exactly this tradeoff.)

- [ ] **Step 4: Translate into the other 12 locales**

Same process: `grep -n "'import.methodSharp'"` (and the other two) in each
of the 12 locale files, insert the natively-translated `.hint` value
immediately after.

- [ ] **Step 5: Wire the method panes**

In `js/ui/components/import-dialog.js`, the pane-building loop (currently
lines 66-88):

```js
            const panes = METHODS.map((m) => {
                const pane = document.createElement('button');
                pane.type = 'button';
                pane.className = 'import-method';
                pane.setAttribute('role', 'radio');
                pane.dataset.method = m.id;

                const c = document.createElement('canvas');
                c.className = 'import-preview';
                c.width = ZX_SPECTRUM.WIDTH;
                c.height = ZX_SPECTRUM.HEIGHT;

                const cap = document.createElement('span');
                cap.className = 'import-method__label';
                cap.dataset.i18n = m.i18n;
                cap.textContent = this._t(m.i18n, m.fallback);

                pane.appendChild(c);
                pane.appendChild(cap);
                pane.addEventListener('click', () => select(m));
                methodRow.appendChild(pane);
                return { spec: m, pane, ctx: c.getContext('2d') };
            });
```

becomes (add the composed title on `pane` itself, right after `cap` is
built so `m.i18n` and the name string are already at hand):

```js
            const panes = METHODS.map((m) => {
                const pane = document.createElement('button');
                pane.type = 'button';
                pane.className = 'import-method';
                pane.setAttribute('role', 'radio');
                pane.dataset.method = m.id;

                const c = document.createElement('canvas');
                c.className = 'import-preview';
                c.width = ZX_SPECTRUM.WIDTH;
                c.height = ZX_SPECTRUM.HEIGHT;

                const cap = document.createElement('span');
                cap.className = 'import-method__label';
                cap.dataset.i18n = m.i18n;
                cap.textContent = this._t(m.i18n, m.fallback);

                const hintKey = `${m.i18n}.hint`;
                pane.dataset.i18nTitleName = m.i18n;
                pane.dataset.i18nTitle = hintKey;
                pane.title = Helpers.composeTitle(this._t(m.i18n, m.fallback), this._t(hintKey, m.hint));

                pane.appendChild(c);
                pane.appendChild(cap);
                pane.addEventListener('click', () => select(m));
                methodRow.appendChild(pane);
                return { spec: m, pane, ctx: c.getContext('2d') };
            });
```

This reads `m.hint` as the English fallback, so `PNGFormat.IMPORT_METHODS`
needs one more field per entry. In `js/io/png-format.js:33-40`:

```js
const IMPORT_METHODS = [
  { id: 'sharp',  method: 'detail',   dithering: 'none',
    i18n: 'import.methodSharp',  fallback: 'Sharp' },
  { id: 'smooth', method: 'standard', dithering: 'floyd-steinberg',
    i18n: 'import.methodSmooth', fallback: 'Smooth' },
  { id: 'flat',   method: 'standard', dithering: 'none',
    i18n: 'import.methodFlat',   fallback: 'Flat' }
];
```

becomes:

```js
const IMPORT_METHODS = [
  { id: 'sharp',  method: 'detail',   dithering: 'none',
    i18n: 'import.methodSharp',  fallback: 'Sharp',
    hint: 'Samples every pixel of the original photo per cell instead of the 64 already-averaged screen pixels - keeps edges and small detail the other two lose' },
  { id: 'smooth', method: 'standard', dithering: 'floyd-steinberg',
    i18n: 'import.methodSmooth', fallback: 'Smooth',
    hint: 'Dithers the result - the best average tone and colour from a normal viewing distance, at the cost of visible noise up close' },
  { id: 'flat',   method: 'standard', dithering: 'none',
    i18n: 'import.methodFlat',   fallback: 'Flat',
    hint: 'No dithering - the cleanest blocks, with a more poster-like look' }
];
```

(this keeps the one-source-of-truth property the module's own header
comment calls out — the dialog, the preview generator and now the tooltip
all read the same list, rather than a hint string duplicated in two
files.)

- [ ] **Step 6: Add the class to `TooltipManager.SELECTOR`**

In `js/ui/tooltip-manager.js:36`, add `.import-method` to `SELECTOR`.

- [ ] **Step 7: Run the test to verify it passes**

Run: `npx playwright test import-method-tooltip.spec.js`
Expected: PASS

- [ ] **Step 8: Run the full gate**

Run: `node tests/run-all.js` — expect `ALL TEST FILES PASSED` (this touches
`js/io/png-format.js`, which has its own Node-level format tests — confirm
`png-format.test.js` or equivalent still passes; it only reads
`IMPORT_METHODS.map(m => ({id, preview}))` fields that are unchanged, so
the added `hint` field is inert there).

- [ ] **Step 9: Commit**

```bash
git add js/ui/components/import-dialog.js js/io/png-format.js js/ui/tooltip-manager.js js/i18n/*.js tests/browser/import-method-tooltip.spec.js
git commit -m "feat: give the Import dialog's three conversion methods real hover hints"
```

---

### Task 8: Workspace Presets manager's row actions get real hints

**Files:**
- Modify: `js/ui/components/preset-dialog.js:362-397, 420-429`
- Modify: `js/i18n/en.js` (5 new keys after lines 1083-1088)
- Modify: same 12 other locale files (5 keys each)
- Modify: `js/ui/tooltip-manager.js:36`
- Test: `tests/browser/preset-manager-tooltip.spec.js` (create)

**Interfaces:**
- Consumes: `Helpers.composeTitle`.
- Produces: `preset.load.hint`, `preset.replace.hint`, `preset.export.hint`,
  `preset.delete.hint`, `preset.saveHere.hint`.

**Note on why these five specifically matter:** per this project's own
two-libraries architecture note (`CLAUDE.md`), a slot preset's "Load" vs
"Replace" is exactly the kind of adjacent-but-different action a terse
caption doesn't disambiguate on its own — Load recalls the slot's saved
setup, Replace overwrites the slot with the CURRENT workspace. That
distinction is worth a real hint, not just a label.

- [ ] **Step 1: Write the failing test**

Create `tests/browser/preset-manager-tooltip.spec.js`:

```js
'use strict';
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

test('every Workspace Presets manager row action has a real two-stage tooltip', async ({ page }) => {
    await boot(page);
    // Ensure at least one filled slot so the Load/Replace/Export/Delete row renders.
    // PresetService.save(slot, name, sliceIds, description) — signature confirmed
    // in js/services/preset-service.js:234.
    await page.evaluate(() => PresetService.save(0, 'Batch 3 check', ['color']));
    await page.click('.menu-item[data-menu="settings"] .menu-label');
    await page.click('.menu-action[data-action="settings:presets"]');
    const dlg = page.locator('.dialog, dialog, [role="dialog"]').first();
    await expect(dlg).toBeVisible();

    const checkTwoStage = async (locator, label) => {
        await expect(locator).toBeAttached();
        const title = await locator.getAttribute('title');
        const { name, desc } = await page.evaluate((t) => Helpers.splitTitle(t), title);
        expect(name, `${label} name`).toBeTruthy();
        expect(desc, `${label} description`).toBeTruthy();
        expect(desc, `${label} description differs from name`).not.toBe(name);
    };

    const filledRow = dlg.locator('.preset-row').filter({ hasNot: dlg.locator('.preset-row-empty') }).first();
    await checkTwoStage(filledRow.locator('[data-i18n="preset.load"]'), 'load');
    await checkTwoStage(filledRow.locator('[data-i18n="preset.replace"]'), 'replace');
    await checkTwoStage(filledRow.locator('[data-i18n="preset.export"]'), 'export');
    await checkTwoStage(filledRow.locator('[data-i18n="preset.delete"]'), 'delete');

    const emptyRow = dlg.locator('.preset-row-empty').first();
    await checkTwoStage(emptyRow.locator('[data-i18n="preset.saveHere"]'), 'save here');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test preset-manager-tooltip.spec.js`
Expected: FAIL — `_action()` currently sets no `title` at all.

- [ ] **Step 3: Author the five new English hint keys**

In `js/i18n/en.js`, immediately after lines 1083-1088:

```js
    'preset.load': 'Load',
    'preset.load.hint': 'Applies this slot\'s saved setup to the workspace right now',
    'preset.replace': 'Replace',
    'preset.replace.hint': 'Overwrites this slot with the workspace as it is right now',
    'preset.export': 'Export',
    'preset.export.hint': 'Saves this slot as a standalone .zxpreset file',
    'preset.delete': 'Delete',
    'preset.delete.hint': 'Empties this slot, after confirming',
    'preset.saveHere': 'Save here',
    'preset.saveHere.hint': 'Captures the workspace as it is right now into this empty slot',
```

- [ ] **Step 4: Translate into the other 12 locales**

Same process: `grep -n "'preset.load'"` (and the other four) in each of the
12 locale files, insert natively-translated `.hint` values immediately
after.

- [ ] **Step 5: Wire `_action()` to compose two-stage titles**

In `js/ui/components/preset-dialog.js`, `_action()` (currently lines
420-429):

```js
    /** @private */
    _action(i18n, fallback, onClick) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'panel-button preset-row-button';
        btn.dataset.i18n = i18n;
        btn.textContent = this._t(i18n, fallback);
        btn.addEventListener('click', onClick);
        return btn;
    }
```

becomes:

```js
    /** @private */
    _action(i18n, fallback, onClick) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'panel-button preset-row-button';
        btn.dataset.i18n = i18n;
        btn.dataset.i18nTitleName = i18n;
        btn.dataset.i18nTitle = `${i18n}.hint`;
        btn.textContent = this._t(i18n, fallback);
        btn.title = Helpers.composeTitle(this._t(i18n, fallback), this._t(`${i18n}.hint`, ''));
        btn.addEventListener('click', onClick);
        return btn;
    }
```

(every call site already passes the right `i18n` key — `preset.load`,
`preset.replace`, `preset.export`, `preset.delete`, `preset.saveHere` — so
no call site needs to change; the `.hint` suffix convention matches every
other task in this batch.)

- [ ] **Step 6: Add the class to `TooltipManager.SELECTOR`**

In `js/ui/tooltip-manager.js:36`, add `.preset-row-button` to `SELECTOR`.

- [ ] **Step 7: Run the test to verify it passes**

Run: `npx playwright test preset-manager-tooltip.spec.js`
Expected: PASS

- [ ] **Step 8: Run the full gate**

Run: `node tests/run-all.js` — expect `ALL TEST FILES PASSED`.

- [ ] **Step 9: Commit**

```bash
git add js/ui/components/preset-dialog.js js/ui/tooltip-manager.js js/i18n/*.js tests/browser/preset-manager-tooltip.spec.js
git commit -m "feat: give the Workspace Presets manager's row actions real hover hints"
```

---

## After all 8 tasks

- [ ] Run the full Playwright suite (`npx playwright test`) once, to confirm
  the whole batch is green together, not just task-by-task.
- [ ] Update `docs/superpowers/specs/2026-08-20-tooltip-coverage-design.md`
  §7 (mark batch 3 DONE with the commit range and any deviations found
  during implementation) and §9 (resolve or carry forward any open items
  this batch touched) — the same "batch exit check" ritual batches 1 and 2
  both performed.
- [ ] Batch 4 (`Generalized test coverage` — widening `tooltip.spec.js`
  itself per spec §6 to catch this whole class of gap everywhere, not
  batch-by-batch) is intentionally NOT part of this plan; it is its own
  batch per the spec's execution plan.
