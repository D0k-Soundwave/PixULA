'use strict';
/**
 * Group D review fixes: a cancelled or failed Open loses no elements; Accept and Delete count as unsaved work; Escape and hiding the panel put an open
 * find and the Show outlines away; a collapsed panel opens for a find; box numbers stay with their element; elements are not restored from the map store.
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

const CIRCLE = [0x3C, 0x42, 0x81, 0x81, 0x81, 0x81, 0x42, 0x3C];
async function setup(page) {
    await boot(page);
    await page.evaluate((rows) => {
        const layer = LayerManager.getCurrentLayer();
        for (const [cx, cy, ink] of [[3, 4, 2], [10, 4, 2], [20, 15, 2]]) {
            const c = layer.getCell(cx, cy);
            c.pixels.set(rows);
            Object.assign(c, { ink, paper: 7, bright: false, flash: false, altered: true });
        }
        LayerManager.composeToCanvas();
        SelectionService.setSelection({ x: 24, y: 32, width: 8, height: 8 });
    }, CIRCLE);
    await page.keyboard.press('Control+f');
    await page.locator('.mapel-accept').click();
}

test('a broken file or a cancelled Open leaves the elements alone', async ({ page }) => {
    await setup(page);
    await page.evaluate(() => { FileManager.hasUnsavedChanges = false; });
    page.on('dialog', (d) => d.accept());
    const ok = await page.evaluate(async () => FileManager.loadFile(new File([new Uint8Array(100)], 'broken.scr')));
    expect(ok).toBe(false);
    expect(await page.evaluate(() => MapService.getElements().length), 'the elements survive a file that failed to read').toBe(1);
});

test('answering No to the question keeps everything', async ({ page }) => {
    await setup(page);
    await page.evaluate(() => { FileManager.hasUnsavedChanges = false; });
    page.on('dialog', (d) => d.dismiss());
    await page.evaluate(async () => FileManager.loadFile(new File([new Uint8Array(6912)], 'blank.scr')));
    expect(await page.evaluate(() => MapService.getElements().length)).toBe(1);
});

test('Accept and Delete count as unsaved work', async ({ page }) => {
    await boot(page);
    await page.evaluate((rows) => {
        const c = LayerManager.getCurrentLayer().getCell(3, 4);
        c.pixels.set(rows); Object.assign(c, { ink: 2, paper: 7, altered: true });
        SelectionService.setSelection({ x: 24, y: 32, width: 8, height: 8 });
        FileManager.hasUnsavedChanges = false;
    }, CIRCLE);
    await page.keyboard.press('Control+f');
    await page.locator('.mapel-accept').click();
    expect(await page.evaluate(() => FileManager.hasChanges())).toBe(true);
    await page.evaluate(() => { FileManager.hasUnsavedChanges = false; });
    page.once('dialog', (d) => d.accept());
    await page.locator('.mapel-delete').click();
    expect(await page.evaluate(() => FileManager.hasChanges())).toBe(true);
});

test('Escape with the picture focused cancels an open find; hiding the panel too', async ({ page }) => {
    await setup(page);
    await page.evaluate(() => SelectionService.setSelection({ x: 24, y: 32, width: 8, height: 8 }));
    await page.keyboard.press('Control+f');
    expect(await page.evaluate(() => MapElementsPanel.active)).toBe(true);
    await page.evaluate(() => CanvasSystem.getCanvasElement('main-canvas').focus());
    await page.keyboard.press('Escape');
    expect(await page.evaluate(() => MapElementsPanel.active), 'the find is cancelled').toBe(false);
    expect(await page.evaluate(() => MapElementOverlay.describe().highlight), 'and its outlines are gone').toBeNull();
    await page.locator('.mapel-show').click();
    expect(await page.evaluate(() => !!MapElementOverlay.describe().highlight)).toBe(true);
    await page.keyboard.press('Escape');
    expect(await page.evaluate(() => MapElementOverlay.describe().highlight), 'Show outlines go with Escape').toBeNull();
    await page.keyboard.press('Control+f');
    await page.evaluate(() => PanelSection.setVisible('map-elements-panel', false));
    expect(await page.evaluate(() => MapElementsPanel.active), 'hiding the panel ends the find').toBe(false);
});

test('a collapsed panel opens when a find starts', async ({ page }) => {
    await setup(page);
    await page.evaluate(() => PanelSection.setCollapsed('map-elements-panel', true));
    await page.evaluate(() => SelectionService.setSelection({ x: 24, y: 32, width: 8, height: 8 }));
    await page.keyboard.press('Control+f');
    expect(await page.evaluate(() => PanelSection.isCollapsed('map-elements-panel'))).toBe(false);
    await expect(page.locator('.mapel-accept')).toBeVisible();
});

test('box numbers stay with their element after a delete; new names do not repeat', async ({ page }) => {
    await setup(page);
    // two more elements from other blocks
    await page.evaluate(() => {
        const l = LayerManager.getCurrentLayer();
        for (const [cx, cy] of [[1, 1], [2, 2]]) { const c = l.getCell(cx, cy); c.pixels.set([1, 2, 4, 8, 16, 32, 64, 128 ^ cx]); Object.assign(c, { ink: cx, paper: 7, altered: true }); }
    });
    for (const [x, y] of [[8, 8], [16, 16]]) {
        await page.evaluate(([x, y]) => SelectionService.setSelection({ x, y, width: 8, height: 8 }), [x, y]);
        await page.keyboard.press('Control+f');
        await page.locator('.mapel-accept').click();
    }
    expect(await page.evaluate(() => MapService.getElements().map(e => e.number).join())).toBe('1,2,3');
    page.once('dialog', (d) => d.accept());
    await page.locator('.mapel-delete').nth(1).click();
    expect(await page.evaluate(() => MapElementOverlay.describe().covers.map(c => c.n).filter((v, i, a) => a.indexOf(v) === i).join())).toBe('1,3');
    await page.evaluate(() => SelectionService.setSelection({ x: 24, y: 32, width: 8, height: 8 }));
    await page.evaluate(() => { const e = MapService.elements[0]; MapService.removeElement(0); void e; });
    const names = await page.evaluate(() => { SelectionService.setSelection({ x: 8, y: 8, width: 8, height: 8 }); MapElementsPanel.startFind(); MapElementsPanel.accept(); return MapService.getElements().map(e => e.name + '#' + e.number); });
    expect(new Set(names).size).toBe(names.length);
});

test('elements are not restored from the map store at start-up', async ({ page }) => {
    await setup(page);
    await page.evaluate(async () => { await MapService.persist(); });
    await page.evaluate(async () => { MapService.elements = []; await MapService.restorePersisted(); });
    expect(await page.evaluate(() => MapService.getElements().length)).toBe(0);
});
