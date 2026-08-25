'use strict';
(function() {

/**
 * JPG Format Handler
 *
 * Handles JPG/JPEG import/export:
 * - Import: Reuses PNGFormat's import pipeline (resize, quantize, dither)
 * - Export: JPEG compression with quality setting
 */
class JPGFormatClass {
  constructor() {
    this.defaultQuality = 0.92;
  }

  /**
   * Initialize and register with FormatRegistry
   */
  initialize() {
    FormatRegistry.registerImport('jpg', this);
    FormatRegistry.registerImport('jpeg', this);
    FormatRegistry.registerExport('jpg', this);
    FormatRegistry.registerExport('jpeg', this);
    Logger.info('JPGFormat', 'Initialized');
  }

  /**
   * Parse JPG file (import)
   * Delegates to PNGFormat since the import process is identical
   * @param {ArrayBuffer} buffer - File data
   * @param {Object} options - Import options
   * @returns {Object} Result { success, error? }
   */
  async parse(buffer, options = {}) {
    // Reuse PNG import pipeline - it handles any image type
    return PNGFormat.parse(buffer, options);
  }

  /**
   * Export to JPG
   * @param {Object} options - Export options (scale, quality)
   * @returns {Promise<Blob>} JPG blob
   */
  async export(options = {}) {
    const scale = options.scale || 1;
    const quality = options.quality || this.defaultQuality;
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
      // Scale up
      const tempCanvas = Helpers.createCanvas(ZX_SPECTRUM.WIDTH, ZX_SPECTRUM.HEIGHT);
      const tempCtx = tempCanvas.getContext('2d');
      tempCtx.putImageData(imageData, 0, 0);
      ctx.drawImage(tempCanvas, 0, 0, width, height);
    }

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error('Failed to create JPG')),
        'image/jpeg',
        quality
      );
    });
  }

  /**
   * Export and trigger download (via the one FormatRegistry path)
   * @param {string} filename - Filename
   * @param {Object} options - Export options
   */
  async exportAndDownload(filename = 'image.jpg', options = {}, handle = null) {
    const blob = await this.export(options);
    // Ensure correct extension
    const name = filename.match(/\.(jpg|jpeg)$/i) ? filename : `${filename}.jpg`;
    return FormatRegistry.download(blob, name, 'image/jpeg', handle);
  }
}

// Create singleton
window.JPGFormat = new JPGFormatClass();

Logger.debug('JPGFormat', 'JPG format handler loaded');

})(); // End IIFE
