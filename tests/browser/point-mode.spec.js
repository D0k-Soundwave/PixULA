'use strict';
/**
 * Batch 7 part 7C in a real browser: editing a pending figure (drag a point, the figure, the round knob; arrow keys;
 * Ctrl+Z), the Shape tool's "Keep editable" tick box, and Edit > Clone Last Figure (Shift+C). The geometry and the undo
 * rules are pinned in Node (tests/figure-edit.test.js, figure-tool.test.js, shape-bezier-preview.test.js).
 */
const { test, expect } = require('@playwright/test');
const { boot, selectMode } = require('./helpers');

async function pixelPoint(page, px, py) {
    const box = await page.frameLocator('#canvas-frame').locator('#main-canvas').boundingBox();
    const dims = await page.evaluate(() => ({ w: ZX_SPECTRUM.WIDTH, h: ZX_SPECTRUM.HEIGHT }));
    return { x: box.x + (px + 0.5) * box.width / dims.w, y: box.y + (py + 0.5) * box.height / dims.h };
}
async function click(page, px, py) {
    const p = await pixelPoint(page, px, py);
    await page.mouse.move(p.x, p.y);
    await page.mouse.down();
    await page.mouse.up();
    await page.waitForTimeout(550);
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
const dotAt = (page, x, y) => page.evaluate(([px, py]) => {
    const c = LayerManager.getCurrentLayer().getCell(Math.floor(px / 8), Math.floor(py / 8));
    return !!c && ((c.pixels[py % 8] >> (7 - (px % 8))) & 1) === 1;
}, [x, y]);
const dotCount = (page) => page.evaluate(() => {
    const layer = LayerManager.getCurrentLayer();
    let n = 0;
    for (let cy = 0; cy < ZX_SPECTRUM.GRID_ROWS; cy++) for (let cx = 0; cx < ZX_SPECTRUM.GRID_COLS; cx++) {
        const c = layer.getCell(cx, cy);
        if (c && c.altered) for (const row of c.pixels) { let b = row; while (b) { n += b & 1; b >>= 1; } }
    }
    return n;
});

async function pendingPolyline(page) {
    await pick(page, 'figure-polyline');
    await click(page, 40, 100);
    await click(page, 120, 100);
    await page.keyboard.press('Enter');             // finish: pending
}

test('drag a point of a pending polyline, then Enter draws it with the point moved', async ({ page }) => {
    await boot(page);
    await pendingPolyline(page);
    await drag(page, 120, 100, 120, 60);
    await page.keyboard.press('Enter');
    expect(await dotAt(page, 120, 60), 'the dragged end').toBe(true);
    expect(await dotAt(page, 120, 100), 'the old end is gone').toBe(false);
});

test('drag the figure itself to move it, and the arrow keys nudge it (Shift moves a cell)', async ({ page }) => {
    await boot(page);
    await pendingPolyline(page);
    await drag(page, 80, 100, 80, 120);              // on the line, between the points: move down 20
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Shift+ArrowDown');     // a whole cell down (8 rows in the standard mode)
    await page.keyboard.press('Enter');
    expect(await dotAt(page, 81, 128), 'moved 20 down + 8 down, 1 right').toBe(true);
    expect(await dotAt(page, 80, 100)).toBe(false);
});

test('the round knob turns the figure', async ({ page }) => {
    await boot(page);
    await pendingPolyline(page);
    // pivot (80,100); the knob is above it; swing it to the right of the pivot = a quarter turn
    const knob = await page.evaluate(() => ToolManager.getCurrentTool()._editor.knob());
    expect(knob.x).toBe(80);
    await drag(page, knob.x, knob.y, 120, 100);
    await page.keyboard.press('Enter');
    expect(await dotAt(page, 80, 60), 'the line is now vertical through x = 80').toBe(true);
    expect(await dotAt(page, 80, 140)).toBe(true);
    expect(await dotAt(page, 40, 100)).toBe(false);
});

test('Ctrl+Z while a figure is pending takes back the edit, then drops the figure, then the picture', async ({ page }) => {
    await boot(page);
    // an earlier drawing to prove the picture is untouched while a figure is pending
    await page.evaluate(() => {
        PixelDrawRoutine.beginBatch('test');
        PixelDrawRoutine.draw(10, 10, ColorManager.getCurrentSelection(), DRAW_MODE.NORMAL);
        PixelDrawRoutine.endBatch();
    });
    await pendingPolyline(page);
    await drag(page, 120, 100, 120, 60);
    await page.keyboard.press('Control+z');
    expect(await page.evaluate(() => ToolManager.getCurrentTool()._model.points[1].y), 'the drag is taken back').toBe(100);
    await page.keyboard.press('Control+z');
    expect(await page.evaluate(() => ToolManager.getCurrentTool().hasPending), 'then the figure is dropped').toBe(false);
    expect(await dotAt(page, 10, 10), 'the earlier drawing is still there').toBe(true);
    await page.keyboard.press('Control+z');
    expect(await dotAt(page, 10, 10), 'now the picture is undone').toBe(false);
});

test('Shape: Keep editable keeps the shape pending; off draws on release', async ({ page }) => {
    await boot(page);
    await pick(page, 'rectangle');
    await drag(page, 40, 40, 100, 80);
    expect(await dotCount(page), 'off: drawn at once').toBeGreaterThan(100);
    await page.keyboard.press('Control+z');
    expect(await dotCount(page)).toBe(0);

    await page.locator('#opt-pointMode').check();
    await drag(page, 40, 40, 100, 80);
    expect(await dotCount(page), 'on: nothing is drawn on release').toBe(0);
    await drag(page, 100, 80, 130, 110);              // the corner handle
    await page.keyboard.press('Enter');
    expect(await dotAt(page, 130, 110), 'the corner went where it was dragged').toBe(true);
    expect(await dotAt(page, 100, 80)).toBe(false);
});

test('Edit > Clone Last Figure is shut until a figure is drawn; Shift+C clones it', async ({ page }) => {
    await boot(page);
    await page.click('[data-menu="edit"]');
    expect(await page.evaluate(() => document.querySelector('[data-id="clone-figure"]').classList.contains('disabled'))).toBe(true);
    await page.keyboard.press('Escape');

    await pick(page, 'figure-polyline');
    await click(page, 40, 100);
    await click(page, 120, 100);
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');               // drawn
    await page.click('[data-menu="edit"]');
    expect(await page.evaluate(() => document.querySelector('[data-id="clone-figure"]').classList.contains('disabled'))).toBe(false);
    await page.keyboard.press('Escape');
    await page.evaluate(() => document.activeElement && document.activeElement.blur());   // the menu bar had the focus

    await page.keyboard.press('Shift+C');
    expect(await page.evaluate(() => ToolManager.getCurrentTool().hasPending), 'a pending copy').toBe(true);
    await page.keyboard.press('Shift+ArrowDown');
    await page.keyboard.press('Enter');
    expect(await dotAt(page, 60, 100), 'the original').toBe(true);
    expect(await dotAt(page, 60, 108), 'the copy, a cell lower').toBe(true);
});

test('a figure being edited is drawn into the file when you save (no pending figure is left out)', async ({ page }) => {
    await boot(page);
    page.on('dialog', (d) => d.accept());
    await pendingPolyline(page);
    expect(await dotCount(page)).toBe(0);
    await page.evaluate(() => ToolManager.commitPending());
    expect(await dotCount(page)).toBeGreaterThan(50);
});

test('a figure edits in an indexed mode too', async ({ page }) => {
    await boot(page);
    page.on('dialog', (d) => d.accept());
    await selectMode(page, 'layer2_256');
    await pendingPolyline(page);
    await drag(page, 120, 100, 120, 60);
    await page.keyboard.press('Enter');
    const drawn = await page.evaluate(() => {
        const c = LayerManager.getCurrentLayer().getCell(15, 7);
        return !!c && c.altered;
    });
    expect(drawn).toBe(true);
});
