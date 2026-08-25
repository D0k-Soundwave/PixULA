'use strict';
(function() {

/**
 * SCR Format Handler
 *
 * Handles the ZX Spectrum .SCR native screen format (geometry from the
 * active SCREEN_MODES descriptor — bitmap section in interleaved screen
 * order followed by the linear attribute block, no header).
 *
 * Mode-aware since Phase 12a. The byte LENGTH declares the variant:
 *   6912  — standard ULA screen (bitmap + attributes)
 *   6144  — bitmap-only dump (attributes default to black-on-white)
 *   6976  — ULAplus screen: 6912 + the 64 G3R3B2 palette registers
 *           (RECOIL: RECOIL_SetUlaPlus(content, 6912))
 *   12288 — Timex hi-colour SCREEN$ (Phase 12b): interleaved bitmap +
 *           attributes in the SAME ULA interleave (RECOIL DecodeScr case
 *           12288, attributesMode -1 — NOT .mlt's linear attribute rows).
 *           The mode is MULTICOLOR_8x1 — ZX-Paintbrush treats 8×1 AS
 *           "Timex format", so the cell model needs no second descriptor.
 *   12352 — the above + the 64 ULAplus registers (mode ULA_PLUS_8x1)
 *   12289 — Timex hi-res 512×192 (two display files + the port byte);
 *           layout + import/export live in io/timex-format.js
 * Importing a variant that belongs to another screen mode switches the
 * document to that mode first (raw switch — the file replaces the content;
 * one Undo restores the previous mode AND content because the snapshot
 * carries both). Export emits the ACTIVE mode's variant; 8×2/8×4 have no
 * .scr representation (ZX-Paintbrush stores 8×2 as .ifl — see
 * io/multicolor-format.js) and GigaScreen documents save as .img
 * (io/gigascreen-format.js) — both gate with a localized error.
 *
 * Uses AttributeSystem's export/import methods which handle
 * the complex ZX Spectrum screen memory layout.
 */
class SCRFormatClass {
  // Live views of the active mode's encoding sizes (a constructor capture
  // would freeze the boot mode's geometry — the mode is runtime-switchable).
  get FILE_SIZE()   { return ZX_SPECTRUM.SCR_FILE_SIZE; }
  get BITMAP_SIZE() { return ZX_SPECTRUM.BITMAP_SIZE; }
  get ATTR_SIZE()   { return ZX_SPECTRUM.ATTR_SIZE; }

  /**
   * Initialize and register with FormatRegistry
   */
  initialize() {
    FormatRegistry.registerImport('scr', this);
    FormatRegistry.registerExport('scr', this);
    // .bsc "Border Screen" (RECOIL parity, import only): a screen plus
    // border stripe data we have no model for — the border bytes are
    // dropped (documented loss) and the screen core imports normally.
    FormatRegistry.registerImport('bsc', {
      parse: (buffer) => this.parseBsc(buffer)
    });
    Logger.info('SCRFormat', 'Initialized');
  }

  /**
   * Parse a .bsc Border Screen (layouts per RECOIL_DecodeBsc):
   *   11136 — standard 6912 screen + 4224 border bytes
   *   11904 — 6144 bitmap + 1536 attrs in TWO 768-byte half blocks
   *           (upper/lower half of each cell row — the 8×4 attribute
   *           variant; border bytes at 7680)
   * Border data is dropped on import (we model no border bitmap).
   * @param {ArrayBuffer} buffer
   * @returns {Object} { success } | { success: false, error }
   */
  parseBsc(buffer) {
    const bytes = new Uint8Array(buffer);
    const STD = SCREEN_MODES.STANDARD_ULA;

    if (bytes.length === 11136) {
      return this.importScreen(
        bytes.slice(0, STD.bitmapSize),
        bytes.slice(STD.bitmapSize, STD.fileSize),
        STD.id, 'Load BSC');
    }

    if (bytes.length === 11904) {
      const MC4 = SCREEN_MODES.MULTICOLOR_8x4;
      // Linearize: attr row r (one per 4 pixel lines) <- half block
      // (r & 1) of cell row (r >> 1)
      const attrs = new Uint8Array(MC4.attrSize);
      const rows = MC4.height / MC4.attrCellH;
      for (let r = 0; r < rows; r++) {
        const src = STD.bitmapSize + (r & 1) * 768 + (r >> 1) * 32;
        attrs.set(bytes.subarray(src, src + 32), r * 32);
      }
      return this.importScreen(
        bytes.slice(0, MC4.bitmapSize), attrs, MC4.id, 'Load BSC');
    }

    return {
      success: false,
      error: `Invalid .bsc file size: ${bytes.length} bytes (expected 11136 or 11904)`
    };
  }

  /**
   * Parse SCR file data
   * @param {ArrayBuffer} buffer - File data
   * @returns {Object} Parsed result { success: true } or { success: false, error: string }
   */
  parse(buffer) {
    const bytes = new Uint8Array(buffer);
    const STD = SCREEN_MODES.STANDARD_ULA;
    const UPLUS = SCREEN_MODES.ULA_PLUS;
    const MC1 = SCREEN_MODES.MULTICOLOR_8x1;
    const UPLUS1 = SCREEN_MODES.ULA_PLUS_8x1;
    const HIRES = SCREEN_MODES.TIMEX_HIRES;

    // The byte length declares the variant / target mode
    if (bytes.length === STD.fileSize || bytes.length === STD.bitmapSize) {
      const bitmapOnly = bytes.length === STD.bitmapSize;
      const bitmap = bytes.slice(0, STD.bitmapSize);
      const attrs = bitmapOnly
        ? new Uint8Array(STD.attrSize).fill(0x38) // paper 7, ink 0
        : bytes.slice(STD.bitmapSize, STD.fileSize);
      return this.importScreen(bitmap, attrs, STD.id, 'Load SCR');
    }

    if (bytes.length === UPLUS.fileSize) {
      const bitmap = bytes.slice(0, UPLUS.bitmapSize);
      const attrs = bytes.slice(UPLUS.bitmapSize, UPLUS.bitmapSize + UPLUS.attrSize);
      const palette = bytes.slice(STD.fileSize, UPLUS.fileSize);
      return this.importScreen(bitmap, attrs, UPLUS.id, 'Load SCR', palette);
    }

    // Timex hi-colour SCREEN$ — the attribute block is stored in the same
    // ULA interleave as the bitmap; AttributeSystem expects linear rows
    if (bytes.length === MC1.fileSize) {
      const bitmap = bytes.slice(0, MC1.bitmapSize);
      const attrs = this._deinterleaveAttrs(
        bytes.subarray(MC1.bitmapSize, MC1.fileSize), MC1);
      return this.importScreen(bitmap, attrs, MC1.id, 'Load SCR');
    }

    if (bytes.length === UPLUS1.fileSize) {
      const bitmap = bytes.slice(0, UPLUS1.bitmapSize);
      const attrs = this._deinterleaveAttrs(
        bytes.subarray(UPLUS1.bitmapSize, UPLUS1.bitmapSize + UPLUS1.attrSize), UPLUS1);
      const palette = bytes.slice(
        UPLUS1.bitmapSize + UPLUS1.attrSize, UPLUS1.fileSize);
      return this.importScreen(bitmap, attrs, UPLUS1.id, 'Load SCR', palette);
    }

    if (bytes.length === HIRES.fileSize && window.TimexFormat) {
      return TimexFormat.importHires(bytes, 'Load SCR');
    }

    return {
      success: false,
      error: `Invalid SCR file size: ${bytes.length} bytes ` +
        `(expected ${STD.fileSize}, ${STD.bitmapSize}, ${UPLUS.fileSize}, ` +
        `${MC1.fileSize}, ${UPLUS1.fileSize} or ${HIRES.fileSize})`
    };
  }

  /**
   * Shared import path for SCR-family screens (also used by the multicolor
   * handler): switches the document to the variant's mode when needed (raw —
   * inside the undo action, so one Undo restores mode + content), loads the
   * bitmap/attribute blocks through AttributeSystem, and recomposes.
   * @param {Uint8Array} bitmap - Interleaved bitmap block (mode's bitmapSize)
   * @param {Uint8Array} attrs - Linear attribute block (mode's attrSize)
   * @param {string} modeId - Target SCREEN_MODES id
   * @param {string} label - Undo action label
   * @param {Uint8Array} [palette] - 64 ULAplus registers (ulaplus64 modes)
   * @returns {Object} { success } | { success: false, error }
   */
  importScreen(bitmap, attrs, modeId, label, palette = null) {
    UndoRedoService.beginAction(label);

    if (window.ScreenModeService && ScreenModeService.getModeId() !== modeId) {
      ScreenModeService.applyModeRaw(modeId);
    }

    if (palette && window.ColorManager) {
      ColorManager.setUlaplusRegisters(palette);
    }

    // Get active layer (after the mode switch — layers were re-shaped)
    const layer = LayerManager.getCurrentLayer();
    if (!layer) {
      if (typeof UndoRedoService.cancelAction === 'function') UndoRedoService.cancelAction();
      else UndoRedoService.endAction();
      return { success: false, error: 'No active layer' };
    }

    // Import to AttributeSystem (which handles the complex layout)
    AttributeSystem.importBitmap(bitmap);
    AttributeSystem.importAttributes(attrs);

    // Sync AttributeSystem cells to the layer
    this._syncToLayer(layer);

    // Trigger render
    LayerManager.composeToCanvas();

    UndoRedoService.endAction();

    Logger.info('SCRFormat', `Screen loaded (${modeId})`);
    EventBus.emit(EVENTS.FILE_IMPORT, { format: 'scr' });

    return { success: true };
  }

  /**
   * Export current canvas to SCR format — the ACTIVE mode's variant
   * (standard 6912; ULAplus 6976 with the palette registers appended;
   * 8×1 modes emit the Timex hi-colour container with the attribute block
   * interleaved like the bitmap, 12288 or 12352 with registers; Timex
   * hi-res delegates to io/timex-format.js). 8×2/8×4 and GigaScreen have
   * no .scr container and gate with a localized error.
   * @returns {Uint8Array} SCR file data (fileSize bytes from the mode descriptor)
   */
  export() {
    const mode = ACTIVE_SCREEN_MODE;

    // Indexed Next modes (Phase 13) have no ink/paper cells — no SCREEN$
    // representation. Save as .nxi/.sl2 instead (localized gate).
    Helpers.assertClassicPixelModel();

    if ((mode.screens || 1) === 2) {
      throw new Error(Helpers.localizedMessage('mode.scrUseImg',
        'GigaScreen documents hold two sub-screens — save as .img instead.'));
    }
    if (mode.paletteModel === 'timexMono') {
      return TimexFormat.exportHires();
    }
    if (mode.attrCellH !== SCREEN_MODES.STANDARD_ULA.attrCellH
        && mode.attrCellH !== 1) {
      throw new Error(Helpers.localizedMessage('mode.scrNeedsStandardCells',
        'This document’s attribute cells fit no SCREEN$ container — save as .mlt or .ifl instead, or switch modes first.'));
    }

    const scrData = new Uint8Array(this.FILE_SIZE);

    // Composite all visible layers (pixels OR-stacked, attributes from the
    // topmost altered layer) so the file matches what the canvas shows —
    // exporting only the current layer would drop every other layer.
    const flattened = LayerManager.flattenVisible();
    this._syncFromLayer(flattened);

    // Get bitmap data (handles interleaved layout)
    const bitmap = AttributeSystem.exportBitmap();
    scrData.set(bitmap, 0);

    // Get attribute data — 8×1 (Timex hi-colour) containers store it in
    // the same ULA interleave as the bitmap, everything else linear
    let attrs = AttributeSystem.exportAttributes();
    if (mode.attrCellH === 1) {
      attrs = this._interleaveAttrs(attrs, mode);
    }
    scrData.set(attrs, this.BITMAP_SIZE);

    // ULAplus variant: the 64 palette registers follow the attributes
    if (mode.paletteModel === 'ulaplus64' && window.ColorManager) {
      scrData.set(ColorManager.getUlaplusRegisters(),
        this.BITMAP_SIZE + this.ATTR_SIZE);
    }

    Logger.info('SCRFormat', `Exported SCR (${this.FILE_SIZE} bytes)`);
    return scrData;
  }

  /**
   * Reorder an 8×1 attribute block from the ULA interleave (Timex SCREEN$
   * order — one 32-byte row per pixel line at the bitmap's line offsets)
   * into linear rows for AttributeSystem.
   * @param {Uint8Array} attrs - Interleaved attribute block (mode.attrSize)
   * @param {Object} mode - 8×1 mode descriptor
   * @returns {Uint8Array}
   * @private
   */
  _deinterleaveAttrs(attrs, mode) {
    const cols = mode.width / mode.attrCellW;
    const out = new Uint8Array(attrs.length);
    for (let y = 0; y < mode.height; y++) {
      const lineBase = AttributeSystem._lineOffset(y);
      for (let x = 0; x < cols; x++) {
        out[y * cols + x] = attrs[lineBase + x];
      }
    }
    return out;
  }

  /**
   * The reverse of _deinterleaveAttrs — linear attribute rows into the
   * Timex SCREEN$ interleave.
   * @private
   */
  _interleaveAttrs(attrs, mode) {
    const cols = mode.width / mode.attrCellW;
    const out = new Uint8Array(attrs.length);
    for (let y = 0; y < mode.height; y++) {
      const lineBase = AttributeSystem._lineOffset(y);
      for (let x = 0; x < cols; x++) {
        out[lineBase + x] = attrs[y * cols + x];
      }
    }
    return out;
  }

  /**
   * Load one screen's bitmap + attribute blocks into a specific layer
   * (GigaScreen sub-screen import path). The caller owns the undo action,
   * mode switch and recompose.
   * @param {Uint8Array} bitmap - Interleaved bitmap block
   * @param {Uint8Array} attrs - Linear attribute block
   * @param {Layer} layer - Target layer
   */
  loadScreenIntoLayer(bitmap, attrs, layer) {
    AttributeSystem.importBitmap(bitmap);
    AttributeSystem.importAttributes(attrs);
    this._syncToLayer(layer);
  }

  /**
   * Serialize one flattened layer as bitmap + linear attribute bytes
   * (GigaScreen sub-screen export path — 6912 bytes per sub-screen in
   * 8×8 modes).
   * @param {Layer} layer - Flattened source layer
   * @returns {Uint8Array}
   */
  screenBytesFromLayer(layer) {
    this._syncFromLayer(layer);
    const out = new Uint8Array(this.BITMAP_SIZE + this.ATTR_SIZE);
    out.set(AttributeSystem.exportBitmap(), 0);
    out.set(AttributeSystem.exportAttributes(), this.BITMAP_SIZE);
    return out;
  }

  /**
   * Export and trigger browser download (via the one FormatRegistry path)
   * @param {string} filename - Filename for download
   */
  async exportAndDownload(filename = 'image.scr', options = {}, handle = null) {
    const name = filename.endsWith('.scr') ? filename : `${filename}.scr`;
    return FormatRegistry.download(this.export(), name, undefined, handle);
  }

  /**
   * Sync AttributeSystem cells to a layer
   * @param {Layer} layer - Target layer
   * @private
   */
  _syncToLayer(layer) {
    for (let cellY = 0; cellY < ZX_SPECTRUM.GRID_ROWS; cellY++) {
      for (let cellX = 0; cellX < ZX_SPECTRUM.GRID_COLS; cellX++) {
        const attrCell = AttributeSystem.getCell(cellX, cellY);
        if (attrCell) {
          layer.setCell(cellX, cellY, {
            ink: attrCell.ink,
            paper: attrCell.paper,
            bright: attrCell.bright,
            flash: attrCell.flash,
            pixels: new Uint8Array(attrCell.pixels)
          });
        }
      }
    }
  }

  /**
   * Sync layer data to AttributeSystem
   * @param {Layer} layer - Source layer
   * @private
   */
  _syncFromLayer(layer) {
    for (let cellY = 0; cellY < ZX_SPECTRUM.GRID_ROWS; cellY++) {
      for (let cellX = 0; cellX < ZX_SPECTRUM.GRID_COLS; cellX++) {
        const layerCell = layer.getCell(cellX, cellY);
        if (layerCell) {
          AttributeSystem.setCell(cellX, cellY, {
            ink: layerCell.ink,
            paper: layerCell.paper,
            bright: layerCell.bright,
            flash: layerCell.flash,
            pixels: new Uint8Array(layerCell.pixels)
          });
        }
      }
    }
  }
}

// Create singleton
window.SCRFormat = new SCRFormatClass();

Logger.debug('SCRFormat', 'SCR format handler loaded');

})(); // End IIFE
