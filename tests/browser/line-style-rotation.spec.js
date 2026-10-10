'use strict';
/**
 * Batch 7 part 7B in a real browser: the Line style, Rotation and Rounding options. The patterns, the turned outlines and
 * the radius are pinned in Node (tests/shape-rotation.test.js); here: the rows are there when they should be, the dash
 * styles grey out above thickness 1 with their hint, and drawing by mouse gives the dashed / turned / rounded result.
 */
const { test, expect } = require('@playwright/test');
const { boot, selectMode } = require('./helpers');

async function pixelPoint(page, px, py) {
    const box = await page.frameLocator('#canvas-frame').locator('#main-canvas').boundingBox();
    const dims = await page.evaluate(() => ({ w: ZX_SPECTRUM.WIDTH, h: ZX_SPECTRUM.HEIGHT }));
    return { x: box.x + (px + 0.5) * box.width / dims.w, y: box.y + (py + 0.5) * box.height / dims.h };
}
async function drag(page, x1, y1, x2, y2) {
    const a = await pixelPoint(page, x1, y1);
    const b = await pixelPoint(page, x2, y2);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 6 });
    await page.mouse.up();
}
async function pickShape(page, value) {
    await page.click('.tool-btn[data-tool="shape"]');
    await page.click(`#tool-options-panel .tool-btn[data-value="${value}"]`);
}
const dotAt = (page, x, y) => page.evaluate(([px, py]) => {
    const c = LayerManager.getCurrentLayer().getCell(Math.floor(px / 8), Math.floor(py / 8));
    return !!c && ((c.pixels[py % 8] >> (7 - (px % 8))) & 1) === 1;
}, [x, y]);
const optionDisabled = (page, value) => page.evaluate((v) =>
    document.querySelector(`#opt-lineStyle option[value="${v}"]`).disabled, value);
const rowVisible = (page, key) => page.evaluate((k) => {
    const el = document.querySelector(`#opt-${k}`);
    return !!el && !el.closest('[hidden]') && el.offsetParent !== null;
}, key);

test('the dash styles grey out above thickness 1, with a hint, and come back at 1', async ({ page }) => {
    await boot(page);
    await page.click('.tool-btn[data-tool="shape"]');
    await expect(page.locator('#opt-lineStyle')).toBeVisible();
    for (const v of ['dashed', 'dotted', 'dash-dot', 'dash-dot-dot']) expect(await optionDisabled(page, v), v).toBe(false);
    await page.locator('#opt-thickness').fill('3');
    for (const v of ['dashed', 'dotted', 'dash-dot', 'dash-dot-dot']) expect(await optionDisabled(page, v), v + ' at 3').toBe(true);
    expect(await optionDisabled(page, 'solid')).toBe(false);
    expect(await optionDisabled(page, 'clear')).toBe(false);
    await expect(page.locator('#tool-options-panel')).toContainText('thickness of 1');
    await page.locator('#opt-thickness').fill('1');
    expect(await optionDisabled(page, 'dashed')).toBe(false);
});

test('a dashed rectangle drawn by mouse has gaps; clear draws nothing until it is filled', async ({ page }) => {
    await boot(page);
    await pickShape(page, 'rectangle');
    await page.locator('#opt-lineStyle').selectOption('dashed');
    await drag(page, 40, 40, 55, 55);               // 16 x 16: the help picture's rectangle
    expect(await dotAt(page, 55, 40), 'start of the top row, from the right').toBe(true);
    expect(await dotAt(page, 40, 43), 'the first gap on the left side (y 3 to 8 below the top)').toBe(false);
    expect(await dotAt(page, 40, 49), 'then a dash again').toBe(true);
    await page.keyboard.press('Control+z');

    await page.locator('#opt-lineStyle').selectOption('clear');
    await expect(page.locator('#tool-options-panel')).toContainText('Clear draws no outline');
    await drag(page, 40, 40, 55, 55);
    expect(await dotAt(page, 40, 40)).toBe(false);
    await page.locator('#opt-filled').check();
    await drag(page, 40, 40, 55, 55);
    expect(await dotAt(page, 47, 47), 'filled + clear: the inside is drawn').toBe(true);
    expect(await dotAt(page, 40, 47), 'and the outline is not').toBe(false);
});

test('rotation shows for rectangle and ellipse, not for circle or star, and a quarter turn swaps a rectangle', async ({ page }) => {
    await boot(page);
    await pickShape(page, 'rectangle');
    expect(await rowVisible(page, 'rotation')).toBe(true);
    await pickShape(page, 'ellipse');
    expect(await rowVisible(page, 'rotation')).toBe(true);
    await pickShape(page, 'circle');
    expect(await rowVisible(page, 'rotation')).toBe(false);
    await pickShape(page, 'star');
    expect(await rowVisible(page, 'rotation')).toBe(false);

    await pickShape(page, 'rectangle');
    await page.locator('#opt-rotation').fill('90');
    await drag(page, 40, 60, 70, 70);               // 31 wide x 11 high; turned it is 11 wide x 31 high round (55, 65)
    expect(await dotAt(page, 50, 50), 'top-left of the turned rectangle').toBe(true);
    expect(await dotAt(page, 60, 80), 'bottom-right of the turned rectangle').toBe(true);
    expect(await dotAt(page, 40, 60), 'the old corner is empty').toBe(false);
});

test('rounding shows only for the rounded rectangle; 0 makes square corners', async ({ page }) => {
    await boot(page);
    await pickShape(page, 'rectangle');
    expect(await rowVisible(page, 'rounding')).toBe(false);
    await pickShape(page, 'rounded-rectangle');
    expect(await rowVisible(page, 'rounding')).toBe(true);
    await page.locator('#opt-rounding').fill('0');
    await drag(page, 40, 40, 80, 70);
    expect(await dotAt(page, 40, 40), 'square corner').toBe(true);
});

test('the Bezier list has no Clear style, and a dashed curve has gaps', async ({ page }) => {
    await boot(page);
    await pickShape(page, 'bezier');
    expect(await page.evaluate(() => !!document.querySelector('#opt-lineStyle option[value="clear"]'))).toBe(false);
    expect(await page.evaluate(() => !!document.querySelector('#opt-lineStyle option[value="dashed"]'))).toBe(true);
    await page.locator('#opt-lineStyle').selectOption('dashed');
    await drag(page, 20, 100, 67, 100);
    await page.keyboard.press('Enter');
    expect(await dotAt(page, 30, 100), 'on').toBe(true);
    expect(await dotAt(page, 40, 100), 'gap (pixel 20 of 48)').toBe(false);
});

test('a dashed shape draws in an indexed mode too', async ({ page }) => {
    await boot(page);
    page.on('dialog', (d) => d.accept());
    await selectMode(page, 'layer2_256');
    await pickShape(page, 'rectangle');
    await page.locator('#opt-lineStyle').selectOption('dashed');
    await drag(page, 40, 40, 55, 55);
    const n = await page.evaluate(() => {
        const L = LayerManager.getCurrentLayer();
        let c = 0;
        for (let cy = 4; cy <= 7; cy++) for (let cx = 4; cx <= 7; cx++) {
            const cell = L.getCell(cx, cy);
            if (cell && cell.indices) for (const v of cell.indices) if (v >= 0) c++;
        }
        return c;
    });
    expect(n, '48 dashes of the 60 outline pixels').toBe(48);
});
