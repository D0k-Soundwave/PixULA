'use strict';
/**
 * .panel-collapse (every sidebar panel's collapse/expand header button) and
 * #merge-selected (the Layers panel's Merge button) both matched
 * TooltipManager's SELECTOR already, but neither had a real two-stage title
 * — .panel-collapse's title was name-only, #merge-selected's was hint-only.
 * Found by batch 1's own widened sweep and excluded there pending this fix.
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

test('panel-collapse buttons have real two-stage tooltips', async ({ page }) => {
    await boot(page);
    const btn = page.locator('.panel-collapse').first();
    await expect(btn).toBeAttached();
    const title = await btn.getAttribute('title');
    const { name, desc } = await page.evaluate(
        (t) => Helpers.splitTitle(t), title);
    expect(name).toBeTruthy();
    expect(desc).toBeTruthy();
    expect(desc).not.toBe(name);
});

test('the Merge button has a real two-stage tooltip', async ({ page }) => {
    await boot(page);
    const btn = page.locator('#merge-selected');
    await expect(btn).toBeAttached();
    const title = await btn.getAttribute('title');
    const { name, desc } = await page.evaluate(
        (t) => Helpers.splitTitle(t), title);
    expect(name).toBeTruthy();
    expect(desc).toBeTruthy();
    expect(desc).not.toBe(name);
});
