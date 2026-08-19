'use strict';
/**
 * The +/- stepper buttons OptionControls._decorateSlider attaches to every
 * range input. Three separate bugs lived here, each silent (no error, no
 * visible symptom beyond "the button does nothing" or "does the wrong
 * thing"):
 *
 * 1. The stepper nudged by a hardcoded 1 unit regardless of the range's own
 *    `step` attribute. A native <input type="range"> re-validates its value
 *    against min/step on every assignment, so a nudge that isn't itself a
 *    multiple of the element's step (e.g. +1 on a step="5" slider: 100 -> 101)
 *    is silently snapped back to where it started (101 -> 100) - the button
 *    looked completely dead on every slider whose schema step is not 1
 *    (Transform panel scale X/Y, and several shape options). Fix: nudge by
 *    the range's own step instead of a hardcoded 1.
 *
 * 2. 'input' then 'change' fire synchronously, in the same tick, with no
 *    paint in between. Every ordinary slider is fine with that - its value
 *    just stays where the stepper left it. The Transform panel's image
 *    rotation slider (js/ui/components/transform-panel.js) is different: by
 *    design it commits and resets its own displayed value back to 0 (a
 *    relative "jog" control, not a persistent one). Committing directly
 *    inside the synchronous 'change' handler reset the display to 0 before
 *    the browser ever painted the incremented value, so a stepper click
 *    looked completely inert even though it silently rotated the image by
 *    one degree and committed an undo action.
 *
 * 3. The real bug (2) was hiding: committing after EVERY single stepper
 *    click meant every click re-snapshotted the ALREADY-ROUNDED result as
 *    its new starting point. Rotation is nearest-neighbour, so a point at
 *    radius r only crosses a pixel boundary once r*sin(degrees) passes
 *    ~0.5px - at 1 degree that needs r > ~28px. Content closer to the pivot
 *    than that rounds back to the exact pixel it started at on every single
 *    1-degree click, forever, no matter how many clicks accumulate: the
 *    centre of a rotated shape never moved while its outer rim eventually
 *    did, because only the rim ever crossed the per-click threshold. A real
 *    mouse drag never hit this - 'change' only fires once, at release, so
 *    every tick mid-drag rotates the full angle from ONE original snapshot.
 *
 * Fix for both (2) and (3) together: let a burst of stepper clicks share one
 * open snapshot and commit only after the clicks stop (debounced, matching
 * the shape a drag's single release already has), instead of committing -
 * and re-quantizing - after every click.
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

test('a stepper on a step>1 slider nudges by a legal value, not a hardcoded 1', async ({ page }) => {
    await boot(page);

    // A simple 8x8 mask floated as a stamp exercises the Transform panel's
    // stamp-mode Scale X slider (min=10 max=400 step=5) without needing the
    // full drag-to-move UX.
    await page.keyboard.press('b');
    await page.evaluate(() => {
        const mask = Array.from({ length: 8 }, () => Array(8).fill(true));
        SelectionService.startFloatingPasteFromMask(mask, 8, 8, 20, 20, 'Test stamp');
        CanvasSystem.requestRender();
    });

    const row = page.locator('.slider-row', { has: page.locator('.tp-sx') });
    await expect(row.locator('input[type="range"]')).toHaveValue('100');

    await row.locator('.slider-step-plus').click();
    await expect(row.locator('input[type="range"]')).toHaveValue('105');
    await expect(page.locator('.tp-sx-val')).toHaveText('105%');
    const scaleAfterPlus = await page.evaluate(() => SelectionService.floatingPaste._scaleX);
    expect(scaleAfterPlus).toBeCloseTo(1.05, 5);

    await row.locator('.slider-step-minus').click();
    await row.locator('.slider-step-minus').click();
    await expect(row.locator('input[type="range"]')).toHaveValue('95');
});

test('image-rotation stepper click is visible before it resets, and actually commits', async ({ page }) => {
    await boot(page);
    await page.keyboard.press('b');

    const row = page.locator('.slider-row', { has: page.locator('.tp-img-rot') });
    await expect(row.locator('.slider-step-plus')).toBeVisible();

    const before = await page.evaluate(() => UndoRedo.undoStack.length);

    // The 'change' handler must still see the incremented value, not an
    // already-reset 0 - proof the display had a real, paintable window at
    // the incremented value before settling back.
    await page.evaluate(() => {
        window.__changeValue = null;
        document.querySelector('.tp-img-rot').addEventListener('change', (e) => {
            window.__changeValue = e.target.value;
        });
    });

    await row.locator('.slider-step-plus').click();

    const changeValue = await page.evaluate(() => window.__changeValue);
    expect(changeValue).toBe('1');

    // The click must have actually committed a rotation, not just touched
    // the display - the commit is debounced now, so this may take a beat.
    await page.waitForFunction((n) => UndoRedo.undoStack.length > n, before, { timeout: 3000 });
    const last = await page.evaluate(() => UndoRedo.peekLast());
    expect(last.label).toBe('Rotate image');

    // Settles back to 0, the control's normal resting state.
    await expect(row.locator('input[type="range"]')).toHaveValue('0', { timeout: 3000 });
});

test('a burst of image-rotation stepper clicks shares one undo entry and actually rotates content near the pivot', async ({ page }) => {
    await boot(page);
    await page.keyboard.press('b');

    // A mark 3px from the centre of a 48x48 selection - well inside the
    // ~28px radius a single 1-degree click cannot move, so it only rotates
    // correctly if the whole burst of clicks shares one snapshot.
    const AREA = { x: 24, y: 24, width: 48, height: 48 };
    await page.evaluate((area) => {
        const cx = area.x + area.width / 2, cy = area.y + area.height / 2;
        for (let dx = 0; dx < 3; dx++) PixelDrawRoutine.draw(cx + 3 + dx, cy, { ink: 2 });
        SelectionService.setSelection(area);
        LayerManager.composeToCanvas();
        CanvasSystem.requestRender();
    }, AREA);

    const before = await page.evaluate(() => UndoRedo.undoStack.length);
    const nearPivotInkBefore = await page.evaluate((area) => {
        const cx = area.x + area.width / 2, cy = area.y + area.height / 2;
        const st = PixelDrawRoutine.getPixelState(cx + 3, cy);
        return !!(st && st.isInk);
    }, AREA);
    expect(nearPivotInkBefore).toBe(true);

    const row = page.locator('.slider-row', { has: page.locator('.tp-img-rot') });
    const plus = row.locator('.slider-step-plus');
    for (let i = 0; i < 90; i++) {
        await plus.click();
        await page.waitForTimeout(20); // well under the commit-idle debounce
    }
    await expect(row.locator('input[type="range"]')).toHaveValue('0', { timeout: 3000 });

    // One coalesced undo entry for the whole burst, not ninety.
    const after = await page.evaluate(() => UndoRedo.undoStack.length);
    expect(after - before).toBe(1);

    // 90 degrees moved the near-pivot mark off its original spot (it did
    // not just sit there while an outer rim would have moved instead).
    const nearPivotInkAfter = await page.evaluate((area) => {
        const cx = area.x + area.width / 2, cy = area.y + area.height / 2;
        const st = PixelDrawRoutine.getPixelState(cx + 3, cy);
        return !!(st && st.isInk);
    }, AREA);
    expect(nearPivotInkAfter).toBe(false);
});
