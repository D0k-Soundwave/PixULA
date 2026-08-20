# Tooltip Coverage — Batch 2 (Main Workspace Sweep) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring every remaining always-in-DOM main-workspace control up to PixULA's two-stage hover-tooltip convention: the draw-mode bar, the grid/snap/mirror toggle group, touch-mode status, the zoom-level readout, the two gaps batch 1's own widened test discovered (`.panel-collapse`, `#merge-selected`), the Presets panel's list rows, the pattern library's thumbnails, and the Transform panel — then widen `tooltip.spec.js`'s sweep to cover all of it and drop the two exclusions batch 1 had to add.

**Architecture:** No new mechanism, same as batch 1. Every fix reuses `Helpers.composeTitle`/`Helpers.splitTitle` and `TooltipManager`'s `SELECTOR`-based two-stage hover (`js/ui/tooltip-manager.js`). Most of this batch turns out to be the same shape as batch 1's "systemic fixes" — controls that already carry a real, correctly-worded hint sentence as a flat native `title`, just not composed with a name via `Helpers.composeTitle` and not matched by `SELECTOR` — rather than fresh content authoring. Only the draw-mode bar, the three grid-size toggles, the two batch-1-discovered gaps, the pattern thumbnails, and the Transform panel need brand-new hint copy.

**Tech Stack:** Vanilla JS (IIFE singletons), native `<dialog>`, Playwright browser tests, `node tests/run-all.js` (lint + i18n parity).

**Spec:** `docs/superpowers/specs/2026-08-20-tooltip-coverage-design.md` (§7 item 2, as amended after batch 1 shipped)

## Global Constraints

- Every new/changed hint key gets natively translated into all 13 locale files (`js/i18n/*.js`) — no machine translation. `tests/i18n-parity.test.js` enforces identical key sets, non-empty values, and `{param}` placeholder consistency across all 13 files; it must pass after every task.
- `en.js` is the key-set source of truth.
- One sentence per hint. States what the control does / how it works. Never restates the visible name.
- Reuse an existing key when it is already accurate for the new context, rather than authoring a near-duplicate. This plan does so for `view.snap.hint`, `view.mirror.hint`, `status.touchToggleHint`, `toolPreset.loadHint`, `toolPreset.saveHint`, `toolPreset.nothingToSave`, `toolPreset.rename` and `toolPreset.delete` — all five already carry real, accurate sentences as flat native titles; the fix is composing them with a name, not rewriting them.
- `node tests/run-all.js` must pass after every task. The relevant Playwright spec(s) must pass after every task. Run the full Playwright suite before the final commit of the batch.
- No `EventBus.emit/on` with string literals, no inline hex colours, no `.onclick=` assignment, no DOM access outside the allowed layers — the existing `tests/lint-architecture.test.js` catches all of this; it is part of `node tests/run-all.js`.
- Follow the repo's commit convention: small, focused commits per task, no AI attribution, no emoji.
- Out of scope for this batch (per the spec's §7 batch assignment): Sprite Editor, Import, Save/Companion, Palette Editor, Preferences, Tape Block dialogs, Font/Map Editor dialogs, and `CellGridEditor`'s own chrome beyond the mini-toolset batch 1 already deduped — all of that is batch 3 ("Dialog sweep").
- Also out of scope, deliberately: the shared `Helpers.buildDirPad()` shift-direction buttons (`.dir-pad-zone`). They are used identically by both the Transform panel (shift the layer/selection) and the Reference panel (shift the reference image) from the exact same builder function — a single hint text would be right for one context and wrong for the other, and the builder has no parameter to vary it. Left with their existing `aria-label`-only state; a real fix needs either a parameter on `buildDirPad()` or two separate builders, which is a design decision for whoever picks this up, not a batch-2 task.

---

### Task 1: Draw-mode bar hints

**Files:**
- Modify: `js/ui/components/draw-mode-bar.js:87-96` (`_buildButton`)
- Modify: `js/i18n/en.js` + 12 other `js/i18n/*.js` files (new keys: `dm.normal.hint`, `dm.ink.hint`, `dm.paper.hint`, `dm.pixelsOnly.hint`, `dm.xor.hint`)
- Test: new `tests/browser/draw-mode-tooltip.spec.js`

**Interfaces:**
- Consumes: `Helpers.composeTitle` (existing, `js/utils/helpers.js`), `TooltipManager` (existing — the five draw-mode buttons already carry class `tool-btn`, already in `SELECTOR`, so no `SELECTOR` change is needed for this task).
- Produces: all five draw-mode bar buttons (Normal, Ink Recolour, Paper Recolour, Pixels Only, XOR/Over) now carry a real two-stage tooltip. No new public API.

**Semantics** (verified against `js/core/constants.js:445-475`'s `DRAW_MODE` definitions, so the hint copy below is accurate, not guessed):
- `NORMAL`: "set the pixel to ink, stamp the cell's ink/paper/bright/flash from the attribute bar"
- `INK`: "recolour ONLY the cell's ink attribute (+ flash), no pixels"
- `PAPER`: "recolour ONLY the cell's paper attribute (+ flash), no pixels"
- `PIXEL_ONLY`: "draw pixel bit, preserve all cell attributes"
- `XOR`: "toggle pixel bit (ArtStudio OVER)"

- [ ] **Step 1: Write the failing test**

Create `tests/browser/draw-mode-tooltip.spec.js`:

```js
'use strict';
/**
 * The five draw-mode bar buttons (js/ui/components/draw-mode-bar.js) carry a
 * real two-stage tooltip. Previously their title was just the mode's own
 * name, composed with an empty hint — Helpers.splitTitle returned desc==''.
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

test('every draw-mode bar button has a real two-stage tooltip', async ({ page }) => {
    await boot(page);
    const modes = ['normal', 'ink', 'paper', 'pixel_only', 'xor'];
    for (const mode of modes) {
        const btn = page.locator(`#draw-modes button[data-draw-mode="${mode}"]`);
        await expect(btn).toBeAttached();
        const title = await btn.getAttribute('title');
        const { name, desc } = await page.evaluate(
            (t) => Helpers.splitTitle(t), title);
        expect(name).toBeTruthy();
        expect(desc).toBeTruthy();
        expect(desc).not.toBe(name);
    }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test tests/browser/draw-mode-tooltip.spec.js`
Expected: FAIL — `desc` is empty for all five buttons today (`btn.title = name;` at draw-mode-bar.js:94, no hint).

- [ ] **Step 3: Add the five new keys to `js/i18n/en.js`**

Grep for the exact line `'dm.xor': 'XOR / Over',` in `js/i18n/en.js` (currently at line 238) and insert immediately after it:

```js
    'dm.normal.hint': 'Sets pixels and stamps the cell\'s ink, paper, bright and flash together',
    'dm.ink.hint': 'Repaints the ink colour and flash of the cell under the pointer, without touching any pixel',
    'dm.paper.hint': 'Repaints the paper colour and flash of the cell under the pointer, without touching any pixel',
    'dm.pixelsOnly.hint': 'Sets or clears pixels without touching that cell\'s ink, paper, bright or flash',
    'dm.xor.hint': 'Toggles each pixel it touches, so overlapping strokes cancel each other out',
```

- [ ] **Step 4: Add the same five keys, natively translated, to the other 12 locale files**

Grep each file for the line `'dm.xor': '<value>',` and insert the five keys immediately after it, translated per this table:

| Locale | `dm.normal.hint` | `dm.ink.hint` | `dm.paper.hint` | `dm.pixelsOnly.hint` | `dm.xor.hint` |
|---|---|---|---|---|---|
| cs | Nastaví pixely a zároveň otiskne inkoust, papír, jas a blikání buňky | Přebarví pouze barvu inkoustu a blikání buňky pod ukazatelem, bez zásahu do pixelů | Přebarví pouze barvu papíru a blikání buňky pod ukazatelem, bez zásahu do pixelů | Nastaví nebo vymaže pixely, aniž by se dotkl inkoustu, papíru, jasu nebo blikání buňky | Přepne každý dotčený pixel, takže se překrývající tahy navzájem ruší |
| de | Setzt Pixel und stempelt zugleich Tinte, Papier, Helligkeit und Blinken der Zelle | Färbt nur die Tintenfarbe und das Blinken der Zelle unter dem Zeiger neu, ohne Pixel zu berühren | Färbt nur die Papierfarbe und das Blinken der Zelle unter dem Zeiger neu, ohne Pixel zu berühren | Setzt oder löscht Pixel, ohne Tinte, Papier, Helligkeit oder Blinken der Zelle zu berühren | Kehrt jedes berührte Pixel um, sodass sich überlappende Striche gegenseitig aufheben |
| es | Activa píxeles y estampa a la vez la tinta, el papel, el brillo y el parpadeo de la celda | Vuelve a colorear solo la tinta y el parpadeo de la celda bajo el puntero, sin tocar ningún píxel | Vuelve a colorear solo el papel y el parpadeo de la celda bajo el puntero, sin tocar ningún píxel | Activa o desactiva píxeles sin tocar la tinta, el papel, el brillo ni el parpadeo de esa celda | Invierte cada píxel que toca, de modo que los trazos superpuestos se anulan entre sí |
| fr | Définit les pixels et estampe en même temps l'encre, le papier, l'éclat et le clignotement de la cellule | Recolore uniquement l'encre et le clignotement de la cellule sous le pointeur, sans toucher aux pixels | Recolore uniquement le papier et le clignotement de la cellule sous le pointeur, sans toucher aux pixels | Définit ou efface des pixels sans toucher à l'encre, au papier, à l'éclat ni au clignotement de la cellule | Inverse chaque pixel touché, de sorte que les traits superposés s'annulent mutuellement |
| hu | Beállítja a pixeleket, és egyszerre lenyomtatja a cella tintáját, papírját, fényét és villogását | Csak a mutató alatti cella tintaszínét és villogását festi újra, a pixelek érintése nélkül | Csak a mutató alatti cella papírszínét és villogását festi újra, a pixelek érintése nélkül | Pixeleket állít be vagy töröl a cella tintája, papírja, fénye vagy villogása érintése nélkül | Megfordítja minden érintett pixelt, így az átfedő húzások kioltják egymást |
| it | Imposta i pixel e allo stesso tempo timbra inchiostro, carta, luminosità e lampeggio della cella | Ricolora solo l'inchiostro e il lampeggio della cella sotto il puntatore, senza toccare alcun pixel | Ricolora solo la carta e il lampeggio della cella sotto il puntatore, senza toccare alcun pixel | Imposta o cancella i pixel senza toccare inchiostro, carta, luminosità o lampeggio di quella cella | Inverte ogni pixel toccato, così i tratti sovrapposti si annullano a vicenda |
| pl | Ustawia piksele i jednocześnie odciska atrament, papier, jasność i miganie komórki | Przemalowuje tylko kolor atramentu i miganie komórki pod wskaźnikiem, nie dotykając pikseli | Przemalowuje tylko kolor papieru i miganie komórki pod wskaźnikiem, nie dotykając pikseli | Ustawia lub czyści piksele, nie dotykając atramentu, papieru, jasności ani migania tej komórki | Odwraca każdy dotknięty piksel, więc nakładające się pociągnięcia znoszą się nawzajem |
| pt | Define pixels e carimba ao mesmo tempo a tinta, o papel, o brilho e o piscar da célula | Volta a colorir apenas a tinta e o piscar da célula sob o ponteiro, sem tocar em nenhum pixel | Volta a colorir apenas o papel e o piscar da célula sob o ponteiro, sem tocar em nenhum pixel | Define ou limpa pixels sem tocar na tinta, no papel, no brilho ou no piscar dessa célula | Inverte cada pixel tocado, de modo que traços sobrepostos se anulam mutuamente |
| ro | Setează pixelii și, în același timp, imprimă cerneala, hârtia, luminozitatea și clipirea celulei | Recolorează doar cerneala și clipirea celulei de sub cursor, fără a atinge niciun pixel | Recolorează doar hârtia și clipirea celulei de sub cursor, fără a atinge niciun pixel | Setează sau șterge pixeli fără a atinge cerneala, hârtia, luminozitatea sau clipirea acelei celule | Inversează fiecare pixel atins, astfel încât trăsăturile suprapuse se anulează reciproc |
| ru | Устанавливает пиксели и одновременно проставляет чернила, бумагу, яркость и мерцание ячейки | Перекрашивает только цвет чернил и мерцание ячейки под указателем, не затрагивая пиксели | Перекрашивает только цвет бумаги и мерцание ячейки под указателем, не затрагивая пиксели | Устанавливает или очищает пиксели, не затрагивая чернила, бумагу, яркость или мерцание этой ячейки | Инвертирует каждый затронутый пиксель, поэтому перекрывающиеся мазки взаимно гасят друг друга |
| sk | Nastaví pixely a zároveň odtlačí atrament, papier, jas a blikanie bunky | Prefarbí iba farbu atramentu a blikanie bunky pod ukazovateľom, bez zásahu do pixelov | Prefarbí iba farbu papiera a blikanie bunky pod ukazovateľom, bez zásahu do pixelov | Nastaví alebo vymaže pixely bez zásahu do atramentu, papiera, jasu alebo blikania danej bunky | Prepne každý dotknutý pixel, takže sa prekrývajúce sa ťahy navzájom rušia |
| tr | Pikselleri ayarlar ve aynı anda hücrenin mürekkebini, kağıdını, parlaklığını ve yanıp sönmesini basar | Yalnızca işaretçinin altındaki hücrenin mürekkep rengini ve yanıp sönmesini, hiçbir piksele dokunmadan yeniden boyar | Yalnızca işaretçinin altındaki hücrenin kağıt rengini ve yanıp sönmesini, hiçbir piksele dokunmadan yeniden boyar | Bu hücrenin mürekkebine, kağıdına, parlaklığına veya yanıp sönmesine dokunmadan pikselleri ayarlar veya temizler | Dokunduğu her pikseli tersine çevirir, böylece üst üste binen vuruşlar birbirini götürür |

- [ ] **Step 5: Wire the composed titles in `js/ui/components/draw-mode-bar.js`**

Replace lines 86-96 (`_buildButton`):

```js
    /** @private */
    _buildButton(value, icon, i18n, fallback, capKey, capFallback) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'tool-btn';
        btn.dataset.drawMode = value;
        const name = this._t(i18n, fallback);
        btn.dataset.i18nTitleName = i18n;
        btn.title = name;
        btn.dataset.i18nAriaLabel = i18n;
        btn.setAttribute('aria-label', name);
```

with:

```js
    /** @private */
    _buildButton(value, icon, i18n, fallback, capKey, capFallback, hintKey, hintFallback) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'tool-btn';
        btn.dataset.drawMode = value;
        const name = this._t(i18n, fallback);
        btn.dataset.i18nTitleName = i18n;
        btn.dataset.i18nTitle = hintKey;
        btn.title = Helpers.composeTitle(name, this._t(hintKey, hintFallback));
        btn.dataset.i18nAriaLabel = i18n;
        btn.setAttribute('aria-label', name);
```

Then replace the `MODES` array at lines 25-31 to carry each hint key/fallback pair, and the `init()` loop that spreads it:

```js
const MODES = [
    ['normal',          'icon-dm-normal',     'dm.normal',         'Normal',          'dm.normal',      'Normal',
     'dm.normal.hint', 'Sets pixels and stamps the cell\'s ink, paper, bright and flash together'],
    ['ink',             'icon-dm-ink',        'dm.ink',            'Ink Recolour',    'cap.dmInk',      'Ink RC',
     'dm.ink.hint', 'Repaints the ink colour and flash of the cell under the pointer, without touching any pixel'],
    ['paper',           'icon-dm-paper',      'dm.paper',          'Paper Recolour',  'cap.dmPaper',    'Paper RC',
     'dm.paper.hint', 'Repaints the paper colour and flash of the cell under the pointer, without touching any pixel'],
    ['pixel_only',      'icon-dm-pixels',     'dm.pixelsOnly',     'Pixels Only',     'cap.pixels',     'Pixels',
     'dm.pixelsOnly.hint', 'Sets or clears pixels without touching that cell\'s ink, paper, bright or flash'],
    ['xor',             'icon-dm-xor',        'dm.xor',            'XOR / Over',      'cap.xor',        'XOR',
     'dm.xor.hint', 'Toggles each pixel it touches, so overlapping strokes cancel each other out']
];
```

`for (const mode of MODES) { this._host.appendChild(this._buildButton(...mode)); }` at line 60 already spreads the array, so it picks up the two new trailing elements with no further change.

- [ ] **Step 6: Run test to verify it passes**

Run: `npx playwright test tests/browser/draw-mode-tooltip.spec.js`
Expected: PASS

- [ ] **Step 7: Run the i18n parity and lint gates**

Run: `node tests/run-all.js`
Expected: `ALL TEST FILES PASSED`

- [ ] **Step 8: Commit**

```bash
git add js/ui/components/draw-mode-bar.js js/i18n/*.js tests/browser/draw-mode-tooltip.spec.js
git commit -m "feat: give the draw-mode bar's five buttons real hover hints"
```

---

### Task 2: Grid, snap and mirror toggle hints

**Files:**
- Modify: `js/ui/components/canvas-controls.js:174-303` (`_buildGridControls`, snap toggle, `_buildSymmetryControls`)
- Modify: `js/ui/tooltip-manager.js:36` (`SELECTOR`)
- Modify: `js/i18n/en.js` + 12 other `js/i18n/*.js` files (new keys: `grid.pixelGrid`, `grid.pixelGrid.hint`, `grid.cellGrid`, `grid.cellGrid.hint`, `grid.blockGrid`, `grid.blockGrid.hint`)
- Test: new `tests/browser/grid-toggle-tooltip.spec.js`

**Interfaces:**
- Consumes: `Helpers.composeTitle`, `TooltipManager`. The snap toggle and the three mirror buttons already carry a real, correct hint sentence (`view.snap.hint`, `view.mirror.hint`) as a flat native `title` — no new content needed for those four, only the SELECTOR + composeTitle wiring. The three grid-size toggles (`grid-1x1-toggle`, `grid-8x8-toggle`, `grid-16x16-toggle`) currently have no title at all (their visible text IS their size label, e.g. "8x8") — these need brand-new name + hint content.
- Produces: `.grid-toggle` added to `SELECTOR`, covering all seven buttons in the grid-controls area (3 grid-size toggles + snap toggle + 3 mirror toggles) in one change.

- [ ] **Step 1: Write the failing test**

Create `tests/browser/grid-toggle-tooltip.spec.js`:

```js
'use strict';
/**
 * The grid-size, snap and mirror toggle buttons (js/ui/components/
 * canvas-controls.js) all carry real two-stage tooltips. The snap and
 * mirror buttons already had a real hint sentence as a flat title; the
 * grid-size buttons had none at all.
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

test('grid, snap and mirror toggle buttons have real two-stage tooltips', async ({ page }) => {
    await boot(page);
    const ids = [
        'grid-1x1-toggle', 'grid-8x8-toggle', 'grid-16x16-toggle',
        'grid-snap-toggle',
        'symmetry-h-toggle', 'symmetry-v-toggle', 'symmetry-quad-toggle'
    ];
    for (const id of ids) {
        const btn = page.locator(`#${id}`);
        await expect(btn).toBeAttached();
        const title = await btn.getAttribute('title');
        const { name, desc } = await page.evaluate(
            (t) => Helpers.splitTitle(t), title);
        expect(name).toBeTruthy();
        expect(desc).toBeTruthy();
        expect(desc).not.toBe(name);
    }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test tests/browser/grid-toggle-tooltip.spec.js`
Expected: FAIL — none of the seven buttons match `TooltipManager`'s `SELECTOR` today (`.grid-toggle` is not in it), so `title` is read directly rather than via the two-stage mechanism; the three grid-size buttons also have no `title` at all.

- [ ] **Step 3: Add the six new keys to `js/i18n/en.js`**

Grep for the exact line `'view.grid': 'Grid',` in `js/i18n/en.js` and insert immediately after it:

```js
    'grid.pixelGrid': 'Pixel grid',
    'grid.pixelGrid.hint': 'Shows a line around every individual pixel',
    'grid.cellGrid': 'Cell grid',
    'grid.cellGrid.hint': 'Shows a line around every attribute cell, the unit ink and paper are shared across',
    'grid.blockGrid': 'Block grid',
    'grid.blockGrid.hint': 'Shows a line around every 16x16 pixel block',
```

- [ ] **Step 4: Add the same six keys, natively translated, to the other 12 locale files**

Grep each file for the line `'view.grid': '<value>',` and insert the six keys immediately after it, translated per this table:

| Locale | `grid.pixelGrid` | `grid.pixelGrid.hint` | `grid.cellGrid` | `grid.cellGrid.hint` | `grid.blockGrid` | `grid.blockGrid.hint` |
|---|---|---|---|---|---|---|
| cs | Pixelová mřížka | Zobrazí čáru kolem každého jednotlivého pixelu | Buňková mřížka | Zobrazí čáru kolem každé atributové buňky, jednotky sdílející inkoust a papír | Bloková mřížka | Zobrazí čáru kolem každého bloku 16x16 pixelů |
| de | Pixelraster | Zeigt eine Linie um jedes einzelne Pixel | Zellraster | Zeigt eine Linie um jede Attributzelle, die Einheit, die sich Tinte und Papier teilt | Blockraster | Zeigt eine Linie um jeden 16x16-Pixel-Block |
| es | Cuadrícula de píxeles | Muestra una línea alrededor de cada píxel individual | Cuadrícula de celdas | Muestra una línea alrededor de cada celda de atributos, la unidad que comparte tinta y papel | Cuadrícula de bloques | Muestra una línea alrededor de cada bloque de 16x16 píxeles |
| fr | Grille de pixels | Affiche une ligne autour de chaque pixel individuel | Grille de cellules | Affiche une ligne autour de chaque cellule d'attributs, l'unité qui partage l'encre et le papier | Grille de blocs | Affiche une ligne autour de chaque bloc de 16x16 pixels |
| hu | Pixelrács | Vonalat jelenít meg minden egyes képpont körül | Cellarács | Vonalat jelenít meg minden attribútumcella körül, az egység, amely megosztja a tintát és a papírt | Blokkrács | Vonalat jelenít meg minden 16x16 képpontos blokk körül |
| it | Griglia dei pixel | Mostra una linea attorno a ogni singolo pixel | Griglia delle celle | Mostra una linea attorno a ogni cella di attributi, l'unità che condivide inchiostro e carta | Griglia dei blocchi | Mostra una linea attorno a ogni blocco di 16x16 pixel |
| pl | Siatka pikseli | Pokazuje linię wokół każdego pojedynczego piksela | Siatka komórek | Pokazuje linię wokół każdej komórki atrybutów, jednostki współdzielącej atrament i papier | Siatka bloków | Pokazuje linię wokół każdego bloku 16x16 pikseli |
| pt | Grelha de pixels | Mostra uma linha à volta de cada pixel individual | Grelha de células | Mostra uma linha à volta de cada célula de atributos, a unidade que partilha tinta e papel | Grelha de blocos | Mostra uma linha à volta de cada bloco de 16x16 pixels |
| ro | Grilă de pixeli | Afișează o linie în jurul fiecărui pixel individual | Grilă de celule | Afișează o linie în jurul fiecărei celule de atribute, unitatea care partajează cerneala și hârtia | Grilă de blocuri | Afișează o linie în jurul fiecărui bloc de 16x16 pixeli |
| ru | Пиксельная сетка | Показывает линию вокруг каждого отдельного пикселя | Сетка ячеек | Показывает линию вокруг каждой атрибутной ячейки, единицы, разделяющей чернила и бумагу | Блочная сетка | Показывает линию вокруг каждого блока 16x16 пикселей |
| sk | Pixelová mriežka | Zobrazí čiaru okolo každého jednotlivého pixelu | Bunková mriežka | Zobrazí čiaru okolo každej atribútovej bunky, jednotky zdieľajúcej atrament a papier | Bloková mriežka | Zobrazí čiaru okolo každého bloku 16x16 pixelov |
| tr | Piksel ızgarası | Her bir pikselin etrafında bir çizgi gösterir | Hücre ızgarası | Mürekkep ve kağıdı paylaşan birim olan her öznitelik hücresinin etrafında bir çizgi gösterir | Blok ızgarası | Her 16x16 piksellik bloğun etrafında bir çizgi gösterir |

- [ ] **Step 5: Add `.grid-toggle` to `TooltipManager`'s `SELECTOR`**

In `js/ui/tooltip-manager.js:36`, grep for the current line (`const SELECTOR = `) and append `, .grid-toggle` to whatever it currently reads (after batch 1, this is `.tool-btn, .panel-collapse, .layer-ctrl-btn, .panel-header, .app-dialog-close, #zoom-out, #zoom-in, #zoom-fit` — verify by grep rather than assuming, the same discipline batch 1 used).

- [ ] **Step 6: Wire the grid-size toggle titles in `canvas-controls.js`**

Replace lines 192-197 (the `defs` array in `_buildGridControls`):

```js
        const defs = [
            { id: 'grid-1x1-toggle',   label: () => '1x1',   key: 'pixel', toggle: () => GridOverlay.togglePixelGrid() },
            { id: 'grid-8x8-toggle',   label: () => `${ZX_SPECTRUM.CELL_WIDTH}x${ZX_SPECTRUM.CELL_HEIGHT}`,
              key: 'cell',  toggle: () => GridOverlay.toggleCellGrid() },
            { id: 'grid-16x16-toggle', label: () => '16x16', key: 'block', toggle: () => GridOverlay.toggleBlockGrid() }
        ];
```

with:

```js
        const defs = [
            { id: 'grid-1x1-toggle',   label: () => '1x1',   key: 'pixel', toggle: () => GridOverlay.togglePixelGrid(),
              i18n: 'grid.pixelGrid', hint: 'grid.pixelGrid.hint' },
            { id: 'grid-8x8-toggle',   label: () => `${ZX_SPECTRUM.CELL_WIDTH}x${ZX_SPECTRUM.CELL_HEIGHT}`,
              key: 'cell',  toggle: () => GridOverlay.toggleCellGrid(),
              i18n: 'grid.cellGrid', hint: 'grid.cellGrid.hint' },
            { id: 'grid-16x16-toggle', label: () => '16x16', key: 'block', toggle: () => GridOverlay.toggleBlockGrid(),
              i18n: 'grid.blockGrid', hint: 'grid.blockGrid.hint' }
        ];
```

Replace lines 199-209 (the build loop):

```js
        for (const def of defs) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.id = def.id;
            btn.className = 'grid-toggle';
            btn.setAttribute('aria-pressed', 'false');
            btn.textContent = def.label();
            btn.addEventListener('click', def.toggle);
            host.appendChild(btn);
            this._gridButtons[def.key] = btn;
        }
```

with:

```js
        for (const def of defs) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.id = def.id;
            btn.className = 'grid-toggle';
            btn.dataset.i18nTitleName = def.i18n;
            btn.dataset.i18nTitle = def.hint;
            btn.title = Helpers.composeTitle(this._t(def.i18n, def.id), this._t(def.hint, ''));
            btn.setAttribute('aria-pressed', 'false');
            btn.textContent = def.label();
            btn.addEventListener('click', def.toggle);
            host.appendChild(btn);
            this._gridButtons[def.key] = btn;
        }
```

(The mode-relabel handler at lines 211-216 only rewrites `textContent`, so the title survives a screen-mode switch untouched — correct, since the grid-size buttons' NAME describes what kind of grid it is, not the current geometry number, which already lives in the visible label.)

- [ ] **Step 7: Wire the snap toggle's title**

Replace lines 226-234:

```js
        const snapBtn = document.createElement('button');
        snapBtn.type = 'button';
        snapBtn.id = 'grid-snap-toggle';
        snapBtn.className = 'grid-toggle';
        snapBtn.dataset.i18n = 'view.snap';
        snapBtn.dataset.i18nTitle = 'view.snap.hint';
        snapBtn.title = this._t('view.snap.hint', 'Snap selection, shape and paste placement to the attribute grid (Shift+S)');
        snapBtn.textContent = this._t('view.snap', 'Snap');
```

with:

```js
        const snapBtn = document.createElement('button');
        snapBtn.type = 'button';
        snapBtn.id = 'grid-snap-toggle';
        snapBtn.className = 'grid-toggle';
        snapBtn.dataset.i18n = 'view.snap';
        snapBtn.dataset.i18nTitleName = 'view.snap';
        snapBtn.dataset.i18nTitle = 'view.snap.hint';
        snapBtn.title = Helpers.composeTitle(
            this._t('view.snap', 'Snap'),
            this._t('view.snap.hint', 'Snap selection, shape and paste placement to the attribute grid (Shift+S)')
        );
        snapBtn.textContent = this._t('view.snap', 'Snap');
```

- [ ] **Step 8: Wire the three mirror toggle titles**

Replace lines 276-285 (inside `_buildSymmetryControls`'s loop):

```js
        for (const def of defs) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.id = `symmetry-${def.mode}-toggle`;
            btn.className = 'grid-toggle';
            btn.dataset.i18n = def.i18n;
            btn.dataset.i18nTitle = 'view.mirror.hint';
            btn.title = this._t('view.mirror.hint',
                'Mirror drawing across the canvas centre — every tool draws on both sides');
            btn.textContent = this._t(def.i18n, def.fallback);
```

with:

```js
        for (const def of defs) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.id = `symmetry-${def.mode}-toggle`;
            btn.className = 'grid-toggle';
            btn.dataset.i18n = def.i18n;
            btn.dataset.i18nTitleName = def.i18n;
            btn.dataset.i18nTitle = 'view.mirror.hint';
            btn.title = Helpers.composeTitle(
                this._t(def.i18n, def.fallback),
                this._t('view.mirror.hint', 'Mirror drawing across the canvas centre — every tool draws on both sides')
            );
            btn.textContent = this._t(def.i18n, def.fallback);
```

- [ ] **Step 9: Run test to verify it passes**

Run: `npx playwright test tests/browser/grid-toggle-tooltip.spec.js`
Expected: PASS

- [ ] **Step 10: Run the i18n parity and lint gates**

Run: `node tests/run-all.js`
Expected: `ALL TEST FILES PASSED`

- [ ] **Step 11: Commit**

```bash
git add js/ui/components/canvas-controls.js js/ui/tooltip-manager.js js/i18n/*.js tests/browser/grid-toggle-tooltip.spec.js
git commit -m "feat: give the grid, snap and mirror toggle buttons real hover hints"
```

---

### Task 3: Touch-mode status and zoom-level readout hints

**Files:**
- Modify: `js/ui/components/touch-mode-status.js:93-105` (`_render`)
- Modify: `js/ui/components/canvas-controls.js:106-110` (`_buildZoomControls`, the `#zoom-level` select)
- Modify: `js/ui/tooltip-manager.js:36` (`SELECTOR`)
- Modify: `js/i18n/en.js` + 12 other `js/i18n/*.js` files (new key: `view.zoomLevel.hint`)
- Test: new `tests/browser/status-bar-tooltip.spec.js`

**Interfaces:**
- Consumes: `Helpers.composeTitle`, `TooltipManager`. Touch-mode status already carries a real, correct hint sentence (`status.touchToggleHint`) as a flat native `title` — no new content needed, only SELECTOR + composeTitle wiring, using the element's own live `describeMode()` text as the name. The zoom-level `<select>` has no title at all today — needs one new key.
- Produces: `#touch-mode-status` and `#zoom-level` added to `SELECTOR`.

- [ ] **Step 1: Write the failing test**

Create `tests/browser/status-bar-tooltip.spec.js`:

```js
'use strict';
/**
 * The touch-mode status button and the zoom-level select (status bar area)
 * carry real two-stage tooltips. Touch-mode status already had a real hint
 * as a flat title; the zoom-level select had no title at all.
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

test('touch-mode status and zoom-level select have real two-stage tooltips', async ({ page }) => {
    await boot(page);
    for (const id of ['touch-mode-status', 'zoom-level']) {
        const el = page.locator(`#${id}`);
        await expect(el).toBeAttached();
        const title = await el.getAttribute('title');
        const { name, desc } = await page.evaluate(
            (t) => Helpers.splitTitle(t), title);
        expect(name).toBeTruthy();
        expect(desc).toBeTruthy();
        expect(desc).not.toBe(name);
    }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test tests/browser/status-bar-tooltip.spec.js`
Expected: FAIL — neither id matches `SELECTOR` today; `#zoom-level` has no `title` attribute at all.

- [ ] **Step 3: Add the one new key to `js/i18n/en.js`**

Grep for the exact line `'view.zoomLevel': 'Zoom level',` in `js/i18n/en.js` and insert immediately after it:

```js
    'view.zoomLevel.hint': 'Jumps straight to a specific zoom percentage',
```

- [ ] **Step 4: Add the same key, natively translated, to the other 12 locale files**

Grep each file for the line `'view.zoomLevel': '<value>',` and insert the key immediately after it, translated per this table:

| Locale | `view.zoomLevel.hint` |
|---|---|
| cs | Přejde přímo na konkrétní procento přiblížení |
| de | Springt direkt zu einer bestimmten Zoomstufe in Prozent |
| es | Salta directamente a un porcentaje de zoom concreto |
| fr | Passe directement à un pourcentage de zoom précis |
| hu | Egyenesen egy adott nagyítási százalékra ugrik |
| it | Passa direttamente a una percentuale di zoom specifica |
| pl | Przechodzi bezpośrednio do konkretnego procentu powiększenia |
| pt | Salta diretamente para uma percentagem de zoom específica |
| ro | Sare direct la un anumit procent de zoom |
| ru | Сразу переходит к заданному проценту масштаба |
| sk | Prejde priamo na konkrétne percento priblíženia |
| tr | Doğrudan belirli bir yakınlaştırma yüzdesine atlar |

- [ ] **Step 5: Add `#touch-mode-status` and `#zoom-level` to `TooltipManager`'s `SELECTOR`**

In `js/ui/tooltip-manager.js:36`, grep for the current line and append `, #touch-mode-status, #zoom-level` to whatever it currently reads (builds on Task 2's `.grid-toggle` addition).

- [ ] **Step 6: Wire the touch-mode status title**

In `js/ui/components/touch-mode-status.js`, replace lines 100-103 (inside `_render`):

```js
        this._el.textContent = this.describeMode(on ? 'draws' : 'nav');
        this._el.title = this._t('status.touchToggleHint',
            'Whether a finger draws on the canvas. Pan, pinch and long-press work either way.');
        this._el.dataset.i18nTitle = 'status.touchToggleHint';
```

with:

```js
        const label = this.describeMode(on ? 'draws' : 'nav');
        this._el.textContent = label;
        this._el.dataset.i18nTitleName = on ? 'status.touchDraws' : 'status.touchNav';
        this._el.dataset.i18nTitle = 'status.touchToggleHint';
        this._el.title = Helpers.composeTitle(label,
            this._t('status.touchToggleHint',
                'Whether a finger draws on the canvas. Pan, pinch and long-press work either way.'));
```

(`status.touchDraws`/`status.touchNav` already exist — `describeMode()` at line 111-115 already reads them — so `dataset.i18nTitleName` just points I18n's locale-switch recompose at the same key the visible label already uses, keeping the two in lockstep for free.)

- [ ] **Step 7: Wire the zoom-level select's title**

In `js/ui/components/canvas-controls.js`, replace lines 106-110 (inside `_buildZoomControls`):

```js
        const select = document.createElement('select');
        select.id = 'zoom-level';
        select.name = 'zoom-level';
        select.dataset.i18nAriaLabel = 'view.zoomLevel';
        select.setAttribute('aria-label', this._t('view.zoomLevel', 'Zoom level'));
```

with:

```js
        const select = document.createElement('select');
        select.id = 'zoom-level';
        select.name = 'zoom-level';
        select.dataset.i18nAriaLabel = 'view.zoomLevel';
        select.dataset.i18nTitleName = 'view.zoomLevel';
        select.dataset.i18nTitle = 'view.zoomLevel.hint';
        select.setAttribute('aria-label', this._t('view.zoomLevel', 'Zoom level'));
        select.title = Helpers.composeTitle(
            this._t('view.zoomLevel', 'Zoom level'),
            this._t('view.zoomLevel.hint', 'Jumps straight to a specific zoom percentage')
        );
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npx playwright test tests/browser/status-bar-tooltip.spec.js`
Expected: PASS

- [ ] **Step 9: Run the i18n parity and lint gates**

Run: `node tests/run-all.js`
Expected: `ALL TEST FILES PASSED`

- [ ] **Step 10: Commit**

```bash
git add js/ui/components/touch-mode-status.js js/ui/components/canvas-controls.js js/ui/tooltip-manager.js js/i18n/*.js tests/browser/status-bar-tooltip.spec.js
git commit -m "feat: give touch-mode status and the zoom-level select real hover hints"
```

---

### Task 4: Fix the two gaps batch 1's own widened test discovered

**Files:**
- Modify: `index.html:338` (the `#tpl-panel` template's `.panel-collapse` button)
- Modify: `js/ui/components/layer-panel.js:113` (`#merge-selected`)
- Modify: `js/i18n/en.js` + 12 other `js/i18n/*.js` files (new keys: `panel.collapseExpand.hint`, `layer.mergeSelected.hint`)
- Modify: `tests/browser/tooltip.spec.js` (drop the exclusion these two controls needed)
- Test: extend the existing widened test in `tooltip.spec.js`

**Interfaces:**
- Consumes: `Helpers.composeTitle`, `TooltipManager` (`.panel-collapse` and `.layer-ctrl-btn` are already in `SELECTOR` — no `SELECTOR` change needed for this task).
- Produces: every sidebar panel's collapse/expand button and the Layers panel's Merge button now carry real two-stage tooltips. Removes the `.panel-collapse`/`#merge-selected` exclusion batch 1's task 5 added to `tests/browser/tooltip.spec.js`'s widened sweep, since the gap it was there to paper over is now fixed.

- [ ] **Step 1: Write the failing test**

In `tests/browser/tooltip.spec.js`, the existing `'every two-stage control in the main workspace chrome has a real description'` test currently excludes `.panel-collapse` and `#merge-selected` (added by batch 1's Task 5 — grep for `KNOWN GAP` in that file to find the exact block). For this task, temporarily verify the underlying fix works with a standalone check before touching that exclusion (Step 8 removes it once both fixes land):

Create `tests/browser/panel-collapse-tooltip.spec.js`:

```js
'use strict';
/**
 * .panel-collapse (every sidebar panel's collapse/expand header button) and
 * #merge-selected (the Layers panel's Merge button) both matched
 * TooltipManager's SELECTOR already, but neither had a real two-stage title
 * — .panel-collapse's title was name-only, #merge-selected's was hint-only.
 * Found by batch 1's own widened sweep and excluded there pending this fix.
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

test('panel-collapse buttons have real two-stage tooltips', async ({ page }) => {
    await boot(page);
    const btn = page.locator('.panel-collapse').first();
    await expect(btn).toBeAttached();
    const title = await btn.getAttribute('title');
    const { name, desc } = await page.evaluate(
        (t) => Helpers.splitTitle(t), title);
    expect(name).toBeTruthy();
    expect(desc).toBeTruthy();
    expect(desc).not.toBe(name);
});

test('the Merge button has a real two-stage tooltip', async ({ page }) => {
    await boot(page);
    const btn = page.locator('#merge-selected');
    await expect(btn).toBeAttached();
    const title = await btn.getAttribute('title');
    const { name, desc } = await page.evaluate(
        (t) => Helpers.splitTitle(t), title);
    expect(name).toBeTruthy();
    expect(desc).toBeTruthy();
    expect(desc).not.toBe(name);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test tests/browser/panel-collapse-tooltip.spec.js`
Expected: FAIL — `.panel-collapse`'s title is `"Collapse/expand"` name-only (no hint composed in); `#merge-selected`'s title is the raw hint text with no name composed in (and the key it reads, `layer.mergeSelected.hint`, does not exist in `en.js` at all today — the code falls back to its hardcoded English fallback string on every locale).

- [ ] **Step 3: Add the two new keys to `js/i18n/en.js`**

Grep for the exact line `'panel.reorderHint': 'Right-click to move this panel up or down',` in `js/i18n/en.js` and insert immediately after it:

```js
    'panel.collapseExpand.hint': 'Collapses this panel to its title bar, or expands it back',
```

Grep for the exact line `'layer.mergeSelected': 'Merge',` in `js/i18n/en.js` and insert immediately after it:

```js
    'layer.mergeSelected.hint': 'Merges every selected layer down into the one below it',
```

- [ ] **Step 4: Add the same two keys, natively translated, to the other 12 locale files**

Grep each file for `'panel.reorderHint': '<value>',` and insert `panel.collapseExpand.hint` immediately after; grep each file for `'layer.mergeSelected': '<value>',` and insert `layer.mergeSelected.hint` immediately after — per this table:

| Locale | `panel.collapseExpand.hint` | `layer.mergeSelected.hint` |
|---|---|---|
| cs | Sbalí tento panel na záhlaví, nebo jej znovu rozbalí | Sloučí všechny vybrané vrstvy dolů do vrstvy pod nimi |
| de | Klappt dieses Panel auf die Titelleiste zusammen oder wieder auf | Führt alle ausgewählten Ebenen mit der darunterliegenden zusammen |
| es | Contrae este panel a su barra de título, o lo vuelve a expandir | Combina todas las capas seleccionadas con la que está debajo |
| fr | Réduit ce panneau à sa barre de titre, ou le développe à nouveau | Fusionne tous les calques sélectionnés avec celui du dessous |
| hu | Erre a panelra összecsukja a címsorra, vagy visszaállítja kinyitva | Az összes kijelölt réteget egyesíti az alattuk lévővel |
| it | Riduce questo pannello alla sua barra del titolo, o lo riespande | Unisce tutti i livelli selezionati con quello sottostante |
| pl | Zwija ten panel do paska tytułu lub rozwija go z powrotem | Scala wszystkie zaznaczone warstwy w dół, z warstwą pod nimi |
| pt | Recolhe este painel para a sua barra de título, ou expande-o de novo | Funde todas as camadas selecionadas com a que está por baixo |
| ro | Restrânge acest panou la bara de titlu, sau îl extinde din nou | Combină toate straturile selectate cu cel de dedesubt |
| ru | Сворачивает эту панель до строки заголовка или снова разворачивает | Объединяет все выбранные слои с расположенным под ними |
| sk | Zbalí tento panel na záhlavie, alebo ho znova rozbalí | Zlúči všetky vybrané vrstvy nadol do vrstvy pod nimi |
| tr | Bu paneli başlık çubuğuna daraltır veya tekrar genişletir | Seçili tüm katmanları altındaki katmanla birleştirir |

- [ ] **Step 5: Wire the `.panel-collapse` title in `index.html`**

Replace line 338 (the `#tpl-panel` template):

```html
                <button type="button" class="panel-collapse" aria-expanded="true" data-i18n-title="panel.collapseExpand" title="Collapse/expand">
```

with:

```html
                <button type="button" class="panel-collapse" aria-expanded="true" data-i18n-title-name="panel.collapse" data-i18n-title="panel.collapseExpand.hint" title="Collapse/expand — Collapses this panel to its title bar, or expands it back">
```

(Static title text mirrors what `Helpers.composeTitle` would produce so the pre-`I18n.apply()` DOM is never wrong; `I18n.apply()` recomposes it from the two `data-i18n-title*` attributes the same way it does for every other control. `panel.collapse` — "Collapse", already an existing key used by the button's `<span class="sr-only">` — is a slightly odd name for a button whose own visible content is icon-only, but it is what the template already had on hand (`data-i18n="panel.collapse"` on the `sr-only` span); reusing it keeps this a one-line template edit rather than inventing a second near-duplicate name key.)

- [ ] **Step 6: Wire the `#merge-selected` title in `js/ui/components/layer-panel.js`**

Replace line 113:

```js
                <button type="button" id="merge-selected" class="layer-ctrl-btn layer-ctrl-wide" data-i18n="layer.mergeSelected" data-i18n-title="layer.mergeSelected.hint" title="${this._t('layer.mergeSelected.hint', 'Merge selected layers')}">${this._t('layer.mergeSelected', 'Merge')}</button>
```

with:

```js
                <button type="button" id="merge-selected" class="layer-ctrl-btn layer-ctrl-wide" data-i18n="layer.mergeSelected" data-i18n-title-name="layer.mergeSelected" data-i18n-title="layer.mergeSelected.hint" title="${Helpers.composeTitle(this._t('layer.mergeSelected', 'Merge'), this._t('layer.mergeSelected.hint', 'Merges every selected layer down into the one below it'))}">${this._t('layer.mergeSelected', 'Merge')}</button>
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npx playwright test tests/browser/panel-collapse-tooltip.spec.js`
Expected: PASS

- [ ] **Step 8: Remove the now-obsolete exclusion from `tests/browser/tooltip.spec.js`**

In the `'every two-stage control in the main workspace chrome has a real description'` test, find the block:

```js
                    // KNOWN GAP, out of this batch's scope: .panel-collapse (every
                    // sidebar panel's collapse/expand header button) and
                    // #merge-selected (the Layers panel's Merge button) are matched
                    // by SELECTOR but their title text was never given a real
                    // composeTitle(name, hint) two-part description by Tasks 1-4 —
                    // that work belongs to a separate, not-yet-committed session
                    // (see this batch's progress.md pre-flight ruling on the
                    // .panel-header drift, which is the same underlying gap).
                    // Excluding here rather than leaving this test permanently red
                    // for controls outside Task 5's file scope; found and reported
                    // 2026-08-20 in task-5-report.md. Remove this exclusion once
                    // that hint work lands.
                    if (el.classList.contains('panel-collapse') || el.id === 'merge-selected') continue;
```

Delete the whole block (both the comment and the `if` line) — the sweep now covers both controls for real, verifying this task rather than dodging around it.

- [ ] **Step 9: Run the widened test and the new test together**

Run: `npx playwright test tests/browser/tooltip.spec.js tests/browser/panel-collapse-tooltip.spec.js`
Expected: all PASS.

- [ ] **Step 10: Run the i18n parity and lint gates**

Run: `node tests/run-all.js`
Expected: `ALL TEST FILES PASSED`

- [ ] **Step 11: Commit**

```bash
git add index.html js/ui/components/layer-panel.js js/i18n/*.js tests/browser/tooltip.spec.js tests/browser/panel-collapse-tooltip.spec.js
git commit -m "fix: give the panel-collapse button and the Merge button real hover hints"
```

---

### Task 5: Preset list row hints

**Files:**
- Modify: `js/ui/components/preset-controls.js:63-142` (`buildRow`), `:338-364` (`_row`), `:366-385` (`_iconButton`)
- Modify: `js/ui/tooltip-manager.js:36` (`SELECTOR`)
- Test: new `tests/browser/preset-row-tooltip.spec.js`

**Interfaces:**
- Consumes: `Helpers.composeTitle`, `TooltipManager`. Every control this task touches already carries a real, correct hint sentence (`toolPreset.loadHint`, `toolPreset.saveHint`, `toolPreset.nothingToSave`, `toolPreset.rename`, `toolPreset.delete`) as a flat native `title` — no new i18n content in this task at all, only SELECTOR + composeTitle wiring.
- Produces: `.preset-bar-select`, `.preset-bar-button`, `.preset-panel-action` added to `SELECTOR`.

- [ ] **Step 1: Write the failing test**

Create `tests/browser/preset-row-tooltip.spec.js`:

```js
'use strict';
/**
 * The Load select and Save button (js/ui/components/preset-controls.js
 * buildRow) and the rename/delete icon buttons (_iconButton) all already
 * carried a real hint sentence as a flat native title. This wires them into
 * the two-stage mechanism rather than authoring new copy.
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

test('the tool preset Load select and Save button have real two-stage tooltips', async ({ page }) => {
    await boot(page);
    await page.keyboard.press('b'); // any tool with presets — Brush
    for (const id of ['tool-preset-select', 'tool-preset-save']) {
        const el = page.locator(`#${id}`);
        await expect(el).toBeAttached();
        const title = await el.getAttribute('title');
        const { name, desc } = await page.evaluate(
            (t) => Helpers.splitTitle(t), title);
        expect(name).toBeTruthy();
        expect(desc).toBeTruthy();
        expect(desc).not.toBe(name);
    }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test tests/browser/preset-row-tooltip.spec.js`
Expected: FAIL — neither `.preset-bar-select` nor `.preset-bar-button` (from `buildRow`'s `idPrefix` default `'tool-preset'`) matches `SELECTOR` today, so `Helpers.splitTitle` on the flat hint-only title returns the whole hint as `name` with an empty `desc`.

- [ ] **Step 3: Add the preset classes to `TooltipManager`'s `SELECTOR`**

In `js/ui/tooltip-manager.js:36`, grep for the current line and append `, .preset-bar-select, .preset-bar-button, .preset-panel-action` to whatever it currently reads (builds on Task 3's additions).

- [ ] **Step 4: Wire the Load select and Save button titles**

In `js/ui/components/preset-controls.js`, replace lines 71-88 (`buildRow`, the `select` and `save` construction):

```js
        const select = document.createElement('select');
        select.id = `${prefix}-select`;
        select.className = 'preset-bar-select';
        select.dataset.i18nTitle = 'toolPreset.loadHint';
        select.title = t('toolPreset.loadHint',
            'Load a saved setting for the tool you are holding');
        row.appendChild(select);

        const save = document.createElement('button');
        save.type = 'button';
        save.id = `${prefix}-save`;
        save.className = 'panel-button preset-bar-button';
        save.dataset.i18n = 'toolPreset.save';
        save.textContent = t('toolPreset.save', 'Save preset...');
        save.dataset.i18nTitle = 'toolPreset.saveHint';
        save.title = t('toolPreset.saveHint',
            'Save the current settings of this tool under a name');
        row.appendChild(save);
```

with:

```js
        const select = document.createElement('select');
        select.id = `${prefix}-select`;
        select.className = 'preset-bar-select';
        select.dataset.i18nTitleName = 'toolPreset.load';
        select.dataset.i18nTitle = 'toolPreset.loadHint';
        select.title = Helpers.composeTitle(
            t('toolPreset.load', 'Load preset...'),
            t('toolPreset.loadHint', 'Load a saved setting for the tool you are holding')
        );
        row.appendChild(select);

        const save = document.createElement('button');
        save.type = 'button';
        save.id = `${prefix}-save`;
        save.className = 'panel-button preset-bar-button';
        save.dataset.i18n = 'toolPreset.save';
        save.textContent = t('toolPreset.save', 'Save preset...');
        save.dataset.i18nTitleName = 'toolPreset.save';
        save.dataset.i18nTitle = 'toolPreset.saveHint';
        save.title = Helpers.composeTitle(
            t('toolPreset.save', 'Save preset...'),
            t('toolPreset.saveHint', 'Save the current settings of this tool under a name')
        );
        row.appendChild(save);
```

Replace lines 130-135 (`refresh`, the disabled/nothing-to-save branch):

```js
            const ready = scope && PresetService.toolSupportsPresets(scope);
            save.disabled = !ready;
            save.dataset.i18nTitle = ready ? 'toolPreset.saveHint' : 'toolPreset.nothingToSave';
            save.title = ready
                ? t('toolPreset.saveHint', 'Save the current settings of this tool under a name')
                : t('toolPreset.nothingToSave', 'Nothing to save yet');
```

with:

```js
            const ready = scope && PresetService.toolSupportsPresets(scope);
            save.disabled = !ready;
            save.dataset.i18nTitle = ready ? 'toolPreset.saveHint' : 'toolPreset.nothingToSave';
            save.title = Helpers.composeTitle(
                t('toolPreset.save', 'Save preset...'),
                ready
                    ? t('toolPreset.saveHint', 'Save the current settings of this tool under a name')
                    : t('toolPreset.nothingToSave', 'Nothing to save yet')
            );
```

- [ ] **Step 5: Wire the rename/delete icon buttons' titles**

Replace lines 366-374 (`_iconButton`):

```js
    /** @private */
    _iconButton(icon, i18n, fallback, onClick) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'preset-panel-action';
        btn.dataset.i18nTitle = i18n;
        btn.title = t(i18n, fallback);
        btn.dataset.i18nAriaLabel = i18n;
        btn.setAttribute('aria-label', t(i18n, fallback));
```

with:

```js
    /** @private */
    _iconButton(icon, i18n, fallback, onClick) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'preset-panel-action';
        const name = t(i18n, fallback);
        btn.dataset.i18nTitleName = i18n;
        btn.title = Helpers.composeTitle(name, '');
        btn.dataset.i18nAriaLabel = i18n;
        btn.setAttribute('aria-label', name);
```

(`toolPreset.rename`/`toolPreset.delete` are short verbs, not sentences — "Rename", "Delete" — with no natural "how it works" hint beyond what the icon+label already say, matching the tool rail's own name-only exception for `_iconButton`'s two callers. If a reviewer wants a real hint here too, that is new content authoring, not wiring, and belongs to a follow-up, not this task — flag rather than invent one.)

- [ ] **Step 6: Run test to verify it passes**

Run: `npx playwright test tests/browser/preset-row-tooltip.spec.js`
Expected: PASS

- [ ] **Step 7: Run the i18n parity and lint gates**

Run: `node tests/run-all.js`
Expected: `ALL TEST FILES PASSED`

- [ ] **Step 8: Commit**

```bash
git add js/ui/components/preset-controls.js js/ui/tooltip-manager.js tests/browser/preset-row-tooltip.spec.js
git commit -m "feat: wire the tool-preset Load/Save controls into the two-stage tooltip"
```

---

### Task 6: Pattern library thumbnail hints

**Files:**
- Modify: `js/ui/pattern-panel.js:262-266` (`_renderPatterns`)
- Modify: `js/ui/tooltip-manager.js:36` (`SELECTOR`)
- Modify: `js/i18n/en.js` + 12 other `js/i18n/*.js` files (new key: `pattern.selectHint`)
- Test: new `tests/browser/pattern-thumbnail-tooltip.spec.js`

**Interfaces:**
- Consumes: `Helpers.composeTitle`, `TooltipManager`.
- Produces: `.pattern-item` added to `SELECTOR`. Every pattern library thumbnail's tooltip becomes a real two-stage one: the pattern's own name (already there) as the name tag, one new shared sentence as the hint (identical across every pattern — the behavior is uniform, so there is nothing pattern-specific to say beyond the name itself).

- [ ] **Step 1: Write the failing test**

Create `tests/browser/pattern-thumbnail-tooltip.spec.js`:

```js
'use strict';
/**
 * Pattern library thumbnails (js/ui/pattern-panel.js) carry a real two-stage
 * tooltip: the pattern's own name, plus a shared hint (the click behavior is
 * identical for every pattern, so one sentence covers all of them).
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

test('a pattern library thumbnail has a real two-stage tooltip', async ({ page }) => {
    await boot(page);
    await page.keyboard.press('k'); // Pattern Creator tool opens the panel/dialog with the library
    const item = page.locator('.pattern-item').first();
    await expect(item).toBeAttached();
    const title = await item.getAttribute('title');
    const { name, desc } = await page.evaluate(
        (t) => Helpers.splitTitle(t), title);
    expect(name).toBeTruthy();
    expect(desc).toBeTruthy();
    expect(desc).not.toBe(name);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test tests/browser/pattern-thumbnail-tooltip.spec.js`
Expected: FAIL — `.pattern-item` is not matched by `SELECTOR` and its title is currently just `pattern.name` with no hint.

- [ ] **Step 3: Add the one new key to `js/i18n/en.js`**

Grep for a suitable anchor — the exact line `'panel.patterns': 'Patterns',` in `js/i18n/en.js` — and insert immediately after it:

```js
    'pattern.selectHint': 'Click to make this the active fill pattern',
```

- [ ] **Step 4: Add the same key, natively translated, to the other 12 locale files**

Grep each file for `'panel.patterns': '<value>',` and insert the key immediately after it, translated per this table:

| Locale | `pattern.selectHint` |
|---|---|
| cs | Kliknutím nastavíte tento vzorek jako aktivní výplňový vzorek |
| de | Anklicken, um dieses Muster zum aktiven Füllmuster zu machen |
| es | Haga clic para convertir este patrón en el patrón de relleno activo |
| fr | Cliquez pour faire de ce motif le motif de remplissage actif |
| hu | Kattintson, hogy ez legyen az aktív kitöltési minta |
| it | Fare clic per rendere questo il motivo di riempimento attivo |
| pl | Kliknij, aby ustawić ten wzór jako aktywny wzór wypełnienia |
| pt | Clique para tornar este o padrão de preenchimento ativo |
| ro | Faceți clic pentru a face din acesta modelul de umplere activ |
| ru | Щёлкните, чтобы сделать этот узор активным узором заливки |
| sk | Kliknutím nastavíte tento vzor ako aktívny výplňový vzor |
| tr | Bu deseni etkin dolgu deseni yapmak için tıklayın |

- [ ] **Step 5: Add `.pattern-item` to `TooltipManager`'s `SELECTOR`**

In `js/ui/tooltip-manager.js:36`, grep for the current line and append `, .pattern-item` to whatever it currently reads (builds on Task 5's additions).

- [ ] **Step 6: Wire the thumbnail title in `js/ui/pattern-panel.js`**

Replace lines 262-266 (`_renderPatterns`, the item construction):

```js
        patterns.forEach((pattern, index) => {
            const item = document.createElement('div');
            item.className = 'pattern-item';
            item.dataset.index = index;
            item.title = pattern.name;
```

with:

```js
        patterns.forEach((pattern, index) => {
            const item = document.createElement('div');
            item.className = 'pattern-item';
            item.dataset.index = index;
            item.dataset.i18nTitle = 'pattern.selectHint';
            item.title = Helpers.composeTitle(pattern.name,
                this._t('pattern.selectHint', 'Click to make this the active fill pattern'));
```

(No `data-i18n-title-name` here — `pattern.name` is the pattern's own stored name, not a translation key, so I18n's locale-switch recompose has nothing to look up for the name half; only the hint half is a real i18n key. This mirrors how `_libraryRow`'s `load.title = preset.name` elsewhere in the codebase already treats a stored, non-translatable name.)

Confirm `this._t` exists on the class this method belongs to (`PatternPanelClass` or equivalent) — grep the file for its definition; if the class uses a module-level `t()` helper instead (as `preset-controls.js` does), use that name instead of `this._t`.

- [ ] **Step 7: Run test to verify it passes**

Run: `npx playwright test tests/browser/pattern-thumbnail-tooltip.spec.js`
Expected: PASS

- [ ] **Step 8: Run the i18n parity and lint gates**

Run: `node tests/run-all.js`
Expected: `ALL TEST FILES PASSED`

- [ ] **Step 9: Commit**

```bash
git add js/ui/pattern-panel.js js/ui/tooltip-manager.js js/i18n/*.js tests/browser/pattern-thumbnail-tooltip.spec.js
git commit -m "feat: give pattern library thumbnails a real hover hint"
```

---

### Task 7: Transform panel hints

**Files:**
- Modify: `js/ui/components/transform-panel.js:51-123` (`_build`, the HTML template)
- Modify: `js/ui/tooltip-manager.js:36` (`SELECTOR`)
- Modify: `js/i18n/en.js` + 12 other `js/i18n/*.js` files (14 new keys — see table below)
- Test: new `tests/browser/transform-panel-tooltip.spec.js`

**Interfaces:**
- Consumes: `Helpers.composeTitle`, `TooltipManager`. Every control in this panel is currently "missing entirely" — the static HTML template has `data-i18n` for visible text but no `title`/hint anywhere.
- Produces: `.panel-button.small`, `.tp-xor`, `.tp-sx`, `.tp-sy`, `.tp-rot`, `.tp-img-rot`, `.tp-warp`, `.tp-shift-step`, `.tp-shift-wrap` added to `SELECTOR` (all scoped under `#transform-panel`, so this does not affect `.panel-button` elsewhere in the app — verify by grepping for existing `.panel-button` uses outside this file before broadening the selector this way; if `.panel-button` alone is too broad, use a more specific new class like `.tp-btn` added to each of the five buttons instead, and note that deviation in the task's commit message).
- Explicitly out of scope: the four `.dir-pad-zone` shift buttons (shared with the Reference panel's Offset pad — see the plan's Global Constraints).

**New keys** (14 total; every control in this panel needs BOTH a name key it may not already have AND a hint — check each against `en.js` before assuming "new", since several already have a `data-i18n` name key from the static template and only need a `.hint` sibling):

| Key | English |
|---|---|
| `transform.xorMode.hint` | Draws the stamp with XOR instead of replacing pixels, so it toggles whatever is already there |
| `transform.scaleX.hint` | Stretches the stamp horizontally without affecting its height |
| `transform.scaleY.hint` | Stretches the stamp vertically without affecting its width |
| `transform.rotate.hint` | Rotates the stamp or layer around its centre |
| `transform.shape.hint` | Bends the stamp into the chosen shape |
| `transform.reset.hint` | Restores the stamp to its default scale, rotation and shape |
| `transform.flipH.hint` | Flips the selection or layer left-to-right |
| `transform.flipV.hint` | Flips the selection or layer top-to-bottom |
| `transform.invert.hint` | Inverts every pixel: set becomes clear and clear becomes set |
| `transform.outline.hint` | Draws an outline around the selection or layer's set pixels |
| `transform.gap.hint` | How far the outline sits from the original edge |
| `transform.thickness.hint` | How many pixels wide the outline is |
| `transform.shiftStep.hint` | Whether Shift moves by one pixel or one whole cell |
| `transform.shiftWrap.hint` | Whether pixels shifted off one edge reappear on the opposite edge |

- [ ] **Step 1: Write the failing test**

Create `tests/browser/transform-panel-tooltip.spec.js`:

```js
'use strict';
/**
 * Every control in the Transform panel (js/ui/components/transform-panel.js)
 * carries a real two-stage tooltip. Previously none of them had a title at
 * all — the static template only carried data-i18n for visible text.
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

test('every Transform panel control has a real two-stage tooltip', async ({ page }) => {
    await boot(page);
    const selectors = [
        '.tp-reset', '[data-tp-transform="flipH"]', '[data-tp-transform="flipV"]',
        '[data-tp-transform="invert"]', '[data-tp-transform="outline"]',
        '.tp-shift-step', '.tp-shift-wrap'
    ];
    for (const sel of selectors) {
        const el = page.locator(sel).first();
        await expect(el).toBeAttached();
        const title = await el.getAttribute('title');
        const { name, desc } = await page.evaluate(
            (t) => Helpers.splitTitle(t), title);
        expect(name).toBeTruthy();
        expect(desc).toBeTruthy();
        expect(desc).not.toBe(name);
    }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test tests/browser/transform-panel-tooltip.spec.js`
Expected: FAIL — none of the seven controls have any `title` attribute today.

- [ ] **Step 3: Add the 14 new keys to `js/i18n/en.js`**

Grep for the exact line `'transform.thickness': '<value>',` (or whichever `transform.*` key sits last before the panel's own section ends — confirm the real anchor by grepping `'transform.` across the file first) and insert the 14 `.hint` keys from the table above, each immediately after its own name key (`transform.xorMode.hint` after `transform.xorMode`, `transform.scaleX.hint` after `transform.scaleX`, and so on) rather than all in one block — this keeps every name/hint pair adjacent, matching every other task's convention in this plan and batch 1's.

- [ ] **Step 4: Add the same 14 keys, natively translated, to the other 12 locale files**

For each of the 14 keys, grep each locale file for its existing name-key line and insert the `.hint` sibling immediately after, translated per this table:

| Key | cs | de | es |
|---|---|---|---|
| `transform.xorMode.hint` | Kreslí razítko pomocí XOR místo nahrazování pixelů, takže přepíná to, co tam už je | Zeichnet den Stempel mit XOR statt Pixel zu ersetzen, sodass er umschaltet, was bereits da ist | Dibuja el sello con XOR en lugar de reemplazar píxeles, de modo que invierte lo que ya hay |
| `transform.scaleX.hint` | Roztáhne razítko vodorovně, aniž by to ovlivnilo jeho výšku | Streckt den Stempel horizontal, ohne seine Höhe zu beeinflussen | Estira el sello horizontalmente sin afectar a su altura |
| `transform.scaleY.hint` | Roztáhne razítko svisle, aniž by to ovlivnilo jeho šířku | Streckt den Stempel vertikal, ohne seine Breite zu beeinflussen | Estira el sello verticalmente sin afectar a su anchura |
| `transform.rotate.hint` | Otočí razítko nebo vrstvu kolem jejího středu | Dreht den Stempel oder die Ebene um ihren Mittelpunkt | Gira el sello o la capa alrededor de su centro |
| `transform.shape.hint` | Prohne razítko do zvoleného tvaru | Verbiegt den Stempel in die gewählte Form | Curva el sello con la forma elegida |
| `transform.reset.hint` | Obnoví výchozí měřítko, otočení a tvar razítka | Setzt Skalierung, Drehung und Form des Stempels auf die Standardwerte zurück | Restaura la escala, rotación y forma predeterminadas del sello |
| `transform.flipH.hint` | Převrátí výběr nebo vrstvu zleva doprava | Spiegelt die Auswahl oder Ebene von links nach rechts | Voltea la selección o la capa de izquierda a derecha |
| `transform.flipV.hint` | Převrátí výběr nebo vrstvu shora dolů | Spiegelt die Auswahl oder Ebene von oben nach unten | Voltea la selección o la capa de arriba a abajo |
| `transform.invert.hint` | Invertuje každý pixel: nastavený se vymaže a vymazaný se nastaví | Kehrt jedes Pixel um: Gesetztes wird gelöscht, Gelöschtes wird gesetzt | Invierte cada píxel: el activado se desactiva y el desactivado se activa |
| `transform.outline.hint` | Nakreslí obrys kolem nastavených pixelů výběru nebo vrstvy | Zeichnet einen Umriss um die gesetzten Pixel der Auswahl oder Ebene | Dibuja un contorno alrededor de los píxeles activados de la selección o la capa |
| `transform.gap.hint` | Jak daleko od původního okraje obrys leží | Wie weit der Umriss vom ursprünglichen Rand entfernt liegt | A qué distancia del borde original se sitúa el contorno |
| `transform.thickness.hint` | Kolik pixelů je obrys široký | Wie viele Pixel breit der Umriss ist | Cuántos píxeles de ancho tiene el contorno |
| `transform.shiftStep.hint` | Zda se Posun pohybuje o jeden pixel, nebo o celou buňku | Ob Verschieben um ein Pixel oder um eine ganze Zelle erfolgt | Si Desplazar se mueve un píxel o una celda entera |
| `transform.shiftWrap.hint` | Zda se pixely posunuté přes jeden okraj znovu objeví na protějším okraji | Ob über einen Rand verschobene Pixel am gegenüberliegenden Rand wieder erscheinen | Si los píxeles desplazados fuera de un borde reaparecen en el borde opuesto |

| Key | fr | hu | it |
|---|---|---|---|
| `transform.xorMode.hint` | Dessine le tampon en XOR au lieu de remplacer les pixels, ce qui inverse ce qui s'y trouve déjà | XOR módban rajzolja a bélyegzőt a pixelek cseréje helyett, így megfordítja, ami már ott van | Disegna il timbro in XOR anziché sostituire i pixel, quindi inverte ciò che c'è già |
| `transform.scaleX.hint` | Étire le tampon horizontalement sans affecter sa hauteur | Vízszintesen nyújtja a bélyegzőt, a magasságát nem érintve | Allunga il timbro orizzontalmente senza modificarne l'altezza |
| `transform.scaleY.hint` | Étire le tampon verticalement sans affecter sa largeur | Függőlegesen nyújtja a bélyegzőt, a szélességét nem érintve | Allunga il timbro verticalmente senza modificarne la larghezza |
| `transform.rotate.hint` | Fait pivoter le tampon ou le calque autour de son centre | Elforgatja a bélyegzőt vagy réteget a középpontja körül | Ruota il timbro o il livello attorno al proprio centro |
| `transform.shape.hint` | Courbe le tampon selon la forme choisie | A kiválasztott alakra hajlítja a bélyegzőt | Piega il timbro nella forma scelta |
| `transform.reset.hint` | Restaure l'échelle, la rotation et la forme par défaut du tampon | Visszaállítja a bélyegző alapértelmezett méretezését, forgatását és alakját | Ripristina la scala, la rotazione e la forma predefinite del timbro |
| `transform.flipH.hint` | Retourne la sélection ou le calque de gauche à droite | Balról jobbra tükrözi a kijelölést vagy réteget | Capovolge la selezione o il livello da sinistra a destra |
| `transform.flipV.hint` | Retourne la sélection ou le calque de haut en bas | Fentről lefelé tükrözi a kijelölést vagy réteget | Capovolge la selezione o il livello dall'alto in basso |
| `transform.invert.hint` | Inverse chaque pixel : ce qui est activé devient vide et inversement | Megfordít minden pixelt: a beállított törlődik, a törölt beállítódik | Inverte ogni pixel: quello impostato viene cancellato e viceversa |
| `transform.outline.hint` | Trace un contour autour des pixels activés de la sélection ou du calque | Körvonalat rajzol a kijelölés vagy réteg beállított pixelei köré | Disegna un contorno attorno ai pixel impostati della selezione o del livello |
| `transform.gap.hint` | À quelle distance du bord d'origine se trouve le contour | Milyen távolságra van a körvonal az eredeti szélétől | A che distanza dal bordo originale si trova il contorno |
| `transform.thickness.hint` | Sur combien de pixels de large s'étend le contour | Hány pixel széles a körvonal | Quanto è largo il contorno, in pixel |
| `transform.shiftStep.hint` | Si le Décalage se déplace d'un pixel ou d'une cellule entière | Hogy az Eltolás egy pixellel vagy egy egész cellával lép-e | Se Sposta si muove di un pixel o di un'intera cella |
| `transform.shiftWrap.hint` | Si les pixels décalés hors d'un bord réapparaissent sur le bord opposé | Hogy az egyik szélről lelógó pixelek megjelennek-e a szemközti szélen | Se i pixel spostati oltre un bordo riappaiono sul bordo opposto |

| Key | pl | pt | ro |
|---|---|---|---|
| `transform.xorMode.hint` | Rysuje stempel w trybie XOR zamiast zastępować piksele, więc odwraca to, co już tam jest | Desenha o carimbo com XOR em vez de substituir pixels, invertendo o que já lá está | Desenează ștampila cu XOR în loc să înlocuiască pixelii, astfel încât inversează ce este deja acolo |
| `transform.scaleX.hint` | Rozciąga stempel w poziomie, nie wpływając na jego wysokość | Estica o carimbo na horizontal sem afetar a sua altura | Întinde ștampila pe orizontală fără a-i afecta înălțimea |
| `transform.scaleY.hint` | Rozciąga stempel w pionie, nie wpływając na jego szerokość | Estica o carimbo na vertical sem afetar a sua largura | Întinde ștampila pe verticală fără a-i afecta lățimea |
| `transform.rotate.hint` | Obraca stempel lub warstwę wokół jej środka | Roda o carimbo ou a camada em torno do seu centro | Rotește ștampila sau stratul în jurul centrului său |
| `transform.shape.hint` | Wygina stempel w wybrany kształt | Dobra o carimbo na forma escolhida | Îndoaie ștampila în forma aleasă |
| `transform.reset.hint` | Przywraca domyślną skalę, obrót i kształt stempla | Restaura a escala, rotação e forma predefinidas do carimbo | Restaurează scara, rotația și forma implicite ale ștampilei |
| `transform.flipH.hint` | Odbija zaznaczenie lub warstwę od lewej do prawej | Vira a seleção ou a camada da esquerda para a direita | Întoarce selecția sau stratul de la stânga la dreapta |
| `transform.flipV.hint` | Odbija zaznaczenie lub warstwę od góry do dołu | Vira a seleção ou a camada de cima para baixo | Întoarce selecția sau stratul de sus în jos |
| `transform.invert.hint` | Odwraca każdy piksel: ustawiony staje się pusty, a pusty ustawiony | Inverte cada pixel: o definido fica limpo e o limpo fica definido | Inversează fiecare pixel: cel setat devine gol și cel gol devine setat |
| `transform.outline.hint` | Rysuje kontur wokół ustawionych pikseli zaznaczenia lub warstwy | Desenha um contorno à volta dos pixels definidos da seleção ou camada | Desenează un contur în jurul pixelilor setați ai selecției sau stratului |
| `transform.gap.hint` | Jak daleko od pierwotnej krawędzi znajduje się kontur | A que distância da margem original fica o contorno | Cât de departe de marginea originală se află conturul |
| `transform.thickness.hint` | Ile pikseli szerokości ma kontur | Quantos pixels de largura tem o contorno | Câți pixeli lățime are conturul |
| `transform.shiftStep.hint` | Czy Przesunięcie porusza się o jeden piksel, czy o całą komórkę | Se o Deslocamento se move um pixel ou uma célula inteira | Dacă Deplasarea se mișcă cu un pixel sau cu o celulă întreagă |
| `transform.shiftWrap.hint` | Czy piksele przesunięte poza jedną krawędź pojawiają się ponownie na przeciwległej | Se os pixels deslocados de uma margem reaparecem na margem oposta | Dacă pixelii deplasați dincolo de o margine reapar pe marginea opusă |

| Key | ru | sk | tr |
|---|---|---|---|
| `transform.xorMode.hint` | Рисует штамп в режиме XOR вместо замены пикселей, инвертируя то, что уже есть | Kreslí pečiatku pomocou XOR namiesto nahrádzania pixelov, takže prepína to, čo tam už je | Pikselleri değiştirmek yerine damgayı XOR ile çizer, böylece zaten orada olanı tersine çevirir |
| `transform.scaleX.hint` | Растягивает штамп по горизонтали, не влияя на его высоту | Roztiahne pečiatku vodorovne bez ovplyvnenia jej výšky | Damgayı yüksekliğini etkilemeden yatay olarak gerer |
| `transform.scaleY.hint` | Растягивает штамп по вертикали, не влияя на его ширину | Roztiahne pečiatku zvisle bez ovplyvnenia jej šírky | Damgayı genişliğini etkilemeden dikey olarak gerer |
| `transform.rotate.hint` | Вращает штамп или слой вокруг его центра | Otočí pečiatku alebo vrstvu okolo jej stredu | Damgayı veya katmanı merkezi etrafında döndürür |
| `transform.shape.hint` | Изгибает штамп по выбранной форме | Ohne pečiatku do zvoleného tvaru | Damgayı seçilen şekle büker |
| `transform.reset.hint` | Восстанавливает исходный масштаб, поворот и форму штампа | Obnoví predvolenú mierku, otočenie a tvar pečiatky | Damganın varsayılan ölçeğini, döndürmesini ve şeklini geri yükler |
| `transform.flipH.hint` | Отражает выделение или слой слева направо | Prevráti výber alebo vrstvu zľava doprava | Seçimi veya katmanı soldan sağa çevirir |
| `transform.flipV.hint` | Отражает выделение или слой сверху вниз | Prevráti výber alebo vrstvu zhora nadol | Seçimi veya katmanı yukarıdan aşağıya çevirir |
| `transform.invert.hint` | Инвертирует каждый пиксель: установленный становится пустым, а пустой — установленным | Invertuje každý pixel: nastavený sa vymaže a vymazaný sa nastaví | Her pikseli tersine çevirir: ayarlı olan boşalır, boş olan ayarlanır |
| `transform.outline.hint` | Рисует контур вокруг установленных пикселей выделения или слоя | Nakreslí obrys okolo nastavených pixelov výberu alebo vrstvy | Seçimin veya katmanın ayarlı piksellerinin etrafına bir çerçeve çizer |
| `transform.gap.hint` | Как далеко контур находится от исходного края | Ako ďaleko od pôvodného okraja obrys leží | Çerçevenin orijinal kenardan ne kadar uzakta olduğu |
| `transform.thickness.hint` | Насколько широк контур в пикселях | Koľko pixelov je obrys široký | Çerçevenin kaç piksel genişliğinde olduğu |
| `transform.shiftStep.hint` | Перемещается ли Сдвиг на один пиксель или на целую ячейку | Či sa Posun pohybuje o jeden pixel, alebo o celú bunku | Kaydırmanın bir piksel mi yoksa bir hücre mi hareket ettiği |
| `transform.shiftWrap.hint` | Появляются ли пиксели, сдвинутые за один край, на противоположном крае | Či sa pixely posunuté cez jeden okraj znova objavia na protiľahlom okraji | Bir kenardan kaydırılan piksellerin karşı kenarda yeniden görünüp görünmediği |

- [ ] **Step 5: Add the Transform panel's control classes to `TooltipManager`'s `SELECTOR`**

In `js/ui/tooltip-manager.js:36`, grep for the current line and append `, .tp-reset, [data-tp-transform], .tp-xor, .tp-sx, .tp-sy, .tp-rot, .tp-img-rot, .tp-warp, .tp-shift-step, .tp-shift-wrap` to whatever it currently reads (builds on Task 6's additions). Using `[data-tp-transform]` as one attribute-selector entry covers all five `data-tp-transform`-tagged buttons (flipH, flipV, invert, outline, and the four dir-pad zones) in a single addition — EXCEPT the dir-pad zones must then be explicitly re-excluded, since they are out of scope (Global Constraints). Confirm this by checking `Helpers.buildDirPad()`'s zone buttons do NOT carry `class="panel-button"` or any class this task adds directly — they only get `dataset.tpTransform` set externally by `transform-panel.js:126-129` after the fact — so composeTitle wiring in this task must skip them explicitly (Step 6 below only touches `flipH`/`flipV`/`invert`/`outline` values, never `shiftUp`/`shiftLeft`/`shiftRight`/`shiftDown`).

- [ ] **Step 6: Wire the `data-i18n-title`/`data-i18n-title-name` pairs into the static template**

In `js/ui/components/transform-panel.js`, within the `_build(content)` method's template string (lines 52-123), add `data-i18n-title-name="<name-key>" data-i18n-title="<hint-key>"` to each of these elements (the visible `data-i18n` name key each element already carries tells you which name key to pair it with):

```html
<!-- tp-xor checkbox: -->
<input type="checkbox" class="tp-xor" data-i18n-title-name="transform.xorMode" data-i18n-title="transform.xorMode.hint">
<!-- tp-sx range: -->
<input type="range" class="tp-sx" min="10" max="400" step="5" value="100" data-i18n-title-name="transform.scaleX" data-i18n-title="transform.scaleX.hint">
<!-- tp-sy range: -->
<input type="range" class="tp-sy" min="10" max="400" step="5" value="100" data-i18n-title-name="transform.scaleY" data-i18n-title="transform.scaleY.hint">
<!-- tp-rot range: -->
<input type="range" class="tp-rot" min="-180" max="180" step="1" value="0" data-i18n-title-name="transform.rotate" data-i18n-title="transform.rotate.hint">
<!-- tp-warp select: -->
<select class="tp-warp" data-i18n-title-name="transform.shape" data-i18n-title="transform.shape.hint">
<!-- tp-reset button: -->
<button type="button" class="panel-button small tp-reset" data-i18n="transform.reset" data-i18n-title-name="transform.reset" data-i18n-title="transform.reset.hint">Reset</button>
<!-- tp-img-rot range: -->
<input type="range" class="tp-img-rot" min="-180" max="180" step="1" value="0" data-i18n-title-name="transform.rotate" data-i18n-title="transform.rotate.hint">
<!-- flipH/flipV/invert buttons: -->
<button type="button" class="panel-button small" data-tp-transform="flipH" data-i18n-title-name="transform.flipH" data-i18n-title="transform.flipH.hint">&#x2194; <span data-i18n="transform.flipH">Flip H</span></button>
<button type="button" class="panel-button small" data-tp-transform="flipV" data-i18n-title-name="transform.flipV" data-i18n-title="transform.flipV.hint">&#x2195; <span data-i18n="transform.flipV">Flip V</span></button>
<button type="button" class="panel-button small" data-tp-transform="invert" data-i18n-title-name="transform.invert" data-i18n-title="transform.invert.hint">&#x25A0; <span data-i18n="transform.invert">Invert</span></button>
<!-- outline button + gap/thickness sliders: -->
<button type="button" class="panel-button small" data-tp-transform="outline" data-i18n-title-name="transform.outline" data-i18n-title="transform.outline.hint">&#x25AD; <span data-i18n="transform.outline">Outline</span></button>
...
<input type="range" class="tp-og" min="0" max="8" value="1" data-i18n-title-name="transform.gap" data-i18n-title="transform.gap.hint">
...
<input type="range" class="tp-os" min="1" max="8" value="1" data-i18n-title-name="transform.thickness" data-i18n-title="transform.thickness.hint">
<!-- tp-shift-step select: -->
<select class="tp-shift-step" data-i18n-aria-label="transform.shiftStep" aria-label="Shift step" data-i18n-title-name="transform.shiftStep" data-i18n-title="transform.shiftStep.hint">
<!-- tp-shift-wrap checkbox: -->
<input type="checkbox" class="tp-shift-wrap" checked data-i18n-title-name="transform.shiftWrap" data-i18n-title="transform.shiftWrap.hint">
```

These elements have no `title` attribute set inline (unlike every earlier task's JS-built buttons) because this whole panel is a static `innerHTML` template rendered once by `_build()` — set `content` querySelectorAll and stamp initial titles via `Helpers.composeTitle` right after the template string is assigned, immediately before `if (window.I18n...) I18n.apply(content);` at line 35, so the DOM is never in a title-less state even before the first `I18n.apply` pass:

```js
        for (const el of content.querySelectorAll('[data-i18n-title]')) {
            const nameKey = el.dataset.i18nTitleName;
            const hintKey = el.dataset.i18nTitle;
            if (nameKey) {
                el.title = Helpers.composeTitle(this._t(nameKey, ''), this._t(hintKey, ''));
            }
        }
```

Add this loop at the end of `_build(content)`, right before the closing brace (after the `zones.down.dataset.tpTransform = 'shiftDown';` line and its neighbors, but before `_build` returns) — the `[data-i18n-title]` selector picks up every element Step 6 tagged and none of the dir-pad zones (which carry no `data-i18n-title` at all), so no explicit exclusion is needed here.

- [ ] **Step 7: Run test to verify it passes**

Run: `npx playwright test tests/browser/transform-panel-tooltip.spec.js`
Expected: PASS

- [ ] **Step 8: Run the i18n parity and lint gates**

Run: `node tests/run-all.js`
Expected: `ALL TEST FILES PASSED`

- [ ] **Step 9: Commit**

```bash
git add js/ui/components/transform-panel.js js/ui/tooltip-manager.js js/i18n/*.js tests/browser/transform-panel-tooltip.spec.js
git commit -m "feat: give every Transform panel control a real hover hint"
```

---

### Task 8: Widen `tooltip.spec.js`'s main-workspace sweep to cover batch 2's areas

**Files:**
- Modify: `tests/browser/tooltip.spec.js` (the `areas` array in the widened test)

**Interfaces:**
- Consumes: nothing new.
- Produces: the widened sweep now also walks `#grid-controls`, `#draw-modes`, `#transform-panel`, `.pattern-panel` (or whatever the pattern library's actual root selector is — confirm by reading `js/ui/pattern-panel.js`'s own root element construction before writing this), and `#panels .preset-bar` (the tool-preset row), so any future regression in any of batch 1 + batch 2's combined coverage is caught by one test, not scattered across nine separate spec files.

- [ ] **Step 1: Widen the `areas` array**

In `tests/browser/tooltip.spec.js`, replace the `areas` array inside `'every two-stage control in the main workspace chrome has a real description'`:

```js
        const areas = ['#tool-rail', '#panels', '#zoom-controls', '.app-dialog-header'];
```

with:

```js
        const areas = [
            '#tool-rail', '#panels', '#zoom-controls', '.app-dialog-header',
            '#grid-controls', '#draw-modes', '#transform-panel'
        ];
```

(`#panels` already covers the Presets panel's rows and the pattern library if either lives inside the `#panels` sidebar — confirm this by inspecting the DOM at runtime with a quick manual check before assuming a new area selector is needed for either; only add one if the pattern library or preset bar genuinely renders outside `#panels`.)

- [ ] **Step 2: Run the widened test**

Run: `npx playwright test tests/browser/tooltip.spec.js`
Expected: PASS — every control the previous seven tasks fixed is now covered by this one sweep, with no exclusions left (Task 4 already removed the `.panel-collapse`/`#merge-selected` one; `#tool-options-panel-content` stays excluded, since only Shape Type's basic category has real hints so far — that is unchanged, ongoing batch 3 work).

- [ ] **Step 3: Run the full Playwright suite**

Run: `npx playwright test`
Expected: all specs PASS.

- [ ] **Step 4: Run the i18n parity and lint gates**

Run: `node tests/run-all.js`
Expected: `ALL TEST FILES PASSED`

- [ ] **Step 5: Commit**

```bash
git add tests/browser/tooltip.spec.js
git commit -m "test: widen the tooltip-description sweep to cover batch 2's areas"
```

---

## Batch 2 exit check

After Task 8's commit, update `docs/superpowers/specs/2026-08-20-tooltip-coverage-design.md` §7: mark batch 2 done with the commit range, note any deviations found during implementation (the same way batch 1's own exit check recorded its dialog-focus fix and its two discovered gaps), and carry forward into batch 3's scope anything batch 2's own implementation surfaces as newly out-of-scope — the same discipline batch 1 used for `.panel-collapse` and `#merge-selected`. End the session's final reply with the next session's kickoff prompt for batch 3 (Dialog sweep), per this project's phase-completion ritual.
