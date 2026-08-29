'use strict';
(function() {

/**
 * MaskOps — pure boolean-mask post-processing (Phase 8).
 *
 * Operates on row-major bool[][] masks (the floating-stamp pixel format).
 * Used by the text tool for its direction/mirror placement and the
 * shadow/contour effects, and by SelectionService when it re-rasterizes a
 * text stamp — both call `process()` with the same fontInfo fields, so the
 * live preview and the committed stamp can never diverge.
 *
 * Everything here is dependency-free pure math (Node-tested in
 * tests/text-mask-ops.test.js).
 */
const MaskOps = {

    /** @returns {{w: number, h: number}} dimensions of a mask ([]-safe) */
    size(mask) {
        return { w: mask.length ? mask[0].length : 0, h: mask.length };
    },

    /**
     * Rotate a mask clockwise by any angle.
     *
     * Quarter turns take the exact transpose path - a pure re-index, so no
     * pixel is invented or dropped and the letterforms survive intact.
     * Everything else goes to `rotateFree`, which resamples and therefore
     * does not. That split is the whole reason the two live behind one
     * function: a caller asking for 90° must never pay a resample for it,
     * and this used to `Math.round(degrees / 90)` - so 45° silently became
     * 90° and the text tool could only ever offer four angles.
     *
     * @param {boolean[][]} mask
     * @param {number} degrees - clockwise; any value, normalized to [0, 360)
     * @returns {boolean[][]}
     */
    rotate(mask, degrees) {
        const deg = ((degrees % 360) + 360) % 360;
        if (deg % 90 !== 0) return MaskOps.rotateFree(mask, deg);
        let out = mask;
        for (let s = 0; s < deg / 90; s++) out = MaskOps._rotate90(out);
        return out;
    },

    /**
     * Rotate a mask clockwise by an arbitrary angle - nearest-neighbour
     * inverse map, hard threshold, no anti-aliasing (a 1-bit mask has no
     * grey to soften an edge with, and a soft edge would only be thresholded
     * away again later).
     *
     * The output box is the source's bounding box turned by the same angle,
     * so nothing clips. Sampling is by pixel CENTRE, which is what makes a
     * multiple of 90 come out identical to `_rotate90` - the two agree, and
     * `rotate` uses the cheaper one.
     *
     * Screen coordinates (y down), so a positive angle tips the right-hand
     * end of a horizontal bar DOWNWARD - the same clockwise sense as the
     * quarter-turn path.
     *
     * @param {boolean[][]} mask
     * @param {number} degrees - clockwise
     * @returns {boolean[][]}
     */
    rotateFree(mask, degrees) {
        const { w: srcW, h: srcH } = MaskOps.size(mask);
        if (!srcW || !srcH) return mask;

        const rad = degrees * Math.PI / 180;
        const cos = Math.cos(rad), sin = Math.sin(rad);
        const dstW = Math.ceil(srcW * Math.abs(cos) + srcH * Math.abs(sin));
        const dstH = Math.ceil(srcW * Math.abs(sin) + srcH * Math.abs(cos));

        const out = Array.from({ length: dstH }, () => new Array(dstW).fill(false));
        for (let dy = 0; dy < dstH; dy++) {
            const v = dy + 0.5 - dstH / 2;
            for (let dx = 0; dx < dstW; dx++) {
                const u = dx + 0.5 - dstW / 2;
                // inverse of [u,v] = [x cos - y sin, x sin + y cos]
                const sx = Math.floor(u * cos + v * sin + srcW / 2);
                const sy = Math.floor(-u * sin + v * cos + srcH / 2);
                if (sx >= 0 && sx < srcW && sy >= 0 && sy < srcH && mask[sy][sx]) {
                    out[dy][dx] = true;
                }
            }
        }
        return out;
    },

    /**
     * Mirror left-right. Exact - every pixel keeps its state, so unlike a
     * free rotation this costs the letterforms nothing.
     * @param {boolean[][]} mask
     * @returns {boolean[][]}
     */
    flipH(mask) {
        return mask.map(row => row.slice().reverse());
    },

    /**
     * Mirror top-bottom. Exact, as `flipH`.
     * @param {boolean[][]} mask
     * @returns {boolean[][]}
     */
    flipV(mask) {
        return mask.map(row => row.slice()).reverse();
    },

    /** One clockwise quarter turn. @private */
    _rotate90(mask) {
        const { w, h } = MaskOps.size(mask);
        if (!w || !h) return mask;
        const out = [];
        for (let y = 0; y < w; y++) {
            const row = new Array(h);
            for (let x = 0; x < h; x++) {
                row[x] = mask[h - 1 - x][y];
            }
            out.push(row);
        }
        return out;
    },

    /**
     * Drop shadow: OR the mask with a copy offset by (dx, dy). The result
     * grows by |dx| × |dy| so nothing clips; the glyph keeps its position
     * for positive offsets (shadow falls down-right).
     * @param {boolean[][]} mask
     * @param {number} dx - Shadow offset X (≥ 0 -> right)
     * @param {number} dy - Shadow offset Y (≥ 0 -> down)
     * @returns {boolean[][]}
     */
    shadow(mask, dx, dy) {
        const { w, h } = MaskOps.size(mask);
        if (!w || !h) return mask;
        const ox = Math.max(0, dx), oy = Math.max(0, dy);       // shadow shift
        const gx = Math.max(0, -dx), gy = Math.max(0, -dy);     // glyph shift
        const outW = w + Math.abs(dx);
        const outH = h + Math.abs(dy);
        const out = Array.from({ length: outH }, () => new Array(outW).fill(false));
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                if (!mask[y][x]) continue;
                out[y + gy][x + gx] = true;   // glyph
                out[y + oy][x + ox] = true;   // shadow copy
            }
        }
        return out;
    },

    /**
     * Contour/outline: 8-neighbour dilation minus the glyph — a hollow 1px
     * outline around the letterforms. The result grows by 1px on every side.
     * @param {boolean[][]} mask
     * @returns {boolean[][]}
     */
    outline(mask) {
        const { w, h } = MaskOps.size(mask);
        if (!w || !h) return mask;
        const outW = w + 2, outH = h + 2;
        const out = Array.from({ length: outH }, () => new Array(outW).fill(false));
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                if (!mask[y][x]) continue;
                for (let ny = y; ny <= y + 2; ny++) {
                    for (let nx = x; nx <= x + 2; nx++) {
                        out[ny][nx] = true;   // dilate into the padded frame
                    }
                }
            }
        }
        // subtract the glyph (centred in the padded frame)
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                if (mask[y][x]) out[y + 1][x + 1] = false;
            }
        }
        return out;
    },

    /**
     * The boundary of a pixel set, clipped to a w x h canvas: every member that
     * has at least one 4-neighbour outside the set. An off-canvas neighbour
     * counts as outside, so where the set is clipped by the canvas edge, that
     * edge IS boundary.
     *
     * This is what lets a large footprint be drawn as a one-pixel ring instead
     * of an opaque blob: the hover outline (InputHandler.getFootprint ->
     * GridOverlay.drawFootprintOutline) has to describe the artwork under the
     * cursor, not hide it. A sparse set — a dither pattern, a crosshatch — is
     * almost entirely boundary and so survives essentially intact.
     *
     * Membership is keyed `y * w + x` over ON-CANVAS members only. Tools emit
     * their whole stamp, off-canvas points included, and that key would
     * otherwise alias x = -1 onto (w - 1) of the row above.
     *
     * @param {Array<{x: number, y: number}>} points - affected-pixel set
     * @param {number} w - canvas width in pixels
     * @param {number} h - canvas height in pixels
     * @returns {Array<{x: number, y: number}>} on-canvas boundary members
     */
    boundaryPoints(points, w, h) {
        if (!points || !points.length || !w || !h) return [];

        const inSet = new Set();
        for (let i = 0; i < points.length; i++) {
            const p = points[i];
            if (p.x >= 0 && p.x < w && p.y >= 0 && p.y < h) inSet.add(p.y * w + p.x);
        }

        const out = [];
        for (const k of inSet) {
            const x = k % w;
            const y = (k - x) / w;
            const interior =
                x > 0     && inSet.has(k - 1) &&
                x < w - 1 && inSet.has(k + 1) &&
                y > 0     && inSet.has(k - w) &&
                y < h - 1 && inSet.has(k + w);
            if (!interior) out.push({ x, y });
        }
        return out;
    },

    /**
     * Apply the text tool's post-processing chain in canonical order:
     * mirror -> outline -> shadow -> rotate.
     *
     * Mirroring comes FIRST because it is a property of the letterforms, not
     * of the finished block: mirror after the shadow and the shadow falls up
     * and to the left, which reads as a bug rather than as mirror writing.
     * Rotation comes LAST for the same reason from the other end - the
     * shadow should follow the baseline, so the whole block turns together.
     *
     * @param {boolean[][]} mask
     * @param {Object} opts - { direction?, mirrorH?, mirrorV?, shadow?,
     *                          outline?, shadowOffset? }
     *   direction     degrees clockwise; multiples of 90 are lossless
     *   mirrorH       boolean — mirror left-right (exact)
     *   mirrorV       boolean — mirror top-bottom (exact)
     *   shadow        boolean — drop shadow (offset-OR)
     *   outline       boolean — hollow contour (dilate-minus-glyph)
     *   shadowOffset  px; defaults to max(1, round(maskHeight / 8))
     * @returns {boolean[][]}
     */
    process(mask, opts = {}) {
        let out = mask;
        if (opts.mirrorH) out = MaskOps.flipH(out);
        if (opts.mirrorV) out = MaskOps.flipV(out);
        if (opts.outline) out = MaskOps.outline(out);
        if (opts.shadow) {
            const off = opts.shadowOffset ||
                Math.max(1, Math.round(MaskOps.size(mask).h / 8));   // pre-effect height
            out = MaskOps.shadow(out, off, off);
        }
        if (opts.direction) out = MaskOps.rotate(out, opts.direction);
        return out;
    }
};

window.MaskOps = MaskOps;

if (window.Logger) Logger.debug('MaskOps', 'Mask operations loaded');

})(); // End IIFE
