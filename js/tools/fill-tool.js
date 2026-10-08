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

    // The region is every connected pixel of the start pixel's colour: its
    // palette index, its GigaScreen blend, or ink/paper (regionKey). In
    // GigaScreen the three inked blends are three colours, so matching "any
    // ink" flooded across blends the artist could see were different.
    const targetKey = PixelDrawRoutine.regionKey(startState);

    // The same key regionKey(getPixelState(x, y)) gives, read straight from
    // the layer's cell: getPixelState builds an object per pixel, and a
    // fill reads up to 164,000 of them (measured 2026-09-28, LAYER2_640).
    const W = ZX_SPECTRUM.WIDTH, H = ZX_SPECTRUM.HEIGHT;
    const CW = ZX_SPECTRUM.CELL_WIDTH, CH = ZX_SPECTRUM.CELL_HEIGHT;
    const keyAt = (x, y) => {
      const cell = layer.getCell(Math.floor(x / CW), Math.floor(y / CH));
      if (!cell) return undefined;
      const lx = x % CW, ly = y % CH;
      if (cell.indices) return cell.indices[ly * CW + lx];
      const bit = 7 - lx;
      const a = (cell.pixels[ly] >> bit) & 1;
      if (cell.pixelsB) return a * 2 + ((cell.pixelsB[ly] >> bit) & 1);
      return !!a;
    };
    // Constant for the whole fill, so read once rather than per pixel
    const patterned = !isErase && this._usePattern && !!PatternService.getCurrentPattern();

    const mode = PixelDrawRoutine.resolveUserMode(!isErase);
    const color = ColorManager.getCurrentSelection();

    // If trying to fill with the same state, nothing to do. Only meaningful in
    // Normal - the other modes (xor/pixel_only/paper) still change a
    // same-state region, so the guard is skipped for them. The state compared
    // is the one the click WRITES: in indexed modes the ink index, or for the
    // right button the paper index (it paints paper, as the brush's right
    // button does - comparing against the transparency index instead made a
    // right-click fill on an empty upper layer do nothing). In GigaScreen it
    // is a blend - the Paint slot, or paper on both screens for the right
    // button - so a region is "already filled" only when it shows that blend;
    // filling one blend with another changes pixels.
    if (StateManager.getDrawMode() === 'normal') {
      let written;
      if (ZX_SPECTRUM.PIXEL_DEPTH > 1) {
        written = isErase ? ColorManager.getIndexedPaper() : ColorManager.getIndexedInk();
      } else if (startState.slot !== undefined) {
        written = isErase ? GIGA_SLOTS.PAPER_PAPER
          : (color.gigaSlot != null ? color.gigaSlot : GIGA_SLOTS.INK_INK);
      } else {
        written = !isErase;
      }
      if (targetKey === written) return;
    }

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
          if (pixelX < 0 || pixelX >= W || pixelY < 0 || pixelY >= H) continue;
          if (keyAt(pixelX, pixelY) !== targetKey) continue;

          if (patterned) {
            // The pattern's gaps take the gap mode, which is null in XOR (see
            // PixelDrawRoutine.resolvePatternGapMode) - without that, every
            // gap toggled too and the fill came out as a plain invert.
            const pm = PatternService.shouldDrawPixel(pixelX, pixelY)
              ? PixelDrawRoutine.resolveUserMode(true)
              : PixelDrawRoutine.resolvePatternGapMode();
            if (pm !== null) PixelDrawRoutine.draw(pixelX, pixelY, color, pm);
          } else {
            PixelDrawRoutine.draw(pixelX, pixelY, color, mode);
          }
        }
      }

      PixelDrawRoutine.endBatch();
      return;
    }

    // Contiguous flood fill with an explicit stack of pixel numbers
    // (y * W + x). Visited pixels are a byte map rather than a Set, and a
    // neighbour that is off the canvas or already filled is never pushed -
    // it would only have been popped and skipped, so the pixels are filled
    // in exactly the order they always were. Colour is still checked when a
    // pixel is popped, not pushed: a mirrored write (symmetry) can change it
    // in between.
    const visited = new Uint8Array(W * H);
    const diagonal = this._diagonal;
    const stack = [startY * W + startX];
    const push = (x, y) => {
      if (x >= 0 && x < W && y >= 0 && y < H && !visited[y * W + x]) stack.push(y * W + x);
    };

    PixelDrawRoutine.beginBatch();

    while (stack.length > 0) {
      const p = stack.pop();
      if (visited[p]) continue;

      const x = p % W, y = (p - x) / W;
      if (keyAt(x, y) !== targetKey) continue;

      visited[p] = 1;

      if (patterned) {
        const pm = PatternService.shouldDrawPixel(x, y)
          ? PixelDrawRoutine.resolveUserMode(true)
          : PixelDrawRoutine.resolvePatternGapMode();
        if (pm !== null) PixelDrawRoutine.draw(x, y, color, pm);
      } else {
        PixelDrawRoutine.draw(x, y, color, mode);
      }

      push(x + 1, y);
      push(x - 1, y);
      push(x, y + 1);
      push(x, y - 1);

      if (diagonal) {
        push(x + 1, y + 1);
        push(x + 1, y - 1);
        push(x - 1, y + 1);
        push(x - 1, y - 1);
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
    if (!layer.getCell(startCellX, startCellY)) return;

    // Cells are compared by what they SHOW (LayerManager.attrsAsSeen), so a
    // fill on an upper layer follows the colours the artist can see rather
    // than the placeholder black-on-white every empty cell stores - which
    // matched every empty cell on the layer and flooded the lot.
    const start = LayerManager.attrsAsSeen(layer, startCellX, startCellY);
    const srcInk    = start.ink;
    const srcPaper  = start.paper;
    const srcBright = start.bright;
    const srcFlash  = start.flash;

    // GigaScreen: a cell's colours are BOTH screens' sets, so a cell matches
    // only when screen B matches too. Comparing screen A alone flooded cells
    // that merely shared screen A's colours, and recoloured screen B of cells
    // that looked nothing like the one clicked.
    const giga = ZX_SPECTRUM.SCREENS === 2;
    const startB = giga ? LayerManager.attrsAsSeen(layer, startCellX, startCellY, 1) : null;
    const matchesB = (cx, cy) => {
      if (!giga) return true;
      const b = LayerManager.attrsAsSeen(layer, cx, cy, 1);
      return b.ink === startB.ink && b.paper === startB.paper &&
        b.bright === startB.bright && b.flash === startB.flash;
    };

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

      if (!layer.getCell(cx, cy)) continue;
      const seen = LayerManager.attrsAsSeen(layer, cx, cy);
      if (seen.ink !== srcInk || seen.paper !== srcPaper ||
          seen.bright !== srcBright || seen.flash !== srcFlash) continue;
      if (!matchesB(cx, cy)) continue;

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
