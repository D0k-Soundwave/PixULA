'use strict';
(function() {

/**
 * Attribute System
 *
 * Manages the grid of attribute cells that define ZX Spectrum color
 * constraints. Grid geometry is a LIVE read of the active screen mode
 * (32×24 cells of 8×8 in standard ULA; 8×4/8×2/8×1 cells in the
 * multicolor modes). Each cell stores:
 * - INK color (0-7)
 * - PAPER color (0-7)
 * - BRIGHT flag (applies to both colors; CLUT bit in ULAplus mode)
 * - FLASH flag (swaps INK/PAPER periodically; CLUT bit in ULAplus mode)
 * - CELL_HEIGHT bytes of pixel bitmap (one byte per row, MSB = left)
 *
 * The 2-color constraint is enforced by design: each pixel
 * is either INK (1) or PAPER (0), so only 2 colors per cell
 * is physically possible in this data structure.
 */
class AttributeSystemClass {
  constructor() {
    this.cells = [];
    this._initializeCells();
  }

  /**
   * Initialize/reset the cell grid to default state
   * @private
   */
  _initializeCells() {
    this.cells = [];
    for (let y = 0; y < ZX_SPECTRUM.GRID_ROWS; y++) {
      const row = [];
      for (let x = 0; x < ZX_SPECTRUM.GRID_COLS; x++) {
        row.push(this._createDefaultCell());
      }
      this.cells.push(row);
    }
  }

  /**
   * Create a default cell (black ink on white paper)
   * @private
   * @returns {Object} Cell data
   */
  _createDefaultCell() {
    return {
      ink: 0,
      paper: 7,
      bright: false,
      flash: false,
      pixels: new Uint8Array(ZX_SPECTRUM.CELL_HEIGHT)
    };
  }

  /**
   * Get cell at grid coordinates
   * @param {number} cellX - Cell X (0-31)
   * @param {number} cellY - Cell Y (0-23)
   * @returns {Object|null} Cell data or null if out of bounds
   */
  getCell(cellX, cellY) {
    if (!Validators.isValidCellCoord(cellX, cellY)) {
      return null;
    }
    return this.cells[cellY][cellX];
  }

  /**
   * Set cell data at grid coordinates
   * @param {number} cellX - Cell X (0-31)
   * @param {number} cellY - Cell Y (0-23)
   * @param {Object} data - Partial cell data to merge
   */
  setCell(cellX, cellY, data) {
    if (!Validators.isValidCellCoord(cellX, cellY)) {
      return;
    }
    const cell = this.cells[cellY][cellX];
    if (data.ink !== undefined) cell.ink = data.ink;
    if (data.paper !== undefined) cell.paper = data.paper;
    if (data.bright !== undefined) cell.bright = data.bright;
    if (data.flash !== undefined) cell.flash = data.flash;
    if (data.pixels) cell.pixels = new Uint8Array(data.pixels);
  }

  /**
   * Get pixel state at pixel coordinates
   * @param {number} pixelX - Pixel X (0-255)
   * @param {number} pixelY - Pixel Y (0-191)
   * @returns {boolean} True if pixel is INK, false if PAPER
   */
  getPixel(pixelX, pixelY) {
    const cellX = Math.floor(pixelX / ZX_SPECTRUM.CELL_WIDTH);
    const cellY = Math.floor(pixelY / ZX_SPECTRUM.CELL_HEIGHT);
    const localX = pixelX % ZX_SPECTRUM.CELL_WIDTH;
    const localY = pixelY % ZX_SPECTRUM.CELL_HEIGHT;

    const cell = this.getCell(cellX, cellY);
    if (!cell) return false;

    const bitPosition = 7 - localX;
    return ((cell.pixels[localY] >> bitPosition) & 1) === 1;
  }

  /**
   * Set pixel state at pixel coordinates
   * @param {number} pixelX - Pixel X (0-255)
   * @param {number} pixelY - Pixel Y (0-191)
   * @param {boolean} isInk - True for INK, false for PAPER
   */
  setPixel(pixelX, pixelY, isInk) {
    const cellX = Math.floor(pixelX / ZX_SPECTRUM.CELL_WIDTH);
    const cellY = Math.floor(pixelY / ZX_SPECTRUM.CELL_HEIGHT);
    const localX = pixelX % ZX_SPECTRUM.CELL_WIDTH;
    const localY = pixelY % ZX_SPECTRUM.CELL_HEIGHT;

    const cell = this.getCell(cellX, cellY);
    if (!cell) return;

    const bitPosition = 7 - localX;
    if (isInk) {
      cell.pixels[localY] |= (1 << bitPosition);
    } else {
      cell.pixels[localY] &= ~(1 << bitPosition);
    }
  }

  /**
   * Get cell containing a specific pixel
   * @param {number} pixelX - Pixel X (0-255)
   * @param {number} pixelY - Pixel Y (0-191)
   * @returns {Object|null} Cell data or null
   */
  getCellForPixel(pixelX, pixelY) {
    const cellX = Math.floor(pixelX / ZX_SPECTRUM.CELL_WIDTH);
    const cellY = Math.floor(pixelY / ZX_SPECTRUM.CELL_HEIGHT);
    return this.getCell(cellX, cellY);
  }

  /**
   * Get the full color index (0-15) for a pixel
   * @param {number} pixelX - Pixel X (0-255)
   * @param {number} pixelY - Pixel Y (0-191)
   * @returns {number} Color index (0-15) or 0 if out of bounds
   */
  getPixelColorIndex(pixelX, pixelY) {
    const cell = this.getCellForPixel(pixelX, pixelY);
    if (!cell) return 0;

    const isInk = this.getPixel(pixelX, pixelY);
    const baseColor = isInk ? cell.ink : cell.paper;

    // Black (0) stays black regardless of bright flag
    if (baseColor === 0) return 0;
    return cell.bright ? baseColor + 8 : baseColor;
  }

  /**
   * Check if adding a new color would violate 2-color constraint
   * Since each pixel is just a bit (INK or PAPER), the constraint
   * is enforced by design - this method exists for documentation
   * and potential future validation.
   *
   * @param {number} cellX - Cell X
   * @param {number} cellY - Cell Y
   * @param {number} newInk - Proposed new INK color
   * @param {number} newPaper - Proposed new PAPER color
   * @returns {boolean} Always true (constraint is structural)
   */
  validateColorConstraint(cellX, cellY, newInk, newPaper) {
    // The 2-color constraint is inherently enforced because:
    // - Each pixel is either INK or PAPER (1 bit)
    // - The cell only stores one INK color and one PAPER color
    // - BRIGHT applies equally to both colors
    // Therefore, maximum 2 colors per cell is guaranteed by design.
    return true;
  }

  /**
   * Count INK pixels in a cell
   * @param {number} cellX - Cell X
   * @param {number} cellY - Cell Y
   * @returns {number} Count of INK pixels (0 to cell area)
   */
  countInkPixels(cellX, cellY) {
    const cell = this.getCell(cellX, cellY);
    if (!cell) return 0;

    let count = 0;
    for (let row = 0; row < cell.pixels.length; row++) {
      let byte = cell.pixels[row];
      // Count set bits (Brian Kernighan's algorithm)
      while (byte) {
        count++;
        byte &= byte - 1;
      }
    }
    return count;
  }

  /**
   * Count PAPER pixels in a cell
   * @param {number} cellX - Cell X
   * @param {number} cellY - Cell Y
   * @returns {number} Count of PAPER pixels (0 to cell area)
   */
  countPaperPixels(cellX, cellY) {
    return (ZX_SPECTRUM.CELL_WIDTH * ZX_SPECTRUM.CELL_HEIGHT) - this.countInkPixels(cellX, cellY);
  }

  /**
   * Clear a single cell to default state
   * @param {number} cellX - Cell X
   * @param {number} cellY - Cell Y
   */
  clearCell(cellX, cellY) {
    if (!Validators.isValidCellCoord(cellX, cellY)) {
      return;
    }
    this.cells[cellY][cellX] = this._createDefaultCell();
  }

  /**
   * Clear all cells to default state
   */
  clearAll() {
    this._initializeCells();
  }

  /**
   * Create a deep copy of cell data
   * @param {number} cellX - Cell X
   * @param {number} cellY - Cell Y
   * @returns {Object|null} Copy of cell data or null
   */
  cloneCell(cellX, cellY) {
    const cell = this.getCell(cellX, cellY);
    if (!cell) return null;

    return {
      ink: cell.ink,
      paper: cell.paper,
      bright: cell.bright,
      flash: cell.flash,
      pixels: new Uint8Array(cell.pixels)
    };
  }

  /**
   * Render a cell to the canvas
   * @param {number} cellX - Cell X
   * @param {number} cellY - Cell Y
   */
  renderCellToCanvas(cellX, cellY) {
    // Use layer composition for proper visibility handling
    if (window.LayerManager) {
      LayerManager.renderCell(cellX, cellY);
    }
  }

  /**
   * Render all cells to the canvas
   */
  renderAllToCanvas() {
    for (let cellY = 0; cellY < ZX_SPECTRUM.GRID_ROWS; cellY++) {
      for (let cellX = 0; cellX < ZX_SPECTRUM.GRID_COLS; cellX++) {
        this.renderCellToCanvas(cellX, cellY);
      }
    }
  }

  /**
   * The ULA screen-memory offset of pixel line y in the interleaved bitmap:
   * screen is split into 3 thirds; within each third, lines interleave in
   * groups of 8. Same formula for every classic 256×192 mode — multicolor
   * variants keep the interleaved bitmap and only change the attribute grid.
   * @param {number} y - Pixel line (0-191)
   * @returns {number} Byte offset of the 32-byte line
   * @private
   */
  _lineOffset(y) {
    return ((y & 0xC0) << 5) + ((y & 0x07) << 8) + ((y & 0x38) << 2);
  }

  /**
   * Export attribute data as binary (ATTR_SIZE bytes for the active mode:
   * 768 in 8×8, up to 6144 in 8×1 — one linear row-major byte per cell)
   * Format: Each byte = FBpppiii (Flash, Bright, Paper[3], Ink[3]);
   * in ULAplus mode the F/B bits are the CLUT selector — same packing.
   * @returns {Uint8Array} ATTR_SIZE bytes of attribute data
   */
  exportAttributes() {
    const attrs = new Uint8Array(ZX_SPECTRUM.TOTAL_CELLS);
    let index = 0;

    for (let cellY = 0; cellY < ZX_SPECTRUM.GRID_ROWS; cellY++) {
      for (let cellX = 0; cellX < ZX_SPECTRUM.GRID_COLS; cellX++) {
        const cell = this.cells[cellY][cellX];
        // ZX attribute byte: flash(1) bright(1) paper(3) ink(3)
        let attrByte = cell.ink & 0x07;
        attrByte |= (cell.paper & 0x07) << 3;
        if (cell.bright) attrByte |= 0x40;
        if (cell.flash) attrByte |= 0x80;
        attrs[index++] = attrByte;
      }
    }

    return attrs;
  }

  /**
   * Import attribute data from binary
   * @param {Uint8Array} attrs - ATTR_SIZE bytes of attribute data
   */
  importAttributes(attrs) {
    if (!attrs || attrs.length !== ZX_SPECTRUM.TOTAL_CELLS) {
      return;
    }

    let index = 0;
    for (let cellY = 0; cellY < ZX_SPECTRUM.GRID_ROWS; cellY++) {
      for (let cellX = 0; cellX < ZX_SPECTRUM.GRID_COLS; cellX++) {
        const attrByte = attrs[index++];
        const cell = this.cells[cellY][cellX];

        cell.ink = attrByte & 0x07;
        cell.paper = (attrByte >> 3) & 0x07;
        cell.bright = (attrByte & 0x40) !== 0;
        cell.flash = (attrByte & 0x80) !== 0;
      }
    }
  }

  /**
   * Export pixel bitmap data (6144 bytes, ULA interleaved layout).
   * Line-based so it works for every attribute cell height — byte-identical
   * to the classic thirds/charRow/line triple loop in 8×8 mode.
   * @returns {Uint8Array} BITMAP_SIZE bytes of bitmap data
   */
  exportBitmap() {
    const bitmap = new Uint8Array(ZX_SPECTRUM.BITMAP_SIZE);
    const cellH = ZX_SPECTRUM.CELL_HEIGHT;
    const cols = ZX_SPECTRUM.GRID_COLS;

    for (let y = 0; y < ZX_SPECTRUM.HEIGHT; y++) {
      const lineBase = this._lineOffset(y);
      const row = this.cells[Math.floor(y / cellH)];
      const rowInCell = y % cellH;
      for (let cellX = 0; cellX < cols; cellX++) {
        bitmap[lineBase + cellX] = row[cellX].pixels[rowInCell];
      }
    }

    return bitmap;
  }

  /**
   * Import pixel bitmap data
   * @param {Uint8Array} bitmap - BITMAP_SIZE bytes of bitmap data
   */
  importBitmap(bitmap) {
    if (!bitmap || bitmap.length !== ZX_SPECTRUM.BITMAP_SIZE) {
      return;
    }

    const cellH = ZX_SPECTRUM.CELL_HEIGHT;
    const cols = ZX_SPECTRUM.GRID_COLS;

    for (let y = 0; y < ZX_SPECTRUM.HEIGHT; y++) {
      const lineBase = this._lineOffset(y);
      const row = this.cells[Math.floor(y / cellH)];
      const rowInCell = y % cellH;
      for (let cellX = 0; cellX < cols; cellX++) {
        row[cellX].pixels[rowInCell] = bitmap[lineBase + cellX];
      }
    }
  }
}

// Create singleton instance
window.AttributeSystem = new AttributeSystemClass();

Logger.debug('AttributeSystem', 'Attribute system loaded');

})(); // End IIFE
