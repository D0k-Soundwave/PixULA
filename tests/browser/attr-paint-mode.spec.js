'use strict';
/**
 * Attribute paint mode (clut-bar Swap / Recolour) is STICKY: it is disarmed
 * only by a new draw method — a tool choice or a draw-mode change — or by
 * clicking its own button off. A layer change, Escape and transform actions
 * all leave it armed. Pattern capture stays transient and exits on all three.
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

const mode = (page) => page.evaluate(() => InputHandler._attrPaintMode);
const arm = (page, m) => page.evaluate((x) => InputHandler.enterAttrPaintMode(x), m);

test('attr mode STAYS armed through layer change, Escape and transform', async ({ page }) => {
    await boot(page);

    // Layer change
    await arm(page, 'apply');
    await page.evaluate(() => { LayerManager.addLayer(); LayerManager.setCurrentLayer(1); });
    expect(await mode(page), 'survives layer change').toBe('apply');

    // Escape (incl. its brush reset)
    await page.keyboard.press('Escape');
    expect(await mode(page), 'survives Escape').toBe('apply');
    expect(await page.evaluate(() => ToolManager.currentTool?.id), 'Escape still resets tool').toBe('brush');

    // Transform
    await page.evaluate(() => TransformPanel.applyTransform('flip-h'));
    expect(await mode(page), 'survives transform').toBe('apply');
});

test('attr mode EXITS on a new draw method or clicking the button off', async ({ page }) => {
    await boot(page);

    // Draw-mode change
    await arm(page, 'swap');
    await page.evaluate(() => StateManager.setDrawMode('xor'));
    expect(await mode(page), 'exits on draw-mode change').toBe(null);

    // Tool change
    await arm(page, 'swap');
    await page.evaluate(() => ToolManager.selectTool('line'));
    expect(await mode(page), 'exits on tool change').toBe(null);

    // Button toggles off
    await page.click('#attr-apply');
    expect(await mode(page), 'button arms').toBe('apply');
    await page.click('#attr-apply');
    expect(await mode(page), 'button disarms').toBe(null);

    // Other button switches mode
    await page.click('#attr-apply');
    await page.click('#attr-transpose');
    expect(await mode(page), 'other button switches').toBe('swap');
});

/**
 * Recolour with Ink and Paper both on "use existing" still writes Bright and
 * Flash - each as its own value. It used to write nothing at all, so there was
 * no way to brighten or flash an area without repainting its colours.
 */
test('Recolour sets Bright and Flash alone when Ink and Paper are transparent', async ({ page }) => {
    await boot(page);

    const box = await page.frameLocator('#canvas-frame').locator('#main-canvas').boundingBox();
    const dims = await page.evaluate(() => ({ w: ZX_SPECTRUM.WIDTH, h: ZX_SPECTRUM.HEIGHT }));
    const clickPixel = (px, py) => page.mouse.click(
        box.x + (px + 0.5) * box.width / dims.w,
        box.y + (py + 0.5) * box.height / dims.h);

    // Two cells with ink standing in them: one plain, one already flashing
    const seed = () => page.evaluate(() => {
        const layer = LayerManager.getCurrentLayer();
        for (const [cx, cy, flash] of [[5, 5, false], [6, 5, true]]) {
            const c = layer.getCell(cx, cy);
            c.pixels[0] = 0xF0;
            c.ink = 1; c.paper = 6; c.bright = false; c.flash = flash;
            c.altered = true;
        }
    });
    const cell = (cx, cy) => page.evaluate(([x, y]) => {
        const c = LayerManager.getCurrentLayer().getCell(x, y);
        return { ink: c.ink, paper: c.paper, bright: c.bright, flash: c.flash, row0: c.pixels[0] };
    }, [cx, cy]);
    await seed();

    await page.click('#color-rail [data-role="transparent-ink"]');
    await page.click('#color-rail [data-role="transparent-paper"]');
    await page.evaluate(() => { ColorManager.setBright(true); ColorManager.setFlash(false); });
    await page.click('#attr-apply');

    await clickPixel(5 * 8 + 3, 5 * 8 + 3);
    expect(await cell(5, 5), 'Bright on, Flash off: only bright changes')
        .toEqual({ ink: 1, paper: 6, bright: true, flash: false, row0: 0xF0 });

    await clickPixel(6 * 8 + 3, 5 * 8 + 3);
    expect(await cell(6, 5), 'a flashing cell takes Flash off as its own value')
        .toEqual({ ink: 1, paper: 6, bright: true, flash: false, row0: 0xF0 });

    await seed();
    await page.evaluate(() => { ColorManager.setBright(false); ColorManager.setFlash(true); });
    // Setting bright/flash rebuilds the rail but must not touch the transparent boxes
    expect(await page.evaluate(() => ColorManager.isInkTransparent() && ColorManager.isPaperTransparent()))
        .toBe(true);
    await clickPixel(5 * 8 + 3, 5 * 8 + 3);
    expect(await cell(5, 5), 'Bright off, Flash on: only flash changes')
        .toEqual({ ink: 1, paper: 6, bright: false, flash: true, row0: 0xF0 });
});

/**
 * What the artist hit straight after the test above: Recolour leaves both
 * transparent boxes on, and every brush stroke after it ignored the Bright and
 * Flash toggles, because the drawing modes only wrote them alongside a colour.
 */
test('after Recolour, the brush still applies Bright and Flash with both colours transparent', async ({ page }) => {
    await boot(page);

    const box = await page.frameLocator('#canvas-frame').locator('#main-canvas').boundingBox();
    const dims = await page.evaluate(() => ({ w: ZX_SPECTRUM.WIDTH, h: ZX_SPECTRUM.HEIGHT }));
    const at = (px, py) => ({
        x: box.x + (px + 0.5) * box.width / dims.w,
        y: box.y + (py + 0.5) * box.height / dims.h
    });

    // The Recolour set-up exactly as an artist does it
    await page.click('#color-rail [data-role="transparent-ink"]');
    await page.click('#color-rail [data-role="transparent-paper"]');
    await page.evaluate(() => { ColorManager.setBright(true); ColorManager.setFlash(true); });
    await page.click('#attr-apply');
    const r = at(60, 60);
    await page.mouse.click(r.x, r.y);

    // Back to the brush; the boxes are still on
    await page.keyboard.press('b');
    expect(await page.evaluate(() => [InputHandler._attrPaintMode,
        ColorManager.isInkTransparent(), ColorManager.isPaperTransparent()]))
        .toEqual([null, true, true]);

    const from = at(120, 150), to = at(140, 150);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 5 });
    await page.mouse.up();

    const cell = await page.evaluate(() => {
        const c = LayerManager.getCurrentLayer().getCell(Math.floor(130 / 8), Math.floor(150 / 8));
        return { inked: c.pixels.some((row) => row !== 0), bright: c.bright, flash: c.flash };
    });
    expect(cell, 'the stroke landed AND took Bright and Flash')
        .toEqual({ inked: true, bright: true, flash: true });
});

test('pattern capture still exits on layer change / Escape / transform', async ({ page }) => {
    await boot(page);
    const cap = () => page.evaluate(() => InputHandler._patternCaptureSize);

    await page.evaluate(() => InputHandler.enterPatternCaptureMode(16));
    expect(await cap()).toBe(16);
    await page.keyboard.press('Escape');
    expect(await cap(), 'pattern capture exits on Escape').toBe(0);

    await page.evaluate(() => InputHandler.enterPatternCaptureMode(16));
    await page.evaluate(() => { LayerManager.addLayer(); LayerManager.setCurrentLayer(1); });
    expect(await cap(), 'pattern capture exits on layer change').toBe(0);

    await page.evaluate(() => InputHandler.enterPatternCaptureMode(16));
    await page.evaluate(() => TransformPanel.applyTransform('flip-h'));
    expect(await cap(), 'pattern capture exits on transform').toBe(0);
});
