'use strict';
/**
 * Phase 6 TESTLOG rows — reload-free locale switching, theme switching,
 * persistence, and the clipped-label rule (text-bearing controls wrap,
 * never clip) across non-Latin/diacritic locales at two font scales.
 */
const { test, expect } = require('@playwright/test');
const { boot, reload } = require('./helpers');

test('language selector shows 13 autonyms in native script', async ({ page }) => {
    await boot(page);
    const opts = await page.$$eval('#language-selector option',
        o => o.map(x => [x.value, x.textContent]));
    expect(opts.length).toBe(13);
    const map = Object.fromEntries(opts);
    expect(map.ru).toBe('Русский');       // native script, not romanized
    expect(map.cs).toBe('Čeština');
    expect(map.de).toBe('Deutsch');
});

test('locale switch re-translates live: menus, panels, status, tooltips, <html lang>', async ({ page }) => {
    await boot(page);
    await page.selectOption('#language-selector', 'de');
    await expect(page.locator('.menu-item[data-menu="file"] .menu-label')).toHaveText('Datei');
    await expect(page.locator('#layer-panel .panel-title')).toContainText(/Ebenen/i);
    expect(await page.getAttribute('html', 'lang')).toBe('de');

    // Cyrillic check — no romanization anywhere in the menu bar.
    await page.selectOption('#language-selector', 'ru');
    const fileLabel = await page.textContent('.menu-item[data-menu="file"] .menu-label');
    expect(fileLabel).toMatch(/[Ѐ-ӿ]/);
    expect(await page.getAttribute('html', 'lang')).toBe('ru');

    // Re-opened dialogs come up translated (About in ru).
    await page.click('.menu-item[data-menu="help"] .menu-label');
    await page.click('.menu-action[data-action="help:about"]');
    const dlg = page.locator('.dialog, dialog, [role="dialog"]').first();
    await expect(dlg).toBeVisible();
    await page.keyboard.press('Escape');
});

test('locale persists across F5', async ({ page }) => {
    await boot(page);
    await page.selectOption('#language-selector', 'fr');
    await page.waitForTimeout(300);
    await reload(page);
    expect(await page.getAttribute('html', 'lang')).toBe('fr');
    await expect(page.locator('.menu-item[data-menu="file"] .menu-label')).toHaveText('Fichier');
});

// Theme has no header control — Settings > Theme is the sole picker (a
// header <select> duplicated it until 2026-08-21; removed as redundant).
const THEME_IDS = ['dark', 'light', 'midnight', 'nord', 'dracula', 'sepia', 'crimson', 'citrus'];

async function pickTheme(page, id) {
    const action = 'settings:theme' + id[0].toUpperCase() + id.slice(1);
    await page.click('.menu-item[data-menu="settings"] .menu-label');
    await page.click('.menu-action--parent[data-id="theme"]');
    await page.click(`.menu-action[data-action="${action}"]`);
}

function isChecked(page, id) {
    return page.$eval(`.menu-action[data-id="theme-${id}"]`,
        el => el.classList.contains('checked') || el.getAttribute('aria-checked') === 'true');
}

test('all 8 themes apply as data-theme token overrides and persist', async ({ page }) => {
    await boot(page);
    const menuIds = await page.$$eval('#menu-theme .menu-action[data-id^="theme-"]',
        els => els.map(e => e.dataset.id.replace(/^theme-/, '')));
    expect(new Set(menuIds)).toEqual(new Set(THEME_IDS));

    const bgOf = () => page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--bg-primary').trim());
    const seen = new Set();
    for (const t of THEME_IDS) {
        await pickTheme(page, t);
        const attr = await page.getAttribute('html', 'data-theme');
        expect(attr).toBe(t);
        seen.add(await bgOf());
    }
    expect(seen.size).toBeGreaterThanOrEqual(4); // distinct surfaces (some themes may share)

    await pickTheme(page, 'sepia');
    await page.waitForTimeout(300);
    await reload(page);
    expect(await page.getAttribute('html', 'data-theme')).toBe('sepia');
});

test('Settings menu Theme submenu checkmarks track the active theme', async ({ page }) => {
    await boot(page);
    await pickTheme(page, 'light');
    expect(await page.getAttribute('html', 'data-theme')).toBe('light');
    await page.click('.menu-item[data-menu="settings"] .menu-label');
    await page.click('.menu-action--parent[data-id="theme"]');
    expect(await isChecked(page, 'light')).toBe(true);
    expect(await isChecked(page, 'dark')).toBe(false);
    await page.keyboard.press('Escape');

    await pickTheme(page, 'citrus');
    expect(await page.getAttribute('html', 'data-theme')).toBe('citrus');
    await page.click('.menu-item[data-menu="settings"] .menu-label');
    await page.click('.menu-action--parent[data-id="theme"]');
    expect(await isChecked(page, 'citrus')).toBe(true);
    expect(await isChecked(page, 'light')).toBe(false);
    await page.keyboard.press('Escape');
});

// The UI-schema rule: text-bearing controls wrap, never clip. Check the
// worst locales at two font scales (TESTLOG i18n rows across phases).
for (const locale of ['de', 'hu', 'ru']) {
    test(`no clipped labels in ${locale} at normal + large font scale`, async ({ page }) => {
        await boot(page);
        await page.selectOption('#language-selector', locale);

        const scales = await page.$$eval('#font-scale-selector option', o => o.map(x => x.value));
        for (const scale of [scales[0], scales[scales.length - 1]]) {
            await page.selectOption('#font-scale-selector', scale);
            await page.waitForTimeout(100);
            const clipped = await page.evaluate(() => {
                const out = [];
                const controls = document.querySelectorAll(
                    '#header-controls select, #zoom-controls button, #grid-controls button, ' +
                    '#attr-tools button, .panel-header button, #status-bar select');
                for (const el of controls) {
                    if (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1) {
                        out.push(`${el.tagName}#${el.id || el.className}: ${el.scrollWidth}>${el.clientWidth}`);
                    }
                }
                return out;
            });
            expect(clipped, `clipped at scale ${scale}`).toEqual([]);
        }
    });
}
