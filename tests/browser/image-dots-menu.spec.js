'use strict';
/**
 * Batch 2 part 2B2 - Image > Dots. The three rows exist, the flips work in
 * standard ULA, and in Layer 2 Invert Dots and Colours is greyed out with the
 * reason on the Dots row (the flips stay on). What each command writes is
 * pinned in Node by tests/dots-menu-routing.test.js and tests/dot-commands.test.js.
 */
const { test, expect } = require('@playwright/test');
const { boot, selectMode } = require('./helpers');

const openDots = async (page) => {
    await page.click('[data-menu="image"]');
    await page.hover('#menu-image [data-id="dots"]');
    await page.waitForTimeout(150);
};

const itemState = (page, id) => page.evaluate((rowId) => {
    const el = document.querySelector(`[data-id="${rowId}"]`);
    return el ? { present: true, disabled: el.classList.contains('disabled') } : { present: false };
}, id);

test('Image > Dots lists the flips and Invert Dots and Colours, enabled in standard ULA', async ({ page }) => {
    await boot(page);
    await openDots(page);
    for (const id of ['dots-flip-h', 'dots-flip-v', 'dots-invert']) {
        expect(await itemState(page, id), id).toEqual({ present: true, disabled: false });
    }
});

test('Layer 2 greys out Invert Dots and Colours and says why on the Dots row; flips stay on', async ({ page }) => {
    await boot(page);
    page.on('dialog', (d) => d.accept());
    await selectMode(page, 'layer2_256');
    await page.waitForFunction(() => ACTIVE_SCREEN_MODE.id === 'layer2_256');
    await openDots(page);
    expect(await itemState(page, 'dots-invert')).toEqual({ present: true, disabled: true });
    expect(await itemState(page, 'dots-flip-h')).toEqual({ present: true, disabled: false });
    const tip = await page.getAttribute('#menu-image [data-id="dots"]', 'title');
    expect(tip, 'the reason is on the parent row').toMatch(/cell attributes/i);
});

test('Flip Horizontal from the menu mirrors the dots and leaves the colours', async ({ page }) => {
    await boot(page);
    page.on('dialog', (d) => d.accept());
    await page.evaluate(() => {
        PixelDrawRoutine.draw(1, 0, { ink: 2, paper: 6, bright: false, flash: false }, DRAW_MODE.PIXEL_ONLY, { mirror: false });
    });
    const before = await page.evaluate(() => {
        const cell = LayerManager.attrsAsSeen(LayerManager.getCurrentLayer(), 0, 0);
        return { ink: cell.ink, paper: cell.paper, dot0: !!PixelDrawRoutine.getPixelState(0, 0)?.isInk, dot7: !!PixelDrawRoutine.getPixelState(7, 0)?.isInk };
    });
    await openDots(page);
    await page.click('[data-id="dots-flip-h"]');
    const after = await page.evaluate(() => {
        const cell = LayerManager.attrsAsSeen(LayerManager.getCurrentLayer(), 0, 0);
        return { ink: cell.ink, paper: cell.paper, dot0: !!PixelDrawRoutine.getPixelState(0, 0)?.isInk, dot7: !!PixelDrawRoutine.getPixelState(7, 0)?.isInk };
    });
    expect(after.ink).toBe(before.ink);
    expect(after.paper).toBe(before.paper);
    expect(after.dot7).toBe(before.dot0);
    expect(after.dot0).toBe(before.dot7);
});
