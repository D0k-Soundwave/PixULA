'use strict';
/**
 * Batch 10C in a real browser: big CHX fonts in the Font Editor. New Big Font..., Fill from font..., editing a big glyph,
 * CHX export of what was made, and the guards that keep a big font out of the formats and tools that cannot hold it.
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

async function openEditor(page) {
    await page.click('.menu-item[data-menu="file"] .menu-label');
    await page.click('.menu-action[data-action="file:fontEditor"]');
    await expect(page.locator('.fe-new-big')).toBeVisible();
}

async function newBig(page, { cols, rows, coverage = 'ASCII', fill = false, family, percent, align, proportional }) {
    await page.click('.fe-new-big');
    await page.selectOption('#fe-new-cols', String(cols));
    await page.selectOption('#fe-new-rows', String(rows));
    await page.selectOption('#fe-new-cov', coverage);
    if (fill) {
        await page.locator('#fe-new-fill').check();
        if (family) await page.selectOption('#fe-fill-family', family);
        if (percent) await page.fill('#fe-fill-percent', String(percent));
        if (align) await page.selectOption('#fe-fill-align', align);
        if (proportional) await page.locator('#fe-fill-proportional').check();
    } else {
        await page.locator('#fe-new-fill').uncheck();
    }
    await page.click('#fe-fill-go');
}

const ink = (page, code) => page.evaluate((c) => {
    const g = FontService.getGlyph(c);
    let n = 0;
    for (const b of g) { let v = b; while (v) { n += v & 1; v >>= 1; } }
    return n;
}, code);

test('New Big Font makes a blank 16 x 24 font and the editor shows its size', async ({ page }) => {
    await boot(page);
    await openEditor(page);
    await newBig(page, { cols: 2, rows: 3 });
    expect(await page.evaluate(() => [FontService.width, FontService.height, FontService.glyphs.length, FontService.isBig()])).toEqual([16, 24, 96, true]);
    await expect(page.locator('.fe-size-label')).toBeVisible();
    await expect(page.locator('.fe-size-label')).toContainText('16x24');
    await expect(page.locator('.fe-width-label')).toBeHidden();
    // the editing surface follows the glyph size and is square-pixelled
    const dims = await page.evaluate(() => { const c = document.querySelector('.fe-glyph-canvas'); return [c.width, c.height]; });
    expect(dims[0] / 16).toBe(dims[1] / 24);
});

test('only CHX is offered for a big font, and capture and the byte-font picker are off', async ({ page }) => {
    await boot(page);
    await openEditor(page);
    await newBig(page, { cols: 2, rows: 2 });
    const opts = await page.evaluate(() => [...document.querySelectorAll('.fe-export-format option')].map(o => [o.value, o.disabled]));
    for (const [value, disabled] of opts) expect(disabled, value).toBe(value !== 'chx');
    expect(await page.locator('.fe-export-format').inputValue()).toBe('chx');
    await expect(page.locator('.fe-capture')).toBeDisabled();
    await expect(page.locator('.fe-system-font')).toBeDisabled();
});

test('drawing in the editing surface writes a pixel into the big glyph', async ({ page }) => {
    await boot(page);
    await openEditor(page);
    await newBig(page, { cols: 2, rows: 2 });
    const canvas = page.locator('.fe-glyph-canvas');
    const box = await canvas.boundingBox();
    // pixel (12, 3) of a 16 x 16 glyph
    await page.mouse.click(box.x + (12 + 0.5) * box.width / 16, box.y + (3 + 0.5) * box.height / 16);
    const set = await page.evaluate(() => GlyphBits.getPixel(FontService.getGlyph(65), 16, 12, 3));
    expect(set).toBe(true);
    expect(await ink(page, 65)).toBe(1);
});

test('Fill from font puts real letters in a big font (and "i" is narrower than "W" when proportional)', async ({ page }) => {
    await boot(page);
    await openEditor(page);
    await newBig(page, { cols: 3, rows: 3, fill: true, align: 'left', proportional: true });
    await expect(page.locator('.fe-size-label')).toBeVisible();
    await page.waitForFunction(() => FontService.getGlyph(87).some(b => b !== 0));
    expect(await page.evaluate(() => [FontService.width, FontService.height])).toEqual([24, 24]);
    expect(await ink(page, 87), 'W has ink').toBeGreaterThan(20);
    expect(await ink(page, 105), 'i has ink').toBeGreaterThan(5);
    const shade = await page.evaluate(() => [FontService.getShade(105), FontService.getShade(87), FontService.getShade(32)]);
    expect(shade[0].right, 'i is shaded further than W').toBeGreaterThan(shade[1].right);
    expect(shade[2].left + shade[2].right, 'Space keeps a column').toBeLessThan(3);
    // what the file would hold: i is narrower than W
    const widths = await page.evaluate(() => {
        const out = FontFormat.exportFont(FontService.toDocument(), 'chx');
        const col = (code) => out[out[5 + code * 2] | (out[6 + code * 2] << 8) + 1];
        const rec = (code) => out[5 + code * 2] | (out[6 + code * 2] << 8);
        return [out[rec(105) + 1], out[rec(87) + 1]];
    });
    expect(widths[0]).toBeLessThan(widths[1]);
});

test('Fill from font without proportional shades nothing', async ({ page }) => {
    await boot(page);
    await openEditor(page);
    await newBig(page, { cols: 2, rows: 2, fill: true });
    await page.waitForFunction(() => FontService.getGlyph(87).some(b => b !== 0));
    expect(await page.evaluate(() => FontService.hasShading())).toBe(false);
});

test('Fill from font on an existing big font keeps the size and refills every glyph in one change', async ({ page }) => {
    await boot(page);
    await openEditor(page);
    await newBig(page, { cols: 2, rows: 2 });
    await page.evaluate(() => { window.__changes = 0; EventBus.on(EVENTS.FONT_CHANGED, () => { window.__changes++; }); });
    await page.click('.fe-fill');
    await page.fill('#fe-fill-percent', '70');
    await page.click('#fe-fill-go');
    await page.waitForFunction(() => FontService.getGlyph(87).some(b => b !== 0));
    expect(await page.evaluate(() => [FontService.width, FontService.height])).toEqual([16, 16]);
    expect(await page.evaluate(() => window.__changes), 'one announcement for the whole fill').toBe(1);
});

test('Fill height percent: 50% makes letters shorter than 100%', async ({ page }) => {
    await boot(page);
    await openEditor(page);
    await newBig(page, { cols: 2, rows: 2, fill: true, percent: 100 });
    await page.waitForFunction(() => FontService.getGlyph(72).some(b => b !== 0));
    const rows = (code) => page.evaluate((c) => { const g = FontService.getGlyph(c); let n = 0; for (let y = 0; y < 16; y++) if (g[y * 2] || g[y * 2 + 1]) n++; return n; }, code);
    const full = await rows(72);
    await page.click('.fe-fill');
    await page.fill('#fe-fill-percent', '50');
    await page.click('#fe-fill-go');
    await page.waitForFunction((n) => { const g = FontService.getGlyph(72); let r = 0; for (let y = 0; y < 16; y++) if (g[y * 2] || g[y * 2 + 1]) r++; return r > 0 && r < n; }, full);
    expect(await rows(72)).toBeLessThan(full);
});

test('CHX export of a big font is the size the layout says, and reads back', async ({ page }) => {
    await boot(page);
    await openEditor(page);
    await newBig(page, { cols: 2, rows: 3, fill: true });
    await page.waitForFunction(() => FontService.getGlyph(87).some(b => b !== 0));
    const r = await page.evaluate(() => {
        const out = FontFormat.exportFont(FontService.toDocument(), 'chx');
        const back = FontFormat.parseFont(out, 'chx');
        return { len: out.length, ok: back.success, w: back.font && back.font.width, h: back.font && back.font.height };
    });
    expect(r.len).toBe(517 + 96 * (3 + 2 * 3 * 8));
    expect([r.ok, r.w, r.h]).toEqual([true, 16, 24]);
});

test('exporting a big font as CH8 says why not and writes nothing', async ({ page }) => {
    await boot(page);
    await openEditor(page);
    await newBig(page, { cols: 2, rows: 2 });
    const msg = await page.evaluate(() => { try { FontFormat.exportFont(FontService.toDocument(), 'ch8'); return ''; } catch (e) { return e.message; } });
    expect(msg).toContain('.chx');
});

test('a big font in the library is not offered by the Text tool', async ({ page }) => {
    await boot(page);
    await openEditor(page);
    await newBig(page, { cols: 2, rows: 2 });
    await page.fill('.fe-name', 'Giant');
    await page.click('.fe-lib-save');
    await page.waitForFunction(() => FontService.listLibrary().includes('Giant'));
    const offered = await page.evaluate(() => {
        const tool = ToolManager.getTool(TOOLS.TEXT);
        return tool._libraryFontOptions().map(o => o.value);
    });
    expect(offered).not.toContain('zxfont:Giant');
});

test('Load ROM Font brings back the classic editor', async ({ page }) => {
    await boot(page);
    await openEditor(page);
    await newBig(page, { cols: 3, rows: 3 });
    await page.click('.fe-rom');
    await expect(page.locator('.fe-size-label')).toBeHidden();
    await expect(page.locator('.fe-width-label')).toBeVisible();
    await expect(page.locator('.fe-capture')).toBeEnabled();
    expect(await page.evaluate(() => [FontService.width, FontService.height])).toEqual([8, 8]);
});
