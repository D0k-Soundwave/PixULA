'use strict';
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

test('every Workspace Presets manager row action has a real two-stage tooltip', async ({ page }) => {
    await boot(page);
    // Ensure at least one filled slot so the Load/Replace/Export/Delete row renders.
    // PresetService.save(slot, name, sliceIds, description) - signature confirmed
    // in js/services/preset-service.js:234.
    await page.evaluate(() => PresetService.save(0, 'Batch 3 check', ['color']));
    await page.click('.menu-item[data-menu="settings"] .menu-label');
    await page.click('.menu-action[data-action="settings:presets"]');
    const dlg = page.locator('.dialog, dialog, [role="dialog"]').first();
    await expect(dlg).toBeVisible();

    const checkTwoStage = async (locator, label) => {
        await expect(locator).toBeAttached();
        const title = await locator.getAttribute('title');
        const { name, desc } = await page.evaluate((t) => Helpers.splitTitle(t), title);
        expect(name, `${label} name`).toBeTruthy();
        expect(desc, `${label} description`).toBeTruthy();
        expect(desc, `${label} description differs from name`).not.toBe(name);
    };

    const filledRow = dlg.locator('.preset-row').filter({ hasNot: dlg.locator('.preset-row-empty') }).first();
    await checkTwoStage(filledRow.locator('[data-i18n="preset.load"]'), 'load');
    await checkTwoStage(filledRow.locator('[data-i18n="preset.replace"]'), 'replace');
    await checkTwoStage(filledRow.locator('[data-i18n="preset.export"]'), 'export');
    await checkTwoStage(filledRow.locator('[data-i18n="preset.delete"]'), 'delete');

    const emptyRow = dlg.locator('.preset-row-empty').first();
    await checkTwoStage(emptyRow.locator('[data-i18n="preset.saveHere"]'), 'save here');
});
