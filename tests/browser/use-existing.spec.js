'use strict';
/**
 * "Use existing" Ink and Paper in the real app: the controls that set it, and
 * the promise that what a preview shows is what the commit leaves.
 *
 * The Node suites (use-existing-layers, draw-preview-parity, colour-state)
 * cover the rules; these are the parts only a browser has - the colour rail's
 * per-mode controls, and the preview canvas the artist actually looks at while
 * dragging a shape.
 */
const { test, expect } = require('@playwright/test');
const { boot, selectMode } = require('./helpers');

/** Screen coordinates of a canvas pixel. */
async function pixelPoint(page, px, py) {
    const box = await page.frameLocator('#canvas-frame').locator('#main-canvas').boundingBox();
    const dims = await page.evaluate(() => ({ w: ZX_SPECTRUM.WIDTH, h: ZX_SPECTRUM.HEIGHT }));
    return {
        x: box.x + (px + 0.5) * box.width / dims.w,
        y: box.y + (py + 0.5) * box.height / dims.h
    };
}

/*
 * ULAplus and ULANext have ink and paper per cell, so "use existing" means
 * exactly what it means in Standard ULA - but neither rail offered the boxes,
 * while the setting stayed in force underneath (2026-09-16). ULANext also
 * stores FLASH (it round-trips to Standard ULA), so that toggle has to be
 * reachable too.
 */
test('every mode with cell attributes offers the "use existing" boxes', async ({ page }) => {
    await boot(page);
    page.on('dialog', (d) => d.accept());

    for (const mode of ['standard_ula', 'multicolor_8x2', 'ula_plus', 'ulanext']) {
        await page.evaluate((m) => ScreenModeService.switchMode(m), mode);
        await page.waitForTimeout(150);
        const rail = await page.evaluate(() => ({
            ink: !!document.querySelector('#color-rail [data-role="transparent-ink"]'),
            paper: !!document.querySelector('#color-rail [data-role="transparent-paper"]'),
            hasAttributes: ColorManager.hasCellAttributes()
        }));
        expect(rail.hasAttributes, `${mode} has cell attributes`).toBe(true);
        expect(rail.ink, `${mode} offers the Ink box`).toBe(true);
        expect(rail.paper, `${mode} offers the Paper box`).toBe(true);

        // And the box actually sets the state it names.
        await page.click('#color-rail [data-role="transparent-ink"]');
        expect(await page.evaluate(() => ColorManager.isInkTransparent()),
            `${mode}: clicking the box turns it on`).toBe(true);
        await page.evaluate(() => ColorManager.setInkTransparent(false));
    }

    // ULANext: Flash is stored and must be settable; Bright is the bank choice.
    await page.evaluate(() => ScreenModeService.switchMode('ulanext'));
    await page.waitForTimeout(150);
    await expect(page.locator('#color-rail #flash-toggle')).toBeAttached();
});

/*
 * Where cells have no attributes there is nothing for "use existing" to keep,
 * so the rail offers no box and the preview well's double-click does nothing -
 * rather than a control that silently changes a setting no tool will read.
 */
test('modes without cell attributes offer no "use existing" at all', async ({ page }) => {
    await boot(page);
    page.on('dialog', (d) => d.accept());

    for (const mode of ['layer2_256', 'timex_hires']) {
        await page.evaluate((m) => ScreenModeService.switchMode(m), mode);
        await page.waitForTimeout(200);
        const state = await page.evaluate(() => ({
            box: !!document.querySelector('#color-rail [data-role="transparent-ink"]'),
            hasAttributes: ColorManager.hasCellAttributes(),
            reported: ColorManager.isInkTransparent()
        }));
        expect(state.hasAttributes, `${mode} has no cell attributes`).toBe(false);
        expect(state.box, `${mode} shows no box`).toBe(false);
        expect(state.reported, `${mode} reports the setting as off`).toBe(false);

        // Double-clicking the Ink well must not turn on a setting nothing reads
        await page.dblclick('#ink-color');
        expect(await page.evaluate(() => ColorManager.isInkTransparent()),
            `${mode}: the well does not toggle it`).toBe(false);
    }
});

/*
 * The eyedropper picks a whole cell. It used to announce the ink alone, so the
 * Bright and Flash toggles went on showing the state from before the pick.
 */
test('the eyedropper updates the Bright and Flash toggles it picked', async ({ page }) => {
    await boot(page);

    await page.evaluate(() => {
        const layer = LayerManager.getCurrentLayer();
        const cell = layer.getCell(4, 4);
        cell.pixels[0] = 0xFF;
        cell.ink = 2; cell.paper = 5; cell.bright = true; cell.flash = true;
        cell.altered = true;
        LayerManager.composeToCanvas();
        ColorManager.setBright(false);
        ColorManager.setFlash(false);
        ColorManager.setInkTransparent(true);
    });

    await page.keyboard.press('i');   // eyedropper
    const p = await pixelPoint(page, 4 * 8 + 2, 4 * 8 + 2);
    await page.mouse.click(p.x, p.y);

    expect(await page.evaluate(() => ({
        bright: document.getElementById('bright-toggle').checked,
        flash: document.getElementById('flash-toggle').checked,
        ink: ColorManager.getInk(),
        inkTransparent: ColorManager.isInkTransparent()
    }))).toEqual({ bright: true, flash: true, ink: 2, inkTransparent: false });
});

/*
 * The promise the whole change rests on: the shape preview the artist drags
 * out is the picture the commit leaves - here with Ink on "use existing" over
 * a coloured lower layer, where the preview used to paint the rail's ink.
 */
test('the shape preview is the same picture the commit leaves', async ({ page }) => {
    await boot(page);

    // A coloured lower layer, and a second layer to draw on.
    await page.evaluate(() => {
        const below = LayerManager.getCurrentLayer();
        const sel = { ink: 2, paper: 6, bright: false, flash: false,
            inkTransparent: false, paperTransparent: false };
        PixelDrawRoutine.beginBatch();
        for (let y = 60; y < 100; y++) {
            for (let x = 60; x < 120; x += 2) {
                PixelDrawRoutine.draw(x, y, sel, DRAW_MODE.NORMAL, { layer: below });
            }
        }
        PixelDrawRoutine.endBatch();
        LayerManager.addLayer('Layer 2');
        LayerManager.setCurrentLayer(LayerManager.layers.length - 1);
        ColorManager.setInk(7);
        ColorManager.setPaper(1);
        ColorManager.setInkTransparent(true);
        LayerManager.composeToCanvas();
    });

    await page.keyboard.press('r');   // rectangle

    const from = await pixelPoint(page, 70, 70);
    const to = await pixelPoint(page, 110, 90);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 5 });

    // The preview canvas, read back as RGBA over the dragged area
    const preview = await page.evaluate(() => {
        const cvs = CanvasSystem.getCanvasElement('composite-preview-canvas');
        const ctx = cvs.getContext('2d');
        return Array.from(ctx.getImageData(64, 64, 48, 24).data);
    });

    await page.mouse.up();
    await page.waitForTimeout(150);

    // The real canvas, same rectangle, after the commit
    const committed = await page.evaluate(() => {
        const cvs = CanvasSystem.getCanvasElement('main-canvas');
        const ctx = cvs.getContext('2d');
        return Array.from(ctx.getImageData(64, 64, 48, 24).data);
    });

    let differing = 0;
    for (let i = 0; i < committed.length; i += 4) {
        if (preview[i + 3] === 0) continue;            // preview did not cover it
        if (preview[i] !== committed[i] || preview[i + 1] !== committed[i + 1] ||
            preview[i + 2] !== committed[i + 2]) differing++;
    }
    expect(differing, 'every previewed pixel matches the committed canvas').toBe(0);

    // ...and "use existing" really did keep the ink showing below (2), not the
    // rail's own ink (7).
    expect(await page.evaluate(() =>
        LayerManager.getCurrentLayer().getCell(9, 9).ink)).toBe(2);
});
