'use strict';
(function() {

/**
 * AppSettings — header controls: language, theme, and interface (UI) scale.
 *
 * Extracted from the old app.js (_setupThemeSelector, _setupLanguageSelector,
 * _setupFontScale). Theme and language delegate to ThemeManager / I18n when
 * those land (Phase 6); until then the selectors apply what they can locally
 * (data-theme attribute; language selection is persisted for Phase 6 pickup).
 *
 * The UI scale sets --ui-scale on :root, which `zoom`-scales every chrome
 * region (and multiplies the #app grid tracks) so the whole interface scales
 * together. The drawing canvas is excluded by design. Ctrl/⌘+wheel over the
 * chrome steps through the selector's presets.
 */
class AppSettingsClass {
    constructor() {
        this.SCALE_KEY = 'uiFontScale';
        this.LANG_KEY = 'locale';
        this.THEME_KEY = 'theme';
    }

    init() {
        this._setupThemeSelector();
        this._setupLanguageSelector();
        this._setupUiScale();
        Logger.info('AppSettings', 'Initialized');
    }

    /** @private */
    _setupThemeSelector() {
        const themeSelector = document.getElementById('theme-selector');
        if (!themeSelector) return;

        if (window.ThemeManager) {
            themeSelector.value = ThemeManager.getTheme();
            themeSelector.addEventListener('change', () => {
                ThemeManager.setTheme(themeSelector.value);
            });
            // Render from the fact so menu-driven changes (Settings -> Light/
            // Dark Theme) keep the selector in sync.
            EventBus.on(EVENTS.THEME_CHANGED, ({ theme }) => {
                if (themeSelector.value !== theme) themeSelector.value = theme;
            });
        } else {
            // Interim (until Phase 6 ports ThemeManager + themes.css): apply
            // the data-theme attribute and persist so the choice carries over.
            const root = document.documentElement;
            if (window.Storage) {
                Promise.resolve(Storage.get(this.THEME_KEY)).then((v) => {
                    if (v) {
                        root.dataset.theme = v;
                        themeSelector.value = v;
                        EventBus.emit(EVENTS.THEME_CHANGED, { theme: v });
                    }
                }).catch(() => {});
            }
            themeSelector.addEventListener('change', () => {
                root.dataset.theme = themeSelector.value;
                if (window.Storage) Promise.resolve(Storage.set(this.THEME_KEY, themeSelector.value)).catch(() => {});
                EventBus.emit(EVENTS.THEME_CHANGED, { theme: themeSelector.value });
            });
        }
    }

    /** @private */
    _setupLanguageSelector() {
        const langSelector = document.getElementById('language-selector');
        if (!langSelector) return;

        if (window.I18n) {
            langSelector.value = I18n.getLocale();
            langSelector.addEventListener('change', () => {
                I18n.setLocale(langSelector.value);
            });
            EventBus.on(EVENTS.UI_LANGUAGE_CHANGE, ({ locale }) => {
                if (langSelector.value !== locale) langSelector.value = locale;
            });
        } else {
            // Interim: persist the choice so Phase 6's I18n starts with it.
            if (window.Storage) {
                Promise.resolve(Storage.get(this.LANG_KEY)).then((v) => {
                    if (v) langSelector.value = v;
                }).catch(() => {});
            }
            langSelector.addEventListener('change', () => {
                if (window.Storage) Promise.resolve(Storage.set(this.LANG_KEY, langSelector.value)).catch(() => {});
                EventBus.emit(EVENTS.UI_LANGUAGE_CHANGE, { locale: langSelector.value });
            });
        }
    }

    /** @private */
    _setupUiScale() {
        const sel = document.getElementById('font-scale-selector');
        const root = document.documentElement;

        const apply = (scale) => {
            const n = parseFloat(scale);
            if (n > 0) root.style.setProperty('--ui-scale', String(n));
        };
        // Apply a scale, reflect it in the selector, and persist it.
        // Programmatically setting sel.value does not fire 'change', so this
        // is safe to call from the wheel handler without re-entrancy.
        const setScale = (value) => {
            apply(value);
            if (sel) sel.value = String(value);
            if (window.Storage) Promise.resolve(Storage.set(this.SCALE_KEY, String(value))).catch(() => {});
        };

        if (window.Storage) {
            Promise.resolve(Storage.get(this.SCALE_KEY)).then((v) => {
                if (v) {
                    apply(v);
                    if (sel) sel.value = String(v);
                }
            }).catch(() => {});
        }

        if (!sel) return;
        sel.addEventListener('change', () => setScale(sel.value));

        // Ctrl/⌘ + wheel over the app chrome steps the UI scale through the
        // selector's presets instead of triggering native page zoom. Canvas
        // zoom is handled separately inside the iframe, whose wheel events
        // don't reach this outer-document listener.
        const presets = () => Array.from(sel.options)
            .map((o) => parseFloat(o.value))
            .filter((n) => n > 0)
            .sort((a, b) => a - b);

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
