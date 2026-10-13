'use strict';
(function() {

/**
 * BitmapText - the pure half of "Type on canvas" (Batch 10B): typed text in a glyph-byte font (ZX ROM and library fonts) laid
 * out at ANY character width and height with character and line spacing, plus the text-buffer and caret geometry helpers.
 * No DOM, no tool: the Text tool gives it glyphs and a styling function and draws what comes back.
 *
 * Stretching is nearest-neighbour from the font's own glyph cells, so dots stay square-edged. Each glyph gets a SLOT of
 * `W` columns, slots start `W + spacing` apart, and a slot column c reads the source column floor(c * w0 / W) of its glyph;
 * overlapping slots (negative spacing) are ORed. With W = k * w0, H = k * h0 and no spacing the result is exactly what
 * scaling the whole line by k gives, which is how the Text tool's Size option has always stretched text.
 */
const BitmapText = {

    /**
     * Where the SAVED part of a glyph lies in its cell. A big (CHX) font can shade 8-pixel columns on the left and right of a
     * character; the file keeps only the rest, so that is what the Text tool draws and advances by. Unshaded, a glyph spans its whole
     * cell (4, 6 or 8 wide for the classic sizes). Null when nothing is left - the character is not in the file.
     * @param {number} width - cell width in pixels
     * @param {?number[]} shade - [left, right] shaded 8-pixel columns, or null
     * @returns {?{x0:number, w:number}}
     */
    span(width, shade) {
        const l = shade ? shade[0] : 0;
        const r = shade ? shade[1] : 0;
        const w = width - 8 * (l + r);
        return w > 0 ? { x0: 8 * l, w } : null;
    },

    /** Pixel (x, y) of a glyph whose rows are `fw` pixels wide, as 0 or 1 (rows are ceil(fw / 8) bytes, MSB = leftmost). */
    bit(bits, fw, x, y) {
        return (bits[y * ((fw + 7) >> 3) + (x >> 3)] >> (7 - (x & 7))) & 1;
    },

    /**
     * Everything the layout needs to know about a decoded library font (FontCodec shape).
     * glyphOf is null for a code the font does not have and for a character shaded all the way across, so typing refuses it
     * and the Text tool gives it no space - the text matches what the .chx file holds.
     * @returns {{glyphOf:function, spanOf:function, fw:number, w0:number, h0:number, proportional:boolean}}
     */
    fontSource(font) {
        const width = font.width;
        const index = (c) => c.charCodeAt(0) - font.firstCode;
        const shadeOf = (i) => (font.shade ? font.shade[i] : null);
        const glyphOf = (c) => {
            const i = index(c);
            if (!(i >= 0 && i < font.glyphs.length)) return null;
            return BitmapText.span(width, shadeOf(i)) ? font.glyphs[i] : null;
        };
        const spanOf = (c) => {
            const i = index(c);
            return (i >= 0 && i < font.glyphs.length && BitmapText.span(width, shadeOf(i))) || { x0: 0, w: width };
        };
        let proportional = false;
        if (font.shade) {
            for (let i = 0; i < font.glyphs.length && !proportional; i++) {
                const sp = BitmapText.span(width, font.shade[i]);
                if (sp && sp.w < width) proportional = true;
            }
        }
        return { glyphOf, spanOf, fw: width, w0: width, h0: font.height === undefined ? 8 : font.height, proportional };
    },

    /** Typed text split into lines, tolerating any line ending (the Text tool's rule). */
    splitLines(text) {
        return String(text == null ? '' : text).split(/\r\n|\r|\n/);
    },

    /**
     * The line and column of a caret index in the buffer.
     * @returns {{line:number, col:number}}
     */
    lineCol(text, index) {
        const t = String(text);
        const i = Helpers.clamp(index, 0, t.length);
        const before = BitmapText.splitLines(t.slice(0, i));
        return { line: before.length - 1, col: before[before.length - 1].length };
    },

    /** The buffer index of (line, col), the column clamped to the line's length. */
    indexOf(text, line, col) {
        const lines = BitmapText.splitLines(text);
        const l = Helpers.clamp(line, 0, lines.length - 1);
        let idx = 0;
        const seps = String(text).match(/\r\n|\r|\n/g) || [];
        for (let i = 0; i < l; i++) idx += lines[i].length + seps[i].length;
        return idx + Helpers.clamp(col, 0, lines[l].length);
    },

    /** Move the caret one line up (-1) or down (+1), keeping its column where the line is long enough. @returns {number} new index */
    moveVertical(text, index, dir) {
        const lines = BitmapText.splitLines(text);
        const { line, col } = BitmapText.lineCol(text, index);
        const target = line + dir;
        if (target < 0) return 0;
        if (target >= lines.length) return String(text).length;
        return BitmapText.indexOf(text, target, col);
    },

    /**
     * What of a typed or pasted string the font can draw. Line breaks pass; a character the font has no glyph for is
     * refused (and returned, so the caller can say which).
     * @param {string} str
     * @param {function(string): ?ArrayLike<number>} glyphOf
     * @returns {{text: string, refused: string[]}}
     */
    filterTyped(str, glyphOf) {
        let text = '';
        const refused = [];
        const units = String(str).replace(/\r\n|\r/g, '\n');
        for (let u = 0; u < units.length; u++) {
            const ch = units[u];
            if (ch === '\n') { text += '\n'; continue; }
            if (glyphOf(ch)) text += ch;
            else if (!refused.includes(ch)) refused.push(ch);
        }
        return { text, refused };
    },

    /**
     * One line of glyph-byte text at the font's own size, as the Text tool builds it (glyphs side by side, then the
     * bold / italic styling). Characters with no glyph take no space.
     * @returns {?{pixels:boolean[][], width:number, height:number, count:number}} null when nothing is drawable
     */
    nativeLine(text, o) {
        const glyphs = [];
        for (let u = 0; u < text.length; u++) { const g = o.glyphOf(text[u]); if (g) glyphs.push(g); }
        if (!glyphs.length) return null;
        const total = glyphs.length * o.w0;
        let pixels = Array.from({ length: o.h0 }, () => new Array(total).fill(false));
        glyphs.forEach((bitmap, i) => {
            for (let row = 0; row < o.h0; row++) {
                for (let col = 0; col < o.w0; col++) {
                    if ((bitmap[row] >> (7 - col)) & 1) pixels[row][i * o.w0 + col] = true;
                }
            }
        });
        let width = total, height = o.h0;
        if ((o.bold || o.italic) && o.style) {
            const s = o.style(pixels, total, o.h0, !!o.bold, !!o.italic);
            pixels = s.pixels; width = s.width; height = s.height;
        }
        return { pixels, width, height, count: glyphs.length };
    },

    /**
     * Stretch a native line to character size W x H with spacing sx (see the header).
     * @param {{pixels:boolean[][], width:number, height:number, count:number}} native
     * @param {number} w0 - the font's glyph width
     * @param {number} h0 - the font's glyph height
     * @returns {{pixels:boolean[][], width:number, height:number}}
     */
    stretchLine(native, w0, h0, W, H, sx) {
        const adv = Math.max(1, W + sx);
        const n = native.count;
        // The last slot also carries whatever the styling spilled to the right of the glyph cells (italic, bold).
        const lastSrcCols = native.width - (n - 1) * w0;
        const lastSlot = Math.max(1, Math.ceil(lastSrcCols * W / w0));
        const width = (n - 1) * adv + lastSlot;
        const out = Array.from({ length: H }, () => new Array(width).fill(false));
        for (let i = 0; i < n; i++) {
            const slotW = i === n - 1 ? lastSlot : W;
            for (let c = 0; c < slotW; c++) {
                const srcX = i * w0 + Math.floor(c * w0 / W);
                if (srcX >= native.width) continue;
                const x = i * adv + c;
                for (let y = 0; y < H; y++) {
                    const srcY = Math.min(native.height - 1, Math.floor(y * h0 / H));
                    if (native.pixels[srcY][srcX]) out[y][x] = true;
                }
            }
        }
        return { pixels: out, width, height: H };
    },

    /**
     * Lay typed text out: every line stretched and spaced, the lines stacked `H + lineSpacing` apart and lined up by
     * `align`. Also returns what the caret needs.
     * @param {string} text
     * @param {Object} o - { glyphOf, w0, h0, W, H, sx, sy, align, bold, italic, style }
     * @returns {?{pixels:boolean[][], width:number, height:number, adv:number, pitch:number, lines:Object[]}}
     *   null when the text draws nothing
     */
    layout(text, o) {
        const adv = Math.max(1, o.W + o.sx);
        const pitch = Math.max(1, o.H + o.sy);
        const srcLines = BitmapText.splitLines(text);
        const lines = srcLines.map((line, i) => {
            const native = BitmapText.nativeLine(line, o);
            const mask = native ? BitmapText.stretchLine(native, o.w0, o.h0, o.W, o.H, o.sx) : null;
            // before[c] = how many drawable glyphs lie before column c (the caret slot of column c). The buffer only ever
            // holds characters the font can draw (filterTyped), all in the basic plane, so a code unit is a character.
            const before = [0];
            let k = 0;
            for (let u = 0; u < line.length; u++) { if (o.glyphOf(line[u])) k++; before.push(k); }
            return { text: line, mask, before, y0: i * pitch, x0: 0 };
        });
        let crossMax = 0, total = 0;
        for (const l of lines) {
            if (!l.mask) continue;
            if (l.mask.width > crossMax) crossMax = l.mask.width;
            if (l.y0 + l.mask.height > total) total = l.y0 + l.mask.height;
        }
        const widest = crossMax;
        for (const l of lines) {
            const w = l.mask ? l.mask.width : 0;
            const slack = widest - w;
            l.x0 = o.align === 'center' ? Math.floor(slack / 2) : o.align === 'right' ? slack : 0;
        }
        if (!crossMax || total <= 0) return null;
        const pixels = Array.from({ length: total }, () => new Array(crossMax).fill(false));
        for (const l of lines) {
            if (!l.mask) continue;
            for (let y = 0; y < l.mask.height; y++) {
                for (let x = 0; x < l.mask.width; x++) {
                    if (l.mask.pixels[y][x]) pixels[l.y0 + y][l.x0 + x] = true;
                }
            }
        }
        return { pixels, width: crossMax, height: total, adv, pitch, lines, W: o.W, H: o.H };
    },

    /**
     * Where the caret bar is for (line, col), in the laid-out block's own coordinates: a bar `barW` wide and `H` tall at
     * the slot the next character would take. Works with no layout too (empty text): at the origin.
     * @param {?Object} lay - the result of layout()
     * @param {number} line @param {number} col
     * @param {Object} o - the layout options (W, H, sx, sy, align)
     * @returns {{x:number, y:number, w:number, h:number}}
     */
    caretRect(lay, line, col, o) {
        const barW = Math.max(1, Math.round(o.W / 8));
        const adv = Math.max(1, o.W + o.sx);
        const pitch = Math.max(1, o.H + o.sy);
        if (!lay) return { x: 0, y: line * pitch, w: barW, h: o.H };
        const l = lay.lines[Helpers.clamp(line, 0, lay.lines.length - 1)];
        const c = Helpers.clamp(col, 0, l.before.length - 1);
        return { x: l.x0 + l.before[c] * adv, y: l.y0, w: barW, h: o.H };
    }
};

window.BitmapText = BitmapText;

})();
