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
     * The (dx, dy) a drop shadow of size `off` falls by. The direction is relative to the LETTERS (the effects run before
     * the turn), so a quarter turn turns the shadow with the text. Anything unknown is down-right, today's shadow.
     * @param {string} dir - 'down-right' | 'down-left' | 'up-right' | 'up-left'
     * @param {number} off
     * @returns {{dx:number,dy:number}}
     */
    shadowVector(dir, off) {
        const left = dir === 'down-left' || dir === 'up-left';
        const up = dir === 'up-right' || dir === 'up-left';
        return { dx: left ? -off : off, dy: up ? -off : off };
    },

    /**
     * The pixel of a w x h box that a placement click lands on. Nine anchors: 'top-left' ... 'bottom-right'; a left/top
     * anchor is the first column/row, a right/bottom one the last, and the middle is floor(n / 2) - exactly the rule text
     * was centred by before anchors existed. Unknown or missing is 'center'.
     * @param {string} anchor
     * @param {number} w
     * @param {number} h
     * @returns {{x:number,y:number}} offsets from the box's top-left
     */
    anchorOffset(anchor, w, h) {
        const a = String(anchor || 'center');
        const x = a.includes('left') || a === 'left' ? 0 : a.includes('right') ? w - 1 : Math.floor(w / 2);
        const y = a.startsWith('top') ? 0 : a.startsWith('bottom') ? h - 1 : Math.floor(h / 2);
        return { x, y };
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

        // Membership is a flat byte grid, reused across calls and left all
        // zero after each: this runs on every pointer move of a stroke, and a
        // Set hashed each of a size-128 disc's ~12,800 members five times.
        // `keys` keeps first-seen order, the order the Set iterated in, so
        // the output is unchanged.
        const size = w * h;
        let grid = MaskOps._boundaryGrid;
        if (!grid || grid.length < size) grid = MaskOps._boundaryGrid = new Uint8Array(size);

        const keys = [];
        for (let i = 0; i < points.length; i++) {
            const p = points[i];
            if (p.x >= 0 && p.x < w && p.y >= 0 && p.y < h) {
                const k = p.y * w + p.x;
                if (!grid[k]) { grid[k] = 1; keys.push(k); }
            }
        }

        const out = [];
        for (let i = 0; i < keys.length; i++) {
            const k = keys[i];
            const x = k % w;
            const y = (k - x) / w;
            const interior =
                x > 0     && grid[k - 1] &&
                x < w - 1 && grid[k + 1] &&
                y > 0     && grid[k - w] &&
                y < h - 1 && grid[k + w];
            if (!interior) out.push({ x, y });
        }
        for (let i = 0; i < keys.length; i++) grid[keys[i]] = 0;
        return out;
    },

    /** @private boundaryPoints' reusable membership grid (all zero between calls). */
    _boundaryGrid: null,

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
     *   shadowDir     'down-right' (default) | 'down-left' | 'up-right' | 'up-left' - relative to the letters
     * @returns {boolean[][]}
     */
    /**
     * Where a point of the raw mask ends up after `process` / `processLayers` (mirror, contour padding, the shadow's glyph
     * shift, then the turn), and how big the finished box is. Quarter turns are exact; other angles use the forward map of
     * `rotateFree` (pixel centres), good to a pixel. Used to put a text caret on the finished text.
     * @returns {{x:number, y:number, w:number, h:number}}
     */
    mapPoint(x, y, w, h, opts = {}) {
        const h0 = h;
        if (opts.mirrorH) x = w - 1 - x;
        if (opts.mirrorV) y = h - 1 - y;
        if (opts.outline) { x += 1; y += 1; w += 2; h += 2; }
        if (opts.shadow) {
            const off = opts.shadowOffset || Math.max(1, Math.round(h0 / 8));
            const v = MaskOps.shadowVector(opts.shadowDir, off);
            x += Math.max(0, -v.dx); y += Math.max(0, -v.dy);
            w += Math.abs(v.dx); h += Math.abs(v.dy);
        }
        const deg = (((opts.direction || 0) % 360) + 360) % 360;
        if (deg === 0) return { x, y, w, h };
        if (deg % 90 === 0) {
            let px = x, py = y, pw = w, ph = h;
            for (let s = 0; s < deg / 90; s++) { const nx = ph - 1 - py, ny = px; px = nx; py = ny; const t = pw; pw = ph; ph = t; }
            return { x: px, y: py, w: pw, h: ph };
        }
        const rad = deg * Math.PI / 180, cos = Math.cos(rad), sin = Math.sin(rad);
        const dstW = Math.ceil(w * Math.abs(cos) + h * Math.abs(sin));
        const dstH = Math.ceil(w * Math.abs(sin) + h * Math.abs(cos));
        const u = x + 0.5 - w / 2, v = y + 0.5 - h / 2;
        return { x: Math.floor(u * cos - v * sin + dstW / 2), y: Math.floor(u * sin + v * cos + dstH / 2), w: dstW, h: dstH };
    },

    /**
     * `process` for text whose shadow and/or contour are drawn in the OPPOSITE dot state to the letters (ZX Paintbrush's
     * shading and contour). Returns the dots to SET and the dots to CLEAR as two masks of the same size, never overlapping
     * (set wins), or `clearMask: null` when nothing is opposite - then `pixels` is exactly `process(mask, opts)`.
     *
     * Each effect has its own switch (opts.shadowDots, opts.outlineDots: 'same' | 'opposite'):
     *   contour, same      the hollow ring replaces the letters (today's Outline)
     *   contour, opposite  the letters stay set, a ring of clear dots surrounds them
     *   shadow, same       the letters and a set copy of them
     *   shadow, opposite   the letters stay set; a copy of everything drawn so far (letters and ring) is CLEARED behind them
     * The box is the same size as with Same dots, so placement and anchors do not change.
     * @param {boolean[][]} mask
     * @param {Object} opts - as `process`, plus shadowDots / outlineDots
     * @returns {{pixels: boolean[][], clearMask: ?boolean[][]}}
     */
    processLayers(mask, opts = {}) {
        const oppOutline = !!opts.outline && opts.outlineDots === 'opposite';
        const oppShadow = !!opts.shadow && opts.shadowDots === 'opposite';
        if (!oppOutline && !oppShadow) return { pixels: MaskOps.process(mask, opts), clearMask: null };

        const blank = (w, h) => Array.from({ length: h }, () => new Array(w).fill(false));
        const place = (m, w, h, sx, sy) => {
            const out = blank(w, h);
            for (let y = 0; y < m.length; y++) for (let x = 0; x < m[0].length; x++) if (m[y][x]) out[y + sy][x + sx] = true;
            return out;
        };
        let S = mask;
        if (opts.mirrorH) S = MaskOps.flipH(S);
        if (opts.mirrorV) S = MaskOps.flipV(S);
        let C = blank(S[0].length, S.length);
        const preHeight = MaskOps.size(mask).h;

        if (opts.outline) {
            const ring = MaskOps.outline(S);
            const w = ring[0].length, h = ring.length;
            if (oppOutline) { S = place(S, w, h, 1, 1); C = ring; }
            else { S = ring; C = blank(w, h); }
        }
        if (opts.shadow) {
            const off = opts.shadowOffset || Math.max(1, Math.round(preHeight / 8));
            const v = MaskOps.shadowVector(opts.shadowDir, off);
            const ox = Math.max(0, v.dx), oy = Math.max(0, v.dy), gx = Math.max(0, -v.dx), gy = Math.max(0, -v.dy);
            const w = S[0].length + Math.abs(v.dx), h = S.length + Math.abs(v.dy);
            const Sg = place(S, w, h, gx, gy), Ss = place(S, w, h, ox, oy);
            const Cg = place(C, w, h, gx, gy), Cs = place(C, w, h, ox, oy);
            const S2 = blank(w, h), C2 = blank(w, h);
            for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
                if (oppShadow) {
                    S2[y][x] = Sg[y][x];
                    C2[y][x] = !Sg[y][x] && (Cg[y][x] || Ss[y][x] || Cs[y][x]);
                } else {
                    S2[y][x] = Sg[y][x] || Ss[y][x];
                    C2[y][x] = !S2[y][x] && Cg[y][x];
                }
            }
            S = S2; C = C2;
        }
        if (opts.direction) { S = MaskOps.rotate(S, opts.direction); C = MaskOps.rotate(C, opts.direction); }
        let any = false;
        for (let y = 0; y < C.length; y++) for (let x = 0; x < C[0].length; x++) {
            if (C[y][x] && S[y][x]) C[y][x] = false;       // a turned layer can overlap by resampling: set wins
            else if (C[y][x]) any = true;
        }
        return { pixels: S, clearMask: any ? C : null };
    },

    process(mask, opts = {}) {
        let out = mask;
        if (opts.mirrorH) out = MaskOps.flipH(out);
        if (opts.mirrorV) out = MaskOps.flipV(out);
        if (opts.outline) out = MaskOps.outline(out);
        if (opts.shadow) {
            const off = opts.shadowOffset ||
                Math.max(1, Math.round(MaskOps.size(mask).h / 8));   // pre-effect height
            const v = MaskOps.shadowVector(opts.shadowDir, off);
            out = MaskOps.shadow(out, v.dx, v.dy);
        }
        if (opts.direction) out = MaskOps.rotate(out, opts.direction);
        return out;
    }
};

window.MaskOps = MaskOps;

if (window.Logger) Logger.debug('MaskOps', 'Mask operations loaded');

})(); // End IIFE
