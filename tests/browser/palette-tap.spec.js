'use strict';
/**
 * Batch 6 part 6B in a real browser: the ULAplus palette tape. Byte layout and the loader routine are pinned in Node
 * (tests/palette-tap.test.js); here: the File menu row, saving a 176-byte tape, Load Palette reading a tape, and File >
 * Open of a palette tape NOT becoming the open document (Ctrl+S must never write a screen tape over it).
 */
const { test, expect } = require('@playwright/test');
const { boot, selectMode } = require('./helpers');

const openFileMenu = async (page) => {
    await page.click('[data-menu="file"]');
    await page.waitForTimeout(100);
};
const disabled = (page, id) => page.evaluate((rowId) =>
    document.querySelector(`[data-id="${rowId}"]`).classList.contains('disabled'), id);

const makeTape = (page, regs) => page.evaluate((r) => Array.from(TAPFormat.buildUlaplusPaletteTap(r, 'mine')), regs);
const regsOf = () => Array.from({ length: 64 }, (_, i) => (i * 5 + 3) & 0xFF);

test('Save Palette as TAP is shut, with a reason, outside the ULAplus modes', async ({ page }) => {
    await boot(page);
    page.on('dialog', (d) => d.accept());
    await openFileMenu(page);
    expect(await disabled(page, 'save-palette-tap')).toBe(true);
    expect(await page.getAttribute('[data-id="save-palette-tap"]', 'title')).toMatch(/ULAplus/);
    await page.keyboard.press('Escape');

    await selectMode(page, 'ula_plus');
    await openFileMenu(page);
    expect(await disabled(page, 'save-palette-tap')).toBe(false);
});

test('the palette editor writes a 176-byte tape that reads back', async ({ page }) => {
    await boot(page);
    page.on('dialog', (d) => d.accept());
    await selectMode(page, 'ula_plus');
    await page.evaluate(() => ColorManager.setUlaplusRegister(7, 0x6D));
    const info = await page.evaluate(() => {
        const traits = PaletteEditorDialog._traits();
        const bytes = traits.encode('tap');
        const back = TAPFormat.findUlaplusPalette(bytes);
        return { len: bytes.length, kinds: traits.fileKinds, same: back[7] === 0x6D };
    });
    expect(info.len).toBe(176);
    expect(info.kinds).toContain('tap');
    expect(info.same).toBe(true);
});

test('File > Load Palette reads a palette tape into the palette, as one undo step', async ({ page }) => {
    await boot(page);
    page.on('dialog', (d) => d.accept());
    await selectMode(page, 'ula_plus');
    const regs = regsOf();
    const tape = await makeTape(page, regs);
    const chooser = page.waitForEvent('filechooser');
    await openFileMenu(page);
    await page.click('[data-id="load-palette"]');
    (await chooser).setFiles({ name: 'mine.tap', mimeType: 'application/octet-stream', buffer: Buffer.from(tape) });
    await expect.poll(() => page.evaluate(() => ColorManager.getUlaplusRegisters()[7])).toBe(regs[7]);
    expect(await page.evaluate(() => Array.from(ColorManager.getUlaplusRegisters()))).toEqual(regs);
    await page.keyboard.press('Control+z');
    expect(await page.evaluate(() => ColorManager.getUlaplusRegisters()[7])).not.toBe(regs[7]);
});

test('opening a palette tape with File > Open keeps the document name and does not ask to discard', async ({ page }) => {
    await boot(page);
    page.on('dialog', (d) => d.accept());
    await selectMode(page, 'ula_plus');
    await page.evaluate(() => {
        FileManager.currentFilename = 'picture.pixula';
        FileManager.hasUnsavedChanges = true;
    });
    const regs = regsOf();
    const tape = await makeTape(page, regs);
    const ok = await page.evaluate(async (bytes) => {
        const file = new File([new Uint8Array(bytes)], 'palette.tap');
        return FileManager.loadFile(file);
    }, tape);
    expect(ok).toBe(true);
    expect(await page.evaluate(() => FileManager.currentFilename), 'the tape did not become the open file').toBe('picture.pixula');
    expect(await page.evaluate(() => FileManager.hasUnsavedChanges)).toBe(true);
    expect(await page.evaluate(() => Array.from(ColorManager.getUlaplusRegisters()))).toEqual(regs);
});

test('outside the ULAplus modes a palette tape is stored and the status line says so', async ({ page }) => {
    await boot(page);
    page.on('dialog', (d) => d.accept());
    const regs = regsOf();
    const tape = await makeTape(page, regs);
    const note = page.evaluate(() => new Promise((resolve) => EventBus.on(EVENTS.STATUS_NOTICE, ({ text }) => resolve(text))));
    await page.evaluate(async (bytes) => FileManager.loadFile(new File([new Uint8Array(bytes)], 'palette.tap')), tape);
    expect(await note).toMatch(/ULAplus/);
    await selectMode(page, 'ula_plus');
    expect(await page.evaluate(() => Array.from(ColorManager.getUlaplusRegisters()))).toEqual(regs);
});
