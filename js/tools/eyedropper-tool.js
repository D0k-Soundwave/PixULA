'use strict';
(function() {

/**
 * Eyedropper Tool
 *
 * Picks colors from the canvas.
 * Left-click sets INK color, right-click sets PAPER color.
 * Alt+click picks both ink and paper from the cell attributes.
 */
class EyedropperToolClass extends ToolBase {
  /** No options panel - picking behaviour is fixed. */
  static optionsSchema = [];

  constructor() {
    super(TOOLS.EYEDROPPER, 'Eyedropper');
    this.cursor = 'crosshair';
    this.isPicking = false;
  }

  /**
   * Handle pointer down - pick color
   * @param {number} pixelX - X coordinate (0-255)
   * @param {number} pixelY - Y coordinate (0-191)
   * @param {PointerEvent} e - Pointer event
   */
  onPointerDown(pixelX, pixelY, e) {
    this.isPicking = true;
    this._pickColor(pixelX, pixelY, e);
  }

  /**
   * Handle pointer move - continuous pick while dragging
   * @param {number} pixelX - X coordinate (0-255)
   * @param {number} pixelY - Y coordinate (0-191)
   * @param {PointerEvent} e - Pointer event
   */
  onPointerMove(pixelX, pixelY, e) {
    if (!this.isPicking) return;
    this._pickColor(pixelX, pixelY, e);
  }

  /**
   * Handle pointer up - end picking
   * @param {number} pixelX - X coordinate (0-255)
   * @param {number} pixelY - Y coordinate (0-191)
   * @param {PointerEvent} e - Pointer event
   */
  onPointerUp(pixelX, pixelY, e) {
    this.isPicking = false;
  }

  /**
   * Handle pointer leave
   * @param {PointerEvent} e - Pointer event
   */
  onPointerLeave(e) {
    this.isPicking = false;
  }

  /**
   * Pick color at the specified pixel position
   * @param {number} pixelX - X coordinate (0-255)
   * @param {number} pixelY - Y coordinate (0-191)
   * @param {PointerEvent} e - Pointer event
   * @private
   */
  _pickColor(pixelX, pixelY, e) {
    if (!Validators.isValidPixelCoord(pixelX, pixelY)) return;

    // Indexed modes (Phase 13): pick the composited palette index —
    // left-click selects it as the drawing index, right-click as the
    // background/erase index. Alt+click picks BOTH at once, the same way
    // classic modes' Alt+click picks ink and paper together: the composite
    // (topmost visible) index as the ink, and the background layer's OWN
    // index at that spot — independent of whatever is drawn over it — as
    // the paper, mirroring a classic cell's ink pixel vs its paper
    // attribute. Without this branch, indexed modes had no way to grab
    // both in one action at all, unlike every classic ink/paper mode.
    if (ZX_SPECTRUM.PIXEL_DEPTH > 1) {
      if (e.altKey) {
        const ink = this._getCompositeIndex(pixelX, pixelY);
        const paper = this._getBackgroundIndex(pixelX, pixelY);
        ColorManager.setNextInk(ink);
        ColorManager.setNextPaper(paper);
        Logger.debug('EyedropperTool', `Picked indexed INK+PAPER: ink=${ink}, paper=${paper}`);
      } else {
        const index = this._getCompositeIndex(pixelX, pixelY);
        if (e.button === 2 || (e.buttons & 2) !== 0) {
          ColorManager.setNextPaper(index);
          Logger.debug('EyedropperTool', `Picked indexed PAPER: ${index}`);
        } else {
          ColorManager.setNextInk(index);
          Logger.debug('EyedropperTool', `Picked indexed INK: ${index}`);
        }
      }
      EventBus.emit(EVENTS.TOOL_OPTIONS, { tool: this.id, action: 'pick', x: pixelX, y: pixelY });
      return;
    }

    // Always read from the topmost visible layer that has data at this position.
    // Layers aggregate upward: the highest visible altered cell wins for attributes,
    // and ink pixels from any visible layer contribute to the composite pixel state.
    const composite = this._getCompositeColor(pixelX, pixelY);
    if (!composite) return;
    const cell = composite.cell;
    const isInk = composite.isInk;

    if (e.altKey) {
      // Alt+click: pick both ink and paper from cell attributes
      this._pickCellAttributes(cell);
    } else if (e.button === 2 || (e.buttons & 2) !== 0) {
      // Right-click: set as PAPER
      const paperIndex = cell.paper;
      ColorManager.setPaper(paperIndex);
      if (cell.bright !== ColorManager.getBright()) {
        ColorManager.setBright(cell.bright);
      }
      Logger.debug('EyedropperTool', `Picked PAPER: ${paperIndex} (bright: ${cell.bright})`);
    } else {
      // Left-click: set INK to the cell's ink attribute (regardless of whether pixel is ink or paper)
      const colorIndex = cell.ink;
      ColorManager.setInk(colorIndex);
      if (cell.bright !== ColorManager.getBright()) {
        ColorManager.setBright(cell.bright);
      }
      Logger.debug('EyedropperTool', `Picked INK: ${colorIndex} (bright: ${cell.bright})`);
    }

    EventBus.emit(EVENTS.TOOL_OPTIONS, {
      tool: this.id,
      action: 'pick',
      x: pixelX,
      y: pixelY
    });
  }

  /**
   * Pick both ink and paper from cell attributes
   * @param {Object} cell - Cell data
   * @private
   */
  _pickCellAttributes(cell) {
    ColorManager.setSelection({
      ink: cell.ink,
      paper: cell.paper,
      bright: cell.bright,
      flash: cell.flash
    });
    Logger.debug('EyedropperTool', `Picked cell attributes: ink=${cell.ink}, paper=${cell.paper}, bright=${cell.bright}`);
  }

  /**
   * Get color from composited view (considering layer visibility and altered state)
   * @param {number} pixelX - X coordinate
   * @param {number} pixelY - Y coordinate
   * @returns {Object|null} { colorIndex, isInk, cell } or null
   * @private
   */
  _getCompositeColor(pixelX, pixelY) {
    const { x: cellX, y: cellY } = ZX_COORDS.pixelToCell(pixelX, pixelY);

    // Collect pixel states and find topmost altered cell for attributes
    let compositePixelSet = false;
    let topmostAlteredCell = null;

    // Check layers from top to bottom
    for (let i = LayerManager.getLayerCount() - 1; i >= 0; i--) {
      const layer = LayerManager.getLayer(i);
      if (!layer.visible) continue;

      const cell = layer.getCell(cellX, cellY);
      if (!cell) continue;

      // For pixel state, OR all layer pixels together
      if (cell.altered || layer.isBackground) {
        const pixelState = layer.getPixelState(pixelX, pixelY);
        if (pixelState) {
          compositePixelSet = true;
        }
      }

      // Track topmost altered cell for attributes
      if ((cell.altered || layer.isBackground) && !topmostAlteredCell) {
        topmostAlteredCell = cell;
      }
    }

    // If no altered cells found, use background defaults
    if (!topmostAlteredCell) {
      const bgLayer = LayerManager.getLayer(0);
      if (bgLayer) {
        topmostAlteredCell = bgLayer.getCell(cellX, cellY);
      }
      if (!topmostAlteredCell) {
        // Absolute fallback
        topmostAlteredCell = { ink: 0, paper: 7, bright: false, flash: false };
      }
    }

    const colorIndex = compositePixelSet ? topmostAlteredCell.ink : topmostAlteredCell.paper;

    return { colorIndex, isInk: compositePixelSet, cell: topmostAlteredCell };
  }

  /**
   * The composited palette index at a pixel in an indexed mode: topmost
   * visible layer's set index, else the background's (Phase 13).
   * @private
   */
  _getCompositeIndex(pixelX, pixelY) {
    for (let i = LayerManager.getLayerCount() - 1; i >= 1; i--) {
      const layer = LayerManager.getLayer(i);
      if (!layer.visible || layer.isStamp) continue;
      const idx = layer.getPixelIndex(pixelX, pixelY);
      if (idx >= 0) return idx;
    }
    return this._getBackgroundIndex(pixelX, pixelY);
  }

  /**
   * The background layer's OWN palette index at a pixel, ignoring whatever
   * is drawn over it on upper layers — an indexed mode's equivalent of a
   * classic cell's paper attribute (independent of which pixel is "ink").
   * @private
   */
  _getBackgroundIndex(pixelX, pixelY) {
    const bg = LayerManager.getLayer(0);
    const idx = bg ? bg.getPixelIndex(pixelX, pixelY) : -1;
    return idx >= 0 ? idx : 0;
  }
}

// Expose to global scope
window.EyedropperTool = EyedropperToolClass;

Logger.debug('EyedropperTool', 'Eyedropper tool loaded');

})(); // End IIFE
