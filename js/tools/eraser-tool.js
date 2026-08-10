'use strict';
(function() {

/**
 * Eraser Tool
 *
 * Removes pixels by setting them to PAPER color.
 * Uses Bresenham line interpolation between points for smooth strokes.
 * Supports variable eraser size.
 */
class EraserToolClass extends ToolBase {
  /** Declarative options - rendered by OptionControls (contract in tool-base.js). */
  static optionsSchema = [
    { type: 'range', key: 'size', i18n: 'opt.size', min: 1, max: 128, value: 1 }
  ];

  constructor() {
    super(TOOLS.ERASER, 'Eraser');
    this.cursor = 'cell';
    this.size = 1;
    this.lastPoint = null;
    // Pixels already cleared by the stroke in progress — see _eraseAt. Null
    // outside a stroke, so a single _eraseAt() call still writes its whole disc.
    this._strokePixels = null;
  }

  /**
   * Handle pointer down - start erasing
   * @param {number} pixelX - X coordinate (0-255)
   * @param {number} pixelY - Y coordinate (0-191)
   * @param {PointerEvent} e - Pointer event
   */
  onPointerDown(pixelX, pixelY, e) {
    this.isDrawing = true;
    this.lastPoint = { x: pixelX, y: pixelY };
    this._strokePixels = new Set();

    PixelDrawRoutine.beginBatch();

    this._eraseAt(pixelX, pixelY);
  }

  /**
   * Handle pointer move - continue erasing
   * @param {number} pixelX - X coordinate (0-255)
   * @param {number} pixelY - Y coordinate (0-191)
   * @param {PointerEvent} e - Pointer event
   */
  onPointerMove(pixelX, pixelY, e) {
    if (!this.isDrawing) return;

    // Draw line between last point and current point to fill gaps
    if (this.lastPoint) {
      const points = this.getLinePoints(
        this.lastPoint.x, this.lastPoint.y,
        pixelX, pixelY
      );

      for (let i = 0; i < points.length; i++) {
        this._eraseAt(points[i].x, points[i].y);
      }
    }

    this.lastPoint = { x: pixelX, y: pixelY };
  }

  /**
   * Handle pointer up - end erasing
   * @param {number} pixelX - X coordinate (0-255)
   * @param {number} pixelY - Y coordinate (0-191)
   * @param {PointerEvent} e - Pointer event
   */
  onPointerUp(pixelX, pixelY, e) {
    this.isDrawing = false;
    this.lastPoint = null;
    this._strokePixels = null;

    PixelDrawRoutine.endBatch();
  }

  /**
   * Handle pointer leave - cancel erasing
   * @param {PointerEvent} e - Pointer event
   */
  onPointerLeave(e) {
    if (this.isDrawing) {
      PixelDrawRoutine.endBatch();
    }
    this.isDrawing = false;
    this.lastPoint = null;
    this._strokePixels = null;
  }

  /**
   * Erase at position
   * @param {number} centerX - Center X coordinate
   * @param {number} centerY - Center Y coordinate
   * @private
   */
  _eraseAt(centerX, centerY) {
    const color = ColorManager.getCurrentSelection();
    const seen = this._strokePixels;
    const W = ZX_SPECTRUM.WIDTH, H = ZX_SPECTRUM.HEIGHT;

    // Same disc as the round brush — BrushShapes is the app's only definition
    // of "round", so an eraser of size N clears exactly what a brush of size N
    // would have painted.
    //
    // Erasing a pixel twice does nothing the first pass did not already do, so
    // within ONE stroke each pixel is cleared once. That is what makes the big
    // sizes usable: a drag stamps a disc at every interpolated point, and at
    // size 128 the disc is 12796 px, so a full-width drag issued 2.97M draw
    // calls. Clearing each pixel once bounds the stroke by the CANVAS instead
    // of by the disc area. Measured in Chrome over file://, 2026-08-05, one
    // full-width drag: size 32 29.5 -> 4.7 ms, size 128 455 -> 45.7 ms. The
    // resulting bitmap is byte-identical either way — the dedupe is an
    // optimisation, never a behaviour (pinned by tests/tool-footprint.test.js).
    // The bounds test is here rather than left to draw() for the same reason:
    // most of a 128 px disc hangs off a 256x192 canvas.
    for (const o of BrushShapes.discOffsets(this.size)) {
      const x = centerX + o.dx, y = centerY + o.dy;
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      if (seen) {
        const key = y * W + x;
        if (seen.has(key)) continue;
        seen.add(key);
      }
      // ERASE_ALL, not ERASE: the eraser undoes the fact that anything was
      // drawn here, so a cell it empties gives up its attributes too. The
      // right mouse button is the one that clears ink while still colouring
      // the cell - see the DRAW_MODE block in constants.js.
      PixelDrawRoutine.draw(x, y, color, DRAW_MODE.ERASE_ALL);
    }
  }

  /**
   * Hover footprint — the same offsets _eraseAt walks, so the outline can never
   * promise a different set of pixels than the erase actually clears.
   * @param {number} pixelX - X coordinate
   * @param {number} pixelY - Y coordinate
   * @returns {Array<{x: number, y: number}>}
   */
  getFootprint(pixelX, pixelY) {
    return BrushShapes.discOffsets(this.size)
      .map(o => ({ x: pixelX + o.dx, y: pixelY + o.dy }));
  }

  /**
   * Set eraser size
   *
   * Up to 128: the eraser is the one tool routinely asked to clear a large
   * area, and every size 1..128 is a distinct disc (BrushShapes.disc's
   * quarter-pixel inset — verified strictly increasing, no duplicate masks).
   * The round brush stays at 32; nothing about the geometry stops it, but a
   * 128 px brush and a 128 px eraser are not the same request.
   *
   * @param {number} size - Eraser size (1-128)
   */
  setSize(size) {
    this.size = clamp(size, 1, 128);
    Logger.debug('EraserTool', `Size set to ${this.size}`);
  }

  /**
   * Get current eraser size
   * @returns {number}
   */
  getSize() {
    return this.size;
  }
}

// Expose to global scope
window.EraserTool = EraserToolClass;

Logger.debug('EraserTool', 'Eraser tool loaded');

})(); // End IIFE
