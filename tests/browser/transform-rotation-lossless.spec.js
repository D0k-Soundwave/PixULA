'use strict';
/**
 * The Transform panel's image-rotation slider used to re-snapshot the
 * CANVAS at the start of every interaction, not the picture's true original.
 * A pause mid-drag fires the debounced commit (js/ui/components/
 * transform-panel.js, IMG_ROT_COMMIT_IDLE_MS), which used to bake that
 * tick's nearest-neighbour rounding into the layer; the NEXT interaction
 * then rotated that already-rounded result again. Two lossy roundings
 * stacked, so dragging back to 0 rotated by minus the second angle applied
 * to already-corrupted pixels - not a true restore. A quick manual test
 * (drag to 45, pause long enough to commit, drag back to 0) left visible
 * pixel differences from the original, even though the gauge read "0deg"
 * again - the readout claimed nothing had changed when the artwork had.
 *
 * The fix holds one pristine snapshot per subject (layer + selection/canvas
 * bounds) for as long as that subject doesn't change, and every tick - in
 * any interaction, before or after an intervening commit - rotates THAT
 * buffer by the gauge's absolute value rather than the canvas by a delta.
 * Degrees===0 is a buffer passthrough (TransformService.rotateFromSnapshot),
 * so returning to 0 is always byte-exact, no matter how many separate drags
 * and commits happened first.
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

const AREA = { x: 40, y: 40, width: 40, height: 40 };

async function snapshotCells(page, area) {
    return page.evaluate((a) => {
        const layer = LayerManager.getCurrentLayer();
        const out = [];
        for (let y = a.y; y < a.y + a.height; y++) {
            for (let x = a.x; x < a.x + a.width; x++) {
                const st = layer.getPixelState(x, y);
                out.push(!!(st && st.isInk));
            }
        }
        return out;
    }, area);
}

test('rotating away and back to 0 across a debounced commit restores the original pixels exactly', async ({ page }) => {
    await boot(page);
    await page.keyboard.press('b');

    // A varied pattern, not a blank fill - a uniform area can't reveal
    // rounding loss (every candidate result looks the same).
    await page.evaluate((a) => {
        for (let y = a.y; y < a.y + a.height; y++) {
            for (let x = a.x; x < a.x + a.width; x++) {
                if ((x + y * 3) % 5 < 2) PixelDrawRoutine.draw(x, y, { ink: 2 });
            }
        }
        SelectionService.setSelection(a);
        LayerManager.composeToCanvas();
        CanvasSystem.requestRender();
    }, AREA);

    const before = await snapshotCells(page, AREA);

    const rot = page.locator('.tp-img-rot');

    // Rotate to 45 and let it commit (the debounce boundary that used to
    // bake in lossy rounding as the new "original").
    let undoLen = await page.evaluate(() => UndoRedo.undoStack.length);
    await rot.fill('45');
    await rot.dispatchEvent('input');
    await rot.dispatchEvent('change');
    await page.waitForFunction((n) => UndoRedo.undoStack.length > n, undoLen, { timeout: 3000 });

    // Now, in a SEPARATE interaction, drag back to 0 and let that commit too.
    undoLen = await page.evaluate(() => UndoRedo.undoStack.length);
    await rot.fill('0');
    await rot.dispatchEvent('input');
    await rot.dispatchEvent('change');
    await page.waitForFunction((n) => UndoRedo.undoStack.length > n, undoLen, { timeout: 3000 });

    const after = await snapshotCells(page, AREA);
    expect(after).toEqual(before);
});
