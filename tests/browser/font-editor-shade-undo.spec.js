'use strict';
/**
 * Batch 10C2 in a real browser: shading columns of a big-font character (saved narrower), Shade all to fit, the CHX export summary, and
 * Undo / Redo in the Font Editor (a stroke is one step; Ctrl+Z / Ctrl+Y; buttons).
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

async function openEditor(page) {
    await page.click('.menu-item[data-menu="file"] .menu-label');
    await page.click('.menu-action[data-action="file:fontEditor"]');
    await expect(page.locator('.fe-new-big')).toBeVisible();
}
async function newBig(page, o) {
    await page.click('.fe-new-big');
    await page.selectOption('#fe-new-cols', String(o.cols));
    await page.selectOption('#fe-new-rows', String(o.rows));
    if (o.fill) {
        await page.locator('#fe-new-fill').check();
        if (o.proportional) await page.locator('#fe-fill-proportional').check();
    } else {
        await page.locator('#fe-new-fill').uncheck();
    }
    await page.click('#fe-fill-go');
}
const status = (page) => page.locator('.fe-status');
const shade = (page, code) => page.evaluate((c) => FontService.getShade(c), code);
const inkOf = (page, code) => page.evaluate((c) => {
    let n = 0;
    for (const b of FontService.getGlyph(c)) { let v = b; while (v) { n += v & 1; v >>= 1; } }
    return n;
}, code);

test('the shade buttons grow and shrink the shading of the selected character and say when they cannot', async ({ page }) => {
    await boot(page);
    await openEditor(page);
    await newBig(page, { cols: 3, rows: 1 });
    await page.click('button[data-shade="left-more"]');
    expect(await shade(page, 65)).toEqual({ left: 1, right: 0 });
    await page.click('button[data-shade="right-more"]');
    await page.click('button[data-shade="right-more"]');
    expect(await shade(page, 65)).toEqual({ left: 1, right: 2 });
    await expect(page.locator('.fe-shade-state')).toContainText('1');
    await page.click('button[data-shade="right-more"]');
    await expect(status(page)).toContainText(/no more columns/i);
    expect(await shade(page, 65)).toEqual({ left: 1, right: 2 });
    await page.click('button[data-shade="left-less"]');
    await page.click('button[data-shade="right-less"]');
    expect(await shade(page, 65)).toEqual({ left: 0, right: 1 });
});

test('the editing surface shows the shaded columns, the dots under them are kept', async ({ page }) => {
    await boot(page);
    await openEditor(page);
    await newBig(page, { cols: 2, rows: 1 });
    const canvas = page.locator('.fe-glyph-canvas');
    const box = await canvas.boundingBox();
    await page.mouse.click(box.x + (3 + 0.5) * box.width / 16, box.y + (3 + 0.5) * box.height / 8);
    const sample = () => page.evaluate(() => {
        const c = document.querySelector('.fe-glyph-canvas');
        const z = c.width / 16;
        return Array.from(c.getContext('2d').getImageData(Math.floor(z * 10 + 2), Math.floor(c.height / 8 * 5 + 2), 1, 1).data);
    });
    const before = await sample();
    await page.click('button[data-shade="right-more"]');
    const after = await sample();
    expect(after).not.toEqual(before);
    expect(await inkOf(page, 65), 'dots are kept').toBe(1);
    await page.click('button[data-shade="left-more"]');
    expect(await inkOf(page, 65), 'even when the shaded column holds the dot').toBe(1);
});

test('Space cannot be shaded all the way across, and the editor says so', async ({ page }) => {
    await boot(page);
    await openEditor(page);
    await newBig(page, { cols: 3, rows: 1 });
    // pick Space (code 32) in the grid: it is the first cell
    await page.evaluate(() => FontEditorDialog._selectGlyph(32));
    await page.click('button[data-shade="left-more"]');
    await page.click('button[data-shade="left-more"]');
    await page.click('button[data-shade="right-more"]');
    await expect(status(page)).toContainText(/Space must keep/i);
    expect(await shade(page, 32)).toEqual({ left: 2, right: 0 });
});

test('Shade all to fit: ink characters are fitted, Space keeps a column, other blanks are left out, in one change', async ({ page }) => {
    await boot(page);
    await openEditor(page);
    await newBig(page, { cols: 3, rows: 2, fill: true });
    await page.waitForFunction(() => FontService.getGlyph(87).some(b => b !== 0));
    await page.evaluate(() => { window.__changes = 0; EventBus.on(EVENTS.FONT_CHANGED, () => { window.__changes++; }); });
    await page.click('button[data-shade="fit"]');
    expect(await page.evaluate(() => window.__changes)).toBe(1);
    const i = await shade(page, 105);
    expect(i.left + i.right, 'i is narrower than the cell').toBeGreaterThan(0);
    const sp = await shade(page, 32);
    expect(sp.left + sp.right).toBe(2);
    const blank = await page.evaluate(() => { for (let c = 33; c < 127; c++) if (FontService.getGlyph(c).every(b => b === 0)) return FontService.getShade(c); return null; });
    if (blank) expect(blank.left + blank.right).toBe(3);
    // every written character keeps all its ink
    const hidden = await page.evaluate(() => FontFormat.chxSummary(FontService.toDocument()).hiddenInk);
    expect(hidden, 'fitting never hides dots').toBe(0);
});

test('CHX export tells how many characters were saved narrower or left out', async ({ page }) => {
    await boot(page);
    await openEditor(page);
    await newBig(page, { cols: 3, rows: 1 });
    await page.evaluate(() => { FontService.setShade(65, 0, 1); FontService.setShade(66, 0, 3); FontService.setShade(67, 0, 3); });
    await page.evaluate(() => { FormatRegistry.download = async () => true; });
    await page.evaluate(() => FontEditorDialog._export('chx'));
    const text = await status(page).textContent();
    expect(text).toContain('1');
    expect(text).toMatch(/narrower/i);
    expect(text).toMatch(/left out/i);
});

test('Undo and Redo: one stroke is one step, by key and by button', async ({ page }) => {
    await boot(page);
    await openEditor(page);
    await newBig(page, { cols: 2, rows: 1 });
    await expect(page.locator('.fe-undo')).toBeEnabled();   // the New itself can be undone
    const canvas = page.locator('.fe-glyph-canvas');
    const box = await canvas.boundingBox();
    const at = (px, py) => [box.x + (px + 0.5) * box.width / 16, box.y + (py + 0.5) * box.height / 8];
    await page.mouse.move(...at(1, 3));
    await page.mouse.down();
    for (let x = 2; x <= 6; x++) await page.mouse.move(...at(x, 3));
    await page.mouse.up();
    expect(await inkOf(page, 65)).toBe(6);
    await page.keyboard.press('Control+z');
    expect(await inkOf(page, 65), 'the whole stroke goes in one Ctrl+Z').toBe(0);
    await page.keyboard.press('Control+y');
    expect(await inkOf(page, 65)).toBe(6);
    await page.click('.fe-undo');
    expect(await inkOf(page, 65)).toBe(0);
    await page.click('.fe-redo');
    expect(await inkOf(page, 65)).toBe(6);
});

test('Undo takes back New Big Font, Fill and Load ROM Font', async ({ page }) => {
    await boot(page);
    await openEditor(page);
    const start = await page.evaluate(() => [FontService.width, FontService.height]);
    await newBig(page, { cols: 2, rows: 2, fill: true });
    await page.waitForFunction(() => FontService.getGlyph(87).some(b => b !== 0));
    await page.keyboard.press('Control+z');                  // the fill
    expect(await inkOf(page, 87)).toBe(0);
    expect(await page.evaluate(() => FontService.width)).toBe(16);
    await page.keyboard.press('Control+z');                  // the New
    expect(await page.evaluate(() => [FontService.width, FontService.height])).toEqual(start);
    await page.keyboard.press('Control+y');
    await page.keyboard.press('Control+y');
    expect(await inkOf(page, 87)).toBeGreaterThan(0);
    await page.click('.fe-rom');
    expect(await page.evaluate(() => FontService.width)).toBe(8);
    await page.keyboard.press('Control+z');
    expect(await page.evaluate(() => FontService.width)).toBe(16);
});

test('Undo keeps the font name that is typed, and typing in the name box does not undo the font', async ({ page }) => {
    await boot(page);
    await openEditor(page);
    await newBig(page, { cols: 2, rows: 1 });
    await page.fill('.fe-name', 'My giant');
    await page.focus('.fe-name');
    await page.keyboard.press('Control+z');
    expect(await page.evaluate(() => FontService.width), 'the font was not undone from the name box').toBe(16);
    // the box's own text undo may have emptied the name; type it again, then undo the font with the button
    await page.fill('.fe-name', 'My giant');
    await page.click('.fe-undo');
    expect(await page.evaluate(() => FontService.name)).toBe('My giant');
});

test('undo of a shading change', async ({ page }) => {
    await boot(page);
    await openEditor(page);
    await newBig(page, { cols: 3, rows: 1 });
    await page.click('button[data-shade="left-more"]');
    expect((await shade(page, 65)).left).toBe(1);
    await page.click('.fe-undo');
    expect((await shade(page, 65)).left).toBe(0);
    await page.click('.fe-redo');
    expect((await shade(page, 65)).left).toBe(1);
});
