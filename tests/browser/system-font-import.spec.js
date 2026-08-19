'use strict';
/**
 * "From System Font..." (Font Editor > companion bridge, Phase 5 Task 15) —
 * the companion enumerates real OS fonts over GET /fonts, PixULA reads one
 * font's raw bytes over GET /fonts/{id}/file, and FontRasterizer turns it
 * into bitmap glyphs entirely client-side (no font rendering runs in the
 * companion itself). This spec drives the UI wiring end to end; a real font
 * file isn't practical to inline here, so FontRasterizer is stubbed —
 * FontRasterizer's own byte-level contract is covered by
 * tests/font-rasterizer.test.js (Node).
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

async function openFileDialog(page, action) {
    await page.click('.menu-item[data-menu="file"] .menu-label');
    await page.click(`.menu-action[data-action="${action}"]`);
}

test('From System Font row generates a usable bitmap font', async ({ page }) => {
    await boot(page);

    // Fake a paired companion offering one font family.
    await page.evaluate(() => {
        CompanionBridgeService.paired = true;
        CompanionBridgeService.token = 'faketoken';
        window.fetch = async (url) => {
            if (url.endsWith('/fonts')) {
                return { ok: true, json: async () => ([{ fontId: 'f1', family: 'Test Sans', style: 'Regular' }]) };
            }
            if (url.endsWith('/fonts/f1/file')) {
                // A real, tiny valid font isn't practical to inline here;
                // FontRasterizer's own contract is covered by its own Node
                // test. This spec only proves the UI wiring end to end.
                return { ok: true, arrayBuffer: async () => new ArrayBuffer(4) };
            }
            throw new Error('unexpected fetch: ' + url);
        };
        window.FontRasterizer = {
            rasterize: async () => Array.from({ length: 96 }, () => new Uint8Array(8))
        };
    });

    await openFileDialog(page, 'file:fontEditor');
    const dlg = page.locator('.dialog, dialog, [role="dialog"]').first();
    await expect(dlg).toBeVisible();

    await page.click('.font-editor-system-font-btn');
    await page.selectOption('.font-editor-system-font-select', 'f1');
    await page.click('.font-editor-system-font-generate');

    await expect(page.locator('.font-editor-status')).toContainText('Test Sans');
});

test('From System Font row asks to connect the companion when unpaired', async ({ page }) => {
    await boot(page);

    await openFileDialog(page, 'file:fontEditor');
    const dlg = page.locator('.dialog, dialog, [role="dialog"]').first();
    await expect(dlg).toBeVisible();

    await page.click('.font-editor-system-font-btn');
    await expect(page.locator('.font-editor-status')).toContainText(/companion/i);
    await expect(page.locator('.font-editor-system-font-select')).toHaveCount(0);
});
