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

summary();
