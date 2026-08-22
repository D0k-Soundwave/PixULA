'use strict';
(function() {

/**
 * DrawModeBar — the GLOBAL draw-mode selector in the top colour bar, plus
 * the Mirror (symmetry-while-drawing) toggle group filed right beside it.
 *
 * Replaces the per-tool "Draw Mode" dropdown that used to live in the Brush
 * (and Shape / Fill) options. Draw mode is now one document-wide setting
 * (StateManager.getDrawMode / setDrawMode) that every direct drawing tool
 * resolves through PixelDrawRoutine.resolveUserMode. The bar is six
 * left-toolbar-style icon buttons; the active one renders from the
 * DRAW_MODE_CHANGED fact and the choice persists to Storage. Mirror is a
 * second, smaller icon-button group (own #mirror-modes host) that renders
 * from StateManager's symmetry mode the same way — see _buildMirrorControls.
 */
// value, icon, name key + English, hint key + English. The bar is a narrow
// horizontal strip, so these are icon-only buttons (2026-08-22) — the name and
// hint both ride in the tooltip (Helpers.composeTitle); the group as a whole
// is captioned once, by the "Drawing Modes" label in index.html, rather than
// each button separately.
//
// There is no Attributes Only entry: it did the same job as the Recolour
// attribute op two buttons to its left (both write the palette's ink, paper,
// bright and flash onto the cell under the pointer and touch no pixel — one
// as a global mode over every tool, one as its own paint mode), and two
// buttons for one job is a choice the artist has to make and cannot get right.
// Recolour is the one that names what it does. The DRAW_MODE.ATTRIBUTES_ONLY
// primitive stays — Recolour, Swap and TransformService all write through it.
const MODES = [
    ['normal',          'icon-dm-normal',     'dm.normal',         'Normal',
     'dm.normal.hint', 'Sets pixels and stamps the cell\'s ink, paper, bright and flash together'],
    ['ink',             'icon-dm-ink',        'dm.ink',            'Ink Recolour',
     'dm.ink.hint', 'Repaints the ink colour and flash of the cell under the pointer, without touching any pixel'],
    ['paper',           'icon-dm-paper',      'dm.paper',          'Paper Recolour',
     'dm.paper.hint', 'Repaints the paper colour and flash of the cell under the pointer, without touching any pixel'],
    ['pixel_only',      'icon-dm-pixels',     'dm.pixelsOnly',     'Pixels Only',
     'dm.pixelsOnly.hint', 'Sets or clears pixels without touching that cell\'s ink, paper, bright or flash'],
    ['xor',             'icon-dm-xor',        'dm.xor',            'XOR / Over',
     'dm.xor.hint', 'Toggles each pixel it touches, so overlapping strokes cancel each other out'],
    ['xor_pixel',       'icon-dm-xor-pixel',  'dm.xorPixel',       'XOR / Pixel',
     'dm.xorPixel.hint', 'Toggles every pixel on every pass, so a stroke crossing itself visibly cancels']
];

// Mirror (symmetry-while-drawing) toggle group: mode, icon, caption i18n key
// + English fallback. Exclusive like the modes above but NOT a radiogroup —
// clicking the active one turns symmetry off, so a plain toggle group (own
// #mirror-modes host, own aria-pressed buttons) is the honest semantics
// rather than folding it into #draw-modes' role="radiogroup".
const MIRROR_MODES = [
    ['h',    'icon-mirror-h',    'view.mirrorH',    'H'],
    ['v',    'icon-mirror-v',    'view.mirrorV',    'V'],
    ['quad', 'icon-mirror-quad', 'view.mirrorBoth', 'H+V']
];

class DrawModeBarClass {
    constructor() {
        this.STORAGE_KEY = 'drawMode';
        this._host = null;
        this._buttons = new Map();
        this._mirrorButtons = new Map();
    }

    /** English fallback until i18n resolves. @private */
    _t(key, fallback) {
        if (window.I18n && typeof I18n.t === 'function') {
            const v = I18n.t(key);
            if (v && v !== key) return v;
        }
        return fallback;
    }

    init() {
        this._host = document.getElementById('draw-modes');
        if (!this._host) {
            Logger.error('DrawModeBar', '#draw-modes host not found');
            return;
        }
        this._host.setAttribute('role', 'radiogroup');
        this._host.setAttribute('aria-label', this._t('opt.drawMode', 'Draw Mode'));
        this._host.dataset.i18nAriaLabel = 'opt.drawMode';

        for (const mode of MODES) {
            this._host.appendChild(this._buildButton(...mode));
        }

        EventBus.on(EVENTS.DRAW_MODE_CHANGED, ({ mode }) => {
            this._sync(mode);
            Storage.set(this.STORAGE_KEY, mode, Storage.STORES.PREFERENCES).catch(() => {});
        });

        // Two ways to work, chosen in Preferences. Left alone, the draw mode is
        // document-wide and survives a tool change, so an Attributes Only or XOR
        // pass can run across brush, fill and shapes. With
        // `resetDrawModeOnTool` on, picking a tool returns to Normal — the
        // safer setting for anyone who found a mode still in force hours later.
        this._lastTool = StateManager.getCurrentTool();
        EventBus.on(EVENTS.TOOL_SELECTED, ({ currentTool }) => {
            // Boot and re-selecting the SAME tool are not tool changes.
            if (currentTool === this._lastTool) return;
            this._lastTool = currentTool;
            if (StateManager.get('resetDrawModeOnTool') !== true) return;
            if (StateManager.getDrawMode() !== 'normal') StateManager.setDrawMode('normal');
        });

        this._sync(StateManager.getDrawMode());
        this._buildMirrorControls();
        Logger.info('DrawModeBar', 'Initialized');
    }

    /**
     * A bare "H" or "V" caption means nothing without the "Mirror" group it
     * belongs to — the bottom-bar strip this replaced said so with an
     * adjacent "Mirror:" label (canvas-controls.js, pre-2026-08-22), a
     * convention the top bar's one-keyword-per-icon captions don't otherwise
     * use. Composing the name INTO the tooltip/aria-label carries that
     * context with the button instead of depending on a neighbour, e.g.
     * "Mirror H".
     * @private
     */
    _mirrorName(mode) {
        const axis = MIRROR_MODES.find((m) => m[0] === mode);
        return `${this._t('view.mirror', 'Mirror')} ${this._t(axis[2], axis[3])}`;
    }

    /**
     * Mirror (symmetry drawing) toggles, filed next to the draw modes
     * (formerly beside the grid controls under the canvas — moved here
     * 2026-08-22 because it changes how every stroke lands, same as the
     * modes above, and belongs where the artist already looks for that).
     * Icon-only, like the draw modes beside them (2026-08-22) — the name and
     * hint (composed from view.mirror + the per-axis key) ride the tooltip,
     * re-rendered on a locale switch through their own UI_LANGUAGE_CHANGE
     * listener rather than the generic data-i18n walk, which only knows how
     * to look up ONE key per element.
     * @private
     */
    _buildMirrorControls() {
        const host = document.getElementById('mirror-modes');
        if (!host) return;

        for (const [mode, icon] of MIRROR_MODES) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'tool-btn';
            btn.id = `symmetry-${mode}-toggle`;
            const pressed = StateManager.getSymmetryMode() === mode;
            btn.setAttribute('aria-pressed', String(pressed));
            btn.classList.toggle('active', pressed);

            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.classList.add('tool-icon');
            svg.setAttribute('aria-hidden', 'true');
            const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
            use.setAttribute('href', `#${icon}`);
            svg.appendChild(use);
            btn.appendChild(svg);

            btn.addEventListener('click', () => {
                const next = StateManager.getSymmetryMode() === mode ? 'off' : mode;
                StateManager.setSymmetryMode(next);
            });

            host.appendChild(btn);

            this._mirrorButtons.set(mode, { btn });
        }

        this._refreshMirrorLabels();
        EventBus.on(EVENTS.UI_LANGUAGE_CHANGE, () => this._refreshMirrorLabels());

        EventBus.on(EVENTS.SYMMETRY_CHANGED, (data) => {
            for (const [mode, { btn }] of this._mirrorButtons) {
                const on = data.mode === mode;
                btn.setAttribute('aria-pressed', String(on));
                btn.classList.toggle('active', on);
            }
            Storage.set('symmetryMode', data.mode).catch(() => {});
        });
    }

    /** @private */
    _refreshMirrorLabels() {
        const hint = this._t('view.mirror.hint',
            'Mirror drawing across the canvas centre — every tool draws on both sides');
        for (const [mode, { btn }] of this._mirrorButtons) {
            const name = this._mirrorName(mode);
            btn.title = Helpers.composeTitle(name, hint);
            btn.setAttribute('aria-label', name);
        }
    }

    /** @private */
    _buildButton(value, icon, i18n, fallback, hintKey, hintFallback) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'tool-btn';
        btn.dataset.drawMode = value;
        const name = this._t(i18n, fallback);
        btn.dataset.i18nTitleName = i18n;
        btn.dataset.i18nTitle = hintKey;
        btn.title = Helpers.composeTitle(name, this._t(hintKey, hintFallback));
        btn.dataset.i18nAriaLabel = i18n;
        btn.setAttribute('aria-label', name);
        btn.setAttribute('role', 'radio');
        btn.setAttribute('aria-checked', 'false');

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.classList.add('tool-icon');
        svg.setAttribute('aria-hidden', 'true');
        const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
        use.setAttribute('href', `#${icon}`);
        svg.appendChild(use);

        btn.appendChild(svg);
        btn.addEventListener('click', () => StateManager.setDrawMode(value));

        this._buttons.set(value, btn);
        return btn;
    }

    /** @private */
    _sync(mode) {
        this._buttons.forEach((btn, value) => {
            const on = value === mode;
            btn.classList.toggle('active', on);
            btn.setAttribute('aria-checked', String(on));
        });
        this._syncStatus(mode);
    }

    /**
     * Say in the status bar which non-Normal mode is in force. Several modes
     * (Paper Recolour, Attributes Only) can leave a stroke with NOTHING visible
     * on the picture, and the mode persists across reloads — so without a
     * permanent readout the app looks broken rather than configured. Normal is
     * the quiet default and says nothing.
     * @private
     */
    _syncStatus(mode) {
        const el = document.getElementById('draw-mode-status');
        if (!el) return;
        const entry = MODES.find((m) => m[0] === mode);
        if (!entry || mode === 'normal') {
            el.hidden = true;
            el.textContent = '';
            delete el.dataset.i18nDrawMode;
            return;
        }
        // The label is recomposed on a locale change from this attribute, the
        // same way the screen-mode tooltips are (I18n._updateDOM).
        el.dataset.i18nDrawMode = mode;
        el.textContent = `${this._t('opt.drawMode', 'Draw Mode')}: ${this._t(entry[2], entry[3])}`;
        el.hidden = false;
    }

    /** Label for a draw-mode id — I18n re-renders the status readout with it. */
    describeMode(mode) {
        const entry = MODES.find((m) => m[0] === mode);
        return entry ? `${this._t('opt.drawMode', 'Draw Mode')}: ${this._t(entry[2], entry[3])}` : '';
    }
}

window.DrawModeBar = new DrawModeBarClass();

Logger.debug('DrawModeBar', 'Draw mode bar component loaded');

})(); // End IIFE
