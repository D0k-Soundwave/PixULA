'use strict';
(function() {

/**
 * Eyedropper Tool
 *
 * Picks colors from the canvas.
 *
 * Attribute-based screen types (classic ink/paper cells — everything except
 * the Next indexed modes): ink and paper are NOT independent picks — they
 * are two halves of the one attribute byte a cell actually stores, along
 * with bright and flash, so ANY click picks the whole cell's attributes at
 * once, regardless of button or Alt. There is no such thing as "just the
 * ink" of a cell in these modes; picking one half without the other would
 * silently leave the picked colour paired with whatever paper happened to
 * be selected before, which is not what the cell contains.
 *
 * Indexed modes (Next Layer 2/LoRes): pixels are genuinely independent
 * per-pixel palette indices, not a shared attribute — left-click picks the
 * drawing index, right-click the background/erase index, and Alt+click
 * picks both (the composited index as ink, the background layer's own
 * index as paper) in one action.
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

    // Ink and paper are one attribute byte in these modes, not two
    // independent picks — every click picks the whole cell, regardless of
    // button or Alt. (Button/Alt only matter in indexed modes, above,
    // where a pixel's index really is independent of its neighbours'.)
    const cell = this._getTopmostCell(pixelX, pixelY);
    this._pickCellAttributes(cell);

    EventBus.emit(EVENTS.TOOL_OPTIONS, {
      tool: this.id,
      action: 'pick',
      x: pixelX,
      y: pixelY
    });
  }

  /**
   * Pick ink, paper, bright and flash together from a cell's attributes.
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
    Logger.debug('EyedropperTool', `Picked cell attributes: ink=${cell.ink}, paper=${cell.paper}, bright=${cell.bright}, flash=${cell.flash}`);
  }

  /**
   * The topmost visible layer's altered cell at a pixel — its attributes
   * (ink/paper/bright/flash) are what the eyedropper picks as one unit.
   * Layers aggregate upward: the highest visible altered cell wins.
   * @param {number} pixelX - X coordinate
   * @param {number} pixelY - Y coordinate
   * @returns {Object} cell data (never null — falls back to the background,
   *          then to classic defaults)
   * @private
   */
  _getTopmostCell(pixelX, pixelY) {
    const { x: cellX, y: cellY } = ZX_COORDS.pixelToCell(pixelX, pixelY);

    for (let i = LayerManager.getLayerCount() - 1; i >= 0; i--) {
      const layer = LayerManager.getLayer(i);
      if (!layer.visible) continue;
      const cell = layer.getCell(cellX, cellY);
      if (cell && (cell.altered || layer.isBackground)) return cell;
    }

    const bgLayer = LayerManager.getLayer(0);
    const bgCell = bgLayer && bgLayer.getCell(cellX, cellY);
    return bgCell || { ink: 0, paper: 7, bright: false, flash: false };
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
