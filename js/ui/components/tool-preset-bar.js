'use strict';
(function() {

/**
 * ToolPresetBar — save and reload THIS tool's settings, from where they are set.
 *
 * One row at the foot of the Tool Options panel: a Load list and a Save button,
 * both scoped to the tool currently in hand. It replaced a row that recalled
 * whole-workspace presets from the same spot, and the change is the point:
 * a control sitting under the brush's sliders should do something to the brush,
 * not move the canvas and swap the reference photo.
 *
 * SCOPED BY RAIL ID, NOT BY CLASS. The list is filed under the id of the button
 * the artist pressed — spray and fade and hatch are separate lists, even though
 * one BrushTool serves all three. Filing by class would put a fade setup in the
 * spray's list, where it would restore correctly and leave the rail lit on the
 * wrong button; and "each tool's own presets" has to mean the tools as the rail
 * presents them, or it means nothing an artist can predict.
 *
 * A TOOL WITH NO OPTIONS GETS NO ROW. Zoom and pan have nothing to capture, and
 * two buttons that can only ever report emptiness are worse than no buttons.
 *
 * The row is inserted into the panel SECTION rather than its content element,
 * because OptionControls empties that content on every tool change; via
 * PanelSection.addExtra, so collapsing the panel folds the row away too.
 *
 * Renders from EVENTS.TOOL_SELECTED / TOOL_PRESETS_CHANGED facts only.
 */
class ToolPresetBarClass {
    constructor() {
        this._row = null;
        this._controls = null;
        this._toolId = null;
        this._initialized = false;
    }

    init() {
        if (this._initialized) return;

        const panel = document.getElementById('tool-options-panel');
        if (!panel) {
            Logger.warn('ToolPresetBar', 'Tool options panel not found; preset row not shown');
            return;
        }

        // The markup is PresetControls' — the Reference panel shows the same
        // row, and two hand-built copies would drift.
        this._controls = PresetControls.buildRow(StateManager.getCurrentTool());
        this._row = this._controls.element;
        this._row.id = 'tool-preset-bar';
        if (!PanelSection.addExtra('tool-options-panel', this._row)) {
            panel.appendChild(this._row);
        }

        EventBus.on(EVENTS.TOOL_SELECTED, (data) => this._setTool(data && data.currentTool));
        EventBus.on(EVENTS.TOOL_PRESETS_CHANGED, (data) => {
            if (!data || !data.tool || data.tool === this._toolId) this._refresh();
        });

        this._setTool(StateManager.getCurrentTool());
        if (window.I18n && typeof I18n.apply === 'function') I18n.apply(this._row);

        this._initialized = true;
        Logger.info('ToolPresetBar', 'Initialized');
    }

    /** @private */
    _setTool(toolId) {
        this._toolId = toolId || null;
        this._refresh();
    }

    /** @private */
    _refresh() {
        if (!this._row || !this._controls) return;

        // Hidden rather than disabled: a disabled pair of controls still asks
        // to be read, and there is nothing here to say about a tool that has
        // no settings at all. (A scope that merely has nothing to capture YET,
        // like the Reference panel before an image is loaded, keeps its
        // controls — that judgement lives in PresetService.hasPresetScope.)
        const supported = this._toolId && PresetService.toolSupportsPresets(this._toolId);
        this._row.hidden = !supported;
        if (!supported) return;

        this._controls.setScope(this._toolId);
    }
}

window.ToolPresetBar = new ToolPresetBarClass();

Logger.debug('ToolPresetBar', 'Tool preset bar loaded');

})(); // End IIFE
