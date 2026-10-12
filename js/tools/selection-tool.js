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
      { value: 'rectangle', i18n: 'common.rectangle' },
      { value: 'ellipse',   i18n: 'sel.ellipse' },
      { value: 'cell',      i18n: 'sel.cell' },
      { value: 'freeform',  i18n: 'sel.lasso' }
    ]},
    // Batch 9 part 9A2: the rectangle can select whole blocks. Free is today's behaviour; the others pick whole multiples
    // of the size (a click picks one block).
    { type: 'select', key: 'selectSize', i18n: 'opt.selectSize', value: 'free',
      showIf: { key: 'selectMode', equals: 'rectangle' }, options: [
      { value: 'free',    i18n: 'sel.size.free' },
      { value: 'cell',    i18n: 'sel.size.cell' },
      { value: 'block16', i18n: 'sel.size.block16' },
      { value: 'screen',  i18n: 'sel.size.screen', disabledIf: { screenFits: false } },
      { value: 'custom',  i18n: 'sel.size.custom' }
    ]},
    { type: 'range', key: 'selectSizeX', i18n: 'opt.selectSizeX', min: 1, max: 640, value: 24, unit: 'px',
      showIf: { all: [ { key: 'selectMode', equals: 'rectangle' }, { key: 'selectSize', equals: 'custom' } ] } },
    { type: 'range', key: 'selectSizeY', i18n: 'opt.selectSizeY', min: 1, max: 256, value: 24, unit: 'px',
      showIf: { all: [ { key: 'selectMode', equals: 'rectangle' }, { key: 'selectSize', equals: 'custom' } ] } }
  ];

  constructor() {
    super(TOOLS.SELECTION, 'Selection');
    this.cursor = 'crosshair';
    // A selection bounds a region rather than painting or taking a colour,
    // so its mark is the neutral overlay colour (ToolBase.markColour).
    this.markColour = 'none';
    this.isSelecting = false;
    this.startX = 0;
    this.startY = 0;
    this.currentX = 0;
    this.currentY = 0;
    this._selectMode = 'rectangle';
    this._lassoPath = [];
    this._selectSize = 'free';
    this._selectSizeX = 24;   // custom block size [A: any value would do]
    this._selectSizeY = 24;
  }

  getSelectSize() { return this._selectSize; }
  /** @param {string} v - 'free' | 'cell' | 'block16' | 'screen' | 'custom' (Screen only where a whole screen fits) */
  setSelectSize(v) {
    if (['free', 'cell', 'block16', 'screen', 'custom'].includes(v)) this._selectSize = v;
  }
  getSelectSizeX() { return this._selectSizeX; }
  setSelectSizeX(v) { this._selectSizeX = clamp(Math.round(Number(v)) || 24, 1, 640); }
  getSelectSizeY() { return this._selectSizeY; }
  setSelectSizeY(v) { this._selectSizeY = clamp(Math.round(Number(v)) || 24, 1, 256); }

  /** The block size in force for a rectangle drag, or null for a free drag. @private */
  _blockSize() {
    if (this._selectMode !== 'rectangle' || this._selectSize === 'free') return null;
    if (this._selectSize === 'screen') {
      // The list greys Screen out unless a whole screen is smaller than the canvas, but a preset can still bring it in:
      // then it is one screen clamped to the canvas (the whole picture in a 256x192 mode).
      const sc = SnapGrid.screenSize();
      return { w: clamp(sc.w, 1, ZX_SPECTRUM.WIDTH), h: clamp(sc.h, 1, ZX_SPECTRUM.HEIGHT) };
    }
    return SnapGrid.sizeOf(this._selectSize, { x: this._selectSizeX, y: this._selectSizeY });
  }

  /**
   * Blocks and cell selection read the raw pointer: InputHandler rounds a snapped pointer to the NEAREST step, so a click
   * in the right half of a cell used to select the next one. The tool snaps what it needs itself.
   */
  get snapsPointer() {
    return !(this._selectMode === 'cell' || this._blockSize());
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
   * @param {string} mode - 'rectangle', 'ellipse', 'cell', or 'freeform'
   */
  setSelectMode(mode) {
    if (mode === 'rectangle' || mode === 'ellipse' || mode === 'cell' ||
        mode === 'freeform') {
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
  /**
   * A rectangle, cell or ellipse drag only redraws its preview, so it takes
   * the last sample; the lasso records its path and needs every one (ToolBase).
   */
  get coalescesPointerMoves() {
    return this._selectMode !== 'freeform';
  }

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
      const rect = this._dragRect();
      if (window.GridOverlay) {
        GridOverlay.drawLassoPreview(this._ellipseOutline(rect));
      }
    } else {
      const previewRect = this._dragRect();
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
    return this._dragRect();
  }

  /**
   * The rectangle the current drag covers, for the preview and the commit. Cell mode snaps to the cells touched; a block
   * size picks whole blocks (Cell on the cell grid, the others starting where the press landed - or on the snap cell the
   * press fell in, when Snap is on); a free drag is the bare rectangle. With Snap on, a free drag's far end is exclusive:
   * both ends are snapped, so a drag from 0 to 16 selects 16 pixels, not 17.
   * @private
   */
  _dragRect() {
    const size = this._blockSize();
    if (size) {
      const start = { x: this.startX, y: this.startY };
      const end = { x: this.currentX, y: this.currentY };
      let origin = { x: 0, y: 0 };
      if (this._selectSize !== 'cell') {
        origin = start;
        if (StateManager.getGridSnap()) {
          const st = StateManager.getGridSnapSize();
          origin = { x: SnapGrid.floor(start.x, st.w), y: SnapGrid.floor(start.y, st.h) };
        }
      }
      const r = SnapGrid.blockRect(start, end, size, origin);
      return { x: r.x, y: r.y, width: r.w, height: r.h };
    }
    const rect = this._normalizeRect(this.startX, this.startY, this.currentX, this.currentY);
    if (this._selectMode === 'cell') return this._snapToCell(rect);
    if (StateManager.getGridSnap() && (this._selectMode === 'rectangle' || this._selectMode === 'ellipse')) {
      if (rect.width > 1) rect.width -= 1;
      if (rect.height > 1) rect.height -= 1;
    }
    return rect;
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
    const rect = this._dragRect();
    if (rect.width <= 0 || rect.height <= 0) return null;

    // A drag that settles to a single pixel wide or tall (a plain click with
    // no movement included, since a zero-distance drag is exactly 1x1) reads
    // as a jitter or a mistaken tap -- nobody sets out to select a line or a
    // point. Not committing it doubles as another deselect/escape path: a
    // plain drag already cleared any prior selection on pointerdown, so
    // simply returning here leaves that cleared state; a Shift+drag addition
    // just adds nothing, leaving the existing selection untouched rather
    // than being replaced by a sliver nobody could see or use. Cell mode is
    // exempt -- a snapped single cell is a deliberate, meaningful minimum
    // there, and can legitimately BE 1px tall by design in the 8x1
    // multicolor modes.
    if (this._selectMode !== 'cell' && !this._blockSize() && (rect.width === 1 || rect.height === 1)) {
      return null;
    }

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
