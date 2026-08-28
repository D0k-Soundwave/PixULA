'use strict';
(function() {

/**
 * PatternCreatorPanel
 *
 * Full modal editor for creating and managing user patterns.
 * Opens as a Dialog (the floating-window system is retired).
 * Patterns are stored as 1-bit packed bytes (ZX UDG format) in IndexedDB.
 * Editor state (pixels, size, name) lives on the singleton, so closing and
 * reopening the dialog resumes where the user left off.
 *
 * The magnified drawing surface is the shared CellGridEditor component
 * (also used by the map editor's tile pane; the Phase 10 font editor is
 * the planned third consumer) — this panel owns only the pattern-specific
 * chrome: size tabs, library, preview, save/import/export.
 */
class PatternCreatorPanelClass {
    /** Target preview size in CSS px; a multiple of 32 so 8/16/32 tiles all land
     *  on a whole-number zoom. Matches the Pattern Library's preview. */
    static PREVIEW_BOX = 128;

    constructor() {
        this._size = 8;
        this._name = '';

        this._editor = new CellGridEditor({
            width: this._size,
            height: this._size,
            getInk: () => this._ink(),
            getPaper: () => this._paper(),
            onChange: () => this._updatePreview(),
            className: 'pc-canvas'
        });

        // DOM refs set on open
        this._root           = null;
        this._previewCanvas  = null;
        this._previewCtx     = null;
        this._libraryList    = null;
        this._nameInput      = null;
        this._statusMsg      = null;
        this._statusTimeout  = null;
    }

    /** English fallback until i18n lands (Phase 6). @private */
    _t(key, fallback, params) {
        if (window.I18n && typeof I18n.t === 'function') {
            const v = I18n.t(key, params);
            if (v && v !== key) return v;
        }
        return fallback;
    }

    /** Paper/ink raster colours — document content from the palette. @private */
    _paper() { return ZX_PALETTE[7]; }
    _ink()   { return ZX_PALETTE[0]; }

    /** Open (or focus) the modal editor */
    open() {
        if (Dialog.isOpen('pattern-creator')) return;
        this._createDialog();
        this._refreshLibrary();
        this._editor.redraw();
        this._updatePreview();
    }

    // ─── Dialog creation ──────────────────────────────────────────────────

    _createDialog() {
        const content = document.createElement('div');
        content.className = 'pc-layout';
        content.innerHTML = `
            <div class="pc-library">
                <div class="pc-library-title" data-i18n="pc.library">${this._t('pc.library', 'My Patterns')}</div>
                <div class="pc-library-list"></div>
            </div>
            <div class="pc-center">
                <div class="pc-size-tabs">
                    <button type="button" data-size="8">8&#215;8</button>
                    <button type="button" data-size="16">16&#215;16</button>
                    <button type="button" data-size="32">32&#215;32</button>
                </div>
                <div class="pc-toolbar">
                    ${Helpers.miniToolButton('brush', 'B', 'tool.brush', 'Brush', 'miniTool.brush.hint', 'Click or drag to set pixels')}
                    ${Helpers.miniToolButton('eraser', 'E', 'tool.eraser', 'Eraser', 'tool.eraser.hint', 'Clear pixels back to the paper colour')}
                    ${Helpers.miniToolButton('line', 'S', 'shape.line', 'Line', 'miniTool.line.hint', 'Drag to draw a straight line between two points')}
                    ${Helpers.miniToolButton('fill', 'F', 'tool.fill', 'Fill', 'tool.fill.hint', 'Flood the area under the cursor out to its edges')}
                </div>
                <div class="pc-canvas-slot"></div>
                <div class="pc-status"></div>
                <div class="pc-actions">
                    <input type="text" class="pc-name" id="pc-name" name="pc-name" placeholder="${this._t('pc.namePlaceholder', 'Pattern name...')}" data-i18n-placeholder="pc.namePlaceholder">
                    <button type="button" class="pc-btn pc-save" data-i18n="pc.save">${this._t('pc.save', 'Save')}</button>
                    <button type="button" class="pc-btn pc-from-selection" data-i18n="pc.fromSelection">${this._t('pc.fromSelection', 'From Selection')}</button>
                    <button type="button" class="pc-btn pc-clear" data-i18n="pc.clear">${this._t('pc.clear', 'Clear')}</button>
                </div>
                <div class="pc-actions">
                    <button type="button" class="pc-btn pc-export" data-i18n="pc.exportPng">${this._t('pc.exportPng', 'Export PNG')}</button>
                    <button type="button" class="pc-btn pc-import-file" data-i18n="pc.importPng">${this._t('pc.importPng', 'Import PNG')}</button>
                    <input type="file" class="pc-file-input" id="pc-file-input" name="pc-file-input" accept=".png,image/png" hidden>
                </div>
            </div>
            <div class="pc-preview">
                <div class="pc-preview-title" data-i18n="pc.iconPreview">${this._t('pc.iconPreview', 'Icon preview')}</div>
                <canvas class="pc-preview-canvas"></canvas>
                <div class="pc-preview-label" data-i18n="pc.noPattern">${this._t('pc.noPattern', 'No pattern')}</div>
            </div>
        `;

        Dialog.open({
            id: 'pattern-creator',
            titleI18n: 'pc.title',
            title: 'Pattern Creator',
            content,
            className: 'pattern-creator-dialog',
            onClose: () => { this._root = null; }
        });

        this._root          = content;
        content.querySelector('.pc-canvas-slot').appendChild(this._editor.element);
        this._previewCanvas = content.querySelector('.pc-preview-canvas');
        this._previewCtx    = this._previewCanvas.getContext('2d');
        this._libraryList   = content.querySelector('.pc-library-list');
        this._nameInput     = content.querySelector('.pc-name');
        this._statusMsg     = content.querySelector('.pc-status');

        // Reflect resumed state (size tab, active tool, name)
        content.querySelectorAll('.pc-size-tabs button').forEach(b => {
            b.classList.toggle('active', parseInt(b.dataset.size, 10) === this._size);
        });
        content.querySelectorAll('.pc-toolbar button').forEach(b => {
            b.classList.toggle('active', b.dataset.tool === this._editor.getTool());
        });
        this._nameInput.value = this._name;

        this._attachEvents(content);
        this._updatePreviewSize();
    }

    // ─── Event wiring ─────────────────────────────────────────────────────

    _attachEvents(c) {
        // Size tabs
        c.querySelector('.pc-size-tabs').addEventListener('click', e => {
            const btn = e.target.closest('button[data-size]');
            if (!btn) return;
            c.querySelectorAll('.pc-size-tabs button').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            this._setSize(parseInt(btn.dataset.size, 10));
        });

        // Mini toolbar (the drawing surface itself is the shared component)
        c.querySelector('.pc-toolbar').addEventListener('click', e => {
            const btn = e.target.closest('button[data-tool]');
            if (!btn) return;
            c.querySelectorAll('.pc-toolbar button').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            this._editor.setTool(btn.dataset.tool);
        });

        // Name input
        this._nameInput.addEventListener('input', e => { this._name = e.target.value.trim(); });

        // Action buttons
        c.querySelector('.pc-save').addEventListener('click',           () => this._save());
        c.querySelector('.pc-from-selection').addEventListener('click', () => this._importFromSelection());
        c.querySelector('.pc-clear').addEventListener('click',          () => this._editor.clear());
        c.querySelector('.pc-export').addEventListener('click',         () => this._export());
        c.querySelector('.pc-import-file').addEventListener('click',    () => c.querySelector('.pc-file-input').click());
        c.querySelector('.pc-file-input').addEventListener('change',    e => this._importFile(e));

        // Refresh active indicator when Pattern Tool's active pattern changes
        EventBus.on(EVENTS.PATTERN_CHANGED, () => this._refreshLibrary());
    }

    // ─── Icon preview ─────────────────────────────────────────────────────

    /**
     * The canvas is rebuilt per pattern by _updatePreview (its size comes from the
     * zoom), so there is no separate size to set. Kept as the hook the size tabs
     * call, and because the preview must repaint when the tile size changes.
     */
    _updatePreviewSize() {
        this._updatePreview();
    }

    _updatePreview() {
        if (!this._previewCanvas) return;
        const n = this._size;
        // Same renderer as the Pattern Library, so a tile being drawn here and the
        // same tile in the library are shown at the same zoom and the same fidelity:
        // 2x2 whole tiles at an integer device-pixel zoom, never a fractional fit.
        const { canvas } = Helpers.createPatternPreview(this._editor.getPixels(), n, n, {
            box: PatternCreatorPanelClass.PREVIEW_BOX,
            minTiles: 2,
            ink: this._ink(),
            paper: this._paper()
        });
        canvas.className = this._previewCanvas.className;
        this._previewCanvas.replaceWith(canvas);
        this._previewCanvas = canvas;
        this._previewCtx = canvas.getContext('2d');

        const label = this._root && this._root.querySelector('.pc-preview-label');
        if (label) label.textContent = this._name || this._t('pc.untitled', 'Untitled');
    }

    // ─── Size management ──────────────────────────────────────────────────

    _setSize(size) {
        this._size = size;
        this._editor.setSize(size, size);
        this._updatePreviewSize();
        this._updatePreview();
    }

    // ─── Import from canvas selection ────────────────────────────────────

    _importFromSelection() {
        const sel = SelectionService.getSelection();
        if (!sel) {
            this._status(this._t('pc.status.noSelection', 'No selection on canvas.'));
            return;
        }
        if (sel.width !== this._size || sel.height !== this._size) {
            const params = { size: this._size };
            this._status(Helpers.interpolate(this._t('pc.status.sizeMismatch',
                'Selection must be {size}×{size} to match current pattern size.', params), params));
            return;
        }
        const pixels = new Uint8Array(this._size * this._size);
        for (let py = 0; py < this._size; py++) {
            for (let px = 0; px < this._size; px++) {
                const state = PixelDrawRoutine.getPixelState(sel.x + px, sel.y + py);
                pixels[py * this._size + px] = (state && state.isInk) ? 1 : 0;
            }
        }
        this._editor.setPixels(pixels);
        this._updatePreview();
        this._status(this._t('pc.status.importedSelection', 'Imported from selection.'));
    }

    // ─── Pack / unpack ────────────────────────────────────────────────────

    _unpackBytes(bytes, size) {
        const bytesPerRow = Math.ceil(size / 8);
        const pixels = new Uint8Array(size * size);
        for (let row = 0; row < size; row++) {
            for (let bit = 0; bit < size; bit++) {
                const byteIdx = row * bytesPerRow + Math.floor(bit / 8);
                pixels[row * size + bit] = (bytes[byteIdx] >> (7 - (bit % 8))) & 1;
            }
        }
        return pixels;
    }

    // ─── Save / load ──────────────────────────────────────────────────────

    async _save() {
        const name = (this._name || 'untitled').trim().slice(0, PatternService.MAX_PATTERN_NAME);
        // Through the service, not straight to Storage: the count cap and the
        // name rule live there, and a second writer that skipped them would be
        // a cap that only applies to whichever path you happened to use.
        const saved = await PatternService.savePatternData(
            name, this._size, this._editor.getPixels());
        if (!saved) {
            this._status(I18n.t('pc.libraryFull', { max: PatternService.MAX_USER_PATTERNS }));
            return;
        }
        await this._refreshLibrary();
        const params = { name };
        this._status(Helpers.interpolate(this._t('pc.status.saved', 'Saved "{name}".', params), params));
    }

    async _refreshLibrary() {
        if (!this._libraryList) return;
        const records = await Storage.getAll(Storage.STORES.PATTERNS);
        this._libraryList.textContent = '';
        if (!records.length) {
            const empty = document.createElement('div');
            empty.className = 'pc-library-empty';
            empty.textContent = this._t('pc.libraryEmpty', 'No saved patterns yet.');
            this._libraryList.appendChild(empty);
            return;
        }
        const activePatternName = window.PatternService ? PatternService.getCurrentPattern()?.name : null;
        records.forEach(rawRecord => {
            const r = rawRecord.value ?? rawRecord;
            const rId = rawRecord.id ?? rawRecord.key;

            const item = document.createElement('div');
            item.className = 'pc-library-item';
            if (r.name === activePatternName) item.classList.add('pc-library-item--active');

            const preview = document.createElement('canvas');
            preview.width = preview.height = 16;
            preview.className = 'pc-library-thumb';
            this._renderThumb(preview, new Uint8Array(r.data), r.size);

            const label = document.createElement('span');
            label.className = 'pc-library-name';
            label.textContent = r.name;

            const useBtn = document.createElement('button');
            useBtn.type = 'button';
            useBtn.className = 'pc-library-use';
            // The in-use row says so in words rather than with a check glyph:
            // "In use" survives translation and a font without dingbat coverage.
            useBtn.textContent = r.name === activePatternName
                ? this._t('pc.inUse', 'In use')
                : this._t('pc.use', 'Use');
            useBtn.title = this._t('pc.activate', 'Activate for Pattern Tool');
            useBtn.addEventListener('click', async e => {
                e.stopPropagation();
                const pattern = {
                    name: r.name,
                    userDefined: true,
                    width: r.size,
                    height: r.size,
                    bitmap: this._unpackBytes(new Uint8Array(r.data), r.size)
                };
                await PatternService.setCurrentPattern(pattern);
                ToolManager.selectTool(TOOLS.BRUSH);
                const brushTool = ToolManager.getTool(TOOLS.BRUSH);
                if (brushTool && typeof brushTool.setBrushType === 'function') {
                    brushTool.setBrushType('pattern');
                }
                this._refreshLibrary();
            });

            const del = document.createElement('button');
            del.type = 'button';
            del.className = 'pc-library-delete';
            del.textContent = '×';
            del.title = this._t('pc.deletePattern', 'Delete pattern');
            del.addEventListener('click', async e => {
                e.stopPropagation();
                await Storage.delete(rId, Storage.STORES.PATTERNS);
                EventBus.emit(EVENTS.PATTERN_CHANGED);
                this._refreshLibrary();
            });

            item.addEventListener('click', () => this._loadRecord(r));
            item.appendChild(preview);
            item.appendChild(label);
            item.appendChild(useBtn);
            item.appendChild(del);
            this._libraryList.appendChild(item);
        });
    }

    _renderThumb(canvas, bytes, size) {
        const ctx = canvas.getContext('2d');
        const pw = canvas.width, ph = canvas.height;
        const pixels = this._unpackBytes(bytes, size);
        ctx.fillStyle = this._paper();
        ctx.fillRect(0, 0, pw, ph);
        ctx.fillStyle = this._ink();
        for (let py = 0; py < ph; py++) {
            for (let px = 0; px < pw; px++) {
                const sx = px % size, sy = py % size;
                if (pixels[sy * size + sx]) ctx.fillRect(px, py, 1, 1);
            }
        }
    }

    _loadRecord(r) {
        this._size = r.size;
        this._editor.setSize(r.size, r.size);
        this._editor.setPixels(this._unpackBytes(new Uint8Array(r.data), r.size));
        this._name = r.name;
        if (this._nameInput) this._nameInput.value = r.name;

        if (this._root) {
            this._root.querySelectorAll('.pc-size-tabs button').forEach(b => {
                b.classList.toggle('active', parseInt(b.dataset.size, 10) === r.size);
            });
        }

        this._updatePreviewSize();
        this._updatePreview();
    }

    // ─── Export / import file ─────────────────────────────────────────────

    _export() {
        const name = this._name || 'pattern';
        const n = this._size;
        const pixels = this._editor.getPixels();
        const canvas = Helpers.createCanvas(n, n);
        const ctx = canvas.getContext('2d');
        const imageData = ctx.createImageData(n, n);
        for (let i = 0; i < n * n; i++) {
            const v = pixels[i] ? 0 : 255;
            imageData.data[i * 4]     = v;
            imageData.data[i * 4 + 1] = v;
            imageData.data[i * 4 + 2] = v;
            imageData.data[i * 4 + 3] = 255;
        }
        ctx.putImageData(imageData, 0, 0);
        canvas.toBlob(blob => {
            Helpers.downloadFile(blob, `${name}.png`, 'image/png');
        }, 'image/png');
    }

    _importFile(e) {
        const file = e.target.files[0];
        if (!file) return;
        Helpers.readFileAsDataURL(file).then((dataUrl) => {
            const img = new Image();
            img.addEventListener('load', () => {
                const w = img.naturalWidth;
                const h = img.naturalHeight;
                if (w !== h || ![8, 16, 32].includes(w)) {
                    const params = { w, h };
                    this._status(Helpers.interpolate(this._t('pc.status.invalidImportSize',
                        'Invalid size {w}×{h}. Expected 8×8, 16×16, or 32×32.', params), params));
                    e.target.value = '';
                    return;
                }
                const offscreen = Helpers.createCanvas(w, w);
                const ctx = offscreen.getContext('2d');
                ctx.drawImage(img, 0, 0);
                const data = ctx.getImageData(0, 0, w, w).data;
                const pixels = new Uint8Array(w * w);
                for (let i = 0; i < w * w; i++) {
                    const lum = 0.299 * data[i*4] + 0.587 * data[i*4+1] + 0.114 * data[i*4+2];
                    pixels[i] = lum < 128 ? 1 : 0;
                }
                this._size = w;
                this._editor.setSize(w, w);
                this._editor.setPixels(pixels);
                this._name = file.name.replace(/\.png$/i, '');
                if (this._nameInput) this._nameInput.value = this._name;

                if (this._root) {
                    this._root.querySelectorAll('.pc-size-tabs button').forEach(b => {
                        b.classList.toggle('active', parseInt(b.dataset.size, 10) === w);
                    });
                }

                this._updatePreviewSize();
                this._updatePreview();
                const params = { name: this._name };
                this._status(Helpers.interpolate(this._t('pc.status.imported', 'Imported "{name}".', params), params));
                e.target.value = '';
            });
            img.addEventListener('error', () => {
                this._status(this._t('pc.status.failedPng', 'Failed to load PNG.'));
                e.target.value = '';
            });
            img.src = dataUrl;
        }).catch(() => {
            this._status(this._t('pc.status.failedPng', 'Failed to load PNG.'));
            e.target.value = '';
        });
    }

    // ─── Status message ───────────────────────────────────────────────────

    /*
     * Status-line dwell. [P] Comfortable silent reading runs about 5 words
     * a second (Rayner 1998, widely reproduced). [C] These messages are
     * short - "Font imported." is 2 words, the longest here about 8 - so
     * reading costs under 2 s; 3 s leaves roughly a second to NOTICE the
     * line appear before starting to read it. Short enough that a stale
     * message never outlives the action that caused it.
     */
    _status(msg) {
        if (this._statusMsg) {
            this._statusMsg.textContent = msg;
            clearTimeout(this._statusTimeout);
            this._statusTimeout = setTimeout(() => {
                if (this._statusMsg) this._statusMsg.textContent = '';
            }, 3000);
        }
    }
}

window.PatternCreatorPanel = new PatternCreatorPanelClass();

Logger.debug('PatternCreatorPanel', 'Pattern creator panel loaded');

})(); // End IIFE
