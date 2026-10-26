'use strict';
/**
 * The undo depth setting in a real browser (owner decision 2026-10-19): Preferences > General >
 * Undo steps, 1 to 2000, 500 to start with, kept across a reload, lowering it drops the oldest
 * steps at once, and the hint says the 256 MB memory cap can keep fewer. The history itself is
 * pinned in Node by tests/undo-depth.test.js.
 */
const { test, expect } = require('@playwright/test');
const { boot, reload } = require('./helpers');

const DIALOG = '#dialog-preferences-dialog';

async function openPrefs(page) {
    await page.evaluate(() => PreferencesDialog.open());
    await expect(page.locator('#pref-undo-limit')).toBeVisible();
}

async function ok(page) {
    await page.click(`${DIALOG} .app-dialog-footer button.primary`);
    await expect(page.locator(DIALOG)).toHaveCount(0);
}

async function setDepth(page, value) {
    await openPrefs(page);
    await page.locator('#pref-undo-limit').fill(String(value));
    await ok(page);
}

/** n separate one-pixel steps on the current layer, each its own undo entry. */
const steps = (page, n) => page.evaluate((count) => {
    for (let i = 0; i < count; i++) {
        UndoRedo.beginAction('test step');
        PixelDrawRoutine.draw(i % ZX_SPECTRUM.WIDTH, 8 + Math.floor(i / ZX_SPECTRUM.WIDTH),
            ColorManager.getCurrentSelection(), DRAW_MODE.NORMAL, { layer: LayerManager.getCurrentLayer() });
        UndoRedo.endAction();
    }
}, n);

const depth = (page) => page.evaluate(() => UndoRedo.maxStates);
const count = (page) => page.evaluate(() => UndoRedo.getUndoCount());

test('Preferences shows the undo depth, 1 to 2000, 500 to start, with the memory cap hint', async ({ page }) => {
    await boot(page);
    await openPrefs(page);
    const field = page.locator('#pref-undo-limit');
    await expect(field).toHaveValue('500');
    await expect(field).toHaveAttribute('min', '1');
    await expect(field).toHaveAttribute('max', '2000');
    // It sits in the General section, before the backup block.
    expect(await page.evaluate(() => {
        const f = document.querySelector('#pref-undo-limit');
        const backup = document.querySelector('#pref-backup');
        return !!(f.compareDocumentPosition(backup) & Node.DOCUMENT_POSITION_FOLLOWING);
    })).toBe(true);
    const hint = page.locator('#pref-undo-limit-hint');
    await expect(hint).toBeVisible();
    await expect(hint).toContainText('1 to 2000');
    await expect(hint).toContainText('256 MB');
    await expect(hint).toContainText('fewer steps than');
});

test('a depth set in Preferences applies at once and survives a reload', async ({ page }) => {
    await boot(page);
    await setDepth(page, 1500);
    expect(await depth(page)).toBe(1500);
    await reload(page);
    await expect.poll(() => depth(page)).toBe(1500);
    await openPrefs(page);
    await expect(page.locator('#pref-undo-limit')).toHaveValue('1500');
});

test('lowering the depth drops the oldest steps at once', async ({ page }) => {
    await boot(page);
    await steps(page, 12);
    expect(await count(page)).toBe(12);
    await setDepth(page, 4);
    expect(await count(page)).toBe(4);
    for (let i = 0; i < 6; i++) await page.evaluate(() => UndoRedo.undo());
    expect(await page.evaluate(() => UndoRedo.getRedoCount())).toBe(4);
    expect(await page.evaluate(() => UndoRedo.canUndo())).toBe(false);
});

test('a typed value outside the range is held to it, and Cancel changes nothing', async ({ page }) => {
    await boot(page);
    await setDepth(page, 5000);
    expect(await depth(page)).toBe(2000);
    await setDepth(page, 0);
    expect(await depth(page)).toBe(1);
    await setDepth(page, 300);
    expect(await depth(page)).toBe(300);
    // The field reads the number as the browser does: 1e3 is 1000, not 1, and a fraction rounds
    await steps(page, 5);
    await setDepth(page, '1e3');
    expect(await depth(page)).toBe(1000);
    expect(await count(page), 'no step is lost to a misread number').toBe(5);
    await setDepth(page, '7.6');
    expect(await depth(page)).toBe(8);
    await setDepth(page, 300);
    // Emptied, the field keeps the depth it had
    await setDepth(page, '');
    expect(await depth(page)).toBe(300);
    await openPrefs(page);
    await page.locator('#pref-undo-limit').fill('20');
    await page.click(`${DIALOG} .app-dialog-footer button:not(.primary)`);
    await expect(page.locator(DIALOG)).toHaveCount(0);
    expect(await depth(page)).toBe(300);
});

test('an untouched dialog stores no depth; Reset All Preferences returns it to 500', async ({ page }) => {
    await boot(page);
    await openPrefs(page);
    await ok(page);
    expect(await page.evaluate(() => Storage.get('pref.undoLimit'))).toBeFalsy();

    await setDepth(page, 42);
    await reload(page);
    await expect.poll(() => depth(page)).toBe(42);
    page.once('dialog', (d) => d.accept());
    await Promise.all([
        page.waitForEvent('load'),
        page.evaluate(() => PreferencesDialog.resetAll())
    ]);
    await page.waitForSelector('html[data-app-ready]', { timeout: 15000 });
    expect(await depth(page)).toBe(500);
    expect(await page.evaluate(() => Storage.get('pref.undoLimit'))).toBeFalsy();
});

test('the depth holds the same in every kind of screen mode', async ({ page }) => {
    await boot(page);
    await setDepth(page, 3);
    const modes = await page.evaluate(() => ScreenModeService.getModes().map(m => m.id));
    expect(modes.length).toBeGreaterThan(10);
    for (const mode of modes.filter(m => m !== 'standard_ula').concat('standard_ula')) {
        await page.evaluate((m) => ScreenModeService.switchMode(m), mode);
        await expect.poll(() => page.evaluate(() => ACTIVE_SCREEN_MODE.id)).toBe(mode);
        await steps(page, 6);
        expect(await count(page), mode).toBe(3);
    }
});

test('the hint has its numbers filled in other languages', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => I18n.setLocale('de'));
    await openPrefs(page);
    const text = await page.locator('#pref-undo-limit-hint').textContent();
    expect(text).toContain('2000');
    expect(text).toContain('256');
    expect(text).not.toContain('{');
    await page.locator(DIALOG + ' .app-dialog-footer button:not(.primary)').click();
    await page.evaluate(() => I18n.setLocale('en'));
});
