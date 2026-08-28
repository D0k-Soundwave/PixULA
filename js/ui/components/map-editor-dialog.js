'use strict';
(function() {

/**
 * MapEditorDialog — the Phase 11 map/tile editor (File > Map Editor…).
 *
 * Dialog-based editor over MapService:
 *   left  — tile palette (thumbnails from the tileset), tile sources
 *           (blank tile, current 8×8 pattern + current colours), and the
 *           in-place tile editor: the shared CellGridEditor component
 *           (same surface as the Pattern Creator) plus ZX attribute
 *           controls (ink/paper/bright/flash).
 *   right — scrollable, zoomable map viewport. Only the visible window is
 *           rasterized (virtual rendering), so multi-screen maps scroll
 *           smoothly. Tools: paint (right button erases), erase, flood
 *           fill, pick-tile-from-map. Map resize, name, import/export
 *           (.zxtm native, .zxm ZX-Paintbrush, asm/c/bin via DevFormat),
 *           and the two canvas bridges (render map window to canvas,
 *           capture screen into the map).
 *
 * Commands go down as MapService calls; this dialog repaints ONLY from
 * the EVENTS.MAP_* facts coming back up. Offscreen tile rasters come
 * from Helpers.createCanvas (the one scratch-canvas path).
 */
class MapEditorDialogClass {
    constructor() {
        this._root = null;
        this._unsubscribes = [];
        this._selected = -1;
        this._tool = 'paint';
        this._zoom = 2;             // canvas px per map px (tile = 8*zoom)
        this._tileCache = new Map(); // tile index -> 1× canvas
        this._painting = false;
        this._statusTimeout = null;

        this._tileEditor = null;    // created lazily (shared CellGridEditor)
        this._suppressTileCommit = false;
    }

    /** English fallback (dialog builds DOM, I18n.apply re-translates). @private */
    _t(key, fallback, params) {
        if (window.I18n && typeof I18n.t === 'function') {
            const v = I18n.t(key, params);
            if (v && v !== key) return v;
        }
        return fallback;
    }

    /** Open (or focus) the map editor. */
    open() {
        if (Dialog.isOpen('map-editor')) return;
        // 'ula-cell' tiles are 8×8 — gate cleanly in cell-incompatible
        // screen modes rather than corrupt (Phase 12a)
        if (!MapService.isCanvasCompatible()) {
            alert(this._t('mode.needs8x8',
                'This feature needs 8×8 attribute cells — switch to Standard ULA or ULAplus mode first.'));
            return;
        }
        this._createDialog();
        this._refreshAll();
        this._syncStampButtons();
    }

    // ─── Dialog creation ──────────────────────────────────────────────────

    _createDialog() {
        const colorKeys = ['black', 'blue', 'red', 'magenta', 'green', 'cyan', 'yellow', 'white'];
        const colorOptions = colorKeys.map((k, i) =>
            `<option value="${i}" data-i18n="color.${k}">${this._t('color.' + k, k)}</option>`).join('');

        const content = document.createElement('div');
        content.className = 'me-layout';
        content.innerHTML = `
            <div class="me-tiles">
                <div class="me-section-title" data-i18n="map.tiles">${this._t('map.tiles', 'Tiles')}</div>
                <div class="me-tile-list"></div>
                <div class="me-tile-actions">
                    <button type="button" class="pc-btn me-add-blank" data-i18n="map.addBlank">${this._t('map.addBlank', 'New Tile')}</button>
                    <button type="button" class="pc-btn me-from-pattern" data-i18n="map.fromPattern">${this._t('map.fromPattern', 'From Pattern')}</button>
                    <button type="button" class="pc-btn me-delete-tile" data-i18n="map.deleteTile">${this._t('map.deleteTile', 'Delete Tile')}</button>
                    <button type="button" class="pc-btn me-save-tile-stamp" data-i18n="map.saveTileToStamp" disabled>${this._t('map.saveTileToStamp', 'Save Tile to Stamp')}</button>
                </div>
                <div class="me-section-title" data-i18n="map.editTile">${this._t('map.editTile', 'Edit Tile')}</div>
                <div class="me-tile-toolbar">
                    ${Helpers.miniToolButton('brush', 'B', 'tool.brush', 'Brush', 'miniTool.brush.hint', 'Click or drag to set pixels', true)}
                    ${Helpers.miniToolButton('eraser', 'E', 'tool.eraser', 'Eraser', 'tool.eraser.hint', 'Clear pixels back to the paper colour')}
                    ${Helpers.miniToolButton('line', 'S', 'shape.line', 'Line', 'miniTool.line.hint', 'Drag to draw a straight line between two points')}
                    ${Helpers.miniToolButton('fill', 'F', 'tool.fill', 'Fill', 'tool.fill.hint', 'Flood the area under the cursor out to its edges')}
                </div>
                <div class="me-tile-editor-slot"></div>
                <div class="me-attr-row">
                    <label><span data-i18n="color.ink">${this._t('color.ink', 'Ink')}</span>
                        <select class="me-ink" id="me-ink" name="me-ink">${colorOptions}</select></label>
                    <label><span data-i18n="color.paper">${this._t('color.paper', 'Paper')}</span>
                        <select class="me-paper" id="me-paper" name="me-paper">${colorOptions}</select></label>
                </div>
                <div class="me-attr-row">
                    <label><input type="checkbox" class="me-bright" id="me-bright" name="me-bright"> <span data-i18n="color.bright">${this._t('color.bright', 'Bright')}</span></label>
                    <label><input type="checkbox" class="me-flash" id="me-flash" name="me-flash"> <span data-i18n="color.flash">${this._t('color.flash', 'Flash')}</span></label>
                </div>
            </div>
            <div class="me-center">
                <div class="me-toolbar">
                    <div class="me-tool-group">
                        <span class="btn-captioned">${Helpers.captionHTML('map.tool.paint', 'Paint')}<button type="button" data-maptool="paint" class="tool-btn active" data-i18n-title-name="map.tool.paint" data-i18n-title="map.tool.paint.hint" data-i18n-aria-label="map.tool.paint" aria-label="${this._t('map.tool.paint', 'Paint')}" title="${Helpers.composeTitle(this._t('map.tool.paint', 'Paint'), this._t('map.tool.paint.hint', 'Draws the selected tile into the map at the cursor'))}"><span class="tool-icon">P</span></button></span>
                        <span class="btn-captioned">${Helpers.captionHTML('map.tool.erase', 'Erase')}<button type="button" data-maptool="erase" class="tool-btn" data-i18n-title-name="map.tool.erase" data-i18n-title="map.tool.erase.hint" data-i18n-aria-label="map.tool.erase" aria-label="${this._t('map.tool.erase', 'Erase')}" title="${Helpers.composeTitle(this._t('map.tool.erase', 'Erase'), this._t('map.tool.erase.hint', 'Clears map cells back to empty'))}"><span class="tool-icon">E</span></button></span>
                        <span class="btn-captioned">${Helpers.captionHTML('map.tool.fill', 'Fill')}<button type="button" data-maptool="fill"  class="tool-btn" data-i18n-title-name="map.tool.fill" data-i18n-title="map.tool.fill.hint" data-i18n-aria-label="map.tool.fill" aria-label="${this._t('map.tool.fill', 'Fill')}" title="${Helpers.composeTitle(this._t('map.tool.fill', 'Fill'), this._t('map.tool.fill.hint', 'Floods same-tile cells out from the cursor with the selected tile'))}"><span class="tool-icon">F</span></button></span>
                        <span class="btn-captioned">${Helpers.captionHTML('cap.pick', 'Pick')}<button type="button" data-maptool="pick"  class="tool-btn" data-i18n-title-name="map.tool.pick" data-i18n-title="map.tool.pick.hint" data-i18n-aria-label="map.tool.pick" aria-label="${this._t('map.tool.pick', 'Pick Tile')}" title="${Helpers.composeTitle(this._t('map.tool.pick', 'Pick Tile'), this._t('map.tool.pick.hint', 'Picks up the tile under the cursor as the one to paint with'))}"><span class="tool-icon">I</span></button></span>
                    </div>
                    <div class="me-tool-group">
                        <button type="button" class="pc-btn me-zoom-out" data-i18n-title-name="menu.view.zoomOut" data-i18n-title="view.zoomOut.hint" title="${Helpers.composeTitle(this._t('menu.view.zoomOut', 'Zoom Out'), this._t('view.zoomOut.hint', 'Steps down to the next zoom level'))}">&#8722;</button>
                        <span class="me-zoom-label">2&#215;</span>
                        <button type="button" class="pc-btn me-zoom-in" data-i18n-title-name="menu.view.zoomIn" data-i18n-title="view.zoomIn.hint" title="${Helpers.composeTitle(this._t('menu.view.zoomIn', 'Zoom In'), this._t('view.zoomIn.hint', 'Steps up to the next zoom level'))}">+</button>
                    </div>
                    <div class="me-tool-group">
                        <label><span data-i18n="map.width">${this._t('map.width', 'Width')}</span>
                            <input type="number" class="me-width" id="me-width" name="me-width" min="1" max="${MapService.MAX_DIM}"></label>
                        <label><span data-i18n="map.height">${this._t('map.height', 'Height')}</span>
                            <input type="number" class="me-height" id="me-height" name="me-height" min="1" max="${MapService.MAX_DIM}"></label>
                        <button type="button" class="pc-btn me-resize" data-i18n="map.resize">${this._t('map.resize', 'Resize')}</button>
                    </div>
                    <input type="text" class="me-name" id="me-name" name="me-name" placeholder="${this._t('map.name', 'Map name...')}" data-i18n-placeholder="map.name">
                </div>
                <div class="me-viewport">
                    <div class="me-sizer"></div>
                    <canvas class="me-map-canvas"></canvas>
                </div>
                <div class="me-status pc-status"></div>
                <div class="me-bridges">
                    <button type="button" class="pc-btn me-render" data-i18n="map.renderToCanvas">${this._t('map.renderToCanvas', 'Render to Canvas')}</button>
                    <button type="button" class="pc-btn me-capture" data-i18n="map.captureScreen">${this._t('map.captureScreen', 'Capture Screen')}</button>
                    <button type="button" class="pc-btn me-import" data-i18n="map.import">${this._t('map.import', 'Import...')}</button>
                    <select class="me-export-format" id="me-export-format" name="me-export-format">
                        <option value="zxtm">ZXTM</option>
                        <option value="zxm">ZXM</option>
                        <option value="asm">ASM</option>
                        <option value="c">C</option>
                        <option value="bin">BIN</option>
                        <option value="next-asm">Next ASM</option>
                        <option value="next-c">Next C</option>
                        <option value="next-bin">Next BIN</option>
                    </select>
                    <button type="button" class="pc-btn me-export" data-i18n="map.export">${this._t('map.export', 'Export')}</button>
                    <input type="file" class="me-file-input" id="me-file-input" name="me-file-input" accept=".zxtm,.zxm" hidden>
                </div>
            </div>
        `;

        Dialog.open({
            id: 'map-editor',
            titleI18n: 'map.title',
            title: 'Map Editor',
            content,
            className: 'map-editor-dialog',
            onClose: () => this._onClose()
        });

        this._root = content;
        this._viewport = content.querySelector('.me-viewport');
        this._sizer = content.querySelector('.me-sizer');
        this._canvas = content.querySelector('.me-map-canvas');
        this._ctx = this._canvas.getContext('2d');
        this._tileList = content.querySelector('.me-tile-list');
        this._statusMsg = content.querySelector('.me-status');

        // Shared cell editor for in-place tile editing (2nd consumer after
        // the Pattern Creator; the Phase 10 font editor is the planned 3rd)
        const { w, h } = MapService.getTileSize();
        this._tileEditor = new CellGridEditor({
            width: w,
            height: h,
            canvasWidth: 160,
            canvasHeight: 160,
            getInk: () => this._selectedColors().ink,
            getPaper: () => this._selectedColors().paper,
            onChange: () => this._commitTileEdit(),
            className: 'me-tile-canvas'
        });
        content.querySelector('.me-tile-editor-slot').appendChild(this._tileEditor.element);

        this._attachEvents(content);

        // Repaint from facts only
        this._unsubscribes = [
            EventBus.on(EVENTS.MAP_CHANGED, () => { this._syncSizer(); this._redrawMap(); }),
            EventBus.on(EVENTS.MAP_TILESET_CHANGED, () => {
                this._tileCache.clear();
                this._refreshTileList();
                this._redrawMap();
            }),
            EventBus.on(EVENTS.MAP_LOADED, () => this._refreshAll()),
            EventBus.on(EVENTS.THEME_CHANGED, () => this._redrawMap())
        ];
    }

    _onClose() {
        this._unsubscribes.forEach(u => u());
        this._unsubscribes = [];
        this._root = null;
        this._tileEditor = null;
        this._tileCache.clear();
        MapService.persist();
    }

    // ─── Event wiring ─────────────────────────────────────────────────────

    _attachEvents(c) {
        // Tile palette actions
        c.querySelector('.me-add-blank').addEventListener('click', () => {
            const idx = MapService.addTile(MapService.createTile(), false);
            if (idx < 0) { this._status(this._t('map.status.tileLimit', 'Tile limit reached.')); return; }
            this._selectTile(idx);
        });
        c.querySelector('.me-from-pattern').addEventListener('click', () => this._addFromPattern());
        c.querySelector('.me-delete-tile').addEventListener('click', () => this._deleteSelected());
        c.querySelector('.me-save-tile-stamp').addEventListener('click', () => this._saveTileToStamp());

        this._tileList.addEventListener('click', e => {
            const item = e.target.closest('[data-index]');
            if (item) this._selectTile(parseInt(item.dataset.index, 10));
        });

        // Tile mini-editor toolbar
        c.querySelector('.me-tile-toolbar').addEventListener('click', e => {
            const btn = e.target.closest('button[data-tool]');
            if (!btn) return;
            c.querySelectorAll('.me-tile-toolbar button').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            this._tileEditor.setTool(btn.dataset.tool);
        });

        // Attribute controls commit into the selected tile
        for (const sel of ['.me-ink', '.me-paper', '.me-bright', '.me-flash']) {
            c.querySelector(sel).addEventListener('change', () => this._commitTileEdit());
        }

        // Map tools
        c.querySelector('.me-toolbar').addEventListener('click', e => {
            const btn = e.target.closest('button[data-maptool]');
            if (!btn) return;
            c.querySelectorAll('button[data-maptool]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            this._tool = btn.dataset.maptool;
        });

        // Zoom
        c.querySelector('.me-zoom-in').addEventListener('click', () => this._setZoom(this._zoom + 1));
        c.querySelector('.me-zoom-out').addEventListener('click', () => this._setZoom(this._zoom - 1));

        // Resize
        c.querySelector('.me-resize').addEventListener('click', () => {
            const w = parseInt(c.querySelector('.me-width').value, 10);
            const h = parseInt(c.querySelector('.me-height').value, 10);
            if (Number.isInteger(w) && Number.isInteger(h)) MapService.resizeMap(w, h);
        });

        // Name
        c.querySelector('.me-name').addEventListener('input', e => MapService.setName(e.target.value));

        // Viewport: virtual scroll + painting
        this._viewport.addEventListener('scroll', () => this._onScroll());
        this._canvas.addEventListener('pointerdown', e => this._onMapPointer(e, true));
        this._canvas.addEventListener('pointermove', e => {
            if (this._painting) this._onMapPointer(e, false);
        });
        this._canvas.addEventListener('pointerup', () => { this._painting = false; });
        this._canvas.addEventListener('pointerleave', () => { this._painting = false; });
        this._canvas.addEventListener('contextmenu', e => e.preventDefault());

        // Bridges
        c.querySelector('.me-render').addEventListener('click', () => {
            const origin = this._scrollOriginCells();
            MapService.renderMapToCanvas(origin.x, origin.y, 0, 0);
            this._status(this._t('map.status.rendered', 'Map rendered to canvas.'));
        });
        c.querySelector('.me-capture').addEventListener('click', () => {
            const cols = ZX_SPECTRUM.GRID_COLS, rows = ZX_SPECTRUM.GRID_ROWS;
            const origin = this._scrollOriginCells();
            const map = MapService.getMap();
            if (map.width < origin.x + cols || map.height < origin.y + rows) {
                MapService.resizeMap(Math.max(map.width, origin.x + cols),
                                     Math.max(map.height, origin.y + rows));
            }
            MapService.captureCanvasRegionToMap(0, 0, cols, rows, origin.x, origin.y);
            this._status(this._t('map.status.captured', 'Screen captured into map.'));
        });

        // Import / export
        c.querySelector('.me-import').addEventListener('click',
            () => c.querySelector('.me-file-input').click());
        c.querySelector('.me-file-input').addEventListener('change', e => this._importFile(e));
        c.querySelector('.me-export').addEventListener('click',
            () => this._export(c.querySelector('.me-export-format').value));
    }

    // ─── Tile palette ─────────────────────────────────────────────────────

    _refreshTileList() {
        if (!this._tileList) return;
        this._tileList.textContent = '';
        const tiles = MapService.getTiles();
        if (!tiles.length) {
            const empty = document.createElement('div');
            empty.className = 'pc-library-empty';
            empty.dataset.i18n = 'map.empty';
            empty.textContent = this._t('map.empty', 'No tiles yet. Add one below.');
            this._tileList.appendChild(empty);
            this._selected = -1;
            this._syncStampButtons();
            return;
        }
        if (this._selected >= tiles.length) this._selected = tiles.length - 1;
        tiles.forEach((tile, i) => {
            const item = document.createElement('canvas');
            item.width = item.height = 24;
            item.className = 'me-tile-thumb' + (i === this._selected ? ' me-tile-thumb--active' : '');
            item.dataset.index = String(i);
            item.title = `#${i}`;
            const ctx = item.getContext('2d');
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(this._tileCanvas(i), 0, 0, 24, 24);
            this._tileList.appendChild(item);
        });
        this._syncStampButtons();
    }

    _selectTile(index) {
        this._selected = index;
        this._refreshTileList();
        this._loadTileIntoEditor();
        this._syncStampButtons();
    }

    /** Push the selected tile's bitmap + attrs into the editing controls. */
    _loadTileIntoEditor() {
        const tile = MapService.getTile(this._selected);
        if (!tile || !this._root) return;
        const { w, h } = MapService.getTileSize();
        const pixels = new Uint8Array(w * h);
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                pixels[y * w + x] = (tile.bitmap[y] >> (w - 1 - x)) & 1;
            }
        }
        this._suppressTileCommit = true;
        this._tileEditor.setPixels(pixels);
        const f = MapService.attrFields(tile.attr);
        this._root.querySelector('.me-ink').value = String(f.ink);
        this._root.querySelector('.me-paper').value = String(f.paper);
        this._root.querySelector('.me-bright').checked = f.bright;
        this._root.querySelector('.me-flash').checked = f.flash;
        this._suppressTileCommit = false;
    }

    /** Commit the editing controls back into the selected tile. */
    _commitTileEdit() {
        if (this._suppressTileCommit || !this._root) return;
        const tile = MapService.getTile(this._selected);
        if (!tile) return;
        const { w, h } = MapService.getTileSize();
        const pixels = this._tileEditor.getPixels();
        const bitmap = new Uint8Array(h);
        for (let y = 0; y < h; y++) {
            let byte = 0;
            for (let x = 0; x < w; x++) {
                if (pixels[y * w + x]) byte |= 1 << (w - 1 - x);
            }
            bitmap[y] = byte;
        }
        const attr = MapService.attrByte({
            ink: parseInt(this._root.querySelector('.me-ink').value, 10),
            paper: parseInt(this._root.querySelector('.me-paper').value, 10),
            bright: this._root.querySelector('.me-bright').checked,
            flash: this._root.querySelector('.me-flash').checked
        });
        MapService.updateTile(this._selected, { kind: tile.kind, bitmap, attr });
        this._tileEditor.redraw(); // ink/paper display colours may have changed
    }

    _addFromPattern() {
        const data = window.PatternService ? PatternService.getCurrentPatternData() : null;
        const tile = data ? MapService.tileFromPattern(data) : null;
        if (!tile) {
            this._status(this._t('map.status.noPattern', 'Select an 8×8 pattern first.'));
            return;
        }
        const idx = MapService.addTile(tile, true);
        if (idx < 0) { this._status(this._t('map.status.tileLimit', 'Tile limit reached.')); return; }
        this._selectTile(idx);
        this._status(this._t('map.status.patternAdded', 'Pattern added as tile.'));
    }

    _deleteSelected() {
        if (this._selected < 0) {
            this._status(this._t('map.status.noTile', 'Select a tile first.'));
            return;
        }
        const ok = window.confirm(this._t('map.confirmDeleteTile',
            'Delete the selected tile? Map cells using it become empty.'));
        if (!ok) return;
        MapService.removeTile(this._selected);
        this._selected = Math.min(this._selected, MapService.tileCount() - 1);
        this._loadTileIntoEditor();
        this._status(this._t('map.status.deleted', 'Tile deleted.'));
    }

    /**
     * Build a mask + per-cell attrs grid from a rectangle of tiles and hand
     * it to SelectionService as a draggable stamp. Shared by Save Tile to
     * Stamp (1x1) and Save Room to Stamp (Task 6). tileAt(cx, cy) returns a
     * tile object ({bitmap, attr}) or null for an empty cell.
     * @param {number} tilesWide
     * @param {number} tilesHigh
     * @param {function(number,number):(Object|null)} tileAt
     * @param {string} label - undo/stamp label
     * @private
     */
    _buildStampFromTiles(tilesWide, tilesHigh, tileAt, label) {
        const { w: cw, h: ch } = MapService.getTileSize();
        const width = tilesWide * cw, height = tilesHigh * ch;
        const mask = Array.from({ length: height }, () => Array(width).fill(false));
        const attrs = new Array(tilesWide * tilesHigh).fill(null);

        for (let ty = 0; ty < tilesHigh; ty++) {
            for (let tx = 0; tx < tilesWide; tx++) {
                const tile = tileAt(tx, ty);
                if (!tile) continue;
                attrs[ty * tilesWide + tx] = tile.attr;
                for (let ly = 0; ly < ch; ly++) {
                    const byte = tile.bitmap[ly];
                    for (let lx = 0; lx < cw; lx++) {
                        if ((byte >> (cw - 1 - lx)) & 1) {
                            mask[ty * ch + ly][tx * cw + lx] = true;
                        }
                    }
                }
            }
        }

        SelectionService.startFloatingPasteFromMask(mask, width, height, 0, 0, label);
        if (!SelectionService.floatingPaste) return false; // max layers reached
        SelectionService.floatingPaste.attrs = attrs;
        SelectionService.floatingPaste.floatingLayer.clear();
        LayerManager.composeToCanvas();
        SelectionService._drawFloatingLayer();
        LayerManager.flushPendingCompose();
        CanvasSystem.requestRender();
        return true;
    }

    _saveTileToStamp() {
        const tile = MapService.getTile(this._selected);
        if (!tile) return;
        if (this._buildStampFromTiles(1, 1, () => tile,
            this._t('map.saveTileToStamp', 'Save Tile to Stamp'))) {
            this._status(this._t('map.status.tileStamped', 'Tile saved as a stamp.'));
        }
    }

    /** CSS colours of the selected tile's attr, for the tile editor. */
    _selectedColors() {
        const tile = MapService.getTile(this._selected);
        const f = tile ? MapService.attrFields(tile.attr) : { ink: 0, paper: 7, bright: false };
        const bright = f.bright ? 8 : 0;
        return { ink: ZX_PALETTE[f.ink + bright], paper: ZX_PALETTE[f.paper + bright] };
    }

    /** Keep Save Tile to Stamp's enabled state matched to whether a tile is selected. @private */
    _syncStampButtons() {
        if (!this._root) return;
        const btn = this._root.querySelector('.me-save-tile-stamp');
        if (btn) btn.disabled = this._selected < 0;
    }

    // ─── Map viewport (virtual rendering) ─────────────────────────────────

    _tilePx() { return MapService.getTileSize().w * this._zoom; }

    _setZoom(zoom) {
        this._zoom = clamp(zoom, 1, 6);
        if (this._root) {
            this._root.querySelector('.me-zoom-label').textContent = `${this._zoom}×`;
        }
        this._syncSizer();
        this._redrawMap();
    }

    _scrollOriginCells() {
        const ts = this._tilePx();
        return {
            x: Math.floor(this._viewport.scrollLeft / ts),
            y: Math.floor(this._viewport.scrollTop / ts)
        };
    }

    _syncSizer() {
        if (!this._root) return;
        const map = MapService.getMap();
        const ts = this._tilePx();
        this._sizer.style.width = `${map.width * ts}px`;
        this._sizer.style.height = `${map.height * ts}px`;
        // Canvas covers the visible window only
        this._canvas.width = this._viewport.clientWidth;
        this._canvas.height = this._viewport.clientHeight;
        this._onScroll(false);
    }

    _onScroll(redraw = true) {
        // Keep the window canvas glued to the visible area
        this._canvas.style.left = `${this._viewport.scrollLeft}px`;
        this._canvas.style.top = `${this._viewport.scrollTop}px`;
        if (redraw) this._redrawMap();
    }

    _redrawMap() {
        if (!this._root) return;
        const ctx = this._ctx;
        const map = MapService.getMap();
        const ts = this._tilePx();
        const sx = this._viewport.scrollLeft, sy = this._viewport.scrollTop;
        const vw = this._canvas.width, vh = this._canvas.height;

        ctx.clearRect(0, 0, vw, vh);
        ctx.imageSmoothingEnabled = false;

        const x0 = Math.floor(sx / ts), y0 = Math.floor(sy / ts);
        const x1 = Math.min(map.width - 1, Math.floor((sx + vw) / ts));
        const y1 = Math.min(map.height - 1, Math.floor((sy + vh) / ts));

        for (let my = y0; my <= y1; my++) {
            for (let mx = x0; mx <= x1; mx++) {
                const idx = MapService.getMapCell(mx, my);
                if (idx < 0) continue;
                ctx.drawImage(this._tileCanvas(idx), mx * ts - sx, my * ts - sy, ts, ts);
            }
        }

        // Cell grid on top (visible from 2× up, same style as the cell editor)
        if (ts >= 12) {
            ctx.strokeStyle = 'rgba(128,128,128,0.4)';
            ctx.lineWidth = 0.5;
            for (let mx = x0; mx <= x1 + 1; mx++) {
                ctx.beginPath();
                ctx.moveTo(mx * ts - sx, y0 * ts - sy);
                ctx.lineTo(mx * ts - sx, (y1 + 1) * ts - sy);
                ctx.stroke();
            }
            for (let my = y0; my <= y1 + 1; my++) {
                ctx.beginPath();
                ctx.moveTo(x0 * ts - sx, my * ts - sy);
                ctx.lineTo((x1 + 1) * ts - sx, my * ts - sy);
                ctx.stroke();
            }
        }
    }

    /** 1× raster of a tile (offscreen, cached until the tileset changes). */
    _tileCanvas(index) {
        let canvas = this._tileCache.get(index);
        if (canvas) return canvas;
        const { w, h } = MapService.getTileSize();
        const tile = MapService.getTile(index);
        canvas = Helpers.createCanvas(w, h);
        const ctx = canvas.getContext('2d');
        const img = ctx.createImageData(w, h);
        const f = MapService.attrFields(tile ? tile.attr : 0x38);
        const bright = f.bright ? 8 : 0;
        const ink = ZX_PALETTE_RGB[f.ink + bright];
        const paper = ZX_PALETTE_RGB[f.paper + bright];
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const isInk = tile && ((tile.bitmap[y] >> (w - 1 - x)) & 1);
                const rgb = isInk ? ink : paper;
                const o = (y * w + x) * 4;
                img.data[o] = rgb[0];
                img.data[o + 1] = rgb[1];
                img.data[o + 2] = rgb[2];
                img.data[o + 3] = 255;
            }
        }
        ctx.putImageData(img, 0, 0);
        this._tileCache.set(index, canvas);
        return canvas;
    }

    _onMapPointer(e, isDown) {
        e.preventDefault();
        const ts = this._tilePx();
        const rect = this._canvas.getBoundingClientRect();
        // Canvas sits at the scroll offset, so canvas-local + scroll = content
        const x = Math.floor((e.clientX - rect.left + this._viewport.scrollLeft) / ts);
        const y = Math.floor((e.clientY - rect.top + this._viewport.scrollTop) / ts);

        if (isDown) this._painting = true;
        const erase = this._tool === 'erase' || (e.buttons & 2) !== 0 || e.button === 2;

        switch (this._tool) {
            case 'pick': {
                if (!isDown) break;
                const idx = MapService.getMapCell(x, y);
                if (idx >= 0) this._selectTile(idx);
                this._painting = false;
                break;
            }
            case 'fill':
                if (isDown) {
                    MapService.floodFill(x, y, erase ? -1 : this._selected);
                    this._painting = false;
                }
                break;
            default: // paint / erase drags
                MapService.setMapCell(x, y, erase ? -1 : this._selected);
        }
    }

    // ─── Import / export ──────────────────────────────────────────────────

    async _importFile(e) {
        const file = e.target.files[0];
        e.target.value = '';
        if (!file) return;
        const ext = FormatRegistry.getExtension(file.name);
        const handler = FormatRegistry.getImportHandler(ext);
        if (!handler) return;
        try {
            const buffer = await Helpers.readFileAsArrayBuffer(file);
            const result = handler.parse(buffer);
            if (result && result.success) {
                this._status(this._t('map.status.imported', 'Map imported.'));
            } else {
                this._status(this._t('map.status.importFailed', 'Import failed: {error}',
                    { error: (result && result.error) || '?' }));
            }
        } catch (err) {
            this._status(this._t('map.status.importFailed', 'Import failed: {error}',
                { error: err.message }));
        }
    }

    async _export(format) {
        const base = (MapService.name || 'map').replace(/[^\w\- ]+/g, '').trim() || 'map';
        try {
            let saved;
            if (format === 'zxtm') {
                saved = await MapFormat.exportAndDownload(`${base}.zxtm`);
            } else if (format === 'zxm') {
                saved = await ZXMFormat.exportAndDownload(`${base}.zxm`);
            } else if (format.startsWith('next-')) {
                // ZX Spectrum Next tilemap export (Phase 13): ula-cell tiles
                // convert to 4bpp Next tile definitions at export time
                if (MapService.tileCount() > 255) {
                    this._status(this._t('map.status.tooManyTilesDev',
                        'Developer export needs 255 tiles or fewer.'));
                    return;
                }
                const ext = format.slice(5);
                const data = DevFormat.generateNextTilemap(ext, `${base}_map`, MapService.toDocument());
                const mime = ext === 'bin' ? 'application/octet-stream' : 'text/plain';
                saved = await FormatRegistry.download(data, `${base}_next.${ext}`, mime);
            } else {
                if (MapService.tileCount() > 255) {
                    this._status(this._t('map.status.tooManyTilesDev',
                        'Developer export needs 255 tiles or fewer.'));
                    return;
                }
                const data = DevFormat.generateMap(format, `${base}_map`, MapService.toDocument());
                const mime = format === 'bin' ? 'application/octet-stream' : 'text/plain';
                saved = await FormatRegistry.download(data, `${base}_map.${format}`, mime);
            }
            if (saved !== false) this._status(this._t('map.status.exported', 'Map exported.'));
        } catch (err) {
            this._status(err.message);
        }
    }

    // ─── Shared refresh / status ──────────────────────────────────────────

    _refreshAll() {
        if (!this._root) return;
        const map = MapService.getMap();
        this._root.querySelector('.me-width').value = String(map.width);
        this._root.querySelector('.me-height').value = String(map.height);
        this._root.querySelector('.me-name').value = MapService.name;
        this._tileCache.clear();
        if (this._selected < 0 && MapService.tileCount() > 0) this._selected = 0;
        this._refreshTileList();
        this._loadTileIntoEditor();
        this._setZoom(this._zoom); // syncs sizer + redraws
    }

    /*
     * Status-line dwell. [P] Comfortable silent reading runs about 5 words
     * a second (Rayner 1998, widely reproduced). [C] These messages are
     * short - "Font imported." is 2 words, the longest here about 8 - so
     * reading costs under 2 s; 3 s leaves roughly a second to NOTICE the
     * line appear before starting to read it. Short enough that a stale
     * message never outlives the action that caused it.
     */
    _status(msg) {
        if (!this._statusMsg) return;
        this._statusMsg.textContent = msg;
        clearTimeout(this._statusTimeout);
        this._statusTimeout = setTimeout(() => {
            if (this._statusMsg) this._statusMsg.textContent = '';
        }, 3000);
    }
}

window.MapEditorDialog = new MapEditorDialogClass();

Logger.debug('MapEditorDialog', 'Map editor dialog loaded');

})(); // End IIFE
