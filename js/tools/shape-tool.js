'use strict';
(function() {

/**
 * Shape types supported by the shape tool
 * @const {Object}
 */
var SHAPE_TYPES = Object.freeze({
  LINE: 'line',
  RECTANGLE: 'rectangle',
  CIRCLE: 'circle',
  ELLIPSE: 'ellipse',
  TRIANGLE: 'triangle'
});

// Expose to global scope
window.SHAPE_TYPES = SHAPE_TYPES;

/**
 * Shape Tool
 *
 * Draws geometric shapes (rectangles, circles, ellipses).
 * Supports both outline and filled modes.
 * Left-click draws with INK, right-click erases.
 */
const SHAPE_TYPE_OPTS = Object.freeze([
  { i18n: 'shapecat.basic', options: [
    { value: 'line',              i18n: 'shape.line',              hintI18n: 'shapeType.line.hint' },
    { value: 'rectangle',         i18n: 'common.rectangle',        hintI18n: 'shapeType.rectangle.hint' },
    { value: 'square',            i18n: 'common.square',           hintI18n: 'shapeType.square.hint' },
    { value: 'rounded-rectangle', i18n: 'shape.roundedRectangle',  hintI18n: 'shapeType.roundedRectangle.hint' }
  ]},
  { i18n: 'shapecat.radial', options: [
    { value: 'circle',  i18n: 'common.circle' },
    { value: 'ellipse', i18n: 'shape.ellipse' },
    { value: 'arc',     i18n: 'shape.arc' },
    { value: 'sector',  i18n: 'shape.sector' },
    { value: 'ring',    i18n: 'shape.ring' },
    // The bezier curve is a TOOL, not a shapeType: its place-then-bend state
    // machine does not fit ShapeTool's one-drag lifecycle (see bezier-tool.js).
    // `tool` says so, and OptionControls switches to it instead of calling
    // setShapeType — so the artist finds every drawn curve in one list while
    // the two implementations stay apart.
    // No raster of its own to draw as an icon — it has no shape until you
    // place one — so it wears the rail's bezier symbol.
    { value: TOOLS.BEZIER, i18n: 'tool.bezier', tool: TOOLS.BEZIER, icon: 'icon-bezier' }
  ]},
  { i18n: 'shapecat.polygons', options: [
    { value: 'triangle',      i18n: 'common.triangle' },
    { value: 'diamond',       i18n: 'gt.diamond' },
    { value: 'parallelogram', i18n: 'shape.parallelogram' },
    { value: 'pentagon',  i18n: 'shape.pentagon' },
    { value: 'hexagon',   i18n: 'shape.hexagon' },
    { value: 'heptagon',  i18n: 'shape.heptagon' },
    { value: 'octagon',   i18n: 'shape.octagon' },
    { value: 'nonagon',   i18n: 'shape.nonagon' },
    { value: 'decagon',   i18n: 'shape.decagon' },
    { value: 'dodecagon', i18n: 'shape.dodecagon' }
  ]},
  { i18n: 'shapecat.symbols', options: [
    { value: 'x',     i18n: 'shape.x' },
    { value: 'heart', i18n: 'shape.heart' },
    { value: 'star',  i18n: 'shape.star' },
    { value: 'arrow', i18n: 'shape.arrow' }
  ]},
  { i18n: 'shapecat.complex', options: [
    { value: 'house',     i18n: 'shape.house' },
    { value: 'moon',      i18n: 'shape.moon' },
    { value: 'flower',    i18n: 'shape.flower' },
    { value: 'gear',      i18n: 'shape.gear' },
    { value: 'spiral',    i18n: 'gt.spiral' },
    { value: 'bowtie',    i18n: 'shape.bowtie' },
    { value: 'hourglass', i18n: 'shape.hourglass' }
  ]}
]);

// Expose for UI consumers (menus, keyboard map) alongside EXTENDED_SHAPE_TYPES
window.SHAPE_TYPE_OPTS = SHAPE_TYPE_OPTS;

/**
 * The shape-type row itself, shared by every tool that draws one of these —
 * ShapeTool and the bezier curve. Whichever is active, the artist sees the SAME
 * list in the same place and can move between all of them from it: `tool` names
 * the row's home tool, so an option with no `tool` of its own switches back to
 * ShapeTool (carrying the chosen shape), while the bezier entry's own `tool`
 * overrides that. OptionControls._commit implements both.
 * @const {Object}
 */
const SHAPE_TYPE_ROW = Object.freeze({
  type: 'icons', key: 'shapeType', i18n: 'opt.shape', value: 'rectangle',
  tool: 'shape', options: SHAPE_TYPE_OPTS
});
window.SHAPE_TYPE_ROW = SHAPE_TYPE_ROW;

/**
 * The rows that belong to ONE shape — the parameters its generator already
 * takes and that, until they were given controls, no artist could reach: every
 * star was 5-pointed, every gear had 8 teeth. Each is keyed to its shape by
 * `showIf`, so picking a shape brings its own dial up under the grid and
 * nothing else's.
 *
 * Ratios and angles are dialled in the units a person uses (percent, degrees)
 * and converted where they are handed to the generator (_shapeOptions), which
 * takes fractions and radians.
 * @const {Array<Object>}
 */
const SHAPE_PARAM_ROWS = Object.freeze([
  { type: 'range', key: 'starPoints',   i18n: 'opt.starPoints',   min: 3, max: 12, value: 5,
    showIf: { key: 'shapeType', equals: 'star' } },
  { type: 'range', key: 'flowerPetals', i18n: 'opt.flowerPetals', min: 3, max: 12, value: 6,
    showIf: { key: 'shapeType', equals: 'flower' } },
  { type: 'range', key: 'gearTeeth',    i18n: 'opt.gearTeeth',    min: 3, max: 16, value: 8,
    showIf: { key: 'shapeType', equals: 'gear' } },
  { type: 'range', key: 'spiralTurns',  i18n: 'opt.spiralTurns',  min: 1, max: 8,  value: 3,
    showIf: { key: 'shapeType', equals: 'spiral' } },
  { type: 'range', key: 'ringInner',    i18n: 'opt.ringInner',    min: 10, max: 90, step: 5, value: 50, unit: '%',
    showIf: { key: 'shapeType', equals: 'ring' } },
  { type: 'range', key: 'moonPhase',    i18n: 'opt.moonPhase',    min: 5, max: 95, step: 5, value: 30, unit: '%',
    showIf: { key: 'shapeType', equals: 'moon' } },
  // Arc and sector share the dial but not its default (a half circle against a
  // quarter wedge), so setShapeType re-seeds it and the row follows the tool's
  // own value on the next options fact rather than holding a stale one.
  { type: 'range', key: 'arcSpan',      i18n: 'opt.arcSpan',      min: 15, max: 360, step: 15, value: 180, unit: '°',
    syncEvent: EVENTS.TOOL_OPTIONS,
    showIf: { key: 'shapeType', in: ['arc', 'sector'] } }
]);
window.SHAPE_PARAM_ROWS = SHAPE_PARAM_ROWS;

class ShapeToolClass extends ToolBase {
  /** Declarative options - rendered by OptionControls (contract in tool-base.js). */
  static optionsSchema = [
    // Draw mode is the GLOBAL top-bar selector (StateManager) — not per-tool.
    SHAPE_TYPE_ROW,
    { type: 'check',  key: 'filled',    i18n: 'opt.filled', value: false,
      // Hidden for shapes with no fillable interior (open/1-D rasters).
      showIf: { key: 'shapeType', notIn: ['line', 'arc', 'spiral', 'x'] } },
    { type: 'range',  key: 'thickness', i18n: 'opt.thickness', min: 1, max: 8, value: 1,
      // Outline stroke width. Shown for any UNFILLED shape, and for the always-
      // outline line/arc/spiral/x (whose 'filled' is hidden); hidden when filled.
      showIf: { any: [ { key: 'filled', equals: false },
                       { key: 'shapeType', in: ['line', 'arc', 'spiral', 'x'] } ] } },
    ...SHAPE_PARAM_ROWS
  ];

  constructor() {
    super(TOOLS.RECTANGLE, 'Shape');
    this.shapeType = SHAPE_TYPES.RECTANGLE;
    this.filled = false;
    this.startPoint = null;
    this.previewActive = false;
    this.isEraseMode = false;
    this._thickness = 1;

    // Per-shape parameters (SHAPE_PARAM_ROWS). Kept in the units the sliders
    // show; _shapeOptions converts them for the generator.
    this._starPoints = 5;
    this._flowerPetals = 6;
    this._gearTeeth = 8;
    this._spiralTurns = 3;
    this._ringInner = 50;     // percent of the outer radius
    this._moonPhase = 30;     // percent of the radius the cutout is offset by
    this._arcSpan = 180;      // degrees
  }

  // Draw mode is global; delegate for any external callers.
  getDrawMode() { return StateManager.getDrawMode(); }
  setDrawMode(v) { StateManager.setDrawMode(v); }

  /**
   * Handle pointer down - set start point
   * @param {number} pixelX - X coordinate (0-255)
   * @param {number} pixelY - Y coordinate (0-191)
   * @param {PointerEvent} e - Pointer event
   */
  onPointerDown(pixelX, pixelY, e) {
    this.isDrawing = true;
    this.startPoint = { x: pixelX, y: pixelY };
    this.previewActive = true;
    this.isEraseMode = e.button === 2;
  }

  /**
   * Handle pointer move - show shape preview
   * @param {number} pixelX - X coordinate (0-255)
   * @param {number} pixelY - Y coordinate (0-191)
   * @param {PointerEvent} e - Pointer event
   */
  onPointerMove(pixelX, pixelY, e) {
    if (!this.isDrawing || !this.startPoint) return;

    // Generate pixel-accurate preview for all shapes
    if (window.GridOverlay) {
      const pixels = this._getShapePixels(
        this.startPoint.x, this.startPoint.y,
        pixelX, pixelY
      );

      if (this.isEraseMode) {
        GridOverlay.drawCompositorPreview([], pixels);
      } else {
        GridOverlay.drawCompositorPreview(pixels, []);
      }
    }
  }

  /**
   * Handle pointer up - draw the shape
   * @param {number} pixelX - X coordinate (0-255)
   * @param {number} pixelY - Y coordinate (0-191)
   * @param {PointerEvent} e - Pointer event
   */
  onPointerUp(pixelX, pixelY, e) {
    if (!this.startPoint) return;

    this.isDrawing = false;
    this.previewActive = false;

    this.clearPreview();

    // Erase mode captured at pointer down, resolved through the global draw mode.
    const isInk = !this.isEraseMode;
    const mode = PixelDrawRoutine.resolveUserMode(isInk);
    const color = ColorManager.getCurrentSelection();

    // Get all pixels for the shape
    const pixels = this._getShapePixels(
      this.startPoint.x, this.startPoint.y,
      pixelX, pixelY
    );

    PixelDrawRoutine.beginBatch();

    for (let i = 0; i < pixels.length; i++) {
      const p = pixels[i];
      // PixelDrawRoutine.draw handles bounds checking
      PixelDrawRoutine.draw(p.x, p.y, color, mode);
    }

    PixelDrawRoutine.endBatch();

    this.startPoint = null;
    this.isEraseMode = false;
  }

  /**
   * Handle pointer leave - cancel shape drawing
   * @param {PointerEvent} e - Pointer event
   */
  onPointerLeave(e) {
    this.isDrawing = false;
    this.previewActive = false;
    this.startPoint = null;
    this.isEraseMode = false;
    this.clearPreview();
  }

  /**
   * Get all pixels for the current shape type
   * @param {number} x1 - Start X (click point)
   * @param {number} y1 - Start Y (click point)
   * @param {number} x2 - End X (current point)
   * @param {number} y2 - End Y (current point)
   * @returns {Array<{x: number, y: number}>} Array of pixels
   * @private
   */
  _getShapePixels(x1, y1, x2, y2) {
    // Check if this is a center-anchored shape
    const isCenterAnchored = this._isCenterAnchoredShape(this.shapeType);

    // Try to use ShapeGenerator for extended shapes
    if (window.ShapeGenerator && window.ShapeGenerator.hasShape(this.shapeType)) {
      let bounds;
      if (isCenterAnchored) {
        // For center-anchored shapes: start point is center, drag defines radius
        bounds = this._getCenterAnchoredBounds(x1, y1, x2, y2);
      } else {
        bounds = { x1, y1, x2, y2 };
      }
      return window.ShapeGenerator.generateShape(this.shapeType, bounds, this._shapeOptions());
    }

    Logger.warn('ShapeTool', `Shape not found in ShapeGenerator: ${this.shapeType}`);
    return [];
  }

  /**
   * Everything the generator may want, in ITS units. Handing over the whole
   * set is deliberate: each generator destructures the one or two keys it
   * knows and ignores the rest, so a new parameter is a row plus a line here
   * rather than a switch on the shape type.
   * @returns {Object}
   * @private
   */
  _shapeOptions() {
    return {
      filled: this.filled,
      thickness: this._thickness,
      points: this._starPoints,
      petals: this._flowerPetals,
      teeth: this._gearTeeth,
      turns: this._spiralTurns,
      innerRatio: this._ringInner / 100,
      phase: this._moonPhase / 100,
      arcSpan: this._arcSpan * Math.PI / 180
    };
  }

  /**
   * Check if a shape should be drawn from center outward
   * @param {string} shapeType - Shape type
   * @returns {boolean}
   * @private
   */
  _isCenterAnchoredShape(shapeType) {
    // These shapes use center-anchored bounds (start point = center, drag defines radius)
    // Shapes NOT in this list use direct coordinates (x1,y1 = start, x2,y2 = drag point)
    const centerAnchoredShapes = [
      'circle', 'ellipse',  // Radial shapes - edge touches drag point
      'star', 'flower', 'gear',  // Complex symmetric shapes
      'heart', 'x', 'plus', 'hourglass'  // Symmetric symbols
    ];
    // Note: triangle, kite, arc, sector, spiral, moon, diamond,
    // pentagon, hexagon, octagon, polygon all use direct x1,y1 -> x2,y2 coordinates
    // so one vertex connects directly to the drag point
    return centerAnchoredShapes.includes(shapeType);
  }

  /**
   * Calculate bounds for center-anchored shapes
   * Start point becomes center, end point defines the radius
   * @param {number} cx - Center X (start point)
   * @param {number} cy - Center Y (start point)
   * @param {number} ex - Edge X (end point)
   * @param {number} ey - Edge Y (end point)
   * @returns {Object} Bounds object with x1, y1, x2, y2 forming a box around center
   * @private
   */
  _getCenterAnchoredBounds(cx, cy, ex, ey) {
    const dx = Math.abs(ex - cx);
    const dy = Math.abs(ey - cy);
    // For uniform shapes like circle, use the distance as radius
    // For non-uniform shapes, use dx and dy separately
    return {
      x1: cx - dx,
      y1: cy - dy,
      x2: cx + dx,
      y2: cy + dy
    };
  }

  /**
   * Set shape type
   * @param {string} type - Shape type (from SHAPE_TYPES or ShapeGenerator)
   */
  setShapeType(type) {
    // Accept any shape from SHAPE_TYPES or ShapeGenerator
    const isValidBasic = Object.values(SHAPE_TYPES).includes(type);
    const isValidExtended = window.ShapeGenerator && window.ShapeGenerator.hasShape(type);

    if (isValidBasic || isValidExtended) {
      const changed = this.shapeType !== type;
      this.shapeType = type;
      // The two shapes that share the sweep dial want different amounts of it:
      // an arc is half a circle, a sector a quarter wedge. Re-seed on arrival
      // so each is what it should be before it is touched.
      if (changed && type === 'arc') this._arcSpan = 180;
      if (changed && type === 'sector') this._arcSpan = 90;
      Logger.debug('ShapeTool', `Shape type set to ${type}`);
    } else {
      Logger.warn('ShapeTool', `Unknown shape type: ${type}`);
    }
  }

  /**
   * Get current shape type
   * @returns {string}
   */
  getShapeType() {
    return this.shapeType;
  }

  /**
   * Hover footprint — the nib the stroke will be dilated with. The shape
   * itself is defined by the drag, so before the drag starts the thickness
   * disc is the only footprint there is to show.
   * @param {number} pixelX - X coordinate
   * @param {number} pixelY - Y coordinate
   * @returns {Array<{x: number, y: number}>}
   */
  getFootprint(pixelX, pixelY) {
    return ShapeGenerator.nibFootprint(pixelX, pixelY, this._thickness);
  }

  /**
   * Set filled mode
   * @param {boolean} filled - True for filled shapes
   */
  setFilled(filled) {
    this.filled = Boolean(filled);
    Logger.debug('ShapeTool', `Filled mode set to ${this.filled}`);
  }

  /**
   * Get filled mode
   * @returns {boolean}
   */
  isFilled() {
    return this.filled;
  }

  /**
   * Get filled mode (alias for tool options compatibility)
   * @returns {boolean}
   */
  getFilled() {
    return this.filled;
  }

  /**
   * Get line thickness
   * @returns {number}
   */
  getThickness() {
    return this._thickness;
  }

  /**
   * Set line thickness
   * @param {number} value
   */
  setThickness(value) {
    this._thickness = clamp(parseInt(value, 10) || 1, 1, 8);
  }

  // ── Per-shape parameters (SHAPE_PARAM_ROWS) ────────────────────────────────
  // Clamped to the same range the row declares, because a setter is reachable
  // from more than its slider (session restore, scripts, tests).

  getStarPoints() { return this._starPoints; }
  setStarPoints(v) { this._starPoints = clamp(parseInt(v, 10) || 5, 3, 12); }

  getFlowerPetals() { return this._flowerPetals; }
  setFlowerPetals(v) { this._flowerPetals = clamp(parseInt(v, 10) || 6, 3, 12); }

  getGearTeeth() { return this._gearTeeth; }
  setGearTeeth(v) { this._gearTeeth = clamp(parseInt(v, 10) || 8, 3, 16); }

  getSpiralTurns() { return this._spiralTurns; }
  setSpiralTurns(v) { this._spiralTurns = clamp(parseInt(v, 10) || 3, 1, 8); }

  getRingInner() { return this._ringInner; }
  setRingInner(v) { this._ringInner = clamp(parseInt(v, 10) || 50, 10, 90); }

  getMoonPhase() { return this._moonPhase; }
  setMoonPhase(v) { this._moonPhase = clamp(parseInt(v, 10) || 30, 5, 95); }

  getArcSpan() { return this._arcSpan; }
  setArcSpan(v) { this._arcSpan = clamp(parseInt(v, 10) || 180, 15, 360); }

  /**
   * Deactivate tool
   */
  deactivate() {
    this.startPoint = null;
    this.previewActive = false;
    super.deactivate();
  }
}

// Expose to global scope
window.ShapeTool = ShapeToolClass;

Logger.debug('ShapeTool', 'Shape tool loaded');

})(); // End IIFE
