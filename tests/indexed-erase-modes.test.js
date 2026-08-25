'use strict';
/**
 * Indexed-mode (Next rgb333: Layer2/LoRes/ULANext) erase behaviour.
 *
 * The classic 1-bit path already gets this right (see erase-modes.test.js):
 * the right button clears the ink bit but STAMPS the selected paper/bright/
 * flash into the cell, so the cell stays opaque on the drawing layer rather
 * than reverting to "nothing was drawn here" and showing whatever inherits
 * from the layer below. The indexed path used to fold NORMAL_ERASE into the
 * same eraseIdx as the ERASE primitive and the eraser TOOL - which is -1
 * (transparent, inherits the layer below) on any non-background layer - so a
 * right-click on an upper indexed layer never painted anything, it just made
 * the pixel disappear.
 */
const { loadModule, check, summary } = require('./helpers/zx-stubs');

global.window = global;
global.Logger = { info() {}, debug() {}, warn() {}, error() {} };

loadModule('js/core/constants.js');
loadModule('js/utils/helpers.js');
loadModule('js/utils/validators.js');
loadModule('js/core/event-bus.js');
loadModule('js/core/state-manager.js');
loadModule('js/core/attribute-system.js');

global.CanvasSystem = {
  setPixel() {}, markCellDirty() {}, requestRender() {}, _render() {},
  getColorIndex(base, bright) { return base + (bright ? 8 : 0); },
  onReady(cb) { cb(); }, getIframeDocument() { return null; },
  getCanvasElement() { return null; }, setCanvasCursor() {},
  createOverlayCanvas() { return null; },
  getScrollPosition() { return { x: 0, y: 0 }; }, setScrollPosition() {}
};
global.ColorManager = {
  _sel: { ink: 2, paper: 5, bright: true, flash: false,
          inkTransparent: false, paperTransparent: false },
  getCurrentSelection() { return { ...this._sel }; },
  getIndexedInk() { return 40; },
  getIndexedPaper() { return 90; }
};
global.SelectionService = {
  isFloating() { return false; }, hasSelection() { return false; },
  getSelection() { return null; },
  getSelectionState() { return null; }, restoreSelectionState() {}, clear() {}
};
global.PatternService = {
  getCurrentPattern() { return null; }, getCurrentPatternData() { return null; },
  shouldDrawPixel() { return true; }
};
global.Storage = { get: async () => undefined, set: async () => {} };

loadModule('js/core/layer-manager.js');
loadModule('js/core/pixel-draw-routine.js');
loadModule('js/services/undo-redo.js');

window.__setActiveScreenMode('layer2_256');
LayerManager.initialize();
UndoRedo.initialize();

const color = () => ColorManager.getCurrentSelection();
const cellAt = (layer, x, y) => layer
  .getCell(Math.floor(x / ZX_SPECTRUM.CELL_WIDTH), Math.floor(y / ZX_SPECTRUM.CELL_HEIGHT));
const indexAt = (layer, x, y) => {
  const cell = cellAt(layer, x, y);
  const localX = x % ZX_SPECTRUM.CELL_WIDTH;
  const localY = y % ZX_SPECTRUM.CELL_HEIGHT;
  return cell.indices[localY * ZX_SPECTRUM.CELL_WIDTH + localX];
};

const drawLayer = LayerManager.getCurrentLayer();
const bg = LayerManager.layers[0];
bg.locked = false; // unlock for direct { layer: bg } writes below

// --- an upper indexed layer: right button paints paper, not transparency ---

PixelDrawRoutine.draw(10, 10, color(), DRAW_MODE.NORMAL);
check('left button on an indexed layer writes the ink index',
  indexAt(drawLayer, 10, 10) === ColorManager.getIndexedInk());

PixelDrawRoutine.draw(10, 10, color(), DRAW_MODE.NORMAL_ERASE);
check('right button on an indexed layer writes the paper index, not -1',
  indexAt(drawLayer, 10, 10) === ColorManager.getIndexedPaper());

// --- the ERASE primitive and the eraser tool still go transparent ---

PixelDrawRoutine.draw(20, 20, color(), DRAW_MODE.NORMAL);
PixelDrawRoutine.draw(20, 20, color(), DRAW_MODE.ERASE);
check('the ERASE primitive still clears an upper indexed pixel to transparent',
  indexAt(drawLayer, 20, 20) === -1);

PixelDrawRoutine.draw(30, 30, color(), DRAW_MODE.NORMAL);
PixelDrawRoutine.draw(30, 30, color(), DRAW_MODE.ERASE_ALL);
check('the eraser tool still clears an upper indexed pixel to transparent',
  indexAt(drawLayer, 30, 30) === -1);

// --- the background has nothing to inherit from, so right button and the
//     eraser both already land on the paper index there - unchanged ---

PixelDrawRoutine.draw(40, 40, color(), DRAW_MODE.NORMAL, { layer: bg });
PixelDrawRoutine.draw(40, 40, color(), DRAW_MODE.NORMAL_ERASE, { layer: bg });
check('right button on the background writes the paper index',
  indexAt(bg, 40, 40) === ColorManager.getIndexedPaper());

PixelDrawRoutine.draw(50, 50, color(), DRAW_MODE.NORMAL, { layer: bg });
PixelDrawRoutine.draw(50, 50, color(), DRAW_MODE.ERASE_ALL, { layer: bg });
check('the eraser tool on the background writes the paper index (nothing to inherit)',
  indexAt(bg, 50, 50) === ColorManager.getIndexedPaper());

summary('indexed-erase-modes');
