'use strict';
/**
 * Brush XOR / Pixel = toggle on every WRITE, no once-per-stroke memory.
 *
 * This is the counterpart to brush-xor.test.js: DRAW_MODE.XOR gates each pixel to
 * flip at most once per batch (see the guard in PixelDrawRoutine.draw()) so an
 * overlapping stroke stays solid. DRAW_MODE.XOR_PIXEL deliberately skips that
 * guard, so the SAME overlapping stamps that stay solid under 'xor' visibly
 * cancel under 'xor_pixel' — a straight drag toggles a pixel once for every
 * stamp that lands on it, and applyContinuousBrush spaces stamps at half the
 * brush size, so most interior pixels are covered by an even number of stamps
 * and end up erased, leaving only the odd-covered fringe lit.
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
BrushEngine.setDrawMode('xor_pixel');

// The same straight horizontal drag brush-xor.test.js uses — solid under 'xor'.
const stroke = () => {
  tool.onPointerDown(40, 40, ev);
  tool.onPointerMove(60, 40, ev);
  tool.onPointerMove(80, 40, ev);
  tool.onPointerMove(100, 40, ev);
  tool.onPointerUp(100, 40, ev);
};

stroke();
let holes = 0;
for (let x = 44; x <= 96; x++) if (!isInk(x, 40)) holes++;   // clear of the endpoints' fringe
check('brush/xor_pixel: an overlapping stroke visibly cancels itself, unlike xor', holes > 0);

// A single tap (no overlap at all) still toggles exactly like 'xor' would.
LayerManager.getCurrentLayer().clear();
tool.onPointerDown(150, 40, ev);
tool.onPointerUp(150, 40, ev);
check('brush/xor_pixel: a single non-overlapping stamp still draws', isInk(150, 40));

summary();
