'use strict';
/**
 * The fill tool fills the right pixels, and costs little more than drawing
 * them.
 *
 * Found 2026-09-28: a whole-canvas fill took 0.25 s in LAYER2_640 (0.08 s in
 * Standard ULA), about twice the cost of drawing the same pixels. Each pixel
 * built a state object, went through a Set of string-free keys, and read the
 * pattern and two settings by splitting their names. The fill is now judged
 * against plain drawing on THIS machine, so a slow runner cannot fail it.
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

/** Ink pixels on the current layer. */
const inkCount = (page) => page.evaluate(() => {
    let n = 0;
    for (let y = 0; y < ZX_SPECTRUM.HEIGHT; y++) {
        for (let x = 0; x < ZX_SPECTRUM.WIDTH; x++) {
            const s = PixelDrawRoutine.getPixelState(x, y);
            if (s && s.isInk) n++;
        }
    }
    return n;
});

test('fills stop at walls, cross diagonals only when asked, and replace every match when not contiguous', async ({ page }) => {
    await boot(page);
    const r = await page.evaluate(() => {
        const fill = ToolManager.getTool('fill');
        const sel = ColorManager.getCurrentSelection();
        const box = () => {
            LayerManager.reset();
            LayerManager.setCurrentLayer(1);
            // A 20x20 outline missing only its top-left corner pixel: closed
            // to a four-way fill, open to an eight-way one
            for (let i = 10; i < 30; i++) {
                if (i !== 10) PixelDrawRoutine.draw(i, 10, sel, DRAW_MODE.NORMAL);
                PixelDrawRoutine.draw(i, 29, sel, DRAW_MODE.NORMAL);
                if (i !== 10) PixelDrawRoutine.draw(10, i, sel, DRAW_MODE.NORMAL);
                PixelDrawRoutine.draw(29, i, sel, DRAW_MODE.NORMAL);
            }
        };
        const run = (opts) => {
            box();
            fill._contiguous = opts.contiguous; fill._diagonal = opts.diagonal;
            fill._floodFill(20, 20, false);
            let n = 0;
            for (let y = 0; y < ZX_SPECTRUM.HEIGHT; y++) {
                for (let x = 0; x < ZX_SPECTRUM.WIDTH; x++) if (PixelDrawRoutine.getPixelState(x, y).isInk) n++;
            }
            return n;
        };
        const out = {
            inside: run({ contiguous: true, diagonal: false }),
            diagonal: run({ contiguous: true, diagonal: true }),
            everywhere: run({ contiguous: false, diagonal: false })
        };
        fill._contiguous = true; fill._diagonal = false;
        return out;
    });
    const all = 256 * 192;
    expect(r.inside).toBe(75 + 18 * 18);  // the 75 wall pixels and the 18x18 inside
    expect(r.diagonal).toBe(all);          // leaks out through the missing corner
    expect(r.everywhere).toBe(all);        // every paper pixel, inside and out
});

test('a whole-canvas fill costs little more than drawing the same pixels', async ({ page }) => {
    await boot(page);
    // LAYER2_640: the biggest canvas, so the measurement is well above noise
    for (const mode of ['layer2_640']) {
        const r = await page.evaluate((mode) => {
            ScreenModeService.applyModeRaw(mode);
            // Best of five: a stall only ever makes one run slower
            const best = (fn) => {
                let m = Infinity;
                for (let i = 0; i < 5; i++) {
                    LayerManager.reset();
                    LayerManager.setCurrentLayer(1);
                    const t0 = performance.now();
                    fn();
                    m = Math.min(m, performance.now() - t0);
                }
                return m;
            };
            const sel = ColorManager.getCurrentSelection();
            const m = PixelDrawRoutine.resolveUserMode(true);
            const drawOnly = best(() => {
                PixelDrawRoutine.beginBatch();
                for (let y = 0; y < ZX_SPECTRUM.HEIGHT; y++) {
                    for (let x = 0; x < ZX_SPECTRUM.WIDTH; x++) PixelDrawRoutine.draw(x, y, sel, m);
                }
                PixelDrawRoutine.endBatch();
            });
            const fill = best(() => ToolManager.getTool('fill')._floodFill(5, 5, false));
            return { drawOnly, fill };
        }, mode);
        // Measured 2026-09-28: 1.3x after, 2.3x before
        expect(r.fill, mode).toBeLessThan(r.drawOnly * 1.7);
    }
    expect(await inkCount(page)).toBe(640 * 256);
});
