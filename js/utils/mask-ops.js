'use strict';
(function() {

/**
 * MaskOps — pure boolean-mask post-processing (Phase 8).
 *
 * Operates on row-major bool[][] masks (the floating-stamp pixel format).
 * Used by the text tool for the 4-direction placement and the
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
     * Rotate a mask clockwise in 90° steps.
     * @param {boolean[][]} mask
     * @param {number} degrees - 0 | 90 | 180 | 270 (other values -> nearest step)
     * @returns {boolean[][]}
     */
    rotate(mask, degrees) {
        const steps = ((Math.round(degrees / 90) % 4) + 4) % 4;
        let out = mask;
        for (let s = 0; s < steps; s++) out = MaskOps._rotate90(out);
        return out;
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
     * outline -> shadow -> rotate. Effects run in glyph space (the shadow
     * follows the baseline when the text is rotated); rotation comes last.
     * @param {boolean[][]} mask
     * @param {Object} opts - { direction?, shadow?, outline?, shadowOffset? }
     *   direction     0 | 90 | 180 | 270 (clockwise)
     *   shadow        boolean — drop shadow (offset-OR)
     *   outline       boolean — hollow contour (dilate-minus-glyph)
     *   shadowOffset  px; defaults to max(1, round(maskHeight / 8))
     * @returns {boolean[][]}
     */
    process(mask, opts = {}) {
        let out = mask;
        if (opts.outline) out = MaskOps.outline(out);
        if (opts.shadow) {
            const off = opts.shadowOffset ||
                Math.max(1, Math.round(MaskOps.size(mask).h / 8));
            out = MaskOps.shadow(out, off, off);
        }
        if (opts.direction) out = MaskOps.rotate(out, opts.direction);
        return out;
    }
};

window.MaskOps = MaskOps;

if (window.Logger) Logger.debug('MaskOps', 'Mask operations loaded');

})(); // End IIFE
