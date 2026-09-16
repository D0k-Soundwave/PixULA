'use strict';
/**
 * The draw-mode selector against the screen modes.
 *
 * Ink Recolour and Paper Recolour act on a cell's ink and paper attributes.
 * The indexed Next modes give every pixel its own palette index and Timex
 * hi-res shares one pair across the whole screen, so neither has those
 * attributes - and offered there, Ink Recolour did exactly what Normal did
 * while Paper Recolour painted the background index (2026-09-16). They are now
 * withdrawn in those modes, the way ClutBar already withdraws the Swap and
 * Recolour attribute ops, and a mode left standing in one of them falls back
 * to Normal rather than quietly meaning something else.
 *
 * The rules each mode follows once it is in force are pinned in Node, by
 * tests/draw-mode-matrix.test.js.
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

const state = (page) => page.evaluate(() => {
    const read = (mode) => {
        const btn = document.querySelector(`#draw-modes [data-draw-mode="${mode}"]`);
        if (!btn) return null;
        const style = getComputedStyle(btn);
        return {
            visible: style.visibility !== 'hidden',
            disabled: btn.disabled,
            // Hidden by visibility, so it must still occupy its space - the
            // strip's width (and so ColorBarFit's scale) must not depend on
            // the screen mode.
            width: Math.round(btn.getBoundingClientRect().width)
        };
    };
    return {
        normal: read('normal'), ink: read('ink'), paper: read('paper'),
        pixel_only: read('pixel_only'), xor: read('xor'), xor_pixel: read('xor_pixel'),
        active: StateManager.getDrawMode(),
        stripWidth: Math.round(document.getElementById('draw-modes').getBoundingClientRect().width)
    };
});

test('Ink and Paper Recolour are withdrawn where cells have no attributes', async ({ page }) => {
    await boot(page);
    page.on('dialog', (d) => d.accept());

    const classic = await state(page);
    for (const mode of ['normal', 'ink', 'paper', 'pixel_only', 'xor', 'xor_pixel']) {
        expect(classic[mode], `${mode} is offered in Standard ULA`)
            .toMatchObject({ visible: true, disabled: false });
    }

    // Stand in Ink Recolour, then move to a mode that has no cell attributes.
    await page.evaluate(() => StateManager.setDrawMode('ink'));
    await page.evaluate(() => ScreenModeService.switchMode('layer2_256'));
    await page.waitForTimeout(200);

    const indexed = await state(page);
    expect(indexed.ink, 'Ink Recolour is withdrawn in Layer 2')
        .toMatchObject({ visible: false, disabled: true });
    expect(indexed.paper, 'Paper Recolour is withdrawn in Layer 2')
        .toMatchObject({ visible: false, disabled: true });
    expect(indexed.active, 'and the mode the artist was standing in falls back to Normal')
        .toBe('normal');
    for (const mode of ['normal', 'pixel_only', 'xor', 'xor_pixel']) {
        expect(indexed[mode], `${mode} still means something in Layer 2`)
            .toMatchObject({ visible: true, disabled: false });
    }

    // The strip keeps its width, so the top bar's scale cannot jump on a mode
    // switch (the reason these are hidden by visibility, not removed).
    expect(indexed.stripWidth).toBe(classic.stripWidth);
    expect(indexed.ink.width).toBe(classic.ink.width);

    // Timex hi-res: the same, because it ignores cell attributes at render.
    await page.evaluate(() => ScreenModeService.switchMode('timex_hires'));
    await page.waitForTimeout(250);
    const hires = await state(page);
    expect(hires.ink).toMatchObject({ visible: false, disabled: true });
    expect(hires.paper).toMatchObject({ visible: false, disabled: true });

    // A mode arriving from somewhere that never touched the buttons - a
    // workspace preset, a restored session - follows the same rule.
    await page.evaluate(() => StateManager.setDrawMode('paper'));
    await page.waitForTimeout(100);
    expect(await page.evaluate(() => StateManager.getDrawMode()),
        'a preset cannot leave an unavailable mode standing').toBe('normal');

    // ...and they come back where they mean something again.
    await page.evaluate(() => ScreenModeService.switchMode('standard_ula'));
    await page.waitForTimeout(250);
    const back = await state(page);
    expect(back.ink).toMatchObject({ visible: true, disabled: false });
    expect(back.paper).toMatchObject({ visible: true, disabled: false });
});

/*
 * The status bar names any mode that is not Normal, because several of them
 * can leave a stroke with nothing visible and the choice survives a reload.
 */
test('a non-Normal draw mode says so in the status bar', async ({ page }) => {
    await boot(page);

    await expect(page.locator('#draw-mode-status')).toBeHidden();
    await page.click('#draw-modes [data-draw-mode="paper"]');
    await expect(page.locator('#draw-mode-status')).toBeVisible();
    await expect(page.locator('#draw-mode-status')).toContainText(/paper/i);
    await page.click('#draw-modes [data-draw-mode="normal"]');
    await expect(page.locator('#draw-mode-status')).toBeHidden();
});
