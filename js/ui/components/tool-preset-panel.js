'use strict';
(function() {

/**
 * ToolPresetPanel — the Presets panel in the right sidebar.
 *
 * Ordinary sidebar chrome, stamped from the same #tpl-panel template as Layers,
 * Tool Options, Transform and Reference, so it collapses, remembers whether it
 * was open and sits in the same scroll as everything else.
 *
 * IT SHOWS EVERYTHING, FROM EVERY TOOL. This is the library; the Load list at
 * the foot of each tool's options is the shelf. The two answer different
 * questions and so they show different things: within one tool the NAME is all
 * that separates two entries, but scanning everything you own you are looking
 * for a tool and a setup, and "Fat marker" tells you neither. So a row here
 * leads with the tool and with what the preset actually changes, and the name
 * you chose is on hover.
 *
 * Loading from here takes that preset's tool in hand first, because a list
 * spanning tools would otherwise be a list where most rows appear to do
 * nothing. That does not weaken the scoping rule — a TOOL still cannot load
 * another tool's preset; you are picking the tool as well as the preset.
 *
 * Saving still belongs to the tool in hand, so the Save button names it.
 * Renders from EVENTS.TOOL_PRESETS_CHANGED (any scope) and TOOL_SELECTED (only
 * to relabel that button).
 */
class ToolPresetPanelClass {
    constructor() {
        this._content = null;
        this._panelSection = null;
        this._toolId = null;
        this._initialized = false;
    }

    /** @private */
    _t(key, fallback, params) {
        if (window.I18n && typeof I18n.t === 'function') {
            const v = I18n.t(key, params);
            if (v && v !== key) return v;
        }
        return fallback;
    }

    init() {
        if (this._initialized) return;

        const panel = PanelSection.create({
            id: 'tool-preset-panel',
            titleI18n: 'panels.presets',
            title: 'Presets',
            hintI18n: 'panels.presets.hint',
            hint: 'Every tool\'s saved presets in one library - load, rename or delete any of them. Right-click this header to move the whole panel up or down',
            // Visibility here is driven by showPresetsPanel, not the View
            // menu's generic add/remove — opt out of PanelSection's own
            // save/restore sweep so it can't reapply a stale snapshot over
            // whatever the preference just set (see panel-section.js).
            persistVisibility: false
        });
        if (!panel) {
            Logger.error('ToolPresetPanel', 'Could not create presets panel');
            return;
        }
        this._content = panel.content;
        this._panelSection = panel.section;

        EventBus.on(EVENTS.TOOL_SELECTED, (data) => {
            this._toolId = (data && data.currentTool) || null;
            this._render();
        });
        // Any scope's change, not just the active tool's: this list spans them.
        EventBus.on(EVENTS.TOOL_PRESETS_CHANGED, () => this._render());
        // Preferences > General "Show Presets panel" toggle, applied live —
        // no reload needed to hide or reveal the whole section.
        EventBus.on(EVENTS.STATE_CHANGED, (data) => {
            if (data && data.path === 'showPresetsPanel') this._syncVisibility();
        });

        this._toolId = StateManager.getCurrentTool();
        this._render();
        this._syncVisibility();

        this._initialized = true;
        Logger.info('ToolPresetPanel', 'Initialized');
    }

    /** @private */
    _syncVisibility() {
        if (!this._panelSection) return;
        // Routed through PanelSection.setVisible() rather than a direct
        // style.display write, so this is the ONE place that moves the
        // section (it also fires PANEL_VISIBILITY_CHANGED, which is what
        // lets the View menu's checkbox stay in sync — see menu-system.js's
        // _PANEL_MENU_ITEM_BY_SECTION).
        PanelSection.setVisible('tool-preset-panel', StateManager.get('showPresetsPanel') === true);
    }

    /** @private */
    _render() {
        if (!this._content) return;
        this._content.textContent = '';

        this._list = PresetControls.buildLibraryList();
        this._content.appendChild(this._list.element);

        // Saving still belongs to the tool in hand — there is no such thing as
        // saving "a preset" without a tool to save it from. But the BUTTON does
        // not say so: this panel lists every tool, and a button reading "Save
        // Brush preset..." under a list of everything reads as though the panel
        // itself were about the brush. The tool it will save is in the tooltip,
        // where naming it costs the panel no claim it should not make.
        //
        // A scope with nothing capturable (the eyedropper, the Reference panel
        // before an image is loaded) gets no button rather than one that refuses.
        const scope = this._toolId;
        if (scope && PresetService.toolSupportsPresets(scope)) {
            const save = PresetControls.buildSaveButton(scope);
            const label = PresetControls.scopeLabel(scope);
            save.title = Helpers.interpolate(
                this._t('toolPreset.saveForHint',
                    'Saves the settings of the tool you are holding ({tool})', { tool: label }),
                { tool: label });
            // This tooltip is parameterised, so it must not ALSO carry a plain
            // data-i18n-title: I18n.apply would translate that key with no
            // parameters and put the raw {tool} back. buildSaveButton sets none
            // today; the delete is what keeps that from becoming a silent bug
            // the day it does.
            delete save.dataset.i18nTitle;
            this._content.appendChild(save);
        }

        if (window.I18n && typeof I18n.apply === 'function') I18n.apply(this._content);
    }
}

window.ToolPresetPanel = new ToolPresetPanelClass();

Logger.debug('ToolPresetPanel', 'Tool preset panel loaded');

})(); // End IIFE
