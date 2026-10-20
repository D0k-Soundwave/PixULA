'use strict';

/**
 * GlyphBits - pure bit access for font glyphs of any size (Batch 10C).
 *
 * A glyph is a Uint8Array of `height * bytesPerRow(width)` bytes: rows top to bottom, each row
 * `bytesPerRow` bytes wide, the most significant bit of the first byte = the leftmost pixel. For the
 * classic Sinclair sizes (4, 6 or 8 wide, 8 high) that is exactly one byte per row, the same layout as
 * layer cell.pixels - so classic fonts are byte-for-byte what they always were.
 *
 * Big CHX characters (up to 32 x 32, in steps of 8) are stored on disk as 8 x 8 blocks, row-major
 * (see FontFormat); toBlocks / fromBlocks convert between the two.
 *
 * No DOM, no state.
 */
const GlyphBits = {
    /** Bytes in one row of a glyph `width` pixels wide. */
    bytesPerRow(width) {
        return (width + 7) >> 3;
    },

    /** Bytes in a whole glyph. */
    byteLength(width, height) {
        return this.bytesPerRow(width) * height;
    },

    /** A blank glyph. */
    create(width, height) {
        return new Uint8Array(this.byteLength(width, height));
    },

    /** Mask for the LAST byte of a row: the bits that belong to the glyph (0xF0 for 4 wide, 0xFC for 6, 0xFF for 8). */
    lastByteMask(width) {
        const spare = this.bytesPerRow(width) * 8 - width;
        return (0xFF << spare) & 0xFF;
    },

    /** Clear the spare bits to the right of the glyph. Mutates and returns g. */
    normalise(g, width, height) {
        const bpr = this.bytesPerRow(width);
        const mask = this.lastByteMask(width);
        for (let y = 0; y < height; y++) g[y * bpr + bpr - 1] &= mask;
        return g;
    },

    /** True if the pixel is set; false for a clear pixel or one outside the glyph. */
    getPixel(g, width, x, y) {
        if (x < 0 || y < 0 || x >= width) return false;
        const i = y * this.bytesPerRow(width) + (x >> 3);
        if (i >= g.length) return false;
        return (g[i] & (0x80 >> (x & 7))) !== 0;
    },

    /** Set or clear a pixel. Returns false (and does nothing) if it is outside the glyph. */
    setPixel(g, width, x, y, on) {
        if (x < 0 || y < 0 || x >= width) return false;
        const i = y * this.bytesPerRow(width) + (x >> 3);
        if (i >= g.length) return false;
        if (on) g[i] |= 0x80 >> (x & 7);
        else g[i] &= ~(0x80 >> (x & 7)) & 0xFF;
        return true;
    },

    /** Mirror left-right within the glyph width. */
    flipH(g, width, height) {
        const copy = Uint8Array.from(g);
        g.fill(0);
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                if (this.getPixel(copy, width, x, y)) this.setPixel(g, width, width - 1 - x, y, true);
            }
        }
        return g;
    },

    /** Mirror top-bottom. */
    flipV(g, width, height) {
        const bpr = this.bytesPerRow(width);
        const copy = Uint8Array.from(g);
        for (let y = 0; y < height; y++) {
            g.set(copy.subarray((height - 1 - y) * bpr, (height - y) * bpr), y * bpr);
        }
        return g;
    },

    /** Move the picture one pixel, wrapping round the edges. dir: 'left' | 'right' | 'up' | 'down'. */
    shift(g, width, height, dir) {
        const copy = Uint8Array.from(g);
        g.fill(0);
        const dx = dir === 'left' ? -1 : dir === 'right' ? 1 : 0;
        const dy = dir === 'up' ? -1 : dir === 'down' ? 1 : 0;
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                if (!this.getPixel(copy, width, x, y)) continue;
                this.setPixel(g, width, (x + dx + width) % width, (y + dy + height) % height, true);
            }
        }
        return g;
    },

    /** Swap set and clear within the glyph. */
    invert(g, width, height) {
        for (let i = 0; i < g.length; i++) g[i] = ~g[i] & 0xFF;
        return this.normalise(g, width, height);
    },

    /**
     * Cut a glyph into CHX's 8 x 8 blocks: blocks left to right, then down; each block is 8 row bytes.
     * Width and height must be multiples of 8.
     */
    toBlocks(g, width, height) {
        const cols = width >> 3, rows = height >> 3, bpr = cols;
        const out = new Uint8Array(cols * rows * 8);
        let o = 0;
        for (let by = 0; by < rows; by++) {
            for (let bx = 0; bx < cols; bx++) {
                for (let r = 0; r < 8; r++) out[o++] = g[(by * 8 + r) * bpr + bx];
            }
        }
        return out;
    },

    /** The reverse of toBlocks. */
    fromBlocks(blocks, cols, rows) {
        const out = new Uint8Array(cols * rows * 8);
        let i = 0;
        for (let by = 0; by < rows; by++) {
            for (let bx = 0; bx < cols; bx++) {
                for (let r = 0; r < 8; r++) out[(by * 8 + r) * cols + bx] = blocks[i++];
            }
        }
        return out;
    },

    /**
     * The attribute byte a block gets when a coloured character grows (or a smaller one is read into a bigger font): 56, the
     * Spectrum's own default - black Ink on white Paper, no Bright, no Flash - which looks the same as an uncoloured block.
     */
    DEFAULT_ATTR: 0x38,

    /**
     * A coloured character's block attributes (cols x rows bytes, left to right then down) at a new block size: the top-left
     * part is kept, new blocks get DEFAULT_ATTR. Null stays null (an uncoloured character).
     * @param {?Uint8Array} attrs
     * @returns {?Uint8Array}
     */
    resizeBlocks(attrs, cols, rows, newCols, newRows) {
        if (!attrs) return null;
        const out = new Uint8Array(newCols * newRows).fill(this.DEFAULT_ATTR);
        for (let by = 0; by < newRows && by < rows; by++) {
            for (let bx = 0; bx < newCols && bx < cols; bx++) out[by * newCols + bx] = attrs[by * cols + bx];
        }
        return out;
    },

    /** Mirror a character's block attributes left-right (the blocks follow the pixels of flipH). Mutates and returns attrs. */
    flipBlocksH(attrs, cols, rows) {
        if (!attrs) return attrs;
        for (let by = 0; by < rows; by++) {
            for (let a = by * cols, b = a + cols - 1; a < b; a++, b--) {
                const t = attrs[a]; attrs[a] = attrs[b]; attrs[b] = t;
            }
        }
        return attrs;
    },

    /** Mirror a character's block attributes top-bottom (flipV). Mutates and returns attrs. */
    flipBlocksV(attrs, cols, rows) {
        if (!attrs) return attrs;
        for (let a = 0, b = rows - 1; a < b; a++, b--) {
            for (let bx = 0; bx < cols; bx++) {
                const t = attrs[a * cols + bx]; attrs[a * cols + bx] = attrs[b * cols + bx]; attrs[b * cols + bx] = t;
            }
        }
        return attrs;
    },

    /** A copy at a new size: the top-left part is kept, new area is blank. */
    resize(g, width, height, newWidth, newHeight) {
        const out = this.create(newWidth, newHeight);
        const w = Math.min(width, newWidth), h = Math.min(height, newHeight);
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                if (this.getPixel(g, width, x, y)) this.setPixel(out, newWidth, x, y, true);
            }
        }
        return out;
    },

    /**
     * How many whole 8-pixel columns a proportional character leaves empty on each side (the shader's result).
     *
     * The character occupies a span of the cell: the extent of its ink, or - for a blank character such as Space, which has no
     * ink - its advance width, placed where the alignment puts it. Whole 8-pixel columns entirely outside that span are
     * shaded. The span is never empty, so at least one column always remains.
     * @param {{left:number, right:number}|null} edges - ink edges from inkEdges() (inclusive), null if blank
     * @param {number} advance - the character's advance width in pixels (used when blank)
     * @param {number} width - cell width in pixels (a multiple of 8)
     * @param {string} align - 'left' | 'centre' | 'right'
     * @returns {number[]} [left, right] shaded columns
     */
    autoShade(edges, advance, width, align) {
        let a, b;            // used span [a, b) in pixels
        if (edges) {
            a = edges.left;
            b = edges.right + 1;
        } else {
            const want = Math.round(advance);
            const span = want < 1 ? 1 : want > width ? width : want;
            a = align === 'right' ? width - span : align === 'centre' ? Math.floor((width - span) / 2) : 0;
            b = a + span;
        }
        const cols = width >> 3;
        let left = Math.floor(a / 8);
        let right = Math.floor((width - b) / 8);
        if (left + right > cols - 1) right = Math.max(0, cols - 1 - left);
        return [Math.max(0, left), Math.max(0, right)];
    },

    /**
     * What a click on 8-pixel column `k` does to a character's shading [left, right] (the shader tool):
     * a click on a shaded column un-shades it and everything between it and the character's edge; a click on an unshaded column
     * shades from the NEARER edge through that column (a tie goes right, because proportional letters are usually left-aligned).
     * @param {number[]} shade - [left, right]
     * @param {number} cols - columns of 8 pixels in the character
     * @param {number} k - clicked column, 0-based
     * @returns {number[]} the new [left, right]
     */
    shadeAfterClick(shade, cols, k) {
        const L = shade[0], R = shade[1];
        if (k < 0 || k >= cols) return [L, R];
        if (k < L) return [k, R];
        if (k >= cols - R) return [L, cols - 1 - k];
        return k < cols - 1 - k ? [k + 1, R] : [L, cols - k];
    },

    /**
     * Grow or shrink one side of the shading by `delta` columns (the buttons).
     * @param {number[]} shade - [left, right]
     * @param {number} cols
     * @param {string} side - 'left' | 'right'
     * @param {number} delta - +1 or -1
     * @returns {number[]|null} the new [left, right], or null if that is not possible
     */
    shadeStep(shade, cols, side, delta) {
        const next = side === 'left' ? [shade[0] + delta, shade[1]] : [shade[0], shade[1] + delta];
        if (next[0] < 0 || next[1] < 0 || next[0] + next[1] > cols) return null;
        return next;
    },

    /** The leftmost and rightmost columns with ink ({left, right}), or null for a blank glyph. */
    inkEdges(g, width, height) {
        let left = -1, right = -1;
        for (let x = 0; x < width; x++) {
            for (let y = 0; y < height; y++) {
                if (this.getPixel(g, width, x, y)) {
                    if (left < 0) left = x;
                    right = x;
                    break;
                }
            }
        }
        return left < 0 ? null : { left, right };
    }
};

window.GlyphBits = GlyphBits;
