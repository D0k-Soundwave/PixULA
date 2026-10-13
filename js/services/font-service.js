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
 *   glyph — one character bitmap: Uint8Array of row bytes, MSB = leftmost
 *           pixel (for a classic font one byte per row, the same layout as
 *           layer cell.pixels and MapService tiles). Row bits beyond the font
 *           width are always zero (every mutation masks).
 *   font  — { name, width, height, firstCode, glyphs[], shade[] }. A classic
 *           font is 4, 6 or 8 wide and 8 high. A BIG font (Batch 10C, the CHX
 *           big font sets) is 8, 16, 24 or 32 wide and 8, 16, 24 or 32 high;
 *           its glyphs are height * ceil(width / 8) bytes (see GlyphBits).
 *           shade[i] = [left, right]: how many 8-pixel columns of glyph i
 *           are left out (the shader; saved as a narrower CHX character, and
 *           a character shaded all the way across is not written at all).
 *           Pixels under shading are kept, so the shading can be undone.
 *           firstCode + glyphs.length describe the
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
        this.height = 8;
        this.firstCode = ZX_ROM_FONT_FIRST;
        /** @type {Uint8Array[]} */
        this.glyphs = [];
        /** @type {Array<Array<number>>} [left, right] shaded 8-pixel columns per glyph (parallel to glyphs) */
        this.shade = [];

        this._glyphClipboard = null;   // { w, h, bytes } copy from copyGlyph
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
        return { w: this.width, h: this.height };
    }

    /** True for a big font (wider than 8 or taller than 8) - the CHX big font sets. */
    isBig() {
        return this.width > 8 || this.height > 8;
    }

    /** Bytes in one glyph of the working font. */
    glyphBytes() {
        return GlyphBits.byteLength(this.width, this.height);
    }

    /** 8-pixel columns in one glyph (1 for a classic font). */
    columns() {
        return FontCodec.columns(this.width);
    }

    /** A blank glyph of the working font's size. @private */
    _blank() {
        return GlyphBits.create(this.width, this.height);
    }

    /** Shading of a code: { left, right } in 8-pixel columns (zeros outside the coverage). */
    getShade(code) {
        const s = this.hasCode(code) ? this.shade[code - this.firstCode] : null;
        return s ? { left: s[0], right: s[1] } : { left: 0, right: 0 };
    }

    /** True if any character is shaded. */
    hasShading() {
        return this.shade.some(p => p[0] || p[1]);
    }

    /**
     * Shade columns on the left and right of a character (it is saved narrower; shaded all the way across, it is not
     * saved). The pixels are kept. Space (code 32) always keeps one column: a CHX file must define it.
     * @returns {boolean}
     */
    setShade(code, left, right) {
        if (!this.hasCode(code) || !Number.isInteger(left) || !Number.isInteger(right) || left < 0 || right < 0) return false;
        const cols = this.columns();
        if (left + right > cols) return false;
        if (code === 32 && left + right >= cols) return false;
        this.shade[code - this.firstCode] = [left, right];
        this._announceFont();
        return true;
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
        if (!this.hasCode(code) || !bytes || bytes.length !== this.glyphBytes()) return false;
        const g = GlyphBits.normalise(Uint8Array.from(bytes), this.width, this.height);
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
        this._glyphClipboard = { w: this.width, h: this.height, bytes: Uint8Array.from(g) };
        return true;
    }

    /** Paste the glyph clipboard onto a code (cropped or padded at the top-left to the current size). */
    pasteGlyph(code) {
        const c = this._glyphClipboard;
        if (!c) return false;
        const bytes = (c.w === this.width && c.h === this.height)
            ? c.bytes : GlyphBits.resize(c.bytes, c.w, c.h, this.width, this.height);
        return this.setGlyph(code, bytes);
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
        if (axis === 'h') GlyphBits.flipH(g, this.width, this.height);
        else if (axis === 'v') GlyphBits.flipV(g, this.width, this.height);
        else return false;
        this._announceFont();
        return true;
    }

    /**
     * Shift a glyph one pixel with wrap-around (within the font width).
     * @param {string} dir - 'left' | 'right' | 'up' | 'down'
     */
    shiftGlyph(code, dir) {
        const g = this.getGlyph(code);
        if (!g || !['left', 'right', 'up', 'down'].includes(dir)) return false;
        GlyphBits.shift(g, this.width, this.height, dir);
        this._announceFont();
        return true;
    }

    /** Invert a glyph's pixels (within the font width). */
    invertGlyph(code) {
        const g = this.getGlyph(code);
        if (!g) return false;
        GlyphBits.invert(g, this.width, this.height);
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
        if (this.isBig() || !this.WIDTHS.includes(width) || width === this.width) return false;
        this.width = width;
        for (const g of this.glyphs) GlyphBits.normalise(g, this.width, this.height);
        this._announceFont();
        return true;
    }

    /**
     * Start a new BIG font: every character cols x rows blocks of 8 x 8 pixels (1 to 4 each way), all blank and
     * unshaded. Announces FONT_LOADED.
     * @param {{cols:number, rows:number, coverage:string}} o
     * @returns {boolean}
     */
    newBigFont(o) {
        const cov = o && this.COVERAGES[o.coverage];
        if (!cov || !Number.isInteger(o.cols) || !Number.isInteger(o.rows) ||
            o.cols < 1 || o.cols > 4 || o.rows < 1 || o.rows > 4) return false;
        this.name = '';
        this.width = o.cols * 8;
        this.height = o.rows * 8;
        this.firstCode = cov.firstCode;
        this.glyphs = [];
        this.shade = [];
        for (let i = 0; i < cov.count; i++) {
            this.glyphs.push(this._blank());
            this.shade.push([0, 0]);
        }
        this._emit(EVENTS.FONT_LOADED, { name: this.name });
        this._schedulePersist();
        return true;
    }

    /**
     * Replace every glyph at once (a fill from a system font): one announcement instead of one per glyph.
     * @param {Uint8Array[]} glyphs - exactly one per code of the coverage, each glyphBytes() long
     * @param {Array<Array<number>>} [shade] - optional [left, right] per glyph
     * @returns {boolean}
     */
    replaceGlyphs(glyphs, shade) {
        const size = this.glyphBytes();
        if (!Array.isArray(glyphs) || glyphs.length !== this.glyphs.length || glyphs.some(g => !g || g.length !== size)) return false;
        if (shade && !FontCodec._shadeOk(shade, glyphs.length, this.width)) return false;
        this.glyphs = glyphs.map(g => GlyphBits.normalise(Uint8Array.from(g), this.width, this.height));
        if (shade) this.shade = shade.map(p => [p[0], p[1]]);
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
        const next = [];
        const nextShade = [];
        for (let i = 0; i < target.count; i++) {
            const code = target.firstCode + i;
            const g = this.getGlyph(code);
            next.push(g ? g : this._blank());
            nextShade.push(g ? this.shade[code - this.firstCode] : [0, 0]);
        }
        this.firstCode = target.firstCode;
        this.glyphs = next;
        this.shade = nextShade;
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
        const h = 8;
        this.width = 8;
        this.height = 8;
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
        this.shade = next.map(() => [0, 0]);
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
        if (!window.LayerManager || !this.hasCode(code) || this.isBig()) return false;
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
        if (!cell) return this.setGlyph(code, new Uint8Array(h));
        // GigaScreen: a pixel is marked when EITHER screen shows ink there,
        // as for every other 1-bit reading of the canvas. Screen A alone
        // captured a glyph drawn in a screen-B-only blend as blank.
        if (cell.pixelsB) {
            return this.setGlyph(code, cell.pixels.map((row, i) => row | cell.pixelsB[i]));
        }
        return this.setGlyph(code, cell.pixels);
    }

    // ── Document load/save shape ───────────────────────────────────────────

    /** The codec-facing document shape (live references, do not mutate). */
    toDocument() {
        return {
            name: this.name,
            width: this.width,
            height: this.height,
            firstCode: this.firstCode,
            glyphs: this.glyphs,
            shade: this.hasShading() ? this.shade : null
        };
    }

    /**
     * A deep copy of the working font for the Font Editor's undo history (see FontHistory).
     * @returns {{name:string,width:number,height:number,firstCode:number,glyphs:Uint8Array[],shade:number[][],bytes:number}}
     */
    snapshot() {
        const glyphs = this.glyphs.map(g => Uint8Array.from(g));
        return {
            name: this.name,
            width: this.width,
            height: this.height,
            firstCode: this.firstCode,
            glyphs,
            shade: this.shade.map(p => [p[0], p[1]]),
            bytes: glyphs.length * (this.glyphBytes() + 2)
        };
    }

    /**
     * Put a snapshot back as the working font (announces FONT_LOADED). The name currently typed is kept unless asked otherwise:
     * undo is for the pictures, not for what the font is called.
     * @returns {boolean}
     */
    restore(snap, keepName = true) {
        if (!snap || !FontCodec.validSize(snap.width, snap.height) || !Array.isArray(snap.glyphs) || !snap.glyphs.length) return false;
        const name = this.name;
        this._adopt({
            name: snap.name, width: snap.width, height: snap.height, firstCode: snap.firstCode,
            glyphs: snap.glyphs.map(g => Uint8Array.from(g)), shade: snap.shade
        });
        if (keepName) this.name = name;
        this._emit(EVENTS.FONT_LOADED, { name: this.name });
        this._schedulePersist();
        return true;
    }

    /** Take a decoded document's geometry and shading into the working font. @private */
    _adopt(doc) {
        this.name = doc.name || '';
        this.width = doc.width;
        this.height = doc.height === undefined ? 8 : doc.height;
        this.firstCode = doc.firstCode | 0;
        this.glyphs = doc.glyphs;
        const ok = doc.shade && FontCodec._shadeOk(doc.shade, doc.glyphs.length, doc.width);
        this.shade = ok ? doc.shade.map(p => [p[0], p[1]]) : doc.glyphs.map(() => [0, 0]);
    }

    /**
     * Replace the working font (from FontCodec.decode or a format
     * handler). Announces FONT_LOADED.
     */
    loadDocument(doc) {
        if (!doc || !FontCodec.validSize(doc.width, doc.height === undefined ? 8 : doc.height) ||
            !Array.isArray(doc.glyphs) || !doc.glyphs.length) {
            return false;
        }
        this._adopt(doc);
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
                    this._adopt(doc);
                    this._emit(EVENTS.FONT_LOADED, { name: this.name, restored: true });
                    Logger.info('FontService',
                        `Restored persisted font (${doc.glyphs.length} glyphs, ${doc.width}×${doc.height})`);
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
     * @returns {Object|null} { name, width, height, firstCode, glyphs, shade }
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
        const had = Object.prototype.hasOwnProperty.call(this._library, clean);
        const previous = this._library[clean];
        this._library[clean] = payload;
        this._decodedCache.delete(clean);
        if (!(await this._persistLibrary())) {
            // A save that was refused or failed must not look like it worked: take it back out
            if (had) this._library[clean] = previous; else delete this._library[clean];
            this._decodedCache.delete(clean);
            return false;
        }
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
            glyphs: doc.glyphs.map(g => Uint8Array.from(g)),
            shade: doc.shade ? doc.shade.map(p => [p[0], p[1]]) : null
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
            height: this.height,
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
