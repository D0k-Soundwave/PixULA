'use strict';
/**
 * Batch 11B in a real browser: Edit > Find Map Element (Ctrl+F). Select a block, find every place it appears, step through them, Accept, and the places are
 * covered by numbered boxes; the picture and the undo list are untouched. Also: the key, the refusals with reasons, the keyboard flow, and a phone-width view.
 */
const { test, expect } = require('@playwright/test');
const { boot, selectMode } = require('./helpers');

const CIRCLE = [0x3C, 0x42, 0x81, 0x81, 0x81, 0x81, 0x42, 0x3C];
/** A picture with a circle in red ink at three cells, and one in green: cells (3,4) (10,4) (20,15) red, (25,2) green. */
async function paintCircles(page) {
    await page.evaluate((rows) => {
        const layer = LayerManager.getCurrentLayer();
        const put = (cx, cy, ink) => {
            const c = layer.getCell(cx, cy);
            c.pixels.set(rows);
            Object.assign(c, { ink, paper: 7, bright: false, flash: false, altered: true });
        };
        put(3, 4, 2); put(10, 4, 2); put(20, 15, 2); put(25, 2, 4);
        LayerManager.composeToCanvas();
    }, CIRCLE);
}
const select = (page, cx, cy, w = 1, h = 1) => page.evaluate(([cx, cy, w, h]) => {
    SelectionService.setSelection({ x: cx * ZX_SPECTRUM.CELL_WIDTH, y: cy * ZX_SPECTRUM.CELL_HEIGHT, width: w * ZX_SPECTRUM.CELL_WIDTH, height: h * ZX_SPECTRUM.CELL_HEIGHT });
}, [cx, cy, w, h]);
const panel = (page) => page.locator('#map-elements-panel');
const notice = async (page) => page.evaluate(() => new Promise((resolve) => {
    const off = EventBus.on(EVENTS.STATUS_NOTICE, (d) => { resolve(d.text); if (typeof off === 'function') off(); });
    setTimeout(() => resolve(null), 1500);
}));

test('Ctrl+F finds the three red circles, Next steps through them, Accept covers them and changes nothing else', async ({ page }) => {
    await boot(page);
    await paintCircles(page);
    await select(page, 3, 4);
    const defaulted = await page.evaluate(() => { window.__prevented = null; document.addEventListener('keydown', (e) => { if (e.ctrlKey && e.key === 'f') setTimeout(() => { window.__prevented = e.defaultPrevented; }, 0); }, false); });
    void defaulted;
    const undoBefore = await page.evaluate(() => UndoRedo.getUndoCount());
    await page.keyboard.press('Control+f');
    await expect(panel(page)).toBeVisible();
    await expect(panel(page).locator('.mapel-count')).toContainText('3 places found');
    await expect(panel(page).locator('.mapel-place')).toContainText('Place 1 of 3: column 4, row 5');
    // the mode select: dots only finds the green one as well
    await panel(page).locator('#mapel-mode').selectOption('dots');
    await expect(panel(page).locator('.mapel-count')).toContainText('4 places found');
    await panel(page).locator('#mapel-mode').selectOption('exact');
    await panel(page).locator('.mapel-next').click();
    await expect(panel(page).locator('.mapel-place')).toContainText('Place 2 of 3: column 11, row 5');
    await panel(page).locator('.mapel-next').click();
    await panel(page).locator('.mapel-next').click();
    await expect(panel(page).locator('.mapel-place')).toContainText('Place 1 of 3');
    const dots = () => page.evaluate(() => { const l = LayerManager.getCurrentLayer(); let n = 0; for (let cy = 0; cy < ZX_SPECTRUM.GRID_ROWS; cy++) for (let cx = 0; cx < ZX_SPECTRUM.GRID_COLS; cx++) { const c = l.getCell(cx, cy); if (c && c.altered) for (const r of c.pixels) n += r.toString(2).split('1').length - 1; } return n; });
    const before = await dots();
    await panel(page).locator('.mapel-accept').click();
    const els = await page.evaluate(() => MapService.getElements().map(e => ({ n: e.name, w: e.w, h: e.h, p: e.positions.length, m: e.match })));
    expect(els).toEqual([{ n: 'Element 1', w: 1, h: 1, p: 3, m: 'exact' }]);
    expect(await dots(), 'the picture is not changed').toBe(before);
    expect(await page.evaluate(() => UndoRedo.getUndoCount()), 'Accept is not an undo step').toBe(undoBefore);
    await expect(panel(page).locator('.mapel-find')).toBeHidden();
    // covers are drawn: the overlay describes three covers, numbered 1
    const d = await page.evaluate(() => MapElementOverlay.describe().covers);
    expect(d.map(c => [c.n, c.x, c.y])).toEqual([[1, 3, 4], [1, 10, 4], [1, 20, 15]]);
    await page.keyboard.press('Control+z');
    expect(await page.evaluate(() => MapService.getElements().length), 'Ctrl+Z keeps the element').toBe(1);
});

test('Ctrl+F is claimed by the page: the browser find bar is not opened', async ({ page }) => {
    await boot(page);
    await paintCircles(page);
    await select(page, 3, 4);
    const prevented = await page.evaluate(() => new Promise((resolve) => {
        const doc = document;
        doc.addEventListener('keydown', (e) => { if (e.ctrlKey && e.key === 'f') setTimeout(() => resolve(e.defaultPrevented), 0); });
        doc.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', ctrlKey: true, bubbles: true, cancelable: true }));
    }));
    expect(prevented).toBe(true);
});

test('a place already covered by an earlier element is left out of the next find', async ({ page }) => {
    await boot(page);
    await paintCircles(page);
    await select(page, 3, 4);
    await page.keyboard.press('Control+f');
    await panel(page).locator('.mapel-accept').click();
    // keep element 1 on one place only, (20, 15), so (3, 4) is free to start a find from
    await page.evaluate(() => MapService.setElements(MapService.getElements().map(e => ({ ...e, positions: [{ x: 20, y: 15 }] }))));
    await select(page, 3, 4);
    await page.keyboard.press('Control+f');
    // (3, 4) and (10, 4) are found; (20, 15) is covered and left out
    await expect(panel(page).locator('.mapel-count')).toContainText('2 places found');
    await expect(panel(page).locator('.mapel-count')).toContainText('1 already covered');
    await panel(page).locator('.mapel-cancel').click();
});

/** Element 1 kept on (20, 15) only, so (3, 4) and (10, 4) are free; then a find open on (3, 4): 2 places, 1 covered. */
async function findBesideElement(page) {
    await boot(page);
    await paintCircles(page);
    await select(page, 3, 4);
    await page.keyboard.press('Control+f');
    await panel(page).locator('.mapel-accept').click();
    await page.evaluate(() => MapService.setElements(MapService.getElements().map(e => ({ ...e, positions: [{ x: 20, y: 15 }] }))));
    await select(page, 3, 4);
    await page.keyboard.press('Control+f');
    await expect(panel(page).locator('.mapel-count')).toContainText('2 places found');
}
const highlightPlaces = (page) => page.evaluate(() => {
    const h = MapElementOverlay.describe().highlight;
    return h ? h.places.map(p => [p.x, p.y]) : null;
});

test('deleting an element while a find is open keeps the find and its outlines, and finds the place it freed', async ({ page }) => {
    await findBesideElement(page);
    page.once('dialog', (d) => d.accept());
    await panel(page).locator('.mapel-delete').click();
    expect(await page.evaluate(() => MapService.getElements().length)).toBe(0);
    expect(await page.evaluate(() => MapElementsPanel.active), 'the find is still open').toBe(true);
    await expect(panel(page).locator('.mapel-count')).toHaveText('3 places found');
    expect(await highlightPlaces(page), 'the outlines are on the places the panel counts').toEqual([[3, 4], [10, 4], [20, 15]]);
});

test('a map load while a find is open (Show outlines on too) keeps the find\'s outlines', async ({ page }) => {
    await findBesideElement(page);
    await panel(page).locator('.mapel-cancel').click();
    await panel(page).locator('.mapel-show').click();      // Show outlines on (20, 15)
    await select(page, 3, 4);
    await page.keyboard.press('Control+f');
    await expect(panel(page).locator('.mapel-count')).toContainText('2 places found');
    // a map file without elements replaces them: the covered place is free again
    await page.evaluate(() => MapService.loadDocument({ ...MapService.toDocument(), elements: [] }));
    expect(await page.evaluate(() => MapElementsPanel.active), 'the find is still open').toBe(true);
    await expect(panel(page).locator('.mapel-count')).toHaveText('3 places found');
    expect(await highlightPlaces(page), 'the outlines are the find\'s, not cleared').toEqual([[3, 4], [10, 4], [20, 15]]);
});

test('Accept after the block has gone from the picture says so and shows the find as it is now', async ({ page }) => {
    await boot(page);
    await paintCircles(page);
    await select(page, 3, 4);
    await page.keyboard.press('Control+f');
    await expect(panel(page).locator('.mapel-count')).toContainText('3 places found');
    // draw over every red circle without closing the find
    await page.evaluate(() => {
        const layer = LayerManager.getCurrentLayer();
        for (const [cx, cy] of [[3, 4], [10, 4], [20, 15]]) layer.getCell(cx, cy).pixels.fill(0xFF);
        LayerManager.composeToCanvas();
    });
    const p = notice(page);
    await page.waitForTimeout(50);
    await panel(page).locator('.mapel-accept').click();
    expect(await p).toBe('The block is no longer on the picture, so there is nothing to store.');
    expect(await page.evaluate(() => MapService.getElements().length)).toBe(0);
    await expect(panel(page).locator('.mapel-count')).toHaveText('0 places found');
    expect(await highlightPlaces(page), 'no outlines on places that no longer match').toEqual([]);
});

test('a 2 x 2 block is found where it repeats; Escape cancels and puts the keys back on the picture', async ({ page }) => {
    await boot(page);
    await page.evaluate((rows) => {
        const layer = LayerManager.getCurrentLayer();
        for (const [ox, oy] of [[1, 1], [12, 9], [20, 20]]) for (let k = 0; k < 4; k++) {
            const c = layer.getCell(ox + (k % 2), oy + (k >> 1));
            c.pixels.set(rows.map(b => b ^ (k * 17)));
            Object.assign(c, { ink: k + 1, paper: 7, bright: false, flash: false, altered: true });
        }
        LayerManager.composeToCanvas();
    }, CIRCLE);
    await select(page, 1, 1, 2, 2);
    await page.keyboard.press('Control+f');
    await expect(panel(page).locator('.mapel-count')).toContainText('3 places found');
    await page.keyboard.press('Escape');
    await expect(panel(page).locator('.mapel-find')).toBeHidden();
    expect(await page.evaluate(() => MapService.getElements().length)).toBe(0);
    await page.keyboard.press('e');
    expect(await page.evaluate(() => StateManager.getCurrentTool()), 'the tool keys work again').toBe('eraser');
});

test('keyboard only: Ctrl+F puts focus on the mode, Tab reaches Accept and Enter stores', async ({ page }) => {
    await boot(page);
    await paintCircles(page);
    await select(page, 3, 4);
    await page.keyboard.press('Control+f');
    expect(await page.evaluate(() => document.activeElement.id)).toBe('mapel-mode');
    await page.keyboard.press('ArrowDown');
    await expect(panel(page).locator('.mapel-count')).toContainText('4 places found');
    await page.keyboard.press('ArrowUp');
    for (let i = 0; i < 3; i++) await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement.className)).toContain('mapel-accept');
    await page.keyboard.press('Enter');
    expect(await page.evaluate(() => MapService.getElements().length)).toBe(1);
});

test('Find says why it cannot start: no selection, a floating piece, a mode without 8x8 colour cells', async ({ page }) => {
    await boot(page);
    await paintCircles(page);
    page.on('dialog', (d) => d.accept());
    await page.evaluate(() => SelectionService.clear());
    let p = notice(page);
    await page.waitForTimeout(50);
    await page.keyboard.press('Control+f');
    expect(await p).toContain('Select a block');
    await select(page, 3, 4);
    await selectMode(page, 'layer2_256');
    await select(page, 3, 4);
    p = notice(page);
    await page.waitForTimeout(50);
    await page.keyboard.press('Control+f');
    expect(await p).toContain('8x8 attribute cells');
    await expect(panel(page).locator('.mapel-find')).toBeHidden();
});

test('the Edit menu row exists and starts the find; the View menu shows the panel', async ({ page }) => {
    await boot(page);
    await paintCircles(page);
    await select(page, 3, 4);
    await page.click('.menu-item[data-menu="edit"] .menu-label');
    await page.click('.menu-action[data-action="edit:findMapElement"]');
    await expect(panel(page).locator('.mapel-count')).toContainText('3 places found');
    await page.click('.mapel-cancel');
    await page.click('.menu-item[data-menu="view"] .menu-label');
    await page.click('.menu-action[data-action="view:toggleMapElements"]');
    await expect(panel(page)).toBeHidden();
});

test('find works in the modes with cell attributes, Timex hi-res offers no exact', async ({ page }) => {
    await boot(page);
    page.on('dialog', (d) => d.accept());
    for (const mode of ['standard_ula', 'ula_plus', 'ulanext', 'gigascreen', 'timex_hires']) {
        await selectMode(page, mode);
        const modes = await page.evaluate(() => MapService.findModes());
        expect(modes.length, mode).toBeGreaterThan(0);
        expect(modes.includes('exact'), mode).toBe(mode !== 'timex_hires');
    }
    for (const mode of ['multicolor_8x4', 'layer2_256', 'lores']) {
        await selectMode(page, mode);
        expect(await page.evaluate(() => MapService.findModes()), mode).toEqual([]);
    }
});

test('landscape phone: the panel can be reached and Accept is on screen', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
    const page = await ctx.newPage();
    await boot(page);
    await paintCircles(page);
    await select(page, 3, 4);
    await page.evaluate(() => MapElementsPanel.startFind());
    const accept = panel(page).locator('.mapel-accept');
    await accept.scrollIntoViewIfNeeded();
    const box = await accept.boundingBox();
    expect(box && box.x >= 0 && box.x + box.width <= 844 + 1).toBe(true);
    await accept.tap();
    expect(await page.evaluate(() => MapService.getElements().length)).toBe(1);
    await ctx.close();
});
