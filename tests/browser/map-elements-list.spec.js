'use strict';
/**
 * Batch 11B2 in a real browser: the element list (Show, Delete), the elements' own pictures (Shift+M) matching what the canvas shows, drawing on a
 * covered place (allowed, hidden), and the question when a New picture would abandon elements.
 */
const { test, expect } = require('@playwright/test');
const { boot, selectMode } = require('./helpers');

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
const panel = (page) => page.locator('#map-elements-panel');

test('the list shows the element, Show outlines and selects its places in turn, Delete asks first', async ({ page }) => {
    await setup(page);
    page.once('dialog', (d) => d.dismiss());
    await panel(page).locator('.mapel-item').waitFor();
    await expect(panel(page).locator('.mapel-item-label')).toContainText('Element 1: 1 x 1 cells, 3 places');
    await panel(page).locator('.mapel-show').click();
    expect(await page.evaluate(() => SelectionService.getSelection().x / 8)).toBe(3);
    await panel(page).locator('.mapel-show').click();
    expect(await page.evaluate(() => SelectionService.getSelection().x / 8)).toBe(10);
    // Delete: dismissed -> kept
    await panel(page).locator('.mapel-delete').click();
    expect(await page.evaluate(() => MapService.getElements().length)).toBe(1);
    page.once('dialog', (d) => d.accept());
    await panel(page).locator('.mapel-delete').click();
    expect(await page.evaluate(() => MapService.getElements().length)).toBe(0);
    await expect(panel(page).locator('.mapel-item')).toHaveCount(0);
});

for (const mode of ['standard_ula', 'gigascreen']) {
    test(`Shift+M shows the element's own picture, equal to what the canvas shows (${mode})`, async ({ page }) => {
        await boot(page);
        page.on('dialog', (d) => d.accept());
        await selectMode(page, mode);
        await page.evaluate((rows) => {
            const layer = LayerManager.getCurrentLayer();
            for (const [cx, cy, ink] of [[3, 4, 2], [10, 4, 2]]) {
                const c = layer.getCell(cx, cy);
                c.pixels.set(rows);
                if (c.pixelsB) c.pixelsB.set(rows.map(b => b ^ 0x0F));
                Object.assign(c, { ink, paper: 7, bright: false, flash: false, altered: true });
                if (c.pixelsB) Object.assign(c, { inkB: 1, paperB: 6, brightB: false, flashB: false });
            }
            LayerManager.composeToCanvas();
            SelectionService.setSelection({ x: 24, y: 32, width: 8, height: 8 });
        }, CIRCLE);
        await page.keyboard.press('Control+f');
        await page.locator('.mapel-accept').click();
        // the canvas as drawn BEFORE the covers matter (main canvas is never touched by them)
        const same = async () => page.evaluate(() => {
            const main = CanvasSystem.canvas.getContext('2d').getImageData(24, 32, 8, 8).data;
            const ov = CanvasSystem.getCanvasElement('map-element-canvas').getContext('2d').getImageData(80, 32, 8, 8).data;
            // place 2 is cell (10,4) = pixel (80,32); it shows the element's picture, which came from cell (3,4)
            for (let i = 0; i < main.length; i += 4) if (main[i] !== ov[i] || main[i + 1] !== ov[i + 1] || main[i + 2] !== ov[i + 2] || ov[i + 3] !== 255) return false;
            return true;
        });
        expect(await page.evaluate(() => MapElementOverlay.pictures)).toBe(false);
        await page.keyboard.press('Shift+M');
        expect(await page.evaluate(() => MapElementOverlay.pictures)).toBe(true);
        expect(await same(), 'the element picture equals the source cell on the canvas').toBe(true);
        await page.click('.menu-item[data-menu="view"] .menu-label');
        await expect(page.locator('.menu-action[data-action="view:toggleMapElementPictures"]')).toHaveAttribute('aria-checked', 'true');
        await page.click('.menu-action[data-action="view:toggleMapElementPictures"]');
        expect(await page.evaluate(() => MapElementOverlay.pictures), 'the menu row switches it back').toBe(false);
    });
}

test('Shift+M with no elements says so', async ({ page }) => {
    await boot(page);
    const p = page.evaluate(() => new Promise((r) => { EventBus.on(EVENTS.STATUS_NOTICE, (d) => r(d.text)); setTimeout(() => r(null), 1500); }));
    await page.waitForTimeout(50);
    await page.keyboard.press('Shift+M');
    expect(await p).toContain('No map elements');
});

test('drawing on a covered place is allowed: the picture under the cover changes', async ({ page }) => {
    await setup(page);
    const before = await page.evaluate(() => Array.from(LayerManager.getCurrentLayer().getCell(10, 4).pixels).join());
    await page.evaluate(() => { StateManager.setCurrentTool && 0; ToolManager.selectTool('brush'); });
    const box = await page.frameLocator('#canvas-frame').locator('#main-canvas').boundingBox();
    const dims = await page.evaluate(() => ({ w: ZX_SPECTRUM.WIDTH, h: ZX_SPECTRUM.HEIGHT }));
    const x = box.x + (80 + 4.5) * box.width / dims.w, y = box.y + (32 + 4.5) * box.height / dims.h;
    await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.up();
    const after = await page.evaluate(() => Array.from(LayerManager.getCurrentLayer().getCell(10, 4).pixels).join());
    expect(after).not.toBe(before);
    expect(await page.evaluate(() => MapElementOverlay.describe().covers.length), 'the cover is still there').toBe(3);
});

test('New picture asks before abandoning elements; No keeps everything, Yes clears them', async ({ page }) => {
    await setup(page);
    await page.evaluate(() => { FileManager.hasUnsavedChanges = false; });
    const asked = [];
    page.on('dialog', (d) => { asked.push(d.message()); d.dismiss(); });
    await page.evaluate(() => FileManager.newFile());
    expect(asked.some(m => /3?\s*map element/i.test(m) || /1 map element/i.test(m))).toBe(true);
    expect(await page.evaluate(() => MapService.getElements().length), 'No keeps them').toBe(1);
    page.removeAllListeners('dialog');
    page.on('dialog', (d) => d.accept());
    await page.evaluate(() => FileManager.newFile());
    expect(await page.evaluate(() => MapService.getElements().length), 'Yes clears them').toBe(0);
});
