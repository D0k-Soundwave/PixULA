'use strict';
/**
 * "From System Font..." (Font Editor) — `queryLocalFonts()` enumerates real
 * OS fonts and hands back a `FontData` per face with a `.blob()` method for
 * its raw bytes; FontRasterizer turns those bytes into bitmap glyphs
 * entirely client-side.
 *
 * This is a deliberate, explicit click on a button whose only job is "get
 * me a real system font's bytes" - unlike the text tool's font-FAMILY list
 * (TextTool._enumerateFonts, always FontProbe.detect() since 2026-08-23;
 * see its own comment), which must never trigger a permission prompt on an
 * ordinary reload. `queryLocalFonts()`'s prompt here is the expected cost
 * of the action the artist just took, not a surprise.
 *
 * Most of this spec stubs FontRasterizer - deterministic, runs everywhere,
 * proves the UI wiring (queryLocalFonts calls, dialog state, error
 * handling) without depending on what happens to be installed. That stub
 * returning canned data regardless of input is exactly why it CANNOT catch
 * a wiring bug: a wrong offset, wrong glyph count, or a wrong point size
 * passed through would sail past every assertion here. The "with a real
 * font" block at the bottom closes that hole by never stubbing
 * FontRasterizer at all - the real algorithm runs through the real UI,
 * feeding a real installed font's bytes in over the same queryLocalFonts
 * mock used everywhere else in this file. FontRasterizer's own byte-level
 * contract (glyph count, Uint8Array(8) rows, letterform quality) is
 * tests/browser/font-rasterizer.spec.js's job, not this one's - this only
 * proves the Font Editor's OWN wiring hands the rasterizer real work and
 * writes what comes back into FontService.
 */
const fs = require('fs');
const { test, expect } = require('@playwright/test');
const { boot, findInstalledFont, FONT_CANDIDATES } = require('./helpers');

async function openFileDialog(page, action) {
    await page.click('.menu-item[data-menu="file"] .menu-label');
    await page.click(`.menu-action[data-action="${action}"]`);
}

/** A minimal fake FontData: {family, style, postscriptName, blob()}. */
function fakeFontData(family, style, postscriptName, bytes) {
    return { family, style, postscriptName,
        blob: async () => ({ arrayBuffer: async () => bytes }) };
}

test('From System Font row generates a usable bitmap font', async ({ page }) => {
    await boot(page);

    await page.evaluate(() => {
        window.queryLocalFonts = async () => ([
            { family: 'Test Sans', style: 'Regular', postscriptName: 'TestSans-Regular',
                blob: async () => ({ arrayBuffer: async () => new ArrayBuffer(4) }) }
        ]);
        window.FontRasterizer = {
            rasterize: async () => Array.from({ length: 96 }, () => new Uint8Array(8))
        };
    });

    await openFileDialog(page, 'file:fontEditor');
    const dlg = page.locator('.dialog, dialog, [role="dialog"]').first();
    await expect(dlg).toBeVisible();

    await page.click('.font-editor-system-font-btn');
    await page.selectOption('.font-editor-system-font-select', 'TestSans-Regular');
    await page.click('.font-editor-system-font-generate');

    await expect(page.locator('.font-editor-status')).toContainText('Test Sans');
});

test('a failed rasterization leaves the font width unchanged', async ({ page }) => {
    await boot(page);

    await page.evaluate(() => {
        window.queryLocalFonts = async () => ([
            { family: 'Broken Font', style: 'Regular', postscriptName: 'BrokenFont-Regular',
                blob: async () => ({ arrayBuffer: async () => new ArrayBuffer(4) }) }
        ]);
        window.FontRasterizer = {
            rasterize: async () => { throw new Error('could not parse font'); }
        };
    });

    await openFileDialog(page, 'file:fontEditor');
    const dlg = page.locator('.dialog, dialog, [role="dialog"]').first();
    await expect(dlg).toBeVisible();

    const widthBefore = await page.evaluate(() => FontService.width);

    await page.click('.font-editor-system-font-btn');
    await page.selectOption('.font-editor-system-font-select', 'BrokenFont-Regular');
    // Pick a width different from the current one - setWidth() crops glyphs
    // to the new width, so applying it ahead of a failed rasterize would
    // have left the font mismatched with nothing generated to match it.
    await page.selectOption('.font-editor-system-font-width', String(widthBefore === 6 ? 8 : 6));
    await page.click('.font-editor-system-font-generate');

    await expect(page.locator('.font-editor-status')).toContainText(/could not parse font/i);
    const widthAfter = await page.evaluate(() => FontService.width);
    expect(widthAfter).toBe(widthBefore);
});

test('From System Font row reports when this browser cannot list fonts', async ({ page }) => {
    await boot(page);

    await page.evaluate(() => { delete window.queryLocalFonts; });

    await openFileDialog(page, 'file:fontEditor');
    const dlg = page.locator('.dialog, dialog, [role="dialog"]').first();
    await expect(dlg).toBeVisible();

    await page.click('.font-editor-system-font-btn');
    await expect(page.locator('.font-editor-status')).toContainText(/cannot list installed fonts/i);
    await expect(page.locator('.font-editor-system-font-select')).toHaveCount(0);
});

test.describe('From System Font row, with a real font', () => {
    const FONT_PATH = findInstalledFont();
    test.skip(!FONT_PATH, `no installed TTF found (checked: ${FONT_CANDIDATES.join(', ')})`);

    test('the real rasterizer runs through the real UI and writes real glyphs', async ({ page }) => {
        await boot(page);
        const bytes = Array.from(fs.readFileSync(FONT_PATH));

        // FontRasterizer is deliberately left alone here - the point is to
        // exercise it for real, not to fake its output like every other
        // test in this file.
        await page.evaluate(({ bytes }) => {
            // The working font boots pre-seeded from the ZX ROM charset
            // (js/data/zx-rom-font.js), so 'A' already carries ink before
            // generation ever runs - clear it first, or a wiring bug that
            // never writes the real rasterized glyphs would pass this test
            // by leaving the OLD ink sitting there untouched.
            FontService.clearGlyph(65);

            window.queryLocalFonts = async () => ([
                { family: 'Real Font', style: 'Regular', postscriptName: 'RealFont-Regular',
                    blob: async () => ({ arrayBuffer: async () => new Uint8Array(bytes).buffer }) }
            ]);
        }, { bytes });

        await openFileDialog(page, 'file:fontEditor');
        const dlg = page.locator('.dialog, dialog, [role="dialog"]').first();
        await expect(dlg).toBeVisible();

        await page.click('.font-editor-system-font-btn');
        await page.selectOption('.font-editor-system-font-select', 'RealFont-Regular');
        await page.click('.font-editor-system-font-generate');

        await expect(page.locator('.font-editor-status')).toContainText('Real Font');

        const r = await page.evaluate(() => {
            const bitsOf = (g) => Array.from(g).reduce(
                (n, byte) => n + byte.toString(2).split('1').length - 1, 0);
            return {
                width: FontService.width,
                spaceIsBlank: bitsOf(FontService.getGlyph(32)) === 0,
                // 'A' (65): a wiring bug (wrong firstCode/offset, glyphs never
                // actually written to FontService) would leave this blank
                // even though the real rasterizer ran and produced ink for
                // SOMETHING - which a status-text-only assertion can't see.
                capitalABits: bitsOf(FontService.getGlyph(65))
            };
        });

        expect(r.width).toBe(8); // the picker's own default
        expect(r.spaceIsBlank).toBe(true);
        expect(r.capitalABits).toBeGreaterThan(0);
    });
});
