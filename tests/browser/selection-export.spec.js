'use strict';
/**
 * Batch 9 part 9B step 2 in a real browser: File > Save Selection As. The leaf for each format is open when its rule lets the
 * selection through; a PNG of a selection is a pixel-for-pixel crop of the full PNG; a cell format fits the selection and says
 * so. The per-format byte checks are in Node (tests/selection-export.test.js).
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

const leafDisabled = (page, ext) => page.evaluate((e) => document.querySelector(`[data-id="export-selection-${e}"]`).classList.contains('disabled'), ext);

async function openSubmenu(page) {
    await page.click('[data-menu="file"]');
    await page.hover('[data-id="export-selection"]');
}

test('leaves follow the rule: pictures open with any selection, scr only with the whole screen, all shut without one', async ({ page }) => {
    await boot(page);
    await openSubmenu(page);
    for (const ext of ['png', 'zxp', 'scr', 'asm']) expect(await leafDisabled(page, ext), ext + ' shut without a selection').toBe(true);
    await page.keyboard.press('Escape');

    await page.evaluate(() => SelectionService.setSelection({ x: 5, y: 9, width: 40, height: 30 }));
    await openSubmenu(page);
    for (const ext of ['png', 'bmp', 'jpg', 'zxp', 'sev', 'zed', 'asm', 'c', 'bin', 'atr']) expect(await leafDisabled(page, ext), ext).toBe(false);
    for (const ext of ['scr', 'tap', 'tzx']) expect(await leafDisabled(page, ext), ext + ' needs the whole screen').toBe(true);
    await page.keyboard.press('Escape');

    await page.evaluate(() => SelectionService.selectAll());
    await openSubmenu(page);
    for (const ext of ['scr', 'tap', 'tzx']) expect(await leafDisabled(page, ext), ext + ' open for the whole screen').toBe(false);
    await page.keyboard.press('Escape');
});

test('a PNG of a selection is a pixel-for-pixel crop of the full PNG', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => {
        PixelDrawRoutine.beginBatch('t');
        for (let i = 0; i < 60; i++) PixelDrawRoutine.draw(30 + i, 40 + (i % 17), ColorManager.getCurrentSelection(), DRAW_MODE.NORMAL);
        PixelDrawRoutine.endBatch();
    });
    const same = await page.evaluate(async () => {
        const decode = async (blob) => {
            const bmp = await createImageBitmap(blob);
            const c = document.createElement('canvas');
            c.width = bmp.width; c.height = bmp.height;
            const ctx = c.getContext('2d');
            ctx.drawImage(bmp, 0, 0);
            return ctx.getImageData(0, 0, bmp.width, bmp.height);
        };
        const full = await decode(await PNGFormat.export());
        const rect = { x: 25, y: 38, width: 77, height: 29 };
        const part = await decode(await PNGFormat.export({ rect }));
        if (part.width !== 77 || part.height !== 29) return 'size ' + part.width + 'x' + part.height;
        for (let y = 0; y < 29; y++) for (let x = 0; x < 77; x++) for (let k = 0; k < 4; k++) {
            if (part.data[(y * 77 + x) * 4 + k] !== full.data[((38 + y) * full.width + 25 + x) * 4 + k]) return 'differs at ' + x + ',' + y;
        }
        return 'same';
    });
    expect(same).toBe('same');
});

test('a cell format fits the selection to cells and says so; the file is that part', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => {
        window.__saved = [];
        const real = FormatRegistry.download.bind(FormatRegistry);
        FormatRegistry.download = async (data, name) => { window.__saved.push({ name, len: data.length }); return true; };
        window.__restore = () => { FormatRegistry.download = real; };
        SelectionService.setSelection({ x: 3, y: 5, width: 20, height: 11 });
    });
    await openSubmenu(page);
    await page.click('[data-id="export-selection-sev"]');
    await page.waitForTimeout(300);
    const sel = await page.evaluate(() => { const s = SelectionService.getSelection(); return [s.x, s.y, s.width, s.height]; });
    expect(sel).toEqual([0, 0, 24, 16]);
    const saved = await page.evaluate(() => window.__saved);
    expect(saved.length).toBe(1);
    expect(saved[0].name).toBe('image-selection.sev');
    expect(saved[0].len).toBe(14 + 3 * 2 * 9);
});
