'use strict';
(function() {

/**
 * SaveDialog - the file-name picker for File > Save Project / Save Project As.
 *
 * Modelled on the export dialog: a proper Dialog rather than a native
 * prompt(). Unlike Export, there is no format select - Save/Save As always
 * write `.pixula` (the only format that keeps the document), so the field
 * just needs the project's own name. It stays free text on purpose: typing
 * a different extension (a bare `image.scr`) is still how you hand a
 * picture to an emulator, the same escape hatch the old prompt() offered.
 */
class SaveDialogClass {
    /** English fallback helper (same pattern as the other components). @private */
    _t(key, fallback) {
        if (window.I18n && typeof I18n.t === 'function') {
            const v = I18n.t(key);
            if (v && v !== key) return v;
        }
        return fallback;
    }

    /**
     * @param {string} defaultName - pre-filled filename
     * @returns {Promise<string|null>} the chosen filename, or null if
     *   cancelled — also null immediately if a Save dialog is already open.
     *   Dialog.open() de-duplicates by id (it focuses the existing dialog
     *   rather than opening a second one), so a second concurrent show()
     *   would otherwise never get its own onClose/commit wired to the live
     *   DOM and its promise would hang forever.
     */
    show(defaultName) {
        if (Dialog.isOpen('save-project')) {
            return Promise.resolve(null);
        }

        return new Promise((resolve) => {
            const content = document.createElement('div');
            content.className = 'preset-save';

            const field = document.createElement('div');
            field.className = 'preset-field';

            const labelEl = document.createElement('label');
            labelEl.htmlFor = 'save-project-name';
            labelEl.dataset.i18n = 'dialog.saveAs';
            labelEl.textContent = this._t('dialog.saveAs', 'Save as:');

            const input = document.createElement('input');
            input.type = 'text';
            input.id = 'save-project-name';
            input.value = defaultName || '';

            field.appendChild(labelEl);
            field.appendChild(input);
            content.appendChild(field);

            const commit = () => {
                const name = input.value.trim();
                if (!name) {
                    input.focus();
                    return false;
                }
                resolve(name);
                return true;
            };

            input.addEventListener('keydown', (event) => {
                if (event.key !== 'Enter') return;
                event.preventDefault();
                if (commit() !== false) Dialog.close('save-project');
            });

            Dialog.open({
                id: 'save-project',
                titleI18n: 'dialog.saveProject',
                title: 'Save Project',
                content,
                className: 'preset-dialog',
                buttons: [
                    { i18n: 'dialog.cancel', label: 'Cancel' },
                    { i18n: 'dialog.save', label: 'Save', primary: true, onClick: commit }
                ],
                // Covers every dismissal path (Cancel, X, Esc) - commit()
                // already resolved the promise on success, and a second
                // resolve() here is a no-op per the Promise spec.
                onClose: () => resolve(null)
            });

            input.focus();
            input.select();
        });
    }
}

window.SaveDialog = new SaveDialogClass();

Logger.debug('SaveDialog', 'Save dialog loaded');

})(); // End IIFE
