'use strict';
(function() {

/**
 * Border Control
 *
 * A "Border" dropdown in the HEADER (moved there 2026-08-26 from the
 * drawing-modes toolbar — a plain select like its language/interface-size
 * neighbours, no caption above it, matching the header's own minimal style
 * rather than the rail/top-strip's captioned-icon convention).
 * The default option ("Theme default") leaves the area around the canvas on
 * the UI theme's background; picking one of the 8 colours (0-7 — the real
 * border has no BRIGHT) previews it around the canvas via the
 * --zx-border-preview custom property on #canvas-area AND becomes the border
 * colour offered when exporting (the export dialog can still override it for
 * a single save). The choice persists to Storage PREFERENCES.
 */
class BorderControlClass {
    constructor() {
        // 'default' means "theme background, no preview".
        this.STORAGE_KEY = 'borderChoice';
        /** @type {'default'|number} */
        this._choice = 'default';
        this._select = null;
    }

    /**
     * Build the UI and restore the persisted border choice.
     * Called from App.init() Phase 5.
     */
    initialize() {
        const host = document.getElementById('border-host');
        if (!host) {
            Logger.warn('BorderControl', 'border-host section not found');
            return;
        }

        const select = document.createElement('select');
        select.id = 'border-select';
        select.dataset.i18nTitle = 'color.border';
        select.dataset.i18nAriaLabel = 'color.border';
        select.setAttribute('aria-label', 'Border');
        select.title = 'Border';

        const defOpt = document.createElement('option');
        defOpt.value = 'default';
        defOpt.dataset.i18n = 'color.borderDefault';
        defOpt.textContent = 'Theme default';
        select.appendChild(defOpt);

        const names = ['black', 'blue', 'red', 'magenta', 'green', 'cyan', 'yellow', 'white'];
        names.forEach((name, i) => {
            const opt = document.createElement('option');
            opt.value = String(i);
            opt.dataset.i18n = 'color.' + name;
            opt.textContent = name.charAt(0).toUpperCase() + name.slice(1);
            select.appendChild(opt);
        });

        if (window.I18n && typeof I18n.apply === 'function') I18n.apply(select);
        host.appendChild(select);
        this._select = select;

        select.addEventListener('change', () => {
            const v = select.value;
            this._applyChoice(v === 'default' ? 'default' : parseInt(v, 10), true);
        });

        // Keep the dropdown/preview in sync if something else changes the
        // document border — but only while a preview colour is active. When
        // the choice is "Theme default", a border set elsewhere (e.g. a
        // one-off override in the export dialog) stays transient and does
        // not switch the preview on.
        EventBus.on(EVENTS.COLOR_BORDER, ({ border }) => {
            if (this._choice !== 'default') this._applyChoice(border, true);
        });

        // Restore persisted value; theme default until the async read resolves.
        // If the user picks something before it resolves, their choice wins.
        Storage.get(this.STORAGE_KEY, Storage.STORES.PREFERENCES).then((saved) => {
            if (this._choice !== 'default') return;
            if (typeof saved === 'number') {
                this._applyChoice(saved, false);
            }
        }).catch(() => {});

        Logger.info('BorderControl', 'Initialized');
    }

    /**
     * Apply a border choice: update the dropdown, the canvas-area preview,
     * the ColorManager border (export default), and optionally persist.
     * @param {'default'|number} choice
     * @param {boolean} persist
     * @private
     */
    _applyChoice(choice, persist) {
        const canvasArea = document.getElementById('canvas-area');

        if (choice === 'default') {
            this._choice = 'default';
            if (this._select) this._select.value = 'default';
            if (canvasArea) {
                canvasArea.classList.remove('border-preview');
                canvasArea.style.removeProperty('--zx-border-preview');
            }
        } else {
            const b = clamp(choice | 0, 0, 7);
            this._choice = b;
            if (this._select) this._select.value = String(b);
            ColorManager.setBorder(b);
            // The border colour is document content (like pixels), not theming
            // — referencing the published palette token keeps the palette's
            // single source in ColorManager/constants. It reads the hardware
            // border tokens (always the 8 non-bright classic colours), NOT the
            // active-palette --zx-N ones: the border register is untouched by
            // ULAplus/Next/Timex palette models, so the preview must show the
            // real colour byte-for-byte in every screen mode.
            if (canvasArea) {
                canvasArea.style.setProperty('--zx-border-preview', `var(--zx-border-${b})`);
                canvasArea.classList.add('border-preview');
            }
        }

        if (window.CanvasSystem) CanvasSystem.syncBackdropColor();

        if (persist) {
            Storage.set(this.STORAGE_KEY, this._choice, Storage.STORES.PREFERENCES);
        }
    }
}

// Create singleton
window.BorderControl = new BorderControlClass();

Logger.debug('BorderControl', 'Border control loaded');

})(); // End IIFE
