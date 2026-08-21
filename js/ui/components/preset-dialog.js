'use strict';
(function() {

/**
 * PresetDialog — save a setup, and manage the slots.
 *
 * Two dialogs, one file, because they are two views of the same library:
 *
 *   openSave()  name it, choose a slot, tick what it should carry.
 *   open()      the manager: every slot, filled or empty, with load/save/
 *               rename/delete/export against each and an import button.
 *
 * EMPTY SLOTS ARE VISIBLE HERE and nowhere else. Filing a preset into a
 * particular slot is the whole job of this dialog, so the empty ones are the
 * targets; the recall dropdown lists only what is filled, because there an
 * empty slot is just something to read past.
 *
 * The scope checkboxes are built FROM PresetService.SLICES, so a slice added to
 * the registry appears here with no edit to this file — the same property that
 * makes the codec and the tests registry-driven.
 */
class PresetDialogClass {
    constructor() {
        /** True while this dialog is writing a label of its own. @private */
        this._editingLabel = false;
    }

    /** English fallback (dialog builds DOM; I18n.apply re-translates). @private */
    _t(key, fallback, params) {
        if (window.I18n && typeof I18n.t === 'function') {
            const v = I18n.t(key, params);
            if (v && v !== key) return v;
        }
        return fallback;
    }

    // ── Save ────────────────────────────────────────────────────────────────

    /**
     * Save the current setup.
     * @param {number} [slot] - pre-selected slot (the manager's "Save here")
     * @param {Array<string>} [scopes] - pre-ticked slices. The Reference panel
     *        passes its own slice, so "save this tracing setup" arrives with
     *        the reference ticked and nothing else — the button you pressed is
     *        the thing you meant to save.
     */
    openSave(slot = null, scopes = null) {
        if (Dialog.isOpen('preset-save')) return;

        const target = PresetCodec.isValidSlot(slot) ? slot : PresetService.firstFreeSlot();
        if (target === -1) {
            alert(this._t('preset.full',
                'Every preset slot is full. Delete one in the preset manager first.'));
            return;
        }

        const content = document.createElement('div');
        content.className = 'preset-save';

        // Name — the whole reason presets are worth having: a slot the user can
        // identify at a glance beats a slot they have to try to find out.
        const nameRow = document.createElement('div');
        nameRow.className = 'preset-field';
        const nameLabel = document.createElement('label');
        nameLabel.htmlFor = 'preset-save-name';
        nameLabel.dataset.i18n = 'preset.name';
        nameLabel.textContent = this._t('preset.name', 'Name');
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.id = 'preset-save-name';
        nameInput.maxLength = PresetCodec.MAX_NAME;
        nameInput.value = this._suggestName(target);
        nameInput.dataset.i18nPlaceholder = 'preset.namePlaceholder';
        nameInput.placeholder = this._t('preset.namePlaceholder', 'What is this setup for?');
        nameRow.appendChild(nameLabel);
        nameRow.appendChild(nameInput);
        content.appendChild(nameRow);

        // Description — optional, and shown on hover wherever the preset is
        // listed. The name has to fit a dropdown; this is where the rest goes.
        const descRow = document.createElement('div');
        descRow.className = 'preset-field preset-field-tall';
        const descLabel = document.createElement('label');
        descLabel.htmlFor = 'preset-save-description';
        descLabel.dataset.i18n = 'preset.description';
        descLabel.textContent = this._t('preset.description', 'Description');
        const descInput = document.createElement('textarea');
        descInput.id = 'preset-save-description';
        descInput.rows = 2;
        descInput.maxLength = PresetCodec.MAX_DESCRIPTION;
        descInput.dataset.i18nPlaceholder = 'preset.descriptionPlaceholder';
        descInput.placeholder = this._t('preset.descriptionPlaceholder',
            'Optional note, shown when you hover the preset');
        descRow.appendChild(descLabel);
        descRow.appendChild(descInput);
        content.appendChild(descRow);

        // Slot — the first nine print the key that recalls them
        const slotRow = document.createElement('div');
        slotRow.className = 'preset-field';
        const slotLabel = document.createElement('label');
        slotLabel.htmlFor = 'preset-save-slot';
        slotLabel.dataset.i18n = 'preset.slot';
        slotLabel.textContent = this._t('preset.slot', 'Slot');
        const slotSelect = document.createElement('select');
        slotSelect.id = 'preset-save-slot';
        for (const { slot: index, preset } of PresetService.listSlots()) {
            slotSelect.appendChild(this._slotOption(index, preset));
        }
        slotSelect.value = String(target);
        slotRow.appendChild(slotLabel);
        slotRow.appendChild(slotSelect);
        content.appendChild(slotRow);

        // Scopes
        const scopeBoxes = this._buildScopes(content, scopes);

        Dialog.open({
            id: 'preset-save',
            titleI18n: 'preset.saveTitle',
            title: 'Save Preset',
            content,
            className: 'preset-dialog',
            buttons: [
                { i18n: 'dialog.cancel', label: 'Cancel' },
                {
                    i18n: 'preset.saveButton', label: 'Save', primary: true,
                    onClick: () => {
                        const chosen = parseInt(slotSelect.value, 10);
                        const ids = scopeBoxes.selected();
                        if (!ids.length) {
                            alert(this._t('preset.needScope',
                                'Tick at least one thing for the preset to remember.'));
                            return false;
                        }
                        const existing = PresetService.get(chosen);
                        if (existing && !confirm(this._t('preset.confirmOverwrite',
                            'Slot {n} already holds "{name}". Replace it?')
                            .replace('{n}', String(chosen + 1))
                            .replace('{name}', existing.name))) {
                            return false;
                        }
                        PresetService.save(chosen, nameInput.value, ids, descInput.value)
                            .then((saved) => {
                                if (!saved) {
                                    alert(this._t('preset.saveFailed',
                                        'That preset could not be saved.'));
                                }
                            });
                        return true;
                    }
                }
            ]
        });

        nameInput.focus();
        nameInput.select();
    }

    /**
     * One slot entry, printing the key that recalls it where there is one.
     * @private
     */
    _slotOption(index, preset) {
        const option = document.createElement('option');
        option.value = String(index);

        const shortcut = PresetCodec.slotShortcut(index);
        const label = preset ? preset.name : this._t('preset.empty', '(empty)');
        option.textContent = `${index + 1}. ${label}` + (shortcut ? ` (${shortcut})` : '');
        if (preset && preset.description) option.title = preset.description;
        return option;
    }

    /**
     * A name the user can recognise before they have typed one: the active tool
     * and its size say more than "Preset 4" does.
     * @private
     */
    _suggestName(slot) {
        const toolId = StateManager.getCurrentTool();
        const tool = toolId ? ToolManager.getTool(toolId) : null;
        const label = this._t(`tool.${toolId}`, tool ? tool.name : '');
        const size = tool && typeof tool.getSize === 'function' ? tool.getSize() : null;
        if (label && Number.isFinite(size)) return `${label} ${size}px`;
        if (label) return label;
        return this._t('preset.defaultName', 'Preset {n}').replace('{n}', String(slot + 1));
    }

    /**
     * The scope checkboxes, built from the slice registry.
     * @returns {{ selected: Function }}
     * @private
     */
    _buildScopes(content, preselected = null) {
        const fieldset = document.createElement('div');
        fieldset.className = 'preset-scopes';

        const legend = document.createElement('p');
        legend.className = 'preset-scopes-legend';
        legend.dataset.i18n = 'preset.remember';
        legend.textContent = this._t('preset.remember', 'Remember');
        fieldset.appendChild(legend);

        const boxes = [];
        for (const slice of PresetService.SLICES) {
            const row = document.createElement('label');
            row.className = 'preset-scope';

            const box = document.createElement('input');
            box.type = 'checkbox';
            box.value = slice.id;
            box.checked = preselected ? preselected.includes(slice.id) : !!slice.defaultOn;
            boxes.push(box);

            const text = document.createElement('span');
            text.dataset.i18n = slice.i18n;
            text.textContent = this._t(slice.i18n, slice.id);

            row.appendChild(box);
            row.appendChild(text);
            fieldset.appendChild(row);
        }

        content.appendChild(fieldset);
        return { selected: () => boxes.filter(b => b.checked).map(b => b.value) };
    }

    // ── Manage ──────────────────────────────────────────────────────────────

    /** Open (or focus) the preset manager. */
    open() {
        if (Dialog.isOpen('preset-manager')) return;

        const content = document.createElement('div');
        content.className = 'preset-manager';

        const hint = document.createElement('p');
        hint.className = 'preset-manager-hint';
        hint.dataset.i18n = 'preset.managerHint';
        hint.textContent = this._t('preset.managerHint',
            'Load, rename or clear a slot. Presets remember your setup, never your artwork.');
        content.appendChild(hint);

        const list = document.createElement('div');
        list.className = 'preset-list';
        content.appendChild(list);

        // Hidden picker for the Import button — a .zxpreset arriving from
        // somebody else lands in the first free slot (never over one in use).
        const picker = document.createElement('input');
        picker.type = 'file';
        picker.accept = `.${PresetCodec.EXTENSION}`;
        picker.className = 'preset-file-input';
        picker.setAttribute('aria-hidden', 'true');
        picker.tabIndex = -1;
        picker.addEventListener('change', () => {
            const file = picker.files && picker.files[0];
            picker.value = '';
            if (file) this._import(file);
        });
        content.appendChild(picker);

        const render = () => this._renderList(list, render);
        render();

        // Our OWN label edits are not a reason to rebuild the list under the
        // user's hands: rename emits the library fact, and rebuilding on it
        // tore the focused input out of the DOM mid-keystroke — type a name,
        // Tab into the description, and the half-typed description went with
        // the row it lived in. The inputs already show what was typed, so
        // there is nothing to redraw.
        const off = EventBus.on(EVENTS.PRESET_LIBRARY_CHANGED, () => {
            if (this._editingLabel) return;
            render();
        });

        Dialog.open({
            id: 'preset-manager',
            titleI18n: 'preset.managerTitle',
            title: 'Presets',
            content,
            className: 'preset-dialog preset-manager-dialog',
            onClose: () => { if (typeof off === 'function') off(); },
            buttons: [
                {
                    i18n: 'preset.import', label: 'Import...',
                    onClick: () => { picker.click(); return false; }
                },
                {
                    i18n: 'preset.saveCurrent', label: 'Save current setup...',
                    onClick: () => { this.openSave(); return true; }
                },
                { i18n: 'dialog.close', label: 'Close', primary: true }
            ]
        });
    }

    /** @private */
    _renderList(list, rerender) {
        list.textContent = '';

        for (const { slot, preset } of PresetService.listSlots()) {
            const row = document.createElement('div');
            row.className = 'preset-row' + (preset ? '' : ' preset-row-empty');

            // The slot number, and the key that recalls it where there is one
            const number = document.createElement('span');
            number.className = 'preset-row-number';
            number.textContent = String(slot + 1);
            const shortcut = PresetCodec.slotShortcut(slot);
            if (shortcut) {
                number.title = shortcut;
                number.classList.add('preset-row-keyed');
            }
            row.appendChild(number);

            if (preset) {
                // Name and description are both editable in place: identifying
                // a slot is the point of it, and neither should need a dialog
                // of its own. Both save on change, and neither re-captures the
                // setup — they are labelling, not saving.
                const name = document.createElement('input');
                name.type = 'text';
                name.className = 'preset-row-name';
                name.value = preset.name;
                name.maxLength = PresetCodec.MAX_NAME;
                name.dataset.i18nAriaLabel = 'preset.name';
                name.setAttribute('aria-label', this._t('preset.name', 'Name'));
                if (preset.description) name.title = preset.description;
                name.addEventListener('change', () => {
                    this._renameLabel(slot, name.value, description.value);
                });
                row.appendChild(name);

                const description = document.createElement('input');
                description.type = 'text';
                description.className = 'preset-row-description';
                description.value = preset.description || '';
                description.maxLength = PresetCodec.MAX_DESCRIPTION;
                description.dataset.i18nPlaceholder = 'preset.descriptionShort';
                description.placeholder = this._t('preset.descriptionShort', 'Hover note');
                description.dataset.i18nAriaLabel = 'preset.description';
                description.setAttribute('aria-label',
                    this._t('preset.description', 'Description'));
                description.addEventListener('change', () => {
                    this._renameLabel(slot, name.value, description.value);
                });
                row.appendChild(description);

                const carries = document.createElement('span');
                carries.className = 'preset-row-carries';
                carries.textContent = Object.keys(preset.slices)
                    .map(id => {
                        const slice = PresetService.getSlice(id);
                        return slice ? this._t(slice.i18n, id) : id;
                    })
                    .join(', ');
                carries.title = carries.textContent;
                row.appendChild(carries);

                const actions = document.createElement('div');
                actions.className = 'preset-row-actions';
                actions.appendChild(this._action('preset.load', 'Load',
                    () => PresetService.apply(slot)));
                actions.appendChild(this._action('preset.replace', 'Replace',
                    () => this.openSave(slot)));
                actions.appendChild(this._action('preset.export', 'Export',
                    () => PresetFormat.downloadSlot(slot)));
                actions.appendChild(this._action('preset.delete', 'Delete', () => {
                    if (confirm(this._t('preset.confirmDelete', 'Delete "{name}"?')
                        .replace('{name}', preset.name))) {
                        PresetService.remove(slot).then(rerender);
                    }
                }));
                row.appendChild(actions);
            } else {
                const empty = document.createElement('span');
                empty.className = 'preset-row-name preset-row-empty-label';
                empty.dataset.i18n = 'preset.empty';
                empty.textContent = this._t('preset.empty', '(empty)');
                row.appendChild(empty);

                const descSpacer = document.createElement('span');
                descSpacer.className = 'preset-row-description';
                row.appendChild(descSpacer);

                const spacer = document.createElement('span');
                spacer.className = 'preset-row-carries';
                row.appendChild(spacer);

                const actions = document.createElement('div');
                actions.className = 'preset-row-actions';
                actions.appendChild(this._action('preset.saveHere', 'Save here',
                    () => this.openSave(slot)));
                row.appendChild(actions);
            }

            list.appendChild(row);
        }

        if (window.I18n && typeof I18n.apply === 'function') I18n.apply(list);
    }

    /**
     * Write a slot's name and description back, without the manager rebuilding
     * itself around the field the user is still in. See the subscription in
     * open() for what the flag is protecting.
     * @private
     */
    async _renameLabel(slot, name, description) {
        this._editingLabel = true;
        try {
            await PresetService.rename(slot, name, description);
        } finally {
            this._editingLabel = false;
        }
    }

    /** @private */
    _action(i18n, fallback, onClick) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'panel-button preset-row-button';
        btn.dataset.i18n = i18n;
        btn.dataset.i18nTitleName = i18n;
        btn.dataset.i18nTitle = `${i18n}.hint`;
        btn.textContent = this._t(i18n, fallback);
        btn.title = Helpers.composeTitle(this._t(i18n, fallback), this._t(`${i18n}.hint`, ''));
        btn.addEventListener('click', onClick);
        return btn;
    }

    /** @private */
    async _import(file) {
        const slot = PresetService.firstFreeSlot();
        if (slot === -1) {
            alert(this._t('preset.full',
                'Every preset slot is full. Delete one in the preset manager first.'));
            return;
        }
        try {
            const text = await Helpers.readFileAsText(file);
            const stored = await PresetService.fromFile(text, slot);
            if (!stored) {
                alert(this._t('preset.importFailed', 'That file is not a valid preset.'));
            }
        } catch (error) {
            Logger.warn('PresetDialog', 'Import failed', error);
            alert(this._t('preset.importFailed', 'That file is not a valid preset.'));
        }
    }
}

window.PresetDialog = new PresetDialogClass();

Logger.debug('PresetDialog', 'Preset dialog loaded');

})(); // End IIFE
