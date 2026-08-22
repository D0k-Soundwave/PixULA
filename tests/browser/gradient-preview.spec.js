'use strict';
/**
 * Browser-level check for the gradient tool's live preview: the additive
 * fix (existing ink under the "paper" half of the gradient must survive)
 * and the perf fix (preview updates coalesced to one per animation frame,
 * painted via a single putImageData instead of per-pixel fillRect) both
 * only run through real canvas contexts, which the Node harness stubs
 * away entirely — this is the only place either is exercised for real.
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

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

test('gradient: additive preview + commit, coalesced preview calls', async ({ page }) => {
    await boot(page);

    // Pre-existing ink at what will become the gradient's low-density end.
    await page.evaluate(() => {
        PixelDrawRoutine.beginBatch();
        PixelDrawRoutine.draw(4, 96, ColorManager.getCurrentSelection(), DRAW_MODE.NORMAL);
        PixelDrawRoutine.endBatch();
    });
    expect(await isInk(page, 4, 96)).toBe(true);

    await page.keyboard.press('d'); // Gradient tool shortcut

    // Instrument before driving the drag: count raw pointermove calls vs
    // actual _updatePreview calls (coalescing should make the second much
    // smaller than the first), and time each _updatePreview call.
    await page.evaluate(() => {
        const tool = ToolManager.getCurrentTool();
        window.__moveCount = 0;
        window.__previewTimes = [];
        const origMove = tool.onPointerMove.bind(tool);
        tool.onPointerMove = function(x, y, e) {
            window.__moveCount++;
            return origMove(x, y, e);
        };
        const origPreview = tool._updatePreview.bind(tool);
        tool._updatePreview = function() {
            const t0 = performance.now();
            origPreview();
            window.__previewTimes.push(performance.now() - t0);
        };
    });

    // Phase 1: drag a shape covering nearly the whole canvas — the worst
    // case for preview cost.
    const p1a = await pixelPoint(page, 0, 0);
    const p1b = await pixelPoint(page, 255, 191);
    await page.mouse.move(p1a.x, p1a.y);
    await page.mouse.down();
    await page.mouse.move(p1b.x, p1b.y, { steps: 2 });
    await page.mouse.up();

    // Phase 2: drag the axis left -> right through many intermediate
    // points, the way a real drag reports far more pointermove events
    // than there are animation frames to paint them in.
    const p2a = await pixelPoint(page, 4, 96);
    const p2b = await pixelPoint(page, 251, 96);
    await page.mouse.move(p2a.x, p2a.y);
    await page.mouse.down();
    await page.mouse.move(p2b.x, p2b.y, { steps: 40 });
    await page.mouse.up();

    const moveCount = await page.evaluate(() => window.__moveCount);
    const times = await page.evaluate(() => window.__previewTimes);
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const max = Math.max(...times);
    console.log(`gradient preview: ${moveCount} pointermove events -> ` +
        `${times.length} _updatePreview calls (avg ${avg.toFixed(2)}ms, max ${max.toFixed(2)}ms)`);

    // Coalescing: far fewer preview recomputes than raw move events.
    expect(times.length).toBeLessThan(moveCount);

    // Additive: the pre-existing pixel under the low-density end survives
    // the commit rather than being erased by the gradient's "paper" half.
    expect(await isInk(page, 4, 96)).toBe(true);

    // Still a real gradient: density rises along the axis.
    let left = 0, right = 0;
    for (let x = 4; x <= 251; x++) {
        if (await isInk(page, x, 96)) {
            if (x < 100) left++; else if (x > 155) right++;
        }
    }
    expect(right).toBeGreaterThan(left);
});
