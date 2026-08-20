'use strict';
/**
 * option-controls.js's icon-grid buttons (_buildIconButton) can now carry a
 * real "how it works" hint via an optional hintI18n field on the schema
 * option, composed the same way the tool rail's buttons are. This batch
 * proves the mechanism on the Shape Type row's "basic" category; other
 * tools' icon-grid options are deliberately unchanged (batch 2/3 work).
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

test('shape type basic-category buttons have real two-stage tooltips', async ({ page }) => {
    await boot(page);
    await page.keyboard.press('s'); // Shape tool
    const values = ['line', 'rectangle', 'square', 'rounded-rectangle'];
    for (const value of values) {
        const btn = page.locator(`.opt-icon-grid button[data-value="${value}"]`);
        await expect(btn).toBeAttached();
        const title = await btn.getAttribute('title');
        const { name, desc } = await page.evaluate(
            (t) => Helpers.splitTitle(t), title);
        expect(desc).toBeTruthy();
        expect(desc).not.toBe(name);
    }
});

test('a shape type button with no hintI18n still renders name-only, unchanged', async ({ page }) => {
    await boot(page);
    await page.keyboard.press('s');
    // 'triangle' is in the polygons category, untouched by this task.
    const btn = page.locator('.opt-icon-grid button[data-value="triangle"]');
    const title = await btn.getAttribute('title');
    const { name, desc } = await page.evaluate(
        (t) => Helpers.splitTitle(t), title);
    expect(name).toBeTruthy();
    expect(desc).toBe('');
});
