'use strict';
(function() {

/**
 * Tool Manager
 * Handles tool registration, selection, and event delegation
 */
class ToolManagerClassInternal {
  constructor() {
    this.tools = new Map();
    this.currentTool = null;
  }

  /**
   * Register a tool with the manager
   * @param {ToolBase} tool - Tool instance to register
   */
  register(tool) {
    if (!tool || !tool.id) {
      Logger.error('ToolManager', 'Cannot register tool without id');
      return;
    }

    if (this.tools.has(tool.id)) {
      Logger.warn('ToolManager', `Tool ${tool.id} already registered, replacing`);
    }

    this.tools.set(tool.id, tool);
    Logger.debug('ToolManager', `Registered tool: ${tool.id}`);
  }

  /**
   * Unregister a tool from the manager
   * @param {string} toolId - ID of tool to remove
   */
  unregister(toolId) {
    if (this.currentTool && this.currentTool.id === toolId) {
      this.currentTool.deactivate();
      this.currentTool = null;
    }
    this.tools.delete(toolId);
    Logger.debug('ToolManager', `Unregistered tool: ${toolId}`);
  }

  /**
   * Map shape tool variants to the base shape tool
   * Extended to support all shape types from ShapeGenerator
   * @private
   */
  _shapeVariants = {
    'shape': { baseTool: TOOLS.RECTANGLE, shapeType: null },
    [TOOLS.LINE]: { baseTool: TOOLS.RECTANGLE, shapeType: 'line' },
    [TOOLS.ROUNDED_RECTANGLE]: { baseTool: TOOLS.RECTANGLE, shapeType: 'rounded-rectangle' },
    [TOOLS.PARALLELOGRAM]: { baseTool: TOOLS.RECTANGLE, shapeType: 'parallelogram' },
    [TOOLS.CIRCLE]: { baseTool: TOOLS.RECTANGLE, shapeType: 'circle' },
    [TOOLS.ELLIPSE]: { baseTool: TOOLS.RECTANGLE, shapeType: 'ellipse' },
    [TOOLS.TRIANGLE]: { baseTool: TOOLS.RECTANGLE, shapeType: 'triangle' },
    [TOOLS.POLYGON]: { baseTool: TOOLS.RECTANGLE, shapeType: 'polygon' },
    [TOOLS.STAR]: { baseTool: TOOLS.RECTANGLE, shapeType: 'star' }
  };

  /**
   * Brush-type rail buttons that ride on the single BrushTool, the same way
   * the shape variants ride on ShapeTool: selecting one pins BrushEngine to
   * its type. Round and square are NOT here — they stay under the base BRUSH
   * button (the Round/Square selector in the brush options).
   * @private
   */
  /**
   * `startSize` is the smallest size at which the brush is THAT BRUSH rather
   * than a pencil wearing its name, measured in docs/MINIMUM_SIZES.md (rerun
   * with `node tools/measure-min-brushes.js`):
   *
   *   spray    4  - at 3 and below a stamp lays one or two particles, which is
   *                 a pencil with a wobble
   *   hatch    4  - at the default spacing of 4, smaller stamps miss the
   *                 lattice entirely at some positions on the grid and the
   *                 stroke silently drops out
   *   pattern  8  - the smallest tile the library ships; a dab under one tile
   *                 shows a fragment of the design rather than the design
   *
   * It is a FLOOR ON ARRIVAL, not a setting: picking the tool raises the size
   * to it, and everything below stays on the slider for whoever wants it.
   * Fade has none - at one pixel a fade is still a fade, the dither threshold
   * simply decides that pixel - and neither do round and square on the base
   * Brush button, where size 1 is the pencil and that is the point of it.
   */
  _brushVariants = {
    [TOOLS.SPRAY]:               { brushType: 'spray',   startSize: 4 },
    [TOOLS.FADE]:                { brushType: 'fade' },
    [TOOLS.PATTERN]:             { brushType: 'pattern', startSize: 8 },
    [TOOLS.HATCH]:               { brushType: 'hatch',   startSize: 4 }
  };

  /**
   * Selection-mode rail buttons riding on the single SelectionTool, exactly as
   * the brush types ride on BrushTool. The base SELECTION button hosts the
   * rectangle marquee, so every mode is one click away rather than buried in a
   * dropdown — which matters most for the lasso, the way you draw a drawing
   * guide by hand.
   * @private
   */
  _selectionVariants = {
    [TOOLS.SELECT_LASSO]: { selectMode: 'freeform' },
    [TOOLS.SELECT_ELLIPSE]: { selectMode: 'ellipse' },
    [TOOLS.SELECT_CELL]:  { selectMode: 'cell' }
  };

  /**
   * Select and activate a tool by ID
   * @param {string} toolId - ID of tool to select
   * @param {Object} [options] - `keepSize: true` skips a brush variant's
   *   starting-size floor. The floor is for a fresh button press, where the
   *   user has stated no size; a caller RESTORING a size has stated one, and
   *   raising it would silently discard what it just put back (PresetService).
   * @returns {boolean} True if tool was selected successfully
   */
  selectTool(toolId, options = {}) {
    let tool = this.tools.get(toolId);
    let effectiveToolId = toolId;

    // Handle shape tool variants (line, circle, ellipse, triangle all use ShapeTool)
    if (!tool && this._shapeVariants[toolId]) {
      const variant = this._shapeVariants[toolId];
      tool = this.tools.get(variant.baseTool);
      if (tool) {
        // Only set shape type if specified (null means keep current)
        if (variant.shapeType !== null && typeof tool.setShapeType === 'function') {
          tool.setShapeType(variant.shapeType);
        }
        effectiveToolId = toolId;
      }
    } else if (!tool && this._brushVariants[toolId]) {
      // Brush-type variants ride on the one BrushTool, like the shape variants.
      const variant = this._brushVariants[toolId];
      tool = this.tools.get(TOOLS.BRUSH);
      if (tool && typeof tool.setBrushType === 'function') {
        tool.setBrushType(variant.brushType);
        // Arrive at a size where the brush is what its button says it is. The
        // options panel is rebuilt from the tool's getters right after this,
        // so the slider shows the raised size.
        if (variant.startSize && !options.keepSize &&
            typeof tool.raiseSizeTo === 'function') {
          tool.raiseSizeTo(variant.startSize);
        }
        effectiveToolId = toolId;
      }
    } else if (!tool && this._selectionVariants[toolId]) {
      // Selection-mode variants ride on the one SelectionTool.
      const variant = this._selectionVariants[toolId];
      tool = this.tools.get(TOOLS.SELECTION);
      if (tool && typeof tool.setSelectMode === 'function') {
        tool.setSelectMode(variant.selectMode);
        effectiveToolId = toolId;
      }
    }

    if (!tool) {
      Logger.warn('ToolManager', `Unknown tool: ${toolId}`);
      return false;
    }

    // Selecting the base Brush button (not a variant) returns to a solid type,
    // so leaving crosshatch/spray/… and clicking Brush lands on round/square
    // rather than whatever type was last active. Runs before activate() so a
    // variant's own setBrushType above is never clobbered.
    if (toolId === TOOLS.BRUSH && typeof tool.ensureSolidBrush === 'function') {
      tool.ensureSolidBrush();
    }

    // The base Select button is the rectangle marquee, so leaving lasso/
    // cell and clicking it returns to the marquee rather than silently keeping
    // whichever mode was last active behind an icon that does not say so.
    if (toolId === TOOLS.SELECTION && typeof tool.setSelectMode === 'function') {
      tool.setSelectMode('rectangle');
    }

    // Deactivate current tool if different
    if (this.currentTool && this.currentTool !== tool) {
      this.currentTool.deactivate();
    }

    // Activate new tool
    this.currentTool = tool;
    this.currentTool.activate();

    // If the active layer is a stamp, switch to the first drawable layer below it
    if (window.LayerManager) {
      const currentLayer = LayerManager.getCurrentLayer();
      if (currentLayer && currentLayer.isStamp) {
        const layers = LayerManager.layers;
        const startIdx = layers.indexOf(currentLayer);
        for (let i = startIdx - 1; i >= 1; i--) {
          if (!layers[i].isStamp && !layers[i].locked) {
            LayerManager.setCurrentLayer(i);
            break;
          }
        }
      }
    }

    // Update state manager
    StateManager.setCurrentTool(effectiveToolId);

    Logger.debug('ToolManager', `Selected tool: ${effectiveToolId}`);
    return true;
  }

  /**
   * Get the currently active tool
   * @returns {ToolBase|null} Current tool or null
   */
  getCurrentTool() {
    return this.currentTool;
  }

  /**
   * Get a tool by ID
   * @param {string} toolId - Tool ID
   * @returns {ToolBase|null} Tool instance or null
   */
  getTool(toolId) {
    let tool = this.tools.get(toolId);

    // Handle shape tool variants
    if (!tool && this._shapeVariants[toolId]) {
      tool = this.tools.get(this._shapeVariants[toolId].baseTool);
    } else if (!tool && this._brushVariants[toolId]) {
      tool = this.tools.get(TOOLS.BRUSH);
    }

    return tool || null;
  }

  /**
   * Get all registered tool IDs
   * @returns {string[]} Array of tool IDs
   */
  getToolIds() {
    return Array.from(this.tools.keys());
  }

  /**
   * Check if a tool is registered
   * @param {string} toolId - Tool ID to check
   * @returns {boolean} True if tool exists
   */
  hasTool(toolId) {
    return this.tools.has(toolId);
  }

  /**
   * Handle pointer down event
   * Delegates to current tool. InputHandler calls tools directly,
   * but these methods exist for alternative call paths.
   * @param {number} pixelX - X coordinate in pixel space
   * @param {number} pixelY - Y coordinate in pixel space
   * @param {PointerEvent} e - Original event
   */
  handlePointerDown(pixelX, pixelY, e) {
    if (this.currentTool) {
      this.currentTool.isDrawing = true;
      this.currentTool.onPointerDown(pixelX, pixelY, e);
    }
  }

  /**
   * Handle pointer move event
   * @param {number} pixelX - X coordinate in pixel space
   * @param {number} pixelY - Y coordinate in pixel space
   * @param {PointerEvent} e - Original event
   */
  handlePointerMove(pixelX, pixelY, e) {
    if (this.currentTool) {
      this.currentTool.onPointerMove(pixelX, pixelY, e);
    }
  }

  /**
   * Handle pointer up event
   * @param {number} pixelX - X coordinate in pixel space
   * @param {number} pixelY - Y coordinate in pixel space
   * @param {PointerEvent} e - Original event
   */
  handlePointerUp(pixelX, pixelY, e) {
    if (this.currentTool) {
      this.currentTool.isDrawing = false;
      this.currentTool.onPointerUp(pixelX, pixelY, e);
    }
  }

  /**
   * Handle pointer leave event
   * @param {PointerEvent} e - Original event
   */
  handlePointerLeave(e) {
    if (this.currentTool) {
      this.currentTool.onPointerLeave(e);
    }
  }

  /**
   * Initialize with default tool selection
   * @param {string} defaultToolId - ID of tool to select initially
   */
  initialize(defaultToolId = TOOLS.BRUSH) {
    if (this.tools.size === 0) {
      Logger.warn('ToolManager', 'No tools registered during initialization');
      return;
    }

    // Select default tool or first available
    if (this.tools.has(defaultToolId)) {
      this.selectTool(defaultToolId);
    } else {
      const firstToolId = this.tools.keys().next().value;
      if (firstToolId) {
        this.selectTool(firstToolId);
      }
    }

    Logger.info('ToolManager', `Initialized with ${this.tools.size} tools`);
  }
}

// Create singleton instance
var ToolManager = new ToolManagerClassInternal();

// Expose to global scope
window.ToolManager = ToolManager;

Logger.debug('ToolManager', 'Tool manager loaded');

})(); // End IIFE
