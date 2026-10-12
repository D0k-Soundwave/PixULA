'use strict';
/**
 * Batch 9 part 9A2 in a real browser: the Selection tool's Size row. The block maths is pinned in Node
 * (tests/selection-size.test.js, snap-grid.test.js); this checks the row's visibility, a click and a drag through the real
 * pointer pipeline, and that Screen opens up only on a canvas bigger than one screen.
 */
const { test, expect } = require('@playwright/test');
const { boot, selectMode } = require('./helpers');

async function pixelPoint(page, px, py) {
    const box = await page.frameLocator('#canvas-frame').locator('#main-canvas').boundingBox();
    const dims = await page.evaluate(() => ({ w: ZX_SPECTRUM.WIDTH, h: ZX_SPECTRUM.HEIGHT }));
    return { x: box.x + (px + 0.5) * box.width / dims.w, y: box.y + (py + 0.5) * box.height / dims.h };
}
const sel = (page) => page.evaluate(() => { const s = SelectionService.getSelection(); return s ? [s.x, s.y, s.width, s.height] : null; });
async function drag(page, x1, y1, x2, y2) {
    const a = await pixelPoint(page, x1, y1), b = await pixelPoint(page, x2, y2);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 4 });
    await page.mouse.up();
    await page.waitForTimeout(200);
}
const setSelect = (page, id, v) => page.evaluate(([i, val]) => {
    const el = document.getElementById(i);
    el.value = val;
    el.dispatchEvent(new Event('change', { bubbles: true }));
}, [id, v]);

test('the Size row shows for Rectangle only, and the custom sizes only for Custom', async ({ page }) => {
    await boot(page);
    await page.click('.tool-btn[data-tool="selection"]');
    await expect(page.locator('#opt-selectSize')).toBeVisible();
    await expect(page.locator('#opt-selectSizeX')).toBeHidden();
    await setSelect(page, 'opt-selectSize', 'custom');
    await expect(page.locator('#opt-selectSizeX')).toBeVisible();
    await expect(page.locator('#opt-selectSizeY')).toBeVisible();
    await setSelect(page, 'opt-selectMode', 'ellipse');
    await expect(page.locator('#opt-selectSize')).toBeHidden();
    expect(await page.locator('#opt-selectSize option').count()).toBe(5);
});

test('a click picks one 16x16 block, a drag whole blocks', async ({ page }) => {
    await boot(page);
    await page.click('.tool-btn[data-tool="selection"]');
    await setSelect(page, 'opt-selectSize', 'block16');
    await drag(page, 40, 40, 40, 40);
    expect(await sel(page)).toEqual([40, 40, 16, 16]);
    await drag(page, 40, 40, 80, 70);
    const s = await sel(page);
    expect(s.slice(0, 2)).toEqual([40, 40]);
    expect(s[2] % 16).toBe(0);
    expect(s[3] % 16).toBe(0);
    expect(s[2]).toBeGreaterThanOrEqual(48);
});

test('Screen is greyed out on a one-screen canvas and opens up on Layer 2 640', async ({ page }) => {
    await boot(page);
    page.on('dialog', (d) => d.accept());
    await page.click('.tool-btn[data-tool="selection"]');
    expect(await page.locator('#opt-selectSize option[value="screen"]').isDisabled()).toBe(true);
    await selectMode(page, 'layer2_640');
    await page.click('.tool-btn[data-tool="brush"]');
    await page.click('.tool-btn[data-tool="selection"]');
    expect(await page.locator('#opt-selectSize option[value="screen"]').isDisabled()).toBe(false);
    await setSelect(page, 'opt-selectSize', 'screen');
    await drag(page, 300, 20, 300, 20);
    expect(await sel(page)).toEqual([300, 20, 256, 192]);
});

test('Cell size: a click in the right half of a cell selects that cell', async ({ page }) => {
    await boot(page);
    await page.click('.tool-btn[data-tool="selection"]');
    await setSelect(page, 'opt-selectSize', 'cell');
    await page.keyboard.press('Shift+S');                 // Snap on
    await drag(page, 14, 14, 14, 14);
    expect(await sel(page)).toEqual([8, 8, 8, 8]);
});
