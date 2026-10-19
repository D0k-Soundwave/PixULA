'use strict';
/**
 * Which opens replace the picture, and what replacing it means (audit 2026-10-18: code-io SVC-1 and SVC-3, spec-p2b F2 and F3).
 * - A font or a sprite sheet opened through File > Open goes to its own editor: the picture, its map elements, its palette
 *   slots, its file name and its unsaved flag stay as they were, and nothing is asked.
 * - File > Open of a .zxm brings the picture and its elements; the Map Editor's tile map is left alone.
 * - Tape Blocks > Load replaces the picture by File > Open's rules: it asks first, the old elements go (and come back on Ctrl+Z).
 * - Tape Blocks > Add current screen in a mode with no SCREEN$ says why instead of failing silently.
 */
const { test, expect } = require('@playwright/test');
const { boot, selectMode } = require('./helpers');

const CIRCLE = [0x3C, 0x42, 0x81, 0x81, 0x81, 0x81, 0x42, 0x3C];
async function setup(page) {
    await boot(page);
    // the blank picture as a tape, for the Tape Blocks tests
    await page.evaluate(() => { window.__blankTape = TAPFormat.export({ border: 0, name: 'blank' }); });
    await page.evaluate((rows) => {
        const layer = LayerManager.getCurrentLayer();
        for (const [cx, cy, ink] of [[3, 4, 2], [10, 4, 2]]) {
            const c = layer.getCell(cx, cy);
            c.pixels.set(rows);
            Object.assign(c, { ink, paper: 7, bright: false, flash: false, altered: true });
        }
        LayerManager.composeToCanvas();
        SelectionService.setSelection({ x: 24, y: 32, width: 8, height: 8 });
    }, CIRCLE);
    await page.keyboard.press('Control+f');
    await page.locator('.mapel-accept').click();
    expect(await page.evaluate(() => MapService.getElements().length)).toBe(1);
}
const countDialogs = (page) => {
    const seen = [];
    page.on('dialog', (d) => { seen.push(d.message()); d.accept(); });
    return seen;
};
const fileState = (page) => page.evaluate(() => ({
    elements: MapService.getElements().length,
    name: FileManager.currentFilename,
    unsaved: FileManager.hasUnsavedChanges,
    slotsTouched: ColorManager.getPaletteSlotState().ulaplus64.touched
}));

for (const [label, make] of [
    ['a .ch8 font', () => ({ bytes: Array.from(FontFormat.exportFont(FontService.toDocument(), 'ch8')), name: 'myfont.ch8' })],
    ['a .chx font', () => ({ bytes: Array.from(FontFormat.exportFont(FontService.toDocument(), 'chx')), name: 'myfont.chx' })],
    ['a .spr sprite sheet', () => ({ bytes: Array.from(SpriteFormat.export()), name: 'x.spr' })]
]) {
    test(`File > Open of ${label} leaves the picture's elements, slots, name and unsaved flag alone and asks nothing`, async ({ page }) => {
        await setup(page);
        const dialogs = countDialogs(page);
        await page.evaluate(() => {
            FileManager.currentFilename = 'pic.scr';
            FileManager.hasUnsavedChanges = true;
            ColorManager._slots.ulaplus64.touched = true;
        });
        const before = await fileState(page);
        const file = await page.evaluate(make);
        const ok = await page.evaluate(async (f) => FileManager.loadFile(new File([new Uint8Array(f.bytes)], f.name)), file);
        expect(ok).toBe(true);
        expect(dialogs, 'nothing is asked').toEqual([]);
        expect(await fileState(page)).toEqual(before);
    });
}

test('File > Open of a .zxm brings its elements and leaves the Map Editor tile map alone', async ({ page }) => {
    await setup(page);
    countDialogs(page);
    const bytes = await page.evaluate(() => Array.from(ZXMFormat.exportPicture()));
    await page.evaluate(() => {
        MapService.clearElements();
        const t = MapService.createTile(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]), 0x38);
        MapService.addTile(t, false);
        MapService.setName('my level');
        MapService.setMapCell(1, 0, MapService.tileCount() - 1);
    });
    const tileMap = () => page.evaluate(() => ({ name: MapService.name, tiles: MapService.tileCount(), cell: MapService.getMapCell(1, 0), w: MapService.getMap().width }));
    const tilesBefore = await tileMap();
    expect(tilesBefore.tiles).toBeGreaterThan(0);
    const ok = await page.evaluate(async (b) => FileManager.loadFile(new File([new Uint8Array(b)], 'pic.zxm')), bytes);
    expect(ok).toBe(true);
    expect(await page.evaluate(() => MapService.getElements().length), 'the file brings its element').toBe(1);
    expect(await tileMap(), 'the tile map is not replaced').toEqual(tilesBefore);
});

/** The blank picture's tape (made before the drawing) opened in the Tape Blocks dialog. */
async function openTapeOfBlank(page) {
    await page.evaluate(() => TapeBlockDialog.open(window.__blankTape.buffer, 'blank.tap'));
    await expect(page.locator('button[data-act="load"]').first()).toBeVisible();
}
const cellDots = (page) => page.evaluate(() => Array.from(LayerManager.flattenVisible().getCell(3, 4).pixels));

test('Tape Blocks > Load asks first, and No keeps the picture and its elements', async ({ page }) => {
    await setup(page);
    await page.evaluate(() => { FileManager.hasUnsavedChanges = true; });
    await openTapeOfBlank(page);
    const asked = [];
    page.on('dialog', (d) => { asked.push(d.message()); d.dismiss(); });
    const dotsBefore = await cellDots(page);
    await page.locator('button[data-act="load"]').first().click();
    await expect.poll(() => asked.length).toBe(1);
    expect(asked[0]).toMatch(/map element/);
    expect(await cellDots(page), 'the picture stays').toEqual(dotsBefore);
    expect(await page.evaluate(() => MapService.getElements().length)).toBe(1);
});

test('Tape Blocks > Load with Yes replaces the picture, drops the old elements, and Ctrl+Z brings both back', async ({ page }) => {
    await setup(page);
    await openTapeOfBlank(page);
    countDialogs(page);
    const dotsBefore = await cellDots(page);
    await page.locator('button[data-act="load"]').first().click();
    await expect.poll(() => page.evaluate(() => MapService.getElements().length), 'the old elements go').toBe(0);
    expect(await cellDots(page), 'the tape picture is loaded').toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
    expect(await page.evaluate(() => MapElementOverlay.describe().covers.length)).toBe(0);
    expect(await page.evaluate(() => [FileManager.currentFilename, FileManager.hasUnsavedChanges]),
        'the tape picture has no file of its own: Ctrl+S must not write it over the old one').toEqual([null, true]);
    await page.evaluate(() => UndoRedo.undo());
    expect(await cellDots(page)).toEqual(dotsBefore);
    expect(await page.evaluate(() => MapService.getElements().length), 'Ctrl+Z brings the elements back').toBe(1);
});

for (const mode of ['gigascreen', 'multicolor_8x1', 'timex_hires', 'layer2_256']) {
    test(`Tape Blocks > Add current screen in ${mode} says why it cannot, and adds nothing`, async ({ page }) => {
        await boot(page);
        page.on('dialog', (d) => d.accept());
        const errors = [];
        page.on('pageerror', (e) => errors.push(e.message));
        await page.evaluate(() => { window.__tape = TAPFormat.export({ border: 0, name: 'test' }); });
        await selectMode(page, mode);
        const rows = await page.evaluate(() => {
            window.__fileErrors = [];
            EventBus.on(EVENTS.FILE_ERROR, (d) => window.__fileErrors.push(d.message));
            TapeBlockDialog.open(window.__tape.buffer, 'test.tap');
            return document.querySelectorAll('.tape-block-row').length;
        });
        expect(rows).toBeGreaterThan(0);
        await page.locator('.app-dialog-footer button').filter({ hasText: /Add current screen/ }).first().click();
        await expect.poll(() => page.evaluate(() => window.__fileErrors.length)).toBe(1);
        expect(await page.evaluate(() => window.__fileErrors[0])).toMatch(/standard screen layout/);
        expect(await page.evaluate(() => document.querySelectorAll('.tape-block-row').length), 'no block is added').toBe(rows);
        expect(errors).toEqual([]);
    });
}

test('Tape Blocks > Add current screen in Standard ULA still adds a header and a SCREEN$ block', async ({ page }) => {
    await boot(page);
    const rows = await page.evaluate(() => {
        TapeBlockDialog.open(TAPFormat.export({ border: 0, name: 'test' }).buffer, 'test.tap');
        return document.querySelectorAll('.tape-block-row').length;
    });
    await page.locator('.app-dialog-footer button').filter({ hasText: /Add current screen/ }).first().click();
    await expect.poll(() => page.evaluate(() => document.querySelectorAll('.tape-block-row').length)).toBe(rows + 2);
});
