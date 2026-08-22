'use strict';
/**
 * The draw-mode bar buttons (js/ui/components/draw-mode-bar.js) carry a
 * real two-stage tooltip. Previously their title was just the mode's own
 * name, composed with an empty hint — Helpers.splitTitle returned desc==''.
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

test('every draw-mode bar button has a real two-stage tooltip', async ({ page }) => {
    await boot(page);
    const modes = ['normal', 'ink', 'paper', 'pixel_only', 'xor', 'xor_pixel'];
    for (const mode of modes) {
        const btn = page.locator(`#draw-modes button[data-draw-mode="${mode}"]`);
        await expect(btn).toBeAttached();
        const title = await btn.getAttribute('title');
        const { name, desc } = await page.evaluate(
            (t) => Helpers.splitTitle(t), title);
        expect(name).toBeTruthy();
        expect(desc).toBeTruthy();
        expect(desc).not.toBe(name);
    }
});
