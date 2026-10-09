'use strict';
/**
 * The draw-mode bar buttons (js/ui/components/draw-mode-bar.js) carry a
 * real two-stage tooltip. Previously their title was just the mode's own
 * name, composed with an empty hint — Helpers.splitTitle returned desc==''.
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

const SELECTORS = ['draw-mode-select', 'cell-tool-select', 'mirror-select'];

/** Title of every icon the selector's pop-up offers, plus the selector's own. */
async function titles(page, selectId) {
    const own = await page.locator('#' + selectId).getAttribute('title');
    await page.click('#' + selectId);
    const items = await page.$$eval('.strip-popup .tool-btn', (els) => els.map((e) => e.getAttribute('title')));
    await page.keyboard.press('Escape');
    return [own, ...items];
}

test('every strip selector, and every icon in its pop-up, has a real two-stage tooltip', async ({ page }) => {
    await boot(page);
    // Arm a cell tool first so the cell selector also offers None.
    await page.evaluate(() => InputHandler.enterAttrPaintMode('swap'));
    let seen = 0;
    for (const id of SELECTORS) {
        for (const title of await titles(page, id)) {
            seen++;
            const { name, desc } = await page.evaluate((t) => Helpers.splitTitle(t), title);
            expect(name, `${id}`).toBeTruthy();
            expect(desc, `${id}: ${name}`).toBeTruthy();
            expect(desc).not.toBe(name);
        }
    }
    expect(seen).toBe(3 + 6 + 6 + 4);   // the three selectors, six modes, five tools and None, four mirror choices
});

test('hovering an icon in the pop-up uses the shared hover tag: the name, then the description', async ({ page }) => {
    await boot(page);
    await page.click('#draw-mode-select');
    const tip = page.locator('.app-tooltip');
    await page.locator('.strip-popup #draw-mode-xor').hover();
    await expect(tip).toBeVisible();
    await expect(page.locator('.app-tooltip-name')).toHaveText('XOR / Over');
    await expect(page.locator('.app-tooltip-desc')).toBeVisible({ timeout: 5000 });
    // The tag sits above the pop-up it describes, not under it.
    const z = await page.evaluate(() => [
        getComputedStyle(document.querySelector('.app-tooltip')).zIndex,
        getComputedStyle(document.querySelector('.strip-popup')).zIndex].map(Number));
    expect(z[0]).toBeGreaterThan(z[1]);
});
