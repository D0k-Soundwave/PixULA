'use strict';
(function() {

/**
 * BIFROST*ZXodus ColorTile files (.ctile, Phase 12b) — the tile format of
 * Einar Saukas' BIFROST/BIFROST*2 multicolour engines, editable in
 * ZX-Paintbrush ("Support for BIFROST*CTILE blocks — Timex based pictures
 * with 16x16 pixels and 32 bytes colour attributes").
 *
 * One tile = 64 bytes (ZX-PB: "Bifrost*ColorTiles must have 64 bytes!"):
 *   32 bitmap bytes  — 16 rows top-down × 2 bytes (left byte first,
 *                      MSB = leftmost pixel), then
 *   32 attribute bytes — the same 16×2 order, one ZX attribute byte per
 *                      8×1 cell (the 8×1 format "is only available for
 *                      Timex screen files and Bifrost Ctiles" — ZX-PB CHM).
 * Layout source: the z88dk BiFrost documentation ("The ctile data format
 * is very simple: 32 bytes of bitmap data followed by 32 bytes of
 * attribute data") + the ZX-PB strings above. No other public spec exists;
 * the row order inside each 32-byte block is undocumented — we use linear
 * top-down (the natural engine copy order) and round-trip our own output.
 *
 * A .ctile FILE is a bare sequence of tiles with no header — ZX-Paintbrush
 * asks the user for the sheet dimensions on load ("CTILE files support
 * sizes of 16x16 or multiples of this!"). We lay tiles left-to-right,
 * top-to-bottom, 16 tiles (256 px) per row — export slices the same
 * order, so files round-trip; a file with more tiles than the canvas
 * holds (192) is rejected.
 *
 * Import switches the document to the 8×1 multicolor mode (raw switch
 * inside the undo action; ZX-PB instead refuses with "You must activate
 * Timex mode" — switching is our documented, friendlier equivalent) and
 * writes the tiles into the current layer's top-left region, leaving the
 * rest of the layer untouched. Export requires an 8×1 fixed-palette mode
 * and slices the flattened composite: the active selection's bounds when
 * one exists (they must sit on the 16-pixel tile grid), the whole canvas
 * otherwise.
 */
class CtileFormatClass {

  initialize() {
    FormatRegistry.registerImport('ctile', this);
    FormatRegistry.registerExport('ctile', this);
    Logger.info('CtileFormat', 'Initialized');
  }

  // ── Import ────────────────────────────────────────────────────────────────

  /**
   * Parse a .ctile tile sequence.
   * @param {ArrayBuffer} buffer
   * @returns {Object} { success } | { success: false, error }
   */
  parse(buffer) {
    const bytes = new Uint8Array(buffer);
    const MC1 = SCREEN_MODES.MULTICOLOR_8x1;

    if (bytes.length === 0 || bytes.length % 64 !== 0) {
      return {
        success: false,
        error: Helpers.localizedMessage('mode.ctileBadSize',
          'Not a ColorTile file — the size must be a multiple of 64 bytes.')
      };
    }
    const tileCount = bytes.length / 64;
    const tilesPerRow = Math.min(tileCount, 16);
    const tileRows = Math.ceil(tileCount / tilesPerRow);
    if (tileRows * 16 > MC1.height) {
      return {
        success: false,
        error: Helpers.localizedMessage('mode.ctileTooBig',
          'This ColorTile file holds more tiles than the canvas can show.')
      };
    }

    UndoRedoService.beginAction('Load CTILE');

    if (window.ScreenModeService && ScreenModeService.getModeId() !== MC1.id) {
      ScreenModeService.applyModeRaw(MC1.id);
    }

    const layer = LayerManager.getCurrentLayer();
    if (!layer) {
      if (typeof UndoRedoService.cancelAction === 'function') UndoRedoService.cancelAction();
      else UndoRedoService.endAction();
      return { success: false, error: 'No active layer' };
    }

    for (let t = 0; t < tileCount; t++) {
      this._writeTile(layer, bytes.subarray(t * 64, t * 64 + 64),
        (t % tilesPerRow) * 2, Math.floor(t / tilesPerRow) * 16);
    }

    LayerManager.composeToCanvas();
    UndoRedoService.endAction();

    Logger.info('CtileFormat', `Loaded ${tileCount} ColorTile(s)`);
    EventBus.emit(EVENTS.FILE_IMPORT, { format: 'ctile' });
    return { success: true };
  }

  /**
   * Write one 64-byte tile into the layer at cell origin (cx0, cy0) —
   * 8×1 mode cells: 2 byte-columns × 16 pixel rows. @private
   */
  _writeTile(layer, tile, cx0, cy0) {
    for (let r = 0; r < 16; r++) {
      for (let c = 0; c < 2; c++) {
        const attr = tile[32 + r * 2 + c];
        layer.setCell(cx0 + c, cy0 + r, {
          ink: attr & 7,
          paper: (attr >> 3) & 7,
          bright: (attr & 0x40) !== 0,
          flash: (attr & 0x80) !== 0,
          pixels: new Uint8Array([tile[r * 2 + c]])
        });
      }
    }
  }

  // ── Export ────────────────────────────────────────────────────────────────

  /**
   * Export the flattened composite as a tile sequence — the selection's
   * bounds when a selection exists (16-pixel aligned), else the full
   * canvas. 8×1 fixed-palette mode only.
   * @returns {Uint8Array}
   */
  export() {
    const mode = ACTIVE_SCREEN_MODE;
    if (mode.attrCellH !== 1 || mode.paletteModel !== 'fixed16') {
      throw new Error(Helpers.localizedMessage('mode.ctileNeedsTimex',
        'ColorTiles are 8×1-attribute tiles — switch to Multicolor 8×1 (Timex) mode first.'));
    }

    // Region: selection bounds (tile-aligned) or the whole canvas
    let x = 0, y = 0, w = mode.width, h = mode.height;
    const sel = window.SelectionService && SelectionService.getSelection
      ? SelectionService.getSelection() : null;
    if (sel) {
      if (sel.x % 16 || sel.y % 16 || sel.width % 16 || sel.height % 16) {
        throw new Error(Helpers.localizedMessage('mode.ctileSelectionAlign',
          'ColorTiles are 16×16 pixels — the selection must sit on the 16-pixel grid.'));
      }
      x = sel.x; y = sel.y; w = sel.width; h = sel.height;
    }

    const flattened = LayerManager.flattenVisible();
    const tilesX = w / 16;
    const tilesY = h / 16;
    const out = new Uint8Array(tilesX * tilesY * 64);
    let p = 0;
    for (let ty = 0; ty < tilesY; ty++) {
      for (let tx = 0; tx < tilesX; tx++) {
        this._readTile(flattened, out.subarray(p, p + 64),
          x / 8 + tx * 2, y + ty * 16);
        p += 64;
      }
    }
    return out;
  }

  /** Read one tile at cell origin (cx0, cy0) into a 64-byte view. @private */
  _readTile(layer, tile, cx0, cy0) {
    for (let r = 0; r < 16; r++) {
      for (let c = 0; c < 2; c++) {
        const cell = layer.getCell(cx0 + c, cy0 + r);
        tile[r * 2 + c] = cell ? cell.pixels[0] : 0;
        tile[32 + r * 2 + c] = cell
          ? (cell.ink & 7) | ((cell.paper & 7) << 3)
            | (cell.bright ? 0x40 : 0) | (cell.flash ? 0x80 : 0)
          : 0x38;
      }
    }
  }

  /** @param {string} filename */
  exportAndDownload(filename) {
    let name = filename || 'tiles.ctile';
    if (!name.toLowerCase().endsWith('.ctile')) name = `${name}.ctile`;
    FormatRegistry.download(this.export(), name);
  }
}

// Create singleton
window.CtileFormat = new CtileFormatClass();

Logger.debug('CtileFormat', 'ColorTile format handler loaded');

})(); // End IIFE
