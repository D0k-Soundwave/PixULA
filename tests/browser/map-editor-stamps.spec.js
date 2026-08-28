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
