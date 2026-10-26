'use strict';
/**
 * Every preview shows the mirror copies (owner, 2026-10-26: "they should all show on previews"). Shapes, the curve and
 * the Figure tool already did; the gradient, a floating stamp or text and Type on canvas showed only the original, and
 * the copies appeared when it was drawn. The oracle is the commit itself: the picture as the preview shows it (the
 * page plus the preview layer over it) must be the picture the commit leaves, pixel for pixel.
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

/** An uneven picture, so a copy that lands wrong cannot hide. */
const seed = (page) => page.evaluate(() => {
    const L = LayerManager.getCurrentLayer();
    const W = ZX_SPECTRUM.WIDTH, H = ZX_SPECTRUM.HEIGHT;
    let s = 41;
    const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s >> 4; };
    if (ZX_SPECTRUM.PIXEL_DEPTH > 1) {
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) L.setPixelIndex(x, y, (rnd() & 3) ? 0 : 1 + rnd() % 4);
    } else {
        for (let cy = 0; cy < ZX_SPECTRUM.GRID_ROWS; cy++) for (let cx = 0; cx < ZX_SPECTRUM.GRID_COLS; cx++) {
            const c = L.getCell(cx, cy);
            for (let r = 0; r < ZX_SPECTRUM.CELL_HEIGHT; r++) { c.pixels[r] = rnd() & rnd() & 0xff; if (c.pixelsB) c.pixelsB[r] = rnd() & 0xff; }
            c.ink = rnd() % 8; c.paper = (c.ink + 1 + rnd() % 7) % 8; c.bright = false; c.flash = false;
            if (c.inkB !== undefined) { c.inkB = rnd() % 8; c.paperB = (c.inkB + 3) % 8; c.brightB = false; c.flashB = false; }
            c.altered = true;
        }
    }
    ColorManager.setInk(2); ColorManager.setPaper(6); ColorManager.setBright(false); ColorManager.setFlash(false);
    for (const k of ['Ink', 'Paper', 'Bright', 'Flash']) ColorManager['set' + k + 'Transparent'](false);
    LayerManager.composeToCanvas();
    EventBus.emit(EVENTS.CANVAS_RENDER);
});

/** What the artist sees: the page with the preview layer over it, as one list of pixels. */
async function visible(page) {
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    return page.evaluate(() => {
        const doc = document.getElementById('canvas-frame').contentDocument;
        const main = doc.getElementById('main-canvas');
        const over = doc.getElementById('composite-preview-canvas');
        const c = document.createElement('canvas');
        c.width = main.width; c.height = main.height;
        const ctx = c.getContext('2d');
        ctx.drawImage(main, 0, 0);
        ctx.drawImage(over, 0, 0, main.width, main.height);
        const d = ctx.getImageData(0, 0, c.width, c.height).data;
        const out = [];
        for (let i = 0; i < d.length; i += 4) out.push((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
        return out;
    });
}

const differing = (a, b) => a.reduce((n, v, i) => n + (v !== b[i] ? 1 : 0), 0);

async function useMode(page, id) {
    await page.evaluate((m) => ScreenModeService.applyModeRaw(m), id);
    await page.evaluate(() => StateManager.setZoom(100));
    await page.waitForTimeout(100);
}

async function canvasAt(page) {
    const box = await page.frameLocator('#canvas-frame').locator('#main-canvas').boundingBox();
    const dims = await page.evaluate(() => ({ w: ZX_SPECTRUM.WIDTH, h: ZX_SPECTRUM.HEIGHT }));
    return (fx, fy) => [box.x + (Math.round(fx * dims.w) + 0.5) * box.width / dims.w,
        box.y + (Math.round(fy * dims.h) + 0.5) * box.height / dims.h];
}

const set = (page, dm, sym) => page.evaluate(([dm, sym]) => {
    StateManager.setDrawMode(dm); StateManager.setSymmetryMode(sym);
}, [dm, sym]);

/**
 * Show the preview, read the page, draw, read it again. The two must be the same picture, and with Mirror on
 * the drawing must have reached past the original (so the test is not passing on a preview of nothing).
 */
async function previewIsCommit(page, label, show, draw) {
    const before = await visible(page);
    await show();
    const preview = await visible(page);
    await draw();
    const after = await visible(page);
    expect(differing(before, after), `${label}: it drew`).toBeGreaterThan(0);
    expect(differing(preview, after), `${label}: the preview is the picture it leaves`).toBe(0);
}

const SYMS = ['h', 'v', 'quad'];

test('control: a shape preview already shows the mirror copies', async ({ page }) => {
    await boot(page);
    const at = await canvasAt(page);
    await page.evaluate(() => ToolManager.selectTool(TOOLS.RECTANGLE));
    for (const sym of SYMS) {
        await set(page, 'normal', sym);
        await seed(page);
        await previewIsCommit(page, `rectangle ${sym}`,
            async () => { await page.mouse.move(...at(0.2, 0.15)); await page.mouse.down(); await page.mouse.move(...at(0.4, 0.33), { steps: 5 }); },
            async () => { await page.mouse.up(); });
    }
});

for (const mode of ['standard_ula', 'gigascreen', 'layer2_256']) {
    test(`the gradient preview shows the mirror copies in ${mode}`, async ({ page }) => {
        page.on('dialog', (d) => d.accept());
        await boot(page);
        await useMode(page, mode);
        const at = await canvasAt(page);
        await page.click('#tool-rail button[data-tool="gradient"]');
        const dms = mode === 'layer2_256' ? ['normal', 'xor'] : ['normal', 'ink', 'xor'];
        for (const dm of dms) for (const sym of SYMS) {
            await set(page, dm, sym);
            await seed(page);
            await previewIsCommit(page, `gradient ${dm} ${sym}`,
                async () => {
                    await page.mouse.move(...at(0.12, 0.1)); await page.mouse.down();
                    await page.mouse.move(...at(0.42, 0.38), { steps: 5 }); await page.mouse.up();
                    await page.mouse.move(...at(0.15, 0.2)); await page.mouse.down();
                    await page.mouse.move(...at(0.38, 0.3), { steps: 5 });
                    await page.waitForTimeout(50);
                },
                async () => { await page.mouse.up(); });
        }
    });

    test(`a floating text, a floating stamp and Type on canvas preview the mirror copies in ${mode}`, async ({ page }) => {
        test.setTimeout(90000);
        page.on('dialog', (d) => d.accept());
        await boot(page);
        await useMode(page, mode);
        const at = await canvasAt(page);
        const dms = mode === 'layer2_256' ? ['normal', 'xor'] : ['normal', 'ink', 'xor'];
        for (const dm of dms) for (const sym of SYMS) {
            const label = `${dm} ${sym}`;
            // A text waiting to be placed.
            await page.evaluate(() => {
                if (SelectionService.isFloating()) SelectionService.endFloatingPaste();
                ToolManager.selectTool(TOOLS.TEXT);
                ToolManager.getTool(TOOLS.TEXT).setTypeOnCanvas(false);
                ToolManager.getTool(TOOLS.TEXT).setText('HI');
            });
            await set(page, dm, sym);
            await seed(page);
            await previewIsCommit(page, `text ${label}`,
                async () => { await page.mouse.move(...at(0.2, 0.2)); await page.waitForTimeout(80); await page.mouse.move(...at(0.2, 0.21)); },
                async () => { await page.keyboard.press('Enter'); await page.waitForTimeout(80); });
            await page.keyboard.press('Escape');

            // A pasted stamp, floating.
            await page.evaluate(() => {
                if (SelectionService.isFloating()) SelectionService.endFloatingPaste();
                ToolManager.selectTool(TOOLS.SELECTION);
            });
            await set(page, dm, sym);
            await seed(page);
            await previewIsCommit(page, `stamp ${label}`,
                () => page.evaluate(() => SelectionService.startFloatingPasteFromMask(
                    [[true, true, false, true, true], [true, false, false, false, true], [true, true, true, false, false]],
                    5, 3, 21, 26, 'Paste')),
                async () => { await page.keyboard.press('Enter'); await page.waitForTimeout(80); });

            // Type on canvas.
            await page.evaluate(() => {
                ToolManager.selectTool(TOOLS.TEXT); ToolManager.getTool(TOOLS.TEXT).setTypeOnCanvas(true);
            });
            await set(page, dm, sym);
            await seed(page);
            await previewIsCommit(page, `typed ${label}`,
                async () => { await page.mouse.click(...at(0.15, 0.2)); await page.waitForTimeout(120); await page.keyboard.type('Ab'); await page.waitForTimeout(80); },
                async () => { await page.keyboard.press('Enter'); await page.waitForTimeout(150); });
            await page.evaluate(() => ToolManager.getTool(TOOLS.TEXT).setTypeOnCanvas(false));
        }
    });
}

test('turning Mirror on or off while a stamp floats redraws its preview, and Escape leaves nothing behind', async ({ page }) => {
    await boot(page);
    await seed(page);
    const plain = await visible(page);
    await page.evaluate(() => {
        ToolManager.selectTool(TOOLS.SELECTION);
        StateManager.setSymmetryMode('off');
        SelectionService.startFloatingPasteFromMask([[true, true], [true, true]], 2, 2, 30, 20, 'Paste');
    });
    const alone = await visible(page);
    await page.evaluate(() => StateManager.setSymmetryMode('quad'));
    const mirrored = await visible(page);
    expect(differing(alone, mirrored), 'Mirror on: the copies appear').toBeGreaterThan(0);
    await page.evaluate(() => StateManager.setSymmetryMode('off'));
    expect(differing(alone, await visible(page)), 'Mirror off: the copies go').toBe(0);
    // Escape drops the stamp. Its preview cells used to stay on the screen until something else redrew the picture.
    await page.keyboard.press('Escape');
    expect(differing(plain, await visible(page)), 'Escape: the picture as it was').toBe(0);
});
