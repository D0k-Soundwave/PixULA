'use strict';
/**
 * Selecting or toggling any control's active state must never resize that
 * control, #color-rail, or #color-bar — see the "Active-state addendum"
 * (S:7) in docs/superpowers/specs/2026-08-25-colour-rail-design.md.
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

const rectOf = (page, selector) => page.evaluate((s) => {
    const el = document.querySelector(s);
    const r = el.getBoundingClientRect();
    return { width: r.width, height: r.height };
}, selector);

const outerRectOf = (page, id) => page.evaluate((i) => {
    const r = document.getElementById(i).getBoundingClientRect();
    return { width: r.width, height: r.height };
}, id);

test('selecting an ink swatch does not resize the swatch, the rail, or the top strip', async ({ page }) => {
    await boot(page);
    const railBefore = await outerRectOf(page, 'color-rail');
    const barBefore = await outerRectOf(page, 'color-bar');
    const swatchBefore = await rectOf(page, '#clut-cluster [data-role="ink"][data-base="3"]');

    await page.click('#clut-cluster [data-role="ink"][data-base="3"]');

    const railAfter = await outerRectOf(page, 'color-rail');
    const barAfter = await outerRectOf(page, 'color-bar');
    const swatchAfter = await rectOf(page, '#clut-cluster [data-role="ink"][data-base="3"]');

    expect(railAfter).toEqual(railBefore);
    expect(barAfter).toEqual(barBefore);
    expect(swatchAfter).toEqual(swatchBefore);
});

test('switching ULAplus CLUT does not resize the rail', async ({ page }) => {
    await boot(page);
    page.on('dialog', (d) => d.accept());
    await page.evaluate(() => ScreenModeService.switchMode('ula_plus'));
    const before = await outerRectOf(page, 'color-rail');

    await page.click('#clut-selector .clut-select-btn:nth-child(2)');

    const after = await outerRectOf(page, 'color-rail');
    expect(after).toEqual(before);
});

test('clicking a draw mode does not retrigger ColorBarFit or resize the top strip', async ({ page }) => {
    await boot(page);
    const scaleBefore = await page.evaluate(() =>
        getComputedStyle(document.getElementById('color-bar'))
            .getPropertyValue('--colorbar-scale').trim());
    const barBefore = await outerRectOf(page, 'color-bar');
    const buttonBefore = await rectOf(page, '#draw-modes button[data-draw-mode="xor"]');

    await page.click('#draw-modes button[data-draw-mode="xor"]');

    const scaleAfter = await page.evaluate(() =>
        getComputedStyle(document.getElementById('color-bar'))
            .getPropertyValue('--colorbar-scale').trim());
    const barAfter = await outerRectOf(page, 'color-bar');
    const buttonAfter = await rectOf(page, '#draw-modes button[data-draw-mode="xor"]');

    expect(scaleAfter).toBe(scaleBefore);
    expect(barAfter).toEqual(barBefore);
    expect(buttonAfter).toEqual(buttonBefore);
});

test('toggling Mirror and engaging Swap/Recolour do not resize the top strip', async ({ page }) => {
    await boot(page);
    const barBefore = await outerRectOf(page, 'color-bar');

    await page.click('#symmetry-h-toggle');
    await page.click('#attr-transpose');

    const barAfter = await outerRectOf(page, 'color-bar');
    expect(barAfter).toEqual(barBefore);
});
