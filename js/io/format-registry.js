'use strict';
(function() {

/**
 * Format Registry
 *
 * Central registry for import/export format handlers.
 * Manages file format support and provides handler lookup.
 *
 * Also owns THE one download path: every format handler returns bytes (or a
 * Blob) from its export()/generate() and hands them to download() here —
 * no handler creates object URLs or anchor elements itself (lint-enforced).
 */
class FormatRegistryClass {
  constructor() {
    this.importFormats = new Map();
    this.exportFormats = new Map();
  }

  /**
   * Initialize the registry with built-in formats
   */
  initialize() {
    // Import formats are registered by their handlers when they load
    Logger.info('FormatRegistry', 'Initialized');
  }

  /**
   * Register an import format handler
   * @param {string} extension - File extension (without dot)
   * @param {Object} handler - Handler object with parse() method
   */
  registerImport(extension, handler) {
    const ext = extension.toLowerCase();
    this.importFormats.set(ext, handler);
    Logger.debug('FormatRegistry', `Registered import: .${ext}`);
  }

  /**
   * Register an export format handler
   * @param {string} extension - File extension (without dot)
   * @param {Object} handler - Handler object with export() method
   */
  registerExport(extension, handler) {
    const ext = extension.toLowerCase();
    this.exportFormats.set(ext, handler);
    Logger.debug('FormatRegistry', `Registered export: .${ext}`);
  }

  /**
   * The single save path for every export in the app.
   * Wraps the bytes in a Blob and hands them to Helpers.downloadFile()
   * (native Save dialog first, browser-download fallback - the one owner
   * of object-URL code), then announces the export on the bus.
   * @param {Uint8Array|ArrayBuffer|Blob|string} data - File content
   * @param {string} filename - Suggested filename (extension identifies the format)
   * @param {string} [mimeType] - MIME type for non-Blob data
   * @param {?FileSystemFileHandle} [handle] - a location already chosen by
   *   an earlier native picker call - write straight there instead of
   *   opening a second one for the same information.
   * @returns {Promise<boolean>} false only if the artist cancelled the native picker
   */
  async download(data, filename, mimeType = 'application/octet-stream', handle = null) {
    const saved = await Helpers.downloadFile(data, filename, mimeType, handle);
    if (!saved) return false;
    EventBus.emit(EVENTS.FILE_EXPORT, { format: this.getExtension(filename), filename });
    Logger.info('FormatRegistry', `Download triggered: ${filename}`);
    return true;
  }

  /**
   * Get import handler for extension
   * @param {string} extension - File extension
   * @returns {Object|null} Handler or null if not found
   */
  getImportHandler(extension) {
    return this.importFormats.get(extension.toLowerCase()) || null;
  }

  /**
   * Get export handler for extension
   * @param {string} extension - File extension
   * @returns {Object|null} Handler or null if not found
   */
  getExportHandler(extension) {
    return this.exportFormats.get(extension.toLowerCase()) || null;
  }

  /**
   * Check if extension is importable
   * @param {string} extension - File extension
   * @returns {boolean}
   */
  canImport(extension) {
    return this.importFormats.has(extension.toLowerCase());
  }

  /**
   * Check if extension is exportable
   * @param {string} extension - File extension
   * @returns {boolean}
   */
  canExport(extension) {
    return this.exportFormats.has(extension.toLowerCase());
  }

  /**
   * Whether a format can be exported in the ACTIVE screen mode — what a
   * Save UI asks before offering a format, rather than after the artist
   * picks one and the handler throws. Delegates to the handler's own
   * canExport() when it registered one (the per-format mode gates already
   * living in js/io/*.js); a handler with no canExport() is valid in every
   * mode (png/bmp/jpg/gif); an unregistered extension has nothing to
   * export at all.
   * @param {string} extension - File extension
   * @returns {boolean}
   */
  isExportCompatible(extension) {
    const handler = this.getExportHandler(extension);
    if (!handler) return false;
    return typeof handler.canExport === 'function' ? handler.canExport() : true;
  }

  /**
   * Get list of supported import formats
   * @returns {string[]} Array of extensions
   */
  getSupportedImportFormats() {
    return Array.from(this.importFormats.keys());
  }

  /**
   * Get list of supported export formats
   * @returns {string[]} Array of extensions
   */
  getSupportedExportFormats() {
    return Array.from(this.exportFormats.keys());
  }

  /**
   * Get accept string for file input (import)
   * @returns {string} Accept attribute value
   */
  getImportAcceptString() {
    const extensions = this.getSupportedImportFormats();
    return extensions.map(ext => `.${ext}`).join(',');
  }

  /**
   * Get file extension from filename
   * @param {string} filename - File name
   * @returns {string} Extension (lowercase, without dot)
   */
  getExtension(filename) {
    const parts = filename.split('.');
    return parts.length > 1 ? parts.pop().toLowerCase() : '';
  }
}

// Create singleton
window.FormatRegistry = new FormatRegistryClass();

Logger.debug('FormatRegistry', 'Format registry loaded');

})(); // End IIFE
