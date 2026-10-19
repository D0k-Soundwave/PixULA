'use strict';
/**
 * The Attributes Only draw mode (owner decision 2026-10-19): the third
 * attribute-only button, next to Ink Recolour and Paper Recolour. Every drawing
 * tool gives each cell it touches Ink, Paper, Bright and Flash and draws no
 * pixel. The per-tool rules are pinned in Node (tests/attributes-draw-mode.test.js);
 * this is the button, the canvas, the status bar, Mirror, persistence and the
 * screen modes it is withdrawn from.
 */
const { test, expect } = require('@playwright/test');
const { boot, reload, pickDrawMode } = require('./helpers');

async function offered(page) {
    await page.click('#draw-mode-select');
    const ids = await page.$$eval('.strip-popup .tool-btn', (els) => els.map((e) => e.dataset.drawMode));
    await page.keyboard.press('Escape');
    return ids;
}

/** Seed cells (4..8, 5) with a pixel stripe and attributes unlike the rail's; set the rail. */
const seed = (page) => page.evaluate(() => {
    const layer = LayerManager.getCurrentLayer();
    for (let cx = 0; cx < ZX_SPECTRUM.GRID_COLS; cx++) {
        const c = layer.getCell(cx, 5);
        for (let r = 0; r < 8; r++) c.pixels[r] = (r & 1) ? 0x0F : 0xC3;
        c.ink = 2; c.paper = 6; c.bright = false; c.flash = false; c.altered = true;
    }
    ColorManager.setInk(3); ColorManager.setPaper(4);
    ColorManager.setBright(true); ColorManager.setFlash(true);
    for (const k of ['Ink', 'Paper', 'Bright', 'Flash']) ColorManager['set' + k + 'Transparent'](false);
    EventBus.emit(EVENTS.CANVAS_RENDER);
});
const cellState = (page, cx, cy) => page.evaluate(([x, y]) => {
    const c = LayerManager.getCurrentLayer().getCell(x, y);
    return { ink: c.ink, paper: c.paper, bright: c.bright, flash: c.flash, pixels: Array.from(c.pixels) };
}, [cx, cy]);
const STRIPE = [0xC3, 0x0F, 0xC3, 0x0F, 0xC3, 0x0F, 0xC3, 0x0F];

async function pixelClicker(page) {
    const box = await page.frameLocator('#canvas-frame').locator('#main-canvas').boundingBox();
    const dims = await page.evaluate(() => ({ w: ZX_SPECTRUM.WIDTH, h: ZX_SPECTRUM.HEIGHT }));
    return (px, py, button = 'left') => page.mouse.click(
        box.x + (px + 0.5) * box.width / dims.w,
        box.y + (py + 0.5) * box.height / dims.h, { button });
}

test('Attributes Only is offered after Paper Recolour, with its name and tooltip', async ({ page }) => {
    await boot(page);
    expect(await offered(page)).toEqual(['normal', 'pixel_only', 'xor', 'xor_pixel', 'ink', 'paper', 'attributes']);
    await page.click('#draw-mode-select');
    const item = page.locator('.strip-popup #draw-mode-attributes');
    await expect(item).toHaveAttribute('aria-label', 'Attributes Only');
    expect(await item.getAttribute('title')).toContain('Ink, Paper, Bright and Flash');
    await page.keyboard.press('Escape');
});

test('both buttons give the cell all four attributes and draw no pixel', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => { ToolManager.selectTool(TOOLS.BRUSH); BrushEngine.setBrush('round'); BrushEngine.setSize(1); });
    await seed(page);
    await pickDrawMode(page, 'attributes');
    expect(await page.evaluate(() => StateManager.getDrawMode())).toBe('attributes');
    const click = await pixelClicker(page);

    await click(4 * 8 + 3, 5 * 8 + 3);
    let c = await cellState(page, 4, 5);
    expect(c.pixels, 'left button: the pixels are as they were').toEqual(STRIPE);
    expect([c.ink, c.paper, c.bright, c.flash], 'left button: all four attributes').toEqual([3, 4, true, true]);

    await click(6 * 8 + 3, 5 * 8 + 3, 'right');
    c = await cellState(page, 6, 5);
    expect(c.pixels, 'right button: the pixels are as they were').toEqual(STRIPE);
    expect([c.ink, c.paper, c.bright, c.flash], 'right button: the same job').toEqual([3, 4, true, true]);

    const untouched = await cellState(page, 5, 5);
    expect([untouched.ink, untouched.paper], 'a cell the brush did not reach keeps its own').toEqual([2, 6]);

    // Paper on "use existing": Ink Recolour's result.
    await page.evaluate(() => ColorManager.setPaperTransparent(true));
    await click(8 * 8 + 3, 5 * 8 + 3);
    c = await cellState(page, 8, 5);
    expect([c.ink, c.paper, c.bright, c.flash], 'Paper kept: ink, bright and flash only').toEqual([3, 6, true, true]);
});

test('the status bar names it, and says Inverse changes nothing in it', async ({ page }) => {
    await boot(page);
    const status = page.locator('#draw-mode-status');
    await pickDrawMode(page, 'attributes');
    await expect(status).toBeVisible();
    await expect(status).toHaveText('Draw Mode: Attributes Only');
    await page.evaluate(() => StateManager.setInverse(true));
    await expect(status).toHaveText('Draw Mode: Attributes Only, Inverse is on (it changes nothing in this draw mode)');
    await page.evaluate(() => StateManager.setInverse(false));
    await pickDrawMode(page, 'normal');
    await expect(status).toBeHidden();
});

test('Mirror recolours the mirrored cell too', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => { ToolManager.selectTool(TOOLS.BRUSH); BrushEngine.setBrush('round'); BrushEngine.setSize(1); });
    await seed(page);
    await page.evaluate(() => { StateManager.setDrawMode('attributes'); StateManager.setSymmetryMode('h'); });
    const click = await pixelClicker(page);
    // Its mirror image (x 219, local 3, row 3) is a paper pixel, so a pixel drawn there would show.
    await click(4 * 8 + 4, 5 * 8 + 3);
    const mirrorCx = await page.evaluate(() => ZX_SPECTRUM.GRID_COLS - 1 - 4);
    const m = await cellState(page, mirrorCx, 5);
    expect(m.pixels).toEqual(STRIPE);
    expect([m.ink, m.paper, m.bright, m.flash]).toEqual([3, 4, true, true]);
    await page.evaluate(() => StateManager.setSymmetryMode('off'));
});

test('the choice survives a reload and travels in a workspace preset', async ({ page }) => {
    await boot(page);
    await pickDrawMode(page, 'attributes');
    await page.waitForTimeout(300);
    await reload(page);
    expect(await page.evaluate(() => StateManager.getDrawMode()), 'remembered after a reload').toBe('attributes');

    const viaPreset = await page.evaluate(() => {
        const slice = PresetService.getSlice('drawing');
        const saved = slice.capture();
        StateManager.setDrawMode('normal');
        slice.apply(saved);
        return { saved: saved.drawMode, now: StateManager.getDrawMode() };
    });
    expect(viaPreset).toEqual({ saved: 'attributes', now: 'attributes' });
    await page.evaluate(() => StateManager.setDrawMode('normal'));
});

test('withdrawn where cells have no attributes, falling back to Normal', async ({ page }) => {
    await boot(page);
    page.on('dialog', (d) => d.accept());
    for (const mode of ['layer2_256', 'timex_hires', 'lores']) {
        await page.evaluate(() => ScreenModeService.switchMode('standard_ula'));
        await page.waitForTimeout(150);
        await page.evaluate(() => StateManager.setDrawMode('attributes'));
        await page.evaluate((m) => ScreenModeService.switchMode(m), mode);
        await page.waitForTimeout(200);
        expect(await offered(page), `not offered in ${mode}`).not.toContain('attributes');
        expect(await page.evaluate(() => StateManager.getDrawMode()), `${mode}: falls back to Normal`).toBe('normal');
    }
    await page.evaluate(() => ScreenModeService.switchMode('gigascreen'));
    await page.waitForTimeout(200);
    expect(await offered(page), 'offered in GigaScreen').toContain('attributes');
});
