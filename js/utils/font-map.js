'use strict';

/**
 * FontMap - pure geometry for the Font Editor's all-characters map (Batch 10C2b).
 *
 * The map lays every glyph of the working font out in a grid, 16 across, in character-code order, as ONE bitmap (a byte per pixel,
 * 0 or 1), so a stroke can cross from one character into the next. FontMap converts between that bitmap and the list of glyphs
 * (GlyphBits layout) and answers "which character is this pixel in". No DOM, no state.
 *
 * Sizes [C]: 16 columns x 16 rows of 32 x 32 characters is 512 x 512 = 262,144 pixels, a byte each.
 */
const FontMap = {
    COLUMNS: 16,

    /** Map geometry for a font: { cols, rows, width, height } in pixels. */
    layout(gw, gh, count) {
        const cols = this.COLUMNS;
        const rows = Math.ceil(count / cols);
        return { cols, rows, width: cols * gw, height: rows * gh };
    },

    /** The top-left pixel of glyph `index`: { x, y, w, h }. */
    glyphRect(index, gw, gh) {
        return { x: (index % this.COLUMNS) * gw, y: Math.floor(index / this.COLUMNS) * gh, w: gw, h: gh };
    },

    /**
     * Which character holds map pixel (x, y)? Null outside the map or in the unused cells after the last glyph.
     * @returns {{index:number, lx:number, ly:number, col8:number}|null} lx / ly inside the glyph, col8 = its 8-pixel column
     */
    cellAt(x, y, gw, gh, count) {
        if (x < 0 || y < 0 || !Number.isInteger(x) || !Number.isInteger(y)) return null;
        const cx = Math.floor(x / gw), cy = Math.floor(y / gh);
        if (cx >= this.COLUMNS) return null;
        const index = cy * this.COLUMNS + cx;
        if (index >= count) return null;
        const lx = x - cx * gw, ly = y - cy * gh;
        return { index, lx, ly, col8: lx >> 3 };
    },

    /** All glyphs -> one bitmap. */
    compose(glyphs, gw, gh) {
        const { width, height } = this.layout(gw, gh, glyphs.length);
        const map = new Uint8Array(width * height);
        const bpr = GlyphBits.bytesPerRow(gw);
        for (let i = 0; i < glyphs.length; i++) {
            const g = glyphs[i];
            const { x: ox, y: oy } = this.glyphRect(i, gw, gh);
            for (let y = 0; y < gh; y++) {
                const row = (oy + y) * width + ox;
                for (let b = 0; b < bpr; b++) {
                    const v = g[y * bpr + b];
                    if (!v) continue;
                    for (let bit = 0; bit < 8; bit++) {
                        const x = b * 8 + bit;
                        if (x < gw && (v & (0x80 >> bit))) map[row + x] = 1;
                    }
                }
            }
        }
        return map;
    },

    /**
     * Rebuild the glyphs listed in `indices` from the bitmap; every other glyph is returned as a copy of the one given.
     * @param {Uint8Array} map
     * @param {Uint8Array[]} glyphs - the current glyphs
     * @param {Iterable<number>} indices - glyph indices to rebuild
     * @returns {Uint8Array[]} a new list
     */
    decompose(map, glyphs, gw, gh, indices) {
        const { width } = this.layout(gw, gh, glyphs.length);
        const out = glyphs.map(g => Uint8Array.from(g));
        for (const i of indices) {
            if (i < 0 || i >= glyphs.length) continue;
            const g = GlyphBits.create(gw, gh);
            const { x: ox, y: oy } = this.glyphRect(i, gw, gh);
            for (let y = 0; y < gh; y++) {
                for (let x = 0; x < gw; x++) {
                    if (map[(oy + y) * width + ox + x]) GlyphBits.setPixel(g, gw, x, y, true);
                }
            }
            out[i] = g;
        }
        return out;
    },

    /**
     * Fill the connected area of equal pixels around (x, y), staying inside ONE character (the one holding (x, y)).
     * @returns {number[]} the glyph index touched (one entry), or [] if nothing changed
     */
    fillInside(map, x, y, value, gw, gh, count) {
        const c = this.cellAt(x, y, gw, gh, count);
        if (!c) return [];
        const { width } = this.layout(gw, gh, count);
        const r = this.glyphRect(c.index, gw, gh);
        const target = map[y * width + x];
        const want = value ? 1 : 0;
        if (target === want) return [];
        const stack = [[x, y]];
        while (stack.length) {
            const [px, py] = stack.pop();
            if (px < r.x || py < r.y || px >= r.x + r.w || py >= r.y + r.h) continue;
            if (map[py * width + px] !== target) continue;
            map[py * width + px] = want;
            stack.push([px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1]);
        }
        return [c.index];
    },

    /**
     * Set one pixel. Returns the glyph index it belongs to, or -1 if it is outside every character.
     */
    setPixel(map, x, y, value, gw, gh, count) {
        const c = this.cellAt(x, y, gw, gh, count);
        if (!c) return -1;
        const { width } = this.layout(gw, gh, count);
        map[y * width + x] = value ? 1 : 0;
        return c.index;
    },

    /**
     * Draw a line of pixels from (x0, y0) to (x1, y1) (Bresenham), collecting the glyph indices it touched.
     * @param {Set<number>} touched
     */
    line(map, x0, y0, x1, y1, value, gw, gh, count, touched) {
        let x = x0, y = y0;
        const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
        const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
        let err = dx - dy;
        for (;;) {
            const i = this.setPixel(map, x, y, value, gw, gh, count);
            if (i >= 0) touched.add(i);
            if (x === x1 && y === y1) break;
            const e2 = 2 * err;
            if (e2 > -dy) { err -= dy; x += sx; }
            if (e2 < dx) { err += dx; y += sy; }
        }
    }
};

window.FontMap = FontMap;
