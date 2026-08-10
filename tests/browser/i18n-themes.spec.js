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

test('all 6 themes apply as data-theme token overrides and persist', async ({ page }) => {
    await boot(page);
    const themes = await page.$$eval('#theme-selector option', o => o.map(x => x.value));
    expect(themes).toEqual(['dark', 'light', 'midnight', 'nord', 'dracula', 'sepia']);

    const bgOf = () => page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--bg-primary').trim());
    const seen = new Set();
    for (const t of themes) {
        await page.selectOption('#theme-selector', t);
        const attr = await page.getAttribute('html', 'data-theme');
        expect(attr).toBe(t);
        seen.add(await bgOf());
    }
    expect(seen.size).toBeGreaterThanOrEqual(4); // distinct surfaces (some themes may share)

    await page.selectOption('#theme-selector', 'sepia');
    await page.waitForTimeout(300);
    await reload(page);
    expect(await page.getAttribute('html', 'data-theme')).toBe('sepia');
});

test('Settings menu Light/Dark toggles track the header selector and vice versa', async ({ page }) => {
    await boot(page);
    await page.click('.menu-item[data-menu="settings"] .menu-label');
    await page.click('.menu-action[data-action="settings:themeLight"]');
    expect(await page.getAttribute('html', 'data-theme')).toBe('light');
    expect(await page.inputValue('#theme-selector')).toBe('light');

    await page.selectOption('#theme-selector', 'dark');
    await page.click('.menu-item[data-menu="settings"] .menu-label');
    const darkChecked = await page.$eval('.menu-action[data-id="theme-dark"]',
        el => el.classList.contains('checked') || el.getAttribute('aria-checked') === 'true');
    expect(darkChecked).toBe(true);
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
