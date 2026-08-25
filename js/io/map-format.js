'use strict';
(function() {

/**
 * Native Map Format Handler — .zxtm (ZX tile map)
 *
 * Our own map file format, documented here:
 *
 *   A .zxtm file is UTF-8 JSON — exactly the MapCodec version-1 payload:
 *
 *     {
 *       "v": 1,                 // codec version (checked on import)
 *       "k": "ula-cell",        // tile kind (Phase 13 adds Next bank kinds)
 *       "name": "...",          // document name (≤ 64 chars)
 *       "tiles": [              // ordered tileset; index = map cell value
 *         { "b": "<base64: cellH bitmap bytes, MSB = left>", "a": attrByte }
 *       ],
 *       "map": {
 *         "w": width, "h": height,          // in tiles
 *         "cells": "<base64: w*h u16le, tileIndex+1, 0 = empty>"
 *       }
 *     }
 *
 * JSON over binary: the payload already exists as the persistence codec
 * (one source of truth for validation/versioning), diffs are readable,
 * and maps are small (a 256×256 map is ~180 KB).
 *
 * All parsing/validation lives in MapCodec (pure, Node-tested); this
 * handler is the FormatRegistry plumbing.
 */
class MapFormatClass {
  /**
   * Initialize and register with FormatRegistry
   */
  initialize() {
    FormatRegistry.registerImport('zxtm', this);
    FormatRegistry.registerExport('zxtm', this);
    Logger.info('MapFormat', 'Initialized');
  }

  /**
   * Parse .zxtm file data (import) into the working map document.
   * @param {ArrayBuffer} buffer - File data
   * @returns {Object} { success: true } or { success: false, error: string }
   */
  parse(buffer) {
    let payload;
    try {
      payload = JSON.parse(new TextDecoder().decode(buffer));
    } catch (e) {
      return { success: false, error: 'Not a valid .zxtm file (bad JSON)' };
    }
    const doc = MapCodec.decode(payload);
    if (!doc) {
      return { success: false, error: 'Not a valid .zxtm file (unknown version or corrupt data)' };
    }
    MapService.loadDocument(doc);
    EventBus.emit(EVENTS.FILE_IMPORT, { format: 'zxtm' });
    Logger.info('MapFormat', 'ZXTM map loaded successfully');
    return { success: true };
  }

  /**
   * Export the working map document as .zxtm bytes.
   * @returns {Uint8Array|null} File content, or null if not encodable
   */
  export() {
    const payload = MapCodec.encode(MapService.toDocument());
    if (!payload) return null;
    return new TextEncoder().encode(JSON.stringify(payload));
  }

  /**
   * Export and trigger browser download (via the one FormatRegistry path)
   * @param {string} filename - Target filename
   */
  async exportAndDownload(filename = 'map.zxtm', options = {}, handle = null) {
    const name = filename.endsWith('.zxtm') ? filename : `${filename}.zxtm`;
    const data = this.export();
    if (!data) {
      EventBus.emit(EVENTS.FILE_ERROR, { message: 'Map could not be encoded' });
      return false;
    }
    return FormatRegistry.download(data, name, 'application/json', handle);
  }
}

// Create singleton
window.MapFormat = new MapFormatClass();

Logger.debug('MapFormat', 'Native map format handler loaded');

})(); // End IIFE
