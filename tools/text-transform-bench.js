'use strict';
/*
 * text-transform-bench.js - the yardstick for stamp transform pipelines.
 *
 *     node tools/text-transform-bench.js [--write outDir] [--detail]
 *
 * WHY THIS EXISTS. Nothing about a rasteriser is obvious enough to change on
 * reasoning alone here: three plausible improvements to the palette pipeline
 * were tried on 2026-08-08 and all three made the picture WORSE. No change to
 * the stamp path lands without a before/after from this tool, exactly as
 * palette-bench.js gates the other one.
 *
 * It has already earned that. The theory it was built to test - that the loss
 * is the repeated resampling of a binary mask - was REJECTED by its own first
 * run: `coverage-16/50`, the finest resample it can perform on the shipped
 * raster, scores 0.311 where the crudest scores 0.309. Sixteen-times
 * supersampling of a binary source buys 0.002, because the information was
 * destroyed at threshold time and no resampler can put it back.
 *
 * FOUR SUITES, because the answer is different for each and one blended
 * average hides all of them:
 *
 *   zx     ZX ROM glyphs. A 1-bit source with no finer form, scaled by an
 *          exact integer - so all the loss is in the rotation.
 *   art    Pasted artwork: the real shipped pattern library tiled,
 *          ShapeGenerator's own rasters, and a noise field. What most stamps
 *          actually are. Includes the 0.6x DOWNSCALE, where nearest sampling
 *          does not thin a stroke, it deletes it.
 *   warp   All nine warp effects, mirroring `SelectionService.
 *          _applyWarpEffect`'s inverse maps line for line so a disagreement
 *          is about sampling and never about a different curve.
 *   sys    A vector font, where the glyph HAS a finer form and can therefore
 *          be rasterised through the transform instead of resampled.
 *
 * GROUND TRUTH is the best answer the medium allows: the finest available form
 * of the source, transformed by exact area coverage at 16x16 subsamples per
 * output pixel, thresholded once at 0.50. The 0-degree control reads 1.000 for
 * every bitmap pipeline, and that is what licenses reading the rest - when it
 * did not, the harness was wrong and the numbers meant nothing.
 *
 * WHAT IT MEASURES, and why an overlap score is not enough on its own. IoU is
 * dominated by the bulk of a shape, so a pipeline that keeps 96% of the ink
 * while snapping a crossbar scores WELL and reads as broken:
 *
 *   IoU     intersection over union against ground truth, after a +/-3px
 *           alignment search so a half-pixel offset is not scored as damage.
 *   dComp   change in the number of 8-connected ink components. THE BREAKAGE
 *           number, and the one to read FIRST: an 'E' whose bars have parted
 *           company goes from 1 to 3, and no overlap score notices.
 *   dHole   change in enclosed background regions - counters filling in.
 *           Meaningful for letterforms; NOISE for a dither field, which has
 *           hundreds of legitimate holes, so read it per suite.
 *   tone    candidate ink over the ground truth's CONTINUOUS area. The
 *           denominator is deliberately not the thresholded truth, which is
 *           empty for any pattern too sparse to reach half coverage anywhere -
 *           dividing by that produced ratios of 576 and hid a real finding.
 *   gone    cases where a non-empty source produced a COMPLETELY BLANK stamp.
 *           Never acceptable, and no average may absorb it.
 *
 * THE FINDING THAT `gone` EXISTS FOR. Area coverage with a flat 0.50 cut
 * DELETES sparse fine patterns on downscale: a 25%-dense diagonal tile shrunk
 * to 60% never reaches a half anywhere, so the correct-by-that-definition
 * answer is nothing at all. That matters here more than in most apps, because
 * dither patterns ARE this app's shading system. Bayer dithering the coverage
 * preserves the tone but wrecks shape (dHole 63 against 3.6). Per-line dropout
 * rescue, borrowed from FontRasterizer, fixes it but misfires on artwork,
 * where a blank row is usually just background. The guard that works is the
 * narrow one: threshold plainly, and dither ONLY when the whole stamp came
 * back blank from a source that was not - measurably identical to plain
 * coverage on every shape metric, with `gone` at zero.
 *
 * TWO TRAPS THIS TOOL CANNOT SCORE ITS WAY OUT OF. Read the sheets.
 *
 * 1. THE GROUND TRUTH SHARES THE CANDIDATE'S BIAS on sparse sources. Truth is
 *    area coverage cut at 0.50, so where a stretched or shrunk texture falls
 *    below a half everywhere, truth says "nothing" and a candidate that also
 *    says "nothing" scores 0.96. The arch-up sheet for pattern/diagonal-left
 *    shows what that hides: `current` carries the pattern across the whole
 *    arch, and every coverage pipeline drops its right-hand half. IoU cannot
 *    see it because both sides of the comparison make the same mistake.
 *
 * 2. A METRIC-PERFECT CANDIDATE CAN BE UNUSABLE. `cov-8/guard` - threshold
 *    plainly, dither only when the whole stamp came back blank - ties plain
 *    coverage on every shape metric and takes `gone` to zero, which is a clean
 *    sweep. The downscale sheet shows it is blank at 0, 15, 30 and 60 degrees
 *    and a dense field at 45: the guard fires on a knife edge, so the output
 *    is DISCONTINUOUS in the angle. On a slider that is a pattern flickering
 *    in and out. Rejected on the sheet alone.
 *
 * WHAT TRAP 1 MEANS FOR TUNING. `tone-8/.10` scores BELOW plain coverage on
 * the artwork and warp suites (0.941 vs 0.958, 0.884 vs 0.960) and is
 * nonetheless the better pipeline: the sheets show it restoring the arch's
 * right-hand half and the downscaled diagonal pattern that plain coverage
 * deletes, and truth deletes them too, so putting them back is scored as
 * error. IoU here is a regression guard, not an optimisation target. Tune the
 * local-tone rule on the sheets; use the numbers only to check that the glyph
 * suites have not moved (they must stay at 0.994 - the rule is designed to be
 * a no-op there, and a drop means it has started firing where it should not).
 *
 * Contact sheets are written as PNGs with --write, because the metric has been
 * wrong here before and the eye is the tiebreak - it was the contact sheet
 * that confirmed RotSprite bevels an UNROTATED glyph, both traps above, and
 * the local-tone rule that resolved them.
 */
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const APP_URL = pathToFileURL(path.resolve(__dirname, '..', 'index.html')).href;

const args = process.argv.slice(2);
const DETAIL = args.includes('--detail');
const writeAt = args.indexOf('--write');
const OUT_DIR = writeAt >= 0 ? args[writeAt + 1] : null;

/* ── The bench, as it runs inside the page ─────────────────────────────────
 * Everything below the marker is stringified and evaluated in Chrome, where
 * canvas and the app's own MaskOps/TextTool live. It returns numbers and PNG
 * data URLs only - never masks, which would be megabytes over the bridge.
 */
function inPage(config) {
    const { STRINGS, ANGLES, ZX_SIZES, SYS_SIZES, SYS_SCALES, ART_SCALES, WARPS, SYS_FONT } = config;

    // ── mask primitives ───────────────────────────────────────────────────
    const size = (m) => ({ w: m.length ? m[0].length : 0, h: m.length });
    const blank = (w, h) => Array.from({ length: h }, () => new Array(w).fill(false));
    const inkOf = (m) => m.reduce((n, r) => n + r.filter(Boolean).length, 0);

    /**
     * The output box a transform needs: the source's box scaled, then its
     * corners turned. Every pipeline targets the SAME box so the comparison
     * is about sampling and nothing else.
     */
    function targetBox(w, h, sx, sy, deg) {
        const rad = deg * Math.PI / 180;
        const c = Math.abs(Math.cos(rad)), s = Math.abs(Math.sin(rad));
        const sw = Math.max(1, Math.round(w * sx)), sh = Math.max(1, Math.round(h * sy));
        return { w: Math.max(1, Math.ceil(sw * c + sh * s)), h: Math.max(1, Math.ceil(sw * s + sh * c)) };
    }

    /**
     * The single composed inverse map every candidate but `current` uses:
     * output pixel -> source pixel, scale and rotation folded into one step
     * so there is only ever one generation of resampling.
     *
     * `ss` subsamples per axis; with ss = 1 this is plain nearest-neighbour.
     * Returns COVERAGE in 0..1, leaving the threshold to the caller - which
     * is the whole point, since thresholding early is what the current chain
     * does wrong.
     */
    // `sx`/`sy` are the OUTPUT-over-SOURCE ratio, so a source that has been
    // made N times finer (ground truth, rotsprite) passes sx / N, not sx * N.
    function coverageMap(src, srcW, srcH, sx, sy, deg, box, ss) {
        const rad = deg * Math.PI / 180;
        const cos = Math.cos(rad), sin = Math.sin(rad);
        const out = Array.from({ length: box.h }, () => new Array(box.w).fill(0));
        const step = 1 / ss, base = step / 2, n = ss * ss;

        for (let dy = 0; dy < box.h; dy++) {
            for (let dx = 0; dx < box.w; dx++) {
                let hits = 0;
                for (let j = 0; j < ss; j++) {
                    const v = dy + base + j * step - box.h / 2;
                    for (let i = 0; i < ss; i++) {
                        const u = dx + base + i * step - box.w / 2;
                        // un-rotate (matches MaskOps.rotateFree), then un-scale
                        const xr =  u * cos + v * sin;
                        const yr = -u * sin + v * cos;
                        const px = Math.floor(xr / sx + srcW / 2);
                        const py = Math.floor(yr / sy + srcH / 2);
                        if (px >= 0 && px < srcW && py >= 0 && py < srcH && src[py][px]) hits++;
                    }
                }
                out[dy][dx] = hits / n;
            }
        }
        return out;
    }

    const threshold = (cov, t) => cov.map(row => row.map(v => v >= t));

    /**
     * 8x8 ordered (Bayer) threshold. Where a flat cut asks "is this pixel more
     * than half covered", this asks "over this neighbourhood, how much ink
     * should there be" - so a 25% pattern shrunk below the point where any
     * single pixel is half covered still comes out as a 25% field instead of
     * as nothing at all. That is the whole premise of the pattern library's
     * density ramp, applied to resampling.
     */
    const BAYER8 = (() => {
        const m = [[0]];
        let g = m;
        for (let k = 1; k < 4; k++) {
            const n = g.length, out = [];
            for (let y = 0; y < n * 2; y++) out.push(new Array(n * 2).fill(0));
            for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
                const v = g[y][x] * 4;
                out[y][x] = v; out[y][x + n] = v + 2;
                out[y + n][x] = v + 3; out[y + n][x + n] = v + 1;
            }
            g = out;
        }
        return g;   // 8x8, values 0..63
    })();
    const dither = (cov) => cov.map((row, y) =>
        row.map((v, x) => v > (BAYER8[y & 7][x & 7] + 0.5) / 64));

    /**
     * Dropout rescue, lifted from `FontRasterizer._rescueDropouts` rather than
     * reinvented - a row or column carrying real coverage but NO ink at all
     * inks the cells at its own local maximum. It only ever fires where the
     * plain threshold produced nothing, so it can put back a stroke that
     * vanished but never thicken one that came out fine.
     *
     * The constants are that function's own measured values (2026-08-19).
     */
    /**
     * The targeted version: threshold plainly, and fall back to an ordered
     * dither ONLY when the whole stamp came back blank from a source that was
     * not. Per-line rescue misfires on artwork, where a blank row is usually
     * just background; "the entire stamp vanished" is never legitimate, so a
     * guard on that one condition costs nothing anywhere else.
     */
    function guarded(cov, t, srcHadInk) {
        const out = threshold(cov, t);
        if (!srcHadInk) return out;
        if (out.some(row => row.some(Boolean))) return out;
        return dither(cov);
    }

    /**
     * Floyd-Steinberg error diffusion over the coverage map, serpentine.
     *
     * The reason to try it where Bayer failed: it is SELF-SELECTING. A solid
     * interior is coverage 1 and background is coverage 0, so there is no
     * error to carry and it behaves exactly like a plain 0.50 threshold - the
     * letterform case. It only does anything where coverage is genuinely
     * fractional, which is edges and, crucially, a downscaled dither field
     * whose every pixel sits at 0.25. One rule, both jobs, no classifier.
     *
     * Serpentine because a left-to-right-only scan drags error consistently
     * one way and leaves a visible directional grain.
     */
    function errorDiffuse(cov, t) {
        const h = cov.length, w = h ? cov[0].length : 0;
        const buf = cov.map(row => row.slice());
        const out = Array.from({ length: h }, () => new Array(w).fill(false));
        const add = (y, x, e) => { if (y >= 0 && y < h && x >= 0 && x < w) buf[y][x] += e; };
        for (let y = 0; y < h; y++) {
            const ltr = (y & 1) === 0;
            for (let k = 0; k < w; k++) {
                const x = ltr ? k : w - 1 - k;
                const v = buf[y][x];
                const on = v >= t;
                out[y][x] = on;
                const err = v - (on ? 1 : 0);
                const fwd = ltr ? 1 : -1;
                add(y,     x + fwd,     err * 7 / 16);
                add(y + 1, x - fwd,     err * 3 / 16);
                add(y + 1, x,           err * 5 / 16);
                add(y + 1, x + fwd,     err * 1 / 16);
            }
        }
        return out;
    }

    /**
     * LOCAL TONE CORRECTION - the unified rule.
     *
     * The trigger is not "is the transform compressing" (a downscaled glyph
     * compresses too, and dithering one is exactly what must not happen) but
     * "did the threshold LOSE TONE HERE", which distinguishes the two cases
     * directly. Over a window: a glyph's interior is coverage 1 and stays
     * inked, its background is 0 and stays empty, and the edge band roughly
     * balances - the deficit is near zero and nothing is touched. A 25% dither
     * field is 0.25 in every pixel and thresholds to nothing - the deficit is
     * the whole tone, and only there does the rule act.
     *
     * Pixels are put back in order of COVERAGE, not in Bayer order, so the
     * restored texture follows the artwork's own geometry. Bayer replaced a
     * checkerboard with its own weave (see the density-50 sheet); ranking by
     * coverage keeps the diagonal a diagonal. Ties - a uniform field, where
     * every pixel has identical coverage - break on Bayer order, which is what
     * scatters the selection instead of clumping it into the top-left.
     *
     * @param win      window edge in px (8 = one ZX cell)
     * @param tolFrac  tone error, as a fraction of the window, that must be
     *                 exceeded before anything is touched
     */
    function toneCorrect(cov, t, win, tolFrac) {
        const h = cov.length, w = h ? cov[0].length : 0;
        const out = threshold(cov, t);
        const jitter = (y, x) => (63 - BAYER8[y & 7][x & 7]) / 63 * 1e-3;
        for (let wy = 0; wy < h; wy += win) {
            for (let wx = 0; wx < w; wx += win) {
                const cells = [];
                let area = 0, inked = 0;
                for (let y = wy; y < Math.min(h, wy + win); y++) {
                    for (let x = wx; x < Math.min(w, wx + win); x++) {
                        cells.push([y, x]);
                        area += cov[y][x];
                        if (out[y][x]) inked++;
                    }
                }
                if (!cells.length) continue;
                const deficit = area - inked;
                const tol = Math.max(1, tolFrac * cells.length);
                if (Math.abs(deficit) <= tol) continue;
                if (deficit > 0) {
                    const cand = cells.filter(([y, x]) => !out[y][x]).sort((a, b) =>
                        (cov[b[0]][b[1]] + jitter(b[0], b[1])) - (cov[a[0]][a[1]] + jitter(a[0], a[1])));
                    let need = Math.round(deficit);
                    for (let i = 0; i < cand.length && need > 0; i++, need--) out[cand[i][0]][cand[i][1]] = true;
                } else {
                    const cand = cells.filter(([y, x]) => out[y][x]).sort((a, b) =>
                        (cov[a[0]][a[1]] - jitter(a[0], a[1])) - (cov[b[0]][b[1]] - jitter(b[0], b[1])));
                    let need = Math.round(-deficit);
                    for (let i = 0; i < cand.length && need > 0; i++, need--) out[cand[i][0]][cand[i][1]] = false;
                }
            }
        }
        return out;
    }

    const RESCUE_COVERAGE = 0.25, RESCUE_NEAR_MAX = 0.9;
    function rescue(cov, t) {
        const out = threshold(cov, t);
        const h = cov.length, w = h ? cov[0].length : 0;
        const line = (cells) => {
            let max = 0;
            for (const [y, x] of cells) {
                if (out[y][x]) return;              // the line already has ink
                if (cov[y][x] > max) max = cov[y][x];
            }
            if (max < RESCUE_COVERAGE) return;
            for (const [y, x] of cells) if (cov[y][x] >= max * RESCUE_NEAR_MAX) out[y][x] = true;
        };
        for (let y = 0; y < h; y++) line(Array.from({ length: w }, (_, x) => [y, x]));
        for (let x = 0; x < w; x++) line(Array.from({ length: h }, (_, y) => [y, x]));
        return out;
    }

    // ── the scalers ───────────────────────────────────────────────────────

    /** Nearest upscale by an integer factor. */
    function nearestUp(m, f) {
        const { w, h } = size(m);
        const out = blank(w * f, h * f);
        for (let y = 0; y < h * f; y++)
            for (let x = 0; x < w * f; x++)
                out[y][x] = m[(y / f) | 0][(x / f) | 0];
        return out;
    }

    /**
     * Scale3x / EPX - the shape-preserving upscale RotSprite is built on. It
     * rounds a corner only where the neighbourhood agrees there IS one, so a
     * straight edge upscales to a straight edge instead of a staircase that
     * the following rotation then re-staircases.
     */
    function scale3x(m) {
        const { w, h } = size(m);
        const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? false : m[y][x];
        const out = blank(w * 3, h * 3);
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const A = at(x, y - 1), B = at(x + 1, y), C = at(x, y + 1), D = at(x - 1, y);
                const E = at(x, y);
                const A1 = at(x - 1, y - 1), A3 = at(x + 1, y - 1);
                const C1 = at(x - 1, y + 1), C3 = at(x + 1, y + 1);
                let o = [E, E, E, E, E, E, E, E, E];
                if (D !== B && A !== C) {
                    o = [
                        D === A ? D : E, (D === A && E !== A3) || (A === B && E !== A1) ? A : E, B === A ? B : E,
                        (D === A && E !== C1) || (D === C && E !== A1) ? D : E, E, (B === A && E !== C3) || (B === C && E !== A3) ? B : E,
                        D === C ? D : E, (D === C && E !== C3) || (C === B && E !== C1) ? C : E, B === C ? B : E
                    ];
                }
                for (let j = 0; j < 3; j++)
                    for (let i = 0; i < 3; i++)
                        out[y * 3 + j][x * 3 + i] = o[j * 3 + i];
            }
        }
        return out;
    }

    // ── the candidates ────────────────────────────────────────────────────

    /**
     * A - what ships today. Nearest scale to the target box, then
     * MaskOps.rotate (itself nearest for a non-quarter turn). Two generations
     * of binary resampling for the simplest case, five for a warped and
     * doubly-rotated one.
     */
    function pipeCurrent(src, srcW, srcH, sx, sy, deg, box) {
        const sw = Math.max(1, Math.round(srcW * sx)), sh = Math.max(1, Math.round(srcH * sy));
        const scaled = Array.from({ length: sh }, (_, dy) =>
            Array.from({ length: sw }, (_, dx) =>
                src[Math.min(srcH - 1, Math.floor(dy * srcH / sh))][Math.min(srcW - 1, Math.floor(dx * srcW / sw))]));
        return MaskOps.rotate(scaled, deg);
    }

    /** B - one composed inverse map, still nearest. The free structural win. */
    function pipeComposed(src, srcW, srcH, sx, sy, deg, box) {
        return threshold(coverageMap(src, srcW, srcH, sx, sy, deg, box, 1), 0.5);
    }

    /** C/D - one composed map, 4x4 coverage, thresholded once (font-rasterizer's technique). */
    function pipeCoverage(t) {
        return (src, srcW, srcH, sx, sy, deg, box) =>
            threshold(coverageMap(src, srcW, srcH, sx, sy, deg, box, 4), t);
    }

    /**
     * E - RotSprite: Scale3x into a space where edges are describable, do the
     * transform there, then majority-downsample back. The pixel-art standard
     * (Aseprite), and the only candidate that treats the source as ARTWORK
     * rather than as a sampling of something continuous.
     */
    function pipeRotSprite(src, srcW, srcH, sx, sy, deg, box) {
        const up = scale3x(src);
        return threshold(coverageMap(up, srcW * 3, srcH * 3, sx / 3, sy / 3, deg, box, 3), 0.5);
    }

    /**
     * F - render THROUGH the transform. Not a better resampler: no resampler
     * at all. The rotation goes into the canvas matrix and the font engine
     * rasterises the outline already turned, so the only quantisation in the
     * whole path is the single coverage threshold at the end.
     *
     * Placement is measured before it is drawn. The other pipelines centre a
     * mask on its ink; `textBaseline` centres on the em box, and the gap
     * between those two is several pixels of pure misalignment that would be
     * scored as damage. So: one pass to find the ink centre, then draw about
     * that same point.
     *
     * Vector fonts only - a bitmap glyph has no outline to re-rasterise, which
     * is exactly why the pixel fonts need a different answer.
     */
    function renderThrough(text, family, pxFinal, deg, box, ss, thresh) {
        const fs = pxFinal * ss;
        const rad = deg * Math.PI / 180;
        const PAD = Math.ceil(fs);
        const font = `${fs}px ${family}`;

        // pass 1 - where is this string's ink, relative to the draw origin?
        const probe = document.createElement('canvas');
        probe.width = Math.ceil(fs * (text.length + 2)) + PAD * 2;
        probe.height = Math.ceil(fs * 3);
        const pg = probe.getContext('2d');
        pg.font = font; pg.textBaseline = 'alphabetic'; pg.fillStyle = '#000';
        const originX = PAD, originY = Math.round(fs * 1.5);
        pg.fillText(text, originX, originY);
        const pd = pg.getImageData(0, 0, probe.width, probe.height).data;
        let x0 = probe.width, y0 = probe.height, x1 = -1, y1 = -1;
        for (let y = 0; y < probe.height; y++) for (let x = 0; x < probe.width; x++) {
            if (pd[(y * probe.width + x) * 4 + 3] > 8) {
                if (x < x0) x0 = x; if (x > x1) x1 = x;
                if (y < y0) y0 = y; if (y > y1) y1 = y;
            }
        }
        if (x1 < 0) return blank(box.w, box.h);
        const cx = (x0 + x1 + 1) / 2, cy = (y0 + y1 + 1) / 2;

        // pass 2 - draw about that ink centre, with the rotation in the matrix
        const W = box.w * ss, H = box.h * ss;
        const cv = document.createElement('canvas');
        cv.width = W; cv.height = H;
        const g = cv.getContext('2d');
        g.translate(W / 2, H / 2);
        g.rotate(rad);
        g.translate(-cx, -cy);
        g.font = font; g.textBaseline = 'alphabetic'; g.fillStyle = '#000';
        g.fillText(text, originX, originY);

        // box-filter the ss x ss block behind each output pixel into coverage
        const d = g.getImageData(0, 0, W, H).data;
        const out = blank(box.w, box.h);
        const n = ss * ss;
        for (let oy = 0; oy < box.h; oy++) {
            for (let ox = 0; ox < box.w; ox++) {
                let a = 0;
                for (let j = 0; j < ss; j++) {
                    const row = (oy * ss + j) * W;
                    for (let i = 0; i < ss; i++) a += d[(row + ox * ss + i) * 4 + 3];
                }
                out[oy][ox] = (a / n) / 255 >= thresh;
            }
        }
        return out;
    }

    /**
     * The warp inverse maps, evaluated at subsample positions instead of once
     * per output pixel - a coverage twin of
     * `SelectionService._applyWarpEffect`, deliberately mirroring it line for
     * line rather than reimplementing the geometry, so any disagreement in the
     * table is about SAMPLING and not about a different curve.
     *
     * `round` rather than `floor` here, matching the original: it places a
     * source pixel's square on [i-0.5, i+0.5), and ground truth and candidate
     * have to share one convention or the comparison is noise.
     */
    function warpCoverage(src, srcW, srcH, effect, ss, intensity = 0.5) {
        let outW = srcW, outH = srcH, expandTop = 0, expandLeft = 0;
        const arcH    = Math.round(srcH * intensity * 0.8);
        const waveAmp = Math.round(srcH * intensity * 0.25);
        const flagAmp = Math.round(srcH * intensity * 0.2);
        const slantX  = Math.round(srcH * intensity * 0.7);
        switch (effect) {
            case 'arch-up':    expandTop  = arcH;    outH = srcH + arcH; break;
            case 'arch-down':                        outH = srcH + arcH; break;
            case 'wave':       expandTop  = waveAmp; outH = srcH + 2 * waveAmp; break;
            case 'flag':       expandTop  = flagAmp; outH = srcH + 2 * flagAmp; break;
            case 'slant-right':                      outW = srcW + slantX; break;
            case 'slant-left': expandLeft = slantX;  outW = srcW + slantX; break;
        }

        const out = Array.from({ length: outH }, () => new Array(outW).fill(0));
        const step = 1 / ss, base = step / 2, n = ss * ss;

        for (let dy = 0; dy < outH; dy++) {
            for (let dx = 0; dx < outW; dx++) {
                let hits = 0;
                for (let j = 0; j < ss; j++) {
                    // CENTRED on the pixel index, [dy-0.5, dy+0.5). The
                    // original evaluates at integer dx/dy and lands with
                    // `round`, which places a pixel's square that way.
                    // Spanning [dy, dy+1) instead put this whole suite half a
                    // pixel away from the function it is supposed to be a twin
                    // of - so `current` was scored against a reference shifted
                    // from it, and the warp gain it reported was substantially
                    // that shift. Found 2026-08-29 while implementing.
                    const fy = dy - 0.5 + base + j * step;
                    for (let i = 0; i < ss; i++) {
                        const fx = dx - 0.5 + base + i * step;
                        const srcDy = fy - expandTop, srcDx = fx - expandLeft;
                        const nx = fx / (outW - 1 || 1) - 0.5;
                        const ny = fy / (outH - 1 || 1) - 0.5;
                        let sx = srcDx, sy = srcDy;
                        switch (effect) {
                            case 'arch-up':   sy = srcDy + arcH * (1 - 4 * nx * nx); break;
                            case 'arch-down': sy = srcDy - arcH * (1 - 4 * nx * nx); break;
                            case 'wave':      sy = srcDy + waveAmp * Math.sin(4 * Math.PI * fx / outW); break;
                            case 'flag':      sy = srcDy + flagAmp * Math.sin(2 * Math.PI * fx / outW); break;
                            case 'slant-right': sx = srcDx - (srcH - 1 - srcDy) * intensity * 0.7; break;
                            case 'slant-left':  sx = srcDx + (srcH - 1 - srcDy) * intensity * 0.7; break;
                            case 'inflate': {
                                const r = Math.sqrt(nx * nx + ny * ny);
                                const f = 1 + intensity * 1.5 * r * r;
                                sx = (nx / f + 0.5) * srcW; sy = (ny / f + 0.5) * srcH; break;
                            }
                            case 'perspective-top': {
                                const f = Math.max(0.1, 1 - intensity * (1 - fy / (outH - 1 || 1)));
                                sx = (nx / f + 0.5) * srcW; sy = srcDy; break;
                            }
                            case 'perspective-bottom': {
                                const f = Math.max(0.1, 1 - intensity * fy / (outH - 1 || 1));
                                sx = (nx / f + 0.5) * srcW; sy = srcDy; break;
                            }
                        }
                        const px = Math.round(sx), py = Math.round(sy);
                        if (px >= 0 && px < srcW && py >= 0 && py < srcH && src[py][px]) hits++;
                    }
                }
                out[dy][dx] = hits / n;
            }
        }
        return out;
    }

    // ── ground truth ──────────────────────────────────────────────────────
    // The finest source available, area-resampled at 16x16 and thresholded
    // once. `fineScale` says how much finer the source is than nominal, so a
    // vector glyph rendered at 8x maps onto the same output box.
    function groundTruth(fine, fineW, fineH, sx, sy, deg, box, fsx, fsy) {
        const cov = coverageMap(fine, fineW, fineH, sx / fsx, sy / fsy, deg, box, 16);
        return { mask: threshold(cov, 0.5), area: areaOf(cov) };
    }

    /** Total continuous ink in a coverage map - the honest denominator. */
    const areaOf = (cov) => cov.reduce((a, row) => a + row.reduce((b, v) => b + v, 0), 0);

    // ── metrics ───────────────────────────────────────────────────────────

    /** 8-connected ink components. */
    function components(m) {
        const { w, h } = size(m);
        const seen = blank(w, h);
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
    }

    /** Enclosed background regions - the counters of a, e, o, 8, B. */
    function holes(m) {
        const { w, h } = size(m);
        if (!w || !h) return 0;
        const seen = blank(w, h);
        const flood = (sx0, sy0) => {
            const stack = [[sx0, sy0]];
            seen[sy0][sx0] = true;
            let touchedEdge = sx0 === 0 || sy0 === 0 || sx0 === w - 1 || sy0 === h - 1;
            while (stack.length) {
                const [cx, cy] = stack.pop();
                for (const [i, j] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                    const nx = cx + i, ny = cy + j;
                    if (nx < 0 || ny < 0 || nx >= w || ny >= h) { touchedEdge = true; continue; }
                    if (!m[ny][nx] && !seen[ny][nx]) {
                        seen[ny][nx] = true;
                        if (nx === 0 || ny === 0 || nx === w - 1 || ny === h - 1) touchedEdge = true;
                        stack.push([nx, ny]);
                    }
                }
            }
            return touchedEdge;
        };
        let n = 0;
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++)
            if (!m[y][x] && !seen[y][x] && !flood(x, y)) n++;
        return n;
    }

    /**
     * IoU with a small translation search. Two pipelines can agree perfectly
     * on the letterform and disagree by half a pixel on where its box starts;
     * scoring that as damage would rank the honest ones last.
     */
    function bestIoU(a, b) {
        const A = size(a), B = size(b);
        let best = 0;
        for (let oy = -3; oy <= 3; oy++) {
            for (let ox = -3; ox <= 3; ox++) {
                let inter = 0, union = 0;
                const w = Math.max(A.w, B.w) + 6, h = Math.max(A.h, B.h) + 6;
                for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
                    const av = (a[y] && a[y][x]) || false;
                    const by = y - oy, bx = x - ox;
                    const bv = (b[by] && b[by][bx]) || false;
                    if (av && bv) inter++;
                    if (av || bv) union++;
                }
                if (union && inter / union > best) best = inter / union;
            }
        }
        return best;
    }

    // ── sources ───────────────────────────────────────────────────────────

    const tool = ToolManager.getTool(TOOLS.TEXT);

    /** ZX ROM text at 1x - 8 rows, and there is nothing finer. */
    const zxSource = (text) => {
        const m = tool._buildTextMask(text, 'ZX ROM', false, false, 'horizontal');
        return m ? { mask: m.pixels, w: m.width, h: m.height } : null;
    };

    /** A system font at an arbitrary size, via the tool's own rasteriser. */
    const sysSource = (text, px) => {
        const m = tool._rasterizeWithFont(text, SYS_FONT, px, false, false, 'horizontal');
        return m ? { mask: m.pixels, w: m.width, h: m.height } : null;
    };

    /**
     * Pasted artwork, which is what most stamps actually are. Three families,
     * each a different problem for a resampler:
     *
     *   pattern  the real shipped library (`PATTERN_BITMAPS`) tiled into a
     *            region - regular high-frequency structure, where nearest
     *            sampling produces moire and dropped rows
     *   shape    ShapeGenerator's own rasters - long clean edges and thin
     *            outlines, where a lost pixel breaks a contour
     *   noise    a 50% random field - the worst case for any resampler and
     *            the one where "keeps the ink count" is the only honest claim
     */
    function artworkSources() {
        const out = [];

        const tile = (key, w, h) => {
            const e = window.PATTERN_BITMAPS[key];
            if (!e) return null;
            const bin = atob(e.d);
            const bits = [];
            for (let by = 0; by < bin.length; by++)
                for (let bit = 7; bit >= 0; bit--) bits.push((bin.charCodeAt(by) >> bit) & 1);
            const mask = Array.from({ length: h }, (_, y) =>
                Array.from({ length: w }, (_, x) =>
                    !!bits[(y % e.h) * e.w + (x % e.w)]));
            return { name: 'pattern/' + key.split('/').pop(), mask, w, h };
        };
        for (const k of ['8x8/density-50', '8x8/diagonal-left', '16x16/houndstooth', '32x32/gear']) {
            const t = tile(k, 48, 48);
            if (t) out.push(t);
        }

        for (const [shape, filled] of [['circle', false], ['star', true], ['triangle', false]]) {
            const pts = ShapeGenerator.generateShape(shape, { x1: 0, y1: 0, x2: 47, y2: 47 },
                { filled, thickness: 1 });
            if (!pts || !pts.length) continue;
            const mask = Array.from({ length: 48 }, () => new Array(48).fill(false));
            for (const pt of pts) if (pt.y >= 0 && pt.y < 48 && pt.x >= 0 && pt.x < 48) mask[pt.y][pt.x] = true;
            out.push({ name: 'shape/' + shape + (filled ? '-filled' : ''), mask, w: 48, h: 48 });
        }

        // A photo-derived paste, through the app's OWN quantiser
        // (`PNGFormat.imageToInkMask` - per-cell two colours, Floyd-Steinberg),
        // which is the path a clipboard image actually takes. Its dither is
        // IRREGULAR, unlike a library tile, and section 10.1 flagged that as
        // the statistics the tone rule had not been checked against.
        //
        // Three synthetic photos rather than one: a pure gradient is the
        // hardest case (every cell is mid-tone dither and nothing else), a
        // gradient with hard-edged shapes mixes tone with structure, and a
        // high-frequency field is what fine detail becomes after quantisation.
        if (window.PNGFormat) {
            const photo = (name, paint) => {
                const cv = document.createElement('canvas');
                cv.width = 48; cv.height = 48;
                const g = cv.getContext('2d');
                g.fillStyle = '#fff'; g.fillRect(0, 0, 48, 48);
                paint(g);
                const r = PNGFormat.imageToInkMask(g.getImageData(0, 0, 48, 48));
                if (r && r.mask) out.push({ name: 'photo/' + name, mask: r.mask, w: r.width, h: r.height });
            };
            photo('gradient', (g) => {
                const grad = g.createLinearGradient(0, 0, 48, 48);
                grad.addColorStop(0, '#000'); grad.addColorStop(1, '#fff');
                g.fillStyle = grad; g.fillRect(0, 0, 48, 48);
            });
            photo('gradient-shapes', (g) => {
                const grad = g.createRadialGradient(24, 24, 2, 24, 24, 30);
                grad.addColorStop(0, '#fff'); grad.addColorStop(1, '#202020');
                g.fillStyle = grad; g.fillRect(0, 0, 48, 48);
                g.fillStyle = '#000'; g.fillRect(6, 30, 18, 12);
                g.strokeStyle = '#fff'; g.lineWidth = 2; g.strokeRect(28, 8, 14, 14);
            });
            photo('detail', (g) => {
                for (let y = 0; y < 48; y += 2) {
                    for (let x = 0; x < 48; x += 2) {
                        const v = 90 + 110 * Math.sin(x / 5) * Math.cos(y / 7);
                        g.fillStyle = `rgb(${v | 0},${v | 0},${v | 0})`;
                        g.fillRect(x, y, 2, 2);
                    }
                }
            });
        }

        // Deterministic, so two runs of the bench are comparable.
        let seed = 12345;
        const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
        out.push({
            name: 'noise/50',
            mask: Array.from({ length: 48 }, () => Array.from({ length: 48 }, () => rnd() > 0.5)),
            w: 48, h: 48
        });
        return out;
    }

    // ── run ───────────────────────────────────────────────────────────────

    const FINE = 8;                       // vector ground-truth oversampling
    const rows = [];
    const sheets = {};
    const harnessErrors = [];

    const CANDIDATES = [
        ['current',      pipeCurrent],
        ['composed',     pipeComposed],
        ['coverage-50',  pipeCoverage(0.50)],
        ['coverage-40',  pipeCoverage(0.40)],
        ['rotsprite',    pipeRotSprite],
        ['coverage-8/50', (src, w, h, sx, sy, deg, box) =>
            threshold(coverageMap(src, w, h, sx, sy, deg, box, 8), 0.5)],
        ['coverage-16/50', (src, w, h, sx, sy, deg, box) =>
            threshold(coverageMap(src, w, h, sx, sy, deg, box, 16), 0.5)],
        ['cov-8/bayer', (src, w, h, sx, sy, deg, box) =>
            dither(coverageMap(src, w, h, sx, sy, deg, box, 8))],
        ['cov-8/rescue', (src, w, h, sx, sy, deg, box) =>
            rescue(coverageMap(src, w, h, sx, sy, deg, box, 8), 0.5)],
        ['cov-8/guard', (src, w, h, sx, sy, deg, box) =>
            guarded(coverageMap(src, w, h, sx, sy, deg, box, 8), 0.5,
                src.some(row => row.some(Boolean)))],
        ['cov-8/fs', (src, w, h, sx, sy, deg, box) =>
            errorDiffuse(coverageMap(src, w, h, sx, sy, deg, box, 8), 0.5)],
        ['tone-8/.10', (src, w, h, sx, sy, deg, box) =>
            toneCorrect(coverageMap(src, w, h, sx, sy, deg, box, 8), 0.5, 8, 0.10)],
        ['tone-8/.20', (src, w, h, sx, sy, deg, box) =>
            toneCorrect(coverageMap(src, w, h, sx, sy, deg, box, 8), 0.5, 8, 0.20)],
        ['tone-16/.15', (src, w, h, sx, sy, deg, box) =>
            toneCorrect(coverageMap(src, w, h, sx, sy, deg, box, 8), 0.5, 16, 0.15)]
    ];

    function runCase(kind, text, label, src, fine, fsx, fsy, sx, sy, deg, sysArgs) {
        const box = targetBox(src.w, src.h, sx, sy, deg);
        // A vector glyph's best possible answer is the outline rasterised
        // through the transform at 16x, never a resampling of a 1x raster -
        // scoring a font against a picture of itself measured the rasteriser,
        // not the transform, and put the 0 degree control at 0.64.
        let truth, tArea;
        if (sysArgs) {
            truth = renderThrough(sysArgs.text, sysArgs.family, sysArgs.px * sx, deg, box, 16, 0.5);
            tArea = inkOf(truth);
        } else {
            const g = groundTruth(fine.mask, fine.w, fine.h, sx, sy, deg, box, fsx, fsy);
            truth = g.mask; tArea = g.area;
        }
        const tComp = components(truth), tHole = holes(truth);
        const srcInk = inkOf(src.mask);
        // `tone` is measured against the CONTINUOUS area, which is never zero
        // for a non-empty source - unlike the thresholded truth, which is
        // empty for any pattern too sparse to reach a half anywhere.
        const denom = tArea || 1;

        const results = [];
        // 'raster-fix' is the cheap half of render-through: the SAME shipped
        // chain, handed a source rendered by coverage instead of by one alpha
        // sample. It exists to answer whether the pipeline needs restructuring
        // at all, or whether the rasteriser was carrying the whole loss.
        const list = sysArgs
            ? CANDIDATES.concat([['raster-fix', 'RF'], ['render-through', null],
                                 ['rt-4/50', 'RT:4:0.50'], ['rt-8/40', 'RT:8:0.40'],
                                 ['rt-8/50', 'RT:8:0.50'], ['rt-2/40', 'RT:2:0.40']])
            : CANDIDATES;
        for (const [name, fn] of list) {
            let out;
            if (fn === 'RF') {
                const flat = targetBox(src.w, src.h, sx, sy, 0);
                const fixed = renderThrough(sysArgs.text, sysArgs.family, sysArgs.px * sx, 0, flat, 4, 0.40);
                out = MaskOps.rotate(fixed, deg);
            } else if (typeof fn === 'string' && fn.startsWith('RT:')) {
                const [, ss, th] = fn.split(':');
                out = renderThrough(sysArgs.text, sysArgs.family, sysArgs.px * sx, deg, box, +ss, +th);
            } else if (fn) {
                out = fn(src.mask, src.w, src.h, sx, sy, deg, box);
            } else {
                out = renderThrough(sysArgs.text, sysArgs.family, sysArgs.px * sx, deg, box, 4, 0.40);
            }
            const oInk = inkOf(out);
            results.push({
                name,
                iou: bestIoU(out, truth),
                dComp: Math.abs(components(out) - tComp),
                dHole: Math.abs(holes(out) - tHole),
                tone: oInk / denom,
                // A stamp that came back blank from artwork that was not blank.
                // The one failure no average should be allowed to absorb.
                vanished: srcInk > 0 && oInk === 0,
                truthEmpty: inkOf(truth) === 0,
                mask: out
            });
        }
        rows.push({ kind, text, label, deg,
            truth: { comp: tComp, hole: tHole, area: tArea, empty: inkOf(truth) === 0 },
            results });
        return { truth, results };
    }

    // ZX ROM: the scale is an exact integer, so all the loss is the rotation.
    for (const text of STRINGS) {
        const src = zxSource(text);
        if (!src) continue;
        for (const px of ZX_SIZES) {
            const f = px / 8;
            for (const deg of ANGLES) {
                runCase('zx', text, `${px}px`, src, src, 1, 1, f, f, deg);
            }
        }
    }

    // Pasted artwork: rotate AND scale, including the downscale that had never
    // been exercised - shrinking is where nearest sampling simply deletes rows.
    for (const art of artworkSources()) {
        for (const scale of ART_SCALES) {
            for (const deg of ANGLES) {
                runCase('art', art.name, `x${scale}`, art, art, 1, 1, scale, scale, deg);
            }
        }
    }

    // HARNESS SELF-CHECK. At ss=1 the coverage twin evaluates one sample at
    // each pixel centre, which is exactly what the real function does - so the
    // two must agree pixel for pixel. They did not, for a half-pixel offset in
    // the subsample origin, and nothing in the suite could see it: the ground
    // truth carried the same offset, so only `current` was out of register and
    // its whole warp score was measuring that. Cheap, and it fails loudly.
    for (const art of artworkSources().slice(0, 1)) {
        for (const effect of WARPS) {
            const real = SelectionService._applyWarpEffect(art.mask, art.w, art.h, effect, 0.5);
            const twin = threshold(warpCoverage(art.mask, art.w, art.h, effect, 1), 0.5);
            const same = real.length === twin.length &&
                real.every((row, y) => row.every((v, x) => v === twin[y][x]));
            if (!same) {
                harnessErrors.push(`warpCoverage at ss=1 disagrees with ` +
                    `_applyWarpEffect for '${effect}' - the twin is out of register`);
            }
        }
    }

    // Warp, in both domains. Ground truth is the same inverse map at 16x16.
    const warpSubjects = (() => {
        const all = artworkSources();
        const photos = all.filter(a => a.name.startsWith('photo/'));
        // Two tiles plus a photo - the warp suite is the slow one, so it takes
        // a representative slice rather than every source.
        return all.filter(a => !a.name.startsWith('photo/')).slice(0, 3).concat(photos.slice(0, 1));
    })();
    for (const art of warpSubjects) {
        for (const effect of WARPS) {
            const tCov = warpCoverage(art.mask, art.w, art.h, effect, 16);
            const truth = threshold(tCov, 0.5);
            const tComp = components(truth), tHole = holes(truth);
            const denom = areaOf(tCov) || 1;
            const srcInk = inkOf(art.mask);
            const cands = [
                ['current', SelectionService._applyWarpEffect(art.mask, art.w, art.h, effect, 0.5)],
                ['coverage-4/50', threshold(warpCoverage(art.mask, art.w, art.h, effect, 4), 0.5)],
                ['coverage-8/50', threshold(warpCoverage(art.mask, art.w, art.h, effect, 8), 0.5)],
                ['cov-8/bayer', dither(warpCoverage(art.mask, art.w, art.h, effect, 8))],
                ['cov-8/rescue', rescue(warpCoverage(art.mask, art.w, art.h, effect, 8), 0.5)],
                ['cov-8/guard', guarded(warpCoverage(art.mask, art.w, art.h, effect, 8), 0.5, srcInk > 0)],
                ['cov-8/fs', errorDiffuse(warpCoverage(art.mask, art.w, art.h, effect, 8), 0.5)],
                ['tone-8/.10', toneCorrect(warpCoverage(art.mask, art.w, art.h, effect, 8), 0.5, 8, 0.10)],
                ['tone-8/.20', toneCorrect(warpCoverage(art.mask, art.w, art.h, effect, 8), 0.5, 8, 0.20)],
                ['tone-16/.15', toneCorrect(warpCoverage(art.mask, art.w, art.h, effect, 8), 0.5, 16, 0.15)]
            ];
            rows.push({
                kind: 'warp', text: art.name, label: effect, deg: 0,
                truth: { comp: tComp, hole: tHole, area: denom, empty: inkOf(truth) === 0 },
                results: cands.map(([name, out]) => ({
                    name,
                    iou: bestIoU(out, truth),
                    dComp: Math.abs(components(out) - tComp),
                    dHole: Math.abs(holes(out) - tHole),
                    tone: inkOf(out) / denom,
                    vanished: srcInk > 0 && inkOf(out) === 0,
                    truthEmpty: inkOf(truth) === 0,
                    mask: out
                }))
            });
        }
    }

    // System font: the source is re-rendered at the target size, so the
    // ground truth gets a genuinely finer glyph to work from.
    for (const text of STRINGS) {
        for (const px of SYS_SIZES) {
            const src = sysSource(text, px);
            const fine = sysSource(text, px * FINE);
            if (!src || !fine) continue;
            // The fine raster is not exactly FINE times the coarse one (hinting
            // and rounding), so measure the real ratio rather than assuming it.
            const fsx = fine.w / src.w, fsy = fine.h / src.h;
            for (const scale of SYS_SCALES) {
                for (const deg of ANGLES) {
                    runCase('sys', text, `${px}px x${scale}`, src, fine, fsx, fsy, scale, scale, deg,
                        { text, family: SYS_FONT, px });
                }
            }
        }
    }

    // ── contact sheets ────────────────────────────────────────────────────
    function sheet(kind, text, label) {
        const picked = rows.filter(r => r.kind === kind && r.text === text && r.label === label);
        if (!picked.length) return null;
        const Z = 3, PAD = 14, LEFT = 96;
        const cellW = Math.max(...picked.flatMap(r => r.results.map(c => size(c.mask).w))) * Z + PAD;
        const cellH = Math.max(...picked.flatMap(r => r.results.map(c => size(c.mask).h))) * Z + PAD;
        const names = picked[0].results.map(r => r.name);
        const cv = document.createElement('canvas');
        cv.width = LEFT + cellW * picked.length;
        cv.height = 22 + cellH * names.length;
        const g = cv.getContext('2d');
        g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height);
        g.fillStyle = '#000'; g.font = '11px monospace';
        picked.forEach((r, ci) => g.fillText(r.deg + ' deg', LEFT + ci * cellW + 4, 14));
        names.forEach((name, ri) => {
            g.fillText(name, 4, 34 + ri * cellH);
            picked.forEach((r, ci) => {
                const m = r.results[ri].mask;
                const { w, h } = size(m);
                for (let y = 0; y < h; y++) for (let x = 0; x < w; x++)
                    if (m[y][x]) g.fillRect(LEFT + ci * cellW + x * Z, 22 + ri * cellH + y * Z, Z, Z);
            });
        });
        return cv.toDataURL('image/png');
    }
    const slug = (t) => t.replace(/\W/g, '_');
    for (const text of STRINGS) {
        const zx = sheet('zx', text, ZX_SIZES[ZX_SIZES.length - 1] + 'px');
        if (zx) sheets[`zx-${slug(text)}`] = zx;
        const sy = sheet('sys', text, SYS_SIZES[SYS_SIZES.length - 1] + 'px x' + SYS_SCALES[SYS_SCALES.length - 1]);
        if (sy) sheets[`sys-${slug(text)}`] = sy;
    }
    // The new suites get sheets too - the downscale is the case the eye most
    // needs to see, since that is where a sparse pattern can vanish entirely.
    for (const art of artworkSources()) {
        const a = sheet('art', art.name, 'x' + ART_SCALES[0]);
        if (a) sheets[`art-${slug(art.name)}-down`] = a;
    }
    for (const art of artworkSources().slice(0, 2)) {
        for (const effect of ['arch-up', 'inflate']) {
            const wsheet = sheet('warp', art.name, effect);
            if (wsheet) sheets[`warp-${slug(art.name)}-${effect}`] = wsheet;
        }
    }

    // Masks are megabytes; strip them before crossing the bridge.
    return {
        harnessErrors,
        rows: rows.map(r => ({ ...r, results: r.results.map(({ mask, ...rest }) => rest) })),
        sheets,
        candidates: CANDIDATES.map(([n]) => n).concat(['raster-fix', 'render-through', 'rt-4/50', 'rt-8/40', 'rt-8/50', 'rt-2/40'])
    };
}

/* ── Node side: run it, aggregate, print ──────────────────────────────── */

const CONFIG = {
    // Chosen for the failure modes, not for prettiness: 'E' parts into three
    // bars, 'aeo8' fills its counters in, 'IIII' merges adjacent stems, and
    // 'ZX SPECTRUM' is what someone actually types.
    STRINGS: ['E', 'aeo8', 'IIII', 'ZX SPECTRUM'],
    ANGLES: [0, 15, 30, 45, 60],
    ZX_SIZES: [8, 16, 32],
    SYS_SIZES: [16, 32],
    // 1.0 is the stamp as placed; 1.25 is a dragged scale slider, where the
    // shipped chain resamples once to the box and again to rotate.
    SYS_SCALES: [1, 1.25],
    // 0.6 is the case nobody had measured: shrinking a 1-bit stamp by nearest
    // sampling does not thin strokes, it DELETES whole rows of them.
    ART_SCALES: [0.6, 1, 1.25],
    WARPS: ['arch-up', 'arch-down', 'wave', 'flag', 'slant-right', 'slant-left',
            'inflate', 'perspective-top', 'perspective-bottom'],
    // A SINGLE family, never a CSS list. `_rasterizeWithFont` builds
    // `${size}px "${family}"`, so 'Arial, sans-serif' becomes one quoted family
    // nobody has and canvas falls back - while this file's own renderThrough
    // leaves it unquoted and gets real Arial. The suite was then scoring a
    // candidate in the fallback face against a ground truth in Arial, which is
    // a comparison of two typefaces rather than of two pipelines. Found
    // 2026-08-29 while implementing.
    SYS_FONT: 'Arial'
};

const fmt = (n, d = 3) => n.toFixed(d).padStart(d + 3);

async function main() {
    const { chromium } = require('@playwright/test');
    const browser = await chromium.launch({ channel: 'chrome', headless: true });
    const page = await browser.newPage();
    page.on('pageerror', (e) => console.error('PAGE ERROR', e));
    await page.goto(APP_URL);
    await page.waitForSelector('html[data-app-ready]', { timeout: 30000 });

    const out = await page.evaluate(inPage, CONFIG);
    await browser.close();

    if (out.harnessErrors && out.harnessErrors.length) {
        console.error('HARNESS SELF-CHECK FAILED - the numbers below mean nothing:');
        for (const e of out.harnessErrors) console.error('  ' + e);
        process.exitCode = 1;
    }

    // Aggregate per candidate, split by font kind - they are different
    // questions and averaging them together would hide both answers.
    const TITLES = {
        zx:   'ZX ROM bitmap font (1-bit source)',
        sys:  'System font (' + CONFIG.SYS_FONT + ', vector source)',
        art:  'Pasted artwork - patterns, shapes, noise (1-bit source)',
        warp: 'Warp effects (1-bit source, no rotation)'
    };
    for (const kind of ['zx', 'art', 'warp', 'sys']) {
        const rows = out.rows.filter(r => r.kind === kind);
        if (!rows.length) continue;
        console.log(`\n== ${TITLES[kind] || kind} - ${rows.length} cases ==`);
        const angles = [...new Set(rows.map(r => r.deg))].sort((a, b) => a - b);
        const perAngle = angles.length > 1;
        const lost = rows.filter(r => r.truth.empty).length;
        if (lost) {
            console.log(`  NOTE: the 0.50-thresholded ground truth is EMPTY in ${lost}/${rows.length} ` +
                `cases - sources too sparse for any pixel to reach half coverage.`);
            console.log('        `tone` is scored against continuous AREA for this reason; ' +
                'IoU/dComp/dHole are meaningless in those rows.');
        }
        console.log('  pipeline        IoU    dComp   dHole   tone  gone' +
            (perAngle ? '   |   IoU by angle: ' + angles.map(a => String(a).padStart(5)).join('') : ''));
        const names = [...new Set(rows.flatMap(r => r.results.map(c => c.name)))];
        for (const name of names) {
            const all = rows.map(r => r.results.find(c => c.name === name)).filter(Boolean);
            // Shape metrics are only meaningful where the truth has a shape.
            const cs = all.filter(c => !c.truthEmpty);
            if (!all.length) continue;
            const avg = (xs, f) => xs.length ? xs.reduce((a, c) => a + f(c), 0) / xs.length : 0;
            const gone = all.filter(c => c.vanished).length;
            const byAngle = angles.map((a) => {
                const sub = rows.filter(r => r.deg === a && !r.truth.empty)
                    .map(r => r.results.find(c => c.name === name)).filter(Boolean);
                return sub.length ? avg(sub, c => c.iou).toFixed(2).padStart(5) : '    -';
            }).join('');
            console.log(`  ${name.padEnd(14)}${fmt(avg(cs, c => c.iou))}  ${fmt(avg(cs, c => c.dComp), 2)}  ` +
                `${fmt(avg(cs, c => c.dHole), 2)}  ${fmt(avg(all, c => c.tone), 2)}  ` +
                `${String(gone).padStart(4)}` +
                (perAngle ? `   |                    ${byAngle}` : ''));
        }
    }

    if (DETAIL) {
        console.log('\n== per case ==');
        for (const r of out.rows) {
            console.log(`${r.kind} "${r.text}" ${r.label} ${String(r.deg).padStart(3)}deg ` +
                `(truth comp=${r.truth.comp} hole=${r.truth.hole}` +
                `${r.truth.empty ? ', TRUTH EMPTY - shape metrics meaningless' : ''})`);
            for (const c of r.results) {
                console.log(`    ${c.name.padEnd(14)} IoU ${fmt(c.iou)}  dComp ${c.dComp}  ` +
                    `dHole ${c.dHole}  tone ${fmt(c.tone, 2)}${c.vanished ? '  GONE' : ''}`);
            }
        }
    }

    if (OUT_DIR) {
        fs.mkdirSync(OUT_DIR, { recursive: true });
        for (const [name, url] of Object.entries(out.sheets)) {
            const file = path.join(OUT_DIR, name + '.png');
            fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
            console.log('wrote ' + file);
        }
    }
}

main().catch((e) => { console.error(e); process.exit(1); });
