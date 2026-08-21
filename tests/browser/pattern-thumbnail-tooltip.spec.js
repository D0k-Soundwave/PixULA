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

    // .pattern-item is the one control in the app whose two-stage title has
    // no data-i18n-title-name (its name half is a user pattern name, not an
    // i18n key), so tooltip.spec.js's marker-attribute-based sweep cannot see
    // it at all. This direct SELECTOR check is what would catch a future
    // accidental removal of .pattern-item from TooltipManager.SELECTOR.
    const inSelector = await item.evaluate((el) => el.matches(window.Tooltip.SELECTOR));
    expect(inSelector, '.pattern-item must stay in TooltipManager.SELECTOR — it is the one control in the app that never sets data-i18n-title-name (its name is a user pattern name, not an i18n key), so the marker-attribute-based sweep in tooltip.spec.js cannot see it at all').toBe(true);
});
