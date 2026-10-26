'use strict';
(function() {

/**
 * FontEditorDialog — the Phase 10 Sinclair font editor (File > Font
 * Editor…).
 *
 * Dialog-based editor over FontService:
 *   left  — the 256-glyph (or 96-glyph, charset-offset aware) grid
 *           picker rendered on one canvas, the coverage selector and the
 *           named-font library pane (save/load/delete).
 *   right — (All characters on: the whole font as one map you can draw across, with
 *           the Shade and Move tools and zoom; see FontMapView) - the glyph editing surface: the shared CellGridEditor (third
 *           consumer, after the Pattern Creator and the map editor —
 *           this is the width ≠ height case it was built for), the
 *           glyph-ops toolbar (clear/copy/paste/flip/shift/invert), the
 *           width selector (4/6/8; a BIG font - CHX big font set, 8 to 32 pixels
 *           each way - shows its size instead, and is made with New Big Font...
 *           and filled from an installed font with Fill from font...),
 *           load-from-ROM, capture-from-canvas
 *           and import/export for CH4/CH6/CH8/CHR/CHX + the DevFormat
 *           asm/c/bin font dumps.
 *
 * Commands go down as FontService calls; this dialog repaints ONLY from
 * the EVENTS.FONT_* facts coming back up.
 */
class FontEditorDialogClass {
    constructor() {
        this._root = null;
        this._unsubscribes = [];
        this._selected = 65;           // current character code ('A')
        this._suppressGlyphCommit = false;
        this._commitSource = null;     // 'glyph' | 'map' while that surface writes back, so it is not reloaded over itself
        this._mapMode = false;
        this._mapView = null;
        this._tool = 'brush';
        this._statusTimeout = null;
        this._glyphEditor = null;      // created lazily (shared CellGridEditor)

        this.GRID_COLS = 16;
        this.CELL_PX = 18;             // grid-picker cell size (2× glyph + border)
    }

    /** English fallback (dialog builds DOM, I18n.apply re-translates). @private */
    _t(key, fallback, params) {
        if (window.I18n && typeof I18n.t === 'function') {
            const v = I18n.t(key, params);
            if (v && v !== key) return v;
        }
        return fallback;
    }

    /** Open (or focus) the font editor. */
    open() {
        if (Dialog.isOpen('font-editor')) return;
        this._createDialog();
        this._refreshAll();
    }

    // ─── Dialog creation ──────────────────────────────────────────────────

    _createDialog() {
        const content = document.createElement('div');
        content.className = 'fe-layout';
        content.innerHTML = `
            <div class="fe-left">
                <div class="me-section-title" data-i18n="font.glyphs">${this._t('font.glyphs', 'Glyphs')}</div>
                <canvas class="fe-glyph-grid" tabindex="0" role="application" aria-label="${this._t('font.pickerLabel', 'Characters: arrow keys or a typed character choose one')}" data-i18n-aria-label="font.pickerLabel"></canvas>
                <div class="fe-row">
                    <label><span data-i18n="font.coverage">${this._t('font.coverage', 'Charset')}</span>
                        <select class="fe-coverage" id="fe-coverage" name="fe-coverage">
                            <option value="ASCII" data-i18n="font.coverageAscii">${this._t('font.coverageAscii', '96 chars (32-127)')}</option>
                            <option value="FULL" data-i18n="font.coverageFull">${this._t('font.coverageFull', '256 chars (0-255)')}</option>
                        </select></label>
                </div>
                <div class="me-section-title" data-i18n="font.library">${this._t('font.library', 'Font Library')}</div>
                <select class="fe-library" id="fe-library" name="fe-library" size="5"></select>
                <div class="fe-row">
                    <button type="button" class="pc-btn fe-lib-save" data-i18n="font.save">${this._t('font.save', 'Save')}</button>
                    <button type="button" class="pc-btn fe-lib-load" data-i18n="font.load">${this._t('font.load', 'Load')}</button>
                    <button type="button" class="pc-btn fe-lib-delete" data-i18n="font.delete">${this._t('font.delete', 'Delete')}</button>
                </div>
            </div>
            <div class="fe-center">
                <div class="me-toolbar">
                    <div class="me-tool-group">
                        ${Helpers.miniToolButton('brush', 'B', 'tool.brush', 'Brush', 'miniTool.brush.hint', 'Click or drag to draw ink pixels', true)}
                        ${Helpers.miniToolButton('eraser', 'E', 'tool.eraser', 'Eraser', 'tool.eraser.hint', 'Turn ink pixels back into paper pixels')}
                        ${Helpers.miniToolButton('line', 'S', 'shape.line', 'Line', 'miniTool.line.hint', 'Drag to draw a straight line between two points')}
                        ${Helpers.miniToolButton('fill', 'F', 'tool.fill', 'Fill', 'tool.fill.hint', 'Flood the area under the cursor out to its edges')}
                    </div>
                    <div class="me-tool-group">
                        <button type="button" class="pc-btn fe-attr-tool" data-tool="attrs" data-i18n="font.tool.attrs" data-i18n-title-name="font.tool.attrs" data-i18n-title="font.tool.attrs.hint" title="${Helpers.composeTitle(this._t('font.tool.attrs', 'Attributes'), this._t('font.tool.attrs.hint', 'Click a block to give it the Ink, Paper, Bright and Flash on the attribute bar (the first click colours the whole character)'))}">${this._t('font.tool.attrs', 'Attributes')}</button>
                        <button type="button" class="pc-btn fe-map-toggle" aria-pressed="false" data-i18n="font.allCharacters">${this._t('font.allCharacters', 'All characters')}</button>
                        <span class="fe-map-tools" hidden>
                            <button type="button" class="pc-btn" data-tool="shade" data-i18n="font.tool.shade">${this._t('font.tool.shade', 'Shade')}</button>
                            <button type="button" class="pc-btn" data-tool="move" data-i18n="font.tool.move">${this._t('font.tool.move', 'Move')}</button>
                            <button type="button" class="pc-btn fe-zoom-out" data-i18n-aria-label="menu.view.zoomOut" aria-label="${this._t('menu.view.zoomOut', 'Zoom Out')}">&minus;</button>
                            <button type="button" class="pc-btn fe-zoom-fit" data-i18n="font.zoomFit">${this._t('font.zoomFit', 'Fit')}</button>
                            <button type="button" class="pc-btn fe-zoom-in" data-i18n-aria-label="menu.view.zoomIn" aria-label="${this._t('menu.view.zoomIn', 'Zoom In')}">+</button>
                        </span>
                        <span class="fe-size-label" hidden></span>
                        <label class="fe-width-label"><span data-i18n="font.width">${this._t('font.width', 'Width')}</span>
                            <select class="fe-width" id="fe-width" name="fe-width">
                                <option value="4">4×8</option>
                                <option value="6">6×8</option>
                                <option value="8">8×8</option>
                            </select></label>
                    </div>
                    <span class="fe-current"><span class="fe-current-code" data-i18n="font.current"></span><span class="fe-current-char"></span></span>
                </div>
                <div class="fe-editor-slot"></div>
                <div class="me-toolbar fe-ops">
                    <div class="me-tool-group">
                        <span class="btn-captioned">${Helpers.captionHTML('cap.clear', 'Clear')}<button type="button" data-op="clear"  class="tool-btn" data-i18n-title-name="font.op.clear" data-i18n-title="font.op.clear.hint" data-i18n-aria-label="font.op.clear" aria-label="${this._t('font.op.clear', 'Clear glyph')}" title="${Helpers.composeTitle(this._t('font.op.clear', 'Clear glyph'), this._t('font.op.clear.hint', 'Empties the current glyph back to blank'))}"><span class="tool-icon">&#8709;</span></button></span>
                        <span class="btn-captioned">${Helpers.captionHTML('cap.copy', 'Copy')}<button type="button" data-op="copy"   class="tool-btn" data-i18n-title-name="font.op.copy" data-i18n-title="font.op.copy.hint" data-i18n-aria-label="font.op.copy" aria-label="${this._t('font.op.copy', 'Copy glyph')}" title="${Helpers.composeTitle(this._t('font.op.copy', 'Copy glyph'), this._t('font.op.copy.hint', 'Copies the current glyph to the internal glyph clipboard'))}"><span class="tool-icon">C</span></button></span>
                        <span class="btn-captioned">${Helpers.captionHTML('cap.paste', 'Paste')}<button type="button" data-op="paste"  class="tool-btn" data-i18n-title-name="font.op.paste" data-i18n-title="font.op.paste.hint" data-i18n-aria-label="font.op.paste" aria-label="${this._t('font.op.paste', 'Paste glyph')}" title="${Helpers.composeTitle(this._t('font.op.paste', 'Paste glyph'), this._t('font.op.paste.hint', 'Overwrites the current glyph with the one last copied'))}"><span class="tool-icon">V</span></button></span>
                        <span class="btn-captioned">${Helpers.captionHTML('cap.invert', 'Invert')}<button type="button" data-op="invert" class="tool-btn" data-i18n-title-name="font.op.invert" data-i18n-title="font.op.invert.hint" data-i18n-aria-label="font.op.invert" aria-label="${this._t('font.op.invert', 'Invert glyph')}" title="${Helpers.composeTitle(this._t('font.op.invert', 'Invert glyph'), this._t('font.op.invert.hint', 'Turns every ink pixel in the glyph into a paper pixel and every paper pixel into ink'))}"><span class="tool-icon">&#9680;</span></button></span>
                    </div>
                    <div class="me-tool-group">
                        <span class="btn-captioned">${Helpers.captionHTML('cap.flipH', 'Flip H')}<button type="button" data-op="flip-h" class="tool-btn" data-i18n-title-name="font.op.flipH" data-i18n-title="font.op.flipH.hint" data-i18n-aria-label="font.op.flipH" aria-label="${this._t('font.op.flipH', 'Flip horizontally')}" title="${Helpers.composeTitle(this._t('font.op.flipH', 'Flip horizontally'), this._t('font.op.flipH.hint', 'Mirrors the glyph left-to-right'))}"><span class="tool-icon">&#8596;</span></button></span>
                        <span class="btn-captioned">${Helpers.captionHTML('cap.flipV', 'Flip V')}<button type="button" data-op="flip-v" class="tool-btn" data-i18n-title-name="font.op.flipV" data-i18n-title="font.op.flipV.hint" data-i18n-aria-label="font.op.flipV" aria-label="${this._t('font.op.flipV', 'Flip vertically')}" title="${Helpers.composeTitle(this._t('font.op.flipV', 'Flip vertically'), this._t('font.op.flipV.hint', 'Mirrors the glyph top-to-bottom'))}"><span class="tool-icon">&#8597;</span></button></span>
                    </div>
                    <div class="me-tool-group">
                        <span class="btn-captioned">${Helpers.captionHTML('cap.left', 'Left')}<button type="button" data-op="shift-left"  class="tool-btn" data-i18n-title-name="font.op.shiftLeft" data-i18n-title="font.op.shiftLeft.hint" data-i18n-aria-label="font.op.shiftLeft" aria-label="${this._t('font.op.shiftLeft', 'Shift left')}" title="${Helpers.composeTitle(this._t('font.op.shiftLeft', 'Shift left'), this._t('font.op.shiftLeft.hint', 'Shifts every row one pixel left, wrapping the edge column around'))}"><span class="tool-icon">&#8592;</span></button></span>
                        <span class="btn-captioned">${Helpers.captionHTML('cap.right', 'Right')}<button type="button" data-op="shift-right" class="tool-btn" data-i18n-title-name="font.op.shiftRight" data-i18n-title="font.op.shiftRight.hint" data-i18n-aria-label="font.op.shiftRight" aria-label="${this._t('font.op.shiftRight', 'Shift right')}" title="${Helpers.composeTitle(this._t('font.op.shiftRight', 'Shift right'), this._t('font.op.shiftRight.hint', 'Shifts every row one pixel right, wrapping the edge column around'))}"><span class="tool-icon">&#8594;</span></button></span>
                        <span class="btn-captioned">${Helpers.captionHTML('cap.up', 'Up')}<button type="button" data-op="shift-up"    class="tool-btn" data-i18n-title-name="font.op.shiftUp" data-i18n-title="font.op.shiftUp.hint" data-i18n-aria-label="font.op.shiftUp" aria-label="${this._t('font.op.shiftUp', 'Shift up')}" title="${Helpers.composeTitle(this._t('font.op.shiftUp', 'Shift up'), this._t('font.op.shiftUp.hint', 'Shifts every column one pixel up, wrapping the top row around'))}"><span class="tool-icon">&#8593;</span></button></span>
                        <span class="btn-captioned">${Helpers.captionHTML('cap.down', 'Down')}<button type="button" data-op="shift-down"  class="tool-btn" data-i18n-title-name="font.op.shiftDown" data-i18n-title="font.op.shiftDown.hint" data-i18n-aria-label="font.op.shiftDown" aria-label="${this._t('font.op.shiftDown', 'Shift down')}" title="${Helpers.composeTitle(this._t('font.op.shiftDown', 'Shift down'), this._t('font.op.shiftDown.hint', 'Shifts every column one pixel down, wrapping the bottom row around'))}"><span class="tool-icon">&#8595;</span></button></span>
                    </div>
                </div>
                <div class="me-toolbar">
                    <button type="button" class="pc-btn fe-rom" data-i18n="font.loadRom">${this._t('font.loadRom', 'Load ROM Font')}</button>
                    <div class="me-tool-group">
                        <label><span data-i18n="font.cellX">${this._t('font.cellX', 'Cell X')}</span>
                            <input type="number" class="fe-cell-x" id="fe-cell-x" name="fe-cell-x" min="0" max="${ZX_SPECTRUM.GRID_COLS - 1}" value="0"></label>
                        <label><span data-i18n="font.cellY">${this._t('font.cellY', 'Cell Y')}</span>
                            <input type="number" class="fe-cell-y" id="fe-cell-y" name="fe-cell-y" min="0" max="${ZX_SPECTRUM.GRID_ROWS - 1}" value="0"></label>
                        <button type="button" class="pc-btn fe-capture" data-i18n="font.capture">${this._t('font.capture', 'Capture Cell')}</button>
                    </div>
                </div>
                <div class="me-toolbar">
                    <input type="text" class="fe-name" id="fe-name" name="fe-name" placeholder="${this._t('font.name', 'Font name...')}" data-i18n-placeholder="font.name">
                    <button type="button" class="pc-btn fe-import" data-i18n="font.import">${this._t('font.import', 'Import...')}</button>
                    <select class="fe-export-format" id="fe-export-format" name="fe-export-format">
                        <option value="ch8">CH8</option>
                        <option value="ch6">CH6</option>
                        <option value="ch4">CH4</option>
                        <option value="chr">CHR</option>
                        <option value="chx">CHX</option>
                        <option value="asm">ASM</option>
                        <option value="c">C</option>
                        <option value="bin">BIN</option>
                    </select>
                    <button type="button" class="pc-btn fe-export" data-i18n="font.export">${this._t('font.export', 'Export')}</button>
                    <input type="file" class="fe-file-input" id="fe-file-input" name="fe-file-input" accept=".ch4,.ch6,.ch8,.chr,.chx" hidden>
                </div>
                <div class="me-toolbar">
                    <button type="button" class="pc-btn fe-new-big" data-i18n="font.newBig">${this._t('font.newBig', 'New Big Font...')}</button>
                    <button type="button" class="pc-btn fe-fill" data-i18n="font.fillFromFont">${this._t('font.fillFromFont', 'Fill from font...')}</button>
                    <button type="button" class="pc-btn fe-undo" data-i18n="font.undo" disabled>${this._t('font.undo', 'Undo')}</button>
                    <button type="button" class="pc-btn fe-redo" data-i18n="font.redo" disabled>${this._t('font.redo', 'Redo')}</button>
                </div>
                <div class="me-toolbar fe-shade-bar">
                    <span class="fe-shade-title" data-i18n="font.shade.title">${this._t('font.shade.title', 'Shading (saved narrower)')}</span>
                    <button type="button" class="pc-btn" data-shade="left-more" data-i18n="font.shade.leftMore">${this._t('font.shade.leftMore', 'Shade left column')}</button>
                    <button type="button" class="pc-btn" data-shade="left-less" data-i18n="font.shade.leftLess">${this._t('font.shade.leftLess', 'Unshade left column')}</button>
                    <button type="button" class="pc-btn" data-shade="right-more" data-i18n="font.shade.rightMore">${this._t('font.shade.rightMore', 'Shade right column')}</button>
                    <button type="button" class="pc-btn" data-shade="right-less" data-i18n="font.shade.rightLess">${this._t('font.shade.rightLess', 'Unshade right column')}</button>
                    <button type="button" class="pc-btn" data-shade="fit" data-i18n="font.shade.fit">${this._t('font.shade.fit', 'Shade all to fit')}</button>
                    <span class="fe-shade-state"></span>
                </div>
                <div class="me-toolbar fe-attr-bar">
                    <span class="fe-attr-state"></span>
                    <button type="button" class="pc-btn fe-attr-all" data-i18n="font.attrs.all">${this._t('font.attrs.all', 'All blocks')}</button>
                    <button type="button" class="pc-btn fe-attr-remove" data-i18n="font.attrs.remove">${this._t('font.attrs.remove', 'Remove attributes')}</button>
                </div>
                <div class="me-toolbar">
                    <button type="button" class="pc-btn fe-system-font font-editor-system-font-btn" data-i18n="font.fromSystemFont">${this._t('font.fromSystemFont', 'From System Font...')}</button>
                </div>
                <div class="fe-status pc-status font-editor-status"></div>
            </div>
        `;

        Dialog.open({
            id: 'font-editor',
            titleI18n: 'font.title',
            title: 'Font Editor',
            content,
            className: 'font-editor-dialog',
            onClose: () => this._onClose()
        });

        this._root = content;
        this._grid = content.querySelector('.fe-glyph-grid');
        this._gridCtx = this._grid.getContext('2d');
        this._statusMsg = content.querySelector('.fe-status');

        // Shared cell editor (canvas height fixed, width follows the font)
        const { w, h } = FontService.getGlyphSize();
        const zoom = this._zoom(w, h);
        this._glyphEditor = new CellGridEditor({
            width: w,
            height: h,
            canvasWidth: w * zoom,
            canvasHeight: h * zoom,
            onChange: () => this._commitGlyphEdit(),
            drawOverlay: (ctx, sx, sy) => { this._paintShade(ctx, sx, sy); this._paintBlockMarks(ctx, sx, sy); },
            onStrokeStart: () => this._strokeStart(),
            getPixelColours: (x, y) => this._blockCss(this._selected, x >> 3, y >> 3),
            onPick: (x, y) => this._attrClick(this._selected, x >> 3, y >> 3),
            className: 'fe-glyph-canvas'
        });
        content.querySelector('.fe-editor-slot').appendChild(this._glyphEditor.element);

        this._attachEvents(content);

        // Undo history (Batch 10C2): the dialog watches the same facts it repaints from, and stores the state before each change
        this._hist = new FontHistory();
        this._cur = FontService.snapshot();
        this._curDirty = false;
        this._restoring = false;
        this._strokeOpen = false;
        this._strokePushed = false;

        // Repaint from facts only
        this._unsubscribes = [
            EventBus.on(EVENTS.FONT_CHANGED, () => { this._recordChange(); this._onFontChanged(); }),
            EventBus.on(EVENTS.FONT_LOADED, () => { this._recordChange(); this._refreshAll(); }),
            EventBus.on(EVENTS.FONT_LIBRARY_CHANGED, () => this._refreshLibrary()),
            EventBus.on(EVENTS.THEME_CHANGED, () => this._redrawGrid())
        ];
    }

    _onClose() {
        this._unsubscribes.forEach(u => u());
        this._unsubscribes = [];
        this._hist = null;
        this._cur = null;
        this._mapView = null;
        this._mapMode = false;
        this._root = null;
        this._glyphEditor = null;
        FontService.persist();
    }

    // ─── Event wiring ─────────────────────────────────────────────────────

    _attachEvents(c) {
        // Glyph grid picker
        this._grid.addEventListener('pointerdown', e => {
            e.preventDefault();
            const rect = this._grid.getBoundingClientRect();
            const col = Math.floor((e.clientX - rect.left) / this.CELL_PX);
            const row = Math.floor((e.clientY - rect.top) / this.CELL_PX);
            const { firstCode, count } = FontService.getCoverage();
            const code = firstCode + row * this.GRID_COLS + col;
            if (col >= 0 && col < this.GRID_COLS && FontService.hasCode(code) &&
                code < firstCode + count) {
                this._selectGlyph(code);
            }
        });

        // Coverage
        c.querySelector('.fe-coverage').addEventListener('change', e => {
            FontService.setCoverage(e.target.value);
        });

        // Glyph mini-editor toolbar
        c.querySelectorAll('button[data-tool]').forEach(btn => {
            btn.addEventListener('click', () => this._setTool(btn.dataset.tool));
        });
        c.querySelector('.fe-map-toggle').addEventListener('click', () => this._setMapMode(!this._mapMode));
        c.querySelector('.fe-zoom-in').addEventListener('click', () => this._mapView && this._mapView.zoomIn());
        c.querySelector('.fe-zoom-out').addEventListener('click', () => this._mapView && this._mapView.zoomOut());
        c.querySelector('.fe-zoom-fit').addEventListener('click', () => this._mapView && this._mapView.fit());
        this._grid.addEventListener('keydown', e => this._navKey(e));

        // Width selector (re-shapes the whole font)
        c.querySelector('.fe-width').addEventListener('change', e => {
            FontService.setWidth(parseInt(e.target.value, 10));
        });

        // Glyph ops
        c.querySelector('.fe-ops').addEventListener('click', e => {
            const btn = e.target.closest('button[data-op]');
            if (btn) this._runOp(btn.dataset.op);
        });

        // ROM + canvas capture
        c.querySelector('.fe-rom').addEventListener('click', () => {
            FontService.resetToROM();
            this._status(this._t('font.status.romLoaded', 'ROM font loaded.'));
        });
        c.querySelector('.fe-capture').addEventListener('click', () => {
            if (FontService.isBig()) {
                this._status(this._t('font.captureNotBig', 'Capture needs an 8x8 font.'));
                return;
            }
            // Glyphs are 8-row 1-bit cells — capture is gated in screen modes
            // with other cell geometry (12a) or indexed pixels (13)
            if (ZX_SPECTRUM.CELL_HEIGHT !== FontService.getGlyphSize().h
                || ZX_SPECTRUM.PIXEL_DEPTH !== 1) {
                this._status(this._t('mode.needs8x8',
                    'This feature needs 8×8 attribute cells - switch to Standard ULA or ULAplus mode first.'));
                return;
            }
            const x = parseInt(c.querySelector('.fe-cell-x').value, 10) || 0;
            const y = parseInt(c.querySelector('.fe-cell-y').value, 10) || 0;
            if (FontService.captureGlyphFromCanvasCell(x, y, this._selected)) {
                this._status(this._t('font.status.captured', 'Canvas cell captured into the glyph.'));
            }
        });

        // Name
        c.querySelector('.fe-name').addEventListener('input', e => FontService.setName(e.target.value));

        // Library
        c.querySelector('.fe-lib-save').addEventListener('click', async () => {
            const name = c.querySelector('.fe-name').value.trim();
            if (!name) { this._status(this._t('font.status.needName', 'Enter a font name first.')); return; }
            FontService.setName(name);
            const ok = await FontService.saveToLibrary(name);
            this._status(ok
                ? this._t('font.status.saved', 'Font saved to the library.')
                : this._t('font.status.libraryFull', 'The font library is full.'));
        });
        c.querySelector('.fe-lib-load').addEventListener('click', () => {
            const name = c.querySelector('.fe-library').value;
            if (!name) { this._status(this._t('font.status.noFont', 'Select a library font first.')); return; }
            if (FontService.loadFromLibrary(name)) {
                this._status(this._t('font.status.loaded', 'Font loaded from the library.'));
            }
        });
        c.querySelector('.fe-lib-delete').addEventListener('click', async () => {
            const name = c.querySelector('.fe-library').value;
            if (!name) { this._status(this._t('font.status.noFont', 'Select a library font first.')); return; }
            const ok = window.confirm(this._t('font.confirmDelete',
                'Delete the font "{name}" from the library?', { name }));
            if (!ok) return;
            if (await FontService.deleteFromLibrary(name)) {
                this._status(this._t('font.status.deleted', 'Font deleted.'));
            }
        });

        // Import / export
        c.querySelector('.fe-import').addEventListener('click',
            () => c.querySelector('.fe-file-input').click());
        c.querySelector('.fe-file-input').addEventListener('change', e => this._importFile(e));
        c.querySelector('.fe-export').addEventListener('click',
            () => this._export(c.querySelector('.fe-export-format').value));

        c.querySelector('.fe-system-font').addEventListener('click', () => this._openSystemFontPicker());
        c.querySelector('.fe-undo').addEventListener('click', () => this._undo());
        c.querySelector('.fe-redo').addEventListener('click', () => this._redo());
        c.querySelector('.fe-shade-bar').addEventListener('click', e => {
            const btn = e.target.closest('button[data-shade]');
            if (btn) this._runShade(btn.dataset.shade);
        });
        c.querySelector('.fe-attr-all').addEventListener('click', () => this._attrWhole(this._selected));
        c.querySelector('.fe-attr-remove').addEventListener('click', () => FontService.clearColours(this._selected));
        c.addEventListener('keydown', e => {
            if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
            if (e.target.closest && e.target.closest('input, textarea, select')) return;
            const key = e.key.toLowerCase();
            if (key === 'z' && !e.shiftKey) { e.preventDefault(); this._undo(); }
            else if (key === 'y' || (key === 'z' && e.shiftKey)) { e.preventDefault(); this._redo(); }
        });
        c.querySelector('.fe-new-big').addEventListener('click', () => this._openFillDialog('new'));
        c.querySelector('.fe-fill').addEventListener('click', () => this._openFillDialog('fill'));
    }

    _runOp(op) {
        const code = this._selected;
        switch (op) {
            case 'clear':       FontService.clearGlyph(code); break;
            case 'copy':
                FontService.copyGlyph(code);
                this._status(this._t('font.status.copied', 'Glyph copied.'));
                return; // no font change
            case 'paste':
                if (!FontService.pasteGlyph(code)) {
                    this._status(this._t('font.status.nothingToPaste', 'Copy a glyph first.'));
                }
                break;
            case 'invert':      FontService.invertGlyph(code); break;
            case 'flip-h':      FontService.flipGlyph(code, 'h'); break;
            case 'flip-v':      FontService.flipGlyph(code, 'v'); break;
            case 'shift-left':  FontService.shiftGlyph(code, 'left'); break;
            case 'shift-right': FontService.shiftGlyph(code, 'right'); break;
            case 'shift-up':    FontService.shiftGlyph(code, 'up'); break;
            case 'shift-down':  FontService.shiftGlyph(code, 'down'); break;
        }
    }

    // ─── Selection / editor sync ──────────────────────────────────────────

    _selectGlyph(code) {
        this._selected = code;
        if (this._mapView) {
            this._mapView.setSelected(code - FontService.firstCode);
            this._mapView.scrollToIndex(code - FontService.firstCode);
        }
        this._syncControls();
        this._redrawGrid();
        this._loadGlyphIntoEditor();
        this._updateCurrentLabel();
    }

    /** Push the selected glyph's bitmap into the cell editor. */
    _loadGlyphIntoEditor() {
        if (!this._glyphEditor) return;
        const glyph = FontService.getGlyph(this._selected);
        const { w, h } = FontService.getGlyphSize();
        const pixels = new Uint8Array(w * h);
        if (glyph) {
            for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                    pixels[y * w + x] = GlyphBits.getPixel(glyph, w, x, y) ? 1 : 0;
                }
            }
        }
        this._suppressGlyphCommit = true;
        this._glyphEditor.setPixels(pixels);
        this._suppressGlyphCommit = false;
    }

    /** Commit the cell editor's bitmap back into the selected glyph. */
    _commitGlyphEdit() {
        if (this._suppressGlyphCommit) return;
        const { w, h } = FontService.getGlyphSize();
        const pixels = this._glyphEditor.getPixels();
        const bytes = GlyphBits.create(w, h);
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                if (pixels[y * w + x]) GlyphBits.setPixel(bytes, w, x, y, true);
            }
        }
        this._commitSource = 'glyph';
        FontService.setGlyph(this._selected, bytes);
        this._commitSource = null;
    }

    /** FONT_CHANGED fact: re-sync everything that shows font state. */
    _onFontChanged() {
        if (!this._root) return;
        this._syncControls();
        this._syncEditorGeometry();
        this._redrawGrid();
        // Reload the editing surfaces unless the change came from them
        if (this._commitSource !== 'glyph') this._loadGlyphIntoEditor();
        if (this._mapMode && this._commitSource !== 'map') this._reloadMap();
    }

    /** Clamp the selection into coverage; sync width/coverage selects. */
    _syncControls() {
        const { firstCode, count } = FontService.getCoverage();
        this._selected = clamp(this._selected, firstCode, firstCode + count - 1);
        const big = FontService.isBig();
        this._root.querySelector('.fe-width').value = String(FontService.width);
        this._root.querySelector('.fe-width-label').hidden = big;
        const sizeLabel = this._root.querySelector('.fe-size-label');
        sizeLabel.hidden = !big;
        sizeLabel.dataset.i18nParamW = FontService.width;
        sizeLabel.dataset.i18nParamH = FontService.height;
        sizeLabel.textContent = this._t('font.sizeLabel', 'Character size {w}x{h}',
            { w: FontService.width, h: FontService.height });
        this._root.querySelector('.fe-coverage').value = count === 96 ? 'ASCII' : 'FULL';
        // Big fonts: only CHX can hold them, canvas capture and the byte-font picker are 8x8 ideas
        const fmt = this._root.querySelector('.fe-export-format');
        for (const opt of fmt.options) opt.disabled = big && opt.value !== 'chx';
        fmt.title = big ? this._t('font.bigOnlyChx', 'Big fonts can only be saved as CHX.') : '';
        if (big && fmt.value !== 'chx') fmt.value = 'chx';
        this._root.querySelector('.fe-capture').disabled = big;
        this._root.querySelector('.fe-system-font').disabled = big;
        this._root.querySelector('.fe-fill').disabled = FontService.width % 8 !== 0;
        // Shading is in whole 8-pixel columns: only for fonts that are a whole number of them wide
        const shadeOk = FontService.width % 8 === 0;
        this._root.querySelectorAll('button[data-shade]').forEach(b => { b.disabled = !shadeOk; });
        // Attributes, as shading, need whole 8-pixel columns; the state says whether this character has its own
        const own = !!FontService.getColours(this._selected);
        this._root.querySelector('.fe-attr-all').disabled = !FontService.coloursAllowed();
        this._root.querySelector('.fe-attr-remove').disabled = !own;
        const attrState = this._root.querySelector('.fe-attr-state');
        const stateKey = own ? 'font.attrs.own' : 'font.attrs.none';
        attrState.dataset.i18n = stateKey;
        attrState.textContent = own ? this._t('font.attrs.own', 'Own attributes')
            : this._t('font.attrs.none', 'No attributes: the Text tool uses the attribute bar');
        const sh = FontService.getShade(this._selected);
        const stateEl = this._root.querySelector('.fe-shade-state');
        stateEl.dataset.i18nParamLeft = sh.left;
        stateEl.dataset.i18nParamRight = sh.right;
        stateEl.textContent = (sh.left || sh.right)
            ? this._t('font.shade.state', 'Shaded: {left} left, {right} right', { left: sh.left, right: sh.right }) : '';
        this._updateCurrentLabel();
    }

    /** Pixels per font pixel in the editing surface: 24 for the classic sizes, less for big glyphs so it fits. @private */
    _zoom(w, h) {
        const big = w > 8 || h > 8;
        return big ? Math.max(6, Math.floor(384 / Math.max(w, h))) : 24;
    }

    /** Resize the cell editor when the font width changed. */
    _syncEditorGeometry() {
        const { w, h } = FontService.getGlyphSize();
        const now = this._glyphEditor.getSize();
        if (now.width === w && now.height === h) return;
        const zoom = this._zoom(w, h);
        this._glyphEditor.setSize(w, h, w * zoom, h * zoom); // resets contents - reloaded below
        this._loadGlyphIntoEditor();
    }

    /**
     * The translated "Code {code}" half lives in its own element carrying
     * `data-i18n-param-code`, so a locale switch mid-edit re-translates it
     * correctly instead of going stale (I18n.apply only re-renders elements
     * it can find and re-parameterise) — the printable-character suffix is
     * not translatable and is a plain sibling this method keeps in sync
     * directly.
     */
    _updateCurrentLabel() {
        const code = this._selected;
        const printable = code >= 33 && code !== 127 ? String.fromCharCode(code) : '';

        const codeEl = this._root.querySelector('.fe-current-code');
        codeEl.dataset.i18nParamCode = code;
        codeEl.textContent = this._t('font.current', 'Code {code}', { code });

        this._root.querySelector('.fe-current-char').textContent = printable ? `  "${printable}"` : '';
    }

    // ─── Glyph grid picker ────────────────────────────────────────────────

    _redrawGrid() {
        if (!this._root) return;
        const { firstCode, count } = FontService.getCoverage();
        const { w: gw, h: gh } = FontService.getGlyphSize();
        const rows = Math.ceil(count / this.GRID_COLS);
        const cs = this.CELL_PX;
        this._grid.width = this.GRID_COLS * cs;
        this._grid.height = rows * cs;

        const ctx = this._gridCtx;
        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = ZX_PALETTE[7];
        ctx.fillRect(0, 0, this._grid.width, this._grid.height);

        // Glyphs at 2x (classic) or scaled to fit the cell (big), centred in their cells; a coloured character in its
        // blocks' own Ink and Paper
        const k = (gw > 8 || gh > 8) ? (cs - 2) / Math.max(gw, gh) : 2;
        for (let i = 0; i < count; i++) {
            const glyph = FontService.getGlyph(firstCode + i);
            if (!glyph) continue;
            const ox = (i % this.GRID_COLS) * cs + (cs - gw * k) / 2;
            const oy = Math.floor(i / this.GRID_COLS) * cs + (cs - gh * k) / 2;
            const coloured = !!FontService.getColours(firstCode + i);
            if (coloured) {
                const bg = FontService.blockGrid();
                for (let by = 0; by < bg.rows; by++) {
                    for (let bx = 0; bx < bg.cols; bx++) {
                        const bw = gw - bx * 8 < 8 ? gw - bx * 8 : 8;     // a 4 or 6 wide font has one narrower block
                        ctx.fillStyle = this._blockCss(firstCode + i, bx, by).paper;
                        ctx.fillRect(ox + bx * 8 * k, oy + by * 8 * k, bw * k, 8 * k);
                    }
                }
            }
            ctx.fillStyle = ZX_PALETTE[0];
            for (let y = 0; y < gh; y++) {
                for (let x = 0; x < gw; x++) {
                    if (!GlyphBits.getPixel(glyph, gw, x, y)) continue;
                    if (coloured) ctx.fillStyle = this._blockCss(firstCode + i, x >> 3, y >> 3).ink;
                    ctx.fillRect(ox + x * k, oy + y * k, k, k);
                }
            }
        }

        // Shaded columns dimmed (a character shaded all the way across is left out of a CHX file)
        if (FontService.hasShading()) {
            const cols = FontService.width >> 3;
            ctx.fillStyle = 'rgba(110,110,110,0.6)';
            for (let i = 0; i < count; i++) {
                const sh = FontService.getShade(firstCode + i);
                if (!sh.left && !sh.right) continue;
                const cx0 = (i % this.GRID_COLS) * cs + (cs - gw * k) / 2;
                const cy0 = Math.floor(i / this.GRID_COLS) * cs + (cs - gh * k) / 2;
                if (sh.left) ctx.fillRect(cx0, cy0, sh.left * 8 * k, gh * k);
                if (sh.right) ctx.fillRect(cx0 + (cols - sh.right) * 8 * k, cy0, sh.right * 8 * k, gh * k);
            }
        }

        // Cell grid
        ctx.strokeStyle = 'rgba(128,128,128,0.4)';
        ctx.lineWidth = 0.5;
        for (let x = 0; x <= this.GRID_COLS; x++) {
            ctx.beginPath(); ctx.moveTo(x * cs, 0); ctx.lineTo(x * cs, rows * cs); ctx.stroke();
        }
        for (let y = 0; y <= rows; y++) {
            ctx.beginPath(); ctx.moveTo(0, y * cs); ctx.lineTo(this.GRID_COLS * cs, y * cs); ctx.stroke();
        }

        // Selection highlight
        const sel = this._selected - firstCode;
        if (sel >= 0 && sel < count) {
            ctx.strokeStyle = ZX_PALETTE[9]; // bright blue
            ctx.lineWidth = 2;
            ctx.strokeRect((sel % this.GRID_COLS) * cs + 1,
                Math.floor(sel / this.GRID_COLS) * cs + 1, cs - 2, cs - 2);
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
                this._status(this._t('font.status.imported', 'Font imported.'));
            } else {
                this._status(this._t('font.status.importFailed', 'Import failed: {error}',
                    { error: (result && result.error) || '?' }));
            }
        } catch (err) {
            this._status(this._t('font.status.importFailed', 'Import failed: {error}',
                { error: err.message }));
        }
    }

    async _export(format) {
        const base = (FontService.name || 'font').replace(/[^\w\- ]+/g, '').trim() || 'font';
        try {
            let saved;
            if (FontFormat.EXTENSIONS.includes(format)) {
                saved = await FontFormat.exportAndDownload(`${base}.${format}`);
            } else {
                const data = DevFormat.generateFont(format, `${base}_font`, FontService.toDocument());
                const mime = format === 'bin' ? 'application/octet-stream' : 'text/plain';
                saved = await FormatRegistry.download(data, `${base}_font.${format}`, mime);
            }
            if (saved !== false) {
                let msg = this._t('font.status.exported', 'Font exported.');
                // Only a .chx holds a character's attributes: say how many the other formats left behind
                const lost = format === 'chx' ? 0 : FontFormat.colouredCount(FontService.toDocument());
                if (lost) msg += ' ' + Helpers.localizedPlural('plural.fontAttrsLost', lost,
                    'one: {n} character lost its attributes (only CHX keeps them) | other: {n} characters lost their attributes (only CHX keeps them)');
                if (format === 'chx') {
                    const sum = FontFormat.chxSummary(FontService.toDocument());
                    const part = (key, n, fallback) => (n ? ' ' + Helpers.localizedPlural(key, n, fallback) : '');
                    msg += part('plural.fontNarrowed', sum.narrowed, 'one: {n} character saved narrower | other: {n} characters saved narrower') +
                        part('plural.fontLeftOut', sum.leftOut, 'one: {n} character left out | other: {n} characters left out') +
                        part('plural.fontHiddenInk', sum.hiddenInk,
                            'one: {n} character has ink pixels under the shading that were not saved | other: {n} characters have ink pixels under the shading that were not saved');
                }
                this._status(msg, Math.max(3000, (msg.split(/\s+/).length / 5 + 1) * 1000)); // [P] about 5 words a second + 1 s to notice it
            }
        } catch (err) {
            this._status(err.message);
        }
    }

    // ─── System font ────────────────────────────────────────────────────

    /**
     * File > Font Editor... > From System Font... — pick one of the real
     * OS fonts `queryLocalFonts()` enumerates and rasterize it into the
     * working font's glyph coverage. All outline-to-bitmap conversion runs
     * client-side in FontRasterizer (Canvas 2D).
     *
     * Unlike the text tool's font-FAMILY list (TextTool._enumerateFonts,
     * always FontProbe.detect() - see its own comment for why
     * queryLocalFonts() was dropped there), this is a deliberate, explicit
     * click on a button whose only job is "get me a real system font's
     * bytes" - the permission prompt it raises is the expected cost of that
     * action, not a surprise sitting behind an ordinary reload. FontProbe
     * cannot substitute here regardless: it detects family NAMES by
     * measurement, never font bytes, and rasterizing needs the bytes.
     * @private
     */
    async _openSystemFontPicker() {
        if (typeof window.queryLocalFonts !== 'function') {
            this._status(this._t('font.systemFontUnsupported',
                'This browser cannot list installed fonts.'));
            return;
        }

        let fonts;
        try {
            fonts = await window.queryLocalFonts();
        } catch (error) {
            Logger.warn('FontEditorDialog', 'queryLocalFonts failed', error);
            this._status(error.message);
            return;
        }

        const select = document.createElement('select');
        select.className = 'font-editor-system-font-select';
        for (const f of fonts) {
            const opt = document.createElement('option');
            opt.value = f.postscriptName;
            opt.textContent = `${f.family} (${f.style})`;
            select.appendChild(opt);
        }

        const sizeInput = document.createElement('input');
        sizeInput.type = 'number';
        sizeInput.className = 'font-editor-system-font-size';
        sizeInput.value = '12';
        sizeInput.min = '4';
        sizeInput.max = '96';
        sizeInput.setAttribute('aria-label', this._t('font.pointSize', 'Point size'));
        sizeInput.title = this._t('font.pointSize', 'Point size');

        const widthSelect = document.createElement('select');
        widthSelect.className = 'font-editor-system-font-width';
        widthSelect.setAttribute('aria-label', this._t('font.width', 'Width'));
        for (const w of FontService.WIDTHS) {
            const opt = document.createElement('option');
            opt.value = String(w);
            opt.textContent = `${w}×8`;
            widthSelect.appendChild(opt);
        }
        widthSelect.value = String(FontService.width);

        const generateBtn = document.createElement('button');
        generateBtn.type = 'button';
        generateBtn.className = 'panel-button font-editor-system-font-generate';
        generateBtn.dataset.i18n = 'font.generate';
        generateBtn.textContent = this._t('font.generate', 'Generate');
        generateBtn.addEventListener('click', async () => {
            const chosen = fonts.find((f) => f.postscriptName === select.value);
            if (!chosen) {
                this._status(this._t('font.status.noFont', 'Select a library font first.'));
                return;
            }
            const pointSize = parseInt(sizeInput.value, 10) || 12;
            const cellWidth = parseInt(widthSelect.value, 10);

            try {
                const blob = await chosen.blob();
                const bytes = await blob.arrayBuffer();
                const coverage = FontService.getCoverage();
                const glyphs = await FontRasterizer.rasterize(bytes, {
                    pointSize, cellWidth,
                    firstCode: coverage.firstCode, count: coverage.count
                });
                // Apply the width only once rasterization has actually produced
                // glyphs to match it - setWidth() is destructive (crops existing
                // glyphs to the new width), so doing it first left a mismatched,
                // half-cropped font behind whenever rasterize() threw.
                FontService.setWidth(cellWidth);
                glyphs.forEach((bytesRow, i) => FontService.setGlyph(coverage.firstCode + i, bytesRow));
                Dialog.close('font-editor-system-font');
                this._status(this._t('font.systemFontGenerated', 'Generated from {family}',
                    { family: chosen.family }));
            } catch (error) {
                Logger.warn('FontEditorDialog', 'System font generation failed', error);
                this._status(error.message);
            }
        });

        const wrap = document.createElement('div');
        wrap.className = 'fe-system-font-picker fe-row';
        wrap.append(select, sizeInput, widthSelect, generateBtn);

        Dialog.open({
            id: 'font-editor-system-font',
            titleI18n: 'font.chooseSystemFont',
            title: 'Choose System Font',
            content: wrap
        });
    }

    // ─── New big font / fill from a font ─────────────────────────────────

    /**
     * New Big Font... ('new') asks for the character size (blocks of 8 x 8 pixels, 1 to 4 each way), the charset and
     * optionally a font to fill from; Fill from font... ('fill') fills the working font, whatever its size, from an installed
     * font. The font list is the Text tool's (FontProbe), so the choice is the same in both places and needs no permission.
     * The picture of each letter is made by FontRasterizer.rasterizeCells.
     * @param {string} mode - 'new' | 'fill'
     * @private
     */
    _openFillDialog(mode) {
        const isNew = mode === 'new';
        const wrap = document.createElement('div');
        wrap.className = 'fe-fill-dialog';
        const field = (key, fallback, control) => {
            const label = document.createElement('label');
            label.className = 'fe-fill-field';
            const span = document.createElement('span');
            span.dataset.i18n = key;
            span.textContent = this._t(key, fallback);
            label.append(span, control);
            return label;
        };
        const select = (id, options) => {
            const el = document.createElement('select');
            el.id = id;
            el.name = id;
            for (const [value, text, i18n] of options) {
                const opt = document.createElement('option');
                opt.value = String(value);
                opt.textContent = text;
                if (i18n) opt.dataset.i18n = i18n;
                el.appendChild(opt);
            }
            return el;
        };
        const sizes = [1, 2, 3, 4].map(n => [n, `${n * 8} px`]);

        let colsEl, rowsEl, covEl, withFont;
        if (isNew) {
            colsEl = select('fe-new-cols', sizes);
            rowsEl = select('fe-new-rows', sizes);
            covEl = select('fe-new-cov', [
                ['ASCII', this._t('font.coverageAscii', '96 chars (32-127)'), 'font.coverageAscii'],
                ['FULL', this._t('font.coverageFull', '256 chars (0-255)'), 'font.coverageFull']]);
            withFont = document.createElement('input');
            withFont.type = 'checkbox';
            withFont.id = 'fe-new-fill';
            withFont.name = 'fe-new-fill';
            withFont.checked = true;
            wrap.append(
                field('font.bigWidth', 'Character width', colsEl),
                field('font.bigHeight', 'Character height', rowsEl),
                field('font.coverage', 'Charset', covEl),
                field('font.fillWith', 'Fill with a font', withFont));
        }

        const fonts = (window.FontProbe ? FontProbe.detect() : []);
        const families = fonts.length ? fonts : ['sans-serif', 'serif', 'monospace'];
        const famEl = select('fe-fill-family', families.map(f => [f, f]));
        // Not the alphabetically first font (often a condensed display face): a plain, common one if the machine has it
        const plain = ['Arial', 'Segoe UI', 'Verdana', 'Tahoma', 'Helvetica', 'DejaVu Sans', 'Liberation Sans'].find(f => families.includes(f));
        if (plain) famEl.value = plain;
        const pctEl = document.createElement('input');
        pctEl.type = 'number';
        pctEl.id = 'fe-fill-percent';
        pctEl.name = 'fe-fill-percent';
        pctEl.min = '10'; pctEl.max = '100'; pctEl.value = '100';
        const alignEl = select('fe-fill-align', [
            ['left', this._t('font.alignLeft', 'Left'), 'font.alignLeft'],
            ['centre', this._t('font.alignCentre', 'Centre'), 'font.alignCentre'],
            ['right', this._t('font.alignRight', 'Right'), 'font.alignRight']]);
        const propEl = document.createElement('input');
        propEl.type = 'checkbox';
        propEl.id = 'fe-fill-proportional';
        propEl.name = 'fe-fill-proportional';
        wrap.append(
            field('font.fillFont', 'Font', famEl),
            field('font.fillPercent', 'Height (%)', pctEl),
            field('font.fillAlign', 'Alignment', alignEl),
            field('font.fillProportional', 'Proportional (narrower letters)', propEl));

        const go = document.createElement('button');
        go.type = 'button';
        go.id = 'fe-fill-go';
        go.className = 'panel-button primary';
        go.dataset.i18n = isNew ? 'font.create' : 'font.fill';
        go.textContent = isNew ? this._t('font.create', 'Create') : this._t('font.fill', 'Fill');
        go.addEventListener('click', async () => {
            if (isNew) {
                const made = FontService.newBigFont({
                    cols: parseInt(colsEl.value, 10), rows: parseInt(rowsEl.value, 10), coverage: covEl.value });
                if (!made) return;
                this._status(this._t('font.status.bigCreated', 'New big font {w}x{h} created.',
                    { w: FontService.width, h: FontService.height }));
                if (!withFont.checked) { Dialog.close('font-editor-fill'); return; }
            }
            go.disabled = true;
            const ok = await this._fillFromFont(famEl.value, Number(pctEl.value), alignEl.value, propEl.checked);
            go.disabled = false;
            if (ok) Dialog.close('font-editor-fill');
        });
        wrap.appendChild(go);

        Dialog.open({
            id: 'font-editor-fill',
            titleI18n: isNew ? 'font.newBigTitle' : 'font.fillTitle',
            title: isNew ? 'New Big Font' : 'Fill from Font',
            content: wrap
        });
    }

    /**
     * Rasterize an installed font into every glyph of the working font (one change, so the editor repaints once).
     * @returns {Promise<boolean>}
     * @private
     */
    async _fillFromFont(family, percent, align, proportional) {
        const { w, h } = FontService.getGlyphSize();
        const cov = FontService.getCoverage();
        try {
            const r = await FontRasterizer.rasterizeCells({ family }, {
                cellWidth: w, cellHeight: h, heightPercent: percent, align,
                firstCode: cov.firstCode, count: cov.count, proportional });
            const shade = r.shade || r.glyphs.map(() => [0, 0]);
            if (!FontService.replaceGlyphs(r.glyphs, shade)) throw new Error('replaceGlyphs');
            this._status(this._t('font.status.filled', 'Filled from {family}.', { family }));
            return true;
        } catch (error) {
            Logger.warn('FontEditorDialog', 'Fill from font failed', error);
            this._status(this._t('font.status.fillFailed', 'Could not fill from the font: {error}', { error: error.message }));
            return false;
        }
    }

    // ─── All-characters map ───────────────────────────────────────────────

    /** The mini tool changed: the active surface uses it if it can. @private */
    _setTool(tool) {
        this._tool = tool;
        this._applyTool();
    }

    _applyTool() {
        const mapOnly = this._tool === 'shade' || this._tool === 'move';
        const shown = this._mapMode || !mapOnly ? this._tool : 'brush';   // the one-character editor has no map-only tools
        if (this._mapMode) this._mapView.setTool(shown);
        else this._glyphEditor.setTool(shown === 'attrs' ? 'pick' : shown);   // Attributes draws nothing: it picks a block
        this._root.querySelectorAll('button[data-tool]').forEach(b => b.classList.toggle('active', b.dataset.tool === shown));
    }

    /** Switch between the one-character editor and the whole-font map. @private */
    _setMapMode(on) {
        if (on === this._mapMode || !this._root) return;
        this._mapMode = on;
        const root = this._root;
        const slot = root.querySelector('.fe-editor-slot');
        root.querySelector('.fe-map-toggle').setAttribute('aria-pressed', String(on));
        root.querySelector('.fe-map-tools').hidden = !on;
        const dlg = root.closest('.font-editor-dialog');
        if (dlg) dlg.classList.toggle('fe-wide', on);
        if (on) {
            if (!this._mapView) {
                this._mapView = new FontMapView({
                    onSelect: index => this._selectGlyph(FontService.firstCode + index),
                    onCommit: (touched, map) => this._commitMap(touched, map),
                    onShade: (index, col8) => this._shadeClick(FontService.firstCode + index, col8),
                    getShade: index => FontService.getShade(FontService.firstCode + index),
                    getColours: (index, bx, by) => this._blockRgb(FontService.firstCode + index, bx, by),
                    onAttrs: (index, bx, by) => this._attrClick(FontService.firstCode + index, bx, by)
                });
                this._mapView.element.setAttribute('aria-label', this._t('font.mapLabel', 'All characters: arrow keys or a typed character choose one'));
                this._mapView.element.addEventListener('keydown', e => this._navKey(e));
            }
            slot.replaceChildren(this._mapView.element);
            this._reloadMap();
            this._applyTool();
            requestAnimationFrame(() => { if (this._mapView) { this._mapView.fit(); this._mapView.scrollToIndex(this._selected - FontService.firstCode); } });
        } else {
            slot.replaceChildren(this._glyphEditor.element);
            this._loadGlyphIntoEditor();
            this._applyTool();
        }
    }

    _reloadMap() {
        if (!this._mapView) return;
        const { w, h } = FontService.getGlyphSize();
        this._mapView.setData(FontService.glyphs, w, h);
        this._mapView.setSelected(this._selected - FontService.firstCode);
    }

    /** A stroke on the map ended: write the touched characters back in ONE change (one undo step). @private */
    _commitMap(touched, map) {
        const { w, h } = FontService.getGlyphSize();
        const next = FontMap.decompose(map, FontService.glyphs, w, h, touched);
        this._commitSource = 'map';
        FontService.replaceGlyphs(next);
        this._commitSource = null;
        this._redrawGrid();
    }

    _shadeClick(code, col8) {
        if (FontService.width % 8 !== 0) {
            this._status(this._t('font.status.shadeNeeds8', 'Shading needs a font whose width is a whole number of 8-pixel columns.'));
            return;
        }
        const cols = FontService.width >> 3;
        const cur = FontService.getShade(code);
        const next = GlyphBits.shadeAfterClick([cur.left, cur.right], cols, col8);
        if (next[0] === cur.left && next[1] === cur.right) return;
        if (!FontService.setShade(code, next[0], next[1])) {
            this._status(this._t('font.status.spaceKeepsColumn', 'Space must keep at least one column.'));
        }
    }

    /** Arrow keys, Home / End and a typed character choose a character (picker and map). @private */
    _navKey(e) {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        const { firstCode, count } = FontService.getCoverage();
        let code = this._selected;
        switch (e.key) {
            case 'ArrowLeft': code -= 1; break;
            case 'ArrowRight': code += 1; break;
            case 'ArrowUp': code -= this.GRID_COLS; break;
            case 'ArrowDown': code += this.GRID_COLS; break;
            case 'Home': code = firstCode; break;
            case 'End': code = firstCode + count - 1; break;
            default:
                if (e.key.length === 1) code = e.key.charCodeAt(0);
                else return;
        }
        e.preventDefault();
        if (FontService.hasCode(code)) this._selectGlyph(code);
    }

    // ─── Undo / redo ──────────────────────────────────────────────────────

    /** A stroke in the editing surface begins: all its changes are one undo step. @private */
    _strokeStart() {
        this._strokeOpen = true;
        this._strokePushed = false;
        const end = () => {
            window.removeEventListener('pointerup', end, true);
            window.removeEventListener('pointercancel', end, true);
            this._strokeOpen = false;
            if (this._curDirty && this._hist) { this._cur = FontService.snapshot(); this._curDirty = false; }
            this._syncHistoryButtons();
        };
        window.addEventListener('pointerup', end, true);
        window.addEventListener('pointercancel', end, true);
    }

    /** A FONT_* fact arrived: remember the state before it, unless it is the result of undo / redo or another move of the same stroke. @private */
    _recordChange() {
        if (!this._hist) return;
        if (this._restoring) { this._cur = FontService.snapshot(); this._curDirty = false; return; }
        if (this._strokeOpen && this._strokePushed) { this._curDirty = true; return; }
        this._hist.push(this._cur);
        if (this._strokeOpen) this._strokePushed = true;
        this._cur = FontService.snapshot();
        this._curDirty = false;
        this._syncHistoryButtons();
    }

    _syncHistoryButtons() {
        if (!this._root || !this._hist) return;
        this._root.querySelector('.fe-undo').disabled = !this._hist.canUndo();
        this._root.querySelector('.fe-redo').disabled = !this._hist.canRedo();
    }

    _stepHistory(redo) {
        if (!this._hist || this._strokeOpen) return;
        const now = FontService.snapshot();
        const target = redo ? this._hist.redo(now) : this._hist.undo(now);
        if (!target) {
            this._status(this._t(redo ? 'font.status.nothingToRedo' : 'font.status.nothingToUndo',
                redo ? 'Nothing to redo.' : 'Nothing to undo.'));
            return;
        }
        this._restoring = true;
        FontService.restore(target);
        this._restoring = false;
        this._syncHistoryButtons();
        this._status(this._t(redo ? 'font.status.redone' : 'font.status.undone', redo ? 'Redone.' : 'Undone.'));
    }

    _undo() { this._stepHistory(false); }
    _redo() { this._stepHistory(true); }

    // ─── Shading ──────────────────────────────────────────────────────────

    /** Hatch the shaded columns of the selected glyph over the editing surface (CellGridEditor overlay hook). @private */
    _paintShade(ctx, sx, sy) {
        const sh = FontService.getShade(this._selected);
        if (!sh.left && !sh.right) return;
        const { w, h } = FontService.getGlyphSize();
        const cols = w >> 3;
        const bands = [];
        if (sh.left) bands.push([0, sh.left * 8]);
        if (sh.right) bands.push([(cols - sh.right) * 8, sh.right * 8]);
        for (const [x0, bw] of bands) {
            const px = x0 * sx, pw = bw * sx, ph = h * sy;
            ctx.save();
            ctx.beginPath();
            ctx.rect(px, 0, pw, ph);
            ctx.clip();
            ctx.fillStyle = 'rgba(110,110,110,0.55)';
            ctx.fillRect(px, 0, pw, ph);
            ctx.strokeStyle = 'rgba(40,40,40,0.55)';
            ctx.lineWidth = 1;
            for (let d = -ph; d < pw; d += 8) {
                ctx.beginPath();
                ctx.moveTo(px + d, ph);
                ctx.lineTo(px + d + ph, 0);
                ctx.stroke();
            }
            ctx.restore();
        }
    }

    _runShade(what) {
        if (what === 'fit') { this._shadeToFit(); return; }
        const code = this._selected;
        const cols = FontService.width >> 3;
        const sh = FontService.getShade(code);
        const [side, dir] = what.split('-');
        const next = GlyphBits.shadeStep([sh.left, sh.right], cols, side, dir === 'more' ? 1 : -1);
        if (!next) {
            this._status(this._t('font.status.shadeLimit', 'There are no more columns to shade or unshade there.'));
            return;
        }
        if (!FontService.setShade(code, next[0], next[1])) {
            this._status(this._t('font.status.spaceKeepsColumn', 'Space must keep at least one column.'));
        }
    }

    /**
     * Shade every character to fit its dots (whole empty 8-pixel columns on each side); a blank Space keeps one column and any other
     * blank character is left out. One change, so one undo step and one repaint.
     * @private
     */
    _shadeToFit() {
        const { w, h } = FontService.getGlyphSize();
        const cols = w >> 3;
        const cov = FontService.getCoverage();
        const shade = [];
        for (let i = 0; i < cov.count; i++) {
            const code = cov.firstCode + i;
            const edges = GlyphBits.inkEdges(FontService.getGlyph(code), w, h);
            if (edges) shade.push(GlyphBits.autoShade(edges, 0, w, 'left'));
            else shade.push(code === 32 ? [0, cols - 1] : [0, cols]);
        }
        if (FontService.replaceGlyphs(FontService.glyphs.map(g => Uint8Array.from(g)), shade)) {
            this._status(this._t('font.status.shadeFitted', 'Every character shaded to fit.'));
        }
    }

    // --- Attributes of coloured characters (CHX) --------------------------

    /**
     * The attribute bar's Ink, Paper, Bright and Flash laid onto a block's byte (screen A's in GigaScreen): a part on use
     * existing keeps the block's own. @private
     */
    _barAttr(cur) {
        return GlyphBits.attrOnto(ColorManager.getCurrentSelection(), cur);
    }

    /** Why the bar's attributes cannot be given to a character now, as a message, or null. @private */
    _attrRefusal() {
        if (!FontService.coloursAllowed()) {
            return this._t('font.status.attrsNeed8', 'Attributes need a font whose width is a whole number of 8-pixel columns.');
        }
        if (!(window.ColorManager && ColorManager.hasCellAttributes())) {
            return this._t('font.status.attrsNoBar', 'The attribute bar has no Ink, Paper, Bright and Flash in this screen mode.');
        }
        return null;
    }

    /** Attributes tool: one block gets the bar's attributes (the first one on an uncoloured character, every block). @private */
    _attrClick(code, bx, by) {
        const refused = this._attrRefusal();
        if (refused) { this._status(refused); return; }
        const was = FontService.getColours(code);
        const g = FontService.blockGrid();
        const ok = was
            ? FontService.setBlockAttr(code, bx, by, this._barAttr(was[by * g.cols + bx]))
            : FontService.setAllBlocks(code, this._barAttr());
        if (!ok) return;
        if (!was && g.cols * g.rows > 1) {
            const msg = this._t('font.status.attrsWhole',
                'A CHX file gives a whole character attributes, so every block now has these. Click a block to change just that one.');
            this._status(msg, Math.max(3000, (msg.split(/\s+/).length / 5 + 1) * 1000)); // [P] about 5 words a second + 1 s to notice it
        }
    }

    /** All blocks: every block the bar's attributes (each keeping its own where the bar is on use existing). @private */
    _attrWhole(code) {
        const refused = this._attrRefusal();
        if (refused) { this._status(refused); return; }
        const cur = FontService.getColours(code);
        if (!cur) { FontService.setAllBlocks(code, this._barAttr()); return; }
        const next = Array.from(cur, a => this._barAttr(a));
        if (next.some((a, i) => a !== cur[i])) FontService.setColoursFor(code, next);
    }

    /** A coloured character's block as CSS colours ({ink, paper}, Bright picking the bright pair), or null. @private */
    _blockCss(code, bx, by) {
        const a = this._blockAttr(code, bx, by);
        if (a === null) return null;
        const b = a & 0x40 ? 8 : 0;
        return { ink: ZX_PALETTE[(a & 7) + b], paper: ZX_PALETTE[((a >> 3) & 7) + b] };
    }

    /** The same as RGB arrays (the All characters map). @private */
    _blockRgb(code, bx, by) {
        const a = this._blockAttr(code, bx, by);
        if (a === null) return null;
        const b = a & 0x40 ? 8 : 0;
        return { ink: ZX_PALETTE_RGB[(a & 7) + b], paper: ZX_PALETTE_RGB[((a >> 3) & 7) + b] };
    }

    /** @private */
    _blockAttr(code, bx, by) {
        const c = FontService.getColours(code);
        if (!c) return null;
        const g = FontService.blockGrid();
        const i = by * g.cols + bx;
        return bx < g.cols && by < g.rows && i < c.length ? c[i] : null;
    }

    /**
     * Over the one-character editor: the 8x8 block lines of a big font (what the Attributes tool picks) and a corner mark on
     * a flashing block (the editor shows Ink and Paper still). @private
     */
    _paintBlockMarks(ctx, sx, sy) {
        const { w, h } = FontService.getGlyphSize();
        if (w > 8 || h > 8) {
            ctx.save();
            ctx.strokeStyle = 'rgba(80,80,80,0.8)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            for (let x = 8; x < w; x += 8) { ctx.moveTo(x * sx, 0); ctx.lineTo(x * sx, h * sy); }
            for (let y = 8; y < h; y += 8) { ctx.moveTo(0, y * sy); ctx.lineTo(w * sx, y * sy); }
            ctx.stroke();
            ctx.restore();
        }
        const c = FontService.getColours(this._selected);
        if (!c) return;
        const g = FontService.blockGrid();
        for (let by = 0; by < g.rows; by++) {
            for (let bx = 0; bx < g.cols; bx++) {
                if (!(c[by * g.cols + bx] & 0x80)) continue;
                const x1 = (bx * 8 + 8) * sx, y0 = by * 8 * sy, m = 2 * sx;
                ctx.save();
                ctx.fillStyle = 'rgba(255,255,255,0.9)';
                ctx.strokeStyle = 'rgba(0,0,0,0.9)';
                ctx.beginPath();
                ctx.moveTo(x1 - m, y0); ctx.lineTo(x1, y0); ctx.lineTo(x1, y0 + m); ctx.closePath();
                ctx.fill(); ctx.stroke();
                ctx.restore();
            }
        }
    }

    // ─── Shared refresh / status ──────────────────────────────────────────

    _refreshLibrary() {
        if (!this._root) return;
        const list = this._root.querySelector('.fe-library');
        const previous = list.value;
        list.textContent = '';
        for (const name of FontService.listLibrary()) {
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;
            list.appendChild(opt);
        }
        if (previous) list.value = previous;
    }

    _refreshAll() {
        if (!this._root) return;
        this._root.querySelector('.fe-name').value = FontService.name;
        this._syncControls();
        this._syncEditorGeometry();
        this._refreshLibrary();
        this._redrawGrid();
        this._loadGlyphIntoEditor();
        if (this._mapMode) this._reloadMap();
    }

    /*
     * Status-line dwell. [P] Comfortable silent reading runs about 5 words
     * a second (Rayner 1998, widely reproduced). [C] These messages are
     * short - "Font imported." is 2 words, the longest here about 8 - so
     * reading costs under 2 s; 3 s leaves roughly a second to NOTICE the
     * line appear before starting to read it. Short enough that a stale
     * message never outlives the action that caused it.
     */
    _status(msg, ms = 3000) {
        if (!this._statusMsg) return;
        this._statusMsg.textContent = msg;
        clearTimeout(this._statusTimeout);
        this._statusTimeout = setTimeout(() => {
            if (this._statusMsg) this._statusMsg.textContent = '';
        }, ms);
    }
}

window.FontEditorDialog = new FontEditorDialogClass();

Logger.debug('FontEditorDialog', 'Font editor dialog loaded');

})(); // End IIFE
