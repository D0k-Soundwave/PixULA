# Tooltip Coverage — Batch 1 (Systemic Fixes) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the highest-leverage, currently-untooltipped controls (every dialog's close button, the zoom in/out/fit buttons, and the `option-controls.js` icon-button hint plumbing) into PixULA's existing two-stage hover convention, and dedupe the copy-pasted mini brush/eraser/line/fill toolset shared by three dialogs into one hinted source of truth.

**Architecture:** No new mechanism. Every fix reuses `Helpers.composeTitle`/`Helpers.splitTitle` and `TooltipManager`'s `SELECTOR`-based two-stage hover (`js/ui/tooltip-manager.js`), the same pattern the tool rail and this session's panel-header work already use. Controls that are flat-native get a class/id added to `SELECTOR`; controls that are name-only get a real hint composed in via `data-i18n-title`/`data-i18n-title-name`.

**Tech Stack:** Vanilla JS (IIFE singletons), native `<dialog>`, Playwright browser tests, `node tests/run-all.js` (lint + i18n parity).

**Spec:** `docs/superpowers/specs/2026-08-20-tooltip-coverage-design.md`

## Global Constraints

- Every new/changed hint key gets natively translated into all 13 locale files (`js/i18n/*.js`) — no machine translation. `tests/i18n-parity.test.js` enforces identical key sets, non-empty values, and `{param}` placeholder consistency across all 13 files; it must pass after every task.
- `en.js` is the key-set source of truth (per `CLAUDE.md`).
- One sentence per hint. States what the control does / how it works. Never restates the visible name.
- Reuse an existing `.hint`-suffixed key when it is already accurate for the new context, rather than authoring a near-duplicate (this plan does so for `tool.eraser.hint` / `tool.fill.hint` — see Task 4).
- `node tests/run-all.js` must pass after every task. The relevant Playwright spec(s) must pass after every task. Run the full Playwright suite before the final commit of the batch.
- No `EventBus.emit/on` with string literals, no inline hex colours, no `.onclick=` assignment, no DOM access outside the allowed layers — the existing `tests/lint-architecture.test.js` catches all of this; it is part of `node tests/run-all.js`.
- Follow the repo's commit convention: small, focused commits per task, no AI attribution, no emoji.

---

### Task 1: Dialog close-button hint

**Files:**
- Modify: `js/ui/components/dialog.js:60-65`
- Modify: `js/ui/tooltip-manager.js:36` (SELECTOR)
- Modify: `js/i18n/en.js` + 12 other `js/i18n/*.js` files (new key: `dialog.close.hint`)
- Test: `tests/browser/panel-reorder.spec.js` (new test, or a new small `tests/browser/dialog-tooltip.spec.js` — see Step 1)

**Interfaces:**
- Consumes: `Helpers.composeTitle(name, hint, shortcut)` (existing, `js/utils/helpers.js`), `TooltipManager` (existing, reads any element matching its `SELECTOR`).
- Produces: every `.app-dialog-close` button in the app now carries a real two-stage tooltip. No new public API.

- [ ] **Step 1: Write the failing test**

Create `tests/browser/dialog-tooltip.spec.js`:

```js
'use strict';
/**
 * The close button on every app-wide <dialog> (js/ui/components/dialog.js)
 * gets the same two-stage hover treatment as the rest of the app's chrome —
 * previously it had an aria-label but no title at all.
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

test('a dialog close button has a real two-stage tooltip', async ({ page }) => {
    await boot(page);
    // Preferences is reachable from the Settings menu and has no extra
    // preconditions, so it's a cheap way to get any dialog open.
    await page.click('.menu-item[data-menu="settings"] .menu-label');
    await page.click('.menu-action[data-id="preferences"]');
    const closeBtn = page.locator('.app-dialog-close').first();
    await expect(closeBtn).toBeVisible();

    const title = await closeBtn.getAttribute('title');
    const { name, desc } = await page.evaluate(
        (t) => Helpers.splitTitle(t), title);
    expect(name).toBeTruthy();
    expect(desc).toBeTruthy();
    expect(desc).not.toBe(name);

    const tip = page.locator('.app-tooltip');
    const descEl = page.locator('.app-tooltip-desc');
    await closeBtn.hover();
    await expect(tip).toBeVisible();
    await expect(descEl).toBeVisible({ timeout: 5000 });
    const expectedHint = await page.evaluate(() => window.I18n.t('dialog.close.hint'));
    await expect(descEl).toHaveText(expectedHint);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test tests/browser/dialog-tooltip.spec.js`
Expected: FAIL — `desc` is empty (the close button's title is currently just "Close", no hint), so the `expect(desc).toBeTruthy()` assertion fails.

- [ ] **Step 3: Add `dialog.close.hint` to `js/i18n/en.js`**

Grep for the exact line `'dialog.close': 'Close',` in `js/i18n/en.js` (it is currently at line 493) and insert immediately after it:

```js
    'dialog.close.hint': 'You can also press Escape to close this dialog',
```

- [ ] **Step 4: Add the same key, natively translated, to the other 12 locale files**

For each file below, grep for the exact line `'dialog.close': '<value>',` (the translated value differs per file — grep the key name, not the value, to find the line), and insert the new key immediately after it with this translated value:

| Locale | `dialog.close.hint` |
|---|---|
| cs | `Dialog můžete zavřít také klávesou Escape` |
| de | `Sie können diesen Dialog auch mit Escape schließen` |
| es | `También puede cerrar este cuadro de diálogo con Escape` |
| fr | `Vous pouvez aussi fermer cette boîte de dialogue avec la touche Échap` |
| hu | `Ezt a párbeszédablakot az Esc billentyűvel is bezárhatja` |
| it | `È possibile chiudere questa finestra anche con il tasto Esc` |
| pl | `To okno można też zamknąć klawiszem Escape` |
| pt | `Também pode fechar esta caixa de diálogo com Escape` |
| ro | `Puteți închide și această fereastră cu tasta Escape` |
| ru | `Это окно можно также закрыть клавишей Escape` |
| sk | `Tento dialóg môžete zavrieť aj klávesom Escape` |
| tr | `Bu iletişim kutusunu Escape tuşuyla da kapatabilirsiniz` |

Format for each file (example, cs.js): `'dialog.close.hint': 'Dialog můžete zavřít také klávesou Escape',`

- [ ] **Step 5: Add `.app-dialog-close` to `TooltipManager`'s SELECTOR**

In `js/ui/tooltip-manager.js:36`, change:

```js
const SELECTOR = '.tool-btn, .panel-collapse, .layer-ctrl-btn, .panel-header';
```

to:

```js
const SELECTOR = '.tool-btn, .panel-collapse, .layer-ctrl-btn, .panel-header, .app-dialog-close';
```

- [ ] **Step 6: Wire the composed title in `js/ui/components/dialog.js`**

Replace lines 60-65:

```js
        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'app-dialog-close';
        closeBtn.setAttribute('aria-label', this._t('dialog.close', 'Close'));
        closeBtn.textContent = '×';
        closeBtn.addEventListener('click', () => this.close(id));
```

with:

```js
        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'app-dialog-close';
        closeBtn.dataset.i18nTitleName = 'dialog.close';
        closeBtn.dataset.i18nTitle = 'dialog.close.hint';
        closeBtn.dataset.i18nAriaLabel = 'dialog.close';
        closeBtn.setAttribute('aria-label', this._t('dialog.close', 'Close'));
        closeBtn.title = Helpers.composeTitle(
            this._t('dialog.close', 'Close'),
            this._t('dialog.close.hint', 'You can also press Escape to close this dialog')
        );
        closeBtn.textContent = '×';
        closeBtn.addEventListener('click', () => this.close(id));
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npx playwright test tests/browser/dialog-tooltip.spec.js`
Expected: PASS

- [ ] **Step 8: Run the i18n parity and lint gates**

Run: `node tests/run-all.js`
Expected: `ALL TEST FILES PASSED` (this exercises `tests/i18n-parity.test.js`, which fails the build on any locale missing the new key, an empty value, or placeholder drift).

- [ ] **Step 9: Commit**

```bash
git add js/ui/components/dialog.js js/ui/tooltip-manager.js js/i18n/*.js tests/browser/dialog-tooltip.spec.js
git commit -m "feat: give every dialog's close button a real hover hint"
```

---

### Task 2: Zoom in/out/fit hints

**Files:**
- Modify: `js/ui/components/canvas-controls.js:90-129`
- Modify: `js/ui/tooltip-manager.js:36` (SELECTOR)
- Modify: `js/i18n/en.js` + 12 other `js/i18n/*.js` files (new keys: `view.zoomOut.hint`, `view.zoomIn.hint`, `view.zoomFit.hint`)
- Test: `tests/browser/shell.spec.js` (extend the existing `status strip: zoom controls, grid toggles, readouts` test, or add a new test right after it)

**Interfaces:**
- Consumes: `Helpers.composeTitle`, `TooltipManager`.
- Produces: `#zoom-out`, `#zoom-in`, `#zoom-fit` each carry a real two-stage tooltip with their existing keyboard shortcut folded in via `composeTitle`'s third argument.

- [ ] **Step 1: Write the failing test**

In `tests/browser/shell.spec.js`, add a new test after the existing `status strip: zoom controls, grid toggles, readouts` test (around line 559):

```js
test('zoom in/out/fit buttons have real two-stage tooltips', async ({ page }) => {
    await boot(page);
    const cases = [
        { id: '#zoom-out', hintKey: 'view.zoomOut.hint', shortcut: '-' },
        { id: '#zoom-in', hintKey: 'view.zoomIn.hint', shortcut: '+' },
        { id: '#zoom-fit', hintKey: 'view.zoomFit.hint', shortcut: null }
    ];
    for (const { id, hintKey, shortcut } of cases) {
        const title = await page.getAttribute(id, 'title');
        expect(title).toBeTruthy();
        const { name, desc } = await page.evaluate(
            (t) => Helpers.splitTitle(t), title);
        expect(desc).toBeTruthy();
        expect(desc).not.toBe(name);
        const expectedHint = await page.evaluate((k) => window.I18n.t(k), hintKey);
        expect(desc).toBe(expectedHint);
        if (shortcut) expect(name).toContain(`(${shortcut})`);
    }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test tests/browser/shell.spec.js -g "zoom in/out/fit"`
Expected: FAIL — `title` is currently `null`/empty for all three buttons (no `title` attribute is set at all today).

- [ ] **Step 3: Add the three new keys to `js/i18n/en.js`**

Grep for the exact lines (currently at lines 597-599 and 603 of `js/i18n/en.js`):

```js
    'view.zoomIn': 'Zoom in',
    'view.zoomOut': 'Zoom out',
    'view.fitToWindow': 'Fit to window',
```

Insert immediately after `'view.fitToWindow': 'Fit to window',`:

```js
    'view.zoomOut.hint': 'Steps down to the next zoom level',
    'view.zoomIn.hint': 'Steps up to the next zoom level',
    'view.zoomFit.hint': 'Scales the canvas to the largest zoom level that fits the window',
```

- [ ] **Step 4: Add the same three keys, natively translated, to the other 12 locale files**

Grep each file for the line `'view.fitToWindow': '<value>',` and insert the three keys immediately after it, translated per this table:

| Locale | `view.zoomOut.hint` | `view.zoomIn.hint` | `view.zoomFit.hint` |
|---|---|---|---|
| cs | `Přejde na nižší úroveň přiblížení` | `Přejde na vyšší úroveň přiblížení` | `Přizpůsobí plátno největšímu přiblížení, které se vejde do okna` |
| de | `Wechselt zur nächstniedrigeren Zoomstufe` | `Wechselt zur nächsthöheren Zoomstufe` | `Skaliert die Leinwand auf die größte Zoomstufe, die ins Fenster passt` |
| es | `Pasa al siguiente nivel de zoom inferior` | `Pasa al siguiente nivel de zoom superior` | `Ajusta el lienzo al mayor nivel de zoom que cabe en la ventana` |
| fr | `Passe au niveau de zoom inférieur suivant` | `Passe au niveau de zoom supérieur suivant` | `Ajuste le canevas au plus grand niveau de zoom qui tient dans la fenêtre` |
| hu | `Eggyel kisebb nagyítási szintre lép` | `Eggyel nagyobb nagyítási szintre lép` | `A vászont a legnagyobb, az ablakba még beférő nagyítási szintre állítja` |
| it | `Passa al livello di zoom inferiore successivo` | `Passa al livello di zoom superiore successivo` | `Adatta la tela al livello di zoom più grande che rientra nella finestra` |
| pl | `Przechodzi do niższego poziomu powiększenia` | `Przechodzi do wyższego poziomu powiększenia` | `Dopasowuje płótno do największego poziomu powiększenia mieszczącego się w oknie` |
| pt | `Passa para o nível de zoom inferior seguinte` | `Passa para o nível de zoom superior seguinte` | `Ajusta a tela ao maior nível de zoom que cabe na janela` |
| ro | `Trece la nivelul de zoom inferior următor` | `Trece la nivelul de zoom superior următor` | `Ajustează pânza la cel mai mare nivel de zoom care încape în fereastră` |
| ru | `Переключает на следующий, более низкий уровень масштаба` | `Переключает на следующий, более высокий уровень масштаба` | `Масштабирует холст до наибольшего уровня, помещающегося в окне` |
| sk | `Prejde na nižšiu úroveň priblíženia` | `Prejde na vyššiu úroveň priblíženia` | `Prispôsobí plátno najväčšiemu priblíženiu, ktoré sa zmestí do okna` |
| tr | `Bir sonraki düşük yakınlaştırma düzeyine geçer` | `Bir sonraki yüksek yakınlaştırma düzeyine geçer` | `Tuvali pencereye sığan en büyük yakınlaştırma düzeyine ölçekler` |

- [ ] **Step 5: Add the zoom button ids to `TooltipManager`'s SELECTOR**

In `js/ui/tooltip-manager.js:36`, change (building on Task 1's edit):

```js
const SELECTOR = '.tool-btn, .panel-collapse, .layer-ctrl-btn, .panel-header, .app-dialog-close';
```

to:

```js
const SELECTOR = '.tool-btn, .panel-collapse, .layer-ctrl-btn, .panel-header, .app-dialog-close, #zoom-out, #zoom-in, #zoom-fit';
```

- [ ] **Step 6: Wire the composed titles in `js/ui/components/canvas-controls.js`**

Replace lines 90-95 (the `zoomOut` button):

```js
        const zoomOut = document.createElement('button');
        zoomOut.type = 'button';
        zoomOut.id = 'zoom-out';
        zoomOut.dataset.i18nAriaLabel = 'view.zoomOut';
        zoomOut.setAttribute('aria-label', this._t('view.zoomOut', 'Zoom out'));
        zoomOut.textContent = '-';
```

with:

```js
        const zoomOut = document.createElement('button');
        zoomOut.type = 'button';
        zoomOut.id = 'zoom-out';
        zoomOut.dataset.i18nAriaLabel = 'view.zoomOut';
        zoomOut.dataset.i18nTitleName = 'view.zoomOut';
        zoomOut.dataset.i18nTitle = 'view.zoomOut.hint';
        zoomOut.dataset.shortcut = '-';
        zoomOut.setAttribute('aria-label', this._t('view.zoomOut', 'Zoom out'));
        zoomOut.title = Helpers.composeTitle(
            this._t('view.zoomOut', 'Zoom out'),
            this._t('view.zoomOut.hint', 'Steps down to the next zoom level'),
            '-'
        );
        zoomOut.textContent = '-';
```

Replace lines 111-116 (the `zoomIn` button):

```js
        const zoomIn = document.createElement('button');
        zoomIn.type = 'button';
        zoomIn.id = 'zoom-in';
        zoomIn.dataset.i18nAriaLabel = 'view.zoomIn';
        zoomIn.setAttribute('aria-label', this._t('view.zoomIn', 'Zoom in'));
        zoomIn.textContent = '+';
```

with:

```js
        const zoomIn = document.createElement('button');
        zoomIn.type = 'button';
        zoomIn.id = 'zoom-in';
        zoomIn.dataset.i18nAriaLabel = 'view.zoomIn';
        zoomIn.dataset.i18nTitleName = 'view.zoomIn';
        zoomIn.dataset.i18nTitle = 'view.zoomIn.hint';
        zoomIn.dataset.shortcut = '+';
        zoomIn.setAttribute('aria-label', this._t('view.zoomIn', 'Zoom in'));
        zoomIn.title = Helpers.composeTitle(
            this._t('view.zoomIn', 'Zoom in'),
            this._t('view.zoomIn.hint', 'Steps up to the next zoom level'),
            '+'
        );
        zoomIn.textContent = '+';
```

Replace lines 118-124 (the `zoomFit` button):

```js
        const zoomFit = document.createElement('button');
        zoomFit.type = 'button';
        zoomFit.id = 'zoom-fit';
        zoomFit.dataset.i18nAriaLabel = 'view.fitToWindow';
        zoomFit.setAttribute('aria-label', this._t('view.fitToWindow', 'Fit to window'));
        zoomFit.dataset.i18n = 'zoom.fit';
        zoomFit.textContent = this._t('zoom.fit', 'Fit');
```

with:

```js
        const zoomFit = document.createElement('button');
        zoomFit.type = 'button';
        zoomFit.id = 'zoom-fit';
        zoomFit.dataset.i18nAriaLabel = 'view.fitToWindow';
        zoomFit.dataset.i18nTitleName = 'view.fitToWindow';
        zoomFit.dataset.i18nTitle = 'view.zoomFit.hint';
        zoomFit.setAttribute('aria-label', this._t('view.fitToWindow', 'Fit to window'));
        zoomFit.title = Helpers.composeTitle(
            this._t('view.fitToWindow', 'Fit to window'),
            this._t('view.zoomFit.hint', 'Scales the canvas to the largest zoom level that fits the window')
        );
        zoomFit.dataset.i18n = 'zoom.fit';
        zoomFit.textContent = this._t('zoom.fit', 'Fit');
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npx playwright test tests/browser/shell.spec.js -g "zoom in/out/fit"`
Expected: PASS

- [ ] **Step 8: Run the full existing `shell.spec.js` file to check nothing else broke**

Run: `npx playwright test tests/browser/shell.spec.js`
Expected: all tests PASS (the pre-existing `status strip: zoom controls...` test only checks the buttons are attached, not their title, so it is unaffected).

- [ ] **Step 9: Run the i18n parity and lint gates**

Run: `node tests/run-all.js`
Expected: `ALL TEST FILES PASSED`

- [ ] **Step 10: Commit**

```bash
git add js/ui/components/canvas-controls.js js/ui/tooltip-manager.js js/i18n/*.js tests/browser/shell.spec.js
git commit -m "feat: give the zoom in/out/fit buttons real hover hints"
```

---

### Task 3: `option-controls.js` icon-button hint plumbing (mechanism + Shape Type "basic" category)

This task adds the ability for a tool's `optionsSchema` icon-grid options to carry a real hint, and proves it end-to-end on the four "basic" entries of the Shape Type row (`SHAPE_TYPE_OPTS` in `js/tools/shape-tool.js`). The remaining shape categories (radial, polygons, symbols, complex) and every other tool's icon-grid options are explicitly OUT of scope for this task — they are batch 2/3 content-authoring work using the mechanism this task lands.

**Files:**
- Modify: `js/ui/components/option-controls.js:320-342` (`_buildIconButton`)
- Modify: `js/tools/shape-tool.js:26-32` (`SHAPE_TYPE_OPTS`, "basic" category only)
- Modify: `js/i18n/en.js` + 12 other `js/i18n/*.js` files (new keys: `shapeType.line.hint`, `shapeType.rectangle.hint`, `shapeType.square.hint`, `shapeType.roundedRectangle.hint`)
- Test: new `tests/browser/option-icon-hints.spec.js`

**Interfaces:**
- Consumes: `Helpers.composeTitle`, the local `t()` helper already in `option-controls.js:29`.
- Produces: an `optionsSchema` icon-grid entry may now carry an optional `hintI18n` (and optional `hintFallback`) field; `_buildIconButton` composes it into the button's title when present, and behaves exactly as before when absent (backward compatible — every other tool's icon-grid options are untouched by this task and keep rendering name-only, matching their current behavior).

- [ ] **Step 1: Write the failing test**

Create `tests/browser/option-icon-hints.spec.js`:

```js
'use strict';
/**
 * option-controls.js's icon-grid buttons (_buildIconButton) can now carry a
 * real "how it works" hint via an optional hintI18n field on the schema
 * option, composed the same way the tool rail's buttons are. This batch
 * proves the mechanism on the Shape Type row's "basic" category; other
 * tools' icon-grid options are deliberately unchanged (batch 2/3 work).
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

test('shape type basic-category buttons have real two-stage tooltips', async ({ page }) => {
    await boot(page);
    await page.keyboard.press('s'); // Shape tool
    const values = ['line', 'rectangle', 'square', 'rounded-rectangle'];
    for (const value of values) {
        const btn = page.locator(`.opt-icon-grid button[data-value="${value}"]`);
        await expect(btn).toBeAttached();
        const title = await btn.getAttribute('title');
        const { name, desc } = await page.evaluate(
            (t) => Helpers.splitTitle(t), title);
        expect(desc).toBeTruthy();
        expect(desc).not.toBe(name);
    }
});

test('a shape type button with no hintI18n still renders name-only, unchanged', async ({ page }) => {
    await boot(page);
    await page.keyboard.press('s');
    // 'triangle' is in the polygons category, untouched by this task.
    const btn = page.locator('.opt-icon-grid button[data-value="triangle"]');
    const title = await btn.getAttribute('title');
    const { name, desc } = await page.evaluate(
        (t) => Helpers.splitTitle(t), title);
    expect(name).toBeTruthy();
    expect(desc).toBe('');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test tests/browser/option-icon-hints.spec.js`
Expected: the first test FAILs (`desc` is empty for all four "basic" buttons today); the second test PASSes already (documents current behavior as the "no regression" baseline).

- [ ] **Step 3: Add the four new keys to `js/i18n/en.js`**

Grep for the exact line `'shape.roundedRectangle': 'Rounded Rectangle',` in `js/i18n/en.js` (currently at line 304) and insert immediately after it:

```js
    'shapeType.line.hint': 'Drag to draw a straight line between two points',
    'shapeType.rectangle.hint': 'Drag to draw a rectangle from corner to corner',
    'shapeType.square.hint': 'Drag to draw a rectangle with equal sides',
    'shapeType.roundedRectangle.hint': 'Drag to draw a rectangle with rounded corners',
```

- [ ] **Step 4: Add the same four keys, natively translated, to the other 12 locale files**

Grep each file for the line `'shape.roundedRectangle': '<value>',` and insert the four keys immediately after it, translated per this table:

| Locale | `shapeType.line.hint` | `shapeType.rectangle.hint` | `shapeType.square.hint` | `shapeType.roundedRectangle.hint` |
|---|---|---|---|---|
| cs | `Tažením nakreslíte přímku mezi dvěma body` | `Tažením nakreslíte obdélník z rohu do rohu` | `Tažením nakreslíte obdélník se stejnými stranami` | `Tažením nakreslíte obdélník se zaoblenými rohy` |
| de | `Ziehen, um eine gerade Linie zwischen zwei Punkten zu zeichnen` | `Ziehen, um ein Rechteck von Ecke zu Ecke zu zeichnen` | `Ziehen, um ein Rechteck mit gleich langen Seiten zu zeichnen` | `Ziehen, um ein Rechteck mit abgerundeten Ecken zu zeichnen` |
| es | `Arrastre para dibujar una línea recta entre dos puntos` | `Arrastre para dibujar un rectángulo de esquina a esquina` | `Arrastre para dibujar un rectángulo de lados iguales` | `Arrastre para dibujar un rectángulo con esquinas redondeadas` |
| fr | `Faites glisser pour tracer une ligne droite entre deux points` | `Faites glisser pour tracer un rectangle d'un coin à l'autre` | `Faites glisser pour tracer un rectangle aux côtés égaux` | `Faites glisser pour tracer un rectangle aux coins arrondis` |
| hu | `Húzással egyenes vonalat rajzolhat két pont között` | `Húzással sarokból sarokba rajzolhat téglalapot` | `Húzással egyenlő oldalú téglalapot (négyzetet) rajzolhat` | `Húzással lekerekített sarkú téglalapot rajzolhat` |
| it | `Trascinare per disegnare una linea retta tra due punti` | `Trascinare per disegnare un rettangolo da angolo ad angolo` | `Trascinare per disegnare un rettangolo con lati uguali` | `Trascinare per disegnare un rettangolo con angoli arrotondati` |
| pl | `Przeciągnij, aby narysować linię prostą między dwoma punktami` | `Przeciągnij, aby narysować prostokąt od rogu do rogu` | `Przeciągnij, aby narysować prostokąt o równych bokach` | `Przeciągnij, aby narysować prostokąt z zaokrąglonymi rogami` |
| pt | `Arraste para desenhar uma linha reta entre dois pontos` | `Arraste para desenhar um retângulo de canto a canto` | `Arraste para desenhar um retângulo com lados iguais` | `Arraste para desenhar um retângulo com cantos arredondados` |
| ro | `Trageți pentru a desena o linie dreaptă între două puncte` | `Trageți pentru a desena un dreptunghi din colț în colț` | `Trageți pentru a desena un dreptunghi cu laturi egale` | `Trageți pentru a desena un dreptunghi cu colțuri rotunjite` |
| ru | `Перетащите, чтобы провести прямую линию между двумя точками` | `Перетащите, чтобы нарисовать прямоугольник от угла до угла` | `Перетащите, чтобы нарисовать прямоугольник с равными сторонами` | `Перетащите, чтобы нарисовать прямоугольник со скруглёнными углами` |
| sk | `Ťahaním nakreslíte priamku medzi dvoma bodmi` | `Ťahaním nakreslíte obdĺžnik z rohu do rohu` | `Ťahaním nakreslíte obdĺžnik s rovnakými stranami` | `Ťahaním nakreslíte obdĺžnik so zaoblenými rohmi` |
| tr | `İki nokta arasına düz bir çizgi çizmek için sürükleyin` | `Köşeden köşeye bir dikdörtgen çizmek için sürükleyin` | `Eşit kenarlı bir dikdörtgen çizmek için sürükleyin` | `Yuvarlak köşeli bir dikdörtgen çizmek için sürükleyin` |

- [ ] **Step 5: Add `hintI18n` to the "basic" category in `js/tools/shape-tool.js`**

Replace lines 27-32:

```js
  { i18n: 'shapecat.basic', options: [
    { value: 'line',              i18n: 'shape.line' },
    { value: 'rectangle',         i18n: 'common.rectangle' },
    { value: 'square',            i18n: 'common.square' },
    { value: 'rounded-rectangle', i18n: 'shape.roundedRectangle' }
  ]},
```

with:

```js
  { i18n: 'shapecat.basic', options: [
    { value: 'line',              i18n: 'shape.line',              hintI18n: 'shapeType.line.hint' },
    { value: 'rectangle',         i18n: 'common.rectangle',        hintI18n: 'shapeType.rectangle.hint' },
    { value: 'square',            i18n: 'common.square',           hintI18n: 'shapeType.square.hint' },
    { value: 'rounded-rectangle', i18n: 'shape.roundedRectangle',  hintI18n: 'shapeType.roundedRectangle.hint' }
  ]},
```

- [ ] **Step 6: Add the hint plumbing to `_buildIconButton` in `js/ui/components/option-controls.js`**

Replace lines 320-334:

```js
    /** One shape button: its picture, its name, its lit state. @private */
    _buildIconButton(tool, entry, opt, current) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'tool-btn';
        btn.dataset.value = String(opt.value);

        const name = t(opt.i18n, opt.label !== undefined ? opt.label : String(opt.value));
        // Same attributes the rail's buttons carry, so I18n recomposes the
        // title on a locale change and TooltipManager raises the name tag.
        if (opt.i18n) {
            btn.dataset.i18nTitleName = opt.i18n;
            btn.dataset.i18nAriaLabel = opt.i18n;
        }
        btn.title = Helpers.composeTitle(name, '', '');
        btn.setAttribute('aria-label', name);
```

with:

```js
    /**
     * One shape button: its picture, its name, its lit state.
     *
     * `opt.hintI18n` is optional — an icon-grid option that doesn't set one
     * renders exactly as before (name-only, via I18n's own
     * `[data-i18n-title-name]:not([data-i18n-title])` fallback path). Only
     * the Shape Type row's "basic" category sets one so far; every other
     * tool's icon-grid options are unaffected until they are given one too.
     * @private
     */
    _buildIconButton(tool, entry, opt, current) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'tool-btn';
        btn.dataset.value = String(opt.value);

        const name = t(opt.i18n, opt.label !== undefined ? opt.label : String(opt.value));
        const hint = opt.hintI18n ? t(opt.hintI18n, opt.hintFallback || '') : '';
        // Same attributes the rail's buttons carry, so I18n recomposes the
        // title on a locale change and TooltipManager raises the name tag.
        if (opt.i18n) {
            btn.dataset.i18nTitleName = opt.i18n;
            btn.dataset.i18nAriaLabel = opt.i18n;
        }
        if (opt.hintI18n) btn.dataset.i18nTitle = opt.hintI18n;
        btn.title = Helpers.composeTitle(name, hint, '');
        btn.setAttribute('aria-label', name);
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npx playwright test tests/browser/option-icon-hints.spec.js`
Expected: both tests PASS.

- [ ] **Step 8: Run the i18n parity, lint gates, and the full Node suite**

Run: `node tests/run-all.js`
Expected: `ALL TEST FILES PASSED` (`tests/shape-icons.test.js` and `tests/shape-rasters.test.js` both read `SHAPE_TYPE_OPTS` but only check `.icon`/`.value` presence, not an exact key set, so the new `hintI18n` field does not affect them).

- [ ] **Step 9: Commit**

```bash
git add js/ui/components/option-controls.js js/tools/shape-tool.js js/i18n/*.js tests/browser/option-icon-hints.spec.js
git commit -m "feat: let tool option icon-buttons carry a real hover hint, starting with Shape Type's basic category"
```

---

### Task 4: Shared mini-toolset builder (Pattern Creator / Font Editor / Map Editor)

**Files:**
- Modify: `js/utils/helpers.js` (new `Helpers.miniToolButton`)
- Modify: `js/ui/pattern-creator-panel.js:85-88`
- Modify: `js/ui/components/font-editor-dialog.js:80-83`
- Modify: `js/ui/components/map-editor-dialog.js:83-86`
- Modify: `js/i18n/en.js` + 12 other `js/i18n/*.js` files (new keys: `miniTool.brush.hint`, `miniTool.line.hint`; reuses existing `tool.eraser.hint` and `tool.fill.hint` for the other two buttons — no new keys needed for those)
- Test: new `tests/browser/mini-toolset.spec.js`

**Interfaces:**
- Consumes: `Helpers.composeTitle`, `Helpers.captionHTML`, `Helpers.escapeHTML`, `Helpers.tr` (all existing).
- Produces: `Helpers.miniToolButton(tool, letter, nameKey, nameFallback, hintKey, hintFallback, active = false)` returning an HTML string for one captioned mini-tool button. All three dialogs call this instead of hand-copying the markup, so they can no longer drift from each other.

- [ ] **Step 1: Write the failing test**

Create `tests/browser/mini-toolset.spec.js`:

```js
'use strict';
/**
 * The brush/eraser/line/fill mini-toolset shared by the Pattern Creator,
 * Font Editor and Map Editor dialogs (all three built from the CellGridEditor
 * surface) — previously hand-copied into all three with no hover hint in any
 * copy. Helpers.miniToolButton is now the one source of truth.
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

// Font Editor and Map Editor are reached from the File menu; Pattern Creator
// is a TOOL (shortcut K) whose activate() opens its own dialog — confirmed
// against js/ui/menu-system.js (file:fontEditor/file:mapEditor) and
// js/tools/pattern-creator-tool.js (PatternCreatorPanel.open() on activate).
const DIALOGS = [
    { name: 'pattern-creator', host: '.pc-toolbar', open: async (page) => { await page.keyboard.press('k'); } },
    { name: 'font-editor', host: '.app-dialog-body', open: async (page) => {
        await page.click('.menu-item[data-menu="file"] .menu-label');
        await page.click('.menu-action[data-id="font-editor"]');
    } },
    { name: 'map-editor', host: '.app-dialog-body', open: async (page) => {
        await page.click('.menu-item[data-menu="file"] .menu-label');
        await page.click('.menu-action[data-id="map-editor"]');
    } }
];

for (const { name, host, open } of DIALOGS) {
    test(`mini-toolset in ${name} has real two-stage tooltips on all four tools`, async ({ page }) => {
        await boot(page);
        await open(page);
        await expect(page.locator(host).first()).toBeAttached();

        for (const tool of ['brush', 'eraser', 'line', 'fill']) {
            const btn = page.locator(`button[data-tool="${tool}"]`).first();
            await expect(btn).toBeAttached();
            const title = await btn.getAttribute('title');
            const { name: tName, desc } = await page.evaluate(
                (t) => Helpers.splitTitle(t), title);
            expect(desc).toBeTruthy();
            expect(desc).not.toBe(tName);
        }
    });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test tests/browser/mini-toolset.spec.js`
Expected: FAIL — `desc` is empty for every mini-toolset button in all three dialogs today.

- [ ] **Step 3: Add the two new keys to `js/i18n/en.js`**

Grep for the exact line `'tool.fill.hint': 'Flood the area under the cursor out to its edges',` in `js/i18n/en.js` (currently at line 95) and insert immediately after it:

```js
    'miniTool.brush.hint': 'Click or drag to set pixels',
    'miniTool.line.hint': 'Drag to draw a straight line between two points',
```

- [ ] **Step 4: Add the same two keys, natively translated, to the other 12 locale files**

Grep each file for the line `'tool.fill.hint': '<value>',` and insert the two keys immediately after it, translated per this table:

| Locale | `miniTool.brush.hint` | `miniTool.line.hint` |
|---|---|---|
| cs | `Klikněte nebo táhněte pro nastavení pixelů` | `Tažením nakreslíte přímku mezi dvěma body` |
| de | `Klicken oder ziehen, um Pixel zu setzen` | `Ziehen, um eine gerade Linie zwischen zwei Punkten zu zeichnen` |
| es | `Haga clic o arrastre para activar píxeles` | `Arrastre para dibujar una línea recta entre dos puntos` |
| fr | `Cliquez ou faites glisser pour définir des pixels` | `Faites glisser pour tracer une ligne droite entre deux points` |
| hu | `Kattintással vagy húzással állíthat be képpontokat` | `Húzással egyenes vonalat rajzolhat két pont között` |
| it | `Fare clic o trascinare per impostare i pixel` | `Trascinare per disegnare una linea retta tra due punti` |
| pl | `Kliknij lub przeciągnij, aby ustawić piksele` | `Przeciągnij, aby narysować linię prostą między dwoma punktami` |
| pt | `Clique ou arraste para definir pixels` | `Arraste para desenhar uma linha reta entre dois pontos` |
| ro | `Faceți clic sau trageți pentru a seta pixeli` | `Trageți pentru a desena o linie dreaptă între două puncte` |
| ru | `Щёлкните или перетащите, чтобы установить пиксели` | `Перетащите, чтобы провести прямую линию между двумя точками` |
| sk | `Kliknite alebo ťahajte na nastavenie pixelov` | `Ťahaním nakreslíte priamku medzi dvoma bodmi` |
| tr | `Pikselleri ayarlamak için tıklayın veya sürükleyin` | `İki nokta arasına düz bir çizgi çizmek için sürükleyin` |

- [ ] **Step 5: Add `Helpers.miniToolButton` to `js/utils/helpers.js`**

Insert immediately after `captionedButton` (after line 521, i.e. right before the `captionWrap` doc comment):

```js

    /**
     * One button in the small brush/eraser/line/fill toolset shared by the
     * Pattern Creator, Font Editor and Map Editor dialogs' CellGridEditor
     * surface. Previously hand-copied identically into all three with no
     * hover hint in any copy — this is the one source of truth now, so the
     * three dialogs cannot drift from each other again.
     * @param {string} tool         CellGridEditor tool id: 'brush'|'eraser'|'line'|'fill'
     * @param {string} letter       single-glyph icon shown on the button
     * @param {string} nameKey      i18n key for the button's name
     * @param {string} nameFallback English fallback for the name
     * @param {string} hintKey      i18n key for the "how it works" sentence
     * @param {string} hintFallback English fallback for the hint
     * @param {boolean} [active]    initial active state
     * @returns {string} HTML for the captioned button
     */
    miniToolButton(tool, letter, nameKey, nameFallback, hintKey, hintFallback, active = false) {
        const name = this.tr(nameKey, nameFallback);
        const hint = this.tr(hintKey, hintFallback);
        const title = this.composeTitle(name, hint);
        const cls = 'tool-btn' + (active ? ' active' : '');
        return `<span class="btn-captioned">${this.captionHTML(nameKey, nameFallback)}` +
            `<button type="button" data-tool="${tool}" class="${cls}" ` +
            `data-i18n-title-name="${nameKey}" data-i18n-title="${hintKey}" data-i18n-aria-label="${nameKey}" ` +
            `aria-label="${this.escapeHTML(name)}" title="${this.escapeHTML(title)}">` +
            `<span class="tool-icon">${letter}</span></button></span>`;
    },
```

- [ ] **Step 6: Replace the hand-copied markup in `js/ui/pattern-creator-panel.js`**

Replace lines 85-88:

```js
                    <span class="btn-captioned">${Helpers.captionHTML('tool.brush', 'Brush')}<button type="button" data-tool="brush"  class="tool-btn" data-i18n-title-name="tool.brush" data-i18n-aria-label="tool.brush" aria-label="${this._t('tool.brush', 'Brush')}" title="${this._t('tool.brush', 'Brush')}"><span class="tool-icon">B</span></button></span>
                    <span class="btn-captioned">${Helpers.captionHTML('tool.eraser', 'Eraser')}<button type="button" data-tool="eraser" class="tool-btn" data-i18n-title-name="tool.eraser" data-i18n-aria-label="tool.eraser" aria-label="${this._t('tool.eraser', 'Eraser')}" title="${this._t('tool.eraser', 'Eraser')}"><span class="tool-icon">E</span></button></span>
                    <span class="btn-captioned">${Helpers.captionHTML('shape.line', 'Line')}<button type="button" data-tool="line"   class="tool-btn" data-i18n-title-name="shape.line" data-i18n-aria-label="shape.line" aria-label="${this._t('shape.line', 'Line')}" title="${this._t('shape.line', 'Line')}"><span class="tool-icon">S</span></button></span>
                    <span class="btn-captioned">${Helpers.captionHTML('tool.fill', 'Fill')}<button type="button" data-tool="fill"   class="tool-btn" data-i18n-title-name="tool.fill" data-i18n-aria-label="tool.fill" aria-label="${this._t('tool.fill', 'Fill')}" title="${this._t('tool.fill', 'Fill')}"><span class="tool-icon">F</span></button></span>
```

with:

```js
                    ${Helpers.miniToolButton('brush', 'B', 'tool.brush', 'Brush', 'miniTool.brush.hint', 'Click or drag to set pixels')}
                    ${Helpers.miniToolButton('eraser', 'E', 'tool.eraser', 'Eraser', 'tool.eraser.hint', 'Clear pixels back to the paper colour')}
                    ${Helpers.miniToolButton('line', 'S', 'shape.line', 'Line', 'miniTool.line.hint', 'Drag to draw a straight line between two points')}
                    ${Helpers.miniToolButton('fill', 'F', 'tool.fill', 'Fill', 'tool.fill.hint', 'Flood the area under the cursor out to its edges')}
```

- [ ] **Step 7: Replace the hand-copied markup in `js/ui/components/font-editor-dialog.js`**

Replace lines 80-83 (note `brush` carries the `active` class here):

```js
                        <span class="btn-captioned">${Helpers.captionHTML('tool.brush', 'Brush')}<button type="button" data-tool="brush"  class="tool-btn active" data-i18n-title-name="tool.brush" data-i18n-aria-label="tool.brush" aria-label="${this._t('tool.brush', 'Brush')}" title="${this._t('tool.brush', 'Brush')}"><span class="tool-icon">B</span></button></span>
                        <span class="btn-captioned">${Helpers.captionHTML('tool.eraser', 'Eraser')}<button type="button" data-tool="eraser" class="tool-btn" data-i18n-title-name="tool.eraser" data-i18n-aria-label="tool.eraser" aria-label="${this._t('tool.eraser', 'Eraser')}" title="${this._t('tool.eraser', 'Eraser')}"><span class="tool-icon">E</span></button></span>
                        <span class="btn-captioned">${Helpers.captionHTML('shape.line', 'Line')}<button type="button" data-tool="line"   class="tool-btn" data-i18n-title-name="shape.line" data-i18n-aria-label="shape.line" aria-label="${this._t('shape.line', 'Line')}" title="${this._t('shape.line', 'Line')}"><span class="tool-icon">S</span></button></span>
                        <span class="btn-captioned">${Helpers.captionHTML('tool.fill', 'Fill')}<button type="button" data-tool="fill"   class="tool-btn" data-i18n-title-name="tool.fill" data-i18n-aria-label="tool.fill" aria-label="${this._t('tool.fill', 'Fill')}" title="${this._t('tool.fill', 'Fill')}"><span class="tool-icon">F</span></button></span>
```

with:

```js
                        ${Helpers.miniToolButton('brush', 'B', 'tool.brush', 'Brush', 'miniTool.brush.hint', 'Click or drag to set pixels', true)}
                        ${Helpers.miniToolButton('eraser', 'E', 'tool.eraser', 'Eraser', 'tool.eraser.hint', 'Clear pixels back to the paper colour')}
                        ${Helpers.miniToolButton('line', 'S', 'shape.line', 'Line', 'miniTool.line.hint', 'Drag to draw a straight line between two points')}
                        ${Helpers.miniToolButton('fill', 'F', 'tool.fill', 'Fill', 'tool.fill.hint', 'Flood the area under the cursor out to its edges')}
```

- [ ] **Step 8: Replace the hand-copied markup in `js/ui/components/map-editor-dialog.js`**

Replace lines 83-86 (note `brush` carries the `active` class here too):

```js
                    <span class="btn-captioned">${Helpers.captionHTML('tool.brush', 'Brush')}<button type="button" data-tool="brush"  class="tool-btn active" data-i18n-title-name="tool.brush" data-i18n-aria-label="tool.brush" aria-label="${this._t('tool.brush', 'Brush')}" title="${this._t('tool.brush', 'Brush')}"><span class="tool-icon">B</span></button></span>
                    <span class="btn-captioned">${Helpers.captionHTML('tool.eraser', 'Eraser')}<button type="button" data-tool="eraser" class="tool-btn" data-i18n-title-name="tool.eraser" data-i18n-aria-label="tool.eraser" aria-label="${this._t('tool.eraser', 'Eraser')}" title="${this._t('tool.eraser', 'Eraser')}"><span class="tool-icon">E</span></button></span>
                    <span class="btn-captioned">${Helpers.captionHTML('shape.line', 'Line')}<button type="button" data-tool="line"   class="tool-btn" data-i18n-title-name="shape.line" data-i18n-aria-label="shape.line" aria-label="${this._t('shape.line', 'Line')}" title="${this._t('shape.line', 'Line')}"><span class="tool-icon">S</span></button></span>
                    <span class="btn-captioned">${Helpers.captionHTML('tool.fill', 'Fill')}<button type="button" data-tool="fill"   class="tool-btn" data-i18n-title-name="tool.fill" data-i18n-aria-label="tool.fill" aria-label="${this._t('tool.fill', 'Fill')}" title="${this._t('tool.fill', 'Fill')}"><span class="tool-icon">F</span></button></span>
```

with:

```js
                    ${Helpers.miniToolButton('brush', 'B', 'tool.brush', 'Brush', 'miniTool.brush.hint', 'Click or drag to set pixels', true)}
                    ${Helpers.miniToolButton('eraser', 'E', 'tool.eraser', 'Eraser', 'tool.eraser.hint', 'Clear pixels back to the paper colour')}
                    ${Helpers.miniToolButton('line', 'S', 'shape.line', 'Line', 'miniTool.line.hint', 'Drag to draw a straight line between two points')}
                    ${Helpers.miniToolButton('fill', 'F', 'tool.fill', 'Fill', 'tool.fill.hint', 'Flood the area under the cursor out to its edges')}
```

- [ ] **Step 9: Run test to verify it passes**

Run: `npx playwright test tests/browser/mini-toolset.spec.js`
Expected: PASS for all three dialogs.

- [ ] **Step 10: Run the i18n parity, lint gates, and the full Node suite**

Run: `node tests/run-all.js`
Expected: `ALL TEST FILES PASSED`

- [ ] **Step 11: Commit**

```bash
git add js/utils/helpers.js js/ui/pattern-creator-panel.js js/ui/components/font-editor-dialog.js js/ui/components/map-editor-dialog.js js/i18n/*.js tests/browser/mini-toolset.spec.js
git commit -m "refactor: dedupe the Pattern Creator/Font Editor/Map Editor mini-toolset into Helpers.miniToolButton, with real hover hints"
```

---

### Task 5: Widen `tooltip.spec.js` beyond the tool rail

**Files:**
- Modify: `js/ui/tooltip-manager.js` (expose `SELECTOR` publicly)
- Modify: `tests/browser/tooltip.spec.js` (widen the existing "no description" test)

**Interfaces:**
- Consumes: nothing new.
- Produces: `window.Tooltip.SELECTOR` (string) — the same selector string `TooltipManager` already uses internally, now readable by tests instead of being re-hardcoded there (avoiding a second, driftable copy of the string).

- [ ] **Step 1: Expose `SELECTOR` on the `Tooltip` singleton**

In `js/ui/tooltip-manager.js`, find the line:

```js
window.Tooltip = new TooltipManagerClass();
```

Replace it with:

```js
window.Tooltip = new TooltipManagerClass();
window.Tooltip.SELECTOR = SELECTOR;
```

- [ ] **Step 2: Write the widened test**

In `tests/browser/tooltip.spec.js`, replace the existing test (lines 72-83):

```js
test('every rail control has a description that is not its own name', async ({ page }) => {
    await boot(page);
    const bad = await page.evaluate(() => {
        const out = [];
        for (const btn of document.querySelectorAll('#tool-rail .tool-btn')) {
            const { name, desc } = Helpers.splitTitle(btn.getAttribute('title') || '');
            if (!desc || desc === name) out.push(btn.getAttribute('aria-label') || name);
        }
        return out;
    });
    expect(bad).toEqual([]);
});
```

with:

```js
test('every rail control has a description that is not its own name', async ({ page }) => {
    await boot(page);
    const bad = await page.evaluate(() => {
        const out = [];
        for (const btn of document.querySelectorAll('#tool-rail .tool-btn')) {
            const { name, desc } = Helpers.splitTitle(btn.getAttribute('title') || '');
            if (!desc || desc === name) out.push(btn.getAttribute('aria-label') || name);
        }
        return out;
    });
    expect(bad).toEqual([]);
});

/*
 * The main-workspace areas already swept for real hints, generalized beyond
 * the rail's own test above. #tool-options-panel-content is deliberately
 * excluded: only the Shape Type row's "basic" category has real hints so
 * far (batch 1 of docs/superpowers/specs/2026-08-20-tooltip-coverage-design.md);
 * every other tool's icon-grid options are still name-only pending batch 2/3,
 * so including that panel here would make this test flaky against work not
 * yet done. Remove the exclusion once batch 2/3 finishes that panel.
 */
test('every two-stage control in the main workspace chrome has a real description', async ({ page }) => {
    await boot(page);
    const bad = await page.evaluate(() => {
        const out = [];
        const areas = ['#tool-rail', '#panels', '#zoom-controls', '.app-dialog-header'];
        const seen = new Set();
        for (const areaSelector of areas) {
            for (const area of document.querySelectorAll(areaSelector)) {
                for (const el of area.querySelectorAll(window.Tooltip.SELECTOR)) {
                    if (el.closest('#tool-options-panel-content')) continue;
                    if (seen.has(el)) continue;
                    seen.add(el);
                    const { name, desc } = Helpers.splitTitle(el.getAttribute('title') || '');
                    if (!desc || desc === name) {
                        out.push(el.getAttribute('aria-label') || name || el.className);
                    }
                }
            }
        }
        return out;
    });
    expect(bad).toEqual([]);
});
```

- [ ] **Step 3: Run test to verify it passes**

Run: `npx playwright test tests/browser/tooltip.spec.js`
Expected: all tests PASS, including the new one — Tasks 1, 2 and this session's earlier panel-header/collapse work already cover every control the new test's `areas` list reaches (`.app-dialog-header` matches nothing when no dialog is open, so it contributes zero elements at boot; this test only covers the always-in-DOM main workspace, not dialog contents — dialog coverage is verified per-dialog by Tasks 1 and 4's own tests, and completed as a whole in batch 3).

- [ ] **Step 4: Run the full Playwright suite and the Node suite**

Run: `npx playwright test`
Expected: all specs PASS (this is the point where any of Tasks 1-4's changes that broke something unrelated would surface).

Run: `node tests/run-all.js`
Expected: `ALL TEST FILES PASSED`

- [ ] **Step 5: Commit**

```bash
git add js/ui/tooltip-manager.js tests/browser/tooltip.spec.js
git commit -m "test: widen the tooltip-description check beyond the tool rail to the main workspace"
```

---

## Batch 1 exit check

After Task 5's commit, update `docs/superpowers/specs/2026-08-20-tooltip-coverage-design.md` §7: mark batch 1 done, and note in §9 (Open items) that the "as each tool is touched" leaning for `option-controls.js` schema hints was confirmed by Task 3's approach (mechanism + one real category, rest deferred). This keeps the spec's own execution record accurate for whoever writes batch 2's plan next — matching the project's `docs/CURRENT_STATE.md` convention of the living doc winning over static ones.
