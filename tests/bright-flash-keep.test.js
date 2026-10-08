'use strict';
/**
 * Bright and Flash have a "use existing" state of their own, as Ink and Paper
 * do: a stroke can keep each cell's own BRIGHT and/or FLASH instead of writing
 * the toggles' values. ZX Paintbrush calls it transparent (BASIC's BRIGHT 8 /
 * FLASH 8); without it there was no way to change the ink of a mixed area and
 * keep each cell's bright, or to make cells flash without also setting bright.
 *
 * It is an explicit setting, never a side effect: with the boxes off, Bright
 * and Flash are written exactly as before (tests/recolour-attributes.test.js
 * pins that - the 2026-09-16 fix for the toggles silently doing nothing).
 *
 * "Existing" means what the page shows at that cell - the same rule as Ink and
 * Paper's boxes (LayerManager.attrsShowing). In ULAplus the two bits ARE the
 * CLUT and in ULANext they pick the paper bank, so keeping them keeps those.
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
/** Seed a cell on the current layer with known pixels and attributes. */
function seed(cx, cy, attrs) {
  const c = layer().getCell(cx, cy);
  c.pixels[0] = 0xA5;
  Object.assign(c, { ink: 1, paper: 6, bright: false, flash: false }, attrs);
  c.altered = true;
  return c;
}
const at = (cx, cy) => layer().getCell(cx, cy);

// ── 1. The state ────────────────────────────────────────────────────────────

enter('standard_ula');
resetColours();
check('ColorManager has a keep setting for Bright and for Flash',
  typeof ColorManager.setBrightTransparent === 'function' &&
  typeof ColorManager.setFlashTransparent === 'function');

ColorManager.setBrightTransparent(true);
ColorManager.setFlashTransparent(true);
let sel = ColorManager.getCurrentSelection();
check('the current selection carries both keeps', sel.brightTransparent === true && sel.flashTransparent === true);
check('...and the getters report them', ColorManager.isBrightTransparent() && ColorManager.isFlashTransparent());

ColorManager.setBright(true);
check('setting Bright clears its keep, as picking a colour clears Ink\'s',
  !ColorManager.isBrightTransparent() && ColorManager.isFlashTransparent());
ColorManager.setFlash(false);
check('setting Flash clears its keep', !ColorManager.isFlashTransparent());

ColorManager.setBrightTransparent(true);
ColorManager.setFlashTransparent(true);
ColorManager.setClut(2);
check('picking a CLUT clears both keeps (the CLUT is the two bits)',
  !ColorManager.isBrightTransparent() && !ColorManager.isFlashTransparent());

// ── 2. Every attribute-writing mode keeps what it is told to keep ───────────

const MODES = [
  ['Recolour (attributes only)', DRAW_MODE.ATTRIBUTES_ONLY],
  ['Normal, left button', DRAW_MODE.NORMAL],
  ['Normal, right button', DRAW_MODE.NORMAL_ERASE],
  ['XOR / Over', DRAW_MODE.XOR],
  ['XOR / Every Pass', DRAW_MODE.XOR_PIXEL],
  ['Ink Recolour', DRAW_MODE.INK],
  ['Paper Recolour', DRAW_MODE.PAPER]
];
const pick = { ink: 2, paper: 5, bright: true, flash: true,
  inkTransparent: false, paperTransparent: false };

for (const [label, mode] of MODES) {
  for (const seeded of [true, false]) {
    enter('standard_ula');
    seed(10, 10, { bright: seeded, flash: seeded });
    PixelDrawRoutine.draw(80, 80, { ...pick, bright: !seeded, flash: !seeded,
      brightTransparent: true }, mode);
    check(`${label}, Bright kept (cell ${seeded}): keeps the cell's bright, writes flash`,
      at(10, 10).bright === seeded && at(10, 10).flash === !seeded);

    enter('standard_ula');
    seed(10, 10, { bright: seeded, flash: seeded });
    PixelDrawRoutine.draw(80, 80, { ...pick, bright: !seeded, flash: !seeded,
      flashTransparent: true }, mode);
    check(`${label}, Flash kept (cell ${seeded}): keeps the cell's flash, writes bright`,
      at(10, 10).flash === seeded && at(10, 10).bright === !seeded);
  }
  enter('standard_ula');
  seed(10, 10, { bright: false, flash: false });
  PixelDrawRoutine.draw(80, 80, { ...pick }, mode);
  check(`${label}, nothing kept: Bright and Flash are written as before`,
    at(10, 10).bright === true && at(10, 10).flash === true);
}

// ── 3. Ink Recolour across a striped area keeps each cell's own bright ──────

enter('standard_ula');
resetColours();
seed(4, 4, { ink: 1, bright: true });
seed(5, 4, { ink: 1, bright: false });
ColorManager.setInk(3);
ColorManager.setBrightTransparent(true);
StateManager.setDrawMode('ink');
ToolManager.selectTool(TOOLS.BRUSH);
BrushEngine.setBrush('round'); BrushEngine.setSize(1);
{
  const t = ToolManager.getCurrentTool();
  t.onPointerDown(4 * 8 + 3, 4 * 8 + 3, ev());
  t.onPointerMove(5 * 8 + 3, 4 * 8 + 3, ev());
  t.onPointerUp(5 * 8 + 3, 4 * 8 + 3, ev());
}
check('Ink Recolour with Bright kept: both stripes take the new ink',
  at(4, 4).ink === 3 && at(5, 4).ink === 3);
check('...and each keeps its own bright', at(4, 4).bright === true && at(5, 4).bright === false);

// ── 4. "Existing" is what the page shows ────────────────────────────────────

enter('standard_ula');
resetColours();
{
  const bg = LayerManager.layers[0].getCell(12, 6);
  Object.assign(bg, { bright: true, flash: true, altered: true });
  ColorManager.setBrightTransparent(true);
  ColorManager.setFlashTransparent(true);
  PixelDrawRoutine.draw(12 * 8, 6 * 8, ColorManager.getCurrentSelection(), DRAW_MODE.ATTRIBUTES_ONLY);
  check('an empty upper-layer cell keeps the bright and flash the page shows from below',
    at(12, 6).bright === true && at(12, 6).flash === true && at(12, 6).ink === 2);
}

// ── 5. Fill attributes only: make a region flash and nothing else ───────────

enter('standard_ula');
resetColours();
for (const cx of [20, 21, 22]) seed(cx, 3, { ink: 5, paper: 0, bright: true, flash: false });
seed(23, 3, { ink: 2, paper: 0, bright: false, flash: false });
ColorManager.setInkTransparent(true);
ColorManager.setPaperTransparent(true);
ColorManager.setBrightTransparent(true);
ColorManager.setFlash(true);
ToolManager.selectTool(TOOLS.FILL);
{
  const t = ToolManager.getCurrentTool();
  t.setAttributesOnly(true);
  t.onPointerDown(20 * 8 + 1, 3 * 8 + 1, ev());
  t.onPointerUp(20 * 8 + 1, 3 * 8 + 1, ev());
  t.setAttributesOnly(false);
}
check('Fill attributes only with only Flash set: every matching cell now flashes',
  [20, 21, 22].every((cx) => at(cx, 3).flash === true));
check('...and keeps its ink, paper and bright',
  [20, 21, 22].every((cx) => at(cx, 3).ink === 5 && at(cx, 3).paper === 0 && at(cx, 3).bright === true));
check('...and a cell that did not match is untouched', at(23, 3).flash === false);

// ── 6. The eyedropper picks definite values ─────────────────────────────────

enter('standard_ula');
resetColours();
seed(2, 2, { ink: 4, paper: 1, bright: true, flash: true });
for (const k of ['Ink', 'Paper', 'Bright', 'Flash']) ColorManager['set' + k + 'Transparent'](true);
ToolManager.selectTool(TOOLS.EYEDROPPER);
{
  const t = ToolManager.getCurrentTool();
  t.onPointerDown(2 * 8 + 1, 2 * 8 + 1, ev());
  t.onPointerUp(2 * 8 + 1, 2 * 8 + 1, ev());
}
check('an eyedropper pick clears all four keeps',
  !ColorManager.isInkTransparent() && !ColorManager.isPaperTransparent() &&
  !ColorManager.isBrightTransparent() && !ColorManager.isFlashTransparent());
check('...and takes the cell\'s bright and flash', ColorManager.getBright() && ColorManager.getFlash());

// ── 7. The brush cursor's dot shows the colour the click will leave ─────────

enter('standard_ula');
resetColours();
seed(7, 7, { ink: 1, paper: 6, bright: true });
ColorManager.setInk(2);
ColorManager.setBright(false);
ColorManager.setBrightTransparent(true);
check('the size-1 dot shows the new ink at the cell\'s own bright (2 + 8)',
  PixelDrawRoutine.previewInkIndex(7 * 8 + 1, 7 * 8 + 1) === 10);
ColorManager.setBrightTransparent(false);
check('...and at the toggle\'s bright once the keep is off',
  PixelDrawRoutine.previewInkIndex(7 * 8 + 1, 7 * 8 + 1) === 2);

// ── 8. Screen modes ─────────────────────────────────────────────────────────

// GigaScreen: one keep covers both screens, each keeping its own value
enter('gigascreen');
resetColours();
{
  const c = layer().getCell(9, 9);
  c.pixels[0] = 0xF0; c.pixelsB[0] = 0x0F;
  Object.assign(c, { ink: 1, paper: 6, bright: true, flash: false,
    inkB: 1, paperB: 6, brightB: false, flashB: false, altered: true });
  ColorManager.setBrightB(true);
  ColorManager.setBright(false);
  ColorManager.setBrightTransparent(true);
  PixelDrawRoutine.draw(9 * 8, 9 * 8, ColorManager.getCurrentSelection(), DRAW_MODE.ATTRIBUTES_ONLY);
  check('GigaScreen, Bright kept: screen A keeps its bright', c.bright === true);
  check('GigaScreen, Bright kept: screen B keeps its own (different) bright', c.brightB === false);
}

// ULAplus: the two bits are the CLUT, so keeping them keeps each cell's CLUT
enter('ula_plus');
resetColours();
seed(3, 3, { bright: true, flash: true });
ColorManager.setClut(0);
ColorManager.setBrightTransparent(true);
ColorManager.setFlashTransparent(true);
check('ULAplus has cell attributes, so the keeps are in force',
  ColorManager.isBrightTransparent() && ColorManager.isFlashTransparent());
PixelDrawRoutine.draw(3 * 8, 3 * 8, ColorManager.getCurrentSelection(), DRAW_MODE.ATTRIBUTES_ONLY);
check('ULAplus, CLUT kept: the cell stays in CLUT 3',
  at(3, 3).bright === true && at(3, 3).flash === true);

// ULANext: the two bits pick the paper bank
enter('ulanext');
resetColours();
seed(3, 3, { paper: 1, bright: true, flash: false });
ColorManager.setPaper(4);
ColorManager.setBrightTransparent(true);
ColorManager.setFlashTransparent(true);
PixelDrawRoutine.draw(3 * 8, 3 * 8, ColorManager.getCurrentSelection(), DRAW_MODE.PAPER);
check('ULANext, both kept: the new paper lands in the cell\'s own bank',
  at(3, 3).paper === 4 && at(3, 3).bright === true && at(3, 3).flash === false);

// No cell attributes: the keeps report off, as Ink and Paper's do
for (const m of ['timex_hires', 'layer2_256']) {
  enter(m);
  ColorManager.setBrightTransparent(true);
  ColorManager.setFlashTransparent(true);
  sel = ColorManager.getCurrentSelection();
  check(`${m}: no cell attributes, so the keeps report off`,
    !ColorManager.isBrightTransparent() && !sel.brightTransparent && !sel.flashTransparent);
}
enter('standard_ula');
check('...and they come back where cells have attributes',
  ColorManager.isBrightTransparent() && ColorManager.isFlashTransparent());

resetColours();
summary('bright-flash-keep');
