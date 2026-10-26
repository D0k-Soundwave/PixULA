'use strict';
/**
 * Batch 5 part 5B in a real browser: the stamp controls in the Transform panel (Colours, Show through, Clear dots,
 * Convert to pixels only). What each setting WRITES is pinned in Node (tests/stamp-placing.test.js); the rules for
 * what shows in every screen mode are pinned in tests/stamp-controls.test.js. Here: the controls are really there,
 * really wired, keep in step with undo, refuse what a coloured stamp cannot do, and survive a mode switch.
 */
const { test, expect } = require('@playwright/test');
const { boot, selectMode } = require('./helpers');

const visible = (page, sel) => page.evaluate((s) => {
    const el = document.querySelector(s);
    return !!el && !el.hidden && !el.closest('[hidden]') && el.offsetParent !== null;
}, sel);

/** A floating 8x8 stamp that carries one cell of colour (ink 1, paper 6, bright). */
async function floatColouredStamp(page, opts) {
    await page.evaluate((o) => {
        const mask = Array.from({ length: 8 }, (_, r) => Array.from({ length: 8 }, (_, c) => (r + c) % 3 === 0));
        SelectionService.startFloatingPasteFromMask(mask, 8, 8, 40, 40, 'ctl');
        const fp = SelectionService.floatingPaste;
        fp.attrs = [1 | (6 << 3) | 0x40];
        if (o) fp.opts = o;
        LayerManager.setCurrentLayer(fp.floatingLayer.index);
        CanvasSystem.requestRender();
    }, opts || null);
}

test('a plain stamp shows Clear dots only; a stamp with colours shows all four controls', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => {
        const mask = Array.from({ length: 8 }, () => new Array(8).fill(true));
        SelectionService.startFloatingPasteFromMask(mask, 8, 8, 0, 0, 'plain');
        CanvasSystem.requestRender();
    });
    expect(await visible(page, '#tp-clear-dots')).toBe(true);
    expect(await visible(page, '#tp-stamp-colours')).toBe(false);
    expect(await visible(page, '#tp-stamp-convert')).toBe(false);
    expect(await visible(page, '.tp-show-through-row')).toBe(false);

    await page.evaluate(() => SelectionService.cancelFloatingPaste());
    expect(await visible(page, '#tp-clear-dots'), 'no stamp, no controls').toBe(false);

    await floatColouredStamp(page);
    expect(await visible(page, '#tp-stamp-colours')).toBe(true);
    expect(await visible(page, '#tp-stamp-convert')).toBe(true);
    expect(await visible(page, '.tp-show-through-row')).toBe(true);
    expect(await page.inputValue('#tp-stamp-colours')).toBe('coloured');
});

test('the boxes follow the screen mode: ULAplus has one CLUT box, Timex hi-res no colours', async ({ page }) => {
    await boot(page);
    page.on('dialog', (d) => d.accept());
    await selectMode(page, 'ula_plus');
    await floatColouredStamp(page);
    expect(await visible(page, '#tp-st-clut')).toBe(true);
    expect(await visible(page, '#tp-st-bright')).toBe(false);
    expect(await visible(page, '#tp-st-flash')).toBe(false);

    await page.evaluate(() => SelectionService.cancelFloatingPaste());
    await selectMode(page, 'timex_hires');
    await floatColouredStamp(page);
    expect(await visible(page, '#tp-stamp-colours')).toBe(false);
    expect(await visible(page, '#tp-clear-dots')).toBe(true);
});

test('Own colours, Show through and Clear dots change what is placed; each is one undo step', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => {
        ColorManager.setInk(2); ColorManager.setPaper(5);
        ColorManager.setBright(false); ColorManager.setFlash(false);
        const c = LayerManager.getCurrentLayer().getCell(5, 5);
        Object.assign(c, { ink: 3, paper: 4, bright: false, flash: false, altered: true });
        c.pixels.fill(0xFF);
    });
    await floatColouredStamp(page, { colours: 'pixels' });
    // Pixels only: the rail colours.
    await page.selectOption('#tp-stamp-colours', 'coloured');
    expect(await page.evaluate(() => SelectionService.stampColoured(SelectionService.floatingPaste))).toBe(true);
    await page.check('#tp-st-paper');
    expect(await page.evaluate(() => SelectionService.floatingPaste.opts.showThrough.paper)).toBe(true);
    await page.selectOption('#tp-clear-dots', 'overlap');
    await page.evaluate(() => SelectionService.commitActiveStamp());
    const got = await page.evaluate(() => {
        const c = LayerManager.getCurrentLayer().getCell(5, 5);
        return { ink: c.ink, paper: c.paper, bright: c.bright, row0: c.pixels[0] };
    });
    // own ink 1 and bright; the page's paper (4) shows through; Clear background cleared the clear dots (row 0 = columns 0,3,6)
    expect(got).toEqual({ ink: 1, paper: 4, bright: true, row0: 0x92 });
});

test('undo and redo bring the controls back to the right values', async ({ page }) => {
    await boot(page);
    await floatColouredStamp(page);
    await page.selectOption('#tp-clear-dots', 'overlap');
    expect(await page.inputValue('#tp-clear-dots')).toBe('overlap');
    await page.evaluate(() => UndoRedo.undo());
    await page.evaluate(() => CanvasSystem.requestRender());
    expect(await page.inputValue('#tp-clear-dots')).toBe('transparent');
    await page.evaluate(() => UndoRedo.redo());
    await page.evaluate(() => CanvasSystem.requestRender());
    expect(await page.inputValue('#tp-clear-dots')).toBe('overlap');
});

test('Convert to pixels only drops the colours; a stamp with colours refuses XOR and reshaping, with reasons', async ({ page }) => {
    await boot(page);
    await floatColouredStamp(page);
    expect(await page.isDisabled('#tp-xor')).toBe(true);
    expect(await page.isDisabled('#tp-sx')).toBe(true);
    expect(await page.isDisabled('[data-tp-transform="flipH"]')).toBe(true);
    expect(await visible(page, '.tp-stamp-xor-ignored')).toBe(true);
    expect(await visible(page, '.tp-stamp-reshape-blocked')).toBe(true);

    await page.click('#tp-stamp-convert');
    expect(await page.evaluate(() => SelectionService.floatingPaste.attrs)).toBe(null);
    expect(await visible(page, '#tp-stamp-colours')).toBe(false);
    expect(await page.isDisabled('#tp-xor')).toBe(false);
    expect(await page.isDisabled('[data-tp-transform="flipH"]')).toBe(false);
    expect(await visible(page, '.tp-stamp-xor-ignored')).toBe(false);
});

test('the layer panel X button of a stamp with its own colours is marked ignored and does not toggle', async ({ page }) => {
    await boot(page);
    await floatColouredStamp(page);
    await page.evaluate(() => SelectionService.endFloatingPaste());
    const btn = page.locator('.stamp-xor').first();
    await expect(btn).toHaveClass(/is-ignored/);
    await btn.click({ force: true });
    expect(await page.evaluate(() => !!LayerManager.layers.find(l => l.isStamp).xorMode)).toBe(false);
});

test('a stamp picked up from the list survives a screen mode switch (it is parked, not deleted)', async ({ page }) => {
    await boot(page);
    page.on('dialog', (d) => d.accept());
    await floatColouredStamp(page);
    await page.evaluate(() => {
        SelectionService.endFloatingPaste();
        const l = LayerManager.layers.find(x => x.isStamp);
        SelectionService.startComponentReposition(l);
    });
    expect(await page.evaluate(() => SelectionService.isFloating())).toBe(true);
    await selectMode(page, 'ula_plus');
    expect(await page.evaluate(() => LayerManager.layers.some(l => l.isStamp && l.stamp))).toBe(true);
});

test('settings survive a save and reopen of the layers', async ({ page }) => {
    await boot(page);
    await floatColouredStamp(page);
    await page.selectOption('#tp-clear-dots', 'overlap');
    await page.check('#tp-st-ink');
    const back = await page.evaluate(() => {
        const data = JSON.parse(JSON.stringify(LayerManager.getAllLayers()));
        LayerManager.restoreFromData(data);
        const s = LayerManager.layers.find(l => l.isStamp);
        return s && s.stamp.opts;
    });
    expect(back.clearDots).toBe('overlap');
    expect(back.showThrough.ink).toBe(true);
});
