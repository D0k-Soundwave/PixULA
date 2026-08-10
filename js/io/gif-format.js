'use strict';
(function() {

/**
 * GIF Format Handler
 *
 * Import: the browser decodes GIF natively via Image (first frame of an
 * animation), so parse() delegates to PNGFormat's import pipeline exactly
 * like jpg-format.js does — resize, per-cell quantization, dithering, and
 * the Import Conversion dialog all come for free.
 *
 * Export: a dependency-free GIF89a encoder — pure byte math (LZW, global
 * colour table sized to the ACTIVE mode's palette), Node-testable end to
 * end. The encoder is multi-frame capable; export() ships a static single
 * frame by default, and with { animated: true } emits a two-frame looping
 * GIF whose frames are the two FLASH phases (~320 ms each, the real ULA
 * flash rate of 16 frames at 50 Hz — fixed16 modes only; nothing flashes
 * in the other palette models).
 *
 * Frame sources: classic 8×8 fixed16 stays on SCRFormat.export() bytes
 * (pure, byte-testable — screenToIndices); every other mode decodes the
 * flattened document against the live palette (layerToIndices): the
 * multicolor cell heights, ULAplus' 64 registers, Timex hi-res' 2-colour
 * scheme and the Next rgb333 window (16 or 256 entries).
 */
class GIFFormatClass {
  constructor() {
    // One FLASH phase = 16 frames at 50 Hz = 320 ms = 32 centiseconds
    this.FLASH_DELAY_CS = 32;
    // GigaScreen alternates every hardware frame (20 ms); 2 cs is the
    // fastest delay GIF viewers honour — the flicker-blend preview seam
    this.GIGA_DELAY_CS = 2;
  }

  /**
   * Initialize and register with FormatRegistry
   */
  initialize() {
    FormatRegistry.registerImport('gif', this);
    FormatRegistry.registerExport('gif', this);
    Logger.info('GIFFormat', 'Initialized');
  }

  /**
   * Parse GIF file (import) — delegates to PNGFormat since the browser's
   * Image decoder handles GIF natively (animated GIFs decode to frame 1).
   * @param {ArrayBuffer} buffer - File data
   * @param {Object} options - Import options (from the conversion dialog)
   * @returns {Promise<Object>} Result { success, error? }
   */
  async parse(buffer, options = {}) {
    return PNGFormat.parse(buffer, options);
  }

  /**
   * Export the current image as GIF bytes.
   * @param {Object} options - { animated: boolean } — when true and the
   *   screen contains FLASH cells, emits a two-frame looping flash animation;
   *   otherwise a static single-frame GIF.
   * @returns {Uint8Array} Complete GIF89a file
   */
  export(options = {}) {
    // GigaScreen (Phase 12b): the two sub-screens ARE the animation — a
    // fast two-frame loop approximates the hardware flicker blend. The
    // 'animated' option is implied; FLASH phases are not layered on top.
    if ((ACTIVE_SCREEN_MODE.screens || 1) === 2) {
      const frames = [
        { indices: this.screenToIndices(GigascreenFormat.subScreenBytes(0), 0), delayCs: this.GIGA_DELAY_CS },
        { indices: this.screenToIndices(GigascreenFormat.subScreenBytes(1), 0), delayCs: this.GIGA_DELAY_CS }
      ];
      const gigaGif = this.encode({
        width: ZX_SPECTRUM.WIDTH,
        height: ZX_SPECTRUM.HEIGHT,
        palette: ZX_PALETTE_RGB,
        frames,
        loop: 0
      });
      Logger.info('GIFFormat', `Exported GigaScreen GIF (${gigaGif.length} bytes)`);
      return gigaGif;
    }

    const model = ACTIVE_SCREEN_MODE.paletteModel;

    // Classic 8×8 fixed16: the byte-tested SCR path
    if (model === 'fixed16' && ZX_SPECTRUM.CELL_HEIGHT === 8) {
      const scr = SCRFormat.export();
      const animated = !!options.animated && this.screenHasFlash(scr);

      const frames = [{ indices: this.screenToIndices(scr, 0), delayCs: this.FLASH_DELAY_CS }];
      if (animated) {
        frames.push({ indices: this.screenToIndices(scr, 1), delayCs: this.FLASH_DELAY_CS });
      }

      const gif = this.encode({
        width: ZX_SPECTRUM.WIDTH,
        height: ZX_SPECTRUM.HEIGHT,
        palette: ZX_PALETTE_RGB,
        frames,
        loop: 0 // loop forever (only written for multi-frame output)
      });

      Logger.info('GIFFormat', `Exported GIF (${gif.length} bytes, ${frames.length} frame(s))`);
      return gif;
    }

    // Every other mode: decode the flattened document against the LIVE
    // palette — the colour table IS the source mode's palette (multicolor
    // cell heights, ULAplus 64, timexMono 2, the rgb333 window 16/256).
    // FLASH only animates in fixed16 models; ULAplus reads the flash bit
    // as a CLUT bit and the rest never flash.
    const layer = LayerManager.flattenVisible();
    const palette = model === 'fixed16' ? ZX_PALETTE_RGB : ColorManager.paletteRGB;
    const animated = model === 'fixed16' && !!options.animated && this.layerHasFlash(layer);

    const frames = [{ indices: this.layerToIndices(layer, 0), delayCs: this.FLASH_DELAY_CS }];
    if (animated) {
      frames.push({ indices: this.layerToIndices(layer, 1), delayCs: this.FLASH_DELAY_CS });
    }

    const gif = this.encode({
      width: ZX_SPECTRUM.WIDTH,
      height: ZX_SPECTRUM.HEIGHT,
      palette,
      frames,
      loop: 0
    });

    Logger.info('GIFFormat',
      `Exported ${model} GIF (${gif.length} bytes, ${frames.length} frame(s), ${palette.length} colours)`);
    return gif;
  }

  /**
   * Export and trigger browser download (via the one FormatRegistry path)
   * @param {string} filename - Filename
   * @param {Object} options - Export options
   */
  exportAndDownload(filename = 'image.gif', options = {}) {
    const name = filename.endsWith('.gif') ? filename : `${filename}.gif`;
    FormatRegistry.download(this.export(options), name, 'image/gif');
  }

  // ── Screen decoding (pure byte math on SCR-format bytes) ─────────────────

  /**
   * Does any attribute cell have its FLASH bit set?
   * @param {Uint8Array} scr - SCR-format screen bytes
   * @returns {boolean}
   */
  screenHasFlash(scr) {
    const attrs = ZX_SPECTRUM.BITMAP_SIZE;
    for (let i = 0; i < ZX_SPECTRUM.ATTR_SIZE; i++) {
      if (scr[attrs + i] & 0x80) return true;
    }
    return false;
  }

  /**
   * Decode SCR bytes to one palette index (0-15) per pixel.
   * @param {Uint8Array} scr - SCR-format screen bytes (bitmap + attributes)
   * @param {number} flashPhase - 0 = normal, 1 = FLASH cells show swapped ink/paper
   * @returns {Uint8Array} width*height palette indices, row-major
   */
  screenToIndices(scr, flashPhase = 0) {
    const W = ZX_SPECTRUM.WIDTH;
    const H = ZX_SPECTRUM.HEIGHT;
    const CELL = ZX_SPECTRUM.CELL_SIZE;
    const COLS = ZX_SPECTRUM.GRID_COLS;
    const THIRD = ZX_SPECTRUM.BITMAP_SIZE / 3; // one interleaved screen third
    const out = new Uint8Array(W * H);

    const cellH = ZX_SPECTRUM.CELL_HEIGHT;
    for (let y = 0; y < H; y++) {
      // Interleaved ULA bitmap address for pixel row y
      const rowBase = ((y >> 6) * THIRD) + ((y & 7) * COLS * CELL) + (((y >> 3) & 7) * COLS);
      // One linear attribute row per cell row (cell height from the mode)
      const attrRow = ZX_SPECTRUM.BITMAP_SIZE + Math.floor(y / cellH) * COLS;

      for (let cx = 0; cx < COLS; cx++) {
        const bits = scr[rowBase + cx];
        const attr = scr[attrRow + cx];
        let ink = attr & 0x07;
        let paper = (attr >> 3) & 0x07;
        const bright = (attr >> 6) & 1;
        if (flashPhase === 1 && (attr & 0x80)) {
          const t = ink; ink = paper; paper = t;
        }
        const inkIdx = ink + bright * 8;
        const paperIdx = paper + bright * 8;

        const base = y * W + cx * CELL;
        for (let b = 0; b < CELL; b++) {
          out[base + b] = (bits & (0x80 >> b)) ? inkIdx : paperIdx;
        }
      }
    }
    return out;
  }

  // ── Document decoding (flattened layer -> palette indices) ────────────────

  /**
   * Decode a flattened layer to one ACTIVE-palette index per pixel. Works
   * in every palette model: fixed16 (any cell height), ulaplus64 (CLUT
   * indices via attrToIndices), timexMono (bit -> [paper, ink]) and the
   * indexed rgb333 modes (per-pixel cell indices; transparent resolves to
   * the default paper entry).
   * @param {Layer} layer - From LayerManager.flattenVisible()
   * @param {number} flashPhase - 0 = normal, 1 = fixed16 FLASH cells swap
   * @returns {Uint8Array} width*height palette indices, row-major
   */
  layerToIndices(layer, flashPhase = 0) {
    const W = ZX_SPECTRUM.WIDTH;
    const cw = ZX_SPECTRUM.CELL_WIDTH;
    const ch = ZX_SPECTRUM.CELL_HEIGHT;
    const fixed16 = ACTIVE_SCREEN_MODE.paletteModel === 'fixed16';
    const indexed = ZX_SPECTRUM.PIXEL_DEPTH > 1;
    const out = new Uint8Array(W * ZX_SPECTRUM.HEIGHT);

    for (let cy = 0; cy < ZX_SPECTRUM.GRID_ROWS; cy++) {
      for (let cx = 0; cx < ZX_SPECTRUM.GRID_COLS; cx++) {
        const cell = layer.getCell(cx, cy);
        if (!cell) continue;
        const x0 = cx * cw;
        const y0 = cy * ch;

        if (indexed) {
          for (let ly = 0; ly < ch; ly++) {
            const rowBase = (y0 + ly) * W + x0;
            for (let lx = 0; lx < cw; lx++) {
              const idx = cell.indices ? cell.indices[ly * cw + lx] : -1;
              out[rowBase + lx] = idx >= 0 ? idx : NEXTRGB333.DEFAULT_PAPER;
            }
          }
          continue;
        }

        const t = ColorManager.attrToIndices(cell);
        let inkIdx = t.ink;
        let paperIdx = t.paper;
        if (fixed16 && flashPhase === 1 && cell.flash) {
          const s = inkIdx; inkIdx = paperIdx; paperIdx = s;
        }
        for (let ly = 0; ly < ch; ly++) {
          const bits = cell.pixels[ly];
          const rowBase = (y0 + ly) * W + x0;
          for (let lx = 0; lx < cw; lx++) {
            out[rowBase + lx] = (bits & (0x80 >> lx)) ? inkIdx : paperIdx;
          }
        }
      }
    }
    return out;
  }

  /**
   * Does any cell of a flattened layer have its FLASH bit set?
   * @param {Layer} layer
   * @returns {boolean}
   */
  layerHasFlash(layer) {
    for (let cy = 0; cy < ZX_SPECTRUM.GRID_ROWS; cy++) {
      for (let cx = 0; cx < ZX_SPECTRUM.GRID_COLS; cx++) {
        const cell = layer.getCell(cx, cy);
        if (cell && cell.flash) return true;
      }
    }
    return false;
  }

  // ── GIF89a encoder (pure) ─────────────────────────────────────────────────

  /**
   * Encode indexed frames as a complete GIF89a file. Multi-frame input
   * produces a looping animation (NETSCAPE2.0 extension + per-frame graphic
   * control blocks); single-frame input produces a minimal static GIF.
   * @param {Object} spec
   * @param {number} spec.width
   * @param {number} spec.height
   * @param {Array<Uint8Array|number[]>} spec.palette - RGB triples (≤256
   *   entries; the colour table is the smallest power of two that holds
   *   them, so a 16-colour palette encodes byte-identically to before)
   * @param {Array<{indices: Uint8Array, delayCs?: number}>} spec.frames -
   *   width*height palette indices per frame; delayCs in 1/100 s (animation only)
   * @param {number} [spec.loop] - Animation loop count, 0 = forever
   * @returns {Uint8Array}
   */
  encode({ width, height, palette, frames, loop = 0 }) {
    const bytes = [];
    const u16 = (v) => { bytes.push(v & 0xFF, (v >> 8) & 0xFF); };

    // Colour table size: the smallest power of two ≥ the palette length
    // (GIF stores log2(entries) − 1; minimum 2 entries). The LZW minimum
    // code size must be ≥ 2 even for 1-bit images (GIF89a spec).
    let colorBits = 1;
    while ((1 << colorBits) < palette.length) colorBits++;
    const tableEntries = 1 << colorBits;
    const minCodeSize = Math.max(2, colorBits);

    // Header
    for (const ch of 'GIF89a') bytes.push(ch.charCodeAt(0));

    // Logical screen descriptor: global colour table, 8-bit colour
    // resolution, 2^(colorBits) table entries
    u16(width);
    u16(height);
    bytes.push(0x80 | 0x70 | (colorBits - 1), 0x00, 0x00);

    // Global colour table
    for (let i = 0; i < tableEntries; i++) {
      const rgb = palette[i] || [0, 0, 0];
      bytes.push(rgb[0], rgb[1], rgb[2]);
    }

    const animated = frames.length > 1;

    if (animated) {
      // NETSCAPE2.0 application extension — loop count
      bytes.push(0x21, 0xFF, 0x0B);
      for (const ch of 'NETSCAPE2.0') bytes.push(ch.charCodeAt(0));
      bytes.push(0x03, 0x01);
      u16(loop);
      bytes.push(0x00);
    }

    for (const frame of frames) {
      if (animated) {
        // Graphic control extension: disposal = do not dispose, no transparency
        bytes.push(0x21, 0xF9, 0x04, 0x04);
        u16(frame.delayCs || this.FLASH_DELAY_CS);
        bytes.push(0x00, 0x00);
      }

      // Image descriptor at (0,0), no local colour table, not interlaced
      bytes.push(0x2C);
      u16(0);
      u16(0);
      u16(width);
      u16(height);
      bytes.push(0x00);

      // LZW-compressed indices in ≤255-byte sub-blocks
      bytes.push(minCodeSize);
      const lzw = this._lzwEncode(frame.indices, minCodeSize);
      for (let off = 0; off < lzw.length; off += 255) {
        const n = Math.min(255, lzw.length - off);
        bytes.push(n);
        for (let i = 0; i < n; i++) bytes.push(lzw[off + i]);
      }
      bytes.push(0x00); // block terminator
    }

    bytes.push(0x3B); // trailer
    return new Uint8Array(bytes);
  }

  /**
   * GIF-variant LZW compression (LSB-first variable-width codes, CLEAR
   * emitted up front and again whenever the 4096-entry table fills).
   * @param {Uint8Array|number[]} indices - Input symbols, each < 2^minCodeSize
   * @param {number} minCodeSize - Symbol width in bits (4 for 16 colours)
   * @returns {Uint8Array} Packed code stream (not yet sub-blocked)
   * @private
   */
  _lzwEncode(indices, minCodeSize) {
    const CLEAR = 1 << minCodeSize;
    const EOI = CLEAR + 1;
    const MAX_CODES = 4096;

    const out = [];
    let cur = 0;
    let curBits = 0;
    let codeSize = minCodeSize + 1;

    const emit = (code) => {
      cur |= code << curBits;
      curBits += codeSize;
      while (curBits >= 8) {
        out.push(cur & 0xFF);
        cur >>= 8;
        curBits -= 8;
      }
    };

    let dict = new Map();
    let next = EOI + 1;
    const reset = () => {
      dict = new Map();
      next = EOI + 1;
      codeSize = minCodeSize + 1;
    };

    emit(CLEAR);
    if (indices.length === 0) {
      emit(EOI);
    } else {
      let prefix = indices[0];
      for (let i = 1; i < indices.length; i++) {
        const k = indices[i];
        const key = (prefix << 8) | k;
        if (dict.has(key)) {
          prefix = dict.get(key);
          continue;
        }
        emit(prefix);
        if (next < MAX_CODES) {
          dict.set(key, next++);
          // The decoder registers each entry one code AFTER the encoder does,
          // so the width bump lands one entry later than the naive
          // next === 1<<codeSize check (the classic GIF off-by-one)
          if (next === (1 << codeSize) + 1 && codeSize < 12) codeSize++;
        } else {
          emit(CLEAR);
          reset();
        }
        prefix = k;
      }
      emit(prefix);
      emit(EOI);
    }

    if (curBits > 0) out.push(cur & 0xFF);
    return new Uint8Array(out);
  }
}

// Create singleton
window.GIFFormat = new GIFFormatClass();

Logger.debug('GIFFormat', 'GIF format handler loaded');

})(); // End IIFE
