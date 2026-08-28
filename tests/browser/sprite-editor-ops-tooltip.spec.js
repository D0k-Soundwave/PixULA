'use strict';
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

async function openFileDialog(page, action) {
    await page.click('.menu-item[data-menu="file"] .menu-label');
    await page.click(`.menu-action[data-action="${action}"]`);
}

test('every Sprite Editor nav/ops/bridge/file button has a real two-stage tooltip', async ({ page }) => {
    await boot(page);
    await openFileDialog(page, 'file:spriteEditor');
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

    await checkTwoStage(dlg.locator('.se-prev'), 'previous sprite');
    await checkTwoStage(dlg.locator('.se-next'), 'next sprite');
    for (const cls of ['se-add', 'se-remove', 'se-flip-h', 'se-flip-v',
        'se-rotate', 'se-clear', 'se-capture', 'se-save-stamp', 'se-import', 'se-export']) {
        await checkTwoStage(dlg.locator(`.${cls}`), cls);
    }
});
