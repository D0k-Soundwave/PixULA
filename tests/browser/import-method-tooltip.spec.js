'use strict';
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

test('every Import dialog conversion method has a real two-stage tooltip', async ({ page }) => {
    await boot(page);
    await page.evaluate(async () => {
        const c = document.createElement('canvas');
        c.width = 64; c.height = 48;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#ff0000'; ctx.fillRect(0, 0, 64, 48);
        const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
        const file = new File([blob], 'test.png', { type: 'image/png' });
        FileManager.loadFile(file);
    });
    const dlg = page.locator('.dialog, dialog, [role="dialog"]').first();
    await expect(dlg).toBeVisible({ timeout: 10000 });

    for (const method of ['sharp', 'smooth', 'flat']) {
        const pane = dlg.locator(`.import-method[data-method="${method}"]`);
        await expect(pane).toBeAttached();
        const title = await pane.getAttribute('title');
        const { name, desc } = await page.evaluate((t) => Helpers.splitTitle(t), title);
        expect(name, `${method} name`).toBeTruthy();
        expect(desc, `${method} description`).toBeTruthy();
        expect(desc, `${method} description differs from name`).not.toBe(name);
    }
    await page.keyboard.press('Escape');
});
