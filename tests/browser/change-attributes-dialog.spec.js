'use strict';
/**
 * Image > Attributes > Change... (batch 2 part 2C): the dialog's layout per
 * mode, the live count, OK as one undo step, Cancel and Escape writing
 * nothing, and the radios working from the keyboard. What each rule writes is
 * pinned in Node by tests/change-attributes.test.js.
 */
const { test, expect } = require('@playwright/test');
const { boot, selectMode } = require('./helpers');

const DIALOG = 'dialog[open].attr-change-dialog';

const openDialog = async (page) => {
    await page.click('[data-menu="image"]');
    await page.hover('#menu-image [data-id="attributes"]');
    await page.waitForTimeout(150);
    await page.click('#menu-image [data-id="attr-change"]');
    await page.waitForSelector(DIALOG);
};

const undoCount = (page) => page.evaluate(() => UndoRedo.getUndoCount());

test('standard ULA: Bright and Flash, no CLUT, no Screen B', async ({ page }) => {
    await boot(page);
    await openDialog(page);
    expect(await page.locator(`${DIALOG} input[name="attr-change-find-bright"]`).count()).toBeGreaterThan(0);
    expect(await page.locator(`${DIALOG} input[name="attr-change-find-flash"]`).count()).toBeGreaterThan(0);
    expect(await page.locator(`${DIALOG} input[name="attr-change-find-clut"]`).count()).toBe(0);
    expect(await page.locator(`${DIALOG} input[name="attr-change-find-inkB"]`).count()).toBe(0);
});

test('ULAplus shows CLUT in place of Bright and Flash', async ({ page }) => {
    await boot(page);
    await page.waitForTimeout(100);
    await selectMode(page, 'ula_plus');
    await openDialog(page);
    expect(await page.locator(`${DIALOG} input[name="attr-change-replace-clut"]`).count()).toBeGreaterThan(0);
    expect(await page.locator(`${DIALOG} input[name="attr-change-replace-bright"]`).count()).toBe(0);
    expect(await page.locator(`${DIALOG} input[name="attr-change-replace-flash"]`).count()).toBe(0);
});

test('GigaScreen shows Screen A and Screen B groups and one Flash', async ({ page }) => {
    await boot(page);
    await selectMode(page, 'gigascreen');
    await openDialog(page);
    expect(await page.locator(`${DIALOG} input[name="attr-change-find-inkB"]`).count()).toBeGreaterThan(0);
    expect(await page.locator(`${DIALOG} input[name="attr-change-replace-brightB"]`).count()).toBeGreaterThan(0);
    expect(await page.locator(`${DIALOG} input[name="attr-change-find-flash"]`).count()).toBeGreaterThan(0);
    expect(await page.locator(`${DIALOG} input[name="attr-change-find-flashB"]`).count()).toBe(0);
});

test('the count is live, and OK applies it as one undo step', async ({ page }) => {
    await boot(page);
    await openDialog(page);
    await page.check(`${DIALOG} input[name="attr-change-replace-paper"][value="1"]`);
    const text = await page.textContent(`${DIALOG} .attr-change-count`);
    const shown = Number(text.match(/\d+/)[0]);
    const expected = await page.evaluate(() => TransformService.previewChangeAttributes(
        { ink: null, paper: null, bright: null, flash: null },
        { ink: null, paper: 1, bright: null, flash: null }));
    expect(shown, text).toBe(expected);
    expect(shown).toBeGreaterThan(0);

    const before = await undoCount(page);
    await page.click(`${DIALOG} button:has-text("OK")`);
    await expect(page.locator(DIALOG)).toHaveCount(0);
    expect(await undoCount(page)).toBe(before + 1);
});

test('Cancel and Escape change nothing', async ({ page }) => {
    await boot(page);
    await openDialog(page);
    await page.check(`${DIALOG} input[name="attr-change-replace-paper"][value="1"]`);
    const before = await undoCount(page);
    await page.click(`${DIALOG} button:has-text("Cancel")`);
    await expect(page.locator(DIALOG)).toHaveCount(0);
    expect(await undoCount(page)).toBe(before);

    await openDialog(page);
    await page.check(`${DIALOG} input[name="attr-change-replace-paper"][value="2"]`);
    await page.keyboard.press('Escape');
    await expect(page.locator(DIALOG)).toHaveCount(0);
    expect(await undoCount(page)).toBe(before);
});

test('the radios work from the keyboard', async ({ page }) => {
    await boot(page);
    await openDialog(page);
    await page.focus(`${DIALOG} input[name="attr-change-find-ink"][value="any"]`);
    await page.keyboard.press('ArrowRight');
    expect(await page.isChecked(`${DIALOG} input[name="attr-change-find-ink"][value="0"]`)).toBe(true);
});
