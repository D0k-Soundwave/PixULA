'use strict';
/**
 * The selection overlay is memoised: _renderSelectionOverlay compares a
 * signature of everything the overlay's appearance depends on and skips the
 * redraw when nothing has moved. It runs on every CANVAS_RENDER, and a full
 * pass cost 0.469 ms measured 2026-08-29 - more than a whole recompose of the
 * same canvas - so for as long as a selection existed, every frame repainted
 * an identical 256x192 dim layer plus its boundary for nothing.
 *
 * A cache is only as good as its invalidation, and nothing in the suite
 * asserted on this canvas before, so these are the rows that make the
 * optimisation safe to keep: the overlay must still APPEAR, must FOLLOW the
 * selection when it moves or clears, must SURVIVE frames that changed only
 * the artwork, and must repaint when the theme recolours it.
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

/**
 * A cheap fingerprint of the selection canvas: how many pixels carry any
 * alpha, and a checksum of where they are. Two different overlays give two
 * different values; an unchanged overlay gives the same one.
 */
async function overlayFingerprint(page) {
    return page.evaluate(() => {
        const cvs = CanvasSystem.getCanvasElement('selection-canvas');
        if (!cvs) return null;
        const d = cvs.getContext('2d').getImageData(0, 0, cvs.width, cvs.height).data;
        let opaque = 0, sum = 0;
        for (let i = 0; i < d.length; i += 4) {
            if (d[i + 3] !== 0) { opaque++; sum = (sum + i * (d[i + 3] + 1)) >>> 0; }
        }
        return { opaque, sum };
    });
}

const select = (page, rect) => page.evaluate((r) => {
    SelectionService.setSelection(r);
    GridOverlay._renderSelectionOverlay();
}, rect);

const renderAgain = (page) => page.evaluate(() => GridOverlay._renderSelectionOverlay());

test('a selection paints the overlay, and repeat frames keep it', async ({ page }) => {
    await boot(page);

    await select(page, { x: 10, y: 10, width: 80, height: 60 });
    const first = await overlayFingerprint(page);
    expect(first.opaque).toBeGreaterThan(0);

    // The cache hit must be a no-op, not a blank: re-rendering with nothing
    // changed has to leave the same pixels on the canvas.
    for (let i = 0; i < 5; i++) await renderAgain(page);
    expect(await overlayFingerprint(page)).toEqual(first);
});

test('moving the selection repaints the overlay', async ({ page }) => {
    await boot(page);

    await select(page, { x: 10, y: 10, width: 80, height: 60 });
    const before = await overlayFingerprint(page);

    await select(page, { x: 120, y: 90, width: 80, height: 60 });
    const after = await overlayFingerprint(page);

    expect(after.opaque).toBeGreaterThan(0);
    expect(after.sum).not.toBe(before.sum);
});

test('resizing the selection repaints the overlay', async ({ page }) => {
    await boot(page);

    await select(page, { x: 10, y: 10, width: 80, height: 60 });
    const before = await overlayFingerprint(page);

    await select(page, { x: 10, y: 10, width: 140, height: 60 });
    const after = await overlayFingerprint(page);

    expect(after.sum).not.toBe(before.sum);
});

test('clearing the selection clears the overlay', async ({ page }) => {
    await boot(page);

    await select(page, { x: 10, y: 10, width: 80, height: 60 });
    expect((await overlayFingerprint(page)).opaque).toBeGreaterThan(0);

    await page.evaluate(() => {
        SelectionService.clear();
        GridOverlay._renderSelectionOverlay();
    });
    expect((await overlayFingerprint(page)).opaque).toBe(0);
});

test('drawing inside a selection leaves its overlay intact', async ({ page }) => {
    await boot(page);

    await select(page, { x: 10, y: 10, width: 80, height: 60 });
    const before = await overlayFingerprint(page);

    // A frame whose only change is artwork. This is the case the cache exists
    // for, and the one where a wrong signature would blank the marching
    // border mid-stroke.
    await page.evaluate(() => {
        for (let x = 20; x < 60; x++) {
            PixelDrawRoutine.draw(x, 30, { ink: 2, paper: 7, bright: false, flash: false },
                                  DRAW_MODE.NORMAL);
        }
        CanvasSystem._render();
    });

    expect(await overlayFingerprint(page)).toEqual(before);
});

test('a theme change repaints the overlay in the new colour', async ({ page }) => {
    await boot(page);

    await select(page, { x: 10, y: 10, width: 80, height: 60 });
    await overlayFingerprint(page);

    // The border colour is a theme token, so the overlay must not be served
    // from a cache keyed only on geometry.
    const changed = await page.evaluate(async () => {
        const cvs = CanvasSystem.getCanvasElement('selection-canvas');
        const read = () => cvs.getContext('2d')
            .getImageData(0, 0, cvs.width, cvs.height).data.join(',');
        const before = read();
        await ThemeManager.setTheme('light');
        GridOverlay._refreshGridColors();
        GridOverlay._renderSelectionOverlay();
        return { same: read() === before };
    });

    expect(changed.same).toBe(false);
});

test('a floating stamp outline follows the stamp as it moves', async ({ page }) => {
    await boot(page);

    const moved = await page.evaluate(() => {
        SelectionService.setSelection({ x: 10, y: 10, width: 40, height: 40 });
        SelectionService.copyOrCut(false);
        SelectionService.startFloatingPaste(10, 10);
        GridOverlay._renderSelectionOverlay();
        const cvs = CanvasSystem.getCanvasElement('selection-canvas');
        const read = () => cvs.getContext('2d')
            .getImageData(0, 0, cvs.width, cvs.height).data.join(',');
        const before = read();
        SelectionService.moveFloatingPaste(120, 90);
        GridOverlay._renderSelectionOverlay();
        return read() !== before;
    });

    expect(moved).toBe(true);
});
