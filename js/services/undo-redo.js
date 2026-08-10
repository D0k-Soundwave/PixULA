'use strict';
(function() {

/**
 * Undo/Redo Manager — snapshot-based.
 *
 * Each entry is a complete snapshot of all drawing layers + the floating
 * paste state + the active selection rectangle, captured at the START of
 * the user-visible action. Undo restores that snapshot; redo restores the
 * snapshot taken at the moment undo was pressed.
 *
 * SIZE. Snapshots store each layer's grid as flat typed arrays rather than in
 * the live per-cell object shape, and an entry keeps only the layers its action
 * actually changed (see LayerManager.packAttributeData / dropUnchangedLayers).
 * Measured 2026-08-07: a one-layer stroke is 8,448 B at STANDARD_ULA and
 * 212,480 B at LAYER2_640, the largest mode. The history is bounded twice —
 * DEFAULT_UNDO_LIMIT entries and MAX_HISTORY_BYTES — because an action that
 * touches every layer costs 32x one that touches a single layer.
 *
 * Public API:
 *   beginAction(label)  — capture before-snapshot, open an action
 *   endAction()         — close action, push entry, clear redo stack
 *   cancelAction()      — discard the open action without pushing
 *   undo()              — restore previous state (silent no-op if stack empty)
 *   redo()              — restore next state (silent no-op if stack empty)
 *   canUndo()/canRedo() — boolean
 *   clear()             — drop all history
 *
 * Backward-compat shims (unchanged callsites in tools and services):
 *   beginBatch()/endBatch()  — alias for beginAction/endAction
 *   captureState(_)          — no-op (legacy cell-level hook)
 *   pushLayerCreate/pushLayerDelete/pushLayerMerge/pushEntry/push — no-op
 */

class UndoRedoManagerClass {
  constructor() {
    this.undoStack = [];
    this.redoStack = [];
    this.maxStates = ZX_SPECTRUM.DEFAULT_UNDO_LIMIT;
    this._actionDepth = 0;
    this._pendingBefore = null;
    this._pendingLabel = null;
  }

  initialize() {
    Storage.get('pref.undoLimit').then(limit => {
      if (limit && Validators.isValidUndoLimit(limit)) {
        this.maxStates = limit;
      }
    });
    Logger.info('UndoRedo', `Initialized with max ${this.maxStates} states`);
  }

  // ─── Action API ──────────────────────────────────────────────────────────

  /**
   * Open an action and capture the before-snapshot.
   * Re-entrant calls increment depth and DO NOT take a fresh snapshot —
   * only the outermost call matters. Pair every beginAction with exactly
   * one endAction (or cancelAction).
   * @param {string} [label] - Optional human-readable label
   */
  beginAction(label = null) {
    if (this._actionDepth === 0) {
      this._pendingBefore = this._captureSnapshot();
      this._pendingLabel = label;
    }
    this._actionDepth++;
  }

  /**
   * Close the current action. Pushes a new entry to the undo stack and
   * clears the redo stack. No-op if state is identical to the before-snapshot.
   */
  endAction() {
    if (this._actionDepth === 0) {
      Logger.warn('UndoRedo', 'endAction called with no open action');
      return;
    }
    this._actionDepth--;
    if (this._actionDepth > 0) return; // nested; only outermost commits

    if (this._pendingBefore) {
      /*
       * Now - and only now - we know what the action touched, so the grids of
       * layers it left alone can go. beginAction runs before the action and
       * cannot know; a snapshot that kept every layer regardless cost 32x more
       * than a one-layer stroke needs (M, 2026-08-07: 6.5 MB against 212 KB at
       * LAYER2_640 with 32 layers).
       *
       * The background is compared the same way, separately, because it is
       * snapshotted outside the layer list.
       */
      if (window.LayerManager) {
        LayerManager.dropUnchangedLayers(this._pendingBefore.layers);

        const bg = LayerManager.getBackgroundLayer();
        if (bg && this._pendingBefore.background &&
            LayerManagerClass.packedGridsEqual(this._pendingBefore.background,
                                               bg.packAttributeData())) {
          this._pendingBefore.background = null;
        }
      }

      this.undoStack.push({
        timestamp: Date.now(),
        label: this._pendingLabel,
        before: this._pendingBefore
      });
      this._pruneStack();
      this.redoStack = [];
    }
    this._pendingBefore = null;
    this._pendingLabel = null;
    this._updateState();
  }

  /**
   * Discard the current action without pushing an entry.
   * Use when an action begins but produces no change (e.g. tool drag with no movement).
   */
  cancelAction() {
    if (this._actionDepth === 0) return;
    this._actionDepth--;
    if (this._actionDepth > 0) return;
    this._pendingBefore = null;
    this._pendingLabel = null;
  }

  /**
   * Put the picture back as it was and discard the current action.
   *
   * cancelAction()'s sibling, and the difference matters: cancelAction drops
   * the HISTORY ENTRY and leaves the pixels where they are, which is right for
   * an action that turned out to change nothing. This one is for an action that
   * changed something it should never have been allowed to change — the palm
   * stroke the OS retracts with a pointercancel — where leaving the marks and
   * merely refusing to record them would be the worst of both: a mark on the
   * picture that Undo cannot reach.
   *
   * Nested calls behave as cancelAction does: only the outermost reverts,
   * because only the outermost holds the before-snapshot.
   *
   * @returns {boolean} true when the picture was actually rolled back
   */
  revertAction() {
    if (this._actionDepth === 0) return false;
    this._actionDepth--;
    if (this._actionDepth > 0) return false;

    const before = this._pendingBefore;
    this._pendingBefore = null;
    this._pendingLabel = null;
    if (!before) return false;

    this._restoreSnapshot(before);
    this._updateState();
    return true;
  }

  /**
   * The newest entry on the undo stack, or null. An IDENTITY token, not a
   * count: a caller asking "did my action land an entry" cannot use the stack
   * DEPTH, because endAction prunes (_pruneStack shifts the oldest off once the
   * limit is reached), so at a full stack a push leaves the length unchanged.
   * @returns {Object|null}
   */
  peekLast() {
    return this.undoStack.length ? this.undoStack[this.undoStack.length - 1] : null;
  }

  /**
   * Undo the newest entry and DELETE it — no redo counterpart.
   *
   * undo()'s sibling for a change that should never have been recorded at all:
   * the palm stroke the OS retracts. Plain undo() would push the palm's marks
   * onto the redo stack, so Redo would light up out of nowhere and Ctrl+Y would
   * re-apply exactly what the platform just decided was never intentional.
   * @returns {boolean} true when something was rolled back
   */
  revertLast() {
    if (this.undoStack.length === 0) return false;
    const entry = this.undoStack.pop();
    this._restoreSnapshot(entry.before);
    this._updateState();
    return true;
  }

  /** True if currently inside an open action. */
  isActionOpen() {
    return this._actionDepth > 0;
  }

  // ─── Undo / Redo ─────────────────────────────────────────────────────────

  /**
   * Undo the last action. Silent no-op if stack is empty —
   * never replays old state when there is nothing left to undo.
   */
  undo() {
    if (this.undoStack.length === 0) return;
    if (this._actionDepth > 0) {
      Logger.warn('UndoRedo', 'undo() called while an action is open — auto-cancelling');
      this.cancelAction();
    }

    const entry = this.undoStack.pop();
    const currentSnapshot = this._captureSnapshot();
    const counterpart = { timestamp: entry.timestamp, label: entry.label,
                          before: currentSnapshot };
    this.redoStack.push(counterpart);

    this._restoreSnapshot(entry.before);

    // Trim the counterpart AFTER the restore, which is the first moment we can
    // tell what this undo actually changed. Without it a redo entry is a full
    // snapshot of every layer however small the action was, so undoing a long
    // run of cheap one-layer strokes would convert a 106 MB undo stack into a
    // 3.4 GB redo stack (C, at LAYER2_640 with 32 layers) - and the budget in
    // _pruneStack never sees the redo side.
    this._dropUnchangedFrom(counterpart);

    this._updateState();
    EventBus.emit(EVENTS.HISTORY_UNDO);
  }

  /**
   * Redo the last undone action. Silent no-op if redo stack is empty.
   */
  redo() {
    if (this.redoStack.length === 0) return;
    if (this._actionDepth > 0) {
      Logger.warn('UndoRedo', 'redo() called while an action is open — auto-cancelling');
      this.cancelAction();
    }

    const entry = this.redoStack.pop();
    const currentSnapshot = this._captureSnapshot();
    const counterpart = { timestamp: entry.timestamp, label: entry.label,
                          before: currentSnapshot };
    this.undoStack.push(counterpart);

    this._restoreSnapshot(entry.before);
    this._dropUnchangedFrom(counterpart);   // see undo(): same reason
    this._updateState();
    EventBus.emit(EVENTS.HISTORY_REDO);
  }

  canUndo() { return this.undoStack.length > 0; }
  canRedo() { return this.redoStack.length > 0; }

  /** Drop all history. Called by the undo-limit setter and by file-new flows. */
  clear() {
    this.undoStack = [];
    this.redoStack = [];
    this._actionDepth = 0;
    this._pendingBefore = null;
    this._pendingLabel = null;
    this._updateState();
  }

  getUndoCount() { return this.undoStack.length; }
  getRedoCount() { return this.redoStack.length; }

  setMaxStates(limit) {
    if (Validators.isValidUndoLimit(limit)) {
      this.maxStates = limit;
      this._pruneStack();
      Storage.set('pref.undoLimit', limit);
    }
  }

  // ─── Snapshot capture / restore ──────────────────────────────────────────

  /**
   * Capture the complete app state at this moment.
   * Since Phase 12a the snapshot also carries the active screen mode, the
   * ULAplus palette registers and the background layer's grid, so one Undo
   * across a mode switch restores the previous mode AND content. Phase 12b
   * added the Timex hi-res colour scheme (layer gigaScreen tags ride inside
   * the layer states).
   * @returns {Object} { screenModeId, ulaplusRegisters, timexHiresInk, background, layers, floatingPaste, selection }
   * @private
   */
  _captureSnapshot() {
    const snap = {
      screenModeId: window.ACTIVE_SCREEN_MODE ? ACTIVE_SCREEN_MODE.id : null,
      // Register files: null is a REAL state (pristine defaults) and must
      // restore as null, or an action that seeds a palette from pristine
      // (mode-switch seeding, a .pal import) survives its own undo.
      ulaplusRegisters: null,
      nextRegisters: null,
      timexHiresInk: null,
      background: null,
      layers: null,
      floatingPaste: null,
      selection: null
    };
    if (window.ColorManager && ColorManager.ulaplusRegisters) {
      snap.ulaplusRegisters = Array.from(ColorManager.ulaplusRegisters);
    }
    // Phase 13: the Next RGB333 register file (document state in rgb333 modes)
    if (window.ColorManager && ColorManager.nextRegisters) {
      snap.nextRegisters = Array.from(ColorManager.nextRegisters);
    }
    if (window.ColorManager && typeof ColorManager.getTimexHiresInk === 'function') {
      snap.timexHiresInk = ColorManager.getTimexHiresInk();
    }
    if (window.LayerManager) {
      snap.layers = LayerManager.captureAllLayersState();
      const bg = LayerManager.getBackgroundLayer();
      if (bg) snap.background = bg.packAttributeData();
    }
    if (window.SelectionService) {
      if (typeof SelectionService.captureFloatingState === 'function') {
        snap.floatingPaste = SelectionService.captureFloatingState();
      }
      const sel = SelectionService.getSelection();
      snap.selection = sel ? { x: sel.x, y: sel.y, width: sel.width, height: sel.height } : null;
    }
    return snap;
  }

  /**
   * Restore the complete app state from a snapshot.
   * Mode first (raw, no conversion — the layer data that follows already
   * matches the snapshot's geometry), then palette, then content.
   * @private
   */
  _restoreSnapshot(snap) {
    if (!snap) return;
    if (snap.screenModeId && window.ScreenModeService
        && snap.screenModeId !== ACTIVE_SCREEN_MODE.id) {
      ScreenModeService.applyModeRaw(snap.screenModeId);
    }
    if (window.ColorManager && 'ulaplusRegisters' in snap
        && typeof ColorManager.setUlaplusRegisters === 'function') {
      // null restores the pristine-defaults state (see _captureSnapshot)
      ColorManager.setUlaplusRegisters(snap.ulaplusRegisters);
    }
    if (window.ColorManager && 'nextRegisters' in snap
        && typeof ColorManager.setNextRegisters === 'function') {
      ColorManager.setNextRegisters(snap.nextRegisters);
    }
    if (window.ColorManager && snap.timexHiresInk !== null
        && snap.timexHiresInk !== undefined
        && typeof ColorManager.setTimexHiresInk === 'function') {
      ColorManager.setTimexHiresInk(snap.timexHiresInk);
    }
    if (snap.layers && window.LayerManager) {
      // Background first — restoreAllLayersState ends with a full
      // recompose, which must already see the restored background.
      if (snap.background) {
        const bg = LayerManager.getBackgroundLayer();
        if (bg) bg.restoreAttributeData(snap.background);
      }
      LayerManager.restoreAllLayersState(snap.layers);
    }
    if (window.SelectionService) {
      if (typeof SelectionService.restoreFloatingState === 'function') {
        SelectionService.restoreFloatingState(snap.floatingPaste);
      }
      // Set selection without triggering side effects beyond the canvas re-render
      if (snap.selection) {
        SelectionService.setSelection(snap.selection);
      } else {
        SelectionService.clear();
      }
    }
    if (window.CanvasSystem) {
      if (typeof LayerManager.flushPendingCompose === 'function') {
        LayerManager.flushPendingCompose();
      }
      CanvasSystem.requestRender();
    }
  }

  /**
   * Prune the history on TWO limits: a count, and a byte budget.
   *
   * The count alone is the wrong lever, because entries are not the same size.
   * A stroke on one layer keeps one grid; an action that touches every layer -
   * a mode switch, a transform over a multi-layer selection - keeps them all.
   * [M] 2026-08-07 at LAYER2_640 with 32 layers: 212,480 B for the first,
   * 6,799,360 B for the second, a 32x spread. [C] So 500 entries is ~101 MB of
   * ordinary drawing but ~3.2 GB if every one of them were an all-layer action.
   *
   * The budget bounds that. Depth is what the artist asked for and is honoured
   * wherever it is affordable; the budget only bites on the pathological
   * sequence, and bites oldest-first, which is the end of the history nobody
   * reaches for.
   * @private
   */
  /**
   * Drop the grids in an entry that match the CURRENT document.
   *
   * The same trimming endAction does, applied to the counterpart entry undo
   * and redo push onto the opposite stack. Those are captured before the
   * restore, so they can only be trimmed after it - at which point "unchanged"
   * means "this step did not touch that layer", which is exactly what we want
   * to stop storing.
   * @private
   */
  _dropUnchangedFrom(entry) {
    if (!entry || !entry.before || !window.LayerManager) return;

    LayerManager.dropUnchangedLayers(entry.before.layers);

    const bg = LayerManager.getBackgroundLayer();
    if (bg && entry.before.background &&
        LayerManagerClass.packedGridsEqual(entry.before.background, bg.packAttributeData())) {
      entry.before.background = null;
    }
    // The cached size is stale once grids have gone
    delete entry._bytes;
  }

  _pruneStack() {
    while (this.undoStack.length > this.maxStates) {
      this.undoStack.shift();
    }

    let total = 0;
    for (const entry of this.undoStack) total += UndoRedoManagerClass.entryBytes(entry);

    // Never drop below a usable history, however large single entries are:
    // a budget that could prune to nothing would make undo unreliable exactly
    // when the document is biggest.
    while (total > UndoRedoManagerClass.MAX_HISTORY_BYTES &&
           this.undoStack.length > UndoRedoManagerClass.MIN_HISTORY_ENTRIES) {
      total -= UndoRedoManagerClass.entryBytes(this.undoStack.shift());
    }
  }

  _updateState() {
    StateManager.setMultiple({
      'history.canUndo': this.canUndo(),
      'history.canRedo': this.canRedo(),
      'history.undoCount': this.undoStack.length,
      'history.redoCount': this.redoStack.length
    });
  }

  // ─── Backward-compat shims ───────────────────────────────────────────────
  // These exist so the rest of the codebase can keep using the old names
  // without churn. They all map onto the action API above (or no-op for
  // calls that the snapshot system makes redundant).

  beginBatch(label = null) { this.beginAction(label); }
  endBatch()                { this.endAction(); }

  /**
   * Legacy cell-level capture hook. The snapshot system makes this redundant —
   * undo state is captured at action boundaries, not per draw. Calls are
   * accepted but ignored.
   */
  captureState(_state) { /* no-op */ }

  /**
   * Legacy push hook used by I/O formats with `{type: 'layerReplace', ...}`.
   * Equivalent under the snapshot system: the caller should wrap its work
   * in beginAction/endAction. We accept the call but do nothing — the I/O
   * sites have been updated to use the action API directly.
   */
  push(_op) { /* no-op */ }
  pushEntry(_type, _data) { /* no-op */ }
  pushLayerCreate(_layerId, _createdIndex) { /* no-op */ }
  pushLayerDelete(_layerState, _deletedIndex) { /* no-op */ }
  pushLayerMerge(_before, _after) { /* no-op */ }
}

/**
 * How much memory the undo history may hold, across all entries.
 *
 * [C] 256 MB. The reference point is the largest document the app can make:
 * LAYER2_640 with 32 layers is 6,799,360 B if an action touches every one of
 * them (M, 2026-08-07), so the budget holds ~37 of those, or ~1,200 ordinary
 * one-layer strokes at that mode, or the full 500 many times over at any
 * classic mode (8,448 B an entry). It is a ceiling on the pathological case,
 * not a limit anyone drawing will meet.
 *
 * Chosen against what a browser tab can carry rather than what the artwork
 * needs: 256 MB is large enough to be invisible in normal work and small
 * enough that a tab holding it is not the reason a machine starts swapping.
 */
UndoRedoManagerClass.MAX_HISTORY_BYTES = 256 * 1024 * 1024;

/**
 * The floor the byte budget may never prune past.
 *
 * [A] Ten. A budget that could empty the history would make undo unreliable
 * exactly when the document is largest, which is when the artist most needs
 * it. Ten steps back is the least that still feels like an undo history.
 */
UndoRedoManagerClass.MIN_HISTORY_ENTRIES = 10;

/**
 * Roughly what an entry occupies, summed over its packed typed arrays.
 *
 * Counts the grids, which are the only part big enough to matter - the
 * scalars, names and register files are a few hundred bytes beside a
 * 212 KB layer. Cached on the entry: pruning walks the whole stack, and the
 * packed arrays never change once an entry is pushed.
 * @param {Object} entry
 * @returns {number}
 */
UndoRedoManagerClass.entryBytes = function(entry) {
    if (!entry) return 0;
    if (entry._bytes !== undefined) return entry._bytes;

    const gridBytes = (g) => {
        if (!g) return 0;
        let n = 0;
        for (const key of ['ink', 'paper', 'flags', 'pixels', 'indices', 'transparent']) {
            if (g[key]) n += g[key].byteLength;
        }
        return n;
    };

    let total = gridBytes(entry.before && entry.before.background);
    const layers = entry.before && entry.before.layers && entry.before.layers.layers;
    if (Array.isArray(layers)) {
        for (const state of layers) total += gridBytes(state.attributeData);
    }

    entry._bytes = total;
    return total;
};

window.UndoRedo = new UndoRedoManagerClass();
window.UndoRedoService = window.UndoRedo; // Alias for I/O system

Logger.debug('UndoRedo', 'Snapshot-based undo/redo loaded');

})();
