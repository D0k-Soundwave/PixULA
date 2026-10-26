'use strict';
/**
 * Batch 6 part 6B in a real browser: Preferences > Standard colours. What the model does is pinned in Node by
 * tests/standard-colours.test.js; here: the section is there, OK applies and keeps the colours across a reload, Cancel
 * keeps nothing, Reset and Load/Save .pal work, and ULAplus is not touched.
 */
const { test, expect } = require('@playwright/test');
const { boot, reload, selectMode } = require('./helpers');

const openPrefs = async (page) => {
    await page.evaluate(() => PreferencesDialog.open());
    await expect(page.locator('#pref-standard-colours')).toBeVisible();
};
const ok = async (page) => {
    await page.click('#dialog-preferences-dialog .app-dialog-footer button.primary');
    await expect(page.locator('#dialog-preferences-dialog')).toHaveCount(0);
};
const cancel = async (page) => {
    await page.click('#dialog-preferences-dialog .app-dialog-footer button:not(.primary)');
    await expect(page.locator('#dialog-preferences-dialog')).toHaveCount(0);
};
const rgb = (page, i) => page.evaluate((n) => Array.from(ColorManager.getRGB(n)), i);
const token = (page, i) => page.evaluate((n) => getComputedStyle(document.documentElement).getPropertyValue(`--zx-${n}`).trim().toLowerCase(), i);

test('the section shows the 15 colours: 8 normal and 7 bright, none for bright black', async ({ page }) => {
    await boot(page);
    await openPrefs(page);
    expect(await page.locator('.pref-std').count()).toBe(15);
    expect(await page.locator('#pref-std-8').count()).toBe(0);
    expect(await page.inputValue('#pref-std-10')).toBe('#ff0000');
});

test('OK applies a colour to the canvas, the tokens and the exports, and a reload keeps it', async ({ page }) => {
    await boot(page);
    await openPrefs(page);
    await page.fill('#pref-std-10', '#ff8000');
    await ok(page);
    expect(await rgb(page, 10)).toEqual([255, 128, 0]);
    expect(await token(page, 10)).toBe('#ff8000');

    // a cell drawn in bright red really shows orange on the canvas
    await page.evaluate(() => {
        ColorManager.setBright(true);
        const c = LayerManager.getCurrentLayer().getCell(2, 2);
        Object.assign(c, { ink: 2, paper: 0, bright: true, flash: false, altered: true });
        c.pixels.fill(0xFF);
        LayerManager.composeToCanvas();
    });
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const px = await page.evaluate(() => {
        const doc = document.getElementById('canvas-frame').contentDocument;
        const d = doc.getElementById('main-canvas').getContext('2d').getImageData(2 * 8 + 3, 2 * 8 + 3, 1, 1).data;
        return Array.from(d.slice(0, 3));
    });
    expect(px).toEqual([255, 128, 0]);
    // the screen bytes do not change with the colours
    const scr = await page.evaluate(() => Array.from(SCRFormat.export().slice(0, 16)).join(','));
    await page.evaluate(() => ColorManager.setStandardColours(null));
    expect(await page.evaluate(() => Array.from(SCRFormat.export().slice(0, 16)).join(','))).toBe(scr);
    await page.evaluate(() => ColorManager.setStandardColours(['#000000', '#0000D7', '#D70000', '#D700D7', '#00D700', '#00D7D7', '#D7D700', '#D7D7D7',
        '#000000', '#0000FF', '#FF8000', '#FF00FF', '#00FF00', '#00FFFF', '#FFFF00', '#FFFFFF']));

    await page.waitForTimeout(400);
    page.on('dialog', (d) => (d.type() === 'confirm' ? d.dismiss() : d.accept()));
    await reload(page);
    expect(await rgb(page, 10), 'kept across a reload').toEqual([255, 128, 0]);
    await openPrefs(page);
    expect(await page.inputValue('#pref-std-10')).toBe('#ff8000');
    await cancel(page);
});

test('Cancel keeps nothing; Reset to standard puts the originals back', async ({ page }) => {
    await boot(page);
    await openPrefs(page);
    await page.fill('#pref-std-2', '#800000');
    await cancel(page);
    expect(await rgb(page, 2)).toEqual([215, 0, 0]);

    await openPrefs(page);
    await page.fill('#pref-std-2', '#800000');
    await ok(page);
    expect(await rgb(page, 2)).toEqual([128, 0, 0]);
    await openPrefs(page);
    await page.click('#pref-std-reset');
    expect(await page.inputValue('#pref-std-2')).toBe('#d70000');
    await ok(page);
    expect(await rgb(page, 2)).toEqual([215, 0, 0]);
    expect(await page.evaluate(() => ColorManager.isStandardEdited())).toBe(false);
});

test('Load .pal reads ZX Paintbrush\'s layout and says when bright black was not used; a wrong file is refused', async ({ page }) => {
    await boot(page);
    const pal = await page.evaluate(() => {
        const norm = ['#000000', '#00006E', '#AA0000', '#B60082', '#00A200', '#00A2A2', '#9E9E00', '#969696'];
        const bright = ['#323232', '#3232DE', '#FF3232', '#FF32FF', '#32FF32', '#32FFFF', '#FFFF32', '#FFFFFF'];
        const b = NextPaletteFormat.encodeStandardColours([...norm, ...bright]);
        // give the bright half its own black, as Brights.pal does
        b.set([0x32, 0x32, 0x32, 0], 16 * 4);
        return Array.from(b);
    });
    await openPrefs(page);
    await page.setInputFiles('#pref-std-file', { name: 'Brights.pal', mimeType: 'application/octet-stream', buffer: Buffer.from(pal) });
    await expect(page.locator('#pref-std-note')).toBeVisible();
    expect(await page.inputValue('#pref-std-2')).toBe('#aa0000');
    expect(await page.inputValue('#pref-std-10')).toBe('#ff3232');
    await ok(page);
    expect(await rgb(page, 10)).toEqual([255, 50, 50]);

    await openPrefs(page);
    await page.setInputFiles('#pref-std-file', { name: 'bad.pal', mimeType: 'application/octet-stream', buffer: Buffer.alloc(100) });
    await expect(page.locator('#pref-std-note')).toBeVisible();
    expect(await page.inputValue('#pref-std-2'), 'a refused file changes nothing').toBe('#aa0000');
    await cancel(page);
});

test('ULAplus colours are not touched by the standard colours', async ({ page }) => {
    await boot(page);
    page.on('dialog', (d) => d.accept());
    const before = await (async () => { await selectMode(page, 'ula_plus'); return rgb(page, 10); })();
    await selectMode(page, 'standard_ula');
    await openPrefs(page);
    await page.fill('#pref-std-10', '#123456');
    await ok(page);
    await selectMode(page, 'ula_plus');
    expect(await rgb(page, 10)).toEqual(before);
});
