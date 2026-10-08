'use strict';
(function() {

/**
 * DrawModeBar - the GLOBAL draw-mode selector in the top colour bar, plus
 * the Mirror (symmetry-while-drawing) toggle group at the end of the same row.
 *
 * Replaces the per-tool "Draw Mode" dropdown that used to live in the Brush
 * (and Shape / Fill) options. Draw mode is now one document-wide setting
 * (StateManager.getDrawMode / setDrawMode) that every direct drawing tool
 * resolves through PixelDrawRoutine.resolveUserMode. The bar is six
 * left-toolbar-style icon buttons; the active one renders from the
 * DRAW_MODE_CHANGED fact and the choice persists to Storage. Mirror is a
 * second, smaller icon-button group (own #mirror-modes host) that renders
 * from StateManager's symmetry mode the same way - see _buildMirrorControls.
 * The status bar readout (#draw-mode-status) is this component's too, and
 * also names a Swap or Recolour left switched on (ClutBar's cell operations).
 */

// What a mode does to the dots, to the cell's colours, and on the right
// button - the three facts artists asked about and the tooltips used to leave
// out. Shared phrases, so the manual's draw-mode table (describeModes) and the
// translations say the same thing the same way. [i18n key, English].
const FX = {
    dotsSet:        ['dm.fx.dotsSet', 'Sets them'],
    dotsFlipStroke: ['dm.fx.dotsFlipStroke', 'Flips each one once per stroke'],
    dotsFlipPass:   ['dm.fx.dotsFlipPass', 'Flips each one once per pass'],
    untouched:      ['dm.fx.untouched', 'Untouched'],
    coloursAll:     ['dm.fx.coloursAll', 'Ink, paper, bright and flash'],
    coloursInk:     ['dm.fx.coloursInk', 'Ink, bright and flash'],
    coloursPaper:   ['dm.fx.coloursPaper', 'Paper, bright and flash'],
    coloursNone:    ['dm.fx.coloursNone', 'None'],
    rightNormal:    ['dm.fx.rightNormal', 'Clears dots, sets the same colours'],
    rightPixels:    ['dm.fx.rightPixels', 'Clears dots, colours untouched'],
    rightSame:      ['dm.fx.rightSame', 'Same as the left button']
};

// One entry per button, in strip order. The bar is a narrow horizontal strip,
// so these are icon-only buttons (2026-08-22) - the name and hint both ride in
// the tooltip (Helpers.composeTitle); the group as a whole is captioned once,
// by the "Drawing Modes" label in index.html, rather than each button
// separately.
//
//   value  - StateManager's id. It is stored in preferences and workspace
//            presets, so it never changes: XOR / Every Pass is still
//            'xor_pixel', the id it had as XOR / Pixel.
//   icon   - the <symbol> in index.html
//   name, hint - [i18n key, English]
//   dots, colours, right - what it does, from FX above
//   needsAttributes - see below
//
// The order follows what a stroke changes (2026-10-07): the modes that set
// dots first, the two that only recolour last - next to the Swap and Recolour
// cell operations after the divider, which are the ones they get mistaken for.
//
// There is no Attributes Only entry: it did the same job as the Recolour
// attribute op (both write the palette's ink, paper, bright and flash onto the
// cell under the pointer and touch no pixel - one as a global mode over every
// tool, one as its own paint mode), and two buttons for one job is a choice
// the artist has to make and cannot get right. Recolour is the one that names
// what it does. The DRAW_MODE.ATTRIBUTES_ONLY primitive stays - Recolour, Swap
// and TransformService all write through it.
//
// A mode with `needsAttributes` acts on CELL ATTRIBUTES, so it means nothing
// in a screen mode whose cells have none - the indexed Next modes give every
// pixel its own palette index, and Timex hi-res shares one pair across the
// screen and ignores cell attributes at render. Offered there, Ink Recolour
// did exactly what Normal did and Paper Recolour painted the background index,
// while in Timex hi-res both wrote attributes nothing ever draws (2026-09-16).
// _syncAvailability hides them in those modes, exactly as ClutBar hides the
// Swap/Recolour attribute ops in the same ones and for the same reason.
const MODES = [
    { value: 'normal', icon: 'icon-dm-normal',
      name: ['dm.normal', 'Normal'],
      hint: ['dm.normal.hint', 'Sets dots and gives the cell your ink, paper, bright and flash. The right button clears dots and gives the cell the same colours'],
      dots: FX.dotsSet, colours: FX.coloursAll, right: FX.rightNormal },
    { value: 'pixel_only', icon: 'icon-dm-pixels',
      name: ['dm.pixelsOnly', 'Pixels Only'],
      hint: ['dm.pixelsOnly.hint', 'Sets dots and leaves the cell\'s colours alone. The right button clears dots, also leaving the colours alone'],
      dots: FX.dotsSet, colours: FX.coloursNone, right: FX.rightPixels },
    { value: 'xor', icon: 'icon-dm-xor',
      name: ['dm.xor', 'XOR / Over'],
      hint: ['dm.xor.hint', 'Flips each dot it touches, once per stroke, and gives the cell your colours. Two strokes over the same dots cancel each other out. Both buttons do the same'],
      dots: FX.dotsFlipStroke, colours: FX.coloursAll, right: FX.rightSame },
    { value: 'xor_pixel', icon: 'icon-dm-xor-pixel',
      name: ['dm.xorPixel', 'XOR / Every Pass'],
      hint: ['dm.xorPixel.hint', 'Like XOR / Over, but a stroke that comes back over its own path flips those dots again, so it cancels where it crosses itself. Both buttons do the same'],
      dots: FX.dotsFlipPass, colours: FX.coloursAll, right: FX.rightSame },
    { value: 'ink', icon: 'icon-dm-ink',
      name: ['dm.ink', 'Ink Recolour'],
      hint: ['dm.ink.hint', 'Gives every cell the tool touches your ink colour, bright and flash without touching a dot - following the brush size, the shape or the fill area. Both buttons do the same'],
      dots: FX.untouched, colours: FX.coloursInk, right: FX.rightSame,
      needsAttributes: true },
    { value: 'paper', icon: 'icon-dm-paper',
      name: ['dm.paper', 'Paper Recolour'],
      hint: ['dm.paper.hint', 'Gives every cell the tool touches your paper colour, bright and flash without touching a dot - following the brush size, the shape or the fill area. Both buttons do the same'],
      dots: FX.untouched, colours: FX.coloursPaper, right: FX.rightSame,
      needsAttributes: true }
];

// The status readout for a switched-on Swap or Recolour (ClutBar's cell
// operations, EVENTS.ATTR_PAINT_MODE). Carried in data-i18n-draw-mode with
// this prefix, so I18n re-renders it through describeMode like a draw mode.
const ATTR_OP_PREFIX = 'attr:';
const ATTR_OPS = {
    swap:  ['status.attrSwap', 'Swap is on'],
    apply: ['status.attrRecolour', 'Recolour is on']
};

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
        this._attrOp = null;   // 'swap' | 'apply' | null - ClutBar's cell operation, if on
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
            this._host.appendChild(this._buildButton(mode));
        }

        EventBus.on(EVENTS.DRAW_MODE_CHANGED, ({ mode }) => {
            this._sync(mode);
            // A mode can also arrive from a workspace preset or a restored
            // session, which never passed these buttons - so the same
            // availability rule is applied to whatever arrives, not only to
            // what a click sets. Terminates: the fallback is always available.
            this._syncAvailability();
            Storage.set(this.STORAGE_KEY, mode, Storage.STORES.PREFERENCES).catch(() => {});
        });

        // Two ways to work, chosen in Preferences. Left alone, the draw mode is
        // document-wide and survives a tool change, so a Pixels Only or XOR
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

        // Which modes mean anything depends on the screen mode's cells.
        EventBus.on(EVENTS.SCREEN_MODE_CHANGED, () => this._syncAvailability());

        // Swap or Recolour switched on takes over every tool, so for as long
        // as it is on the draw mode is not what a stroke does: the status bar
        // says which operation is on, and the chosen mode's button loses its
        // fill (css/components.css, #draw-modes.overridden).
        EventBus.on(EVENTS.ATTR_PAINT_MODE, ({ mode }) => {
            this._attrOp = ATTR_OPS[mode] ? mode : null;
            this._host.classList.toggle('overridden', !!this._attrOp);
            this._syncStatus(StateManager.getDrawMode());
        });

        this._syncAvailability();
        this._sync(StateManager.getDrawMode());
        this._buildMirrorControls();
        Logger.info('DrawModeBar', 'Initialized');
    }

    /**
     * Offer only the modes the active screen mode can actually carry out, and
     * leave Normal in force if the artist was standing in one that just became
     * meaningless (see the MODES table).
     *
     * Hidden with `visibility`, not `display`, and never removed: #color-bar's
     * width would otherwise depend on the screen mode, and ColorBarFit would
     * settle on a different scale for one mode than for another, visibly
     * resizing every icon in the strip on a mode switch. The same reason
     * ClutBar hides the attribute ops that way.
     * @private
     */
    _syncAvailability() {
        const hasAttributes = !window.ColorManager ||
            typeof ColorManager.hasCellAttributes !== 'function' ||
            ColorManager.hasCellAttributes();
        let activeLost = false;
        for (const { value, needsAttributes } of MODES) {
            const btn = this._buttons.get(value);
            if (!btn) continue;
            const available = hasAttributes || !needsAttributes;
            btn.style.visibility = available ? '' : 'hidden';
            btn.disabled = !available;
            btn.setAttribute('aria-hidden', String(!available));
            if (!available && StateManager.getDrawMode() === value) activeLost = true;
        }
        if (activeLost) StateManager.setDrawMode('normal');
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
            'Mirror drawing across the canvas centre - every tool draws on both sides');
        for (const [mode, { btn }] of this._mirrorButtons) {
            const name = this._mirrorName(mode);
            btn.title = Helpers.composeTitle(name, hint);
            btn.setAttribute('aria-label', name);
        }
    }

    /** @private */
    _buildButton({ value, icon, name: [nameKey, nameEn], hint: [hintKey, hintEn] }) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'tool-btn';
        btn.dataset.drawMode = value;
        const name = this._t(nameKey, nameEn);
        btn.dataset.i18nTitleName = nameKey;
        btn.dataset.i18nTitle = hintKey;
        btn.title = Helpers.composeTitle(name, this._t(hintKey, hintEn));
        btn.dataset.i18nAriaLabel = nameKey;
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
     * Say in the status bar what a stroke will do, whenever that is not the
     * quiet default. Several modes (Paper Recolour, Ink Recolour over cells
     * already that colour) can leave a stroke with NOTHING visible on the
     * picture, and the mode persists across reloads - so without a permanent
     * readout the app looks broken rather than configured. A switched-on Swap
     * or Recolour wins over the draw mode, because for as long as it is on it
     * is what every stroke does. Normal, with neither on, says nothing.
     * @private
     */
    _syncStatus(mode) {
        const el = document.getElementById('draw-mode-status');
        if (!el) return;
        const id = this._attrOp ? ATTR_OP_PREFIX + this._attrOp : mode;
        const label = id === 'normal' ? '' : this.describeMode(id);
        if (!label) {
            el.hidden = true;
            el.textContent = '';
            delete el.dataset.i18nDrawMode;
            return;
        }
        // The label is recomposed on a locale change from this attribute, the
        // same way the screen-mode tooltips are (I18n._updateDOM).
        el.dataset.i18nDrawMode = id;
        el.textContent = label;
        el.hidden = false;
    }

    /**
     * Label for a draw-mode id, or for a switched-on cell operation
     * ('attr:swap' / 'attr:apply') - I18n re-renders the status readout with it.
     * @param {string} id
     * @returns {string}
     */
    describeMode(id) {
        if (typeof id === 'string' && id.startsWith(ATTR_OP_PREFIX)) {
            const op = ATTR_OPS[id.slice(ATTR_OP_PREFIX.length)];
            return op ? this._t(op[0], op[1]) : '';
        }
        const entry = MODES.find((m) => m.value === id);
        return entry ? `${this._t('opt.drawMode', 'Draw Mode')}: ${this._t(...entry.name)}` : '';
    }

    /**
     * Every draw mode in strip order, in the current language - what the
     * manual's draw-mode table is built from (tools/manual-extract.js), so it
     * says what the buttons say and cannot drift from them.
     * @returns {Array<{id: string, name: string, desc: string, dots: string,
     *   colours: string, right: string}>}
     */
    describeModes() {
        return MODES.map((m) => ({
            id: m.value,
            name: this._t(...m.name),
            desc: this._t(...m.hint),
            dots: this._t(...m.dots),
            colours: this._t(...m.colours),
            right: this._t(...m.right)
        }));
    }
}

window.DrawModeBar = new DrawModeBarClass();

Logger.debug('DrawModeBar', 'Draw mode bar component loaded');

})(); // End IIFE
