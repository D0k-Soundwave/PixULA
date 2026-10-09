'use strict';
/**
 * Inverse (batch 4 part 4A): ZX Paintbrush's INVERSE 1. The two mouse buttons swap what they do,
 * in every tool that asks PixelDrawRoutine.resolveUserMode: left clears dots and right sets them.
 * The draw modes that give both buttons the same job (Ink, Paper, XOR) have nothing to swap.
 */
const { loadModule, check, summary } = require('./helpers/zx-stubs');
const { withBlit } = require('./helpers/canvas-stub.js');

global.window = global;
global.Logger = { info() {}, debug() {}, warn() {}, error() {} };
for (const m of ['js/core/constants.js', 'js/utils/helpers.js', 'js/utils/validators.js',
  'js/core/event-bus.js', 'js/core/state-manager.js', 'js/core/attribute-system.js']) {
  loadModule(m);
}

global.CanvasSystem = withBlit({
  setPixel() {}, markCellDirty() {}, requestRender() {}, _render() {},
  getColorIndex(b, br) { return b === 0 ? 0 : b + (br ? 8 : 0); },
  setCanvasCursor() {}, onReady(cb) { cb(); }, composeToCanvas() {},
  getIframeDocument() { return null; }, getCanvasElement() { return null; },
  createOverlayCanvas() { return null; },
  getScrollPosition() { return { x: 0, y: 0 }; }, setScrollPosition() {},
  getViewportSize() { return { width: 512, height: 384 }; },
  getScale() { return 1; }, getScaleFor(z) { return z / 100; },
  setZoom() {}, zoomTo() {}, zoomToRect() {}, fitZoom() { return 100; }, zoomToFit() {}
});
global.setInterval = () => 0;
global.Storage = { get: async () => undefined, set: async () => {}, STORES: {} };
global.GridOverlay = new Proxy({}, {
  get(target, prop) {
    if (prop === 'getFunctionPreviewContext' || prop === 'getCompositePreviewContext') {
      return () => null;
    }
    return () => {};
  }
});
global.UndoRedo = {
  beginAction() {}, endAction() {}, cancelAction() {}, snapshot() {},
  initialize() {}, revertAction() {}, revertLast() {}, peekLast() { return null; }
};
global.ClipboardCodec = { encode() { return null; }, decode() { return null; } };

loadModule('js/core/layer-manager.js');
loadModule('js/core/color-manager.js');
loadModule('js/core/pixel-draw-routine.js');
loadModule('js/services/pattern-service.js');
loadModule('js/services/selection-service.js');
loadModule('js/data/zx-rom-font.js');
loadModule('js/tools/tool-base.js');
loadModule('js/tools/tool-manager.js');
loadModule('js/utils/brush-shapes.js');
loadModule('js/tools/brush-engine.js');
loadModule('js/tools/shape-generator.js');
loadModule('js/utils/mask-ops.js');
loadModule('js/utils/coverage-ops.js');
loadModule('js/utils/font-rasterizer.js');
for (const f of ['brush-tool.js', 'fill-tool.js', 'shape-tool.js', 'eyedropper-tool.js']) {
  loadModule('js/tools/' + f);
}

ColorManager.initialize();
BrushEngine.initialize();
ToolManager.register(new BrushTool());
ToolManager.register(new FillTool());
ToolManager.register(new ShapeTool());
ToolManager.register(new EyedropperTool());
ToolManager.initialize(TOOLS.BRUSH);

const ev = (over = {}) => ({ button: 0, buttons: 1, pressure: 1, clientX: 0, clientY: 0,
  preventDefault() {}, stopPropagation() {}, ...over });

function enter(modeId) {
  __setActiveScreenMode(modeId);
  AttributeSystem.clearAll();
  ColorManager.applyScreenMode();
  LayerManager.initialize();
  StateManager.setDrawMode('normal');
}

function resetColours() {
  for (const k of ['Ink', 'Paper', 'Bright', 'Flash']) ColorManager['set' + k + 'Transparent'](false);
  ColorManager.setInk(2);
  ColorManager.setPaper(5);
  ColorManager.setBright(false);
  ColorManager.setFlash(false);
}
const layer = () => LayerManager.getCurrentLayer();
/** Is pixel (x, y) of the current layer set? Cell 8 wide, rows hold the bits MSB first. */
const dot = (x, y) => {
  const c = layer().getCell(Math.floor(x / 8), Math.floor(y / 8));
  return ((c.pixels[y % 8] >> (7 - (x % 8))) & 1) === 1;
};
const left = (t, x, y) => { t.onPointerDown(x, y, ev()); t.onPointerUp(x, y, ev()); };
const right = (t, x, y) => {
  const e = ev({ button: 2, buttons: 2 });
  t.onPointerDown(x, y, e); t.onPointerUp(x, y, e);
};

// -- 1. The state ------------------------------------------------------------

{
  const seen = [];
  EventBus.on(EVENTS.INVERSE_CHANGED, (p) => seen.push(p.inverse));
  check('Inverse starts off', StateManager.getInverse() === false);
  StateManager.setInverse(true);
  check('it turns on, with one event', StateManager.getInverse() === true && seen.length === 1 && seen[0] === true);
  StateManager.setInverse(false);
  check('...and off again', StateManager.getInverse() === false && seen.length === 2);
  StateManager.setInverse('yes');
  check('only a real true turns it on', StateManager.getInverse() === false);
}

// -- 2. resolveUserMode: every draw mode, both buttons, Inverse off and on -------

{
  const D = DRAW_MODE;
  // [draw mode, left, right, left with Inverse, right with Inverse]
  const table = [
    ['normal',     D.NORMAL,   D.NORMAL_ERASE, D.NORMAL_ERASE, D.NORMAL],
    ['pixel_only', D.PIXEL_ONLY, D.ERASE,      D.ERASE,        D.PIXEL_ONLY],
    ['ink',        D.INK,      D.INK,          D.INK,          D.INK],
    ['paper',      D.PAPER,    D.PAPER,        D.PAPER,        D.PAPER],
    ['xor',        D.XOR,      D.XOR,          D.XOR,          D.XOR],
    ['xor_pixel',  D.XOR_PIXEL, D.XOR_PIXEL,   D.XOR_PIXEL,    D.XOR_PIXEL]
  ];
  for (const [mode, l, r, li, ri] of table) {
    StateManager.setDrawMode(mode);
    StateManager.setInverse(false);
    check(`${mode}: left ${l}, right ${r} with Inverse off`,
      PixelDrawRoutine.resolveUserMode(true) === l && PixelDrawRoutine.resolveUserMode(false) === r);
    StateManager.setInverse(true);
    check(`${mode}: left ${li}, right ${ri} with Inverse on`,
      PixelDrawRoutine.resolveUserMode(true) === li && PixelDrawRoutine.resolveUserMode(false) === ri);
  }
  StateManager.setDrawMode('normal');
  StateManager.setInverse(false);
  check('a pattern\'s gap pixels clear in Normal', PixelDrawRoutine.resolvePatternGapMode() === D.NORMAL_ERASE);
  StateManager.setInverse(true);
  check('...and set with Inverse on (the pattern comes out inverted)', PixelDrawRoutine.resolvePatternGapMode() === D.NORMAL);
  StateManager.setInverse(false);
}

// -- 3. The brush: the buttons swap ------------------------------------------

enter('standard_ula');
resetColours();
ToolManager.selectTool(TOOLS.BRUSH);
BrushEngine.setSize ? BrushEngine.setSize(1) : null;
{
  const t = ToolManager.getCurrentTool();
  left(t, 3, 3);
  check('Inverse off: the left button sets a dot', dot(3, 3));
  right(t, 3, 3);
  check('...and the right button clears it', !dot(3, 3));

  StateManager.setInverse(true);
  right(t, 5, 5);
  check('Inverse on: the right button sets a dot', dot(5, 5));
  left(t, 5, 5);
  check('...and the left button clears it', !dot(5, 5));
  StateManager.setInverse(false);
}

// -- 4. The Fill tool: "already filled" asks what the click writes --------------

enter('standard_ula');
resetColours();
ToolManager.selectTool(TOOLS.FILL);
{
  const t = ToolManager.getCurrentTool();
  StateManager.setInverse(true);
  // A blank layer is all clear. With Inverse on the right button writes INK,
  // so it must fill; before the fix the raw button said "paper" and the
  // click returned as "already filled".
  right(t, 100, 100);
  check('Inverse on: a right-button fill on blank paper sets the dots', dot(100, 100) && dot(10, 10));
  // The left button now writes paper, so on the filled region it clears it.
  left(t, 100, 100);
  check('...and a left-button fill clears them again', !dot(100, 100) && !dot(10, 10));
  StateManager.setInverse(false);
  left(t, 100, 100);
  check('Inverse off: the left button fills as always', dot(100, 100));
}

// -- 5. Indexed modes: the same swap, painting the paper index -------------------

enter('layer2_256');
{
  StateManager.setDrawMode('normal');
  const ink = ColorManager.getIndexedInk();
  const paper = ColorManager.getIndexedPaper();
  check('(setup) ink and paper indices differ', ink !== paper);
  const sel = ColorManager.getCurrentSelection();
  const L = LayerManager.getCurrentLayer();
  const idxAt = (x, y) => {
    const c = L.getCell(Math.floor(x / ZX_SPECTRUM.CELL_WIDTH), Math.floor(y / ZX_SPECTRUM.CELL_HEIGHT));
    return c && c.indices ? c.indices[(y % ZX_SPECTRUM.CELL_HEIGHT) * ZX_SPECTRUM.CELL_WIDTH + (x % ZX_SPECTRUM.CELL_WIDTH)] : null;
  };
  StateManager.setInverse(false);
  PixelDrawRoutine.draw(7, 7, sel, PixelDrawRoutine.resolveUserMode(true));
  check('indexed, Inverse off: the left button paints the ink index', idxAt(7, 7) === ink);
  StateManager.setInverse(true);
  PixelDrawRoutine.draw(9, 9, sel, PixelDrawRoutine.resolveUserMode(true));
  check('indexed, Inverse on: the left button paints the paper index', idxAt(9, 9) === paper);
  PixelDrawRoutine.draw(11, 11, sel, PixelDrawRoutine.resolveUserMode(false));
  check('indexed, Inverse on: the right button paints the ink index', idxAt(11, 11) === ink);
  StateManager.setInverse(false);
}

// -- 6. Shapes: outline and filled, both buttons ------------------------------------------------------------------

enter('standard_ula');
resetColours();
ToolManager.selectTool(TOOLS.RECTANGLE);
{
  const t = ToolManager.getCurrentTool();
  const drawRect = (button) => {
    const e = ev({ button, buttons: button === 2 ? 2 : 1 });
    t.onPointerDown(20, 20, e);
    t.onPointerUp(60, 60, e);
  };
  t.setFilled(false);
  StateManager.setInverse(false);
  drawRect(0);
  check('Inverse off: a left-button outline sets its dots', dot(20, 20) && dot(40, 20) && !dot(40, 40));
  drawRect(2);
  check('...and the right button clears them again', !dot(20, 20) && !dot(40, 20));

  StateManager.setInverse(true);
  drawRect(2);
  check('Inverse on: a right-button outline SETS its dots', dot(20, 20) && dot(40, 20));
  drawRect(0);
  check('...and the left button clears them', !dot(20, 20) && !dot(40, 20));

  t.setFilled(true);
  drawRect(2);
  check('Inverse on: a right-button FILLED shape sets the whole area', dot(40, 40) && dot(21, 21));
  drawRect(0);
  check('...and the left button clears the whole area', !dot(40, 40) && !dot(21, 21));
  StateManager.setInverse(false);
  t.setFilled(false);
}

summary();
