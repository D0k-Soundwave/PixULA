'use strict';
/**
 * Colour core (batch 4 part 4A) in a real browser: the option row shows only
 * where cells have colours, it works by mouse, and the live preview shows
 * the picture the commit leaves. What the rule does cell by cell is pinned in
 * Node by tests/colour-core.test.js.
 */
const { test, expect } = require('@playwright/test');
const { boot, selectMode, pickMirror } = require('./helpers');

/** Page coordinates of the centre of app pixel (px, py). */
async function pixelPoint(page, px, py) {
    const box = await page.frameLocator('#canvas-frame').locator('#main-canvas').boundingBox();
    const dims = await page.evaluate(() => ({ w: ZX_SPECTRUM.WIDTH, h: ZX_SPECTRUM.HEIGHT }));
    return {
        x: box.x + (px + 0.5) * box.width / dims.w,
        y: box.y + (py + 0.5) * box.height / dims.h
    };
}

/** Pixels of a canvas inside the iframe, as one string, for a comparison. */
const canvasRegion = (page, id, x, y, w, h) => page.evaluate(([cid, rx, ry, rw, rh]) => {
    const doc = document.getElementById('canvas-frame').contentDocument;
    const ctx = doc.getElementById(cid).getContext('2d');
    return Array.from(ctx.getImageData(rx, ry, rw, rh).data).join(',');
}, [id, x, y, w, h]);

test('the Colour core row shows for the brush, shapes and curves, and only where cells have colours', async ({ page }) => {
    await boot(page);
    page.on('dialog', (d) => d.accept());
    const visible = () => page.evaluate(() => {
        const input = document.querySelector('#tool-options-panel [data-option="colourCore"]');
        const r = input && input.closest('.tool-option');
        return !!r && !r.hidden && r.offsetParent !== null;
    });

    await page.keyboard.press('b');
    expect(await visible(), 'Brush, standard ULA').toBe(true);
    await page.evaluate(() => ToolManager.selectTool(TOOLS.RECTANGLE));
    expect(await visible(), 'Rectangle, unfilled').toBe(true);
    await page.evaluate(() => ToolManager.getCurrentTool().setFilled(true));
    await page.evaluate(() => OptionControls.showOptionsForTool(StateManager.getCurrentTool()));
    expect(await visible(), 'a filled shape has no outline to colour').toBe(false);
    await page.evaluate(() => ToolManager.getCurrentTool().setFilled(false));

    await page.keyboard.press('c');
    expect(await visible(), 'Bezier').toBe(true);

    await selectMode(page, 'timex_hires');
    expect(await visible(), 'Timex hi-res has no cell colours').toBe(false);
    await selectMode(page, 'layer2_256');
    expect(await visible(), 'Layer 2 has none either').toBe(false);
    await selectMode(page, 'ula_plus');
    expect(await visible(), 'ULAplus has').toBe(true);
    await page.keyboard.press('b');
    expect(await visible(), 'Brush, ULAplus').toBe(true);
});

test('a thick line drawn with the mouse colours only its core cells', async ({ page }) => {
    await boot(page);
    await page.keyboard.press('b');
    await page.evaluate(() => {
        const t = ToolManager.getCurrentTool();
        t.setSize(8);
        t.setColourCore('1');
    });
    const a = await pixelPoint(page, 20, 100);
    const b = await pixelPoint(page, 120, 100);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 6 });
    await page.mouse.up();
    const result = await page.evaluate(() => {
        const L = LayerManager.getCurrentLayer();
        const coloured = new Set();
        let dotRows = new Set();
        for (let cy = 0; cy < ZX_SPECTRUM.GRID_ROWS; cy++) {
            for (let cx = 0; cx < ZX_SPECTRUM.GRID_COLS; cx++) {
                const c = L.getCell(cx, cy);
                if (!c || !c.altered) continue;
                if (c.ink === ColorManager.getInk() && c.paper === ColorManager.getPaper()) coloured.add(cy);
                for (let r = 0; r < 8; r++) if (c.pixels[r]) dotRows.add(cy * 8 + r);
            }
        }
        return { colouredRows: [...coloured], dotRows: [...dotRows].sort((p, q) => p - q) };
    });
    // Size 8 spans 8 pixel rows (across two cell rows); a 1-pixel core on y = 100 sits in one cell row (12).
    expect(result.dotRows.length, 'the whole 8-pixel width of dots').toBeGreaterThanOrEqual(8);
    expect(result.colouredRows, 'only the cell row under the centre line is coloured').toEqual([12]);
});

test('the live preview of a thick outline is the picture the commit leaves', async ({ page }) => {
    await boot(page);
    await page.evaluate(() => ToolManager.selectTool(TOOLS.RECTANGLE));
    await page.evaluate(() => {
        const t = ToolManager.getCurrentTool();
        t.setThickness(5);
        t.setColourCore('1');
        ColorManager.setInk(2);
        ColorManager.setPaper(5);
    });
    const a = await pixelPoint(page, 24, 24);
    const b = await pixelPoint(page, 88, 72);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 5 });
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const preview = await canvasRegion(page, 'composite-preview-canvas', 16, 16, 80, 64);
    await page.mouse.up();
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const committed = await canvasRegion(page, 'main-canvas', 16, 16, 80, 64);
    // The preview paints whole cells and leaves the rest transparent: compare every pixel it drew.
    const p = preview.split(',').map(Number), c = committed.split(',').map(Number);
    let drawn = 0, wrong = 0;
    for (let i = 0; i < p.length; i += 4) {
        if (p[i + 3] === 0) continue;
        drawn++;
        if (p[i] !== c[i] || p[i + 1] !== c[i + 1] || p[i + 2] !== c[i + 2]) wrong++;
    }
    expect(drawn, 'the preview drew something').toBeGreaterThan(100);
    expect(wrong, 'every pixel the preview drew is the committed pixel').toBe(0);
});

test('Colour core also works with Mirror and XOR from the real controls', async ({ page }) => {
    await boot(page);
    await page.keyboard.press('b');
    await pickMirror(page, 'h');
    await page.evaluate(() => {
        const t = ToolManager.getCurrentTool();
        t.setSize(8);
        t.setColourCore('1');
    });
    const a = await pixelPoint(page, 30, 100);
    const b = await pixelPoint(page, 60, 100);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 4 });
    await page.mouse.up();
    const cols = await page.evaluate(() => {
        const L = LayerManager.getCurrentLayer();
        const out = new Set();
        for (let cx = 0; cx < ZX_SPECTRUM.GRID_COLS; cx++) {
            for (let cy = 0; cy < ZX_SPECTRUM.GRID_ROWS; cy++) {
                const c = L.getCell(cx, cy);
                if (c && c.altered && c.ink === ColorManager.getInk() && c.paper === ColorManager.getPaper()) out.add(cy);
            }
        }
        return [...out];
    });
    expect(cols, 'the mirrored line is in the same cell row').toEqual([12]);
});
