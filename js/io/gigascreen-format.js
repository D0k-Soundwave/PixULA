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
 *   .mg / .mg1 / .mg2 / .mg4 / .mg8 (import only) — RECOIL_DecodeMg:
 *        'MGH' + version 1 header byte, byte 4 = attribute height
 *        (1/2/4/8; MultiArtist names files by that height); 256-byte
 *        header, the two interleaved bitmaps at 256 and 256+6144,
 *        attribute blocks after both bitmaps. Height 8 imports as a
 *        GigaScreen pair; heights 1/2/4 cannot pair in our GigaScreen
 *        model (8×8 cells only), so — like .hrg — the FIRST sub-screen
 *        imports into the matching multicolor mode and the second is
 *        dropped (documented loss; height 1's mixed side/middle layout
 *        expands to full per-line 8×1 attributes).
 *   .hlr (import only) — RECOIL_DecodeHlr: 1628-byte attribute
 *        GigaScreen (7-byte Z80 stub, 8 pattern-row bytes at 84, two
 *        768-byte attribute frames at 92/860) — imports as a pair with
 *        the pattern bitmap made editable.
 *
 * Import switches the document to GigaScreen mode (raw switch inside the
 * undo action), loads sub-screen A into the current layer and sub-screen B
 * into a new layer tagged gigaScreen = 1. Export requires GigaScreen mode
 * (any other mode has no second sub-screen to write) and serializes each
 * sub-screen's flattened composite — layers tagged A and B respectively,
 * both over the shared background.
 *
 * The GIF exporter uses subScreenBytes() to emit the two sub-screens as a
 * fast two-frame flicker loop — the animated preview seam.
 */
class GigascreenFormatClass {

  initialize() {
    FormatRegistry.registerImport('img', this._adapter('img'));
    FormatRegistry.registerExport('img', this._adapter('img'));
    // MultiArtist names its files by attribute height — RECOIL's format
    // list has MG1/MG2/MG4/MG8, not a bare .mg. The MGH header byte
    // governs either way: height 8 (.mg8) loads, the multicolor
    // sub-variants get the localized reject. Bare .mg stays as the
    // family alias.
    for (const ext of ['mg', 'mg1', 'mg2', 'mg4', 'mg8']) {
      FormatRegistry.registerImport(ext, this._adapter(ext));
    }
    // .hlr attribute GigaScreen (RECOIL parity, import only)
    FormatRegistry.registerImport('hlr', this._adapter('hlr'));
    Logger.info('GigascreenFormat', 'Initialized (img/mg/mg1-8/hlr)');
  }

  /** Registry adapter — the registry passes no extension to parse(). @private */
  _adapter(ext) {
    return {
      parse: (buffer) => this.parse(ext, buffer),
      export: () => this.export(),
      exportAndDownload: (filename) => this.exportAndDownload(filename)
    };
  }

  // ── Import ────────────────────────────────────────────────────────────────

  /**
   * Parse a GigaScreen container.
   * @param {string} ext - 'img' | 'mg'
   * @param {ArrayBuffer} buffer
   * @returns {Object} { success } | { success: false, error }
   */
  parse(ext, buffer) {
    const bytes = new Uint8Array(buffer);
    if (ext === 'hlr') return this._parseHlr(bytes);
    if (ext.startsWith('mg')) return this._parseMg(bytes);
    const screens = this._decodeImg(bytes);
    if (screens.error) return { success: false, error: screens.error };
    return this._importPair(screens.a, screens.b, `Load ${ext.toUpperCase()}`);
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
    return this._importPair(buildScreen(92), buildScreen(860), 'Load HLR');
  }

  /**
   * Parse an MGH container (RECOIL_DecodeMg): 'MGH' + version 1, byte 4 =
   * attribute height. Height 8 imports as a GigaScreen pair; the
   * MultiArtist multicolor sub-variants (1/2/4) cannot pair in our
   * GigaScreen model (8×8 cells only), so — like .hrg — the FIRST
   * sub-screen imports into the matching multicolor mode and the second
   * is dropped (documented loss). Height 1 uses MultiArtist's mixed
   * layout (8×8 side columns at 18688/19072, per-line middle 16 columns
   * at 12536/15608), expanded to full per-line attributes — 8×1 is the
   * superset. @private
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
    if (height === 8) {
      const screens = this._decodeMg(bytes);
      if (screens.error) return { success: false, error: screens.error };
      return this._importPair(screens.a, screens.b, 'Load MG');
    }

    if (height === 2 || height === 4) {
      const mode = height === 2
        ? SCREEN_MODES.MULTICOLOR_8x2 : SCREEN_MODES.MULTICOLOR_8x4;
      const expected = 12544 + 2 * mode.attrSize;
      if (bytes.length !== expected) {
        return {
          success: false,
          error: `Invalid .mg file size: ${bytes.length} bytes (expected ${expected})`
        };
      }
      return SCRFormat.importScreen(
        bytes.slice(HEADER, HEADER + STD.bitmapSize),
        bytes.slice(12544, 12544 + mode.attrSize),
        mode.id, 'Load MG');
    }

    if (height === 1) {
      if (bytes.length !== 19456) {
        return {
          success: false,
          error: `Invalid .mg file size: ${bytes.length} bytes (expected 19456)`
        };
      }
      const MC1 = SCREEN_MODES.MULTICOLOR_8x1;
      const attrs = new Uint8Array(MC1.attrSize);
      for (let y = 0; y < STD.height; y++) {
        const sideRow = 18688 + (y >> 3) * 16;
        for (let col = 0; col < 32; col++) {
          let src;
          if (col < 8) src = sideRow + col;
          else if (col < 24) src = 12536 + y * 16 + col;
          else src = sideRow + col - 16;
          attrs[y * 32 + col] = bytes[src];
        }
      }
      return SCRFormat.importScreen(
        bytes.slice(HEADER, HEADER + STD.bitmapSize), attrs, MC1.id, 'Load MG');
    }

    return {
      success: false,
      error: `Unsupported .mg attribute height: ${height}`
    };
  }

  /** Split a 13824-byte .img into its two 6912-byte screens. @private */
  _decodeImg(bytes) {
    const GIGA = SCREEN_MODES.GIGASCREEN;
    const STD = SCREEN_MODES.STANDARD_ULA;
    if (bytes.length !== GIGA.fileSize) {
      return { error: `Invalid .img file size: ${bytes.length} bytes (expected ${GIGA.fileSize})` };
    }
    return {
      a: bytes.subarray(0, STD.fileSize),
      b: bytes.subarray(STD.fileSize, GIGA.fileSize)
    };
  }

  /**
   * Decode an MGH container into two 6912-byte screen buffers (byte 4 = 8
   * only — see the header comment). @private
   */
  _decodeMg(bytes) {
    const STD = SCREEN_MODES.STANDARD_ULA;
    const HEADER = 256;
    if (bytes.length < HEADER
        || bytes[0] !== 0x4D || bytes[1] !== 0x47 || bytes[2] !== 0x48 // 'MGH'
        || bytes[3] !== 1) {
      return { error: 'Not an MGH GigaScreen file' };
    }
    if (bytes[4] !== 8) {
      return {
        error: Helpers.localizedMessage('mode.mgUnsupportedAttrs',
          'Only .mg files with standard 8×8 attributes can be imported.')
      };
    }
    const expected = HEADER + 2 * STD.fileSize;
    if (bytes.length !== expected) {
      return { error: `Invalid .mg file size: ${bytes.length} bytes (expected ${expected})` };
    }
    const b1 = HEADER;
    const b2 = HEADER + STD.bitmapSize;
    const attrs = HEADER + 2 * STD.bitmapSize;
    const a = new Uint8Array(STD.fileSize);
    a.set(bytes.subarray(b1, b1 + STD.bitmapSize), 0);
    a.set(bytes.subarray(attrs, attrs + STD.attrSize), STD.bitmapSize);
    const b = new Uint8Array(STD.fileSize);
    b.set(bytes.subarray(b2, b2 + STD.bitmapSize), 0);
    b.set(bytes.subarray(attrs + STD.attrSize, attrs + 2 * STD.attrSize), STD.bitmapSize);
    return { a, b };
  }

  /**
   * Shared pair-import: switch to GigaScreen mode, sub-screen A into the
   * current layer, sub-screen B into a new tagged layer. @private
   */
  _importPair(a, b, label) {
    const GIGA = SCREEN_MODES.GIGASCREEN;
    const STD = SCREEN_MODES.STANDARD_ULA;
    UndoRedoService.beginAction(label);

    if (window.ScreenModeService && ScreenModeService.getModeId() !== GIGA.id) {
      ScreenModeService.applyModeRaw(GIGA.id);
    }

    const layerA = LayerManager.getCurrentLayer();
    if (!layerA) {
      if (typeof UndoRedoService.cancelAction === 'function') UndoRedoService.cancelAction();
      else UndoRedoService.endAction();
      return { success: false, error: 'No active layer' };
    }
    layerA.gigaScreen = 0;
    SCRFormat.loadScreenIntoLayer(
      a.subarray(0, STD.bitmapSize), a.subarray(STD.bitmapSize, STD.fileSize), layerA);

    const layerB = LayerManager.addLayer('Screen B', false);
    if (layerB) {
      layerB.gigaScreen = 1;
      SCRFormat.loadScreenIntoLayer(
        b.subarray(0, STD.bitmapSize), b.subarray(STD.bitmapSize, STD.fileSize), layerB);
    }

    LayerManager.composeToCanvas();
    UndoRedoService.endAction();

    Logger.info('GigascreenFormat', 'GigaScreen pair loaded');
    EventBus.emit(EVENTS.FILE_IMPORT, { format: 'img' });
    return { success: true };
  }

  // ── Export ────────────────────────────────────────────────────────────────

  /**
   * One sub-screen's 6912 bytes — the flattened composite of the layers
   * tagged for it over the shared background. GigaScreen mode only.
   * @param {number} n - Sub-screen 0 (A) or 1 (B)
   * @returns {Uint8Array}
   */
  subScreenBytes(n) {
    if ((ACTIVE_SCREEN_MODE.screens || 1) !== 2) {
      throw new Error(Helpers.localizedMessage('mode.exportNeedsGiga',
        'This format holds a GigaScreen pair — switch to GigaScreen mode first.'));
    }
    return SCRFormat.screenBytesFromLayer(
      LayerManager.flattenVisible({ gigaScreen: n }));
  }

  /**
   * Export the document as .img — the two flattened sub-screens back to
   * back. @returns {Uint8Array}
   */
  export() {
    const GIGA = SCREEN_MODES.GIGASCREEN;
    const a = this.subScreenBytes(0);
    const b = this.subScreenBytes(1);
    const out = new Uint8Array(GIGA.fileSize);
    out.set(a, 0);
    out.set(b, a.length);
    return out;
  }

  /** @param {string} filename */
  exportAndDownload(filename) {
    let name = filename || 'image.img';
    if (!name.toLowerCase().endsWith('.img')) name = `${name}.img`;
    FormatRegistry.download(this.export(), name);
  }
}

// Create singleton
window.GigascreenFormat = new GigascreenFormatClass();

Logger.debug('GigascreenFormat', 'GigaScreen format handler loaded');

})(); // End IIFE
