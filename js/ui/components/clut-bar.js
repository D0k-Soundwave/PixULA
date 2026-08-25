'use strict';
(function() {

/**
 * ClutBar — colour cluster + attribute operations, split across two chrome
 * regions since 2026-08-25 (docs/superpowers/specs/2026-08-25-colour-rail-
 * design.md): the palette swatches and the Bright/Flash bit toggles live in
 * the vertical #color-rail (between the tool rail and the canvas), while
 * Swap/Recolour (attr ops) stayed in the top #color-bar strip, inline with
 * the draw modes and Mirror. The DOM this class builds is layout-agnostic
 * either way — CSS re-flows it (a fixed 2-column swatch grid in the rail;
 * the bar's own horizontal row for the attr-ops buttons) rather than this
 * file knowing where any of it lives.
 *
 * The live Ink / Paper preview wells are NOT part of the cluster — they are a
 * single labelled block built once (`_buildPreviewBlock`) at the top of the
 * left tool rail (#color-preview); they read the current selection in every
 * screen mode, so the mode clusters below never build their own wells.
 *
 * The cluster REBUILDS on screen-mode changes and on BRIGHT/FLASH changes
 * (the bit toggles double as the shown palette bank).
 *
 *   fixed16 modes — the ink/paper split layout (stacked top-to-bottom in the
 *     rail, each an 8-swatch group in a fixed 2-column grid):
 *     8 ink colours · ink transparent box ·
 *     8 paper colours · paper transparent box ·
 *     Bright toggle · Flash toggle
 *       click an ink colour   -> set INK (clears ink-transparent)
 *       click a paper colour  -> set PAPER (clears paper-transparent)
 *       click a transparent box-> that channel keeps whatever is underneath
 *       Bright toggle          -> flips BOTH ink and paper to the bright bank
 *   GigaScreen additionally gets the sub-screen view toggle.
 *
 *   ulaplus64 mode — CLUT selector (0–3) + the active CLUT's ink half and
 *     paper half as separate single-role rows, one above the other.
 *   rgb333 (ULANext) — the classic normal/bright rows over the Next palette,
 *     stacked with a divider between them.
 *   timexMono — the 8 hi-res colour schemes. indexed Next — the palette
 *     index grid (picking is index-based; a 2-column grid up to 16 entries,
 *     a denser 4-column grid at 256).
 *
 *   attr ops -> Swap/Apply enter InputHandler attr paint modes (styled as
 *              left-toolbar tool buttons), still rendered in #color-bar.
 */
class ClutBarClass {
    constructor() {
        this._swatches = [];
        this._inkDisplay = null;
        this._paperDisplay = null;
        this._inkTransparentBox = null;
        this._paperTransparentBox = null;
        this._flashToggle = null;
        this._brightToggle = null;
        this._cluster = null;
        this._bitsHost = null;
        this._swatchHost = null;
        this._lastRightClickTime = 0;
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
        const colorHost = document.getElementById('toolbar-color');
        const attrHost = document.getElementById('attr-tools');
        const previewHost = document.getElementById('color-preview');
        if (!colorHost || !attrHost || !previewHost) {
            Logger.error('ClutBar', '#toolbar-color / #attr-tools / #color-preview not found');
            return;
        }

        this._bitsHost = document.getElementById('colour-bits');
        this._buildPreviewBlock(previewHost);
        this._buildColorCluster(colorHost);
        this._buildAttrOps(attrHost);
        this._attachColorEvents();
        this._updateColorDisplays();

        Logger.info('ClutBar', 'Initialized (swatches generated from palette)');
    }

    /**
     * The persistent Ink / Paper preview wells. These live at the top of the
     * left tool rail (not the top colour bar) and are built ONCE — the wells
     * read the live selection in every screen mode, so the mode clusters no
     * longer build their own. Each well carries a visible localised label.
     * Double-clicking a well toggles that channel's transparency.
     * @private
     */
    _buildPreviewBlock(host) {
        host.textContent = '';

        const makeWell = (i18n, fallback, id) => {
            const cell = document.createElement('div');
            cell.className = 'color-cell';
            const span = document.createElement('span');
            span.dataset.i18n = i18n;
            span.textContent = this._t(i18n, fallback);
            const well = document.createElement('div');
            well.id = id;
            well.className = 'color-swatch clut-preview';
            well.tabIndex = 0;
            well.setAttribute('role', 'button');
            well.setAttribute('aria-label', this._t(i18n, fallback));
            well.title = this._t(i18n, fallback);
            cell.appendChild(span);
            cell.appendChild(well);
            host.appendChild(cell);
            return well;
        };

        this._inkDisplay = makeWell('color.ink', 'Ink', 'ink-color');
        this._paperDisplay = makeWell('color.paper', 'Paper', 'paper-color');

        // Double-click a preview well toggles that channel's transparency.
        host.addEventListener('dblclick', (e) => {
            const well = e.target.closest('.clut-preview');
            if (!well) return;
            if (well.id === 'paper-color') ColorManager.togglePaperTransparent();
            else ColorManager.toggleInkTransparent();
            this._updateColorDisplays();
        });
    }

    // ── Colour cluster ───────────────────────────────────────────────────────

    /**
     * Caption a swatch group the way every other control in the bar is
     * captioned — Helpers.captionWrap, so Ink and Paper read in exactly the
     * same style, size and position as Bright, Flash, Swap and the draw
     * modes rather than in an inline style of their own.
     *
     * The caption is marked aria-hidden: the swatch radiogroup already
     * carries the same text as its aria-label, so a visible copy would
     * otherwise be announced twice.
     * @param {HTMLElement} el - the group the caption sits above
     * @returns {HTMLElement} the captioned wrapper
     * @private
     */
    _captionGroup(el, i18n, fallback) {
        const wrap = Helpers.captionWrap(el, i18n, fallback);
        wrap.firstChild.setAttribute('aria-hidden', 'true');
        return wrap;
    }

    /** @private */
    _buildColorCluster(host) {
        // One mode-dependent container, rebuilt on mode/bit changes. #toolbar-color
        // holds only this cluster — Bright/Flash are a sibling #colour-bits
        // section in the same #color-rail; Border is a separate #toolbar-attrs
        // section in the top #color-bar (css/components.css).
        this._cluster = document.createElement('div');
        this._cluster.id = 'clut-cluster';
        this._swatchHost = this._cluster;
        host.prepend(this._cluster);
        this._rebuildSwatches();
    }

    /**
     * (Re)build the mode-specific cluster.
     * @private
     */
    _rebuildSwatches() {
        const host = this._cluster;
        if (!host) return;
        host.textContent = '';
        this._swatches = [];
        // _inkDisplay / _paperDisplay are the persistent left-rail preview
        // wells (built once in _buildPreviewBlock) — never rebuilt here.
        this._inkTransparentBox = null;
        this._paperTransparentBox = null;
        this._flashToggle = null;
        this._brightToggle = null;

        const model = ACTIVE_SCREEN_MODE.paletteModel;
        const indexed = ZX_SPECTRUM.PIXEL_DEPTH > 1;

        // Bright/Flash and the GigaScreen view toggle are controls, not
        // colours, so they are rebuilt into the controls LINE (#colour-bits)
        // rather than into the palette cluster. Empty for modes that have
        // neither, and CSS hides an empty section so it costs no gap.
        const bits = this._bitsHost;
        if (bits) bits.textContent = '';

        // Every model lays its groups/rows out in one vertical stack (CSS keeps
        // #color-rail #clut-cluster a flex column, css/components.css) so the
        // rail's width stays constant across modes; wide palettes (the
        // 256-entry indexed grid) scroll vertically WITH the rail, never
        // sideways.

        // Attribute ops act on cell attributes — hidden where cells have none
        // (Timex hi-res ignores them; indexed Next modes don't have them).
        const attrHost = document.getElementById('attr-tools');
        if (attrHost) attrHost.style.display = (model === 'timexMono' || indexed) ? 'none' : '';

        if (model === 'timexMono') {
            host.appendChild(this._buildHiresSchemeRow());
            return;
        }

        // Indexed Next modes: one scrollable grid of the mode's palette window.
        if (indexed) {
            host.appendChild(this._buildIndexedGrid());
            return;
        }

        // ULANext: classic normal/bright rows over the Next palette.
        if (model === 'rgb333') {
            host.appendChild(this._buildClutRow('color-swatches-normal', 'clut.normalPalette',
                'Normal palette', 0, 8, 'both', false));
            host.appendChild(this._makeDivider());
            host.appendChild(this._buildClutRow('color-swatches-bright', 'clut.brightPalette',
                'Bright palette', 8, 16, 'both', true));
            return;
        }

        if (model === 'ulaplus64') {
            this._buildUlaplusCluster(host);
            return;
        }

        // fixed16 — the ink/paper split layout.
        this._buildClassicCluster(host, bits);
    }

    /**
     * fixed16: ink group · paper group on the palette line; Bright/Flash (and
     * the GigaScreen sub-screen view) on the controls line.
     * @private
     */
    _buildClassicCluster(host, bits) {
        host.appendChild(this._buildChannelGroup('ink'));
        host.appendChild(this._buildChannelGroup('paper'));
        if (!bits) return;
        bits.appendChild(this._buildBitToggles());
        if ((ACTIVE_SCREEN_MODE.screens || 1) === 2) {
            bits.appendChild(this._buildGigaViewRow());
        }
    }

    /**
     * One colour channel: 8 colour swatches · transparent box. The live
     * preview well now lives in the left-rail preview block (built once),
     * not per-mode here.
     * @param {'ink'|'paper'} channel
     * @private
     */
    _buildChannelGroup(channel) {
        const group = document.createElement('div');
        group.className = 'clut-channel';
        group.dataset.channel = channel;

        // Colour row (8 swatches at the current bright level)
        group.appendChild(this._buildChannelRow(channel));

        // Transparent / keep-existing box
        group.appendChild(this._buildTransparentBox(channel));

        // Visible Ink / Paper caption, centred above the swatches
        return this._captionGroup(group,
            channel === 'ink' ? 'color.ink' : 'color.paper',
            channel === 'ink' ? 'Ink' : 'Paper');
    }

    /**
     * The 8 selectable colours for a channel, shown at the active bright bank.
     * @param {'ink'|'paper'} channel
     * @private
     */
    _buildChannelRow(channel) {
        const row = document.createElement('div');
        row.className = 'clut-row';
        row.setAttribute('role', 'radiogroup');
        const labelKey = channel === 'ink' ? 'clut.inkColours' : 'clut.paperColours';
        const fallback = channel === 'ink' ? 'Ink colours' : 'Paper colours';
        row.setAttribute('aria-label', this._t(labelKey, fallback));
        row.dataset.i18nAriaLabel = labelKey;

        const brightOffset = ColorManager.getBright() ? 8 : 0;
        for (let base = 0; base < 8; base++) {
            const index = base + brightOffset;
            const sw = document.createElement('div');
            sw.className = 'color-swatch';
            sw.dataset.color = String(index);
            sw.dataset.base = String(base);
            sw.dataset.role = channel;
            sw.tabIndex = 0;
            sw.setAttribute('role', 'radio');
            sw.style.setProperty('background-color', `var(--zx-${index})`);
            row.appendChild(sw);
            this._swatches.push(sw);
        }
        return row;
    }

    /**
     * Transparent / "keep pre-existing" box at the end of a channel row.
     * Clicking it makes that channel keep whatever is underneath.
     * @param {'ink'|'paper'} channel
     * @private
     */
    _buildTransparentBox(channel) {
        const box = document.createElement('div');
        box.className = 'color-swatch clut-transparent-box transparent';
        box.dataset.role = channel === 'ink' ? 'transparent-ink' : 'transparent-paper';
        box.tabIndex = 0;
        box.setAttribute('role', 'radio');
        const label = channel === 'ink'
            ? this._t('clut.inkTransparent', 'Use existing Ink colour on page')
            : this._t('clut.paperTransparent', 'Use existing Paper colour on page');
        box.setAttribute('aria-label', label);
        box.dataset.i18nAriaLabel = channel === 'ink' ? 'clut.inkTransparent' : 'clut.paperTransparent';
        box.title = label;
        if (channel === 'ink') this._inkTransparentBox = box; else this._paperTransparentBox = box;
        return box;
    }

    /**
     * Bright + Flash bit toggles (button-style; colour denotes state). Bright
     * flips both ink and paper to the bright bank; Flash marks the cell as
     * flashing. Bound here (not in _attachColorEvents) because they are
     * recreated on every rebuild.
     * @private
     */
    _buildBitToggles() {
        const wrap = document.createElement('div');
        wrap.className = 'clut-bits';

        // Full-size icon toggles that sit inline with the swatch row. The native
        // checkbox stays for state + keyboard/AT (visually hidden); the icon
        // carries the meaning, captioned above like every other icon control.
        const makeToggle = (id, icon, i18n, fallback, checked, onChange) => {
            const label = document.createElement('label');
            label.className = 'flash-btn clut-bit';
            label.dataset.i18nTitle = i18n;
            label.title = this._t(i18n, fallback);

            const input = document.createElement('input');
            input.type = 'checkbox';
            input.id = id;
            input.name = id;
            input.checked = checked;

            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.classList.add('tool-icon');
            svg.setAttribute('aria-hidden', 'true');
            const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
            use.setAttribute('href', `#${icon}`);
            svg.appendChild(use);

            const sr = document.createElement('span');
            sr.className = 'sr-only';
            sr.dataset.i18n = i18n;
            sr.textContent = this._t(i18n, fallback);

            label.appendChild(input);
            label.appendChild(svg);
            label.appendChild(sr);
            input.addEventListener('change', () => onChange(input.checked));
            return { wrap: Helpers.captionWrap(label, i18n, fallback), input };
        };

        const bright = makeToggle('bright-toggle', 'icon-bright', 'color.bright', 'Bright',
            ColorManager.getBright(), (v) => ColorManager.setBright(v));
        this._brightToggle = bright.input;
        wrap.appendChild(bright.wrap);

        const flash = makeToggle('flash-toggle', 'icon-flash', 'color.flash', 'Flash',
            ColorManager.getFlash(), (v) => ColorManager.setFlash(v));
        this._flashToggle = flash.input;
        wrap.appendChild(flash.wrap);

        return wrap;
    }

    /**
     * ULAplus cluster: CLUT selector (0–3) + the active CLUT's ink half and
     * paper half + the ink/paper previews.
     * @private
     */
    _buildUlaplusCluster(host) {
        const selector = document.createElement('div');
        selector.id = 'clut-selector';
        selector.className = 'clut-row clut-selector';
        selector.setAttribute('role', 'radiogroup');
        selector.setAttribute('aria-label', this._t('clut.selector', 'ULAplus CLUT'));
        selector.dataset.i18nAriaLabel = 'clut.selector';
        const activeClut = ColorManager.getClut();
        for (let c = 0; c < 4; c++) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'panel-button small clut-select-btn';
            btn.textContent = String(c);
            btn.setAttribute('role', 'radio');
            btn.setAttribute('aria-checked', String(c === activeClut));
            btn.classList.toggle('active', c === activeClut);
            btn.title = this._t('clut.selectClut', 'Select CLUT {n}').replace('{n}', String(c));
            btn.addEventListener('click', () => ColorManager.setClut(c));
            selector.appendChild(btn);
        }
        host.appendChild(selector);

        const base = activeClut * 16;
        host.appendChild(this._buildClutRow('color-swatches-ink', 'clut.inkHalf',
            'Ink colours', base, base + 8, 'ink', false));
        host.appendChild(this._makeDivider());
        host.appendChild(this._buildClutRow('color-swatches-paper', 'clut.paperHalf',
            'Paper colours', base + 8, base + 16, 'paper', false));
    }

    /**
     * Timex hi-res: one radio row of the 8 colour schemes.
     * @private
     */
    _buildHiresSchemeRow() {
        const row = document.createElement('div');
        row.id = 'hires-scheme-row';
        row.className = 'clut-row';
        row.setAttribute('role', 'radiogroup');
        row.setAttribute('aria-label', this._t('clut.hiresScheme', 'Hi-res colour scheme'));
        row.dataset.i18nAriaLabel = 'clut.hiresScheme';

        const active = ColorManager.getTimexHiresInk();
        for (let n = 0; n < 8; n++) {
            const sw = document.createElement('div');
            sw.className = 'color-swatch';
            sw.dataset.scheme = String(n);
            sw.tabIndex = 0;
            sw.setAttribute('role', 'radio');
            sw.setAttribute('aria-checked', String(n === active));
            sw.classList.toggle('active-ink', n === active);
            sw.title = this._t('clut.hiresSchemePick', 'Ink {n} on its complement')
                .replace('{n}', String(n));
            sw.style.setProperty('background',
                `linear-gradient(135deg, var(--zx-scheme-ink-${n}) 50%, var(--zx-scheme-paper-${n}) 50%)`);
            sw.addEventListener('click', () => {
                ColorManager.setTimexHiresInk(n);
                LayerManager.composeToCanvas();
                this._rebuildSwatches();
                this._updateColorDisplays();
            });
            sw.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); sw.click(); }
            });
            row.appendChild(sw);
        }
        return row;
    }

    /**
     * Indexed Next modes: the palette window as one scrollable swatch grid.
     * Left-click = drawing index, right-click = background/erase index.
     * @private
     */
    _buildIndexedGrid() {
        const wrap = document.createElement('div');
        wrap.id = 'indexed-palette-grid';
        wrap.className = 'clut-row indexed-palette-grid';
        wrap.setAttribute('role', 'radiogroup');
        wrap.setAttribute('aria-label', this._t('clut.indexedPalette', 'Palette indices'));
        wrap.dataset.i18nAriaLabel = 'clut.indexedPalette';

        const n = ZX_SPECTRUM.PALETTE_SIZE;
        // Small palettes (<=16) fall into the rail's standard 2-column swatch
        // grid (css/components.css #color-rail .clut-row); large ones (256)
        // go dense — a narrower 4-column grid of smaller swatches, so the
        // rail scrolls a manageable distance instead of a very tall 2-wide
        // column (css/components.css #color-rail .indexed-palette-grid.
        // indexed-dense).
        if (n > 16) wrap.classList.add('indexed-dense');
        for (let i = 0; i < n; i++) {
            const sw = document.createElement('div');
            sw.className = 'color-swatch';
            sw.dataset.color = String(i);
            sw.dataset.index = String(i);
            sw.dataset.role = 'indexed';
            sw.tabIndex = 0;
            sw.setAttribute('role', 'radio');
            sw.title = String(i);
            sw.style.setProperty('background-color', `var(--zx-${i})`);
            wrap.appendChild(sw);
            this._swatches.push(sw);
        }
        return wrap;
    }

    /**
     * GigaScreen: Blend / A / B canvas-view toggle.
     * @private
     */
    _buildGigaViewRow() {
        const row = document.createElement('div');
        row.id = 'giga-view-row';
        row.className = 'clut-row clut-selector';
        row.setAttribute('role', 'radiogroup');
        row.setAttribute('aria-label', this._t('giga.view', 'GigaScreen view'));
        row.dataset.i18nAriaLabel = 'giga.view';

        const views = [
            ['blend', 'giga.viewBlend', 'Blend'],
            ['a', 'giga.viewA', 'A'],
            ['b', 'giga.viewB', 'B']
        ];
        const activeView = LayerManager.getGigaView();
        for (const [view, i18n, fallback] of views) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'panel-button small clut-select-btn';
            btn.dataset.gigaView = view;
            btn.dataset.i18n = i18n;
            btn.textContent = this._t(i18n, fallback);
            btn.setAttribute('role', 'radio');
            btn.setAttribute('aria-checked', String(view === activeView));
            btn.classList.toggle('active', view === activeView);
            btn.addEventListener('click', () => LayerManager.setGigaView(view));
            row.appendChild(btn);
        }
        return row;
    }

    /**
     * Only ever rendered inside #color-rail (between the ULAplus ink/paper
     * halves or the ULANext normal/bright rows), which lays it out as a
     * horizontal rule (`#color-rail .clut-divider`, css/components.css) —
     * hence the orientation below.
     * @private
     */
    _makeDivider() {
        const divider = document.createElement('div');
        divider.className = 'clut-divider';
        divider.setAttribute('role', 'separator');
        divider.setAttribute('aria-orientation', 'horizontal');
        return divider;
    }

    /**
     * @param {string} role - 'both' (rgb333 rows: ink on click, paper on
     *   right-click), 'ink' or 'paper' (ULAplus half-rows)
     * @param {boolean} bright - selects the bright bank
     * @returns {HTMLElement} the CAPTIONED wrapper around the swatch row
     * @private
     */
    _buildClutRow(id, i18nLabel, fallbackLabel, from, to, role, bright) {
        const row = document.createElement('div');
        row.id = id;
        row.className = 'clut-row';
        row.setAttribute('role', 'radiogroup');
        row.setAttribute('aria-label', this._t(i18nLabel, fallbackLabel));
        row.dataset.i18nAriaLabel = i18nLabel;

        for (let i = from; i < to; i++) {
            const sw = document.createElement('div');
            sw.className = 'color-swatch';
            sw.dataset.color = String(i);
            sw.dataset.base = String(i - from);
            sw.dataset.role = role;
            sw.dataset.bright = bright ? '1' : '';
            sw.tabIndex = 0;
            sw.setAttribute('role', 'radio');
            sw.style.setProperty('background-color', `var(--zx-${i})`);
            row.appendChild(sw);
            this._swatches.push(sw);
        }
        // Visible heading matching the radiogroup's aria-label, captioned
        // above the row like every other control in the bar.
        return this._captionGroup(row, i18nLabel, fallbackLabel);
    }

    /** Delegated swatch interactions — survive rebuilds. @private */
    _attachColorEvents() {
        const swatchOf = (e) => e.target.closest('.color-swatch[data-role], .color-swatch[data-color]');

        this._cluster.addEventListener('click', (e) => {
            const sw = swatchOf(e);
            if (!sw) return;
            const role = sw.dataset.role;
            if (role === 'transparent-ink') {
                ColorManager.setInkTransparent(true);
                this._updateColorDisplays();
                return;
            }
            if (role === 'transparent-paper') {
                ColorManager.setPaperTransparent(true);
                this._updateColorDisplays();
                return;
            }
            if (role === 'indexed') {
                ColorManager.setNextInk(parseInt(sw.dataset.index, 10));
                this._updateColorDisplays();
                return;
            }
            const base = parseInt(sw.dataset.base, 10);
            if (role === 'paper') {
                ColorManager.setPaper(base);
            } else {
                ColorManager.setInk(base);
                if (role === 'both') ColorManager.setBright(sw.dataset.bright === '1');
            }
            this._updateColorDisplays();
        });

        this._cluster.addEventListener('contextmenu', (e) => {
            const sw = swatchOf(e);
            if (!sw) return;
            e.preventDefault();
            const role = sw.dataset.role;
            if (role === 'indexed') {
                ColorManager.setNextPaper(parseInt(sw.dataset.index, 10));
                this._updateColorDisplays();
                return;
            }
            // In the split layout ink/paper each have their own row; right-click
            // on a paper swatch still sets paper (harmless), ink returns.
            if (role === 'ink' || role === 'transparent-ink') return;
            if (role === 'transparent-paper') {
                ColorManager.setPaperTransparent(true);
                this._updateColorDisplays();
                return;
            }
            const now = Date.now();
            if (now - this._lastRightClickTime < 400) {
                ColorManager.togglePaperTransparent();
                this._updateColorDisplays();
                this._lastRightClickTime = 0;
                return;
            }
            this._lastRightClickTime = now;

            ColorManager.setPaper(parseInt(sw.dataset.base, 10));
            if (role === 'both') ColorManager.setBright(sw.dataset.bright === '1');
            this._updateColorDisplays();
        });

        this._cluster.addEventListener('keydown', (e) => {
            const sw = swatchOf(e);
            if (!sw) return;
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                sw.click();
            }
        });

        // Render from colour facts (external changes: eyedropper, undo, io)
        EventBus.on(EVENTS.COLOR_INK,    () => this._updateColorDisplays());
        EventBus.on(EVENTS.COLOR_PAPER,  () => this._updateColorDisplays());
        EventBus.on(EVENTS.COLOR_BRIGHT, () => this._onClutBitsChanged());
        EventBus.on(EVENTS.COLOR_FLASH,  () => this._onClutBitsChanged());

        // Mode switch swaps the whole cluster layout
        EventBus.on(EVENTS.SCREEN_MODE_CHANGED, () => {
            this._rebuildSwatches();
            this._updateColorDisplays();
            this._translateRebuilt();
        });

        // GigaScreen view fact -> radio states (view may change elsewhere)
        EventBus.on(EVENTS.GIGA_VIEW_CHANGED, ({ view }) => {
            this._bitsHost.querySelectorAll('[data-giga-view]').forEach((btn) => {
                const on = btn.dataset.gigaView === view;
                btn.classList.toggle('active', on);
                btn.setAttribute('aria-checked', String(on));
            });
        });
    }

    /**
     * Re-translate everything _rebuildSwatches just built. Both hosts, because
     * the palette line and the controls line are rebuilt together but live in
     * different parts of the bar.
     * @private
     */
    _translateRebuilt() {
        if (!window.I18n || typeof I18n.apply !== 'function') return;
        I18n.apply(this._cluster);
        if (this._bitsHost) I18n.apply(this._bitsHost);
    }

    /**
     * BRIGHT/FLASH changed — the shown palette bank (bright) and the CLUT
     * (ulaplus) depend on these bits, so rebuild the cluster.
     * @private
     */
    _onClutBitsChanged() {
        this._rebuildSwatches();
        this._translateRebuilt();
        this._updateColorDisplays();
    }

    /** Sync wells + active swatch rings to ColorManager state. @private */
    _updateColorDisplays() {
        const inkTransparent = ColorManager.isInkTransparent();
        const paperTransparent = ColorManager.isPaperTransparent();

        if (this._inkDisplay) {
            this._inkDisplay.classList.toggle('transparent', inkTransparent);
            if (inkTransparent) {
                this._inkDisplay.style.removeProperty('background-color');
            } else {
                this._inkDisplay.style.setProperty('background-color', `var(--zx-${ColorManager.getInkColorIndex()})`);
            }
        }
        if (this._paperDisplay) {
            this._paperDisplay.classList.toggle('transparent', paperTransparent);
            if (paperTransparent) {
                this._paperDisplay.style.removeProperty('background-color');
            } else {
                this._paperDisplay.style.setProperty('background-color', `var(--zx-${ColorManager.getPaperColorIndex()})`);
            }
        }

        // ink/paper single-role rows show one bright bank at a time and match
        // by BASE index (bright-black resolves to palette index 0, so a
        // palette-index match would miss the bright-bank swatch). The 'both'
        // and indexed grids show every colour, so they match by palette index.
        const inkBase = ColorManager.getInk();
        const paperBase = ColorManager.getPaper();
        const inkIndex = ColorManager.getInkColorIndex();
        const paperIndex = ColorManager.getPaperColorIndex();
        this._swatches.forEach((swatch) => {
            const role = swatch.dataset.role;
            let inkActive = false;
            let paperActive = false;
            if (role === 'ink') {
                inkActive = !inkTransparent && parseInt(swatch.dataset.base, 10) === inkBase;
            } else if (role === 'paper') {
                paperActive = !paperTransparent && parseInt(swatch.dataset.base, 10) === paperBase;
            } else if (role === 'both' || role === 'indexed') {
                const colorIndex = parseInt(swatch.dataset.color, 10);
                inkActive = !inkTransparent && colorIndex === inkIndex;
                paperActive = !paperTransparent && colorIndex === paperIndex;
            }
            swatch.classList.toggle('active-ink', inkActive);
            swatch.classList.toggle('active-paper', paperActive);
        });

        if (this._inkTransparentBox) {
            this._inkTransparentBox.classList.toggle('active-ink', inkTransparent);
            this._inkTransparentBox.setAttribute('aria-checked', String(inkTransparent));
        }
        if (this._paperTransparentBox) {
            this._paperTransparentBox.classList.toggle('active-paper', paperTransparent);
            this._paperTransparentBox.setAttribute('aria-checked', String(paperTransparent));
        }
    }

    // ── Attribute operations ─────────────────────────────────────────────────

    /** @private */
    _buildAttrOps(host) {
        // Swap/Apply styled as left-toolbar tool buttons: icon-only, like the
        // draw modes and Mirror toggles they sit inline with (2026-08-22) —
        // the name and hint ride the tooltip; the whole run is captioned once
        // by the "Drawing Modes" label in index.html.
        const mkToolBtn = (id, icon, i18n, fallback, hintI18n, hint) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.id = id;
            btn.className = 'tool-btn';
            const name = this._t(i18n, fallback);
            btn.dataset.i18nTitle = hintI18n;
            btn.dataset.i18nTitleName = i18n;
            btn.title = Helpers.composeTitle(name, this._t(hintI18n, hint));
            btn.dataset.i18nAriaLabel = i18n;
            btn.setAttribute('aria-label', name);
            btn.setAttribute('aria-pressed', 'false');

            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.classList.add('tool-icon');
            svg.setAttribute('aria-hidden', 'true');
            const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
            use.setAttribute('href', `#${icon}`);
            svg.appendChild(use);

            btn.appendChild(svg);
            return btn;
        };

        const transposeBtn = mkToolBtn('attr-transpose', 'icon-attr-swap',
            'attr.transpose', 'Swap',
            'attr.transpose.hint',
            'Switch between Ink and Paper colour');
        const applyBtn = mkToolBtn('attr-apply', 'icon-attr-apply',
            'attr.apply', 'Recolour',
            'attr.apply.hint',
            'Change attributes to colours selected in palette');

        host.appendChild(transposeBtn);
        host.appendChild(applyBtn);

        // Swap/Apply are interactive paint modes owned by the input handler.
        const toggleAttrMode = (mode) => {
            if (!window.InputHandler) return;
            if (InputHandler._attrPaintMode === mode) {
                InputHandler.exitAttrPaintMode();
            } else {
                InputHandler.enterAttrPaintMode(mode);
            }
        };
        transposeBtn.addEventListener('click', () => toggleAttrMode('swap'));
        applyBtn.addEventListener('click', () => toggleAttrMode('apply'));

        // Render engaged state from the mode fact
        EventBus.on(EVENTS.ATTR_PAINT_MODE, ({ mode }) => {
            const swapOn  = mode === 'swap';
            const applyOn = mode === 'apply';
            transposeBtn.classList.toggle('active', swapOn);
            transposeBtn.setAttribute('aria-pressed', String(swapOn));
            applyBtn.classList.toggle('active', applyOn);
            applyBtn.setAttribute('aria-pressed', String(applyOn));
            host.classList.toggle('attr-mode-active', swapOn || applyOn);
        });
    }
}

window.ClutBar = new ClutBarClass();

Logger.debug('ClutBar', 'CLUT bar component loaded');

})(); // End IIFE
