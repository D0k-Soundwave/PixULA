'use strict';
/**
 * Ctrl+Z straight after File > New used to restore a partial snapshot onto the reset layer stack (untouched layers came
 * back blank, only the last-touched one kept its old pixels). A new document starts with nothing to undo.
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

test('File > New leaves nothing to undo, and Ctrl+Z after it does not bring pixels back', async ({ page }) => {
    await boot(page);
    page.on('dialog', (d) => d.accept());
    await page.evaluate(() => {
        PixelDrawRoutine.beginBatch('t');
        PixelDrawRoutine.draw(20, 20, ColorManager.getCurrentSelection(), DRAW_MODE.NORMAL);
        PixelDrawRoutine.endBatch();
    });
    expect(await page.evaluate(() => UndoRedo.canUndo())).toBe(true);
    await page.evaluate(() => FileManager.newFile());
    expect(await page.evaluate(() => UndoRedo.canUndo()), 'nothing to undo in a new document').toBe(false);
    await page.keyboard.press('Control+z');
    const ink = await page.evaluate(() => {
        let n = 0;
        for (const layer of LayerManager.layers) for (let cy = 0; cy < ZX_SPECTRUM.GRID_ROWS; cy++) for (let cx = 0; cx < ZX_SPECTRUM.GRID_COLS; cx++) {
            const c = layer.getCell(cx, cy);
            if (c) for (const r of c.pixels) n += r ? 1 : 0;
        }
        return n;
    });
    expect(ink).toBe(0);
});

test('New picture from selection can still be undone (its own action)', async ({ page }) => {
    await boot(page);
    page.on('dialog', (d) => d.accept());
    await page.evaluate(() => {
        PixelDrawRoutine.beginBatch('t');
        PixelDrawRoutine.draw(40, 40, ColorManager.getCurrentSelection(), DRAW_MODE.NORMAL);
        PixelDrawRoutine.draw(200, 150, ColorManager.getCurrentSelection(), DRAW_MODE.NORMAL);
        PixelDrawRoutine.endBatch();
        SelectionService.setSelection({ x: 36, y: 36, width: 10, height: 10 });
    });
    const dots = () => page.evaluate(() => {
        let n = 0;
        const layer = LayerManager.getCurrentLayer();
        for (let cy = 0; cy < ZX_SPECTRUM.GRID_ROWS; cy++) for (let cx = 0; cx < ZX_SPECTRUM.GRID_COLS; cx++) {
            const c = layer.getCell(cx, cy);
            if (c) for (const r of c.pixels) { let b = r; while (b) { n += b & 1; b >>= 1; } }
        }
        return n;
    });
    expect(await dots()).toBe(2);
    expect(await page.evaluate(() => FileManager.newFromSelection())).toBe(true);
    expect(await dots(), 'only the dot inside the selection is left').toBe(1);
    expect(await page.evaluate(() => [FileManager.currentFilename, FileManager.hasUnsavedChanges])).toEqual([null, true]);
    await page.keyboard.press('Control+z');
    expect(await dots(), 'Ctrl+Z gives the old picture back').toBe(2);
});
