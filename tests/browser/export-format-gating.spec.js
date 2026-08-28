'use strict';
/**
 * File > Save Image As offers only the formats the ACTIVE screen mode can
 * actually export (FormatRegistry.isExportCompatible(), backed by each
 * handler's own canExport()) — a ZX Spectrum standard screen shows no
 * Next/GigaScreen/Timex-only formats greyed in, and a GigaScreen document
 * shows no classic SCREEN$-family formats enabled. This is the ONE
 * save-format surface in the app (2026-08-28) — the separate File >
 * Save.../Ctrl+E action (a native showSaveFilePicker with a multi-format
 * "Save as type" list on Chromium, an in-app dropdown fallback on
 * Firefox/Safari) was withdrawn so the menu looks and behaves the same on
 * every browser; see js/ui/menu-system.js's EXPORT_FORMATS comment.
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

const openMenu = async (page, id) => {
    await page.click(`.menu-item[data-menu="${id}"] .menu-label`);
    await page.waitForSelector(`.menu-item[data-menu="${id}"] .menu-action`, { state: 'visible' });
};

test('File > Save Image As enables exactly the formats FormatRegistry.isExportCompatible allows, in every screen mode',
    async ({ page }) => {
        // Exhaustive, not a spot check: every SCREEN_MODES id x every
        // EXPORT_FORMATS extension, so a format wired to the wrong gate (or a
        // new mode/format added without wiring _updateExportAsMenuState) fails
        // the build here instead of quietly letting an incompatible export
        // through the menu, or hiding a compatible one.
        await boot(page);
        page.on('dialog', (d) => d.accept()); // lossy mode-switch confirms

        const modes = await page.evaluate(() => ScreenModeService.getModes().map((m) => m.id));
        const mismatches = [];

        for (const mode of modes) {
            await page.evaluate((m) => ScreenModeService.switchMode(m), mode);
            await openMenu(page, 'file');
            await page.click('.menu-action--parent[data-id="export-as"]');
            await page.waitForSelector('#menu-export-as.visible', { state: 'visible' });

            const perExt = await page.evaluate(() => {
                const out = {};
                document.querySelectorAll('#menu-export-as > .menu-action').forEach((el) => {
                    const ext = el.dataset.id.replace('export-as-', '');
                    out[ext] = {
                        menuEnabled: !el.classList.contains('disabled'),
                        registryCompatible: FormatRegistry.isExportCompatible(ext)
                    };
                });
                return out;
            });
            await page.keyboard.press('Escape');

            for (const [ext, { menuEnabled, registryCompatible }] of Object.entries(perExt)) {
                if (menuEnabled !== registryCompatible) {
                    mismatches.push(`${mode} / ${ext}: menu says ${menuEnabled}, registry says ${registryCompatible}`);
                }
            }
        }

        expect(mismatches, mismatches.join('\n')).toEqual([]);
    });

test('File > Save Image As never lists a gif leaf', async ({ page }) => {
    await boot(page);
    await openMenu(page, 'file');
    await page.click('.menu-action--parent[data-id="export-as"]');
    await page.waitForSelector('#menu-export-as.visible', { state: 'visible' });

    const hasGif = await page.evaluate(() =>
        !!document.querySelector('#menu-export-as [data-id="export-as-gif"]'));
    await page.keyboard.press('Escape');

    expect(hasGif).toBe(false);
});
