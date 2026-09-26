'use strict';
/**
 * The Transform panel's image-rotation slider (js/ui/components/
 * transform-panel.js) is an absolute angle gauge: the thumb sits at the
 * picture's current total rotation from its original (area-scoped)
 * orientation and stays there once committed, rather than snapping back to
 * centre. Rotating again picks up from that position and keeps moving the
 * thumb; only a genuinely new subject resets it to 0 - a new/cleared/moved
 * selection, or a fixed 90/180 rotation (Image menu / TransformService) that
 * bakes in a hard turn and redefines what "original" means.
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

// `absoluteDegrees` is the thumb's TARGET position, not a delta - matches
// how the gauge itself is read (fill() sets the DOM value directly, the same
// end-state a drag to that position on the track would leave it in).
async function rotateTo(page, rot, absoluteDegrees) {
    const before = await page.evaluate(() => UndoRedo.undoStack.length);
    await rot.fill(String(absoluteDegrees));
    await rot.dispatchEvent('input');
    await rot.dispatchEvent('change');
    await page.waitForFunction((n) => UndoRedo.undoStack.length > n, before, { timeout: 3000 });
}

test('image-rotation gauge holds its angle across commits and resets on a new selection or a fixed rotation', async ({ page }) => {
    await boot(page);
    await page.keyboard.press('b');

    await page.evaluate(() => {
        SelectionService.setSelection({ x: 24, y: 24, width: 48, height: 48 });
        CanvasSystem.requestRender();
    });

    const rot    = page.locator('.tp-img-rot');
    const rotVal = page.locator('.tp-img-rot-val');

    // First commit: the thumb stays at the committed angle, not back at 0.
    await rotateTo(page, rot, 30);
    await expect(rotVal).toHaveText('30°');
    await expect(rot).toHaveValue('30');

    // Rotating further on the SAME selection moves the thumb from where it
    // already was, and it holds the new position.
    await rotateTo(page, rot, 45);
    await expect(rotVal).toHaveText('45°');
    await expect(rot).toHaveValue('45');

    // A new selection is a new subject: the gauge resets immediately, even
    // before any further rotation happens.
    await page.evaluate(() => {
        SelectionService.setSelection({ x: 100, y: 100, width: 32, height: 32 });
        CanvasSystem.requestRender();
    });
    await expect(rotVal).toHaveText('0°');
    await expect(rot).toHaveValue('0');

    // Rotate the new selection, then apply a fixed 90-degree rotation (the
    // Image menu path, TransformService directly) - that also resets it.
    await rotateTo(page, rot, 20);
    await expect(rotVal).toHaveText('20°');

    await page.evaluate(() => TransformService.rotate90CW());
    await expect(rotVal).toHaveText('0°');
    await expect(rot).toHaveValue('0');
});

/**
 * A slider tick is ONE batch. rotateFromSnapshot used to be the only transform
 * that applied its buffer outside a PixelDrawRoutine batch, so every pixel of
 * the work area emitted its own CANVAS_DIRTY and marked the document modified,
 * on every tick of the drag (70.6 -> 27.5 ms a tick at full canvas,
 * docs/FIGURES.md section 8, 2026-09-26). The batch nests inside the slider's
 * own undo action, so the whole drag must still be one undo step.
 */
test('each rotate-slider tick is one batch, and a whole drag is one undo step', async ({ page }) => {
    await boot(page);
    await page.keyboard.press('b');

    await page.evaluate(() => {
        const sel = ColorManager.getCurrentSelection();
        PixelDrawRoutine.beginBatch();
        for (let y = 30; y < 66; y++) for (let x = 30; x < 66; x++)
            if ((x + y) % 3) PixelDrawRoutine.draw(x, y, sel, DRAW_MODE.NORMAL);
        PixelDrawRoutine.endBatch();
        SelectionService.setSelection({ x: 24, y: 24, width: 48, height: 48 });
        CanvasSystem.requestRender();
        window.__ev = { ticks: 0, dirty: 0, batches: 0 };
        document.querySelector('.tp-img-rot').addEventListener('input', () => { window.__ev.ticks++; });
        EventBus.on(EVENTS.CANVAS_DIRTY, () => { window.__ev.dirty++; });
        EventBus.on(EVENTS.PIXEL_BATCH_END, () => { window.__ev.batches++; });
    });

    const rot = page.locator('.tp-img-rot');
    const before = await page.evaluate(() => UndoRedo.undoStack.length);
    // fill() fires the slider's own 'input' event: one tick per value
    for (const deg of [10, 20, 30]) await rot.fill(String(deg));
    const ev = await page.evaluate(() => window.__ev);
    await rot.dispatchEvent('change');
    await page.waitForFunction((n) => UndoRedo.undoStack.length > n, before, { timeout: 3000 });

    // One batch per tick, and a dirty event per batch - not one per pixel of
    // the 48x48 area (2,304 a tick before the fix)
    expect(ev.ticks).toBeGreaterThanOrEqual(3);
    expect(ev.batches).toBe(ev.ticks);
    expect(ev.dirty).toBeLessThanOrEqual(ev.ticks);
    expect(await page.evaluate(() => UndoRedo.undoStack.length)).toBe(before + 1);
});
