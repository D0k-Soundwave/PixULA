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

// ── A thinned stroke (the fade's dither gate) mirrors exactly ──────────────
// Each mirrored copy takes its source pixel's verdict, as it takes its source's
// colour-core treatment: judged at its own position, the mirrored side of a fade
// came out a different pattern and missed cells the original side coloured.
clearAll();
StateManager.setSymmetryMode('quad');
const gate = (x, y) => (x * 3 + y) % 4 === 0;
PixelDrawRoutine.beginBatch();
PixelDrawRoutine.withDitherGate(gate, () => {
  for (let x = 8; x < 40; x++) for (let y = 8; y < 24; y++) PixelDrawRoutine.draw(x, y, color, DRAW_MODE.NORMAL);
});
PixelDrawRoutine.endBatch();
let gateMirrored = true, gateKept = true;
for (let x = 8; x < 40; x++) for (let y = 8; y < 24; y++) {
  const src = isInk(x, y);
  if (src !== gate(x, y)) gateKept = false;
  if (isInk(W - 1 - x, y) !== src || isInk(x, H - 1 - y) !== src || isInk(W - 1 - x, H - 1 - y) !== src) gateMirrored = false;
}
check('dither gate: the original side keeps exactly the gated pixels', gateKept);
check('dither gate: every mirrored copy matches its source pixel', gateMirrored);

// ── A preview's write plan carries Mirror's copies as the commit makes them ──
// A floating stamp, a floating text and Type on canvas preview a PLAN of draw()
// calls by simulating it; mirrorWritePlan adds the copies. The oracle is the
// commit itself: the plan, applied write by write as a simulation applies it
// (no batch, so no XOR gate, and no Mirror), leaves the same picture as the
// original writes committed with Mirror on in one batch - XOR writes that meet
// across the mirror line included.
const snap = () => {
  const out = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) out.push(isInk(x, y) ? 1 : 0);
  return out.join('');
};
const planWrites = [];
for (let x = W / 2 - 6; x < W / 2 + 6; x++) {
  planWrites.push({ x, y: 30, sel: color, mode: DRAW_MODE.XOR });
  planWrites.push({ x, y: 31 + (x % 3), sel: color, mode: DRAW_MODE.NORMAL });
}
for (let y = H / 2 - 4; y < H / 2 + 4; y++) planWrites.push({ x: 50, y, sel: color, mode: DRAW_MODE.XOR });
let planOk = true;
for (const sym of ['h', 'v', 'quad']) {
  clearAll();
  StateManager.setSymmetryMode(sym);
  PixelDrawRoutine.beginBatch();
  for (const w of planWrites) PixelDrawRoutine.draw(w.x, w.y, w.sel, w.mode);
  PixelDrawRoutine.endBatch();
  const committed = snap();
  const plan = PixelDrawRoutine.mirrorWritePlan(planWrites);
  clearAll();
  for (const w of plan) PixelDrawRoutine.draw(w.x, w.y, w.sel, w.mode, { mirror: false });
  if (snap() !== committed) planOk = false;
}
check('mirror plan: applied as a preview simulates it, it leaves the picture the commit leaves (h, v, quad)', planOk);
StateManager.setSymmetryMode('off');
check('mirror plan: unchanged when Mirror is off', PixelDrawRoutine.mirrorWritePlan(planWrites) === planWrites);
StateManager.setSymmetryMode('quad');
check('mirror plan: unchanged while Mirror is suspended',
  PixelDrawRoutine.suspendMirror(() => PixelDrawRoutine.mirrorWritePlan(planWrites)) === planWrites);
const one = PixelDrawRoutine.mirrorWritePlan([{ x: 10, y: 20, sel: color, mode: DRAW_MODE.NORMAL }]);
check('mirror plan: the copies come first and the write itself last, as draw() makes them',
  one.length === 4 && one[3].x === 10 && one[3].y === 20 &&
  one.slice(0, 3).map(w => w.x + ',' + w.y).join(' ') === `${W - 11},20 10,${H - 21} ${W - 11},${H - 21}`);

// forEachStrokeTarget is strokeTargets without an object a pixel (the gradient
// previews a whole screen): the same pixels, once each, and none on a locked layer.
const xs = [], ys = [], pts = [];
for (let i = 0; i < 400; i++) { const x = (i * 37) % W, y = (i * 53) % H; xs.push(x); ys.push(y); pts.push({ x, y }); }
xs.push(-1); ys.push(5); pts.push({ x: -1, y: 5 });
let targetsOk = true;
for (const sym of ['off', 'h', 'v', 'quad']) {
  StateManager.setSymmetryMode(sym);
  const a = PixelDrawRoutine.strokeTargets(pts).pixels.map(p => p.y * W + p.x).sort((p, q) => p - q);
  const b = [];
  PixelDrawRoutine.forEachStrokeTarget(xs, ys, (x, y) => b.push(y * W + x));
  b.sort((p, q) => p - q);
  if (a.join() !== b.join()) targetsOk = false;
}
check('forEachStrokeTarget: the pixels strokeTargets names, once each (off, h, v, quad)', targetsOk);
LayerManager.getCurrentLayer().locked = true;
let anyLocked = 0;
PixelDrawRoutine.forEachStrokeTarget(xs, ys, () => anyLocked++);
LayerManager.getCurrentLayer().locked = false;
check('forEachStrokeTarget: nothing on a locked layer', anyLocked === 0);

StateManager.setSymmetryMode('off');
summary();
