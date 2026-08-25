'use strict';
(function() {

/**
 * Every extension File > Save.../exportViaNativePicker() offers in the
 * native dialog's "Save as type" list, with a plain-English description (OS
 * dialog chrome isn't run through PixULA's own i18n) and MIME type. Same
 * extension set EXPORT_FORMATS offers (js/ui/menu-system.js's File > Save
 * Image As submenu and its _showExportDialog() fallback) - kept as a
 * literal list rather than derived from FormatRegistry, since FormatRegistry
 * has no format-vs-picture-vs-document distinction (it would also list
 * .pixula here, which Save Project already owns) and no human-readable
 * description or MIME per extension to draw from. GIF is deliberately
 * absent - withdrawn from every export path in the app 2026-08-25 (the
 * encoder in js/io/gif-format.js stays, untouched and still tested; nothing
 * in the UI reaches it any more).
 *
 * MIME keys are synthetic (`application/x-pixula-<ext>`) rather than the
 * generic `application/octet-stream` for every format with no real
 * registered type: `showSaveFilePicker`'s `accept` key never leaves the
 * page, so it doesn't need to be a real MIME type, but Chrome's native
 * "Save as type" dropdown groups entries that share one - confirmed
 * 2026-08-24 by opening the real dialog, seventeen formats collapsed into
 * one "octet-stream" line. A distinct key per format gives each its own
 * line.
 */
const EXPORT_PICKER_TYPES = Object.freeze([
  ['scr', 'ZX Spectrum Screen', 'application/x-pixula-scr'],
  ['zxp', 'ZX-Paintbrush Image', 'text/plain'],
  ['mlt', 'Timex/Multicolor Screen 8x1', 'application/x-pixula-mlt'],
  ['ifl', 'Multicolor Screen 8x2', 'application/x-pixula-ifl'],
  ['hrg', 'Timex Hi-res Screen', 'application/x-pixula-hrg'],
  ['img', 'GigaScreen Image', 'application/x-pixula-img'],
  ['nxi', 'Next Layer 2 Image', 'application/x-pixula-nxi'],
  ['sl2', 'Next Layer 2 Dump', 'application/x-pixula-sl2'],
  ['slr', 'Next LoRes Dump', 'application/x-pixula-slr'],
  ['ctile', 'BIFROST ColorTiles', 'application/x-pixula-ctile'],
  ['tap', 'ZX Spectrum Tape', 'application/x-pixula-tap'],
  ['tzx', 'ZX Spectrum Tape TZX', 'application/x-pixula-tzx'],
  ['png', 'PNG Image', 'image/png'],
  ['bmp', 'BMP Image', 'image/bmp'],
  ['jpg', 'JPEG Image', 'image/jpeg'],
  ['zed', 'ZX-Editor Document', 'application/x-pixula-zed'],
  ['sev', 'SevenuP Graphic', 'application/x-pixula-sev'],
  ['pal', 'Palette', 'application/x-pixula-pal'],
  ['npl', 'Next Palette', 'application/x-pixula-npl'],
  ['asm', 'Assembly Source', 'text/plain'],
  ['c', 'C Array Source', 'text/plain'],
  ['bin', 'Raw Bitmap Only', 'application/x-pixula-bin'],
  ['atr', 'Attributes Only', 'application/x-pixula-atr']
]);

/**
 * File Manager
 *
 * Unified interface for file operations:
 * - New file
 * - Open file (auto-detect format)
 * - Save/Save As
 * - Export to various formats
 * - Unsaved changes tracking
 */
class FileManagerClass {
  constructor() {
    this.currentFilename = null;
    this.hasUnsavedChanges = false;
    // The handle from the last successful native Save/Save As - lets a
    // repeat Ctrl+S write straight back to it with NO dialog at all, the
    // same way any desktop app's Save behaves after the first Save As.
    // Session-only: never persisted, so a reload always asks once again.
    this._fileHandle = null;
    this._boundHandlers = {};
  }

  /**
   * Initialize file manager
   */
  initialize() {
    // Initialize format handlers
    FormatRegistry.initialize();
    SCRFormat.initialize();
    MulticolorFormat.initialize();
    TimexFormat.initialize();
    GigascreenFormat.initialize();
    CtileFormat.initialize();
    PNGFormat.initialize();
    JPGFormat.initialize();
    BMPFormat.initialize();
    GIFFormat.initialize();
    ZEDFormat.initialize();
    SEVFormat.initialize();
    TAPFormat.initialize();
    SNAFormat.initialize();
    TZXFormat.initialize();
    DevFormat.initialize();
    MapFormat.initialize();
    ZXMFormat.initialize();
    FontFormat.initialize();
    NXIFormat.initialize();
    NextPaletteFormat.initialize();
    SpriteFormat.initialize();
    PresetFormat.initialize();

    // Track canvas modifications
    this._boundHandlers.onModified = this._onCanvasModified.bind(this);
    EventBus.on(EVENTS.CANVAS_DIRTY, this._boundHandlers.onModified);
    EventBus.on(EVENTS.PIXEL_BATCH_END, this._boundHandlers.onModified);

    // Handle keyboard shortcuts
    EventBus.on(EVENTS.SHORTCUT_NEW, () => this.newFile());
    EventBus.on(EVENTS.SHORTCUT_OPEN, () => this.openFile());
    EventBus.on(EVENTS.SHORTCUT_SAVE, () => this.save());

    this._initSystemPaste();

    Logger.info('FileManager', 'Initialized');
  }

  // ── System clipboard paste (Phase 7 QW1) ──────────────────────────────────

  /**
   * Listen for native 'paste' events on the app window AND the canvas
   * iframe's window (keyboard focus usually lives there). The paste event
   * carries the clipboard payload with no permission prompt — it works on
   * file:// — but only fires for a real user paste gesture that was not
   * default-prevented, so InputHandler deliberately lets Ctrl+V fall
   * through when the internal clipboard is empty.
   * @private
   */
  _initSystemPaste() {
    const onPaste = (e) => {
      // Text fields keep their normal paste behaviour
      if (e.target && e.target.closest &&
          e.target.closest('input, textarea, [contenteditable="true"]')) return;
      // Internal clipboard wins (InputHandler normally intercepts Ctrl+V
      // before this fires; this guard covers e.g. the browser's Edit menu)
      if (SelectionService.hasClipboard()) return;

      const items = e.clipboardData && e.clipboardData.items;
      if (!items) return;
      for (const item of items) {
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          e.preventDefault();
          this._importImageBlobAsStamp(item.getAsFile());
          return;
        }
      }
    };

    window.addEventListener('paste', onPaste);
    CanvasSystem.onReady(() => {
      const doc = CanvasSystem.getIframeDocument();
      if (doc && doc.defaultView) doc.defaultView.addEventListener('paste', onPaste);
    });
  }

  /**
   * Async system-clipboard read for pastes with no keyboard gesture
   * (menu Edit>Paste, context menu). Feature-detected: requires
   * navigator.clipboard.read(), which prompts for the clipboard-read
   * permission — on file:// some browsers deny it outright, which lands
   * in the catch below; the Ctrl+V paste-event path is the reliable one.
   * @returns {Promise<boolean>} True if an image was pasted
   */
  async pasteFromSystemClipboard() {
    if (!navigator.clipboard || typeof navigator.clipboard.read !== 'function') {
      Logger.warn('FileManager', 'navigator.clipboard.read not available');
      return false;
    }
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const imageType = item.types.find(t => t.startsWith('image/'));
        if (imageType) {
          const blob = await item.getType(imageType);
          await this._importImageBlobAsStamp(blob);
          return true;
        }
      }
      Logger.info('FileManager', 'No image on the system clipboard');
    } catch (error) {
      // Permission denied (common on file://) or empty/unreadable clipboard
      Logger.warn('FileManager', `System clipboard read failed: ${error.message}`);
    }
    return false;
  }

  /**
   * Decode an image blob, quantize it through the PNG import engine, and
   * hand it to the floating-stamp paste flow the internal clipboard uses.
   * @param {Blob} blob
   * @private
   */
  async _importImageBlobAsStamp(blob) {
    if (!blob) return;
    const result = await PNGFormat.blobToInkMask(blob);
    if (!result || !result.width || !result.height) {
      EventBus.emit(EVENTS.FILE_ERROR, {
        message: this._t('msg.pasteFailed', 'Could not read an image from the clipboard.')
      });
      return;
    }

    const sel = SelectionService.hasSelection() ? SelectionService.getSelection() : null;
    SelectionService.startFloatingPasteFromMask(
      result.mask, result.width, result.height,
      sel ? sel.x : 0, sel ? sel.y : 0, 'Paste'
    );
    SelectionService.clear();
    CanvasSystem.requestRender();
    Logger.info('FileManager', `System clipboard image pasted (${result.width}x${result.height})`);
  }

  /**
   * Translate a key with a fallback for the phases before I18n is ported.
   * @param {string} key - i18n key
   * @param {string} fallback - English fallback text
   * @param {Object} [params] - Interpolation params
   * @returns {string}
   * @private
   */
  _t(key, fallback, params) {
    return window.I18n ? I18n.t(key, params) : fallback;
  }

  /**
   * Create a new file
   * @returns {Promise<boolean>} True if new file created
   */
  async newFile() {
    if (this.hasUnsavedChanges) {
      const confirmed = await this._confirmDiscard();
      if (!confirmed) return false;
    }

    // New always produces a blank canvas with no further prompts, mirroring a
    // fresh page reload — Paper White, Ink Black. WHITE_PAPER is the
    // conventional non-bright white background.
    const WHITE_PAPER = 7;

    // Switch to the artist's preferred default screen mode (Preferences >
    // New document screen type) FIRST, so every reset step below builds at
    // the right geometry. applyModeRaw is the conversion-free restore path —
    // correct here since a blank canvas has no content to preserve.
    if (window.ScreenModeService && window.StateManager) {
      const defaultMode = StateManager.get('defaultScreenMode');
      if (defaultMode) ScreenModeService.applyModeRaw(defaultMode);
    }

    // Reset layers
    LayerManager.reset();

    // Clear attribute system
    AttributeSystem.clearAll();

    // Reset colors to defaults (black ink, white paper).
    if (window.ColorManager) {
      ColorManager.reset();
    }

    // Apply the white background to the document (also syncs the ink/paper selection
    // and recomposes the canvas).
    LayerManager.setBackgroundColor(WHITE_PAPER);

    // Repaint immediately — do not wait for the next user interaction.
    if (window.CanvasSystem) {
      CanvasSystem.markAllDirty();
    }

    // Reset file state
    this.currentFilename = null;
    this.hasUnsavedChanges = false;
    this._fileHandle = null;

    EventBus.emit(EVENTS.FILE_NEW);
    // Refresh the layer panel and any order-dependent UI (the reset rebuilt the stack).
    EventBus.emit(EVENTS.LAYER_ORDER);
    Logger.info('FileManager', 'New file created (Paper White, Ink Black)');

    return true;
  }

  /**
   * Open a file (auto-detect format)
   * @returns {Promise<boolean>} True if file opened successfully
   */
  async openFile() {
    // The discard guard lives in loadFile, not here: it belongs at the point
    // the document is actually overwritten, which is the one place that knows
    // WHICH file was chosen — and so the one place that can tell an artwork
    // from an import that leaves the artwork alone (a .zxpreset).
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = FormatRegistry.getImportAcceptString();

    return new Promise((resolve) => {
      input.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) {
          resolve(false);
          return;
        }

        const success = await this.loadFile(file);
        resolve(success);
      });

      // Handle cancel
      input.addEventListener('cancel', () => resolve(false));

      input.click();
    });
  }

  /**
   * Open a file, but only accept .pixula project files — File > Load
   * Project..., picked out from the universal Load (openFile) for the
   * artist who specifically wants their own project files, not any
   * importable format. `accept` restricts the OS picker; the extension
   * check below covers a picker that lets the filter be overridden.
   * @returns {Promise<boolean>} True if the project loaded successfully
   */
  async loadProjectFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pixula';

    return new Promise((resolve) => {
      input.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) {
          resolve(false);
          return;
        }
        if (FormatRegistry.getExtension(file.name) !== 'pixula') {
          Logger.error('FileManager', `Not a project file: ${file.name}`);
          EventBus.emit(EVENTS.FILE_ERROR, { message: 'That is not a .pixula project file.' });
          resolve(false);
          return;
        }

        const success = await this.loadFile(file);
        resolve(success);
      });

      input.addEventListener('cancel', () => resolve(false));

      input.click();
    });
  }

  /**
   * Load a file
   *
   * Not every registered import replaces the artwork. A handler declaring
   * `importsDocument = false` (the .zxpreset one) files its contents somewhere
   * of its own, so opening it must neither ask to discard unsaved changes nor
   * afterwards claim to BE the open document — that combination silently
   * cleared the dirty flag and pointed Save at a filename that could not hold
   * a picture.
   * @param {File} file - File to load
   * @returns {Promise<boolean>} True if loaded successfully
   */
  async loadFile(file) {
    const extension = FormatRegistry.getExtension(file.name);
    const handler = FormatRegistry.getImportHandler(extension);

    if (!handler) {
      Logger.error('FileManager', `Unsupported format: .${extension}`);
      EventBus.emit(EVENTS.FILE_ERROR, { message: `Unsupported file format: .${extension}` });
      return false;
    }

    const replacesDocument = handler.importsDocument !== false;

    if (replacesDocument && this.hasUnsavedChanges) {
      const confirmed = await this._confirmDiscard();
      if (!confirmed) return false;
    }

    try {
      const buffer = await file.arrayBuffer();

      // PNG/JPG/GIF imports go through the conversion dialog first (Phase 8):
      // live quantized preview + brightness/contrast/scaling/dither options.
      // Cancel aborts the import; OK passes the options to the same parse().
      let parseOptions = {};
      if (window.ImportDialog && ['png', 'jpg', 'jpeg', 'gif'].includes(extension)) {
        parseOptions = await ImportDialog.show(buffer, extension);
        if (parseOptions === null) {
          Logger.info('FileManager', 'Import cancelled in the conversion dialog');
          return false;
        }
      }

      const result = await handler.parse(buffer, parseOptions);

      if (!result.success) {
        Logger.error('FileManager', result.error);
        EventBus.emit(EVENTS.FILE_ERROR, { message: result.error });
        return false;
      }

      if (!replacesDocument) {
        // Nothing about the artwork changed, so nothing about its file state
        // may change either. The handler announced its own import.
        Logger.info('FileManager', `Imported (not the document): ${file.name}`);
        return true;
      }

      this.currentFilename = file.name;
      this.hasUnsavedChanges = false;
      // The open picker (a plain <input type=file>) gives a File, never a
      // handle - a stale handle from a PREVIOUS save must not silently
      // catch this newly-opened document's next Ctrl+S and overwrite the
      // wrong file on disk.
      this._fileHandle = null;

      this._addToRecent(file.name);
      EventBus.emit(EVENTS.FILE_OPEN, { filename: file.name });
      Logger.info('FileManager', `Opened: ${file.name}`);

      return true;
    } catch (error) {
      Logger.error('FileManager', `Load failed: ${error.message}`);
      EventBus.emit(EVENTS.FILE_ERROR, { message: `Failed to load file: ${error.message}` });
      return false;
    }
  }

  /**
   * Save current file (or Save As if no current file) - silent when a
   * handle is already open (repeat Ctrl+S), matching any desktop app.
   * @returns {Promise<boolean>} True if saved successfully
   */
  async save() {
    if (this._fileHandle) {
      return this._writeProjectToHandle(this._fileHandle);
    }
    if (!this.currentFilename) {
      return this.saveAs();
    }
    return this.saveToFile(this.currentFilename);
  }

  /**
   * Save As - a real native Save dialog, not a hand-rolled one.
   *
   * `showSaveFilePicker()` IS the artist's consent (a native OS dialog they
   * drove themselves), so this needs no separate permission step - and
   * unlike the old flow, it asks exactly once: `SaveDialog` used to prompt
   * for a filename and then `FormatRegistry.download()` would ALSO open a
   * native picker for the same information, which is why this bypasses
   * both and writes straight to the handle the artist just chose.
   *
   * Default to `.pixula`, the only format that keeps the document. It was
   * `image.scr`, which is 6,912 bytes of one composited screen - so
   * accepting the default on a 32-layer picture silently discarded 31 of
   * them. The artist can still retype a different extension in the native
   * dialog - that lands on `saveToFile()`'s existing ext-aware path (still
   * a native picker inside `FormatRegistry.download()`, just one more step
   * for the rare case, rather than complicating the common one).
   * @returns {Promise<boolean>} True if saved successfully
   */
  async saveAs() {
    const defaultName = this.currentFilename || 'image.pixula';

    if (typeof window.showSaveFilePicker !== 'function') {
      return this._saveAsLegacy(defaultName);
    }

    let handle;
    try {
      handle = await window.showSaveFilePicker({
        suggestedName: defaultName,
        types: [{ description: 'PixULA Project', accept: { 'application/gzip': ['.pixula'] } }]
      });
    } catch (error) {
      if (error && error.name === 'AbortError') return false;
      Logger.warn('FileManager', 'showSaveFilePicker failed; falling back', error);
      return this._saveAsLegacy(defaultName);
    }

    if (FormatRegistry.getExtension(handle.name) !== 'pixula') {
      return this.saveToFile(handle.name);
    }
    return this._writeProjectToHandle(handle);
  }

  /**
   * The pre-File-System-Access-API path: a text-field dialog for the name,
   * then `saveToFile()`'s existing download route. Only reached when
   * `showSaveFilePicker` is unavailable (Firefox, Safari) or itself failed
   * for a reason other than the artist cancelling.
   * @private
   */
  async _saveAsLegacy(defaultName) {
    const filename = await SaveDialog.show(defaultName);
    if (!filename) return false;
    return this.saveToFile(filename);
  }

  /**
   * Write the live document straight to an already-chosen handle - the
   * fast path for both a fresh `.pixula` Save As and every repeat Ctrl+S
   * after it. No dialog, no `FormatRegistry.download()` detour (that owns
   * its OWN native-picker call, which would be a second, redundant prompt
   * here).
   * @private
   */
  async _writeProjectToHandle(handle) {
    try {
      const bytes = await ProjectFormat.export();
      const writable = await handle.createWritable();
      await writable.write(bytes instanceof Blob ? bytes : new Blob([bytes]));
      await writable.close();

      this._fileHandle = handle;
      this.currentFilename = handle.name;
      this.hasUnsavedChanges = false;
      this._addToRecent(handle.name);
      EventBus.emit(EVENTS.FILE_SAVE, { filename: handle.name });
      Logger.info('FileManager', `Saved: ${handle.name}`);
      return true;
    } catch (error) {
      Logger.error('FileManager', `Save failed: ${error.message}`);
      EventBus.emit(EVENTS.FILE_ERROR, { message: `Failed to save: ${error.message}` });
      return false;
    }
  }

  /**
   * Save to specific filename
   *
   * A handler that returns an explicit `false` REFUSED the save, and the
   * document must stay dirty: clearing the flag after writing nothing loses
   * the work silently, taking the beforeunload warning with it. Handlers that
   * return nothing (most of them) succeeded or threw.
   * @param {string} filename - Target filename
   * @returns {Promise<boolean>} True if saved successfully
   */
  async saveToFile(filename) {
    const extension = FormatRegistry.getExtension(filename);

    if (!extension) {
      // Default to SCR if no extension
      filename += '.scr';
    }

    const ext = FormatRegistry.getExtension(filename);
    const handler = FormatRegistry.getExportHandler(ext);

    if (!handler) {
      Logger.error('FileManager', `Unsupported export format: .${ext}`);
      EventBus.emit(EVENTS.FILE_ERROR, { message: `Cannot save as .${ext}` });
      return false;
    }

    try {
      const written = await handler.exportAndDownload(filename);
      if (written === false) {
        Logger.error('FileManager', `Handler refused to save: ${filename}`);
        return false;
      }

      this.currentFilename = filename;
      this.hasUnsavedChanges = false;
      // This path has no live handle to reuse (a blob download, or a
      // format-specific adapter that opened its own picker) - a stale
      // handle from an EARLIER .pixula save must not catch this file's
      // next Ctrl+S.
      this._fileHandle = null;

      this._addToRecent(filename);
      EventBus.emit(EVENTS.FILE_SAVE, { filename });
      Logger.info('FileManager', `Saved: ${filename}`);

      return true;
    } catch (error) {
      Logger.error('FileManager', `Save failed: ${error.message}`);
      EventBus.emit(EVENTS.FILE_ERROR, { message: `Failed to save: ${error.message}` });
      return false;
    }
  }

  /**
   * Add a filename to the recent files list (max 10 entries, newest first).
   * @param {string} filename
   * @private
   */
  async _addToRecent(filename) {
    try {
      const MAX = 10;
      const records = await Storage.getAll(Storage.STORES.RECENT_FILES) || [];
      // Remove duplicates, prepend new entry
      const filtered = records.filter(r => r.filename !== filename);
      filtered.unshift({ filename, timestamp: Date.now(), id: filename });
      if (filtered.length > MAX) filtered.length = MAX;
      // Overwrite the whole list
      await Storage.clear(Storage.STORES.RECENT_FILES);
      for (const entry of filtered) {
        await Storage.set(entry.filename, entry, Storage.STORES.RECENT_FILES);
      }
    } catch (e) {
      // Non-fatal — recent files is a convenience feature
    }
  }

  /**
   * Get recent files list (newest first).
   * @returns {Promise<Array<{filename: string, timestamp: number}>>}
   */
  async getRecentFiles() {
    try {
      const records = await Storage.getAll(Storage.STORES.RECENT_FILES) || [];
      return records.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    } catch (e) {
      return [];
    }
  }

  /**
   * Open a file, using filename as a hint (shown in a confirm before opening the picker).
   * The browser File API requires user gesture; we cannot re-open by path programmatically.
   * @param {string} filename
   */
  async openFileByName(filename) {
    const msg = this._t('msg.confirmReopen', `Re-open "${filename}"? The file picker will ask you to select it.`, { name: filename });
    if (!confirm(msg)) return;
    await this.openFile();
  }

  /**
   * Export to specific format
   * @param {string} format - Target format extension
   * @param {Object} options - Export options
   * @returns {boolean} True if exported successfully
   */
  async exportAs(format, options = {}) {
    const handler = FormatRegistry.getExportHandler(format);

    if (!handler) {
      Logger.error('FileManager', `Unsupported export format: .${format}`);
      return false;
    }

    const baseName = this.currentFilename
      ? this.currentFilename.replace(/\.[^.]+$/, '')
      : 'image';

    const filename = `${baseName}.${format}`;

    try {
      const written = await handler.exportAndDownload(filename, options);
      return written !== false;
    } catch (error) {
      Logger.error('FileManager', `Export failed: ${error.message}`);
      EventBus.emit(EVENTS.FILE_ERROR, { message: error.message });
      return false;
    }
  }

  /**
   * File > Save... - a real native Save dialog whose "Save as type" list IS
   * the format picker, so the artist chooses format and location in ONE
   * dialog instead of a hand-rolled dropdown followed by a browser download
   * with no location choice at all. This was the actual complaint behind
   * this method's existence (2026-08-24): a menu item literally labelled
   * "Save..." was internally an "export" action wearing that label, and
   * opened the old format-then-download flow regardless.
   *
   * File > Save Image As (one menu leaf per format, straight into
   * FileManager.exportAs()) is the OTHER way to reach the same native
   * picker/download-fallback pair, for an artist who wants to name the
   * format up front instead of choosing it inside the OS dialog. Between the
   * two, every format and every export path in the app goes through the
   * system's own save mechanism - no in-app export dialog remains
   * (2026-08-25; "Export with Options..." and its GIF-animation/TAP-border
   * per-format extras are gone, not just this method's problem to route
   * around any more).
   *
   * Callable only where `window.showSaveFilePicker` exists - the io layer
   * has no business opening `MenuSystem`'s format-select dialog itself, so
   * that fallback decision belongs to the menu action that dispatches here
   * (see `_executeAction` in menu-system.js), not to this method.
   * @returns {Promise<boolean>}
   */
  async exportViaNativePicker() {
    const baseName = this.currentFilename
      ? this.currentFilename.replace(/\.[^.]+$/, '')
      : 'image';

    // Offer only formats the ACTIVE screen mode can actually export (e.g.
    // a GigaScreen document has no .scr, an indexed Next mode has no .tap)
    // — showSaveFilePicker can't disable a type, only omit it, so filtering
    // here is the only way to keep the artist from picking a format that
    // would just throw a save-failed error a moment later.
    const compatibleTypes = EXPORT_PICKER_TYPES.filter(([ext]) =>
      FormatRegistry.isExportCompatible(ext));
    const defaultExt = compatibleTypes.length ? compatibleTypes[0][0] : 'scr';

    let handle;
    try {
      handle = await window.showSaveFilePicker({
        suggestedName: `${baseName}.${defaultExt}`,
        types: compatibleTypes.map(([ext, description, mime]) =>
          ({ description, accept: { [mime]: [`.${ext}`] } }))
      });
    } catch (error) {
      if (error && error.name === 'AbortError') return false;
      Logger.error('FileManager', `Save picker failed: ${error.message}`);
      EventBus.emit(EVENTS.FILE_ERROR, { message: `Failed to save: ${error.message}` });
      return false;
    }

    const ext = FormatRegistry.getExtension(handle.name);
    const handler = FormatRegistry.getExportHandler(ext);
    if (!handler) {
      Logger.error('FileManager', `Unsupported export format: .${ext}`);
      EventBus.emit(EVENTS.FILE_ERROR, { message: `Cannot save as .${ext}` });
      return false;
    }

    try {
      // Passing `handle` through is what stops exportAndDownload() (and the
      // FormatRegistry.download() it calls) opening a SECOND native picker
      // for the same information - it writes straight to the location
      // already chosen above.
      const written = await handler.exportAndDownload(handle.name, {}, handle);
      return written !== false;
    } catch (error) {
      Logger.error('FileManager', `Export failed: ${error.message}`);
      EventBus.emit(EVENTS.FILE_ERROR, { message: error.message });
      return false;
    }
  }

  /**
   * Check if there are unsaved changes
   * @returns {boolean}
   */
  hasChanges() {
    return this.hasUnsavedChanges;
  }

  /**
   * Get current filename
   * @returns {string|null}
   */
  getFilename() {
    return this.currentFilename;
  }

  /**
   * Mark document as modified
   */
  markModified() {
    this.hasUnsavedChanges = true;
  }

  /**
   * Mark document as saved (no modifications)
   */
  markSaved() {
    this.hasUnsavedChanges = false;
  }

  /**
   * Handle canvas modification event
   * @private
   */
  _onCanvasModified() {
    this.hasUnsavedChanges = true;
  }

  /**
   * Confirm discarding unsaved changes
   * @returns {Promise<boolean>} True if user confirms
   * @private
   */
  async _confirmDiscard() {
    return confirm(this._t('msg.confirmDiscard', 'You have unsaved changes. Discard them?'));
  }
}

// Create singleton
window.FileManager = new FileManagerClass();

Logger.debug('FileManager', 'File manager loaded');

})(); // End IIFE
