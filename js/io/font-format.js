'use strict';
(function() {

/**
 * Sinclair Font Format Handler — .ch4 / .ch6 / .ch8 / .chr / .chx
 * (Phase 10 font editor; ZX-Paintbrush & ZX-Editor Second Edition
 * character-set files).
 *
 * All byte-level knowledge in one place. Sources, in evidence order:
 * the ZX-Paintbrush 2.6.1 CHM ("Creating and editing a character set" /
 * "... a big font set"), the ZX-Paintbrush exe's loader/saver strings,
 * the ZX-Modules fileformats table (CHR row: "2048 bytes (256 chars)"
 * and "768 bytes (96 chars)"; CHX row: "big font set (1..256 chars,
 * 8x8..32x32)"), and RECOIL's DecodeChx/DecodeCh8 (the only public
 * byte-accurate decoder). There is no official spec document; where the
 * evidence ran out we chose the interpretation that round-trips our own
 * output, noted per format below.
 *
 * CH4 / CH6 / CH8 — raw dumps, 2048 bytes = 256 characters × 8 row
 *   bytes, character order "extended ANSI" (i.e. byte code = character
 *   code), MSB = leftmost pixel. One byte per row in ALL three widths:
 *   ZX-Paintbrush edits every *.CH? set as a 128×128 picture (16×16
 *   grid of full 8×8 positions) and warns that only the first 4 (CH4)
 *   or 6 (CH6) pixel columns of each position are relevant — i.e. the
 *   narrow widths are stored padded, left-aligned, not bit-packed
 *   (RECOIL renders ch4/ch6/ch8 identically 8-wide for the same
 *   reason). Import rejects any other size, matching ZX-Paintbrush's
 *   "illegal character file format (wrong file size)". Export masks
 *   each row to the format's width. ASSUMPTION: a 96-char working font
 *   exports as a full 2048-byte dump with blanks outside 32..127 (the
 *   editor always saves all 256 positions).
 *
 * CHR — same raw dump, in two sizes: 2048 bytes (256 chars from code 0)
 *   or 768 bytes (96 chars starting at space, code 32 — the classic
 *   ZX-ROM-charset window). Import accepts both; export picks the size
 *   from the working font's coverage (96-char coverage -> 768 bytes),
 *   so coverage round-trips.
 *
 * CHX — ZX-Editor SE "big font set" (1..256 chars, each 1..4 × 1..4
 *   cells of 8×8). Layout per RECOIL's DecodeChx, which matches every
 *   ZX-Paintbrush loader error string:
 *     0..4    'C','H','X',0,0   (bytes 3..4 = version, must be 0 —
 *                                "Wrong CHX version number!")
 *     5..516  256 × u16le absolute file offset of each character's
 *             record, 0 = character not defined
 *     record  [transparent: 0|1][columns: 1..4][rows: 1..4] then
 *             rows×columns cell blocks row-major, each block 8 bitmap
 *             bytes (+1 ZX attribute byte when coloured, i.e.
 *             transparent=0)
 *   A space (code 32) must be defined ("Missing Space character").
 *   Import takes each character's TOP-LEFT cell (our glyphs are one
 *   cell) and ignores attributes; coverage becomes the 96-char window
 *   when every defined code lies in 32..127, else full 256. Export
 *   writes every code of the coverage window as a 1×1 transparent char
 *   map (our fonts are 1-bit). ASSUMPTIONS: multi-cell characters are
 *   cropped to the top-left cell on import; glyph width (4/6/8) is not
 *   representable in CHX — 4/6-wide fonts export as 8-wide cells with
 *   blank right columns (ZX-Editor SE's proportional trick is per-8px
 *   shading, not sub-cell widths).
 *
 * The pure byte math is on this handler (parseFont/exportFont) so Node
 * tests can drive it without FontService; parse()/export() are the
 * FormatRegistry plumbing that reads/writes the working font.
 */
class FontFormatClass {
  constructor() {
    this.EXTENSIONS = ['ch4', 'ch6', 'ch8', 'chr', 'chx'];
    this.CHX_MAGIC = [0x43, 0x48, 0x58, 0, 0]; // 'C','H','X', version 0
  }

  /**
   * Initialize and register with FormatRegistry (one adapter per
   * extension — the registry dispatches by extension, the byte math
   * dispatches on the ext argument).
   */
  initialize() {
    for (const ext of this.EXTENSIONS) {
      const adapter = {
        parse: (buffer) => this.parse(buffer, ext),
        export: () => this.export(ext),
        exportAndDownload: (filename) => this.exportAndDownload(filename)
      };
      FormatRegistry.registerImport(ext, adapter);
      FormatRegistry.registerExport(ext, adapter);
    }
    Logger.info('FontFormat', 'Initialized');
  }

  // ── FormatRegistry plumbing (works on the working font) ─────────────────

  /**
   * Parse font file data (import) into the working font.
   * @param {ArrayBuffer} buffer - File data
   * @param {string} ext - 'ch4' | 'ch6' | 'ch8' | 'chr' | 'chx'
   * @returns {Object} { success: true } or { success: false, error: string }
   */
  parse(buffer, ext) {
    const result = this.parseFont(new Uint8Array(buffer), ext);
    if (!result.success) return result;
    FontService.loadDocument(result.font);
    EventBus.emit(EVENTS.FILE_IMPORT, { format: ext });
    Logger.info('FontFormat', `${ext.toUpperCase()} font loaded successfully`);
    return { success: true };
  }

  /**
   * Export the working font as file bytes.
   * @param {string} ext - Target extension
   * @returns {Uint8Array}
   */
  export(ext) {
    return this.exportFont(FontService.toDocument(), ext);
  }

  /**
   * Export and trigger browser download (via the one FormatRegistry
   * path); format chosen by filename extension.
   * @param {string} filename - Target filename
   */
  exportAndDownload(filename = 'font.ch8') {
    const ext = FormatRegistry.getExtension(filename);
    if (!this.EXTENSIONS.includes(ext)) {
      EventBus.emit(EVENTS.FILE_ERROR, { message: `Not a font extension: .${ext}` });
      return;
    }
    FormatRegistry.download(this.export(ext), filename, 'application/octet-stream');
  }

  // ── Pure byte math (Node-tested) ─────────────────────────────────────────

  /**
   * Decode font file bytes.
   * @param {Uint8Array} bytes
   * @param {string} ext
   * @returns {Object} { success: true, font } or { success: false, error }
   */
  parseFont(bytes, ext) {
    switch (ext) {
      case 'ch4': return this._parseRaw(bytes, 4, [256]);
      case 'ch6': return this._parseRaw(bytes, 6, [256]);
      case 'ch8': return this._parseRaw(bytes, 8, [256]);
      case 'chr': return this._parseRaw(bytes, 8, [256, 96]);
      case 'chx': return this._parseChx(bytes);
      default: return { success: false, error: `Unknown font extension .${ext}` };
    }
  }

  /**
   * Encode a font document as file bytes.
   * @param {Object} doc - { width, firstCode, glyphs } (FontService shape)
   * @param {string} ext
   * @returns {Uint8Array}
   */
  exportFont(doc, ext) {
    switch (ext) {
      case 'ch4': return this._exportRaw(doc, 4, 256);
      case 'ch6': return this._exportRaw(doc, 6, 256);
      case 'ch8': return this._exportRaw(doc, 8, 256);
      case 'chr': return this._exportRaw(doc, 8, doc.glyphs.length === 96 && doc.firstCode === 32 ? 96 : 256);
      case 'chx': return this._exportChx(doc);
      default: throw new Error(`FontFormat: unsupported extension .${ext}`);
    }
  }

  /**
   * Raw character dump (CH4/CH6/CH8/CHR): count × cellH row bytes.
   * @private
   */
  _parseRaw(bytes, width, allowedCounts) {
    const cellH = SCREEN_MODES.STANDARD_ULA.attrCellH; // glyphs are 8-row, mode-independent
    const count = bytes.length / cellH;
    if (!allowedCounts.includes(count)) {
      const sizes = allowedCounts.map(c => c * cellH).join(' or ');
      return { success: false, error: `Illegal character file size (expected ${sizes} bytes, got ${bytes.length})` };
    }
    // The 768-byte variant is the 96-char window starting at space
    const firstCode = count === 96 ? 32 : 0;
    const mask = (0xFF << (8 - width)) & 0xFF;
    const glyphs = [];
    for (let i = 0; i < count; i++) {
      const g = new Uint8Array(cellH);
      for (let y = 0; y < cellH; y++) g[y] = bytes[i * cellH + y] & mask;
      glyphs.push(g);
    }
    return { success: true, font: { name: '', width, firstCode, glyphs } };
  }

  /** @private */
  _exportRaw(doc, width, count) {
    const cellH = SCREEN_MODES.STANDARD_ULA.attrCellH; // glyphs are 8-row, mode-independent
    const firstCode = count === 96 ? 32 : 0;
    const mask = (0xFF << (8 - width)) & 0xFF;
    const out = new Uint8Array(count * cellH);
    for (let i = 0; i < count; i++) {
      const g = this._docGlyph(doc, firstCode + i);
      if (!g) continue;
      for (let y = 0; y < cellH; y++) out[i * cellH + y] = g[y] & mask;
    }
    return out;
  }

  /**
   * CHX big font set (see the header for the record layout).
   * @private
   */
  _parseChx(bytes) {
    const cellH = SCREEN_MODES.STANDARD_ULA.attrCellH; // glyphs are 8-row, mode-independent
    const tableEnd = 5 + 256 * 2;
    if (bytes.length < tableEnd + 1 + 2 + cellH) {
      return { success: false, error: 'Missing CHX header (file too short)' };
    }
    for (let i = 0; i < this.CHX_MAGIC.length; i++) {
      if (bytes[i] !== this.CHX_MAGIC[i]) {
        return { success: false, error: i < 3 ? 'Missing CHX header' : 'Wrong CHX version number' };
      }
    }

    const defined = new Map(); // code -> glyph
    for (let code = 0; code < 256; code++) {
      const offset = bytes[5 + code * 2] | (bytes[6 + code * 2] << 8);
      if (offset === 0) continue;
      if (offset + 2 >= bytes.length) {
        return { success: false, error: `Invalid character header (code ${code})` };
      }
      const transparent = bytes[offset];
      const columns = bytes[offset + 1];
      const rows = bytes[offset + 2];
      if (transparent > 1) {
        return { success: false, error: `Invalid character header (code ${code})` };
      }
      if (columns < 1 || columns > 4 || rows < 1 || rows > 4) {
        return { success: false, error: `Illegal character size (code ${code})` };
      }
      const blockSize = cellH + (transparent ? 0 : 1);
      if (offset + 3 + rows * columns * blockSize > bytes.length) {
        return { success: false, error: `Unexpected end of file (code ${code})` };
      }
      // Top-left cell only — our glyphs are one attribute cell
      const g = new Uint8Array(cellH);
      g.set(bytes.subarray(offset + 3, offset + 3 + cellH));
      defined.set(code, g);
    }
    if (defined.size === 0) {
      return { success: false, error: 'CHX file defines no characters' };
    }

    const codes = [...defined.keys()];
    const ascii = codes.every(c => c >= 32 && c < 128);
    const firstCode = ascii ? 32 : 0;
    const count = ascii ? 96 : 256;
    const glyphs = [];
    for (let i = 0; i < count; i++) {
      glyphs.push(defined.get(firstCode + i) || new Uint8Array(cellH));
    }
    return { success: true, font: { name: '', width: 8, firstCode, glyphs } };
  }

  /** @private */
  _exportChx(doc) {
    const cellH = SCREEN_MODES.STANDARD_ULA.attrCellH; // glyphs are 8-row, mode-independent
    const count = doc.glyphs.length;
    const recordSize = 3 + cellH; // 1×1 transparent char map
    const out = new Uint8Array(5 + 256 * 2 + count * recordSize);
    out.set(this.CHX_MAGIC, 0);
    let offset = 5 + 256 * 2;
    for (let i = 0; i < count; i++) {
      const code = doc.firstCode + i;
      out[5 + code * 2] = offset & 0xFF;
      out[6 + code * 2] = (offset >> 8) & 0xFF;
      out[offset] = 1;     // transparent (no attribute byte)
      out[offset + 1] = 1; // columns
      out[offset + 2] = 1; // rows
      out.set(doc.glyphs[i].subarray(0, cellH), offset + 3);
      offset += recordSize;
    }
    return out;
  }

  /** Glyph bytes of a document by character code, or null. @private */
  _docGlyph(doc, code) {
    const i = code - doc.firstCode;
    return i >= 0 && i < doc.glyphs.length ? doc.glyphs[i] : null;
  }
}

// Create singleton
window.FontFormat = new FontFormatClass();

Logger.debug('FontFormat', 'Sinclair font format handler loaded');

})(); // End IIFE
