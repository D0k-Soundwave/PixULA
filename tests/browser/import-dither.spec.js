'use strict';
/**
 * Batch 8 part 8B in a real browser: the Import dialog's Dither select. It drives the Smooth conversion only, redraws
 * the Smooth pane, and is shut with a reason in the indexed modes (which keep their own colour dither).
 */
const { test, expect } = require('@playwright/test');
const { boot, selectMode } = require('./helpers');

async function openImport(page) {
    await page.evaluate(async () => {
        const c = document.createElement('canvas');
        c.width = 256; c.height = 192;
        const ctx = c.getContext('2d');
        const g = ctx.createLinearGradient(0, 0, 256, 0);
        g.addColorStop(0, '#202020'); g.addColorStop(1, '#e0e0e0');
        ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 192);
        const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
        FileManager.loadFile(new File([blob], 'ramp.png', { type: 'image/png' }));
    });
    const dlg = page.locator('.dialog, dialog, [role="dialog"]').first();
    await expect(dlg).toBeVisible({ timeout: 10000 });
    return dlg;
}
const paneHash = (dlg) => dlg.locator('.import-method[data-method="smooth"] canvas').evaluate((c) => {
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let h = 0;
    for (let i = 0; i < d.length; i += 4) h = (h * 31 + d[i] + d[i + 1] * 3 + d[i + 2] * 7) >>> 0;
    return h;
});

test('the Dither select lists 31 methods and redraws the Smooth pane', async ({ page }) => {
    await boot(page);
    const dlg = await openImport(page);
    const sel = dlg.locator('#import-dither');
    await expect(sel).toBeVisible();
    expect(await sel.locator('option').count()).toBe(31);
    expect(await sel.inputValue()).toBe('floyd-steinberg');
    await page.waitForTimeout(400);
    const before = await paneHash(dlg);
    await sel.selectOption('bayer-8');
    await page.waitForTimeout(400);
    const after = await paneHash(dlg);
    expect(after, 'the Smooth pane changed').not.toBe(before);
    // Changed on purpose (owner, 2026-10-12: the method drives Sharp too): choosing a method no longer jumps to Smooth; it stays on the
    // chosen conversion unless that is Flat, which does not dither.
    await expect(dlg.locator('.import-method[data-method="sharp"]')).toHaveClass(/active/);
    await page.keyboard.press('Escape');
});

const paneHashOf = (dlg, id) => dlg.locator(`.import-method[data-method="${id}"] canvas`).evaluate((c) => {
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let h = 0;
    for (let i = 0; i < d.length; i += 4) h = (h * 31 + d[i] + d[i + 1] * 3 + d[i + 2] * 7) >>> 0;
    return h;
});

test('the Dither method drives Sharp too, once one is chosen; Flat never changes', async ({ page }) => {
    await boot(page);
    const dlg = await openImport(page);
    await page.waitForTimeout(500);
    const sharp0 = await paneHashOf(dlg, 'sharp'), flat0 = await paneHashOf(dlg, 'flat');
    await dlg.locator('.import-method[data-method="sharp"]').click();
    await dlg.locator('#import-dither').selectOption('bayer-8');
    await page.waitForTimeout(700);
    expect(await paneHashOf(dlg, 'sharp'), 'the Sharp pane follows the method').not.toBe(sharp0);
    expect(await paneHashOf(dlg, 'flat'), 'Flat does not dither').toBe(flat0);
    await expect(dlg.locator('.import-method[data-method="sharp"]'), 'choosing a method keeps Sharp chosen').toHaveClass(/active/);
    await page.keyboard.press('Escape');
});

test('OK imports with the chosen method (Smooth picture equals the pane)', async ({ page }) => {
    await boot(page);
    const dlg = await openImport(page);
    await dlg.locator('#import-dither').selectOption('threshold-50');
    await page.waitForTimeout(500);
    const dots = async () => page.evaluate(() => {
        const layer = LayerManager.getCurrentLayer();
        let n = 0;
        for (let cy = 0; cy < ZX_SPECTRUM.GRID_ROWS; cy++) for (let cx = 0; cx < ZX_SPECTRUM.GRID_COLS; cx++) {
            const c = layer.getCell(cx, cy);
            if (c && c.altered) for (const r of c.pixels) { let b = r; while (b) { n += b & 1; b >>= 1; } }
        }
        return n;
    });
    await dlg.getByRole('button', { name: /^OK$/ }).click();
    await page.waitForTimeout(800);
    expect(await dots(), 'something was imported').toBeGreaterThan(1000);
});

// REWRITTEN on purpose (owner, 2026-10-12): the indexed modes used to shut the select ("keeps its own colour dither"); all 31 methods now work there.
for (const mode of ['layer2_256', 'lores']) {
    test(`in ${mode} the Dither select works: the pane follows the method and OK imports it`, async ({ page }) => {
        await boot(page);
        page.on('dialog', (d) => d.accept());
        await selectMode(page, mode);
        expect(await page.evaluate(() => ZX_SPECTRUM.PIXEL_DEPTH)).toBeGreaterThan(1);
        const dlg = await openImport(page);
        await expect(dlg.locator('#import-dither')).toBeEnabled();
        await page.waitForTimeout(600);
        const before = await paneHashOf(dlg, 'smooth');
        await dlg.locator('#import-dither').selectOption('bayer-8');
        await page.waitForTimeout(900);
        expect(await paneHashOf(dlg, 'smooth'), 'the Smooth pane changed').not.toBe(before);
        await dlg.getByRole('button', { name: /^OK$/ }).click();
        await page.waitForTimeout(1500);
        const used = await page.evaluate(() => {
            const layer = LayerManager.getCurrentLayer();
            const seen = new Set();
            for (let y = 0; y < ZX_SPECTRUM.HEIGHT; y += 3) for (let x = 0; x < ZX_SPECTRUM.WIDTH; x += 3) seen.add(layer.getPixelIndex(x, y));
            return seen.size;
        });
        expect(used, 'a picture with several colours was imported').toBeGreaterThan(1);
    });
}
