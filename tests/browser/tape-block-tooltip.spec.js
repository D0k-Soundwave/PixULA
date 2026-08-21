'use strict';
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

test('every Tape Block row action button has a real two-stage tooltip', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => {
        const buf = TAPFormat.export({ border: 0, name: 'test' });
        TapeBlockDialog.open(buf.buffer, 'test.tap');
    });
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

    await checkTwoStage(dlg.locator('button[data-act="load"]').first(), 'load');
    await checkTwoStage(dlg.locator('button[data-act="up"]').first(), 'move up');
    await checkTwoStage(dlg.locator('button[data-act="down"]').first(), 'move down');
    await checkTwoStage(dlg.locator('button[data-act="remove"]').first(), 'remove');
});
