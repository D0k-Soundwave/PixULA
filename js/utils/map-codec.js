'use strict';

/**
 * MapCodec — versioned, pure serializer for tilesets + tile maps
 * (Phase 11: map/tile editor persistence and the native .zxtm format).
 *
 * Encodes MapService's document shape ({ name, tileKind, tiles:
 * [{ bitmap: Uint8Array, attr: byte }], map: { width, height, cells:
 * Int16Array (-1 = empty) } }) to a JSON-safe payload and back, following
 * the ClipboardCodec pattern: bitmaps are base64'd with a local coder so
 * the payload is identical under the IndexedDB and localStorage backends
 * and in Node; map cells are stored as 16-bit little-endian (index + 1,
 * 0 = empty) and base64'd.
 *
 * The tile KIND is part of the payload (`k`). Only 'ula-cell' (8 bitmap
 * bytes + 1 ZX attribute — the standard ULA cell) exists until Phase 13,
 * when Next tilemap banks land as additional kinds with their own byte
 * geometry; decode() rejects unknown kinds instead of misreading them.
 * The KIND is the payload's mode tag (Phase 12a): each kind defines its
 * own byte geometry — pinned to the kind's descriptor, NOT the runtime-
 * switchable active mode — so a map stored under standard ULA can never
 * be misread while a multicolor mode is active. The map editor's canvas
 * bridges gate separately on the active mode being cell-compatible.
 *
 * Versioned: `v` is checked on decode so a future format change can add a
 * migration instead of silently misreading old payloads.
 */
const MapCodec = {
    VERSION: 1,

    /**
     * Tile kinds. ULA_CELL is the only kind the codec ENCODES/DECODES —
     * the working document's editable tiles. NEXT_4BPP (Phase 13) is the
     * export-side kind: DevFormat.generateNextTilemap converts ula-cell
     * tiles into Next 4bpp tile definitions at export time; no persisted
     * payload carries it yet, so decode() keeps rejecting it (the kind
     * seam's misread protection) until an in-editor authoring path lands.
     */
    TILE_KINDS: Object.freeze({ ULA_CELL: 'ula-cell', NEXT_4BPP: 'next-4bpp' }),

    /** Hard limits, also enforced by MapService. */
    MAX_DIM: 256,      // map width/height in tiles (256×192 tiles = 64 screens)

    /*
     * [M] 2026-08-07, encoding a full 256x256 map (MAX_DIM, 65,536 cells) with
     * every tile distinct, measured as JSON.stringify length of the payload:
     *
     *   grid + 1 tile   174,882 B   16.7% of MAX_JSON_BYTES
     *   1,024 tiles     204,111 B   19.5%
     *   4,096 tiles     291,879 B   27.8%
     *   8,192 tiles     408,903 B   39.0%
     *
     * The INDEX GRID is the floor and dominates; a tile adds ~28.6 B encoded
     * (9 raw bytes, base64'd, inside a JSON array). MAX_JSON_BYTES only starts
     * to bind at roughly 30,500 tiles, so the old 1024 was not protecting the
     * record cap - it was just a small number. Raised to 4096 so a detailed
     * multi-screen map does not hit a wall at 27.8% of its own budget.
     */
    MAX_TILES: 4096,

    /** Serialized-size sanity cap (a 256×256 map is ~180 KB encoded, M above). */
    MAX_JSON_BYTES: 1024 * 1024,

    _B64: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',

    /**
     * Encode a map document for storage / the native file format.
     * @param {Object} doc - { name, tileKind, tiles, map }
     * @returns {Object|null} JSON-safe payload, or null if not encodable
     */
    encode(doc) {
        if (!doc || doc.tileKind !== this.TILE_KINDS.ULA_CELL ||
            !Array.isArray(doc.tiles) || doc.tiles.length > this.MAX_TILES ||
            !doc.map ||
            !Number.isInteger(doc.map.width) || !Number.isInteger(doc.map.height) ||
            doc.map.width < 1 || doc.map.height < 1 ||
            doc.map.width > this.MAX_DIM || doc.map.height > this.MAX_DIM) {
            return null;
        }

        // 'ula-cell' geometry comes from the KIND, not the active mode
        const cellH = SCREEN_MODES.STANDARD_ULA.attrCellH;
        const tiles = [];
        for (const t of doc.tiles) {
            if (!t || !t.bitmap || t.bitmap.length !== cellH ||
                !Number.isInteger(t.attr) || t.attr < 0 || t.attr > 0xFF) {
                return null;
            }
            tiles.push({ b: this._toBase64(Uint8Array.from(t.bitmap)), a: t.attr });
        }

        const { width, height, cells } = doc.map;
        if (!cells || cells.length !== width * height) return null;
        const packed = new Uint8Array(width * height * 2);
        for (let i = 0; i < cells.length; i++) {
            const idx = cells[i];
            if (idx < -1 || idx >= tiles.length) return null;
            const v = idx + 1; // 0 = empty
            packed[i * 2] = v & 0xFF;
            packed[i * 2 + 1] = (v >> 8) & 0xFF;
        }

        const payload = {
            v: this.VERSION,
            k: doc.tileKind,
            name: typeof doc.name === 'string' ? doc.name.slice(0, 64) : '',
            tiles,
            map: { w: width, h: height, cells: this._toBase64(packed) }
        };

        // Size-cap sanity: never persist something a future boot would choke on
        if (JSON.stringify(payload).length > this.MAX_JSON_BYTES) return null;
        return payload;
    },

    /**
     * Decode a stored payload back to the map document shape.
     * @param {Object} payload - Object produced by encode()
     * @returns {Object|null} Document, or null if invalid/unknown version/kind
     */
    decode(payload) {
        if (!payload || payload.v !== this.VERSION) return null;
        if (payload.k !== this.TILE_KINDS.ULA_CELL) return null;
        if (!Array.isArray(payload.tiles) || payload.tiles.length > this.MAX_TILES) return null;
        if (!payload.map ||
            !Number.isInteger(payload.map.w) || !Number.isInteger(payload.map.h) ||
            payload.map.w < 1 || payload.map.h < 1 ||
            payload.map.w > this.MAX_DIM || payload.map.h > this.MAX_DIM ||
            typeof payload.map.cells !== 'string') {
            return null;
        }

        // 'ula-cell' geometry comes from the KIND, not the active mode
        const cellH = SCREEN_MODES.STANDARD_ULA.attrCellH;
        const tiles = [];
        for (const t of payload.tiles) {
            if (!t || typeof t.b !== 'string' ||
                !Number.isInteger(t.a) || t.a < 0 || t.a > 0xFF) {
                return null;
            }
            const bitmap = this._fromBase64(t.b);
            if (!bitmap || bitmap.length !== cellH) return null;
            tiles.push({ kind: payload.k, bitmap, attr: t.a });
        }

        const width = payload.map.w, height = payload.map.h;
        const packed = this._fromBase64(payload.map.cells);
        if (!packed || packed.length !== width * height * 2) return null;

        const cells = new Int16Array(width * height);
        for (let i = 0; i < cells.length; i++) {
            const v = packed[i * 2] | (packed[i * 2 + 1] << 8);
            const idx = v - 1;
            if (idx < -1 || idx >= tiles.length) return null;
            cells[i] = idx;
        }

        return {
            name: typeof payload.name === 'string' ? payload.name : '',
            tileKind: payload.k,
            tiles,
            map: { width, height, cells }
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

window.MapCodec = MapCodec;
