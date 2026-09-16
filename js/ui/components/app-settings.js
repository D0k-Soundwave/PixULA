'use strict';
(function() {

/**
 * AppSettings — header controls: language and interface (UI) scale.
 *
 * Extracted from the old app.js (_setupLanguageSelector, _setupFontScale).
 * Language delegates to I18n when it lands (Phase 6); until then the
 * selector applies what it can locally (persisted for Phase 6 pickup). Theme
 * has its own picker, ThemeManager, reached only via Settings > Theme — no
 * header control (removed 2026-08-21; it was a plain duplicate of the menu).
 *
 * The UI scale sets --ui-scale on :root, which `zoom`-scales every chrome
 * region (and multiplies the #app grid tracks) so the whole interface scales
 * together. The drawing canvas is excluded by design. Ctrl/⌘+wheel over the
 * chrome steps through the selector's presets.
 *
 * The selector holds what the artist CHOSE; --ui-scale holds what is APPLIED,
 * and on a touch-primary screen too small for the one layout the two differ:
 * UiFit (js/utils/ui-fit.js) shrinks the applied scale until the picture and
 * the tool rail fit, never below its 44px touch floor and never above the
 * choice. The choice is what gets stored, so turning a tablet or moving to a
 * bigger screen gives the artist their own size back.
 */
class AppSettingsClass {
    constructor() {
        this.SCALE_KEY = 'uiFontScale';
        /** The selector value that means "let UiFit decide" - the default. */
        this.FIT = 'fit';
        /** What the artist chose (the selector / Storage value). */
        this._userScale = 1;
        /**
         * True while the artist has asked for "Fit to screen" rather than a
         * size of their own.
         *
         * The fit used to apply on top of EVERY choice, which made the whole
         * control dead on a tablet: the fitted value there is around 0.84,
         * below even the smallest size the list offered, so all five entries
         * applied the same scale (M, 2026-09-16, the harness's Chrome at
         * 1024x768 with touch). Fitting is now one entry in the list, and a
         * size the artist picks is applied exactly - if it does not fit, the
         * rail and the panels scroll, which is the artist's business.
         */
        this._autoFit = true;
        /** What is on --ui-scale right now; null until first applied. */
        this._appliedScale = null;
        /** (hover: none) and (pointer: coarse) - see UiFit. */
        this._touchQuery = null;
    }

    init() {
        this._setupLanguageSelector();
        this._setupUiScale();
        Logger.info('AppSettings', 'Initialized');
    }

    /**
     * I18n.init() always runs before AppSettings.init() (app.js _initUI), so
     * there is no pre-I18n state for this selector to handle.
     * @private
     */
    _setupLanguageSelector() {
        const langSelector = document.getElementById('language-selector');
        if (!langSelector) return;

        langSelector.value = I18n.getLocale();
        langSelector.addEventListener('change', () => {
            I18n.setLocale(langSelector.value);
        });
        EventBus.on(EVENTS.UI_LANGUAGE_CHANGE, ({ locale }) => {
            if (langSelector.value !== locale) langSelector.value = locale;
        });
    }

    /** @private */
    _setupUiScale() {
        const sel = document.getElementById('font-scale-selector');
        const root = document.documentElement;

        // Ctrl/⌘ + wheel steps through THESE, below, so it is also the
        // source of truth for what a restored value must be clamped against
        // - a value stored before a preset was removed (300%/250%, retired
        // 2026-08-10: two rows was not reliably achievable above 200%,
        // see js/ui/components/colorbar-fit.js) must not apply a scale the
        // selector can no longer even show as selected.
        const presets = () => Array.from(sel.options)
            .map((o) => parseFloat(o.value))
            .filter((n) => n > 0)
            .sort((a, b) => a - b);

        const apply = (scale) => {
            if (String(scale) === this.FIT) {
                this._autoFit = true;
                this.refitScale();
                return this.FIT;
            }
            let n = parseFloat(scale);
            if (!(n > 0)) return this._autoFit ? this.FIT : this._userScale;
            if (sel) {
                const values = presets();
                if (values.length) n = clamp(n, values[0], values[values.length - 1]);
            }
            this._autoFit = false;
            this._userScale = n;
            this.refitScale();
            return n;
        };

        if (sel) {
            if (sel.value === this.FIT) {
                this._autoFit = true;
            } else {
                const chosen = parseFloat(sel.value);
                if (chosen > 0) { this._autoFit = false; this._userScale = chosen; }
            }
        }

        // Re-fit whenever the room changes: a resize (which a rotation is),
        // a screen mode with a different picture size, or the device's
        // primary input changing (a mouse plugged into a tablet). Coalesced
        // to one measurement per frame - a window drag fires resize far more
        // often than the layout can change.
        let framePending = false;
        const refitSoon = () => {
            if (framePending) return;
            framePending = true;
            requestAnimationFrame(() => {
                framePending = false;
                this.refitScale();
            });
        };
        window.addEventListener('resize', refitSoon);
        EventBus.on(EVENTS.SCREEN_MODE_CHANGED, refitSoon);
        if (window.matchMedia) {
            this._touchQuery = window.matchMedia('(hover: none) and (pointer: coarse)');
            if (this._touchQuery.addEventListener) this._touchQuery.addEventListener('change', refitSoon);
        }
        this.refitScale();
        // Apply a scale, reflect it in the selector, and persist it.
        // Programmatically setting sel.value does not fire 'change', so this
        // is safe to call from the wheel handler without re-entrancy.
        const setScale = (value) => {
            const n = apply(value);
            if (sel) sel.value = String(n);
            if (window.Storage) Promise.resolve(Storage.set(this.SCALE_KEY, String(n))).catch(() => {});
        };

        if (window.Storage) {
            Promise.resolve(Storage.get(this.SCALE_KEY)).then((v) => {
                if (v) {
                    const n = apply(v);
                    if (sel) sel.value = String(n);
                }
            }).catch(() => {});
        }

        if (!sel) return;
        sel.addEventListener('change', () => setScale(sel.value));

        // Ctrl/⌘ + wheel over the app chrome steps the UI scale through the
        // selector's presets instead of triggering native page zoom. Canvas
        // zoom is handled separately inside the iframe, whose wheel events
        // don't reach this outer-document listener.

        document.addEventListener('wheel', (e) => {
            if (!(e.ctrlKey || e.metaKey)) return;
            e.preventDefault();
            const values = presets();
            if (!values.length) return;
            const current = parseFloat(sel.value) ||
                parseFloat(getComputedStyle(root).getPropertyValue('--ui-scale')) || 1;
            // Index of the preset nearest the current scale, then step by
            // wheel direction (wheel up / deltaY < 0 = larger UI).
            let idx = 0, best = Infinity;
            values.forEach((v, i) => {
                const d = Math.abs(v - current);
                if (d < best) { best = d; idx = i; }
            });
            const next = clamp(idx + (e.deltaY < 0 ? 1 : -1), 0, values.length - 1);
            if (values[next] !== values[idx]) setScale(values[next]);
        }, { passive: false });
    }

    /**
     * Apply the scale this screen needs: the artist's choice, shrunk by UiFit
     * if the one layout would not otherwise fit. Public so app.js can re-run
     * it once the tool rail exists - AppSettings initialises before the rail
     * is built, and a rail with no buttons in it fits any screen.
     *
     * Emits UI_SCALE_CHANGED only when the applied value actually moves, so a
     * resize that changes nothing costs ColorBarFit nothing either.
     */
    refitScale() {
        const touchPrimary = !!(this._touchQuery && this._touchQuery.matches);
        // Only "Fit to screen" fits. A size the artist picked is applied as
        // picked, on any device - the fit is an option in the list now, not a
        // cap over every other one. Fitting still never scales UP (the ceiling
        // it fits under is 1), and a desktop is never fitted at all: a desktop
        // short of room has a bigger window as its answer.
        const next = (this._autoFit && window.UiFit && touchPrimary)
            ? UiFit.effectiveScale(Object.assign({ userScale: 1, touchPrimary }, this._measureRoom()))
            : (this._autoFit ? 1 : this._userScale);
        if (this._appliedScale !== null && Math.abs(next - this._appliedScale) < 1e-6) return;
        this._appliedScale = next;
        document.documentElement.style.setProperty('--ui-scale', String(next));
        // ColorBarFit (and anything else that cares) reacts here rather
        // than being called directly - one fact, whoever is listening.
        EventBus.emit(EVENTS.UI_SCALE_CHANGED, { scale: next, userScale: this._userScale });
    }

    /**
     * The live sizes UiFit needs, converted to UNZOOMED CSS px (each zoomed
     * region measures `scale` times its natural size, so dividing by the
     * scale in force when it was measured recovers the natural size - which
     * is what lets UiFit predict any OTHER scale from one measurement).
     * @private
     */
    _measureRoom() {
        const byId = (id) => document.getElementById(id);
        const rootStyle = getComputedStyle(document.documentElement);
        const token = (name) => parseFloat(rootStyle.getPropertyValue(name)) || 0;
        const scale = this._appliedScale || parseFloat(rootStyle.getPropertyValue('--ui-scale')) || 1;
        const height = (el, extra) => el ? el.getBoundingClientRect().height / (scale * extra) : 0;

        // The top strip carries its own shrink on top of --ui-scale
        // (ColorBarFit); its NATURAL height is what fits must plan for, since
        // that shrink can relax again at any scale.
        const bar = byId('color-bar');
        const barScale = bar ? (parseFloat(getComputedStyle(bar).getPropertyValue('--colorbar-scale')) || 1) : 1;

        // The rail's full content, scrolled or not, measured from its first
        // child's top to its last child's bottom. NOT scrollHeight: a rail
        // with room to spare reports its own box height there, which would
        // read as "exactly fits at the current scale" and pin the scale
        // wherever it last shrank to - a tablet turned to a bigger screen
        // would never get its size back. Padding is read as specified (it
        // scales with the box), so it is added unzoomed.
        const rail = byId('toolbar');
        let railContentH = 0;
        if (rail && rail.firstElementChild) {
            const top = rail.firstElementChild.getBoundingClientRect().top;
            const bottom = rail.lastElementChild.getBoundingClientRect().bottom;
            const railStyle = getComputedStyle(rail);
            railContentH = Math.max(0, bottom - top) / scale +
                (parseFloat(railStyle.paddingTop) || 0) + (parseFloat(railStyle.paddingBottom) || 0);
        }

        const viewport = byId('canvas-viewport');
        const pad = viewport ? getComputedStyle(viewport) : null;
        const px = (v) => parseFloat(v) || 0;

        return {
            viewportW: window.innerWidth,
            viewportH: window.innerHeight,
            chrome: {
                toolbarW: token('--toolbar-width'),
                panelsW: token('--panel-width'),
                colourRailW: token('--colorrail-width'),
                headerH: token('--header-height'),
                statusH: token('--status-height'),
                colourBarH: height(bar, barScale),
                canvasControlsH: height(byId('canvas-controls'), 1),
                padW: pad ? px(pad.paddingLeft) + px(pad.paddingRight) : 0,
                padH: pad ? px(pad.paddingTop) + px(pad.paddingBottom) : 0
            },
            railContentH,
            modeW: ZX_SPECTRUM.WIDTH,
            modeH: ZX_SPECTRUM.HEIGHT
        };
    }
}

window.AppSettings = new AppSettingsClass();

Logger.debug('AppSettings', 'App settings component loaded');

})(); // End IIFE
