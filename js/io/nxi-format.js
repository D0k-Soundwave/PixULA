'use strict';
(function() {

/**
 * ZX Spectrum Next Layer 2 / LoRes image formats (Phase 13).
 *
 * Layouts:
 *   .nxi — [512-byte palette][bitmap]. The palette block is 256 × 2-byte
 *     little pairs: byte0 = RRRGGGBB, byte1 bit0 = blue LSB — exactly
 *     RECOIL's DecodeNxi (49664 = 512 + 49152 for 256×192×8bpp; RECOIL
 *     decodes only that size — the 320×256/640×256 and LoRes containers
 *     below follow the same convention, as the Next tool ecosystem does).
 *     Raw palette-less bitmaps are also accepted on import (the document
 *     palette is kept).
 *   .sl2 — the raw Layer 2 bitmap dump (LOAD "…" LAYER format): no
 *     palette block, bytes row-major from the top-left.
 *
 * Bitmap packing: 8bpp = one byte per pixel; 4bpp (640×256, Radastan
 *   LoRes) = two pixels per byte, LEFT pixel in the high nibble.
 *
 * Size -> mode mapping (documented assumptions, chosen to round-trip our
 * own output; no public spec distinguishes them):
 *   49664/49152 -> LAYER2_256 · 12800/12288 -> LORES · 6656/6144 ->
 *   LORES_RADASTAN · 82432/81920 -> LAYER2_320, UNLESS the document is
 *   already in LAYER2_640 (the two share a byte count — 8bpp at 320 vs
 *   4bpp at 640); staying in the active mode makes our own exports
 *   round-trip.
 *
 * Import switches the document to the size's mode (raw switch inside the
 * undo action — one Undo restores the previous mode + content) and fills
 * the current layer's index grid. Export composites the visible layers
 * (background seeds every pixel, so the bitmap is fully opaque).
 */
class NXIFormatClass {

  initialize() {
    FormatRegistry.registerImport('nxi', this._adapter('nxi'));
    FormatRegistry.registerExport('nxi', this._adapter('nxi'));
    FormatRegistry.registerImport('sl2', this._adapter('sl2'));
    FormatRegistry.registerExport('sl2', this._adapter('sl2'));
    // .slr is the Next BASIC LoRes SAVE ... LAYER file (SpecNext wiki:
    // "128x96, 256 colours") — same raw-dump/palette conventions; the
    // byte length resolves the LoRes/Radastan variant via modeForLength.
    FormatRegistry.registerImport('slr', this._adapter('slr'));
    FormatRegistry.registerExport('slr', this._adapter('slr'));
    Logger.info('NXIFormat', 'Initialized (nxi/sl2/slr)');
  }

  /** Registry adapter. @private */
  _adapter(ext) {
    return {
      parse: (buffer) => this.parse(ext, buffer),
      export: () => this.export(ext),
      canExport: () => this.canExport(),
      exportAndDownload: (filename, options, handle) => this.exportAndDownload(ext, filename, handle)
    };
  }

  // ── Pure byte math (Node-tested) ──────────────────────────────────────────

  /**
   * Resolve a byte length to { mode, hasPalette } per the header comment.
   * @param {number} length - File length in bytes
   * @param {string} activeModeId - The document's current mode id
   * @returns {{mode: Object, hasPalette: boolean}|null}
   */
  modeForLength(length, activeModeId) {
    const M = SCREEN_MODES;
    const amb320 = activeModeId === M.LAYER2_640.id ? M.LAYER2_640 : M.LAYER2_320;
    const table = [
      [M.LAYER2_256.fileSize, M.LAYER2_256, true],
      [M.LAYER2_256.bitmapSize, M.LAYER2_256, false],
      [M.LAYER2_320.fileSize, amb320, true],
      [M.LAYER2_320.bitmapSize, amb320, false],
      [M.LORES.fileSize, M.LORES, true],
      [M.LORES.bitmapSize, M.LORES, false],
      [M.LORES_RADASTAN.fileSize, M.LORES_RADASTAN, true],
      [M.LORES_RADASTAN.bitmapSize, M.LORES_RADASTAN, false]
    ];
    for (const [size, mode, hasPalette] of table) {
      if (length === size) return { mode, hasPalette };
    }
    return null;
  }

  /**
   * Unpack a bitmap block to a full-screen index array.
   * @param {Uint8Array} bytes - mode.bitmapSize bytes
   * @param {Object} mode - Descriptor (pixelDepth 4 or 8)
   * @returns {Int16Array} width*height palette indices
   */
  unpackBitmap(bytes, mode) {
    const n = mode.width * mode.height;
    const out = new Int16Array(n);
    if (mode.pixelDepth === 8) {
      for (let i = 0; i < n; i++) out[i] = bytes[i];
    } else {
      for (let i = 0; i < n; i++) {
        const b = bytes[i >> 1];
        out[i] = (i & 1) ? (b & 0x0F) : (b >> 4);
      }
    }
    return out;
  }

  /**
   * Pack a full-screen index array into the mode's bitmap block.
   * @param {Int16Array|number[]} indices - width*height palette indices
   * @param {Object} mode - Descriptor (pixelDepth 4 or 8)
   * @returns {Uint8Array} mode.bitmapSize bytes
   */
  packBitmap(indices, mode) {
    const out = new Uint8Array(mode.bitmapSize);
    const n = mode.width * mode.height;
    if (mode.pixelDepth === 8) {
      for (let i = 0; i < n; i++) out[i] = indices[i] & 0xFF;
    } else {
      for (let i = 0; i < n; i++) {
        const v = indices[i] & 0x0F;
        out[i >> 1] |= (i & 1) ? v : (v << 4);
      }
    }
    return out;
  }

  /**
   * Decode a 512-byte .nxi/.pal palette block to 256 9-bit registers.
   * @param {Uint8Array} bytes - 512 bytes
   * @returns {Uint16Array}
   */
  decodePalette(bytes) {
    const regs = new Uint16Array(256);
    for (let i = 0; i < 256; i++) {
      regs[i] = NEXTRGB333.bytesToRegister(bytes[i * 2], bytes[i * 2 + 1]);
    }
    return regs;
  }

  /**
   * Encode 256 9-bit registers as the 512-byte palette block.
   * @param {Uint16Array|number[]} regs
   * @returns {Uint8Array}
   */
  encodePalette(regs) {
    const out = new Uint8Array(512);
    for (let i = 0; i < 256; i++) {
      const [b0, b1] = NEXTRGB333.registerToBytes(regs[i]);
      out[i * 2] = b0;
      out[i * 2 + 1] = b1;
    }
    return out;
  }

  // ── Import ────────────────────────────────────────────────────────────────

  /**
   * Parse a .nxi/.sl2 image.
   * @param {string} ext - 'nxi' | 'sl2'
   * @param {ArrayBuffer} buffer
   * @returns {Object} { success } | { success: false, error }
   */
  parse(ext, buffer) {
    let bytes = new Uint8Array(buffer);
    // Files saved on a +3DOS filesystem carry a 128-byte header (the
    // SpecNext wiki documents .sl2 as "+3DOS header + pixel data"; files
    // from esxDOS SD cards are headerless). Strip it by signature so both
    // survive the size->mode resolution.
    if (bytes.length > 128 && String.fromCharCode(...bytes.subarray(0, 8)) === 'PLUS3DOS') {
      bytes = bytes.subarray(128);
    }
    const activeId = window.ScreenModeService
      ? ScreenModeService.getModeId() : SCREEN_MODES.STANDARD_ULA.id;
    const resolved = this.modeForLength(bytes.length, activeId);
    if (!resolved) {
      return {
        success: false,
        error: `Invalid .${ext} file size: ${bytes.length} bytes`
      };
    }

    const { mode, hasPalette } = resolved;
    const palette = hasPalette ? this.decodePalette(bytes.subarray(0, 512)) : null;
    const bitmap = bytes.subarray(hasPalette ? 512 : 0);
    const indices = this.unpackBitmap(bitmap, mode);

    UndoRedoService.beginAction(`Load ${ext.toUpperCase()}`);

    if (window.ScreenModeService && ScreenModeService.getModeId() !== mode.id) {
      ScreenModeService.applyModeRaw(mode.id);
    }
    if (palette && window.ColorManager) {
      ColorManager.setNextRegisters(palette);
    }

    const layer = LayerManager.getCurrentLayer();
    if (!layer) {
      if (typeof UndoRedoService.cancelAction === 'function') UndoRedoService.cancelAction();
      else UndoRedoService.endAction();
      return { success: false, error: 'No active layer' };
    }

    // Bulk fill of the layer's index grid (documented bulk exception —
    // wrapped in the undo action, cells marked altered, recompose below)
    for (let y = 0; y < mode.height; y++) {
      for (let x = 0; x < mode.width; x++) {
        layer.setPixelIndex(x, y, indices[y * mode.width + x]);
      }
    }

    LayerManager.composeToCanvas();
    UndoRedoService.endAction();

    Logger.info('NXIFormat', `Loaded .${ext} (${mode.id})`);
    EventBus.emit(EVENTS.FILE_IMPORT, { format: ext });
    return { success: true };
  }

  // ── Export ────────────────────────────────────────────────────────────────

  /**
   * Export the composited document. .nxi = palette + bitmap; .sl2 = raw
   * bitmap. Indexed modes only (localized gate).
   * @param {string} ext - 'nxi' | 'sl2'
   * @returns {Uint8Array}
   */
  /**
   * Whether export(ext) would succeed in the active mode — the
   * non-throwing mirror used to filter the Save dialogs before the artist
   * picks a format. Same condition for nxi/sl2/slr — ext is unused, kept
   * only so the adapter's shape matches export()'s.
   * @returns {boolean}
   */
  canExport() {
    return ACTIVE_SCREEN_MODE.pixelDepth !== 1;
  }

  export(ext) {
    const mode = ACTIVE_SCREEN_MODE;
    if (mode.pixelDepth === 1) {
      throw new Error(Helpers.localizedMessage('mode.exportNeedsIndexed',
        'This format holds ZX Spectrum Next indexed screens — switch to a Layer 2 or LoRes mode first.'));
    }

    // Composite: the flattened layer's cells seed from the background, so
    // every pixel has an index
    const flattened = LayerManager.flattenVisible();
    const indices = new Int16Array(mode.width * mode.height);
    for (let y = 0; y < mode.height; y++) {
      for (let x = 0; x < mode.width; x++) {
        const idx = flattened.getPixelIndex(x, y);
        indices[y * mode.width + x] = idx >= 0 ? idx : 0;
      }
    }
    const bitmap = this.packBitmap(indices, mode);

    // .sl2 / .slr are the raw LAYER-save dumps (no palette block)
    if (ext === 'sl2' || ext === 'slr') return bitmap;

    const out = new Uint8Array(mode.fileSize);
    out.set(this.encodePalette(
      window.ColorManager ? ColorManager.getNextRegisters() : NEXTRGB333.defaultRegisters()), 0);
    out.set(bitmap, 512);
    return out;
  }

  /**
   * @param {string} ext - 'nxi' | 'sl2'
   * @param {string} filename
   */
  async exportAndDownload(ext, filename, handle = null) {
    let name = filename || `image.${ext}`;
    if (!name.toLowerCase().endsWith(`.${ext}`)) name = `${name}.${ext}`;
    return FormatRegistry.download(this.export(ext), name, undefined, handle);
  }
}

window.NXIFormat = new NXIFormatClass();

Logger.debug('NXIFormat', 'NXI format handler loaded');

})(); // End IIFE
