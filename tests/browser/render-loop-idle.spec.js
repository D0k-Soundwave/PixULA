'use strict';
/**
 * An idle editor asks for no animation frames.
 *
 * CanvasSystem's render loop used to re-arm requestAnimationFrame forever,
 * so a picture nobody was touching still woke the page 60-144 times a second
 * to find nothing to draw - battery a tablet artist pays for. Since
 * 2026-09-26 requestRender() schedules the one frame it needs. What must not
 * change: a draw still reaches the screen on the next frame.
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

test('an idle editor requests no animation frames, and a draw still renders', async ({ page }) => {
    await page.addInitScript(() => {
        window.__rafCalls = 0;
        const raf = window.requestAnimationFrame.bind(window);
        window.requestAnimationFrame = (cb) => { window.__rafCalls++; return raf(cb); };
    });
    await boot(page);

    // Let boot-time work settle, then watch a quiet second
    await page.waitForTimeout(500);
    const idle = await page.evaluate(async () => {
        const start = window.__rafCalls;
        await new Promise((r) => setTimeout(r, 1000));
        return window.__rafCalls - start;
    });
    expect(idle).toBe(0);

    // A single pixel written now is on screen after the next frame
    const r = await page.evaluate(async () => {
        const sel = ColorManager.getCurrentSelection();
        PixelDrawRoutine.draw(12, 12, sel, DRAW_MODE.NORMAL);
        await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
        const onScreen = CanvasSystem.ctx.getImageData(12, 12, 1, 1).data;
        const k = (12 * ZX_SPECTRUM.WIDTH + 12) * 4;
        const src = CanvasSystem.imageData.data;
        return {
            matches: onScreen[0] === src[k] && onScreen[1] === src[k + 1] && onScreen[2] === src[k + 2],
            ink: PixelDrawRoutine.getPixelState(12, 12).isInk,
            pending: CanvasSystem.renderPending
        };
    });
    expect(r.ink).toBe(true);
    expect(r.matches).toBe(true);
    expect(r.pending).toBe(false);
});
