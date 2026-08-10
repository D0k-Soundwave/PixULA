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
    { type: 'check', key: 'shapeConstraint', i18n: 'opt.shapeFill', value: false }
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
      this.endPoint = { x: pixelX, y: pixelY };
      this._updatePreview();
    }
  }

  onPointerMove(pixelX, pixelY, e) {
    if (this._phase === 'shape') {
      if (!this.isDrawing) return;
      this._shapeEndPoint = { x: pixelX, y: pixelY };
      this._updateShapePreview();
    } else {
      // Phase 2 drag (button held) — same as hover
      this.endPoint = { x: pixelX, y: pixelY };
      this._updatePreview();
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
      this.endPoint = { x: pixelX, y: pixelY };
      const rect    = this._shapeBounds;
      const reverse = e.button === 2;
      this.clearPreview();
      if (rect && rect.width >= 1 && this.startPoint && this.endPoint) {
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
    this.endPoint = { x: pixelX, y: pixelY };
    this._updatePreview();
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

  // Set up startPoint/endPoint when entering phase 2.
  // startPoint is fixed at the shape centre; endPoint is the current cursor position.
  _enterGradientPhase(bounds, cursorX, cursorY) {
    const cx = Math.round(bounds.x + (bounds.width  - 1) / 2);
    const cy = Math.round(bounds.y + (bounds.height - 1) / 2);
    this.startPoint = { x: cx, y: cy };
    this.endPoint   = { x: cursorX, y: cursorY };
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

  _drawGradient(rect, reverse) {
    if (rect.width < 1 || rect.height < 1) return;

    const color = ColorManager.getCurrentSelection();
    const skipInk   = color.inkTransparent;
    const skipPaper = color.paperTransparent;
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

        const shouldBeInk = this._shouldBeInk(pixelX, pixelY, gradientPos);
        if (shouldBeInk && skipInk) continue;
        if (!shouldBeInk && skipPaper) continue;
        PixelDrawRoutine.draw(pixelX, pixelY, color, PixelDrawRoutine.resolveUserMode(shouldBeInk));
      }
    }

    PixelDrawRoutine.endBatch();
  }

  // Gradient position (0–1) based on the gradient axis (startPoint -> endPoint).
  _getGradientPosition(pixelX, pixelY) {
    const sx = this.startPoint.x, sy = this.startPoint.y;
    const dx = this.endPoint.x - sx, dy = this.endPoint.y - sy;
    const lenSq = dx * dx + dy * dy;

    switch (this.gradientType) {
      case 'linear': {
        if (lenSq === 0) return 0.5;
        const px = pixelX - sx, py = pixelY - sy;
        return clamp((px * dx + py * dy) / lenSq, 0, 1);
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
        return Math.min(1, Math.sqrt(px * px + py * py) / r);
      }
      case 'diamond': {
        const r = Math.sqrt(lenSq);
        if (r === 0) return 0.5;
        return Math.min(1, (Math.abs(pixelX - sx) + Math.abs(pixelY - sy)) / r);
      }
      case 'square': {
        const r = Math.sqrt(lenSq);
        if (r === 0) return 0.5;
        return clamp(Math.max(Math.abs(pixelX - sx), Math.abs(pixelY - sy)) / r, 0, 1);
      }
      case 'conical': {
        if (lenSq === 0) return 0.5;
        const refAngle   = Math.atan2(dy, dx);
        const pixelAngle = Math.atan2(pixelY - sy, pixelX - sx);
        return ((pixelAngle - refAngle) / (2 * Math.PI) + 1) % 1;
      }
      case 'spiral': {
        const r = Math.sqrt(lenSq);
        if (r === 0) return 0.5;
        const radialPos  = Math.min(1, Math.sqrt((pixelX - sx) ** 2 + (pixelY - sy) ** 2) / r);
        const refAngle   = Math.atan2(dy, dx);
        const angularPos = ((Math.atan2(pixelY - sy, pixelX - sx) - refAngle) / (2 * Math.PI) + 1) % 1;
        return (radialPos + angularPos) % 1;
      }
      default:
        return 0.5;
    }
  }

  _shouldBeInk(pixelX, pixelY, gradientPos) {
    const value = Math.min(63, Math.floor(gradientPos * 64));
    // Dithered OFF: a single hard threshold at the midpoint — no Bayer matrix,
    // so ditherScale/grain has no bearing and the gradient reads as solid bands.
    if (this._dithered === false) return value > 31;
    const size      = this.ditherScale;
    const threshold = this._activeDitherMatrix[pixelY % size][pixelX % size];
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
    const skipPaper      = colorSelection.paperTransparent;
    const region         = this._cachedFloodRegion;
    const encodeKey      = region ? (x, y) => (y << 16) | x : null;
    const checkShape     = !this._shapeConstraint && this._fillShape !== 'none';

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

        const isInk = this._shouldBeInk(pixelX, pixelY, gradientPos);
        if (isInk && skipInk) continue;
        if (!isInk && skipPaper) continue;

        affectedCells.add(Math.floor(pixelX / ZX_SPECTRUM.CELL_WIDTH) + ',' + Math.floor(pixelY / ZX_SPECTRUM.CELL_HEIGHT));
        if (isInk) gradientInkSet.add(pixelX + ',' + pixelY);
        else        gradientPaprSet.add(pixelX + ',' + pixelY);
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
