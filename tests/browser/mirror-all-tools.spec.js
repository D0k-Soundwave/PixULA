'use strict';
/**
 * Mirror works with every tool (owner, 2026-10-26: "all modes should work with this"). The pixel tools always mirrored,
 * because every write goes through PixelDrawRoutine.draw(); these did not:
 *  - the five cell tools (Swap, Recolour, Copy colours, Invert Pixels, Invert Pixels and Attributes) changed only the
 *    cell under the pointer;
 *  - the Fade brush judged its thinning again on the mirrored side, so the two sides differed (in the attribute draw
 *    modes, mirrored cells were left uncoloured);
 *  - a placed stamp, a placed text and Type on canvas switched Mirror off.
 * A cell tool's mirrored cell gets the same operation on its OWN content; the oracle below runs the operation by hand,
 * with Mirror off, on the cell and its mirror cells, and the result must be identical.
 */
const { test, expect } = require('@playwright/test');
const { boot, pickCellTool } = require('./helpers');

const SCREEN_MODES = ['standard_ula', 'multicolor_8x1', 'gigascreen', 'ula_plus', 'ulanext', 'timex_hires'];
const CELL_OPS = ['swap', 'apply', 'copy', 'invertDots', 'invertBoth'];

async function useMode(page, id) {
    await page.evaluate((m) => ScreenModeService.applyModeRaw(m), id);
    await page.waitForTimeout(50);
}

/** Every cell different, ink never equal to paper (a swap always shows). */
const seedDistinct = (page) => page.evaluate(() => {
    const L = LayerManager.getCurrentLayer();
    const H = ZX_SPECTRUM.CELL_HEIGHT;
    let s = 99;
    const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s >> 4; };
    for (let cy = 0; cy < ZX_SPECTRUM.GRID_ROWS; cy++) for (let cx = 0; cx < ZX_SPECTRUM.GRID_COLS; cx++) {
        const c = L.getCell(cx, cy);
        for (let r = 0; r < H; r++) { c.pixels[r] = rnd() & 0xff; if (c.pixelsB) c.pixelsB[r] = rnd() & 0xff; }
        c.ink = rnd() % 8; c.paper = (c.ink + 1 + rnd() % 7) % 8; c.bright = !!(rnd() & 1); c.flash = false;
        if (c.inkB !== undefined) { c.inkB = rnd() % 8; c.paperB = (c.inkB + 1 + rnd() % 7) % 8; c.brightB = !!(rnd() & 1); c.flashB = false; }
        c.altered = true;
    }
    ColorManager.setInk(2); ColorManager.setPaper(5); ColorManager.setBright(true); ColorManager.setFlash(false);
    for (const k of ['Ink', 'Paper', 'Bright', 'Flash']) ColorManager['set' + k + 'Transparent'](false);
    EventBus.emit(EVENTS.CANVAS_RENDER);
});

/** A picture that is its own mirror image in all three Mirror settings. */
const seedSymmetric = (page) => page.evaluate(() => {
    const L = LayerManager.getCurrentLayer();
    const H = ZX_SPECTRUM.CELL_HEIGHT, C = ZX_SPECTRUM.GRID_COLS, R = ZX_SPECTRUM.GRID_ROWS;
    const rev = (b) => { let r = 0; for (let i = 0; i < 8; i++) if (b & (1 << i)) r |= 1 << (7 - i); return r; };
    let s = 7;
    const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s >> 4; };
    for (let cy = 0; cy < Math.ceil(R / 2); cy++) for (let cx = 0; cx < Math.ceil(C / 2); cx++) {
        const rows = [], rowsB = [];
        for (let r = 0; r < H; r++) { rows.push(rnd() & 0xff); rowsB.push(rnd() & 0xff); }
        const a = { ink: rnd() % 8, paper: rnd() % 8, bright: !!(rnd() & 1) };
        const put = (x, y, hf, vf) => {
            const c = L.getCell(x, y);
            for (let r = 0; r < H; r++) {
                const src = vf ? H - 1 - r : r;
                c.pixels[r] = hf ? rev(rows[src]) : rows[src];
                if (c.pixelsB) c.pixelsB[r] = hf ? rev(rowsB[src]) : rowsB[src];
            }
            c.ink = a.ink; c.paper = a.paper; c.bright = a.bright; c.flash = false;
            if (c.inkB !== undefined) { c.inkB = a.paper; c.paperB = a.ink; c.brightB = a.bright; c.flashB = false; }
            c.altered = true;
        };
        put(cx, cy, false, false); put(C - 1 - cx, cy, true, false);
        put(cx, R - 1 - cy, false, true); put(C - 1 - cx, R - 1 - cy, true, true);
    }
    ColorManager.setInk(2); ColorManager.setPaper(5); ColorManager.setBright(true); ColorManager.setFlash(false);
    for (const k of ['Ink', 'Paper', 'Bright', 'Flash']) ColorManager['set' + k + 'Transparent'](false);
    EventBus.emit(EVENTS.CANVAS_RENDER);
});

const snapshot = (page) => page.evaluate(() => {
    const L = LayerManager.getCurrentLayer();
    const out = [];
    for (let cy = 0; cy < ZX_SPECTRUM.GRID_ROWS; cy++) for (let cx = 0; cx < ZX_SPECTRUM.GRID_COLS; cx++) {
        const c = L.getCell(cx, cy);
        out.push([Array.from(c.pixels).join(','), c.pixelsB ? Array.from(c.pixelsB).join(',') : '',
            c.ink, c.paper, !!c.bright, !!c.flash, c.inkB, c.paperB, !!c.brightB, !!c.flashB].join('|'));
    }
    return out;
});

/** Cells that differ from their mirror image, for a picture seeded symmetric. */
const asymmetric = (page, sym) => page.evaluate((sym) => {
    const L = LayerManager.getCurrentLayer();
    const C = ZX_SPECTRUM.GRID_COLS, R = ZX_SPECTRUM.GRID_ROWS, H = ZX_SPECTRUM.CELL_HEIGHT;
    const rev = (b) => { let r = 0; for (let i = 0; i < 8; i++) if (b & (1 << i)) r |= 1 << (7 - i); return r; };
    const bad = [];
    for (let cy = 0; cy < R; cy++) for (let cx = 0; cx < C; cx++) {
        const a = L.getCell(cx, cy);
        const pairs = [];
        if (sym === 'h' || sym === 'quad') pairs.push([C - 1 - cx, cy, true, false]);
        if (sym === 'v' || sym === 'quad') pairs.push([cx, R - 1 - cy, false, true]);
        for (const [x, y, hf, vf] of pairs) {
            const b = L.getCell(x, y);
            let same = a.ink === b.ink && a.paper === b.paper && !!a.bright === !!b.bright && !!a.flash === !!b.flash &&
                a.inkB === b.inkB && a.paperB === b.paperB;
            for (let r = 0; r < H; r++) {
                const m = (row) => hf ? rev(row[vf ? H - 1 - r : r]) : row[vf ? H - 1 - r : r];
                if (a.pixels[r] !== m(b.pixels)) same = false;
                if (a.pixelsB && a.pixelsB[r] !== m(b.pixelsB)) same = false;
            }
            if (!same) bad.push(`${cx},${cy}`);
        }
    }
    return bad;
}, sym);

async function canvasPoint(page) {
    const box = await page.frameLocator('#canvas-frame').locator('#main-canvas').boundingBox();
    const dims = await page.evaluate(() => ({ w: ZX_SPECTRUM.WIDTH, h: ZX_SPECTRUM.HEIGHT, cw: ZX_SPECTRUM.CELL_WIDTH, ch: ZX_SPECTRUM.CELL_HEIGHT }));
    const at = (px, py) => [box.x + (px + 0.5) * box.width / dims.w, box.y + (py + 0.5) * box.height / dims.h];
    const atCell = (cx, cy) => at(cx * dims.cw + dims.cw / 2, cy * dims.ch + Math.floor(dims.ch / 2));
    return { at, atCell, dims };
}

/** The cells a Mirror setting adds for one cell. */
const mirrorCells = (page, cx, cy, sym) => page.evaluate(([cx, cy, sym]) => {
    const C = ZX_SPECTRUM.GRID_COLS, R = ZX_SPECTRUM.GRID_ROWS;
    const out = [];
    if (sym === 'h' || sym === 'quad') out.push([C - 1 - cx, cy]);
    if (sym === 'v' || sym === 'quad') out.push([cx, R - 1 - cy]);
    if (sym === 'quad') out.push([C - 1 - cx, R - 1 - cy]);
    return out;
}, [cx, cy, sym]);

/** The oracle: the operation run by hand with Mirror off on each listed cell, inside one batch. */
const byHand = (page, op, cells, pickFrom) => page.evaluate(([op, cells, pickFrom]) => {
    StateManager.setSymmetryMode('off');
    PixelDrawRoutine.beginBatch('oracle');
    const picked = op === 'copy' ? TransformService.pickCellColours(pickFrom[0], pickFrom[1]) : null;
    for (const [x, y] of cells) {
        if (op === 'swap') TransformService.swapCellColours(x, y);
        if (op === 'apply') TransformService.recolourCell(x, y);
        if (op === 'copy') TransformService.paintCellColours(x, y, picked);
        if (op === 'invertDots') TransformService.invertCellDots(x, y);
        if (op === 'invertBoth') TransformService.invertCellDotsAndColours(x, y);
    }
    PixelDrawRoutine.endBatch();
}, [op, cells, pickFrom]);

for (const mode of SCREEN_MODES) {
    test(`cell tools follow Mirror in ${mode}`, async ({ page }) => {
        test.setTimeout(120000);
        await boot(page);
        await useMode(page, mode);
        const { atCell, dims } = await canvasPoint(page);
        const C = dims.w / dims.cw;
        let ran = 0;
        for (const op of CELL_OPS) {
            if (!(await page.evaluate((o) => ColorManager.cellToolAvailable(o), op))) continue;
            for (const sym of ['h', 'v', 'quad']) {
                // Click one cell (Copy picks at A and paints the walk to B). Clear of the colour rail's
                // tab, which covers the left edge of the picture in Timex hi-res.
                const ax = Math.floor(C * 0.35);
                const A = [ax, 6], B = [ax + 3, 6];
                await seedDistinct(page);
                const before = await snapshot(page);
                await page.evaluate((s) => StateManager.setSymmetryMode(s), sym);
                await pickCellTool(page, op);
                await page.mouse.move(...atCell(...A));
                await page.mouse.down();
                if (op === 'copy') await page.mouse.move(...atCell(...B), { steps: 6 });
                await page.mouse.up();
                const viaTool = await snapshot(page);
                await page.evaluate(() => InputHandler.exitAttrPaintMode());

                const sources = op === 'copy' ? [[ax + 1, 6], [ax + 2, 6], [ax + 3, 6]] : [A];
                const cells = [];
                for (const c of sources) cells.push(c, ...(await mirrorCells(page, c[0], c[1], sym)));
                await seedDistinct(page);
                await byHand(page, op, cells, A);
                const expected = await snapshot(page);

                const changed = (s) => s.filter((v, i) => v !== before[i]).length;
                expect(changed(expected), `${op} ${sym}: the oracle changes the cells`).toBeGreaterThan(sources.length);
                expect(viaTool, `${op} with Mirror ${sym}: the mirrored cells get the same operation`).toEqual(expected);
                ran++;
            }
            // A drag over both centre cells: each cell is swapped or inverted once, not twice.
            if (op === 'swap' || op === 'invertDots' || op === 'invertBoth') {
                await seedDistinct(page);
                await page.evaluate(() => StateManager.setSymmetryMode('h'));
                await pickCellTool(page, op);
                await page.mouse.move(...atCell(C / 2 - 2, 5));
                await page.mouse.down();
                await page.mouse.move(...atCell(C / 2 + 1, 5), { steps: 8 });
                await page.mouse.up();
                const viaTool = await snapshot(page);
                await page.evaluate(() => InputHandler.exitAttrPaintMode());
                await seedDistinct(page);
                await byHand(page, op, [[C / 2 - 2, 5], [C / 2 - 1, 5], [C / 2, 5], [C / 2 + 1, 5]], null);
                expect(viaTool, `${op}: a drag across the centre changes each cell once`).toEqual(await snapshot(page));
            }
        }
        expect(ran, 'at least one cell tool ran in this mode').toBeGreaterThan(0);
    });
}

test('one Ctrl+Z takes back a mirrored cell-tool drag; Mirror off touches only the cell', async ({ page }) => {
    await boot(page);
    const { atCell } = await canvasPoint(page);
    await seedDistinct(page);
    const before = await snapshot(page);
    await page.evaluate(() => { UndoRedo.clear(); StateManager.setSymmetryMode('quad'); });
    await pickCellTool(page, 'swap');
    await page.mouse.move(...atCell(3, 2)); await page.mouse.down(); await page.mouse.up();
    await page.evaluate(() => InputHandler.exitAttrPaintMode());
    expect((await snapshot(page)).filter((v, i) => v !== before[i]).length, 'four cells swapped').toBe(4);
    await page.keyboard.press('Control+z');
    expect(await snapshot(page)).toEqual(before);

    await page.evaluate(() => StateManager.setSymmetryMode('off'));
    await pickCellTool(page, 'swap');
    await page.mouse.move(...atCell(3, 2)); await page.mouse.down(); await page.mouse.up();
    await page.evaluate(() => InputHandler.exitAttrPaintMode());
    expect((await snapshot(page)).filter((v, i) => v !== before[i]).length, 'Mirror off: one cell').toBe(1);
});

for (const mode of ['standard_ula', 'multicolor_8x1', 'gigascreen']) {
    test(`the Fade brush mirrors exactly in ${mode}`, async ({ page }) => {
        test.setTimeout(90000);
        await boot(page);
        await useMode(page, mode);
        const { at, dims } = await canvasPoint(page);
        for (const dm of ['normal', 'ink', 'attributes']) {
            for (const sym of ['h', 'v', 'quad']) {
                await page.evaluate(([dm, sym]) => {
                    ToolManager.selectTool(TOOLS.FADE); BrushEngine.setSize(6);
                    StateManager.setDrawMode(dm); StateManager.setSymmetryMode(sym);
                }, [dm, sym]);
                await seedSymmetric(page);
                const before = await snapshot(page);
                await page.mouse.move(...at(dims.w * 0.1, dims.h * 0.15));
                await page.mouse.down();
                await page.mouse.move(...at(dims.w * 0.35, dims.h * 0.3), { steps: 12 });
                await page.mouse.up();
                const after = await snapshot(page);
                expect(after.filter((v, i) => v !== before[i]).length, `${dm} ${sym}: the fade drew`).toBeGreaterThan(0);
                expect(await asymmetric(page, sym), `${dm} with Mirror ${sym}: both sides match`).toEqual([]);
            }
        }
    });
}

for (const mode of ['standard_ula', 'gigascreen']) {
    test(`a placed text, a placed stamp and Type on canvas follow Mirror in ${mode}`, async ({ page }) => {
        test.setTimeout(90000);
        await boot(page);
        await useMode(page, mode);
        const { at, dims } = await canvasPoint(page);
        for (const dm of ['normal', 'ink', 'attributes']) {
            for (const sym of ['h', 'v', 'quad']) {
                const label = `${dm} Mirror ${sym}`;
                // Text placed as a stamp.
                await page.evaluate(([dm, sym]) => {
                    ToolManager.selectTool(TOOLS.TEXT); ToolManager.getTool(TOOLS.TEXT).setTypeOnCanvas(false);
                    ToolManager.getTool(TOOLS.TEXT).setText('HI');
                    StateManager.setDrawMode(dm); StateManager.setSymmetryMode(sym);
                }, [dm, sym]);
                await seedSymmetric(page);
                let before = await snapshot(page);
                await page.mouse.move(...at(dims.w * 0.15, dims.h * 0.2));
                await page.waitForTimeout(80);
                await page.mouse.click(...at(dims.w * 0.15, dims.h * 0.2));
                await page.keyboard.press('Enter');
                await page.waitForTimeout(80);
                expect((await snapshot(page)).filter((v, i) => v !== before[i]).length, `text ${label}: placed`).toBeGreaterThan(0);
                expect(await asymmetric(page, sym), `text ${label}: its mirror image is placed too`).toEqual([]);
                await page.keyboard.press('Escape');

                // A pasted stamp.
                await page.evaluate(([dm, sym]) => {
                    if (SelectionService.isFloating()) SelectionService.endFloatingPaste();
                    ToolManager.selectTool(TOOLS.SELECTION);
                    StateManager.setDrawMode(dm); StateManager.setSymmetryMode(sym);
                }, [dm, sym]);
                await seedSymmetric(page);
                before = await snapshot(page);
                await page.evaluate(() => SelectionService.startFloatingPasteFromMask(
                    [[true, true, false, true], [true, false, false, false], [true, true, true, false]], 4, 3, 20, 24, 'Paste'));
                await page.keyboard.press('Enter');
                await page.waitForTimeout(80);
                expect((await snapshot(page)).filter((v, i) => v !== before[i]).length, `stamp ${label}: placed`).toBeGreaterThan(0);
                expect(await asymmetric(page, sym), `stamp ${label}: its mirror image is placed too`).toEqual([]);

                // Type on canvas.
                await page.evaluate(([dm, sym]) => {
                    ToolManager.selectTool(TOOLS.TEXT); ToolManager.getTool(TOOLS.TEXT).setTypeOnCanvas(true);
                    StateManager.setDrawMode(dm); StateManager.setSymmetryMode(sym);
                }, [dm, sym]);
                await seedSymmetric(page);
                before = await snapshot(page);
                await page.mouse.click(...at(dims.w * 0.12, dims.h * 0.2));
                await page.waitForTimeout(120);
                await page.keyboard.type('Ab');
                await page.keyboard.press('Enter');
                await page.waitForTimeout(150);
                expect((await snapshot(page)).filter((v, i) => v !== before[i]).length, `typed ${label}: drawn`).toBeGreaterThan(0);
                expect(await asymmetric(page, sym), `typed ${label}: its mirror image is drawn too`).toEqual([]);
                await page.evaluate(() => ToolManager.getTool(TOOLS.TEXT).setTypeOnCanvas(false));
            }
        }
    });
}

test('the pattern, hatch, spray and round brushes keep a mirrored picture symmetric', async ({ page }) => {
    test.setTimeout(90000);
    await boot(page);
    const { at, dims } = await canvasPoint(page);
    for (const rail of ['pattern', 'hatch', 'spray', 'brush']) {
        await page.click(`#tool-rail button[data-tool="${rail}"]`);
        // The pattern brush has no pattern until one is picked in its panel.
        if (rail === 'pattern') await page.locator('.pattern-item').first().click();
        for (const dm of ['normal', 'ink', 'attributes', 'xor']) {
            for (const sym of ['h', 'quad']) {
                await page.evaluate(([dm, sym]) => {
                    BrushEngine.setSize(8); StateManager.setDrawMode(dm); StateManager.setSymmetryMode(sym);
                }, [dm, sym]);
                await seedSymmetric(page);
                const before = await snapshot(page);
                await page.mouse.move(...at(dims.w * 0.1, dims.h * 0.15));
                await page.mouse.down();
                await page.mouse.move(...at(dims.w * 0.35, dims.h * 0.3), { steps: 10 });
                await page.mouse.up();
                expect((await snapshot(page)).filter((v, i) => v !== before[i]).length, `${rail} ${dm} ${sym}: drew`).toBeGreaterThan(0);
                expect(await asymmetric(page, sym), `${rail} ${dm} with Mirror ${sym}: both sides match`).toEqual([]);
            }
        }
    }
});

test('Flatten bakes a waiting stamp as it is, whatever Mirror is set to', async ({ page }) => {
    await boot(page);
    await seedSymmetric(page);
    const before = await snapshot(page);
    const n = await page.evaluate(() => {
        StateManager.setDrawMode('normal'); StateManager.setSymmetryMode('h');
        SelectionService.startFloatingPasteFromMask([[true, true], [true, false]], 2, 2, 20, 24, 'Paste');
        return SelectionService.commitAllStamps();
    });
    expect(n).toBe(1);
    const after = await snapshot(page);
    const changed = after.map((v, i) => (v !== before[i] ? i : -1)).filter((i) => i >= 0);
    const C = await page.evaluate(() => ZX_SPECTRUM.GRID_COLS);
    expect(changed.length, 'the stamp landed').toBeGreaterThan(0);
    expect(changed.every((i) => i % C < C / 2), 'nothing landed on the mirrored side').toBe(true);
});