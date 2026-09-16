'use strict';
/**
 * The brush's own pointer. Over the picture the system crosshair is hidden
 * and the brush footprint stands in for it: the outline at size 2 and up, and
 * at size 1 a 3x3 plus whose centre is the pixel the click will paint, in the
 * colour it will paint. Over the grey surround the pointer comes back, and
 * every other tool keeps its own cursor.
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

/** Page coordinates of the centre of picture pixel (px, py). */
async function pixelPoint(page, px, py) {
    const box = await page.frameLocator('#canvas-frame').locator('#main-canvas').boundingBox();
    const dims = await page.evaluate(() => ({ w: ZX_SPECTRUM.WIDTH, h: ZX_SPECTRUM.HEIGHT }));
    return {
        x: box.x + (px + 0.5) * box.width / dims.w,
        y: box.y + (py + 0.5) * box.height / dims.h
    };
}

const hover = async (page, px, py) => {
    const p = await pixelPoint(page, px, py);
    await page.mouse.move(p.x, p.y);
};

const bodyCursor = (page) => page.evaluate(() => CanvasSystem.getIframeDocument().body.style.cursor);

/** RGBA of one pixel of the overlay the footprint is drawn on. */
const overlayAt = (page, x, y) => page.evaluate(([px, py]) =>
    Array.from(GridOverlay.functionPreviewCtx.getImageData(px, py, 1, 1).data), [x, y]);

/** How many overlay pixels carry any ink at all. */
const overlayCount = (page) => page.evaluate(() => {
    const c = GridOverlay.functionPreviewCanvas;
    const d = GridOverlay.functionPreviewCtx.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
    return n;
});

/** The palette RGB the dot must be, as [r, g, b, 255]. */
const paletteRGBA = (page, index) => page.evaluate((i) => [...ColorManager.getRGB(i), 255], index);

const setSize = (page, value) => page.evaluate((v) => {
    const el = document.getElementById('opt-size');
    el.value = String(v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
}, value);

test('size 8: only the outline over the picture, no system pointer', async ({ page }) => {
    await boot(page);
    await page.keyboard.press('b');
    await setSize(page, 8);
    await hover(page, 100, 100);

    expect(await bodyCursor(page)).toBe('none');
    expect(await overlayCount(page), 'the outline is drawn').toBeGreaterThan(8);
});

test('size 1: a 3x3 plus whose centre is the ink it will paint', async ({ page }) => {
    await boot(page);
    await page.keyboard.press('b');
    await setSize(page, 1);
    await page.evaluate(() => { ColorManager.setInk(2); ColorManager.setBright(true); });
    await hover(page, 100, 100);

    expect(await bodyCursor(page)).toBe('none');
    expect(await overlayAt(page, 100, 100), 'centre = bright red').toEqual(await paletteRGBA(page, 10));
    for (const [x, y] of [[99, 100], [101, 100], [100, 99], [100, 101]]) {
        expect((await overlayAt(page, x, y))[3], `arm at ${x},${y}`).toBeGreaterThan(0);
    }
    for (const [x, y] of [[99, 99], [101, 101], [98, 100], [100, 102]]) {
        expect((await overlayAt(page, x, y))[3], `nothing at ${x},${y}`).toBe(0);
    }
    expect(await overlayCount(page), 'exactly five pixels').toBe(5);

    // The dot follows the colour controls without the pointer moving
    await page.evaluate(() => ColorManager.setInk(4));
    expect(await overlayAt(page, 100, 100), 'new ink').toEqual(await paletteRGBA(page, 12));
    await page.evaluate(() => ColorManager.setBright(false));
    expect(await overlayAt(page, 100, 100), 'Bright off').toEqual(await paletteRGBA(page, 4));
});

test('the mark follows the pointer through a stroke', async ({ page }) => {
    await boot(page);
    await page.keyboard.press('b');
    await setSize(page, 1);
    await page.evaluate(() => { ColorManager.setInk(2); ColorManager.setBright(false); });

    await hover(page, 60, 60);
    await page.mouse.down();
    await hover(page, 70, 60);
    expect(await bodyCursor(page), 'mid-stroke').toBe('none');
    expect(await overlayAt(page, 70, 60), 'the dot is at the pointer, mid-stroke')
        .toEqual(await paletteRGBA(page, 2));
    expect(await overlayCount(page)).toBe(5);

    await page.mouse.up();
    expect(await bodyCursor(page), 'after release').toBe('none');
    expect(await overlayCount(page), 'still marked after release').toBeGreaterThan(0);
});

test('the pointer comes back over the grey surround', async ({ page }) => {
    await boot(page);
    await page.keyboard.press('b');
    await setSize(page, 8);
    await hover(page, 100, 100);
    expect(await bodyCursor(page)).toBe('none');

    const frame = await page.locator('#canvas-frame').boundingBox();
    const canvas = await page.frameLocator('#canvas-frame').locator('#main-canvas').boundingBox();
    // A point inside the canvas frame but outside the picture, on whichever side has room
    const outside = canvas.x - frame.x > 6
        ? { x: canvas.x - 3, y: canvas.y + canvas.height / 2 }
        : { x: canvas.x + canvas.width / 2, y: canvas.y + canvas.height + 3 };
    expect(outside.y < frame.y + frame.height && outside.x > frame.x, 'test needs a surround').toBe(true);
    await page.mouse.move(outside.x, outside.y);
    expect(await bodyCursor(page)).toBe('crosshair');
});

test('other tools keep their own cursor; brush variants share the brush pointer', async ({ page }) => {
    await boot(page);
    await page.keyboard.press('b');
    await setSize(page, 8);
    await hover(page, 100, 100);
    expect(await bodyCursor(page)).toBe('none');

    // Spray rides on the brush: switching with the pointer parked keeps it hidden
    await page.keyboard.press('a');
    await page.evaluate(() => new Promise((r) => setTimeout(r, 0)));
    expect(await bodyCursor(page), 'spray').toBe('none');

    await page.keyboard.press('e');
    await hover(page, 110, 100);
    expect(await bodyCursor(page), 'eraser').toBe('cell');

    await page.keyboard.press('g');
    await hover(page, 120, 100);
    expect(await bodyCursor(page), 'fill').toBe('crosshair');
});
