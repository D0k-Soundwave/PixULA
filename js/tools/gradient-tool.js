'use strict';
(function() {

/**
 * Gradient Tool — Two-phase interaction
 *
 * Phase 1: User drags to define the shape/region (shown as outline on canvas).
 * Phase 2: User drags inside that locked shape to define the gradient direction.
 *          The shape outline persists on function-preview-canvas beneath the
 *          gradient preview on composite-preview-canvas.
 *
 * When shapeConstraint (flood fill) is active, phase 1 collapses to a single
 * click that flood-fills the region; phase 2 proceeds normally.
 */
class GradientToolClass extends ToolBase {
  /** Declarative options - rendered by OptionControls (contract in tool-base.js). */
  static optionsSchema = [
    // Shape Fill (flood constraint) defines the region by a click-flood instead
    // of a dragged geometric shape, so this selector does nothing there - hidden.
    { type: 'select', key: 'fillShape', i18n: 'opt.shape', value: 'none',
      showIf: { key: 'shapeConstraint', equals: false }, options: [
      { value: 'none',      i18n: 'common.none' },
      { value: 'circle',    i18n: 'common.circle' },
      { value: 'square',    i18n: 'common.square' },
      { value: 'rectangle', i18n: 'common.rectangle' },
      { value: 'triangle',  i18n: 'common.triangle' }
    ]},
    { type: 'select', key: 'gradientType', i18n: 'opt.type', value: 'linear', options: [
      { value: 'linear',    i18n: 'gt.linear' },
      { value: 'radial',    i18n: 'gt.radial' },
      { value: 'reflected', i18n: 'gt.reflected' },
      { value: 'diamond',   i18n: 'gt.diamond' },
      { value: 'square',    i18n: 'common.square' },
      { value: 'conical',   i18n: 'gt.conical' },
      { value: 'spiral',    i18n: 'gt.spiral' }
    ]},
    // 'drag' is the exact point phase 1 was dragged from - a corner for
    // rectangle/square/none/triangle. Circle is dragged from its centre
    // outward already, so drag and centre coincide there; not hidden for it,
    // since that IS the honest answer for that shape, not a broken control.
    // The eight named positions are the shape's bounding-box edges/corners.
    { type: 'select', key: 'startAnchor', i18n: 'opt.startAnchor', value: 'centre', options: [
      { value: 'centre',       i18n: 'common.centre' },
      { value: 'drag',         i18n: 'sa.drag' },
      { value: 'top',          i18n: 'sa.top' },
      { value: 'bottom',       i18n: 'sa.bottom' },
      { value: 'left',         i18n: 'sa.left' },
      { value: 'right',        i18n: 'sa.right' },
      { value: 'topLeft',      i18n: 'sa.topLeft' },
      { value: 'topRight',     i18n: 'sa.topRight' },
      { value: 'bottomLeft',   i18n: 'sa.bottomLeft' },
      { value: 'bottomRight',  i18n: 'sa.bottomRight' }
    ]},
    // Wrap/repeat/mirror and the gamma curve below both act on the RAW
    // position 'reflected' never produces (it is its own fixed one-time
    // mirror, not a cyclic shape - see _getGradientPosition) - hidden there
    // since they would be dead controls.
    { type: 'select', key: 'wrapMode', i18n: 'opt.wrapMode', value: 'clamp',
      showIf: { key: 'gradientType', notIn: ['reflected'] }, options: [
      { value: 'clamp',  i18n: 'wm.clamp' },
      { value: 'repeat', i18n: 'wm.repeat' },
      { value: 'mirror', i18n: 'wm.mirror' }
    ]},
    // 0 is a real, meaningful value here (see _applyWrap) - a flat, position-
    // independent dithered texture wash, not a degenerate placeholder.
    { type: 'range', key: 'repeatCount', i18n: 'opt.repeatCount', min: 0, max: 8, value: 1,
      showIf: { all: [{ key: 'gradientType', notIn: ['reflected'] }, { key: 'wrapMode', notIn: ['clamp'] }] } },
    { type: 'range', key: 'gammaCurve', i18n: 'opt.gammaCurve', min: 0.25, max: 4, value: 1, step: 0.05,
      showIf: { key: 'gradientType', notIn: ['reflected'] } },
    { type: 'range', key: 'bias', i18n: 'opt.bias', min: -50, max: 50, value: 0 },
    { type: 'range', key: 'gradientSteps', i18n: 'opt.steps', min: 1, max: 16, value: 1 },
    // Dither grain is the Bayer matrix size; only used while Dithered is on
    // (off = a single hard threshold), so hide it when Dithered is off.
    { type: 'select', key: 'ditherScale', i18n: 'opt.ditherGrain', value: 8,
      showIf: { key: 'dithered', equals: true }, options: [
      { value: 2, i18n: 'dg.coarse' },
      { value: 4, i18n: 'dg.medium' },
      { value: 8, i18n: 'dg.fine' }
    ]},
    { type: 'check', key: 'dithered',        i18n: 'opt.dithered',  value: true },
    { type: 'check', key: 'shapeConstraint', i18n: 'opt.shapeFill', value: false },
    { type: 'check', key: 'lockAxis',        i18n: 'opt.lockAxis', value: false }
  ];

  constructor() {
    super(TOOLS.GRADIENT, 'Gradient');
    this.cursor = 'crosshair';
    this.isDrawing = false;
    this.isReverseMode = false;
    // Default ON to match the options schema; toggling it OFF switches
    // _shouldBeInk to a hard 50% threshold (crisp banded gradient).
    this._dithered = true;

    // Gradient type: 'linear', 'radial', 'reflected', 'diamond', 'conical', 'square', 'spiral'
    this.gradientType = 'linear';

    // Quantise gradient into N discrete density levels (1 = smooth continuous)
    this.gradientSteps = 1;

    // Size of Bayer dither matrix tile: 2, 4, or 8
    this.ditherScale = 8;

    // Bayer dither matrices normalised to 0-63, keyed by matrix size
    this.ditherPatterns = this._createDitherPatterns();
    // Cached reference to the active matrix — avoids object lookup in hot pixel loop
    this._activeDitherMatrix = this.ditherPatterns[8];

    // Pre-allocated Sets for preview — cleared and reused each frame to avoid GC pressure
    this._previewCellSet = new Set();
    this._previewInkSet  = new Set();
    this._previewPaprSet = new Set();

    // Shape fill: constrain gradient to flood-filled region from start point
    this._shapeConstraint = false;
    // Cached flood-fill region (Set of encoded pixel keys)
    this._cachedFloodRegion = null;

    // Geometric fill shape: 'none' | 'circle' | 'square' | 'rectangle' | 'triangle'
    this._fillShape = 'none';

    // Midpoint bias: shifts the ink/paper threshold in _shouldBeInk without
    // moving the axis. -50..50, 0 = no shift (the original 50% split).
    this._bias = 0;

    // Ease/gamma curve applied to the gradient position before step
    // quantization. 1 = linear (no-op, byte-identical to pre-gamma output).
    this._gammaCurve = 1;

    // Wrap stage: 'clamp' (default, matches original per-type clamping) |
    // 'repeat' | 'mirror'. repeatCount only matters when wrapMode != 'clamp'.
    this._wrapMode = 'clamp';
    this.repeatCount = 1;

    // Lock axis: reuse the last committed axis' angle/ratio (relative to its
    // shape's half-diagonal) as the phase-2 starting point for the NEXT
    // shape, scaled to that shape's own bounds. null until a gradient has
    // been committed with lockAxis on.
    this._lockAxis = false;
    this._lockedAxisSnapshot = null;   // { angle, ratio }

    // Where the axis starts, on the shape's bounding box: 'centre' (default),
    // 'drag' (the exact point phase 1 was dragged from - a corner for
    // rectangle/square/none/triangle, the same point as centre for circle
    // since that shape is already dragged from its centre outward), or one
    // of the eight named edge/corner positions (see _anchorPoint).
    this._startAnchor = 'centre';

    // ── Two-phase state ─────────────────────────────────────────────────────
    // Phase 1 — drag to define the shape/region bounding box
    // Phase 2 — drag inside the shape to define gradient direction/origin
    this._phase = 'shape';          // 'shape' | 'gradient'
    this._shapeStartPoint = null;   // anchor corner / circle center / triangle base
    this._shapeEndPoint   = null;   // live end of the shape drag
    this._shapeBounds     = null;   // locked bounding rect, set after phase 1 completes

    // Gradient axis — set during phase 2
    this.startPoint = null;
    this.endPoint   = null;

    // Coalesces phase-2 preview updates to one per animation frame. A pen or
    // a fast mouse can fire many pointermove events between two paints, and
    // _updatePreview's compositor simulation is not cheap enough to redo per
    // event — this pending handle makes a burst of moves collapse into the
    // single call the next frame actually needs.
    this._previewRAF = null;

    // Any option change (gradient type, wrap mode, start point, bias, gamma,
    // steps, dithered...) reshapes the preview without moving the pointer -
    // nothing else would trigger a redraw, so it would sit stale until the
    // next mouse move. Mirrors bezier-tool's CANVAS_ZOOM listener: only the
    // active tool, only mid-gesture (phase 2 - no locked shape yet in phase 1
    // means nothing to refresh).
    EventBus.on(EVENTS.TOOL_OPTIONS, () => {
      if (!window.ToolManager || ToolManager.getCurrentTool() !== this) return;
      if (this._phase !== 'gradient' || !this._shapeBounds) return;
      // startAnchor may be what changed - startPoint is fixed at phase-2
      // entry, so re-derive it from the locked bounds rather than leaving it
      // stale until the next shape.
      this.startPoint = this._anchorPoint(this._shapeBounds);
      this._scheduleUpdatePreview();
    });
  }

  _createDitherPatterns() {
    return {
      2: [
        [ 0, 32],
        [48, 16]
      ],
      4: [
        [ 0, 32,  8, 40],
        [48, 16, 56, 24],
        [12, 44,  4, 36],
        [60, 28, 52, 20]
      ],
      8: [
        [ 0, 32,  8, 40,  2, 34, 10, 42],
        [48, 16, 56, 24, 50, 18, 58, 26],
        [12, 44,  4, 36, 14, 46,  6, 38],
        [60, 28, 52, 20, 62, 30, 54, 22],
        [ 3, 35, 11, 43,  1, 33,  9, 41],
        [51, 19, 59, 27, 49, 17, 57, 25],
        [15, 47,  7, 39, 13, 45,  5, 37],
        [63, 31, 55, 23, 61, 29, 53, 21]
      ]
    };
  }

  // ── Setters / getters ──────────────────────────────────────────────────────

  setGradientType(type) {
    const valid = ['linear', 'radial', 'reflected', 'diamond', 'conical', 'square', 'spiral'];
    if (valid.includes(type)) this.gradientType = type;
  }
  getGradientType() { return this.gradientType; }

  getShapeConstraint() { return this._shapeConstraint; }
  setShapeConstraint(v) { this._shapeConstraint = Boolean(v); }

  getFillShape() { return this._fillShape; }
  setFillShape(v) {
    const valid = ['none', 'circle', 'square', 'rectangle', 'triangle'];
    if (valid.includes(v)) this._fillShape = v;
  }

  getDithered() { return this._dithered !== false; }
  setDithered(value) { this._dithered = Boolean(value); }

  getGradientSteps() { return this.gradientSteps; }
  setGradientSteps(v) { this.gradientSteps = clamp(parseInt(v) || 1, 1, 16); }

  getDitherScale() { return this.ditherScale; }
  setDitherScale(v) {
    const n = parseInt(v);
    if (n === 2 || n === 4 || n === 8) {
      this.ditherScale = n;
      this._activeDitherMatrix = this.ditherPatterns[n];
    }
  }

  getBias() { return this._bias; }
  setBias(v) { this._bias = clamp(parseInt(v, 10) || 0, -50, 50); }

  getGammaCurve() { return this._gammaCurve; }
  setGammaCurve(v) {
    const n = parseFloat(v);
    this._gammaCurve = Number.isFinite(n) ? clamp(n, 0.25, 4) : 1;
  }

  getWrapMode() { return this._wrapMode; }
  setWrapMode(v) {
    const valid = ['clamp', 'repeat', 'mirror'];
    if (valid.includes(v)) this._wrapMode = v;
  }

  getRepeatCount() { return this.repeatCount; }
  setRepeatCount(v) {
    // 0 is a real, meaningful value (the flat-texture special case in
    // _applyWrap) - parseInt(v)||1 would silently coerce it back to 1.
    const n = parseInt(v, 10);
    this.repeatCount = clamp(Number.isFinite(n) ? n : 1, 0, 8);
  }

  getLockAxis() { return this._lockAxis; }
  setLockAxis(v) {
    this._lockAxis = Boolean(v);
    if (!this._lockAxis) this._lockedAxisSnapshot = null;
  }

  getStartAnchor() { return this._startAnchor; }
  setStartAnchor(v) {
    const valid = ['centre', 'drag', 'top', 'bottom', 'left', 'right',
      'topLeft', 'topRight', 'bottomLeft', 'bottomRight'];
    if (valid.includes(v)) this._startAnchor = v;
  }

  // ── Tool deactivation ──────────────────────────────────────────────────────

  deactivate() {
    super.deactivate();   // calls clearPreview() -> clears both canvas layers
    this._resetAll();
  }

  // ── Pointer event handlers ─────────────────────────────────────────────────

  onPointerDown(pixelX, pixelY, e) {
    if (this._phase === 'shape') {
      this.isDrawing = true;
      this._shapeStartPoint = { x: pixelX, y: pixelY };
      this._shapeEndPoint   = { x: pixelX, y: pixelY };
      this.isReverseMode = false;

      if (this._shapeConstraint) {
        this._cachedFloodRegion = this._getFloodFillRegion(pixelX, pixelY);
        const bounds = this._getFloodRegionBounds();
        if (bounds.width >= 1) {
          this._shapeBounds = bounds;
          this._phase = 'gradient';
          this.isDrawing = false;
          this._enterGradientPhase(bounds, pixelX, pixelY);
          this._updateShapePreview();
          this._updatePreview();
        }
      }
    } else {
      // Phase 2: show reversed/normal preview while button held; commit on pointer-up
      this.isReverseMode = e.button === 2;
      this.endPoint = this._snapEndPoint(pixelX, pixelY, e);
      this._updatePreview();
    }
  }

  onPointerMove(pixelX, pixelY, e) {
    if (this._phase === 'shape') {
      if (!this.isDrawing) return;
      this._shapeEndPoint = { x: pixelX, y: pixelY };
      this._updateShapePreview();
    } else {
      // Phase 2 drag (button held) — same as hover. Coalesced to one
      // _updatePreview per frame; see _scheduleUpdatePreview.
      this.endPoint = this._snapEndPoint(pixelX, pixelY, e);
      this._scheduleUpdatePreview();
    }
  }

  onPointerUp(pixelX, pixelY, e) {
    if (this._phase === 'shape') {
      if (!this.isDrawing) return;
      this.isDrawing = false;
      this._shapeEndPoint = { x: pixelX, y: pixelY };
      const bounds = this._computeShapeBounds();
      if (!bounds || (bounds.width < 2 && bounds.height < 2)) {
        this.clearPreview();
        this._resetAll();
        return;
      }
      this._shapeBounds = bounds;
      this._phase = 'gradient';
      this._enterGradientPhase(bounds, pixelX, pixelY);
      this._updateShapePreview();
      this._updatePreview();
    } else {
      // Phase 2: commit gradient; button at release determines reverse
      this.endPoint = this._snapEndPoint(pixelX, pixelY, e);
      const rect    = this._shapeBounds;
      const reverse = e.button === 2;
      this.clearPreview();
      if (rect && rect.width >= 1 && this.startPoint && this.endPoint) {
        this._captureAxisSnapshot(rect);
        this._drawGradient(rect, reverse);
      }
      this._resetAll();
    }
  }

  onPointerLeave(e) {
    if (this._phase === 'shape' && this.isDrawing) {
      this.isDrawing = false;
      this.clearPreview();
      this._resetAll();
    }
    // Phase 2: preview stays frozen when mouse leaves; resumes on re-entry
  }

  onPointerHover(pixelX, pixelY, e) {
    if (this._phase !== 'gradient') return;
    this.endPoint = this._snapEndPoint(pixelX, pixelY, e);
    this._scheduleUpdatePreview();
  }

  // Shift held during phase 2 snaps the axis (startPoint -> pointer) to the
  // nearest 15deg increment, preserving distance from startPoint. No Shift:
  // passes the raw pointer position through unchanged.
  _snapEndPoint(pixelX, pixelY, e) {
    if (!e || !e.shiftKey || !this.startPoint) return { x: pixelX, y: pixelY };
    const sx = this.startPoint.x, sy = this.startPoint.y;
    const dx = pixelX - sx, dy = pixelY - sy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist === 0) return { x: pixelX, y: pixelY };
    const stepRad = 15 * Math.PI / 180;
    const snappedAngle = Math.round(Math.atan2(dy, dx) / stepRad) * stepRad;
    return {
      x: Math.round(sx + dist * Math.cos(snappedAngle)),
      y: Math.round(sy + dist * Math.sin(snappedAngle))
    };
  }

  /**
   * No hover footprint: the gradient has no nib (it fills a dragged region),
   * and in phase 2 it owns the function-preview canvas via onPointerHover
   * above — a footprint drawn there would clear the live gradient preview.
   * @returns {null}
   */
  getFootprint() {
    return null;
  }

  // ── State helpers ──────────────────────────────────────────────────────────

  _resetAll() {
    this._cancelScheduledPreview();
    this._phase           = 'shape';
    this._shapeStartPoint = null;
    this._shapeEndPoint   = null;
    this._shapeBounds     = null;
    this.startPoint       = null;
    this.endPoint         = null;
    this.isReverseMode    = false;
    this.isDrawing        = false;
    this._cachedFloodRegion = null;
  }

  // Runs _updatePreview at most once per animation frame no matter how many
  // pointer events arrive in between — a burst of pointermove/hover events
  // between two paints would otherwise redo the same expensive compositor
  // simulation for nothing, since only the last position before a repaint is
  // ever seen.
  _scheduleUpdatePreview() {
    if (this._previewRAF !== null) return;
    const raf = (typeof window !== 'undefined' && window.requestAnimationFrame)
      ? window.requestAnimationFrame.bind(window)
      : (cb) => setTimeout(cb, 16);
    this._previewRAF = raf(() => {
      this._previewRAF = null;
      this._updatePreview();
    });
  }

  _cancelScheduledPreview() {
    if (this._previewRAF === null) return;
    if (typeof window !== 'undefined' && window.cancelAnimationFrame) {
      window.cancelAnimationFrame(this._previewRAF);
    } else {
      clearTimeout(this._previewRAF);
    }
    this._previewRAF = null;
  }

  // Set up startPoint/endPoint when entering phase 2. startPoint comes from
  // _anchorPoint (centre, the phase-1 drag point, or a named edge/corner).
  // endPoint is the current cursor position UNLESS lockAxis is on and a
  // prior commit left a snapshot, in which case it is pre-filled from that
  // snapshot's angle/ratio scaled to this shape's own reach (_axisReach) —
  // still just a starting point, since the artist can drag (or click away)
  // to override it like any other preview.
  _enterGradientPhase(bounds, cursorX, cursorY) {
    const { x: cx, y: cy } = this._anchorPoint(bounds);
    this.startPoint = { x: cx, y: cy };

    if (this._lockAxis && this._lockedAxisSnapshot) {
      const { angle, ratio } = this._lockedAxisSnapshot;
      const dist = ratio * this._axisReach(bounds);
      this.endPoint = {
        x: Math.round(cx + dist * Math.cos(angle)),
        y: Math.round(cy + dist * Math.sin(angle))
      };
    } else {
      this.endPoint = { x: cursorX, y: cursorY };
    }
  }

  // Where the axis starts on the shape's bounding box, per startAnchor.
  // 'drag' falls back to the bounding-box centre if _shapeStartPoint is
  // somehow unset (defensive - it is always set at the top of onPointerDown
  // before this can run). The four named corners and edges are plain
  // bounding-box arithmetic; circle/triangle/flood-fill shapes all still use
  // their own bounding box here, same as every other reference in this file.
  _anchorPoint(bounds) {
    const cxMid = Math.round(bounds.x + (bounds.width  - 1) / 2);
    const cyMid = Math.round(bounds.y + (bounds.height - 1) / 2);
    const x1 = bounds.x, y1 = bounds.y;
    const x2 = bounds.x + bounds.width  - 1;
    const y2 = bounds.y + bounds.height - 1;

    switch (this._startAnchor) {
      case 'drag':         return this._shapeStartPoint ? { ...this._shapeStartPoint } : { x: cxMid, y: cyMid };
      case 'top':          return { x: cxMid, y: y1 };
      case 'bottom':       return { x: cxMid, y: y2 };
      case 'left':         return { x: x1, y: cyMid };
      case 'right':        return { x: x2, y: cyMid };
      case 'topLeft':      return { x: x1, y: y1 };
      case 'topRight':     return { x: x2, y: y1 };
      case 'bottomLeft':   return { x: x1, y: y2 };
      case 'bottomRight':  return { x: x2, y: y2 };
      default:              return { x: cxMid, y: cyMid };   // 'centre'
    }
  }

  // How far a shape's axis can reasonably reach from its start point, used
  // to scale a locked axis onto a differently-sized shape - the distance to
  // the FARTHEST point the anchor could reasonably point at. Centre: any
  // corner, half-diagonal. A cardinal edge (top/bottom/left/right): the
  // opposite far corner, using the HALF dimension the anchor is already
  // centred on and the FULL dimension it sits at the edge of. A corner or
  // the drag point: the opposite corner, full diagonal. Using the wrong one
  // would make a locked axis overshoot or undershoot on the next,
  // differently-sized shape.
  _axisReach(bounds) {
    switch (this._startAnchor) {
      case 'centre':
        return Math.hypot(bounds.width / 2, bounds.height / 2);
      case 'top': case 'bottom':
        return Math.hypot(bounds.width / 2, bounds.height);
      case 'left': case 'right':
        return Math.hypot(bounds.width, bounds.height / 2);
      default:   // 'drag' and the four corners
        return Math.hypot(bounds.width, bounds.height);
    }
  }

  // Snapshot the just-committed axis (angle + distance-as-a-fraction-of-the-
  // shape's-reach, see _axisReach) for lockAxis to replay on the next shape.
  // Skipped when the axis has zero length or the shape is a single point -
  // nothing meaningful to lock onto, and dividing by a zero reach would
  // produce NaN. Leaves any existing snapshot in place in that case.
  _captureAxisSnapshot(bounds) {
    if (!this._lockAxis || !this.startPoint || !this.endPoint) return;
    const dx = this.endPoint.x - this.startPoint.x, dy = this.endPoint.y - this.startPoint.y;
    const dist = Math.hypot(dx, dy);
    const reach = this._axisReach(bounds);
    if (dist === 0 || reach === 0) return;
    this._lockedAxisSnapshot = { angle: Math.atan2(dy, dx), ratio: dist / reach };
  }

  // Compute the shape bounding rect from _shapeStartPoint/_shapeEndPoint.
  _computeShapeBounds() {
    if (!this._shapeStartPoint || !this._shapeEndPoint) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }

    if (this._shapeConstraint && this._cachedFloodRegion) {
      return this._getFloodRegionBounds();
    }

    const sp = this._shapeStartPoint, ep = this._shapeEndPoint;

    if (this._fillShape === 'circle') {
      const r = Math.max(Math.abs(ep.x - sp.x), Math.abs(ep.y - sp.y));
      const x1 = Math.max(0, sp.x - r), y1 = Math.max(0, sp.y - r);
      const x2 = Math.min(ZX_SPECTRUM.WIDTH - 1, sp.x + r);
      const y2 = Math.min(ZX_SPECTRUM.HEIGHT - 1, sp.y + r);
      return { x: x1, y: y1, width: x2 - x1 + 1, height: y2 - y1 + 1 };
    }

    if (this._fillShape === 'triangle') {
      const ddx = ep.x - sp.x, ddy = ep.y - sp.y;
      const r = Math.sqrt(ddx * ddx + ddy * ddy);
      if (r === 0) return { x: sp.x, y: sp.y, width: 1, height: 1 };
      const baseWidth = r * Math.tan(Math.PI / 6);
      const perpAngle = Math.atan2(ddy, ddx) + Math.PI / 2;
      const bx = baseWidth * Math.cos(perpAngle), by = baseWidth * Math.sin(perpAngle);
      const xs = [ep.x, sp.x + bx, sp.x - bx];
      const ys = [ep.y, sp.y + by, sp.y - by];
      const x1 = clamp(Math.floor(Math.min(...xs)), 0, ZX_SPECTRUM.WIDTH - 1);
      const y1 = clamp(Math.floor(Math.min(...ys)), 0, ZX_SPECTRUM.HEIGHT - 1);
      const x2 = clamp(Math.ceil(Math.max(...xs)), 0, ZX_SPECTRUM.WIDTH - 1);
      const y2 = clamp(Math.ceil(Math.max(...ys)), 0, ZX_SPECTRUM.HEIGHT - 1);
      return { x: x1, y: y1, width: x2 - x1 + 1, height: y2 - y1 + 1 };
    }

    if (this._fillShape === 'square') {
      const dx = ep.x - sp.x, dy = ep.y - sp.y;
      const side = Math.min(Math.abs(dx), Math.abs(dy));
      const ex = sp.x + (dx >= 0 ? side : -side);
      const ey = sp.y + (dy >= 0 ? side : -side);
      const x1 = clamp(Math.min(sp.x, ex), 0, ZX_SPECTRUM.WIDTH - 1);
      const y1 = clamp(Math.min(sp.y, ey), 0, ZX_SPECTRUM.HEIGHT - 1);
      const x2 = clamp(Math.max(sp.x, ex), 0, ZX_SPECTRUM.WIDTH - 1);
      const y2 = clamp(Math.max(sp.y, ey), 0, ZX_SPECTRUM.HEIGHT - 1);
      return { x: x1, y: y1, width: x2 - x1 + 1, height: y2 - y1 + 1 };
    }

    // rectangle / none: corner-to-corner bounding box
    const x1 = clamp(Math.min(sp.x, ep.x), 0, ZX_SPECTRUM.WIDTH - 1);
    const y1 = clamp(Math.min(sp.y, ep.y), 0, ZX_SPECTRUM.HEIGHT - 1);
    const x2 = clamp(Math.max(sp.x, ep.x), 0, ZX_SPECTRUM.WIDTH - 1);
    const y2 = clamp(Math.max(sp.y, ep.y), 0, ZX_SPECTRUM.HEIGHT - 1);
    return { x: x1, y: y1, width: x2 - x1 + 1, height: y2 - y1 + 1 };
  }

  _getFloodRegionBounds() {
    const region = this._cachedFloodRegion;
    if (!region || region.size === 0) return { x: 0, y: 0, width: 0, height: 0 };
    let minX = ZX_SPECTRUM.WIDTH, maxX = 0, minY = ZX_SPECTRUM.HEIGHT, maxY = 0;
    for (const key of region) {
      const x = key & 0xFFFF, y = key >> 16;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
  }

  // ── Drawing ────────────────────────────────────────────────────────────────

  // Additive: the gradient only ADDS ink where its density function calls
  // for it. A position the function does not reach is left completely
  // untouched - no pixel clear, no attribute stamp - so drawing a gradient
  // over existing artwork shades it instead of replacing it. Before this,
  // every "paper" position in the rect/shape ran through resolveUserMode's
  // erase branch (NORMAL_ERASE under the default draw mode), which cleared
  // the pixel AND re-stamped the cell's ink/paper/bright/flash - wiping out
  // whatever was underneath the non-ink half of the gradient.
  _drawGradient(rect, reverse) {
    if (rect.width < 1 || rect.height < 1) return;

    const color = ColorManager.getCurrentSelection();
    const skipInk   = color.inkTransparent;
    const region    = this._cachedFloodRegion;
    const encodeKey = region ? (x, y) => (y << 16) | x : null;
    const checkShape = !this._shapeConstraint && this._fillShape !== 'none';

    PixelDrawRoutine.beginBatch();

    for (let y = 0; y < rect.height; y++) {
      for (let x = 0; x < rect.width; x++) {
        const pixelX = rect.x + x;
        const pixelY = rect.y + y;

        if (region && !region.has(encodeKey(pixelX, pixelY))) continue;
        if (checkShape && !this._isInsideShape(pixelX, pixelY, rect)) continue;

        let gradientPos = this._getGradientPosition(pixelX, pixelY);
        if (this.gradientSteps > 1) {
          gradientPos = Math.floor(gradientPos * this.gradientSteps) / this.gradientSteps;
        }
        if (reverse) gradientPos = 1 - gradientPos;

        if (!this._shouldBeInk(pixelX, pixelY, gradientPos) || skipInk) continue;
        PixelDrawRoutine.draw(pixelX, pixelY, color, PixelDrawRoutine.resolveUserMode(true));
      }
    }

    PixelDrawRoutine.endBatch();
  }

  // Gradient position (0-1) based on the gradient axis (startPoint -> endPoint).
  // Each type computes a RAW value first - unclamped for the monotonic types
  // (linear/radial/diamond/square: can run past 1 beyond the axis/radius),
  // already-cyclic for conical/spiral (0-1 via their own modulo). That raw
  // value passes through the shared wrap stage (_applyWrap: clamp/repeat/
  // mirror, the wrapMode/repeatCount options) and then gamma
  // (this._gammaCurve, an ease curve on the 0-1 result) before the caller
  // quantizes it into steps. With the defaults (wrapMode 'clamp', gamma 1)
  // this reproduces the exact pre-refactor output for every type.
  // 'reflected' is excluded — it is its own fixed one-time mirror on the raw
  // linear ratio, not a cyclic shape, so wrap/gamma don't apply to it.
  _getGradientPosition(pixelX, pixelY) {
    const sx = this.startPoint.x, sy = this.startPoint.y;
    const dx = this.endPoint.x - sx, dy = this.endPoint.y - sy;
    const lenSq = dx * dx + dy * dy;
    let raw;

    switch (this.gradientType) {
      case 'linear': {
        if (lenSq === 0) return 0.5;
        const px = pixelX - sx, py = pixelY - sy;
        raw = (px * dx + py * dy) / lenSq;
        break;
      }
      case 'reflected': {
        if (lenSq === 0) return 0.5;
        const px = pixelX - sx, py = pixelY - sy;
        const t = clamp((px * dx + py * dy) / lenSq, 0, 1);
        return 1 - Math.abs(2 * t - 1);
      }
      case 'radial': {
        const r = Math.sqrt(lenSq);
        if (r === 0) return 0.5;
        const px = pixelX - sx, py = pixelY - sy;
        raw = Math.sqrt(px * px + py * py) / r;
        break;
      }
      case 'diamond': {
        const r = Math.sqrt(lenSq);
        if (r === 0) return 0.5;
        raw = (Math.abs(pixelX - sx) + Math.abs(pixelY - sy)) / r;
        break;
      }
      case 'square': {
        const r = Math.sqrt(lenSq);
        if (r === 0) return 0.5;
        raw = Math.max(Math.abs(pixelX - sx), Math.abs(pixelY - sy)) / r;
        break;
      }
      case 'conical': {
        if (lenSq === 0) return 0.5;
        const refAngle   = Math.atan2(dy, dx);
        const pixelAngle = Math.atan2(pixelY - sy, pixelX - sx);
        raw = ((pixelAngle - refAngle) / (2 * Math.PI) + 1) % 1;
        break;
      }
      case 'spiral': {
        const r = Math.sqrt(lenSq);
        if (r === 0) return 0.5;
        const radialPos  = Math.min(1, Math.sqrt((pixelX - sx) ** 2 + (pixelY - sy) ** 2) / r);
        const refAngle   = Math.atan2(dy, dx);
        const angularPos = ((Math.atan2(pixelY - sy, pixelX - sx) - refAngle) / (2 * Math.PI) + 1) % 1;
        raw = (radialPos + angularPos) % 1;
        break;
      }
      default:
        return 0.5;
    }

    const wrapped = this._applyWrap(raw);
    return this._gammaCurve === 1 ? wrapped : Math.pow(wrapped, this._gammaCurve);
  }

  // Shared wrap stage for every gradient type except 'reflected' (see above).
  // 'clamp' (default) reproduces the original per-type Math.min(1,...)/clamp
  // behaviour exactly. 'repeat'/'mirror' multiply raw by repeatCount first,
  // so a repeatCount of N gives N stripes (linear), rings (radial/diamond/
  // square) or wedges (conical/spiral) instead of one clamped pass.
  _applyWrap(raw) {
    if (this._wrapMode === 'clamp' || !this._wrapMode) return clamp(raw, 0, 1);

    const n = clamp(Math.round(this.repeatCount), 0, 8);
    // 0 repeats: raw*0 would collapse to a constant 0 (all-paper, invisible)
    // rather than a genuine texture. Special-cased to the midpoint instead -
    // an intentional "ignore the gradient direction, show only the dither
    // pattern" flat-wash mode, not a degenerate edge case.
    if (n === 0) return 0.5;
    const scaled = raw * n;

    if (this._wrapMode === 'mirror') {
      let t = scaled % 2;
      if (t < 0) t += 2;
      return t <= 1 ? t : 2 - t;
    }

    // 'repeat': sawtooth via positive modulo.
    let t = scaled % 1;
    if (t < 0) t += 1;
    return t;
  }

  _shouldBeInk(pixelX, pixelY, gradientPos) {
    const value = Math.min(63, Math.floor(gradientPos * 64));
    // Bias shifts the split point on the same 0-63 scale as value/threshold;
    // 0 = no shift, so the default reproduces the original fixed 31 exactly.
    // Positive bias LOWERS the threshold (more values pass) -> more ink.
    const offset = this._bias ? Math.round((this._bias / 100) * 63) : 0;
    // Dithered OFF: a single hard threshold at the midpoint — no Bayer matrix,
    // so ditherScale/grain has no bearing and the gradient reads as solid bands.
    if (this._dithered === false) return value > clamp(31 - offset, 0, 63);
    const size      = this.ditherScale;
    const threshold = clamp(this._activeDitherMatrix[pixelY % size][pixelX % size] - offset, 0, 63);
    return value > threshold;
  }

  // ── Preview ────────────────────────────────────────────────────────────────

  // Phase 1: show shape outline on function-preview-canvas (z-index 100).
  // This canvas is NOT cleared by _updatePreview, so the outline persists
  // beneath the gradient preview during phase 2.
  _updateShapePreview() {
    if (!window.GridOverlay) return;
    const rect = this._computeShapeBounds();
    if (!rect || rect.width < 1 || rect.height < 1) {
      GridOverlay.clearFunctionPreview();
      return;
    }
    const pixels = this._getShapeBorderPixels(rect);
    GridOverlay.drawPreviewPixels(pixels, 'rgba(255, 255, 255, 0.9)');
  }

  // Phase 2: show gradient preview on composite-preview-canvas (z-index 150).
  // Deliberately does NOT call clearFunctionPreview so the shape outline persists.
  _updatePreview() {
    if (!window.GridOverlay) return;

    const rect = this._shapeBounds;
    if (!rect || rect.width < 1 || rect.height < 1) {
      GridOverlay.clearCompositePreview();
      return;
    }

    const affectedCells   = this._previewCellSet;
    const gradientInkSet  = this._previewInkSet;
    const gradientPaprSet = this._previewPaprSet;
    affectedCells.clear();
    gradientInkSet.clear();
    gradientPaprSet.clear();

    const colorSelection = ColorManager.getCurrentSelection();
    const skipInk        = colorSelection.inkTransparent;
    const region         = this._cachedFloodRegion;
    const encodeKey      = region ? (x, y) => (y << 16) | x : null;
    const checkShape     = !this._shapeConstraint && this._fillShape !== 'none';

    // Additive preview, mirroring _drawGradient: only the pixels the gradient
    // will actually ADD show as pending ink. gradientPaprSet stays empty -
    // the gradient never clears a pixel, so nothing previews as erased.
    for (let y = 0; y < rect.height; y++) {
      for (let x = 0; x < rect.width; x++) {
        const pixelX = rect.x + x;
        const pixelY = rect.y + y;

        if (region && !region.has(encodeKey(pixelX, pixelY))) continue;
        if (checkShape && !this._isInsideShape(pixelX, pixelY, rect)) continue;

        let gradientPos = this._getGradientPosition(pixelX, pixelY);
        if (this.gradientSteps > 1) {
          gradientPos = Math.floor(gradientPos * this.gradientSteps) / this.gradientSteps;
        }
        if (this.isReverseMode) gradientPos = 1 - gradientPos;

        if (!this._shouldBeInk(pixelX, pixelY, gradientPos) || skipInk) continue;

        affectedCells.add(Math.floor(pixelX / ZX_SPECTRUM.CELL_WIDTH) + ',' + Math.floor(pixelY / ZX_SPECTRUM.CELL_HEIGHT));
        gradientInkSet.add(pixelX + ',' + pixelY);
      }
    }

    GridOverlay.drawGradientCellPreview(
      affectedCells, gradientInkSet, gradientPaprSet,
      colorSelection, LayerManager.activeDrawLayerIndex
    );
  }

  // 1-pixel border pixels for the current shape, clamped to canvas bounds.
  _getShapeBorderPixels(rect) {
    const pixels = [];

    switch (this._fillShape) {
      case 'circle': {
        const r = Math.max(
          Math.abs(this._shapeEndPoint.x - this._shapeStartPoint.x),
          Math.abs(this._shapeEndPoint.y - this._shapeStartPoint.y)
        );
        this._addCirclePixels(pixels, this._shapeStartPoint.x, this._shapeStartPoint.y, r);
        break;
      }
      case 'triangle': {
        const sp = this._shapeStartPoint, ep = this._shapeEndPoint;
        const ddx = ep.x - sp.x, ddy = ep.y - sp.y;
        const r = Math.sqrt(ddx * ddx + ddy * ddy);
        if (r > 0) {
          const baseWidth  = r * Math.tan(Math.PI / 6);
          const perpAngle  = Math.atan2(ddy, ddx) + Math.PI / 2;
          const bx = baseWidth * Math.cos(perpAngle), by = baseWidth * Math.sin(perpAngle);
          const ax = ep.x, ay = ep.y;
          const b1x = Math.round(sp.x + bx), b1y = Math.round(sp.y + by);
          const b2x = Math.round(sp.x - bx), b2y = Math.round(sp.y - by);
          const pushClamped = p => {
            if (p.x >= 0 && p.x < ZX_SPECTRUM.WIDTH && p.y >= 0 && p.y < ZX_SPECTRUM.HEIGHT) {
              pixels.push(p);
            }
          };
          this.getLinePoints(ax, ay, b1x, b1y).forEach(pushClamped);
          this.getLinePoints(b1x, b1y, b2x, b2y).forEach(pushClamped);
          this.getLinePoints(b2x, b2y, ax, ay).forEach(pushClamped);
        }
        break;
      }
      default: {
        // rectangle / square / none: 1-pixel border of the bounding rect
        const { x, y, width, height } = rect;
        const x2 = x + width - 1, y2 = y + height - 1;
        for (let px = x; px <= x2; px++) {
          pixels.push({ x: px, y });
          if (y2 !== y) pixels.push({ x: px, y: y2 });
        }
        for (let py = y + 1; py < y2; py++) {
          pixels.push({ x, y: py });
          if (x2 !== x) pixels.push({ x: x2, y: py });
        }
      }
    }
    return pixels;
  }

  // Midpoint circle algorithm — adds all 8-way symmetric border pixels.
  _addCirclePixels(pixels, cx, cy, r) {
    if (r <= 0) { pixels.push({ x: cx, y: cy }); return; }
    const pushInBounds = (x, y) => {
      if (x >= 0 && x < ZX_SPECTRUM.WIDTH && y >= 0 && y < ZX_SPECTRUM.HEIGHT) {
        pixels.push({ x, y });
      }
    };
    const addOctants = (ox, oy) => {
      pushInBounds(cx + ox, cy + oy); pushInBounds(cx - ox, cy + oy);
      pushInBounds(cx + ox, cy - oy); pushInBounds(cx - ox, cy - oy);
      pushInBounds(cx + oy, cy + ox); pushInBounds(cx - oy, cy + ox);
      pushInBounds(cx + oy, cy - ox); pushInBounds(cx - oy, cy - ox);
    };
    let px = 0, py = r, d = 1 - r;
    while (px <= py) {
      addOctants(px, py);
      if (d < 0) d += 2 * px + 3;
      else { d += 2 * (px - py) + 5; py--; }
      px++;
    }
  }

  // ── Shape mask ─────────────────────────────────────────────────────────────

  // Returns true if (pixelX, pixelY) is inside the shape defined by
  // _shapeStartPoint/_shapeEndPoint. For square/rectangle/none the bounds
  // already are the shape so all pixels pass.
  _isInsideShape(pixelX, pixelY, rect) {
    switch (this._fillShape) {
      case 'none':
      case 'rectangle':
      // Square bounds are the exact square (corner-anchored), so every pixel passes.
      case 'square':
        return true;

      case 'circle': {
        const r = Math.max(
          Math.abs(this._shapeEndPoint.x - this._shapeStartPoint.x),
          Math.abs(this._shapeEndPoint.y - this._shapeStartPoint.y)
        );
        const dx = pixelX - this._shapeStartPoint.x, dy = pixelY - this._shapeStartPoint.y;
        return dx * dx + dy * dy <= r * r;
      }

      case 'triangle': {
        const sp = this._shapeStartPoint, ep = this._shapeEndPoint;
        const ddx = ep.x - sp.x, ddy = ep.y - sp.y;
        const r = Math.sqrt(ddx * ddx + ddy * ddy);
        if (r === 0) return pixelX === sp.x && pixelY === sp.y;
        const baseWidth = r * Math.tan(Math.PI / 6);
        const perpAngle = Math.atan2(ddy, ddx) + Math.PI / 2;
        const bx = baseWidth * Math.cos(perpAngle), by = baseWidth * Math.sin(perpAngle);
        const ax = ep.x, ay = ep.y;
        const b1x = sp.x + bx, b1y = sp.y + by;
        const b2x = sp.x - bx, b2y = sp.y - by;
        const sign = (p1x, p1y, p2x, p2y, p3x, p3y) =>
          (p1x - p3x) * (p2y - p3y) - (p2x - p3x) * (p1y - p3y);
        const d1 = sign(pixelX, pixelY, ax, ay, b1x, b1y);
        const d2 = sign(pixelX, pixelY, b1x, b1y, b2x, b2y);
        const d3 = sign(pixelX, pixelY, b2x, b2y, ax, ay);
        const hasNeg = (d1 < 0) || (d2 < 0) || (d3 < 0);
        const hasPos = (d1 > 0) || (d2 > 0) || (d3 > 0);
        return !(hasNeg && hasPos);
      }

      default:
        return true;
    }
  }

  // ── Flood fill ─────────────────────────────────────────────────────────────

  _getFloodFillRegion(seedX, seedY) {
    const region = new Set();
    if (seedX < 0 || seedX >= ZX_SPECTRUM.WIDTH || seedY < 0 || seedY >= ZX_SPECTRUM.HEIGHT) return region;
    const startState = PixelDrawRoutine.getPixelState(seedX, seedY);
    if (!startState) return region;
    const targetIsInk = startState.isInk;
    const encode = (x, y) => (y << 16) | x;
    const stack = [encode(seedX, seedY)];
    while (stack.length > 0) {
      const key = stack.pop();
      if (region.has(key)) continue;
      const x = key & 0xFFFF, y = key >> 16;
      if (x < 0 || x >= ZX_SPECTRUM.WIDTH || y < 0 || y >= ZX_SPECTRUM.HEIGHT) continue;
      const state = PixelDrawRoutine.getPixelState(x, y);
      if (!state || state.isInk !== targetIsInk) continue;
      region.add(key);
      stack.push(encode(x + 1, y), encode(x - 1, y), encode(x, y + 1), encode(x, y - 1));
    }
    return region;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  getPreview() {
    // Preview is handled directly by _updateShapePreview / _updatePreview.
    return null;
  }
}

window.GradientTool = GradientToolClass;

Logger.debug('GradientTool', 'Gradient tool loaded');

})(); // End IIFE
