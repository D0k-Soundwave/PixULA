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
    // While captureDownloads runs, the bytes are handed back instead of saved.
    if (this._captured) {
      this._captured.push({ data, filename, mimeType });
      return true;
    }
    const saved = await Helpers.downloadFile(data, filename, mimeType, handle);
    if (!saved) return false;
    EventBus.emit(EVENTS.FILE_EXPORT, { format: this.getExtension(filename), filename });
    Logger.info('FormatRegistry', `Download triggered: ${filename}`);
    return true;
  }

  /**
   * Run `fn` - a format's own export-and-download - and collect what it would
   * have saved instead of saving it. Used to write each animation frame
   * through the exact path File > Save Image As uses, so every file is
   * byte for byte what a single save would write.
   * @param {Function} fn - may be async
   * @returns {Promise<Array<{data: Uint8Array|Blob, filename: string, mimeType: string}>>}
   */
  async captureDownloads(fn) {
    if (this._captured) throw new Error('captureDownloads does not nest');
    this._captured = [];
    try {
      await fn();
      return this._captured;
    } finally {
      this._captured = null;
    }
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
   * What Save Selection As may do for a format (Batch 9 part 9B), by extension. The rule is about the format, so it lives here
   * with the other format metadata:
   *   pixels  a picture format: any rectangle of the picture
   *   cells   whole attribute cells (the rectangle is fitted to cells first)
   *   tiles16 whole 16x16 tiles (fitted to the 16 grid first)
   *   screen  a fixed-size dump of one whole screen: only offered when the selection IS the whole screen
   * An extension with no entry (palettes, tile maps, fonts) is not a picture and is not offered.
   */
  get SELECTION_RULES() {
    return {
      png: 'pixels', bmp: 'pixels', jpg: 'pixels',
      zxp: 'cells', sev: 'cells', zed: 'cells', asm: 'cells', c: 'cells', bin: 'cells', atr: 'cells',
      ctile: 'tiles16',
      scr: 'screen', mlt: 'screen', ifl: 'screen', hrg: 'screen', img: 'screen', mg8: 'screen', mg4: 'screen',
      mg2: 'screen', mg1: 'screen', nxi: 'screen', sl2: 'screen', slr: 'screen', tap: 'screen', tzx: 'screen'
    };
  }

  /** @returns {?string} the Save Selection As rule of an extension, or null if it is not offered */
  selectionRule(extension) {
    return this.SELECTION_RULES[extension.toLowerCase()] || null;
  }

  /**
   * Whether, and as what rectangle, a selection can be saved in a format.
   * @param {string} extension
   * @param {?{x:number,y:number,width:number,height:number}} rect - the selection's bounding rectangle in pixels
   * @returns {{ok:boolean, rect?:Object, snapped?:boolean, reason?:string}} reason: none (no selection), notPicture,
   *   mode (the format cannot be saved in this screen mode), screenOnly (needs the whole screen), layout (this mode has no
   *   linear dump for a part)
   */
  selectionFit(extension, rect) {
    const ext = extension.toLowerCase();
    const rule = this.selectionRule(ext);
    if (!rule) return { ok: false, reason: 'notPicture' };
    if (!rect) return { ok: false, reason: 'none' };
    if (!this.isExportCompatible(ext)) return { ok: false, reason: 'mode' };
    const W = ZX_SPECTRUM.WIDTH, H = ZX_SPECTRUM.HEIGHT;
    const whole = rect.x === 0 && rect.y === 0 && rect.width === W && rect.height === H;
    if (rule === 'screen') return whole ? { ok: true, rect: null, snapped: false } : { ok: false, reason: 'screenOnly' };
    if (rule === 'pixels') return { ok: true, rect: { ...rect }, snapped: false };
    // cells / tiles16: fit to the grid, covering what was selected
    const handler = this.getExportHandler(ext);
    if (typeof handler.canExportRect === 'function' && !handler.canExportRect()) return { ok: false, reason: 'layout' };
    const size = SnapGrid.sizeOf(rule === 'cells' ? 'cell' : 'block16');
    const r = SnapGrid.blockRect({ x: rect.x, y: rect.y }, { x: rect.x + rect.width - 1, y: rect.y + rect.height - 1 }, size);
    const fitted = { x: r.x, y: r.y, width: r.w, height: r.h };
    const snapped = fitted.x !== rect.x || fitted.y !== rect.y || fitted.width !== rect.width || fitted.height !== rect.height;
    return { ok: true, rect: fitted, snapped };
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
