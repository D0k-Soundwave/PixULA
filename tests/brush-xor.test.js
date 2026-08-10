'use strict';
/**
 * Brush XOR = once-per-STROKE toggle.
 *
 * A brush stroke writes each pixel many times over: applyContinuousBrush spaces
 * stamps at half the brush size so they overlap, each segment restamps its start
 * point, and pointer moves/coalesced events revisit pixels. XOR toggles, so
 * without a per-stroke memory those repeats cancel and the stroke breaks into a
 * row of disconnected stamps instead of a fluid line. The guard lives in
 * PixelDrawRoutine (DRAW_MODE.XOR flips a pixel at most once per batch); this
 * suite drives the REAL BrushTool through the REAL routine and reads the result
 * back. re-XORing the identical stroke must still erase it to blank.
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
  setCanvasCursor() {}, onReady(cb) { cb(); },
  getIframeDocument() { return null; }, getCanvasElement() { return null; },
  createOverlayCanvas() { return null; },
  getScrollPosition() { return { x: 0, y: 0 }; }, setScrollPosition() {}
};
global.ColorManager = {
  _sel: { ink: 0, paper: 7, bright: false, flash: false, inkTransparent: false, paperTransparent: false },
  getCurrentSelection() { return { ...this._sel }; }
};
global.PatternService = {
  getCurrentPattern() { return { id: 'checker' }; },
  getCurrentPatternData() { return null; },
  shouldDrawPixel(x, y) { return (x + y) % 2 === 0; }
};
global.SelectionService = {
  isFloating() { return false; }, endFloatingPaste() {}, clear() {},
  hasSelection() { return false; }, getSelection() { return null; },
  hasClipboard() { return false; }
};

loadModule('js/core/layer-manager.js');
loadModule('js/core/pixel-draw-routine.js');
loadModule('js/data/zx-rom-font.js');
loadModule('js/tools/tool-base.js');
loadModule('js/tools/tool-manager.js');
loadModule('js/utils/brush-shapes.js');
loadModule('js/tools/brush-engine.js');
loadModule('js/tools/shape-generator.js');
loadModule('js/tools/brush-tool.js');

LayerManager.initialize();
BrushEngine.initialize();

const layer = LayerManager.getCurrentLayer();
layer.locked = false;

const isInk = (x, y) => {
  const st = PixelDrawRoutine.getPixelState(x, y, { layer });
  return !!(st && st.isInk);
};
const ev = { pressure: 1, button: 0, buttons: 1 };

const tool = new BrushTool();
tool.activate();
BrushEngine.setBrush('round');
BrushEngine.setSize(8);
BrushEngine.setDrawMode('xor');

// A straight horizontal drag — the overlapping stamps that cancelled before.
const stroke = () => {
  tool.onPointerDown(40, 40, ev);
  tool.onPointerMove(60, 40, ev);
  tool.onPointerMove(80, 40, ev);
  tool.onPointerMove(100, 40, ev);
  tool.onPointerUp(100, 40, ev);
};
const bandInk = () => {
  let n = 0;
  for (let y = 30; y < 50; y++) for (let x = 30; x <= 110; x++) if (isInk(x, y)) n++;
  return n;
};

stroke();
let solid = true;
for (let x = 40; x <= 100; x++) if (!isInk(x, 40)) solid = false;   // between the endpoints
check('brush/xor: stroke is continuous, not a row of stamps', solid);

stroke();
check('brush/xor: re-XORing the same stroke erases it', bandInk() === 0);

summary();
