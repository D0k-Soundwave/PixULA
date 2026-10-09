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
      hint: ['dm.ink.hint', 'Gives every cell the tool touches your ink colour, bright and flash without touching a dot - following the brush size, the shape or the fill area. Both buttons do the same. With Bright or Flash on "use existing", each cell keeps its own'],
      dots: FX.untouched, colours: FX.coloursInk, right: FX.rightSame,
      needsAttributes: true },
    { value: 'paper', icon: 'icon-dm-paper',
      name: ['dm.paper', 'Paper Recolour'],
      hint: ['dm.paper.hint', 'Gives every cell the tool touches your paper colour, bright and flash without touching a dot - following the brush size, the shape or the fill area. Both buttons do the same. With Bright or Flash on "use existing", each cell keeps its own'],
      dots: FX.untouched, colours: FX.coloursPaper, right: FX.rightSame,
      needsAttributes: true }
];

// The status readout for a switched-on Swap or Recolour (ClutBar's cell
// operations, EVENTS.ATTR_PAINT_MODE). Carried in data-i18n-draw-mode with
// this prefix, so I18n re-renders it through describeMode like a draw mode.
const ATTR_OP_PREFIX = 'attr:';
// Appended to a draw-mode id while Inverse is on ('pixel_only+inverse').
const INVERSE_SUFFIX = '+inverse';
// The draw modes that give both mouse buttons the same job: Inverse has nothing to swap in them.
const INVERSE_NO_EFFECT = ['ink', 'paper', 'xor', 'xor_pixel'];
const ATTR_OPS = {
    swap:  ['status.attrSwap', 'Swap is on'],
    apply: ['status.attrRecolour', 'Recolour is on'],
    copy: ['status.attrCopy', 'Copy colours is on'],
    invertDots: ['status.attrInvertDots', 'Invert dots is on'],
    invertBoth: ['status.attrInvertBoth', 'Invert dots and colours is on']
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
        this._drawSelector = null;
        this._mirrorSelector = null;
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
        // One button for the whole group: it shows the mode in force and opens a small grid of
        // the others (StripSelector). Strokes use this mode together with Mirror, whatever it is.
        this._drawSelector = new StripSelector({
            host: this._host,
            id: 'draw-mode-select',
            group: ['dm.group', 'Draw mode'],
            options: () => {
                const hasAttributes = !window.ColorManager || ColorManager.hasCellAttributes();
                return MODES.map((m) => ({
                    value: m.value, icon: m.icon, name: m.name, hint: m.hint,
                    available: hasAttributes || !m.needsAttributes,
                    domId: `draw-mode-${m.value}`, data: { drawMode: m.value }
                }));
            },
            current: () => StateManager.getDrawMode(),
            isActive: (v) => v !== 'normal',
            select: (v) => StateManager.setDrawMode(v),
            events: [EVENTS.DRAW_MODE_CHANGED]
        });

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
            if (this._drawSelector) this._drawSelector.refresh();
            this._syncStatus(StateManager.getDrawMode());
        });

        this._syncAvailability();
        this._sync(StateManager.getDrawMode());
        this._watchInverse();
        this._buildMirrorControls();
        Logger.info('DrawModeBar', 'Initialized');
    }

    /**
     * Leave Normal in force if the artist was standing in a mode the active screen mode makes
     * meaningless (see the MODES table). Which modes the pop-up OFFERS is decided when it opens
     * (the selector's options()), so there is nothing to hide here.
     * @private
     */
    _syncAvailability() {
        const hasAttributes = !window.ColorManager ||
            typeof ColorManager.hasCellAttributes !== 'function' ||
            ColorManager.hasCellAttributes();
        const entry = MODES.find((m) => m.value === StateManager.getDrawMode());
        if (entry && entry.needsAttributes && !hasAttributes) StateManager.setDrawMode('normal');
    }

    /**
     * Inverse (swap the mouse buttons) is switched in Preferences or with Shift+I, so
     * the strip has no button for it: this keeps what it changes - the choice is
     * remembered, and the status line names it while it is on, and says when it
     * changes nothing in the draw mode in force (Ink, Paper and XOR modes).
     * @private
     */
    _watchInverse() {
        EventBus.on(EVENTS.INVERSE_CHANGED, ({ inverse }) => {
            Storage.set('inverse', inverse, Storage.STORES.PREFERENCES).catch(() => {});
            this._syncStatus(StateManager.getDrawMode());
        });
        this._syncStatus(StateManager.getDrawMode());
    }

    /**
     * Mirror (symmetry-while-drawing): one button showing Off / Horizontal / Vertical / Both,
     * opening a small grid of the four. Independent of the draw mode: a stroke uses both.
     * The names read "Mirror H" and so on, so each icon says which group it belongs to wherever
     * its tooltip is seen.
     * @private
     */
    _buildMirrorControls() {
        const host = document.getElementById('mirror-modes');
        if (!host) return;
        const mirror = () => this._t('view.mirror', 'Mirror');
        const hint = ['view.mirror.hint', 'Mirror drawing across the canvas centre - every tool draws on both sides'];
        this._mirrorSelector = new StripSelector({
            host,
            id: 'mirror-select',
            group: ['view.mirror', 'Mirror'],
            options: () => [
                { value: 'off', icon: 'icon-mirror-off', domId: 'symmetry-off-toggle',
                  name: () => `${mirror()} ${this._t('common.off', 'Off')}`,
                  hint: ['view.mirrorOff.hint', 'Mirror drawing is off - strokes draw only where you draw'] },
                ...MIRROR_MODES.map(([mode, icon, key, en]) => ({
                    value: mode, icon, domId: `symmetry-${mode}-toggle`,
                    name: () => `${mirror()} ${this._t(key, en)}`, hint
                }))
            ],
            current: () => StateManager.getSymmetryMode(),
            isActive: (v) => v !== 'off',
            select: (v) => StateManager.setSymmetryMode(v),
            events: [EVENTS.SYMMETRY_CHANGED]
        });
        EventBus.on(EVENTS.SYMMETRY_CHANGED, (data) => {
            Storage.set('symmetryMode', data.mode).catch(() => {});
        });
    }

    /** @private */
    _sync(mode) {
        if (this._drawSelector) this._drawSelector.refresh();
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
        // A switched-on Swap or Recolour ignores the buttons' meaning, so Inverse is not named then.
        const inverse = StateManager.getInverse() && !this._attrOp;
        const id = (this._attrOp ? ATTR_OP_PREFIX + this._attrOp : mode) + (inverse ? INVERSE_SUFFIX : '');
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
        if (typeof id === 'string' && id.endsWith(INVERSE_SUFFIX)) {
            const base = id.slice(0, -INVERSE_SUFFIX.length);
            const baseLabel = base === 'normal' ? '' : this.describeMode(base);
            const inv = INVERSE_NO_EFFECT.includes(base)
                ? this._t('status.inverseNoEffect', 'Inverse is on (it changes nothing in this draw mode)')
                : this._t('status.inverseOn', 'Inverse is on');
            return baseLabel ? `${baseLabel}, ${inv}` : inv;
        }
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
