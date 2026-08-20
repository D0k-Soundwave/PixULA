'use strict';
/**
 * Pattern library thumbnails (js/ui/pattern-panel.js) carry a real two-stage
 * tooltip: the pattern's own name, plus a shared hint (the click behavior is
 * identical for every pattern, so one sentence covers all of them).
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

test('a pattern library thumbnail has a real two-stage tooltip', async ({ page }) => {
    await boot(page);
    await page.keyboard.press('k'); // Pattern Creator tool opens the panel/dialog with the library
    const item = page.locator('.pattern-item').first();
    await expect(item).toBeAttached();
    const title = await item.getAttribute('title');
    const { name, desc } = await page.evaluate(
        (t) => Helpers.splitTitle(t), title);
    expect(name).toBeTruthy();
    expect(desc).toBeTruthy();
    expect(desc).not.toBe(name);
});
