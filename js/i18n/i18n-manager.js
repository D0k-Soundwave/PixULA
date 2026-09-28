'use strict';
(function() {

/**
 * I18n — internationalization system (13 locales).
 *
 * Ported from H:\smsh and conformed: facts go up ONLY via EVENTS.* constants
 * (the old tree also emitted a legacy 'locale:changed' string literal — the
 * lint forbids that; everything here listens to EVENTS.UI_LANGUAGE_CHANGE).
 *
 * Contract with the UI layer:
 *  - Components stamp data-i18n / data-i18n-title / data-i18n-aria-label /
 *    data-i18n-placeholder / data-i18n-label attributes when they build DOM,
 *    with English fallback text.
 *  - After building, they call I18n.apply(root) so a fresh subtree shows the
 *    current locale immediately.
 *  - setLocale() re-translates the WHOLE document from those attributes and
 *    emits the language fact — no component needs its own locale listener
 *    unless it renders text without data-i18n attributes.
 *
 * Boot: init() reads the persisted 'locale' Storage key (the AppSettings
 * interim path from Phase 4/5 saved under the same key, so pre-Phase-6
 * choices are honoured), falling back to the browser language, then 'en'.
 */
class I18nClass {
    constructor() {
        this.currentLocale = 'en';
        this.translations = {};
        this.fallbackLocale = 'en';

        // Single source of truth for languages. To add one: append a
        // [code, 'Native Name'] entry here and create js/i18n/<code>.js
        // (which sets window.i18n_<code>). Only English has a <script> tag
        // in index.html; every other table is loaded when it is first
        // chosen (loadLocale). Names are autonyms — they are deliberately
        // NOT translated.
        this.LOCALES = [
            ['en', 'English'],
            ['es', 'Español'],
            ['de', 'Deutsch'],
            ['fr', 'Français'],
            ['ru', 'Русский'],
            ['cs', 'Čeština'],
            ['hu', 'Magyar'],
            ['it', 'Italiano'],
            ['pl', 'Polski'],
            ['pt', 'Português'],
            ['ro', 'Română'],
            ['sk', 'Slovenčina'],
            ['tr', 'Türkçe']
        ];

        this.supportedLocales = this.LOCALES.map(([code]) => code);
        this.localeNames = Object.fromEntries(this.LOCALES);
        /** code -> the promise of its table loading (loadLocale) */
        this._loading = new Map();
        this._requestedLocale = null;
    }

    async init() {
        this._loadAllTranslations();

        let savedLocale = null;
        try {
            savedLocale = await Storage.get('locale');
        } catch (error) {
            Logger.warn('I18n', 'Failed to get saved locale', error);
        }

        const browserLang = navigator.language.split('-')[0];
        const locale = savedLocale ||
            (this.supportedLocales.includes(browserLang) ? browserLang : this.fallbackLocale);

        // Waits for the table to load, so the app starts in its language
        await this.setLocale(locale);

        Logger.info('I18n', `Initialized with locale: ${this.currentLocale}`);
    }

    /**
     * Pick up the tables already on the page - English, from index.html, and
     * any a test or an earlier load put there. @private
     */
    _loadAllTranslations() {
        this.supportedLocales.forEach(code => {
            const table = window['i18n_' + code];
            if (table) this.translations[code] = table;
        });
        if (!this.translations[this.fallbackLocale]) {
            Logger.warn('I18n', `No ${this.fallbackLocale} table (window.i18n_${this.fallbackLocale} missing)`);
        }
    }

    /**
     * Load one language's table, once, by injecting its script.
     *
     * All thirteen tables used to load at start-up, about 950 KB of which
     * only two are ever read - English (the fallback) and the chosen one.
     * Loading the rest on demand made start-up about 0.03 s (7%) quicker on
     * a fast desktop (median of 40 starts, 2026-09-28), and leaves the text
     * of eleven languages out of memory. The path is relative to the entry
     * file, as js/data/manual-content.js is (ManualDialog).
     * @param {string} code
     * @returns {Promise<boolean>} whether the table is now available
     */
    loadLocale(code) {
        if (this.translations[code]) return Promise.resolve(true);
        if (!this.supportedLocales.includes(code)) return Promise.resolve(false);
        let loading = this._loading.get(code);
        if (!loading) {
            loading = new Promise((resolve) => {
                const script = document.createElement('script');
                script.src = `js/i18n/${code}.js`;
                script.addEventListener('load', () => {
                    const table = window['i18n_' + code];
                    if (table) this.translations[code] = table;
                    else Logger.warn('I18n', `js/i18n/${code}.js loaded but set no table`);
                    resolve(!!table);
                });
                script.addEventListener('error', () => {
                    Logger.warn('I18n', `js/i18n/${code}.js could not be loaded`);
                    // A failed load must not poison a later attempt
                    this._loading.delete(code);
                    resolve(false);
                });
                document.head.appendChild(script);
            });
            this._loading.set(code, loading);
        }
        return loading;
    }

    /**
     * Switch language. Immediate when the table is loaded; otherwise it is
     * loaded first (see loadLocale) and the switch happens then - unless a
     * later call has asked for another language meanwhile.
     * @param {string} locale
     * @returns {Promise<void>} settles once the switch has happened
     */
    setLocale(locale) {
        if (!this.supportedLocales.includes(locale)) {
            Logger.warn('I18n', `Unsupported locale: ${locale}, falling back to ${this.fallbackLocale}`);
            locale = this.fallbackLocale;
        }
        this._requestedLocale = locale;

        if (!this.translations[locale]) {
            return this.loadLocale(locale).then((ok) => {
                if (this._requestedLocale !== locale) return;
                if (!ok) {
                    Logger.warn('I18n', `No translations loaded for ${locale}, falling back to ${this.fallbackLocale}`);
                }
                this._applyLocale(ok ? locale : this.fallbackLocale);
            });
        }
        this._applyLocale(locale);
        return Promise.resolve();
    }

    /** @private */
    _applyLocale(locale) {
        this.currentLocale = locale;
        Promise.resolve(Storage.set('locale', locale)).catch(() => {});

        // Correct language for hyphenation, AT voices and CSS :lang()
        document.documentElement.lang = locale;

        this._updateDOM();

        EventBus.emit(EVENTS.UI_LANGUAGE_CHANGE, { locale });
    }

    /**
     * Translate a key, with {param} interpolation.
     * @param {string} key
     * @param {Object} [params]
     * @returns {string}
     */
    t(key, params = {}) {
        let text = this.translations[this.currentLocale]?.[key]
            || this.translations[this.fallbackLocale]?.[key]
            || key;

        Object.entries(params).forEach(([param, value]) => {
            text = text.replace(new RegExp(`\\{${param}\\}`, 'g'), value);
        });

        return text;
    }

    /**
     * A count in words, in the form the current language uses for `n`.
     *
     * A plural key's value lists one form per CLDR plural category, tagged:
     * 'one: {n} minute ago | other: {n} minutes ago'. English needs two
     * forms; Polish, Czech, Slovak, Russian and Romanian need three or four
     * ("2 minuty temu" but "5 minut temu"), which a single/plural key pair
     * could not say (found 2026-09-27). The category comes from
     * Intl.PluralRules; a missing form falls back to `other`, a missing key
     * to English.
     * @param {string} key - a `plural.*` key
     * @param {number} n - the count; also available to the text as {n}
     * @param {Object} [params] - other {placeholder} values
     * @returns {string}
     */
    plural(key, n, params = {}) {
        const pick = (code) => {
            const raw = this.translations[code]?.[key];
            if (!raw) return null;
            const forms = Helpers.parsePluralForms(raw);
            return forms[this._pluralCategory(code, n)] || forms.other || null;
        };
        let text = pick(this.currentLocale) || pick(this.fallbackLocale) || key;
        Object.entries({ n, ...params }).forEach(([param, value]) => {
            text = text.replace(new RegExp(`\\{${param}\\}`, 'g'), value);
        });
        return text;
    }

    /**
     * The CLDR plural category of `n` in language `code`, from one
     * Intl.PluralRules per language (a tape listing asks once per block).
     * @private
     */
    _pluralCategory(code, n) {
        if (!this._pluralRules) this._pluralRules = new Map();
        let rules = this._pluralRules.get(code);
        if (rules === undefined) {
            try { rules = new Intl.PluralRules(code); } catch (e) { rules = null; }
            this._pluralRules.set(code, rules);
        }
        return rules ? rules.select(n) : 'other';
    }

    /**
     * Translate a freshly-built DOM subtree (e.g. a dynamically-rendered
     * panel) so its [data-i18n*] elements show the current locale
     * immediately, without waiting for a locale change. Call after building.
     * @param {ParentNode} root - element (or document) to translate within
     */
    apply(root) {
        this._updateDOM(root || document);
    }

    /** @private */
    _updateDOM(root = document) {
        // Include the root itself when it carries a data-i18n* attribute, not
        // just its descendants (querySelectorAll only matches descendants).
        const collect = (selector) => {
            const list = Array.from(root.querySelectorAll(selector));
            if (root.matches && root.matches(selector)) list.unshift(root);
            return list;
        };

        collect('[data-i18n]').forEach(el => {
            el.textContent = this.t(el.dataset.i18n, I18nClass.paramsOf(el));
        });

        collect('[data-i18n-placeholder]').forEach(el => {
            el.placeholder = this.t(el.dataset.i18nPlaceholder);
        });

        // A captioned icon button shows only a keyword, so its tooltip must
        // carry the full name as well as the description: data-i18n-title-name
        // names it (as an i18n key), data-i18n-title describes it,
        // data-shortcut keys it. Without a name this stays what it always
        // was — the hint. data-i18n-title-literal names it with a runtime
        // VALUE instead (a pattern's own name, a CLUT number's caller) that
        // is not itself translatable — carried verbatim rather than looked up.
        // Both the hint and a name-BY-KEY re-resolve their own
        // data-i18n-param-<n> attributes, the same params() a plain
        // data-i18n textContent element reads.
        collect('[data-i18n-title]').forEach(el => {
            const params = I18nClass.paramsOf(el);
            const hint = this.t(el.dataset.i18nTitle, params);
            const nameKey = el.dataset.i18nTitleName;
            const name = nameKey ? this.t(nameKey, params) : el.dataset.i18nTitleLiteral;
            el.title = name
                ? Helpers.composeTitle(name, hint, el.dataset.shortcut)
                : hint;
        });

        // Name-only tooltips (no separate hint key) still get the shortcut.
        collect('[data-i18n-title-name]:not([data-i18n-title])').forEach(el => {
            el.title = Helpers.composeTitle(this.t(el.dataset.i18nTitleName, I18nClass.paramsOf(el)), '', el.dataset.shortcut);
        });

        // The status bar's draw-mode readout is composed from two keys, so it
        // carries the mode id and DrawModeBar rebuilds the sentence.
        collect('[data-i18n-draw-mode]').forEach(el => {
            if (window.DrawModeBar) el.textContent = DrawModeBar.describeMode(el.dataset.i18nDrawMode);
        });

        // The touch switch's label is one of two keys chosen by its state, so
        // it carries the state and TouchModeStatus picks the key.
        collect('[data-i18n-touch-mode]').forEach(el => {
            if (window.TouchModeStatus) el.textContent = TouchModeStatus.describeMode(el.dataset.i18nTouchMode);
        });

        // Screen-mode tooltips are composed from the SCREEN_MODES descriptor
        // (size, attribute layout, colour count, palette), so they cannot be
        // one static key — the attribute names the mode and Helpers rebuilds
        // the text in the new locale.
        collect('[data-i18n-mode-title]').forEach(el => {
            el.title = Helpers.describeScreenMode(getScreenModeById(el.dataset.i18nModeTitle));
        });

        // A shortcut's key names follow the keyboard's language ('Strg+Z').
        collect('[data-i18n-shortcut]').forEach(el => {
            el.textContent = Helpers.shortcutLabel(el.dataset.i18nShortcut);
        });

        collect('[data-i18n-aria-label]').forEach(el => {
            el.setAttribute('aria-label', this.t(el.dataset.i18nAriaLabel, I18nClass.paramsOf(el)));
        });

        // <optgroup label="…"> shows an attribute, not text content.
        collect('[data-i18n-label]').forEach(el => {
            el.setAttribute('label', this.t(el.dataset.i18nLabel));
        });
    }

    getLocale() {
        return this.currentLocale;
    }

    getSupportedLocales() {
        return this.supportedLocales;
    }

    getLocaleName(locale) {
        return this.localeNames[locale] || locale;
    }

    cycleLocale() {
        const currentIndex = this.supportedLocales.indexOf(this.currentLocale);
        const nextIndex = (currentIndex + 1) % this.supportedLocales.length;
        this.setLocale(this.supportedLocales[nextIndex]);
    }
}

/**
 * The `{param}` values an element carries for its own key, as
 * `data-i18n-param-<name>` attributes.
 *
 * Without this, re-translating a parameterised element wiped its parameters:
 * `apply()` called `t(key)` with nothing, so a row built as "CLUT 0" came back
 * from the very next `I18n.apply` reading "CLUT {n}" — which is exactly what
 * the palette editor's four CLUT labels did, in every language, from the day
 * they were written. The attribute had been set there all along in the
 * expectation that something read it; now something does.
 *
 * `data-i18n-param-n="0"` arrives in `dataset` as `i18nParamN`, so the name is
 * the remainder with its first letter lowered again.
 * @param {HTMLElement} el
 * @returns {Object|undefined} undefined when there are none, so `t`'s own
 *          default applies rather than an empty object being built per element
 */
I18nClass.paramsOf = function(el) {
    let params;
    for (const key in el.dataset) {
        if (!key.startsWith('i18nParam') || key.length === 9) continue;
        const name = key.slice(9);
        (params || (params = {}))[name.charAt(0).toLowerCase() + name.slice(1)] =
            el.dataset[key];
    }
    return params;
};

window.I18n = new I18nClass();

Logger.debug('I18n', 'I18n manager loaded');

})(); // End IIFE
