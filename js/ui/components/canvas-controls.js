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

    /** Apply the fit zoom (menu View -> Fit reuses this). */
    applyFit() {
        CanvasSystem.setZoom(this.fitZoom());
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
        select.setAttribute('aria-label', this._t('view.zoomLevel', 'Zoom level'));
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
            { id: 'grid-1x1-toggle',   label: () => '1x1',   key: 'pixel', toggle: () => GridOverlay.togglePixelGrid() },
            { id: 'grid-8x8-toggle',   label: () => `${ZX_SPECTRUM.CELL_WIDTH}x${ZX_SPECTRUM.CELL_HEIGHT}`,
              key: 'cell',  toggle: () => GridOverlay.toggleCellGrid() },
            { id: 'grid-16x16-toggle', label: () => '16x16', key: 'block', toggle: () => GridOverlay.toggleBlockGrid() }
        ];

        for (const def of defs) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.id = def.id;
            btn.className = 'grid-toggle';
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
        snapBtn.dataset.i18nTitle = 'view.snap.hint';
        snapBtn.title = this._t('view.snap.hint', 'Snap selection, shape and paste placement to the attribute grid (Shift+S)');
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

        this._buildSymmetryControls(host);
    }

    /**
     * Symmetry (mirror-while-drawing) toggle group. Modes are exclusive:
     * clicking the active mode turns symmetry off. Every tool inherits the
     * mode via the PixelDrawRoutine seam; the buttons only command
     * StateManager and render from the SYMMETRY_CHANGED fact.
     * @private
     */
    _buildSymmetryControls(host) {
        const label = document.createElement('span');
        label.className = 'control-label';
        const labelText = document.createElement('span');
        labelText.dataset.i18n = 'view.mirror';
        labelText.dataset.i18nTitle = 'view.mirror.hint';
        labelText.title = this._t('view.mirror.hint',
            'Mirror drawing across the canvas centre — every tool draws on both sides');
        labelText.textContent = this._t('view.mirror', 'Mirror');
        label.appendChild(labelText);
        label.appendChild(document.createTextNode(':'));
        host.appendChild(label);

        const defs = [
            { mode: 'h',    i18n: 'view.mirrorH',    fallback: 'H' },
            { mode: 'v',    i18n: 'view.mirrorV',    fallback: 'V' },
            { mode: 'quad', i18n: 'view.mirrorBoth', fallback: 'H+V' }
        ];

        const buttons = new Map();
        for (const def of defs) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.id = `symmetry-${def.mode}-toggle`;
            btn.className = 'grid-toggle';
            btn.dataset.i18n = def.i18n;
            btn.dataset.i18nTitle = 'view.mirror.hint';
            btn.title = this._t('view.mirror.hint',
                'Mirror drawing across the canvas centre — every tool draws on both sides');
            btn.textContent = this._t(def.i18n, def.fallback);
            btn.setAttribute('aria-pressed', String(StateManager.getSymmetryMode() === def.mode));
            btn.addEventListener('click', () => {
                const next = StateManager.getSymmetryMode() === def.mode ? 'off' : def.mode;
                StateManager.setSymmetryMode(next);
            });
            host.appendChild(btn);
            buttons.set(def.mode, btn);
        }

        // Render from the fact + persist under its own Storage key
        EventBus.on(EVENTS.SYMMETRY_CHANGED, (data) => {
            for (const [mode, btn] of buttons) {
                btn.setAttribute('aria-pressed', String(data.mode === mode));
            }
            Storage.set('symmetryMode', data.mode).catch(() => {});
        });
    }


    // ── Cursor position ──────────────────────────────────────────────────────

    /** Throttled cursor/cell position readout (~30fps). @private */
    _setupCursorDisplay() {
        const posEl = document.getElementById('cursor-position');
        const cellEl = document.getElementById('cell-position');

        let lastPosText = '';
        let lastCellText = '';
        let lastUpdate = 0;
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

        EventBus.on(EVENTS.INPUT_POINTER_MOVE, (data) => {
            const now = performance.now();
            if (now - lastUpdate < THROTTLE_MS) return;
            lastUpdate = now;

            const posText = `X: ${data.x}, Y: ${data.y}`;
            // Live cell geometry — differs per screen mode
            const cell = ZX_COORDS.pixelToCell(data.x, data.y);
            const cellText = `Cell: ${cell.x}, ${cell.y}`;

            if (posEl && posText !== lastPosText) {
                posEl.textContent = posText;
                lastPosText = posText;
            }
            if (cellEl && cellText !== lastCellText) {
                cellEl.textContent = cellText;
                lastCellText = cellText;
            }
        });
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
