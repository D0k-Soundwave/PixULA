'use strict';
/**
 * Batch 7 part 7A: the Figure tool's interaction and its commit. The geometry is pinned by tests/figure-model.test.js;
 * here: clicks, double click, Enter, Backspace, Escape, a tool switch, the three-point figures finishing themselves,
 * one undo step, the draw mode and use-existing boxes honoured, and the preview showing exactly the pixels the commit
 * writes (with mirror symmetry and a drawing guide in force).
 */
const { installStubs, loadModule, check, summary } = require('./helpers/zx-stubs');
const { withBlit } = require('./helpers/canvas-stub.js');

installStubs();
loadModule('js/utils/validators.js');
loadModule('js/utils/helpers.js');
loadModule('js/core/event-bus.js');
loadModule('js/core/state-manager.js');
loadModule('js/core/attribute-system.js');
global.document = undefined;
global.CanvasSystem = withBlit({
  setPixel() {}, markCellDirty() {}, requestRender() {}, _render() {},
  getColorIndex(base, bright) { return base === 0 ? 0 : base + (bright ? 8 : 0) },
  setCanvasCursor() {}
});
global.setInterval = () => 0;
global.ClipboardCodec = { encode() { return null; } };
global.Storage = { save() {}, load() { return null; }, get: async () => undefined, set: async () => {} };
let region = null;
global.SelectionService = {
  getSelection() { return region; }, hasSelection() { return !!region; }, isFloating() { return false; },
  engagedStamp() { return null; }, clear() {}, setSelection() {}, restoreFloatingState() {},
  captureFloatingState() { return null; }, selection: null
};
const previews = [];
global.GridOverlay = new Proxy({}, {
  get(target, prop) {
    if (prop === 'drawCompositorPreview') {
      return (ink, erase) => { previews.push({ ink: ink.slice(), erase: erase.slice(), core: PixelDrawRoutine._colourCore }); };
    }
    return () => {};
  }
});

loadModule('js/core/color-manager.js');
loadModule('js/core/layer-manager.js');
loadModule('js/core/pixel-draw-routine.js');
loadModule('js/services/undo-redo.js');
loadModule('js/tools/tool-base.js');
loadModule('js/tools/tool-manager.js');
loadModule('js/tools/shape-generator.js');
loadModule('js/tools/figure-model.js');
loadModule('js/tools/figure-editor.js');
loadModule('js/tools/shape-tool.js');
loadModule('js/tools/figure-tool.js');

ColorManager.initialize();
const tool = new FigureTool();
const T = FIGURE_TYPES;
const W = ZX_SPECTRUM.WIDTH, H = ZX_SPECTRUM.HEIGHT;

function fresh() {
  __setActiveScreenMode('standard_ula');
  AttributeSystem.clearAll();
  ColorManager.applyScreenMode();
  LayerManager.initialize();
  LayerManager.addLayer();
  LayerManager.setCurrentLayer(1);
  StateManager.setDrawMode('normal');
  StateManager.setInverse(false);
  StateManager.setSymmetryMode('off');
  StateManager.setClipMode('off');
  region = null;
  tool.cancelPending();
  tool.setShapeType(T.POLYLINE);
  tool.setFilled(false);
  tool.setThickness(1);
  tool.setColourCore('whole');
  ColorManager.setInk(2); ColorManager.setPaper(7); ColorManager.setBright(false); ColorManager.setFlash(false);
  for (const k of ['Ink', 'Paper', 'Bright', 'Flash']) ColorManager['set' + k + 'Transparent'](false);
  previews.length = 0;
}
const dots = () => {
  const out = new Set();
  const layer = LayerManager.layers[1];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = layer.getCell(Math.floor(x / 8), Math.floor(y / 8));
    if (c && c.altered && ((c.pixels[y % 8] >> (7 - (x % 8))) & 1)) out.add(y * W + x);
  }
  return out;
};
let clock = 0;
function click(x, y, gap = 1000) {
  clock += gap;
  const e = { button: 0, timeStamp: clock };
  tool.onPointerDown(x, y, e);
  tool.onPointerUp(x, y, e);
}
const same = (a, b) => a.size === b.size && [...a].every(k => b.has(k));
const undoDepth = () => UndoRedo.undoStack.length;

// --- click, click, click, Enter, Enter -------------------------------------------------------------------------------------------
fresh();
click(10, 10); click(30, 10); click(30, 30);
check('while drawing nothing is written yet', dots().size === 0);
check('Enter finishes the figure and keeps it pending', tool.handleKey('Enter') === true && tool._phase === 'pending' && dots().size === 0);
const depth0 = undoDepth();
check('Enter again draws it', tool.handleKey('Enter') === true && dots().size > 0);
check('...as one undo step', undoDepth() === depth0 + 1);
// 21 pixels along the top, 20 more down the side (the corner is shared)
check('the L is 41 pixels', dots().size === 41, String(dots().size));
UndoRedo.undo();
check('and one undo removes all of it', dots().size === 0);
check('nothing is held after drawing', tool.hasPending === false);

// --- double click finishes without adding a point -----------------------------------------------------------------------------------
fresh();
click(10, 10); click(40, 10);
clock += 200;
{
  const e = { button: 0, timeStamp: clock };
  tool.onPointerDown(40, 10, e);
  tool.onPointerUp(40, 10, e);
}
check('a double click finishes the figure', tool._phase === 'pending');
check('and did not add a third point', tool._model.points.length === 2);

// --- Backspace ------------------------------------------------------------------------------------------------------------------------
fresh();
check('Backspace with nothing to remove is not claimed', tool.handleKey('Backspace') === false);
click(10, 10); click(30, 10); click(30, 30);
check('Backspace removes the last point and is claimed', tool.handleKey('Backspace') === true && tool._model.points.length === 2);
tool.handleKey('Backspace');
tool.handleKey('Backspace');
check('removing the last point empties the tool', tool.hasPending === false && tool._phase === 'idle');

// --- freehand run -------------------------------------------------------------------------------------------------------------------------
fresh();
{
  clock += 1000;
  const e = { button: 0, timeStamp: clock };
  tool.onPointerDown(10, 10, e);
  tool.onPointerMove(14, 10, e);
  tool.onPointerMove(14, 14, e);
  tool.onPointerUp(14, 14, e);
  check('a drag adds a freehand run', tool._model.points.length === 3);
  tool.handleKey('Backspace');
  check('Backspace takes the whole run back to its press point', tool._model.points.length === 1);
  tool.cancelPending();
}

// --- Escape drops, a tool switch commits -----------------------------------------------------------------------------------------------
fresh();
click(10, 10); click(30, 10);
tool.cancelPending();
check('Escape (cancelPending) writes nothing and forgets the figure', dots().size === 0 && !tool.hasPending);
click(10, 10); click(30, 10);
tool.deactivate();
check('switching tools commits what was drawn', dots().size === 21 && !tool.hasPending, String(dots().size));
tool.activate();

// --- changing the figure type commits what is pending --------------------------------------------------------------------------------------
fresh();
click(10, 10); click(30, 10);
tool.setShapeType(T.POLYGON);
check('picking another figure type commits the pending one', dots().size === 21 && tool.getShapeType() === T.POLYGON);

// --- three-point figures finish themselves ----------------------------------------------------------------------------------------------
fresh();
tool.setShapeType(T.TRIANGLE);
{
  clock += 1000;
  const e = { button: 0, timeStamp: clock };
  tool.onPointerDown(10, 10, e);
  tool.onPointerMove(40, 10, e);
  tool.onPointerUp(40, 10, e);
  check('dragging the first side of a triangle gives it two points', tool._model.points.length === 2 && tool._phase === 'drawing');
  click(25, 30);
  check('the third point finishes it by itself', tool._phase === 'pending' && tool._model.points.length === 3);
}
fresh();
tool.setShapeType(T.PARALLELOGRAM);
{
  clock += 1000;
  const e = { button: 0, timeStamp: clock };
  tool.onPointerDown(10, 10, e);
  tool.onPointerMove(40, 10, e);
  tool.onPointerUp(40, 10, e);
  check('a parallelogram has two points after its first side', tool._model.points.length === 2 && tool._phase === 'drawing');
  click(50, 30);
  check('the third point finishes it by itself', tool._phase === 'pending' && tool._model.points.length === 3);
  tool.handleKey('Enter');
  const d = dots();
  // A(10,10) B(40,10) C(50,30): D = (20,30)
  check('Enter draws the whole outline: all four corners are set', [[10, 10], [40, 10], [50, 30], [20, 30]].every(([x, y]) => d.has(y * W + x)));
  check('...and nothing outside the corner box', !d.has(10 * W + 9) && !d.has(30 * W + 51));
}
fresh();
tool.setShapeType(T.ORTHOGONAL);
{
  clock += 1000;
  const e = { button: 0, timeStamp: clock };
  tool.onPointerDown(0, 20, e);
  tool.onPointerMove(30, 20, e);
  tool.onPointerUp(30, 20, e);
  click(12, 8);
  check('an orthogonal line is pending after its third point', tool._phase === 'pending');
  tool.handleKey('Enter');
  const d = dots();
  check('its second line is vertical through x = 12 (the foot of the perpendicular)', [8, 12, 20].every(y => d.has(y * W + 12)));
}
fresh();
tool.setShapeType(T.PARALLEL);
{
  clock += 1000;
  const e = { button: 0, timeStamp: clock };
  tool.onPointerDown(0, 20, e);
  tool.onPointerMove(10, 20, e);
  tool.onPointerUp(10, 20, e);
  click(30, 40);
  tool.handleKey('Enter');
  const d = dots();
  check('the parallel copy is centred on the third point: (25,40) to (35,40)', [25, 30, 35].every(x => d.has(40 * W + x)) && !d.has(40 * W + 24) && !d.has(40 * W + 36));
}

// --- a document change drops the figure -----------------------------------------------------------------------------------------------------
fresh();
click(10, 10); click(30, 10);
EventBus.emit(EVENTS.FILE_NEW, {});
check('File > New discards a pending figure', !tool.hasPending && dots().size === 0);

// --- draw mode and use-existing --------------------------------------------------------------------------------------------------------------
fresh();
StateManager.setDrawMode('paper');
click(10, 10); click(30, 10); tool.handleKey('Enter'); tool.handleKey('Enter');
check('Paper Recolour writes no dots (it only recolours)', dots().size === 0);
fresh();
StateManager.setDrawMode('attributes');
ColorManager.setInk(4); ColorManager.setPaper(1); ColorManager.setBright(true); ColorManager.setFlash(true);
click(10, 10); click(30, 10); tool.handleKey('Enter'); tool.handleKey('Enter');
{
  const c = LayerManager.layers[1].getCell(2, 1);
  check('Attributes Only writes no pixels', dots().size === 0);
  check('...and gives the cells on the line all four attributes',
    c.altered && c.ink === 4 && c.paper === 1 && c.bright === true && c.flash === true,
    JSON.stringify({ ink: c.ink, paper: c.paper, bright: c.bright, flash: c.flash }));
}
fresh();
{
  // a cell with ink 5 on paper 1 in the line's path; "use existing" ink keeps ink 5
  LayerManager.layers[1].setCell(1, 1, { ink: 5, paper: 1, bright: false, flash: false, pixels: new Uint8Array(8) });
  ColorManager.setInkTransparent(true);
  click(8, 8); click(15, 8); tool.handleKey('Enter'); tool.handleKey('Enter');
  const c = LayerManager.layers[1].getCell(1, 1);
  check('use-existing Ink keeps the cell ink', c.ink === 5, `ink ${c.ink}`);
  check('and the dots are still set', dots().size > 0);
}

// --- the preview is the commit ----------------------------------------------------------------------------------------------------------------
function previewEqualsCommit(label, setup) {
  fresh();
  setup();
  click(20, 30); click(90, 50); click(60, 90);
  tool.handleKey('Enter');
  const shown = previews[previews.length - 1];
  const shownSet = new Set(shown.ink.map(p => p.y * W + p.x));
  tool.handleKey('Enter');
  check(label, shownSet.size > 20 && same(shownSet, dots()), `${shownSet.size} vs ${dots().size}`);
}
previewEqualsCommit('preview = commit (plain)', () => {});
previewEqualsCommit('preview = commit (mirror h)', () => StateManager.setSymmetryMode('h'));
previewEqualsCommit('preview = commit (mirror quad)', () => StateManager.setSymmetryMode('quad'));
previewEqualsCommit('preview = commit (drawing guide inside)', () => {
  StateManager.setClipMode('inside');
  region = { x: 30, y: 20, width: 40, height: 40, mask: null };
});
previewEqualsCommit('preview = commit (drawing guide outside + mirror v)', () => {
  StateManager.setClipMode('outside');
  StateManager.setSymmetryMode('v');
  region = { x: 30, y: 20, width: 40, height: 40, mask: null };
});
previewEqualsCommit('preview = commit (thickness 4)', () => tool.setThickness(4));

fresh();
tool.setShapeType(T.POLYGON);
tool.setFilled(true);
click(20, 30); click(90, 50); click(60, 90);
tool.handleKey('Enter');
{
  const shownSet = new Set(previews[previews.length - 1].ink.map(p => p.y * W + p.x));
  tool.handleKey('Enter');
  check('preview = commit (filled polygon)', same(shownSet, dots()) && dots().size > 500, String(dots().size));
}

// --- the right button erases --------------------------------------------------------------------------------------------------------------------
fresh();
tool.setThickness(1);
{
  clock += 1000;
  const e = { button: 2, timeStamp: clock };
  tool.onPointerDown(10, 10, e); tool.onPointerUp(10, 10, e);
  click(30, 10);
  check('the first press decides: right button = erase figure', tool._isEraseMode === true);
  tool.cancelPending();
}

// ===== Point mode: editing a pending figure (Batch 7 part 7C) ==========================================================================
ToolManager.register(tool);
const pending = (points) => { fresh(); for (const [x, y] of points) click(x, y); tool.handleKey('Enter'); };
const draw = (points) => { pending(points); tool.handleKey('Enter'); return dots(); };
const press = (x, y, to) => {
  clock += 1000;
  const e = { button: 0, timeStamp: clock };
  tool.onPointerDown(x, y, e);
  if (to) tool.onPointerMove(to[0], to[1], e);
  tool.onPointerUp(to ? to[0] : x, to ? to[1] : y, e);
};
const L = [[10, 10], [30, 10], [30, 30]];

pending(L);
press(30, 10, [35, 12]);
tool.handleKey('Enter');
check('dragging a point of a pending figure: drawn = the figure with that point', same(dots(), (() => {
  const d = draw([[10, 10], [35, 12], [30, 30]]); return d; })()));

pending(L);
press(20, 10, [25, 15]);                 // on the line, not on a handle: the figure moves by (5,5)
tool.handleKey('Enter');
const movedDots = dots();
check('dragging the figure body moves it: drawn = the figure shifted by (5,5)',
  same(movedDots, draw(L.map(([x, y]) => [x + 5, y + 5]))));

pending(L);
press(30, 10);                           // a handle, released without moving
check('pressing a handle and releasing without moving draws the figure and starts the next one',
  dots().size > 0 && tool._phase === 'drawing' && tool._model.points.length === 1);
tool.cancelPending();

pending([[10, 50], [30, 50]]);
const knob = tool._editor.knob();
check('a pending figure shows a turn knob above its middle', knob && knob.x === 20 && knob.y < 50, JSON.stringify(knob));
press(knob.x, knob.y, [30, 50]);          // the knob swings from straight above the pivot to straight right of it: +90 degrees
check('dragging the knob turns the figure', tool._model.getRotation() === 90, String(tool._model.getRotation()));
tool.handleKey('Enter');
{
  const d = dots();
  check('...and it is drawn turned (the line (10,50)-(30,50) becomes the vertical x = 20, y 40 to 60)', d.has(40 * W + 20) && d.has(50 * W + 20) && d.has(60 * W + 20) && !d.has(50 * W + 10));
}

// cursor keys and Ctrl+Z while pending
pending(L);
check('nudgePending moves the figure', tool.nudgePending(3, -2) === true && tool._model.points[0].x === 13 && tool._model.points[0].y === 8);
tool.nudgePending(1, 0);
check('Ctrl+Z (undoPending) takes back the last edit first', tool.undoPending() === true && tool._model.points[0].x === 13);
check('...then the one before', tool.undoPending() === true && tool._model.points[0].x === 10 && tool._phase === 'pending');
check('...and with no edits left, drops the pending figure', tool.undoPending() === true && !tool.hasPending && dots().size === 0);
check('with nothing held, undoPending is not claimed', tool.undoPending() === false);

pending(L);
for (let i = 0; i < 5; i++) tool.nudgePending(1, 1);
const depthBefore = UndoRedo.undoStack.length;
tool.handleKey('Enter');
check('five edits and a commit are ONE undo step', UndoRedo.undoStack.length === depthBefore + 1);
UndoRedo.undo();
check('...which removes it all', dots().size === 0);

// while a figure is being drawn, Ctrl+Z takes back the last point
fresh();
click(10, 10); click(30, 10); click(30, 30);
tool.undoPending();
check('while drawing, Ctrl+Z removes the last point', tool._model.points.length === 2);
tool.cancelPending();

// Clone Last Figure
fresh();
check('before any figure is drawn there is nothing to clone', (FigureHistory.clear(), FigureHistory.cloneLast() === false));
const original = draw(L);
check('a drawn figure is remembered', FigureHistory.has() && FigureHistory.last().tool === 'figure');
ToolManager.selectTool(TOOLS.FIGURE);
check('Clone Last Figure opens a pending copy', FigureHistory.cloneLast() === true && tool._phase === 'pending' && tool.hasPending);
tool.nudgePending(7, 3);
tool.handleKey('Enter');
{
  const both = new Set([...original]);
  for (const k of draw(L.map(([x, y]) => [x + 7, y + 3]))) both.add(k);
  fresh();
  const twice = new Set();
  // reference: draw L and the shifted L on one fresh layer
  for (const pts of [L, L.map(([x, y]) => [x + 7, y + 3])]) { for (const [x, y] of pts) click(x, y); tool.handleKey('Enter'); tool.handleKey('Enter'); }
  for (const k of dots()) twice.add(k);
  check('clone + move by (7,3) = the original and a copy drawn at the offset', same(both, twice));
}
fresh();
draw(L);
EventBus.emit(EVENTS.FILE_NEW, {});
check('File New forgets the last figure', !FigureHistory.has());

// Save commits a pending figure
pending(L);
ToolManager.selectTool(TOOLS.FIGURE);
pending(L);
ToolManager.commitPending();
check('ToolManager.commitPending (before a save) draws the pending figure', dots().size > 0 && !tool.hasPending);

// --- the option rows follow the model: a new closed or three-point figure cannot be missed ---------------------------------------------------------
{
  const schema = global.FigureTool.optionsSchema;
  const filledRow = schema.find(r => r.key === 'filled');
  const fixedHint = schema.find(r => r.i18n === 'figure.usage.fixed');
  const fillable = Object.keys(FigureModel.TYPES).filter(t => FigureModel.TYPES[t].fillable);
  const three = Object.keys(FigureModel.TYPES).filter(t => FigureModel.TYPES[t].maxPoints === 3);
  check('every closed figure shows the Filled box (including the parallelogram)', fillable.includes(T.PARALLELOGRAM) && fillable.every(t => filledRow.showIf.in.includes(t)));
  check('every three-point figure shows the "finishes at the third point" hint', three.includes(T.PARALLELOGRAM) && three.every(t => fixedHint.showIf.in.includes(t)));
  const fs = require('fs'), path = require('path');
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'tools', 'shape-tool.js'), 'utf8');
  const icons = [...src.matchAll(/icon: '(icon-[\w-]+)'/g)].map(m => m[1]);
  check('every icon named in the Shape list has a symbol in index.html', icons.length > 5 && icons.every(id => html.includes('id="' + id + '"')), icons.filter(id => !html.includes('id="' + id + '"')).join());
}

// --- Backspace on a turned pending figure: what is left stays where it is drawn, and the next point lands where it is clicked
fresh();
tool.setShapeType(T.TRIANGLE);
click(100, 100); click(140, 100); click(120, 60);
{
  const ok = tool._phase === 'pending';
  tool._model.setRotation(90);
  const shown = tool._model.rotatedPoints().map(p => ({ x: p.x, y: p.y }));
  tool.handleKey('Backspace');
  const left = tool._model.rotatedPoints();
  check('Backspace on a turned figure leaves the two remaining points where they were drawn', ok && left.length === 2 &&
    left.every((p, i) => p.x === shown[i].x && p.y === shown[i].y), JSON.stringify([shown, left]));
  click(120, 60);
  const c = tool._model.rotatedPoints()[2];
  check('...and the new third point is drawn where it was clicked', !!c && c.x === 120 && c.y === 60, JSON.stringify(c));
  tool.cancelPending();
}
// the same through Ctrl+Z (undoPending) on a turned figure being drawn
fresh();
tool.setShapeType(T.POLYLINE);
click(10, 10); click(40, 10); click(40, 30);
{
  tool._model.setRotation(90);
  const shown = tool._model.rotatedPoints().map(p => ({ x: p.x, y: p.y }));
  tool.undoPending();
  const left = tool._model.rotatedPoints();
  check('Ctrl+Z on a turned figure being drawn leaves the remaining points where they were drawn', left.length === 2 &&
    left.every((p, i) => p.x === shown[i].x && p.y === shown[i].y), JSON.stringify([shown, left]));
  tool.cancelPending();
}

// --- edits made before a Backspace are forgotten: Ctrl+Z cannot bring back a figure from before it
fresh();
tool.setShapeType(T.TRIANGLE);
click(100, 100); click(140, 100); click(120, 60);
tool.nudgePending(1, 0);
tool.handleKey('Backspace');
click(130, 140);
{
  const before = tool._model.points.map(p => `${p.x},${p.y}`).join(' ');
  check('the re-placed triangle is pending with the new point', tool._phase === 'pending' && before === '101,100 141,100 130,140', before);
  tool.undoPending();
  const back = tool.hasPending ? tool._model.points.map(p => `${p.x},${p.y}`).join(' ') : '';
  check('Ctrl+Z after Backspace and a new point does not restore the old point or the move from before the Backspace',
    !back.includes('120,60') && !back.includes('100,100'), back);
  tool.cancelPending();
}

// --- Shape tool: a Filled tick left over from a box shape changes nothing for the shapes that cannot be filled
{
  const st = new ShapeTool();
  fresh();
  st.setShapeType('rectangle');
  st.setFilled(true);
  st.setShapeType('line');
  st.setLineStyle('dashed');
  st.setThickness(8);
  st.setColourCore('1');
  const withTick = st._getShapePixels(40, 40, 200, 120);
  const coreWithTick = st._coreFor(40, 40, 200, 120);
  st.setFilled(false);
  const without = st._getShapePixels(40, 40, 200, 120);
  check('a hidden Filled tick does not turn a thick line into a 1-pixel dashed one', withTick.length === without.length &&
    withTick.length > 1000, `${withTick.length} vs ${without.length}`);
  check('...and the colour core still applies', typeof coreWithTick === 'function');
  let bad = [];
  for (const shape of ['line', 'arc', 'spiral', 'x']) {
    st.setShapeType(shape);
    st.setFilled(true);
    const a = st._getShapePixels(40, 40, 120, 100).length;
    st.setFilled(false);
    const b = st._getShapePixels(40, 40, 120, 100).length;
    if (a !== b) bad.push(`${shape} ${a}/${b}`);
  }
  check('line, arc, spiral and x draw the same with or without the hidden tick', bad.length === 0, bad.join('; '));
  // kept editable: the pending shape's preview and commit plan follow the same rule
  st.setShapeType('line');
  st.setFilled(true);
  st.setPointMode(true);
  st.onPointerDown(40, 40, { button: 0 });
  st.onPointerUp(200, 120, { button: 0 });
  const plan = st._editor.plan();
  check('a kept-editable thick line with the hidden tick keeps its thickness and its colour core',
    plan.pixels.length === without.length && typeof plan.core === 'function', `${plan.pixels.length} core ${typeof plan.core}`);
  st.cancelPending();
  st.setPointMode(false);
  st.setFilled(false);
  st.setLineStyle('solid');
  st.setThickness(1);
  st.setColourCore('whole');

  // --- a pending shape committed in the middle of a handle drag (Ctrl+S with the button held) leaves nothing behind
  fresh();
  st.setShapeType('rectangle');
  st.setPointMode(true);
  st.onPointerDown(100, 100, { button: 0 });
  st.onPointerUp(140, 130, { button: 0 });
  const hit = st._editor.hitTest(100, 100);
  st.onPointerDown(100, 100, { button: 0 });
  const grabbed = !!st._editing;
  st.commitPending();
  st.onPointerMove(150, 130, { button: 0 });
  st.onPointerUp(150, 130, { button: 0 });
  check('commitPending during a handle drag: the release opens no stray shape', hit && hit.mode === 'point' && grabbed &&
    st.hasPending === false && !st._editing && !st.isDrawing, `pending ${st.hasPending} editing ${!!st._editing}`);
  st.cancelPending();
  st.setPointMode(false);
}

// --- a slow drag of a turned shape's corner (many small moves) does not walk the opposite corner away
{
  const st = new ShapeTool();
  const bad = [];
  for (const shape of ['square', 'rectangle']) {
    for (const deg of [30, -55]) {
      fresh();
      st.setShapeType(shape);
      st.setRotation(deg);
      st.setPointMode(true);
      st.onPointerDown(60, 50, { button: 0 });
      st.onPointerUp(120, 90, { button: 0 });
      const m0 = st._editor.model;
      const fixed = m0.handlePoint(0);
      const h = m0.handlePoint(1);
      st.onPointerDown(h.x, h.y, { button: 0 });
      for (let k = 1; k <= 20; k++) st.onPointerMove(h.x + k, h.y + k, { button: 0 });
      st.onPointerUp(h.x + 20, h.y + 20, { button: 0 });
      const now = st._editor.model.handlePoint(0);
      if (Math.abs(now.x - fixed.x) > 1 || Math.abs(now.y - fixed.y) > 1) bad.push(`${shape} ${deg}: ${JSON.stringify(fixed)} -> ${JSON.stringify(now)}`);
      st.cancelPending();
    }
  }
  st.setPointMode(false);
  st.setRotation(0);
  check('a slow 20-step corner drag of a turned square or rectangle leaves the opposite corner where it was drawn', bad.length === 0, bad.join('; '));
}

summary();
