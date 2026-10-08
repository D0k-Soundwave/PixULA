'use strict';
/**
 * Bright and Flash "use existing" in the colour rail (2026-10-08): a
 * checkered box under each toggle, the same box Ink and Paper carry; one box
 * for the CLUT in ULAplus, where the two bits ARE the CLUT; nothing where cells
 * have no attributes. Shift+B, Shift+F and Shift+T are the keyboard side (ZX
 * Paintbrush's B, F and T). What a stroke does with the setting is pinned in
 * Node by tests/bright-flash-keep.test.js.
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

const rail = (page) => page.evaluate(() => {
    const q = (role) => document.querySelectorAll(`#color-rail [data-role="${role}"]`).length;
    const kept = (sel) => {
        const el = document.querySelector(sel);
        return el ? el.classList.contains('is-kept') : null;
    };
    return {
        bright: q('keep-bright'), flash: q('keep-flash'), clut: q('keep-clut'),
        brightKept: ColorManager.isBrightTransparent(),
        flashKept: ColorManager.isFlashTransparent(),
        brightToggleDimmed: kept('#color-rail .flash-btn:has(#bright-toggle)'),
        overflow: (() => {
            const c = document.getElementById('color-rail-content');
            return c ? c.scrollWidth > c.clientWidth + 1 : false;
        })()
    };
});

test('each screen mode shows the keep boxes it can use, and no others', async ({ page }) => {
    await boot(page);
    page.on('dialog', (d) => d.accept());

    let r = await rail(page);
    expect(r, 'Standard: one box under Bright, one under Flash').toMatchObject({ bright: 1, flash: 1, clut: 0 });
    expect(r.overflow, 'the boxes add height, never width').toBe(false);

    for (const [mode, want] of [
        ['gigascreen', { bright: 1, flash: 1, clut: 0 }],   // one Bright box covers both screens
        ['ulanext', { bright: 1, flash: 1, clut: 0 }],
        ['ula_plus', { bright: 0, flash: 0, clut: 1 }],     // the two bits are the CLUT
        ['timex_hires', { bright: 0, flash: 0, clut: 0 }],
        ['layer2_256', { bright: 0, flash: 0, clut: 0 }]
    ]) {
        await page.evaluate((m) => ScreenModeService.switchMode(m), mode);
        await page.waitForTimeout(200);
        r = await rail(page);
        expect(r, mode).toMatchObject(want);
        expect(r.overflow, `${mode}: no horizontal overflow`).toBe(false);
    }
});

test('a box turns its keep on and off, and picking a value turns it off', async ({ page }) => {
    await boot(page);

    await page.click('#color-rail [data-role="keep-bright"]');
    let r = await rail(page);
    expect(r.brightKept).toBe(true);
    expect(r.brightToggleDimmed, 'Bright is drawn as not in force').toBe(true);
    expect(await page.getAttribute('#color-rail [data-role="keep-bright"]', 'aria-checked')).toBe('true');

    await page.click('#color-rail [data-role="keep-bright"]');
    expect((await rail(page)).brightKept, 'a second click turns it off').toBe(false);

    await page.click('#color-rail [data-role="keep-flash"]');
    expect((await rail(page)).flashKept).toBe(true);
    await page.click('#color-rail .flash-btn:has(#flash-toggle)');
    r = await rail(page);
    expect(r.flashKept, 'clicking Flash sets a value and turns its box off').toBe(false);
});

test('ULAplus: one box keeps the CLUT; picking a CLUT turns it off', async ({ page }) => {
    await boot(page);
    page.on('dialog', (d) => d.accept());
    await page.evaluate(() => ScreenModeService.switchMode('ula_plus'));
    await page.waitForTimeout(200);

    await page.click('#color-rail [data-role="keep-clut"]');
    let r = await rail(page);
    expect(r.brightKept && r.flashKept, 'both bits kept').toBe(true);
    expect(await page.evaluate(() =>
        document.getElementById('clut-selector').classList.contains('is-kept'))).toBe(true);

    await page.click('#clut-selector .clut-select-btn >> nth=2');
    r = await rail(page);
    expect(r.brightKept || r.flashKept, 'picking a CLUT writes it again').toBe(false);
});

test('Shift+B, Shift+F and Shift+T', async ({ page }) => {
    await boot(page);
    await page.locator('#canvas-area').focus();
    const state = () => page.evaluate(() => ({
        bright: ColorManager.getBright(), flash: ColorManager.getFlash(),
        tool: ToolManager.currentTool && ToolManager.currentTool.id,
        kept: [ColorManager.isInkTransparent(), ColorManager.isPaperTransparent(),
            ColorManager.isBrightTransparent(), ColorManager.isFlashTransparent()]
    }));
    const before = await state();

    await page.keyboard.press('Shift+B');
    let s = await state();
    expect(s.bright, 'Shift+B toggles Bright').toBe(!before.bright);
    expect(s.tool, 'and does not pick the Brush').toBe(before.tool);

    await page.keyboard.press('Shift+F');
    s = await state();
    expect(s.flash, 'Shift+F toggles Flash').toBe(!before.flash);
    expect(s.tool, 'and does not pick Fade').toBe(before.tool);

    await page.keyboard.press('Shift+T');
    s = await state();
    expect(s.kept, 'Shift+T puts all four on use existing').toEqual([true, true, true, true]);
    expect(s.tool, 'and does not pick Text').toBe(before.tool);

    await page.keyboard.press('Shift+B');
    s = await state();
    expect(s.kept[2], 'toggling Bright again writes a value, so its keep goes').toBe(false);
});
