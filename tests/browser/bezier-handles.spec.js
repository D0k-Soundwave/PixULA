'use strict';
/**
 * Bezier handles — the markers you grab to bend a pending curve.
 *
 * They were a one-pixel-wide white plus on the function-preview canvas, which
 * the curve preview (a layer above it) drew straight through and light artwork
 * swallowed whole. This reads the cursor overlay back pixel by pixel and pins
 * what makes them findable: they are drawn at all, in two contrasting tones,
 * they survive a hover, they scale DOWN as the zoom scales up (constant size
 * on screen), and they leave nothing behind once the curve is committed.
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

/** Lit-pixel count, distinct colours, and probes on the cursor overlay. */
function readCursorOverlay(page, probes) {
    return page.evaluate((pts) => {
        const cvs = GridOverlay.cursorCanvas;
        if (!cvs) return null;
        const ctx = cvs.getContext('2d');
        const { data, width, height } = ctx.getImageData(0, 0, cvs.width, cvs.height);

        let lit = 0;
        const tones = new Set();
        for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] === 0) continue;
            lit++;
            tones.add(`${data[i]},${data[i + 1]},${data[i + 2]}`);
        }
        const at = pts.map(([x, y]) => {
            if (x < 0 || x >= width || y < 0 || y >= height) return false;
            return data[(y * width + x) * 4 + 3] > 0;
        });
        return { lit, tones: [...tones], at };
    }, probes);
}

/** Place a curve's two anchors by dragging from (x1,y1) to (x2,y2). */
async function placeCurve(page, x1, y1, x2, y2) {
    const a = await pixelPoint(page, x1, y1);
    const b = await pixelPoint(page, x2, y2);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 6 });
    await page.mouse.up();
}

test('a pending curve puts two-tone handles on the cursor overlay', async ({ page }) => {
    await boot(page);
    await page.keyboard.press('c');
    await placeCurve(page, 60, 120, 200, 120);

    // Both anchors and the quadratic's single control are marked.
    const o = await readCursorOverlay(page, [[60, 120], [200, 120], [130, 120]]);
    expect(o, 'the cursor overlay exists').not.toBeNull();
    expect(o.lit, 'handles are drawn').toBeGreaterThan(0);
    expect(o.at[0], 'start anchor marked').toBe(true);
    expect(o.at[1], 'end anchor marked').toBe(true);
    expect(o.at[2], 'control point marked').toBe(true);

    // Contrast is the whole point: a body tone over a skirt in its opposite,
    // so one of the two shows whatever the artwork underneath happens to be.
    expect(o.tones.length, 'more than one tone').toBeGreaterThan(1);
});

test('handles survive a hover and vanish when the curve is committed', async ({ page }) => {
    await boot(page);
    await page.keyboard.press('c');
    await page.evaluate(() => ToolManager.getCurrentTool().setThickness(6));
    await placeCurve(page, 60, 120, 200, 120);
    expect((await readCursorOverlay(page, [])).lit).toBeGreaterThan(0);

    // Moving the pointer with no button down runs the hover path, which owns
    // the OTHER overlay — it must not sweep the handles away with it.
    const p = await pixelPoint(page, 100, 60);
    await page.mouse.move(p.x, p.y);
    await page.mouse.move(p.x + 4, p.y + 4);
    expect((await readCursorOverlay(page, [])).lit, 'hover leaves them alone').toBeGreaterThan(0);

    await page.keyboard.press('Enter');
    expect((await readCursorOverlay(page, [])).lit, 'commit takes them down').toBe(0);
});

test('a handle is the same size on screen at any zoom', async ({ page }) => {
    await boot(page);
    await page.keyboard.press('c');
    // Explicit: the boot zoom is whatever Fit made of the viewport.
    await page.evaluate(() => StateManager.setZoom(100));
    await placeCurve(page, 60, 120, 200, 120);
    const at100 = (await readCursorOverlay(page, [])).lit;

    // Zoom in: the marker must shrink in ZX pixels by roughly the zoom factor,
    // which is what keeps it the same number of screen pixels.
    await page.evaluate(() => StateManager.setZoom(400));
    const at400 = (await readCursorOverlay(page, [])).lit;

    expect(at400, 'still drawn after the zoom').toBeGreaterThan(0);
    expect(at400, 'shrunk in canvas pixels as the zoom grew').toBeLessThan(at100);
});
