'use strict';
(function() {

/** The Sinclair cell is always 8 rows tall; only the width varies (4/6/8). */
const CELL_HEIGHT = 8;

/**
 * Each output pixel is rendered as a SUPERSAMPLE x SUPERSAMPLE block and
 * then box-filtered back down, so an output pixel's ink decision is made
 * from 16 samples rather than one. At 8 rows a stem is often well under a
 * pixel wide and NO single sample in it reaches half opacity - which is
 * exactly why the previous single-sample `alpha >= 128` test rendered most
 * text blank. Averaging first produces real coverage fractions that a
 * threshold can mean something against. 4 is the smallest factor giving
 * enough levels (17) to separate a hairline from a stem, and costs a
 * 32x32 canvas at most.
 */
const SUPERSAMPLE = 4;

/**
 * Ink when at least this fraction of an output pixel's area is covered.
 *
 * Half would be the neutral choice and it is measurably the wrong one here:
 * fitted into 8 rows a typical sans stem is ~0.7 output pixels wide, so a
 * whole-pixel test drops strokes that are unambiguously there. 0.40 was
 * chosen by rendering ABEHIMORSW aegilmnorst 018.,!? from four real Windows
 * faces (Arial, Segoe UI, Verdana, Consolas) at 0.25/0.30/0.35/0.40/0.45 and
 * reading the bitmaps (M, 2026-08-19): at 0.45 counters and crossbars start
 * dropping out, at 0.30 and below the lowercase bowls fill in and 'a', 'e',
 * 'o' become the same blob. 0.40 is the widest setting where every letter
 * still has its holes.
 */
const INK_COVERAGE = 0.40;

/**
 * Dropout rescue (see _rescueDropouts): a row or column that produced no
 * ink at all is re-examined, and rescued only if something in it is at
 * least this covered - well clear of the 0.1-0.2 an antialiasing fringe
 * leaves behind, so a fringe is never mistaken for a stroke.
 */
const RESCUE_COVERAGE = 0.25;

/** Within a rescued line, ink everything within this factor of its peak. */
const RESCUE_NEAR_MAX = 0.9;

/** Used only if the platform gives no text metrics at all (see _metrics). */
const FALLBACK_ASCENT = 0.8;
const FALLBACK_DESCENT = 0.2;

const FAMILY = 'PixULA-SystemFontRaster';

/**
 * FontRasterizer — turns real font bytes (TTF/OTF, served raw by the
 * companion) into PixULA's bitmap glyph model, entirely client-side. No
 * font-rendering code runs in the companion at all (design spec §6.3) -
 * this is the ONLY place outline-to-bitmap conversion happens, using the
 * standard FontFace + Canvas 2D APIs already available in every browser
 * this app targets.
 *
 * Three things decide whether the result is a font or a smear, and all
 * three are handled here rather than left to the caller:
 *
 * 1. COVERAGE, not opacity. See SUPERSAMPLE above.
 * 2. ONE baseline for the whole set. Vertical placement is computed once,
 *    from the ink bounds of every requested character together, and every
 *    glyph is then drawn on that shared baseline. Centring each glyph in
 *    its own cell would look right one glyph at a time and read as
 *    ransom-note text in a word, because 'a' and 'A' would sit at the
 *    same height.
 * 3. A FIT relationship between the requested size and the 8-row cell.
 *    `pointSize` is the size the outline is rendered at, in final-image
 *    pixels, but it is capped so the whole set's ink fits those 8 rows:
 *    a 12 px em (the picker's own default) is ~1.5 cells tall, and
 *    rendering it as asked would hand back the middle slice of every
 *    letter. Sizes small enough to fit are honoured exactly.
 *
 * Horizontal fit is deliberately NOT solved: a glyph wider than the cell
 * keeps its left edge and loses its right columns, matching what the rest
 * of this app does when a font is narrowed (documented destructive).
 */
const FontRasterizer = {
    /**
     * @param {ArrayBuffer} fontBytes
     * @param {{pointSize:number, cellWidth:number, firstCode:number, count:number}} opts
     * @returns {Promise<Uint8Array[]>} one Uint8Array(8) per code, row-byte
     *   MSB-left, masked to cellWidth - the exact shape FontService.setGlyph expects.
     */
    async rasterize(fontBytes, { pointSize, cellWidth, firstCode, count }) {
        if (!(pointSize > 0)) throw new Error('FontRasterizer: pointSize must be > 0');
        if (!(cellWidth >= 1 && cellWidth <= 8)) throw new Error('FontRasterizer: cellWidth must be 1-8');
        if (!(count >= 0)) throw new Error('FontRasterizer: count must be >= 0');

        const face = new FontFace(FAMILY, fontBytes);
        await face.load();
        document.fonts.add(face);

        try {
            const ss = SUPERSAMPLE;
            const width = cellWidth * ss;
            const height = CELL_HEIGHT * ss;
            const canvas = Helpers.createCanvas(width, height);
            const ctx = canvas.getContext('2d');
            ctx.textBaseline = 'alphabetic'; // the real baseline, not the em-box top
            ctx.textAlign = 'left';
            ctx.fillStyle = '#000';

            const chars = [];
            for (let i = 0; i < count; i++) chars.push(String.fromCharCode(firstCode + i));

            // Pass 1: how tall is this set's ink at the requested size, and
            // does it fit? Metrics scale linearly with the font size, so one
            // rescale is exact - but it is re-measured rather than scaled
            // arithmetically, because hinting can round differently.
            let renderSize = pointSize * ss;
            let bounds = this._setBounds(ctx, chars, renderSize);
            const inkHeight = bounds.ascent + bounds.descent;
            if (inkHeight > height && inkHeight > 0) {
                renderSize *= height / inkHeight;
                bounds = this._setBounds(ctx, chars, renderSize);
            }
            ctx.font = `${renderSize}px ${FAMILY}`;

            // The shared baseline: the set's ink block centred in the cell,
            // then SNAPPED to an output-pixel boundary. Every glyph that does
            // not descend sits on this line, so landing it half a pixel off
            // costs every one of them its bottom row to a 50/50 split; on the
            // boundary they all end crisply on the same row.
            const slack = Math.max(0, height - (bounds.ascent + bounds.descent));
            const baseline = Helpers.clamp(
                ss * Math.round((slack / 2 + bounds.ascent) / ss), 0, height);

            const mask = (0xFF << (8 - cellWidth)) & 0xFF;
            const fullyCovered = ss * ss * 255;
            const glyphs = [];
            for (const ch of chars) {
                ctx.clearRect(0, 0, width, height);

                // Centre the glyph's own ink in the cell where it fits; where
                // it does not, pin its left edge and let the right columns
                // crop. The left edge is snapped to an output-pixel boundary
                // for the same reason the baseline is: at this size a stem is
                // thinner than one output pixel, so a stem straddling two
                // columns puts ~35% coverage in each and disappears under any
                // sane threshold - which is precisely how 'i', 'l' and 'I'
                // came out blank. On the boundary that same stem is one solid
                // column.
                //
                // m.left/m.right are the ink edges measured from the drawing
                // origin, positive to the right - so the origin that puts the
                // ink's left edge at p is p - m.left.
                const m = this._metrics(ctx, ch, renderSize);
                const inkWidth = m.right - m.left;
                const inkLeft = ss * Math.round(Math.max(0, (width - inkWidth) / 2) / ss);
                const x = inkLeft - m.left;
                ctx.fillText(ch, x, baseline);

                // Box-filter the supersampled alpha down to one coverage
                // fraction per output pixel.
                const { data } = ctx.getImageData(0, 0, width, height);
                const cov = new Float64Array(cellWidth * CELL_HEIGHT);
                for (let cy = 0; cy < CELL_HEIGHT; cy++) {
                    for (let cx = 0; cx < cellWidth; cx++) {
                        let sum = 0;
                        for (let sy = 0; sy < ss; sy++) {
                            let idx = (((cy * ss + sy) * width) + cx * ss) * 4 + 3;
                            for (let sx = 0; sx < ss; sx++, idx += 4) sum += data[idx];
                        }
                        cov[cy * cellWidth + cx] = sum / fullyCovered;
                    }
                }

                const inked = new Uint8Array(cov.length);
                for (let i = 0; i < cov.length; i++) inked[i] = cov[i] >= INK_COVERAGE ? 1 : 0;
                this._rescueDropouts(cov, inked, cellWidth, CELL_HEIGHT);

                const glyph = new Uint8Array(CELL_HEIGHT);
                for (let cy = 0; cy < CELL_HEIGHT; cy++) {
                    let row = 0;
                    for (let cx = 0; cx < cellWidth; cx++) {
                        if (inked[cy * cellWidth + cx]) row |= (0x80 >> cx);
                    }
                    glyph[cy] = row & mask;
                }
                glyphs.push(glyph);
            }

            return glyphs;
        } finally {
            document.fonts.delete(face);
        }
    },

    /**
     * Put back a stroke the threshold dropped entirely.
     *
     * Snapping fixes a stem the glyph's own left edge lines up with ('i',
     * 'l', 'I'); it cannot fix one sitting at a fractional offset INSIDE the
     * glyph, like the stem of '1' hanging off its flag, which lands ~0.38
     * and ~0.32 across two columns and vanishes with the whole stroke. So
     * after thresholding, any row or column carrying real coverage but no
     * ink at all inks the cells at its own local maximum: one pixel for a
     * stem, the whole run for a crossbar. This is a dropout rule, not a
     * second threshold - it only ever fires where the plain threshold
     * produced NOTHING, so it can add a missing stroke but never thicken one
     * that came out fine.
     * @private
     */
    _rescueDropouts(cov, inked, w, h) {
        const line = (indices) => {
            let max = 0;
            let any = false;
            for (const i of indices) {
                if (inked[i]) { any = true; break; }
                if (cov[i] > max) max = cov[i];
            }
            if (any || max < RESCUE_COVERAGE) return;
            for (const i of indices) {
                if (cov[i] >= max * RESCUE_NEAR_MAX) inked[i] = 1;
            }
        };
        for (let y = 0; y < h; y++) {
            const row = [];
            for (let x = 0; x < w; x++) row.push(y * w + x);
            line(row);
        }
        for (let x = 0; x < w; x++) {
            const col = [];
            for (let y = 0; y < h; y++) col.push(y * w + x);
            line(col);
        }
    },

    /**
     * The widest ink bounds across a whole character set at one size - the
     * input to both the fit decision and the shared baseline.
     * @private
     */
    _setBounds(ctx, chars, sizePx) {
        ctx.font = `${sizePx}px ${FAMILY}`;
        let ascent = 0;
        let descent = 0;
        for (const ch of chars) {
            const m = this._metrics(ctx, ch, sizePx);
            if (m.ascent > ascent) ascent = m.ascent;
            if (m.descent > descent) descent = m.descent;
        }
        if (ascent + descent <= 0) { // an all-blank set (or no metrics at all)
            ascent = sizePx * FALLBACK_ASCENT;
            descent = sizePx * FALLBACK_DESCENT;
        }
        return { ascent, descent };
    },

    /**
     * One character's ink box relative to its drawing origin: `left`/`right`
     * are horizontal offsets measured positive to the RIGHT (TextMetrics
     * reports actualBoundingBoxLeft positive to the left, so it is negated
     * here), `ascent`/`descent` are heights above and below the baseline.
     * Falls back to em-proportional estimates where actual bounding boxes
     * are unavailable, so the caller never has to branch.
     * @private
     */
    _metrics(ctx, ch, sizePx) {
        const fallback = {
            left: 0,
            right: sizePx * 0.5,
            ascent: sizePx * FALLBACK_ASCENT,
            descent: sizePx * FALLBACK_DESCENT
        };
        if (typeof ctx.measureText !== 'function') return fallback;
        const m = ctx.measureText(ch);
        if (!m || typeof m.actualBoundingBoxAscent !== 'number') {
            return { ...fallback, right: typeof m?.width === 'number' ? m.width : fallback.right };
        }
        return {
            left: -m.actualBoundingBoxLeft,   // positive to the LEFT of the origin
            right: m.actualBoundingBoxRight,
            ascent: Math.max(0, m.actualBoundingBoxAscent),
            descent: Math.max(0, m.actualBoundingBoxDescent)
        };
    }
};

window.FontRasterizer = FontRasterizer;

})();
