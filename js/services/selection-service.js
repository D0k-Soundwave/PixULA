'use strict';
(function() {

/**
 * Selection Service
 *
 * Manages rectangular selections on the canvas.
 * Supports copy, cut, paste, and delete operations.
 */

class SelectionServiceClass {
  constructor() {
    this.selection = null;
    this.clipboard = null;
    this.floatingPaste = null; // { pixels, width, height, x, y, colorSelection, floatingLayer }
    this._stampCounter = 0;
    // Stamp options — shared across all stamp interactions
    this.stampEraseMode = false;   // when true, left-click erases instead of stamps

    // XOR is a once-per-STROKE toggle, not once-per-call. Dragging a stamp
    // rubber-stamps stampAt() on every pointer move (input-handler), and where
    // consecutive positions overlap a pixel would be toggled twice and cancel —
    // the drag would erase its own trail. This set remembers which pixels the
    // current stamp DRAG has already XOR-toggled so each flips exactly once.
    // The stamp drag is one PixelDrawRoutine batch, so the batch boundary is
    // the stroke boundary: cleared whenever a batch opens.
    this._xorStampToggled = new Set();
    EventBus.on(EVENTS.PIXEL_BATCH_START, () => this._xorStampToggled.clear());

    // If the stamp layer is removed by ANY path (user delete, undo, etc.) and
    // it matches our live floatingPaste, drop the dangling reference.  The
    // snapshot-based UndoRedo handles all transform/paste history globally —
    // there is no longer a per-stamp local undo stack.
    EventBus.on(EVENTS.LAYER_DELETED, (data) => {
      if (this.floatingPaste &&
          this.floatingPaste.floatingLayer &&
          this.floatingPaste.floatingLayer.id === data.layerId) {
        this.floatingPaste = null;
      }
    });

    // Live colour updates: when the user changes ink / paper / bright / flash
    // while a stamp preview is engaged, refresh the floating layer in place so
    // what the user sees matches what will be committed.
    const refreshColor = (sel) => this.refreshStampColor(sel);
    EventBus.on(EVENTS.COLOR_INK,    refreshColor);
    EventBus.on(EVENTS.COLOR_PAPER,  refreshColor);
    EventBus.on(EVENTS.COLOR_BRIGHT, refreshColor);
    EventBus.on(EVENTS.COLOR_FLASH,  refreshColor);
  }

  /**
   * Update the active floating stamp's colour selection and redraw.
   * No-op when no stamp is engaged.
   * @param {Object} [sel] - colorSelection from the COLOR_* event (falls back to ColorManager)
   */
  refreshStampColor(sel) {
    const fp = this.floatingPaste;
    if (!fp) return;
    const next = sel && typeof sel === 'object'
      ? sel
      : (window.ColorManager ? ColorManager.getCurrentSelection() : null);
    if (!next) return;
    fp.colorSelection = { ...next };
    fp.floatingLayer.clear();
    LayerManager.composeToCanvas();
    this._drawFloatingLayer();
    LayerManager.flushPendingCompose();
    CanvasSystem.requestRender();
    EventBus.emit(EVENTS.CANVAS_RENDER);
  }

  /**
   * Capture the live floating paste state for an undo snapshot.
   * Returns null when no floating paste is active.
   *
   * Serialises the COMPLETE floating-paste object (every transform-source and
   * mode field), not just the visible mask. The floating layer itself is stored
   * by id and re-linked on restore. The mask (`pixels`) plus these fields are the
   * single source of truth — the floating layer's cells are a derived preview
   * that `restoreFloatingState` rebuilds, so they are never relied upon here.
   */
  captureFloatingState() {
    if (!this.floatingPaste) return null;
    const fp = this.floatingPaste;
    return {
      pixels: fp.pixels ? fp.pixels.map(r => [...r]) : null,
      width: fp.width,
      height: fp.height,
      x: fp.x,
      y: fp.y,
      colorSelection: { ...fp.colorSelection },
      layerId: fp.floatingLayer ? fp.floatingLayer.id : null,
      // Transform source + mode — required so transforms/scale/rotate and brush
      // mode survive an undo/redo round-trip.
      _srcPixels:  fp._srcPixels ? fp._srcPixels.map(r => [...r]) : null,
      _srcWidth:   fp._srcWidth,
      _srcHeight:  fp._srcHeight,
      _scaleX:     fp._scaleX,
      _scaleY:     fp._scaleY,
      _rotation:   fp._rotation,
      _warpEffect: fp._warpEffect,
      _isBrushStamp: fp._isBrushStamp,
      fontInfo:    fp.fontInfo ? { ...fp.fontInfo } : null,
      // Indexed-mode stamps (Phase 13): per-pixel palette indices
      indices:     fp.indices ? fp.indices.map(r => [...r]) : null,
      _srcIndices: fp._srcIndices ? fp._srcIndices.map(r => [...r]) : null
    };
  }

  /**
   * Restore floating paste state from an undo snapshot.
   * If `state` is null, clears any active floating paste.
   * If the referenced stamp layer no longer exists (e.g. snapshot is stale),
   * clears floating paste rather than holding a stale layer reference.
   *
   * Restores ALL floating-paste fields, then REBUILDS the floating layer's
   * preview from the mask (clear + recompose + redraw) rather than trusting
   * whatever cells `restoreAllLayersState` recreated. This makes the mask the
   * single source of truth and eliminates the frozen/stale preview pixels that
   * used to survive an undo/redo.
   */
  restoreFloatingState(state) {
    if (!state) {
      this.floatingPaste = null;
      return;
    }
    const layer = state.layerId != null ? LayerManager.getLayerById(state.layerId) : null;
    if (!layer) {
      this.floatingPaste = null;
      return;
    }
    this.floatingPaste = {
      pixels: state.pixels ? state.pixels.map(r => [...r]) : null,
      width: state.width,
      height: state.height,
      x: state.x,
      y: state.y,
      colorSelection: state.colorSelection,
      floatingLayer: layer,
      // Re-link transform source + mode, with sane fallbacks for older snapshots.
      _srcPixels:  state._srcPixels ? state._srcPixels.map(r => [...r])
                                    : (state.pixels ? state.pixels.map(r => [...r]) : null),
      _srcWidth:   state._srcWidth  != null ? state._srcWidth  : state.width,
      _srcHeight:  state._srcHeight != null ? state._srcHeight : state.height,
      _scaleX:     state._scaleX    != null ? state._scaleX    : 1,
      _scaleY:     state._scaleY    != null ? state._scaleY    : 1,
      _rotation:   state._rotation || 0,
      _warpEffect: state._warpEffect || 'none',
      _isBrushStamp: state._isBrushStamp,
      fontInfo:    state.fontInfo ? { ...state.fontInfo } : null,
      indices:     state.indices ? state.indices.map(r => [...r]) : null,
      _srcIndices: state._srcIndices ? state._srcIndices.map(r => [...r]) : null
    };

    // Rebuild the derived preview from the mask. restoreAllLayersState may have
    // recreated the stamp layer with stale preview cells; clear them and redraw
    // from fp.pixels so what's on screen always matches the authoritative mask.
    if (layer.isStamp) {
      layer.clear();
      LayerManager.composeToCanvas();
      this._drawFloatingLayer();
      LayerManager.flushPendingCompose();
    }
  }

  /**
   * Set the current selection rectangle
   * @param {Object|null} rect - { x, y, width, height } in pixel coordinates, or null to clear
   */
  setSelection(rect) {
    if (rect) {
      this.selection = {
        x: Helpers.clamp(rect.x, 0, ZX_SPECTRUM.WIDTH - 1),
        y: Helpers.clamp(rect.y, 0, ZX_SPECTRUM.HEIGHT - 1),
        width: Math.max(1, rect.width),
        height: Math.max(1, rect.height),
        mask: rect.mask || null
      };

      // Clamp to canvas bounds
      if (this.selection.x + this.selection.width > ZX_SPECTRUM.WIDTH) {
        this.selection.width = ZX_SPECTRUM.WIDTH - this.selection.x;
      }
      if (this.selection.y + this.selection.height > ZX_SPECTRUM.HEIGHT) {
        this.selection.height = ZX_SPECTRUM.HEIGHT - this.selection.y;
      }

      // Ensure minimum 1x1 size after clamping
      if (this.selection.width < 1) this.selection.width = 1;
      if (this.selection.height < 1) this.selection.height = 1;
    } else {
      this.selection = null;
    }

    StateManager.setSection('selection', {
      active: !!this.selection,
      x: this.selection?.x || 0,
      y: this.selection?.y || 0,
      width: this.selection?.width || 0,
      height: this.selection?.height || 0
    });

    // Trigger overlay re-render for marching ants
    EventBus.emit(EVENTS.CANVAS_RENDER);
  }

  /**
   * Get the current selection
   * @returns {Object|null} Selection rectangle or null
   */
  getSelection() {
    return this.selection;
  }

  /**
   * Check if there is an active selection
   * @returns {boolean}
   */
  hasSelection() {
    return this.selection !== null;
  }

  /**
   * Clear the current selection
   */
  clear() {
    this.selection = null;
    StateManager.set('selection.active', false);
    // Trigger overlay re-render to clear marching ants
    EventBus.emit(EVENTS.CANVAS_RENDER);
  }

  /**
   * Copy the selection to clipboard
   */
  copyToClipboard() {
    if (!this.selection) return;

    const layer = LayerManager.getCurrentLayer();
    if (!layer) return;

    const { x, y, width, height, mask } = this.selection;

    this.clipboard = {
      width,
      height,
      pixels: [],
      cells: [],
      // Where this was copied FROM. A separate Paste action can run an
      // arbitrary amount later — a right-click Copy, then a right-click
      // Paste, is two independent context-menu opens — and the selection
      // that was active at copy time is not guaranteed to still be there
      // (deselected by an unrelated click, another tool, etc). Every paste
      // call site falls back to THIS rather than to a live selection or a
      // hardcoded (0,0), so a paste can never land somewhere the artist
      // cannot see: it always reappears where it was copied from.
      originX: x,
      originY: y
    };

    // Indexed modes (Phase 13): also capture the per-pixel palette indices
    // (−1 = transparent/excluded) so paste and floating stamps reproduce
    // colours exactly; the boolean mask below stays derived for every
    // mask-based consumer.
    const indexed = ZX_SPECTRUM.PIXEL_DEPTH > 1;
    if (indexed) this.clipboard.indices = [];

    // Copy pixel states — mask-excluded pixels are treated as paper (false)
    for (let py = 0; py < height; py++) {
      const row = [];
      const idxRow = indexed ? [] : null;
      for (let px = 0; px < width; px++) {
        if (mask && !mask[py][px]) {
          row.push(false);
          if (idxRow) idxRow.push(-1);
          continue;
        }
        const pixelX = x + px;
        const pixelY = y + py;
        if (Validators.isValidPixelCoord(pixelX, pixelY)) {
          row.push(layer.getPixelState(pixelX, pixelY));
          if (idxRow) idxRow.push(layer.getPixelIndex(pixelX, pixelY));
        } else {
          row.push(false);
          if (idxRow) idxRow.push(-1);
        }
      }
      this.clipboard.pixels.push(row);
      if (idxRow) this.clipboard.indices.push(idxRow);
    }

    // Copy affected cells with their full data
    const startCell = ZX_COORDS.pixelToCell(x, y);
    const endCell   = ZX_COORDS.pixelToCell(x + width - 1, y + height - 1);

    for (let cy = startCell.y; cy <= endCell.y; cy++) {
      for (let cx = startCell.x; cx <= endCell.x; cx++) {
        const cell = layer.getCell(cx, cy);
        if (cell) {
          this.clipboard.cells.push({
            relX: cx - startCell.x,
            relY: cy - startCell.y,
            data: {
              ink: cell.ink,
              paper: cell.paper,
              bright: cell.bright,
              flash: cell.flash,
              pixels: new Uint8Array(cell.pixels)
            }
          });
        }
      }
    }

    Logger.debug('SelectionService', `Copied ${width}x${height} selection`);
    this._persistClipboard();
  }

  /**
   * Persist the clipboard to Storage (fire-and-forget) so it survives a
   * reload — the ZXP-equivalent persistent clipboard. Cut goes through
   * copyToClipboard(), so both paths land here.
   * @private
   */
  _persistClipboard() {
    if (!window.ClipboardCodec || !window.Storage || !this.clipboard) return;
    const payload = ClipboardCodec.encode(this.clipboard);
    if (!payload) return;
    Promise.resolve(Storage.set('clipboard', payload, Storage.STORES.CLIPBOARD))
      .catch((e) => Logger.warn('SelectionService', `Clipboard persist failed: ${e.message}`));
  }

  /**
   * Restore the persisted clipboard at boot. Announces a render so the
   * Edit menu's paste enable-state is correct from the first frame.
   * @returns {Promise<boolean>} True if a clipboard was restored
   */
  async restorePersistedClipboard() {
    if (!window.ClipboardCodec || !window.Storage) return false;
    try {
      const payload = await Storage.get('clipboard', Storage.STORES.CLIPBOARD);
      if (!payload) return false;
      const decoded = ClipboardCodec.decode(payload);
      if (!decoded) return false;
      this.clipboard = decoded;
      Logger.info('SelectionService',
        `Restored ${decoded.width}x${decoded.height} clipboard from storage`);
      EventBus.emit(EVENTS.CANVAS_RENDER);
      return true;
    } catch (e) {
      Logger.warn('SelectionService', `Clipboard restore failed: ${e.message}`);
      return false;
    }
  }

  /**
   * Copy or cut the current selection into an immediately-usable floating
   * stamp. Cut and Copy are otherwise the SAME operation -- copy to
   * clipboard, drop a movable stamp back where the selection was, deselect
   * -- differing only in whether the source pixels are erased first. Every
   * entry point (the canvas context menu, Ctrl+C/Ctrl+X, the Edit menu) goes
   * through this single method so the two can never drift out of step with
   * each other again the way three separately hand-written copies of this
   * sequence once did (Copy's copy lacked the startFloatingPaste/clear steps
   * entirely, so it never produced anything to paste from).
   * @param {boolean} erase - true for Cut: erase the source after copying
   * @returns {boolean} true if a stamp was created
   */
  copyOrCut(erase) {
    if (!this.selection) return false;
    const sel = this.selection;
    this.copyToClipboard();
    if (erase) this.deleteSelection();
    this.startFloatingPaste(sel.x, sel.y);
    this.clear();
    return true;
  }

  /**
   * Paste from clipboard at the specified position
   * @param {number} targetX - Target X pixel coordinate
   * @param {number} targetY - Target Y pixel coordinate
   */
  pasteFromClipboard(targetX = 0, targetY = 0) {
    if (!this.clipboard || !this.clipboard.pixels) {
      Logger.warn('SelectionService', 'No clipboard data to paste');
      return;
    }

    const color = ColorManager.getCurrentSelection();

    PixelDrawRoutine.beginBatch();

    // Paste writes exactly the clipboard pixels — never symmetry-mirrored
    PixelDrawRoutine.suspendMirror(() => {
      const indices = ZX_SPECTRUM.PIXEL_DEPTH > 1 ? this.clipboard.indices : null;
      for (let py = 0; py < this.clipboard.height; py++) {
        const row = this.clipboard.pixels[py];
        if (!row) continue; // Skip corrupted rows

        for (let px = 0; px < this.clipboard.width; px++) {
          const isInk = row[px];
          const x = targetX + px;
          const y = targetY + py;

          if (Validators.isValidPixelCoord(x, y)) {
            if (isInk) {
              // Indexed clipboards paste their exact palette indices;
              // classic (or cross-mode mask) pastes use the current ink.
              const idx = indices && indices[py] ? indices[py][px] : null;
              PixelDrawRoutine.draw(x, y,
                idx != null && idx >= 0 ? { ...color, index: idx } : color,
                DRAW_MODE.NORMAL);
            }
          }
        }
      }
    });

    PixelDrawRoutine.endBatch();

    Logger.debug('SelectionService', `Pasted at (${targetX}, ${targetY})`);
  }

  /**
   * Paste from clipboard preserving original attributes
   * @param {number} targetX - Target X pixel coordinate
   * @param {number} targetY - Target Y pixel coordinate
   */
  pasteWithAttributes(targetX = 0, targetY = 0) {
    if (!this.clipboard || !this.clipboard.cells) return;

    const layer = LayerManager.getCurrentLayer();
    if (!layer || layer.locked) return;

    UndoRedo.beginAction('Paste with attributes');

    const startCell = ZX_COORDS.pixelToCell(targetX, targetY);

    this.clipboard.cells.forEach(cellData => {
      const cellX = startCell.x + cellData.relX;
      const cellY = startCell.y + cellData.relY;

      if (Validators.isValidCellCoord(cellX, cellY)) {
        layer.setCell(cellX, cellY, cellData.data);
        LayerManager.deferCellCompose(cellX, cellY);
      }
    });

    UndoRedo.endAction();
    CanvasSystem.requestRender();
  }

  /**
   * Delete the current selection (set to paper)
   */
  deleteSelection() {
    if (!this.selection) return;

    const color = ColorManager.getCurrentSelection();
    const { x, y, width, height, mask } = this.selection;

    PixelDrawRoutine.beginBatch();

    // Selection ops write exactly the selected pixels — never mirrored
    PixelDrawRoutine.suspendMirror(() => {
      for (let py = 0; py < height; py++) {
        for (let px = 0; px < width; px++) {
          if (mask && !mask[py][px]) continue;
          const pixelX = x + px;
          const pixelY = y + py;
          if (Validators.isValidPixelCoord(pixelX, pixelY)) {
            PixelDrawRoutine.draw(pixelX, pixelY, color, DRAW_MODE.ERASE);
          }
        }
      }
    });

    PixelDrawRoutine.endBatch();
  }

  /**
   * Fill the selection with the current ink color
   */
  fillSelection() {
    if (!this.selection) return;

    const color = ColorManager.getCurrentSelection();
    const { x, y, width, height, mask } = this.selection;

    PixelDrawRoutine.beginBatch();

    PixelDrawRoutine.suspendMirror(() => {
      for (let py = 0; py < height; py++) {
        for (let px = 0; px < width; px++) {
          if (mask && !mask[py][px]) continue;
          const pixelX = x + px;
          const pixelY = y + py;
          if (Validators.isValidPixelCoord(pixelX, pixelY)) {
            PixelDrawRoutine.draw(pixelX, pixelY, color, DRAW_MODE.NORMAL);
          }
        }
      }
    });

    PixelDrawRoutine.endBatch();
  }

  /**
   * Invert pixels within the selection
   */
  invertSelection() {
    if (!this.selection) return;

    const layer = LayerManager.getCurrentLayer();
    if (!layer || layer.locked) return;

    const color = ColorManager.getCurrentSelection();
    const { x, y, width, height, mask } = this.selection;

    PixelDrawRoutine.beginBatch();

    PixelDrawRoutine.suspendMirror(() => {
      for (let py = 0; py < height; py++) {
        for (let px = 0; px < width; px++) {
          if (mask && !mask[py][px]) continue;
          const pixelX = x + px;
          const pixelY = y + py;
          if (Validators.isValidPixelCoord(pixelX, pixelY)) {
            const isInk = layer.getPixelState(pixelX, pixelY);
            const mode = isInk ? DRAW_MODE.ERASE : DRAW_MODE.NORMAL;
            PixelDrawRoutine.draw(pixelX, pixelY, color, mode);
          }
        }
      }
    });

    PixelDrawRoutine.endBatch();
  }

  // ─── Floating paste ───────────────────────────────────────────────────────

  /** True while a floating paste is in progress. */
  isFloating() {
    return this.floatingPaste !== null;
  }

  /**
   * Begin a floating paste from the clipboard.
   * Creates a temporary topmost layer; the user drags to position it before committing.
   * @param {number} x - Initial canvas X for the top-left of the pasted content
   * @param {number} y - Initial canvas Y
   */
  startFloatingPaste(x = 0, y = 0) {
    if (!this.clipboard || !this.clipboard.pixels) return;
    this._createFloatingPaste(
      this.clipboard.pixels, this.clipboard.width, this.clipboard.height, x, y, 'Paste'
    );
    if (!this.floatingPaste) { this.pasteFromClipboard(x, y); return; } // fallback: max layers
    // Indexed clipboards float with their palette indices so the preview and
    // commit reproduce the copied colours (mask-only elsewhere).
    if (ZX_SPECTRUM.PIXEL_DEPTH > 1 && this.clipboard.indices) {
      this.floatingPaste.indices = this.clipboard.indices.map(r => [...r]);
      this.floatingPaste._srcIndices = this.clipboard.indices.map(r => [...r]);
      this.floatingPaste.floatingLayer.clear();
      LayerManager.composeToCanvas();
      this._drawFloatingLayer();
      LayerManager.flushPendingCompose();
      CanvasSystem.requestRender();
    }
  }

  /**
   * Begin a floating paste from an arbitrary pixel mask (e.g. text rasterization).
   * @param {boolean[][]} pixels - Row-major boolean mask
   * @param {number} width
   * @param {number} height
   * @param {number} x - Initial canvas X
   * @param {number} y - Initial canvas Y
   * @param {string} [label] - Undo label
   * @param {Object|null} [fontInfo] - Font parameters for text stamps (enables high-quality rescale)
   *   { text, fontFamily, fontSize, bold, italic }
   * @param {string} [warpEffect] - Initial warp effect name (or 'none')
   */
  startFloatingPasteFromMask(pixels, width, height, x = 0, y = 0, label = 'Place', fontInfo = null, warpEffect = 'none') {
    this._createFloatingPaste(pixels, width, height, x, y, label, fontInfo, warpEffect);
  }

  /** @private */
  _createFloatingPaste(pixels, width, height, x, y, label, fontInfo = null, warpEffect = 'none') {
    if (this.floatingPaste) this.endFloatingPaste();

    UndoRedo.beginAction(label);
    const colorSelection = ColorManager.getCurrentSelection();

    this._stampCounter++;
    const floatingLayer = LayerManager.createStampLayer(`Stamp ${this._stampCounter}`);
    if (!floatingLayer) {
      UndoRedo.cancelAction();
      return;
    }

    // Engage the new stamp. setCurrentLayer leaves activeDrawLayerIndex
    // untouched for stamps, so the user's active drawing layer is preserved
    // as the commit target.
    LayerManager.setCurrentLayer(floatingLayer.index);

    // Build the initial display pixels (apply warp if specified)
    const displayPixels = (warpEffect && warpEffect !== 'none')
      ? this._applyWarpEffect(pixels, width, height, warpEffect)
      : pixels;
    const displayW = displayPixels[0] ? displayPixels[0].length : width;
    const displayH = displayPixels.length;

    this.floatingPaste = {
      pixels:    displayPixels,
      width:     displayW,
      height:    displayH,
      x, y,
      colorSelection,
      floatingLayer,
      // Source tracking for live transforms
      _srcPixels: pixels,
      _srcWidth:  width,
      _srcHeight: height,
      _scaleX:    1,
      _scaleY:    1,
      _rotation:  0,
      _warpEffect: warpEffect || 'none',
      fontInfo:   fontInfo,         // null for clipboard pastes, set for text stamps
    };

    this._drawFloatingLayer();
    LayerManager.flushPendingCompose();
    CanvasSystem.requestRender();
    EventBus.emit(EVENTS.CANVAS_RENDER);

    UndoRedo.endAction();
  }

  // ─── Live stamp transforms ─────────────────────────────────────────────────

  /**
   * Resample the stamp to a new scale. Re-rasterizes from font if fontInfo is available.
   * Does NOT create an undo entry — call beginAction/endAction around a drag sequence.
   * @param {number} sx - Scale X (1.0 = original size)
   * @param {number} sy - Scale Y (1.0 = original size)
   */
  setStampScale(sx, sy) {
    const fp = this.floatingPaste;
    if (!fp) return;
    fp._scaleX = Math.max(0.1, sx);
    fp._scaleY = Math.max(0.1, sy);
    this._recomputeStampTransform();
  }

  /**
   * Rotate the stamp around its centre.
   * @param {number} degrees - Clockwise rotation in degrees
   */
  setStampRotation(degrees) {
    const fp = this.floatingPaste;
    if (!fp) return;
    fp._rotation = degrees % 360;
    this._recomputeStampTransform();
  }

  /**
   * Apply a warp effect to the stamp.
   * @param {string} effect - Effect name ('none', 'arch-up', 'arch-down', 'wave', etc.)
   */
  setStampWarp(effect) {
    const fp = this.floatingPaste;
    if (!fp) return;
    fp._warpEffect = effect || 'none';
    this._recomputeStampTransform();
  }

  /**
   * Update an active text stamp's font/text/warp settings and redraw.
   * Called by TextTool setters for live preview without creating extra undo entries.
   * @param {Object|null} fontInfo - { text, fontFamily, fontSize, bold, italic }
   * @param {string|null} warpEffect
   * @param {number} [targetW] - New source width (0 = keep current)
   * @param {number} [targetH] - New source height (0 = keep current)
   */
  refreshTextStamp(fontInfo, warpEffect, targetW = 0, targetH = 0) {
    const fp = this.floatingPaste;
    if (!fp) return;
    if (fontInfo != null)   fp.fontInfo    = { ...fontInfo };
    if (warpEffect != null) fp._warpEffect = warpEffect;
    if (targetW > 0) fp._srcWidth  = targetW;
    if (targetH > 0) fp._srcHeight = targetH;
    this._recomputeStampTransform();
  }

  /**
   * Recompute the stamp pixels from the source, applying warp -> scale -> rotation.
   * Updates fp.pixels/width/height and redraws the floating layer.
   * @private
   */
  _recomputeStampTransform() {
    const fp = this.floatingPaste;
    if (!fp) return;

    // Captured before Step "Update display pixels" below overwrites them —
    // the footprint being vacated, for _clearFloatingFootprint.
    const oldX = fp.x, oldY = fp.y, oldWidth = fp.width, oldHeight = fp.height;

    // ── Step 1: Obtain source pixels at the target scale ───────────────────
    let srcPixels, srcW, srcH;
    let rotationApplied = false;   // the vector path turns the glyph itself
    // Set where Step 1 scaled IN the coverage domain, so the rest of the chain
    // can carry on from it rather than thresholding and re-entering. The scale
    // is where most of the measured gain for pasted artwork lives - 0.720 to
    // 0.963 IoU on the bench's 165-case suite, dComp 7.39 to 2.50 - and
    // leaving it outside the domain gave that away.
    let srcCov = null;
    const targetW = Math.max(1, Math.round(fp._srcWidth  * fp._scaleX));
    const targetH = Math.max(1, Math.round(fp._srcHeight * fp._scaleY));

    if (fp.fontInfo) {
      // Re-rasterize the font at the new pixel size for maximum sharpness
      const fi = fp.fontInfo;
      const tool = window.ToolManager ? ToolManager.getTool(TOOLS.TEXT) : null;
      if (tool && tool.isBitmapFont(fi.fontFamily)) {
        // Glyph-byte fonts: ZX ROM and Phase 10 'zxfont:<name>' library fonts
        srcPixels = tool._buildTextMask(fi.text, fi.fontFamily, fi.bold, fi.italic, fi.layout)?.pixels || fp._srcPixels;
        srcW = srcPixels[0]?.length || fp._srcWidth;
        srcH = srcPixels.length || fp._srcHeight;
        // Scale the bitmap mask IN the coverage domain. A glyph-byte font has
        // no finer form, so its own coverage map is exact and this is strictly
        // better than a nearest resample: 0.976 to 0.994 on the bench's glyph
        // suite.
        srcCov = CoverageOps.transform(CoverageOps.fromMask(srcPixels),
          { scaleX: targetW / srcW, scaleY: targetH / srcH }, { w: targetW, h: targetH });
        srcPixels = null;
        srcW = targetW; srcH = targetH;
      } else if (tool && (fp._rotation || fi.direction)
                 && (!fp._warpEffect || fp._warpEffect === 'none')
                 && (!fi.layout || fi.layout === 'horizontal')
                 && !fi.mirrorH && !fi.mirrorV
                 && !fi.shadow && !fi.outline) {
        // Vector text turned by rotation alone: hand the angle to the font
        // engine rather than resampling its output. Measured 2026-08-29,
        // 'ZX SPECTRUM' at 16px turned 45 degrees - Californian FB went from
        // 11 connected pieces upright to 20 through the resampler, and stays
        // at 11 through this path.
        //
        // BOTH rotations compose into one. The text tool's `direction` and the
        // Transform slider are two controls that both say "rotate this text",
        // and serving only one of them would leave them disagreeing about
        // sharpness at the same angle - the objection that collapsed
        // SelectionService._rotateMask into MaskOps.rotate. With no warp
        // between them two rotations of a block compose exactly, and the guard
        // is what guarantees nothing sits between them.
        //
        // The guard stays narrow ON PURPOSE: every excluded field is a
        // mask-space effect MaskOps applies AFTER this point (Step 1b/2), so
        // serving them here would apply them in the wrong order and change
        // what they look like. Widening it further is a measured change, not a
        // tidy-up.
        //
        // `_warpEffect` defaults to the STRING 'none', not to null - testing it
        // for truthiness alone means this branch never fires at all.
        const totalDeg = (fp._rotation || 0) + (fi.direction || 0);
        const rad = totalDeg * Math.PI / 180;
        const cos = Math.abs(Math.cos(rad)), sin = Math.abs(Math.sin(rad));
        const box = {
          w: Math.max(1, Math.ceil(targetW * cos + targetH * sin)),
          h: Math.max(1, Math.ceil(targetW * sin + targetH * cos))
        };
        // GLYPH_COVERAGE, not the unbiased area cut - a letterform's
        // legibility rides on strokes thinner than a pixel.
        srcPixels = CoverageOps.toMask(
          tool._renderThrough(fi.text, fi.fontFamily, fi.fontSize * fp._scaleX,
            totalDeg, box),
          CoverageOps.GLYPH_COVERAGE);
        srcW = box.w;
        srcH = box.h;
        rotationApplied = true;
      } else if (tool) {
        const mask = tool._rasterizeWithFont(
          fi.text, fi.fontFamily, fi.fontSize * fp._scaleX,
          fi.bold, fi.italic, fi.layout
        );
        if (mask) {
          // Resample to the exact target box so system fonts stay visually consistent
          srcPixels = this._resampleMask(mask.pixels, mask.width, mask.height, targetW, targetH);
          srcW = targetW; srcH = targetH;
        } else { srcPixels = fp._srcPixels; srcW = fp._srcWidth; srcH = fp._srcHeight; }
      } else {
        srcCov = this._scaleInCoverage(fp._srcPixels, fp._srcWidth, fp._srcHeight, targetW, targetH);
        srcPixels = null;
        srcW = targetW; srcH = targetH;
      }
    } else {
      // A plain paste: 1-bit artwork with no finer form, so its own coverage
      // map is exact and the scale belongs in the domain like everything else.
      srcCov = this._scaleInCoverage(fp._srcPixels, fp._srcWidth, fp._srcHeight, targetW, targetH);
      srcPixels = null;
      srcW = targetW; srcH = targetH;
    }

    // ── Steps 1b to 3, in the coverage domain ─────────────────────────────
    //
    // Enter ONCE and leave ONCE. Every threshold taken between here and the
    // end is information destroyed before anything downstream can use it, and
    // that is not a theoretical worry: the finest possible resample of an
    // already-thresholded raster scores 0.311 against ground truth where the
    // crudest scores 0.309. The order is exactly what it was - the text
    // effects, then the tool's own direction, then the warp, then the slider's
    // rotation - because changing when a shadow or an arch happens changes
    // what it looks like.
    //
    // Scale is deliberately NOT composed into these maps even though
    // CoverageOps.transform can take both: the effects and the warp sit
    // between the scale and the rotation in this chain. Two maps with one
    // quantisation still beats three quantisations, which is where the
    // measured win comes from - warp alone goes from dComp 21.49 to 1.20.
    //
    // `rotationApplied` means the vector path already rasterised the glyph
    // turned, direction included. Its guard excludes every other field below,
    // so honouring it here drops the duplicate rotation and nothing else.
    const fInfo = fp.fontInfo;
    const wantsEffects = !!(fInfo && !rotationApplied &&
      (fInfo.mirrorH || fInfo.mirrorV || fInfo.shadow || fInfo.outline));
    const wantsDirection = !!(fInfo && fInfo.direction && !rotationApplied);
    const wantsWarp = !!(fp._warpEffect && fp._warpEffect !== 'none');
    const wantsSpin = fp._rotation !== 0 && !rotationApplied;

    if (srcCov || wantsEffects || wantsDirection || wantsWarp || wantsSpin) {
      let cov = srcCov || CoverageOps.fromMask(srcPixels);
      if (wantsEffects) cov = CoverageOps.process(cov, fInfo);
      if (wantsDirection) {
        cov = CoverageOps.transform(cov, { degrees: fInfo.direction },
          CoverageOps.boxFor(cov.w, cov.h, { degrees: fInfo.direction }));
      }
      if (wantsWarp) cov = CoverageOps.warp(cov, fp._warpEffect);
      if (wantsSpin) {
        cov = CoverageOps.transform(cov, { degrees: fp._rotation },
          CoverageOps.boxFor(cov.w, cov.h, { degrees: fp._rotation }));
      }
      // toMaskToned, never plain toMask: a sparse dither field thresholds to
      // NOTHING, and on a two-colour cell dithering is the only way to fake a
      // grey - the pattern library's whole spine is a density ramp.
      srcPixels = CoverageOps.toMaskToned(cov);
      srcW = cov.w;
      srcH = cov.h;
    }

    // ── Indexed stamps: keep the per-pixel indices through a plain scale;
    // warp/rotation are mask-space effects, so the stamp falls back to
    // mask + current ink there (documented Phase 13 limitation) ──────────
    if (fp._srcIndices) {
      if ((!fp._warpEffect || fp._warpEffect === 'none') && fp._rotation === 0) {
        fp.indices = this._resampleIndexGrid(
          fp._srcIndices, fp._srcWidth, fp._srcHeight, srcW, srcH);
      } else {
        fp.indices = null;
      }
    }

    // ── Update display pixels, preserving visual centre ───────────────────
    const cx = fp.x + Math.floor(fp.width  / 2);
    const cy = fp.y + Math.floor(fp.height / 2);
    fp.pixels = srcPixels;
    fp.width  = srcW;
    fp.height = srcH;
    fp.x = cx - Math.floor(srcW / 2);
    fp.y = cy - Math.floor(srcH / 2);

    this._clearFloatingFootprint(fp.floatingLayer, oldX, oldY, oldWidth, oldHeight);
    this._drawFloatingLayer();
    LayerManager.flushPendingCompose();
    CanvasSystem.requestRender();
    EventBus.emit(EVENTS.CANVAS_RENDER);
  }

  /**
   * Scale a 1-bit mask into the coverage domain.
   *
   * A pasted stamp has no finer form than its own pixels, so treating each as
   * a unit square and measuring area is the best answer available - and
   * unlike a nearest resample it survives a downscale: shrinking a 25%-dense
   * dither by point-sampling keeps its density only by luck of alignment,
   * while this keeps it by construction. The caller thresholds once at the end
   * through `toMaskToned`.
   * @private
   */
  _scaleInCoverage(mask, srcW, srcH, dstW, dstH) {
    return CoverageOps.transform(CoverageOps.fromMask(mask),
      { scaleX: dstW / srcW, scaleY: dstH / srcH }, { w: dstW, h: dstH });
  }

  /**
   * Nearest-neighbor resample a bool[][] mask to new dimensions.
   * @private
   */
  _resampleMask(src, srcW, srcH, dstW, dstH) {
    return Array.from({ length: dstH }, (_, dy) =>
      Array.from({ length: dstW }, (_, dx) => {
        const sx = Math.min(srcW - 1, Math.floor(dx * srcW / dstW));
        const sy = Math.min(srcH - 1, Math.floor(dy * srcH / dstH));
        return src[sy] ? src[sy][sx] || false : false;
      })
    );
  }

  /**
   * Nearest-neighbor resample an index grid (numbers, −1 = transparent)
   * to new dimensions (indexed-mode stamps, Phase 13).
   * @private
   */
  _resampleIndexGrid(src, srcW, srcH, dstW, dstH) {
    return Array.from({ length: dstH }, (_, dy) =>
      Array.from({ length: dstW }, (_, dx) => {
        const sx = Math.min(srcW - 1, Math.floor(dx * srcW / dstW));
        const sy = Math.min(srcH - 1, Math.floor(dy * srcH / dstH));
        const v = src[sy] ? src[sy][sx] : -1;
        return v == null ? -1 : v;
      })
    );
  }

  /**
   * Rotate a bool[][] mask by an arbitrary angle.
   *
   * This is `MaskOps.rotate` and nothing else. It used to be its own
   * canvas implementation - fill a scratch canvas a pixel at a time, rotate
   * the context, `drawImage`, read the alpha back - which was a second
   * rotation living next to the text tool's, and the two could disagree
   * about the same word: the Transform slider at 45 degrees and the text
   * tool's Direction at 45 degrees are the same question and must give the
   * same answer. MaskOps is also pure, so unlike the canvas version it can
   * be Node-tested (tests/text-mask-ops.test.js).
   *
   * Quarter turns are now LOSSLESS here too - MaskOps takes the exact
   * transpose path for multiples of 90 where the canvas resampled.
   *
   * @param {boolean[][]} src
   * @param {number} srcW - unused; kept so the call site reads dimensionally
   * @param {number} srcH - unused
   * @param {number} degrees - clockwise
   * @returns {{ pixels: boolean[][], width: number, height: number }}
   * @private
   */
  _rotateMask(src, srcW, srcH, degrees) {
    const pixels = MaskOps.rotate(src, degrees);
    return { pixels, width: pixels[0] ? pixels[0].length : 0, height: pixels.length };
  }

  /**
   * Apply a warp effect to a bool[][] mask using inverse coordinate mapping.
   * @param {boolean[][]} src
   * @param {number} srcW
   * @param {number} srcH
   * @param {string} effect
   * @param {number} [intensity=0.5]
   * @returns {boolean[][]}
   * @private
   */
  _applyWarpEffect(src, srcW, srcH, effect, intensity = 0.5) {
    // Compute per-effect canvas expansion so content isn't clipped at boundaries.
    // expandTop/expandLeft shift the coordinate frame; mapping uses srcDy/srcDx.
    let outW = srcW, outH = srcH;
    let expandTop = 0, expandLeft = 0;

    const arcH    = Math.round(srcH * intensity * 0.8);
    const waveAmp = Math.round(srcH * intensity * 0.25);
    const flagAmp = Math.round(srcH * intensity * 0.2);
    const slantX  = Math.round(srcH * intensity * 0.7);

    switch (effect) {
      case 'arch-up':    expandTop   = arcH;   outH = srcH + arcH;   break;
      case 'arch-down':                         outH = srcH + arcH;   break;
      case 'wave':       expandTop   = waveAmp; outH = srcH + 2 * waveAmp; break;
      case 'flag':       expandTop   = flagAmp; outH = srcH + 2 * flagAmp; break;
      case 'slant-right':                        outW = srcW + slantX; break;
      case 'slant-left': expandLeft  = slantX;  outW = srcW + slantX; break;
    }

    const result = Array.from({ length: outH }, () => new Array(outW).fill(false));

    for (let dy = 0; dy < outH; dy++) {
      for (let dx = 0; dx < outW; dx++) {
        // Local coordinates in "source frame" (subtract expansion offsets)
        const srcDy = dy - expandTop;
        const srcDx = dx - expandLeft;
        // nx across full output width for consistent arch curvature
        const nx = dx / (outW - 1 || 1) - 0.5;
        const ny = dy / (outH - 1 || 1) - 0.5;
        let sx = srcDx, sy = srcDy;

        switch (effect) {
          case 'arch-up': {
            sy = srcDy + arcH * (1 - 4 * nx * nx);
            break;
          }
          case 'arch-down': {
            sy = srcDy - arcH * (1 - 4 * nx * nx);
            break;
          }
          case 'wave': {
            sy = srcDy + waveAmp * Math.sin(4 * Math.PI * dx / outW);
            break;
          }
          case 'flag': {
            sy = srcDy + flagAmp * Math.sin(2 * Math.PI * dx / outW);
            break;
          }
          case 'slant-right': {
            sx = srcDx - (srcH - 1 - srcDy) * intensity * 0.7;
            break;
          }
          case 'slant-left': {
            sx = srcDx + (srcH - 1 - srcDy) * intensity * 0.7;
            break;
          }
          case 'inflate': {
            const r = Math.sqrt(nx * nx + ny * ny);
            const factor = 1 + intensity * 1.5 * r * r;
            sx = (nx / factor + 0.5) * srcW;
            sy = (ny / factor + 0.5) * srcH;
            break;
          }
          case 'perspective-top': {
            const f = Math.max(0.1, 1 - intensity * (1 - dy / (outH - 1 || 1)));
            sx = (nx / f + 0.5) * srcW;
            sy = srcDy;
            break;
          }
          case 'perspective-bottom': {
            const f = Math.max(0.1, 1 - intensity * dy / (outH - 1 || 1));
            sx = (nx / f + 0.5) * srcW;
            sy = srcDy;
            break;
          }
        }

        const srcX = Math.round(sx);
        const srcY = Math.round(sy);
        if (srcX >= 0 && srcX < srcW && srcY >= 0 && srcY < srcH) {
          result[dy][dx] = src[srcY] ? src[srcY][srcX] || false : false;
        }
      }
    }
    return result;
  }

  /**
   * Clear only the cells a floating layer's footprint at (x, y, width,
   * height) could have touched, and defer their recompose.
   *
   * The bounded counterpart of `floatingLayer.clear()` (reinitialises the
   * WHOLE 32x24 grid, allocating fresh typed arrays for every cell) +
   * `LayerManager.composeToCanvas()` (recomposes every layer across all
   * 32x24 cells) — both of which used to run on every single pointer-move of
   * a stamp drag/scale/rotate/warp, regardless of how few cells a small
   * stamp actually occupies. Mirrors the cell-range math `_drawFloatingLayer`
   * already uses for the footprint it draws INTO; this is the same math for
   * the footprint being vacated.
   *
   * Safe to call with the stamp's old bounds and rely on `_drawFloatingLayer`
   * to repaint the new ones afterwards: any cell outside the CURRENT
   * footprint is always left in this cleared (unaltered, all-zero) state by
   * construction, so a cell newly entering the footprint on the next move is
   * guaranteed clean before `_drawFloatingLayer` ORs pixel bits into it.
   * @param {Object} floatingLayer
   * @param {number} x @param {number} y @param {number} width @param {number} height
   * @private
   */
  _clearFloatingFootprint(floatingLayer, x, y, width, height) {
    if (width <= 0 || height <= 0) return;
    const startCellX = Math.max(0, ZX_COORDS.pixelToCell(x, y).x);
    const startCellY = Math.max(0, ZX_COORDS.pixelToCell(x, y).y);
    const endCellX = Math.min(ZX_SPECTRUM.GRID_COLS - 1, ZX_COORDS.pixelToCell(x + width - 1, y).x);
    const endCellY = Math.min(ZX_SPECTRUM.GRID_ROWS - 1, ZX_COORDS.pixelToCell(x, y + height - 1).y);

    for (let cy = startCellY; cy <= endCellY; cy++) {
      for (let cx = startCellX; cx <= endCellX; cx++) {
        floatingLayer.clearCell(cx, cy);
        LayerManager.deferCellCompose(cx, cy);
      }
    }
  }

  /**
   * Reposition the floating paste to new canvas coordinates.
   * Clears the floating layer and redraws at the new offset.
   * @param {number} newX
   * @param {number} newY
   */
  moveFloatingPaste(newX, newY) {
    if (!this.floatingPaste) return;
    const fp = this.floatingPaste;

    this._clearFloatingFootprint(fp.floatingLayer, fp.x, fp.y, fp.width, fp.height);

    fp.x = newX;
    fp.y = newY;

    this._drawFloatingLayer();
    LayerManager.flushPendingCompose();
    CanvasSystem.requestRender();
    EventBus.emit(EVENTS.CANVAS_RENDER); // Refresh floating border
  }

  /**
   * End floating paste / component repositioning.
   * Saves current position back onto the component layer, clears drag state.
   * The layer persists until deleted via the layer panel.
   */
  endFloatingPaste() {
    if (!this.floatingPaste) return;
    const fp = this.floatingPaste;

    // Persist stamp position data on the layer for future tracking.
    // No undo capture here — `layer.stamp` is metadata for the stamp's
    // internal "where am I" memory and `_captureLayerState` already serialises
    // it.  Anything visual was committed in the paste/transform actions that
    // produced this state.
    if (fp.floatingLayer && fp.floatingLayer.isStamp) {
      fp.floatingLayer.stamp = {
        mask: fp.pixels,
        indices: fp.indices || null,
        x: fp.x,
        y: fp.y,
        w: fp.width,
        h: fp.height,
        colorSelection: fp.colorSelection
      };

      // A disengaged stamp must not leave frozen pixels masking the canvas.
      // Clear the floating layer's cells and recompose so the region it was
      // covering is redrawn from the layers beneath. The `layer.stamp`
      // metadata above is preserved, so startComponentReposition can
      // re-engage the stamp later by redrawing from `layer.stamp.mask`.
      fp.floatingLayer.clear();
      LayerManager.composeToCanvas();
    }

    this.floatingPaste = null;
    EventBus.emit(EVENTS.CANVAS_RENDER);
  }

  /**
   * Cancel the active floating paste: remove the stamp layer without committing anything.
   */
  cancelFloatingPaste() {
    if (!this.floatingPaste) return;
    const fp = this.floatingPaste;
    this.floatingPaste = null;
    if (fp.floatingLayer) {
      LayerManager.removeLayer(fp.floatingLayer.index, false);
    }
    EventBus.emit(EVENTS.CANVAS_RENDER);
  }

  /**
   * Enter stamp-tracking mode for a stamp layer.
   * Loads the layer's stamp data into floatingPaste so the preview follows the cursor.
   * @param {Layer} layer - A layer with isStamp=true and stamp data
   */
  startComponentReposition(layer) {
    if (!layer || !layer.isStamp || !layer.stamp) return;
    if (this.floatingPaste) this.endFloatingPaste();

    layer.clear(); // Remove any frozen pixels before cursor-following begins

    const c = layer.stamp;
    this.floatingPaste = {
      pixels: c.mask,
      width:  c.w,
      height: c.h,
      x: c.x,
      y: c.y,
      colorSelection: c.colorSelection,
      floatingLayer: layer,
      _isBrushStamp: true,   // stamp is in brush mode (follows cursor, stamps ink)
      _srcPixels: c.mask,
      _srcWidth:  c.w,
      _srcHeight: c.h,
      _scaleX: 1, _scaleY: 1,
      _rotation: 0,
      _warpEffect: 'none',
      indices: c.indices || null,
      _srcIndices: c.indices ? c.indices.map(r => [...r]) : null,
    };

    // XOR preview depends on the live target-layer state, so re-render rather
    // than relying on the static committed stamp pixels.
    if (layer.xorMode) {
      layer.clear();
      LayerManager.composeToCanvas();
      this._drawFloatingLayer();
      LayerManager.flushPendingCompose();
      CanvasSystem.requestRender();
    }

    EventBus.emit(EVENTS.CANVAS_RENDER);
  }

  /**
   * Toggle the active stamp between brush mode (_isBrushStamp=true) and
   * floating mode (_isBrushStamp=false). Brush mode: stamp follows cursor and
   * paints ink. Floating mode: stamp is fixed; use handles to transform it.
   */
  toggleStampMode() {
    if (!this.floatingPaste || this.floatingPaste.floatingLayer?.isStamp !== true) return;
    const fp = this.floatingPaste;
    fp._isBrushStamp = !fp._isBrushStamp;
    EventBus.emit(EVENTS.CANVAS_RENDER);
  }

  /**
   * Set the stamp erase mode. When true, left-click in brush mode erases ink
   * rather than stamping it.
   * @param {boolean} v
   */
  setStampEraseMode(v) {
    this.stampEraseMode = !!v;
    EventBus.emit(EVENTS.CANVAS_RENDER);
  }

  /**
   * True when a stamp exists in floating (non-brush) mode.
   * @returns {boolean}
   */
  isStampFloating() {
    return !!(this.floatingPaste && this.floatingPaste._isBrushStamp === false);
  }

  /**
   * Move the stamp preview so it is centred on the given cursor position.
   * Called on every pointer-move when a stamp layer is active.
   * @param {number} cursorX
   * @param {number} cursorY
   */
  moveStampPreview(cursorX, cursorY) {
    if (!this.floatingPaste) return;
    const fp = this.floatingPaste;
    // No clamp — the stamp is allowed to extend off-canvas so its on-canvas pixels
    // can reach all four edges. Off-canvas pixels are dropped at draw time.
    const newX = cursorX - Math.floor(fp.width  / 2);
    const newY = cursorY - Math.floor(fp.height / 2);
    this.moveFloatingPaste(newX, newY);
  }

  /**
   * Transform the floating stamp mask in-memory (flip, rotate, shift, invert,
   * outline) and redraw. Preserves the stamp's visual centre after dimension
   * changes (e.g. 90° rotation). Shift operations move the stamp position by
   * `amount` pixels; the stamp may move off-canvas — off-canvas pixels are
   * silently dropped at draw time.
   *
   * Wraps the operation in a single UndoRedo action so that one Ctrl+Z reverses
   * the whole transform, and Ctrl+Shift+Z restores it.
   *
   * @param {string} type - 'flipH'|'flipV'|'rotate90CW'|'rotate90CCW'|'rotate180'|'shiftUp'|'shiftDown'|'shiftLeft'|'shiftRight'|'invert'|'outline'
   * @param {number} [amount=1] - Pixels to shift (only used for shift operations)
   * @param {number} [outlineGap=1] - Gap pixels for outline operation
   * @param {number} [outlineSize=1] - Thickness for outline operation
   */
  transformStamp(type, amount = 1, outlineGap = 1, outlineSize = 1) {
    if (!this.floatingPaste) return;
    UndoRedo.beginAction(`Stamp ${type}`);
    const fp = this.floatingPaste;

    // Shift operations reposition the stamp — no pixel data transform needed.
    // No canvas clamp: the stamp may shift past the canvas edge.
    if (type === 'shiftLeft' || type === 'shiftRight' || type === 'shiftUp' || type === 'shiftDown') {
      let newX = fp.x, newY = fp.y;
      if (type === 'shiftLeft')  newX = fp.x - amount;
      if (type === 'shiftRight') newX = fp.x + amount;
      if (type === 'shiftUp')    newY = fp.y - amount;
      if (type === 'shiftDown')  newY = fp.y + amount;
      this.moveFloatingPaste(newX, newY);
      UndoRedo.endAction();
      return;
    }

    const { pixels, width: w, height: h } = fp;
    // Captured before fp.x/fp.y are overwritten below — the footprint being
    // vacated, for _clearFloatingFootprint.
    const oldX = fp.x, oldY = fp.y;
    let newPixels, newW = w, newH = h;
    // Indexed stamps (Phase 13): the pure grid transforms apply identically
    // to the index grid; shape-changing mask ops (invert/outline) drop it.
    let newIndices = null;
    const grid = fp.indices;
    const gridOp = (fn) => (grid ? fn(grid) : null);

    switch (type) {
      case 'flipH':
        newPixels = pixels.map(row => [...row].reverse());
        newIndices = gridOp(g => g.map(row => [...row].reverse()));
        break;
      case 'flipV':
        newPixels = [...pixels].reverse();
        newIndices = gridOp(g => [...g].reverse());
        break;
      case 'rotate90CW':
        newW = h; newH = w;
        newPixels = Array.from({ length: newH }, (_, r) =>
          Array.from({ length: newW }, (_, c) => pixels[h - 1 - c][r])
        );
        newIndices = gridOp(g => Array.from({ length: newH }, (_, r) =>
          Array.from({ length: newW }, (_, c) => g[h - 1 - c][r])
        ));
        break;
      case 'rotate90CCW':
        newW = h; newH = w;
        newPixels = Array.from({ length: newH }, (_, r) =>
          Array.from({ length: newW }, (_, c) => pixels[c][w - 1 - r])
        );
        newIndices = gridOp(g => Array.from({ length: newH }, (_, r) =>
          Array.from({ length: newW }, (_, c) => g[c][w - 1 - r])
        ));
        break;
      case 'rotate180':
        newPixels = [...pixels].reverse().map(row => [...row].reverse());
        newIndices = gridOp(g => [...g].reverse().map(row => [...row].reverse()));
        break;
      case 'invert':
        newPixels = pixels.map(row => row.map(p => !p));
        break;
      case 'outline': {
        // Expand stamp bounds to accommodate gap + outline ring
        const pad = outlineGap + outlineSize;
        newW = w + 2 * pad;
        newH = h + 2 * pad;
        // Place original pixels centred in the expanded canvas (edges guaranteed empty)
        const expanded = Array.from({ length: newH }, (_, ry) =>
          Array.from({ length: newW }, (_, rx) => {
            const oy = ry - pad, ox = rx - pad;
            return oy >= 0 && oy < h && ox >= 0 && ox < w ? pixels[oy][ox] : false;
          })
        );
        // Exterior-only dilation: outline appears only on the outer boundary, not inside holes
        const exterior = TransformService.markExteriorBuffer(expanded, newH, newW);
        const inner    = TransformService.dilateExteriorBuffer(expanded, exterior, newH, newW, outlineGap);
        const outerRing = TransformService.dilateExteriorBuffer(inner, exterior, newH, newW, outlineSize);
        newPixels = expanded.map((row, ry) =>
          row.map((cell, rx) => cell || (outerRing[ry][rx] && !inner[ry][rx]))
        );
        break;
      }
      default:
        UndoRedo.cancelAction();
        return;
    }

    const cx = fp.x + Math.floor(w  / 2);
    const cy = fp.y + Math.floor(h  / 2);
    fp.pixels = newPixels;
    // Display grid only — _srcIndices stays the untransformed source, the
    // same contract fp.pixels/_srcPixels follow.
    fp.indices = newIndices;
    fp.width  = newW;
    fp.height = newH;
    // Preserve the visual centre after a transform — no canvas clamp, so the
    // stamp can stay where the user placed it even if partially off-canvas.
    fp.x = cx - Math.floor(newW / 2);
    fp.y = cy - Math.floor(newH / 2);

    this._clearFloatingFootprint(fp.floatingLayer, oldX, oldY, w, h);
    this._drawFloatingLayer();
    LayerManager.flushPendingCompose();
    CanvasSystem.requestRender();
    EventBus.emit(EVENTS.CANVAS_RENDER);

    UndoRedo.endAction();
  }

  /**
   * Stamp the stamp layer's ink shape onto the drawing layer below it.
   * TRANSPARENT mode — sets ink bits only, never changes cell colour attributes.
   * Caller is responsible for beginBatch / endBatch (for continuous brush-style painting).
   * @param {Layer} layer - A stamp layer
   */
  stampAt(layer) {
    if (!layer || !layer.isStamp) return;
    const data = this._getStampData(layer);
    if (!data) return;
    const { mask, x, y, w, h } = data;
    const targetLayer = this._findTargetBelow(layer);
    if (!targetLayer) return;

    const color = ColorManager.getCurrentSelection();
    // The top-bar draw-mode selector governs a stamp exactly like a brush
    // stroke — resolved once per call since a stamp write is a single
    // ink-placing action, never an erase.
    const mode = PixelDrawRoutine.resolveUserMode(true);

    const bgLayer = LayerManager.layers[0];

    /**
     * Build a colorSelection for a single stamp pixel that applies the stamp's ink
     * colour but inherits the target cell's paper colour and flash flag.
     * bright is taken from the stamp (it applies cell-wide; matching the preview).
     */
    const inkOnlyColor = (cx, cy) => {
      const cellPos = ZX_COORDS.pixelToCell(cx, cy);
      const tCell = targetLayer.getCell(cellPos.x, cellPos.y);
      const attrSrc = (tCell && tCell.altered)
        ? tCell
        : (bgLayer ? bgLayer.getCell(cellPos.x, cellPos.y) : null);
      return {
        ink:   color.ink,
        paper: attrSrc ? attrSrc.paper : 7,
        bright: color.bright,
        flash: attrSrc ? attrSrc.flash  : color.flash,
        inkTransparent:   color.inkTransparent   || false,
        paperTransparent: true   // never overwrite the underlying paper index
      };
    };

    // Stamp writes place exactly the stamp mask — never symmetry-mirrored
    PixelDrawRoutine.suspendMirror(() => {
      // Indexed modes (Phase 13): paint the stamp's palette indices (or the
      // mask at the current indexed ink), routed through the same resolved
      // mode (Paper Recolour/XOR still mean something over an index grid).
      if (ZX_SPECTRUM.PIXEL_DEPTH > 1) {
        this._paintIndexedStamp(data, targetLayer, color, mode);
        return;
      }

      // The stamp's OWN "XOR mode" checkbox (LayerPanel) is a persisted,
      // per-stamp feature independent of the global draw-mode selector and
      // takes priority when engaged. Toggle ink <-> paper against the
      // target's current pixel state. Each pixel toggles at most once per
      // drag — _xorStampToggled guards the overlap between successive
      // rubber-stamp positions (see the constructor).
      if (layer.xorMode) {
        for (let py = 0; py < h; py++) {
          const row = mask[py];
          if (!row) continue;
          for (let px = 0; px < w; px++) {
            if (!row[px]) continue;
            const cx = x + px, cy = y + py;
            if (!Validators.isValidPixelCoord(cx, cy)) continue;
            const xorKey = targetLayer.id + ':' + (cy * ZX_SPECTRUM.WIDTH + cx);
            if (this._xorStampToggled.has(xorKey)) continue;
            this._xorStampToggled.add(xorKey);
            if (targetLayer.getPixelState(cx, cy)) {
              PixelDrawRoutine.draw(cx, cy, color, DRAW_MODE.ERASE, { layer: targetLayer });
            } else {
              PixelDrawRoutine.draw(cx, cy, inkOnlyColor(cx, cy), DRAW_MODE.NORMAL, { layer: targetLayer });
            }
          }
        }
        return;
      }

      // Normal mode keeps the ink-only/inherited-paper paint the preview
      // shows; every other resolved mode (Ink/Paper Recolour, Pixels Only,
      // XOR) uses the plain current selection, exactly as BrushEngine does.
      for (let py = 0; py < h; py++) {
        const row = mask[py];
        if (!row) continue;
        for (let px = 0; px < w; px++) {
          if (!row[px]) continue;
          const cx = x + px, cy = y + py;
          if (Validators.isValidPixelCoord(cx, cy)) {
            const cs = mode === DRAW_MODE.NORMAL ? inkOnlyColor(cx, cy) : color;
            PixelDrawRoutine.draw(cx, cy, cs, mode, { layer: targetLayer });
          }
        }
      }
    });
  }

  /**
   * Paint a stamp's pixels onto a target layer in an indexed mode: the
   * stamp's own palette indices when it has them, else the mask at the
   * current indexed ink. Shared by stampAt and commitStamp (Phase 13).
   * Caller wraps in suspendMirror + batch.
   * @param {Object} data - stamp data ({mask, indices, x, y, w, h})
   * @param {Layer} targetLayer
   * @param {Object} color - current colour selection
   * @param {string} [mode] - resolved DRAW_MODE (default NORMAL); routed
   *   through so Paper Recolour/XOR mean the same thing over an index grid
   *   that they mean over classic attribute cells (see _applyIndexed).
   * @private
   */
  _paintIndexedStamp(data, targetLayer, color, mode = DRAW_MODE.NORMAL) {
    const { mask, indices, x, y, w, h } = data;
    for (let py = 0; py < h; py++) {
      const maskRow = mask ? mask[py] : null;
      const idxRow = indices ? indices[py] : null;
      if (!maskRow && !idxRow) continue;
      for (let px = 0; px < w; px++) {
        let idx = null;
        if (idxRow && idxRow[px] != null && idxRow[px] >= 0) idx = idxRow[px];
        else if (!idxRow && maskRow && maskRow[px]) idx = null; // mask -> current ink
        else continue;
        const cx = x + px, cy = y + py;
        if (!Validators.isValidPixelCoord(cx, cy)) continue;
        PixelDrawRoutine.draw(cx, cy,
          idx != null ? { ...color, index: idx } : color,
          mode, { layer: targetLayer });
      }
    }
  }

  /**
   * Erase the stamp layer's ink shape from the drawing layer below it.
   * Clears ink bits matching the stamp mask — colour attributes unchanged.
   * Caller is responsible for beginBatch / endBatch.
   * @param {Layer} layer - A stamp layer
   */
  eraseAt(layer) {
    if (!layer || !layer.isStamp) return;
    const data = this._getStampData(layer);
    if (!data) return;
    const { mask, x, y, w, h } = data;
    const targetLayer = this._findTargetBelow(layer);
    if (!targetLayer) return;

    const color = ColorManager.getCurrentSelection();
    // The rubber-stamp's right button is the erase counterpart of stampAt's
    // left button, so it resolves the SAME global draw-mode selector the
    // same way a brush's right button would (isInk=false).
    const mode = PixelDrawRoutine.resolveUserMode(false);
    PixelDrawRoutine.suspendMirror(() => {
      for (let py = 0; py < h; py++) {
        const row = mask[py];
        if (!row) continue;
        for (let px = 0; px < w; px++) {
          if (row[px]) {
            const cx = x + px, cy = y + py;
            if (Validators.isValidPixelCoord(cx, cy)) {
              PixelDrawRoutine.draw(cx, cy, color, mode, { layer: targetLayer });
            }
          }
        }
      }
    });
  }

  // ─── Stamp commit ───────────────────────────────────────────────────────

  /**
   * Commit a stamp layer's ink shape into a real drawing layer, then remove the
   * stamp layer. Mirrors stampAt's ink-only paint semantics (ink from the stamp's
   * colour selection, paper/flash inherited from the target cell or background,
   * bright from the stamp) and honours the stamp's XOR mode — but bakes onto an
   * explicitly resolved target layer rather than relying on _findTargetBelow.
   * @param {Layer} layer - A stamp layer (isStamp=true)
   * @returns {boolean} true if committed, false if not a stamp / no data / no valid target
   */
  commitStamp(layer) {
    if (!layer || !layer.isStamp) return false;

    // Capture stamp data FIRST, while floatingPaste is still set, so a live
    // (dragged) position is returned for the active stamp.
    const data = this._getStampData(layer);
    if (!data) return false;

    // Resolve the bake target using the SAME rule as brush-stamping
    // (_findTargetBelow): the user's explicitly-selected active drawing layer,
    // and only if it sits below the stamp and is unlocked. No topmost/auto
    // fallback (honours the project's explicit-layer-selection rule), so a
    // commit lands on exactly the layer a brush-stamp would have painted. If
    // there is no valid target we abort BEFORE any mutation — which is also why
    // removeLayer's "keep at least 2 layers" guard can never bite here.
    const target = this._findTargetBelow(layer);
    if (!target) return false;

    // If this stamp is the active floating one, tear down the floating state
    // WITHOUT saving metadata or leaving frozen pixels (the layer is about to be
    // deleted). Mirrors endFloatingPaste's state cleanup, minus the persist step.
    if (this.floatingPaste && this.floatingPaste.floatingLayer === layer) {
      this.floatingPaste = null;
    }

    const { mask, x, y, w, h } = data;
    const color = ColorManager.getCurrentSelection();
    // The top-bar draw-mode selector governs the commit exactly as it would
    // a brush stroke laying down the same ink.
    const mode = PixelDrawRoutine.resolveUserMode(true);
    const bgLayer = LayerManager.layers[0];

    /**
     * Ink-only colorSelection for a single committed pixel: stamp ink colour,
     * paper/flash inherited from the resolved target cell (or background when
     * unaltered), bright from the stamp. paperTransparent keeps the underlying
     * paper index intact. Mirrors stampAt's inkOnlyColor against `target`.
     */
    const inkOnlyColor = (cx, cy) => {
      const cellPos = ZX_COORDS.pixelToCell(cx, cy);
      const tCell = target.getCell(cellPos.x, cellPos.y);
      const attrSrc = (tCell && tCell.altered)
        ? tCell
        : (bgLayer ? bgLayer.getCell(cellPos.x, cellPos.y) : null);
      return {
        ink:   color.ink,
        paper: attrSrc ? attrSrc.paper : 7,
        bright: color.bright,
        flash: attrSrc ? attrSrc.flash  : color.flash,
        inkTransparent:   color.inkTransparent   || false,
        paperTransparent: true   // never overwrite the underlying paper index
      };
    };

    UndoRedo.beginAction('Commit stamp');
    PixelDrawRoutine.beginBatch();

    // Commits bake exactly the previewed stamp — never symmetry-mirrored
    PixelDrawRoutine.suspendMirror(() => {
      // Indexed modes (Phase 13): bake the previewed indices/mask directly,
      // through the same resolved mode as the classic branch below.
      if (ZX_SPECTRUM.PIXEL_DEPTH > 1) {
        this._paintIndexedStamp(data, target, color, mode);
      } else
      if (layer.xorMode) {
        // The stamp's OWN "XOR mode" checkbox — a persisted, per-stamp
        // feature independent of the global draw-mode selector — toggles
        // ink <-> paper against the resolved target when engaged.
        for (let py = 0; py < h; py++) {
          const row = mask[py];
          if (!row) continue;
          for (let px = 0; px < w; px++) {
            if (!row[px]) continue;
            const cx = x + px, cy = y + py;
            if (!Validators.isValidPixelCoord(cx, cy)) continue;
            if (target.getPixelState(cx, cy)) {
              PixelDrawRoutine.draw(cx, cy, color, DRAW_MODE.ERASE, { layer: target });
            } else {
              PixelDrawRoutine.draw(cx, cy, inkOnlyColor(cx, cy), DRAW_MODE.NORMAL, { layer: target });
            }
          }
        }
      } else {
        // Normal mode keeps the ink-only/inherited-paper bake; every other
        // resolved mode (Ink/Paper Recolour, Pixels Only, XOR) uses the
        // plain current selection, exactly as BrushEngine does.
        for (let py = 0; py < h; py++) {
          const row = mask[py];
          if (!row) continue;
          for (let px = 0; px < w; px++) {
            if (!row[px]) continue;
            const cx = x + px, cy = y + py;
            if (Validators.isValidPixelCoord(cx, cy)) {
              const cs = mode === DRAW_MODE.NORMAL ? inkOnlyColor(cx, cy) : color;
              PixelDrawRoutine.draw(cx, cy, cs, mode, { layer: target });
            }
          }
        }
      }
    });

    PixelDrawRoutine.endBatch();

    LayerManager.removeLayer(layer.index, false);

    // Restore the current layer to a valid drawing layer after the stamp's removal.
    const drawIdx = LayerManager.activeDrawLayerIndex;
    if (drawIdx >= 1 && drawIdx < LayerManager.layers.length) {
      LayerManager.setCurrentLayer(drawIdx);
    }

    UndoRedo.endAction();

    LayerManager.composeToCanvas();
    EventBus.emit(EVENTS.LAYER_ORDER);
    EventBus.emit(EVENTS.CANVAS_RENDER);
    return true;
  }

  /**
   * Commit the currently active (floating) stamp, if any.
   * @returns {boolean} true if a stamp was committed, false otherwise
   */
  commitActiveStamp() {
    if (this.floatingPaste &&
        this.floatingPaste.floatingLayer &&
        this.floatingPaste.floatingLayer.isStamp) {
      return this.commitStamp(this.floatingPaste.floatingLayer);
    }
    return false;
  }

  /**
   * Commit every stamp layer in the stack into its resolved drawing layer.
   * Iterates top-down so each commitStamp removal leaves the remaining
   * (lower-index) layers' indices valid. Wrapped in a single undo action.
   * @returns {number} count of stamps successfully committed
   */
  commitAllStamps() {
    UndoRedo.beginAction('Commit all stamps');
    let count = 0;
    const startLen = LayerManager.layers.length;
    for (let i = startLen - 1; i >= 1; i--) {
      const layer = LayerManager.layers[i];
      if (layer && layer.isStamp) {
        if (this.commitStamp(layer)) count++;
      }
    }
    UndoRedo.endAction();
    return count;
  }

  /** Return live stamp position from floatingPaste or committed stamp data. @private */
  _getStampData(layer) {
    const fp = this.floatingPaste;
    if (fp && fp.floatingLayer === layer) {
      return { mask: fp.pixels, indices: fp.indices || null,
               x: fp.x, y: fp.y, w: fp.width, h: fp.height };
    }
    if (layer.isStamp && layer.stamp) {
      return layer.stamp;
    }
    return null;
  }

  /** Return the draw target for any stamp operation: the user's active
   *  drawing layer from the Layers panel. ID-anchored — survives reorders
   *  and inserts. Stamps refuse to draw (return null) when no valid drawing
   *  layer is selected. Callers (stampAt / eraseAt / _drawFloatingLayer)
   *  handle null gracefully.
   *  @private */
  _findTargetBelow(stampLayer) {
    const layers = LayerManager.layers;
    const stampIdx = layers.indexOf(stampLayer);

    const drawIdx = LayerManager.activeDrawLayerIndex;
    if (drawIdx >= 1 && drawIdx < stampIdx) {
      const target = layers[drawIdx];
      if (target && !target.isStamp && !target.locked) return target;
    }

    return null;
  }

  /**
   * Draw the clipboard pixels onto the floating layer at its current offset.
   * The floating preview must show exactly what committing will produce, so
   * it resolves the SAME top-bar draw mode a commit will bake with.
   * @private
   */
  _drawFloatingLayer() {
    const { pixels, width, height, x, y, colorSelection, floatingLayer } = this.floatingPaste;

    // Indexed modes (Phase 13): stamp cells carry palette indices — the
    // stamp's own indices when it was cut/copied in an indexed mode, else
    // the mask painted with the current indexed ink.
    if (ZX_SPECTRUM.PIXEL_DEPTH > 1) {
      this._drawFloatingLayerIndexed();
      return;
    }

    // The stamp's OWN "XOR mode" checkbox (LayerPanel) is a persisted,
    // per-stamp feature independent of the global draw-mode selector, and
    // takes priority when engaged: pre-compute (target XOR stamp_shape) into
    // the floating layer's cells so the compositor can render the toggled
    // result directly.
    if (floatingLayer.xorMode) {
      this._drawFloatingLayerXOR();
      return;
    }

    // The global draw mode's own XOR entry needs the same "replace, don't
    // OR-stack" compositing the checkbox above uses, but must not touch the
    // persisted layer.xorMode flag (that would desync the UI checkbox and
    // make commitStamp/stampAt run the WRONG bake branch). It has its own
    // method and composites via a per-CELL flag instead — see
    // LayerManager._composeCellData's cell.xorReplace check. XOR_PIXEL reuses
    // the same preview: a stamp touches each pixel once, so the once-per-
    // stroke gate that tells XOR and XOR_PIXEL apart never comes into play here.
    const mode = PixelDrawRoutine.resolveUserMode(true);
    if (mode === DRAW_MODE.XOR || mode === DRAW_MODE.XOR_PIXEL) {
      this._drawFloatingLayerModeXOR(colorSelection);
      return;
    }

    const targetLayer = this._findTargetBelow(floatingLayer);
    const bgLayer = LayerManager.layers[0];
    const CW = ZX_SPECTRUM.CELL_WIDTH;
    const CH = ZX_SPECTRUM.CELL_HEIGHT;

    // Iterate cell by cell — mirrors _drawFloatingLayerXOR so paper colour is
    // inherited from the target (or background) rather than from colorSelection.
    // This ensures the stamp preview does not impose paper onto the canvas below.
    const startCellX = Math.max(0, ZX_COORDS.pixelToCell(x, y).x);
    const startCellY = Math.max(0, ZX_COORDS.pixelToCell(x, y).y);
    const endCellX = Math.min(ZX_SPECTRUM.GRID_COLS - 1, ZX_COORDS.pixelToCell(x + width - 1, y).x);
    const endCellY = Math.min(ZX_SPECTRUM.GRID_ROWS - 1, ZX_COORDS.pixelToCell(x, y + height - 1).y);

    for (let cy = startCellY; cy <= endCellY; cy++) {
      for (let cx = startCellX; cx <= endCellX; cx++) {
        const fpCell = floatingLayer.getCell(cx, cy);
        if (!fpCell) continue;

        // Build stamp pixel mask for this cell
        let touched = false;
        for (let ly = 0; ly < CH; ly++) {
          const stampY = cy * CH + ly - y;
          if (stampY < 0 || stampY >= height) continue;
          const row = pixels[stampY];
          if (!row) continue;
          for (let lx = 0; lx < CW; lx++) {
            const stampX = cx * CW + lx - x;
            if (stampX < 0 || stampX >= width) continue;
            if (row[stampX]) {
              fpCell.pixels[ly] |= (1 << (CW - 1 - lx));
              touched = true;
            }
          }
        }

        if (!touched) continue;

        // Attributes inherited from the target (or background) — the
        // starting point for every mode below, since Ink/Paper/Pixels Only
        // only ever change PART of a cell's attributes/pixels and must leave
        // the rest exactly as the target already shows it.
        const targetCell = targetLayer ? targetLayer.getCell(cx, cy) : null;
        const attrSource = (targetCell && targetCell.altered)
          ? targetCell
          : (bgLayer ? bgLayer.getCell(cx, cy) : null);
        const srcInk    = attrSource ? attrSource.ink    : DEFAULT_CELL_ATTRS.ink;
        const srcPaper  = attrSource ? attrSource.paper  : DEFAULT_CELL_ATTRS.paper;
        const srcBright = attrSource ? attrSource.bright : DEFAULT_CELL_ATTRS.bright;
        const srcFlash  = attrSource ? attrSource.flash  : DEFAULT_CELL_ATTRS.flash;

        fpCell.xorReplace = false;

        if (mode === DRAW_MODE.PIXEL_ONLY) {
          // Pixels Only never touches attributes — the floating layer's
          // topmost-attrs-win compositing must be a visual no-op here.
          fpCell.ink = srcInk; fpCell.paper = srcPaper;
          fpCell.bright = srcBright; fpCell.flash = srcFlash;
        } else if (mode === DRAW_MODE.INK) {
          // Ink Recolour never places a pixel shape — undo the mask bits
          // just OR'd in above so the composite shows only the target's own
          // ink, recoloured.
          fpCell.pixels.fill(0);
          fpCell.ink    = colorSelection.inkTransparent ? srcInk : colorSelection.ink;
          fpCell.paper  = srcPaper;
          fpCell.bright = colorSelection.bright;
          fpCell.flash  = colorSelection.flash;
        } else if (mode === DRAW_MODE.PAPER) {
          fpCell.pixels.fill(0);
          fpCell.paper  = colorSelection.paperTransparent ? srcPaper : colorSelection.paper;
          fpCell.ink    = srcInk;
          fpCell.bright = colorSelection.bright;
          fpCell.flash  = colorSelection.flash;
        } else {
          // Normal: ink colour from current selection; paper inherited from
          // target so the stamp does not override the underlying paper.
          fpCell.ink    = colorSelection.ink;
          fpCell.bright = colorSelection.bright;
          fpCell.flash  = colorSelection.flash;
          fpCell.paper  = srcPaper;
        }

        fpCell.altered = true;
        LayerManager.deferCellCompose(cx, cy);
      }
    }
  }

  /**
   * Live preview for the top-bar draw-mode selector's XOR entry — distinct
   * from the per-stamp "XOR mode" checkbox (_drawFloatingLayerXOR): this one
   * applies the CURRENT colour selection to the toggled pixels (mirroring
   * DRAW_MODE.XOR / PixelDrawRoutine._applyXOR on commit) rather than
   * inheriting the target's own attributes untouched. It composites through
   * the same per-cell "replace, don't OR-stack" path as the checkbox
   * (cell.xorReplace, checked by LayerManager._composeCellData) but sets that
   * flag on the CELL rather than the layer, so it never touches the
   * persisted layer.xorMode flag or its UI checkbox.
   * @param {Object} colorSelection
   * @private
   */
  _drawFloatingLayerModeXOR(colorSelection) {
    const { pixels, width, height, x, y, floatingLayer } = this.floatingPaste;
    const targetLayer = this._findTargetBelow(floatingLayer);
    const bgLayer = LayerManager.layers[0];
    const CW = ZX_SPECTRUM.CELL_WIDTH;
    const CH = ZX_SPECTRUM.CELL_HEIGHT;

    const startCellX = Math.max(0, ZX_COORDS.pixelToCell(x, y).x);
    const startCellY = Math.max(0, ZX_COORDS.pixelToCell(x, y).y);
    const endCellX = Math.min(ZX_SPECTRUM.GRID_COLS - 1, ZX_COORDS.pixelToCell(x + width - 1, y).x);
    const endCellY = Math.min(ZX_SPECTRUM.GRID_ROWS - 1, ZX_COORDS.pixelToCell(x, y + height - 1).y);

    for (let cy = startCellY; cy <= endCellY; cy++) {
      for (let cx = startCellX; cx <= endCellX; cx++) {
        const fpCell = floatingLayer.getCell(cx, cy);
        if (!fpCell) continue;
        const targetCell = targetLayer ? targetLayer.getCell(cx, cy) : null;

        const stampMask = new Uint8Array(CH);
        for (let ly = 0; ly < CH; ly++) {
          const py = cy * CH + ly;
          const stampY = py - y;
          if (stampY < 0 || stampY >= height) continue;
          const row = pixels[stampY];
          if (!row) continue;
          for (let lx = 0; lx < CW; lx++) {
            const px = cx * CW + lx;
            const stampX = px - x;
            if (stampX < 0 || stampX >= width) continue;
            if (row[stampX]) stampMask[ly] |= (1 << (CW - 1 - lx));
          }
        }

        let touched = false;
        for (let row = 0; row < CH; row++) { if (stampMask[row]) { touched = true; break; } }
        if (!touched) { fpCell.xorReplace = false; continue; }

        const targetPixels = (targetCell && targetCell.altered) ? targetCell.pixels : null;
        for (let row = 0; row < CH; row++) {
          fpCell.pixels[row] = (targetPixels ? targetPixels[row] : 0) ^ stampMask[row];
        }

        const attrSource = (targetCell && targetCell.altered)
          ? targetCell
          : (bgLayer ? bgLayer.getCell(cx, cy) : null);
        const srcInk    = attrSource ? attrSource.ink    : DEFAULT_CELL_ATTRS.ink;
        const srcPaper  = attrSource ? attrSource.paper  : DEFAULT_CELL_ATTRS.paper;
        const srcBright = attrSource ? attrSource.bright : DEFAULT_CELL_ATTRS.bright;
        const srcFlash  = attrSource ? attrSource.flash  : DEFAULT_CELL_ATTRS.flash;

        // Mirrors _applyXOR exactly: bright/flash only move with whichever
        // colour channel is actually being written; if both ink and paper
        // are transparent, bright/flash are left as the target already has
        // them too.
        const touchesAttrs = !colorSelection.inkTransparent || !colorSelection.paperTransparent;
        fpCell.ink    = colorSelection.inkTransparent   ? srcInk   : colorSelection.ink;
        fpCell.paper  = colorSelection.paperTransparent ? srcPaper : colorSelection.paper;
        fpCell.bright = touchesAttrs ? colorSelection.bright : srcBright;
        fpCell.flash  = touchesAttrs ? colorSelection.flash  : srcFlash;
        fpCell.altered = true;
        fpCell.xorReplace = true;   // this cell IS the final composite for its position — never OR'd with layers below

        LayerManager.deferCellCompose(cx, cy);
      }
    }
  }

  /**
   * Indexed-mode stamp preview (Phase 13): write the stamp's palette
   * indices (or the mask at the current indexed ink) into the floating
   * layer's cell index grids; the compositor's indexed branch then shows
   * the exact committed result. Draw-mode aware like the classic branch:
   * NORMAL/Pixels Only/Ink Recolour all collapse to painting the ink index
   * (indexed cells have no separate ink/paper attribute — _applyIndexed
   * already collapses these three the same way), Paper Recolour paints the
   * paper index, and XOR/XOR_PIXEL toggle per pixel against the target's
   * CURRENT index (a stamp touches each pixel once, so the two share this
   * one preview path — the once-per-stroke gate that tells them apart never
   * comes into play here). Unlike the classic XOR case this needs no
   * compositor "replace" flag: indexed compositing already treats a negative
   * index as transparent/pass-through per pixel, so writing the computed
   * final value (including −1) is already correct.
   * @private
   */
  _drawFloatingLayerIndexed() {
    const { pixels, indices, width, height, x, y, floatingLayer } = this.floatingPaste;
    const CW = ZX_SPECTRUM.CELL_WIDTH;
    const CH = ZX_SPECTRUM.CELL_HEIGHT;
    const inkIdx = ColorManager.getIndexedInk();
    const mode = PixelDrawRoutine.resolveUserMode(true);

    let paperIdx = 0, targetLayer = null;
    if (mode === DRAW_MODE.PAPER || mode === DRAW_MODE.XOR || mode === DRAW_MODE.XOR_PIXEL) {
      paperIdx = ColorManager.getIndexedPaper();
      targetLayer = this._findTargetBelow(floatingLayer);
    }

    for (let py = 0; py < height; py++) {
      const maskRow = pixels[py];
      const idxRow = indices ? indices[py] : null;
      if (!maskRow && !idxRow) continue;
      const cy = y + py;
      if (cy < 0 || cy >= ZX_SPECTRUM.HEIGHT) continue;
      for (let px = 0; px < width; px++) {
        const masked = (idxRow && idxRow[px] != null && idxRow[px] >= 0) || (!idxRow && maskRow && maskRow[px]);
        if (!masked) continue;
        const cx = x + px;
        if (cx < 0 || cx >= ZX_SPECTRUM.WIDTH) continue;

        const carried = (idxRow && idxRow[px] != null && idxRow[px] >= 0) ? idxRow[px] : null;
        let value;
        if (mode === DRAW_MODE.PAPER) {
          value = paperIdx;
        } else if (mode === DRAW_MODE.XOR || mode === DRAW_MODE.XOR_PIXEL) {
          const cand = carried != null ? carried : inkIdx;
          const eraseIdx = (targetLayer && targetLayer.isBackground) ? paperIdx : -1;
          const tCell = targetLayer ? targetLayer.getCell(Math.floor(cx / CW), Math.floor(cy / CH)) : null;
          const current = (tCell && tCell.indices) ? tCell.indices[(cy % CH) * CW + (cx % CW)] : eraseIdx;
          value = current === cand ? eraseIdx : cand;
        } else {
          // NORMAL / PIXEL_ONLY / INK all paint the ink index (or the
          // stamp's own carried index) — identical outcome, so one branch.
          value = carried != null ? carried : inkIdx;
        }

        const cell = floatingLayer.getCell(Math.floor(cx / CW), Math.floor(cy / CH));
        if (!cell || !cell.indices) continue;
        cell.indices[(cy % CH) * CW + (cx % CW)] = value;
        cell.altered = true;
        LayerManager.deferCellCompose(Math.floor(cx / CW), Math.floor(cy / CH));
      }
    }
  }

  /**
   * XOR preview: per-cell, compute target_pixels XOR stamp_mask and copy target's
   * attributes into the floating layer. The compositor's xorMode branch then renders
   * those cells as final (no OR-stacking with anything below).
   * @private
   */
  _drawFloatingLayerXOR() {
    const { pixels, width, height, x, y, floatingLayer } = this.floatingPaste;
    const targetLayer = this._findTargetBelow(floatingLayer);
    if (!targetLayer) return;

    const bgLayer = LayerManager.layers[0];
    const CW = ZX_SPECTRUM.CELL_WIDTH;
    const CH = ZX_SPECTRUM.CELL_HEIGHT;

    const startCellX = Math.max(0, ZX_COORDS.pixelToCell(x, y).x);
    const startCellY = Math.max(0, ZX_COORDS.pixelToCell(x, y).y);
    const endCellX = Math.min(ZX_SPECTRUM.GRID_COLS - 1, ZX_COORDS.pixelToCell(x + width - 1, y).x);
    const endCellY = Math.min(ZX_SPECTRUM.GRID_ROWS - 1, ZX_COORDS.pixelToCell(x, y + height - 1).y);

    for (let cy = startCellY; cy <= endCellY; cy++) {
      for (let cx = startCellX; cx <= endCellX; cx++) {
        const fpCell = floatingLayer.getCell(cx, cy);
        if (!fpCell) continue;
        const targetCell = targetLayer.getCell(cx, cy);

        // Build stamp-shape mask for this cell (one byte per row of 8 pixels)
        const stampMask = new Uint8Array(CH);
        for (let ly = 0; ly < CH; ly++) {
          const py = cy * CH + ly;
          const stampY = py - y;
          if (stampY < 0 || stampY >= height) continue;
          const row = pixels[stampY];
          if (!row) continue;
          for (let lx = 0; lx < CW; lx++) {
            const px = cx * CW + lx;
            const stampX = px - x;
            if (stampX < 0 || stampX >= width) continue;
            if (row[stampX]) stampMask[ly] |= (1 << (CW - 1 - lx));
          }
        }

        // Skip cells that the stamp shape doesn't actually touch
        let touched = false;
        for (let row = 0; row < CH; row++) { if (stampMask[row]) { touched = true; break; } }
        if (!touched) continue;

        // Floating pixels = target XOR stamp; attributes copied from the target
        // (or background if target's cell is unaltered) so colours don't change.
        const targetPixels = (targetCell && targetCell.altered) ? targetCell.pixels : null;
        for (let row = 0; row < CH; row++) {
          fpCell.pixels[row] = (targetPixels ? targetPixels[row] : 0) ^ stampMask[row];
        }

        const attrSource = (targetCell && targetCell.altered)
          ? targetCell
          : (bgLayer ? bgLayer.getCell(cx, cy) : null);
        if (attrSource) {
          fpCell.ink    = attrSource.ink;
          fpCell.paper  = attrSource.paper;
          fpCell.bright = attrSource.bright;
          fpCell.flash  = attrSource.flash;
        }
        fpCell.altered = true;

        LayerManager.deferCellCompose(cx, cy);
      }
    }
  }

  // ─── Clipboard ────────────────────────────────────────────────────────────

  /**
   * Check if clipboard has content
   * @returns {boolean}
   */
  hasClipboard() {
    return this.clipboard !== null;
  }

  /**
   * Get clipboard dimensions
   * @returns {Object|null} { width, height } or null
   */
  getClipboardSize() {
    if (!this.clipboard) return null;
    return {
      width: this.clipboard.width,
      height: this.clipboard.height
    };
  }

  /**
   * Select all (entire canvas)
   */
  selectAll() {
    this.setSelection({
      x: 0,
      y: 0,
      width: ZX_SPECTRUM.WIDTH,
      height: ZX_SPECTRUM.HEIGHT
    });
  }


  /**
   * Move selection by delta
   * @param {number} dx - Delta X
   * @param {number} dy - Delta Y
   */
  moveSelection(dx, dy) {
    if (!this.selection) return;

    const newX = Helpers.clamp(this.selection.x + dx, 0, ZX_SPECTRUM.WIDTH - this.selection.width);
    const newY = Helpers.clamp(this.selection.y + dy, 0, ZX_SPECTRUM.HEIGHT - this.selection.height);

    this.setSelection({
      x: newX,
      y: newY,
      width: this.selection.width,
      height: this.selection.height,
      mask: this.selection.mask
    });
  }
}

window.SelectionService = new SelectionServiceClass();

Logger.debug('SelectionService', 'Selection service loaded');

})(); // End IIFE
