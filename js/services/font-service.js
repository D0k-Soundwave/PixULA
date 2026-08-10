'use strict';
(function() {

/**
 * FontService — Sinclair raster font data model (Phase 10 font editor).
 *
 * Pure data service (no DOM): owns the working font, all glyph-editing
 * operations, the canvas-capture bridge, and persistence into the FONTS
 * Storage store via the versioned FontCodec (working font + a small
 * named-font library).
 *
 * Model:
 *   glyph — one character bitmap: Uint8Array(cellH) row bytes, MSB =
 *           leftmost pixel (the same row-byte layout as layer cell.pixels
 *           and MapService tiles). Row bits beyond the font width are
 *           always zero (every mutation masks).
 *   font  — { name, width (4|6|8), firstCode, glyphs[] }. Glyph height is
 *           one attribute cell of the active mode (8 in STANDARD_ULA);
 *           width varies per font, which is why CellGridEditor supports
 *           width ≠ height. firstCode + glyphs.length describe the
 *           charset coverage: 32+96 (the ASCII window of the 768-byte
 *           CHR variant) or 0+256 (a full extended-ANSI set).
 *
 * Commands come down as direct calls; facts go up ONLY via
 * EVENTS.FONT_CHANGED / FONT_LOADED / FONT_LIBRARY_CHANGED.
 */
class FontServiceClass {
    constructor() {
        this.WIDTHS = FontCodec.WIDTHS;
        this.MAX_GLYPHS = FontCodec.MAX_GLYPHS;
        this.STORAGE_KEY = 'current';
        this.LIBRARY_KEY = 'library';
        /*
         * How many named bitmap charsets the library holds.
         *
         * These are ZX character sets you draw in the Font Editor or import
         * from a .CH8/.CHR file - nothing to do with the system fonts the text
         * tool lists, which are enumerated live and never stored.
         *
         * [M] 2026-08-07, measured in Chrome: the heaviest possible font (256
         * glyphs, 8 rows) encodes to 2,785 bytes of JSON. [C] 256 of them is
         * 713 KB, which is nothing to IndexedDB - so the old cap of 64 was
         * bounding a record that was never near a limit. Raised to 256, which
         * is past the point where anyone is finding a charset by scrolling.
         *
         * The real guard is now MAX_LIBRARY_BYTES below. This count only stops
         * the list becoming unnavigable.
         */
        this.MAX_LIBRARY_FONTS = 256;

        /*
         * [C] The byte cap the library record never had.
         *
         * _persistLibrary writes the whole collection in one record, and
         * FontCodec.MAX_JSON_BYTES (64 KB) caps ONE font inside encode(), never
         * the set - so until now nothing bounded this at all, and it survived
         * only because 64 fonts could not get large enough to matter. At the
         * new count it could: 2 MB is 256 heaviest-case fonts (713 KB, M above)
         * with room for names and future fields, and it matches the order of
         * every other persistence path here (MapCodec 1 MB, ClipboardCodec
         * 512 KB, PresetCodec 256 KB).
         */
        this.MAX_LIBRARY_BYTES = 2 * 1024 * 1024;

        /** Charset coverages the editor offers (ASCII = the CHR-768 window). */
        this.COVERAGES = Object.freeze({
            ASCII: { firstCode: 32, count: 96 },
            FULL: { firstCode: 0, count: 256 }
        });

        this.name = '';
        this.width = 8;
        this.firstCode = ZX_ROM_FONT_FIRST;
        /** @type {Uint8Array[]} */
        this.glyphs = [];

        this._glyphClipboard = null;   // Uint8Array copy from copyGlyph
        this._library = {};            // name -> FontCodec payload (mirror of the store)
        this._decodedCache = new Map();// name -> decoded doc (for the text tool's hot path)
        this._persistTimer = null;

        this.resetToROM(false);
    }

    // ── Geometry helpers ───────────────────────────────────────────────────

    /**
     * Glyph pixel geometry ({ w, h }). Sinclair fonts are an 8-pixel-row
     * concept regardless of the active screen mode (Phase 12a: pinned to
     * the STANDARD_ULA cell, NOT the runtime-switchable descriptor — the
     * canvas capture bridge gates separately on mode compatibility).
     */
    getGlyphSize() {
        return { w: this.width, h: SCREEN_MODES.STANDARD_ULA.attrCellH };
    }

    /** Highest-bits row mask for the current width. @private */
    _mask() {
        return (0xFF << (8 - this.width)) & 0xFF;
    }

    /** Coverage window ({ firstCode, count }). */
    getCoverage() {
        return { firstCode: this.firstCode, count: this.glyphs.length };
    }

    /** True if a character code falls inside the coverage window. */
    hasCode(code) {
        return Number.isInteger(code) &&
               code >= this.firstCode && code < this.firstCode + this.glyphs.length;
    }

    // ── Glyph access / editing (all by character code) ─────────────────────

    /** The live glyph bytes for a code (treat as read-only), or null. */
    getGlyph(code) {
        return this.hasCode(code) ? this.glyphs[code - this.firstCode] : null;
    }

    /**
     * Replace a glyph's bitmap (copied; masked to the font width).
     * @param {Uint8Array|Array<number>} bytes - cellH row bytes
     * @returns {boolean}
     */
    setGlyph(code, bytes) {
        const { h } = this.getGlyphSize();
        if (!this.hasCode(code) || !bytes || bytes.length !== h) return false;
        const mask = this._mask();
        const g = new Uint8Array(h);
        for (let y = 0; y < h; y++) g[y] = bytes[y] & mask;
        this.glyphs[code - this.firstCode] = g;
        this._announceFont();
        return true;
    }

    clearGlyph(code) {
        const g = this.getGlyph(code);
        if (!g) return false;
        g.fill(0);
        this._announceFont();
        return true;
    }

    /** Copy a glyph into the service-level glyph clipboard. */
    copyGlyph(code) {
        const g = this.getGlyph(code);
        if (!g) return false;
        this._glyphClipboard = Uint8Array.from(g);
        return true;
    }

    /** Paste the glyph clipboard onto a code (masked to the current width). */
    pasteGlyph(code) {
        if (!this._glyphClipboard) return false;
        return this.setGlyph(code, this._glyphClipboard);
    }

    hasGlyphClipboard() {
        return this._glyphClipboard !== null;
    }

    /**
     * Mirror a glyph. 'h' flips within the font width (left column <->
     * rightmost used column), 'v' flips the rows.
     * @param {string} axis - 'h' | 'v'
     */
    flipGlyph(code, axis) {
        const g = this.getGlyph(code);
        if (!g) return false;
        const { w, h } = this.getGlyphSize();
        if (axis === 'h') {
            for (let y = 0; y < h; y++) {
                let out = 0;
                for (let x = 0; x < w; x++) {
                    if (g[y] & (0x80 >> x)) out |= 0x80 >> (w - 1 - x);
                }
                g[y] = out;
            }
        } else if (axis === 'v') {
            g.reverse();
        } else {
            return false;
        }
        this._announceFont();
        return true;
    }

    /**
     * Shift a glyph one pixel with wrap-around (within the font width).
     * @param {string} dir - 'left' | 'right' | 'up' | 'down'
     */
    shiftGlyph(code, dir) {
        const g = this.getGlyph(code);
        if (!g) return false;
        const { w, h } = this.getGlyphSize();
        const mask = this._mask();
        switch (dir) {
            case 'left':
                for (let y = 0; y < h; y++) {
                    const carry = (g[y] & 0x80) ? 0x80 >> (w - 1) : 0;
                    g[y] = ((g[y] << 1) | carry) & mask;
                }
                break;
            case 'right':
                for (let y = 0; y < h; y++) {
                    const low = 0x80 >> (w - 1);
                    const carry = (g[y] & low) ? 0x80 : 0;
                    g[y] = ((g[y] >> 1) | carry) & mask;
                }
                break;
            case 'up': {
                const first = g[0];
                for (let y = 0; y < h - 1; y++) g[y] = g[y + 1];
                g[h - 1] = first;
                break;
            }
            case 'down': {
                const last = g[h - 1];
                for (let y = h - 1; y > 0; y--) g[y] = g[y - 1];
                g[0] = last;
                break;
            }
            default:
                return false;
        }
        this._announceFont();
        return true;
    }

    /** Invert a glyph's pixels (within the font width). */
    invertGlyph(code) {
        const g = this.getGlyph(code);
        if (!g) return false;
        const mask = this._mask();
        for (let y = 0; y < g.length; y++) g[y] = ~g[y] & mask;
        this._announceFont();
        return true;
    }

    // ── Font-level operations ──────────────────────────────────────────────

    /**
     * Change the glyph width (re-shape the font). Existing glyphs keep
     * their left-aligned pixels: narrowing crops the right-hand columns
     * (destructive), widening exposes blank new columns.
     * @param {number} width - 4 | 6 | 8
     */
    setWidth(width) {
        if (!this.WIDTHS.includes(width) || width === this.width) return false;
        this.width = width;
        const mask = this._mask();
        for (const g of this.glyphs) {
            for (let y = 0; y < g.length; y++) g[y] &= mask;
        }
        this._announceFont();
        return true;
    }

    /**
     * Change the charset coverage window. Codes present in both windows
     * keep their glyphs; codes only in the new window start blank.
     * @param {string} coverage - 'ASCII' | 'FULL'
     */
    setCoverage(coverage) {
        const target = this.COVERAGES[coverage];
        if (!target) return false;
        if (target.firstCode === this.firstCode && target.count === this.glyphs.length) {
            return false;
        }
        const { h } = this.getGlyphSize();
        const next = [];
        for (let i = 0; i < target.count; i++) {
            const code = target.firstCode + i;
            const g = this.getGlyph(code);
            next.push(g ? g : new Uint8Array(h));
        }
        this.firstCode = target.firstCode;
        this.glyphs = next;
        this._announceFont();
        return true;
    }

    /** Set the font name (persisted with the font). */
    setName(name) {
        this.name = String(name || '').slice(0, 64);
        this._schedulePersist();
    }

    /**
     * Load the built-in ZX-ROM-style charset (js/data/zx-rom-font.js)
     * into the coverage window. The ROM glyphs are 8 pixels wide, so the
     * width resets to 8; codes outside 32..127 become blank.
     * @param {boolean} [announce=true]
     */
    resetToROM(announce = true) {
        const { h } = this.getGlyphSize();
        this.width = 8;
        const count = this.glyphs.length || this.COVERAGES.ASCII.count;
        const firstCode = this.glyphs.length ? this.firstCode : this.COVERAGES.ASCII.firstCode;
        const next = [];
        for (let i = 0; i < count; i++) {
            const code = firstCode + i;
            const g = new Uint8Array(h);
            if (code >= ZX_ROM_FONT_FIRST && code < ZX_ROM_FONT_FIRST + ZX_ROM_FONT_COUNT) {
                g.set(ZX_ROM_FONT.subarray((code - ZX_ROM_FONT_FIRST) * h,
                                           (code - ZX_ROM_FONT_FIRST + 1) * h));
            }
            next.push(g);
        }
        this.firstCode = firstCode;
        this.glyphs = next;
        if (announce) this._announceFont();
        return true;
    }

    // ── Canvas bridge ──────────────────────────────────────────────────────

    /**
     * Capture one attribute cell of the composited visible layers (the
     * same source as SCR export) into a glyph — "import glyph from the
     * canvas". Ink bits become set pixels; columns beyond the font width
     * are cropped.
     * @param {number} cellX - canvas cell column (0-based)
     * @param {number} cellY - canvas cell row
     * @param {number} code - destination character code
     * @returns {boolean}
     */
    captureGlyphFromCanvasCell(cellX, cellY, code) {
        if (!window.LayerManager || !this.hasCode(code)) return false;
        // Glyphs are 8-row 1-bit cells — capture only works while the canvas
        // has 8×8 attribute cells with classic bitmask pixels (the UI gates
        // too; this is the model guard). Indexed modes have no ink bits.
        if (ZX_SPECTRUM.CELL_HEIGHT !== this.getGlyphSize().h
            || ZX_SPECTRUM.PIXEL_DEPTH !== 1) return false;
        const cols = ZX_SPECTRUM.GRID_COLS, rows = ZX_SPECTRUM.GRID_ROWS;
        const x = clamp(cellX | 0, 0, cols - 1);
        const y = clamp(cellY | 0, 0, rows - 1);
        const cell = LayerManager.flattenVisible().getCell(x, y);
        const { h } = this.getGlyphSize();
        return this.setGlyph(code, cell ? cell.pixels : new Uint8Array(h));
    }

    // ── Document load/save shape ───────────────────────────────────────────

    /** The codec-facing document shape (live references, do not mutate). */
    toDocument() {
        return {
            name: this.name,
            width: this.width,
            firstCode: this.firstCode,
            glyphs: this.glyphs
        };
    }

    /**
     * Replace the working font (from FontCodec.decode or a format
     * handler). Announces FONT_LOADED.
     */
    loadDocument(doc) {
        if (!doc || !this.WIDTHS.includes(doc.width) ||
            !Array.isArray(doc.glyphs) || !doc.glyphs.length) {
            return false;
        }
        this.name = doc.name || '';
        this.width = doc.width;
        this.firstCode = doc.firstCode | 0;
        this.glyphs = doc.glyphs;
        this._emit(EVENTS.FONT_LOADED, { name: this.name });
        this._schedulePersist();
        return true;
    }

    // ── Persistence (FONTS store, MapService pattern) ──────────────────────

    /** Persist the working font (debounced by the callers via _schedulePersist). */
    async persist() {
        if (!window.Storage || !Storage.STORES || !Storage.STORES.FONTS) return;
        const payload = FontCodec.encode(this.toDocument());
        try {
            if (payload) {
                await Storage.set(this.STORAGE_KEY, payload, Storage.STORES.FONTS);
            } else {
                await Storage.delete(this.STORAGE_KEY, Storage.STORES.FONTS);
            }
        } catch (error) {
            Logger.warn('FontService', 'Persist failed', error);
        }
    }

    /**
     * Restore the persisted working font and warm the library cache at
     * boot (app.js Phase 3) — the text tool needs synchronous library
     * access when rasterizing.
     */
    async restorePersisted() {
        if (!window.Storage || !Storage.STORES || !Storage.STORES.FONTS) return;
        try {
            const payload = await Storage.get(this.STORAGE_KEY, Storage.STORES.FONTS);
            if (payload) {
                const doc = FontCodec.decode(payload);
                if (doc) {
                    this.name = doc.name;
                    this.width = doc.width;
                    this.firstCode = doc.firstCode;
                    this.glyphs = doc.glyphs;
                    this._emit(EVENTS.FONT_LOADED, { name: this.name, restored: true });
                    Logger.info('FontService',
                        `Restored persisted font (${doc.glyphs.length} glyphs, ${doc.width}×8)`);
                } else {
                    Logger.warn('FontService', 'Discarding unreadable persisted font');
                    await Storage.delete(this.STORAGE_KEY, Storage.STORES.FONTS);
                }
            }
            const library = await Storage.get(this.LIBRARY_KEY, Storage.STORES.FONTS);
            if (library && typeof library === 'object') {
                this._library = library;
                this._decodedCache.clear();
                this._emit(EVENTS.FONT_LIBRARY_CHANGED, { names: this.listLibrary() });
            }
        } catch (error) {
            Logger.warn('FontService', 'Restore failed', error);
        }
    }

    // ── Named-font library ─────────────────────────────────────────────────

    /** Saved font names, sorted (synchronous — reads the warmed cache). */
    listLibrary() {
        return Object.keys(this._library).sort((a, b) => a.localeCompare(b));
    }

    /**
     * Decoded library font by name (synchronous — the text tool's
     * rasterization path). Decoded documents are cached until the
     * library changes.
     * @returns {Object|null} { name, width, firstCode, glyphs }
     */
    getLibraryFont(name) {
        if (this._decodedCache.has(name)) return this._decodedCache.get(name);
        const payload = this._library[name];
        const doc = payload ? FontCodec.decode(payload) : null;
        this._decodedCache.set(name, doc);
        return doc;
    }

    /** Save the working font into the library under a name. */
    async saveToLibrary(name) {
        const clean = String(name || '').trim().slice(0, 64);
        if (!clean) return false;
        if (!(clean in this._library) &&
            this.listLibrary().length >= this.MAX_LIBRARY_FONTS) {
            return false;
        }
        const payload = FontCodec.encode({ ...this.toDocument(), name: clean });
        if (!payload) return false;
        this._library[clean] = payload;
        this._decodedCache.delete(clean);
        await this._persistLibrary();
        this._emit(EVENTS.FONT_LIBRARY_CHANGED, { names: this.listLibrary() });
        return true;
    }

    /** Load a library font as the working font. */
    loadFromLibrary(name) {
        const doc = this.getLibraryFont(name);
        if (!doc) return false;
        // getLibraryFont caches the decoded doc — deep-copy the glyphs so
        // editing the working font never mutates the cached library copy
        return this.loadDocument({
            ...doc,
            glyphs: doc.glyphs.map(g => Uint8Array.from(g))
        });
    }

    /** Delete a library font by name. */
    async deleteFromLibrary(name) {
        if (!(name in this._library)) return false;
        delete this._library[name];
        this._decodedCache.delete(name);
        await this._persistLibrary();
        this._emit(EVENTS.FONT_LIBRARY_CHANGED, { names: this.listLibrary() });
        return true;
    }

    /** @private */
    /**
     * Write the whole library record.
     *
     * Checks the serialized size first, which it did not used to: a record too
     * large to store fails at the IndexedDB boundary, and a failure there is
     * discovered on the NEXT BOOT as a library that lost its most recent fonts.
     * Refusing up front means the save that would not have survived says so.
     * @returns {Promise<boolean>} false if it was refused or failed
     * @private
     */
    async _persistLibrary() {
        if (!window.Storage || !Storage.STORES || !Storage.STORES.FONTS) return false;

        const bytes = JSON.stringify(this._library).length;
        if (bytes > this.MAX_LIBRARY_BYTES) {
            Logger.warn('FontService',
                `Font library is ${bytes} bytes, over the ${this.MAX_LIBRARY_BYTES} cap; not saved`);
            return false;
        }

        try {
            await Storage.set(this.LIBRARY_KEY, this._library, Storage.STORES.FONTS);
            return true;
        } catch (error) {
            Logger.warn('FontService', 'Library persist failed', error);
            return false;
        }
    }

    // ── Internals ──────────────────────────────────────────────────────────

    _announceFont() {
        this._emit(EVENTS.FONT_CHANGED, {
            width: this.width,
            firstCode: this.firstCode,
            count: this.glyphs.length
        });
        this._schedulePersist();
    }

    _emit(event, data) {
        if (window.EventBus) EventBus.emit(event, data);
    }

    /** Debounce persistence so edit drags do not hammer IndexedDB. */
    _schedulePersist() {
        if (typeof setTimeout !== 'function') return;
        clearTimeout(this._persistTimer);
        this._persistTimer = setTimeout(() => { this.persist(); }, 800);
    }
}

window.FontService = new FontServiceClass();

Logger.debug('FontService', 'Font service module loaded');

})(); // End IIFE
