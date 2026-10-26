'use strict';
(function() {

/**
 * Palette files — .pal and .npl. The FILE SIZE designates the palette
 * kind (documented rule — the three sizes cannot collide):
 *
 *   64 bytes  — a ULAplus palette: the 64 G3R3B2 registers in CLUT order
 *     (the same block the 6976-byte SCR appends). Import replaces the
 *     document's ULAplus register file; export emits it when a ulaplus64
 *     mode is active.
 *   512 bytes — a Next palette (.pal per the SpecNext wiki File Formats
 *     page): 256 × 2-byte little pairs, byte0 = RRRGGGBB, byte1 =
 *     %P000000B (bit0 = blue LSB, bit7 = the Layer 2 priority bit — the
 *     nreg $44 write pair; layout per RECOIL DecodeNxi). We do not model
 *     pixel priority: the P bit is DROPPED on import and written 0 on
 *     export (documented; colour round-trips exactly).
 *   513 bytes — a Next palette in the .npl form (SpecNext wiki: "first
 *     512 bytes identical to .pal, byte 513 is the transparency index").
 *     Import reads the palette and ignores the transparency byte (the
 *     editor has no global-transparency document state); .npl export
 *     appends the conventional default transparency index $E3.
 *   256 bytes — a Next palette, accepted on import only: 8-bit RRRGGGBB
 *     entries, the blue LSB expanding to the OR of the two blue bits (the
 *     hardware's 8-bit palette write rule, nreg $41).
 *
 * Each kind only applies to its own register file — a 64-byte file never
 * touches the Next registers and vice versa. Import replaces the matching
 * register file inside an undo action (any mode — the palette shows when
 * a mode of that palette model is active or next entered); export picks
 * the kind from the ACTIVE mode's palette model (ULAplus modes -> 64
 * bytes, rgb333 modes -> 512-byte .pal / 513-byte .npl; other modes have
 * no editable palette and refuse with a localized message).
 *
 * Both extensions accept every kind on import (be liberal — the sizes
 * cannot collide); exports round-trip.
 */
class NextPaletteFormatClass {

  initialize() {
    for (const ext of ['pal', 'npl']) {
      FormatRegistry.registerImport(ext, this._adapter(ext));
      FormatRegistry.registerExport(ext, this._adapter(ext));
    }
    Logger.info('NextPaletteFormat', 'Initialized (pal/npl)');
  }

  /** Registry adapter. @private */
  _adapter(ext) {
    return {
      // A palette file puts a palette into the document; it is not the document, so opening one
      // must not rename the open file (Ctrl+S would then overwrite the palette).
      importsDocument: false,
      parse: (buffer) => this.parse(ext, buffer),
      export: () => this.export(ext),
      canExport: () => this.canExport(),
      exportAndDownload: (filename, options, handle) => this.exportAndDownload(ext, filename, handle)
    };
  }

  // ── Pure byte math (Node-tested) ──────────────────────────────────────────

  /**
   * Decode ULAplus palette bytes (the 64-byte form).
   * @param {Uint8Array} bytes - 64 G3R3B2 register bytes
   * @returns {Uint8Array|null} null when the size is wrong
   */
  decodeUlaplus(bytes) {
    return bytes.length === 64 ? Uint8Array.from(bytes) : null;
  }

  /**
   * Encode 64 ULAplus registers as the 64-byte form.
   * @param {Uint8Array|number[]} regs
   * @returns {Uint8Array}
   */
  encodeUlaplus(regs) {
    return Uint8Array.from(regs);
  }

  /**
   * Decode NEXT palette bytes to 256 9-bit registers.
   * @param {Uint8Array} bytes - 512 (2-byte pairs), 513 (.npl: + trailing
   *   transparency index, ignored) or 256 (8-bit) bytes
   * @returns {Uint16Array|null} null when the size fits neither form
   */
  decode(bytes) {
    if (bytes.length === 512 || bytes.length === 513) {
      const regs = new Uint16Array(256);
      for (let i = 0; i < 256; i++) {
        regs[i] = NEXTRGB333.bytesToRegister(bytes[i * 2], bytes[i * 2 + 1]);
      }
      return regs;
    }
    if (bytes.length === 256) {
      const regs = new Uint16Array(256);
      for (let i = 0; i < 256; i++) regs[i] = NEXTRGB333.byteToRegister(bytes[i]);
      return regs;
    }
    return null;
  }

  /**
   * Encode 256 9-bit registers as the 512-byte form.
   * @param {Uint16Array|number[]} regs
   * @returns {Uint8Array}
   */
  encode(regs) {
    const out = new Uint8Array(512);
    for (let i = 0; i < 256; i++) {
      const [b0, b1] = NEXTRGB333.registerToBytes(regs[i]);
      out[i * 2] = b0;
      out[i * 2 + 1] = b1;
    }
    return out;
  }

  // ── Import / export ───────────────────────────────────────────────────────

  /**
   * @param {string} ext - 'pal' | 'npl'
   * @param {ArrayBuffer} buffer
   * @returns {Object} { success } | { success: false, error }
   */
  // ── ZX Paintbrush's .pal (the standard Spectrum colours) ─────────────────
  //
  // Layout [M, Brights.pal, 256 bytes, hex dump 2026-10-10]: 64 entries of 4 bytes R,G,B,0 in ULAplus
  // CLUT order (CLUT = flash*2 + bright; within a CLUT entries 0-7 are the ink half, 8-15 the paper
  // half). The normal colours are entries 0-7 and the bright colours entries 16-23; the file repeats
  // each set in the paper half and in CLUTs 2 and 3. All 64 pad bytes are 0. Brights.pal's own bright
  // black is a dark grey (32,32,32); PixULA keeps black as black however bright (that colour is dropped).
  // This is read only from Preferences: File > Open still treats a 256-byte .pal as a Next palette.

  /**
   * The 16 standard colours of a ZX Paintbrush .pal.
   * @param {Uint8Array} bytes - exactly 256 bytes with every pad byte 0
   * @returns {?{hex16: string[], brightBlackDropped: boolean}} null if it is not that layout
   */
  decodeStandardColours(bytes) {
    if (!bytes || bytes.length !== 256) return null;
    for (let i = 3; i < 256; i += 4) if (bytes[i] !== 0) return null;
    const hex = (entry) => '#' + [0, 1, 2].map(k => bytes[entry * 4 + k].toString(16).padStart(2, '0')).join('').toUpperCase();
    const hex16 = [];
    for (let i = 0; i < 8; i++) hex16.push(hex(i));
    hex16.push(hex16[0]);                           // bright black is black
    for (let i = 1; i < 8; i++) hex16.push(hex(16 + i));
    return { hex16, brightBlackDropped: hex(16) !== hex16[0] };
  }

  /**
   * The 256-byte ZX Paintbrush .pal for 16 standard colours (the layout above).
   * @param {string[]} hex16 - '#RRGGBB' x 16; index 8 is ignored (black)
   * @returns {Uint8Array}
   */
  encodeStandardColours(hex16) {
    const out = new Uint8Array(256);
    const rgb = (h) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
    for (let clut = 0; clut < 4; clut++) {
      const bright = (clut & 1) === 1;
      for (let i = 0; i < 16; i++) {
        const colour = i & 7;
        out.set(rgb(hex16[bright ? 8 + colour : colour]), (clut * 16 + i) * 4);
      }
    }
    return out;
  }

  parse(ext, buffer) {
    const bytes = new Uint8Array(buffer);

    // 64 bytes -> ULAplus palette (the size designates the kind)
    const upRegs = this.decodeUlaplus(bytes);
    if (upRegs) {
      UndoRedoService.beginAction(`Load ${ext.toUpperCase()}`);
      ColorManager.setUlaplusRegisters(upRegs);
      if (ACTIVE_SCREEN_MODE.paletteModel === 'ulaplus64') {
        LayerManager.composeToCanvas();
      }
      UndoRedoService.endAction();
      Logger.info('NextPaletteFormat', `Loaded .${ext} ULAplus palette`);
      EventBus.emit(EVENTS.FILE_IMPORT, { format: ext });
      return { success: true };
    }

    // 512 / 513 / 256 bytes -> Next palette
    const regs = this.decode(bytes);
    if (!regs) {
      return {
        success: false,
        error: Helpers.localizedMessage('err.fileSize',
            'Invalid .{ext} file size: {size} bytes (expected {expected})', { ext, size: bytes.length, expected: '64, 256, 512, 513' })
      };
    }

    UndoRedoService.beginAction(`Load ${ext.toUpperCase()}`);
    ColorManager.setNextRegisters(regs);
    if (ACTIVE_SCREEN_MODE.paletteModel === 'rgb333') {
      LayerManager.composeToCanvas();
    }
    UndoRedoService.endAction();

    Logger.info('NextPaletteFormat', `Loaded .${ext} palette`);
    EventBus.emit(EVENTS.FILE_IMPORT, { format: ext });
    return { success: true };
  }

  /**
   * Export the ACTIVE mode's editable palette: 64 bytes in ULAplus modes;
   * in rgb333 modes the 512-byte register dump (.pal) or the 513-byte
   * .npl form with the default transparency index $E3 appended.
   * @param {string} [ext] - 'pal' | 'npl' (default 'pal')
   * @returns {Uint8Array}
   */
  /**
   * Whether export() would succeed in the active mode — the non-throwing
   * mirror used to filter the Save dialogs before the artist picks a
   * format. Same condition for pal/npl.
   * @returns {boolean}
   */
  canExport() {
    const model = ACTIVE_SCREEN_MODE.paletteModel;
    return model === 'ulaplus64' || model === 'rgb333';
  }

  export(ext = 'pal') {
    const model = ACTIVE_SCREEN_MODE.paletteModel;
    if (model === 'ulaplus64') {
      return this.encodeUlaplus(window.ColorManager
        ? ColorManager.getUlaplusRegisters() : ULAPLUS.defaultRegisters());
    }
    if (model === 'rgb333') {
      const pal = this.encode(window.ColorManager
        ? ColorManager.getNextRegisters() : NEXTRGB333.defaultRegisters());
      if (ext !== 'npl') return pal;
      const npl = new Uint8Array(513);
      npl.set(pal);
      npl[512] = 0xE3; // conventional Next default transparency index
      return npl;
    }
    throw new Error(Helpers.localizedMessage('mode.palNeedsPaletteMode',
      'Palette export needs a mode with an editable palette - switch to a ULAplus or Next mode first.'));
  }

  /**
   * @param {string} ext - 'pal' | 'npl'
   * @param {string} filename
   */
  async exportAndDownload(ext, filename, handle = null) {
    let name = filename || `palette.${ext}`;
    if (!name.toLowerCase().endsWith(`.${ext}`)) name = `${name}.${ext}`;
    return FormatRegistry.download(this.export(ext), name, undefined, handle);
  }
}

window.NextPaletteFormat = new NextPaletteFormatClass();

Logger.debug('NextPaletteFormat', 'Next palette format handler loaded');

})(); // End IIFE
