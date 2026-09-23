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
 *   .hrg (24578, import + export) — two 12289-byte hi-res screens, a
 *        flicker pair, each with its OWN port byte and so its own colour
 *        scheme (RECOIL DecodeHrg reads content[offset + 0x3000] per frame
 *        and blends). Since 2026-09-23 it imports whole into the
 *        TIMEX_HIRES_GIGA mode - both frames, both schemes; it used to drop
 *        the second. EXPORT from the pair mode writes each screen with its
 *        own scheme; from single-screen hi-res it writes the screen twice,
 *        which blends to exactly the exported image.
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
      canExport: () => this.canExport(),
      exportAndDownload: (filename, options, handle) => this.exportAndDownloadHrg(filename, handle)
    };
  }

  /**
   * Whether exportHrg()/exportHires() would succeed in the active mode —
   * the non-throwing mirror used to filter the Save dialogs before the
   * artist picks a format.
   * @returns {boolean}
   */
  canExport() {
    return ACTIVE_SCREEN_MODE.paletteModel === 'timexMono';
  }

  // ── Import ────────────────────────────────────────────────────────────────

  /**
   * Parse a .hrg hi-res flicker pair into the TIMEX_HIRES_GIGA mode: frame A
   * into the current layer's first plane with its scheme, frame B into the
   * second with its own.
   * @param {ArrayBuffer} buffer
   * @returns {Object} { success } | { success: false, error }
   */
  parseHrg(buffer) {
    const bytes = new Uint8Array(buffer);
    const HIRES = SCREEN_MODES.TIMEX_HIRES;
    const PAIR = SCREEN_MODES.TIMEX_HIRES_GIGA;
    if (bytes.length !== PAIR.fileSize) {
      return {
        success: false,
        error: `Invalid .hrg file size: ${bytes.length} bytes (expected ${PAIR.fileSize})`
      };
    }
    UndoRedoService.beginAction('Load HRG');
    if (window.ScreenModeService && ScreenModeService.getModeId() !== PAIR.id) {
      ScreenModeService.applyModeRaw(PAIR.id);
    }
    const layer = LayerManager.getCurrentLayer();
    if (!layer) {
      if (typeof UndoRedoService.cancelAction === 'function') UndoRedoService.cancelAction();
      else UndoRedoService.endAction();
      return { success: false, error: 'No active layer' };
    }
    const frameA = bytes.subarray(0, HIRES.fileSize);
    const frameB = bytes.subarray(HIRES.fileSize, PAIR.fileSize);
    const inkA = this._portInk(frameA);
    const inkB = this._portInk(frameB);
    if (window.ColorManager) {
      ColorManager.setTimexHiresInk(inkA);
      ColorManager.setTimexHiresInkB(inkB);
    }
    this._loadHiresFrame(frameA, layer, 0, inkA);
    this._loadHiresFrame(frameB, layer, 1, inkB);

    LayerManager.composeToCanvas();
    UndoRedoService.endAction();
    Logger.info('TimexFormat', 'Hi-res pair loaded');
    EventBus.emit(EVENTS.FILE_IMPORT, { format: 'hrg' });
    return { success: true };
  }

  /** The scheme ink (0-7) in a hi-res screen's port byte, bits 3-5. @private */
  _portInk(frame) {
    return (frame[SCREEN_MODES.TIMEX_HIRES.bitmapSize] >> 3) & 7;
  }

  /**
   * Write one decoded hi-res screen into a layer - screen A's fields, or
   * screen B's for plane 1. The scheme's colours go into the cells too:
   * hi-res ignores them at render, but leaving the mode stamps this same
   * scheme, so the stored attributes never contradict what the artist saw.
   * @private
   */
  _loadHiresFrame(frame, layer, plane, ink) {
    const rows = this.decodeHiresRows(frame);
    for (let cy = 0; cy < rows.length; cy++) {
      for (let cx = 0; cx < rows[cy].length; cx++) {
        layer.setCell(cx, cy, plane === 1 ? {
          inkB: ink, paperB: ink ^ 7, brightB: true, flashB: false, pixelsB: rows[cy][cx]
        } : {
          ink, paper: ink ^ 7, bright: true, flash: false, pixels: rows[cy][cx]
        });
      }
    }
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

    const ink = this._portInk(bytes);
    if (window.ColorManager) ColorManager.setTimexHiresInk(ink);

    const layer = LayerManager.getCurrentLayer();
    if (!layer) {
      if (typeof UndoRedoService.cancelAction === 'function') UndoRedoService.cancelAction();
      else UndoRedoService.endAction();
      return { success: false, error: 'No active layer' };
    }
    this._loadHiresFrame(bytes, layer, 0, ink);

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
    // One screen only: the pair's own container is .hrg (exportHrg).
    if (ACTIVE_SCREEN_MODE.paletteModel !== 'timexMono' || ZX_SPECTRUM.SCREENS !== 1) {
      throw new Error(Helpers.localizedMessage('mode.exportNeedsHires',
        'This format holds Timex hi-res screens — switch to Timex hi-res mode first.'));
    }
    const flattened = LayerManager.flattenVisible();
    const rows = flattened.attributeData.map(row => row.map(c => c.pixels));
    const ink = window.ColorManager ? ColorManager.getTimexHiresInk() : 0;
    return this.encodeHiresRows(rows, ink);
  }

  /**
   * Export the .hrg pair. From the pair mode each screen is written with its
   * own scheme; from single-screen hi-res the same screen twice (two
   * identical frames blend to exactly the exported image).
   * @returns {Uint8Array}
   */
  exportHrg() {
    if (ACTIVE_SCREEN_MODE.paletteModel !== 'timexMono') {
      throw new Error(Helpers.localizedMessage('mode.exportNeedsHires',
        'This format holds Timex hi-res screens — switch to Timex hi-res mode first.'));
    }
    if (ZX_SPECTRUM.SCREENS !== 2) {
      const scr = this.exportHires();
      const out = new Uint8Array(scr.length * 2);
      out.set(scr, 0);
      out.set(scr, scr.length);
      return out;
    }
    const flattened = LayerManager.flattenVisible();
    const a = this.encodeHiresRows(
      flattened.attributeData.map(row => row.map(c => c.pixels)),
      ColorManager.getTimexHiresInk());
    const b = this.encodeHiresRows(
      flattened.attributeData.map(row => row.map(c => c.pixelsB)),
      ColorManager.getTimexHiresInkB());
    const out = new Uint8Array(a.length + b.length);
    out.set(a, 0);
    out.set(b, a.length);
    return out;
  }

  /** @param {string} filename */
  async exportAndDownloadHrg(filename, handle = null) {
    let name = filename || 'image.hrg';
    if (!name.toLowerCase().endsWith('.hrg')) name = `${name}.hrg`;
    return FormatRegistry.download(this.exportHrg(), name, undefined, handle);
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
