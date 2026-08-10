'use strict';
(function() {

/**
 * Multicolor screen formats (Phase 12a) — the SCR-family size variants for
 * the 8×1 and 8×2 attribute modes. Byte layouts follow RECOIL, the
 * ecosystem's reference decoder (recoil.c), which decodes all of them:
 *
 *   .mlt (12288, import + export) — RECOIL_DecodeMcMlt(bitmapOffset 0):
 *        standard INTERLEAVED 6144-byte bitmap, then 6144 LINEAR attribute
 *        bytes (one 32-byte row per pixel line). This is ZX-Paintbrush's
 *        "Timex screen file" — its container for 8×1 attribute pictures.
 *   .mc  (12288, import only) — RECOIL_DecodeMcMlt(bitmapOffset -1):
 *        same as .mlt but the bitmap is LINEAR (row y at offset y*32).
 *   .ifl (9216, import + export) — RECOIL_DecodeZxIfl: interleaved bitmap,
 *        then 3072 linear attribute bytes (one row per TWO pixel lines —
 *        the 8×2 mode).
 *
 * (8×4 has no established single-screen interchange format — ZX-Paintbrush
 * stores it only inside .zxp; our autosave and dev exports carry it.)
 *
 * Importing switches the document to the variant's screen mode (raw switch
 * inside the undo action — one Undo restores the previous mode + content);
 * the heavy lifting is shared with SCRFormat.importScreen.
 *
 * Exporting CONVERTS the composited document to the variant's attribute
 * geometry with the ScreenModeService rules WITHOUT touching the document:
 * refining is lossless, so .mlt saves from any fixed16 mode and .ifl from
 * any mode with cells at least 2 px tall; a save that would coarsen
 * (8×1 -> .ifl) or drop the ULAplus palette gates with a localized error
 * instead of silently losing data.
 */
class MulticolorFormatClass {

  initialize() {
    FormatRegistry.registerImport('mlt', this._adapter('mlt'));
    FormatRegistry.registerExport('mlt', this._adapter('mlt'));
    FormatRegistry.registerImport('mc', this._adapter('mc'));
    FormatRegistry.registerImport('ifl', this._adapter('ifl'));
    FormatRegistry.registerExport('ifl', this._adapter('ifl'));
    Logger.info('MulticolorFormat', 'Initialized (mlt/mc/ifl)');
  }

  /** Registry adapter — the registry passes no extension to parse(). @private */
  _adapter(ext) {
    return {
      parse: (buffer) => this.parse(ext, buffer),
      export: () => this.export(ext),
      exportAndDownload: (filename) => this.exportAndDownload(ext, filename)
    };
  }

  // ── Import ────────────────────────────────────────────────────────────────

  /**
   * Parse a multicolor screen file.
   * @param {string} ext - 'mlt' | 'mc' | 'ifl'
   * @param {ArrayBuffer} buffer
   * @returns {Object} { success } | { success: false, error }
   */
  parse(ext, buffer) {
    const bytes = new Uint8Array(buffer);
    const mode = ext === 'ifl'
      ? SCREEN_MODES.MULTICOLOR_8x2
      : SCREEN_MODES.MULTICOLOR_8x1;

    if (bytes.length !== mode.fileSize) {
      return {
        success: false,
        error: `Invalid .${ext} file size: ${bytes.length} bytes (expected ${mode.fileSize})`
      };
    }

    let bitmap = bytes.slice(0, mode.bitmapSize);
    if (ext === 'mc') {
      bitmap = this._linearToInterleaved(bitmap, mode);
    }
    const attrs = bytes.slice(mode.bitmapSize, mode.fileSize);

    return SCRFormat.importScreen(bitmap, attrs, mode.id, `Load ${ext.toUpperCase()}`);
  }

  // ── Export ────────────────────────────────────────────────────────────────

  /**
   * Export the composited document as the variant's bytes, converting the
   * attribute geometry (lossless refine) when the active mode is coarser.
   * @param {string} ext - 'mlt' | 'ifl'
   * @returns {Uint8Array}
   */
  export(ext) {
    const mode = ext === 'ifl'
      ? SCREEN_MODES.MULTICOLOR_8x2
      : SCREEN_MODES.MULTICOLOR_8x1;

    if (ACTIVE_SCREEN_MODE.paletteModel !== 'fixed16') {
      throw new Error(Helpers.localizedMessage('mode.formatNeedsFixed16',
        'This format needs the fixed 16-colour palette — switch out of ULAplus mode first.'));
    }
    if (ACTIVE_SCREEN_MODE.attrCellH < mode.attrCellH) {
      // Coarsening on the way out would silently lose colour detail
      throw new Error(Helpers.localizedMessage('mode.exportWouldCoarsen',
        'This document has finer colour detail than the chosen format can hold — switch modes first if you want the lossy conversion.'));
    }

    // Pure conversion of the composited grid to the variant's geometry —
    // the document itself is untouched
    const flattened = LayerManager.flattenVisible();
    const grid = ScreenModeService.convertAttributeData(
      flattened.attributeData, ACTIVE_SCREEN_MODE, mode);

    return this._serialize(grid, mode);
  }

  /**
   * @param {string} ext - 'mlt' | 'ifl'
   * @param {string} filename
   */
  exportAndDownload(ext, filename) {
    let name = filename || `image.${ext}`;
    if (!name.toLowerCase().endsWith(`.${ext}`)) name = `${name}.${ext}`;
    FormatRegistry.download(this.export(ext), name);
  }

  // ── Pure byte math (Node-tested) ──────────────────────────────────────────

  /**
   * The ULA screen-memory offset of pixel line y (same interleave as
   * AttributeSystem — kept local so this stays pure byte math).
   * @private
   */
  _lineOffset(y) {
    return ((y & 0xC0) << 5) + ((y & 0x07) << 8) + ((y & 0x38) << 2);
  }

  /**
   * Serialize an attributeData grid at the given mode's geometry to the
   * variant's bytes: interleaved bitmap + linear attribute rows.
   * @param {Array} grid - attributeData rows (mode geometry)
   * @param {Object} mode - Mode descriptor
   * @returns {Uint8Array}
   */
  _serialize(grid, mode) {
    const cols = mode.width / mode.attrCellW;
    const cellH = mode.attrCellH;
    const out = new Uint8Array(mode.fileSize);

    for (let y = 0; y < mode.height; y++) {
      const lineBase = this._lineOffset(y);
      const row = grid[Math.floor(y / cellH)];
      const rowInCell = y % cellH;
      for (let x = 0; x < cols; x++) {
        out[lineBase + x] = row[x].pixels[rowInCell];
      }
    }

    let p = mode.bitmapSize;
    for (let r = 0; r < grid.length; r++) {
      for (let x = 0; x < cols; x++) {
        const c = grid[r][x];
        out[p++] = (c.ink & 7) | ((c.paper & 7) << 3)
          | (c.bright ? 0x40 : 0) | (c.flash ? 0x80 : 0);
      }
    }
    return out;
  }

  /**
   * Reorder a LINEAR bitmap (.mc: row y at y*32) into the interleaved ULA
   * layout that the shared import path expects.
   * @param {Uint8Array} linear - 6144 linear bitmap bytes
   * @param {Object} mode - Mode descriptor
   * @returns {Uint8Array}
   * @private
   */
  _linearToInterleaved(linear, mode) {
    const cols = mode.width / mode.attrCellW;
    const out = new Uint8Array(linear.length);
    for (let y = 0; y < mode.height; y++) {
      const lineBase = this._lineOffset(y);
      for (let x = 0; x < cols; x++) {
        out[lineBase + x] = linear[y * cols + x];
      }
    }
    return out;
  }
}

// Create singleton
window.MulticolorFormat = new MulticolorFormatClass();

Logger.debug('MulticolorFormat', 'Multicolor format handler loaded');

})(); // End IIFE
