'use strict';
/**
 * Fill tool, "Fill attributes" (the attribute flood fill).
 *
 *   1. The flood stays inside the picture: it never wraps from the last
 *      column into column 0 of the next row, or from column 0 back into the
 *      last column of the row above.
 *   2. Where the mode has no cell colours the option is not offered, and a
 *      value left on (by a preset) counts as off: the click is a plain fill.
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
loadModule('js/tools/figure-model.js');
loadModule('js/tools/figure-editor.js');
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
/** Seed a cell on the current layer with known pixels and attributes. */
function seed(cx, cy, attrs) {
  const c = layer().getCell(cx, cy);
  c.pixels[0] = 0xA5;
  Object.assign(c, { ink: 1, paper: 6, bright: false, flash: false }, attrs);
  c.altered = true;
  return c;
}
const at = (cx, cy) => layer().getCell(cx, cy);

const COLS = () => ZX_SPECTRUM.GRID_COLS;
const ROWS = () => ZX_SPECTRUM.GRID_ROWS;

/** Every cell ink 0 paper 7, then one column given paper 2 as a wall. */
function wallAt(col) {
  enter('standard_ula');
  resetColours();
  for (let cy = 0; cy < ROWS(); cy++) {
    for (let cx = 0; cx < COLS(); cx++) {
      Object.assign(at(cx, cy), { ink: 0, paper: cx === col ? 2 : 7, bright: false, flash: false, altered: true });
    }
  }
}
function attrFillAt(cx, cy) {
  ColorManager.setInk(3);
  ColorManager.setPaper(4);
  ToolManager.selectTool(TOOLS.FILL);
  const t = ToolManager.getCurrentTool();
  t.setAttributesOnly(true);
  t.onPointerDown(cx * 8 + 1, cy * 8 + 1, ev());
  t.onPointerUp(cx * 8 + 1, cy * 8 + 1, ev());
  t.setAttributesOnly(false);
}
const untouched = (cx, cy) => at(cx, cy).ink === 0 && at(cx, cy).paper === 7;
const filled = (cx, cy) => at(cx, cy).ink === 3 && at(cx, cy).paper === 4;

// -- 1. No wrap across the picture's edges --------------------------------

// Wall in column 1, fill right of it: column 0 is on the far side of the wall.
wallAt(1);
attrFillAt(12, 6);
check('fill right of a wall in column 1 fills up to the right edge', filled(31, 0) && filled(2, 23));
{
  const leaked = [];
  for (let cy = 0; cy < ROWS(); cy++) if (!untouched(0, cy)) leaked.push(cy);
  check('...and column 0, left of the wall, is untouched (no wrap from column 31)',
    leaked.length === 0, `rows ${leaked.join(',')}`);
}
check('...and the wall keeps its paper', at(1, 5).paper === 2);

// Wall in column 1, fill column 0: the last column is on the far side.
wallAt(1);
attrFillAt(0, 5);
check('fill left of a wall in column 1 fills column 0 top to bottom', filled(0, 0) && filled(0, 23));
{
  const leaked = [];
  for (let cy = 0; cy < ROWS(); cy++) if (!untouched(31, cy)) leaked.push(cy);
  check('...and the last column is untouched (no wrap from column 0)',
    leaked.length === 0, `rows ${leaked.join(',')}`);
}

// -- 2. No cell colours: no option, and a value left on counts as off -----

const fillRow = FillTool.optionsSchema.find(e => e.key === 'attributesOnly');
check('the Fill attributes row is shown only where cells have colours',
  !!fillRow.showIf && fillRow.showIf.cells === true);

for (const m of ['timex_hires', 'layer2_256', 'lores']) {
  enter(m);
  resetColours();
  ToolManager.selectTool(TOOLS.FILL);
  const t = ToolManager.getCurrentTool();
  t.setAttributesOnly(true);
  const dot = () => { const st = PixelDrawRoutine.getPixelState(20, 20); return `${st.isInk}/${st.index}`; };
  const before = dot();
  t.onPointerDown(20, 20, ev());
  t.onPointerUp(20, 20, ev());
  t.setAttributesOnly(false);
  const after = dot();
  check(`${m}: with Fill attributes left on, a click is a plain fill`, before !== after, `${before} -> ${after}`);
}

resetColours();
summary('fill-attributes');
