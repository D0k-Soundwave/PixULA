'use strict';
/**
 * The top strip's three selector buttons (js/ui/components/strip-selector.js): Draw mode, Cell tool and
 * Mirror each show the choice in force and open a small two-column pop-up grid of the others. The grid
 * floats over the page, closes the moment a choice is made, and moves nothing in the strip. The groups are
 * independent: Draw mode and Mirror are both in force at once.
 */
const { test, expect } = require('@playwright/test');
const { boot, pickDrawMode, pickMirror } = require('./helpers');

/** Page coordinates of the centre of app pixel (px, py). */
async function pixelPoint(page, px, py) {
    const box = await page.frameLocator('#canvas-frame').locator('#main-canvas').boundingBox();
    const dims = await page.evaluate(() => ({ w: ZX_SPECTRUM.WIDTH, h: ZX_SPECTRUM.HEIGHT }));
    return {
        x: box.x + (px + 0.5) * box.width / dims.w,
        y: box.y + (py + 0.5) * box.height / dims.h
    };
}

const popup = (page) => page.locator('.strip-popup');

test('each selector shows what is in force and opens a two-column grid under itself', async ({ page }) => {
    await boot(page);
    await expect(page.locator('#draw-mode-select')).toHaveAttribute('data-value', 'normal');
    await expect(page.locator('#mirror-select')).toHaveAttribute('data-value', 'off');
    await expect(page.locator('#cell-tool-select')).toHaveAttribute('data-value', 'none');

    for (const [id, count] of [['draw-mode-select', 7], ['mirror-select', 4], ['cell-tool-select', 5]]) {
        await page.click('#' + id);
        await expect(popup(page)).toHaveCount(1);
        await expect(page.locator('#' + id)).toHaveAttribute('aria-expanded', 'true');
        const info = await page.evaluate(() => {
            const p = document.querySelector('.strip-popup').getBoundingClientRect();
            const items = [...document.querySelectorAll('.strip-popup .tool-btn')].map((e) => e.getBoundingClientRect());
            return {
                n: items.length,
                cols: getComputedStyle(document.querySelector('.strip-popup')).gridTemplateColumns.split(' ').length,
                lefts: [...new Set(items.map((r) => Math.round(r.left)))].length,
                inside: p.left >= 0 && p.top >= 0 && p.right <= innerWidth && p.bottom <= innerHeight
            };
        });
        expect(info.n, id).toBe(count);
        expect(info.cols, `${id} is two columns wide`).toBe(2);
        expect(info.lefts, `${id}: items sit in two columns`).toBe(2);
        expect(info.inside, `${id}: the grid is fully on screen`).toBe(true);
        await page.keyboard.press('Escape');
        await expect(popup(page)).toHaveCount(0);
    }
});

test('opening the grid moves nothing; picking closes it; Escape and an outside click close it unchanged', async ({ page }) => {
    await boot(page);
    const strip = () => page.locator('#color-bar').boundingBox();
    const before = await strip();

    await page.click('#draw-mode-select');
    expect(await strip(), 'the strip does not grow or move while the grid is open').toEqual(before);

    await page.locator('.strip-popup #draw-mode-xor').click();
    await expect(popup(page), 'closes as soon as a choice is made').toHaveCount(0);
    await expect(page.locator('#draw-mode-select')).toHaveAttribute('data-value', 'xor');

    await page.click('#draw-mode-select');
    await page.keyboard.press('Escape');
    await expect(popup(page)).toHaveCount(0);
    await expect(page.locator('#draw-mode-select')).toHaveAttribute('data-value', 'xor');
    // Escape closes the grid and nothing else: it must not run the app's Escape cascade (back to the Brush)
    await page.keyboard.press('b');
    await page.keyboard.press('Shift+I');
    await page.keyboard.press('Shift+I');

    await page.click('#draw-mode-select');
    const p = await pixelPoint(page, 100, 100);
    await page.mouse.click(p.x, p.y, { button: 'left' });
    await expect(popup(page), 'clicking elsewhere closes it').toHaveCount(0);
    await expect(page.locator('#draw-mode-select')).toHaveAttribute('data-value', 'xor');

    // Only one grid is open at a time.
    await page.click('#draw-mode-select');
    await page.click('#mirror-select');
    await expect(popup(page)).toHaveCount(1);
    await expect(page.locator('#draw-mode-select')).toHaveAttribute('aria-expanded', 'false');
});

test('Draw mode and Mirror are independent and both in force: XOR with Horizontal mirror', async ({ page }) => {
    await boot(page);
    await page.keyboard.press('b');
    await page.evaluate(() => ToolManager.getCurrentTool().setSize(1));
    await pickDrawMode(page, 'xor');
    await pickMirror(page, 'h');
    expect(await page.evaluate(() => [StateManager.getDrawMode(), StateManager.getSymmetryMode()])).toEqual(['xor', 'h']);

    const a = await pixelPoint(page, 30, 60);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.up();
    const dots = await page.evaluate(() => {
        const L = LayerManager.getCurrentLayer();
        const on = (x, y) => ((L.getCell(Math.floor(x / 8), Math.floor(y / 8)).pixels[y % 8] >> (7 - (x % 8))) & 1) === 1;
        return [on(30, 60), on(ZX_SPECTRUM.WIDTH - 1 - 30, 60)];
    });
    expect(dots, 'the stroke is an XOR stroke, and its mirror image is too').toEqual([true, true]);

    // Choosing 'Off' for Mirror leaves the draw mode alone, and vice versa.
    await pickMirror(page, 'off');
    expect(await page.evaluate(() => [StateManager.getDrawMode(), StateManager.getSymmetryMode()])).toEqual(['xor', 'off']);
    await pickDrawMode(page, 'normal');
    expect(await page.evaluate(() => [StateManager.getDrawMode(), StateManager.getSymmetryMode()])).toEqual(['normal', 'off']);
});

test('the grid stays on screen when the window is narrow', async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 600 });
    await boot(page);
    for (const id of ['draw-mode-select', 'cell-tool-select', 'mirror-select']) {
        await page.click('#' + id);
        const inside = await page.evaluate(() => {
            const p = document.querySelector('.strip-popup').getBoundingClientRect();
            return p.left >= 0 && p.top >= 0 && p.right <= innerWidth && p.bottom <= innerHeight;
        });
        expect(inside, id).toBe(true);
        await page.keyboard.press('Escape');
    }
});
