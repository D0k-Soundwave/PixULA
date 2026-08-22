'use strict';
(function() {

/**
 * ThemeManager — applies application themes.
 * Available themes: dark, light, midnight, nord, dracula, sepia, crimson,
 * citrus — accent hues spaced 45 degrees apart around the wheel: crimson 0,
 * sepia ~28, citrus ~88, dark ~140, nord ~191, midnight ~225, dracula ~262,
 * light ~320. 6 dark-family + 2 light-family (light, sepia).
 *
 * Ported from H:\smsh and conformed:
 *  - Themes are pure token-override blocks in css/themes.css keyed off the
 *    data-theme attribute this manager sets on <html>. The old tree also
 *    stamped a theme-<name> class on <body>; nothing in the rebuild styles
 *    off body classes, so that path is gone.
 *  - CanvasSystem.syncBackdropColor() mirrors #canvas-area's resolved
 *    background into the canvas iframe body after every theme switch: the
 *    srcdoc iframe is a unique/opaque origin on file://, and Chromium does
 *    not blend a transparent cross-process iframe body through to the
 *    parent, so the themed background must be pushed in rather than relied
 *    on to show through.
 *  - Facts go up via EVENTS.THEME_CHANGED; GridOverlay re-reads its grid
 *    colours from the CSS tokens on that fact, MenuSystem syncs its
 *    Settings > Theme submenu checkmarks — the only theme picker (a header
 *    <select> duplicated it until 2026-08-21; removed as redundant).
 *
 * Boot: init() reads the persisted 'theme' Storage key — the same key the
 * AppSettings interim path saved under, so pre-Phase-6 choices are honoured.
 */
class ThemeManagerClass {
    constructor() {
        this.currentTheme = 'dark';
        this._validThemes = ['dark', 'light', 'midnight', 'nord', 'dracula', 'sepia', 'crimson', 'citrus'];
    }

    async init() {
        let savedTheme = 'dark';
        try {
            savedTheme = (await Storage.get('theme')) || 'dark';
        } catch (error) {
            Logger.warn('ThemeManager', 'Failed to get saved theme', error);
        }

        this.setTheme(savedTheme);

        Logger.info('ThemeManager', `Initialized with theme: ${this.currentTheme}`);
    }

    setTheme(themeName) {
        if (!this._validThemes.includes(themeName)) {
            Logger.warn('ThemeManager', `Unknown theme: ${themeName}`);
            return;
        }

        this.currentTheme = themeName;
        document.documentElement.setAttribute('data-theme', themeName);
        Promise.resolve(Storage.set('theme', themeName)).catch(() => {});

        if (window.CanvasSystem) CanvasSystem.syncBackdropColor();

        EventBus.emit(EVENTS.THEME_CHANGED, { theme: themeName });
    }

    getTheme() {
        return this.currentTheme;
    }

    getAvailableThemes() {
        return this._validThemes.slice();
    }

    cycleTheme() {
        const currentIndex = this._validThemes.indexOf(this.currentTheme);
        const nextIndex = (currentIndex + 1) % this._validThemes.length;
        this.setTheme(this._validThemes[nextIndex]);
    }

    /** i18n key for a theme's display label (theme.* exists in all locales). */
    getThemeLabel(themeName) {
        return this._validThemes.includes(themeName) ? `theme.${themeName}` : themeName;
    }
}

window.ThemeManager = new ThemeManagerClass();

Logger.debug('ThemeManager', 'Theme manager loaded');

})(); // End IIFE
