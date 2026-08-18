/**
 * PixelDrawRoutine
 *
 * THE SINGLE ENTRY POINT FOR ALL PIXEL MODIFICATIONS
 *
 * All tools, all operations, everything that changes pixels
 * MUST go through this class. No exceptions.
 *
 * This ensures:
 * - Consistent 2-color constraint enforcement
 * - Proper undo state capture
 * - Correct layer targeting
 * - Unified event emission
 * - Coordinated canvas rendering
 */

'use strict';

(function() {

class PixelDrawRoutineClass {
  constructor() {
    this.pendingChanges = new Map(); // key: cellY*GRID_COLS+cellX -> {cellX,cellY}
    this.isInBatch = false;
    this._inMirror = false;        // reentrancy guard for symmetry expansion
    this._mirrorSuspend = 0;       // depth counter — see suspendMirror()
    this._clipSuspend = 0;         // depth counter — see suspendClip()
    this._ditherGate = null;       // active thinning predicate — see withDitherGate()
    this._xorStroke = new Set();   // pixels already toggled in this batch — see draw()
  }

  // ── The dither gate (thinning) ─────────────────────────────────────────────
  //
  // The third tool-stroke hook. A brush that wants to thin its own output —
  // the fade dissolving over distance — cannot do it by asking its delegate
  // nicely: `flow` is honoured only by the scattering brushes, so a fade
  // wrapped around hatch or pattern used to draw at full strength and then
  // stop dead at the end of its length, with nothing in between.
  //
  // Rather than teach seven brushes about density, the gate sits where every
  // write already passes. Set it around a delegate's stamp and each pixel is
  // tested on its own coordinates — which is also what makes the dither align
  // between strokes, since the predicate reads canvas-absolute x/y.

  /**
   * Run fn with a per-pixel thinning predicate installed. Any write whose
   * (x, y) the predicate rejects is dropped, exactly as if the brush had not
   * asked for it. Nested calls restore the outer gate; a single write opts out
   * with options.dither === false.
   * @param {Function} predicate - (x, y) => boolean, true to keep the pixel
   * @param {Function} fn
   */
  withDitherGate(predicate, fn) {
    const previous = this._ditherGate;
    this._ditherGate = predicate;
    try {
      return fn();
    } finally {
      this._ditherGate = previous;
    }
  }

  // ── Symmetry (mirror-while-drawing) ────────────────────────────────────────
  //
  // The one hook every tool inherits: draw() expands each write into its
  // mirrored counterparts when StateManager's symmetry mode is on. Axes come
  // from the active screen mode, never hardcoded. Services whose writes are
  // NOT freehand drawing (stamp commit/erase, transforms, attr paint) wrap
  // their loops in suspendMirror() so symmetry stays a tool-stroke feature.

  /**
   * Run fn with every TOOL-STROKE hook suspended — symmetry expansion and the
   * drawing guide (clip). For services whose writes are not freehand strokes
   * (paste/stamp commit, transforms, attribute paint, pattern area fills,
   * map/sprite render-to-canvas): they must write exactly the pixels they
   * compute. Both hooks share one rule, so they share one switch — a service
   * cannot opt out of half of it by accident.
   * Re-entrant; the return value of fn is passed through.
   * @param {Function} fn
   */
  suspendStrokeHooks(fn) {
    this._mirrorSuspend++;
    this._clipSuspend++;
    try {
      return fn();
    } finally {
      this._mirrorSuspend--;
      this._clipSuspend--;
    }
  }

  /**
   * The historical name for suspendStrokeHooks, and the one every service
   * already calls. Kept as public API; it suspends the drawing guide too,
   * because "not a tool stroke" is exactly the same condition.
   * @param {Function} fn
   */
  suspendMirror(fn) {
    return this.suspendStrokeHooks(fn);
  }

  /**
   * The mirrored counterparts of a pixel for the active symmetry mode.
   * 'h' mirrors across the vertical centre axis, 'v' across the horizontal
   * one, 'quad' across both (three extra points). Geometry comes from the
   * active SCREEN_MODES descriptor. The original point is not included;
   * points that coincide with it are dropped.
   * @param {number} x
   * @param {number} y
   * @param {string} mode - 'h' | 'v' | 'quad'
   * @returns {Array<{x: number, y: number}>}
   */
  getMirrorPoints(x, y, mode) {
    const mx = ACTIVE_SCREEN_MODE.width - 1 - x;
    const my = ACTIVE_SCREEN_MODE.height - 1 - y;
    const points = [];
    if (mode === 'h' || mode === 'quad') points.push({ x: mx, y });
    if (mode === 'v' || mode === 'quad') points.push({ x, y: my });
    if (mode === 'quad') points.push({ x: mx, y: my });
    return points.filter(p => p.x !== x || p.y !== y);
  }

  /** @private */
  _expandSymmetry(pixelX, pixelY, colorSelection, mode, options) {
    const sym = window.StateManager && StateManager.getSymmetryMode
      ? StateManager.getSymmetryMode() : 'off';
    if (sym === 'off') return;

    this._inMirror = true;
    try {
      for (const p of this.getMirrorPoints(pixelX, pixelY, sym)) {
        this.draw(p.x, p.y, colorSelection, mode, options);
      }
    } finally {
      this._inMirror = false;
    }
  }

  // ── Clip region (the drawing guide / barrier) ──────────────────────────────
  //
  // A region that confines every pixel write. Because draw() is THE gate, one
  // check contains every tool at once — brush, hatch, fade, spray, fill,
  // shapes, text — rather than each tool reimplementing containment.
  //
  // The documented bulk exceptions (layer flatten/merge, stamp drag preview,
  // io codecs) bypass draw() entirely and are therefore never clipped, which
  // is correct: they reproduce existing data rather than lay down new marks.
  // Services that must write exactly the pixels they compute wrap their loops
  // in suspendClip(), exactly as they do for suspendMirror().
  //
  // The region is READ LAZILY from the active selection rather than mirrored
  // into local state: a cached copy would desync the moment a selection moved,
  // and draw() already reads StateManager the same defensive way. Geometry is
  // SelectionService's: bounds plus an optional bbox-relative mask[ry][rx]
  // (null = the whole rect).

  /**
   * Run fn with the clip suspended — for services that must write exactly the
   * pixels they compute. Re-entrant; fn's return value is passed through.
   * @param {Function} fn
   */
  suspendClip(fn) {
    this._clipSuspend++;
    try {
      return fn();
    } finally {
      this._clipSuspend--;
    }
  }

  /**
   * The active clip region, or null when the guide is off / nothing selected.
   * @returns {Object|null} {x, y, width, height, mask}
   * @private
   */
  _getClipRegion() {
    if (!window.SelectionService || !SelectionService.getSelection) return null;
    return SelectionService.getSelection() || null;
  }

  /** Does (x, y) fall within the region's shape? @private */
  _isInRegion(x, y, region) {
    const inBounds = x >= region.x && x < region.x + region.width &&
                     y >= region.y && y < region.y + region.height;
    if (!inBounds) return false;
    if (!region.mask) return true;            // plain rectangle — all of it counts

    const row = region.mask[y - region.y];
    return !!(row && row[x - region.x]);
  }

  /**
   * Would the drawing guide block a write at (x, y)? False whenever no guide
   * is active, so the check costs one property read in the common case.
   *
   * 'inside' confines marks to the region; 'outside' protects it — the frisket
   * you want when shading AROUND an object rather than within it.
   * @param {number} x
   * @param {number} y
   * @returns {boolean}
   */
  isClipped(x, y) {
    const mode = window.StateManager && StateManager.getClipMode
      ? StateManager.getClipMode() : 'off';
    if (mode === 'off') return false;

    const region = this._getClipRegion();
    if (!region) return false;

    const inside = this._isInRegion(x, y, region);
    return mode === 'outside' ? inside : !inside;
  }

  /**
   * Resolve the GLOBAL draw mode (StateManager) into a concrete DRAW_MODE for
   * a single write, given whether it is an ink (left-button) or paper
   * (right-button/erase) action. Every direct drawing tool routes its
   * NORMAL/ERASE decision through here so the top-bar draw-mode selector
   * governs them all uniformly. Dedicated attribute ops (Swap/Apply) and the
   * eraser tool bypass this and pass their fixed mode.
   * @param {boolean} isInk - true = left-button/ink action, false = paper/erase
   * @returns {string} DRAW_MODE value
   */
  resolveUserMode(isInk) {
    const dm = (window.StateManager && StateManager.getDrawMode)
      ? StateManager.getDrawMode() : 'normal';
    switch (dm) {
      // Pixels Only means exactly that on BOTH buttons, so its right button
      // keeps the attribute-preserving primitive.
      case 'pixel_only':      return isInk ? DRAW_MODE.PIXEL_ONLY : DRAW_MODE.ERASE;
      // Ink / Paper draw are pure attribute recolours — the same on either
      // button (they never place or clear a pixel).
      case 'ink':             return DRAW_MODE.INK;
      case 'paper':           return DRAW_MODE.PAPER;
      case 'xor':             return DRAW_MODE.XOR;
      default:                return isInk ? DRAW_MODE.NORMAL : DRAW_MODE.NORMAL_ERASE;
    }
  }

  /**
   * Draw a pixel
   *
   * This is the ONLY method that should modify pixel data.
   * All tools must call this method.
   *
   * @param {number} pixelX - X coordinate (0-255)
   * @param {number} pixelY - Y coordinate (0-191)
   * @param {Object} colorSelection - { ink, paper, bright, flash }
   * @param {string} mode - DRAW_MODE value (normal, erase, transparent, attributes_only)
   * @param {Object} options - Additional options { layer, skipUndo }
   * @returns {boolean} True if a pixel/attribute write actually happened -
   *   false for anything the gate rejected (bounds, clip, dither, locked/
   *   missing layer, a no-op mode). Callers that need to know whether their
   *   stamp really changed something (not just "was in bounds") read this.
   */
  draw(pixelX, pixelY, colorSelection, mode = DRAW_MODE.NORMAL, options = {}) {
    // Validate coordinates - silently ignore out-of-bounds
    if (!Validators.isValidPixelCoord(pixelX, pixelY)) {
      return false;
    }

    // Symmetry: expand this write into its mirrored counterparts. The
    // _inMirror guard stops recursion; suspendMirror() exempts non-stroke
    // callers; options.mirror === false exempts a single call.
    if (!this._inMirror && this._mirrorSuspend === 0 && options.mirror !== false) {
      this._expandSymmetry(pixelX, pixelY, colorSelection, mode, options);
    }

    // The drawing guide confines every tool's marks. Deliberately placed AFTER
    // the symmetry expansion so each mirrored counterpart is judged on its own
    // position: the invariant is "no ink lands outside the region", not "a
    // stroke that strays outside stops producing its mirror inside".
    if (this._clipSuspend === 0 && options.clip !== false &&
        this.isClipped(pixelX, pixelY)) {
      return false;
    }

    // The dither gate thins a stroke to a density. Placed after the symmetry
    // expansion for the same reason as the clip: each mirrored counterpart is
    // judged at its own coordinates, so the dither pattern stays continuous
    // across the mirror instead of copying the original's holes.
    if (this._ditherGate && options.dither !== false &&
        !this._ditherGate(pixelX, pixelY)) {
      return false;
    }

    // Get target layer
    const layer = options.layer || LayerManager.getCurrentLayer();
    if (!layer) {
      Logger.warn('PixelDrawRoutine', 'No active layer');
      return false;
    }

    // Check if layer is locked
    if (layer.locked) {
      return false;
    }

    // XOR toggles once per STROKE, not once per call. A stroke writes the same
    // pixel many times over — consecutive brush stamps overlap (spacing is half
    // the brush size, and each segment restamps its start point), the pointer
    // moves within one pixel, events arrive coalesced, a shape raster crosses
    // itself — and a second toggle undoes the first. That is why an XOR brush
    // painted a row of stamps instead of a stroke: the overlaps cancelled and
    // only the non-overlapping fringes survived. The batch is the stroke, so
    // each pixel flips on its first write and is inert for the rest of it.
    if (mode === DRAW_MODE.XOR && this.isInBatch) {
      const xorKey = `${layer.id}:${pixelY * ZX_SPECTRUM.WIDTH + pixelX}`;
      if (this._xorStroke.has(xorKey)) return;
      this._xorStroke.add(xorKey);
    }

    // Calculate cell coordinates (cell geometry from the active screen mode)
    const cellX = Math.floor(pixelX / ZX_SPECTRUM.CELL_WIDTH);
    const cellY = Math.floor(pixelY / ZX_SPECTRUM.CELL_HEIGHT);
    const localX = pixelX % ZX_SPECTRUM.CELL_WIDTH;
    const localY = pixelY % ZX_SPECTRUM.CELL_HEIGHT;

    // Get cell data
    const cell = layer.getCell(cellX, cellY);
    if (!cell) return false;

    // Undo capture happens at action boundaries (UndoRedo.beginAction /
    // endAction wraps the whole tool stroke). Individual draw calls do
    // not record state. The `skipUndo` option is accepted for backward
    // compatibility but has no effect in the snapshot model.

    // Indexed modes (pixelDepth > 1, Phase 13): pixels are palette indices,
    // not ink bits — route to the indexed apply and share the compose/emit
    // tail below. Modes that only make sense on attributes are no-ops.
    if (cell.indices) {
      if (!this._applyIndexed(layer, cell, localX, localY, colorSelection, mode)) {
        return false;
      }
    } else {
    // Apply drawing based on mode
    switch (mode) {
      case DRAW_MODE.NORMAL:
        this._applyNormalDraw(cell, localX, localY, colorSelection);
        break;

      case DRAW_MODE.NORMAL_ERASE:
        this._applyNormalErase(cell, localX, localY, colorSelection);
        break;

      case DRAW_MODE.ERASE_ALL:
        this._applyEraseAll(cell, localX, localY, layer);
        break;

      case DRAW_MODE.ERASE:
        this._applyErase(cell, localX, localY);
        break;

      case DRAW_MODE.TRANSPARENT:
        this._applyTransparent(cell, localX, localY);
        break;

      case DRAW_MODE.ATTRIBUTES_ONLY:
        this._applyAttributesOnly(cell, colorSelection);
        break;

      case DRAW_MODE.PIXEL_ONLY:
        this._applyPixelOnly(cell, localX, localY, true);
        break;

      case DRAW_MODE.INK:
        this._applyInkDraw(cell, localX, localY, colorSelection);
        break;

      case DRAW_MODE.PAPER:
        this._applyPaperDraw(cell, localX, localY, colorSelection);
        break;

      case DRAW_MODE.XOR:
        this._applyXOR(cell, localX, localY, colorSelection);
        break;

      default:
        Logger.warn('PixelDrawRoutine', `Unknown draw mode: ${mode}`);
        return false;
    }
    }

    // Defer cell composition to the RAF render pass — each unique cell is
    // composed once per frame regardless of how many pixels were drawn in it.
    LayerManager.deferCellCompose(cellX, cellY);

    // Track changes and emit events
    if (!this.isInBatch) {
      this._emitModified([{ cellX, cellY }]);
    } else {
      // Deduplicate changes within batch — O(1) Map lookup
      const key = cellY * ZX_SPECTRUM.GRID_COLS + cellX;
      if (!this.pendingChanges.has(key)) {
        this.pendingChanges.set(key, { cellX, cellY });
      }
    }

    return true;
  }

  /**
   * Set a pixel directly (convenience method for simple operations)
   *
   * @param {number} pixelX - X coordinate (0-255)
   * @param {number} pixelY - Y coordinate (0-191)
   * @param {boolean} isInk - True for INK color, false for PAPER color
   * @param {Object} colorSelection - { ink, paper, bright, flash }
   * @param {Object} options - Additional options
   */
  setPixel(pixelX, pixelY, isInk, colorSelection, options = {}) {
    const mode = isInk ? DRAW_MODE.NORMAL : DRAW_MODE.ERASE;
    this.draw(pixelX, pixelY, colorSelection, mode, options);
  }

  /**
   * Start a batch operation (multiple pixels, single undo state).
   * Delegates undo capture to UndoRedo.beginAction. Locally tracks
   * `isInBatch` only for change-event deduplication.
   */
  beginBatch(label = null) {
    if (this.isInBatch) {
      Logger.warn('PixelDrawRoutine', 'Already in batch mode');
      return;
    }

    this.isInBatch = true;
    this.pendingChanges.clear();
    this._xorStroke.clear();

    if (window.UndoRedo) UndoRedo.beginAction(label);

    EventBus.emit(EVENTS.PIXEL_BATCH_START);
  }

  /**
   * End a batch operation.
   * Closes the UndoRedo action and emits the consolidated change event.
   */
  endBatch() {
    if (!this.isInBatch) {
      Logger.warn('PixelDrawRoutine', 'Not in batch mode');
      return;
    }

    this.isInBatch = false;
    this._xorStroke.clear();

    // Close the UndoRedo action. If NO cell was modified during the batch
    // (e.g. a stamp click with no valid draw layer below it), cancel instead of
    // commit. This avoids phantom undo entries AND preserves the redo stack —
    // endAction() unconditionally pushes an entry and clears redo, so a no-op
    // batch would otherwise both add an empty step and wipe pending redos.
    if (window.UndoRedo) {
      if (this.pendingChanges.size === 0) {
        UndoRedo.cancelAction();
      } else {
        UndoRedo.endAction();
      }
    }

    // Emit modification event for all changed cells
    if (this.pendingChanges.size > 0) {
      const cells = [...this.pendingChanges.values()];
      this._emitModified(cells);
    }

    this.pendingChanges.clear();

    EventBus.emit(EVENTS.PIXEL_BATCH_END);
  }

  /**
   * Indexed-mode apply (Phase 13). Draw-mode semantics on per-pixel
   * palette indices:
   *   NORMAL / TRANSPARENT / PIXEL_ONLY — write the drawing index (an
   *     explicit `colorSelection.index` wins, else ColorManager's indexed
   *     ink; clipboard/stamp paths pass per-pixel indices through here)
   *   ERASE — transparency index (−1) on upper layers; the indexed paper
   *     on the background (which has no transparency)
   *   PAPER — paint the indexed paper index
   *   XOR — toggle: a pixel already at the drawing index erases, anything
   *     else takes the drawing index (the closest 1-bit-XOR analogue)
   *   ATTRIBUTES_ONLY — no-op (indexed cells have no attributes)
   * @returns {boolean} false when the mode is a no-op
   * @private
   */
  _applyIndexed(layer, cell, localX, localY, colorSelection, mode) {
    const pos = localY * ZX_SPECTRUM.CELL_WIDTH + localX;
    const maxIndex = ZX_SPECTRUM.PALETTE_SIZE - 1;
    const inkIdx = Helpers.clamp(
      colorSelection && colorSelection.index != null
        ? colorSelection.index
        : (window.ColorManager ? ColorManager.getIndexedInk() : 0),
      0, maxIndex);
    const paperIdx = Helpers.clamp(
      window.ColorManager ? ColorManager.getIndexedPaper() : 0, 0, maxIndex);
    const eraseIdx = layer.isBackground ? paperIdx : -1;

    switch (mode) {
      case DRAW_MODE.NORMAL:
      case DRAW_MODE.TRANSPARENT:
      case DRAW_MODE.PIXEL_ONLY:
      case DRAW_MODE.INK:
        cell.indices[pos] = inkIdx;
        break;
      // No attributes exist in an indexed mode, so the three erase flavours
      // collapse to the same thing here.
      case DRAW_MODE.ERASE:
      case DRAW_MODE.NORMAL_ERASE:
      case DRAW_MODE.ERASE_ALL:
        cell.indices[pos] = eraseIdx;
        break;
      case DRAW_MODE.PAPER:
        cell.indices[pos] = paperIdx;
        break;
      case DRAW_MODE.XOR:
        cell.indices[pos] = cell.indices[pos] === inkIdx ? eraseIdx : inkIdx;
        break;
      case DRAW_MODE.ATTRIBUTES_ONLY:
        return false;
      default:
        Logger.warn('PixelDrawRoutine', `Unknown draw mode: ${mode}`);
        return false;
    }

    cell.altered = true;
    return true;
  }

  /**
   * Apply normal draw — set the pixel to INK and paint the cell with BOTH the
   * selected INK and PAPER colours (the full CLUT selection). This is the
   * standard "draw with the current attributes" mode. The ink-transparent /
   * paper-transparent boxes still suppress their respective colour write, so
   * Normal + paper-transparent gives an ink-only mark and Normal +
   * ink-transparent a paper-only one. (The dedicated Paper Draw mode is the
   * built-in ink-transparent variant.)
   * @private
   */
  _applyNormalDraw(cell, localX, localY, colorSelection) {
    // Set pixel as INK (drawn)
    const bitPosition = 7 - localX;
    cell.pixels[localY] |= (1 << bitPosition);

    this._stampAttributes(cell, colorSelection);

    // Mark cell as altered (for layer compositing)
    cell.altered = true;

    // 2-color constraint is inherently enforced by the data structure:
    // - Each pixel is 1 bit (INK or PAPER)
    // - Cell stores only 2 colors (INK + PAPER)
    // - Bright flag applies to both colors equally
    // Therefore, impossible to have 3+ colors in one cell
  }

  /**
   * The cell's ink/paper/bright/flash from the attribute bar.
   *
   * Shared by every mode that colours a cell, so "what does drawing do to the
   * attributes" has ONE answer. The ink/paper transparent boxes suppress their
   * own channel; bright and flash ride with whichever colour is still being
   * written, because on the Spectrum they are bits of the same attribute byte
   * and there is no way to set one colour without them.
   * @private
   */
  _stampAttributes(cell, colorSelection) {
    const inkTransparent = colorSelection.inkTransparent || false;
    const paperTransparent = colorSelection.paperTransparent || false;

    if (!inkTransparent) {
      cell.ink = colorSelection.ink;
    }
    if (!paperTransparent) {
      cell.paper = colorSelection.paper;
    }
    if (!inkTransparent || !paperTransparent) {
      cell.bright = colorSelection.bright;
      cell.flash = colorSelection.flash;
    }
  }

  /**
   * Right button: remove the ink, keep colouring the cell.
   *
   * The mirror of _applyNormalDraw and the reason it exists separately from
   * _applyErase: taking ink away is not the same as declining to colour the
   * cell. On the Spectrum the right button paints PAPER, and the cell still
   * takes the ink/paper/bright/flash you have selected - so a right-button
   * stroke over a differently-coloured area recolours it exactly as a
   * left-button stroke would, it just leaves no ink behind.
   * @private
   */
  _applyNormalErase(cell, localX, localY, colorSelection) {
    const bitPosition = 7 - localX;
    cell.pixels[localY] &= ~(1 << bitPosition);

    this._stampAttributes(cell, colorSelection);
    cell.altered = true;
  }

  /**
   * The eraser TOOL: remove everything, in the order the cell allows.
   *
   * Where the right button recolours as it clears, the eraser undoes the fact
   * that anything was drawn here. It cannot do all of that at once, because
   * attributes belong to all 64 pixels of a cell and some of those pixels may
   * be ink the artist has not erased. So the reset comes in two stages, split
   * by what the remaining ink still needs:
   *
   *   ON CONTACT   paper and flash. Neither is needed to render ink, and both
   *                are what the erased area itself shows - leaving a flashing
   *                coloured background behind an erase is not erasing.
   *   ON THE LAST  ink, and bright with it. Bright is a single bit shared by
   *   PIXEL        both colours, so clearing it early would dim ink that is
   *                still standing - the one thing this staging exists to
   *                avoid. It goes when the ink it belongs to goes.
   *
   * On an upper layer the emptied cell becomes unaltered, which is what makes
   * it transparent again rather than an opaque patch of paper.
   * @private
   */
  _applyEraseAll(cell, localX, localY, layer) {
    const bitPosition = 7 - localX;
    cell.pixels[localY] &= ~(1 << bitPosition);

    // Stage one, on every touch
    cell.paper = DEFAULT_CELL_ATTRS.paper;
    cell.flash = DEFAULT_CELL_ATTRS.flash;

    let empty = true;
    for (let row = 0; row < cell.pixels.length; row++) {
      if (cell.pixels[row] !== 0) { empty = false; break; }
    }

    if (!empty) {
      cell.altered = true;
      return;
    }

    // Stage two: nothing is left that needed the ink colour
    cell.ink = DEFAULT_CELL_ATTRS.ink;
    cell.bright = DEFAULT_CELL_ATTRS.bright;
    // The background has nothing behind it, so it stays painted; an upper
    // layer goes back to showing what is underneath.
    cell.altered = !!(layer && layer.isBackground);
  }

  /**
   * Apply erase (clear the pixel, touch nothing else).
   *
   * The PRIMITIVE, not a user-facing mode. The selection and transform
   * services lift and move pixels with it and must not have attributes
   * rewritten underneath them, and Pixels Only uses it for its right button.
   * The right button in Normal wants _applyNormalErase; the eraser tool wants
   * _applyEraseAll.
   * @private
   */
  _applyErase(cell, localX, localY) {
    // Clear pixel (set to PAPER)
    const bitPosition = 7 - localX;
    cell.pixels[localY] &= ~(1 << bitPosition);

    // Mark cell as altered (for layer compositing)
    cell.altered = true;
  }

  /**
   * Apply transparent draw (set pixel, preserve existing attributes)
   * @private
   */
  _applyTransparent(cell, localX, localY) {
    // Set pixel as INK but don't change colors
    const bitPosition = 7 - localX;
    cell.pixels[localY] |= (1 << bitPosition);

    // Mark cell as altered (for layer compositing)
    cell.altered = true;
  }

  /**
   * Apply attributes only (change colors, don't modify pixels)
   * Respects transparent ink/paper settings
   * @private
   */
  _applyAttributesOnly(cell, colorSelection) {
    this._stampAttributes(cell, colorSelection);

    // Mark cell as altered (for layer compositing)
    cell.altered = true;
  }

  /**
   * Pixel-Only draw — set pixel bit, never touch cell attributes.
   * @private
   */
  _applyPixelOnly(cell, localX, localY, isInk) {
    const bitPosition = 7 - localX;
    if (isInk) {
      cell.pixels[localY] |= (1 << bitPosition);
    } else {
      cell.pixels[localY] &= ~(1 << bitPosition);
    }
    cell.altered = true;
  }

  /**
   * INK draw — replace ONLY the cell's INK colour with the CLUT selection, plus
   * apply the current BRIGHT and FLASH state. The pixel bits and the PAPER
   * colour are left untouched. The mirror image of PAPER draw below.
   * localX/localY unused — ink is a cell-wide attribute.
   * @private
   */
  _applyInkDraw(cell, localX, localY, colorSelection) {
    if (!colorSelection.inkTransparent) {
      cell.ink = colorSelection.ink;
    }
    // BRIGHT/FLASH are set/unset via the same CLUT mechanism as the colour.
    cell.bright = colorSelection.bright;
    cell.flash = colorSelection.flash;
    cell.altered = true;
  }

  /**
   * PAPER draw — replace ONLY the cell's PAPER colour with the CLUT selection,
   * plus apply the current BRIGHT and FLASH state. The pixel bits are untouched
   * (ink pixels stay ink) and the INK colour is left exactly as it was.
   * localX/localY unused — paper is a cell-wide attribute.
   * @private
   */
  _applyPaperDraw(cell, localX, localY, colorSelection) {
    if (!colorSelection.paperTransparent) {
      cell.paper = colorSelection.paper;
    }
    // BRIGHT/FLASH are set/unset via the same CLUT mechanism as the colour.
    cell.bright = colorSelection.bright;
    cell.flash = colorSelection.flash;
    cell.altered = true;
  }

  /**
   * XOR draw — toggle pixel bit (ArtStudio OVER mode). Also updates attributes.
   * @private
   */
  _applyXOR(cell, localX, localY, colorSelection) {
    const bitPosition = 7 - localX;
    cell.pixels[localY] ^= (1 << bitPosition);
    if (!colorSelection.inkTransparent) cell.ink = colorSelection.ink;
    if (!colorSelection.paperTransparent) cell.paper = colorSelection.paper;
    if (!colorSelection.inkTransparent || !colorSelection.paperTransparent) {
      cell.bright = colorSelection.bright;
      cell.flash = colorSelection.flash;
    }
    cell.altered = true;
  }

  /**
   * Emit modification event
   * @private
   */
  _emitModified(cells) {
    EventBus.emit(EVENTS.CANVAS_DIRTY, { cells });
    StateManager.markModified();
  }

  /**
   * Get pixel state at coordinates
   *
   * @param {number} pixelX - X coordinate (0-255)
   * @param {number} pixelY - Y coordinate (0-191)
   * @param {Object} options - { layer }
   * @returns {Object|null} { isInk, cell } or null if out of bounds
   */
  getPixelState(pixelX, pixelY, options = {}) {
    if (!Validators.isValidPixelCoord(pixelX, pixelY)) {
      return null;
    }

    const layer = options.layer || LayerManager.getCurrentLayer();
    if (!layer) return null;

    const cellX = Math.floor(pixelX / ZX_SPECTRUM.CELL_WIDTH);
    const cellY = Math.floor(pixelY / ZX_SPECTRUM.CELL_HEIGHT);
    const localX = pixelX % ZX_SPECTRUM.CELL_WIDTH;
    const localY = pixelY % ZX_SPECTRUM.CELL_HEIGHT;

    const cell = layer.getCell(cellX, cellY);
    if (!cell) return null;

    // Indexed cells report the palette index; `isInk` = pixel is set
    // (non-transparent), so mask-based callers keep working.
    if (cell.indices) {
      const index = cell.indices[localY * ZX_SPECTRUM.CELL_WIDTH + localX];
      return {
        isInk: index >= 0,
        index,
        cell: { ink: cell.ink, paper: cell.paper, bright: cell.bright, flash: cell.flash },
        cellX,
        cellY
      };
    }

    const bitPosition = 7 - localX;
    const isInk = (cell.pixels[localY] >> bitPosition) & 1 ? true : false;

    return {
      isInk,
      cell: {
        ink: cell.ink,
        paper: cell.paper,
        bright: cell.bright,
        flash: cell.flash
      },
      cellX,
      cellY
    };
  }

  /**
   * Draw a horizontal line of pixels
   *
   * Optimized for horizontal line drawing within a single row.
   *
   * @param {number} y - Y coordinate
   * @param {number} x1 - Start X coordinate
   * @param {number} x2 - End X coordinate
   * @param {Object} colorSelection - Color selection
   * @param {string} mode - Draw mode
   * @param {Object} options - Options
   */
  drawHorizontalLine(y, x1, x2, colorSelection, mode = DRAW_MODE.NORMAL, options = {}) {
    const startX = Math.min(x1, x2);
    const endX = Math.max(x1, x2);

    for (let x = startX; x <= endX; x++) {
      this.draw(x, y, colorSelection, mode, options);
    }
  }

  /**
   * Draw a vertical line of pixels
   *
   * @param {number} x - X coordinate
   * @param {number} y1 - Start Y coordinate
   * @param {number} y2 - End Y coordinate
   * @param {Object} colorSelection - Color selection
   * @param {string} mode - Draw mode
   * @param {Object} options - Options
   */
  drawVerticalLine(x, y1, y2, colorSelection, mode = DRAW_MODE.NORMAL, options = {}) {
    const startY = Math.min(y1, y2);
    const endY = Math.max(y1, y2);

    for (let y = startY; y <= endY; y++) {
      this.draw(x, y, colorSelection, mode, options);
    }
  }

  /**
   * Fill a rectangular region
   *
   * @param {number} x - Start X
   * @param {number} y - Start Y
   * @param {number} width - Width
   * @param {number} height - Height
   * @param {Object} colorSelection - Color selection
   * @param {string} mode - Draw mode
   * @param {Object} options - Options
   */
  fillRect(x, y, width, height, colorSelection, mode = DRAW_MODE.NORMAL, options = {}) {
    const endX = x + width;
    const endY = y + height;

    for (let py = y; py < endY; py++) {
      for (let px = x; px < endX; px++) {
        this.draw(px, py, colorSelection, mode, options);
      }
    }
  }

  /**
   * Clear a cell (set all pixels to PAPER, reset attributes to defaults)
   * For non-background layers, this makes the cell unaltered (transparent)
   *
   * @param {number} cellX - Cell X coordinate (0-31)
   * @param {number} cellY - Cell Y coordinate (0-23)
   * @param {Object} options - Options
   */
  clearCell(cellX, cellY, options = {}) {
    if (!Validators.isValidCellCoord(cellX, cellY)) {
      return;
    }

    const layer = options.layer || LayerManager.getCurrentLayer();
    if (!layer || layer.locked) return;

    const cell = layer.getCell(cellX, cellY);
    if (!cell) return;

    // Undo capture happens at action boundaries; clearCell on its own does not
    // open one. Callers that want clearCell undoable must wrap in beginBatch.

    // Reset cell to defaults
    cell.ink = DEFAULT_CELL_ATTRS.ink;
    cell.paper = DEFAULT_CELL_ATTRS.paper;
    cell.bright = DEFAULT_CELL_ATTRS.bright;
    cell.flash = DEFAULT_CELL_ATTRS.flash;
    cell.pixels.fill(0);
    if (cell.indices) {
      cell.indices.fill(layer.isBackground
        ? Helpers.clamp(window.ColorManager ? ColorManager.getIndexedPaper() : 0,
            0, ZX_SPECTRUM.PALETTE_SIZE - 1)
        : -1);
    }

    // For non-background layers, make cell unaltered (transparent)
    // Background layer cells stay altered
    if (!layer.isBackground) {
      cell.altered = false;
    }

    // Re-render using layer composition
    LayerManager.renderCell(cellX, cellY);

    if (!this.isInBatch) {
      this._emitModified([{ cellX, cellY }]);
    } else {
      const key = cellY * ZX_SPECTRUM.GRID_COLS + cellX;
      if (!this.pendingChanges.has(key)) {
        this.pendingChanges.set(key, { cellX, cellY });
      }
    }
  }

  /**
   * Clear the entire canvas
   *
   * @param {Object} options - Options { layer, skipUndo }
   */
  clearAll(options = {}) {
    this.beginBatch();

    for (let cellY = 0; cellY < ZX_SPECTRUM.GRID_ROWS; cellY++) {
      for (let cellX = 0; cellX < ZX_SPECTRUM.GRID_COLS; cellX++) {
        this.clearCell(cellX, cellY, { ...options, skipUndo: true });
      }
    }

    this.endBatch();
  }

}

// Create singleton instance
const PixelDrawRoutineInstance = new PixelDrawRoutineClass();

// Export to global scope
window.PixelDrawRoutine = PixelDrawRoutineInstance;

Logger.debug('PixelDrawRoutine', 'Pixel draw routine loaded');

})(); // End IIFE
