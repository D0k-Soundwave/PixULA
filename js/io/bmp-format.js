'use strict';
(function() {

/**
 * BMP Format Handler
 *
 * Handles BMP export (no import):
 * - Generates uncompressed 24-bit BMP files
 * - Supports scaling
 */
class BMPFormatClass {
  constructor() {
    this.HEADER_SIZE = 14;
    this.DIB_HEADER_SIZE = 40; // BITMAPINFOHEADER
  }

  /**
   * Initialize and register with FormatRegistry
   */
  initialize() {
    // BMP is export-only
    FormatRegistry.registerExport('bmp', this);
    Logger.info('BMPFormat', 'Initialized');
  }

  /**
   * Export to BMP
   * @param {Object} options - Export options (scale)
   * @returns {Uint8Array} BMP file data
   */
  export(options = {}) {
    const scale = options.scale || 1;
    const width = ZX_SPECTRUM.WIDTH * scale;
    const height = ZX_SPECTRUM.HEIGHT * scale;

    // Calculate sizes
    const rowSize = Math.ceil(width * 3 / 4) * 4; // Padded to 4 bytes
    const pixelDataSize = rowSize * height;
    const fileSize = this.HEADER_SIZE + this.DIB_HEADER_SIZE + pixelDataSize;

    const buffer = new ArrayBuffer(fileSize);
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);

    // BMP Header (14 bytes)
    bytes[0] = 0x42; // 'B'
    bytes[1] = 0x4D; // 'M'
    view.setUint32(2, fileSize, true);          // File size
    view.setUint32(6, 0, true);                 // Reserved
    view.setUint32(10, this.HEADER_SIZE + this.DIB_HEADER_SIZE, true); // Pixel data offset

    // DIB Header - BITMAPINFOHEADER (40 bytes)
    view.setUint32(14, this.DIB_HEADER_SIZE, true); // DIB header size
    view.setInt32(18, width, true);                 // Width
    view.setInt32(22, -height, true);               // Height (negative = top-down)
    view.setUint16(26, 1, true);                    // Color planes
    view.setUint16(28, 24, true);                   // Bits per pixel
    view.setUint32(30, 0, true);                    // Compression (none)
    view.setUint32(34, pixelDataSize, true);        // Image size
    view.setInt32(38, 2835, true);                  // X pixels per meter (72 DPI)
    view.setInt32(42, 2835, true);                  // Y pixels per meter
    view.setUint32(46, 0, true);                    // Colors in palette
    view.setUint32(50, 0, true);                    // Important colors

    // Get image data
    const imageData = CanvasSystem.getImageData();
    const data = imageData.data;

    // Write pixel data (BGR format, top-down due to negative height)
    let offset = this.HEADER_SIZE + this.DIB_HEADER_SIZE;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        // Scale coordinates back to source
        const srcX = Math.floor(x / scale);
        const srcY = Math.floor(y / scale);
        const srcI = (srcY * ZX_SPECTRUM.WIDTH + srcX) * 4;

        // BMP uses BGR order
        bytes[offset++] = data[srcI + 2]; // B
        bytes[offset++] = data[srcI + 1]; // G
        bytes[offset++] = data[srcI];     // R
      }

      // Pad row to 4-byte boundary
      while ((offset - this.HEADER_SIZE - this.DIB_HEADER_SIZE) % 4 !== 0) {
        bytes[offset++] = 0;
      }
    }

    Logger.info('BMPFormat', `Exported BMP (${fileSize} bytes)`);
    return bytes;
  }

  /**
   * Export and trigger download (via the one FormatRegistry path)
   * @param {string} filename - Filename
   * @param {Object} options - Export options
   */
  exportAndDownload(filename = 'image.bmp', options = {}) {
    const name = filename.endsWith('.bmp') ? filename : `${filename}.bmp`;
    FormatRegistry.download(this.export(options), name, 'image/bmp');
  }
}

// Create singleton
window.BMPFormat = new BMPFormatClass();

Logger.debug('BMPFormat', 'BMP format handler loaded');

})(); // End IIFE
