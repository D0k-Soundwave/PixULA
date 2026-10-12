'use strict';
/**
 * Batch 9 part 9A in a real browser: the snap step (Cell / 16x16 / Screen / Custom). The list beside Snap, Screen only on a
 * canvas bigger than one screen, shape ends and stamps landing on the step, the arrow keys stepping by it, persistence.
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

test('with a 16x16 step a shape end lands on a multiple of 16', async ({ page }) => {
    await boot(page);
    await page.selectOption('#grid-snap-step', 'block16');
    await page.click('.tool-btn[data-tool="shape"]');
    await page.click('#tool-options-panel .tool-btn[data-value="rectangle"]');
    const a = await pixelPoint(page, 21, 19), b = await pixelPoint(page, 75, 61);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(400);
    const box = await page.evaluate(() => {
        const layer = LayerManager.getCurrentLayer();
        let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
        for (let y = 0; y < ZX_SPECTRUM.HEIGHT; y++) for (let x = 0; x < ZX_SPECTRUM.WIDTH; x++) {
            const c = layer.getCell(x >> 3, y >> 3);
            if (c && c.altered && ((c.pixels[y & 7] >> (7 - (x & 7))) & 1)) {
                if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
            }
        }
        return { x0, y0, x1, y1 };
    });
    expect([box.x0 % 16, box.y0 % 16], 'top-left on the 16 grid').toEqual([0, 0]);
    expect([box.x1 % 16, box.y1 % 16], 'bottom-right on the 16 grid').toEqual([0, 0]);
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
