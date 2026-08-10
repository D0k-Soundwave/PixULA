'use strict';
/**
 * The eraser's size range, end to end: the slider the artist actually drags
 * offers 128, and a stroke at 128 clears the area the disc promises.
 *
 * The Node suite pins the geometry and the per-stroke dedupe
 * (tests/tool-footprint.test.js); what only a browser can show is that the
 * schema reaches the DOM control and that a real drag at the top of the range
 * clears a wide swathe without the app stalling.
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

/** Page coordinates of the centre of app pixel (px, py). */
async function pixelPoint(page, px, py) {
    const box = await page.frameLocator('#canvas-frame').locator('#main-canvas').boundingBox();
    const dims = await page.evaluate(() => ({ w: ZX_SPECTRUM.WIDTH, h: ZX_SPECTRUM.HEIGHT }));
    return {
        x: box.x + (px + 0.5) * box.width / dims.w,
        y: box.y + (py + 0.5) * box.height / dims.h
    };
}

const isInk = (page, x, y) => page.evaluate(([px, py]) =>
    PixelDrawRoutine.getPixelState(px, py)?.isInk === true, [x, y]);

/** Ink the whole canvas so an erase has something to remove. */
const inkAll = (page) => page.evaluate(() => {
    const sel = ColorManager.getCurrentSelection();
    PixelDrawRoutine.beginBatch();
    for (let y = 0; y < ZX_SPECTRUM.HEIGHT; y++) {
        for (let x = 0; x < ZX_SPECTRUM.WIDTH; x++) {
            PixelDrawRoutine.draw(x, y, sel, DRAW_MODE.NORMAL);
        }
    }
    PixelDrawRoutine.endBatch();
});

/** Drive the size slider as a drag would. */
const setSize = (page, value) => page.evaluate((v) => {
    const el = document.getElementById('opt-size');
    el.value = String(v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
}, value);

test('the eraser size slider runs to 128', async ({ page }) => {
    await boot(page);
    await page.keyboard.press('e');

    const slider = page.locator('#opt-size');
    await expect(slider).toHaveAttribute('max', '128');
    await expect(slider).toHaveAttribute('min', '1');

    await setSize(page, 128);
    expect(await page.evaluate(() => ToolManager.getCurrentTool().getSize())).toBe(128);
});

test('a size-128 drag clears the swathe the disc promises', async ({ page }) => {
    await boot(page);
    await inkAll(page);
    await page.keyboard.press('e');
    await setSize(page, 128);

    const from = await pixelPoint(page, 70, 96);
    const to = await pixelPoint(page, 180, 96);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 4 });
    await page.mouse.up();

    // On the path, and 60 px off it either way — the disc's radius is 63.75.
    for (const [x, y] of [[70, 96], [125, 96], [180, 96], [125, 36], [125, 156]]) {
        expect(await isInk(page, x, y), `cleared at ${x},${y}`).toBe(false);
    }

    // The top corners are out of reach of every stamp on the path.
    for (const [x, y] of [[10, 10], [250, 10]]) {
        expect(await isInk(page, x, y), `untouched at ${x},${y}`).toBe(true);
    }
});
