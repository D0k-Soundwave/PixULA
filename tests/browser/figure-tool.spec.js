'use strict';
/**
 * Batch 7 part 7A in a real browser: the Figure tool, picked from the Shape list. Geometry is pinned in Node
 * (tests/figure-model.test.js, tests/figure-tool.test.js); here: the six entries are really there, each figure is drawn
 * by mouse, stays pending until Enter, Backspace and Escape do their jobs, and one Ctrl+Z removes a drawn figure.
 */
const { test, expect } = require('@playwright/test');
const { boot, selectMode } = require('./helpers');

/** Page coordinates of the centre of app pixel (px, py). */
async function pixelPoint(page, px, py) {
    const box = await page.frameLocator('#canvas-frame').locator('#main-canvas').boundingBox();
    const dims = await page.evaluate(() => ({ w: ZX_SPECTRUM.WIDTH, h: ZX_SPECTRUM.HEIGHT }));
    return {
        x: box.x + (px + 0.5) * box.width / dims.w,
        y: box.y + (py + 0.5) * box.height / dims.h
    };
}
async function click(page, px, py) {
    const p = await pixelPoint(page, px, py);
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await page.mouse.up();
    await page.waitForTimeout(550);              // longer than a double click, so each is its own click
}
async function drag(page, x1, y1, x2, y2) {
    const a = await pixelPoint(page, x1, y1);
    const b = await pixelPoint(page, x2, y2);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(550);
}
async function pick(page, value) {
    await page.click('.tool-btn[data-tool="shape"]');
    await page.click(`#tool-options-panel .tool-btn[data-value="${value}"]`);
}
const dotCount = (page) => page.evaluate(() => {
    const layer = LayerManager.getCurrentLayer();
    let n = 0;
    for (let cy = 0; cy < ZX_SPECTRUM.GRID_ROWS; cy++) for (let cx = 0; cx < ZX_SPECTRUM.GRID_COLS; cx++) {
        const c = layer.getCell(cx, cy);
        if (c && c.altered) for (const row of c.pixels) { let b = row; while (b) { n += b & 1; b >>= 1; } }
    }
    return n;
});
const dotAt = (page, x, y) => page.evaluate(([px, py]) => {
    const c = LayerManager.getCurrentLayer().getCell(Math.floor(px / 8), Math.floor(py / 8));
    return !!c && ((c.pixels[py % 8] >> (7 - (px % 8))) & 1) === 1;
}, [x, y]);

test('the six figures are in the Shape list and each one selects the Figure tool with the Shape button still lit', async ({ page }) => {
    await boot(page);
    await page.click('.tool-btn[data-tool="shape"]');
    for (const v of ['polyline', 'polygon', 'triangle', 'rays', 'orthogonal', 'parallel']) {
        await expect(page.locator(`#tool-options-panel .tool-btn[data-value="figure-${v}"]`)).toHaveCount(1);
    }
    await pick(page, 'figure-rays');
    expect(await page.evaluate(() => StateManager.getCurrentTool())).toBe('figure');
    expect(await page.evaluate(() => ToolManager.getCurrentTool().getShapeType())).toBe('figure-rays');
    await expect(page.locator('.tool-btn[data-tool="shape"]')).toHaveClass(/active/);
    // the list is still there: back to a rectangle from it
    await pick(page, 'rectangle');
    expect(await page.evaluate(() => StateManager.getCurrentTool())).toBe('shape');
});

test('a polyline stays pending until Enter, draws as one undo step, and Backspace edits it', async ({ page }) => {
    await boot(page);
    await pick(page, 'figure-polyline');
    await click(page, 40, 60);
    await click(page, 100, 60);
    await click(page, 100, 120);
    expect(await dotCount(page), 'nothing is written while drawing').toBe(0);
    await page.keyboard.press('Backspace');
    await click(page, 60, 120);
    await page.keyboard.press('Enter');          // finish: pending
    expect(await dotCount(page)).toBe(0);
    await page.keyboard.press('Enter');          // draw
    expect(await dotAt(page, 40, 60)).toBe(true);
    expect(await dotAt(page, 100, 60)).toBe(true);
    expect(await dotAt(page, 60, 120)).toBe(true);
    expect(await dotAt(page, 100, 120), 'the point removed with Backspace is not there').toBe(false);
    await page.keyboard.press('Control+z');
    expect(await dotCount(page)).toBe(0);
});

test('Escape drops a pending figure and switching tool draws it', async ({ page }) => {
    await boot(page);
    await pick(page, 'figure-polyline');
    await click(page, 40, 60);
    await click(page, 100, 60);
    await page.keyboard.press('Escape');
    expect(await dotCount(page)).toBe(0);
    expect(await page.evaluate(() => StateManager.getCurrentTool())).toBe('brush');

    await pick(page, 'figure-polyline');
    await click(page, 40, 60);
    await click(page, 100, 60);
    await page.keyboard.press('b');
    expect(await dotAt(page, 70, 60), 'picking the brush draws the figure').toBe(true);
});

test('a filled polygon fills its inside; a double click finishes it', async ({ page }) => {
    await boot(page);
    await pick(page, 'figure-polygon');
    await page.locator('#tool-options-panel #opt-filled').check();
    await click(page, 40, 40);
    await click(page, 120, 40);
    // the double click: two quick clicks on the same spot
    const p = await pixelPoint(page, 80, 110);
    await page.mouse.move(p.x, p.y);
    await page.mouse.down(); await page.mouse.up();
    await page.mouse.down(); await page.mouse.up();
    await page.keyboard.press('Enter');
    expect(await dotAt(page, 80, 60), 'the inside is filled').toBe(true);
    expect(await dotAt(page, 5, 5)).toBe(false);
});

test('rays: dragging draws a fan from the start point', async ({ page }) => {
    await boot(page);
    await pick(page, 'figure-rays');
    await click(page, 60, 100);
    await click(page, 140, 100);
    await click(page, 60, 20);
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    expect(await dotAt(page, 100, 100)).toBe(true);
    expect(await dotAt(page, 60, 60)).toBe(true);
});

test('orthogonal: drag the first line, click the point; the foot of the perpendicular is drawn', async ({ page }) => {
    await boot(page);
    await pick(page, 'figure-orthogonal');
    await drag(page, 20, 100, 200, 100);
    await click(page, 90, 40);
    await page.keyboard.press('Enter');          // it finished by itself at the third point: this draws it
    expect(await dotAt(page, 90, 100)).toBe(true);
    expect(await dotAt(page, 90, 70)).toBe(true);
    expect(await dotAt(page, 90, 40)).toBe(true);
});

test('parallel: the copy is centred on the clicked point', async ({ page }) => {
    await boot(page);
    await pick(page, 'figure-parallel');
    await drag(page, 20, 100, 100, 100);
    await click(page, 150, 50);
    await page.keyboard.press('Enter');
    expect(await dotAt(page, 110, 50)).toBe(true);
    expect(await dotAt(page, 190, 50)).toBe(true);
    expect(await dotAt(page, 109, 50)).toBe(false);
});

test('a figure draws in an indexed mode and in GigaScreen too', async ({ page }) => {
    await boot(page);
    page.on('dialog', (d) => d.accept());
    for (const mode of ['layer2_256', 'gigascreen']) {
        await selectMode(page, mode);
        await pick(page, 'figure-polyline');
        await click(page, 40, 60);
        await click(page, 100, 60);
        await page.keyboard.press('Enter');
        await page.keyboard.press('Enter');
        const drawn = await page.evaluate(() => {
            const c = LayerManager.getCurrentLayer().getCell(5, 7);
            return !!c && c.altered;
        });
        expect(drawn, mode).toBe(true);
        await page.keyboard.press('Control+z');
    }
});
