'use strict';
/**
 * Batch 10C2b in a real browser: the Font Editor's all-characters map. Draw across character boundaries (one stroke = one change = one
 * undo step), fill inside the clicked character, shade tool, move tool, zoom, keyboard.
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

async function openEditor(page) {
    await page.click('.menu-item[data-menu="file"] .menu-label');
    await page.click('.menu-action[data-action="file:fontEditor"]');
    await expect(page.locator('.fe-new-big')).toBeVisible();
}
async function newBig(page, cols, rows, coverage = 'ASCII') {
    await page.click('.fe-new-big');
    await page.selectOption('#fe-new-cols', String(cols));
    await page.selectOption('#fe-new-rows', String(rows));
    await page.selectOption('#fe-new-cov', coverage);
    await page.locator('#fe-new-fill').uncheck();
    await page.click('#fe-fill-go');
}
async function openMap(page) {
    await page.click('.fe-map-toggle');
    await expect(page.locator('.fe-map-canvas')).toBeVisible();
}
/** Screen position of map pixel (px, py). */
async function at(page, px, py) {
    const info = await page.evaluate(() => {
        const c = document.querySelector('.fe-map-canvas');
        const r = c.getBoundingClientRect();
        return { x: r.x, y: r.y, zoom: FontEditorDialog._mapView.getZoom() };
    });
    return [info.x + (px + 0.5) * info.zoom, info.y + (py + 0.5) * info.zoom];
}
const ink = (page, code) => page.evaluate((c) => {
    let n = 0;
    for (const b of FontService.getGlyph(c)) { let v = b; while (v) { n += v & 1; v >>= 1; } }
    return n;
}, code);
async function tool(page, name) { await page.click(`.fe-layout button[data-tool="${name}"]`); }

test('All characters shows the whole font as one map and hides the one-character editor', async ({ page }) => {
    await boot(page);
    await openEditor(page);
    await newBig(page, 2, 1);
    await openMap(page);
    await expect(page.locator('.fe-glyph-canvas')).toBeHidden();
    const dims = await page.evaluate(() => { const v = FontEditorDialog._mapView; return [v._w, v._h, v._count]; });
    expect(dims).toEqual([16 * 16, 6 * 8, 96]);
    await page.click('.fe-map-toggle');
    await expect(page.locator('.fe-glyph-canvas')).toBeVisible();
    await expect(page.locator('.fe-map-canvas')).toBeHidden();
});

test('a stroke across two characters changes both, as ONE change and ONE undo step', async ({ page }) => {
    await boot(page);
    await openEditor(page);
    await newBig(page, 2, 1);
    await openMap(page);
    await page.evaluate(() => { window.__changes = 0; EventBus.on(EVENTS.FONT_CHANGED, () => { window.__changes++; }); });
    // glyph 32 is map cell 0 (x 0..15), glyph 33 is cell 1 (x 16..31)
    const a = await at(page, 12, 3), b = await at(page, 20, 3);
    await page.mouse.move(...a);
    await page.mouse.down();
    for (let x = 13; x <= 20; x++) await page.mouse.move(...(await at(page, x, 3)));
    await page.mouse.up();
    expect(await ink(page, 32)).toBeGreaterThan(0);
    expect(await ink(page, 33)).toBeGreaterThan(0);
    expect(await ink(page, 34)).toBe(0);
    expect(await page.evaluate(() => window.__changes), 'one announcement for the whole stroke').toBe(1);
    await page.keyboard.press('Control+z');
    expect(await ink(page, 32)).toBe(0);
    expect(await ink(page, 33)).toBe(0);
    void b;
});

test('the eraser and the right button clear pixels across characters', async ({ page }) => {
    await boot(page);
    await openEditor(page);
    await newBig(page, 2, 1);
    await openMap(page);
    await page.evaluate(() => { for (const c of [32, 33]) FontService.setGlyph(c, new Uint8Array(16).fill(0xFF)); });
    await tool(page, 'eraser');
    await page.mouse.move(...(await at(page, 14, 2)));
    await page.mouse.down();
    await page.mouse.move(...(await at(page, 18, 2)));
    await page.mouse.up();
    // row 2 of glyph 32 (bytes 4,5) and glyph 33 (bytes 4,5): x 14,15 -> byte 1 bits 6,7 of glyph 32; x 16..18 -> glyph 33 x 0..2
    const rows = await page.evaluate(() => [Array.from(FontService.getGlyph(32).slice(4, 6)), Array.from(FontService.getGlyph(33).slice(4, 6))]);
    expect(rows[0][1] & 0x03).toBe(0);
    expect(rows[1][0] & 0xE0).toBe(0);
    expect(rows[1][0] & 0x10, 'beyond the stroke is untouched').not.toBe(0);
});

test('line tool: a line from one character to another', async ({ page }) => {
    await boot(page);
    await openEditor(page);
    await newBig(page, 1, 1);
    await openMap(page);
    await tool(page, 'line');
    await page.mouse.move(...(await at(page, 2, 2)));
    await page.mouse.down();
    await page.mouse.move(...(await at(page, 12, 4)));
    await page.mouse.up();
    // 8 x 8 font: x 2 is glyph 32 (cell 0), x 12 is glyph 33 (cell 1)
    expect(await ink(page, 32)).toBeGreaterThan(0);
    expect(await ink(page, 33)).toBeGreaterThan(0);
});

test('fill stays inside the clicked character', async ({ page }) => {
    await boot(page);
    await openEditor(page);
    await newBig(page, 2, 1);
    await openMap(page);
    await tool(page, 'fill');
    await page.mouse.click(...(await at(page, 20, 3)));        // glyph 33
    expect(await ink(page, 33)).toBe(16 * 8);
    expect(await ink(page, 32)).toBe(0);
    expect(await ink(page, 34)).toBe(0);
    await page.keyboard.press('Control+z');
    expect(await ink(page, 33)).toBe(0);
});

test('keyboard: arrows move the selection, a typed character jumps to it', async ({ page }) => {
    await boot(page);
    await openEditor(page);
    await newBig(page, 1, 1);
    await openMap(page);
    await page.locator('.fe-map-viewport').focus();
    const sel = () => page.evaluate(() => FontEditorDialog._selected);
    const start = await sel();
    await page.keyboard.press('ArrowRight');
    expect(await sel()).toBe(start + 1);
    await page.keyboard.press('ArrowDown');
    expect(await sel()).toBe(start + 17);
    await page.keyboard.press('Home');
    expect(await sel()).toBe(32);
    await page.keyboard.type('W');
    expect(await sel()).toBe(87);
    await page.keyboard.press('End');
    expect(await sel()).toBe(127);
});

test('keyboard works on the character picker too', async ({ page }) => {
    await boot(page);
    await openEditor(page);
    await page.locator('.fe-glyph-grid').focus();
    const start = await page.evaluate(() => FontEditorDialog._selected);
    await page.keyboard.press('ArrowLeft');
    expect(await page.evaluate(() => FontEditorDialog._selected)).toBe(start - 1);
});

test('shade tool: a click shades from the nearer edge, a second click un-shades, Space is refused', async ({ page }) => {
    await boot(page);
    await openEditor(page);
    await newBig(page, 3, 1);
    await openMap(page);
    await tool(page, 'shade');
    // glyph 33 = cell 1 of a 24-wide font: x 24..47, columns 0,1,2 at x 24..31, 32..39, 40..47
    await page.mouse.click(...(await at(page, 26, 3)));
    expect(await page.evaluate(() => FontService.getShade(33))).toEqual({ left: 1, right: 0 });
    await page.mouse.click(...(await at(page, 44, 3)));
    expect(await page.evaluate(() => FontService.getShade(33))).toEqual({ left: 1, right: 1 });
    await page.mouse.click(...(await at(page, 26, 3)));
    expect(await page.evaluate(() => FontService.getShade(33))).toEqual({ left: 0, right: 1 });
    // Space (cell 0): the first click shades its left column, a click in the middle column would shade all three (refused), the last
    // column then shades from the right
    await page.mouse.click(...(await at(page, 2, 3)));
    expect(await page.evaluate(() => FontService.getShade(32))).toEqual({ left: 1, right: 0 });
    await page.mouse.click(...(await at(page, 10, 3)));
    expect(await page.evaluate(() => FontService.getShade(32))).toEqual({ left: 1, right: 0 });
    await expect(page.locator('.fe-status')).toContainText(/Space must keep/i);
    await page.mouse.click(...(await at(page, 18, 3)));
    expect(await page.evaluate(() => FontService.getShade(32))).toEqual({ left: 1, right: 1 });
    // each shading click is one undo step
    await page.keyboard.press('Control+z');
    expect(await page.evaluate(() => FontService.getShade(33))).toEqual({ left: 0, right: 1 });
});

test('a character shaded all the way across is hatched over its whole width', async ({ page }) => {
    await boot(page);
    await openEditor(page);
    await newBig(page, 2, 1);
    await page.evaluate(() => FontService.setShade(40, 1, 1));
    await openMap(page);
    const sampled = await page.evaluate(() => {
        const v = FontEditorDialog._mapView;
        const z = v.getZoom();
        const idx = 40 - 32;
        const r = FontMap.glyphRect(idx, 16, 8);
        const ctx = v.canvas.getContext('2d');
        // two sample points in different columns, away from the cell edges
        const px = (x, y) => Array.from(ctx.getImageData(Math.floor((r.x + x) * z) + 1, Math.floor((r.y + y) * z) + 1, 1, 1).data);
        const plain = (() => { const q = FontMap.glyphRect(idx + 1, 16, 8); return Array.from(ctx.getImageData(Math.floor((q.x + 3) * z) + 1, Math.floor((q.y + 3) * z) + 1, 1, 1).data); })();
        return { shadedA: px(3, 3), shadedB: px(11, 3), plain };
    });
    expect(sampled.shadedA).not.toEqual(sampled.plain);
    expect(sampled.shadedB).not.toEqual(sampled.plain);
});

test('move tool drags the map under a small window; zoom buttons change the scale', async ({ page }) => {
    await boot(page);
    await openEditor(page);
    await newBig(page, 4, 4, 'FULL');
    await openMap(page);
    const z0 = await page.evaluate(() => FontEditorDialog._mapView.getZoom());
    await page.click('.fe-zoom-in');
    const z1 = await page.evaluate(() => FontEditorDialog._mapView.getZoom());
    expect(z1).toBeGreaterThanOrEqual(z0);
    expect(z1).toBeLessThanOrEqual(3);                     // 512 pixels wide: 1600 / 512 = 3
    for (let i = 0; i < 4; i++) await page.click('.fe-zoom-in');
    expect(await page.evaluate(() => FontEditorDialog._mapView.getZoom())).toBe(3);
    await tool(page, 'move');
    const vp = page.locator('.fe-map-viewport');
    const box = await vp.boundingBox();
    const before = await vp.evaluate(el => [el.scrollLeft, el.scrollTop]);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 - 60, box.y + box.height / 2 - 60, { steps: 4 });
    await page.mouse.up();
    const after = await vp.evaluate(el => [el.scrollLeft, el.scrollTop]);
    expect(after[0] + after[1]).toBeGreaterThan(before[0] + before[1]);
    expect(await ink(page, 32), 'the Move tool draws nothing').toBe(0);
    await page.click('.fe-zoom-fit');
    expect(await page.evaluate(() => FontEditorDialog._mapView.getZoom())).toBeGreaterThanOrEqual(1);
});

test('pointer handling per move stays under a frame on the heaviest map', async ({ page }) => {
    await boot(page);
    await openEditor(page);
    await newBig(page, 4, 4, 'FULL');
    await openMap(page);
    const ms = await page.evaluate(() => {
        const v = FontEditorDialog._mapView;
        const c = v.canvas;
        const r = c.getBoundingClientRect();
        const z = v.getZoom();
        const ev = (type, x, y) => new PointerEvent(type, { clientX: r.x + x * z, clientY: r.y + y * z, pointerId: 1, buttons: 1, bubbles: true });
        c.dispatchEvent(ev('pointerdown', 5, 5));
        const t0 = performance.now();
        const N = 200;
        for (let i = 0; i < N; i++) c.dispatchEvent(ev('pointermove', 5 + (i * 2) % 300, 5 + (i * 3) % 300));
        const t1 = performance.now();
        c.dispatchEvent(ev('pointerup', 5, 5));
        return (t1 - t0) / N;
    });
    console.log('map pointermove handling, ms per move at 512 x 512:', ms.toFixed(3));
    expect(ms).toBeLessThan(16.7);
});

test('at a phone width the map stays inside the dialog and scrolls', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await boot(page);
    await openEditor(page);
    await newBig(page, 3, 3, 'FULL');
    await openMap(page);
    const m = await page.evaluate(() => {
        const dlg = document.querySelector('.font-editor-dialog');
        const vp = document.querySelector('.fe-map-viewport');
        return { dlg: dlg.getBoundingClientRect().right, vp: vp.getBoundingClientRect().right, scrollW: vp.scrollWidth, clientW: vp.clientWidth, page: document.documentElement.scrollWidth, win: window.innerWidth };
    });
    expect(m.vp).toBeLessThanOrEqual(m.dlg + 1);
    expect(m.page).toBeLessThanOrEqual(m.win + 1);
});
