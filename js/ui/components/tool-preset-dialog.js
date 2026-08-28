'use strict';
(function() {

/**
 * ToolPresetDialog — the one question a tool preset needs answered.
 *
 * Saving asks for a NAME and nothing else. There is no slot to choose (the
 * tool it belongs to is the tool in your hand) and nothing to tick (a tool
 * preset carries that tool's options, all of them, always). The field opens
 * pre-filled with a name that is already free, so filing a setup is Enter.
 *
 * Renaming is the same dialog with the field pre-filled with the current name,
 * because "give this a better name" and "give this a name" are one question.
 *
 * The slotted workspace preset has its own, larger dialog (preset-dialog.js):
 * that one has a slot, a description and seven things to tick, because it can
 * carry seven different kinds of state into one of 24 places. Keeping the two
 * apart is the point — this dialog is small because the thing it saves is.
 */
class ToolPresetDialogClass {
    /** @private */
    _t(key, fallback, params) {
        if (window.I18n && typeof I18n.t === 'function') {
            const v = I18n.t(key, params);
            if (v && v !== key) return v;
        }
        return fallback;
    }

    /** The tool's own label, so the dialog says which tool it is saving. @private */
    _toolLabel(toolId) {
        const meta = Helpers.toolRailMeta(toolId);
        if (meta && meta.i18n) return this._t(meta.i18n, meta.label || toolId);
        const tool = ToolManager.getTool(toolId);
        return (tool && tool.name) || toolId;
    }

    /**
     * Save the tool's current settings under a name.
     * @param {string} toolId - rail id of the tool being saved
     */
    openSave(toolId) {
        if (!toolId || Dialog.isOpen('tool-preset-save')) return;

        if (!PresetService.toolSupportsPresets(toolId)) {
            Logger.warn('ToolPresetDialog', `Tool ${toolId} has no options to save`);
            return;
        }

        const label = this._toolLabel(toolId);
        this._prompt({
            id: 'tool-preset-save',
            titleI18n: 'toolPreset.saveTitle',
            title: 'Save Tool Preset',
            promptI18n: 'toolPreset.savePrompt',
            prompt: 'Save the current {tool} settings as:',
            params: { tool: label },
            value: PresetService.suggestToolPresetName(toolId, label),
            confirmI18n: 'toolPreset.saveButton',
            confirm: 'Save',
            onConfirm: (name) => {
                // Re-saving over a name is the commonest thing here, so it is
                // allowed — but never silently: the entry it replaces is one
                // the user filed on purpose.
                const existing = PresetService.getToolPreset(toolId, name);
                if (existing) {
                    const question = Helpers.interpolate(this._t('toolPreset.confirmOverwrite',
                        'This tool already has a preset called "{name}". Replace it?',
                        { name: existing.name }), { name: existing.name });
                    if (!confirm(question)) return false;
                }
                PresetService.saveToolPreset(toolId, name);
                return true;
            }
        });
    }

    /**
     * Relabel an existing tool preset.
     * @param {string} toolId @param {string} name
     */
    openRename(toolId, name) {
        if (!toolId || !name || Dialog.isOpen('tool-preset-save')) return;

        this._prompt({
            id: 'tool-preset-save',
            titleI18n: 'toolPreset.renameTitle',
            title: 'Rename Preset',
            promptI18n: 'toolPreset.renamePrompt',
            prompt: 'New name for "{name}":',
            params: { name },
            value: name,
            confirmI18n: 'dialog.ok',
            confirm: 'OK',
            // Decided synchronously: Dialog treats anything that is not
            // exactly `false` as "close me", so a promise would close the
            // dialog before its own answer arrived. The clash is knowable
            // here without waiting for the write.
            onConfirm: (next) => {
                const clash = PresetService.getToolPreset(toolId, next);
                if (clash && clash.name !== name) {
                    alert(this._t('toolPreset.nameTaken',
                        'This tool already has a preset with that name.'));
                    return false;
                }
                PresetService.renameToolPreset(toolId, name, next);
                return true;
            }
        });
    }

    /**
     * One text field, one confirm button. Enter confirms — the whole reason
     * this dialog exists is that naming a preset should cost one keystroke.
     * @private
     */
    _prompt({ id, titleI18n, title, promptI18n, prompt, params, value,
              confirmI18n, confirm: confirmLabel, onConfirm }) {
        const content = document.createElement('div');
        content.className = 'preset-save';

        const field = document.createElement('div');
        field.className = 'preset-field';

        // Deliberately NOT stamped with data-i18n: I18n.apply re-translates
        // such an element with no parameters, so on a locale change this label
        // would come back reading "Save the current {tool} settings as:". A
        // dialog does not outlive a language switch, so the one-shot
        // translation here is the whole of what it needs.
        const labelEl = document.createElement('label');
        labelEl.htmlFor = 'tool-preset-name';
        labelEl.textContent = Helpers.interpolate(this._t(promptI18n, prompt, params), params);

        const input = document.createElement('input');
        input.type = 'text';
        input.id = 'tool-preset-name';
        input.maxLength = PresetCodec.MAX_NAME;
        input.value = value || '';

        field.appendChild(labelEl);
        field.appendChild(input);
        content.appendChild(field);

        const commit = () => {
            const name = input.value.trim();
            if (!name) {
                input.focus();
                return false;
            }
            return onConfirm(name);
        };

        input.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            if (commit() !== false) Dialog.close(id);
        });

        Dialog.open({
            id,
            titleI18n,
            title,
            content,
            className: 'preset-dialog',
            buttons: [
                { i18n: 'dialog.cancel', label: 'Cancel' },
                { i18n: confirmI18n, label: confirmLabel, primary: true, onClick: commit }
            ]
        });

        input.focus();
        input.select();
    }
}

window.ToolPresetDialog = new ToolPresetDialogClass();

Logger.debug('ToolPresetDialog', 'Tool preset dialog loaded');

})(); // End IIFE
