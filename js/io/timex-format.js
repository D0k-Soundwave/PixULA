'use strict';
(function() {

/**
 * Timex hi-res screen formats (Phase 12b) — the 512×192 monochrome mode's
 * containers. Byte layouts follow RECOIL, the ecosystem's reference decoder
 * (recoil.c, RECOIL_DecodeTimexHires / RECOIL_DecodeHrg):
 *
 *   .scr (12289, via SCRFormat) — the two 6144-byte Timex display files
 *        back to back, each in the standard ULA interleave; display file 1
 *        supplies the EVEN 8-pixel columns of the 512-wide screen, display
 *        file 2 the ODD ones. The final byte is the Timex port 0xFF value:
 *        bits 3–5 = the ink colour, bits 0–2 = the screen-mode bits (we
 *        write 110 = hi-res). Paper is always the ink's complement and both
 *        render at BRIGHT levels (RECOIL renders hi-res fully saturated).
 *   .hrg (24578, import + export) — two 12289-byte hi-res screens (a
 *        GigaScreen hi-res pair, RECOIL blends them). We have no hi-res
 *        flicker mode, so IMPORT reads the FIRST sub-screen and drops the
 *        second (documented loss); EXPORT writes the same screen twice —
 *        two identical frames blend to exactly the exported image, and the
 *        file round-trips through our own import.
 *
 * Timex hi-COLOUR (8×1 attributes) is deliberately NOT a separate mode or
 * handler: its cell model is MULTICOLOR_8x1 (ZX-Paintbrush itself treats
 * 8×1 as "Timex format") — only its .scr container differs from .mlt by
 * storing the attribute block in the SAME ULA interleave as the bitmap
 * (RECOIL DecodeScr case 12288, attributesMode -1). That container, and
 * its 12352 ULAplus variant, live in SCRFormat.
 *
 * Exports gate on the active mode being Timex hi-res — any other mode
 * would need a lossy mono conversion, which the user performs explicitly
 * by switching modes first.
 *
 * Importing switches the document to Timex hi-res (raw switch inside the
 * undo action — one Undo restores the previous mode + content). The grid
 * write bypasses PixelDrawRoutine like every io/ codec (documented bulk
 * exception): it runs inside beginAction/endAction, marks cells altered,
 * and recomposes.
 */
class TimexFormatClass {

  initialize() {
    FormatRegistry.registerImport('hrg', this._adapter());
    FormatRegistry.registerExport('hrg', this._adapter());
    Logger.info('TimexFormat', 'Initialized (hrg; scr 12289 via SCRFormat)');
  }

  /** Registry adapter — the registry passes no extension to parse(). @private */
  _adapter() {
    return {
      parse: (buffer) => this.parseHrg(buffer),
      export: () => this.exportHrg(),
      exportAndDownload: (filename) => this.exportAndDownloadHrg(filename)
    };
  }

  // ── Import ────────────────────────────────────────────────────────────────

  /**
   * Parse a .hrg GigaScreen hi-res pair — the first sub-screen becomes the
   * document (the second is dropped; we have no hi-res flicker mode).
   * @param {ArrayBuffer} buffer
   * @returns {Object} { success } | { success: false, error }
   */
  parseHrg(buffer) {
    const bytes = new Uint8Array(buffer);
    const HIRES = SCREEN_MODES.TIMEX_HIRES;
    if (bytes.length !== HIRES.fileSize * 2) {
      return {
        success: false,
        error: `Invalid .hrg file size: ${bytes.length} bytes (expected ${HIRES.fileSize * 2})`
      };
    }
    return this.importHires(bytes.subarray(0, HIRES.fileSize), 'Load HRG');
  }

  /**
   * Shared hi-res import path (also used by SCRFormat for the 12289
   * variant): switches the document to Timex hi-res inside the undo
   * action, applies the port byte's colour scheme, and writes the decoded
   * grid into the current layer.
   * @param {Uint8Array} bytes - One 12289-byte hi-res screen
   * @param {string} label - Undo action label
   * @returns {Object} { success } | { success: false, error }
   */
  importHires(bytes, label) {
    const HIRES = SCREEN_MODES.TIMEX_HIRES;
    UndoRedoService.beginAction(label);

    if (window.ScreenModeService && ScreenModeService.getModeId() !== HIRES.id) {
      ScreenModeService.applyModeRaw(HIRES.id);
    }

    const ink = (bytes[HIRES.bitmapSize] >> 3) & 7;
    if (window.ColorManager) ColorManager.setTimexHiresInk(ink);

    const layer = LayerManager.getCurrentLayer();
    if (!layer) {
      if (typeof UndoRedoService.cancelAction === 'function') UndoRedoService.cancelAction();
      else UndoRedoService.endAction();
      return { success: false, error: 'No active layer' };
    }

    // Store the scheme's colours in the cells too — hi-res ignores them at
    // render, but leaving the mode stamps this same scheme, so the stored
    // attrs never contradict what the user saw.
    const rows = this.decodeHiresRows(bytes);
    for (let cy = 0; cy < rows.length; cy++) {
      for (let cx = 0; cx < rows[cy].length; cx++) {
        layer.setCell(cx, cy, {
          ink,
          paper: ink ^ 7,
          bright: true,
          flash: false,
          pixels: rows[cy][cx]
        });
      }
    }

    LayerManager.composeToCanvas();
    UndoRedoService.endAction();

    Logger.info('TimexFormat', 'Hi-res screen loaded');
    EventBus.emit(EVENTS.FILE_IMPORT, { format: 'hrg' });
    return { success: true };
  }

  // ── Export ────────────────────────────────────────────────────────────────

  /**
   * Export the composited document as one 12289-byte hi-res screen.
   * Gates unless the document IS in Timex hi-res mode.
   * @returns {Uint8Array}
   */
  exportHires() {
    if (ACTIVE_SCREEN_MODE.paletteModel !== 'timexMono') {
      throw new Error(Helpers.localizedMessage('mode.exportNeedsHires',
        'This format holds Timex hi-res screens — switch to Timex hi-res mode first.'));
    }
    const flattened = LayerManager.flattenVisible();
    const rows = flattened.attributeData.map(row => row.map(c => c.pixels));
    const ink = window.ColorManager ? ColorManager.getTimexHiresInk() : 0;
    return this.encodeHiresRows(rows, ink);
  }

  /** Export the .hrg pair — the same screen twice (blends to itself). */
  exportHrg() {
    const scr = this.exportHires();
    const out = new Uint8Array(scr.length * 2);
    out.set(scr, 0);
    out.set(scr, scr.length);
    return out;
  }

  /** @param {string} filename */
  exportAndDownloadHrg(filename) {
    let name = filename || 'image.hrg';
    if (!name.toLowerCase().endsWith('.hrg')) name = `${name}.hrg`;
    FormatRegistry.download(this.exportHrg(), name);
  }

  // ── Pure byte math (Node-tested) ──────────────────────────────────────────

  /**
   * The ULA screen-memory offset of pixel line y (same interleave as the
   * standard bitmap — each Timex display file uses it independently).
   * @private
   */
  _lineOffset(y) {
    return ((y & 0xC0) << 5) + ((y & 0x07) << 8) + ((y & 0x38) << 2);
  }

  /**
   * Decode a 12289-byte hi-res screen into cell pixel rows: 24 rows × 64
   * byte-columns of Uint8Array(8). Byte column X reads display file X&1
   * at inner column X>>1 (even columns = file 1, odd = file 2).
   * @param {Uint8Array} bytes
   * @returns {Uint8Array[][]} [cellY][cellX] = 8 row bytes
   */
  decodeHiresRows(bytes) {
    const HIRES = SCREEN_MODES.TIMEX_HIRES;
    const cols = HIRES.width / HIRES.attrCellW;
    const cellRows = HIRES.height / HIRES.attrCellH;
    const fileSize = HIRES.bitmapSize / 2;
    const out = [];
    for (let cy = 0; cy < cellRows; cy++) {
      const row = [];
      for (let cx = 0; cx < cols; cx++) row.push(new Uint8Array(HIRES.attrCellH));
      out.push(row);
    }
    for (let y = 0; y < HIRES.height; y++) {
      const lineBase = this._lineOffset(y);
      for (let X = 0; X < cols; X++) {
        const src = (X & 1) * fileSize + lineBase + (X >> 1);
        out[y >> 3][X][y & 7] = bytes[src];
      }
    }
    return out;
  }

  /**
   * Encode cell pixel rows (24 × 64 × Uint8Array(8), or an attributeData
   * grid's pixels) into the 12289-byte hi-res screen.
   * @param {Uint8Array[][]} rows - [cellY][cellX] = 8 row bytes
   * @param {number} ink - Scheme ink colour 0–7 (port byte bits 3–5)
   * @returns {Uint8Array}
   */
  encodeHiresRows(rows, ink) {
    const HIRES = SCREEN_MODES.TIMEX_HIRES;
    const cols = HIRES.width / HIRES.attrCellW;
    const fileSize = HIRES.bitmapSize / 2;
    const out = new Uint8Array(HIRES.fileSize);
    for (let y = 0; y < HIRES.height; y++) {
      const lineBase = this._lineOffset(y);
      for (let X = 0; X < cols; X++) {
        out[(X & 1) * fileSize + lineBase + (X >> 1)] = rows[y >> 3][X][y & 7];
      }
    }
    // Port 0xFF value: mode bits 110 (hi-res) + the ink colour in bits 3–5
    out[HIRES.bitmapSize] = 0x06 | ((ink & 7) << 3);
    return out;
  }
}

// Create singleton
window.TimexFormat = new TimexFormatClass();

Logger.debug('TimexFormat', 'Timex format handler loaded');

})(); // End IIFE
