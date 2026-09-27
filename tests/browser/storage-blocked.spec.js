'use strict';
/**
 * When the browser keeps nothing, the app still works - and says so once.
 *
 * Found 2026-09-27: with site data blocked (IndexedDB and localStorage both
 * refused) every storage access logged its own error, over a hundred at
 * start-up, and nothing told the artist that settings and autosave would
 * vanish with the tab.
 */
const { test, expect } = require('@playwright/test');
const { collectConsole, APP_URL } = require('./helpers');

const blockStorage = () => {
    Object.defineProperty(window, 'indexedDB', { get() { return undefined; }, configurable: true });
    Object.defineProperty(window, 'localStorage', {
        get() { throw new DOMException('denied', 'SecurityError'); },
        configurable: true
    });
};

test('blocked storage: one notice, no error flood, and the app still draws', async ({ page }) => {
    await page.addInitScript(blockStorage);
    const alerts = [];
    page.on('dialog', (d) => { alerts.push(d.message()); d.accept(); });
    const consoleLog = collectConsole(page);
    await page.goto(APP_URL);
    await page.waitForSelector('html[data-app-ready]');

    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatch(/storage/i);
    expect(consoleLog.errors).toEqual([]);
    expect(await page.evaluate(() => Storage.persistent)).toBe(false);

    // Drawing and preferences still work for the session
    await page.evaluate(() => {
        PixelDrawRoutine.draw(10, 10, ColorManager.getCurrentSelection(), DRAW_MODE.NORMAL);
    });
    expect(await page.evaluate(() => PixelDrawRoutine.getPixelState(10, 10)?.isInk)).toBe(true);
});

test('normal storage: no notice', async ({ page }) => {
    const alerts = [];
    page.on('dialog', (d) => { alerts.push(d.message()); d.accept(); });
    await page.goto(APP_URL);
    await page.waitForSelector('html[data-app-ready]');
    expect(alerts).toEqual([]);
    expect(await page.evaluate(() => Storage.persistent)).toBe(true);
});
