'use strict';
(function() {

/**
 * CanvasControls — the strip under the canvas: zoom controls (generated from
 * ZOOM_CONFIG), grid toggles, and the cursor/cell position readout. Also owns
 * the canvas-view event plumbing that the old app.js carried inline
 * (_setupZoomControls, _setupCursorDisplay, pinch/wheel zoom + wheel pan).
 */
class CanvasControlsClass {
    constructor() {
        this._zoomSelect = null;
        this._gridButtons = {};
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
        this._setupStatusNotice();
        this._buildZoomControls();
        this._buildGridControls();
        this._setupCursorDisplay();
        this._setupCanvasViewEvents();
        this._setupModeStatus();

        Logger.info('CanvasControls', 'Initialized (zoom options from ZOOM_CONFIG)');
    }

    /**
     * Status-bar canvas-size readout (Phase 12a). Mode switching itself lives
     * only in Image > Screen Mode now — this used to also host a `<select>`
     * mirroring those radios, but two entry points for the same one
     * lossy-confirm path (MenuSystem.requestScreenMode) was redundant, and
     * removing it frees status-bar space. The readout still describes
     * whichever mode is active, via the SCREEN_MODE_CHANGED fact.
     * @private
     */
    _setupModeStatus() {
        const sizeEl = document.getElementById('canvas-size');
        if (!sizeEl || !window.ScreenModeService) {
            if (sizeEl) sizeEl.textContent = `${ZX_SPECTRUM.WIDTH} × ${ZX_SPECTRUM.HEIGHT}`;
            return;
        }

        const renderSize = () => {
            sizeEl.textContent = `${ZX_SPECTRUM.WIDTH} × ${ZX_SPECTRUM.HEIGHT} · ` +
                `${ZX_SPECTRUM.CELL_WIDTH}×${ZX_SPECTRUM.CELL_HEIGHT}`;
            sizeEl.dataset.i18nModeTitle = ScreenModeService.getModeId();
            sizeEl.title = Helpers.describeScreenMode(ScreenModeService.getMode());
        };
        renderSize();

        EventBus.on(EVENTS.SCREEN_MODE_CHANGED, renderSize);
    }

    // ── Zoom ─────────────────────────────────────────────────────────────────

    /**
     * Largest whole zoom level whose effective footprint fits the viewport.
     * The computation lives in CanvasSystem (it owns the viewport and the
     * device-pixel-aligned scale); this remains the UI-facing entry point.
     * @returns {number} Zoom percentage
     */
    fitZoom() {
        return CanvasSystem.fitZoom();
    }

    /** Apply the fit zoom (menu View -> Fit reuses this), and keep following
     *  it through frame resizes until another zoom is chosen. */
    applyFit() {
        CanvasSystem.zoomToFit();
    }

    /** Step zoom along ZOOM_CONFIG.LADDER (multiplicative stops). */
    stepZoom(direction) {
        const zoom = StateManager.getZoom() || ZOOM_CONFIG.DEFAULT;
        CanvasSystem.setZoom(ZOOM_CONFIG.step(zoom, direction));
    }

    /** @private */
    _buildZoomControls() {
        const host = document.getElementById('zoom-controls');
        if (!host) return;

        const zoomOut = document.createElement('button');
        zoomOut.type = 'button';
        zoomOut.id = 'zoom-out';
        zoomOut.dataset.i18nAriaLabel = 'view.zoomOut';
        zoomOut.dataset.i18nTitleName = 'view.zoomOut';
        zoomOut.dataset.i18nTitle = 'view.zoomOut.hint';
        zoomOut.dataset.shortcut = '-';
        zoomOut.setAttribute('aria-label', this._t('view.zoomOut', 'Zoom out'));
        zoomOut.title = Helpers.composeTitle(
            this._t('view.zoomOut', 'Zoom out'),
            this._t('view.zoomOut.hint', 'Steps down to the next zoom level'),
            '-'
        );
        zoomOut.textContent = '-';

        // Zoom options generated from ZOOM_CONFIG — the single zoom source.
        const select = document.createElement('select');
        select.id = 'zoom-level';
        select.name = 'zoom-level';
        select.dataset.i18nAriaLabel = 'view.zoomLevel';
        select.dataset.i18nTitleName = 'view.zoomLevel';
        select.dataset.i18nTitle = 'view.zoomLevel.hint';
        select.setAttribute('aria-label', this._t('view.zoomLevel', 'Zoom level'));
        select.title = Helpers.composeTitle(
            this._t('view.zoomLevel', 'Zoom level'),
            this._t('view.zoomLevel.hint', 'Jumps straight to a specific zoom percentage')
        );
        for (const z of ZOOM_CONFIG.LEVELS) {
            const opt = document.createElement('option');
            opt.value = String(z);
            opt.textContent = `${z}%`;
            if (z === ZOOM_CONFIG.DEFAULT) opt.selected = true;
            select.appendChild(opt);
        }

        const zoomIn = document.createElement('button');
        zoomIn.type = 'button';
        zoomIn.id = 'zoom-in';
        zoomIn.dataset.i18nAriaLabel = 'view.zoomIn';
        zoomIn.dataset.i18nTitleName = 'view.zoomIn';
        zoomIn.dataset.i18nTitle = 'view.zoomIn.hint';
        zoomIn.dataset.shortcut = '+';
        zoomIn.setAttribute('aria-label', this._t('view.zoomIn', 'Zoom in'));
        zoomIn.title = Helpers.composeTitle(
            this._t('view.zoomIn', 'Zoom in'),
            this._t('view.zoomIn.hint', 'Steps up to the next zoom level'),
            '+'
        );
        zoomIn.textContent = '+';

        const zoomFit = document.createElement('button');
        zoomFit.type = 'button';
        zoomFit.id = 'zoom-fit';
        zoomFit.dataset.i18nAriaLabel = 'view.fitToWindow';
        zoomFit.dataset.i18nTitleName = 'view.fitToWindow';
        zoomFit.dataset.i18nTitle = 'view.zoomFit.hint';
        zoomFit.setAttribute('aria-label', this._t('view.fitToWindow', 'Fit to window'));
        zoomFit.title = Helpers.composeTitle(
            this._t('view.fitToWindow', 'Fit to window'),
            this._t('view.zoomFit.hint', 'Scales the canvas to the largest zoom level that fits the window')
        );
        zoomFit.dataset.i18n = 'zoom.fit';
        zoomFit.textContent = this._t('zoom.fit', 'Fit');

        host.appendChild(zoomOut);
        host.appendChild(select);
        host.appendChild(zoomIn);
        host.appendChild(zoomFit);
        this._zoomSelect = select;

        zoomIn.addEventListener('click', () => this.stepZoom(1));
        zoomOut.addEventListener('click', () => this.stepZoom(-1));
        zoomFit.addEventListener('click', () => this.applyFit());
        select.addEventListener('change', (e) => {
            CanvasSystem.setZoom(parseInt(e.target.value, 10));
        });

        // Reflect zoom changes from any source (tools, pinch, wheel, fit).
        // Pinch can hold a zoom between LEVELS — show the nearest level
        // rather than leaving the select blank (selectedIndex -1).
        EventBus.on(EVENTS.CANVAS_ZOOM, (data) => {
            const zoomValue = String(ZOOM_CONFIG.snap(data.zoom));
            if (select.value !== zoomValue) select.value = zoomValue;
        });
        select.value = String(ZOOM_CONFIG.snap(StateManager.getZoom()));
    }

    // ── Grid toggles ─────────────────────────────────────────────────────────

    /** @private */
    _buildGridControls() {
        const host = document.getElementById('grid-controls');
        if (!host) return;

        // The translated word and the ':' live in separate nodes so a locale
        // re-apply (which rewrites the data-i18n span) can't eat the colon.
        const label = document.createElement('span');
        label.className = 'control-label';
        const labelText = document.createElement('span');
        labelText.dataset.i18n = 'view.grid';
        labelText.textContent = this._t('view.grid', 'Grid');
        label.appendChild(labelText);
        label.appendChild(document.createTextNode(':'));
        host.appendChild(label);

        // Labels read the live mode geometry at render time — the cell grid is
        // CELL_WIDTH×CELL_HEIGHT (cells are not square in multicolor modes);
        // the block grid is always 2×CELL_SIZE = 16×16 px (grid-overlay.js).
        const defs = [
            { id: 'grid-1x1-toggle',   label: () => '1x1',   key: 'pixel', toggle: () => GridOverlay.togglePixelGrid(),
              i18n: 'grid.pixelGrid', hint: 'grid.pixelGrid.hint' },
            { id: 'grid-8x8-toggle',   label: () => `${ZX_SPECTRUM.CELL_WIDTH}x${ZX_SPECTRUM.CELL_HEIGHT}`,
              key: 'cell',  toggle: () => GridOverlay.toggleCellGrid(),
              i18n: 'grid.cellGrid', hint: 'grid.cellGrid.hint' },
            { id: 'grid-16x16-toggle', label: () => '16x16', key: 'block', toggle: () => GridOverlay.toggleBlockGrid(),
              i18n: 'grid.blockGrid', hint: 'grid.blockGrid.hint' }
        ];

        for (const def of defs) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.id = def.id;
            btn.className = 'grid-toggle';
            btn.dataset.i18nTitleName = def.i18n;
            btn.dataset.i18nTitle = def.hint;
            btn.title = Helpers.composeTitle(this._t(def.i18n, def.id), this._t(def.hint, ''));
            btn.setAttribute('aria-pressed', 'false');
            btn.textContent = def.label();
            btn.addEventListener('click', def.toggle);
            host.appendChild(btn);
            this._gridButtons[def.key] = btn;
        }

        // Re-label on mode switches (ids stay fixed — tests and CSS key on them)
        EventBus.on(EVENTS.SCREEN_MODE_CHANGED, () => {
            for (const def of defs) {
                this._gridButtons[def.key].textContent = def.label();
            }
        });

        // Render pressed state from the visibility fact
        EventBus.on(EVENTS.GRID_VISIBILITY, (state) => {
            for (const [key, btn] of Object.entries(this._gridButtons)) {
                btn.setAttribute('aria-pressed', String(!!state[key]));
            }
        });

        // Grid snap toggle (also on Shift+S) — placement ops snap to cells
        const snapBtn = document.createElement('button');
        snapBtn.type = 'button';
        snapBtn.id = 'grid-snap-toggle';
        snapBtn.className = 'grid-toggle';
        snapBtn.dataset.i18n = 'view.snap';
        snapBtn.dataset.i18nTitleName = 'view.snap';
        snapBtn.dataset.i18nTitle = 'view.snap.hint';
        snapBtn.title = Helpers.composeTitle(
            this._t('view.snap', 'Snap'),
            this._t('view.snap.hint', 'Snap selection, shape and paste placement to the attribute grid (Shift+S)')
        );
        snapBtn.textContent = this._t('view.snap', 'Snap');
        snapBtn.setAttribute('aria-pressed', String(StateManager.getGridSnap()));
        snapBtn.addEventListener('click', () => {
            StateManager.setGridSnap(!StateManager.getGridSnap());
        });
        host.appendChild(snapBtn);

        // Render from the fact (click here, Shift+S, or boot restore) + persist
        EventBus.on(EVENTS.GRID_SNAP_CHANGED, (data) => {
            snapBtn.setAttribute('aria-pressed', String(!!data.snap));
            Storage.set('gridSnap', !!data.snap).catch(() => {});
        });
    }

    // ── Status notice ────────────────────────────────────────────────────────

    /**
     * EVENTS.STATUS_NOTICE shows a short reason in the status bar for a moment (a tool that
     * refused to run says why), then the usual text comes back. The duration is a reading
     * time [C]: the longest notice is about 8 words, at a comfortable ~4 words a second that
     * is 2 s, plus a second to notice it appeared.
     * @private
     */
    _setupStatusNotice() {
        const NOTICE_MS = 3000;
        let timer = null;
        EventBus.on(EVENTS.STATUS_NOTICE, ({ text }) => {
            const el = document.getElementById('status-message');
            if (!el || !text) return;
            el.textContent = text;
            if (window.A11yAnnouncer) A11yAnnouncer.announce(text);
            clearTimeout(timer);
            timer = setTimeout(() => {
                el.textContent = this._t('status.ready', 'Ready');
            }, NOTICE_MS);
        });
    }

    // ── Cursor position ──────────────────────────────────────────────────────

    /**
     * Throttled pointer readout (~30fps): X/Y and the cell, and, as the
     * Preferences ask, the attribute under the pointer and the Spectrum memory
     * addresses (PointerInfo has the arithmetic and the sources).
     * @private
     */
    _setupCursorDisplay() {
        const posEl = document.getElementById('cursor-position');
        const cellEl = document.getElementById('cell-position');
        const attrEl = document.getElementById('attr-readout');
        const addrEl = document.getElementById('addr-readout');

        let lastPosText = '';
        let lastCellText = '';
        let lastAttrText = '';
        let lastAddrText = '';
        let lastUpdate = 0;
        let lastPoint = null;
        /*
         * Cursor-position readout rate.
         *
         * [P] The common display refresh is 60 Hz, one frame every 16.7 ms.
         * [C] 32 ms is every second frame, ~31 updates a second. The readout is
         * a number being read, not an animation being watched: past about 30
         * changes a second the digits stop being legible and only cost layout,
         * and a pointer move can fire far more often than the display refreshes.
         */
        const THROTTLE_MS = 32;

        const msg = (key, fallback, params) => Helpers.localizedMessage(key, fallback, params);

        const show = (el, text, last) => {
            if (el && text !== last) el.textContent = text;
            return text;
        };

        const render = (data) => {
            const { detail, yDirection } = StateManager.getReadout();
            const mode = ACTIVE_SCREEN_MODE;
            const inside = Validators.isValidPixelCoord(data.x, data.y);

            let posText;
            if (yDirection === 'plot') {
                const plot = inside ? PointerInfo.plotY(mode, data.y) : null;
                posText = plot === null
                    ? msg('readout.plotNone', 'X: {x}, PLOT Y: -', { x: data.x })
                    : msg('readout.plot', 'X: {x}, PLOT Y: {y}', { x: data.x, y: plot });
            } else {
                posText = msg('readout.pos', 'X: {x}, Y: {y}', { x: data.x, y: data.y });
            }
            // Live cell geometry - differs per screen mode
            const cell = ZX_COORDS.pixelToCell(data.x, data.y);
            const cellText = msg('readout.cell', 'Cell: {x}, {y}', { x: cell.x, y: cell.y });
            lastPosText = show(posEl, posText, lastPosText);
            lastCellText = show(cellEl, cellText, lastCellText);

            lastAttrText = show(attrEl, detail !== 'position' && inside
                ? this._attributeText(mode, cell, msg) : '', lastAttrText);
            lastAddrText = show(addrEl, detail === 'addresses' && inside
                ? this._addressText(mode, data.x, data.y, msg) : '', lastAddrText);
        };

        const applyVisibility = () => {
            const { detail } = StateManager.getReadout();
            if (attrEl) attrEl.hidden = detail === 'position';
            if (addrEl) addrEl.hidden = detail !== 'addresses';
            // Redraw at once: the text must not wait for the next pointer move.
            lastPosText = lastCellText = lastAttrText = lastAddrText = '\u0000';
            if (lastPoint) render(lastPoint);
        };

        EventBus.on(EVENTS.INPUT_POINTER_MOVE, (data) => {
            const now = performance.now();
            if (now - lastUpdate < THROTTLE_MS) {
                lastPoint = { x: data.x, y: data.y };   // the trailing move is kept for a refresh
                return;
            }
            lastUpdate = now;
            lastPoint = { x: data.x, y: data.y };
            render(lastPoint);
        });
        EventBus.on(EVENTS.READOUT_CHANGED, applyVisibility);
        EventBus.on(EVENTS.UI_LANGUAGE_CHANGE, applyVisibility);
        EventBus.on(EVENTS.SCREEN_MODE_CHANGED, applyVisibility);
        applyVisibility();
    }

    /**
     * The attribute under the pointer, in words: the byte (decimal and hex) and
     * its parts. GigaScreen shows both screens. "No colour cells" where the
     * mode has none. @private
     */
    _attributeText(mode, cell, msg) {
        if (!ColorManager.hasCellAttributes()) {
            return msg('readout.noCells', 'No colour cells in this mode');
        }
        const one = (plane) => {
            const attrs = LayerManager.attrsShowing(cell.x, cell.y, plane);
            const byte = PointerInfo.attributeByte(mode, attrs);
            const parts = PointerInfo.attributeParts(mode, attrs);
            if (byte === null || !parts) return msg('readout.noCells', 'No colour cells in this mode');
            const base = { dec: byte, hex: PointerInfo.hex(byte, 2), ink: parts.ink, paper: parts.paper };
            if (parts.kind === 'clut') {
                return msg('readout.attrClut', 'Attribute {dec} ({hex}): CLUT {clut}, ink {ink}, paper {paper}',
                    { ...base, clut: parts.clut });
            }
            if (parts.kind === 'ulanext') {
                return msg('readout.attrNext', 'Attribute {dec} ({hex}): ink entry {ink}, paper entry {paper}', base);
            }
            return msg('readout.attrFixed',
                'Attribute {dec} ({hex}): ink {ink}, paper {paper}, bright {bright}, flash {flash}',
                { ...base, bright: parts.bright ? 1 : 0, flash: parts.flash ? 1 : 0 });
        };
        return ZX_SPECTRUM.SCREENS === 2 ? `A ${one(0)} | B ${one(1)}` : one(0);
    }

    /** The memory address of the pixel's byte and of its attribute byte. @private */
    _addressText(mode, x, y, msg) {
        const list = PointerInfo.addresses(mode, x, y);
        if (!list.length) return msg('readout.noAddr', 'No memory address in this mode');
        return list.map((a) => {
            const prefix = a.screen ? `${a.screen} ` : '';
            const params = { bitmap: PointerInfo.hex(a.bitmap), where: a.where };
            if (a.attr === null) return prefix + msg('readout.addrNoAttr', 'Byte {bitmap} ({where})', params);
            return prefix + msg('readout.addr', 'Byte {bitmap}, attribute {attr} ({where})',
                { ...params, attr: PointerInfo.hex(a.attr) });
        }).join(' | ');
    }

    // ── Canvas-view input facts (pinch/wheel come from the input layer) ─────

    /** @private */
    _setupCanvasViewEvents() {
        // (Pinch zoom no longer arrives as a fact: InputHandler drives
        // CanvasSystem.setZoomPreview/commitZoomPreview directly.)

        EventBus.on(EVENTS.INPUT_WHEEL_ZOOM, (data) => {
            // Anchored at the pointer: the canvas pixel under the cursor
            // stays put while the view scales around it.
            const zoom = StateManager.getZoom() || ZOOM_CONFIG.DEFAULT;
            const target = ZOOM_CONFIG.step(zoom, data.delta > 0 ? -1 : 1);
            CanvasSystem.zoomTo(target, data.x, data.y);
        });

        EventBus.on(EVENTS.INPUT_WHEEL_PAN, (data) => {
            CanvasSystem.pan(-data.deltaX, -data.deltaY);
        });
    }
}

window.CanvasControls = new CanvasControlsClass();

Logger.debug('CanvasControls', 'Canvas controls component loaded');

})(); // End IIFE
