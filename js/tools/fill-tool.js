'use strict';
(function() {

/**
 * Fill Tool
 *
 * Flood fill tool that fills contiguous regions.
 * Uses 4-connectivity (up, down, left, right).
 * Left-click fills with INK, right-click fills with PAPER (erases).
 */
class FillToolClass extends ToolBase {
  /** Declarative options - rendered by OptionControls (contract in tool-base.js). */
  static optionsSchema = [
    /*
     * Attributes only: flood the CELLS that share the start cell's ink, paper,
     * bright and flash, recolouring them and touching no pixel — "make every
     * cyan cell blue". It used to be reached by putting the whole app into the
     * Attributes Only draw mode, which was retired for doing the same job as
     * the Recolour attribute op; this is the one thing that mode could do and
     * Recolour cannot, since Recolour paints only the cell under the pointer.
     * The options below describe a PIXEL flood and have no effect here.
     */
    { type: 'check', key: 'attributesOnly', i18n: 'opt.fillAttributes', value: false },
    { type: 'check', key: 'contiguous', i18n: 'opt.contiguousOnly', value: true,
      showIf: { key: 'attributesOnly', equals: false } },
    // Connectivity only matters for a contiguous PIXEL flood.
    { type: 'check', key: 'diagonal',   i18n: 'opt.allowDiagonal',  value: false,
      showIf: { all: [{ key: 'attributesOnly', equals: false },
                      { key: 'contiguous', equals: true }] } },
    { type: 'check', key: 'usePattern', i18n: 'opt.usePattern',     value: false,
      showIf: { key: 'attributesOnly', equals: false } }
  ];

  constructor() {
    super(TOOLS.FILL, 'Fill');
    this.cursor = 'crosshair';
    this._diagonal = false;
    this._contiguous = true;
    this._usePattern = false;
    this._attributesOnly = false;
  }

  /** @returns {boolean} flood cell attributes instead of pixels */
  getAttributesOnly() {
    return this._attributesOnly;
  }

  /** @param {boolean} value */
  setAttributesOnly(value) {
    this._attributesOnly = Boolean(value);
  }

  // Draw mode is global; delegate for any external callers.
  getDrawMode() { return StateManager.getDrawMode(); }
  setDrawMode(v) { StateManager.setDrawMode(v); }

  /**
   * Get diagonal fill setting
   * @returns {boolean}
   */
  getDiagonal() {
    return this._diagonal;
  }

  /**
   * Set diagonal fill setting
   * @param {boolean} value
   */
  setDiagonal(value) {
    this._diagonal = Boolean(value);
  }

  /**
   * Get contiguous fill setting
   * @returns {boolean}
   */
  getContiguous() {
    return this._contiguous;
  }

  /**
   * Set contiguous fill setting
   * @param {boolean} value
   */
  setContiguous(value) {
    this._contiguous = Boolean(value);
  }

  getUsePattern() { return this._usePattern; }
  setUsePattern(v) { this._usePattern = Boolean(v); }

  /**
   * Handle pointer down - perform flood fill
   * @param {number} pixelX - X coordinate (0-255)
   * @param {number} pixelY - Y coordinate (0-191)
   * @param {PointerEvent} e - Pointer event
   */
  onPointerDown(pixelX, pixelY, e) {
    const isErase = e.button === 2;
    this._floodFill(pixelX, pixelY, isErase);
  }

  /**
   * Perform flood fill from starting point
   * @param {number} startX - Start X coordinate
   * @param {number} startY - Start Y coordinate
   * @param {boolean} isErase - True for erase mode
   * @private
   */
  _floodFill(startX, startY, isErase) {
    // Attribute-only flood fill: recolour cells sharing the same attribute
    if (this._attributesOnly) {
      this._attributeFloodFill(startX, startY);
      return;
    }

    // Get current layer
    const layer = LayerManager.getCurrentLayer();
    if (!layer) {
      Logger.warn('FillTool', 'No active layer');
      return;
    }

    // Get the starting pixel state
    const startState = PixelDrawRoutine.getPixelState(startX, startY);
    if (!startState) return;

    // Indexed modes (Phase 13): fill matches the exact palette index at
    // the start pixel (classic modes match the ink/paper state below).
    const indexed = ZX_SPECTRUM.PIXEL_DEPTH > 1;
    const targetIndex = indexed ? startState.index : 0;
    if (indexed) {
      const replacement = isErase ? -1 : ColorManager.getIndexedInk();
      if (targetIndex === replacement) return; // nothing to do
    }

    // Determine if we're filling ink or paper areas
    const targetIsInk = startState.isInk;
    const matches = indexed
      ? (state) => state.index === targetIndex
      : (state) => state.isInk === targetIsInk;

    // If trying to fill with the same state, nothing to do. Only meaningful for
    // plain NORMAL/ERASE — the other modes (xor/pixel_only/paper) still change
    // a same-state region, so the guard is skipped for them.
    if (!indexed && StateManager.getDrawMode() === 'normal') {
      if (targetIsInk && !isErase) {
        return;
      }
      if (!targetIsInk && isErase) {
        return;
      }
    }

    const mode = PixelDrawRoutine.resolveUserMode(!isErase);
    const color = ColorManager.getCurrentSelection();

    // Non-contiguous fill: replace ALL pixels matching the target state
    if (!this._contiguous) {
      const area = SelectionService.hasSelection()
        ? SelectionService.getSelection()
        : { x: 0, y: 0, width: ZX_SPECTRUM.WIDTH, height: ZX_SPECTRUM.HEIGHT };

      PixelDrawRoutine.beginBatch();

      for (let py = 0; py < area.height; py++) {
        for (let px = 0; px < area.width; px++) {
          const pixelX = area.x + px;
          const pixelY = area.y + py;
          if (!Validators.isValidPixelCoord(pixelX, pixelY)) continue;

          const state = PixelDrawRoutine.getPixelState(pixelX, pixelY);
          if (!state) continue;
          if (!matches(state)) continue;

          if (!isErase && this._usePattern && PatternService.getCurrentPattern()) {
            const pm = PixelDrawRoutine.resolveUserMode(PatternService.shouldDrawPixel(pixelX, pixelY));
            PixelDrawRoutine.draw(pixelX, pixelY, color, pm);
          } else {
            PixelDrawRoutine.draw(pixelX, pixelY, color, mode);
          }
        }
      }

      PixelDrawRoutine.endBatch();
      return;
    }

    // Contiguous flood fill with explicit stack
    const visited = new Set();
    const encode = (px, py) => (py << 16) | px;
    const decode = (key) => ({ x: key & 0xFFFF, y: key >> 16 });

    const stack = [encode(startX, startY)];

    PixelDrawRoutine.beginBatch();

    while (stack.length > 0) {
      const key = stack.pop();

      if (visited.has(key)) {
        continue;
      }

      const { x, y } = decode(key);

      if (x < 0 || x >= ZX_SPECTRUM.WIDTH || y < 0 || y >= ZX_SPECTRUM.HEIGHT) {
        continue;
      }

      const state = PixelDrawRoutine.getPixelState(x, y);
      if (!state) continue;

      if (!matches(state)) {
        continue;
      }

      visited.add(key);

      if (!isErase && this._usePattern && PatternService.getCurrentPattern()) {
        const pm = PixelDrawRoutine.resolveUserMode(PatternService.shouldDrawPixel(x, y));
        PixelDrawRoutine.draw(x, y, color, pm);
      } else {
        PixelDrawRoutine.draw(x, y, color, mode);
      }

      stack.push(encode(x + 1, y));
      stack.push(encode(x - 1, y));
      stack.push(encode(x, y + 1));
      stack.push(encode(x, y - 1));

      if (this._diagonal) {
        stack.push(encode(x + 1, y + 1));
        stack.push(encode(x + 1, y - 1));
        stack.push(encode(x - 1, y + 1));
        stack.push(encode(x - 1, y - 1));
      }
    }

    PixelDrawRoutine.endBatch();
  }

  /**
   * Flood-fill cell attributes: recolour all connected cells sharing the same
   * ink/paper/bright/flash attribute as the start cell, without touching pixels.
   * @param {number} startX - Start pixel X
   * @param {number} startY - Start pixel Y
   * @private
   */
  _attributeFloodFill(startX, startY) {
    const layer = LayerManager.getCurrentLayer();
    if (!layer) return;

    const { x: startCellX, y: startCellY } = ZX_COORDS.pixelToCell(startX, startY);
    const startCell  = layer.getCell(startCellX, startCellY);
    if (!startCell) return;

    const srcInk    = startCell.ink;
    const srcPaper  = startCell.paper;
    const srcBright = startCell.bright;
    const srcFlash  = startCell.flash;

    const COLS = ZX_SPECTRUM.GRID_COLS; // 32
    const ROWS = ZX_SPECTRUM.GRID_ROWS; // 24

    const encodeCell = (cx, cy) => cy * COLS + cx;
    const visited = new Set();
    const stack   = [encodeCell(startCellX, startCellY)];

    const color = ColorManager.getCurrentSelection();

    PixelDrawRoutine.beginBatch('Attribute Fill');

    while (stack.length > 0) {
      const key = stack.pop();
      if (visited.has(key)) continue;

      const cx = key % COLS;
      const cy = Math.floor(key / COLS);
      if (cx < 0 || cx >= COLS || cy < 0 || cy >= ROWS) continue;

      const cell = layer.getCell(cx, cy);
      if (!cell) continue;
      if (cell.ink !== srcInk || cell.paper !== srcPaper ||
          cell.bright !== srcBright || cell.flash !== srcFlash) continue;

      visited.add(key);

      // Draw into the top-left pixel of the cell — ATTRIBUTES_ONLY won't touch pixel data
      const cellOrigin = ZX_COORDS.cellToPixel(cx, cy);
      PixelDrawRoutine.draw(cellOrigin.x, cellOrigin.y, color, DRAW_MODE.ATTRIBUTES_ONLY);

      stack.push(encodeCell(cx + 1, cy));
      stack.push(encodeCell(cx - 1, cy));
      stack.push(encodeCell(cx, cy + 1));
      stack.push(encodeCell(cx, cy - 1));
    }

    PixelDrawRoutine.endBatch();
  }
}

// Expose to global scope
window.FillTool = FillToolClass;

Logger.debug('FillTool', 'Fill tool loaded');

})(); // End IIFE
