'use strict';
(function() {

/**
 * Bezier Curve Tool (Phase 8)
 *
 * Interaction (multi-click handle editing):
 *  1. Drag on the canvas to place the two end anchors — a straight-line
 *     preview follows the drag, exactly like the line tool.
 *  2. On release the control handles appear (1 for quadratic, 2 for cubic),
 *     initialised on the chord. Drag any marker — anchors included — to
 *     bend the curve; the GridOverlay preview updates live.
 *  3. Commit with Enter, or by clicking away from every handle (that click
 *     also starts the next curve). Escape cancels via the universal cascade
 *     (switching tools discards the pending curve — nothing is written).
 *
 * Registered as its own (14th) tool rather than a ShapeTool variant: the
 * place-then-edit state machine doesn't fit ShapeTool's one-drag lifecycle.
 * The raster is pure math in ShapeGenerator (generateQuadraticBezier /
 * generateCubicBezier — Node-tested); commits go through PixelDrawRoutine
 * in one batch, so undo is a single action and symmetry mode applies.
 */

/** Pointer-to-marker grab distance in canvas pixels (the floor — see _grabRadius). */
const HANDLE_GRAB_RADIUS = 4;

/**
 * Marker half-size on SCREEN, in CSS pixels, EXCLUDING the dark skirt around
 * it. A handle is chrome, not artwork: it wants to be the same comfortable
 * size to aim at whatever the zoom, so it is sized in screen pixels and
 * converted back to ZX pixels at draw time — otherwise it is a speck at 100%
 * and a 40-pixel slab at 800%. 4 puts the drawn marker at 11px across at
 * 100%, the size the transform handles present (a 5px core in a 2px border
 * plus a 1px ring, css/components.css) — big enough to hit with a mouse,
 * small enough to leave the 8x8 cell under it readable.
 */
const HANDLE_SCREEN_RADIUS = 4;

class BezierToolClass extends ToolBase {
  /**
   * Declarative options - rendered by OptionControls (contract in tool-base.js).
   * It OPENS with the shared shape-type row (shape-tool.js): the curve is one
   * entry in that list, so the list has to stay reachable while the curve is
   * the active tool — otherwise picking it strands the artist in a panel with
   * no way back to the rectangle except the rail. Curve type sits under it,
   * where 'filled' sits for the shapes.
   */
  static optionsSchema = [
    SHAPE_TYPE_ROW,
    { type: 'select', key: 'curveType', i18n: 'opt.curveType', value: 'quadratic',
      options: [
        { value: 'quadratic', i18n: 'curve.quadratic' },
        { value: 'cubic',     i18n: 'curve.cubic' }
      ] },
    { type: 'range', key: 'thickness', i18n: 'opt.thickness', min: 1, max: 8, value: 1 },
    { type: 'hint', i18n: 'bezier.usage' }
  ];

  constructor() {
    super(TOOLS.BEZIER, 'Bezier');
    this._curveType = 'quadratic';
    this._thickness = 1;
    this._phase = 'idle';       // 'idle' | 'baseline' | 'edit'
    this._p0 = null;            // start anchor
    this._p1 = null;            // end anchor
    this._controls = [];        // [c1] (quadratic) or [c1, c2] (cubic)
    this._dragIndex = -1;       // index into _handles() while dragging one
    this._isEraseMode = false;

    // Enter commits the pending curve. InputHandler emits INPUT_KEY_DOWN
    // for keys it does not consume itself (facts up, commands down).
    EventBus.on(EVENTS.INPUT_KEY_DOWN, (data) => {
      if (data.key !== 'Enter') return;
      if (!window.ToolManager || ToolManager.getCurrentTool() !== this) return;
      if (this._phase === 'edit') this.commitCurve();
    });

    // Marker size is derived from the zoom, so a zoom while a curve is pending
    // has to redraw them or they stay sized for the old one.
    EventBus.on(EVENTS.CANVAS_ZOOM, () => {
      if (this._phase === 'edit') this._renderPreview();
    });
  }

  // ── Options ────────────────────────────────────────────────────────────────

  /**
   * The shared shape row reads this to show which entry is current — for this
   * tool that is always the curve itself. Choosing any OTHER entry is a tool
   * switch handled by OptionControls, so the setter only ever sees our own id.
   * @returns {string}
   */
  getShapeType() { return TOOLS.BEZIER; }
  setShapeType() { /* the curve IS the shape here — nothing to set */ }

  getCurveType() { return this._curveType; }
  setCurveType(v) {
    this._curveType = v === 'cubic' ? 'cubic' : 'quadratic';
    if (this._phase === 'edit') {
      this._resetControls();
      this._renderPreview();
    }
  }

  getThickness() { return this._thickness; }
  setThickness(v) {
    this._thickness = clamp(parseInt(v, 10) || 1, 1, 8);
    if (this._phase === 'edit') this._renderPreview();
  }

  /**
   * Hover footprint — the nib the curve will be dilated with, but ONLY while
   * idle: once anchors are down the tool owns the function-preview canvas
   * (_renderPreview draws the live curve there), and a footprint would clear
   * it on the next mouse move.
   * @param {number} pixelX - X coordinate
   * @param {number} pixelY - Y coordinate
   * @returns {Array<{x: number, y: number}>|null}
   */
  getFootprint(pixelX, pixelY) {
    if (this._phase !== 'idle') return null;
    return ShapeGenerator.nibFootprint(pixelX, pixelY, this._thickness);
  }

  // ── Pointer state machine ─────────────────────────────────────────────────

  onPointerDown(pixelX, pixelY, e) {
    if (this._phase === 'edit') {
      const hit = this._hitHandle(pixelX, pixelY);
      if (hit >= 0) {
        this._dragIndex = hit;
        this.isDrawing = true;
        return;
      }
      // Click away from every handle: commit this curve, start the next one
      this.commitCurve();
    }

    this._p0 = { x: pixelX, y: pixelY };
    this._p1 = null;
    this._controls = [];
    this._phase = 'baseline';
    this._isEraseMode = e.button === 2;
    this.isDrawing = true;
  }

  onPointerMove(pixelX, pixelY, e) {
    if (!this.isDrawing) return;

    if (this._phase === 'baseline' && this._p0) {
      // Straight-line preview while placing the anchors
      if (window.GridOverlay) {
        const line = ShapeGenerator.generateShape('line', {
          x1: this._p0.x, y1: this._p0.y, x2: pixelX, y2: pixelY
        });
        if (this._isEraseMode) GridOverlay.drawCompositorPreview([], line);
        else GridOverlay.drawCompositorPreview(line, []);
      }
      return;
    }

    if (this._phase === 'edit' && this._dragIndex >= 0) {
      this._moveHandle(this._dragIndex, pixelX, pixelY);
      this._renderPreview();
    }
  }

  onPointerUp(pixelX, pixelY, e) {
    if (this._phase === 'baseline' && this._p0) {
      this._p1 = { x: pixelX, y: pixelY };
      this._resetControls();
      this._phase = 'edit';
      this.isDrawing = false;
      this._renderPreview();
      return;
    }

    if (this._phase === 'edit' && this._dragIndex >= 0) {
      this._moveHandle(this._dragIndex, pixelX, pixelY);
      this._dragIndex = -1;
      this.isDrawing = false;
      this._renderPreview();
    }
  }

  onPointerLeave(e) {
    // Keep the pending curve — the user may come back to its handles.
    this._dragIndex = -1;
    this.isDrawing = false;
  }

  /** Switching tools (incl. the Escape cascade) cancels the pending curve. */
  deactivate() {
    this._resetState();
    super.deactivate();
  }

  // ── Commit ────────────────────────────────────────────────────────────────

  /** Rasterize and draw the pending curve as one undoable batch. */
  commitCurve() {
    if (this._phase !== 'edit' || !this._p0 || !this._p1) return;

    const pixels = this._curvePixels();
    const mode = PixelDrawRoutine.resolveUserMode(!this._isEraseMode);
    const color = ColorManager.getCurrentSelection();

    PixelDrawRoutine.beginBatch('Bezier curve');
    for (let i = 0; i < pixels.length; i++) {
      PixelDrawRoutine.draw(pixels[i].x, pixels[i].y, color, mode);
    }
    PixelDrawRoutine.endBatch();

    this._resetState();
    this.clearPreview();
  }

  // ── Geometry helpers ──────────────────────────────────────────────────────

  /** Draggable markers in a stable order: p0, controls…, p1. @private */
  _handles() {
    return [this._p0, ...this._controls, this._p1].filter(Boolean);
  }

  /**
   * Marker radius in ZX pixels for the current zoom — the screen size divided
   * by the scale, floored at one pixel (past ~500% a single ZX pixel is
   * already bigger than the target). @private
   */
  _handleRadius() {
    const zoom = (window.StateManager && typeof StateManager.getZoom === 'function'
      ? StateManager.getZoom() : 0) || DEFAULT_ZOOM || 100;
    return Math.max(1, Math.round(HANDLE_SCREEN_RADIUS / (zoom / 100)));
  }

  /**
   * Grab distance: never smaller than what is DRAWN, or the artist aims at the
   * marker they can see and misses it. @private
   */
  _grabRadius() {
    return Math.max(HANDLE_GRAB_RADIUS, this._handleRadius() + 1);
  }

  /** @private */
  _hitHandle(x, y) {
    const handles = this._handles();
    const grab = this._grabRadius();
    for (let i = 0; i < handles.length; i++) {
      if (Math.abs(handles[i].x - x) <= grab &&
          Math.abs(handles[i].y - y) <= grab) {
        return i;
      }
    }
    return -1;
  }

  /** @private */
  _moveHandle(index, x, y) {
    const handles = this._handles();
    const handle = handles[index];
    if (!handle) return;
    handle.x = x;
    handle.y = y;
  }

  /** Initialise control handles on the chord (1/2 · or 1/3 + 2/3). @private */
  _resetControls() {
    if (!this._p0 || !this._p1) return;
    const { x: x0, y: y0 } = this._p0;
    const dx = this._p1.x - x0;
    const dy = this._p1.y - y0;
    if (this._curveType === 'cubic') {
      this._controls = [
        { x: Math.round(x0 + dx / 3),     y: Math.round(y0 + dy / 3) },
        { x: Math.round(x0 + dx * 2 / 3), y: Math.round(y0 + dy * 2 / 3) }
      ];
    } else {
      this._controls = [
        { x: Math.round(x0 + dx / 2), y: Math.round(y0 + dy / 2) }
      ];
    }
  }

  /** Current curve raster from ShapeGenerator (pure math). @private */
  _curvePixels() {
    const opts = { thickness: this._thickness };
    if (this._curveType === 'cubic') {
      return ShapeGenerator.generateCubicBezier(
        this._p0, this._controls[0], this._controls[1], this._p1, opts);
    }
    return ShapeGenerator.generateQuadraticBezier(
      this._p0, this._controls[0], this._p1, opts);
  }

  // ── Preview ───────────────────────────────────────────────────────────────

  /**
   * Live preview: the curve on the compositor preview canvas (true WYSIWYG
   * against the attribute rules) and the handle markers on the function
   * preview canvas — separate canvases, so both render at once.
   *
   * The markers are geometry only; GridOverlay paints them (two-tone squares
   * for the anchors, diamonds for the controls). The guide lines join each
   * anchor to the control that pulls it — with them the curve reads as a
   * mechanism you can grab, without them the control points are two dots
   * floating in the middle of the picture with nothing tying them to it.
   * @private
   */
  _renderPreview() {
    if (!window.GridOverlay) return;

    const pixels = this._curvePixels();
    if (this._isEraseMode) GridOverlay.drawCompositorPreview([], pixels);
    else GridOverlay.drawCompositorPreview(pixels, []);

    const points = this._handles();
    const radius = this._handleRadius();
    const last = points.length - 1;
    const handles = points.map((p, i) => ({
      x: p.x, y: p.y, radius,
      kind: (i === 0 || i === last) ? 'anchor' : 'control',
      active: i === this._dragIndex
    }));

    // Quadratic: both anchors pull on the one control. Cubic: each anchor has
    // its own, in _handles() order p0, c1, c2, p1.
    const links = this._curveType === 'cubic'
      ? [[0, 1], [2, 3]]
      : [[0, 1], [1, 2]];
    const linkPixels = [];
    for (const [a, b] of links) {
      if (!points[a] || !points[b]) continue;
      linkPixels.push(...ShapeGenerator.generateShape('line', {
        x1: points[a].x, y1: points[a].y, x2: points[b].x, y2: points[b].y
      }));
    }

    GridOverlay.drawHandles(handles, linkPixels);
  }

  /** @private */
  _resetState() {
    this._phase = 'idle';
    this._p0 = null;
    this._p1 = null;
    this._controls = [];
    this._dragIndex = -1;
    this._isEraseMode = false;
    this.isDrawing = false;
  }
}

// Expose to global scope
window.BezierTool = BezierToolClass;

Logger.debug('BezierTool', 'Bezier tool loaded');

})(); // End IIFE
