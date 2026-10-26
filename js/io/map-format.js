'use strict';
(function() {

/**
 * Native Map Format Handler — .zxtm (ZX tile map)
 *
 * Our own map file format, documented here:
 *
 *   A .zxtm file is UTF-8 JSON - exactly the MapCodec payload (version 2; version 1 files, written before elements existed, still load):
 *
 *     {
 *       "v": 2,                 // codec version (checked on import)
 *       "k": "ula-cell",        // tile kind (Phase 13 adds Next bank kinds)
 *       "name": "...",          // document name (≤ 64 chars)
 *       "tiles": [              // ordered tileset; index = map cell value
 *         { "b": "<base64: cellH bitmap bytes, MSB = left>", "a": attrByte }
 *       ],
 *       "map": {
 *         "w": width, "h": height,          // in tiles
 *         "cells": "<base64: w*h u16le, tileIndex+1, 0 = empty>"
 *       },
 *       "elements": [           // version 2: the results of "find repeated elements"
 *         { "n": name, "w": cells, "h": cells, "s": 1 or 2 screens, "gw": picture grid width, "gh": picture grid height,
 *           "m": "exact" | "dots" | "visual",
 *           "b": "<base64: s*w*h*cellH dot bytes>", "a": "<base64: s*w*h attribute bytes>",
 *           "p": "<base64: x,y byte pairs, the places, in cells>" }
 *       ]
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
  /** A map file fills the map, never the picture: no discard question, and the picture keeps its name (FileManager reads this). */
  importsDocument = false;

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
      return { success: false, error: Helpers.localizedMessage('err.notValidJson',
          'Not a valid {format} file (bad JSON)', { format: '.zxtm' }) };
    }
    const doc = MapCodec.decode(payload);
    if (!doc) {
      return { success: false, error: Helpers.localizedMessage('err.notValidVersion',
          'Not a valid {format} file (unknown version or corrupt data)', { format: '.zxtm' }) };
    }
    // A version 1 file predates elements: it must not wipe the ones the picture has
    // and a file with no elements leaves them alone; a file WITH elements asks first when the picture already has some (owner decision 2026-10-14)
    if (payload.v < 2 || !doc.elements.length) {
      delete doc.elements;
    } else if (MapService.elements.length && window.FileManager && typeof FileManager._askDropElements === 'function' && !FileManager._askDropElements()) {
      delete doc.elements;
    }
    MapService.loadDocument(doc);
    // the picture's elements were replaced: that is unsaved work (autosave, the warning on closing the tab)
    if (doc.elements && window.FileManager && FileManager.markModified) FileManager.markModified();
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
      EventBus.emit(EVENTS.FILE_ERROR, { message: Helpers.localizedMessage('err.mapEncode',
          'Map could not be encoded') });
      return false;
    }
    return FormatRegistry.download(data, name, 'application/json', handle);
  }
}

// Create singleton
window.MapFormat = new MapFormatClass();

Logger.debug('MapFormat', 'Native map format handler loaded');

})(); // End IIFE
