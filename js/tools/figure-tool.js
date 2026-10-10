'use strict';
(function() {

/**
 * Figure Tool (Batch 7 part 7A) - the point-based figures: polyline (freehand runs and straight
 * segments), polygon, triangle, rays, orthogonal line and parallel line. The geometry lives in
 * FigureModel (pure); this file is the interaction and the drawing.
 *
 * Interaction:
 *  - Click adds a point. Press and drag adds a freehand run (open figures: polyline, polygon, rays).
 *    For the three-point figures (triangle, orthogonal, parallel) the first press-and-drag draws
 *    the first line, then one click adds the last point.
 *  - A double click, or Enter, finishes the figure: it stays PENDING (visible, editable) like a
 *    Bezier curve. Enter again, a click elsewhere, or picking another tool COMMITS it as one undo
 *    step. Backspace removes the last point (a whole freehand run at a time). Escape drops it.
 *  - The three-point figures finish themselves when their last point is placed.
 *
 * The preview IS the commit: both come from one write plan (_plan), the preview going through
 * GridOverlay.drawCompositorPreview (simulateCell + the compositor) on the pixels
 * PixelDrawRoutine.strokeTargets says the commit will write - mirror and drawing guide included.
 * A figure is drawn in one batch, so undo is one step and draw mode, Inverse, the use-existing boxes,
 * the colour core, indexed modes and GigaScreen all apply as they do for any shape.
 */

/** Two clicks within this many ms (and close together) are a double click. [A: the Windows default, 500 ms] */
const FIGURE_DBL_MS = 500;

/** Pointer-to-marker grab distance in canvas pixels (the floor). */
const FIGURE_GRAB_RADIUS = 4;

/** Marker half-size on screen in CSS pixels, as the Bezier tool's. */
const FIGURE_HANDLE_SCREEN_RADIUS = 4;

class FigureToolClass extends ToolBase {
  /** Declarative options - rendered by OptionControls (contract in tool-base.js). */
  static optionsSchema = [
    SHAPE_TYPE_ROW,
    // Fill: only the closed figures have an inside.
    { type: 'check', key: 'filled', i18n: 'opt.filled', value: false,
      showIf: { key: 'shapeType', in: ['figure-polygon', 'figure-triangle'] } },
    { type: 'range', key: 'thickness', i18n: 'opt.thickness', min: 1, max: 8, value: 1,
      showIf: { any: [ { key: 'filled', equals: false },
                       { key: 'shapeType', notIn: ['figure-polygon', 'figure-triangle'] } ] } },
    // Colour core: only the cells under the figure's centre lines take the colours.
    { type: 'select', key: 'colourCore', i18n: 'opt.colourCore', value: 'whole',
      options: ToolBase.COLOUR_CORE_OPTS,
      showIf: { all: [
        { any: [ { key: 'filled', equals: false },
                 { key: 'shapeType', notIn: ['figure-polygon', 'figure-triangle'] } ] },
        { cells: true } ] } },
    // Line style: the dash styles need a one-pixel line (a filled figure counts as one).
    ToolBase.lineStyleRow({ thickWhen: { all: [
      { any: [ { key: 'filled', equals: false },
               { key: 'shapeType', notIn: ['figure-polygon', 'figure-triangle'] } ] },
      { key: 'thickness', gt: 1 } ] } }),
    { type: 'hint', i18n: 'lineStyle.thinOnly', showIf: { all: [
      { any: [ { key: 'filled', equals: false },
               { key: 'shapeType', notIn: ['figure-polygon', 'figure-triangle'] } ] },
      { key: 'thickness', gt: 1 } ] } },
    { type: 'hint', i18n: 'lineStyle.clearHint', showIf: { all: [
      { key: 'lineStyle', equals: 'clear' },
      { any: [ { key: 'filled', equals: false },
               { key: 'shapeType', notIn: ['figure-polygon', 'figure-triangle'] } ] } ] } },
    { type: 'hint', i18n: 'figure.usage.open',
      showIf: { key: 'shapeType', in: ['figure-polyline', 'figure-polygon', 'figure-rays'] } },
    { type: 'hint', i18n: 'figure.usage.fixed',
      showIf: { key: 'shapeType', in: ['figure-triangle', 'figure-orthogonal', 'figure-parallel'] } }
  ];

  constructor() {
    super(TOOLS.FIGURE, 'Figure');
    this._type = FIGURE_TYPES.POLYLINE;
    this._filled = false;
    this._thickness = 1;
    this._colourCore = 'whole';
    this._lineStyle = 'solid';
    this._phase = 'idle';          // 'idle' | 'drawing' | 'pending'
    this._model = null;
    this._isEraseMode = false;
    this._press = null;            // { x, y, moved, first }
    this._lastClick = null;        // { x, y, t }
    this._finishOnRelease = false;
    this._hover = null;

    // The pending preview is the picture the commit WOULD leave right now, which depends on the
    // colours, mode, symmetry, drawing guide, palette and layer in force. Redraw when any of them
    // change; a document-level change drops the figure instead.
    const redraw = () => {
      if (this._model && window.ToolManager && ToolManager.getCurrentTool() === this) this._renderPreview();
    };
    for (const name of ['COLOR_INK', 'COLOR_PAPER', 'COLOR_BRIGHT', 'COLOR_FLASH', 'PALETTE_CHANGED',
      'PALETTE_SLOT_CHANGED', 'DRAW_MODE_CHANGED', 'INVERSE_CHANGED', 'SYMMETRY_CHANGED', 'CLIP_CHANGED',
      'LAYER_SELECTED', 'LAYER_VISIBILITY', 'HISTORY_UNDO', 'HISTORY_REDO', 'CANVAS_ZOOM']) {
      if (EVENTS[name]) EventBus.on(EVENTS[name], redraw);
    }
    for (const name of ['FILE_NEW', 'FILE_OPEN', 'SCREEN_MODE_CHANGED']) {
      if (EVENTS[name]) EventBus.on(EVENTS[name], () => { if (this._model) this.cancelPending(); });
    }
  }

  // ── Options ────────────────────────────────────────────────────────────────

  /** The shared shape row reads this: which figure type is current. */
  getShapeType() { return this._type; }

  /** Choosing another figure type commits what is pending, then switches. */
  setShapeType(v) {
    if (!Object.values(FIGURE_TYPES).includes(v) || v === this._type) return;
    if (this._model) this.commit();
    this._type = v;
  }

  getFilled() { return this._filled; }
  setFilled(v) {
    this._filled = !!v;
    if (this._model) { this._model.options.filled = this._filled; this._renderPreview(); }
  }

  getThickness() { return this._thickness; }
  setThickness(v) {
    this._thickness = clamp(parseInt(v, 10) || 1, 1, 8);
    if (this._model) { this._model.options.thickness = this._thickness; this._renderPreview(); }
  }

  getColourCore() { return this._colourCore; }
  setColourCore(v) {
    this._colourCore = ToolBase.cleanColourCore(v);
    if (this._model) this._renderPreview();
  }

  getLineStyle() { return this._lineStyle; }
  setLineStyle(v) {
    this._lineStyle = ShapeGenerator.constructor.cleanLineStyle(v);
    if (this._model) { this._model.options.lineStyle = this._lineStyle; this._renderPreview(); }
  }

  /** Hover footprint: the nib the figure is dilated with. */
  getFootprint(pixelX, pixelY) {
    return ShapeGenerator.nibFootprint(pixelX, pixelY, this._thickness);
  }

  /** Every sample of a freehand run is kept; a click-only phase does not care. */
  get coalescesPointerMoves() { return !(this._model && this._press && this._isOpenType()); }

  // ── State helpers ──────────────────────────────────────────────────────────

  /** True for the open-ended types that take freehand runs. @private */
  _isOpenType() {
    return this._type === FIGURE_TYPES.POLYLINE || this._type === FIGURE_TYPES.POLYGON || this._type === FIGURE_TYPES.RAYS;
  }

  get hasPending() { return !!this._model; }

  /** @private */
  _newModel() {
    this._model = new FigureModel(this._type, { filled: this._filled, thickness: this._thickness, lineStyle: this._lineStyle });
    this._phase = 'drawing';
  }

  /** @private */
  _reset() {
    this._model = null;
    this._phase = 'idle';
    this._press = null;
    this._finishOnRelease = false;
    this._hover = null;
    this.isDrawing = false;
  }

  // ── Pointer state machine ─────────────────────────────────────────────────

  onPointerDown(pixelX, pixelY, e) {
    // A pending figure: a click away commits it and starts the next one.
    if (this._phase === 'pending') this.commit();

    if (!this._model) {
      this._newModel();
      this._isEraseMode = e.button === 2;
    }

    const now = (e && typeof e.timeStamp === 'number') ? e.timeStamp : Date.now();
    const last = this._lastClick;
    const grab = this._grabRadius();
    const isDouble = !!(last && this._model.points.length > 0 && now - last.t <= FIGURE_DBL_MS &&
      Math.abs(last.x - pixelX) <= grab && Math.abs(last.y - pixelY) <= grab);

    this.isDrawing = true;
    if (isDouble) {
      this._finishOnRelease = true;
      this._press = { x: pixelX, y: pixelY, moved: false, first: false };
      return;
    }
    this._finishOnRelease = false;
    this._model.addPoint({ x: pixelX, y: pixelY });
    this._press = { x: pixelX, y: pixelY, moved: false, first: this._model.points.length === 1 };
    this._lastClick = { x: pixelX, y: pixelY, t: now };
    this._renderPreview();
  }

  onPointerMove(pixelX, pixelY, e) {
    if (!this.isDrawing || !this._model || !this._press) return;
    if (pixelX !== this._press.x || pixelY !== this._press.y) this._press.moved = true;
    if (this._finishOnRelease) return;

    if (this._isOpenType()) {
      this._model.extendRun({ x: pixelX, y: pixelY });
      this._renderPreview();
      return;
    }
    // Three-point figures: the first drag draws the first line (its end is added on release);
    // on the other presses the point just placed follows the pointer.
    if (this._press.first) {
      this._renderPreview(this._model.withPoint({ x: pixelX, y: pixelY }));
    } else {
      const pts = this._model.points;
      pts[pts.length - 1] = { x: pixelX, y: pixelY };
      this._renderPreview();
    }
  }

  onPointerUp(pixelX, pixelY, e) {
    if (!this.isDrawing || !this._model) { this.isDrawing = false; return; }
    const press = this._press;
    this.isDrawing = false;
    this._press = null;

    if (this._finishOnRelease) {
      this._finishOnRelease = false;
      this._finishFigure();
      return;
    }
    if (press && press.first && press.moved && !this._isOpenType()) {
      this._model.addPoint({ x: pixelX, y: pixelY });
      this._lastClick = { x: pixelX, y: pixelY, t: (e && e.timeStamp) || Date.now() };
    }
    if (this._model.isComplete()) { this._finishFigure(); return; }
    this._renderPreview();
  }

  onPointerHover(pixelX, pixelY) {
    if (this._phase !== 'drawing' || !this._model || this._model.points.length === 0 || this.isDrawing) return;
    this._hover = { x: pixelX, y: pixelY };
    this._renderPreview(this._model.withPoint(this._hover));
  }

  onPointerLeave() {
    // Keep the figure; end a run.
    this.isDrawing = false;
    this._press = null;
    this._hover = null;
    if (this._model) this._renderPreview();
  }

  /** @private */
  _finishFigure() {
    this._model.finish();
    this._phase = 'pending';
    this._renderPreview();
  }

  // ── Keys ──────────────────────────────────────────────────────────────────

  /**
   * Enter and Backspace, claimed before the global shortcuts (InputHandler).
   * Enter: a figure being drawn becomes pending; a pending one is committed.
   * Backspace: remove the last point (a whole freehand run).
   * @returns {boolean} whether the key was used
   */
  handleKey(key) {
    if (!this._model || this.isDrawing) return false;
    if (key === 'Enter') {
      if (this._phase === 'pending') this.commit();
      else if (this._model.points.length > 0) this._finishFigure();
      else return false;
      return true;
    }
    if (key === 'Backspace') {
      this._model.removeLastPoint();
      if (this._model.points.length === 0) {
        this._reset();
        this.clearPreview();
      } else {
        this._phase = 'drawing';
        this._renderPreview();
      }
      return true;
    }
    return false;
  }

  /** Escape: drop the figure without drawing it. */
  cancelPending() {
    if (!this._model) return;
    this._reset();
    this.clearPreview();
  }

  /** Switching tools commits a pending figure (nothing the person drew is lost). */
  deactivate() {
    if (this._model && this._model.points.length > 0) this.commit();
    this._reset();
    super.deactivate();
  }

  // ── Write plan: the preview IS the commit ─────────────────────────────────

  /** The pixels, colour core and erase flag for the current figure. @private */
  _plan(model = this._model) {
    const r = model.rasterise();
    let core = null;
    const size = ToolBase.colourCoreSize(this._colourCore);
    const filled = this._filled && model.fillable && model.points.length >= 3;
    if (size && !filled && this._thickness > size && window.ColorManager && ColorManager.hasCellAttributes()) {
      core = ShapeGenerator.corePredicate(r.centre, size);
    }
    return { pixels: r.pixels, core, erase: this._isEraseMode };
  }

  /** Draw the figure as one undoable batch, then forget it. */
  commit() {
    const model = this._model;
    if (!model || model.points.length === 0) { this._reset(); this.clearPreview(); return; }
    const plan = this._plan(model);
    const mode = PixelDrawRoutine.resolveUserMode(!plan.erase);
    const color = ColorManager.getCurrentSelection();
    PixelDrawRoutine.beginBatch('Figure');
    PixelDrawRoutine.withColourCore(plan.core, () => {
      for (const p of plan.pixels) PixelDrawRoutine.draw(p.x, p.y, color, mode);
    });
    PixelDrawRoutine.endBatch();
    this._reset();
    this.clearPreview();
  }

  // ── Preview ───────────────────────────────────────────────────────────────

  /**
   * Draw the figure (or a hover variant of it) as the compositor preview, restricted to the
   * pixels the commit would really write, plus the point markers.
   * @private
   */
  _renderPreview(model = this._model) {
    if (!window.GridOverlay || !model) return;
    const plan = this._plan(model);
    const t = PixelDrawRoutine.strokeTargets(plan.pixels, plan.core);
    PixelDrawRoutine.withColourCore(t.isCore, () => {
      if (plan.erase) GridOverlay.drawCompositorPreview([], t.pixels);
      else GridOverlay.drawCompositorPreview(t.pixels, []);
    });
    this._renderHandles(this._model);
  }

  /** Point markers: anchors for pressed points, a control marker for the third point of a 3-point figure. @private */
  _renderHandles(model) {
    if (!model) return;
    const radius = this._handleRadius();
    const handles = [];
    model.points.forEach((p, i) => {
      if (model.kinds[i] !== 'v') return;
      const control = (model.type === FIGURE_TYPES.ORTHOGONAL || model.type === FIGURE_TYPES.PARALLEL) && i === 2;
      handles.push({ x: p.x, y: p.y, radius, kind: control ? 'control' : 'anchor', active: false });
    });
    // a freehand run's last sample is an anchor too, so the person can see where it ended
    const n = model.points.length;
    if (n > 0 && model.kinds[n - 1] === 'r') {
      handles.push({ x: model.points[n - 1].x, y: model.points[n - 1].y, radius, kind: 'anchor', active: false });
    }
    GridOverlay.drawHandles(handles, []);
  }

  /** Marker radius in ZX pixels for the current zoom (screen size / scale, at least one pixel). @private */
  _handleRadius() {
    const zoom = (window.StateManager && typeof StateManager.getZoom === 'function'
      ? StateManager.getZoom() : 0) || DEFAULT_ZOOM || 100;
    return Math.max(1, Math.round(FIGURE_HANDLE_SCREEN_RADIUS / (zoom / 100)));
  }

  /** Never smaller than what is drawn, or the person aims at the marker they see and misses it. @private */
  _grabRadius() {
    return Math.max(FIGURE_GRAB_RADIUS, this._handleRadius() + 1);
  }
}

// Expose to global scope
window.FigureTool = FigureToolClass;

Logger.debug('FigureTool', 'Figure tool loaded');

})(); // End IIFE
