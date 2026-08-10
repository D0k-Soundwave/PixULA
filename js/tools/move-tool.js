'use strict';
(function() {

/**
 * Pan Tool (rail label "Pan"; the tool id stays 'transform' — see TOOLS.MOVE)
 *
 * Pans the canvas viewport when zoomed. Click and drag to pan the view.
 * All viewport access goes through CanvasSystem (the one allowlisted DOM
 * owner) — the tool itself only tracks pointer deltas.
 */
class MoveToolClass extends ToolBase {
    /** Declarative options - rendered by OptionControls (contract in tool-base.js). */
    static optionsSchema = [
        { type: 'hint', i18n: 'move.useTransform' }
    ];

    constructor() {
        super(TOOLS.MOVE, 'Pan');
        this.cursor = 'grab';
        this.startX = 0;
        this.startY = 0;
        this.initialScrollX = 0;
        this.initialScrollY = 0;
        this.isPanning = false;
    }

    activate() {
        super.activate();
        CanvasSystem.setCanvasCursor('grab');
    }

    deactivate() {
        this.isPanning = false;
        CanvasSystem.setCanvasCursor('default');
        super.deactivate();
    }

    /**
     * Handle pointer down - start panning
     * @param {number} pixelX - X coordinate in pixel space
     * @param {number} pixelY - Y coordinate in pixel space
     * @param {PointerEvent} e - Pointer event
     */
    onPointerDown(pixelX, pixelY, e) {
        this.isPanning = true;
        this.startX = e.clientX;
        this.startY = e.clientY;

        const scroll = CanvasSystem.getScrollPosition();
        this.initialScrollX = scroll.x;
        this.initialScrollY = scroll.y;

        CanvasSystem.setCanvasCursor('grabbing');
    }

    /**
     * Handle pointer move - pan the view
     * @param {number} pixelX - X coordinate in pixel space
     * @param {number} pixelY - Y coordinate in pixel space
     * @param {PointerEvent} e - Pointer event
     */
    onPointerMove(pixelX, pixelY, e) {
        if (!this.isPanning) return;

        const deltaX = e.clientX - this.startX;
        const deltaY = e.clientY - this.startY;

        CanvasSystem.setScrollPosition(
            this.initialScrollX - deltaX,
            this.initialScrollY - deltaY
        );
    }

    /**
     * Handle pointer up - stop panning
     */
    onPointerUp(pixelX, pixelY, e) {
        this.isPanning = false;
        CanvasSystem.setCanvasCursor('grab');
    }

    /**
     * Handle pointer leave - stop panning
     */
    onPointerLeave(e) {
        this.isPanning = false;
        CanvasSystem.setCanvasCursor('grab');
    }

    /**
     * No hover footprint — panning moves the viewport, it never touches a pixel.
     * @returns {null}
     */
    getFootprint() {
        return null;
    }

    /**
     * Reset pan to origin
     */
    resetPan() {
        CanvasSystem.setScrollPosition(0, 0);
        Logger.debug('MoveTool', 'Pan reset');
    }
}

// Expose to global scope
window.MoveTool = MoveToolClass;

Logger.debug('MoveTool', 'Move tool loaded');

})(); // End IIFE
