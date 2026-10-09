'use strict';
/**
 * Colour core (batch 4 part 4A): ZX Paintbrush's "colour attribute line thickness". A thick line
 * sets ALL its dots, but only the cells under its 1- or 4-pixel-wide core take the colours, so
 * thick lines clash less. The rule lives in PixelDrawRoutine.draw (classifyCore); the brush owns
 * the core of its whole path (it is not built from the stamps, which sit size / 2 apart).
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
for (const f of ['brush-tool.js', 'fill-tool.js', 'shape-tool.js', 'bezier-tool.js', 'eyedropper-tool.js']) {
  loadModule('js/tools/' + f);
}

ColorManager.initialize();
BrushEngine.initialize();
ToolManager.register(new BrushTool());
ToolManager.register(new FillTool());
ToolManager.register(new ShapeTool());
ToolManager.register(new BezierTool());
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
const CW = () => ZX_SPECTRUM.CELL_WIDTH;
const CH = () => ZX_SPECTRUM.CELL_HEIGHT;

/** Every set dot of the current layer, as "x,y" keys. */
function dots() {
  const out = new Set();
  const L = layer();
  for (let cy = 0; cy < ZX_SPECTRUM.GRID_ROWS; cy++) {
    for (let cx = 0; cx < ZX_SPECTRUM.GRID_COLS; cx++) {
      const c = L.getCell(cx, cy);
      if (!c || !c.altered) continue;
      for (let r = 0; r < CH(); r++) {
        for (let b = 0; b < CW(); b++) {
          if ((c.pixels[r] >> (CW() - 1 - b)) & 1) out.add((cx * CW() + b) + ',' + (cy * CH() + r));
        }
      }
    }
  }
  return out;
}
/** Cells that took the rail colours (ink 2 on paper 5 by default), as "cx,cy". */
function colouredCells(ink = 2, paper = 5) {
  const out = new Set();
  const L = layer();
  for (let cy = 0; cy < ZX_SPECTRUM.GRID_ROWS; cy++) {
    for (let cx = 0; cx < ZX_SPECTRUM.GRID_COLS; cx++) {
      const c = L.getCell(cx, cy);
      if (c && c.altered && c.ink === ink && c.paper === paper) out.add(cx + ',' + cy);
    }
  }
  return out;
}
const sameSet = (a, b) => a.size === b.size && [...a].every((k) => b.has(k));
const subset = (a, b) => [...a].every((k) => b.has(k));
const rightClick = () => ev({ button: 2, buttons: 2 });
const cellOf = (x, y) => Math.floor(x / 8) + ',' + Math.floor(y / 8);

/** The brush stroke used throughout: size 8, down at (20,20), one drag to (70,52). */
function brushStroke(core) {
  enter('standard_ula');
  resetColours();
  ToolManager.selectTool(TOOLS.BRUSH);
  const t = ToolManager.getCurrentTool();
  t.setSize(8);
  t.setColourCore(core);
  t.onPointerDown(20, 20, ev());
  t.onPointerMove(70, 52, ev());
  t.onPointerUp(70, 52, ev());
  return { dots: dots(), cells: colouredCells() };
}

/** The cells a one-pixel-wide centre line from (x0,y0) to (x1,y1) passes through. */
function centreLineCells(x0, y0, x1, y1) {
  const out = new Set();
  ToolBase.forEachLinePoint(x0, y0, x1, y1, (x, y) => out.add(cellOf(x, y)));
  return out;
}

// -- 1. The option: stored, validated, and off by default ------------------------

enter('standard_ula');
{
  ToolManager.selectTool(TOOLS.BRUSH);
  const t = ToolManager.getCurrentTool();
  check('the brush starts with the whole line coloured', t.getColourCore() === 'whole');
  t.setColourCore('1'); check('1 pixel is accepted', t.getColourCore() === '1');
  t.setColourCore('4'); check('4 pixels is accepted', t.getColourCore() === '4');
  t.setColourCore('banana'); check('anything else becomes the whole line', t.getColourCore() === 'whole');
}

// -- 2. Brush: every dot is set, only the core's cells take the colours -------------

{
  const whole = brushStroke('whole');
  const one = brushStroke('1');
  const four = brushStroke('4');
  const centre = centreLineCells(20, 20, 70, 52);

  check('(setup) the whole-line stroke coloured more cells than the centre line crosses', whole.cells.size > centre.size);
  check('a 1-pixel core sets exactly the same dots as the whole line', sameSet(whole.dots, one.dots));
  check('a 4-pixel core sets exactly the same dots as the whole line', sameSet(whole.dots, four.dots));
  check('a 1-pixel core colours every cell the centre line crosses', subset(centre, one.cells));
  check('...and only those: no cell the centre line misses', sameSet(one.cells, centre));
  check('a 4-pixel core colours at least the 1-pixel core\'s cells', subset(one.cells, four.cells));
  check('...and no more than the whole line', subset(four.cells, whole.cells));
  check('...and fewer than the whole line on this stroke', four.cells.size < whole.cells.size);
}

// -- 3. A brush no thicker than the core is unchanged ----------------------------------

{
  const run = (core) => {
    enter('standard_ula'); resetColours();
    ToolManager.selectTool(TOOLS.BRUSH);
    const t = ToolManager.getCurrentTool();
    t.setSize(1); t.setColourCore(core);
    t.onPointerDown(20, 20, ev()); t.onPointerMove(70, 52, ev()); t.onPointerUp(70, 52, ev());
    const out = colouredCells();
    t.setColourCore('whole');
    return out;
  };
  check('size 1 with a 1-pixel core colours exactly what it did without the option', sameSet(run('whole'), run('1')));
}

// -- 4. The right button: dots cleared everywhere, colours only in the core ----------------

{
  enter('standard_ula'); resetColours();
  ToolManager.selectTool(TOOLS.BRUSH);
  const t = ToolManager.getCurrentTool();
  t.setSize(8);
  t.setColourCore('whole');
  t.onPointerDown(30, 30, ev()); t.onPointerMove(60, 30, ev()); t.onPointerUp(60, 30, ev());
  t.setColourCore('1');
  ColorManager.setInk(1); ColorManager.setPaper(6);
  const e = rightClick();
  t.onPointerDown(30, 30, e); t.onPointerMove(60, 30, e); t.onPointerUp(60, 30, e);
  check('(setup) the right-button stroke cleared dots along the line', !dots().has('45,30'));
  check('the right button with a core colours only the centre line\'s cells',
    sameSet(colouredCells(1, 6), centreLineCells(30, 30, 60, 30)));
  t.setColourCore('whole');
}

// -- 5. Shapes: an outline thicker than the core ----------------------------------------------

{
  const run = (core) => {
    enter('standard_ula'); resetColours();
    ToolManager.selectTool(TOOLS.RECTANGLE);
    const t = ToolManager.getCurrentTool();
    t.setThickness(5);
    t.setColourCore(core);
    t.onPointerDown(24, 24, ev()); t.onPointerUp(88, 72, ev());
    return { dots: dots(), cells: colouredCells() };
  };
  const whole = run('whole'), one = run('1');
  const centre = new Set();
  const rect = ShapeGenerator.generateShape('rectangle', { x1: 24, y1: 24, x2: 88, y2: 72 }, { thickness: 1 });
  for (const p of rect) centre.add(cellOf(p.x, p.y));
  check('a thick rectangle with a 1-pixel core sets the same dots', whole.dots.size > 0 && sameSet(whole.dots, one.dots));
  check('...colours exactly the cells the 1-pixel outline crosses', sameSet(one.cells, centre));
  check('...and the whole-line one coloured more', whole.cells.size > one.cells.size);
  ToolManager.getCurrentTool().setColourCore('whole');
}

// -- 6. Bezier ----------------------------------------------------------------------------------------

{
  const run = (core) => {
    enter('standard_ula'); resetColours();
    ToolManager.selectTool(TOOLS.BEZIER);
    const t = ToolManager.getCurrentTool();
    t.setThickness(6);
    t.setColourCore(core);
    t.onPointerDown(20, 120, ev()); t.onPointerUp(120, 120, ev());
    t.commitCurve();
    return { dots: dots(), cells: colouredCells() };
  };
  const whole = run('whole'), one = run('1');
  check('a thick curve with a 1-pixel core sets the same dots', whole.dots.size > 0 && sameSet(whole.dots, one.dots));
  check('...and colours fewer cells', one.cells.size > 0 && one.cells.size < whole.cells.size);
  ToolManager.getCurrentTool().setColourCore('whole');
}

// -- 7. XOR writes colours, so the core must hold them back too ------------------------------------------

{
  enter('standard_ula'); resetColours();
  // Pre-colour the area (ink 1, paper 6) so a stray colour write would show.
  for (let cy = 2; cy <= 8; cy++) {
    for (let cx = 2; cx <= 10; cx++) {
      const c = layer().getCell(cx, cy);
      Object.assign(c, { ink: 1, paper: 6, bright: false, flash: false });
      c.altered = true;
    }
  }
  StateManager.setDrawMode('xor');
  ToolManager.selectTool(TOOLS.BRUSH);
  const t = ToolManager.getCurrentTool();
  t.setSize(8); t.setColourCore('1');
  t.onPointerDown(30, 40, ev()); t.onPointerMove(70, 40, ev()); t.onPointerUp(70, 40, ev());
  check('XOR with a core: only the centre line\'s cells took the new colours',
    sameSet(colouredCells(), centreLineCells(30, 40, 70, 40)));
  check('...and XOR still toggled dots on the whole width of the stroke', dots().has('50,36') || dots().has('50,44'));
  StateManager.setDrawMode('normal');
  t.setColourCore('whole');
}

// -- 8. Mirror: the mirrored line is the core of its own side -------------------------------------------------

{
  enter('standard_ula'); resetColours();
  StateManager.setSymmetryMode('h');
  ToolManager.selectTool(TOOLS.BRUSH);
  const t = ToolManager.getCurrentTool();
  t.setSize(8); t.setColourCore('1');
  t.onPointerDown(20, 20, ev()); t.onPointerMove(50, 20, ev()); t.onPointerUp(50, 20, ev());
  const want = new Set();
  ToolBase.forEachLinePoint(20, 20, 50, 20, (x, y) => {
    want.add(cellOf(x, y));
    want.add(cellOf(ZX_SPECTRUM.WIDTH - 1 - x, y));
  });
  check('with Mirror the core is both lines, not their thick neighbourhoods', sameSet(colouredCells(), want));
  StateManager.setSymmetryMode('off');
  t.setColourCore('whole');
}

// -- 9. Modes with no cell colours ignore the option -------------------------------------------------------------

for (const mode of ['layer2_256', 'timex_hires']) {
  const run = (core) => {
    enter(mode); resetColours();
    ToolManager.selectTool(TOOLS.BRUSH);
    const t = ToolManager.getCurrentTool();
    t.setSize(8);
    t.setColourCore(core);
    t.onPointerDown(20, 20, ev()); t.onPointerMove(70, 52, ev()); t.onPointerUp(70, 52, ev());
    const c = layer().getCell(5, 4);
    const out = JSON.stringify(Array.from(c.indices || c.pixels));
    t.setColourCore('whole');
    return out;
  };
  check(`${mode}: a stored 1-pixel core changes nothing`, run('whole') === run('1'));
}

// -- 10. Nothing leaks out of the stroke -----------------------------------------------------------------------------

{
  enter('standard_ula'); resetColours();
  check('the gate has no core once the stroke is over', !PixelDrawRoutine._colourCore);
  PixelDrawRoutine.draw(100, 100, ColorManager.getCurrentSelection(), DRAW_MODE.NORMAL);
  const c = layer().getCell(12, 12);
  check('a plain write afterwards colours its cell as ever', c.ink === 2 && c.paper === 5);
}

summary();
