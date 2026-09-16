'use strict';
/**
 * The tool's own pointer. Over the picture the system pointer IS the brush:
 * the tool's mark rendered as the cursor image, one brush pixel per canvas
 * pixel at the current zoom, each pixel in the colour it will be left in, so
 * the operating system moves it with no app lag. Where Chrome would refuse the
 * image (over 128 DIP, or crossing the window edge) the same mark is drawn on
 * the pointer canvas and the system cursor is hidden. Over the grey surround
 * the crosshair comes back; pan and zoom keep their own cursors.
 *
 * A test cannot see a system cursor, so the mark is read from
 * GridOverlay.markPixels(), which records the same pixels whichever way they
 * are shown, and the cursor from the style the page set.
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

/** Is the system pointer the hardware brush cursor (an image, not a keyword)? */
const brushCursor = (page) => page.evaluate(() => {
    const cur = CanvasSystem.getIframeDocument().body.style.cursor;
    const mark = GridOverlay.markPixels();
    return /^(image-set\()?url\("data:image\/png/.test(cur) && !!mark && mark.via === 'cursor';
});

/** RGBA of one pixel of the mark, as [r, g, b, 255], or [0, 0, 0, 0] if the
 *  mark does not cover it. */
const overlayAt = (page, x, y) => page.evaluate(([px, py]) => {
    const mark = GridOverlay.markPixels();
    const hit = mark && mark.points.find((q) => q.x === px && q.y === py);
    if (!hit) return [0, 0, 0, 0];
    const m = hit.colour.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    return m ? [+m[1], +m[2], +m[3], 255] : [-1, -1, -1, 255];
}, [x, y]);

/** How many pixels the mark covers. */
const overlayCount = (page) => page.evaluate(() => {
    const mark = GridOverlay.markPixels();
    return mark ? mark.points.length : 0;
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

    expect(await brushCursor(page)).toBe(true);
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

    expect(await brushCursor(page)).toBe(true);
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
    expect(await brushCursor(page), 'mid-stroke').toBe(true);
    expect(await overlayAt(page, 70, 60), 'the dot is at the pointer, mid-stroke')
        .toEqual(await paletteRGBA(page, 2));
    expect(await overlayCount(page)).toBe(1);

    await page.mouse.up();
    expect(await brushCursor(page), 'after release').toBe(true);
    expect(await overlayCount(page), 'still marked after release').toBeGreaterThan(0);
});

test('the pointer comes back over the grey surround', async ({ page }) => {
    await boot(page);
    await page.keyboard.press('b');
    await setSize(page, 8);
    await hover(page, 100, 100);
    expect(await brushCursor(page)).toBe(true);

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
    expect(await brushCursor(page), 'brush').toBe(true);

    // Spray rides on the brush: switching with the pointer parked keeps it hidden
    await page.keyboard.press('a');
    await page.evaluate(() => new Promise((r) => setTimeout(r, 0)));
    expect(await brushCursor(page), 'spray').toBe(true);

    // The tools that used to keep a crosshair (or the eraser's cell cursor)
    let x = 110;
    for (const [id, name] of [['eraser', 'eraser'], ['fill', 'fill'],
        ['eyedropper', 'eyedropper'], ['rectangle', 'rectangle'],
        ['bezier', 'curve'], ['gradient', 'gradient'], ['selection', 'selection'],
        ['text', 'text']]) {
        await page.evaluate((t) => ToolManager.selectTool(t), id);
        await hover(page, x, 100);
        x += 4;
        expect(await brushCursor(page), name).toBe(true);
    }

    // Pan and zoom mark nothing, so they keep the cursor that names what they do
    await page.evaluate(() => ToolManager.selectTool(TOOLS.MOVE));
    await hover(page, 140, 100);
    expect(await bodyCursor(page), 'pan').toBe('grab');
    await page.evaluate(() => ToolManager.selectTool(TOOLS.ZOOM));
    await hover(page, 144, 100);
    expect(await bodyCursor(page), 'zoom').toBe('zoom-in');
});

/*
 * One brush pixel is one canvas pixel at every zoom: the image is the brush
 * at the zoom it is drawn at, not a fixed-size glyph (the artist's rule,
 * 2026-09-16).
 */
test('the brush cursor is the brush at the current zoom', async ({ page }) => {
    await boot(page);
    await page.keyboard.press('b');
    await setSize(page, 1);
    for (const zoom of [100, 400, 800]) {
        await page.evaluate((z) => CanvasSystem.setZoom(z), zoom);
        const frame = await page.locator('#canvas-frame').boundingBox();
        await page.mouse.move(frame.x + frame.width / 2 + 7, frame.y + frame.height / 2 + 5);
        await page.mouse.move(frame.x + frame.width / 2, frame.y + frame.height / 2);
        expect(await brushCursor(page), `zoom ${zoom}: hardware brush`).toBe(true);
        const size = await page.evaluate(() => {
            const c = GridOverlay._cursorPlan;
            return { w: c.plan.wDip, h: c.plan.hDip, scale: CanvasSystem.getScale() };
        });
        expect(size.w, `zoom ${zoom}: one canvas pixel wide`).toBe(Math.ceil(size.scale));
        expect(size.h, `zoom ${zoom}: one canvas pixel tall`).toBe(Math.ceil(size.scale));
    }
});

test('past Chrome\'s 128 DIP cursor cap the same mark is drawn by the app', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => {
        ToolManager.selectTool(TOOLS.ERASER);
        ToolManager.getTool(TOOLS.ERASER).setSize(64);
        CanvasSystem.setZoom(400);
    });
    const frame = await page.locator('#canvas-frame').boundingBox();
    await page.mouse.move(frame.x + frame.width / 2 + 9, frame.y + frame.height / 2 + 9);
    await page.mouse.move(frame.x + frame.width / 2, frame.y + frame.height / 2);
    expect(await brushCursor(page), 'too big for a cursor image').toBe(false);
    expect(await bodyCursor(page), 'system pointer hidden, not a crosshair').toBe('none');
    const via = await page.evaluate(() => GridOverlay.markPixels() && GridOverlay.markPixels().via);
    expect(via, 'the mark is on the pointer canvas').toBe('canvas');
});
