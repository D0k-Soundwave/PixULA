'use strict';
(function() {

/**
 * Dialog — minimal modal dialog component on the native <dialog> element.
 *
 * Replaces the retired floating-window system (WindowManager/UniversalWindow)
 * for the few genuinely modal interactions: export options, about, keyboard
 * shortcuts, preferences, and the pattern creator. Light DOM, token-styled,
 * Esc-to-close for free via the native cancel behaviour.
 */
class DialogClass {
    constructor() {
        /** @type {Map<string, HTMLDialogElement>} */
        this._open = new Map();
    }

    /** English fallback until i18n lands (Phase 6). @private */
    _t(key, fallback) {
        if (window.I18n && typeof I18n.t === 'function') {
            const v = I18n.t(key);
            if (v && v !== key) return v;
        }
        return fallback;
    }

    /**
     * Open a modal dialog. If a dialog with the same id is open, it is
     * focused instead of duplicated.
     * @param {Object} opts
     * @param {string} opts.id
     * @param {string} [opts.titleI18n] - i18n key for the title
     * @param {string} [opts.title]     - English fallback title
     * @param {HTMLElement} opts.content - body content (adopted, not cloned)
     * @param {Array}  [opts.buttons]   - [{ id, i18n, label, primary, onClick }]
     *                                    onClick returning false keeps the dialog open
     * @param {Function} [opts.onClose]
     * @param {string} [opts.className]
     * @returns {HTMLDialogElement}
     */
    open({ id, titleI18n, title, content, buttons = [], onClose, className = '' }) {
        const existing = this._open.get(id);
        if (existing) {
            existing.focus();
            return existing;
        }

        const dialog = document.createElement('dialog');
        dialog.className = `app-dialog ${className}`.trim();
        dialog.id = `dialog-${id}`;

        const header = document.createElement('header');
        header.className = 'app-dialog-header';

        const titleEl = document.createElement('h2');
        titleEl.className = 'app-dialog-title';
        if (titleI18n) titleEl.dataset.i18n = titleI18n;
        titleEl.textContent = this._t(titleI18n, title || '');

        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'app-dialog-close';
        closeBtn.setAttribute('aria-label', this._t('dialog.close', 'Close'));
        closeBtn.textContent = '×';
        closeBtn.addEventListener('click', () => this.close(id));

        header.appendChild(titleEl);
        header.appendChild(closeBtn);
        dialog.appendChild(header);

        const body = document.createElement('div');
        body.className = 'app-dialog-body';
        if (content) body.appendChild(content);
        dialog.appendChild(body);

        if (buttons.length) {
            const footer = document.createElement('footer');
            footer.className = 'app-dialog-footer';
            for (const btn of buttons) {
                const el = document.createElement('button');
                el.type = 'button';
                el.className = 'panel-button' + (btn.primary ? ' primary' : '');
                if (btn.id) el.id = btn.id;
                if (btn.i18n) el.dataset.i18n = btn.i18n;
                el.textContent = this._t(btn.i18n, btn.label || '');
                el.addEventListener('click', () => {
                    const keepOpen = btn.onClick ? btn.onClick(dialog) === false : false;
                    if (!keepOpen) this.close(id);
                });
                footer.appendChild(el);
            }
            dialog.appendChild(footer);
        }

        dialog.addEventListener('close', () => {
            this._open.delete(id);
            dialog.remove();
            if (onClose) onClose();
        });

        document.body.appendChild(dialog);
        this._open.set(id, dialog);
        if (window.I18n && typeof I18n.apply === 'function') I18n.apply(dialog);
        dialog.showModal();

        return dialog;
    }

    /** Close (and remove) an open dialog by id. */
    close(id) {
        const dialog = this._open.get(id);
        if (dialog) dialog.close();
    }

    /** Is a dialog with this id currently open? */
    isOpen(id) {
        return this._open.has(id);
    }
}

window.Dialog = new DialogClass();

Logger.debug('Dialog', 'Dialog component loaded');

})(); // End IIFE
