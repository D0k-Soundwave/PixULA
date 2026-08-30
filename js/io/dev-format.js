'use strict';
(function() {

/**
 * Developer Export Handler
 *
 * Formats for people building actual ZX Spectrum software:
 *   .asm — Z80 assembly DEFB source (bitmap + attributes, 16 bytes/line)
 *   .c   — C byte arrays (bitmap + attributes, 16 bytes/line)
 *   .bin — raw pixel bitmap only
 *   .atr — raw attribute block only (also IMPORTS: RECOIL decodes .atr as
 *          an attribute picture — 768 bytes, rendered over the synthetic
 *          (x^y)&1 dither bitmap, RECOIL_DecodeAtr's bitmapOffset -3 rule —
 *          so the import reproduces RECOIL's view as editable content)
 *
 * All export data comes from SCRFormat.export(), i.e. the composited
 * visible layers in real ZX screen memory order.
 */
class DevFormatClass {
  constructor() {
    this.BYTES_PER_LINE = 16;
  }

  /**
   * Initialize and register with FormatRegistry
   */
  initialize() {
    for (const ext of ['asm', 'c', 'bin', 'atr']) {
      FormatRegistry.registerExport(ext, this._adapter(ext));
    }
    FormatRegistry.registerImport('atr', this);
    Logger.info('DevFormat', 'Initialized');
  }

  /**
   * Registry adapter — the registry passes no extension to canExport(), and
   * these four formats do NOT share one gate: .atr is an attribute block,
   * and Timex hi-res has no attributes at all (one ink/paper pair for the
   * whole screen). @private
   */
  _adapter(ext) {
    return {
      // The registered extension wins over any `format` an options object
      // happens to carry - the registry looked this handler up BY that
      // extension, so it is the one thing the caller cannot have meant.
      export: (options) => this.export(Object.assign({}, options, { format: ext })),
      canExport: () => this.canExport(ext),
      exportAndDownload: (filename, options, handle) =>
        this.exportAndDownload(filename, options, handle)
    };
  }

  /**
   * Whether the active mode's SCREEN$ bytes actually carry an attribute
   * block. Read from the descriptor rather than named per mode: a mode has
   * one when its file is big enough to hold bitmap AND attributes. Timex
   * hi-res is the mode that does not — its 12289 bytes are 12288 of bitmap
   * plus a single port byte, while `attrSize` (1536) is only the 8x8
   * storage/dirty-tracking granularity the descriptor keeps for every mode.
   * @returns {boolean}
   */
  hasAttributeBlock() {
    const mode = ACTIVE_SCREEN_MODE;
    return mode.fileSize >= mode.bitmapSize + mode.attrSize;
  }

  /**
   * Import a raw attribute picture (.atr, RECOIL parity): exactly 768
   * bytes; the bitmap is the (x^y)&1 dither RECOIL renders it with
   * (row byte 0x55 on even lines, 0xAA on odd), so both the ink and the
   * paper of every cell stay visible and editable.
   * @param {ArrayBuffer} buffer
   * @returns {Object} { success } | { success: false, error }
   */
  parse(buffer) {
    const attrs = new Uint8Array(buffer);
    const modes = this.attrSizeModes();
    const modeId = modes.get(attrs.length);
    if (!modeId) {
      return {
        success: false,
        error: `Invalid .atr file size: ${attrs.length} bytes ` +
               `(expected ${[...modes.keys()].sort((a, b) => a - b).join(', ')})`
      };
    }
    const mode = SCREEN_MODES[Object.keys(SCREEN_MODES)
      .find((k) => SCREEN_MODES[k].id === modeId)];
    const bitmap = new Uint8Array(mode.bitmapSize);
    for (let y = 0; y < mode.height; y++) {
      const pattern = (y & 1) ? 0xAA : 0x55;
      const base = AttributeSystem._lineOffset(y);
      bitmap.fill(pattern, base, base + mode.width / 8);
    }
    return SCRFormat.importScreen(bitmap, attrs, mode.id, 'Load ATR');
  }

  /**
   * Attribute-block size -> screen mode, the way .pal/.npl are designated by
   * size. The export writes the ACTIVE mode's attribute block, so it is
   * 768 bytes in the standard screen but 1536/3072/6144 in the multicolor
   * modes; the import accepted only 768, which meant the app rejected its
   * own .atr from any 8x4/8x2/8x1 document - a file no other program reads
   * either, since RECOIL's .atr is the 768-byte form.
   *
   * The qualifying modes are derived, not listed: a classic 256x192 1-bit
   * single screen with byte-wide cells, the fixed 16-colour palette and a
   * real attribute block. That last pair of conditions is what resolves the
   * two size collisions - an .atr carries no palette, so a 768-byte file
   * must not import as ULAplus or ULANext and invent a register file.
   * @returns {Map<number, string>} attrSize -> mode id
   */
  attrSizeModes() {
    const STD = SCREEN_MODES.STANDARD_ULA;
    const out = new Map();
    for (const mode of Object.values(SCREEN_MODES)) {
      if (mode.pixelDepth !== STD.pixelDepth) continue;
      if (mode.width !== STD.width || mode.height !== STD.height) continue;
      if ((mode.screens || 1) !== 1) continue;
      if (mode.attrCellW !== STD.attrCellW) continue;
      if (mode.paletteModel !== STD.paletteModel) continue;
      if (mode.fileSize < mode.bitmapSize + mode.attrSize) continue;
      out.set(mode.attrSize, mode.id);
    }
    return out;
  }

  /**
   * Whether generate() would succeed in the active mode. All four formats
   * start from SCRFormat.canExport(), since generate() calls
   * SCRFormat.export() internally and inherits its gate; .atr then adds one
   * of its own. The default is the permissive gate, so a caller that asks
   * the handler rather than the registry gets the bitmap formats' answer.
   * @param {string} [ext] - 'asm' | 'c' | 'bin' | 'atr'
   * @returns {boolean}
   */
  canExport(ext = 'asm') {
    if (!SCRFormat.canExport()) return false;
    // .atr is nothing BUT the attribute block, so a mode without one has no
    // file to write. Offering it in Timex hi-res produced a 1-byte .atr —
    // the port byte, sliced out of a screen that ends before the attribute
    // offset — which reads as a valid save and is not an attribute picture.
    // asm/c/bin stay available: their bitmap half is exactly as real there.
    if (ext === 'atr') return this.hasAttributeBlock();
    return true;
  }

  /**
   * Generate export data for one of the developer formats
   * @param {string} ext - 'asm' | 'c' | 'bin' | 'atr'
   * @param {string} name - Base name used for labels/identifiers
   * @returns {Uint8Array} File content (text formats are UTF-8 encoded)
   */
  generate(ext, name) {
    // Mode-native dump: bitmap + attribute sizes follow the active screen
    // mode (multicolor modes emit their larger linear attribute blocks).
    // The attr slice is explicit — the ULAplus SCR variant appends 64
    // palette bytes after the attributes, which .atr must not include.
    const scr = SCRFormat.export();
    const bitmap = scr.subarray(0, ZX_SPECTRUM.BITMAP_SIZE);
    // null, not a short slice, where the mode has no attribute block at all
    // (Timex hi-res) - the difference between "no attributes here" and
    // "here are some attributes" is the whole point, and subarray() past
    // the end of the screen quietly returns the tail rather than saying so.
    const attrs = this.hasAttributeBlock()
      ? scr.subarray(ZX_SPECTRUM.BITMAP_SIZE,
          ZX_SPECTRUM.BITMAP_SIZE + ZX_SPECTRUM.ATTR_SIZE)
      : null;
    const label = this._identifier(name);

    switch (ext) {
      case 'bin': return new Uint8Array(bitmap);
      case 'atr':
        if (!attrs) throw new Error('DevFormat: this screen mode has no attribute block');
        return new Uint8Array(attrs);
      case 'asm': return new TextEncoder().encode(this._asmSource(label, bitmap, attrs));
      case 'c':   return new TextEncoder().encode(this._cSource(label, bitmap, attrs));
      default: throw new Error(`DevFormat: unsupported extension .${ext}`);
    }
  }

  /**
   * Registry contract — not used directly (exportAndDownload dispatches),
   * but keeps the handler shape consistent with other formats.
   * @param {Object} options - { format: 'asm'|'c'|'bin'|'atr', name: string }
   * @returns {Uint8Array}
   */
  export(options = {}) {
    return this.generate(options.format || 'asm', options.name || 'screen');
  }

  /**
   * Export and trigger browser download (via the one FormatRegistry path);
   * format chosen by filename extension
   * @param {string} filename - Target filename (extension decides the format)
   * @param {Object} options - Unused; kept for handler-contract symmetry
   */
  async exportAndDownload(filename = 'image.asm', options = {}, handle = null) {
    const ext = FormatRegistry.getExtension(filename) || 'asm';
    const base = filename.replace(/\.[^.]+$/, '');
    const data = this.generate(ext, base);

    const mime = (ext === 'asm' || ext === 'c') ? 'text/plain' : 'application/octet-stream';
    return FormatRegistry.download(data, filename, mime, handle);
  }

  /**
   * Generate developer export data for a tile map (Phase 11) — the natural
   * use of a ZX game map, and the seam the Phase 13 Next tilemap export
   * extends. Layouts:
   *   .asm/.c — three arrays: <name>_tiles (bitmap bytes per tile, cell
   *             height each), <name>_tile_attrs (1 attribute byte per
   *             tile), <name>_map (u16le width, u16le height, then one
   *             byte per cell: tile index, $FF = empty).
   *   .bin    — the same data as one blob: u16le width, u16le height,
   *             u16le tileCount, tiles (bitmap+attr each), cells.
   * Tile indices must fit a byte, so maps with more than 255 tiles are
   * rejected.
   * @param {string} ext - 'asm' | 'c' | 'bin'
   * @param {string} name - Base name used for labels/identifiers
   * @param {Object} doc - MapService document ({ tiles, map })
   * @returns {Uint8Array} File content (text formats are UTF-8 encoded)
   */
  generateMap(ext, name, doc) {
    const { tiles, map } = doc;
    if (tiles.length > 255) throw new Error('DevFormat: more than 255 tiles');
    const label = this._identifier(name);

    const cellH = SCREEN_MODES.STANDARD_ULA.attrCellH; // ula-cell tiles / 8-row glyphs are mode-independent
    const tileBytes = new Uint8Array(tiles.length * cellH);
    const attrBytes = new Uint8Array(tiles.length);
    tiles.forEach((t, i) => {
      tileBytes.set(t.bitmap, i * cellH);
      attrBytes[i] = t.attr;
    });
    const cellBytes = new Uint8Array(4 + map.width * map.height);
    cellBytes[0] = map.width & 0xFF;
    cellBytes[1] = (map.width >> 8) & 0xFF;
    cellBytes[2] = map.height & 0xFF;
    cellBytes[3] = (map.height >> 8) & 0xFF;
    for (let i = 0; i < map.cells.length; i++) {
      cellBytes[4 + i] = map.cells[i] < 0 ? 0xFF : map.cells[i];
    }

    switch (ext) {
      case 'bin': {
        const out = new Uint8Array(6 + tileBytes.length + attrBytes.length + map.cells.length);
        out[0] = cellBytes[0]; out[1] = cellBytes[1];
        out[2] = cellBytes[2]; out[3] = cellBytes[3];
        out[4] = tiles.length & 0xFF; out[5] = (tiles.length >> 8) & 0xFF;
        let o = 6;
        tiles.forEach(t => { out.set(t.bitmap, o); o += cellH; out[o++] = t.attr; });
        out.set(cellBytes.subarray(4), o);
        return out;
      }
      case 'asm': {
        const lines = [
          `; ${label} — tile map (${map.width}x${map.height} cells, ${tiles.length} tiles)`,
          `; map cell format: 1 byte tile index, $FF = empty`,
          '',
          `${label}_tiles:`
        ];
        this._appendRows(lines, tileBytes, (row) => '    DEFB ' + row.map(b => '$' + this._hex(b)).join(','));
        lines.push('', `${label}_tile_attrs:`);
        this._appendRows(lines, attrBytes, (row) => '    DEFB ' + row.map(b => '$' + this._hex(b)).join(','));
        lines.push('', `${label}_map:`);
        lines.push(`    DEFW ${map.width}, ${map.height}`);
        this._appendRows(lines, cellBytes.subarray(4), (row) => '    DEFB ' + row.map(b => '$' + this._hex(b)).join(','));
        lines.push('');
        return new TextEncoder().encode(lines.join('\n'));
      }
      case 'c': {
        const lines = [
          `/* ${label} — tile map (${map.width}x${map.height} cells, ${tiles.length} tiles; 0xFF = empty cell) */`,
          '',
          `#define ${label.toUpperCase()}_MAP_WIDTH ${map.width}`,
          `#define ${label.toUpperCase()}_MAP_HEIGHT ${map.height}`,
          `#define ${label.toUpperCase()}_TILE_COUNT ${tiles.length}`,
          '',
          `const unsigned char ${label}_tiles[${tileBytes.length}] = {`
        ];
        this._appendRows(lines, tileBytes, (row, isLast) =>
          '    ' + row.map(b => '0x' + this._hex(b)).join(', ') + (isLast ? '' : ','));
        lines.push('};', '', `const unsigned char ${label}_tile_attrs[${attrBytes.length}] = {`);
        this._appendRows(lines, attrBytes, (row, isLast) =>
          '    ' + row.map(b => '0x' + this._hex(b)).join(', ') + (isLast ? '' : ','));
        lines.push('};', '', `const unsigned char ${label}_map[${map.cells.length}] = {`);
        this._appendRows(lines, cellBytes.subarray(4), (row, isLast) =>
          '    ' + row.map(b => '0x' + this._hex(b)).join(', ') + (isLast ? '' : ','));
        lines.push('};', '');
        return new TextEncoder().encode(lines.join('\n'));
      }
      default: throw new Error(`DevFormat: unsupported map extension .${ext}`);
    }
  }

  /**
   * Generate ZX Spectrum Next tilemap export data (Phase 13) — the map
   * document converted to Next-hardware tile definitions, ready for the
   * tilemap pattern RAM in CSpect/ZEsarUX workflows.
   *
   * Conversion (the TILE_KINDS.NEXT_4BPP export contract): each 'ula-cell'
   * tile becomes an 8×8 4bpp definition, 32 bytes, LEFT pixel in the high
   * nibble; ink bits take palette index (bright?8:0)+ink, paper bits
   * (bright?8:0)+paper — the classic-16 slots, which the default Next
   * palette reproduces, so loading the defs with our .pal/.npl export (or
   * the hardware classics) shows the map as drawn. FLASH does not exist
   * on the Next tilemap and is dropped.
   *
   * Layouts:
   *   .asm/.c — <name>_next_tiles (32 bytes per tile) and <name>_next_map
   *             (u16le width, u16le height, then 1 byte per cell: tile
   *             index, $FF = empty).
   *   .bin    — one blob: u16le width, u16le height, u16le tileCount,
   *             tile defs, cells.
   * Tile indices must fit a byte, so maps with more than 255 tiles are
   * rejected (same rule as generateMap).
   * @param {string} ext - 'asm' | 'c' | 'bin'
   * @param {string} name - Base name used for labels/identifiers
   * @param {Object} doc - MapService document ({ tiles, map })
   * @returns {Uint8Array} File content (text formats are UTF-8 encoded)
   */
  generateNextTilemap(ext, name, doc) {
    const { tiles, map } = doc;
    if (tiles.length > 255) throw new Error('DevFormat: more than 255 tiles');
    const label = this._identifier(name);
    const cellH = SCREEN_MODES.STANDARD_ULA.attrCellH;

    // ula-cell -> next-4bpp tile definitions
    const tileBytes = new Uint8Array(tiles.length * 32);
    tiles.forEach((t, n) => {
      const ink = ((t.attr & 0x40) ? 8 : 0) + (t.attr & 7);
      const paper = ((t.attr & 0x40) ? 8 : 0) + ((t.attr >> 3) & 7);
      for (let y = 0; y < cellH; y++) {
        const bits = t.bitmap[y];
        for (let x = 0; x < 8; x++) {
          const v = ((bits & (0x80 >> x)) ? ink : paper) & 0x0F;
          const o = n * 32 + y * 4 + (x >> 1);
          tileBytes[o] |= (x & 1) ? v : (v << 4);
        }
      }
    });

    const cellCount = map.width * map.height;
    const cells = new Uint8Array(cellCount);
    for (let i = 0; i < cellCount; i++) {
      cells[i] = map.cells[i] < 0 ? 0xFF : map.cells[i];
    }

    switch (ext) {
      case 'bin': {
        const out = new Uint8Array(6 + tileBytes.length + cellCount);
        out[0] = map.width & 0xFF; out[1] = (map.width >> 8) & 0xFF;
        out[2] = map.height & 0xFF; out[3] = (map.height >> 8) & 0xFF;
        out[4] = tiles.length & 0xFF; out[5] = (tiles.length >> 8) & 0xFF;
        out.set(tileBytes, 6);
        out.set(cells, 6 + tileBytes.length);
        return out;
      }
      case 'asm': {
        const lines = [
          `; ${label} — ZX Spectrum Next tilemap (${map.width}x${map.height} cells, ${tiles.length} tiles)`,
          `; tile defs: 8x8 4bpp, 32 bytes each, left pixel in the high nibble`,
          `; map cell format: 1 byte tile index, $FF = empty`,
          '',
          `${label}_next_tiles:`
        ];
        this._appendRows(lines, tileBytes, (row) => '    DEFB ' + row.map(b => '$' + this._hex(b)).join(','));
        lines.push('', `${label}_next_map:`);
        lines.push(`    DEFW ${map.width}, ${map.height}`);
        this._appendRows(lines, cells, (row) => '    DEFB ' + row.map(b => '$' + this._hex(b)).join(','));
        lines.push('');
        return new TextEncoder().encode(lines.join('\n'));
      }
      case 'c': {
        const lines = [
          `/* ${label} — ZX Spectrum Next tilemap (${map.width}x${map.height} cells, ${tiles.length} tiles; 0xFF = empty cell) */`,
          `/* tile defs: 8x8 4bpp, 32 bytes each, left pixel in the high nibble */`,
          '',
          `#define ${label.toUpperCase()}_NEXT_MAP_WIDTH ${map.width}`,
          `#define ${label.toUpperCase()}_NEXT_MAP_HEIGHT ${map.height}`,
          `#define ${label.toUpperCase()}_NEXT_TILE_COUNT ${tiles.length}`,
          '',
          `const unsigned char ${label}_next_tiles[${tileBytes.length}] = {`
        ];
        this._appendRows(lines, tileBytes, (row, isLast) =>
          '    ' + row.map(b => '0x' + this._hex(b)).join(', ') + (isLast ? '' : ','));
        lines.push('};', '', `const unsigned char ${label}_next_map[${cellCount}] = {`);
        this._appendRows(lines, cells, (row, isLast) =>
          '    ' + row.map(b => '0x' + this._hex(b)).join(', ') + (isLast ? '' : ','));
        lines.push('};', '');
        return new TextEncoder().encode(lines.join('\n'));
      }
      default: throw new Error(`DevFormat: unsupported Next tilemap extension .${ext}`);
    }
  }

  /**
   * Generate developer export data for a raster font (Phase 10) — the
   * glyph bytes in memory-ready order for ZX Spectrum text routines.
   * Layouts:
   *   .asm/.c — one array: <name>_font (8 row bytes per glyph, first
   *             character code and glyph count in the comment header).
   *   .bin    — the raw glyph bytes only (count × 8; a 96-glyph ASCII
   *             font is the classic 768-byte CHARS-pointer block).
   * @param {string} ext - 'asm' | 'c' | 'bin'
   * @param {string} name - Base name used for labels/identifiers
   * @param {Object} doc - FontService document ({ width, firstCode, glyphs })
   * @returns {Uint8Array} File content (text formats are UTF-8 encoded)
   */
  generateFont(ext, name, doc) {
    const cellH = SCREEN_MODES.STANDARD_ULA.attrCellH; // ula-cell tiles / 8-row glyphs are mode-independent
    const label = this._identifier(name);
    const bytes = new Uint8Array(doc.glyphs.length * cellH);
    doc.glyphs.forEach((g, i) => bytes.set(g.subarray(0, cellH), i * cellH));

    const describe = `${doc.glyphs.length} glyphs, ${doc.width}x${cellH} px, ` +
      `first character code ${doc.firstCode}`;
    switch (ext) {
      case 'bin':
        return bytes;
      case 'asm': {
        const lines = [
          `; ${label} — raster font (${describe})`,
          `; ${cellH} bytes per glyph, MSB = leftmost pixel`,
          '',
          `${label}_font:`
        ];
        this._appendRows(lines, bytes, (row) => '    DEFB ' + row.map(b => '$' + this._hex(b)).join(','));
        lines.push('');
        return new TextEncoder().encode(lines.join('\n'));
      }
      case 'c': {
        const lines = [
          `/* ${label} — raster font (${describe}) */`,
          '',
          `#define ${label.toUpperCase()}_FONT_FIRST ${doc.firstCode}`,
          `#define ${label.toUpperCase()}_FONT_COUNT ${doc.glyphs.length}`,
          `#define ${label.toUpperCase()}_FONT_WIDTH ${doc.width}`,
          '',
          `const unsigned char ${label}_font[${bytes.length}] = {`
        ];
        this._appendRows(lines, bytes, (row, isLast) =>
          '    ' + row.map(b => '0x' + this._hex(b)).join(', ') + (isLast ? '' : ','));
        lines.push('};', '');
        return new TextEncoder().encode(lines.join('\n'));
      }
      default: throw new Error(`DevFormat: unsupported font extension .${ext}`);
    }
  }

  /**
   * Sanitize a name into a Z80/C identifier
   * @param {string} name
   * @returns {string}
   * @private
   */
  _identifier(name) {
    const clean = String(name || 'screen').replace(/[^A-Za-z0-9_]/g, '_');
    return /^[0-9]/.test(clean) ? '_' + clean : clean;
  }

  /**
   * Build Z80 assembly DEFB source
   * @private
   */
  _asmSource(label, bitmap, attrs) {
    const lines = [
      `; ${label} — ZX Spectrum SCREEN$ data`,
      `; bitmap: ${bitmap.length} bytes (interleaved screen order), attributes: ` +
        (attrs ? `${attrs.length} bytes` : 'none in this screen mode'),
      '',
      `${label}_bitmap:`
    ];
    this._appendRows(lines, bitmap, (row) => '    DEFB ' + row.map(b => '$' + this._hex(b)).join(','));
    // No label and no array where the mode has no attributes: an empty
    // <label>_attributes for the assembler to place would be a symbol
    // promising something it cannot deliver.
    if (attrs) {
      lines.push('', `${label}_attributes:`);
      this._appendRows(lines, attrs, (row) => '    DEFB ' + row.map(b => '$' + this._hex(b)).join(','));
    }
    lines.push('');
    return lines.join('\n');
  }

  /**
   * Build C array source
   * @private
   */
  _cSource(label, bitmap, attrs) {
    const lines = [
      `/* ${label} — ZX Spectrum SCREEN$ data */`,
      '',
      `const unsigned char ${label}_bitmap[${bitmap.length}] = {`
    ];
    this._appendRows(lines, bitmap, (row, isLast) =>
      '    ' + row.map(b => '0x' + this._hex(b)).join(', ') + (isLast ? '' : ','));
    lines.push('};', '');
    // See _asmSource: a mode with no attribute block gets no array at all,
    // rather than a zero-length one C rejects anyway.
    if (attrs) {
      lines.push(`const unsigned char ${label}_attributes[${attrs.length}] = {`);
      this._appendRows(lines, attrs, (row, isLast) =>
        '    ' + row.map(b => '0x' + this._hex(b)).join(', ') + (isLast ? '' : ','));
      lines.push('};', '');
    }
    return lines.join('\n');
  }

  /**
   * Append formatted rows of BYTES_PER_LINE to lines
   * @private
   */
  _appendRows(lines, bytes, formatRow) {
    for (let i = 0; i < bytes.length; i += this.BYTES_PER_LINE) {
      const row = Array.from(bytes.subarray(i, i + this.BYTES_PER_LINE));
      lines.push(formatRow(row, i + this.BYTES_PER_LINE >= bytes.length));
    }
  }

  /**
   * @private
   */
  _hex(b) {
    return b.toString(16).toUpperCase().padStart(2, '0');
  }
}

// Create singleton
window.DevFormat = new DevFormatClass();

Logger.debug('DevFormat', 'Developer export handler loaded');

})(); // End IIFE
