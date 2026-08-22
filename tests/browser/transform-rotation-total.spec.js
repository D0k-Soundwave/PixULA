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
