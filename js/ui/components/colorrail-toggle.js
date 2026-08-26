'use strict';
(function() {

/**
 * ColorRailToggle — the folder-style tab that collapses the vertical colour
 * rail into the left toolbar and expands it back out.
 *
 * This is chrome state, not document or tool state — like a panel section's
 * collapsed flag (PanelSection), not like anything ColorManager owns — so it
 * lives entirely as a class on #app (css/layout.css: .colorrail-collapsed
 * slides the floating #color-rail off-screen behind the toolbar) plus its
 * own Storage key, persisted the same way gridSnap/touchDrawing are. The
 * rail itself is an overlay positioned on top of the canvas, not a grid
 * column, specifically so collapsing or expanding it never changes any
 * column's width — see the layout.css comment on #app for why that
 * mattered (a fixed rail column could push #panels off-screen on a narrow
 * window).
 */
class ColorRailToggleClass {
    constructor() {
        this._button = null;
        this._collapsed = false;
    }

    /** English fallback until i18n resolves. @private */
    _t(key, fallback) {
        if (window.I18n && typeof I18n.t === 'function') {
            const v = I18n.t(key);
            if (v && v !== key) return v;
        }
        return fallback;
    }

    async init() {
        this._button = document.getElementById('color-rail-toggle');
        if (!this._button) {
            Logger.error('ColorRailToggle', '#color-rail-toggle not found');
            return;
        }

        this._button.addEventListener('click', () => this.setCollapsed(!this._collapsed));

        let stored = false;
        try {
            stored = await Storage.get('colorrailCollapsed');
        } catch (error) {
            Logger.warn('ColorRailToggle', 'Failed to load colorrailCollapsed', error);
        }
        this._apply(!!stored);

        Logger.debug('ColorRailToggle', 'Colour rail toggle initialized');
    }

    isCollapsed() {
        return this._collapsed;
    }

    setCollapsed(collapsed) {
        this._apply(!!collapsed);
        Storage.set('colorrailCollapsed', this._collapsed).catch(() => {});
    }

    /** @private */
    _apply(collapsed) {
        this._collapsed = collapsed;

        const app = document.getElementById('app');
        if (app) app.classList.toggle('colorrail-collapsed', collapsed);

        const nameKey = collapsed ? 'clut.railExpand' : 'clut.railCollapse';
        const nameFallback = collapsed ? 'Expand colour rail' : 'Collapse colour rail';
        const name = this._t(nameKey, nameFallback);
        const hint = this._t('clut.railToggleHint',
            'The colour rail can be hidden to give the canvas more room.');

        this._button.setAttribute('aria-expanded', String(!collapsed));
        // Two-stage tooltip, like every other rail control (Helpers.composeTitle
        // / TooltipManager): the name (what clicking it does right now) tags on
        // a short hover, the hint (what the control is, which does not change
        // with state) grows underneath on a longer one.
        this._button.dataset.i18nTitleName = nameKey;
        this._button.dataset.i18nTitle = 'clut.railToggleHint';
        this._button.dataset.i18nAriaLabel = nameKey;
        this._button.title = Helpers.composeTitle(name, hint);
        this._button.setAttribute('aria-label', name);

        EventBus.emit(EVENTS.COLORRAIL_COLLAPSE_CHANGED, { collapsed });
    }
}

window.ColorRailToggle = new ColorRailToggleClass();

Logger.debug('ColorRailToggle', 'Colour rail toggle component loaded');

})(); // End IIFE
