'use strict';
/**
 * THE SIZE-1 INVARIANT.
 *
 * A pixel-art editor whose brush cannot place one pixel is not a pixel-art
 * editor. Before this suite existed, three of the nine brush types drew
 * NOTHING at size 1: advanced crosshatch divided by an offset of 0 and
 * compared every pixel against NaN, while stipple and spray both computed
 * `floor(1 * density)` = 0 particles. Poisson stipple drew one pixel, but
 * rounded it off-centre.
 *
 * The rule now: at size 1, with default options, every brush writes exactly
 * the pixel under the cursor and nothing else — scatter, hatch phase, dropout
 * and radial falloff have no meaning inside a single pixel, so they are not
 * applied there. The hover footprint must agree.
 *
 * Drives the REAL brushes through the REAL PixelDrawRoutine, like
 * tool-footprint.test.js — an invariant asserted against a re-implementation
 * would only prove the re-implementation.
 */
const { loadModule, check, summary } = require('./helpers/zx-stubs');

global.window = global;
global.Logger = { info() {}, debug() {}, warn() {}, error() {} };

loadModule('js/core/constants.js');
loadModule('js/utils/helpers.js');
loadModule('js/utils/validators.js');
loadModule('js/utils/brush-shapes.js');
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

// A real 8x8 pattern, so the pattern brush has something to reveal. Bit set at
// (4, 4) only: at that pixel it paints ink, everywhere else paper — either way
// exactly ONE pixel, which is what the invariant is about.
const PATTERN = {
  width: 8, height: 8,
  bitmap: Array.from({ length: 64 }, (_, i) => (i === 4 * 8 + 4 ? 1 : 0))
};
global.PatternService = {
  getCurrentPattern() { return { id: 'dot' }; },
  getCurrentPatternData() { return PATTERN; },
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
loadModule('js/tools/brush-engine.js');
loadModule('js/tools/brush-tool.js');
loadModule('js/tools/eraser-tool.js');

LayerManager.initialize();
BrushEngine.initialize();

/** Drive a stamp through PixelDrawRoutine and record the on-canvas writes. */
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

const only = (set, x, y) => set.size === 1 && set.has(x + ',' + y);

// ── Every brush type, at size 1, is the pencil ─────────────────────────────

const TYPES = BrushEngine.getAvailableBrushes();

check(`7 brush types are registered (got ${TYPES.length}: ${TYPES.join(', ')})`,
  TYPES.length === 7);
check('the merged spray replaced the duplicate stipple and Poisson brushes',
  TYPES.includes('spray') && !TYPES.includes('stipple') && !TYPES.includes('stipple-poisson'));

// Two positions: one on the pattern brush's set bit and one off it, and both
// off the crosshatch lattice — a brush that leaned on its stamp box's phase
// rather than an explicit size-1 path would fail at one of them.
const SPOTS = [[128, 96], [125, 94], [4, 4]];

for (const type of TYPES) {
  const brush = new global.BrushTool();
  brush.setBrushType(type);
  brush.setSize(1);

  let ok = true, why = '';

  for (const [x, y] of SPOTS) {
    BrushEngine.startDrawingSession();           // fade measures from stroke start
    const written = recordWrites(() => BrushEngine.applyBrush(x, y, 1.0, true));
    if (!only(written, x, y)) {
      ok = false;
      why = ` at (${x}, ${y}) wrote ${written.size ? [...written].join(' ') : 'nothing'}`;
    }
  }

  check(`brush ${type}: size 1 writes exactly the pixel under the cursor${why}`, ok);
}

// The right button (paper) is the same contract, and it is the one the pattern
// brush takes a different path for.
for (const type of TYPES) {
  const brush = new global.BrushTool();
  brush.setBrushType(type);
  brush.setSize(1);

  BrushEngine.startDrawingSession();
  const written = recordWrites(() => BrushEngine.applyBrush(70, 70, 1.0, false));
  check(`brush ${type}: size 1 erase clears exactly the pixel under the cursor`,
    only(written, 70, 70));
}

// Repeat stamps must not creep: a 1px brush held still is one pixel, always.
for (const type of TYPES) {
  const brush = new global.BrushTool();
  brush.setBrushType(type);
  brush.setSize(1);

  BrushEngine.startDrawingSession();
  const written = recordWrites(() => {
    for (let i = 0; i < 25; i++) BrushEngine.applyBrush(100, 50, 1.0, true);
  });
  // Fade legitimately stops drawing once its density runs out; it just must
  // never draw somewhere else.
  check(`brush ${type}: 25 stamps at one spot stay on that spot`,
    written.size <= 1 && (written.size === 0 || written.has('100,50')));
}

// ── The footprint agrees: no outline around a single pixel ─────────────────

for (const type of TYPES) {
  const brush = new global.BrushTool();
  brush.setBrushType(type);
  brush.setSize(1);

  const fp = brush.getFootprint(64, 32);
  check(`brush ${type}: size-1 footprint is exactly the cursor pixel`,
    fp.length === 1 && fp[0].x === 64 && fp[0].y === 32);
}

// ── Flow and pressure cannot take the pixel away ───────────────────────────

for (const type of ['spray']) {
  const brush = new global.BrushTool();
  brush.setBrushType(type);
  brush.setSize(1);
  brush.setFlowRate(1);                    // the thinnest flow the UI allows

  BrushEngine.startDrawingSession();
  const written = recordWrites(() => BrushEngine.applyBrush(20, 20, 1.0, true));
  check(`brush ${type}: size 1 draws even at 1% flow`, only(written, 20, 20));
  brush.setFlowRate(100);
}

// The Poisson distribution is a spray sub-mode now; it must honour the size-1
// invariant too (the old stand-alone brush rounded its one point off-centre).
{
  const brush = new global.BrushTool();
  brush.setBrushType('spray');
  brush.setDistribution('poisson');
  brush.setSize(1);
  brush.setFlowRate(1);

  BrushEngine.startDrawingSession();
  const written = recordWrites(() => BrushEngine.applyBrush(20, 20, 1.0, true));
  check('brush spray (poisson): size 1 draws exactly the cursor pixel at 1% flow',
    only(written, 20, 20));
  brush.setDistribution('uniform');
  brush.setFlowRate(100);
}

// Pressure sensitivity is a global preference (Preferences > Pen) now, not a
// per-tool option — see brush-engine.js mapPressure().
for (const type of TYPES) {
  const brush = new global.BrushTool();
  brush.setBrushType(type);
  brush.setSize(1);
  StateManager.set('pressureSensitivity', true);

  BrushEngine.startDrawingSession();
  const written = recordWrites(() => BrushEngine.applyBrush(30, 30, 0.05, true));
  check(`brush ${type}: size 1 survives a feather-light pen (pressure 0.05)`,
    only(written, 30, 30));
  StateManager.set('pressureSensitivity', false);
}

// ── The eraser too ─────────────────────────────────────────────────────────

const eraser = new global.EraserTool();
eraser.setSize(1);
check('eraser: size 1 clears exactly the pixel under the cursor',
  only(recordWrites(() => eraser._eraseAt(90, 90)), 90, 90));

const efp = eraser.getFootprint(90, 90);
check('eraser: size-1 footprint is exactly the cursor pixel',
  efp.length === 1 && efp[0].x === 90 && efp[0].y === 90);

// ── Size 2 is not size 1 (the aliasing that hid the bug) ───────────────────
//
// The old disc rule made sizes 1, 2 and 3 all a single pixel, so "the brush
// works at size 1" and "the brush is stuck at one pixel" were indistinguishable
// for three slider steps.
for (const type of ['round', 'square']) {
  const brush = new global.BrushTool();
  brush.setBrushType(type);
  brush.setSize(2);

  BrushEngine.startDrawingSession();
  const written = recordWrites(() => BrushEngine.applyBrush(150, 100, 1.0, true));
  check(`brush ${type}: size 2 is bigger than size 1 (${written.size} px)`, written.size > 1);
}

summary();
