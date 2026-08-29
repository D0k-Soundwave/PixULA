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
