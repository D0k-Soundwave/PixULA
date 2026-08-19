'use strict';
(function() {

/**
 * FontRasterizer — turns real font bytes (TTF/OTF, served raw by the
 * companion) into PixULA's bitmap glyph model, entirely client-side. No
 * font-rendering code runs in the companion at all (design spec §6.3) -
 * this is the ONLY place outline-to-bitmap conversion happens, using the
 * standard FontFace + Canvas 2D APIs already available in every browser
 * this app targets.
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

        const face = new FontFace('PixULA-SystemFontRaster', fontBytes);
        await face.load();
        document.fonts.add(face);

        try {
            const cellHeight = 8; // Sinclair fonts are always one 8-px attribute cell tall
            const canvas = Helpers.createCanvas(cellWidth, cellHeight);
            const ctx = canvas.getContext('2d');
            ctx.textBaseline = 'top';
            ctx.font = `${pointSize}px PixULA-SystemFontRaster`;
            ctx.fillStyle = '#000';

            const mask = (0xFF << (8 - cellWidth)) & 0xFF;
            const glyphs = [];
            for (let i = 0; i < count; i++) {
                const code = firstCode + i;
                ctx.clearRect(0, 0, cellWidth, cellHeight);
                ctx.fillText(String.fromCharCode(code), 0, 0);
                const { data } = ctx.getImageData(0, 0, cellWidth, cellHeight);

                const glyph = new Uint8Array(cellHeight);
                for (let y = 0; y < cellHeight; y++) {
                    let row = 0;
                    for (let x = 0; x < cellWidth; x++) {
                        // alpha >= 128: ~50% opacity cutoff between ink and paper
                        const alpha = data[(y * cellWidth + x) * 4 + 3];
                        if (alpha >= 128) row |= (0x80 >> x);
                    }
                    glyph[y] = row & mask;
                }
                glyphs.push(glyph);
            }

            return glyphs;
        } finally {
            document.fonts.delete(face);
        }
    }
};

window.FontRasterizer = FontRasterizer;

})();
