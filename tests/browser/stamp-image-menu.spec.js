'use strict';
/**
 * Image > Flip / Rotate / Invert Dots while a stamp floats (found by the group A review): they act on
 * the STAMP (SelectionService.transformStamp), not on the picture. Before, they wrote the transform into
 * the stamp layer's preview cells - Invert Dots filled it with a screen of dots the stamp would never
 * place - and added an undo step that undid nothing.
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

const floatL = (page) => page.evaluate(() => {
    // an L: top row and left column set, the bottom-right cell clear
    const mask = [[true, true], [true, false]];
    SelectionService.startFloatingPasteFromMask(mask, 2, 2, 40, 40, 'test', null, 'none');
});

const stampMask = (page) => page.evaluate(() => SelectionService.floatingPaste.pixels.map((r) => r.map((v) => (v ? 1 : 0)).join('')).join('/'));

const alteredCells = (page) => page.evaluate(() => {
    let n = 0;
    for (const layer of LayerManager.layers) {
        if (layer.isBackground) continue;
        for (let cy = 0; cy < ZX_SPECTRUM.GRID_ROWS; cy++) {
            for (let cx = 0; cx < ZX_SPECTRUM.GRID_COLS; cx++) if (layer.isCellAltered(cx, cy)) n++;
        }
    }
    return n;
});

async function imageMenu(page, id) {
    await page.click('.menu-item[data-menu="image"] .menu-label');
    await page.click(`#menu-image [data-id="${id}"]`);
}

test('Image > Flip Horizontal turns the stamp, and writes nothing into the picture', async ({ page }) => {
    await boot(page);
    await floatL(page);
    const cellsBefore = await alteredCells(page);
    expect(await stampMask(page)).toBe('11/10');
    await imageMenu(page, 'flip-h');
    expect(await stampMask(page), 'mirrored left-right').toBe('11/01');
    await imageMenu(page, 'rotate-180');
    expect(await stampMask(page), 'then turned half way round').toBe('10/11');
    expect(await alteredCells(page), 'no cell of the picture or a layer changed').toBe(cellsBefore);
});

test('Image > Invert Dots inverts the stamp, not a screenful of preview dots', async ({ page }) => {
    await boot(page);
    await floatL(page);
    const cellsBefore = await alteredCells(page);
    await imageMenu(page, 'invert');
    expect(await stampMask(page), 'the L became its complement').toBe('00/01');
    expect(await alteredCells(page)).toBe(cellsBefore);
});

test('with no stamp the same items still act on the picture', async ({ page }) => {
    await boot(page);
    const before = await alteredCells(page);
    await imageMenu(page, 'invert');
    expect(await alteredCells(page), 'Invert Dots fills the layer, as it always did').toBeGreaterThan(before);
});
