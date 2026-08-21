'use strict';
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

async function openFileDialog(page, action) {
    await page.click('.menu-item[data-menu="file"] .menu-label');
    await page.click(`.menu-action[data-action="${action}"]`);
}

test('every Font Editor glyph-op button has a real two-stage tooltip', async ({ page }) => {
    await boot(page);
    await openFileDialog(page, 'file:fontEditor');
    const dlg = page.locator('.dialog, dialog, [role="dialog"]').first();
    await expect(dlg).toBeVisible();

    const ops = ['clear', 'copy', 'paste', 'invert', 'flip-h', 'flip-v',
        'shift-left', 'shift-right', 'shift-up', 'shift-down'];
    for (const op of ops) {
        const btn = dlg.locator(`button[data-op="${op}"]`);
        await expect(btn).toBeAttached();
        const title = await btn.getAttribute('title');
        const { name, desc } = await page.evaluate(
            (t) => Helpers.splitTitle(t), title);
        expect(name, `${op} name`).toBeTruthy();
        expect(desc, `${op} description`).toBeTruthy();
        expect(desc, `${op} description differs from name`).not.toBe(name);
    }
});
