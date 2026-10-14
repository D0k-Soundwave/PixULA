'use strict';
/**
 * Batch 11B3 in a real browser: map elements in files. A .zxm is the picture with its elements (Save Image As > ZXM, File > Open); a project (.pixula) and the
 * autosave keep elements; the Map Editor's .zxm stays the tile map.
 */
const { test, expect } = require('@playwright/test');
const { boot, selectMode } = require('./helpers');

const CIRCLE = [0x3C, 0x42, 0x81, 0x81, 0x81, 0x81, 0x42, 0x3C];
async function setup(page) {
    await boot(page);
    await page.evaluate((rows) => {
        const layer = LayerManager.getCurrentLayer();
        for (const [cx, cy, ink] of [[3, 4, 2], [10, 4, 2], [20, 15, 2]]) {
            const c = layer.getCell(cx, cy);
            c.pixels.set(rows);
            Object.assign(c, { ink, paper: 7, bright: false, flash: false, altered: true });
        }
        LayerManager.composeToCanvas();
        SelectionService.setSelection({ x: 24, y: 32, width: 8, height: 8 });
    }, CIRCLE);
    await page.keyboard.press('Control+f');
    await page.locator('.mapel-accept').click();
}
const dots = (page) => page.evaluate(() => {
    const l = LayerManager.flattenVisible();
    let h = 0;
    for (let cy = 0; cy < ZX_SPECTRUM.GRID_ROWS; cy++) for (let cx = 0; cx < ZX_SPECTRUM.GRID_COLS; cx++) { const c = l.getCell(cx, cy); for (const r of c.pixels) h = (h * 31 + r) >>> 0; h = (h * 7 + c.ink + c.paper * 8) >>> 0; }
    return h;
});

test('Save Image As > ZXM then File > Open brings back the picture and its elements', async ({ page }) => {
    await setup(page);
    page.on('dialog', (d) => d.accept());
    const before = await dots(page);
    const bytes = await page.evaluate(() => Array.from(FormatRegistry.getExportHandler('zxm').export()));
    expect(await page.evaluate(() => FormatRegistry.isExportCompatible('zxm'))).toBe(true);
    await page.evaluate(() => { MapService.clearElements(); LayerManager.reset ? 0 : 0; });
    await page.evaluate(async (b) => {
        await FileManager.newFile();
        const f = new File([new Uint8Array(b)], 'pic.zxm');
        await FileManager.loadFile(f);
    }, bytes);
    expect(await dots(page), 'the picture is back').toBe(before);
    const els = await page.evaluate(() => MapService.getElements().map(e => [e.w, e.h, e.positions.map(p => p.x + ',' + p.y).join(' '), e.match]));
    expect(els).toEqual([[1, 1, '3,4 10,4 20,15', 'exact']]);
    await expect(page.locator('#map-elements-panel .mapel-item')).toHaveCount(1);
});

test('ZXM is offered for Standard ULA only, and says so elsewhere', async ({ page }) => {
    await boot(page);
    page.on('dialog', (d) => d.accept());
    expect(await page.evaluate(() => FormatRegistry.isExportCompatible('zxm'))).toBe(true);
    for (const mode of ['gigascreen', 'ula_plus', 'timex_hires']) {
        await selectMode(page, mode);
        expect(await page.evaluate(() => FormatRegistry.isExportCompatible('zxm')), mode).toBe(false);
    }
});

test('elements from another screen mode are left out of a .zxm with a notice', async ({ page }) => {
    await setup(page);
    const notice = page.evaluate(() => new Promise((r) => { EventBus.on(EVENTS.STATUS_NOTICE, (d) => { if (/another screen mode/.test(d.text)) r(d.text); }); setTimeout(() => r(null), 3000); }));
    await page.waitForTimeout(50);
    await page.evaluate(() => {
        const e = MapService.getElements()[0];
        MapService.elements.push({ ...e, name: 'Other', gridW: 64 });
        FormatRegistry.getExportHandler('zxm').export();
    });
    expect(await notice).toContain('1 map elements');
});

test('a project and the autosave carry the elements; a project without them loads with none', async ({ page }) => {
    await setup(page);
    const data = await page.evaluate(() => JSON.parse(JSON.stringify(App._getProjectData({ packed: false }), Helpers.jsonTypedReplacer), Helpers.jsonTypedReviver));
    expect(data.mapElements.length).toBe(1);
    await page.evaluate(() => MapService.clearElements());
    await page.evaluate(async (d) => { await App._loadProjectData(d); }, data);
    expect(await page.evaluate(() => MapService.getElements().length)).toBe(1);
    expect(await page.evaluate(() => MapService.getElements()[0].positions.length)).toBe(3);
    const old = { ...data }; delete old.mapElements;
    await page.evaluate(async (d) => { await App._loadProjectData(d); }, old);
    expect(await page.evaluate(() => MapService.getElements().length), 'a project from before elements has none').toBe(0);
});

test('the Map Editor imports a .zxm as tiles only and keeps the picture and the elements', async ({ page }) => {
    await setup(page);
    const before = await dots(page);
    const bytes = await page.evaluate(() => Array.from(ZXMFormat.exportTileMap()));
    const res = await page.evaluate((b) => ZXMFormat.parseTileMap(new Uint8Array(b).buffer).success, bytes);
    expect(res).toBe(true);
    expect(await dots(page), 'the picture is untouched').toBe(before);
    expect(await page.evaluate(() => MapService.getElements().length)).toBe(1);
});
