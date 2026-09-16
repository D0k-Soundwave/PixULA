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

/**
 * One stroke clears dots and keeps the colours; a SECOND stroke over the now
 * empty cells wipes them. The Node suite drives the tool directly; this is the
 * real pointer path, where InputHandler decides where a stroke begins and ends
 * - and a "pass" is exactly that stroke.
 */
test('the eraser keeps colours on the first stroke and wipes them on the second', async ({ page }) => {
    await boot(page);
    // Two cells fully inked in bright flashing red on cyan, on the drawing layer
    await page.evaluate(() => {
        const layer = LayerManager.getCurrentLayer();
        for (const cx of [10, 11]) {
            const c = layer.getCell(cx, 10);
            c.pixels.fill(0xFF);
            c.ink = 2; c.paper = 5; c.bright = true; c.flash = true;
            c.altered = true;
        }
    });
    const cells = () => page.evaluate(() => [10, 11].map((cx) => {
        const c = LayerManager.getCurrentLayer().getCell(cx, 10);
        return { ink: c.ink, paper: c.paper, bright: c.bright, flash: c.flash,
                 altered: c.altered, inked: c.pixels.some((r) => r !== 0) };
    }));

    await page.keyboard.press('e');
    await setSize(page, 32);
    const from = await pixelPoint(page, 84, 84);
    const to = await pixelPoint(page, 91, 84);
    const drag = async () => {
        await page.mouse.move(from.x, from.y);
        await page.mouse.down();
        await page.mouse.move(to.x, to.y, { steps: 4 });
        await page.mouse.move(from.x, from.y, { steps: 4 });   // back over the same cells
        await page.mouse.up();
    };

    await drag();
    const kept = { ink: 2, paper: 5, bright: true, flash: true, altered: true, inked: false };
    expect(await cells(), 'first stroke: dots gone, colours kept').toEqual([kept, kept]);

    await drag();
    const wiped = { ink: 0, paper: 7, bright: false, flash: false, altered: false, inked: false };
    expect(await cells(), 'second stroke: colours wiped, cells transparent').toEqual([wiped, wiped]);
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
