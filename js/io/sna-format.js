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
    // The screen inside a snapshot is a CLASSIC 6912-byte SCREEN$ at a
    // fixed offset - pinned, never the live ZX_SPECTRUM.SCR_FILE_SIZE view.
    // That view follows the ACTIVE mode, so loading a .sna while a ULAplus
    // document was open sliced 6976 bytes and handed the 64 bytes of
    // snapshot RAM that follow the screen to SCRFormat as a palette: the
    // emulator's memory became the artist's colours. In an indexed mode it
    // asked for 49152 bytes and failed with a size error naming a number
    // no snapshot contains.
    this.SCREEN_SIZE = SCREEN_MODES.STANDARD_ULA.fileSize;
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

    const screen = bytes.slice(this.HEADER_SIZE, this.HEADER_SIZE + this.SCREEN_SIZE);
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
