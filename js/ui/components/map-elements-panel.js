'use strict';
(function() {

/**
 * MapElementsPanel - find repeated elements of the picture (Batch 11B). A sidebar panel, not a dialog: the picture has to stay visible and
 * usable while you look at the places that were found.
 *
 * Edit > Find Map Element (Ctrl+F) copies the selected block of whole cells, finds every place it appears under the chosen match mode, outlines them on the
 * picture, and lets you step through them (Previous / Next) and Accept: the element is stored with the map and its places are covered by numbered boxes
 * (MapElementOverlay). Accepting never changes the picture, and is not an undo step (elements are outside undo, as in ZX Paintbrush).
 */
class MapElementsPanelClass {
    constructor() {
        this.ID = 'map-elements-panel';
        this._root = null;
        this._session = null;
    }

    /** @private */
    _t(key, fallback, params) {
        return Helpers.localizedMessage(key, fallback, params || {});
    }

    /** @private */
    _notice(key, fallback, params) {
        EventBus.emit(EVENTS.STATUS_NOTICE, { text: this._t(key, fallback, params) });
    }

    init() {
        const panel = PanelSection.create({
            id: this.ID,
            titleI18n: 'panels.mapElements',
            title: 'Map Elements',
            hintI18n: 'panels.mapElements.hint',
            hint: 'Repeated parts of the picture found with Edit > Find Map Element. Right-click this header to move the whole panel up or down',
            visible: false
        });
        if (!panel) return;
        this._root = panel.content;
        panel.content.innerHTML = `
            <div class="mapel-find" hidden>
                <label class="mapel-row"><span data-i18n="mapel.mode">${this._t('mapel.mode', 'Match')}</span>
                    <select class="mapel-mode" id="mapel-mode" name="mapel-mode"></select></label>
                <p class="mapel-count" role="status" aria-live="polite"></p>
                <p class="mapel-place"></p>
                <div class="mapel-buttons">
                    <button type="button" class="panel-button mapel-prev" data-i18n="mapel.prev">${this._t('mapel.prev', 'Previous')}</button>
                    <button type="button" class="panel-button mapel-next" data-i18n="mapel.next">${this._t('mapel.next', 'Next')}</button>
                </div>
                <div class="mapel-buttons">
                    <button type="button" class="panel-button primary mapel-accept" data-i18n="mapel.accept">${this._t('mapel.accept', 'Accept')}</button>
                    <button type="button" class="panel-button mapel-cancel" data-i18n="mapel.cancel">${this._t('mapel.cancel', 'Cancel')}</button>
                </div>
            </div>
            <ul class="mapel-list" aria-label="${this._t('panels.mapElements', 'Map Elements')}"></ul>
            <p class="mapel-idle" data-i18n="mapel.idle">${this._t('mapel.idle', 'Select a block of the picture and choose Edit > Find Map Element (Ctrl+F).')}</p>`;
        const q = (s) => panel.content.querySelector(s);
        this._els = { find: q('.mapel-find'), idle: q('.mapel-idle'), mode: q('.mapel-mode'), count: q('.mapel-count'), place: q('.mapel-place'), list: q('.mapel-list') };
        q('.mapel-prev').addEventListener('click', () => this.step(-1));
        q('.mapel-next').addEventListener('click', () => this.step(1));
        q('.mapel-accept').addEventListener('click', () => this.accept());
        q('.mapel-cancel').addEventListener('click', () => this.cancel());
        this._els.mode.addEventListener('change', () => this._search(this._els.mode.value));
        this._root.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this._session) { e.preventDefault(); e.stopPropagation(); this.cancel(); }
        });
        EventBus.on(EVENTS.MAP_ELEMENTS_CHANGED, () => this.renderList());
        EventBus.on(EVENTS.MAP_LOADED, () => this.renderList());
        EventBus.on(EVENTS.UI_LANGUAGE_CHANGE, () => this.renderList());
        this.renderList();
        EventBus.on(EVENTS.SCREEN_MODE_CHANGED, () => { this.renderList(); if (this._session) this.cancel(); });
        EventBus.on(EVENTS.FILE_NEW, () => { this.dismiss(); });
        EventBus.on(EVENTS.FILE_IMPORT, () => { this.dismiss(); });
        EventBus.on(EVENTS.PANEL_VISIBILITY_CHANGED, ({ id, visible }) => { if (id === this.ID && !visible) this.dismiss(); });
    }

    /** The element list: one row each, with Show (outline its places, centre on the next one) and Delete. */
    renderList() {
        if (!this._els) return;
        const ul = this._els.list;
        ul.textContent = '';
        MapService.elements.forEach((el, i) => {
            const li = document.createElement('li');
            li.className = 'mapel-item';
            const fits = MapService.elementFitsScreen(el);
            const label = document.createElement('span');
            label.className = 'mapel-item-label';
            label.textContent = this._t('mapel.item', '{name}: {w} x {h} cells', { name: el.name || ('#' + (i + 1)), w: el.w, h: el.h }) + ', ' +
                Helpers.localizedPlural('plural.mapelItemPlaces', el.positions.length, 'one: {n} place | other: {n} places');
            if (!fits) { li.classList.add('mapel-item-off'); li.title = this._t('mapel.noFit', 'This element belongs to another screen mode.'); }
            const show = document.createElement('button');
            show.type = 'button';
            show.className = 'panel-button mapel-show';
            show.textContent = this._t('mapel.show', 'Show');
            show.disabled = !fits;
            show.addEventListener('click', () => this.show(i));
            label.textContent = (el.number ? '#' + el.number + ' ' : '') + label.textContent;
            const del = document.createElement('button');
            del.type = 'button';
            del.className = 'panel-button mapel-delete';
            del.textContent = this._t('mapel.delete', 'Delete');
            del.addEventListener('click', () => this.remove(i));
            li.append(label, show, del);
            ul.appendChild(li);
        });
    }

    /** Outline all places of element `index`, and centre on the next one each time (so repeated clicks walk through them). */
    show(index) {
        const el = MapService.elements[index];
        if (!el || !MapService.elementFitsScreen(el)) return;
        this._shown = (this._shown && this._shown.index === index) ? { index, at: (this._shown.at + 1) % el.positions.length } : { index, at: 0 };
        MapElementOverlay.setHighlight({ places: el.positions, w: el.w, h: el.h, current: this._shown.at });
        const p = el.positions[this._shown.at];
        const cw = ZX_SPECTRUM.CELL_WIDTH, ch = ZX_SPECTRUM.CELL_HEIGHT;
        if (CanvasSystem.centreOn) CanvasSystem.centreOn((p.x + el.w / 2) * cw, (p.y + el.h / 2) * ch);
        // the selection goes to the place, as in ZX Paintbrush
        SelectionService.setSelection({ x: p.x * cw, y: p.y * ch, width: el.w * cw, height: el.h * ch });
        CanvasSystem.requestRender();
    }

    /** Delete an element after asking; the picture is not changed. */
    remove(index) {
        const el = MapService.elements[index];
        if (!el) return false;
        if (!confirm(this._t('mapel.confirmDelete', 'Delete {name}? The picture is not changed.', { name: el.name || ('#' + (index + 1)) }))) return false;
        MapService.removeElement(index);
        if (window.FileManager && FileManager.markModified) FileManager.markModified();
        this._shown = null;
        MapElementOverlay.setHighlight(null);
        this._notice('mapel.deleted', 'Element deleted.');
        return true;
    }

    /**
     * Put away whatever the panel is showing on the picture: an open find (cancelled) and the outlines Show left. Escape anywhere, hiding the panel, and
     * a new or opened picture all come here. @returns {boolean} true if there was something to put away
     */
    dismiss() {
        const had = !!this._session || !!this._shown;
        if (this._session) this.cancel();
        this._shown = null;
        if (window.MapElementOverlay) MapElementOverlay.setHighlight(null);
        return had;
    }

    /** True while a find is open. */
    get active() { return !!this._session; }

    /**
     * Why a find cannot start now, as [key, English] - or null if it can.
     */
    refusal() {
        if (!window.MapService || !MapService.findModes().length) {
            return ['mapel.badMode', 'Finding needs 8x8 colour cells: Standard, ULAplus, ULANext, GigaScreen or Timex hi-res.'];
        }
        if (SelectionService.isFloating()) return ['mapel.floating', 'Place or cancel the floating piece first.'];
        if (!SelectionService.hasSelection()) return ['mapel.noSelection', 'Select a block of the picture first.'];
        return null;
    }

    /** Edit > Find Map Element (Ctrl+F). Always answers: it either starts or says why not. */
    startFind() {
        if (this._session) this.cancel();
        const why = this.refusal();
        if (why) { this._notice(why[0], why[1]); return false; }
        const before = SelectionService.getSelection();
        FileManager.fitSelectionToCells();
        const sel = SelectionService.getSelection();
        const rect = MapService.blockAt(sel);
        if (!rect) { this._notice('mapel.noSelection', 'Select a block of the picture first.'); return false; }
        if (before && sel && (before.x !== sel.x || before.y !== sel.y || before.width !== sel.width || before.height !== sel.height)) {
            this._notice('mapel.fitted', 'The selection was fitted to whole cells.');
        }
        const screen = MapService.captureScreen();
        if (!screen) { this._notice('mapel.badMode', 'Finding needs 8x8 colour cells: Standard, ULAplus, ULANext, GigaScreen or Timex hi-res.'); return false; }
        const block = MapService.sliceBlock(screen, rect.x, rect.y, rect.w, rect.h);
        this._session = { block, source: { x: rect.x, y: rect.y }, rect, kept: [], current: 0, mode: null, found: null };

        PanelSection.setVisible(this.ID, true);
        if (PanelSection.isCollapsed(this.ID)) PanelSection.setCollapsed(this.ID, false);   // the find must be seen
        const modes = MapService.findModes();
        this._els.mode.textContent = '';
        for (const m of modes) {
            const o = document.createElement('option');
            o.value = m;
            o.dataset.i18n = 'mapel.mode.' + m;
            o.textContent = this._t('mapel.mode.' + m, { exact: 'Dots and colours', dots: 'Dots only', visual: 'Looks the same' }[m]);
            this._els.mode.appendChild(o);
        }
        this._els.mode.value = modes[0];
        this._els.find.hidden = false;
        this._els.idle.hidden = true;
        this._search(modes[0]);
        this._els.mode.focus();
        return true;
    }

    /** Run the search under a mode and show the result. @private */
    _search(mode) {
        const s = this._session;
        if (!s) return;
        const found = MapService.findElement(s.block, mode);
        if (!found) { this.cancel(); return; }
        const r = MapService.placesFrom(found.positions, s.block.w, s.block.h, s.source);
        s.mode = mode;
        s.found = r;
        s.kept = r.kept;
        s.current = 0;
        this._show();
    }

    /** @private */
    _show() {
        const s = this._session;
        const n = s.kept.length;
        let text = Helpers.localizedPlural('plural.mapelCount', n, 'one: {n} place found | other: {n} places found');
        if (s.found.covered || s.found.overlapping) {
            text += ' ' + this._t('mapel.left', '({covered} already covered and {overlapping} overlapping are left out)',
                { covered: s.found.covered, overlapping: s.found.overlapping });
        }
        this._els.count.textContent = text;
        const p = s.kept[s.current];
        this._els.place.textContent = p ? this._t('mapel.place', 'Place {i} of {n}: column {x}, row {y}',
            { i: s.current + 1, n, x: p.x + 1, y: p.y + 1 }) : '';
        MapElementOverlay.setHighlight({ places: s.kept, w: s.block.w, h: s.block.h, current: s.current });
    }

    /** Previous (-1) / Next (+1) place; the picture scrolls to it. */
    step(dir) {
        const s = this._session;
        if (!s || !s.kept.length) return;
        s.current = (s.current + dir + s.kept.length) % s.kept.length;
        this._show();
        const p = s.kept[s.current];
        const cw = ZX_SPECTRUM.CELL_WIDTH, ch = ZX_SPECTRUM.CELL_HEIGHT;
        if (CanvasSystem.centreOn) CanvasSystem.centreOn((p.x + s.block.w / 2) * cw, (p.y + s.block.h / 2) * ch);
    }

    /** Store the element and cover its places. */
    accept() {
        const s = this._session;
        if (!s) return false;
        // search once more on the picture as it is now (it may have changed since the find began)
        const screen = MapService.captureScreen();
        const found = screen ? MapService.findElement(s.block, s.mode, screen) : null;
        const r = found ? MapService.placesFrom(found.positions, s.block.w, s.block.h, s.source) : { kept: s.kept };
        const number = MapService.nextElementNumber();
        const res = MapService.addElement(s.block, r.kept, {
            match: s.mode, name: this._t('mapel.name', 'Element {n}', { n: number }),
            gridW: ZX_SPECTRUM.GRID_COLS, gridH: ZX_SPECTRUM.GRID_ROWS
        });
        if (!res.ok) {
            if (res.reason === 'tooBig') this._notice('mapel.tooBig', 'The map would be too big to keep with this element.');
            else this._notice('mapel.invalid', 'This element cannot be stored.');
            return false;
        }
        const places = r.kept.length;
        this._end();
        if (window.FileManager && FileManager.markModified) FileManager.markModified();   // the picture has new content to keep (autosave, unsaved-changes warning)
        this._notice('mapel.accepted', 'Element {n} stored with {places} places. Undo does not take it back; delete it in the Map Elements panel.',
            { n: MapService.elements[res.index].number, places });
        this._focusCanvas();
        return true;
    }

    cancel() {
        if (!this._session) return;
        this._end();
        this._focusCanvas();
    }

    /** @private */
    _end() {
        this._session = null;
        MapElementOverlay.setHighlight(null);
        if (this._els) { this._els.find.hidden = true; this._els.idle.hidden = false; }
    }

    /** After Accept or Cancel the keyboard goes back to the picture, so tool keys work again. @private */
    _focusCanvas() {
        const c = window.CanvasSystem && CanvasSystem.getCanvasElement ? CanvasSystem.getCanvasElement('main-canvas') : null;
        if (c && c.focus) c.focus({ preventScroll: true });
    }
}

window.MapElementsPanel = new MapElementsPanelClass();

})();
