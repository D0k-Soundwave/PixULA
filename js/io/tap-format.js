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

    return {
      success: false,
      error: `No ${this.SCREEN_SIZE}-byte SCREEN$ block found in TAP file`
    };
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
        return { success: false, error: `Malformed TAP block at offset ${pos}` };
      }
      blocks.push(this._describeBlock(bytes.slice(pos, end), blocks.length, pos));
      pos = end;
    }

    if (pos !== bytes.length) {
      return { success: false, error: `${bytes.length - pos} stray byte(s) at end of TAP file` };
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
