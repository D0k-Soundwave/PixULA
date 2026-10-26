'use strict';
/**
 * The Eraser's colours option (batch 4 part 4B): 'keep' is the eraser as it always was; 'set' is ZX
 * Paintbrush's wiping tool - the dots are cleared AND the cell takes the rail's colours (through the
 * right-button primitive, so Bright and Flash "use existing" are honoured). Only where cells have colours.
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
for (const f of ['brush-tool.js', 'fill-tool.js', 'shape-tool.js', 'eraser-tool.js', 'eyedropper-tool.js']) {
  loadModule('js/tools/' + f);
}

ColorManager.initialize();
BrushEngine.initialize();
ToolManager.register(new BrushTool());
ToolManager.register(new FillTool());
ToolManager.register(new ShapeTool());
ToolManager.register(new EraserTool());
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

/** A block of cells (2..4, 2..3) filled with dots, in ink 1 on paper 6, bright. */
function fillBlock() {
  for (let cy = 2; cy <= 3; cy++) {
    for (let cx = 2; cx <= 4; cx++) {
      const c = layer().getCell(cx, cy);
      c.pixels.fill(0xFF);
      Object.assign(c, { ink: 1, paper: 6, bright: true, flash: false });
      c.altered = true;
    }
  }
}
function wipe() {
  ToolManager.selectTool(TOOLS.ERASER);
  const t = ToolManager.getCurrentTool();
  t.setSize(8);
  return t;
}
function run(t) {
  t.onPointerDown(24, 20, ev());
  t.onPointerMove(36, 20, ev());
  t.onPointerUp(36, 20, ev());
}
const cell = (cx, cy) => layer().getCell(cx, cy);
const dotsOf = (cx, cy) => Array.from(cell(cx, cy).pixels).join(',');

// -- 1. The option --------------------------------------------------------------------------------------

enter('standard_ula'); resetColours();
{
  const t = wipe();
  check('the eraser starts by keeping colours', t.getEraserColours() === 'keep');
  t.setEraserColours('set'); check('"set" is accepted', t.getEraserColours() === 'set');
  t.setEraserColours('banana'); check('anything else becomes "keep"', t.getEraserColours() === 'keep');
}

// -- 2. Keep: byte-identical to the eraser as it was ----------------------------------------------------------------

{
  enter('standard_ula'); resetColours(); fillBlock();
  const t = wipe(); t.setEraserColours('keep');
  run(t);
  check('keep: dots are cleared along the stroke', cell(3, 2).pixels[4] === 0);
  check('keep: the cell\'s colours are not touched (ink 1, paper 6, bright)',
    cell(2, 2).ink === 1 && cell(2, 2).paper === 6 && cell(2, 2).bright === true);
  check('keep: the hover mark is the eraser\'s own mode', t.markWrite() === DRAW_MODE.ERASE_ALL);
}

// -- 3. Set: the wiping tool ------------------------------------------------------------------------------------------

{
  enter('standard_ula'); resetColours(); fillBlock();
  const t = wipe(); t.setEraserColours('set');
  run(t);
  check('set: the dots are cleared', cell(3, 2).pixels[4] === 0);
  check('set: the cell takes the rail\'s colours (ink 2, paper 5, no bright)',
    cell(3, 2).ink === 2 && cell(3, 2).paper === 5 && cell(3, 2).bright === false);
  check('set: a cell the stroke did not reach is untouched', cell(3, 3).ink === 1 && cell(3, 3).pixels[0] === 0xFF);
  check('set: the hover mark follows the option', t.markWrite() === DRAW_MODE.NORMAL_ERASE);
}

// Bright on "use existing": the wiped cell keeps its own bright.
{
  enter('standard_ula'); resetColours(); fillBlock();
  ColorManager.setBrightTransparent(true);
  const t = wipe(); t.setEraserColours('set');
  run(t);
  check('set + Bright "use existing": the cell keeps its own bright', cell(3, 2).bright === true && cell(3, 2).ink === 2);
  ColorManager.setBrightTransparent(false);
}

// -- 4. Modes with no cell colours ----------------------------------------------------------------------------------

for (const mode of ['layer2_256', 'timex_hires']) {
  const go = (opt) => {
    enter(mode); resetColours();
    const t = wipe(); t.setEraserColours(opt);
    // paint something first so there is something to wipe
    PixelDrawRoutine.draw(25, 20, ColorManager.getCurrentSelection(), DRAW_MODE.NORMAL, { mirror: false });
    run(t);
    const c = layer().getCell(3, 2);
    const out = JSON.stringify(Array.from(c.indices || c.pixels));
    t.setEraserColours('keep');
    return out;
  };
  check(`${mode}: a stored "set" writes exactly what "keep" does`, go('set') === go('keep'));
  const t = wipe(); t.setEraserColours('set');
  check(`${mode}: ...and the hover mark says so`, t.markWrite() === DRAW_MODE.ERASE_ALL);
  t.setEraserColours('keep');
}

summary();
