'use strict';
(function() {

/**
 * Brush Tool
 *
 * Advanced drawing tool using BrushEngine for 7 brush types.
 * Supports pressure sensitivity, flow rate and patterns.
 * Left-click draws with INK, right-click erases.
 *
 * At size 1 every type is the pencil — one pixel under the cursor. See the
 * size-1 invariant in brush-engine.js.
 */
// The full type list — every value setBrushType() accepts, fade included. The
// brush TYPES now live as tool-rail buttons (ToolManager._brushVariants) rather
// than a dropdown, so nothing renders this list whole. It has two readers: the
// `presetOptions` domain of the brushType row (a preset must be able to record
// any live type, and fade is one — leave it out and a fade saved from another
// tool comes back as something else), and the fade delegate's menu, which
// filters fade back out because a fade cannot dissolve itself.
const BRUSH_TYPE_OPTS = Object.freeze([
  { value: 'round',               i18n: 'common.round' },
  { value: 'square',              i18n: 'common.square' },
  { value: 'crosshatch',          i18n: 'bt.crosshatch' },
  { value: 'spray',               i18n: 'common.spray' },
  { value: 'pattern',             i18n: 'common.pattern' },
  { value: 'hatch',               i18n: 'bt.hatch' },
  { value: 'fade',                i18n: 'bt.fade' }
]);

// Hatch angles: the curated pixel-clean set (numeric labels need no
// translation), plus the gestural mode that snaps to it from stroke direction.
const HATCH_ANGLE_OPTS = Object.freeze([
  ...BrushShapes.HATCH_ANGLES.map(h => Object.freeze({ value: h.id, label: `${h.deg}°` })),
  Object.freeze({ value: 'follow', i18n: 'opt.angle.follow' })
]);

// Spray distribution sub-modes: uniform polar scatter (the historical spray)
// and Poisson blue-noise (the former stand-alone stipple brush, folded in).
const DISTRIBUTION_OPTS = Object.freeze([
  { value: 'uniform', i18n: 'opt.dist.uniform' },
  { value: 'poisson', i18n: 'opt.dist.poisson' }
]);

// A nib outline: the whole size x size box, or the disc inside it. Shared by
// the Poisson stipple and the hatch brush.
const NIB_SHAPE_OPTS = Object.freeze([
  { value: 'square', i18n: 'common.square' },
  { value: 'round',  i18n: 'common.round' }
]);

// The base Brush button hosts round and square; the compact selector below
// switches between them (every other type is its own rail button).
const SOLID_BRUSH_OPTS = Object.freeze([
  { value: 'round',  i18n: 'common.round' },
  { value: 'square', i18n: 'common.square' }
]);

/** The two solid types the base Brush button owns. */
const SOLID_BRUSHES = ['round', 'square'];

// The scattering/random brushes: their apply() consumes `flow` (fewer/more
// particles) and they build up on repeat. Every deterministic brush ignores
// both — including hatch, whose tone is thickness/spacing and whose repeat
// stamps are idempotent — so Flow and Build-up are hidden for them. Fade
// counts only when it delegates to a scatter brush.
const FLOW_BRUSHES = ['spray'];
const showIfBrush = (types) => ({ any: [
  { key: 'brushType', in: types },
  { all: [ { key: 'brushType', equals: 'fade' }, { key: 'fadeBrushType', in: types } ] }
] });

const SCATTER_SHOWIF = showIfBrush(FLOW_BRUSHES);
// The spray sub-modes: Distribution follows spray; Weighting is the uniform
// distribution's dial (what the retired Stipple brush used to be), Min spacing
// the Poisson distribution's. Each shows only for spray in its own sub-mode.
const SPRAY_SHOWIF = showIfBrush(['spray']);
/** Every fade control, including the four zone lengths. */
const FADE_SHOWIF = { key: 'brushType', equals: 'fade' };

/**
 * What the fade measures, default first.
 *
 * 'origin' is the straight line back to the click point, so the fade is a
 * radial falloff you can draw back INTO: draw away and the ink thins, draw
 * back and it recovers, circle the anchor and the density holds. That
 * reversibility is why it is the default — a fade you can work into, rather
 * than one spent the moment the hand wanders.
 *
 * 'travel' is path length, which only ever grows: one tapered stroke that dies
 * wherever it happens to run out, whichever way it wandered. See
 * FadeBrush.travelled().
 */
const FADE_MEASURE_OPTS = Object.freeze([
  { value: 'origin', i18n: 'fm.origin' },
  { value: 'travel', i18n: 'fm.travel' }
]);

/** The dither textures a fade can dissolve through (FADE_DITHERS in brush-engine). */
const FADE_DITHER_OPTS = Object.freeze([
  { value: 'ordered4', i18n: 'fd.ordered4' },
  { value: 'ordered8', i18n: 'fd.ordered8' },
  { value: 'halftone', i18n: 'fd.halftone' },
  { value: 'noise',    i18n: 'fd.noise' }
]);
const SPRAY_UNIFORM_SHOWIF = { all: [ SPRAY_SHOWIF, { key: 'distribution', equals: 'uniform' } ] };
const SPRAY_POISSON_SHOWIF = { all: [ SPRAY_SHOWIF, { key: 'distribution', equals: 'poisson' } ] };
// Hatch owns its own dials — angle, and the thickness/spacing tone pair.
const HATCH_SHOWIF = showIfBrush(['hatch']);

class BrushToolClass extends ToolBase {
  /** Declarative options - rendered by OptionControls (contract in tool-base.js). */
  static optionsSchema = [
    // Draw mode moved to the GLOBAL top-bar selector (StateManager) — no
    // longer a per-brush option.
    // Round/Square selector — the base Brush button's only type choice. Every
    // other brush type is a rail button, so this row hides once one is active
    // (its brushType is not solid). All the rows below key off brushType too,
    // and the rail sets it, so they light up for the right variant.
    // `presetOptions` = the values the SETTER accepts, as opposed to the two
    // this row OFFERS. A preset captures whatever type is live, including the
    // rail-button ones and fade, and would otherwise be validated back down to
    // round.
    { type: 'select', key: 'brushType', i18n: 'opt.brushType', value: 'round', options: SOLID_BRUSH_OPTS,
      presetOptions: BRUSH_TYPE_OPTS,
      showIf: { key: 'brushType', in: SOLID_BRUSHES } },
    { type: 'range',  key: 'size',      i18n: 'opt.size',      min: 1, max: 32, value: 1 },
    { type: 'select', key: 'distribution', i18n: 'opt.distribution', value: 'uniform', options: DISTRIBUTION_OPTS,
      showIf: SPRAY_SHOWIF },
    { type: 'range',  key: 'flowRate',  i18n: 'opt.flow',      min: 1, max: 100, value: 100, unit: '%',
      showIf: SCATTER_SHOWIF },
    { type: 'range',  key: 'weighting', i18n: 'opt.weighting', min: -100, max: 100, value: 0,
      showIf: SPRAY_UNIFORM_SHOWIF },
    { type: 'range',  key: 'minDistance', i18n: 'opt.minDistance', min: 1, max: 8, value: 2, unit: 'px',
      showIf: SPRAY_POISSON_SHOWIF },
    { type: 'select', key: 'poissonShape', i18n: 'opt.shape', value: 'square', options: NIB_SHAPE_OPTS,
      showIf: SPRAY_POISSON_SHOWIF },
    { type: 'select', key: 'hatchAngle', i18n: 'opt.angle', value: 'follow', options: HATCH_ANGLE_OPTS,
      showIf: HATCH_SHOWIF },
    { type: 'range',  key: 'hatchSpacing', i18n: 'opt.spacing', min: 2, max: 16, value: 4, unit: 'px',
      showIf: HATCH_SHOWIF },
    { type: 'range',  key: 'hatchThickness', i18n: 'opt.thickness', min: 1, max: 8, value: 1, unit: 'px',
      showIf: HATCH_SHOWIF },
    { type: 'select', key: 'hatchNib', i18n: 'opt.shape', value: 'round', options: NIB_SHAPE_OPTS,
      showIf: HATCH_SHOWIF },
    { type: 'select', key: 'fadeBrushType', i18n: 'opt.fadeBrush', value: 'round',
      options: BRUSH_TYPE_OPTS.filter(o => o.value !== 'fade'),
      showIf: { key: 'brushType', equals: 'fade' } },
    { type: 'range',  key: 'fadeLength', i18n: 'opt.fadeLength', min: 8, max: 256, value: 64, unit: 'px',
      showIf: { key: 'brushType', equals: 'fade' } },
    { type: 'select', key: 'fadeMeasure', i18n: 'opt.fadeMeasure', value: 'origin',
      options: FADE_MEASURE_OPTS, showIf: FADE_SHOWIF },
    { type: 'select', key: 'fadeDither', i18n: 'opt.fadeDither', value: 'ordered4',
      options: FADE_DITHER_OPTS, showIf: FADE_SHOWIF },
    // The four zone lengths. Relative shares of the fade length, not absolute
    // pixels — see FadeBrush.densityAt(). The defaults reproduce the plain
    // linear ramp exactly, so an untouched fade brush is unchanged.
    { type: 'range',  key: 'fadeSolid',   i18n: 'opt.fadeSolid',   min: 0, max: 100, value: 0,  unit: '%',
      showIf: FADE_SHOWIF },
    { type: 'range',  key: 'fadeDense',   i18n: 'opt.fadeDense',   min: 0, max: 100, value: 40, unit: '%',
      showIf: FADE_SHOWIF },
    { type: 'range',  key: 'fadeSparse',  i18n: 'opt.fadeSparse',  min: 0, max: 100, value: 35, unit: '%',
      showIf: FADE_SHOWIF },
    { type: 'range',  key: 'fadeStipple', i18n: 'opt.fadeStipple', min: 0, max: 100, value: 25, unit: '%',
      showIf: FADE_SHOWIF },
    { type: 'range',  key: 'sizeVariation', i18n: 'opt.sizeJitter',    min: 0, max: 100, value: 0, unit: '%' },
    // Jitter spacing only matters while size jitter is active
    { type: 'range',  key: 'variationRate', i18n: 'opt.jitterSpacing', min: 1, max: 50,  value: 10,
      showIf: { key: 'sizeVariation', gt: 0 } },
    { type: 'check',  key: 'continuous',          i18n: 'opt.buildUp',             value: false,
      showIf: SCATTER_SHOWIF },
    { type: 'check',  key: 'pressureSensitivity', i18n: 'opt.pressureSensitivity', value: false }
    // The pattern browser lives in its own 'Patterns' sidebar panel (PatternPanel),
    // shown only while brushType === 'pattern' — no longer an inline slot here.
  ];

  constructor() {
    super(TOOLS.BRUSH, 'Brush');
    this.lastPoint = null;
    this.lastPressure = 1.0;
    this.continuous = false;
    this._continuousInterval = null;
    this._lastIsInk = true;
    this._lastSolid = 'round';
  }

  /**
   * Activate the brush tool
   */
  activate() {
    super.activate();
    if (typeof BrushEngine !== 'undefined' && BrushEngine.initialize) {
      BrushEngine.initialize();
    }
  }

  /**
   * Deactivate the brush tool — stop continuous interval if mid-stroke tool switch
   */
  deactivate() {
    this._stopContinuous();
    super.deactivate();
  }

  /**
   * Handle pointer down - start drawing
   * @param {number} pixelX - X coordinate (0-255)
   * @param {number} pixelY - Y coordinate (0-191)
   * @param {PointerEvent} e - Pointer event
   */
  onPointerDown(pixelX, pixelY, e) {
    this.isDrawing = true;
    this.lastPoint = { x: pixelX, y: pixelY };
    this.lastPressure = e.pressure || 1.0;

    PixelDrawRoutine.beginBatch();
    BrushEngine.startDrawingSession();

    const isInk = e.button !== 2;
    this._lastIsInk = isInk;
    BrushEngine.applyBrush(pixelX, pixelY, this.lastPressure, isInk);

    if (this.continuous) {
      this._startContinuous();
    }
  }

  /**
   * Handle pointer move - continue drawing
   * @param {number} pixelX - X coordinate (0-255)
   * @param {number} pixelY - Y coordinate (0-191)
   * @param {PointerEvent} e - Pointer event
   */
  onPointerMove(pixelX, pixelY, e) {
    if (!this.isDrawing) return;

    const pressure = e.pressure || 1.0;
    const isInk = (e.buttons & 2) === 0;

    if (this.lastPoint) {
      BrushEngine.applyContinuousBrush(
        this.lastPoint.x, this.lastPoint.y,
        pixelX, pixelY,
        pressure, isInk
      );
    }

    this.lastPoint = { x: pixelX, y: pixelY };

    this.lastPressure = pressure;
    this._lastIsInk = isInk;
  }

  /**
   * Handle pointer up - end drawing
   * @param {number} pixelX - X coordinate (0-255)
   * @param {number} pixelY - Y coordinate (0-191)
   * @param {PointerEvent} e - Pointer event
   */
  onPointerUp(pixelX, pixelY, e) {
    this._stopContinuous();
    this.isDrawing = false;
    this.lastPoint = null;

    BrushEngine.endDrawingSession();
    PixelDrawRoutine.endBatch();
  }

  /**
   * Handle pointer leave - cancel drawing
   * @param {PointerEvent} e - Pointer event
   */
  onPointerLeave(e) {
    if (this.isDrawing) {
      this._stopContinuous();
      BrushEngine.endDrawingSession();
      PixelDrawRoutine.endBatch();
    }
    this.isDrawing = false;
    this.lastPoint = null;
  }

  /** Hover footprint — the engine owns the brush geometry. */
  getFootprint(pixelX, pixelY) {
    return BrushEngine.getFootprint(pixelX, pixelY);
  }

  /**
   * Set brush size
   * @param {number} size - Brush size (1-32)
   */
  setSize(size) {
    BrushEngine.setSize(size);
    Logger.debug('BrushTool', `Size set to ${size}`);
  }

  /**
   * Get current brush size
   * @returns {number}
   */
  getSize() {
    return BrushEngine.currentSize;
  }

  /**
   * Bring the size UP to a floor, never down.
   *
   * Picking the spray, the hatch or the pattern brush should hand you that
   * brush rather than a pencil that will behave like one at the size you
   * happened to leave the last brush on (see ToolManager._brushVariants for
   * the measured floors). Raising only: an artist working at 24 px keeps 24.
   *
   * @param {number} size - Smallest size at which this brush is itself
   */
  raiseSizeTo(size) {
    if (BrushEngine.currentSize < size) this.setSize(size);
  }

  getBrushType() {
    return BrushEngine.currentBrush;
  }

  getDrawMode() { return BrushEngine.getDrawMode(); }
  setDrawMode(v) { BrushEngine.setDrawMode(v); }

  /**
   * Set brush type. Remembers the last solid (round/square) so returning to
   * the base Brush button restores it rather than defaulting to round.
   * @param {string} type - Brush type name
   */
  setBrushType(type) {
    BrushEngine.setBrush(type);
    if (SOLID_BRUSHES.includes(BrushEngine.currentBrush)) {
      this._lastSolid = BrushEngine.currentBrush;
    }
  }

  /**
   * Snap to a solid brush (round/square) if a variant type is active — called
   * by ToolManager when the base Brush button is chosen. Idempotent when the
   * current type is already solid.
   */
  ensureSolidBrush() {
    if (!SOLID_BRUSHES.includes(BrushEngine.currentBrush)) {
      this.setBrushType(this._lastSolid || 'round');
    }
  }

  /**
   * Set pressure sensitivity
   * @param {boolean} enabled - True to enable
   */
  setPressureSensitivity(enabled) {
    BrushEngine.setPressureSensitivity(enabled);
  }

  /**
   * Get pressure sensitivity
   * @returns {boolean}
   */
  getPressureSensitivity() {
    return !!BrushEngine.pressureSensitivity;
  }

  /**
   * Set flow rate
   * @param {number} rate - Flow rate (1-100)
   */
  setFlowRate(rate) {
    BrushEngine.setFlowRate(rate);
  }

  /**
   * Get flow rate
   * @returns {number} 1-100
   */
  getFlowRate() {
    return BrushEngine.flowRate;
  }

  /**
   * Set spray weighting: where the particles pile up.
   * @param {number} value - -100 (rim) .. 0 (even) .. +100 (centre)
   */
  setWeighting(value) {
    const brush = BrushEngine.brushes.get('spray');
    if (brush) brush.setWeighting(value);
  }

  /**
   * Get spray weighting
   * @returns {number}
   */
  getWeighting() {
    const brush = BrushEngine.brushes.get('spray');
    return brush ? brush.weighting : 0;
  }

  /**
   * Set spray distribution sub-mode.
   * @param {string} value - 'uniform' | 'poisson'
   */
  setDistribution(value) {
    const brush = BrushEngine.brushes.get('spray');
    if (brush) brush.setDistribution(value);
  }

  /**
   * Get spray distribution sub-mode
   * @returns {string}
   */
  getDistribution() {
    const brush = BrushEngine.brushes.get('spray');
    return brush ? brush.distribution : 'uniform';
  }

  /**
   * Set the Poisson distribution's minimum point spacing.
   * @param {number} value - Minimum spacing in pixels (>= 1)
   */
  setMinDistance(value) {
    const brush = BrushEngine.brushes.get('spray');
    if (brush) brush.setMinDistance(value);
  }

  /**
   * Get the Poisson distribution's minimum point spacing
   * @returns {number}
   */
  getMinDistance() {
    const brush = BrushEngine.brushes.get('spray');
    return brush ? brush.minDistance : 2;
  }

  /**
   * Set the Poisson stipple's shape.
   * @param {string} value - 'square' | 'round'
   */
  setPoissonShape(value) {
    const brush = BrushEngine.brushes.get('spray');
    if (brush) brush.setPoissonShape(value);
  }

  /**
   * Get the Poisson stipple's shape
   * @returns {string}
   */
  getPoissonShape() {
    const brush = BrushEngine.brushes.get('spray');
    return brush ? brush.poissonShape : 'square';
  }

  // ── Hatch ─────────────────────────────────────────────────────────────────

  /** @param {string} value - a BrushShapes.HATCH_ANGLES id, or 'follow' */
  setHatchAngle(value) {
    const brush = BrushEngine.brushes.get('hatch');
    if (brush) brush.setAngle(value);
  }

  /** @returns {string} */
  getHatchAngle() {
    const brush = BrushEngine.brushes.get('hatch');
    return brush ? brush.angle : 'follow';
  }

  /** @param {number} value - distance between hatch line starts */
  setHatchSpacing(value) {
    const brush = BrushEngine.brushes.get('hatch');
    if (brush) brush.setSpacing(value);
  }

  /** @returns {number} */
  getHatchSpacing() {
    const brush = BrushEngine.brushes.get('hatch');
    return brush ? brush.spacing : 4;
  }

  /** @param {number} value - hatch line width (tone = thickness/spacing) */
  setHatchThickness(value) {
    const brush = BrushEngine.brushes.get('hatch');
    if (brush) brush.setThickness(value);
  }

  /** @returns {number} */
  getHatchThickness() {
    const brush = BrushEngine.brushes.get('hatch');
    return brush ? brush.thickness : 1;
  }

  /** @param {string} value - 'round' | 'square' */
  setHatchNib(value) {
    const brush = BrushEngine.brushes.get('hatch');
    if (brush) brush.setNib(value);
  }

  /** @returns {string} */
  getHatchNib() {
    const brush = BrushEngine.brushes.get('hatch');
    return brush ? brush.nib : 'round';
  }

  /**
   * Set fade length (pixels of travel before fully transparent)
   * @param {number} value - Fade length (8-256)
   */
  setFadeLength(value) {
    const brush = BrushEngine.brushes.get('fade');
    if (brush) brush.setFadeLength(value);
  }

  /**
   * Get fade length
   * @returns {number}
   */
  getFadeLength() {
    const brush = BrushEngine.brushes.get('fade');
    return brush ? brush.fadeLength : 64;
  }

  /**
   * The four fade zone lengths. Each is a relative share of the fade length
   * (FadeBrush.densityAt normalizes them), so they never fight one another.
   * @private
   */
  _setFadeZone(index, value) {
    const brush = BrushEngine.brushes.get('fade');
    if (brush) brush.setZoneWeight(index, value);
  }

  /** @private */
  _getFadeZone(index) {
    const brush = BrushEngine.brushes.get('fade');
    return brush ? brush.zoneWeights[index] : 0;
  }

  /**
   * Set what the fade measures its distance from
   * @param {string} mode - 'travel' | 'origin'
   */
  setFadeMeasure(mode) {
    const brush = BrushEngine.brushes.get('fade');
    if (brush) brush.setMeasureFrom(mode);
  }

  /** @returns {string} */
  getFadeMeasure() {
    const brush = BrushEngine.brushes.get('fade');
    return brush ? brush.measureFrom : 'origin';
  }

  /**
   * Set the fade's dither texture
   * @param {string} type - A FADE_DITHERS id
   */
  setFadeDither(type) {
    const brush = BrushEngine.brushes.get('fade');
    if (brush) brush.setDitherType(type);
  }

  /** @returns {string} */
  getFadeDither() {
    const brush = BrushEngine.brushes.get('fade');
    return brush ? brush.ditherType : 'ordered4';
  }

  setFadeSolid(value)   { this._setFadeZone(0, value); }
  getFadeSolid()        { return this._getFadeZone(0); }
  setFadeDense(value)   { this._setFadeZone(1, value); }
  getFadeDense()        { return this._getFadeZone(1); }
  setFadeSparse(value)  { this._setFadeZone(2, value); }
  getFadeSparse()       { return this._getFadeZone(2); }
  setFadeStipple(value) { this._setFadeZone(3, value); }
  getFadeStipple()      { return this._getFadeZone(3); }

  /**
   * Set fade sub-brush type
   * @param {string} type - Brush type name
   */
  setFadeBrushType(type) {
    const brush = BrushEngine.brushes.get('fade');
    if (brush) brush.setFadeBrushType(type);
  }

  /**
   * Get fade sub-brush type
   * @returns {string}
   */
  getFadeBrushType() {
    const brush = BrushEngine.brushes.get('fade');
    return brush ? brush.fadeBrushType : 'round';
  }

  /**
   * Set size variation amount
   * @param {number} value - Variation percentage (0-100)
   */
  setSizeVariation(value) {
    BrushEngine.sizeVariation = clamp(value, 0, 100);
  }

  /**
   * Get size variation amount
   * @returns {number}
   */
  getSizeVariation() {
    return BrushEngine.sizeVariation;
  }

  /**
   * Set variation rate (pixels of movement between size changes)
   * @param {number} value - Distance threshold (1-50)
   */
  setVariationRate(value) {
    BrushEngine.variationChangeThreshold = clamp(value, 1, 50);
  }

  /**
   * Get variation rate
   * @returns {number}
   */
  getVariationRate() {
    return BrushEngine.variationChangeThreshold;
  }

  /**
   * Enable or disable continuous mode (auto-repeat while holding)
   * @param {boolean} enabled - True to enable
   */
  setContinuous(enabled) {
    this.continuous = enabled;
    if (!enabled) {
      this._stopContinuous();
    }
  }

  /**
   * Get continuous mode state
   * @returns {boolean}
   */
  getContinuous() {
    return this.continuous;
  }

  /**
   * Start continuous spray interval
   * @private
   */
  _startContinuous() {
    if (this._continuousInterval) return;
    this._continuousInterval = setInterval(() => {
      if (this.isDrawing && this.lastPoint) {
        BrushEngine.applyBrush(this.lastPoint.x, this.lastPoint.y, this.lastPressure, this._lastIsInk);
      }
    }, 50);
  }

  /**
   * Stop continuous spray interval
   * @private
   */
  _stopContinuous() {
    if (this._continuousInterval) {
      clearInterval(this._continuousInterval);
      this._continuousInterval = null;
    }
  }
}

// Expose to global scope
window.BrushTool = BrushToolClass;

Logger.debug('BrushTool', 'Brush tool loaded with BrushEngine integration');

})(); // End IIFE
