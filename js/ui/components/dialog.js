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

        // Where keyboard focus goes back to when this closes (see _returnFocus).
        const opener = document.activeElement;
        const openedByKeyboard = !!(opener && opener.matches && opener.matches(':focus-visible'));

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
        closeBtn.dataset.i18nTitleName = 'dialog.close';
        closeBtn.dataset.i18nTitle = 'dialog.close.hint';
        closeBtn.dataset.i18nAriaLabel = 'dialog.close';
        closeBtn.setAttribute('aria-label', this._t('dialog.close', 'Close'));
        closeBtn.title = Helpers.composeTitle(
            this._t('dialog.close', 'Close'),
            this._t('dialog.close.hint', 'You can also press Escape to close this dialog')
        );
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
                el.addEventListener('click', async () => {
                    // Promise.resolve() wrapping makes both shapes identical:
                    // a plain sync return behaves exactly as before (resolves
                    // on the same microtask), while an async onClick's real
                    // native-picker wait (Save/Export dialogs) is genuinely
                    // awaited before deciding whether to close - without
                    // this, an async handler's returned Promise is never
                    // === false, so the dialog closed immediately regardless
                    // of what it eventually resolved to.
                    const result = await Promise.resolve(btn.onClick ? btn.onClick(dialog) : undefined);
                    if (result !== false) this.close(id);
                });
                footer.appendChild(el);
            }
            dialog.appendChild(footer);
        }

        dialog.addEventListener('close', () => {
            this._open.delete(id);
            dialog.remove();
            if (onClose) onClose();
            this._returnFocus(opener, openedByKeyboard);
        });

        document.body.appendChild(dialog);
        this._open.set(id, dialog);
        if (window.I18n && typeof I18n.apply === 'function') I18n.apply(dialog);
        dialog.showModal();
        // showModal() autofocuses the first focusable descendant, which is this
        // header's close button (it precedes any body content) - TooltipManager's
        // :focus-visible handling then treats that as a genuine keyboard-focus
        // request and immediately shows (and strips the title of) the tooltip the
        // instant the dialog opens. Redirect focus to the dialog itself so opening
        // a dialog doesn't pop its own tooltip.
        dialog.tabIndex = -1;
        dialog.focus();

        return dialog;
    }

    /**
     * Put focus back on what opened a dialog once it closes.
     *
     * The browser tries this itself, but a dialog opened from a menu row
     * finds that row hidden by the time it closes, and focus fell to the top
     * of the page (found 2026-09-27): a keyboard user had to Tab through the
     * whole app to get back. A menu row now hands focus to its menu's name
     * on the bar - only when the menu was used from the keyboard, since the
     * bar takes letter keys for itself and would swallow the drawing
     * shortcuts of someone who clicked. Anything else that is still on
     * screen gets focus back directly.
     * @param {Element|null} opener - the focused element when the dialog opened
     * @param {boolean} openedByKeyboard - it had a keyboard focus ring then
     * @private
     */
    _returnFocus(opener, openedByKeyboard) {
        if (!opener || opener === document.body || !opener.isConnected) return;
        const menuItem = opener.closest && opener.closest('.menu-item');
        if (menuItem) {
            const label = menuItem.querySelector('.menu-label');
            if (!openedByKeyboard || !label) return;
            if (window.MenuSystem && typeof MenuSystem._focusLabel === 'function') MenuSystem._focusLabel(label);
            else label.focus();
            return;
        }
        // Another dialog opened on top of this one has taken focus already.
        if (document.activeElement && document.activeElement.closest('dialog[open]')) return;
        if (opener.getClientRects().length === 0 || typeof opener.focus !== 'function') return;
        opener.focus({ preventScroll: true });
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
