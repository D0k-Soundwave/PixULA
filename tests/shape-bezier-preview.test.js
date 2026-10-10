'use strict';
/**
 * Batch 7 part 7B carry-overs from the Figure tool: the Shape and Bezier previews show what the commit will leave
 * (mirror copies, the drawing guide, a locked layer), and the Bezier tool commits a curve when you switch tools,
 * drops it on Escape (cancelPending) and when the document changes, and redraws when the colours or mode change.
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
  getColorIndex(base, bright) { return base === 0 ? 0 : base + (bright ? 8 : 0); },
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
    if (prop === 'drawCompositorPreview') return (ink, erase) => { previews.push({ ink: ink.slice(), erase: erase.slice() }); };
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
loadModule('js/tools/bezier-tool.js');

ColorManager.initialize();
const shape = new ShapeTool();
const bezier = new BezierTool();
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
  bezier.cancelPending();
  shape.setShapeType('rectangle');
  shape.setFilled(false);
  shape.setThickness(1);
  ColorManager.setInk(2); ColorManager.setPaper(7); ColorManager.setBright(false); ColorManager.setFlash(false);
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
const same = (a, b) => a.size === b.size && [...a].every(k => b.has(k));
const ev = { button: 0, timeStamp: 1 };

// --- the Shape preview is the commit ------------------------------------------------------------------------------------------------
function shapePreviewEqualsCommit(label, setup) {
  fresh();
  setup();
  shape.onPointerDown(20, 30, ev);
  shape.onPointerMove(90, 70, ev);
  const shown = new Set(previews[previews.length - 1].ink.map(p => p.y * W + p.x));
  shape.onPointerUp(90, 70, ev);
  check(label, shown.size > 20 && same(shown, dots()), `${shown.size} vs ${dots().size}`);
}
shapePreviewEqualsCommit('Shape preview = commit (plain)', () => {});
shapePreviewEqualsCommit('Shape preview = commit (mirror h)', () => StateManager.setSymmetryMode('h'));
shapePreviewEqualsCommit('Shape preview = commit (mirror quad)', () => StateManager.setSymmetryMode('quad'));
shapePreviewEqualsCommit('Shape preview = commit (drawing guide inside)', () => {
  StateManager.setClipMode('inside');
  region = { x: 30, y: 20, width: 40, height: 40, mask: null };
});
shapePreviewEqualsCommit('Shape preview = commit (a dashed, turned rounded rectangle with a guide outside)', () => {
  shape.setShapeType('rounded-rectangle');
  shape.setLineStyle('dashed');
  shape.setRotation(30);
  StateManager.setClipMode('outside');
  region = { x: 40, y: 40, width: 20, height: 20, mask: null };
});
shape.setLineStyle('solid'); shape.setRotation(0);

fresh();
{
  LayerManager.layers[1].locked = true;
  shape.onPointerDown(20, 30, ev);
  shape.onPointerMove(90, 70, ev);
  const last = previews[previews.length - 1];
  check('on a locked layer the preview shows nothing (the commit writes nothing)', last.ink.length === 0);
  shape.onPointerUp(90, 70, ev);
  LayerManager.layers[1].locked = false;
}

// --- the Shape options ---------------------------------------------------------------------------------------------------------------
fresh();
shape.setShapeType('rounded-rectangle');
shape.setRounding(0);
check('Shape: rounding 0 draws a plain rectangle', same(new Set(shape._getShapePixels(10, 10, 50, 40).map(p => p.y * W + p.x)),
  new Set(ShapeGenerator.generateShape('rectangle', { x1: 10, y1: 10, x2: 50, y2: 40 }).map(p => p.y * W + p.x))));
shape.setRounding(50);
check('Shape: setLineStyle cleans junk to solid', (shape.setLineStyle('wavy'), shape.getLineStyle() === 'solid'));
check('Shape: rotation is clamped to -180..180', (shape.setRotation(400), shape.getRotation() === 180) && (shape.setRotation(-400), shape.getRotation() === -180));
shape.setRotation(0);

// --- the Bezier tool --------------------------------------------------------------------------------------------------------------------
function bezierEdit() {
  bezier.onPointerDown(20, 60, ev);
  bezier.onPointerMove(80, 60, ev);
  bezier.onPointerUp(80, 60, ev);
}
fresh();
bezierEdit();
check('Bezier: placing the anchors leaves a pending curve', bezier._phase === 'edit' && dots().size === 0);
bezier.deactivate();
check('Bezier: switching tools COMMITS the curve being edited', dots().size > 50 && bezier._phase === 'idle', String(dots().size));
bezier.activate();

fresh();
bezierEdit();
bezier.cancelPending();
check('Bezier: cancelPending (Escape) drops it without drawing', dots().size === 0 && bezier._phase === 'idle');
bezierEdit();
EventBus.emit(EVENTS.FILE_NEW, {});
check('Bezier: File New drops a pending curve', dots().size === 0 && bezier._phase === 'idle');

// line style on the curve
fresh();
bezier.setLineStyle('dashed');
check('Bezier: a dashed curve is stored', bezier.getLineStyle() === 'dashed');
check('Bezier: clear is not offered, so it becomes solid', (bezier.setLineStyle('clear'), bezier.getLineStyle() === 'solid'));
bezier.setLineStyle('dashed');
bezier.onPointerDown(0, 100, ev);
bezier.onPointerMove(47, 100, ev);
bezier.onPointerUp(47, 100, ev);
bezier.commitCurve();
{
  const d = dots();
  const xs = new Set([...d].map(k => k % W));
  check('Bezier: the committed dashed curve has gaps (x 0-17 and 24-41 on a straight one)',
    xs.has(0) && xs.has(17) && !xs.has(18) && !xs.has(23) && xs.has(24), [...xs].sort((a, b) => a - b).join(','));
}
bezier.setLineStyle('solid');

// ===== A Shape kept editable, and clone / nudge / Ctrl+Z on both (Batch 7 part 7C) ================================================
{
  ToolManager.register(shape);
  ToolManager.register(bezier);
  const drag = (x1, y1, x2, y2, extra) => {
    const e = { button: 0, timeStamp: 1 };
    shape.onPointerDown(x1, y1, e);
    shape.onPointerMove(x2, y2, e);
    shape.onPointerUp(x2, y2, e);
  };

  // Keep editable off: draws on release (the same raster as before), and is remembered
  fresh();
  drag(20, 30, 70, 60);
  const direct = dots();
  check('Shape, Keep editable off: draws on release', direct.size > 100 && !shape.hasPending);
  check('...and the shape is remembered for Clone', FigureHistory.has() && FigureHistory.last().tool === 'shape');

  // on: stays pending, Enter draws the same pixels
  fresh();
  shape.setPointMode(true);
  drag(20, 30, 70, 60);
  check('Shape, Keep editable on: nothing is drawn on release', dots().size === 0 && shape.hasPending);
  check('...Enter draws exactly what the one-drag commit draws', shape.handleKey('Enter') === true && same(dots(), direct));

  // move by dragging the body = the shape drawn there
  fresh();
  shape.setPointMode(true);
  drag(20, 30, 70, 60);
  {
    const e = { button: 0, timeStamp: 1 };
    shape.onPointerDown(45, 30, e);          // on the top edge
    shape.onPointerMove(52, 36, e);
    shape.onPointerUp(52, 36, e);
  }
  shape.handleKey('Enter');
  const movedShape = dots();
  fresh();
  shape.setPointMode(false);
  drag(27, 36, 77, 66);
  check('Shape: dragging the body by (7,6) = the shape drawn there', movedShape.size > 100 && same(movedShape, dots()));
  shape.setPointMode(true);

  // drag a corner handle = the rectangle to there
  fresh();
  drag(20, 30, 70, 60);
  {
    const e = { button: 0, timeStamp: 1 };
    shape.onPointerDown(70, 60, e);
    shape.onPointerMove(90, 80, e);
    shape.onPointerUp(90, 80, e);
  }
  shape.handleKey('Enter');
  const resized = dots();
  fresh();
  shape.setPointMode(false);
  drag(20, 30, 90, 80);
  check('Shape: dragging the corner handle = the rectangle drawn to there', same(resized, dots()));
  shape.setPointMode(true);

  // cursor keys, Ctrl+Z and a turned shape
  fresh();
  drag(20, 30, 70, 60);
  check('Shape: nudgePending moves it', shape.nudgePending(4, 2) === true);
  check('Shape: Ctrl+Z takes the move back', shape.undoPending() === true && shape.hasPending);
  shape.setRotation(30);
  check('Shape: changing Rotation turns the pending shape', shape._editor.model.getRotation() === 30);
  check('Shape: Ctrl+Z with no edits left drops it', (shape.undoPending(), !shape.hasPending));
  shape.setRotation(0);

  // switching shape-tool off commits
  fresh();
  drag(20, 30, 70, 60);
  shape.deactivate();
  check('Shape: switching tools draws a shape that is waiting', dots().size > 100 && !shape.hasPending);
  shape.activate();

  // Escape drops
  fresh();
  drag(20, 30, 70, 60);
  shape.cancelPending();
  check('Shape: Escape drops it', dots().size === 0 && !shape.hasPending);
  shape.setPointMode(false);

  // clone of a shape: a pending copy, any setting
  fresh();
  drag(20, 30, 70, 60);
  ToolManager.selectTool('shape');
  FigureHistory.cloneLast();
  check('Clone of a shape opens it pending even with Keep editable off', shape.hasPending);
  shape.nudgePending(10, 10);
  shape.handleKey('Enter');
  check('...and the moved copy is drawn beside the original', dots().size > direct.size);

  // Bezier: nudge, undo, commitPending, clone
  fresh();
  bezierEdit();
  check('Bezier: nudgePending moves the curve', bezier.nudgePending(0, 5) === true && bezier._p0.y === 65);
  check('Bezier: Ctrl+Z drops the curve being edited', bezier.undoPending() === true && bezier._phase === 'idle');
  check('Bezier: undoPending with nothing held is not claimed', bezier.undoPending() === false);
  bezierEdit();
  bezier.commitPending();
  const bez = dots();
  check('Bezier: commitPending draws it and remembers it', bez.size > 40 && FigureHistory.last().tool === 'bezier');
  ToolManager.selectTool(TOOLS.BEZIER);
  FigureHistory.cloneLast();
  check('Clone of a curve opens it for editing', bezier._phase === 'edit');
  bezier.nudgePending(0, 20);
  bezier.commitPending();
  check('...and the copy is drawn 20 rows lower', dots().size > bez.size);
  bezier.cancelPending();
}

// --- Review fixes (group B): a waiting shape follows every option, survives the pointer leaving, keeps its own dials in a clone ----
{
  ToolManager.register(shape);
  ToolManager.register(bezier);
  const drag = (x1, y1, x2, y2) => {
    const e = { button: 0, timeStamp: 1 };
    shape.onPointerDown(x1, y1, e);
    shape.onPointerMove(x2, y2, e);
    shape.onPointerUp(x2, y2, e);
  };
  fresh();
  shape.setPointMode(true);
  drag(20, 30, 70, 60);
  shape.setFilled(true);
  shape.handleKey('Enter');
  const filledCount = dots().size;
  fresh();
  shape.setPointMode(false);
  shape.setFilled(true);
  drag(20, 30, 70, 60);
  check('a waiting shape follows Filled (same pixels as drawing it filled)', filledCount > 1000 && filledCount === dots().size, filledCount + ' vs ' + dots().size);

  fresh();
  shape.setPointMode(true);
  drag(20, 30, 70, 60);
  shape.setThickness(3);
  shape.handleKey('Enter');
  const thick = dots().size;
  fresh();
  shape.setPointMode(false);
  shape.setThickness(3);
  drag(20, 30, 70, 60);
  check('a waiting shape follows Thickness', thick > 200 && thick === dots().size);
  shape.setThickness(1);

  fresh();
  shape.setPointMode(true);
  drag(20, 30, 70, 60);
  previews.length = 0;
  shape.onPointerLeave({});
  const shown = previews.length ? previews[previews.length - 1].ink.length : 0;
  check('the pointer leaving the canvas keeps a waiting shape on show', shape.hasPending && shown > 100, 'shown ' + shown);
  shape.cancelPending();

  // a cloned arc keeps its own span when another option changes
  fresh();
  shape.setPointMode(false);
  shape.setShapeType('arc');
  shape.setArcSpan(270);
  drag(20, 30, 70, 60);
  const arc270 = dots();
  shape.setArcSpan(90);
  fresh();
  shape.setPointMode(true);
  shape.setShapeType('arc');
  shape.setArcSpan(270);
  drag(20, 30, 70, 60);
  shape.handleKey('Enter');
  shape.setArcSpan(90);
  FigureHistory.cloneLast();
  shape.setLineStyle('solid');
  check('a cloned arc keeps its 270 degrees when an option changes', shape.getArcSpan() === 270);
  shape.cancelPending();
  shape.setArcSpan(180);
  shape.setShapeType('rectangle');
}

summary();
