'use strict';
(function() {

/**
 * Native Preset Format Handler — .zxpreset (a shareable user preset)
 *
 * A .zxpreset file is UTF-8 JSON — the PresetCodec version-1 file form:
 *
 *   {
 *     "magic": "PIXULA-PRESET",
 *     "v": 1,
 *     "preset": {              // exactly PresetCodec.encode()'s payload
 *       "v": 1,
 *       "slot": 0,             // the slot it came from; import re-files it
 *       "name": "Fine spray, blue on black",
 *       "created": 0, "modified": 0,
 *       "meta": { "screenMode": "...", "paletteModel": "..." },
 *       "slices": { "tool": {...}, "color": {...}, ... },
 *       "asset": "<content key>" | null
 *     },
 *     "asset": {               // present only when the preset carries an image
 *       "v": 1,
 *       "dataUrl": "data:image/png;base64,...",
 *       "fileName": "...", "width": 0, "height": 0
 *     }
 *   }
 *
 * The reference image is INLINED here, unlike in storage where it lives in its
 * own content-addressed record: a file that arrives on another machine has to
 * be self-contained, and the sharing of one photo between slots is a local
 * optimisation with nothing to say about a file in transit. On import the image
 * is re-keyed by content, so a picture already in the library is shared rather
 * than duplicated.
 *
 * JSON over binary for the same reasons as .zxtm: the payload already exists as
 * the persistence codec (one source of truth for validation and versioning),
 * and a preset is small.
 *
 * All parsing/validation lives in PresetCodec (pure, Node-tested); this handler
 * is the FormatRegistry plumbing, plus the choice of which slot an imported
 * preset lands in (the first free one, or the last slot if the library is full
 * — never silently over an occupied slot the user cannot see).
 */
class PresetFormatClass {
  /**
   * Import only.
   *
   * EXPORT IS DELIBERATELY NOT REGISTERED. The registry's export contract is
   * `exportAndDownload(filename, options)` and it is reached from File > Save
   * As and the Export dialog — both of which mean "write the picture I am
   * looking at". There is no current preset for them to write: a preset is
   * addressed by SLOT, and the only place a slot is named is the manager, so
   * the manager calls downloadSlot() directly. Registering the extension here
   * would have put a filename where a slot was expected, and FileManager would
   * then have marked the artwork saved after writing nothing.
   */
  /**
   * This import files a preset into a slot; it never touches the artwork.
   * FileManager reads this to leave the document's filename and dirty flag
   * alone, and to skip the discard-unsaved-changes prompt.
   */
  importsDocument = false;

  initialize() {
    FormatRegistry.registerImport(PresetCodec.EXTENSION, this);
    Logger.info('PresetFormat', 'Initialized');
  }

  /**
   * Import a .zxpreset into the first free slot.
   * @param {ArrayBuffer} buffer
   * @returns {Promise<Object>} { success: true, slot } or { success: false, error }
   */
  async parse(buffer) {
    let text;
    try {
      text = new TextDecoder().decode(buffer);
    } catch (e) {
      return { success: false, error: 'Not a valid .zxpreset file' };
    }

    const decoded = PresetCodec.decodeFile(text);
    if (!decoded) {
      return {
        success: false,
        error: 'Not a valid .zxpreset file (unknown version or corrupt data)'
      };
    }

    const free = PresetService.firstFreeSlot();
    if (free === -1) {
      return {
        success: false,
        error: 'Every preset slot is full — free one in the preset manager first'
      };
    }

    const stored = await PresetService.fromFile(text, free);
    if (!stored) return { success: false, error: 'Preset could not be stored' };

    EventBus.emit(EVENTS.FILE_IMPORT, { format: PresetCodec.EXTENSION });
    Logger.info('PresetFormat', `Preset "${stored.name}" imported into slot ${free + 1}`);
    return { success: true, slot: free };
  }

  /**
   * Serialize one slot as file bytes.
   * @param {number} slot
   * @returns {Promise<Uint8Array|null>}
   */
  async export(slot = 0) {
    const text = await PresetService.toFile(slot);
    if (!text) return null;
    return new TextEncoder().encode(text);
  }

  /**
   * Write one slot out as a file (via the one FormatRegistry download path).
   *
   * Named for what it takes. `exportAndDownload` is the registry's own name
   * for a filename-first method, and wearing it while taking a slot first is
   * how the two got confused; this handler is not a registered exporter (see
   * initialize) and its entry point says so.
   * @param {number} slot
   * @param {string} [filename] - defaults to the preset's own name
   * @returns {Promise<boolean>}
   */
  async downloadSlot(slot, filename) {
    const preset = PresetService.get(slot);
    if (!preset) return false;

    // The name is the user's, so it may hold anything; a filename may not.
    const safe = String(preset.name || '').replace(/[^A-Za-z0-9_-]+/g, '_')
      .replace(/^_+|_+$/g, '').slice(0, 48);
    const base = filename || safe || 'preset';
    const name = base.endsWith(`.${PresetCodec.EXTENSION}`)
      ? base : `${base}.${PresetCodec.EXTENSION}`;

    const data = await this.export(slot);
    if (!data) {
      EventBus.emit(EVENTS.FILE_ERROR, { message: 'Preset could not be exported' });
      return false;
    }

    return FormatRegistry.download(data, name, 'application/json');
  }
}

window.PresetFormat = new PresetFormatClass();

Logger.debug('PresetFormat', 'Preset format handler loaded');

})(); // End IIFE
