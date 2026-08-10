'use strict';
/**
 * The autosave cadence is the artist's to set.
 *
 * It is the one preference whose wrong value has a directly felt cost: the
 * interval IS how much drawing a crash or a closed tab can destroy. It used to
 * be a fixed minute behind an on/off checkbox; it is now a number of minutes,
 * where 0 means off.
 */
const { test, expect } = require('@playwright/test');
const { boot, reload } = require('./helpers');

const openPrefs = async (page) => {
    await page.click('.menu-item[data-menu="settings"] .menu-label');
    await page.click('.menu-action[data-action="settings:preferences"]');
    await expect(page.locator('#pref-autosave-minutes')).toBeVisible();
};

test('the preference is minutes, and it shows the live value', async ({ page }) => {
    await boot(page);
    await openPrefs(page);

    const field = page.locator('#pref-autosave-minutes');
    expect(await field.getAttribute('type')).toBe('number');
    expect(await field.getAttribute('min')).toBe('0');
    // Default is the one-minute cadence the fixed timer used to have
    expect(await field.inputValue()).toBe('1');

    const label = await page.evaluate(() =>
        document.querySelector('#pref-autosave-minutes').closest('.pref-row').textContent.trim());
    expect(label).toMatch(/minute/i);
    expect(label).toMatch(/0/);
});

test('a chosen interval arms a timer of that length, and survives a reload',
    async ({ page }) => {
        await boot(page);
        await openPrefs(page);

        await page.fill('#pref-autosave-minutes', '7');
        await page.click('.app-dialog-footer button.primary');

        expect(await page.evaluate(() => StateManager.getAutosaveMinutes())).toBe(7);

        await reload(page);
        expect(await page.evaluate(() => StateManager.getAutosaveMinutes())).toBe(7);
        await openPrefs(page);
        expect(await page.locator('#pref-autosave-minutes').inputValue()).toBe('7');
    });

test('zero disables it, and disabled means no timer at all', async ({ page }) => {
    await boot(page);

    const armed = await page.evaluate(() => {
        StateManager.setAutosaveMinutes(5);
        return App._autosaveInterval !== null && App._autosaveInterval !== undefined;
    });
    expect(armed).toBe(true);

    // Off is off: not a timer that wakes up and returns
    const off = await page.evaluate(() => {
        StateManager.setAutosaveMinutes(0);
        return { minutes: StateManager.getAutosaveMinutes(), timer: App._autosaveInterval };
    });
    expect(off.minutes).toBe(0);
    expect(off.timer).toBeNull();

    // ...and turning it back on re-arms without a reload
    const back = await page.evaluate(() => {
        StateManager.setAutosaveMinutes(3);
        return { minutes: StateManager.getAutosaveMinutes(), armed: App._autosaveInterval !== null };
    });
    expect(back).toEqual({ minutes: 3, armed: true });
});

test('out-of-range entries are clamped, not ignored or stored raw', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(() => ({
        negative: StateManager.setAutosaveMinutes(-5),
        huge: StateManager.setAutosaveMinutes(9999),
        fractional: StateManager.setAutosaveMinutes(2.6),
        nonsense: StateManager.setAutosaveMinutes(NaN),
        max: StateManagerClass.AUTOSAVE_MAX_MINUTES
    }));
    expect(r.negative).toBe(0);              // below zero is just "off"
    expect(r.huge).toBe(r.max);
    expect(r.fractional).toBe(3);            // a timer cannot honour 2.6
    expect(r.nonsense).toBe(1);              // falls back to the default
});

test('an existing "autosave: false" preference arrives as 0 minutes', async ({ page }) => {
    await boot(page);
    // The shape this app wrote before 2026-08-07
    await page.evaluate(() => Storage.set('preferences', { autosave: false }));
    await reload(page);
    expect(await page.evaluate(() => StateManager.getAutosaveMinutes())).toBe(0);
    expect(await page.evaluate(() => App._autosaveInterval)).toBeNull();

    await page.evaluate(() => Storage.delete('preferences'));
});
