'use strict';
/**
 * The Load select and Save button (js/ui/components/preset-controls.js
 * buildRow) and the rename/delete icon buttons (_iconButton) all already
 * carried a real hint sentence as a flat native title. This wires them into
 * the two-stage mechanism rather than authoring new copy.
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

test('the tool preset Load select and Save button have real two-stage tooltips', async ({ page }) => {
    await boot(page);
    await page.keyboard.press('b'); // any tool with presets — Brush
    for (const id of ['tool-preset-select', 'tool-preset-save']) {
        const el = page.locator(`#${id}`);
        await expect(el).toBeAttached();
        const title = await el.getAttribute('title');
        const { name, desc } = await page.evaluate(
            (t) => Helpers.splitTitle(t), title);
        expect(name).toBeTruthy();
        expect(desc).toBeTruthy();
        expect(desc).not.toBe(name);
    }
});
