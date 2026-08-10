'use strict';
(function() {

/**
 * ZX Spectrum Next sprite sheets — .spr (Phase 13).
 *
 * The ecosystem's .spr is a raw pattern-memory dump (no header, no public
 * spec — documented assumptions, chosen to round-trip our own output and
 * match CSpect/emulator sprite loads):
 *   8bpp — 256 bytes per 16×16 sprite, row-major, one palette index per
 *     byte. A full 16 KB bank = 64 sprites.
 *   4bpp — 128 bytes per sprite, two pixels per byte, LEFT pixel in the
 *     high nibble.
 *
 * Import maps the byte length to sprites at the CURRENT sheet depth
 * (SpriteService.getDepth()) — a length that only divides one of the two
 * strides picks that depth instead (so 4bpp sheets from other tools load
 * without touching the toggle first). Export packs at the sheet depth.
 */
class SpriteFormatClass {

  initialize() {
    FormatRegistry.registerImport('spr', {
      parse: (buffer) => this.parse(buffer)
    });
    FormatRegistry.registerExport('spr', {
      export: () => this.export(),
      exportAndDownload: (filename) => this.exportAndDownload(filename)
    });
    Logger.info('SpriteFormat', 'Initialized (spr)');
  }

  // ── Pure byte math (Node-tested) ──────────────────────────────────────────

  /**
   * Resolve a byte length to a depth per the header rules.
   * @param {number} length
   * @param {number} preferredDepth - The current sheet depth (8 | 4)
   * @returns {number|null} 8 | 4 | null when the length fits neither
   */
  depthForLength(length, preferredDepth) {
    if (length <= 0) return null;
    const fits8 = length % 256 === 0;
    const fits4 = length % 128 === 0;
    if (fits8 && fits4) return preferredDepth;
    if (fits8) return 8;
    if (fits4) return 4;
    return null;
  }

  /**
   * Decode a .spr byte block into unpacked 256-entry patterns.
   * @param {Uint8Array} bytes
   * @param {number} depth - 8 | 4
   * @returns {Uint8Array[]}
   */
  decode(bytes, depth) {
    const stride = depth === 8 ? 256 : 128;
    const sprites = [];
    for (let off = 0; off + stride <= bytes.length; off += stride) {
      const spr = new Uint8Array(256);
      if (depth === 8) {
        spr.set(bytes.subarray(off, off + 256));
      } else {
        for (let i = 0; i < 256; i++) {
          const b = bytes[off + (i >> 1)];
          spr[i] = (i & 1) ? (b & 0x0F) : (b >> 4);
        }
      }
      sprites.push(spr);
    }
    return sprites;
  }

  /**
   * Encode unpacked patterns as .spr bytes.
   * @param {Uint8Array[]} sprites - 256-entry patterns
   * @param {number} depth - 8 | 4
   * @returns {Uint8Array}
   */
  encode(sprites, depth) {
    const stride = depth === 8 ? 256 : 128;
    const out = new Uint8Array(sprites.length * stride);
    sprites.forEach((spr, n) => {
      const off = n * stride;
      if (depth === 8) {
        out.set(spr, off);
      } else {
        for (let i = 0; i < 256; i++) {
          const v = spr[i] & 0x0F;
          out[off + (i >> 1)] |= (i & 1) ? v : (v << 4);
        }
      }
    });
    return out;
  }

  // ── Import / export ───────────────────────────────────────────────────────

  /**
   * @param {ArrayBuffer} buffer
   * @returns {Object} { success } | { success: false, error }
   */
  parse(buffer) {
    const bytes = new Uint8Array(buffer);
    const depth = this.depthForLength(bytes.length, SpriteService.getDepth());
    if (!depth) {
      return {
        success: false,
        error: `Invalid .spr file size: ${bytes.length} bytes (expected a multiple of 256 or 128)`
      };
    }

    const sprites = this.decode(bytes, depth);
    SpriteService.loadSheet(sprites, depth);

    Logger.info('SpriteFormat', `Loaded ${sprites.length} sprite(s) at ${depth}bpp`);
    EventBus.emit(EVENTS.FILE_IMPORT, { format: 'spr' });
    return { success: true };
  }

  /** @returns {Uint8Array} The sheet packed at its depth */
  export() {
    return this.encode(SpriteService.sprites, SpriteService.getDepth());
  }

  /** @param {string} filename */
  exportAndDownload(filename) {
    let name = filename || 'sprites.spr';
    if (!name.toLowerCase().endsWith('.spr')) name = `${name}.spr`;
    FormatRegistry.download(this.export(), name);
  }
}

window.SpriteFormat = new SpriteFormatClass();

Logger.debug('SpriteFormat', 'Sprite format handler loaded');

})(); // End IIFE
