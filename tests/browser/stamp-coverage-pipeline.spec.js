'use strict';
/**
 * The 1-bit stamp chain runs in the coverage domain and thresholds once.
 *
 * What this pins, and what it deliberately does not.
 *
 * The warp spec checks WIRING only. An earlier draft of this file cited the
 * bench's dComp 21.49 for the boolean warp - that figure was a harness
 * artifact, corrected 2026-08-29: the bench's coverage twin sampled half a
 * pixel away from the function it was twinning, so `current` was scored
 * against a reference out of register with it. Corrected, the shipped warp
 * scores 0.965 and the domain 0.985, dComp 2.44 against 0.97 - real, and far
 * smaller. Quality belongs to the bench; this file checks the pipeline is
 * plumbed to the domain at all.
 *
 * The downscale spec is a REGRESSION guard: nearest sampling already preserves
 * a dither's density, and what would break it is a plain 0.50 threshold, which
 * takes a 25%-dense tile to nothing. That is what `toMaskToned` prevents.
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

const COMPONENTS = `(m) => {
    const h = m.length, w = h ? m[0].length : 0;
    const seen = Array.from({ length: h }, () => new Array(w).fill(false));
    let n = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (!m[y][x] || seen[y][x]) continue;
        n++;
        const stack = [[x, y]];
        seen[y][x] = true;
        while (stack.length) {
            const [cx, cy] = stack.pop();
            for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
                const nx = cx + i, ny = cy + j;
                if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
                if (m[ny][nx] && !seen[ny][nx]) { seen[ny][nx] = true; stack.push([nx, ny]); }
            }
        }
    }
    return n;
}`;

/** A 48x48 stamp of the shipped diagonal-line pattern - 25% dense. */
const DIAGONAL = `() => {
    const e = window.PATTERN_BITMAPS['8x8/diagonal-left'];
    const bin = atob(e.d);
    const bits = [];
    for (let by = 0; by < bin.length; by++)
        for (let bit = 7; bit >= 0; bit--) bits.push((bin.charCodeAt(by) >> bit) & 1);
    return Array.from({ length: 48 }, (_, y) =>
        Array.from({ length: 48 }, (_, x) => !!bits[(y % e.h) * e.w + (x % e.w)]));
}`;

test('a warped stamp is built through the coverage domain, not around it',
    async ({ page }) => {
        await boot(page);

        // This pins the WIRING, and deliberately not a quality number.
        //
        // An earlier version of this spec asserted that a warp must not
        // multiply the connected pieces of a 25%-dense diagonal pattern - it
        // goes from 23 to 179 under arch-up - and that assertion was wrong.
        // arch-up's inverse map is locally a TRANSLATION, so every subsample
        // in a pixel rounds to the same source pixel, coverage comes out
        // binary, and the coverage warp reproduces the boolean one exactly
        // (576 ink, 179 pieces, identical). The fragmentation is what the warp
        // GEOMETRY does - neighbouring columns shift by different amounts and
        // shear the diagonals apart - and no resampling domain can or should
        // undo it.
        //
        // The real gain is edge fidelity against the exact-area answer, and
        // `tools/text-transform-bench.js` is where that is measured: IoU 0.965
        // to 0.985, dComp 2.44 to 0.97 over all nine effects. A browser spec
        // has no ground truth to compare against, so it checks the thing it
        // CAN check - that the live path produces what the domain produces.
        const r = await page.evaluate(([diagonalSrc]) => {
            const mask = eval(diagonalSrc)();
            const out = {};
            for (const effect of ['arch-up', 'wave', 'inflate', 'perspective-top']) {
                const direct = CoverageOps.toMaskToned(
                    CoverageOps.warp(CoverageOps.fromMask(mask), effect));
                SelectionService.startFloatingPasteFromMask(
                    mask, 48, 48, 40, 40, 'bench', null, 'none');
                SelectionService.setStampWarp(effect);
                const live = SelectionService.floatingPaste.pixels;
                SelectionService.cancelFloatingPaste();
                out[effect] = {
                    sameSize: live.length === direct.length &&
                              live[0].length === direct[0].length,
                    same: JSON.stringify(live) === JSON.stringify(direct)
                };
            }
            return out;
        }, [DIAGONAL]);

        for (const [effect, v] of Object.entries(r)) {
            expect(v.sameSize, `${effect}: live box differs from the domain's`).toBe(true);
            expect(v.same, `${effect}: live path is not the domain's output`).toBe(true);
        }
    });

test('a sparse dither pattern survives being scaled down', async ({ page }) => {
    await boot(page);

    const r = await page.evaluate(([diagonalSrc]) => {
        const mask = eval(diagonalSrc)();
        const ink = (m) => m.reduce((n, row) => n + row.filter(Boolean).length, 0);
        SelectionService.startFloatingPasteFromMask(mask, 48, 48, 40, 40, 'bench', null, 'none');
        const before = ink(SelectionService.floatingPaste.pixels);
        SelectionService.setStampScale(0.6, 0.6);
        const fp = SelectionService.floatingPaste;
        const after = ink(fp.pixels);
        const area = fp.width * fp.height;
        SelectionService.cancelFloatingPaste();
        return { before, after, area, srcArea: 48 * 48 };
    }, [DIAGONAL]);

    expect(r.before).toBeGreaterThan(0);
    // A REGRESSION GUARD, not a driver: nearest-neighbour downscaling is a
    // point sample, so it already preserves density (measured 0.25 -> 0.251).
    // What this catches is the coverage pipeline REGRESSING it - a plain 0.50
    // threshold leaves nothing at all, which is what section 7.1 of the design
    // spec is about and why toMaskToned exists. Density, not ink count,
    // because the box shrank too.
    const densityBefore = r.before / r.srcArea;
    const densityAfter = r.after / r.area;
    expect(r.after).toBeGreaterThan(0);
    expect(densityAfter / densityBefore).toBeGreaterThan(0.6);
    expect(densityAfter / densityBefore).toBeLessThan(1.6);
});

test('a quarter turn of pixel artwork is still lossless', async ({ page }) => {
    await boot(page);

    // The domain must not cost the exact cases anything. A 90 degree turn is a
    // pure reindex and has to stay one.
    const r = await page.evaluate(() => {
        const mask = Array.from({ length: 16 }, (_, y) =>
            Array.from({ length: 24 }, (_, x) => ((x * 7 + y * 3) % 5) === 0));
        const ink = (m) => m.reduce((n, row) => n + row.filter(Boolean).length, 0);
        SelectionService.startFloatingPasteFromMask(mask, 24, 16, 40, 40, 'bench', null, 'none');
        SelectionService.setStampRotation(90);
        const turned = SelectionService.floatingPaste;
        const out = { src: ink(mask), turned: ink(turned.pixels), w: turned.width, h: turned.height };
        SelectionService.cancelFloatingPaste();
        return out;
    });

    expect(r.w).toBe(16);
    expect(r.h).toBe(24);
    expect(r.turned).toBe(r.src);
});
