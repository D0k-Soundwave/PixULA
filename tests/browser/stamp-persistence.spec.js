'use strict';
/**
 * Stamps, and each layer's XOR setting, survive a saved project, an autosave
 * restore, and a stamp being mid-drag when the save happens.
 *
 * Found 2026-09-27: neither was written to the project at all, so every stamp
 * in the Stamps panel reopened - from a .pixula, from autosave, from a folder
 * backup - as an empty plain layer, and its shape was gone for good.
 */
const { test, expect } = require('@playwright/test');
const { boot, reload } = require('./helpers');

/** "HELLO" in the ROM font, parked in the Stamps panel; a second stamp left floating. */
const makeStamps = (page) => page.evaluate(() => {
    const text = ToolManager.getTool(TOOLS.TEXT);
    const hello = text._buildTextMask('HELLO', 'ZX ROM', false, false, 'horizontal');
    SelectionService.startFloatingPasteFromMask(hello.pixels, hello.width, hello.height, 96, 80, 'Greeting');
    // Per-cell colours, as a Map Editor stamp carries (one byte per 8x8 cell,
    // placed on the cell grid)
    SelectionService.floatingPaste.attrs = [0x47, 0x0A, 0x47, 0x0A, 0x47];
    SelectionService.endFloatingPaste();
    LayerManager.setLayerXorMode(LayerManager.layers.length - 1, true);
    const hi = text._buildTextMask('HI', 'ZX ROM', false, false, 'horizontal');
    SelectionService.startFloatingPasteFromMask(hi.pixels, hi.width, hi.height, 40, 40, 'Hi');
    SelectionService.moveFloatingPaste(48, 56); // still floating: not parked yet
});

/** Each layer, with a stamp's data read live if it is the one floating. */
const describe = (page) => page.evaluate(() => LayerManager.layers.map((l) => {
    const s = SelectionService._getStampData(l);
    return {
        name: l.name,
        isStamp: l.isStamp,
        xorMode: l.xorMode,
        pixels: s ? s.mask.flat().filter(Boolean).length : 0,
        at: s ? [s.x, s.y, s.w, s.h] : null,
        attrs: s ? s.attrs : null
    };
}));

const inkShown = (page) => page.evaluate(() => {
    let ink = 0;
    for (let y = 0; y < ZX_SPECTRUM.HEIGHT; y++) {
        for (let x = 0; x < ZX_SPECTRUM.WIDTH; x++) {
            const s = PixelDrawRoutine.getPixelState(x, y);
            if (s && s.isInk) ink++;
        }
    }
    return ink;
});

test('a .pixula keeps stamps, their colours and XOR, and they still stamp', async ({ page }) => {
    await boot(page);
    page.on('dialog', (d) => d.accept());
    await makeStamps(page);
    const before = await describe(page);
    expect(before.filter((l) => l.isStamp)).toHaveLength(2);
    // The floating stamp saves at its live position, not where it started
    expect(before[3].at.slice(0, 2)).toEqual([48, 56]);

    const bytes = await page.evaluate(async () => Array.from(await ProjectFormat.encode(App._getProjectData())));
    await page.evaluate(async (bytes) => {
        SelectionService.endFloatingPaste();
        FileManager.hasUnsavedChanges = false;
        await FileManager.newFile();
        await App._loadProjectData(await ProjectFormat.decode(new Uint8Array(bytes)));
    }, bytes);

    expect(await describe(page)).toEqual(before);
    expect(await page.locator('#stamp-list .stamp-item, #stamp-list [role=option]').count()).toBe(2);

    // Parked stamps draw nothing until used; committing one paints its shape
    expect(await inkShown(page)).toBe(0);
    const committed = await page.evaluate(() => {
        LayerManager.setLayerXorMode(2, false);
        return SelectionService.commitStamp(LayerManager.layers[2]);
    });
    expect(committed).toBe(true);
    expect(await inkShown(page)).toBe(before[2].pixels);
});

test('autosave restore keeps stamps', async ({ page }) => {
    await boot(page);
    await makeStamps(page);
    const before = await describe(page);
    await page.evaluate(async () => Storage.set('autosave', App._getProjectData()));

    page.on('dialog', (d) => d.accept()); // "Restore the autosaved work?"
    await reload(page);
    expect(await describe(page)).toEqual(before);
});

test('a project without stamps saves no stamp fields; a broken stamp loads as a layer', async ({ page }) => {
    await boot(page);
    const plain = await page.evaluate(() => App._getProjectData().layers.map((l) => Object.keys(l).sort().join()));
    expect(new Set(plain)).toEqual(new Set(['attributeData,isBackground,locked,name,opacity,visible']));

    const layers = await page.evaluate(() => {
        const data = App._getProjectData().layers;
        data.push({ ...data[1], name: 'Bad', isStamp: true, stamp: { x: 0, y: 0, w: 4, h: 2, mask: [[true]] } });
        LayerManager.restoreFromData(data);
        return LayerManager.layers.map((l) => `${l.name}:${l.isStamp}`);
    });
    expect(layers).toEqual(['Background:false', 'Layer 1:false', 'Bad:false']);
});
