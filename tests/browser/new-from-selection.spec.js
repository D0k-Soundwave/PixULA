'use strict';
/**
 * Batch 9 part 9B step 1 in a real browser: Edit > Fit Selection to Cells and Edit > New Picture from Selection (enabled only
 * with a selection and nothing floating; asks first; the notice for the fitted size). The crop itself is pinned in Node
 * (tests/new-from-selection.test.js).
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

const itemDisabled = (page, id) => page.evaluate((i) => document.querySelector(`[data-id="${i}"]`).classList.contains('disabled'), id);
async function openEdit(page) {
    await page.click('[data-menu="edit"]');
}

test('the two items are shut without a selection and open with one', async ({ page }) => {
    await boot(page);
    await openEdit(page);
    expect(await itemDisabled(page, 'selection-to-cells')).toBe(true);
    expect(await itemDisabled(page, 'new-from-selection')).toBe(true);
    await page.keyboard.press('Escape');
    await page.evaluate(() => SelectionService.setSelection({ x: 3, y: 3, width: 20, height: 12 }));
    await openEdit(page);
    expect(await itemDisabled(page, 'selection-to-cells')).toBe(false);
    expect(await itemDisabled(page, 'new-from-selection')).toBe(false);
    await page.keyboard.press('Escape');
});

test('Fit Selection to Cells snaps the selection and says so', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => SelectionService.setSelection({ x: 3, y: 3, width: 20, height: 12 }));
    await openEdit(page);
    await page.click('[data-id="selection-to-cells"]');
    expect(await page.evaluate(() => { const s = SelectionService.getSelection(); return [s.x, s.y, s.width, s.height]; })).toEqual([0, 0, 24, 16]);
});

test('New Picture from Selection asks first; declining changes nothing, accepting keeps the block at the top left', async ({ page }) => {
    await boot(page);
    let asked = 0, answer = false;
    page.on('dialog', async (d) => { asked++; if (answer) await d.accept(); else await d.dismiss(); });
    await page.evaluate(() => {
        PixelDrawRoutine.beginBatch('t');
        PixelDrawRoutine.draw(70, 50, ColorManager.getCurrentSelection(), DRAW_MODE.NORMAL);
        PixelDrawRoutine.endBatch();
        SelectionService.setSelection({ x: 64, y: 48, width: 16, height: 8 });
    });
    await openEdit(page);
    await page.click('[data-id="new-from-selection"]');
    await page.waitForTimeout(200);
    expect(asked).toBe(1);
    expect(await page.evaluate(() => LayerManager.getCurrentLayer().getCell(8, 6).pixels.some((r) => r))).toBe(true);
    answer = true;
    await openEdit(page);
    await page.click('[data-id="new-from-selection"]');
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => LayerManager.getCurrentLayer().getCell(8, 6).pixels.some((r) => r)), 'moved away from its old place').toBe(false);
    expect(await page.evaluate(() => LayerManager.getCurrentLayer().getCell(0, 0).pixels.some((r) => r)), 'now at the top left').toBe(true);
    expect(await page.evaluate(() => SelectionService.hasSelection())).toBe(false);
});
