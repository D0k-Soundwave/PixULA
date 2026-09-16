'use strict';
/**
 * The tool's own pointer. Over the picture the system crosshair is replaced by
 * two things: a small hollow ring drawn by the operating system, which marks
 * the POSITION with no frame lag, and the tool's footprint on the pointer
 * canvas, which marks the SIZE and the colour each pixel will be left in - the
 * outline at size 2 and up, the single pixel at size 1. Over the grey surround
 * the crosshair comes back; pan and zoom keep their own cursors.
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

/** The hardware position ring GridOverlay hands out (an SVG cursor, no arms). */
const ringCursor = (page) => page.evaluate(() => CanvasSystem.getIframeDocument().body.style.cursor
    .replace(/\s+/g, ' ') === GridOverlay.positionCursor().replace(/\s+/g, ' '));

/** RGBA of one pixel of the POINTER layer the mark is drawn on (its own
 *  canvas since 2026-09-16, so a tool's preview cannot clear it). */
const overlayAt = (page, x, y) => page.evaluate(([px, py]) =>
    Array.from(GridOverlay.pointerCtx.getImageData(px, py, 1, 1).data), [x, y]);

/** How many overlay pixels carry any ink at all. */
const overlayCount = (page) => page.evaluate(() => {
    const c = GridOverlay.pointerCanvas;
    const d = GridOverlay.pointerCtx.getImageData(0, 0, c.width, c.height).data;
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

    expect(await ringCursor(page)).toBe(true);
    expect(await overlayCount(page), 'the outline is drawn').toBeGreaterThan(8);
});

/*
 * ONE pixel, the size of the mark itself. It was a 3x3 plus for a day, and a
 * plus is a crosshair - the thing the artist asked to be rid of - which kept
 * its shape at every zoom while the pixel it surrounded grew (2026-09-16).
 */
test('size 1: exactly the one pixel it will paint, in the colour it will paint', async ({ page }) => {
    await boot(page);
    await page.keyboard.press('b');
    await setSize(page, 1);
    await page.evaluate(() => { ColorManager.setInk(2); ColorManager.setBright(true); });
    await hover(page, 100, 100);

    expect(await ringCursor(page)).toBe(true);
    expect(await overlayAt(page, 100, 100), 'the pixel = bright red').toEqual(await paletteRGBA(page, 10));
    for (const [x, y] of [[99, 100], [101, 100], [100, 99], [100, 101], [99, 99], [101, 101]]) {
        expect((await overlayAt(page, x, y))[3], `nothing around it at ${x},${y}`).toBe(0);
    }
    expect(await overlayCount(page), 'exactly one pixel').toBe(1);

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
    expect(await ringCursor(page), 'mid-stroke').toBe(true);
    expect(await overlayAt(page, 70, 60), 'the dot is at the pointer, mid-stroke')
        .toEqual(await paletteRGBA(page, 2));
    expect(await overlayCount(page)).toBe(1);

    await page.mouse.up();
    expect(await ringCursor(page), 'after release').toBe(true);
    expect(await overlayCount(page), 'still marked after release').toBeGreaterThan(0);
});

test('the pointer comes back over the grey surround', async ({ page }) => {
    await boot(page);
    await page.keyboard.press('b');
    await setSize(page, 8);
    await hover(page, 100, 100);
    expect(await ringCursor(page)).toBe(true);

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

/*
 * Every tool that marks the picture shows its OWN mark instead of a pointer -
 * the crosshair is gone from the picture entirely (the artist's ask,
 * 2026-09-16). The ones that mark nothing keep the cursor that names what they
 * do: the pan hand, the zoom lens.
 */
test('every marking tool hides the system pointer; pan and zoom keep their own', async ({ page }) => {
    await boot(page);
    await page.keyboard.press('b');
    await setSize(page, 8);
    await hover(page, 100, 100);
    expect(await ringCursor(page), 'brush').toBe(true);

    // Spray rides on the brush: switching with the pointer parked keeps it hidden
    await page.keyboard.press('a');
    await page.evaluate(() => new Promise((r) => setTimeout(r, 0)));
    expect(await ringCursor(page), 'spray').toBe(true);

    // The tools that used to keep a crosshair (or the eraser's cell cursor)
    let x = 110;
    for (const [id, name] of [['eraser', 'eraser'], ['fill', 'fill'],
        ['eyedropper', 'eyedropper'], ['rectangle', 'rectangle'],
        ['bezier', 'curve'], ['gradient', 'gradient'], ['selection', 'selection'],
        ['text', 'text']]) {
        await page.evaluate((t) => ToolManager.selectTool(t), id);
        await hover(page, x, 100);
        x += 4;
        expect(await ringCursor(page), name).toBe(true);
    }

    // Pan and zoom mark nothing, so they keep the cursor that names what they do
    await page.evaluate(() => ToolManager.selectTool(TOOLS.MOVE));
    await hover(page, 140, 100);
    expect(await bodyCursor(page), 'pan').toBe('grab');
    await page.evaluate(() => ToolManager.selectTool(TOOLS.ZOOM));
    await hover(page, 144, 100);
    expect(await bodyCursor(page), 'zoom').toBe('zoom-in');
});
