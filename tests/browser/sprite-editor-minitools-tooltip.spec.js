'use strict';
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

async function openFileDialog(page, action) {
    await page.click('.menu-item[data-menu="file"] .menu-label');
    await page.click(`.menu-action[data-action="${action}"]`);
}

test('Sprite Editor mini-tools have real two-stage tooltips and still switch tools', async ({ page }) => {
    await boot(page);
    await openFileDialog(page, 'file:spriteEditor');
    const dlg = page.locator('.dialog, dialog, [role="dialog"]').first();
    await expect(dlg).toBeVisible();

    for (const tool of ['brush', 'eraser', 'line', 'fill']) {
        const btn = dlg.locator(`button[data-tool="${tool}"]`);
        await expect(btn).toBeAttached();
        const title = await btn.getAttribute('title');
        const { name, desc } = await page.evaluate((t) => Helpers.splitTitle(t), title);
        expect(name, `${tool} name`).toBeTruthy();
        expect(desc, `${tool} description`).toBeTruthy();
        expect(desc, `${tool} description differs from name`).not.toBe(name);
    }

    // Behavior must survive the dedup: clicking still switches the editor's tool.
    await dlg.locator('button[data-tool="eraser"]').click();
    await expect(dlg.locator('button[data-tool="eraser"]')).toHaveClass(/active/);
    await expect(dlg.locator('button[data-tool="brush"]')).not.toHaveClass(/active/);
});
