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
 */
class AppSettingsClass {
    constructor() {
        this.SCALE_KEY = 'uiFontScale';
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
            let n = parseFloat(scale);
            if (n <= 0) return;
            if (sel) {
                const values = presets();
                if (values.length) n = clamp(n, values[0], values[values.length - 1]);
            }
            root.style.setProperty('--ui-scale', String(n));
            // ColorBarFit (and anything else that cares) reacts here rather
            // than being called directly - one fact, whoever is listening.
            EventBus.emit(EVENTS.UI_SCALE_CHANGED, { scale: n });
            return n;
        };
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
}

window.AppSettings = new AppSettingsClass();

Logger.debug('AppSettings', 'App settings component loaded');

})(); // End IIFE
