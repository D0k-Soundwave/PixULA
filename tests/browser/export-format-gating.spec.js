'use strict';
/**
 * The Save paths offer only the formats the ACTIVE screen mode can actually
 * export (FormatRegistry.isExportCompatible(), backed by each handler's own
 * canExport()) — a ZX Spectrum standard screen shows no Next/GigaScreen/
 * Timex-only formats, and a GigaScreen document shows no classic
 * SCREEN$-family formats. Three surfaces gate on the same fact and are all
 * covered here: the native showSaveFilePicker (types filtered before the OS
 * dialog opens — showSaveFilePicker can't disable an option, only omit it,
 * see native-save.spec.js for the stub pattern), File > Save Image As's
 * per-format menu leaves (disabled rather than omitted — a static menu tree
 * can't be rebuilt per mode, see MenuSystem#_updateExportAsMenuState), and
 * _showExportDialog()'s format <select> (incompatible <option>s omitted
 * entirely) — the Save.../Ctrl+E fallback on engines with no native picker
 * (Firefox, Safari), reached only by direct call here since this suite runs
 * the installed Chrome, which always takes the native-picker branch instead.
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

/**
 * Extension values offered by _showExportDialog()'s <select>, invoked
 * directly — no menu path reaches it in this suite's browser (Chrome always
 * has showSaveFilePicker, so file:export never falls back to it; File >
 * Save Image As is a menu tree of leaves, not this dialog).
 */
const openExportDropdownOptions = async (page) => {
    await page.evaluate(() => MenuSystem._showExportDialog());
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

test('_showExportDialog()\'s fallback dropdown hides formats the active mode cannot export',
    async ({ page }) => {
        await boot(page);
        const standardValues = await openExportDropdownOptions(page);

        expect(standardValues).toContain('scr');
        expect(standardValues).not.toContain('nxi');
        expect(standardValues).not.toContain('img');
        expect(standardValues).not.toContain('ctile');
        expect(standardValues).not.toContain('gif'); // withdrawn from every export path

        page.on('dialog', (d) => d.accept());
        await page.evaluate(() => ScreenModeService.switchMode('layer2_256'));
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
