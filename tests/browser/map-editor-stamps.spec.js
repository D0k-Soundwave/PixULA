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
