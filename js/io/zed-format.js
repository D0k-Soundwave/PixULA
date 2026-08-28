'use strict';
(function() {

/**
 * ZED Format Handler — ZX-Editor document format (.zed)
 *
 * Spec source: the official "ZED text format" page on Claus Jahn's
 * ZX-Modules site (ZX-Edit DOS document, v1.00 by Claus Jahn & Andreas
 * Schraepel, 1997):
 *
 *   offset 0..52  53-byte signature
 *                 "Editor file for ZX-Edit (C) 1997 by Claus & Andy - V."
 *   offset 53..56 version "1.00"
 *   offset 57     0x1A (EOF separator)
 *   offset 58..   document: [line count u16] then per line
 *                 [line size u16][content], followed by an (optionally
 *                 empty) embedded font list (2082 bytes per font).
 *
 * Line content is text plus control codes; the two that carry graphics:
 *   #29 (0x1D) coloured 8x8 block: 8 pixel bytes + 1 ZX attribute byte
 *   #28 (0x1C) transparent 8x8 block: 8 pixel bytes, no attribute
 *
 * Export writes a pure-graphics document: one editor line per attribute
 * row, each line = one #29 block per column, no embedded fonts.
 *
 * Documented assumptions (chosen to round-trip our own output):
 * - u16 fields are little-endian (DOS-era format, matches every other
 *   ZX-Modules structure with byte-order stated).
 * - On import only #28/#29 blocks are rasterized; text characters and the
 *   in-line INK/PAPER/etc. state advance the cell cursor but are not
 *   rendered (we import pictures, not documents). #28 blocks get the
 *   default attribute 0x38.
 * - Editor line N maps to attribute row N; lines/columns beyond the screen
 *   are parsed for length but not placed.
 */
class ZEDFormatClass {
  constructor() {
    this.SIGNATURE = 'Editor file for ZX-Edit (C) 1997 by Claus & Andy - V.';
    this.VERSION = '1.00';
    this.DEFAULT_ATTR = 0x38;
  }

  /**
   * Initialize and register with FormatRegistry
   */
  initialize() {
    FormatRegistry.registerImport('zed', this);
    FormatRegistry.registerExport('zed', this);
    Logger.info('ZEDFormat', 'Initialized');
  }

  /**
   * Parse ZED file data (import)
   * @param {ArrayBuffer} buffer - File data
   * @returns {Object} { success: true } or { success: false, error: string }
   */
  parse(buffer) {
    const decoded = this.decodeToScreen(new Uint8Array(buffer));
    if (!decoded.success) return decoded;

    const result = SCRFormat.parse(decoded.scr.buffer);
    if (result.success) {
      Logger.info('ZEDFormat', 'ZED file loaded successfully');
      EventBus.emit(EVENTS.FILE_IMPORT, { format: 'zed' });
    }
    return result;
  }

  /**
   * Export the current image as ZED bytes.
   * @returns {Uint8Array} Complete ZED document
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

  export() {
    // ZED is a standard-layout format (24 lines × 32 cells) — Phase 12a gate
    Helpers.assertStandardScreenLayout();
    const zed = this.encodeScreen(
      SCRFormat.export().subarray(0, SCREEN_MODES.STANDARD_ULA.fileSize));
    Logger.info('ZEDFormat', `Exported ZED (${zed.length} bytes)`);
    return zed;
  }

  /**
   * Export and trigger browser download (via the one FormatRegistry path)
   * @param {string} filename - Filename
   */
  async exportAndDownload(filename = 'image.zed', options = {}, handle = null) {
    const name = filename.endsWith('.zed') ? filename : `${filename}.zed`;
    return FormatRegistry.download(this.export(), name, undefined, handle);
  }

  // ── Pure byte math (Node-tested) ─────────────────────────────────────────

  /**
   * Encode SCR-format screen bytes as a graphics-only ZED document.
   * @param {Uint8Array} scr - SCR screen bytes (bitmap + attributes)
   * @returns {Uint8Array}
   */
  encodeScreen(scr) {
    const COLS = ZX_SPECTRUM.GRID_COLS, ROWS = ZX_SPECTRUM.GRID_ROWS;
    const CELL = ZX_SPECTRUM.CELL_SIZE;
    const lineSize = COLS * (1 + CELL + 1); // per column: #29 + pixels + attr
    const out = new Uint8Array(58 + 2 + ROWS * (2 + lineSize));

    let p = 0;
    for (const ch of this.SIGNATURE) out[p++] = ch.charCodeAt(0);
    for (const ch of this.VERSION) out[p++] = ch.charCodeAt(0);
    out[p++] = 0x1A;

    out[p++] = ROWS & 0xFF;
    out[p++] = (ROWS >> 8) & 0xFF;

    for (let cy = 0; cy < ROWS; cy++) {
      out[p++] = lineSize & 0xFF;
      out[p++] = (lineSize >> 8) & 0xFF;
      for (let cx = 0; cx < COLS; cx++) {
        out[p++] = 0x1D; // coloured 8x8 block
        for (let j = 0; j < CELL; j++) {
          out[p++] = scr[this._scrRowOffset(cx, cy, j)];
        }
        out[p++] = scr[ZX_SPECTRUM.BITMAP_SIZE + cy * COLS + cx];
      }
    }
    // No embedded fonts appended (empty font list)
    return out;
  }

  /**
   * Decode ZED bytes to full-screen SCR bytes (graphics blocks only).
   * @param {Uint8Array} bytes - Complete ZED file
   * @returns {{success: boolean, error?: string, scr?: Uint8Array}}
   */
  decodeToScreen(bytes) {
    const sigLen = this.SIGNATURE.length; // 53
    // Accept any version tail after the shared prefix — be lenient on the
    // trailing "- V." vs a concrete version marker.
    const prefix = 'Editor file for ZX-Edit';
    if (bytes.length < 60 ||
        String.fromCharCode(...bytes.slice(0, prefix.length)) !== prefix ||
        bytes[sigLen + 4] !== 0x1A) {
      return { success: false, error: 'Not a ZX-Editor file (bad signature)' };
    }

    const COLS = ZX_SPECTRUM.GRID_COLS, ROWS = ZX_SPECTRUM.GRID_ROWS;
    const CELL = ZX_SPECTRUM.CELL_SIZE;
    const u16 = (p) => bytes[p] | (bytes[p + 1] << 8);

    const scr = new Uint8Array(ZX_SPECTRUM.SCR_FILE_SIZE);
    scr.fill(this.DEFAULT_ATTR, ZX_SPECTRUM.BITMAP_SIZE);

    let p = sigLen + 5; // after signature + version + 0x1A
    const lineCount = u16(p);
    p += 2;
    let sawBlock = false;

    for (let line = 0; line < lineCount && p + 2 <= bytes.length; line++) {
      const size = u16(p);
      p += 2;
      const end = Math.min(p + size, bytes.length);
      let col = 0;

      while (p < end) {
        const code = bytes[p];
        if (code === 0x1D && p + 1 + CELL + 1 <= end) { // coloured block
          this._placeBlock(scr, col, line, bytes.subarray(p + 1, p + 1 + CELL),
            bytes[p + 1 + CELL]);
          sawBlock = true;
          p += 1 + CELL + 1;
          col++;
        } else if (code === 0x1C && p + 1 + CELL <= end) { // transparent block
          this._placeBlock(scr, col, line, bytes.subarray(p + 1, p + 1 + CELL),
            this.DEFAULT_ATTR);
          sawBlock = true;
          p += 1 + CELL;
          col++;
        } else if (code >= 0x10 && code <= 0x15) { // INK..OVER <value>
          p += 2;
        } else if (code === 0x19) { // font no.
          p += 2;
        } else if (code === 0x1B) { // font style <flag><value>
          p += 3;
        } else if (code >= 0x20) { // text character occupies a cell
          p += 1;
          col++;
        } else { // reserved/cursor codes — skip a byte to stay in sync
          p += 1;
        }
      }
      p = end;
    }

    if (!sawBlock) {
      return { success: false, error: 'No graphics blocks in ZED file' };
    }
    return { success: true, scr };
  }

  /**
   * Place an 8x8 block into SCR bytes at cell (cx, cy); out-of-screen
   * positions are ignored.
   * @private
   */
  _placeBlock(scr, cx, cy, pixelRows, attr) {
    if (cx < 0 || cy < 0 || cx >= ZX_SPECTRUM.GRID_COLS || cy >= ZX_SPECTRUM.GRID_ROWS) return;
    for (let j = 0; j < ZX_SPECTRUM.CELL_SIZE; j++) {
      scr[this._scrRowOffset(cx, cy, j)] = pixelRows[j];
    }
    scr[ZX_SPECTRUM.BITMAP_SIZE + cy * ZX_SPECTRUM.GRID_COLS + cx] = attr;
  }

  /**
   * SCR bitmap offset of row j (0-7) inside attribute cell (cx, cy) —
   * the interleaved ULA layout, derived from the mode descriptor.
   * @private
   */
  _scrRowOffset(cx, cy, j) {
    return AttributeSystem._lineOffset(cy * ZX_SPECTRUM.CELL_HEIGHT + j) + cx;
  }
}

// Create singleton
window.ZEDFormat = new ZEDFormatClass();

Logger.debug('ZEDFormat', 'ZED format handler loaded');

})(); // End IIFE
