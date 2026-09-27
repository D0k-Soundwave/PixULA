'use strict';
/**
 * A slider stays responsive on a large stamp.
 *
 * The coverage chain is not cheap and the cost is all in the stamp's area.
 * Measured 2026-08-29 through the real path, per slider tick: 0.4 ms at 16x8,
 * 2.3 ms at 120x24 - a typical text stamp - then 10.9 ms at 256x64, 50.9 ms at
 * 400x200 and 96.1 ms at 640x256, which is six dropped frames.
 *
 * The budget is deliberately NOT a hardcoded pixel count: that would be a
 * constant measured on one machine and wrong on every other. The code times
 * its own first pass of a gesture and, if it overruns, drops to the cheap path
 * for the rest of that gesture and takes the exact one on release. A slow
 * machine degrades where a fast one stays exact, which is right on both.
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

test('a gesture on a large stamp degrades instead of dropping frames',
    async ({ page }) => {
        await boot(page);

        const r = await page.evaluate(() => {
            const big = Array.from({ length: 200 }, (_, y) =>
                Array.from({ length: 400 }, (_, x) => ((x + y) % 3) === 0));
            SelectionService.startFloatingPasteFromMask(big, 400, 200, 10, 10, 'bench', null, 'none');

            SelectionService.beginStampGesture();
            const t0 = performance.now();
            for (let d = 5; d <= 40; d += 5) SelectionService.setStampRotation(d);
            const perTick = (performance.now() - t0) / 8;
            const wentCheap = SelectionService.isStampGestureCheap();
            SelectionService.endStampGesture();
            const afterRelease = SelectionService.floatingPaste.pixels.length;

            // The same eight ticks outside a gesture take the exact path every
            // time - this machine's own unbudgeted cost, measured under the
            // same load, instead of a number measured on another computer.
            const t1 = performance.now();
            for (let d = 45; d <= 80; d += 5) SelectionService.setStampRotation(d);
            const exactPerTick = (performance.now() - t1) / 8;
            SelectionService.cancelFloatingPaste();
            return { perTick, exactPerTick, wentCheap, afterRelease };
        });

        // Eight ticks of a 400x200 stamp. The cheap path must cost well under
        // the exact one on the same machine (measured 2026-08-29: ~51 ms
        // exact, under 20 ms cheap - about 40%; half leaves headroom for a
        // loaded CPU). A fixed millisecond bar failed on slower machines.
        expect(r.wentCheap).toBe(true);
        expect(r.perTick).toBeLessThan(r.exactPerTick * 0.5);
        // Releasing recomputes exactly, so the stamp is still the right shape.
        expect(r.afterRelease).toBeGreaterThan(0);
    });

test('a small stamp stays exact for the whole gesture', async ({ page }) => {
    await boot(page);

    // Below the budget nothing changes: the same result during the drag and
    // after release, so there is no visible snap on the stamps most people use.
    // Best of three: the budget is wall-clock (CoverageOps.LIVE_BUDGET_MS,
    // 7 ms) and this stamp's pass takes ~0.4 ms, so only a stalled runner can
    // push one over - which the app then answers, correctly, by going cheap.
    // A real regression overruns every attempt.
    const r = await page.evaluate(() => {
        const tool = ToolManager.getTool(TOOLS.TEXT);
        const m = tool._buildTextMask('AB', 'ZX ROM', false, false, 'horizontal');
        let result = null;
        for (let attempt = 0; attempt < 3; attempt++) {
            SelectionService.startFloatingPasteFromMask(m.pixels, m.width, m.height,
                40, 40, 'bench', null, 'none');
            SelectionService.beginStampGesture();
            SelectionService.setStampRotation(30);
            const during = SelectionService.floatingPaste.pixels.map((r2) => [...r2]);
            const wentCheap = SelectionService.isStampGestureCheap();
            SelectionService.endStampGesture();
            const after = SelectionService.floatingPaste.pixels.map((r2) => [...r2]);
            SelectionService.cancelFloatingPaste();
            result = { same: JSON.stringify(during) === JSON.stringify(after), wentCheap };
            if (!wentCheap) break;
        }
        return result;
    });

    expect(r.wentCheap).toBe(false);
    expect(r.same).toBe(true);
});

test('without a gesture bracket nothing degrades - a single change is exact',
    async ({ page }) => {
        await boot(page);

        // The budget applies to a DRAG. Setting a value once - from a menu, a
        // preset, a restored document - has no gesture around it and must take
        // the exact path however large the stamp is.
        const r = await page.evaluate(() => {
            const big = Array.from({ length: 200 }, (_, y) =>
                Array.from({ length: 400 }, (_, x) => ((x + y) % 3) === 0));
            SelectionService.startFloatingPasteFromMask(big, 400, 200, 10, 10, 'bench', null, 'none');
            SelectionService.setStampRotation(30);
            const cheap = SelectionService.isStampGestureCheap();
            const ink = SelectionService.floatingPaste.pixels
                .reduce((n, row) => n + row.filter(Boolean).length, 0);
            SelectionService.cancelFloatingPaste();
            return { cheap, ink };
        });

        expect(r.cheap).toBe(false);
        expect(r.ink).toBeGreaterThan(0);
    });

test('the Transform panel brackets its sliders', async ({ page }) => {
    await boot(page);

    // The bracket is useless if nothing calls it. pointerdown opens the
    // gesture and `change` closes it - `change` and not `input`, because input
    // fires on every tick and would close the gesture it just opened.
    const r = await page.evaluate(() => {
        const tool = ToolManager.getTool(TOOLS.TEXT);
        const m = tool._buildTextMask('AB', 'ZX ROM', false, false, 'horizontal');
        SelectionService.startFloatingPasteFromMask(m.pixels, m.width, m.height,
            40, 40, 'bench', null, 'none');
        const slider = document.querySelector('.tp-rot');
        const seen = { opened: false, closed: false };
        const realBegin = SelectionService.beginStampGesture.bind(SelectionService);
        const realEnd = SelectionService.endStampGesture.bind(SelectionService);
        SelectionService.beginStampGesture = () => { seen.opened = true; realBegin(); };
        SelectionService.endStampGesture = () => { seen.closed = true; realEnd(); };

        slider.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        slider.value = '30';
        slider.dispatchEvent(new Event('input', { bubbles: true }));
        slider.dispatchEvent(new Event('change', { bubbles: true }));

        SelectionService.beginStampGesture = realBegin;
        SelectionService.endStampGesture = realEnd;
        SelectionService.cancelFloatingPaste();
        return { ...seen, hasSlider: !!slider };
    });

    expect(r.hasSlider).toBe(true);
    expect(r.opened).toBe(true);
    expect(r.closed).toBe(true);
});
