'use strict';
const { test, expect } = require('@playwright/test');
const { boot, selectMode } = require('./helpers');

test('every Palette Editor tool button has a real two-stage tooltip', async ({ page }) => {
    await boot(page);
    await selectMode(page, 'ula_plus');
    await page.waitForFunction(() => ACTIVE_SCREEN_MODE.id === 'ula_plus');
    await page.click('.menu-item[data-menu="image"] .menu-label');
    await page.click('.menu-action[data-action="image:editPalette"]');
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

    for (const cls of ['palette-editor-tool-button']) {
        const count = await dlg.locator(`.${cls}`).count();
        expect(count).toBeGreaterThanOrEqual(3); // Load, Save, From image, Blend (Load absent only if scratch)
        for (let i = 0; i < count; i++) {
            await checkTwoStage(dlg.locator(`.${cls}`).nth(i), `tool button ${i}`);
        }
    }
});
