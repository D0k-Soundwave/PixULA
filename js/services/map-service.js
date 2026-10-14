'use strict';
(function() {

/**
 * MapService — tile + map data model (Phase 11 map/tile editor).
 *
 * Pure data service (no DOM): owns the working tileset and tile map, all
 * map-editing operations, the canvas bridges, and persistence into the
 * MAPS Storage store via the versioned MapCodec.
 *
 * Model:
 *   tile    — one attribute cell: { kind, bitmap: Uint8Array(cellH) (MSB =
 *             leftmost pixel, same layout as layer cell.pixels), attr: byte
 *             (FLASH<<7 | BRIGHT<<6 | PAPER<<3 | INK) }
 *   tileset — ordered array of tiles (index = the value stored in the map)
 *   map     — { width, height, cells: Int16Array } in TILE units, -1 = empty.
 *             Maps larger than one screen are the point: multi-screen game
 *             maps, scrolled inside the editor viewport.
 *
 * The tile-source seam: every tile carries a `kind` tag and all geometry
 * comes from ACTIVE_SCREEN_MODE, so Phase 13 can register Next tilemap
 * bank kinds (different byte shapes) without rewriting the map model —
 * 1-bit+attr is the only kind *implemented*, not the boundary contract.
 *
 * Commands come down as direct calls; facts go up ONLY via
 * EVENTS.MAP_CHANGED / MAP_TILESET_CHANGED / MAP_LOADED.
 */
class MapServiceClass {
    constructor() {
        this.TILE_KINDS = MapCodec.TILE_KINDS;
        this.MAX_DIM = MapCodec.MAX_DIM;
        this.MAX_TILES = MapCodec.MAX_TILES;
        this.STORAGE_KEY = 'current';

        this.name = '';
        this.tileKind = this.TILE_KINDS.ULA_CELL;
        /** @type {Array<{kind:string,bitmap:Uint8Array,attr:number}>} */
        this.tiles = [];
        this.map = this._blankMap(32, 24);
        /**
         * Elements found in the picture (Batch 11A): { name, w, h, screens, gridW, gridH, match, bitmap, attrs, positions }.
         * Self-contained, stored with the map (MapCodec version 2).
         */
        this.elements = [];

        this._persistTimer = null;
    }

    // ── Geometry / attr helpers ────────────────────────────────────────────

    /**
     * Tile pixel geometry — defined by the tile KIND, not the runtime-
     * switchable active mode (Phase 12a): 'ula-cell' is always the standard
     * 8×8 ULA cell. The canvas bridges (capture / render-to-canvas) gate
     * separately on the active mode matching this geometry; Phase 13 Next
     * tile kinds will carry their own.
     */
    getTileSize() {
        return {
            w: SCREEN_MODES.STANDARD_ULA.attrCellW,
            h: SCREEN_MODES.STANDARD_ULA.attrCellH
        };
    }

    /**
     * True while the active screen mode's cells match the tile kind's
     * geometry — the gate for the canvas capture/render bridges.
     */
    isCanvasCompatible() {
        const t = this.getTileSize();
        // 'ula-cell' tiles are 1-bit bitmap + attribute — indexed modes
        // (pixelDepth > 1, Phase 13) have neither, whatever their grid.
        return ZX_SPECTRUM.CELL_WIDTH === t.w && ZX_SPECTRUM.CELL_HEIGHT === t.h
            && ZX_SPECTRUM.PIXEL_DEPTH === 1;
    }

    /** Pack a colour selection into a ZX attribute byte. */
    attrByte(sel) {
        return ((sel.flash ? 1 : 0) << 7) | ((sel.bright ? 1 : 0) << 6) |
               ((sel.paper & 7) << 3) | (sel.ink & 7);
    }

    /** Unpack a ZX attribute byte into a colour selection. */
    attrFields(attr) {
        return {
            ink: attr & 7,
            paper: (attr >> 3) & 7,
            bright: (attr & 0x40) !== 0,
            flash: (attr & 0x80) !== 0
        };
    }

    // ── Tile creation ──────────────────────────────────────────────────────

    /**
     * Create a tile. Defaults: blank bitmap, black ink on white paper.
     * @param {Uint8Array|Array<number>} [bitmap] - cellH bitmap bytes
     * @param {number} [attr] - ZX attribute byte
     * @returns {Object} tile
     */
    createTile(bitmap, attr = 0x38) {
        const { h } = this.getTileSize();
        const bm = new Uint8Array(h);
        if (bitmap) bm.set(Array.from(bitmap).slice(0, h).map(b => b & 0xFF));
        return { kind: this.tileKind, bitmap: bm, attr: attr & 0xFF };
    }

    /**
     * Build a tile from a 1-bit pattern paired with a colour selection
     * (the pattern-library source: patterns are 1-bit, the attribute comes
     * from the current ink/paper/bright/flash).
     * @param {Object} patternData - { width, height, bitmap: Uint8Array 0/1 }
     * @param {Object} [colorSel] - { ink, paper, bright, flash }; defaults to
     *                              the current ColorManager selection
     * @returns {Object|null} tile, or null if the pattern is not tile-sized
     */
    tileFromPattern(patternData, colorSel) {
        const { w, h } = this.getTileSize();
        if (!patternData || patternData.width !== w || patternData.height !== h ||
            !patternData.bitmap) {
            return null;
        }
        const sel = colorSel ||
            (window.ColorManager ? ColorManager.getCurrentSelection() : null);
        if (!sel) return null;

        const bm = new Uint8Array(h);
        for (let y = 0; y < h; y++) {
            let byte = 0;
            for (let x = 0; x < w; x++) {
                if (patternData.bitmap[y * w + x]) byte |= 0x80 >> x;
            }
            bm[y] = byte;
        }
        return { kind: this.tileKind, bitmap: bm, attr: this.attrByte(sel) };
    }

    /** Byte-exact tile comparison. */
    tilesEqual(a, b) {
        if (!a || !b || a.kind !== b.kind || a.attr !== b.attr ||
            a.bitmap.length !== b.bitmap.length) {
            return false;
        }
        for (let i = 0; i < a.bitmap.length; i++) {
            if (a.bitmap[i] !== b.bitmap[i]) return false;
        }
        return true;
    }

    // ── Tileset operations ─────────────────────────────────────────────────

    getTiles() { return this.tiles; }
    tileCount() { return this.tiles.length; }
    getTile(index) { return this.tiles[index] || null; }

    /** Index of a byte-identical tile, or -1. */
    findTile(tile) {
        for (let i = 0; i < this.tiles.length; i++) {
            if (this.tilesEqual(this.tiles[i], tile)) return i;
        }
        return -1;
    }

    /**
     * Add a tile to the tileset.
     * @param {Object} tile
     * @param {boolean} [dedup=true] - return the existing index if an
     *                                 identical tile is already stored
     * @returns {number} tile index, or -1 if the tileset is full
     */
    addTile(tile, dedup = true) {
        if (dedup) {
            const existing = this.findTile(tile);
            if (existing >= 0) return existing;
        }
        if (this.tiles.length >= this.MAX_TILES) return -1;
        this.tiles.push(tile);
        this._announceTileset();
        return this.tiles.length - 1;
    }

    /** Replace a tile in place (tile edits). */
    updateTile(index, tile) {
        if (index < 0 || index >= this.tiles.length || !tile) return false;
        this.tiles[index] = tile;
        this._announceTileset();
        this._announceMap(); // placed instances changed appearance
        return true;
    }

    /**
     * Remove a tile. Map cells using it become empty; indices above it
     * shift down by one (the map is remapped accordingly).
     */
    removeTile(index) {
        if (index < 0 || index >= this.tiles.length) return false;
        this.tiles.splice(index, 1);
        const cells = this.map.cells;
        for (let i = 0; i < cells.length; i++) {
            if (cells[i] === index) cells[i] = -1;
            else if (cells[i] > index) cells[i]--;
        }
        this._announceTileset();
        this._announceMap();
        return true;
    }

    // ── Map operations ─────────────────────────────────────────────────────

    getMap() { return this.map; }

    /** Start a fresh map (tileset kept unless clearTiles). */
    newMap(width, height, clearTiles = false) {
        const w = clamp(width | 0, 1, this.MAX_DIM);
        const h = clamp(height | 0, 1, this.MAX_DIM);
        this.map = this._blankMap(w, h);
        if (clearTiles) {
            this.tiles = [];
            this._announceTileset();
            if (this.elements.length) { this.elements = []; this._announceElements(); }
        }
        this._announceMap();
    }

    /**
     * Resize the map, preserving the top-left overlap. Out-of-range cells
     * are dropped; new cells start empty.
     */
    resizeMap(width, height) {
        const w = clamp(width | 0, 1, this.MAX_DIM);
        const h = clamp(height | 0, 1, this.MAX_DIM);
        if (w === this.map.width && h === this.map.height) return;
        const next = this._blankMap(w, h);
        const copyW = Math.min(w, this.map.width);
        const copyH = Math.min(h, this.map.height);
        for (let y = 0; y < copyH; y++) {
            for (let x = 0; x < copyW; x++) {
                next.cells[y * w + x] = this.map.cells[y * this.map.width + x];
            }
        }
        this.map = next;
        this._announceMap();
    }

    /** Tile index at (x, y), or -1 (empty / out of bounds). */
    getMapCell(x, y) {
        if (!this._inMap(x, y)) return -1;
        return this.map.cells[y * this.map.width + x];
    }

    /**
     * Place (or erase, with index -1) a tile. Out-of-bounds placement is
     * a validated no-op, never a throw — the editor paints along drags
     * that can leave the map.
     * @returns {boolean} true if the cell changed
     */
    setMapCell(x, y, tileIndex) {
        if (!this._inMap(x, y)) return false;
        if (tileIndex < -1 || tileIndex >= this.tiles.length) return false;
        const i = y * this.map.width + x;
        if (this.map.cells[i] === tileIndex) return false;
        this.map.cells[i] = tileIndex;
        this._announceMap();
        return true;
    }

    /**
     * Flood-fill (4-way) the region of identical tile indices at (x, y)
     * with tileIndex.
     */
    floodFill(x, y, tileIndex) {
        if (!this._inMap(x, y)) return false;
        if (tileIndex < -1 || tileIndex >= this.tiles.length) return false;
        const { width, height, cells } = this.map;
        const target = cells[y * width + x];
        if (target === tileIndex) return false;
        const stack = [[x, y]];
        while (stack.length) {
            const [cx, cy] = stack.pop();
            if (cx < 0 || cx >= width || cy < 0 || cy >= height) continue;
            if (cells[cy * width + cx] !== target) continue;
            cells[cy * width + cx] = tileIndex;
            stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
        }
        this._announceMap();
        return true;
    }

    /** Empty every map cell (tileset untouched). */
    clearMap() {
        this.map.cells.fill(-1);
        this._announceMap();
    }

    /** Set the document name (persisted with the map). */
    setName(name) {
        this.name = String(name || '').slice(0, 64);
        this._schedulePersist();
    }

    // ── Document load/save shape ───────────────────────────────────────────

    /** The codec-facing document shape (live references, do not mutate). */
    toDocument() {
        return {
            name: this.name,
            tileKind: this.tileKind,
            tiles: this.tiles,
            map: this.map,
            elements: this.elements
        };
    }

    /** Take a document's parts into the working state (the one place that does it). @private */
    _adopt(doc) {
        this.name = doc.name || '';
        this.tileKind = doc.tileKind || this.TILE_KINDS.ULA_CELL;
        this.tiles = doc.tiles;
        this.map = doc.map;
        // A document with no elements field (a tile-only import) leaves the picture's elements alone
        if (Array.isArray(doc.elements)) { this.elements = doc.elements; this._renumber(); }
    }

    /**
     * Replace the working document (from MapCodec.decode or a format
     * handler). Announces MAP_LOADED.
     */
    loadDocument(doc) {
        if (!doc || !Array.isArray(doc.tiles) || !doc.map) return false;
        this._adopt(doc);
        this._emit(EVENTS.MAP_LOADED, { name: this.name });
        this._schedulePersist();
        return true;
    }

    // -- Elements: find repeated parts of the picture (Batch 11A) ───────────

    /** The match modes that make sense in the active screen mode ([] where the find does not run). */
    findModes() {
        if (!window.ColorManager || !this.isCanvasCompatible()) return [];
        // Timex hi-res has no cell attributes: the attribute bytes are invisible leftovers, so 'exact' would compare nothing real
        return ColorManager.hasCellAttributes() ? ['exact', 'dots', 'visual'] : ['dots', 'visual'];
    }

    /** The composited visible picture as a MapFind screen (dots and attribute bytes of every screen), or null where the find does not run. */
    captureScreen() {
        if (!window.LayerManager || !this.findModes().length) return null;
        const flat = LayerManager.flattenVisible();
        const w = ZX_SPECTRUM.GRID_COLS, h = ZX_SPECTRUM.GRID_ROWS, cellH = ZX_SPECTRUM.CELL_HEIGHT;
        const screens = ZX_SPECTRUM.SCREENS === 2 ? 2 : 1;
        const scr = MapFind.make(w, h, cellH, screens);
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const cell = flat.getCell(x, y);
                if (!cell) continue;
                const i = y * w + x;
                scr.attrs[i] = this.attrByte(cell);
                for (let r = 0; r < cellH; r++) scr.bitmap[i * cellH + r] = cell.pixels[r];
                if (screens === 2 && cell.pixelsB) {
                    const j = w * h + i;
                    scr.attrs[j] = this.attrByte({ ink: cell.inkB, paper: cell.paperB, bright: cell.brightB, flash: cell.flashB });
                    for (let r = 0; r < cellH; r++) scr.bitmap[j * cellH + r] = cell.pixelsB[r];
                }
            }
        }
        return scr;
    }

    /** The colours the active mode really shows, for 'visual' compare: built from the live palette, never from a display toggle. */
    colourTable() {
        const screens = ZX_SPECTRUM.SCREENS === 2 ? 2 : 1;
        const pack = (rgb) => (rgb[0] << 16) | (rgb[1] << 8) | rgb[2];
        return MapFind.tableFrom(screens, (plane, attr) => {
            const t = ColorManager.attrToIndices(this.attrFields(attr), plane);
            return { ink: pack(ColorManager.getRGB(t.ink)), paper: pack(ColorManager.getRGB(t.paper)), flashing: !!t.flashing };
        });
    }

    /** The w x h cells at (x, y) of a captured screen, as a block. */
    sliceBlock(screen, x, y, w, h) {
        return MapFind.slice(screen, x, y, w, h);
    }

    /**
     * Every place a block appears on the picture.
     * @param {Object} block - from sliceBlock
     * @param {string} mode - one of findModes()
     * @param {Object} [screen] - captureScreen() result (taken now if left out)
     * @param {Object} [table] - colourTable() result (taken now if left out)
     * @returns {?{positions: {x:number,y:number}[]}} null when the mode is not available here
     */
    findElement(block, mode, screen, table) {
        if (!this.findModes().includes(mode)) return null;
        const scr = screen || this.captureScreen();
        if (!scr) return null;
        const found = MapFind.find(scr, block, mode, mode === 'visual' ? (table || this.colourTable()) : null);
        return found ? { positions: found } : null;
    }

    /**
     * Keep a found element with the map.
     * @param {Object} block - the element's cells (MapFind block)
     * @param {{x:number,y:number}[]} positions - where it was found, in cells of the picture grid
     * @param {{match:string, name?:string, gridW:number, gridH:number}} info
     * @returns {{ok:true, index:number}|{ok:false, reason:string}}
     */
    addElement(block, positions, info) {
        const seen = new Set();
        const list = [];
        for (const p of (positions || []).slice().sort((a, b) => (a.y - b.y) || (a.x - b.x))) {
            const k = p.x + ',' + p.y;
            if (!seen.has(k)) { seen.add(k); list.push({ x: p.x, y: p.y }); }
        }
        const el = {
            number: this.nextElementNumber(),
            name: String((info && info.name) || '').slice(0, 64), w: block && block.w, h: block && block.h,
            screens: block && block.screens, gridW: info && info.gridW, gridH: info && info.gridH, match: info && info.match,
            bitmap: block && Uint8Array.from(block.bitmap), attrs: block && Uint8Array.from(block.attrs), positions: list
        };
        // 'invalid' = the element itself is wrong; 'tooBig' = it is fine but the document would no longer fit the size limit (the UI translates the code)
        if (!MapCodec._encodeElement(el)) return { ok: false, reason: 'invalid' };
        const trial = MapCodec.encode({ ...this.toDocument(), elements: [...this.elements, el] });
        if (!trial) return { ok: false, reason: 'tooBig' };
        this.elements.push(el);
        this._announceElements();
        return { ok: true, index: this.elements.length - 1 };
    }

    /**
     * A pixel rectangle (a selection) as a block of whole cells of the picture, or null if it is not whole cells or lies outside the picture.
     * @param {{x:number,y:number,width:number,height:number}} rect
     * @returns {?{x:number,y:number,w:number,h:number}}
     */
    blockAt(rect) {
        if (!rect) return null;
        const cw = ZX_SPECTRUM.CELL_WIDTH, ch = ZX_SPECTRUM.CELL_HEIGHT;
        const { x, y, width, height } = rect;
        if (![x, y, width, height].every(Number.isInteger) || width < 1 || height < 1) return null;
        if (x % cw || y % ch || width % cw || height % ch || x < 0 || y < 0) return null;
        const b = { x: x / cw, y: y / ch, w: width / cw, h: height / ch };
        return (b.x + b.w <= ZX_SPECTRUM.GRID_COLS && b.y + b.h <= ZX_SPECTRUM.GRID_ROWS) ? b : null;
    }

    /** The cells ("x,y") the elements that fit the current picture already cover. */
    coveredCells() {
        const out = new Set();
        for (const el of this.elements) {
            if (!this.elementFitsScreen(el)) continue;
            for (const p of el.positions) {
                for (let dy = 0; dy < el.h; dy++) for (let dx = 0; dx < el.w; dx++) out.add((p.x + dx) + ',' + (p.y + dy));
            }
        }
        return out;
    }

    /**
     * From everything a find returned, the places an Accept will keep: places touching a cell an earlier element covers are left out, then places
     * that overlap each other are resolved with the source first. (The source itself is always kept: you chose it.)
     * @returns {{kept:{x:number,y:number}[], covered:number, overlapping:number}}
     */
    placesFrom(positions, w, h, source) {
        const covered = this.coveredCells();
        const free = positions.filter(p => {
            if (source && p.x === source.x && p.y === source.y) return true;
            for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) if (covered.has((p.x + dx) + ',' + (p.y + dy))) return false;
            return true;
        });
        const kept = MapFind.disjoint(free, w, h, source);
        return { kept, covered: positions.length - free.length, overlapping: free.length - kept.length };
    }

    /** The number the next element gets: one more than the highest in use, so a number is never reused after a delete. */
    nextElementNumber() {
        return this.elements.reduce((m, e) => (e.number > m ? e.number : m), 0) + 1;
    }

    /** Give every element without a number the next free one, in order (files written before elements were numbered). @private */
    _renumber() {
        for (const e of this.elements) if (!(e.number > 0)) e.number = this.nextElementNumber();
    }

    /** Remove every element. */
    clearElements() {
        if (!this.elements.length) return;
        this.elements = [];
        this._announceElements();
    }

    /**
     * Replace the elements with a list from a saved project or the autosave. Anything that is not a valid element is left out; no list means none.
     */
    setElements(list) {
        const ok = [];
        for (const e of (Array.isArray(list) ? list : [])) {
            const el = e && { ...e, bitmap: Uint8Array.from(e.bitmap || []), attrs: Uint8Array.from(e.attrs || []), positions: (e.positions || []).map(p => ({ x: p.x, y: p.y })) };
            if (el && MapCodec._encodeElement(el)) ok.push(el);
        }
        this.elements = ok;
        this._renumber();
        this._announceElements();
    }

    /** Copies of the elements (editing them changes nothing). */
    getElements() {
        return this.elements.map(e => ({ ...e, bitmap: Uint8Array.from(e.bitmap), attrs: Uint8Array.from(e.attrs), positions: e.positions.map(p => ({ ...p })) }));
    }

    removeElement(index) {
        if (!Number.isInteger(index) || index < 0 || index >= this.elements.length) return false;
        this.elements.splice(index, 1);
        this._announceElements();
        return true;
    }

    /** True while the picture's grid and mode are the ones the element's places belong to. */
    elementFitsScreen(el) {
        return !!el && this.isCanvasCompatible() && el.gridW === ZX_SPECTRUM.GRID_COLS && el.gridH === ZX_SPECTRUM.GRID_ROWS &&
            el.screens === (ZX_SPECTRUM.SCREENS === 2 ? 2 : 1);
    }

    _announceElements() {
        this._emit(EVENTS.MAP_ELEMENTS_CHANGED, { count: this.elements.length });
        this._schedulePersist();
    }

    // ── Canvas bridges ─────────────────────────────────────────────────────

    /**
     * Capture a cell-aligned canvas region into tiles ("capture canvas to
     * tiles"). Reads the composited visible layers (same source as SCR
     * export), dedups byte-identical cells, appends new tiles, and returns
     * the tile-index grid of the region.
     * @param {number} cellX - left cell (0-based)
     * @param {number} cellY - top cell
     * @param {number} wCells
     * @param {number} hCells
     * @returns {{ width:number, height:number, indices:Int16Array }|null}
     */
    captureCanvasRegion(cellX, cellY, wCells, hCells) {
        if (!window.LayerManager) return null;
        // 'ula-cell' tiles are 8×8 — the bridge only works while the canvas
        // has matching cells (the UI gates too; this is the model guard)
        if (!this.isCanvasCompatible()) return null;
        const cols = ZX_SPECTRUM.GRID_COLS, rows = ZX_SPECTRUM.GRID_ROWS;
        const x0 = clamp(cellX | 0, 0, cols - 1);
        const y0 = clamp(cellY | 0, 0, rows - 1);
        const w = clamp(wCells | 0, 1, cols - x0);
        const h = clamp(hCells | 0, 1, rows - y0);

        const flattened = LayerManager.flattenVisible();
        const indices = new Int16Array(w * h);
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const cell = flattened.getCell(x0 + x, y0 + y);
                const tile = this.createTile(
                    cell ? cell.pixels : null,
                    cell ? this.attrByte(cell) : 0x38
                );
                indices[y * w + x] = this.addTile(tile, true);
            }
        }
        return { width: w, height: h, indices };
    }

    /**
     * Capture a canvas region AND stamp its tile indices into the map at
     * (mapX, mapY). Cells that fall outside the map are dropped.
     */
    captureCanvasRegionToMap(cellX, cellY, wCells, hCells, mapX = 0, mapY = 0) {
        const grid = this.captureCanvasRegion(cellX, cellY, wCells, hCells);
        if (!grid) return false;
        for (let y = 0; y < grid.height; y++) {
            for (let x = 0; x < grid.width; x++) {
                const mx = mapX + x, my = mapY + y;
                if (!this._inMap(mx, my)) continue;
                this.map.cells[my * this.map.width + mx] = grid.indices[y * grid.width + x];
            }
        }
        this._announceMap();
        return true;
    }

    // ── Persistence (MAPS store, ClipboardCodec pattern) ───────────────────

    /** Persist the working document (debounced by the callers via _schedulePersist). */
    async persist() {
        if (!window.Storage || !Storage.STORES || !Storage.STORES.MAPS) return;
        // The map store keeps the TILE map only: elements belong to the picture (project, autosave, .zxm), never restored on their own
        const payload = MapCodec.encode({ ...this.toDocument(), elements: [] });
        try {
            if (payload) {
                await Storage.set(this.STORAGE_KEY, payload, Storage.STORES.MAPS);
            } else {
                // Not encodable (too big, or something invalid): keep the record that is there rather than delete the person's map
                Logger.warn('MapService', 'The map cannot be encoded; the stored copy is left as it was');
            }
        } catch (error) {
            Logger.warn('MapService', 'Persist failed', error);
        }
    }

    /** Restore the persisted working document at boot (app.js Phase 3). */
    async restorePersisted() {
        if (!window.Storage || !Storage.STORES || !Storage.STORES.MAPS) return;
        try {
            const payload = await Storage.get(this.STORAGE_KEY, Storage.STORES.MAPS);
            if (!payload) return;
            const doc = MapCodec.decode(payload);
            if (!doc) {
                Logger.warn('MapService', 'Discarding unreadable persisted map');
                await Storage.delete(this.STORAGE_KEY, Storage.STORES.MAPS);
                return;
            }
            this._adopt(doc);
            this.elements = [];     // whatever an older build stored here is not restored
            this._emit(EVENTS.MAP_LOADED, { name: this.name, restored: true });
            Logger.info('MapService',
                `Restored persisted map (${doc.tiles.length} tiles, ${doc.map.width}×${doc.map.height})`);
        } catch (error) {
            Logger.warn('MapService', 'Restore failed', error);
        }
    }

    // ── Internals ──────────────────────────────────────────────────────────

    _blankMap(width, height) {
        const cells = new Int16Array(width * height);
        cells.fill(-1);
        return { width, height, cells };
    }

    _inMap(x, y) {
        return Number.isInteger(x) && Number.isInteger(y) &&
               x >= 0 && x < this.map.width && y >= 0 && y < this.map.height;
    }

    _announceMap() {
        this._emit(EVENTS.MAP_CHANGED, { width: this.map.width, height: this.map.height });
        this._schedulePersist();
    }

    _announceTileset() {
        this._emit(EVENTS.MAP_TILESET_CHANGED, { count: this.tiles.length });
        this._schedulePersist();
    }

    _emit(event, data) {
        if (window.EventBus) EventBus.emit(event, data);
    }

    /** Debounce persistence so paint drags do not hammer IndexedDB. */
    _schedulePersist() {
        if (typeof setTimeout !== 'function') return;
        clearTimeout(this._persistTimer);
        this._persistTimer = setTimeout(() => { this.persist(); }, 800);
    }
}

window.MapService = new MapServiceClass();

Logger.debug('MapService', 'Map service module loaded');

})(); // End IIFE
