'use strict';
/**
 * Inverse (batch 4 part 4A) in a real browser: the Preferences checkbox, Shift+I, the status line, what
 * it does to a real brush stroke, and that it is remembered. (It was a strip button until the owner
 * moved it to Preferences on 2026-10-09.) Which draw mode does what with each button is pinned in Node
 * by tests/inverse-mode.test.js.
 */
const { test, expect } = require('@playwright/test');
const { boot, reload, selectMode } = require('./helpers');

/** Page coordinates of the centre of app pixel (px, py). */
async function pixelPoint(page, px, py) {
    const box = await page.frameLocator('#canvas-frame').locator('#main-canvas').boundingBox();
    const dims = await page.evaluate(() => ({ w: ZX_SPECTRUM.WIDTH, h: ZX_SPECTRUM.HEIGHT }));
    return {
        x: box.x + (px + 0.5) * box.width / dims.w,
        y: box.y + (py + 0.5) * box.height / dims.h
    };
}

async function click(page, px, py, button) {
    const p = await pixelPoint(page, px, py);
    await page.mouse.move(p.x, p.y);
    await page.mouse.down({ button });
    await page.mouse.up({ button });
}

const dot = (page, x, y) => page.evaluate(([px, py]) => {
    const c = LayerManager.getCurrentLayer().getCell(Math.floor(px / ZX_SPECTRUM.CELL_WIDTH), Math.floor(py / ZX_SPECTRUM.CELL_HEIGHT));
    return ((c.pixels[py % ZX_SPECTRUM.CELL_HEIGHT] >> (7 - (px % 8))) & 1) === 1;
}, [x, y]);

const inverse = (page) => page.evaluate(() => StateManager.getInverse());

async function setInPreferences(page, on) {
    await page.evaluate(() => PreferencesDialog.open());
    const box = page.locator('#pref-inverse');
    await expect(box).toBeVisible();
    if (on) await box.check(); else await box.uncheck();
    await page.click('#dialog-preferences-dialog .app-dialog-footer button.primary');
    await expect(page.locator('#dialog-preferences-dialog')).toHaveCount(0);
}

test('there is no Inverse button in the strip; Preferences and Shift+I switch it', async ({ page }) => {
    await boot(page);
    expect(await page.locator('#inverse-toggle').count()).toBe(0);
    expect(await inverse(page)).toBe(false);

    await setInPreferences(page, true);
    expect(await inverse(page)).toBe(true);
    await page.evaluate(() => PreferencesDialog.open());
    await expect(page.locator('#pref-inverse')).toBeChecked();
    // Cancel changes nothing.
    await page.locator('#pref-inverse').uncheck();
    await page.click('#dialog-preferences-dialog .app-dialog-footer button:not(.primary)');
    await expect(page.locator('#dialog-preferences-dialog')).toHaveCount(0);
    expect(await inverse(page)).toBe(true);

    await page.keyboard.press('Shift+I');
    expect(await inverse(page)).toBe(false);
    await page.keyboard.press('Shift+I');
    expect(await inverse(page)).toBe(true);
});

test('the status line says Inverse is on, and says when it changes nothing', async ({ page }) => {
    await boot(page);
    const status = page.locator('#draw-mode-status');
    await expect(status).toBeHidden();
    await page.keyboard.press('Shift+I');
    await expect(status).toHaveText('Inverse is on');
    await page.click('#draw-modes [data-draw-mode="pixel_only"]');
    await expect(status).toContainText('Inverse is on');
    await expect(status).toContainText('Pixels Only');
    await page.click('#draw-modes [data-draw-mode="xor"]');
    await expect(status).toContainText('changes nothing');
    await page.click('#draw-modes [data-draw-mode="normal"]');
    await page.keyboard.press('Shift+I');
    await expect(status).toBeHidden();
});

test('with Inverse on the buttons swap: right sets a dot and left clears it', async ({ page }) => {
    await boot(page);
    await page.keyboard.press('b');
    await click(page, 60, 60, 'left');
    expect(await dot(page, 60, 60), 'Inverse off: left sets').toBe(true);
    await click(page, 60, 60, 'right');
    expect(await dot(page, 60, 60), 'Inverse off: right clears').toBe(false);

    await setInPreferences(page, true);
    await click(page, 70, 60, 'right');
    expect(await dot(page, 70, 60), 'Inverse on: right sets').toBe(true);
    await click(page, 70, 60, 'left');
    expect(await dot(page, 70, 60), 'Inverse on: left clears').toBe(false);
});

test('Inverse is remembered across a reload and shows in the shortcut list', async ({ page }) => {
    await boot(page);
    await page.keyboard.press('Shift+I');
    await page.waitForTimeout(300);
    await reload(page);
    expect(await inverse(page)).toBe(true);
    await expect(page.locator('#draw-mode-status')).toHaveText('Inverse is on');
    await page.evaluate(() => PreferencesDialog.open());
    await expect(page.locator('#pref-inverse')).toBeChecked();
    await page.click('#dialog-preferences-dialog .app-dialog-footer button:not(.primary)');
    const listed = await page.evaluate(() => MODE_SHORTCUTS.map((s) => s.keys));
    expect(listed).toEqual(['Shift+I']);
});

test('Inverse works in indexed modes too', async ({ page }) => {
    await boot(page);
    page.on('dialog', (d) => d.accept());
    await selectMode(page, 'layer2_256');
    await page.keyboard.press('Shift+I');
    const mode = await page.evaluate(() => PixelDrawRoutine.resolveUserMode(true));
    expect(mode).toBe('normal_erase');
});
