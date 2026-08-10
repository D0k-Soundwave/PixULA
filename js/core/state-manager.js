/**
 * State Manager
 *
 * Centralized state management for the application
 * All application state should flow through this manager
 */

'use strict';

// Wrap in IIFE to prevent class name from polluting global scope
(function() {

// DEFAULT_ZOOM is defined in constants.js

class StateManagerClass {
  constructor() {
    // Initialize state sections
    this._state = {
      // Application state
      app: {
        initialized: false,
        loading: false,
        error: null
      },

      // Current tool
      tool: {
        current: TOOLS.BRUSH,
        previous: null,
        options: {}
      },

      // Current colors
      color: {
        ink: 0,           // 0-7
        paper: 7,         // 0-7
        bright: false,
        flash: false
      },

      // Current layer
      layer: {
        current: 0,
        count: 1
      },

      // Canvas state
      canvas: {
        zoom: DEFAULT_ZOOM,
        panX: 0,
        panY: 0,
        modified: false
      },

      // Grid visibility
      grid: {
        '1x1': false,
        '8x8': true,
        '16x16': false,
        snap: false
      },

      // Selection state
      selection: {
        active: false,
        x: 0,
        y: 0,
        width: 0,
        height: 0
      },

      // Undo/redo state
      history: {
        canUndo: false,
        canRedo: false,
        undoCount: 0,
        redoCount: 0
      },

      // File state
      file: {
        name: null,
        path: null,
        modified: false,
        lastSaved: null
      },

      // UI state
      ui: {
        theme: 'dark',
        language: 'en',
        font: 'jura',
        leftSidebarCollapsed: false,
        rightSidebarCollapsed: false
      },

      // Pointer/cursor state
      pointer: {
        x: 0,
        y: 0,
        cellX: 0,
        cellY: 0,
        isDown: false,
        button: 0
      }
    };

    // State change listeners
    this._listeners = new Map();

    // Bind methods
    this.get = this.get.bind(this);
    this.set = this.set.bind(this);
  }

  /**
   * Get a state value by path
   * @param {string} path - Dot-notation path (e.g., 'tool.current')
   * @returns {*} - State value
   */
  get(path) {
    const parts = path.split('.');
    let value = this._state;

    for (const part of parts) {
      if (value === undefined || value === null) return undefined;
      value = value[part];
    }

    return value;
  }

  /**
   * Set a state value by path
   * @param {string} path - Dot-notation path
   * @param {*} value - Value to set
   * @param {boolean} silent - If true, don't emit change event
   */
  set(path, value, silent = false) {
    const parts = path.split('.');
    const lastPart = parts.pop();
    let target = this._state;

    // Navigate to parent
    for (const part of parts) {
      if (target[part] === undefined) {
        target[part] = {};
      }
      target = target[part];
    }

    const oldValue = target[lastPart];

    // Only update if value changed
    if (oldValue !== value) {
      target[lastPart] = value;

      if (!silent) {
        this._notifyListeners(path, value, oldValue);
      }

      Logger.debug('StateManager', `State changed: ${path}`, { oldValue, newValue: value });
    }
  }

  /**
   * Update multiple state values at once
   * @param {Object} updates - Object with path: value pairs
   * @param {boolean} silent - If true, don't emit change events
   */
  setMultiple(updates, silent = false) {
    for (const [path, value] of Object.entries(updates)) {
      this.set(path, value, silent);
    }
  }

  /**
   * Get a complete state section
   * @param {string} section - Section name (e.g., 'tool', 'color')
   * @returns {Object} - Copy of the section
   */
  getSection(section) {
    const sectionData = this._state[section];
    if (!sectionData) return null;
    return Helpers.deepClone(sectionData);
  }

  /**
   * Set a complete state section
   * @param {string} section - Section name
   * @param {Object} data - New section data
   * @param {boolean} silent - If true, don't emit change events
   */
  setSection(section, data, silent = false) {
    const oldData = this._state[section];
    this._state[section] = { ...data };

    if (!silent) {
      this._notifyListeners(section, data, oldData);
    }
  }

  /**
   * Subscribe to state changes
   * @param {string} path - Path to watch (can be section or full path)
   * @param {Function} callback - Function to call on change
   * @returns {Function} - Unsubscribe function
   */
  subscribe(path, callback) {
    if (!this._listeners.has(path)) {
      this._listeners.set(path, []);
    }

    this._listeners.get(path).push(callback);

    // Return unsubscribe function
    return () => {
      const listeners = this._listeners.get(path);
      if (listeners) {
        const index = listeners.indexOf(callback);
        if (index !== -1) {
          listeners.splice(index, 1);
        }
      }
    };
  }

  /**
   * Notify listeners of state change
   * @private
   */
  _notifyListeners(path, newValue, oldValue) {
    // Notify exact path listeners
    if (this._listeners.has(path)) {
      this._listeners.get(path).forEach(callback => {
        try {
          callback(newValue, oldValue, path);
        } catch (error) {
          Logger.error('StateManager', 'Error in state listener', error);
        }
      });
    }

    // Notify parent path listeners (e.g., 'tool' for 'tool.current')
    const parts = path.split('.');
    while (parts.length > 1) {
      parts.pop();
      const parentPath = parts.join('.');
      if (this._listeners.has(parentPath)) {
        const parentValue = this.getSection(parentPath);
        this._listeners.get(parentPath).forEach(callback => {
          try {
            callback(parentValue, null, path);
          } catch (error) {
            Logger.error('StateManager', 'Error in parent state listener', error);
          }
        });
      }
    }

    // Emit event for global listeners
    EventBus.emit(EVENTS.STATE_CHANGED, { path, newValue, oldValue });
  }

  /**
   * Get the complete state (for debugging)
   * @returns {Object} - Complete state copy
   */
  getState() {
    return Helpers.deepClone(this._state);
  }

  /**
   * Reset state to defaults
   * @param {string} section - Optional section to reset (resets all if not provided)
   */
  reset(section = null) {
    if (section) {
      // Reset specific section
      this._state[section] = this._getDefaultSection(section);
      this._notifyListeners(section, this._state[section], null);
    } else {
      // Reset all state
      this._initializeState();
      EventBus.emit(EVENTS.STATE_RESET);
    }
  }

  /**
   * Save current state to storage
   * @returns {Promise}
   */
  async saveToStorage() {
    const persistentState = {
      tool: this._state.tool.current,
      color: this._state.color,
      canvas: {
        zoom: this._state.canvas.zoom
      },
      grid: this._state.grid,
      ui: this._state.ui
    };

    await Storage.set(Storage.STORES.PREFERENCES, persistentState);
    Logger.info('StateManager', 'State saved to storage');
  }

  /**
   * Load state from storage
   * @returns {Promise}
   */
  async loadFromStorage() {
    try {
      const savedState = await Storage.get(Storage.STORES.PREFERENCES);

      if (savedState) {
        // Restore tool
        if (savedState.tool) {
          this.set('tool.current', savedState.tool, true);
        }

        // Restore colors
        if (savedState.color) {
          this.setSection('color', {
            ...this._state.color,
            ...savedState.color
          }, true);
        }

        // Restore canvas settings
        if (savedState.canvas) {
          this.set('canvas.zoom', savedState.canvas.zoom, true);
        }

        // Restore grid settings
        if (savedState.grid) {
          this.setSection('grid', savedState.grid, true);
        }

        // Restore UI settings
        if (savedState.ui) {
          this.setSection('ui', {
            ...this._state.ui,
            ...savedState.ui
          }, true);
        }

        Logger.info('StateManager', 'State loaded from storage');
      }
    } catch (error) {
      Logger.error('StateManager', 'Failed to load state from storage', error);
    }
  }

  /**
   * Initialize state with defaults
   * @private
   */
  _initializeState() {
    this._state = {
      app: this._getDefaultSection('app'),
      tool: this._getDefaultSection('tool'),
      color: this._getDefaultSection('color'),
      layer: this._getDefaultSection('layer'),
      canvas: this._getDefaultSection('canvas'),
      grid: this._getDefaultSection('grid'),
      selection: this._getDefaultSection('selection'),
      history: this._getDefaultSection('history'),
      file: this._getDefaultSection('file'),
      ui: this._getDefaultSection('ui'),
      pointer: this._getDefaultSection('pointer')
    };
  }

  /**
   * Get default value for a section
   * @private
   */
  _getDefaultSection(section) {
    const defaults = {
      app: { initialized: false, loading: false, error: null },
      tool: { current: TOOLS.BRUSH, previous: null, options: {} },
      color: { ink: 0, paper: 7, bright: false, flash: false },
      layer: { current: 0, count: 1 },
      canvas: { zoom: DEFAULT_ZOOM, panX: 0, panY: 0, modified: false },
      grid: { '1x1': false, '8x8': true, '16x16': false },
      selection: { active: false, x: 0, y: 0, width: 0, height: 0 },
      history: { canUndo: false, canRedo: false, undoCount: 0, redoCount: 0 },
      file: { name: null, path: null, modified: false, lastSaved: null },
      ui: { theme: 'dark', language: 'en', font: 'jura', leftSidebarCollapsed: false, rightSidebarCollapsed: false },
      pointer: { x: 0, y: 0, cellX: 0, cellY: 0, isDown: false, button: 0 }
    };

    return defaults[section] || {};
  }

  // ============================================
  // Convenience methods for common state access
  // ============================================

  /**
   * Get current tool ID
   * @returns {string}
   */
  getCurrentTool() {
    return this.get('tool.current');
  }

  /**
   * Set current tool
   * @param {string} toolId
   */
  setCurrentTool(toolId) {
    const previous = this.get('tool.current');
    this.set('tool.previous', previous);
    this.set('tool.current', toolId);
    EventBus.emit(EVENTS.TOOL_SELECTED, { previousTool: previous, currentTool: toolId });
  }

  /**
   * Get current color selection
   * @returns {Object}
   */
  getColorSelection() {
    return this.getSection('color');
  }

  /**
   * Set INK color
   * @param {number} ink - INK color (0-7)
   * @param {boolean} bright - Optional bright flag
   */
  setInk(ink, bright = null) {
    this.set('color.ink', Validators.sanitizeBaseColor(ink));
    if (bright !== null) {
      this.set('color.bright', Boolean(bright));
    }
    EventBus.emit(EVENTS.COLOR_INK, this.getColorSelection());
  }

  /**
   * Set PAPER color
   * @param {number} paper - PAPER color (0-7)
   */
  setPaper(paper) {
    this.set('color.paper', Validators.sanitizeBaseColor(paper));
    EventBus.emit(EVENTS.COLOR_PAPER, this.getColorSelection());
  }

  /**
   * Get current zoom level
   * @returns {number}
   */
  getZoom() {
    return this.get('canvas.zoom');
  }

  /**
   * Set zoom level
   * @param {number} zoom
   */
  setZoom(zoom) {
    if (Validators.isValidZoom(zoom)) {
      this.set('canvas.zoom', zoom);
      EventBus.emit(EVENTS.CANVAS_ZOOM, { zoom });
    }
  }

  /**
   * Get current layer index
   * @returns {number}
   */
  getCurrentLayerIndex() {
    return this.get('layer.current');
  }

  /**
   * Set current layer
   * @param {number} index
   */
  setCurrentLayer(index) {
    this.set('layer.current', index);
    EventBus.emit(EVENTS.LAYER_SELECTED, { layer: index });
  }

  /**
   * Update pointer position
   * @param {number} x - Pixel X
   * @param {number} y - Pixel Y
   */
  setPointerPosition(x, y) {
    this.set('pointer.x', x, true);
    this.set('pointer.y', y, true);
    const cell = ZX_COORDS.pixelToCell(x, y);
    this.set('pointer.cellX', cell.x, true);
    this.set('pointer.cellY', cell.y, true);
  }

  /**
   * Mark file as modified
   */
  markModified() {
    this.set('file.modified', true);
    this.set('canvas.modified', true);
  }

  /**
   * Mark file as saved
   */
  markSaved() {
    this.set('file.modified', false);
    this.set('file.lastSaved', Date.now());
  }

  /** @returns {boolean} */
  getGridSnap() {
    return this.get('grid.snap') || false;
  }

  /** @param {boolean} enabled */
  setGridSnap(enabled) {
    this.set('grid.snap', !!enabled);
    EventBus.emit(EVENTS.GRID_SNAP_CHANGED, { snap: !!enabled });
  }

  /** @returns {'off'|'h'|'v'|'quad'} Mirror-while-drawing mode */
  getSymmetryMode() {
    return this.get('symmetry.mode') || 'off';
  }

  /** @param {'off'|'h'|'v'|'quad'} mode */
  setSymmetryMode(mode) {
    const valid = ['off', 'h', 'v', 'quad'];
    const next = valid.includes(mode) ? mode : 'off';
    this.set('symmetry.mode', next);
    EventBus.emit(EVENTS.SYMMETRY_CHANGED, { mode: next });
  }

  /**
   * The drawing guide: how the active selection constrains every tool's marks.
   * 'inside' confines marks to the selection (shade within an object);
   * 'outside' protects it and paints everywhere else (shade around one) — the
   * frisket. One mode rather than an enabled+invert pair, because "off but
   * inverted" is not a state that means anything.
   * @returns {'off'|'inside'|'outside'}
   */
  getClipMode() {
    return this.get('clip.mode') || 'off';
  }

  /**
   * How often the document autosaves, in MINUTES. Zero means never.
   *
   * Minutes rather than a checkbox because the right answer is personal and
   * the cost of the wrong one is felt directly: the interval IS how much
   * drawing a crash or a closed tab can destroy. A fixed minute suited nobody
   * in particular - it is too often for someone working from a reference on a
   * slow machine, and not often enough for anyone who has lost work once.
   *
   * Zero is the off switch rather than a separate toggle, because a toggle
   * plus an interval is two controls that can disagree ("enabled: false,
   * every 5 minutes" says nothing a reader can act on).
   * @returns {number} 0..AUTOSAVE_MAX_MINUTES
   */
  getAutosaveMinutes() {
    const raw = this.get('autosaveMinutes');
    if (!Number.isFinite(raw)) return StateManagerClass.AUTOSAVE_DEFAULT_MINUTES;
    return clamp(Math.round(raw), 0, StateManagerClass.AUTOSAVE_MAX_MINUTES);
  }

  /**
   * @param {number} minutes - 0 disables; anything else is clamped into range
   */
  setAutosaveMinutes(minutes) {
    const next = Number.isFinite(minutes)
      ? clamp(Math.round(minutes), 0, StateManagerClass.AUTOSAVE_MAX_MINUTES)
      : StateManagerClass.AUTOSAVE_DEFAULT_MINUTES;
    this.set('autosaveMinutes', next);
    EventBus.emit(EVENTS.AUTOSAVE_INTERVAL_CHANGED, { minutes: next });
    return next;
  }

  /** @param {'off'|'inside'|'outside'} mode */
  setClipMode(mode) {
    const valid = ['off', 'inside', 'outside'];
    const next = valid.includes(mode) ? mode : 'off';
    this.set('clip.mode', next);
    EventBus.emit(EVENTS.CLIP_CHANGED, { mode: next });
  }

  /**
   * The GLOBAL draw mode — the single source of truth for how every drawing
   * tool combines its pixels with what is already on the layer. High-level
   * values (resolved to a DRAW_MODE constant per left/right button via
   * PixelDrawRoutine.resolveUserMode): 'normal', 'ink', 'paper',
   * 'pixel_only', 'xor'.
   * @returns {string}
   */
  getDrawMode() {
    return this.get('draw.mode') || 'normal';
  }

  /**
   * Anything not on the list becomes 'normal'. That is what retires a mode
   * safely: 'attributes_only' was dropped in favour of the Recolour attribute
   * op, and because the mode PERSISTS, a document left in it would otherwise
   * come back after the reload with no button to leave by — every stroke
   * writing attributes and no pixels, which reads as a broken app.
   * @param {string} mode
   */
  setDrawMode(mode) {
    const valid = ['normal', 'ink', 'paper', 'pixel_only', 'xor'];
    const next = valid.includes(mode) ? mode : 'normal';
    this.set('draw.mode', next);
    EventBus.emit(EVENTS.DRAW_MODE_CHANGED, { mode: next });
  }
}

// Create singleton instance and export to window
/*
 * Autosave interval bounds, in minutes.
 *
 * [A] The DEFAULT of 1 is inherited from the fixed 60-second timer this
 * preference replaced, kept so nobody's behaviour changed on upgrade. It is
 * still a guess: what would justify a different number is a measurement of
 * what a save actually costs at the largest screen mode.
 *
 * [C] The MAXIMUM of 60 is one hour, past which "autosave" stops describing
 * the feature - an interval longer than a working session saves nothing, and
 * the artist who wants that wants 0.
 */
StateManagerClass.AUTOSAVE_DEFAULT_MINUTES = 1;
StateManagerClass.AUTOSAVE_MAX_MINUTES = 60;

window.StateManager = new StateManagerClass();
window.StateManagerClass = StateManagerClass;

Logger.debug('StateManager', 'State manager loaded');

})(); // End IIFE
