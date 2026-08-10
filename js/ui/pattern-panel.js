'use strict';
(function() {

/**
 * PatternPanel - Pattern browser rendered inline in the tool options sidebar
 * (fills the OptionControls 'pattern-browser' slot for the Pattern tool and
 * the brush's pattern brush type). Uses the psb-* class namespace.
 */
class PatternPanelClass {
    /**
     * Preview box sizes in CSS px. Both are multiples of 32 so that 8, 16 and 32 px
     * tiles all land on a whole-number zoom with no remainder — the grid cell fits
     * exactly one tile (8x/4x/2x), the preview exactly four (2x2 at 8x/4x/2x).
     */
    static THUMB_BOX = 64;
    static PREVIEW_BOX = 128;

    constructor() {
        this._currentSize = '8x8';
        this._searchQuery = '';
        this._thumbnailCache = new Map();
        this._visiblePatterns = [];
        this.patternGrid   = null;
        this.previewCanvas = null;
        this.previewName   = null;
        this._jsonActions  = null;
        this._applyBtnEl   = null;
        this._panelSection = null;
    }

    /**
     * Create the dedicated 'Patterns' sidebar panel and render the browser into
     * it once. The panel is visible ONLY while the Brush tool's pattern brush
     * type is the active drawing context (EVENTS.TOOL_SELECTED /
     * BRUSH_TYPE_CHANGED drive it); it is hidden for every other tool and type.
     */
    init() {
        if (this._panelSection) return;
        const panel = PanelSection.create({
            id: 'patterns-panel',
            titleI18n: 'panels.patternLibrary',
            title: 'Pattern Library'
        });
        if (!panel) {
            Logger.error('PatternPanel', 'Could not create patterns panel');
            return;
        }
        this._panelSection = panel.section;
        this.renderInto(panel.content);

        const update = () => this._updatePanelVisibility();
        EventBus.on(EVENTS.TOOL_SELECTED, update);
        EventBus.on(EVENTS.BRUSH_TYPE_CHANGED, update);
        this._updatePanelVisibility();
    }

    /** True when the Brush's pattern brush type is the active context. @private */
    _isPatternBrushActive() {
        if (!window.ToolManager) return false;
        const current = ToolManager.getCurrentTool();
        if (!current || current.id !== TOOLS.BRUSH) return false;
        const brush = ToolManager.getTool(TOOLS.BRUSH);
        return !!(brush && typeof brush.getBrushType === 'function' &&
                  brush.getBrushType() === 'pattern');
    }

    /** Show the Patterns panel only for the pattern brush type. @private */
    _updatePanelVisibility() {
        if (!this._panelSection) return;
        // Inline display mirrors PanelSection's own collapse handling and beats
        // the .panel layer rule (a [hidden] attribute would not).
        this._panelSection.style.display = this._isPatternBrushActive() ? '' : 'none';
    }

    /** English fallback until i18n lands (Phase 6). @private */
    _t(key, fallback, params) {
        if (window.I18n && typeof I18n.t === 'function') {
            const v = I18n.t(key, params);
            if (v && v !== key) return v;
        }
        return fallback;
    }

    /**
     * Render the pattern browser into an inline container.
     * @param {HTMLElement} slot
     */
    async renderInto(slot) {
        await PatternService.initialize();

        slot.innerHTML = `
            <div class="psb">
                <div class="psb-tabs">
                    <button type="button" class="psb-tab active" data-size="8x8">8&#215;8</button>
                    <button type="button" class="psb-tab" data-size="16x16">16&#215;16</button>
                    <button type="button" class="psb-tab" data-size="32x32">32&#215;32</button>
                    <button type="button" class="psb-tab" data-size="mine" data-i18n="pattern.mine">${this._t('pattern.mine', 'Mine')}</button>
                    <button type="button" class="psb-tab" data-size="generated">&#x2605;</button>
                </div>
                <input type="text" class="psb-search" placeholder="${this._t('pattern.filterPlaceholder', 'filter patterns…')}" data-i18n-placeholder="pattern.filterPlaceholder">
                <div class="psb-grid"></div>
                <div class="psb-footer">
                    <div class="psb-preview-bar">
                        <div class="psb-name" data-i18n="pattern.noneSelected">${this._t('pattern.noneSelected', 'No pattern selected')}</div>
                        <button type="button" class="psb-apply-btn" disabled data-i18n="pattern.apply">${this._t('pattern.apply', 'Apply')}</button>
                    </div>
                    <canvas class="psb-canvas" width="64" height="64"></canvas>
                    <div class="psb-mine-actions" hidden>
                        <button type="button" class="psb-export-btn" data-i18n="pattern.exportJson">${this._t('pattern.exportJson', 'Export JSON')}</button>
                        <button type="button" class="psb-import-btn" data-i18n="pattern.importJson">${this._t('pattern.importJson', 'Import JSON')}</button>
                        <input type="file" class="psb-file-input" accept=".json" hidden>
                    </div>
                    <button type="button" class="psb-create-btn" data-i18n="pattern.create">${this._t('pattern.create', '+ Create pattern…')}</button>
                    <div class="psb-capture-row">
                        <span class="psb-capture-label" data-i18n="pattern.capture">${this._t('pattern.capture', 'Capture:')}</span>
                        <button type="button" class="psb-cap-btn" data-cap="8">8×8</button>
                        <button type="button" class="psb-cap-btn" data-cap="16">16×16</button>
                        <button type="button" class="psb-cap-btn" data-cap="32">32×32</button>
                    </div>
                </div>
            </div>
        `;

        if (window.I18n && typeof I18n.apply === 'function') I18n.apply(slot);

        this.patternGrid   = slot.querySelector('.psb-grid');
        this.previewCanvas = slot.querySelector('.psb-canvas');
        this.previewName   = slot.querySelector('.psb-name');
        this._jsonActions  = slot.querySelector('.psb-mine-actions');
        this._applyBtnEl   = slot.querySelector('.psb-apply-btn');

        this._attachInlineEvents(slot);
        this._renderPatterns();
        this._updatePreview();
    }

    /**
     * @param {HTMLElement} slot
     * @private
     */
    _attachInlineEvents(slot) {
        slot.querySelector('.psb-tabs').addEventListener('click', (e) => {
            const btn = e.target.closest('.psb-tab');
            if (!btn || !btn.dataset.size) return;
            slot.querySelectorAll('.psb-tab').forEach(b => {
                b.classList.toggle('active', b === btn);
            });
            this._currentSize = btn.dataset.size;
            if (this._jsonActions) {
                this._jsonActions.hidden = this._currentSize !== 'mine';
            }
            this._renderPatterns();
        });

        /*
         * Search debounce.
         *
         * [P] Ordinary prose typing runs 30-40 wpm, and at ~5 characters a word
         * that is 150-200 ms between keystrokes; a fast typist is well under
         * 100 ms. [C] 200 ms sits just past the slow end, so a rebuild fires
         * once when the hand pauses rather than on every letter - and the
         * rebuild is not free: it re-renders up to 105 pattern previews.
         * Raising it much further would make the list feel late.
         */
        const SEARCH_DEBOUNCE_MS = 200;
        let searchTimeout;
        slot.querySelector('.psb-search').addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                this._searchQuery = e.target.value.trim().toLowerCase();
                this._renderPatterns();
            }, SEARCH_DEBOUNCE_MS);
        });

        this.patternGrid.addEventListener('click', (e) => {
            const item = e.target.closest('.pattern-item');
            if (item) this._selectPattern(parseInt(item.dataset.index, 10));
        });

        this.patternGrid.addEventListener('dblclick', (e) => {
            const item = e.target.closest('.pattern-item');
            if (item) this._applyToSelection();
        });

        if (this._applyBtnEl) {
            this._applyBtnEl.addEventListener('click', () => this._applyToSelection());
        }

        const createBtn = slot.querySelector('.psb-create-btn');
        if (createBtn) {
            createBtn.addEventListener('click', () => {
                if (window.PatternCreatorPanel) PatternCreatorPanel.open();
            });
        }

        slot.querySelectorAll('.psb-cap-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const size = parseInt(btn.dataset.cap, 10);
                // Pattern capture mode is owned by the input handler (Phase 5)
                if (window.InputHandler) InputHandler.enterPatternCaptureMode(size);
                // Pre-select the Mine tab so captured patterns appear there
                this._currentSize = 'mine';
                slot.querySelectorAll('.psb-tab').forEach(t => {
                    t.classList.toggle('active', t.dataset.size === 'mine');
                });
                if (this._jsonActions) this._jsonActions.hidden = false;
                this._renderPatterns();
            });
        });

        EventBus.on(EVENTS.PATTERN_CHANGED, () => {
            this._updatePreview();
            if (this._currentSize === 'mine') this._renderPatterns();
        });

        if (this._jsonActions) {
            const fileInput = slot.querySelector('.psb-file-input');
            slot.querySelector('.psb-export-btn').addEventListener('click', async () => {
                const json = await PatternService.exportPatternsJSON();
                Helpers.downloadFile(json, 'patterns.json', 'application/json');
            });
            slot.querySelector('.psb-import-btn').addEventListener('click', () => fileInput.click());
            fileInput.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                try {
                    const text = await file.text();
                    await PatternService.importPatternsJSON(text);
                    alert(this._t('msg.patternsImported', `Imported patterns from "${file.name}"`, { name: file.name }));
                } catch (err) {
                    alert(this._t('msg.patternsImportFailed', `Pattern import failed: ${err.message}`, { error: err.message }));
                }
                fileInput.value = '';
            });
        }
    }

    /**
     * @private
     */
    async _renderPatterns() {
        if (!this.patternGrid) return;
        this.patternGrid.dataset.size = this._currentSize;
        this.patternGrid.textContent = '';

        let patterns;
        if (this._currentSize === 'mine') {
            patterns = await PatternService.getUserPatterns();
        } else if (this._currentSize === 'generated') {
            const sizes = [8, 16, 32];
            const types = PatternService.getGeneratedPatternTypes();
            patterns = [];
            sizes.forEach(s => types.forEach(t => patterns.push(PatternService.generatePattern(t, s))));
        } else if (this._searchQuery) {
            patterns = PatternService.search(this._searchQuery);
        } else {
            patterns = PatternService.getPatternsBySize(this._currentSize);
        }

        this._visiblePatterns = patterns;

        patterns.forEach((pattern, index) => {
            const item = document.createElement('div');
            item.className = 'pattern-item';
            item.dataset.index = index;
            item.title = pattern.name;

            const thumbnail = document.createElement('div');
            thumbnail.className = 'pattern-thumbnail';
            if (pattern.userDefined && pattern.bitmap) {
                this._renderBitmapThumb(pattern, thumbnail);
            } else {
                this._loadThumbnail(pattern, thumbnail);
            }
            item.appendChild(thumbnail);

            if (this._currentSize === 'mine' && pattern._storageId != null) {
                const del = document.createElement('button');
                del.type = 'button';
                del.className = 'psb-item-delete';
                del.textContent = '×';
                del.title = this._t('pattern.deleteNamed', `Delete "${pattern.name}"`, { name: pattern.name });
                del.addEventListener('click', async e => {
                    e.stopPropagation();
                    await PatternService.deleteUserPattern(pattern._storageId);
                });
                item.appendChild(del);
            }

            this.patternGrid.appendChild(item);
        });
    }

    /**
     * Render a 1-bit pattern as a grid thumbnail: ONE complete tile at the largest
     * integer zoom its cell allows, so a 32x32 motif is legible rather than clipped
     * to the corner that happens to fit, and no tile is scaled by a fraction.
     * @private
     */
    _renderBitmapThumb(pattern, container) {
        const w = pattern.width;
        const h = pattern.height || pattern.width;
        const { canvas } = Helpers.createPatternPreview(pattern.bitmap, w, h, {
            box: PatternPanelClass.THUMB_BOX,
            minTiles: 1,
            ink: '#000',
            paper: '#d7d7d7'
        });
        container.textContent = '';
        container.appendChild(canvas);
    }

    /**
     * Library thumbs render from the same bitmap data the tool draws with — the library
     * has no image assets, so the thumbnail cannot drift from what the pattern paints.
     * @private
     */
    async _loadThumbnail(pattern, container) {
        const cacheKey = pattern.path;
        if (this._thumbnailCache.has(cacheKey)) {
            this._renderBitmapThumb(this._thumbnailCache.get(cacheKey), container);
            return;
        }
        const data = await PatternService.loadPatternData(pattern);
        if (!data) {
            container.classList.add('pattern-error');
            return;
        }
        this._thumbnailCache.set(cacheKey, data);
        this._renderBitmapThumb(data, container);
    }

    /**
     * @private
     */
    async _selectPattern(index) {
        const pattern = this._visiblePatterns[index];
        if (!pattern) return;

        this.patternGrid.querySelectorAll('.pattern-item').forEach((item, i) => {
            item.classList.toggle('selected', i === index);
        });

        await PatternService.setCurrentPattern(pattern);
    }

    /**
     * @private
     */
    _updatePreview() {
        if (!this.previewCanvas) return;
        const pattern = PatternService.getCurrentPattern();
        const patternData = PatternService.getCurrentPatternData();

        if (!pattern || !patternData) {
            if (this.previewName) this.previewName.textContent = this._t('pattern.noneSelected', 'No pattern selected');
            if (this._applyBtnEl) this._applyBtnEl.disabled = true;
            const ctx = this.previewCanvas.getContext('2d');
            ctx.clearRect(0, 0, this.previewCanvas.width, this.previewCanvas.height);
            return;
        }

        if (this.previewName) this.previewName.textContent = pattern.name;
        if (this._applyBtnEl) this._applyBtnEl.disabled = false;

        // 2x2 tiles: the grid thumb already showed the single tile, so what the
        // preview adds is how the design meets itself when it repeats — still at an
        // integer zoom, so the seam is the pattern's own and not a resampling one.
        this._paintPreview(patternData.bitmap, patternData.width, patternData.height, 2);
    }

    /**
     * Swap the preview canvas for one sized to the pattern. The element is replaced
     * rather than resized because its dimensions come from the pattern's zoom, and a
     * stale width would scale the next pattern into the previous one's box.
     * @private
     */
    _paintPreview(bitmap, w, h, minTiles) {
        const { canvas } = Helpers.createPatternPreview(bitmap, w, h, {
            box: PatternPanelClass.PREVIEW_BOX,
            minTiles,
            ink: '#000',
            paper: '#fff'
        });
        canvas.className = this.previewCanvas.className;
        this.previewCanvas.replaceWith(canvas);
        this.previewCanvas = canvas;
    }

    /**
     * @private
     */
    _applyToSelection() {
        if (!PatternService.getCurrentPattern()) return;
        UndoRedo.beginAction('Apply pattern');
        PatternService.applyToSelection();
        UndoRedo.endAction();
        EventBus.emit(EVENTS.CANVAS_DIRTY);
    }

    clearCache() {
        this._thumbnailCache.clear();
    }
}

window.PatternPanel = new PatternPanelClass();

Logger.debug('PatternPanel', 'Pattern panel module loaded');

})(); // End IIFE
