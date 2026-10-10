'use strict';
/**
 * Batch 5 part 5C in a real browser: Image > Attributes on a stamp that places its own colours. What each command
 * does to the stamp's cells is pinned in Node (tests/stamp-attribute-commands.test.js); here: the menu rows are open
 * for such a stamp and shut (with the reason) for any other, a click is one undo step, the Change dialog says it
 * applies to the stamp, and Escape in the dialog does not throw the stamp away.
 */
const { test, expect } = require('@playwright/test');
const { boot, selectMode } = require('./helpers');

const IDS = ['attr-invert', 'attr-erase', 'attr-flip-h', 'attr-flip-v', 'attr-change'];

const openImageSubmenu = async (page) => {
    await page.click('[data-menu="image"]');
    await page.hover('#menu-image [data-id="attributes"]');
    await page.waitForTimeout(150);
};
const disabled = (page, id) => page.evaluate((rowId) =>
    document.querySelector(`[data-id="${rowId}"]`).classList.contains('disabled'), id);

async function floatStamp(page, opts) {
    await page.evaluate((o) => {
        const mask = Array.from({ length: 8 }, () => new Array(16).fill(true));
        SelectionService.startFloatingPasteFromMask(mask, 16, 8, 40, 40, 'attr');
        const fp = SelectionService.floatingPaste;
        fp.attrs = [1 | (6 << 3) | 0x40, 4 | (0 << 3) | 0x80];
        if (o) fp.opts = o;
        CanvasSystem.requestRender();
    }, opts || null);
}
const stampAttrs = (page) => page.evaluate(() => {
    const fp = SelectionService.floatingPaste;
    return fp ? fp.attrs.slice() : null;
});

test('the Attributes rows are open for a stamp with its own colours and shut for a Pixels-only one', async ({ page }) => {
    await boot(page);
    await floatStamp(page);
    await openImageSubmenu(page);
    for (const id of IDS) expect(await disabled(page, id), id).toBe(false);
    await page.keyboard.press('Escape');

    await page.evaluate(() => SelectionService.setStampOptions({ colours: 'pixels' }));
    await openImageSubmenu(page);
    for (const id of IDS) expect(await disabled(page, id), id).toBe(true);
    expect(await page.getAttribute('#menu-image [data-id="attributes"]', 'title')).toMatch(/stamp/i);
});

test('Image > Dots Invert and Flip stay shut for a stamp with its own colours', async ({ page }) => {
    await boot(page);
    await floatStamp(page);
    await page.click('[data-menu="image"]');
    await page.hover('#menu-image [data-id="dots"]');
    await page.waitForTimeout(150);
    expect(await disabled(page, 'dots-invert')).toBe(true);
    expect(await disabled(page, 'dots-flip-h')).toBe(true);
});

test('Invert from the menu changes the stamp, not the picture, in one undo step', async ({ page }) => {
    await boot(page);
    await floatStamp(page);
    const before = await stampAttrs(page);
    await openImageSubmenu(page);
    await page.click('#menu-image [data-id="attr-invert"]');
    const after = await stampAttrs(page);
    expect(after).not.toEqual(before);
    expect(after[0]).toBe(6 | (1 << 3) | 0x40);
    expect(await page.evaluate(() => LayerManager.layers[1].getCell(5, 5).altered)).toBe(false);
    await page.keyboard.press('Control+z');
    expect(await stampAttrs(page)).toEqual(before);
});

test('the Change dialog applies to the stamp, has no Screen B group in GigaScreen, and Escape keeps the stamp', async ({ page }) => {
    await boot(page);
    page.on('dialog', (d) => d.accept());
    await selectMode(page, 'gigascreen');
    await floatStamp(page);
    await openImageSubmenu(page);
    await page.click('#menu-image [data-id="attr-change"]');
    const dlg = page.locator('#dialog-change-attributes');
    await expect(dlg).toBeVisible();
    await expect(dlg.locator('.attr-change-scope')).toContainText('Stamp');
    expect(await dlg.getByText('Screen B').count()).toBe(0);
    await page.keyboard.press('Escape');
    await expect(dlg).toHaveCount(0);
    expect(await stampAttrs(page), 'the stamp survived Escape').not.toBeNull();
});

test('a parked stamp, selected in the layer panel, can be inverted', async ({ page }) => {
    await boot(page);
    await floatStamp(page);
    await page.evaluate(() => {
        SelectionService.endFloatingPaste();
        const l = LayerManager.layers.find(x => x.isStamp);
        LayerManager.setCurrentLayer(l.index);
    });
    await openImageSubmenu(page);
    expect(await disabled(page, 'attr-invert')).toBe(false);
    await page.click('#menu-image [data-id="attr-invert"]');
    const first = await page.evaluate(() => LayerManager.layers.find(x => x.isStamp).stamp.attrs[0]);
    expect(first).toBe(6 | (1 << 3) | 0x40);
});
