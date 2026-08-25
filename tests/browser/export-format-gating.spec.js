'use strict';
/**
 * The Save dialogs offer only the formats the ACTIVE screen mode can
 * actually export (FormatRegistry.isExportCompatible(), backed by each
 * handler's own canExport()) — a ZX Spectrum standard screen shows no
 * Next/GigaScreen/Timex-only formats, and a GigaScreen document shows no
 * classic SCREEN$-family formats. Covers both Save entry points: the
 * native showSaveFilePicker (types filtered before the OS dialog opens —
 * showSaveFilePicker can't disable an option, only omit it, see
 * native-save.spec.js for the stub pattern) and the in-app Export with
 * Options... dropdown (incompatible <option>s omitted entirely, per the
 * design decision to match the native picker's hide-only behaviour).
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

/** Extensions offered by the native picker's `types` list. */
const capturedExtensions = (page) => page.evaluate(() => {
    return (window.__capturedTypes || []).map((t) => {
        const accepted = Object.values(t.accept)[0];
        return accepted[0].replace('.', '');
    });
});

const stubCapturingPicker = (page) => page.evaluate(() => {
    window.__capturedTypes = null;
    window.showSaveFilePicker = async (opts) => {
        window.__capturedTypes = opts.types;
        return {
            name: 'castle.scr',
            createWritable: async () => ({ write: async () => {}, close: async () => {} })
        };
    };
});

/** Extension values offered by the in-app Export dialog's <select>. */
const openExportDropdownOptions = async (page) => {
    await page.click('.menu-action[data-action="file:exportOptions"]');
    const dlg = page.locator('.dialog, dialog, [role="dialog"]').first();
    await expect(dlg).toBeVisible();
    const values = await page.locator('#export-format option').evaluateAll(
        (opts) => opts.map((o) => o.value));
    await page.keyboard.press('Escape');
    return values;
};

const openMenu = async (page, id) => {
    await page.click(`.menu-item[data-menu="${id}"] .menu-label`);
    await page.waitForSelector(`.menu-item[data-menu="${id}"] .menu-action`, { state: 'visible' });
};

test('native Save picker offers only formats the active mode can export',
    async ({ page }) => {
        await boot(page);
        await stubCapturingPicker(page);

        await page.evaluate(() => FileManager.exportViaNativePicker());
        const standardExts = await capturedExtensions(page);

        // standard_ula: classic SCREEN$-family formats, no Next/Giga/Timex-only ones
        expect(standardExts).toContain('scr');
        expect(standardExts).toContain('tap');
        expect(standardExts).toContain('png');
        expect(standardExts).not.toContain('nxi');
        expect(standardExts).not.toContain('sl2');
        expect(standardExts).not.toContain('img');
        expect(standardExts).not.toContain('hrg');
        expect(standardExts).not.toContain('ctile');
        expect(standardExts).not.toContain('pal');

        page.on('dialog', (d) => d.accept()); // classic->indexed/giga conversion warns
        await page.evaluate(() => ScreenModeService.switchMode('gigascreen'));
        await stubCapturingPicker(page);
        await page.evaluate(() => FileManager.exportViaNativePicker());
        const gigaExts = await capturedExtensions(page);

        // GigaScreen: .img is offered, the plain SCREEN$ .scr is not
        expect(gigaExts).toContain('img');
        expect(gigaExts).not.toContain('scr');
    });

test('the in-app Export dropdown hides formats the active mode cannot export',
    async ({ page }) => {
        await boot(page);
        await openMenu(page, 'file');
        const standardValues = await openExportDropdownOptions(page);

        expect(standardValues).toContain('scr');
        expect(standardValues).not.toContain('nxi');
        expect(standardValues).not.toContain('img');
        expect(standardValues).not.toContain('ctile');

        page.on('dialog', (d) => d.accept());
        await page.evaluate(() => ScreenModeService.switchMode('layer2_256'));
        await openMenu(page, 'file');
        const indexedValues = await openExportDropdownOptions(page);

        // Next indexed mode: nxi/sl2/slr offered, classic-only formats gone
        expect(indexedValues).toContain('nxi');
        expect(indexedValues).not.toContain('scr');
        expect(indexedValues).not.toContain('tap');
        expect(indexedValues).not.toContain('ctile');

        // Formats valid everywhere stay in every mode
        expect(standardValues).toContain('png');
        expect(indexedValues).toContain('png');
    });
