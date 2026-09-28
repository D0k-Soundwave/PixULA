'use strict';
/**
 * A dialog's buttons stay on screen, and closing it gives focus back.
 *
 * Found 2026-09-27: the whole dialog scrolled as one, so OK/Cancel slid out
 * of view with the content (Preferences at every window size, the Sprite
 * Editor on a phone held sideways); and after a dialog opened from the menu
 * closed, keyboard focus fell to the top of the page.
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

const footerOnScreen = (page) => page.evaluate(() => {
    const d = [...document.querySelectorAll('dialog[open]')].pop();
    const f = d.querySelector('.app-dialog-footer').getBoundingClientRect();
    return f.top >= 0 && f.bottom <= innerHeight + 1 && f.height > 0;
});

for (const [w, h, action] of [
    [1280, 720, 'settings:preferences'],
    [1024, 768, 'settings:preferences'],
    [844, 390, 'settings:preferences'],
    [844, 390, 'file:spriteEditor']
]) {
    test(`${action} keeps its buttons on screen at ${w}x${h}`, async ({ page }) => {
        await page.setViewportSize({ width: w, height: h });
        await boot(page);
        await page.evaluate((a) => MenuSystem._executeAction(a), action);
        await page.waitForSelector('dialog[open] .app-dialog-footer');
        expect(await footerOnScreen(page)).toBe(true);
        // The body scrolls instead, and all of it can be reached
        const body = await page.evaluate(() => {
            const b = [...document.querySelectorAll('dialog[open]')].pop().querySelector('.app-dialog-body');
            b.scrollTop = b.scrollHeight;
            return b.scrollTop + b.clientHeight >= b.scrollHeight - 1;
        });
        expect(body).toBe(true);
        expect(await footerOnScreen(page)).toBe(true);
    });
}

test('focus returns to the menu after a dialog opened from the keyboard closes', async ({ page }) => {
    await boot(page);
    const focused = () => page.evaluate(() => {
        const e = document.activeElement;
        return (e.querySelector('.menu-action-label') || e).textContent.trim();
    });
    await page.keyboard.press('F10');
    for (let i = 0; i < 10 && (await focused()) !== 'Settings'; i++) await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowDown');
    for (let i = 0; i < 15 && !/^Preferences/.test(await focused()); i++) await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(page.locator('#dialog-preferences-dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#dialog-preferences-dialog')).toHaveCount(0);
    expect(await focused()).toBe('Settings');
});

test('after a mouse-opened menu dialog, letter shortcuts still reach the canvas', async ({ page }) => {
    await boot(page);
    await page.click('.menu-item[data-menu="settings"] .menu-label');
    await page.click('.menu-action[data-action="settings:preferences"]');
    await page.click('#dialog-preferences-dialog .app-dialog-footer button:not(.primary)');
    await expect(page.locator('#dialog-preferences-dialog')).toHaveCount(0);
    expect(await page.evaluate(() => !!document.activeElement.closest('#menu-bar'))).toBe(false);
    await page.keyboard.press('e');
    expect(await page.evaluate(() => StateManager.getCurrentTool())).toBe('eraser');
});
