'use strict';
(function() {

// 8×8 quantization block for the mode-independent paths: the stamp ink-mask
// quantizer and the legacy fixed16 cell-engine entry points. DOCUMENT imports
// read the ACTIVE screen mode's cell geometry at call time instead (Phase 12a).
const CS = 8;
const CELL_PIXELS = CS * CS;

/*
 * IMPORT_METHODS. The three conversions the Import dialog shows side by side,
 * defined ONCE here beside the code that implements them: the dialog renders
 * this list, quantizePreviewSet loops it, and the browser spec reads it rather
 * than restating the pairings a fourth time.
 *
 * They are shown side by side rather than offered in a dropdown because the
 * only way to choose between them is to look: measured on seven real
 * photographs (tools/palette-bench.js) each one WON a different metric and lost
 * the others, and no single number predicted which picture a person would
 * prefer.
 *
 *   sharp   the cell's two colours chosen from every pixel of the ORIGINAL it
 *           covers, not from the 64 already-averaged screen pixels. Best
 *           structure - edges and small detail survive. Best dSSIM of the three.
 *   smooth  dithered. Best average tone, and the best colour once you step
 *           back, at the price of visible noise up close.
 *   flat    no dither. Cleanest blocks, most poster-like.
 *
 * `dithering` is not a separate control any more: it IS the difference between
 * smooth and flat, and offering it twice let you pick combinations that
 * contradicted the method you had chosen.
 */
const IMPORT_METHODS = [
  { id: 'sharp',  method: 'detail',   dithering: 'none',
    i18n: 'import.methodSharp',  fallback: 'Sharp',
    hint: 'Samples every pixel of the original photo per cell instead of the 64 already-averaged screen pixels - keeps edges and small detail the other two lose' },
  { id: 'smooth', method: 'standard', dithering: 'floyd-steinberg',
    i18n: 'import.methodSmooth', fallback: 'Smooth',
    hint: 'Dithers the result - the best average tone and colour from a normal viewing distance, at the cost of visible noise up close' },
  { id: 'flat',   method: 'standard', dithering: 'none',
    i18n: 'import.methodFlat',   fallback: 'Flat',
    hint: 'No dithering - the cleanest blocks, with a more poster-like look' }
];

/**
 * PNG Format Handler
 *
 * Handles PNG import/export with:
 * - Import: Resize, quantize to the active mode's constraints, optional
 *   dithering. fixed16 modes use the classic per-cell same-bank 2-colour
 *   engine (cell geometry from the mode — 8×8 down to 8×1); ULAplus mode
 *   runs the Image2ULAplus-style pipeline: build a 64-register palette from
 *   the image (buildUlaplusPalette), then per cell pick the best CLUT and
 *   ink/paper pair from that CLUT's halves.
 * - Export: Standard PNG or scaled output (the composited canvas — works in
 *   every mode).
 */
class PNGFormatClass {
  constructor() {
    this.tempCanvas = null;
    this.tempCtx = null;
    /** The three side-by-side conversions — see IMPORT_METHODS above. */
    this.IMPORT_METHODS = IMPORT_METHODS;
    /** Reused per-cell full-resolution sample buffer — see _sampleCellHiRes. */
    this._hiResScratch = null;
  }

  /**
   * Initialize and register with FormatRegistry
   */
  initialize() {
    // Create offscreen canvas for processing
    this.tempCanvas = Helpers.createCanvas(ZX_SPECTRUM.WIDTH, ZX_SPECTRUM.HEIGHT);
    this.tempCtx = this.tempCanvas.getContext('2d', { willReadFrequently: true });
    this.tempCtx.imageSmoothingEnabled = false;

    FormatRegistry.registerImport('png', this);
    FormatRegistry.registerExport('png', this);
    Logger.info('PNGFormat', 'Initialized');
  }

  /**
   * Parse PNG file (import)
   * @param {ArrayBuffer} buffer - File data
   * @param {Object} options - Import options
   * @returns {Object} Result { success, error? }
   */
  async parse(buffer, options = {}) {
    const {
      dithering = 'floyd-steinberg',
      scaling = 'fit',
      brightness = 0,
      contrast = 0,
      method = 'standard'
    } = options;

    // Sniff the real type so GIF/JPG buffers delegated here decode with an
    // honest MIME (browsers sniff image payloads anyway, but don't rely on it)
    const blob = new Blob([buffer], { type: this._sniffMime(buffer) });
    let imageData = await this._loadImage(blob);

    if (!imageData) {
      return { success: false, error: 'Failed to load PNG image' };
    }

    // Pre-quantization adjustment (Import Conversion dialog options)
    if (brightness !== 0 || contrast !== 0) {
      imageData = this.applyBrightnessContrast(imageData, brightness, contrast);
    }

    // Scale to the screen resolution
    const scaled = this._scaleImage(imageData, scaling);

    // Per-cell: choose the best same-bank ink/paper pair, then dither
    // the original RGB against those two colours. The Detail method also
    // hands down the unscaled image, so the colour choice sees real detail
    // rather than its 4x4 average.
    this._applyToLayer(scaled, dithering, method === 'detail' ? imageData : null);

    Logger.info('PNGFormat', 'PNG imported successfully');
    EventBus.emit(EVENTS.FILE_IMPORT, { format: 'png' });

    return { success: true };
  }

  /**
   * Export to PNG
   * @param {Object} options - Export options
   * @returns {Promise<Blob>} PNG blob
   */
  async export(options = {}) {
    const scale = options.scale || 1;
    const width = ZX_SPECTRUM.WIDTH * scale;
    const height = ZX_SPECTRUM.HEIGHT * scale;

    const canvas = Helpers.createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    // Get current canvas image data
    const imageData = CanvasSystem.getImageData();

    if (scale === 1) {
      ctx.putImageData(imageData, 0, 0);
    } else {
      // Scale up using temp canvas
      this.tempCtx.putImageData(imageData, 0, 0);
      ctx.drawImage(this.tempCanvas, 0, 0, width, height);
    }

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error('Failed to create PNG')),
        'image/png'
      );
    });
  }

  /**
   * Export and trigger download (via the one FormatRegistry path)
   * @param {string} filename - Filename
   * @param {Object} options - Export options
   */
  async exportAndDownload(filename = 'image.png', options = {}) {
    const blob = await this.export(options);
    const name = filename.endsWith('.png') ? filename : `${filename}.png`;
    FormatRegistry.download(blob, name, 'image/png');
  }

  /**
   * Identify an image buffer by signature (PNG/JPEG/GIF; PNG as fallback).
   * @param {ArrayBuffer} buffer - Raw file bytes
   * @returns {string} MIME type
   * @private
   */
  _sniffMime(buffer) {
    const b = new Uint8Array(buffer.slice(0, 4));
    if (b[0] === 0xFF && b[1] === 0xD8) return 'image/jpeg';
    if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return 'image/gif'; // "GIF"
    return 'image/png';
  }

  /**
   * Load image from blob. Decodes via a data URL (Helpers owns the FileReader),
   * so no object URLs are created outside the sanctioned owners.
   * @param {Blob} blob - Image blob
   * @returns {Promise<ImageData>}
   * @private
   */
  async _loadImage(blob) {
    let dataUrl;
    try {
      dataUrl = await Helpers.readFileAsDataURL(blob);
    } catch {
      return null;
    }

    return new Promise((resolve) => {
      const img = new Image();

      img.onload = () => {
        const canvas = Helpers.createCanvas(img.width, img.height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        resolve(ctx.getImageData(0, 0, img.width, img.height));
      };

      img.onerror = () => resolve(null);

      img.src = dataUrl;
    });
  }

  /**
   * Scale image to the screen resolution
   * @param {ImageData} imageData - Source image
   * @param {string} mode - 'fit', 'stretch', or 'crop'
   * @returns {ImageData}
   * @private
   */
  _scaleImage(imageData, mode) {
    const canvas = Helpers.createCanvas(ZX_SPECTRUM.WIDTH, ZX_SPECTRUM.HEIGHT);
    const ctx = canvas.getContext('2d');

    /*
     * Smooth when SHRINKING, sharp when enlarging.
     *
     * This was unconditionally off, which is right for blowing pixel art up -
     * you want the blocks - and badly wrong for bringing a photograph down.
     * Nearest-neighbour from 1024x768 to 256x192 keeps one pixel in sixteen
     * and discards the rest, so fine detail becomes aliased noise before the
     * quantizer has seen anything, and no amount of palette work recovers it.
     * Averaging is what a downscale is for.
     *
     * The test is the SOURCE size, not the mode: an image already at or below
     * the screen size is being enlarged or left alone, and those want the hard
     * edges.
     */
    ctx.imageSmoothingEnabled =
        imageData.width > ZX_SPECTRUM.WIDTH || imageData.height > ZX_SPECTRUM.HEIGHT;
    ctx.imageSmoothingQuality = 'high';

    // Create source canvas
    const srcCanvas = Helpers.createCanvas(imageData.width, imageData.height);
    const srcCtx = srcCanvas.getContext('2d');
    srcCtx.putImageData(imageData, 0, 0);

    if (mode === 'stretch') {
      ctx.drawImage(srcCanvas, 0, 0, ZX_SPECTRUM.WIDTH, ZX_SPECTRUM.HEIGHT);
    } else if (mode === 'fit') {
      const scale = Math.min(
        ZX_SPECTRUM.WIDTH / imageData.width,
        ZX_SPECTRUM.HEIGHT / imageData.height
      );
      const newWidth = imageData.width * scale;
      const newHeight = imageData.height * scale;
      const x = (ZX_SPECTRUM.WIDTH - newWidth) / 2;
      const y = (ZX_SPECTRUM.HEIGHT - newHeight) / 2;

      // Letterbox in ZX black (palette index 0)
      ctx.fillStyle = ZX_PALETTE[0];
      ctx.fillRect(0, 0, ZX_SPECTRUM.WIDTH, ZX_SPECTRUM.HEIGHT);
      ctx.drawImage(srcCanvas, x, y, newWidth, newHeight);
    } else { // crop
      const scale = Math.max(
        ZX_SPECTRUM.WIDTH / imageData.width,
        ZX_SPECTRUM.HEIGHT / imageData.height
      );
      const newWidth = imageData.width * scale;
      const newHeight = imageData.height * scale;
      const x = (ZX_SPECTRUM.WIDTH - newWidth) / 2;
      const y = (ZX_SPECTRUM.HEIGHT - newHeight) / 2;

      ctx.drawImage(srcCanvas, x, y, newWidth, newHeight);
    }

    return ctx.getImageData(0, 0, ZX_SPECTRUM.WIDTH, ZX_SPECTRUM.HEIGHT);
  }

  /**
   * Apply an RGB image to the current layer, one attribute cell at a time.
   * Cell geometry comes from the active mode; in ULAplus mode the image
   * first GENERATES the document's 64-register palette (Image2ULAplus
   * pipeline) inside the same undo action, so one Undo restores palette
   * and pixels together.
   * @param {ImageData} imageData - Scaled full-screen image
   * @param {string} dithering - 'none' or 'floyd-steinberg'
   * @param {ImageData} [source] - the ORIGINAL, unscaled image. When given,
   *   each cell's two colours are chosen from every source pixel it covers
   *   rather than from the 64 already-averaged screen pixels - the Detail
   *   method. See _sampleCellHiRes.
   * @private
   */
  _applyToLayer(imageData, dithering, source) {
    const layer = LayerManager.getCurrentLayer();
    if (!layer) return;

    // Indexed Next modes (Phase 13): no cell constraint — generate a
    // source-faithful palette for the mode's window (median cut, 9-bit
    // snap), load it as document state, then per-pixel nearest index with
    // optional error diffusion. Palette + pixels share one undo action.
    if (ZX_SPECTRUM.PIXEL_DEPTH > 1) {
      UndoRedoService.beginAction('Load PNG');
      const regs = PaletteOps.buildNextRegisters(imageData, ZX_SPECTRUM.PALETTE_SIZE);
      if (window.ColorManager) ColorManager.setNextRegisters(regs);
      const indices = this._quantizeIndices(imageData, dithering);
      for (let y = 0; y < ZX_SPECTRUM.HEIGHT; y++) {
        for (let x = 0; x < ZX_SPECTRUM.WIDTH; x++) {
          layer.setPixelIndex(x, y, indices[y * ZX_SPECTRUM.WIDTH + x]);
        }
      }
      LayerManager.composeToCanvas();
      UndoRedoService.endAction();
      return;
    }

    const cw = ZX_SPECTRUM.CELL_WIDTH;
    const ch = ZX_SPECTRUM.CELL_HEIGHT;
    const ulaplus = ACTIVE_SCREEN_MODE.paletteModel === 'ulaplus64';

    UndoRedoService.beginAction('Load PNG');

    let paletteRGBs = null;
    if (ulaplus) {
      const regs = this.buildUlaplusPalette(imageData);
      if (window.ColorManager) ColorManager.setUlaplusRegisters(regs);
      paletteRGBs = Array.from(regs, (r) => ULAPLUS.registerToRGB(r));
    }

    for (let cellY = 0; cellY < ZX_SPECTRUM.GRID_ROWS; cellY++) {
      for (let cellX = 0; cellX < ZX_SPECTRUM.GRID_COLS; cellX++) {
        const { cellRGB, decideRGB } =
          this._cellSamples(imageData, source, cellX, cellY, cw, ch);

        let attrs, pixels;
        if (ulaplus) {
          const pick = this._chooseCellPairUlaplus(decideRGB, paletteRGBs);
          pixels = this._renderCellMask(cellRGB, pick, dithering, cw, ch);
          attrs = {
            ink: pick.inkSlot,
            paper: pick.paperSlot,
            bright: (pick.clut & 1) !== 0,
            flash: (pick.clut & 2) !== 0
          };
        } else {
          const pair = this._chooseCellPair(decideRGB);
          pixels = this._renderCellMask(cellRGB, pair, dithering, cw, ch);
          attrs = {
            ink: pair.ink % 8,
            paper: pair.paper % 8,
            bright: pair.bright,
            flash: false
          };
        }

        layer.setCell(cellX, cellY, {
          ink: attrs.ink,
          paper: attrs.paper,
          bright: attrs.bright,
          flash: attrs.flash,
          pixels: pixels
        });
      }
    }

    // Sync to AttributeSystem and render
    for (let cellY = 0; cellY < ZX_SPECTRUM.GRID_ROWS; cellY++) {
      for (let cellX = 0; cellX < ZX_SPECTRUM.GRID_COLS; cellX++) {
        const cell = layer.getCell(cellX, cellY);
        if (cell) {
          AttributeSystem.setCell(cellX, cellY, cell);
        }
      }
    }

    LayerManager.composeToCanvas();

    UndoRedoService.endAction();
  }

  /**
   * Decode a raw image file buffer to RGBA (Import Conversion dialog seam).
   * @param {ArrayBuffer} buffer - File bytes (any image type the browser decodes)
   * @param {string} [mime] - MIME type hint
   * @returns {Promise<ImageData|null>}
   */
  async decodeToImageData(buffer, mime = 'image/png') {
    return this._loadImage(new Blob([buffer], { type: mime }));
  }

  /**
   * Brightness/contrast adjustment — pure pixel math (Node-tested).
   * brightness -100..100 maps to an additive shift of ±127; contrast
   * -100..100 uses the standard 259-based factor around the 128 midpoint.
   * Alpha is preserved. The input is not mutated.
   * @param {ImageData|{width:number,height:number,data:Uint8ClampedArray}} imageData
   * @param {number} brightness - -100..100 (0 = unchanged)
   * @param {number} contrast - -100..100 (0 = unchanged)
   * @returns {ImageData|{width:number,height:number,data:Uint8ClampedArray}}
   */
  applyBrightnessContrast(imageData, brightness = 0, contrast = 0) {
    const w = imageData.width, h = imageData.height;
    const src = imageData.data;
    const out = (typeof ImageData === 'function')
      ? new ImageData(w, h)
      : { width: w, height: h, data: new Uint8ClampedArray(src.length) };
    const dst = out.data;

    const shift = Helpers.clamp(brightness, -100, 100) * 127 / 100;
    const c = Helpers.clamp(contrast, -100, 100) * 255 / 100;
    const factor = (259 * (c + 255)) / (255 * (259 - c));

    for (let i = 0; i < src.length; i += 4) {
      dst[i]     = factor * (src[i]     + shift - 128) + 128;
      dst[i + 1] = factor * (src[i + 1] + shift - 128) + 128;
      dst[i + 2] = factor * (src[i + 2] + shift - 128) + 128;
      dst[i + 3] = src[i + 3];   // Uint8ClampedArray clamps the colour writes
    }
    return out;
  }

  /**
   * Quantize an RGBA image to the ZX screen exactly as parse() would apply
   * it, but return the result as full-screen RGBA instead of touching any
   * layer — the Import Conversion dialog renders this as its live preview.
   * Input already at screen size skips the (canvas-based) scaling step, so
   * this path is pure math end to end.
   * @param {ImageData|{width:number,height:number,data:Uint8ClampedArray}} imageData
   * @param {Object} [options] - { dithering, scaling, method }
   * @returns {{width:number,height:number,data:Uint8ClampedArray}}
   */
  quantizeForPreview(imageData, options = {}) {
    const { dithering = 'floyd-steinberg', scaling = 'fit', method = 'standard' } = options;
    return this._quantizePrepared(this._preparePreview(imageData, scaling),
      { method, dithering });
  }

  /**
   * Render EVERY conversion in IMPORT_METHODS from one decoded image — what
   * the Import dialog shows side by side.
   *
   * The downscale and the generated palette depend only on the source and the
   * scaling mode, not on the method, so they are computed ONCE and shared.
   * Looping quantizeForPreview instead re-scaled the whole photo and rebuilt
   * the palette three times per slider tick.
   * @param {ImageData|{width:number,height:number,data:Uint8ClampedArray}} imageData
   * @param {Object} [options] - { scaling }
   * @returns {Array<{id:string,preview:{width:number,height:number,data:Uint8ClampedArray}}>}
   */
  quantizePreviewSet(imageData, options = {}) {
    const prepared = this._preparePreview(imageData, options.scaling || 'fit');
    return IMPORT_METHODS.map((m) => ({
      id: m.id,
      preview: this._quantizePrepared(prepared, m)
    }));
  }

  /**
   * The method-independent half of a preview: scale to the screen once and
   * generate whatever palette the mode wants from the result.
   * @returns {{scaled:Object, source:?Object, nextRGB:?Array, paletteRGBs:?Array}}
   * @private
   */
  _preparePreview(imageData, scaling) {
    const scaled = (imageData.width === ZX_SPECTRUM.WIDTH &&
                    imageData.height === ZX_SPECTRUM.HEIGHT)
      ? imageData
      : this._scaleImage(imageData, scaling);
    // The Detail method needs the unscaled image for the per-cell colour choice
    const source = imageData !== scaled ? imageData : null;

    // Indexed Next modes (Phase 13): the same generated palette the import
    // would load — WITHOUT touching the document's registers.
    if (ZX_SPECTRUM.PIXEL_DEPTH > 1) {
      const regs = PaletteOps.buildNextRegisters(scaled, ZX_SPECTRUM.PALETTE_SIZE);
      const nextRGB = [];
      for (let i = 0; i < ZX_SPECTRUM.PALETTE_SIZE; i++) {
        nextRGB.push(NEXTRGB333.registerToRGB(regs[i]));
      }
      return { scaled, source, nextRGB, paletteRGBs: null };
    }

    // ULAplus: preview the palette the import would generate, same rule
    const paletteRGBs = ACTIVE_SCREEN_MODE.paletteModel === 'ulaplus64'
      ? Array.from(this.buildUlaplusPalette(scaled), (r) => ULAPLUS.registerToRGB(r))
      : null;
    return { scaled, source, nextRGB: null, paletteRGBs };
  }

  /**
   * The method-dependent half: quantize a prepared image under one conversion.
   * @param {Object} prepared - from _preparePreview
   * @param {Object} spec - { method, dithering } (an IMPORT_METHODS entry)
   * @private
   */
  _quantizePrepared(prepared, spec) {
    const { scaled, nextRGB, paletteRGBs } = prepared;
    const { dithering } = spec;
    const source = spec.method === 'detail' ? prepared.source : null;

    if (nextRGB) {
      const indices = this._quantizeIndices(scaled, dithering, nextRGB);
      const out = new Uint8ClampedArray(ZX_SPECTRUM.WIDTH * ZX_SPECTRUM.HEIGHT * 4);
      for (let i = 0; i < indices.length; i++) {
        const rgb = nextRGB[indices[i]];
        out[i * 4] = rgb[0]; out[i * 4 + 1] = rgb[1];
        out[i * 4 + 2] = rgb[2]; out[i * 4 + 3] = 255;
      }
      return { width: ZX_SPECTRUM.WIDTH, height: ZX_SPECTRUM.HEIGHT, data: out };
    }

    const cw = ZX_SPECTRUM.CELL_WIDTH;
    const ch = ZX_SPECTRUM.CELL_HEIGHT;
    const out = new Uint8ClampedArray(ZX_SPECTRUM.WIDTH * ZX_SPECTRUM.HEIGHT * 4);

    for (let cellY = 0; cellY < ZX_SPECTRUM.GRID_ROWS; cellY++) {
      for (let cellX = 0; cellX < ZX_SPECTRUM.GRID_COLS; cellX++) {
        // Same two samples as the import path, so the preview IS the result
        const { cellRGB, decideRGB } =
          this._cellSamples(scaled, source, cellX, cellY, cw, ch);

        let rows, inkRGB, paperRGB;
        if (paletteRGBs) {
          const pick = this._chooseCellPairUlaplus(decideRGB, paletteRGBs);
          rows = this._renderCellMask(cellRGB, pick, dithering, cw, ch);
          inkRGB = pick.inkRGB;
          paperRGB = pick.paperRGB;
        } else {
          const pair = this._chooseCellPair(decideRGB);
          rows = this._renderCellMask(cellRGB, pair, dithering, cw, ch);
          inkRGB = ZX_PALETTE_RGB[pair.ink];
          paperRGB = ZX_PALETTE_RGB[pair.paper];
        }

        const start = ZX_COORDS.cellToPixel(cellX, cellY);
        for (let dy = 0; dy < ch; dy++) {
          for (let dx = 0; dx < cw; dx++) {
            const isInk = (rows[dy] >> (cw - 1 - dx)) & 1;
            const rgb = isInk ? inkRGB : paperRGB;
            const o = ((start.y + dy) * ZX_SPECTRUM.WIDTH + (start.x + dx)) * 4;
            out[o] = rgb[0]; out[o + 1] = rgb[1]; out[o + 2] = rgb[2]; out[o + 3] = 255;
          }
        }
      }
    }

    return { width: ZX_SPECTRUM.WIDTH, height: ZX_SPECTRUM.HEIGHT, data: out };
  }

  /**
   * Quantize a full-screen RGBA image to per-pixel palette indices for the
   * active indexed mode (Phase 13): nearest active-palette entry, with
   * Floyd–Steinberg error diffusion when requested. Pure math — shared by
   * the import apply and the Import dialog preview.
   * @param {ImageData|{width,height,data}} imageData - Screen-sized RGBA
   * @param {string} dithering - 'none' or 'floyd-steinberg'
   * @param {Array<number[]>} [paletteOverride] - Quantize against this RGB
   *   list instead of the document palette (preview path)
   * @returns {Int16Array} width*height palette indices
   */
  _quantizeIndices(imageData, dithering, paletteOverride = null) {
    const W = ZX_SPECTRUM.WIDTH, H = ZX_SPECTRUM.HEIGHT;
    const paletteRGB = paletteOverride ||
      Array.from({ length: ZX_SPECTRUM.PALETTE_SIZE }, (_, i) => ColorManager.getRGB(i));
    const n = paletteRGB.length;

    // Float working copy for error diffusion
    const work = new Float32Array(W * H * 3);
    for (let i = 0; i < W * H; i++) {
      work[i * 3] = imageData.data[i * 4];
      work[i * 3 + 1] = imageData.data[i * 4 + 1];
      work[i * 3 + 2] = imageData.data[i * 4 + 2];
    }

    const fs = dithering === 'floyd-steinberg';
    const out = new Int16Array(W * H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const p = (y * W + x) * 3;
        const r = work[p], g = work[p + 1], b = work[p + 2];
        let best = 0, bestD = Infinity;
        for (let i = 0; i < n; i++) {
          const pr = paletteRGB[i];
          const d = (r - pr[0]) * (r - pr[0]) + (g - pr[1]) * (g - pr[1])
            + (b - pr[2]) * (b - pr[2]);
          if (d < bestD) { bestD = d; best = i; }
        }
        out[y * W + x] = best;
        if (fs) {
          const pr = paletteRGB[best];
          const er = r - pr[0], eg = g - pr[1], eb = b - pr[2];
          const spread = (dx, dy, f) => {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || nx >= W || ny >= H) return;
            const q = (ny * W + nx) * 3;
            work[q] += er * f; work[q + 1] += eg * f; work[q + 2] += eb * f;
          };
          spread(1, 0, 7 / 16); spread(-1, 1, 3 / 16);
          spread(0, 1, 5 / 16); spread(1, 1, 1 / 16);
        }
      }
    }
    return out;
  }

  /**
   * Decode an image blob and quantize it to a 1-bit ink mask for the
   * floating-stamp paste path (system clipboard paste). Oversized images
   * are downscaled to fit the screen first; smaller ones keep their size.
   * @param {Blob} blob - Any image type the browser can decode
   * @returns {Promise<{mask: boolean[][], width: number, height: number}|null>}
   */
  async blobToInkMask(blob) {
    let img = await this._loadImage(blob);
    if (!img) return null;

    if (img.width > ZX_SPECTRUM.WIDTH || img.height > ZX_SPECTRUM.HEIGHT) {
      const scale = Math.min(
        ZX_SPECTRUM.WIDTH / img.width,
        ZX_SPECTRUM.HEIGHT / img.height
      );
      const nw = Math.max(1, Math.floor(img.width * scale));
      const nh = Math.max(1, Math.floor(img.height * scale));
      const srcCanvas = Helpers.createCanvas(img.width, img.height);
      srcCanvas.getContext('2d').putImageData(img, 0, 0);
      const dstCanvas = Helpers.createCanvas(nw, nh);
      const ctx = dstCanvas.getContext('2d');
      ctx.imageSmoothingEnabled = true; // averaging feeds the quantizer better
      ctx.drawImage(srcCanvas, 0, 0, nw, nh);
      img = ctx.getImageData(0, 0, nw, nh);
    }

    return this.imageToInkMask(img);
  }

  /**
   * Quantize an arbitrary RGBA image to a 1-bit ink mask through the same
   * per-cell 2-colour engine the PNG import uses. The stamp model is
   * monochrome: the mask marks the pixels that map to each cell's INK
   * colour (the less-frequent colour of the pair — glyphs/details), and the
   * user's current ink supplies the colour at commit time. Transparent
   * pixels composite against white (paper). Flat single-colour cells become
   * solid ink when dark, empty when light.
   * @param {ImageData|{width: number, height: number, data: Uint8ClampedArray}} imageData
   * @returns {{mask: boolean[][], width: number, height: number}}
   */
  imageToInkMask(imageData) {
    const w = imageData.width, h = imageData.height;
    const data = imageData.data;
    const mask = [];
    for (let y = 0; y < h; y++) mask.push(new Array(w).fill(false));

    const cellsX = Math.ceil(w / CS);
    const cellsY = Math.ceil(h / CS);
    const cellRGB = new Float32Array(CELL_PIXELS * 3);

    for (let cy = 0; cy < cellsY; cy++) {
      for (let cx = 0; cx < cellsX; cx++) {
        // Extract the cell, clamp-sampling past the right/bottom edges
        for (let dy = 0; dy < CS; dy++) {
          for (let dx = 0; dx < CS; dx++) {
            const sx = Math.min(cx * CS + dx, w - 1);
            const sy = Math.min(cy * CS + dy, h - 1);
            const src = (sy * w + sx) * 4;
            const a = data[src + 3] / 255;
            const dst = (dy * CS + dx) * 3;
            cellRGB[dst]     = data[src]     * a + 255 * (1 - a);
            cellRGB[dst + 1] = data[src + 1] * a + 255 * (1 - a);
            cellRGB[dst + 2] = data[src + 2] * a + 255 * (1 - a);
          }
        }

        const pair = this._chooseCellPair(cellRGB);

        if (pair.ink === pair.paper) {
          // Flat cell — _renderCellMask would mark everything ink (the
          // distance tie), so decide by luminance instead
          const rgb = ZX_PALETTE_RGB[pair.ink];
          const dark = (rgb[0] * 0.299 + rgb[1] * 0.587 + rgb[2] * 0.114) < 128;
          if (dark) {
            for (let dy = 0; dy < CS && cy * CS + dy < h; dy++) {
              for (let dx = 0; dx < CS && cx * CS + dx < w; dx++) {
                mask[cy * CS + dy][cx * CS + dx] = true;
              }
            }
          }
          continue;
        }

        const rows = this._renderCellMask(cellRGB, pair, 'floyd-steinberg');
        for (let dy = 0; dy < CS && cy * CS + dy < h; dy++) {
          for (let dx = 0; dx < CS && cx * CS + dx < w; dx++) {
            if (rows[dy] & (1 << (CS - 1 - dx))) {
              mask[cy * CS + dy][cx * CS + dx] = true;
            }
          }
        }
      }
    }

    return { mask, width: w, height: h };
  }

  /**
   * The two RGB samples one cell is decided from, for either conversion —
   * shared by the import apply and the dialog preview so the preview cannot
   * drift from the result it is promising.
   *
   * Detail method (source given): decide the colours from the full-resolution
   * source and the mask from per-output-pixel means. Everything downstream is
   * unchanged - both samplers hand back the same flat RGB shape.
   * @param {ImageData} screen - the scaled, screen-sized image
   * @param {?ImageData} source - the ORIGINAL, or null for the standard method
   * @returns {{cellRGB: Float32Array, decideRGB: Float32Array}}
   * @private
   */
  _cellSamples(screen, source, cellX, cellY, w, h) {
    if (!source) {
      const cellRGB = this._extractCellRGB(screen, cellX, cellY, w, h);
      return { cellRGB, decideRGB: cellRGB };
    }
    const hiRes = this._sampleCellHiRes(source, cellX, cellY, w, h);
    return { cellRGB: hiRes.blocks, decideRGB: hiRes.full };
  }

  /**
   * Sample one cell from the FULL-RESOLUTION source instead of the scaled
   * screen, for the Detail conversion method.
   *
   * Scaling to 256x192 first averages a 4x4 block of a 1024x768 photo into a
   * single pixel BEFORE anything decides what colour the cell should be, so
   * fine bright detail is already grey by the time the quantizer sees it. Here
   * the cell's two colours are chosen from every source pixel the cell covers
   * - 768 of them for a 1024x768 photo rather than 64 - and only the MASK is
   * decided at screen resolution, from the mean of each output pixel's own
   * source block.
   *
   * Returns both samples because they answer different questions: `full` is
   * the evidence for "which two colours", `blocks` is the evidence for "which
   * of the two, here". Both are flat [r,g,b,...] so the existing pair choosers
   * and mask renderer take them unchanged - they are length-agnostic.
   *
   * `full` is a view on a REUSED scratch buffer, valid only until the next
   * call: at 12 MP a fresh allocation per cell churned ~137 MiB per render,
   * on the animation frame the slider drag runs on. Every consumer reads it
   * synchronously; anything that wants to keep it must copy it.
   *
   * @param {ImageData} source - the ORIGINAL decoded image
   * @param {number} cellX @param {number} cellY - cell position on the screen grid
   * @param {number} w @param {number} h - cell size in screen pixels
   * @returns {{full: Float32Array, blocks: Float32Array}}
   * @private
   */
  _sampleCellHiRes(source, cellX, cellY, w, h) {
    const sx = source.width / ZX_SPECTRUM.WIDTH;
    const sy = source.height / ZX_SPECTRUM.HEIGHT;
    const x0 = Math.floor(cellX * w * sx), x1 = Math.max(x0 + 1, Math.round((cellX + 1) * w * sx));
    const y0 = Math.floor(cellY * h * sy), y1 = Math.max(y0 + 1, Math.round((cellY + 1) * h * sy));

    const need = (x1 - x0) * (y1 - y0) * 3;
    if (!this._hiResScratch || this._hiResScratch.length < need) {
      this._hiResScratch = new Float32Array(need);
    }
    const full = this._hiResScratch;
    let f = 0;
    for (let y = y0; y < y1 && y < source.height; y++) {
      for (let x = x0; x < x1 && x < source.width; x++) {
        const i = (y * source.width + x) * 4;
        full[f++] = source.data[i];
        full[f++] = source.data[i + 1];
        full[f++] = source.data[i + 2];
      }
    }

    const blocks = new Float32Array(w * h * 3);
    const bw = (x1 - x0) / w, bh = (y1 - y0) / h;
    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        const bx0 = Math.floor(x0 + px * bw), bx1 = Math.max(bx0 + 1, Math.floor(x0 + (px + 1) * bw));
        const by0 = Math.floor(y0 + py * bh), by1 = Math.max(by0 + 1, Math.floor(y0 + (py + 1) * bh));
        let r = 0, g = 0, b = 0, n = 0;
        for (let y = by0; y < by1 && y < source.height; y++) {
          for (let x = bx0; x < bx1 && x < source.width; x++) {
            const i = (y * source.width + x) * 4;
            r += source.data[i]; g += source.data[i + 1]; b += source.data[i + 2]; n++;
          }
        }
        const o = (py * w + px) * 3;
        blocks[o] = r / n; blocks[o + 1] = g / n; blocks[o + 2] = b / n;
      }
    }
    return { full: full.subarray(0, f), blocks };
  }

  /**
   * Copy one attribute cell's RGB values out of an ImageData
   * @param {ImageData} imageData - Full-screen source
   * @param {number} cellX - Cell column
   * @param {number} cellY - Cell row
   * @param {number} [w] - Cell width in px (default: the 8×8 block)
   * @param {number} [h] - Cell height in px
   * @returns {Float32Array} w*h x [r,g,b], row-major
   * @private
   */
  _extractCellRGB(imageData, cellX, cellY, w = CS, h = CS) {
    const out = new Float32Array(w * h * 3);
    const start = { x: cellX * w, y: cellY * h };

    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        const src = ((start.y + dy) * imageData.width + (start.x + dx)) * 4;
        const dst = (dy * w + dx) * 3;
        out[dst] = imageData.data[src];
        out[dst + 1] = imageData.data[src + 1];
        out[dst + 2] = imageData.data[src + 2];
      }
    }
    return out;
  }

  /**
   * Perceptually weighted squared distance between an RGB pixel and a palette entry
   * @private
   */
  _dist2(r, g, b, rgb) {
    const dr = r - rgb[0];
    const dg = g - rgb[1];
    const db = b - rgb[2];
    return dr * dr * 0.299 + dg * dg * 0.587 + db * db * 0.114;
  }

  /**
   * Choose the best ink/paper pair for a cell. The ZX BRIGHT flag is
   * cell-wide, so both colours must come from the same bank: try bank 0
   * (colours 0-7) and bank 1 (8-15), score each candidate pair by total
   * error over the cell, keep the cheaper bank.
   * @param {Float32Array} cellRGB - From _extractCellRGB
   * @returns {{ink: number, paper: number, bright: boolean}} 0-15 palette indices
   * @private
   */
  _chooseCellPair(cellRGB) {
    const pixelCount = cellRGB.length / 3;
    let best = null;

    for (const bright of [false, true]) {
      const base = bright ? 8 : 0;

      // Nearest in-bank colour per pixel -> frequency count
      const counts = new Array(8).fill(0);
      for (let i = 0; i < pixelCount; i++) {
        const r = cellRGB[i * 3], g = cellRGB[i * 3 + 1], b = cellRGB[i * 3 + 2];
        let nearest = 0, nd = Infinity;
        for (let c = 0; c < 8; c++) {
          const d = this._dist2(r, g, b, ZX_PALETTE_RGB[base + c]);
          if (d < nd) { nd = d; nearest = c; }
        }
        counts[nearest]++;
      }

      const sorted = counts
        .map((count, index) => ({ count, index }))
        .sort((a, b) => b.count - a.count);
      const paper = base + sorted[0].index;
      const ink = sorted[1].count > 0 ? base + sorted[1].index : paper;

      // Score the final 2-colour pair against the cell
      let err = 0;
      for (let i = 0; i < pixelCount; i++) {
        const r = cellRGB[i * 3], g = cellRGB[i * 3 + 1], b = cellRGB[i * 3 + 2];
        err += Math.min(
          this._dist2(r, g, b, ZX_PALETTE_RGB[ink]),
          this._dist2(r, g, b, ZX_PALETTE_RGB[paper])
        );
      }

      if (!best || err < best.err) {
        best = { ink, paper, bright, err };
      }
    }

    return { ink: best.ink, paper: best.paper, bright: best.bright };
  }

  /**
   * ULAplus cell pair — delegates to the shared PaletteOps picker (also
   * used by ScreenModeService for indexed -> ULAplus conversion).
   * @param {Float32Array} cellRGB - From _extractCellRGB
   * @param {Array<number[]>} paletteRGBs - 64 [r,g,b] entries
   * @returns {{clut:number, inkSlot:number, paperSlot:number,
   *            inkRGB:number[], paperRGB:number[]}}
   * @private
   */
  _chooseCellPairUlaplus(cellRGB, paletteRGBs) {
    return PaletteOps.chooseUlaplusCellPair(cellRGB, paletteRGBs);
  }

  /**
   * Render a cell's pixels against its chosen 2-colour pair.
   * Floyd-Steinberg error diffusion runs within the cell only (the pair
   * changes at every cell boundary, so cross-cell diffusion would smear
   * error into a different palette).
   * @param {Float32Array} cellRGB - From _extractCellRGB (not mutated)
   * @param {Object} pair - { ink, paper } 0-15 palette indices, OR a pick
   *   carrying explicit { inkRGB, paperRGB } triplets (the ULAplus path)
   * @param {string} dithering - 'none' or 'floyd-steinberg'
   * @param {number} [w] - Cell width in px (default: the 8×8 block)
   * @param {number} [h] - Cell height in px
   * @returns {Uint8Array} h ZX pixel rows, MSB = leftmost pixel
   * @private
   */
  _renderCellMask(cellRGB, pair, dithering, w = CS, h = CS) {
    const inkRGB = pair.inkRGB || ZX_PALETTE_RGB[pair.ink];
    const paperRGB = pair.paperRGB || ZX_PALETTE_RGB[pair.paper];
    const buf = Float32Array.from(cellRGB);
    const pixels = new Uint8Array(h);
    const diffuse = dithering === 'floyd-steinberg';

    for (let y = 0; y < h; y++) {
      let rowByte = 0;
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 3;
        const r = Helpers.clamp(buf[i], 0, 255);
        const g = Helpers.clamp(buf[i + 1], 0, 255);
        const b = Helpers.clamp(buf[i + 2], 0, 255);

        const isInk = this._dist2(r, g, b, inkRGB) <= this._dist2(r, g, b, paperRGB);
        if (isInk) rowByte |= (1 << (w - 1 - x));

        if (diffuse) {
          const target = isInk ? inkRGB : paperRGB;
          const errR = r - target[0], errG = g - target[1], errB = b - target[2];
          this._diffuseInCell(buf, x + 1, y, errR, errG, errB, 7 / 16, w, h);
          this._diffuseInCell(buf, x - 1, y + 1, errR, errG, errB, 3 / 16, w, h);
          this._diffuseInCell(buf, x, y + 1, errR, errG, errB, 5 / 16, w, h);
          this._diffuseInCell(buf, x + 1, y + 1, errR, errG, errB, 1 / 16, w, h);
        }
      }
      pixels[y] = rowByte;
    }

    return pixels;
  }

  /**
   * Diffuse quantization error to a neighbour inside the attribute cell
   * @private
   */
  _diffuseInCell(buf, x, y, errR, errG, errB, factor, w = CS, h = CS) {
    if (x < 0 || x >= w || y < 0 || y >= h) return;
    const i = (y * w + x) * 3;
    buf[i] += errR * factor;
    buf[i + 1] += errG * factor;
    buf[i + 2] += errB * factor;
  }

  // ── Image2ULAplus-style palette generation (pure, Node-tested) ───────────

  /**
   * Build a 64-register ULAplus palette from an image — delegates to the
   * shared PaletteOps builder (Image2ULAplus-style pipeline; also used by
   * ScreenModeService when converting into ULAplus modes). Kept as a
   * public PNGFormat method for the Import dialog / preview callers.
   * @param {ImageData|{width:number,height:number,data:Uint8ClampedArray}} imageData
   * @returns {Uint8Array} 64 register bytes
   */
  buildUlaplusPalette(imageData) {
    return PaletteOps.buildUlaplusRegisters(imageData);
  }
}

// Create singleton
window.PNGFormat = new PNGFormatClass();

Logger.debug('PNGFormat', 'PNG format handler loaded');

})(); // End IIFE
