'use strict';
/**
 * The menu bar works without a mouse (WAI-ARIA menubar pattern).
 *
 * Found 2026-09-27: the menu labels were plain <span>s - no tab stop, no
 * role, no key handling - so a keyboard-only user could not reach File, Edit
 * or anything under them, which is every save, export and setting.
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

const focused = (page) => page.evaluate(() => {
    const e = document.activeElement;
    return {
        text: (e.querySelector?.('.menu-action-label') || e).textContent.trim(),
        role: e.getAttribute('role'),
        cls: e.className
    };
});

test('the menu bar is a real menubar with one tab stop', async ({ page }) => {
    await boot(page);
    const a11y = await page.evaluate(() => ({
        bar: document.getElementById('menu-bar').getAttribute('role'),
        labels: [...document.querySelectorAll('.menu-label')].map((l) => [l.getAttribute('role'), l.tabIndex]),
        menus: [...document.querySelectorAll('.menu-dropdown')].every((d) => d.getAttribute('role') === 'menu'),
        toggles: [...document.querySelectorAll('.menu-toggle')].every((t) =>
            t.getAttribute('role') === 'menuitemcheckbox' && t.hasAttribute('aria-checked'))
    }));
    expect(a11y.bar).toBe('menubar');
    expect(a11y.labels.every(([role]) => role === 'menuitem')).toBe(true);
    expect(a11y.labels.filter(([, tab]) => tab === 0)).toHaveLength(1);
    expect(a11y.menus).toBe(true);
    expect(a11y.toggles).toBe(true);
});

test('F10, arrows, Enter and Escape drive the menus', async ({ page }) => {
    await boot(page);
    await page.keyboard.press('F10');
    expect((await focused(page)).cls).toContain('menu-label');
    expect(await page.evaluate(() => document.activeElement.textContent.trim())).toBe('File');

    // Right moves along the bar; Down opens the menu on its first row
    await page.keyboard.press('ArrowRight');
    expect(await page.evaluate(() => document.activeElement.textContent.trim())).toBe('Edit');
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('#menu-edit')).toBeVisible();
    expect(await page.locator('.menu-label', { hasText: 'Edit' }).getAttribute('aria-expanded')).toBe('true');
    expect((await focused(page)).role).toMatch(/^menuitem/);

    // Escape closes and hands focus back to the bar
    await page.keyboard.press('Escape');
    await expect(page.locator('#menu-edit')).toBeHidden();
    expect(await page.evaluate(() => document.activeElement.textContent.trim())).toBe('Edit');

    // Enter on a row runs it: View > Show Pixel Grid toggles the pixel grid
    await page.keyboard.press('ArrowRight'); // View
    await page.keyboard.press('Enter');
    const before = await page.evaluate(() => GridOverlay.pixelGridVisible);
    for (let i = 0; i < 12; i++) {
        if ((await focused(page)).text === 'Show Pixel Grid') break;
        await page.keyboard.press('ArrowDown');
    }
    expect((await focused(page)).text).toBe('Show Pixel Grid');
    await page.keyboard.press('Enter');
    expect(await page.evaluate(() => GridOverlay.pixelGridVisible)).toBe(!before);
    await expect(page.locator('#menu-view')).toBeHidden();
});

test('arrow keys in an open menu never reach the canvas shortcuts', async ({ page }) => {
    await boot(page);
    const tool = () => page.evaluate(() => ToolManager.currentTool?.id);
    const start = await tool();
    await page.keyboard.press('F10');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('g'); // Fill's shortcut must not fire behind the menu
    expect(await tool()).toBe(start);
    await page.keyboard.press('Escape');
});

test('a submenu opens with Right and closes with Left', async ({ page }) => {
    await boot(page);
    await page.keyboard.press('F10');
    await page.keyboard.press('ArrowDown'); // File, first row
    for (let i = 0; i < 6; i++) {
        if ((await focused(page)).text === 'Save Image As...') break;
        await page.keyboard.press('ArrowDown');
    }
    expect((await focused(page)).text).toBe('Save Image As...');
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#menu-export-as')).toBeVisible();
    expect(await page.evaluate(() => document.activeElement.closest('#menu-export-as') !== null)).toBe(true);
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('#menu-export-as')).toBeHidden();
    expect((await focused(page)).text).toBe('Save Image As...');
});
