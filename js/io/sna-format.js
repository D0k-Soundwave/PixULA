'use strict';
(function() {

/**
 * SNA Format Handler (import only)
 *
 * ZX Spectrum snapshot: 27-byte register header followed by the RAM dump
 * starting at address 0x4000 — so the display file is always at file
 * offset 27. Valid sizes: 49179 (48K), 131103 / 147487 (128K variants,
 * which also dump the 0x4000-0xFFFF address space first).
 *
 * Used to rip loading screens out of game snapshots; registers, sound
 * and non-screen RAM are ignored.
 */
class SNAFormatClass {
  constructor() {
    this.HEADER_SIZE = 27;
    this.VALID_SIZES = [49179, 131103, 147487];
  }

  /**
   * Initialize and register with FormatRegistry
   */
  initialize() {
    FormatRegistry.registerImport('sna', this);
    Logger.info('SNAFormat', 'Initialized');
  }

  /**
   * Extract the screen from an SNA snapshot and load it
   * @param {ArrayBuffer} buffer - File data
   * @returns {Object} { success: true } or { success: false, error: string }
   */
  parse(buffer) {
    const bytes = new Uint8Array(buffer);

    if (!this.VALID_SIZES.includes(bytes.length)) {
      return {
        success: false,
        error: `Invalid SNA file size: ${bytes.length} bytes (expected ${this.VALID_SIZES.join(', ')})`
      };
    }

    const screen = bytes.slice(this.HEADER_SIZE, this.HEADER_SIZE + ZX_SPECTRUM.SCR_FILE_SIZE);
    const result = SCRFormat.parse(screen.buffer);

    if (result.success) {
      Logger.info('SNAFormat', 'Loaded screen from SNA snapshot');
      EventBus.emit(EVENTS.FILE_IMPORT, { format: 'sna' });
    }
    return result;
  }
}

// Create singleton
window.SNAFormat = new SNAFormatClass();

Logger.debug('SNAFormat', 'SNA format handler loaded');

})(); // End IIFE
