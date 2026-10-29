'use strict';
/**
 * Batch 9 part 9A in a real browser: the snap step (Cell / 16x16 / Screen / Custom). The list beside Snap, Screen only on a
 * canvas bigger than one screen, box shapes covering whole steps, stamps landing on the step, the arrow keys stepping by it, persistence.
 * The maths is pinned in Node (tests/snap-grid.test.js, preset-slices.test.js).
 */
const { test, expect } = require('@playwright/test');
const { boot, reload, selectMode } = require('./helpers');

async function pixelPoint(page, px, py) {
    const box = await page.frameLocator('#canvas-frame').locator('#main-canvas').boundingBox();
    const dims = await page.evaluate(() => ({ w: ZX_SPECTRUM.WIDTH, h: ZX_SPECTRUM.HEIGHT }));
    return { x: box.x + (px + 0.5) * box.width / dims.w, y: box.y + (py + 0.5) * box.height / dims.h };
}
const optionTexts = (page) => page.locator('#grid-snap-step option').allTextContents();

test('the step list: sizes as labels, picking one turns Snap on', async ({ page }) => {
    await boot(page);
    expect(await optionTexts(page)).toEqual(['8x8', '16x16', '256x192', '24x24']);
    expect(await page.locator('#grid-snap-step option[value="screen"]').isDisabled()).toBe(true);
    expect(await page.evaluate(() => StateManager.getGridSnap())).toBe(false);
    await page.selectOption('#grid-snap-step', 'block16');
    expect(await page.evaluate(() => [StateManager.getGridSnap(), StateManager.getGridSnapStep().kind])).toEqual([true, 'block16']);
    await expect(page.locator('#grid-snap-toggle')).toHaveAttribute('aria-pressed', 'true');
});

test('the Cell label follows the mode, and Screen opens up only on a bigger canvas', async ({ page }) => {
    await boot(page);
    page.on('dialog', (d) => d.accept());
    await selectMode(page, 'multicolor_8x4');
    expect((await optionTexts(page))[0]).toBe('8x4');
    await selectMode(page, 'layer2_640');
    expect(await page.locator('#grid-snap-step option[value="screen"]').isDisabled()).toBe(false);
    await selectMode(page, 'standard_ula');
    expect(await page.locator('#grid-snap-step option[value="screen"]').isDisabled()).toBe(true);
});

test('the step survives a reload', async ({ page }) => {
    await boot(page);
    await page.selectOption('#grid-snap-step', 'block16');
    await page.waitForTimeout(300);
    await reload(page);
    expect(await page.evaluate(() => [StateManager.getGridSnap(), StateManager.getGridSnapStep().kind])).toEqual([true, 'block16']);
    expect(await page.locator('#grid-snap-step').inputValue()).toBe('block16');
});

// The ink box of what the current layer holds, or null when nothing is drawn.
const inkBox = (page) => page.evaluate(() => {
    const layer = LayerManager.getCurrentLayer();
    let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
    for (let y = 0; y < ZX_SPECTRUM.HEIGHT; y++) for (let x = 0; x < ZX_SPECTRUM.WIDTH; x++) {
        const c = layer.getCell(x >> 3, y >> 3);
        if (c && c.altered && ((c.pixels[y & 7] >> (7 - (x & 7))) & 1)) {
            if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
    }
    return x1 < 0 ? null : { x0, y0, x1, y1 };
});

async function drawShape(page, shape, from, to) {
    await page.click('.tool-btn[data-tool="shape"]');
    await page.click(`#tool-options-panel .tool-btn[data-value="${shape}"]`);
    const a = await pixelPoint(page, ...from), b = await pixelPoint(page, ...to);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(400);
    return inkBox(page);
}

test('with a 16x16 step a rectangle covers whole 16x16 blocks, not one pixel more', async ({ page }) => {
    await boot(page);
    await page.selectOption('#grid-snap-step', 'block16');
    const box = await drawShape(page, 'rectangle', [21, 19], [75, 61]);
    // The ends snap to the nearest 16 (21 -> 16, 75 -> 80, 19 -> 16, 61 -> 64): four blocks across, three down. Before
    // 2026-10-29 it ran to 80 and 64, one pixel into the next block each way.
    expect(box).toEqual({ x0: 16, y0: 16, x1: 79, y1: 63 });
});

test('Snap on the cell step: a rectangle dragged up and left still covers whole cells', async ({ page }) => {
    await boot(page);
    await page.click('#grid-snap-toggle');
    expect(await drawShape(page, 'rectangle', [75, 61], [21, 19])).toEqual({ x0: 24, y0: 16, x1: 71, y1: 63 });
});

test('Snap on the cell step: a square covers whole cells', async ({ page }) => {
    await boot(page);
    await page.click('#grid-snap-toggle');
    expect(await drawShape(page, 'square', [21, 19], [75, 61])).toEqual({ x0: 24, y0: 16, x1: 71, y1: 63 });
});

test('Snap on the cell step: a line still runs grid point to grid point', async ({ page }) => {
    await boot(page);
    await page.click('#grid-snap-toggle');
    expect(await drawShape(page, 'line', [21, 19], [75, 61])).toEqual({ x0: 24, y0: 16, x1: 72, y1: 64 });
});

test('Snap off: a rectangle runs pointer to pointer', async ({ page }) => {
    await boot(page);
    expect(await drawShape(page, 'rectangle', [21, 19], [75, 61])).toEqual({ x0: 21, y0: 19, x1: 75, y1: 61 });
});

test('arrow keys move a pending figure by the snap step', async ({ page }) => {
    await boot(page);
    await page.selectOption('#grid-snap-step', 'block16');
    await page.click('.tool-btn[data-tool="shape"]');
    await page.click('#tool-options-panel .tool-btn[data-value="figure-polyline"]');
    for (const [x, y] of [[32, 48], [96, 48]]) {
        const p = await pixelPoint(page, x, y);
        await page.mouse.move(p.x, p.y);
        await page.mouse.down();
        await page.mouse.up();
        await page.waitForTimeout(550);
    }
    await page.keyboard.press('Enter');
    const before = await page.evaluate(() => ToolManager.getCurrentTool()._model.points.map((p) => p.y));
    await page.keyboard.press('ArrowDown');
    const after = await page.evaluate(() => ToolManager.getCurrentTool()._model.points.map((p) => p.y));
    expect(after[0] - before[0]).toBe(16);
});

test('a stamp pasted under a 16 step lands with its corner on the 16 grid', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => {
        PixelDrawRoutine.beginBatch('t');
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) PixelDrawRoutine.draw(40 + x, 40 + y, ColorManager.getCurrentSelection(), DRAW_MODE.NORMAL);
        PixelDrawRoutine.endBatch();
        SelectionService.setSelection({ x: 40, y: 40, width: 16, height: 16 });
        SelectionService.copyOrCut(false);
    });
    await page.selectOption('#grid-snap-step', 'block16');
    const p = await pixelPoint(page, 121, 83);
    await page.mouse.move(p.x, p.y);
    await page.mouse.move(p.x + 3, p.y + 2);
    const at = await page.evaluate(() => { const fp = SelectionService.floatingPaste; return fp ? [fp.x, fp.y] : null; });
    expect(at, 'a floating paste exists').not.toBeNull();
    expect([at[0] % 16, at[1] % 16]).toEqual([0, 0]);
});
