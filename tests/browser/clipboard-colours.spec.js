'use strict';
/**
 * Batch 5 part 5A2 in a real browser: a copy keeps the colours of the cells it covered, they survive a reload with the
 * persisted clipboard, and a paste still lands exactly as it always did (rail colours) until the stamp is switched to
 * Own colours. What is captured, null cells and the codec are pinned in Node by tests/clipboard-colours.test.js.
 */
const { test, expect } = require('@playwright/test');
const { boot, reload } = require('./helpers');

test('a copy keeps cell colours across a reload; the paste starts as Pixels only and Own colours brings them back', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => {
        const L = LayerManager.getCurrentLayer();
        const c = L.getCell(4, 4);
        Object.assign(c, { ink: 1, paper: 6, bright: true, flash: false, altered: true });
        c.pixels.fill(0xAA);
        SelectionService.setSelection({ x: 32, y: 32, width: 8, height: 8 });
        SelectionService.copyToClipboard();
    });
    const captured = await page.evaluate(() => SelectionService.clipboard.attrs);
    expect(captured).toEqual([1 | (6 << 3) | 0x40]);
    await page.waitForTimeout(500); // persist debounce

    page.on('dialog', (d) => (d.type() === 'confirm' ? d.dismiss() : d.accept()));
    await reload(page);
    expect(await page.evaluate(() => SelectionService.clipboard && SelectionService.clipboard.attrs)).toEqual(captured);

    // A plain paste: rail colours, as before.
    await page.evaluate(() => {
        ColorManager.setInk(2); ColorManager.setPaper(5);
        ColorManager.setBright(false); ColorManager.setFlash(false);
        SelectionService.startFloatingPaste(80, 80);
    });
    const state = await page.evaluate(() => {
        const fp = SelectionService.floatingPaste;
        return { carries: !!fp.attrs, coloured: SelectionService.stampColoured(fp) };
    });
    expect(state).toEqual({ carries: true, coloured: false });
    await page.keyboard.press('Enter');
    const plain = await page.evaluate(() => {
        const c = LayerManager.getCurrentLayer().getCell(10, 10);
        return `${c.ink}/${c.paper}/${c.bright ? 1 : 0}`;
    });
    expect(plain).toBe('2/5/0');

    // The same stamp switched to Own colours: the copied ones.
    await page.evaluate(() => {
        SelectionService.startFloatingPaste(123, 123);
        SelectionService.setStampOptions({ colours: 'coloured' });
    });
    const pos = await page.evaluate(() => ({ x: SelectionService.floatingPaste.x, y: SelectionService.floatingPaste.y }));
    expect(pos).toEqual({ x: 120, y: 120 });
    await page.keyboard.press('Enter');
    const own = await page.evaluate(() => {
        const c = LayerManager.getCurrentLayer().getCell(15, 15);
        return `${c.ink}/${c.paper}/${c.bright ? 1 : 0}`;
    });
    expect(own).toBe('1/6/1');
});
