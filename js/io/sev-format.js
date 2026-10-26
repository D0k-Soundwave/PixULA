'use strict';
(function() {

/**
 * SEV Format Handler — SevenuP native graphics format (.sev)
 *
 * Spec source: SevenuP 1.21 by Jaime Tejedor Gómez (Metalbrain), GPL source
 * (OpenFile.cpp load/save routines + SP_Graph.h cell layout):
 *
 *   offset 0..3   signature 'S','e','v',0x00
 *   offset 4..5   version bytes: 0,0 (v0.0) | 0,6 (v0.6) | 0,8 (v0.8)
 *   offset 6..7   properties P1, little-endian: 1 = plain, 2 = masked
 *   offset 8..9   P2 = frame count - 1, little-endian (0..31)
 *   offset 10..11 pixel width  SX, little-endian (≤ 256)
 *   offset 12..13 pixel height SY, little-endian (≤ 192)
 *   offset 14..   per frame: ceil(SX/8)*ceil(SY/8) cells in row-major order,
 *                 each 8 bitmap bytes (rows top->bottom, bit 7 = leftmost)
 *                 followed by 1 standard ZX attribute byte; if P1 == 2 the
 *                 frame is followed by 8 mask bytes per cell (no attributes).
 *
 * Export writes a full-screen single-frame v0.8 file (P1=1, P2=0).
 * Import accepts all three versions, loads the FIRST frame and ignores any
 * mask/extra frames (documented assumption — we have no mask/sprite model);
 * graphics smaller than the screen land at the top-left on a blank screen
 * with SevenuP's default attribute 0x38 (black ink on white paper).
 */
class SEVFormatClass {
  constructor() {
    this.DEFAULT_ATTR = 0x38;
    // A .sev holds a CLASSIC 256x192 8x8 screen, and the import path has no
    // mode gate - it can be reached while any document is open. So its
    // geometry is PINNED to STANDARD_ULA rather than read from the live
    // ZX_SPECTRUM views, which follow the active mode. Reading them meant a
    // 6976-byte buffer in ULAplus whose trailing 64 bytes - the palette
    // block SCRFormat reads back - were filled with the default attribute,
    // so loading one silently replaced the artist's ULAplus palette with a
    // flat grey; in an indexed mode the cell offsets were computed against a
    // screen up to ten times the size.
    this.SCREEN_SIZE = SCREEN_MODES.STANDARD_ULA.fileSize;
    this.BITMAP_SIZE = SCREEN_MODES.STANDARD_ULA.bitmapSize;
    this.CELL = SCREEN_MODES.STANDARD_ULA.attrCellH;
    this.COLS = SCREEN_MODES.STANDARD_ULA.width / SCREEN_MODES.STANDARD_ULA.attrCellW;
    this.ROWS = SCREEN_MODES.STANDARD_ULA.height / SCREEN_MODES.STANDARD_ULA.attrCellH;
  }

  /**
   * Initialize and register with FormatRegistry
   */
  initialize() {
    FormatRegistry.registerImport('sev', this);
    FormatRegistry.registerExport('sev', this);
    Logger.info('SEVFormat', 'Initialized');
  }

  /**
   * Parse SEV file data (import)
   * @param {ArrayBuffer} buffer - File data
   * @returns {Object} { success: true } or { success: false, error: string }
   */
  parse(buffer) {
    const decoded = this.decodeToScreen(new Uint8Array(buffer));
    if (!decoded.success) return decoded;

    const result = SCRFormat.parse(decoded.scr.buffer);
    if (result.success) {
      Logger.info('SEVFormat', 'SEV file loaded successfully');
      EventBus.emit(EVENTS.FILE_IMPORT, { format: 'sev' });
    }
    return result;
  }

  /**
   * Export the current image as SEV bytes.
   * @returns {Uint8Array} Complete SEV file (v0.8, single frame, no mask)
   */
  /**
   * Whether export() would succeed in the active mode — the non-throwing
   * mirror used to filter the Save dialogs before the artist picks a
   * format.
   * @returns {boolean}
   */
  canExport() {
    return Helpers.hasStandardScreenLayout();
  }

  export(options = {}) {
    // SEV is a standard-layout format (8+1-byte 8×8 cells) — Phase 12a gate
    Helpers.assertStandardScreenLayout();
    const sev = this.encodeScreen(
      SCRFormat.export().subarray(0, SCREEN_MODES.STANDARD_ULA.fileSize), this.cellRectOf(options.rect));
    Logger.info('SEVFormat', `Exported SEV (${sev.length} bytes)`);
    return sev;
  }

  /**
   * Export and trigger browser download (via the one FormatRegistry path)
   * @param {string} filename - Filename
   */
  async exportAndDownload(filename = 'image.sev', options = {}, handle = null) {
    const name = filename.endsWith('.sev') ? filename : `${filename}.sev`;
    return FormatRegistry.download(this.export(options), name, undefined, handle);
  }

  /**
   * A pixel rectangle (Save Selection As) as the whole cells it covers: {cx, cy, cols, rows}. Null for the whole screen.
   * Throws if the rectangle is not on cell boundaries.
   * @param {?{x:number,y:number,width:number,height:number}} rect
   */
  cellRectOf(rect) {
    if (!rect) return null;
    const C = ZX_SPECTRUM.CELL_SIZE;
    if (rect.x % C || rect.y % C || rect.width % C || rect.height % C) throw new Error('SEV: the part to save must be whole cells');
    return { cx: rect.x / C, cy: rect.y / C, cols: rect.width / C, rows: rect.height / C };
  }

  // ── Pure byte math (Node-tested) ─────────────────────────────────────────

  /**
   * Encode SCR-format screen bytes as a full-screen SEV file.
   * @param {Uint8Array} scr - SCR screen bytes (bitmap + attributes)
   * @param {?{cx:number,cy:number,cols:number,rows:number}} [part] - a block of cells to write (default: the whole screen)
   * @returns {Uint8Array}
   */
  encodeScreen(scr, part = null) {
    const COLS = ZX_SPECTRUM.GRID_COLS;
    const CELL = ZX_SPECTRUM.CELL_SIZE;
    const p0 = part || { cx: 0, cy: 0, cols: COLS, rows: ZX_SPECTRUM.GRID_ROWS };
    const W = p0.cols * CELL, H = p0.rows * CELL;

    const out = new Uint8Array(14 + p0.cols * p0.rows * (CELL + 1));
    out[0] = 0x53; out[1] = 0x65; out[2] = 0x76; out[3] = 0x00; // "Sev\0"
    out[4] = 0; out[5] = 8;         // v0.8
    out[6] = 1; out[7] = 0;         // P1 = 1 (plain graphic)
    out[8] = 0; out[9] = 0;         // P2 = 0 (single frame)
    out[10] = W & 0xFF; out[11] = (W >> 8) & 0xFF;
    out[12] = H & 0xFF; out[13] = (H >> 8) & 0xFF;

    let p = 14;
    for (let cy = p0.cy; cy < p0.cy + p0.rows; cy++) {
      for (let cx = p0.cx; cx < p0.cx + p0.cols; cx++) {
        for (let j = 0; j < CELL; j++) {
          out[p++] = scr[this._scrRowOffset(cx, cy, j)];
        }
        out[p++] = scr[ZX_SPECTRUM.BITMAP_SIZE + cy * COLS + cx];
      }
    }
    return out;
  }

  /**
   * Decode SEV bytes to full-screen SCR bytes (first frame, mask ignored).
   * @param {Uint8Array} bytes - Complete SEV file
   * @returns {{success: boolean, error?: string, scr?: Uint8Array}}
   */
  decodeToScreen(bytes) {
    if (bytes.length < 14 ||
        bytes[0] !== 0x53 || bytes[1] !== 0x65 || bytes[2] !== 0x76 || bytes[3] !== 0x00) {
      return { success: false, error: Helpers.localizedMessage('err.badSignature',
          'Not a {format} file (bad signature)', { format: 'SevenuP' }) };
    }
    if (bytes[4] !== 0 || ![0, 6, 8].includes(bytes[5])) {
      return { success: false, error: Helpers.localizedMessage('err.sevVersion',
          'Unsupported SevenuP version {version}', { version: `${bytes[4]}.${bytes[5]}` }) };
    }

    const u16 = (p) => bytes[p] | (bytes[p + 1] << 8);
    const p1 = u16(6), p2 = u16(8), sx = u16(10), sy = u16(12);

    if (p1 < 1 || p1 > 2 || p2 > 31 ||
        sx < 1 || sy < 1 ||
        sx > SCREEN_MODES.STANDARD_ULA.width || sy > SCREEN_MODES.STANDARD_ULA.height) {
      return { success: false, error: Helpers.localizedMessage('err.sevHeader',
          'Invalid SEV header fields') };
    }

    const CELL = this.CELL;
    const COLS = this.COLS;
    const cSX = Math.ceil(sx / CELL);
    const cSY = Math.ceil(sy / CELL);
    const frameBytes = cSX * cSY * (CELL + 1);

    if (14 + frameBytes > bytes.length) {
      return { success: false, error: Helpers.localizedMessage('err.sevTruncated', 'Truncated SEV file') };
    }

    const scr = new Uint8Array(this.SCREEN_SIZE);
    scr.fill(this.DEFAULT_ATTR, this.BITMAP_SIZE);

    let p = 14; // first frame only
    for (let cy = 0; cy < cSY; cy++) {
      for (let cx = 0; cx < cSX; cx++) {
        for (let j = 0; j < CELL; j++) {
          scr[this._scrRowOffset(cx, cy, j)] = bytes[p++];
        }
        scr[this.BITMAP_SIZE + cy * COLS + cx] = bytes[p++];
      }
    }
    return { success: true, scr };
  }

  /**
   * SCR bitmap offset of row j (0-7) inside attribute cell (cx, cy) —
   * the interleaved ULA layout, derived from the mode descriptor.
   * @private
   */
  _scrRowOffset(cx, cy, j) {
    return AttributeSystem._lineOffset(cy * this.CELL + j) + cx;
  }
}

// Create singleton
window.SEVFormat = new SEVFormatClass();

Logger.debug('SEVFormat', 'SEV format handler loaded');

})(); // End IIFE
