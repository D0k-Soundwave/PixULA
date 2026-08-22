'use strict';
/**
 * The grid-size and snap toggle buttons (js/ui/components/canvas-controls.js)
 * and the mirror toggle buttons (js/ui/components/draw-mode-bar.js) all carry
 * real two-stage tooltips. The snap and mirror buttons already had a real
 * hint sentence as a flat title; the grid-size buttons had none at all.
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

test('grid, snap and mirror toggle buttons have real two-stage tooltips', async ({ page }) => {
    await boot(page);
    const ids = [
        'grid-1x1-toggle', 'grid-8x8-toggle', 'grid-16x16-toggle',
        'grid-snap-toggle',
        'symmetry-h-toggle', 'symmetry-v-toggle', 'symmetry-quad-toggle'
    ];
    for (const id of ids) {
        const btn = page.locator(`#${id}`);
        await expect(btn).toBeAttached();
        const title = await btn.getAttribute('title');
        const { name, desc } = await page.evaluate(
            (t) => Helpers.splitTitle(t), title);
        expect(name).toBeTruthy();
        expect(desc).toBeTruthy();
        expect(desc).not.toBe(name);
    }
});
