'use strict';
/**
 * Batch 10C3 in a real browser: a saved big, proportional font in the Text tool and in Type on canvas. The font is built the way a person
 * would (Font Editor: New Big Font with a fill from an installed font, Proportional), saved to the library, then used.
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

async function makeFont(page, name) {
    await page.click('.menu-item[data-menu="file"] .menu-label');
    await page.click('.menu-action[data-action="file:fontEditor"]');
    await page.click('.fe-new-big');
    await page.selectOption('#fe-new-cols', '3');
    await page.selectOption('#fe-new-rows', '3');
    await page.locator('#fe-fill-proportional').check();
    await page.click('#fe-fill-go');
    await page.waitForFunction(() => FontService.getGlyph(87).some(b => b !== 0));
    await page.fill('.fe-name', name);
    await page.click('.fe-lib-save');
    await page.waitForFunction((n) => FontService.listLibrary().includes(n), name);
    await page.keyboard.press('Escape');
}
async function pixelPoint(page, px, py) {
    const box = await page.frameLocator('#canvas-frame').locator('#main-canvas').boundingBox();
    const dims = await page.evaluate(() => ({ w: ZX_SPECTRUM.WIDTH, h: ZX_SPECTRUM.HEIGHT }));
    return { x: box.x + (px + 0.5) * box.width / dims.w, y: box.y + (py + 0.5) * box.height / dims.h };
}
async function clickAt(page, x, y) {
    const p = await pixelPoint(page, x, y);
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await page.mouse.up();
    await page.waitForTimeout(150);
}
const inkCount = (page) => page.evaluate(() => {
    const layer = LayerManager.getCurrentLayer();
    let n = 0;
    for (let cy = 0; cy < ZX_SPECTRUM.GRID_ROWS; cy++) for (let cx = 0; cx < ZX_SPECTRUM.GRID_COLS; cx++) {
        const c = layer.getCell(cx, cy);
        if (c && c.altered) for (const r of c.pixels) { let b = r; while (b) { n += b & 1; b >>= 1; } }
    }
    return n;
});

test('the font list shows the size and "proportional", and choosing it sizes the characters', async ({ page }) => {
    await boot(page);
    await makeFont(page, 'Fine');
    await page.click('.tool-btn[data-tool="text"]');
    const label = await page.evaluate(() => ToolManager.getTool(TOOLS.TEXT)._libraryFontOptions().find(o => o.value === 'zxfont:Fine').label);
    expect(label).toBe('Fine (24x24, proportional)');
    await page.evaluate(() => ToolManager.getTool(TOOLS.TEXT).setFontFamily('zxfont:Fine'));
    expect(await page.evaluate(() => { const t = ToolManager.getTool(TOOLS.TEXT); return [t._charW, t._charH]; })).toEqual([24, 24]);
    expect(await page.evaluate(() => ToolManager.getTool(TOOLS.TEXT).getSizesForFont())).toEqual([24, 48, 72, 96]);
});

test('Type on canvas with the big font: narrow letters are narrower, Enter draws, one undo takes it back', async ({ page }) => {
    await boot(page);
    await makeFont(page, 'Fine');
    await page.click('.tool-btn[data-tool="text"]');
    await page.evaluate(() => ToolManager.getTool(TOOLS.TEXT).setFontFamily('zxfont:Fine'));
    await page.locator('#opt-typeOnCanvas').check();
    const undoBefore = await page.evaluate(() => UndoRedo.getUndoCount());
    await clickAt(page, 20, 20);
    await page.keyboard.type('iW');
    const widths = await page.evaluate(() => {
        const t = ToolManager.getTool(TOOLS.TEXT);
        const b = t._typing.build();
        return { total: b.lay.width, xs: b.lay.lines[0].xs };
    });
    expect(widths.xs.length).toBe(3);
    expect(widths.xs[1], 'i advances less than a full 24 pixel cell').toBeLessThan(24);
    expect(widths.xs[1]).toBeGreaterThan(0);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    expect(await inkCount(page)).toBeGreaterThan(10);
    expect(await page.evaluate(() => UndoRedo.getUndoCount())).toBe(undoBefore + 1);
    await page.keyboard.press('Control+z');
    expect(await inkCount(page)).toBe(0);
});

test('the stamp path draws the same letters', async ({ page }) => {
    await boot(page);
    await makeFont(page, 'Fine');
    await page.click('.tool-btn[data-tool="text"]');
    await page.evaluate(() => { const t = ToolManager.getTool(TOOLS.TEXT); t.setFontFamily('zxfont:Fine'); t.setText('iW'); t.setTextSize(24); });
    const m = await page.evaluate(() => {
        const t = ToolManager.getTool(TOOLS.TEXT);
        const r = t._rasterizeAtFixedSize('iW', 24);
        const typed = BitmapText.layout('iW', t._typeLayoutOptions());
        return { stamp: [r.width, r.height], typed: [typed.width, typed.height] };
    });
    expect(m.stamp).toEqual(m.typed);
});

test('a character the font leaves out cannot be typed', async ({ page }) => {
    await boot(page);
    await makeFont(page, 'Fine');
    await page.evaluate(() => { FontService.loadFromLibrary('Fine'); FontService.setShade(90, 0, 3); });   // 'Z' left out
    const g = await page.evaluate(() => {
        const t = ToolManager.getTool(TOOLS.TEXT);
        // a fresh copy of the library font with Z shaded out
        const font = FontService.getLibraryFont('Fine');
        const f2 = { ...font, shade: font.shade.map(p => [p[0], p[1]]) };
        f2.shade[90 - 32] = [0, 3];
        const src = BitmapText.fontSource(f2);
        return { z: !!src.glyphOf('Z'), w: !!src.glyphOf('W') };
    });
    expect(g.z).toBe(false);
    expect(g.w).toBe(true);
});
