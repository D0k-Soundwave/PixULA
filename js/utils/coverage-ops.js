'use strict';
(function() {

/**
 * CoverageOps - the coverage domain.
 *
 * A coverage buffer holds, per output pixel, the FRACTION of that pixel its
 * source covers. It exists because the alternative - threshold to 1 bit first,
 * then resample the binary result - destroys information that no later step
 * can recover. Measured 2026-08-29: the FINEST possible resample of an
 * already-thresholded raster scores 0.311 against ground truth where the
 * crudest scores 0.309. Sixteen-times supersampling of a binary source buys
 * 0.002, so no better resampler will ever matter; the fix has to be upstream
 * of the threshold, which is what this domain is for.
 *
 * `MaskOps` keeps its boolean API and is unaffected - it serves tools, tests
 * and the hover footprint, none of which want a coverage buffer.
 *
 * Float32Array rather than a number[][]: a 640x256 stamp rotated is ~393k
 * output pixels, and this buffer is built and thrown away on every tick of a
 * slider drag.
 *
 * Pure and dependency-free (Node-tested in tests/coverage-ops.test.js).
 */
/**
 * 8x8 ordered (Bayer) threshold matrix, 0..63.
 *
 * Used ONLY to break ties when tone correction ranks equally-covered pixels. A
 * uniform field has no coverage order at all, and without a tie-break the ink
 * it puts back clumps into one corner of every window instead of scattering.
 * It is deliberately NOT used to threshold: dithering the whole buffer keeps
 * tone but wrecks shape (0.787 against 0.994 on the bench's glyph suite) and
 * replaces a checkerboard with its own weave.
 */
const BAYER8 = (() => {
    let g = [[0]];
    for (let k = 1; k < 4; k++) {
        const n = g.length, out = [];
        for (let y = 0; y < n * 2; y++) out.push(new Array(n * 2).fill(0));
        for (let y = 0; y < n; y++) {
            for (let x = 0; x < n; x++) {
                const v = g[y][x] * 4;
                out[y][x] = v; out[y][x + n] = v + 2;
                out[y + n][x] = v + 3; out[y + n][x + n] = v + 1;
            }
        }
        g = out;
    }
    return g;
})();

const CoverageOps = {

    /**
     * Subsamples per axis when measuring coverage.
     *
     * 8, measured. At 4 the result falls BELOW the nearest-neighbour chain it
     * replaces on a 1-bit source (0.973 against 0.976) - too coarse to resolve
     * the half-coverage tie-break - and rasterising a vector glyph through a
     * transform gains 0.959 against 0.937 by moving from 4 to 8.
     */
    SUPERSAMPLE: 8,

    /**
     * Ink where at least this fraction of the pixel is covered - the UNBIASED
     * cut, for a source whose coverage is exact geometric area.
     *
     * 0.50 because half is what "mostly covered" means when the source is
     * 1-bit artwork: every source pixel is a unit square that is either inside
     * the output pixel or not, there are no sub-pixel features to rescue, and
     * biasing the cut either way just moves edges. Measured on the bench's
     * 1-bit suites at 0.994 against ground truth, where 0.40 scores 0.944.
     *
     * Vector GLYPHS are a different problem and take `GLYPH_COVERAGE`.
     */
    INK_COVERAGE: 0.50,

    /**
     * The cut for rasterising a vector glyph, biased toward ink.
     *
     * A letterform's legibility is carried by strokes that are THINNER than a
     * pixel at stamp sizes, and a stroke straddling two pixel columns puts
     * half its width in each - so an unbiased half-coverage test drops marks
     * that are unambiguously there. This is the same observation
     * `js/utils/font-rasterizer.js` made in 2026-08-19, at a smaller size and
     * with its own measured answer of 0.40.
     *
     * 0.30, calibrated 2026-08-29 the way that file calibrated its own: render
     * real faces and read the bitmaps. Six faces (Arial, Segoe UI, Verdana,
     * Consolas, Times New Roman, Georgia) at 12/16/24px, scoring `ZX SPECTRUM`
     * for fragmentation against one piece per glyph and `aeo8` for its five
     * counters. Total absolute error: 25 at 0.25, **20 at 0.30**, 24 at 0.35,
     * 41 at 0.40, 89 at 0.50. A real minimum with a curve either side - below
     * 0.30 letters start MERGING (Verdana at 12px falls to 8 pieces), above it
     * they fragment (Times at 16px reaches 26 pieces and loses all 5
     * counters). Sans faces are insensitive across the whole range; serifs at
     * small sizes are what the value is really for.
     *
     * The number in the design spec was 0.50, and it was wrong for this use.
     * It came from the bench scoring 0.40 against 0.50 - but the bench's
     * ground truth is itself thresholded at 0.50, so that comparison could
     * only ever favour 0.50. A threshold cannot be calibrated against a
     * reference that already assumes it.
     */
    GLYPH_COVERAGE: 0.30,

    /**
     * Tone-correction window edge, in px. One ZX cell.
     *
     * 8. At 16 the restored region shows visible blocky seams - it is on the
     * contact sheet, and no metric caught it.
     */
    TONE_WINDOW: 8,

    /**
     * Tone error, as a fraction of the window, that must be exceeded before
     * anything is put back.
     *
     * 0.10. Numerically 0.10 and 0.20 are within noise of each other (artwork
     * 0.949 against 0.954, photos 0.971 against 0.976, both favouring 0.20 by
     * ~0.005); the contact sheets favour 0.10 on the sparse tiles, and 0.005
     * of IoU is the measured price of taking them at their word.
     */
    TONE_TOLERANCE: 0.10,

    /** @returns {{data: Float32Array, w: number, h: number}} an empty buffer */
    create(w, h) {
        return { data: new Float32Array(Math.max(0, w) * Math.max(0, h)), w, h };
    },

    /** @returns {{w: number, h: number}} */
    size(cov) {
        return { w: cov.w, h: cov.h };
    },

    /** Coverage at (x, y); 0 outside the buffer, so callers need no guard. */
    get(cov, x, y) {
        if (x < 0 || y < 0 || x >= cov.w || y >= cov.h) return 0;
        return cov.data[y * cov.w + x];
    },

    /**
     * Enter the domain. A set pixel is fully covered, a clear one not at all -
     * which is exactly what makes a 1-bit source's own coverage map lossless.
     * @param {boolean[][]} mask
     */
    fromMask(mask) {
        const h = mask.length;
        const w = h ? mask[0].length : 0;
        const cov = CoverageOps.create(w, h);
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                if (mask[y][x]) cov.data[y * w + x] = 1;
            }
        }
        return cov;
    },

    /**
     * Leave the domain. This is the ONE quantisation the whole pipeline is
     * allowed, and it belongs at the very end - every threshold taken earlier
     * is information thrown away before anything downstream can use it.
     * @param {{data: Float32Array, w: number, h: number}} cov
     * @param {number} [threshold=INK_COVERAGE]
     * @returns {boolean[][]}
     */
    toMask(cov, threshold = CoverageOps.INK_COVERAGE) {
        const out = [];
        for (let y = 0; y < cov.h; y++) {
            const row = new Array(cov.w);
            for (let x = 0; x < cov.w; x++) row[x] = cov.data[y * cov.w + x] >= threshold;
            out.push(row);
        }
        return out;
    },

    /**
     * Leave the domain, putting back tone the threshold destroyed.
     *
     * The trigger is not "is the transform compressing" - a downscaled glyph
     * compresses too, and dithering one is exactly what must not happen - but
     * "did the threshold lose tone HERE", which separates the two cases
     * directly and measurably. Over each window: a letterform's interior is
     * coverage 1 and stays inked, its background is 0 and stays empty, and its
     * edge band roughly balances, so the deficit is near zero and nothing is
     * touched. A 25% dither field is 0.25 in every pixel and thresholds to
     * NOTHING, so the deficit is the whole tone and the rule restores it.
     *
     * That matters here more than in most applications: on a two-colour cell
     * the only way to fake a grey is to dither, so the pattern library's whole
     * spine is a density ramp, and a flat cut deletes any tile too sparse to
     * reach half anywhere.
     *
     * Pixels come back in order of COVERAGE, not in Bayer order, so the
     * restored texture follows the artwork's own geometry - ranking by Bayer
     * replaced a checkerboard with its own weave and a diagonal tile with
     * generic noise. Ties, which is what a uniform field is, break on Bayer
     * order: that scatters the selection instead of clumping it into one
     * corner of the window.
     *
     * Measured a no-op on letterforms - 0.994 / dComp 0.23 on the bench's
     * 1-bit glyph suite, matching plain coverage to three decimals.
     *
     * @param {{data: Float32Array, w: number, h: number}} cov
     * @param {number} [threshold=INK_COVERAGE]
     * @param {number} [win=TONE_WINDOW]
     * @param {number} [tolFrac=TONE_TOLERANCE]
     * @returns {boolean[][]}
     */
    toMaskToned(cov, threshold = CoverageOps.INK_COVERAGE,
                win = CoverageOps.TONE_WINDOW, tolFrac = CoverageOps.TONE_TOLERANCE) {
        const out = CoverageOps.toMask(cov, threshold);
        if (!cov.w || !cov.h) return out;

        const jitter = (y, x) => (63 - BAYER8[y & 7][x & 7]) / 63 * 1e-3;
        const key = (c) => cov.data[c[0] * cov.w + c[1]] + jitter(c[0], c[1]);

        for (let wy = 0; wy < cov.h; wy += win) {
            for (let wx = 0; wx < cov.w; wx += win) {
                const cells = [];
                let areaSum = 0, inked = 0;
                for (let y = wy; y < Math.min(cov.h, wy + win); y++) {
                    for (let x = wx; x < Math.min(cov.w, wx + win); x++) {
                        cells.push([y, x]);
                        areaSum += cov.data[y * cov.w + x];
                        if (out[y][x]) inked++;
                    }
                }
                if (!cells.length) continue;
                const deficit = areaSum - inked;
                const tol = Math.max(1, tolFrac * cells.length);
                if (Math.abs(deficit) <= tol) continue;

                if (deficit > 0) {
                    const cand = cells.filter((c) => !out[c[0]][c[1]]).sort((a, b) => key(b) - key(a));
                    let need = Math.round(deficit);
                    for (let i = 0; i < cand.length && need > 0; i++, need--) out[cand[i][0]][cand[i][1]] = true;
                } else {
                    const cand = cells.filter((c) => out[c[0]][c[1]]).sort((a, b) => key(a) - key(b));
                    let need = Math.round(-deficit);
                    for (let i = 0; i < cand.length && need > 0; i++, need--) out[cand[i][0]][cand[i][1]] = false;
                }
            }
        }
        return out;
    },

    /**
     * Total continuous ink. The honest denominator for "did this keep the
     * right AMOUNT of ink", because the thresholded mask is empty for any
     * field too sparse to reach the cut anywhere - a 25% dither downscaled
     * has real ink and no inked pixels, and dividing by that produced tone
     * ratios of 576 while the bench was being written.
     */
    area(cov) {
        let sum = 0;
        for (let i = 0; i < cov.data.length; i++) sum += cov.data[i];
        return sum;
    },

    /**
     * The output box a transform needs: the source box scaled, then its
     * corners turned. Callers size their buffer from this so nothing clips.
     * @param {number} w
     * @param {number} h
     * @param {{scaleX?: number, scaleY?: number, degrees?: number}} opts
     * @returns {{w: number, h: number}}
     */
    boxFor(w, h, opts = {}) {
        const sx = opts.scaleX == null ? 1 : opts.scaleX;
        const sy = opts.scaleY == null ? 1 : opts.scaleY;
        const rad = (opts.degrees || 0) * Math.PI / 180;
        const c = Math.abs(Math.cos(rad)), s = Math.abs(Math.sin(rad));
        const sw = Math.max(1, Math.round(w * sx));
        const sh = Math.max(1, Math.round(h * sy));
        // Ceil with a tolerance. cos(90 degrees) is 6.1e-17 rather than 0, so
        // a quarter turn of an 8x4 box computes 4.000000000000001 and ceils to
        // FIVE - a spurious column of padding on every exact quarter turn.
        // `MaskOps.rotateFree` carries the same expression and is safe only
        // because `MaskOps.rotate` sends multiples of 90 to the exact
        // transpose instead; nothing dispatches for us here.
        const ceil = (v) => Math.max(1, Math.ceil(v - 1e-9));
        return { w: ceil(sw * c + sh * s), h: ceil(sw * s + sh * c) };
    },

    /** Mirror left-right. Exact - a reindex, with no resampling at all. */
    flipH(cov) {
        const out = CoverageOps.create(cov.w, cov.h);
        for (let y = 0; y < cov.h; y++) {
            for (let x = 0; x < cov.w; x++) {
                out.data[y * cov.w + x] = cov.data[y * cov.w + (cov.w - 1 - x)];
            }
        }
        return out;
    },

    /** Mirror top-bottom. Exact, as `flipH`. */
    flipV(cov) {
        const out = CoverageOps.create(cov.w, cov.h);
        for (let y = 0; y < cov.h; y++) {
            out.data.set(cov.data.subarray((cov.h - 1 - y) * cov.w, (cov.h - y) * cov.w), y * cov.w);
        }
        return out;
    },

    /**
     * Drop shadow: the MAX of the glyph and a copy offset by (dx, dy).
     *
     * Max rather than the boolean OR `MaskOps.shadow` takes, which cannot
     * express a half-covered pixel. On a 1-bit input the two agree exactly; on
     * a fractional one this keeps the fraction, which is the only reason the
     * chain can stay in the domain across this step.
     */
    shadow(cov, dx, dy) {
        const ox = Math.max(0, dx), oy = Math.max(0, dy);
        const gx = Math.max(0, -dx), gy = Math.max(0, -dy);
        const outW = cov.w + Math.abs(dx), outH = cov.h + Math.abs(dy);
        const out = CoverageOps.create(outW, outH);
        if (!cov.w || !cov.h) return out;
        for (let y = 0; y < cov.h; y++) {
            for (let x = 0; x < cov.w; x++) {
                const v = cov.data[y * cov.w + x];
                if (v <= 0) continue;
                const gi = (y + gy) * outW + (x + gx);
                const si = (y + oy) * outW + (x + ox);
                if (v > out.data[gi]) out.data[gi] = v;
                if (v > out.data[si]) out.data[si] = v;
            }
        }
        return out;
    },

    /**
     * Hollow contour: an 8-neighbour dilation minus the glyph, one pixel of
     * padding on every side.
     *
     * The dilation takes the neighbourhood MAX and the subtraction scales by
     * what the glyph does NOT cover, so a half-covered glyph pixel leaves half
     * a pixel of ring rather than all of it or none.
     */
    outline(cov) {
        const outW = cov.w + 2, outH = cov.h + 2;
        const out = CoverageOps.create(outW, outH);
        if (!cov.w || !cov.h) return out;
        for (let y = 0; y < cov.h; y++) {
            for (let x = 0; x < cov.w; x++) {
                const v = cov.data[y * cov.w + x];
                if (v <= 0) continue;
                for (let ny = y; ny <= y + 2; ny++) {
                    for (let nx = x; nx <= x + 2; nx++) {
                        const i = ny * outW + nx;
                        if (v > out.data[i]) out.data[i] = v;
                    }
                }
            }
        }
        for (let y = 0; y < cov.h; y++) {
            for (let x = 0; x < cov.w; x++) {
                out.data[(y + 1) * outW + (x + 1)] *= (1 - cov.data[y * cov.w + x]);
            }
        }
        return out;
    },

    /**
     * The text effect chain, in `MaskOps.process`'s canonical order minus its
     * rotation: mirror -> outline -> shadow.
     *
     * `direction` is deliberately ignored. Rotation is `transform`'s job, and
     * applying it in both places is exactly the double turn the vector half
     * had to guard against with its `rotationApplied` flag.
     */
    process(cov, opts = {}) {
        let out = cov;
        if (opts.mirrorH) out = CoverageOps.flipH(out);
        if (opts.mirrorV) out = CoverageOps.flipV(out);
        if (opts.outline) out = CoverageOps.outline(out);
        if (opts.shadow) {
            const off = opts.shadowOffset || Math.max(1, Math.round(cov.h / 8));
            out = CoverageOps.shadow(out, off, off);
        }
        return out;
    },

    /**
     * The warp inverse maps, evaluated at subsample positions instead of once
     * per output pixel - a coverage twin of
     * `SelectionService._applyWarpEffect`, deliberately mirroring it line for
     * line rather than reimplementing the geometry, so any difference between
     * the two is about SAMPLING and never about a different curve.
     *
     * `round` rather than `floor` when landing in the source, matching the
     * original: it places a source pixel's square on [i-0.5, i+0.5), and the
     * two have to share one convention.
     *
     * Warp is where this domain pays for itself most. Measured 2026-08-29 over
     * all nine effects, the shipped boolean path scores IoU 0.615 with dComp
     * 21.49 - a warped stamp coming apart into twenty-two more pieces than it
     * should - against 0.959 and 1.20 here.
     *
     * @param {{data: Float32Array, w: number, h: number}} cov
     * @param {string} effect - one of the nine, or anything else for a copy
     * @param {number} [intensity=0.5]
     * @param {number} [ss=SUPERSAMPLE]
     * @returns {{data: Float32Array, w: number, h: number}}
     */
    warp(cov, effect, intensity = 0.5, ss = CoverageOps.SUPERSAMPLE) {
        const srcW = cov.w, srcH = cov.h;
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

        const out = CoverageOps.create(outW, outH);
        if (!srcW || !srcH) return out;
        const step = 1 / ss, base = step / 2, n = ss * ss;

        // Subsamples span the pixel CENTRED on its index, [dx-0.5, dx+0.5).
        // The original evaluates at integer dx and lands with `round`, which
        // places a pixel's square that way - spanning [dx, dx+1) instead makes
        // half of every pixel's samples round into its neighbour, and an
        // unknown effect stops being the identity it is supposed to be.
        for (let dy = 0; dy < outH; dy++) {
            for (let dx = 0; dx < outW; dx++) {
                let sum = 0;
                for (let j = 0; j < ss; j++) {
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
                        sum += CoverageOps.get(cov, Math.round(sx), Math.round(sy));
                    }
                }
                out.data[dy * outW + dx] = sum / n;
            }
        }
        return out;
    },

    /**
     * Scale and rotation as ONE inverse map, sampling coverage.
     *
     * Composing them is an optimisation and not always available: in the stamp
     * chain the text effects and warp sit BETWEEN the scale and the rotation,
     * and reordering them would change what a shadow or an arch looks like.
     * The caller passes both only when the chain between them is empty;
     * otherwise it calls this twice and pays two maps, which is still one
     * quantisation at the end instead of three.
     *
     * `ss` subsamples per axis. At 1 this degenerates to nearest-neighbour,
     * which is what the interactive fallback wants.
     *
     * @param {{data: Float32Array, w: number, h: number}} cov
     * @param {{scaleX?: number, scaleY?: number, degrees?: number}} opts
     * @param {{w: number, h: number}} box
     * @param {number} [ss=SUPERSAMPLE]
     * @returns {{data: Float32Array, w: number, h: number}}
     */
    transform(cov, opts, box, ss = CoverageOps.SUPERSAMPLE) {
        const out = CoverageOps.create(box.w, box.h);
        if (!cov.w || !cov.h || !box.w || !box.h) return out;

        const sx = opts.scaleX == null ? 1 : opts.scaleX;
        const sy = opts.scaleY == null ? 1 : opts.scaleY;
        const rad = (opts.degrees || 0) * Math.PI / 180;
        const cos = Math.cos(rad), sin = Math.sin(rad);
        const step = 1 / ss, base = step / 2, n = ss * ss;

        for (let dy = 0; dy < box.h; dy++) {
            for (let dx = 0; dx < box.w; dx++) {
                let sum = 0;
                for (let j = 0; j < ss; j++) {
                    const v = dy + base + j * step - box.h / 2;
                    for (let i = 0; i < ss; i++) {
                        const u = dx + base + i * step - box.w / 2;
                        // un-rotate (same sense as MaskOps.rotate), then un-scale
                        const xr =  u * cos + v * sin;
                        const yr = -u * sin + v * cos;
                        const px = Math.floor(xr / sx + cov.w / 2);
                        const py = Math.floor(yr / sy + cov.h / 2);
                        sum += CoverageOps.get(cov, px, py);
                    }
                }
                out.data[dy * box.w + dx] = sum / n;
            }
        }
        return out;
    }
};

window.CoverageOps = CoverageOps;

if (window.Logger) Logger.debug('CoverageOps', 'Coverage operations loaded');

})(); // End IIFE
