'use strict';
/**
 * Blit-method augmentation for the per-suite CanvasSystem stubs.
 *
 * The Node suites each stub CanvasSystem themselves - deliberately, because
 * each records something slightly different (composited RGB, dirty cells,
 * nothing at all) and one shared stub would have to satisfy all of them at
 * once. What they DO share is that the compositor now writes whole cells
 * through `blitCellBits`/`blitCellIndices` rather than 64 `setPixel` calls,
 * so every stub needs those three methods and none should hand-roll the bit
 * unpacking.
 *
 * `withBlit` adds them in terms of whatever `setPixel` the stub already has,
 * so each suite keeps recording exactly what it recorded before and the
 * production change stays invisible to assertions written against pixels.
 *
 * The packing is the REAL one (js/core/canvas-system.js `packRGB`), not a
 * stand-in: `_paletteWords()` stores packed colours in a `Uint32Array`, which
 * would silently coerce anything else to zero. The blits unpack back into an
 * (r, g, b) triple for `setPixel`, which is the only difference from
 * production - the stub has no pixel buffer, only a recorder.
 */

/** ABGR, alpha forced opaque - must match CanvasSystemClass.packRGB. */
const pack = (rgb) => (((255 << 24) | (rgb[2] << 16) | (rgb[1] << 8) | rgb[0]) >>> 0);

/**
 * @param {Object} stub - a CanvasSystem stub exposing setPixel(x,y,r,g,b)
 * @returns {Object} the same object, with packRGB/blitCellBits/blitCellIndices
 */
function withBlit(stub) {
    stub.packRGB = pack;

    stub.blitCellBits = function(baseX, baseY, cellW, cellH, rows, inkWord, paperWord) {
        const msb = cellW - 1;
        for (let row = 0; row < cellH; row++) {
            const bits = rows[row];
            for (let col = 0; col < cellW; col++) {
                const word = ((bits >> (msb - col)) & 1) ? inkWord : paperWord;
                this.setPixel(baseX + col, baseY + row,
                              word & 0xff, (word >> 8) & 0xff, (word >> 16) & 0xff);
            }
        }
    };

    stub.blitCellIndices = function(baseX, baseY, cellW, cellH, indices, words) {
        const maxIndex = words.length - 1;
        for (let row = 0; row < cellH; row++) {
            const src = row * cellW;
            for (let col = 0; col < cellW; col++) {
                let idx = indices[src + col];
                if (idx < 0) idx = 0; else if (idx > maxIndex) idx = maxIndex;
                const word = words[idx];
                this.setPixel(baseX + col, baseY + row,
                              word & 0xff, (word >> 8) & 0xff, (word >> 16) & 0xff);
            }
        }
    };

    return stub;
}

module.exports = { withBlit };
