'use strict';
/**
 * A saved .pixula stores compact grids, and reopens to the same picture.
 *
 * Found 2026-09-28: File > Save wrote every layer as one object per 8x8 cell,
 * kept "for older builds" - but every released build reads compact grids
 * (0.1.0-alpha.1 already did). A 32-layer LAYER2_640 document took 2 s to
 * save and 1.7 s to open; compact, 0.6 s and 0.4 s, and a ninth of the file.
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

/** Fill a few layers with a pattern, in `mode`. */
const draw = (page, mode) => page.evaluate((mode) => {
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
}, mode);

/** A fingerprint of every layer's grid. */
const fingerprint = (page) => page.evaluate(() => LayerManager.layers.map((l) => {
    const p = l.packAttributeData();
    return Object.keys(p).filter((k) => p[k] && p[k].BYTES_PER_ELEMENT)
        .map((k) => `${k}:${p[k].reduce((h, v) => (h * 31 + v) | 0, 7)}`).join(' ');
}));

/** Replace the document with a blank one, then open `bytes` as File > Open does. */
const reopen = (page, bytes) => page.evaluate(async (bytes) => {
    FileManager.hasUnsavedChanges = false;
    await FileManager.newFile();
    await FileManager.loadFile(new File([new Uint8Array(bytes)], 'Castle.pixula'));
}, bytes);

for (const mode of ['standard_ula', 'layer2_256', 'gigascreen']) {
    test(`${mode}: a saved file holds compact grids and reopens the same`, async ({ page }) => {
        await boot(page);
        await draw(page, mode);
        const before = await fingerprint(page);
        const saved = await page.evaluate(async () => {
            const bytes = await ProjectFormat.export();
            const project = await ProjectFormat.decode(bytes);
            return { bytes: Array.from(bytes), packed: project.layers.every((l) => l.attributeData.packed === true) };
        });
        expect(saved.packed).toBe(true);
        await reopen(page, saved.bytes);
        expect(await page.evaluate(() => ScreenModeService.getModeId())).toBe(mode);
        expect(await fingerprint(page)).toEqual(before);
    });
}

test('a file saved the old (plain) way still opens', async ({ page }) => {
    await boot(page);
    await draw(page, 'layer2_256');
    const before = await fingerprint(page);
    const bytes = await page.evaluate(async () => Array.from(await ProjectFormat.encode(App._getProjectData())));
    await reopen(page, bytes);
    expect(await fingerprint(page)).toEqual(before);
});
