'use strict';
/**
 * Vector text is rasterised from area COVERAGE, not from one alpha sample.
 *
 * `_rasterizeRaw` used to decide each pixel with `data[...+3] > 127`: one
 * sample, at the pixel centre. A typical sans stem is well under a pixel wide
 * at these sizes, so strokes that are unambiguously there scored under half
 * opacity at the centre and vanished. Measured before the fix: ink weight
 * 0.72 of a correct render, and `ZX SPECTRUM` at 16px broken into 8 more
 * connected components than it should have.
 *
 * These specs pin the two properties that would silently rot - stroke weight
 * and connectivity - without asserting exact pixel counts, which depend on the
 * installed font.
 */
const { test, expect } = require('@playwright/test');
const { boot } = require('./helpers');

// The family name must be a SINGLE family. `_rasterizeRaw` builds
// `${size}px "${family}"`, so a CSS-style list like 'Arial, sans-serif' becomes
// one quoted family of that literal name, which no system has - canvas then
// silently falls back to its default serif and the spec measures a font nobody
// asked for. The app is safe because FontProbe.detect() only ever yields single
// names; a test that hand-writes one is not.

/**
 * A spread of the fonts this machine actually has.
 *
 * NOT the first N: `FontProbe.detect()` returns 176 families here in
 * alphabetical order, so `slice(0, 6)` is six sans faces beginning with A and
 * misses every serif - and serifs at small sizes are exactly where both
 * defects these specs guard bite hardest. An even stride across the whole list
 * picks up a representative mix on any font set.
 */
const SPREAD = `(n) => {
    const all = window.FontProbe ? FontProbe.detect() : [];
    if (all.length <= n) return all;
    const step = all.length / n;
    return Array.from({ length: n }, (_, i) => all[Math.floor(i * step)]);
}`;

/** 8-connected components of a bool[][] mask. */
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

test('a word rasterises as one connected piece per word, not in fragments',
    async ({ page }) => {
        await boot(page);

        const r = await page.evaluate(([componentsSrc, spreadSrc]) => {
            const components = eval(componentsSrc);
            const tool = ToolManager.getTool(TOOLS.TEXT);
            // Whatever this machine actually has, spread across the list - a
            // fixed name would fall back silently on a platform without it.
            const families = eval(spreadSrc)(8);
            return families.map((fam) => {
                // Each font is its OWN reference. An absolute bound cannot
                // work across 176 arbitrary families: a script face like Gigi
                // is legitimately disconnected at any size and scored 14 here,
                // which is the font, not the rasteriser. Rendered LARGE the
                // same string has room for every stroke, so its piece count is
                // what this font's text is actually made of.
                const small = tool._rasterizeWithFont('ZX SPECTRUM', fam,
                    16, false, false, 'horizontal');
                const large = tool._rasterizeWithFont('ZX SPECTRUM', fam,
                    96, false, false, 'horizontal');
                if (!small || !large) return null;
                return { fam, small: components(small.pixels), large: components(large.pixels) };
            }).filter(Boolean);
        }, [COMPONENTS, SPREAD]);

        expect(r.length).toBeGreaterThan(0);
        // Shrinking text may MERGE strokes, never multiply them. Measured
        // against the old single-sample rasteriser 2026-08-29: Arial 17 pieces
        // at 16px against 10 large, Times New Roman 19, Georgia 17 - each
        // roughly double its own reference. Allowing 1.4x leaves room for a
        // hairline parting at a join and still catches that.
        for (const f of r) {
            expect(f.small, `${f.fam}: ${f.small} pieces at 16px against ${f.large} at 96px`)
                .toBeLessThanOrEqual(Math.ceil(f.large * 1.4) + 1);
        }
    });

test('stroke weight survives - a coverage decision inks what a centre sample missed',
    async ({ page }) => {
        await boot(page);

        const r = await page.evaluate(() => {
            const tool = ToolManager.getTool(TOOLS.TEXT);
            const ink = (m) => m.pixels.reduce((n, row) => n + row.filter(Boolean).length, 0);

            // A high-resolution render of the same string, thresholded the same
            // way, is the reference: it has enough pixels that a centre sample
            // and a coverage measure agree. Scaling its ink down by the area
            // ratio gives what the small render SHOULD weigh.
            const weigh = (text) => {
                const small = tool._rasterizeWithFont(text, 'Arial',
                    16, false, false, 'horizontal');
                const large = tool._rasterizeWithFont(text, 'Arial',
                    128, false, false, 'horizontal');
                const areaRatio = (small.width * small.height) / (large.width * large.height);
                return ink(small) / (ink(large) * areaRatio);
            };
            // 'IIII' is four bare stems and nothing else. A mixed string is a
            // poor probe here: measured 2026-08-29 against the OLD rasteriser,
            // 'Hamburgefonstiv' weighs 0.925 - its bowls and crossbars are wide
            // enough to survive a centre sample and they mask the loss - while
            // 'IIII' weighs 0.811. The defect is specifically that THIN strokes
            // vanish, so the probe has to be thin strokes.
            return { stems: weigh('IIII'), mixed: weigh('Hamburgefonstiv') };
        });

        // Floor calibrated from that measurement: 0.811 before the fix, and a
        // coverage decision should put the stems back. The ceiling catches the
        // opposite failure - a threshold low enough to fatten every letterform.
        expect(r.stems).toBeGreaterThan(0.90);
        expect(r.stems).toBeLessThan(1.15);
        // And thin strokes must not be systematically worse off than mixed
        // ones, which is the shape of the defect rather than its size.
        expect(r.stems / r.mixed).toBeGreaterThan(0.95);
    });

test('an empty or whitespace string still returns null rather than a blank mask',
    async ({ page }) => {
        await boot(page);

        const r = await page.evaluate(() => {
            const tool = ToolManager.getTool(TOOLS.TEXT);
            return {
                empty: tool._rasterizeWithFont('', 'Arial', 16, false, false, 'horizontal'),
                space: tool._rasterizeWithFont('   ', 'Arial', 16, false, false, 'horizontal')
            };
        });

        expect(r.empty).toBeNull();
        expect(r.space).toBeNull();
    });

test('render-through returns a coverage buffer filling the box it was given',
    async ({ page }) => {
        await boot(page);

        const r = await page.evaluate(() => {
            const tool = ToolManager.getTool(TOOLS.TEXT);
            const box = { w: 64, h: 48 };
            const cov = tool._renderThrough('Ag', 'Arial', 24, 0, box);
            return {
                w: cov.w, h: cov.h,
                len: cov.data.length,
                isF32: cov.data instanceof Float32Array,
                area: CoverageOps.area(cov),
                max: Math.max(...cov.data),
                min: Math.min(...cov.data)
            };
        });

        expect(r.w).toBe(64);
        expect(r.h).toBe(48);
        expect(r.len).toBe(64 * 48);
        expect(r.isF32).toBe(true);
        expect(r.area).toBeGreaterThan(0);
        // Coverage is a fraction, always
        expect(r.max).toBeLessThanOrEqual(1);
        expect(r.min).toBeGreaterThanOrEqual(0);
    });

test('rotating through the transform keeps the ink instead of eroding it',
    async ({ page }) => {
        await boot(page);

        const r = await page.evaluate(() => {
            const tool = ToolManager.getTool(TOOLS.TEXT);
            const box = { w: 96, h: 96 };
            const at = (deg) => CoverageOps.area(
                tool._renderThrough('HELLO', 'Arial', 20, deg, box));
            return { a0: at(0), a15: at(15), a45: at(45), a90: at(90) };
        });

        // A rotation moves ink, it does not consume it. Resampling a
        // thresholded raster loses several percent per generation; rasterising
        // through the matrix should hold to within the box's own rounding.
        for (const a of [r.a15, r.a45, r.a90]) {
            expect(a / r.a0).toBeGreaterThan(0.92);
            expect(a / r.a0).toBeLessThan(1.08);
        }
    });

test('the ink is centred on the box, not hung off the em baseline',
    async ({ page }) => {
        await boot(page);

        // textBaseline centres on the em box and the rest of the pipeline
        // centres on ink; the gap between those is several pixels of pure
        // misalignment that would read as the stamp jumping when engaged.
        const r = await page.evaluate(() => {
            const tool = ToolManager.getTool(TOOLS.TEXT);
            const box = { w: 80, h: 80 };
            const cov = tool._renderThrough('x', 'Arial', 24, 0, box);
            let sx = 0, sy = 0, total = 0;
            for (let y = 0; y < cov.h; y++) {
                for (let x = 0; x < cov.w; x++) {
                    const v = CoverageOps.get(cov, x, y);
                    sx += x * v; sy += y * v; total += v;
                }
            }
            return { cx: sx / total, cy: sy / total, mid: 40 };
        });

        // An 'x' is symmetric, so its centre of ink should sit near the box
        // centre on both axes. A baseline-centred draw puts it several pixels
        // high.
        expect(Math.abs(r.cx - r.mid)).toBeLessThan(3);
        expect(Math.abs(r.cy - r.mid)).toBeLessThan(3);
    });

test('render-through at 0 degrees agrees with the untransformed rasteriser',
    async ({ page }) => {
        await boot(page);

        // Two rasterisers for one job is exactly the drift this repo keeps
        // eliminating. They are allowed to exist separately only while they
        // agree; this is what makes that checkable.
        const r = await page.evaluate(() => {
            const tool = ToolManager.getTool(TOOLS.TEXT);
            const ink = (m) => m.reduce((n, row) => n + row.filter(Boolean).length, 0);
            const flat = tool._rasterizeWithFont('Hamburg', 'Arial',
                24, false, false, 'horizontal');
            const box = { w: flat.width + 8, h: flat.height + 8 };
            // GLYPH_COVERAGE, not the default: this is a glyph, and the
            // unbiased area cut is for 1-bit artwork.
            const through = CoverageOps.toMask(
                tool._renderThrough('Hamburg', 'Arial', 24, 0, box),
                CoverageOps.GLYPH_COVERAGE);
            return { flatInk: ink(flat.pixels), throughInk: ink(through) };
        });

        expect(r.throughInk / r.flatInk).toBeGreaterThan(0.92);
        expect(r.throughInk / r.flatInk).toBeLessThan(1.08);
    });

test('a rotated system-font stamp keeps its ink through the live pipeline',
    async ({ page }) => {
        await boot(page);

        const r = await page.evaluate(() => {
            const tool = ToolManager.getTool(TOOLS.TEXT);
            const ink = (px) => px.reduce((n, row) => n + row.filter(Boolean).length, 0);
            const mask = tool._rasterizeWithFont('HELLO', 'Arial',
                24, false, false, 'horizontal');
            SelectionService.startFloatingPasteFromMask(
                mask.pixels, mask.width, mask.height, 40, 40, 'Place Text',
                { text: 'HELLO', fontFamily: 'Arial', fontSize: 24,
                  bold: false, italic: false, layout: 'horizontal' },
                'none');

            const flat = ink(SelectionService.floatingPaste.pixels);
            SelectionService.setStampRotation(45);
            const turned = ink(SelectionService.floatingPaste.pixels);
            SelectionService.setStampRotation(0);
            const back = ink(SelectionService.floatingPaste.pixels);
            SelectionService.cancelFloatingPaste();
            return { flat, turned, back };
        });

        expect(r.flat).toBeGreaterThan(0);
        // Thresholded ink varies with ANGLE and that is a property, not a
        // fault: at 0 and 90 degrees stems line up with the pixel grid, and at
        // 45 the same coverage spreads over more pixels with some falling under
        // the cut. Measured 2026-08-29 on render-through, Arial 24px: 548 ink
        // at 0 degrees, 478 at 15 and 30, 458 at 45, 487 at 90 - while the
        // CONTINUOUS area is invariant to the digit (410 at every angle). So
        // the floor is 0.82, not 0.90; the old resampling path is what this
        // still catches, having lost ink AND shattered the letterforms.
        expect(r.turned / r.flat).toBeGreaterThan(0.82);
        expect(r.turned / r.flat).toBeLessThan(1.12);
        // Rotating away and back rebuilds from the font, so it must return
        expect(r.back / r.flat).toBeGreaterThan(0.95);
    });

test('rotating a stamp does not shatter the letterforms', async ({ page }) => {
    await boot(page);

    // Ink count is a weak proxy - a resampled rotation can hold its weight and
    // still break every stroke. Connectivity is what actually degrades, and it
    // shows on SERIFS at small sizes: measured 2026-08-29, Times New Roman at
    // 16px went from 10 pieces upright to 19 after a resampled 45 degree turn,
    // against 9 when the glyph is rasterised already-turned.
    const r = await page.evaluate(([componentsSrc, spreadSrc]) => {
        const components = eval(componentsSrc);
        const tool = ToolManager.getTool(TOOLS.TEXT);
        const families = eval(spreadSrc)(8);
        return families.map((fam) => {
            const m = tool._rasterizeWithFont('ZX SPECTRUM', fam,
                16, false, false, 'horizontal');
            if (!m) return null;
            SelectionService.startFloatingPasteFromMask(
                m.pixels, m.width, m.height, 40, 40, 'Place Text',
                { text: 'ZX SPECTRUM', fontFamily: fam, fontSize: 16,
                  bold: false, italic: false, layout: 'horizontal' }, 'none');
            SelectionService.setStampRotation(45);
            const turned = components(SelectionService.floatingPaste.pixels);
            SelectionService.cancelFloatingPaste();
            return { fam, flat: components(m.pixels), turned };
        }).filter(Boolean);
    }, [COMPONENTS, SPREAD]);

    expect(r.length).toBeGreaterThan(0);
    for (const f of r) {
        // A turn moves the letterforms; it must not multiply them. 1.3x leaves
        // room for a stroke legitimately parting at a corner and still catches
        // the 1.9x a resampled serif produced.
        expect(f.turned, `${f.fam}: ${f.flat} pieces upright, ${f.turned} at 45 degrees`)
            .toBeLessThanOrEqual(Math.ceil(f.flat * 1.3));
    }
});

test('the text tool Direction and the Transform slider agree at the same angle',
    async ({ page }) => {
        await boot(page);

        // Both controls say "rotate this text". If only one of them reaches
        // the font engine they disagree about sharpness at the same angle,
        // which is the objection that collapsed _rotateMask into MaskOps.
        const r = await page.evaluate(() => {
            const tool = ToolManager.getTool(TOOLS.TEXT);
            const ink = (px) => px.reduce((n, row) => n + row.filter(Boolean).length, 0);
            const place = (info) => {
                const m = tool._rasterizeWithFont(info.text, info.fontFamily,
                    info.fontSize, false, false, 'horizontal');
                SelectionService.startFloatingPasteFromMask(
                    m.pixels, m.width, m.height, 40, 40, 'Place Text', info, 'none');
            };
            const base = { text: 'HELLO', fontFamily: 'Arial',
                fontSize: 24, bold: false, italic: false, layout: 'horizontal' };

            // setStampRotation(0) is what forces the recompute - creating the
            // stamp does not run the transform chain, so reading it straight
            // after `place` measures the raw raster and compares nothing.
            place({ ...base, direction: 45 });
            SelectionService.setStampRotation(0);
            const viaDirection = ink(SelectionService.floatingPaste.pixels);
            SelectionService.cancelFloatingPaste();

            place({ ...base, direction: 0 });
            SelectionService.setStampRotation(45);
            const viaSlider = ink(SelectionService.floatingPaste.pixels);
            SelectionService.cancelFloatingPaste();

            return { viaDirection, viaSlider };
        });

        expect(r.viaDirection).toBeGreaterThan(0);
        // The same angle by either route must weigh the same
        expect(r.viaDirection / r.viaSlider).toBeGreaterThan(0.92);
        expect(r.viaDirection / r.viaSlider).toBeLessThan(1.09);
    });

test('direction and the slider compose rather than cancelling or doubling',
    async ({ page }) => {
        await boot(page);

        const r = await page.evaluate(() => {
            const tool = ToolManager.getTool(TOOLS.TEXT);
            const box = () => {
                const fp = SelectionService.floatingPaste;
                return { w: fp.width, h: fp.height };
            };
            const m = tool._rasterizeWithFont('HELLO', 'Arial',
                24, false, false, 'horizontal');
            SelectionService.startFloatingPasteFromMask(m.pixels, m.width, m.height,
                40, 40, 'Place Text',
                { text: 'HELLO', fontFamily: 'Arial', fontSize: 24,
                  bold: false, italic: false, layout: 'horizontal', direction: 90 },
                'none');
            // Creating the stamp does NOT run the transform chain - the box is
            // still the raw raster until something recomputes it. Setting the
            // rotation to 0 is that trigger, and leaves direction as the only
            // rotation in play.
            SelectionService.setStampRotation(0);
            const at90 = box();
            // direction 90 + slider -90 is upright again: a WIDE box, not tall
            SelectionService.setStampRotation(-90);
            const composed = box();
            SelectionService.cancelFloatingPaste();
            return { at90, composed };
        });

        // 'HELLO' is wider than it is tall upright, and the reverse at 90.
        expect(r.at90.h).toBeGreaterThan(r.at90.w);
        expect(r.composed.w).toBeGreaterThan(r.composed.h);
    });
