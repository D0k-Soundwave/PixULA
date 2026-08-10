'use strict';
(function() {

/**
 * Zoom Tool
 *
 * Left-click: zoom in (+100%). Right-click: zoom out (-100%).
 * Zoom state lives in StateManager — setZoom emits EVENTS.CANVAS_ZOOM and
 * CanvasSystem rescales in response. This tool never emits events or touches
 * the DOM; viewport metrics come from CanvasSystem.
 */
class ZoomToolClass extends ToolBase {
    /** Declarative options - rendered by OptionControls (contract in tool-base.js).
     *  Levels come from ZOOM_CONFIG.LEVELS — the same list the canvas strip's
     *  #zoom-level select renders, so the two selectors can never drift.
     *  syncEvent keeps the select tracking zoom changes made elsewhere
     *  (strip select, +/- buttons, wheel, pinch) while the tool is active. */
    static optionsSchema = [
        { type: 'select', key: 'zoomLevel', setter: 'setZoom', i18n: 'opt.zoomLevel', value: ZOOM_CONFIG.DEFAULT,
          options: ZOOM_CONFIG.LEVELS.map(z => ({ value: z, label: z + '%' })),
          syncEvent: EVENTS.CANVAS_ZOOM }
    ];

    constructor() {
        super(TOOLS.ZOOM, 'Zoom');
        this.cursor = 'zoom-in';
        this._drag = null;           // { startX, startY, x, y, button, threshold, marquee }
        this._marqueeCanvas = null;  // lazy overlay for the drag rectangle
    }

    /** Options-panel value (OptionControls getter contract). Snapped to the
     *  nearest LEVELS entry — pinch zoom can hold values between levels, and
     *  a select with no matching option renders blank. */
    getZoomLevel() {
        return ZOOM_CONFIG.snap(StateManager.getZoom());
    }

    activate() {
        super.activate();
        CanvasSystem.setCanvasCursor('zoom-in');
    }

    deactivate() {
        this._clearMarquee();
        this._drag = null;
        CanvasSystem.setCanvasCursor('default');
        super.deactivate();
    }

    /**
     * Handle pointer down — arm a click-or-marquee gesture. The zoom itself
     * happens on pointer up: a still click steps the LADDER around the
     * clicked pixel, a left drag zooms the marqueed region to fill the view.
     * @param {number} pixelX - X coordinate in pixel space
     * @param {number} pixelY - Y coordinate in pixel space
     * @param {PointerEvent} e - Pointer event
     */
    onPointerDown(pixelX, pixelY, e) {
        // Drag threshold ≈ 6 screen px expressed in canvas pixels
        const zoom = StateManager.getZoom() || ZOOM_CONFIG.DEFAULT;
        this._drag = {
            startX: pixelX, startY: pixelY, x: pixelX, y: pixelY,
            button: e.button,
            threshold: Math.max(1, Math.round(600 / zoom)),
            marquee: false
        };
    }

    /**
     * Handle pointer move - track the marquee / reflect direction in the cursor
     */
    onPointerMove(pixelX, pixelY, e) {
        const d = this._drag;
        if (d && d.button === 0 && (e.buttons & 1)) {
            d.x = pixelX;
            d.y = pixelY;
            if (!d.marquee &&
                (Math.abs(pixelX - d.startX) >= d.threshold ||
                 Math.abs(pixelY - d.startY) >= d.threshold)) {
                d.marquee = true;
            }
            if (d.marquee) {
                this._drawMarquee();
                return;
            }
        }
        CanvasSystem.setCanvasCursor((e.buttons & 2) ? 'zoom-out' : 'zoom-in');
    }

    /**
     * Handle pointer up - commit the click zoom or the marquee zoom
     */
    onPointerUp(pixelX, pixelY, e) {
        const d = this._drag;
        this._drag = null;
        if (!d) return;

        if (d.marquee) {
            this._clearMarquee();
            const x = Math.min(d.startX, pixelX);
            const y = Math.min(d.startY, pixelY);
            const w = Math.abs(pixelX - d.startX);
            const h = Math.abs(pixelY - d.startY);
            if (w >= 2 && h >= 2) {
                CanvasSystem.zoomToRect(x, y, w, h);
                return;
            }
            // Degenerate marquee -> treat as a click
        }
        if (d.button === 2) this.zoomOut(d.startX, d.startY);
        else this.zoomIn(d.startX, d.startY);
    }

    /**
     * No hover footprint — zooming writes no pixels, and the zoom-in/zoom-out
     * cursor plus the drag marquee already carry the affordance.
     * @returns {null}
     */
    getFootprint() {
        return null;
    }

    /**
     * Zoom in one LADDER stop, anchored at the given pixel
     */
    zoomIn(centerX, centerY) {
        const next = ZOOM_CONFIG.step(StateManager.getZoom() || ZOOM_CONFIG.DEFAULT, 1);
        this._applyZoom(next, centerX, centerY);
    }

    /**
     * Zoom out one LADDER stop, anchored at the given pixel
     */
    zoomOut(centerX, centerY) {
        const next = ZOOM_CONFIG.step(StateManager.getZoom() || ZOOM_CONFIG.DEFAULT, -1);
        this._applyZoom(next, centerX, centerY);
    }

    // ── Marquee rectangle (drag-to-zoom) ─────────────────────────────────────

    /** Overlay canvas for the marquee, created on first use. @private */
    _marqueeCtx() {
        this._marqueeCanvas = CanvasSystem.createOverlayCanvas({
            id: 'zoom-marquee-canvas',
            zIndex: 40
        });
        return this._marqueeCanvas ? this._marqueeCanvas.getContext('2d') : null;
    }

    /** @private */
    _drawMarquee() {
        const ctx = this._marqueeCtx();
        if (!ctx) return;
        const d = this._drag;
        const x = clamp(Math.min(d.startX, d.x), 0, ZX_SPECTRUM.WIDTH - 1);
        const y = clamp(Math.min(d.startY, d.y), 0, ZX_SPECTRUM.HEIGHT - 1);
        const w = clamp(Math.abs(d.x - d.startX), 0, ZX_SPECTRUM.WIDTH - x);
        const h = clamp(Math.abs(d.y - d.startY), 0, ZX_SPECTRUM.HEIGHT - y);

        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        // Two-pass alternating dashes stay visible on any background
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = '#ffffff';
        ctx.strokeRect(x + 0.5, y + 0.5, w, h);
        ctx.lineDashOffset = 3;
        ctx.strokeStyle = '#000000';
        ctx.strokeRect(x + 0.5, y + 0.5, w, h);
        ctx.lineDashOffset = 0;
        ctx.setLineDash([]);
    }

    /** @private */
    _clearMarquee() {
        if (!this._marqueeCanvas) return;
        const ctx = this._marqueeCanvas.getContext('2d');
        ctx.clearRect(0, 0, this._marqueeCanvas.width, this._marqueeCanvas.height);
    }

    /**
     * Set zoom to a specific percentage (the viewport centre stays put)
     * @param {number} percent - Zoom percentage
     */
    setZoom(percent) {
        CanvasSystem.setZoom(
            clamp(ZOOM_CONFIG.snap(percent), ZOOM_CONFIG.MIN, ZOOM_CONFIG.MAX));
    }

    /**
     * Get current zoom level as percentage
     * @returns {number}
     */
    getZoom() {
        return StateManager.getZoom();
    }

    /**
     * Reset zoom to 100%
     */
    resetZoom() {
        this.setZoom(100);
        Logger.debug('ZoomTool', 'Zoom reset to 100%');
    }

    /**
     * Fit canvas to the visible viewport (CanvasSystem owns the computation)
     */
    fitToWindow() {
        CanvasSystem.setZoom(CanvasSystem.fitZoom());
        Logger.debug('ZoomTool', `Fit to window at ${this.getZoom()}%`);
    }

    /**
     * Anchored zoom: the clicked canvas pixel stays visually stationary.
     * @private
     */
    _applyZoom(percent, centerX, centerY) {
        CanvasSystem.zoomTo(percent, centerX, centerY);
        Logger.debug('ZoomTool', `Zoom set to ${percent}% at (${centerX}, ${centerY})`);
    }
}

// Expose to global scope
window.ZoomTool = ZoomToolClass;

Logger.debug('ZoomTool', 'Zoom tool loaded');

})(); // End IIFE
