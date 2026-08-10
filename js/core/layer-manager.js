/**
 * Layer Manager
 *
 * Implements multi-layer system with composition for ZX Spectrum-compliant drawing.
 * Each layer has its own attribute grid; the grid geometry (GRID_COLS ×
 * GRID_ROWS cells of CELL_WIDTH × CELL_HEIGHT pixels) is a LIVE read of the
 * active screen mode — 32×24 8×8 cells in standard ULA, down to 32×192 8×1
 * cells in multicolor mode. Cell pixel rows are one byte each (attrCellW is
 * 8 in every classic mode), so cell.pixels.length === CELL_HEIGHT.
 */

'use strict';

(function() {

/**
 * Layer class - represents a single drawing layer
 *
 * Layer system:
 * - Layer 0 (background): Has default paper color (white), all cells are "altered"
 * - Layer 1+: Cells start as "unaltered" (transparent)
 * - When a cell is drawn, it becomes "altered" with the palette colors
 * - Compositing: Ink pixels stack (OR), attributes come from topmost altered cell
 */
class LayerClass {
  /**
   * Create a new layer
   * @param {number} index - Layer index in stack
   * @param {string} [name] - Optional layer name
   * @param {boolean} [isBackground] - True if this is the background layer (layer 0)
   * @param {number} [id] - Optional layer ID (assigned by LayerManager)
   */
  constructor(index, name = null, isBackground = false, id = null) {
    this.id = id; // Stable unique ID (assigned by LayerManager)
    this.index = index;
    this.name = name || (isBackground ? 'Background' : `Layer ${index}`);
    this.visible = true;
    this.opacity = 100;
    this.locked = isBackground; // Background layer is locked by default
    this.isBackground = isBackground;
    this.isStamp = false; // Stamp layers are repositionable brush-stamp objects
    this.xorMode = false; // When true, stamp commit/preview XORs against target layer below
    // GigaScreen sub-screen tag (0 = screen A, 1 = screen B) — only
    // meaningful when the active mode has screens === 2; cleared when the
    // document leaves GigaScreen mode. The background layer is shared by
    // both sub-screens and its tag stays 0.
    this.gigaScreen = 0;

    // Stamp data — only set when isStamp = true
    // { mask: bool[][], x, y, w, h, colorSelection }
    this.stamp = null;

    // Each layer has its own attribute grid (geometry from the active mode)
    this.attributeData = [];
    this._initializeAttributeData();
  }

  /**
   * Initialize the attribute grid at the active mode's geometry
   * Background layer: all cells altered with default paper (white)
   * Other layers: all cells unaltered (transparent)
   *
   * Indexed modes (pixelDepth > 1, Phase 13): cells carry per-pixel palette
   * indices instead of a 1-bit row bitmask — `indices` is an
   * Int16Array(cellW*cellH), −1 = transparent (upper layers) and the
   * default paper index on the background. The classic attr fields stay at
   * their defaults for structural compatibility but carry no meaning.
   * @private
   */
  _initializeAttributeData() {
    const cellH = ZX_SPECTRUM.CELL_HEIGHT;
    const cellW = ZX_SPECTRUM.CELL_WIDTH;
    const indexed = ZX_SPECTRUM.PIXEL_DEPTH > 1;
    this.attributeData = [];
    for (let y = 0; y < ZX_SPECTRUM.GRID_ROWS; y++) {
      const row = [];
      for (let x = 0; x < ZX_SPECTRUM.GRID_COLS; x++) {
        const cell = {
          ink: DEFAULT_CELL_ATTRS.ink,
          paper: DEFAULT_CELL_ATTRS.paper,
          bright: DEFAULT_CELL_ATTRS.bright,
          flash: DEFAULT_CELL_ATTRS.flash,
          pixels: new Uint8Array(cellH),
          altered: this.isBackground  // Background cells are always "altered"
        };
        if (indexed) {
          cell.indices = new Int16Array(cellW * cellH)
            .fill(this.isBackground ? NEXTRGB333.DEFAULT_PAPER : -1);
        }
        row.push(cell);
      }
      this.attributeData.push(row);
    }
  }

  /**
   * Get a cell's data
   * @param {number} cellX - Cell X coordinate (0-31)
   * @param {number} cellY - Cell Y coordinate (0-23)
   * @returns {Object|null} Cell data or null if out of bounds
   */
  getCell(cellX, cellY) {
    if (!Validators.isValidCellCoord(cellX, cellY)) return null;
    return this.attributeData[cellY][cellX];
  }

  /**
   * Check if a cell has been altered (drawn on)
   * @param {number} cellX - Cell X coordinate (0-31)
   * @param {number} cellY - Cell Y coordinate (0-23)
   * @returns {boolean} True if cell is altered
   */
  isCellAltered(cellX, cellY) {
    const cell = this.getCell(cellX, cellY);
    return cell ? cell.altered : false;
  }

  /**
   * Set a cell's data and mark it as altered
   * @param {number} cellX - Cell X coordinate (0-31)
   * @param {number} cellY - Cell Y coordinate (0-23)
   * @param {Object} data - Cell data to merge
   */
  setCell(cellX, cellY, data) {
    if (!Validators.isValidCellCoord(cellX, cellY)) return;
    const cell = this.attributeData[cellY][cellX];
    if (data.ink !== undefined) cell.ink = data.ink;
    if (data.paper !== undefined) cell.paper = data.paper;
    if (data.bright !== undefined) cell.bright = data.bright;
    if (data.flash !== undefined) cell.flash = data.flash;
    if (data.pixels) cell.pixels = new Uint8Array(data.pixels);
    if (data.indices) cell.indices = Int16Array.from(data.indices);
    if (data.altered !== undefined) {
      cell.altered = data.altered;
    } else {
      // Setting cell data marks it as altered (unless explicitly set to false)
      cell.altered = true;
    }
  }

  /**
   * Mark a cell as altered without changing its data
   * @param {number} cellX - Cell X coordinate (0-31)
   * @param {number} cellY - Cell Y coordinate (0-23)
   */
  markCellAltered(cellX, cellY) {
    const cell = this.getCell(cellX, cellY);
    if (cell) cell.altered = true;
  }

  /**
   * Clear a cell back to unaltered state (transparent)
   * @param {number} cellX - Cell X coordinate (0-31)
   * @param {number} cellY - Cell Y coordinate (0-23)
   */
  clearCell(cellX, cellY) {
    if (this.isBackground) return; // Cannot clear background cells
    const cell = this.getCell(cellX, cellY);
    if (cell) {
      cell.ink = DEFAULT_CELL_ATTRS.ink;
      cell.paper = DEFAULT_CELL_ATTRS.paper;
      cell.bright = DEFAULT_CELL_ATTRS.bright;
      cell.flash = DEFAULT_CELL_ATTRS.flash;
      cell.pixels = new Uint8Array(ZX_SPECTRUM.CELL_HEIGHT);
      if (cell.indices) cell.indices.fill(-1);
      cell.altered = false;
    }
  }

  /**
   * Get the pixel state (ink or paper) at a specific coordinate
   * @param {number} pixelX - Pixel X coordinate (0-255)
   * @param {number} pixelY - Pixel Y coordinate (0-191)
   * @returns {boolean} True if pixel is INK, false if PAPER
   */
  getPixelState(pixelX, pixelY) {
    const cellX = Math.floor(pixelX / ZX_SPECTRUM.CELL_WIDTH);
    const cellY = Math.floor(pixelY / ZX_SPECTRUM.CELL_HEIGHT);
    const localX = pixelX % ZX_SPECTRUM.CELL_WIDTH;
    const localY = pixelY % ZX_SPECTRUM.CELL_HEIGHT;

    const cell = this.getCell(cellX, cellY);
    if (!cell) return false;

    if (cell.indices) {
      // Indexed cell: "ink" = any set (non-transparent) index
      return cell.indices[localY * ZX_SPECTRUM.CELL_WIDTH + localX] >= 0;
    }
    const bitPosition = 7 - localX;
    return (cell.pixels[localY] >> bitPosition) & 1 ? true : false;
  }

  /**
   * The palette index at a pixel in an indexed-mode layer (Phase 13).
   * @param {number} pixelX
   * @param {number} pixelY
   * @returns {number} Palette index, or −1 for transparent / out of bounds / classic cells
   */
  getPixelIndex(pixelX, pixelY) {
    const cell = this.getCell(
      Math.floor(pixelX / ZX_SPECTRUM.CELL_WIDTH),
      Math.floor(pixelY / ZX_SPECTRUM.CELL_HEIGHT));
    if (!cell || !cell.indices) return -1;
    return cell.indices[
      (pixelY % ZX_SPECTRUM.CELL_HEIGHT) * ZX_SPECTRUM.CELL_WIDTH
        + (pixelX % ZX_SPECTRUM.CELL_WIDTH)];
  }

  /**
   * Write the palette index at a pixel in an indexed-mode layer and mark
   * the cell altered (bulk-path counterpart of setPixelState; io/ codecs
   * and services use it inside their documented bulk exceptions).
   * @param {number} pixelX
   * @param {number} pixelY
   * @param {number} index - Palette index, −1 = transparent
   */
  setPixelIndex(pixelX, pixelY, index) {
    const cell = this.getCell(
      Math.floor(pixelX / ZX_SPECTRUM.CELL_WIDTH),
      Math.floor(pixelY / ZX_SPECTRUM.CELL_HEIGHT));
    if (!cell || !cell.indices) return;
    cell.indices[
      (pixelY % ZX_SPECTRUM.CELL_HEIGHT) * ZX_SPECTRUM.CELL_WIDTH
        + (pixelX % ZX_SPECTRUM.CELL_WIDTH)] = index;
    cell.altered = true;
  }

  /**
   * Set a pixel state (ink or paper) and mark cell as altered
   * @param {number} pixelX - Pixel X coordinate (0-255)
   * @param {number} pixelY - Pixel Y coordinate (0-191)
   * @param {boolean} isInk - True for INK, false for PAPER
   */
  setPixelState(pixelX, pixelY, isInk) {
    const cellX = Math.floor(pixelX / ZX_SPECTRUM.CELL_WIDTH);
    const cellY = Math.floor(pixelY / ZX_SPECTRUM.CELL_HEIGHT);
    const localX = pixelX % ZX_SPECTRUM.CELL_WIDTH;
    const localY = pixelY % ZX_SPECTRUM.CELL_HEIGHT;

    const cell = this.getCell(cellX, cellY);
    if (!cell) return;

    const bitPosition = 7 - localX;
    if (isInk) {
      cell.pixels[localY] |= (1 << bitPosition);
    } else {
      cell.pixels[localY] &= ~(1 << bitPosition);
    }
    // Mark cell as altered when pixels are changed
    cell.altered = true;
  }

  /**
   * Clear the layer to default state
   */
  clear() {
    this._initializeAttributeData();
  }

  /**
   * Clone this layer's attribute data (for undo/redo)
   * @returns {Array} Deep copy of attribute data
   */
  cloneAttributeData() {
    const clone = [];
    for (let y = 0; y < ZX_SPECTRUM.GRID_ROWS; y++) {
      const row = [];
      for (let x = 0; x < ZX_SPECTRUM.GRID_COLS; x++) {
        const cell = this.attributeData[y][x];
        const copy = {
          ink: cell.ink,
          paper: cell.paper,
          bright: cell.bright,
          flash: cell.flash,
          pixels: new Uint8Array(cell.pixels),
          altered: cell.altered
        };
        if (cell.indices) copy.indices = new Int16Array(cell.indices);
        row.push(copy);
      }
      clone.push(row);
    }
    return clone;
  }

  /**
   * Restore attribute data from a snapshot
   * Directly copies all cell properties for reliable restoration
   * @param {Array} data - Attribute data to restore
   */
  /**
   * The grid as flat typed arrays, for an UNDO SNAPSHOT.
   *
   * `cloneAttributeData()` reproduces the live shape: one object per cell, each
   * wrapping its own `Uint8Array(cellH)` and, in indexed modes, its own
   * `Int16Array`. That shape is right for drawing - every consumer in the app
   * reads cells that way - and wrong for storing fifty copies of, because the
   * wrappers cost more than the pixels. At LAYER2_640 a layer is 2,560 cell
   * objects and 5,120 typed-array wrappers to hold 82 KB of picture (M,
   * 2026-08-07: 1.63 MB serialized per layer).
   *
   * This is the same information in six flat arrays, so a snapshot costs about
   * what the picture costs. Nothing else in the app sees this form: the live
   * model is unchanged, and `unpackAttributeData` puts it back exactly.
   *
   * Indices carry -1 for transparent, which does not fit a byte alongside
   * 0..255, so transparency travels as its own bitmask rather than widening
   * every index to 16 bits for the sake of one sentinel.
   * @returns {Object} packed grid
   */
  packAttributeData() {
    const rows = ZX_SPECTRUM.GRID_ROWS, cols = ZX_SPECTRUM.GRID_COLS;
    const cells = rows * cols;
    const cellH = ZX_SPECTRUM.CELL_HEIGHT;

    const probe = this.attributeData[0] && this.attributeData[0][0];
    const tile = probe && probe.indices ? probe.indices.length : 0;

    const packed = {
      packed: true,
      rows, cols, cellH, tile,
      ink: new Uint8Array(cells),
      paper: new Uint8Array(cells),
      /*
       * bit 0 bright, bit 1 flash, bit 2 altered, bit 3 attributes DEFINED.
       *
       * That last bit exists because a cell's ink/paper/bright/flash can be
       * `undefined` rather than a value, and a Uint8Array cannot hold the
       * difference - it would store 0 and hand back black ink. A snapshot has
       * to return the document as it was, not as it should have been: silently
       * repairing state on undo is a behaviour change hiding inside a memory
       * optimisation. Found 2026-08-07 by a round-trip check.
       */
      flags: new Uint8Array(cells),
      pixels: new Uint8Array(cells * cellH),
      indices: tile ? new Uint8Array(cells * tile) : null,
      transparent: tile ? new Uint8Array(Math.ceil(cells * tile / 8)) : null
    };

    let c = 0;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++, c++) {
        const cell = this.attributeData[y][x];
        const defined = cell.ink !== undefined;
        if (defined) {
          packed.ink[c] = cell.ink;
          packed.paper[c] = cell.paper;
        }
        packed.flags[c] = (cell.bright ? 1 : 0) | (cell.flash ? 2 : 0) |
                          (cell.altered ? 4 : 0) | (defined ? 8 : 0);
        packed.pixels.set(cell.pixels, c * cellH);

        if (!tile || !cell.indices) continue;
        const base = c * tile;
        for (let i = 0; i < tile; i++) {
          const v = cell.indices[i];
          if (v < 0) {
            const bit = base + i;
            packed.transparent[bit >> 3] |= 1 << (bit & 7);
          } else {
            packed.indices[base + i] = v;
          }
        }
      }
    }
    return packed;
  }

  /**
   * Put a packed grid back into the live cell objects.
   * The grid already exists at the right geometry (applyModeRaw rebuilds it
   * before a cross-mode restore), so this fills rather than allocates.
   * @param {Object} p - output of packAttributeData
   */
  unpackAttributeData(p) {
    if (!p || !p.packed) return;
    const rows = Math.min(p.rows, ZX_SPECTRUM.GRID_ROWS);
    const cols = Math.min(p.cols, ZX_SPECTRUM.GRID_COLS);
    const cellH = p.cellH;

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const c = y * p.cols + x;
        const cell = this.attributeData[y][x];
        if (!cell) continue;

        const flags = p.flags[c];
        if (flags & 8) {
          cell.ink = p.ink[c];
          cell.paper = p.paper[c];
          cell.bright = (flags & 1) !== 0;
          cell.flash = (flags & 2) !== 0;
        } else {
          cell.ink = undefined;
          cell.paper = undefined;
          cell.bright = undefined;
          cell.flash = undefined;
        }
        cell.altered = (flags & 4) !== 0;

        cell.pixels = p.pixels.slice(c * cellH, c * cellH + cellH);

        if (p.tile && cell.indices) {
          const base = c * p.tile;
          for (let i = 0; i < p.tile && i < cell.indices.length; i++) {
            const bit = base + i;
            cell.indices[i] = (p.transparent[bit >> 3] & (1 << (bit & 7)))
              ? -1 : p.indices[base + i];
          }
        } else if (cell.indices) {
          // A classic-mode snapshot restored into an indexed grid: the mode
          // switch has already re-seeded it, so clear rather than guess.
          cell.indices.fill(this.isBackground ? NEXTRGB333.DEFAULT_PAPER : -1);
        }
      }
    }
  }

  restoreAttributeData(data) {
    // Snapshots arrive packed; duplicate/flatten still pass the live array form
    if (data && data.packed) { this.unpackAttributeData(data); return; }
    if (!data || !Array.isArray(data)) return;
    for (let y = 0; y < ZX_SPECTRUM.GRID_ROWS; y++) {
      if (!data[y]) continue;
      for (let x = 0; x < ZX_SPECTRUM.GRID_COLS; x++) {
        const source = data[y][x];
        if (!source) continue;

        const cell = this.attributeData[y][x];
        // Direct property copy - no conditional checks
        cell.ink = source.ink;
        cell.paper = source.paper;
        cell.bright = source.bright;
        cell.flash = source.flash;
        cell.altered = source.altered;

        // Ensure pixels are properly copied as Uint8Array
        if (source.pixels) {
          if (source.pixels instanceof Uint8Array) {
            cell.pixels = new Uint8Array(source.pixels);
          } else if (Array.isArray(source.pixels) || source.pixels.length !== undefined) {
            // Handle if pixels was converted to regular array
            cell.pixels = new Uint8Array(source.pixels);
          } else {
            cell.pixels = new Uint8Array(ZX_SPECTRUM.CELL_HEIGHT);
          }
        } else {
          cell.pixels = new Uint8Array(ZX_SPECTRUM.CELL_HEIGHT);
        }

        // Indexed-mode cells (Phase 13): restore the per-pixel index grid.
        // A snapshot from an indexed mode always carries `indices`; one from
        // a classic mode never does — mismatches only occur mid-restore of a
        // cross-mode snapshot, where applyModeRaw re-initialises the grid
        // first, so simply dropping a stale field either way is correct.
        if (source.indices && source.indices.length !== undefined) {
          cell.indices = Int16Array.from(source.indices);
        } else if (cell.indices) {
          cell.indices.fill(this.isBackground ? NEXTRGB333.DEFAULT_PAPER : -1);
        }
      }
    }
  }
}

/**
 * LayerManager class - manages the layer stack
 * Implements Krita/GIMP-style selection:
 * - Single "active" layer for drawing (currentLayerIndex)
 * - Multi-selection for batch operations (selectedLayers Set)
 * - Shift+click for range selection
 * - Ctrl+click for toggle selection
 */
class LayerManagerClass {
  constructor() {
    this.layers = [];
    // `currentLayerIndex` is the focused layer — can be a stamp. Drives stamp
    // engagement in input-handler and the `.current` highlight in the UI.
    this.currentLayerIndex = 0;
    // `activeDrawLayerIndex` is the regular drawing layer that the brush draws
    // into and that stamps commit pixels to. Never points at a stamp or the
    // background. Updated only when the user clicks a drawing layer.
    this.activeDrawLayerIndex = 0;
    this.maxLayers = ZX_SPECTRUM.MAX_LAYERS;
    // Multi-selection for batch operations (Set of layer indices)
    this.selectedLayers = new Set();
    // Last clicked layer for Shift+click range selection
    this.lastClickedIndex = 0;
    // Stable layer ID system for undo/redo
    this._nextLayerId = 1;
    this._layerIdMap = new Map(); // id -> layer
    // Cells queued for composition on the next RAF render pass
    this._pendingComposeCells = new Set();
    // Cells whose composite attribute has FLASH set. Maintained by
    // composeCellToCanvas; driven by the flash clock below.
    this._flashingCells = new Set();
    // Current phase of the ZX FLASH attribute. When true, flashed cells
    // render with INK/PAPER swapped. Toggled by the flash clock.
    this._flashInverted = false;
    this._flashClockId = null;
    // GigaScreen canvas view: 'blend' (flicker average), 'a' or 'b'.
    // Session view state, only read when the mode has screens === 2.
    this._gigaView = 'blend';
    this._startFlashClock();
  }

  /**
   * Start the global ZX FLASH clock.
   *
   * The real hardware swaps INK/PAPER on flagged cells every 16 frames at
   * 50Hz (320ms). We mirror that: toggle the phase and re-compose only the
   * cells that currently render as flashing. Re-composition must go through
   * deferCellCompose (not markCellDirty) — markCellDirty only re-blits the
   * existing imageData, it does not re-run composeCellToCanvas.
   *
   * The clock runs for the lifetime of the singleton; the toggle is a cheap
   * no-op while no cell is flashing.
   * @private
   */
  _startFlashClock() {
    if (this._flashClockId !== null) return;
    this._flashClockId = setInterval(() => {
      this._flashInverted = !this._flashInverted;
      if (this._flashingCells.size === 0) return;
      for (const key of this._flashingCells) {
        const comma = key.indexOf(',');
        const cx = key.substring(0, comma) | 0;
        const cy = key.substring(comma + 1) | 0;
        this.deferCellCompose(cx, cy);
      }
    }, 320);
  }

  /**
   * Initialize the layer manager with background + one drawing layer
   * Layer 0: Background (default paper color, locked)
   * Layer 1: First drawing layer (transparent cells)
   */
  initialize() {
    this.layers = [];
    this.currentLayerIndex = 1; // Start on layer 1 (first drawing layer)
    this.activeDrawLayerIndex = 1;
    this.selectedLayers.clear();
    this.lastClickedIndex = 1;
    // Reset layer ID system
    this._nextLayerId = 1;
    this._layerIdMap.clear();
    // Drop any flash-tracking from a previous document
    this._flashingCells.clear();

    // Create background layer (layer 0) - always present
    this._createBackgroundLayer();

    // Create first drawing layer (layer 1) - don't push to undo during initialization
    this.addLayer('Layer 1', false);
    this.selectedLayers.add(1);

    Logger.info('LayerManager', 'Initialized with background + 1 drawing layer');
  }

  /**
   * Create the background layer (layer 0)
   * This layer provides the default paper color and cannot be deleted
   * @private
   */
  _createBackgroundLayer() {
    const layerId = this._nextLayerId++;
    const bgLayer = new LayerClass(0, 'Background', true, layerId); // isBackground = true
    this._layerIdMap.set(layerId, bgLayer);
    this.layers.push(bgLayer);
    StateManager.set('layer.count', this.layers.length);
  }

  /**
   * Get the background layer
   * @returns {Layer} The background layer (layer 0)
   */
  getBackgroundLayer() {
    return this.layers[0];
  }

  /**
   * Set the background paper color
   * @param {number} colorIndex - Color index (0-15, where 0-7 are normal, 8-15 are bright)
   */
  setBackgroundColor(colorIndex) {
    const bgLayer = this.layers[0];
    if (!bgLayer) return;

    // Determine paper color and bright flag
    const isBright = colorIndex >= 8;
    const paper = isBright ? colorIndex - 8 : colorIndex;

    // Default ink is the contrast color: white on black background, black on all others
    const defaultInk = (paper === 0) ? 7 : 0;

    // Update all cells in background layer
    for (let cellY = 0; cellY < ZX_SPECTRUM.GRID_ROWS; cellY++) {
      for (let cellX = 0; cellX < ZX_SPECTRUM.GRID_COLS; cellX++) {
        const cell = bgLayer.getCell(cellX, cellY);
        if (cell) {
          cell.paper = paper;
          cell.ink = defaultInk;
          cell.bright = isBright;
          // Indexed modes: the background is a flat index fill (the default
          // rgb333 palette holds the classic 16 in entries 0–15, so the
          // classic colour picker maps 1:1).
          if (cell.indices) {
            cell.indices.fill(Math.min(colorIndex, ZX_SPECTRUM.PALETTE_SIZE - 1));
          }
        }
      }
    }

    // If no drawing has happened yet (new image state), also update
    // paper and ink values in the first drawing layer so the brush matches
    if (this._isNewImageState()) {
      const drawLayer = this.layers[1];
      if (drawLayer) {
        for (let cellY = 0; cellY < ZX_SPECTRUM.GRID_ROWS; cellY++) {
          for (let cellX = 0; cellX < ZX_SPECTRUM.GRID_COLS; cellX++) {
            const cell = drawLayer.getCell(cellX, cellY);
            if (cell) {
              cell.paper = paper;
              cell.ink = defaultInk;
              cell.bright = isBright;
            }
          }
        }
      }
    }

    // Sync sidebar ink and paper selection to match background defaults
    if (window.ColorManager) {
      ColorManager.setInk(defaultInk);
      ColorManager.setPaper(paper);
      ColorManager.setBright(isBright);
    }

    // Re-compose and render the entire canvas
    this.composeToCanvas();
    CanvasSystem.requestRender();
    StateManager.markModified();

    Logger.debug('LayerManager', `Background color set to ${colorIndex} (paper: ${paper}, bright: ${isBright})`);
  }

  /**
   * Check if image is in new/undrawn state (no altered cells in any drawing layer)
   * @returns {boolean} True if no drawing layer cells have been altered
   * @private
   */
  _isNewImageState() {
    for (let i = 1; i < this.layers.length; i++) {
      const layer = this.layers[i];
      for (let cellY = 0; cellY < ZX_SPECTRUM.GRID_ROWS; cellY++) {
        for (let cellX = 0; cellX < ZX_SPECTRUM.GRID_COLS; cellX++) {
          const cell = layer.getCell(cellX, cellY);
          if (cell && cell.altered) return false;
        }
      }
    }
    return true;
  }

  /**
   * Add a new drawing layer (transparent cells)
   * @param {string} [name] - Optional layer name
   * @param {boolean} [pushToUndo=true] - Whether to push to undo stack
   * @returns {Layer|null} The new layer or null if max layers reached
   */
  addLayer(name = null, pushToUndo = true) {
    if (this.layers.length >= this.maxLayers) {
      Logger.warn('LayerManager', `Maximum layers (${this.maxLayers}) reached`);
      return null;
    }

    if (pushToUndo && window.UndoRedo) UndoRedo.beginAction('Add layer');

    // Insert BELOW any stamp layers so stamps stay topmost
    let insertIndex = this.layers.length;
    for (let i = 1; i < this.layers.length; i++) {
      if (this.layers[i].isStamp) { insertIndex = i; break; }
    }

    const layerId = this._nextLayerId++;
    const layer = new LayerClass(insertIndex, name, false, layerId);
    this._layerIdMap.set(layerId, layer);
    this.layers.splice(insertIndex, 0, layer);
    this._reindexLayers();

    StateManager.set('layer.count', this.layers.length);
    EventBus.emit(EVENTS.LAYER_CREATED, { layer: layer.index, layerId: layerId, name: layer.name });

    if (pushToUndo && window.UndoRedo) UndoRedo.endAction();

    return layer;
  }

  /**
   * Create a stamp layer — always appended above all regular layers.
   * @param {string} name
   * @returns {Layer|null}
   */
  createStampLayer(name) {
    if (this.layers.length >= this.maxLayers) return null;
    // Caller (SelectionService.startFloatingPaste) wraps the whole paste in a
    // single UndoRedo action — no separate undo entry for the layer creation.
    const layerId = this._nextLayerId++;
    const layer = new LayerClass(this.layers.length, name, false, layerId);
    layer.isStamp = true;
    // GigaScreen: preview the stamp on the sub-screen it will commit to
    const current = this.getCurrentLayer();
    if (current) layer.gigaScreen = current.gigaScreen || 0;
    this._layerIdMap.set(layerId, layer);
    this.layers.push(layer); // Always topmost
    this._reindexLayers();
    StateManager.set('layer.count', this.layers.length);
    EventBus.emit(EVENTS.LAYER_CREATED, { layer: layer.index, layerId: layerId, name: layer.name });
    return layer;
  }

  /**
   * Remove a layer by index
   * Cannot remove the background layer (index 0) or last drawing layer
   * @param {number} index - Layer index to remove
   * @param {boolean} [pushToUndo=true] - Whether to push to undo stack
   * @returns {boolean} True if removed successfully
   */
  removeLayer(index, pushToUndo = true) {
    // Cannot remove background layer
    if (index === 0) {
      Logger.warn('LayerManager', 'Cannot remove background layer');
      return false;
    }

    // Must keep at least background + 1 drawing layer
    if (this.layers.length <= 2) {
      Logger.warn('LayerManager', 'Cannot remove last drawing layer');
      return false;
    }

    if (index < 0 || index >= this.layers.length) {
      Logger.warn('LayerManager', `Invalid layer index: ${index}`);
      return false;
    }

    const layer = this.layers[index];

    if (pushToUndo && window.UndoRedo) UndoRedo.beginAction('Delete layer');

    this.layers.splice(index, 1);
    this._layerIdMap.delete(layer.id);

    // Reindex remaining layers
    this._reindexLayers();

    // Adjust current layer index if needed (never select background)
    this._adjustCurrentLayerIndex();

    StateManager.set('layer.count', this.layers.length);
    EventBus.emit(EVENTS.LAYER_DELETED, { index, layerId: layer.id });

    if (pushToUndo && window.UndoRedo) UndoRedo.endAction();

    return true;
  }

  /**
   * Get the currently selected layer
   * @returns {Layer} The current layer
   */
  getCurrentLayer() {
    return this.layers[this.currentLayerIndex];
  }

  /**
   * Set the current layer by index
   * @param {number} index - Layer index to select
   */
  setCurrentLayer(index) {
    if (index < 0 || index >= this.layers.length) {
      Logger.warn('LayerManager', `Invalid layer index: ${index}`);
      return;
    }
    // Cannot set background layer as current drawing layer
    if (index === 0) {
      Logger.warn('LayerManager', 'Cannot set background layer as current');
      return;
    }
    this.currentLayerIndex = index;
    const layer = this.layers[index];
    // Track activeDrawLayerIndex only when the focused layer is a regular
    // drawing layer — stamps engage but don't change the commit target.
    if (layer && !layer.isStamp) {
      this.activeDrawLayerIndex = index;
    }
    this.lastClickedIndex = index;
    StateManager.set('layer.current', index);
    EventBus.emit(EVENTS.LAYER_SELECTED, { layer: index });
  }

  /**
   * Handle layer click with keyboard modifiers (Krita/GIMP style)
   * @param {number} index - Layer index clicked
   * @param {boolean} ctrlKey - Ctrl/Cmd key pressed
   * @param {boolean} shiftKey - Shift key pressed
   */
  handleLayerClick(index, ctrlKey = false, shiftKey = false) {
    if (index < 0 || index >= this.layers.length) return;
    // Cannot interact with background layer
    if (index === 0) return;

    if (shiftKey && this.lastClickedIndex !== undefined) {
      // Shift+click: range selection (skip background layer 0)
      const lo = Math.min(this.lastClickedIndex, index);
      const start = lo < 1 ? 1 : lo;
      const end = Math.max(this.lastClickedIndex, index);
      for (let i = start; i <= end; i++) {
        this.selectedLayers.add(i);
      }
    } else if (ctrlKey) {
      // Ctrl+click: toggle selection without changing active layer
      if (this.selectedLayers.has(index)) {
        this.selectedLayers.delete(index);
      } else {
        this.selectedLayers.add(index);
      }
    } else {
      // Normal click: clear other selections, add this one.
      // currentLayerIndex tracks the focused layer (can be a stamp) so
      // input-handler's stamp-mode engagement works. activeDrawLayerIndex
      // tracks the last clicked drawing layer — that's where stamps commit
      // pixels and what the regular brush draws into.
      this.selectedLayers.clear();
      this.selectedLayers.add(index);
      this.currentLayerIndex = index;
      const layer = this.layers[index];
      if (layer && !layer.isStamp) {
        this.activeDrawLayerIndex = index;
      }
      StateManager.set('layer.current', index);
    }

    this.lastClickedIndex = index;
    EventBus.emit(EVENTS.LAYER_SELECTED, {
      layer: this.currentLayerIndex,
      selected: Array.from(this.selectedLayers)
    });
  }

  /**
   * Check if a layer is selected for batch operations
   * @param {number} index - Layer index
   * @returns {boolean}
   */
  isLayerSelected(index) {
    return this.selectedLayers.has(index);
  }

  /**
   * Get all selected layer indices
   * @returns {number[]} Array of selected layer indices
   */
  getSelectedLayers() {
    return Array.from(this.selectedLayers).sort((a, b) => a - b);
  }

  /**
   * Clear all layer selections
   */
  clearSelection() {
    this.selectedLayers.clear();
    EventBus.emit(EVENTS.LAYER_SELECTED, {
      layer: this.currentLayerIndex,
      selected: []
    });
  }

  /**
   * Select all layers
   */
  selectAllLayers() {
    for (let i = 0; i < this.layers.length; i++) {
      this.selectedLayers.add(i);
    }
    EventBus.emit(EVENTS.LAYER_SELECTED, {
      layer: this.currentLayerIndex,
      selected: Array.from(this.selectedLayers)
    });
  }

  /**
   * Get a layer by index
   * @param {number} index - Layer index
   * @returns {Layer|null} The layer or null if not found
   */
  getLayer(index) {
    return this.layers[index] || null;
  }

  /**
   * Get a layer by its stable ID
   * @param {number} id - Layer ID
   * @returns {Layer|null} The layer or null if not found
   */
  getLayerById(id) {
    return this._layerIdMap.get(id) || null;
  }

  /**
   * Capture full layer state for undo/redo
   * @param {Layer} layer - Layer to capture
   * @returns {Object} Complete layer state
   * @private
   */
  _captureLayerState(layer) {
    return {
      id: layer.id,
      index: layer.index,
      name: layer.name,
      visible: layer.visible,
      opacity: layer.opacity,
      locked: layer.locked,
      isBackground: layer.isBackground,
      isStamp: layer.isStamp || false,
      xorMode: layer.xorMode || false,
      gigaScreen: layer.gigaScreen || 0,
      stamp: layer.stamp ? {
        x: layer.stamp.x, y: layer.stamp.y,
        w: layer.stamp.w, h: layer.stamp.h,
        colorSelection: layer.stamp.colorSelection,
        mask: layer.stamp.mask ? layer.stamp.mask.map(r => [...r]) : null
      } : null,
      // PACKED: this feeds undo snapshots, which are held fifty deep in
      // memory. getAllLayers() keeps the array form for autosave, which is
      // JSON-persisted and must stay plain.
      attributeData: layer.packAttributeData()
    };
  }

  /**
   * Capture complete state of all drawing layers (excludes background)
   * Used for full-snapshot undo/redo of layer operations
   * @returns {Object} { layerCount, layers: [...layerStates] }
   */
  captureAllLayersState() {
    const layers = [];
    // Skip background (index 0), capture all drawing layers
    for (let i = 1; i < this.layers.length; i++) {
      layers.push(this._captureLayerState(this.layers[i]));
    }
    return {
      layerCount: this.layers.length - 1, // Exclude background
      currentLayerIndex: this.currentLayerIndex,
      activeDrawLayerIndex: this.activeDrawLayerIndex,
      layers: layers
    };
  }

  /**
   * Restore complete state of all drawing layers from snapshot
   * Removes all existing drawing layers and recreates from snapshot
   * @param {Object} snapshot - { layerCount, layers: [...layerStates] }
   */
  restoreAllLayersState(snapshot) {
    if (!snapshot || !snapshot.layers) return;

    /*
     * A layer whose grid the action never touched carries `attributeData:
     * null` (see dropUnchangedLayers). Its pixels are already correct in the
     * live layer, so we REUSE that object rather than rebuild it from data the
     * snapshot deliberately did not keep.
     *
     * Safe because a layer is only marked unchanged while it still exists, and
     * any later action that deletes it stores its grid in ITS OWN entry - so
     * undoing back past that point recreates the layer before this entry is
     * reached.
     */
    const existing = new Map(this.layers.map((l) => [l.id, l]));

    // Remove all existing drawing layers (keep background)
    while (this.layers.length > 1) {
      const layer = this.layers.pop();
      this._layerIdMap.delete(layer.id);
    }

    // Recreate layers from snapshot
    for (const layerState of snapshot.layers) {
      const reusable = layerState.attributeData === null && existing.get(layerState.id);
      const layer = reusable
        ? this._applyLayerProperties(reusable, layerState)
        : this._createLayerFromState(layerState);
      this.layers.push(layer);
      this._layerIdMap.set(layer.id, layer);

      // Ensure _nextLayerId stays ahead of restored IDs
      if (layer.id >= this._nextLayerId) {
        this._nextLayerId = layer.id + 1;
      }
    }

    // Reindex and update state
    this._reindexLayers();
    this.currentLayerIndex = snapshot.currentLayerIndex || 1;
    if (this.currentLayerIndex >= this.layers.length) {
      this.currentLayerIndex = this.layers.length - 1;
    }
    if (this.currentLayerIndex < 1 && this.layers.length > 1) {
      this.currentLayerIndex = 1;
    }

    this.activeDrawLayerIndex = snapshot.activeDrawLayerIndex || 1;
    this._adjustCurrentLayerIndex(); // also clamps activeDrawLayerIndex

    // Update selection
    this.selectedLayers.clear();
    this.selectedLayers.add(this.currentLayerIndex);

    StateManager.set('layer.count', this.layers.length);
    StateManager.set('layer.current', this.currentLayerIndex);

    this.composeToCanvas();
    CanvasSystem.requestRender();
    EventBus.emit(EVENTS.LAYER_CREATED, { layer: -1 }); // Signal UI refresh
  }

  /**
   * Create a layer from captured state
   * @param {Object} state - Captured layer state
   * @returns {Layer} New layer with restored state
   * @private
   */
  _createLayerFromState(state) {
    const layer = new LayerClass(state.index, state.name, state.isBackground, state.id);
    this._applyLayerProperties(layer, state);
    layer.restoreAttributeData(state.attributeData);
    return layer;
  }

  /**
   * Everything about a layer EXCEPT its pixels.
   *
   * Split out so a REUSED layer - one the action never drew on - gets its
   * name, visibility, lock and stamp restored without its grid being rebuilt
   * from data the snapshot deliberately did not keep.
   * @private
   */
  _applyLayerProperties(layer, state) {
    layer.name = state.name;
    layer.visible = state.visible;
    layer.opacity = state.opacity;
    layer.locked = state.locked;
    layer.isStamp = state.isStamp || false;
    layer.xorMode = state.xorMode || false;
    layer.gigaScreen = state.gigaScreen || 0;
    layer.stamp = state.stamp ? {
      x: state.stamp.x, y: state.stamp.y,
      w: state.stamp.w, h: state.stamp.h,
      colorSelection: state.stamp.colorSelection,
      mask: state.stamp.mask ? state.stamp.mask.map(r => [...r]) : null
    } : null;
    return layer;
  }

  /**
   * Drop the grids of layers the action never changed.
   *
   * Called at endAction, because that is the first moment we know what an
   * action touched - beginAction runs before it happens. Works by COMPARING
   * rather than by the write paths notifying us: a missed notification would
   * silently corrupt an undo, and there are several legitimate ways to write a
   * layer (the draw gate, flatten/merge, stamp commit, the io codecs). A
   * comparison cannot miss one.
   *
   * Only a layer that STILL EXISTS may be marked unchanged. A deleted one has
   * changed by definition and keeps its data, which is what makes the reuse in
   * restoreAllLayersState safe.
   * @param {Object} snapshot - output of captureAllLayersState, mutated in place
   * @returns {number} how many layer grids were dropped
   */
  dropUnchangedLayers(snapshot) {
    if (!snapshot || !snapshot.layers) return 0;
    let dropped = 0;

    for (const state of snapshot.layers) {
      const live = this._layerIdMap.get(state.id);
      if (!live || !state.attributeData) continue;
      if (!LayerManagerClass.packedGridsEqual(state.attributeData, live.packAttributeData())) {
        continue;
      }
      state.attributeData = null;
      dropped++;
    }
    return dropped;
  }

  /**
   * Restore a layer from captured state at a specific index
   * Used by undo system to restore deleted layers
   * @param {Object} state - Captured layer state
   * @param {number} atIndex - Index to insert the layer at
   * @returns {Layer} The restored layer
   */
  _restoreLayer(state, atIndex) {
    const layer = this._createLayerFromState(state);
    this.layers.splice(atIndex, 0, layer);
    this._layerIdMap.set(layer.id, layer);
    this._reindexLayers();

    StateManager.set('layer.count', this.layers.length);
    this.composeToCanvas();
    EventBus.emit(EVENTS.LAYER_CREATED, { layer: layer.index, layerId: layer.id, name: layer.name });

    return layer;
  }

  /**
   * Remove a layer without pushing to undo stack
   * Used by undo/redo system for layer operations
   * @param {number} index - Layer index to remove
   * @returns {boolean} True if removed successfully
   */
  _removeLayerWithoutUndo(index) {
    const layer = this.layers[index];
    if (!layer || layer.isBackground) return false;

    this.layers.splice(index, 1);
    this._layerIdMap.delete(layer.id);
    this._reindexLayers();
    this._adjustCurrentLayerIndex();

    StateManager.set('layer.count', this.layers.length);
    this.composeToCanvas();
    EventBus.emit(EVENTS.LAYER_DELETED, { index, layerId: layer.id });

    return true;
  }

  /**
   * Reindex all layers after insertion/deletion
   * @private
   */
  _reindexLayers() {
    this.layers.forEach((layer, i) => {
      layer.index = i;
    });
  }

  /**
   * Adjust currentLayerIndex and activeDrawLayerIndex after a layer deletion
   * so they point at valid layers (and activeDrawLayerIndex stays on a regular
   * drawing layer, never on a stamp or the background).
   * @private
   */
  _adjustCurrentLayerIndex() {
    if (this.layers.length <= 1) {
      this.currentLayerIndex = 0;
      this.activeDrawLayerIndex = 0;
    } else {
      if (this.currentLayerIndex >= this.layers.length) {
        this.currentLayerIndex = this.layers.length - 1;
      } else if (this.currentLayerIndex < 1) {
        this.currentLayerIndex = 1; // Skip background
      }

      // Ensure activeDrawLayerIndex points at a valid non-stamp drawing layer.
      const target = this.layers[this.activeDrawLayerIndex];
      const valid = target && !target.isStamp && !target.isBackground;
      if (!valid) {
        this.activeDrawLayerIndex = 0;
        for (let i = 1; i < this.layers.length; i++) {
          if (!this.layers[i].isStamp) {
            this.activeDrawLayerIndex = i;
            break;
          }
        }
      }
    }
    StateManager.set('layer.current', this.currentLayerIndex);
  }

  /**
   * Get the total number of layers
   * @returns {number}
   */
  getLayerCount() {
    return this.layers.length;
  }

  /**
   * Set layer visibility
   * @param {number} index - Layer index
   * @param {boolean} visible - Visibility state
   */
  setLayerVisibility(index, visible) {
    const layer = this.getLayer(index);
    if (!layer) return;

    layer.visible = visible;
    EventBus.emit(EVENTS.LAYER_VISIBILITY, { layer: index, visible });
    this.requestComposition();
  }

  /**
   * Get layer visibility
   * @param {number} index - Layer index
   * @returns {boolean}
   */
  getLayerVisibility(index) {
    const layer = this.getLayer(index);
    return layer ? layer.visible : false;
  }

  /**
   * Set XOR mode on a layer (typically a stamp). Triggers a recompose.
   * @param {number} index - Layer index
   * @param {boolean} xorMode
   */
  setLayerXorMode(index, xorMode) {
    const layer = this.getLayer(index);
    if (!layer) return;
    layer.xorMode = !!xorMode;
    EventBus.emit(EVENTS.LAYER_VISIBILITY, { layer: index, xorMode: layer.xorMode });
    this.requestComposition();
  }

  /**
   * Set layer locked state
   * @param {number} index - Layer index
   * @param {boolean} locked - Locked state
   */
  setLayerLocked(index, locked) {
    const layer = this.getLayer(index);
    if (!layer) return;
    layer.locked = locked;
  }

  /**
   * Check if layer is locked
   * @param {number} index - Layer index
   * @returns {boolean}
   */
  isLayerLocked(index) {
    const layer = this.getLayer(index);
    return layer ? layer.locked : false;
  }

  /**
   * Rename a layer
   * @param {number} index - Layer index
   * @param {string} name - New layer name
   */
  renameLayer(index, name) {
    const layer = this.getLayer(index);
    if (!layer) return;
    layer.name = name || `Layer ${index + 1}`;
  }

  /**
   * Move a layer from one position to another
   * Cannot move the background layer (index 0)
   * @param {number} fromIndex - Source index
   * @param {number} toIndex - Destination index
   */
  moveLayer(fromIndex, toIndex) {
    // Cannot move background layer
    if (fromIndex === 0 || toIndex === 0) {
      Logger.warn('LayerManager', 'Cannot move background layer');
      return;
    }
    if (fromIndex < 0 || fromIndex >= this.layers.length) return;
    if (toIndex < 0 || toIndex >= this.layers.length) return;
    if (fromIndex === toIndex) return;

    const [layer] = this.layers.splice(fromIndex, 1);
    this.layers.splice(toIndex, 0, layer);

    // Reindex all layers
    this.layers.forEach((l, i) => {
      l.index = i;
    });

    // Adjust current layer index if it was affected
    if (this.currentLayerIndex === fromIndex) {
      this.currentLayerIndex = toIndex;
    } else if (fromIndex < this.currentLayerIndex && toIndex >= this.currentLayerIndex) {
      this.currentLayerIndex--;
    } else if (fromIndex > this.currentLayerIndex && toIndex <= this.currentLayerIndex) {
      this.currentLayerIndex++;
    }

    StateManager.set('layer.current', this.currentLayerIndex);
    EventBus.emit(EVENTS.LAYER_ORDER, { from: fromIndex, to: toIndex });
    this.requestComposition();
  }

  /**
   * Move layer up (towards higher index / foreground)
   * @param {number} index - Layer index
   */
  moveLayerUp(index) {
    if (index > 0 && index < this.layers.length - 1) {
      this.moveLayer(index, index + 1);
    }
  }

  /**
   * Move layer down (towards lower index / background)
   * Cannot move to position 0 (background)
   * @param {number} index - Layer index
   */
  moveLayerDown(index) {
    if (index > 1) {
      this.moveLayer(index, index - 1);
    }
  }

  /**
   * Duplicate a layer
   * Cannot duplicate the background layer
   * @param {number} index - Layer index to duplicate
   * @returns {Layer|null} The new layer or null if failed
   */
  duplicateLayer(index) {
    // Cannot duplicate background layer
    if (index === 0) {
      Logger.warn('LayerManager', 'Cannot duplicate background layer');
      return null;
    }
    const source = this.getLayer(index);
    if (!source) return null;

    const newLayer = this.addLayer(`${source.name} Copy`);
    if (!newLayer) return null;

    // Copy all attribute data (opacity is always 100%)
    newLayer.visible = source.visible;
    newLayer.locked = source.locked;
    newLayer.isStamp = source.isStamp;
    newLayer.xorMode = source.xorMode;
    if (source.stamp) {
      newLayer.stamp = {
        x: source.stamp.x, y: source.stamp.y,
        w: source.stamp.w, h: source.stamp.h,
        colorSelection: source.stamp.colorSelection,
        mask: source.stamp.mask ? source.stamp.mask.map(r => [...r]) : null
      };
    }
    newLayer.restoreAttributeData(source.cloneAttributeData());

    return newLayer;
  }

  /**
   * Request layer composition to canvas
   */
  requestComposition() {
    this.composeToCanvas();
  }

  /**
   * Compose all visible layers to the canvas
   * Layers are rendered from index 0 (back) to highest (front)
   */
  composeToCanvas() {
    for (let cellY = 0; cellY < ZX_SPECTRUM.GRID_ROWS; cellY++) {
      for (let cellX = 0; cellX < ZX_SPECTRUM.GRID_COLS; cellX++) {
        this.composeCellToCanvas(cellX, cellY);
      }
    }
    CanvasSystem.requestRender();
  }

  /**
   * Compose a single cell from all visible layers
   *
   * Compositing rules:
   * 1. Collect all visible layers with ALTERED cells at this position
   * 2. Stack (OR) the ink pixels from all altered cells
   * 3. Use ATTRIBUTES (ink, paper, bright, flash) from the TOPMOST altered cell
   * 4. Paper color comes from background layer (layer 0) if no altered cells
   *
   * @param {number} cellX - Cell X coordinate
   * @param {number} cellY - Cell Y coordinate
   */
  composeCellToCanvas(cellX, cellY) {
    const cellW = ZX_SPECTRUM.CELL_WIDTH;
    const cellH = ZX_SPECTRUM.CELL_HEIGHT;
    const baseX = cellX * cellW;
    const baseY = cellY * cellH;

    // Get background layer for default paper color
    const bgLayer = this.layers[0];
    const bgCell = bgLayer ? bgLayer.getCell(cellX, cellY) : null;

    // Collect visible layers with ALTERED cells (excluding background for pixel stacking)
    const alteredLayers = [];
    for (let i = 1; i < this.layers.length; i++) {
      const layer = this.layers[i];
      if (layer.visible) {
        // A stamp is an object "outside" the drawing — only the actively-engaged
        // floating stamp may participate in the composite. Idle/orphan stamps
        // must never mask the canvas (they would write-protect the layer below).
        const fp = window.SelectionService && SelectionService.floatingPaste;
        if (layer.isStamp && !(fp && fp.floatingLayer === layer)) continue;
        const cell = layer.getCell(cellX, cellY);
        if (cell && cell.altered) {
          alteredLayers.push({ layer, cell, index: i });
        }
      }
    }

    // GigaScreen (screens === 2): the layer stack partitions into two
    // sub-screens by each layer's gigaScreen tag (the background is shared);
    // both composite independently and the canvas shows the flicker blend
    // (per-channel average, like RECOIL's ApplyBlend) or a single sub-screen
    // when the view toggle says so.
    if ((ACTIVE_SCREEN_MODE.screens || 1) === 2) {
      this._composeGigaCell(cellX, cellY, alteredLayers, bgCell, cellW, cellH, baseX, baseY);
      return;
    }

    // Indexed modes (pixelDepth > 1, Phase 13): the THIRD compose branch on
    // the descriptor — index-over-index stacking with a transparency index
    // instead of ink-OR + attribute resolution. No attributes, no FLASH.
    if (ZX_SPECTRUM.PIXEL_DEPTH > 1) {
      this._composeIndexedCell(cellX, cellY, alteredLayers, bgCell, cellW, cellH, baseX, baseY);
      return;
    }

    const { attrs: compositeAttrs, pixels: compositePixels } =
      this._composeCellData(alteredLayers, bgCell, cellH);

    // Resolve the cell's palette indices for the active mode. In ULAplus
    // mode FLASH/BRIGHT select the CLUT instead of flashing/brightening,
    // so `flashing` comes back false there and the flash clock stays idle.
    const resolved = this._resolveCellColors(compositeAttrs);

    // Track this cell in the FLASH set so the flash clock knows to re-compose
    // it on phase changes. (Self-healing: a cell that stops flashing re-composes
    // once as non-flashing and drops out here.)
    const flashKey = `${cellX},${cellY}`;
    if (resolved.flashing) {
      this._flashingCells.add(flashKey);
    } else {
      this._flashingCells.delete(flashKey);
    }

    let inkColor = resolved.ink;
    let paperColor = resolved.paper;

    // ZX FLASH: during the inverted phase, flagged cells render with INK and
    // PAPER swapped. Only the render colours are swapped — the cell's stored
    // attributes are untouched so export/undo see the true base values.
    if (resolved.flashing && this._flashInverted) {
      const tmp = inkColor;
      inkColor = paperColor;
      paperColor = tmp;
    }

    // Render each pixel (cell rows are one byte wide — attrCellW is 8 in
    // every classic mode, MSB = leftmost pixel)
    for (let row = 0; row < cellH; row++) {
      for (let col = 0; col < cellW; col++) {
        const bitPosition = 7 - col;
        const isInk = (compositePixels[row] >> bitPosition) & 1;
        const color = isInk ? inkColor : paperColor;

        const x = baseX + col;
        const y = baseY + row;
        CanvasSystem.setPixel(x, y, color[0], color[1], color[2]);
      }
    }

    // Mark cell as dirty for render
    CanvasSystem.markCellDirty(cellX, cellY);
  }

  /**
   * Composite one cell's attrs + pixels from a list of altered layer
   * entries over the background cell — the shared core of the single- and
   * sub-screen compose paths. XOR-mode stamp layers take the cell over
   * entirely (pixels pre-computed as target XOR shape, attrs copied from
   * the target); otherwise ink pixels OR-stack and the topmost altered
   * layer's attributes win.
   * @param {Array} alteredLayers - [{ layer, cell, index }] bottom -> top
   * @param {Object|null} bgCell - Background layer's cell
   * @param {number} cellH - Active cell height
   * @returns {{attrs: Object, pixels: Uint8Array}}
   * @private
   */
  _composeCellData(alteredLayers, bgCell, cellH) {
    let xorEntry = null;
    for (let i = alteredLayers.length - 1; i >= 0; i--) {
      if (alteredLayers[i].layer.xorMode) { xorEntry = alteredLayers[i]; break; }
    }

    let attrs;
    const pixels = new Uint8Array(cellH);

    if (xorEntry) {
      const c = xorEntry.cell;
      attrs = { ink: c.ink, paper: c.paper, bright: c.bright, flash: c.flash };
      for (let row = 0; row < cellH; row++) pixels[row] = c.pixels[row];
      return { attrs, pixels };
    }

    if (alteredLayers.length > 0) {
      // Use attributes from topmost altered layer
      const topCell = alteredLayers[alteredLayers.length - 1].cell;
      attrs = {
        ink: topCell.ink,
        paper: topCell.paper,
        bright: topCell.bright,
        flash: topCell.flash
      };
    } else {
      // No altered layers - use background's attributes
      attrs = bgCell ? {
        ink: bgCell.ink,
        paper: bgCell.paper,
        bright: bgCell.bright,
        flash: bgCell.flash
      } : {
        ink: 0,
        paper: 7,
        bright: false,
        flash: false
      };
    }

    // Stack (OR) all ink pixels from altered layers
    for (let i = 0; i < alteredLayers.length; i++) {
      const { cell } = alteredLayers[i];
      for (let row = 0; row < cellH; row++) {
        pixels[row] |= cell.pixels[row];
      }
    }

    return { attrs, pixels };
  }

  /**
   * Indexed-mode cell compose (Phase 13): start from the background cell's
   * index grid, then let every altered layer's set (≥ 0) pixels win bottom
   * -> top — the topmost set pixel shows, transparent (−1) pixels let the
   * stack below through. Stamp layers participate exactly like the classic
   * branch (they were already filtered into alteredLayers); their xorMode
   * flag is ignored in indexed modes (documented — XOR is a 1-bit concept).
   * Nothing flashes; cells drop out of the FLASH set.
   * @private
   */
  _composeIndexedCell(cellX, cellY, alteredLayers, bgCell, cellW, cellH, baseX, baseY) {
    const n = cellW * cellH;
    const out = new Int16Array(n);
    if (bgCell && bgCell.indices) {
      out.set(bgCell.indices);
    } else {
      out.fill(NEXTRGB333.DEFAULT_PAPER);
    }

    for (let i = 0; i < alteredLayers.length; i++) {
      const src = alteredLayers[i].cell.indices;
      if (!src) continue;
      for (let p = 0; p < n; p++) {
        if (src[p] >= 0) out[p] = src[p];
      }
    }

    this._flashingCells.delete(`${cellX},${cellY}`);

    const maxIndex = ZX_SPECTRUM.PALETTE_SIZE - 1;
    for (let row = 0; row < cellH; row++) {
      for (let col = 0; col < cellW; col++) {
        let idx = out[row * cellW + col];
        if (idx < 0) idx = 0;
        else if (idx > maxIndex) idx = maxIndex;
        const color = window.ColorManager && ColorManager.getRGB
          ? ColorManager.getRGB(idx)
          : ZX_PALETTE_RGB[idx & 15];
        CanvasSystem.setPixel(baseX + col, baseY + row, color[0], color[1], color[2]);
      }
    }

    CanvasSystem.markCellDirty(cellX, cellY);
  }

  /**
   * GigaScreen cell compose: partition the altered layers by sub-screen
   * tag, composite each sub-screen over the shared background, then render
   * the blend (or one sub-screen, per the view toggle). FLASH applies per
   * sub-screen before blending.
   * @private
   */
  _composeGigaCell(cellX, cellY, alteredLayers, bgCell, cellW, cellH, baseX, baseY) {
    const listA = [];
    const listB = [];
    for (const entry of alteredLayers) {
      ((entry.layer.gigaScreen || 0) === 1 ? listB : listA).push(entry);
    }

    const a = this._composeCellData(listA, bgCell, cellH);
    const b = this._composeCellData(listB, bgCell, cellH);
    const resA = this._resolveCellColors(a.attrs);
    const resB = this._resolveCellColors(b.attrs);

    const flashKey = `${cellX},${cellY}`;
    if (resA.flashing || resB.flashing) {
      this._flashingCells.add(flashKey);
    } else {
      this._flashingCells.delete(flashKey);
    }

    let inkA = resA.ink, paperA = resA.paper;
    if (resA.flashing && this._flashInverted) { const t = inkA; inkA = paperA; paperA = t; }
    let inkB = resB.ink, paperB = resB.paper;
    if (resB.flashing && this._flashInverted) { const t = inkB; inkB = paperB; paperB = t; }

    const view = this._gigaView;
    // The 4 possible blended colours of this cell, indexed bitA*2 + bitB
    const blends = view === 'blend' ? [
      this._blendRGB(paperA, paperB), this._blendRGB(paperA, inkB),
      this._blendRGB(inkA, paperB), this._blendRGB(inkA, inkB)
    ] : null;

    for (let row = 0; row < cellH; row++) {
      for (let col = 0; col < cellW; col++) {
        const bit = 7 - col;
        const bitA = (a.pixels[row] >> bit) & 1;
        const bitB = (b.pixels[row] >> bit) & 1;
        let color;
        if (view === 'a') color = bitA ? inkA : paperA;
        else if (view === 'b') color = bitB ? inkB : paperB;
        else color = blends[bitA * 2 + bitB];
        CanvasSystem.setPixel(baseX + col, baseY + row, color[0], color[1], color[2]);
      }
    }

    CanvasSystem.markCellDirty(cellX, cellY);
  }

  /** Per-channel average of two RGB triplets (RECOIL's blend). @private */
  _blendRGB(c1, c2) {
    return new Uint8Array([
      (c1[0] + c2[0]) >> 1,
      (c1[1] + c2[1]) >> 1,
      (c1[2] + c2[2]) >> 1
    ]);
  }

  /**
   * The GigaScreen view mode: 'blend' (default), 'a' or 'b'.
   * @returns {string}
   */
  getGigaView() {
    return this._gigaView;
  }

  /**
   * Toggle what the canvas shows in GigaScreen mode. Session view state
   * (not document state — not carried by undo/autosave).
   * @param {string} view - 'blend' | 'a' | 'b'
   */
  setGigaView(view) {
    if (view !== 'blend' && view !== 'a' && view !== 'b') return;
    if (view === this._gigaView) return;
    this._gigaView = view;
    this.composeToCanvas();
    EventBus.emit(EVENTS.GIGA_VIEW_CHANGED, { view });
  }

  /**
   * Resolve a cell's attribute set to render RGB triplets for the active
   * mode. Delegates to ColorManager (the palette-as-data owner) when it is
   * loaded; falls back to the fixed ZX palette in headless contexts (the
   * Node test harness loads this module without ColorManager — same seam
   * the tests already stub CanvasSystem through).
   * @param {Object} attrs - { ink, paper, bright, flash }
   * @returns {{ink: Uint8Array, paper: Uint8Array, flashing: boolean}}
   * @private
   */
  _resolveCellColors(attrs) {
    if (window.ColorManager && ColorManager.attrToIndices) {
      const t = ColorManager.attrToIndices(attrs);
      return {
        ink: ColorManager.getRGB(t.ink),
        paper: ColorManager.getRGB(t.paper),
        flashing: t.flashing
      };
    }
    const inkIndex = CanvasSystem.getColorIndex(attrs.ink, attrs.bright);
    const paperIndex = CanvasSystem.getColorIndex(attrs.paper, attrs.bright);
    return {
      ink: ZX_PALETTE_RGB[inkIndex],
      paper: ZX_PALETTE_RGB[paperIndex],
      flashing: attrs.flash
    };
  }

  /**
   * Compose a single cell (alias for external use)
   * @param {number} cellX - Cell X coordinate
   * @param {number} cellY - Cell Y coordinate
   */
  renderCell(cellX, cellY) {
    this.composeCellToCanvas(cellX, cellY);
  }

  /**
   * Queue a cell for composition on the next RAF render pass.
   * Called by PixelDrawRoutine for every pixel draw — each unique cell
   * is composed exactly once per RAF frame regardless of pixel count.
   *
   * @param {number} cellX - Cell column (0–31)
   * @param {number} cellY - Cell row (0–23)
   */
  deferCellCompose(cellX, cellY) {
    this._pendingComposeCells.add(`${cellX},${cellY}`);
    CanvasSystem.requestRender();
  }

  /**
   * Compose all queued cells to imageData.
   * Called by CanvasSystem._render() before putImageData.
   */
  flushPendingCompose() {
    if (this._pendingComposeCells.size === 0) return;
    for (const key of this._pendingComposeCells) {
      const comma = key.indexOf(',');
      const cx = key.substring(0, comma) | 0;
      const cy = key.substring(comma + 1) | 0;
      this.composeCellToCanvas(cx, cy);
    }
    this._pendingComposeCells.clear();
  }

  /**
   * Flatten all visible layers into a single layer
   * Follows ZX Spectrum compositing: pixels stack (OR), attributes from topmost altered
   * @param {Object} [options]
   * @param {number} [options.gigaScreen] - When set (0|1), only layers on
   *   that sub-screen participate (the shared background always does) —
   *   the GigaScreen export path flattens each sub-screen separately.
   * @returns {Layer} A new layer containing the flattened result
   */
  flattenVisible(options = {}) {
    const screenFilter = options.gigaScreen;
    const result = new LayerClass(0, 'Flattened');
    const cellH = ZX_SPECTRUM.CELL_HEIGHT;

    // For each cell, collect altered layers and composite properly
    for (let cellY = 0; cellY < ZX_SPECTRUM.GRID_ROWS; cellY++) {
      for (let cellX = 0; cellX < ZX_SPECTRUM.GRID_COLS; cellX++) {
        const resultCell = result.getCell(cellX, cellY);

        // Start with background layer (layer 0) attributes
        const bgLayer = this.layers[0];
        if (bgLayer && bgLayer.visible) {
          const bgCell = bgLayer.getCell(cellX, cellY);
          if (bgCell) {
            resultCell.ink = bgCell.ink;
            resultCell.paper = bgCell.paper;
            resultCell.bright = bgCell.bright;
            resultCell.flash = bgCell.flash;
            if (resultCell.indices && bgCell.indices) {
              resultCell.indices.set(bgCell.indices);
            }
          }
        }

        // Process regular layers from bottom to top (skip background and components)
        let hasAlteredCell = false;
        for (let i = 1; i < this.layers.length; i++) {
          const layer = this.layers[i];
          if (!layer.visible || layer.isStamp) continue;
          if (screenFilter !== undefined
              && (layer.gigaScreen || 0) !== screenFilter) continue;

          const srcCell = layer.getCell(cellX, cellY);
          if (!srcCell || !srcCell.altered) continue;

          if (resultCell.indices) {
            // Indexed mode: topmost set index wins per pixel
            const src = srcCell.indices;
            if (src) {
              for (let p = 0; p < src.length; p++) {
                if (src[p] >= 0) resultCell.indices[p] = src[p];
              }
            }
          } else {
            // Stack pixels using OR
            for (let row = 0; row < cellH; row++) {
              resultCell.pixels[row] |= srcCell.pixels[row];
            }

            // Take attributes from this layer (topmost altered will be last)
            resultCell.ink = srcCell.ink;
            resultCell.paper = srcCell.paper;
            resultCell.bright = srcCell.bright;
            resultCell.flash = srcCell.flash;
          }
          hasAlteredCell = true;
        }

        if (hasAlteredCell) {
          resultCell.altered = true;
        }
      }
    }

    return result;
  }

  /**
   * Merge a layer with the one below it
   * Follows ZX Spectrum compositing: pixels stack (OR), attributes from topmost altered
   * @param {number} index - Layer index to merge down
   * @returns {boolean} True if merged successfully
   */
  mergeDown(index) {
    // Cannot merge layer 1 into background (layer 0), or invalid indices
    if (index < 1 || index >= this.layers.length) {
      Logger.warn('LayerManager', 'Cannot merge down: invalid layer index', { index });
      return false;
    }
    // Cannot merge into background layer
    if (index === 1) {
      Logger.warn('LayerManager', 'Cannot merge into background layer');
      return false;
    }

    const upper = this.layers[index];
    const lower = this.layers[index - 1];

    // Stamps are never folded by the merge button. They live in the Stamps
    // panel and are baked only via their own explicit Commit action. Refuse the
    // merge if either side is a stamp, so a stamp can't merge into a drawing
    // layer or into another stamp.
    if (upper.isStamp || lower.isStamp) {
      Logger.warn('LayerManager', 'Merge does not apply to stamp layers — use the stamp Commit button');
      return false;
    }

    // Skip if upper layer is not visible - just delete, no merge
    if (!upper.visible) {
      return this.removeLayer(index);
    }

    if (window.UndoRedo) UndoRedo.beginAction('Merge down');

    // Merge upper into lower following compositing rules
    const cellH = ZX_SPECTRUM.CELL_HEIGHT;
    for (let cellY = 0; cellY < ZX_SPECTRUM.GRID_ROWS; cellY++) {
      for (let cellX = 0; cellX < ZX_SPECTRUM.GRID_COLS; cellX++) {
        const upperCell = upper.getCell(cellX, cellY);
        const lowerCell = lower.getCell(cellX, cellY);

        if (!upperCell || !lowerCell) continue;

        // Only process if upper cell has been altered
        if (upperCell.altered) {
          if (lowerCell.indices && upperCell.indices) {
            // Indexed mode: upper layer's set pixels win
            for (let p = 0; p < upperCell.indices.length; p++) {
              if (upperCell.indices[p] >= 0) lowerCell.indices[p] = upperCell.indices[p];
            }
          } else {
            // Stack pixels using OR operation
            for (let row = 0; row < cellH; row++) {
              lowerCell.pixels[row] |= upperCell.pixels[row];
            }

            // Upper layer is topmost, so its attributes take precedence
            lowerCell.ink = upperCell.ink;
            lowerCell.paper = upperCell.paper;
            lowerCell.bright = upperCell.bright;
            lowerCell.flash = upperCell.flash;
          }
          lowerCell.altered = true;
        }
        // If upper cell not altered, lower cell keeps its data as-is
      }
    }

    // Remove the upper layer WITHOUT pushing to undo (the merge action wraps both)
    this.removeLayer(index, false);

    if (window.UndoRedo) UndoRedo.endAction();

    return true;
  }

  /**
   * Merge all selected REGULAR drawing layers into the bottommost selected one.
   * Follows ZX Spectrum compositing: pixels stack (OR), attributes from topmost altered.
   *
   * Stamps are excluded entirely — they are never OR-merged and never committed
   * here. A stamp is baked into a drawing layer only via its own Commit action in
   * the Stamps panel. If the selection contains stamps they are simply ignored;
   * the merge needs at least two selected regular drawing layers to do anything.
   *
   * @returns {boolean} True if merged successfully
   */
  mergeSelected() {
    const selectedIdx = this.getSelectedLayers();
    if (selectedIdx.length < 2) return false;

    // Capture layer OBJECT references — indices shift as layers are removed.
    const selectedLayers = selectedIdx.map(i => this.layers[i]);

    // Only regular drawing layers participate: exclude stamps and the background.
    const regularLayers = selectedLayers.filter(
      l => l && !l.isStamp && this.layers.indexOf(l) >= 1
    );

    // Need at least two regular drawing layers; stamps never count toward this.
    if (regularLayers.length < 2) {
      Logger.warn('LayerManager', 'Merge needs at least two drawing layers — stamps are excluded');
      return false;
    }

    if (window.UndoRedo) UndoRedo.beginAction('Merge selected');

    const regularIndices = regularLayers
      .map(l => this.layers.indexOf(l))
      .filter(i => i >= 1)
      .sort((a, b) => a - b);

    // Target is the bottommost selected regular layer (lowest index, never background).
    const targetIndex = regularIndices[0];
    const targetLayer = this.layers[targetIndex];

    // Process from bottom to top, OR-stacking pixels and taking attributes
    // from the topmost (highest-index) altered cell.
    const mergeCellH = ZX_SPECTRUM.CELL_HEIGHT;
    for (let i = 1; i < regularIndices.length; i++) {
      const srcLayer = this.layers[regularIndices[i]];
      if (!srcLayer || !srcLayer.visible) continue;

      for (let cellY = 0; cellY < ZX_SPECTRUM.GRID_ROWS; cellY++) {
        for (let cellX = 0; cellX < ZX_SPECTRUM.GRID_COLS; cellX++) {
          const srcCell = srcLayer.getCell(cellX, cellY);
          const targetCell = targetLayer.getCell(cellX, cellY);

          if (!srcCell || !targetCell) continue;

          // Only process altered cells
          if (srcCell.altered) {
            if (targetCell.indices && srcCell.indices) {
              // Indexed mode: higher layer's set pixels win
              for (let p = 0; p < srcCell.indices.length; p++) {
                if (srcCell.indices[p] >= 0) targetCell.indices[p] = srcCell.indices[p];
              }
            } else {
              // Stack pixels using OR operation
              for (let row = 0; row < mergeCellH; row++) {
                targetCell.pixels[row] |= srcCell.pixels[row];
              }

              // Source is higher layer, so its attributes take precedence
              targetCell.ink = srcCell.ink;
              targetCell.paper = srcCell.paper;
              targetCell.bright = srcCell.bright;
              targetCell.flash = srcCell.flash;
            }
            targetCell.altered = true;
          }
        }
      }
    }

    // Remove the merged-away source layers, top to bottom, WITHOUT pushing to
    // undo (the merge action wraps both). Re-derive indices for each removal
    // since the array shrinks as we go; never touch the background (index 0).
    const removeObjs = regularIndices.slice(1).map(i => this.layers[i]);
    removeObjs.sort((a, b) => this.layers.indexOf(b) - this.layers.indexOf(a));
    for (const obj of removeObjs) {
      const idx = this.layers.indexOf(obj);
      if (idx >= 1) this.removeLayer(idx, false);
    }

    // Select the surviving target.
    const newTargetIndex = this.layers.indexOf(targetLayer);
    this.selectedLayers.clear();
    this.selectedLayers.add(newTargetIndex);
    this.currentLayerIndex = newTargetIndex;
    this.activeDrawLayerIndex = newTargetIndex;
    StateManager.set('layer.current', newTargetIndex);

    this.requestComposition();

    if (window.UndoRedo) UndoRedo.endAction();

    return true;
  }

  /**
   * Delete all selected layers
   * @returns {number} Number of layers deleted
   */
  deleteSelected() {
    const selected = this.getSelectedLayers();
    if (selected.length === 0) return 0;

    // Cannot delete all layers
    if (selected.length >= this.layers.length) {
      Logger.warn('LayerManager', 'Cannot delete all layers');
      return 0;
    }

    let deleted = 0;
    // Delete from top to bottom to preserve indices
    for (let i = selected.length - 1; i >= 0; i--) {
      if (this.removeLayer(selected[i])) {
        deleted++;
      }
    }

    this.selectedLayers.clear();
    this.requestComposition();
    return deleted;
  }

  /**
   * Set visibility for all selected layers
   * @param {boolean} visible - Visibility state
   */
  setSelectedVisibility(visible) {
    const selected = this.getSelectedLayers();
    selected.forEach(index => {
      this.setLayerVisibility(index, visible);
    });
  }

  /**
   * Set locked state for all selected layers
   * @param {boolean} locked - Locked state
   */
  setSelectedLocked(locked) {
    const selected = this.getSelectedLayers();
    selected.forEach(index => {
      this.setLayerLocked(index, locked);
    });
  }

  /**
   * Duplicate all selected layers
   * @returns {number} Number of layers duplicated
   */
  duplicateSelected() {
    const selected = this.getSelectedLayers();
    let duplicated = 0;

    selected.forEach(index => {
      if (this.duplicateLayer(index)) {
        duplicated++;
      }
    });

    return duplicated;
  }

  /**
   * Get all layers as an array (for serialization)
   * @returns {Array}
   */
  getAllLayers() {
    return this.layers.map(layer => ({
      name: layer.name,
      visible: layer.visible,
      opacity: layer.opacity,
      locked: layer.locked,
      isBackground: layer.isBackground,
      gigaScreen: layer.gigaScreen || 0,
      attributeData: layer.cloneAttributeData()
    }));
  }

  /**
   * Restore layers from serialized data
   * @param {Array} data - Serialized layer data
   */
  restoreFromData(data) {
    if (!Array.isArray(data) || data.length === 0) return;

    this.layers = [];
    this._layerIdMap.clear();
    // Reset ID counter to ensure unique IDs
    this._nextLayerId = 1;

    data.forEach((layerData, i) => {
      const isBackground = layerData.isBackground || (i === 0);
      const layerId = this._nextLayerId++;
      const layer = new LayerClass(i, layerData.name, isBackground, layerId);
      layer.visible = layerData.visible !== undefined ? layerData.visible : true;
      layer.opacity = layerData.opacity !== undefined ? layerData.opacity : 100;
      layer.locked = layerData.locked !== undefined ? layerData.locked : isBackground;
      layer.gigaScreen = layerData.gigaScreen || 0;
      if (layerData.attributeData) {
        layer.restoreAttributeData(layerData.attributeData);
      }
      this._layerIdMap.set(layerId, layer);
      this.layers.push(layer);
    });

    // Set current layer to first drawing layer (not background)
    this.currentLayerIndex = this.layers.length > 1 ? 1 : 0;
    this.activeDrawLayerIndex = this.currentLayerIndex;
    StateManager.set('layer.count', this.layers.length);
    StateManager.set('layer.current', this.currentLayerIndex);
  }

  /**
   * Reset the layer manager to initial state
   * Creates background layer + one drawing layer
   */
  reset() {
    this.layers = [];
    this.currentLayerIndex = 1;
    this.activeDrawLayerIndex = 1;
    this.selectedLayers.clear();
    this.lastClickedIndex = 1;
    // Reset layer ID system
    this._nextLayerId = 1;
    this._layerIdMap.clear();

    // Create background layer (layer 0)
    this._createBackgroundLayer();

    // Create first drawing layer (layer 1) - don't push to undo during reset
    this.addLayer('Layer 1', false);
    this.selectedLayers.add(1);

    this.composeToCanvas();
  }
}

/**
 * Are two packed grids identical?
 *
 * Compared field by field over the typed arrays, which is a memcmp-shaped loop
 * rather than the string building a JSON comparison would do - this runs once
 * per layer per action, on grids up to 212 KB.
 *
 * Geometry mismatches (a mode switch inside the action) count as CHANGED, so
 * the grid is kept. Being wrong in that direction costs memory; being wrong in
 * the other costs the artwork.
 * @param {Object} a @param {Object} b
 * @returns {boolean}
 */
LayerManagerClass.packedGridsEqual = function(a, b) {
    if (!a || !b) return false;
    if (a.rows !== b.rows || a.cols !== b.cols || a.cellH !== b.cellH || a.tile !== b.tile) {
        return false;
    }

    for (const key of ['ink', 'paper', 'flags', 'pixels', 'indices', 'transparent']) {
        const x = a[key], y = b[key];
        if (!x !== !y) return false;      // one present, one not
        if (!x) continue;
        if (x.length !== y.length) return false;
        for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return false;
    }
    return true;
};

// Create singleton instance
const LayerManagerInstance = new LayerManagerClass();

// Export to global scope
window.Layer = LayerClass;
window.LayerManager = LayerManagerInstance;
window.LayerManagerClass = LayerManagerClass;

Logger.debug('LayerManager', 'Layer manager loaded');

})(); // End IIFE
