'use strict';
(function() {

/**
 * Selection Tool
 *
 * Creates rectangular selections on the canvas.
 * Supports selection operations: copy, cut, paste, delete, fill, invert.
 * Shift+drag adds to selection, drag creates new selection.
 */
class SelectionToolClass extends ToolBase {
  /** Declarative options - rendered by OptionControls (contract in tool-base.js). */
  static optionsSchema = [
    { type: 'select', key: 'selectMode', i18n: 'opt.mode', value: 'rectangle', options: [
      { value: 'wand',      i18n: 'sel.wand' },
      { value: 'rectangle', i18n: 'common.rectangle' },
      { value: 'ellipse',   i18n: 'sel.ellipse' },
      { value: 'cell',      i18n: 'sel.cell' },
      { value: 'freeform',  i18n: 'sel.lasso' }
    ]}
  ];

  constructor() {
    super(TOOLS.SELECTION, 'Selection');
    this.cursor = 'crosshair';
    this.isSelecting = false;
    this.startX = 0;
    this.startY = 0;
    this.currentX = 0;
    this.currentY = 0;
    this._selectMode = 'rectangle';
    this._lassoPath = [];
  }

  /**
   * Get selection mode
   * @returns {string}
   */
  getSelectMode() {
    return this._selectMode;
  }

  /**
   * Set selection mode
   * @param {string} mode - 'rectangle', 'ellipse', 'cell', 'freeform', or 'wand'
   */
  setSelectMode(mode) {
    if (mode === 'rectangle' || mode === 'ellipse' || mode === 'cell' ||
        mode === 'freeform' || mode === 'wand') {
      if (this._selectMode !== mode) {
        this.isSelecting = false;
        this._lassoPath = [];
        if (window.GridOverlay) GridOverlay.clearFunctionPreview();
      }
      this._selectMode = mode;
    }
  }

  /**
   * Handle pointer down - start selection
   * @param {number} pixelX - X coordinate (0-255)
   * @param {number} pixelY - Y coordinate (0-191)
   * @param {PointerEvent} e - Pointer event
   */
  onPointerDown(pixelX, pixelY, e) {
    // Right-click clears selection
    if (e.button === 2) {
      SelectionService.clear();
      EventBus.emit(EVENTS.CANVAS_RENDER);
      return;
    }

    // Magic wand: immediate select-by-color on click, no drag needed
    if (this._selectMode === 'wand') {
      if (!e.shiftKey) SelectionService.clear();
      SelectionService.selectByColor(pixelX, pixelY, true);
      EventBus.emit(EVENTS.CANVAS_RENDER);
      return;
    }

    // Start new selection
    this.isSelecting = true;
    this.startX = pixelX;
    this.startY = pixelY;
    this.currentX = pixelX;
    this.currentY = pixelY;

    // Clear existing selection unless shift is held
    if (!e.shiftKey) {
      SelectionService.clear();
    }

    if (this._selectMode === 'freeform') {
      this._lassoPath = [{ x: pixelX, y: pixelY }];
    }
  }

  /**
   * Handle pointer move - update selection preview
   * @param {number} pixelX - X coordinate (0-255)
   * @param {number} pixelY - Y coordinate (0-191)
   * @param {PointerEvent} e - Pointer event
   */
  onPointerMove(pixelX, pixelY, e) {
    if (!this.isSelecting) return;

    this.currentX = pixelX;
    this.currentY = pixelY;

    if (this._selectMode === 'freeform') {
      const last = this._lassoPath[this._lassoPath.length - 1];
      if (last.x !== pixelX || last.y !== pixelY) {
        this._lassoPath.push({ x: pixelX, y: pixelY });
      }
      if (window.GridOverlay) {
        GridOverlay.drawLassoPreview(this._lassoPath);
      }
    } else if (this._selectMode === 'ellipse') {
      const rect = this._normalizeRect(this.startX, this.startY, pixelX, pixelY);
      if (window.GridOverlay) {
        GridOverlay.drawLassoPreview(this._ellipseOutline(rect));
      }
    } else {
      const rect = this._normalizeRect(this.startX, this.startY, pixelX, pixelY);
      const previewRect = this._selectMode === 'cell' ? this._snapToCell(rect) : rect;
      if (window.GridOverlay && previewRect.width > 0 && previewRect.height > 0) {
        GridOverlay.drawSelectionPreview(previewRect.x, previewRect.y, previewRect.width, previewRect.height);
      }
    }
  }

  /**
   * Handle pointer up - finalize selection
   * @param {number} pixelX - X coordinate (0-255)
   * @param {number} pixelY - Y coordinate (0-191)
   * @param {PointerEvent} e - Pointer event
   */
  onPointerUp(pixelX, pixelY, e) {
    if (!this.isSelecting) return;

    this.isSelecting = false;
    this.currentX = pixelX;
    this.currentY = pixelY;

    if (window.GridOverlay) GridOverlay.clearFunctionPreview();

    if (this._selectMode === 'freeform') {
      // Add final position if different from last recorded point
      const last = this._lassoPath[this._lassoPath.length - 1];
      if (last && (last.x !== pixelX || last.y !== pixelY)) {
        this._lassoPath.push({ x: pixelX, y: pixelY });
      }
      if (this._lassoPath.length >= 3) {
        const selectionData = this._rasterizeLasso(this._lassoPath);
        if (selectionData) {
          SelectionService.setSelection(selectionData);
          Logger.debug('SelectionTool', `Lasso selection: ${selectionData.x},${selectionData.y} ${selectionData.width}x${selectionData.height}`);
        }
      }
      this._lassoPath = [];
    } else {
      const committed = this._commitDragSelection();
      if (committed) {
        Logger.debug('SelectionTool', `Selection created: ${committed.x},${committed.y} ${committed.width}x${committed.height}`);
      }
    }

    EventBus.emit(EVENTS.CANVAS_RENDER);
  }

  /**
   * Handle pointer leave
   * @param {PointerEvent} e - Pointer event
   */
  onPointerLeave(e) {
    if (this.isSelecting) {
      if (window.GridOverlay) GridOverlay.clearFunctionPreview();
      if (this._selectMode === 'freeform') {
        if (this._lassoPath.length >= 3) {
          const selectionData = this._rasterizeLasso(this._lassoPath);
          if (selectionData) SelectionService.setSelection(selectionData);
        }
        this._lassoPath = [];
      } else {
        this._commitDragSelection();
      }
    }
    this.isSelecting = false;
  }

  /**
   * Normalize rectangle coordinates (handle negative width/height)
   * @param {number} x1 - First X coordinate
   * @param {number} y1 - First Y coordinate
   * @param {number} x2 - Second X coordinate
   * @param {number} y2 - Second Y coordinate
   * @returns {Object} Normalized rectangle { x, y, width, height }
   * @private
   */
  _normalizeRect(x1, y1, x2, y2) {
    const minX = clamp(Math.min(x1, x2), 0, ZX_SPECTRUM.WIDTH - 1);
    const minY = clamp(Math.min(y1, y2), 0, ZX_SPECTRUM.HEIGHT - 1);
    const maxX = clamp(Math.max(x1, x2), 0, ZX_SPECTRUM.WIDTH - 1);
    const maxY = clamp(Math.max(y1, y2), 0, ZX_SPECTRUM.HEIGHT - 1);

    return {
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1
    };
  }

  /**
   * Get current selection preview rectangle (while dragging)
   * @returns {Object|null} Preview rectangle or null if not selecting
   */
  getSelectionPreview() {
    if (!this.isSelecting) return null;
    const rect = this._normalizeRect(this.startX, this.startY, this.currentX, this.currentY);
    return this._selectMode === 'cell' ? this._snapToCell(rect) : rect;
  }

  /**
   * Check if tool is currently drawing a selection
   * @returns {boolean}
   */
  isDrawingSelection() {
    return this.isSelecting;
  }

  /**
   * Tool activation
   */
  activate() {
    super.activate();
    this.cursor = 'crosshair';
    // Finalise any in-progress floating paste so the selection tool can operate
    // on a clean canvas. The stamp layer stays; only the floating state is cleared.
    if (window.SelectionService && SelectionService.isFloating()) {
      SelectionService.endFloatingPaste();
    }
  }

  /**
   * Tool deactivation
   */
  deactivate() {
    this.isSelecting = false;
    this._lassoPath = [];
    if (window.GridOverlay) GridOverlay.clearFunctionPreview();
    super.deactivate();
  }

  /**
   * Snap a pixel-precise rect to attribute-cell boundaries (cell geometry
   * from the active screen mode).
   * The result expands to cover every cell the original rect touched.
   * @param {{x,y,width,height}} rect
   * @returns {{x,y,width,height}}
   * @private
   */
  _snapToCell(rect) {
    const cw = ZX_SPECTRUM.CELL_WIDTH;
    const ch = ZX_SPECTRUM.CELL_HEIGHT;
    const x   = Math.max(0, Math.floor(rect.x / cw) * cw);
    const y   = Math.max(0, Math.floor(rect.y / ch) * ch);
    const endX = Math.min(ZX_SPECTRUM.WIDTH,  Math.ceil((rect.x + rect.width)  / cw) * cw);
    const endY = Math.min(ZX_SPECTRUM.HEIGHT, Math.ceil((rect.y + rect.height) / ch) * ch);
    return { x, y, width: endX - x, height: endY - y };
  }

  /**
   * Commit the current drag as a selection, in whichever non-lasso mode is
   * active. Cell snaps to attribute cells, ellipse carries a mask, rectangle
   * is the bare rect.
   * @returns {Object|null} The committed selection, or null if the drag was empty
   * @private
   */
  _commitDragSelection() {
    const rect = this._normalizeRect(this.startX, this.startY, this.currentX, this.currentY);
    if (rect.width <= 0 || rect.height <= 0) return null;

    let selection;
    if (this._selectMode === 'cell') {
      selection = this._snapToCell(rect);
    } else if (this._selectMode === 'ellipse') {
      selection = this._rasterizeEllipse(rect);
    } else {
      selection = rect;
    }
    if (!selection || selection.width <= 0 || selection.height <= 0) return null;

    SelectionService.setSelection(selection);
    return selection;
  }

  /**
   * Ordered polygon tracing the ellipse inscribed in a rect — the marching-ants
   * preview path. Fractional coordinates are fine: the overlay only strokes it.
   * @param {{x,y,width,height}} rect
   * @returns {Array<{x,y}>}
   * @private
   */
  _ellipseOutline(rect) {
    const rx = rect.width / 2;
    const ry = rect.height / 2;
    const cx = rect.x + rx;
    const cy = rect.y + ry;
    const steps = Math.max(16, Math.round((rx + ry) * 2));

    const path = [];
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      path.push({ x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) });
    }
    return path;
  }

  /**
   * Rasterize the ellipse inscribed in a rect into that rect + a bool[][] mask.
   * Same offscreen-fill trick as the lasso — the canvas owns the coverage rule,
   * so a circle selection and a circle shape agree on what "inside" means.
   * @param {{x,y,width,height}} rect
   * @returns {{x,y,width,height,mask}|null}
   * @private
   */
  _rasterizeEllipse(rect) {
    const w = rect.width;
    const h = rect.height;
    if (w <= 0 || h <= 0) return null;

    const offscreen = Helpers.createCanvas(w, h);
    const octx = offscreen.getContext('2d');

    octx.fillStyle = '#000';
    octx.beginPath();
    octx.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
    octx.fill();

    const mask = this._maskFromContext(octx, w, h);
    return mask ? { x: rect.x, y: rect.y, width: w, height: h, mask } : null;
  }

  /**
   * Read an offscreen fill back as a bool[][] coverage mask.
   * @param {CanvasRenderingContext2D} octx
   * @param {number} w
   * @param {number} h
   * @returns {Array<Array<boolean>>|null} null when nothing was covered
   * @private
   */
  _maskFromContext(octx, w, h) {
    const { data } = octx.getImageData(0, 0, w, h);
    let any = false;
    const mask = Array.from({ length: h }, (_, ry) =>
      Array.from({ length: w }, (_, rx) => {
        const on = data[(ry * w + rx) * 4 + 3] > 127;
        if (on) any = true;
        return on;
      })
    );
    return any ? mask : null;
  }

  /**
   * Rasterize a freeform lasso path into a bounding rect + bool[][] mask.
   * Uses an offscreen canvas to fill the polygon — avoids manual scanline logic.
   * @param {Array<{x,y}>} path - Closed or open polygon (auto-closed by canvas)
   * @returns {{x,y,width,height,mask}|null}
   * @private
   */
  _rasterizeLasso(path) {
    if (path.length < 3) return null;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of path) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    minX = Math.max(0, minX);
    minY = Math.max(0, minY);
    maxX = Math.min(ZX_SPECTRUM.WIDTH  - 1, maxX);
    maxY = Math.min(ZX_SPECTRUM.HEIGHT - 1, maxY);

    const w = maxX - minX + 1;
    const h = maxY - minY + 1;
    if (w <= 0 || h <= 0) return null;

    const offscreen = Helpers.createCanvas(w, h);
    const octx = offscreen.getContext('2d');

    octx.fillStyle = '#000';
    octx.beginPath();
    octx.moveTo(path[0].x - minX, path[0].y - minY);
    for (let i = 1; i < path.length; i++) {
      octx.lineTo(path[i].x - minX, path[i].y - minY);
    }
    octx.closePath();
    octx.fill();

    const mask = this._maskFromContext(octx, w, h);
    return mask ? { x: minX, y: minY, width: w, height: h, mask } : null;
  }

  /**
   * Select all (shortcut handler)
   */
  selectAll() {
    SelectionService.selectAll();
    EventBus.emit(EVENTS.CANVAS_RENDER);
  }

  /**
   * Clear selection (shortcut handler)
   */
  clearSelection() {
    SelectionService.clear();
    EventBus.emit(EVENTS.CANVAS_RENDER);
  }

  /**
   * Copy selection to clipboard
   */
  copy() {
    SelectionService.copyToClipboard();
  }

  /**
   * Cut selection to clipboard
   */
  cut() {
    SelectionService.cutToClipboard();
    EventBus.emit(EVENTS.CANVAS_RENDER);
  }

  /**
   * Paste from clipboard
   */
  paste() {
    if (!SelectionService.hasClipboard()) return;
    const selection = SelectionService.getSelection();
    const x = selection ? selection.x : 0;
    const y = selection ? selection.y : 0;
    SelectionService.startFloatingPaste(x, y);
    SelectionService.clear();
    EventBus.emit(EVENTS.CANVAS_RENDER);
  }

  /**
   * Delete selection contents
   */
  delete() {
    SelectionService.deleteSelection();
    EventBus.emit(EVENTS.CANVAS_RENDER);
  }

  /**
   * Fill selection with current ink color
   */
  fill() {
    SelectionService.fillSelection();
    EventBus.emit(EVENTS.CANVAS_RENDER);
  }

  /**
   * Invert pixels within selection
   */
  invert() {
    SelectionService.invertSelection();
    EventBus.emit(EVENTS.CANVAS_RENDER);
  }
}

// Expose to global scope
window.SelectionTool = SelectionToolClass;

Logger.debug('SelectionTool', 'Selection tool loaded');

})(); // End IIFE
