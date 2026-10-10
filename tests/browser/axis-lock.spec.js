'use strict';
/**
 * Batch 7 part 7C2 in a real browser: hold X or Y while dragging and the stroke stays on one line; tapping X still
 * swaps ink and paper (now when the key comes up). The projection rules are pinned in Node (tests/axis-lock.test.js).
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

async function pixelPoint(page, px, py) {
    const box = await page.frameLocator('#canvas-frame').locator('#main-canvas').boundingBox();
    const dims = await page.evaluate(() => ({ w: ZX_SPECTRUM.WIDTH, h: ZX_SPECTRUM.HEIGHT }));
    return { x: box.x + (px + 0.5) * box.width / dims.w, y: box.y + (py + 0.5) * box.height / dims.h };
}
const rowsWithInk = (page) => page.evaluate(() => {
    const layer = LayerManager.getCurrentLayer();
    const rows = new Set(), cols = new Set();
    for (let cy = 0; cy < ZX_SPECTRUM.GRID_ROWS; cy++) for (let cx = 0; cx < ZX_SPECTRUM.GRID_COLS; cx++) {
        const c = layer.getCell(cx, cy);
        if (!c || !c.altered) continue;
        for (let r = 0; r < 8; r++) for (let b = 0; b < 8; b++) {
            if ((c.pixels[r] >> (7 - b)) & 1) { rows.add(cy * 8 + r); cols.add(cx * 8 + b); }
        }
    }
    return { rows: [...rows], cols: [...cols] };
});

async function stroke(page, key) {
    await page.click('.tool-btn[data-tool="brush"]');
    const a = await pixelPoint(page, 40, 60);
    const b = await pixelPoint(page, 120, 110);
    await page.mouse.move(a.x, a.y);
    await page.keyboard.down(key);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 8 });
    await page.mouse.up();
    await page.keyboard.up(key);
    await page.waitForTimeout(300);
}

test('holding X keeps a brush stroke horizontal', async ({ page }) => {
    await boot(page);
    await stroke(page, 'x');
    const { rows, cols } = await rowsWithInk(page);
    expect(rows.length, 'one row of dots').toBeLessThanOrEqual(1);
    expect(cols.length, 'and it ran along').toBeGreaterThan(40);
});

test('holding Y keeps a brush stroke vertical', async ({ page }) => {
    await boot(page);
    await stroke(page, 'y');
    const { rows, cols } = await rowsWithInk(page);
    expect(cols.length, 'one column of dots').toBeLessThanOrEqual(1);
    expect(rows.length).toBeGreaterThan(30);
});

test('tapping X still swaps ink and paper; holding it through a stroke does not', async ({ page }) => {
    await boot(page);
    const sel = () => page.evaluate(() => JSON.stringify(ColorManager.getCurrentSelection()));
    const before = await sel();
    await page.keyboard.press('x');
    const swapped = await sel();
    expect(swapped).not.toBe(before);
    await page.keyboard.press('x');
    expect(await sel()).toBe(before);
    await stroke(page, 'x');
    expect(await sel(), 'locking an axis is not a swap').toBe(before);
});
