'use strict';
(function() {

/**
 * PatternService - Manages pattern loading, caching, and application
 * Handles the pattern library including 8x8, 16x16, and 32x32 patterns
 */
class PatternServiceClass {
    constructor() {
        /*
         * [C] How many patterns the artist may save.
         *
         * The PATTERNS store was the one persistence path with no limit of any
         * kind - not a count, not a byte cap - which survived only because the
         * records are small. This closes it on the same convention as the font
         * library (MAX_LIBRARY_FONTS, also 256): a COUNT that stops the list
         * becoming unnavigable, with re-saving an existing name exempt because
         * that replaces a record rather than adding one.
         *
         * The cap is not defending the disk. [M] 2026-08-07, measured as
         * navigator.storage.estimate() deltas in the Playwright harness: 50
         * patterns of each size (150 records) cost 62,519 B, and the worst case
         * this cap allows - 256 records, all 32x32, all with 48-character names
         * - is 146,086 B (143 KiB). That is a fifth of the map store's 1 MB
         * record cap. 256 is past the point where anyone finds a tile by
         * scrolling, which is the real limit being hit.
         */
        this.MAX_USER_PATTERNS = 256;

        /*
         * Name length, matching PresetCodec.MAX_NAME. Nothing bounded this
         * either, and a name is a label in a list, not a document.
         */
        this.MAX_PATTERN_NAME = 48;

        this._initialized = false;
        this._patterns = {
            '8x8': [],
            '16x16': [],
            '32x32': []
        };
        this._cache = new Map();
        this._categories = new Map();
        this._currentPattern = null;
        this._currentPatternData = null;
    }

    /**
     * Initialize the pattern service
     * @returns {Promise<void>}
     */
    async initialize() {
        if (this._initialized) {
            return;
        }

        Logger.info('PatternService', 'Initializing pattern service...');

        try {
            await this._loadPatternLists();
            this._categorizePatterns();
            this._initialized = true;
            Logger.info('PatternService', `Loaded ${this.getTotalCount()} patterns`);
        } catch (error) {
            Logger.error('PatternService', 'Failed to initialize', error);
        }
    }

    /**
     * Build the library from the generated bitmap data (js/data/pattern-bitmaps.js,
     * produced by tools/gen-patterns.js). The data IS the manifest: name, size and
     * category all come from it, so there is no second list to keep in step.
     * @private
     */
    async _loadPatternLists() {
        const data = window.PATTERN_BITMAPS || {};

        for (const size of Object.keys(this._patterns)) this._patterns[size] = [];

        for (const [key, entry] of Object.entries(data)) {
            const [size, name] = key.split('/');
            if (!this._patterns[size]) continue;
            this._patterns[size].push({
                name,
                size,
                category: entry.c || 'misc',
                path: key
            });
        }
    }

    /**
     * Categorize all loaded patterns
     * @private
     */
    _categorizePatterns() {
        this._categories.clear();

        for (const size of Object.keys(this._patterns)) {
            for (const pattern of this._patterns[size]) {
                const category = pattern.category;
                if (!this._categories.has(category)) {
                    this._categories.set(category, []);
                }
                this._categories.get(category).push(pattern);
            }
        }
    }

    /**
     * Get all patterns for a specific size
     * @param {string} size - '8x8', '16x16', or '32x32'
     * @returns {Array}
     */
    getPatternsBySize(size) {
        return this._patterns[size] || [];
    }

    /**
     * Look a pattern up by its library path ('8x8/density-50').
     *
     * The path is a pattern's stable identity across builds — it is the key of
     * the generated library — which is what lets a preset name a pattern
     * without storing a copy of its bitmap that could drift from the real one.
     * @param {string} path
     * @returns {Object|null}
     */
    getPatternByPath(path) {
        if (!path) return null;
        const [size] = String(path).split('/');
        for (const pattern of this._patterns[size] || []) {
            if (pattern.path === path) return pattern;
        }
        return null;
    }

    /**
     * Get all patterns for a category
     * @param {string} category - Category name
     * @returns {Array}
     */
    getPatternsByCategory(category) {
        return this._categories.get(category) || [];
    }

    /**
     * Get all categories
     * @returns {Array<string>}
     */
    getCategories() {
        return Array.from(this._categories.keys()).sort();
    }

    /**
     * Get total pattern count
     * @returns {number}
     */
    getTotalCount() {
        let count = 0;
        for (const size of Object.keys(this._patterns)) {
            count += this._patterns[size].length;
        }
        return count;
    }

    /**
     * Resolve a pattern's 1-bit bitmap.
     * @param {Object} pattern - Pattern metadata
     * @returns {Promise<{width: number, height: number, bitmap: Uint8Array}|null>}
     */
    async loadPatternData(pattern) {
        // User-defined patterns carry their bitmap directly
        if (pattern.userDefined && pattern.bitmap) {
            return { width: pattern.width, height: pattern.height, bitmap: pattern.bitmap };
        }

        const key = pattern.path;
        if (this._cache.has(key)) {
            return this._cache.get(key);
        }

        const entry = window.PATTERN_BITMAPS && window.PATTERN_BITMAPS[key];
        if (entry) {
            const bitmap = this._decodeBitmap(entry.d, entry.w * entry.h);
            const patternData = { width: entry.w, height: entry.h, bitmap };
            this._cache.set(key, patternData);
            return patternData;
        }

        Logger.warn('PatternService', `No bitmap data for pattern: ${key}`);
        return null;
    }

    /**
     * Decode a base64 packed-bit string into a Uint8Array bitmap (1 bit per pixel).
     * MSB of each byte is the first pixel.
     * @param {string} b64
     * @param {number} pixelCount
     * @returns {Uint8Array}
     * @private
     */
    _decodeBitmap(b64, pixelCount) {
        const binary = atob(b64);
        const bitmap = new Uint8Array(pixelCount);
        let i = 0;
        for (let by = 0; by < binary.length && i < pixelCount; by++) {
            const byte = binary.charCodeAt(by);
            for (let bit = 7; bit >= 0 && i < pixelCount; bit--, i++) {
                bitmap[i] = (byte >> bit) & 1;
            }
        }
        return bitmap;
    }

    /**
     * Set the current active pattern
     * @param {Object} pattern - Pattern metadata
     */
    async setCurrentPattern(pattern) {
        if (!pattern) {
            this._currentPattern = null;
            this._currentPatternData = null;
            return;
        }

        this._currentPattern = pattern;
        this._currentPatternData = await this.loadPatternData(pattern);

        EventBus.emit(EVENTS.PATTERN_CHANGED, {
            pattern: pattern,
            data: this._currentPatternData
        });
    }

    /**
     * Get the current pattern
     * @returns {Object|null}
     */
    getCurrentPattern() {
        return this._currentPattern;
    }

    /**
     * Get the current pattern data
     * @returns {Object|null}
     */
    getCurrentPatternData() {
        return this._currentPatternData;
    }

    /**
     * Check if a pixel should be drawn based on current pattern
     * @param {number} x - Pixel X coordinate
     * @param {number} y - Pixel Y coordinate
     * @returns {boolean}
     */
    shouldDrawPixel(x, y) {
        if (!this._currentPatternData) {
            return true;
        }

        const data = this._currentPatternData;
        const px = ((x % data.width) + data.width) % data.width;
        const py = ((y % data.height) + data.height) % data.height;
        const idx = py * data.width + px;

        return data.bitmap[idx] === 1;
    }

    /**
     * Apply current pattern to a rectangular area
     * @param {number} x - Start X
     * @param {number} y - Start Y
     * @param {number} width - Width
     * @param {number} height - Height
     */
    applyPattern(x, y, width, height) {
        if (!this._currentPatternData) {
            Logger.warn('PatternService', 'No pattern selected');
            return;
        }

        const color = ColorManager.getCurrentSelection();

        PixelDrawRoutine.beginBatch();

        // Area fills write exactly the computed region — never symmetry-mirrored
        PixelDrawRoutine.suspendMirror(() => {
            for (let py = 0; py < height; py++) {
                for (let px = 0; px < width; px++) {
                    const pixelX = x + px;
                    const pixelY = y + py;

                    if (Validators.isValidPixelCoord(pixelX, pixelY)) {
                        const shouldDraw = this.shouldDrawPixel(pixelX, pixelY);
                        const mode = PixelDrawRoutine.resolveUserMode(shouldDraw);
                        PixelDrawRoutine.draw(pixelX, pixelY, color, mode);
                    }
                }
            }
        });

        PixelDrawRoutine.endBatch();
    }

    /**
     * Apply pattern to the current selection or entire canvas
     */
    applyToSelection() {
        if (!this._currentPatternData) {
            Logger.warn('PatternService', 'No pattern selected');
            return;
        }

        let area;
        if (SelectionService.hasSelection()) {
            area = SelectionService.getSelection();
        } else {
            area = { x: 0, y: 0, width: ZX_SPECTRUM.WIDTH, height: ZX_SPECTRUM.HEIGHT };
        }

        this.applyPattern(area.x, area.y, area.width, area.height);
    }

    /**
     * Apply pattern with offset
     * @param {number} x - Start X
     * @param {number} y - Start Y
     * @param {number} width - Width
     * @param {number} height - Height
     * @param {number} offsetX - Pattern offset X
     * @param {number} offsetY - Pattern offset Y
     */
    applyPatternWithOffset(x, y, width, height, offsetX, offsetY) {
        if (!this._currentPatternData) {
            return;
        }

        const data = this._currentPatternData;
        const color = ColorManager.getCurrentSelection();

        PixelDrawRoutine.beginBatch();

        PixelDrawRoutine.suspendMirror(() => {
            for (let py = 0; py < height; py++) {
                for (let px = 0; px < width; px++) {
                    const pixelX = x + px;
                    const pixelY = y + py;

                    if (Validators.isValidPixelCoord(pixelX, pixelY)) {
                        const patX = ((px + offsetX) % data.width + data.width) % data.width;
                        const patY = ((py + offsetY) % data.height + data.height) % data.height;
                        const idx = patY * data.width + patX;

                        const shouldDraw = data.bitmap[idx] === 1;
                        const mode = PixelDrawRoutine.resolveUserMode(shouldDraw);
                        PixelDrawRoutine.draw(pixelX, pixelY, color, mode);
                    }
                }
            }
        });

        PixelDrawRoutine.endBatch();
    }

    /**
     * Search patterns by name
     * @param {string} query - Search query
     * @returns {Array}
     */
    search(query) {
        if (!query) {
            return [];
        }

        const lowerQuery = query.toLowerCase();
        const results = [];

        for (const size of Object.keys(this._patterns)) {
            for (const pattern of this._patterns[size]) {
                if (pattern.name.toLowerCase().includes(lowerQuery)) {
                    results.push(pattern);
                }
            }
        }

        return results;
    }

    /**
     * Clear the pattern cache
     */
    clearCache() {
        this._cache.clear();
    }

    /**
     * Get cache stats
     * @returns {Object}
     */
    getCacheStats() {
        return {
            size: this._cache.size,
            patterns: {
                '8x8': this._patterns['8x8'].length,
                '16x16': this._patterns['16x16'].length,
                '32x32': this._patterns['32x32'].length
            }
        };
    }

    async getUserPatterns() {
        const records = await Storage.getAll(Storage.STORES.PATTERNS);
        return records.map(r => {
            const v = r.value ?? r;
            return {
                name: v.name,
                size: `${v.size}x${v.size}`,
                userDefined: true,
                width: v.size,
                height: v.size,
                bitmap: this._unpackToArray(new Uint8Array(v.data), v.size),
                _storageId: r.id ?? r.key
            };
        });
    }

    async deleteUserPattern(storageId) {
        await Storage.delete(storageId, Storage.STORES.PATTERNS);
        if (this._currentPattern?._storageId === storageId) {
            this._currentPattern = null;
        }
        EventBus.emit(EVENTS.PATTERN_CHANGED);
    }

    /**
     * Save a user pattern under a name.
     *
     * Re-saving an existing name replaces that record rather than adding one,
     * so it is exempt from the count - same rule as the font library and the
     * tool presets, and for the same reason: a list cannot tell two identically
     * named entries apart, so making one is never what was meant.
     * @param {string} name
     * @param {number} size - 8, 16 or 32
     * @param {Uint8Array|Array} bitmap - one entry per pixel, truthy = ink
     * @returns {Promise<boolean>} false if the name was empty or the library is full
     */
    async savePatternData(name, size, bitmap) {
        const clean = String(name || '').trim().slice(0, this.MAX_PATTERN_NAME);
        if (!clean) return false;

        /*
         * The store is keyed by an autoIncrement id, NOT by the name - so
         * Storage.set appends, and saving one name twice used to leave two
         * records the library list could not tell apart. Pressing Save
         * repeatedly in the Pattern Creator grew the store forever. Find the
         * name's existing records and delete them, so a re-save replaces.
         */
        const records = await Storage.getAll(Storage.STORES.PATTERNS);
        const previous = records.filter(r => (r.value ?? r).name === clean);

        if (!previous.length && records.length >= this.MAX_USER_PATTERNS) {
            Logger.warn('PatternService',
                `Pattern library is full (${this.MAX_USER_PATTERNS}); "${clean}" not saved`);
            EventBus.emit(EVENTS.PATTERN_LIBRARY_FULL, { max: this.MAX_USER_PATTERNS });
            return false;
        }
        for (const r of previous) {
            await Storage.delete(r.id ?? r.key, Storage.STORES.PATTERNS);
        }

        name = clean;
        const bytesPerRow = Math.ceil(size / 8);
        const packed = new Uint8Array(size * bytesPerRow);
        for (let row = 0; row < size; row++) {
            for (let bit = 0; bit < size; bit++) {
                if (bitmap[row * size + bit]) {
                    const byteIdx = row * bytesPerRow + Math.floor(bit / 8);
                    packed[byteIdx] |= (1 << (7 - (bit % 8)));
                }
            }
        }
        await Storage.set(name, { name, size, data: Array.from(packed) }, Storage.STORES.PATTERNS);
        EventBus.emit(EVENTS.PATTERN_CHANGED);
        return true;
    }

    _unpackToArray(bytes, size) {
        const bytesPerRow = Math.ceil(size / 8);
        const bitmap = new Uint8Array(size * size);
        for (let row = 0; row < size; row++) {
            for (let bit = 0; bit < size; bit++) {
                const byteIdx = row * bytesPerRow + Math.floor(bit / 8);
                bitmap[row * size + bit] = (bytes[byteIdx] >> (7 - (bit % 8))) & 1;
            }
        }
        return bitmap;
    }

    /**
     * Generate a mathematical pattern programmatically.
     * @param {string} type  - Pattern type name
     * @param {number} size  - Tile size (8, 16, or 32)
     * @returns {{ name, userDefined, width, height, bitmap: Uint8Array }}
     */
    generatePattern(type, size = 8) {
        const s = size;
        const bmp = new Uint8Array(s * s);
        const set = (x, y, v = 1) => { if (x >= 0 && x < s && y >= 0 && y < s) bmp[y * s + x] = v; };

        switch (type) {
            case 'checkerboard':
                for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) set(x, y, (x + y) % 2);
                break;
            case 'stripes-h':
                for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) set(x, y, y % 2);
                break;
            case 'stripes-v':
                for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) set(x, y, x % 2);
                break;
            case 'diagonal':
                for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) set(x, y, (x + y) % 4 === 0 ? 1 : 0);
                break;
            case 'dots':
                for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) set(x, y, x % 4 === 0 && y % 4 === 0 ? 1 : 0);
                break;
            case 'brick': {
                const h2 = Math.max(2, Math.floor(s / 4));
                for (let y = 0; y < s; y++) {
                    const off = (Math.floor(y / h2) % 2) * Math.floor(s / 2);
                    if (y % h2 === 0) { for (let x = 0; x < s; x++) set(x, y, 1); }
                    else { set(off % s, y, 1); }
                }
                break;
            }
            case 'cross':
                for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) set(x, y, (x % Math.max(4,s/2) === 0 || y % Math.max(4,s/2) === 0) ? 1 : 0);
                break;
            case 'bayer': {
                const b4 = [[0,8,2,10],[12,4,14,6],[3,11,1,9],[15,7,13,5]];
                const thr = Math.floor(16 * 0.4);
                for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) set(x, y, b4[y % 4][x % 4] < thr ? 1 : 0);
                break;
            }
            case 'noise': {
                // Deterministic pseudo-noise
                for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
                    const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
                    set(x, y, (n - Math.floor(n)) > 0.5 ? 1 : 0);
                }
                break;
            }
            case 'grid':
                for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) set(x, y, x === 0 || y === 0 ? 1 : 0);
                break;
            default:
                for (let i = 0; i < s * s; i++) bmp[i] = 0;
        }
        return { name: `${type}-${s}`, userDefined: true, width: s, height: s, bitmap: bmp };
    }

    /** Returns all available generated pattern types and sizes */
    getGeneratedPatternTypes() {
        return ['checkerboard','stripes-h','stripes-v','diagonal','dots','brick','cross','bayer','noise','grid'];
    }

    // ── JSON pattern collection export/import ──────────────────────────────

    /**
     * Export all user-created patterns as a JSON string.
     * @returns {Promise<string>}
     */
    async exportPatternsJSON() {
        const records = await Storage.getAll(Storage.STORES.PATTERNS);
        return JSON.stringify({ version: 1, patterns: records }, null, 2);
    }

    /**
     * Import patterns from a JSON string (merges into existing user patterns).
     * @param {string} json
     */
    async importPatternsJSON(json) {
        const obj = JSON.parse(json);
        if (!obj || !Array.isArray(obj.patterns)) throw new Error('Invalid pattern collection format');
        for (const r of obj.patterns) {
            if (!r.name || !r.size || !r.data) continue;
            await Storage.set(r.name, r, Storage.STORES.PATTERNS);
        }
        EventBus.emit(EVENTS.PATTERN_CHANGED);
    }
}

// PATTERN_CHANGED event is defined in constants.js

// Create singleton instance
window.PatternService = new PatternServiceClass();

Logger.debug('PatternService', 'Pattern service module loaded');

})(); // End IIFE
