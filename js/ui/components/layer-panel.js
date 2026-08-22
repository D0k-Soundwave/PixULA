'use strict';
(function() {

/**
 * LayerPanel — Krita/GIMP-style layer list + the Stamps section, in one
 * sidebar panel (stamps are managed together with layers by design).
 *
 * Extracted from the old app.js (_setupLayerPanel + _setupStampPanel).
 * Renders only from EVENTS.LAYER_* facts; commands go down as direct
 * LayerManager / SelectionService calls. Icons come from the index.html
 * sprite (the one icon system).
 *
 * Interactions:
 *   click row          -> select as drawing layer (ctrl: multi, shift: range)
 *   dbl-click name     -> rename inline
 *   checkbox           -> toggle selection for merge
 *   eye / lock         -> visibility / lock
 *   stamp row click    -> engage stamp (click again releases -> brush)
 */

function svgUse(iconId) {
    return `<svg class="row-icon" aria-hidden="true"><use href="#${iconId}"/></svg>`;
}

/**
 * A captioned icon control: one keyword above the button, the full name and
 * what it does in its tooltip (Helpers.composeTitle).
 * @param {string} capKey  short caption key
 * @param {string} capText English caption
 * @param {string} nameKey full-name key (accessible name + tooltip)
 * @param {string} name    English full name
 * @param {string} hintKey description key
 * @param {string} hint    English description
 * @param {string} attrs   the button's own attributes (id, class, …)
 */
function captionedIconBtn(capKey, capText, nameKey, name, hintKey, hint, attrs, iconId) {
    const btn = `<button type="button" ${attrs} data-i18n-title="${hintKey}" ` +
        `data-i18n-title-name="${nameKey}" data-i18n-aria-label="${nameKey}" ` +
        `aria-label="${Helpers.escapeHTML(Helpers.tr(nameKey, name))}" ` +
        `title="${Helpers.escapeHTML(Helpers.composeTitle(Helpers.tr(nameKey, name), Helpers.tr(hintKey, hint)))}">` +
        `${svgUse(iconId)}</button>`;
    return Helpers.captionedButton(btn, capKey, capText);
}

class LayerPanelClass {
    constructor() {
        this._layerList = null;
        this._stampList = null;
        this._stampEmpty = null;
        this._buttons = {};
    }

    /** English fallback until i18n lands (Phase 6). @private */
    _t(key, fallback) {
        if (window.I18n && typeof I18n.t === 'function') {
            const v = I18n.t(key);
            if (v && v !== key) return v;
        }
        return fallback;
    }

    init() {
        const panel = PanelSection.create({
            id: 'layer-panel',
            titleI18n: 'panels.layers',
            title: 'Layers',
            hintI18n: 'panels.layers.hint',
            hint: 'Add, delete, reorder and merge layers, and set each one\'s opacity and blend mode. Right-click this header to move the whole panel up or down'
        });
        if (!panel) return;

        this._buildContent(panel.content);
        this._attachLayerListEvents();
        this._attachStampListEvents();
        this._attachButtons();

        const rerenderAll = () => { this._renderLayerList(); this._renderStampList(); };
        EventBus.on(EVENTS.LAYER_CREATED,    rerenderAll);
        EventBus.on(EVENTS.LAYER_DELETED,    rerenderAll);
        EventBus.on(EVENTS.LAYER_ORDER,      rerenderAll);
        EventBus.on(EVENTS.LAYER_SELECTED,   rerenderAll);
        EventBus.on(EVENTS.LAYER_VISIBILITY, rerenderAll);
        // GigaScreen A/B badges appear/disappear with the mode
        EventBus.on(EVENTS.SCREEN_MODE_CHANGED, rerenderAll);

        rerenderAll();

        Logger.info('LayerPanel', 'Initialized');
    }

    // ── Static content ───────────────────────────────────────────────────────

    /** @private */
    _buildContent(content) {
        content.innerHTML = `
            <div id="layer-list" role="listbox" aria-label="Layers" aria-multiselectable="true"></div>
            <div id="layer-controls" role="group" aria-label="Layer controls">
                ${captionedIconBtn('cap.add', 'Add', 'layer.add', 'Add Layer',
                    'layer.add.hint', 'Add new layer',
                    'id="add-layer" class="layer-ctrl-btn"', 'icon-plus')}
                ${captionedIconBtn('cap.delete', 'Delete', 'layer.delete', 'Delete Layer',
                    'layer.delete.hint', 'Delete selected layers',
                    'id="delete-layer" class="layer-ctrl-btn"', 'icon-minus')}
                ${captionedIconBtn('cap.duplicate', 'Duplicate', 'layer.duplicate', 'Duplicate Layer',
                    'layer.duplicate.hint', 'Duplicate layer',
                    'id="duplicate-layer" class="layer-ctrl-btn"', 'icon-duplicate')}
                <span class="layer-ctrl-divider"></span>
                ${captionedIconBtn('cap.up', 'Up', 'layer.moveUp', 'Move Up',
                    'layer.moveUp.hint', 'Move layer up',
                    'id="layer-move-up" class="layer-ctrl-btn"', 'icon-arrow-up')}
                ${captionedIconBtn('cap.down', 'Down', 'layer.moveDown', 'Move Down',
                    'layer.moveDown.hint', 'Move layer down',
                    'id="layer-move-down" class="layer-ctrl-btn"', 'icon-arrow-down')}
                <span class="layer-ctrl-divider"></span>
                <button type="button" id="merge-selected" class="layer-ctrl-btn layer-ctrl-wide" data-i18n="layer.mergeSelected" data-i18n-title-name="layer.mergeSelected" data-i18n-title="layer.mergeSelected.hint" title="${Helpers.composeTitle(this._t('layer.mergeSelected', 'Merge'), this._t('layer.mergeSelected.hint', 'Merges every selected layer down into the one below it'))}">${this._t('layer.mergeSelected', 'Merge')}</button>
            </div>
            <div id="layer-help" class="panel-help">
                <small data-i18n="layer.help">${this._t('layer.help', 'Click: select | Ctrl+click: multi-select | Shift+click: range')}</small>
            </div>
            <div id="stamp-section">
                <h3 id="stamp-section-title" class="panel-subheading" data-i18n="panels.stamps">${this._t('panels.stamps', 'Stamps')}</h3>
                <div id="stamp-list" role="listbox" aria-label="Stamps"></div>
                <div id="stamp-empty" class="panel-help">
                    <small data-i18n="stamp.emptyHint">${this._t('stamp.emptyHint', 'Paste, copy, or use the Text tool to create a stamp. Click a stamp to engage; click again to release and return to brush.')}</small>
                </div>
            </div>
        `;

        this._layerList  = content.querySelector('#layer-list');
        this._stampList  = content.querySelector('#stamp-list');
        this._stampEmpty = content.querySelector('#stamp-empty');
        this._buttons = {
            add:       content.querySelector('#add-layer'),
            del:       content.querySelector('#delete-layer'),
            duplicate: content.querySelector('#duplicate-layer'),
            moveUp:    content.querySelector('#layer-move-up'),
            moveDown:  content.querySelector('#layer-move-down'),
            mergeSel:  content.querySelector('#merge-selected')
        };
    }

    // ── Layer list rendering ─────────────────────────────────────────────────

    /** @private */
    _renderLayerList() {
        const layerList = this._layerList;
        if (!layerList) return;

        const layers = LayerManager.layers;
        const currentIndex = LayerManager.currentLayerIndex;
        const drawTargetIndex = LayerManager.activeDrawLayerIndex;
        // Show the stamp's commit target with a separate highlight only when
        // a stamp is focused — otherwise current and target are the same layer.
        const currentLayer = layers[currentIndex];
        const showDrawTarget = !!(currentLayer && currentLayer.isStamp);

        layerList.textContent = '';

        // Render in reverse order (top layer first visually).
        // Skip layer 0 (background) and stamps (they live in the Stamps section).
        for (let i = layers.length - 1; i >= 1; i--) {
            const layer = layers[i];
            if (layer.isStamp) continue;
            const isCurrent = i === currentIndex;
            const isDrawTarget = showDrawTarget && i === drawTargetIndex;
            const isSelected = LayerManager.isLayerSelected(i);

            const item = document.createElement('div');
            item.className = 'layer-item';
            if (isCurrent) item.classList.add('current');
            if (isDrawTarget) item.classList.add('draw-target');
            if (isSelected) item.classList.add('selected');
            item.dataset.layerIndex = i;
            item.setAttribute('role', 'option');
            item.setAttribute('aria-selected', String(isCurrent));
            item.setAttribute('tabindex', '0');

            // GigaScreen: an A/B badge per layer — which sub-screen it sits on
            const gigaBadge = (ACTIVE_SCREEN_MODE.screens || 1) === 2
                ? `<button type="button" class="layer-btn layer-giga ${layer.gigaScreen === 1 ? 'giga-b' : 'giga-a'}"
                        title="${this._t('giga.layerScreen.hint', 'Which GigaScreen sub-screen this layer belongs to — click to switch')}" data-i18n-title="giga.layerScreen.hint"
                        aria-label="Toggle sub-screen">${layer.gigaScreen === 1
                            ? this._t('giga.viewB', 'B') : this._t('giga.viewA', 'A')}</button>`
                : '';

            item.innerHTML = `
                <button type="button" class="layer-btn layer-checkbox ${isSelected ? 'checked' : ''}"
                        title="${this._t('layer.selectForMerge', 'Select for merge')}" data-i18n-title="layer.selectForMerge"
                        aria-label="Toggle selection for merge">${svgUse(isSelected ? 'icon-check' : 'icon-check-empty')}</button>
                <button type="button" class="layer-btn layer-visibility ${layer.visible ? 'visible' : ''}"
                        title="${this._t(layer.visible ? 'layer.visibility.hide' : 'layer.visibility.show', layer.visible ? 'Hide layer' : 'Show layer')}" data-i18n-title="${layer.visible ? 'layer.visibility.hide' : 'layer.visibility.show'}"
                        aria-label="Toggle layer visibility">${svgUse(layer.visible ? 'icon-eye' : 'icon-eye-off')}</button>
                <span class="layer-name" title="${this._t('layer.selectHint', 'Click to select; double-click to rename')}" data-i18n-title="layer.selectHint">${Helpers.escapeHTML(layer.name)}</span>
                ${gigaBadge}
                <button type="button" class="layer-btn layer-lock ${layer.locked ? 'locked' : ''}"
                        title="${this._t(layer.locked ? 'layer.lock.unlock' : 'layer.lock.lock', layer.locked ? 'Unlock layer' : 'Lock layer')}" data-i18n-title="${layer.locked ? 'layer.lock.unlock' : 'layer.lock.lock'}"
                        aria-label="Toggle layer lock">${svgUse(layer.locked ? 'icon-lock' : 'icon-unlock')}</button>
            `;
            layerList.appendChild(item);
        }

        this._updateLayerButtons();
    }

    /** Enable/disable the control buttons for the current state. @private */
    _updateLayerButtons() {
        const b = this._buttons;
        const selectedCount = LayerManager.getSelectedLayers().length;
        const layerCount = LayerManager.getLayerCount();
        const currentIndex = LayerManager.currentLayerIndex;
        const drawingLayerCount = layerCount - 1; // exclude background layer 0

        if (b.del) {
            // Can't delete if no selection or it would delete all drawing layers
            b.del.disabled = selectedCount === 0 || selectedCount >= drawingLayerCount;
        }
        if (b.mergeSel) {
            // Stamps are excluded from merge — count only regular drawing layers.
            const regularSelected = LayerManager.getSelectedLayers().filter((i) => {
                const l = LayerManager.layers[i];
                return l && !l.isStamp && i >= 1;
            }).length;
            b.mergeSel.disabled = regularSelected < 2;
        }
        if (b.moveUp)   b.moveUp.disabled = currentIndex >= layerCount - 1;
        if (b.moveDown) b.moveDown.disabled = currentIndex <= 1; // layer 0 is fixed background
    }

    /** @private */
    _attachLayerListEvents() {
        const layerList = this._layerList;

        layerList.addEventListener('click', (e) => {
            const layerItem = e.target.closest('.layer-item');
            if (!layerItem) return;

            const layerIndex = parseInt(layerItem.dataset.layerIndex, 10);

            // Selection checkbox (for merge operations)
            if (e.target.closest('.layer-checkbox')) {
                e.stopPropagation();
                if (LayerManager.selectedLayers.has(layerIndex)) {
                    LayerManager.selectedLayers.delete(layerIndex);
                } else {
                    LayerManager.selectedLayers.add(layerIndex);
                }
                this._renderLayerList();
                return;
            }

            if (e.target.closest('.layer-visibility')) {
                e.stopPropagation();
                const layer = LayerManager.getLayer(layerIndex);
                if (layer) LayerManager.setLayerVisibility(layerIndex, !layer.visible);
                return;
            }

            if (e.target.closest('.layer-lock')) {
                e.stopPropagation();
                const layer = LayerManager.getLayer(layerIndex);
                if (layer) {
                    LayerManager.setLayerLocked(layerIndex, !layer.locked);
                    this._renderLayerList();
                }
                return;
            }

            // GigaScreen sub-screen badge: move the layer to the other screen
            if (e.target.closest('.layer-giga')) {
                e.stopPropagation();
                const layer = LayerManager.getLayer(layerIndex);
                if (layer) {
                    layer.gigaScreen = layer.gigaScreen === 1 ? 0 : 1;
                    StateManager.markModified();
                    LayerManager.composeToCanvas();
                    this._renderLayerList();
                }
                return;
            }

            // Layer row click with modifier keys (Krita/GIMP style)
            LayerManager.handleLayerClick(layerIndex, e.ctrlKey || e.metaKey, e.shiftKey);
        });

        // Double-click on a layer's name enters rename mode
        layerList.addEventListener('dblclick', (e) => {
            const layerItem = e.target.closest('.layer-item');
            if (!layerItem) return;

            const layerIndex = parseInt(layerItem.dataset.layerIndex, 10);
            const layer = LayerManager.getLayer(layerIndex);
            if (!layer) return;

            const nameEl = layerItem.querySelector('.layer-name');
            if (!nameEl || !nameEl.contains(e.target)) return;

            this._startRename(nameEl, layer, layerIndex, () => this._renderLayerList());
        });

        // Keyboard navigation
        layerList.addEventListener('keydown', (e) => {
            const layerItem = e.target.closest('.layer-item');
            if (!layerItem) return;

            const layerIndex = parseInt(layerItem.dataset.layerIndex, 10);

            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                LayerManager.handleLayerClick(layerIndex, e.ctrlKey || e.metaKey, e.shiftKey);
            } else if (e.key === 'Delete') {
                e.preventDefault();
                LayerManager.deleteSelected();
            }
        });
    }

    /** Shared inline-rename editor for layer and stamp names. @private */
    _startRename(nameEl, layer, layerIndex, rerender) {
        const input = document.createElement('input');
        input.type = 'text';
        input.id = `layer-rename-${layerIndex}`;
        input.name = `layer-rename-${layerIndex}`;
        input.value = layer.name;
        input.className = 'layer-rename-input';

        const finishRename = () => {
            const newName = input.value.trim() || layer.name;
            LayerManager.renameLayer(layerIndex, newName);
            rerender();
        };

        input.addEventListener('blur', finishRename);
        input.addEventListener('keydown', (ev) => {
            if (ev.key === 'Enter') {
                ev.preventDefault();
                finishRename();
            } else if (ev.key === 'Escape') {
                rerender();
            }
        });

        nameEl.replaceWith(input);
        input.focus();
        input.select();
    }

    /** @private */
    _attachButtons() {
        const b = this._buttons;

        if (b.add) b.add.addEventListener('click', () => {
            const newLayer = LayerManager.addLayer();
            if (newLayer) LayerManager.setCurrentLayer(newLayer.index);
        });

        if (b.del) b.del.addEventListener('click', () => {
            if (LayerManager.getSelectedLayers().length > 0) {
                LayerManager.deleteSelected();
            } else {
                LayerManager.removeLayer(LayerManager.currentLayerIndex);
            }
        });

        if (b.duplicate) b.duplicate.addEventListener('click', () => {
            if (LayerManager.getSelectedLayers().length > 0) {
                LayerManager.duplicateSelected();
            } else {
                LayerManager.duplicateLayer(LayerManager.currentLayerIndex);
            }
        });

        if (b.mergeSel) b.mergeSel.addEventListener('click', () => LayerManager.mergeSelected());
        if (b.moveUp)   b.moveUp.addEventListener('click', () => LayerManager.moveLayerUp(LayerManager.currentLayerIndex));
        if (b.moveDown) b.moveDown.addEventListener('click', () => LayerManager.moveLayerDown(LayerManager.currentLayerIndex));
    }

    // ── Stamps section ───────────────────────────────────────────────────────

    /**
     * Disengage the engaged stamp: end any floating paste, refocus the active
     * drawing layer, and switch back to the brush tool. The stamp persists in
     * the list and can be re-engaged with another click.
     * @private
     */
    _disengageStamp() {
        if (window.SelectionService && SelectionService.isFloating()) {
            SelectionService.endFloatingPaste();
        }
        const drawIdx = LayerManager.activeDrawLayerIndex;
        if (drawIdx >= 1 && drawIdx < LayerManager.layers.length) {
            LayerManager.setCurrentLayer(drawIdx);
        }
        ToolManager.selectTool(TOOLS.BRUSH);
    }

    /** @private */
    _renderStampList() {
        const stampList = this._stampList;
        if (!stampList) return;

        const layers = LayerManager.layers;
        const currentIndex = LayerManager.currentLayerIndex;
        const currentLayer = layers[currentIndex];

        stampList.textContent = '';
        let stampCount = 0;

        // Render stamps top-first (newest stamp at top of the array)
        for (let i = layers.length - 1; i >= 1; i--) {
            const layer = layers[i];
            if (!layer.isStamp) continue;
            stampCount++;

            const isCurrent = i === currentIndex && currentLayer && currentLayer.isStamp;

            const item = document.createElement('div');
            item.className = 'stamp-item';
            if (isCurrent) item.classList.add('current');
            item.dataset.layerIndex = i;
            item.setAttribute('role', 'option');
            item.setAttribute('aria-selected', isCurrent ? 'true' : 'false');
            item.setAttribute('tabindex', '0');

            item.innerHTML = `
                <button type="button" class="stamp-btn stamp-visibility ${layer.visible ? 'visible' : ''}"
                        title="${this._t(layer.visible ? 'stamp.visibility.hide' : 'stamp.visibility.show', layer.visible ? 'Hide stamp' : 'Show stamp')}" data-i18n-title="${layer.visible ? 'stamp.visibility.hide' : 'stamp.visibility.show'}"
                        aria-label="Toggle stamp visibility">${svgUse(layer.visible ? 'icon-eye' : 'icon-eye-off')}</button>
                <span class="stamp-name" title="${this._t('stamp.selectHint', 'Click to engage; click again to release')}" data-i18n-title="stamp.selectHint">${Helpers.escapeHTML(layer.name)}</span>
                <button type="button" class="stamp-btn stamp-xor ${layer.xorMode ? 'active' : ''}"
                        title="${this._t('stamp.xorMode', 'XOR mode')}" data-i18n-title="stamp.xorMode"
                        aria-label="Toggle XOR mode">X</button>
                <button type="button" class="stamp-btn stamp-commit"
                        title="${this._t('stamp.commit', 'Apply stamp to drawing')}" data-i18n-title="stamp.commit"
                        aria-label="Apply stamp to drawing">${svgUse('icon-commit')}</button>
                <button type="button" class="stamp-btn stamp-delete"
                        title="${this._t('stamp.delete', 'Delete stamp')}" data-i18n-title="stamp.delete"
                        aria-label="Delete stamp">${svgUse('icon-trash')}</button>
            `;
            stampList.appendChild(item);
        }

        if (this._stampEmpty) {
            this._stampEmpty.style.display = stampCount === 0 ? '' : 'none';
        }
    }

    /** @private */
    _attachStampListEvents() {
        const stampList = this._stampList;

        stampList.addEventListener('click', (e) => {
            const item = e.target.closest('.stamp-item');
            if (!item) return;

            const layerIndex = parseInt(item.dataset.layerIndex, 10);
            const layer = LayerManager.getLayer(layerIndex);
            if (!layer || !layer.isStamp) return;

            if (e.target.closest('.stamp-visibility')) {
                e.stopPropagation();
                LayerManager.setLayerVisibility(layerIndex, !layer.visible);
                return;
            }

            // XOR-mode toggle — re-render any active floating preview
            if (e.target.closest('.stamp-xor')) {
                e.stopPropagation();
                LayerManager.setLayerXorMode(layerIndex, !layer.xorMode);
                if (window.SelectionService && SelectionService.isFloating() &&
                    SelectionService.floatingPaste &&
                    SelectionService.floatingPaste.floatingLayer === layer) {
                    layer.clear();
                    LayerManager.composeToCanvas();
                    SelectionService._drawFloatingLayer();
                    LayerManager.flushPendingCompose();
                    CanvasSystem.requestRender();
                }
                this._renderStampList();
                return;
            }

            // Commit stamp — bake it into a drawing layer
            if (e.target.closest('.stamp-commit')) {
                e.stopPropagation();
                if (window.SelectionService) SelectionService.commitStamp(layer);
                return;
            }

            // Delete stamp
            if (e.target.closest('.stamp-delete')) {
                e.stopPropagation();
                const wasCurrent = LayerManager.currentLayerIndex === layerIndex;
                if (wasCurrent && window.SelectionService && SelectionService.isFloating()) {
                    SelectionService.endFloatingPaste();
                }
                LayerManager.removeLayer(layerIndex);
                if (wasCurrent) {
                    const drawIdx = LayerManager.activeDrawLayerIndex;
                    if (drawIdx >= 1 && drawIdx < LayerManager.layers.length) {
                        LayerManager.setCurrentLayer(drawIdx);
                    }
                    ToolManager.selectTool(TOOLS.BRUSH);
                }
                return;
            }

            // Row click: toggle engagement.
            const layers = LayerManager.layers;
            const currentIndex = LayerManager.currentLayerIndex;
            const currentLayer = layers[currentIndex];
            const isCurrent = (currentIndex === layerIndex) && currentLayer && currentLayer.isStamp;

            if (isCurrent) {
                this._disengageStamp();
            } else {
                LayerManager.setCurrentLayer(layerIndex);
                // Show the floating preview at the stamp's saved position so
                // the user sees the stamp before moving the cursor onto the
                // canvas. Engage whenever the clicked stamp is not ALREADY the
                // floating one — startComponentReposition disengages any other
                // active stamp first, so this correctly SWITCHES the preview.
                const activeFp = window.SelectionService ? SelectionService.floatingPaste : null;
                if (window.SelectionService && layer.stamp &&
                    (!activeFp || activeFp.floatingLayer !== layer)) {
                    SelectionService.startComponentReposition(layer);
                    if (SelectionService.floatingPaste) {
                        SelectionService.moveFloatingPaste(layer.stamp.x, layer.stamp.y);
                    }
                }
            }
        });

        // Double-click on the name: rename
        stampList.addEventListener('dblclick', (e) => {
            const item = e.target.closest('.stamp-item');
            if (!item) return;

            const layerIndex = parseInt(item.dataset.layerIndex, 10);
            const layer = LayerManager.getLayer(layerIndex);
            if (!layer || !layer.isStamp) return;

            const nameEl = item.querySelector('.stamp-name');
            if (!nameEl || !nameEl.contains(e.target)) return;

            this._startRename(nameEl, layer, layerIndex, () => this._renderStampList());
        });

        // Keyboard: Enter/Space toggles engagement on the focused row
        stampList.addEventListener('keydown', (e) => {
            const item = e.target.closest('.stamp-item');
            if (!item) return;

            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                item.click();
            }
        });
    }
}

window.LayerPanel = new LayerPanelClass();

Logger.debug('LayerPanel', 'Layer panel component loaded');

})(); // End IIFE
