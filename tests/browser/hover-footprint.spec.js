'use strict';
/**
 * Hover footprint — the outline under the cursor, driven by a REAL mouse.
 *
 * The Node suite (tests/tool-footprint.test.js) proves each tool's footprint
 * equals the pixels it writes. This proves the other half: that a plain mouse
 * (not just a pen) actually gets the outline drawn on the overlay, that it is
 * a ring rather than an opaque blob, and that the tools which opt out draw
 * nothing. Reads the function-preview overlay canvas back pixel by pixel.
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

/** Page coordinates of the centre of app pixel (px, py). */
async function pixelPoint(page, px, py) {
    const box = await page.frameLocator('#canvas-frame').locator('#main-canvas').boundingBox();
    const dims = await page.evaluate(() => ({ w: ZX_SPECTRUM.WIDTH, h: ZX_SPECTRUM.HEIGHT }));
    return {
        x: box.x + (px + 0.5) * box.width / dims.w,
        y: box.y + (py + 0.5) * box.height / dims.h
    };
}

/** Read the overlay the footprint is drawn on: lit-pixel count + specific probes. */
function readOverlay(page, probes) {
    return page.evaluate((pts) => {
        const cvs = GridOverlay.functionPreviewCanvas;
        if (!cvs) return null;
        const ctx = cvs.getContext('2d');
        const { data, width, height } = ctx.getImageData(0, 0, cvs.width, cvs.height);

        let lit = 0;
        for (let i = 3; i < data.length; i += 4) if (data[i] > 0) lit++;

        const at = pts.map(([x, y]) => {
            if (x < 0 || x >= width || y < 0 || y >= height) return false;
            return data[(y * width + x) * 4 + 3] > 0;
        });
        return { lit, at };
    }, probes);
}

test('mouse hover outlines the brush footprint as a ring, not a blob', async ({ page }) => {
    await boot(page);
    await page.keyboard.press('b');
    await page.evaluate(() => { BrushEngine.setBrush('round'); BrushEngine.setSize(12); });

    const p = await pixelPoint(page, 128, 96);
    await page.mouse.move(p.x, p.y);

    // Centre is INTERIOR (must not be painted over); the rim is drawn.
    const o = await readOverlay(page, [[128, 96], [128, 96 - 5], [128, 96 + 5]]);
    expect(o).not.toBeNull();
    expect(o.lit, 'the outline is drawn for a plain mouse').toBeGreaterThan(0);
    expect(o.at[0], 'centre of a size-12 disc is interior, left unpainted').toBe(false);
    expect(o.at[1] || o.at[2], 'the rim of the disc is drawn').toBe(true);

    // A ring, not a filled disc: far fewer lit pixels than the ~113-pixel area.
    expect(o.lit, 'ring, not blob').toBeLessThan(60);
});

test('the outline follows the cursor', async ({ page }) => {
    await boot(page);
    await page.keyboard.press('b');
    await page.evaluate(() => { BrushEngine.setBrush('round'); BrushEngine.setSize(10); });

    // Probe the TOP of the stamp rather than a hard-coded offset: the topmost
    // row of any footprint is on its boundary by construction, whatever disc
    // rule BrushShapes uses.
    const top = await page.evaluate(() =>
        Math.min(...ToolManager.currentTool.getFootprint(0, 0).map(p => p.y)));

    const a = await pixelPoint(page, 60, 60);
    await page.mouse.move(a.x, a.y);
    const first = await readOverlay(page, [[60, 60 + top], [180, 120 + top]]);
    expect(first.at[0]).toBe(true);
    expect(first.at[1]).toBe(false);

    const b = await pixelPoint(page, 180, 120);
    await page.mouse.move(b.x, b.y);
    const second = await readOverlay(page, [[60, 60 + top], [180, 120 + top]]);
    expect(second.at[0], 'old position is cleared').toBe(false);
    expect(second.at[1], 'new position is drawn').toBe(true);
});

test('every stamping tool shows a footprint on mouse hover', async ({ page }) => {
    await boot(page);

    // [shortcut, setter, value] — eraser and spray had NO hover preview before,
    // on any device, despite both having a size the user can dial up. Spray is
    // now the brush 'spray' type (shortcut A), sized like any brush.
    // window.<Tool> is the CLASS; the live instance is ToolManager.currentTool.
    const cases = [
        ['e', 'setSize', 9],
        ['a', 'setSize', 10],
        ['s', 'setThickness', 6]
    ];

    for (const [key, setter, value] of cases) {
        await page.keyboard.press(key);
        await page.evaluate(([name, v]) => {
            const tool = ToolManager.currentTool;
            if (name && typeof tool[name] === 'function') tool[name](v);
        }, [setter, value]);
        const p = await pixelPoint(page, 128, 96);
        await page.mouse.move(p.x + 1, p.y + 1);   // force a pixel change
        await page.mouse.move(p.x, p.y);

        const id = await page.evaluate(() => ToolManager.currentTool?.id);
        const o = await readOverlay(page, [[128, 96]]);
        expect(o.lit, `${id}: footprint outline drawn on mouse hover`).toBeGreaterThan(0);
    }
});

test('a single-pixel footprint is not drawn (gated at 1px)', async ({ page }) => {
    await boot(page);
    const p = await pixelPoint(page, 128, 96);

    // Brush at size 1 — the default. The outline would land under the cursor
    // that already points at it, so it is suppressed.
    await page.keyboard.press('b');
    await page.evaluate(() => { BrushEngine.setBrush('round'); BrushEngine.setSize(1); });
    await page.mouse.move(p.x + 2, p.y + 2);
    await page.mouse.move(p.x, p.y);
    expect(await page.evaluate(() =>
        ToolManager.currentTool.getFootprint(128, 96).length),
        'the tool still reports its true 1px footprint').toBe(1);
    expect((await readOverlay(page, [])).lit, 'brush size 1: nothing drawn').toBe(0);

    // Point tools (fill, eyedropper) likewise.
    for (const key of ['g', 'i']) {
        await page.keyboard.press(key);
        await page.mouse.move(p.x + 2, p.y + 2);
        await page.mouse.move(p.x, p.y);
        const id = await page.evaluate(() => ToolManager.currentTool?.id);
        expect((await readOverlay(page, [])).lit, `${id}: nothing drawn`).toBe(0);
    }

    // Size 2 crosses the gate — the outline comes back.
    await page.keyboard.press('b');
    await page.evaluate(() => BrushEngine.setSize(8));
    await page.mouse.move(p.x + 2, p.y + 2);
    await page.mouse.move(p.x, p.y);
    expect((await readOverlay(page, [])).lit, 'a real footprint still draws').toBeGreaterThan(0);
});

test('tools with no footprint (pan, zoom) draw nothing, and clear on switch', async ({ page }) => {
    await boot(page);

    // Draw a footprint first, so we are proving it gets CLEARED, not just absent.
    await page.keyboard.press('b');
    await page.evaluate(() => BrushEngine.setSize(12));
    const p = await pixelPoint(page, 128, 96);
    await page.mouse.move(p.x, p.y);
    expect((await readOverlay(page, [])).lit).toBeGreaterThan(0);

    for (const key of ['v', 'z']) {           // Pan, Zoom
        await page.keyboard.press(key);
        await page.mouse.move(p.x + 2, p.y + 2);
        await page.mouse.move(p.x, p.y);
        const id = await page.evaluate(() => ToolManager.currentTool?.id);
        expect((await readOverlay(page, [])).lit, `${id}: no footprint`).toBe(0);
    }
});

test('changing the size repaints the footprint under a stationary cursor', async ({ page }) => {
    await boot(page);
    await page.keyboard.press('b');
    await page.evaluate(() => { BrushEngine.setBrush('round'); BrushEngine.setSize(6); });

    const p = await pixelPoint(page, 128, 96);
    await page.mouse.move(p.x, p.y);
    const small = (await readOverlay(page, [])).lit;
    expect(small).toBeGreaterThan(0);

    // Drive the real options path: OptionControls -> setSize -> EVENTS.TOOL_OPTIONS.
    const slider = page.locator('#opt-size');
    await slider.evaluate((el) => {
        el.value = '24';
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const big = (await readOverlay(page, [])).lit;
    expect(await page.evaluate(() => BrushEngine.currentSize), 'size applied').toBe(24);
    expect(big, 'outline grew without the cursor moving').toBeGreaterThan(small);
});
