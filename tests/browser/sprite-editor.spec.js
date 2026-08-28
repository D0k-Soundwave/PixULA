'use strict';
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

test('Sprite Editor Save as Stamp creates a draggable stamp layer, not an immediate write',
    async ({ page }) => {
        await boot(page);
        page.on('dialog', (d) => d.accept()); // lossy mode-switch confirm
        await page.evaluate(() => ScreenModeService.switchMode('layer2_256'));

        await page.evaluate(() => SpriteEditorDialog.open());
        // Paint a single opaque pixel into sprite 0 so the stamp isn't empty
        await page.evaluate(() => {
            const spr = SpriteService.getSprite(0);
            spr[0] = 5; // some non-transparent index
        });

        const before = await page.evaluate(() => LayerManager.layers.length);
        await page.click('.se-save-stamp');
        const after = await page.evaluate(() => ({
            layerCount: LayerManager.layers.length,
            isFloating: SelectionService.isFloating(),
            hasIndices: !!(SelectionService.floatingPaste && SelectionService.floatingPaste.indices)
        }));

        expect(after.layerCount).toBe(before + 1); // one new stamp layer, nothing baked in yet
        expect(after.isFloating).toBe(true);
        expect(after.hasIndices).toBe(true);
    });

test('Sprite Editor Save as Stamp is disabled outside indexed modes', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => SpriteEditorDialog.open());
    const disabled = await page.evaluate(() => document.querySelector('.se-save-stamp').disabled);
    expect(disabled).toBe(false); // button itself stays enabled; click shows the mode message
    const r = await page.evaluate(() => SpriteService.saveAsStamp(0));
    expect(r).toBe(false); // standard_ula is the boot default, not indexed
});
