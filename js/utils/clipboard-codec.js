'use strict';

/**
 * ClipboardCodec — versioned, pure serializer for the internal clipboard
 * (Phase 9: ZXP-equivalent persistent clipboard).
 *
 * Encodes SelectionService's clipboard shape ({ width, height, pixels:
 * bool[][], cells: [{relX, relY, data:{ink,paper,bright,flash,pixels}}] })
 * to a JSON-safe object for Storage, and back. Pixel rows are packed to
 * bits (MSB = leftmost) and base64'd with a local coder so the payload is
 * identical under the IndexedDB and localStorage backends and in Node.
 *
 * Versioned: `v` is checked on decode so a future format change can add a
 * migration instead of silently misreading old payloads. All geometry
 * limits come from the active screen mode.
 *
 * Mode-tagged (Phase 12a, additive): payloads carry the screen-mode id they
 * were captured under; decode REJECTS a payload from another mode instead of
 * misreading its cell geometry. Payloads without a tag predate 12a and were
 * always captured in standard ULA.
 */
const ClipboardCodec = {
    VERSION: 1,

    /*
     * Serialized-size sanity cap.
     *
     * [M] 2026-08-07, every mode measured by encoding a full-canvas selection
     * with every pixel set and every cell distinct (the worst case a copy can
     * reach). The old 512 KB was set against "a full-screen clipboard is
     * ~15 KB", which was true of standard ULA and of nothing since:
     *
     *   layer2_640      640x256, 2,560 cells   479,036 B   91.4% of 512 KB
     *   multicolor_8x1  256x192, 6,144 cells   411,587 B   78.5%
     *   layer2_320      320x256, 1,280 cells   239,156 B   45.6%
     *   standard_ula    256x192,   768 cells    77,809 B   14.8%
     *
     * Under 9% headroom on the largest mode the app supports is not a margin,
     * and the failure is SILENT - the clipboard simply does not persist, so a
     * copy survives until the next reload and then is not there. 4 MB is ~8.5x
     * the measured worst case, which leaves room for a mode larger than
     * anything in the registry today.
     */
    MAX_JSON_BYTES: 4 * 1024 * 1024,

    _B64: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',

    /**
     * Encode a clipboard object for storage.
     * @param {Object} clipboard - { width, height, pixels, cells }
     * @returns {Object|null} JSON-safe payload, or null if not encodable
     */
    encode(clipboard) {
        if (!clipboard || !clipboard.pixels ||
            !Number.isInteger(clipboard.width) || !Number.isInteger(clipboard.height) ||
            clipboard.width < 1 || clipboard.height < 1 ||
            clipboard.width > ZX_SPECTRUM.WIDTH || clipboard.height > ZX_SPECTRUM.HEIGHT) {
            return null;
        }

        const { width, height, pixels, cells } = clipboard;
        const bytesPerRow = Math.ceil(width / 8);
        const packed = new Uint8Array(bytesPerRow * height);

        for (let y = 0; y < height; y++) {
            const row = pixels[y] || [];
            for (let x = 0; x < width; x++) {
                if (row[x]) {
                    packed[y * bytesPerRow + (x >> 3)] |= 0x80 >> (x & 7);
                }
            }
        }

        const payload = {
            v: this.VERSION,
            mode: ACTIVE_SCREEN_MODE.id,
            w: width,
            h: height,
            // Where this was copied from -- see SelectionService.copyToClipboard.
            // Optional: 0 is a legitimate coordinate, so callers treat a missing
            // value (older payload, or clipboard built without a selection) the
            // same as 0 via `|| 0`, not as "must reject this payload".
            ox: Number.isInteger(clipboard.originX) ? clipboard.originX : 0,
            oy: Number.isInteger(clipboard.originY) ? clipboard.originY : 0,
            bits: this._toBase64(packed),
            cells: (cells || []).map(c => ({
                x: c.relX,
                y: c.relY,
                ink: c.data.ink,
                paper: c.data.paper,
                bright: c.data.bright ? 1 : 0,
                flash: c.data.flash ? 1 : 0,
                px: Array.from(c.data.pixels || [])
            }))
        };

        // Indexed-mode clipboards (Phase 13): the per-pixel palette indices
        // ride as one byte per pixel (the packed `bits` mask above already
        // says which pixels are present; absent pixels store 0).
        if (clipboard.indices) {
            const idxBytes = new Uint8Array(width * height);
            for (let y = 0; y < height; y++) {
                const row = clipboard.indices[y] || [];
                for (let x = 0; x < width; x++) {
                    idxBytes[y * width + x] = row[x] >= 0 ? row[x] & 0xFF : 0;
                }
            }
            payload.idx = this._toBase64(idxBytes);
        }

        // Size-cap sanity: never persist something a future boot would choke on
        if (JSON.stringify(payload).length > this.MAX_JSON_BYTES) return null;
        return payload;
    },

    /**
     * Decode a stored payload back to the clipboard shape.
     * @param {Object} payload - Object produced by encode()
     * @returns {Object|null} Clipboard object, or null if invalid/unknown version
     */
    decode(payload) {
        if (!payload || payload.v !== this.VERSION) return null;

        // Cross-mode payloads have a different cell geometry — reject rather
        // than misread. Untagged payloads predate 12a (standard ULA).
        const payloadMode = payload.mode || SCREEN_MODES.STANDARD_ULA.id;
        if (payloadMode !== ACTIVE_SCREEN_MODE.id) return null;

        const width = payload.w, height = payload.h;
        if (!Number.isInteger(width) || !Number.isInteger(height) ||
            width < 1 || height < 1 ||
            width > ZX_SPECTRUM.WIDTH || height > ZX_SPECTRUM.HEIGHT ||
            typeof payload.bits !== 'string' || !Array.isArray(payload.cells)) {
            return null;
        }

        const bytesPerRow = Math.ceil(width / 8);
        const packed = this._fromBase64(payload.bits);
        if (!packed || packed.length !== bytesPerRow * height) return null;

        const pixels = [];
        for (let y = 0; y < height; y++) {
            const row = [];
            for (let x = 0; x < width; x++) {
                row.push((packed[y * bytesPerRow + (x >> 3)] & (0x80 >> (x & 7))) !== 0);
            }
            pixels.push(row);
        }

        const maxCellsX = Math.ceil(width / ZX_SPECTRUM.CELL_WIDTH);
        const maxCellsY = Math.ceil(height / ZX_SPECTRUM.CELL_HEIGHT);
        const cells = [];
        for (const c of payload.cells) {
            if (!c || !Number.isInteger(c.x) || !Number.isInteger(c.y) ||
                c.x < 0 || c.y < 0 || c.x >= maxCellsX + 1 || c.y >= maxCellsY + 1 ||
                !Array.isArray(c.px) || c.px.length !== ZX_SPECTRUM.CELL_HEIGHT) {
                return null;
            }
            cells.push({
                relX: c.x,
                relY: c.y,
                data: {
                    ink: c.ink & 7,
                    paper: c.paper & 7,
                    bright: !!c.bright,
                    flash: !!c.flash,
                    pixels: Uint8Array.from(c.px.map(b => b & 0xFF))
                }
            });
        }

        const clipboard = {
            width, height, pixels, cells,
            originX: Number.isInteger(payload.ox) ? payload.ox : 0,
            originY: Number.isInteger(payload.oy) ? payload.oy : 0
        };

        // Indexed payload: rebuild the index rows (mask bit clear -> −1)
        if (typeof payload.idx === 'string') {
            const idxBytes = this._fromBase64(payload.idx);
            if (!idxBytes || idxBytes.length !== width * height) return null;
            clipboard.indices = [];
            for (let y = 0; y < height; y++) {
                const row = [];
                for (let x = 0; x < width; x++) {
                    row.push(pixels[y][x] ? idxBytes[y * width + x] : -1);
                }
                clipboard.indices.push(row);
            }
        }

        return clipboard;
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

window.ClipboardCodec = ClipboardCodec;
