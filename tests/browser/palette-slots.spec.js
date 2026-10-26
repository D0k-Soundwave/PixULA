'use strict';
/**
 * Batch 6 part 6A in a real browser: Image > Palette (four slots, Invert Palette) and the CLUT keys
 * Ctrl+Shift+1 to 4. What the slots and the inverter do to the registers is pinned in Node by
 * tests/palette-slots.test.js; here: the menu rows, the mouse and keyboard routes, undo, the editor
 * label, a project round trip, and the keys.
 */
const { test, expect } = require('@playwright/test');
const { boot, selectMode } = require('./helpers');

const openPalette = async (page) => {
    await page.click('[data-menu="image"]');
    await page.hover('#menu-image [data-id="palette-slots"]');
    await page.waitForTimeout(150);
};
const disabled = (page, id) => page.evaluate((rowId) =>
    document.querySelector(`[data-id="${rowId}"]`).classList.contains('disabled'), id);
const checked = (page, id) => page.evaluate((rowId) =>
    document.querySelector(`[data-id="${rowId}"]`).classList.contains('checked') ||
    document.querySelector(`[data-id="${rowId}"]`).getAttribute('aria-checked') === 'true', id);

test('the Palette rows are open in ULAplus and Next modes and shut, with a reason, in a fixed-palette mode', async ({ page }) => {
    await boot(page);
    page.on('dialog', (d) => d.accept());
    await openPalette(page);
    for (const id of ['palette-slot-1', 'palette-slot-4', 'palette-invert']) expect(await disabled(page, id), id + ' in standard').toBe(true);
    expect(await page.getAttribute('#menu-image [data-id="palette-slots"]', 'title')).toMatch(/fixed colours/i);
    await page.keyboard.press('Escape');

    await selectMode(page, 'ula_plus');
    await openPalette(page);
    for (const id of ['palette-slot-1', 'palette-slot-4', 'palette-invert']) expect(await disabled(page, id), id + ' in ULAplus').toBe(false);
    await page.keyboard.press('Escape');

    await selectMode(page, 'ulanext');
    await openPalette(page);
    expect(await disabled(page, 'palette-slot-2')).toBe(false);
    expect(await disabled(page, 'palette-invert'), 'the inverter is ULAplus only').toBe(true);
});

test('picking a slot with the mouse changes the colours, ticks the row, and Ctrl+Z undoes it', async ({ page }) => {
    await boot(page);
    page.on('dialog', (d) => d.accept());
    await selectMode(page, 'ula_plus');
    await page.evaluate(() => { ColorManager.setUlaplusRegister(3, 0x1C); });
    const reg3 = () => page.evaluate(() => ColorManager.getUlaplusRegisters()[3]);
    const before = await reg3();
    const pristine = await page.evaluate(() => ULAPLUS.defaultRegisters()[3]);
    await openPalette(page);
    await page.click('#menu-image [data-id="palette-slot-3"]');
    expect(await page.evaluate(() => ColorManager.getPaletteSlot())).toBe(2);
    expect(await reg3(), 'a slot you have not used yet holds the default palette').toBe(pristine);
    await page.evaluate(() => ColorManager.setUlaplusRegister(3, 0xE0));
    await openPalette(page);
    expect(await checked(page, 'palette-slot-3')).toBe(true);
    await page.click('#menu-image [data-id="palette-slot-1"]');
    expect(await reg3(), 'slot 1 did not get slot 3 edit').toBe(before);
    await page.keyboard.press('Control+z');
    expect(await page.evaluate(() => ColorManager.getPaletteSlot()), 'one undo returns to slot 3').toBe(2);
    expect(await reg3()).toBe(0xE0);
});

test('Invert Palette swaps the ink and paper halves of each CLUT, once, and undoes in one step', async ({ page }) => {
    await boot(page);
    page.on('dialog', (d) => d.accept());
    await selectMode(page, 'ula_plus');
    await page.evaluate(() => ColorManager.setUlaplusRegisters(Array.from({ length: 64 }, (_, i) => i)));
    await openPalette(page);
    await page.click('#menu-image [data-id="palette-invert"]');
    const regs = await page.evaluate(() => Array.from(ColorManager.getUlaplusRegisters()));
    expect(regs[0]).toBe(8);
    expect(regs[8]).toBe(0);
    expect(regs[16]).toBe(24);
    await page.keyboard.press('Control+z');
    expect(await page.evaluate(() => ColorManager.getUlaplusRegisters()[0])).toBe(0);
});

test('the palette editor says which slot it edits', async ({ page }) => {
    await boot(page);
    page.on('dialog', (d) => d.accept());
    await selectMode(page, 'ula_plus');
    await page.evaluate(() => TransformService.selectPaletteSlot(1));
    await page.evaluate(() => PaletteEditorDialog.open());
    await expect(page.locator('.palette-editor-slot')).toHaveText('Slot 2 of 4');
});

test('slots survive a project save and reload; an old project without them gets slot 1 plus copies', async ({ page }) => {
    await boot(page);
    page.on('dialog', (d) => d.accept());
    await selectMode(page, 'ula_plus');
    await page.evaluate(() => {
        TransformService.selectPaletteSlot(1);
        ColorManager.setUlaplusRegister(5, 0x77);
        TransformService.selectPaletteSlot(0);
    });
    const data = await page.evaluate(() => JSON.parse(JSON.stringify(App._getProjectData())));
    expect(data.paletteSlots).toBeTruthy();
    await page.evaluate(() => { ColorManager.resetPaletteSlots(); ColorManager.setUlaplusRegisters(null); });
    await page.evaluate(async (d) => { await App._loadProjectData(d); }, data);
    await page.evaluate(() => TransformService.selectPaletteSlot(1));
    expect(await page.evaluate(() => ColorManager.getUlaplusRegisters()[5])).toBe(0x77);

    const old = { ...data };
    delete old.paletteSlots;
    await page.evaluate(async (d) => { await App._loadProjectData(d); }, old);
    expect(await page.evaluate(() => ColorManager.getPaletteSlot())).toBe(0);
    await page.evaluate(() => TransformService.selectPaletteSlot(3));
    expect(await page.evaluate(() => ColorManager.getUlaplusRegisters()[5]), 'slot 4 is a copy of the loaded palette').toBe(0x77 === data.ulaplusRegisters[5] ? 0x77 : data.ulaplusRegisters[5]);
});

test('a document that never used a slot saves no slot data', async ({ page }) => {
    await boot(page);
    page.on('dialog', (d) => d.accept());
    await selectMode(page, 'ula_plus');
    const has = await page.evaluate(() => 'paletteSlots' in App._getProjectData());
    expect(has).toBe(false);
});

test('Ctrl+Shift+1 to 4 pick CLUT 0 to 3 in ULAplus modes only', async ({ page }) => {
    await boot(page);
    page.on('dialog', (d) => d.accept());
    await selectMode(page, 'ula_plus');
    for (const [digit, clut] of [[1, 0], [2, 1], [3, 2], [4, 3]]) {
        await page.keyboard.press(`Control+Shift+Digit${digit}`);
        expect(await page.evaluate(() => ColorManager.getClut()), `Ctrl+Shift+${digit}`).toBe(clut);
    }
    await selectMode(page, 'standard_ula');
    await page.evaluate(() => { ColorManager.setBright(false); ColorManager.setFlash(false); });
    await page.keyboard.press('Control+Shift+Digit4');
    expect(await page.evaluate(() => [ColorManager.getBright(), ColorManager.getFlash()]), 'standard ULA is untouched').toEqual([false, false]);
});

test('other Ctrl+Shift chords and plain digits still do what they did, and the Shortcuts list shows the keys', async ({ page }) => {
    await boot(page);
    const layers = await page.evaluate(() => LayerManager.layers.length);
    await page.keyboard.press('Control+Shift+KeyN');
    expect(await page.evaluate(() => LayerManager.layers.length)).toBe(layers + 1);
    await page.keyboard.press('3');
    expect(await page.evaluate(() => ColorManager.getInk())).toBe(2);
    await page.keyboard.press('F1');
    await expect(page.locator('.app-dialog').getByText('Ctrl+Shift+1 to 4')).toBeVisible();
});
