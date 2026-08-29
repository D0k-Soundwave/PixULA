'use strict';
/**
 * Layer > Merge Down must recompose the canvas (Part D of the LayerManager
 * cell-merge consolidation, js/core/layer-manager.js). Before the fix,
 * `mergeDown` mutated layer cell data directly — a documented bulk-write
 * exception to the PixelDrawRoutine gate, same class as an io/* codec
 * import or an undo restore — but never called `requestComposition()`, so
 * the recompose was never even SCHEDULED for the next render frame.
 * Content that had not already been painted by an earlier live draw stroke
 * (e.g. cells written by a bulk-write path, exactly as this spec stamps
 * them) never appeared on the canvas at all, regardless of how many
 * animation frames passed.
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

test('Merge Down schedules a recompose so the merged pixels reach the canvas', async ({ page }) => {
    await boot(page);

    const setup = await page.evaluate(() => {
        // Reset to a known background + 1 drawing layer state — boot() may
        // have restored a multi-layer autosave from an earlier spec run, and
        // mergeDown always targets "the layer below", not literally index 1.
        LayerManager.initialize();

        // Stamp cell (0,0) directly on layer 1 and a new layer 2 — mirroring
        // a bulk-write exception (io/* codecs, restore paths): cell data is
        // set and marked altered WITHOUT going through PixelDrawRoutine.draw,
        // so nothing has composited these two cells onto the canvas yet.
        const l1 = LayerManager.getLayer(1);
        const c1 = l1.getCell(0, 0);
        c1.pixels[0] = 0xF0;
        c1.ink = 2; c1.paper = 7; c1.bright = false; c1.altered = true;

        const layer2 = LayerManager.addLayer('Merge test layer');
        const c2 = layer2.getCell(0, 0);
        c2.pixels[0] = 0x0F;
        c2.ink = 4; c2.paper = 7; c2.bright = false; c2.altered = true;

        const expectedInkRGB = Array.from(ColorManager.getRGB(4)); // upper layer's ink wins
        const ok = LayerManager.mergeDown(layer2.index);

        return { ok, expectedInkRGB };
    });
    expect(setup.ok).toBe(true);

    // Let the RAF-batched render pipeline run — the same wait any real draw
    // stroke's recompose needs. What Part D fixes is that a recompose gets
    // SCHEDULED at all; nothing beyond a render frame should be required.
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));

    const pixels = await page.evaluate(() => {
        const doc = document.getElementById('canvas-frame').contentDocument;
        const ctx = doc.getElementById('main-canvas').getContext('2d');
        const px = (x, y) => Array.from(ctx.getImageData(x, y, 1, 1).data.slice(0, 3));
        // Both halves of the OR-stacked byte (0xF0 | 0x0F = 0xFF) are ink.
        return { left: px(0, 0), right: px(7, 0) };
    });

    expect(pixels.left).toEqual(setup.expectedInkRGB);
    expect(pixels.right).toEqual(setup.expectedInkRGB);
});
