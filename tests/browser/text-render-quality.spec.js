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

        const r = await page.evaluate(([componentsSrc]) => {
            const components = eval(componentsSrc);
            const tool = ToolManager.getTool(TOOLS.TEXT);
            // Whatever this machine actually has, not a hardcoded list - the
            // defect is worst on serifs and a fixed name would fall back
            // silently on a platform without it. Five is enough to catch a
            // regression without turning this into a font survey.
            const families = (window.FontProbe ? FontProbe.detect() : []).slice(0, 5);
            return families.map((fam) => {
                const m = tool._rasterizeWithFont('ZX SPECTRUM', fam,
                    16, false, false, 'horizontal');
                return { fam, comps: m ? components(m.pixels) : -1 };
            });
        }, [COMPONENTS]);

        expect(r.length).toBeGreaterThan(0);
        // 10 drawable glyphs, so 10 is the ideal and touching letters push it
        // BELOW that - only fragmentation pushes it above. Measured against the
        // old single-sample rasteriser 2026-08-29: Arial 17, Times New Roman
        // 19, Georgia 17 at this size, against 9-10 now. 13 sits clear of the
        // new figure and well under every old one.
        for (const f of r) {
            expect(f.comps, `${f.fam} fragmented into ${f.comps} pieces`).toBeGreaterThan(0);
            expect(f.comps, `${f.fam} fragmented into ${f.comps} pieces`).toBeLessThanOrEqual(13);
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
