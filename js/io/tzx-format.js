'use strict';
(function() {

/**
 * TZX Format Handler
 *
 * ZX Spectrum TZX tape image. Export wraps the exact TAP blocks produced
 * by TAPFormat in "standard speed data" blocks (ID 0x10), preceded by the
 * 10-byte TZX signature header — so anything that loads the .tap loads
 * the .tzx. Import walks the block chain with a per-ID length table and
 * extracts the first SCREEN$-sized data payload (a loading screen).
 *
 * Known limitation: the import stops at any block ID missing from the
 * length table (e.g. 0x18 CSW, 0x19 generalized data) instead of using
 * TZX 1.20's skip-by-DWORD extension rule. Failing conservatively is
 * deliberate — a few deprecated pre-1.10 IDs don't follow that rule, so
 * blindly applying it could misparse the chain.
 */
class TZXFormatClass {
  constructor() {
    // A tape SCREEN$ block is a CLASSIC 6912-byte screen whatever mode the
    // document happens to be in, so this is pinned to STANDARD_ULA exactly
    // as TAPFormat.SCREEN_SIZE is. It was the live ZX_SPECTRUM.SCR_FILE_SIZE
    // view, which follows the ACTIVE mode - so in ULAplus the scan looked
    // for a 6976-byte block, found none, and this handler could not reload
    // its own export. TAP, holding byte-identical content, loaded fine.
    this.SCREEN_SIZE = SCREEN_MODES.STANDARD_ULA.fileSize;
    this.SIGNATURE = 'ZXTape!';
    this.VERSION = [1, 20]; // major, minor
    this.PAUSE_MS = 1000;   // pause after each block
  }

  /**
   * Initialize and register with FormatRegistry
   */
  initialize() {
    FormatRegistry.registerImport('tzx', this);
    FormatRegistry.registerExport('tzx', this);
    Logger.info('TZXFormat', 'Initialized');
  }

  /**
   * Whether export() would succeed in the active mode — delegates to
   * TAPFormat.canExport() since TZX builds its blocks from
   * TAPFormat.export() and shares its standard-layout gate.
   * @returns {boolean}
   */
  canExport() {
    return TAPFormat.canExport();
  }

  /**
   * Export current image as TZX
   * @param {Object} options - { border: 0-7, name: string } (passed to TAPFormat)
   * @returns {Uint8Array} Complete TZX file data
   */
  export(options = {}) {
    const tap = TAPFormat.export(options);

    // Collect TAP block bodies (strip each 2-byte TAP length prefix)
    const bodies = [];
    let pos = 0;
    while (pos + 2 <= tap.length) {
      const len = tap[pos] | (tap[pos + 1] << 8);
      bodies.push(tap.subarray(pos + 2, pos + 2 + len));
      pos += 2 + len;
    }

    // 10-byte header + per block: ID(1) + pause(2) + len(2) + body
    const total = 10 + bodies.reduce((sum, b) => sum + 5 + b.length, 0);
    const tzx = new Uint8Array(total);
    for (let i = 0; i < 7; i++) tzx[i] = this.SIGNATURE.charCodeAt(i);
    tzx[7] = 0x1A;
    tzx[8] = this.VERSION[0];
    tzx[9] = this.VERSION[1];

    let offset = 10;
    for (const body of bodies) {
      tzx[offset++] = 0x10;
      tzx[offset++] = this.PAUSE_MS & 0xFF;
      tzx[offset++] = (this.PAUSE_MS >> 8) & 0xFF;
      tzx[offset++] = body.length & 0xFF;
      tzx[offset++] = (body.length >> 8) & 0xFF;
      tzx.set(body, offset);
      offset += body.length;
    }

    Logger.info('TZXFormat', `Exported TZX (${tzx.length} bytes)`);
    return tzx;
  }

  /**
   * Parse TZX file data — finds the first SCREEN$-sized data payload
   * @param {ArrayBuffer} buffer - File data
   * @returns {Object} { success: true } or { success: false, error: string }
   */
  parse(buffer) {
    const bytes = new Uint8Array(buffer);

    if (bytes.length < 10 ||
        String.fromCharCode(...bytes.slice(0, 7)) !== this.SIGNATURE || bytes[7] !== 0x1A) {
      return { success: false, error: 'Not a TZX file (bad signature)' };
    }

    let pos = 10;
    while (pos < bytes.length) {
      const id = bytes[pos];

      const span = this._blockSpan(bytes, pos);
      if (!span) {
        // Unknown block — stop scanning rather than guess. TZX 1.20's
        // extension rule (unknown IDs carry a DWORD length) is not applied
        // because deprecated pre-1.10 IDs (e.g. 0x16-0x17, 0x34, 0x40)
        // don't follow it; see the class header comment.
        return { success: false, error: `No screen found before unknown TZX block 0x${id.toString(16)}` };
      }
      const { skip, dataStart, dataLen } = span;

      // A ROM-style data payload: [flag][SCREEN$ bytes][checksum]
      if (dataStart >= 0 && dataLen === this.SCREEN_SIZE + 2 &&
          bytes[dataStart] >= 0x80 && dataStart + dataLen <= bytes.length) {
        const payload = bytes.slice(dataStart + 1, dataStart + 1 + this.SCREEN_SIZE);
        const result = SCRFormat.parse(payload.buffer);
        if (result.success) {
          Logger.info('TZXFormat', 'Loaded SCREEN$ block from TZX');
          EventBus.emit(EVENTS.FILE_IMPORT, { format: 'tzx' });
        }
        return result;
      }

      pos = pos + 1 + skip;
      if (skip < 0 || pos > bytes.length) break; // truncated file
    }

    return { success: false, error: `No ${this.SCREEN_SIZE}-byte SCREEN$ block found in TZX file` };
  }

  /**
   * Compute the extent of the TZX block starting at pos (its ID byte).
   * Returns null for IDs missing from the length table (see header comment).
   * @param {Uint8Array} bytes - Whole file
   * @param {number} pos - Offset of the block ID byte
   * @returns {{skip: number, dataStart: number, dataLen: number}|null}
   *   skip = body length after the ID; dataStart/dataLen locate an embedded
   *   TAP-style [flag][data][checksum] body, dataStart = -1 when none.
   * @private
   */
  _blockSpan(bytes, pos) {
    const u16 = (p) => bytes[p] | (bytes[p + 1] << 8);
    const u24 = (p) => bytes[p] | (bytes[p + 1] << 8) | (bytes[p + 2] << 16);
    const u32 = (p) => u24(p) + bytes[p + 3] * 0x1000000;
    const at = pos + 1; // first byte after the ID

    let dataStart = -1;
    let dataLen = 0;
    let skip;

    switch (bytes[pos]) {
      case 0x10: skip = 4 + u16(at + 2); dataStart = at + 4; dataLen = u16(at + 2); break;
      case 0x11: skip = 18 + u24(at + 15); dataStart = at + 18; dataLen = u24(at + 15); break;
      case 0x12: skip = 4; break;
      case 0x13: skip = 1 + bytes[at] * 2; break;
      case 0x14: skip = 10 + u24(at + 7); dataStart = at + 10; dataLen = u24(at + 7); break;
      case 0x15: skip = 8 + u24(at + 5); break;
      case 0x20: skip = 2; break;
      case 0x21: skip = 1 + bytes[at]; break;
      case 0x22: skip = 0; break;
      case 0x23: skip = 2; break;
      case 0x24: skip = 2; break;
      case 0x25: skip = 0; break;
      case 0x26: skip = 2 + u16(at) * 2; break;
      case 0x27: skip = 0; break;
      case 0x28: skip = 2 + u16(at); break;
      case 0x2A: skip = 4; break;
      case 0x2B: skip = 5; break;
      case 0x30: skip = 1 + bytes[at]; break;
      case 0x31: skip = 2 + bytes[at + 1]; break;
      case 0x32: skip = 2 + u16(at); break;
      case 0x33: skip = 1 + bytes[at] * 3; break;
      case 0x35: skip = 20 + u32(at + 16); break;
      case 0x5A: skip = 9; break;
      default: return null;
    }
    return { skip, dataStart, dataLen };
  }

  // ── Block-level editing API (Phase 9) ─────────────────────────────────────
  // Same contract as TAPFormat's: every parsed block keeps its raw bytes
  // (ID byte + body), the original 10-byte signature header is preserved,
  // and serializeBlocks() of an unmodified list is byte-identical.

  /**
   * Parse a TZX file into an editable block list.
   * @param {ArrayBuffer|Uint8Array} buffer - Complete TZX file
   * @returns {{success: boolean, error?: string, header?: Uint8Array, blocks?: Object[]}}
   */
  listBlocks(buffer) {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);

    if (bytes.length < 10 ||
        String.fromCharCode(...bytes.slice(0, 7)) !== this.SIGNATURE || bytes[7] !== 0x1A) {
      return { success: false, error: 'Not a TZX file (bad signature)' };
    }

    const header = bytes.slice(0, 10);
    const blocks = [];
    let pos = 10;

    while (pos < bytes.length) {
      const id = bytes[pos];
      const span = this._blockSpan(bytes, pos);
      if (!span) {
        return { success: false, error: `Unknown TZX block 0x${id.toString(16)} at offset ${pos}` };
      }
      const end = pos + 1 + span.skip;
      if (span.skip < 0 || end > bytes.length) {
        return { success: false, error: `Truncated TZX block 0x${id.toString(16)} at offset ${pos}` };
      }

      const entry = {
        index: blocks.length,
        offset: pos,
        id,
        raw: bytes.slice(pos, end),
        length: end - pos,
        kind: 'tzx',
        flag: null,
        payloadLen: null,
        isScreen: false,
        headerType: null,
        name: null,
        dataLen: null,
        param1: null,
        param2: null,
        bodyOffset: -1,
        bodyLen: 0
      };

      // Blocks embedding a TAP-style [flag][data][checksum] body get the
      // same header/data/screen metadata a TAP block would
      if (span.dataStart >= 0 && span.dataLen >= 2 && span.dataStart + span.dataLen <= end) {
        const flag = bytes[span.dataStart];
        const payload = bytes.subarray(span.dataStart + 1, span.dataStart + span.dataLen - 1);
        Object.assign(entry, TAPFormat.describeBlockBody(flag, payload));
        entry.bodyOffset = span.dataStart - pos;
        entry.bodyLen = span.dataLen;
      }

      blocks.push(entry);
      pos = end;
    }

    return { success: true, header, blocks };
  }

  /**
   * Rebuild a TZX file from an edited block list.
   * @param {{header: Uint8Array, blocks: Object[]}} parsed - From listBlocks()
   * @returns {Uint8Array}
   */
  serializeBlocks(parsed) {
    const total = parsed.header.length + parsed.blocks.reduce((sum, b) => sum + b.raw.length, 0);
    const out = new Uint8Array(total);
    out.set(parsed.header, 0);
    let offset = parsed.header.length;
    for (const b of parsed.blocks) {
      out.set(b.raw, offset);
      offset += b.raw.length;
    }
    return out;
  }

  /**
   * Build the CODE header + SCREEN$ data blocks for the current image as
   * standard speed data blocks (ID 0x10), ready to append to an edited tape.
   * @param {Object} options - { name: string }
   * @returns {Object[]} Two block entries (header, data)
   */
  buildScreenBlockPair(options = {}) {
    return TAPFormat.buildScreenBlockPair(options).map((tapBlock) => {
      const body = tapBlock.raw.subarray(2); // strip the TAP length prefix
      const raw = new Uint8Array(5 + body.length);
      raw[0] = 0x10;
      raw[1] = this.PAUSE_MS & 0xFF;
      raw[2] = (this.PAUSE_MS >> 8) & 0xFF;
      raw[3] = body.length & 0xFF;
      raw[4] = (body.length >> 8) & 0xFF;
      raw.set(body, 5);
      return Object.assign({}, tapBlock, {
        id: 0x10,
        kind: tapBlock.kind,
        raw,
        length: raw.length,
        bodyOffset: 5,
        bodyLen: body.length
      });
    });
  }

  /**
   * Load the SCREEN$ payload of a listed block into the document.
   * @param {Object} block - Entry from listBlocks() with isScreen === true
   * @returns {Object} SCRFormat.parse() result
   */
  loadScreenBlock(block) {
    const payload = block.raw.slice(
      block.bodyOffset + 1,
      block.bodyOffset + block.bodyLen - 1
    );
    const result = SCRFormat.parse(payload.buffer);
    if (result.success) {
      Logger.info('TZXFormat', 'Loaded SCREEN$ block from TZX block list');
      EventBus.emit(EVENTS.FILE_IMPORT, { format: 'tzx' });
    }
    return result;
  }

  /**
   * Export and trigger browser download (via the one FormatRegistry path)
   * @param {string} filename - Filename for download
   * @param {Object} options - Export options (border colour, tape name)
   */
  async exportAndDownload(filename = 'image.tzx', options = {}, handle = null) {
    if (!options.name) {
      options = Object.assign({}, options, { name: filename.replace(/\.tzx$/i, '') });
    }
    const name = filename.endsWith('.tzx') ? filename : `${filename}.tzx`;
    return FormatRegistry.download(this.export(options), name, undefined, handle);
  }
}

// Create singleton
window.TZXFormat = new TZXFormatClass();

Logger.debug('TZXFormat', 'TZX format handler loaded');

})(); // End IIFE
