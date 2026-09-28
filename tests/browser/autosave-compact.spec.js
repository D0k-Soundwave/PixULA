'use strict';
/**
 * Autosave writes compact grids, fast, and they restore exactly.
 *
 * Found 2026-09-27: autosave stored every layer as one object per 8x8 cell.
 * A 32-layer LAYER2_640 document made a ~50 MB record and froze the app for
 * about a second on every tick. It now stores the compact form undo already
 * uses, which restores to the same picture - and records written the old way
 * still restore.
 */
const { test, expect } = require('@playwright/test');
const { boot, reload } = require('./helpers');

/** Fill a few layers with a pattern, in `mode`. */
const draw = (page, mode) => page.evaluate(async (mode) => {
    ScreenModeService.applyModeRaw(mode);
    LayerManager.reset();
    for (let n = 2; n <= 4; n++) LayerManager.addLayer(`Layer ${n}`, false);
    for (let i = 1; i < LayerManager.layers.length; i++) {
        for (let k = 0; k < 40; k++) {
            PixelDrawRoutine.draw((k * 7 + i * 13) % ZX_SPECTRUM.WIDTH, (k * 5 + i * 3) % ZX_SPECTRUM.HEIGHT,
                ColorManager.getCurrentSelection(), DRAW_MODE.NORMAL, { layer: LayerManager.layers[i] });
        }
    }
    LayerManager.composeToCanvas();
    FileManager.hasUnsavedChanges = true;
}, mode);

/** A fingerprint of every layer's grid. */
const fingerprint = (page) => page.evaluate(() => LayerManager.layers.map((l) => {
    const p = l.packAttributeData();
    return Object.keys(p).filter((k) => p[k] && p[k].BYTES_PER_ELEMENT)
        .map((k) => `${k}:${p[k].reduce((h, v) => (h * 31 + v) | 0, 7)}`).join(' ');
}));

for (const mode of ['standard_ula', 'layer2_256', 'gigascreen']) {
    test(`${mode}: the autosave record is compact and restores the same picture`, async ({ page }) => {
        await boot(page);
        await draw(page, mode);
        const before = await fingerprint(page);
        const record = await page.evaluate(async () => {
            await App._autosaveNow();
            const r = await Storage.get('autosave');
            return { packed: r.layers.every((l) => l.attributeData && l.attributeData.packed === true), n: r.layers.length };
        });
        expect(record).toEqual({ packed: true, n: before.length });

        page.on('dialog', (d) => d.accept()); // restore it
        await reload(page);
        expect(await page.evaluate(() => ScreenModeService.getModeId())).toBe(mode);
        expect(await fingerprint(page)).toEqual(before);
    });
}

test('an autosave written the old way still restores', async ({ page }) => {
    await boot(page);
    await draw(page, 'layer2_256');
    const before = await fingerprint(page);
    await page.evaluate(async () => Storage.set('autosave', App._getProjectData()));
    page.on('dialog', (d) => d.accept());
    await reload(page);
    expect(await fingerprint(page)).toEqual(before);
});

test('a 32-layer LAYER2_640 autosave does not freeze the app', async ({ page }) => {
    await boot(page);
    const ms = await page.evaluate(async () => {
        ScreenModeService.applyModeRaw('layer2_640');
        LayerManager.reset();
        while (LayerManager.getLayerCount() < 32) if (!LayerManager.addLayer(null, false)) break;
        FileManager.hasUnsavedChanges = true;
        // What the old record cost on THIS machine, as the yardstick
        let t0 = performance.now();
        await Storage.set('autosave-old', App._getProjectData());
        const old = performance.now() - t0;
        await Storage.delete('autosave-old');
        t0 = performance.now();
        await App._autosaveNow();
        return { old, now: performance.now() - t0 };
    });
    expect(ms.now).toBeLessThan(ms.old / 3);
});
