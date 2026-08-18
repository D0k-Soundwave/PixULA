'use strict';
/**
 * Pixel-perfect strokes: corner-thinning for freehand round/square brush
 * strokes at size 1.
 *
 * A naive diagonal drag stamps a right-then-down (or equivalent) staircase
 * with a doubled "corner" pixel at every direction change — two pixels where
 * a clean diagonal only needs one. With the pref on, BrushEngine tracks the
 * last two eligible stamps of the current stroke and retroactively erases a
 * corner once a third stamp proves it redundant (see the design note above
 * BrushEngineClass._trackPixelPerfect).
 *
 * Drives the REAL BrushEngine/BrushTool/PixelDrawRoutine/UndoRedo, like
 * brush-size-one.test.js and clip-draw.test.js — an invariant asserted
 * against a re-implementation would only prove the re-implementation.
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
  onReady(cb) { cb(); }, getIframeDocument() { return null; },
  getCanvasElement() { return null; }, setCanvasCursor() {},
  createOverlayCanvas() { return null; },
  getScrollPosition() { return { x: 0, y: 0 }; }, setScrollPosition() {}
};
global.ColorManager = {
  _sel: { ink: 0, paper: 7, bright: false, flash: false, inkTransparent: false, paperTransparent: false },
  getCurrentSelection() { return { ...this._sel }; }
};
global.SelectionService = {
  isFloating() { return false; }, endFloatingPaste() {}, clear() {},
  hasSelection() { return false; }, getSelection() { return null; },
  getSelectionState() { return null; }, restoreSelectionState() {},
  hasClipboard() { return false; }
};
global.PatternService = {
  getCurrentPattern() { return null; }, getCurrentPatternData() { return null; },
  shouldDrawPixel() { return true; }
};
global.Storage = { get: async () => undefined, set: async () => {} };

loadModule('js/core/layer-manager.js');
loadModule('js/core/pixel-draw-routine.js');
loadModule('js/services/undo-redo.js');
loadModule('js/data/zx-rom-font.js');
loadModule('js/tools/tool-base.js');
loadModule('js/tools/tool-manager.js');
loadModule('js/tools/brush-engine.js');
loadModule('js/tools/brush-tool.js');

LayerManager.initialize();
UndoRedo.initialize();
BrushEngine.initialize();

const isInk = (x, y) => {
  const s = PixelDrawRoutine.getPixelState(x, y);
  return !!(s && s.isInk);
};
const clearAll = () => {
  PixelDrawRoutine.suspendStrokeHooks(() => PixelDrawRoutine.clearAll());
};

/** Reset to a known-good baseline before each scenario. */
function reset({ pixelPerfect = true, drawMode = 'normal', brush = 'round', size = 1 } = {}) {
  clearAll();
  StateManager.setSymmetryMode('off');
  StateManager.setDrawMode(drawMode);
  StateManager.set('pixelPerfect', pixelPerfect);
  BrushEngine.setBrush(brush);
  BrushEngine.setSize(size);
  BrushEngine.startDrawingSession();
}

// ── The eligibility gate, tested directly ───────────────────────────────────

reset({ pixelPerfect: true, drawMode: 'normal', brush: 'round', size: 1 });
check('eligible: size 1, round, pixelPerfect on, normal mode', BrushEngine._pixelPerfectEligible(1));

check('gate: size 2 is not eligible', !BrushEngine._pixelPerfectEligible(2));

reset({ pixelPerfect: true, drawMode: 'normal', brush: 'spray', size: 1 });
check('gate: spray (not round/square) is not eligible', !BrushEngine._pixelPerfectEligible(1));

reset({ pixelPerfect: true, drawMode: 'normal', brush: 'square', size: 1 });
check('gate: square is eligible, same as round', BrushEngine._pixelPerfectEligible(1));

reset({ pixelPerfect: false, drawMode: 'normal', brush: 'round', size: 1 });
check('gate: preference off is not eligible', !BrushEngine._pixelPerfectEligible(1));

for (const dm of ['xor', 'ink', 'paper']) {
  reset({ pixelPerfect: true, drawMode: dm, brush: 'round', size: 1 });
  check(`gate: draw mode '${dm}' is not eligible`, !BrushEngine._pixelPerfectEligible(1));
}

reset({ pixelPerfect: true, drawMode: 'pixel_only', brush: 'round', size: 1 });
check("gate: draw mode 'pixel_only' IS eligible", BrushEngine._pixelPerfectEligible(1));

// ── Adjacency helpers, pure geometry ────────────────────────────────────────

check('ortho: (0,0)-(1,0) adjacent', BrushEngine._ppOrthoAdjacent({ x: 0, y: 0 }, { x: 1, y: 0 }));
check('ortho: (0,0)-(0,1) adjacent', BrushEngine._ppOrthoAdjacent({ x: 0, y: 0 }, { x: 0, y: 1 }));
check('ortho: (0,0)-(1,1) NOT ortho-adjacent', !BrushEngine._ppOrthoAdjacent({ x: 0, y: 0 }, { x: 1, y: 1 }));
check('diag: (0,0)-(1,1) diagonal adjacent', BrushEngine._ppDiagAdjacent({ x: 0, y: 0 }, { x: 1, y: 1 }));
check('diag: (0,0)-(2,0) NOT diagonal adjacent', !BrushEngine._ppDiagAdjacent({ x: 0, y: 0 }, { x: 2, y: 0 }));

// ── Baseline: the artifact is real (feature off) ────────────────────────────

reset({ pixelPerfect: false });
BrushEngine.applyBrush(10, 10, 1.0, true);
BrushEngine.applyBrush(11, 10, 1.0, true);
BrushEngine.applyBrush(11, 11, 1.0, true);
check('baseline (off): the doubled corner pixel is ink', isInk(11, 10));
check('baseline (off): both diagonal endpoints are ink too', isInk(10, 10) && isInk(11, 11));

// ── Corner removed (feature on) ──────────────────────────────────────────────

reset({ pixelPerfect: true });
BrushEngine.applyBrush(10, 10, 1.0, true);
BrushEngine.applyBrush(11, 10, 1.0, true);
BrushEngine.applyBrush(11, 11, 1.0, true);
check('on: the diagonal endpoints stay ink', isInk(10, 10) && isInk(11, 11));
check('on: the redundant corner is erased', !isInk(11, 10));

// Same shape, opposite hand (down then right) — the algorithm must not be
// direction-specific.
reset({ pixelPerfect: true });
BrushEngine.applyBrush(30, 10, 1.0, true);
BrushEngine.applyBrush(30, 11, 1.0, true);
BrushEngine.applyBrush(31, 11, 1.0, true);
check('on: down-then-right endpoints stay ink', isInk(30, 10) && isInk(31, 11));
check('on: down-then-right corner is erased', !isInk(30, 11));

// ── Straight runs are never touched ─────────────────────────────────────────

reset({ pixelPerfect: true });
BrushEngine.applyBrush(50, 10, 1.0, true);
BrushEngine.applyBrush(51, 10, 1.0, true);
BrushEngine.applyBrush(52, 10, 1.0, true);
check('straight horizontal run: all three pixels stay ink',
  isInk(50, 10) && isInk(51, 10) && isInk(52, 10));

reset({ pixelPerfect: true });
BrushEngine.applyBrush(60, 10, 1.0, true);
BrushEngine.applyBrush(60, 11, 1.0, true);
BrushEngine.applyBrush(60, 12, 1.0, true);
check('straight vertical run: all three pixels stay ink',
  isInk(60, 10) && isInk(60, 11) && isInk(60, 12));

// ── NORMAL_ERASE direction (right button / paper stroke) ───────────────────
//
// A pure erase run doubles an erased corner the same way an ink run doubles
// an inked one; pixel-perfect must "un-erase" it, not ink it.

reset({ pixelPerfect: true });
clearAll();
// Seed the whole path as ink first so there is something to erase.
[[70, 10], [71, 10], [71, 11]].forEach(([x, y]) => PixelDrawRoutine.draw(x, y, ColorManager.getCurrentSelection(), DRAW_MODE.NORMAL));
BrushEngine.startDrawingSession();
BrushEngine.applyBrush(70, 10, 1.0, false);
BrushEngine.applyBrush(71, 10, 1.0, false);
BrushEngine.applyBrush(71, 11, 1.0, false);
check('erase direction: both erased endpoints stay erased', !isInk(70, 10) && !isInk(71, 11));
check('erase direction: the doubly-erased corner is re-inked', isInk(71, 10));

// ── Mirror composes for free ────────────────────────────────────────────────

reset({ pixelPerfect: true });
StateManager.setSymmetryMode('h');
const W = ACTIVE_SCREEN_MODE.width;
const srcX = 20, mirX = W - 1 - srcX;
BrushEngine.applyBrush(srcX, 100, 1.0, true);
BrushEngine.applyBrush(srcX + 1, 100, 1.0, true);
BrushEngine.applyBrush(srcX + 1, 101, 1.0, true);
check('mirror: source endpoints stay ink', isInk(srcX, 100) && isInk(srcX + 1, 101));
check('mirror: source corner erased', !isInk(srcX + 1, 100));
check('mirror: mirrored endpoints stay ink',
  isInk(mirX, 100) && isInk(mirX - 1, 101));
check('mirror: the mirrored corner was erased too, with no mirror-aware code in this test',
  !isInk(mirX - 1, 100));
StateManager.setSymmetryMode('off');

// ── Stroke-boundary reset: history never leaks into the next stroke ────────

reset({ pixelPerfect: true });
BrushEngine.applyBrush(90, 50, 1.0, true);   // A
BrushEngine.applyBrush(91, 50, 1.0, true);   // B — stroke "ends" here, no 3rd stamp
BrushEngine.startDrawingSession();           // a fresh stroke begins
BrushEngine.applyBrush(91, 51, 1.0, true);   // would read as C against stale A/B
check('stroke boundary: a fresh session clears history, no stale erase', isInk(91, 50));

// ── Undo folds the correction into the stroke's single batch ───────────────

reset({ pixelPerfect: true });
const before = UndoRedo.getUndoCount();
PixelDrawRoutine.beginBatch('test stroke');
BrushEngine.applyBrush(110, 10, 1.0, true);
BrushEngine.applyBrush(111, 10, 1.0, true);
BrushEngine.applyBrush(111, 11, 1.0, true);
PixelDrawRoutine.endBatch();
check('undo: the whole stroke (correction included) is exactly one entry',
  UndoRedo.getUndoCount() === before + 1);
check('undo: the corner is erased before undo', !isInk(111, 10));
UndoRedo.undo();
check('undo: one undo clears the endpoints too', !isInk(110, 10) && !isInk(111, 11));
check('undo: one undo leaves no orphaned corner pixel', !isInk(111, 10));

summary();
