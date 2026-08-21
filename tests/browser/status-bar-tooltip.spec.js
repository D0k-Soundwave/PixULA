'use strict';
/**
 * The touch-mode status button and the zoom-level select (status bar area)
 * carry real two-stage tooltips. Touch-mode status already had a real hint
 * as a flat title; the zoom-level select had no title at all.
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

test('touch-mode status and zoom-level select have real two-stage tooltips', async ({ page }) => {
    await boot(page);
    for (const id of ['touch-mode-status', 'zoom-level']) {
        const el = page.locator(`#${id}`);
        await expect(el).toBeAttached();
        const title = await el.getAttribute('title');
        const { name, desc } = await page.evaluate(
            (t) => Helpers.splitTitle(t), title);
        expect(name).toBeTruthy();
        expect(desc).toBeTruthy();
        expect(desc).not.toBe(name);
    }
});
