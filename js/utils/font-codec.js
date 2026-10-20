'use strict';

/**
 * FontCodec — versioned, pure serializer for Sinclair raster fonts
 * (Phase 10: font editor persistence and the named-font library).
 *
 * Encodes FontService's document shape ({ name, width, firstCode,
 * glyphs: Array<Uint8Array(cellH)> }) to a JSON-safe payload and back,
 * following the ClipboardCodec/MapCodec pattern: glyph bytes are base64'd
 * with a local coder so the payload is identical under the IndexedDB and
 * localStorage backends and in Node.
 *
 * Glyph geometry: every glyph is `width` (4 / 6 / 8) pixels wide and one
 * attribute-cell high (8 rows in STANDARD_ULA), one byte per row, MSB =
 * leftmost pixel — the same row-byte layout as layer cell.pixels and
 * MapService tiles. Row bits beyond `width` are zero; decode() enforces
 * that by masking, so a stored font is always normalized.
 *
 * Coverage: `first` + glyph count describe the charset window (32+96 =
 * the ASCII set of the 768-byte CHR variant, 0+256 = a full set).
 *
 * Big fonts (Batch 10C): a font may also be 8, 16, 24 or 32 pixels wide and 8, 16, 24 or 32 high (CHX big
 * font sets), stored `height * ceil(width / 8)` bytes per glyph (see GlyphBits), with optional per-glyph
 * shading (how many 8-pixel columns are left out on the left and on the right; see FontService). Those are
 * stored as version 2. A classic font (4, 6 or 8 wide, 8 high, nothing shaded) is still written as version 1,
 * byte for byte as before, so older builds keep reading what a classic font saves.
 *
 * Coloured characters (CHX, owner decision 2026-10-19): `colours[i]` is null for an uncoloured glyph or the
 * ZX attribute byte of each 8x8 block of the full cell (ceil(width / 8) * (height / 8) bytes, left to right
 * then down). They ride in field `c` (base64; per glyph one flag byte, 1 = coloured, then its block bytes, all
 * zero when uncoloured) and only when some glyph is coloured - a font with colours is always version 2, since
 * version 1 has no room for them. An older build reading such a payload ignores `c` and keeps the pixels.
 *
 * Versioned: `v` is checked on decode so a future format change can add
 * a migration instead of silently misreading old payloads.
 */
const FontCodec = {
    VERSION: 1,
    VERSION_BIG: 2,

    /** Legal classic glyph widths (pixel columns per glyph). */
    WIDTHS: Object.freeze([4, 6, 8]),

    /** Legal big-font widths and heights (CHX characters grow in steps of 8, up to 32). */
    BIG_SIZES: Object.freeze([8, 16, 24, 32]),

    /** Hard limit, also enforced by FontService. */
    MAX_GLYPHS: 256,

    /**
     * Serialized-size sanity cap. [C] A full classic font is ~2.8 KB encoded; the heaviest big font (256 glyphs of 32 x 32
     * = 128 bytes each = 32,768 bytes = 43,692 base64 characters, plus 512 shading bytes = 684) is about 44.5 KB. Every
     * glyph coloured adds 256 x (1 + 16) = 4,352 bytes = 5,804 base64 characters: about 50.2 KB, still under the cap
     * (pinned by tests/chx-colour.test.js).
     */
    MAX_JSON_BYTES: 64 * 1024,

    /** True if width x height is a size a font can have. */
    validSize(width, height) {
        if (height === 8 && this.WIDTHS.includes(width)) return true;
        return this.BIG_SIZES.includes(width) && this.BIG_SIZES.includes(height);
    },

    /** Columns of 8 pixels in a glyph of this width. */
    columns(width) {
        return (width + 7) >> 3;
    },

    /** Shading list is usable: one [left, right] pair per glyph, never wider than the character. @private */
    _shadeOk(shade, count, width) {
        if (!Array.isArray(shade) || shade.length !== count) return false;
        const cols = this.columns(width);
        return shade.every(p => Array.isArray(p) && Number.isInteger(p[0]) && Number.isInteger(p[1]) &&
            p[0] >= 0 && p[1] >= 0 && p[0] + p[1] <= cols);
    },

    /** Blocks (8x8) in one glyph of this size. */
    blocks(width, height) {
        return this.columns(width) * (height >> 3);
    },

    /**
     * A colours list that can be stored: null when no glyph is coloured, false when it does not fit the font (wrong
     * length, a glyph with the wrong number of blocks), else the list itself. @private
     */
    _coloursOf(colours, count, width, height) {
        if (colours == null) return null;
        if (!Array.isArray(colours) || colours.length !== count) return false;
        const n = this.blocks(width, height);
        let any = false;
        for (const c of colours) {
            if (c == null) continue;
            if (!c || c.length !== n) return false;
            any = true;
        }
        return any ? colours : null;
    },

    /**
     * Encode a font document for storage / the library.
     * @param {Object} doc - { name, width, height?, firstCode, glyphs, shade? }
     * @returns {Object|null} JSON-safe payload, or null if not encodable
     */
    encode(doc) {
        if (!doc) return null;
        const height = doc.height === undefined ? 8 : doc.height;
        if (!this.validSize(doc.width, height) ||
            !Number.isInteger(doc.firstCode) || doc.firstCode < 0 ||
            !Array.isArray(doc.glyphs) ||
            doc.glyphs.length < 1 || doc.glyphs.length > this.MAX_GLYPHS ||
            doc.firstCode + doc.glyphs.length > this.MAX_GLYPHS) {
            return null;
        }

        const count = doc.glyphs.length;
        const size = GlyphBits.byteLength(doc.width, height);
        const bytes = new Uint8Array(count * size);
        for (let i = 0; i < count; i++) {
            const g = doc.glyphs[i];
            if (!g || g.length !== size) return null;
            bytes.set(g, i * size);
            GlyphBits.normalise(bytes.subarray(i * size, (i + 1) * size), doc.width, height);
        }

        let shade = null;
        if (doc.shade) {
            if (!this._shadeOk(doc.shade, count, doc.width)) return null;
            if (doc.shade.some(p => p[0] || p[1])) shade = doc.shade;
        }

        const colours = this._coloursOf(doc.colours, count, doc.width, height);
        if (colours === false) return null;

        const payload = {
            v: (height === 8 && doc.width <= 8 && !shade && !colours) ? this.VERSION : this.VERSION_BIG,
            name: typeof doc.name === 'string' ? doc.name.slice(0, 64) : '',
            w: doc.width,
            first: doc.firstCode,
            count,
            g: Helpers.encodeBase64(bytes)
        };
        if (payload.v === this.VERSION_BIG) {
            payload.h = height;
            if (shade) {
                const sb = new Uint8Array(count * 2);
                shade.forEach((p, i) => { sb[i * 2] = p[0]; sb[i * 2 + 1] = p[1]; });
                payload.s = Helpers.encodeBase64(sb);
            }
            if (colours) {
                const n = this.blocks(doc.width, height);
                const cb = new Uint8Array(count * (1 + n));
                colours.forEach((c, i) => {
                    if (!c) return;
                    cb[i * (1 + n)] = 1;
                    cb.set(c, i * (1 + n) + 1);
                });
                payload.c = Helpers.encodeBase64(cb);
            }
        }

        // Size-cap sanity: never persist something a future boot would choke on
        if (JSON.stringify(payload).length > this.MAX_JSON_BYTES) return null;
        return payload;
    },

    /**
     * Decode a stored payload back to the font document shape.
     * @param {Object} payload - Object produced by encode()
     * @returns {Object|null} Document { name, width, height, firstCode, glyphs, shade, colours }, or null if invalid/unknown version
     */
    decode(payload) {
        if (!payload || (payload.v !== this.VERSION && payload.v !== this.VERSION_BIG)) return null;
        const height = payload.v === this.VERSION ? 8 : payload.h;
        if (!this.validSize(payload.w, height)) return null;
        if (!Number.isInteger(payload.first) || payload.first < 0 ||
            !Number.isInteger(payload.count) ||
            payload.count < 1 || payload.count > this.MAX_GLYPHS ||
            payload.first + payload.count > this.MAX_GLYPHS ||
            typeof payload.g !== 'string') {
            return null;
        }

        const size = GlyphBits.byteLength(payload.w, height);
        const bytes = Helpers.decodeBase64(payload.g);
        if (!bytes || bytes.length !== payload.count * size) return null;

        const glyphs = [];
        for (let i = 0; i < payload.count; i++) {
            glyphs.push(GlyphBits.normalise(Uint8Array.from(bytes.subarray(i * size, (i + 1) * size)), payload.w, height));
        }

        let shade = null;
        if (payload.v === this.VERSION_BIG && payload.s !== undefined) {
            const sb = typeof payload.s === 'string' ? Helpers.decodeBase64(payload.s) : null;
            if (!sb || sb.length !== payload.count * 2) return null;
            shade = [];
            for (let i = 0; i < payload.count; i++) shade.push([sb[i * 2], sb[i * 2 + 1]]);
            if (!this._shadeOk(shade, payload.count, payload.w)) return null;
        }

        let colours = null;
        if (payload.v === this.VERSION_BIG && payload.c !== undefined) {
            const n = this.blocks(payload.w, height);
            const cb = typeof payload.c === 'string' ? Helpers.decodeBase64(payload.c) : null;
            if (!cb || cb.length !== payload.count * (1 + n)) return null;
            colours = [];
            for (let i = 0; i < payload.count; i++) {
                const o = i * (1 + n);
                if (cb[o] > 1) return null;
                colours.push(cb[o] ? Uint8Array.from(cb.subarray(o + 1, o + 1 + n)) : null);
            }
            if (!colours.some(Boolean)) colours = null;
        }

        return {
            name: typeof payload.name === 'string' ? payload.name : '',
            width: payload.w,
            height,
            firstCode: payload.first,
            glyphs,
            shade,
            colours
        };
    }
};

window.FontCodec = FontCodec;
