'use strict';
/**
 * Boot smoke — TESTLOG Phase 4 "Chrome / layout" rows.
 * The app must boot over file:// with no console errors (boot-manifest
 * assert silent) and present the full shell.
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

test('app boots with no console errors; boot-manifest assert silent', async ({ page }) => {
    const consoleLog = await boot(page);
    expect(consoleLog.errors).toEqual([]);
    // Boot manifest satisfied = every global present; init reached the end.
    const ready = await page.evaluate(() => document.documentElement.dataset.appReady);
    expect(ready).toBe('1');
});

test('page never scrolls — html/body pinned', async ({ page }) => {
    await boot(page);
    const overflow = await page.evaluate(() => ({
        html: getComputedStyle(document.documentElement).overflow,
        body: getComputedStyle(document.body).overflow,
        scrollable: document.documentElement.scrollHeight > document.documentElement.clientHeight
    }));
    expect(overflow.html).toBe('hidden');
    expect(overflow.body).toBe('hidden');
});
