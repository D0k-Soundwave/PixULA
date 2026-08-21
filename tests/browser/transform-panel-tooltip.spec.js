'use strict';
/**
 * Every control in the Transform panel (js/ui/components/transform-panel.js)
 * carries a real two-stage tooltip. Previously none of them had a title at
 * all — the static template only carried data-i18n for visible text.
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

test('every Transform panel control has a real two-stage tooltip', async ({ page }) => {
    await boot(page);
    const selectors = [
        '.tp-reset', '[data-tp-transform="flipH"]', '[data-tp-transform="flipV"]',
        '[data-tp-transform="invert"]', '[data-tp-transform="outline"]',
        '.tp-shift-step', '.tp-shift-wrap'
    ];
    for (const sel of selectors) {
        const el = page.locator(sel).first();
        await expect(el).toBeAttached();
        const title = await el.getAttribute('title');
        const { name, desc } = await page.evaluate(
            (t) => Helpers.splitTitle(t), title);
        expect(name).toBeTruthy();
        expect(desc).toBeTruthy();
        expect(desc).not.toBe(name);
    }
});
