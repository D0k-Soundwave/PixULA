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
