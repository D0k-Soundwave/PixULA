'use strict';
(function() {

/**
 * GridOverlay - Displays pixel and cell grid overlays on the canvas
 * Manages separate canvases for 1x1 pixel grid, 8x8 cell grid, and 16x16 block grid
 * Also manages the function/composite preview canvases (tool drag previews) and
 * the selection overlay (selection border, stamp outline, lasso preview).
 *
 * Ported from H:\smsh (2026-07-03) and conformed:
 *  - grid cache canvases come from Helpers.createCanvas (single scratch-canvas source)
 *  - EVENTS.* constants only (legacy 'ui:*Toggle' string channels dropped —
 *    commands come in as direct method calls from the UI)
 *  - visibility changes are announced as EVENTS.GRID_VISIBILITY facts; the
 *    canvas-controls component owns the toggle buttons (UI renders from bus events)
 *  - overlay colours resolve from CSS custom properties (theme-aware)
 */
class GridOverlayClass {
    constructor() {
        // Grid canvases (separate for independent visibility control)
        this.grid1x1Canvas = null;
        this.grid1x1Ctx = null;
        this.grid8x8Canvas = null;
        this.grid8x8Ctx = null;
        this.grid16x16Canvas = null;
        this.grid16x16Ctx = null;

        // Preview canvases
        this.functionPreviewCanvas = null;
        this.functionPreviewCtx = null;
        this.compositePreviewCanvas = null;
        this.compositePreviewCtx = null;

        // Cursor-layer canvas (z 400 — above both previews): tool chrome that
        // must stay legible ON TOP of what the tool is previewing, which is
        // where the bezier handles live. A marker under the curve it bends is
        // half a marker.
        this.cursorCanvas = null;
        this.cursorCtx = null;

        // Selection overlay canvas
        this.selectionCanvas = null;
        this.selectionCtx = null;
        // Signature of what the selection overlay last drew, so an unchanged
        // selection is not re-rendered on every frame. See
        // _selectionOverlaySignature; null means "redraw next time".
        this._lastSelectionSig = null;
        this._maskIds = null;
        this._maskSeq = 0;
        this._selectionImageData = null;  // cached ImageData for mask rendering

        // Visibility states
        this.pixelGridVisible = false;   // 1x1 grid
        this.cellGridVisible = false;    // 8x8 grid (attribute cells)
        this.blockGridVisible = false;   // 16x16 grid
        this.zoom = DEFAULT_ZOOM || 100; // percent
        this._initialized = false;

        // Grid colors — resolved from CSS variables at init (and on theme change)
        this.pixelGridColor = '#000000';
        this.cellGridColor  = '#FF0000';
        this.blockGridColor = '#0000FF';

        // Overlay chrome colours (selection border, handles, footprint/stamp
        // outlines, selection fill/dim) — resolved once here and on
        // EVENTS.THEME_CHANGED rather than via getComputedStyle() on every
        // draw call.
        this._overlayColors = {
            outline:         'rgba(255,255,255,0.85)',
            outlineBrush:    'rgba(255,255,255,0.6)',
            handleBg:        '#ffffff',
            handleStroke:    'rgba(0,0,0,0.7)',
            rotationHandle:  '#ffcc00',
            selectionFill:   'rgba(255,255,255,0.07)',
            selectionBorder: '#3399ff'
        };

        // Grid caches - separate cache for each grid type
        this._grid1x1Cache = null;
        this._grid8x8Cache = null;
        this._grid16x16Cache = null;
        this._cachedZoom = null;

        // Grid wrapper div (sub-pixel grid rendering lives outside CSS-scaled canvas-container)
        this._gridWrapper = null;
    }

    /**
     * Read a CSS custom property from the document root (for canvas colour usage).
     * @param {string} name   - e.g. '--overlay-handle-bg'
     * @param {string} [fallback]
     * @returns {string}
     */
    _cssVar(name, fallback = '') {
        return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
    }

    /**
     * Initialize the grid overlay. Waits for CanvasSystem's iframe.
     */
    init() {
        if (this._initialized) return;
        CanvasSystem.onReady(() => this._initCanvases());
    }

    /**
     * Initialize all canvas references from iframe
     * @private
     */
    _initCanvases() {
        this.grid1x1Canvas   = CanvasSystem.getCanvasElement('grid-1x1-canvas');
        this.grid8x8Canvas   = CanvasSystem.getCanvasElement('grid-8x8-canvas');
        this.grid16x16Canvas = CanvasSystem.getCanvasElement('grid-16x16-canvas');

        const iDoc = CanvasSystem.getIframeDocument();
        this._gridWrapper = iDoc ? iDoc.getElementById('grid-wrapper') : null;

        this.functionPreviewCanvas  = CanvasSystem.getCanvasElement('function-preview-canvas');
        this.compositePreviewCanvas = CanvasSystem.getCanvasElement('composite-preview-canvas');
        this.selectionCanvas        = CanvasSystem.getCanvasElement('selection-canvas');
        this.cursorCanvas           = CanvasSystem.getCanvasElement('cursor-canvas');

        if (!this.grid8x8Canvas) {
            Logger.error('GridOverlay', 'Grid canvases not found in iframe');
            return;
        }

        this._finishInit();
    }

    /**
     * Finish initialization after canvases are available
     * @private
     */
    _finishInit() {
        if (this.grid1x1Canvas)   this.grid1x1Ctx   = this.grid1x1Canvas.getContext('2d');
        if (this.grid8x8Canvas)   this.grid8x8Ctx   = this.grid8x8Canvas.getContext('2d');
        if (this.grid16x16Canvas) this.grid16x16Ctx = this.grid16x16Canvas.getContext('2d');
        if (this.functionPreviewCanvas)  this.functionPreviewCtx  = this.functionPreviewCanvas.getContext('2d');
        if (this.compositePreviewCanvas) this.compositePreviewCtx = this.compositePreviewCanvas.getContext('2d');
        if (this.selectionCanvas)        this.selectionCtx        = this.selectionCanvas.getContext('2d');
        if (this.cursorCanvas)           this.cursorCtx           = this.cursorCanvas.getContext('2d');

        this._attachEvents();
        this._refreshGridColors();
        this._initialized = true;

        // Sync zoom from the authoritative source in case setZoom() fired before we initialised
        if (window.StateManager && typeof StateManager.getZoom === 'function') {
            this.zoom = StateManager.getZoom() || this.zoom;
        }

        this._updateGridLayout(this._scale());
        this._updateCanvasVisibility();
        this.render();

        Logger.info('GridOverlay', 'Initialized with separate grid canvases');
    }

    /**
     * Effective CSS scale for the current zoom. CanvasSystem owns the
     * device-pixel-aligned scale (getScale ≠ zoom/100 at fractional DPR);
     * the grid must use the same value or its lines drift off the cells.
     * @private
     */
    _scale() {
        return (window.CanvasSystem && typeof CanvasSystem.getScale === 'function')
            ? CanvasSystem.getScale()
            : this.zoom / 100;
    }

    /**
     * Read grid and overlay colours from CSS variables so they respond to theme changes.
     * @private
     */
    _refreshGridColors() {
        this.pixelGridColor = this._cssVar('--grid-pixel-color', '#000000');
        this.cellGridColor  = this._cssVar('--grid-cell-color',  '#FF0000');
        this.blockGridColor = this._cssVar('--grid-block-color', '#0000FF');

        this._overlayColors = {
            outline:         this._cssVar('--overlay-outline',          'rgba(255,255,255,0.85)'),
            outlineBrush:    this._cssVar('--overlay-outline-brush',    'rgba(255,255,255,0.6)'),
            handleBg:        this._cssVar('--overlay-handle-bg',        '#ffffff'),
            handleStroke:    this._cssVar('--overlay-handle-stroke',    'rgba(0,0,0,0.7)'),
            rotationHandle:  this._cssVar('--overlay-rotation-handle',  '#ffcc00'),
            selectionFill:   this._cssVar('--overlay-selection-fill',   'rgba(255,255,255,0.07)'),
            selectionBorder: this._cssVar('--overlay-selection-border', '#3399ff'),
            // The dim veil outside a selection. Its alpha used to be the bare
            // literal 38 in _drawSelectionBorder with a comment claiming it
            // "matches --overlay-dim" - but the light and sepia themes both
            // override that token (to 0.08 against the default 0.15), so on
            // those themes the veil was nearly twice as dark as the theme
            // asked for, and the token was dead. Read it properly instead.
            dim:             this._cssVar('--overlay-dim',              'rgba(0,0,0,0.15)')
        };
        this._dimAlpha = GridOverlayClass.alphaByteOf(this._overlayColors.dim, 38);

        this._cachedZoom = null; // rebuild caches so new colours apply
    }

    /**
     * Attach event listeners (facts only — commands arrive as direct calls)
     * @private
     */
    _attachEvents() {
        EventBus.on(EVENTS.CANVAS_ZOOM, (data) => {
            this.zoom = data.zoom || DEFAULT_ZOOM;
            this._updateGridLayout(this._scale());
            this._updateCanvasVisibility();
            this.render();
        });

        // Same zoom, new devicePixelRatio -> the effective scale moved
        EventBus.on(EVENTS.CANVAS_SCALE_CHANGED, () => {
            this._updateGridLayout(this._scale());
            this.render();
        });

        // Re-render selection overlay on canvas render events
        EventBus.on(EVENTS.CANVAS_RENDER, () => {
            this._renderSelectionOverlay();
        });

        // Refresh colours whenever the theme changes
        EventBus.on(EVENTS.THEME_CHANGED, () => {
            this._refreshGridColors();
            this.render();
        });

        // Rebuild grid layout + caches when the screen mode changes (cell
        // geometry and possibly the canvas size differ per mode)
        EventBus.on(EVENTS.SCREEN_MODE_CHANGED, () => {
            this.resize(ZX_SPECTRUM.WIDTH, ZX_SPECTRUM.HEIGHT);
        });
    }

    /**
     * Render all visible grid overlays (cached per zoom level)
     */
    render() {
        if (!this._initialized) return;

        if (this._cachedZoom !== this.zoom) {
            this._rebuildAllCaches();
        }

        this._render1x1Grid();
        this._render8x8Grid();
        this._render16x16Grid();
    }

    /** @private */
    _render1x1Grid() {
        if (!this.grid1x1Ctx) return;
        this.grid1x1Ctx.clearRect(0, 0, this.grid1x1Canvas.width, this.grid1x1Canvas.height);
        // Only show pixel grid at high zoom (4x or higher; zoom stored as percentage)
        if (this.pixelGridVisible && this.zoom >= 400 && this._grid1x1Cache) {
            this.grid1x1Ctx.drawImage(this._grid1x1Cache, 0, 0);
        }
    }

    /** @private */
    _render8x8Grid() {
        if (!this.grid8x8Ctx) return;
        this.grid8x8Ctx.clearRect(0, 0, this.grid8x8Canvas.width, this.grid8x8Canvas.height);
        if (this.cellGridVisible && this._grid8x8Cache) {
            this.grid8x8Ctx.drawImage(this._grid8x8Cache, 0, 0);
        }
    }

    /** @private */
    _render16x16Grid() {
        if (!this.grid16x16Ctx) return;
        this.grid16x16Ctx.clearRect(0, 0, this.grid16x16Canvas.width, this.grid16x16Canvas.height);
        if (this.blockGridVisible && this._grid16x16Cache) {
            this.grid16x16Ctx.drawImage(this._grid16x16Cache, 0, 0);
        }
    }

    /** @private */
    _rebuildAllCaches() {
        this._rebuildCache1x1();
        this._rebuildCache8x8();
        this._rebuildCache16x16();
        this._cachedZoom = this.zoom;
    }

    /**
     * Resize grid wrapper and grid canvases to display resolution at the current zoom + DPR.
     * Grid canvases live OUTSIDE the CSS-scaled canvas-container so they can render at the
     * actual on-screen pixel size — this is what makes sub-pixel grid lines possible.
     * @private
     * @param {number} scale - zoom factor (e.g. 4 for 400%)
     */
    _updateGridLayout(scale) {
        const DPR = window.devicePixelRatio || 1;
        const displayW = Math.round(ZX_SPECTRUM.WIDTH  * scale);
        const displayH = Math.round(ZX_SPECTRUM.HEIGHT * scale);

        if (this._gridWrapper) {
            this._gridWrapper.style.width  = displayW + 'px';
            this._gridWrapper.style.height = displayH + 'px';
        }

        const canvases = [this.grid1x1Canvas, this.grid8x8Canvas, this.grid16x16Canvas];
        for (const c of canvases) {
            if (!c) continue;
            c.width  = Math.round(displayW * DPR);
            c.height = Math.round(displayH * DPR);
            c.style.width  = displayW + 'px';
            c.style.height = displayH + 'px';
        }

        this._grid1x1Cache = null;
        this._grid8x8Cache = null;
        this._grid16x16Cache = null;
        this._cachedZoom = null;
    }

    /**
     * Build a grid cache canvas at the current zoom + DPR.
     * @private
     */
    _buildGridCache(strokeStyle, drawFn, lineWidthZx = 0.2) {
        const scale = this._scale();
        const DPR   = window.devicePixelRatio || 1;
        const displayW = Math.round(ZX_SPECTRUM.WIDTH  * scale);
        const displayH = Math.round(ZX_SPECTRUM.HEIGHT * scale);

        const cache = Helpers.createCanvas(
            Math.round(displayW * DPR),
            Math.round(displayH * DPR)
        );

        const ctx = cache.getContext('2d');
        ctx.scale(DPR, DPR);

        const lw   = lineWidthZx * scale;  // ZX pixels -> CSS units
        const half = lw / 2;

        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth   = lw;
        ctx.beginPath();
        drawFn(ctx, scale, half, displayW, displayH);
        ctx.stroke();

        return cache;
    }

    /** Rebuild 1x1 pixel grid cache. @private */
    _rebuildCache1x1() {
        this._grid1x1Cache = this._buildGridCache(this.pixelGridColor, (ctx, scale, half, dW, dH) => {
            for (let col = 1; col < ZX_SPECTRUM.WIDTH; col++) {
                const x = col * scale;
                ctx.moveTo(x - half, 0);  ctx.lineTo(x - half, dH);
                ctx.moveTo(x + half, 0);  ctx.lineTo(x + half, dH);
            }
            for (let row = 1; row < ZX_SPECTRUM.HEIGHT; row++) {
                const y = row * scale;
                ctx.moveTo(0, y - half);  ctx.lineTo(dW, y - half);
                ctx.moveTo(0, y + half);  ctx.lineTo(dW, y + half);
            }
        }, 0.05);
    }

    /** Rebuild attribute-cell grid cache (cell geometry from the mode). @private */
    _rebuildCache8x8() {
        const cellW = ZX_SPECTRUM.CELL_WIDTH;
        const cellH = ZX_SPECTRUM.CELL_HEIGHT;
        this._grid8x8Cache = this._buildGridCache(this.cellGridColor, (ctx, scale, half, dW, dH) => {
            for (let col = 1; col < ZX_SPECTRUM.GRID_COLS; col++) {
                const x = col * cellW * scale;
                ctx.moveTo(x - half, 0);  ctx.lineTo(x - half, dH);
                ctx.moveTo(x + half, 0);  ctx.lineTo(x + half, dH);
            }
            for (let row = 1; row < ZX_SPECTRUM.GRID_ROWS; row++) {
                const y = row * cellH * scale;
                ctx.moveTo(0, y - half);  ctx.lineTo(dW, y - half);
                ctx.moveTo(0, y + half);  ctx.lineTo(dW, y + half);
            }
        }, 0.1);
    }

    /** Rebuild 16x16 block grid cache. @private */
    _rebuildCache16x16() {
        const blockSize = ZX_SPECTRUM.CELL_SIZE * 2;
        const cols = Math.ceil(ZX_SPECTRUM.WIDTH  / blockSize);
        const rows = Math.ceil(ZX_SPECTRUM.HEIGHT / blockSize);
        this._grid16x16Cache = this._buildGridCache(this.blockGridColor, (ctx, scale, half, dW, dH) => {
            for (let col = 1; col < cols; col++) {
                const x = col * blockSize * scale;
                ctx.moveTo(x - half, 0);  ctx.lineTo(x - half, dH);
                ctx.moveTo(x + half, 0);  ctx.lineTo(x + half, dH);
            }
            for (let row = 1; row < rows; row++) {
                const y = row * blockSize * scale;
                ctx.moveTo(0, y - half);  ctx.lineTo(dW, y - half);
                ctx.moveTo(0, y + half);  ctx.lineTo(dW, y + half);
            }
        }, 0.1);
    }

    /** Show the primary (8x8 cell) grid. */
    show() { this.setCellGridVisible(true); }

    /** Hide the primary (8x8 cell) grid. */
    hide() { this.setCellGridVisible(false); }

    /** Toggle the primary (8x8 cell) grid. */
    toggle() { this.toggleCellGrid(); }

    /** @private */
    _updateCanvasVisibility() {
        if (this.grid1x1Canvas) {
            this.grid1x1Canvas.style.display = (this.pixelGridVisible && this.zoom >= 400) ? '' : 'none';
        }
        if (this.grid8x8Canvas) {
            this.grid8x8Canvas.style.display = this.cellGridVisible ? '' : 'none';
        }
        if (this.grid16x16Canvas) {
            this.grid16x16Canvas.style.display = this.blockGridVisible ? '' : 'none';
        }
    }

    /**
     * Announce a grid-visibility fact so toggle buttons (canvas-controls) and
     * menu checkmarks can sync without GridOverlay knowing about their DOM.
     * @private
     */
    _emitVisibility() {
        EventBus.emit(EVENTS.GRID_VISIBILITY, {
            pixel: this.pixelGridVisible,
            cell:  this.cellGridVisible,
            block: this.blockGridVisible
        });
    }

    /** Set 1x1 pixel grid visibility. */
    setPixelGridVisible(visible) {
        this.pixelGridVisible = visible;
        this._updateCanvasVisibility();
        this.render();
        this._emitVisibility();
    }

    togglePixelGrid() { this.setPixelGridVisible(!this.pixelGridVisible); }

    /** Set 8x8 cell grid visibility. */
    setCellGridVisible(visible) {
        this.cellGridVisible = visible;
        this._updateCanvasVisibility();
        this.render();
        this._emitVisibility();
    }

    toggleCellGrid() { this.setCellGridVisible(!this.cellGridVisible); }

    /** Set 16x16 block grid visibility. */
    setBlockGridVisible(visible) {
        this.blockGridVisible = visible;
        this._updateCanvasVisibility();
        this.render();
        this._emitVisibility();
    }

    toggleBlockGrid() { this.setBlockGridVisible(!this.blockGridVisible); }

    /** Is the primary (cell) grid visible? */
    isVisible() {
        return this.cellGridVisible;
    }

    /**
     * Resize all overlay canvases (mode change / future non-256×192 modes).
     * @param {number} width - New width in ZX pixels
     * @param {number} height - New height in ZX pixels
     */
    resize(width, height) {
        if (this.functionPreviewCanvas) {
            this.functionPreviewCanvas.width  = width;
            this.functionPreviewCanvas.height = height;
        }
        if (this.compositePreviewCanvas) {
            this.compositePreviewCanvas.width  = width;
            this.compositePreviewCanvas.height = height;
        }
        if (this.cursorCanvas) {
            this.cursorCanvas.width  = width;
            this.cursorCanvas.height = height;
        }
        this._updateGridLayout(this._scale());
        this.render();
    }

    /**
     * Set zoom level (percent). Normally arrives via EVENTS.CANVAS_ZOOM.
     * @param {number} zoom
     */
    setZoom(zoom) {
        this.zoom = zoom;
        this._updateGridLayout(this._scale());
        this._updateCanvasVisibility();  // 1×1 pixel grid only shows at ≥400%
        this.render();
    }

    /** Clear the function preview canvas. */
    clearFunctionPreview() {
        if (this.functionPreviewCtx && this.functionPreviewCanvas) {
            this.functionPreviewCtx.clearRect(0, 0, this.functionPreviewCanvas.width, this.functionPreviewCanvas.height);
        }
    }

    /** Clear the composite preview canvas. */
    clearCompositePreview() {
        if (this.compositePreviewCtx && this.compositePreviewCanvas) {
            this.compositePreviewCtx.clearRect(0, 0, this.compositePreviewCanvas.width, this.compositePreviewCanvas.height);
        }
    }

    /** Clear the cursor-layer canvas (tool chrome: handles). */
    clearCursorOverlay() {
        if (this.cursorCtx && this.cursorCanvas) {
            this.cursorCtx.clearRect(0, 0, this.cursorCanvas.width, this.cursorCanvas.height);
        }
    }

    /**
     * Clear all preview canvases. Includes the cursor layer, so a tool that
     * puts handles up (ToolBase.clearPreview on deactivate / commit) takes
     * them down by the same one call — no separate teardown to forget.
     */
    clearPreview() {
        this.clearFunctionPreview();
        this.clearCompositePreview();
        this.clearCursorOverlay();
    }

    /**
     * Draw a preview from an array of pixel coordinates on the function preview canvas.
     * @param {Array<{x: number, y: number}>} pixels
     * @param {string} [color] - defaults to the --overlay-outline token
     */
    drawPreviewPixels(pixels, color) {
        if (!this._initialized) return;

        const ctx = this.functionPreviewCtx || this.compositePreviewCtx;
        const canvas = this.functionPreviewCanvas || this.compositePreviewCanvas;
        if (!ctx || !canvas) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (!pixels || pixels.length === 0) return;

        ctx.fillStyle = color || this._overlayColors.outline;

        for (let i = 0; i < pixels.length; i++) {
            const p = pixels[i];
            if (p.x >= 0 && p.x < ZX_SPECTRUM.WIDTH && p.y >= 0 && p.y < ZX_SPECTRUM.HEIGHT) {
                ctx.fillRect(p.x, p.y, 1, 1);
            }
        }
    }

    /**
     * Draw a tool's hover footprint as an outline on the function preview canvas.
     *
     * Only the BOUNDARY is drawn (MaskOps.boundaryPoints — pure, Node-tested):
     * a solid size-32 disc renders as a one-pixel ring rather than 800 opaque
     * pixels that would hide the very artwork the user is aiming at, while a
     * sparse set (a dither pattern, a crosshatch) is almost all boundary and so
     * shows in full. Uses the dimmer --overlay-outline-brush token — this is a
     * passive cursor affordance, not an active preview like the shape/gradient
     * rasters that share this canvas.
     *
     * @param {Array<{x: number, y: number}>} pixels - The tool's affected-pixel set
     */
    drawFootprintOutline(pixels) {
        if (!this._initialized) return;

        const ctx = this.functionPreviewCtx || this.compositePreviewCtx;
        const canvas = this.functionPreviewCanvas || this.compositePreviewCanvas;
        if (!ctx || !canvas) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (!pixels || pixels.length === 0) return;

        // Geometry via the live mode views, read at call time (never cached).
        const edge = MaskOps.boundaryPoints(pixels, ZX_SPECTRUM.WIDTH, ZX_SPECTRUM.HEIGHT);

        ctx.fillStyle = this._overlayColors.outlineBrush;
        for (let i = 0; i < edge.length; i++) {
            ctx.fillRect(edge[i].x, edge[i].y, 1, 1);
        }
    }

    /**
     * Draw drag handles on the function preview canvas — the grab markers a
     * tool puts on the artwork (the bezier curve's anchors and control points).
     *
     * Two things make a marker findable on a picture whose colours we do not
     * control, and a single-colour dot has neither: CONTRAST and SHAPE. Every
     * marker is therefore painted twice — a body in --overlay-handle-bg over a
     * one-pixel skirt in --overlay-handle-stroke, which are opposites in every
     * theme, so whichever the artwork resembles the other still reads. And the
     * kinds differ in outline, the vector-editor convention: an anchor is a
     * SQUARE (a point on the curve), a control a DIAMOND (a point that only
     * pulls it). The dragged one takes --overlay-rotation-handle, the same
     * "this is the live one" colour the transform handles use.
     *
     * `radius` is the caller's, in ZX pixels: the tool sizes it against the
     * zoom so the marker stays roughly one on-screen size (see BezierTool
     * ._handleRadius) instead of becoming a 40-pixel slab at 800%.
     *
     * @param {Array<{x: number, y: number, radius: number, kind: string,
     *                active: boolean}>} handles - kind: 'anchor' | 'control'
     * @param {Array<{x: number, y: number}>} [linkPixels] - rasterized guide
     *        lines (anchor -> its control), drawn as a two-tone dash so they
     *        read over ink and paper alike
     */
    drawHandles(handles, linkPixels) {
        if (!this._initialized) return;

        // The cursor layer, NOT the preview canvases: the composite preview
        // (z 150) carries the curve itself, so handles drawn below it would be
        // struck through by the very line they steer.
        const ctx = this.cursorCtx || this.functionPreviewCtx;
        const canvas = this.cursorCanvas || this.functionPreviewCanvas;
        if (!ctx || !canvas) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (!handles || handles.length === 0) return;

        const body = this._overlayColors.handleBg;
        const edge = this._overlayColors.handleStroke;
        const hot  = this._overlayColors.rotationHandle;

        // Guide lines first — the markers sit on top of their own ends.
        if (linkPixels && linkPixels.length) {
            for (let i = 0; i < linkPixels.length; i++) {
                const p = linkPixels[i];
                if (p.x < 0 || p.x >= ZX_SPECTRUM.WIDTH || p.y < 0 || p.y >= ZX_SPECTRUM.HEIGHT) continue;
                ctx.fillStyle = (i & 2) ? edge : body;   // 2 on, 2 off
                ctx.fillRect(p.x, p.y, 1, 1);
            }
        }

        for (const h of handles) {
            const r = Math.max(1, Math.round(h.radius || 1));
            const fill = h.active ? hot : body;
            if (h.kind === 'control') {
                this._fillDiamond(ctx, h.x, h.y, r + 1, edge);
                this._fillDiamond(ctx, h.x, h.y, r, fill);
            } else {
                ctx.fillStyle = edge;
                ctx.fillRect(h.x - r - 1, h.y - r - 1, 2 * r + 3, 2 * r + 3);
                ctx.fillStyle = fill;
                ctx.fillRect(h.x - r, h.y - r, 2 * r + 1, 2 * r + 1);
            }
        }
    }

    /** Solid diamond of radius r, row by row (crisp at any size). @private */
    _fillDiamond(ctx, cx, cy, r, color) {
        ctx.fillStyle = color;
        for (let dy = -r; dy <= r; dy++) {
            const half = r - Math.abs(dy);
            ctx.fillRect(cx - half, cy + dy, 2 * half + 1, 1);
        }
    }

    /**
     * Preview showing erase result — pixels displayed in paper colour.
     * @param {Array<{x: number, y: number}>} pixels
     */
    drawPreviewPixelsErase(pixels) {
        if (!this._initialized) return;

        const ctx = this.functionPreviewCtx || this.compositePreviewCtx;
        const canvas = this.functionPreviewCanvas || this.compositePreviewCanvas;
        if (!ctx || !canvas) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (!pixels || pixels.length === 0) return;

        ctx.fillStyle = ColorManager.getPaperRGB();
        for (let i = 0; i < pixels.length; i++) {
            const p = pixels[i];
            if (p.x >= 0 && p.x < ZX_SPECTRUM.WIDTH && p.y >= 0 && p.y < ZX_SPECTRUM.HEIGHT) {
                ctx.fillRect(p.x, p.y, 1, 1);
            }
        }
    }

    /**
     * Preview a dithered gradient with both ink and paper colours.
     * @param {Array<{x,y}>} inkPixels
     * @param {Array<{x,y}>} paperPixels
     */
    drawPreviewPixelsGradient(inkPixels, paperPixels) {
        if (!this._initialized) return;

        const ctx = this.functionPreviewCtx || this.compositePreviewCtx;
        const canvas = this.functionPreviewCanvas || this.compositePreviewCanvas;
        if (!ctx || !canvas) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (paperPixels && paperPixels.length > 0) {
            ctx.fillStyle = ColorManager.getPaperRGB();
            for (let i = 0; i < paperPixels.length; i++) {
                const p = paperPixels[i];
                if (p.x >= 0 && p.x < ZX_SPECTRUM.WIDTH && p.y >= 0 && p.y < ZX_SPECTRUM.HEIGHT) {
                    ctx.fillRect(p.x, p.y, 1, 1);
                }
            }
        }

        if (inkPixels && inkPixels.length > 0) {
            ctx.fillStyle = ColorManager.getInkRGB();
            for (let i = 0; i < inkPixels.length; i++) {
                const p = inkPixels[i];
                if (p.x >= 0 && p.x < ZX_SPECTRUM.WIDTH && p.y >= 0 && p.y < ZX_SPECTRUM.HEIGHT) {
                    ctx.fillRect(p.x, p.y, 1, 1);
                }
            }
        }
    }

    /**
     * Compositor-accurate preview for any drawing operation.
     * Simulates the operation already applied to the active layer, then runs the
     * same compositor logic as composeCellToCanvas() over every affected cell.
     * Accepts Array<{x,y}> or Set<"x,y"> for both pixel lists.
     * @param {Array|Set} inkPixels - pixels that will be set to ink
     * @param {Array|Set} erasePixels - pixels that will be cleared to paper
     */
    drawCompositorPreview(inkPixels, erasePixels) {
        if (!this._initialized) return;
        const ctx = this.compositePreviewCtx;
        const canvas = this.compositePreviewCanvas;
        if (!ctx || !canvas) return;

        const inkSet = inkPixels instanceof Set
            ? inkPixels
            : new Set((inkPixels || []).map(p => p.x + ',' + p.y));
        const paperSet = erasePixels instanceof Set
            ? erasePixels
            : new Set((erasePixels || []).map(p => p.x + ',' + p.y));

        if (inkSet.size === 0 && paperSet.size === 0) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            return;
        }

        // Derive affected cells from all touched pixels
        const cellW = ZX_SPECTRUM.CELL_WIDTH;
        const cellH = ZX_SPECTRUM.CELL_HEIGHT;
        const affectedCells = new Set();
        const addCell = key => {
            const c = key.indexOf(',');
            affectedCells.add(
                Math.floor(parseInt(key.slice(0, c), 10) / cellW) + ',' +
                Math.floor(parseInt(key.slice(c + 1), 10) / cellH)
            );
        };
        for (const k of inkSet)   addCell(k);
        for (const k of paperSet) addCell(k);

        const colorSelection = ColorManager.getCurrentSelection();
        const activeLayerIndex = LayerManager.currentLayerIndex;

        this._renderCompositorPreview(ctx, canvas, affectedCells, inkSet, paperSet, colorSelection, activeLayerIndex);
    }

    /**
     * Gradient-specific entry point — accepts pre-built Sets and explicit colour
     * selection (gradient may differ from current ColorManager state mid-drag).
     */
    drawGradientCellPreview(affectedCells, gradientInkSet, gradientPaprSet, colorSelection, activeLayerIndex) {
        if (!this._initialized) return;
        const ctx = this.compositePreviewCtx;
        const canvas = this.compositePreviewCanvas;
        if (!ctx || !canvas) return;
        this._renderCompositorPreview(ctx, canvas, affectedCells, gradientInkSet, gradientPaprSet, colorSelection, activeLayerIndex);
    }

    /**
     * Shared compositor simulation used by both drawCompositorPreview and
     * drawGradientCellPreview. Mirrors composeCellToCanvas() exactly, substituting
     * a virtual cell on the active layer with the pending operation applied.
     * @private
     */
    _renderCompositorPreview(ctx, canvas, affectedCells, inkSet, paperSet, colorSelection, activeLayerIndex) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (affectedCells.size === 0) return;

        const cellW = ZX_SPECTRUM.CELL_WIDTH;
        const cellH = ZX_SPECTRUM.CELL_HEIGHT;
        const layers = LayerManager.layers;
        const bgLayer = layers[0];

        // Every touched pixel is written straight into one RGBA buffer and
        // painted with a single putImageData, instead of a fillStyle+fillRect
        // pair per pixel. A full-canvas gradient preview used to issue tens
        // of thousands of canvas-API calls on every pointermove; this issues
        // one, regardless of how many pixels are affected. The buffer only
        // spans the bounding box of affectedCells - cells inside the box but
        // not in the set are left at alpha 0 (transparent), matching the old
        // behaviour of simply never drawing them (the clearRect above already
        // cleared that area).
        let minCX = Infinity, minCY = Infinity, maxCX = -Infinity, maxCY = -Infinity;
        for (const key of affectedCells) {
            const comma = key.indexOf(',');
            const cellX = parseInt(key.slice(0, comma), 10);
            const cellY = parseInt(key.slice(comma + 1), 10);
            if (cellX < minCX) minCX = cellX;
            if (cellX > maxCX) maxCX = cellX;
            if (cellY < minCY) minCY = cellY;
            if (cellY > maxCY) maxCY = cellY;
        }

        const bboxX = minCX * cellW;
        const bboxY = minCY * cellH;
        const bboxW = (maxCX - minCX + 1) * cellW;
        const bboxH = (maxCY - minCY + 1) * cellH;
        const imgData = ctx.createImageData(bboxW, bboxH);
        const buf = imgData.data;

        for (const key of affectedCells) {
            const comma = key.indexOf(',');
            const cellX = parseInt(key.slice(0, comma), 10);
            const cellY = parseInt(key.slice(comma + 1), 10);
            const baseX = cellX * cellW;
            const baseY = cellY * cellH;

            const alteredLayerData = [];

            for (let i = 1; i < layers.length; i++) {
                const layer = layers[i];
                if (!layer.visible) continue;

                if (i === activeLayerIndex) {
                    // Virtual cell: existing pixels with this operation applied on top
                    const existingCell = layer.getCell(cellX, cellY);
                    const simPixels = new Uint8Array(cellH);
                    if (existingCell && existingCell.altered) {
                        for (let row = 0; row < cellH; row++) simPixels[row] = existingCell.pixels[row];
                    }
                    for (let row = 0; row < cellH; row++) {
                        for (let col = 0; col < cellW; col++) {
                            const pixKey = (baseX + col) + ',' + (baseY + row);
                            const bit = 1 << (cellW - 1 - col);
                            if (inkSet.has(pixKey))        simPixels[row] |=  bit;
                            else if (paperSet.has(pixKey)) simPixels[row] &= ~bit;
                        }
                    }
                    alteredLayerData.push({ attrs: colorSelection, pixels: simPixels });
                } else {
                    const cell = layer.getCell(cellX, cellY);
                    if (cell && cell.altered) {
                        alteredLayerData.push({
                            attrs: { ink: cell.ink, paper: cell.paper, bright: cell.bright, flash: cell.flash },
                            pixels: cell.pixels
                        });
                    }
                }
            }

            // Topmost altered layer wins for attributes (same rule as real compositor)
            let compositeAttrs;
            if (alteredLayerData.length > 0) {
                compositeAttrs = alteredLayerData[alteredLayerData.length - 1].attrs;
            } else {
                const bgCell = bgLayer ? bgLayer.getCell(cellX, cellY) : null;
                compositeAttrs = bgCell
                    ? { ink: bgCell.ink, paper: bgCell.paper, bright: bgCell.bright, flash: bgCell.flash }
                    : { ink: 0, paper: 7, bright: false, flash: false };
            }

            // OR-combine pixels from all altered layers (same rule as real compositor)
            const compositePixels = new Uint8Array(cellH);
            for (const { pixels } of alteredLayerData) {
                for (let row = 0; row < cellH; row++) compositePixels[row] |= pixels[row];
            }

            // Resolve palette colours via the same path as the real compositor
            const t = ColorManager.attrToIndices(compositeAttrs);
            const inkRGB   = ColorManager.getRGB(t.ink);
            const paperRGB = ColorManager.getRGB(t.paper);

            // Write every pixel of the cell straight into the shared buffer —
            // fully opaque, pixel-perfect match of final canvas.
            const cellOffX = baseX - bboxX;
            const cellOffY = baseY - bboxY;
            for (let row = 0; row < cellH; row++) {
                const rowBits = compositePixels[row];
                const py = cellOffY + row;
                for (let col = 0; col < cellW; col++) {
                    const isInk = (rowBits >> (cellW - 1 - col)) & 1;
                    const rgb = isInk ? inkRGB : paperRGB;
                    const idx = (py * bboxW + cellOffX + col) * 4;
                    buf[idx]     = rgb[0];
                    buf[idx + 1] = rgb[1];
                    buf[idx + 2] = rgb[2];
                    buf[idx + 3] = 255;
                }
            }
        }

        ctx.putImageData(imgData, bboxX, bboxY);
    }

    /** Function preview context (for tools that need direct access). */
    getFunctionPreviewContext() {
        return this.functionPreviewCtx;
    }

    /** Composite preview context (for tools that need direct access). */
    getCompositePreviewContext() {
        return this.compositePreviewCtx;
    }

    /**
     * Draw a simple dashed outline around the stamp footprint while floating.
     * No handles — minimal visual noise while painting.
     * @param {Object} fp - SelectionService.floatingPaste state
     * @private
     */
    _drawBrushStampOutline(fp) {
        if (!this.selectionCtx || !this.selectionCanvas) return;
        const ctx = this.selectionCtx;
        const cvs = this.selectionCanvas;
        ctx.clearRect(0, 0, cvs.width, cvs.height);
        const scale = this.zoom / 100;
        ctx.save();
        ctx.setLineDash([1, 2]);
        ctx.strokeStyle = this._overlayColors.outlineBrush;
        ctx.lineWidth = 0.5 / scale;
        ctx.strokeRect(fp.x + 0.5, fp.y + 0.5, fp.width, fp.height);
        ctx.restore();
    }

    /**
     * Render the selection overlay (stamp outline or selection border).
     * Called on EVENTS.CANVAS_RENDER.
     * @private
     */
    _renderSelectionOverlay() {
        if (!this._initialized) return;

        // This runs on EVERY frame that had a dirty cell, for as long as a
        // selection exists - which includes the whole time an artist draws
        // inside one (the clip/frisket modes). The work it does is not small:
        // measured 2026-08-29, one pass over a quarter-canvas selection cost
        // 0.469 ms, against 0.200 ms for a FULL recompose of the same canvas.
        // Almost all of it is repeated for nothing, because the marks being
        // drawn do not move the selection.
        //
        // So the overlay is redrawn only when something it actually depends
        // on has changed. The signature is compared, not the pixels: the
        // selection canvas is written from exactly two places, both in this
        // file (this method and _drawBrushStampOutline via it), so no other
        // code can invalidate the cached image behind us - verified by grep
        // over js/ before this was added, and the reason to check again
        // before giving anything else a handle on `selectionCtx`.
        const sig = this._selectionOverlaySignature();
        if (sig !== null && sig === this._lastSelectionSig) return;
        this._lastSelectionSig = sig;

        // Stamp / floating paste overlay
        if (window.SelectionService && SelectionService.isFloating()) {
            const fp = SelectionService.floatingPaste;
            if (fp) this._drawBrushStampOutline(fp);
            else this._clearSelectionCanvas();
            return;
        }

        if (!window.SelectionService || !SelectionService.hasSelection()) {
            this._clearSelectionCanvas();
            return;
        }

        const sel = SelectionService.getSelection();
        if (!sel) { this._clearSelectionCanvas(); return; }

        this._drawSelectionBorder(this.selectionCtx, sel.x, sel.y, sel.width, sel.height, sel.mask);
    }

    /**
     * A compact description of everything the selection overlay's appearance
     * depends on: which of the three states it is in, the geometry of the
     * stamp or selection, the identity of any mask (masks are rebuilt rather
     * than edited in place), the theme colour it strokes with, and the canvas
     * size. Any change to any of those changes the string.
     *
     * Returns null to mean "cannot be summarised - always redraw", which is
     * the safe answer whenever the state is not one of the three known ones.
     * @returns {string|null}
     * @private
     */
    _selectionOverlaySignature() {
        const S = window.SelectionService;
        if (!S) return null;

        const canvas = this.selectionCanvas;
        const chrome = canvas
            ? `${canvas.width}x${canvas.height}:${this._overlayColors.selectionBorder}:${this._dimAlpha}`
            : 'nocanvas';

        if (S.isFloating()) {
            const fp = S.floatingPaste;
            if (!fp) return 'float:none:' + chrome;
            // A floating stamp is redrawn from its own live geometry every
            // frame it moves, so the geometry IS the signature.
            return `float:${fp.x},${fp.y},${fp.width},${fp.height}:${chrome}`;
        }

        if (!S.hasSelection()) return 'none:' + chrome;

        const sel = S.getSelection();
        if (!sel) return 'none:' + chrome;

        // The mask is identified rather than hashed: SelectionService replaces
        // it on every change (setSelection builds a fresh object), so identity
        // moves whenever the shape does. `_maskIds` keeps the mapping small
        // and stable without holding the masks alive any longer than the
        // selection does.
        return `sel:${sel.x},${sel.y},${sel.width},${sel.height}:` +
               `${sel.mask ? this._maskId(sel.mask) : 0}:${chrome}`;
    }

    /**
     * A small stable number for a mask object, for use in the overlay
     * signature. Uses a WeakMap so a discarded mask is collectable.
     * @param {Object} mask
     * @returns {number}
     * @private
     */
    _maskId(mask) {
        if (!this._maskIds) { this._maskIds = new WeakMap(); this._maskSeq = 0; }
        let id = this._maskIds.get(mask);
        if (id === undefined) { id = ++this._maskSeq; this._maskIds.set(mask, id); }
        return id;
    }

    /**
     * Force the next _renderSelectionOverlay to redraw regardless of its
     * signature. For anything that changes the overlay's appearance without
     * changing the selection itself - a theme swap, a resize, a mask edited
     * in place.
     */
    invalidateSelectionOverlay() {
        this._lastSelectionSig = null;
    }

    /** @private */
    _clearSelectionCanvas() {
        if (this.selectionCtx && this.selectionCanvas) {
            this.selectionCtx.clearRect(0, 0, this.selectionCanvas.width, this.selectionCanvas.height);
        }
    }

    /**
     * Draw a drag-in-progress selection preview on the function-preview canvas.
     * Shows ink pixels from all visible layers ORed together as a translucent
     * highlight, plus a solid border — no layer colour data is altered. Same
     * plain-line style as the committed selection (_drawSelectionBorder), so
     * nothing changes look when the drag ends.
     * Called directly by SelectionTool.onPointerMove().
     * @param {number} x @param {number} y @param {number} w @param {number} h
     */
    drawSelectionPreview(x, y, w, h) {
        if (!this._initialized) return;
        const ctx = this.functionPreviewCtx;
        const canvas = this.functionPreviewCanvas;
        if (!ctx || !canvas) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (w <= 0 || h <= 0) return;

        const cellW = ZX_SPECTRUM.CELL_WIDTH;
        const cellH = ZX_SPECTRUM.CELL_HEIGHT;
        const layers = LayerManager.layers;
        const fill = this._overlayColors.selectionFill;

        // Highlight ink pixels from all visible non-background layers
        for (let py = y; py < y + h; py++) {
            for (let px = x; px < x + w; px++) {
                if (px < 0 || px >= ZX_SPECTRUM.WIDTH || py < 0 || py >= ZX_SPECTRUM.HEIGHT) continue;

                const cellY  = Math.floor(py / cellH);
                const cellX  = Math.floor(px / cellW);
                const localY = py % cellH;
                const bitPos = cellW - 1 - (px % cellW);

                let inkBit = 0;
                for (let i = 1; i < layers.length; i++) {
                    const layer = layers[i];
                    if (!layer.visible || layer.isStamp) continue;
                    const cell = layer.getCell(cellX, cellY);
                    if (cell && cell.altered && ((cell.pixels[localY] >> bitPos) & 1)) {
                        inkBit = 1;
                        break;
                    }
                }

                if (inkBit) {
                    ctx.fillStyle = fill;
                    ctx.fillRect(px, py, 1, 1);
                }
            }
        }

        // Solid border (see the doc comment above for why it isn't dashed).
        ctx.save();
        ctx.strokeStyle = this._overlayColors.selectionBorder;
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
        ctx.restore();
    }

    /**
     * Draw the selection border, rectangular or masked. A rectangular
     * selection (`mask` omitted) is treated as fully selected within (w, h) —
     * same boundary-tracing renderer either way, so a plain marquee and a
     * lasso/ellipse selection share one crisp outline style instead of
     * two independently-drifting ones. Solid line, no dash, no animation —
     * matches the drag-in-progress preview, so committing a selection stays
     * one continuous look instead of jumping into a crawling marquee.
     * @param {boolean[][]} [mask] - Row-major mask relative to (x,y); omit for a solid rect
     * @private
     */
    _drawSelectionBorder(ctx, x, y, w, h, mask) {
        const canvas = this.selectionCanvas;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const isSelected = mask
            ? (rx, ry) => { const row = mask[ry]; return !!row && !!row[rx]; }
            : () => true;

        // Dim overlay — transparent where selected.
        // Reuse a cached ImageData to avoid a full-canvas allocation every frame.
        if (!this._selectionImageData ||
                this._selectionImageData.width  !== canvas.width ||
                this._selectionImageData.height !== canvas.height) {
            this._selectionImageData = ctx.createImageData(canvas.width, canvas.height);
        }
        const imgData = this._selectionImageData;
        const d = imgData.data;
        d.fill(0);
        const dimAlpha = this._dimAlpha;
        for (let i = 3; i < d.length; i += 4) d[i] = dimAlpha;
        for (let ry = 0; ry < h; ry++) {
            for (let rx = 0; rx < w; rx++) {
                if (!isSelected(rx, ry)) continue;
                const px = x + rx, py = y + ry;
                if (px >= 0 && px < canvas.width && py >= 0 && py < canvas.height) {
                    d[(py * canvas.width + px) * 4 + 3] = 0;
                }
            }
        }
        ctx.putImageData(imgData, 0, 0);

        this._strokeCrispOutline(ctx, x, y, w, h, isSelected);
    }

    /**
     * Trace and stroke the crisp per-pixel boundary of a selected region —
     * shared by the committed selection border and every live drag preview,
     * so nothing ever looks different once a drag ends. Each edge segment is
     * offset 0.5px into the boundary pixel's own row/column: a 1px stroke
     * centered on a bare integer coordinate straddles two pixel rows at 50%
     * opacity each, which reads as a soft blurred band once the canvas is
     * scaled up by zoom. Only ever draws axis-aligned segments (never a
     * diagonal), which is what keeps it free of antialiasing regardless of
     * the shape's true outline — see drawLassoPreview for why that matters.
     * @param {(rx: number, ry: number) => boolean} isSelected - predicate over region-local coords
     * @private
     */
    _strokeCrispOutline(ctx, x, y, w, h, isSelected) {
        ctx.beginPath();
        for (let ry = 0; ry < h; ry++) {
            for (let rx = 0; rx < w; rx++) {
                if (!isSelected(rx, ry)) continue;
                const px = x + rx, py = y + ry;
                if (ry === 0 || !isSelected(rx, ry - 1)) { ctx.moveTo(px, py + 0.5);     ctx.lineTo(px + 1, py + 0.5); }
                if (ry === h - 1 || !isSelected(rx, ry + 1)) { ctx.moveTo(px, py + 0.5); ctx.lineTo(px + 1, py + 0.5); }
                if (rx === 0 || !isSelected(rx - 1, ry)) { ctx.moveTo(px + 0.5, py);     ctx.lineTo(px + 0.5, py + 1); }
                if (rx === w - 1 || !isSelected(rx + 1, ry)) { ctx.moveTo(px + 0.5, py); ctx.lineTo(px + 0.5, py + 1); }
            }
        }
        ctx.save();
        ctx.strokeStyle = this._overlayColors.selectionBorder;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
    }

    /**
     * Draw a live lasso/ellipse selection preview on the function-preview
     * canvas during drag — exactly the pixels `path` itself passes through,
     * walked with the canonical Bresenham line (ToolBase.getLinePoints) and
     * filled directly. Never closed into a region: a freeform lasso path
     * isn't a loop until the artist releases (SelectionTool._rasterizeLasso
     * is what closes it, at commit), so treating it as one early — filling
     * it and tracing the fill's boundary, as an earlier version of this did
     * — drew a straight anchor line bridging the last point back to the
     * first, which is not anything the artist has actually traced yet. An
     * ellipse's outline polygon already loops back on itself (its last
     * point repeats the first), so the same open walk closes it correctly
     * too, with no separate case needed. A plain vector stroke along `path`
     * was tried before this and rejected: canvas always antialiases
     * diagonal segments regardless of pixel-centre offsets, so it looked
     * blurred; walking Bresenham pixels is what a freehand pencil stroke
     * does, and is crisp by construction.
     * @param {Array<{x,y}>} path - Current accumulated lasso path, or an
     *        ellipse's outline polygon
     */
    drawLassoPreview(path) {
        if (!this._initialized || path.length < 2) return;
        const ctx    = this.functionPreviewCtx;
        const canvas = this.functionPreviewCanvas;
        if (!ctx || !canvas) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = this._overlayColors.selectionBorder;
        for (let i = 1; i < path.length; i++) {
            const x0 = Math.round(path[i - 1].x), y0 = Math.round(path[i - 1].y);
            const x1 = Math.round(path[i].x),     y1 = Math.round(path[i].y);
            ToolBase.forEachLinePoint(x0, y0, x1, y1, (x, y) => {
                if (x >= 0 && x < canvas.width && y >= 0 && y < canvas.height) {
                    ctx.fillRect(x, y, 1, 1);
                }
            });
        }
    }

}

// Create singleton instance
/**
 * The alpha channel of a CSS colour string, as a 0-255 byte.
 *
 * Only the forms the overlay tokens actually use are parsed - rgba()/rgb()
 * and #RGBA/#RRGGBBAA - because a token that turns out to be something else
 * should fall back to the caller's default rather than silently render at
 * alpha 0 (an invisible veil reads as "the selection dim is broken", which is
 * worse than the wrong shade).
 * @param {string} color - CSS colour string
 * @param {number} fallback - alpha byte to use when none can be read
 * @returns {number} 0-255
 */
GridOverlayClass.alphaByteOf = function(color, fallback) {
    if (typeof color !== 'string') return fallback;

    const rgba = color.match(/rgba?\(([^)]+)\)/i);
    if (rgba) {
        const parts = rgba[1].split(/[,/]/).map((p) => p.trim());
        if (parts.length < 4) return 255;               // rgb() is opaque
        const a = parseFloat(parts[3]);
        if (!Number.isFinite(a)) return fallback;
        return Math.round(Helpers.clamp(a, 0, 1) * 255);
    }

    const hex = color.trim();
    if (hex[0] === '#') {
        if (hex.length === 5) return parseInt(hex[4] + hex[4], 16);   // #RGBA
        if (hex.length === 9) return parseInt(hex.slice(7, 9), 16);   // #RRGGBBAA
        if (hex.length === 4 || hex.length === 7) return 255;         // opaque
    }

    return fallback;
};

window.GridOverlay = new GridOverlayClass();

Logger.debug('GridOverlay', 'Grid overlay module loaded');

})(); // End IIFE
