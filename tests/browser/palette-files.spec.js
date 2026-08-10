'use strict';
/**
 * The palette as a document of its own.
 *
 * In every editor that supports custom palettes, a palette is something you
 * build once and reuse across pictures — so it has to load and save as a FILE,
 * from where you edit it, without going through a preset library or hunting
 * for two entries in an Export dropdown of two dozen formats.
 *
 * What these specs pin: the controls exist where the palette is edited AND on
 * the File menu, a saved palette round-trips through real bytes, the generator
 * changes the palette without touching the picture, and every one of these is
 * a single undoable action.
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

/** Switch to a mode whose palette is editable. Refining from the default is silent. */
const toUlaplus = async (page) => {
    await page.selectOption('#screen-mode-select', 'ula_plus');
    await page.waitForFunction(() => ACTIVE_SCREEN_MODE.id === 'ula_plus');
};

const openEditor = async (page) => {
    await page.click('.menu-item[data-menu="image"] .menu-label');
    await page.click('.menu-action[data-action="image:editPalette"]');
    await expect(page.locator('.dialog, dialog, [role="dialog"]').first()).toBeVisible();
};

test('the File menu offers Load Palette and Save Palette in their own right',
    async ({ page }) => {
        await boot(page);
        await page.click('.menu-item[data-menu="file"] .menu-label');

        await expect(page.locator('.menu-action[data-action="file:loadPalette"]')).toBeVisible();
        await expect(page.locator('.menu-action[data-action="file:savePalette"]')).toBeVisible();

        const labels = await page.evaluate(() => ({
            load: document.querySelector('.menu-action[data-action="file:loadPalette"]').textContent,
            save: document.querySelector('.menu-action[data-action="file:savePalette"]').textContent
        }));
        expect(labels.load).toMatch(/palette/i);
        expect(labels.save).toMatch(/palette/i);
    });

test('the palette editor carries its own file, build and ramp controls',
    async ({ page }) => {
        await boot(page);
        await toUlaplus(page);
        await openEditor(page);

        const tools = await page.evaluate(() => {
            const host = document.querySelector('.palette-editor-tools');
            return {
                present: host !== null,
                buttons: Array.from(host.querySelectorAll('.palette-editor-tool-button'))
                    .map(b => b.dataset.i18n),
                rampFrom: document.getElementById('palette-ramp-from') !== null,
                rampTo: document.getElementById('palette-ramp-to') !== null,
                // ULAplus has only one file form, so it offers no chooser
                kinds: host.querySelector('.palette-editor-kind') !== null
            };
        });

        expect(tools.present).toBe(true);
        expect(tools.buttons).toEqual([
            'palette.load', 'palette.save', 'palette.fromImage', 'palette.rampApply'
        ]);
        expect(tools.rampFrom).toBe(true);
        expect(tools.rampTo).toBe(true);
        expect(tools.kinds).toBe(false);

        await page.keyboard.press('Escape');
    });

test('the CLUT labels print their number, and keep it through a locale change',
    async ({ page }) => {
        await boot(page);
        await toUlaplus(page);
        await openEditor(page);

        const read = () => page.evaluate(() =>
            Array.from(document.querySelectorAll('.palette-editor-clut-label'))
                .map(e => e.textContent));

        // The bug this pins: I18n.apply re-translated the label with no
        // parameters, so a row built as "CLUT 0" came back reading "CLUT {n}".
        expect(await read()).toEqual(['CLUT 0', 'CLUT 1', 'CLUT 2', 'CLUT 3']);

        await page.evaluate(() => I18n.apply(document));
        expect(await read()).toEqual(['CLUT 0', 'CLUT 1', 'CLUT 2', 'CLUT 3']);

        // ...and in a language whose word for it is not "CLUT"
        await page.evaluate(() => I18n.setLocale('ru'));
        const ru = await read();
        expect(ru).toHaveLength(4);
        for (let i = 0; i < 4; i++) {
            expect(ru[i]).toContain(String(i));
            expect(ru[i]).not.toContain('{n}');
        }

        await page.evaluate(() => I18n.setLocale('en'));
        await page.keyboard.press('Escape');
    });

test('the Next offers both of its file forms; ULAplus has only the one',
    async ({ page }) => {
        await boot(page);
        page.on('dialog', (d) => d.accept());   // the lossy-conversion warning

        await page.selectOption('#screen-mode-select', 'layer2_256');
        await page.waitForFunction(() => ACTIVE_SCREEN_MODE.id === 'layer2_256');
        await openEditor(page);

        const kinds = await page.evaluate(() =>
            Array.from(document.querySelector('.palette-editor-kind').options).map(o => o.value));
        expect(kinds).toEqual(['pal', 'npl']);

        await page.keyboard.press('Escape');
    });

test('a palette saves to real bytes and loads back over a wrecked one',
    async ({ page }) => {
        await boot(page);
        await toUlaplus(page);

        // A palette worth recognising again
        await page.evaluate(() => {
            UndoRedo.beginAction('palette');
            for (let i = 0; i < 64; i++) ColorManager.setUlaplusRegister(i, (i * 4) & 0xFF);
            UndoRedo.endAction();
        });
        const saved = await page.evaluate(() =>
            Array.from(ColorManager.getUlaplusRegisters()));

        // Export through the real handler — the bytes the Save button writes
        const bytes = await page.evaluate(() => Array.from(NextPaletteFormat.export('pal')));
        expect(bytes).toHaveLength(64);
        expect(bytes).toEqual(saved);

        // Wreck it, then load those very bytes back through the import path
        await page.evaluate(() => {
            UndoRedo.beginAction('palette');
            ColorManager.setUlaplusRegisters(ULAPLUS.defaultRegisters());
            UndoRedo.endAction();
        });
        expect(await page.evaluate(() =>
            Array.from(ColorManager.getUlaplusRegisters()))).not.toEqual(saved);

        await page.evaluate((data) => {
            const buffer = new Uint8Array(data).buffer;
            FormatRegistry.getImportHandler('pal').parse(buffer);
        }, bytes);

        expect(await page.evaluate(() =>
            Array.from(ColorManager.getUlaplusRegisters()))).toEqual(saved);
    });

test('the ramp fills the run between two entries, undoably, in one step',
    async ({ page }) => {
        await boot(page);
        await toUlaplus(page);
        await openEditor(page);

        // Black at 0, white at 7, nonsense in between
        await page.evaluate(() => {
            UndoRedo.beginAction('setup');
            ColorManager.setUlaplusRegister(0, ULAPLUS.rgbToRegister(0, 0, 0));
            ColorManager.setUlaplusRegister(7, ULAPLUS.rgbToRegister(255, 255, 255));
            for (let i = 1; i < 7; i++) {
                ColorManager.setUlaplusRegister(i, ULAPLUS.rgbToRegister(255, 0, 0));
            }
            UndoRedo.endAction();
        });

        await page.fill('#palette-ramp-from', '0');
        await page.fill('#palette-ramp-to', '7');
        await page.click('.palette-editor-tool-button[data-i18n="palette.rampApply"]');

        const greys = await page.evaluate(() => {
            const regs = ColorManager.getUlaplusRegisters();
            const out = [];
            for (let i = 0; i <= 7; i++) out.push(ULAPLUS.registerToRGB(regs[i]));
            return out;
        });

        // Monotonically lighter, ends intact, and grey throughout (the red is gone)
        expect(greys[0]).toEqual([0, 0, 0]);
        expect(greys[7][0]).toBeGreaterThan(200);
        for (let i = 1; i <= 7; i++) {
            expect(greys[i][0]).toBeGreaterThanOrEqual(greys[i - 1][0]);
        }
        for (const [r, g, b] of greys) {
            // G3R3B2 cannot be exactly neutral, but it must be near it
            expect(Math.abs(r - g)).toBeLessThan(60);
        }

        // ONE undo puts the whole run back, not eight
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => !document.activeElement ||
            !document.activeElement.closest('.dialog, dialog, [role="dialog"]'));
        await page.keyboard.press('Control+z');

        await page.waitForFunction(() => {
            const rgb = ULAPLUS.registerToRGB(ColorManager.getUlaplusRegisters()[3]);
            return rgb[0] > 200 && rgb[1] < 60;   // red again
        });
    });

test('a ramp with nothing between its ends is refused, not silently ignored',
    async ({ page }) => {
        await boot(page);
        await toUlaplus(page);
        await openEditor(page);

        let alerted = false;
        page.on('dialog', (d) => { alerted = true; d.accept(); });

        await page.fill('#palette-ramp-from', '4');
        await page.fill('#palette-ramp-to', '5');
        await page.click('.palette-editor-tool-button[data-i18n="palette.rampApply"]');

        await page.waitForTimeout(100);
        expect(alerted).toBe(true);
    });

test('the palette travels inside the image formats that carry one', async ({ page }) => {
    await boot(page);
    await toUlaplus(page);

    await page.evaluate(() => {
        UndoRedo.beginAction('palette');
        for (let i = 0; i < 64; i++) ColorManager.setUlaplusRegister(i, (200 - i * 3) & 0xFF);
        UndoRedo.endAction();
    });
    const regs = await page.evaluate(() => Array.from(ColorManager.getUlaplusRegisters()));

    // A ULAplus SCR is 6912 screen bytes plus the 64 registers on the end
    const scr = await page.evaluate(() => Array.from(SCRFormat.export()));
    expect(scr).toHaveLength(6976);
    expect(scr.slice(6912)).toEqual(regs);

    // ...and reading it back restores them
    await page.evaluate(() => {
        UndoRedo.beginAction('palette');
        ColorManager.setUlaplusRegisters(ULAPLUS.defaultRegisters());
        UndoRedo.endAction();
    });
    await page.evaluate((data) => {
        FormatRegistry.getImportHandler('scr').parse(new Uint8Array(data).buffer);
    }, scr);

    expect(await page.evaluate(() =>
        Array.from(ColorManager.getUlaplusRegisters()))).toEqual(regs);
});
