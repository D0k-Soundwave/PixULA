'use strict';
/**
 * Only the language in use is loaded, and choosing another loads it.
 *
 * Found 2026-09-28: all thirteen translation tables (~950 KB) were parsed at
 * every start-up, though only English (the fallback) and the chosen one are
 * ever read. The others now load the first time they are chosen.
 */
const { test, expect } = require('@playwright/test');
const { boot, reload, collectConsole } = require('./helpers');

const loaded = (page) => page.evaluate(() => ({
    tables: Object.keys(I18n.translations).sort(),
    scripts: [...document.querySelectorAll('script[src*="js/i18n/"]')]
        .map((s) => s.getAttribute('src').replace(/^.*\//, '')).sort()
}));

test('start-up loads English only; choosing German loads it and switches', async ({ page }) => {
    const log = await boot(page);
    expect(await loaded(page)).toEqual({ tables: ['en'], scripts: ['en.js', 'i18n-manager.js'] });

    await page.selectOption('#language-selector', 'de');
    await expect(page.locator('html')).toHaveAttribute('lang', 'de');
    expect(await page.evaluate(() => document.querySelector('.menu-item[data-menu="file"] .menu-label').textContent.trim()))
        .toBe(await page.evaluate(() => window.i18n_de['menu.file']));
    expect((await loaded(page)).tables).toEqual(['de', 'en']);
    expect(log.errors).toEqual([]);
});

test('a saved language is loaded before the app says it is ready', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => I18n.setLocale('pl'));
    await reload(page);
    const r = await page.evaluate(() => ({
        locale: I18n.getLocale(),
        lang: document.documentElement.lang,
        file: document.querySelector('.menu-item[data-menu="file"] .menu-label').textContent.trim(),
        expected: window.i18n_pl['menu.file'],
        tables: Object.keys(I18n.translations).sort()
    }));
    expect(r.locale).toBe('pl');
    expect(r.lang).toBe('pl');
    expect(r.file).toBe(r.expected);
    expect(r.tables).toEqual(['en', 'pl']);
});

test('switching quickly ends on the last choice', async ({ page }) => {
    await boot(page);
    const locale = await page.evaluate(async () => {
        const a = I18n.setLocale('ru');
        const b = I18n.setLocale('fr');
        await Promise.all([a, b]);
        return I18n.getLocale();
    });
    expect(locale).toBe('fr');
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
});
