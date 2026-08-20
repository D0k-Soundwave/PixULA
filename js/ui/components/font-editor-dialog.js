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
 *   right — the glyph editing surface: the shared CellGridEditor (third
 *           consumer, after the Pattern Creator and the map editor —
 *           this is the width ≠ height case it was built for), the
 *           glyph-ops toolbar (clear/copy/paste/flip/shift/invert), the
 *           width selector (4/6/8), load-from-ROM, capture-from-canvas
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
        this._editorCommit = false;    // true while the cell editor writes back
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
                <canvas class="fe-glyph-grid"></canvas>
                <div class="fe-row">
                    <label><span data-i18n="font.coverage">${this._t('font.coverage', 'Charset')}</span>
                        <select class="fe-coverage">
                            <option value="ASCII" data-i18n="font.coverageAscii">${this._t('font.coverageAscii', '96 chars (32–127)')}</option>
                            <option value="FULL" data-i18n="font.coverageFull">${this._t('font.coverageFull', '256 chars (0–255)')}</option>
                        </select></label>
                </div>
                <div class="me-section-title" data-i18n="font.library">${this._t('font.library', 'Font Library')}</div>
                <select class="fe-library" size="5"></select>
                <div class="fe-row">
                    <button type="button" class="pc-btn fe-lib-save" data-i18n="font.save">${this._t('font.save', 'Save')}</button>
                    <button type="button" class="pc-btn fe-lib-load" data-i18n="font.load">${this._t('font.load', 'Load')}</button>
                    <button type="button" class="pc-btn fe-lib-delete" data-i18n="font.delete">${this._t('font.delete', 'Delete')}</button>
                </div>
            </div>
            <div class="fe-center">
                <div class="me-toolbar">
                    <div class="me-tool-group">
                        ${Helpers.miniToolButton('brush', 'B', 'tool.brush', 'Brush', 'miniTool.brush.hint', 'Click or drag to set pixels', true)}
                        ${Helpers.miniToolButton('eraser', 'E', 'tool.eraser', 'Eraser', 'tool.eraser.hint', 'Clear pixels back to the paper colour')}
                        ${Helpers.miniToolButton('line', 'S', 'shape.line', 'Line', 'miniTool.line.hint', 'Drag to draw a straight line between two points')}
                        ${Helpers.miniToolButton('fill', 'F', 'tool.fill', 'Fill', 'tool.fill.hint', 'Flood the area under the cursor out to its edges')}
                    </div>
                    <div class="me-tool-group">
                        <label><span data-i18n="font.width">${this._t('font.width', 'Width')}</span>
                            <select class="fe-width">
                                <option value="4">4×8</option>
                                <option value="6">6×8</option>
                                <option value="8">8×8</option>
                            </select></label>
                    </div>
                    <span class="fe-current"></span>
                </div>
                <div class="fe-editor-slot"></div>
                <div class="me-toolbar fe-ops">
                    <div class="me-tool-group">
                        <span class="btn-captioned">${Helpers.captionHTML('cap.clear', 'Clear')}<button type="button" data-op="clear"  class="tool-btn" data-i18n-title-name="font.op.clear" data-i18n-aria-label="font.op.clear" aria-label="${this._t('font.op.clear', 'Clear glyph')}" title="${this._t('font.op.clear', 'Clear glyph')}"><span class="tool-icon">&#8709;</span></button></span>
                        <span class="btn-captioned">${Helpers.captionHTML('cap.copy', 'Copy')}<button type="button" data-op="copy"   class="tool-btn" data-i18n-title-name="font.op.copy" data-i18n-aria-label="font.op.copy" aria-label="${this._t('font.op.copy', 'Copy glyph')}" title="${this._t('font.op.copy', 'Copy glyph')}"><span class="tool-icon">C</span></button></span>
                        <span class="btn-captioned">${Helpers.captionHTML('cap.paste', 'Paste')}<button type="button" data-op="paste"  class="tool-btn" data-i18n-title-name="font.op.paste" data-i18n-aria-label="font.op.paste" aria-label="${this._t('font.op.paste', 'Paste glyph')}" title="${this._t('font.op.paste', 'Paste glyph')}"><span class="tool-icon">V</span></button></span>
                        <span class="btn-captioned">${Helpers.captionHTML('cap.invert', 'Invert')}<button type="button" data-op="invert" class="tool-btn" data-i18n-title-name="font.op.invert" data-i18n-aria-label="font.op.invert" aria-label="${this._t('font.op.invert', 'Invert glyph')}" title="${this._t('font.op.invert', 'Invert glyph')}"><span class="tool-icon">&#9680;</span></button></span>
                    </div>
                    <div class="me-tool-group">
                        <span class="btn-captioned">${Helpers.captionHTML('cap.flipH', 'Flip H')}<button type="button" data-op="flip-h" class="tool-btn" data-i18n-title-name="font.op.flipH" data-i18n-aria-label="font.op.flipH" aria-label="${this._t('font.op.flipH', 'Flip horizontally')}" title="${this._t('font.op.flipH', 'Flip horizontally')}"><span class="tool-icon">&#8596;</span></button></span>
                        <span class="btn-captioned">${Helpers.captionHTML('cap.flipV', 'Flip V')}<button type="button" data-op="flip-v" class="tool-btn" data-i18n-title-name="font.op.flipV" data-i18n-aria-label="font.op.flipV" aria-label="${this._t('font.op.flipV', 'Flip vertically')}" title="${this._t('font.op.flipV', 'Flip vertically')}"><span class="tool-icon">&#8597;</span></button></span>
                    </div>
                    <div class="me-tool-group">
                        <span class="btn-captioned">${Helpers.captionHTML('cap.left', 'Left')}<button type="button" data-op="shift-left"  class="tool-btn" data-i18n-title-name="font.op.shiftLeft" data-i18n-aria-label="font.op.shiftLeft" aria-label="${this._t('font.op.shiftLeft', 'Shift left')}" title="${this._t('font.op.shiftLeft', 'Shift left')}"><span class="tool-icon">&#8592;</span></button></span>
                        <span class="btn-captioned">${Helpers.captionHTML('cap.right', 'Right')}<button type="button" data-op="shift-right" class="tool-btn" data-i18n-title-name="font.op.shiftRight" data-i18n-aria-label="font.op.shiftRight" aria-label="${this._t('font.op.shiftRight', 'Shift right')}" title="${this._t('font.op.shiftRight', 'Shift right')}"><span class="tool-icon">&#8594;</span></button></span>
                        <span class="btn-captioned">${Helpers.captionHTML('cap.up', 'Up')}<button type="button" data-op="shift-up"    class="tool-btn" data-i18n-title-name="font.op.shiftUp" data-i18n-aria-label="font.op.shiftUp" aria-label="${this._t('font.op.shiftUp', 'Shift up')}" title="${this._t('font.op.shiftUp', 'Shift up')}"><span class="tool-icon">&#8593;</span></button></span>
                        <span class="btn-captioned">${Helpers.captionHTML('cap.down', 'Down')}<button type="button" data-op="shift-down"  class="tool-btn" data-i18n-title-name="font.op.shiftDown" data-i18n-aria-label="font.op.shiftDown" aria-label="${this._t('font.op.shiftDown', 'Shift down')}" title="${this._t('font.op.shiftDown', 'Shift down')}"><span class="tool-icon">&#8595;</span></button></span>
                    </div>
                </div>
                <div class="me-toolbar">
                    <button type="button" class="pc-btn fe-rom" data-i18n="font.loadRom">${this._t('font.loadRom', 'Load ROM Font')}</button>
                    <div class="me-tool-group">
                        <label><span data-i18n="font.cellX">${this._t('font.cellX', 'Cell X')}</span>
                            <input type="number" class="fe-cell-x" min="0" max="${ZX_SPECTRUM.GRID_COLS - 1}" value="0"></label>
                        <label><span data-i18n="font.cellY">${this._t('font.cellY', 'Cell Y')}</span>
                            <input type="number" class="fe-cell-y" min="0" max="${ZX_SPECTRUM.GRID_ROWS - 1}" value="0"></label>
                        <button type="button" class="pc-btn fe-capture" data-i18n="font.capture">${this._t('font.capture', 'Capture Cell')}</button>
                    </div>
                </div>
                <div class="me-toolbar">
                    <input type="text" class="fe-name" placeholder="${this._t('font.name', 'Font name...')}" data-i18n-placeholder="font.name">
                    <button type="button" class="pc-btn fe-import" data-i18n="font.import">${this._t('font.import', 'Import...')}</button>
                    <select class="fe-export-format">
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
                    <input type="file" class="fe-file-input" accept=".ch4,.ch6,.ch8,.chr,.chx" hidden>
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
        this._glyphEditor = new CellGridEditor({
            width: w,
            height: h,
            canvasWidth: w * 24,
            canvasHeight: h * 24,
            onChange: () => this._commitGlyphEdit(),
            className: 'fe-glyph-canvas'
        });
        content.querySelector('.fe-editor-slot').appendChild(this._glyphEditor.element);

        this._attachEvents(content);

        // Repaint from facts only
        this._unsubscribes = [
            EventBus.on(EVENTS.FONT_CHANGED, () => this._onFontChanged()),
            EventBus.on(EVENTS.FONT_LOADED, () => this._refreshAll()),
            EventBus.on(EVENTS.FONT_LIBRARY_CHANGED, () => this._refreshLibrary()),
            EventBus.on(EVENTS.THEME_CHANGED, () => this._redrawGrid())
        ];
    }

    _onClose() {
        this._unsubscribes.forEach(u => u());
        this._unsubscribes = [];
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
            btn.addEventListener('click', () => {
                c.querySelectorAll('button[data-tool]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this._glyphEditor.setTool(btn.dataset.tool);
            });
        });

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
            // Glyphs are 8-row 1-bit cells — capture is gated in screen modes
            // with other cell geometry (12a) or indexed pixels (13)
            if (ZX_SPECTRUM.CELL_HEIGHT !== FontService.getGlyphSize().h
                || ZX_SPECTRUM.PIXEL_DEPTH !== 1) {
                this._status(this._t('mode.needs8x8',
                    'This feature needs 8×8 attribute cells — switch to Standard ULA or ULAplus mode first.'));
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

        // System font (companion bridge)
        c.querySelector('.fe-system-font').addEventListener('click', () => this._openSystemFontPicker());
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
                    pixels[y * w + x] = (glyph[y] >> (7 - x)) & 1;
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
        const bytes = new Uint8Array(h);
        for (let y = 0; y < h; y++) {
            let byte = 0;
            for (let x = 0; x < w; x++) {
                if (pixels[y * w + x]) byte |= 0x80 >> x;
            }
            bytes[y] = byte;
        }
        this._editorCommit = true;
        FontService.setGlyph(this._selected, bytes);
        this._editorCommit = false;
    }

    /** FONT_CHANGED fact: re-sync everything that shows font state. */
    _onFontChanged() {
        if (!this._root) return;
        this._syncControls();
        this._syncEditorGeometry();
        this._redrawGrid();
        // Reload the editing surface unless the change came from it
        if (!this._editorCommit) this._loadGlyphIntoEditor();
    }

    /** Clamp the selection into coverage; sync width/coverage selects. */
    _syncControls() {
        const { firstCode, count } = FontService.getCoverage();
        this._selected = clamp(this._selected, firstCode, firstCode + count - 1);
        this._root.querySelector('.fe-width').value = String(FontService.width);
        this._root.querySelector('.fe-coverage').value = count === 96 ? 'ASCII' : 'FULL';
        this._updateCurrentLabel();
    }

    /** Resize the cell editor when the font width changed. */
    _syncEditorGeometry() {
        const { w, h } = FontService.getGlyphSize();
        if (this._glyphEditor.getSize().width === w) return;
        this._glyphEditor.setSize(w, h, w * 24, h * 24); // resets contents — reloaded below
        this._loadGlyphIntoEditor();
    }

    _updateCurrentLabel() {
        const el = this._root.querySelector('.fe-current');
        const code = this._selected;
        const printable = code >= 33 && code !== 127 ? String.fromCharCode(code) : '';
        el.textContent = this._t('font.current', 'Code {code}', { code }) +
            (printable ? `  "${printable}"` : '');
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

        // Glyphs at 2×, centred in their cells
        ctx.fillStyle = ZX_PALETTE[0];
        for (let i = 0; i < count; i++) {
            const glyph = FontService.getGlyph(firstCode + i);
            if (!glyph) continue;
            const ox = (i % this.GRID_COLS) * cs + Math.floor((cs - gw * 2) / 2);
            const oy = Math.floor(i / this.GRID_COLS) * cs + (cs - gh * 2) / 2;
            for (let y = 0; y < gh; y++) {
                for (let x = 0; x < gw; x++) {
                    if ((glyph[y] >> (7 - x)) & 1) ctx.fillRect(ox + x * 2, oy + y * 2, 2, 2);
                }
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

    _export(format) {
        const base = (FontService.name || 'font').replace(/[^\w\- ]+/g, '').trim() || 'font';
        try {
            if (FontFormat.EXTENSIONS.includes(format)) {
                FontFormat.exportAndDownload(`${base}.${format}`);
            } else {
                const data = DevFormat.generateFont(format, `${base}_font`, FontService.toDocument());
                const mime = format === 'bin' ? 'application/octet-stream' : 'text/plain';
                FormatRegistry.download(data, `${base}_font.${format}`, mime);
            }
            this._status(this._t('font.status.exported', 'Font exported.'));
        } catch (err) {
            this._status(err.message);
        }
    }

    // ─── System font (companion bridge) ──────────────────────────────────

    /**
     * File > Font Editor... > From System Font... — pick one of the real
     * OS fonts the paired companion enumerates and rasterize it into the
     * working font's glyph coverage. All outline-to-bitmap conversion runs
     * client-side in FontRasterizer (Canvas 2D) — the companion only ever
     * serves raw font bytes, never renders anything itself.
     * @private
     */
    async _openSystemFontPicker() {
        const provider = CompanionBridgeService.getProvider();
        if (!provider) {
            this._status(this._t('font.systemFontNeedsCompanion',
                'Connect the Companion (Settings > Companion...) to use system fonts.'));
            return;
        }

        let fonts;
        try {
            fonts = await provider.listFonts();
        } catch (error) {
            Logger.warn('FontEditorDialog', 'listFonts failed', error);
            this._status(error.message);
            return;
        }

        const select = document.createElement('select');
        select.className = 'font-editor-system-font-select';
        for (const f of fonts) {
            const opt = document.createElement('option');
            opt.value = f.fontId;
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
            const chosen = fonts.find((f) => f.fontId === select.value);
            if (!chosen) {
                this._status(this._t('font.status.noFont', 'Select a library font first.'));
                return;
            }
            const pointSize = parseInt(sizeInput.value, 10) || 12;
            const cellWidth = parseInt(widthSelect.value, 10);

            try {
                const bytes = await provider.readFontFile(chosen.fontId);
                FontService.setWidth(cellWidth);
                const coverage = FontService.getCoverage();
                const glyphs = await FontRasterizer.rasterize(bytes, {
                    pointSize, cellWidth,
                    firstCode: coverage.firstCode, count: coverage.count
                });
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

window.FontEditorDialog = new FontEditorDialogClass();

Logger.debug('FontEditorDialog', 'Font editor dialog loaded');

})(); // End IIFE
