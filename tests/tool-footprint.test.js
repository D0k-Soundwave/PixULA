'use strict';
/**
 * Hover-footprint contract.
 *
 * Every tool answers getFootprint(x, y) with the pixels it would touch if
 * committed there — InputHandler outlines that set under the cursor, on mouse
 * and pen alike. The footprint is only worth drawing if it is TRUE, so the
 * tests below do not assert against a hand-copied disc: they drive the real
 * tool through the real PixelDrawRoutine, record what it actually wrote, and
 * demand the footprint equal that set. An outline that disagrees with the
 * stroke is worse than no outline.
 *
 * Loads the real core + tool layer (same harness as tools-draw.test.js) and
 * the pure MaskOps boundary op that GridOverlay renders through.
 */
const { loadModule, check, summary } = require('./helpers/zx-stubs');

global.window = global;
global.Logger = { info() {}, debug() {}, warn() {}, error() {} };

loadModule('js/core/constants.js');
loadModule('js/utils/helpers.js');
loadModule('js/utils/validators.js');
loadModule('js/utils/mask-ops.js');
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

// Deterministic checkerboard pattern stub for the pattern-consuming tools.
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

const TOOL_FILES = [
  ['brush-tool.js', 'BrushTool'], ['eraser-tool.js', 'EraserTool'],
  ['fill-tool.js', 'FillTool'], ['shape-tool.js', 'ShapeTool'],
  ['bezier-tool.js', 'BezierTool'],
  ['eyedropper-tool.js', 'EyedropperTool'], ['selection-tool.js', 'SelectionTool'],
  ['gradient-tool.js', 'GradientTool'], ['text-tool.js', 'TextTool'],
  ['move-tool.js', 'MoveTool'],
  ['zoom-tool.js', 'ZoomTool'],
  ['pattern-creator-tool.js', 'PatternCreatorTool']
];
for (const [file] of TOOL_FILES) loadModule('js/tools/' + file);

LayerManager.initialize();
BrushEngine.initialize();

// ── Helpers ────────────────────────────────────────────────────────────────

const key = p => p.x + ',' + p.y;
const toSet = pts => new Set(pts.map(key));
const sameSet = (a, b) => a.size === b.size && [...a].every(k => b.has(k));

/** Drive a tool's own stamp through PixelDrawRoutine and record the writes. */
function recordWrites(fn) {
  const written = new Set();
  const real = PixelDrawRoutine.draw.bind(PixelDrawRoutine);
  PixelDrawRoutine.draw = (x, y, sel, mode, opts) => {
    if (x >= 0 && x < ZX_SPECTRUM.WIDTH && y >= 0 && y < ZX_SPECTRUM.HEIGHT) {
      written.add(x + ',' + y);
    }
    return real(x, y, sel, mode, opts);
  };
  try { fn(); } finally { PixelDrawRoutine.draw = real; }
  return written;
}

/** On-canvas subset of a footprint (tools legitimately emit off-canvas points). */
const onCanvas = pts => pts.filter(p =>
  p.x >= 0 && p.x < ZX_SPECTRUM.WIDTH && p.y >= 0 && p.y < ZX_SPECTRUM.HEIGHT);

// ── Contract: every tool answers getFootprint ─────────────────────────────

for (const [, cls] of TOOL_FILES) {
  const tool = new global[cls]();
  const fp = tool.getFootprint(100, 100);
  check(`${cls}: getFootprint returns null or a non-empty {x,y} list`,
    fp === null || (Array.isArray(fp) && fp.length > 0 &&
      fp.every(p => typeof p.x === 'number' && typeof p.y === 'number')));
}

// Tools that write no pixels (or own the hover canvas) must opt out with null.
for (const cls of ['MoveTool', 'ZoomTool', 'GradientTool', 'PatternCreatorTool']) {
  check(`${cls}: opts out of the footprint outline (null)`,
    new global[cls]().getFootprint(100, 100) === null);
}

// Point-sized tools inherit the single-pixel default — at high zoom this is the
// only pixel-accurate cursor the app has (the CSS crosshair is screen-space).
for (const cls of ['FillTool', 'EyedropperTool', 'SelectionTool']) {
  const fp = new global[cls]().getFootprint(42, 24);
  check(`${cls}: single-pixel footprint at the cursor`,
    fp.length === 1 && fp[0].x === 42 && fp[0].y === 24);
}

// ── Eraser: footprint === the pixels _eraseAt actually clears ─────────────

for (const size of [1, 2, 5, 8, 17, 32, 64, 128]) {
  const eraser = new global.EraserTool();
  eraser.setSize(size);

  const claimed = toSet(onCanvas(eraser.getFootprint(120, 90)));
  const written = recordWrites(() => eraser._eraseAt(120, 90));

  check(`eraser size ${size}: footprint === the pixels the erase writes`,
    sameSet(claimed, written));
}

check('eraser: 128 is the largest size the slider offers',
  global.EraserTool.optionsSchema.find(o => o.key === 'size').max === 128 &&
  (() => { const e = new global.EraserTool(); e.setSize(999); return e.size === 128; })());

// A DRAG clears each pixel once — the per-stroke dedupe is what makes size 128
// affordable (a full-width drag went from 2.97M draw calls to one per pixel,
// measured 2026-08-05). It is an optimisation, so the set it clears must still
// be exactly the union of the footprints along the path: nothing missed at the
// leading edge, nothing extra.
for (const size of [8, 128]) {
  const eraser = new global.EraserTool();
  eraser.setSize(size);

  const path = [{ x: 60, y: 96 }, ...eraser.getLinePoints(60, 96, 190, 120)];
  const expected = new Set();
  for (const p of path) for (const q of onCanvas(eraser.getFootprint(p.x, p.y))) expected.add(key(q));

  let calls = 0;
  const realDraw = PixelDrawRoutine.draw.bind(PixelDrawRoutine);
  PixelDrawRoutine.draw = (...a) => { calls++; return realDraw(...a); };
  let written;
  try {
    written = recordWrites(() => {
      eraser.onPointerDown(60, 96, {});
      eraser.onPointerMove(190, 120, {});
      eraser.onPointerUp(190, 120, {});
    });
  } finally {
    PixelDrawRoutine.draw = realDraw;
  }

  check(`eraser size ${size}: a drag clears exactly the union of its footprints`,
    sameSet(expected, written));
  check(`eraser size ${size}: a drag draws each pixel once`,
    calls === written.size, `${calls} draw calls for ${written.size} pixels`);
}

// ── Brush: footprint === what the deterministic (solid) brushes stamp ─────

for (const type of ['round', 'square']) {
  for (const size of [1, 4, 9, 32]) {
    const brush = new global.BrushTool();
    brush.setBrushType(type);
    brush.setSize(size);

    const claimed = toSet(onCanvas(brush.getFootprint(128, 96)));
    const written = recordWrites(() => BrushEngine.applyBrush(128, 96, 1.0, true));

    check(`brush ${type} size ${size}: footprint === the pixels the stroke writes`,
      sameSet(claimed, written));
  }
}

// The scattering brushes cannot be predicted pixel-for-pixel — but the
// footprint must CONTAIN everything they write, or the outline under-promises.
for (const type of ['spray', 'crosshatch', 'hatch']) {
  const brush = new global.BrushTool();
  brush.setBrushType(type);
  brush.setSize(16);

  const claimed = toSet(onCanvas(brush.getFootprint(128, 96)));
  let contains = true;
  for (let i = 0; i < 12; i++) {           // scatter is random — sample repeatedly
    const written = recordWrites(() => BrushEngine.applyBrush(128, 96, 1.0, true));
    for (const k of written) if (!claimed.has(k)) contains = false;
  }
  check(`brush ${type}: footprint envelope contains every pixel it scatters`, contains);
}

// The Poisson distribution is a spray sub-mode with its own (box) envelope, so
// its footprint follows setDistribution and must still contain every point.
{
  const brush = new global.BrushTool();
  brush.setBrushType('spray');
  brush.setDistribution('poisson');
  brush.setSize(16);

  const claimed = toSet(onCanvas(brush.getFootprint(128, 96)));
  let contains = true;
  for (let i = 0; i < 12; i++) {
    const written = recordWrites(() => BrushEngine.applyBrush(128, 96, 1.0, true));
    for (const k of written) if (!claimed.has(k)) contains = false;
  }
  check('brush spray (poisson): footprint envelope contains every pixel it scatters', contains);
  brush.setDistribution('uniform');
}

// Round Poisson confines the stipple to the disc; the footprint is the disc
// mask and must still contain every point (and be smaller than the box).
{
  const brush = new global.BrushTool();
  brush.setBrushType('spray');
  brush.setDistribution('poisson');
  brush.setPoissonShape('round');
  brush.setSize(16);

  const claimed = toSet(onCanvas(brush.getFootprint(128, 96)));
  // The disc is a strict subset of the size^2 box.
  check('brush spray (poisson, round): footprint is smaller than the size^2 box',
    claimed.size < 16 * 16);

  let contains = true;
  for (let i = 0; i < 12; i++) {
    const written = recordWrites(() => BrushEngine.applyBrush(128, 96, 1.0, true));
    for (const k of written) if (!claimed.has(k)) contains = false;
  }
  check('brush spray (poisson, round): disc footprint contains every pixel it scatters', contains);
  brush.setPoissonShape('square');
  brush.setDistribution('uniform');
}

// Weighting moves the particles between rim and centre; -100 pushes them
// hardest against the envelope, which is exactly where an outline that is a
// half-pixel too tight would start leaking.
for (const weighting of [-100, 0, 100]) {
  const brush = new global.BrushTool();
  brush.setBrushType('spray');
  brush.setSize(17);
  brush.setWeighting(weighting);

  const claimed = toSet(onCanvas(brush.getFootprint(128, 96)));
  let contains = true;
  for (let i = 0; i < 20; i++) {
    const written = recordWrites(() => BrushEngine.applyBrush(128, 96, 1.0, true));
    for (const k of written) if (!claimed.has(k)) contains = false;
  }
  check(`brush spray weighting ${weighting}: every particle lands inside the outline`, contains);
}

// (The standalone Spray airbrush was retired — spray is now the brush 'spray'
// type, whose scatter envelope is checked in the brush-spray block above.)

// ── Shape / bezier: footprint === the nib the raster dilates with ─────────

for (const thickness of [1, 3, 8]) {
  const shape = new global.ShapeTool();
  shape.setThickness(thickness);

  const claimed = toSet(shape.getFootprint(100, 100));
  const nib = toSet(ShapeGenerator.nibFootprint(100, 100, thickness));

  check(`shape thickness ${thickness}: footprint === ShapeGenerator's nib`,
    sameSet(claimed, nib));
}

{
  const bezier = new global.BezierTool();
  check('bezier: footprint while idle is the nib',
    bezier.getFootprint(100, 100).length >= 1);

  bezier._phase = 'edit';   // anchors down: the tool owns the preview canvas
  check('bezier: no footprint once it owns the preview canvas (edit phase)',
    bezier.getFootprint(100, 100) === null);
}

// ── MaskOps.boundaryPoints — what GridOverlay actually renders ────────────

{
  const W = ZX_SPECTRUM.WIDTH, H = ZX_SPECTRUM.HEIGHT;

  // A solid 5x5 block: the 16 rim pixels are boundary, the centre 3x3 is not.
  const block = [];
  for (let y = 10; y < 15; y++) for (let x = 10; x < 15; x++) block.push({ x, y });
  const rim = MaskOps.boundaryPoints(block, W, H);
  check('boundary: a solid 5x5 block outlines to its 16-pixel rim',
    rim.length === 16 && !rim.some(p => p.x === 12 && p.y === 12));

  // A sparse set is entirely boundary — dither patterns survive intact.
  const sparse = [{ x: 20, y: 20 }, { x: 22, y: 20 }, { x: 24, y: 24 }];
  check('boundary: a sparse set is all boundary (nothing is interior)',
    MaskOps.boundaryPoints(sparse, W, H).length === 3);

  // Off-canvas members are dropped, and must not alias onto the row above:
  // x = -1 keyed as y*W + x would collide with (W - 1, y - 1).
  const straddle = [{ x: -1, y: 5 }, { x: 0, y: 5 }, { x: 1, y: 5 }];
  const clipped = MaskOps.boundaryPoints(straddle, W, H);
  check('boundary: off-canvas members are dropped, not aliased into the row above',
    clipped.length === 2 && clipped.every(p => p.x >= 0) &&
    !clipped.some(p => p.x === W - 1));

  // A block flush against the left edge: that edge is boundary, not interior.
  const flush = [];
  for (let y = 30; y < 35; y++) for (let x = 0; x < 5; x++) flush.push({ x, y });
  const flushEdge = MaskOps.boundaryPoints(flush, W, H);
  check('boundary: a set clipped by the canvas edge boundaries at that edge',
    flushEdge.some(p => p.x === 0 && p.y === 32));

  check('boundary: empty input is empty output', MaskOps.boundaryPoints([], W, H).length === 0);
}

summary();
