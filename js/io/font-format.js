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
 *   blocks of 8x8 pixels). Layout per RECOIL's DecodeChx, which matches every
 *   ZX-Paintbrush loader error string, and the ZX-Blockeditor data block
 *   pages ("Transparent character map" 8*width*height bytes, "Colour
 *   character map" 9*width*height bytes):
 *     0..4    'C','H','X',0,0   (bytes 3..4 = version, must be 0 —
 *                                "Wrong CHX version number!")
 *     5..516  256 × u16le absolute file offset of each character's
 *             record, 0 = character not defined
 *     record  [transparent: 0|1][columns: 1..4][rows: 1..4] then
 *             rows*columns blocks, left to right then down, each block
 *             8 bitmap bytes (+1 ZX attribute byte when coloured, i.e.
 *             transparent=0)
 *   A space (code 32) must be defined ("Missing Space character").
 *
 *   Every character has its OWN size. "Proportional" fonts are narrower
 *   characters: the shader tool shades 8-pixel columns on the left and/or
 *   right of a character and the saved character is that much narrower; a
 *   character shaded all the way across is not written (ZX-Paintbrush help,
 *   "Shader tool").
 *
 *   Import: the font is as large as the largest character (columns x rows).
 *   A smaller character sits at the top-left and the rest is shaded on the
 *   right (so it saves back the same size); codes the file does not define
 *   come back fully shaded (so a sparse file stays sparse). If the file has
 *   no Space, one is added as a blank, unshaded column. Coverage becomes the
 *   96-char window when every defined code lies in 32..127, else full 256.
 *
 *   Coloured characters (owner decision 2026-10-19): a record with
 *   transparent = 0 keeps the attribute byte of each block, so the font
 *   document gains colours[i] = a Uint8Array of columns * rows ZX attribute
 *   bytes for the FULL character cell (same block order), or null for an
 *   uncoloured character; colours is null when no character is coloured. The
 *   blocks a smaller coloured character does not have get attribute 56
 *   (GlyphBits.DEFAULT_ATTR). A character is coloured or transparent as a
 *   whole - the file has one flag per character.
 *
 *   Export: every code of the coverage is written at its size minus its
 *   shading, except fully shaded ones. A coloured character is written with
 *   transparent = 0 and the attribute byte after each stored block; an
 *   uncoloured one exactly as before (transparent = 1, 8 bytes a block), so
 *   an uncoloured font saves the same bytes it always did. Reading the file
 *   back gives the same pixels and attributes, but a character shaded on the
 *   LEFT comes back shaded on the right (the file stores no position), so
 *   the guarantee is export, import, export = identical bytes.
 *
 *   UNVERIFIED against a file made by ZX-Paintbrush: only 1x1 uncoloured
 *   files were ever compared with the real program (owner, 2026-09-26). The
 *   block order, the columns-then-rows header order and the attribute byte
 *   after each block come from RECOIL and the datablocks manual; the owner
 *   declined to make sample files on 2026-10-13 (LOG, Batch 10C), so open a
 *   PixULA big or coloured CHX in ZX-Paintbrush before relying on it.
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
        // A font goes to the Font Editor; it is not the picture, so opening one must not replace the picture's file
        // name, unsaved flag, map elements or palette slots (nor ask before doing so)
        importsDocument: false,
        parse: (buffer) => this.parse(buffer, ext),
        export: () => this.export(ext),
        exportAndDownload: (filename, options, handle) => this.exportAndDownload(filename, handle)
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
  async exportAndDownload(filename = 'font.ch8', handle = null) {
    const ext = FormatRegistry.getExtension(filename);
    if (!this.EXTENSIONS.includes(ext)) {
      EventBus.emit(EVENTS.FILE_ERROR, { message: Helpers.localizedMessage('err.notFontExt',
          'Not a font file extension: .{ext}', { ext }) });
      return false;
    }
    return FormatRegistry.download(this.export(ext), filename, 'application/octet-stream', handle);
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
      default: return { success: false, error: Helpers.localizedMessage('err.notFontExt',
          'Not a font file extension: .{ext}', { ext }) };
    }
  }

  /**
   * Encode a font document as file bytes.
   * @param {Object} doc - { width, firstCode, glyphs } (FontService shape)
   * @param {string} ext
   * @returns {Uint8Array}
   */
  exportFont(doc, ext) {
    if (ext !== 'chx' && ((doc.height !== undefined && doc.height > 8) || doc.width > 8)) {
      throw new Error(Helpers.localizedMessage('err.fontTooBig',
        'This font is too big for a .{ext} file (they hold 8 x 8 characters). Save it as .chx.', { ext }));
    }
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
      const sizes = allowedCounts.map(c => c * cellH).join(', ');
      return { success: false, error: Helpers.localizedMessage('err.charFileSize',
          'Illegal character file size (expected {expected} bytes, got {size})', { expected: sizes, size: bytes.length }) };
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
    const tableEnd = 5 + 256 * 2;
    if (bytes.length < tableEnd + 1 + 2 + 8) {
      return { success: false, error: Helpers.localizedMessage('err.chxNoHeader',
          'Missing CHX header (file too short)') };
    }
    for (let i = 0; i < this.CHX_MAGIC.length; i++) {
      if (bytes[i] !== this.CHX_MAGIC[i]) {
        return { success: false, error: i < 3
          ? Helpers.localizedMessage('err.chxMissingHeader', 'Missing CHX header')
          : Helpers.localizedMessage('err.chxBadVersion', 'Wrong CHX version number') };
      }
    }

    const defined = new Map(); // code -> { cols, rows, bitmap, attrs (null = transparent) }
    for (let code = 0; code < 256; code++) {
      const offset = bytes[5 + code * 2] | (bytes[6 + code * 2] << 8);
      if (offset === 0) continue;
      if (offset + 2 >= bytes.length) {
        return { success: false, error: Helpers.localizedMessage('err.chxBadHeader',
            'Invalid character header (code {code})', { code }) };
      }
      const transparent = bytes[offset];
      const columns = bytes[offset + 1];
      const rows = bytes[offset + 2];
      if (transparent > 1) {
        return { success: false, error: Helpers.localizedMessage('err.chxBadHeader',
            'Invalid character header (code {code})', { code }) };
      }
      if (columns < 1 || columns > 4 || rows < 1 || rows > 4) {
        return { success: false, error: Helpers.localizedMessage('err.chxBadSize',
            'Illegal character size (code {code})', { code }) };
      }
      const blockSize = 8 + (transparent ? 0 : 1);
      if (offset + 3 + rows * columns * blockSize > bytes.length) {
        return { success: false, error: Helpers.localizedMessage('err.chxEnd',
            'Unexpected end of file (code {code})', { code }) };
      }
      // Whole character: the 8 bitmap bytes of each block, and its attribute byte when the character is coloured
      const blocks = new Uint8Array(columns * rows * 8);
      const attrs = transparent ? null : new Uint8Array(columns * rows);
      for (let b = 0; b < columns * rows; b++) {
        blocks.set(bytes.subarray(offset + 3 + b * blockSize, offset + 3 + b * blockSize + 8), b * 8);
        if (attrs) attrs[b] = bytes[offset + 3 + b * blockSize + 8];
      }
      defined.set(code, { cols: columns, rows, bitmap: GlyphBits.fromBlocks(blocks, columns, rows), attrs });
    }
    if (defined.size === 0) {
      return { success: false, error: Helpers.localizedMessage('err.chxEmpty',
          'CHX file defines no characters') };
    }

    let maxCols = 1, maxRows = 1;
    for (const c of defined.values()) {
      if (c.cols > maxCols) maxCols = c.cols;
      if (c.rows > maxRows) maxRows = c.rows;
    }
    const width = maxCols * 8, height = maxRows * 8;

    const codes = [...defined.keys()];
    const ascii = codes.every(c => c >= 32 && c < 128);
    const firstCode = ascii ? 32 : 0;
    const count = ascii ? 96 : 256;
    const glyphs = [];
    const shade = [];
    const colours = [];
    let coloured = false;
    for (let i = 0; i < count; i++) {
      const code = firstCode + i;
      const c = defined.get(code);
      colours.push(c && c.attrs ? GlyphBits.resizeBlocks(c.attrs, c.cols, c.rows, maxCols, maxRows) : null);
      if (c && c.attrs) coloured = true;
      if (c) {
        glyphs.push(GlyphBits.resize(c.bitmap, c.cols * 8, c.rows * 8, width, height));
        shade.push([0, maxCols - c.cols]);
      } else {
        glyphs.push(GlyphBits.create(width, height));
        // ZX-Paintbrush needs a Space: add a blank one; everything else the file left out stays left out
        shade.push([0, code === 32 ? 0 : maxCols]);
      }
    }
    return { success: true, font: { name: '', width, height, firstCode, glyphs, shade, colours: coloured ? colours : null } };
  }

  /**
   * What a CHX export of this document will contain: per glyph how many 8-pixel columns are written (`stored`, 0 = the
   * character is left out). One place, so the export and the summary shown to the user cannot disagree.
   * @private
   */
  _chxPlan(doc) {
    const height = doc.height === undefined ? 8 : doc.height;
    const cols = (doc.width + 7) >> 3;
    const rows = height >> 3;
    const entries = [];
    let size = 5 + 256 * 2;
    for (let i = 0; i < doc.glyphs.length; i++) {
      const sh = doc.shade ? doc.shade[i] : null;
      const left = sh ? sh[0] : 0;
      const right = sh ? sh[1] : 0;
      const stored = cols - left - right;
      const attrs = this._docColours(doc, i, cols, rows);
      entries.push({ left, right, stored, attrs });
      if (stored > 0) size += 3 + stored * rows * (attrs ? 9 : 8);
    }
    const spaceIndex = 32 - doc.firstCode;
    const hasSpace = spaceIndex >= 0 && spaceIndex < entries.length && entries[spaceIndex].stored > 0;
    return { cols, rows, entries, size, spaceIndex, hasSpace };
  }

  /**
   * Counts for the message after a CHX export: how many characters are written narrower than the font, how many are left
   * out, and how many have dots under the shading that the file will not hold.
   * @returns {{narrowed:number, leftOut:number, hiddenInk:number}}
   */
  chxSummary(doc) {
    const plan = this._chxPlan(doc);
    const w = plan.cols * 8;
    const h = plan.rows * 8;
    let narrowed = 0, leftOut = 0, hiddenInk = 0;
    plan.entries.forEach((e, i) => {
      if (e.stored <= 0) leftOut++;
      else if (e.stored < plan.cols) narrowed++;
      if (e.left + e.right === 0) return;
      const g = doc.glyphs[i];
      const hidden = (x) => { for (let y = 0; y < h; y++) if (GlyphBits.getPixel(g, w, x, y)) return true; return false; };
      for (let c = 0; c < e.left; c++) for (let x = c * 8; x < c * 8 + 8; x++) if (hidden(x)) { hiddenInk++; return; }
      for (let c = plan.cols - e.right; c < plan.cols; c++) {
        if (c < 0) continue;
        for (let x = c * 8; x < c * 8 + 8; x++) if (hidden(x)) { hiddenInk++; return; }
      }
    });
    return { narrowed, leftOut, hiddenInk };
  }

  /** @private */
  _exportChx(doc) {
    const plan = this._chxPlan(doc);
    const { cols, rows, entries } = plan;
    if (!plan.hasSpace) {
      throw new Error(Helpers.localizedMessage('err.chxNoSpace',
        'A CHX file needs a Space character (code 32) that keeps at least one column'));
    }
    const out = new Uint8Array(plan.size);
    out.set(this.CHX_MAGIC, 0);
    let offset = 5 + 256 * 2;
    for (let i = 0; i < entries.length; i++) {
      const { left, stored, attrs } = entries[i];
      if (stored <= 0) continue;
      const code = doc.firstCode + i;
      out[5 + code * 2] = offset & 0xFF;
      out[6 + code * 2] = (offset >> 8) & 0xFF;
      out[offset] = attrs ? 0 : 1;   // 1 = transparent (no attribute byte), 0 = coloured (one after each block)
      out[offset + 1] = stored;
      out[offset + 2] = rows;
      let o = offset + 3;
      const g = doc.glyphs[i];
      for (let by = 0; by < rows; by++) {
        for (let bx = left; bx < left + stored; bx++) {
          for (let r = 0; r < 8; r++) out[o++] = g[(by * 8 + r) * cols + bx];
          if (attrs) out[o++] = attrs[by * cols + bx];
        }
      }
      offset = o;
    }
    return out;
  }

  /**
   * How many characters of a document have attributes of their own (what a .ch4/.ch6/.ch8/.chr or a code listing cannot
   * keep, so the export can say so).
   * @param {Object} doc
   * @returns {number}
   */
  colouredCount(doc) {
    if (!doc || !Array.isArray(doc.colours)) return 0;
    const height = doc.height === undefined ? 8 : doc.height;
    const cols = (doc.width + 7) >> 3, rows = height >> 3;
    let n = 0;
    for (let i = 0; i < doc.glyphs.length; i++) if (this._docColours(doc, i, cols, rows)) n++;
    return n;
  }

  /** A glyph's block attributes (cols x rows bytes) if it is coloured, else null - also for a list of the wrong shape. @private */
  _docColours(doc, i, cols, rows) {
    const c = Array.isArray(doc.colours) ? doc.colours[i] : null;
    return c && c.length === cols * rows ? c : null;
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
