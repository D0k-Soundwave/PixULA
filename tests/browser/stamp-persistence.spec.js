'use strict';
/**
 * Stamps, and each layer's XOR setting, survive a saved project, an autosave
 * restore, and a stamp being mid-drag when the save happens.
 *
 * Found 2026-09-27: neither was written to the project at all, so every stamp
 * in the Stamps panel reopened - from a .pixula, from autosave, from a folder
 * backup - as an empty plain layer, and its shape was gone for good.
 *
 * Found 2026-09-28 (review of that fix): a stamp below a drawing layer - an
 * order Move Up and Delete Layer could make - still reopened every stamp
 * empty; a demoted stamp kept its XOR switch; a damaged `indices` stopped the
 * load halfway; and new stamps reused the names of reopened ones.
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
    const s = SelectionService.getStampData(l);
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
    // The real autosave, compact grids and all
    const packed = await page.evaluate(async () => {
        FileManager.hasUnsavedChanges = true;
        await App._autosaveNow();
        const record = await Storage.get('autosave');
        return record.layers.every((l) => l.attributeData.packed === true);
    });
    expect(packed).toBe(true);

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

/** The current layers' data with a stamp, in the order `order` gives. */
const withOrder = (page, order) => page.evaluate((order) => {
    const text = ToolManager.getTool(TOOLS.TEXT);
    const m = text._buildTextMask('HI', 'ZX ROM', false, false, 'horizontal');
    SelectionService.startFloatingPasteFromMask(m.pixels, m.width, m.height, 8, 8, 'Hi');
    SelectionService.endFloatingPaste();
    LayerManager.setLayerXorMode(2, true);
    const data = App._getProjectData().layers; // [Background, Layer 1, Stamp 1]
    LayerManager.restoreFromData(order.map((i) => data[i]));
    return LayerManager.layers.map((l) => `${l.name}:${l.isStamp ? 'stamp' : 'layer'}${l.xorMode ? ':xor' : ''}` +
        (l.stamp ? `:${l.stamp.mask.flat().filter(Boolean).length}px` : ''));
}, order);

test('a stamp below a drawing layer comes back on top, not emptied', async ({ page }) => {
    await boot(page);
    const pixels = await page.evaluate(() => ToolManager.getTool(TOOLS.TEXT)
        ._buildTextMask('HI', 'ZX ROM', false, false, 'horizontal').pixels.flat().filter(Boolean).length);
    expect(await withOrder(page, [0, 2, 1])).toEqual(
        ['Background:layer', 'Layer 1:layer', `Stamp 1:stamp:xor:${pixels}px`]);
});

test('stamps with no drawing layer get one to stamp onto', async ({ page }) => {
    await boot(page);
    const layers = await withOrder(page, [0, 2]);
    expect(layers.map((l) => l.replace(/:\d+px$/, ''))).toEqual(
        ['Background:layer', 'Layer 1:layer', 'Stamp 1:stamp:xor']);
});

test('Move Up and Delete Layer cannot put a stamp below a drawing layer', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(() => {
        const text = ToolManager.getTool(TOOLS.TEXT);
        const m = text._buildTextMask('HI', 'ZX ROM', false, false, 'horizontal');
        SelectionService.startFloatingPasteFromMask(m.pixels, m.width, m.height, 8, 8, 'Hi');
        SelectionService.endFloatingPaste();
        const names = () => LayerManager.layers.map((l) => l.name).join(',');
        LayerManager.moveLayerUp(1);          // Layer 1 would pass Stamp 1
        const afterUp = names();
        LayerManager.moveLayerDown(2);        // Stamp 1 would pass Layer 1
        const afterDown = names();
        const removed = LayerManager.removeLayer(1); // the only drawing layer
        return { afterUp, afterDown, removed, after: names() };
    });
    expect(r).toEqual({
        afterUp: 'Background,Layer 1,Stamp 1',
        afterDown: 'Background,Layer 1,Stamp 1',
        removed: false,
        after: 'Background,Layer 1,Stamp 1'
    });
});

test('a stamp that cannot load keeps no XOR switch, and damaged parts do not stop the load', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(() => {
        const data = App._getProjectData().layers; // [Background, Layer 1]
        const good = { x: 0, y: 0, w: 2, h: 1, mask: [[true, false]] };
        data.push({ ...data[1], name: 'Broken', isStamp: true, xorMode: true, stamp: { ...good, mask: [[true]] } });
        data.push({ ...data[1], name: 'Plain', xorMode: true });
        data.push({ ...data[1], name: 'Odd indices', isStamp: true, stamp: { ...good, indices: {} } });
        data.push({ ...data[1], name: 'Null row', isStamp: true, stamp: { ...good, indices: [null] } });
        LayerManager.restoreFromData(data);
        return LayerManager.layers.map((l) => `${l.name}:${l.isStamp ? 'stamp' : 'layer'}:${l.xorMode}` +
            (l.isStamp ? `:${l.stamp.indices === null ? 'no-indices' : 'indices'}` : ''));
    });
    expect(r).toEqual([
        'Background:layer:false', 'Layer 1:layer:false', 'Broken:layer:false', 'Plain:layer:false',
        'Odd indices:stamp:false:no-indices', 'Null row:stamp:false:no-indices'
    ]);
});

test('a new stamp takes the next free name after a project with stamps opens', async ({ page }) => {
    await boot(page);
    const name = await page.evaluate(async () => {
        const text = ToolManager.getTool(TOOLS.TEXT);
        const m = text._buildTextMask('HI', 'ZX ROM', false, false, 'horizontal');
        for (let i = 0; i < 2; i++) {
            SelectionService.startFloatingPasteFromMask(m.pixels, m.width, m.height, 8, 8, 'Hi');
            SelectionService.endFloatingPaste();
        }
        const project = App._getProjectData(); // Stamp 1, Stamp 2
        SelectionService._stampCounter = 0;    // a fresh session
        await App._loadProjectData(project);
        SelectionService.startFloatingPasteFromMask(m.pixels, m.width, m.height, 8, 8, 'Hi');
        return SelectionService.floatingPaste.floatingLayer.name;
    });
    expect(name).toBe('Stamp 3');
});
