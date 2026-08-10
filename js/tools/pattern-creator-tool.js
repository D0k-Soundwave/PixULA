'use strict';
(function() {

/**
 * Pattern Creator Tool
 *
 * Selecting this tool opens the Pattern Creator modal editor.
 * All drawing happens inside the modal's own canvas — this tool
 * does not interact with the main ZX Spectrum canvas at all.
 */
class PatternCreatorToolClass extends ToolBase {
    /** No options panel - the tool opens the Pattern Creator modal instead. */
    static optionsSchema = [];

    constructor() {
        super(TOOLS.PATTERN_CREATOR, 'Pattern Creator');
        this.cursor = 'default';
    }

    activate() {
        super.activate();
        if (window.PatternCreatorPanel) PatternCreatorPanel.open();
    }

    onPointerDown() {}
    onPointerMove() {}
    onPointerUp() {}
    onPointerLeave() {}

    /** No hover footprint — this tool never touches the main canvas. */
    getFootprint() { return null; }
}

window.PatternCreatorTool = PatternCreatorToolClass;

Logger.debug('PatternCreatorTool', 'Pattern creator tool loaded');

})(); // End IIFE
