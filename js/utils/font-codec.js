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
 * Versioned: `v` is checked on decode so a future format change can add
 * a migration instead of silently misreading old payloads.
 */
const FontCodec = {
    VERSION: 1,

    /** Legal glyph widths (pixel columns per glyph). */
    WIDTHS: Object.freeze([4, 6, 8]),

    /** Hard limit, also enforced by FontService. */
    MAX_GLYPHS: 256,

    /** Serialized-size sanity cap (a full 256-glyph font is ~2.8 KB encoded). */
    MAX_JSON_BYTES: 64 * 1024,

    _B64: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',

    /**
     * Encode a font document for storage / the library.
     * @param {Object} doc - { name, width, firstCode, glyphs }
     * @returns {Object|null} JSON-safe payload, or null if not encodable
     */
    encode(doc) {
        // Fonts are an 8-row glyph concept — pinned to the STANDARD_ULA cell,
        // not the runtime-switchable active mode (Phase 12a): a font stored
        // under any screen mode decodes identically under any other.
        const cellH = SCREEN_MODES.STANDARD_ULA.attrCellH;
        if (!doc || !this.WIDTHS.includes(doc.width) ||
            !Number.isInteger(doc.firstCode) || doc.firstCode < 0 ||
            !Array.isArray(doc.glyphs) ||
            doc.glyphs.length < 1 || doc.glyphs.length > this.MAX_GLYPHS ||
            doc.firstCode + doc.glyphs.length > this.MAX_GLYPHS) {
            return null;
        }

        const mask = (0xFF << (8 - doc.width)) & 0xFF;
        const bytes = new Uint8Array(doc.glyphs.length * cellH);
        for (let i = 0; i < doc.glyphs.length; i++) {
            const g = doc.glyphs[i];
            if (!g || g.length !== cellH) return null;
            for (let y = 0; y < cellH; y++) {
                bytes[i * cellH + y] = g[y] & mask;
            }
        }

        const payload = {
            v: this.VERSION,
            name: typeof doc.name === 'string' ? doc.name.slice(0, 64) : '',
            w: doc.width,
            first: doc.firstCode,
            count: doc.glyphs.length,
            g: this._toBase64(bytes)
        };

        // Size-cap sanity: never persist something a future boot would choke on
        if (JSON.stringify(payload).length > this.MAX_JSON_BYTES) return null;
        return payload;
    },

    /**
     * Decode a stored payload back to the font document shape.
     * @param {Object} payload - Object produced by encode()
     * @returns {Object|null} Document, or null if invalid/unknown version
     */
    decode(payload) {
        // Same pinning as encode() — glyph geometry is mode-independent
        const cellH = SCREEN_MODES.STANDARD_ULA.attrCellH;
        if (!payload || payload.v !== this.VERSION) return null;
        if (!this.WIDTHS.includes(payload.w)) return null;
        if (!Number.isInteger(payload.first) || payload.first < 0 ||
            !Number.isInteger(payload.count) ||
            payload.count < 1 || payload.count > this.MAX_GLYPHS ||
            payload.first + payload.count > this.MAX_GLYPHS ||
            typeof payload.g !== 'string') {
            return null;
        }

        const bytes = this._fromBase64(payload.g);
        if (!bytes || bytes.length !== payload.count * cellH) return null;

        const mask = (0xFF << (8 - payload.w)) & 0xFF;
        const glyphs = [];
        for (let i = 0; i < payload.count; i++) {
            const g = new Uint8Array(cellH);
            for (let y = 0; y < cellH; y++) {
                g[y] = bytes[i * cellH + y] & mask;
            }
            glyphs.push(g);
        }

        return {
            name: typeof payload.name === 'string' ? payload.name : '',
            width: payload.w,
            firstCode: payload.first,
            glyphs
        };
    },

    /**
     * Base64 encode (environment-independent).
     * @param {Uint8Array} bytes
     * @returns {string}
     * @private
     */
    _toBase64(bytes) {
        const T = this._B64;
        let out = '';
        for (let i = 0; i < bytes.length; i += 3) {
            const b0 = bytes[i], b1 = bytes[i + 1], b2 = bytes[i + 2];
            const n = (b0 << 16) | ((b1 || 0) << 8) | (b2 || 0);
            out += T[(n >> 18) & 63] + T[(n >> 12) & 63];
            out += i + 1 < bytes.length ? T[(n >> 6) & 63] : '=';
            out += i + 2 < bytes.length ? T[n & 63] : '=';
        }
        return out;
    },

    /**
     * Base64 decode; null on malformed input.
     * @param {string} str
     * @returns {Uint8Array|null}
     * @private
     */
    _fromBase64(str) {
        if (typeof str !== 'string' || str.length % 4 !== 0) return null;
        const T = this._B64;
        const pad = str.endsWith('==') ? 2 : str.endsWith('=') ? 1 : 0;
        const out = new Uint8Array((str.length / 4) * 3 - pad);
        let o = 0;
        for (let i = 0; i < str.length; i += 4) {
            const idx = [0, 1, 2, 3].map(k => {
                const ch = str[i + k];
                return ch === '=' ? 0 : T.indexOf(ch);
            });
            if (idx.some(v => v < 0)) return null;
            const n = (idx[0] << 18) | (idx[1] << 12) | (idx[2] << 6) | idx[3];
            if (o < out.length) out[o++] = (n >> 16) & 0xFF;
            if (o < out.length) out[o++] = (n >> 8) & 0xFF;
            if (o < out.length) out[o++] = n & 0xFF;
        }
        return out;
    }
};

window.FontCodec = FontCodec;
