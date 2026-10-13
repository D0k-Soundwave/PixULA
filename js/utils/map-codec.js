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
 * Version 2 (Batch 11A) adds ELEMENTS: the results of "find repeated elements". An element is self-contained - its own dots and attribute bytes
 * (one or two screens), the match mode it was found with, the cell grid of the picture it belongs to, and the places it was found at - so it does
 * not depend on the tileset (tile numbers change when a tile is removed, and a GigaScreen cell does not fit an 8x8 tile). Version 1 payloads still
 * decode, with no elements.
 *
 * Versioned: `v` is checked on decode so a future format change can add a
 * migration instead of silently misreading old payloads.
 */
const MapCodec = {
    VERSION: 2,
    OLDEST_VERSION: 1,

    /** Match modes an element can carry (MapFind.MODES). */
    ELEMENT_MODES: Object.freeze(['exact', 'dots', 'visual']),

    /**
     * Most elements a document may hold. Only a guard against a hostile file: the real limit is the trial encode in MapService.addElement
     * (MAX_JSON_BYTES). Chosen so it never binds first - see docs/FIGURES.md, "Map elements".
     */
    MAX_ELEMENTS: 4096,

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

    /** @private one element -> its JSON-safe record, or null if it is not valid */
    _encodeElement(el) {
        if (!el || !Number.isInteger(el.w) || !Number.isInteger(el.h) || !Number.isInteger(el.gridW) || !Number.isInteger(el.gridH) ||
            el.w < 1 || el.h < 1 || el.gridW > this.MAX_DIM || el.gridH > this.MAX_DIM || el.w > el.gridW || el.h > el.gridH ||
            (el.screens !== 1 && el.screens !== 2) || !this.ELEMENT_MODES.includes(el.match) ||
            !el.bitmap || !el.attrs || !Array.isArray(el.positions)) {
            return null;
        }
        const cellH = SCREEN_MODES.STANDARD_ULA.attrCellH;
        const cells = el.screens * el.w * el.h;
        if (el.bitmap.length !== cells * cellH || el.attrs.length !== cells) return null;
        const n = el.positions.length;
        if (n < 1 || n > (el.gridW - el.w + 1) * (el.gridH - el.h + 1)) return null;
        const p = new Uint8Array(n * 2);
        for (let i = 0; i < n; i++) {
            const q = el.positions[i];
            if (!q || !Number.isInteger(q.x) || !Number.isInteger(q.y) || q.x < 0 || q.y < 0 ||
                q.x + el.w > el.gridW || q.y + el.h > el.gridH) {
                return null;
            }
            p[i * 2] = q.x; p[i * 2 + 1] = q.y;
        }
        return {
            n: typeof el.name === 'string' ? el.name.slice(0, 64) : '',
            w: el.w, h: el.h, s: el.screens, gw: el.gridW, gh: el.gridH, m: el.match,
            b: Helpers.encodeBase64(Uint8Array.from(el.bitmap)),
            a: Helpers.encodeBase64(Uint8Array.from(el.attrs)),
            p: Helpers.encodeBase64(p)
        };
    },

    /** @private one stored record -> an element, or null */
    _decodeElement(r) {
        if (!r || !Number.isInteger(r.w) || !Number.isInteger(r.h) || !Number.isInteger(r.gw) || !Number.isInteger(r.gh) ||
            r.w < 1 || r.h < 1 || r.gw > this.MAX_DIM || r.gh > this.MAX_DIM || r.w > r.gw || r.h > r.gh ||
            (r.s !== 1 && r.s !== 2) || !this.ELEMENT_MODES.includes(r.m) ||
            typeof r.b !== 'string' || typeof r.a !== 'string' || typeof r.p !== 'string') {
            return null;
        }
        const cellH = SCREEN_MODES.STANDARD_ULA.attrCellH;
        const cells = r.s * r.w * r.h;
        const bitmap = Helpers.decodeBase64(r.b), attrs = Helpers.decodeBase64(r.a), p = Helpers.decodeBase64(r.p);
        if (!bitmap || !attrs || !p || bitmap.length !== cells * cellH || attrs.length !== cells) return null;
        if (p.length < 2 || p.length % 2 !== 0 || p.length / 2 > (r.gw - r.w + 1) * (r.gh - r.h + 1)) return null;
        const positions = [];
        for (let i = 0; i < p.length; i += 2) {
            if (p[i] + r.w > r.gw || p[i + 1] + r.h > r.gh) return null;
            positions.push({ x: p[i], y: p[i + 1] });
        }
        return {
            name: typeof r.n === 'string' ? r.n : '', w: r.w, h: r.h, screens: r.s, gridW: r.gw, gridH: r.gh, match: r.m,
            bitmap, attrs, positions
        };
    },

    /**
     * Encode a map document for storage / the native file format.
     * @param {Object} doc - { name, tileKind, tiles, map, elements? }
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
            tiles.push({ b: Helpers.encodeBase64(Uint8Array.from(t.bitmap)), a: t.attr });
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

        const list = doc.elements === undefined ? [] : doc.elements;
        if (!Array.isArray(list) || list.length > this.MAX_ELEMENTS) return null;
        const elements = [];
        for (const el of list) {
            const rec = this._encodeElement(el);
            if (!rec) return null;
            elements.push(rec);
        }

        const payload = {
            v: this.VERSION,
            k: doc.tileKind,
            name: typeof doc.name === 'string' ? doc.name.slice(0, 64) : '',
            tiles,
            map: { w: width, h: height, cells: Helpers.encodeBase64(packed) },
            elements
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
        if (!payload || (payload.v !== this.VERSION && payload.v !== this.OLDEST_VERSION)) return null;
        if (payload.v >= 2 && !Array.isArray(payload.elements)) return null;
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
            const bitmap = Helpers.decodeBase64(t.b);
            if (!bitmap || bitmap.length !== cellH) return null;
            tiles.push({ kind: payload.k, bitmap, attr: t.a });
        }

        const width = payload.map.w, height = payload.map.h;
        const packed = Helpers.decodeBase64(payload.map.cells);
        if (!packed || packed.length !== width * height * 2) return null;

        const cells = new Int16Array(width * height);
        for (let i = 0; i < cells.length; i++) {
            const v = packed[i * 2] | (packed[i * 2 + 1] << 8);
            const idx = v - 1;
            if (idx < -1 || idx >= tiles.length) return null;
            cells[i] = idx;
        }

        const elements = [];
        if (payload.v >= 2) {
            if (payload.elements.length > this.MAX_ELEMENTS) return null;
            for (const r of payload.elements) {
                const el = this._decodeElement(r);
                if (!el) return null;
                elements.push(el);
            }
        }

        return {
            name: typeof payload.name === 'string' ? payload.name : '',
            tileKind: payload.k,
            tiles,
            map: { width, height, cells },
            elements
        };
    }
};

window.MapCodec = MapCodec;
