'use strict';
/**
 * The close button on every app-wide <dialog> (js/ui/components/dialog.js)
 * gets the same two-stage hover treatment as the rest of the app's chrome —
 * previously it had an aria-label but no title at all.
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

test('a dialog close button has a real two-stage tooltip', async ({ page }) => {
    await boot(page);
    // Preferences is reachable from the Settings menu and has no extra
    // preconditions, so it's a cheap way to get any dialog open.
    await page.click('.menu-item[data-menu="settings"] .menu-label');
    await page.click('.menu-action[data-id="preferences"]');
    const closeBtn = page.locator('.app-dialog-close').first();
    await expect(closeBtn).toBeVisible();

    const title = await closeBtn.getAttribute('title');
    const { name, desc } = await page.evaluate(
        (t) => Helpers.splitTitle(t), title);
    expect(name).toBeTruthy();
    expect(desc).toBeTruthy();
    expect(desc).not.toBe(name);

    const tip = page.locator('.app-tooltip');
    const descEl = page.locator('.app-tooltip-desc');
    await closeBtn.hover();
    await expect(tip).toBeVisible();
    await expect(descEl).toBeVisible({ timeout: 5000 });
    const expectedHint = await page.evaluate(() => window.I18n.t('dialog.close.hint'));
    await expect(descEl).toHaveText(expectedHint);
});
