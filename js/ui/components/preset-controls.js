'use strict';
(function() {

/**
 * PresetControls — the ONE source of preset-control markup.
 *
 * Three places show a panel its own presets: the row at the foot of the Tool
 * Options panel, the Presets panel under it, and the Reference panel. They must
 * look and behave identically, because they ARE the same thing pointed at
 * different scopes — so the markup lives here and they each ask for a piece of
 * it, exactly as tool option rows come from OptionControls and panel chrome
 * from the tpl-panel template.
 *
 * Two pieces:
 *   buildRow(scope)   the compact Load list + Save button
 *   buildList(scope)  the readable list, each entry with rename and delete
 *
 * Both return a handle carrying `element`, `refresh()` and `setScope(id)`. The
 * caller owns WHEN to refresh — the Tool Options row follows the active tool,
 * the Reference panel never changes scope at all — but never HOW to render.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

/** English fallback until I18n has the key. */
function t(key, fallback, params) {
    if (window.I18n && typeof I18n.t === 'function') {
        const v = I18n.t(key, params);
        if (v && v !== key) return v;
    }
    return fallback;
}

/** Fill {placeholders} the locale table left for us. */
function interpolate(text, params) {
    return String(text).replace(/\{(\w+)\}/g,
        (match, key) => (params && params[key] !== undefined ? params[key] : match));
}

class PresetControlsClass {
    /**
     * The label a scope goes by: a tool's rail name, or a non-tool scope's own.
     * @param {string} scopeId
     * @returns {string}
     */
    scopeLabel(scopeId) {
        const scope = PresetService.getPresetScope(scopeId);
        if (scope) return t(scope.i18n, scopeId);

        const meta = Helpers.toolRailMeta(scopeId);
        if (meta && meta.i18n) return t(meta.i18n, meta.label || scopeId);
        const tool = ToolManager.getTool(scopeId);
        return (tool && tool.name) || scopeId || '';
    }

    /**
     * Load list + Save button.
     * @param {string} scopeId
     * @param {Object} [opts]
     * @param {string} [opts.idPrefix] - ids for the two controls (tests, labels)
     * @returns {{ element, refresh, setScope }}
     */
    buildRow(scopeId, opts = {}) {
        const prefix = opts.idPrefix || 'tool-preset';
        const row = document.createElement('div');
        row.className = 'preset-bar';

        // A <select> rather than a button that opens a menu: it names itself,
        // it lists in one click, and it is the control the app already uses
        // everywhere else a short list is chosen from.
        const select = document.createElement('select');
        select.id = `${prefix}-select`;
        select.className = 'preset-bar-select';
        select.dataset.i18nTitle = 'toolPreset.loadHint';
        select.title = t('toolPreset.loadHint',
            'Load a saved setting for the tool you are holding');
        row.appendChild(select);

        const save = document.createElement('button');
        save.type = 'button';
        save.id = `${prefix}-save`;
        save.className = 'panel-button preset-bar-button';
        save.dataset.i18n = 'toolPreset.save';
        save.textContent = t('toolPreset.save', 'Save preset...');
        save.dataset.i18nTitle = 'toolPreset.saveHint';
        save.title = t('toolPreset.saveHint',
            'Save the current settings of this tool under a name');
        row.appendChild(save);

        const handle = { element: row, scope: scopeId };

        select.addEventListener('change', () => {
            const name = select.value;
            if (name) PresetService.applyToolPreset(handle.scope, name);
            // A menu of actions, not a display of state: returning it to the
            // prompt is what lets the same entry be picked twice running (a
            // <select> fires no change event for the value it already holds).
            select.value = '';
        });

        save.addEventListener('click', () => ToolPresetDialog.openSave(handle.scope));

        handle.refresh = () => {
            const scope = handle.scope;
            const presets = scope ? PresetService.listToolPresets(scope) : [];
            select.textContent = '';

            const placeholder = document.createElement('option');
            placeholder.value = '';
            placeholder.dataset.i18n = presets.length ? 'toolPreset.load' : 'toolPreset.none';
            placeholder.textContent = presets.length
                ? t('toolPreset.load', 'Load preset...')
                : t('toolPreset.none', 'No presets for this tool');
            select.appendChild(placeholder);

            for (const preset of presets) {
                const option = document.createElement('option');
                option.value = preset.name;
                option.textContent = preset.name;
                select.appendChild(option);
            }

            select.disabled = presets.length === 0;
            select.value = '';

            // Saving is refused when the scope has nothing to capture — the
            // Reference panel with no image is the case this is for. Disabled
            // rather than hidden: the control belongs here, it simply has
            // nothing to work on yet, and its tooltip says which.
            const ready = scope && PresetService.toolSupportsPresets(scope);
            save.disabled = !ready;
            save.dataset.i18nTitle = ready ? 'toolPreset.saveHint' : 'toolPreset.nothingToSave';
            save.title = ready
                ? t('toolPreset.saveHint', 'Save the current settings of this tool under a name')
                : t('toolPreset.nothingToSave', 'Nothing to save yet');
        };

        handle.setScope = (id) => { handle.scope = id; handle.refresh(); };

        handle.refresh();
        return handle;
    }

    /**
     * The readable list: one row per preset, its name the load button, with
     * rename and delete beside it.
     * @param {string} scopeId
     * @returns {{ element, refresh, setScope }}
     */
    buildList(scopeId) {
        const host = document.createElement('div');
        host.className = 'preset-list-host';

        const handle = { element: host, scope: scopeId };

        handle.refresh = () => {
            host.textContent = '';
            const scope = handle.scope;
            if (!scope) return;

            const presets = PresetService.listToolPresets(scope);
            if (!presets.length) {
                const note = document.createElement('p');
                note.className = 'no-options';
                note.dataset.i18n = 'toolPreset.panelEmpty';
                note.textContent = t('toolPreset.panelEmpty',
                    'No presets yet. Set this tool up the way you want it, then Save preset.');
                host.appendChild(note);
                return;
            }

            const list = document.createElement('ul');
            list.className = 'preset-panel-list';
            for (const preset of presets) list.appendChild(this._row(scope, preset));
            host.appendChild(list);
        };

        handle.setScope = (id) => { handle.scope = id; handle.refresh(); };

        handle.refresh();
        return handle;
    }

    /**
     * The whole library: every preset of every scope, newest scope order.
     *
     * Different from `buildList` in what it is FOR. That one answers "what has
     * this tool got?" and shows names, because within one tool the name is the
     * only thing telling two entries apart. This answers "what have I got?"
     * across everything, where the name is the least useful thing on the row —
     * you are scanning for a TOOL and a SETUP, and "Fat marker" tells you
     * neither. So the row leads with the tool and what the preset changes, and
     * the name you chose is on hover, where a reminder belongs.
     *
     * Loading from here SELECTS the preset's tool first. A list that spans
     * tools would otherwise be a list where most rows appear to do nothing.
     * @returns {{ element, refresh }}
     */
    buildLibraryList() {
        const host = document.createElement('div');
        host.className = 'preset-list-host preset-library';

        const handle = { element: host };

        handle.refresh = () => {
            host.textContent = '';
            const all = PresetService.listAllToolPresets();

            if (!all.length) {
                const note = document.createElement('p');
                note.className = 'no-options';
                note.dataset.i18n = 'toolPreset.libraryEmpty';
                note.textContent = t('toolPreset.libraryEmpty',
                    'No presets saved yet. Set a tool up the way you want it, then Save preset.');
                host.appendChild(note);
                return;
            }

            const list = document.createElement('ul');
            list.className = 'preset-panel-list';
            for (const { scope, preset } of all) list.appendChild(this._libraryRow(scope, preset));
            host.appendChild(list);
        };

        handle.refresh();
        return handle;
    }

    /** @private */
    _libraryRow(scopeId, preset) {
        const item = document.createElement('li');
        item.className = 'preset-panel-item preset-library-item';

        const load = document.createElement('button');
        load.type = 'button';
        load.className = 'preset-panel-load preset-library-load';
        load.dataset.presetName = preset.name;
        load.dataset.presetScope = scopeId;

        // Line one: which tool. Line two: what it changes about that tool.
        const scopeEl = document.createElement('span');
        scopeEl.className = 'preset-library-scope';
        scopeEl.textContent = this.scopeLabel(scopeId);
        load.appendChild(scopeEl);

        const settings = document.createElement('span');
        settings.className = 'preset-library-settings';
        settings.textContent = this.describeSettings(scopeId, preset.options);
        load.appendChild(settings);

        // The name you gave it, where a reminder belongs
        load.title = preset.name;
        load.addEventListener('click', () => this.loadFromLibrary(scopeId, preset.name));
        item.appendChild(load);

        item.appendChild(this._iconButton('icon-rename', 'toolPreset.rename', 'Rename',
            () => ToolPresetDialog.openRename(scopeId, preset.name)));

        item.appendChild(this._iconButton('icon-trash', 'toolPreset.delete', 'Delete', () => {
            const question = interpolate(
                t('toolPreset.confirmDelete', 'Delete the preset "{name}"?',
                    { name: preset.name }), { name: preset.name });
            if (confirm(question)) PresetService.removeToolPreset(scopeId, preset.name);
        }));

        return item;
    }

    /**
     * "Size: 1, Brush Type: Round" — what the preset changes, localized.
     *
     * Only the settings that differ from the tool's defaults (PresetService
     * decides which those are). A select prints its option's LABEL, not its
     * stored value: "Round", never "round".
     * @param {string} scopeId @param {Object} options
     * @returns {string}
     */
    describeSettings(scopeId, options) {
        const parts = [];
        for (const { entry, value } of PresetService.describeToolPreset(scopeId, options)) {
            parts.push(`${t(entry.i18n, entry.label || entry.key)}: ${this._valueLabel(entry, value)}`);
        }
        return parts.length
            ? parts.join(', ')
            : t('toolPreset.allDefaults', 'the default settings');
    }

    /** @private */
    _valueLabel(entry, value) {
        if (entry.type === 'check') {
            return value ? t('common.on', 'On') : t('common.off', 'Off');
        }
        if (entry.type === 'select' || entry.type === 'icons') {
            const found = this._findOption(entry, value);
            if (found) return found.label || t(found.i18n, String(value));
        }
        return entry.unit ? `${value}${entry.unit}` : String(value);
    }

    /** Walk a select's entries (optgroups included) for one value. @private */
    _findOption(entry, value) {
        const walk = (options) => {
            for (const opt of options || []) {
                if (opt && Array.isArray(opt.options)) {
                    const hit = walk(opt.options);
                    if (hit) return hit;
                } else if (opt && String(opt.value) === String(value)) {
                    return opt;
                }
            }
            return null;
        };
        return walk(entry.presetOptions || entry.options);
    }

    /**
     * Load a preset from the library, taking its tool in hand first.
     *
     * `keepSize` because selecting a brush VARIANT raises the size to that
     * variant's floor, which would throw away the size the preset is about to
     * restore — the floor is for a fresh button press, and this is not one.
     * @param {string} scopeId @param {string} name
     */
    loadFromLibrary(scopeId, name) {
        if (!PresetService.getPresetScope(scopeId) && ToolManager.getTool(scopeId)) {
            ToolManager.selectTool(scopeId, { keepSize: true });
        }
        PresetService.applyToolPreset(scopeId, name);
    }

    /**
     * One preset: its name loads it, two icon buttons relabel and remove it.
     * The name is the button rather than sitting beside one, because loading is
     * what the row is FOR and a target the width of the panel is a target a pen
     * can hit.
     * @private
     */
    _row(scopeId, preset) {
        const item = document.createElement('li');
        item.className = 'preset-panel-item';

        const load = document.createElement('button');
        load.type = 'button';
        load.className = 'preset-panel-load';
        load.textContent = preset.name;
        load.dataset.presetName = preset.name;
        load.title = interpolate(
            t('toolPreset.loadNamed', 'Load "{name}"', { name: preset.name }),
            { name: preset.name });
        load.addEventListener('click', () => PresetService.applyToolPreset(scopeId, preset.name));
        item.appendChild(load);

        item.appendChild(this._iconButton('icon-rename', 'toolPreset.rename', 'Rename',
            () => ToolPresetDialog.openRename(scopeId, preset.name)));

        item.appendChild(this._iconButton('icon-trash', 'toolPreset.delete', 'Delete', () => {
            const question = interpolate(
                t('toolPreset.confirmDelete', 'Delete the preset "{name}"?',
                    { name: preset.name }), { name: preset.name });
            if (confirm(question)) PresetService.removeToolPreset(scopeId, preset.name);
        }));

        return item;
    }

    /** @private */
    _iconButton(icon, i18n, fallback, onClick) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'preset-panel-action';
        btn.dataset.i18nTitle = i18n;
        btn.title = t(i18n, fallback);
        btn.dataset.i18nAriaLabel = i18n;
        btn.setAttribute('aria-label', t(i18n, fallback));

        const svg = document.createElementNS(SVG_NS, 'svg');
        svg.setAttribute('aria-hidden', 'true');
        const use = document.createElementNS(SVG_NS, 'use');
        use.setAttribute('href', `#${icon}`);
        svg.appendChild(use);
        btn.appendChild(svg);

        btn.addEventListener('click', onClick);
        return btn;
    }

    /** A Save button for a panel that wants one of its own. */
    buildSaveButton(scopeId) {
        const save = document.createElement('button');
        save.type = 'button';
        save.className = 'panel-button preset-panel-save';
        save.dataset.i18n = 'toolPreset.save';
        save.textContent = t('toolPreset.save', 'Save preset...');
        save.addEventListener('click', () => ToolPresetDialog.openSave(scopeId));
        return save;
    }
}

window.PresetControls = new PresetControlsClass();

Logger.debug('PresetControls', 'Preset controls loaded');

})(); // End IIFE
