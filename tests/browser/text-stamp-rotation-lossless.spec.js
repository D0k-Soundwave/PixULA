'use strict';
/**
 * The image-rotation slider on the Transform panel (js/ui/components/
 * transform-panel.js) used to re-quantize on every commit because it kept
 * re-snapshotting from the CANVAS, so rotating away and back to 0 lost
 * pixels (see transform-rotation-lossless.spec.js). Floating stamps -
 * text among them - rotate through a different code path
 * (SelectionService._recomputeStampTransform) and were never at risk of the
 * same bug: `setStampRotation` sets fp._rotation to an ABSOLUTE value and
 * _recomputeStampTransform always rebuilds the displayed mask from the
 * PRISTINE source - fp._srcPixels for an ordinary paste, or a fresh
 * _buildTextMask/_rasterizeWithFont call straight from the font for a text
 * stamp - never from the mask left over by the last rotation. fp._srcPixels
 * itself is written once, at stamp creation, and never reassigned to a
 * derived/rotated result anywhere in the file.
 *
 * This pins that property so a future refactor that made rotation relative
 * (rotating the current display pixels instead of rebuilding from source)
 * would fail here immediately, the way it silently didn't for the image
 * slider.
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

test('a text stamp rotated away and back to 0 across two separate calls matches the un-rotated raster exactly', async ({ page }) => {
    await boot(page);

    await page.evaluate(() => {
        const tool = ToolManager.getTool(TOOLS.TEXT);
        const mask = tool._buildTextMask('AB', 'ZX ROM');
        SelectionService.startFloatingPasteFromMask(
            mask.pixels, mask.pixels[0].length, mask.pixels.length,
            50, 50, 'Place Text',
            { text: 'AB', fontFamily: 'ZX ROM', fontSize: 8, bold: false, italic: false },
            'none'
        );
    });

    const before = await page.evaluate(() => SelectionService.floatingPaste.pixels.map((r) => [...r]));

    // Two SEPARATE calls, mirroring two distinct interactions rather than
    // one continuous drag - the shape of the case that broke the image slider.
    await page.evaluate(() => SelectionService.setStampRotation(45));
    await page.evaluate(() => SelectionService.setStampRotation(0));

    const after = await page.evaluate(() => SelectionService.floatingPaste.pixels.map((r) => [...r]));
    expect(after).toEqual(before);
});
