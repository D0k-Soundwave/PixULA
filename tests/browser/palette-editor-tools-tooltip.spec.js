'use strict';
const { test, expect } = require('@playwright/test');
const { boot, selectMode } = require('./helpers');

test('every Palette Editor tool button and kind select have real two-stage tooltips', async ({ page }) => {
    // Helper to check two-stage tooltip structure
    const checkTwoStage = async (locator, label) => {
        await expect(locator).toBeAttached();
        const title = await locator.getAttribute('title');
        const { name, desc } = await page.evaluate((t) => Helpers.splitTitle(t), title);
        expect(name, `${label} name`).toBeTruthy();
        expect(desc, `${label} description`).toBeTruthy();
        expect(desc, `${label} description differs from name`).not.toBe(name);
    };

    // Test ULAplus palette editor (has tool buttons, no kind select)
    await boot(page);
    await selectMode(page, 'ula_plus');
    await page.waitForFunction(() => ACTIVE_SCREEN_MODE.id === 'ula_plus');
    await page.click('.menu-item[data-menu="image"] .menu-label');
    await page.click('.menu-action[data-action="image:editPalette"]');
    let dlg = page.locator('.dialog, dialog, [role="dialog"]').first();
    await expect(dlg).toBeVisible();

    for (const cls of ['palette-editor-tool-button']) {
        const count = await dlg.locator(`.${cls}`).count();
        expect(count).toBeGreaterThanOrEqual(3); // Load, Save, From image, Blend (Load absent only if scratch)
        for (let i = 0; i < count; i++) {
            await checkTwoStage(dlg.locator(`.${cls}`).nth(i), `ULAplus tool button ${i}`);
        }
    }

    // Close the dialog
    await page.keyboard.press('Escape');

    // Test rgb333 palette editor (has tool buttons AND kind select)
    // Handle the confirm dialog for lossy mode conversion
    page.on('dialog', (d) => d.accept());
    await selectMode(page, 'layer2_256');
    await page.waitForFunction(() => ACTIVE_SCREEN_MODE.id === 'layer2_256');
    await page.click('.menu-item[data-menu="image"] .menu-label');
    await page.click('.menu-action[data-action="image:editPalette"]');
    dlg = page.locator('.dialog, dialog, [role="dialog"]').first();
    await expect(dlg).toBeVisible();

    // Check tool buttons again
    for (const cls of ['palette-editor-tool-button']) {
        const count = await dlg.locator(`.${cls}`).count();
        expect(count).toBeGreaterThanOrEqual(3);
        for (let i = 0; i < count; i++) {
            await checkTwoStage(dlg.locator(`.${cls}`).nth(i), `Next tool button ${i}`);
        }
    }

    // Check the kind select (only present in rgb333 modes with multiple file kinds)
    const kindCount = await dlg.locator('.palette-editor-kind').count();
    expect(kindCount).toBe(1); // Next modes have both .pal and .npl
    await checkTwoStage(dlg.locator('.palette-editor-kind'), 'Next kind select');
});
