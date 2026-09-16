'use strict';
/**
 * Every draw mode, against the tools that have to honour it.
 *
 * The six modes in the top bar promise different things - Normal stamps the
 * colours with the pixel, Ink and Paper Recolour touch no pixel at all, Pixels
 * Only touches no colour, and the two XORs toggle. A tool that resolves the
 * mode wrongly, or not at all, breaks that promise quietly: the artist sets a
 * mode and the picture just does something else.
 *
 * Driven by the real tool objects (as tools-draw does), one mode at a time,
 * checking the invariant that mode names rather than one tool's output.
 *
 * Two faults this pins, both found 2026-09-16 by running the whole matrix:
 *  - a pattern in XOR toggled its GAPS as well as its ink, so the pattern
 *    vanished and the footprint came out as a plain rectangular invert;
 *  - the eraser must stay its own thing in every mode (it has three of its own
 *    and is deliberately outside this selector).
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
// Every preview call is a no-op here; the tools' own suites cover previews.
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
ToolManager.register(new EraserTool());
ToolManager.register(new FillTool());
ToolManager.register(new ShapeTool());
ToolManager.register(new BezierTool());
ToolManager.register(new GradientTool());
ToolManager.initialize(TOOLS.BRUSH);

// A 2x2 tile: ink on one diagonal, gaps on the other.
const TILE = { width: 2, height: 2, bitmap: new Uint8Array([1, 0, 0, 1]) };
PatternService._currentPattern = { id: 'probe', name: 'probe' };
PatternService._currentPatternData = TILE;

const CX = 5, CY = 5;
const PX = CX * 8 + 3, PY = CY * 8 + 3;
const MODES = ['normal', 'ink', 'paper', 'pixel_only', 'xor', 'xor_pixel'];

const layer = () => LayerManager.getCurrentLayer();
const cell = () => layer().getCell(CX, CY);
const ev = (over = {}) => ({ button: 0, buttons: 1, pressure: 1, clientX: 0, clientY: 0,
  preventDefault() {}, stopPropagation() {}, ...over });

/** Seed the cell: known pixels, known colours, all different from the selection. */
function seed() {
  LayerManager.initialize();
  const c = cell();
  for (let r = 0; r < 4; r++) c.pixels[r] = 0xF0;
  for (let r = 4; r < 8; r++) c.pixels[r] = 0x0C;
  c.ink = 2; c.paper = 6; c.bright = false; c.flash = false; c.altered = true;
  ColorManager.setInk(3);
  ColorManager.setPaper(4);
  ColorManager.setBright(true);
  ColorManager.setFlash(true);
  ColorManager.setInkTransparent(false);
  ColorManager.setPaperTransparent(false);
  return snapshot();
}
const snapshot = () => ({
  pixels: Array.from(cell().pixels),
  ink: cell().ink, paper: cell().paper, bright: cell().bright, flash: cell().flash
});
const pixelsChanged = (a, b) => a.pixels.some((row, i) => row !== b.pixels[i]);
const isInk = (x, y) => layer().getPixelState(x, y);

/** Run one tool action with `mode` in force, from a fresh seed. */
function withMode(mode, run) {
  const before = seed();
  StateManager.setDrawMode(mode);
  run();
  return { before, after: snapshot() };
}

// ── The promise each mode makes, across the tools that resolve it ──────────

const STROKES = {
  brush: () => {
    ToolManager.selectTool(TOOLS.BRUSH);
    BrushEngine.setBrush('round'); BrushEngine.setSize(1);
    const t = ToolManager.getCurrentTool();
    t.onPointerDown(PX, PY + 4, ev());   // a PAPER pixel in the seed
    t.onPointerUp(PX, PY + 4, ev());
  },
  shape: () => {
    ToolManager.selectTool(TOOLS.RECTANGLE);
    const t = ToolManager.getCurrentTool();
    t.onPointerDown(CX * 8 + 1, CY * 8 + 5, ev());
    t.onPointerMove(CX * 8 + 6, CY * 8 + 7, ev());
    t.onPointerUp(CX * 8 + 6, CY * 8 + 7, ev());
  },
  bezier: () => {
    ToolManager.selectTool(TOOLS.BEZIER);
    const t = ToolManager.getCurrentTool();
    t.onPointerDown(CX * 8 + 1, CY * 8 + 6, ev());
    t.onPointerUp(CX * 8 + 6, CY * 8 + 6, ev());
    t.commitCurve();
  }
};

for (const [name, run] of Object.entries(STROKES)) {
  // Normal: the pixel AND all four attributes
  let r = withMode('normal', run);
  check(`${name} / Normal: places ink and stamps all four attributes`,
    pixelsChanged(r.before, r.after) && r.after.ink === 3 && r.after.paper === 4 &&
    r.after.bright === true && r.after.flash === true);

  // Ink Recolour: the ink, bright and flash - never a pixel, never the paper
  r = withMode('ink', run);
  check(`${name} / Ink Recolour: no pixel moves`, !pixelsChanged(r.before, r.after));
  check(`${name} / Ink Recolour: ink, bright and flash change, paper does not`,
    r.after.ink === 3 && r.after.paper === r.before.paper &&
    r.after.bright === true && r.after.flash === true);

  // Paper Recolour: the mirror image
  r = withMode('paper', run);
  check(`${name} / Paper Recolour: no pixel moves`, !pixelsChanged(r.before, r.after));
  check(`${name} / Paper Recolour: paper, bright and flash change, ink does not`,
    r.after.paper === 4 && r.after.ink === r.before.ink &&
    r.after.bright === true && r.after.flash === true);

  // Pixels Only: the pixel, and not one colour
  r = withMode('pixel_only', run);
  check(`${name} / Pixels Only: places ink`, pixelsChanged(r.before, r.after));
  check(`${name} / Pixels Only: leaves every colour alone`,
    r.after.ink === r.before.ink && r.after.paper === r.before.paper &&
    r.after.bright === r.before.bright && r.after.flash === r.before.flash);

  // XOR: toggles, and still colours the cell
  for (const xor of ['xor', 'xor_pixel']) {
    r = withMode(xor, run);
    check(`${name} / ${xor}: toggles pixels and stamps the attributes`,
      pixelsChanged(r.before, r.after) && r.after.ink === 3 && r.after.paper === 4);
  }
}

// ── A pattern keeps its shape in XOR ───────────────────────────────────────
//
// The gaps are the half a pattern does NOT ink. In Normal they clear the pixel
// (the scratch-off the pattern brush is named for); in XOR there is no paper
// half to write, so they must be left alone. Writing them toggled all 64
// pixels of the footprint and the pattern came out as a plain invert.

function patternStroke() {
  ToolManager.selectTool(TOOLS.BRUSH);
  BrushEngine.setBrush('pattern'); BrushEngine.setSize(8);
  const t = ToolManager.getCurrentTool();
  // Centred so the size-8 footprint covers exactly this cell: the box runs
  // from centre-4 to centre+3.
  const cx = CX * 8 + 4, cy = CY * 8 + 4;
  t.onPointerDown(cx, cy, ev());
  t.onPointerUp(cx, cy, ev());
}

/** The pixels the tile inks, and the pixels it leaves as gaps, in this cell. */
function tileSplit() {
  const inked = [], gaps = [];
  for (let ly = 0; ly < 8; ly++) {
    for (let lx = 0; lx < 8; lx++) {
      const x = CX * 8 + lx, y = CY * 8 + ly;
      (TILE.bitmap[(y % 2) * 2 + (x % 2)] ? inked : gaps).push([x, y]);
    }
  }
  return { inked, gaps };
}

{
  const { inked, gaps } = tileSplit();

  let r = withMode('normal', patternStroke);
  check('pattern / Normal: the tile\'s ink lands',
    inked.every(([x, y]) => isInk(x, y)));
  check('pattern / Normal: the gaps clear (the scratch-off it is named for)',
    gaps.every(([x, y]) => !isInk(x, y)));

  for (const xor of ['xor', 'xor_pixel']) {
    const before = seed();
    StateManager.setDrawMode(xor);
    const wasGap = gaps.map(([x, y]) => isInk(x, y));
    patternStroke();
    check(`pattern / ${xor}: the tile's ink toggles`,
      inked.every(([x, y], i) =>
        isInk(x, y) !== !!(before.pixels[y % 8] & (1 << (7 - (x % 8))))));
    check(`pattern / ${xor}: the GAPS are untouched, so it is still a pattern`,
      gaps.every(([x, y], i) => isInk(x, y) === wasGap[i]));
  }
}

// The same rule through the pattern AREA fill (PatternService), not just the brush
{
  const { inked, gaps } = tileSplit();
  seed();
  StateManager.setDrawMode('xor');
  const wasGap = gaps.map(([x, y]) => isInk(x, y));
  PatternService.applyPattern(CX * 8, CY * 8, 8, 8);
  check('pattern area fill / xor: the gaps are untouched there too',
    gaps.every(([x, y], i) => isInk(x, y) === wasGap[i]));
  check('pattern area fill / xor: the tile\'s own pixels did change',
    inked.some(([x, y]) => isInk(x, y)));
}

// ── The eraser is outside the selector, in every mode ──────────────────────

{
  const results = MODES.map((mode) => {
    const r = withMode(mode, () => {
      ToolManager.selectTool(TOOLS.ERASER);
      const t = ToolManager.getCurrentTool();
      t.onPointerDown(PX, PY, ev());
      t.onPointerUp(PX, PY, ev());
    });
    return JSON.stringify(r.after);
  });
  check('the eraser does the same thing in all six draw modes (it has its own)',
    new Set(results).size === 1);
}

// ── The gap mode itself ────────────────────────────────────────────────────

StateManager.setDrawMode('normal');
check('resolvePatternGapMode: Normal gives the right-button mode',
  PixelDrawRoutine.resolvePatternGapMode() === DRAW_MODE.NORMAL_ERASE);
StateManager.setDrawMode('pixel_only');
check('resolvePatternGapMode: Pixels Only gives the bare erase primitive',
  PixelDrawRoutine.resolvePatternGapMode() === DRAW_MODE.ERASE);
StateManager.setDrawMode('xor');
check('resolvePatternGapMode: XOR gives null - the gaps are not written',
  PixelDrawRoutine.resolvePatternGapMode() === null);
StateManager.setDrawMode('xor_pixel');
check('resolvePatternGapMode: XOR / Pixel too',
  PixelDrawRoutine.resolvePatternGapMode() === null);
StateManager.setDrawMode('normal');

summary('draw-mode-matrix');
