'use strict';
(function() {

/**
 * GigaScreen formats (Phase 12b) — containers for the two-sub-screen
 * flicker mode. ZX-Paintbrush has NO GigaScreen support, so there is no
 * parity behaviour to match; byte layouts follow RECOIL, the ecosystem's
 * reference decoder (recoil.c):
 *
 *   .img (13824, import + export) — RECOIL_DecodeZxImg: two complete 6912
 *        standard screens back to back, blended on display. (The .img
 *        extension also names Disciple/PlusD disk images elsewhere; the
 *        byte length disambiguates.)
 *   .mg / .mg1 / .mg2 / .mg4 / .mg8 (import; .mg1/2/4/8 also export) -
 *        RECOIL_DecodeMg: 'MGH' + version 1 header byte, byte 4 =
 *        attribute height (1/2/4/8; MultiArtist names files by that
 *        height); 256-byte header, the two interleaved bitmaps at 256 and
 *        256 + bitmapSize, both attribute blocks after them. Every height
 *        imports as a two-screen pair (since 2026-09-23 - it used to drop
 *        screen B below 8x8): 8 -> GIGASCREEN, 4/2/1 -> MULTIGIGA_8x4/8x2/
 *        8x1. Height 1 is MultiArtist's mixed layout - the middle sixteen
 *        columns per line, the side columns (0-7, 24-31) per 8-line row -
 *        expanded to full per-line attributes on import (8x1 is the
 *        superset). On export the side columns take each 8-line block's
 *        most frequent attribute, which is exact for anything imported from
 *        .mg1 and lossy only where the side columns were given per-line
 *        colours in the app. The header past byte 4 is written as zeros:
 *        RECOIL reads nothing else there and no MultiArtist spec is public.
 *   .hlr (import only) — RECOIL_DecodeHlr: 1628-byte attribute
 *        GigaScreen (7-byte Z80 stub, 8 pattern-row bytes at 84, two
 *        768-byte attribute frames at 92/860) — imports as a pair with
 *        the pattern bitmap made editable.
 *
 * Import switches the document to GigaScreen mode (raw switch inside the
 * undo action) and loads the two screens into the two planes of the current
 * layer - every GigaScreen cell holds both screens. Export requires
 * GigaScreen mode (any other mode has no second screen to write) and
 * serializes each plane of the flattened document.
 *
 * The GIF exporter uses subScreenBytes() to emit the two sub-screens as a
 * fast two-frame flicker loop — the animated preview seam.
 */
class GigascreenFormatClass {

  initialize() {
    FormatRegistry.registerImport('img', this._adapter('img'));
    FormatRegistry.registerExport('img', this._adapter('img'));
    // MultiArtist names its files by attribute height - RECOIL's format
    // list has MG1/MG2/MG4/MG8, not a bare .mg. The MGH header byte
    // governs either way, whatever the extension says: it picks GigaScreen
    // or the MultiGigaScreen mode of that height. Bare .mg stays as the
    // family alias.
    for (const ext of ['mg', 'mg1', 'mg2', 'mg4', 'mg8']) {
      FormatRegistry.registerImport(ext, this._adapter(ext));
    }
    for (const ext of ['mg1', 'mg2', 'mg4', 'mg8']) {
      FormatRegistry.registerExport(ext, this._adapter(ext));
    }
    // .hlr attribute GigaScreen (RECOIL parity, import only)
    FormatRegistry.registerImport('hlr', this._adapter('hlr'));
    Logger.info('GigascreenFormat', 'Initialized (img/mg/mg1-8/hlr)');
  }

  /** Registry adapter — the registry passes no extension to parse(). @private */
  _adapter(ext) {
    if (/^mg\d$/.test(ext)) {
      const height = Number(ext.slice(2));
      return {
        parse: (buffer) => this.parse(ext, buffer),
        export: () => this.exportMg(height),
        canExport: () => this.canExportMg(height),
        exportAndDownload: (filename, options, handle) =>
          this.exportMgAndDownload(height, filename, handle)
      };
    }
    return {
      parse: (buffer) => this.parse(ext, buffer),
      export: () => this.export(),
      canExport: () => this.canExport(),
      exportAndDownload: (filename, options, handle) => this.exportAndDownload(filename, handle)
    };
  }

  // ── Import ────────────────────────────────────────────────────────────────

  /**
   * Parse a GigaScreen container.
   * @param {string} ext - 'img' | 'hlr' | 'mg' | 'mg1' | 'mg2' | 'mg4' | 'mg8'
   * @param {ArrayBuffer} buffer
   * @returns {Object} { success } | { success: false, error }
   */
  parse(ext, buffer) {
    const bytes = new Uint8Array(buffer);
    if (ext === 'hlr') return this._parseHlr(bytes);
    if (ext.startsWith('mg')) return this._parseMg(bytes);
    const screens = this._decodeImg(bytes);
    if (screens.error) return { success: false, error: screens.error };
    return this._importPair(this._split(screens.a), this._split(screens.b),
      `Load ${ext.toUpperCase()}`);
  }

  /**
   * Parse an .hlr attribute GigaScreen (RECOIL_DecodeHlr): 1628 bytes
   * opening with the 7-byte Z80 stub 76 AF D3 FE 21 00 58; the 8 bitmap
   * pattern-row bytes live at offset 84 (every cell row repeats them —
   * DecodeZx bitmapOffset -2), frame attributes at 92 and 860 (768 each).
   * Imports as a GigaScreen pair with the pattern bitmap made editable.
   * @private
   */
  _parseHlr(bytes) {
    const SIG = [0x76, 0xAF, 0xD3, 0xFE, 0x21, 0x00, 0x58];
    if (bytes.length !== 1628 || SIG.some((v, i) => bytes[i] !== v)) {
      return {
        success: false,
        error: `Not an HLR attribute GigaScreen (${bytes.length} bytes)`
      };
    }
    const STD = SCREEN_MODES.STANDARD_ULA;
    const buildScreen = (attrOffset) => {
      const scr = new Uint8Array(STD.fileSize);
      for (let y = 0; y < STD.height; y++) {
        const base = AttributeSystem._lineOffset(y);
        scr.fill(bytes[84 + (y & 7)], base, base + STD.width / 8);
      }
      scr.set(bytes.subarray(attrOffset, attrOffset + STD.attrSize), STD.bitmapSize);
      return scr;
    };
    return this._importPair(this._split(buildScreen(92)), this._split(buildScreen(860)),
      'Load HLR');
  }

  /**
   * Parse an MGH container (RECOIL_DecodeMg): 'MGH' + version 1, byte 4 =
   * attribute height. Every height imports BOTH screens as a pair: 8 into
   * GigaScreen, 4/2/1 into MultiGigaScreen 8x4/8x2/8x1 (_mgLayout). Height 1
   * uses MultiArtist's mixed layout (8x8 side columns, per-line middle 16
   * columns - offsets in _mgLayout), expanded to full per-line attributes,
   * since 8x1 is the superset. Any other height is refused. @private
   */
  _parseMg(bytes) {
    const STD = SCREEN_MODES.STANDARD_ULA;
    const HEADER = 256;
    if (bytes.length < HEADER
        || bytes[0] !== 0x4D || bytes[1] !== 0x47 || bytes[2] !== 0x48 // 'MGH'
        || bytes[3] !== 1) {
      return { success: false, error: 'Not an MGH GigaScreen file' };
    }

    const height = bytes[4];
    const layout = this._mgLayout(height);
    if (!layout) {
      return { success: false, error: `Unsupported .mg attribute height: ${height}` };
    }
    if (bytes.length !== layout.size) {
      return {
        success: false,
        error: `Invalid .mg file size: ${bytes.length} bytes (expected ${layout.size})`
      };
    }
    const screen = (f) => {
      const b = f ? layout.bitmapB : layout.bitmapA;
      const a = f ? layout.attrsB : layout.attrsA;
      return {
        bitmap: bytes.slice(b, b + STD.bitmapSize),
        attrs: height === 1
          ? this._readMg1Attrs(bytes, layout, f)
          : bytes.slice(a, a + layout.mode.attrSize)
      };
    };
    return this._importPair(screen(0), screen(1), 'Load MG', layout.mode);
  }

  /**
   * Where everything sits in an MGH file of one attribute height, derived
   * from the mode descriptors rather than typed (RECOIL DecodeMg is the
   * reference; the offsets below reproduce its 0x100 / 0x1900 bitmaps, the
   * 0x3100 attribute base and, for height 1, the 0x30F8 / 0x3CF8 middle and
   * 0x4900 / 0x4A80 side blocks).
   * @param {number} height - 1, 2, 4 or 8
   * @returns {Object|null}
   * @private
   */
  _mgLayout(height) {
    const mode = {
      8: SCREEN_MODES.GIGASCREEN,
      4: SCREEN_MODES.MULTIGIGA_8x4,
      2: SCREEN_MODES.MULTIGIGA_8x2,
      1: SCREEN_MODES.MULTIGIGA_8x1
    }[height];
    if (!mode) return null;
    const HEADER = 256;
    const bitmapA = HEADER;
    const bitmapB = HEADER + mode.bitmapSize;
    const attrsA = HEADER + 2 * mode.bitmapSize;
    if (height !== 1) {
      const attrsB = attrsA + mode.attrSize;
      return { mode, height, bitmapA, bitmapB, attrsA, attrsB, size: attrsB + mode.attrSize };
    }
    // Height 1: sixteen middle columns per line, then the side columns per
    // 8-line row (16 bytes a row: columns 0-7 then 24-31), frame A then B.
    // The middle blocks are addressed from 8 bytes before their start,
    // because the first middle column is column 8.
    const lines = mode.height;
    const rows = lines / 8;
    const middleA = attrsA - 8;
    const middleB = middleA + 16 * lines;
    const sideA = middleB + 8 + 16 * lines;
    const sideB = sideA + 16 * rows;
    return { mode, height, bitmapA, bitmapB, attrsA, middleA, middleB, sideA, sideB,
      size: sideB + 16 * rows };
  }

  /** Expand one .mg1 frame's mixed attributes to full 8x1. @private */
  _readMg1Attrs(bytes, layout, f) {
    const cols = 32;
    const lines = layout.mode.height;
    const side = f ? layout.sideB : layout.sideA;
    const middle = f ? layout.middleB : layout.middleA;
    const attrs = new Uint8Array(layout.mode.attrSize);
    for (let y = 0; y < lines; y++) {
      const sideRow = side + (y >> 3) * 16;
      for (let col = 0; col < cols; col++) {
        let src;
        if (col < 8) src = sideRow + col;
        else if (col < 24) src = middle + y * 16 + col;
        else src = sideRow + col - 16;
        attrs[y * cols + col] = bytes[src];
      }
    }
    return attrs;
  }

  /** Write one frame's full 8x1 attributes in .mg1's mixed layout. @private */
  _writeMg1Attrs(out, attrs, layout, f) {
    const cols = 32;
    const lines = layout.mode.height;
    const side = f ? layout.sideB : layout.sideA;
    const middle = f ? layout.middleB : layout.middleA;
    for (let y = 0; y < lines; y++) {
      for (let col = 8; col < 24; col++) out[middle + y * 16 + col] = attrs[y * cols + col];
    }
    // Side columns: each 8-line block keeps its most frequent attribute
    // (ties -> the first seen, the rule mode coarsening uses).
    for (let row = 0; row < lines / 8; row++) {
      for (const col of [0, 1, 2, 3, 4, 5, 6, 7, 24, 25, 26, 27, 28, 29, 30, 31]) {
        const counts = new Map();
        let best = attrs[row * 8 * cols + col];
        let bestN = 0;
        for (let l = 0; l < 8; l++) {
          const v = attrs[(row * 8 + l) * cols + col];
          const n = (counts.get(v) || 0) + 1;
          counts.set(v, n);
          if (n > bestN) { best = v; bestN = n; }
        }
        out[side + row * 16 + (col < 8 ? col : col - 16)] = best;
      }
    }
  }

  /** A 6912-byte standard screen as { bitmap, attrs }. @private */
  _split(scr) {
    const STD = SCREEN_MODES.STANDARD_ULA;
    return {
      bitmap: scr.subarray(0, STD.bitmapSize),
      attrs: scr.subarray(STD.bitmapSize, STD.fileSize)
    };
  }

  /**
   * Split a 13824-byte .img into its two 6912-byte screens. A 13952-byte
   * file is the same behind a 128-byte header, which RECOIL's DecodeGsc
   * skips unconditionally (a +3DOS disk header is exactly 128 bytes).
   * @private
   */
  _decodeImg(bytes) {
    const GIGA = SCREEN_MODES.GIGASCREEN;
    const STD = SCREEN_MODES.STANDARD_ULA;
    if (bytes.length === GIGA.fileSize + 128) bytes = bytes.subarray(128);
    if (bytes.length !== GIGA.fileSize) {
      return { error: `Invalid .img file size: ${bytes.length} bytes (expected ${GIGA.fileSize})` };
    }
    return {
      a: bytes.subarray(0, STD.fileSize),
      b: bytes.subarray(STD.fileSize, GIGA.fileSize)
    };
  }

  /**
   * Shared pair-import: switch to the two-screen mode, then screen A into
   * the current layer's first plane and screen B into its second.
   * @param {{bitmap: Uint8Array, attrs: Uint8Array}} a - screen A
   * @param {{bitmap: Uint8Array, attrs: Uint8Array}} b - screen B
   * @param {string} label - undo label
   * @param {Object} [mode=GIGASCREEN] - the two-screen mode to load into
   * @private
   */
  _importPair(a, b, label, mode = SCREEN_MODES.GIGASCREEN) {
    UndoRedoService.beginAction(label);

    if (window.ScreenModeService && ScreenModeService.getModeId() !== mode.id) {
      ScreenModeService.applyModeRaw(mode.id);
    }

    const layerA = LayerManager.getCurrentLayer();
    if (!layerA) {
      if (typeof UndoRedoService.cancelAction === 'function') UndoRedoService.cancelAction();
      else UndoRedoService.endAction();
      return { success: false, error: 'No active layer' };
    }
    SCRFormat.loadScreenIntoLayer(a.bitmap, a.attrs, layerA, 0);
    SCRFormat.loadScreenIntoLayer(b.bitmap, b.attrs, layerA, 1);

    LayerManager.composeToCanvas();
    UndoRedoService.endAction();

    Logger.info('GigascreenFormat', 'GigaScreen pair loaded');
    EventBus.emit(EVENTS.FILE_IMPORT, { format: 'img' });
    return { success: true };
  }

  // ── Export ────────────────────────────────────────────────────────────────

  /**
   * One screen's bytes - that plane of the flattened document, laid out as
   * SCRFormat.screenBytesFromLayer lays out the active mode (6912 in
   * GigaScreen). Two-screen modes only.
   * @param {number} n - Screen 0 (A) or 1 (B)
   * @param {Layer} [flat] - an already-flattened document, so export() does
   *   not flatten twice
   * @returns {Uint8Array}
   */
  subScreenBytes(n, flat = null) {
    if (ZX_SPECTRUM.SCREENS !== 2) {
      throw new Error(Helpers.localizedMessage('mode.exportNeedsGiga',
        'This format holds a GigaScreen pair - switch to GigaScreen mode first.'));
    }
    return SCRFormat.screenBytesFromLayer(flat || LayerManager.flattenVisible(), n);
  }

  /**
   * Whether export() would succeed in the active mode — the non-throwing
   * mirror used to filter the Save dialogs before the artist picks a
   * format.
   * @returns {boolean}
   */
  canExport() {
    // .img is two STANDARD 8x8 screens; the other two-screen modes have
    // their own containers (.mg1/2/4, .hrg).
    return ACTIVE_SCREEN_MODE === SCREEN_MODES.GIGASCREEN;
  }

  /**
   * Whether the document can be written as an MGH file of this attribute
   * height: a two-screen, 256-wide, fixed-palette mode whose cells are that
   * tall.
   * @param {number} height - 1, 2, 4 or 8
   * @returns {boolean}
   */
  canExportMg(height) {
    const layout = this._mgLayout(height);
    return !!layout && ACTIVE_SCREEN_MODE === layout.mode;
  }

  /**
   * Export the document as an MGH file (.mg1/.mg2/.mg4/.mg8).
   * @param {number} height - 1, 2, 4 or 8
   * @returns {Uint8Array}
   */
  exportMg(height) {
    if (!this.canExportMg(height)) {
      throw new Error(Helpers.localizedMessage('mode.exportNeedsGiga',
        'This format holds a GigaScreen pair - switch to GigaScreen mode first.'));
    }
    const layout = this._mgLayout(height);
    const bitmapSize = layout.mode.bitmapSize;
    const out = new Uint8Array(layout.size);
    out.set([0x4D, 0x47, 0x48, 1, height], 0); // 'MGH', version 1, height
    const flat = LayerManager.flattenVisible();
    for (let f = 0; f < 2; f++) {
      const scr = SCRFormat.screenBytesFromLayer(flat, f);
      out.set(scr.subarray(0, bitmapSize), f ? layout.bitmapB : layout.bitmapA);
      const attrs = scr.subarray(bitmapSize);
      if (height === 1) this._writeMg1Attrs(out, attrs, layout, f);
      else out.set(attrs, f ? layout.attrsB : layout.attrsA);
    }
    return out;
  }

  /** @param {number} height @param {string} filename */
  async exportMgAndDownload(height, filename, handle = null) {
    const ext = `.mg${height}`;
    let name = filename || `image${ext}`;
    if (!name.toLowerCase().endsWith(ext)) name = `${name}${ext}`;
    return FormatRegistry.download(this.exportMg(height), name, undefined, handle);
  }

  /**
   * Export the document as .img — the two flattened sub-screens back to
   * back. @returns {Uint8Array}
   */
  export() {
    const GIGA = SCREEN_MODES.GIGASCREEN;
    // The same gate as canExport(). The other pairs' screens are larger than
    // 6912 bytes and would overflow the fixed .img buffer, so they are sent
    // to their own container rather than failing with a RangeError.
    if (!this.canExport()) {
      if (ZX_SPECTRUM.SCREENS === 2) Helpers.assertNotPair();
      throw new Error(Helpers.localizedMessage('mode.exportNeedsGiga',
        'This format holds a GigaScreen pair - switch to GigaScreen mode first.'));
    }
    const flat = LayerManager.flattenVisible();
    const a = this.subScreenBytes(0, flat);
    const b = this.subScreenBytes(1, flat);
    const out = new Uint8Array(GIGA.fileSize);
    out.set(a, 0);
    out.set(b, a.length);
    return out;
  }

  /** @param {string} filename */
  async exportAndDownload(filename, handle = null) {
    let name = filename || 'image.img';
    if (!name.toLowerCase().endsWith('.img')) name = `${name}.img`;
    return FormatRegistry.download(this.export(), name, undefined, handle);
  }
}

// Create singleton
window.GigascreenFormat = new GigascreenFormatClass();

Logger.debug('GigascreenFormat', 'GigaScreen format handler loaded');

})(); // End IIFE
