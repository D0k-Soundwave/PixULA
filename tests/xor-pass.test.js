'use strict';
/**
 * XOR / Every Pass (DRAW_MODE.XOR_PIXEL) toggles a pixel once per PASS.
 *
 * A pass is one sweep of the brush over a pixel: it starts when the stroke
 * arrives on the pixel and ends when the brush has moved away from it. The
 * brush lays a chain of overlapping stamps (spacing is half its size), so a
 * single sweep writes most pixels several times; toggling on every one of
 * those writes left holes wherever stamps overlapped, more of them the faster
 * the hand moved (measured 2026-10-07: a size-5 stroke kept 205 of 221 pixels
 * at 1-pixel steps and 115 at 4-pixel steps). Only a stroke that comes BACK
 * over its own path toggles a pixel again - which is what makes it cancel
 * where it crosses itself, and the one thing XOR / Over does not do.
 *
 * Shapes, curves, fills, text and stamps are one pass each: their pixels are
 * generated as de-duplicated sets, so there is no path to cross. Thin curved
 * shapes used to lose the joins their outlines write twice.
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
for (const f of ['brush-tool.js', 'eraser-tool.js', 'fill-tool.js', 'shape-tool.js',
  'bezier-tool.js', 'gradient-tool.js', 'text-tool.js', 'selection-tool.js',
  'eyedropper-tool.js', 'move-tool.js', 'zoom-tool.js']) {
  loadModule('js/tools/' + f);
}

ColorManager.initialize();
BrushEngine.initialize();
ToolManager.register(new BrushTool());
ToolManager.register(new FillTool());
ToolManager.register(new ShapeTool());
ToolManager.initialize(TOOLS.BRUSH);

const W = ZX_SPECTRUM.WIDTH, H = ZX_SPECTRUM.HEIGHT;
const key = (x, y) => y * W + x;
const ev = (over = {}) => ({ button: 0, buttons: 1, pressure: 1, clientX: 0, clientY: 0,
  preventDefault() {}, stopPropagation() {}, ...over });

/** Every inked pixel of the current layer. */
function inked() {
  const layer = LayerManager.getCurrentLayer();
  const out = new Set();
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) if (layer.getPixelState(x, y)) out.add(key(x, y));
  }
  return out;
}
const sameSet = (a, b) => a.size === b.size && [...a].every((k) => b.has(k));
const minus = (a, b) => new Set([...a].filter((k) => !b.has(k)));

function fresh(mode, mirror = 'off') {
  LayerManager.initialize();
  ColorManager.setInk(3);
  ColorManager.setPaper(7);
  StateManager.setDrawMode(mode);
  StateManager.setSymmetryMode(mirror);
}

/** One freehand stroke through `points`, one pointer event per point. */
function brushStroke(mode, size, points, mirror = 'off') {
  fresh(mode, mirror);
  ToolManager.selectTool(TOOLS.BRUSH);
  BrushEngine.setBrush('round');
  BrushEngine.setSize(size);
  const t = ToolManager.getCurrentTool();
  t.onPointerDown(points[0][0], points[0][1], ev());
  for (let i = 1; i < points.length; i++) t.onPointerMove(points[i][0], points[i][1], ev());
  const last = points[points.length - 1];
  t.onPointerUp(last[0], last[1], ev());
  StateManager.setSymmetryMode('off');
  return inked();
}

/** A straight drag along y = 50 from x = 40 to x = 80, one event every `step` pixels. */
function straight(step) {
  const pts = [];
  for (let x = 40; x <= 80; x += step) pts.push([x, 50]);
  return pts;
}

// -- 1. One sweep is one pass: a wide stroke stays solid at any speed --------

for (const size of [1, 3, 5, 8]) {
  for (const step of [1, 4]) {
    const over = brushStroke('xor', size, straight(step));
    const every = brushStroke('xor_pixel', size, straight(step));
    check(`straight drag, size ${size}, ${step}-px steps: Every Pass is as solid as Over ` +
      `(${every.size} of ${over.size} px)`, sameSet(over, every));
  }
}

// -- 2. Shapes are one pass: thin outlines keep their joins ------------------

function shape(mode, type) {
  fresh(mode);
  ToolManager.selectTool(TOOLS.RECTANGLE);
  const t = ToolManager.getCurrentTool();
  t.setShapeType(type);
  t.setThickness(1);
  t.onPointerDown(40, 40, ev());
  t.onPointerMove(100, 90, ev());
  t.onPointerUp(100, 90, ev());
  return inked();
}

// The base Shape tool keeps whichever shape was chosen last, so each one is
// named here rather than picked by its rail id.
for (const name of ['rounded-rectangle', 'circle', 'ellipse', 'polygon', 'star',
  'rectangle', 'line']) {
  const over = shape('xor', name);
  const every = shape('xor_pixel', name);
  check(`thin ${name}: Every Pass draws the same outline as Over (${every.size} of ${over.size} px)`,
    sameSet(over, every));
}

// -- 3. A stroke that comes back over its own path cancels where it crosses --
//
// Right, down, left, then up through the first leg: every turn is a right
// angle, and the last leg crosses the first at (60, 60).

const CROSSING = [[40, 60], [80, 60], [80, 80], [60, 80], [60, 40]];
const X0 = 60, Y0 = 60;

{
  const over = brushStroke('xor', 1, CROSSING);
  const every = brushStroke('xor_pixel', 1, CROSSING);
  check('1-px crossing: Over keeps the crossing pixel inked', over.has(key(X0, Y0)));
  check('1-px crossing: Every Pass cancels it', !every.has(key(X0, Y0)));
  const lost = minus(over, every);
  check(`1-px crossing: the crossing pixel is the only difference (lost ${lost.size})`,
    lost.size === 1 && minus(every, over).size === 0);
}

{
  const over = brushStroke('xor', 3, CROSSING);
  const every = brushStroke('xor_pixel', 3, CROSSING);
  check('size-3 crossing: Over is solid at the crossing', over.has(key(X0, Y0)));
  check('size-3 crossing: Every Pass cancels at the crossing', !every.has(key(X0, Y0)));
  const lost = [...minus(over, every)];
  const far = lost.filter((k) => {
    const x = k % W, y = (k - x) / W;
    return Math.max(Math.abs(x - X0), Math.abs(y - Y0)) > 3;
  });
  check(`size-3 crossing: nothing is lost away from the crossing (${far.length} px)`,
    far.length === 0);
  check('size-3 crossing: Every Pass adds nothing Over does not have',
    minus(every, over).size === 0);
}

{
  const over = brushStroke('xor', 8, CROSSING);
  const every = brushStroke('xor_pixel', 8, CROSSING);
  check('size-8 crossing: Every Pass cancels at the crossing', !every.has(key(X0, Y0)));
  const far = [...minus(over, every)].filter((k) => {
    const x = k % W, y = (k - x) / W;
    return Math.max(Math.abs(x - X0), Math.abs(y - Y0)) > 8;
  });
  check(`size-8 crossing: nothing is lost away from the crossing (${far.length} px)`,
    far.length === 0);
}

// A pen that wobbles a pixel back and forth never leaves the pixels under it,
// so it does not toggle them again.
{
  const wobble = [];
  for (let i = 0; i < 20; i++) wobble.push([60 + (i % 2), 50 + (i % 3 === 0 ? 1 : 0)]);
  const over = brushStroke('xor', 5, wobble);
  const every = brushStroke('xor_pixel', 5, wobble);
  check(`a wobbling pen leaves no speckle (${every.size} of ${over.size} px)`, sameSet(over, every));
}

// A stroke that turns back along its own row: the second pass cancels the
// first, except within reach of the turn, where the brush never left.
{
  const back = [[40, 70], [80, 70], [40, 70]];
  const over = brushStroke('xor', 1, back);
  const every = brushStroke('xor_pixel', 1, back);
  check('1-px backtrack: Over leaves the whole row', over.size === 41);
  check('1-px backtrack: Every Pass clears the row it went back over',
    !every.has(key(50, 70)) && !every.has(key(70, 70)));
  check('1-px backtrack: ...but not the turn, which it never left', every.has(key(80, 70)));
}

// -- 4. Mirror: the reflected side follows the same rule ---------------------

{
  const over = brushStroke('xor', 5, straight(4), 'h');
  const every = brushStroke('xor_pixel', 5, straight(4), 'h');
  const left = [...every].filter((k) => k % W < W / 2).length;
  const right = every.size - left;
  check(`mirrored drag: Every Pass is as solid as Over on both sides (${every.size} of ${over.size} px)`,
    sameSet(over, every));
  check(`mirrored drag: both sides match (${left} / ${right})`, left === right && left > 0);
}

// -- 5. A fill is one pass ---------------------------------------------------

{
  const run = (mode) => {
    fresh('normal');
    ToolManager.selectTool(TOOLS.RECTANGLE);
    let t = ToolManager.getCurrentTool();
    t.setShapeType('rectangle');
    t.setThickness(1);
    t.onPointerDown(30, 30, ev());
    t.onPointerMove(90, 90, ev());
    t.onPointerUp(90, 90, ev());
    StateManager.setDrawMode(mode);
    ToolManager.selectTool(TOOLS.FILL);
    t = ToolManager.getCurrentTool();
    t.onPointerDown(10, 10, ev());
    t.onPointerUp(10, 10, ev());
    return inked();
  };
  check('fill: Every Pass matches Over', sameSet(run('xor'), run('xor_pixel')));
}

// -- 6. Outside a stroke every write still toggles ---------------------------

{
  fresh('xor_pixel');
  const sel = ColorManager.getCurrentSelection();
  PixelDrawRoutine.draw(5, 5, sel, DRAW_MODE.XOR_PIXEL);
  PixelDrawRoutine.draw(5, 5, sel, DRAW_MODE.XOR_PIXEL);
  check('a lone write outside a stroke toggles every time (twice = back to paper)',
    !LayerManager.getCurrentLayer().getPixelState(5, 5));
  PixelDrawRoutine.draw(6, 5, sel, DRAW_MODE.XOR);
  PixelDrawRoutine.draw(6, 5, sel, DRAW_MODE.XOR);
  check('...and so does XOR / Over outside a stroke',
    !LayerManager.getCurrentLayer().getPixelState(6, 5));
}

StateManager.setDrawMode('normal');
summary('xor-pass');
