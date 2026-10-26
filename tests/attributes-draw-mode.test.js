'use strict';
/**
 * The Attributes Only draw mode (owner decision 2026-10-19): ZX Paintbrush with
 * pixel drawing switched off. Every drawing tool gives each cell it touches the
 * Ink, Paper, Bright and Flash on the colour rail and never changes a pixel.
 * Each "use existing" box keeps that one attribute, so with Paper ticked it is
 * Ink Recolour and with Ink ticked it is Paper Recolour.
 *
 * "Follows the brush size, the shape and the fill area exactly as Ink Recolour
 * does" is checked literally: each tool runs once in Ink Recolour and once in
 * Attributes Only from the same seed, and the two must touch the same cells.
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
    // the gradient fills a set of pending writes before it previews them
    if (prop === 'newPixelMarks') return () => ({ marks: null, cells: [], mark() {} });
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
loadModule('js/utils/bitmap-text.js');
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
for (const f of ['brush-tool.js', 'eraser-tool.js', 'fill-tool.js', 'shape-tool.js',
  'bezier-tool.js', 'gradient-tool.js', 'text-tool.js', 'selection-tool.js',
  'eyedropper-tool.js', 'move-tool.js', 'zoom-tool.js']) {
  loadModule('js/tools/' + f);
}

ColorManager.initialize();
BrushEngine.initialize();
ToolManager.register(new BrushTool());
ToolManager.register(new EraserTool());
ToolManager.register(new FillTool());
ToolManager.register(new ShapeTool());
ToolManager.register(new BezierTool());
ToolManager.register(new GradientTool());
ToolManager.initialize(TOOLS.BRUSH);

const TILE = { width: 2, height: 2, bitmap: new Uint8Array([1, 0, 0, 1]) };
PatternService._currentPattern = { id: 'probe', name: 'probe' };
PatternService._currentPatternData = TILE;

// Spray scatters at random; the same sequence for both runs of a comparison.
const realRandom = Math.random;
let rngState = 1;
function seedRandom() {
  rngState = 12345;
  Math.random = () => {
    rngState = (rngState * 1103515245 + 12345) % 2147483648;
    return rngState / 2147483648;
  };
}

const layer = () => LayerManager.getCurrentLayer();
const ev = (over = {}) => ({ button: 0, buttons: 1, pressure: 1, clientX: 0, clientY: 0,
  preventDefault() {}, stopPropagation() {}, ...over });
const RIGHT = { button: 2, buttons: 2 };

function enter(modeId) {
  __setActiveScreenMode(modeId);
  AttributeSystem.clearAll();
  ColorManager.applyScreenMode();
  LayerManager.initialize();
}

/** Every cell of the region seeded with a stripe of ink pixels and attributes unlike the rail's. */
const AREA = { x0: 2, y0: 2, x1: 14, y1: 12 };
function seed() {
  enter('standard_ula');
  for (let cy = AREA.y0; cy <= AREA.y1; cy++) {
    for (let cx = AREA.x0; cx <= AREA.x1; cx++) {
      const c = layer().getCell(cx, cy);
      for (let r = 0; r < 8; r++) c.pixels[r] = (r & 1) ? 0x0F : 0xC3;
      c.ink = 2; c.paper = 6; c.bright = false; c.flash = false; c.altered = true;
    }
  }
  ColorManager.setInk(3);
  ColorManager.setPaper(4);
  ColorManager.setBright(true);
  ColorManager.setFlash(true);
  for (const k of ['Ink', 'Paper', 'Bright', 'Flash']) ColorManager['set' + k + 'Transparent'](false);
  StateManager.setInverse(false);
  StateManager.setSymmetryMode('off');
}

/** The whole layer: every cell's pixels and attributes. */
function snapshot() {
  const out = [];
  for (let cy = 0; cy < ZX_SPECTRUM.GRID_ROWS; cy++) {
    for (let cx = 0; cx < ZX_SPECTRUM.GRID_COLS; cx++) {
      const c = layer().getCell(cx, cy);
      out.push({ cx, cy, pixels: Array.from(c.pixels), ink: c.ink, paper: c.paper,
        bright: c.bright, flash: c.flash });
    }
  }
  return out;
}
const attrsDiffer = (a, b) => a.ink !== b.ink || a.paper !== b.paper ||
  a.bright !== b.bright || a.flash !== b.flash;
const pixelsDiffer = (a, b) => a.pixels.some((row, i) => row !== b.pixels[i]);

function run(mode, stroke) {
  seed();
  const before = snapshot();
  StateManager.setDrawMode(mode);
  seedRandom();
  stroke();
  Math.random = realRandom;
  const after = snapshot();
  StateManager.setDrawMode('normal');
  return { before, after };
}
const changedCells = (r) => r.after.filter((c, i) => attrsDiffer(c, r.before[i]))
  .map((c) => `${c.cx},${c.cy}`);

function drag(tool, x0, y0, x1, y1, over) {
  ToolManager.selectTool(tool);
  const t = ToolManager.getCurrentTool();
  t.onPointerDown(x0, y0, ev(over));
  t.onPointerMove((x0 + x1) >> 1, (y0 + y1) >> 1, ev(over));
  t.onPointerMove(x1, y1, ev(over));
  t.onPointerUp(x1, y1, ev(over));
  return t;
}

// -- 1. The mode exists, and the retired id stays retired ---------------------------------

StateManager.setDrawMode('attributes');
check('StateManager keeps "attributes" as a draw mode', StateManager.getDrawMode() === 'attributes');
StateManager.setDrawMode('attributes_only');
check('the retired id "attributes_only" still comes back Normal', StateManager.getDrawMode() === 'normal');

StateManager.setDrawMode('attributes');
check('left button resolves to the ATTRIBUTES_ONLY primitive',
  PixelDrawRoutine.resolveUserMode(true) === DRAW_MODE.ATTRIBUTES_ONLY);
check('right button resolves to the same primitive',
  PixelDrawRoutine.resolveUserMode(false) === DRAW_MODE.ATTRIBUTES_ONLY);
StateManager.setInverse(true);
check('Inverse changes nothing: both buttons still write attributes only',
  PixelDrawRoutine.resolveUserMode(true) === DRAW_MODE.ATTRIBUTES_ONLY &&
  PixelDrawRoutine.resolveUserMode(false) === DRAW_MODE.ATTRIBUTES_ONLY);
StateManager.setInverse(false);
check('a pattern\'s gaps are written as attributes too (as Ink Recolour\'s are)',
  PixelDrawRoutine.resolvePatternGapMode() === DRAW_MODE.ATTRIBUTES_ONLY);
StateManager.setDrawMode('normal');

// -- 2. Every drawing tool: no pixel, all four attributes, Ink Recolour's cells ------------

const C = (n) => n * 8;
const STROKES = {
  'brush size 1': () => { BrushEngine.setBrush('round'); BrushEngine.setSize(1);
    drag(TOOLS.BRUSH, C(4) + 3, C(4) + 3, C(9) + 2, C(6) + 5); },
  'brush size 5': () => { BrushEngine.setBrush('round'); BrushEngine.setSize(5);
    drag(TOOLS.BRUSH, C(4) + 7, C(4) + 7, C(9) + 1, C(7) + 2); },
  'square brush size 9': () => { BrushEngine.setBrush('square'); BrushEngine.setSize(9);
    drag(TOOLS.BRUSH, C(5) + 4, C(5) + 4, C(5) + 4, C(5) + 4); },
  'brush right button': () => { BrushEngine.setBrush('round'); BrushEngine.setSize(3);
    drag(TOOLS.BRUSH, C(4) + 3, C(8) + 3, C(10) + 3, C(8) + 3, RIGHT); },
  'spray': () => { ToolManager.selectTool(TOOLS.SPRAY); BrushEngine.setSize(16);
    BrushEngine.setFlowRate(100);
    drag(TOOLS.SPRAY, C(7), C(7), C(8), C(7)); },
  'pattern brush': () => { ToolManager.selectTool(TOOLS.PATTERN); BrushEngine.setSize(12);
    drag(TOOLS.PATTERN, C(6) + 4, C(6) + 4, C(9) + 4, C(6) + 4); },
  'outline rectangle': () => { ToolManager.selectTool(TOOLS.RECTANGLE);
    ToolManager.getCurrentTool().setFilled(false);
    drag(TOOLS.RECTANGLE, C(3) + 2, C(3) + 2, C(11) + 5, C(10) + 1); },
  'filled rectangle': () => { ToolManager.selectTool(TOOLS.RECTANGLE);
    ToolManager.getCurrentTool().setFilled(true);
    drag(TOOLS.RECTANGLE, C(3) + 2, C(3) + 2, C(11) + 5, C(10) + 1);
    ToolManager.getCurrentTool().setFilled(false); },
  'ellipse': () => drag(TOOLS.ELLIPSE, C(4), C(4), C(12), C(10)),
  'line': () => drag(TOOLS.LINE, C(3) + 1, C(11) + 6, C(13) + 6, C(3) + 1),
  'bezier': () => { const t = drag(TOOLS.BEZIER, C(3) + 1, C(6) + 6, C(12) + 6, C(9) + 2);
    t.commitCurve(); },
  'pixel fill': () => drag(TOOLS.FILL, C(8) + 2, C(8) + 2, C(8) + 2, C(8) + 2),
  'gradient': () => {
    ToolManager.selectTool(TOOLS.GRADIENT);
    const t = ToolManager.getCurrentTool();
    t.onPointerDown(C(3), C(3), ev()); t.onPointerUp(C(12), C(10), ev());
    t.onPointerDown(C(3) + 2, C(6), ev()); t.onPointerUp(C(12) - 2, C(6), ev());
  }
};

for (const [name, stroke] of Object.entries(STROKES)) {
  const ink = run('ink', stroke);
  const attrs = run('attributes', stroke);
  const inkCells = changedCells(ink);
  const attrCells = changedCells(attrs);
  check(`${name}: the stroke reaches some cells`, attrCells.length > 0, `${attrCells.length} cells`);
  check(`${name}: no pixel anywhere on the layer changes`,
    !attrs.after.some((c, i) => pixelsDiffer(c, attrs.before[i])));
  check(`${name}: every cell it touches has Ink, Paper, Bright and Flash from the rail`,
    attrs.after.filter((c, i) => attrsDiffer(c, attrs.before[i]))
      .every((c) => c.ink === 3 && c.paper === 4 && c.bright === true && c.flash === true));
  check(`${name}: it touches exactly the cells Ink Recolour touches`,
    inkCells.length === attrCells.length && inkCells.every((k) => attrCells.includes(k)),
    `ink ${inkCells.length}, attributes ${attrCells.length}`);
}

// -- 3. The four "use existing" boxes ------------------------------------------------------

const dab = () => { BrushEngine.setBrush('round'); BrushEngine.setSize(1);
  drag(TOOLS.BRUSH, C(5) + 3, C(5) + 3, C(5) + 3, C(5) + 3); };
const cellAt = (r) => r.after.find((c) => c.cx === 5 && c.cy === 5);
for (const [box, field, kept] of [['Ink', 'ink', 2], ['Paper', 'paper', 6],
  ['Bright', 'bright', false], ['Flash', 'flash', false]]) {
  const r = run('attributes', () => {
    ColorManager['set' + box + 'Transparent'](true);
    dab();
    ColorManager['set' + box + 'Transparent'](false);
  });
  const c = cellAt(r);
  const others = { ink: 3, paper: 4, bright: true, flash: true };
  delete others[field];
  check(`${box} on "use existing": the cell keeps its own ${field}`, c[field] === kept, String(c[field]));
  check(`${box} on "use existing": the other three still come from the rail`,
    Object.entries(others).every(([k, v]) => c[k] === v));
}

{
  const viaInk = run('ink', dab);
  const viaAttrs = run('attributes', () => {
    ColorManager.setPaperTransparent(true); dab(); ColorManager.setPaperTransparent(false);
  });
  check('with Paper on "use existing" it gives exactly Ink Recolour\'s result',
    JSON.stringify(viaInk.after) === JSON.stringify(viaAttrs.after));
  const viaPaper = run('paper', dab);
  const viaAttrs2 = run('attributes', () => {
    ColorManager.setInkTransparent(true); dab(); ColorManager.setInkTransparent(false);
  });
  check('with Ink on "use existing" it gives exactly Paper Recolour\'s result',
    JSON.stringify(viaPaper.after) === JSON.stringify(viaAttrs2.after));
}

// -- 4. Mirror applies, as in Ink Recolour ------------------------------------------------

{
  const r = run('attributes', () => { StateManager.setSymmetryMode('h'); dab();
    StateManager.setSymmetryMode('off'); });
  const mirrorCx = ZX_SPECTRUM.GRID_COLS - 1 - 5;
  const m = r.after.find((c) => c.cx === mirrorCx && c.cy === 5);
  check('Mirror H: the mirrored cell takes the attributes too',
    m.ink === 3 && m.paper === 4 && m.bright === true && m.flash === true);
  check('Mirror H: and no pixel moves there either',
    !r.after.some((c, i) => pixelsDiffer(c, r.before[i])));
}

// -- 5. Colour core: outside the core nothing is written, as in Ink Recolour ---------------

{
  const isCore = (x, y) => x === C(5) + 3 && y === C(5) + 3;
  StateManager.setDrawMode('attributes');
  const mode = PixelDrawRoutine.resolveUserMode(true);
  check('colour core: a write outside the core is dropped',
    PixelDrawRoutine.classifyCore(C(6), C(6), mode, ColorManager.getCurrentSelection(), isCore) === null);
  StateManager.setDrawMode('normal');
}

// -- 6. Stamps and text are pinned in tests/stamp-draw-mode.test.js, the Figure tool in
// tests/figure-tool.test.js, with the other draw modes.

// -- 7. Screen modes -------------------------------------------------------------------------

const PX = C(5) + 2;
function modeProbe(modeId, setup) {
  enter(modeId);
  // The cell under pixel (42, 42), whatever the mode's cell height.
  const cellOf = () => layer().getCell(Math.floor(PX / ZX_SPECTRUM.CELL_WIDTH),
    Math.floor(PX / ZX_SPECTRUM.CELL_HEIGHT));
  const c = cellOf();
  for (let r = 0; r < c.pixels.length; r++) c.pixels[r] = 0x5A;
  if (c.pixelsB) for (let r = 0; r < c.pixelsB.length; r++) c.pixelsB[r] = 0x3C;
  c.ink = 2; c.paper = 6; c.bright = false; c.flash = false; c.altered = true;
  if (c.pixelsB) { c.inkB = 1; c.paperB = 5; c.brightB = false; c.flashB = false; }
  const pixelsBefore = Array.from(c.pixels);
  const pixelsBBefore = c.pixelsB ? Array.from(c.pixelsB) : null;
  if (setup) setup();
  StateManager.setDrawMode('attributes');
  const sel = { ink: 3, paper: 4, bright: true, flash: true,
    inkTransparent: false, paperTransparent: false, brightTransparent: false, flashTransparent: false };
  PixelDrawRoutine.draw(PX, PX, sel, PixelDrawRoutine.resolveUserMode(true));
  StateManager.setDrawMode('normal');
  return { c: cellOf(), pixelsBefore, pixelsBBefore };
}

for (const id of ['multicolor_8x1', 'multicolor_8x4', 'ula_plus', 'ulanext']) {
  const { c, pixelsBefore } = modeProbe(id);
  check(`${id}: the cell takes Ink, Paper, Bright and Flash`,
    c.ink === 3 && c.paper === 4 && c.bright === true && c.flash === true,
    JSON.stringify({ ink: c.ink, paper: c.paper, bright: c.bright, flash: c.flash }));
  check(`${id}: no pixel changes`, JSON.stringify(Array.from(c.pixels)) === JSON.stringify(pixelsBefore));
}

{
  const { c, pixelsBefore, pixelsBBefore } = modeProbe('gigascreen');
  check('GigaScreen: screen A takes the attributes', c.ink === 3 && c.paper === 4 && c.bright && c.flash);
  check('GigaScreen: screen B takes them too', c.inkB === 3 && c.paperB === 4 && c.brightB && c.flashB);
  check('GigaScreen: no pixel changes on either screen',
    JSON.stringify(Array.from(c.pixels)) === JSON.stringify(pixelsBefore) &&
    JSON.stringify(Array.from(c.pixelsB)) === JSON.stringify(pixelsBBefore));
}

{
  enter('layer2_256');
  const c = layer().getCell(5, 5);
  const before = Array.from(c.indices);
  StateManager.setDrawMode('attributes');
  PixelDrawRoutine.draw(C(5) + 2, C(5) + 2, ColorManager.getCurrentSelection(),
    PixelDrawRoutine.resolveUserMode(true));
  StateManager.setDrawMode('normal');
  check('Layer 2 (no cell attributes): nothing is written',
    JSON.stringify(Array.from(c.indices)) === JSON.stringify(before));
}

enter('standard_ula');
summary('attributes-draw-mode');
