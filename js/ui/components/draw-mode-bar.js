'use strict';
(function() {

/**
 * DrawModeBar — the GLOBAL draw-mode selector in the top colour bar.
 *
 * Replaces the per-tool "Draw Mode" dropdown that used to live in the Brush
 * (and Shape / Fill) options. Draw mode is now one document-wide setting
 * (StateManager.getDrawMode / setDrawMode) that every direct drawing tool
 * resolves through PixelDrawRoutine.resolveUserMode. The bar is five
 * left-toolbar-style icon buttons; the active one renders from the
 * DRAW_MODE_CHANGED fact and the choice persists to Storage.
 */
// value, icon, name key + English, caption key + English. The bar is a narrow
// horizontal strip, so the caption is an abbreviation and the full name rides
// in the tooltip (Helpers.composeTitle).
//
// There is no Attributes Only entry: it did the same job as the Recolour
// attribute op two buttons to its left (both write the palette's ink, paper,
// bright and flash onto the cell under the pointer and touch no pixel — one
// as a global mode over every tool, one as its own paint mode), and two
// buttons for one job is a choice the artist has to make and cannot get right.
// Recolour is the one that names what it does. The DRAW_MODE.ATTRIBUTES_ONLY
// primitive stays — Recolour, Swap and TransformService all write through it.
const MODES = [
    ['normal',          'icon-dm-normal',     'dm.normal',         'Normal',          'dm.normal',      'Normal',
     'dm.normal.hint', 'Sets pixels and stamps the cell\'s ink, paper, bright and flash together'],
    ['ink',             'icon-dm-ink',        'dm.ink',            'Ink Recolour',    'cap.dmInk',      'Ink RC',
     'dm.ink.hint', 'Repaints the ink colour and flash of the cell under the pointer, without touching any pixel'],
    ['paper',           'icon-dm-paper',      'dm.paper',          'Paper Recolour',  'cap.dmPaper',    'Paper RC',
     'dm.paper.hint', 'Repaints the paper colour and flash of the cell under the pointer, without touching any pixel'],
    ['pixel_only',      'icon-dm-pixels',     'dm.pixelsOnly',     'Pixels Only',     'cap.pixels',     'Pixels',
     'dm.pixelsOnly.hint', 'Sets or clears pixels without touching that cell\'s ink, paper, bright or flash'],
    ['xor',             'icon-dm-xor',        'dm.xor',            'XOR / Over',      'cap.xor',        'XOR',
     'dm.xor.hint', 'Toggles each pixel it touches, so overlapping strokes cancel each other out']
];

class DrawModeBarClass {
    constructor() {
        this.STORAGE_KEY = 'drawMode';
        this._host = null;
        this._buttons = new Map();
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
        Logger.info('DrawModeBar', 'Initialized');
    }

    /** @private */
    _buildButton(value, icon, i18n, fallback, capKey, capFallback, hintKey, hintFallback) {
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
        return Helpers.captionWrap(btn, capKey, capFallback);
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
