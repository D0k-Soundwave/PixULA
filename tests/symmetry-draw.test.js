'use strict';
/**
 * Phase 8: symmetry drawing mode (mirror-while-drawing).
 *
 * Loads the REAL core stack (constants, state-manager, layer-manager,
 * pixel-draw-routine, undo-redo) plus the real brush tool, and verifies:
 *  - H / V / quad modes mirror pixel writes across the SCREEN_MODES axes
 *  - erase mode mirrors too (same seam, any DRAW_MODE)
 *  - a whole brush stroke through the real tool inherits the mirror
 *  - suspendMirror() and options.mirror === false exempt service writes
 *  - mirrored writes land inside the SAME undo action as the original
 */
const { loadModule, check, summary } = require('./helpers/zx-stubs');
const { withBlit } = require('./helpers/canvas-stub.js');

global.window = global;
global.Logger = { info() {}, debug() {}, warn() {}, error() {} };

loadModule('js/core/constants.js');
loadModule('js/utils/helpers.js');
loadModule('js/utils/validators.js');
loadModule('js/core/event-bus.js');
loadModule('js/core/state-manager.js');
loadModule('js/core/attribute-system.js');

global.CanvasSystem = withBlit({
  setPixel() {}, markCellDirty() {}, requestRender() {}, _render() {},
  getColorIndex(base, bright) { return base + (bright ? 8 : 0); },
  onReady(cb) { cb(); }, getIframeDocument() { return null; },
  getCanvasElement() { return null; }
});
global.ColorManager = {
  _sel: { ink: 0, paper: 7, bright: false, flash: false, inkTransparent: false, paperTransparent: false },
  getCurrentSelection() { return { ...this._sel }; }
};
global.SelectionService = {
  isFloating() { return false; }, hasSelection() { return false; },
  getSelection() { return null; }, getSelectionState() { return null; },
  restoreSelectionState() {}, clear() {}
};
global.Storage = { get: async () => undefined, set: async () => {} };

loadModule('js/core/layer-manager.js');
loadModule('js/core/pixel-draw-routine.js');
loadModule('js/services/undo-redo.js');
loadModule('js/tools/tool-base.js');
loadModule('js/tools/tool-manager.js');
loadModule('js/utils/brush-shapes.js');
loadModule('js/tools/brush-engine.js');
loadModule('js/tools/brush-tool.js');

LayerManager.initialize();
UndoRedo.initialize();

const W = ACTIVE_SCREEN_MODE.width;
const H = ACTIVE_SCREEN_MODE.height;
const color = ColorManager.getCurrentSelection();

const isInk = (x, y) => {
  const s = PixelDrawRoutine.getPixelState(x, y);
  return !!(s && s.isInk);
};
const clearAll = () => {
  StateManager.setSymmetryMode('off');
  PixelDrawRoutine.clearAll();
};

// ── Mode plumbing ──────────────────────────────────────────────────────────
StateManager.setSymmetryMode('h');
check('state: symmetry mode set/get', StateManager.getSymmetryMode() === 'h');
StateManager.setSymmetryMode('bogus');
check('state: invalid mode coerced to off', StateManager.getSymmetryMode() === 'off');

// ── getMirrorPoints geometry (from SCREEN_MODES, not hardcoded) ────────────
const mh = PixelDrawRoutine.getMirrorPoints(10, 20, 'h');
check('mirror points h: single point across vertical axis',
  mh.length === 1 && mh[0].x === W - 1 - 10 && mh[0].y === 20);
const mq = PixelDrawRoutine.getMirrorPoints(10, 20, 'quad');
check('mirror points quad: three counterparts', mq.length === 3);

// ── H mode: draw mirrors across the vertical centre axis ───────────────────
clearAll();
StateManager.setSymmetryMode('h');
PixelDrawRoutine.beginBatch();
PixelDrawRoutine.draw(10, 20, color, DRAW_MODE.NORMAL);
PixelDrawRoutine.endBatch();
check('h: original pixel set', isInk(10, 20));
check('h: mirrored pixel set', isInk(W - 1 - 10, 20));
check('h: no vertical mirror', !isInk(10, H - 1 - 20));

// ── V mode ─────────────────────────────────────────────────────────────────
clearAll();
StateManager.setSymmetryMode('v');
PixelDrawRoutine.beginBatch();
PixelDrawRoutine.draw(30, 40, color, DRAW_MODE.NORMAL);
PixelDrawRoutine.endBatch();
check('v: original + vertical mirror set', isInk(30, 40) && isInk(30, H - 1 - 40));
check('v: no horizontal mirror', !isInk(W - 1 - 30, 40));

// ── Quad mode: all four quadrants ──────────────────────────────────────────
clearAll();
StateManager.setSymmetryMode('quad');
PixelDrawRoutine.beginBatch();
PixelDrawRoutine.draw(50, 60, color, DRAW_MODE.NORMAL);
PixelDrawRoutine.endBatch();
check('quad: all four quadrant pixels set',
  isInk(50, 60) && isInk(W - 1 - 50, 60) && isInk(50, H - 1 - 60) && isInk(W - 1 - 50, H - 1 - 60));

// ── Erase mirrors too ──────────────────────────────────────────────────────
PixelDrawRoutine.beginBatch();
PixelDrawRoutine.draw(50, 60, color, DRAW_MODE.ERASE);
PixelDrawRoutine.endBatch();
check('quad erase: all four quadrant pixels cleared',
  !isInk(50, 60) && !isInk(W - 1 - 50, 60) && !isInk(50, H - 1 - 60) && !isInk(W - 1 - 50, H - 1 - 60));

// ── A real brush stroke inherits the mirror (the ToolBase->PDR seam) ───────
clearAll();
StateManager.setSymmetryMode('h');
for (const [, cls] of [['brush-tool.js', 'BrushTool']]) ToolManager.register(new global[cls]());
ToolManager.initialize(TOOLS.BRUSH);
const ev = (over = {}) => ({ button: 0, buttons: 1, pressure: 1, clientX: 0, clientY: 0, ...over });
const tool = ToolManager.getCurrentTool();
tool.onPointerDown(20, 100, ev());
tool.onPointerMove(24, 100, ev());
tool.onPointerUp(24, 100, ev());
check('brush stroke: original side drawn', isInk(20, 100) && isInk(22, 100) && isInk(24, 100));
check('brush stroke: mirrored side drawn',
  isInk(W - 1 - 20, 100) && isInk(W - 1 - 22, 100) && isInk(W - 1 - 24, 100));

// ── Mirrored writes are part of the SAME undo action ──────────────────────
UndoRedo.clear();
UndoRedo.beginAction('stroke');
PixelDrawRoutine.draw(70, 100, color, DRAW_MODE.NORMAL);
UndoRedo.endAction();
check('undo: one action for original + mirror', UndoRedo.getUndoCount() === 1);
check('undo: both sides present before undo', isInk(70, 100) && isInk(W - 1 - 70, 100));
UndoRedo.undo();
check('undo: one undo reverts both sides', !isInk(70, 100) && !isInk(W - 1 - 70, 100));

// ── Exemptions ─────────────────────────────────────────────────────────────
clearAll();
StateManager.setSymmetryMode('h');
PixelDrawRoutine.beginBatch();
PixelDrawRoutine.suspendMirror(() => {
  PixelDrawRoutine.draw(90, 100, color, DRAW_MODE.NORMAL);
});
PixelDrawRoutine.endBatch();
check('suspendMirror: original only', isInk(90, 100) && !isInk(W - 1 - 90, 100));
check('suspendMirror: depth restored (later draws mirror again)', (() => {
  PixelDrawRoutine.beginBatch();
  PixelDrawRoutine.draw(92, 100, color, DRAW_MODE.NORMAL);
  PixelDrawRoutine.endBatch();
  return isInk(92, 100) && isInk(W - 1 - 92, 100);
})());

PixelDrawRoutine.beginBatch();
PixelDrawRoutine.draw(94, 100, color, DRAW_MODE.NORMAL, { mirror: false });
PixelDrawRoutine.endBatch();
check('options.mirror=false: original only', isInk(94, 100) && !isInk(W - 1 - 94, 100));

StateManager.setSymmetryMode('off');
summary();
