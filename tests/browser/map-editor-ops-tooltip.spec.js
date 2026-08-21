'use strict';
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

async function openFileDialog(page, action) {
    await page.click('.menu-item[data-menu="file"] .menu-label');
    await page.click(`.menu-action[data-action="${action}"]`);
}

test('every Map Editor tool and zoom button has a real two-stage tooltip', async ({ page }) => {
    await boot(page);
    await openFileDialog(page, 'file:mapEditor');
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

    for (const tool of ['paint', 'erase', 'fill', 'pick']) {
        await checkTwoStage(dlg.locator(`button[data-maptool="${tool}"]`), tool);
    }
    await checkTwoStage(dlg.locator('.me-zoom-out'), 'zoom out');
    await checkTwoStage(dlg.locator('.me-zoom-in'), 'zoom in');
});
