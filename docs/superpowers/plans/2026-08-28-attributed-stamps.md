# Attributed Stamps (Save Tile / Save Room / Save as Stamp) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Map Editor's `Render to Canvas` and Sprite Editor's `Stamp to canvas` (both direct, immediate, no-preview writes) with real stamp layers — draggable, repeatable-click-to-place, persisted in the layer panel — reusing the app's existing stamp-layer mechanism (`SelectionService`).

**Architecture:** `SelectionService`'s stamp data model (`floatingPaste`, persisted `layer.stamp`) gains an optional `attrs` field: one ZX attribute byte per 8x8 cell, alongside the mask it already carries. Two new rendering branches (preview + commit) are added as siblings of the existing indexed-mode branches. Map Editor's two new actions (`Save Tile to Stamp`, `Save Room to Stamp`) build `attrs`-carrying stamps; Sprite Editor's `Save as Stamp` reuses the *existing*, unmodified `indices` path (no `attrs` involved — sprites carry no ZX attribute).

**Tech Stack:** Vanilla JS (this repo has no build/framework), Node test harness (`tests/helpers/zx-stubs.js`), Playwright (`tests/browser/`).

**Spec:** `docs/superpowers/specs/2026-08-28-attributed-stamps-design.md`

## Global Constraints

- No emoji/pictographs anywhere in `js/`, `css/`, `index.html` (lint-enforced, `tests/lint-architecture.test.js`).
- `EventBus.emit/on` only with `EVENTS.*` constants, never string literals.
- All pixel writes go through `PixelDrawRoutine.draw()` except the documented bulk exceptions (layer flatten/merge, stamp drag preview, io/* codecs) — this plan's new preview code is one of those documented exceptions; its new commit code is NOT and must go through `PixelDrawRoutine.draw()`.
- Every new user-visible string needs a `data-i18n*` attribute and a key added to all 13 locale files in `js/i18n/`, or `tests/i18n-parity.test.js` fails the build.
- `node tests/run-all.js` must pass after every task.
- Attributed stamps (`attrs` present) snap `x`/`y` to the 8px cell grid on every move — see spec §3, "Cell-grid alignment is load-bearing, not cosmetic."

---

## Task 1: Sprite Editor — "Save as Stamp"

The independent, low-risk piece: reuses the *existing*, already-working indexed-stamp mechanism end to end. No `SelectionService` changes.

**Files:**
- Modify: `js/services/sprite-service.js:196-` (replace `stampToCanvas`)
- Modify: `js/ui/components/sprite-editor-dialog.js:204-207,281-287` (button + handler)
- Modify: `js/ui/tooltip-manager.js:36` (rename `.se-stamp` to `.se-save-stamp` in the `SELECTOR` list — confirmed present there, and confirmed covered by an existing tooltip test, see Step 6)
- Modify: `js/i18n/en.js` (new keys)
- Test: `tests/browser/sprite-editor.spec.js` (new file — confirmed no existing spec covers this dialog's functional behavior; `tests/browser/sprite-editor-*-tooltip.spec.js` are tooltip-only and unrelated except for the rename in Step 6)

**Interfaces:**
- Consumes: `SelectionService.startFloatingPasteFromMask(pixels, width, height, x, y, label)` (existing, unchanged), `SelectionService.floatingPaste.indices` (existing, set by direct assignment — see reference pattern in `js/services/selection-service.js:561-571`).
- Produces: `SpriteService.saveAsStamp(n)` — returns `boolean` (`true` on success, `false` if `!isCanvasCompatible()` or sprite `n` doesn't exist).

- [ ] **Step 1: Write the failing Playwright test**

Create `tests/browser/sprite-editor.spec.js`:

```javascript
'use strict';
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

test('Sprite Editor Save as Stamp creates a draggable stamp layer, not an immediate write',
    async ({ page }) => {
        await boot(page);
        page.on('dialog', (d) => d.accept()); // lossy mode-switch confirm
        await page.evaluate(() => ScreenModeService.switchMode('layer2_256'));

        await page.evaluate(() => SpriteEditorDialog.open());
        // Paint a single opaque pixel into sprite 0 so the stamp isn't empty
        await page.evaluate(() => {
            const spr = SpriteService.getSprite(0);
            spr[0] = 5; // some non-transparent index
        });

        const before = await page.evaluate(() => LayerManager.layers.length);
        await page.click('.se-save-stamp');
        const after = await page.evaluate(() => ({
            layerCount: LayerManager.layers.length,
            isFloating: SelectionService.isFloating(),
            hasIndices: !!(SelectionService.floatingPaste && SelectionService.floatingPaste.indices)
        }));

        expect(after.layerCount).toBe(before + 1); // one new stamp layer, nothing baked in yet
        expect(after.isFloating).toBe(true);
        expect(after.hasIndices).toBe(true);
    });

test('Sprite Editor Save as Stamp is disabled outside indexed modes', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => SpriteEditorDialog.open());
    const disabled = await page.evaluate(() => document.querySelector('.se-save-stamp').disabled);
    expect(disabled).toBe(false); // button itself stays enabled; click shows the mode message
    const r = await page.evaluate(() => SpriteService.saveAsStamp(0));
    expect(r).toBe(false); // standard_ula is the boot default, not indexed
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx playwright test tests/browser/sprite-editor.spec.js`
Expected: FAIL — `.se-save-stamp` doesn't exist yet, `SpriteService.saveAsStamp` is not a function.

- [ ] **Step 3: Replace `SpriteService.stampToCanvas` with `saveAsStamp`**

In `js/services/sprite-service.js`, replace the existing `stampToCanvas(n, px, py)` method (lines 196-`, ends before the next method) with:

```javascript
    /**
     * Turn sprite n into a draggable stamp layer (SelectionService), instead
     * of writing it onto the canvas immediately. The artist positions it by
     * dragging (or clicking repeatedly, brush-mode) then commits — same
     * mechanism paste and placed brush content already use. Uses the
     * existing indexed floating-stamp path (`floatingPaste.indices`); no
     * `attrs` involved, sprites carry no ZX attribute.
     * @param {number} n - Sprite index
     * @returns {boolean}
     */
    saveAsStamp(n) {
        if (!this.isCanvasCompatible() || !this.sprites[n]) return false;
        const spr = this.sprites[n];
        const transparent = this.transparencyIndex();
        const mask = [];
        const indices = [];
        for (let y = 0; y < SPRITE_SIZE; y++) {
            const maskRow = [];
            const idxRow = [];
            for (let x = 0; x < SPRITE_SIZE; x++) {
                const idx = spr[y * SPRITE_SIZE + x];
                const opaque = idx !== transparent;
                maskRow.push(opaque);
                idxRow.push(opaque ? idx : -1);
            }
            mask.push(maskRow);
            indices.push(idxRow);
        }

        SelectionService.startFloatingPasteFromMask(mask, SPRITE_SIZE, SPRITE_SIZE, 0, 0, 'Save as Stamp');
        if (!SelectionService.floatingPaste) return false; // max layers reached
        SelectionService.floatingPaste.indices = indices;
        SelectionService.floatingPaste._srcIndices = indices.map(r => [...r]);
        SelectionService.floatingPaste.floatingLayer.clear();
        LayerManager.composeToCanvas();
        SelectionService._drawFloatingLayer();
        LayerManager.flushPendingCompose();
        CanvasSystem.requestRender();
        return true;
    }
```

- [ ] **Step 4: Update the Sprite Editor dialog button**

In `js/ui/components/sprite-editor-dialog.js`, change the button declaration (around line 206):

```javascript
        const saveStamp = mkBtn('se-save-stamp', 'sprite.saveAsStamp', 'Save as Stamp',
            'sprite.saveAsStamp.hint', 'Creates a draggable stamp of the current sprite you can position and place on the canvas');
```

and its click handler (around line 281-287), replacing the existing `stamp.addEventListener(...)` block:

```javascript
        saveStamp.addEventListener('click', () => {
            if (!bridgeGate()) return;
            if (SpriteService.saveAsStamp(SpriteService.getCurrent())) {
                say(this._t('sprite.stampSaved', 'Stamp created — drag it into place, then click to commit.'));
            }
        });
```

Also update wherever `stamp` (the old button variable) was appended into the row alongside `capture` — rename to `saveStamp` at that call site, and drop the now-unused `bx`/`by` fields from the stamp path specifically (Capture 16x16 still needs them for its own X/Y — leave those inputs in place, only `stampToCanvas`'s use of them is gone).

- [ ] **Step 5: Keep the button's tooltip working after the class rename**

`.se-stamp` is hardcoded in two places outside the dialog itself, both of which must be updated to `.se-save-stamp` or the button silently loses its hover tooltip and an existing test breaks:

In `js/ui/tooltip-manager.js:36`, find the `SELECTOR` constant and change `.se-stamp` to `.se-save-stamp` in the comma-separated list (it sits between `.se-capture` and `.se-import`).

In `tests/browser/sprite-editor-ops-tooltip.spec.js:28`, change `'se-stamp'` to `'se-save-stamp'` in the array literal.

- [ ] **Step 6: Add the two new i18n keys to `js/i18n/en.js`**

Near the existing `sprite.stamp`/`sprite.stamp.hint` keys, replace them with:

```javascript
    'sprite.saveAsStamp': 'Save as Stamp',
    'sprite.saveAsStamp.hint': 'Creates a draggable stamp of the current sprite you can position and place on the canvas',
    'sprite.stampSaved': 'Stamp created — drag it into place, then click to commit.',
```

(Full 13-locale parity happens in Task 7 — for now this unblocks Node tests other than `i18n-parity.test.js`, which is expected to fail until Task 7; do not run it yet.)

- [ ] **Step 7: Run the Playwright tests again**

Run: `npx playwright test tests/browser/sprite-editor.spec.js tests/browser/sprite-editor-ops-tooltip.spec.js`
Expected: PASS

- [ ] **Step 8: Run `node tests/run-all.js`**

Expected: everything passes except `i18n-parity.test.js` (new keys only in `en.js` so far — expected at this point, fixed in Task 7).

- [ ] **Step 9: Commit**

```bash
git add js/services/sprite-service.js js/ui/components/sprite-editor-dialog.js js/ui/tooltip-manager.js js/i18n/en.js tests/browser/sprite-editor.spec.js tests/browser/sprite-editor-ops-tooltip.spec.js
git commit -m "feat: sprite editor stamps sprites instead of writing them immediately"
```

---

## Task 2: SelectionService — `attrs` data model, cell-grid snap, transform no-ops

Core extension. No rendering yet (Tasks 3-4) — this task only makes the field exist, survive undo, and be safe to drag.

**Files:**
- Modify: `js/services/selection-service.js` (see exact locations below)
- Test: `tests/attributed-stamp-model.test.js` (new)

**Interfaces:**
- Consumes: nothing new (works within existing `floatingPaste`/`layer.stamp` machinery).
- Produces: `SelectionService.floatingPaste.attrs` (flat `number[]`, one ZX attribute byte per 8x8 cell, row-major, present only on attributed stamps — mutually exclusive with `.indices`); `layer.stamp.attrs` (same, persisted); `moveFloatingPaste` now snaps `x`/`y` to multiples of 8 whenever `.attrs` is present; `setStampScale`/`setStampRotation`/`setStampWarp`/`transformStamp` (shape-changing types only) become no-ops when `.attrs` is present.

- [ ] **Step 1: Write the failing Node test**

Create `tests/attributed-stamp-model.test.js`:

```javascript
'use strict';
/**
 * Core data-model test for attributed stamps (2026-08-28 design): the
 * `attrs` field on floatingPaste/layer.stamp, cell-grid snapping on move,
 * and the transform no-ops. No rendering here (see the attributed-stamp-
 * render.test.js suites for _drawFloatingLayerAttributed/stampAt/commitStamp).
 */
const { installStubs, loadModule, check, summary } = require('./helpers/zx-stubs');

installStubs();
loadModule('js/utils/validators.js');
loadModule('js/core/event-bus.js');
loadModule('js/core/state-manager.js');
loadModule('js/core/attribute-system.js');

global.document = undefined;
global.CanvasSystem = {
  setPixel() {}, markCellDirty() {}, requestRender() {}, _render() {},
  getColorIndex(base, bright) { return base === 0 ? 0 : base + (bright ? 8 : 0); }
};
global.setInterval = () => 0;

loadModule('js/core/color-manager.js');
loadModule('js/core/layer-manager.js');
loadModule('js/core/pixel-draw-routine.js');
loadModule('js/services/undo-redo.js');
loadModule('js/services/selection-service.js');

ColorManager.initialize();
LayerManager.initialize();

// A 16x8 (2 cells wide, 1 cell tall) attributed stamp
const mask = [
  Array(16).fill(true),
  Array(16).fill(true),
  Array(16).fill(true),
  Array(16).fill(true),
  Array(16).fill(true),
  Array(16).fill(true),
  Array(16).fill(true),
  Array(16).fill(true)
];
const attrs = [0x38, 0x11]; // left cell: paper 7/ink 0; right cell: paper 2/ink 1

SelectionService.startFloatingPasteFromMask(mask, 16, 8, 5, 5, 'Test attributed stamp');
check('floating paste created', SelectionService.isFloating() === true);
SelectionService.floatingPaste.attrs = attrs;

check('attrs stored', SelectionService.floatingPaste.attrs.length === 2);
check('indices absent on an attrs stamp', SelectionService.floatingPaste.indices == null);

// Cell-grid snap: moving to a non-multiple-of-8 position snaps down
SelectionService.moveFloatingPaste(11, 13);
check('moveFloatingPaste snaps x to a multiple of 8', SelectionService.floatingPaste.x % 8 === 0,
  `got x=${SelectionService.floatingPaste.x}`);
check('moveFloatingPaste snaps y to a multiple of 8', SelectionService.floatingPaste.y % 8 === 0,
  `got y=${SelectionService.floatingPaste.y}`);
check('snap rounds down (11 -> 8)', SelectionService.floatingPaste.x === 8);
check('snap rounds down (13 -> 8)', SelectionService.floatingPaste.y === 8);

// A plain (non-attrs) stamp is NOT snapped
LayerManager.initialize();
SelectionService.startFloatingPasteFromMask(mask, 16, 8, 5, 5, 'Test plain stamp');
SelectionService.moveFloatingPaste(11, 13);
check('a plain stamp is not cell-snapped', SelectionService.floatingPaste.x === 11
  && SelectionService.floatingPaste.y === 13);

// Transform no-ops on an attrs stamp
LayerManager.initialize();
SelectionService.startFloatingPasteFromMask(mask, 16, 8, 0, 0, 'Test transform guard');
SelectionService.floatingPaste.attrs = attrs;
SelectionService.setStampScale(2, 2);
check('setStampScale is a no-op on an attrs stamp', SelectionService.floatingPaste._scaleX === 1);
SelectionService.setStampRotation(90);
check('setStampRotation is a no-op on an attrs stamp', SelectionService.floatingPaste._rotation === 0);
const widthBefore = SelectionService.floatingPaste.width;
SelectionService.transformStamp('rotate90CW');
check('transformStamp shape-change is a no-op on an attrs stamp',
  SelectionService.floatingPaste.width === widthBefore);
// Shift (reposition) still works on an attrs stamp
SelectionService.transformStamp('shiftRight', 8);
check('transformStamp shift still repositions an attrs stamp', SelectionService.floatingPaste.x === 8);

// endFloatingPaste persists attrs onto layer.stamp; _getStampData returns it
const layer = SelectionService.floatingPaste.floatingLayer;
SelectionService.endFloatingPaste();
check('attrs persisted on layer.stamp', Array.isArray(layer.stamp.attrs) && layer.stamp.attrs.length === 2);

summary();
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node tests/attributed-stamp-model.test.js`
Expected: FAIL — no snapping happens yet, `transformStamp`/`setStampScale`/`setStampRotation` don't check for `attrs`, `endFloatingPaste` doesn't persist `attrs`.

- [ ] **Step 3: `moveFloatingPaste` — snap to the cell grid for attrs stamps**

In `js/services/selection-service.js`, find `moveFloatingPaste(newX, newY)` (around line 1008):

```javascript
  moveFloatingPaste(newX, newY) {
    if (!this.floatingPaste) return;
    const fp = this.floatingPaste;

    this._clearFloatingFootprint(fp.floatingLayer, fp.x, fp.y, fp.width, fp.height);

    fp.x = newX;
    fp.y = newY;
```

Replace with:

```javascript
  moveFloatingPaste(newX, newY) {
    if (!this.floatingPaste) return;
    const fp = this.floatingPaste;

    this._clearFloatingFootprint(fp.floatingLayer, fp.x, fp.y, fp.width, fp.height);

    // Attributed stamps carry one attribute PER CELL, not per pixel — a
    // non-cell-aligned drop would make one destination cell straddle two
    // source cells with two different attribute bytes, which has no valid
    // resolution (see spec §3, "Cell-grid alignment is load-bearing").
    if (fp.attrs) {
      newX = Math.floor(newX / 8) * 8;
      newY = Math.floor(newY / 8) * 8;
    }

    fp.x = newX;
    fp.y = newY;
```

- [ ] **Step 4: Transform no-ops for attrs stamps**

In `setStampScale` (around line 650):

```javascript
  setStampScale(sx, sy) {
    const fp = this.floatingPaste;
    if (!fp || fp.attrs) return;
    fp._scaleX = Math.max(0.1, sx);
    fp._scaleY = Math.max(0.1, sy);
    this._recomputeStampTransform();
  }
```

In `setStampRotation` (around line 662):

```javascript
  setStampRotation(degrees) {
    const fp = this.floatingPaste;
    if (!fp || fp.attrs) return;
    fp._rotation = degrees % 360;
    this._recomputeStampTransform();
  }
```

In `setStampWarp` (around line 673 — read the current body first; add the same guard as the first line inside the method: `if (!this.floatingPaste || this.floatingPaste.attrs) return;`, replacing whatever the current first guard clause is).

In `transformStamp(type, ...)` (around line 1179), add a guard right after the existing `if (!this.floatingPaste) return;` line: shape-changing types are everything except the four shift types, which must still work (repositioning is fine, shape-changing is not):

```javascript
  transformStamp(type, amount = 1, outlineGap = 1, outlineSize = 1) {
    if (!this.floatingPaste) return;
    const isShift = type === 'shiftLeft' || type === 'shiftRight'
      || type === 'shiftUp' || type === 'shiftDown';
    if (this.floatingPaste.attrs && !isShift) return; // shape ops undefined on a per-cell attribute grid
    UndoRedo.beginAction(`Stamp ${type}`);
    const fp = this.floatingPaste;
```

(This replaces the existing two lines `if (!this.floatingPaste) return;` / `UndoRedo.beginAction(...)` / `const fp = this.floatingPaste;` with the four lines above — same behavior for every existing caller, since `isShift` types were never gated before and still aren't.)

- [ ] **Step 5: Persist and restore `attrs`**

In `_getStampData` (around line 1620), add `attrs` to the live-floatingPaste branch:

```javascript
  _getStampData(layer) {
    const fp = this.floatingPaste;
    if (fp && fp.floatingLayer === layer) {
      return { mask: fp.pixels, indices: fp.indices || null, attrs: fp.attrs || null,
               x: fp.x, y: fp.y, w: fp.width, h: fp.height };
    }
    if (layer.isStamp && layer.stamp) {
      return layer.stamp;
    }
    return null;
  }
```

In `endFloatingPaste` (around line 1038), add `attrs` to the persisted object:

```javascript
      fp.floatingLayer.stamp = {
        mask: fp.pixels,
        indices: fp.indices || null,
        attrs: fp.attrs || null,
        x: fp.x,
        y: fp.y,
        w: fp.width,
        h: fp.height,
        colorSelection: fp.colorSelection
      };
```

In `captureFloatingState` (around line 86), add one line after the `indices`/`_srcIndices` pair:

```javascript
      indices:     fp.indices ? fp.indices.map(r => [...r]) : null,
      _srcIndices: fp._srcIndices ? fp._srcIndices.map(r => [...r]) : null,
      attrs:       fp.attrs ? [...fp.attrs] : null
```

In `restoreFloatingState` (around line 133), same addition:

```javascript
      indices:     state.indices ? state.indices.map(r => [...r]) : null,
      _srcIndices: state._srcIndices ? state._srcIndices.map(r => [...r]) : null,
      attrs:       state.attrs ? [...state.attrs] : null
```

- [ ] **Step 6: Run the test again**

Run: `node tests/attributed-stamp-model.test.js`
Expected: PASS

- [ ] **Step 7: Run `node tests/run-all.js`**

Expected: all suites pass (this task touched nothing i18n-related).

- [ ] **Step 8: Commit**

```bash
git add js/services/selection-service.js tests/attributed-stamp-model.test.js
git commit -m "feat: attributed stamp data model, cell-grid snap, transform guards"
```

---

## Task 3: SelectionService — attributed stamp preview rendering

**Files:**
- Modify: `js/services/selection-service.js`
- Test: `tests/attributed-stamp-render.test.js` (new)

**Interfaces:**
- Consumes: `floatingPaste.attrs` (Task 2).
- Produces: `SelectionService._drawFloatingLayerAttributed()` — private, called from `_drawFloatingLayer()`.

- [ ] **Step 1: Write the failing Node test**

Create `tests/attributed-stamp-render.test.js`:

```javascript
'use strict';
/**
 * Preview rendering for attributed stamps: _drawFloatingLayerAttributed
 * writes each destination cell's pixels AND its own ink/paper/bright/flash
 * from the stamp's attrs — no inheriting paper from the target layer.
 */
const { installStubs, loadModule, check, summary } = require('./helpers/zx-stubs');

installStubs();
loadModule('js/utils/validators.js');
loadModule('js/core/event-bus.js');
loadModule('js/core/state-manager.js');
loadModule('js/core/attribute-system.js');

global.document = undefined;
global.CanvasSystem = {
  setPixel() {}, markCellDirty() {}, requestRender() {}, _render() {},
  getColorIndex(base, bright) { return base === 0 ? 0 : base + (bright ? 8 : 0); }
};
global.setInterval = () => 0;

loadModule('js/core/color-manager.js');
loadModule('js/core/layer-manager.js');
loadModule('js/core/pixel-draw-routine.js');
loadModule('js/services/undo-redo.js');
loadModule('js/services/selection-service.js');

ColorManager.initialize();
LayerManager.initialize();

// Give the background layer some paper the stamp must NOT inherit
const bg = LayerManager.layers[0];
bg.setCell(0, 0, { ink: 4, paper: 5, bright: false, flash: false,
  pixels: new Uint8Array(8), altered: true });
bg.setCell(1, 0, { ink: 4, paper: 5, bright: false, flash: false,
  pixels: new Uint8Array(8), altered: true });

// A 16x8 (2 cells) fully-solid attributed stamp: left cell ink 0/paper 7,
// right cell ink 1/paper 2/bright
const mask = Array.from({ length: 8 }, () => Array(16).fill(true));
const attrs = [0x38, (1 << 6) | (2 << 3) | 1]; // 0x38 = paper7 ink0; bright+paper2+ink1

SelectionService.startFloatingPasteFromMask(mask, 16, 8, 0, 0, 'Test preview');
SelectionService.floatingPaste.attrs = attrs;
SelectionService._drawFloatingLayer();
LayerManager.flushPendingCompose();

const stampLayer = SelectionService.floatingPaste.floatingLayer;
const leftCell = stampLayer.getCell(0, 0);
const rightCell = stampLayer.getCell(1, 0);

check('left cell ink from attrs', leftCell.ink === 0);
check('left cell paper from attrs (not inherited 5)', leftCell.paper === 7);
check('left cell bright from attrs', leftCell.bright === false);
check('right cell ink from attrs', rightCell.ink === 1);
check('right cell paper from attrs (not inherited 5)', rightCell.paper === 2);
check('right cell bright from attrs', rightCell.bright === true);
check('left cell pixels fully set', leftCell.pixels.every(b => b === 0xFF));
check('right cell pixels fully set', rightCell.pixels.every(b => b === 0xFF));

summary();
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node tests/attributed-stamp-render.test.js`
Expected: FAIL — `_drawFloatingLayer()` has no attrs branch yet, so it falls through to the classic branch and inherits paper 5 from the background.

- [ ] **Step 3: Add the dispatch + the new method**

In `js/services/selection-service.js`, find `_drawFloatingLayer()` (around line 1657):

```javascript
  _drawFloatingLayer() {
    const { pixels, width, height, x, y, colorSelection, floatingLayer } = this.floatingPaste;

    // Indexed modes (Phase 13): stamp cells carry palette indices — the
    // stamp's own indices when it was cut/copied in an indexed mode, else
    // the mask painted with the current indexed ink.
    if (ZX_SPECTRUM.PIXEL_DEPTH > 1) {
      this._drawFloatingLayerIndexed();
      return;
    }
```

Insert a new check right before the `PIXEL_DEPTH > 1` check:

```javascript
  _drawFloatingLayer() {
    const { pixels, width, height, x, y, colorSelection, floatingLayer } = this.floatingPaste;

    // Attributed stamps (Map Editor tiles/rooms, 2026-08-28): each cell
    // brings its own ink/paper/bright/flash — never mixed with indexed or
    // colorSelection-driven stamps.
    if (this.floatingPaste.attrs) {
      this._drawFloatingLayerAttributed();
      return;
    }

    // Indexed modes (Phase 13): stamp cells carry palette indices — the
    // stamp's own indices when it was cut/copied in an indexed mode, else
    // the mask painted with the current indexed ink.
    if (ZX_SPECTRUM.PIXEL_DEPTH > 1) {
      this._drawFloatingLayerIndexed();
      return;
    }
```

Add the new method right after `_drawFloatingLayerIndexed()` ends (after line ~1924, before the `_drawFloatingLayerXOR` JSDoc comment):

```javascript
  /**
   * Preview an attributed stamp (Map Editor tiles/rooms): each destination
   * cell gets its own pixel bits AND its own ink/paper/bright/flash from
   * the stamp's `attrs`, never inherited from the target layer below —
   * unlike the plain classic-mode branch, an attributed stamp brings its
   * own paper on purpose. x/y are always cell-aligned (moveFloatingPaste
   * snaps them), so this can iterate destination cells directly instead of
   * doing per-pixel cell-boundary math the way the plain branch must.
   * @private
   */
  _drawFloatingLayerAttributed() {
    const { pixels, width, height, x, y, attrs, floatingLayer } = this.floatingPaste;
    const CW = ZX_SPECTRUM.CELL_WIDTH;
    const CH = ZX_SPECTRUM.CELL_HEIGHT;
    const stampCellsWide = Math.ceil(width / CW);
    const startCellX = Math.max(0, Math.floor(x / CW));
    const startCellY = Math.max(0, Math.floor(y / CH));
    const endCellX = Math.min(ZX_SPECTRUM.GRID_COLS - 1, Math.floor((x + width - 1) / CW));
    const endCellY = Math.min(ZX_SPECTRUM.GRID_ROWS - 1, Math.floor((y + height - 1) / CH));

    for (let cy = startCellY; cy <= endCellY; cy++) {
      for (let cx = startCellX; cx <= endCellX; cx++) {
        const fpCell = floatingLayer.getCell(cx, cy);
        if (!fpCell) continue;

        const srcCellX = cx - Math.floor(x / CW);
        const srcCellY = cy - Math.floor(y / CH);
        const attr = attrs[srcCellY * stampCellsWide + srcCellX];
        if (attr == null) continue; // empty map cell contributed no tile here

        let touched = false;
        for (let ly = 0; ly < CH; ly++) {
          const stampY = cy * CH + ly - y;
          if (stampY < 0 || stampY >= height) continue;
          const row = pixels[stampY];
          if (!row) continue;
          for (let lx = 0; lx < CW; lx++) {
            const stampX = cx * CW + lx - x;
            if (stampX < 0 || stampX >= width) continue;
            if (row[stampX]) {
              fpCell.pixels[ly] |= (1 << (CW - 1 - lx));
              touched = true;
            }
          }
        }
        if (!touched) continue;

        fpCell.ink    = attr & 7;
        fpCell.paper  = (attr >> 3) & 7;
        fpCell.bright = (attr & 0x40) !== 0;
        fpCell.flash  = (attr & 0x80) !== 0;
        fpCell.xorReplace = false;
        fpCell.altered = true;
        LayerManager.deferCellCompose(cx, cy);
      }
    }
  }
```

- [ ] **Step 4: Run the test again**

Run: `node tests/attributed-stamp-render.test.js`
Expected: PASS

- [ ] **Step 5: Run `node tests/run-all.js`**

Expected: all suites pass.

- [ ] **Step 6: Commit**

```bash
git add js/services/selection-service.js tests/attributed-stamp-render.test.js
git commit -m "feat: attributed stamp preview rendering"
```

---

## Task 4: SelectionService — attributed stamp commit (`stampAt` / `commitStamp`)

**Files:**
- Modify: `js/services/selection-service.js`
- Test: `tests/attributed-stamp-commit.test.js` (new)

**Interfaces:**
- Consumes: `floatingPaste.attrs` / `layer.stamp.attrs` (Task 2), `_getStampData` returning `attrs` (Task 2).
- Produces: `stampAt(layer)` and `commitStamp(layer)` correctly bake attributed stamps into a real target layer through `PixelDrawRoutine.draw()`.

- [ ] **Step 1: Write the failing Node test**

Create `tests/attributed-stamp-commit.test.js`:

```javascript
'use strict';
/**
 * Commit rendering for attributed stamps: stampAt/commitStamp bake each
 * cell's own attrs into the target layer through PixelDrawRoutine (gate-
 * respecting), not the plain "stamp ink, inherited paper" ink-only path.
 */
const { installStubs, loadModule, check, summary } = require('./helpers/zx-stubs');

installStubs();
loadModule('js/utils/validators.js');
loadModule('js/core/event-bus.js');
loadModule('js/core/state-manager.js');
loadModule('js/core/attribute-system.js');

global.document = undefined;
global.CanvasSystem = {
  setPixel() {}, markCellDirty() {}, requestRender() {}, _render() {},
  getColorIndex(base, bright) { return base === 0 ? 0 : base + (bright ? 8 : 0); }
};
global.setInterval = () => 0;

loadModule('js/core/color-manager.js');
loadModule('js/core/layer-manager.js');
loadModule('js/core/pixel-draw-routine.js');
loadModule('js/services/undo-redo.js');
loadModule('js/services/selection-service.js');

ColorManager.initialize();
LayerManager.initialize();
LayerManager.addLayer(); // a real drawing layer under the stamp

const mask = Array.from({ length: 8 }, () => Array(16).fill(true));
const attrs = [0x38, (1 << 6) | (2 << 3) | 1];

SelectionService.startFloatingPasteFromMask(mask, 16, 8, 0, 0, 'Test commit');
SelectionService.floatingPaste.attrs = attrs;
const stampLayer = SelectionService.floatingPaste.floatingLayer;

LayerManager.setCurrentLayer(1); // select the drawing layer as the active target
const committed = SelectionService.commitStamp(stampLayer);
check('commitStamp reports success', committed === true);

const targetLayer = LayerManager.layers[1];
const leftCell = targetLayer.getCell(0, 0);
const rightCell = targetLayer.getCell(1, 0);
check('committed left cell ink', leftCell.ink === 0);
check('committed left cell paper', leftCell.paper === 7);
check('committed right cell ink', rightCell.ink === 1);
check('committed right cell paper', rightCell.paper === 2);
check('committed right cell bright', rightCell.bright === true);
check('stamp layer removed after commit',
  LayerManager.layers.indexOf(stampLayer) === -1);

// stampAt (repeat-placement, brush mode) — same attrs baked, layer stays
LayerManager.initialize();
LayerManager.addLayer();
SelectionService.startFloatingPasteFromMask(mask, 16, 8, 0, 0, 'Test stampAt');
SelectionService.floatingPaste.attrs = attrs;
SelectionService.floatingPaste.floatingLayer.isStamp = true; // stampAt requires isStamp
LayerManager.setCurrentLayer(1);
SelectionService.stampAt(SelectionService.floatingPaste.floatingLayer);
const target2 = LayerManager.layers[1];
check('stampAt bakes left cell ink', target2.getCell(0, 0).ink === 0);
check('stampAt bakes right cell paper', target2.getCell(1, 0).paper === 2);
check('stampAt does not remove the stamp layer (repeatable placement)',
  LayerManager.layers.indexOf(SelectionService.floatingPaste.floatingLayer) !== -1);

summary();
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node tests/attributed-stamp-commit.test.js`
Expected: FAIL — both `stampAt`/`commitStamp` fall through to the plain classic branch, which uses `ColorManager.getCurrentSelection()`'s ink and inherits paper, ignoring `attrs` entirely.

- [ ] **Step 3: Add an attrs helper + wire it into both methods**

Add a new private helper right before `stampAt` (around line 1296), reusing the exact per-cell attribute-resolving shape `MapService.renderMapToCanvas` already uses:

```javascript
  /**
   * Paint an attributed stamp's pixels onto a target layer, one cell at a
   * time: each cell's own ink/paper/bright/flash from `data.attrs`, not
   * the stamp's colorSelection. Shared by stampAt and commitStamp. Caller
   * wraps in suspendMirror + batch.
   * @param {Object} data - stamp data ({mask, attrs, x, y, w, h})
   * @param {Layer} targetLayer
   * @private
   */
  _paintAttributedStamp(data, targetLayer) {
    const { mask, attrs, x, y, w, h } = data;
    const CW = ZX_SPECTRUM.CELL_WIDTH;
    const CH = ZX_SPECTRUM.CELL_HEIGHT;
    const stampCellsWide = Math.ceil(w / CW);
    const startCellX = Math.floor(x / CW);
    const startCellY = Math.floor(y / CH);
    const endCellX = Math.floor((x + w - 1) / CW);
    const endCellY = Math.floor((y + h - 1) / CH);

    for (let cy = startCellY; cy <= endCellY; cy++) {
      for (let cx = startCellX; cx <= endCellX; cx++) {
        const srcCellX = cx - startCellX;
        const srcCellY = cy - startCellY;
        const attr = attrs[srcCellY * stampCellsWide + srcCellX];
        if (attr == null) continue;
        const sel = {
          ink: attr & 7,
          paper: (attr >> 3) & 7,
          bright: (attr & 0x40) !== 0,
          flash: (attr & 0x80) !== 0
        };
        for (let ly = 0; ly < CH; ly++) {
          const py = cy * CH + ly;
          const stampY = py - y;
          if (stampY < 0 || stampY >= h) continue;
          const row = mask[stampY];
          if (!row) continue;
          for (let lx = 0; lx < CW; lx++) {
            const px = cx * CW + lx;
            const stampX = px - x;
            if (stampX < 0 || stampX >= w) continue;
            if (!Validators.isValidPixelCoord(px, py)) continue;
            const isInk = !!row[stampX];
            PixelDrawRoutine.draw(px, py, sel,
              isInk ? DRAW_MODE.NORMAL : DRAW_MODE.PAPER, { layer: targetLayer });
          }
        }
      }
    }
  }
```

In `stampAt(layer)` (around line 1296), find:

```javascript
    // Stamp writes place exactly the stamp mask — never symmetry-mirrored
    PixelDrawRoutine.suspendMirror(() => {
      // Indexed modes (Phase 13): paint the stamp's palette indices (or the
      // mask at the current indexed ink), routed through the same resolved
      // mode (Paper Recolour/XOR still mean something over an index grid).
      if (ZX_SPECTRUM.PIXEL_DEPTH > 1) {
        this._paintIndexedStamp(data, targetLayer, color, mode);
        return;
      }
```

Insert a check right before the `PIXEL_DEPTH > 1` check:

```javascript
    // Stamp writes place exactly the stamp mask — never symmetry-mirrored
    PixelDrawRoutine.suspendMirror(() => {
      // Attributed stamps (Map Editor): each cell paints its own colour.
      if (data.attrs) {
        this._paintAttributedStamp(data, targetLayer);
        return;
      }

      // Indexed modes (Phase 13): paint the stamp's palette indices (or the
      // mask at the current indexed ink), routed through the same resolved
      // mode (Paper Recolour/XOR still mean something over an index grid).
      if (ZX_SPECTRUM.PIXEL_DEPTH > 1) {
        this._paintIndexedStamp(data, targetLayer, color, mode);
        return;
      }
```

In `commitStamp(layer)` (around line 1525), find:

```javascript
    // Commits bake exactly the previewed stamp — never symmetry-mirrored
    PixelDrawRoutine.suspendMirror(() => {
      // Indexed modes (Phase 13): bake the previewed indices/mask directly,
      // through the same resolved mode as the classic branch below.
      if (ZX_SPECTRUM.PIXEL_DEPTH > 1) {
        this._paintIndexedStamp(data, target, color, mode);
      } else
      if (layer.xorMode) {
```

Replace with:

```javascript
    // Commits bake exactly the previewed stamp — never symmetry-mirrored
    PixelDrawRoutine.suspendMirror(() => {
      // Attributed stamps (Map Editor): each cell paints its own colour.
      if (data.attrs) {
        this._paintAttributedStamp(data, target);
      } else
      // Indexed modes (Phase 13): bake the previewed indices/mask directly,
      // through the same resolved mode as the classic branch below.
      if (ZX_SPECTRUM.PIXEL_DEPTH > 1) {
        this._paintIndexedStamp(data, target, color, mode);
      } else
      if (layer.xorMode) {
```

- [ ] **Step 4: Run the test again**

Run: `node tests/attributed-stamp-commit.test.js`
Expected: PASS

- [ ] **Step 5: Run `node tests/run-all.js`**

Expected: all suites pass.

- [ ] **Step 6: Commit**

```bash
git add js/services/selection-service.js tests/attributed-stamp-commit.test.js
git commit -m "feat: attributed stamp commit through PixelDrawRoutine"
```

---

## Task 5: Map Editor — "Save Tile to Stamp"

The core extension is done and tested in isolation; this task is the first real consumer.

**Files:**
- Modify: `js/ui/components/map-editor-dialog.js`
- Test: `tests/browser/map-editor-stamps.spec.js` (new)

**Interfaces:**
- Consumes: `SelectionService.startFloatingPasteFromMask` (existing) + direct `.attrs` assignment (Task 2/3 pattern, same as Task 1's Sprite wiring); `MapService.getTile(index)`, `MapService.attrFields`/`attrByte` are NOT needed here (raw `tile.attr` byte is used directly as one `attrs` entry).
- Produces: `MapEditorDialogClass._buildStampFromTiles(tilesWide, tilesHigh, tileAt)` — shared private helper Task 6 also uses.

- [ ] **Step 1: Write the failing Playwright test**

Create `tests/browser/map-editor-stamps.spec.js`:

```javascript
'use strict';
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

test('Save Tile to Stamp creates a draggable stamp from the selected tile',
    async ({ page }) => {
        await boot(page);
        await page.evaluate(() => MapEditorDialog.open());
        // Add a tile with a known bitmap + attribute, select it
        await page.evaluate(() => {
            const bitmap = new Uint8Array(8).fill(0xFF); // fully solid
            const idx = MapService.addTile(MapService.createTile(bitmap, 0x11), false); // ink1/paper2
            MapEditorDialog._selectTile(idx);
        });

        const before = await page.evaluate(() => LayerManager.layers.length);
        await page.click('.me-save-tile-stamp');
        const after = await page.evaluate(() => ({
            layerCount: LayerManager.layers.length,
            isFloating: SelectionService.isFloating(),
            attrs: SelectionService.floatingPaste && SelectionService.floatingPaste.attrs
        }));

        expect(after.layerCount).toBe(before + 1);
        expect(after.isFloating).toBe(true);
        expect(after.attrs).toEqual([0x11]);
    });

test('Save Tile to Stamp is disabled with no tile selected', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => { MapEditorDialog.open(); });
    const disabled = await page.evaluate(() =>
        document.querySelector('.me-save-tile-stamp').disabled);
    expect(disabled).toBe(true); // fresh map has no tiles yet
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx playwright test tests/browser/map-editor-stamps.spec.js`
Expected: FAIL — `.me-save-tile-stamp` doesn't exist.

- [ ] **Step 3: Add the button HTML**

In `js/ui/components/map-editor-dialog.js`, in the tile-toolbar area (around line 77-81, next to `me-add-blank`/`me-from-pattern`/`me-delete-tile`):

```html
                    <button type="button" class="pc-btn me-add-blank" data-i18n="map.addBlank">${this._t('map.addBlank', 'New Tile')}</button>
                    <button type="button" class="pc-btn me-from-pattern" data-i18n="map.fromPattern">${this._t('map.fromPattern', 'From Pattern')}</button>
                    <button type="button" class="pc-btn me-delete-tile" data-i18n="map.deleteTile">${this._t('map.deleteTile', 'Delete Tile')}</button>
                    <button type="button" class="pc-btn me-save-tile-stamp" data-i18n="map.saveTileToStamp" disabled>${this._t('map.saveTileToStamp', 'Save Tile to Stamp')}</button>
```

- [ ] **Step 4: Add the shared stamp-building helper and the click handler**

Add a new private method (near `_deleteSelected`, which already reads `this._selected`):

```javascript
    /**
     * Build a mask + per-cell attrs grid from a rectangle of tiles and hand
     * it to SelectionService as a draggable stamp. Shared by Save Tile to
     * Stamp (1x1) and Save Room to Stamp (Task 6). tileAt(cx, cy) returns a
     * tile object ({bitmap, attr}) or null for an empty cell.
     * @param {number} tilesWide
     * @param {number} tilesHigh
     * @param {function(number,number):(Object|null)} tileAt
     * @param {string} label - undo/stamp label
     * @private
     */
    _buildStampFromTiles(tilesWide, tilesHigh, tileAt, label) {
        const { w: cw, h: ch } = MapService.getTileSize();
        const width = tilesWide * cw, height = tilesHigh * ch;
        const mask = Array.from({ length: height }, () => Array(width).fill(false));
        const attrs = new Array(tilesWide * tilesHigh).fill(null);

        for (let ty = 0; ty < tilesHigh; ty++) {
            for (let tx = 0; tx < tilesWide; tx++) {
                const tile = tileAt(tx, ty);
                if (!tile) continue;
                attrs[ty * tilesWide + tx] = tile.attr;
                for (let ly = 0; ly < ch; ly++) {
                    const byte = tile.bitmap[ly];
                    for (let lx = 0; lx < cw; lx++) {
                        if ((byte >> (cw - 1 - lx)) & 1) {
                            mask[ty * ch + ly][tx * cw + lx] = true;
                        }
                    }
                }
            }
        }

        SelectionService.startFloatingPasteFromMask(mask, width, height, 0, 0, label);
        if (!SelectionService.floatingPaste) return false; // max layers reached
        SelectionService.floatingPaste.attrs = attrs;
        SelectionService.floatingPaste.floatingLayer.clear();
        LayerManager.composeToCanvas();
        SelectionService._drawFloatingLayer();
        LayerManager.flushPendingCompose();
        CanvasSystem.requestRender();
        return true;
    }

    _saveTileToStamp() {
        const tile = MapService.getTile(this._selected);
        if (!tile) return;
        this._buildStampFromTiles(1, 1, () => tile,
            this._t('map.saveTileToStamp', 'Save Tile to Stamp'));
        this._status(this._t('map.status.tileStamped', 'Tile saved as a stamp.'));
    }
```

Wire the click handler in `_attachEvents` (near the existing `.me-delete-tile` handler, around line 213):

```javascript
        c.querySelector('.me-save-tile-stamp').addEventListener('click', () => this._saveTileToStamp());
```

- [ ] **Step 5: Keep the button's enabled state in sync with tile selection**

Find `_selectTile` (referenced throughout, e.g. line 323 area) and `_refreshTileList` (referenced at line 305-312 area) — both change what `this._selected` is. Add a small sync call at the end of `_selectTile(index)`:

```javascript
    _selectTile(index) {
        this._selected = index;
        // ... existing body ...
        this._syncStampButtons();
    }
```

Add the new `_syncStampButtons` method:

```javascript
    /** Keep Save Tile to Stamp's enabled state matched to whether a tile is selected. @private */
    _syncStampButtons() {
        if (!this._root) return;
        const btn = this._root.querySelector('.me-save-tile-stamp');
        if (btn) btn.disabled = this._selected < 0;
    }
```

Call `this._syncStampButtons()` once at the end of `open()` too (after `this._attachEvents(content)`), so a freshly-opened dialog with no tiles starts disabled, and call it from `_refreshTileList()` (it already runs whenever the tileset changes, e.g. after a delete that leaves `this._selected` pointing at nothing).

- [ ] **Step 6: Add the i18n keys to `js/i18n/en.js`**

```javascript
    'map.saveTileToStamp': 'Save Tile to Stamp',
    'map.status.tileStamped': 'Tile saved as a stamp.',
```

- [ ] **Step 7: Run the Playwright test again**

Run: `npx playwright test tests/browser/map-editor-stamps.spec.js`
Expected: both tests PASS.

- [ ] **Step 8: Run `node tests/run-all.js`**

Expected: passes except `i18n-parity.test.js` (fixed in Task 7).

- [ ] **Step 9: Commit**

```bash
git add js/ui/components/map-editor-dialog.js js/i18n/en.js tests/browser/map-editor-stamps.spec.js
git commit -m "feat: map editor Save Tile to Stamp"
```

---

## Task 6: Map Editor — Select tool, "Save Room to Stamp", remove Render to Canvas

**Files:**
- Modify: `js/ui/components/map-editor-dialog.js`
- Modify: `js/services/map-service.js` (remove `renderMapToCanvas`)
- Modify: `js/i18n/en.js`
- Test: `tests/browser/map-editor-stamps.spec.js` (extend from Task 5)

**Interfaces:**
- Consumes: `MapEditorDialogClass._buildStampFromTiles` (Task 5).
- Produces: `this._tool = 'select'` as a fifth map-viewport tool value; `this._roomRect` (`{x0,y0,x1,y1}` in map cell coordinates, or `null`).

- [ ] **Step 1: Write the failing Playwright test**

Add to `tests/browser/map-editor-stamps.spec.js`:

```javascript
test('Save Room to Stamp stamps a dragged rectangle of tiles, and Render to Canvas is gone',
    async ({ page }) => {
        await boot(page);
        await page.evaluate(() => MapEditorDialog.open());
        await page.evaluate(() => {
            const bitmap = new Uint8Array(8).fill(0xFF);
            const idx = MapService.addTile(MapService.createTile(bitmap, 0x11), false);
            MapService.newMap(4, 4);
            MapService.setMapCell(0, 0, idx);
            MapService.setMapCell(1, 0, idx);
        });

        const renderButtonGone = await page.evaluate(() =>
            !document.querySelector('.me-render'));
        expect(renderButtonGone).toBe(true);

        await page.click('[data-maptool="select"]');
        // Drag from map cell (0,0) to (1,0) on the viewport canvas
        const canvas = page.locator('.me-map-canvas');
        const box = await canvas.boundingBox();
        const ts = await page.evaluate(() => MapEditorDialog._tilePx());
        await page.mouse.move(box.x + 1, box.y + 1);
        await page.mouse.down();
        await page.mouse.move(box.x + ts * 2 - 1, box.y + ts - 1);
        await page.mouse.up();

        const before = await page.evaluate(() => LayerManager.layers.length);
        await page.click('.me-save-room-stamp');
        const after = await page.evaluate(() => ({
            layerCount: LayerManager.layers.length,
            attrs: SelectionService.floatingPaste && SelectionService.floatingPaste.attrs
        }));

        expect(after.layerCount).toBe(before + 1);
        expect(after.attrs).toEqual([0x11, 0x11]);
    });

test('Save Room to Stamp is disabled with no room selected', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => MapEditorDialog.open());
    const disabled = await page.evaluate(() =>
        document.querySelector('.me-save-room-stamp').disabled);
    expect(disabled).toBe(true);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx playwright test tests/browser/map-editor-stamps.spec.js`
Expected: FAIL — `.me-render` still exists, `[data-maptool="select"]` doesn't exist, `.me-save-room-stamp` doesn't exist, `_tilePx` may not be exposed (it already exists internally per `_onMapPointer`'s use — confirm it's callable as `MapEditorDialog._tilePx()` in the test; it is, since dialogs are singletons attached to `window`).

- [ ] **Step 3: Remove Render to Canvas**

In `js/ui/components/map-editor-dialog.js`, delete the button from the HTML template (the `.me-bridges` block, around line 128):

```html
                    <button type="button" class="pc-btn me-render" data-i18n="map.renderToCanvas">${this._t('map.renderToCanvas', 'Render to Canvas')}</button>
```

Delete its click handler (around line 268-272):

```javascript
        c.querySelector('.me-render').addEventListener('click', () => {
            const origin = this._scrollOriginCells();
            MapService.renderMapToCanvas(origin.x, origin.y, 0, 0);
            this._status(this._t('map.status.rendered', 'Map rendered to canvas.'));
        });
```

In `js/services/map-service.js`, delete the entire `renderMapToCanvas(...)` method (lines 393-426, from its JSDoc comment through the closing `}`).

- [ ] **Step 4: Add the Select tool button and the Save Room to Stamp button**

In the map-viewport toolbar's tool group (around line 102-107), add a fifth tool button after Pick:

```html
                        <span class="btn-captioned">${Helpers.captionHTML('map.tool.select', 'Select')}<button type="button" data-maptool="select" class="tool-btn" data-i18n-title-name="map.tool.select" data-i18n-title="map.tool.select.hint" data-i18n-aria-label="map.tool.select" aria-label="${this._t('map.tool.select', 'Select')}" title="${Helpers.composeTitle(this._t('map.tool.select', 'Select'), this._t('map.tool.select.hint', 'Drag a rectangle of tiles to save as one stamp'))}"><span class="tool-icon">S</span></button></span>
```

In `.me-bridges` (where Render to Canvas used to be), add:

```html
                    <button type="button" class="pc-btn me-save-room-stamp" data-i18n="map.saveRoomToStamp" disabled>${this._t('map.saveRoomToStamp', 'Save Room to Stamp')}</button>
```

Wire its click handler where the old `.me-render` handler was:

```javascript
        c.querySelector('.me-save-room-stamp').addEventListener('click', () => {
            if (!this._roomRect) return;
            // Re-clamp against the CURRENT map size before reading tiles: the
            // map may have been resized/reloaded since the rectangle was
            // dragged, and a stale rectangle must never read past the map's
            // own bounds (MapService.getMapCell already returns -1 out of
            // bounds, but clamping here keeps the stamp's dimensions honest
            // rather than silently shrinking with holes).
            const map = MapService.getMap();
            const x0 = Math.min(this._roomRect.x0, map.width - 1);
            const y0 = Math.min(this._roomRect.y0, map.height - 1);
            const x1 = Math.min(this._roomRect.x1, map.width - 1);
            const y1 = Math.min(this._roomRect.y1, map.height - 1);
            this._buildStampFromTiles(x1 - x0 + 1, y1 - y0 + 1,
                (tx, ty) => MapService.getTile(MapService.getMapCell(x0 + tx, y0 + ty)),
                this._t('map.saveRoomToStamp', 'Save Room to Stamp'));
            this._status(this._t('map.status.roomStamped', 'Room saved as a stamp.'));
        });
```

- [ ] **Step 5: Track the rectangle drag in `_onMapPointer`, clamp to the map bounds**

Add `this._roomRect = null;` and `this._roomDragStart = null;` to the constructor (alongside the other `this._...` fields).

In `_onMapPointer(e, isDown)` (around line 520), add a `case 'select':` branch to the `switch (this._tool)` block, and update the rectangle on every move:

```javascript
    _onMapPointer(e, isDown) {
        e.preventDefault();
        const ts = this._tilePx();
        const rect = this._canvas.getBoundingClientRect();
        // Canvas sits at the scroll offset, so canvas-local + scroll = content
        const x = Math.floor((e.clientX - rect.left + this._viewport.scrollLeft) / ts);
        const y = Math.floor((e.clientY - rect.top + this._viewport.scrollTop) / ts);

        if (isDown) this._painting = true;
        const erase = this._tool === 'erase' || (e.buttons & 2) !== 0 || e.button === 2;

        switch (this._tool) {
            case 'select': {
                const map = MapService.getMap();
                const cx = Math.max(0, Math.min(map.width - 1, x));
                const cy = Math.max(0, Math.min(map.height - 1, y));
                if (isDown) this._roomDragStart = { x: cx, y: cy };
                if (this._roomDragStart) {
                    const sx = this._roomDragStart.x, sy = this._roomDragStart.y;
                    this._roomRect = {
                        x0: Math.min(sx, cx), y0: Math.min(sy, cy),
                        x1: Math.max(sx, cx), y1: Math.max(sy, cy)
                    };
                    this._syncStampButtons();
                    this._redrawMap();
                }
                break;
            }
            case 'pick': {
                if (!isDown) break;
                const idx = MapService.getMapCell(x, y);
                if (idx >= 0) this._selectTile(idx);
                this._painting = false;
                break;
            }
            case 'fill':
                if (isDown) {
                    MapService.floodFill(x, y, erase ? -1 : this._selected);
                    this._painting = false;
                }
                break;
            default: // paint / erase drags
                MapService.setMapCell(x, y, erase ? -1 : this._selected);
        }
    }
```

Also end the drag on pointerup — find the existing `pointerup`/`pointerleave` listeners (around line 263-264) and clear `this._roomDragStart` there (the finished `this._roomRect` itself must survive so the button stays enabled after releasing the mouse):

```javascript
        this._canvas.addEventListener('pointerup', () => { this._painting = false; this._roomDragStart = null; });
        this._canvas.addEventListener('pointerleave', () => { this._painting = false; this._roomDragStart = null; });
```

Extend `_syncStampButtons` (Task 5) to also gate the room button:

```javascript
    _syncStampButtons() {
        if (!this._root) return;
        const tileBtn = this._root.querySelector('.me-save-tile-stamp');
        if (tileBtn) tileBtn.disabled = this._selected < 0;
        const roomBtn = this._root.querySelector('.me-save-room-stamp');
        if (roomBtn) roomBtn.disabled = !this._roomRect;
    }
```

- [ ] **Step 6: Draw the selection rectangle overlay in `_redrawMap`**

At the end of `_redrawMap()` (around line 488, right after the cell-grid drawing block closes), add:

```javascript
        if (this._roomRect) {
            const { x0, y0, x1, y1 } = this._roomRect;
            ctx.strokeStyle = 'rgba(80,160,255,0.9)';
            ctx.lineWidth = 2;
            ctx.strokeRect(x0 * ts - sx, y0 * ts - sy, (x1 - x0 + 1) * ts, (y1 - y0 + 1) * ts);
        }
```

- [ ] **Step 7: Reset `_roomRect` when the map changes shape or the dialog reopens**

In `newMap`/`_onClose` handling — simplest correct approach: clear `this._roomRect = null;` inside `_onClose()` (alongside the existing cleanup) so a reopened dialog starts with no stale rectangle, and clear it in the `EVENTS.MAP_LOADED` handler's callback (`_refreshAll`, already subscribed in `open()`) by adding one line at the top of `_refreshAll()`: `this._roomRect = null; this._roomDragStart = null;` — a loaded/imported map invalidates any prior selection.

- [ ] **Step 8: Add the i18n keys to `js/i18n/en.js`**

Remove `map.renderToCanvas` (now unused — confirm with `grep -rn "map.renderToCanvas" js/` before deleting) and `map.status.rendered`, add:

```javascript
    'map.tool.select': 'Select',
    'map.tool.select.hint': 'Drag a rectangle of tiles to save as one stamp',
    'map.saveRoomToStamp': 'Save Room to Stamp',
    'map.status.roomStamped': 'Room saved as a stamp.',
```

- [ ] **Step 9: Run the Playwright tests again**

Run: `npx playwright test tests/browser/map-editor-stamps.spec.js`
Expected: all four tests PASS.

- [ ] **Step 10: Run `node tests/run-all.js`**

Expected: passes except `i18n-parity.test.js` (fixed in Task 7). Also confirm no other test references `MapService.renderMapToCanvas` or `.me-render` — search first:

```bash
grep -rln "renderMapToCanvas\|\.me-render\b\|map\.renderToCanvas\|map\.status\.rendered" tests/ js/
```

Fix or remove any remaining reference the search turns up (expected: none outside what this task already changed).

- [ ] **Step 11: Commit**

```bash
git add js/ui/components/map-editor-dialog.js js/services/map-service.js js/i18n/en.js tests/browser/map-editor-stamps.spec.js
git commit -m "feat: map editor Select tool, Save Room to Stamp, remove Render to Canvas"
```

---

## Task 7: i18n parity — all 13 locales

**Files:**
- Modify: all 13 files in `js/i18n/` except `en.js` (already has the keys from Tasks 1, 5, 6)
- Test: `tests/i18n-parity.test.js` (existing, unmodified)

**Interfaces:**
- Consumes: the exact key list added to `en.js` across Tasks 1/5/6.
- Produces: nothing new — this task only restores parity.

- [ ] **Step 1: Run the parity test to see the exact gap**

Run: `node tests/i18n-parity.test.js`
Expected: FAIL, listing every locale missing: `sprite.saveAsStamp`, `sprite.saveAsStamp.hint`, `sprite.stampSaved`, `map.saveTileToStamp`, `map.status.tileStamped`, `map.tool.select`, `map.tool.select.hint`, `map.saveRoomToStamp`, `map.status.roomStamped` (and confirm `sprite.stamp`/`sprite.stamp.hint`/`map.renderToCanvas`/`map.status.rendered` are flagged as extra/removed-from-en if Tasks 1/6 deleted them from `en.js`).

- [ ] **Step 2: Add natively-translated values to each of the 12 other locale files**

For each of `cs.js`, `de.js`, `es.js`, `fr.js`, `hu.js`, `it.js`, `pl.js`, `pt.js`, `ro.js`, `ru.js`, `sk.js`, `tr.js`: add the same key set with a real translation in that language (matching the tone/length of neighbouring keys already in the file — e.g. `sprite.stamp`'s existing translations are the closest reference for `sprite.saveAsStamp`, `map.tool.pick`'s for `map.tool.select`), and remove `sprite.stamp`/`sprite.stamp.hint`/`map.renderToCanvas`/`map.status.rendered` if Tasks 1/6 removed those from `en.js`. Insert each new key at the same relative position `en.js` has it (parity test does not check ordering, but keeping locale files aligned in structure matches the existing convention every other phase in this project's history has followed).

- [ ] **Step 3: Run the parity test again**

Run: `node tests/i18n-parity.test.js`
Expected: PASS — `13 locales x N keys consistent`.

- [ ] **Step 4: Run the full suite**

Run: `node tests/run-all.js`
Expected: ALL TEST FILES PASSED.

- [ ] **Step 5: Run the full Playwright suite for this feature area**

Run: `npx playwright test tests/browser/sprite-editor.spec.js tests/browser/map-editor-stamps.spec.js`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add js/i18n/
git commit -m "i18n: attributed-stamps strings across all 13 locales"
```

---

## Final check (run once, after Task 7)

```bash
npm run build:portable
node tests/run-all.js
grep -rln "renderMapToCanvas\|\.me-render\b\|stampToCanvas\|\.se-stamp\b" PixULA_Distilled/js/
```

The `grep` must return nothing (empty output = pass) — it confirms the portable build regenerated cleanly from the finished source tree, with no leftover reference to any of the removed/renamed symbols this plan touches.
