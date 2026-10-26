'use strict';
(function() {

/**
 * TAP Format Handler
 *
 * ZX Spectrum tape image (.tap) — the format loadable on original hardware
 * via tape audio, TZXDuino/CasDuino, or DivMMC.
 *
 * Export produces a 4-block tape:
 *   1. BASIC header  — "Program: <name>", autostart line 10
 *   2. BASIC data    — tokenized loader:
 *        10 BORDER b: PAPER b: INK i: CLS: LOAD ""SCREEN$: PAUSE 0
 *   3. CODE header   — "Bytes: <name>", start 16384, length = screen size
 *   4. CODE data     — the SCREEN$ bytes (composited via SCRFormat)
 *
 * Each TAP block: [len lo][len hi][flag][data...][checksum], where
 * len = data.length + 2 and checksum = XOR of flag and all data bytes.
 *
 * Import scans the tape for the first SCREEN$-sized data block (any game's
 * loading screen) and loads it through SCRFormat.
 */
class TAPFormatClass {
  constructor() {
    // Tape SCREEN$ blocks are the STANDARD ULA screen size by definition —
    // pinned to that descriptor, not the (runtime-switchable) active mode.
    this.SCREEN_SIZE = SCREEN_MODES.STANDARD_ULA.fileSize;
    this.SCREEN_ADDR = 16384;

    // Sinclair BASIC token bytes used by the loader
    this.TOKENS = Object.freeze({
      BORDER: 0xE7,
      PAPER: 0xDA,
      INK: 0xD9,
      CLS: 0xFB,
      LOAD: 0xEF,
      RANDOMIZE: 0xF9,
      USR: 0xC0,
      VAL: 0xB0,
      PEEK: 0xBE,
      REM: 0xEA,
      SCREEN$: 0xAA,
      PAUSE: 0xF2
    });
  }

  /**
   * Initialize and register with FormatRegistry
   */
  initialize() {
    FormatRegistry.registerImport('tap', this);
    FormatRegistry.registerExport('tap', this);
    Logger.info('TAPFormat', 'Initialized');
  }

  /**
   * Parse TAP file data — finds the first SCREEN$-sized data block
   * @param {ArrayBuffer} buffer - File data
   * @returns {Object} { success: true } or { success: false, error: string }
   */
  parse(buffer) {
    const bytes = new Uint8Array(buffer);
    let pos = 0;

    while (pos + 2 <= bytes.length) {
      const blockLen = bytes[pos] | (bytes[pos + 1] << 8);
      const blockStart = pos + 2;

      if (blockLen < 2 || blockStart + blockLen > bytes.length) {
        break; // malformed or truncated block — stop scanning
      }

      const flag = bytes[blockStart];
      const payloadLen = blockLen - 2; // minus flag and checksum

      // Data block (flag >= 0x80; 0xFF for standard ROM loaders) holding
      // exactly one screen. Checksum is not enforced — be lenient on import.
      if (flag >= 0x80 && payloadLen === this.SCREEN_SIZE) {
        const payload = bytes.slice(blockStart + 1, blockStart + 1 + this.SCREEN_SIZE);
        const result = SCRFormat.parse(payload.buffer);
        if (result.success) {
          Logger.info('TAPFormat', 'Loaded SCREEN$ block from TAP');
          EventBus.emit(EVENTS.FILE_IMPORT, { format: 'tap' });
        }
        return result;
      }

      pos = blockStart + blockLen;
    }

    // No screen on the tape: it may be a ULAplus palette tape (one program block that sets the
    // 64 palette registers). Load the palette instead of failing.
    if (this.findUlaplusPalette(bytes)) return this.loadUlaplusPalette(bytes);

    return {
      success: false,
      error: Helpers.localizedMessage('err.tapNoScreenOrPalette',
          'No {size}-byte SCREEN$ block and no ULAplus palette found in the {format} file',
          { size: this.SCREEN_SIZE, format: 'TAP' })
    };
  }

  // ── ULAplus palette tapes (Batch 6 part 6B) ───────────────────────────────

  /**
   * Whether opening this tape replaces the document. A tape that holds a screen does; a tape that
   * holds only a ULAplus palette does not (it must not become the open file, or Ctrl+S would write a
   * screen tape over it).
   * @param {ArrayBuffer|Uint8Array} buffer
   * @returns {boolean}
   */
  importsDocumentFor(buffer) {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    let pos = 0;
    while (pos + 2 <= bytes.length) {
      const blockLen = bytes[pos] | (bytes[pos + 1] << 8);
      const blockStart = pos + 2;
      if (blockLen < 2 || blockStart + blockLen > bytes.length) break;
      if (bytes[blockStart] >= 0x80 && blockLen - 2 === this.SCREEN_SIZE) return true;
      pos = blockStart + blockLen;
    }
    return !this.findUlaplusPalette(bytes);
  }

  /**
   * Build a ULAplus palette tape: 176 bytes. A Program header and a one-line BASIC program
   *   10 RANDOMIZE USR (46 + PEEK 23635 + 256 * PEEK 23636): LOAD "": REM <routine> <64 palette bytes>
   * The routine sits 46 bytes after the start of the program (4 bytes of line number and length,
   * then the 42 bytes of BASIC), which is where PEEK 23635/6 (PROG) plus 46 points. It writes the 64
   * registers to the ULAplus ports and switches the palette on; `LOAD ""` then loads whatever
   * follows on the tape, so a palette tape can be put in front of a picture or game tape.
   * ULAplus ports [P, ULAplus specification, sinclair.wiki.zxnet.co.uk/wiki/ULAplus]: register port
   * 0xBF3B (bits 7-6 the group: 00 = palette entry 0-63, 01 = mode), data port 0xFF3B.
   * [C] 176 = 21 (header block) + 2 + 1 + 151 (program) + 1 (checksum); 151 = 4 + 147;
   * 147 = 42 (BASIC) + 40 (routine, 35 bytes plus 5 of padding) + 64 (palette) + 1 (0x0D).
   * @param {Uint8Array|number[]} registers - the 64 G3R3B2 registers
   * @param {string} [name] - tape name (up to 10 characters)
   * @returns {Uint8Array}
   */
  buildUlaplusPaletteTap(registers, name) {
    const T = this.TOKENS;
    const q = (text) => [0x22, ...Array.from(text).map(c => c.charCodeAt(0)), 0x22];
    // RANDOMIZE USR (VAL "46" + PEEK VAL "23635" + VAL "256" * PEEK VAL "23636"): LOAD "": REM
    const basic = [
      T.RANDOMIZE, T.USR, 0x28,
      T.VAL, ...q('46'), 0x2B,
      T.PEEK, T.VAL, ...q('23635'), 0x2B,
      T.VAL, ...q('256'), 0x2A,
      T.PEEK, T.VAL, ...q('23636'), 0x29,
      0x3A, T.LOAD, 0x22, 0x22, 0x3A, T.REM
    ];
    // Z80, assembled by hand from the port specification above. USR enters with BC = its own
    // address; IY and HL' are left alone, so BASIC carries on.
    const routine = [
      0x21, 0x28, 0x00,       // LD HL,40         palette is 40 bytes after the routine
      0x09,                   // ADD HL,BC        HL -> the 64 palette bytes
      0x0E, 0x3B,             // LD C,3Bh         low byte of both ports
      0xAF,                   // XOR A            entry 0
      0x06, 0xBF,             // loop: LD B,BFh   register port 0xBF3B
      0xED, 0x79,             // OUT (C),A        select entry A
      0x06, 0xFF,             // LD B,FFh         data port 0xFF3B
      0x56,                   // LD D,(HL)
      0xED, 0x51,             // OUT (C),D        write GGGRRRBB
      0x23,                   // INC HL
      0x3C,                   // INC A
      0xFE, 0x40,             // CP 64
      0x20, 0xF1,             // JR NZ,loop       back 15 bytes
      0x06, 0xBF,             // LD B,BFh
      0x3E, 0x40,             // LD A,40h         group 01 = mode register
      0xED, 0x79,             // OUT (C),A
      0x06, 0xFF,             // LD B,FFh
      0x3E, 0x01,             // LD A,1           palette mode on, after the colours are in
      0xED, 0x79,             // OUT (C),A
      0xC9                    // RET
    ];
    const code = new Array(40).fill(0);
    routine.forEach((b, i) => { code[i] = b; });
    const regs = Array.from(registers, v => v & 0xFF);
    if (regs.length !== 64) throw new Error('A ULAplus palette has 64 registers');

    const lineBody = [...basic, ...code, ...regs, 0x0D];
    const program = [0x00, 0x0A, lineBody.length & 0xFF, (lineBody.length >> 8) & 0xFF, ...lineBody];
    const tapeName = this._tapeName(name || 'palette');
    const blocks = [
      this._block(0x00, this._header(0, tapeName, program.length, 10, program.length)),
      this._block(0xFF, program)
    ];
    const out = new Uint8Array(blocks[0].length + blocks[1].length);
    out.set(blocks[0], 0);
    out.set(blocks[1], blocks[0].length);
    return out;
  }

  /**
   * The 64 palette bytes of a ULAplus palette tape, or null. Accepts the first Program header
   * whose next block is a data block holding one BASIC line that ends in
   *   REM <anything> <64 palette bytes> 0x0D
   * Name, line number, autostart line and the loader code are all ignored, so ZX Paintbrush's
   * tapes and PixULA's both read. Block checksums are not enforced (as on every TAP import here).
   * @param {Uint8Array|ArrayBuffer} buffer
   * @returns {?Uint8Array}
   */
  findUlaplusPalette(buffer) {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    const blocks = [];
    let pos = 0;
    while (pos + 2 <= bytes.length) {
      const blockLen = bytes[pos] | (bytes[pos + 1] << 8);
      const start = pos + 2;
      if (blockLen < 2 || start + blockLen > bytes.length) break;
      blocks.push({ flag: bytes[start], payload: bytes.subarray(start + 1, start + blockLen - 1) });
      pos = start + blockLen;
    }
    for (let i = 0; i + 1 < blocks.length; i++) {
      const h = blocks[i], d = blocks[i + 1];
      if (h.flag !== 0x00 || h.payload.length !== 17 || h.payload[0] !== 0 || d.flag < 0x80) continue;
      const p = d.payload;
      if (p.length < 4) continue;
      const lineLen = p[2] | (p[3] << 8);               // line length counts everything after itself
      const end = 4 + lineLen;                           // one past the 0x0D
      // One line and nothing after it (the loader is a single line), so a longer program is never mistaken for one.
      if (lineLen < 66 || end !== p.length || p[end - 1] !== 0x0D) continue;
      let rem = -1;
      for (let k = 4; k <= end - 66; k++) if (p[k] === this.TOKENS.REM) { rem = k; break; }
      if (rem < 0) continue;
      // A palette loader starts the machine code itself: a USR comes before the REM.
      if (!p.subarray(4, rem).includes(this.TOKENS.USR)) continue;
      return Uint8Array.from(p.subarray(end - 65, end - 1));
    }
    return null;
  }

  /**
   * Put a tape's ULAplus palette into the document: one undo step, into the palette slot in use.
   * Outside the ULAplus modes the palette is stored for when the mode is chosen, and the status bar
   * says so.
   * @param {Uint8Array|ArrayBuffer} buffer
   * @returns {{success: boolean, error?: string}}
   */
  loadUlaplusPalette(buffer) {
    const regs = this.findUlaplusPalette(buffer);
    if (!regs) {
      return { success: false, error: Helpers.localizedMessage('err.tapNoPalette',
          'No ULAplus palette found in the {format} file', { format: 'TAP' }) };
    }
    UndoRedo.beginAction('Load palette');
    ColorManager.setUlaplusRegisters(regs);
    StateManager.markModified();
    UndoRedo.endAction();
    if (window.LayerManager) LayerManager.composeToCanvas();
    if (ACTIVE_SCREEN_MODE.paletteModel !== 'ulaplus64') {
      EventBus.emit(EVENTS.STATUS_NOTICE, { text: Helpers.localizedMessage('msg.ulaplusPaletteStored',
          'ULAplus palette loaded; it shows when you choose a ULAplus mode.') });
    }
    Logger.info('TAPFormat', 'Loaded ULAplus palette from TAP');
    EventBus.emit(EVENTS.FILE_IMPORT, { format: 'tap' });
    return { success: true };
  }

  /**
   * Export current image as a self-loading TAP
   * @param {Object} options - { border: 0-7, name: string }
   * @returns {Uint8Array} Complete TAP file data
   */
  export(options = {}) {
    const borderInput = options.border !== undefined
      ? options.border
      : (window.ColorManager && typeof ColorManager.getBorder === 'function' ? ColorManager.getBorder() : 0);
    const border = Helpers.clamp(borderInput | 0, 0, 7);
    const name = this._tapeName(options.name);

    // SCRFormat composites all visible layers into the screen bytes
    const screen = this._standardScreenBytes();
    const loader = this._buildLoader(border);

    const blocks = [
      // Program header: param1 = autostart line, param2 = offset to variables
      this._block(0x00, this._header(0, name, loader.length, 10, loader.length)),
      this._block(0xFF, loader),
      // Bytes header: param1 = start address, param2 = 32768 (unused, convention)
      this._block(0x00, this._header(3, name, screen.length, this.SCREEN_ADDR, 32768)),
      this._block(0xFF, screen)
    ];

    const total = blocks.reduce((sum, b) => sum + b.length, 0);
    const tap = new Uint8Array(total);
    let offset = 0;
    for (const b of blocks) {
      tap.set(b, offset);
      offset += b.length;
    }

    Logger.info('TAPFormat', `Exported TAP (${tap.length} bytes, border ${border})`);
    return tap;
  }

  /**
   * Export and trigger browser download (via the one FormatRegistry path)
   * @param {string} filename - Filename for download
   * @param {Object} options - Export options (border colour, tape name)
   */
  async exportAndDownload(filename = 'image.tap', options = {}, handle = null) {
    if (!options.name) {
      options = Object.assign({}, options, {
        name: filename.replace(/\.tap$/i, '')
      });
    }
    const name = filename.endsWith('.tap') ? filename : `${filename}.tap`;
    return FormatRegistry.download(this.export(options), name, undefined, handle);
  }

  /**
   * The 6912 standard SCREEN$ bytes of the current document. Works in any
   * mode with standard 8×8-cell geometry (ULAplus screens load on real
   * hardware — the palette travels separately); multicolor modes have no
   * SCREEN$ representation, so this throws a localized error that the
   * save/export flows surface (Phase 12a mode gate).
   * @returns {Uint8Array}
   * @private
   */
  _standardScreenBytes() {
    Helpers.assertStandardScreenLayout();
    return SCRFormat.export().subarray(0, this.SCREEN_SIZE);
  }

  /**
   * Whether export() would succeed in the active mode — the non-throwing
   * mirror used to filter the Save dialogs before the artist picks a
   * format.
   * @returns {boolean}
   */
  canExport() {
    return Helpers.hasStandardScreenLayout();
  }

  // ── Block-level editing API (Phase 9) ─────────────────────────────────────
  // Pure byte math: each parsed block keeps its raw bytes (including the
  // 2-byte length prefix), so serializeBlocks() of an unmodified list is
  // byte-identical to the input tape by construction.

  /**
   * Parse a TAP file into an editable block list.
   * @param {ArrayBuffer|Uint8Array} buffer - Complete TAP file
   * @returns {{success: boolean, error?: string, blocks?: Object[]}}
   */
  listBlocks(buffer) {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    const blocks = [];
    let pos = 0;

    while (pos + 2 <= bytes.length) {
      const blockLen = bytes[pos] | (bytes[pos + 1] << 8);
      const end = pos + 2 + blockLen;
      if (blockLen < 2 || end > bytes.length) {
        return { success: false, error: Helpers.localizedMessage('err.tapMalformed',
            'Malformed TAP block at offset {offset}', { offset: pos }) };
      }
      blocks.push(this._describeBlock(bytes.slice(pos, end), blocks.length, pos));
      pos = end;
    }

    if (pos !== bytes.length) {
      return { success: false, error: Helpers.localizedMessage('err.tapStray',
          '{count} stray byte(s) at the end of the TAP file', { count: bytes.length - pos }) };
    }
    return { success: true, blocks };
  }

  /**
   * Rebuild a TAP file from a (possibly reordered/edited) block list.
   * @param {Object[]} blocks - Entries from listBlocks()/buildScreenBlockPair()
   * @returns {Uint8Array}
   */
  serializeBlocks(blocks) {
    const total = blocks.reduce((sum, b) => sum + b.raw.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const b of blocks) {
      out.set(b.raw, offset);
      offset += b.raw.length;
    }
    return out;
  }

  /**
   * Build the CODE header + SCREEN$ data block pair for the current image,
   * ready to append to an edited tape.
   * @param {Object} options - { name: string, border? (unused for bare blocks) }
   * @returns {Object[]} Two block entries (header, data)
   */
  buildScreenBlockPair(options = {}) {
    const name = this._tapeName(options.name);
    const screen = this._standardScreenBytes();
    const headerRaw = this._block(0x00, this._header(3, name, screen.length, this.SCREEN_ADDR, 32768));
    const dataRaw = this._block(0xFF, screen);
    return [
      this._describeBlock(headerRaw, 0, 0),
      this._describeBlock(dataRaw, 0, 0)
    ];
  }

  /**
   * Load the SCREEN$ payload of a data block into the document.
   * @param {Object} block - Entry from listBlocks() with isScreen === true
   * @returns {Object} SCRFormat.parse() result
   */
  loadScreenBlock(block) {
    const payload = block.raw.slice(3, block.raw.length - 1);
    const result = SCRFormat.parse(payload.buffer);
    if (result.success) {
      Logger.info('TAPFormat', 'Loaded SCREEN$ block from TAP block list');
      EventBus.emit(EVENTS.FILE_IMPORT, { format: 'tap' });
    }
    return result;
  }

  /**
   * Describe a TAP-style block body (also used by TZXFormat for the bodies
   * embedded in standard/turbo speed data blocks).
   * @param {number} flag - Block flag byte
   * @param {Uint8Array} payload - Body bytes between flag and checksum
   * @returns {Object} { kind, flag, payloadLen, isScreen, headerType, name, dataLen, param1, param2 }
   */
  describeBlockBody(flag, payload) {
    const info = {
      kind: 'data',
      flag,
      payloadLen: payload.length,
      isScreen: false,
      headerType: null,
      name: null,
      dataLen: null,
      param1: null,
      param2: null
    };

    if (flag === 0x00 && payload.length === 17) {
      info.kind = 'header';
      info.headerType = payload[0];
      info.name = Array.from(payload.subarray(1, 11))
        .map(c => (c >= 0x20 && c <= 0x7E) ? String.fromCharCode(c) : '?')
        .join('').replace(/\s+$/, '');
      info.dataLen = payload[11] | (payload[12] << 8);
      info.param1 = payload[13] | (payload[14] << 8);
      info.param2 = payload[15] | (payload[16] << 8);
    } else if (flag >= 0x80 && payload.length === this.SCREEN_SIZE) {
      info.isScreen = true;
    }
    return info;
  }

  /**
   * Decorate a raw TAP block with display metadata.
   * @param {Uint8Array} raw - Complete block incl. 2-byte length prefix
   * @param {number} index - Position in the block list
   * @param {number} offset - Byte offset in the source file
   * @returns {Object}
   * @private
   */
  _describeBlock(raw, index, offset) {
    const flag = raw[2];
    const payload = raw.subarray(3, raw.length - 1);
    return Object.assign(
      { index, offset, raw, length: raw.length },
      this.describeBlockBody(flag, payload)
    );
  }

  /**
   * Build a complete TAP block: [len lo][len hi][flag][data...][checksum]
   * @param {number} flag - 0x00 header, 0xFF data
   * @param {Uint8Array|number[]} data - Block payload
   * @returns {Uint8Array}
   * @private
   */
  _block(flag, data) {
    const len = data.length + 2; // + flag + checksum
    const block = new Uint8Array(2 + len);
    block[0] = len & 0xFF;
    block[1] = (len >> 8) & 0xFF;
    block[2] = flag;

    let checksum = flag;
    for (let i = 0; i < data.length; i++) {
      block[3 + i] = data[i];
      checksum ^= data[i];
    }
    block[block.length - 1] = checksum;

    return block;
  }

  /**
   * Build the 17-byte tape header payload
   * @param {number} type - 0 = Program, 3 = Bytes
   * @param {string} name - 10-char tape name (space padded)
   * @param {number} dataLen - Length of the following data block payload
   * @param {number} param1 - Program: autostart line / Bytes: start address
   * @param {number} param2 - Program: variables offset / Bytes: 32768
   * @returns {Uint8Array}
   * @private
   */
  _header(type, name, dataLen, param1, param2) {
    const header = new Uint8Array(17);
    header[0] = type;
    for (let i = 0; i < 10; i++) {
      header[1 + i] = i < name.length ? name.charCodeAt(i) : 0x20;
    }
    header[11] = dataLen & 0xFF;
    header[12] = (dataLen >> 8) & 0xFF;
    header[13] = param1 & 0xFF;
    header[14] = (param1 >> 8) & 0xFF;
    header[15] = param2 & 0xFF;
    header[16] = (param2 >> 8) & 0xFF;
    return header;
  }

  /**
   * Tokenize the one-line BASIC loader:
   *   10 BORDER b: PAPER b: INK i: CLS: LOAD ""SCREEN$: PAUSE 0
   * INK contrasts with the paper so the classic progressive pixel
   * reveal is visible while the bitmap loads.
   * @param {number} border - Border/paper colour 0-7
   * @returns {Uint8Array}
   * @private
   */
  _buildLoader(border) {
    const T = this.TOKENS;
    const ink = border >= 4 ? 0 : 7; // light papers get black ink
    const COLON = 0x3A;
    const QUOTE = 0x22;

    const stmt = [
      T.BORDER, ...this._num(border), COLON,
      T.PAPER, ...this._num(border), COLON,
      T.INK, ...this._num(ink), COLON,
      T.CLS, COLON,
      T.LOAD, QUOTE, QUOTE, T.SCREEN$, COLON,
      T.PAUSE, ...this._num(0),
      0x0D
    ];

    // Line: [line# hi][line# lo][len lo][len hi][statements + 0x0D]
    return new Uint8Array([0x00, 10, stmt.length & 0xFF, (stmt.length >> 8) & 0xFF, ...stmt]);
  }

  /**
   * Encode an integer literal as BASIC stores it: the ASCII digits
   * followed by 0x0E and the 5-byte binary form (00 00 lo hi 00).
   * @param {number} n - Non-negative integer
   * @returns {number[]}
   * @private
   */
  _num(n) {
    const bytes = [];
    for (const ch of String(n)) {
      bytes.push(ch.charCodeAt(0));
    }
    bytes.push(0x0E, 0x00, 0x00, n & 0xFF, (n >> 8) & 0xFF, 0x00);
    return bytes;
  }

  /**
   * Sanitize a tape name: printable ASCII, max 10 chars
   * @param {string} name - Proposed name
   * @returns {string}
   * @private
   */
  _tapeName(name) {
    const clean = String(name || 'screen')
      .replace(/[^\x20-\x7E]/g, '_')
      .slice(0, 10);
    return clean.length ? clean : 'screen';
  }
}

// Create singleton
window.TAPFormat = new TAPFormatClass();

Logger.debug('TAPFormat', 'TAP format handler loaded');

})(); // End IIFE
