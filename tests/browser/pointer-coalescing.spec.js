'use strict';
/**
 * Preview-only tools take the LAST coalesced sample of a move, not every one.
 *
 * A 1000 Hz mouse delivers ~16 samples per 60 Hz frame, all in one
 * pointermove. For the shape, gradient, bezier, eyedropper and marquee tools
 * each sample used to be a full preview redraw (or pick) that the next one
 * overwrote before anything painted - 85 ms a move for a near-full-canvas
 * rectangle (docs/FIGURES.md section 8, 2026-09-26). Those tools now opt in
 * with ToolBase.coalescesPointerMoves and InputHandler hands them only the
 * last sample. Anything that lays or records something per sample - the
 * brush, the eraser, the lasso - must still see every one, or strokes would
 * gap and lassos would cut corners.
 *
 * Pointer input is a synthetic PointerEvent carrying `coalescedEvents`,
 * dispatched on InputHandler's own target: the real pipeline, minus the hand.
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

/** window.__ptr: fire pointer events at app pixels, with coalesced samples. */
const installPointer = (page) => page.evaluate(() => {
    window.__ptr = {
        ev(type, px, py, extra = {}) {
            const W = InputHandler.inputTarget.ownerDocument.defaultView;
            const r = InputHandler.canvas.getBoundingClientRect();
            return new W.PointerEvent(type, Object.assign({
                bubbles: true, cancelable: true, composed: true,
                pointerId: 1, pointerType: 'mouse', isPrimary: true,
                button: type === 'pointermove' ? -1 : 0,
                buttons: type === 'pointerup' ? 0 : 1,
                pressure: type === 'pointerup' ? 0 : 0.5,
                clientX: r.left + (px + 0.5) * r.width / ZX_SPECTRUM.WIDTH,
                clientY: r.top + (py + 0.5) * r.height / ZX_SPECTRUM.HEIGHT
            }, extra));
        },
        fire(type, px, py, extra) {
            InputHandler.inputTarget.dispatchEvent(this.ev(type, px, py, extra));
        },
        /** One pointermove whose coalesced samples are `points`, in order. */
        move(points) {
            const list = points.map(([x, y]) => this.ev('pointermove', x, y));
            const [lx, ly] = points[points.length - 1];
            InputHandler.inputTarget.dispatchEvent(this.ev('pointermove', lx, ly, { coalescedEvents: list }));
        },
        /** Count the current tool's onPointerMove calls while `fn` runs. */
        countMoves(fn) {
            const tool = ToolManager.getCurrentTool();
            const original = tool.onPointerMove;
            let calls = 0;
            tool.onPointerMove = function (...args) { calls++; return original.apply(this, args); };
            try { fn(); } finally { delete tool.onPointerMove; }
            return calls;
        }
    };
});

/** 16 distinct pixels in a row from (20, 40): what one 1000 Hz event carries. */
const SIXTEEN = Array.from({ length: 16 }, (_, i) => [20 + i * 3, 40]);

test('the rectangle tool previews once per move, and commits what it did before', async ({ page }) => {
    await boot(page);
    await installPointer(page);

    const r = await page.evaluate((samples) => {
        ToolManager.selectTool(TOOLS.RECTANGLE);
        const ink = () => {
            let n = 0;
            for (let y = 0; y < ZX_SPECTRUM.HEIGHT; y++)
                for (let x = 0; x < ZX_SPECTRUM.WIDTH; x++)
                    if (PixelDrawRoutine.getPixelState(x, y)?.isInk) n++;
            return n;
        };
        const [ex, ey] = samples[samples.length - 1];

        __ptr.fire('pointerdown', 5, 5);
        const calls = __ptr.countMoves(() => __ptr.move(samples));
        __ptr.fire('pointerup', ex, ey);
        const coalesced = ink();
        UndoRedo.undo();

        // The same rectangle dragged with one sample per event
        __ptr.fire('pointerdown', 5, 5);
        __ptr.move([[ex, ey]]);
        __ptr.fire('pointerup', ex, ey);
        const single = ink();
        return { calls, coalesced, single };
    }, SIXTEEN);

    expect(r.calls).toBe(1);
    expect(r.coalesced).toBeGreaterThan(0);
    expect(r.coalesced).toBe(r.single);
});

test('a marquee previews once per move; a lasso still records every sample', async ({ page }) => {
    await boot(page);
    await installPointer(page);

    const r = await page.evaluate((samples) => {
        ToolManager.selectTool(TOOLS.SELECTION);
        const tool = ToolManager.getCurrentTool();
        const [ex, ey] = samples[samples.length - 1];

        tool.setSelectMode('rectangle');
        __ptr.fire('pointerdown', 5, 5);
        const marquee = __ptr.countMoves(() => __ptr.move(samples.map(([x, y]) => [x, y + 20])));
        __ptr.fire('pointerup', ex, ey + 20);
        SelectionService.clear();

        tool.setSelectMode('freeform');
        __ptr.fire('pointerdown', 20, 40);
        const lasso = __ptr.countMoves(() => __ptr.move(samples.slice(1)));
        const pathLength = tool._lassoPath.length;
        __ptr.fire('pointerup', ex, ey);
        SelectionService.clear();
        return { marquee, lasso, pathLength };
    }, SIXTEEN);

    expect(r.marquee).toBe(1);
    // The lasso's 15 new samples each reach the tool, and each lands in its path
    expect(r.lasso).toBe(15);
    expect(r.pathLength).toBe(16);
});

test('the brush still receives every sample, so a fast stroke has no gaps', async ({ page }) => {
    await boot(page);
    await installPointer(page);

    const calls = await page.evaluate((samples) => {
        ToolManager.selectTool(TOOLS.BRUSH);
        __ptr.fire('pointerdown', 20, 40);
        const n = __ptr.countMoves(() => __ptr.move(samples.slice(1)));
        __ptr.fire('pointerup', 65, 40);
        return n;
    }, SIXTEEN);

    expect(calls).toBe(15);
});

test('only the tools that merely preview opt in', async ({ page }) => {
    await boot(page);

    const flags = await page.evaluate(() => {
        const of = (id) => ToolManager.getTool(id).coalescesPointerMoves;
        const selection = ToolManager.getTool(TOOLS.SELECTION);
        selection.setSelectMode('freeform');
        const lasso = selection.coalescesPointerMoves;
        selection.setSelectMode('rectangle');
        return {
            rectangle: of(TOOLS.RECTANGLE), gradient: of(TOOLS.GRADIENT), bezier: of(TOOLS.BEZIER),
            eyedropper: of(TOOLS.EYEDROPPER), marquee: of(TOOLS.SELECTION), lasso,
            brush: of(TOOLS.BRUSH), eraser: of(TOOLS.ERASER), spray: of(TOOLS.SPRAY)
        };
    });

    expect(flags).toEqual({
        rectangle: true, gradient: true, bezier: true, eyedropper: true, marquee: true,
        lasso: false, brush: false, eraser: false, spray: false
    });
});
